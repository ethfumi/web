// Generated from MLIT N02-25 (CC BY 4.0) and the documented OSM supplement.
(() => {
  'use strict';
  const data=/* RAIL_SHAPES */;
  const decoded=data.segments.map(values=>{
    let lon=0,lat=0;const points=[];
    for(let i=0;i<values.length;i+=2){lon+=values[i];lat+=values[i+1];points.push([lon/data.precision,lat/data.precision]);}
    return points;
  });
  for(const [key,refs] of Object.entries(data.routes)) {
    const map=window.TRAIN_GO_MAP_DATA.maps[key];if(!map)continue;
    const original=map.points,points=[];
    if(refs.length!==original.length-1)throw new Error('Rail shape station count mismatch: '+key);
    for(let i=0;i<refs.length;i++) {
      const a=original[i],b=original[i+1],ref=refs[i];
      const path=ref?(ref<0?[...decoded[-ref-1]].reverse():decoded[ref-1]):[[a.lon,a.lat],[b.lon,b.lat]];
      const lengths=[0];let total=0;
      for(let j=1;j<path.length;j++) {
        const p=path[j-1],q=path[j];
        total+=Math.hypot((q[0]-p[0])*Math.cos((q[1]+p[1])*Math.PI/360),q[1]-p[1]);lengths.push(total);
      }
      if(!points.length)points.push({...a,lon:path[0][0],lat:path[0][1]});
      for(let j=1;j<path.length-1;j++)points.push({name:'',km:a.km+(b.km-a.km)*lengths[j]/total,lon:path[j][0],lat:path[j][1],geometryOnly:true});
      points.push({...b,lon:path.at(-1)[0],lat:path.at(-1)[1]});
    }
    if(map.loopKm){points.at(-1).lon=points[0].lon;points.at(-1).lat=points[0].lat;}
    map.points=points;map.coords=points.map(p=>[p.lon,p.lat]);
    map.minLon=Math.min(...points.map(p=>p.lon));map.maxLon=Math.max(...points.map(p=>p.lon));
    map.minLat=Math.min(...points.map(p=>p.lat));map.maxLat=Math.max(...points.map(p=>p.lat));
    map.endKm=points.at(-1).km;map.detailedRailShape=true;
  }
})();
