(() => {
  'use strict';
  const normalize = text => text.normalize('NFKC').toLowerCase()
    .replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
  function matches(text,query) {
    return normalize(query).trim().split(/\s+/).filter(Boolean).every(term=>normalize(text).includes(term));
  }
  function groups(keys,recent,recommended,limit) {
    const available=new Set(keys);
    const top=recommended && available.has(recommended)?[recommended]:[];
    const history=[...new Set(recent)].filter(key=>available.has(key)&&!top.includes(key));
    const excluded=new Set([...top,...history]);
    const rest=keys.filter(key=>!excluded.has(key));
    return {recommended:top,recent:history,items:rest.slice(0,limit),hasMore:rest.length>limit,total:keys.length};
  }
  function couplingKeys(initial,preferred,defaults,trains) {
    const valid=key=>trains[key]&&!['airplane','ferry'].includes(trains[key].kind);
    const other=[...new Set([...preferred,...defaults])].filter(key=>key!==initial&&valid(key)).slice(0,9);
    return valid(initial)?[...other,initial]:[];
  }
  window.TRAIN_GO_CATALOG={normalize,matches,groups,couplingKeys};
})();
