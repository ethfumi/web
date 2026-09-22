const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),s=vm.createContext({window:{}});
for(const f of JSON.parse(fs.readFileSync(path.join(root,'runtime-sources.json'))).filter(f=>f!=='app.js'))vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),s);
const d=s.window.TRAIN_GO_ROUTE_DATA,r=s.window.TRAIN_GO_TRIP_OPTIONS.createNameResolver(d);

test('all route and station displays in kana mode are free of unconverted kanji',()=>{
  for(const [key,route] of Object.entries(d.routes)){
    assert.doesNotMatch(r.route(key,'kana'),/[一-龯々]/,key);
    for(const name of [route.start,...route.stations.map(s=>s.name)])assert.doesNotMatch(r.station(name,key,'kana'),/[一-龯々ァ-ヶ]/,`${key}:${name}`);
  }
});
test('legacy station spellings and ambiguous readings resolve in their own route context',()=>{
  assert.equal(r.station('こうづ','uenoTokyo','kanji'),'国府津');
  assert.equal(r.station('こが','shonanShinjuku','kanji'),'古河');
  assert.equal(r.station('けいおうたまセンター','keioSagamihara','kanji'),'京王多摩センター');
  assert.equal(r.station('あびこ','jobanLocal','kanji'),'我孫子');
  assert.equal(r.station('あびこ','railLine99618','kanji'),'あびこ','official kana station name stays kana');
  assert.equal(r.station('すいどうばし付近','chuo','kana'),'すいどうばしふきん');
  assert.equal(r.station('ホノルルくうこう','airHonolulu','kanji'),'ホノルル空港');
  assert.equal(r.station('かこころざし々みなと','ferryw827596334_13634557','kana'),'かししみなと');
});
test('every built-in geographic label and train model can switch scripts',()=>{
  for(const group of Object.values(s.window.TRAIN_GO_MAP_DATA.geography)){
    for(const item of group){if(!item.name)continue;
      assert.notEqual(r.place(item.name,'kanji'),item.name,item.name);
      assert.doesNotMatch(r.place(item.name,'kana'),/[一-龯々ァ-ヶ]/);
    }
  }
  assert.equal(r.place('とうきょうタワー','kanji'),'東京タワー');
  assert.equal(r.model('E5系','kana'),'E5けい');assert.equal(r.model('923形','kana'),'923がた');
  assert.equal(r.model('E5系','kanji'),'E5系');
});
