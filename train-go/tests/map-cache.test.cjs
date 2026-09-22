const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const scope=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../map-cache.js'),'utf8'),scope);
const {placement}=scope.window.TRAIN_GO_MAP_CACHE;
const width=1280,height=720;
const cache={centerX:1000,centerY:2000,scale:1,padding:180};
const base={centerWorldX:1000,centerWorldY:2000,scale:1,screenCenterX:700,screenCenterY:350};

test('map cache reuses small pans and zooms and keeps geographic coordinates aligned',()=>{
  let reused=0;
  for(let frame=0;frame<120;frame++){
    const scene={...base,centerWorldX:1000+frame*.4,centerWorldY:2000-frame*.1,scale:1+frame*.0005};
    const p=placement(cache,scene,width,height);
    assert.ok(p);reused++;
    for(const [worldX,worldY] of [[900,1800],[1500,2200]]){
      const oldX=base.screenCenterX+(worldX-cache.centerX)*cache.scale+cache.padding;
      const oldY=base.screenCenterY+(worldY-cache.centerY)*cache.scale+cache.padding;
      assert.ok(Math.abs(oldX*p.ratio+p.x-(scene.screenCenterX+(worldX-scene.centerWorldX)*scene.scale))<1e-9);
      assert.ok(Math.abs(oldY*p.ratio+p.y-(scene.screenCenterY+(worldY-scene.centerWorldY)*scene.scale))<1e-9);
    }
  }
  assert.equal(reused,120,'continuous small scale changes must not force 120 redraws');
});

test('cache rebuilds before exposing an empty edge or excessively scaling labels',()=>{
  assert.equal(placement(null,base,width,height),null);
  for(const changes of [{centerWorldX:1300},{centerWorldY:2300},{scale:.7},{scale:1.3}]){
    assert.equal(placement(cache,{...base,...changes},width,height),null);
  }
});

test('regional backdrop includes neighboring land across former tile cutoffs, preserving open sea',()=>{
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../regional-land-data.js'),'utf8'),scope);
  const data=scope.window.TRAIN_GO_REGIONAL_LAND;
  function inside(lon,lat,values){
    let x=0,y=0,points=[];
    for(let i=0;i<values.length;i+=2){x+=values[i];y+=values[i+1];points.push([x/data.precision,y/data.precision]);}
    let yes=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const a=points[i],b=points[j];
      if((a[1]>lat)!==(b[1]>lat)&&lon<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0])yes=!yes;
    }
    return yes;
  }
  const land=(lon,lat)=>data.polygons.some(p=>p.rings.reduce((a,r)=>a!==inside(lon,lat,r),false));
  for(const [lon,lat,name] of [[129.05,35.18,'Busan'],[128.5,36,'Korea north of the old fragment'],[121,24,'Taiwan'],[120,30,'China'],[135,47,'Russia'],[142.7,50,'Sakhalin']])assert.equal(land(lon,lat),true,name);
  for(const [lon,lat] of [[130,36],[137,38],[140,31]])assert.equal(land(lon,lat),false,`open sea ${lon},${lat}`);
});
