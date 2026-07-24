// つなげて！でんしゃ！ — 運賃テーブル（オフライン）
// 大人片道の公表運賃に近い距離帯表。全駅OD行列は持たず、容量を小さく保つ。
// 遊び用の近似であり、公式の運賃検索結果と一致しない場合がある。
(() => {
  "use strict";

  // [上限キロ, 運賃円] を昇順で並べ、距離に応じて最初に上限を超えない行を使う。
  // 出典の形: JR・メトロ等の距離帯運賃表（税込の一般的な大人片道）。
  const TABLES = {
    // JR 幹線 普通運賃（切符）
    jrMain: [
      [3, 150], [6, 190], [10, 200], [15, 240], [20, 320], [25, 410], [30, 500],
      [35, 590], [40, 680], [45, 770], [50, 860], [60, 990], [70, 1170], [80, 1340],
      [90, 1520], [100, 1690], [120, 1980], [140, 2310], [160, 2640], [180, 2980],
      [200, 3310], [220, 3640], [240, 3980], [260, 4310], [280, 4640], [300, 4980],
      [320, 5310], [340, 5640], [360, 5980], [380, 6310], [400, 6640], [420, 6980],
      [440, 7310], [460, 7640], [480, 7980], [500, 8310], [520, 8640], [540, 8980],
      [560, 9310], [580, 9640], [600, 9980],
    ],
    // JR 電車特定区間（東京）
    jrTokyo: [
      [3, 140], [6, 160], [10, 170], [15, 200], [20, 260], [25, 320], [30, 380],
      [35, 450], [40, 510], [45, 580], [50, 640], [60, 760], [70, 870], [80, 990],
      [90, 1100], [100, 1210], [120, 1430], [140, 1650], [160, 1880], [180, 2100],
      [200, 2320],
    ],
    // 東京メトロ（IC に近い距離帯）
    metro: [
      [6, 180], [11, 210], [15, 270], [19, 300], [23, 330], [28, 360],
      [34, 390], [40, 420], [45, 450], [51, 480], [57, 510], [63, 540],
      [70, 570], [78, 600],
    ],
    // 都営地下鉄
    toei: [
      [4, 180], [7, 210], [11, 270], [15, 300], [19, 330], [23, 360],
      [28, 390], [33, 420], [38, 450], [43, 480], [48, 510], [53, 540],
      [58, 570], [63, 600],
    ],
    // 大手私鉄の通勤運賃に近い距離帯（京王・東急・京急など）
    private: [
      [4, 140], [6, 160], [9, 180], [12, 210], [15, 240], [19, 270],
      [23, 300], [28, 330], [33, 370], [38, 410], [44, 450], [50, 490],
      [57, 540], [64, 590], [72, 640], [80, 700], [90, 770], [100, 840],
    ],
    // 新幹線: 乗車券相当 + 指定席特急の合算に近い概算
    shinkansen: [
      [50, 3500], [100, 5940], [150, 7560], [200, 9240], [250, 10890],
      [300, 12430], [350, 14000], [400, 15210], [450, 16420], [500, 17630],
      [550, 18840], [600, 20050], [650, 21260], [700, 22470], [750, 23680],
      [800, 24890], [900, 27310], [1000, 29730], [1100, 32150], [1200, 34570],
    ],
    // 航空: 距離帯の目安（早割の中央値イメージ）。路線固定運賃があればそちら優先。
    air: [
      [300, 9800], [400, 12800], [500, 14800], [700, 18800], [900, 22800],
      [1200, 26800], [1600, 31800], [2000, 36800], [3000, 45800], [5000, 59800],
      [10000, 79800],
    ],
  };

  // 600km 超の幹線は 20km ごと約 330 円増し（公表表の伸び方に合わせた近似）。
  function lookupTable(table, distanceKm) {
    const km = Math.max(1, Math.ceil(distanceKm));
    for (const [maxKm, yen] of table) {
      if (km <= maxKm) return yen;
    }
    const [lastMax, lastYen] = table[table.length - 1];
    if (table === TABLES.jrMain || table === TABLES.jrTokyo) {
      const extraBlocks = Math.ceil((km - lastMax) / 20);
      return lastYen + extraBlocks * 330;
    }
    if (table === TABLES.shinkansen) {
      const extraBlocks = Math.ceil((km - lastMax) / 50);
      return lastYen + extraBlocks * 1200;
    }
    const perKm = lastYen / Math.max(1, lastMax);
    return Math.round(lastYen + (km - lastMax) * perKm);
  }

  const ROUTE_FARE_CLASS = {
    // 首都圏 JR
    yamanote: "jrTokyo",
    chuo: "jrTokyo",
    sobu: "jrTokyo",
    saikyo: "jrTokyo",
    shonanShinjuku: "jrTokyo",
    uenoTokyo: "jrTokyo",
    keihinTohoku: "jrTokyo",
    keiyo: "jrTokyo",
    rinkai: "jrTokyo",
    yokosuka: "jrTokyo",
    uchibo: "jrMain",
    osakaLoop: "jrTokyo",
    // 地下鉄
    ginza: "metro",
    marunouchi: "metro",
    hibiya: "metro",
    chiyoda: "metro",
    yurakucho: "metro",
    hanzomon: "metro",
    namboku: "metro",
    fukutoshin: "metro",
    tozai: "metro",
    asakusa: "toei",
    mita: "toei",
    shinjukuSubway: "toei",
    oedo: "toei",
    osakaChuo: "metro",
    // 私鉄
    inokashira: "private",
    keio: "private",
    keioSagamihara: "private",
    odakyu: "private",
    toyoko: "private",
    keikyu: "private",
    hankyuTakarazuka: "private",
    yurikamome: "private",
    // 新幹線
    tokaido: "shinkansen",
    tohoku: "shinkansen",
    hokkaido: "shinkansen",
    joetsu: "shinkansen",
    hokuriku: "shinkansen",
    yamagata: "shinkansen",
    akita: "shinkansen",
    sanyo: "shinkansen",
    kyushu: "shinkansen",
    nishiKyushu: "shinkansen",
    // 空路（未登録キーは kind: "air" または距離表で処理）
    airOsaka: "air",
    airHokkaido: "air",
    airOkinawa: "air",
    airFukuoka: "air",
    airKomatsu: "air",
    airHachijo: "air",
    airIshigaki: "air",
    airMiyako: "air",
    airYakushima: "air",
    airAmami: "air",
    airHonolulu: "air",
    airGuam: "air",
  };

  // 実売の目安に近い固定運賃（路線キー → 円）。距離表より優先。
  const FIXED_FARES = {
    airOsaka: 14500,
    airHokkaido: 24800,
    airOkinawa: 29800,
    airFukuoka: 22800,
    airKomatsu: 16800,
    airHachijo: 19800,
    airIshigaki: 18800,
    airMiyako: 16800,
    airYakushima: 12800,
    airAmami: 17800,
    airHonolulu: 78000,
    airGuam: 48000,
    ferryMiyajima: 200,
    ferrySakurajima: 200,
    ferrySeikan: 2600,
    ferryTokyoBay: 750,
    ferryOgasawara: 30000,
    ferryTaiheiyo: 22000,
    ferryShinnihonkai: 18000,
  };

  function fareClassFor(routeKey, route) {
    if (FIXED_FARES[routeKey] != null) return "fixed";
    if (ROUTE_FARE_CLASS[routeKey]) return ROUTE_FARE_CLASS[routeKey];
    if (route?.kind === "air") return "air";
    if (route?.kind === "sea") return "jrMain";
    if (route?.kind === "shinkansen") return "shinkansen";
    return "jrMain";
  }

  function fareYen(routeKey, distanceKm, route = null) {
    if (FIXED_FARES[routeKey] != null) return FIXED_FARES[routeKey];
    const fareClass = fareClassFor(routeKey, route);
    const table = TABLES[fareClass] || TABLES.jrMain;
    return lookupTable(table, distanceKm);
  }

  window.TRAIN_GO_FARE = {
    tables: TABLES,
    fareClassFor,
    fareYen,
    fixedFares: FIXED_FARES,
  };
})();
