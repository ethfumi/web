const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const scope=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../vehicle-effects.js'),'utf8'),scope);
const effects=scope.window.TRAIN_GO_VEHICLE_EFFECTS;
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
