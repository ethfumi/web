(() => {
  'use strict';

  const TB = globalThis.ThreeBody;
  const $ = (id) => document.getElementById(id);
  const canvas = $('scene');
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) {
    $('error').hidden = false;
    return;
  }

  const COLORS = [[1.0, 0.74, 0.36], [0.38, 0.82, 1.0], [1.0, 0.45, 0.68]];
  const TRAIL_MAX = 8000;
  const GHOST_OFFSET = 1e-6;
  const MAX_STEPS_PER_FRAME = 20000;
  const METHOD_NOTES = {
    euler: '1 次。エネルギーが増え続けて軌道が膨らむ',
    rk4: '4 次。精度は高いが、誤差が一方向に溜まる',
    leapfrog: '2 次・シンプレクティック。誤差が溜まらず揺れるだけ',
    forestRuth: '4 次・シンプレクティック。リープフロッグ 3 回の合成',
  };

  const BG_VS = `#version 300 es
void main() {
  vec2 p = vec2(gl_VertexID == 1 ? 3. : -1., gl_VertexID == 2 ? 3. : -1.);
  gl_Position = vec4(p, 0., 1.);
}`;

  const BG_FS = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uPx, uDpr, uTime, uContour, uGhostOn;
uniform vec2 uPos[3], uGhost[3];
uniform float uMass[3], uRad[3];
uniform vec3 uCol[3];
out vec4 outColor;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * .1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

vec3 starfield(vec2 f) {
  vec3 c = vec3(0.);
  for (int l = 0; l < 3; l++) {
    float cell = 46. + 52. * float(l);
    vec2 g = f / cell + float(l) * 19.7;
    vec2 id = floor(g);
    float h = hash(id);
    if (h > .72) {
      vec2 o = .15 + .7 * vec2(hash(id + 11.3), hash(id + 47.9));
      float d = length((fract(g) - o) * cell);
      float b = (h - .72) / .28;
      float tw = .75 + .25 * sin(uTime * (.6 + 2. * hash(id + 3.)) + h * 60.);
      float size = .6 + .7 * b * float(l + 1);
      c += mix(vec3(.7, .8, 1.), vec3(1., .9, .75), hash(id + 5.)) * b * tw * smoothstep(size + 1., 0., d) * .8;
    }
  }
  return c;
}

void main() {
  vec2 f = gl_FragCoord.xy;
  vec2 uv = (f - .5 * uRes) / uRes.y;
  vec3 c = vec3(.010, .014, .026) + vec3(.010, .018, .032) * (1. - length(uv));
  c += starfield(f / uDpr);

  float phi = 0.;
  vec3 tint = vec3(0.);
  for (int i = 0; i < 3; i++) {
    float u = uMass[i] / max(length(f - uPos[i]), .5);
    phi += u;
    tint += uCol[i] * u;
  }
  tint /= phi;
  float lv = log2(phi / uPx) * 2.5;
  float fw = fwidth(lv);
  float line = (1. - smoothstep(0., 1.4 * fw, abs(fract(lv) - .5))) * smoothstep(.45, .12, fw);
  c += mix(vec3(.35, .6, .8), tint, .55) * line * .17 * uContour;

  for (int i = 0; i < 3; i++) {
    float d = length(f - uPos[i]);
    float R = uRad[i];
    float q = R / max(d, R);
    c += uCol[i] * (pow(q, 1.9) * .42 + pow(q, 1.1) * .05);
    c += mix(uCol[i], vec3(1.), .7) * smoothstep(R, R * .45, d) * 1.6;
  }
  if (uGhostOn > .5) {
    for (int i = 0; i < 3; i++) {
      float R = uRad[i] * 1.6 + 2. * uDpr;
      float ring = 1. - smoothstep(0., 1.2 * uDpr, abs(length(f - uGhost[i]) - R));
      c += vec3(.85, .9, 1.) * ring * .55;
    }
  }
  c = 1. - exp(-c * 1.25);
  c *= 1. - .28 * dot(uv, uv);
  outColor = vec4(c, 1.);
}`;

  const TRAIL_VS = `#version 300 es
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec3 aA;
layout(location = 2) in vec3 aB;
uniform vec2 uRes, uCenter, uOrigin;
uniform float uPx, uNow, uSpan, uWidth;
out float vAge;
out float vSide;
void main() {
  vec2 a = (aA.xy - uCenter) / uPx + uOrigin;
  vec2 b = (aB.xy - uCenter) / uPx + uOrigin;
  vec2 d = b - a;
  float len = length(d);
  vec2 dir = len > 1e-6 ? d / len : vec2(1., 0.);
  vec2 p = mix(a, b, aCorner.x) + vec2(-dir.y, dir.x) * aCorner.y * uWidth;
  vAge = clamp((uNow - mix(aA.z, aB.z, aCorner.x)) / uSpan, 0., 1.);
  vSide = aCorner.y;
  gl_Position = vec4(p / uRes * 2. - 1., 0., 1.);
}`;

  const TRAIL_FS = `#version 300 es
precision highp float;
uniform vec3 uColor;
in float vAge;
in float vSide;
out vec4 outColor;
void main() {
  float a = pow(1. - vAge, 1.5) * smoothstep(0., 1., 1. - abs(vSide));
  outColor = vec4(uColor * a * .9, 1.);
}`;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  function program(vs, fs) {
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    const uniforms = {};
    const count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
      const name = gl.getActiveUniform(prog, i).name.replace(/\[0\]$/, '');
      uniforms[name] = gl.getUniformLocation(prog, name);
    }
    return { prog, u: uniforms };
  }

  const bg = program(BG_VS, BG_FS);
  const trailProg = program(TRAIL_VS, TRAIL_FS);

  const bgVao = gl.createVertexArray();
  const trailVao = gl.createVertexArray();
  gl.bindVertexArray(trailVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 1, -1, 0, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const trailBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, trailBuffer);
  // 同じ点列を 1 点ずらして 2 回読み、隣り合う 2 点を 1 本の線分にする。
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 12, 0);
  gl.vertexAttribDivisor(1, 1);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 12, 12);
  gl.vertexAttribDivisor(2, 1);
  gl.bindVertexArray(null);

  class Trail {
    constructor() {
      this.buf = new Float32Array((2 * TRAIL_MAX + 1) * 3);
      this.start = 0;
      this.end = 0;
    }

    clear() {
      this.start = 0;
      this.end = 0;
    }

    push(x, y, t) {
      if (this.end === 2 * TRAIL_MAX) {
        this.buf.copyWithin(0, this.start * 3, this.end * 3);
        this.end -= this.start;
        this.start = 0;
      }
      const o = this.end * 3;
      this.buf[o] = x;
      this.buf[o + 1] = y;
      this.buf[o + 2] = t;
      this.end++;
      if (this.end - this.start > TRAIL_MAX) this.start++;
    }

    farFrom(x, y, ds) {
      if (this.end === this.start) return true;
      const o = (this.end - 1) * 3;
      const dx = x - this.buf[o];
      const dy = y - this.buf[o + 1];
      return dx * dx + dy * dy > ds * ds;
    }

    prune(tMin) {
      while (this.end - this.start > 2 && this.buf[(this.start + 1) * 3 + 2] < tMin) this.start++;
    }

    // 記録済みの点列の末尾に、いまの位置を仮に足して返す。
    withHead(x, y, t) {
      const o = this.end * 3;
      this.buf[o] = x;
      this.buf[o + 1] = y;
      this.buf[o + 2] = t;
      return this.buf.subarray(this.start * 3, o + 3);
    }
  }

  const trails = [new Trail(), new Trail(), new Trail()];
  const panel = $('panel');
  const state = {
    index: 0,
    seed: 1,
    sc: TB.SCENARIOS[0],
    sys: null,
    ghost: null,
    e0: 0,
    method: 'forestRuth',
    playing: true,
    speedMul: 1,
    trailMul: 1,
    contour: true,
    ghostOn: false,
    ghostDelta: GHOST_OFFSET,
    autoCam: true,
    cam: { x: 0, y: 0, px: 0.01 },
    diverged: false,
  };

  function dpr() {
    return Math.min(window.devicePixelRatio || 1, 2);
  }

  // パネルが開いているあいだは、残りの領域の中心に星を置く。広い画面では右、狭い画面では下にパネルが出る。
  function viewport() {
    const W = canvas.width;
    const H = canvas.height;
    let w = W;
    let bottom = 0;
    if (panel.classList.contains('open')) {
      if (window.innerWidth > 900) w = W - panel.offsetWidth * dpr();
      else bottom = panel.offsetHeight * dpr();
    }
    return { W, H, ox: w / 2, oy: bottom + (H - bottom) / 2, min: Math.max(Math.min(w, H - bottom), 1) };
  }

  // 次のフレームで、自動カメラを追従の途中を飛ばして目標へ合わせる。
  let snapCamera = true;
  let camFollow = '';
  const camOffset = { x: 0, y: 0 };

  function resize() {
    const w = Math.round(canvas.clientWidth * dpr());
    const h = Math.round(canvas.clientHeight * dpr());
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      snapCamera = true;
    }
  }

  function fitPx(half) {
    return (2.3 * half) / viewport().min;
  }

  function makeGhost() {
    state.ghost = state.sys.clone();
    state.ghost.p[0] += GHOST_OFFSET;
    state.ghostDelta = GHOST_OFFSET;
  }

  function load(index, opts) {
    const o = opts || {};
    const sc = TB.SCENARIOS[(index + TB.SCENARIOS.length) % TB.SCENARIOS.length];
    if (sc.random && (o.reseed || sc !== state.sc || !state.sys)) state.seed = Math.floor(Math.random() * 1e9);
    state.index = TB.SCENARIOS.indexOf(sc);
    state.sc = sc;
    state.sys = TB.createSystem(sc, state.seed);
    state.e0 = TB.energy(state.sys);
    state.diverged = false;
    makeGhost();
    trails.forEach((t) => t.clear());
    state.cam = { x: 0, y: 0, px: 1 };
    snapCamera = true;
    setAutoCam(true);
    renderScenarioInfo();
  }

  function recordTrail(s) {
    const ds = Math.max(state.cam.px * 1.5 * dpr(), state.sc.view * 3e-4);
    for (let i = 0; i < 3; i++) {
      const x = s.p[2 * i];
      const y = s.p[2 * i + 1];
      if (trails[i].farFrom(x, y, ds)) trails[i].push(x, y, s.t);
    }
  }

  function trailSpan() {
    return state.sc.trail * state.trailMul;
  }

  function step(dtReal) {
    if (!state.playing || state.diverged) return;
    const { sys, sc } = state;
    const target = sys.t + dtReal * sc.speed * state.speedMul;
    TB.advance(sys, target, state.method, { eta: sc.eta, maxSteps: MAX_STEPS_PER_FRAME, onStep: recordTrail });
    if (!sys.p.every(Number.isFinite)) {
      state.diverged = true;
      return;
    }
    if (state.ghostOn) {
      TB.advance(state.ghost, sys.t, state.method, { eta: sc.eta, maxSteps: 2 * MAX_STEPS_PER_FRAME });
      if (state.ghost.t === sys.t) state.ghostDelta = TB.separation(sys, state.ghost);
    }
    const tMin = sys.t - trailSpan();
    trails.forEach((t) => t.prune(tMin));
  }

  function updateCamera(dtReal) {
    if (!state.autoCam) return;
    const { sys, sc, cam } = state;
    const limit = sc.view * 6;
    // 遠くへ弾き出された星が出たら、残った連星(いちばん近い 2 つ)だけを追う。
    let follow = [0, 1, 2];
    if (follow.some((i) => Math.hypot(sys.p[2 * i], sys.p[2 * i + 1]) > limit)) {
      let best = Infinity;
      for (const [i, j] of [[0, 1], [1, 2], [2, 0]]) {
        const d = Math.hypot(sys.p[2 * i] - sys.p[2 * j], sys.p[2 * i + 1] - sys.p[2 * j + 1]);
        if (d < best) {
          best = d;
          follow = [i, j];
        }
      }
    }
    // 中心は追う星の重心。星そのものと違って滑らかに動くので、画面が揺れない。
    let M = 0, tx = 0, ty = 0;
    for (const i of follow) {
      M += sys.m[i];
      tx += sys.m[i] * sys.p[2 * i];
      ty += sys.m[i] * sys.p[2 * i + 1];
    }
    tx /= M;
    ty /= M;
    let reach = 0;
    for (const i of follow) {
      reach = Math.max(reach, Math.abs(sys.p[2 * i] - tx), Math.abs(sys.p[2 * i + 1] - ty));
    }
    const half = Math.max(follow.length === 3 ? sc.view : sc.view * 0.5, 1.15 * reach);
    const target = fitPx(half);
    const snap = snapCamera;
    snapCamera = false;
    cam.px += (target - cam.px) * (snap ? 1 : 1 - Math.exp(-dtReal * (target > cam.px ? 2.5 : 0.6)));
    // 重心には遅れずについていき、追う相手が替わったときの位置の差だけを滑らかに詰める。
    // 差ごと追いかける方式だと、早送り中に連星の速さへ追いつけず画面から外れる。
    const key = follow.join('');
    if (key !== camFollow) {
      camFollow = key;
      camOffset.x = cam.x - tx;
      camOffset.y = cam.y - ty;
    }
    const keep = snap ? 0 : Math.exp(-dtReal * 2.5);
    camOffset.x *= keep;
    camOffset.y *= keep;
    cam.x = tx + camOffset.x;
    cam.y = ty + camOffset.y;
  }

  const posPx = new Float32Array(6);
  const ghostPx = new Float32Array(6);
  const massArr = new Float32Array(3);
  const radArr = new Float32Array(3);
  const colArr = new Float32Array(COLORS.flat());

  function render(now) {
    const { sys, ghost, cam } = state;
    const vp = viewport();
    const scale = dpr();
    let mMax = 0;
    for (let i = 0; i < 3; i++) mMax = Math.max(mMax, sys.m[i]);
    for (let i = 0; i < 3; i++) {
      posPx[2 * i] = vp.ox + (sys.p[2 * i] - cam.x) / cam.px;
      posPx[2 * i + 1] = vp.oy + (sys.p[2 * i + 1] - cam.y) / cam.px;
      ghostPx[2 * i] = vp.ox + (ghost.p[2 * i] - cam.x) / cam.px;
      ghostPx[2 * i + 1] = vp.oy + (ghost.p[2 * i + 1] - cam.y) / cam.px;
      massArr[i] = sys.m[i];
      radArr[i] = scale * (3 + 5 * Math.cbrt(sys.m[i] / mMax));
    }

    gl.viewport(0, 0, vp.W, vp.H);
    gl.disable(gl.BLEND);
    gl.useProgram(bg.prog);
    gl.bindVertexArray(bgVao);
    gl.uniform2f(bg.u.uRes, vp.W, vp.H);
    gl.uniform1f(bg.u.uPx, cam.px);
    gl.uniform1f(bg.u.uDpr, scale);
    gl.uniform1f(bg.u.uTime, now / 1000);
    gl.uniform1f(bg.u.uContour, state.contour ? 1 : 0);
    gl.uniform1f(bg.u.uGhostOn, state.ghostOn ? 1 : 0);
    gl.uniform2fv(bg.u.uPos, posPx);
    gl.uniform2fv(bg.u.uGhost, ghostPx);
    gl.uniform1fv(bg.u.uMass, massArr);
    gl.uniform1fv(bg.u.uRad, radArr);
    gl.uniform3fv(bg.u.uCol, colArr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 加算だと線分の継ぎ目の重なりが点々に光るので、明るいほうを残す。
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.MAX);
    gl.useProgram(trailProg.prog);
    gl.bindVertexArray(trailVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, trailBuffer);
    gl.uniform2f(trailProg.u.uRes, vp.W, vp.H);
    gl.uniform2f(trailProg.u.uCenter, cam.x, cam.y);
    gl.uniform2f(trailProg.u.uOrigin, vp.ox, vp.oy);
    gl.uniform1f(trailProg.u.uPx, cam.px);
    gl.uniform1f(trailProg.u.uNow, sys.t);
    gl.uniform1f(trailProg.u.uSpan, trailSpan());
    gl.uniform1f(trailProg.u.uWidth, 2 * scale);
    for (let i = 0; i < 3; i++) {
      const points = trails[i].withHead(sys.p[2 * i], sys.p[2 * i + 1], sys.t);
      const segments = points.length / 3 - 1;
      if (segments < 1) continue;
      gl.bufferData(gl.ARRAY_BUFFER, points, gl.DYNAMIC_DRAW);
      gl.uniform3fv(trailProg.u.uColor, COLORS[i]);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, segments);
    }
    gl.bindVertexArray(null);
  }

  // ---- UI ----

  function cssColor(c) {
    return `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;
  }

  function formatMass(m) {
    return m >= 0.1 ? m.toFixed(2) : m.toExponential(0).replace('e-', '·10⁻').replace(/\d$/, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);
  }

  function renderScenarioInfo() {
    const { sc, sys } = state;
    $('title').textContent = sc.name;
    $('subtitle').textContent = '/ ' + (sc.random ? `SEED ${state.seed}` : sc.sub);
    $('theoryTitle').textContent = sc.name;
    $('formula').textContent = sc.formula;
    $('theoryText').textContent = sc.text;
    $('massList').innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const li = document.createElement('li');
      li.innerHTML = `<i style="--c:${cssColor(COLORS[i])}"></i>m = ${formatMass(sys.m[i])}`;
      $('massList').append(li);
    }
    $('orbitRead').hidden = !sc.period;
    document.querySelectorAll('#scenarioGrid button').forEach((b, i) => b.classList.toggle('active', i === state.index));
  }

  function setToggle(id, on) {
    const el = $(id);
    el.classList.toggle('active', on);
    el.textContent = on ? 'ON' : 'OFF';
  }

  function setAutoCam(on) {
    state.autoCam = on;
    camFollow = '';
    setToggle('cameraToggle', on);
  }

  function setGhost(on) {
    state.ghostOn = on;
    if (on) makeGhost();
    setToggle('ghostToggle', on);
    $('ghostRead').hidden = !on;
  }

  function setPlaying(on) {
    state.playing = on;
    $('motion').textContent = on ? 'Ⅱ' : '▶';
    $('motion').setAttribute('aria-label', on ? '一時停止' : '再生');
  }

  function setMethod(method) {
    state.method = method;
    $('methodNote').textContent = METHOD_NOTES[method];
    document.querySelectorAll('#methods button').forEach((b) => b.classList.toggle('active', b.dataset.method === method));
  }

  function setPanel(open) {
    panel.classList.toggle('open', open);
    snapCamera = true;
  }

  TB.SCENARIOS.forEach((sc, i) => {
    const b = document.createElement('button');
    b.innerHTML = `<b>${sc.name}</b><small>${sc.sub}</small><i>${sc.key}</i>`;
    b.addEventListener('click', () => load(i, { reseed: true }));
    $('scenarioGrid').append(b);
  });

  Object.entries(TB.METHODS).forEach(([key, m]) => {
    const b = document.createElement('button');
    b.dataset.method = key;
    b.textContent = m.label;
    b.addEventListener('click', () => setMethod(key));
    $('methods').append(b);
  });

  $('motion').addEventListener('click', () => setPlaying(!state.playing));
  $('reset').addEventListener('click', () => load(state.index));
  $('openPanel').addEventListener('click', () => setPanel(!panel.classList.contains('open')));
  $('closePanel').addEventListener('click', () => setPanel(false));
  $('ghostToggle').addEventListener('click', () => setGhost(!state.ghostOn));
  $('cameraToggle').addEventListener('click', () => setAutoCam(!state.autoCam));
  $('contourToggle').addEventListener('click', () => {
    state.contour = !state.contour;
    setToggle('contourToggle', state.contour);
  });
  $('speed').addEventListener('input', (e) => {
    state.speedMul = Math.pow(10, Number(e.target.value));
    $('speedValue').textContent = '×' + state.speedMul.toFixed(state.speedMul < 1 ? 2 : 1);
  });
  $('trail').addEventListener('input', (e) => {
    state.trailMul = Math.pow(10, Number(e.target.value));
    $('trailValue').textContent = '×' + state.trailMul.toFixed(state.trailMul < 1 ? 2 : 1);
  });

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const digit = /^Digit(\d)$/.exec(e.code);
    if (digit) {
      const i = TB.SCENARIOS.findIndex((sc) => sc.key === digit[1]);
      if (i >= 0) load(i, { reseed: true });
    } else if (e.code === 'Space') {
      e.preventDefault();
      setPlaying(!state.playing);
    } else if (e.code === 'KeyN') load(state.index + 1);
    else if (e.code === 'KeyB') load(state.index - 1);
    else if (e.code === 'KeyR') load(state.index);
    else if (e.code === 'KeyG') setGhost(!state.ghostOn);
  });

  // ---- カメラ操作 ----

  const pointers = new Map();
  let pinch = 0;

  function zoomAt(clientX, clientY, factor) {
    const { cam } = state;
    const vp = viewport();
    const rect = canvas.getBoundingClientRect();
    const fx = (clientX - rect.left) * dpr() - vp.ox;
    const fy = (rect.bottom - clientY) * dpr() - vp.oy;
    const next = Math.min(Math.max(cam.px * factor, 1e-9), 1e3);
    cam.x += fx * (cam.px - next);
    cam.y += fy * (cam.px - next);
    cam.px = next;
  }

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.classList.add('dragging');
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const { cam } = state;
    if (pointers.size === 1) {
      cam.x -= (e.clientX - prev.x) * dpr() * cam.px;
      cam.y += (e.clientY - prev.y) * dpr() * cam.px;
      setAutoCam(false);
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 0 && dist > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch / dist);
      pinch = dist;
      setAutoCam(false);
    }
  });

  const release = (e) => {
    pointers.delete(e.pointerId);
    pinch = 0;
    if (!pointers.size) canvas.classList.remove('dragging');
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, Math.exp(e.deltaY * 0.0015));
    setAutoCam(false);
  }, { passive: false });

  // ---- 計器 ----

  function formatEnergy(rel) {
    const ppm = rel * 1e6;
    const abs = Math.abs(ppm);
    const sign = ppm < 0 ? '−' : '+';
    if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(abs >= 1e6 ? 0 : 2)} %`;
    return `${sign}${abs.toFixed(abs >= 100 ? 0 : 3)} ppm`;
  }

  let fpsFrames = 0;
  let fpsSince = performance.now();

  function updateReadout(now) {
    const { sys, sc } = state;
    $('timeOut').textContent = sys.t.toFixed(2);
    if (sc.period) $('orbitOut').textContent = (sys.t / sc.period).toFixed(2);
    const rel = (TB.energy(sys) - state.e0) / Math.abs(state.e0);
    const energyOut = $('energyOut');
    energyOut.textContent = state.diverged ? 'DIVERGED' : formatEnergy(rel);
    energyOut.classList.toggle('warn', state.diverged || Math.abs(rel) > 1e-3);
    if (state.ghostOn) {
      $('ghostOut').textContent = state.ghostDelta.toExponential(1);
      $('ghostOut').classList.toggle('warn', state.ghostDelta > 0.1);
    }
    $('fps').textContent = `${Math.round((fpsFrames * 1000) / (now - fpsSince))} FPS`;
    fpsFrames = 0;
    fpsSince = now;
  }

  let last = performance.now();
  let lastReadout = 0;

  function frame(now) {
    const dtReal = Math.min((now - last) / 1000, 0.05);
    last = now;
    resize();
    // 軌跡の点の間隔は画面上の縮尺で決めるので、カメラを先に合わせる。
    updateCamera(dtReal);
    step(dtReal);
    render(now);
    fpsFrames++;
    if (now - lastReadout > 200) {
      updateReadout(now);
      lastReadout = now;
    }
    requestAnimationFrame(frame);
  }

  setPanel(window.innerWidth > 900);
  setMethod(state.method);
  load(0);
  requestAnimationFrame(frame);
})();
