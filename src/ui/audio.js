// Game audio. REAL recordings (CC0, see src/assets/sounds/LICENSES.md) embedded as base64 in soundData.js and decoded
// with WebAudio after the first user gesture (pointerdown / keydown / touchend), so no autoplay warnings. Every call
// before that is a silent no-op. The old oscillator/noise synth is kept ONLY as a fallback for a sound whose recording
// failed to decode (for example a browser without Ogg Vorbis support). Gaps with no real recording yet: whistle, horn.
// Mute state is owned by the caller (persist it in settings) and pushed in with setMuted(bool).
//
// API: click(), whoosh(), rip(), reveal(rarity), crowdSwell(), goalHorn(), confirm(), error(), place(), shuffle(),
//      kick(hard), post(), tackle(), applause(), cheer(), setMuted(bool), isMuted(), unlock()
// No Math.random: variation comes from round-robin counters and a fixed LCG for the fallback noise.

import { SOUND_DATA } from './soundData.js';

let ctx = null;
let master = null;
let muted = false;
let noiseBuf = null;
let armed = false;

function lcgNoise(len, seed) {
  const out = new Float32Array(len);
  let s = seed >>> 0;
  for (let i = 0; i < len; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out[i] = (s / 4294967296) * 2 - 1;
  }
  return out;
}

/** Create (or resume) the AudioContext. Must run inside a user gesture the first time. */
export function unlock() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.7;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp);
    comp.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    noiseBuf.copyToChannel(lcgNoise(len, 0x5eed), 0);
  }
  if (ctx.state === 'suspended') ctx.resume();
  loadSamples();
  return ctx;
}

// ------------------------------------------------------------------ real samples
const samples = {};
let loading = false;

function b64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function loadSamples() {
  if (loading || !ctx) return;
  loading = true;
  for (const name of Object.keys(SOUND_DATA)) {
    try {
      const p = ctx.decodeAudioData(b64ToArrayBuffer(SOUND_DATA[name]), (buf) => { samples[name] = buf; }, () => {});
      if (p && p.then) p.then((buf) => { samples[name] = buf; }, () => {});
    } catch (e) { /* undecodable here: the synth fallback covers this sound */ }
  }
}

const counters = {};
const nextOf = (key, list) => { counters[key] = ((counters[key] ?? -1) + 1) % list.length; return list[counters[key]]; };

function arm() {
  if (armed || typeof window === 'undefined') return;
  armed = true;
  const go = () => {
    unlock();
    window.removeEventListener('pointerdown', go, true);
    window.removeEventListener('keydown', go, true);
    window.removeEventListener('touchend', go, true);
  };
  window.addEventListener('pointerdown', go, true);
  window.addEventListener('keydown', go, true);
  window.addEventListener('touchend', go, true);
}
arm();

export function setMuted(m) {
  muted = !!m;
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.7, ctx.currentTime, 0.02);
}
export const isMuted = () => muted;

/** Returns the context only when sound can actually play right now. */
function live() {
  if (muted || !ctx) return null;
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Play a decoded sample. Returns true when a real recording played (false = caller may fall back to the synth). */
function play(name, { gain = 1, rate = 1, delay = 0, fadeIn = 0, fadeOut = 0, dur = 0 } = {}) {
  const c = live();
  if (!c || !samples[name]) return false;
  const t0 = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = samples[name];
  src.playbackRate.value = rate;
  const g = c.createGain();
  const len = (dur || samples[name].duration) / rate;
  g.gain.setValueAtTime(fadeIn ? 0.0001 : gain, t0);
  if (fadeIn) g.gain.linearRampToValueAtTime(gain, t0 + fadeIn);
  if (fadeOut) {
    g.gain.setValueAtTime(gain, t0 + Math.max(fadeIn, len - fadeOut));
    g.gain.linearRampToValueAtTime(0.0001, t0 + len);
  }
  src.connect(g);
  g.connect(master);
  src.start(t0);
  if (dur) src.stop(t0 + len + 0.02);
  return true;
}

// ------------------------------------------------------------------ synth fallback (only used when a recording is missing)
function env(gainNode, t0, attack, hold, release, peak) {
  const g = gainNode.gain;
  g.cancelScheduledValues(t0);
  g.setValueAtTime(0.0001, t0);
  g.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + attack);
  g.setValueAtTime(Math.max(peak, 0.0002), t0 + attack + hold);
  g.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
}

function tone(freq, { type = 'sine', t = 0, attack = 0.005, hold = 0.02, release = 0.15, peak = 0.3, slideTo = 0, dest = master } = {}) {
  const c = live();
  if (!c) return;
  const t0 = c.currentTime + t;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + attack + hold + release);
  env(g, t0, attack, hold, release, peak);
  o.connect(g);
  g.connect(dest);
  o.start(t0);
  o.stop(t0 + attack + hold + release + 0.05);
}

function noise({ t = 0, dur = 0.4, filter = 'bandpass', f0 = 800, f1 = 0, q = 1, attack = 0.02, release = 0.2, peak = 0.3, offset = 0 } = {}) {
  const c = live();
  if (!c) return null;
  const t0 = c.currentTime + t;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const bq = c.createBiquadFilter();
  bq.type = filter;
  bq.Q.value = q;
  bq.frequency.setValueAtTime(f0, t0);
  if (f1) bq.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const g = c.createGain();
  env(g, t0, attack, Math.max(0, dur - attack - release), release, peak);
  src.connect(bq);
  bq.connect(g);
  g.connect(master);
  src.start(t0, offset % 1.5);
  src.stop(t0 + dur + 0.05);
  return g;
}

function synthClick() { tone(1500, { type: 'triangle', hold: 0.005, release: 0.05, peak: 0.18, slideTo: 700 }); }
function synthWhoosh() { noise({ dur: 0.45, filter: 'bandpass', f0: 300, f1: 2400, q: 1.4, attack: 0.15, release: 0.25, peak: 0.35 }); }
function synthRip() {
  for (let i = 0; i < 7; i++) noise({ t: i * 0.035, dur: 0.05, filter: 'highpass', f0: 2500 + i * 300, q: 0.7, attack: 0.004, release: 0.04, peak: 0.28, offset: i * 0.13 });
  noise({ t: 0.02, dur: 0.35, filter: 'bandpass', f0: 1800, f1: 6000, q: 0.8, attack: 0.01, release: 0.3, peak: 0.25 });
  tone(90, { type: 'sine', t: 0, attack: 0.005, hold: 0.04, release: 0.25, peak: 0.5, slideTo: 45 });
}
const REVEAL_NOTES = {
  bronze: [392], silver: [523.25, 659.25], gold: [523.25, 659.25, 783.99],
  elite: [523.25, 659.25, 783.99, 1046.5], icon: [587.33, 739.99, 880, 1174.66, 1479.98],
};
function synthReveal(rarity = 'bronze') {
  const notes = REVEAL_NOTES[rarity] || REVEAL_NOTES.bronze;
  const big = rarity === 'elite' || rarity === 'icon';
  notes.forEach((f, i) => {
    tone(f, { type: big ? 'triangle' : 'sine', t: i * 0.07, attack: 0.01, hold: 0.06, release: big ? 0.9 : 0.4, peak: 0.16 });
    if (big) tone(f * 2, { type: 'sine', t: i * 0.07 + 0.02, attack: 0.01, hold: 0.02, release: 0.6, peak: 0.05 });
  });
  if (rarity !== 'bronze') noise({ t: 0, dur: big ? 0.9 : 0.4, filter: 'highpass', f0: 7000, q: 0.5, attack: 0.02, release: big ? 0.8 : 0.35, peak: big ? 0.08 : 0.04 });
}
function synthCrowdSwell(duration = 2.2) {
  [420, 760, 1300].forEach((f, i) => {
    noise({ t: i * 0.04, dur: duration, filter: 'bandpass', f0: f * 0.8, f1: f * 1.15, q: 0.9, attack: duration * 0.55, release: duration * 0.4, peak: 0.16 - i * 0.03, offset: i * 0.4 });
  });
}
function synthGoalHorn() {
  const c = live();
  if (!c) return;
  const t0 = c.currentTime;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1400;
  lp.connect(master);
  [233.08, 277.18, 349.23].forEach((f, i) => {
    tone(f, { type: 'sawtooth', t: 0, attack: 0.06, hold: 1.0, release: 0.35, peak: 0.12 - i * 0.02, dest: lp });
  });
  lp.frequency.setValueAtTime(600, t0);
  lp.frequency.linearRampToValueAtTime(1600, t0 + 0.25);
  synthCrowdSwell(2.4);
}

// ------------------------------------------------------------------ public API (real recordings first)
const CLICKS = ['click_a', 'click_b', 'select_a', 'select_b'];
const WHOOSHES = ['whoosh_a', 'whoosh_b'];
const RIPS = ['rip_a', 'rip_b'];

export function click() { if (!play(nextOf('click', CLICKS), { gain: 0.7 })) synthClick(); }
export function whoosh() { if (!play(nextOf('whoosh', WHOOSHES), { gain: 0.8 })) synthWhoosh(); }
export function rip() {
  if (!play(nextOf('rip', RIPS), { gain: 1 })) synthRip();
  else play('pack_out', { gain: 0.5, delay: 0.05 });
}
export function place() { play(nextOf('place', ['place_a', 'place_b']), { gain: 0.8 }); }
export function shuffle() { play('shuffle', { gain: 0.8 }); }
export function confirm() { if (!play('confirm_a', { gain: 0.7 })) synthClick(); }
export function error() { if (!play('error', { gain: 0.6 })) synthClick(); }
export function applause(gain = 0.8, delay = 0) { play('applause', { gain, delay }); }
export function cheer(gain = 0.9) { return play('crowd_roar', { gain }); } // real supporters recording only
export function kick(hard = false) { play(hard ? 'kick_b' : 'kick_a', { gain: hard ? 0.9 : 0.7 }); }
export function post() { play('post', { gain: 0.9 }); }
export function tackle() { play('tackle', { gain: 0.6 }); }

/** Pack reveal: a card laid down, plus brighter layers as the rarity rises. */
export function reveal(rarity = 'bronze') {
  const ok = play(rarity === 'bronze' ? 'place_a' : 'place_b', { gain: 0.9 });
  if (!ok) { synthReveal(rarity); return; }
  if (rarity === 'gold') play('sparkle', { gain: 0.5, delay: 0.05 });
  if (rarity === 'elite') { play('confirm_big', { gain: 0.8, delay: 0.05 }); play('sparkle', { gain: 0.6, delay: 0.1 }); }
  if (rarity === 'icon') {
    play('confirm_big', { gain: 0.9, delay: 0.05 });
    play('sparkle', { gain: 0.7, delay: 0.12 });
    play('bong', { gain: 0.5, delay: 0.2 });
  }
}

/** Crowd rising: the real cheering recording faded in and out over `duration` seconds. */
export function crowdSwell(duration = 2.2) {
  // Only a real supporters recording is used here. Without one this stays silent (no generated crowd noise).
  if (!samples.crowd_soft) return;
  const d = Math.min(Math.max(duration, 4.5), samples.crowd_soft.duration); // a swell needs a few seconds to read as a crowd
  play('crowd_soft', { gain: 0.5, fadeIn: d * 0.4, fadeOut: d * 0.5, dur: d });
}

/** Goal: the supporters' roar when a real recording is bundled, plus applause (no real horn recording available). */
export function goalHorn() {
  if (samples.crowd_roar) play('crowd_roar', { gain: 0.9, fadeIn: 0.15, fadeOut: 1.2, dur: Math.min(5, samples.crowd_roar.duration) });
  applause(0.45, 0.9);
}

/** Names of the recordings decoded so far (for tests). */
export const loaded = () => Object.keys(samples);

export const audio = { loaded, click, whoosh, rip, reveal, crowdSwell, goalHorn, confirm, error, place, shuffle, applause, cheer, kick, post, tackle, setMuted, isMuted, unlock };
export default audio;
