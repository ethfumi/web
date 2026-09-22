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
from shapely.geometry import box, shape, mapping, Polygon, LineString
from shapely.geometry.polygon import orient
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
        current = [round(point[0]*10000), round(point[1]*10000)]
        result.extend([current[0]-previous[0], current[1]-previous[1]])
        previous = current
    return result


def simplify_near_terminals(polygon, terminals, radius):
    """Retain the finer original shore only near terminals, keeping the coarse ring elsewhere."""
    def close_to_bounds(geometry,points):
        left,bottom,right,top=geometry.bounds
        return [p for p in points if left-radius<=p[0]<=right+radius and bottom-radius<=p[1]<=top+radius]
    terminals=close_to_bounds(polygon,terminals)
    coarse=polygon.simplify(24,preserve_topology=True)
    if not terminals:
        return coarse
    def refine(original,simplified):
        candidates=close_to_bounds(original,terminals)
        if not candidates:return list(simplified.coords)
        original=list(original.coords)[:-1]
        positions={tuple(p):i for i,p in enumerate(original)}
        kept=list(simplified.coords)
        result=[]
        for a,b in zip(kept,kept[1:]):
            if a not in positions or b not in positions:
                return list(simplified.coords)
            start,end=positions[a],positions[b]
            segment=original[start:end+1] if end>start else original[start:]+original[:end+1]
            near=any((p[0]-q[0])**2+(p[1]-q[1])**2<=radius**2 for p in segment for q in candidates)
            points=list(LineString(segment).simplify(6).coords) if near else [a,b]
            result.extend(points[:-1])
        return result+[result[0]]
    holes=[]
    original_holes={tuple(point):ring for ring in polygon.interiors for point in ring.coords}
    for hole in coarse.interiors:
        if not close_to_bounds(hole,terminals):
            holes.append(list(hole.coords))
            continue
        original=original_holes.get(tuple(hole.coords[0]))
        holes.append(refine(original,hole) if original is not None else list(hole.coords))
    result=Polygon(refine(polygon.exterior,coarse.exterior),holes)
    return result if result.is_valid else polygon.simplify(6,preserve_topology=True)


def deduplicate_tiles(tiles):
    # Higher-detail tiles completely repaint their rectangles. Do not ship hidden coarse geometry.
    cover = unary_union([box(*t['bounds']) for t in tiles if t['z'] == 10])
    def decode(values):
        x=y=0; result=[]
        for i in range(0,len(values),2):
            x+=values[i]; y+=values[i+1]; result.append([x/10000,y/10000])
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
    land_mask=shape(json.loads((ROOT/'data/land-mask.json').read_text('utf8'))['geometry'])
    rail_tiles = {tile_xy(s[2], s[3], 8) for s in stations.values() if not s[5]}
    requested = {(8, x+dx, y+dy) for x, y in rail_tiles for dx in [-1,0,1] for dy in [-1,0,1]}
    # GSI omits river geometry below z10. Apply the same detail to railway areas nationwide.
    detail_tiles = {tile_xy(s[2], s[3], 10) for s in stations.values() if not s[5]}
    requested.update((10,x+dx,y+dy) for x,y in detail_tiles for dx in [-1,0,1] for dy in [-1,0,1])
    # The same offline coast detail must also cover islands without railways.
    transport_points=[]
    for file,field in [('air-network.json','airports'),('ferry-network.json','ports')]:
        path=ROOT/'data'/file
        if path.exists():
            records=json.loads(path.read_text('utf8'))[field]
            transport_points.extend((row[3],row[4]) if field=='airports' else (row[2],row[3]) for row in records)
    for lon,lat in transport_points:
        x,y=tile_xy(lon,lat,8)
        requested.update((8,x+dx,y+dy) for dx in [-1,0,1] for dy in [-1,0,1])
        x,y=tile_xy(lon,lat,10)
        requested.add((10,x,y))
    ports_by_tile={}
    for lon,lat in transport_points:
        x,y=tile_xy(lon,lat,10)
        for dx in [-1,0,1]:
            for dy in [-1,0,1]:
                ports_by_tile.setdefault((x+dx,y+dy),[]).append((lon,lat))
    print(f'Extracting {len(requested)} small tiles via byte ranges', flush=True)

    def extract(tile):
        z,x,y = tile
        raw = reader.get(z,x,y)
        if not raw:
            return None
        if raw[:2] == b'\x1f\x8b':
            raw = gzip.decompress(raw)
        layers = mapbox_vector_tile.decode(raw, default_options={'y_coord_down':True})
        water, rivers, islands, labels = [], [], [], []
        # Water areas include the sea, lakes and wide rivers. Tiny drainage channels are omitted.
        for layer_name, target in [('WA', water),('RvrCL',rivers)]:
            layer = layers.get(layer_name)
            if not layer:
                continue
            extent = layer['extent']
            clip = box(0,0,extent,extent)
            middle_lat = lonlat(x+0.5,y+0.5,z)[1]
            meters_per_unit = 40075016.686*math.cos(math.radians(middle_lat))/(2**z*extent)
            local_ports=[(((lon+180)/360*2**z-x)*extent,
                          ((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z-y)*extent)
                         for lon,lat in ports_by_tile.get((x,y),[])] if z==10 else []
            def transform_coords(coords):
                if isinstance(coords[0], (int,float)):
                    return lonlat(x+coords[0]/extent, y+coords[1]/extent, z)
                return [transform_coords(c) for c in coords]
            for feature in layer['features']:
                code=feature['properties'].get('vt_code')
                if layer_name=='RvrCL' and code in (5302,5322):continue
                geom = shape(feature['geometry'])
                if not geom.is_valid:
                    geom = geom.buffer(0)
                geom = geom.intersection(clip)
                if geom.is_empty:
                    continue
                parts = list(geom.geoms) if geom.geom_type.startswith('Multi') or geom.geom_type == 'GeometryCollection' else [geom]
                for part in parts:
                    if part.geom_type == ('Polygon' if layer_name == 'WA' else 'LineString'):
                        if layer_name=='WA':
                            if z>=10 and part.area*meters_per_unit**2<10000 and not part.intersects(clip.boundary):continue
                            if z==10 and code!=5101:
                                area=part.area*meters_per_unit**2
                                width=2*part.area/max(part.length,1)*meters_per_unit
                                compactness=4*math.pi*part.area/max(part.length**2,1)
                                if width<300 and compactness<.15:
                                    # Trace narrow water areas instead of filling their simplified banks.
                                    line=LineString(part.exterior.coords).simplify(18,preserve_topology=False)
                                    rivers.append(encode_path(transform_coords(list(line.coords))))
                                    continue
                                part=part.simplify(12,preserve_topology=True)
                            else:
                                part=simplify_near_terminals(part,local_ports,500/meters_per_unit) if z==10 else part.simplify(3,preserve_topology=True)
                            if z>=10 and part.area*meters_per_unit**2<10000 and not part.intersects(clip.boundary):continue
                            part=orient(part,sign=1)
                            if code==5101:islands.extend(encode_path(transform_coords(list(ring.coords))) for ring in part.interiors)
                        else:part=part.simplify(24,preserve_topology=False)
                        coords = transform_coords(mapping(part)['coordinates'])
                        target.append([encode_path(ring) for ring in coords] if layer_name == 'WA' else encode_path(coords))
        anno=layers.get('Anno')
        if anno:
            for feature in anno['features']:
                props=feature['properties'];code=props.get('vt_code')
                if code not in (314,315,316,351,352,353) or feature['geometry']['type']!='Point':continue
                ax,ay=feature['geometry']['coordinates']
                if 0<=ax<anno['extent'] and 0<=ay<anno['extent']:
                    labels.append([props['vt_text'],*lonlat(x+ax/anno['extent'],y+ay/anno['extent'],z),'island' if code>=351 else 'mountain'])
        if not water and not rivers:
            return None
        bounds=[*lonlat(x,y+1,z), *lonlat(x+1,y,z)]
        rect=box(*bounds)
        if land_mask.covers(rect):land=True
        else:
            land=[]
            clipped=land_mask.intersection(rect)
            parts=list(clipped.geoms) if hasattr(clipped,'geoms') else [clipped]
            for part in parts:
                if part.geom_type=='Polygon' and not part.is_empty:
                    land.append([encode_path(r) for r in mapping(orient(part,sign=1))['coordinates']])
        return {'z':z, 'bounds':bounds, 'water':water, 'rivers':rivers,'land':land,'islands':islands,'labels':labels}

    tiles = sorted(requested)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        result = [t for t in pool.map(extract, tiles) if t]
    labels={}
    for tile in result:
        for label in tile.pop('labels'):
            labels.setdefault((label[0],round(label[1],2),round(label[2],2)),label)
    (ROOT/'data/geographic-labels.json').write_text(json.dumps(list(labels.values()),ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
    return {'source':URL, 'sourceDate':'2026-07-01', 'retrieved':'2026-09-22', 'precision':10000, 'tiles':deduplicate_tiles(result)}


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
