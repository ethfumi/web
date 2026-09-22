const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const s=vm.createContext({window:{}});
for(const f of ['catalog.js','trip-options.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),s);
const c=s.window.TRAIN_GO_CATALOG;

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
