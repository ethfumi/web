// つなげて！でんしゃ！ — オフライン海路（フェリー）データ
// 港座標と航路は事前収録し、プレイ中に外部通信は行わない。
(() => {
  "use strict";

  const routeData = window.TRAIN_GO_ROUTE_DATA;
  if (!routeData) return;

  routeData.trains.ferry = {
    name: "しろいふね",
    kind: "ferry",
    body: "#f4f8fb",
    stripe: "#2f7fb5",
    edge: "#7f97ab",
    face: "#2f7fb5",
    callName: "しろいふね",
  };

  const ferries = [
    {
      key: "ferryMiyajima",
      name: "みやじまの ふね",
      color: "#3d8ec9",
      start: "みやじまぐち",
      destination: "みやじま",
      distanceKm: 2,
      fareYen: 200,
      icon: "⛩️",
      points: [
        ["みやじまぐち", 0, 132.3034, 34.3120],
        ["みやじま", 2, 132.3200, 34.2960],
      ],
    },
    {
      key: "ferrySakurajima",
      name: "さくらじまの ふね",
      color: "#d4554a",
      start: "かごしまみなと",
      destination: "さくらじま",
      distanceKm: 3.8,
      fareYen: 200,
      icon: "🌋",
      points: [
        ["かごしまみなと", 0, 130.5588, 31.5902],
        ["さくらじま", 3.8, 130.5978, 31.5935],
      ],
    },
    {
      key: "ferrySeikan",
      name: "せいかんの ふね",
      color: "#2a6fa8",
      start: "あおもりみなと",
      destination: "はこだてみなと",
      distanceKm: 113,
      fareYen: 2600,
      icon: "🌊",
      points: [
        ["あおもりみなと", 0, 140.7360, 40.8290],
        ["つがるかいきょう", 55, 140.70, 41.30],
        ["はこだてみなと", 113, 140.7260, 41.7730],
      ],
    },
    {
      key: "ferryTokyoBay",
      name: "とうきょうわんフェリー",
      color: "#1f7fb8",
      start: "くりはま",
      destination: "はまかなや",
      distanceKm: 10,
      fareYen: 750,
      icon: "🌉",
      points: [
        ["くりはま", 0, 139.7065, 35.2310],
        ["とうきょうわん", 5, 139.78, 35.20],
        ["はまかなや", 10, 139.8250, 35.1700],
      ],
    },
    {
      key: "ferryOgasawara",
      name: "おがさわらの ふね",
      color: "#1a6a9a",
      start: "とうきょうみなと",
      destination: "ちちじま",
      distanceKm: 1000,
      fareYen: 30000,
      icon: "🏝️",
      points: [
        ["とうきょうみなと", 0, 139.7700, 35.6200],
        ["いずしょとうの うみ", 280, 139.50, 33.50],
        ["たいへいよう", 650, 141.00, 30.00],
        ["ちちじま", 1000, 142.1910, 27.0940],
      ],
    },
    {
      key: "ferryTaiheiyo",
      name: "たいへいようフェリー",
      color: "#2568a0",
      start: "なごやみなと",
      destination: "とまこまい",
      distanceKm: 1100,
      fareYen: 22000,
      icon: "🚢",
      points: [
        ["なごやみなと", 0, 136.8800, 35.0500],
        ["せんだいみなと", 520, 141.0000, 38.2600],
        ["とまこまい", 1100, 141.6500, 42.6300],
      ],
    },
    {
      key: "ferryShinnihonkai",
      name: "しんにほんかいフェリー",
      color: "#2c5f96",
      start: "つるが",
      destination: "おたる",
      distanceKm: 900,
      fareYen: 18000,
      icon: "🌅",
      points: [
        ["つるが", 0, 136.0760, 35.6450],
        ["にほんかい", 420, 137.50, 38.50],
        ["おたる", 900, 141.0000, 43.1900],
      ],
    },
  ];

  for (const ferry of ferries) {
    routeData.routes[ferry.key] = {
      name: ferry.name,
      kind: "sea",
      start: ferry.start,
      startKm: 0,
      supportsExpress: false,
      allowCrossings: false,
      stations: [
        { name: ferry.destination, km: ferry.distanceKm },
        { name: ferry.start, km: 0 },
      ],
      expressStops: new Set(),
      cityStations: new Set([ferry.start, ferry.destination]),
    };
    routeData.maps[ferry.key] = {
      name: ferry.name,
      kind: "sea",
      color: ferry.color,
      points: ferry.points,
    };
    routeData.metadata.push({
      key: ferry.key,
      name: ferry.name,
      color: ferry.color,
      icon: ferry.icon || "⛴️",
      trainKey: "ferry",
      kind: "sea",
      fareYen: ferry.fareYen,
      speedKmh: 35,
    });
  }
})();
