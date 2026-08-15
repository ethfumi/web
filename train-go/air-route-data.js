// つなげて！でんしゃ！ — オフライン空路データ
// 空港座標と飛行経路は事前収録し、プレイ中に外部通信は行わない。
(() => {
  "use strict";

  const routeData = window.TRAIN_GO_ROUTE_DATA;
  if (!routeData) return;

  routeData.trains.airplane = {
    name: "しろいひこうき",
    kind: "airplane",
    body: "#f8fbff",
    stripe: "#2584d8",
    edge: "#8ba6bb",
    face: "#2584d8",
    callName: "しろいひこうき",
  };

  // points: [名前, 営業キロ相当, 経度, 緯度]
  // start 省略時は はねだくうこう。destination は終点空港名。
  // fareYen がある路線は運賃表より優先（代表的な片道の目安）。
  const flights = [
    {
      key: "airOsaka",
      name: "いたみへの そら",
      color: "#2584d8",
      destination: "いたみくうこう",
      distanceKm: 404,
      fareYen: 14500,
      points: [
        ["はねだくうこう", 0, 139.7798, 35.5494],
        ["ふじさんの ちかく", 115, 138.82, 35.28],
        ["なごやの そら", 265, 136.92, 35.08],
        ["いたみくうこう", 404, 135.4382, 34.7855],
      ],
    },
    {
      key: "airHokkaido",
      name: "ほっかいどうへの そら",
      color: "#4b9fe1",
      destination: "しんちとせくうこう",
      distanceKm: 820,
      fareYen: 24800,
      points: [
        ["はねだくうこう", 0, 139.7798, 35.5494],
        ["せんだいの そら", 305, 140.88, 38.25],
        ["はちのへの そら", 570, 141.45, 40.50],
        ["しんちとせくうこう", 820, 141.6923, 42.7752],
      ],
    },
    {
      key: "airOkinawa",
      name: "おきなわへの そら",
      color: "#18a6c7",
      destination: "なはくうこう",
      distanceKm: 1560,
      fareYen: 29800,
      points: [
        ["はねだくうこう", 0, 139.7798, 35.5494],
        ["しずおかの そら", 190, 138.25, 34.85],
        ["しこくの そら", 650, 133.55, 33.65],
        ["かごしまの そら", 1000, 130.55, 31.55],
        ["なはくうこう", 1560, 127.6460, 26.1958],
      ],
    },
    {
      key: "airFukuoka",
      name: "ふくおかへの そら",
      color: "#3d8fd4",
      destination: "ふくおかくうこう",
      distanceKm: 880,
      fareYen: 22800,
      points: [
        ["はねだくうこう", 0, 139.7798, 35.5494],
        ["なごやの そら", 280, 136.92, 35.08],
        ["ひろしまの そら", 620, 132.45, 34.40],
        ["ふくおかくうこう", 880, 130.4467, 33.5859],
      ],
    },
    {
      key: "airKomatsu",
      name: "こまつへの そら",
      color: "#5aa8d8",
      destination: "こまつくうこう",
      distanceKm: 350,
      fareYen: 16800,
      points: [
        ["はねだくうこう", 0, 139.7798, 35.5494],
        ["ふじさんの ちかく", 120, 138.73, 35.36],
        ["のとの そら", 260, 136.90, 36.55],
        ["こまつくうこう", 350, 136.4075, 36.3946],
      ],
    },
    {
      key: "airHachijo",
      name: "はちじょうじまへの そら",
      color: "#2f9bb8",
      destination: "はちじょうじまくうこう",
      distanceKm: 290,
      fareYen: 19800,
      points: [
        ["はねだくうこう", 0, 139.7798, 35.5494],
        ["とうきょうわんの そら", 40, 139.82, 35.30],
        ["いずしょとうの そら", 170, 139.55, 34.20],
        ["はちじょうじまくうこう", 290, 139.7858, 33.1150],
      ],
    },
    {
      key: "airIshigaki",
      name: "いしがきじまへの そら",
      color: "#1ab0c2",
      start: "なはくうこう",
      destination: "いしがきくうこう",
      distanceKm: 410,
      fareYen: 18800,
      points: [
        ["なはくうこう", 0, 127.6460, 26.1958],
        ["みやこの そら", 180, 125.80, 25.40],
        ["いしがきくうこう", 410, 124.1649, 24.3964],
      ],
    },
    {
      key: "airMiyako",
      name: "みやこじまへの そら",
      color: "#22b8b0",
      start: "なはくうこう",
      destination: "みやこじまくうこう",
      distanceKm: 290,
      fareYen: 16800,
      points: [
        ["なはくうこう", 0, 127.6460, 26.1958],
        ["おきなわの みなみ", 120, 126.60, 25.50],
        ["みやこじまくうこう", 290, 125.2950, 24.7828],
      ],
    },
    {
      key: "airYakushima",
      name: "やくしまへの そら",
      color: "#3aa88a",
      start: "かごしまくうこう",
      destination: "やくしまくうこう",
      distanceKm: 140,
      fareYen: 12800,
      points: [
        ["かごしまくうこう", 0, 130.7194, 31.8034],
        ["おおすみの そら", 70, 130.80, 31.20],
        ["やくしまくうこう", 140, 130.6596, 30.3856],
      ],
    },
    {
      key: "airAmami",
      name: "あまみおおしまへの そら",
      color: "#2f9a7a",
      start: "かごしまくうこう",
      destination: "あまみくうこう",
      distanceKm: 380,
      fareYen: 17800,
      points: [
        ["かごしまくうこう", 0, 130.7194, 31.8034],
        ["たねがしまの そら", 160, 130.95, 30.55],
        ["あまみくうこう", 380, 129.7125, 28.4306],
      ],
    },
    {
      key: "airHonolulu",
      name: "ホノルルへの そら",
      color: "#e07a4a",
      start: "なりたくうこう",
      destination: "ホノルルくうこう",
      distanceKm: 6200,
      fareYen: 78000,
      // 日付変更線をまたぐので、経度は東回りで連続化（+360）する。
      points: [
        ["なりたくうこう", 0, 140.3864, 35.7720],
        ["たいへいようの そら", 2800, 165.0, 30.0],
        ["ハワイの そら", 5200, 195.0, 24.0],
        ["ホノルルくうこう", 6200, 202.0776, 21.3187],
      ],
    },
    {
      key: "airGuam",
      name: "グアムへの そら",
      color: "#d96a5c",
      start: "なりたくうこう",
      destination: "グアムくうこう",
      distanceKm: 2500,
      fareYen: 48000,
      points: [
        ["なりたくうこう", 0, 140.3864, 35.7720],
        ["みなみの そら", 800, 142.2, 25.0],
        ["たいへいよう", 1600, 143.6, 18.0],
        ["グアムくうこう", 2500, 144.7960, 13.4834],
      ],
    },
  ];

  for (const flight of flights) {
    const start = flight.start || "はねだくうこう";
    routeData.routes[flight.key] = {
      name: flight.name,
      kind: "air",
      start,
      startKm: 0,
      supportsExpress: false,
      allowCrossings: false,
      stations: [
        { name: flight.destination, km: flight.distanceKm },
        { name: start, km: 0 },
      ],
      expressStops: new Set(),
      cityStations: new Set([start, flight.destination]),
    };
    routeData.maps[flight.key] = {
      name: flight.name,
      kind: "air",
      color: flight.color,
      points: flight.points,
    };
    routeData.metadata.push({
      key: flight.key,
      name: flight.name,
      color: flight.color,
      icon: "✈️",
      trainKey: "airplane",
      kind: "air",
      fareYen: flight.fareYen,
    });
  }
})();
