// Squad rules: swaps, formation remap, auto best XI, fitness fix, presets, roles, tactic cards, item cards,
// and the read-only views the squad and tactics screens render. Pure module: no DOM, no global random source and no
// wall clock. Nothing here rolls dice, so no rng is needed.
//
// ---------------------------------------------------------------- mutation contract
// Every ACTION function (swap, setFormation, autoBestXI, autoFixFitness, savePreset, loadPreset, setSetting,
// setRole, equipTacticCard, applyItemCard, quickSell) mutates `state` IN PLACE on success and returns
// { ok:true, state, ...extra }. On failure it returns { ok:false, error, message } and leaves state untouched.
// state.squad is patched with Object.assign, so references held elsewhere stay valid.
// QUERY functions (squadView, tacticsView, previewSwap, previewTargets, reserves, validate, opponentReport)
// never mutate.
//
// ---------------------------------------------------------------- locations ("refs")
//   { zone:'xi', index }        pitch slot 0..10 (slot 0 = goalkeeper), may be empty (null)
//   { zone:'bench', index }     bench slot 0..6; an index past the current bench length is an empty slot
//   { zone:'reserve', cardId }  a player card that is in neither the XI nor the bench
//   { zone:'reserve' }          (no cardId) "the reserves area": moving a card there takes it out of the squad
//
// GameState.squad (cards.js typedef + two additive fields from the main session):
//   { formation, xi:[cardId|null x 11], bench:[cardId], tacticCards:[cardId|null x 3], settings, roles,
//     managerId:cardId|null, presets:[null|{formation,xi,bench,settings,roles,tacticCards} x 3] }
// tacticCards hold CARD ids (state.cards entries of kind 'tactic'); equippedTacticIds(state) maps them to the
// tactic ids (TACTIC_CARDS) that buildMatchTeam / tacticModifiers expect.

import {
  FITNESS, MORALE, TACTIC_OPTIONS, DEFAULT_SETTINGS, SQUAD_ROLES, COINS, POS_LINE, STAT_LABELS, SQUAD_RULES,
} from '../balance.js';
import { S, fmt } from '../strings.js';
import { rarityFromOvr, upgradeSlots, statKeysFor } from './cards.js';
import { computeChemistry, linkColour, isNaturalPosition } from './chemistry.js';
import {
  effectiveStats, evaluateXi, teamRatings, oopPenalty, TRAIT_CATALOGUE, STYLE_CARDS,
  applyTrainingCard, applyTrait, applyStyle, canApplyTrait, canApplyStyle,
} from './cardEffects.js';
import { FORMATIONS, FORMATION_LIST, shapePreview } from './formations.js';
import { TACTIC_CARDS, SETTING_SUMMARY, normaliseSettings } from './tactics.js';
import { wagePerMatch, matchIncome, quickSellValue, iconWorldPlayer } from './economy.js';
import { NATION_BY_CODE } from './nations.js';

// Structural squad numbers (SQUAD_RULES) live in balance.js; re-exported for the screens and tools that import them here.
export { SQUAD_RULES };

const fail = (error, message) => ({ ok: false, error, message: message || error });
const ERR = S.errors.squad;
const round1 = (v) => Math.round(v * 10) / 10;
const LINE_RANK = { gk: 0, def: 1, mid: 2, att: 3 };

// ================================================================ basic lookups

/** Map card id -> card. */
export function cardIndex(state) {
  const m = new Map();
  for (const c of state.cards || []) m.set(c.id, c);
  return m;
}
const isPlayerCard = (c) => !!c && c.kind === 'player';
export const isIconCard = (c) => !!c && (c.isIcon === true || c.rarity === 'icon');

/** World player of a card (Icons are snapshots outside the world). */
export function worldPlayerOf(card, world) {
  if (!card) return null;
  if (isIconCard(card) && card.icon) return iconWorldPlayer(card);
  return world.getPlayer(card.playerId);
}

/** Rarity of a player card: override, icon, or derived from current OVR. */
export function rarityOfCard(card, wp) {
  if (card.rarity) return card.rarity;
  if (isIconCard(card)) return 'icon';
  return rarityFromOvr(wp ? wp.ovr : 0);
}

export const isAvailable = (card) => !!card && !(card.injuredFor > 0) && !(card.suspendedFor > 0);

/** Normalised copy of the squad (fills missing fields, pads xi to the formation size). */
export function normSquad(squad) {
  const sq = squad || {};
  const formation = FORMATIONS[sq.formation] ? sq.formation : SQUAD_RULES.defaultFormation;
  const n = FORMATIONS[formation].slots.length;
  const xi = Array.from({ length: n }, (_, i) => (sq.xi && sq.xi[i] != null ? sq.xi[i] : null));
  const tc = Array.from({ length: SQUAD_RULES.tacticSlots }, (_, i) => (sq.tacticCards && sq.tacticCards[i] != null ? sq.tacticCards[i] : null));
  const roles = {};
  for (const r of SQUAD_ROLES) roles[r] = sq.roles && sq.roles[r] != null ? sq.roles[r] : null;
  const presets = Array.from({ length: SQUAD_RULES.presetSlots }, (_, i) => (sq.presets && sq.presets[i]) || null);
  return {
    ...sq,
    formation, xi, bench: (sq.bench || []).filter((x) => x != null).slice(0, SQUAD_RULES.benchSize),
    tacticCards: tc, settings: normaliseSettings(sq.settings), roles,
    managerId: sq.managerId ?? null, presets,
  };
}

function commit(state, sq) {
  if (!state.squad) state.squad = {};
  Object.assign(state.squad, sq);
  return { ok: true, state };
}

/** Manager card in use: squad.managerId, else none. */
export function managerOf(state) {
  const id = state.squad && state.squad.managerId;
  if (!id) return null;
  const c = (state.cards || []).find((x) => x.id === id);
  return c && c.kind === 'manager' ? c : null;
}

/** Player card ids that are in neither the XI nor the bench, in state.cards order. */
export function reserves(state) {
  const sq = normSquad(state.squad);
  const used = new Set([...sq.xi, ...sq.bench].filter(Boolean));
  return (state.cards || []).filter((c) => isPlayerCard(c) && !used.has(c.id)).map((c) => c.id);
}

/** Tactic ids (e.g. 'counterAttack') of the equipped tactic cards, for buildMatchTeam. */
export function equippedTacticIds(state) {
  const byId = cardIndex(state);
  const out = [];
  for (const id of normSquad(state.squad).tacticCards) {
    const c = id ? byId.get(id) : null;
    const tid = c ? tacticIdOf(c) : null;
    if (tid && !out.includes(tid)) out.push(tid);
  }
  return out;
}
const tacticIdOf = (c) => (c && c.kind === 'tactic' ? (c.tacticId || c.tactic || null) : null);

// ================================================================ evaluation

/** Chemistry / evaluateXi entry for a card playing at `pos`. */
function entryOf(card, wp, pos) {
  return {
    playerId: wp.id, nation: wp.nation, clubId: card.signedFromClubId, leagueId: card.leagueId,
    isIcon: isIconCard(card), pos, nativePos: wp.pos, altPos: wp.altPos || [],
    stats: wp.stats, upgrades: card.upgrades || [], traits: card.traits || [], styleId: card.styleId || null,
    rarity: isIconCard(card) ? 'icon' : card.rarity,
  };
}

/**
 * Evaluate a squad object: chemistry and effective stats of the XI (empty slots skipped).
 * @returns {{ filled:number[], entries:object[], chem:object, players:object[], ovr:number, chemTeam:number,
 *   perSlot:Array<null|{entry, eff, chem}> }}
 */
function evaluateSquad(sq, byId, world, manager) {
  const slots = FORMATIONS[sq.formation].slots;
  const filled = [];
  const entries = [];
  sq.xi.forEach((id, i) => {
    const card = id ? byId.get(id) : null;
    const wp = card ? worldPlayerOf(card, world) : null;
    if (!card || !wp) return;
    filled.push(i);
    entries.push(entryOf(card, wp, slots[i].pos));
  });
  const ev = evaluateXi(entries, manager);
  const perSlot = sq.xi.map(() => null);
  filled.forEach((slotIdx, k) => { perSlot[slotIdx] = { entry: entries[k], eff: ev.players[k], chem: ev.chem.perPlayer[k] }; });
  // empty slots count as 0 in the team OVR (an empty slot must hurt the preview)
  const ovr = ev.players.reduce((a, p) => a + p.ovr, 0) / slots.length;
  return { filled, entries, chem: ev.chem, players: ev.players, ovr, chemTeam: ev.chem.team, perSlot };
}

/** Effective OVR of a card at a position with zero chemistry (base for auto building). */
function ovrAt(card, wp, pos) {
  return effectiveStats({
    stats: wp.stats, upgrades: card.upgrades || [], traits: card.traits || [], styleId: card.styleId || null,
    chem: 0, nativePos: wp.pos, altPos: wp.altPos || [], playedPos: pos, rarity: isIconCard(card) ? 'icon' : card.rarity,
  }).ovr;
}

/** 0 = natural (native or secondary), 1 = same line (amber), 2 = further (red). */
export function oopLevel(wp, playedPos) {
  const { label } = oopPenalty(wp.pos, wp.altPos || [], playedPos);
  if (label === 'natural' || label === 'secondary position') return 0;
  if (label === 'same line') return 1;
  return 2;
}

const canKeep = (wp) => wp.pos === 'GK' || (wp.altPos || []).includes('GK');

// ================================================================ swap

function resolveRef(sq, state, ref) {
  if (!ref || typeof ref !== 'object') return fail('bad_ref', ERR.unknownLocation);
  if (ref.zone === 'xi') {
    if (!Number.isInteger(ref.index) || ref.index < 0 || ref.index >= sq.xi.length) return fail('bad_ref', ERR.noPitchSlot);
    return { ok: true, zone: 'xi', index: ref.index, cardId: sq.xi[ref.index] };
  }
  if (ref.zone === 'bench') {
    if (!Number.isInteger(ref.index) || ref.index < 0 || ref.index >= SQUAD_RULES.benchSize) return fail('bad_ref', ERR.noBenchSlot);
    return { ok: true, zone: 'bench', index: Math.min(ref.index, sq.bench.length), cardId: sq.bench[ref.index] ?? null };
  }
  if (ref.zone === 'reserve') {
    if (ref.cardId == null) return { ok: true, zone: 'reserve', cardId: null };
    const card = (state.cards || []).find((c) => c.id === ref.cardId);
    if (!isPlayerCard(card)) return fail('bad_card', ERR.notYourCard);
    if (sq.xi.includes(ref.cardId) || sq.bench.includes(ref.cardId)) return fail('bad_ref', ERR.notReserve);
    return { ok: true, zone: 'reserve', cardId: ref.cardId };
  }
  return fail('bad_ref', ERR.unknownLocation);
}

/** Pure: the squad after a swap, or an error. Does not touch state. */
export function swapSquad(state, a, b) {
  const sq = normSquad(state.squad);
  const ra = resolveRef(sq, state, a);
  if (!ra.ok) return ra;
  const rb = resolveRef(sq, state, b);
  if (!rb.ok) return rb;
  if (ra.zone === 'reserve' && rb.zone === 'reserve') return fail('noop', ERR.bothReserves);
  if (ra.zone === rb.zone && ra.index === rb.index) return fail('noop', ERR.sameSlot);
  if (ra.cardId == null && rb.cardId == null) return fail('empty', ERR.nothingToMove);
  const xi = sq.xi.slice();
  const bench = sq.bench.slice();
  const put = (loc, id) => {
    if (loc.zone === 'xi') xi[loc.index] = id;
    else if (loc.zone === 'bench') bench[loc.index] = id;
  };
  put(ra, rb.cardId);
  put(rb, ra.cardId);
  const nextBench = bench.filter((x) => x != null);
  if (nextBench.length > SQUAD_RULES.benchSize) return fail('bench_full', fmt(ERR.benchFull, { n: SQUAD_RULES.benchSize }));
  const all = [...xi, ...nextBench].filter(Boolean);
  if (new Set(all).size !== all.length) return fail('duplicate', ERR.duplicate);
  const next = { ...sq, xi, bench: nextBench };
  next.roles = cleanRoles(next);
  return { ok: true, squad: next };
}

/** Roles whose holder left the XI and bench are cleared. */
function cleanRoles(sq) {
  const inSquad = new Set([...sq.xi, ...sq.bench].filter(Boolean));
  const roles = {};
  for (const r of SQUAD_ROLES) roles[r] = sq.roles[r] && inSquad.has(sq.roles[r]) ? sq.roles[r] : null;
  return roles;
}

/** ACTION. Swap the contents of two locations (see refs at the top of the file). */
export function swap(state, a, b) {
  const r = swapSquad(state, a, b);
  if (!r.ok) return r;
  return commit(state, r.squad);
}

// ================================================================ assignment solver

/** Hungarian algorithm, min cost. cost: n rows x m cols with n <= m. Returns col index per row. Deterministic. */
export function solveAssignment(cost) {
  const n = cost.length;
  if (!n) return [];
  const m = cost[0].length;
  const INF = 1e15;
  const u = new Float64Array(n + 1);
  const v = new Float64Array(m + 1);
  const p = new Int32Array(m + 1);
  const way = new Int32Array(m + 1);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Float64Array(m + 1).fill(INF);
    const used = new Uint8Array(m + 1);
    do {
      used[j0] = 1;
      const i0 = p[j0];
      let delta = INF;
      let j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const ans = new Array(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) ans[p[j] - 1] = j - 1;
  return ans;
}

// ================================================================ formation

/** Pure: squad with a new formation, XI remapped by position (exact assignment). */
export function formationSquad(state, world, formationId) {
  const def = FORMATIONS[formationId];
  if (!def) return fail('bad_formation', fmt(ERR.unknownFormation, { id: formationId }));
  const sq = normSquad(state.squad);
  const old = FORMATIONS[sq.formation];
  const byId = cardIndex(state);
  const n = def.slots.length;
  const people = sq.xi.map((id, i) => {
    const card = id ? byId.get(id) : null;
    return { id, wp: card && world ? worldPlayerOf(card, world) : null, from: old.slots[i] };
  });
  while (people.length < n) people.push({ id: null, wp: null, from: null });
  // cost: out-of-position penalty dominates, then how far the card moves on the pitch, GK rule absolute
  const cost = def.slots.map((slot, si) => people.map((pp) => {
    if (!pp.id) return 0;
    let c = 0;
    if (pp.wp) {
      c += oopPenalty(pp.wp.pos, pp.wp.altPos || [], slot.pos).penalty * 100;
      if (si === 0 && !canKeep(pp.wp)) c += 1e7;
      if (si !== 0 && pp.wp.pos === 'GK') c += 1e7;
    }
    if (pp.from) c += Math.hypot(pp.from.lat - slot.lat, pp.from.depth - slot.depth);
    return c;
  }));
  const asg = solveAssignment(cost);
  const xi = asg.map((pi) => people[pi].id);
  const next = { ...sq, formation: formationId, xi };
  next.roles = cleanRoles(next);
  return { ok: true, squad: next };
}

/** ACTION. Change formation and remap the XI sensibly by position. */
export function setFormation(state, formationId, world) {
  const r = formationSquad(state, world, formationId);
  if (!r.ok) return r;
  return commit(state, r.squad);
}

// ================================================================ auto best XI

// Availability tiers: 0 = available and fit, 1 = available, low fitness, 2 = injured or suspended.
// Tier offsets are structural (they only order the tiers), not tuning numbers.
const TIER_COST = 1000;
function tierOf(card) {
  if (!isAvailable(card)) return 2;
  return (card.fitness ?? FITNESS.start) < SQUAD_RULES.lowFitness ? 1 : 0;
}

/**
 * Pure: best XI + bench for the current formation.
 * 1. exact assignment maximising effective OVR (no chemistry) with availability tiers and the GK rule,
 * 2. hill climb on mean effective OVR WITH chemistry (replace a starter by a non-starter, or exchange two starters),
 * 3. bench: best keeper, one per line (DEF / MID / ATT), then the best remaining, injured and suspended last.
 * Empty roles (or roles held by players who left the squad) get a suggestion.
 */
export function bestSquad(state, world, opts = {}) {
  const sq = normSquad(state.squad);
  const def = FORMATIONS[sq.formation];
  const slots = def.slots;
  const manager = managerOf(state);
  const pool = (state.cards || []).filter(isPlayerCard).map((card) => ({ card, wp: worldPlayerOf(card, world) })).filter((x) => x.wp);
  const usable = pool; // injured / suspended cards stay in the pool but sit in the last availability tier
  if (!usable.length) return fail('no_players', ERR.noPlayers);

  const ovrCache = new Map();
  const oa = (x, pos) => {
    const k = x.card.id + '|' + pos;
    if (!ovrCache.has(k)) ovrCache.set(k, ovrAt(x.card, x.wp, pos));
    return ovrCache.get(k);
  };
  const keeperOk = (x) => canKeep(x.wp);
  const anyKeeper = usable.some(keeperOk);
  const slotCost = (si, x) => {
    let c = -oa(x, slots[si].pos) + tierOf(x.card) * TIER_COST;
    if (si === 0 && !keeperOk(x)) c += anyKeeper ? 1e7 : 0;
    if (si !== 0 && x.wp.pos === 'GK') c += 1e6; // keepers never fill outfield slots unless forced
    return c;
  };
  // pad with dummy columns when there are fewer cards than slots
  const cols = usable.slice();
  const nDummy = Math.max(0, slots.length - cols.length);
  const cost = slots.map((_, si) => [...cols.map((x) => slotCost(si, x)), ...Array(nDummy).fill(1e8)]);
  const asg = solveAssignment(cost);
  let xiIdx = asg.map((c) => (c < cols.length ? c : -1));

  // hill climb with chemistry
  const xiCards = () => xiIdx.map((c) => (c >= 0 ? cols[c] : null));
  const score = (idxs) => {
    const entries = [];
    let tiers = 0;
    let illegal = 0;
    idxs.forEach((c, si) => {
      if (c < 0) return;
      const x = cols[c];
      entries.push(entryOf(x.card, x.wp, slots[si].pos));
      tiers += tierOf(x.card);
      if (si === 0 && anyKeeper && !keeperOk(x)) illegal++;
      if (si !== 0 && x.wp.pos === 'GK') illegal++;
    });
    const ev = evaluateXi(entries, manager);
    const sum = ev.players.reduce((a, p) => a + p.ovr, 0);
    return sum - tiers * TIER_COST - illegal * 1e7;
  };
  let best = score(xiIdx);
  for (let pass = 0; pass < 6; pass++) {
    let improved = false;
    const inXi = new Set(xiIdx.filter((c) => c >= 0));
    for (let si = 0; si < slots.length; si++) {
      for (let c = 0; c < cols.length; c++) {
        if (inXi.has(c)) continue;
        const trial = xiIdx.slice();
        trial[si] = c;
        const s = score(trial);
        if (s > best + 1e-9) { best = s; inXi.delete(xiIdx[si]); inXi.add(c); xiIdx = trial; improved = true; }
      }
    }
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const trial = xiIdx.slice();
        trial[i] = xiIdx[j]; trial[j] = xiIdx[i];
        const s = score(trial);
        if (s > best + 1e-9) { best = s; xiIdx = trial; improved = true; }
      }
    }
    if (!improved) break;
  }
  const xi = xiCards().map((x) => (x ? x.card.id : null));

  // bench
  const used = new Set(xi.filter(Boolean));
  const rest = cols.filter((x) => !used.has(x.card.id))
    .sort((p, q) => tierOf(p.card) - tierOf(q.card) || q.wp.ovr - p.wp.ovr || (p.card.id < q.card.id ? -1 : 1));
  const bench = [];
  const take = (pred) => {
    const x = rest.find((y) => !bench.includes(y) && pred(y) && tierOf(y.card) < 2);
    if (x && bench.length < SQUAD_RULES.benchSize) bench.push(x);
  };
  take((x) => x.wp.pos === 'GK');
  for (const line of ['def', 'mid', 'att']) take((x) => POS_LINE[x.wp.pos] === line);
  for (const x of rest) {
    if (bench.length >= SQUAD_RULES.benchSize) break;
    if (!bench.includes(x) && (x.wp.pos !== 'GK' || !bench.some((b) => b.wp.pos === 'GK'))) bench.push(x);
  }
  for (const x of rest) { // only if still short: second keeper or unavailable cards
    if (bench.length >= SQUAD_RULES.benchSize) break;
    if (!bench.includes(x)) bench.push(x);
  }
  bench.sort((p, q) => LINE_RANK[POS_LINE[p.wp.pos]] - LINE_RANK[POS_LINE[q.wp.pos]] || q.wp.ovr - p.wp.ovr);
  const next = { ...sq, xi, bench: bench.map((x) => x.card.id) };
  next.roles = cleanRoles(next);
  next.roles = { ...next.roles, ...suggestRoles(state, world, next, true) };
  return { ok: true, squad: next, noKeeper: !anyKeeper };
}

/** ACTION. Auto best XI for the current formation (mutates state.squad.xi / bench / empty roles). */
export function autoBestXI(state, world) {
  const r = bestSquad(state, world);
  if (!r.ok) return r;
  const res = commit(state, r.squad);
  if (r.noKeeper) res.warning = 'no_keeper';
  return res;
}

// ================================================================ roles

const ROLE_STAT = {
  captain: (wp, card) => (card.traits || []).includes('leader') * 100 + (wp.stats.men || 0),
  penalties: (wp, card) => (card.traits || []).includes('deadBall') * 100 + (wp.pos === 'GK' ? 0 : (wp.stats.sho || 0)),
  freeKicks: (wp, card) => (card.traits || []).includes('deadBall') * 100 + (wp.pos === 'GK' ? 0 : (wp.stats.pas || 0) * 0.6 + (wp.stats.sho || 0) * 0.4),
  corners: (wp, card) => (card.traits || []).includes('deadBall') * 100 + (wp.pos === 'GK' ? 0 : (wp.stats.pas || 0)),
};
/** Stat shown next to each candidate in the role pickers. */
export const ROLE_KEY_STAT = { captain: 'men', penalties: 'sho', freeKicks: 'pas', corners: 'pas' };

/** Suggested holders for roles (XI only). onlyEmpty: keep roles that already have a holder in the XI or bench. */
export function suggestRoles(state, world, sq = normSquad(state.squad), onlyEmpty = false) {
  const byId = cardIndex(state);
  const xi = sq.xi.filter(Boolean).map((id) => byId.get(id)).filter(Boolean).map((card) => ({ card, wp: worldPlayerOf(card, world) })).filter((x) => x.wp);
  const out = {};
  for (const r of SQUAD_ROLES) {
    if (onlyEmpty && sq.roles[r]) continue;
    let best = null;
    let bv = -1;
    for (const x of xi) {
      const v = ROLE_STAT[r](x.wp, x.card);
      if (v > bv) { bv = v; best = x.card.id; }
    }
    out[r] = best;
  }
  return out;
}

/** Role picker candidates: XI first then bench, each sorted by suitability. */
export function roleCandidates(state, world, role) {
  const sq = normSquad(state.squad);
  const byId = cardIndex(state);
  const rows = [];
  const add = (id, where) => {
    const card = id ? byId.get(id) : null;
    const wp = card ? worldPlayerOf(card, world) : null;
    if (!wp) return;
    const key = ROLE_KEY_STAT[role];
    const val = wp.pos === 'GK' && key !== 'men' ? null : wp.stats[key] ?? null;
    rows.push({ cardId: id, name: wp.name, pos: wp.pos, where, stat: key, statLabel: STAT_LABELS[key], value: val, score: ROLE_STAT[role](wp, card), leader: (card.traits || []).includes('leader'), deadBall: (card.traits || []).includes('deadBall') });
  };
  sq.xi.forEach((id) => add(id, 'xi'));
  sq.bench.forEach((id) => add(id, 'bench'));
  rows.sort((a, b) => (a.where === b.where ? b.score - a.score : a.where === 'xi' ? -1 : 1));
  return rows;
}

/** ACTION. Set a role holder (card in the XI or on the bench) or clear it with cardId null. */
export function setRole(state, role, cardId) {
  if (!SQUAD_ROLES.includes(role)) return fail('bad_role', fmt(ERR.unknownRole, { role }));
  const sq = normSquad(state.squad);
  if (cardId != null && !sq.xi.includes(cardId) && !sq.bench.includes(cardId)) return fail('not_in_squad', ERR.pickFromSquad);
  return commit(state, { roles: { ...sq.roles, [role]: cardId ?? null } });
}

// ================================================================ fitness fix

/**
 * ACTION. Swap out starters under SQUAD_RULES.lowFitness (and injured / suspended starters) for fitter bench cards
 * that play the slot's position naturally (native or secondary); falls back to reserves with a natural position.
 * Returns { fixed:[{slot, out, in}], unfixed:[slot] }.
 */
export function autoFixFitness(state, world) {
  let sq = normSquad(state.squad);
  const byId = cardIndex(state);
  const slots = FORMATIONS[sq.formation].slots;
  const fixed = [];
  const unfixed = [];
  const fitOk = (c) => isAvailable(c) && (c.fitness ?? FITNESS.start) >= SQUAD_RULES.lowFitness;
  for (let i = 0; i < slots.length; i++) {
    const id = sq.xi[i];
    const card = id ? byId.get(id) : null;
    if (!card || fitOk(card)) continue;
    const pos = slots[i].pos;
    const pick = (ids, zone) => {
      let best = null;
      ids.forEach((cid, idx) => {
        const c = byId.get(cid);
        if (!c || !fitOk(c)) return;
        const wp = worldPlayerOf(c, world);
        if (!wp || !isNaturalPosition({ pos, nativePos: wp.pos, altPos: wp.altPos })) return;
        const v = ovrAt(c, wp, pos);
        if (!best || v > best.v) best = { v, ref: zone === 'bench' ? { zone, index: idx } : { zone, cardId: cid }, cid };
      });
      return best;
    };
    const cand = pick(sq.bench, 'bench') || pick(reserves({ ...state, squad: sq }), 'reserve');
    if (!cand) { unfixed.push(i); continue; }
    const r = swapSquad({ ...state, squad: sq }, { zone: 'xi', index: i }, cand.ref);
    if (!r.ok) { unfixed.push(i); continue; }
    sq = r.squad;
    fixed.push({ slot: i, out: id, in: cand.cid });
  }
  const res = commit(state, sq);
  return { ...res, fixed, unfixed };
}

// ================================================================ presets

/** ACTION. Save the current squad into preset slot 0..2. */
export function savePreset(state, slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= SQUAD_RULES.presetSlots) return fail('bad_slot', ERR.noPresetSlot);
  const sq = normSquad(state.squad);
  const presets = sq.presets.slice();
  presets[slot] = {
    formation: sq.formation, xi: sq.xi.slice(), bench: sq.bench.slice(), settings: { ...sq.settings },
    roles: { ...sq.roles }, tacticCards: sq.tacticCards.slice(),
  };
  return commit(state, { presets });
}

/**
 * ACTION. Load preset slot 0..2. Cards sold since the save are dropped; their XI slots are refilled from the cards
 * left over (natural position first, then best effective OVR). Returns { missing:[cardId] }.
 */
export function loadPreset(state, slot, world) {
  const sq = normSquad(state.squad);
  const p = sq.presets[slot];
  if (!p) return fail('empty_preset', ERR.presetEmpty);
  const byId = cardIndex(state);
  const missing = [];
  const okPlayer = (id) => { if (id == null) return null; if (isPlayerCard(byId.get(id))) return id; missing.push(id); return null; };
  const formation = FORMATIONS[p.formation] ? p.formation : sq.formation;
  const n = FORMATIONS[formation].slots.length;
  const xi = Array.from({ length: n }, (_, i) => okPlayer(p.xi && p.xi[i]));
  const bench = (p.bench || []).map(okPlayer).filter(Boolean).filter((id) => !xi.includes(id));
  const tacticCards = (p.tacticCards || []).map((id) => (id && byId.get(id) && byId.get(id).kind === 'tactic' ? id : null));
  let next = normSquad({ ...sq, formation, xi, bench, settings: p.settings, roles: p.roles || {}, tacticCards });
  // refill empty slots
  const empty = next.xi.map((id, i) => (id ? -1 : i)).filter((i) => i >= 0);
  if (empty.length && world) {
    const used = new Set([...next.xi, ...next.bench].filter(Boolean));
    let pool = (state.cards || []).filter((c) => isPlayerCard(c) && !used.has(c.id));
    if (pool.length < empty.length) pool = pool.concat(next.bench.map((id) => byId.get(id)));
    const cand = pool.map((card) => ({ card, wp: worldPlayerOf(card, world) })).filter((x) => x.wp);
    const slots = FORMATIONS[formation].slots;
    if (cand.length) {
      const nD = Math.max(0, empty.length - cand.length);
      const cost = empty.map((si) => [...cand.map((x) => -ovrAt(x.card, x.wp, slots[si].pos) + tierOf(x.card) * TIER_COST
        + (si === 0 && !canKeep(x.wp) ? 1e6 : 0)), ...Array(nD).fill(1e8)]);
      const asg = solveAssignment(cost);
      const xi2 = next.xi.slice();
      empty.forEach((si, k) => { if (asg[k] < cand.length) xi2[si] = cand[asg[k]].card.id; });
      next = { ...next, xi: xi2, bench: next.bench.filter((id) => !xi2.includes(id)) };
    }
  }
  next.roles = cleanRoles(next);
  const res = commit(state, { ...next, presets: sq.presets });
  return { ...res, missing };
}

// ================================================================ settings and tactic cards

/** ACTION. Set one free tactic setting (mentality, pressing, width, passing, defLine) or 'formation'. */
export function setSetting(state, key, value, world) {
  if (key === 'formation') return setFormation(state, value, world);
  if (!TACTIC_OPTIONS[key]) return fail('bad_setting', fmt(ERR.unknownSetting, { key }));
  if (!TACTIC_OPTIONS[key].includes(value)) return fail('bad_value', fmt(ERR.badValue, { key, value }));
  const sq = normSquad(state.squad);
  return commit(state, { settings: { ...sq.settings, [key]: value } });
}

/** ACTION. Equip a tactic card (state.cards id, kind 'tactic') in slot 0..2, or clear the slot with null. */
export function equipTacticCard(state, slot, cardId) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= SQUAD_RULES.tacticSlots) return fail('bad_slot', ERR.noTacticSlot);
  const sq = normSquad(state.squad);
  const tc = sq.tacticCards.slice();
  if (cardId == null) { tc[slot] = null; return commit(state, { tacticCards: tc }); }
  const byId = cardIndex(state);
  const card = byId.get(cardId);
  const tid = tacticIdOf(card);
  if (!tid || !TACTIC_CARDS.some((t) => t.id === tid)) return fail('bad_card', ERR.notTacticCard);
  for (let i = 0; i < tc.length; i++) {
    if (i === slot || !tc[i]) continue;
    if (tc[i] === cardId) tc[i] = null; // moving the same card between slots
    else if (tacticIdOf(byId.get(tc[i])) === tid) return fail('duplicate_tactic', ERR.duplicateTactic);
  }
  tc[slot] = cardId;
  return commit(state, { tacticCards: tc });
}

// ================================================================ item cards (training / trait / style / consumable)

/**
 * Item card schemas assumed here (not frozen anywhere yet, reported to the main session):
 *   training   { kind:'training', stat?, amount }    stat may come from the action payload when the card has none
 *   trait      { kind:'trait', traitId }
 *   style      { kind:'style', styleId }
 *   consumable { kind:'consumable', effect:'fitness'|'heal'|'contract'|'morale', amount }
 * Applying consumes the item card.
 */
export function canApplyItem(state, world, itemCard, playerCard, stat) {
  const wp = worldPlayerOf(playerCard, world);
  if (!wp) return fail('bad_card', ERR.unknownPlayer);
  switch (itemCard.kind) {
    case 'training': {
      if (isIconCard(playerCard)) return fail('icon_fixed', ERR.iconFixed);
      const s = itemCard.stat || stat;
      if (!s) return fail('need_stat', ERR.needStat);
      if (!statKeysFor(wp.pos).includes(s)) return fail('bad_stat', ERR.notStatOfPlayer);
      const rar = rarityOfCard(playerCard, wp);
      if ((playerCard.upgrades || []).length >= upgradeSlots(rar)) return fail('no_slot', ERR.noSlot);
      return { ok: true };
    }
    case 'trait': return canApplyTrait(playerCard, wp, itemCard.traitId);
    case 'style': return canApplyStyle(playerCard, wp, itemCard.styleId);
    case 'consumable': {
      const e = itemCard.effect;
      if (e === 'fitness') return (playerCard.fitness ?? 100) >= 100 ? fail('full', ERR.fullFitness) : { ok: true };
      if (e === 'heal') return playerCard.injuredFor > 0 ? { ok: true } : fail('not_injured', ERR.notInjured);
      if (e === 'contract') return { ok: true };
      if (e === 'morale') return (playerCard.morale ?? MORALE.start) >= MORALE.max ? fail('full', ERR.moraleMax) : { ok: true };
      return fail('bad_item', ERR.unknownConsumable);
    }
    default: return fail('bad_item', ERR.cannotApply);
  }
}

/** Items in state.cards that could be applied to a player card, with ok/error per item. */
export function applicableItems(state, world, playerCardId) {
  const byId = cardIndex(state);
  const pc = byId.get(playerCardId);
  if (!isPlayerCard(pc)) return [];
  return (state.cards || []).filter((c) => ['training', 'trait', 'style', 'consumable'].includes(c.kind))
    .map((c) => ({ card: c, check: canApplyItem(state, world, c, pc, c.stat) }));
}

/**
 * ACTION. Apply an item card to a player card and consume the item. Training also raises the world potential of
 * that stat (world.setPotential) as the spec requires.
 */
export function applyItemCard(state, world, { itemCardId, playerCardId, stat }) {
  const byId = cardIndex(state);
  const item = byId.get(itemCardId);
  const pc = byId.get(playerCardId);
  if (!item) return fail('bad_item', ERR.unknownItem);
  if (!isPlayerCard(pc)) return fail('bad_card', ERR.unknownPlayerCard);
  const chk = canApplyItem(state, world, item, pc, stat);
  if (!chk.ok) return chk;
  const wp = worldPlayerOf(pc, world);
  let nextCard;
  let potentialDelta = null;
  if (item.kind === 'training') {
    const r = applyTrainingCard(pc, wp, { stat: item.stat || stat, amount: item.amount });
    if (!r.ok) return r;
    nextCard = r.card; potentialDelta = r.potentialDelta;
  } else if (item.kind === 'trait') {
    const r = applyTrait(pc, wp, item.traitId); if (!r.ok) return r; nextCard = r.card;
  } else if (item.kind === 'style') {
    const r = applyStyle(pc, wp, item.styleId); if (!r.ok) return r; nextCard = r.card;
  } else {
    const amt = Number(item.amount);
    nextCard = { ...pc };
    if (item.effect === 'fitness') nextCard.fitness = Math.min(FITNESS.start, (pc.fitness ?? FITNESS.start) + (amt || 0));
    else if (item.effect === 'heal') nextCard.injuredFor = amt > 0 ? Math.max(0, pc.injuredFor - amt) : 0;
    else if (item.effect === 'contract') nextCard.contract = (pc.contract || 0) + (amt || COINS.contractStart);
    else if (item.effect === 'morale') nextCard.morale = Math.min(MORALE.max, (pc.morale ?? MORALE.start) + (amt || 0));
  }
  if (potentialDelta && !isIconCard(pc) && world.setPotential && world.getPlayer(pc.playerId)) {
    const cur = world.getPlayer(pc.playerId).potential[potentialDelta.stat] || 0;
    world.setPotential(pc.playerId, potentialDelta.stat, cur + potentialDelta.amount);
  }
  Object.assign(pc, nextCard);
  state.cards = state.cards.filter((c) => c.id !== itemCardId);
  return { ok: true, state, card: pc };
}

// ================================================================ quick sell

/** ACTION. Quick-sell a player card: coins by rarity, player released to free agency, removed from the squad. */
export function quickSell(state, world, cardId) {
  const byId = cardIndex(state);
  const card = byId.get(cardId);
  if (!isPlayerCard(card)) return fail('bad_card', ERR.notYourCard);
  const wp = worldPlayerOf(card, world);
  const rar = rarityOfCard(card, wp);
  const value = quickSellValue(rar) || 0;
  const sq = normSquad(state.squad);
  const next = { ...sq, xi: sq.xi.map((id) => (id === cardId ? null : id)), bench: sq.bench.filter((id) => id !== cardId) };
  next.roles = cleanRoles(next);
  if (!isIconCard(card) && world.releaseToFreeAgents && world.getPlayer(card.playerId)) world.releaseToFreeAgents(card.playerId);
  state.cards = state.cards.filter((c) => c.id !== cardId);
  state.coins = (state.coins || 0) + value;
  const res = commit(state, next);
  return { ...res, coins: value };
}

// ================================================================ wages

/**
 * Fallback average match income for the wage budget when the caller has no history: mean of matchIncome over a
 * home and an away win (2-0), draw (1-1) and loss (0-1) at the given pyramid level. The scorelines are a stand-in,
 * not tuning; pass ctx.avgMatchIncome when real data exists.
 */
export function defaultAvgMatchIncome(level = 5, stadiumTier = 0) {
  const results = [[2, 0], [1, 1], [0, 1]];
  let s = 0;
  for (const home of [true, false]) for (const [gf, ga] of results) s += matchIncome({ goalsFor: gf, goalsAgainst: ga, home, level, stadiumTier });
  return s / 6;
}

export function wageSummary(state, world, ctx = {}) {
  let total = 0;
  for (const c of state.cards || []) {
    if (!isPlayerCard(c) || isIconCard(c)) continue;
    const wp = worldPlayerOf(c, world);
    if (wp) total += wagePerMatch(Math.max(COINS.wage.ovrOffset, wp.ovr));
  }
  const level = (state.season && state.season.level) || 5;
  const avg = ctx.avgMatchIncome ?? defaultAvgMatchIncome(level, (state.club && state.club.stadiumTier) || 0);
  const budget = Math.round(avg * COINS.wageBudgetShare);
  return { total: Math.round(total), budget, over: total > budget, avgMatchIncome: Math.round(avg) };
}

// ================================================================ views

function clubOf(world, clubId) {
  return clubId >= 0 && world.getClub ? world.getClub(clubId) : null;
}

/** Flat card view model for ui/components/card.js. */
function cardViewOf(state, world, card, wp, { pos, ovr, stats, chem, oop, extra } = {}) {
  const club = clubOf(world, card.signedFromClubId);
  const nat = NATION_BY_CODE[wp.nation];
  const rar = rarityOfCard(card, wp);
  const style = card.styleId ? STYLE_CARDS[card.styleId] : null;
  const kit = (state.club && state.club.colours) || [];
  return {
    kind: 'player', id: card.id, rarity: rar, isIcon: isIconCard(card),
    ovr: ovr ?? wp.ovr, pos: pos || wp.pos, altPos: wp.altPos || [], name: wp.name,
    nation: wp.nation, flag: nat ? nat.flag : '', nationColours: nat ? nat.colours : undefined, nationName: nat ? nat.name : wp.nation,
    crest: club ? club.crest : null, clubName: club ? club.name : '',
    age: wp.age, stats: stats || wp.stats,
    avatarSeed: world.avatarSeed && !isIconCard(card) ? world.avatarSeed(card.playerId) : card.playerId,
    kitColour: kit[0], kitColour2: kit[1],
    traits: (card.traits || []).map((t) => (TRAIT_CATALOGUE[t] ? TRAIT_CATALOGUE[t].name : t)),
    styleLabel: style ? style.name : null,
    upgradesUsed: (card.upgrades || []).length, upgradeSlots: upgradeSlots(rar),
    status: {
      fitness: card.fitness ?? FITNESS.start,
      injured: card.injuredFor > 0 ? card.injuredFor : false,
      suspended: card.suspendedFor > 0 ? card.suspendedFor : false,
      contractLow: card.contract != null && card.contract <= SQUAD_RULES.contractLowAt,
      outOfPos: oop || 0,
      chem: chem ?? null,
    },
    ...(extra || {}),
  };
}

function benchItem(state, world, card, zone, index) {
  const wp = worldPlayerOf(card, world);
  if (!wp) return null;
  return {
    zone, index, cardId: card.id, card, wp, pos: wp.pos, ovr: wp.ovr, rarity: rarityOfCard(card, wp),
    fitness: card.fitness ?? FITNESS.start, available: isAvailable(card),
    view: cardViewOf(state, world, card, wp, {}),
  };
}

/**
 * Everything the squad screen needs.
 * ctx (optional): { avgMatchIncome }
 * @returns {{ formation:string, formationDef:object, slots:object[], links:object[], linked:number[][],
 *   header:object, bench:object[], reserves:object[], roles:object, tacticCards:object[], issues:object, manager:object|null }}
 */
export function squadView(state, world, ctx = {}) {
  const sq = normSquad(state.squad);
  const def = FORMATIONS[sq.formation];
  const byId = cardIndex(state);
  const manager = managerOf(state);
  const ev = evaluateSquad(sq, byId, world, manager);
  const slots = def.slots.map((slot, i) => {
    const id = sq.xi[i];
    const base = { index: i, slotPos: slot.pos, lat: slot.lat, depth: slot.depth, line: POS_LINE[slot.pos], cardId: id || null };
    const ps = ev.perSlot[i];
    if (!id || !ps) return { ...base, empty: true, oop: 0 };
    const card = byId.get(id);
    const wp = worldPlayerOf(card, world);
    const oop = oopLevel(wp, slot.pos);
    const roleOf = SQUAD_ROLES.filter((r) => sq.roles[r] === id);
    return {
      ...base, empty: false, card, wp, nativePos: wp.pos, ovr: ps.eff.ovr, baseOvr: wp.ovr, delta: ps.eff.ovr - wp.ovr,
      stats: ps.eff.stats, chem: ps.chem, chemDetail: ev.chem.detail[ev.filled.indexOf(i)], oop, oopLabel: ps.eff.oopLabel, penalty: ps.eff.penalty,
      roles: roleOf, available: isAvailable(card), fitness: card.fitness ?? FITNESS.start,
      view: cardViewOf(state, world, card, wp, { pos: slot.pos, ovr: ps.eff.ovr, stats: ps.eff.stats, chem: ps.chem, oop }),
    };
  });
  const links = def.links.map(([a, b]) => {
    const ea = ev.perSlot[a];
    const eb = ev.perSlot[b];
    return { a, b, colour: ea && eb ? linkColour(ea.entry, eb.entry) : 'none' };
  });
  const linked = slots.map((_, i) => {
    const me = ev.perSlot[i];
    if (!me) return [];
    const out = [];
    ev.perSlot.forEach((o, j) => { if (o && j !== i && linkColour(me.entry, o.entry) !== 'red') out.push(j); });
    return out;
  });
  const ratings = teamRatings({ xi: slots.filter((s) => !s.empty).map((s) => ({ pos: s.slotPos, stats: s.stats, ovr: s.ovr })) });
  const wages = wageSummary(state, world, ctx);
  const header = {
    formation: sq.formation, ovr: round1(ev.ovr), att: ratings.att, mid: ratings.mid, def: ratings.def, gk: ratings.gk,
    chemistry: ev.chemTeam, chemMax: 33, wages: wages.total, wageBudget: wages.budget, overBudget: wages.over,
  };
  const bench = [];
  for (let i = 0; i < SQUAD_RULES.benchSize; i++) {
    const id = sq.bench[i];
    const card = id ? byId.get(id) : null;
    bench.push(card ? benchItem(state, world, card, 'bench', i) : { zone: 'bench', index: i, empty: true });
  }
  const res = reserves(state).map((id) => benchItem(state, world, byId.get(id), 'reserve', -1)).filter(Boolean);
  const roles = {};
  for (const r of SQUAD_ROLES) roles[r] = sq.roles[r];
  return {
    formation: sq.formation, formationDef: def, slots, links, linked, header, bench, reserves: res, roles,
    tacticCards: sq.tacticCards, manager, presets: sq.presets.map((p) => !!p), issues: validate(state, world),
  };
}

/** Filter and sort strip items (reserves). filters: { pos:'ALL'|pos|line, rarity:'ALL'|rarity, sort:'ovr'|'fitness' } */
export function filterStrip(items, { pos = 'ALL', rarity = 'ALL', sort = 'ovr' } = {}) {
  let out = items.filter((x) => !x.empty);
  if (pos && pos !== 'ALL') out = out.filter((x) => x.pos === pos || POS_LINE[x.pos] === pos || (x.wp.altPos || []).includes(pos));
  if (rarity && rarity !== 'ALL') out = out.filter((x) => x.rarity === rarity);
  const key = sort === 'fitness' ? (x) => x.fitness : (x) => x.ovr;
  return out.slice().sort((a, b) => key(b) - key(a) || b.ovr - a.ovr || (a.cardId < b.cardId ? -1 : 1));
}

/** Read-only drag preview: team before / after swapping two locations. */
export function previewSwap(state, world, a, b) {
  const r = swapSquad(state, a, b);
  if (!r.ok) return r;
  const byId = cardIndex(state);
  const manager = managerOf(state);
  const before = evaluateSquad(normSquad(state.squad), byId, world, manager);
  const after = evaluateSquad(r.squad, byId, world, manager);
  // the dragged card (from `a`) lands at `b`: report its effective OVR when it ends up in the XI
  let landing = null;
  const movedId = a.zone === 'reserve' ? a.cardId : a.zone === 'xi' ? normSquad(state.squad).xi[a.index] : normSquad(state.squad).bench[a.index];
  const at = r.squad.xi.indexOf(movedId);
  if (at >= 0 && after.perSlot[at]) landing = { slot: at, ovr: after.perSlot[at].eff.ovr, chem: after.perSlot[at].chem, oop: oopLevel(worldPlayerOf(byId.get(movedId), world), FORMATIONS[r.squad.formation].slots[at].pos) };
  return {
    ok: true,
    ovrBefore: round1(before.ovr), ovrAfter: round1(after.ovr), dOvr: round1(after.ovr - before.ovr),
    chemBefore: before.chemTeam, chemAfter: after.chemTeam, dChem: after.chemTeam - before.chemTeam,
    landing,
  };
}

/**
 * Previews for every possible drop target of the card at `from` (all pitch slots, bench slots, reserves, and the
 * reserves area). Keys: 'xi:3', 'bench:2', 'res:<cardId>', 'res:'. Invalid targets are left out.
 */
export function previewTargets(state, world, from) {
  const sq = normSquad(state.squad);
  const out = {};
  const tryRef = (key, ref) => { const p = previewSwap(state, world, from, ref); if (p.ok) out[key] = p; };
  sq.xi.forEach((_, i) => tryRef('xi:' + i, { zone: 'xi', index: i }));
  for (let i = 0; i <= Math.min(sq.bench.length, SQUAD_RULES.benchSize - 1); i++) tryRef('bench:' + i, { zone: 'bench', index: i });
  if (from.zone !== 'reserve') {
    for (const id of reserves(state)) tryRef('res:' + id, { zone: 'reserve', cardId: id });
    tryRef('res:', { zone: 'reserve' });
  }
  return out;
}

// ================================================================ validation

/**
 * @returns {{ ok:boolean, errors:Array<{code:string, slot?:number, cardId?:string}>, warnings:Array<{code:string, slot?:number, cardId?:string}> }}
 */
export function validate(state, world) {
  const errors = [];
  const warnings = [];
  const raw = state.squad || {};
  if (!FORMATIONS[raw.formation]) errors.push({ code: 'bad_formation' });
  const sq = normSquad(raw);
  const n = FORMATIONS[sq.formation].slots.length;
  if (!Array.isArray(raw.xi) || raw.xi.length !== n) errors.push({ code: 'xi_size' });
  if ((raw.bench || []).length > SQUAD_RULES.benchSize) errors.push({ code: 'bench_size' });
  const byId = cardIndex(state);
  const seen = new Set();
  const check = (id, where, slot) => {
    if (id == null) return;
    if (seen.has(id)) errors.push({ code: 'duplicate', cardId: id });
    seen.add(id);
    if (!isPlayerCard(byId.get(id))) errors.push({ code: 'missing_card', cardId: id, slot });
  };
  sq.xi.forEach((id, i) => { if (id == null) errors.push({ code: 'empty_slot', slot: i }); check(id, 'xi', i); });
  sq.bench.forEach((id) => check(id, 'bench'));
  const slots = FORMATIONS[sq.formation].slots;
  sq.xi.forEach((id, i) => {
    const card = id ? byId.get(id) : null;
    const wp = card && world ? worldPlayerOf(card, world) : null;
    if (!card || !wp) return;
    if (i === 0 && !canKeep(wp)) warnings.push({ code: 'no_keeper_in_goal', slot: i, cardId: id });
    if (card.injuredFor > 0) warnings.push({ code: 'injured', slot: i, cardId: id });
    if (card.suspendedFor > 0) warnings.push({ code: 'suspended', slot: i, cardId: id });
    if ((card.fitness ?? 100) < SQUAD_RULES.lowFitness) warnings.push({ code: 'low_fitness', slot: i, cardId: id });
    const lvl = oopLevel(wp, slots[i].pos);
    if (lvl) warnings.push({ code: lvl === 1 ? 'out_of_position' : 'far_out_of_position', slot: i, cardId: id });
  });
  const tcs = sq.tacticCards.filter(Boolean);
  if (new Set(tcs).size !== tcs.length) errors.push({ code: 'duplicate_tactic' });
  for (const id of tcs) if (!tacticIdOf(byId.get(id))) errors.push({ code: 'bad_tactic_card', cardId: id });
  for (const r of SQUAD_ROLES) {
    const id = sq.roles[r];
    if (id == null) { warnings.push({ code: 'role_empty', role: r }); continue; }
    if (!sq.xi.includes(id) && !sq.bench.includes(id)) errors.push({ code: 'role_not_in_squad', role: r, cardId: id });
    else if (!sq.xi.includes(id)) warnings.push({ code: 'role_on_bench', role: r, cardId: id });
  }
  for (const k in TACTIC_OPTIONS) if (raw.settings && raw.settings[k] != null && !TACTIC_OPTIONS[k].includes(raw.settings[k])) errors.push({ code: 'bad_setting', key: k });
  return { ok: errors.length === 0, errors, warnings };
}

// ================================================================ tactics view

/** Formation, line strengths and weakest line of an AI club, for the Analyst section. */
export function opponentReport(world, clubId) {
  const club = world.getClub(clubId);
  if (!club) return null;
  const ids = world.bestXI(clubId);
  const xi = Array.from(ids).map((id) => world.getPlayer(id)).filter(Boolean).map((p) => ({ pos: p.pos, stats: p.stats, ovr: p.ovr }));
  const r = teamRatings({ xi });
  const lines = { att: r.att, mid: r.mid, def: r.def };
  let weakest = 'att';
  for (const k of ['mid', 'def']) if (lines[k] < lines[weakest]) weakest = k;
  return {
    clubId, name: club.name, crest: club.crest, formation: club.identity ? club.identity.formation : null,
    style: club.identity ? club.identity.style : null, ratings: r, weakestLine: weakest,
  };
}

/** True when the club owns an Analyst staff card. */
export function hasStaff(state, role) {
  return (state.cards || []).some((c) => c.kind === 'staff' && c.role === role);
}

/**
 * Everything the tactics panel needs.
 * ctx (optional): { analyst: bool (override), opponent: opponentReport(...) result }
 */
export function tacticsView(state, world, ctx = {}) {
  const sq = normSquad(state.squad);
  const byId = cardIndex(state);
  const settings = sq.settings;
  const settingRows = Object.keys(TACTIC_OPTIONS).map((key) => ({
    key, value: settings[key], options: TACTIC_OPTIONS[key], isDefault: settings[key] === DEFAULT_SETTINGS[key],
    summary: SETTING_SUMMARY[key][settings[key]],
    summaries: Object.fromEntries(TACTIC_OPTIONS[key].map((o) => [o, SETTING_SUMMARY[key][o]])),
  }));
  const owned = (state.cards || []).filter((c) => c.kind === 'tactic' && tacticIdOf(c));
  const info = (c) => { const t = TACTIC_CARDS.find((x) => x.id === tacticIdOf(c)); return t ? { cardId: c.id, tacticId: t.id, name: t.name, upside: t.upside, cost: t.cost, rarity: c.rarity || 'bronze' } : null; };
  const tacticSlots = sq.tacticCards.map((id, slot) => ({ slot, card: id && byId.get(id) ? info(byId.get(id)) : null }));
  const roles = {};
  const candidates = {};
  for (const r of SQUAD_ROLES) {
    const id = sq.roles[r];
    const c = id ? byId.get(id) : null;
    const wp = c ? worldPlayerOf(c, world) : null;
    roles[r] = { cardId: id, name: wp ? wp.name : null };
    candidates[r] = roleCandidates(state, world, r);
  }
  const shape = shapePreview(sq.formation, settings);
  const nonDefault = settingRows.filter((s) => !s.isDefault).map((s) => `${s.key}.${s.value}`);
  const analyst = ctx.analyst ?? hasStaff(state, 'analyst');
  return {
    formation: sq.formation,
    formations: FORMATION_LIST.map((f) => ({ id: f.id, slots: f.slots.map((s) => ({ pos: s.pos, lat: s.lat, depth: s.depth })) })),
    settings: settingRows, tacticSlots, ownedTactics: owned.map(info).filter(Boolean),
    roles, roleCandidates: candidates, shape, tradeoffKeys: nonDefault,
    activeTactics: tacticSlots.filter((t) => t.card).map((t) => t.card),
    analyst: analyst ? { enabled: true, opponent: ctx.opponent || null } : null,
  };
}

// ================================================================ action map

/**
 * Action handlers for main.js: (state, payload, world) => result. All mutate `state` in place on success.
 *   squad/swap            { a:ref, b:ref }
 *   squad/setFormation    { formation }
 *   squad/autoBest        {}
 *   squad/autoFitness     {}
 *   squad/preset/save     { slot }
 *   squad/preset/load     { slot }
 *   tactics/set           { key, value }          key: mentality|pressing|width|passing|defLine|formation
 *   tactics/role          { role, cardId|null }
 *   tactics/tacticCard    { slot, cardId|null }
 *   card/apply            { itemCardId, playerCardId, stat? }   (aliases: card/applyConsumable, card/applyTraining,
 *                                                               card/applyTrait, card/applyStyle)
 *   card/quickSell        { cardId }
 */
export const SQUAD_ACTIONS = {
  'squad/swap': (s, p) => swap(s, p.a, p.b),
  'squad/setFormation': (s, p, w) => setFormation(s, p.formation, w),
  'squad/autoBest': (s, p, w) => autoBestXI(s, w),
  'squad/autoFitness': (s, p, w) => autoFixFitness(s, w),
  'squad/preset/save': (s, p) => savePreset(s, p.slot),
  'squad/preset/load': (s, p, w) => loadPreset(s, p.slot, w),
  'tactics/set': (s, p, w) => setSetting(s, p.key, p.value, w),
  'tactics/role': (s, p) => setRole(s, p.role, p.cardId ?? null),
  'tactics/tacticCard': (s, p) => equipTacticCard(s, p.slot, p.cardId ?? null),
  'card/apply': (s, p, w) => applyItemCard(s, w, p),
  'card/applyConsumable': (s, p, w) => applyItemCard(s, w, p),
  'card/applyTraining': (s, p, w) => applyItemCard(s, w, p),
  'card/applyTrait': (s, p, w) => applyItemCard(s, w, p),
  'card/applyStyle': (s, p, w) => applyItemCard(s, w, p),
  'card/quickSell': (s, p, w) => quickSell(s, w, p.cardId),
};
