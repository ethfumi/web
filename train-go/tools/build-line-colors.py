"""Use one line color for every course and map sharing a source railway line."""
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
lines=json.loads((ROOT/'data/station-database.json').read_text('utf8'))['lines']
colors={str(line['code']):line['color'].lower() for line in lines if re.fullmatch(r'#[0-9a-fA-F]{6}',line.get('color',''))}
colors.update(json.loads((ROOT/'data/line-color-overrides.json').read_text('utf8'))['colors'])
script='''// Railway line colors: station_database and operator references. See data/README.md.
(() => {
  const colors = COLORS;
  const data=window.TRAIN_GO_ROUTE_DATA, maps=window.TRAIN_GO_MAP_DATA.maps;
  for(const [key,entry] of Object.entries(data.routeCatalog)) {
    const color=colors[entry.sourceCode];
    if(!color || !maps[key] || ['air','sea'].includes(maps[key].kind))continue;
    maps[key].color=color;
    if(data.maps[key])data.maps[key].color=color;
  }
  for(const item of data.metadata) {
    const color=colors[data.routeCatalog[item.key]?.sourceCode];
    if(color)item.color=color;
  }
})();
'''.replace('COLORS',json.dumps(colors,separators=(',',':')))
(ROOT/'line-colors.js').write_text(script,encoding='utf8',newline='\n')
print(f'{len(colors)} source line colors')
