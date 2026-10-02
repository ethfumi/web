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
    const dtMin = o.dtMin ?? 1e-9;
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

  const SCENARIOS = [
    {
      id: 'figure8', key: '1', name: 'FIGURE-8', sub: 'MOORE 1993',
      make: figureEight, period: 6.32591398, view: 1.5, speed: 1.2, trail: 6.4,
      formula: 'r₁ = −r₂ = (0.97000436, −0.24308753),  r₃ = 0\nv₃ = (−0.93240737, −0.86473146),  v₁ = v₂ = −v₃/2',
      text: '等しい質量の 3 つの星が、1 本の 8 の字を等間隔で追いかけ合う軌道。1993 年に Cristopher Moore が数値計算で見つけ、2000 年に Chenciner と Montgomery が存在を証明した。少し揺らしても形を保つ、数少ない安定な周期解。',
    },
    {
      id: 'butterfly1', key: '2', name: 'BUTTERFLY I', sub: 'ŠUVAKOV–DMITRAŠINOVIĆ 2013',
      make: () => suvakov(0.30689, 0.12551), period: 6.2356, view: 1.5, speed: 1.2, trail: 6.3,
      formula: 'r = (−1,0) (1,0) (0,0)\nv₁ = v₂ = (0.30689, 0.12551),  v₃ = −2v₁',
      text: '2013 年にベオグラードの Šuvakov と Dmitrašinović が計算機で探し当てた 13 種の周期解のひとつ。蝶の羽のような形を描く。不安定なので、初期値の丸め誤差が育って数周でほどけていく。',
    },
    {
      id: 'moth1', key: '3', name: 'MOTH I', sub: 'ŠUVAKOV–DMITRAŠINOVIĆ 2013',
      make: () => suvakov(0.46444, 0.39606), period: 14.8939, view: 1.6, speed: 2, trail: 15,
      formula: 'r = (−1,0) (1,0) (0,0)\nv₁ = v₂ = (0.46444, 0.39606),  v₃ = −2v₁',
      text: '同じ 2013 年の発見から、蛾の名がついた解。3 つの星が翅を広げたような輪郭を繰り返しなぞる。',
    },
    {
      id: 'yinyang1', key: '4', name: 'YIN-YANG I', sub: 'ŠUVAKOV–DMITRAŠINOVIĆ 2013',
      make: () => suvakov(0.51394, 0.30474), period: 17.3284, view: 1.7, speed: 2.4, trail: 17.5,
      formula: 'r = (−1,0) (1,0) (0,0)\nv₁ = v₂ = (0.51394, 0.30474),  v₃ = −2v₁',
      text: '陰陽の勾玉が絡み合うような軌道。同じ形を時間の向きだけ変えてたどる、対になる解を持つ。',
    },
    {
      id: 'yarn', key: '5', name: 'YARN', sub: 'ŠUVAKOV–DMITRAŠINOVIĆ 2013',
      make: () => suvakov(0.55906, 0.34919), period: 55.5018, view: 1.8, speed: 5, trail: 56,
      formula: 'r = (−1,0) (1,0) (0,0)\nv₁ = v₂ = (0.55906, 0.34919),  v₃ = −2v₁',
      text: '毛糸玉。1 周期が長く、軌跡が幾重にも巻きついて玉になる。巻き終わると、また同じ糸の上を走りはじめる。',
    },
    {
      id: 'lagrange', key: '6', name: 'LAGRANGE', sub: 'EQUILATERAL 1772',
      make: lagrange, period: 2 * Math.PI / Math.sqrt(3 / Math.pow(Math.sqrt(3), 3)), view: 1.5, speed: 4, trail: 9,
      formula: '|rᵢ| = 1,  θ = 90° 210° 330°\nω² = M / a³,  a = √3',
      text: '1772 年にラグランジュが見つけた、正三角形のまま回り続ける解。質量が等しいと不安定で、計算機の丸め誤差(10⁻¹⁶ 程度)だけを種に、しばらく回ったあと突然崩れてカオスになる。太陽・木星・トロヤ群のように質量比が極端なら安定になる。',
    },
    {
      id: 'burrau', key: '7', name: 'PYTHAGOREAN', sub: 'BURRAU 1913',
      // 接近遭遇が深く、刻みが粗いと弾き出しの時刻がずれる。
      make: burrau, view: 4.5, speed: 3, trail: 12, eta: 0.002,
      formula: 'm = 3, 4, 5   v = 0\nr = (1,3) (−2,−1) (1,−1)',
      text: '辺が 3:4:5 の直角三角形の頂点に、向かいの辺と同じ質量の星を静止させて放す。1913 年に Burrau が出した問題で、1967 年に Szebehely と Peters が計算機で最後まで解いた。何度もすれ違ったあと、t ≈ 60 で 2 つが連星になり、残る 1 つが弾き出される。',
    },
    {
      id: 'moon', key: '8', name: 'STAR·PLANET·MOON', sub: 'HIERARCHY',
      make: starPlanetMoon, view: 1.35, speed: 1.2, trail: 5,
      formula: 'm = 1, 10⁻², 10⁻⁵\nr(planet) = 1,  r(moon) = 0.05',
      text: '恒星・惑星・月。質量と距離に大きな段差がある「階層的」な三体は、2 つの二体問題にほぼ分かれて安定に回る。月の軌道は、惑星の重力が勝つ範囲(ヒル球)の内側にある。',
    },
    {
      id: 'binary', key: '9', name: 'CIRCUMBINARY', sub: 'PLANET OF TWO SUNS',
      make: circumbinary, view: 3.8, speed: 4, trail: 40,
      formula: 'm = 1, 1, 10⁻³\na(binary) = 1,  r(planet) = 3.2',
      text: '2 つの太陽のまわりを回る惑星。連星の間隔のおよそ 2〜3 倍より外側なら、惑星の軌道は安定する。ケプラー 16b など、実在の周連星惑星もこの境界のすぐ外側で見つかっている。',
    },
    {
      id: 'random', key: '0', name: 'RANDOM', sub: 'CHAOS',
      make: randomBodies, view: 2.2, speed: 2, trail: 14, random: true,
      formula: 'm ∈ [0.4, 2.0]   E < 0\nΣ m r = 0,  Σ m v = 0',
      text: 'ランダムな質量と初速の 3 体。ほとんどの初期条件はカオスで、たいてい最後は 1 つが弾き出されて連星が残る。もう一度選ぶと別の宇宙が始まる。',
    },
  ];

  function createSystem(scenario, seed) {
    return new System(scenario.make(seed));
  }

  return {
    System, METHODS, SCENARIOS, advance, energy, momentum, separation, freeFallTime,
    recenter, suvakov, randomBodies, createSystem,
  };
});
