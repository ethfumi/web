const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const scope=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../vehicle-effects.js'),'utf8'),scope);
const effects=scope.window.TRAIN_GO_VEHICLE_EFFECTS;
test('fire bell strikes three times then rests, and stops all tones when muted',()=>{
  const events=[],tones=[];
  const gain={gain:{value:0,cancelScheduledValues:t=>events.push(['cancel',t]),setValueAtTime:(v,t)=>events.push(['value',v,t]),linearRampToValueAtTime:(v,t)=>events.push(['strike',v,t]),exponentialRampToValueAtTime:()=>{},setTargetAtTime:()=>{}},connect:()=>{},disconnect:()=>events.push(['disconnect'])};
  const audio={createGain:()=>gain,createOscillator:()=>{const o={frequency:{value:0},connect:()=>{},start:()=>{},stop:t=>{events.push(['stop',t]);o.onended();},disconnect:()=>{}};tones.push(o);return o;}};
  const bell=effects.createFireBell(audio,{});
  for(const t of [.01,.02,.41,.81,1.21,1.61,2.01])bell.update(t,true);
  assert.equal(events.filter(e=>e[0]==='strike').length,3);
  bell.update(2.1,false);assert.deepEqual(events.at(-1),['value',0,2.1]);
  bell.stop(2.2);bell.stop(2.3);bell.update(2.41,true);
  assert.equal(events.filter(e=>e[0]==='stop').length,2);
  assert.equal(events.filter(e=>e[0]==='disconnect').length,1);
  assert.equal(events.filter(e=>e[0]==='strike').length,3);
});
test('emergency vehicles have distinct sirens and calls; utility vehicles keep low engine sounds',()=>{
  for(const shape of ['police','ambulance','fireEngine','ladder']){
    const p=effects.profiles[shape];assert.ok(p.calls.length>=2);assert.equal(p.light,'#ff463f');
    assert.ok(effects.sound(shape,.1,30)[0]>400);
    assert.notEqual(effects.sound(shape,.1,30)[0],effects.sound(shape,.7,30)[0]);
  }
  assert.notEqual(effects.sound('police',.4,30)[0],effects.sound('fireEngine',.4,30)[0]);
  for(const shape of ['snowplow','sweeper','tamper'])assert.ok(effects.sound(shape,1,30)[0]<100);
  for(let t=0;t<2;t+=.01)assert.ok(effects.lightAlpha(t)>=.35&&effects.lightAlpha(t)<=1);
});
