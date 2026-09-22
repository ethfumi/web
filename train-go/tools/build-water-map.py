"""Extract offline water geometry from GSI PMTiles (pip: pmtiles mapbox-vector-tile shapely)."""
import argparse
import concurrent.futures
import gzip
import json
import math
import urllib.request
from functools import lru_cache
from pathlib import Path

import mapbox_vector_tile
from pmtiles.reader import Reader
from shapely.geometry import box, shape, mapping, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/optimal_bvmap-v1.pmtiles'


def tile_xy(lon, lat, z):
    return int((lon+180)/360*2**z), int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z)


def lonlat(x, y, z):
    return [round(x/2**z*360-180, 6), round(math.degrees(math.atan(math.sinh(math.pi*(1-2*y/2**z)))), 6)]


def encode_path(points):
    result, previous = [], [0,0]
    for point in points:
        current = [round(point[0]*100000), round(point[1]*100000)]
        result.extend([current[0]-previous[0], current[1]-previous[1]])
        previous = current
    return result


def deduplicate_tiles(tiles):
    # Higher-detail tiles completely repaint their rectangles. Do not ship hidden coarse geometry.
    cover = unary_union([box(*t['bounds']) for t in tiles if t['z'] == 10])
    def decode(values):
        x=y=0; result=[]
        for i in range(0,len(values),2):
            x+=values[i]; y+=values[i+1]; result.append([x/100000,y/100000])
        return result
    for tile in tiles:
        if tile['z'] != 8:
            continue
        water=[]
        for rings in tile['water']:
            polygon=Polygon(decode(rings[0]),[decode(r) for r in rings[1:]])
            if not polygon.is_valid:
                polygon=polygon.buffer(0)
            remaining=polygon.difference(cover)
            parts=list(remaining.geoms) if hasattr(remaining,'geoms') else [remaining]
            for part in parts:
                if part.geom_type=='Polygon' and not part.is_empty:
                    water.append([encode_path(r) for r in mapping(part)['coordinates']])
        tile['water']=water
    return tiles


def build(cache):
    cache.mkdir(parents=True, exist_ok=True)

    @lru_cache(maxsize=512)
    def read_range(offset, length):
        path = cache/f'{offset}-{length}.bin'
        if path.exists():
            return path.read_bytes()
        request = urllib.request.Request(URL, headers={'Range':f'bytes={offset}-{offset+length-1}', 'User-Agent':'train-go-map/1.0'})
        with urllib.request.urlopen(request, timeout=40) as response:
            if response.status != 206:
                raise RuntimeError('Byte ranges required: refusing to download the full national archive')
            result = response.read(length+1)
        if len(result) != length:
            raise RuntimeError('Unexpected byte range length')
        path.write_bytes(result)
        return result

    reader = Reader(read_range)
    reader.header()
    stations = json.loads((ROOT/'data/station-database.json').read_text('utf8'))['stations']
    rail_tiles = {tile_xy(s[2], s[3], 8) for s in stations.values() if not s[5]}
    requested = {(8, x+dx, y+dy) for x, y in rail_tiles for dx in [-1,0,1] for dy in [-1,0,1]}
    # GSI omits river geometry below z10. Apply the same detail to railway areas nationwide.
    detail_tiles = {tile_xy(s[2], s[3], 10) for s in stations.values() if not s[5]}
    requested.update((10,x+dx,y+dy) for x,y in detail_tiles for dx in [-1,0,1] for dy in [-1,0,1])
    print(f'Extracting {len(requested)} small tiles via byte ranges', flush=True)

    def extract(tile):
        z,x,y = tile
        raw = reader.get(z,x,y)
        if not raw:
            return None
        if raw[:2] == b'\x1f\x8b':
            raw = gzip.decompress(raw)
        layers = mapbox_vector_tile.decode(raw, default_options={'y_coord_down':True})
        water, rivers = [], []
        # Water areas include the sea, lakes and wide rivers. Tiny drainage channels are omitted.
        for layer_name, target in [('WA', water)]:
            layer = layers.get(layer_name)
            if not layer:
                continue
            extent = layer['extent']
            clip = box(0,0,extent,extent)
            middle_lat = lonlat(x+0.5,y+0.5,z)[1]
            meters_per_unit = 40075016.686*math.cos(math.radians(middle_lat))/(2**z*extent)
            def transform_coords(coords):
                if isinstance(coords[0], (int,float)):
                    return lonlat(x+coords[0]/extent, y+coords[1]/extent, z)
                return [transform_coords(c) for c in coords]
            for feature in layer['features']:
                geom = shape(feature['geometry'])
                if not geom.is_valid:
                    geom = geom.buffer(0)
                # Roughly 200m simplification nationwide; keep topology of narrow rivers and islands.
                geom = geom.intersection(clip).simplify(3 if z == 8 else 24, preserve_topology=True)
                if geom.is_empty:
                    continue
                parts = list(geom.geoms) if geom.geom_type.startswith('Multi') or geom.geom_type == 'GeometryCollection' else [geom]
                for part in parts:
                    if part.geom_type == ('Polygon' if layer_name == 'WA' else 'LineString'):
                        if z >= 10 and part.area*meters_per_unit**2 < 100000 and not part.intersects(clip.boundary):
                            continue
                        coords = transform_coords(mapping(part)['coordinates'])
                        target.append([encode_path(ring) for ring in coords] if layer_name == 'WA' else encode_path(coords))
        if not water and not rivers:
            return None
        return {'z':z, 'bounds':[*lonlat(x,y+1,z), *lonlat(x+1,y,z)], 'water':water, 'rivers':rivers}

    tiles = sorted(requested)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        result = [t for t in pool.map(extract, tiles) if t]
    return {'source':URL, 'sourceDate':'2026-07-01', 'retrieved':'2026-09-22', 'precision':100000, 'tiles':deduplicate_tiles(result)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache',type=Path,required=True,help='Task scratch directory for downloaded byte ranges')
    args = parser.parse_args()
    data = build(args.cache)
    output = ROOT/'map-water-data.js'
    text = '// 国土地理院最適化ベクトルタイルを加工。出典・生成方法: data/README.md\n'
    text += 'window.TRAIN_GO_WATER_DATA = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n'
    output.write_text(text,encoding='utf8',newline='\n')
    print(f'{len(data["tiles"])} tiles, {output.stat().st_size} bytes')
