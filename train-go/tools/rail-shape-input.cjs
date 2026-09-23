const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),scope=vm.createContext({window:{}});
for(const file of JSON.parse(fs.readFileSync(path.join(root,'runtime-sources.json'),'utf8')).filter(f=>!['app.js','rail-shape-data.js'].includes(f)))vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),scope);
const data=scope.window.TRAIN_GO_ROUTE_DATA,names=scope.window.TRAIN_GO_TRIP_OPTIONS.createNameResolver(data),result={};
for(const [key,map] of Object.entries(scope.window.TRAIN_GO_MAP_DATA.maps)) {
  if(['air','sea','road'].includes(map.kind)||map.reference)continue;
  result[key]={title:names.route(key,'kanji'),source:data.routeCatalog[key]?.sourceCode,loopKm:map.loopKm,
    points:map.points.map(p=>[p.name,p.km,p.lon,p.lat,names.station(p.name,key,'kanji')])};
}
process.stdout.write(JSON.stringify(result));
