"""Make a coarse Natural Earth land guard; the GSI water layer supplies the visible shoreline."""
import argparse,json,urllib.request
from pathlib import Path
from shapely.geometry import shape,box,mapping
from shapely.ops import unary_union
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--cache',type=Path,required=True)
args=parser.parse_args();args.cache.mkdir(parents=True,exist_ok=True)
file=args.cache/'ne_10m_land.geojson'
url='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson'
if not file.exists():
    with urllib.request.urlopen(url,timeout=40) as response:file.write_bytes(response.read())
region=box(122,23,147,47)
parts=[shape(f['geometry']) for f in json.loads(file.read_text('utf8'))['features']]
land=unary_union([part.intersection(region) for part in parts if part.intersects(region)])
guard=land.simplify(.001,preserve_topology=True).buffer(.02).simplify(.003,preserve_topology=True)
(ROOT/'data/land-mask.json').write_text(json.dumps({'source':'https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-land/','geometry':mapping(guard)},separators=(',',':'))+'\n',encoding='utf8',newline='\n')
