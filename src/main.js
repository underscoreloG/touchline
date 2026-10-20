// Boot, router, state store, action dispatch. Game rules live in logic/, screens in ui/.

import { S } from './strings.js';
import { rngFrom } from './logic/rng.js';
import { World } from './logic/world.js';
import { generateWorld } from './logic/generator.js';
import { createState, startGame, playInstant, prepareMatch, applyMatchResult, newSeason, repairLineup, simRounds, simToSeasonEnd } from './logic/game.js';
import { openPack, buyPack } from './logic/economy.js';
import { simulate } from './logic/matchEngine.js';
import { GAME } from './balance.js';
import { squadActions } from './ui/squad.js';
import { mountSquad } from './ui/squad.js';
import { mountTactics } from './ui/tactics.js';
import { mountHub } from './ui/hub.js';
import { mountPacks } from './ui/packs.js';
import { mountLeague } from './ui/league.js';
import { mountStats } from './ui/stats.js';
import { mountMatchFlow } from './ui/matchFlow.js';
import { mountNewGame } from './ui/newgame.js';
import { openPackUI } from './ui/packOpening.js';
import { packView, cardView } from './ui/viewmodel.js';
import { crestSVG } from './ui/components/crest.js';
import audio from './ui/audio.js';
import { mountCheats, CHEAT_CSS } from './ui/cheats.js';
import * as cheats from './logic/cheats.js';

const SCREENS = {
  new: mountNewGame, hub: mountHub, squad: mountSquad, tactics: mountTactics, packs: mountPacks, league: mountLeague, stats: mountStats, match: mountMatchFlow,
};
const NAV = ['hub', 'squad', 'tactics', 'packs', 'league', 'stats'];

export const store = {
  state: null, world: null, rng: null, t: S, screen: 'new', cleanup: null, listeners: new Set(),
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit() { for (const fn of this.listeners) fn(); renderChrome(); },
  dispatch(type, payload = {}) { return dispatch(type, payload); },
};

// ------------------------------------------------------------------ settings (localStorage only)
function loadSettings() {
  try { return JSON.parse(localStorage.getItem('touchline.settings') || '{}'); } catch (e) { return {}; }
}
function saveSettings(s) {
  try { localStorage.setItem('touchline.settings', JSON.stringify(s)); } catch (e) { /* storage may be blocked */ }
}
const uiSettings = { sound: true, animation: 2, matchSpeed: 1, highlights: true, ...loadSettings() };
store.ui = uiSettings;
audio.setMuted(!uiSettings.sound);

// ------------------------------------------------------------------ world generation (worker with sync fallback)
export function generateWorldAsync(seed, size, onProgress) {
  return new Promise((resolve, reject) => {
    const src = document.getElementById('worker-src');
    if (src && typeof Worker !== 'undefined') {
      try {
        const url = URL.createObjectURL(new Blob([src.textContent], { type: 'text/javascript' }));
        const w = new Worker(url);
        w.onmessage = (e) => {
          const m = e.data;
          if (m.type === 'progress') onProgress && onProgress(m.p, m.label);
          else if (m.type === 'done') { w.terminate(); URL.revokeObjectURL(url); resolve(World.fromSnapshot(m.snapshot)); }
          else if (m.type === 'error') { w.terminate(); reject(new Error(m.message)); }
        };
        w.onerror = (e) => { w.terminate(); reject(new Error(e.message || 'worker failed')); };
        w.postMessage({ type: 'generate', seed, size });
        return;
      } catch (e) { /* fall through to the main thread */ }
    }
    setTimeout(() => {
      try { resolve(generateWorld(seed, size, onProgress)); } catch (e) { reject(e); }
    }, 20);
  });
}

// ------------------------------------------------------------------ dispatch
async function dispatch(type, payload) {
  const { state, world } = store;
  switch (type) {
    case 'nav': return go(payload.screen);
    case 'settings/set': {
      Object.assign(uiSettings, payload); saveSettings(uiSettings);
      if ('sound' in payload) audio.setMuted(!payload.sound);
      return store.emit();
    }
    case 'game/new': return newGame(payload);
    case 'pack/buy': {
      const rng = rngFrom((state.seed * 13 + state.counters.card * 7919 + state.counters.match) >>> 0);
      const r = buyPack(state, world, rng, payload.type);
      if (!r.ok) return { ok: false, error: r.error };
      store.emit();
      await showPack(r.pack);
      return r;
    }
    case 'match/instant': {
      const r = playInstant(state, world);
      store.emit();
      return r;
    }
    case 'match/applyResult': {
      const summary = applyMatchResult(state, world, payload.result, payload.prep);
      store.emit();
      return summary;
    }
    case 'season/next': {
      const r = newSeason(state, world);
      store.emit();
      return r;
    }
    case 'season/simRounds': {
      const r = simRounds(state, world, payload.n || 1);
      store.emit();
      return r;
    }
    case 'season/simToEnd': {
      const r = simToSeasonEnd(state, world);
      store.emit();
      return r;
    }
    case 'squad/setManager': {
      const card = state.cards.find((c) => c.id === payload.cardId && c.kind === 'manager');
      if (!card) return { ok: false, error: S.errors.notManagerCard };
      state.squad.managerId = card.id;
      store.emit();
      return { ok: true };
    }
    case 'cheat/coins': { const r = cheats.addCoins(state, payload.arg); store.emit(); return r; }
    case 'cheat/pack': case 'cheat/sign': case 'cheat/staff': {
      state.counters.cheat = (state.counters.cheat || 0) + 1;
      const rng = rngFrom((state.seed * 101 + state.counters.cheat * 7919 + state.counters.card) >>> 0);
      let r;
      if (type === 'cheat/pack') r = payload.arg === 'elite' ? cheats.freePack(state, world, rng, 'gold', { elite: true }) : cheats.freePack(state, world, rng, payload.arg);
      else if (type === 'cheat/sign') { const [rar, pos] = String(payload.arg).split(':'); r = cheats.signOne(state, world, rng, rar, pos); }
      else r = cheats.giveStaff(state, rng, payload.arg);
      store.emit();
      if (r.pack) await showPack(r.pack);
      return r;
    }
    case 'cheat/heal': { const r = cheats.healAll(state); store.emit(); return r; }
    case 'cheat/boost': { const r = cheats.setBoost(state, payload.arg); store.emit(); return r; }
    case 'cheat/play': { const r = cheats.playMatches(state, world, payload.arg); store.emit(); return r; }
    case 'cheat/finish': { const r = cheats.finishSeason(state, world); store.emit(); return r; }
    case 'cheat/next': { const r = cheats.nextSeason(state, world); store.emit(); return r; }
    case 'cheat/copy': {
      try { await navigator.clipboard.writeText(JSON.stringify(state)); return { ok: true, msg: 'Save JSON copied to the clipboard' }; } catch (e) { return { ok: false, msg: 'Clipboard blocked: use "Log state to console"' }; }
    }
    case 'cheat/log': { console.log('[cheat] state', state); return { ok: true, msg: 'Logged to the console' }; }
    case 'card/listForSale': return { ok: false, error: S.common.laterPhase };
    default: {
      const handler = squadActions && squadActions[type];
      if (handler) {
        const res = handler(state, payload, world, store.rng);
        if (type === 'card/quickSell' && res && res.ok) repairLineup(state, world);
        store.emit();
        return res;
      }
      console.warn('unknown action', type);
      return { ok: false, error: 'unknown action ' + type };
    }
  }
}

export function showPack(pack) {
  const root = document.getElementById('overlay');
  return openPackUI(root, packView(pack, store.world, store.state), { animLevel: uiSettings.animation, audio });
}

async function newGame(form) {
  const root = document.getElementById('screen');
  const bar = form.onProgress || (() => {});
  const world = await generateWorldAsync(form.seed, form.size, bar);
  store.world = world;
  const rng = rngFrom(form.seed);
  store.rng = rng;
  const state = createState({ seed: form.seed, worldSize: form.size, country: form.country, club: form.club, settings: uiSettings });
  store.state = state;
  const pack = startGame(state, world, rng);
  window.__game.state = state;
  go('hub');
  if (!form.skipPack) await showPack(pack);
  store.emit();
}

// ------------------------------------------------------------------ router and chrome
export function go(screen) {
  if (store.cleanup) { try { store.cleanup(); } catch (e) { console.error(e); } store.cleanup = null; }
  store.screen = screen;
  const root = document.getElementById('screen');
  root.innerHTML = '';
  root.dataset.screen = screen;
  renderChrome();
  const mount = SCREENS[screen];
  if (mount) store.cleanup = mount(root, store) || null;
}

function renderChrome() {
  const bar = document.getElementById('topbar');
  const nav = document.getElementById('nav');
  if (!store.state) { bar.hidden = true; nav.hidden = true; return; }
  bar.hidden = false; nav.hidden = store.screen === 'match';
  const s = store.state;
  bar.innerHTML = `
    <div class="tb-brand">${S.brand}</div>
    <div class="tb-club">${crestSVG({ ...s.club.crest, size: 28 })}<span>${esc(s.club.name)}</span></div>
    <div class="tb-spacer"></div>
    <div class="tb-coins" title="${S.hub.coins}"><span class="coin-dot"></span><span id="coin-val">${s.coins.toLocaleString('en-US')}</span></div>
    <button class="tb-btn" id="btn-sound" aria-label="${S.topbar.sound}">${uiSettings.sound ? S.topbar.soundOn : S.topbar.muted}</button>`;
  bar.querySelector('#btn-sound').onclick = () => dispatch('settings/set', { sound: !uiSettings.sound });
  nav.innerHTML = NAV.map((n) => `<button class="nav-btn ${store.screen === n ? 'on' : ''}" data-go="${n}">${S.nav[n]}</button>`).join('');
  nav.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => go(b.dataset.go); });
}

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ------------------------------------------------------------------ boot
function boot() {
  const app = document.getElementById('app');
  app.innerHTML = `<header id="topbar" hidden></header><nav id="nav" hidden></nav><main id="screen"></main><div id="overlay"></div>`;
  window.__game = window.__game || {};
  Object.defineProperties(window.__game, {
    store: { value: store, configurable: true },
    state: { get: () => store.state, configurable: true },
    world: { get: () => store.world, configurable: true },
  });
  Object.assign(window.__game, {
    // Headless hooks. None of them touches the live save: they work on throwaway copies.
    simulateMatch(seed) {
      const prep = prepareMatch(structuredClone(store.state), store.world);
      return prep && !prep.error ? simulate(prep.home, prep.away, seed ?? prep.seed, { ...GAME.engineOptions }) : null;
    },
    openPack(type, seed) {
      const world = World.fromSnapshot(store.world.snapshot({ copy: true }));
      return openPack(type, structuredClone(store.state), world, rngFrom(seed ?? 1));
    },
    simulateSeason(seed) {
      const world = generateWorld(seed ?? 7, 30000, null);
      const rng = rngFrom(seed ?? 7);
      const st = createState({ seed: seed ?? 7, worldSize: 30000, country: 'ENG', club: { name: 'Sim FC', colours: ['#c8102e', '#ffffff'], crest: {} } });
      startGame(st, world, rng);
      const r = simToSeasonEnd(st, world);
      return { matches: r.mine, summary: st.season.summary };
    },
    step(ms) { (window.__game._steppers || []).forEach((f) => f(ms)); },
    newGame: (form) => dispatch('game/new', form),
    go,
    audio,
  });
  const st = document.createElement('style');
  st.textContent = CHEAT_CSS;
  document.head.appendChild(st);
  mountCheats(store);
  go('new');
  const q = new URLSearchParams(location.search);
  if (q.has('bot')) runBot(q);
}

async function runBot(q) {
  const seed = Number(q.get('seed')) || 7;
  await dispatch('game/new', { skipPack: true, seed, size: Number(q.get('size')) || 30000, country: 'ENG', club: { name: 'Bot FC', colours: ['#c8102e', '#ffffff'], crest: { shape: 'shield', colours: ['#c8102e', '#ffffff'], emblem: 'star', pattern: 'plain', trim: '#ffffff', initials: 'BF' } } });
  // my matches instantly, the other 24 leagues and the playoffs simulated, up to the end of the season
  const r = simToSeasonEnd(store.state, store.world);
  store.emit();
  const sm = store.state.season.summary;
  console.log('[bot] season done', JSON.stringify({ ok: r.ok, matches: r.mine, rounds: r.rounds, level: sm && sm.level, position: sm && sm.position, newLevel: sm && sm.newLevel, coins: store.state.coins }));
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}
