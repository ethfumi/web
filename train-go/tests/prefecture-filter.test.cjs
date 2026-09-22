const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const s=vm.createContext({window:{}});
for(const file of JSON.parse(read('runtime-sources.json')).filter(f=>f!=='app.js'))vm.runInContext(read(file),s);
const data=s.window.TRAIN_GO_PREFECTURES,c=s.window.TRAIN_GO_CATALOG;
test('all 47 prefectures and every selectable route have valid filter metadata',()=>{
  assert.equal(data.prefectures.length,47);
  assert.deepEqual(Array.from(data.prefectures,p=>p[0]),Array.from({length:47},(_,i)=>i+1));
  for(const key of Object.keys(s.window.TRAIN_GO_ROUTE_DATA.routes)){
    assert.ok(data.routes[key]?.length,key);
    assert.equal(new Set(data.routes[key]).size,data.routes[key].length);
    for(const code of data.routes[key])assert.ok(Number.isInteger(code)&&code>=1&&code<=47,key);
  }
});
test('cross-prefecture routes appear in both prefectures and Tokyo islands remain in Tokyo',()=>{
  assert.deepEqual(Array.from(data.routes.sobu),[12,13]);
  assert.equal(c.inPrefecture('sobu','13',data),true);
  assert.equal(c.inPrefecture('sobu','12',data),true);
  assert.equal(c.inPrefecture('sobu','27',data),false);
  assert.equal(c.inPrefecture('sobu','',data),true);
  assert.deepEqual(Array.from(data.routes.airHachijo),[13]);
  assert.deepEqual(Array.from(data.routes.airFukuoka),[13,40]);
  assert.deepEqual(Array.from(data.routes.ferrySeikan),[1,2]);
  assert.ok(data.routes.throughNumazuUtsunomiya.includes(22));
  assert.ok(data.routes.throughNumazuUtsunomiya.includes(9));
  assert.deepEqual(Array.from(data.routes.ferryw479040711_72f222ca),[38]);
});
