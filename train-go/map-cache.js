(() => {
  'use strict';
  // Keep map labels at nearly the same size while reusing the padded bitmap during motion.
  function placement(cache, scene, width, height) {
    if (!cache) return null;
    const ratio = scene.scale / cache.scale;
    if (ratio < .9 || ratio > 1.1) return null;
    const x = (cache.centerX-scene.centerWorldX)*scene.scale
      + scene.screenCenterX*(1-ratio)-cache.padding*ratio;
    const y = (cache.centerY-scene.centerWorldY)*scene.scale
      + scene.screenCenterY*(1-ratio)-cache.padding*ratio;
    if (x > 0 || y > 0 || x+(width+2*cache.padding)*ratio < width
      || y+(height+2*cache.padding)*ratio < height) return null;
    return {x, y, ratio};
  }
  window.TRAIN_GO_MAP_CACHE = {placement};
})();
