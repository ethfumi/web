const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const scope=vm.createContext({window:{}});
for (const file of JSON.parse(read('runtime-sources.json')).filter(f=>f!=='app.js')) vm.runInContext(read(file),scope);
const data=scope.window.TRAIN_GO_ROUTE_DATA;

test('all 272 domestic passenger pairs have one playable route, including five helicopter pairs',()=>{
  const source=JSON.parse(read('data/air-network.json'));
  assert.equal(source.airports.length,87);
  assert.equal(data.airNetwork.keys.length,272);
  assert.equal(new Set(data.airNetwork.keys).size,272);
  assert.equal(Object.values(data.routes).filter(r=>r.kind==='air').length,274);
  for (const key of data.airNetwork.keys) {
    const route=data.routes[key], map=data.maps[key];
    assert.equal(route.kind,'air');
    assert.ok(route.stations[0].km>0);
    assert.ok(data.routeCatalog[key].search);
    assert.ok(data.stationLabelsByRoute[key][route.start]);
    assert.equal(map.points[0].name,route.start);
    assert.equal(map.points.at(-1).name,route.stations[0].name);
  }
  assert.equal(data.metadata.filter(m=>m.trainKey==='helicopter').length,5);
  for (const island of ['青ヶ島','御蔵島','利島','与那国','北大東島','南大東島']) {
    assert.ok(data.airNetwork.keys.some(k=>data.routeCatalog[k].search.includes(island)),island);
  }
});

test('new ships use sea estimates and retain established fixed fares',()=>{
  const fare=scope.window.TRAIN_GO_FARE;
  assert.equal(fare.fareClassFor('newFerry',{kind:'sea'}),'sea');
  assert.equal(fare.fareYen('ferryMiyajima',2,{kind:'sea'}),200);
  let previous=0;
  for (const km of [0.1,3,10,30,100,500,1000,2000]) {
    const current=fare.fareYen('newFerry',km,{kind:'sea'});
    assert.ok(Number.isInteger(current) && current>=previous);
    previous=current;
  }
});

test('ferry courses have named endpoints, ordered geometry and auditable source ways',()=>{
  const source=JSON.parse(read('data/ferry-source.json'));
  const coverage=JSON.parse(read('data/ferry-coverage.json'));
  const network=JSON.parse(read('data/ferry-network.json'));
  assert.equal(coverage.courses,network.routes.length);
  assert.equal(new Set(data.ferryNetwork.keys).size,data.ferryNetwork.keys.length);
  for (const item of coverage.provenance) {
    assert.ok(item.ways.length>0);
    for (const id of item.ways) assert.ok(source.ways[id],id);
  }
  for (const key of data.ferryNetwork.keys) {
    const route=data.routes[key],map=data.maps[key];
    assert.equal(route.kind,'sea');
    assert.ok(route.start && route.stations[0].name);
    assert.notEqual(route.start,route.stations[0].name,key);
    assert.equal(map.points[0].name,route.start,key);
    assert.equal(map.points.at(-1).name,route.stations[0].name,key);
    assert.equal(map.points[0].km,0,key);
    let previous=-1;
    for (const p of map.points) {
      assert.ok(Number.isFinite(p.lon)&&Number.isFinite(p.lat)&&p.km>=previous,key);
      previous=p.km;
    }
    assert.ok(Math.abs(previous-route.stations[0].km)<1e-6,key);
  }
  const text=data.ferryNetwork.keys.map(k=>data.routeCatalog[k].search).join(' ');
  for (const island of ['母島','青ヶ島','北大東','天売','焼尻','口之島','悪石','与論','与那国','礼文','大神島']) assert.ok(text.includes(island),island);
  const references=Object.entries(data.maps).filter(([,m])=>m.reference);
  assert.equal(references.length,coverage.referenceSegments);
  for (const [key] of references) {
    assert.equal(data.routes[key],undefined,'unnamed reference geometry must not invent a playable port');
    assert.ok(scope.window.TRAIN_GO_MAP_DATA.drawOrder.includes(key),'reference geometry must be drawn');
  }
});
