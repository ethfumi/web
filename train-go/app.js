// つなげて！でんしゃ！ — 3歳向けでんしゃアプリ
// 文字が読めなくても遊べる・失敗がない・タップで必ず反応する、を設計原則とする。

(() => {
  "use strict";

  // ---- 車両定義 ----
  const TRAINS = {
    nozomi: {
      name: "のぞみ",
      body: "#f8f8f8",
      stripe: "#1c48a6",
      edge: "#c8c8c8",
      callName: "のぞみ",
    },
    doctoryellow: {
      name: "ドクターイエロー",
      body: "#ffd900",
      stripe: "#1c48a6",
      edge: "#d4b400",
      callName: "ドクターイエロー",
    },
    hayabusa: {
      name: "はやぶさ",
      body: "#f7f5ed",
      upper: "#36a995",
      stripe: "#e73d8f",
      edge: "#218b7a",
      callName: "はやぶさ",
    },
    komachi: {
      name: "こまち",
      body: "#ef3340",
      stripe: "#b7b7b7",
      edge: "#b51f2a",
      callName: "こまち",
    },
    yamanote: {
      name: "やまのてせん", kind: "commuter", body: "#e8ecef", stripe: "#9acd32",
      face: "#9acd32", edge: "#aeb8be", callName: "やまのてせん",
    },
    inokashira: {
      name: "いのかしらせん", kind: "commuter", body: "#eef1f2", stripe: "#6f4aa8",
      face: "#6f4aa8", edge: "#aeb8be", callName: "いのかしらせん",
    },
    tozai: {
      name: "とうざいせん", kind: "commuter", body: "#e8ecef", stripe: "#32a5d2", stripe2: "#2362a8",
      face: "#3085cc", edge: "#aeb8be", callName: "とうざいせん",
    },
    sobu: {
      name: "そうぶせん", kind: "commuter", body: "#e8ecef", stripe: "#f0c928",
      face: "#f0c928", edge: "#aeb8be", callName: "そうぶせん",
    },
    chuo: {
      name: "ちゅうおうせん", kind: "commuter", body: "#e8ecef", stripe: "#f28c28",
      face: "#f28c28", edge: "#aeb8be", callName: "ちゅうおうせん",
    },
    keio: {
      name: "けいおうせん", kind: "commuter", body: "#e8ecef", stripe: "#d31359", stripe2: "#174f9a",
      face: "#d31359", edge: "#aeb8be", callName: "けいおうせん",
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
  const TAP_BOOST_PX_PER_SEC = 75;       // 発進後の連打は細かく加速できるようにする
  const FRICTION_PX_PER_SEC2 = 18;       // 自然減速は小さく、連打の加速感を残す
  const AUTO_ACCEL_PX_PER_SEC2 = 40;     // 自動運転は遊びやすい時間に圧縮しつつ滑らかに加速
  const AUTO_OVERSPEED_DECEL_PX_PER_SEC2 = 90;
  const SPEED_DISPLAY_SCALE = KMH_PER_MPS / PIXELS_PER_METER;
  const ROUTE_COLORS = {
    chuo: "#f28c28", tokaido: "#2362b8", tohoku: "#2a9b82",
    sobu: "#f0c928", tozai: "#3085cc", inokashira: "#8156a6", keio: "#d31359", yamanote: "#9acd32",
  };
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
    ]),
    keio: makeSegmentSet([
      ["しんじゅく", "ささづか"],
      ["しばさき", "こくりょう"], ["こくりょう", "ふだ"],
      ["ふだ", "ちょうふ"], ["ちょうふ", "にしちょうふ"],
      ["ちょうふ", "けいおうたまがわ"],
      ["きたの", "けいおうはちおうじ"],
    ]),
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
      expressLabel: "のぞみ",
      expressModeName: "のぞみ",
      expressAnnouncement: "のぞみモード！しながわ、しんよこはま、なごや、きょうとにとまって、しんおおさかへいきます",
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
      expressLabel: "はやぶさ",
      expressModeName: "はやぶさ",
      expressAnnouncement: "はやぶさモード！うえの、おおみや、せんだい、もりおか、はちのへにとまって、しんあおもりへいきます",
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
    yamanote: { name: "やまのてせん", kind: "local", body: "#e8ecef", stripe: "#9acd32" },
    keihinTohoku: { name: "けいひんとうほくせん", kind: "local", body: "#e8ecef", stripe: "#52b9e9" },
    saikyo: { name: "さいきょうせん", kind: "local", body: "#e8ecef", stripe: "#35a66f" },
    shonanShinjuku: { name: "しょうなんしんじゅくライン", kind: "local", body: "#e8ecef", stripe: "#f28c28", stripe2: "#43a36b" },
    sobu: { name: "そうぶせん", kind: "local", body: "#e8ecef", stripe: "#ffd400" },
    chuo: { name: "ちゅうおうせん", kind: "local", body: "#e8ecef", stripe: "#f28c28" },
    azusa: { name: "あずさ・かいじ", kind: "local", body: "#f4f7f8", stripe: "#7a5ab6" },
    naritaExpress: { name: "なりたエクスプレス", kind: "local", body: "#f4f4f4", stripe: "#d12f3f" },
    nozomi: { name: "のぞみ", kind: "shinkansen", body: "#f8f8f8", stripe: "#1c48a6" },
    hikari: { name: "ひかり", kind: "shinkansen", body: "#f8f8f8", stripe: "#1c48a6" },
    kodama: { name: "こだま", kind: "shinkansen", body: "#f8f8f8", stripe: "#1c48a6" },
    hayabusa: { name: "はやぶさ", kind: "shinkansen", body: "#f7f5ed", stripe: "#36a995", stripe2: "#e73d8f" },
    komachi: { name: "こまち", kind: "shinkansen", body: "#ef3340", stripe: "#b7b7b7" },
    yamabiko: { name: "やまびこ", kind: "shinkansen", body: "#f7f5ed", stripe: "#36a995" },
    tozai: { name: "とうざいせん", kind: "local", body: "#e8ecef", stripe: "#3085cc", stripe2: "#32a5d2" },
    toyoRapid: { name: "とうようこうそくせん", kind: "local", body: "#e8ecef", stripe: "#1775b8", stripe2: "#e07b25" },
    inokashira: { name: "いのかしらせん", kind: "local", body: "#eef1f2", stripe: "#6f4aa8" },
    keio: { name: "けいおうせん", kind: "local", body: "#e8ecef", stripe: "#d31359", stripe2: "#174f9a" },
    freight: { name: "かもつれっしゃ", kind: "freight", body: "#40505d", stripe: "#e49a31" },
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
      return [types.hayabusa, types.komachi, types.yamabiko];
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
  const distanceValue = document.getElementById("distance-value");
  const distanceKmValue = document.getElementById("distance-km-value");
  const nextStationDistanceLabel = document.getElementById("next-station-distance-label");
  const nextStationDistanceValue = document.getElementById("next-station-distance-value");
  const nextStationDistanceKm = document.getElementById("next-station-distance-km");
  const terminalDistanceLabel = document.getElementById("terminal-distance-label");
  const terminalDistanceValue = document.getElementById("terminal-distance-value");
  const terminalDistanceKm = document.getElementById("terminal-distance-km");
  const btnExpress = document.getElementById("btn-express");
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
  let selectedRouteKey = "chuo";
  let activeRoute = ROUTES[selectedRouteKey];
  let train = TRAINS.nozomi;
  let trainKey = "nozomi";
  let carTypes = ["nozomi"];
  let cars = 1;
  let speed = 0; // px/s
  let distance = 0;
  let wheelAngle = 0;
  let stationWorldX = 0;   // 次の駅の位置(距離座標)
  let currentStationX = null; // いま停車中(または通過直後)の駅の位置
  let stationIdx = -1;        // activeRoute.stations 内の次に停まる駅
  let routeDirection = 1;     // 1: くだり、-1: 終点から始発へ折り返し
  let currentLineKm = activeRoute.startKm;
  let nextStationName = "";
  let currentStationName = "";
  let viewScale = 1;       // 編成全体が見えるようにカメラを引く倍率
  let confetti = [];
  let speedBoostPopups = [];
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
  let passingStation = false;
  let midAnnouncementDone = false;
  let runningSoundEnabled = true;
  let autoMode = false;
  let autoActionTimer = 0;
  let onboardPassengers = [];
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

  function shouldPassNextStation() {
    if (!expressMode || !activeRoute.supportsExpress) return false;
    const isFirstKomachiStop = isKomachiCouplingStop(nextStationName);
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

  function updateDriveUi() {
    const terminal = routeTerminalStation();
    speedValue.textContent = String(displaySpeed(speed));
    canvas.dataset.braking = String(isBrakingForStation());
    canvas.dataset.speedBoostCount = String(speedBoostPopups.length);
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
    btnExpress.classList.toggle("hidden", !activeRoute.supportsExpress);
    btnExpress.setAttribute("aria-pressed", String(expressMode));
    btnExpress.setAttribute("aria-label", expressMode ? "各駅停車モードにする" : `${activeRoute.expressModeName}モードにする`);
    expressLabel.textContent = expressMode ? activeRoute.expressLabel : "かくえき";
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
    stampGrid.replaceChildren();
    routeStationNames.forEach((name) => {
      const stamp = document.createElement("div");
      stamp.className = `station-stamp${visitedStations.has(name) ? " visited" : ""}`;
      const celebration = stationCelebrationFor(name);
      stamp.textContent = visitedStations.has(name)
        ? `${celebration?.stamp ? `${celebration.stamp}\n` : ""}${name}`
        : `？\n${name}`;
      stampGrid.appendChild(stamp);
    });
    stampCount.textContent = `${activeRoute.name}　${routeVisitedCount} / ${routeStationNames.length} えき`;
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
      if (!expressMode || activeRoute.expressStops.has(candidate)) names.push(candidate);
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
    activeRoute = routeForGameStart();
    trainKey = key;
    train = TRAINS[key];
    carTypes = [key];
    cars = 1;
    speed = 0;
    distance = 0;
    currentStationX = 0;
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
    accelerationEffect = 0;
    brakeEffect = 0;
    state = "stopped";
    scheduleNextStation();
    doorsOpen = false;
    stationDoorsDone = true;
    expressMode = false;
    passingStation = false;
    midAnnouncementDone = false;
    onboardPassengers = [];
    setOnboardPanelExpanded(false);
    stationPassengers.replaceChildren();
    opposingTrain = null;
    nextOpposingTrainIn = 2.5 + Math.random() * 4;
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
        ? `このでんしゃは、${activeRoute.expressModeName}です。${nextStationName}は、とおりすぎます`
        : `つぎは、${nextStationName}`);
    }
    speed = Math.max(speed, autoMode ? 60 : 220);
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
    updateDriveUi();
    arrivalBanner.classList.remove("hidden");
    chime();
    if (autoMode) autoActionTimer = 1.2;
    if (isKomachiStop) {
      komachiReady = true;
      arrivalBanner.textContent = "こまちがいた！";
      btnKomachiCouple.classList.remove("hidden");
      say(`${currentStationName}にとうちゃく！こまちがまっているよ。れんけつしよう！`);
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
    say("こまちと、れんけつするよ〜！");
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
    say(`ガチャン！はやぶさと、こまち、れんけつ！ぜんぶで、${carWord(totalCarCount())}！`);
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
      ? `${alighting.length}にん おりて ${boarding.length}にん のるよ！`
      : `${boarding.length}にん ごじょうしゃ！`;
    const destination = boarding[0]?.destination;
    say(alighting.length > 0
      ? `ドアがひらきます。${alighting.length}にんおりて、${boarding.length}にんごじょうしゃ！`
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
        say("ドクターイエロー、せんろをけんさちゅうです！");
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
    say(`${TRAINS[typeKey].callName}を、れんけつ！ぜんぶで、${carWord(totalCarCount())}！`);
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

  function identifyOpposingTrain(event) {
    if (!opposingTrain || state === "select") return false;
    const rect = canvas.getBoundingClientRect();
    const px = event.offsetX * W / Math.max(rect.width, 1);
    const py = event.offsetY * H / Math.max(rect.height, 1);
    const carW = Math.min(W * 0.13, 115);
    const carH = carW * 0.34;
    const gap = 5;
    const ax = W * NOSE_R;
    const ay = H * GROUND_R;
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
    showPlayBanner(`🚆 ${opposingTrain.type.name}・${opposingTrain.cars}りょう！`, 2200);
    say(`${opposingTrain.type.name}、${opposingTrain.cars}りょう！みつけたね！`);
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

  canvas.addEventListener("pointerdown", (event) => {
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
      speed += TAP_BOOST_PX_PER_SEC;
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
    if (!activeRoute.supportsExpress) return;
    ensureAudio();
    expressMode = !expressMode;
    passingStation = shouldPassNextStation();
    midAnnouncementDone = false;
    updateDriveUi();
    chime();
    say(expressMode
      ? (routeDirection > 0 || activeRoute.loopKm
        ? activeRoute.expressAnnouncement
        : `${activeRoute.expressModeName}モード！${activeRoute.start}へ、もどります`)
      : "かくえきていしゃモード！ぜんぶのえきに、とまります");
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
  onboardPanel.addEventListener("click", () => {
    setOnboardPanelExpanded(onboardPanel.getAttribute("aria-expanded") !== "true");
  });
  btnCloseStamps.addEventListener("click", () => stampBook.classList.add("hidden"));
  stampBook.addEventListener("click", (event) => {
    if (event.target === stampBook) stampBook.classList.add("hidden");
  });

  // ---- 描画 ----
  const GROUND_R = 0.78; // 線路の高さ(画面比)
  const NOSE_R = 0.62;   // 先頭車の画面上の位置(画面幅比)

  function carMetrics() {
    const carW = Math.min(W * 0.22, 190);
    return { carW, carH: carW * 0.32, gap: 8 };
  }

  // カメラを引いた時に描画が必要になる、スケール座標系での画面左右端
  function viewRange() {
    const ax = W * NOSE_R;
    return { x0: ax - ax / viewScale, x1: ax + (W - ax) / viewScale };
  }

  function drawSky() {
    const palettes = {
      day: ["#8fd4ff", "#d8f2ff", "#c2ecb0"],
      sunset: ["#715d9d", "#ff9d73", "#f4c77b"],
      night: ["#101b4c", "#263c72", "#49678a"],
    };
    const colors = palettes[timeOfDay];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, colors[0]);
    g.addColorStop(0.6, colors[1]);
    g.addColorStop(1, colors[2]);
    ctx.fillStyle = g;
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

  function drawClouds(dt) {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (const c of clouds) {
      c.x -= (speed * 0.18 + 8) * dt * c.s;
      if (c.x < -160) {
        c.x = W + 160;
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
    const base = H * GROUND_R;
    const { x0, x1 } = viewRange();
    const period = W * 0.7;
    const off = (distance * 0.28) % (W * 1.4);
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
    const base = H * GROUND_R;
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
    const scroll = distance * 0.48;
    const start = Math.floor((x0 + scroll) / spacing) - 1;
    const end = Math.ceil((x1 + scroll) / spacing) + 1;
    const colors = ["#d6c4ab", "#c6d6df", "#e0b9a8", "#bcc9a8"];

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
      ctx.fillStyle = colors[seed % colors.length];
      ctx.fillRect(x, base - height, width, height);
      if (cityBlend < 0.98) {
        ctx.save();
        ctx.globalAlpha = buildingAlpha * (1 - cityBlend);
        ctx.fillStyle = ["#b84f43", "#4f6e7d", "#8a6847"][seed % 3];
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
    const base = H * GROUND_R;
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

  function drawTunnel() {
    if (routeEvent !== "tunnel" || !routeEventAnnounced) return;
    const { x0, x1 } = viewRange();
    const groundY = H * GROUND_R;
    ctx.save();
    ctx.globalAlpha = 0.96 * routeEventAlpha();
    const darkness = ctx.createLinearGradient(0, 0, 0, groundY);
    darkness.addColorStop(0, "#0b1019");
    darkness.addColorStop(0.65, "#202a37");
    darkness.addColorStop(1, "#111722");
    ctx.fillStyle = darkness;
    ctx.fillRect(x0, 0, x1 - x0, groundY);
    const ribSpacing = 220;
    const off = (distance * 0.75) % ribSpacing;
    for (let x = x0 - off; x < x1 + ribSpacing; x += ribSpacing) {
      ctx.strokeStyle = "#4a5665";
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x, H * 0.24);
      ctx.quadraticCurveTo(x + ribSpacing * 0.5, H * 0.08, x + ribSpacing, H * 0.24);
      ctx.lineTo(x + ribSpacing, groundY);
      ctx.stroke();
      ctx.strokeStyle = "rgba(155,172,190,0.25)";
      ctx.lineWidth = 3;
      for (let y = H * 0.32; y < groundY - 25; y += 58) {
        ctx.beginPath();
        ctx.moveTo(x + 12, y);
        ctx.lineTo(x + ribSpacing - 12, y);
        ctx.stroke();
      }
    }
    ctx.fillStyle = headlightsAreOn() ? "#fff4ad" : "#69758a";
    for (let x = x0 + 78 - off; x < x1 + ribSpacing; x += ribSpacing) {
      ctx.shadowBlur = headlightsAreOn() ? 18 : 4;
      ctx.shadowColor = ctx.fillStyle;
      ctx.fillRect(x, H * 0.205, 64, 9);
    }
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#778393";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x0, groundY - 42);
    ctx.lineTo(x1, groundY - 42);
    ctx.stroke();
    ctx.restore();
  }

  function crossingScreenX() {
    if (crossingWorldX === null) return Number.POSITIVE_INFINITY;
    const trainX = W * NOSE_R;
    return trainX + (crossingWorldX - distance) * viewScale;
  }

  function drawCrossing() {
    if (routeEvent !== "crossing" || crossingWorldX === null) return;
    const x = crossingWorldX - distance + W * NOSE_R;
    const { x0, x1 } = viewRange();
    if (x < x0 - 160 || x > x1 + 160) return;
    const nearY = H * GROUND_R;
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
    if (routeEvent === "tunnel" && routeEventAnnounced) return;
    if (weather === "sunny") return;
    ctx.save();
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
    return H * GROUND_R - Math.max(72, H * 0.12);
  }

  function drawTrack() {
    const y = H * GROUND_R;
    const farY = opposingTrackY();
    const { x0, x1 } = viewRange();

    // 向こう側の線路
    ctx.fillStyle = "#aaa18d";
    ctx.fillRect(x0, farY - 6, x1 - x0, 24);
    ctx.fillStyle = "#756b59";
    const farSpacing = 42;
    const farOff = (distance * 0.55) % farSpacing;
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
    const off = distance % spacing;
    for (let x = -off + Math.floor((x0 + off) / spacing) * spacing; x < x1; x += spacing) {
      ctx.fillRect(x, y + 10, 26, 8);
    }
    ctx.fillStyle = "#555";
    ctx.fillRect(x0, y + 6, x1 - x0, 4);
  }

  function spawnOpposingTrain(typeIndex = null) {
    const pool = opposingTrainPoolForSegment();
    const index = typeIndex === null
      ? Math.floor(Math.random() * pool.length)
      : typeIndex % pool.length;
    const type = pool[index];
    const { x1 } = viewRange();
    opposingTrain = {
      type,
      x: x1 + 180,
      cars: type.kind === "freight"
        ? 4 + Math.floor(Math.random() * 3)
        : 2 + Math.floor(Math.random() * 3),
      speed: 360 + Math.random() * 180,
    };
  }

  function updateOpposingTrain(dt) {
    if (state === "select") return;
    if (!opposingTrain) {
      nextOpposingTrainIn -= dt;
      if (nextOpposingTrainIn <= 0) spawnOpposingTrain();
      return;
    }

    const carW = Math.min(W * 0.13, 115);
    const { x0 } = viewRange();
    opposingTrain.x -= (opposingTrain.speed + Math.min(speed, 1800) * 0.55) * dt;
    if (opposingTrain.x + opposingTrain.cars * (carW + 5) < x0 - 120) {
      opposingTrain = null;
      nextOpposingTrainIn = 4 + Math.random() * 7;
    }
  }

  function drawOpposingTrain() {
    if (!opposingTrain) return;
    const { type } = opposingTrain;
    const y = opposingTrackY();
    const carW = Math.min(W * 0.13, 115);
    const carH = carW * 0.34;
    const gap = 5;

    for (let i = 0; i < opposingTrain.cars; i++) {
      const left = opposingTrain.x + i * (carW + gap);
      const top = y - carH + 1;
      const isEngine = i === 0;

      if (type.kind === "freight" && !isEngine) {
        const containerColors = ["#b6533c", "#4f7892", "#9b7b3c", "#52745b"];
        ctx.fillStyle = containerColors[i % containerColors.length];
        ctx.fillRect(left + 3, top + 6, carW - 6, carH - 7);
        ctx.fillStyle = "#313940";
        ctx.fillRect(left, top + carH - 3, carW, 4);
      } else {
        ctx.fillStyle = type.body;
        ctx.strokeStyle = "#56616a";
        ctx.lineWidth = 2;
        roundRect(left, top, carW, carH, type.kind === "steam" && isEngine ? 12 : 7);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = type.stripe;
        ctx.fillRect(left + 2, top + carH * 0.58, carW - 4, carH * 0.16);
        if (type.stripe2) {
          ctx.fillStyle = type.stripe2;
          ctx.fillRect(left + 2, top + carH * 0.76, carW - 4, carH * 0.08);
        }

        if (type.kind === "steam" && isEngine) {
          ctx.fillStyle = "#20272c";
          ctx.fillRect(left + carW * 0.58, top - carH * 0.32, carW * 0.16, carH * 0.36);
          ctx.beginPath();
          ctx.arc(left + carW * 0.35, top + carH * 0.54, carH * 0.28, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = "#293947";
          const windowCount = type.kind === "freight" ? 2 : 3;
          for (let wi = 0; wi < windowCount; wi++) {
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
  }

  function formatTrackDistance(worldX) {
    const meters = Math.round(worldX / PIXELS_PER_METER);
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`;
  }

  function drawDistanceMarkers() {
    const y = H * GROUND_R;
    const noseX = W * NOSE_R;
    const { x0, x1 } = viewRange();
    const markerSpacing = PIXELS_PER_METER * 100;
    const worldLeft = distance + x0 - noseX;
    const worldRight = distance + x1 - noseX;
    const firstMarker = Math.max(markerSpacing, Math.ceil(worldLeft / markerSpacing) * markerSpacing);

    for (let worldX = firstMarker; worldX <= worldRight; worldX += markerSpacing) {
      const x = worldX - distance + noseX;
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
    const y = H * GROUND_R;
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
    const frontX = W * NOSE_R + (komachiCoupled ? komachiGap + carW * 2 + gap : 0);
    const centerY = H * GROUND_R - carW * 0.16;
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
    const trainNoseX = W * NOSE_R;
    const screenX = worldX - distance + trainNoseX;
    const { x0, x1 } = viewRange();
    if (screenX - 260 > x1 || screenX + 260 < x0) return;
    const baseY = H * GROUND_R;
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

  function drawStation(worldX, name) {
    if (state !== "running" && state !== "stopped") return;
    const trainNoseX = W * NOSE_R;
    const screenX = worldX - distance + trainNoseX;
    const { x0, x1 } = viewRange();
    if (screenX - 420 > x1 || screenX + 420 < x0) return;
    const y = H * GROUND_R;
    const grade = GRAND_STATIONS.has(name) ? "grand"
      : MAJOR_STATIONS.has(name) ? "major"
        : activeRoute.cityStations.has(name) ? "city" : "local";
    const platformW = { grand: 760, major: 620, city: 520, local: 410 }[grade];
    const canopyW = platformW - (grade === "local" ? 100 : 80);
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
    const columns = grade === "local" ? 2 : grade === "city" ? 3 : 4;
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

    // 駅名板(ひらがな)。文字数に合わせて板の幅を変える
    const bw = Math.max(110, name.length * 22 + 26);
    ctx.fillStyle = "#fff";
    ctx.fillRect(screenX - bw / 2, y - 94, bw, 34);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(screenX - bw / 2, y - 94, bw, 34);
    ctx.fillStyle = accent;
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(name, screenX, y - 70);
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
    ctx.fillText(String(number), x, y + 1);
    ctx.textBaseline = "alphabetic";
  }

  function drawTrainWindows(drawWindows) {
    ctx.save();
    ctx.fillStyle = timeOfDay === "night" ? "#ffe58a" : "#333";
    if (timeOfDay === "night") {
      ctx.shadowColor = "rgba(255, 221, 112, 0.9)";
      ctx.shadowBlur = 8;
    }
    drawWindows();
    ctx.restore();
  }

  function drawTrainMotionEffects() {
    const y = H * GROUND_R;
    const { carW, carH, gap } = carMetrics();
    const noseX = W * NOSE_R;
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
      const points = [noseX - carW * 0.22, noseX - carW * 0.72, tailX + carW * 0.2];
      points.forEach((x, index) => {
        const r = 3 + ((Math.floor(distance / 12) + index) % 3);
        ctx.beginPath();
        ctx.arc(x, wheelY + (index % 2) * 3, r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }
  }
  function drawTrain() {
    const y = H * GROUND_R;
    const { carW, carH, gap } = carMetrics();
    const noseX = W * NOSE_R;
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
      drawTrainWindows(() => {
        for (let wi = 0; wi < winCount; wi++) {
          roundRect(winStart + wi * carW * 0.28, top + carH * 0.18, carW * 0.18, carH * 0.22, 4);
          ctx.fill();
        }
      });

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

    const y = H * GROUND_R;
    const { carW, carH, gap } = carMetrics();
    const noseX = W * NOSE_R;
    const connectionX = komachiCoupled
      ? noseX + komachiGap
      : komachiStationX - distance + noseX + komachiGap;
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
        // はやぶさ側を向く、連結用の先頭車。
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
      drawTrainWindows(() => {
        for (let wi = 0; wi < 2; wi++) {
          roundRect(windowStart + wi * carW * 0.3, top + carH * 0.18, carW * 0.18, carH * 0.22, 4);
          ctx.fill();
        }
      });

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

  function updatePlayTimer() {
    const totalSeconds = Math.floor(playElapsedSeconds);
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
        distance += speed * dt;
        wheelAngle += speed * dt * 0.08;
        updateRouteEvent(dt);
        updateMidRouteAnnouncement();
        updateRunningSound();
      }
    }

    brakeEffect += ((braking ? 1 : 0) - brakeEffect) * Math.min(dt * 10, 1);
    accelerationEffect = Math.max(0, accelerationEffect - dt * 1.7);
    canvas.dataset.motionEffect = braking ? "braking" : (accelerationEffect > 0.08 ? "accelerating" : "");

    updateDriveUi();
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

    drawSky();
    drawClouds(dt);
    if (state !== "select") {
      ctx.save();
      const ax = W * NOSE_R;
      const ay = H * GROUND_R;
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
      drawHeadlight();
      drawTrainMotionEffects();
      drawTrain();
      drawKomachi();
      ctx.restore();
    }
    drawWeather(dt);
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
  const isDebug = new URLSearchParams(location.search).has("debug");
  if (isDebug) {
    window.__tg = {
      skipToStation() { distance = stationWorldX - 600; },
      status() {
        return {
          state, selectedRouteKey, routeName: activeRoute.name, routeVariant: activeRoute.variant || "main", currentLineKm, routeDirection,
          speed, distance, cars, carTypes: [...carTypes], viewScale,
          toStation: stationWorldX - distance,
          nextStationName, currentStationName,
          komachiCoupled, komachiReady, komachiGap,
          doorsOpen, stationDoorsDone,
          segmentNumber, routeEvent, routeEventProgress, lightsOn,
          expressMode, passingStation, braking: isBrakingForStation(),
          boostPopupCount: speedBoostPopups.length, midAnnouncementDone, runningSoundEnabled,
          autoMode, autoActionTimer, autoTargetKmh: autoTargetKmh(),
          playElapsedSeconds, motionEffect: canvas.dataset.motionEffect,
          onboardPassengers: [...onboardPassengers],
          timeOfDay, weather, visitedStations: [...visitedStations],
          opposingPool: opposingTrainPoolForSegment().map((type) => type.name),
          opposingTrain: opposingTrain ? {
            name: opposingTrain.type.name,
            cars: opposingTrain.cars,
            x: opposingTrain.x,
          } : null,
        };
      },
      auto(enabled) { setAutoMode(Boolean(enabled)); },
      setCars(n) {
        cars = Math.max(1, Math.min(MAX_CARS, n));
        carTypes = Array(cars).fill(trainKey);
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
