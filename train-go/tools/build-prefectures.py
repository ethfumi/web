"""Resolve route stops to prefectures offline; only small code lists are shipped."""
import argparse,json,subprocess,math
from pathlib import Path
from functools import lru_cache
from shapely.geometry import shape,Point
from shapely.prepared import prep
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--boundaries',type=Path,default=ROOT/'data/prefecture-boundaries.json',help='Natural Earth admin1 features for Japan')
args=parser.parse_args()
features=json.loads(args.boundaries.read_text('utf8'))['features']
if args.boundaries.resolve()!=(ROOT/'data/prefecture-boundaries.json').resolve():
    source={'source':'https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_admin_1_states_provinces.zip','license':'public domain',
      'features':[{'type':'Feature','properties':{'iso_3166_2':f['properties']['iso_3166_2']},'geometry':f['geometry']} for f in features]}
    (ROOT/'data/prefecture-boundaries.json').write_text(json.dumps(source,separators=(',',':'))+'\n',encoding='utf8',newline='\n')
polygons=[(int(f['properties']['iso_3166_2'].split('-')[1]),shape(f['geometry'])) for f in features]
assert len(polygons)==47
prepared=[(code,prep(p)) for code,p in polygons]
db=json.loads((ROOT/'data/station-database.json').read_text('utf8'))
cells={}
for row in db['stations'].values():
    if row[5]:continue
    cells.setdefault((round(row[2]*1000),round(row[3]*1000)),[]).append(row)
@lru_cache(maxsize=None)
def prefecture(lon,lat):
    # Small offshore islands omitted from the coarse admin polygons.
    for west,south,east,north,code in [(131.10,34.72,131.19,34.84,35),(129.18,29.13,129.34,29.25,46),
      (130.24,30.75,130.46,30.86,46),(133.24,34.16,133.35,34.22,38),(141.28,44.39,141.46,44.47,1)]:
        if west<=lon<=east and south<=lat<=north:return code
    x,y=round(lon*1000),round(lat*1000)
    nearby=[s for dx in [-1,0,1] for dy in [-1,0,1] for s in cells.get((x+dx,y+dy),[])]
    if nearby:
        station=min(nearby,key=lambda s:(s[2]-lon)**2+(s[3]-lat)**2)
        if math.hypot(station[2]-lon,station[3]-lat)<.001:return station[4]
    point=Point(lon,lat)
    for code,p in prepared:
        if p.covers(point):return code
    distance,code=min((p.distance(point),code) for code,p in polygons)
    return code if distance<.1 else None
raw=subprocess.check_output(['node',str(ROOT/'tools/route-prefecture-input.cjs')],cwd=ROOT.parent)
points=json.loads(raw)
routes={key:sorted({code for lon,lat in coords if (code:=prefecture(lon,lat)) is not None}) for key,coords in points.items()}
names='北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split()
kana='ほっかいどう あおもりけん いわてけん みやぎけん あきたけん やまがたけん ふくしまけん いばらきけん とちぎけん ぐんまけん さいたまけん ちばけん とうきょうと かながわけん にいがたけん とやまけん いしかわけん ふくいけん やまなしけん ながのけん ぎふけん しずおかけん あいちけん みえけん しがけん きょうとふ おおさかふ ひょうごけん ならけん わかやまけん とっとりけん しまねけん おかやまけん ひろしまけん やまぐちけん とくしまけん かがわけん えひめけん こうちけん ふくおかけん さがけん ながさきけん くまもとけん おおいたけん みやざきけん かごしまけん おきなわけん'.split()
regions=[(1,1,'hokkaido'),(2,7,'tohoku'),(8,14,'kanto'),(15,23,'chubu'),(24,30,'kinki'),(31,35,'chugoku'),(36,39,'shikoku'),(40,46,'kyushu'),(47,47,'okinawa')]
labels=[[i+1,name,kana[i],next(region for start,end,region in regions if start<=i+1<=end)] for i,name in enumerate(names)]
payload={'prefectures':labels,'routes':routes}
js='// Stop prefectures: station_database; Natural Earth admin1 (public domain). See data/README.md.\nwindow.TRAIN_GO_PREFECTURES = '+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n'
(ROOT/'prefecture-data.js').write_text(js,encoding='utf8',newline='\n')
print('routes',len(routes),'unclassified',sum(not p for p in routes.values()),'bytes',len(js.encode('utf8')))
print('Sobu',routes.get('sobu'),'UenoTokyo',routes.get('uenoTokyo'),'airHachijo',routes.get('airHachijo'))
