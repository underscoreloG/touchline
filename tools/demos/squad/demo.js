// Squad + tactics demo on a real generated world. Build:
//   node tools/build.js --demo tools/demos/squad/demo.js tools/demos/squad/out.html --css src/styles/tokens.css,src/styles/card.css,src/styles/holo.css,src/styles/squad.css
// URL flags:
//   ?tab=squad|tactics     start tab (default squad)
//   ?formation=4-4-2       start formation
//   ?manual=1              pause GSAP's clock; drive it with window.__demo.step(ms)
//   ?state=messy           injure / tire a few starters and drop one into the wrong slot (to show status icons)
// window.__demo = { store, step(ms), tab(name), squad (screen api), dispatch }

import { generateWorld } from '../../../src/logic/generator.js';
import { openStarter, openPack } from '../../../src/logic/economy.js';
import { createState } from '../../../src/logic/game.js';
import { initialMembers, startPyramidSeason } from '../../../src/logic/pyramid.js';
import { rngFrom } from '../../../src/logic/rng.js';
import { autoBestXI, opponentReport } from '../../../src/logic/squad.js';
import { S } from '../../../src/strings.js';
import { mountSquad, squadActions } from '../../../src/ui/squad.js';
import { mountTactics } from '../../../src/ui/tactics.js';

const params = new URLSearchParams(location.search);

// ------------------------------------------------------------------ manual GSAP clock (the preview pane throttles rAF)
let manual = false;
let vt = 0;
function enableManual() {
  if (manual || !window.gsap) return;
  manual = true;
  vt = gsap.ticker.time;
  gsap.ticker.remove(gsap.updateRoot);
}
function step(ms) {
  enableManual();
  for (let left = ms; left > 0; left -= 16) { vt += Math.min(16, left) / 1000; gsap.updateRoot(vt); }
  return vt;
}
if (params.get('manual') === '1') enableManual();

// ------------------------------------------------------------------ real world + fresh state
const t0 = performance.now();
const world = generateWorld(7, 30000);
const state = createState({ seed: 7, worldSize: 30000, country: 'ENG', club: { name: 'Harbour Vale FC', colours: ['#c8102e', '#f4f4f4'], crest: { shape: 'shield', colours: ['#c8102e', '#f4f4f4'], emblem: 'star', pattern: 'plain', trim: '#ffffff', initials: 'HV' } } });
openStarter(state, world, rngFrom('demo-starter'));
openPack('silver', state, world, rngFrom('demo-silver')); // a few reserves beyond the 18 starters
openPack('gold', state, world, rngFrom('demo-gold'));
const mgr = state.cards.find((c) => c.kind === 'manager');
if (mgr) state.squad.managerId = mgr.id;
if (params.get('formation')) state.squad.formation = params.get('formation');
autoBestXI(state, world);
startPyramidSeason(state, initialMembers(state, world)); // league pyramid season 1 (my club in level 5)
// item cards so the detail panel and tactic slots have something to show (schemas: see logic/squad.js)
state.cards.push(
  { id: 'tc1', kind: 'tactic', tacticId: 'counterAttack', rarity: 'silver' },
  { id: 'tc2', kind: 'tactic', tacticId: 'offsideTrap', rarity: 'gold' },
  { id: 'tc3', kind: 'tactic', tacticId: 'setPieceRoutine', rarity: 'bronze' },
  { id: 'tc4', kind: 'tactic', tacticId: 'parkTheBus', rarity: 'bronze' },
  { id: 'it1', kind: 'training', title: 'Passing drill', stat: 'pas', amount: 2, rarity: 'silver' },
  { id: 'it2', kind: 'training', title: 'Gym block', amount: 1, rarity: 'bronze' },
  { id: 'it3', kind: 'trait', traitId: 'leader', rarity: 'gold' },
  { id: 'it4', kind: 'style', styleId: 'engine', rarity: 'bronze' },
  { id: 'it5', kind: 'consumable', title: 'Ice bath', effect: 'fitness', amount: 30, rarity: 'bronze' },
  { id: 'st1', kind: 'staff', role: 'analyst', name: 'Ilse Varga', rarity: 'silver', level: 2 },
);
if (params.get('state') === 'messy') {
  const byId = new Map(state.cards.map((c) => [c.id, c]));
  const xi = state.squad.xi;
  byId.get(xi[3]).fitness = 48;
  byId.get(xi[7]).injuredFor = 2;
  byId.get(xi[9]).contract = 2;
  byId.get(xi[5]).styleId = 'engine';
  byId.get(xi[1]).suspendedFor = 1;
  [xi[2], xi[9]] = [xi[9], xi[2]];
}
if (params.get('state') === 'linked') {
  // fake shared signing clubs / leagues so green and orange links are visible (a raw starter squad shares almost nothing)
  const byId = new Map(state.cards.map((c) => [c.id, c]));
  const xi = state.squad.xi;
  const club = byId.get(xi[0]).signedFromClubId;
  [0, 2, 3, 6].forEach((i) => { byId.get(xi[i]).signedFromClubId = club; byId.get(xi[i]).leagueId = 'ENG'; });
  [1, 4, 5, 7, 8].forEach((i) => { byId.get(xi[i]).leagueId = 'ENG'; });
}
const genMs =Math.round(performance.now() - t0);

// ------------------------------------------------------------------ tiny store (what main.js does, minus the router)
const listeners = new Set();
const leagueClub = world.clubsOf('ENG', 5)[1];
const store = {
  state, world, t: S,
  ctx: () => ({ opponent: leagueClub ? opponentReport(world, leagueClub.id) : null }),
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  dispatch(type, payload = {}) {
    const h = squadActions[type];
    if (!h) { console.info('[demo] action handled by main.js, not by the squad module:', type, JSON.stringify(payload)); return { ok: false, error: 'demo', message: `Demo: ${type} is wired in main.js` }; }
    const res = h(store.state, payload, store.world, rngFrom(1));
    if (res && res.ok) for (const fn of listeners) fn();
    window.__demo.last = { type, payload, res: res && { ok: res.ok, error: res.error, message: res.message } };
    return res;
  },
};

// ------------------------------------------------------------------ page
document.head.insertAdjacentHTML('beforeend', `<style>
  body { background: radial-gradient(ellipse at 50% -10%, #17213a, var(--bg-0) 60%); min-height: 100%; }
  .dm-top { display: flex; align-items: center; gap: 10px; padding: 10px 14px 0; max-width: 1400px; margin: 0 auto; }
  .dm-top h1 { margin: 0 12px 0 0; font: 800 18px var(--font-display); letter-spacing: .14em; text-transform: uppercase; }
  .dm-tab { background: transparent; border: 0; border-bottom: 2px solid transparent; color: var(--text-dim); padding: 8px 4px; font-weight: 700; font-size: 14px; }
  .dm-tab.on { color: #fff; border-color: var(--accent); }
  .dm-meta { margin-left: auto; color: var(--text-dim); font-size: 11px; }
  @media (max-width: 640px) { .dm-top h1 { display: none; } .dm-meta { display: none; } }
</style>`);
const root = document.getElementById('root');
root.innerHTML = `<div class="dm-top"><h1>Touchline</h1>
  <button class="dm-tab" data-tab="squad">${S.nav.squad}</button><button class="dm-tab" data-tab="tactics">${S.nav.tactics}</button>
  <span class="dm-meta">world 20,000 players, generated in ${genMs} ms</span></div><div id="screen"></div>`;
const screenRoot = document.getElementById('screen');
let cleanup = null;
let current = null;
function tab(name) {
  if (cleanup) cleanup();
  current = name;
  root.querySelectorAll('.dm-tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  cleanup = name === 'tactics' ? mountTactics(screenRoot, store) : mountSquad(screenRoot, store);
  window.__demo.squad = screenRoot.__squad || null;
  return current;
}
root.querySelectorAll('.dm-tab').forEach((b) => b.addEventListener('click', () => tab(b.dataset.tab)));

window.__demo = { store, step, tab, dispatch: (t, p) => store.dispatch(t, p), squad: null, last: null, manual: enableManual };
tab(params.get('tab') === 'tactics' ? 'tactics' : 'squad');
window.addEventListener('error', (e) => console.error('[demo] uncaught', e.message));
