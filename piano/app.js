'use strict';

// ===== 音の名前と色 =====
const PC_NAME = ['ド', 'ド', 'レ', 'レ', 'ミ', 'ファ', 'ファ', 'ソ', 'ソ', 'ラ', 'ラ', 'シ'];
const PC_STEP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]; // ドからの白鍵の段
const PC_SHARP = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
const color = (midi) => `var(--c${PC_STEP[((midi % 12) + 12) % 12]})`;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const stepOf = (m) => PC_STEP[m % 12] + 7 * (Math.floor(m / 12) - 5); // C4=0

// けんばんの範囲: ラ↓(A3) 〜 レ↑(D5) = 1オクターブ + 左右2つずつの白鍵
const LOW = 57, HIGH = 74;
const WHITES = [];
for (let m = LOW; m <= HIGH; m++) if (!PC_SHARP[m % 12]) WHITES.push(m);
const PORTRAIT_KEYS = 8;

// ===== 保存 =====
const store = {
  get(k, d) { try { const v = localStorage.getItem('piano.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('piano.' + k, JSON.stringify(v)); } catch (e) { /* 保存できない環境 */ } },
  del(k) { try { localStorage.removeItem('piano.' + k); } catch (e) { /* noop */ } },
};

// ===== メロディの読み取り =====
// "ドドソソ ララソー / (ドレ)ミ ウ" → [[{midi, beats}], ...]
function parseMelody(text) {
  const phrases = [[]];
  const src = String(text || '').replace(/[（]/g, '(').replace(/[）]/g, ')').replace(/[♯＃]/g, '#').replace(/[♭]/g, 'b');
  let i = 0;
  let group = null;
  const cur = () => phrases[phrases.length - 1];
  const NOTE = [['ファ', 5], ['ふぁ', 5], ['ド', 0], ['レ', 2], ['ミ', 4], ['ソ', 7], ['ラ', 9], ['シ', 11],
    ['ど', 0], ['れ', 2], ['み', 4], ['そ', 7], ['ら', 9], ['し', 11]];
  while (i < src.length) {
    const ch = src[i];
    if (ch === '/' || ch === '\n') {
      if (cur().length) phrases.push([]);
      i++; continue;
    }
    if (ch === '(') { group = []; i++; continue; }
    if (ch === ')') {
      if (group && group.length) {
        group.forEach((n) => { n.beats = 1 / group.length; cur().push(n); });
      }
      group = null; i++; continue;
    }
    let ev = null;
    const hit = NOTE.find(([s]) => src.startsWith(s, i));
    if (hit) { ev = { midi: 60 + hit[1], beats: 1 }; i += hit[0].length; }
    else if (ch === 'ウ' || ch === 'う' || ch === '・') { ev = { midi: null, beats: 1 }; i++; }
    else { i++; continue; }
    // うしろの記号
    while (i < src.length) {
      const c = src[i];
      if (c === '#') { if (ev.midi != null) ev.midi += 1; }
      else if (c === 'b') { if (ev.midi != null) ev.midi -= 1; }
      else if (c === '↑' || c === "'") { if (ev.midi != null) ev.midi += 12; }
      else if (c === '↓' || c === ',') { if (ev.midi != null) ev.midi -= 12; }
      else if (c === 'ー' || c === '-' || c === '〜' || c === '~') { if (!group) ev.beats += 1; }
      else break;
      i++;
    }
    if (group) group.push(ev); else cur().push(ev);
  }
  return phrases.filter((p) => p.length);
}

// 歌詞を1音ずつに分ける。小さい字・ー・っ は前の字にくっつける。(らん) でまとめられる。
function splitLyrics(text) {
  const out = [];
  const src = String(text || '').replace(/[（]/g, '(').replace(/[）]/g, ')');
  const ATTACH = /[ゃゅょぁぃぅぇぉゎャュョァィゥェォヮっッーｰ〜~、。,.!！?？]/;
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch) || ch === '/') { i++; continue; }
    if (ch === '(') {
      const end = src.indexOf(')', i + 1);
      const s = src.slice(i + 1, end < 0 ? undefined : end).replace(/\s/g, '');
      if (s) out.push(s);
      i = end < 0 ? src.length : end + 1;
      continue;
    }
    if (ATTACH.test(ch) && out.length) out[out.length - 1] += ch;
    else out.push(ch);
    i++;
  }
  return out;
}

// ===== 音 =====
let ctx = null, master = null, noiseBuf = null, mixOut = null;
function ensureAudio() {
  if (!ctx) {
    setAudioSession('playback');
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4;
    comp.attack.value = 0.003; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = 0.9;
    master.connect(comp); comp.connect(ctx.destination);
    mixOut = comp;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
  }
  if (ctx.state !== 'running') ctx.resume();
  return ctx;
}

// iOS: ふだんはマナーモードでも鳴る 'playback'、録音中だけ 'play-and-record'
function setAudioSession(type) {
  try { if (navigator.audioSession) navigator.audioSession.type = type; } catch (e) { /* 対応していない */ }
}

function noiseSource(t) {
  const n = ctx.createBufferSource();
  n.buffer = noiseBuf; n.loop = true;
  n.start(t, Math.random() * 0.5);
  return n;
}

// ピアノ: 少しずれた倍音を足して、高い倍音ほど早く消える
function pianoNote(midi, t, gainScale = 1) {
  const f = mtof(midi);
  const out = ctx.createGain();
  out.gain.value = 0.3 * gainScale;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass'; tone.frequency.value = Math.min(9000, f * 9); tone.Q.value = 0.3;
  tone.connect(out); out.connect(master);
  const srcs = [];
  const PART = [1, 0.55, 0.32, 0.2, 0.12, 0.08, 0.05, 0.03];
  const len = f < 300 ? 1.25 : f < 450 ? 1.0 : 0.8;
  PART.forEach((a, k) => {
    const n = k + 1;
    const o = ctx.createOscillator();
    o.frequency.value = f * n * Math.sqrt(1 + 0.00035 * n * n);
    o.detune.value = (k % 2 ? 1 : -1) * 1.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(a, t + 0.003);
    g.gain.setTargetAtTime(a * 0.35, t + 0.003, 0.06 / Math.sqrt(n));
    g.gain.setTargetAtTime(0, t + 0.12, len / Math.pow(n, 0.7));
    o.connect(g); g.connect(tone);
    o.start(t);
    srcs.push(o);
  });
  // ハンマーの「コツ」
  const nz = noiseSource(t);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(6000, f * 5); bp.Q.value = 1.2;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.35, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  nz.connect(bp); bp.connect(ng); ng.connect(out);
  nz.stop(t + 0.05);
  const maxEnd = t + 6;
  srcs.forEach((o) => o.stop(maxEnd));
  return {
    release(at) {
      const r = Math.max(at, ctx.currentTime);
      out.gain.cancelScheduledValues(r);
      out.gain.setValueAtTime(out.gain.value, r);
      out.gain.setTargetAtTime(0, r, 0.09);
      srcs.forEach((o) => { try { o.stop(r + 0.6); } catch (e) { /* 止まっている */ } });
    },
    kill() {
      const r = ctx.currentTime;
      out.gain.cancelScheduledValues(r); out.gain.setTargetAtTime(0, r, 0.01);
      srcs.forEach((o) => { try { o.stop(r + 0.08); } catch (e) { /* noop */ } });
    },
  };
}

// 「ドーレーミー」とうたう声: のこぎり波を母音のフォルマントに通す
const VOWEL = { a: [820, 1250, 2850], i: [320, 2550, 3350], u: [360, 1350, 2500], e: [520, 2050, 2900], o: [530, 880, 2650] };
const FORMANT_GAIN = [1, 0.55, 0.28];
const FORMANT_BW = [90, 120, 180];
const SYLLABLE = {
  // lv は音ごとの大きさのばらつきをならす係数
  0: { c: 'd', v: 'o', lv: 0.9 }, 2: { c: 'r', v: 'e', lv: 1.4 }, 4: { c: 'm', v: 'i', lv: 0.5 }, 5: { c: 'f', v: 'a', lv: 2.2 },
  7: { c: 's', v: 'o', lv: 1.45 }, 9: { c: 'r', v: 'a', lv: 1.35 }, 11: { c: 'sh', v: 'i', lv: 1.6 },
};
// 子音が母音より前に出る長さ(自動演奏では拍に母音が合うよう先に出す)
const CONS_LEAD = { d: 0.02, r: 0.025, m: 0.07, f: 0.08, s: 0.1, sh: 0.11 };
const syllableOf = (midi) => SYLLABLE[midi % 12] || SYLLABLE[(midi - 1) % 12];

function voiceNote(midi, t, gainScale = 1) {
  const f0 = mtof(midi);
  const { c, v, lv } = syllableOf(midi);
  const V = VOWEL[v];
  const tv = t + CONS_LEAD[c]; // 母音がはじまる時刻

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(f0 * 0.97, t);
  osc.frequency.exponentialRampToValueAtTime(f0, tv + 0.06);
  // ビブラート(少し遅れてかかる)
  const lfo = ctx.createOscillator(); lfo.frequency.value = 5.4;
  const lfoG = ctx.createGain();
  lfoG.gain.setValueAtTime(0, t);
  lfoG.gain.setValueAtTime(0, tv + 0.25);
  lfoG.gain.linearRampToValueAtTime(f0 * 0.012, tv + 0.6);
  lfo.connect(lfoG); lfoG.connect(osc.frequency);

  const glottal = ctx.createBiquadFilter();
  glottal.type = 'lowpass'; glottal.Q.value = 0.5;
  glottal.frequency.setValueAtTime(5000, t);
  osc.connect(glottal);

  const vg = ctx.createGain(); // 声の大きさ
  vg.gain.setValueAtTime(0, t);
  const outG = ctx.createGain();
  outG.gain.value = 0.85 * lv * gainScale;
  vg.connect(outG); outG.connect(master);

  const bps = V.map((fv, k) => {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = fv / FORMANT_BW[k];
    const g = ctx.createGain(); g.gain.value = FORMANT_GAIN[k];
    glottal.connect(bp); bp.connect(g); g.connect(vg);
    return bp;
  });
  const setFormants = (arr, at) => bps.forEach((bp, k) => { bp.frequency.setValueAtTime(arr[k], at); bp.Q.setValueAtTime(arr[k] / FORMANT_BW[k], at); });
  const rampFormants = (arr, at) => bps.forEach((bp, k) => { bp.frequency.linearRampToValueAtTime(arr[k], at); bp.Q.linearRampToValueAtTime(arr[k] / FORMANT_BW[k], at); });

  // 子音の息の音
  const hiss = (type, freq, q, level, from, to) => {
    const nz = noiseSource(from);
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = freq; fl.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, from);
    g.gain.linearRampToValueAtTime(level, from + Math.min(0.03, (to - from) / 2));
    g.gain.linearRampToValueAtTime(0, to);
    nz.connect(fl); fl.connect(g); g.connect(outG);
    nz.stop(to + 0.02);
  };

  const PEAK = 1;
  switch (c) {
    case 'd':
      setFormants([300, 1700, 2600], t); rampFormants(V, tv + 0.04);
      vg.gain.linearRampToValueAtTime(PEAK, tv + 0.01);
      hiss('bandpass', 3200, 1, 0.12, t, t + 0.018);
      break;
    case 'r':
      setFormants([320, 1650, 2500], t); rampFormants(V, tv + 0.05);
      vg.gain.linearRampToValueAtTime(PEAK * 0.6, t + 0.008);
      vg.gain.linearRampToValueAtTime(PEAK * 0.2, tv);
      vg.gain.linearRampToValueAtTime(PEAK, tv + 0.03);
      break;
    case 'm':
      setFormants([260, 1100, 2400], t); setFormants([260, 1100, 2400], tv - 0.01); rampFormants(V, tv + 0.04);
      glottal.frequency.setValueAtTime(420, t);
      glottal.frequency.setValueAtTime(420, tv - 0.01);
      glottal.frequency.exponentialRampToValueAtTime(5000, tv + 0.03);
      vg.gain.linearRampToValueAtTime(PEAK * 0.9, t + 0.02);
      vg.gain.setValueAtTime(PEAK * 0.9, tv - 0.01);
      vg.gain.linearRampToValueAtTime(PEAK, tv + 0.03);
      break;
    case 'f':
      setFormants(V, t);
      hiss('bandpass', 1600, 0.7, 0.16, t, tv + 0.02);
      vg.gain.setValueAtTime(0, tv - 0.015);
      vg.gain.linearRampToValueAtTime(PEAK, tv + 0.04);
      break;
    case 's':
      setFormants(V, t);
      hiss('highpass', 4800, 0.7, 0.22, t, tv + 0.01);
      vg.gain.setValueAtTime(0, tv - 0.01);
      vg.gain.linearRampToValueAtTime(PEAK, tv + 0.035);
      break;
    case 'sh':
      setFormants([300, 2300, 3200], t); rampFormants(V, tv + 0.03);
      hiss('bandpass', 3300, 1.4, 0.26, t, tv + 0.01);
      vg.gain.setValueAtTime(0, tv - 0.01);
      vg.gain.linearRampToValueAtTime(PEAK, tv + 0.035);
      break;
    default:
      setFormants(V, t);
      vg.gain.linearRampToValueAtTime(PEAK, tv + 0.02);
  }
  // 少しずつ弱く
  vg.gain.setTargetAtTime(PEAK * 0.8, tv + 0.06, 0.6);

  osc.start(t); lfo.start(t);
  const maxEnd = t + 12;
  osc.stop(maxEnd); lfo.stop(maxEnd);
  const stopAll = (at) => { [osc, lfo].forEach((o) => { try { o.stop(at); } catch (e) { /* noop */ } }); };
  return {
    lead: CONS_LEAD[c],
    release(at) {
      const r = Math.max(at, ctx.currentTime, tv + 0.08);
      vg.gain.cancelScheduledValues(r);
      vg.gain.setTargetAtTime(0, r, 0.05);
      stopAll(r + 0.4);
    },
    kill() {
      const r = ctx.currentTime;
      outG.gain.cancelScheduledValues(r); outG.gain.setTargetAtTime(0, r, 0.01);
      stopAll(r + 0.08);
    },
  };
}

// 今の音色でならす。自動演奏では声の母音が t に合うよう前倒しする。
function startNote(midi, t, { aligned = false } = {}) {
  ensureAudio();
  const at = t == null ? ctx.currentTime + 0.005 : t;
  if (state.sound === 'voice') {
    const lead = aligned ? CONS_LEAD[syllableOf(midi).c] : 0;
    const vStart = Math.max(ctx.currentTime, at - lead);
    const v = voiceNote(midi, vStart);
    const p = settings.layer ? pianoNote(midi, at, 0.45) : null;
    return {
      release(r) { v.release(r); if (p) p.release(r); },
      kill() { v.kill(); if (p) p.kill(); },
    };
  }
  return pianoNote(midi, at);
}

function tick(t, strong) {
  const o = ctx.createOscillator();
  o.frequency.value = strong ? 1500 : 1100;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + 0.1);
}

// ===== 状態 =====
const settings = Object.assign({ countIn: true, loop: false, layer: false }, store.get('settings', {}));
const state = {
  songId: store.get('song', 'kirakira'),
  sound: store.get('sound', 'piano'),
  bpm: 100,
  song: null,         // { title, phrases, flat, lyrics }
  playing: false,
  practice: false,
  guideIdx: 0,
  kbOffset: 2,        // たて画面で左はしの白鍵(0 = ラ↓)
};

const $ = (id) => document.getElementById(id);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

function songDef(id) {
  const base = window.PIANO_SONGS.find((s) => s.id === id) || window.PIANO_SONGS[0];
  const ov = store.get('song.' + base.id, {});
  return {
    id: base.id, custom: !!base.custom,
    title: (base.custom && ov.title) || base.title,
    melody: ov.melody != null ? ov.melody : base.melody,
    lyrics: ov.lyrics || '',
    bpm: ov.bpm || base.bpm,
    base,
  };
}

function loadSong(id) {
  stopPlay();
  const def = songDef(id);
  state.songId = def.id;
  store.set('song', def.id);
  const phrases = parseMelody(def.melody);
  const lyr = splitLyrics(def.lyrics);
  const flat = [];
  let beat = 0, li = 0;
  phrases.forEach((p, pi) => p.forEach((n) => {
    n.phrase = pi; n.start = beat; n.idx = flat.length;
    if (n.midi != null && li < lyr.length) n.lyric = lyr[li++];
    beat += n.beats;
    flat.push(n);
  }));
  state.song = { def, phrases, flat, totalBeats: beat, hasLyrics: lyr.length > 0 };
  state.bpm = def.bpm;
  $('bpm').textContent = state.bpm;
  state.guideIdx = firstNoteIdx(0);
  renderSongs();
  renderScore();
  updateGuide();
}

function firstNoteIdx(from) {
  const f = state.song.flat;
  for (let k = from; k < f.length; k++) if (f[k].midi != null && f[k].midi >= LOW && f[k].midi <= HIGH) return k;
  return -1;
}

// ===== 画面: 曲えらび =====
function renderSongs() {
  const box = $('songs');
  box.textContent = '';
  window.PIANO_SONGS.forEach((s) => {
    const d = songDef(s.id);
    const b = el('button', 'chip' + (s.id === state.songId ? ' on' : ''), d.title);
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(s.id === state.songId));
    b.addEventListener('click', () => loadSong(s.id));
    box.appendChild(b);
  });
}

// ===== 画面: 譜面 =====
// 段の位置: 曲でつかう音の高さに合わせて上下をきめる(低い音ほど下)
let STEP_TOP = 7, STEP_BOTTOM = -1;
const yPct = (step) => ((STEP_TOP - step) / (STEP_TOP - STEP_BOTTOM)) * 100;
function fitSteps(flat) {
  const steps = flat.filter((n) => n.midi != null).map((n) => stepOf(n.midi));
  let lo = Math.min(...steps, 2), hi = Math.max(...steps, 4);
  while (hi - lo < 6) { hi += 0.5; lo -= 0.5; }
  STEP_TOP = hi + 1.6; STEP_BOTTOM = lo - 2.2;
}

function renderScore() {
  const box = $('score');
  box.textContent = '';
  const { phrases } = state.song;
  fitSteps(state.song.flat);
  const maxBeats = Math.max(4, ...phrases.map((p) => p.reduce((a, n) => a + n.beats, 0)));
  phrases.forEach((p, pi) => {
    const row = el('div', 'row');
    row.dataset.phrase = pi;
    const staff = el('div', 'staff');
    [2, 4, 6, 8, 10].filter((s) => s > STEP_BOTTOM && s < STEP_TOP).forEach((s) => { const ln = el('i'); ln.style.top = yPct(s) + '%'; staff.appendChild(ln); });
    row.appendChild(staff);
    row.appendChild(el('div', 'clef', '𝄞'));
    p.forEach((n) => {
      const cell = el('div', 'cell');
      cell.style.flexGrow = n.beats;
      cell.dataset.idx = n.idx;
      n.cell = cell;
      if (n.midi == null) {
        cell.classList.add('rest');
        const h = el('div', 'head', '・'); h.style.top = '50%'; cell.appendChild(h);
      } else {
        const step = stepOf(n.midi);
        const top = yPct(step) + '%';
        if (n.beats > 1) {
          const bar = el('div', 'bar-len'); bar.style.top = top; bar.style.background = color(n.midi); cell.appendChild(bar);
        }
        for (let s = 0; s >= step; s -= 2) { const lg = el('div', 'ledger'); lg.style.top = yPct(s) + '%'; cell.appendChild(lg); }
        for (let s = 12; s <= step; s += 2) { const lg = el('div', 'ledger'); lg.style.top = yPct(s) + '%'; cell.appendChild(lg); }
        const h = el('div', 'head', PC_NAME[n.midi % 12]);
        h.style.top = top; h.style.background = color(n.midi);
        if (PC_SHARP[n.midi % 12]) h.appendChild(el('span', 'sh', '♯'));
        cell.appendChild(h);
        if (state.song.hasLyrics) {
          cell.appendChild(el('div', 'lyr' + ((n.lyric || '').length > 2 ? ' long' : ''), n.lyric || ''));
        } else {
          cell.appendChild(el('div', 'lyr solfa', PC_NAME[n.midi % 12]));
        }
        cell.addEventListener('pointerdown', (ev) => {
          ev.preventDefault();
          if (state.playing) return;
          const h2 = startNote(n.midi);
          h2.release(ctx.currentTime + Math.min(1.2, n.beats * 60 / state.bpm));
          if (state.practice) { state.guideIdx = n.idx; updateGuide(); }
          flashKey(n.midi, 300);
        });
      }
      row.appendChild(cell);
    });
    // 短い行が横に広がりすぎないよう、残りをすき間でうめる
    const used = p.reduce((a, n) => a + n.beats, 0);
    if (used < maxBeats) { const pad = el('div', 'cell'); pad.style.flexGrow = maxBeats - used; row.appendChild(pad); }
    box.appendChild(row);
  });
  sizeHeads();
}

function sizeHeads() {
  const row = document.querySelector('.row');
  if (!row) return;
  const rowH = parseFloat(getComputedStyle(row).getPropertyValue('--rowH')) || 100;
  const stepPx = rowH / (STEP_TOP - STEP_BOTTOM);
  // 1拍あたりの幅も見て、となりとかさならない大きさ
  const cells = row.querySelectorAll('.cell[data-idx]');
  let beatPx = Infinity;
  cells.forEach((c) => { const n = state.song.flat[c.dataset.idx]; if (n) beatPx = Math.min(beatPx, c.getBoundingClientRect().width / n.beats); });
  const minBeat = Math.min(...state.song.flat.map((n) => n.beats));
  const hs = Math.max(14, Math.min(stepPx * 2.3, beatPx * minBeat * 0.9, 40));
  $('score').style.setProperty('--hs', hs + 'px');
}

let curCell = null, curRow = null;
function markNow(idx) {
  const n = idx == null ? null : state.song.flat[idx];
  const cell = n ? n.cell : null;
  if (curCell !== cell) {
    if (curCell) curCell.classList.remove('now');
    if (cell) cell.classList.add('now');
    curCell = cell;
  }
  const row = cell ? cell.parentElement : null;
  if (curRow !== row) {
    if (curRow) curRow.classList.remove('now');
    if (row) { row.classList.add('now'); scrollRowIntoView(row); }
    curRow = row;
  }
  state.song.flat.forEach((m) => { if (m.cell) m.cell.classList.toggle('done', idx != null && m.idx < idx); });
}

function scrollRowIntoView(row) {
  const box = $('score');
  const target = row.offsetTop - (box.clientHeight - row.offsetHeight) / 2;
  box.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
}

// ===== けんばん =====
const keyEls = new Map();
function buildKeyboard() {
  const keys = $('keys');
  keys.textContent = '';
  for (let m = LOW; m <= HIGH; m++) {
    const black = !!PC_SHARP[m % 12];
    const k = el('div', 'key ' + (black ? 'black' : 'white'));
    k.dataset.midi = m;
    if (!black) {
      const name = PC_NAME[m % 12];
      const nm = el('div', 'nm' + (name.length > 1 ? ' long' : ''), name);
      nm.style.background = color(m);
      k.appendChild(nm);
    }
    keys.appendChild(k);
    keyEls.set(m, k);
  }
  layoutKeyboard();
}

const isPortrait = () => window.matchMedia('(orientation: portrait)').matches;
const visibleWhites = () => (isPortrait() ? PORTRAIT_KEYS : WHITES.length);

function layoutKeyboard() {
  const kb = $('keyboard');
  const W = kb.clientWidth;
  const n = visibleWhites();
  const ww = W / n;
  const bw = ww * 0.6;
  WHITES.forEach((m, i) => {
    const k = keyEls.get(m);
    k.style.left = (i * ww) + 'px';
    k.style.width = (ww - 3) + 'px';
  });
  for (let m = LOW; m <= HIGH; m++) {
    if (!PC_SHARP[m % 12]) continue;
    const i = WHITES.indexOf(m - 1);
    const k = keyEls.get(m);
    k.style.left = ((i + 1) * ww - bw / 2 - 1.5) + 'px';
    k.style.width = bw + 'px';
  }
  const keys = $('keys');
  keys.style.width = (WHITES.length * ww) + 'px';
  const maxOff = WHITES.length - n;
  state.kbOffset = Math.max(0, Math.min(maxOff, state.kbOffset));
  keys.style.transform = `translateX(${-state.kbOffset * ww}px)`;
  $('kbLeft').disabled = state.kbOffset <= 0;
  $('kbRight').disabled = state.kbOffset >= maxOff;
}

function shiftKeyboard(d) { state.kbOffset += d; layoutKeyboard(); }

// たて画面で見えていない音は、見えるところまでずらす
function followKey(midi) {
  if (!isPortrait()) return;
  const wi = WHITES.indexOf(PC_SHARP[midi % 12] ? midi - 1 : midi);
  if (wi < 0) return;
  const n = visibleWhites();
  if (wi < state.kbOffset) state.kbOffset = wi;
  else if (wi > state.kbOffset + n - 1) state.kbOffset = wi - n + 1;
  else return;
  layoutKeyboard();
}

function flashKey(midi, ms) {
  const k = keyEls.get(midi);
  if (!k) return;
  k.classList.add('on');
  setTimeout(() => k.classList.remove('on'), ms);
}

// 指ごとに押している鍵を覚える(すべらせても音がかわる)
const held = new Map(); // pointerId -> { midi, handle }
function keyAt(x, y) {
  const els = document.elementsFromPoint(x, y);
  const k = els.find((e) => e.classList && e.classList.contains('key'));
  return k ? Number(k.dataset.midi) : null;
}
function press(pid, midi) {
  const cur = held.get(pid);
  if (cur && cur.midi === midi) return;
  if (cur) release(pid);
  if (midi == null) return;
  // 同じ鍵をほかの指が押していたら、それを止めてから
  held.forEach((h, id) => { if (h.midi === midi) release(id); });
  const handle = startNote(midi);
  held.set(pid, { midi, handle });
  keyEls.get(midi).classList.add('on');
  onUserNote(midi);
}
function release(pid) {
  const cur = held.get(pid);
  if (!cur) return;
  held.delete(pid);
  cur.handle.release(ctx.currentTime);
  if (![...held.values()].some((h) => h.midi === cur.midi)) keyEls.get(cur.midi).classList.remove('on');
}

function bindKeyboard() {
  const kb = $('keyboard');
  kb.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { kb.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    press(e.pointerId, keyAt(e.clientX, e.clientY));
  });
  kb.addEventListener('pointermove', (e) => {
    if (!held.has(e.pointerId)) return;
    press(e.pointerId, keyAt(e.clientX, e.clientY));
  });
  const up = (e) => release(e.pointerId);
  kb.addEventListener('pointerup', up);
  kb.addEventListener('pointercancel', up);
  kb.addEventListener('lostpointercapture', up);
  kb.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ===== じぶんでひく(つぎの鍵が光る) =====
function updateGuide() {
  keyEls.forEach((k) => k.classList.remove('next'));
  if (!state.practice || state.playing) { if (!state.playing) markNow(null); return; }
  const n = state.song.flat[state.guideIdx];
  if (!n) { markNow(null); return; }
  keyEls.get(n.midi) && keyEls.get(n.midi).classList.add('next');
  markNow(n.idx);
  followKey(n.midi);
}

function onUserNote(midi) {
  if (!state.practice || state.playing) return;
  const n = state.song.flat[state.guideIdx];
  if (!n || n.midi !== midi) return;
  const nx = firstNoteIdx(state.guideIdx + 1);
  if (nx < 0) {
    cheer('できたね！🎉');
    state.guideIdx = firstNoteIdx(0);
    setTimeout(updateGuide, 900);
    keyEls.forEach((k) => k.classList.remove('next'));
    return;
  }
  state.guideIdx = nx;
  updateGuide();
}

let cheerTimer = 0;
function cheer(txt) {
  const c = $('cheer');
  c.textContent = txt;
  c.classList.add('show');
  clearTimeout(cheerTimer);
  cheerTimer = setTimeout(() => c.classList.remove('show'), 1400);
}

// ===== おてほん(自動演奏) =====
let play = null; // { t0, spb, next, handles, timer, raf }
function startPlay() {
  ensureAudio();
  if (state.playing) return;
  stopReview();
  state.playing = true;
  updateGuide();
  $('play').classList.add('on');
  $('play').querySelector('.ico').textContent = '■';
  $('play').querySelector('.lbl').textContent = 'とめる';
  const spb = 60 / state.bpm;
  const count = settings.countIn ? 4 : 0;
  const t0 = ctx.currentTime + 0.15;
  for (let k = 0; k < count; k++) tick(t0 + k * spb, k === 0);
  play = { t0: t0 + count * spb, spb, next: 0, handles: [], timer: 0, raf: 0 };
  play.timer = setInterval(schedule, 25);
  schedule();
  play.raf = requestAnimationFrame(draw);
}

function schedule() {
  if (!play) return;
  const flat = state.song.flat;
  const ahead = ctx.currentTime + 0.2;
  while (play.next < flat.length) {
    const n = flat[play.next];
    const t = play.t0 + n.start * play.spb;
    if (t > ahead) break;
    if (n.midi != null) {
      const h = startNote(n.midi, t, { aligned: true });
      const end = t + n.beats * play.spb * 0.94;
      h.release(end);
      play.handles.push({ h, end });
    }
    play.next++;
  }
  const now = ctx.currentTime;
  play.handles = play.handles.filter((x) => x.end > now - 1);
  if (play.next >= flat.length) {
    const songEnd = play.t0 + state.song.totalBeats * play.spb;
    if (rec) {
      if (now > songEnd + 1.2) stopRecording();
    } else if (settings.loop && songEnd - now < 0.2) {
      play.t0 = songEnd + play.spb; // 1拍あけてもう一度
      play.next = 0;
    } else if (!settings.loop && now > songEnd + 0.3) {
      stopPlay();
      cheer('じょうず！👏');
    }
  }
}

let litKey = null;
function draw() {
  const src = play || review;
  if (!src) return;
  const beat = (ctx.currentTime - src.t0) / src.spb;
  const flat = state.song.flat;
  let cur = null;
  if (beat >= 0) {
    for (let k = 0; k < flat.length; k++) {
      const n = flat[k];
      if (beat >= n.start && beat < n.start + n.beats) { cur = n; break; }
    }
  }
  markNow(cur && cur.midi != null ? cur.idx : (cur ? cur.idx : null));
  const midi = cur && cur.midi != null && beat < cur.start + cur.beats * 0.94 ? cur.midi : null;
  if (midi !== litKey) {
    if (litKey != null) keyEls.get(litKey) && keyEls.get(litKey).classList.remove('on');
    if (midi != null && keyEls.get(midi)) { keyEls.get(midi).classList.add('on'); followKey(midi); }
    litKey = midi;
  }
  src.raf = requestAnimationFrame(draw);
}

function clearLit() {
  if (litKey != null && keyEls.get(litKey)) keyEls.get(litKey).classList.remove('on');
  litKey = null;
}

function stopPlay() {
  if (!play) { state.playing = false; return; }
  clearInterval(play.timer);
  cancelAnimationFrame(play.raf);
  play.handles.forEach((x) => x.h.kill());
  play = null;
  state.playing = false;
  clearLit();
  if (rec) stopRecording();
  $('play').classList.remove('on');
  $('play').querySelector('.ico').textContent = '▶';
  $('play').querySelector('.lbl').textContent = 'おてほん';
  markNow(null);
  updateGuide();
}

// ===== ろくおん =====
// マイク(ch0)と、アプリが鳴らしている音(ch1)をいっしょに取りこむ。
// 残すのは最後の1回だけ(メモリの中だけ)。
const REC_WORKLET = `
class RecTap extends AudioWorkletProcessor {
  constructor() {
    super();
    this.on = true; this.a = []; this.b = []; this.n = 0; this.t = null;
    this.port.onmessage = (e) => { if (e.data === 'stop') { this.flush(); this.on = false; } };
  }
  flush() {
    if (!this.n) return;
    this.port.postMessage({ t: this.t, a: this.a, b: this.b });
    this.a = []; this.b = []; this.n = 0;
  }
  process(inputs) {
    if (!this.on) return false;
    const inp = inputs[0];
    if (inp && inp.length) {
      if (this.t == null) this.t = currentTime;
      this.a.push(inp[0].slice(0)); this.b.push((inp[1] || inp[0]).slice(0));
      this.n += inp[0].length;
      if (this.n >= 4096) this.flush();
    }
    return true;
  }
}
registerProcessor('rec-tap', RecTap);`;
const REC_MAX_SEC = 300;

let rec = null;    // 録音中: { stream, nodes, chunksA, chunksB, t0Cap, songT0, spb, songId }
let take = null;   // 最後の録音: { mic, acc, sr, beat0, spb, songId, latency, gain }
let review = null; // ききかえし中: { src, t0, spb, raf, mode }
const recOffset = { ms: store.get('recOffset', 0) };
let workletReady = null;

async function startRecording() {
  ensureAudio();
  if (state.playing || rec) return;
  stopReview();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('このブラウザでは録音できません');
    return;
  }
  setAudioSession('play-and-record');
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
  } catch (e) {
    setAudioSession('playback');
    alert('マイクがつかえませんでした。ブラウザの設定でマイクをゆるしてください。');
    return;
  }
  if (ctx.state !== 'running') await ctx.resume();

  const micSrc = ctx.createMediaStreamSource(stream);
  const merger = ctx.createChannelMerger(2);
  micSrc.connect(merger, 0, 0);
  mixOut.connect(merger, 0, 1);
  const sink = ctx.createGain(); sink.gain.value = 0; sink.connect(ctx.destination);
  const r = { stream, chunksA: [], chunksB: [], t0Cap: null, nodes: [micSrc, merger, sink], songId: state.songId };
  const onChunk = (t, a, b) => {
    if (r.t0Cap == null) r.t0Cap = t;
    r.chunksA.push(...a); r.chunksB.push(...b);
  };
  try {
    if (!ctx.audioWorklet) throw new Error('no worklet');
    if (!workletReady) {
      const url = URL.createObjectURL(new Blob([REC_WORKLET], { type: 'application/javascript' }));
      workletReady = ctx.audioWorklet.addModule(url);
    }
    await workletReady;
    const node = new AudioWorkletNode(ctx, 'rec-tap', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 2, channelCountMode: 'explicit' });
    node.port.onmessage = (e) => onChunk(e.data.t, e.data.a, e.data.b);
    merger.connect(node); node.connect(sink);
    r.tap = node;
  } catch (e) {
    // 古いブラウザ向け
    const sp = ctx.createScriptProcessor(4096, 2, 2);
    sp.onaudioprocess = (ev) => {
      if (!rec) return;
      const ib = ev.inputBuffer;
      onChunk(ev.playbackTime, [ib.getChannelData(0).slice(0)], [ib.getChannelData(ib.numberOfChannels > 1 ? 1 : 0).slice(0)]);
    };
    merger.connect(sp); sp.connect(sink);
    r.tap = sp;
  }
  const track = stream.getAudioTracks()[0];
  const trackLat = (track && track.getSettings && track.getSettings().latency) || 0.02;
  r.latency = (ctx.outputLatency || 0.02) + (ctx.baseLatency || 0) + trackLat;
  rec = r;
  setRecUI(true);
  startPlay();
  rec.songT0 = play.t0;
  rec.spb = play.spb;
  rec.limit = setTimeout(() => stopRecording(), REC_MAX_SEC * 1000);
}

function stopRecording() {
  const r = rec;
  if (!r) return;
  rec = null;
  clearTimeout(r.limit);
  if (state.playing) stopPlay();
  const finish = () => {
    r.nodes.forEach((n) => { try { n.disconnect(); } catch (e) { /* noop */ } });
    try { mixOut.disconnect(r.nodes[1]); } catch (e) { /* noop */ }
    try { r.tap.disconnect(); } catch (e) { /* noop */ }
    r.stream.getTracks().forEach((t) => t.stop());
    setAudioSession('playback');
    setRecUI(false);
    const len = r.chunksA.reduce((a, c) => a + c.length, 0);
    if (!len || r.t0Cap == null) { renderTake(); return; }
    const mic = new Float32Array(len), acc = new Float32Array(len);
    let o = 0;
    r.chunksA.forEach((c, k) => { mic.set(c, o); acc.set(r.chunksB[k], o); o += c.length; });
    let peak = 0;
    for (let k = 0; k < len; k++) peak = Math.max(peak, Math.abs(mic[k]));
    take = {
      mic, acc, sr: ctx.sampleRate,
      beat0: r.songT0 - r.t0Cap, spb: r.spb, songId: r.songId,
      latency: r.latency, gain: peak > 0 ? Math.min(10, 0.8 / peak) : 1,
    };
    renderTake();
  };
  // ワークレットに残っている分を出しきってから
  if (r.tap.port) { r.tap.port.postMessage('stop'); setTimeout(finish, 150); } else finish();
}

// マイクは少しおくれて入るので、そのぶん前にずらして伴奏と合わせる(recOffset.ms が大きいほど、うたが前に出る)
function takeBuffer(mode) {
  const { mic, acc, sr } = take;
  const shift = Math.round((take.latency + recOffset.ms / 1000) * sr);
  const n = mic.length;
  const buf = ctx.createBuffer(1, n, sr);
  const out = buf.getChannelData(0);
  const g = take.gain;
  for (let k = 0; k < n; k++) {
    const j = k + shift;
    let v = j >= 0 && j < n ? mic[j] * g : 0;
    if (mode === 'mix') v = v * 0.9 + acc[k] * 0.7;
    out[k] = v > 1 ? 1 : v < -1 ? -1 : v;
  }
  return buf;
}

function playTake(mode) {
  ensureAudio();
  if (!take) return;
  const same = review && review.mode === mode;
  stopReview();
  if (same) return; // もう一度おしたら止める
  stopPlay();
  const src = ctx.createBufferSource();
  src.buffer = takeBuffer(mode);
  const g = ctx.createGain(); g.gain.value = 1;
  src.connect(g); g.connect(ctx.destination);
  const at = ctx.currentTime + 0.05;
  src.start(at);
  review = { src, mode, t0: at + take.beat0, spb: take.spb, raf: 0 };
  src.onended = () => { if (review && review.src === src) stopReview(); };
  if (take.songId === state.songId) review.raf = requestAnimationFrame(draw);
  renderTake();
}

function stopReview() {
  if (!review) return;
  const r = review;
  review = null;
  try { r.src.stop(); } catch (e) { /* noop */ }
  cancelAnimationFrame(r.raf);
  clearLit();
  markNow(null);
  updateGuide();
  renderTake();
}

function setRecUI(on) {
  const b = $('rec');
  b.classList.toggle('on', on);
  b.querySelector('.ico').textContent = on ? '■' : '●';
  b.querySelector('.lbl').textContent = on ? 'とめる' : 'ろくおん';
  ['play', 'slower', 'faster', 'edit'].forEach((id) => { $(id).disabled = on; });
  document.querySelectorAll('.chip').forEach((c) => { c.disabled = on; });
  document.body.classList.toggle('recording', on);
  renderTake();
}

function renderTake() {
  const bar = $('recBar');
  bar.hidden = !take || !!rec;
  document.body.classList.toggle('has-take', !bar.hidden);
  if (!take) return;
  [['recPlayVoice', 'voice', 'うただけ'], ['recPlayMix', 'mix', 'うた＋伴奏']].forEach(([id, mode, lbl]) => {
    const on = review && review.mode === mode;
    $(id).classList.toggle('on', !!on);
    $(id).querySelector('.ico').textContent = on ? '■' : '▶';
    $(id).querySelector('.lbl').textContent = lbl;
  });
  // 表示は「うたが後ろにずれている量」(ミリ秒)
  const v = -recOffset.ms;
  $('recOff').textContent = (v > 0 ? '+' : '') + v;
  requestAnimationFrame(() => { layoutKeyboard(); sizeHeads(); });
}

function nudgeOffset(d) {
  recOffset.ms = Math.max(-500, Math.min(500, recOffset.ms + d));
  store.set('recOffset', recOffset.ms);
  const mode = review && review.mode;
  renderTake();
  if (mode) { stopReview(); playTake(mode); }
}

// ===== へんしゅう =====
function openEditor() {
  stopPlay();
  const d = songDef(state.songId);
  $('edTitle').textContent = d.title + ' のへんしゅう';
  $('edName').value = d.title;
  $('edMelody').value = d.melody.replace(/^\n/, '').split('\n').map((s) => s.trim()).join('\n');
  $('edLyrics').value = d.lyrics;
  $('optCount').checked = settings.countIn;
  $('optLoop').checked = settings.loop;
  $('optLayer').checked = settings.layer;
  document.querySelector('.ed').classList.toggle('is-custom', d.custom);
  updateCount();
  $('editor').showModal();
}

function updateCount() {
  const ns = parseMelody($('edMelody').value).flat().filter((n) => n.midi != null);
  const notes = ns.length;
  const out = ns.filter((n) => n.midi < LOW || n.midi > HIGH).length;
  const lyr = splitLyrics($('edLyrics').value).length;
  const p = $('edCount');
  let txt = `おと ${notes}こ`;
  if (lyr) txt += ` ／ かし ${lyr}こ` + (notes === lyr ? ' ✓' : (lyr < notes ? ' (かしがたりません)' : ' (かしがおおいです)'));
  if (out) txt += ` ／ けんばんにない音が${out}こあります(ラ↓〜レ↑まで)`;
  p.textContent = txt;
  p.classList.toggle('warn', (lyr > 0 && notes !== lyr) || out > 0);
}

function saveEditor() {
  const d = songDef(state.songId);
  const ov = store.get('song.' + d.id, {});
  const mel = $('edMelody').value;
  const baseMel = d.base.melody.replace(/^\n/, '').split('\n').map((s) => s.trim()).join('\n');
  if (mel.trim() && mel !== baseMel) ov.melody = mel; else delete ov.melody;
  if ($('edLyrics').value.trim()) ov.lyrics = $('edLyrics').value; else delete ov.lyrics;
  if (d.custom && $('edName').value.trim()) ov.title = $('edName').value.trim();
  ov.bpm = state.bpm;
  store.set('song.' + d.id, ov);
  $('editor').close();
  loadSong(d.id);
}

function resetEditor() {
  const d = songDef(state.songId);
  if (!confirm(`「${d.title}」のメロディ・かし・はやさを、さいしょの状態にもどしますか？`)) return;
  store.del('song.' + d.id);
  $('editor').close();
  loadSong(d.id);
}

// ===== はじめ =====
function setSound(s) {
  state.sound = s;
  store.set('sound', s);
  document.querySelectorAll('#sound button').forEach((b) => {
    const on = b.dataset.sound === s;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', String(on));
  });
}

function setBpm(v) {
  state.bpm = Math.max(50, Math.min(160, v));
  $('bpm').textContent = state.bpm;
  const ov = store.get('song.' + state.songId, {});
  ov.bpm = state.bpm;
  store.set('song.' + state.songId, ov);
  if (play) {
    // 今の位置をたもったまま、はやさをかえる
    const beatNow = (ctx.currentTime - play.t0) / play.spb;
    play.spb = 60 / state.bpm;
    play.t0 = ctx.currentTime - beatNow * play.spb;
  }
}

function init() {
  buildKeyboard();
  bindKeyboard();
  setSound(state.sound);
  loadSong(state.songId);

  $('play').addEventListener('click', () => (state.playing ? stopPlay() : startPlay()));
  $('rec').addEventListener('click', () => (rec ? stopRecording() : startRecording()));
  $('recPlayVoice').addEventListener('click', () => playTake('voice'));
  $('recPlayMix').addEventListener('click', () => playTake('mix'));
  $('recEarlier').addEventListener('click', () => nudgeOffset(20));
  $('recLater').addEventListener('click', () => nudgeOffset(-20));
  $('practice').addEventListener('click', () => {
    state.practice = !state.practice;
    $('practice').setAttribute('aria-pressed', String(state.practice));
    if (state.practice) { stopPlay(); state.guideIdx = firstNoteIdx(0); }
    updateGuide();
  });
  document.querySelectorAll('#sound button').forEach((b) => b.addEventListener('click', () => {
    setSound(b.dataset.sound);
    ensureAudio();
    const h = startNote(60);
    h.release(ctx.currentTime + 0.5);
    flashKey(60, 300);
  }));
  $('slower').addEventListener('click', () => setBpm(state.bpm - 8));
  $('faster').addEventListener('click', () => setBpm(state.bpm + 8));
  $('kbLeft').addEventListener('click', () => shiftKeyboard(-1));
  $('kbRight').addEventListener('click', () => shiftKeyboard(1));
  $('edit').addEventListener('click', openEditor);
  $('edSave').addEventListener('click', saveEditor);
  $('edReset').addEventListener('click', resetEditor);
  $('edMelody').addEventListener('input', updateCount);
  $('edLyrics').addEventListener('input', updateCount);
  [['optCount', 'countIn'], ['optLoop', 'loop'], ['optLayer', 'layer']].forEach(([id, key]) => {
    $(id).addEventListener('change', () => { settings[key] = $(id).checked; store.set('settings', settings); });
  });

  const fs = $('fs');
  if (document.fullscreenEnabled || document.webkitFullscreenEnabled) {
    fs.hidden = false;
    fs.addEventListener('click', () => {
      const d = document;
      if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else {
        const r = d.documentElement;
        const p = (r.requestFullscreen || r.webkitRequestFullscreen).call(r);
        if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* noop */ } }).catch(() => {});
      }
    });
  }

  let rt = 0;
  const onResize = () => { cancelAnimationFrame(rt); rt = requestAnimationFrame(() => { layoutKeyboard(); sizeHeads(); if (curRow) scrollRowIntoView(curRow); }); };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 200));
  // 画面がかくれたら止める
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stopPlay(); stopReview(); [...held.keys()].forEach(release); } });
  // 最初のタッチで音を準備(iOS)
  const unlock = () => { ensureAudio(); window.removeEventListener('pointerdown', unlock, true); };
  window.addEventListener('pointerdown', unlock, true);
}

// テスト用
window.__piano = { parseMelody, splitLyrics, state, getTake: () => take, playTake, stopRecording };
init();
