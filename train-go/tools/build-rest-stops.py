"""Select OSM roadside stations from a services/rest_area snapshot and compile offline labels."""
import argparse,json,re,math,unicodedata
from pathlib import Path
import pykakasi
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source',type=Path,help='Overpass JSON with services/rest_area elements')
args=parser.parse_args()
source_file=ROOT/'data/rest-stops.json'
if args.source:
    data=json.loads(args.source.read_text('utf8'));candidates=[];converter=pykakasi.kakasi()
    for element in data['elements']:
        tags=element['tags'];name=tags.get('name:ja') or tags.get('name','');point=element.get('center',element)
        if not name.startswith('道の駅'):continue
        if any(tags.get(k)=='yes' for k in ['disused','abandoned','construction','proposed']):continue
        name=re.sub(r'^道の駅[\s　「『]*','',name).rstrip('」』 ').strip()
        if not name or not (123<=point['lon']<=146 and 24<=point['lat']<=46):continue
        reading=tags.get('name:ja-Hira') or tags.get('name:ja_kana') or tags.get('name:ja_hira')
        if reading:reading=re.sub(r'^(みちのえき|ミチノエキ|道の駅)[\s　「『]*','',reading).rstrip('」』 ')
        else:reading=''.join(t['hira'] for t in converter.convert(name))
        reading=''.join(chr(ord(c)-0x60) if 'ァ'<=c<='ヶ' else c for c in reading)
        candidates.append(dict(name=name,kana=reading,lon=round(point['lon'],5),lat=round(point['lat'],5),
          source=f'https://www.openstreetmap.org/{element["type"]}/{element["id"]}',
          key=re.sub(r'[\s「」『』・]','',unicodedata.normalize('NFKC',name)),area=element['type']!='node'))
    entries=[]
    for item in sorted(candidates,key=lambda x:(not x['area'],x['name'])):
        if any(p['key']==item['key'] and math.hypot((p['lon']-item['lon'])*.8,p['lat']-item['lat'])<.01 for p in entries):continue
        entries.append(item)
    for p in entries:p.pop('key');p.pop('area')
    data={'source':'OpenStreetMap contributors / ODbL 1.0','osmBase':data.get('osm3s',{}).get('timestamp_osm_base'),
      'note':'サービスエリア・休憩施設のうち道の駅と記載された地点。読みは登録値を優先し、未登録分は自動変換。公式登録駅の全件網羅を示すデータではない。','entries':entries}
    source_file.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
else:data=json.loads(source_file.read_text('utf8'))
points=[[p['name'],p['kana'],p['lon'],p['lat']] for p in data['entries']]
output=ROOT/'rest-stop-data.js'
output.write_text('// OpenStreetMap roadside-station labels. See data/rest-stops.json.\nwindow.TRAIN_GO_REST_STOPS = '+json.dumps(points,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8',newline='\n')
print(f'{len(points)} roadside stations; {output.stat().st_size:,} bytes before compression')
