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
      coupling:validRecent(saved.coupling,trains).filter(key=>!['airplane','ferry'].includes(trains[key].kind)).slice(0,9),
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
    const unique = new Map(), ambiguous = new Set();
    for (const labels of Object.values(data.stationLabelsByRoute || {})) for (const [kana,kanji] of Object.entries(labels)) {
      if (unique.has(kana) && unique.get(kana) !== kanji) ambiguous.add(kana);
      unique.set(kana,kanji);
    }
    for (const kana of ambiguous) unique.delete(kana);
    const routeTitles = {akita:"秋田新幹線",yamagata:"山形新幹線",jobanLocal:"千代田線・常磐線",tobuSkytree:"東武スカイツリーライン",keio:"京王線"};
    return {
      station:(name,key,mode) => mode === "kanji" ? data.stationLabelsByRoute?.[key]?.[name] || unique.get(name) || name : name,
      route:(key,mode) => mode === "kanji" ? routeTitles[key] || data.routeCatalog[key]?.title || data.routes[key]?.name || key : data.routes[key]?.name || key,
    };
  }

  window.TRAIN_GO_TRIP_OPTIONS = {createPreferences, initialState, courseChoices, createNameResolver, MODEL_LABELS, RECENT_LIMIT};
})();
