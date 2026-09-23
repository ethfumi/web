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
  window.TRAIN_GO_VEHICLE_EFFECTS={profiles,normalCalls,sound,lightAlpha};
})();
