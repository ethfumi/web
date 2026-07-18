// しんかんせん GO! — 3歳向け新幹線アプリ
// 文字が読めなくても遊べる・失敗がない・タップで必ず反応する、を設計原則とする。

(() => {
  "use strict";

  // ---- 車両定義 ----
  const TRAINS = {
    nozomi: {
      name: "のぞみ",
      body: "#f8f8f8",
      stripe: "#1c48a6",
      edge: "#c8c8c8",
      callName: "のぞみ",
    },
    doctoryellow: {
      name: "ドクターイエロー",
      body: "#ffd900",
      stripe: "#1c48a6",
      edge: "#d4b400",
      callName: "ドクターイエロー",
    },
    hayabusa: {
      name: "はやぶさ",
      body: "#2ea44f",
      stripe: "#e83a8b",
      edge: "#1e7a38",
      callName: "はやぶさ",
    },
    komachi: {
      name: "こまち",
      body: "#ef3340",
      stripe: "#b7b7b7",
      edge: "#b51f2a",
      callName: "こまち",
    },
  };

  const CAR_COUNT_WORDS = [
    "いちりょう", "にりょう", "さんりょう", "よんりょう", "ごりょう",
    "ろくりょう", "ななりょう", "はちりょう", "きゅうりょう", "じゅうりょう",
  ];
  const MAX_CARS = 100;

  // 11両以降は「11りょう」表記でも日本語 TTS が「じゅういちりょう」と読んでくれる
  function carWord(n) {
    return n <= CAR_COUNT_WORDS.length ? CAR_COUNT_WORDS[n - 1] : `${n}りょう`;
  }

  const MAX_SPEED = 900;          // px/s
  const TAP_BOOST = 160;
  const FRICTION = 60;            // px/s^2
  const STATION_INTERVAL = 9000;  // px 走るごとに駅が来る

  // 中央・総武線各駅停車ごっこ: 阿佐ケ谷を出発して西へ。高尾まで行ったら最初に戻る
  const START_STATION = "あさがや";
  const STATIONS = [
    "おぎくぼ", "にしおぎくぼ", "きちじょうじ", "みたか",
    "むさしさかい", "ひがしこがねい", "むさしこがねい", "こくぶんじ",
    "にしこくぶんじ", "くにたち", "たちかわ", "ひの",
    "とよだ", "はちおうじ", "にしはちおうじ", "たかお",
    START_STATION,
  ];

  // ---- 要素 ----
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const selectScreen = document.getElementById("select-screen");
  const runUi = document.getElementById("run-ui");
  const arrivalBanner = document.getElementById("arrival-banner");
  const btnCouple = document.getElementById("btn-couple");
  const btnRemove = document.getElementById("btn-remove");
  const btnHome = document.getElementById("btn-home");
  const btnKomachiCouple = document.getElementById("btn-komachi-couple");
  const btnStationDoors = document.getElementById("btn-station-doors");
  const doorLabel = document.getElementById("door-label");
  const stationPassengers = document.getElementById("station-passengers");
  const routeEventBanner = document.getElementById("route-event-banner");
  const btnHeadlight = document.getElementById("btn-headlight");
  const headlightLabel = document.getElementById("headlight-label");

  let W = 0, H = 0, DPR = 1;
  let forcedSize = false; // デバッグ用: 非表示タブでも描画検証できるようにサイズを固定する
  function resize() {
    if (forcedSize) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  // ---- 音まわり ----
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }

  // 「ぷあ〜ん」警笛: 2つのオシレータを少しずらして鳴らす
  function horn() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.05);
    gain.gain.setValueAtTime(0.25, t + 0.6);
    gain.gain.linearRampToValueAtTime(0, t + 0.9);
    gain.connect(audioCtx.destination);
    for (const freq of [311, 370]) {
      const osc = audioCtx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 1.0);
    }
  }

  // 到着チャイム: 短い上昇アルペジオ
  function chime() {
    if (!audioCtx) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const t = audioCtx.currentTime + i * 0.15;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  function say(text) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.rate = 0.95;
    u.pitch = 1.2;
    speechSynthesis.speak(u);
  }

  // ---- ゲーム状態 ----
  let state = "select"; // select | running | stopped | coupling
  let train = TRAINS.nozomi;
  let cars = 1;
  let speed = 0;
  let distance = 0;
  let wheelAngle = 0;
  let stationWorldX = 0;   // 次の駅の位置(距離座標)
  let currentStationX = null; // いま停車中(または通過直後)の駅の位置
  let stationIdx = -1;        // STATIONS 内の次に停まる駅
  let nextStationName = "";
  let currentStationName = "";
  let viewScale = 1;       // 編成全体が見えるようにカメラを引く倍率
  let confetti = [];
  let clouds = [];
  let komachiCoupled = false;
  let komachiReady = false;
  let komachiStationX = null;
  let komachiGap = 110;
  let doorsOpen = false;
  let stationDoorsDone = true;
  let segmentNumber = 0;
  let segmentStartDistance = 0;
  let routeEvent = ""; // "" | fuji | inspection | tunnel
  let routeEventAnnounced = false;
  let routeEventProgress = 0;
  let lightsOn = false;
  let inspectionTime = 0;

  function initClouds() {
    clouds = [];
    for (let i = 0; i < 6; i++) {
      clouds.push({
        x: Math.random() * W,
        y: H * (0.05 + Math.random() * 0.25),
        s: 0.6 + Math.random() * 0.8,
      });
    }
  }
  initClouds();

  function scheduleNextStation() {
    stationIdx = (stationIdx + 1) % STATIONS.length;
    nextStationName = STATIONS[stationIdx];
    stationWorldX = distance + STATION_INTERVAL + Math.random() * 3000;
  }

  function startGame(key) {
    train = TRAINS[key];
    cars = 1;
    speed = 0;
    distance = 0;
    currentStationX = null;
    currentStationName = "";
    stationIdx = -1;
    viewScale = 1;
    state = "stopped";
    scheduleNextStation();
    komachiCoupled = false;
    komachiReady = false;
    komachiGap = 110;
    komachiStationX = key === "hayabusa" ? stationWorldX : null;
    doorsOpen = false;
    stationDoorsDone = true;
    segmentNumber = 0;
    segmentStartDistance = 0;
    selectScreen.classList.add("hidden");
    runUi.classList.remove("hidden");
    btnKomachiCouple.classList.add("hidden");
    btnStationDoors.classList.add("hidden");
    stationPassengers.classList.add("hidden");
    clearRouteEvent();
    arrivalBanner.textContent = "とうちゃく〜！";
    say(`${train.callName}、${START_STATION}えきを、しゅっぱつしんこう！`);
  }

  function goHome() {
    state = "select";
    speed = 0;
    selectScreen.classList.remove("hidden");
    runUi.classList.add("hidden");
    arrivalBanner.classList.add("hidden");
    btnKomachiCouple.classList.add("hidden");
    btnStationDoors.classList.add("hidden");
    stationPassengers.classList.add("hidden");
    clearRouteEvent();
  }

  function depart() {
    if (komachiReady || state === "coupling" || !stationDoorsDone) return;
    state = "running";
    arrivalBanner.classList.add("hidden");
    btnStationDoors.classList.add("hidden");
    stationPassengers.classList.add("hidden");
    segmentNumber++;
    segmentStartDistance = distance;
    routeEventAnnounced = false;
    routeEventProgress = 0;
    lightsOn = false;
    inspectionTime = 0;
    routeEvent = "";
    if (segmentNumber === 1 && train === TRAINS.nozomi) routeEvent = "fuji";
    if (segmentNumber === 1 && train === TRAINS.doctoryellow) routeEvent = "inspection";
    if (segmentNumber === 2) routeEvent = "tunnel";
    routeEventBanner.classList.add("hidden");
    btnHeadlight.classList.add("hidden");
    horn();
    say(`つぎは、${nextStationName}`);
    speed = 220;
  }

  function arrive() {
    clearRouteEvent();
    state = "stopped";
    speed = 0;
    currentStationX = stationWorldX;
    currentStationName = nextStationName;
    doorsOpen = false;
    stationDoorsDone = false;
    btnStationDoors.classList.add("hidden");
    stationPassengers.classList.add("hidden");
    const isKomachiStop = train === TRAINS.hayabusa
      && currentStationName === "おぎくぼ"
      && !komachiCoupled;
    scheduleNextStation();
    arrivalBanner.classList.remove("hidden");
    chime();
    if (isKomachiStop) {
      komachiReady = true;
      arrivalBanner.textContent = "こまちがいた！";
      btnKomachiCouple.classList.remove("hidden");
      say("おぎくぼにとうちゃく！こまちがまっているよ。れんけつしよう！");
    } else {
      arrivalBanner.textContent = "とうちゃく〜！";
      showStationDoorPrompt();
      say(`${currentStationName}〜、${currentStationName}〜、とうちゃく！ドアをあけてみよう！`);
    }
    spawnConfetti();
  }

  function startKomachiCoupling() {
    if (!komachiReady || state !== "stopped") return;
    state = "coupling";
    btnKomachiCouple.classList.add("hidden");
    arrivalBanner.textContent = "れんけつするよ〜！";
    say("こまちと、れんけつするよ〜！");
  }

  function finishKomachiCoupling() {
    komachiGap = 8;
    komachiCoupled = true;
    komachiReady = false;
    komachiStationX = null;
    state = "stopped";
    arrivalBanner.textContent = "れんけつ！";
    chime();
    spawnConfetti(90);
    say(`ガチャン！はやぶさと、こまち、れんけつ！ぜんぶで、${carWord(totalCarCount())}！`);
    showStationDoorPrompt();
  }

  function showStationDoorPrompt() {
    doorsOpen = false;
    stationDoorsDone = false;
    doorLabel.textContent = "ドアをあける";
    btnStationDoors.setAttribute("aria-label", "ドアをあける");
    btnStationDoors.classList.remove("hidden");
  }

  function toggleStationDoors() {
    if (state !== "stopped" || stationDoorsDone || komachiReady) return;

    if (!doorsOpen) {
      doorsOpen = true;
      doorLabel.textContent = "ドアをしめる";
      btnStationDoors.setAttribute("aria-label", "ドアをしめる");
      arrivalBanner.textContent = "ごじょうしゃ〜！";
      stationPassengers.classList.remove("hidden");
      spawnConfetti(18);
      say("ドアがひらきます。うさぎさん、くまさん、ぺんぎんさん、ごじょうしゃくださーい！");
      return;
    }

    doorsOpen = false;
    stationDoorsDone = true;
    btnStationDoors.classList.add("hidden");
    stationPassengers.classList.add("hidden");
    arrivalBanner.textContent = "しゅっぱつできるよ！";
    say("ドアがしまりまーす。しゅっぱつしんこう！");
  }

  function clearRouteEvent() {
    routeEvent = "";
    routeEventAnnounced = false;
    routeEventProgress = 0;
    lightsOn = false;
    routeEventBanner.classList.add("hidden");
    btnHeadlight.classList.add("hidden");
    headlightLabel.textContent = "ライトをつける";
    btnHeadlight.setAttribute("aria-label", "ライトをつける");
  }

  function updateRouteEvent(dt) {
    if (!routeEvent || state !== "running") return;
    const segmentLength = Math.max(stationWorldX - segmentStartDistance, 1);
    routeEventProgress = (distance - segmentStartDistance) / segmentLength;
    inspectionTime += dt;

    if (!routeEventAnnounced && routeEventProgress >= 0.22) {
      routeEventAnnounced = true;
      routeEventBanner.classList.remove("hidden");
      if (routeEvent === "fuji") {
        routeEventBanner.textContent = "ふじさんだ〜！";
        say("みてみて！おおきな、ふじさんがみえるよ！");
      } else if (routeEvent === "inspection") {
        routeEventBanner.textContent = "せんろを けんさちゅう！";
        say("ドクターイエロー、せんろをけんさちゅうです！");
      } else if (routeEvent === "tunnel") {
        routeEventBanner.textContent = "トンネルだ！";
        btnHeadlight.classList.remove("hidden");
        say("トンネルだ！ライトをつけてみよう！");
      }
    }

    if (routeEventProgress >= 0.8) {
      if (routeEvent === "inspection") {
        say("けんさ、おわり！せんろ、いじょうなし！");
        spawnConfetti(24);
      } else if (routeEvent === "tunnel") {
        say("トンネルを、ぬけたよ〜！");
      }
      clearRouteEvent();
    }
  }

  function addCar() {
    if (cars >= MAX_CARS) {
      say(`${carWord(totalCarCount())}！ながーい！これでまんたんだよ！`);
      return;
    }
    cars++;
    say(`${carWord(totalCarCount())}！`);
    spawnConfetti(12);
  }

  function removeCar() {
    if (cars <= 1) {
      const count = totalCarCount();
      say(komachiCoupled
        ? `${carWord(count)}！これいじょうは、きりはなせないよ！`
        : `${carWord(count)}！これがさいごのいちりょうだよ！`);
      return;
    }
    cars--;
    say(`${carWord(totalCarCount())}！`);
  }

  function totalCarCount() {
    return cars + (komachiCoupled ? 2 : 0);
  }

  function spawnConfetti(n = 40) {
    for (let i = 0; i < n; i++) {
      confetti.push({
        x: W * (0.2 + Math.random() * 0.6),
        y: H * 0.3,
        vx: (Math.random() - 0.5) * 300,
        vy: -Math.random() * 350 - 100,
        color: `hsl(${Math.random() * 360}, 90%, 60%)`,
        life: 1.6,
      });
    }
  }

  // ---- 入力 ----
  document.querySelectorAll(".train-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      ensureAudio();
      startGame(btn.dataset.train);
    });
  });

  canvas.addEventListener("pointerdown", () => {
    ensureAudio();
    if (state === "stopped") {
      if (!stationDoorsDone && !komachiReady) {
        toggleStationDoors();
      } else {
        depart();
      }
    } else if (state === "running") {
      speed = Math.min(speed + TAP_BOOST, MAX_SPEED);
    }
  });

  btnCouple.addEventListener("click", () => {
    ensureAudio();
    addCar();
  });
  btnRemove.addEventListener("click", () => {
    ensureAudio();
    removeCar();
  });
  btnHome.addEventListener("click", goHome);
  btnKomachiCouple.addEventListener("click", () => {
    ensureAudio();
    startKomachiCoupling();
  });
  btnStationDoors.addEventListener("click", () => {
    ensureAudio();
    toggleStationDoors();
  });
  btnHeadlight.addEventListener("click", () => {
    ensureAudio();
    if (routeEvent !== "tunnel" || lightsOn) return;
    lightsOn = true;
    headlightLabel.textContent = "ライト ついた！";
    btnHeadlight.setAttribute("aria-label", "ライトがついた");
    routeEventBanner.textContent = "ピカッ！あかるいね！";
    chime();
    say("ピカッ！ライトがついたよ！あかるいね！");
  });

  // ---- 描画 ----
  const GROUND_R = 0.78; // 線路の高さ(画面比)
  const NOSE_R = 0.62;   // 先頭車の画面上の位置(画面幅比)

  function carMetrics() {
    const carW = Math.min(W * 0.22, 190);
    return { carW, carH: carW * 0.32, gap: 8 };
  }

  // カメラを引いた時に描画が必要になる、スケール座標系での画面左右端
  function viewRange() {
    const ax = W * NOSE_R;
    return { x0: ax - ax / viewScale, x1: ax + (W - ax) / viewScale };
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#8fd4ff");
    g.addColorStop(0.6, "#d8f2ff");
    g.addColorStop(1, "#c2ecb0");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawClouds(dt) {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (const c of clouds) {
      c.x -= (speed * 0.08 + 8) * dt * c.s;
      if (c.x < -160) {
        c.x = W + 160;
        c.y = H * (0.05 + Math.random() * 0.25);
      }
      const r = 26 * c.s;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, 7);
      ctx.arc(c.x + r, c.y + 6, r * 0.8, 0, 7);
      ctx.arc(c.x - r, c.y + 6, r * 0.75, 0, 7);
      ctx.fill();
    }
  }

  function drawMountains() {
    const base = H * GROUND_R;
    const { x0, x1 } = viewRange();
    const period = W * 0.7;
    const off = (distance * 0.15) % (W * 1.4);
    ctx.fillStyle = "#9fd48a";
    const iStart = Math.floor((x0 + off - W * 0.35 - W * 0.45) / period);
    const iEnd = Math.ceil((x1 + off - W * 0.35 + W * 0.45) / period);
    for (let i = iStart; i <= iEnd; i++) {
      const x = i * period - off + W * 0.35;
      ctx.beginPath();
      ctx.moveTo(x - W * 0.45, base);
      ctx.quadraticCurveTo(x, base - H * 0.3, x + W * 0.45, base);
      ctx.fill();
    }
  }

  function routeEventAlpha() {
    if (!routeEventAnnounced) return 0;
    const fadeIn = Math.min((routeEventProgress - 0.22) / 0.08, 1);
    const fadeOut = Math.min((0.8 - routeEventProgress) / 0.08, 1);
    return Math.max(0, Math.min(fadeIn, fadeOut));
  }

  function drawFuji() {
    if (routeEvent !== "fuji" || !routeEventAnnounced) return;
    const base = H * GROUND_R;
    const x = W * 0.78 - distance * 0.015;
    const peakY = base - H * 0.52;
    const halfW = W * 0.34;
    ctx.save();
    ctx.globalAlpha = routeEventAlpha();
    ctx.fillStyle = "#7fa8c9";
    ctx.beginPath();
    ctx.moveTo(x - halfW, base);
    ctx.lineTo(x, peakY);
    ctx.lineTo(x + halfW, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(x, peakY);
    ctx.lineTo(x + halfW * 0.22, peakY + H * 0.12);
    ctx.lineTo(x + halfW * 0.1, peakY + H * 0.1);
    ctx.lineTo(x, peakY + H * 0.15);
    ctx.lineTo(x - halfW * 0.1, peakY + H * 0.1);
    ctx.lineTo(x - halfW * 0.22, peakY + H * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawTunnel() {
    if (routeEvent !== "tunnel" || !routeEventAnnounced) return;
    const { x0, x1 } = viewRange();
    const groundY = H * GROUND_R;
    ctx.save();
    ctx.globalAlpha = 0.94 * routeEventAlpha();
    ctx.fillStyle = "#202735";
    ctx.fillRect(x0, 0, x1 - x0, groundY);
    ctx.strokeStyle = "#465268";
    ctx.lineWidth = 10;
    const ribSpacing = 180;
    const off = (distance * 0.45) % ribSpacing;
    for (let x = x0 - off; x < x1 + ribSpacing; x += ribSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x, H * 0.18);
      ctx.stroke();
    }
    ctx.fillStyle = lightsOn ? "#fff4ad" : "#69758a";
    for (let x = x0 + 90 - off; x < x1 + ribSpacing; x += ribSpacing) {
      ctx.fillRect(x, H * 0.2, 38, 8);
    }
    ctx.restore();
  }

  function drawTrack() {
    const y = H * GROUND_R;
    const { x0, x1 } = viewRange();
    ctx.fillStyle = "#8a7a5c";
    ctx.fillRect(x0, y, x1 - x0, (H - y) / viewScale);
    // 枕木
    ctx.fillStyle = "#6d5f45";
    const spacing = 46;
    const off = distance % spacing;
    for (let x = -off + Math.floor((x0 + off) / spacing) * spacing; x < x1; x += spacing) {
      ctx.fillRect(x, y + 10, 26, 8);
    }
    // レール
    ctx.fillStyle = "#555";
    ctx.fillRect(x0, y + 6, x1 - x0, 4);
  }

  function drawInspectionEffect() {
    if (routeEvent !== "inspection" || !routeEventAnnounced) return;
    const y = H * GROUND_R;
    const { x0, x1 } = viewRange();
    const scanX = x0 + ((inspectionTime * 260) % Math.max(x1 - x0, 1));
    ctx.save();
    ctx.globalAlpha = routeEventAlpha();
    const glow = ctx.createLinearGradient(scanX - 90, 0, scanX + 90, 0);
    glow.addColorStop(0, "rgba(65,225,255,0)");
    glow.addColorStop(0.5, "rgba(65,225,255,0.9)");
    glow.addColorStop(1, "rgba(65,225,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(scanX - 90, y - 8, 180, 38);
    ctx.fillStyle = "#d8fbff";
    for (let i = 0; i < 4; i++) {
      const sparkleX = scanX - 55 + i * 36;
      const sparkleY = y + 8 + Math.sin(inspectionTime * 7 + i) * 8;
      ctx.beginPath();
      ctx.arc(sparkleX, sparkleY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawHeadlight() {
    if (routeEvent !== "tunnel" || !routeEventAnnounced || !lightsOn) return;
    const { carW, gap } = carMetrics();
    const frontX = W * NOSE_R + (komachiCoupled ? komachiGap + carW * 2 + gap : 0);
    const centerY = H * GROUND_R - carW * 0.16;
    const beam = ctx.createLinearGradient(frontX, 0, frontX + W * 0.4, 0);
    beam.addColorStop(0, "rgba(255,244,160,0.75)");
    beam.addColorStop(1, "rgba(255,244,160,0)");
    ctx.save();
    ctx.globalAlpha = routeEventAlpha();
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(frontX - 4, centerY - 7);
    ctx.lineTo(frontX + W * 0.42, centerY - H * 0.13);
    ctx.lineTo(frontX + W * 0.42, centerY + H * 0.13);
    ctx.lineTo(frontX - 4, centerY + 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawStations() {
    drawStation(stationWorldX, nextStationName);
    if (currentStationX !== null) drawStation(currentStationX, currentStationName);
  }

  function drawStation(worldX, name) {
    if (state !== "running" && state !== "stopped") return;
    const trainNoseX = W * NOSE_R;
    const screenX = worldX - distance + trainNoseX;
    const { x0, x1 } = viewRange();
    if (screenX - 300 > x1 || screenX + 300 < x0) return;
    const y = H * GROUND_R;
    // ホーム
    ctx.fillStyle = "#e0e0e0";
    ctx.fillRect(screenX - 240, y - 14, 480, 14);
    ctx.fillStyle = "#c0c0c0";
    ctx.fillRect(screenX - 240, y - 14, 480, 4);
    // 屋根と柱
    ctx.fillStyle = "#4a6fa5";
    ctx.fillRect(screenX - 200, y - 120, 400, 12);
    ctx.fillStyle = "#888";
    ctx.fillRect(screenX - 180, y - 108, 8, 94);
    ctx.fillRect(screenX + 172, y - 108, 8, 94);
    // 駅名板(ひらがな)。文字数に合わせて板の幅を変える
    const bw = Math.max(110, name.length * 22 + 26);
    ctx.fillStyle = "#fff";
    ctx.fillRect(screenX - bw / 2, y - 90, bw, 34);
    ctx.strokeStyle = "#4a6fa5";
    ctx.lineWidth = 3;
    ctx.strokeRect(screenX - bw / 2, y - 90, bw, 34);
    ctx.fillStyle = "#4a6fa5";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(name, screenX, y - 66);
  }

  function drawWheel(x, y, r) {
    ctx.fillStyle = "#3a3a3a";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.fill();
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7 * Math.cos(wheelAngle), y - r * 0.7 * Math.sin(wheelAngle));
    ctx.lineTo(x + r * 0.7 * Math.cos(wheelAngle), y + r * 0.7 * Math.sin(wheelAngle));
    ctx.stroke();
  }

  function drawCarNumber(x, y, number, carH) {
    const radius = Math.max(10, Math.min(14, carH * 0.22));
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.strokeStyle = "#25384a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#17212b";
    ctx.font = `bold ${Math.max(14, radius * 1.25)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(number), x, y + 1);
    ctx.textBaseline = "alphabetic";
  }

  function drawTrain() {
    const y = H * GROUND_R;
    const { carW, carH, gap } = carMetrics();
    const noseX = W * NOSE_R;
    const bob = state === "running" ? Math.sin(distance * 0.05) * 1.5 : 0;

    for (let i = 0; i < cars; i++) {
      const right = noseX - i * (carW + gap);
      const left = right - carW;
      const top = y - carH - 10 + bob * (i % 2 === 0 ? 1 : -1);

      ctx.fillStyle = train.body;
      ctx.strokeStyle = train.edge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const isTail = cars > 1 && i === cars - 1;
      if (i === 0) {
        // 先頭車: ロングノーズ
        ctx.moveTo(left, top + 6);
        ctx.quadraticCurveTo(left, top, left + 10, top);
        ctx.lineTo(right - carW * 0.45, top);
        ctx.quadraticCurveTo(right - carW * 0.1, top + 2, right, top + carH - 8);
        ctx.quadraticCurveTo(right, top + carH, right - 8, top + carH);
        ctx.lineTo(left + 6, top + carH);
        ctx.quadraticCurveTo(left, top + carH, left, top + carH - 6);
        ctx.closePath();
      } else if (isTail) {
        // 最後の車両: 後ろ向きの運転席がある後尾車。
        ctx.moveTo(left, top + carH - 8);
        ctx.quadraticCurveTo(left + carW * 0.1, top + 2, left + carW * 0.45, top);
        ctx.lineTo(right - 10, top);
        ctx.quadraticCurveTo(right, top, right, top + 6);
        ctx.lineTo(right, top + carH - 6);
        ctx.quadraticCurveTo(right, top + carH, right - 6, top + carH);
        ctx.lineTo(left + 8, top + carH);
        ctx.quadraticCurveTo(left, top + carH, left, top + carH - 8);
        ctx.closePath();
      } else {
        roundRect(left, top, carW, carH, 8);
      }
      ctx.fill();
      ctx.stroke();

      // 帯
      ctx.fillStyle = train.stripe;
      if (i === 0) {
        ctx.beginPath();
        ctx.moveTo(left + 2, top + carH * 0.45);
        ctx.lineTo(right - carW * 0.32, top + carH * 0.42);
        ctx.lineTo(right - carW * 0.05, top + carH * 0.75);
        ctx.lineTo(right - carW * 0.05, top + carH * 0.88);
        ctx.lineTo(left + 2, top + carH * 0.62);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(left + 2, top + carH * 0.48, carW - 4, carH * 0.16);
      }

      // 窓
      ctx.fillStyle = "#333";
      const winCount = i === 0 || isTail ? 2 : 3;
      const winStart = isTail ? left + carW * 0.38 : left + carW * 0.12;
      for (let wi = 0; wi < winCount; wi++) {
        roundRect(winStart + wi * carW * 0.28, top + carH * 0.18, carW * 0.18, carH * 0.22, 4);
        ctx.fill();
      }

      // 駅では先頭車のドアが実際に開閉して見える。
      if (i === 0 && currentStationName) {
        const doorX = left + carW * 0.72;
        const doorY = top + carH * 0.14;
        const doorW = carW * 0.16;
        const doorH = carH * 0.7;
        ctx.fillStyle = doorsOpen ? "#25384a" : train.body;
        ctx.fillRect(doorX, doorY, doorW, doorH);
        ctx.strokeStyle = train.edge;
        ctx.lineWidth = 2;
        ctx.strokeRect(doorX, doorY, doorW, doorH);
        if (!doorsOpen) {
          ctx.beginPath();
          ctx.moveTo(doorX + doorW / 2, doorY);
          ctx.lineTo(doorX + doorW / 2, doorY + doorH);
          ctx.stroke();
        }
      }

      // 連結器
      if (i > 0) {
        ctx.fillStyle = "#666";
        ctx.fillRect(right, top + carH * 0.6, gap, 6);
      }

      const carNumber = komachiCoupled ? i + 3 : i + 1;
      drawCarNumber(left + carW * 0.52, top + carH * 0.72, carNumber, carH);

      drawWheel(left + carW * 0.22, y - 8, 9);
      drawWheel(left + carW * 0.78, y - 8, 9);
    }
  }

  function drawKomachi() {
    if (train !== TRAINS.hayabusa || (!komachiCoupled && komachiStationX === null)) return;

    const y = H * GROUND_R;
    const { carW, carH, gap } = carMetrics();
    const noseX = W * NOSE_R;
    const connectionX = komachiCoupled
      ? noseX + komachiGap
      : komachiStationX - distance + noseX + komachiGap;
    const bob = state === "running" ? Math.sin(distance * 0.05 + 1) * 1.5 : 0;
    const top = y - carH - 10 + bob;

    for (let i = 0; i < 2; i++) {
      const left = connectionX + i * (carW + gap);
      const right = left + carW;
      ctx.fillStyle = TRAINS.komachi.body;
      ctx.strokeStyle = TRAINS.komachi.edge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (i === 0) {
        // はやぶさ側を向く、連結用の先頭車。
        ctx.moveTo(left, top + carH - 8);
        ctx.quadraticCurveTo(left + carW * 0.1, top + 2, left + carW * 0.45, top);
        ctx.lineTo(right - 10, top);
        ctx.quadraticCurveTo(right, top, right, top + 6);
        ctx.lineTo(right, top + carH - 6);
        ctx.quadraticCurveTo(right, top + carH, right - 6, top + carH);
        ctx.lineTo(left + 8, top + carH);
        ctx.quadraticCurveTo(left, top + carH, left, top + carH - 8);
      } else {
        // 編成の外側は右向きのロングノーズ。
        ctx.moveTo(left, top + 6);
        ctx.quadraticCurveTo(left, top, left + 10, top);
        ctx.lineTo(right - carW * 0.45, top);
        ctx.quadraticCurveTo(right - carW * 0.1, top + 2, right, top + carH - 8);
        ctx.quadraticCurveTo(right, top + carH, right - 8, top + carH);
        ctx.lineTo(left + 6, top + carH);
        ctx.quadraticCurveTo(left, top + carH, left, top + carH - 6);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = TRAINS.komachi.stripe;
      ctx.fillRect(left + carW * 0.08, top + carH * 0.52, carW * 0.84, carH * 0.14);

      ctx.fillStyle = "#333";
      const windowStart = left + carW * 0.2;
      for (let wi = 0; wi < 2; wi++) {
        roundRect(windowStart + wi * carW * 0.3, top + carH * 0.18, carW * 0.18, carH * 0.22, 4);
        ctx.fill();
      }

      if (i === 0) {
        ctx.fillStyle = "#666";
        ctx.fillRect(right, top + carH * 0.6, gap, 6);
      }
      drawCarNumber(left + carW * 0.52, top + carH * 0.72, 2 - i, carH);
      drawWheel(left + carW * 0.22, y - 8, 9);
      drawWheel(left + carW * 0.78, y - 8, 9);
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawConfetti(dt) {
    confetti = confetti.filter((p) => p.life > 0);
    for (const p of confetti) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 700 * dt;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillRect(p.x, p.y, 8, 8);
    }
    ctx.globalAlpha = 1;
  }

  // ---- メインループ ----
  let lastT = performance.now();
  function frame(now) {
    const dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;

    // バックグラウンド起動などで resize イベントを取りこぼしても復帰できるようにする
    if (!forcedSize && (window.innerWidth !== W || window.innerHeight !== H || canvas.width === 0)) {
      resize();
    }

    if (state === "running") {
      const distToStation = stationWorldX - distance;
      const braking = distToStation < speed * speed / (2 * 300) + 50;

      if (braking) {
        // 駅が近づいたら自動でブレーキして、ぴったり停車する
        const decel = Math.max((speed * speed) / (2 * Math.max(distToStation, 1)), 100);
        speed = Math.max(speed - decel * dt, 0);
      } else {
        // 摩擦でゆるやかに減速(タップしなくても止まりはしない)
        speed = Math.max(speed - FRICTION * dt, 120);
      }

      if (distToStation <= 2 || (speed <= 1 && distToStation < 400)) {
        distance = stationWorldX;
        arrive();
      }

      distance += speed * dt;
      wheelAngle += speed * dt * 0.08;
      updateRouteEvent(dt);
    }

    if (state === "coupling") {
      komachiGap = Math.max(komachiGap - 85 * dt, 8);
      if (komachiGap <= 8) finishKomachiCoupling();
    }

    // 編成全体が画面に入るようにカメラをなめらかに引く (W=0 の非表示中は更新しない)。
    // 下限 0.15: これより長い編成は画面外へ見切れさせ、車両が識別できる大きさを保つ
    if (W > 0) {
      const { carW, gap } = carMetrics();
      const leftScale = (W * (NOSE_R - 0.03)) / (cars * (carW + gap));
      const komachiIsNear = komachiStationX !== null
        && komachiStationX - distance < W * 1.2;
      const rightCars = komachiCoupled || komachiIsNear ? 2 : 0;
      const rightScale = rightCars > 0
        ? (W * (1 - NOSE_R - 0.03)) / (rightCars * (carW + gap) + komachiGap)
        : 1;
      const targetScale = Math.max(Math.min(1, leftScale, rightScale), 0.15);
      viewScale += (targetScale - viewScale) * Math.min(dt * 3, 1);
    }

    drawSky();
    drawClouds(dt);
    if (state !== "select") {
      ctx.save();
      const ax = W * NOSE_R;
      const ay = H * GROUND_R;
      ctx.translate(ax, ay);
      ctx.scale(viewScale, viewScale);
      ctx.translate(-ax, -ay);
      drawFuji();
      drawMountains();
      drawTunnel();
      drawTrack();
      drawInspectionEffect();
      drawStations();
      drawHeadlight();
      drawTrain();
      drawKomachi();
      ctx.restore();
    }
    drawConfetti(dt);

    scheduleFrame();
  }

  // タブが非表示だと requestAnimationFrame は発火しないので、低頻度の setTimeout で継続する
  function scheduleFrame() {
    if (document.hidden) {
      setTimeout(() => frame(performance.now()), 200);
    } else {
      requestAnimationFrame(frame);
    }
  }
  scheduleFrame();

  // ---- デバッグフック (?debug 付きで開いた時だけ) ----
  const isDebug = new URLSearchParams(location.search).has("debug");
  if (isDebug) {
    window.__tg = {
      skipToStation() { distance = stationWorldX - 600; },
      status() {
        return {
          state, speed, distance, cars, viewScale,
          toStation: stationWorldX - distance,
          nextStationName, currentStationName,
          komachiCoupled, komachiReady, komachiGap,
          doorsOpen, stationDoorsDone,
          segmentNumber, routeEvent, routeEventProgress, lightsOn,
        };
      },
      setCars(n) { cars = Math.max(1, Math.min(MAX_CARS, n)); },
      forceSize(w, h) {
        forcedSize = true;
        DPR = 1;
        W = w;
        H = h;
        canvas.width = w;
        canvas.height = h;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      },
    };

    // ブラウザの分離された検証環境からも、実際の操作として駅直前へ進められる。
    const debugSkipButton = document.createElement("button");
    debugSkipButton.type = "button";
    debugSkipButton.textContent = "テスト: えきのまえへ";
    debugSkipButton.setAttribute("aria-label", "テストで駅の前へ進む");
    Object.assign(debugSkipButton.style, {
      position: "fixed", left: "8px", bottom: "8px", zIndex: "99",
      padding: "8px", fontSize: "14px",
    });
    debugSkipButton.addEventListener("click", () => {
      if (state === "stopped" && stationDoorsDone && !komachiReady) depart();
      if (state !== "running") return;
      distance = stationWorldX;
      arrive();
    });
    document.body.appendChild(debugSkipButton);

    const debugEventButton = document.createElement("button");
    debugEventButton.type = "button";
    debugEventButton.textContent = "テスト: イベントへ";
    debugEventButton.setAttribute("aria-label", "テストで走行イベントへ進む");
    Object.assign(debugEventButton.style, {
      position: "fixed", left: "8px", bottom: "52px", zIndex: "99",
      padding: "8px", fontSize: "14px",
    });
    debugEventButton.addEventListener("click", () => {
      if (state === "stopped" && stationDoorsDone && !komachiReady) depart();
      if (state !== "running") return;
      distance = segmentStartDistance + (stationWorldX - segmentStartDistance) * 0.3;
      updateRouteEvent(0);
    });
    document.body.appendChild(debugEventButton);
  }

  // ---- PWA ----
  const canUseServiceWorker = location.protocol === "https:"
    || location.hostname === "localhost"
    || location.hostname === "127.0.0.1";
  if ("serviceWorker" in navigator && canUseServiceWorker && !isDebug) {
    let reloadingForServiceWorker = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadingForServiceWorker) return;
      reloadingForServiceWorker = true;
      location.reload();
    });

    navigator.serviceWorker
      .register("sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => {});
  }
})();
