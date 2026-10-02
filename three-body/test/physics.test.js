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

for (const id of ['butterfly1', 'moth1', 'yinyang1', 'yarn']) {
  test(`${id} は 1 周期でほぼ出発点へ戻る`, () => {
    const r = returnError(scenario(id));
    assert.ok(r.dist < 0.05, `dist=${r.dist}`);
    assert.ok(r.dE < 1e-6, `dE=${r.dE}`);
  });
}

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
