const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const scope=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../train-announcements.js'),'utf8'),scope);
const a=scope.window.TRAIN_GO_ANNOUNCEMENTS;

test('terminal and normal stops use distinct departure and arrival announcements',()=>{
  assert.equal(a.next({station:'みたか',terminal:true}),'次は、終点、終点、みたかです。');
  assert.equal(a.next({station:'なかの'}),'次は、なかの、なかのです。');
  assert.match(a.approach({station:'みたか',terminal:true}),/終点、みたか/);
  assert.match(a.arrival({station:'みたか',terminal:true}),/ご乗車ありがとうございました/);
  assert.doesNotMatch(a.arrival({station:'なかの'}),/終点/);
});
test('deadhead and passing announcements never invite boarding or promise a stop',()=>{
  assert.match(a.deadhead(),/どなた様も、ご乗車になれません/);
  assert.equal(a.next({station:'みたか',terminal:true,outOfService:true}),a.deadhead());
  assert.match(a.next({station:'なかの',passing:true}),/通過いたします/);
  assert.doesNotMatch(a.approach({station:'なかの',passing:true}),/お降り/);
});
test('terminal detection respects return direction and does not turn a loop into a terminal',()=>{
  const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
  const code=app.slice(app.indexOf('  function nextAnnouncementOptions()'),app.indexOf('  function isAirRoute('));
  const destinationCode=app.slice(app.indexOf('  function routeTerminalStation()'),app.indexOf('  function displaySpeed('));
  const s=vm.createContext({activeRoute:{start:'みたか',startKm:0,terminalIndex:0,stations:[{name:'ちば',km:60}]},
    routeDirection:-1,nextStationName:'みたか',passingStation:false,deadheadMode:false});
  vm.runInContext(destinationCode+code,s);assert.equal(s.nextAnnouncementOptions().terminal,true);
  s.routeDirection=1;assert.equal(s.nextAnnouncementOptions().terminal,false);
  s.nextStationName='ちば';assert.equal(s.nextAnnouncementOptions().terminal,true);
  s.activeRoute.loopKm=34.5;s.nextStationName='みたか';assert.equal(s.nextAnnouncementOptions().terminal,false);
});
