(() => {
  const profiles={
    stairs:{light:'#ffb52e',calls:['ひこうきのいりぐちへ、かいだんをはこびます','たらっぷしゃ、ゆっくりすすみます']},
    airportTug:{light:'#ffb52e',calls:['ひこうきをおす、じゅんびよし！','まわりをかくにん。ゆっくりすすみます']},
    highLoader:{light:'#ffb52e',calls:['にもつを、ひこうきのたかさへあげます','にもつのこてい、よし！']},
    beltLoader:{light:'#ffb52e',calls:['ベルトでにもつを、はこびます','スーツケースを、たいせつにはこびます']},
    airportFuel:{light:'#ffb52e',calls:['ひこうきのねんりょうを、はこびます','ホースのかくにん、よし！']},
    police:{light:'#ff463f',siren:'police',calls:['パトロールにしゅっぱつします','パトカーがとおります。みちをあけてください','こうさてん、あんぜんかくにん！']},
    ambulance:{light:'#ff463f',siren:'ambulance',calls:['きゅうきゅうしゃがとおります。みちをあけてください','びょういんへむかいます','あんぜんをかくにんして、すすみます']},
    fireEngine:{light:'#ff463f',siren:'fire',calls:['しょうぼうしゃ、しゅつどうします','しょうぼうしゃがとおります。みちをあけてください','げんばにむかいます。あんぜんかくにん！']},
    ladder:{light:'#ff463f',siren:'fire',calls:['はしごしゃ、しゅつどうします','たかいところの、たすけにむかいます','はしごのじゅんび、よし！']},
    snowplow:{light:'#ffb52e',calls:['ゆきをよけて、みちをあけます','ゆっくり、あんぜんにすすみます']},
    sweeper:{light:'#ffb52e',calls:['どうろをきれいにします','ブラシでごみをあつめます']},
    garbageTruck:{calls:['ごみをあつめにいきます','まわりをかくにん。あんぜんにしゅっぱつ！']},
    aerial:{light:'#ffb52e',calls:['たかいところの、さぎょうにむかいます','あしもと、まわり、あんぜんかくにん！']},
    craneTruck:{light:'#ffb52e',calls:['おもいにもつを、もちあげます','まわりのあんぜん、よし！']},
    tow:{light:'#ffb52e',calls:['こまっているくるまを、たすけにいきます','くるまをしっかり、こていします']},
    tamper:{light:'#ffb52e',calls:['せんろのいしを、つきかためます','せんろをととのえます。あんぜんかくにん！']},
    grinder:{light:'#ffb52e',calls:['レールをけずって、なめらかにします','せんろのてんけんに、しゅっぱつ！']},
    ballast:{light:'#ffb52e',calls:['せんろのいしを、ととのえます','さぎょうそうち、かくにんよし！']},
  };
  const normalCalls=['シートベルトをしめて、しゅっぱつしましょう','あんぜんうんてんで、すすみます','まもなく、もくてきちです'];
  function sound(shape,seconds,speed){
    const siren=profiles[shape]?.siren;
    if(siren==='ambulance')return [Math.floor(seconds*2)%2?770:960,80,.026];
    if(siren)return [500+(1-Math.cos(seconds*Math.PI*(siren==='fire'?1.4:.8)))*260,90,.024];
    const heavy=['snowplow','sweeper','garbageTruck','craneTruck','tow','aerial','tamper','grinder','ballast'].includes(shape);
    return [heavy?38+speed*.15:32+speed*.2,heavy?72+speed*.25:55+speed*.35,heavy?.034:.028];
  }
  // A soft 1.5 Hz pulse, limited to small beacons rather than a screen flash.
  const lightAlpha=seconds=>.35+.65*(.5+.5*Math.sin(seconds*Math.PI*3));
  function lightRect(shape) {
    return ({police:[-12,-58,29,6],ambulance:[21,-63,23,5],fireEngine:[40,-54,20,5],
      snowplow:[38,-55,20,5],airportTug:[10,-57,16,6],
      tamper:[58,-61,16,6],grinder:[58,-61,16,6],ballast:[58,-61,16,6]})[shape] || [40,-54,20,5];
  }
  function createFireBell(audio,destination) {
    const gain=audio.createGain(),tones=[1320,2138].map(frequency=>{
      const osc=audio.createOscillator();osc.type='sine';osc.frequency.value=frequency;
      osc.connect(gain);osc.start();return osc;
    });
    gain.gain.value=0;gain.connect(destination);
    let lastStep=-1,stopped=false;
    return {
      update(time,active) {
        if(stopped)return;
        const step=Math.floor(time/.4);
        if(!active){gain.gain.cancelScheduledValues(time);gain.gain.setValueAtTime(0,time);lastStep=-1;return;}
        if(step===lastStep)return;
        lastStep=step;
        if(step%6>=3)return;
        gain.gain.cancelScheduledValues(time);
        gain.gain.setValueAtTime(.001,time);
        gain.gain.linearRampToValueAtTime(.7,time+.004);
        gain.gain.exponentialRampToValueAtTime(.001,time+.32);
      },
      stop(time) {
        if(stopped)return;stopped=true;
        gain.gain.cancelScheduledValues(time);gain.gain.setTargetAtTime(0,time,.025);
        let remaining=tones.length;
        tones.forEach(osc=>{osc.onended=()=>{osc.disconnect();if(--remaining===0)gain.disconnect();};osc.stop(time+.2);});
      },
    };
  }
  window.TRAIN_GO_VEHICLE_EFFECTS={profiles,normalCalls,sound,lightAlpha,lightRect,createFireBell};
})();
