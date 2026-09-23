const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const s=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(path.join(__dirname,'../road-layout.js'),'utf8'),s);
const {layout}=s.window.TRAIN_GO_ROAD_LAYOUT;
test('cars stay behind a fixed leader in two staggered lanes and zoom only at the rear edge',()=>{
  for(const [w,h] of [[1280,720],[768,1024],[390,844]])for(const count of [1,2,3,4,6,16,40,100]){
    const p=layout(count,w,h);assert.equal(p.lanes,2);
    assert.equal(p.offset(0),0);assert.ok(p.offset(1)>0&&p.offset(1)<p.carWidth);
    assert.ok(p.extent*p.scale<=w*.59+.001);
    if(p.extent<=w*.59)assert.equal(p.scale,1);
  }
  assert.equal(layout(4,1280,720).scale,1);
  assert.equal(layout(1,1280,720).spacing,layout(40,1280,720).spacing);
  assert.ok(layout(40,1280,720).scale<1);
});
