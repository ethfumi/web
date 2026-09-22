"""Create a compact, quantized overview of GSI DEM10B terrain for offline drawing."""
import argparse,base64,concurrent.futures,io,json,math,urllib.request,urllib.error
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
def xy(lon,lat,z=7):return int((lon+180)/360*2**z),int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z)
def lonlat(x,y,z=7):return [x/2**z*360-180,math.degrees(math.atan(math.sinh(math.pi*(1-2*y/2**z))))]
def build(cache):
    cache.mkdir(parents=True,exist_ok=True)
    left,bottom=xy(122.5,23.5);right,top=xy(146.5,46.5)
    def tile(pair):
        x,y=pair;file=cache/f'7-{x}-{y}.png';missing=file.with_suffix('.missing')
        if missing.exists():return None
        if not file.exists():
            try:
                with urllib.request.urlopen(f'https://cyberjapandata.gsi.go.jp/xyz/dem_png/7/{x}/{y}.png',timeout=25) as response:file.write_bytes(response.read())
            except urllib.error.HTTPError as error:
                if error.code!=404:raise
                missing.touch();return None
        image=Image.open(file).convert('RGB');pixels=image.load();values=[]
        for row in range(128):
            for col in range(128):
                r,g,b=pixels[col*2+1,row*2+1];value=r*65536+g*256+b
                height=(value if value<8388608 else value-16777216)*.01
                values.append(0 if value==8388608 else max(1,min(255,round(max(0,height)/50)+1)))
        if not any(values):return None
        return {'bounds':[*lonlat(x,y+1),*lonlat(x+1,y)],'heights':base64.b64encode(bytes(values)).decode()}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        tiles=[t for t in pool.map(tile,[(x,y) for x in range(left,right+1) for y in range(top,bottom+1)]) if t]
    data={'source':'https://maps.gsi.go.jp/development/ichiran.html#dem','gridSize':128,'stepMeters':50,'tiles':tiles}
    (ROOT/'terrain-data.js').write_text('// GSI DEM10B, sampled for overview shading. See data/README.md.\nwindow.TRAIN_GO_TERRAIN_DATA = '+json.dumps(data,separators=(',',':'))+';\n',encoding='utf8',newline='\n')
    print('terrain tiles',len(tiles),'bytes',(ROOT/'terrain-data.js').stat().st_size)
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--cache',type=Path,required=True)
    build(parser.parse_args().cache)
