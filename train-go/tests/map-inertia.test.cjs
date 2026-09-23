const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const api=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(path.join(root,'map-inertia.js'),'utf8'),api);
const create=api.window.TRAIN_GO_MAP_INERTIA.create;
function flick(m){m.begin(0);for(let t=16;t<=64;t+=16)m.drag(12,-4,t);m.release(64);}
test('a short flick glides briefly and stops, independently of frame rate',()=>{
  const travel=[];
  for(const fps of [60,120]) {
    const m=create();flick(m);assert.equal(m.active,true);let x=0,y=0,frames=0;
    while(m.active&&frames<fps*2){const step=m.step(1/fps);x+=step.x;y+=step.y;frames++;}
    assert.equal(m.active,false);assert.ok(frames<fps);assert.ok(x>60&&x<160);assert.ok(y<0);travel.push(x);
  }
  assert.ok(Math.abs(travel[0]-travel[1])<1);
});
test('holding still, cancellation and a new gesture leave no stale momentum',()=>{
  const m=create();m.begin(0);m.drag(100,0,16);assert.equal(m.release(200),false);assert.equal(m.step(.02),null);
  flick(m);m.stop();assert.equal(m.step(.02),null);
  flick(m);m.begin(100);assert.equal(m.active,false);assert.equal(m.release(100),false);
  m.begin(300);m.drag(100,0,500);assert.equal(m.release(501),true,'sparse move events still produce a gentle glide');
});
test('real canvas handlers pan, coast, stop on touch without accelerating, and cancel cleanly',()=>{
  const app=fs.readFileSync(path.join(root,'app.js'),'utf8'),handlers={};let taps=0;
  const scope=vm.createContext({mapMode:'follow',mapScrollAuto:false,mapManualCenterWorldX:0,mapManualCenterWorldY:0,
    lastMapScene:{scale:.1},MAP_GESTURE_MOVE_THRESHOLD_PX:6,mapPanGesture:{pointerId:null},mapTouchPoints:new Map(),
    mapPinchGesture:{active:false},mapMomentum:create(),canvas:{addEventListener:(type,fn)=>handlers[type]=fn},
    collectFallingStar:()=>false,handleCanvasTap:()=>taps++,prepareMapPinch(){scope.mapMomentum.stop();},activateMapPinchIfMoved(){},updateMapPinch(){},restartMapPinch(){}});
  vm.runInContext(app.slice(app.indexOf('  function captureCanvasPointer('),app.indexOf('  canvas.addEventListener("wheel"')),scope);
  const emit=(type,x,time,id=1)=>handlers[type]({pointerType:'touch',pointerId:id,clientX:x,clientY:100,timeStamp:time,preventDefault(){}});
  emit('pointerdown',100,0);emit('pointermove',112,16);emit('pointermove',124,32);emit('pointerup',124,33);
  assert.equal(scope.mapManualCenterWorldX,-240);assert.equal(scope.mapMomentum.active,true);assert.equal(taps,0);
  emit('pointerdown',150,40);assert.equal(scope.mapMomentum.active,false);emit('pointerup',150,45);assert.equal(taps,0);
  emit('pointerdown',150,100);emit('pointermove',180,116);emit('pointercancel',180,117);assert.equal(scope.mapMomentum.active,false);
  emit('pointerdown',150,200);emit('pointermove',170,216);emit('pointerdown',200,220,2);
  scope.mapPinchGesture.active=true;emit('pointerup',200,230,2);emit('pointerup',170,235);assert.equal(scope.mapMomentum.active,false);
  assert.equal(taps,0);
});
