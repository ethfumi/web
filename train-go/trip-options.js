(() => {
  "use strict";
  const STORAGE_KEY = "train-go-choices-v1";
  const RECENT_LIMIT = 10;
  const MODEL_LABELS = {
    nozomi:"N700系", hikari:"N700系", kodama:"N700系", doctoryellow:"923形",
    hayabusa:"E5系", yamabiko:"E5系", komachi:"E6系", blueGoldShinkansen:"E7・W7系",
    redShinkansen:"800系", orangeShinkansen:"N700S", purpleShinkansen:"E3系",
  };

  function createPreferences(storage, routes, trains) {
    let saved = {};
    try { saved = JSON.parse(storage.getItem(STORAGE_KEY) || "{}"); } catch {}
    if (!saved || typeof saved !== "object") saved = {};
    const validRecent = (values, records) => [...new Set(Array.isArray(values)
      ? values.filter(key => typeof key === "string" && Object.hasOwn(records, key)) : [])].slice(0, RECENT_LIMIT);
    const state = {
      nameMode:saved.nameMode === "kanji" ? "kanji" : "kana",
      routes:validRecent(saved.routes, routes), trains:validRecent(saved.trains, trains),
      coupling:validRecent(saved.coupling,trains).filter(key=>!['airplane','ferry','car'].includes(trains[key].kind)).slice(0,9),
      reverse:Object.fromEntries(Object.entries(saved.reverse || {}).filter(([key,value]) => Object.hasOwn(routes,key) && typeof value === "boolean")),
    };
    function save() {
      state.reverse = Object.fromEntries(state.routes.map(key => [key, Boolean(state.reverse[key])]));
      try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    }
    function remember(kind, key) {
      const records = kind === "routes" ? routes : trains;
      if (!Object.hasOwn(records, key)) return;
      state[kind] = [key, ...state[kind].filter(k => k !== key)].slice(0, RECENT_LIMIT);
      save();
    }
    return {state, save, remember};
  }

  function initialState(route, reverse) {
    const terminalIndex = route.terminalIndex ?? route.stations.length - 2;
    const backwards = Boolean(reverse && !route.loopKm);
    const station = backwards ? route.stations[terminalIndex] : {name:route.start, km:route.startKm};
    return {stationIdx:backwards ? terminalIndex : -1, routeDirection:backwards ? -1 : 1,
      currentLineKm:station.km, currentStationName:station.name};
  }

  function courseChoices(data, routeKey) {
    const candidates = [routeKey];
    const code = data.routeCatalog[routeKey]?.sourceCode;
    if (code) candidates.push(...Object.keys(data.routeCatalog).filter(key => data.routeCatalog[key].sourceCode === code));
    if (["keio", "keioSagamihara"].includes(routeKey)) candidates.push("keio", "keioSagamihara");
    for (const course of data.throughRoutes || []) {
      if (course.key === routeKey || course.members.includes(routeKey)) candidates.push(course.key);
    }
    return [...new Set(candidates)].filter(key => data.routes[key]);
  }

  function createNameResolver(data) {
    const hiragana=text=>String(text).normalize('NFKC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
    const kanaCorrections={
      'かこころざし々みなと':'かししみなと',
      'Okinawa line':'おきなわ こうろ','waiting room for high speed boat':'こうそくせん まちあいじょ',
      'Hi-NODE':'はいのーど','Urauchi River Pleasure Boat - Origin':'うらうちがわ ゆうらんせん のりば',
      'Urauchi River Pleasure Boat - Battleship Rock':'うらうちがわ ゆうらんせん ぐんかんいわ',
    };
    const kanaCache=new Map();
    const kana=text=>{
      if(kanaCache.has(text))return kanaCache.get(text);
      const original=text;
      for(const [from,to] of Object.entries(kanaCorrections))text=text.replaceAll(from,to);
      const value=hiragana(text).replaceAll('付近','ふきん');
      kanaCache.set(original,value);return value;
    };
    const placeLabels={
      あおもりけん:'青森県',いわてけん:'岩手県',みやぎけん:'宮城県',ふくしまけん:'福島県',
      とちぎけん:'栃木県',さいたまけん:'埼玉県',とうきょうと:'東京都',ちばけん:'千葉県',
      かながわけん:'神奈川県',しずおかけん:'静岡県',あいちけん:'愛知県',ぎふけん:'岐阜県',
      しがけん:'滋賀県',きょうとふ:'京都府',おおさかふ:'大阪府',びわこ:'琵琶湖',
      かすみがうら:'霞ヶ浦',いなわしろこ:'猪苗代湖',とうきょうわん:'東京湾',いせわん:'伊勢湾',
      きたかみがわ:'北上川',あぶくまがわ:'阿武隈川',とねがわ:'利根川',あらかわ:'荒川',
      すみだがわ:'隅田川',えどがわ:'江戸川',たまがわ:'多摩川',しなのがわ:'信濃川',
      きそがわ:'木曽川',よどがわ:'淀川','こうきょの おほり':'皇居のお堀',ふじさん:'富士山',たかおさん:'高尾山',
      こうきょ:'皇居',うえのこうえん:'上野公園',めいじじんぐう:'明治神宮','とうきょうたわー':'東京タワー',
    };
    const scoped={
      shonanShinjuku:{こうづ:'国府津',くき:'久喜',こが:'古河'},
      uenoTokyo:{こうづ:'国府津',くき:'久喜',こが:'古河'},
      keioSagamihara:{つつじがおか:'つつじヶ丘',けいおうよみうりらんど:'京王よみうりランド',けいおうたませんたー:'京王多摩センター'},
      jobanLocal:{かすみがせき:'霞ケ関',ゆしま:'湯島',あびこ:'我孫子'},sagami:{もんざわばし:'門沢橋'},
      tobuSkytree:{とうきょうすかいつりー:'とうきょうスカイツリー',どっきょうだいがくまえ:'獨協大学前'},
      airHonolulu:{ほのるるくうこう:'ホノルル空港'},airGuam:{ぐあむくうこう:'グアム空港'},
      ferrySeikan:{あおもりみなと:'青森港',はこだてみなと:'函館港'},
      ferryOgasawara:{とうきょうみなと:'東京港',ちちじま:'父島'},ferryTaiheiyo:{なごやみなと:'名古屋港'},
    };
    const unique = new Map(), ambiguous = new Set();
    const routeLabels={};
    for (const [key,labels] of Object.entries(data.stationLabelsByRoute || {})) for (const [reading,kanji] of Object.entries(labels)) {
      const normalized=hiragana(reading);
      (routeLabels[key] ||= {})[normalized]=kanji;
      if (unique.has(normalized) && unique.get(normalized) !== kanji) ambiguous.add(normalized);
      unique.set(normalized,kanji);
    }
    for (const kana of ambiguous) unique.delete(kana);
    const routeTitles = {akita:"秋田新幹線",yamagata:"山形新幹線",jobanLocal:"千代田線・常磐線",tobuSkytree:"東武スカイツリーライン",keio:"京王線"};
    return {
      kana,
      place:(name,mode)=>mode==='kanji'?placeLabels[hiragana(name)] || name:kana(name),
      model:(label,mode)=>mode==='kanji'?label:label.replaceAll('系','けい').replaceAll('形','がた'),
      station:(name,key,mode) => {
        if(mode!=='kanji')return kana(name);
        const near=name.endsWith('付近'),base=near?name.slice(0,-2):name,normalized=hiragana(base);
        return (scoped[key]?.[normalized] || routeLabels[key]?.[normalized] || unique.get(normalized) || base)+(near?'付近':'');
      },
      route:(key,mode) => mode === "kanji" ? routeTitles[key] || data.routeCatalog[key]?.title || data.routes[key]?.name || key : kana(data.routes[key]?.name || key),
    };
  }

  window.TRAIN_GO_TRIP_OPTIONS = {createPreferences, initialState, courseChoices, createNameResolver, MODEL_LABELS, RECENT_LIMIT};
})();
