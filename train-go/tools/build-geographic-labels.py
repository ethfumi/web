"""Combine GSI island labels with the official mountain summit names and elevations."""
import json
from pathlib import Path
import pykakasi
ROOT=Path(__file__).resolve().parents[1]
converter=pykakasi.kakasi()
readings={'青ヶ島':'あおがしま','八丈島':'はちじょうじま','利尻島':'りしりとう','礼文島':'れぶんとう',
          '択捉島':'えとろふとう','国後島':'くなしりとう','色丹島':'しこたんとう','歯舞群島':'はぼまいぐんとう',
          '神津島':'こうづしま','御蔵島':'みくらじま','新島':'にいじま','式根島':'しきねじま',
          '与那国島':'よなぐにじま','西表島':'いりおもてじま','沖永良部島':'おきのえらぶじま',
          '父島':'ちちじま','母島':'ははじま','口永良部島':'くちのえらぶじま'}
labels=[]
for name,lon,lat,kind in json.loads((ROOT/'data/geographic-labels.json').read_text('utf8')):
    if kind!='island':continue
    kana=readings.get(name) or ''.join(t['hira'] for t in converter.convert(name))
    if any(l[0]==name and abs(l[2]-lon)<.1 and abs(l[3]-lat)<.1 for l in labels):continue
    labels.append([name,kana,lon,lat,'island',None])
for name,kana,lon,lat,elevation in json.loads((ROOT/'data/mountains.json').read_text('utf8'))['points']:
    labels.append([name,kana,lon,lat,'mountain',elevation])
labels.sort(key=lambda p:(p[4]!='island',-(p[5] or 0)))
(ROOT/'geographic-label-data.js').write_text('// GSI geographic names and mountain summit elevations. See data/README.md.\nwindow.TRAIN_GO_GEOGRAPHIC_LABELS = '+json.dumps(labels,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8',newline='\n')
print('labels',len(labels),'islands',sum(p[4]=='island' for p in labels))
