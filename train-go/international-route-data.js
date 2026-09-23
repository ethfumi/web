// Selected neighboring international links. Sources/status: data/international-network.md.
(() => {
  'use strict';
  const data=window.TRAIN_GO_ROUTE_DATA,keys=[];
  window.TRAIN_GO_NEIGHBOR_LABELS=[
    ['日本','にほん',138.3,38.8,'country'],['台湾','たいわん',120.95,24.5,'country'],
    ['韓国','かんこく',127.65,36.3,'country'],['北朝鮮','きたちょうせん',126.8,40.1,'country'],
    ['中国','ちゅうごく',119.1,33.8,'country'],['ロシア','ろしあ',134,45,'country'],
    ['台北','たいぺい',121.56,25.04,'city'],['高雄','たかお',120.30,22.63,'city'],
    ['基隆','きーるん',121.75,25.13,'city'],['ソウル','そうる',126.98,37.57,'city'],
    ['釜山','ぷさん',129.07,35.18,'city'],['東海','とんへ',129.11,37.50,'city'],
    ['平壌','ぴょんやん',125.75,39.04,'city'],['上海','しゃんはい',121.47,31.23,'city'],
    ['青島','ちんたお',120.38,36.07,'city'],['大連','だいれん',121.61,38.91,'city'],
    ['ウラジオストク','うらじおすとく',131.89,43.12,'city'],
    ['ユジノサハリンスク','ゆじのさはりんすく',142.74,46.96,'city'],
  ];
  const airports={
    KIX:['関西空港','かんさいくうこう',135.244003,34.427299],
    HND:['羽田空港','はねだくうこう',139.786958,35.549678],
    OKA:['那覇空港','なはくうこう',127.639804,26.192437],
    ICN:['仁川空港','いんちょんくうこう',126.450996,37.469101],
    GMP:['金浦空港','きんぽくうこう',126.791,37.5583],
    PUS:['金海空港','きめくうこう',128.938004,35.179501],
    TPE:['桃園空港','とうえんくうこう',121.233002,25.0777],
    TSA:['松山空港（台北）','しょうざんくうこう（たいぺい）',121.552822,25.067244],
    KHH:['高雄空港','たかおくうこう',120.349998,22.577101],
    PVG:['浦東空港','ぷーどんくうこう',121.805,31.1434],
    SHA:['虹橋空港','ほんちゃおくうこう',121.33426,31.198104],
    TAO:['青島膠東空港','ちんたおこうとうくうこう',120.088171,36.361953],
    DLC:['大連周水子空港','だいれんしゅうすいしくうこう',121.538477,38.965719],
  };
  function km(a,b) {
    const r=Math.PI/180,dlat=(b[3]-a[3])*r,dlon=(b[2]-a[2])*r;
    return 12742*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a[3]*r)*Math.cos(b[3]*r)*Math.sin(dlon/2)**2)));
  }
  function add(key,title,name,kind,nodes,regions,reference=false) {
    let distance=0;const labels={},points=nodes.map((node,index)=>{
      if(index)distance+=km(nodes[index-1],node);
      if(node[1])labels[node[1]]=node[0];
      return [node[1],distance,node[2],node[3]];
    });
    const color=reference?'#8aa2b5':kind==='air'?'#8b70b0':'#387da9';
    data.maps[key]={name,kind,color,points,reference,referenceLabel:reference?name:'',referenceTitle:reference?title:''};
    if(reference)return;
    const stops=points.filter(p=>p[0]);const start=stops[0][0];
    data.routes[key]={name,kind,international:true,start,startKm:0,supportsExpress:false,allowCrossings:false,
      stations:[...stops.slice(1).map(p=>({name:p[0],km:p[1]})),{name:start,km:0}],expressStops:new Set(),cityStations:new Set()};
    data.metadata.push({key,name,kind,color,icon:kind==='air'?'✈️':'⛴️',trainKey:kind==='air'?'airplane':'ferry',speedKmh:kind==='air'?800:35});
    data.routeCatalog[key]={title,kind,regions,sourceCode:key,international:true,search:title+' '+name+' '+Object.values(labels).join(' ')};
    data.stationLabelsByRoute[key]=labels;keys.push(key);
  }
  for(const [from,to,title,name] of [
    ['KIX','ICN','関西～ソウル（仁川）','かんさい～そうる（いんちょん）'],
    ['KIX','PUS','関西～釜山','かんさい～ぷさん'],
    ['KIX','TPE','関西～台北（桃園）','かんさい～たいぺい（とうえん）'],
    ['KIX','KHH','関西～高雄','かんさい～たかお'],
    ['KIX','PVG','関西～上海（浦東）','かんさい～しゃんはい（ぷーどん）'],
    ['KIX','TAO','関西～青島','かんさい～ちんたお'],
    ['KIX','DLC','関西～大連','かんさい～だいれん'],
    ['HND','GMP','羽田～ソウル（金浦）','はねだ～そうる（きんぽ）'],
    ['HND','TSA','羽田～台北（松山）','はねだ～たいぺい（しょうざん）'],
    ['HND','SHA','羽田～上海（虹橋）','はねだ～しゃんはい（ほんちゃお）'],
    ['OKA','TPE','那覇～台北（桃園）','なは～たいぺい（とうえん）'],
  ]) {
    const key='internationalAir'+from+to;
    add(key,title,name,'air',[airports[from],airports[to]],[from==='KIX'?'kinki':from==='HND'?'kanto':'okinawa']);
    data.routeCatalog[key].search+=' '+(['ICN','GMP','PUS'].includes(to)?'韓国 かんこく':['TPE','TSA','KHH'].includes(to)?'台湾 たいわん':'中国 ちゅうごく');
  }
  const p=(lon,lat)=>['','',lon,lat];
  const busan=['釜山港','ぷさんこう',129.049,35.117];
  const osaka=['大阪南港','おおさかなんこう',135.413,34.631];
  // Approximate sea corridors retain straits and go around land; not navigational tracks.
  const seto=[p(135.25,34.58),p(135.02,34.60),p(134.91,34.60),p(134.55,34.46),p(134.12,34.40),p(133.85,34.34),p(133.80,34.29),p(133.4,34.20),p(133.02,34.14),p(132.94,34.09),p(132.76,34.03),p(132.6,33.97),p(132.45,33.87),p(131.9,33.82),p(131.45,33.83),p(131.06,33.93),p(130.97,33.955),p(130.93,33.95),p(130.86,33.94),p(130.68,34.01)];
  add('internationalSeaHakataBusan','博多～釜山','はかた～ぷさん','sea',[
    ['博多港','はかたこう',130.395,33.609],p(130.39,33.66),p(130.30,33.70),p(130.25,33.79),p(130.1,34.0),p(129.72,34.4),p(129.54,34.9),p(129.12,35.04),p(129.08,35.07),busan],['kyushu']);
  add('internationalSeaShimonosekiBusan','下関～釜山','しものせき～ぷさん','sea',[
    ['下関港','しものせきこう',130.923,33.948],p(130.86,33.94),p(130.68,34.01),p(129.72,34.4),p(129.54,34.9),p(129.12,35.04),p(129.08,35.07),busan],['chugoku']);
  add('internationalSeaOsakaBusan','大阪～釜山','おおさか～ぷさん','sea',[
    osaka,...seto,p(129.72,34.4),p(129.54,34.9),p(129.12,35.04),p(129.08,35.07),busan],['kinki']);
  add('internationalSeaSakaiminatoVladivostok','境港～東海～ウラジオストク','さかいみなと～とんへ～うらじおすとく','sea',[
    ['境港','さかいみなと',133.26,35.547],p(133.29,35.55),p(133.4,35.55),p(133.4,35.65),p(133.4,35.82),p(130,37.30),p(129.2,37.50),
    ['東海港','とんへこう',129.148,37.494],p(129.25,37.52),p(129.9,38.5),p(131.5,40.8),p(132.1,42.5),p(131.8,42.8),p(131.82,43.03),p(131.89,43.10),
    ['ウラジオストク港','うらじおすとくこう',131.885,43.111]],['chugoku']);
  add('internationalReferenceIshigakiKeelung','石垣～基隆（10/1～休止予定）','いしがき～きーるん（10/1～きゅうしよてい）','sea',[
    ['石垣港','いしがきこう',124.158,24.332],p(124.1,24.24),p(123.8,24.10),p(123.5,24.1),p(123.3,24.5),p(122.2,25.2),p(121.78,25.20),['基隆港','きーるんこう',121.747,25.151]],['okinawa'],true);
  add('internationalReferenceOsakaShanghai','大阪～上海（旅客休止）','おおさか～しゃんはい（りょかくきゅうし）','sea',[
    osaka,...seto,p(130.1,34.15),p(129.55,33.95),p(128.5,33.9),p(126,32.5),p(122.5,31.7),p(121.8,31.4),['上海港','しゃんはいこう',121.51,31.41]],['kinki'],true);
  data.internationalNetwork={keys,airCount:11,seaCount:4,referenceCount:2};
  for(const key of keys.filter(key=>data.routes[key].kind==='sea'))data.routeCatalog[key].search+=' 韓国 かんこく'+(key.endsWith('Vladivostok')?' ロシア ろしあ':'');
})();
