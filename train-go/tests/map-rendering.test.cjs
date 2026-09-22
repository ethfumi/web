const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const context=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(path.join(root,'map-water-data.js'),'utf8'),context);
const water=context.window.TRAIN_GO_WATER_DATA;
function decode(ring){
  let lon=0,lat=0; const points=[];
  for(let i=0;i<ring.length;i+=2){lon+=ring[i];lat+=ring[i+1];points.push([lon/water.precision,lat/water.precision]);}
  return points;
}
function inside(lon,lat,ring){
  const points=decode(ring); let yes=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[i],b=points[j];
    if((a[1]>lat)!==(b[1]>lat)&&lon<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0])yes=!yes;
  }
  return yes;
}
function isWater(lon,lat){
  const tile=water.tiles.filter(t=>lon>=t.bounds[0]&&lon<=t.bounds[2]&&lat>=t.bounds[1]&&lat<=t.bounds[3]).sort((a,b)=>b.z-a.z)[0];
  assert.ok(tile,`uncovered location ${lon},${lat}`);
  return tile.water.some(rings=>rings.reduce((value,ring)=>value!==inside(lon,lat,ring),false));
}
test('Tokyo Bay and Hokkaido lakes are water, station locations are land',()=>{
  assert.equal(isWater(139.93,35.50),true,'Tokyo Bay');
  assert.equal(isWater(140.0412,35.6484),false,'Kaihin Makuhari station');
  assert.equal(isWater(140.1135,35.6129),false,'Chiba station');
  assert.equal(isWater(141.35,42.77),true,'Lake Shikotsu');
  assert.equal(isWater(142.358,43.763),false,'Asahikawa station');
});
test('spatial label index exactly preserves collision decisions and avoids global scans',()=>{
  const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  const code=app.slice(app.indexOf('  const mapLabelBoxes ='),app.indexOf('  function mapSegmentIsVisible('));
  const scope=vm.createContext({});
  vm.runInContext(code+'\nglobalThis.stats=()=>({count:mapLabelBoxCount,checks:mapLabelComparisonCount});',scope);
  const boxes=[];let seed=41,oldChecks=0;
  const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2**32;};
  scope.resetMapLabelBoxes();
  for(let i=0;i<4000;i++){
    const x=rand()*1800-100,y=rand()*1100-100,w=20+rand()*110,h=10+rand()*16;
    const b={left:x-w/2,right:x+w/2,top:y-h,bottom:y};
    const overlaps=boxes.some(a=>{oldChecks++;return b.left<a.right&&b.right>a.left&&b.top<a.bottom&&b.bottom>a.top;});
    assert.equal(scope.claimMapLabelBox(x,y,w,h),!overlaps);
    if(!overlaps)boxes.push(b);
  }
  assert.equal(scope.stats().count,boxes.length);
  assert.ok(scope.stats().checks<oldChecks/10);
  scope.resetMapLabelBoxes();
  assert.equal(scope.claimMapLabelBox(10,10,10,10),true,'reset must remove stale collisions');
});
