// つなげて！でんしゃ！ — オフライン空路データ
// 空港座標と飛行経路は事前収録し、プレイ中に外部通信は行わない。
(() => {
  "use strict";

  const extra = window.TRAIN_GO_EXTRA;
  if (!extra) return;

  extra.trains.airplane = {
    name: "しろいひこうき",
    kind: "airplane",
    body: "#f8fbff",
    stripe: "#2584d8",
    edge: "#8ba6bb",
    face: "#2584d8",
    callName: "しろいひこうき",
  };

  const flights = [
    {
      key: "airOsaka",
      name: "おおさかへの そら",
      color: "#2584d8",
      destination: "おおさかくうこう",
      distanceKm: 404,
      points: [
        ["はねだくうこう", 0, 139.7798, 35.5494],
        ["ふじさんの ちかく", 115, 138.82, 35.28],
        ["なごやの そら", 265, 136.92, 35.08],
        ["おおさかくうこう", 404, 135.4382, 34.7855],
      ],
    },
    {
      key: "airHokkaido",
      name: "ほっかいどうへの そら",
      color: "#4b9fe1",
      destination: "しんちとせくうこう",
      distanceKm: 820,
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
      points: [
        ["はねだくうこう", 0, 139.7798, 35.5494],
        ["しずおかの そら", 190, 138.25, 34.85],
        ["しこくの そら", 650, 133.55, 33.65],
        ["かごしまの そら", 1000, 130.55, 31.55],
        ["なはくうこう", 1560, 127.6460, 26.1958],
      ],
    },
  ];

  for (const flight of flights) {
    extra.routes[flight.key] = {
      name: flight.name,
      kind: "air",
      start: "はねだくうこう",
      startKm: 0,
      supportsExpress: false,
      allowCrossings: false,
      stations: [
        { name: flight.destination, km: flight.distanceKm },
        { name: "はねだくうこう", km: 0 },
      ],
      expressStops: new Set(),
      cityStations: new Set(["はねだくうこう", flight.destination]),
    };
    extra.maps[flight.key] = {
      name: flight.name,
      kind: "air",
      color: flight.color,
      points: flight.points,
    };
    extra.metadata.push({
      key: flight.key,
      name: flight.name,
      color: flight.color,
      icon: "✈️",
      trainKey: "airplane",
      kind: "air",
    });
  }
})();
