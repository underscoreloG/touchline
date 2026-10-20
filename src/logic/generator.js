// World generation: generateWorld(seed, size, onProgress) -> World, plus makeRegen, makeClub, makeManager, makeStaff.
// Pure and deterministic: every random draw comes from rng.js streams derived from the seed.
//
// How OVR targets are produced (see PROMPT.md "The world" and "Ratings"):
//  1. Playable clubs (5 countries x 5 levels, sizes from LEAGUE_SYSTEM, 500 clubs, ids 0..499 ordered by country,
//     level, index): each club gets an XI target = level value (LEAGUE_SYSTEM.strengthByLevel) + a per-country
//     jitter in [-countryJitter, +countryJitter] + a ladder from -spread to +spread across the clubs of the level.
//     Squad members get role / age based offsets, then the whole squad is shifted until the best XI averages the
//     target. These OVRs are final.
//     Level 1 and 2 clubs also get "stars": a few starters well above the club level (the XI average is kept).
//  2. Background clubs and free agents get an intended ("latent") rating the same way (background club target by
//     nation tier, BACKGROUND_CLUB_STRENGTH, with a pyramid inside big nations; the 85+ left over after the
//     playable clubs are given to individual stars, mostly in tier-1 and tier-2 nations), then the latent ranking
//     is mapped onto the exact world OVR histogram minus what the playable clubs already hold. So the world
//     distribution (0.5% 85+, 6% 75-84, 24% 65-74) is hit exactly while tier-1 nations and strong clubs keep the
//     top. The mapping is rank based, so background club averages come out near the spec values for 50,000 and
//     100,000 players and drift down a few points at 20,000 (the playable clubs absorb more of the histogram).
//  3. Stats are built from (position, target OVR): high-weight stats are the best ones, +/- STAT_VARIATION
//     individual variation, then nudged until cards.js computeOvr equals the target exactly.
//  4. Potential = current + headroom per stat, by the years left before that stat group's window opens
//     (physical window -2, mental +2/+4) and by position weight. Past-peak players: potential = current and
//     peakOvr = current + the decline they already went through.

import {
  POSITIONS, STAT_VARIATION, LEAGUE_SYSTEM, BACKGROUND_CLUB_STRENGTH, WORLD, PEAK_WINDOW, DEV_TYPES,
  DEV_TYPE_SHARE, DEV, GROUP_WINDOW_SHIFT, STAT_GROUP, POTENTIAL_REGEN, REGEN, FORMATION_IDS, RARITY, GEN, STAFF,
} from '../balance.js';
import { S } from '../strings.js';
import { rngFrom, clamp } from './rng.js';
import { NATIONS, NATION_INDEX } from './nations.js';
import {
  CULTURE_IDS, pickNameIndices, nameFromIndices, makeClubName, makeBackgroundClubName, makeStadiumName,
  makeManagerName,
} from './names.js';
import { World, NO_CLUB, FLAG, WEIGHTS, POS_INDEX, ovrOfArray, bestXIOf, statKeysOfPos } from './world.js';

// Generator tuning (GEN) lives in balance.js; re-exported for tools that import it from here.
export { GEN };

// Histogram shape of the world OVR distribution (shares from WORLD.ovrShare; shape inside each band is ours).
function targetHistogram(n) {
  const H = new Float64Array(100);
  const geom = (lo, hi, ratio, share) => {
    let s = 0;
    for (let o = lo; o <= hi; o++) s += ratio ** (o - lo);
    for (let o = lo; o <= hi; o++) H[o] = (n * share * ratio ** (o - lo)) / s;
  };
  const sh = WORLD.ovrShare;
  geom(85, GEN.ovrMax, GEN.histRatio.elite, sh.elite85);
  geom(75, 84, GEN.histRatio.high, sh.high75to84);
  geom(65, 74, GEN.histRatio.mid, sh.mid65to74);
  const rest = 1 - sh.elite85 - sh.high75to84 - sh.mid65to74;
  let s = 0;
  const ramp = (o) => Math.min(o - GEN.lowRamp[0], GEN.lowRamp[1]);
  for (let o = GEN.lowRamp[0] + 1; o <= 64; o++) s += ramp(o);
  for (let o = GEN.lowRamp[0] + 1; o <= 64; o++) H[o] = (n * rest * ramp(o)) / s;
  return H;
}

/** Integer split of total by weights (largest remainder, deterministic). */
function splitInt(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  const out = new Int32Array(weights.length);
  if (sum <= 0 || total <= 0) return out;
  const frac = [];
  let used = 0;
  weights.forEach((w, i) => {
    const x = (total * w) / sum;
    out[i] = Math.floor(x);
    used += out[i];
    frac.push([x - out[i], i]);
  });
  frac.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; k < total - used; k++) out[frac[k % frac.length][1]]++;
  return out;
}

// ---------------------------------------------------------------- per-position tables
const P = POSITIONS.length;
const STAT_OFFSET = new Float64Array(P * 7);
const MAX_W = new Float64Array(P);
const HEAD_FACTOR = new Float64Array(P * 7);
const GROUP_IDX = new Uint8Array(P * 7); // 0 physical, 1 technical, 2 mental
const FIX_ORDER = [];
const GROUPS = ['physical', 'technical', 'mental'];
for (let p = 0; p < P; p++) {
  let mx = 0;
  for (let k = 0; k < 7; k++) mx = Math.max(mx, WEIGHTS[p * 7 + k]);
  MAX_W[p] = mx;
  const keys = statKeysOfPos(p);
  for (let k = 0; k < 7; k++) {
    const w = WEIGHTS[p * 7 + k];
    STAT_OFFSET[p * 7 + k] = w > 0 ? clamp(GEN.statOffset.k * Math.log(w / GEN.statOffset.ref), GEN.statOffset.lo, GEN.statOffset.hi) : 0;
    HEAD_FACTOR[p * 7 + k] = GEN.headroom.base + (GEN.headroom.slope * w) / mx;
    GROUP_IDX[p * 7 + k] = GROUPS.indexOf(STAT_GROUP[keys[k]]);
  }
  FIX_ORDER.push([0, 1, 2, 3, 4, 5, 6].filter((k) => WEIGHTS[p * 7 + k] > 0).sort((a, b) => WEIGHTS[p * 7 + b] - WEIGHTS[p * 7 + a] || a - b));
}
const DEV_SHARES = DEV_TYPES.map((d) => DEV_TYPE_SHARE[d]);
const MIX = POSITIONS.map((p) => WORLD.positionMix[p]);
const ROLE = { starter: 0, rotation: 1, backup: 2, youth: 3, fa: 4 };
const ROLE_KEYS = ['starter', 'rotation', 'backup', 'youth', 'fa'];
const ALT_NEIGHBOURS = {
  GK: [], CB: ['FB', 'DM'], FB: ['CB', 'W', 'DM'], DM: ['CM', 'CB'], CM: ['DM', 'AM'], AM: ['CM', 'W', 'ST'],
  W: ['AM', 'ST', 'FB'], ST: ['W', 'AM'],
};

/**
 * Stats for a position index hitting `target` OVR exactly (cards.js computeOvr). Writes 7 values into out.
 * High-weight stats come out highest; each stat gets +/- STAT_VARIATION individual variation.
 */
export function buildStats(rng, p, target, out) {
  const base = p * 7;
  let sumW = 0;
  const tmp = [0, 0, 0, 0, 0, 0, 0];
  for (let k = 0; k < 7; k++) {
    const w = WEIGHTS[base + k];
    const v = rng.int(-STAT_VARIATION, STAT_VARIATION);
    if (w === 0) out[k] = clamp(Math.round(target * GEN.zeroWeightStat[0] + GEN.zeroWeightStat[1] + v * GEN.zeroStatNoise), GEN.statMin, GEN.zeroStatMax);
    else { tmp[k] = target + STAT_OFFSET[base + k] + v; sumW += w * tmp[k]; }
  }
  const d = target - sumW;
  for (let k = 0; k < 7; k++) if (WEIGHTS[base + k] > 0) out[k] = clamp(Math.round(tmp[k] + d), GEN.statMin, GEN.statMax);
  fitOvr(p, target, out, null);
}

/** Nudge weighted stats by 1 until ovrOfArray(out, p) === target; values stay >= floor[k] (or GEN.statMin) and <= GEN.statMax. */
function fitOvr(p, target, out, floor) {
  const order = FIX_ORDER[p];
  let ovr = ovrOfArray(out, p);
  for (let it = 0; it < GEN.fitMaxIterations && ovr !== target; it++) {
    const dir = ovr < target ? 1 : -1;
    let moved = false;
    for (let j = 0; j < order.length; j++) {
      const k = order[(it + j) % order.length];
      const lo = floor ? floor[k] : GEN.statMin;
      if ((dir > 0 && out[k] < GEN.statMax) || (dir < 0 && out[k] > lo)) { out[k] += dir; moved = true; break; }
    }
    if (!moved) break;
    ovr = ovrOfArray(out, p);
  }
  return ovr;
}

/** Years until each stat group's window opens: [physical, technical, mental]. */
function groupYears(age, peakStart) {
  return [0, 1, 2].map((g) => Math.max(0, peakStart + GROUP_WINDOW_SHIFT[GROUPS[g]][0] - age));
}

/** potential = stats + scale * years-to-group-window * weight factor (capped 99). */
function spreadHeadroom(p, years, stats, scale, out) {
  for (let k = 0; k < 7; k++) {
    const y = years[GROUP_IDX[p * 7 + k]];
    out[k] = Math.min(GEN.statMax, stats[k] + (y > 0 ? Math.max(0, Math.round(scale * y * HEAD_FACTOR[p * 7 + k])) : 0));
  }
}

/** Potential stats hitting potential OVR target P (as close as stat caps allow). */
function fitPotential(p, years, stats, ovr, P, out) {
  let denom = 0;
  for (let k = 0; k < 7; k++) denom += WEIGHTS[p * 7 + k] * years[GROUP_IDX[p * 7 + k]] * HEAD_FACTOR[p * 7 + k];
  const scale = denom > 0 ? (P - ovr) / denom : 0;
  spreadHeadroom(p, years, stats, scale, out);
  return fitOvr(p, P, out, stats);
}

function drawAge(rng, roleKey, isGK) {
  if (roleKey === 'youth') return rng.int(GEN.age.youth[0], GEN.age.youth[1]);
  const [m, sd, lo, hi] = GEN.age[roleKey];
  return clamp(Math.round(rng.normal(m + (isGK ? GEN.age.gkExtra : 0), sd)), lo, hi);
}

/** Peak window for a position code + dev type index: default, shifted, jitter -1..+1 per bound. */
function drawPeak(rng, pos, dev) {
  const [a, b] = PEAK_WINDOW[pos];
  const d = DEV[DEV_TYPES[dev]];
  let s = a + (d.windowShift || 0) + rng.int(-1, 1);
  let e = b + (d.windowShift || 0) + (d.peakEndShift || 0) + rng.int(-1, 1);
  if (e < s + 2) e = s + 2;
  return [s, e];
}

/** Decline already suffered (OVR points) at `age` past peakEnd. Same curve as the latent age offset. */
function pastPeakLoss(age, peakEnd, dev) {
  const y = age - peakEnd;
  if (y <= 0) return 0;
  return Math.min(GEN.declineCap, (y + GEN.ageCurve * y * (y - 1)) * GEN.declinePerYear * DEV[DEV_TYPES[dev]].declineMult);
}

function ageOffset(age, peakStart, peakEnd, dev) {
  if (age < peakStart) return -Math.min(GEN.youthDeficitCap, GEN.youthDeficitPerYear * (peakStart - age) * (dev === 0 ? GEN.earlyYouthDeficitMult : 1));
  return -pastPeakLoss(age, peakEnd, dev);
}

function drawAltPos(rng, pos) {
  const nb = ALT_NEIGHBOURS[pos];
  if (!nb.length) return 0;
  const n = Math.min(nb.length, rng.weightedIndex(GEN.altPosCount));
  if (!n) return 0;
  const pool = nb.slice();
  let v = 0;
  for (let i = 0; i < n; i++) {
    const j = rng.int(0, pool.length - 1);
    v |= (POS_INDEX[pool[j]] + 1) << (4 * i);
    pool.splice(j, 1);
  }
  return v;
}

/** 26 position indices for a squad (fixed core + 3 extras toward the world mix) and starter flags. */
function squadPlan(rng) {
  const fixed = GEN.squadFixed;
  const list = [];
  for (const p of POSITIONS) for (let i = 0; i < fixed[p]; i++) list.push(POS_INDEX[p]);
  const extraW = POSITIONS.map((p) => Math.max(0, WORLD.positionMix[p] * WORLD.squadSize - fixed[p]));
  while (list.length < WORLD.squadSize) list.push(rng.weightedIndex(extraW));
  // starters: GK, CB x2, FB x2, DM, CM x2, then 3 attackers
  const att = rng.pick([['W', 'ST', 'ST'], ['W', 'W', 'ST'], ['AM', 'W', 'ST']]);
  const want = ['GK', 'CB', 'CB', 'FB', 'FB', 'DM', 'CM', 'CM', ...att].map((p) => POS_INDEX[p]);
  const roles = new Array(list.length).fill(-1);
  for (const w of want) {
    const i = list.findIndex((x, j) => x === w && roles[j] === -1);
    if (i >= 0) roles[i] = ROLE.starter;
  }
  const rest = [];
  roles.forEach((r, i) => { if (r === -1) rest.push(i); });
  rng.shuffle(rest);
  rest.forEach((i, j) => { roles[i] = j < GEN.youthPerSquad ? ROLE.youth : j < GEN.youthPerSquad + GEN.backupPerSquad ? ROLE.backup : ROLE.rotation; });
  return { pos: list, roles };
}

// ---------------------------------------------------------------- clubs
const CREST_SHAPES = ['shield', 'round', 'diamond', 'pointed', 'hex', 'banner', 'oval', 'octagon', 'french'];
const CREST_PATTERNS = ['plain', 'halves', 'stripes', 'hoops', 'sash', 'chevron', 'quarters', 'border'];
const CREST_PATTERN_W = [3, 2, 2, 1.5, 1.5, 1.2, 1, 1.5];
const CREST_EMBLEMS = ['star', 'tower', 'ship', 'wave', 'bird', 'sword', 'ball', 'crown', 'tree', 'anchor',
  'bolt', 'mountain', 'sun', 'flame', 'key', 'wheel', 'arrow', 'flower'];
const CREST_PALETTE = ['#c8102e', '#0b3d91', '#1f7a3a', '#f2c200', '#111318', '#ffffff', '#6a1b9a', '#e35205',
  '#00a3e0', '#7a1f2b', '#0f5e5a', '#d4af37', '#8a8d91', '#ff4f9a', '#183a2b', '#2b2f8f'];
const CREST_TRIMS = ['#ffffff', '#ffd659', '#14161c'];
/** Tactical identity labels for AI clubs and managers. */
export const CLUB_STYLES = ['possession', 'counter-attack', 'high press', 'direct', 'balanced', 'wing play', 'compact'];
const FORMATION_W = [3, 4, 3, 1.5, 1, 1.5];

function luma(hex) {
  const h = hex.replace('#', '');
  const v = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2]) / 255;
}

function initialsOf(name) {
  const words = name.split(/[\s-]+/).filter((w) => w && !/^\d+$/.test(w) && !/^(de|d'|du|des|del|la|le|les|di|am|of|the|y)$/i.test(w));
  let s = words.map((w) => Array.from(w.replace(/^d'/i, ''))[0] || '').join('').toUpperCase();
  if (s.length > 3) s = s.slice(0, 3);
  return s || name.slice(0, 2).toUpperCase();
}

/**
 * Club record. opts: { id, country, division (pyramid level 1-5, 0 = background), usedNames:Set (per country), strengthTarget }
 * @returns {import('./world.js').Club}
 */
export function makeClub(rng, opts) {
  const { id, country, division = 0, usedNames, strengthTarget = 0 } = opts;
  const isBackground = !division;
  const name = isBackground ? makeBackgroundClubName(rng, country, usedNames) : makeClubName(rng, country, usedNames);
  const nation = NATIONS[NATION_INDEX[country]];
  let c1, c2;
  if (isBackground && nation && rng.chance(GEN.bgNationColourShare)) [c1, c2] = nation.colours;
  else {
    c1 = rng.pick(CREST_PALETTE);
    const opts2 = CREST_PALETTE.filter((c) => c !== c1 && Math.abs(luma(c) - luma(c1)) > GEN.crestLumaGap);
    c2 = rng.pick(opts2);
  }
  const crest = {
    shape: rng.pick(CREST_SHAPES), colours: [c1, c2], emblem: rng.pick(CREST_EMBLEMS),
    pattern: rng.weighted(CREST_PATTERNS, CREST_PATTERN_W), trim: rng.weighted(CREST_TRIMS, [3, 2, 1]), initials: initialsOf(name),
  };
  return {
    id, name, country, division, isBackground, colours: [c1, c2], crest,
    stadium: makeStadiumName(rng, country),
    identity: { style: rng.pick(CLUB_STYLES), formation: rng.weighted(FORMATION_IDS, FORMATION_W), starId: -1 },
    strengthTarget: Math.round(strengthTarget * 10) / 10,
  };
}

// ---------------------------------------------------------------- cards
const cardId = (rng, prefix) => `${prefix}_${(rng.int(0, 0x7fffffff)).toString(36)}${(rng.int(0, 0x7fffffff)).toString(36)}`;
/** Manager perk ids. */
export const MANAGER_PERKS = ['youthGrowth', 'lateSubs', 'homeFortress', 'setPieces', 'motivator', 'fitnessFocus', 'tactician', 'bigGames'];
const RARITY_DRAW = ['bronze', 'silver', 'gold', 'elite'];
const nationTierWeights = NATIONS.map((n) => WORLD.tierWeight[n.tier]);

/**
 * Manager card. opts: { rarity, nation (code), formation, id }. Missing fields are drawn.
 * @returns {import('./cards.js').ManagerCard}
 */
export function makeManager(rng, opts = {}) {
  const nation = opts.nation || NATIONS[rng.weightedIndex(nationTierWeights)].code;
  const rarity = opts.rarity || rng.weighted(RARITY_DRAW, GEN.managerRarityWeights);
  const chemBonus = rng.chance(GEN.managerNationChemShare) ? { type: 'nation', value: nation } : { type: 'league', value: rng.pick(WORLD.countries) };
  return {
    id: opts.id || cardId(rng, 'mgr'),
    kind: 'manager',
    name: makeManagerName(rng, nation),
    nation,
    rarity,
    formation: opts.formation || rng.weighted(FORMATION_IDS, FORMATION_W),
    style: rng.pick(CLUB_STYLES),
    chemBonus,
    perk: rng.pick(MANAGER_PERKS),
  };
}

export const STAFF_ROLES = STAFF.roles;
/**
 * Staff card. role from STAFF_ROLES (drawn if missing), rarity drawn if missing. level: bronze 1, silver 2, gold+ 3.
 * @returns {import('./cards.js').StaffCard}
 */
export function makeStaff(rng, role, rarity, opts = {}) {
  const r = role || rng.pick(STAFF_ROLES);
  const rar = rarity || rng.weighted(RARITY_DRAW, GEN.managerRarityWeights);
  const nation = opts.nation || NATIONS[rng.weightedIndex(nationTierWeights)].code;
  return {
    id: opts.id || cardId(rng, 'stf'), kind: 'staff', role: r, name: makeManagerName(rng, nation), rarity: rar,
    level: rar === 'bronze' ? GEN.staffLevel.bronze : rar === 'silver' ? GEN.staffLevel.silver : GEN.staffLevel.gold,
  };
}

// ---------------------------------------------------------------- player detail pass
function cultureOf(nationIdx) { return NATIONS[nationIdx].culture; }

/** Name indices unique (exact full name) inside `used` (a Set of full names; null = no check). */
function pickUniqueName(rng, nationIdx, used) {
  const cid = cultureOf(nationIdx);
  let f = 0, l = 0;
  for (let t = 0; t < 30; t++) {
    [f, l] = pickNameIndices(rng, cid);
    if (!used) return [f, l];
    const full = nameFromIndices(cid, f, l);
    if (!used.has(full)) { used.add(full); return [f, l]; }
  }
  throw new Error(`generator: could not find a unique name in culture ${cid}`);
}

/** Fill stats, potential, peakOvr, hidden values, foot and altPos for a planned slot (pos, age, dev, peak, ovr set). */
function detailPlayer(rng, w, id, stats, pot) {
  const p = w.pos[id];
  const target = w.ovr[id];
  buildStats(rng, p, target, stats);
  const age = w.age[id];
  const ps = w.peakStart[id];
  const years = groupYears(age, ps);
  let g = Math.max(GEN.headroomMin, rng.normal(GEN.growthPerYear[0], GEN.growthPerYear[1]));
  const young = age <= GEN.youngAge;
  if (young && rng.chance(GEN.wonderkidShare)) g *= GEN.wonderkidBoost;
  spreadHeadroom(p, years, stats, g, pot);
  let pOvr = ovrOfArray(pot, p);
  if (pOvr > GEN.potentialCap) pOvr = fitOvr(p, GEN.potentialCap, pot, stats);
  if (age < ps && pOvr <= target) {
    const k = FIX_ORDER[p][0];
    pot[k] = Math.min(GEN.statMax, pot[k] + GEN.noHeadroomBump);
    pOvr = ovrOfArray(pot, p);
  }
  for (let k = 0; k < 7; k++) { w.stat[k][id] = stats[k]; w.pot[k][id] = pot[k]; }
  w.peakOvr[id] = Math.min(99, target + Math.round(pastPeakLoss(age, w.peakEnd[id], w.devType[id])));
  if (age <= GEN.wonderkidMaxAge && pOvr >= GEN.wonderkidPotential) w.flags[id] |= FLAG.WONDERKID;
  w.foot[id] = rng.weightedIndex(GEN.foot);
  w.altPos[id] = drawAltPos(rng, POSITIONS[p]);
  const HD = GEN.hidden;
  w.professionalism[id] = clamp(Math.round(rng.normal(HD.professionalism[0], HD.professionalism[1])), HD.min, HD.max);
  w.injuryProne[id] = clamp(Math.round(rng.normal(HD.injuryProne[0], HD.injuryProne[1])), HD.min, HD.max);
  w.consistency[id] = clamp(Math.round(rng.normal(HD.consistency.base + (target - HD.consistency.ovrRef) / HD.consistency.ovrDiv, HD.consistency.sd)), HD.min, HD.max);
}

// ---------------------------------------------------------------- generateWorld
/**
 * Generate the whole world. Deterministic: same seed + size gives the same checksum.
 * @param {number|string} seed
 * @param {number} size  number of players (30,000 / 50,000 / 100,000; at least WORLD.minPlayers)
 * @param {(p:number, label:string)=>void} [onProgress]  p in 0..1
 * @returns {World}
 */
export function generateWorld(seed, size = WORLD.defaultPlayers, onProgress = null) {
  const N = Math.round(size);
  if (N < WORLD.minPlayers) throw new Error(`generator: world size must be at least ${WORLD.minPlayers}`);
  const progress = (p, label) => { if (onProgress) onProgress(p, label); };
  const root = rngFrom(seed);
  const SQ = WORLD.squadSize;
  progress(0, S.newGame.progress.nations);

  // ---- 1. nation quotas
  const quota = splitInt(N, nationTierWeights);
  // The pyramid countries need home players for about 65% of their pyramid squads plus the non-league pool; small
  // worlds (30,000) would run out, so their quota is raised and the difference taken from the other nations.
  {
    let deficit = 0;
    for (let ni = 0; ni < NATIONS.length; ni++) {
      const levels = LEAGUE_SYSTEM.countries[NATIONS[ni].code];
      if (!NATIONS[ni].playable || !levels) continue;
      const clubs = levels.reduce((a, l) => a + l.clubs, 0);
      const need = Math.round(WORLD.squadSize * WORLD.homeNationShareInTopClubs) * clubs + GEN.minBackgroundClubsPlayable * WORLD.squadSize;
      if (quota[ni] < need) { deficit += need - quota[ni]; quota[ni] = need; }
    }
    if (deficit > 0) {
      const cut = splitInt(deficit, NATIONS.map((n, i) => (n.playable ? 0 : quota[i])));
      for (let ni = 0; ni < NATIONS.length; ni++) quota[ni] -= cut[ni];
    }
  }
  const used = new Int32Array(NATIONS.length);

  // plan arrays live directly in the World (clubs attached later)
  const w = new World(N, [], { seed, size: N });
  const role = new Uint8Array(N);
  const latent = new Float32Array(N);
  const clubOf = new Int32Array(N).fill(-1);
  const clubs = [];
  let next = 0;

  const planSlot = (rng, id, posIdx, roleIdx, nationIdx, clubId) => {
    const isGK = posIdx === 0;
    w.pos[id] = posIdx;
    w.nation[id] = nationIdx;
    role[id] = roleIdx;
    clubOf[id] = clubId;
    w.club[id] = clubId < 0 ? NO_CLUB : clubId;
    const age = drawAge(rng, ROLE_KEYS[roleIdx], isGK);
    w.age[id] = age;
    const dev = rng.weightedIndex(DEV_SHARES);
    w.devType[id] = dev;
    const [s, e] = drawPeak(rng, POSITIONS[posIdx], dev);
    w.peakStart[id] = s; w.peakEnd[id] = e;
    used[nationIdx]++;
    return ageOffset(age, s, e, dev);
  };

  // Shift a squad's ratings so its best XI averages target. Writes integer OVRs into w.ovr.
  const fitSquad = (ids, lat, target) => {
    let shift = 0;
    for (let it = 0; it < GEN.fitSquadIterations; it++) {
      for (const id of ids) w.ovr[id] = clamp(Math.round(lat[id] + shift), GEN.ovrMin, GEN.ovrMax);
      const xi = bestXIOf(ids, w.pos, w.ovr);
      let s = 0;
      for (const id of xi) s += w.ovr[id];
      const d = target - s / xi.length;
      if (Math.abs(d) < GEN.fitSquadTolerance) break;
      shift += d;
    }
  };

  // ---- 2. playable clubs
  const rClubs = root.fork('clubs');
  const rPlay = root.fork('playable');
  const usedClubNames = new Map(NATIONS.map((n) => [n.code, new Set()]));
  const LS = LEAGUE_SYSTEM;
  const CS = LS.strengthByLevel;
  const playableIds = [];
  const starScale = Math.min(1, Math.sqrt(N / GEN.starScaleSize));
  for (const country of WORLD.countries) {
    const home = NATION_INDEX[country];
    const jitter = rPlay.float(-LS.countryJitter, LS.countryJitter);
    for (let div = 1; div <= LS.levels; div++) {
      const nClubs = LS.countries[country][div - 1].clubs;
      const ladder = [];
      for (let i = 0; i < nClubs; i++) ladder.push(-LS.spread + (2 * LS.spread * i) / (nClubs - 1));
      rPlay.shuffle(ladder);
      const tierW = GEN.foreignTierWeight[div];
      for (let ci = 0; ci < nClubs; ci++) {
        const T = CS[div] + jitter + ladder[ci];
        const club = makeClub(rClubs, { id: clubs.length, country, division: div, usedNames: usedClubNames.get(country), strengthTarget: T });
        clubs.push(club);
        const plan = squadPlan(rPlay);
        const starExpect = div === 1 ? GEN.d1Stars : div === 2 ? GEN.d2Stars : 0;
        const starBump = div === 1 ? GEN.d1StarBump : GEN.d2StarBump;
        // stronger clubs of the level get more stars (T - level value runs -5..+5)
        const starProb = (starExpect * starScale * clamp(1 + (T - CS[div] - jitter) / GEN.starProb.div, GEN.starProb.lo, GEN.starProb.hi)) / GEN.starProb.perXi;
        const foreignCount = SQ - Math.round(SQ * WORLD.homeNationShareInTopClubs);
        const order = rPlay.shuffle([...Array(SQ).keys()]);
        const foreign = new Set(order.slice(0, foreignCount));
        const ids = [];
        for (let j = 0; j < SQ; j++) {
          let nat = home;
          if (foreign.has(j) || used[home] >= quota[home]) {
            const wts = NATIONS.map((n, i) => (i === home || used[i] >= quota[i] ? 0 : WORLD.tierWeight[n.tier] * tierW[n.tier]));
            nat = rPlay.weightedIndex(wts);
          }
          const id = next++;
          const ao = planSlot(rPlay, id, plan.pos[j], plan.roles[j], nat, club.id);
          const [ro, sd] = GEN.role[ROLE_KEYS[plan.roles[j]]];
          latent[id] = T + ro + ao + rPlay.normal(0, sd) + GEN.playableTierShift * WORLD.tierOvrShift[NATIONS[nat].tier];
          if (plan.roles[j] === ROLE.starter && rPlay.chance(starProb)) latent[id] += rPlay.normal(starBump[0], starBump[1]);
          ids.push(id);
        }
        fitSquad(ids, latent, T);
        playableIds.push(...ids);
      }
    }
  }
  const playableCount = next;
  progress(0.15, S.newGame.progress.backgroundClubs);

  // ---- 3. background clubs and free agents per nation
  const rBg = root.fork('background');
  const remaining = NATIONS.map((n, i) => Math.max(0, quota[i] - used[i]));
  const remTotal = remaining.reduce((a, b) => a + b, 0);
  const H = targetHistogram(N);
  let eliteSlots = 0;
  for (let o = GEN.eliteOvr; o < 100; o++) eliteSlots += H[o];
  for (let id = 0; id < playableCount; id++) if (w.ovr[id] >= GEN.eliteOvr) eliteSlots--;
  eliteSlots = Math.max(0, eliteSlots);
  const faTotal = Math.round(N * WORLD.freeAgentShare);
  const faTarget = splitInt(faTotal, remaining);
  const BOTTOM = CS[LS.levels];
  // Per nation: whole background clubs of 26 plus free agents near the 4% target. A nation's total may move by up
  // to half a squad (so clubs stay full); the difference is settled one free agent at a time, largest nations first.
  const nClubsOf = new Int32Array(NATIONS.length);
  const nFaOf = new Int32Array(NATIONS.length);
  let delta = 0;
  for (let ni = 0; ni < NATIONS.length; ni++) {
    nClubsOf[ni] = Math.max(0, Math.round((remaining[ni] - faTarget[ni]) / SQ));
    nFaOf[ni] = faTarget[ni];
    // the 5 pyramid countries always keep a pool of non-league clubs for the level-5 exchange (small worlds would
    // otherwise spend the whole home quota on the 500 pyramid clubs)
    if (NATIONS[ni].playable) nClubsOf[ni] = Math.max(nClubsOf[ni], GEN.minBackgroundClubsPlayable);
    delta += nClubsOf[ni] * SQ + nFaOf[ni] - remaining[ni];
  }
  // pay for those clubs with whole background clubs of the biggest other nations, then free agents (below)
  while (delta >= SQ) {
    let best = -1;
    for (let ni = 0; ni < NATIONS.length; ni++) if (!NATIONS[ni].playable && nClubsOf[ni] > 1 && (best < 0 || nClubsOf[ni] > nClubsOf[best])) best = ni;
    if (best < 0) break;
    nClubsOf[best]--;
    delta -= SQ;
  }
  let starWeight = 0;
  for (let ni = 0; ni < NATIONS.length; ni++) if (!NATIONS[ni].playable) starWeight += nClubsOf[ni] * SQ * GEN.starTierMult[NATIONS[ni].tier];
  const starK = (GEN.starOversupply * eliteSlots) / Math.max(1, starWeight);
  const bySize = NATIONS.map((n, i) => i).sort((a, b) => remaining[b] - remaining[a] || a - b);
  for (let guard = 0; delta !== 0 && guard < 100000; guard++) {
    const ni = bySize[guard % bySize.length];
    if (delta > 0 && nFaOf[ni] > 0) { nFaOf[ni]--; delta--; } else if (delta < 0) { nFaOf[ni]++; delta++; }
  }
  for (let ni = 0; ni < NATIONS.length; ni++) {
    const nat = NATIONS[ni];
    const nClubs = nClubsOf[ni];
    const nFa = nFaOf[ni];
    let base = BACKGROUND_CLUB_STRENGTH[nat.tier];
    if (nat.playable) base = Math.min(base, BOTTOM - GEN.bgBelowBottomLevel);
    for (let c = 0; c < nClubs; c++) {
      const pyramid = Math.min(GEN.bgPyramidCap, GEN.bgPyramidStep * Math.floor(c / GEN.bgPyramidEvery));
      const T = base - pyramid + rBg.float(-GEN.bgClubSpread, GEN.bgClubSpread);
      const club = makeClub(rClubs, { id: clubs.length, country: nat.code, division: 0, usedNames: usedClubNames.get(nat.code), strengthTarget: T });
      clubs.push(club);
      const plan = squadPlan(rBg);
      const ids = [];
      for (let j = 0; j < SQ; j++) {
        const id = next++;
        const ao = planSlot(rBg, id, plan.pos[j], plan.roles[j], ni, club.id);
        const [ro, sd] = GEN.role[ROLE_KEYS[plan.roles[j]]];
        latent[id] = T + ro + ao + rBg.normal(0, sd);
        if (plan.roles[j] !== ROLE.youth) {
          if (nat.playable) { if (rBg.chance(GEN.lowerLeagueStarProb)) latent[id] += rBg.normal(GEN.lowerLeagueStarBump[0], GEN.lowerLeagueStarBump[1]); }
          else if (rBg.chance(starK * GEN.starTierMult[nat.tier])) latent[id] += rBg.normal(GEN.bgStarBump[0], GEN.bgStarBump[1]);
        }
        ids.push(id);
      }
      // intended XI average = T (float latent, no rounding: shift the latents)
      fitSquad(ids, latent, T);
      for (const id of ids) latent[id] = w.ovr[id] + rBg.float(-GEN.latentJitter, GEN.latentJitter);
    }
    for (let k = 0; k < nFa; k++) {
      const id = next++;
      const isYouth = rBg.chance(GEN.faYouthShare);
      const posIdx = rBg.weightedIndex(MIX);
      const ao = planSlot(rBg, id, posIdx, ROLE.fa, ni, -1);
      if (isYouth) {
        const a = rBg.int(GEN.age.faYouth[0], GEN.age.faYouth[1]);
        w.age[id] = a;
        w.flags[id] |= FLAG.YOUTH;
      }
      const ao2 = isYouth ? ageOffset(w.age[id], w.peakStart[id], w.peakEnd[id], w.devType[id]) : ao;
      latent[id] = base - GEN.faBelowBackground + ao2 + rBg.normal(0, GEN.role.fa[1]);
    }
  }
  if (next !== N) throw new Error(`generator: planned ${next} players, expected ${N} (remaining ${remTotal})`);
  progress(0.3, S.newGame.progress.ratings);

  // ---- 4. map background + free agent latents onto the exact world histogram
  const playHist = new Float64Array(100);
  for (let id = 0; id < playableCount; id++) playHist[w.ovr[id]]++;
  const remW = [];
  for (let o = 0; o < 100; o++) remW.push(Math.max(0, H[o] - playHist[o]));
  const remCount = N - playableCount;
  const remHist = splitInt(remCount, remW);
  const preHist = new Int32Array(100);
  const keys = new Float64Array(remCount);
  for (let i = 0; i < remCount; i++) {
    const id = playableCount + i;
    preHist[clamp(Math.round(latent[id]), 0, 99)]++;
    // descending latent, ties by id: key = (1000 - latent) scaled, plus id fraction
    keys[i] = Math.round((1000 - latent[id]) * 1024) * 1048576 + id;
  }
  keys.sort();
  let o = 99;
  let left = remHist[o];
  for (let i = 0; i < remCount; i++) {
    while (left === 0 && o > 0) { o--; left = remHist[o]; }
    const id = keys[i] % 1048576;
    w.ovr[id] = o;
    left--;
  }
  progress(0.4, S.newGame.progress.players);

  // ---- 5. per-player detail: stats, potential, hidden values, names
  const rDet = root.fork('detail');
  const rName = root.fork('names');
  const stats = [0, 0, 0, 0, 0, 0, 0];
  const pot = [0, 0, 0, 0, 0, 0, 0];
  let curClub = -2;
  let names = null;
  for (let id = 0; id < N; id++) {
    detailPlayer(rDet, w, id, stats, pot);
    const c = clubOf[id];
    if (c !== curClub) { curClub = c; names = c >= 0 ? new Set() : null; }
    const [f, l] = pickUniqueName(rName, w.nation[id], names);
    w.firstName[id] = f; w.lastName[id] = l;
    if ((id & 8191) === 0) progress(0.4 + 0.5 * (id / N), S.newGame.progress.players);
  }

  // ---- 6. caps and international goals for each nation's best players
  const rCaps = root.fork('caps');
  const CP = GEN.caps;
  for (let ni = 0; ni < NATIONS.length; ni++) {
    const top = w.topN(ni, null, GEN.capsPoolPerNation);
    if (!top.length) continue;
    const best = w.ovr[top[0]];
    const floor = w.ovr[top[top.length - 1]];
    for (const id of top) {
      const a = w.age[id];
      if (a < CP.minAge) continue;
      const q = (w.ovr[id] - floor + CP.qOffset) / (best - floor + CP.qOffset);
      const caps = clamp(Math.round((a - CP.baseAge) * rCaps.float(CP.perYear[0], CP.perYear[1]) * q), 0, CP.max);
      w.caps[id] = caps;
      const pk = POSITIONS[w.pos[id]];
      const GR = CP.goalRate;
      const rate = GR[pk] ?? GR.other;
      w.intlGoals[id] = clamp(Math.round(caps * rate * rCaps.float(CP.goalNoise[0], CP.goalNoise[1])), 0, CP.goalMax);
    }
  }

  // ---- 7. attach clubs, rosters, identity
  w.setClubs(clubs);
  for (const club of clubs) {
    let best = -1;
    for (const id of w.clubSquad(club.id)) if (best < 0 || w.ovr[id] > w.ovr[best] || (w.ovr[id] === w.ovr[best] && id < best)) best = id;
    club.identity.starId = best;
  }
  w.meta.generator = {
    version: 1, playableCount, freeAgents: w.freeAgentCount, backgroundClubs: clubs.length - playableCount / SQ,
    preMapHistogram: Array.from(preHist), remainderHistogram: Array.from(remHist),
  };
  progress(1, S.newGame.progress.done);
  return w;
}

// ---------------------------------------------------------------- regens
/**
 * New 15-17 year old for a nation, attached to clubId (-1 = free agents). Reuses a vacant (retired) slot,
 * or grows the store when none is free. Position pulled toward WORLD.positionMix, OVR 40-58, potential OVR
 * from POTENTIAL_REGEN (mean + tier shift, sd, cap). Name unique inside the club. Returns the player id.
 * opts: { pos } to force a position.
 */
export function makeRegen(world, rng, nationCode, clubId = -1, opts = {}) {
  const ni = NATION_INDEX[nationCode];
  if (ni === undefined) throw new Error(`makeRegen: unknown nation ${nationCode}`);
  const nat = NATIONS[ni];
  let p;
  if (opts.pos !== undefined) p = typeof opts.pos === 'number' ? opts.pos : POS_INDEX[opts.pos];
  else {
    const live = world.liveCount + 1;
    const wts = MIX.map((m, i) => Math.max(0, m * live - world.posCounts[i]) + m * GEN.regenPositionWeightBase);
    p = rng.weightedIndex(wts);
  }
  const age = rng.int(REGEN.minAge, REGEN.maxAge);
  const ovr = clamp(Math.round(REGEN.minOvr + (REGEN.maxOvr - REGEN.minOvr) * rng.next() ** GEN.regenOvrCurve), REGEN.minOvr, REGEN.maxOvr);
  const dev = rng.weightedIndex(DEV_SHARES);
  const [ps, pe] = drawPeak(rng, POSITIONS[p], dev);
  const stats = [0, 0, 0, 0, 0, 0, 0];
  buildStats(rng, p, ovr, stats);
  const PR = POTENTIAL_REGEN;
  const P = clamp(Math.round(rng.normal(PR.mean + PR.tierShift[nat.tier], PR.sd)), ovr + GEN.regenPotentialMargin, PR.cap);
  const pot = [0, 0, 0, 0, 0, 0, 0];
  const pOvr = fitPotential(p, groupYears(age, ps), stats, ovr, P, pot);
  let names = null;
  if (clubId >= 0 && clubId !== NO_CLUB) {
    names = new Set();
    for (const id of world.clubSquad(clubId)) names.add(world.name(id));
  }
  const [first, last] = pickUniqueName(rng, ni, names);
  const id = world.allocSlot();
  world.recycleSlot(id, {
    firstName: first, lastName: last, nation: ni, age, foot: rng.weightedIndex(GEN.foot), pos: p,
    altPos: [], stats, potential: pot, devType: dev, peakStart: ps, peakEnd: pe,
    professionalism: clamp(Math.round(rng.normal(GEN.hidden.professionalism[0], GEN.hidden.professionalism[1])), GEN.hidden.min, GEN.hidden.max),
    injuryProne: clamp(Math.round(rng.normal(GEN.hidden.injuryProne[0], GEN.hidden.injuryProne[1])), GEN.hidden.min, GEN.hidden.max),
    consistency: clamp(Math.round(rng.normal(GEN.hidden.consistency.base + (ovr - GEN.hidden.consistency.ovrRef) / GEN.hidden.consistency.ovrDiv, GEN.hidden.consistency.sd)), GEN.hidden.min, GEN.hidden.max),
    flags: FLAG.REGEN | (pOvr >= GEN.regenWonderkidPotential ? FLAG.WONDERKID : 0),
    clubId,
  });
  world.altPos[id] = drawAltPos(rng, POSITIONS[p]);
  return id;
}

World.regenFactory = makeRegen;

export { RARITY as _RARITY };
