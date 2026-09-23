"""Build long through-service courses from the pinned station database."""
import json
import runpy
import re
import unicodedata
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
helpers=runpy.run_path(str(ROOT/'tools/build-rail-network.py'))
distance=helpers['distance']
regions_for=helpers['regions_for']
db=json.loads((ROOT/'data/station-database.json').read_text('utf8'))
config=json.loads((ROOT/'data/rail-route-overrides.json').read_text('utf8'))
lines={l['code']:l for l in db['lines']}
JR='https://www.jreast.co.jp/estation/facility_search.aspx?searchCategoryCd=1'
TOBU='https://www.tobu.co.jp/corporation/rail/route/'
TOKYU='https://transfer.navitime.biz/tokyu/pc/diagram/TrainDiagram?rrCd=00001016&stCd=00009364&updown=0'

def leg(code,start,end,path_index=0):
    return [code,start,end,path_index]

def connection(start_code,start,end_code,end):
    return {'connection':[start_code,start,end_code,end]}

def train_key(code):return config['existingKeys'].get(str(code),'railLine'+str(code))
def normalized(name):return re.sub(r'[（(〈].*?[）)〉]','',unicodedata.normalize('NFKC',name)).replace('・','')
def station_index(stations,name):
    names=[normalized(s[1]) for s in stations];return names.index(normalized(name))
def station(code,name):
    values=[db['stations'][str(s)] for s in lines[code]['stations'] if not db['stations'][str(s)][5]]
    return values[station_index(values,name)]

tokyo_ueno=leg(11343,'とうきょう','うえの')
toyo_south=[leg(28010,'こたけむかいはら','しぶや'),leg(26001,'しぶや','よこはま'),leg(99310,'よこはま','もとまちちゅうかがい')]
denentoshi=[leg(26003,'ちゅうおうりんかん','しぶや'),leg(28008,'しぶや','おしあげ'),leg(21002,'おしあげ','ひきふね',1)]
services=[
 ('throughNumazuUtsunomiya','上野東京ライン・沼津〜宇都宮','うえのとうきょうライン','uenoTokyo',JR,
  [leg(11501,'ぬまづ','あたみ'),leg(11301,'あたみ','とうきょう'),tokyo_ueno,leg(11319,'うえの','うつのみや')]),
 ('throughAtamiTakasaki','上野東京ライン・熱海〜高崎','うえのとうきょうライン','uenoTokyo',JR,
  [leg(11301,'あたみ','とうきょう'),tokyo_ueno,leg(11323,'うえの','たかさき')]),
 ('throughZushiUtsunomiya','湘南新宿ライン・逗子〜宇都宮','しょうなんしんじゅくライン','shonanShinjuku',JR,
  [leg(11308,'ずし','おおふな'),leg(11333,'おおふな','おおみや'),leg(11319,'おおみや','うつのみや')]),
 ('throughOdawaraTakasaki','湘南新宿ライン・小田原〜高崎','しょうなんしんじゅくライン','shonanShinjuku',JR,
  [leg(11301,'おだわら','おおふな'),leg(11333,'おおふな','おおみや'),leg(11323,'おおみや','たかさき')]),
 ('throughChuorinkanKuki','田園都市・半蔵門・東武線・中央林間〜久喜','でんえんとし・はんぞうもん・とうぶせん','tokyuDenentoshi',TOBU,
  denentoshi+[leg(21002,'ひきふね','くき')]),
 ('throughChuorinkanMinamikurihashi','田園都市・半蔵門・東武線・中央林間〜南栗橋','でんえんとし・はんぞうもん・とうぶせん','tokyuDenentoshi',TOBU,
  denentoshi+[leg(21002,'ひきふね','とうぶどうぶつこうえん'),leg(21003,'とうぶどうぶつこうえん','みなみくりはし')]),
 ('throughOgawamachiYokohama','東武・副都心・東横・みなとみらい線・小川町〜元町・中華街','とうぶ・ふくとしん・とうよこせん','toyoko',TOKYU,
  [leg(21001,'おがわまち','わこうし'),leg(28010,'わこうし','こたけむかいはら')]+toyo_south),
 ('throughHannoYokohama','西武・副都心・東横・みなとみらい線・飯能〜元町・中華街','せいぶ・ふくとしん・とうよこせん','toyoko',TOKYU,
  [leg(22001,'はんのう','ねりま'),leg(22003,'ねりま','こたけむかいはら')]+toyo_south),
 ('throughChichibuYokohama','西武・副都心・東横・みなとみらい線・西武秩父〜元町・中華街','せいぶ・ふくとしん・とうよこせん','toyoko',TOKYU,
  [leg(22002,'せいぶちちぶ','あがの'),leg(22001,'あがの','ねりま'),leg(22003,'ねりま','こたけむかいはら')]+toyo_south),
]
METRO='https://www.tokyometro.jp/corporate/ir/library/factbook/pdf/factbook_2025.pdf'
TOEI='https://www.kotsu.metro.tokyo.jp/about/service/subway.html'
SOTETSU='https://www.sotetsu.co.jp/train/stations/'
MUSASHINO='https://timetables.jreast.co.jp/2609/timetable-v/708d1p.html'
tozai_west=[leg(11313,'みたか','なかの'),leg(28004,'なかの','にしふなばし')]
sotetsu_tokyu=[leg(29003,'にしや','しんよこはま'),leg(26009,'しんよこはま','ひよし')]
services += [
 ('throughNishifunabashiMakuhari','京葉線直通・西船橋〜海浜幕張','けいようせんちょくつう・にしふなばし～かいひんまくはり','musashino',MUSASHINO,
  [leg(11305,'にしふなばし','みなみふなばし'),leg(11326,'みなみふなばし','かいひんまくはり')]),
 ('throughFuchuMakuhari','武蔵野・京葉線・府中本町〜海浜幕張','むさしの・けいようせん','musashino',MUSASHINO,
  [leg(11305,'ふちゅうほんまち','みなみふなばし'),leg(11326,'みなみふなばし','かいひんまくはり')]),
 ('throughFuchuTokyo','武蔵野・京葉線・府中本町〜東京','むさしの・けいようせん','musashino',MUSASHINO,
  [leg(11305,'ふちゅうほんまち','にしふなばし'),connection(11305,'にしふなばし',11326,'いちかわしおはま'),leg(11326,'いちかわしおはま','とうきょう')]),
 ('throughMitakaToyoKatsutadai','中央総武・東西・東葉高速線・三鷹〜東葉勝田台','ちゅうおうそうぶ・とうざい・とうようこうそくせん','tozai',METRO,
  tozai_west+[leg(99338,'にしふなばし','とうようかつただい')]),
 ('throughMitakaTsudanumaTozai','中央総武・東西線・三鷹〜津田沼','ちゅうおうそうぶ・とうざいせん','tozai',METRO,
  tozai_west+[leg(11313,'にしふなばし','つだぬま')]),
 ('throughHonatsugiToride','小田急・千代田・常磐線・本厚木〜取手','おだきゅう・ちよだ・じょうばんせん','joban',METRO,
  [leg(25001,'ほんあつぎ','よよぎうえはら'),leg(28005,'よよぎうえはら','あやせ'),leg(11320,'あやせ','とりで')]),
 ('throughNakameguroMinamikurihashi','日比谷・東武線・中目黒〜南栗橋','ひびや・とうぶせん','hibiya',METRO,
  [leg(28003,'なかめぐろ','きたせんじゅ'),leg(21002,'きたせんじゅ','とうぶどうぶつこうえん'),leg(21003,'とうぶどうぶつこうえん','みなみくりはし')]),
 ('throughHannoShinkiba','西武・有楽町線・飯能〜新木場','せいぶ・ゆうらくちょうせん','yurakucho',METRO,
  [leg(22001,'はんのう','ねりま'),leg(22003,'ねりま','こたけむかいはら'),leg(28006,'こたけむかいはら','しんきば')]),
 ('throughShinrinkoenShinkiba','東武・有楽町線・森林公園〜新木場','とうぶ・ゆうらくちょうせん','yurakucho',METRO,
  [leg(21001,'しんりんこうえん','わこうし'),leg(28006,'わこうし','しんきば')]),
 ('throughHashimotoMotoyawata','京王・都営新宿線・橋本〜本八幡','けいおう・とえいしんじゅくせん','keio',TOEI,
  [leg(24002,'はしもと','ちょうふ'),leg(24001,'ちょうふ','ささづか'),leg(24001,'ささづか','しんじゅく',1),leg(99304,'しんじゅく','もとやわた')]),
 ('throughHanedaNarita','京急・浅草・京成線・羽田空港〜成田空港','けいきゅう・あさくさ・けいせいせん','keikyu',TOEI,
  [leg(27002,'はねだくうこうだいいちだいにたーみなる','けいきゅうかまた'),leg(27001,'けいきゅうかまた','せんがくじ'),leg(99302,'せんがくじ','おしあげ'),leg(23002,'おしあげ','けいせいたかさご'),leg(23006,'けいせいたかさご','なりたくうこう')]),
 ('throughEbinaShinjuku','相鉄・JR直通線・海老名〜新宿','そうてつ・JRちょくつうせん','sotetsuMain',SOTETSU,
  [leg(29001,'えびな','にしや'),leg(29003,'にしや','はざわよこはまこくだい'),connection(29003,'はざわよこはまこくだい',11333,'むさしこすぎ'),leg(11333,'むさしこすぎ','しんじゅく')]),
 ('throughShonandaiNishitakashimadaira','相鉄・東急・三田線・湘南台〜西高島平','そうてつ・とうきゅう・みたせん','sotetsuMain',TOEI,
  [leg(29002,'しょうなんだい','ふたまたがわ'),leg(29001,'ふたまたがわ','にしや')]+sotetsu_tokyu+[leg(26002,'ひよし','めぐろ'),leg(99303,'めぐろ','にしたかしまだいら')]),
 ('throughEbinaUrawamisono','相鉄・東急・南北・埼玉高速線・海老名〜浦和美園','そうてつ・とうきゅう・なんぼく・さいたまこうそくせん','sotetsuMain',SOTETSU,
  [leg(29001,'えびな','にしや')]+sotetsu_tokyu+[leg(26002,'ひよし','めぐろ'),leg(28009,'めぐろ','あかばねいわぶち'),leg(99307,'あかばねいわぶち','うらわみその')]),
 ('throughShonandaiWakoshi','相鉄・東急・副都心線・湘南台〜和光市','そうてつ・とうきゅう・ふくとしんせん','sotetsuMain',SOTETSU,
  [leg(29002,'しょうなんだい','ふたまたがわ'),leg(29001,'ふたまたがわ','にしや')]+sotetsu_tokyu+[leg(26001,'ひよし','しぶや'),leg(28010,'しぶや','わこうし')]),
 ('throughKawagoeShinkiba','川越・埼京・りんかい線・川越〜新木場','かわごえ・さいきょう・りんかいせん','saikyo','https://www.twr.co.jp/Portals/0/resources/route/traindetail2025/traindetail_0571.html',
  [leg(11322,'かわごえ','おおみや'),leg(11321,'おおみや','おおさき'),leg(99337,'おおさき','しんきば')]),
 ('throughMinohNakamozu','北大阪急行・御堂筋線・箕面萱野〜なかもず','きたおおさかきゅうこう・みどうすじせん',train_key(99618),'https://subway.osakametro.co.jp/station_guide/library/joukouichi/m_nakamozu.pdf',
  [leg(99614,'みのおかやの','えさか'),leg(99618,'えさか','なかもず')]),
 ('throughTengachayaKyoto','堺筋・阪急線・天下茶屋〜京都河原町','さかいすじ・はんきゅうせん',train_key(99623),'https://www.hankyu.co.jp/station/pdf/map_railway_kyoto.pdf',
  [leg(99623,'てんがちゃや','てんじんばしすじろくちょうめ'),leg(34008,'てんじんばしすじろくちょうめ','あわじ'),leg(34003,'あわじ','きょうとかわらまち')]),
 ('throughKobeNara','阪神・近鉄線・神戸三宮〜近鉄奈良','はんしん・きんてつせん',train_key(35002),'https://www.hanshin.co.jp/company/division/',
  [leg(35001,'さんのみや','あまがさき'),leg(35002,'あまがさき','おおさかなんば'),leg(31001,'おおさかなんば','おおさかうえほんまち'),leg(31005,'おおさかうえほんまち','ふせ'),leg(31020,'ふせ','きんてつなら')]),
 ('throughUmedaHimeji','阪神・神戸高速・山陽線・大阪梅田〜山陽姫路','はんしん・こうべこうそく・さんようせん',train_key(35001),'https://www.hanshin.co.jp/company/division/',
  [leg(35001,'おおさかうめだ','もとまち'),leg(99630,'もとまち','こうそくこうべ',1),leg(99630,'こうそくこうべ','にしだい'),leg(99637,'にしだい','さんようひめじ')]),
 ('throughKokusaikaikanNara','烏丸・近鉄線・国際会館〜近鉄奈良','からすま・きんてつせん',train_key(99610),'https://www2.city.kyoto.lg.jp/kotsu/webguide/ja/tika/tika_route_info.html',
  [leg(99610,'こくさいかいかん','たけだ'),leg(31025,'たけだ','きんてつなら')]),
 ('throughUzumasaHamaotsu','京都東西・京阪京津線・太秦天神川〜びわ湖浜大津','きょうととうざい・けいはんけいしんせん',train_key(33007),'https://www.city.kyoto.lg.jp/kotsu/page/0000204847.html',
  [leg(99611,'うずまさてんじんがわ','みささぎ'),leg(33007,'みささぎ','びわこはまおおつ')]),
 ('throughInuyamaToyotashi','名鉄・鶴舞線・犬山〜豊田市','めいてつ・つるまいせん',train_key(99516),'https://www.kotsu.city.nagoya.jp/rp/reader/trp0001103.htm',
  [leg(30015,'いぬやま','かみおたい'),leg(99516,'かみおたい','あかいけ'),leg(30006,'あかいけ','とよたし')]),
 ('throughHeiandoriInuyama','上飯田・名鉄小牧線・平安通〜犬山','かみいいだ・めいてつこまきせん',train_key(30018),'https://www.meitetsu.co.jp/train/timetable/',
  [leg(99518,'へいあんどおり','かみいいだ'),leg(30018,'かみいいだ','いぬやま')]),
 ('throughFukuokaNishikaratsu','福岡空港・筑肥線・福岡空港〜西唐津','ふくおかくうこう・ちくひせん',train_key(99905),'https://subway.city.fukuoka.lg.jp/',
  [leg(99905,'ふくおかくうこう','めいのはま'),leg(11909,'めいのはま','にしからつ')]),
 ('throughAtamiShimoda','伊東・伊豆急行線・熱海〜伊豆急下田','いとう・いずきゅうこうせん',train_key(99501),'https://www.izukyu.co.jp/fares/',
  [leg(11504,'あたみ','いとう'),leg(99501,'いとう','いずきゅうしもだ')]),
]
rows=[]
for key,title,name,train,source,legs in services:
    stations=[]; pairs=[]; members=set();codes=[]
    for part in legs:
        if isinstance(part,dict):
            start_code,start,code,end=part['connection'];segment=[station(start_code,start),station(code,end)]
            members.add(train_key(start_code));codes.append(start_code)
        else:
            code,start,end,index=part;line=lines[code]
            ids=config['paths'].get(str(code),[{'stations':line['stations']}])[index]['stations']
            segment=[db['stations'][str(s)] for s in ids if not db['stations'][str(s)][5]]
            a,b=station_index(segment,start),station_index(segment,end)
            segment=segment[a:b+1] if a<=b else list(reversed(segment[b:a+1]))
        assert len(segment)>1,(key,code)
        if stations:
            assert normalized(stations[-1][1])==normalized(segment[0][1]) and distance(stations[-1],segment[0])<1,(key,code,'disconnected')
        if 28000<code<29000:
            pairs.extend([[a[1],b[1]] for a,b in zip(segment,segment[1:])])
        stations.extend(segment[1:] if stations else segment)
        members.add(config['existingKeys'].get(str(code),'railLine'+str(code)))
        codes.append(code)
    points=[]; km=0
    for i,s in enumerate(stations):
        if i: km+=distance(stations[i-1],s)
        points.append([s[1],round(km,1),s[2],s[3]])
    if 21002 in codes: members.add('tobuSkytree')
    if 28005 in codes and 11320 in codes: members.add('jobanLocal')
    members.add(train)
    rows.append({'key':key,'title':title,'name':name,'trainKey':train,'source':source,'members':sorted(members),'sourceCodes':codes,
                 'regions':regions_for([s[4] for s in stations]),'stationNames':[s[0] for s in stations],'p':points,'tunnelPairs':pairs})
header='// Generated by tools/build-through-routes.py. Operational references: data/through-services.md.\n'
text=header+'(() => {\n  const data = window.TRAIN_GO_ROUTE_DATA;\n  const sources = '+json.dumps(rows,ensure_ascii=False,separators=(',',':'))+';\n'
text+='''  data.throughRoutes = sources;
  for (const item of sources) {
    const color = data.maps[item.trainKey]?.color || "#e87523";
    const stations = item.p.slice(1).map(([name,km]) => ({name,km}));
    stations.push({name:item.p[0][0],km:0});
    data.routes[item.key] = {name:item.name,start:item.p[0][0],startKm:0,stations,
      supportsExpress:false,allowCrossings:true,expressStops:new Set(),cityStations:new Set(),tunnelPairs:item.tunnelPairs};
    data.maps[item.key] = {name:item.name,color,points:item.p};
    data.metadata.push({key:item.key,name:item.name,color,trainKey:item.trainKey,kind:"rail",icon:"🔗",cars:10,speedKmh:95});
    data.routeCatalog[item.key] = {title:item.title,regions:item.regions,kind:"rail",through:true,
      search:[item.title,item.name,...item.stationNames,...item.p.map(p=>p[0])].join(" "),
      endpoints:`${item.p[0][0]} 〜 ${item.p.at(-1)[0]}`};
    data.allRailRouteKeys.push(item.key);
    data.stationLabelsByRoute[item.key] = Object.fromEntries(item.p.map((p,i)=>[p[0],item.stationNames[i].replace(/[（(].*?[)）]/g,"")]));
  }
})();
'''
(ROOT/'through-route-data.js').write_text(text,encoding='utf8',newline='\n')
print([(r['key'],len(r['p']),r['p'][-1][1]) for r in rows])
