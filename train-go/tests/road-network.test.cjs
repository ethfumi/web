const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const s=vm.createContext({window:{}});
for(const file of JSON.parse(read('runtime-sources.json')).filter(f=>f!=='app.js'))vm.runInContext(read(file),s);
const data=s.window.TRAIN_GO_ROUTE_DATA,maps=s.window.TRAIN_GO_MAP_DATA.maps;
const source=JSON.parse(read('data/road-network.json'));

test('national roads, Tokyo arterials and road vehicles are selectable offline',()=>{
  assert.equal(source.roads.filter(r=>r[1]==='national').length,459);
  for(const name of ['環七通り','環八通り','山手通り','明治通り','青梅街道'])assert.ok(source.roads.some(r=>r[2].includes(name)),name);
  assert.equal(data.roadNetwork.vehicleKeys.length,15);
  for(const key of ['carFireEngine','carPolice','carExcavator','carDumpTruck','carAmbulance','carGarbageTruck','carMixerTruck','carCraneTruck']) {
    assert.ok(data.roadNetwork.vehicleKeys.includes(key),key);
    assert.equal(data.trains[key].kind,'car');
    assert.equal(data.trains[key].workVehicle,true);
    assert.doesNotMatch(data.trains[key].name,/[一-龯々ァ-ヶ]/);
    assert.ok(s.window.TRAIN_GO_CATALOG.matches(`${data.trains[key].title} ${data.trains[key].name}`,data.trains[key].title));
  }
  for(const key of data.roadNetwork.keys){
    const route=data.routes[key],map=maps[key];
    assert.equal(route.kind,'road');assert.equal(map.kind,'road');
    assert.ok(route.stations[0].km>0,key);assert.equal(route.allowCrossings,false);
    assert.equal(map.points[0].name,route.start);
    assert.equal(map.points.at(-1).name,route.stations[0].name);
    for(let i=0;i<map.points.length;i++){
      const p=map.points[i];assert.ok(Number.isFinite(p.lon)&&Number.isFinite(p.lat),key);
      assert.ok(p.lon>122&&p.lon<146&&p.lat>24&&p.lat<46,key);
      if(i)assert.ok(p.km>map.points[i-1].km,key);
    }
    assert.equal(s.window.TRAIN_GO_FARE.fareYen(key,route.stations[0].km,route),0,'roads must not use rail fares');
    assert.ok(s.window.TRAIN_GO_PREFECTURES.routes[key]?.length,key);
  }
});

test('cars cannot be coupled to trains, including restored preferences',()=>{
  const catalogue=s.window.TRAIN_GO_CATALOG,options=s.window.TRAIN_GO_TRIP_OPTIONS;
  assert.deepEqual(Array.from(catalogue.couplingKeys('nozomi',data.roadNetwork.vehicleKeys,[],data.trains)),['nozomi']);
  assert.equal(catalogue.couplingKeys('carCompact',[],['nozomi'],data.trains).length,0);
  const prefs=options.createPreferences({getItem:()=>JSON.stringify({coupling:['carBus','nozomi','carTruck']}),setItem:()=>{}},data.routes,data.trains);
  assert.deepEqual(Array.from(prefs.state.coupling),['nozomi']);
  const names=options.createNameResolver(data);
  for(const key of data.roadNetwork.keys){
    assert.ok(!/[一-龯]/.test(names.route(key,'kana')),key);
    assert.ok(names.route(key,'kanji').length>0,key);
  }
});

test('dense road geometry interpolates forward and reverse positions without a linear scan',()=>{
  const app=read('app.js'),start=app.indexOf('  function yamanoteMapPositionAt('),end=app.indexOf('  function yamanoteMapPosition()',start);
  const scope=vm.createContext({});vm.runInContext(app.slice(start,end),scope);
  let reads=0;
  const points=Array.from({length:8193},(_,i)=>({get km(){reads++;return i/100;},lon:i/10000,lat:i/20000,worldX:i,worldY:i/2,segmentAngle:.5}));
  for(const km of [0,.005,40.961,81.92,40.96,0]){
    reads=0;const p=scope.yamanoteMapPositionAt(km,{}, {points});
    assert.ok(Math.abs(p.worldX-km*100)<1e-7);
    assert.ok(reads<25,`vertex reads: ${reads}`);
  }
});
