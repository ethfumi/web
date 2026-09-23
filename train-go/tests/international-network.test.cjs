const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),s=vm.createContext({window:{}});
for(const file of JSON.parse(fs.readFileSync(path.join(root,'runtime-sources.json'),'utf8')).filter(f=>f!=='app.js'))vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),s);
const data=s.window.TRAIN_GO_ROUTE_DATA;
test('neighboring countries and cities have both scripts and lie inside the regional map',()=>{
  const labels=s.window.TRAIN_GO_NEIGHBOR_LABELS;
  for(const title of ['台湾','韓国','中国','ロシア','北朝鮮','日本','台北','釜山','上海'])assert.ok(labels.some(p=>p[0]===title),title);
  for(const [name,kana,lon,lat] of labels){assert.ok(name&&kana);assert.doesNotMatch(kana,/[一-龯々ァ-ヶ]/);assert.ok(lon>=118&&lon<=151&&lat>=20&&lat<=55);}
});
test('selected international routes retain intermediate ports, reversible geometry and Japanese prefectures',()=>{
  assert.equal(data.internationalNetwork.keys.length,15);
  for(const key of data.internationalNetwork.keys){
    const route=data.routes[key],points=data.maps[key].points;
    assert.equal(route.international,true);assert.equal(data.routeCatalog[key].international,true);
    assert.ok(s.window.TRAIN_GO_PREFECTURES.routes[key]?.length,key);
    for(let i=1;i<points.length;i++)assert.ok(points[i].km>points[i-1].km,key);
    const reverse=s.window.TRAIN_GO_TRIP_OPTIONS.initialState(route,true);
    assert.equal(reverse.currentStationName,points.at(-1).name);
  }
  assert.ok(data.routes.internationalSeaSakaiminatoVladivostok.stations.some(p=>p.name==='とんへこう'));
  assert.equal(data.internationalNetwork.keys.filter(k=>data.routes[k].kind==='air').length,11);
});
test('suspended and announced-suspension ferries are reference lines, not passenger courses',()=>{
  for(const key of ['internationalReferenceIshigakiKeelung','internationalReferenceOsakaShanghai']){
    assert.equal(data.routes[key],undefined);assert.equal(data.maps[key].reference,true);assert.ok(data.maps[key].referenceLabel);
  }
});
