  "use strict";
  const data = window.TRAIN_GO_ROUTE_DATA;
  const legacyPairs = {
    'HND/ITM':'airOsaka', 'CTS/HND':'airHokkaido', 'HND/OKA':'airOkinawa',
    'FUK/HND':'airFukuoka', 'HND/KMQ':'airKomatsu', 'HAC/HND':'airHachijo',
    'ISG/OKA':'airIshigaki', 'MMY/OKA':'airMiyako', 'KOJ/KUM':'airYakushima', 'ASJ/KOJ':'airAmami',
  };
  const shortNames = {HND:['羽田','はねだ'],NRT:['成田','なりた'],ITM:['伊丹','いたみ'],
    NKM:['小牧','こまき'],OKD:['丘珠','おかだま'],OKA:['那覇','なは'],KMQ:['小松','こまつ'],
    IBR:['茨城','いばらき'],YGJ:['米子','よなご']};
  const helicopterPairs = new Set(['JP-1671/OIM','MYE/OIM','JP-3101/MYE','HAC/JP-1747','HAC/JP-3101']);
  data.trains.helicopter = {...data.trains.airplane, name:'しろいヘリコプター', callName:'しろいヘリコプター', helicopter:true};
  const distance = (a,b) => {
    const rad = Math.PI/180, dlat = (b[4]-a[4])*rad, dlon = (b[3]-a[3])*rad;
    return 6371*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a[4]*rad)*Math.cos(b[4]*rad)*Math.sin(dlon/2)**2)));
  };
  const names = a => {
    const [title,kana] = shortNames[a[0]] || a.slice(1,3);
    return [title+(a[5]?'ヘリポート':'空港'),kana+(a[5]?'ヘリポート':'くうこう')];
  };
  data.airNetwork = {airports, pairs, keys:[]};
  for (const [ai,bi] of pairs) {
    let a=airports[ai], b=airports[bi];
    const pair=[a[0],b[0]].sort().join('/');
    const key=legacyPairs[pair] || 'airPair'+pair.replace(/[^A-Z0-9]/g,'');
    const helicopter=helicopterPairs.has(pair), trainKey=helicopter?'helicopter':'airplane';
    let route=data.routes[key];
    if (route) {
      const startPoint=data.maps[key].points[0];
      if (Math.hypot(startPoint[2]-b[3],startPoint[3]-b[4]) < Math.hypot(startPoint[2]-a[3],startPoint[3]-a[4])) [a,b]=[b,a];
      // Keep saved station identities and established game distances, but repair endpoint coordinates.
      data.maps[key].points[0].splice(2,2,a[3],a[4]);
      data.maps[key].points.at(-1).splice(2,2,b[3],b[4]);
    } else {
      const km=Math.max(0.1,Math.round(distance(a,b)*10)/10), start=names(a)[1], end=names(b)[1];
      route=data.routes[key]={name:`${a[2]}〜${b[2]}`,kind:'air',start,startKm:0,
        supportsExpress:false,allowCrossings:false,stations:[{name:end,km},{name:start,km:0}],
        expressStops:new Set(),cityStations:new Set([start,end])};
      data.maps[key]={name:route.name,kind:'air',color:'#2584d8',
        points:[[start,0,a[3],a[4]],[end,km,b[3],b[4]]]};
      data.metadata.push({key,name:route.name,kind:'air',color:'#2584d8',icon:helicopter?'🚁':'✈️',trainKey,speedKmh:helicopter?230:850});
    }
    const title=`${a[1]}〜${b[1]}`;
    data.stationLabelsByRoute[key]={[route.start]:names(a)[0],[route.stations[0].name]:names(b)[0]};
    data.routeCatalog[key]={title,kind:'air',regions:['air'],endpoints:`${route.start} 〜 ${route.stations[0].name}`,
      search:[title,route.name,...a.slice(0,3),...b.slice(0,3),helicopter?'ヘリコプター':'飛行機'].join(' ')};
    data.airNetwork.keys.push(key);
  }
