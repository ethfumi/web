const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const s=vm.createContext({window:{}});
for(const f of ['catalog.js','trip-options.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),s);
const c=s.window.TRAIN_GO_CATALOG;

test('scrolling loads only the active catalogue near its end and stops after the last page',()=>{
  const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
  const code=app.slice(app.indexOf('  let catalogFillFrame=0;'),app.indexOf('  function makeRouteButton('));
  const pending=[],calls=[];
  const element=(hidden,top=0)=>({hidden,top,classList:{contains(){return this.owner.hidden;}},getBoundingClientRect(){return {top:this.top,bottom:600};}});
  const elements={'route-select-page':element(false),'train-select-page':element(true),'route-end':element(false,1000),'train-end':element(false,650)};
  const screen=element(false);screen.addEventListener=()=>{};
  for(const e of [screen,...Object.values(elements)])e.classList.owner=e;
  const scope=vm.createContext({selectScreen:screen,routeLimit:24,trainLimit:18,
    requestAnimationFrame:fn=>{pending.push(fn);return 1;},window:{addEventListener(){}},
    document:{getElementById:id=>elements[id]},
    filterRouteChoices:(...args)=>calls.push(['route',...args]),renderTrainChoices:(...args)=>calls.push(['train',...args])});
  vm.runInContext(code,scope);
  scope.queueCatalogFill();scope.queueCatalogFill();assert.equal(pending.length,1);pending.shift()();
  assert.equal(calls.length,0,'do not create offscreen candidates');
  elements['route-end'].top=650;scope.queueCatalogFill();pending.shift()();
  assert.deepEqual(calls,[['route',false,true]]);assert.equal(scope.routeLimit,48);
  elements['route-select-page'].hidden=true;elements['train-select-page'].hidden=false;
  scope.queueCatalogFill();pending.shift()();assert.equal(scope.trainLimit,36);
  elements['train-end'].hidden=true;scope.queueCatalogFill();pending.shift()();assert.equal(calls.length,2);
  screen.hidden=true;elements['train-end'].hidden=false;scope.queueCatalogFill();pending.shift()();assert.equal(calls.length,2);
});

test('recommended vehicle precedes recents, appears once, and pagination never loses candidates',()=>{
  const keys=Array.from({length:645},(_,i)=>'train'+i),recent=['train98','train400','train98'];
  const first=c.groups(keys,recent,'train400',18);
  assert.deepEqual(Array.from(first.recommended),['train400']);
  assert.deepEqual(Array.from(first.recent),['train98']);
  assert.equal(first.items.length,18);assert.equal(first.hasMore,true);
  const full=c.groups(keys,recent,'train400',1000);
  assert.equal(full.hasMore,false);
  const all=[...full.recommended,...full.recent,...full.items];
  assert.equal(all.length,645);assert.equal(new Set(all).size,645);
  assert.deepEqual([...all].sort(),[...keys].sort());
  assert.equal(c.groups([],recent,'train400',18).total,0);
});

test('search accepts kana, width variants and multiple words',()=>{
  assert.equal(c.matches('N700系 中央線 ちゅうおうせん','ｎ７００ 中央'),true);
  assert.equal(c.matches('ちゅうおうせん','チュウオウ'),true);
  assert.equal(c.matches('中央線','山手線'),false);
});

test('coupling palette keeps the exact departure vehicle last and only includes trains',()=>{
  const trains={original:{},'original#color':{},other:{},third:{},air:{kind:'airplane'},ship:{kind:'ferry'}};
  assert.deepEqual(Array.from(c.couplingKeys('original#color',['air','other','original#color','other'],['third','ship'],trains)),['other','third','original#color']);
  const many=Object.fromEntries(Array.from({length:20},(_,i)=>['t'+i,{}]));
  const keys=Array.from(c.couplingKeys('t0',Object.keys(many).reverse(),Object.keys(many),many));
  assert.equal(keys.length,10);assert.equal(keys.at(-1),'t0');assert.equal(new Set(keys).size,10);
});

test('custom coupling choices survive reload and discard removed or invalid vehicles',()=>{
  let saved=JSON.stringify({coupling:['other','other','missing','air','original']});
  const storage={getItem:()=>saved,setItem:(_,v)=>saved=v};
  const trains={original:{},other:{},air:{kind:'airplane'}};
  const prefs=s.window.TRAIN_GO_TRIP_OPTIONS.createPreferences(storage,{},trains);
  assert.deepEqual(Array.from(prefs.state.coupling),['other','original']);prefs.save();
  assert.deepEqual(Array.from(s.window.TRAIN_GO_TRIP_OPTIONS.createPreferences(storage,{},trains).state.coupling),['other','original']);
});

test('closing the coupling picker resumes running audio without resetting the trip or sounding at a stop',()=>{
  const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
  const code=app.slice(app.indexOf('  function closeCouplingPicker() {'),app.indexOf("  document.getElementById('btn-choose-car').addEventListener"));
  for(const state of ['running','stopped']){
    const calls=[],other={inert:true};
    const scope=vm.createContext({state,couplingPickerOpen:true,pickerInertElements:[other],speed:1200,distance:35000,
      selectScreen:{classList:{add(){}},removeAttribute(){}},
      document:{body:{classList:{remove(){}}},getElementById:()=>({replaceChildren(){},focus(){calls.push('focus');}})},
      startRunningSound:()=>calls.push('start'),updateRunningSound:()=>calls.push('update')});
    vm.runInContext(code+'\ncloseCouplingPicker();',scope);
    assert.deepEqual(calls,state==='running'?['start','update','focus']:['update','focus']);
    assert.equal(scope.couplingPickerOpen,false);assert.equal(other.inert,false);
    assert.equal(scope.speed,1200);assert.equal(scope.distance,35000);
  }
});
