const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const between=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));

test('follow camera starts with manual zoom and keeps its initial scale while the train moves',()=>{
  const s=vm.createContext({mapMode:'follow',mapScrollAuto:true,mapZoomAuto:true,
    mapManualCenterWorldX:0,mapManualCenterWorldY:0,mapManualScale:0,
    mapPanGesture:{},mapTouchPoints:new Map(),mapPinchGesture:{},lastMapScene:{},updateMapCameraControls(){}});
  vm.runInContext(between('  function resetMapCamera()','  function seedManualMapCamera()')
    +between('  function applyManualMapCamera(','  function mapPointIsVisible('),s);
  s.resetMapCamera();
  assert.equal(s.mapZoomAuto,false);
  assert.equal(s.mapScrollAuto,false);
  const first=s.applyManualMapCamera({scale:.02,centerWorldX:100,centerWorldY:200,screenCenterX:400,screenCenterY:250});
  const moving=s.applyManualMapCamera({scale:.9,centerWorldX:300,centerWorldY:600,screenCenterX:400,screenCenterY:250});
  assert.equal(moving.scale,first.scale);
  assert.equal(moving.centerWorldX,first.centerWorldX);
  s.mapMode='overview';s.resetMapCamera();
  assert.equal(s.mapZoomAuto,true);
});

test('station names that do not fit above or below get another chance without removing existing labels',()=>{
  const drawn=[];
  const s=vm.createContext({W:700,H:300,mapCachePadding:0,
    ctx:{font:'20px sans-serif',fillStyle:'#000',save(){},restore(){},fillText(text,x,y){drawn.push({text,x,y});}}});
  vm.runInContext(between('  const mapLabelBoxes =','  function mapSegmentIsVisible(')
    +between('  const mapDeferredStationLabels =','  const mapTextMetrics ='),s);
  vm.runInContext([
    'resetMapLabelBoxes();',
    "for(let i=0;i<7;i++){const x=230+i*24,y=140,text='駅'+i;",
    'const pos=claimMapLabelBox(x,y-11,120,20)?y-11:claimMapLabelBox(x,y+29,120,20)?y+29:null;',
    'if(pos===null)deferStationLabel(text,x,y,120,20);',
    'else{ctx.fillText(text,x,pos);mapDrawnStationNames.add(text);}}'
  ].join('\n'),s);
  const original=drawn.map(x=>x.text);
  s.drawDeferredStationLabels();
  assert.ok(drawn.length>original.length);
  assert.deepEqual(drawn.slice(0,original.length).map(x=>x.text),original);
  assert.equal(new Set(drawn.map(x=>x.text)).size,drawn.length);
});

test('disabled transport categories never enter the route candidate list',()=>{
  const s=vm.createContext({MAP_ROUTE_DRAW_ORDER:['rail','air','sea','ref'],
    ROUTE_MAPS:{rail:{},air:{kind:'air'},sea:{kind:'sea'},ref:{kind:'sea'}},
    mapLayerVisibility:{rail:true,air:false,sea:false}});
  vm.runInContext(between('  const MAP_ROUTES_BY_KIND =','  for (const items of Object.values(MAP_GEOGRAPHY))'),s);
  assert.deepEqual(Array.from(s.visibleMapRouteKeys()),['rail']);
  s.mapLayerVisibility.sea=true;
  assert.deepEqual(Array.from(s.visibleMapRouteKeys()),['rail','sea','ref']);
});

test('unmapped ocean and holes cut for detail tiles are not painted as land',()=>{
  class Path {constructor(){this.commands=[];}moveTo(...p){this.commands.push(p);}lineTo(...p){this.commands.push(p);}closePath(){}}
  const painted=[];
  const tile={worldBounds:{minX:0,minY:0,maxX:100,maxY:100},land:[],islands:[],
    water:[[[0,0,100,0,0,100,-100,0,0,-100],[20,20,60,0,0,60,-60,0,0,-60]]],rivers:[]};
  const s=vm.createContext({Path2D:Path,MAP_WATER_TILES:[tile],window:{TRAIN_GO_WATER_DATA:{precision:1}},
    mapWorldX:x=>x,mapWorldY:y=>y,sceneWorldBounds:()=>tile.worldBounds,timeOfDay:'day',
    ctx:{save(){},restore(){},translate(){},scale(){},fill(p){if(p.commands.length)painted.push('path');},fillRect(){painted.push('rectangle');},stroke(){}}});
  vm.runInContext(between('  const waterTilePaths =','  const terrainTiles='),s);
  s.drawMapWaterTiles({scale:1,screenCenterX:0,screenCenterY:0,centerWorldX:0,centerWorldY:0},true);
  assert.deepEqual(painted,[]);
});
