(() => {
  const data=window.TRAIN_GO_ROUTE_DATA;
  for(const [key,title,name,shape] of [
    ['railTamper','マルチプルタイタンパー','まるちぷるたいたんぱー','tamper'],
    ['railGrinder','レール削正車','れーるさくせいしゃ','grinder'],
    ['railBallast','バラストレギュレーター','ばらすとれぎゅれーたー','ballast'],
  ]) data.trains[key]={title,name,callName:name,kind:'maintenance',profile:'commuter',
    shape,workVehicle:true,body:'#edc33e',stripe:'#df7633',edge:'#435460',face:'#add9e7'};
  data.workRailKeys=['railTamper','railGrinder','railBallast'];
})();
