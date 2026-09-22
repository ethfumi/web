const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const scope=vm.createContext({window:{}});
for(const file of JSON.parse(read('runtime-sources.json')).filter(f=>f!=='app.js')) vm.runInContext(read(file),scope);
const data=scope.window.TRAIN_GO_ROUTE_DATA, options=scope.window.TRAIN_GO_TRIP_OPTIONS;
const app=read('app.js');
function functionSource(name,next){return app.slice(app.indexOf(`  function ${name}(`),app.indexOf(`  function ${next}(`));}

test('recent choices are unique, limited to ten, restored and tolerant of failed storage',()=>{
  let value=null;const storage={getItem:()=>value,setItem:(_,s)=>{value=s;}};
  const prefs=options.createPreferences(storage,data.routes,data.trains);
  assert.equal(prefs.state.nameMode,'kana');
  const routes=Object.keys(data.routes).slice(0,12), trains=Object.keys(data.trains).slice(0,12);
  for(const key of routes)prefs.remember('routes',key);
  for(const key of trains)prefs.remember('trains',key);
  prefs.remember('routes',routes[7]);
  assert.equal(prefs.state.routes.length,10);
  assert.equal(prefs.state.trains.length,10);
  assert.equal(prefs.state.routes[0],routes[7]);
  assert.equal(new Set(prefs.state.routes).size,10);
  prefs.state.nameMode='kanji';prefs.state.reverse[routes[7]]=true;prefs.save();
  const restored=options.createPreferences(storage,data.routes,data.trains);
  assert.equal(restored.state.nameMode,'kanji');
  assert.equal(restored.state.reverse[routes[7]],true);
  value='{broken';assert.equal(options.createPreferences(storage,data.routes,data.trains).state.nameMode,'kana');
  const failing={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}};
  assert.doesNotThrow(()=>options.createPreferences(failing,data.routes,data.trains).remember('routes','sobu'));
});

test('all non-loop courses can start in reverse, reach both ends twice, and keep positive station distances',()=>{
  const scheduler=functionSource('scheduleNextStation','isKomachiCouplingStop');
  for(const [key,route] of Object.entries(data.routes)){
    const initial=options.initialState(route,true);
    if(route.loopKm){assert.equal(initial.routeDirection,1);continue;}
    const s=vm.createContext({activeRoute:route,...initial,distance:0,stationWorldX:0,nextStationName:'',canvas:{dataset:{}},PIXELS_PER_METER:12,isKomachiCouplingStop:()=>false});
    vm.runInContext(scheduler,s);
    const terminal=route.stations[route.terminalIndex??route.stations.length-2].name;
    assert.equal(initial.currentStationName,terminal,key);
    for(let i=0;i<(route.stations.length-1)*4;i++){
      s.scheduleNextStation();
      assert.ok(s.stationWorldX>s.distance,`${key}: invalid next distance`);
      s.distance=s.stationWorldX;
    }
    assert.equal(s.nextStationName,terminal,key);
  }
});

test('returning on a two-stop course keeps the map at the terminal before departure',()=>{
  const route=data.routes.kuramaCable;
  const initial=options.initialState(route,true);
  const s=vm.createContext({activeRoute:route,...initial,distance:0,stationWorldX:0,nextStationName:'',canvas:{dataset:{}},PIXELS_PER_METER:12,isKomachiCouplingStop:()=>false});
  vm.runInContext(functionSource('scheduleNextStation','isKomachiCouplingStop'),s);
  const start=app.indexOf('  function yamanoteMapKm()');
  vm.runInContext(app.slice(start,app.indexOf('  const YAMANOTE_CAR_LENGTH_METERS',start)),s);
  s.scheduleNextStation();
  assert.equal(s.stationIdx,-1);
  assert.equal(s.yamanoteMapKm(),route.stations[0].km);
});

test('Keio destination is deterministic and through courses appear on their member lines',()=>{
  const keys=Array.from(options.courseChoices(data,'keio'));
  assert.ok(keys.includes('keio')&&keys.includes('keioSagamihara'));
  const s=vm.createContext({selectedRouteKey:'keio',ROUTES:data.routes,URLSearchParams,location:{search:''},Math:{random:()=>{throw Error('random destination');}}});
  vm.runInContext(functionSource('routeForGameStart','stationNamesForRoute'),s);
  assert.equal(s.routeForGameStart(),data.routes.keio);
  assert.equal(data.throughRoutes.length,9);
  assert.ok(options.courseChoices(data,'uenoTokyo').includes('throughNumazuUtsunomiya'));
  assert.ok(options.courseChoices(data,'tobuSkytree').includes('throughChuorinkanMinamikurihashi'));
  assert.ok(data.maps.throughNumazuUtsunomiya.endKm>200);
  for(const course of data.throughRoutes){
    const points=data.maps[course.key].points;
    for(let i=1;i<points.length;i++)assert.notEqual(points[i].name,points[i-1].name,course.key);
  }
});

test('kanji presentation leaves station identity and spoken departure names unchanged',()=>{
  const names=options.createNameResolver(data);
  assert.equal(names.station('ちば','sobu','kanji'),'千葉');
  assert.equal(names.station('ちば','sobu','kana'),'ちば');
  assert.match(names.route('keio','kanji'),/京王/);
  let banner='',speech='';
  const s=vm.createContext({window:scope.window,activeRoute:data.routes.sobu,currentStationName:'ちば',nextStationName:'にしちば',passingStation:false,deadheadMode:false,
    isAirRoute:()=>false,isSeaRoute:()=>false,routeTerminalStation:()=>({name:'みたか'}),
    stationLabel:name=>names.station(name,'sobu','kanji'),showPlayBanner:text=>{banner=text;},say:text=>{speech=text;}});
  vm.runInContext(functionSource('nextAnnouncementOptions','isAirRoute')+functionSource('announceInitialDeparture','startGame'),s);s.announceInitialDeparture();
  assert.match(banner,/千葉.*三鷹/);
  assert.match(speech,/みたか行き/);assert.match(speech,/次は、にしちば、にしちばです/);
  assert.equal(data.routes.sobu.start,'みたか');
});
