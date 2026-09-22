"""Build a small continuous land backdrop around Japan from Natural Earth (public domain)."""
import argparse
import json
from pathlib import Path
from shapely.geometry import shape, box, mapping
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, required=True, help='Natural Earth ne_10m_land.geojson')
args = parser.parse_args()
region = box(118, 20, 151, 55)
parts = [shape(f['geometry']) for f in json.loads(args.source.read_text('utf8'))['features']]
land = unary_union([p.intersection(region) for p in parts if p.intersects(region)])
polygons = []
for part in land.geoms:
    if part.area < .0001:
        continue
    part = orient(part.simplify(.008, preserve_topology=True), sign=1)
    rings = []
    for ring in mapping(part)['coordinates']:
        previous = [0, 0]; values = []
        for point in ring:
            current = [round(v * 10000) for v in point]
            values.extend([current[0]-previous[0], current[1]-previous[1]])
            previous = current
        rings.append(values)
    polygons.append({'bounds':[round(v,4) for v in part.bounds], 'rings':rings})
data = {'precision':10000, 'bounds':[118,20,151,55], 'polygons':polygons}
output = ROOT/'regional-land-data.js'
output.write_text('// Natural Earth 1:10m land, simplified. Public domain. See data/README.md.\nwindow.TRAIN_GO_REGIONAL_LAND = '+json.dumps(data,separators=(',',':'))+';\n',encoding='utf8',newline='\n')
print(f'{len(polygons)} polygons; {output.stat().st_size:,} bytes')
