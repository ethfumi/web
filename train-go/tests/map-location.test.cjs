const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const s=vm.createContext({window:{}});vm.runInContext(read('map-location.js'),s);
const location=s.window.TRAIN_GO_MAP_LOCATION;

test('location is requested once on demand, with no watcher and a bounded timeout',()=>{
  let calls=0,result,options;
  const geo={getCurrentPosition(found,failed,opts){calls++;options=opts;found({coords:{latitude:35.68,longitude:139.76,accuracy:25}});}};
  assert.equal(calls,0);
  location.request(geo,p=>result=p,()=>assert.fail());
  assert.equal(calls,1);assert.equal(result.lat,35.68);assert.equal(result.lon,139.76);assert.equal(result.accuracy,25);
  assert.equal(options.timeout,10000);assert.equal(options.maximumAge,0);
});
test('denied, unavailable, timeout, unsupported and invalid locations have readable errors',()=>{
  for(const code of [1,2,3]){
    let error='';location.request({getCurrentPosition:(_,fail)=>fail({code})},()=>assert.fail(),m=>error=m);
    assert.ok(error.length>5);
  }
  let errors=0;
  location.request(null,()=>assert.fail(),()=>errors++);
  location.request({getCurrentPosition:found=>found({coords:{latitude:NaN,longitude:139}})},()=>assert.fail(),()=>errors++);
  location.request({getCurrentPosition(){throw new Error();}},()=>assert.fail(),()=>errors++);
  assert.equal(errors,3);
});
test('a location result moves the manual camera and stale or hidden-view results do not move it',()=>{
  const app=read('app.js');
  const code=app.slice(app.indexOf("  const btnMapLocation=document"),app.indexOf('  onboardPanel.addEventListener',app.indexOf("  const btnMapLocation=document")));
  for(const cancel of ['none','home','scenery']){
    let click,success;
    const button={disabled:false,addEventListener:(_,fn)=>click=fn};
    const status={classList:{remove(){},add(){}},textContent:''};
    const ctx=vm.createContext({document:{getElementById:id=>id==='btn-map-location'?button:status},
      navigator:{geolocation:{}},window:{TRAIN_GO_MAP_LOCATION:{request:(_,fn)=>success=fn}},
      activeRoute:{},mapLocationRequest:0,state:'running',mapMode:'follow',mapUserLocation:null,mapMomentum:{stop(){}},
      mapScrollAuto:true,mapZoomAuto:true,mapManualCenterWorldX:NaN,mapManualCenterWorldY:NaN,mapManualScale:NaN,
      mapStaticCache:{},W:1280,H:720,mapWorldX:x=>x*10,mapWorldY:y=>-y*10,clampMapScale:x=>x,updateMapCameraControls(){}});
    vm.runInContext(code,ctx);assert.equal(success,undefined);click();assert.equal(button.disabled,true);
    if(cancel==='home')ctx.mapLocationRequest++;
    if(cancel==='scenery')ctx.mapMode='scenery';
    success({lon:139.76,lat:35.68,accuracy:20});
    if(cancel==='none'){
      assert.equal(ctx.mapManualCenterWorldX,1397.6);assert.equal(ctx.mapManualCenterWorldY,-356.8);
      assert.equal(ctx.mapScrollAuto,false);assert.equal(ctx.mapZoomAuto,false);assert.equal(ctx.mapStaticCache,null);
    }else assert.equal(ctx.mapUserLocation,null);
  }
});
test('roadside station labels retain source coordinates and readable names',()=>{
  vm.runInContext(read('rest-stop-data.js'),s);
  const data=JSON.parse(read('data/rest-stops.json')).entries;
  assert.equal(s.window.TRAIN_GO_REST_STOPS.length,data.length);assert.ok(data.length>=900);
  for(const p of data){assert.ok(p.name&&p.kana);assert.ok(p.lon>=123&&p.lon<=146&&p.lat>=24&&p.lat<=46);assert.match(p.source,/openstreetmap\.org/);}
});
