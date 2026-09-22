(() => {
  'use strict';
  function request(geolocation,onFound,onError) {
    if(!geolocation){onError('このブラウザでは現在地を取得できないよ。');return;}
    try {
      geolocation.getCurrentPosition(position=>{
        const {latitude,longitude,accuracy}=position.coords;
        if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180){
          onError('位置を確認できなかったよ。もう一度ためしてね。');return;
        }
        onFound({lat:latitude,lon:longitude,accuracy:Number.isFinite(accuracy)&&accuracy>=0?accuracy:null});
      },error=>onError(error.code===1?'位置情報が許可されていないよ。ブラウザの設定を確認してね。'
        :error.code===3?'時間がかかったので止めたよ。もう一度ためしてね。':'現在地を取得できなかったよ。もう一度ためしてね。'),
      {enableHighAccuracy:true,timeout:10000,maximumAge:0});
    } catch {onError('位置情報を利用できないよ。ブラウザの設定を確認してね。');}
  }
  window.TRAIN_GO_MAP_LOCATION={request};
})();
