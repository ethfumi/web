(() => {
  function layout(count,width,height) {
    const lanes=2,carWidth=Math.min(330,width*.4,height*.3),gap=carWidth*.2;
    const offset=i=>Math.floor(i/lanes)*(carWidth+gap)+(i%lanes)*carWidth*.32;
    const extent=carWidth+Math.max(offset(Math.max(0,count-1)),offset(Math.max(0,count-2)));
    return {lanes,carWidth,gap,extent,offset,spacing:carWidth*.18,scale:Math.min(1,width*.59/extent)};
  }
  window.TRAIN_GO_ROAD_LAYOUT={layout};
})();
