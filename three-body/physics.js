// 平面 N 体(主に 3 体)の重力計算。G = 1。ブラウザでは globalThis.ThreeBody、Node では module.exports。
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ThreeBody = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // 0 除算で NaN にしないためだけの値。軌道を丸めるソフトニングではない。
  const EPS2 = 1e-24;

  class System {
    constructor(bodies) {
      const n = bodies.length;
      this.n = n;
      this.t = 0;
      this.m = new Float64Array(n);
      this.p = new Float64Array(2 * n);
      this.v = new Float64Array(2 * n);
      this.a = new Float64Array(2 * n);
      this.work = null;
      bodies.forEach((b, i) => {
        this.m[i] = b.m;
        this.p[2 * i] = b.x;
        this.p[2 * i + 1] = b.y;
        this.v[2 * i] = b.vx;
        this.v[2 * i + 1] = b.vy;
      });
    }

    clone() {
      const s = new System([]);
      s.n = this.n;
      s.t = this.t;
      s.m = this.m.slice();
      s.p = this.p.slice();
      s.v = this.v.slice();
      s.a = this.a.slice();
      return s;
    }
  }

  function accel(m, p, a, n) {
    a.fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = p[2 * j] - p[2 * i];
        const dy = p[2 * j + 1] - p[2 * i + 1];
        const r2 = dx * dx + dy * dy + EPS2;
        const inv = 1 / (r2 * Math.sqrt(r2));
        a[2 * i] += m[j] * dx * inv;
        a[2 * i + 1] += m[j] * dy * inv;
        a[2 * j] -= m[i] * dx * inv;
        a[2 * j + 1] -= m[i] * dy * inv;
      }
    }
  }

  function drift(s, h) {
    const { p, v } = s;
    for (let i = 0; i < p.length; i++) p[i] += h * v[i];
  }

  function kick(s, h) {
    const { v, a } = s;
    accel(s.m, s.p, a, s.n);
    for (let i = 0; i < v.length; i++) v[i] += h * a[i];
  }

  function stepEuler(s, h) {
    const { p, v, a } = s;
    accel(s.m, p, a, s.n);
    for (let i = 0; i < p.length; i++) {
      p[i] += h * v[i];
      v[i] += h * a[i];
    }
  }

  function stepLeapfrog(s, h) {
    drift(s, 0.5 * h);
    kick(s, h);
    drift(s, 0.5 * h);
  }

  // Forest-Ruth: リープフロッグ 3 回を重み θ, 1-2θ, θ で合成した 4 次のシンプレクティック法。
  const THETA = 1 / (2 - Math.cbrt(2));

  function stepForestRuth(s, h) {
    drift(s, 0.5 * THETA * h);
    kick(s, THETA * h);
    drift(s, 0.5 * (1 - THETA) * h);
    kick(s, (1 - 2 * THETA) * h);
    drift(s, 0.5 * (1 - THETA) * h);
    kick(s, THETA * h);
    drift(s, 0.5 * THETA * h);
  }

  function stepRK4(s, h) {
    const len = 2 * s.n;
    if (!s.work || s.work.length !== 6 * len) s.work = new Float64Array(6 * len);
    const w = s.work;
    const p0 = w.subarray(0, len);
    const v0 = w.subarray(len, 2 * len);
    const dp = w.subarray(2 * len, 3 * len);
    const dv = w.subarray(3 * len, 4 * len);
    const pt = w.subarray(4 * len, 5 * len);
    const at = w.subarray(5 * len, 6 * len);
    const { p, v, m, n } = s;
    p0.set(p);
    v0.set(v);
    dp.fill(0);
    dv.fill(0);
    const weights = [1, 2, 2, 1];
    const offsets = [0.5, 0.5, 1];
    for (let k = 0; k < 4; k++) {
      accel(m, p, at, n);
      for (let i = 0; i < len; i++) {
        dp[i] += weights[k] * v[i];
        dv[i] += weights[k] * at[i];
      }
      if (k < 3) {
        const c = offsets[k] * h;
        for (let i = 0; i < len; i++) {
          pt[i] = p0[i] + c * v[i];
          v[i] = v0[i] + c * at[i];
        }
        p.set(pt);
      }
    }
    for (let i = 0; i < len; i++) {
      p[i] = p0[i] + (h / 6) * dp[i];
      v[i] = v0[i] + (h / 6) * dv[i];
    }
  }

  const METHODS = {
    euler: { label: 'EULER', order: 1, symplectic: false, step: stepEuler },
    rk4: { label: 'RK4', order: 4, symplectic: false, step: stepRK4 },
    leapfrog: { label: 'LEAPFROG', order: 2, symplectic: true, step: stepLeapfrog },
    forestRuth: { label: 'FOREST-RUTH', order: 4, symplectic: true, step: stepForestRuth },
  };

  // いちばん短いペアの自由落下時間 sqrt(r^3 / (mi + mj))。時間刻みの基準にする。
  function freeFallTime(s) {
    const { m, p, n } = s;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = p[2 * j] - p[2 * i];
        const dy = p[2 * j + 1] - p[2 * i + 1];
        const r2 = dx * dx + dy * dy + EPS2;
        const tau2 = (r2 * Math.sqrt(r2)) / (m[i] + m[j]);
        if (tau2 < best) best = tau2;
      }
    }
    return Math.sqrt(best);
  }

  function advance(s, tTarget, method, opts) {
    const o = opts || {};
    const eta = o.eta ?? 0.005;
    const dtMax = o.dtMax ?? 0.01;
    // 下限に張りつくのは星どうしが 1e-6 より近づく正面衝突のときで、そこでは誤差が出る。
    const dtMin = o.dtMin ?? 1e-12;
    const maxSteps = o.maxSteps ?? Infinity;
    const onStep = o.onStep;
    const step = METHODS[method].step;
    let steps = 0;
    while (s.t < tTarget && steps < maxSteps) {
      const h = Math.max(Math.min(eta * freeFallTime(s), dtMax), dtMin);
      const rem = tTarget - s.t;
      if (h >= rem) {
        step(s, rem);
        s.t = tTarget;
      } else {
        step(s, h);
        s.t += h;
      }
      steps++;
      if (onStep) onStep(s);
    }
    return steps;
  }

  function energy(s) {
    const { m, p, v, n } = s;
    let e = 0;
    for (let i = 0; i < n; i++) {
      e += 0.5 * m[i] * (v[2 * i] * v[2 * i] + v[2 * i + 1] * v[2 * i + 1]);
      for (let j = i + 1; j < n; j++) {
        const dx = p[2 * j] - p[2 * i];
        const dy = p[2 * j + 1] - p[2 * i + 1];
        e -= (m[i] * m[j]) / Math.sqrt(dx * dx + dy * dy + EPS2);
      }
    }
    return e;
  }

  function momentum(s) {
    let px = 0;
    let py = 0;
    for (let i = 0; i < s.n; i++) {
      px += s.m[i] * s.v[2 * i];
      py += s.m[i] * s.v[2 * i + 1];
    }
    return [px, py];
  }

  function separation(a, b) {
    let worst = 0;
    for (let i = 0; i < a.n; i++) {
      const d = Math.hypot(a.p[2 * i] - b.p[2 * i], a.p[2 * i + 1] - b.p[2 * i + 1]);
      if (d > worst) worst = d;
    }
    return worst;
  }

  // 重心を原点に、全運動量をゼロにする。
  function recenter(bodies) {
    let M = 0, cx = 0, cy = 0, px = 0, py = 0;
    for (const b of bodies) {
      M += b.m;
      cx += b.m * b.x;
      cy += b.m * b.y;
      px += b.m * b.vx;
      py += b.m * b.vy;
    }
    for (const b of bodies) {
      b.x -= cx / M;
      b.y -= cy / M;
      b.vx -= px / M;
      b.vy -= py / M;
    }
    return bodies;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Šuvakov-Dmitrašinović の周期解は、等質量の 3 体を (-1,0) (1,0) (0,0) に置き、
  // 速度を (p1,p2) (p1,p2) (-2p1,-2p2) とする 2 パラメータで表される。
  function suvakov(p1, p2) {
    return [
      { m: 1, x: -1, y: 0, vx: p1, vy: p2 },
      { m: 1, x: 1, y: 0, vx: p1, vy: p2 },
      { m: 1, x: 0, y: 0, vx: -2 * p1, vy: -2 * p2 },
    ];
  }

  function figureEight() {
    const x = 0.97000436, y = -0.24308753;
    const vx = -0.93240737, vy = -0.86473146;
    return [
      { m: 1, x: x, y: y, vx: -vx / 2, vy: -vy / 2 },
      { m: 1, x: -x, y: -y, vx: -vx / 2, vy: -vy / 2 },
      { m: 1, x: 0, y: 0, vx: vx, vy: vy },
    ];
  }

  function lagrange() {
    // 半径 1 の円に内接する正三角形。辺長 a = √3、角速度 ω = sqrt(M / a^3)。
    const omega = Math.sqrt(3 / Math.pow(Math.sqrt(3), 3));
    return [90, 210, 330].map((deg) => {
      const th = (deg * Math.PI) / 180;
      return { m: 1, x: Math.cos(th), y: Math.sin(th), vx: -omega * Math.sin(th), vy: omega * Math.cos(th) };
    });
  }

  function burrau() {
    return [
      { m: 3, x: 1, y: 3, vx: 0, vy: 0 },
      { m: 4, x: -2, y: -1, vx: 0, vy: 0 },
      { m: 5, x: 1, y: -1, vx: 0, vy: 0 },
    ];
  }

  function starPlanetMoon() {
    const mp = 0.01, mm = 1e-5, rm = 0.05;
    const vp = Math.sqrt(1 + mp);
    const vm = Math.sqrt(mp / rm);
    return recenter([
      { m: 1, x: 0, y: 0, vx: 0, vy: 0 },
      { m: mp, x: 1, y: 0, vx: 0, vy: vp },
      { m: mm, x: 1 + rm, y: 0, vx: 0, vy: vp + vm },
    ]);
  }

  function circumbinary() {
    const v = Math.sqrt(2) / 2;
    const r = 3.2;
    return recenter([
      { m: 1, x: -0.5, y: 0, vx: 0, vy: -v },
      { m: 1, x: 0.5, y: 0, vx: 0, vy: v },
      { m: 1e-3, x: r, y: 0, vx: 0, vy: Math.sqrt(2 / r) },
    ]);
  }

  function eulerLine() {
    // 等質量が一直線に並ぶ。外側の星は中央と反対側の両方に引かれるので v² = 1 + 1/4。
    // 完全に対称な初期値は丸め誤差も対称に入って永久に崩れないので、中央を 1e-9 ずらす。
    // ずれは半周ごとに約 250 倍に育つ。
    const v = Math.sqrt(1.25);
    return recenter([
      { m: 1, x: -1, y: 0, vx: 0, vy: -v },
      { m: 1, x: 1e-9, y: 0, vx: 0, vy: 0 },
      { m: 1, x: 1, y: 0, vx: 0, vy: v },
    ]);
  }

  // 恒星(質量 1)と円軌道の惑星(質量 mu)に、惑星と同じ角速度で回る小天体を足す。
  // angleDeg は恒星から見た惑星との角度、dr は軌道半径のずれ。
  function coorbital(mu, angleDeg, dr) {
    const omega = Math.sqrt(1 + mu);
    const pair = recenter([
      { m: 1, x: 0, y: 0, vx: 0, vy: 0 },
      { m: mu, x: 1, y: 0, vx: 0, vy: omega },
    ]);
    const th = (angleDeg * Math.PI) / 180;
    const x = pair[0].x + (1 + dr) * Math.cos(th);
    const y = pair[0].y + (1 + dr) * Math.sin(th);
    return recenter([...pair, { m: 1e-9, x, y, vx: -omega * y, vy: omega * x }]);
  }

  // 近日点 rp・遠日点 ra の楕円軌道に乗せた探査機が、phaseDeg の位置から回り始めた惑星とすれ違う。
  function slingshot(mu, rp, ra, phaseDeg) {
    const omega = Math.sqrt(1 + mu);
    const th = (phaseDeg * Math.PI) / 180;
    const vp = Math.sqrt(2 / rp - 2 / (rp + ra));
    return recenter([
      { m: 1, x: 0, y: 0, vx: 0, vy: 0 },
      { m: mu, x: Math.cos(th), y: Math.sin(th), vx: -omega * Math.sin(th), vy: omega * Math.cos(th) },
      { m: 1e-9, x: rp, y: 0, vx: 0, vy: vp },
    ]);
  }

  // 間隔 1 の等質量の連星に、衝突径数 b・速さ v の星が左から飛び込む。
  function flyby(b, v, phaseDeg) {
    const th = (phaseDeg * Math.PI) / 180;
    const vb = Math.sqrt(2) / 2;
    return recenter([
      { m: 1, x: 0.5 * Math.cos(th), y: 0.5 * Math.sin(th), vx: -vb * Math.sin(th), vy: vb * Math.cos(th) },
      { m: 1, x: -0.5 * Math.cos(th), y: -0.5 * Math.sin(th), vx: vb * Math.sin(th), vy: -vb * Math.cos(th) },
      { m: 1, x: -7, y: b, vx: v, vy: 0 },
    ]);
  }

  // 太陽系。単位は太陽質量・天文単位で、G = 1 なので 1 年 = 2π。
  // 各惑星は近日点から出発し、出発の向きは惑星ごとにばらしてある。
  const PLANETS = {
    MERCURY: { m: 1.66e-7, a: 0.387, e: 0.206, color: [0.75, 0.73, 0.7] },
    VENUS: { m: 2.45e-6, a: 0.723, e: 0.007, color: [1.0, 0.9, 0.65] },
    EARTH: { m: 3.0e-6, a: 1.0, e: 0.017, color: [0.4, 0.7, 1.0] },
    MARS: { m: 3.23e-7, a: 1.524, e: 0.093, color: [1.0, 0.45, 0.3] },
    JUPITER: { m: 9.55e-4, a: 5.203, e: 0.049, color: [1.0, 0.72, 0.45] },
    SATURN: { m: 2.86e-4, a: 9.537, e: 0.057, color: [1.0, 0.88, 0.55] },
    URANUS: { m: 4.37e-5, a: 19.19, e: 0.046, color: [0.6, 0.95, 0.95] },
    NEPTUNE: { m: 5.15e-5, a: 30.07, e: 0.009, color: [0.4, 0.55, 1.0] },
  };

  function solarSystem(names) {
    const bodies = [{ m: 1, x: 0, y: 0, vx: 0, vy: 0 }];
    names.forEach((name, i) => {
      const p = PLANETS[name];
      const th = i * 2.4;
      const r = p.a * (1 - p.e);
      const v = Math.sqrt(((1 + p.m) * (1 + p.e)) / r);
      bodies.push({ m: p.m, x: r * Math.cos(th), y: r * Math.sin(th), vx: -v * Math.sin(th), vy: v * Math.cos(th) });
    });
    return recenter(bodies);
  }

  function solarScenario(id, name, sub, names, extra) {
    return Object.assign({
      id, group: 'system', name, sub,
      make: () => solarSystem(names),
      labels: ['SUN', ...names],
      colors: [[1.0, 0.85, 0.4], ...names.map((n) => PLANETS[n].color)],
      formula: names.map((n) => `${n}: a = ${PLANETS[n].a} AU, e = ${PLANETS[n].e}, m = ${PLANETS[n].m.toExponential(2)}`).join('\n'),
    }, extra);
  }

  function suvakovScenario(id, name, p1, p2, period) {
    return {
      id, group: 'periodic', name, sub: 'ŠUVAKOV–DMITRAŠINOVIĆ 2013',
      make: () => suvakov(p1, p2), period, view: 1.6, speed: Math.max(1.2, period / 7), trail: period * 1.02,
      formula: `r = (−1,0) (1,0) (0,0)\nv₁ = v₂ = (${p1}, ${p2}),  v₃ = −2v₁`,
      text: `2013 年に見つかった 13 種の周期解の仲間。名前は、3 体の並び方を球面に写したときの軌跡の形から付けられた。1 周期は T ≈ ${period}。`,
    };
  }

  // 束縛された(全エネルギーが負の)ランダムな 3 体。同じ seed なら同じ初期条件。
  function randomBodies(seed) {
    const rng = mulberry32(seed);
    const bodies = [];
    for (let i = 0; i < 3; i++) {
      const r = 0.5 + 0.8 * rng();
      const th = ((i + rng() * 0.8) * 2 * Math.PI) / 3;
      const sp = 0.2 + 0.6 * rng();
      const dir = 2 * Math.PI * rng();
      bodies.push({
        m: 0.4 + 1.6 * rng(),
        x: r * Math.cos(th),
        y: r * Math.sin(th),
        vx: sp * Math.cos(dir),
        vy: sp * Math.sin(dir),
      });
    }
    recenter(bodies);
    let K = 0, U = 0;
    for (let i = 0; i < 3; i++) {
      K += 0.5 * bodies[i].m * (bodies[i].vx ** 2 + bodies[i].vy ** 2);
      for (let j = i + 1; j < 3; j++) {
        U -= (bodies[i].m * bodies[j].m) / Math.hypot(bodies[i].x - bodies[j].x, bodies[i].y - bodies[j].y);
      }
    }
    const q = 0.2 + 0.25 * rng();
    const scale = Math.sqrt((q * -U) / K);
    for (const b of bodies) {
      b.vx *= scale;
      b.vy *= scale;
    }
    return bodies;
  }

  const GROUPS = [
    { id: 'periodic', label: 'PERIODIC', note: '同じ軌道を繰り返す解' },
    { id: 'classic', label: 'CLASSIC', note: '18〜20 世紀の有名な問題' },
    { id: 'system', label: 'SOLAR SYSTEM', note: '恒星と惑星と小さな天体' },
    { id: 'chaos', label: 'CHAOS', note: '散乱とカオス' },
  ];

  // group の並びは GROUPS の順。N / B キーはこの配列の順に巡る。
  const SCENARIOS = [
    {
      id: 'figure8', key: '1', group: 'periodic', name: 'FIGURE-8', sub: 'MOORE 1993',
      make: figureEight, period: 6.32591398, view: 1.5, speed: 1.2, trail: 6.4,
      formula: 'r₁ = −r₂ = (0.97000436, −0.24308753),  r₃ = 0\nv₃ = (−0.93240737, −0.86473146),  v₁ = v₂ = −v₃/2',
      text: '等しい質量の 3 つの星が、1 本の 8 の字を等間隔で追いかけ合う軌道。1993 年に Cristopher Moore が数値計算で見つけ、2000 年に Chenciner と Montgomery が存在を証明した。少し揺らしても形を保つ、数少ない安定な周期解。',
    },
    {
      id: 'butterfly1', key: '2', group: 'periodic', name: 'BUTTERFLY I', sub: 'ŠUVAKOV–DMITRAŠINOVIĆ 2013',
      make: () => suvakov(0.30689, 0.12551), period: 6.2356, view: 1.5, speed: 1.2, trail: 6.3,
      formula: 'r = (−1,0) (1,0) (0,0)\nv₁ = v₂ = (0.30689, 0.12551),  v₃ = −2v₁',
      text: '2013 年にベオグラードの Šuvakov と Dmitrašinović が計算機で探し当てた 13 種の周期解のひとつ。蝶の羽のような形を描く。不安定なので、初期値の丸め誤差が育って数周でほどけていく。',
    },
    {
      id: 'moth1', key: '3', group: 'periodic', name: 'MOTH I', sub: 'ŠUVAKOV–DMITRAŠINOVIĆ 2013',
      make: () => suvakov(0.46444, 0.39606), period: 14.8939, view: 1.6, speed: 2, trail: 15,
      formula: 'r = (−1,0) (1,0) (0,0)\nv₁ = v₂ = (0.46444, 0.39606),  v₃ = −2v₁',
      text: '同じ 2013 年の発見から、蛾の名がついた解。3 つの星が翅を広げたような輪郭を繰り返しなぞる。',
    },
    {
      id: 'yinyang1', key: '4', group: 'periodic', name: 'YIN-YANG I', sub: 'ŠUVAKOV–DMITRAŠINOVIĆ 2013',
      make: () => suvakov(0.51394, 0.30474), period: 17.3284, view: 1.7, speed: 2.4, trail: 17.5,
      formula: 'r = (−1,0) (1,0) (0,0)\nv₁ = v₂ = (0.51394, 0.30474),  v₃ = −2v₁',
      text: '陰陽の勾玉が絡み合うような軌道。同じ 2013 年の発見のひとつ。',
    },
    {
      id: 'yarn', key: '5', group: 'periodic', name: 'YARN', sub: 'ŠUVAKOV–DMITRAŠINOVIĆ 2013',
      make: () => suvakov(0.55906, 0.34919), period: 55.5018, view: 1.8, speed: 5, trail: 56,
      formula: 'r = (−1,0) (1,0) (0,0)\nv₁ = v₂ = (0.55906, 0.34919),  v₃ = −2v₁',
      text: '毛糸玉。1 周期が長く、軌跡が幾重にも巻きついて玉になる。巻き終わると、また同じ糸の上を走りはじめる。',
    },
    suvakovScenario('butterfly2', 'BUTTERFLY II', 0.39295, 0.09758, 7.0039),
    suvakovScenario('butterfly3', 'BUTTERFLY III', 0.40592, 0.23016, 13.8658),
    suvakovScenario('butterfly4', 'BUTTERFLY IV', 0.350112, 0.07934, 79.4759),
    suvakovScenario('moth2', 'MOTH II', 0.43917, 0.45297, 28.6703),
    suvakovScenario('moth3', 'MOTH III', 0.38344, 0.37736, 25.8406),
    suvakovScenario('bumblebee', 'BUMBLEBEE', 0.18428, 0.58719, 63.5345),
    suvakovScenario('goggles', 'GOGGLES', 0.0833, 0.12789, 10.4668),
    suvakovScenario('dragonfly', 'DRAGONFLY', 0.08058, 0.58884, 21.271),
    suvakovScenario('yinyang1b', 'YIN-YANG I B', 0.2827, 0.32721, 10.9626),
    suvakovScenario('yinyang2a', 'YIN-YANG II A', 0.41682, 0.33033, 55.7898),
    suvakovScenario('yinyang2b', 'YIN-YANG II B', 0.41734, 0.3131, 54.2076),
    {
      id: 'lagrange', key: '6', group: 'classic', name: 'LAGRANGE', sub: 'EQUILATERAL 1772',
      make: lagrange, period: 2 * Math.PI / Math.sqrt(3 / Math.pow(Math.sqrt(3), 3)), view: 1.5, speed: 4, trail: 9,
      formula: '|rᵢ| = 1,  θ = 90° 210° 330°\nω² = M / a³,  a = √3',
      text: '1772 年にラグランジュが見つけた、正三角形のまま回り続ける解。質量が等しいと不安定で、計算機の丸め誤差(10⁻¹⁶ 程度)だけを種に、しばらく回ったあと突然崩れてカオスになる。太陽・木星・トロヤ群のように質量比が極端なら安定になる。',
    },
    {
      id: 'euler', group: 'classic', name: 'EULER', sub: 'COLLINEAR 1767',
      make: eulerLine, period: 2 * Math.PI / Math.sqrt(1.25), view: 1.5, speed: 2, trail: 8,
      formula: 'r = (−1,0) (10⁻⁹,0) (1,0)\nv = (0, ∓√1.25),  中央は静止',
      text: '1767 年にオイラーが見つけた、3 体が一直線に並んだまま回る解。ラグランジュの正三角形解より先に見つかった、三体問題で最初の厳密解。とても不安定で、ここでは中央の星を 10⁻⁹ だけずらしてある。そのずれが半周ごとに約 250 倍に育ち、2 周目で列が崩れる。',
    },
    {
      id: 'burrau', key: '7', group: 'classic', name: 'PYTHAGOREAN', sub: 'BURRAU 1913',
      // 接近遭遇が深く、刻みが粗いと弾き出しの時刻がずれる。
      make: burrau, view: 4.5, speed: 3, trail: 12, eta: 0.002,
      formula: 'm = 3, 4, 5   v = 0\nr = (1,3) (−2,−1) (1,−1)',
      text: '辺が 3:4:5 の直角三角形の頂点に、向かいの辺と同じ質量の星を静止させて放す。1913 年に Burrau が出した問題で、1967 年に Szebehely と Peters が計算機で最後まで解いた。何度もすれ違ったあと、t ≈ 60 で 2 つが連星になり、残る 1 つが弾き出される。',
    },
    {
      id: 'moon', key: '8', group: 'system', name: 'STAR·PLANET·MOON', sub: 'HIERARCHY',
      make: starPlanetMoon, labels: ['STAR', 'PLANET', 'MOON'], view: 1.35, speed: 1.2, trail: 5,
      formula: 'm = 1, 10⁻², 10⁻⁵\nr(planet) = 1,  r(moon) = 0.05',
      text: '恒星・惑星・月。質量と距離に大きな段差がある「階層的」な三体は、2 つの二体問題にほぼ分かれて安定に回る。月の軌道は、惑星の重力が勝つ範囲(ヒル球)の内側にある。',
    },
    {
      id: 'binary', key: '9', group: 'system', name: 'CIRCUMBINARY', sub: 'PLANET OF TWO SUNS',
      make: circumbinary, view: 3.8, speed: 4, trail: 40, labels: ['SUN A', 'SUN B', 'PLANET'],
      formula: 'm = 1, 1, 10⁻³\na(binary) = 1,  r(planet) = 3.2',
      text: '2 つの太陽のまわりを回る惑星。連星の間隔のおよそ 2〜3 倍より外側なら、惑星の軌道は安定する。ケプラー 16b など、実在の周連星惑星もこの境界のすぐ外側で見つかっている。',
    },
    {
      id: 'trojan', group: 'system', name: 'TROJAN', sub: 'L4 TADPOLE', rotating: [0, 1],
      make: () => coorbital(1e-3, 100, 0), view: 1.4, speed: 12, trail: 90, labels: ['SUN', 'JUPITER', 'TROJAN'],
      formula: 'm = 1, 10⁻³, 10⁻⁹\n惑星の 100° 前方、同じ半径・同じ角速度',
      text: '恒星・惑星と正三角形をつくる点(L4)は惑星の 60° 前方にある。その少し先に置いた小天体は、L4 のまわりをおたまじゃくし形にゆっくり往復し続ける。木星のこの場所には、トロヤ群と呼ばれる小惑星が 1 万個以上見つかっている。ROTATING FRAME を切ると、ただの円軌道にしか見えない。',
    },
    {
      id: 'horseshoe', group: 'system', name: 'HORSESHOE', sub: 'CO-ORBITAL', rotating: [0, 1],
      make: () => coorbital(1e-3, 180, 0), view: 1.4, speed: 40, trail: 400, labels: ['SUN', 'PLANET', 'CO-ORBITAL'],
      formula: 'm = 1, 10⁻³, 10⁻⁹\n惑星の反対側、同じ半径・同じ角速度',
      text: '惑星と同じ軌道を回る小天体。惑星に後ろから近づくと外側の軌道へ押し出されて遅れはじめ、1 周遅れで前から近づくと内側へ入ってまた追いかける。惑星と一緒に回る座標で見ると、軌跡が馬蹄形になる。土星の衛星ヤヌスとエピメテウスは、約 4 年ごとにこのやり方で軌道を入れ替えている。',
    },
    {
      id: 'slingshot', group: 'system', name: 'SLINGSHOT', sub: 'GRAVITY ASSIST',
      make: () => slingshot(1e-3, 0.5, 1.15, 63), view: 2, speed: 0.8, trail: 30, eta: 0.002, labels: ['SUN', 'JUPITER', 'PROBE'],
      formula: 'm = 1, 10⁻³, 10⁻⁹\n探査機: 近日点 0.5・遠日点 1.15 の楕円',
      text: '探査機が t ≈ 1.3 で惑星のすぐ後ろをかすめ、惑星の公転の勢いをもらって加速する。軌道の長半径は 0.8 から 6 へ伸び、惑星の軌道の 10 倍の遠さまで届くようになる。燃料を使わずに速度を得るスイングバイで、ボイジャーの木星通過や、はやぶさの地球スイングバイと同じ原理。',
    },
    solarScenario('inner', 'INNER PLANETS', 'SUN TO JUPITER', ['MERCURY', 'VENUS', 'EARTH', 'MARS', 'JUPITER'], {
      view: 5.6, speed: 1.5, trail: 2 * Math.PI * 1.1, period: 2 * Math.PI, rotatingPair: [0, 3],
      text: '太陽から木星までの実際の太陽系。単位は天文単位と太陽質量で、1 年が 2π、ORBIT は地球の公転数。ズームすると水星や金星が分かれて見える。ROTATING FRAME をオンにすると地球と一緒に回る視点になり、火星が時々逆戻りする「逆行」や、金星が太陽の手前を通る「内合」がそのまま見える。',
    }),
    solarScenario('outer', 'OUTER PLANETS', 'JUPITER TO NEPTUNE', ['JUPITER', 'SATURN', 'URANUS', 'NEPTUNE'], {
      view: 32, speed: 12, trail: 2 * Math.PI * 170, period: 2 * Math.PI * 11.86,
      text: '木星から海王星までの実際の太陽系。海王星が 1 周するあいだに木星は 14 周する。ORBIT は木星の公転数。惑星どうしの引力も計算しているので、長く回すと互いの軌道が少しずつ揺らぐ。',
    }),
    {
      id: 'exchange', group: 'chaos', name: 'EXCHANGE', sub: 'BINARY + VISITOR',
      make: () => flyby(1, 0.5, 45), view: 3, speed: 2, trail: 20, eta: 0.002, labels: ['BINARY A', 'BINARY B', 'VISITOR'],
      formula: 'm = 1, 1, 1   連星の間隔 1\n来訪者: 速さ 0.5、衝突径数 1',
      text: '回り合う連星に、遠くから 3 つ目の星が飛び込む。もつれ合ったあと、来訪者が連星の片方と入れ替わり、元の相方が弾き出される。星が密集した球状星団の中で実際に起きている交換反応。',
    },
    {
      id: 'random', key: '0', group: 'chaos', name: 'RANDOM', sub: 'CHAOS',
      make: randomBodies, view: 2.2, speed: 2, trail: 14, random: true,
      formula: 'm ∈ [0.4, 2.0]   E < 0\nΣ m r = 0,  Σ m v = 0',
      text: 'ランダムな質量と初速の 3 体。ほとんどの初期条件はカオスで、たいてい最後は 1 つが弾き出されて連星が残る。もう一度選ぶと別の宇宙が始まる。',
    },
  ];

  function createSystem(scenario, seed) {
    return new System(scenario.make(seed));
  }

  return {
    System, METHODS, GROUPS, SCENARIOS, PLANETS, advance, energy, momentum, separation, freeFallTime,
    recenter, suvakov, randomBodies, solarSystem, createSystem,
  };
});
