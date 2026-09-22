const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const context = vm.createContext({window:{}});
const html = read('index.html');
const scriptNames = JSON.parse(read('runtime-sources.json'));
for (const file of scriptNames.filter(f => f !== 'app.js')) vm.runInContext(read(file), context, {filename:file});
const data = context.window.TRAIN_GO_ROUTE_DATA;
const maps = context.window.TRAIN_GO_MAP_DATA.maps;
const coverage = JSON.parse(read('data/rail-coverage.json'));
const config = JSON.parse(read('data/rail-route-overrides.json'));

test('every source line is accounted for and every included course can be selected', () => {
  const db = JSON.parse(read('data/station-database.json'));
  assert.equal(coverage.lines.length, db.lines.length);
  assert.equal(coverage.activeSourceLines, 602);
  assert.equal(coverage.includedSourceLines, 598);
  assert.equal(coverage.aliasSourceLines, 4);
  assert.equal(coverage.supplementalRoutes, 18);
  const buttons = [...html.matchAll(/data-route="([^"]+)"/g)].map(m => m[1]).concat(data.metadata.map(m => m.key));
  assert.equal(new Set(buttons).size, buttons.length, 'duplicate route buttons');
  for (const key of Object.keys(data.routes)) assert.ok(buttons.includes(key), `unselectable ${key}`);
  for (const line of coverage.lines) {
    assert.ok(['included', 'alias', 'closed'].includes(line.status));
    if (line.status === 'included') for (const key of line.routes) {
      assert.ok(data.routes[key] && maps[key], `missing ${key}`);
      assert.ok(data.routeCatalog[key].regions.length, `unclassified ${key}`);
    }
    if (line.status === 'alias') assert.equal(coverage.lines.find(l => l.code === line.canonical).status, 'included');
  }
  const prefectures = new Set(db.lines.filter(l => !l.closed).flatMap(l => l.stations)
    .map(id => db.stations[id]).filter(s => !s[5]).map(s => s[4]));
  assert.equal(prefectures.size, 47);
});

test('every added course has finite increasing distances, coordinates, a train and a map', () => {
  for (const key of data.allRailRouteKeys) {
    const route = data.routes[key], points = maps[key].points;
    assert.ok(points.length >= 2, key);
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      assert.ok(p.name && Number.isFinite(p.km), key);
      assert.ok(p.lon >= 122 && p.lon <= 146 && p.lat >= 24 && p.lat <= 46, key);
      if (i) assert.ok(p.km > points[i-1].km, `${key}: ${p.name}`);
    }
    const meta = data.metadata.find(m => m.key === key);
    const trainKey = meta?.trainKey || ({tokaido:'nozomi',tohoku:'hayabusa'}[key] || key);
    assert.ok(data.trains[trainKey], `missing train ${key}`);
    assert.ok(route.stations.length >= 1, key);
    if (route.loopKm) assert.ok(route.terminalIndex >= 0 && route.terminalIndex < route.stations.length, key);
    else assert.equal(route.stations.at(-1).km, 0, `return sentinel ${key}`);
  }
});

test('branches do not connect unrelated dead ends and loops close in the travel direction', () => {
  const names = key => Array.from(maps[key].points, p => p.name);
  assert.equal(names('tsurumi').includes('うみしばうら'), false);
  assert.equal(names('tsurumi').includes('おおかわ'), false);
  assert.deepEqual(names('tsurumiBranch1'), ['あさの','しんしばうら','うみしばうら']);
  assert.deepEqual(names('tsurumiBranch2'), ['あんぜん','おおかわ']);
  assert.equal(names('naritaBranch2').at(-1), 'なりた');
  assert.equal(names('chuoMain').includes('たつの'), false);
  assert.equal(names('chuoMainBranch1').includes('たつの'), true);
  assert.deepEqual(names('railLine11109Branch1'), ['みなみちとせ','しんちとせくうこう']);
  for (const key of ['railLine99104','railLine99514','railLine99734','disneyResort','yukarigaoka']) {
    assert.equal(names(key)[0], names(key).at(-1), key);
    assert.equal(data.routes[key].loopKm, maps[key].endKm, key);
  }
});

test('the actual station scheduler completes two round trips or laps on every nationwide course', () => {
  const app = read('app.js');
  const scheduler = app.slice(app.indexOf('  function scheduleNextStation() {'), app.indexOf('  function isKomachiCouplingStop('));
  assert.ok(scheduler.startsWith('  function scheduleNextStation() {'));
  for (const key of data.allRailRouteKeys) {
    const route = data.routes[key];
    const simulation = vm.createContext({activeRoute:route, stationIdx:-1, routeDirection:1,
      currentLineKm:route.startKm, distance:0, stationWorldX:0, nextStationName:'',
      canvas:{dataset:{}}, PIXELS_PER_METER:12, isKomachiCouplingStop:()=>false});
    vm.runInContext(scheduler, simulation);
    const schedule = simulation.scheduleNextStation;
    const count = route.loopKm ? route.stations.length : (route.stations.length - 1)*2;
    for (let lap=0; lap<2; lap++) {
      for (let i=0; i<count; i++) {
        schedule();
        assert.ok(Number.isFinite(simulation.stationWorldX) && simulation.stationWorldX > simulation.distance, `${key}: stalled at ${simulation.nextStationName}`);
        simulation.distance = simulation.stationWorldX;
      }
      assert.equal(simulation.nextStationName,route.start, `${key}: did not return to start`);
    }
  }
});

test('selecting a shorter route after a return trip cannot read a stale station index', () => {
  const app = read('app.js');
  const start = app.indexOf('  function updateDriveUi(');
  const end = app.indexOf('\n  function ', start + 3);
  const updateUi = app.slice(start, end);
  const simulation = vm.createContext({state:'select', performance:{now:()=>200},
    activeRoute:data.routes.kuramaCable, stationIdx:30, routeDirection:-1,
    routeTerminalStation:()=>{throw new Error('must not read driving state during selection');}});
  vm.runInContext(updateUi, simulation);
  assert.doesNotThrow(()=>simulation.updateDriveUi());
});

test('handcrafted courses and all pre-existing route keys survive the extension', () => {
  const old = vm.createContext({window:{}});
  for (const name of ['train-route-data.js','national-rail-route-data.js','kanto-rail-route-data.js']) vm.runInContext(read(name),old);
  for (const key of Object.keys(old.window.TRAIN_GO_ROUTE_DATA.routes)) assert.ok(data.routes[key],key);
  for (const key of config.preserveKeys.filter(k => !config.refreshKeys.includes(k))) {
    assert.equal(JSON.stringify(data.routes[key]),JSON.stringify(old.window.TRAIN_GO_ROUTE_DATA.routes[key]),key);
  }
  assert.ok(data.routes.tohoku.expressStops.has('もりおか'));
  assert.ok(maps.yokosuka.points.length >= 19);
  assert.ok(maps.uchibo.points.length >= 32);
  assert.equal(maps.fukutoshin.points[0].name,'わこうし');
});

test('offline cache includes the complete catalogue and uses the same asset version', () => {
  const sw = read('sw.js');
  const version = sw.match(/train-go-v(\d+)/)[1];
  assert.ok(sw.includes(`"runtime.js.gz?v=${version}"`));
  assert.ok(html.includes(`loader.js?v=${version}`));
  const packed = require('node:zlib').gunzipSync(fs.readFileSync(path.join(root, 'runtime.js.gz'))).toString();
  assert.equal(packed, scriptNames.map(read).join('\n;\n')+'\n;window.TRAIN_GO_READY = true;\n');
  const assets = [...sw.matchAll(/^  "([^"]+)",/gm)].map(m=>m[1].split('?')[0]).filter(x=>x!=='.');
  assert.ok(!assets.includes('og.png'), 'sharing image must not be downloaded for offline play');
  assert.ok(assets.reduce((sum,name)=>sum+fs.statSync(path.join(root,name)).size,0)<=2_000_000);
  assert.ok(html.includes(`v${version}</strong>`));
  assert.equal(new Set([...html.matchAll(/\?v=(\d+)/g)].map(m=>m[1]).filter(v=>v!=='55')).size,1);
});
