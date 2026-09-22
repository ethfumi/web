  "use strict";
  const data=window.TRAIN_GO_ROUTE_DATA;
  const distance=(a,b)=>Math.hypot((a[0]-b[0])*91,(a[1]-b[1])*111);
  const legacy=Object.entries(data.maps).filter(([key])=>data.routes[key]?.kind==='sea');
  data.ferryNetwork={ports,keys:[]};
  for (const [id,encoded] of context) {
    let x=0,y=0,total=0;const points=[];
    for (let i=0;i<encoded.length;i+=2) {
      x+=encoded[i];y+=encoded[i+1];const xy=[x/100000,y/100000];
      if (points.length) total+=distance(points.at(-1).slice(2),xy);
      points.push(['',total,...xy]);
    }
    data.maps['seaReference'+id]={name:'',kind:'sea',reference:true,color:'#8aa2b5',points};
  }
  for (const [id,ai,bi,km,encoded,sourceName] of routes) {
    const a=ports[ai], b=ports[bi], axy=a.slice(2),bxy=b.slice(2);
    let key='ferry'+id, start=a[1], end=b[1];
    let existing=null, backwards=false, nearest=3;
    for (const [oldKey,map] of legacy) {
      const p=map.points[0].slice(2),q=map.points.at(-1).slice(2);
      const forward=distance(axy,p)+distance(bxy,q), reverse=distance(axy,q)+distance(bxy,p);
      if (Math.min(forward,reverse)<nearest) {nearest=Math.min(forward,reverse);existing=oldKey;backwards=reverse<forward;}
    }
    if (existing) {
      key=existing;
      if (data.ferryNetwork.keys.includes(key)) continue;
      start=backwards ? data.routes[key].stations[0].name : data.routes[key].start;
      end=backwards ? data.routes[key].start : data.routes[key].stations[0].name;
    }
    let x=0,y=0,total=0;
    const points=[];
    for (let i=0;i<encoded.length;i+=2) {
      x+=encoded[i];y+=encoded[i+1];const xy=[x/100000,y/100000];
      if (points.length) total+=distance(points.at(-1).slice(2),xy);
      points.push(['',total,...xy]);
    }
    const gameKm=existing ? data.routes[key].stations[0].km : km;
    for (const p of points) p[1]=total ? p[1]/total*gameKm : 0;
    points[0][0]=start;points.at(-1)[0]=end;
    if (backwards) {
      points.reverse();for (const p of points)p[1]=gameKm-p[1];
      [start,end]=[end,start];
    }
    const title=sourceName || `${a[0]}〜${b[0]}`;
    const routeName=existing ? data.routes[key].name : `${a[1]}〜${b[1]}`;
    data.routes[key]={name:routeName,kind:'sea',start,startKm:0,supportsExpress:false,allowCrossings:false,
      stations:[{name:end,km:gameKm},{name:start,km:0}],expressStops:new Set(),cityStations:new Set([start,end])};
    data.maps[key]={name:routeName,kind:'sea',color:'#277ba7',points};
    if (!existing) data.metadata.push({key,name:routeName,kind:'sea',color:'#277ba7',icon:'⛴️',trainKey:'ferry',speedKmh:35});
    const labels=backwards ? {[start]:b[0],[end]:a[0]} : {[start]:a[0],[end]:b[0]};
    data.stationLabelsByRoute[key]=labels;
    data.routeCatalog[key]={title,kind:'sea',regions:['sea'],endpoints:`${start} 〜 ${end}`,
      search:[title,routeName,a[0],a[1],b[0],b[1]].join(' ')};
    data.ferryNetwork.keys.push(key);
  }
