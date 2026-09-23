const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const scope=vm.createContext({window:{}});let before,routesBefore;
for(const file of JSON.parse(read('runtime-sources.json')).filter(f=>f!=='app.js')) {
  if(file==='rail-shape-data.js'){
    before=JSON.parse(JSON.stringify(scope.window.TRAIN_GO_MAP_DATA.maps));
    routesBefore=JSON.stringify(scope.window.TRAIN_GO_ROUTE_DATA.routes);
  }
  vm.runInContext(read(file),scope);
}
const maps=scope.window.TRAIN_GO_MAP_DATA.maps;
test('all existing rail courses receive curves without changing station identities, game distances or other modes',()=>{
  const coverage=JSON.parse(read('data/rail-shape-coverage.json'));
  assert.equal(coverage.matched,coverage.total);assert.equal(coverage.total,10635);
  assert.equal(JSON.stringify(scope.window.TRAIN_GO_ROUTE_DATA.routes),routesBefore);
  let count=0;
  for(const [key,map] of Object.entries(maps)) {
    if(['air','sea','road'].includes(map.kind)||map.reference){assert.equal(JSON.stringify(map.points),JSON.stringify(before[key].points),key);continue;}
    count++;assert.equal(map.detailedRailShape,true,key);
    assert.deepEqual(Array.from(map.points.filter(p=>p.name),p=>[p.name,p.km]),before[key].points.map(p=>[p.name,p.km]),key);
    for(let i=0;i<map.points.length;i++){
      const p=map.points[i];assert.ok(Number.isFinite(p.lon)&&Number.isFinite(p.lat)&&Number.isFinite(p.km),key);
      assert.ok(p.name||p.geometryOnly,key);
      if(i)assert.ok(p.km>map.points[i-1].km,key);
    }
    if(map.loopKm){assert.equal(map.points[0].lon,map.points.at(-1).lon);assert.equal(map.points[0].lat,map.points.at(-1).lat);}
  }
  assert.equal(count,655);
});
test('Chuo bends through Yoyogi and Shinanomachi, and the Seto crossing follows the bridge corridor',()=>{
  const near=(key,lon,lat,limit=.001)=>maps[key].points.some(p=>Math.hypot((p.lon-lon)*.8,p.lat-lat)<limit);
  assert.ok(near('chuo',139.702,35.684), 'Yoyogi bend');
  assert.ok(near('chuoMain',139.7207,35.680), 'Shinanomachi bend');
  const seto=Object.keys(maps).find(key=>scope.window.TRAIN_GO_ROUTE_DATA.routeCatalog[key]?.title.includes('本四備讃'));
  assert.ok(near(seto,133.829,34.353),'Seto bridge corridor');
  assert.ok(maps.chuo.points.some(p=>p.geometryOnly));
});
test('shared segment joins stay within the map simplification tolerance',()=>{
  const data=JSON.parse(read('data/rail-shapes.json'));
  const endpoints=data.segments.map(values=>{
    let x=0,y=0;for(let i=0;i<values.length;i+=2){x+=values[i];y+=values[i+1];}
    return [[values[0]/10000,values[1]/10000],[x/10000,y/10000]];
  });
  for(const [key,refs] of Object.entries(data.routes))for(let i=1;i<refs.length;i++){
    assert.ok(refs[i-1]&&refs[i],key);
    const a=endpoints[Math.abs(refs[i-1])-1][refs[i-1]>0?1:0],b=endpoints[Math.abs(refs[i])-1][refs[i]>0?0:1];
    assert.ok(Math.hypot((a[0]-b[0])*90000,(a[1]-b[1])*111320)<35,key);
  }
});

test('curve vertices never turn into extra station circles',()=>{
  const app=read('app.js'),start=app.indexOf('  function drawRelatedRouteStations('),end=app.indexOf('  // 周辺路線の駅名。',start);
  let circles=0;
  const s=vm.createContext({isDebug:false,MAP_INTERCHANGE_STATIONS:new Set(),mapPointIsVisible:()=>true,
    ctx:{save(){},restore(){},beginPath(){},moveTo(){},arc(){circles++;},fill(){},stroke(){}}});
  vm.runInContext(app.slice(start,end),s);
  const points=[{name:'始点',worldX:0,worldY:0},...Array.from({length:1000},(_,i)=>({name:'',geometryOnly:true,worldX:i+1,worldY:0})),{name:'終点',worldX:1002,worldY:0}];
  s.drawRelatedRouteStations({scale:1,centerWorldX:0,centerWorldY:0,screenCenterX:0,screenCenterY:0},[{map:{points,stationPoints:points.filter(p=>p.name),meanStationSpanMeters:1000,color:'#f80'}}],20);
  assert.equal(circles,2);
});
