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

  // ---- 要素 ----
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const selectScreen = document.getElementById("select-screen");
  const runUi = document.getElementById("run-ui");
  const arrivalBanner = document.getElementById("arrival-banner");
  const btnCouple = document.getElementById("btn-couple");
  const btnRemove = document.getElementById("btn-remove");
  const btnHome = document.getElementById("btn-home");

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
  let state = "select"; // select | running | stopped
  let train = TRAINS.nozomi;
  let cars = 1;
  let speed = 0;
  let distance = 0;
  let wheelAngle = 0;
  let stationWorldX = 0;   // 次の駅の位置(距離座標)
  let currentStationX = null; // いま停車中(または通過直後)の駅の位置
  let viewScale = 1;       // 編成全体が見えるようにカメラを引く倍率
  let confetti = [];
  let clouds = [];

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
    stationWorldX = distance + STATION_INTERVAL + Math.random() * 3000;
  }

  function startGame(key) {
    train = TRAINS[key];
    cars = 1;
    speed = 0;
    distance = 0;
    currentStationX = null;
    viewScale = 1;
    state = "stopped";
    scheduleNextStation();
    selectScreen.classList.add("hidden");
    runUi.classList.remove("hidden");
    say(`${train.callName}、しゅっぱつしんこう！`);
  }

  function goHome() {
    state = "select";
    speed = 0;
    selectScreen.classList.remove("hidden");
    runUi.classList.add("hidden");
    arrivalBanner.classList.add("hidden");
  }

  function depart() {
    state = "running";
    arrivalBanner.classList.add("hidden");
    horn();
    speed = 220;
  }

  function arrive() {
    state = "stopped";
    speed = 0;
    currentStationX = stationWorldX;
    scheduleNextStation();
    arrivalBanner.classList.remove("hidden");
    chime();
    say("とうちゃく！");
    spawnConfetti();
  }

  function addCar() {
    if (cars >= MAX_CARS) {
      say(`${carWord(MAX_CARS)}！ながーい！これでまんたんだよ！`);
      return;
    }
    cars++;
    say(`${carWord(cars)}！`);
    spawnConfetti(12);
  }

  function removeCar() {
    if (cars <= 1) {
      say(`${carWord(1)}！これがさいごのいちりょうだよ！`);
      return;
    }
    cars--;
    say(`${carWord(cars)}！`);
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
      depart();
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

  function drawStations() {
    drawStation(stationWorldX);
    if (currentStationX !== null) drawStation(currentStationX);
  }

  function drawStation(worldX) {
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
    // 駅名板(絵として)
    ctx.fillStyle = "#fff";
    ctx.fillRect(screenX - 60, y - 90, 120, 34);
    ctx.strokeStyle = "#4a6fa5";
    ctx.lineWidth = 3;
    ctx.strokeRect(screenX - 60, y - 90, 120, 34);
    ctx.fillStyle = "#4a6fa5";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("えき", screenX, y - 66);
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
      const winCount = i === 0 ? 2 : 3;
      const winStart = i === 0 ? left + carW * 0.12 : left + carW * 0.12;
      for (let wi = 0; wi < winCount; wi++) {
        roundRect(winStart + wi * carW * 0.28, top + carH * 0.18, carW * 0.18, carH * 0.22, 4);
        ctx.fill();
      }

      // 連結器
      if (i > 0) {
        ctx.fillStyle = "#666";
        ctx.fillRect(right, top + carH * 0.6, gap, 6);
      }

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
    }

    // 編成全体が画面に入るようにカメラをなめらかに引く (W=0 の非表示中は更新しない)。
    // 下限 0.15: これより長い編成は画面外へ見切れさせ、車両が識別できる大きさを保つ
    if (W > 0) {
      const { carW, gap } = carMetrics();
      const targetScale = Math.max(
        Math.min(1, (W * (NOSE_R - 0.03)) / (cars * (carW + gap))),
        0.15
      );
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
      drawMountains();
      drawTrack();
      drawStations();
      drawTrain();
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
  if (new URLSearchParams(location.search).has("debug")) {
    window.__tg = {
      skipToStation() { distance = stationWorldX - 600; },
      status() {
        return { state, speed, distance, cars, viewScale, toStation: stationWorldX - distance };
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
  }

  // ---- PWA ----
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
