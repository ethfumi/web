  data.routeCatalog = {};
  data.allRailRouteKeys = [];
  for (const item of sources) {
    const oldRoute = data.routes[item.key];
    const oldMetadata = data.metadata.find(({key}) => key === item.key);
    // Keep handcrafted distances, express patterns and event names on established courses.
    if (!item.preserve || !oldRoute) {
      const stations = item.p.slice(1).map(([name, km]) => ({name, km}));
      if (!item.loop) stations.push({name:item.p[0][0], km:0});
      const underground = item.profile === "subway";
      data.routes[item.key] = {
        name:oldRoute?.name || item.name, start:item.p[0][0], startKm:0,
        supportsExpress:false, allowCrossings:!["subway", "newtransit", "monorail", "cable", "shinkansen"].includes(item.profile),
        stations, expressStops:new Set(), cityStations:new Set(item.p.map(([name]) => name)),
        tunnelPairs:underground ? item.p.slice(1).map((p, i) => [item.p[i][0], p[0]]) : [],
        undergroundStations:underground ? item.p.map(([name]) => name) : [],
        ...(item.loop ? {loopKm:item.p.at(-1)[1], terminalIndex:stations.length - 1} : {}),
      };
      data.maps[item.key] = {name:data.routes[item.key].name, color:item.color, points:item.p,
        ...(item.loop ? {loopKm:item.p.at(-1)[1]} : {})};
    }
    const trainKey = oldMetadata?.trainKey || ({tokaido:"nozomi", tohoku:"hayabusa", keioSagamihara:"keio"}[item.key] || item.key);
    if (!data.trains[trainKey]) {
      data.trains[trainKey] = {
        name:item.name + "のでんしゃ", callName:item.name + "のでんしゃ",
        kind:item.profile === "shinkansen" ? "shinkansen" : "commuter",
        profile:item.profile, noPantograph:item.noPantograph,
        body:"#edf1f2", stripe:item.color, face:item.color, edge:"#aeb8be",
      };
    }
    // Original HTML buttons have no metadata; only append buttons for newly created routes.
    if (!oldMetadata && !oldRoute) {
      data.metadata.push({key:item.key, name:data.routes[item.key].name, color:item.color, trainKey,
        kind:item.profile === "shinkansen" ? "shinkansen" : "rail", icon:item.icon,
        cars:item.cars, speedKmh:item.speedKmh});
    }
    if (item.key === "keioSagamihara" && !oldMetadata) {
      data.metadata.push({key:item.key, name:data.routes[item.key].name, color:item.color, trainKey:"keio",
        kind:"rail", icon:"🚆", cars:10, speedKmh:90});
    }
    const points = data.maps[item.key]?.points || item.p;
    const stationNames = item.preserve ? item.stationNames.filter((_, i) => points.some(p =>
      p[0] === item.p[i][0] || Math.hypot((p[2]-item.p[i][2])*90, (p[3]-item.p[i][3])*111) < 0.6
    )) : item.stationNames;
    data.routeCatalog[item.key] = {
      title:item.title, regions:item.regions, sourceCode:item.sourceCode,
      search:[item.title, item.name, ...stationNames, ...points.map(p => p[0])].join(" "),
      endpoints:data.routes[item.key].loopKm ? `${data.routes[item.key].start}から いっしゅう`
        : `${points[0][0]} 〜 ${points.at(-1)[0]}`,
      kind:item.profile === "shinkansen" ? "shinkansen" : "rail",
    };
    data.allRailRouteKeys.push(item.key);
  }
  // These existing through services are not separate records in the station database.
  for (const [key, sourceKeys] of Object.entries({
    akita:["railLine11211", "railLine11202"], yamagata:["railLine11216"],
    jobanLocal:["chiyoda", "joban"], tobuSkytree:["tobuIsesaki"],
  })) {
    const route = data.routes[key];
    if (!route) continue;
    const points = data.maps[key].points;
    data.routeCatalog[key] = {
      title:route.name, regions:[...new Set(sourceKeys.flatMap(k => data.routeCatalog[k]?.regions || ["kanto"]))],
      search:[route.name, ...points.map(p => p[0])].join(" "),
      endpoints:`${points[0][0]} 〜 ${points.at(-1)[0]}`,
      kind:["akita", "yamagata"].includes(key) ? "shinkansen" : "rail",
    };
  }
