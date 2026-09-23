(() => {
  function layout(count,width,height) {
    const lanes=Math.min(4,Math.max(2,count)),carWidth=Math.min(330,width*.4,height*.3);
    const gap=carWidth*.2,rows=Math.ceil(count/lanes),extent=rows*(carWidth+gap)-gap;
    return {lanes,carWidth,gap,extent,spacing:carWidth*.44,scale:Math.min(1,width*.94/extent)};
  }
  window.TRAIN_GO_ROAD_LAYOUT={layout};
})();
