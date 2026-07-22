// つなげて！でんしゃ！ — 3歳向けでんしゃアプリ
// 文字が読めなくても遊べる・失敗がない・タップで必ず反応する、を設計原則とする。

(() => {
  "use strict";

  const isDebug = new URLSearchParams(location.search).has("debug");

  // ---- 車両定義 ----
  const TRAINS = {
    nozomi: {
      name: "しろいしんかんせん",
      body: "#f8f8f8",
      stripe: "#1c48a6",
      edge: "#c8c8c8",
      callName: "しろいしんかんせん",
    },
    doctoryellow: {
      name: "きいろいけんさしゃ",
      body: "#ffd900",
      stripe: "#1c48a6",
      edge: "#d4b400",
      callName: "きいろいけんさしゃ",
    },
    hayabusa: {
      name: "みどりのしんかんせん",
      body: "#f7f5ed",
      upper: "#36a995",
      stripe: "#e73d8f",
      edge: "#218b7a",
      callName: "みどりのしんかんせん",
    },
    komachi: {
      name: "あかいしんかんせん",
      body: "#ef3340",
      stripe: "#b7b7b7",
      edge: "#b51f2a",
      callName: "あかいしんかんせん",
    },
    yamanote: {
      name: "みどりのでんしゃ", kind: "commuter", body: "#e8ecef", stripe: "#9acd32",
      face: "#9acd32", edge: "#aeb8be", callName: "みどりのでんしゃ",
    },
    inokashira: {
      name: "むらさきのでんしゃ", kind: "commuter", body: "#eef1f2", stripe: "#6f4aa8",
      face: "#6f4aa8", edge: "#aeb8be", callName: "むらさきのでんしゃ",
    },
    tozai: {
      name: "みずいろのでんしゃ", kind: "commuter", body: "#e8ecef", stripe: "#32a5d2", stripe2: "#2362a8",
      face: "#3085cc", edge: "#aeb8be", callName: "みずいろのでんしゃ",
    },
    sobu: {
      name: "きいろのでんしゃ", kind: "commuter", body: "#e8ecef", stripe: "#f0c928",
      face: "#f0c928", edge: "#aeb8be", callName: "きいろのでんしゃ",
    },
    chuo: {
      name: "オレンジのでんしゃ", kind: "commuter", body: "#e8ecef", stripe: "#f28c28",
      face: "#f28c28", edge: "#aeb8be", callName: "オレンジのでんしゃ",
    },
    keio: {
      name: "あかとあおのでんしゃ", kind: "commuter", body: "#e8ecef", stripe: "#d31359", stripe2: "#174f9a",
      face: "#d31359", edge: "#aeb8be", callName: "あかとあおのでんしゃ",
    },
  };

  const CAR_COUNT_WORDS = [
    "いちりょう", "にりょう", "さんりょう", "よんりょう", "ごりょう",
    "ろくりょう", "ななりょう", "はちりょう", "きゅうりょう", "じゅうりょう",
  ];
  const MAX_CARS = 100;
  const KEIO_SAGAMIHARA_CHANCE = 1 / 3;
  const KEIO_SAGAMIHARA_BRANCH_STATIONS = new Set([
    "けいおうたまがわ", "けいおういなだづつみ", "けいおうよみうりランド", "いなぎ",
    "わかばだい", "けいおうながやま", "けいおうたまセンター", "けいおうほりのうち",
    "みなみおおさわ", "たまさかい", "はしもと",
  ]);
  const KOMACHI_COUPLING_STATIONS = {
    tohoku: "もりおか",
  };

  // 11両以降は「11りょう」表記でも日本語 TTS が「じゅういちりょう」と読んでくれる
  function carWord(n) {
    return n <= CAR_COUNT_WORDS.length ? CAR_COUNT_WORDS[n - 1] : `${n}りょう`;
  }

  const PIXELS_PER_METER = 12;
  const KMH_PER_MPS = 3.6;
  const SPEED_DISPLAY_SCALE = KMH_PER_MPS / PIXELS_PER_METER;
  const DEPARTURE_SPEED_KMH = 30;
  const BASE_TAP_BOOST_KMH = 5;
  const PASSENGER_TAP_BONUS_KMH = 1;
  const DEPARTURE_SPEED_PX_PER_SEC = DEPARTURE_SPEED_KMH / SPEED_DISPLAY_SCALE;
  const STAR_SPAWN_MIN_SECONDS = 9;
  const FALLING_STAR_TYPES = [
    {
      key: "gold", weights: { day: 70, sunset: 40, night: 20 }, multiplier: 2, seconds: 5, scale: 1, speed: 1, trailScale: 1,
      icon: "🌟", name: "きいろいほし", fill: "#ffd83d", inner: "#fff7b2",
      glow: "#fff08a", trail: "255,232,92", badge: "#fff8cc", accent: "#f2a51f", text: "#c15f00",
    },
    {
      key: "green", weight: 20, multiplier: 4, seconds: 6, scale: 2 / 3, speed: 2, trailScale: 1.8,
      icon: "💫", name: "みどりのほし", fill: "#62e687", inner: "#d7ffe0",
      glow: "#8dffac", trail: "98,230,135", badge: "#ddffe6", accent: "#31ad58", text: "#137132",
    },
    {
      key: "blue", weight: 9, multiplier: 6, seconds: 7, scale: 1 / 2, speed: 3, trailScale: 3,
      icon: "🔵", name: "あおいほし", fill: "#48a9ff", inner: "#d9f2ff",
      glow: "#72c7ff", trail: "72,169,255", badge: "#dff3ff", accent: "#2789df", text: "#135b9b",
    },
    {
      key: "rainbow", weight: 1, multiplier: 10, seconds: 8, scale: 1 / 3, speed: 4, trailScale: 5.4,
      icon: "🌈", name: "にじいろのほし", fill: "#ff5b73", inner: "#ffffff",
      glow: "#ffffff", trail: "255,91,115", badge: "#f4e8ff", accent: "#9b51e0", text: "#63319b",
    },
  ];
  const SKY_PALETTES = {
    day: ["#8fd4ff", "#d8f2ff", "#c2ecb0"],
    sunset: ["#715d9d", "#ff9d73", "#f4c77b"],
    night: ["#101b4c", "#263c72", "#49678a"],
  };
  const BUILDING_COLORS = ["#d6c4ab", "#c6d6df", "#e0b9a8", "#bcc9a8"];
  const ROOF_COLORS = ["#b84f43", "#4f6e7d", "#8a6847"];
  const FRICTION_PX_PER_SEC2 = 18;       // 自然減速は小さく、連打の加速感を残す
  const AUTO_ACCEL_PX_PER_SEC2 = 40;     // 自動運転は遊びやすい時間に圧縮しつつ滑らかに加速
  const AUTO_OVERSPEED_DECEL_PX_PER_SEC2 = 90;
  const ROUTE_COLORS = {
    chuo: "#f28c28", tokaido: "#2362b8", tohoku: "#2a9b82",
    sobu: "#f0c928", tozai: "#3085cc", inokashira: "#8156a6", keio: "#d31359", yamanote: "#9acd32",
  };
  const {
    maps: ROUTE_MAPS,
    drawOrder: MAP_ROUTE_DRAW_ORDER,
    laneOffsets: MAP_ROUTE_LANE_OFFSETS,
    geography: MAP_GEOGRAPHY,
  } = window.TRAIN_GO_MAP_DATA;
  // 地図投影の基準は首都圏。路線・地形の座標本体は map-data.js に置く。
  const YAMANOTE_MAP_BOUNDS = { minLon: 139.689, maxLon: 139.791, minLat: 35.609, maxLat: 35.748 };
  const YAMANOTE_MAP_LANDMARKS = [
    { icon: "🏯", name: "こうきょ", lon: 139.7528, lat: 35.6852 },
    { icon: "🌳", name: "うえのこうえん", lon: 139.7730, lat: 35.7167 },
    { icon: "🌲", name: "めいじじんぐう", lon: 139.6993, lat: 35.6764 },
    { icon: "🗼", name: "とうきょうタワー", lon: 139.7454, lat: 35.6586 },
    { icon: "🌊", name: "とうきょうわん", lon: 139.7780, lat: 35.6310 },
  ];
  const MAP_METERS_PER_LATITUDE = 111320;
  const MAP_REFERENCE_LATITUDE = (YAMANOTE_MAP_BOUNDS.minLat + YAMANOTE_MAP_BOUNDS.maxLat) / 2;
  const MAP_METERS_PER_LONGITUDE = MAP_METERS_PER_LATITUDE * Math.cos(MAP_REFERENCE_LATITUDE * Math.PI / 180);
  const MAP_REFERENCE_LONGITUDE = (YAMANOTE_MAP_BOUNDS.minLon + YAMANOTE_MAP_BOUNDS.maxLon) / 2;
  const YAMANOTE_MAP_GRID_LINES = [];
  for (let lon = 139.65; lon <= 139.83; lon += 0.01) {
    YAMANOTE_MAP_GRID_LINES.push([[lon, 35.58], [lon, 35.79]]);
  }
  for (let lat = 35.58; lat <= 35.79; lat += 0.01) {
    YAMANOTE_MAP_GRID_LINES.push([[139.65, lat], [139.83, lat]]);
  }
  const ROUTE_AUTO_SPEED_KMH = {
    chuo: 100, tokaido: 285, tohoku: 320, sobu: 95,
    tozai: 100, inokashira: 90, keio: 110, yamanote: 90,
  };
  const GRAND_STATIONS = new Set(["とうきょう", "しんじゅく", "しぶや", "しんおおさか"]);
  const MAJOR_STATIONS = new Set([
    "しながわ", "しんよこはま", "なごや", "きょうと", "うえの", "おおみや",
    "せんだい", "もりおか", "しんあおもり", "きちじょうじ", "みたか",
    "たちかわ", "はちおうじ", "たかお", "なかの", "おおてまち", "にしふなばし",
    "ちょうふ", "ふちゅう", "けいおうはちおうじ", "けいおうたまセンター", "はしもと",
  ]);
  function segmentKey(stationA, stationB) {
    return [stationA, stationB].sort().join("::");
  }

  function makeSegmentSet(pairs) {
    return new Set(pairs.map(([stationA, stationB]) => segmentKey(stationA, stationB)));
  }

  // 実際に地下またはトンネルがある駅間だけ。駅間の一部がトンネルの場合も含む。
  const TUNNEL_SEGMENTS = {
    tokaido: makeSegmentSet([
      ["しながわ", "しんよこはま"], ["しんよこはま", "おだわら"],
      ["おだわら", "あたみ"], ["あたみ", "みしま"],
      ["しんふじ", "しずおか"], ["しずおか", "かけがわ"],
      ["かけがわ", "はままつ"], ["とよはし", "みかわあんじょう"],
      ["ぎふはしま", "まいばら"], ["まいばら", "きょうと"],
    ]),
    tohoku: makeSegmentSet([
      ["とうきょう", "うえの"], ["うえの", "おおみや"],
      ["うつのみや", "なすしおばら"], ["なすしおばら", "しんしらかわ"],
      ["しんしらかわ", "こおりやま"], ["こおりやま", "ふくしま"],
      ["ふくしま", "しろいしざおう"], ["しろいしざおう", "せんだい"],
      ["せんだい", "ふるかわ"], ["ふるかわ", "くりこまこうげん"],
      ["くりこまこうげん", "いちのせき"], ["いちのせき", "みずさわえさし"],
      ["きたかみ", "しんはなまき"],
      ["もりおか", "いわてぬまくない"], ["いわてぬまくない", "にのへ"],
      ["にのへ", "はちのへ"], ["はちのへ", "しちのへとわだ"],
      ["しちのへとわだ", "しんあおもり"],
    ]),
    tozai: makeSegmentSet([
      ["なかの", "おちあい"], ["おちあい", "たかだのばば"],
      ["たかだのばば", "わせだ"], ["わせだ", "かぐらざか"],
      ["かぐらざか", "いいだばし"], ["いいだばし", "くだんした"],
      ["くだんした", "たけばし"], ["たけばし", "おおてまち"],
      ["おおてまち", "にほんばし"], ["にほんばし", "かやばちょう"],
      ["かやばちょう", "もんぜんなかちょう"], ["もんぜんなかちょう", "きば"],
      ["きば", "とうようちょう"], ["とうようちょう", "みなみすなまち"],
      ["みなみすなまち", "にしかさい"],
    ]),
    inokashira: makeSegmentSet([
      ["しぶや", "しんせん"],
      ["しんせん", "こまばとうだいまえ"],
    ]),
    keio: makeSegmentSet([
      ["しんじゅく", "ささづか"],
      ["しばさき", "こくりょう"], ["こくりょう", "ふだ"],
      ["ふだ", "ちょうふ"], ["ちょうふ", "にしちょうふ"],
      ["ちょうふ", "けいおうたまがわ"],
      ["きたの", "けいおうはちおうじ"],
    ]),
  };
  const UNDERGROUND_STATIONS = {
    inokashira: new Set(["しんせん"]),
    keio: new Set(["しんじゅく"]),
  };

  // 駅間距離は各路線の営業キロを使う。山手線は周回し、ほかの路線は終点で折り返す。
  const ROUTES = {
    chuo: {
      name: "ちゅうおうせん",
      start: "とうきょう",
      startKm: 0,
      supportsExpress: true,
      expressLabel: "とっかい",
      expressModeName: "ちゅうおうとっかい",
      expressAnnouncement: "ちゅうおうとっかいモード！しんじゅく、きちじょうじ、みたか、こくぶんじ、たちかわにとまって、たかおへいきます",
      allowCrossings: true,
      stations: [
        { name: "かんだ", km: 1.3 }, { name: "おちゃのみず", km: 2.6 },
        { name: "よつや", km: 6.6 }, { name: "しんじゅく", km: 10.3 },
        { name: "なかの", km: 14.7 }, { name: "こうえんじ", km: 16.1 },
        { name: "あさがや", km: 17.3 }, { name: "おぎくぼ", km: 18.7 },
        { name: "にしおぎくぼ", km: 20.6 }, { name: "きちじょうじ", km: 22.5 },
        { name: "みたか", km: 24.1 }, { name: "むさしさかい", km: 25.7 },
        { name: "ひがしこがねい", km: 27.4 }, { name: "むさしこがねい", km: 29.1 },
        { name: "こくぶんじ", km: 31.4 }, { name: "にしこくぶんじ", km: 32.8 },
        { name: "くにたち", km: 34.5 }, { name: "たちかわ", km: 37.5 },
        { name: "ひの", km: 40.8 }, { name: "とよだ", km: 43.1 },
        { name: "はちおうじ", km: 47.4 }, { name: "にしはちおうじ", km: 49.8 },
        { name: "たかお", km: 53.1 }, { name: "とうきょう", km: 0 },
      ],
      expressStops: new Set([
        "とうきょう", "かんだ", "おちゃのみず", "よつや", "しんじゅく", "なかの",
        "きちじょうじ", "みたか", "こくぶんじ", "たちかわ", "ひの", "とよだ",
        "はちおうじ", "にしはちおうじ", "たかお",
      ]),
      cityStations: new Set([
        "とうきょう", "かんだ", "おちゃのみず", "よつや", "しんじゅく", "なかの",
        "こうえんじ", "あさがや", "おぎくぼ", "にしおぎくぼ", "きちじょうじ", "みたか",
        "たちかわ", "はちおうじ", "にしはちおうじ",
      ]),
    },
    tokaido: {
      name: "とうかいどうしんかんせん",
      start: "とうきょう",
      startKm: 0,
      supportsExpress: true,
      expressLabel: "とっきゅう",
      expressModeName: "とっきゅう",
      expressAnnouncement: "とっきゅうモード！しながわ、しんよこはま、なごや、きょうとにとまって、しんおおさかへいきます",
      allowCrossings: false,
      stations: [
        { name: "しながわ", km: 6.8 }, { name: "しんよこはま", km: 28.8 },
        { name: "おだわら", km: 83.9 }, { name: "あたみ", km: 104.6 },
        { name: "みしま", km: 120.7 }, { name: "しんふじ", km: 146.2 },
        { name: "しずおか", km: 180.2 }, { name: "かけがわ", km: 229.3 },
        { name: "はままつ", km: 257.1 }, { name: "とよはし", km: 293.6 },
        { name: "みかわあんじょう", km: 336.3 }, { name: "なごや", km: 366.0 },
        { name: "ぎふはしま", km: 396.3 }, { name: "まいばら", km: 445.9 },
        { name: "きょうと", km: 513.6 }, { name: "しんおおさか", km: 552.6 },
        { name: "とうきょう", km: 0 },
      ],
      expressStops: new Set(["とうきょう", "しながわ", "しんよこはま", "なごや", "きょうと", "しんおおさか"]),
      cityStations: new Set(["とうきょう", "しながわ", "しんよこはま", "なごや", "きょうと", "しんおおさか"]),
    },
    tohoku: {
      name: "とうほくしんかんせん",
      start: "とうきょう",
      startKm: 0,
      supportsExpress: true,
      expressLabel: "とっきゅう",
      expressModeName: "とっきゅう",
      expressAnnouncement: "とっきゅうモード！うえの、おおみや、せんだい、もりおか、はちのへにとまって、しんあおもりへいきます",
      allowCrossings: false,
      stations: [
        { name: "うえの", km: 3.6 }, { name: "おおみや", km: 30.3 },
        { name: "おやま", km: 80.6 }, { name: "うつのみや", km: 109.5 },
        { name: "なすしおばら", km: 157.8 }, { name: "しんしらかわ", km: 185.4 },
        { name: "こおりやま", km: 226.7 }, { name: "ふくしま", km: 272.8 },
        { name: "しろいしざおう", km: 306.8 }, { name: "せんだい", km: 351.8 },
        { name: "ふるかわ", km: 395.0 }, { name: "くりこまこうげん", km: 416.2 },
        { name: "いちのせき", km: 445.1 }, { name: "みずさわえさし", km: 470.1 },
        { name: "きたかみ", km: 487.5 }, { name: "しんはなまき", km: 500.0 },
        { name: "もりおか", km: 535.3 }, { name: "いわてぬまくない", km: 566.4 },
        { name: "にのへ", km: 601.0 }, { name: "はちのへ", km: 631.9 },
        { name: "しちのへとわだ", km: 668.0 }, { name: "しんあおもり", km: 713.7 },
        { name: "とうきょう", km: 0 },
      ],
      expressStops: new Set(["とうきょう", "うえの", "おおみや", "せんだい", "もりおか", "はちのへ", "しんあおもり"]),
      cityStations: new Set(["とうきょう", "うえの", "おおみや", "せんだい", "もりおか", "しんあおもり"]),
    },
    sobu: {
      name: "そうぶせん",
      start: "みたか",
      startKm: 0,
      supportsExpress: false,
      allowCrossings: true,
      stations: [
        { name: "きちじょうじ", km: 1.6 }, { name: "にしおぎくぼ", km: 3.5 },
        { name: "おぎくぼ", km: 5.4 }, { name: "あさがや", km: 6.8 },
        { name: "こうえんじ", km: 8.0 }, { name: "なかの", km: 9.4 },
        { name: "ひがしなかの", km: 10.6 }, { name: "おおくぼ", km: 11.3 },
        { name: "しんじゅく", km: 13.8 }, { name: "よよぎ", km: 14.5 },
        { name: "せんだがや", km: 15.5 }, { name: "しなのまち", km: 16.2 },
        { name: "よつや", km: 17.5 }, { name: "いちがや", km: 18.3 },
        { name: "いいだばし", km: 19.8 }, { name: "すいどうばし", km: 20.7 },
        { name: "おちゃのみず", km: 21.5 }, { name: "あきはばら", km: 22.4 },
        { name: "あさくさばし", km: 23.5 }, { name: "りょうごく", km: 24.3 },
        { name: "きんしちょう", km: 25.8 }, { name: "かめいど", km: 27.3 },
        { name: "ひらい", km: 29.2 }, { name: "しんこいわ", km: 31.0 },
        { name: "こいわ", km: 33.8 }, { name: "いちかわ", km: 36.4 },
        { name: "もとやわた", km: 38.4 }, { name: "しもうさなかやま", km: 40.0 },
        { name: "にしふなばし", km: 41.6 }, { name: "ふなばし", km: 44.2 },
        { name: "ひがしふなばし", km: 46.0 }, { name: "つだぬま", km: 47.7 },
        { name: "まくはりほんごう", km: 50.6 }, { name: "まくはり", km: 52.7 },
        { name: "しんけみがわ", km: 54.3 }, { name: "いなげ", km: 57.0 },
        { name: "にしちば", km: 58.8 }, { name: "ちば", km: 60.2 },
        { name: "みたか", km: 0 },
      ],
      expressStops: new Set(),
      cityStations: new Set(["みたか", "きちじょうじ", "なかの", "しんじゅく", "あきはばら", "きんしちょう", "ふなばし", "ちば"]),
    },
    tozai: {
      name: "とうざいせん",
      start: "なかの",
      startKm: 0,
      supportsExpress: true,
      expressLabel: "かいそく",
      expressModeName: "とうざいせんかいそく",
      expressAnnouncement: "とうざいせん、かいそくモード！とうようちょうから、うらやすまで、ぐーんととばします",
      allowCrossings: false,
      stations: [
        { name: "おちあい", km: 2.0 }, { name: "たかだのばば", km: 3.9 },
        { name: "わせだ", km: 6.0 }, { name: "かぐらざか", km: 7.2 },
        { name: "いいだばし", km: 8.4 }, { name: "くだんした", km: 9.1 },
        { name: "たけばし", km: 10.1 }, { name: "おおてまち", km: 11.1 },
        { name: "にほんばし", km: 12.4 }, { name: "かやばちょう", km: 12.9 },
        { name: "もんぜんなかちょう", km: 14.7 }, { name: "きば", km: 16.0 },
        { name: "とうようちょう", km: 17.1 }, { name: "みなみすなまち", km: 18.3 },
        { name: "にしかさい", km: 21.3 }, { name: "かさい", km: 22.5 },
        { name: "うらやす", km: 24.4 }, { name: "みなみぎょうとく", km: 25.6 },
        { name: "ぎょうとく", km: 27.0 }, { name: "みょうでん", km: 28.3 },
        { name: "ばらきなかやま", km: 30.0 }, { name: "にしふなばし", km: 30.8 },
        { name: "なかの", km: 0 },
      ],
      expressStops: new Set([
        "なかの", "おちあい", "たかだのばば", "わせだ", "かぐらざか", "いいだばし",
        "くだんした", "たけばし", "おおてまち", "にほんばし", "かやばちょう",
        "もんぜんなかちょう", "きば", "とうようちょう", "うらやす", "にしふなばし",
      ]),
      cityStations: new Set(["なかの", "たかだのばば", "おおてまち", "にほんばし", "とうようちょう", "にしふなばし"]),
    },
    inokashira: {
      name: "いのかしらせん",
      start: "しぶや",
      startKm: 0,
      supportsExpress: true,
      expressLabel: "きゅうこう",
      expressModeName: "いのかしらせんきゅうこう",
      expressAnnouncement: "いのかしらせん、きゅうこうモード！しもきたざわ、めいだいまえ、えいふくちょう、くがやまにとまって、きちじょうじへいきます",
      allowCrossings: true,
      stations: [
        { name: "しんせん", km: 0.5 }, { name: "こまばとうだいまえ", km: 1.4 },
        { name: "いけのうえ", km: 2.4 }, { name: "しもきたざわ", km: 3.0 },
        { name: "しんだいた", km: 3.5 }, { name: "ひがしまつばら", km: 4.0 },
        { name: "めいだいまえ", km: 4.9 }, { name: "えいふくちょう", km: 6.0 },
        { name: "にしえいふく", km: 6.7 }, { name: "はまだやま", km: 7.5 },
        { name: "たかいど", km: 8.7 }, { name: "ふじみがおか", km: 9.4 },
        { name: "くがやま", km: 10.2 }, { name: "みたかだい", km: 11.2 },
        { name: "いのかしらこうえん", km: 12.1 }, { name: "きちじょうじ", km: 12.7 },
        { name: "しぶや", km: 0 },
      ],
      expressStops: new Set(["しぶや", "しもきたざわ", "めいだいまえ", "えいふくちょう", "くがやま", "きちじょうじ"]),
      cityStations: new Set(["しぶや", "しもきたざわ", "めいだいまえ", "えいふくちょう", "きちじょうじ"]),
    },
    keio: {
      name: "けいおうせん",
      start: "しんじゅく",
      startKm: 0,
      supportsExpress: true,
      expressLabel: "とっきゅう",
      expressModeName: "けいおうせんとっきゅう",
      expressAnnouncement: "けいおうせん、とっきゅうモード！ささづか、めいだいまえ、ちとせからすやま、ちょうふ、ふちゅう、ぶばいがわら、せいせきさくらがおか、たかはたふどう、きたのにとまって、けいおうはちおうじへいきます",
      allowCrossings: true,
      stations: [
        { name: "ささづか", km: 3.6 }, { name: "だいたばし", km: 4.4 },
        { name: "めいだいまえ", km: 5.2 }, { name: "しもたかいど", km: 6.1 },
        { name: "さくらじょうすい", km: 7.0 }, { name: "かみきたざわ", km: 7.8 },
        { name: "はちまんやま", km: 8.4 }, { name: "ろかこうえん", km: 9.1 },
        { name: "ちとせからすやま", km: 9.9 }, { name: "せんがわ", km: 11.5 },
        { name: "つつじがおか", km: 12.5 }, { name: "しばさき", km: 13.3 },
        { name: "こくりょう", km: 14.2 }, { name: "ふだ", km: 14.9 },
        { name: "ちょうふ", km: 15.5 }, { name: "にしちょうふ", km: 17.0 },
        { name: "とびたきゅう", km: 17.7 }, { name: "むさしのだい", km: 18.8 },
        { name: "たまれいえん", km: 19.6 }, { name: "ひがしふちゅう", km: 20.4 },
        { name: "ふちゅう", km: 21.9 }, { name: "ぶばいがわら", km: 23.1 },
        { name: "なかがわら", km: 24.7 }, { name: "せいせきさくらがおか", km: 26.3 },
        { name: "もぐさえん", km: 28.0 }, { name: "たかはたふどう", km: 29.7 },
        { name: "みなみだいら", km: 32.1 }, { name: "ひらやまじょうしこうえん", km: 33.4 },
        { name: "ながぬま", km: 34.9 }, { name: "きたの", km: 36.1 },
        { name: "けいおうはちおうじ", km: 37.9 }, { name: "しんじゅく", km: 0 },
      ],
      expressStops: new Set([
        "しんじゅく", "ささづか", "めいだいまえ", "ちとせからすやま", "ちょうふ",
        "ふちゅう", "ぶばいがわら", "せいせきさくらがおか", "たかはたふどう",
        "きたの", "けいおうはちおうじ",
      ]),
      cityStations: new Set([
        "しんじゅく", "ささづか", "めいだいまえ", "ちとせからすやま", "ちょうふ",
        "ふちゅう", "ぶばいがわら", "せいせきさくらがおか", "たかはたふどう",
        "きたの", "けいおうはちおうじ",
      ]),
    },
    keioSagamihara: {
      name: "けいおうさがみはらせん",
      start: "しんじゅく",
      startKm: 0,
      supportsExpress: true,
      expressLabel: "とっきゅう",
      expressModeName: "けいおうせんとっきゅう",
      expressAnnouncement: "けいおうせん、とっきゅうモード！ささづか、めいだいまえ、ちとせからすやま、ちょうふ、けいおういなだづつみ、けいおうながやま、けいおうたまセンター、みなみおおさわにとまって、はしもとへいきます",
      allowCrossings: true,
      variant: "hashimoto",
      stations: [
        { name: "ささづか", km: 3.6 }, { name: "だいたばし", km: 4.4 },
        { name: "めいだいまえ", km: 5.2 }, { name: "しもたかいど", km: 6.1 },
        { name: "さくらじょうすい", km: 7.0 }, { name: "かみきたざわ", km: 7.8 },
        { name: "はちまんやま", km: 8.4 }, { name: "ろかこうえん", km: 9.1 },
        { name: "ちとせからすやま", km: 9.9 }, { name: "せんがわ", km: 11.5 },
        { name: "つつじがおか", km: 12.5 }, { name: "しばさき", km: 13.3 },
        { name: "こくりょう", km: 14.2 }, { name: "ふだ", km: 14.9 },
        { name: "ちょうふ", km: 15.5 }, { name: "けいおうたまがわ", km: 16.7 },
        { name: "けいおういなだづつみ", km: 18.0 }, { name: "けいおうよみうりランド", km: 19.4 },
        { name: "いなぎ", km: 21.0 }, { name: "わかばだい", km: 24.3 },
        { name: "けいおうながやま", km: 26.9 }, { name: "けいおうたまセンター", km: 29.2 },
        { name: "けいおうほりのうち", km: 31.5 }, { name: "みなみおおさわ", km: 33.8 },
        { name: "たまさかい", km: 35.6 }, { name: "はしもと", km: 38.1 },
        { name: "しんじゅく", km: 0 },
      ],
      expressStops: new Set([
        "しんじゅく", "ささづか", "めいだいまえ", "ちとせからすやま", "ちょうふ",
        "けいおういなだづつみ", "けいおうながやま", "けいおうたまセンター",
        "みなみおおさわ", "はしもと",
      ]),
      cityStations: new Set([
        "しんじゅく", "ささづか", "めいだいまえ", "ちとせからすやま", "ちょうふ",
        "けいおうたまセンター", "みなみおおさわ", "はしもと",
      ]),
    },
    yamanote: {
      name: "やまのてせん",
      start: "とうきょう",
      startKm: 0,
      supportsExpress: false,
      allowCrossings: false,
      loopKm: 34.5,
      terminalIndex: 29,
      stations: [
        { name: "ゆうらくちょう", km: 0.8 }, { name: "しんばし", km: 1.9 },
        { name: "はままつちょう", km: 3.1 }, { name: "たまち", km: 4.6 },
        { name: "たかなわゲートウェイ", km: 5.9 }, { name: "しながわ", km: 6.8 },
        { name: "おおさき", km: 8.8 }, { name: "ごたんだ", km: 9.7 },
        { name: "めぐろ", km: 10.9 }, { name: "えびす", km: 12.4 },
        { name: "しぶや", km: 14.0 }, { name: "はらじゅく", km: 15.2 },
        { name: "よよぎ", km: 16.7 }, { name: "しんじゅく", km: 17.4 },
        { name: "しんおおくぼ", km: 18.7 }, { name: "たかだのばば", km: 20.1 },
        { name: "めじろ", km: 21.0 }, { name: "いけぶくろ", km: 22.2 },
        { name: "おおつか", km: 24.0 }, { name: "すがも", km: 25.1 },
        { name: "こまごめ", km: 25.8 }, { name: "たばた", km: 27.4 },
        { name: "にしにっぽり", km: 28.2 }, { name: "にっぽり", km: 28.7 },
        { name: "うぐいすだに", km: 29.8 }, { name: "うえの", km: 30.9 },
        { name: "おかちまち", km: 31.5 }, { name: "あきはばら", km: 32.5 },
        { name: "かんだ", km: 33.2 }, { name: "とうきょう", km: 34.5 },
      ],
      expressStops: new Set(),
      cityStations: new Set([
        "とうきょう", "ゆうらくちょう", "しんばし", "はままつちょう", "たまち",
        "たかなわゲートウェイ", "しながわ", "おおさき", "ごたんだ", "めぐろ",
        "えびす", "しぶや", "はらじゅく", "よよぎ", "しんじゅく", "しんおおくぼ",
        "たかだのばば", "めじろ", "いけぶくろ", "おおつか", "すがも", "こまごめ",
        "たばた", "にしにっぽり", "にっぽり", "うぐいすだに", "うえの",
        "おかちまち", "あきはばら", "かんだ",
      ]),
    },
  };

  const STATION_CELEBRATIONS = {
    chuo: {
      "たかお": {
        banner: "⛰️ やまの えきだ！",
        announcement: "おおきなやまと、みどりがいっぱいだよ！",
        symbols: ["⛰️", "🌲", "🐿️"],
        stamp: "⛰️",
      },
    },
    sobu: {
      "ちば": {
        banner: "🚝 そらをはしる でんしゃ！",
        announcement: "そらをはしるモノレールがみえるよ！",
        symbols: ["☁️", "🚝", "☁️"],
        stamp: "🚝",
      },
    },
    tozai: {
      "かさい": {
        banner: "🚇 ちかてつの はくぶつかん！",
        announcement: "ちかてつがいっぱいの、はくぶつかんがあるまちだよ！",
        symbols: ["🚇", "⚙️", "🎫"],
        stamp: "🚇",
      },
    },
    inokashira: {
      "きちじょうじ": {
        banner: "🌳 こうえんの まち！",
        announcement: "おおきなこうえんと、みずどりがいるまちだよ！",
        symbols: ["🌳", "🦆", "🌼"],
        stamp: "🌳",
      },
    },
    keio: {
      "けいおうたまセンター": {
        banner: "🌈 ゆめいっぱいの まち！",
        announcement: "にじとほしがきらきら、ゆめいっぱいのまちだよ！",
        symbols: ["🌈", "⭐", "🎈"],
        stamp: "🌈",
      },
    },
    yamanote: {
      "うえの": {
        banner: "🐼 どうぶつの まち！",
        announcement: "どうぶつたちが、いっぱいのまちだよ！",
        symbols: ["🐼", "🦁", "🐘"],
        stamp: "🐼",
      },
    },
  };

  function stationCelebrationFor(name) {
    return STATION_CELEBRATIONS[selectedRouteKey]?.[name] || null;
  }

  function routeForGameStart() {
    if (selectedRouteKey !== "keio") return ROUTES[selectedRouteKey];
    const params = new URLSearchParams(location.search);
    const forcedKeioRoute = params.has("debug") ? params.get("keio") : "";
    if (forcedKeioRoute === "hashimoto") return ROUTES.keioSagamihara;
    if (forcedKeioRoute === "hachioji") return ROUTES.keio;
    return Math.random() < KEIO_SAGAMIHARA_CHANCE ? ROUTES.keioSagamihara : ROUTES.keio;
  }

  function stationNamesForRoute(route) {
    return [route.start, ...route.stations.map((station) => station.name)]
      .filter((name, index, names) => names.indexOf(name) === index);
  }

  const ALL_ROUTE_STATION_NAMES = [...new Set(
    Object.values(ROUTES).flatMap((route) => stationNamesForRoute(route)),
  )];
  const PASSENGER_POOL = [
    "🧒", "👧", "👦", "👩", "👨", "👵", "👴",
    "🐰", "🐻", "🐧", "🐶", "🐱", "🦊", "🐼",
  ];

  const OPPOSING_TRAIN_TYPES = {
    yamanote: { name: "みどりのでんしゃ", kind: "local", cars: 11, speedKmh: 90, body: "#e8ecef", stripe: "#9acd32" },
    keihinTohoku: { name: "みずいろのでんしゃ", kind: "local", cars: 10, speedKmh: 90, body: "#e8ecef", stripe: "#52b9e9" },
    saikyo: { name: "みどりのでんしゃ", kind: "local", cars: 10, speedKmh: 100, body: "#e8ecef", stripe: "#35a66f" },
    shonanShinjuku: { name: "オレンジとみどりのでんしゃ", kind: "local", cars: 15, speedKmh: 110, body: "#e8ecef", stripe: "#f28c28", stripe2: "#43a36b" },
    sobu: { name: "きいろのでんしゃ", kind: "local", cars: 10, speedKmh: 95, body: "#e8ecef", stripe: "#ffd400" },
    chuo: { name: "オレンジのでんしゃ", kind: "local", cars: 12, speedKmh: 100, body: "#e8ecef", stripe: "#f28c28" },
    azusa: { name: "むらさきのとっきゅう", kind: "local", cars: [9, 12], speedKmh: 130, body: "#f4f7f8", stripe: "#7a5ab6" },
    naritaExpress: { name: "あかいとっきゅう", kind: "local", cars: [6, 12], speedKmh: 130, body: "#f4f4f4", stripe: "#d12f3f" },
    nozomi: { name: "しろいしんかんせん", kind: "shinkansen", cars: 16, speedKmh: 285, body: "#f8f8f8", stripe: "#1c48a6" },
    hikari: { name: "しろいしんかんせん", kind: "shinkansen", cars: 16, speedKmh: 285, body: "#f8f8f8", stripe: "#1c48a6" },
    kodama: { name: "しろいしんかんせん", kind: "shinkansen", cars: 16, speedKmh: 285, body: "#f8f8f8", stripe: "#1c48a6" },
    hayabusa: { name: "みどりのしんかんせん", kind: "shinkansen", cars: 10, speedKmh: 320, body: "#f7f5ed", stripe: "#36a995", stripe2: "#e73d8f" },
    hayabusaKomachi: {
      name: "みどりとあかのしんかんせん", kind: "shinkansen", cars: 17, speedKmh: 320,
      body: "#f7f5ed", stripe: "#36a995", stripe2: "#e73d8f", coupledAtCar: 10,
      coupledBody: "#ef3340", coupledStripe: "#b7b7b7",
    },
    komachi: { name: "あかいしんかんせん", kind: "shinkansen", cars: 7, speedKmh: 320, body: "#ef3340", stripe: "#b7b7b7" },
    yamabiko: { name: "みどりのしんかんせん", kind: "shinkansen", cars: 10, speedKmh: 275, body: "#f7f5ed", stripe: "#36a995" },
    tozai: { name: "みずいろのでんしゃ", kind: "local", cars: 10, speedKmh: 100, body: "#e8ecef", stripe: "#3085cc", stripe2: "#32a5d2" },
    toyoRapid: { name: "あおいでんしゃ", kind: "local", cars: 10, speedKmh: 100, body: "#e8ecef", stripe: "#1775b8", stripe2: "#e07b25" },
    inokashira: { name: "むらさきのでんしゃ", kind: "local", cars: 5, speedKmh: 90, body: "#eef1f2", stripe: "#6f4aa8" },
    keio: { name: "あかとあおのでんしゃ", kind: "local", cars: 10, speedKmh: 110, body: "#e8ecef", stripe: "#d31359", stripe2: "#174f9a" },
    freight: { name: "かもつれっしゃ", kind: "freight", cars: 26, speedKmh: 100, body: "#40505d", stripe: "#e49a31" },
  };

  const CHUO_SOBU_PARALLEL_STATIONS = new Set([
    "おちゃのみず", "すいどうばし", "いいだばし", "いちがや", "よつや",
    "しなのまち", "せんだがや", "よよぎ", "しんじゅく", "おおくぼ",
    "ひがしなかの", "なかの", "こうえんじ", "あさがや", "おぎくぼ",
    "にしおぎくぼ", "きちじょうじ", "みたか",
  ]);
  const CHUO_FREIGHT_STATIONS = new Set(["たちかわ", "ひの", "とよだ", "はちおうじ", "にしはちおうじ", "たかお"]);
  const SOBU_RAPID_PARALLEL_STATIONS = new Set([
    "きんしちょう", "かめいど", "ひらい", "しんこいわ", "こいわ", "いちかわ",
    "もとやわた", "しもうさなかやま", "にしふなばし", "ふなばし", "ひがしふなばし",
    "つだぬま", "まくはりほんごう", "まくはり", "しんけみがわ", "いなげ", "にしちば", "ちば",
  ]);
  const TOHOKU_NORTH_OF_MORIOKA = new Set([
    "いわてぬまくない", "にのへ", "はちのへ", "しちのへとわだ", "しんあおもり",
  ]);
  const YAMANOTE_KEIHIN_PARALLEL_STATIONS = new Set([
    "とうきょう", "ゆうらくちょう", "しんばし", "はままつちょう", "たまち",
    "たかなわゲートウェイ", "しながわ", "たばた", "にしにっぽり", "にっぽり",
    "うぐいすだに", "うえの", "おかちまち", "あきはばら", "かんだ",
  ]);
  const YAMANOTE_SAIKYO_PARALLEL_STATIONS = new Set([
    "おおさき", "ごたんだ", "めぐろ", "えびす", "しぶや", "はらじゅく",
    "よよぎ", "しんじゅく", "しんおおくぼ", "たかだのばば", "めじろ", "いけぶくろ",
  ]);

  function segmentIsWithin(stations) {
    return stations.has(currentStationName) && stations.has(nextStationName);
  }

  function opposingTrainPoolForSegment() {
    const types = OPPOSING_TRAIN_TYPES;
    if (selectedRouteKey === "chuo") {
      if (segmentIsWithin(CHUO_FREIGHT_STATIONS)) return [types.chuo, types.azusa, types.freight];
      if (segmentIsWithin(CHUO_SOBU_PARALLEL_STATIONS)) return [types.chuo, types.sobu, types.azusa];
      return [types.chuo, types.azusa];
    }
    if (selectedRouteKey === "tokaido") return [types.nozomi, types.hikari, types.kodama];
    if (selectedRouteKey === "tohoku") {
      if (TOHOKU_NORTH_OF_MORIOKA.has(currentStationName) || TOHOKU_NORTH_OF_MORIOKA.has(nextStationName)) {
        return [types.hayabusa];
      }
      return [types.hayabusaKomachi, types.yamabiko];
    }
    if (selectedRouteKey === "sobu") {
      if (segmentIsWithin(CHUO_SOBU_PARALLEL_STATIONS)) return [types.sobu, types.chuo];
      if (segmentIsWithin(SOBU_RAPID_PARALLEL_STATIONS)) return [types.sobu, types.naritaExpress];
      return [types.sobu];
    }
    if (selectedRouteKey === "tozai") return [types.tozai, types.toyoRapid];
    if (selectedRouteKey === "inokashira") return [types.inokashira];
    if (selectedRouteKey === "keio") return [types.keio];
    if (selectedRouteKey === "yamanote") {
      if (segmentIsWithin(YAMANOTE_KEIHIN_PARALLEL_STATIONS)) return [types.yamanote, types.keihinTohoku];
      if (segmentIsWithin(YAMANOTE_SAIKYO_PARALLEL_STATIONS)) {
        return [types.yamanote, types.saikyo, types.shonanShinjuku];
      }
      return [types.yamanote];
    }
    return [types.chuo];
  }


  const DRIVER_CALLS = ["しんごうよし！", "ドアよし！", "しゅっぱつしんこう！", "じこくよし！"];
  const TIMES_OF_DAY = ["day", "sunset", "night"];
  const WEATHERS = ["sunny", "rain", "snow"];
  const STAMP_STORAGE_KEY = "train-go-station-stamps-v1";

  // ---- 要素 ----
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const selectScreen = document.getElementById("select-screen");
  const runUi = document.getElementById("run-ui");
  const arrivalBanner = document.getElementById("arrival-banner");
  const btnCouple = document.getElementById("btn-couple");
  const btnRemove = document.getElementById("btn-remove");
  const btnHome = document.getElementById("btn-home");
  const btnKomachiCouple = document.getElementById("btn-komachi-couple");
  const btnStationDoors = document.getElementById("btn-station-doors");
  const doorLabel = document.getElementById("door-label");
  const stationPassengers = document.getElementById("station-passengers");
  const routeEventBanner = document.getElementById("route-event-banner");
  const btnHeadlight = document.getElementById("btn-headlight");
  const headlightLabel = document.getElementById("headlight-label");
  const drivePanel = document.getElementById("drive-panel");
  const speedValue = document.getElementById("speed-value");
  const tapBoostValue = document.getElementById("tap-boost-value");
  const distanceValue = document.getElementById("distance-value");
  const distanceKmValue = document.getElementById("distance-km-value");
  const nextStationDistanceLabel = document.getElementById("next-station-distance-label");
  const nextStationDistanceValue = document.getElementById("next-station-distance-value");
  const nextStationDistanceKm = document.getElementById("next-station-distance-km");
  const terminalDistanceLabel = document.getElementById("terminal-distance-label");
  const terminalDistanceValue = document.getElementById("terminal-distance-value");
  const terminalDistanceKm = document.getElementById("terminal-distance-km");
  const btnExpress = document.getElementById("btn-express");
  const expressIcon = document.getElementById("express-icon");
  const expressLabel = document.getElementById("express-label");
  const btnRunningSound = document.getElementById("btn-running-sound");
  const runningSoundIcon = document.getElementById("running-sound-icon");
  const btnAutoMode = document.getElementById("btn-auto-mode");
  const autoModeLabel = document.getElementById("auto-mode-label");
  const onboardPanel = document.getElementById("onboard-panel");
  const onboardSummary = document.getElementById("onboard-summary");
  const onboardHint = document.getElementById("onboard-hint");
  const onboardList = document.getElementById("onboard-list");
  const playControls = document.getElementById("play-controls");
  const btnDriver = document.getElementById("btn-driver");
  const btnStamps = document.getElementById("btn-stamps");
  const btnMapMode = document.getElementById("btn-map-mode");
  const mapModeLabel = document.getElementById("map-mode-label");
  const stampBook = document.getElementById("stamp-book");
  const btnCloseStamps = document.getElementById("btn-close-stamps");
  const stampCount = document.getElementById("stamp-count");
  const stampGrid = document.getElementById("stamp-grid");
  const playBanner = document.getElementById("play-banner");
  const playTimer = document.getElementById("play-timer");
  const playTimeValue = document.getElementById("play-time-value");

  let W = 0, H = 0, DPR = 1;
  let forcedSize = false; // デバッグ用: 非表示タブでも描画検証できるようにサイズを固定する
  function resize() {
    if (forcedSize) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  // ---- 音まわり ----
  let audioCtx = null;
  let runningOsc = null;
  let runningRailOsc = null;
  let runningGain = null;
  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }

  // 「ぷあ〜ん」警笛: 2つのオシレータを少しずらして鳴らす
  function horn() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.05);
    gain.gain.setValueAtTime(0.25, t + 0.6);
    gain.gain.linearRampToValueAtTime(0, t + 0.9);
    gain.connect(audioCtx.destination);
    for (const freq of [311, 370]) {
      const osc = audioCtx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 1.0);
    }
  }

  // 到着チャイム: 短い上昇アルペジオ
  function chime() {
    if (!audioCtx) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const t = audioCtx.currentTime + i * 0.15;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  function doorSound(opening) {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(opening ? 480 : 720, t);
    osc.frequency.linearRampToValueAtTime(opening ? 760 : 430, t + 0.42);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.04);
    gain.gain.linearRampToValueAtTime(0.001, t + 0.48);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  function crossingBell(screenX) {
    if (!audioCtx) return;
    const trainX = W * NOSE_R;
    const relativeX = Math.max(-1, Math.min(1, (screenX - trainX) / Math.max(W * 0.7, 1)));
    const proximity = 1 - Math.min(Math.abs(screenX - trainX) / Math.max(W * 0.8, 1), 1);
    const baseFrequency = 760 + relativeX * 150;
    const t = audioCtx.currentTime;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.025 + proximity * 0.09, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.17);

    if (audioCtx.createStereoPanner) {
      const pan = audioCtx.createStereoPanner();
      pan.pan.value = Math.max(-1, Math.min(1, (screenX / Math.max(W, 1)) * 2 - 1));
      gain.connect(pan).connect(audioCtx.destination);
    } else {
      gain.connect(audioCtx.destination);
    }

    for (const [ratio, type] of [[1, "square"], [1.48, "sine"]]) {
      const osc = audioCtx.createOscillator();
      osc.type = type;
      osc.frequency.value = baseFrequency * ratio;
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.18);
    }
  }

  function passingSound() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.55);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.62);
  }

  function startRunningSound() {
    if (!audioCtx || !runningSoundEnabled || runningOsc) return;
    const t = audioCtx.currentTime;
    runningOsc = audioCtx.createOscillator();
    runningRailOsc = audioCtx.createOscillator();
    runningGain = audioCtx.createGain();
    runningOsc.type = "triangle";
    runningRailOsc.type = "triangle";
    runningOsc.frequency.value = 85;
    runningRailOsc.frequency.value = 210;
    runningGain.gain.setValueAtTime(0.001, t);
    runningGain.gain.linearRampToValueAtTime(0.04, t + 0.25);
    runningOsc.connect(runningGain);
    runningRailOsc.connect(runningGain);
    runningGain.connect(audioCtx.destination);
    runningOsc.start(t);
    runningRailOsc.start(t);
  }

  function updateRunningSound() {
    if (!audioCtx || !runningOsc || !runningRailOsc || !runningGain) return;
    const t = audioCtx.currentTime;
    const soundSpeed = Math.min(speed, 2400);
    runningOsc.frequency.setTargetAtTime(70 + soundSpeed * 0.07, t, 0.12);
    runningRailOsc.frequency.setTargetAtTime(180 + soundSpeed * 0.16, t, 0.12);
    runningGain.gain.setTargetAtTime(state === "running" ? 0.035 + soundSpeed / 25000 : 0.001, t, 0.1);
  }

  function stopRunningSound() {
    if (!audioCtx || !runningOsc || !runningGain) return;
    const oscillators = [runningOsc, runningRailOsc].filter(Boolean);
    const gain = runningGain;
    runningOsc = null;
    runningRailOsc = null;
    runningGain = null;
    const t = audioCtx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.001), t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    oscillators.forEach((osc) => osc.stop(t + 0.2));
  }

  function say(text) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.rate = 0.95;
    u.pitch = 1.2;
    speechSynthesis.speak(u);
  }

  // ---- ゲーム状態 ----
  let state = "select"; // select | running | stopped | coupling
  let selectedRouteKey = "tokaido";
  let mapMode = "scenery";
  let activeRoute = ROUTES[selectedRouteKey];
  let train = TRAINS.nozomi;
  let trainKey = "nozomi";
  let carTypes = ["nozomi"];
  let cars = 1;
  let speed = 0; // px/s
  let distance = 0;
  let visualDistance = 0;    // 折り返し後は減らし、背景や駅を反対方向へ流す
  let wheelAngle = 0;
  let stationWorldX = 0;   // 次の駅の位置(距離座標)
  let currentStationX = null; // いま停車中(または通過直後)の駅の位置
  let currentStationAligned = true; // 通過駅ではなく、編成をホームへ合わせた停車駅か
  let stationIdx = -1;        // activeRoute.stations 内の次に停まる駅
  let routeDirection = 1;     // 1: くだり、-1: 終点から始発へ折り返し
  let currentLineKm = activeRoute.startKm;
  let nextStationName = "";
  let currentStationName = "";
  let viewScale = 1;       // 編成全体が見えるようにカメラを引く倍率
  let confetti = [];
  let speedBoostPopups = [];
  let fallingStar = null;
  let nextFallingStarIn = 5;
  let starBoostTime = 0;
  let starBoostMultiplier = 1;
  let starBoostType = FALLING_STAR_TYPES[0];
  const mapPowerStarScreenPoint = { x: NaN, y: NaN, radius: 0 };
  const mapPowerStarRoutePosition = {};
  let missedRareStars = { blue: 0, rainbow: 0 };
  let accelerationEffect = 0;
  let brakeEffect = 0;
  let clouds = [];
  let komachiCoupled = false;
  let komachiReady = false;
  let komachiStationX = null;
  let komachiGap = 110;
  let doorsOpen = false;
  let stationDoorsDone = true;
  let segmentNumber = 0;
  let segmentStartDistance = 0;
  let routeEvent = ""; // "" | fuji | inspection | tunnel | crossing
  let routeEventAnnounced = false;
  let routeEventProgress = 0;
  let crossingWorldX = null;
  let crossingBellTimer = 0;
  let lightsOn = false;
  let inspectionTime = 0;
  let expressMode = false;
  let deadheadMode = false;
  let passingStation = false;
  let midAnnouncementDone = false;
  let runningSoundEnabled = true;
  let autoMode = false;
  let autoActionTimer = 0;
  let onboardPassengers = [];
  let deliveredPassengers = 0;
  let opposingTrain = null;
  let nextOpposingTrainIn = 3;
  let timeOfDay = "day";
  let weather = "sunny";
  let weatherTime = 0;
  let driverCallIndex = 0;
  let playBannerTimer = 0;
  let onboardPanelTimer = 0;
  let playElapsedSeconds = 0;
  let visitedStations = loadVisitedStations();

  function initClouds() {
    clouds = [];
    for (let i = 0; i < 6; i++) {
      clouds.push({
        x: Math.random() * W,
        y: H * (0.05 + Math.random() * 0.25),
        s: 0.6 + Math.random() * 0.8,
      });
    }
  }
  initClouds();

  function scheduleNextStation() {
    const terminalIndex = activeRoute.terminalIndex ?? activeRoute.stations.length - 2;
    let nextStation;
    if (activeRoute.loopKm) {
      stationIdx = (stationIdx + 1) % activeRoute.stations.length;
      nextStation = activeRoute.stations[stationIdx];
    } else if (routeDirection > 0) {
      if (stationIdx >= terminalIndex) {
        routeDirection = -1;
        stationIdx = terminalIndex - 1;
      } else {
        stationIdx += 1;
      }
      nextStation = stationIdx >= 0
        ? activeRoute.stations[stationIdx]
        : { name: activeRoute.start, km: activeRoute.startKm };
    } else if (stationIdx === 0) {
      stationIdx = -1;
      nextStation = { name: activeRoute.start, km: activeRoute.startKm };
    } else if (stationIdx < 0) {
      routeDirection = 1;
      stationIdx = 0;
      nextStation = activeRoute.stations[stationIdx];
    } else {
      stationIdx -= 1;
      nextStation = activeRoute.stations[stationIdx];
    }
    let intervalKm = nextStation.km - currentLineKm;
    if (intervalKm < 0 && activeRoute.loopKm) intervalKm += activeRoute.loopKm;
    const intervalMeters = Math.round(Math.abs(intervalKm) * 1000);
    nextStationName = nextStation.name;
    canvas.dataset.routeDirection = routeDirection > 0 ? "outbound" : "return";
    canvas.dataset.nextStation = nextStationName;
    canvas.dataset.nextStationMeters = String(intervalMeters);
    stationWorldX = distance + intervalMeters * PIXELS_PER_METER;
    currentLineKm = nextStation.km;
    if (isKomachiCouplingStop(nextStationName)) komachiStationX = stationWorldX;
  }

  function isKomachiCouplingStop(stationName) {
    return train === TRAINS.hayabusa
      && KOMACHI_COUPLING_STATIONS[selectedRouteKey] === stationName
      && !komachiCoupled;
  }

  function isTerminalNextStation() {
    const terminalIndex = activeRoute.terminalIndex ?? activeRoute.stations.length - 2;
    if (activeRoute.loopKm) return stationIdx === terminalIndex;
    return routeDirection > 0 ? stationIdx === terminalIndex : stationIdx < 0;
  }

  function isDeadheadStopName(name) {
    const terminal = activeRoute.stations[activeRoute.terminalIndex ?? activeRoute.stations.length - 2].name;
    const couplingStation = train === TRAINS.hayabusa
      && KOMACHI_COUPLING_STATIONS[selectedRouteKey] === name
      && !komachiCoupled;
    return name === activeRoute.start || name === terminal || couplingStation;
  }

  function shouldPassNextStation() {
    const isFirstKomachiStop = isKomachiCouplingStop(nextStationName);
    if (deadheadMode) return !isFirstKomachiStop && !isTerminalNextStation();
    if (!expressMode || !activeRoute.supportsExpress) return false;
    return !isFirstKomachiStop && !activeRoute.expressStops.has(nextStationName);
  }

  function isBrakingForStation() {
    if (state !== "running" || passingStation) return false;
    const distToStation = stationWorldX - distance;
    return distToStation < speed * speed / (2 * 300) + 50;
  }

  function routeEventForSegment() {
    if (selectedRouteKey === "tokaido" && train === TRAINS.nozomi && nextStationName === "しんふじ") return "fuji";
    if (selectedRouteKey === "tokaido" && train === TRAINS.doctoryellow && segmentNumber === 1) return "inspection";
    if (TUNNEL_SEGMENTS[selectedRouteKey]?.has(segmentKey(currentStationName, nextStationName))) return "tunnel";
    const isSagamiharaBranch = activeRoute.variant === "hashimoto"
      && (KEIO_SAGAMIHARA_BRANCH_STATIONS.has(currentStationName)
        || KEIO_SAGAMIHARA_BRANCH_STATIONS.has(nextStationName));
    if (activeRoute.allowCrossings && !isSagamiharaBranch && segmentNumber % 4 === 0) return "crossing";
    return "";
  }

  function remainingDistanceMeters(meters) {
    return String(Math.max(0, Math.ceil(meters - 0.001)));
  }

  function remainingDistanceKm(meters) {
    return `${(Math.max(0, meters) / 1000).toFixed(1)} km`;
  }

  function nextStationRemainingMeters() {
    if (stationIdx < 0 || !nextStationName) return 0;
    return Math.max(0, (stationWorldX - distance) / PIXELS_PER_METER);
  }

  function terminalRemainingMeters() {
    const terminalIndex = activeRoute.terminalIndex ?? activeRoute.stations.length - 2;
    if (!activeRoute.loopKm && routeDirection < 0) {
      const remainingAfterNext = stationIdx < 0
        ? 0
        : Math.max(0, (activeRoute.stations[stationIdx].km - activeRoute.startKm) * 1000);
      return nextStationRemainingMeters() + remainingAfterNext;
    }
    if (stationIdx < 0) {
      return Math.max(0, (activeRoute.stations[terminalIndex].km - activeRoute.startKm) * 1000);
    }
    if (stationIdx > terminalIndex) return 0;
    const remainingAfterNext = Math.max(
      0,
      (activeRoute.stations[terminalIndex].km - activeRoute.stations[stationIdx].km) * 1000,
    );
    return nextStationRemainingMeters() + remainingAfterNext;
  }

  function routeTerminalStation() {
    if (!activeRoute.loopKm && routeDirection < 0) {
      return { name: activeRoute.start, km: activeRoute.startKm };
    }
    return activeRoute.stations[activeRoute.terminalIndex ?? activeRoute.stations.length - 2];
  }

  function displaySpeed(value) {
    return Math.round(value * SPEED_DISPLAY_SCALE);
  }

  function autoTargetKmh() {
    return ROUTE_AUTO_SPEED_KMH[selectedRouteKey] || 90;
  }

  function setAutoMode(enabled) {
    autoMode = enabled;
    autoActionTimer = enabled ? 0.9 : 0;
    updateDriveUi();
    if (enabled) {
      showPlayBanner(`🤖 じどううんてん　${autoTargetKmh()} km/h`);
      say(`じどううんてんを、はじめます。${autoTargetKmh()}キロまで、かそくします`);
    } else {
      showPlayBanner("🖐️ しゅどううんてん");
      say("しゅどううんてんに、もどります");
    }
  }

  function updateAutoOperations(dt) {
    if (!autoMode || state === "select" || state === "running" || state === "coupling") return;
    autoActionTimer -= dt;
    if (autoActionTimer > 0) return;

    if (komachiReady) {
      startKomachiCoupling();
      autoActionTimer = 1.2;
    } else if (!stationDoorsDone) {
      toggleStationDoors();
      autoActionTimer = doorsOpen ? 2.8 : 1.2;
    } else {
      depart();
      autoActionTimer = 0;
    }
  }

  let lastDriveUiUpdate = -Infinity;
  function updateDriveUi(force = true, now = performance.now()) {
    if (!force && now - lastDriveUiUpdate < 100) return;
    lastDriveUiUpdate = now;
    const terminal = routeTerminalStation();
    speedValue.textContent = String(displaySpeed(speed));
    tapBoostValue.textContent = String(currentTapBoostKmh());
    if (isDebug) {
      canvas.dataset.tapBoostKmh = String(currentTapBoostKmh());
      canvas.dataset.deliveredPassengers = String(deliveredPassengers);
      canvas.dataset.braking = String(isBrakingForStation());
      canvas.dataset.passingStation = String(passingStation);
      canvas.dataset.tunnelProgress = routeEvent === "tunnel" ? routeEventProgress.toFixed(3) : "";
      canvas.dataset.tunnelAlpha = tunnelVisualAlpha().toFixed(3);
      canvas.dataset.speedBoostCount = String(speedBoostPopups.length);
    }
    distanceValue.textContent = String(Math.floor(distance / PIXELS_PER_METER));
    distanceKmValue.textContent = `${(Math.floor(distance / PIXELS_PER_METER) / 1000).toFixed(1)} km`;
    const nextRemaining = nextStationRemainingMeters();
    const terminalRemaining = terminalRemainingMeters();
    nextStationDistanceLabel.textContent = `つぎの ${nextStationName || "えき"}まで`;
    nextStationDistanceValue.textContent = remainingDistanceMeters(nextRemaining);
    nextStationDistanceKm.textContent = remainingDistanceKm(nextRemaining);
    terminalDistanceLabel.textContent = `しゅうてん ${terminal.name}まで`;
    terminalDistanceValue.textContent = remainingDistanceMeters(terminalRemaining);
    terminalDistanceKm.textContent = remainingDistanceKm(terminalRemaining);
    btnExpress.classList.remove("hidden");
    btnExpress.classList.toggle("deadhead", deadheadMode);
    btnExpress.setAttribute("aria-pressed", String(expressMode || deadheadMode));
    if (isDebug) canvas.dataset.serviceMode = deadheadMode ? "deadhead" : expressMode ? "express" : "local";
    if (deadheadMode) {
      btnExpress.setAttribute("aria-label", "各駅停車モードにする");
      expressIcon.textContent = "🚫";
      expressLabel.textContent = "かいそう";
    } else if (expressMode) {
      btnExpress.setAttribute("aria-label", "回送モードにする");
      expressIcon.textContent = "🚄";
      expressLabel.textContent = activeRoute.expressLabel;
    } else {
      btnExpress.setAttribute("aria-label", activeRoute.supportsExpress
        ? `${activeRoute.expressModeName}モードにする`
        : "回送モードにする");
      expressIcon.textContent = "🚃";
      expressLabel.textContent = "かくえき";
    }
    btnRunningSound.setAttribute("aria-pressed", String(runningSoundEnabled));
    btnRunningSound.setAttribute("aria-label", runningSoundEnabled ? "走行音を消す" : "走行音を鳴らす");
    runningSoundIcon.textContent = runningSoundEnabled ? "🔊" : "🔇";
    btnAutoMode.setAttribute("aria-pressed", String(autoMode));
    btnAutoMode.setAttribute("aria-label", autoMode ? "自動運転をやめる" : "自動運転をはじめる");
    autoModeLabel.textContent = autoMode ? `じどう ${autoTargetKmh()}` : "じどう";
  }

  function loadVisitedStations() {
    try {
      const saved = JSON.parse(localStorage.getItem(STAMP_STORAGE_KEY) || "[]");
      return new Set(saved.filter((name) => ALL_ROUTE_STATION_NAMES.includes(name)));
    } catch {
      return new Set();
    }
  }

  function saveVisitedStations() {
    try {
      localStorage.setItem(STAMP_STORAGE_KEY, JSON.stringify([...visitedStations]));
    } catch {
      // 保存できない環境でも、その回のスタンプ帳は遊べる。
    }
  }

  function renderStampBook() {
    const routeStationNames = stationNamesForRoute(activeRoute);
    const routeVisitedCount = routeStationNames.filter((name) => visitedStations.has(name)).length;
    const showStopPattern = deadheadMode || (expressMode && activeRoute.supportsExpress);
    stampGrid.replaceChildren();
    routeStationNames.forEach((name) => {
      const stamp = document.createElement("div");
      const visited = visitedStations.has(name);
      const isModeStop = deadheadMode ? isDeadheadStopName(name) : activeRoute.expressStops.has(name);
      stamp.className = `station-stamp${visited ? " visited" : ""}${showStopPattern ? (isModeStop ? " express-stop" : " express-pass") : ""}`;
      if (showStopPattern) {
        const badge = document.createElement("span");
        badge.className = "stamp-stop-badge";
        badge.textContent = isModeStop ? "● とまる" : "→ とおる";
        stamp.appendChild(badge);
      }
      const celebration = stationCelebrationFor(name);
      const stationName = document.createElement("span");
      stationName.className = "station-stamp-name";
      stationName.textContent = visited
        ? `${celebration?.stamp ? `${celebration.stamp}\n` : ""}${name}`
        : `？\n${name}`;
      stamp.appendChild(stationName);
      stamp.setAttribute("aria-label", `${name}、${visited ? "スタンプずみ" : "まだスタンプなし"}${showStopPattern ? `、${isModeStop ? "とまるえき" : "とおりすぎるえき"}` : ""}`);
      stampGrid.appendChild(stamp);
    });
    stampCount.textContent = `${activeRoute.name}　${routeVisitedCount} / ${routeStationNames.length} えき${showStopPattern ? "　● とまる　→ とおる" : ""}`;
  }

  function addStationStamp(name, celebrate = true) {
    if (!name || visitedStations.has(name)) return false;
    visitedStations.add(name);
    saveVisitedStations();
    renderStampBook();
    if (celebrate) {
      showPlayBanner(`🚉 ${name} スタンプ！`);
      spawnConfetti(24);
    }
    return true;
  }

  function showPlayBanner(message, duration = 1800) {
    window.clearTimeout(playBannerTimer);
    playBanner.textContent = message;
    playBanner.classList.remove("hidden");
    playBannerTimer = window.setTimeout(() => playBanner.classList.add("hidden"), duration);
  }

  function futureDestinationNames() {
    const names = [];
    const terminalIndex = activeRoute.terminalIndex ?? activeRoute.stations.length - 2;
    for (let offset = 0; offset < activeRoute.stations.length && names.length < 5; offset++) {
      let candidate;
      if (activeRoute.loopKm) {
        candidate = activeRoute.stations[(stationIdx + offset) % activeRoute.stations.length].name;
      } else if (routeDirection > 0) {
        const index = stationIdx + offset;
        if (index > terminalIndex) break;
        candidate = activeRoute.stations[index].name;
      } else {
        const index = stationIdx - offset;
        if (index < -1) break;
        candidate = index < 0 ? activeRoute.start : activeRoute.stations[index].name;
      }
      const stopsHere = deadheadMode
        ? isDeadheadStopName(candidate)
        : !expressMode || activeRoute.expressStops.has(candidate);
      if (stopsHere) names.push(candidate);
    }
    return names.length > 0 ? names : [nextStationName];
  }

  function updateOnboardPanel() {
    if (onboardPassengers.length === 0) {
      onboardSummary.textContent = "0にん";
      onboardList.textContent = "まだ だれも のっていないよ";
      onboardPanel.setAttribute("aria-label", "のっているひとは0にん。タップでいきさきを見る");
      return;
    }
    onboardSummary.textContent = `${onboardPassengers.map((passenger) => passenger.icon).join("")} ${onboardPassengers.length}にん`;
    const shown = onboardPassengers.slice(0, 4)
      .map((passenger) => `${passenger.icon} → ${passenger.destination}`);
    if (onboardPassengers.length > shown.length) shown.push(`ほか ${onboardPassengers.length - shown.length}にん`);
    onboardList.textContent = shown.join("\n");
    onboardPanel.setAttribute("aria-label", `のっているひとは${onboardPassengers.length}にん。タップでいきさきを見る`);
  }

  function setOnboardPanelExpanded(expanded) {
    window.clearTimeout(onboardPanelTimer);
    onboardPanel.classList.toggle("expanded", expanded);
    onboardPanel.setAttribute("aria-expanded", String(expanded));
    onboardHint.textContent = expanded ? "▴" : "▾";
    if (expanded) onboardPanelTimer = window.setTimeout(() => setOnboardPanelExpanded(false), 4000);
  }

  function makeBoardingPassengers(count) {
    const destinations = futureDestinationNames();
    return pickPassengers(count).map((icon) => ({
      icon,
      destination: destinations[Math.floor(Math.random() * destinations.length)],
    }));
  }

  function cycleWeatherAndTime() {
    timeOfDay = TIMES_OF_DAY[(TIMES_OF_DAY.indexOf(timeOfDay) + 1) % TIMES_OF_DAY.length];
    weather = WEATHERS[(WEATHERS.indexOf(weather) + 1) % WEATHERS.length];
    const timeName = { day: "ひる", sunset: "ゆうやけ", night: "よる" }[timeOfDay];
    const weatherName = { sunny: "はれ", rain: "あめ", snow: "ゆき" }[weather];
    showPlayBanner(`${timeName}・${weatherName}になったよ${timeOfDay === "night" ? "　ライトも ついた！" : ""}`);
  }

  function headlightsAreOn() {
    return lightsOn || timeOfDay === "night";
  }

  function announceInitialDeparture() {
    if (activeRoute.loopKm) {
      showPlayBanner(`🚉 ${activeRoute.start} はつ　${activeRoute.name}`, 3200);
      say(`このでんしゃは、${activeRoute.start}はつ、${activeRoute.name}です。つぎは、${nextStationName}です`);
      return;
    }
    const destination = routeTerminalStation().name;
    showPlayBanner(`🚉 ${activeRoute.start} はつ　➡ ${destination} ゆき`, 3200);
    say(`このでんしゃは、${activeRoute.start}はつ、${destination}ゆきです。つぎは、${nextStationName}です`);
  }

  function startGame(key) {
    mapMode = "scenery";
    activeRoute = routeForGameStart();
    trainKey = key;
    train = TRAINS[key];
    carTypes = [key];
    cars = 1;
    speed = 0;
    distance = 0;
    visualDistance = 0;
    currentStationX = 0;
    currentStationAligned = true;
    currentStationName = activeRoute.start;
    canvas.dataset.route = selectedRouteKey;
    canvas.dataset.routeName = activeRoute.name;
    canvas.dataset.currentStation = currentStationName;
    stationIdx = -1;
    routeDirection = 1;
    currentLineKm = activeRoute.startKm;
    komachiCoupled = false;
    komachiReady = false;
    komachiGap = 110;
    komachiStationX = null;
    viewScale = 1;
    speedBoostPopups = [];
    fallingStar = null;
    nextFallingStarIn = 5 + Math.random() * 5;
    starBoostTime = 0;
    starBoostMultiplier = 1;
    starBoostType = FALLING_STAR_TYPES[0];
    missedRareStars = { blue: 0, rainbow: 0 };
    accelerationEffect = 0;
    brakeEffect = 0;
    playElapsedSeconds = 0;
    updatePlayTimer(true);
    state = "stopped";
    scheduleNextStation();
    doorsOpen = false;
    stationDoorsDone = true;
    expressMode = false;
    deadheadMode = false;
    passingStation = false;
    midAnnouncementDone = false;
    onboardPassengers = [];
    deliveredPassengers = 0;
    setOnboardPanelExpanded(false);
    stationPassengers.replaceChildren();
    opposingTrain = null;
    scheduleNextOpposingTrain(true);
    timeOfDay = "day";
    weather = "sunny";
    weatherTime = 0;
    driverCallIndex = 0;
    autoMode = false;
    autoActionTimer = 0;
    updateOnboardPanel();
    addStationStamp(activeRoute.start, false);
    renderStampBook();
    segmentNumber = 0;
    segmentStartDistance = 0;
    btnMapMode.classList.remove("hidden");
    setMapMode("scenery");
    selectScreen.classList.add("hidden");
    runUi.classList.remove("hidden");
    btnHome.classList.remove("hidden");
    playTimer.classList.remove("hidden");
    drivePanel.classList.remove("hidden");
    onboardPanel.classList.remove("hidden");
    playControls.classList.remove("hidden");
    stampBook.classList.add("hidden");
    playBanner.classList.add("hidden");
    btnKomachiCouple.classList.add("hidden");
    btnStationDoors.classList.add("hidden");
    stationPassengers.classList.add("hidden");
    populateQuickAddButtons();
    clearRouteEvent();
    updateDriveUi();
    arrivalBanner.textContent = "とうちゃく〜！";
    announceInitialDeparture();
  }

  function goHome() {
    mapMode = "scenery";
    document.body.classList.remove("map-view-active");
    state = "select";
    speed = 0;
    autoMode = false;
    autoActionTimer = 0;
    stopRunningSound();
    selectScreen.classList.remove("hidden");
    runUi.classList.add("hidden");
    btnHome.classList.add("hidden");
    playTimer.classList.add("hidden");
    drivePanel.classList.add("hidden");
    onboardPanel.classList.add("hidden");
    playControls.classList.add("hidden");
    stampBook.classList.add("hidden");
    playBanner.classList.add("hidden");
    btnMapMode.classList.add("hidden");
    btnMapMode.setAttribute("aria-pressed", "false");
    arrivalBanner.classList.add("hidden");
    btnKomachiCouple.classList.add("hidden");
    btnStationDoors.classList.add("hidden");
    stationPassengers.classList.add("hidden");
    clearRouteEvent();
  }

  function beginSegment(playHorn = true, announceNext = true) {
    state = "running";
    arrivalBanner.classList.add("hidden");
    arrivalBanner.classList.remove("passenger-exchange");
    btnStationDoors.classList.add("hidden");
    stationPassengers.classList.add("hidden");
    segmentNumber++;
    segmentStartDistance = distance;
    routeEventAnnounced = false;
    routeEventProgress = 0;
    lightsOn = false;
    inspectionTime = 0;
    midAnnouncementDone = false;
    passingStation = shouldPassNextStation();
    routeEvent = routeEventForSegment();
    if (routeEvent === "crossing") {
      const segmentLength = Math.max(stationWorldX - segmentStartDistance, 1);
      crossingWorldX = segmentStartDistance + segmentLength * (0.35 + Math.random() * 0.3);
      crossingBellTimer = 0;
    }
    if (routeEvent === "fuji") {
      timeOfDay = "day";
      weather = "sunny";
    } else if (segmentNumber > 1 && segmentNumber % 3 === 0) {
      cycleWeatherAndTime();
    }
    routeEventBanner.classList.add("hidden");
    btnHeadlight.classList.add("hidden");
    if (playHorn) horn();
    if (announceNext) {
      say(passingStation
        ? `このでんしゃは、${deadheadMode ? "かいそうれっしゃ" : activeRoute.expressModeName}です。${nextStationName}は、とおりすぎます`
        : `つぎは、${nextStationName}`);
    }
    speed = Math.max(speed, autoMode ? 60 : DEPARTURE_SPEED_PX_PER_SEC);
    startRunningSound();
    updateDriveUi();
  }

  function depart() {
    if (komachiReady || state === "coupling" || !stationDoorsDone) return;
    beginSegment();
  }

  function arrive() {
    clearRouteEvent();
    state = "stopped";
    speed = 0;
    stopRunningSound();
    updateDriveUi();
    currentStationX = stationWorldX;
    currentStationAligned = true;
    currentStationName = nextStationName;
    canvas.dataset.currentStation = currentStationName;
    addStationStamp(currentStationName);
    doorsOpen = false;
    stationDoorsDone = false;
    btnStationDoors.classList.add("hidden");
    stationPassengers.classList.add("hidden");
    const isKomachiStop = isKomachiCouplingStop(currentStationName);
    const celebration = stationCelebrationFor(currentStationName);
    const terminalIndex = activeRoute.terminalIndex ?? activeRoute.stations.length - 2;
    const isTurnaround = !activeRoute.loopKm
      && (stationIdx === terminalIndex || currentStationName === activeRoute.start);
    scheduleNextStation();
    if (isTurnaround) {
      opposingTrain = null;
      scheduleNextOpposingTrain(true);
    }
    updateDriveUi();
    arrivalBanner.classList.remove("hidden");
    chime();
    if (autoMode) autoActionTimer = 1.2;
    if (isKomachiStop) {
      komachiReady = true;
      arrivalBanner.textContent = "れんけつするでんしゃがいた！";
      btnKomachiCouple.classList.remove("hidden");
      say(`${currentStationName}にとうちゃく！れんけつしよう！`);
    } else if (celebration) {
      arrivalBanner.textContent = celebration.banner;
      showStationDoorPrompt();
      const turnaroundAnnouncement = isTurnaround
        ? `おりかえして、${routeTerminalStation().name}へいくよ。`
        : "";
      say(`${currentStationName}にとうちゃく！${celebration.announcement}${turnaroundAnnouncement}ドアをあけてみよう！`);
    } else {
      arrivalBanner.textContent = isTurnaround ? "おりかえし〜！" : "とうちゃく〜！";
      showStationDoorPrompt();
      say(isTurnaround
        ? `${currentStationName}にとうちゃく！おりかえして、${routeTerminalStation().name}へいくよ。ドアをあけてみよう！`
        : `${currentStationName}〜、${currentStationName}〜、とうちゃく！ドアをあけてみよう！`);
    }
    spawnConfetti(celebration ? 90 : 40);
  }

  function passStation() {
    const passedName = nextStationName;
    clearRouteEvent();
    currentStationX = stationWorldX;
    currentStationAligned = false;
    currentStationName = passedName;
    scheduleNextStation();
    beginSegment(false, false);
    arrivalBanner.textContent = `${passedName} つうか！`;
    arrivalBanner.classList.remove("hidden");
    setTimeout(() => {
      if (state === "running") arrivalBanner.classList.add("hidden");
    }, 1400);
    passingSound();
    spawnConfetti(18);
    say(`${passedName}を、つうか！つぎは、${nextStationName}`);
  }

  function startKomachiCoupling() {
    if (!komachiReady || state !== "stopped") return;
    state = "coupling";
    btnKomachiCouple.classList.add("hidden");
    arrivalBanner.textContent = "れんけつするよ〜！";
    say("れんけつするよ〜！");
  }

  function finishKomachiCoupling() {
    komachiGap = 8;
    komachiCoupled = true;
    komachiReady = false;
    komachiStationX = null;
    state = "stopped";
    arrivalBanner.textContent = "れんけつ！";
    chime();
    spawnConfetti(90);
    say(`ガチャン！れんけつ！ぜんぶで、${carWord(totalCarCount())}！`);
    showStationDoorPrompt();
  }

  function showStationDoorPrompt() {
    doorsOpen = false;
    stationDoorsDone = false;
    doorLabel.textContent = "ドアをあける";
    btnStationDoors.setAttribute("aria-label", "ドアをあける");
    btnStationDoors.classList.remove("hidden");
  }

  function pickPassengers(count) {
    const choices = [...PASSENGER_POOL];
    return Array.from({ length: count }, () => {
      const index = Math.floor(Math.random() * choices.length);
      return choices.splice(index, 1)[0];
    });
  }

  function exchangePassengers() {
    const alighting = onboardPassengers.filter((passenger) => passenger.destination === currentStationName);
    onboardPassengers = onboardPassengers.filter((passenger) => passenger.destination !== currentStationName);
    deliveredPassengers += alighting.length;

    const availableSeats = Math.max(0, 7 - onboardPassengers.length);
    const boardingCount = Math.min(availableSeats, 1 + Math.floor(Math.random() * 3));
    const boarding = makeBoardingPassengers(boardingCount);
    onboardPassengers.push(...boarding);
    updateOnboardPanel();

    stationPassengers.replaceChildren();
    [...alighting.map((passenger) => ({ ...passenger, direction: "alight" })),
      ...boarding.map((passenger) => ({ ...passenger, direction: "board" }))]
      .forEach((passenger, index) => {
        const span = document.createElement("span");
        span.textContent = passenger.icon;
        span.className = `passenger-${passenger.direction}`;
        span.title = `${passenger.destination}へいくよ`;
        span.style.setProperty("--passenger-delay", `${index * 0.18}s`);
        stationPassengers.appendChild(span);
      });

    stationPassengers.classList.remove("hidden");
    arrivalBanner.classList.add("passenger-exchange");
    arrivalBanner.textContent = alighting.length > 0
      ? `${alighting.length}にん おとどけ！ タップかそく ＋${alighting.length} km/h`
      : `${boarding.length}にん ごじょうしゃ！`;
    const destination = boarding[0]?.destination;
    say(alighting.length > 0
      ? `ドアがひらきます。${alighting.length}にんとうちゃく！タップかそくが、${alighting.length}キロアップ！${boarding.length}にんごじょうしゃ！`
      : `ドアがひらきます。${boarding.length}にん、${destination ? `${destination}まで` : ""}ごじょうしゃくださーい！`);
  }

  function toggleStationDoors() {
    if (state !== "stopped" || stationDoorsDone || komachiReady) return;

    if (!doorsOpen) {
      doorsOpen = true;
      doorSound(true);
      doorLabel.textContent = "ドアをしめる";
      btnStationDoors.setAttribute("aria-label", "ドアをしめる");
      exchangePassengers();
      spawnConfetti(18);
      return;
    }

    doorsOpen = false;
    doorSound(false);
    stationDoorsDone = true;
    btnStationDoors.classList.add("hidden");
    stationPassengers.classList.add("hidden");
    arrivalBanner.classList.remove("passenger-exchange");
    arrivalBanner.textContent = "しゅっぱつできるよ！";
    say("ドアがしまりまーす。しゅっぱつしんこう！");
  }

  function createTrainPreview(key) {
    return document.querySelector(`.train-btn[data-train="${key}"] svg`).cloneNode(true);
  }

  function populateQuickAddButtons() {
    const otherKeys = Object.keys(TRAINS).filter((key) => key !== trainKey);
    btnCouple.setAttribute("aria-label", `${TRAINS[trainKey].callName}を連結`);
    btnCouple.querySelector(".quick-train-art").replaceChildren(createTrainPreview(trainKey));
    document.querySelectorAll(".btn-quick-add:not(#btn-couple)").forEach((btn, index) => {
      const key = otherKeys[index];
      btn.dataset.car = key;
      btn.setAttribute("aria-label", `${TRAINS[key].callName}を連結`);
      btn.querySelector(".quick-train-art").replaceChildren(createTrainPreview(key));
    });
  }

  function clearRouteEvent() {
    routeEvent = "";
    routeEventAnnounced = false;
    routeEventProgress = 0;
    crossingWorldX = null;
    crossingBellTimer = 0;
    lightsOn = false;
    routeEventBanner.classList.add("hidden");
    btnHeadlight.classList.add("hidden");
    headlightLabel.textContent = "ライトをつける";
    btnHeadlight.setAttribute("aria-label", "ライトをつける");
  }

  function updateRouteEvent(dt) {
    if (!routeEvent || state !== "running") return;
    const segmentLength = Math.max(stationWorldX - segmentStartDistance, 1);
    routeEventProgress = (distance - segmentStartDistance) / segmentLength;
    inspectionTime += dt;
    if (isTunnelExitSegment()) {
      if (routeEventProgress >= 0.68) {
        say("トンネルを、ぬけたよ〜！");
        clearRouteEvent();
      }
      return;
    }
    if (isTunnelEntrySegment()) {
      if (!routeEventAnnounced && routeEventProgress >= 0.42) {
        routeEventAnnounced = true;
        routeEventBanner.textContent = "トンネルだ！";
        routeEventBanner.classList.remove("hidden");
        say("トンネルに、はいったよ！");
      }
      return;
    }
    if (routeEvent === "crossing") {
      const screenX = crossingScreenX();
      crossingBellTimer -= dt;
      if (screenX < W * 1.12 && screenX > -W * 0.18 && crossingBellTimer <= 0) {
        crossingBell(screenX);
        crossingBellTimer = 0.27;
      }
      if (screenX < -W * 0.2) clearRouteEvent();
      return;
    }

    if (!routeEventAnnounced && routeEventProgress >= 0.22) {
      routeEventAnnounced = true;
      routeEventBanner.classList.remove("hidden");
      if (routeEvent === "fuji") {
        routeEventBanner.textContent = "ふじさんだ〜！";
        say("みてみて！おおきな、ふじさんがみえるよ！");
      } else if (routeEvent === "inspection") {
        routeEventBanner.textContent = "せんろを けんさちゅう！";
        say("せんろを、けんさちゅうです！");
      } else if (routeEvent === "tunnel") {
        routeEventBanner.textContent = "トンネルだ！";
        if (headlightsAreOn()) {
          say("トンネルだ！ライトは、もうついているよ！");
        } else {
          btnHeadlight.classList.remove("hidden");
          say("トンネルだ！ライトをつけてみよう！");
        }
      }
    }

    if (routeEventProgress >= 0.8) {
      if (routeEvent === "inspection") {
        say("けんさ、おわり！せんろ、いじょうなし！");
        spawnConfetti(24);
      } else if (routeEvent === "tunnel") {
        say("トンネルを、ぬけたよ〜！");
      }
      clearRouteEvent();
    }
  }

  function updateMidRouteAnnouncement() {
    if (state !== "running" || midAnnouncementDone) return;
    const segmentLength = Math.max(stationWorldX - segmentStartDistance, 1);
    const progress = (distance - segmentStartDistance) / segmentLength;
    if (progress < 0.52) return;
    midAnnouncementDone = true;
    say(passingStation
      ? `まもなく、${nextStationName}を、つうかします`
      : `まもなく、${nextStationName}です。おりるかたは、じゅんびしてください`);
  }

  function addCar(typeKey = trainKey) {
    if (cars >= MAX_CARS) {
      say(`${carWord(totalCarCount())}！ながーい！これでまんたんだよ！`);
      return;
    }
    carTypes.push(typeKey);
    cars = carTypes.length;
    say(`れんけつ！ぜんぶで、${carWord(totalCarCount())}！`);
    spawnConfetti(12);
  }

  function removeCar() {
    if (cars <= 1) {
      const count = totalCarCount();
      say(komachiCoupled
        ? `${carWord(count)}！これいじょうは、きりはなせないよ！`
        : `${carWord(count)}！これがさいごのいちりょうだよ！`);
      return;
    }
    carTypes.pop();
    cars = carTypes.length;
    say(`${carWord(totalCarCount())}！`);
  }

  function totalCarCount() {
    return cars + (komachiCoupled ? 2 : 0);
  }

  function spawnConfetti(n = 40) {
    for (let i = 0; i < n; i++) {
      confetti.push({
        x: W * (0.2 + Math.random() * 0.6),
        y: H * 0.3,
        vx: (Math.random() - 0.5) * 300,
        vy: -Math.random() * 350 - 100,
        color: `hsl(${Math.random() * 360}, 90%, 60%)`,
        life: 1.6,
      });
    }
  }
  function spawnFallingStar() {
    const weights = currentStarWeights();
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    let roll = Math.random() * totalWeight;
    const type = FALLING_STAR_TYPES.find((candidate) => {
      roll -= weights[candidate.key];
      return roll <= 0;
    }) || FALLING_STAR_TYPES[0];
    const radius = Math.max(24, Math.min(38, W * 0.035)) * type.scale;
    fallingStar = {
      type,
      x: W * (0.62 + Math.random() * 0.28),
      y: H * (0.08 + Math.random() * 0.12),
      vx: -W * (0.09 + Math.random() * 0.07) * type.speed,
      vy: H * (0.11 + Math.random() * 0.07) * type.speed,
      radius,
      rotation: Math.random() * Math.PI,
    };
  }

  function currentStarWeights() {
    return Object.fromEntries(FALLING_STAR_TYPES.map((type) => {
      const baseWeight = type.weights?.[timeOfDay] ?? type.weight;
      const missMultiplier = 1 + (missedRareStars[type.key] || 0);
      return [type.key, baseWeight * missMultiplier];
    }));
  }

  function missFallingStar() {
    if (!fallingStar) return;
    const missedType = fallingStar.type;
    if (Object.hasOwn(missedRareStars, missedType.key)) {
      missedRareStars[missedType.key] += 1;
    }
    fallingStar = null;
    nextFallingStarIn = STAR_SPAWN_MIN_SECONDS + Math.random() * 10;
  }

  function updateFallingStar(dt) {
    if (state !== "running") {
      if (state === "stopped") missFallingStar();
      else fallingStar = null;
      if (isDebug) canvas.dataset.starBoostSeconds = starBoostTime > 0 ? String(Math.ceil(starBoostTime)) : "0";
      return;
    }

    const boostWasActive = starBoostTime > 0;
    starBoostTime = Math.max(0, starBoostTime - dt);
    if (boostWasActive && starBoostTime === 0) {
      starBoostMultiplier = 1;
      starBoostType = FALLING_STAR_TYPES[0];
      if (isDebug) {
        canvas.dataset.starBoostMultiplier = "1";
        canvas.dataset.starType = "";
      }
    }
    if (isDebug) canvas.dataset.starBoostSeconds = starBoostTime > 0 ? String(Math.ceil(starBoostTime)) : "0";
    if (!fallingStar) {
      nextFallingStarIn -= dt;
      if (nextFallingStarIn <= 0) spawnFallingStar();
      return;
    }

    fallingStar.x += fallingStar.vx * dt;
    fallingStar.y += fallingStar.vy * dt;
    fallingStar.rotation += dt * 2.4;
    if (fallingStar.y > groundY() - fallingStar.radius
      || fallingStar.x < -fallingStar.radius * 2) {
      missFallingStar();
    }
  }

  function drawStarPath(x, y, outerRadius, innerRadius, rotation) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = rotation - Math.PI / 2 + i * Math.PI / 5;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function drawFallingStar() {
    if (!fallingStar) return;
    const { x, y, radius, rotation, type } = fallingStar;
    const trailX = x + radius * 4 * type.trailScale;
    const trailY = y - radius * 3 * type.trailScale;
    ctx.save();
    const trail = ctx.createLinearGradient(x, y, trailX, trailY);
    if (type.key === "rainbow") {
      trail.addColorStop(0, "rgba(255,91,115,0.95)");
      trail.addColorStop(0.2, "rgba(255,166,70,0.82)");
      trail.addColorStop(0.4, "rgba(255,224,82,0.68)");
      trail.addColorStop(0.6, "rgba(80,218,125,0.5)");
      trail.addColorStop(0.8, "rgba(72,169,255,0.28)");
      trail.addColorStop(1, "rgba(154,91,255,0)");
    } else {
      trail.addColorStop(0, `rgba(${type.trail},0.9)`);
      trail.addColorStop(1, `rgba(${type.trail},0)`);
    }
    ctx.strokeStyle = trail;
    ctx.lineWidth = radius * 0.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(trailX, trailY);
    ctx.stroke();

    ctx.shadowColor = type.glow;
    ctx.shadowBlur = radius;
    if (type.key === "rainbow") {
      const rainbow = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
      ["#ff4d67", "#ff9f43", "#ffe052", "#50da7d", "#48a9ff", "#9a5bff"].forEach((color, index, colors) => {
        rainbow.addColorStop(index / (colors.length - 1), color);
      });
      ctx.fillStyle = rainbow;
    } else {
      ctx.fillStyle = type.fill;
    }
    drawStarPath(x, y, radius, radius * 0.46, rotation);
    ctx.fill();
    ctx.fillStyle = type.inner;
    drawStarPath(x, y, radius * 0.5, radius * 0.22, rotation);
    ctx.fill();
    ctx.restore();
  }

  function drawStarPowerBadge() {
    if (starBoostTime <= 0 || mapMode !== "scenery") return;
    const seconds = Math.ceil(starBoostTime);
    const text = `${starBoostType.icon} タップかそく ${starBoostMultiplier}ばい！ ${seconds}びょう`;
    const width = Math.min(W * 0.62, 390);
    const height = Math.max(44, Math.min(62, H * 0.08));
    const x = W / 2;
    const y = Math.max(height * 0.7, H * 0.08);
    ctx.save();
    ctx.globalAlpha = 0.94;
    ctx.fillStyle = starBoostType.badge;
    ctx.strokeStyle = starBoostType.accent;
    ctx.lineWidth = 5;
    roundRect(x - width / 2, y - height / 2, width, height, height / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = starBoostType.text;
    ctx.font = `bold ${Math.max(19, Math.min(30, W * 0.027))}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y + 1);
    ctx.restore();
  }

  function collectFallingStar(event) {
    if (!fallingStar || state === "select") return false;
    const rect = canvas.getBoundingClientRect();
    const px = event.offsetX * W / Math.max(rect.width, 1);
    const py = event.offsetY * H / Math.max(rect.height, 1);
    const mapStarVisible = mapMode !== "scenery" && Number.isFinite(mapPowerStarScreenPoint.x);
    const targetX = mapStarVisible ? mapPowerStarScreenPoint.x : fallingStar.x;
    const targetY = mapStarVisible ? mapPowerStarScreenPoint.y : fallingStar.y;
    const hitRadius = mapStarVisible ? mapPowerStarScreenPoint.radius : Math.max({
      gold: 52, green: 48, blue: 42, rainbow: 36,
    }[fallingStar.type.key] || 48, fallingStar.radius * 2);
    if (Math.hypot(px - targetX, py - targetY) > hitRadius) return false;

    ensureAudio();
    const collectedType = fallingStar.type;
    fallingStar = null;
    if (Object.hasOwn(missedRareStars, collectedType.key)) {
      missedRareStars[collectedType.key] = 0;
    }
    nextFallingStarIn = STAR_SPAWN_MIN_SECONDS + Math.random() * 10;
    starBoostTime = collectedType.seconds;
    starBoostMultiplier = collectedType.multiplier;
    starBoostType = collectedType;
    canvas.dataset.starBoostSeconds = String(collectedType.seconds);
    canvas.dataset.starBoostMultiplier = String(collectedType.multiplier);
    canvas.dataset.starType = collectedType.key;
    showPlayBanner(`${collectedType.icon} ${collectedType.name}！ タップかそく ${collectedType.multiplier}ばい！`, 2600);
    say(`${collectedType.name}、ゲット！${collectedType.seconds}びょうかん、タップかそく、${collectedType.multiplier}ばい！`);
    chime();
    spawnConfetti(35);
    return true;
  }


  function identifyOpposingTrain(event) {
    if (!opposingTrain || state === "select" || mapMode !== "scenery") return false;
    const rect = canvas.getBoundingClientRect();
    const px = event.offsetX * W / Math.max(rect.width, 1);
    const py = event.offsetY * H / Math.max(rect.height, 1);
    const carW = Math.min(W * 0.13, 115);
    const carH = carW * 0.34;
    const gap = 5;
    const ax = W * NOSE_R;
    const ay = groundY();
    const left = ax + (opposingTrain.x - ax) * viewScale;
    const rightWorld = opposingTrain.x + opposingTrain.cars * (carW + gap);
    const right = ax + (rightWorld - ax) * viewScale;
    const topWorld = opposingTrackY() - carH;
    const top = ay + (topWorld - ay) * viewScale;
    const bottom = ay + (opposingTrackY() + 18 - ay) * viewScale;
    const padding = 40;
    if (px < Math.min(left, right) - padding || px > Math.max(left, right) + padding
      || py < top - padding || py > bottom + padding) return false;

    ensureAudio();
    passingSound();
    showPlayBanner(`🚆 ${opposingTrain.cars}りょう！`, 2200);
    say(`${opposingTrain.cars}りょう！みつけたね！`);
    spawnConfetti(14);
    return true;
  }

  // ---- 入力 ----
  document.querySelectorAll(".route-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      ensureAudio();
      selectedRouteKey = btn.dataset.route;
      activeRoute = ROUTES[selectedRouteKey];
      document.querySelectorAll(".route-btn").forEach((routeButton) => {
        const selected = routeButton === btn;
        routeButton.classList.toggle("selected", selected);
        routeButton.setAttribute("aria-pressed", String(selected));
      });
      say(`${activeRoute.name}！`);
    });
  });

  document.querySelectorAll(".train-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      ensureAudio();
      startGame(btn.dataset.train);
    });
  });

  function currentTapBoostKmh() {
    return BASE_TAP_BOOST_KMH + deliveredPassengers * PASSENGER_TAP_BONUS_KMH;
  }

  function currentTapBoostPxPerSec() {
    return currentTapBoostKmh() / SPEED_DISPLAY_SCALE;
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (collectFallingStar(event)) return;
    if (identifyOpposingTrain(event)) return;
    ensureAudio();
    if (state === "stopped") {
      if (!stationDoorsDone && !komachiReady) {
        toggleStationDoors();
      } else {
        const previousSpeed = displaySpeed(speed);
        depart();
        accelerationEffect = 1;
        showSpeedBoost(displaySpeed(speed) - previousSpeed, event);
      }
    } else if (state === "running") {
      if (isBrakingForStation()) return;
      const previousSpeed = displaySpeed(speed);
      const boost = currentTapBoostPxPerSec() * (starBoostTime > 0 ? starBoostMultiplier : 1);
      speed += boost;
      accelerationEffect = 1;
      showSpeedBoost(displaySpeed(speed) - previousSpeed, event);
    }
  });

  btnCouple.addEventListener("click", () => {
    ensureAudio();
    addCar(trainKey);
  });
  document.querySelectorAll(".btn-quick-add:not(#btn-couple)").forEach((btn) => {
    btn.addEventListener("click", () => {
      ensureAudio();
      addCar(btn.dataset.car);
    });
  });
  btnRemove.addEventListener("click", () => {
    ensureAudio();
    removeCar();
  });
  btnHome.addEventListener("click", goHome);
  btnKomachiCouple.addEventListener("click", () => {
    ensureAudio();
    startKomachiCoupling();
  });
  btnStationDoors.addEventListener("click", () => {
    ensureAudio();
    toggleStationDoors();
  });
  btnHeadlight.addEventListener("click", () => {
    ensureAudio();
    if (routeEvent !== "tunnel" || lightsOn) return;
    lightsOn = true;
    headlightLabel.textContent = "ライト ついた！";
    btnHeadlight.setAttribute("aria-label", "ライトがついた");
    routeEventBanner.textContent = "ピカッ！あかるいね！";
    chime();
    say("ピカッ！ライトがついたよ！あかるいね！");
  });
  btnExpress.addEventListener("click", () => {
    ensureAudio();
    let announcement;
    if (deadheadMode) {
      deadheadMode = false;
      expressMode = false;
      announcement = "かくえきていしゃモード！ぜんぶのえきに、とまります";
    } else if (expressMode || !activeRoute.supportsExpress) {
      expressMode = false;
      deadheadMode = true;
      const couplingNote = train === TRAINS.hayabusa && !komachiCoupled
        ? "ただし、もりおかで、れんけつします。"
        : "";
      announcement = `かいそうれっしゃ！${routeTerminalStation().name}まで、とまりません。${couplingNote}`;
    } else {
      expressMode = true;
      deadheadMode = false;
      announcement = routeDirection > 0 || activeRoute.loopKm
        ? activeRoute.expressAnnouncement
        : `${activeRoute.expressModeName}モード！${activeRoute.start}へ、もどります`;
    }
    passingStation = shouldPassNextStation();
    midAnnouncementDone = false;
    updateDriveUi();
    renderStampBook();
    chime();
    say(announcement);
  });
  btnRunningSound.addEventListener("click", () => {
    ensureAudio();
    runningSoundEnabled = !runningSoundEnabled;
    if (runningSoundEnabled && state === "running") startRunningSound();
    else stopRunningSound();
    updateDriveUi();
  });
  btnAutoMode.addEventListener("click", () => {
    ensureAudio();
    setAutoMode(!autoMode);
  });
  btnDriver.addEventListener("click", () => {
    ensureAudio();
    const call = DRIVER_CALLS[driverCallIndex % DRIVER_CALLS.length];
    driverCallIndex++;
    showPlayBanner(`🧑‍✈️ ${call}`);
    chime();
    say(call);
  });
  btnStamps.addEventListener("click", () => {
    renderStampBook();
    stampBook.classList.remove("hidden");
  });
  const MAP_MODE_SEQUENCE = ["scenery", "follow", "overview"];
  function setMapMode(nextMode, announce = false) {
    mapMode = MAP_MODE_SEQUENCE.includes(nextMode) ? nextMode : "scenery";
    const active = mapMode !== "scenery";
    const nextLabel = mapMode === "scenery" ? "うえから" : mapMode === "follow" ? "ぜんたい" : "よこから";
    const nextAria = mapMode === "scenery"
      ? "うえからのちずをひらく"
      : mapMode === "follow" ? "ぜんたいちずをひらく" : "よこからのけしきにもどす";
    mapModeLabel.textContent = nextLabel;
    btnMapMode.setAttribute("aria-pressed", String(active));
    btnMapMode.setAttribute("aria-label", nextAria);
    document.body.classList.toggle("map-view-active", active);
    if (!active) {
      mapPowerStarScreenPoint.x = NaN;
      mapPowerStarScreenPoint.y = NaN;
      mapPowerStarScreenPoint.radius = 0;
    }
    if (isDebug) canvas.dataset.viewMode = mapMode;
    if (!announce) return;
    const message = mapMode === "follow"
      ? "🚃 うえから へんせいを みてみよう！"
      : mapMode === "overview" ? "🗺️ ぜんたいちず！" : "🌆 よこから！";
    showPlayBanner(message, 2200);
  }
  btnMapMode.addEventListener("click", () => {
    if (!activeRouteMap()) return;
    const currentIndex = MAP_MODE_SEQUENCE.indexOf(mapMode);
    setMapMode(MAP_MODE_SEQUENCE[(currentIndex + 1) % MAP_MODE_SEQUENCE.length], true);
  });
  onboardPanel.addEventListener("click", () => {
    setOnboardPanelExpanded(onboardPanel.getAttribute("aria-expanded") !== "true");
  });
  btnCloseStamps.addEventListener("click", () => stampBook.classList.add("hidden"));
  stampBook.addEventListener("click", (event) => {
    if (event.target === stampBook) stampBook.classList.add("hidden");
  });

  // ---- 描画 ----
  const GROUND_R = 0.78; // 横画面の線路の高さ(画面比)
  const PORTRAIT_GROUND_R = 0.66; // 縦画面は下部操作のため地面を高くする

  function groundY() {
    return H * (H > W ? PORTRAIT_GROUND_R : GROUND_R);
  }
  const NOSE_R = 0.62;   // 先頭車の画面上の位置(画面幅比)

  function trainFacesLeft() {
    return !activeRoute.loopKm && routeDirection < 0;
  }

  function travelVisualSign() {
    return trainFacesLeft() ? -1 : 1;
  }

  function worldScreenOffset(worldX) {
    return (worldX - distance) * travelVisualSign();
  }

  const cachedCarMetrics = { carW: 0, carH: 0, gap: 8 };
  function carMetrics() {
    cachedCarMetrics.carW = Math.min(W * 0.22, 190);
    cachedCarMetrics.carH = cachedCarMetrics.carW * 0.32;
    return cachedCarMetrics;
  }

  // カメラを引いた時に描画が必要になる、スケール座標系での画面左右端
  const cachedViewRange = { x0: 0, x1: 0 };
  function viewRange() {
    const ax = W * NOSE_R;
    cachedViewRange.x0 = ax - ax / viewScale;
    cachedViewRange.x1 = ax + (W - ax) / viewScale;
    return cachedViewRange;
  }

  let skyGradient = null;
  let skyGradientKey = "";
  function drawSky() {
    const gradientKey = `${timeOfDay}:${H}`;
    if (skyGradientKey !== gradientKey) {
      const colors = SKY_PALETTES[timeOfDay];
      skyGradient = ctx.createLinearGradient(0, 0, 0, H);
      skyGradient.addColorStop(0, colors[0]);
      skyGradient.addColorStop(0.6, colors[1]);
      skyGradient.addColorStop(1, colors[2]);
      skyGradientKey = gradientKey;
    }
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, W, H);

    if (timeOfDay === "sunset") {
      ctx.fillStyle = "#ffe073";
      ctx.beginPath();
      ctx.arc(W * 0.82, H * 0.22, Math.max(24, H * 0.05), 0, Math.PI * 2);
      ctx.fill();
    } else if (timeOfDay === "night") {
      ctx.fillStyle = "#fff6c7";
      ctx.beginPath();
      ctx.arc(W * 0.82, H * 0.16, Math.max(22, H * 0.045), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (let i = 0; i < 24; i++) {
        const x = (i * 83 + 31) % Math.max(W, 1);
        const y = H * (0.04 + ((i * 37) % 28) / 100);
        ctx.fillRect(x, y, 2 + i % 3, 2 + i % 3);
      }
    }
  }

  function activeRouteMapKey() {
    return selectedRouteKey === "keio" && activeRoute.variant === "hashimoto"
      ? "keioSagamihara"
      : selectedRouteKey;
  }

  function activeRouteMap() {
    return ROUTE_MAPS[activeRouteMapKey()] || null;
  }

  function yamanoteMapKm() {
    const next = activeRoute.stations[stationIdx];
    if (!next) return activeRoute.startKm || 0;
    const remainingKm = Math.max(0, stationWorldX - distance) / PIXELS_PER_METER / 1000;
    if (activeRoute.loopKm) {
      return (next.km - remainingKm + activeRoute.loopKm) % activeRoute.loopKm;
    }
    return next.km - routeDirection * remainingKm;
  }

  const YAMANOTE_CAR_LENGTH_METERS = 20;
  const YAMANOTE_CAR_GAP_METERS = 2.5;
  const YAMANOTE_CAR_STEP_KM = (YAMANOTE_CAR_LENGTH_METERS + YAMANOTE_CAR_GAP_METERS) / 1000;
  const yamanoteLeadMapPosition = {};
  const yamanoteAheadMapPosition = {};
  const yamanoteTrainScreenPoint = {};
  const yamanoteFollowCarPositions = [];
  const routeStationMapPositions = [];

  function mapWorldX(lon) {
    return (lon - MAP_REFERENCE_LONGITUDE) * MAP_METERS_PER_LONGITUDE;
  }

  function mapWorldY(lat) {
    return (MAP_REFERENCE_LATITUDE - lat) * MAP_METERS_PER_LATITUDE;
  }

  function yamanoteMapPositionAt(rawKm, target = {}, map = activeRouteMap()) {
    if (!map) return target;
    let km = rawKm;
    if (map.loopKm) km = ((km % map.loopKm) + map.loopKm) % map.loopKm;
    const points = map.points;
    let nextIndex = points.findIndex((point) => point.km >= km);
    if (nextIndex < 0) nextIndex = points.length - 1;
    else if (nextIndex === 0) nextIndex = 1;
    const previous = points[nextIndex - 1];
    const next = points[nextIndex];
    const progress = (km - previous.km) / Math.max(next.km - previous.km, 0.001);
    const previousX = mapWorldX(previous.lon);
    const previousY = mapWorldY(previous.lat);
    const nextX = mapWorldX(next.lon);
    const nextY = mapWorldY(next.lat);
    target.km = km;
    target.lon = previous.lon + (next.lon - previous.lon) * progress;
    target.lat = previous.lat + (next.lat - previous.lat) * progress;
    target.worldX = previousX + (nextX - previousX) * progress;
    target.worldY = previousY + (nextY - previousY) * progress;
    target.angle = Math.atan2(nextY - previousY, nextX - previousX);
    return target;
  }
  function yamanoteMapPosition() {
    return yamanoteMapPositionAt(yamanoteMapKm(), yamanoteLeadMapPosition);
  }

  function mapScenePoint(scene, worldX, worldY, target = {}) {
    target.x = scene.screenCenterX + (worldX - scene.centerWorldX) * scene.scale;
    target.y = scene.screenCenterY + (worldY - scene.centerWorldY) * scene.scale;
    return target;
  }

  function yamanoteOverviewScene() {
    const map = activeRouteMap();
    const portrait = H > W;
    const left = W * (portrait ? 0.055 : 0.14);
    const right = W * 0.96;
    const top = H * (portrait ? 0.08 : 0.07);
    const bottom = H * (portrait ? 0.84 : 0.92);
    const minWorldX = mapWorldX(map.minLon);
    const maxWorldX = mapWorldX(map.maxLon);
    const minWorldY = mapWorldY(map.maxLat);
    const maxWorldY = mapWorldY(map.minLat);
    const span = Math.max(maxWorldX - minWorldX, maxWorldY - minWorldY, 1000);
    const padding = Math.max(700, span * 0.07);
    const scale = Math.min(
      (right - left) / Math.max(maxWorldX - minWorldX + padding * 2, 1),
      (bottom - top) / Math.max(maxWorldY - minWorldY + padding * 2, 1),
    );
    return {
      mode: "overview", portrait, left, right, top, bottom, scale,
      centerWorldX: (minWorldX + maxWorldX) / 2,
      centerWorldY: (minWorldY + maxWorldY) / 2,
      screenCenterX: (left + right) / 2,
      screenCenterY: (top + bottom) / 2,
      carPositions: null,
    };
  }
  function yamanoteFollowScene() {
    const portrait = H > W;
    const left = W * (portrait ? 0.055 : 0.14);
    const right = W * 0.96;
    const top = H * (portrait ? 0.08 : 0.07);
    const bottom = H * (portrait ? 0.86 : 0.92);
    const count = totalCarCount();
    const leadKm = yamanoteMapKm();
    while (yamanoteFollowCarPositions.length < count) yamanoteFollowCarPositions.push({});
    yamanoteFollowCarPositions.length = count;

    let minWorldX = Infinity;
    let maxWorldX = -Infinity;
    let minWorldY = Infinity;
    let maxWorldY = -Infinity;
    for (let index = 0; index < count; index++) {
      const position = yamanoteMapPositionAt(
        leadKm - routeDirection * index * YAMANOTE_CAR_STEP_KM,
        yamanoteFollowCarPositions[index],
      );
      minWorldX = Math.min(minWorldX, position.worldX);
      maxWorldX = Math.max(maxWorldX, position.worldX);
      minWorldY = Math.min(minWorldY, position.worldY);
      maxWorldY = Math.max(maxWorldY, position.worldY);
    }

    const trainLength = count * (YAMANOTE_CAR_LENGTH_METERS + YAMANOTE_CAR_GAP_METERS);
    const aheadMeters = Math.max(140, trainLength * 0.16);
    const ahead = yamanoteMapPositionAt(
      leadKm + routeDirection * aheadMeters / 1000,
      yamanoteAheadMapPosition,
    );
    minWorldX = Math.min(minWorldX, ahead.worldX);
    maxWorldX = Math.max(maxWorldX, ahead.worldX);
    minWorldY = Math.min(minWorldY, ahead.worldY);
    maxWorldY = Math.max(maxWorldY, ahead.worldY);

    const padding = Math.max(90, trainLength * 0.14);
    const worldWidth = Math.max(240, maxWorldX - minWorldX + padding * 2);
    const worldHeight = Math.max(180, maxWorldY - minWorldY + padding * 1.6);
    const scale = Math.min(
      (right - left) / worldWidth,
      (bottom - top) / worldHeight,
      portrait ? 1.8 : 3.2,
    );
    return {
      mode: "follow", portrait, left, right, top, bottom, scale,
      centerWorldX: (minWorldX + maxWorldX) / 2,
      centerWorldY: (minWorldY + maxWorldY) / 2,
      screenCenterX: (left + right) / 2,
      screenCenterY: (top + bottom) / 2,
      carPositions: yamanoteFollowCarPositions,
    };
  }

  function drawMapGeoPath(scene, points, pixelOffset = 0) {
    ctx.beginPath();
    for (let index = 0; index < points.length; index++) {
      const point = points[index];
      const previous = points[Math.max(0, index - 1)];
      const next = points[Math.min(points.length - 1, index + 1)];
      let x = scene.screenCenterX + (mapWorldX(point[0]) - scene.centerWorldX) * scene.scale;
      let y = scene.screenCenterY + (mapWorldY(point[1]) - scene.centerWorldY) * scene.scale;
      if (pixelOffset) {
        const dx = (mapWorldX(next[0]) - mapWorldX(previous[0])) * scene.scale;
        const dy = (mapWorldY(next[1]) - mapWorldY(previous[1])) * scene.scale;
        const length = Math.max(Math.hypot(dx, dy), 0.001);
        x += -dy / length * pixelOffset;
        y += dx / length * pixelOffset;
      }
      if (index) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
  }
  function mapPointIsVisible(scene, x, y, margin = 30) {
    return x >= -margin && x <= W + margin && y >= -margin && y <= H + margin;
  }

  const MAP_TOWN_BLOCKS = [];
  let mapTownBlocksReady = false;

  function ensureMapTownBlocks() {
    if (mapTownBlocksReady) return;
    mapTownBlocksReady = true;
    let routeNumber = 0;
    for (const mapKey of MAP_ROUTE_DRAW_ORDER) {
      const map = ROUTE_MAPS[mapKey];
      const stepKm = map.endKm > 100 ? 10 : 1.8;
      const position = {};
      for (let km = 0; km <= map.endKm; km += stepKm) {
        yamanoteMapPositionAt(km, position, map);
        for (let blockIndex = 0; blockIndex < 4; blockIndex++) {
          const seed = routeNumber * 97 + Math.round(km * 10) * 13 + blockIndex * 31;
          const side = blockIndex % 2 ? 1 : -1;
          const lateral = side * (90 + seed % 170);
          const along = (seed * 17) % 360 - 180;
          const cos = Math.cos(position.angle);
          const sin = Math.sin(position.angle);
          MAP_TOWN_BLOCKS.push({
            worldX: position.worldX + cos * along - sin * lateral,
            worldY: position.worldY + sin * along + cos * lateral,
            width: 28 + seed % 45,
            height: 22 + (seed * 7) % 38,
            colorIndex: seed % BUILDING_COLORS.length,
            park: seed % 17 === 0,
          });
        }
      }
      routeNumber++;
    }
  }

  function drawMapTownscape(scene) {
    ensureMapTownBlocks();
    ctx.save();
    for (let index = 0; index < MAP_TOWN_BLOCKS.length; index++) {
      const block = MAP_TOWN_BLOCKS[index];
      const x = scene.screenCenterX + (block.worldX - scene.centerWorldX) * scene.scale;
      const y = scene.screenCenterY + (block.worldY - scene.centerWorldY) * scene.scale;
      if (!mapPointIsVisible(scene, x, y, 35)) continue;
      if (scene.scale < 0.007) {
        if (index % 12) continue;
        ctx.fillStyle = timeOfDay === "night" ? "rgba(255,220,120,0.62)" : "rgba(151,164,152,0.58)";
        ctx.beginPath();
        ctx.arc(x, y, 2.3, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      const width = Math.max(4, Math.min(30, block.width * scene.scale));
      const height = Math.max(4, Math.min(26, block.height * scene.scale));
      if (block.park) {
        ctx.fillStyle = timeOfDay === "night" ? "#244c3d" : "#9dcc7a";
        ctx.beginPath();
        ctx.ellipse(x, y, width * 0.8, height * 0.72, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = timeOfDay === "night"
          ? ["#46505a", "#3f4d59", "#554b50", "#445148"][block.colorIndex]
          : BUILDING_COLORS[block.colorIndex];
        ctx.fillRect(x - width / 2, y - height / 2, width, height);
        ctx.strokeStyle = timeOfDay === "night" ? "rgba(255,222,130,0.40)" : "rgba(95,105,110,0.20)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x - width / 2, y - height / 2, width, height);
      }
    }
    ctx.restore();
  }

  function drawYamanoteMapBackground(scene) {
    const mapGradient = ctx.createLinearGradient(0, 0, 0, H);
    mapGradient.addColorStop(0, timeOfDay === "night" ? "#17344a" : "#d9f0f6");
    mapGradient.addColorStop(1, timeOfDay === "night" ? "#10283c" : "#b9dfea");
    ctx.fillStyle = mapGradient;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = timeOfDay === "night" ? "#263f47" : "#e4f0cf";
    ctx.strokeStyle = timeOfDay === "night" ? "rgba(139,180,185,0.72)" : "rgba(81,130,139,0.66)";
    ctx.lineWidth = Math.max(1.2, Math.min(W, H) * 0.0023);
    for (const coastline of MAP_GEOGRAPHY.coastlines) {
      drawMapGeoPath(scene, coastline);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 緯度・経度に沿う簡略道路。追従表示では地図と一緒に流れる。
    ctx.strokeStyle = timeOfDay === "night" ? "rgba(194,210,224,0.10)" : "rgba(255,255,255,0.58)";
    ctx.lineWidth = Math.max(1, Math.min(W, H) * 0.0025);
    for (const roadLine of YAMANOTE_MAP_GRID_LINES) {
      drawMapGeoPath(scene, roadLine);
      ctx.stroke();
    }

    ctx.fillStyle = timeOfDay === "night" ? "#315f78" : "#80c8e2";
    ctx.strokeStyle = timeOfDay === "night" ? "#4c829c" : "#62b4d6";
    ctx.lineWidth = Math.max(1, Math.min(3.5, scene.scale * 40));
    for (const lake of MAP_GEOGRAPHY.lakes) {
      drawMapGeoPath(scene, lake.points);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.strokeStyle = timeOfDay === "night" ? "#4c829c" : "#72bfdc";
    ctx.lineWidth = Math.max(1.2, Math.min(4, scene.scale * 28));
    for (const river of MAP_GEOGRAPHY.rivers) {
      drawMapGeoPath(scene, river.points);
      ctx.stroke();
    }

    if (scene.scale >= 0.0015) {
      ctx.font = "bold " + Math.max(9, Math.min(W, H) * 0.014) + "px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = timeOfDay === "night" ? "rgba(205,231,245,0.82)" : "rgba(45,112,145,0.84)";
      for (const lake of MAP_GEOGRAPHY.lakes) {
        const point = lake.points[Math.floor(lake.points.length / 2)];
        const x = scene.screenCenterX + (mapWorldX(point[0]) - scene.centerWorldX) * scene.scale;
        const y = scene.screenCenterY + (mapWorldY(point[1]) - scene.centerWorldY) * scene.scale;
        if (mapPointIsVisible(scene, x, y, 20)) ctx.fillText(lake.name, x, y - 3);
      }
      for (const river of MAP_GEOGRAPHY.rivers) {
        const point = river.points[Math.floor(river.points.length / 2)];
        const x = scene.screenCenterX + (mapWorldX(point[0]) - scene.centerWorldX) * scene.scale;
        const y = scene.screenCenterY + (mapWorldY(point[1]) - scene.centerWorldY) * scene.scale;
        if (mapPointIsVisible(scene, x, y, 20)) ctx.fillText(river.name, x, y - 3);
      }
    }

    const palaceX = scene.screenCenterX + (mapWorldX(139.7528) - scene.centerWorldX) * scene.scale;
    const palaceY = scene.screenCenterY + (mapWorldY(35.6852) - scene.centerWorldY) * scene.scale;
    ctx.fillStyle = timeOfDay === "night" ? "#315842" : "#a7d58b";
    ctx.beginPath();
    ctx.ellipse(
      palaceX, palaceY,
      Math.max(10, 700 * scene.scale), Math.max(8, 550 * scene.scale),
      -0.15, 0, Math.PI * 2,
    );
    ctx.fill();
  }

  function drawYamanoteRelatedLines(scene, labelSize) {
    const currentKey = activeRouteMapKey();
    const routeWidth = scene.mode === "follow"
      ? Math.max(2, Math.min(4.5, scene.scale * 3.2))
      : Math.max(2, Math.min(6, scene.scale * 6));
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const mapKey of MAP_ROUTE_DRAW_ORDER) {
      if (mapKey === currentKey) continue;
      const map = ROUTE_MAPS[mapKey];
      const offset = MAP_ROUTE_LANE_OFFSETS[mapKey] || 0;
      ctx.strokeStyle = "rgba(255,255,255,0.78)";
      ctx.lineWidth = routeWidth + 3.5;
      drawMapGeoPath(scene, map.coords, offset);
      ctx.stroke();
      ctx.strokeStyle = map.color;
      ctx.globalAlpha = 0.76;
      ctx.lineWidth = routeWidth;
      drawMapGeoPath(scene, map.coords, offset);
      ctx.stroke();
      ctx.globalAlpha = 1;

      const labelPoint = map.points[Math.floor(map.points.length / 2)];
      const labelX = scene.screenCenterX + (mapWorldX(labelPoint.lon) - scene.centerWorldX) * scene.scale;
      const labelY = scene.screenCenterY + (mapWorldY(labelPoint.lat) - scene.centerWorldY) * scene.scale;
      if (!mapPointIsVisible(scene, labelX, labelY) || scene.scale < 0.02 || (scene.mode === "follow" && scene.scale < 0.12)) continue;
      ctx.font = "bold " + Math.max(9, labelSize * 0.56) + "px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = timeOfDay === "night" ? "rgba(244,247,251,0.82)" : "rgba(48,62,80,0.78)";
      ctx.fillText(map.name, labelX, labelY - 5);
    }
    ctx.restore();
  }

  function drawYamanoteRoute(scene, labelSize) {
    const map = activeRouteMap();
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const routeWidth = scene.mode === "follow"
      ? Math.max(4, Math.min(8, scene.scale * 5))
      : Math.max(5, Math.min(13, scene.scale * 10));
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = routeWidth + 7;
    drawMapGeoPath(scene, map.coords);
    ctx.stroke();
    ctx.strokeStyle = map.color;
    ctx.lineWidth = routeWidth;
    drawMapGeoPath(scene, map.coords);
    ctx.stroke();

    const stationList = [{ name: activeRoute.start, km: activeRoute.startKm }, ...activeRoute.stations.slice(0, -1)];
    while (routeStationMapPositions.length < stationList.length) routeStationMapPositions.push({});
    ctx.font = "bold " + labelSize + "px sans-serif";
    ctx.textBaseline = "bottom";
    for (let index = 0; index < stationList.length; index++) {
      const station = stationList[index];
      const position = yamanoteMapPositionAt(station.km, routeStationMapPositions[index], map);
      const x = scene.screenCenterX + (position.worldX - scene.centerWorldX) * scene.scale;
      const y = scene.screenCenterY + (position.worldY - scene.centerWorldY) * scene.scale;
      if (!mapPointIsVisible(scene, x, y)) continue;
      const important = activeRoute.cityStations.has(station.name)
        || station.name === currentStationName || station.name === nextStationName;
      const showLabel = scene.mode === "overview" ? important : important || scene.scale >= 0.7;
      ctx.fillStyle = important ? "#ffffff" : "#dfe8d7";
      ctx.strokeStyle = important ? "#334155" : "#617064";
      ctx.lineWidth = important ? 2.5 : 1.2;
      ctx.beginPath();
      ctx.arc(x, y, important ? 5.5 : 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (!showLabel) continue;
      ctx.fillStyle = timeOfDay === "night" ? "#f4f7fb" : "#344054";
      ctx.textAlign = "center";
      ctx.fillText(station.name, x, y - labelSize * 0.55);
    }
    ctx.restore();
  }

  function drawYamanoteLandmarks(scene, labelSize) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const landmark of YAMANOTE_MAP_LANDMARKS) {
      const x = scene.screenCenterX + (mapWorldX(landmark.lon) - scene.centerWorldX) * scene.scale;
      const y = scene.screenCenterY + (mapWorldY(landmark.lat) - scene.centerWorldY) * scene.scale;
      if (!mapPointIsVisible(scene, x, y, 50)) continue;
      ctx.font = (labelSize * 1.25) + "px sans-serif";
      ctx.fillText(landmark.icon, x, y - labelSize * 0.3);
      ctx.font = "bold " + Math.max(8, labelSize * 0.68) + "px sans-serif";
      ctx.fillStyle = timeOfDay === "night" ? "#e9eef6" : "#51606f";
      ctx.fillText(landmark.name, x, y + labelSize * 0.95);
    }
    for (const landmark of MAP_GEOGRAPHY.landmarks) {
      const x = scene.screenCenterX + (mapWorldX(landmark.lon) - scene.centerWorldX) * scene.scale;
      const y = scene.screenCenterY + (mapWorldY(landmark.lat) - scene.centerWorldY) * scene.scale;
      if (!mapPointIsVisible(scene, x, y, 60)) continue;
      ctx.font = Math.max(18, labelSize * 1.7) + "px sans-serif";
      ctx.fillText(landmark.icon, x, y - labelSize * 0.3);
      ctx.font = "bold " + Math.max(9, labelSize * 0.72) + "px sans-serif";
      ctx.fillStyle = timeOfDay === "night" ? "#eef5ff" : "#526578";
      ctx.fillText(landmark.name, x, y + labelSize * 1.15);
    }
    ctx.restore();
  }

  function drawYamanoteFollowTrain(scene) {
    const count = scene.carPositions.length;
    const directionAngle = routeDirection < 0 ? Math.PI : 0;
    const carLength = Math.max(5, YAMANOTE_CAR_LENGTH_METERS * scene.scale);
    const carWidth = Math.max(8, 3.2 * scene.scale);

    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(55,63,70,0.72)";
    ctx.lineWidth = Math.max(2, carWidth * 0.32);
    for (let index = 0; index < count - 1; index++) {
      const current = scene.carPositions[index];
      const next = scene.carPositions[index + 1];
      const currentX = scene.screenCenterX + (current.worldX - scene.centerWorldX) * scene.scale;
      const currentY = scene.screenCenterY + (current.worldY - scene.centerWorldY) * scene.scale;
      const nextX = scene.screenCenterX + (next.worldX - scene.centerWorldX) * scene.scale;
      const nextY = scene.screenCenterY + (next.worldY - scene.centerWorldY) * scene.scale;
      ctx.beginPath();
      ctx.moveTo(currentX, currentY);
      ctx.lineTo(nextX, nextY);
      ctx.stroke();
    }

    // 後ろから描いて先頭車を最後に重ねる。
    for (let index = count - 1; index >= 0; index--) {
      const position = scene.carPositions[index];
      const x = scene.screenCenterX + (position.worldX - scene.centerWorldX) * scene.scale;
      const y = scene.screenCenterY + (position.worldY - scene.centerWorldY) * scene.scale;
      const carTrain = TRAINS[carTypes[index] || trainKey] || train;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(position.angle + directionAngle);
      ctx.shadowColor = "rgba(0,0,0,0.28)";
      ctx.shadowBlur = Math.min(7, carWidth);
      ctx.fillStyle = carTrain.body;
      roundRect(-carLength / 2, -carWidth / 2, carLength, carWidth, Math.max(2, carWidth * 0.42));
      ctx.fill();
      ctx.strokeStyle = "rgba(38,50,71,0.68)";
      ctx.lineWidth = Math.max(2.5, carWidth * 0.42);
      ctx.stroke();
      ctx.strokeStyle = carTrain.edge || "#9aa5ad";
      ctx.lineWidth = Math.max(1, carWidth * 0.16);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = carTrain.stripe;
      ctx.fillRect(-carLength * 0.42, -carWidth * 0.13, carLength * 0.84, carWidth * 0.26);
      if (carTrain.stripe2) {
        ctx.fillStyle = carTrain.stripe2;
        ctx.fillRect(-carLength * 0.42, carWidth * 0.15, carLength * 0.84, carWidth * 0.14);
      }
      if (index === 0) {
        ctx.fillStyle = carTrain.face || carTrain.stripe;
        ctx.fillRect(carLength * 0.28, -carWidth * 0.34, carLength * 0.14, carWidth * 0.68);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawYamanoteOverviewMarker(scene, labelSize, position) {
    const point = mapScenePoint(scene, position.worldX, position.worldY, yamanoteTrainScreenPoint);
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(position.angle + (routeDirection < 0 ? Math.PI : 0));
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#ffffff";
    roundRect(-labelSize * 1.25, -labelSize * 0.7, labelSize * 2.5, labelSize * 1.4, labelSize * 0.55);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = train.body;
    roundRect(-labelSize, -labelSize * 0.42, labelSize * 2, labelSize * 0.84, labelSize * 0.25);
    ctx.fill();
    ctx.fillStyle = train.stripe;
    ctx.fillRect(-labelSize, labelSize * 0.08, labelSize * 2, labelSize * 0.22);
    ctx.fillStyle = train.face || train.stripe;
    ctx.fillRect(labelSize * 0.42, -labelSize * 0.28, labelSize * 0.34, labelSize * 0.28);
    ctx.restore();
    return point;
  }

  function drawMapPowerStar(scene, position, labelSize) {
    if (!fallingStar) {
      mapPowerStarScreenPoint.x = NaN;
      mapPowerStarScreenPoint.y = NaN;
      mapPowerStarScreenPoint.radius = 0;
      return;
    }

    const map = activeRouteMap();
    const firstKm = map.points[0].km;
    const lastKm = map.points[map.points.length - 1].km;
    const desiredScreenDistance = scene.mode === "follow"
      ? Math.min(W * 0.18, 180)
      : Math.min(W * 0.12, 130);
    const aheadKm = Math.max(0.18, desiredScreenDistance / Math.max(scene.scale, 0.001) / 1000);
    let markerKm = position.km + routeDirection * aheadKm;
    if (!map.loopKm) markerKm = Math.max(firstKm, Math.min(lastKm, markerKm));
    const markerPosition = yamanoteMapPositionAt(markerKm, mapPowerStarRoutePosition, map);
    const point = mapScenePoint(scene, markerPosition.worldX, markerPosition.worldY, mapPowerStarScreenPoint);
    const side = routeDirection < 0 ? -1 : 1;
    const offset = Math.max(24, Math.min(38, labelSize * 2.1));
    point.x += -Math.sin(markerPosition.angle) * offset * side;
    point.y += Math.cos(markerPosition.angle) * offset * side;
    const radius = Math.max(24, Math.min(36, labelSize * 1.65));
    point.x = Math.max(scene.left + radius + 8, Math.min(scene.right - radius - 8, point.x));
    point.y = Math.max(scene.top + radius + 8, Math.min(scene.bottom - radius * 1.4 - 8, point.y));
    point.radius = radius + 12;

    const { type } = fallingStar;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.shadowColor = type.glow;
    ctx.shadowBlur = radius * 0.7;
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.strokeStyle = type.accent;
    ctx.lineWidth = Math.max(4, radius * 0.14);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (type.key === "rainbow") {
      const rainbow = ctx.createLinearGradient(-radius, -radius, radius, radius);
      ["#ff4d67", "#ff9f43", "#ffe052", "#50da7d", "#48a9ff", "#9a5bff"].forEach((color, index, colors) => {
        rainbow.addColorStop(index / (colors.length - 1), color);
      });
      ctx.fillStyle = rainbow;
    } else {
      ctx.fillStyle = type.fill;
    }
    drawStarPath(0, -radius * 0.08, radius * 0.52, radius * 0.24, fallingStar.rotation);
    ctx.fill();
    ctx.fillStyle = type.inner;
    drawStarPath(0, -radius * 0.08, radius * 0.25, radius * 0.11, fallingStar.rotation);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const boostText = `×${type.multiplier}`;
    ctx.font = `bold ${Math.max(11, radius * 0.55)}px sans-serif`;
    const pillWidth = ctx.measureText(boostText).width + radius * 0.75;
    ctx.fillStyle = type.badge;
    ctx.strokeStyle = type.accent;
    ctx.lineWidth = 2;
    roundRect(-pillWidth / 2, radius * 0.5, pillWidth, radius * 0.72, radius * 0.36);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = type.text;
    ctx.fillText(boostText, 0, radius * 0.86);
    ctx.restore();
  }

  function drawYamanoteMap() {
    const scene = mapMode === "follow" ? yamanoteFollowScene() : yamanoteOverviewScene();
    const labelSize = Math.max(10, Math.min(W, H) * (scene.portrait ? 0.024 : 0.021));
    drawYamanoteMapBackground(scene);
    drawMapTownscape(scene);
    drawYamanoteRelatedLines(scene, labelSize);
    drawYamanoteRoute(scene, labelSize);
    drawYamanoteLandmarks(scene, labelSize);

    const position = yamanoteMapPosition();
    let trainPoint;
    if (scene.mode === "follow") {
      drawYamanoteFollowTrain(scene);
      trainPoint = mapScenePoint(scene, position.worldX, position.worldY, yamanoteTrainScreenPoint);
    } else {
      trainPoint = drawYamanoteOverviewMarker(scene, labelSize, position);
    }
    drawMapPowerStar(scene, position, labelSize);

    ctx.font = "bold " + (labelSize * 0.86) + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const modeText = scene.mode === "follow" ? "うえから" : "ぜんたい";
    const boostText = starBoostTime > 0
      ? `　${starBoostType.icon} ×${starBoostMultiplier} ${Math.ceil(starBoostTime)}びょう`
      : "";
    const roundedKm = Math.round(position.km * 10) / 10;
    const badgeText = scene.portrait
      ? `${modeText}　${roundedKm}km　🚃${totalCarCount()}　🧭↑${boostText}`
      : modeText + "　" + roundedKm + " km　🚃 " + totalCarCount() + "りょう　🧭 きた↑" + boostText;
    const badgeWidth = ctx.measureText(badgeText).width + labelSize * 1.6;
    ctx.fillStyle = "rgba(255,255,255,0.91)";
    roundRect(W * 0.5 - badgeWidth / 2, H * 0.022, badgeWidth, labelSize * 1.8, labelSize * 0.8);
    ctx.fill();
    ctx.fillStyle = "#263247";
    ctx.fillText(badgeText, W * 0.5, H * 0.022 + labelSize * 0.9);

    ctx.font = Math.max(9, labelSize * 0.62) + "px sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = timeOfDay === "night" ? "rgba(255,255,255,0.72)" : "rgba(38,50,71,0.70)";
    ctx.fillText("© OpenStreetMap contributors / Natural Earth", W - 8, H - 8);

    if (isDebug) {
      canvas.dataset.viewMode = mapMode;
      canvas.dataset.mapRoute = activeRouteMapKey();
      canvas.dataset.mapKm = position.km.toFixed(3);
      canvas.dataset.mapTrainX = String(Math.round(trainPoint.x));
      canvas.dataset.mapTrainY = String(Math.round(trainPoint.y));
      canvas.dataset.mapScale = scene.scale.toFixed(4);
      canvas.dataset.mapTrainCount = String(scene.mode === "follow" ? scene.carPositions.length : 1);
      canvas.dataset.mapPowerStarX = Number.isFinite(mapPowerStarScreenPoint.x) ? String(Math.round(mapPowerStarScreenPoint.x)) : "";
      canvas.dataset.mapPowerStarY = Number.isFinite(mapPowerStarScreenPoint.y) ? String(Math.round(mapPowerStarScreenPoint.y)) : "";
      canvas.dataset.mapPowerStarRadius = mapPowerStarScreenPoint.radius ? String(Math.round(mapPowerStarScreenPoint.radius)) : "";
      if (scene.mode === "follow") {
        let minTrainX = Infinity;
        let maxTrainX = -Infinity;
        let minTrainY = Infinity;
        let maxTrainY = -Infinity;
        for (const carPosition of scene.carPositions) {
          const carX = scene.screenCenterX + (carPosition.worldX - scene.centerWorldX) * scene.scale;
          const carY = scene.screenCenterY + (carPosition.worldY - scene.centerWorldY) * scene.scale;
          minTrainX = Math.min(minTrainX, carX);
          maxTrainX = Math.max(maxTrainX, carX);
          minTrainY = Math.min(minTrainY, carY);
          maxTrainY = Math.max(maxTrainY, carY);
        }
        canvas.dataset.mapTrainBounds = [
          Math.round(minTrainX), Math.round(minTrainY), Math.round(maxTrainX), Math.round(maxTrainY),
        ].join(",");
      } else {
        canvas.dataset.mapTrainBounds = "";
      }
    }
  }
  function drawClouds(dt) {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (const c of clouds) {
      c.x -= (speed * 0.18 + 8) * dt * c.s * travelVisualSign();
      if (c.x < -160) {
        c.x = W + 160;
        c.y = H * (0.05 + Math.random() * 0.25);
      } else if (c.x > W + 160) {
        c.x = -160;
        c.y = H * (0.05 + Math.random() * 0.25);
      }
      const r = 26 * c.s;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, 7);
      ctx.arc(c.x + r, c.y + 6, r * 0.8, 0, 7);
      ctx.arc(c.x - r, c.y + 6, r * 0.75, 0, 7);
      ctx.fill();
    }
  }

  function drawMountains() {
    const base = groundY();
    const { x0, x1 } = viewRange();
    const period = W * 0.7;
    const off = (visualDistance * 0.28) % (W * 1.4);
    ctx.fillStyle = "#9fd48a";
    const iStart = Math.floor((x0 + off - W * 0.35 - W * 0.45) / period);
    const iEnd = Math.ceil((x1 + off - W * 0.35 + W * 0.45) / period);
    for (let i = iStart; i <= iEnd; i++) {
      const x = i * period - off + W * 0.35;
      ctx.beginPath();
      ctx.moveTo(x - W * 0.45, base);
      ctx.quadraticCurveTo(x, base - H * 0.3, x + W * 0.45, base);
      ctx.fill();
    }
  }

  function drawCityscape() {
    const base = groundY();
    const { x0, x1 } = viewRange();
    const rawProgress = (distance - segmentStartDistance) / Math.max(stationWorldX - segmentStartDistance, 1);
    const progress = Math.max(0, Math.min(rawProgress, 1));
    const blend = progress * progress * (3 - 2 * progress);
    const currentCity = activeRoute.cityStations.has(currentStationName) ? 1 : 0;
    const nextCity = activeRoute.cityStations.has(nextStationName) ? 1 : 0;
    const currentMajor = GRAND_STATIONS.has(currentStationName) || MAJOR_STATIONS.has(currentStationName) ? 1 : 0;
    const nextMajor = GRAND_STATIONS.has(nextStationName) || MAJOR_STATIONS.has(nextStationName) ? 1 : 0;
    const cityBlend = currentCity + (nextCity - currentCity) * blend;
    const majorBlend = currentMajor + (nextMajor - currentMajor) * blend;
    const spacing = 118;
    const scroll = visualDistance * 0.48;
    const start = Math.floor((x0 + scroll) / spacing) - 1;
    const end = Math.ceil((x1 + scroll) / spacing) + 1;
    for (let i = start; i <= end; i++) {
      const x = i * spacing - scroll;
      const seed = Math.abs((i * 47) % 97);
      const localWidth = 62 + seed % 45;
      const cityWidth = 72 + seed % 38;
      const width = localWidth + (cityWidth - localWidth) * cityBlend;
      const localHeight = H * (0.065 + (seed % 3) * 0.018);
      const cityHeight = H * (0.11 + (seed % 5) * 0.025);
      const majorHeight = H * (0.11 + (seed % 8) * 0.025);
      const urbanHeight = cityHeight + (majorHeight - cityHeight) * majorBlend;
      const height = localHeight + (urbanHeight - localHeight) * cityBlend;
      const buildingAlpha = Math.abs(i % 2) === 1 ? cityBlend : 1;
      if (buildingAlpha < 0.02) continue;
      ctx.save();
      ctx.globalAlpha = buildingAlpha;
      ctx.fillStyle = BUILDING_COLORS[seed % BUILDING_COLORS.length];
      ctx.fillRect(x, base - height, width, height);
      if (cityBlend < 0.98) {
        ctx.save();
        ctx.globalAlpha = buildingAlpha * (1 - cityBlend);
        ctx.fillStyle = ROOF_COLORS[seed % ROOF_COLORS.length];
        ctx.beginPath();
        ctx.moveTo(x - 7, base - height);
        ctx.lineTo(x + width / 2, base - height - 24);
        ctx.lineTo(x + width + 7, base - height);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = "rgba(255, 248, 196, 0.8)";
      for (let wy = base - height + 18; wy < base - 18; wy += 24) {
        for (let wx = x + 12; wx < x + width - 10; wx += 24) {
          ctx.fillRect(wx, wy, 10, 9);
        }
      }
      ctx.fillStyle = "#667b88";
      ctx.fillRect(x + width * 0.42, base - height - 8, width * 0.16, 8);
      if (cityBlend < 0.98 && seed % 2 === 0) {
        ctx.save();
        ctx.globalAlpha = buildingAlpha * (1 - cityBlend);
        ctx.fillStyle = "#5f9b55";
        ctx.beginPath();
        ctx.arc(x + width + 20, base - 22, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#76533a";
        ctx.fillRect(x + width + 17, base - 18, 6, 18);
        ctx.restore();
      }
      ctx.restore();
    }
  }

  function routeEventAlpha() {
    if (!routeEventAnnounced) return 0;
    const fadeIn = Math.min((routeEventProgress - 0.22) / 0.08, 1);
    const fadeOut = Math.min((0.8 - routeEventProgress) / 0.08, 1);
    return Math.max(0, Math.min(fadeIn, fadeOut));
  }

  function drawFuji() {
    if (routeEvent !== "fuji" || !routeEventAnnounced) return;
    const base = groundY();
    const x = W * (0.96 - routeEventProgress * 0.55);
    const peakY = base - H * 0.52;
    const halfW = W * 0.34;
    ctx.save();
    ctx.globalAlpha = routeEventAlpha();
    ctx.fillStyle = "#7fa8c9";
    ctx.beginPath();
    ctx.moveTo(x - halfW, base);
    ctx.lineTo(x, peakY);
    ctx.lineTo(x + halfW, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(x, peakY);
    ctx.lineTo(x + halfW * 0.22, peakY + H * 0.12);
    ctx.lineTo(x + halfW * 0.1, peakY + H * 0.1);
    ctx.lineTo(x, peakY + H * 0.15);
    ctx.lineTo(x - halfW * 0.1, peakY + H * 0.1);
    ctx.lineTo(x - halfW * 0.22, peakY + H * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function isUndergroundStationView() {
    return state === "stopped" && UNDERGROUND_STATIONS[selectedRouteKey]?.has(currentStationName);
  }

  function isUndergroundDepartureSegment() {
    return routeEvent === "tunnel" && UNDERGROUND_STATIONS[selectedRouteKey]?.has(currentStationName);
  }

  function isTunnelExitSegment() {
    return selectedRouteKey === "inokashira"
      && currentStationName === "しんせん"
      && nextStationName === "こまばとうだいまえ"
      && routeEvent === "tunnel";
  }

  function isTunnelEntrySegment() {
    return selectedRouteKey === "inokashira"
      && currentStationName === "こまばとうだいまえ"
      && nextStationName === "しんせん"
      && routeEvent === "tunnel";
  }

  function tunnelVisualRange() {
    const { x0, x1 } = viewRange();
    return { x0, x1, portalX: null, entering: false };
  }

  function tunnelVisualAlpha() {
    if (!isTunnelVisible()) return 0;
    if (isUndergroundStationView()) return 1;
    const fade = (start, end) => {
      const progress = Math.max(0, Math.min((routeEventProgress - start) / (end - start), 1));
      return progress * progress * (3 - 2 * progress);
    };
    if (isTunnelExitSegment()) return 1 - fade(0.48, 0.68);
    if (isTunnelEntrySegment()) return fade(0.28, 0.5);
    if (isUndergroundDepartureSegment()) return 1 - fade(0.62, 0.8);
    if (routeEventProgress < 0.4) return fade(0.16, 0.3);
    if (routeEventProgress > 0.64) return 1 - fade(0.68, 0.8);
    return 1;
  }

  function isTunnelVisible() {
    return isUndergroundStationView()
      || (routeEvent === "tunnel" && routeEventProgress > 0.12 && routeEventProgress < 0.82);
  }

  function drawTunnel() {
    if (!isTunnelVisible()) return;
    const stationOrDepartureUnderground = isUndergroundStationView() || isUndergroundDepartureSegment();
    const view = viewRange();
    const visual = tunnelVisualRange();
    if (visual.x1 - visual.x0 < 1) return;
    const { x0, x1 } = view;
    const tunnelGroundY = groundY();
    ctx.save();
    ctx.beginPath();
    ctx.rect(visual.x0, 0, visual.x1 - visual.x0, tunnelGroundY);
    ctx.clip();
    ctx.globalAlpha = 0.96 * tunnelVisualAlpha();
    const darkness = ctx.createLinearGradient(0, 0, 0, tunnelGroundY);
    darkness.addColorStop(0, "#0b1019");
    darkness.addColorStop(0.65, "#202a37");
    darkness.addColorStop(1, "#111722");
    ctx.fillStyle = darkness;
    ctx.fillRect(x0, 0, x1 - x0, tunnelGroundY);
    const ribSpacing = 220;
    const off = (visualDistance * 0.75) % ribSpacing;
    for (let x = x0 - off; x < x1 + ribSpacing; x += ribSpacing) {
      ctx.strokeStyle = "#4a5665";
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(x, tunnelGroundY);
      ctx.lineTo(x, H * 0.24);
      ctx.quadraticCurveTo(x + ribSpacing * 0.5, H * 0.08, x + ribSpacing, H * 0.24);
      ctx.lineTo(x + ribSpacing, tunnelGroundY);
      ctx.stroke();
      ctx.strokeStyle = "rgba(155,172,190,0.25)";
      ctx.lineWidth = 3;
      for (let y = H * 0.32; y < tunnelGroundY - 25; y += 58) {
        ctx.beginPath();
        ctx.moveTo(x + 12, y);
        ctx.lineTo(x + ribSpacing - 12, y);
        ctx.stroke();
      }
    }
    ctx.fillStyle = stationOrDepartureUnderground || isTunnelEntrySegment() || headlightsAreOn() ? "#fff4ad" : "#69758a";
    for (let x = x0 + 78 - off; x < x1 + ribSpacing; x += ribSpacing) {
      ctx.shadowBlur = stationOrDepartureUnderground || isTunnelEntrySegment() || headlightsAreOn() ? 18 : 4;
      ctx.shadowColor = ctx.fillStyle;
      ctx.fillRect(x, H * 0.205, 64, 9);
    }
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#778393";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x0, tunnelGroundY - 42);
    ctx.lineTo(x1, tunnelGroundY - 42);
    ctx.stroke();

    ctx.restore();
  }

  function crossingScreenX() {
    if (crossingWorldX === null) return Number.POSITIVE_INFINITY;
    const trainX = W * NOSE_R;
    return trainX + worldScreenOffset(crossingWorldX) * viewScale;
  }

  function drawCrossing() {
    if (routeEvent !== "crossing" || crossingWorldX === null) return;
    const x = worldScreenOffset(crossingWorldX) + W * NOSE_R;
    const { x0, x1 } = viewRange();
    if (x < x0 - 160 || x > x1 + 160) return;
    const nearY = groundY();
    const farY = opposingTrackY();
    ctx.save();
    ctx.fillStyle = "#77736d";
    ctx.fillRect(x - 34, farY - 125, 68, nearY + 190 - farY);
    ctx.fillStyle = "#f2d45c";
    for (let y = farY - 120; y < nearY + 170; y += 32) ctx.fillRect(x - 4, y, 8, 18);
    ctx.strokeStyle = "#f4d13d";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(x - 95, nearY - 105);
    ctx.lineTo(x - 20, nearY - 30);
    ctx.stroke();
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 4;
    for (let i = 0; i < 5; i++) {
      const gx = x - 91 + i * 15;
      const gy = nearY - 101 + i * 15;
      ctx.beginPath(); ctx.moveTo(gx - 5, gy + 5); ctx.lineTo(gx + 5, gy - 5); ctx.stroke();
    }
    ctx.fillStyle = "#f4d13d";
    ctx.fillRect(x - 108, nearY - 112, 12, 112);
    ctx.fillStyle = Math.floor(inspectionTime * 6) % 2 ? "#ff3434" : "#682626";
    ctx.beginPath(); ctx.arc(x - 102, nearY - 126, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("×", x - 102, nearY - 151);
    ctx.fillText("🚗", x + 6, farY - 73);
    ctx.fillText("🐶", x + 8, nearY + 85);
    ctx.restore();
  }

  function drawWeather(dt) {
    weatherTime += dt;
    if (weather === "sunny") return;
    ctx.save();
    ctx.globalAlpha = 1 - tunnelVisualAlpha();
    if (ctx.globalAlpha <= 0.01) {
      ctx.restore();
      return;
    }
    if (weather === "rain") {
      ctx.strokeStyle = "rgba(205,235,255,0.72)";
      ctx.lineWidth = 2;
      const rainSpan = W + 80;
      for (let i = 0; i < 85; i++) {
        const x = ((i * 79 - weatherTime * 310) % rainSpan + rainSpan) % rainSpan - 40;
        const y = (i * 47 + weatherTime * 520) % (H + 50) - 25;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 12, y + 25); ctx.stroke();
      }
    } else if (weather === "snow") {
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      for (let i = 0; i < 65; i++) {
        const x = (i * 97 + Math.sin(weatherTime + i) * 35) % (W + 30);
        const y = (i * 53 + weatherTime * (35 + i % 25)) % (H + 20);
        ctx.beginPath(); ctx.arc(x, y, 2 + i % 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  function opposingTrackY() {
    return groundY() - Math.max(72, H * 0.12);
  }

  function drawTrack() {
    const y = groundY();
    const farY = opposingTrackY();
    const { x0, x1 } = viewRange();

    // 向こう側の線路
    ctx.fillStyle = "#aaa18d";
    ctx.fillRect(x0, farY - 6, x1 - x0, 24);
    ctx.fillStyle = "#756b59";
    const farSpacing = 42;
    const farOff = (visualDistance * 0.55) % farSpacing;
    for (let x = -farOff + Math.floor((x0 + farOff) / farSpacing) * farSpacing; x < x1; x += farSpacing) {
      ctx.fillRect(x, farY - 3, 24, 18);
    }
    ctx.fillStyle = "#545a60";
    ctx.fillRect(x0, farY, x1 - x0, 4);
    ctx.fillRect(x0, farY + 11, x1 - x0, 4);

    // 手前側の線路
    ctx.fillStyle = "#8a7a5c";
    ctx.fillRect(x0, y, x1 - x0, (H - y) / viewScale);
    ctx.fillStyle = "#6d5f45";
    const spacing = 46;
    const off = visualDistance % spacing;
    for (let x = -off + Math.floor((x0 + off) / spacing) * spacing; x < x1; x += spacing) {
      ctx.fillRect(x, y + 10, 26, 8);
    }
    ctx.fillStyle = "#555";
    ctx.fillRect(x0, y + 6, x1 - x0, 4);
  }

  function scheduleNextOpposingTrain(initial = false) {
    const isShinkansenRoute = selectedRouteKey === "tokaido" || selectedRouteKey === "tohoku";
    const minimum = isShinkansenRoute ? 2.4 : 1.2;
    const variation = isShinkansenRoute ? 3.2 : 2.6;
    nextOpposingTrainIn = (minimum + Math.random() * variation) * (initial ? 0.7 : 1);
  }

  function spawnOpposingTrain(typeIndex = null) {
    const pool = opposingTrainPoolForSegment();
    const index = typeIndex === null
      ? Math.floor(Math.random() * pool.length)
      : typeIndex % pool.length;
    const type = pool[index];
    const { x0, x1 } = viewRange();
    const cars = Array.isArray(type.cars)
      ? type.cars[Math.floor(Math.random() * type.cars.length)]
      : type.cars;
    const direction = trainFacesLeft() ? 1 : -1;
    const carW = Math.min(W * 0.13, 115);
    const trainWidth = cars * (carW + 5);
    opposingTrain = {
      type,
      x: direction < 0 ? x1 + 180 : x0 - trainWidth - 180,
      cars,
      direction,
      speed: type.speedKmh / SPEED_DISPLAY_SCALE,
    };
  }

  function updateOpposingTrain(dt) {
    if (state === "select" || mapMode !== "scenery") return;
    if (!opposingTrain) {
      // 速く走るほど短い時間で多くの列車と出会う。上限は描画が混みすぎないためのもの。
      const encounterRate = 1 + Math.min(displaySpeed(speed), 1200) / 400;
      nextOpposingTrainIn -= dt * encounterRate;
      if (nextOpposingTrainIn <= 0) spawnOpposingTrain();
      return;
    }

    const carW = Math.min(W * 0.13, 115);
    const { x0, x1 } = viewRange();
    // 自分と対向列車の速度を足した相対速度で、すれ違う速さを表現する。
    opposingTrain.x += opposingTrain.direction * (opposingTrain.speed + speed) * dt;
    const trainWidth = opposingTrain.cars * (carW + 5);
    const leftView = opposingTrain.x + trainWidth < x0 - 120;
    const rightView = opposingTrain.x > x1 + 120;
    if ((opposingTrain.direction < 0 && leftView) || (opposingTrain.direction > 0 && rightView)) {
      opposingTrain = null;
      scheduleNextOpposingTrain();
    }
  }

  function drawOpposingTrain() {
    if (!opposingTrain) return;
    const { type } = opposingTrain;
    const y = opposingTrackY();
    const carW = Math.min(W * 0.13, 115);
    const carH = carW * 0.34;
    const gap = 5;
    const trainWidth = opposingTrain.cars * (carW + gap);
    ctx.save();
    if (opposingTrain.direction > 0) {
      const centerX = opposingTrain.x + trainWidth / 2;
      ctx.translate(centerX * 2, 0);
      ctx.scale(-1, 1);
    }

    for (let i = 0; i < opposingTrain.cars; i++) {
      const left = opposingTrain.x + i * (carW + gap);
      const right = left + carW;
      const top = y - carH + 1;
      const isEngine = i === 0;
      const isRear = i === opposingTrain.cars - 1;
      const isEndCar = isEngine || isRear;
      const isCoupledCar = type.coupledAtCar !== undefined && i >= type.coupledAtCar;
      const bodyColor = isCoupledCar ? type.coupledBody : type.body;
      const stripeColor = isCoupledCar ? type.coupledStripe : type.stripe;
      const stripe2Color = isCoupledCar ? null : type.stripe2;

      if (type.kind === "freight" && !isEngine) {
        const containerColors = ["#b6533c", "#4f7892", "#9b7b3c", "#52745b"];
        ctx.fillStyle = containerColors[i % containerColors.length];
        ctx.fillRect(left + 3, top + 6, carW - 6, carH - 7);
        ctx.fillStyle = "#313940";
        ctx.fillRect(left, top + carH - 3, carW, 4);
      } else {
        ctx.fillStyle = bodyColor;
        ctx.strokeStyle = "#56616a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (type.kind === "shinkansen" && isEngine) {
          // 左へ走る基準形。進行方向を反転する時は編成全体を鏡映する。
          ctx.moveTo(right - 5, top);
          ctx.lineTo(left + carW * 0.42, top);
          ctx.quadraticCurveTo(left + carW * 0.12, top + 2, left, top + carH - 8);
          ctx.quadraticCurveTo(left, top + carH, left + 8, top + carH);
          ctx.lineTo(right - 5, top + carH);
          ctx.quadraticCurveTo(right, top + carH, right, top + carH - 5);
          ctx.lineTo(right, top + 5);
          ctx.quadraticCurveTo(right, top, right - 5, top);
        } else if (type.kind === "shinkansen" && isRear) {
          ctx.moveTo(left + 5, top);
          ctx.lineTo(right - carW * 0.42, top);
          ctx.quadraticCurveTo(right - carW * 0.12, top + 2, right, top + carH - 8);
          ctx.quadraticCurveTo(right, top + carH, right - 8, top + carH);
          ctx.lineTo(left + 5, top + carH);
          ctx.quadraticCurveTo(left, top + carH, left, top + carH - 5);
          ctx.lineTo(left, top + 5);
          ctx.quadraticCurveTo(left, top, left + 5, top);
        } else if (type.kind === "freight" && isEngine) {
          ctx.moveTo(right - 4, top);
          ctx.lineTo(left + carW * 0.24, top);
          ctx.lineTo(left, top + carH * 0.3);
          ctx.lineTo(left, top + carH);
          ctx.lineTo(right, top + carH);
          ctx.lineTo(right, top + 4);
          ctx.quadraticCurveTo(right, top, right - 4, top);
        } else {
          roundRect(left, top, carW, carH, 7);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = stripeColor;
        if (type.kind === "shinkansen" && isEngine) {
          ctx.beginPath();
          ctx.moveTo(left + carW * 0.06, top + carH * 0.75);
          ctx.lineTo(left + carW * 0.38, top + carH * 0.44);
          ctx.lineTo(right - 2, top + carH * 0.5);
          ctx.lineTo(right - 2, top + carH * 0.67);
          ctx.lineTo(left + carW * 0.08, top + carH * 0.9);
          ctx.closePath();
          ctx.fill();
        } else if (type.kind === "shinkansen" && isRear) {
          ctx.beginPath();
          ctx.moveTo(right - carW * 0.06, top + carH * 0.75);
          ctx.lineTo(right - carW * 0.38, top + carH * 0.44);
          ctx.lineTo(left + 2, top + carH * 0.5);
          ctx.lineTo(left + 2, top + carH * 0.67);
          ctx.lineTo(right - carW * 0.08, top + carH * 0.9);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(left + 2, top + carH * 0.58, carW - 4, carH * 0.16);
        }
        if (stripe2Color) {
          ctx.fillStyle = stripe2Color;
          if (type.kind === "shinkansen" && isEngine) {
            ctx.beginPath();
            ctx.moveTo(left + carW * 0.1, top + carH * 0.86);
            ctx.lineTo(left + carW * 0.4, top + carH * 0.64);
            ctx.lineTo(right - 2, top + carH * 0.7);
            ctx.lineTo(right - 2, top + carH * 0.78);
            ctx.lineTo(left + carW * 0.12, top + carH * 0.94);
            ctx.closePath();
            ctx.fill();
          } else if (type.kind === "shinkansen" && isRear) {
            ctx.beginPath();
            ctx.moveTo(right - carW * 0.1, top + carH * 0.86);
            ctx.lineTo(right - carW * 0.4, top + carH * 0.64);
            ctx.lineTo(left + 2, top + carH * 0.7);
            ctx.lineTo(left + 2, top + carH * 0.78);
            ctx.lineTo(right - carW * 0.12, top + carH * 0.94);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.fillRect(left + 2, top + carH * 0.76, carW - 4, carH * 0.08);
          }
        }

        if (type.kind === "shinkansen") {
          ctx.fillStyle = "#293947";
          if (isEndCar) {
            const windshieldX = isEngine ? left + carW * 0.3 : right - carW * 0.47;
            roundRect(windshieldX, top + carH * 0.18, carW * 0.17, carH * 0.2, 3);
            ctx.fill();
          } else {
            for (let wi = 0; wi < 3; wi++) {
              roundRect(left + carW * (0.13 + wi * 0.27), top + carH * 0.2, carW * 0.17, carH * 0.24, 3);
              ctx.fill();
            }
          }
        } else if (type.kind === "local" && isEndCar) {
          // 在来線は編成端に色付きの運転台面と大きな前面窓を付ける。
          const cabW = carW * 0.2;
          const cabX = isEngine ? left + 2 : right - cabW - 2;
          ctx.fillStyle = stripeColor;
          ctx.fillRect(cabX, top + 2, cabW, carH - 4);
          ctx.fillStyle = "#263746";
          roundRect(cabX + cabW * 0.16, top + carH * 0.18, cabW * 0.68, carH * 0.3, 3);
          ctx.fill();
          ctx.fillStyle = "#293947";
          const sideStart = isEngine ? left + carW * 0.34 : left + carW * 0.12;
          for (let wi = 0; wi < 2; wi++) {
            roundRect(sideStart + wi * carW * 0.27, top + carH * 0.2, carW * 0.17, carH * 0.24, 3);
            ctx.fill();
          }
        } else if (type.kind === "freight" && isEngine) {
          ctx.fillStyle = "#20272c";
          roundRect(left + carW * 0.18, top + carH * 0.17, carW * 0.28, carH * 0.28, 3);
          ctx.fill();
          ctx.fillRect(right - carW * 0.18, top - carH * 0.23, carW * 0.11, carH * 0.28);
        } else {
          ctx.fillStyle = "#293947";
          for (let wi = 0; wi < 3; wi++) {
            roundRect(left + carW * (0.13 + wi * 0.27), top + carH * 0.2, carW * 0.17, carH * 0.24, 3);
            ctx.fill();
          }
        }
      }

      ctx.fillStyle = "#34383b";
      ctx.beginPath();
      ctx.arc(left + carW * 0.24, y + 2, 6, 0, Math.PI * 2);
      ctx.arc(left + carW * 0.76, y + 2, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function formatTrackDistance(worldX) {
    const meters = Math.round(worldX / PIXELS_PER_METER);
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`;
  }

  function drawDistanceMarkers() {
    const y = groundY();
    const noseX = W * NOSE_R;
    const { x0, x1 } = viewRange();
    const markerSpacing = PIXELS_PER_METER * 100;
    const worldEdgeA = distance + (x0 - noseX) / travelVisualSign();
    const worldEdgeB = distance + (x1 - noseX) / travelVisualSign();
    const worldLeft = Math.min(worldEdgeA, worldEdgeB);
    const worldRight = Math.max(worldEdgeA, worldEdgeB);
    const firstMarker = Math.max(markerSpacing, Math.ceil(worldLeft / markerSpacing) * markerSpacing);

    for (let worldX = firstMarker; worldX <= worldRight; worldX += markerSpacing) {
      const x = worldScreenOffset(worldX) + noseX;
      ctx.fillStyle = "#f7fbff";
      ctx.strokeStyle = "#2a5caa";
      ctx.lineWidth = 2;
      roundRect(x - 32, y + 22, 64, 28, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#2a5caa";
      ctx.font = "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(formatTrackDistance(worldX), x, y + 42);
      ctx.fillStyle = "#586879";
      ctx.fillRect(x - 2, y + 50, 4, 24);
    }
  }

  function drawInspectionEffect() {
    if (routeEvent !== "inspection" || !routeEventAnnounced) return;
    const y = groundY();
    const { x0, x1 } = viewRange();
    const scanX = x0 + ((inspectionTime * 260) % Math.max(x1 - x0, 1));
    ctx.save();
    ctx.globalAlpha = routeEventAlpha();
    const glow = ctx.createLinearGradient(scanX - 90, 0, scanX + 90, 0);
    glow.addColorStop(0, "rgba(65,225,255,0)");
    glow.addColorStop(0.5, "rgba(65,225,255,0.9)");
    glow.addColorStop(1, "rgba(65,225,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(scanX - 90, y - 8, 180, 38);
    ctx.fillStyle = "#d8fbff";
    for (let i = 0; i < 4; i++) {
      const sparkleX = scanX - 55 + i * 36;
      const sparkleY = y + 8 + Math.sin(inspectionTime * 7 + i) * 8;
      ctx.beginPath();
      ctx.arc(sparkleX, sparkleY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawHeadlight() {
    const tunnelActive = routeEvent === "tunnel" && routeEventAnnounced;
    if (!headlightsAreOn() || (!tunnelActive && timeOfDay !== "night")) return;
    const { carW, gap } = carMetrics();
    const frontX = W * NOSE_R + trainStationOffset() + (komachiCoupled ? komachiGap + carW * 2 + gap : 0);
    const centerY = groundY() - carW * 0.16;
    const beam = ctx.createLinearGradient(frontX, 0, frontX + W * 0.4, 0);
    beam.addColorStop(0, "rgba(255,244,160,0.75)");
    beam.addColorStop(1, "rgba(255,244,160,0)");
    ctx.save();
    ctx.globalAlpha = tunnelActive ? routeEventAlpha() : 0.72;
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(frontX - 4, centerY - 7);
    ctx.lineTo(frontX + W * 0.42, centerY - H * 0.13);
    ctx.lineTo(frontX + W * 0.42, centerY + H * 0.13);
    ctx.lineTo(frontX - 4, centerY + 7);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = tunnelActive ? routeEventAlpha() : 0.95;
    ctx.fillStyle = "#fff8bf";
    ctx.beginPath();
    ctx.arc(frontX - 3, centerY, Math.max(3, carW * 0.025), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawStationCelebration(worldX, name) {
    const celebration = stationCelebrationFor(name);
    if (!celebration || (state !== "running" && state !== "stopped")) return;
    const screenX = stationScreenX(worldX, name);
    const { x0, x1 } = viewRange();
    if (screenX - 260 > x1 || screenX + 260 < x0) return;
    const baseY = groundY();
    ctx.save();
    ctx.globalAlpha = state === "stopped" && name === currentStationName ? 1 : 0.88;
    ctx.font = `${Math.max(42, H * 0.075)}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    celebration.symbols.forEach((symbol, index) => {
      const offsetX = (index - (celebration.symbols.length - 1) / 2) * Math.max(110, W * 0.09);
      const offsetY = index % 2 === 0 ? H * 0.19 : H * 0.27;
      ctx.fillText(symbol, screenX + offsetX, baseY - offsetY);
    });
    ctx.restore();
  }

  function drawStations() {
    drawStationCelebration(stationWorldX, nextStationName);
    drawStation(stationWorldX, nextStationName);
    if (currentStationX !== null) {
      drawStationCelebration(currentStationX, currentStationName);
      drawStation(currentStationX, currentStationName);
    }
  }

  function stationGrade(name) {
    return GRAND_STATIONS.has(name) ? "grand"
      : MAJOR_STATIONS.has(name) ? "major"
        : activeRoute.cityStations.has(name) ? "city" : "local";
  }

  function stationPlatformWidth(name) {
    const baseWidth = { grand: 1800, major: 1500, city: 1250, local: 1000 }[stationGrade(name)];
    const capacity = {
      tokaido: 16,
      tohoku: 17,
      yamanote: 11,
      chuo: 12,
      sobu: 10,
      tozai: 10,
      keio: 10,
      inokashira: 5,
    }[selectedRouteKey] || 5;
    const { carW, gap } = carMetrics();
    return Math.max(baseWidth, capacity * carW + Math.max(capacity - 1, 0) * gap + carW * 0.5);
  }

  function trainStationOffset() {
    if (!komachiCoupled) return 0;
    const { carW, gap } = carMetrics();
    // 連結時も、編成の本当の先頭がホーム先端の停止位置へ来るよう固定する。
    return -(komachiGap + carW * 2 + gap);
  }

  function stationScreenX(worldX, name) {
    // 駅の距離座標をホーム先端の停止位置として、ホーム全体は後ろ側へ伸ばす。
    // 車両数に応じて編成を横移動しないため、到着時の「にゅっ」とした補正がなくなる。
    return worldScreenOffset(worldX) + W * NOSE_R - stationPlatformWidth(name) / 2;
  }

  function drawStation(worldX, name) {
    if (state !== "running" && state !== "stopped") return;
    const screenX = stationScreenX(worldX, name);
    const y = groundY();
    const grade = stationGrade(name);
    const platformW = stationPlatformWidth(name);
    const canopyW = platformW * 0.86;
    const { x0, x1 } = viewRange();
    if (screenX - platformW / 2 - 60 > x1 || screenX + platformW / 2 + 60 < x0) return;
    const canopyH = { grand: 168, major: 145, city: 125, local: 105 }[grade];
    const accent = ROUTE_COLORS[selectedRouteKey];

    // ホームと黄色い点字ブロック
    ctx.fillStyle = "#e8e5dc";
    ctx.fillRect(screenX - platformW / 2, y - 18, platformW, 18);
    ctx.fillStyle = "#f0c94b";
    ctx.fillRect(screenX - platformW / 2, y - 18, platformW, 5);
    ctx.fillStyle = "#a8a8a4";
    ctx.fillRect(screenX - platformW / 2, y - 4, platformW, 4);

    // 駅の規模に合わせた屋根と柱
    const roofY = y - canopyH;
    ctx.fillStyle = grade === "grand" ? "rgba(208,232,242,0.92)" : "#e8edf0";
    ctx.fillRect(screenX - canopyW / 2, roofY, canopyW, 14);
    ctx.fillStyle = accent;
    ctx.fillRect(screenX - canopyW / 2, roofY, canopyW, 5);
    if (grade === "grand") {
      ctx.strokeStyle = "#7895a5";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(screenX - canopyW / 2, roofY);
      ctx.quadraticCurveTo(screenX, roofY - 90, screenX + canopyW / 2, roofY);
      ctx.stroke();
    }
    ctx.fillStyle = "#7b858b";
    const columns = Math.max(4, Math.round(canopyW / 260));
    for (let i = 0; i < columns; i++) {
      const px = screenX - canopyW / 2 + 35 + i * (canopyW - 70) / Math.max(columns - 1, 1);
      ctx.fillRect(px - 4, roofY + 14, 8, y - roofY - 32);
    }

    // ベンチ、自動販売機、主要駅の時計
    ctx.fillStyle = "#47708b";
    ctx.fillRect(screenX - canopyW * 0.34, y - 55, 70, 30);
    ctx.fillStyle = "#d94f40";
    ctx.fillRect(screenX + canopyW * 0.25, y - 72, 28, 54);
    ctx.fillStyle = "#f6f3dc";
    ctx.fillRect(screenX + canopyW * 0.25 + 5, y - 64, 18, 20);
    if (grade === "grand" || grade === "major") {
      ctx.fillStyle = "#263746";
      ctx.beginPath();
      ctx.arc(screenX, roofY + 30, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(screenX, roofY + 30, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#263746";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(screenX, roofY + 30);
      ctx.lineTo(screenX, roofY + 20);
      ctx.moveTo(screenX, roofY + 30);
      ctx.lineTo(screenX + 8, roofY + 35);
      ctx.stroke();
    }

    // 駅名板(ひらがな)。長いホームのどこからでも駅名が見えるよう複数置く
    const bw = Math.max(110, name.length * 22 + 26);
    const signCount = Math.max(2, Math.round(platformW / 500));
    const signSpan = Math.min(platformW - bw - 100, (signCount - 1) * 430);
    for (let i = 0; i < signCount; i++) {
      const signX = screenX - signSpan / 2 + i * signSpan / (signCount - 1);
      ctx.fillStyle = "#fff";
      ctx.fillRect(signX - bw / 2, y - 94, bw, 34);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.strokeRect(signX - bw / 2, y - 94, bw, 34);
      ctx.fillStyle = accent;
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(name, signX, y - 70);
    }
  }

  function drawWheel(x, y, r) {
    ctx.fillStyle = "#3a3a3a";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.fill();
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7 * Math.cos(wheelAngle), y - r * 0.7 * Math.sin(wheelAngle));
    ctx.lineTo(x + r * 0.7 * Math.cos(wheelAngle), y + r * 0.7 * Math.sin(wheelAngle));
    ctx.stroke();
  }

  function drawCarNumber(x, y, number, carH) {
    const radius = Math.max(10, Math.min(14, carH * 0.22));
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.strokeStyle = "#25384a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#17212b";
    ctx.font = `bold ${Math.max(14, radius * 1.25)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.save();
    if (trainFacesLeft()) {
      // 編成全体の反転中も、車両番号だけは読みやすい向きを保つ。
      ctx.translate(x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-x, 0);
    }
    ctx.fillText(String(number), x, y + 1);
    ctx.restore();
    ctx.textBaseline = "alphabetic";
  }

  function drawTrainWindows(winStart, top, carW, carH, winCount, winStep = carW * 0.28) {
    ctx.save();
    ctx.fillStyle = timeOfDay === "night" ? "#ffe58a" : "#333";
    if (timeOfDay === "night") {
      ctx.shadowColor = "rgba(255, 221, 112, 0.9)";
      ctx.shadowBlur = 8;
    }
    for (let wi = 0; wi < winCount; wi++) {
      roundRect(winStart + wi * winStep, top + carH * 0.18, carW * 0.18, carH * 0.22, 4);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawTrainMotionEffects() {
    const y = groundY();
    const { carW, carH, gap } = carMetrics();
    const noseX = W * NOSE_R + trainStationOffset();
    const tailX = noseX - cars * (carW + gap);

    if (accelerationEffect > 0.02) {
      ctx.save();
      ctx.globalAlpha = accelerationEffect * 0.8;
      ctx.strokeStyle = "#79d7ff";
      ctx.lineWidth = Math.max(3, carH * 0.06);
      ctx.lineCap = "round";
      for (let i = 0; i < 4; i++) {
        const lineY = y - carH * (0.2 + i * 0.22);
        const length = carW * (0.28 + i * 0.08) * accelerationEffect;
        ctx.beginPath();
        ctx.moveTo(tailX - carW * 0.08, lineY);
        ctx.lineTo(tailX - carW * 0.08 - length, lineY);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (brakeEffect > 0.02) {
      ctx.save();
      ctx.globalAlpha = brakeEffect;
      ctx.fillStyle = "#ff9b42";
      ctx.shadowColor = "#ff3d20";
      ctx.shadowBlur = 12;
      const wheelY = y - 7;
      for (let index = 0; index < 3; index++) {
        const x = index === 0
          ? noseX - carW * 0.22
          : index === 1 ? noseX - carW * 0.72 : tailX + carW * 0.2;
        const r = 3 + ((Math.floor(distance / 12) + index) % 3);
        ctx.beginPath();
        ctx.arc(x, wheelY + (index % 2) * 3, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  function drawTrain() {
    const y = groundY();
    const { carW, carH, gap } = carMetrics();
    const noseX = W * NOSE_R + trainStationOffset();
    const bob = state === "running" ? Math.sin(distance * 0.05) * 1.5 : 0;

    for (let i = 0; i < cars; i++) {
      const carTrain = TRAINS[carTypes[i]];
      const commuter = carTrain.kind === "commuter";
      const right = noseX - i * (carW + gap);
      const left = right - carW;
      const top = y - carH - 10 + bob * (i % 2 === 0 ? 1 : -1);

      ctx.fillStyle = carTrain.body;
      ctx.strokeStyle = carTrain.edge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const isTail = cars > 1 && i === cars - 1;
      if (commuter) {
        // 通勤電車は先頭・中間・後尾とも箱型の車体。
        roundRect(left, top, carW, carH, Math.max(5, carH * 0.12));
      } else if (i === 0) {
        // 先頭車: ロングノーズ
        ctx.moveTo(left, top + 6);
        ctx.quadraticCurveTo(left, top, left + 10, top);
        ctx.lineTo(right - carW * 0.45, top);
        ctx.quadraticCurveTo(right - carW * 0.1, top + 2, right, top + carH - 8);
        ctx.quadraticCurveTo(right, top + carH, right - 8, top + carH);
        ctx.lineTo(left + 6, top + carH);
        ctx.quadraticCurveTo(left, top + carH, left, top + carH - 6);
        ctx.closePath();
      } else if (isTail) {
        // 最後の車両: 後ろ向きの運転席がある後尾車。
        ctx.moveTo(left, top + carH - 8);
        ctx.quadraticCurveTo(left + carW * 0.1, top + 2, left + carW * 0.45, top);
        ctx.lineTo(right - 10, top);
        ctx.quadraticCurveTo(right, top, right, top + 6);
        ctx.lineTo(right, top + carH - 6);
        ctx.quadraticCurveTo(right, top + carH, right - 6, top + carH);
        ctx.lineTo(left + 8, top + carH);
        ctx.quadraticCurveTo(left, top + carH, left, top + carH - 8);
        ctx.closePath();
      } else {
        roundRect(left, top, carW, carH, 8);
      }
      ctx.fill();
      if (carTrain.upper) {
        ctx.save();
        ctx.clip();
        ctx.fillStyle = carTrain.upper;
        ctx.fillRect(left, top, carW, carH * 0.47);
        ctx.restore();
      }
      ctx.stroke();
      if (commuter && (i === 0 || isTail)) {
        ctx.fillStyle = carTrain.face;
        const cabWidth = carW * 0.18;
        ctx.fillRect(i === 0 ? right - cabWidth : left, top + 2, cabWidth, carH - 4);
      }

      // 帯
      ctx.fillStyle = carTrain.stripe;
      if (commuter) {
        ctx.fillRect(left + 2, top + carH * 0.58, carW - 4, carH * 0.14);
        if (carTrain.stripe2) {
          ctx.fillStyle = carTrain.stripe2;
          ctx.fillRect(left + 2, top + carH * 0.73, carW - 4, carH * 0.08);
        }
      } else if (i === 0) {
        ctx.beginPath();
        ctx.moveTo(left + 2, top + carH * 0.45);
        ctx.lineTo(right - carW * 0.32, top + carH * 0.42);
        ctx.lineTo(right - carW * 0.05, top + carH * 0.75);
        ctx.lineTo(right - carW * 0.05, top + carH * 0.88);
        ctx.lineTo(left + 2, top + carH * 0.62);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(left + 2, top + carH * 0.48, carW - 4, carH * 0.16);
      }

      // 窓
      const winCount = i === 0 || isTail ? 2 : 3;
      const winStart = isTail ? left + carW * 0.38 : left + carW * 0.12;
      drawTrainWindows(winStart, top, carW, carH, winCount);

      // 連結器
      if (i > 0) {
        ctx.fillStyle = "#666";
        ctx.fillRect(right, top + carH * 0.6, gap, 6);
      }

      const carNumber = komachiCoupled ? i + 3 : i + 1;
      drawCarNumber(left + carW * 0.52, top + carH * 0.72, carNumber, carH);

      drawWheel(left + carW * 0.22, y - 8, 9);
      drawWheel(left + carW * 0.78, y - 8, 9);
    }
  }

  function drawKomachi() {
    if (train !== TRAINS.hayabusa || (!komachiCoupled && komachiStationX === null)) return;

    const y = groundY();
    const { carW, carH, gap } = carMetrics();
    const noseX = W * NOSE_R + (komachiCoupled ? trainStationOffset() : 0);
    const connectionX = komachiCoupled
      ? noseX + komachiGap
      : worldScreenOffset(komachiStationX) + noseX + komachiGap;
    const bob = state === "running" ? Math.sin(distance * 0.05 + 1) * 1.5 : 0;
    const top = y - carH - 10 + bob;

    for (let i = 0; i < 2; i++) {
      const left = connectionX + i * (carW + gap);
      const right = left + carW;
      ctx.fillStyle = TRAINS.komachi.body;
      ctx.strokeStyle = TRAINS.komachi.edge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (i === 0) {
        // 緑の新幹線側を向く、連結用の先頭車。
        ctx.moveTo(left, top + carH - 8);
        ctx.quadraticCurveTo(left + carW * 0.1, top + 2, left + carW * 0.45, top);
        ctx.lineTo(right - 10, top);
        ctx.quadraticCurveTo(right, top, right, top + 6);
        ctx.lineTo(right, top + carH - 6);
        ctx.quadraticCurveTo(right, top + carH, right - 6, top + carH);
        ctx.lineTo(left + 8, top + carH);
        ctx.quadraticCurveTo(left, top + carH, left, top + carH - 8);
      } else {
        // 編成の外側は右向きのロングノーズ。
        ctx.moveTo(left, top + 6);
        ctx.quadraticCurveTo(left, top, left + 10, top);
        ctx.lineTo(right - carW * 0.45, top);
        ctx.quadraticCurveTo(right - carW * 0.1, top + 2, right, top + carH - 8);
        ctx.quadraticCurveTo(right, top + carH, right - 8, top + carH);
        ctx.lineTo(left + 6, top + carH);
        ctx.quadraticCurveTo(left, top + carH, left, top + carH - 6);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = TRAINS.komachi.stripe;
      ctx.fillRect(left + carW * 0.08, top + carH * 0.52, carW * 0.84, carH * 0.14);

      const windowStart = left + carW * 0.2;
      drawTrainWindows(windowStart, top, carW, carH, 2, carW * 0.3);

      if (i === 0) {
        ctx.fillStyle = "#666";
        ctx.fillRect(right, top + carH * 0.6, gap, 6);
      }
      drawCarNumber(left + carW * 0.52, top + carH * 0.72, 2 - i, carH);
      drawWheel(left + carW * 0.22, y - 8, 9);
      drawWheel(left + carW * 0.78, y - 8, 9);
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawConfetti(dt) {
    confetti = confetti.filter((p) => p.life > 0);
    for (const p of confetti) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 700 * dt;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillRect(p.x, p.y, 8, 8);
    }
    ctx.globalAlpha = 1;
  }

  function showSpeedBoost(amount, event) {
    if (amount <= 0) return;
    const rect = canvas.getBoundingClientRect();
    speedBoostPopups.push({
      amount: Math.round(amount),
      x: event.offsetX * W / Math.max(rect.width, 1),
      y: event.offsetY * H / Math.max(rect.height, 1) - 28,
      life: 1,
    });
    speedBoostPopups = speedBoostPopups.slice(-8);
  }

  function drawSpeedBoosts(dt) {
    speedBoostPopups = speedBoostPopups.filter((popup) => popup.life > 0);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    for (const popup of speedBoostPopups) {
      popup.life -= dt;
      popup.y -= 55 * dt;
      if (mapMode !== "scenery") continue;
      ctx.globalAlpha = Math.min(1, Math.max(0, popup.life * 1.8));
      ctx.font = `bold ${Math.max(30, Math.min(52, W * 0.04))}px sans-serif`;
      ctx.lineWidth = 8;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.fillStyle = "#f06a22";
      const text = `＋${popup.amount} km/h`;
      ctx.strokeText(text, popup.x, popup.y);
      ctx.fillText(text, popup.x, popup.y);
    }
    ctx.restore();
  }

  let displayedPlaySeconds = -1;
  function updatePlayTimer(force = false) {
    const totalSeconds = Math.floor(playElapsedSeconds);
    if (!force && totalSeconds === displayedPlaySeconds) return;
    displayedPlaySeconds = totalSeconds;
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    playTimeValue.textContent = `${minutes}:${seconds}`;
  }
  // ---- メインループ ----
  let lastT = performance.now();
  function frame(now) {
    const rawDt = Math.max(0, (now - lastT) / 1000);
    const dt = Math.min(rawDt, 0.05);
    lastT = now;
    if (state !== "select" && !document.hidden) {
      playElapsedSeconds += Math.min(rawDt, 1);
      updatePlayTimer();
    }

    // バックグラウンド起動などで resize イベントを取りこぼしても復帰できるようにする
    if (!forcedSize && (window.innerWidth !== W || window.innerHeight !== H || canvas.width === 0)) {
      resize();
    }

    updateAutoOperations(dt);
    updateFallingStar(dt);

    let braking = false;
    if (state === "running") {
      const distToStation = stationWorldX - distance;
      braking = isBrakingForStation();

      if (braking) {
        // 駅が近づいたら自動でブレーキして、ぴったり停車する
        const decel = Math.max((speed * speed) / (2 * Math.max(distToStation, 1)), 100);
        speed = Math.max(speed - decel * dt, 0);
      } else if (autoMode) {
        const targetSpeed = autoTargetKmh() / SPEED_DISPLAY_SCALE;
        if (speed < targetSpeed) {
          speed = Math.min(targetSpeed, speed + AUTO_ACCEL_PX_PER_SEC2 * dt);
          accelerationEffect = Math.max(accelerationEffect, 0.45);
        } else if (speed > targetSpeed) {
          speed = Math.max(targetSpeed, speed - AUTO_OVERSPEED_DECEL_PX_PER_SEC2 * dt);
        }
      } else {
        // 摩擦でゆるやかに減速(タップしなくても止まりはしない)
        speed = Math.max(speed - FRICTION_PX_PER_SEC2 * dt, 120);
      }

      if (passingStation && distToStation <= 2) {
        distance = stationWorldX;
        passStation();
      } else if (distToStation <= 2 || (speed <= 1 && distToStation < 400)) {
        distance = stationWorldX;
        arrive();
      }

      if (state === "running") {
        const travel = speed * dt;
        distance += travel;
        visualDistance += travel * travelVisualSign();
        wheelAngle += travel * 0.08 * travelVisualSign();
        updateRouteEvent(dt);
        updateMidRouteAnnouncement();
        updateRunningSound();
      }
    }

    brakeEffect += ((braking ? 1 : 0) - brakeEffect) * Math.min(dt * 10, 1);
    accelerationEffect = Math.max(0, accelerationEffect - dt * 1.7);
    if (isDebug) canvas.dataset.motionEffect = braking ? "braking" : (accelerationEffect > 0.08 ? "accelerating" : "");

    updateDriveUi(false, now);
    updateOpposingTrain(dt);

    if (state === "coupling") {
      komachiGap = Math.max(komachiGap - 85 * dt, 8);
      if (komachiGap <= 8) finishKomachiCoupling();
    }

    // 編成全体が画面に入るようにカメラをなめらかに引く (W=0 の非表示中は更新しない)。
    // 100両でも全編成が画面に入るまで縮小する。
    if (W > 0) {
      const { carW, gap } = carMetrics();
      const leftScale = (W * (NOSE_R - 0.03)) / (cars * (carW + gap));
      const komachiIsNear = komachiStationX !== null
        && komachiStationX - distance < W * 1.2;
      const rightCars = komachiCoupled || komachiIsNear ? 2 : 0;
      const rightScale = rightCars > 0
        ? (W * (1 - NOSE_R - 0.03)) / (rightCars * (carW + gap) + komachiGap)
        : 1;
      const targetScale = Math.max(Math.min(1, leftScale, rightScale), 0.018);
      viewScale += (targetScale - viewScale) * Math.min(dt * 3, 1);
    }

    if (isDebug) {
      canvas.dataset.groundY = String(Math.round(groundY()));
      canvas.dataset.cars = String(totalCarCount());
      canvas.dataset.platformWidth = String(Math.round(stationPlatformWidth(nextStationName)));
      canvas.dataset.trainStationOffset = String(Math.round(trainStationOffset()));
      canvas.dataset.trainFacing = trainFacesLeft() ? "left" : "right";
      canvas.dataset.worldMotion = trainFacesLeft() ? "right" : "left";
      canvas.dataset.opposingDirection = opposingTrain
        ? (opposingTrain.direction > 0 ? "right" : "left")
        : "";
      canvas.dataset.opposingX = opposingTrain ? String(Math.round(opposingTrain.x)) : "";
      canvas.dataset.stationScreenX = String(Math.round(stationScreenX(stationWorldX, nextStationName)));
      canvas.dataset.fallingStarX = fallingStar ? String(Math.round(fallingStar.x)) : "";
      canvas.dataset.fallingStarY = fallingStar ? String(Math.round(fallingStar.y)) : "";
      canvas.dataset.fallingStarType = fallingStar?.type.key || "";
      canvas.dataset.fallingStarRadius = fallingStar ? String(Math.round(fallingStar.radius * 10) / 10) : "";
      canvas.dataset.fallingStarSpeed = fallingStar ? String(fallingStar.type.speed) : "";
      canvas.dataset.fallingStarTrailLength = fallingStar
        ? String(Math.round(fallingStar.radius * 5 * fallingStar.type.trailScale))
        : "";
      const starWeights = currentStarWeights();
      canvas.dataset.starWeightGold = String(starWeights.gold);
      canvas.dataset.starWeightGreen = String(starWeights.green);
      canvas.dataset.starWeightBlue = String(starWeights.blue);
      canvas.dataset.starWeightRainbow = String(starWeights.rainbow);
      canvas.dataset.starMissBlue = String(missedRareStars.blue);
      canvas.dataset.starMissRainbow = String(missedRareStars.rainbow);
    }
    const routeMapActive = mapMode !== "scenery" && activeRouteMap() && state !== "select";
    if (routeMapActive) {
      drawYamanoteMap();
    } else {
      drawSky();
      if (isDebug) canvas.dataset.viewMode = "scenery";
      drawClouds(dt);
      drawFallingStar();
      if (state !== "select") {
        ctx.save();
        const ax = W * NOSE_R;
        const ay = groundY();
        ctx.translate(ax, ay);
        ctx.scale(viewScale, viewScale);
        ctx.translate(-ax, -ay);
        drawFuji();
        drawMountains();
        drawCityscape();
        drawTunnel();
        drawTrack();
        drawCrossing();
        drawOpposingTrain();
        drawDistanceMarkers();
        drawInspectionEffect();
        drawStations();
        if (trainFacesLeft()) {
          // 外側のカメラ拡縮後も画面中央を軸に見えるよう、座標系側の反転軸を補正する。
          const mirrorCenterX = ax + (W * 0.5 - ax) / Math.max(viewScale, 0.001);
          ctx.save();
          ctx.translate(mirrorCenterX * 2, 0);
          ctx.scale(-1, 1);
        }
        drawHeadlight();
        drawTrainMotionEffects();
        drawTrain();
        drawKomachi();
        if (trainFacesLeft()) ctx.restore();
        ctx.restore();
      }
    }
    drawWeather(dt);
    drawStarPowerBadge();
    drawConfetti(dt);
    drawSpeedBoosts(dt);

    scheduleFrame();
  }

  // タブが非表示だと requestAnimationFrame は発火しないので、低頻度の setTimeout で継続する
  function scheduleFrame() {
    if (document.hidden) {
      setTimeout(() => frame(performance.now()), 200);
    } else {
      requestAnimationFrame(frame);
    }
  }
  scheduleFrame();

  // ---- デバッグフック (?debug 付きで開いた時だけ) ----
  if (isDebug) {
    window.__tg = {
      skipToStation() { distance = stationWorldX - 600; },
      status() {
        return {
          state, selectedRouteKey, routeName: activeRoute.name, routeVariant: activeRoute.variant || "main", currentLineKm, routeDirection,
          speed, distance, visualDistance, cars, carTypes: [...carTypes], viewScale,
          mapMode, mapRoute: activeRouteMapKey(), mapKm: activeRouteMap() ? yamanoteMapKm() : null,
          toStation: stationWorldX - distance,
          stationScreenX: stationScreenX(stationWorldX, nextStationName),
          platformWidth: stationPlatformWidth(nextStationName),
          trainStationOffset: trainStationOffset(),
          nextStationName, currentStationName,
          komachiCoupled, komachiReady, komachiGap,
          doorsOpen, stationDoorsDone,
          segmentNumber, routeEvent, routeEventProgress,
          tunnelVisualRange: isTunnelVisible() ? tunnelVisualRange() : null,
          tunnelVisualAlpha: tunnelVisualAlpha(), lightsOn,
          expressMode, deadheadMode, passingStation, braking: isBrakingForStation(),
          boostPopupCount: speedBoostPopups.length, midAnnouncementDone, runningSoundEnabled,
          autoMode, autoActionTimer, autoTargetKmh: autoTargetKmh(),
          playElapsedSeconds, motionEffect: canvas.dataset.motionEffect,
          onboardPassengers: [...onboardPassengers], deliveredPassengers, tapBoostKmh: currentTapBoostKmh(),
          timeOfDay, weather, visitedStations: [...visitedStations],
          fallingStar: fallingStar ? { ...fallingStar } : null,
          starBoostTime, starBoostMultiplier, starBoostType: starBoostType.key,
          starWeights: currentStarWeights(), missedRareStars: { ...missedRareStars },
          opposingPool: opposingTrainPoolForSegment().map((type) => type.name),
          nextOpposingTrainIn,
          opposingTrain: opposingTrain ? {
            name: opposingTrain.type.name,
            cars: opposingTrain.cars,
            speedKmh: displaySpeed(opposingTrain.speed),
            relativeSpeedKmh: displaySpeed(opposingTrain.speed + speed),
            x: opposingTrain.x,
            direction: opposingTrain.direction,
          } : null,
        };
      },
      auto(enabled) { setAutoMode(Boolean(enabled)); },
      map(mode) {
        if (!activeRouteMap()) return false;
        const nextMode = mode === true ? "follow" : mode === false ? "scenery" : mode;
        setMapMode(nextMode);
        return mapMode;
      },
      setCars(n) {
        cars = Math.max(1, Math.min(MAX_CARS, n));
        carTypes = Array(cars).fill(trainKey);
      },
      forceFallingStar(typeKey = "gold") {
        spawnFallingStar();
        const forcedType = FALLING_STAR_TYPES.find((type) => type.key === typeKey) || FALLING_STAR_TYPES[0];
        fallingStar.type = forcedType;
        fallingStar.radius = Math.max(24, Math.min(38, W * 0.035)) * forcedType.scale;
        fallingStar.x = W * 0.72;
        fallingStar.y = H * 0.25;
        fallingStar.vx = 0;
        fallingStar.vy = 0;
      },
      forceSize(w, h) {
        forcedSize = true;
        DPR = 1;
        W = w;
        H = h;
        canvas.width = w;
        canvas.height = h;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      },
    };

    // ブラウザの分離された検証環境からも、実際の操作として駅直前へ進められる。
    const debugSkipButton = document.createElement("button");
    debugSkipButton.type = "button";
    debugSkipButton.className = "debug-control";
    debugSkipButton.textContent = "テスト: えきのまえへ";
    debugSkipButton.setAttribute("aria-label", "テストで駅の前へ進む");
    Object.assign(debugSkipButton.style, {
      position: "fixed", left: "45%", top: "8px", zIndex: "99",
      padding: "8px", fontSize: "14px",
    });
    debugSkipButton.addEventListener("click", () => {
      if (state === "stopped" && stationDoorsDone && !komachiReady) depart();
      if (state !== "running") return;
      distance = stationWorldX;
      if (passingStation) passStation();
      else arrive();
    });
    document.body.appendChild(debugSkipButton);

    const debugEventButton = document.createElement("button");
    debugEventButton.type = "button";
    debugEventButton.className = "debug-control";
    debugEventButton.textContent = "テスト: イベントへ";
    debugEventButton.setAttribute("aria-label", "テストで走行イベントへ進む");
    Object.assign(debugEventButton.style, {
      position: "fixed", left: "45%", top: "52px", zIndex: "99",
      padding: "8px", fontSize: "14px",
    });
    debugEventButton.addEventListener("click", () => {
      if (state === "stopped" && stationDoorsDone && !komachiReady) depart();
      if (state !== "running") return;
      distance = segmentStartDistance + (stationWorldX - segmentStartDistance) * 0.3;
      updateRouteEvent(0);
    });
    document.body.appendChild(debugEventButton);

    const debugTunnelStages = [0.18, 0.27, 0.72];
    let debugTunnelStage = 0;
    const debugTunnelButton = document.createElement("button");
    debugTunnelButton.type = "button";
    debugTunnelButton.className = "debug-control";
    debugTunnelButton.textContent = "テスト: トンネル";
    debugTunnelButton.setAttribute("aria-label", "トンネルの入口と出口を順番に確認する");
    Object.assign(debugTunnelButton.style, {
      position: "fixed", left: "58%", top: "52px", zIndex: "99",
      padding: "8px", fontSize: "14px",
    });
    debugTunnelButton.addEventListener("click", () => {
      if (state === "stopped" && stationDoorsDone && !komachiReady) depart();
      if (state !== "running") return;
      routeEvent = "tunnel";
      routeEventAnnounced = true;
      const progress = debugTunnelStages[debugTunnelStage % debugTunnelStages.length];
      debugTunnelStage++;
      distance = segmentStartDistance + (stationWorldX - segmentStartDistance) * progress;
      routeEventProgress = progress;
    });
    document.body.appendChild(debugTunnelButton);

    const debugOpposingButton = document.createElement("button");
    debugOpposingButton.type = "button";
    debugOpposingButton.className = "debug-control";
    debugOpposingButton.textContent = "テスト: たいこうれっしゃ";
    debugOpposingButton.setAttribute("aria-label", "テストで対向列車を出す");
    Object.assign(debugOpposingButton.style, {
      position: "fixed", left: "45%", top: "96px", zIndex: "99",
      padding: "8px", fontSize: "14px",
    });
    debugOpposingButton.addEventListener("click", () => {
      spawnOpposingTrain();
      opposingTrain.x = W * 0.42;
      opposingTrain.speed = 0;
      identifyOpposingTrain({ offsetX: W * 0.5, offsetY: opposingTrackY() - 10 });
    });
    document.body.appendChild(debugOpposingButton);

    const debugWeatherButton = document.createElement("button");
    debugWeatherButton.type = "button";
    debugWeatherButton.className = "debug-control";
    debugWeatherButton.textContent = "テスト: てんきとじかん";
    debugWeatherButton.setAttribute("aria-label", "テストで天気と時間を変える");
    Object.assign(debugWeatherButton.style, {
      position: "fixed", left: "45%", top: "140px", zIndex: "99",
      padding: "8px", fontSize: "14px",
    });
    debugWeatherButton.addEventListener("click", cycleWeatherAndTime);
    document.body.appendChild(debugWeatherButton);
    const debugStarButton = document.createElement("button");
    debugStarButton.type = "button";
    debugStarButton.className = "debug-control";
    debugStarButton.textContent = "テスト: ながれぼし";
    debugStarButton.setAttribute("aria-label", "テストで流れ星を出す");
    Object.assign(debugStarButton.style, {
      position: "fixed", left: "45%", top: "360px", zIndex: "99",
      padding: "8px", fontSize: "14px",
    });
    debugStarButton.addEventListener("click", () => window.__tg.forceFallingStar());
    document.body.appendChild(debugStarButton);

    const addDebugStarButton = (typeKey, label, left) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "debug-control";
      button.textContent = `テスト: ${label}`;
      button.setAttribute("aria-label", `テストで${label}を出す`);
      Object.assign(button.style, {
        position: "fixed", left, top: "360px", zIndex: "99",
        padding: "8px", fontSize: "14px",
      });
      button.addEventListener("click", () => window.__tg.forceFallingStar(typeKey));
      document.body.appendChild(button);
    };
    addDebugStarButton("green", "みどりのほし", "58%");
    addDebugStarButton("blue", "あおいほし", "70%");
    addDebugStarButton("rainbow", "にじいろのほし", "82%");
    const debugMissStarButton = document.createElement("button");
    debugMissStarButton.type = "button";
    debugMissStarButton.className = "debug-control";
    debugMissStarButton.textContent = "テスト: ほしをのがす";
    debugMissStarButton.setAttribute("aria-label", "テストで今の星を逃す");
    Object.assign(debugMissStarButton.style, {
      position: "fixed", left: "82%", top: "404px", zIndex: "99",
      padding: "8px", fontSize: "14px",
    });
    debugMissStarButton.addEventListener("click", missFallingStar);
    document.body.appendChild(debugMissStarButton);
    const debugLongTrainButton = document.createElement("button");
    debugLongTrainButton.type = "button";
    debugLongTrainButton.className = "debug-control";
    debugLongTrainButton.textContent = "テスト: 16りょう";
    debugLongTrainButton.setAttribute("aria-label", "テストで16両編成にする");
    Object.assign(debugLongTrainButton.style, {
      position: "fixed", left: "45%", top: "404px", zIndex: "99",
      padding: "8px", fontSize: "14px",
    });
    debugLongTrainButton.addEventListener("click", () => window.__tg.setCars(16));
    document.body.appendChild(debugLongTrainButton);

    const debugBrakeButton = document.createElement("button");
    debugBrakeButton.type = "button";
    debugBrakeButton.className = "debug-control";
    debugBrakeButton.textContent = "テスト: ブレーキへ";
    debugBrakeButton.setAttribute("aria-label", "テストで駅のブレーキ区間へ進む");
    Object.assign(debugBrakeButton.style, {
      position: "fixed", left: "45%", top: "228px", zIndex: "99",
      padding: "8px", fontSize: "14px",
    });
    debugBrakeButton.addEventListener("click", () => {
      if (state === "stopped" && stationDoorsDone && !komachiReady) depart();
      if (state !== "running" || passingStation) return;
      distance = stationWorldX - 600;
      speed = 600;
    });
    document.body.appendChild(debugBrakeButton);

    const debugCrossingButton = document.createElement("button");
    debugCrossingButton.type = "button";
    debugCrossingButton.className = "debug-control";
    debugCrossingButton.textContent = "テスト: ふみきり";
    debugCrossingButton.setAttribute("aria-label", "テストで踏切を出す");
    Object.assign(debugCrossingButton.style, {
      position: "fixed", left: "45%", top: "184px", zIndex: "99",
      padding: "8px", fontSize: "14px",
    });
    debugCrossingButton.addEventListener("click", () => {
      if (state === "stopped" && stationDoorsDone && !komachiReady) depart();
      if (state !== "running") return;
      routeEvent = "crossing";
      routeEventAnnounced = false;
      routeEventProgress = 0;
      inspectionTime = 0;
      crossingBellTimer = 0;
      crossingWorldX = distance + (W * 1.6 - W * NOSE_R) / Math.max(viewScale, 0.01);
      routeEventBanner.classList.add("hidden");
    });
    document.body.appendChild(debugCrossingButton);

    const debugTurnaroundButton = document.createElement("button");
    debugTurnaroundButton.type = "button";
    debugTurnaroundButton.className = "debug-control";
    debugTurnaroundButton.textContent = "テスト: おりかえし";
    debugTurnaroundButton.setAttribute("aria-label", "テストで終点の折り返しを確認する");
    Object.assign(debugTurnaroundButton.style, {
      position: "fixed", left: "45%", top: "272px", zIndex: "99",
      padding: "8px", fontSize: "14px",
    });
    debugTurnaroundButton.addEventListener("click", () => {
      if (activeRoute.loopKm) return;
      const terminalIndex = activeRoute.terminalIndex ?? activeRoute.stations.length - 2;
      if (routeDirection > 0) {
        stationIdx = terminalIndex;
        currentLineKm = activeRoute.stations[terminalIndex].km;
        nextStationName = activeRoute.stations[terminalIndex].name;
      } else {
        stationIdx = -1;
        currentLineKm = activeRoute.startKm;
        nextStationName = activeRoute.start;
      }
      stationWorldX = distance;
      arrive();
    });
    document.body.appendChild(debugTurnaroundButton);

    const debugCelebrationButton = document.createElement("button");
    debugCelebrationButton.type = "button";
    debugCelebrationButton.className = "debug-control";
    debugCelebrationButton.textContent = "テスト: とくべつえき";
    debugCelebrationButton.setAttribute("aria-label", "テストで特別演出の駅へ進む");
    Object.assign(debugCelebrationButton.style, {
      position: "fixed", left: "45%", top: "316px", zIndex: "99",
      padding: "8px", fontSize: "14px",
    });
    debugCelebrationButton.addEventListener("click", () => {
      const celebrationIndex = activeRoute.stations.findIndex((station) => stationCelebrationFor(station.name));
      if (celebrationIndex < 0) return;
      const celebrationStation = activeRoute.stations[celebrationIndex];
      stationIdx = celebrationIndex;
      currentLineKm = celebrationStation.km;
      nextStationName = celebrationStation.name;
      stationWorldX = distance;
      arrive();
    });
    document.body.appendChild(debugCelebrationButton);
  }

  // ---- PWA ----
  const canUseServiceWorker = location.protocol === "https:"
    || location.hostname === "localhost"
    || location.hostname === "127.0.0.1";
  if ("serviceWorker" in navigator && canUseServiceWorker && !isDebug) {
    let reloadingForServiceWorker = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadingForServiceWorker) return;
      reloadingForServiceWorker = true;
      location.reload();
    });

    navigator.serviceWorker
      .register("sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => {});
  }
})();
