(() => {
  'use strict';
  const normalize = text => text.normalize('NFKC').toLowerCase()
    .replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
  // Search aliases only; vehicle captions and spoken names use their existing data.
  const TRAIN_SEARCH_ALIASES={
    nozomi:'のぞみ ひかり こだま みずほ さくら N700A',
    doctoryellow:'ドクターイエロー',
    hayabusa:'はやぶさ はやて やまびこ なすの E5 H5',
    komachi:'こまち E6',
    blueGoldShinkansen:'かがやき はくたか あさま つるぎ とき たにがわ E7 W7',
    redShinkansen:'つばめ さくら 800',
    orangeShinkansen:'かもめ N700S',
    purpleShinkansen:'つばさ E3',
    railTamper:'マルタイ 保線車',railGrinder:'保線車',railBallast:'保線車',
  };
  function matches(text,query) {
    return normalize(query).trim().split(/\s+/).filter(Boolean).every(term=>normalize(text).includes(term));
  }
  function inPrefecture(routeKey,prefecture,data) {
    return !prefecture||(data.routes[routeKey]||[]).includes(Number(prefecture));
  }
  function groups(keys,recent,recommended) {
    const available=new Set(keys);
    const top=recommended && available.has(recommended)?[recommended]:[];
    const history=[...new Set(recent)].filter(key=>available.has(key)&&!top.includes(key));
    const excluded=new Set([...top,...history]);
    const rest=keys.filter(key=>!excluded.has(key));
    return {recommended:top,recent:history,items:rest,total:keys.length};
  }
  function couplingKeys(initial,preferred,defaults,trains) {
    const valid=key=>trains[key]&&!['airplane','ferry','car'].includes(trains[key].kind);
    const other=[...new Set([...preferred,...defaults])].filter(key=>key!==initial&&valid(key)).slice(0,9);
    return valid(initial)?[...other,initial]:[];
  }
  function convoyKeys(initial,preferred,defaults,trains) {
    if(trains[initial]?.kind!=='car')return [];
    return [...new Set([...preferred,...defaults])].filter(key=>key!==initial&&trains[key]?.kind==='car').slice(0,9).concat(initial);
  }
  window.TRAIN_GO_CATALOG={normalize,matches,groups,couplingKeys,convoyKeys,inPrefecture,TRAIN_SEARCH_ALIASES};
})();
