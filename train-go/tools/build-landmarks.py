"""Compile the small, source-linked landmark selection for offline map display."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
entries=json.loads((ROOT/'data/landmarks.json').read_text('utf8'))['entries']
legacy=[
    dict(name='皇居',kana='こうきょ',icon='🏯',lon=139.7528,lat=35.6852),
    dict(name='上野公園',kana='うえのこうえん',icon='🌳',lon=139.7730,lat=35.7167),
    dict(name='明治神宮',kana='めいじじんぐう',icon='⛩️',lon=139.6993,lat=35.6764),
    dict(name='東京タワー',kana='とうきょうたわー',icon='🗼',lon=139.7454,lat=35.6586),
    dict(name='東京湾',kana='とうきょうわん',icon='',lon=139.86,lat=35.50),
]
fields=['name','kana','icon','lon','lat']
points=[{k:p[k] for k in fields} for p in legacy+entries]
(ROOT/'landmark-data.js').write_text('// Selected landmarks: OpenStreetMap contributors / ODbL. See data/landmarks.json.\nwindow.TRAIN_GO_LANDMARKS = '+json.dumps(points,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8',newline='\n')
print(f'{len(points)} labels ({sum(bool(p["icon"]) for p in points)} landmarks)')
