const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const s=vm.createContext({window:{}});
for(const file of JSON.parse(read('runtime-sources.json')).filter(f=>f!=='app.js'))vm.runInContext(read(file),s);

test('landmarks cover all regions, have both name modes, and Tokyo Bay has no icon',()=>{
  const source=JSON.parse(read('data/landmarks.json')).entries;
  const regions=new Set(source.map(p=>p.region));
  assert.equal(regions.size,9);assert.equal(source.length,34);
  for(const p of source) {
    assert.match(p.source,/^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/);
    assert.ok(p.lon>123&&p.lon<146&&p.lat>24&&p.lat<46);
    assert.doesNotMatch(p.kana,/[一-龯々ァ-ヶ]/);
  }
  const bay=s.window.TRAIN_GO_LANDMARKS.filter(p=>p.name==='東京湾');
  assert.equal(bay.length,1);assert.equal(bay[0].icon,'');assert.equal(bay[0].kana,'とうきょうわん');
  assert.ok(s.window.TRAIN_GO_LANDMARKS.some(p=>p.name==='大阪城'));
});

test('rail maps use the same source line palette, including branch courses',()=>{
  const db=JSON.parse(read('data/station-database.json'));
  const expected=Object.fromEntries(db.lines.filter(l=>/^#[0-9a-f]{6}$/i.test(l.color||'')).map(l=>[l.code,l.color.toLowerCase()]));
  Object.assign(expected,JSON.parse(read('data/line-color-overrides.json')).colors);
  const maps=s.window.TRAIN_GO_MAP_DATA.maps,data=s.window.TRAIN_GO_ROUTE_DATA;
  for(const [key,entry] of Object.entries(data.routeCatalog)){
    if(expected[entry.sourceCode]&&maps[key])assert.equal(maps[key].color,expected[entry.sourceCode],key);
  }
  assert.equal(maps.yamanote.color,'#9acd32');assert.equal(maps.ginza.color,'#ff9500');
  assert.equal(maps.tozai.color,'#009bbf');assert.equal(maps.hanzomon.color,'#8f76d6');
  assert.equal(maps.mita.color,'#0079c2');
});
