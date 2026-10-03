// node --test three-body/test
const test = require('node:test');
const assert = require('node:assert/strict');
const TB = require('../physics.js');

const scenario = (id) => TB.SCENARIOS.find((s) => s.id === id);

function returnError(sc, method = 'forestRuth') {
  const s = TB.createSystem(sc);
  const start = s.clone();
  const e0 = TB.energy(s);
  TB.advance(s, sc.period, method);
  return { dist: TB.separation(s, start), dE: Math.abs((TB.energy(s) - e0) / e0) };
}

test('8 の字は 1 周期で出発点へ戻り、エネルギーを保つ', () => {
  const r = returnError(scenario('figure8'));
  assert.ok(r.dist < 1e-4, `dist=${r.dist}`);
  assert.ok(r.dE < 1e-9, `dE=${r.dE}`);
});

for (const sc of TB.SCENARIOS.filter((s) => s.sub.startsWith('ŠUVAKOV'))) {
  test(`${sc.id} は 1 周期でほぼ出発点へ戻る`, () => {
    const r = returnError(sc);
    assert.ok(r.dist < 0.01, `dist=${r.dist}`);
    assert.ok(r.dE < 1e-5, `dE=${r.dE}`);
  });
}

test('オイラーの直線解は 1 周のあいだ一直線を保ち、2 周目で崩れる', () => {
  const sc = scenario('euler');
  const s = TB.createSystem(sc);
  // 3 体が一直線で対称なら、中央の星は両端の中点にいる
  const bend = () => Math.hypot(s.p[2] - (s.p[0] + s.p[4]) / 2, s.p[3] - (s.p[1] + s.p[5]) / 2);
  TB.advance(s, sc.period, 'forestRuth');
  assert.ok(bend() < 1e-3, `bend=${bend()}`);
  TB.advance(s, 2 * sc.period, 'forestRuth');
  assert.ok(bend() > 0.5, `bend=${bend()}`);
});

// 恒星→惑星の向きを基準にした、小天体の角度(度)
function coorbitalAngle(s) {
  const planet = Math.atan2(s.p[3] - s.p[1], s.p[2] - s.p[0]);
  const body = Math.atan2(s.p[5] - s.p[1], s.p[4] - s.p[0]);
  return ((((body - planet) * 180) / Math.PI) % 360 + 360) % 360;
}

test('トロヤ群の小天体は惑星の前方にとどまって往復する', () => {
  const s = TB.createSystem(scenario('trojan'));
  let lo = 360, hi = 0;
  for (let t = 1; t <= 300; t++) {
    TB.advance(s, t, 'forestRuth');
    const a = coorbitalAngle(s);
    lo = Math.min(lo, a);
    hi = Math.max(hi, a);
  }
  assert.ok(lo > 30 && lo < 40, `lo=${lo}`);
  assert.ok(hi > 99 && hi < 102, `hi=${hi}`);
});

test('馬蹄形軌道の小天体は惑星の両側まで回り込み、惑星を追い越さない', () => {
  const s = TB.createSystem(scenario('horseshoe'));
  let lo = 360, hi = 0;
  for (let t = 1; t <= 1000; t++) {
    TB.advance(s, t, 'forestRuth');
    const a = coorbitalAngle(s);
    lo = Math.min(lo, a);
    hi = Math.max(hi, a);
  }
  assert.ok(lo > 15 && lo < 40, `lo=${lo}`);
  assert.ok(hi > 320 && hi < 345, `hi=${hi}`);
});

test('スイングバイで探査機の軌道が大きくなる', () => {
  const sc = scenario('slingshot');
  const s = TB.createSystem(sc);
  // 恒星に対する探査機の軌道長半径
  const semiMajor = () => {
    const r = Math.hypot(s.p[4] - s.p[0], s.p[5] - s.p[1]);
    const v2 = (s.v[4] - s.v[0]) ** 2 + (s.v[5] - s.v[1]) ** 2;
    return 1 / (2 / r - v2);
  };
  const before = semiMajor();
  let closest = Infinity, when = 0;
  TB.advance(s, 3, 'forestRuth', {
    eta: sc.eta,
    onStep: (q) => {
      const d = Math.hypot(q.p[4] - q.p[2], q.p[5] - q.p[3]);
      if (d < closest) {
        closest = d;
        when = q.t;
      }
    },
  });
  assert.ok(Math.abs(before - 0.825) < 1e-3, `before=${before}`);
  assert.ok(when > 1.2 && when < 1.4, `when=${when}`);
  assert.ok(closest < 0.01, `closest=${closest}`);
  assert.ok(semiMajor() > 5 && semiMajor() < 7, `after=${semiMajor()}`);
});

test('太陽系では地球が 2π で 1 周し、木星は 11.86 年で 1 周する', () => {
  const angle = (s, i) => Math.atan2(s.p[2 * i + 1] - s.p[1], s.p[2 * i] - s.p[0]);
  const turned = (s, i, before) => ((((angle(s, i) - before) * 180) / Math.PI + 540) % 360) - 180;
  const inner = TB.createSystem(scenario('inner'));
  assert.equal(inner.n, 6);
  const earth0 = angle(inner, 3);
  TB.advance(inner, 2 * Math.PI, 'forestRuth');
  assert.ok(Math.abs(turned(inner, 3, earth0)) < 0.5, `earth=${turned(inner, 3, earth0)}`);
  const outer = TB.createSystem(scenario('outer'));
  const jupiter0 = angle(outer, 1);
  TB.advance(outer, 2 * Math.PI * 11.86, 'forestRuth');
  assert.ok(Math.abs(turned(outer, 1, jupiter0)) < 1, `jupiter=${turned(outer, 1, jupiter0)}`);
});

test('連星への来訪者が片方と入れ替わる', () => {
  const sc = scenario('exchange');
  const s = TB.createSystem(sc);
  TB.advance(s, 80, 'forestRuth', { eta: sc.eta });
  const d = (i, j) => Math.hypot(s.p[2 * i] - s.p[2 * j], s.p[2 * i + 1] - s.p[2 * j + 1]);
  // 元の連星は 0 と 1、来訪者は 2
  assert.ok(d(0, 1) > 15, `d01=${d(0, 1)}`);
  assert.ok(Math.min(d(0, 2), d(1, 2)) < 3, `d02=${d(0, 2)} d12=${d(1, 2)}`);
});

test('ラグランジュ解は 1 周しても正三角形のまま', () => {
  const sc = scenario('lagrange');
  const s = TB.createSystem(sc);
  TB.advance(s, sc.period, 'forestRuth');
  const d = (i, j) => Math.hypot(s.p[2 * i] - s.p[2 * j], s.p[2 * i + 1] - s.p[2 * j + 1]);
  for (const side of [d(0, 1), d(1, 2), d(2, 0)]) assert.ok(Math.abs(side - Math.sqrt(3)) < 1e-6, `side=${side}`);
});

test('ピタゴラス問題は接近遭遇を越えてもエネルギーを保つ', () => {
  const sc = scenario('burrau');
  const s = TB.createSystem(sc);
  const e0 = TB.energy(s);
  TB.advance(s, 70, 'forestRuth', { eta: sc.eta });
  assert.ok(s.p.every(Number.isFinite));
  const dE = Math.abs((TB.energy(s) - e0) / e0);
  assert.ok(dE < 1e-6, `dE=${dE}`);
  // t ≈ 60 の遭遇で 1 体が弾き出される
  const far = Math.max(...[0, 1, 2].map((i) => Math.hypot(s.p[2 * i], s.p[2 * i + 1])));
  assert.ok(far > 5, `far=${far}`);
});

test('全シナリオは重心静止で始まり、運動量が保たれる', () => {
  for (const sc of TB.SCENARIOS) {
    const s = TB.createSystem(sc, 12345);
    const [px0, py0] = TB.momentum(s);
    assert.ok(Math.hypot(px0, py0) < 1e-12, `${sc.id} p0=${px0},${py0}`);
    TB.advance(s, 3, 'forestRuth');
    const [px, py] = TB.momentum(s);
    assert.ok(Math.hypot(px, py) < 1e-10, `${sc.id} p=${px},${py}`);
  }
});

test('階層系は長く回しても壊れない', () => {
  for (const id of ['moon', 'binary']) {
    const s = TB.createSystem(scenario(id));
    TB.advance(s, 200, 'forestRuth');
    const far = Math.max(...[0, 1, 2].map((i) => Math.hypot(s.p[2 * i], s.p[2 * i + 1])));
    assert.ok(far < 4, `${id} far=${far}`);
  }
  const s = TB.createSystem(scenario('moon'));
  TB.advance(s, 200, 'forestRuth');
  const moon = Math.hypot(s.p[4] - s.p[2], s.p[5] - s.p[3]);
  assert.ok(moon < 0.1, `moon=${moon}`);
});

test('ランダムは seed で再現でき、束縛されている', () => {
  const a = TB.randomBodies(7);
  const b = TB.randomBodies(7);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, TB.randomBodies(8));
  for (let seed = 1; seed <= 50; seed++) assert.ok(TB.energy(new TB.System(TB.randomBodies(seed))) < 0);
});

test('次数の高いシンプレクティック法ほどエネルギーがずれない', () => {
  const drift = (method) => {
    const s = TB.createSystem(scenario('figure8'));
    const e0 = TB.energy(s);
    TB.advance(s, 20 * scenario('figure8').period, method);
    return Math.abs((TB.energy(s) - e0) / e0);
  };
  const fr = drift('forestRuth');
  assert.ok(drift('leapfrog') < drift('euler'));
  assert.ok(fr < drift('leapfrog'));
});

test('advance は目標時刻ちょうどで止まる', () => {
  const s = TB.createSystem(scenario('figure8'));
  TB.advance(s, 1.2345, 'forestRuth');
  assert.equal(s.t, 1.2345);
  const steps = TB.advance(s, 100, 'forestRuth', { maxSteps: 10 });
  assert.equal(steps, 10);
  assert.ok(s.t < 100);
});
