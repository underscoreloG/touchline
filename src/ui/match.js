// 2D top-down match view: HUD + pitch canvas + animation loop. Self-contained module.
//
//   const view = mountMatchView(root, {
//     home, away,               MatchTeam (required for a log replay; taken from match.home.team / match.away.team when live)
//     match,                    live engine match from createMatch(); the view pulls ticks (stepTick) as the animation needs them
//     log,                      pre-recorded MatchEvent[] (replay); used when no match is given
//     seed, speed (1|2|4), highlights (default true), settings (view settings, reserved),
//     manual,                   true: requestAnimationFrame only renders, time moves only through step(ms)
//     onEvent(ev), onKeyMoment(prompt) -> Promise<decision|value>, onFinish(result),
//     onOpenTactics(view), onOpenOpponent(view), onOpenSettings(view),
//   });
//   view = { destroy(), pause(), resume(), setSpeed(1|2|4), setHighlights(bool), step(ms), state(), decide(decision) }
//
// Rules: the engine is the single source of truth. The view never changes a result: it only reads events and
// forwards the manager's decisions (applyDecision). Key-moment prompts pause the animation until resolved.
// Time: rAF deltas x speed and window.__game.step(ms) x speed both advance the choreography clock.

import { stepTick, applyDecision, summarise } from '../logic/matchEngine.js';
import * as C from '../logic/choreography.js';
import { createPitch } from './components/pitch.js';
import { crestSVG } from './components/crest.js';
import { S } from '../strings.js';

const TXT = {
  pause: S.match.pause, resume: S.match.resume, highlights: S.match.highlights, fullTime: S.match.fullTime, halfTime: S.match.halfTime,
  tactics: S.nav.tactics, settings: S.nav.settings, opponent: S.match.opponent, speed: S.match.speed, keyMoment: S.match.keyMoment,
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const initialsOf = (name) => String(name || '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3);
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : 0);

/** Map a prompt answer (decision object or plain value) to an engine decision. */
function toDecision(prompt, answer) {
  if (answer && typeof answer === 'object' && answer.type) return answer;
  const v = answer ?? prompt.defaultId;
  switch (prompt.type) {
    case 'penaltyTaker': return v != null ? { type: 'penaltyTaker', team: prompt.team, playerId: v } : null;
    case 'injurySub': return v != null ? { type: 'sub', team: prompt.team, outId: prompt.outId, inId: v } : null;
    case 'halftimeTalk': return { type: 'teamTalk', team: prompt.team, value: v || 'none' };
    case 'lateGame': return { type: 'lateGame', team: prompt.team, value: v || 'keep' };
    default: return null;
  }
}

function minutePct(ev) {
  const half = ev.half || (ev.minute > 45 ? 2 : 1);
  const inHalf = Math.min(45, (ev.minute ?? 0) - (half - 1) * 45) + Math.min(4, (ev.addedMin || 0) * 0.3);
  return Math.max(0, Math.min(100, ((half - 1) * 45 + inHalf) / 90 * 100));
}

export function mountMatchView(root, opts = {}) {
  const o = { speed: 1, highlights: true, seed: 1, ...opts };
  const live = !!o.match;
  const match = o.match || null;
  const home = o.home || (match && match.home.team);
  const away = o.away || (match && match.away.team);
  if (!home || !away) throw new Error('mountMatchView: home and away teams are required');
  let speed = [1, 2, 4].includes(o.speed) ? o.speed : 1;
  let highlights = o.highlights !== false;
  const ch = C.createChoreo({ home, away, seed: o.seed ?? (match ? match.seed : 1), highlights });
  const batches = live ? null : C.groupBatches(o.log || []);
  let bi = 0;
  let paused = false, blocked = false, finished = false, destroyed = false;
  let pendingPrompt = null, result = null;
  const perf = { frames: 0, scriptMs: 0, maxScriptMs: 0, last: [] };

  // ---------------------------------------------------------------- DOM
  const el = document.createElement('div');
  el.className = 'mv';
  const hk = home.colours || ['#2b6cff', '#ffffff'];
  const ak = away.colours || ['#e5484d', '#111111'];
  el.innerHTML = `
    <div class="mv-top">
      <div class="mv-clock"><span class="mv-time">0'</span><span class="mv-dots">${'<i></i>'.repeat(6)}</span></div>
      <div class="mv-side mv-home"><span class="mv-crest">${crestSVG({ ...(home.crest || {}), colours: home.crest && home.crest.colours ? home.crest.colours : hk, initials: initialsOf(home.name) })}</span><span class="mv-name">${esc(home.name)}</span></div>
      <div class="mv-score"><b class="mv-sh">0</b><b class="mv-sa">0</b></div>
      <div class="mv-side mv-away"><span class="mv-name">${esc(away.name)}</span><span class="mv-crest">${crestSVG({ ...(away.crest || {}), colours: away.crest && away.crest.colours ? away.crest.colours : ak, initials: initialsOf(away.name) })}</span></div>
      <button class="mv-btn mv-pause" type="button">${TXT.pause}</button>
    </div>
    <div class="mv-mom" aria-hidden="true"><div class="mv-mom-bar"><i class="mv-mom-home"></i><i class="mv-mom-away"></i></div><div class="mv-marks"></div></div>
    <div class="mv-pitch"><canvas></canvas><div class="mv-prompt" hidden></div></div>
    <div class="mv-comm" aria-live="polite"><span class="mv-comm-min"></span><span class="mv-comm-text"></span></div>
    <div class="mv-ctrl">
      <button class="mv-btn" data-a="opp" type="button">${TXT.opponent}</button>
      <button class="mv-btn" data-a="tac" type="button">${TXT.tactics}</button>
      <div class="mv-speed" role="group" aria-label="${TXT.speed}">
        <button class="mv-btn" data-s="1" type="button">x1</button><button class="mv-btn" data-s="2" type="button">x2</button><button class="mv-btn" data-s="4" type="button">x4</button>
      </div>
      <button class="mv-btn mv-hl" data-a="hl" type="button">${TXT.highlights}</button>
      <button class="mv-btn" data-a="set" type="button" aria-label="${TXT.settings}">${TXT.settings}</button>
    </div>`;
  const pitchEl = el.querySelector('.mv-pitch');
  const canvas = el.querySelector('canvas');
  const pitch = createPitch(canvas, { home, away });
  el.style.setProperty('--home', pitch.kits.home.fill);
  el.style.setProperty('--away', pitch.kits.away.fill);
  el.style.setProperty('--home-ink', pitch.kits.home.text);
  el.style.setProperty('--away-ink', pitch.kits.away.text);
  root.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const ui = {
    time: $('.mv-time'), dots: [...el.querySelectorAll('.mv-dots i')], sh: $('.mv-sh'), sa: $('.mv-sa'),
    pause: $('.mv-pause'), momHome: $('.mv-mom-home'), marks: $('.mv-marks'), comm: $('.mv-comm'),
    commText: $('.mv-comm-text'), commMin: $('.mv-comm-min'), prompt: $('.mv-prompt'), hl: $('.mv-hl'),
  };

  function layout() {
    const w = pitchEl.clientWidth || root.clientWidth || 800;
    // the whole view (top bar to control row) must fit in the viewport: the pitch takes what is left
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const top = Math.max(0, el.getBoundingClientRect().top + (typeof window !== 'undefined' ? window.scrollY : 0));
    let others = 0;
    for (const c of el.children) if (c !== pitchEl) others += c.offsetHeight;
    const gaps = 6 * (el.children.length - 1) + 8;
    const maxH = Math.max(140, vh - top - others - gaps);
    const h = Math.min(w * (78 / 116), maxH);
    pitch.resize(w, h);
    draw();
  }
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(() => layout()); ro.observe(pitchEl); }
  window.addEventListener('resize', layout);

  // ---------------------------------------------------------------- engine feed

  ch.onIdle = () => {
    if (blocked || finished || destroyed) return false;
    if (pendingPrompt) { startPrompt(); return false; }
    if (live) {
      if (match.phase === 'finished') { finish(); return false; }
      const evs = stepTick(match);
      C.pushBatch(ch, evs);
      if (evs.prompt) pendingPrompt = evs.prompt;
      return true;
    }
    if (bi >= batches.length) { finish(); return false; }
    C.pushBatch(ch, batches[bi++]);
    return true;
  };

  function startPrompt() {
    const prompt = pendingPrompt;
    blocked = true;
    const done = (answer) => {
      if (destroyed) return;
      pendingPrompt = null;
      const d = toDecision(prompt, answer);
      if (d && live) decide(d);
      ui.prompt.hidden = true;
      blocked = false;
    };
    if (typeof o.onKeyMoment === 'function') {
      ui.prompt.hidden = false;
      ui.prompt.textContent = TXT.keyMoment;
      let p;
      try { p = o.onKeyMoment(prompt); } catch (e) { p = null; }
      Promise.resolve(p).then(done, () => done(null));
    } else done(null);
  }

  function decide(d) {
    if (!live) return { ok: false, error: 'replay' };
    const res = applyDecision(match, d);
    if (res.ok) {
      for (const ev of res.events || []) { C.applyNow(ch, ev); if (o.onEvent) o.onEvent(ev); }
      if (d.type === 'mentality' || d.type === 'settings' || d.type === 'lateGame') {
        const side = match[d.team];
        C.setTeamSettings(ch, d.team, { ...side.settings, mentality: side.mentality || side.settings.mentality });
      }
    }
    return res;
  }

  function finish() {
    if (finished) return;
    finished = true;
    result = live ? summarise(match) : { score: { ...ch.score }, goals: ch.goals.slice(), events: o.log || [], finished: true };
    if (o.onFinish) o.onFinish(result);
  }

  // ---------------------------------------------------------------- cues -> HUD

  function addMark(ev, cls) {
    const m = document.createElement('i');
    m.className = `mv-mark ${cls} mv-${ev.team}`;
    m.style.left = minutePct(ev) + '%';
    ui.marks.appendChild(m);
  }

  function handleCues(cues) {
    for (const c of cues) {
      if (c.type === 'event') { if (o.onEvent) o.onEvent(c.ev); }
      else if (c.type === 'goal') {
        ui.sh.textContent = ch.score.home; ui.sa.textContent = ch.score.away;
        const box = c.goal.team === 'home' ? ui.sh : ui.sa;
        box.classList.remove('mv-pop'); void box.offsetWidth; box.classList.add('mv-pop');
        addMark(c.ev, 'mv-goal');
      } else if (c.type === 'card') addMark(c.ev, c.kind === 'red' ? 'mv-red' : 'mv-yellow');
      else if (c.type === 'fulltime') finish();
    }
  }

  // ---------------------------------------------------------------- loop

  let lastHud = '';
  function hud() {
    const label = C.clockLabel(ch);
    const ck = ch.clock;
    const elapsed = (ck.half - 1) * 45 + Math.min(45, ck.c);
    const key = `${label}|${ch.text}|${ch.textSide}|${Math.round(ch.momentum * 50)}|${elapsed | 0}`;
    if (key === lastHud) return;
    lastHud = key;
    ui.time.textContent = label;
    ui.dots.forEach((d, i) => { d.className = elapsed >= (i + 1) * 15 ? 'on' : elapsed >= i * 15 ? 'cur' : ''; });
    ui.commText.textContent = ch.text || '';
    ui.commMin.textContent = label;
    const side = ch.textSide || ch.poss;
    ui.comm.dataset.side = side || '';
    const share = Math.max(8, Math.min(92, 50 + ch.momentum * 42));
    ui.momHome.style.width = share + '%';
  }

  function draw() { pitch.render(ch, C.frameAlpha(ch)); hud(); }

  function advanceBy(dtReal) {
    if (paused || blocked || finished || destroyed) return;
    const cues = C.advance(ch, dtReal * speed);
    handleCues(cues);
  }

  let raf = 0, last = nowMs();
  function frame() {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    const t = nowMs();
    const dt = Math.min(0.1, Math.max(0, (t - last) / 1000));
    last = t;
    const s0 = nowMs();
    if (!o.manual) advanceBy(dt);
    draw();
    const ms = nowMs() - s0;
    perf.frames++; perf.scriptMs += ms; perf.maxScriptMs = Math.max(perf.maxScriptMs, ms);
    perf.last.push(ms); if (perf.last.length > 120) perf.last.shift();
  }

  // ---------------------------------------------------------------- controls

  function setSpeed(s) {
    speed = [1, 2, 4].includes(+s) ? +s : 1;
    el.querySelectorAll('.mv-speed .mv-btn').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.s === speed)));
  }
  function setHighlights(on) {
    highlights = !!on;
    C.setHighlights(ch, highlights);
    ui.hl.setAttribute('aria-pressed', String(highlights));
  }
  function pause() { paused = true; ui.pause.textContent = TXT.resume; ui.pause.setAttribute('aria-pressed', 'true'); }
  function resume() { paused = false; last = nowMs(); ui.pause.textContent = TXT.pause; ui.pause.setAttribute('aria-pressed', 'false'); }

  function onClick(e) {
    const b = e.target.closest('button');
    if (!b || !el.contains(b)) return;
    if (b === ui.pause) { if (paused) resume(); else pause(); return; }
    if (b.dataset.s) { setSpeed(b.dataset.s); return; }
    switch (b.dataset.a) {
      case 'hl': setHighlights(!highlights); break;
      case 'tac': if (o.onOpenTactics) o.onOpenTactics(handle); break;
      case 'opp': if (o.onOpenOpponent) o.onOpenOpponent(handle); break;
      case 'set': if (o.onOpenSettings) o.onOpenSettings(handle); break;
      default: break;
    }
  }
  el.addEventListener('click', onClick);

  const handle = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      el.removeEventListener('click', onClick);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', layout);
      pitch.destroy();
      el.remove();
      const G = typeof window !== 'undefined' ? window.__game : null;
      if (G) {
        if (G.step === stepHook) { if (prev.step) G.step = prev.step; else delete G.step; }
        if (G.matchView === handle) { if (prev.matchView) G.matchView = prev.matchView; else delete G.matchView; }
      }
    },
    pause, resume, setSpeed, setHighlights, decide,
    /** Advance the animation by ms of real time (x speed), then render. Works without requestAnimationFrame. */
    step(ms) {
      const n = Math.max(0, +ms || 0);
      // chunks keep the cue handling identical to a frame-by-frame run
      let left = n / 1000;
      while (left > 1e-9) { const d = Math.min(0.05, left); advanceBy(d); left -= d; }
      draw();
      return handle.state();
    },
    state() {
      const snap = C.snapshot(ch);
      const avg = perf.last.length ? perf.last.reduce((a, b) => a + b, 0) / perf.last.length : 0;
      return {
        ...snap, mode: live ? 'live' : 'replay', speed, highlights, paused, blocked, finished, prompt: pendingPrompt,
        result, perf: { frames: perf.frames, avgScriptMs: +avg.toFixed(3), maxScriptMs: +perf.maxScriptMs.toFixed(3) },
        disc: pitch.metrics(), engineScore: live ? { ...match.score } : null,
      };
    },
    /** For tests and the demo: the choreography state (read only). */
    _ch: ch,
  };

  // window.__game.step: register without clobbering other keys, restore on destroy
  const prev = {};
  const stepHook = (ms) => handle.step(ms);
  if (typeof window !== 'undefined') {
    const G = (window.__game = window.__game || {});
    prev.step = G.step; prev.matchView = G.matchView;
    G.step = stepHook;
    G.matchView = handle;
  }

  setSpeed(speed);
  setHighlights(highlights);
  layout();
  raf = requestAnimationFrame(frame);
  return handle;
}
