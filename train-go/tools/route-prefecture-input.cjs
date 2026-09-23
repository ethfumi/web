const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),scope=vm.createContext({window:{}});
for(const file of JSON.parse(fs.readFileSync(path.join(root,'runtime-sources.json'),'utf8')).filter(f=>!['app.js','prefecture-data.js'].includes(f))) {
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),scope);
}
const data=scope.window.TRAIN_GO_ROUTE_DATA,maps=scope.window.TRAIN_GO_MAP_DATA.maps;
const result={};
for(const [key,route] of Object.entries(data.routes)) {
  const stops=new Set([route.start,...route.stations.map(s=>s.name)]);
  result[key]=(maps[key]?.points||[]).filter((p,i)=>route.kind==='road' ? i%5===0||i===maps[key].points.length-1 : stops.has(p.name)).map(p=>[p.lon,p.lat]);
}
process.stdout.write(JSON.stringify(result));
