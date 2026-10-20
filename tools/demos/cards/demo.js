// Card + pack opening demo. Build:
//   node tools/build.js --demo tools/demos/cards/demo.js tools/demos/cards/out.html --css src/styles/tokens.css,src/styles/card.css,src/styles/holo.css
// URL flags:
//   ?pack=bronze|silver|gold|promo|all   open that mock pack on load ('all' = one card of each of the 5 rarities + 1 other)
//   ?anim=0|1|2                          animation level for tilt and pack opening
//   ?manual=1                            pause GSAP's clock; drive it with window.__demo.step(ms)
//   ?pose=1                              pose every foil card at an angle (screenshot of the holo without a pointer)
// window.__demo = { step(ms), openPack(type), ui (current pack handle), cards, manual() }
// Mock data is generated here with the seeded rng. All names are invented.

import { cardEl, updateCard, attachTilt, setTilt, promoteCard } from '../../../src/ui/components/card.js';
import { avatarSVG } from '../../../src/ui/components/avatar.js';
import { crestSVG, makeCrest, CREST_SHAPES, CREST_EMBLEMS, CREST_PATTERNS } from '../../../src/ui/components/crest.js';
import { openPackUI } from '../../../src/ui/packOpening.js';
import * as audio from '../../../src/ui/audio.js';
import { rngFrom } from '../../../src/logic/rng.js';
import { OVR_WEIGHTS, GK_WEIGHTS, STAT_LABELS } from '../../../src/balance.js';
import { computeOvr } from '../../../src/logic/cards.js';

const params = new URLSearchParams(location.search);
const ANIM = params.has('anim') ? Number(params.get('anim')) : 2;
// An explicit level (URL or the select below) overrides prefers-reduced-motion, like a settings choice would.
let respectRM = !params.has('anim');
const rng = rngFrom('cards-demo');

// ------------------------------------------------------------------ manual clock
let manual = false;
let vt = 0;
function enableManual() {
  if (manual) return;
  manual = true;
  vt = gsap.ticker.time;
  gsap.ticker.remove(gsap.updateRoot);
}
function step(ms) {
  enableManual();
  let left = ms;
  while (left > 0) {
    const dt = Math.min(16, left);
    vt += dt / 1000;
    gsap.updateRoot(vt);
    left -= dt;
  }
  return vt;
}
if (params.get('manual') === '1') enableManual();

// ------------------------------------------------------------------ mock world bits
const NATIONS = [
  { code: 'FRA', flag: '\u{1F1EB}\u{1F1F7}', name: 'France', colours: ['#0055a4', '#ffffff', '#ef4135'] },
  { code: 'ESP', flag: '\u{1F1EA}\u{1F1F8}', name: 'Spain', colours: ['#aa151b', '#f1bf00', '#aa151b'] },
  { code: 'ITA', flag: '\u{1F1EE}\u{1F1F9}', name: 'Italy', colours: ['#009246', '#ffffff', '#ce2b37'] },
  { code: 'GER', flag: '\u{1F1E9}\u{1F1EA}', name: 'Germany', colours: ['#000000', '#dd0000', '#ffce00'] },
  { code: 'ENG', flag: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}', name: 'England', colours: ['#ffffff', '#ce1124', '#ffffff'] },
  { code: 'BRA', flag: '\u{1F1E7}\u{1F1F7}', name: 'Brazil', colours: ['#009c3b', '#ffdf00', '#009c3b'] },
  { code: 'ARG', flag: '\u{1F1E6}\u{1F1F7}', name: 'Argentina', colours: ['#74acdf', '#ffffff', '#74acdf'] },
  { code: 'SEN', flag: '\u{1F1F8}\u{1F1F3}', name: 'Senegal', colours: ['#00853f', '#fdef42', '#e31b23'] },
  { code: 'NGA', flag: '\u{1F1F3}\u{1F1EC}', name: 'Nigeria', colours: ['#008751', '#ffffff', '#008751'] },
  { code: 'JPN', flag: '\u{1F1EF}\u{1F1F5}', name: 'Japan', colours: ['#ffffff', '#bc002d', '#ffffff'] },
  { code: 'NED', flag: '\u{1F1F3}\u{1F1F1}', name: 'Netherlands', colours: ['#ae1c28', '#ffffff', '#21468b'] },
  { code: 'POR', flag: '\u{1F1F5}\u{1F1F9}', name: 'Portugal', colours: ['#006600', '#ff0000', '#ff0000'] },
  { code: 'MAR', flag: '\u{1F1F2}\u{1F1E6}', name: 'Morocco', colours: ['#c1272d', '#006233', '#c1272d'] },
  { code: 'KOR', flag: '\u{1F1F0}\u{1F1F7}', name: 'Korea Republic', colours: ['#ffffff', '#cd2e3a', '#0047a0'] },
  { code: 'SWE', flag: '\u{1F1F8}\u{1F1EA}', name: 'Sweden', colours: ['#006aa7', '#fecc00', '#006aa7'] },
  { code: 'CIV', flag: '\u{1F1E8}\u{1F1EE}', name: "Cote d'Ivoire", colours: ['#f77f00', '#ffffff', '#009e60'] },
];
const CLUBS = [
  ['Ashmoor Rovers', ['#0b3d91', '#ffffff'], 'AR'], ['Velmont City', ['#7a1f2b', '#d4af37'], 'VC'],
  ['Corvera CF', ['#1f7a3a', '#ffffff'], 'CCF'], ['Dunhallow Town', ['#111318', '#f2c200'], 'DT'],
  ['Saint-Lirac FC', ['#00a3e0', '#ffffff'], 'SLF'], ['Nordhafen SV', ['#c8102e', '#ffffff'], 'NSV'],
  ['Brennick Albion', ['#6a1b9a', '#ffffff'], 'BA'], ['Costa Varela', ['#e35205', '#14161c'], 'CV'],
].map(([name, colours, initials], i) => ({ name, colours, initials, crest: { ...makeCrest(rngFrom('club' + i), colours), initials: undefined } }));

const FIRST = ['Marco', 'Teo', 'Ilyas', 'Jonah', 'Dario', 'Kofi', 'Ren', 'Luca', 'Mateus', 'Oskar', 'Amadou', 'Yuto', 'Bastien', 'Rafa', 'Nils', 'Sami', 'Tiago', 'Emeka', 'Hugo', 'Alvar'];
const SYL_A = ['Bel', 'Cor', 'Dra', 'Fen', 'Gal', 'Har', 'Ivo', 'Kal', 'Lor', 'Mar', 'Nor', 'Ost', 'Per', 'Quin', 'Ros', 'Sar', 'Tor', 'Val', 'Wes', 'Zan'];
const SYL_B = ['ani', 'ero', 'ville', 'stad', 'ondo', 'aku', 'enne', 'ic','iro', 'mann', 'ford', 'elli', 'ou', 'ada', 'sen', 'ez'];
const fakeName = (r) => `${r.pick(FIRST)} ${r.pick(SYL_A)}${r.pick(SYL_B)}`;

function mockStats(r, pos, target) {
  const keys = pos === 'GK' ? Object.keys(GK_WEIGHTS) : Object.keys(OVR_WEIGHTS.ST);
  const w = pos === 'GK' ? GK_WEIGHTS : OVR_WEIGHTS[pos];
  const s = {};
  for (const k of keys) s[k] = Math.max(20, Math.min(99, Math.round(target + (w[k] - 0.14) * 70 + r.int(-6, 6))));
  // nudge toward target OVR
  for (let i = 0; i < 6; i++) {
    const o = computeOvr(s, pos);
    if (o === target) break;
    for (const k of keys) if (w[k] > 0.1) s[k] = Math.max(20, Math.min(99, s[k] + Math.sign(target - o)));
  }
  return s;
}

const RANGE = { bronze: [52, 64], silver: [65, 74], gold: [75, 84], elite: [85, 91], icon: [89, 95] };
const STYLES = ['Poacher', 'Target man', 'Box-to-box', 'Anchor', 'Inverted winger', 'Ball-playing defender'];
const TRAITS = ['Finisher', 'Long shots', 'Playmaker', 'Ball winner', 'Engine', 'Pace merchant', 'Leader', 'Clutch', 'Aerial threat'];

function mockPlayer(rarity, seed, overIn = {}) {
  const { nation: natOver, ...over } = overIn;
  const r = rngFrom('p:' + seed);
  const pos = over.pos || r.pick(['ST', 'W', 'AM', 'CM', 'DM', 'FB', 'CB', 'GK']);
  const ovr = over.ovr || r.int(...RANGE[rarity]);
  const nat = natOver || r.pick(NATIONS);
  const club = r.pick(CLUBS);
  const stats = mockStats(r, pos, ovr);
  const slots = { bronze: 1, silver: 2, gold: 3, elite: 3, icon: 0 }[rarity];
  return {
    kind: 'player', id: 'p' + seed, rarity, ovr, pos, name: over.name || fakeName(r),
    nation: nat.code, flag: nat.flag, nationColours: nat.colours, nationName: nat.name,
    crest: club.crest, clubName: rarity === 'icon' ? 'Legends' : club.name,
    age: rarity === 'icon' ? 30 : r.int(18, 34), stats, avatarSeed: seed, kitColour: club.colours[0], kitColour2: club.colours[1],
    traits: r.chance(0.6) ? [r.pick(TRAITS)] : [], styleLabel: r.chance(0.7) ? r.pick(STYLES) : null,
    upgradeSlots: slots, upgradesUsed: Math.min(slots, r.int(0, 2)),
    status: { fitness: r.int(55, 100), chem: r.int(0, 3) },
    isIcon: rarity === 'icon',
    ...over,
  };
}

function mockOthers() {
  return [
    { kind: 'manager', rarity: 'gold', name: 'Elio Brandvik', title: 'Elio Brandvik', nation: 'SWE', flag: NATIONS[14].flag, nationColours: NATIONS[14].colours, avatarSeed: 'mgr1', age: 52, value: '4-3-3', styleLabel: 'High press', text: '+ youth growth. Chemistry bonus: Sweden' },
    { kind: 'staff', rarity: 'silver', role: 'physio', level: 2, text: 'Injuries 25% rarer and 1 match shorter' },
    { kind: 'training', rarity: 'elite', title: 'Pace drill', value: '+3 PAC', text: 'Permanent. Raises potential by the same amount' },
    { kind: 'trait', rarity: 'gold', title: 'Ball winner', text: 'More tackles won in midfield. DM, CM, CB' },
    { kind: 'style', rarity: 'bronze', title: 'Inverted winger', value: 'W', text: 'DRI +4, SHO +3, PAS +2 at full chemistry' },
    { kind: 'tactic', rarity: 'silver', title: 'Counter-attack', text: 'Big-chance share +6 points while deep or leading' },
    { kind: 'consumable', rarity: 'bronze', title: 'Ice bath', icon: 'fitnessDrink', value: '+30', text: 'Restores fitness for one player' },
    { kind: 'club', rarity: 'gold', title: 'Stadium tier 3', icon: 'stadium', text: 'Gate income +50 per match, home advantage up' },
    { kind: 'position', rarity: 'silver', title: 'Retrain: FB', value: 'CB > FB', text: 'Adds FB as a secondary position after 4 matches' },
    { kind: 'staff', rarity: 'icon', role: 'scout', level: 3, text: 'Reveals potential. Better odds for one region' },
    { kind: 'club', rarity: 'elite', title: 'Club crest', crest: CLUBS[1].crest, text: 'Velmont City' },
  ];
}

const PLAYERS = {
  bronze: mockPlayer('bronze', 11, { pos: 'CB', nation: NATIONS[4] }),
  silver: mockPlayer('silver', 22, { pos: 'W', nation: NATIONS[7] }),
  gold: mockPlayer('gold', 33, { pos: 'ST', nation: NATIONS[5], statDeltas: { sho: 2, pac: -1 } }),
  elite: mockPlayer('elite', 44, { pos: 'AM', nation: NATIONS[0] }),
  icon: mockPlayer('icon', 55, { pos: 'ST', nation: NATIONS[6] }),
};
const GK = mockPlayer('gold', 66, { pos: 'GK', nation: NATIONS[3] });

function mockPack(type) {
  const p = (r, s) => mockPlayer(r, 'pk' + type + s);
  const o = mockOthers();
  if (type === 'bronze') return { type, cards: [p('bronze', 1), p('silver', 2), p('bronze', 3), o[6], o[4]] };
  if (type === 'silver') return { type, cards: [p('silver', 1), p('bronze', 2), p('gold', 3), o[5], o[1]] };
  if (type === 'gold') return { type, cards: [p('gold', 1), p('silver', 2), p('gold', 3), o[3], o[7], o[0]] };
  if (type === 'promo') return { type, cards: [p('gold', 1), p('elite', 2), p('icon', 3), p('gold', 4), o[2], o[9]] };
  // all five rarities + one other card
  return { type: 'promo', cards: [p('bronze', 1), p('silver', 2), p('gold', 3), p('elite', 4), p('icon', 5), o[2]] };
}

// ------------------------------------------------------------------ page
const css = `
:root { --card-w: 200px; }
body { padding: 0 0 60px; }
.dm-head { position: sticky; top: 0; z-index: 10; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 12px 16px; background: rgba(7,9,15,.92); backdrop-filter: blur(6px); border-bottom: 1px solid var(--line); }
.dm-head h1 { font: 800 18px var(--font-display); letter-spacing: .12em; text-transform: uppercase; margin: 0 12px 0 0; }
.dm-head button, .dm-head select { background: var(--bg-3); border: 1px solid var(--line); color: var(--text); border-radius: 8px; padding: 7px 12px; font-size: 13px; }
.dm-head button.main { background: var(--accent); border-color: transparent; font-weight: 700; }
section { padding: 18px 16px 8px; }
section h2 { font: 700 13px var(--font-ui); letter-spacing: .14em; text-transform: uppercase; color: var(--text-dim); margin: 0 0 14px; }
.row { display: flex; flex-wrap: wrap; gap: 18px 16px; align-items: flex-start; }
.row.mini { gap: 34px 14px; padding-bottom: 18px; }
.cell { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.cell small { color: var(--text-dim); font-size: 11px; }
.pitchy { background: radial-gradient(ellipse at 50% 30%, #1f5a33, #0d2a18); border-radius: 12px; padding: 18px 16px 30px; }
.av { width: 72px; height: 72px; border-radius: 12px; background: linear-gradient(180deg, #2a3656, #141b2e); overflow: hidden; }
.cr { width: 64px; height: 64px; }
.live { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; }
.live .btns { display: flex; flex-direction: column; gap: 8px; }
.live button { background: var(--bg-3); border: 1px solid var(--line); color: var(--text); border-radius: 8px; padding: 8px 12px; }
@media (max-width: 480px) { :root { --card-w: 160px; --card-w-mini: 76px; } .row { gap: 14px 10px; } .dm-head { position: static; } }
`;
document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);
const root = document.getElementById('root');
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

const head = el('div', 'dm-head');
head.innerHTML = `<h1>Touchline cards</h1>
  <button class="main" data-pack="all">Open pack: all 5 rarities</button>
  <button data-pack="bronze">Bronze pack</button><button data-pack="silver">Silver pack</button>
  <button data-pack="gold">Gold pack</button><button data-pack="promo">Promo pack</button>
  <select id="anim"><option value="2">Anim: full</option><option value="1">Anim: reduced</option><option value="0">Anim: off</option></select>
  <button id="mute">Sound: on</button>`;
root.appendChild(head);
head.querySelector('#anim').value = String(ANIM);
let animLevel = ANIM;
head.querySelector('#anim').addEventListener('change', (e) => {
  animLevel = Number(e.target.value);
  respectRM = false;
  allCards.forEach((c) => { if (c.__tcDetach) c.__tcDetach(); attachTilt(c, { animLevel, respectReducedMotion: false }); });
});
head.querySelector('#mute').addEventListener('click', (e) => { audio.setMuted(!audio.isMuted()); e.target.textContent = 'Sound: ' + (audio.isMuted() ? 'off' : 'on'); });
head.querySelectorAll('[data-pack]').forEach((b) => b.addEventListener('click', () => openPack(b.dataset.pack)));

const allCards = [];
function section(title) { const s = el('section'); s.appendChild(el('h2', '', title)); root.appendChild(s); return s; }
function add(row, data, size, label) {
  const c = cardEl(data, { size });
  allCards.push(c);
  attachTilt(c, { animLevel, respectReducedMotion: respectRM });
  const cell = el('div', 'cell');
  cell.appendChild(c);
  if (label) cell.appendChild(el('small', '', label));
  row.appendChild(cell);
  return c;
}

// (a) players, full
let s = section('Players - full size');
let row = el('div', 'row'); s.appendChild(row);
for (const r of ['bronze', 'silver', 'gold', 'elite', 'icon']) add(row, PLAYERS[r], 'full', r);
add(row, GK, 'full', 'gold GK');

// mini on a pitch strip with every status
s = section('Players - mini (pitch / bench)');
row = el('div', 'row mini pitchy'); s.appendChild(row);
const statusSets = [
  { fitness: 96, chem: 3 },
  { fitness: 64, chem: 2, contractLow: true },
  { fitness: 88, chem: 1, outOfPos: 1 },
  { fitness: 41, chem: 0, injured: true },
  { fitness: 99, chem: 3, suspended: true },
  { fitness: 72, chem: 2, outOfPos: 2 },
];
['bronze', 'silver', 'gold', 'elite', 'icon'].forEach((r, i) => add(row, { ...PLAYERS[r], styleLabel: PLAYERS[r].styleLabel || 'Anchor', status: statusSets[i] }, 'mini'));
add(row, { ...GK, styleLabel: 'Sweeper', status: statusSets[5] }, 'mini');

// thumbs
s = section('Thumbnails - rarity from frame shape and colour');
row = el('div', 'row'); s.appendChild(row);
for (const r of ['bronze', 'silver', 'gold', 'elite', 'icon']) add(row, PLAYERS[r], 'thumb', r);
for (const r of ['bronze', 'silver', 'gold', 'elite', 'icon']) add(row, mockPlayer(r, 'th' + r), 'thumb', r);

// other kinds
const others = mockOthers();
s = section('Other card types - full');
row = el('div', 'row'); s.appendChild(row);
others.forEach((o) => add(row, o, 'full', `${o.kind} / ${o.rarity}`));
s = section('Other card types - mini and thumb');
row = el('div', 'row'); s.appendChild(row);
others.forEach((o) => add(row, o, 'mini'));
row = el('div', 'row'); row.style.marginTop = '14px'; s.appendChild(row);
others.forEach((o) => add(row, o, 'thumb'));

// live updates
s = section('Live updates - updateCard tick-up and promoteCard');
const live = el('div', 'live'); s.appendChild(live);
const liveData = mockPlayer('bronze', 'live', { pos: 'CM', ovr: 63, nation: NATIONS[11] });
const liveCard = cardEl(liveData, { size: 'full' });
live.appendChild(liveCard);
const btns = el('div', 'btns'); live.appendChild(btns);
const bTick = el('button', '', 'Training +2 PAS (updateCard)');
const bPromote = el('button', '', 'Promote to next rarity');
btns.append(bTick, bPromote);
const ORDER = ['bronze', 'silver', 'gold', 'elite'];
bTick.addEventListener('click', () => {
  const d = liveCard.__tc.data;
  const stats = { ...d.stats, pas: Math.min(99, d.stats.pas + 2) };
  updateCard(liveCard, { stats, statDeltas: { pas: 2 }, ovr: computeOvr(stats, d.pos), upgradesUsed: Math.min(d.upgradeSlots, (d.upgradesUsed || 0) + 1) });
});
bPromote.addEventListener('click', () => {
  const d = liveCard.__tc.data;
  const i = ORDER.indexOf(d.rarity);
  const to = ORDER[(i + 1) % ORDER.length];
  const ovr = { bronze: 63, silver: 70, gold: 80, elite: 87 }[to];
  promoteCard(liveCard, d.rarity, to, { respectReducedMotion: respectRM });
  gsap.delayedCall(0.4, () => updateCard(liveCard, { ovr, upgradeSlots: { bronze: 1, silver: 2, gold: 3, elite: 3 }[to] }));
});

// avatars and crests
s = section('Avatars - 32 seeds across nations, keepers in keeper kits');
row = el('div', 'row'); s.appendChild(row);
for (let i = 0; i < 32; i++) {
  const n = NATIONS[i % NATIONS.length];
  const a = el('div', 'av', avatarSVG({ seed: 1000 + i, kitColour: CLUBS[i % CLUBS.length].colours[0], kitColour2: CLUBS[i % CLUBS.length].colours[1], pos: i % 8 === 7 ? 'GK' : 'CM', nation: n.code, age: 18 + (i * 7) % 20 }));
  a.title = n.code;
  row.appendChild(a);
}
s = section(`Crests - ${CREST_SHAPES.length} shapes, ${CREST_EMBLEMS.length} emblems, ${CREST_PATTERNS.length} patterns`);
row = el('div', 'row'); s.appendChild(row);
for (let i = 0; i < 27; i++) {
  const c = makeCrest(rngFrom('crest' + i));
  c.shape = CREST_SHAPES[i % CREST_SHAPES.length];
  c.emblem = CREST_EMBLEMS[i % CREST_EMBLEMS.length];
  row.appendChild(el('div', 'cr', crestSVG({ ...c, initials: i % 4 === 0 ? 'FC' + String.fromCharCode(65 + i % 26) : '' })));
}

if (params.get('pose') === '1') {
  allCards.forEach((c, i) => setTilt(c, 0.25 + ((i * 37) % 50) / 100, 0.3, 0.6));
}

// ------------------------------------------------------------------ pack
let current = null;
function openPack(type) {
  const pack = mockPack(type);
  current = openPackUI(document.body, pack, { animLevel, audio, respectReducedMotion: respectRM });
  window.__demo.ui = current.ui;
  current.then((res) => { console.log('pack closed', JSON.stringify(res)); window.__demo.lastResult = res; });
  return current.ui;
}

window.__demo = { step, openPack, ui: null, cards: allCards, manual: enableManual, statLabels: STAT_LABELS, rng };
if (params.get('pack')) openPack(params.get('pack'));
