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
  const overlay = $('overlay');
  const ctx = overlay.getContext('2d');
  // 編集モードの速度の矢印は、速さ 1 をこの長さ(ワールド座標)で描く。
  const VEL_SCALE = 0.6;
  const GRAPH_POINTS = 600;

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
    ghostMode: 'off',
    ghostMethod: 'euler',
    ghostDelta: 0,
    ghostHistory: [],
    ghostEvery: 0,
    ghostNext: 0,
    autoCam: true,
    cam: { x: 0, y: 0, px: 1 },
    diverged: false,
    rotating: false,
    framePair: [0, 1],
    frameZero: 0,
    edit: false,
    custom: false,
    drag: null,
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
      overlay.width = w;
      overlay.height = h;
      snapCamera = true;
    }
  }

  function fitPx(half) {
    return (2.3 * half) / viewport().min;
  }

  // ---- 座標系 ----
  // 回転座標系では、基準の 2 体を結ぶ線が動かないように全体を回して表示する。
  // 物理は慣性系のままで、回すのは表示と軌跡の記録だけ。

  function pairAngle(s) {
    const [i, j] = state.framePair;
    return Math.atan2(s.p[2 * j + 1] - s.p[2 * i + 1], s.p[2 * j] - s.p[2 * i]);
  }

  function heaviestPair(s) {
    const order = [0, 1, 2].sort((a, b) => s.m[b] - s.m[a]);
    return [order[0], order[1]];
  }

  function frameAngle(s) {
    return state.rotating ? pairAngle(s) - state.frameZero : 0;
  }

  function toView(src, angle, out) {
    const c = Math.cos(angle);
    const sn = Math.sin(angle);
    for (let i = 0; i < 3; i++) {
      const x = src[2 * i];
      const y = src[2 * i + 1];
      out[2 * i] = c * x + sn * y;
      out[2 * i + 1] = c * y - sn * x;
    }
  }

  const viewPos = new Float64Array(6);
  const viewGhost = new Float64Array(6);
  const viewStep = new Float64Array(6);

  function updateView() {
    const angle = frameAngle(state.sys);
    toView(state.sys.p, angle, viewPos);
    toView(state.ghost.p, angle, viewGhost);
  }

  function clearTrails() {
    trails.forEach((t) => t.clear());
  }

  function setRotating(on) {
    state.rotating = on;
    // 切り替えた瞬間の向きを基準にするので、表示は飛ばない。
    state.frameZero = pairAngle(state.sys);
    clearTrails();
    setToggle('frameToggle', on);
  }

  // ---- 分身 ----

  function ghostActive() {
    return state.ghostMode !== 'off';
  }

  function makeGhost() {
    state.ghost = state.sys.clone();
    if (state.ghostMode === 'shift') state.ghost.p[0] += GHOST_OFFSET;
    state.ghostDelta = TB.separation(state.sys, state.ghost);
    state.ghostHistory = [];
    state.ghostEvery = state.sc.speed / 30;
    state.ghostNext = state.sys.t;
  }

  function stepGhost() {
    const { sys, ghost, sc } = state;
    const method = state.ghostMode === 'method' ? state.ghostMethod : state.method;
    TB.advance(ghost, sys.t, method, { eta: sc.eta, maxSteps: 2 * MAX_STEPS_PER_FRAME });
    if (ghost.t !== sys.t) return;
    state.ghostDelta = TB.separation(sys, ghost);
    if (sys.t < state.ghostNext || !Number.isFinite(state.ghostDelta)) return;
    state.ghostHistory.push([sys.t, state.ghostDelta]);
    state.ghostNext = sys.t + state.ghostEvery;
    if (state.ghostHistory.length > GRAPH_POINTS) {
      // 点が増えたら 1 つおきに間引き、記録の間隔を倍にする。
      state.ghostHistory = state.ghostHistory.filter((_, i) => i % 2 === 0);
      state.ghostEvery *= 2;
    }
  }

  // ---- 進行 ----

  function load(index, opts) {
    const o = opts || {};
    const sc = TB.SCENARIOS[(index + TB.SCENARIOS.length) % TB.SCENARIOS.length];
    if (sc.random && (o.reseed || sc !== state.sc || !state.sys)) state.seed = Math.floor(Math.random() * 1e9);
    state.index = TB.SCENARIOS.indexOf(sc);
    state.sc = sc;
    state.sys = TB.createSystem(sc, state.seed);
    state.e0 = TB.energy(state.sys);
    state.diverged = false;
    state.custom = false;
    state.framePair = sc.rotating || heaviestPair(state.sys);
    makeGhost();
    setRotating(Boolean(sc.rotating) && !state.edit);
    state.cam = { x: 0, y: 0, px: 1 };
    snapCamera = true;
    setAutoCam(true);
    renderScenarioInfo();
    syncMassSliders();
  }

  function recordTrail(s) {
    const ds = Math.max(state.cam.px * 1.5 * dpr(), state.sc.view * 3e-4);
    toView(s.p, frameAngle(s), viewStep);
    for (let i = 0; i < 3; i++) {
      const x = viewStep[2 * i];
      const y = viewStep[2 * i + 1];
      if (trails[i].farFrom(x, y, ds)) trails[i].push(x, y, s.t);
    }
  }

  function trailSpan() {
    return state.sc.trail * state.trailMul;
  }

  function step(dtReal) {
    if (!state.playing || state.diverged || state.drag) return;
    const { sys, sc } = state;
    const target = sys.t + dtReal * sc.speed * state.speedMul;
    TB.advance(sys, target, state.method, { eta: sc.eta, maxSteps: MAX_STEPS_PER_FRAME, onStep: recordTrail });
    if (!sys.p.every(Number.isFinite)) {
      state.diverged = true;
      return;
    }
    if (ghostActive()) stepGhost();
    const tMin = sys.t - trailSpan();
    trails.forEach((t) => t.prune(tMin));
  }

  function updateCamera(dtReal) {
    if (!state.autoCam || state.drag) return;
    const { sys, sc, cam } = state;
    const limit = sc.view * 6;
    // 遠くへ弾き出された星が出たら、残った連星(いちばん近い 2 つ)だけを追う。
    let follow = [0, 1, 2];
    if (follow.some((i) => Math.hypot(viewPos[2 * i], viewPos[2 * i + 1]) > limit)) {
      let best = Infinity;
      for (const [i, j] of [[0, 1], [1, 2], [2, 0]]) {
        const d = Math.hypot(viewPos[2 * i] - viewPos[2 * j], viewPos[2 * i + 1] - viewPos[2 * j + 1]);
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
      tx += sys.m[i] * viewPos[2 * i];
      ty += sys.m[i] * viewPos[2 * i + 1];
    }
    tx /= M;
    ty /= M;
    let reach = 0;
    for (const i of follow) {
      reach = Math.max(reach, Math.abs(viewPos[2 * i] - tx), Math.abs(viewPos[2 * i + 1] - ty));
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

  // ---- 描画 ----

  const posPx = new Float32Array(6);
  const ghostPx = new Float32Array(6);
  const massArr = new Float32Array(3);
  const radArr = new Float32Array(3);
  const colArr = new Float32Array(COLORS.flat());

  function render(now) {
    const { sys, cam } = state;
    const vp = viewport();
    const scale = dpr();
    let mMax = 0;
    for (let i = 0; i < 3; i++) mMax = Math.max(mMax, sys.m[i]);
    for (let i = 0; i < 3; i++) {
      posPx[2 * i] = vp.ox + (viewPos[2 * i] - cam.x) / cam.px;
      posPx[2 * i + 1] = vp.oy + (viewPos[2 * i + 1] - cam.y) / cam.px;
      ghostPx[2 * i] = vp.ox + (viewGhost[2 * i] - cam.x) / cam.px;
      ghostPx[2 * i + 1] = vp.oy + (viewGhost[2 * i + 1] - cam.y) / cam.px;
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
    gl.uniform1f(bg.u.uGhostOn, ghostActive() ? 1 : 0);
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
      const points = trails[i].withHead(viewPos[2 * i], viewPos[2 * i + 1], sys.t);
      const segments = points.length / 3 - 1;
      if (segments < 1) continue;
      gl.bufferData(gl.ARRAY_BUFFER, points, gl.DYNAMIC_DRAW);
      gl.uniform3fv(trailProg.u.uColor, COLORS[i]);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, segments);
    }
    gl.bindVertexArray(null);

    drawOverlay();
  }

  function cssColor(c, alpha) {
    return `rgba(${c.map((v) => Math.round(v * 255)).join(',')},${alpha ?? 1})`;
  }

  const SUPERSCRIPT = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

  function power10(n) {
    return '10' + String(n).replace(/./g, (ch) => SUPERSCRIPT[ch]);
  }

  let overlayDirty = false;

  function drawOverlay() {
    const wanted = ghostActive() || state.edit;
    // 何も描かないフレームでは、全画面の消去も省く。
    if (!wanted && !overlayDirty) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    overlayDirty = wanted;
    if (ghostActive()) drawGhostGraph();
    if (state.edit) drawHandles();
  }

  // 本体と分身のずれを対数で描く。カオスな軌道では右上がりの直線に近くなる。
  function drawGhostGraph() {
    const s = dpr();
    const w = 250 * s;
    const h = 112 * s;
    const x0 = 16 * s;
    const y0 = overlay.height - h - (window.innerWidth > 900 ? 18 : 96) * s;
    ctx.fillStyle = 'rgba(6, 11, 20, .62)';
    ctx.strokeStyle = 'rgba(150, 190, 230, .2)';
    ctx.lineWidth = s;
    ctx.beginPath();
    ctx.roundRect(x0, y0, w, h, 8 * s);
    ctx.fill();
    ctx.stroke();

    ctx.font = `${10 * s}px ui-monospace, Consolas, monospace`;
    ctx.fillStyle = '#7f93ab';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText('GHOST Δ  (log)', x0 + 10 * s, y0 + 8 * s);

    const hist = state.ghostHistory;
    const logs = hist.map(([, d]) => Math.log10(Math.max(d, 1e-16)));
    const yMax = Math.max(1, Math.ceil(Math.max(...logs, -99)));
    const yMin = Math.min(-7, Math.floor(Math.min(...logs, 99)));
    const left = x0 + 40 * s;
    const right = x0 + w - 10 * s;
    const top = y0 + 26 * s;
    const bottom = y0 + h - 12 * s;
    const yOf = (lg) => bottom - ((lg - yMin) / (yMax - yMin)) * (bottom - top);

    const every = yMax - yMin > 12 ? 4 : 2;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let lg = yMax; lg >= yMin; lg -= every) {
      ctx.strokeStyle = 'rgba(150, 190, 230, .1)';
      ctx.beginPath();
      ctx.moveTo(left, yOf(lg));
      ctx.lineTo(right, yOf(lg));
      ctx.stroke();
      ctx.fillText(power10(lg), left - 5 * s, yOf(lg));
    }
    if (hist.length < 2) return;
    const tStart = hist[0][0];
    const tEnd = hist[hist.length - 1][0];
    ctx.strokeStyle = state.ghostDelta > 0.1 ? '#ffb86b' : '#6fd8ff';
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    hist.forEach(([t], i) => {
      const x = left + ((t - tStart) / (tEnd - tStart)) * (right - left);
      if (i === 0) ctx.moveTo(x, yOf(logs[i]));
      else ctx.lineTo(x, yOf(logs[i]));
    });
    ctx.stroke();
  }

  // 画面上の位置(2D canvas の座標)。GL は下が原点なので上下を返す。
  function screenOf(i) {
    return [posPx[2 * i], overlay.height - posPx[2 * i + 1]];
  }

  function handleOf(i) {
    const [x, y] = screenOf(i);
    const k = VEL_SCALE / state.cam.px;
    return [x + state.sys.v[2 * i] * k, y - state.sys.v[2 * i + 1] * k];
  }

  function drawHandles() {
    const s = dpr();
    for (let i = 0; i < 3; i++) {
      const [x, y] = screenOf(i);
      const [hx, hy] = handleOf(i);
      ctx.strokeStyle = cssColor(COLORS[i], 0.9);
      ctx.fillStyle = cssColor(COLORS[i], 0.9);
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.arc(x, y, 15 * s, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      const dir = Math.atan2(hy - y, hx - x);
      ctx.beginPath();
      ctx.moveTo(hx + 9 * s * Math.cos(dir), hy + 9 * s * Math.sin(dir));
      ctx.lineTo(hx + 7 * s * Math.cos(dir + 2.2), hy + 7 * s * Math.sin(dir + 2.2));
      ctx.lineTo(hx + 7 * s * Math.cos(dir - 2.2), hy + 7 * s * Math.sin(dir - 2.2));
      ctx.closePath();
      ctx.fill();
    }
  }

  // ---- UI ----

  function formatMass(m) {
    return m >= 0.1 ? m.toFixed(2) : m.toExponential(0).replace(/e-(\d+)$/, (_, d) => '·' + power10(-Number(d)));
  }

  function renderScenarioInfo() {
    const { sc, sys } = state;
    const fix = (v) => (Math.abs(v) < 5e-4 ? 0 : v).toFixed(3);
    if (state.custom) {
      $('title').textContent = 'CUSTOM';
      $('subtitle').textContent = `/ FROM ${sc.name}`;
      $('formula').textContent = [0, 1, 2].map((i) =>
        `r = (${fix(sys.p[2 * i])}, ${fix(sys.p[2 * i + 1])})  v = (${fix(sys.v[2 * i])}, ${fix(sys.v[2 * i + 1])})`).join('\n');
      $('theoryText').textContent = 'EDIT で星をつまんで作った初期条件。RESET を押すと元の軌道に戻る。';
    } else {
      $('title').textContent = sc.name;
      $('subtitle').textContent = '/ ' + (sc.random ? `SEED ${state.seed}` : sc.sub);
      $('formula').textContent = sc.formula;
      $('theoryText').textContent = sc.text;
    }
    $('theoryTitle').textContent = $('title').textContent;
    $('massList').innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const li = document.createElement('li');
      li.innerHTML = `<i style="--c:${cssColor(COLORS[i])}"></i>m = ${formatMass(sys.m[i])}`;
      $('massList').append(li);
    }
    $('orbitRead').hidden = !sc.period || state.custom;
    document.querySelectorAll('#scenarios button').forEach((b) => b.classList.toggle('active', Number(b.dataset.index) === state.index));
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

  function setGhostMode(mode) {
    state.ghostMode = mode;
    makeGhost();
    document.querySelectorAll('#ghostModes button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    $('ghostMethods').hidden = mode !== 'method';
    $('ghostRead').hidden = mode === 'off';
    $('ghostNote').textContent = {
      off: '少しだけ違う宇宙を並走させて、ずれの育ち方を見る',
      shift: '星 1 を 10⁻⁶ ずらした分身。白い輪が分身の位置',
      method: '同じ初期値を別の積分法で計算した分身',
    }[mode];
  }

  function setGhostMethod(method) {
    state.ghostMethod = method;
    makeGhost();
    document.querySelectorAll('#ghostMethods button').forEach((b) => b.classList.toggle('active', b.dataset.method === method));
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

  // ---- 編集 ----

  // 編集した内容を、新しい初期条件として扱い直す。
  function applyEdit() {
    const { sys } = state;
    sys.t = 0;
    state.e0 = TB.energy(sys);
    state.diverged = false;
    state.custom = true;
    state.frameZero = pairAngle(sys);
    clearTrails();
    makeGhost();
    renderScenarioInfo();
  }

  function setEdit(on) {
    state.edit = on;
    setToggle('editToggle', on);
    $('massEdit').hidden = !on;
    canvas.classList.toggle('editing', on);
    if (on) {
      setPlaying(false);
      if (state.rotating) setRotating(false);
      syncMassSliders();
    }
  }

  function syncMassSliders() {
    for (let i = 0; i < 3; i++) {
      $(`mass${i}`).value = Math.min(Math.max(Math.log10(state.sys.m[i]), -3), 1);
      $(`mass${i}Value`).textContent = formatMass(state.sys.m[i]);
    }
  }

  function stopCenterOfMass() {
    const { sys } = state;
    let M = 0;
    const c = [0, 0, 0, 0];
    for (let i = 0; i < 3; i++) {
      M += sys.m[i];
      c[0] += sys.m[i] * sys.p[2 * i];
      c[1] += sys.m[i] * sys.p[2 * i + 1];
      c[2] += sys.m[i] * sys.v[2 * i];
      c[3] += sys.m[i] * sys.v[2 * i + 1];
    }
    for (let i = 0; i < 3; i++) {
      sys.p[2 * i] -= c[0] / M;
      sys.p[2 * i + 1] -= c[1] / M;
      sys.v[2 * i] -= c[2] / M;
      sys.v[2 * i + 1] -= c[3] / M;
    }
    applyEdit();
  }

  function hitTest(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * dpr();
    const y = (clientY - rect.top) * dpr();
    const reach = 18 * dpr();
    for (const kind of ['vel', 'pos']) {
      for (let i = 0; i < 3; i++) {
        const [px, py] = kind === 'vel' ? handleOf(i) : screenOf(i);
        if (Math.hypot(x - px, y - py) < reach) return { kind, i };
      }
    }
    return null;
  }

  function worldOf(clientX, clientY) {
    const { cam } = state;
    const vp = viewport();
    const rect = canvas.getBoundingClientRect();
    return [
      cam.x + ((clientX - rect.left) * dpr() - vp.ox) * cam.px,
      cam.y + ((rect.bottom - clientY) * dpr() - vp.oy) * cam.px,
    ];
  }

  function dragBody(clientX, clientY) {
    const { sys, drag } = state;
    const [wx, wy] = worldOf(clientX, clientY);
    if (drag.kind === 'pos') {
      sys.p[2 * drag.i] = wx;
      sys.p[2 * drag.i + 1] = wy;
    } else {
      sys.v[2 * drag.i] = (wx - sys.p[2 * drag.i]) / VEL_SCALE;
      sys.v[2 * drag.i + 1] = (wy - sys.p[2 * drag.i + 1]) / VEL_SCALE;
    }
  }

  // ---- パネルの組み立て ----

  TB.GROUPS.forEach((group) => {
    const label = document.createElement('span');
    label.className = 'groupLabel';
    label.innerHTML = `${group.label}<small>${group.note}</small>`;
    const grid = document.createElement('div');
    grid.className = 'scenarioGrid';
    TB.SCENARIOS.forEach((sc, i) => {
      if (sc.group !== group.id) return;
      const b = document.createElement('button');
      b.dataset.index = i;
      // 2013 年の周期解は出典がどれも同じなので、ボタンには周期を出す。
      const tag = sc.sub.startsWith('ŠUVAKOV') ? `T ≈ ${sc.period.toFixed(1)}` : sc.sub;
      b.innerHTML = `<b>${sc.name}</b><small>${tag}</small>${sc.key ? `<i>${sc.key}</i>` : ''}`;
      b.addEventListener('click', () => load(i, { reseed: true }));
      grid.append(b);
    });
    $('scenarios').append(label, grid);
  });

  Object.entries(TB.METHODS).forEach(([key, m]) => {
    for (const [host, pick] of [['methods', setMethod], ['ghostMethods', setGhostMethod]]) {
      const b = document.createElement('button');
      b.dataset.method = key;
      b.textContent = m.label;
      b.addEventListener('click', () => pick(key));
      $(host).append(b);
    }
  });

  for (let i = 0; i < 3; i++) {
    const label = document.createElement('label');
    label.innerHTML = `<span><b><i class="dot" style="--c:${cssColor(COLORS[i])}"></i>MASS ${i + 1}</b></span><output id="mass${i}Value"></output>` +
      `<input id="mass${i}" type="range" min="-3" max="1" step=".05">`;
    $('massSliders').append(label);
    $(`mass${i}`).addEventListener('input', (e) => {
      state.sys.m[i] = Math.pow(10, Number(e.target.value));
      $(`mass${i}Value`).textContent = formatMass(state.sys.m[i]);
      applyEdit();
    });
  }

  document.querySelectorAll('#ghostModes button').forEach((b) => b.addEventListener('click', () => setGhostMode(b.dataset.mode)));
  $('motion').addEventListener('click', () => setPlaying(!state.playing));
  $('reset').addEventListener('click', () => load(state.index));
  $('openPanel').addEventListener('click', () => setPanel(!panel.classList.contains('open')));
  $('closePanel').addEventListener('click', () => setPanel(false));
  $('cameraToggle').addEventListener('click', () => setAutoCam(!state.autoCam));
  $('frameToggle').addEventListener('click', () => setRotating(!state.rotating));
  $('editToggle').addEventListener('click', () => setEdit(!state.edit));
  $('recenter').addEventListener('click', stopCenterOfMass);
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
    else if (e.code === 'KeyG') setGhostMode(state.ghostMode === 'off' ? 'shift' : 'off');
    else if (e.code === 'KeyF') setRotating(!state.rotating);
    else if (e.code === 'KeyE') setEdit(!state.edit);
  });

  // ---- ポインタ操作 ----

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
    if (state.edit && !pointers.size) {
      const hit = hitTest(e.clientX, e.clientY);
      if (hit) {
        state.drag = { ...hit, pointerId: e.pointerId };
        clearTrails();
        return;
      }
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.classList.add('dragging');
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (state.drag && state.drag.pointerId === e.pointerId) {
      dragBody(e.clientX, e.clientY);
      return;
    }
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
    if (state.drag && state.drag.pointerId === e.pointerId) {
      state.drag = null;
      applyEdit();
      syncMassSliders();
      return;
    }
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
    const broken = state.diverged || Math.abs(rel) > 1e-3;
    const energyOut = $('energyOut');
    energyOut.textContent = state.diverged ? 'DIVERGED' : formatEnergy(rel);
    energyOut.classList.toggle('warn', broken);
    $('notice').hidden = !broken;
    if (broken) {
      $('notice').textContent = state.diverged
        ? '数値が発散しました。R でやり直せます。'
        : `計算の誤差がエネルギーの 0.1% を超えました。ここから先は本物の軌道とは違う動きです(積分法 ${TB.METHODS[state.method].label})。`;
    }
    if (ghostActive()) {
      const d = state.ghostDelta;
      $('ghostOut').textContent = Number.isFinite(d) ? d.toExponential(1) : '—';
      $('ghostOut').classList.toggle('warn', !(d <= 0.1));
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
    updateView();
    updateCamera(dtReal);
    step(dtReal);
    updateView();
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
  setGhostMode('off');
  setGhostMethod(state.ghostMethod);
  requestAnimationFrame(frame);
})();
