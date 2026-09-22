(() => {
  'use strict';
  const deadhead=()=> 'この電車は、回送電車です。どなた様も、ご乗車になれません。';
  function next({station,terminal=false,passing=false,outOfService=false}) {
    if(outOfService)return deadhead();
    if(passing)return `次の、${station}は、通過いたします。`;
    return terminal?`次は、終点、終点、${station}です。`:`次は、${station}、${station}です。`;
  }
  function approach({station,terminal=false,passing=false,outOfService=false}) {
    if(outOfService)return 'この電車は、回送電車です。';
    if(passing)return `まもなく、${station}を、通過いたします。`;
    return terminal?`まもなく、終点、${station}です。お忘れ物のないよう、お降りください。`
      :`まもなく、${station}、${station}です。お降りの方は、お忘れ物のないようご注意ください。`;
  }
  function arrival({station,terminal=false}) {
    return terminal?`終点、${station}、${station}です。ご乗車ありがとうございました。お忘れ物のないよう、お降りください。`
      :`${station}、${station}です。お降りの方は、お忘れ物のないようご注意ください。`;
  }
  window.TRAIN_GO_ANNOUNCEMENTS={next,approach,arrival,deadhead};
})();
