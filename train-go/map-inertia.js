(() => {
  'use strict';
  function create() {
    let vx=0,vy=0,last=0,active=false;
    function stop(){vx=vy=0;active=false;}
    return {
      stop,
      begin(time){stop();last=time;},
      drag(dx,dy,time){
        const elapsed=Math.max(1,time-last);last=time;
        if(elapsed>120)vx=vy=0;
        const blend=1-Math.exp(-elapsed/35);
        vx+=(dx*1000/elapsed-vx)*blend;vy+=(dy*1000/elapsed-vy)*blend;
        const speed=Math.hypot(vx,vy);if(speed>1600){vx*=1600/speed;vy*=1600/speed;}
      },
      release(time){active=time-last<90&&Math.hypot(vx,vy)>35;if(!active)stop();return active;},
      step(dt){
        if(!active)return null;
        const decay=Math.exp(-Math.max(0,Math.min(dt,.05))/.18);
        const delta={x:vx*.18*(1-decay),y:vy*.18*(1-decay)};
        vx*=decay;vy*=decay;if(Math.hypot(vx,vy)<12)stop();return delta;
      },
      get active(){return active;},
    };
  }
  window.TRAIN_GO_MAP_INERTIA={create};
})();
