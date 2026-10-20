// 2D match view demo. Build:
//   node tools/build.js --demo tools/demos/match/demo.js tools/demos/match/out.html --css src/styles/tokens.css,src/styles/match.css --title "Match view demo"
// Open http://localhost:5400/tools/demos/match/out.html
// URL flags:
//   ?seed=2|6|42        which match (log mode replays tools/out/match-<seed>.json, live mode plays the engine)
//   ?mode=log|live      log replay (default) or live engine (key-moment prompts on, home side human)
//   ?speed=1|2|4        animation speed
//   ?highlights=0|1     highlights mode (default 1)
//   ?manual=1           requestAnimationFrame only renders; time moves only through window.__game.step(ms)
// window.__demo = { view, restart(seed, mode), seek(pred, maxSeconds) }

import { mountMatchView } from '../../../src/ui/match.js';
import { createMatch } from '../../../src/logic/matchEngine.js';
import { rngFrom, clamp } from '../../../src/logic/rng.js';
import { OVR_WEIGHTS, GK_WEIGHTS, OUTFIELD_STATS, GK_STATS } from '../../../src/balance.js';
import { computeOvr } from '../../../src/logic/cards.js';
import { FORMATIONS } from '../../../src/logic/formations.js';
import { makeCrest } from '../../../src/ui/components/crest.js';
import log2 from '../../out/match-2.json';
import log6 from '../../out/match-6.json';
import log42 from '../../out/match-42.json';

const LOGS = { 2: log2, 6: log6, 42: log42 };
const params = new URLSearchParams(location.search);
let seed = Number(params.get('seed')) || 2;
let mode = params.get('mode') === 'live' ? 'live' : 'log';
const speed = Number(params.get('speed')) || 1;
const highlights = params.get('highlights') !== '0';
const manual = params.get('manual') === '1';

// ------------------------------------------------------------------ synthetic teams for live mode (same recipe as tools/sim.js)
const SYL = ['ka', 'lo', 'mi', 'ren', 'to', 'sa', 'vel', 'dor', 'an', 'is', 'bru', 'ne', 'gal', 'tes', 'mon', 'ri', 'que', 'zan', 'pe', 'lu'];
function fakeName(rng) {
  const w = (n) => { let s = ''; for (let i = 0; i < n; i++) s += rng.pick(SYL); return s[0].toUpperCase() + s.slice(1); };
  return `${w(2)} ${w(rng.int(2, 3))}`;
}
function makePlayer(rng, id, pos, target) {
  const gk = pos === 'GK';
  const Wt = gk ? GK_WEIGHTS : OVR_WEIGHTS[pos];
  const keys = gk ? GK_STATS : OUTFIELD_STATS;
  const stats = {};
  for (const k of keys) stats[k] = target + 80 * (Wt[k] - 1 / 7) + rng.float(-6, 6);
  const ovr0 = keys.reduce((s, k) => s + stats[k] * Wt[k], 0);
  for (const k of keys) stats[k] = clamp(Math.round(stats[k] + target - ovr0 + 1), 1, 99);
  return { id, name: fakeName(rng), nation: 'XXX', number: 0, pos, nativePos: pos, stats, ovr: computeOvr(stats, pos), fitness: 100, morale: 50, form: 0, traits: [], styleId: null, injuryProne: rng.int(1, 20), consistency: rng.int(1, 20), chem: 1, yellows: 0 };
}
function makeTeam(s, o) {
  const rng = rngFrom(s);
  const formation = o.formation;
  const base = (s % 100000) * 100;
  const xi = FORMATIONS[formation].slots.map((sl, i) => { const p = makePlayer(rng, base + i + 1, sl.pos, o.rating + rng.float(-3, 3)); p.number = i + 1; return p; });
  const bench = ['GK', 'CB', 'FB', 'DM', 'CM', 'W', 'ST'].map((pos, i) => { const p = makePlayer(rng, base + 20 + i, pos, o.rating - 3); p.number = 12 + i; return p; });
  return {
    id: o.name, name: o.name, colours: o.colours, crest: makeCrest(rng, o.colours), formation, xi, bench,
    settings: o.settings, tacticCards: [], roles: { captain: xi[5].id, penalties: null, freeKicks: null, corners: null },
    staff: { fitness: 0, physio: 0, scout: 0, gk: 0, setPiece: 0, youth: 0, analyst: 0 }, chemistry: 18, isHome: o.isHome, isAI: o.isAI,
  };
}

function teamsFromLog(L) {
  const fix = (t, isHome) => ({
    ...t, crest: makeCrest(rngFrom(t.name), t.colours), isHome, isAI: true,
    xi: t.xi.map((p) => ({ ...p, nativePos: p.pos })), bench: t.bench.map((p) => ({ ...p, nativePos: p.pos })),
  });
  return { home: fix(L.home, true), away: fix(L.away, false) };
}

// ------------------------------------------------------------------ page
document.body.insertAdjacentHTML('afterbegin', `
<style>
  body { padding: 10px; }
  .demo-bar { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: center; margin: 0 auto 8px; max-width: 1180px; font-size: 13px; color: var(--text-dim); }
  .demo-bar button { background: var(--bg-2); border: 1px solid var(--line); border-radius: 7px; padding: 5px 10px; color: var(--text); }
  .demo-bar button[aria-pressed="true"] { background: var(--accent); border-color: transparent; }
  .demo-info { font: 12px/1.4 ui-monospace, Consolas, monospace; color: var(--text-dim); text-align: center; margin-top: 6px; min-height: 17px; }
  .demo-toast { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); background: var(--bg-3); color: var(--text); padding: 8px 14px; border-radius: 8px; font-size: 13px; box-shadow: 0 6px 20px rgba(0,0,0,.4); }
</style>
<div class="demo-bar">
  <span>Match</span><button data-seed="2">Seed 2</button><button data-seed="6">Seed 6</button><button data-seed="42">Seed 42</button>
  <span style="margin-left:8px">Source</span><button data-mode="log">Log replay</button><button data-mode="live">Live engine</button>
  <button data-act="restart">Restart</button>
</div>`);
const root = document.getElementById('root');
const info = document.createElement('div');
info.className = 'demo-info';
root.after(info);

let view = null;
let lastEvent = null;
function toast(text, ms = 1400) {
  const t = document.createElement('div');
  t.className = 'demo-toast'; t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

function start() {
  if (view) view.destroy();
  lastEvent = null;
  document.querySelectorAll('[data-seed]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.seed === seed)));
  document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  const common = {
    seed, speed, highlights, manual,
    onEvent: (ev) => { lastEvent = ev; },
    onFinish: (res) => { info.textContent = `Full time ${res.score.home}-${res.score.away}`; },
    onOpenTactics: () => toast('Tactics panel opens here (main session wires it)'),
    onOpenOpponent: () => toast('Opponent report opens here'),
    onOpenSettings: () => toast('Settings open here'),
  };
  if (mode === 'log') {
    const L = LOGS[seed] || LOGS[2];
    const t = teamsFromLog(L);
    view = mountMatchView(root, { ...common, home: t.home, away: t.away, log: L.events });
  } else {
    const home = makeTeam(seed * 2 + 1, { name: 'Northbridge', rating: 72, formation: '4-3-3', colours: ['#1f6feb', '#ffffff'], isHome: true, isAI: false, settings: { mentality: 'balanced', pressing: 'high', width: 'wide', passing: 'short', defLine: 'high' } });
    const away = makeTeam(seed * 2 + 2, { name: 'Lowmoor', rating: 70, formation: '4-2-3-1', colours: ['#d73a49', '#111111'], isHome: false, isAI: true, settings: { mentality: 'balanced', pressing: 'medium', width: 'balanced', passing: 'direct', defLine: 'normal' } });
    const match = createMatch(home, away, seed, { keyMoments: true, autoSubs: true });
    view = mountMatchView(root, {
      ...common, match,
      onKeyMoment: (prompt) => {
        if (manual) return Promise.resolve(null);
        toast(`Key moment: ${prompt.type} (default chosen)`, 1200);
        return new Promise((res) => setTimeout(() => res(null), 1200));
      },
    });
  }
  window.__demo.view = view;
}

window.__demo = {
  view: null,
  restart(s, m) { if (s) seed = s; if (m) mode = m; start(); return view.state(); },
  /** Step 100 ms at a time until an event matches pred (by type string or function). Returns the event. */
  seek(pred, maxSeconds = 600) {
    const test = typeof pred === 'function' ? pred : (e) => e.type === pred;
    lastEvent = null;
    for (let i = 0; i < maxSeconds * 10; i++) {
      view.step(100);
      if (lastEvent && test(lastEvent)) return { ev: lastEvent, state: view.state() };
      if (view.state().finished) return null;
    }
    return null;
  },
};

document.querySelector('.demo-bar').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.seed) seed = +b.dataset.seed;
  if (b.dataset.mode) mode = b.dataset.mode;
  start();
});

setInterval(() => {
  if (!view) return;
  const s = view.state();
  info.textContent = `${s.mode} seed ${seed}  ${s.clock}  ${s.score.home}-${s.score.away}${s.engineScore ? ` (engine ${s.engineScore.home}-${s.engineScore.away})` : ''}  ${s.highlights ? 'highlights' : 'full'} x${s.speed}  disc ${s.disc.discPx.toFixed(1)} px  script ${s.perf.avgScriptMs} ms avg / ${s.perf.maxScriptMs} max${s.finished ? '  FT' : ''}`;
}, 500);

start();
