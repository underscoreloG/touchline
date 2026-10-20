// Card effects: out-of-position penalties, effective stats (upgrades, traits, style, chemistry),
// style and trait catalogues, training/trait/style application, and the MatchTeam builders.
// Pure module: no DOM, no wall clock, no global random source. Randomness only through a passed rng.
//
// Effective stat pipeline (effectiveStats), in this order:
//   1. world stats of the player (native key set)
//   2. upgrades from training cards (+1..+3 per stat, only the first `upgradeSlots(rarity)` entries count)
//   3. trait stat effects (flat, from TRAIT_CATALOGUE)
//   4. if a keeper plays outfield or an outfielder plays in goal: remap keys (see remapStats)
//   5. style card bonus * (chem / 3)   (only if the played position is allowed for the style)
//   6. chemistry: + CHEM.statBonusPerPoint * chem on every face stat (0 chem when out of position)
//   7. fitnessAdj (flat, optional)
//   8. out-of-position penalty subtracted from every face stat
//   9. consistency offset subtracted (magnitude)
//  10. round, clamp 0-99

import {
  OOP_PENALTY, POS_LINE, CHEM, ENGINE, DEFAULT_SETTINGS, FITNESS, MORALE, CARD_LIMITS, SQUAD_RULES, STAFF,
  LINE_WEIGHTS, TRAIT_RULES, STYLE_RULES,
} from '../balance.js';
import { S, fmt } from '../strings.js';
import { computeOvr, rarityFromOvr, upgradeSlots, statKeysFor } from './cards.js';
import { computeChemistry, isNaturalPosition } from './chemistry.js';
import { FORMATIONS } from './formations.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const round1 = (v) => Math.round(v * 10) / 10;

// Limits come from balance.js CARD_LIMITS (kept as named exports for the screens that import them).
export const MAX_TRAITS = CARD_LIMITS.maxTraits;
export const TRAINING_AMOUNT = { min: CARD_LIMITS.trainingMin, max: CARD_LIMITS.trainingMax };
const STAT_CAP = CARD_LIMITS.statCap;
const BENCH_MAX = CARD_LIMITS.benchSize;

const LINE_ORDER = { gk: 0, def: 1, mid: 2, att: 3 };

// ------------------------------------------------------------------ out of position

function penaltyFrom(sourcePos, playedPos) {
  if (sourcePos === playedPos) return { penalty: 0, label: 'natural' };
  if ((sourcePos === 'GK') !== (playedPos === 'GK')) {
    return { penalty: OOP_PENALTY.goalkeeperSwap, label: 'keeper swap' };
  }
  const d = Math.abs(LINE_ORDER[POS_LINE[sourcePos]] - LINE_ORDER[POS_LINE[playedPos]]);
  if (d === 0) return { penalty: OOP_PENALTY.sameLine, label: 'same line' };
  if (d === 1) return { penalty: OOP_PENALTY.adjacentLine, label: 'adjacent line' };
  // Defence <-> attack (two lines apart). The spec has no number for it: use OOP_PENALTY.farLine if the
  // main session adds one, otherwise the adjacent-line value. Reported as a contract gap.
  return { penalty: OOP_PENALTY.farLine ?? OOP_PENALTY.adjacentLine, label: 'far line' };
}

/**
 * Out-of-position penalty applied to all face stats.
 * Secondary position 0, same line -5 (e.g. CM at DM, W at ST, CB at FB), adjacent line -12 (def-mid, mid-att),
 * outfield in goal or keeper outfield -40. The best of the native and secondary positions is used as origin.
 * @param {string} nativePos
 * @param {string[]} altPos
 * @param {string} playedPos
 * @returns {{ penalty:number, label:string }}  penalty is a positive number (0 = none)
 */
export function oopPenalty(nativePos, altPos, playedPos) {
  if (playedPos === nativePos) return { penalty: 0, label: 'natural' };
  if (Array.isArray(altPos) && altPos.includes(playedPos)) {
    return { penalty: OOP_PENALTY.secondary, label: 'secondary position' };
  }
  let best = penaltyFrom(nativePos, playedPos);
  for (const p of altPos || []) {
    const c = penaltyFrom(p, playedPos);
    if (c.penalty < best.penalty) best = c;
  }
  return best;
}

// ------------------------------------------------------------------ key remapping (keeper <-> outfield)

/**
 * Crude, documented mapping used only when a keeper plays outfield or an outfielder plays in goal.
 * The -40 penalty is applied afterwards to every key, so the mapping only decides the shape.
 *  outfield -> GK:  div = ref = (pac + dri) / 2, spd = pac, han = (dri + def) / 2, kic = pas,
 *                   pos = (def + men) / 2, men = men
 *  GK -> outfield:  pac = spd, sho = pas = kic, dri = ref, def = (pos + han) / 2, phy = (div + han) / 2, men = men
 */
export function remapStats(stats, toGk) {
  const g = (k) => stats[k] || 0;
  if (toGk) {
    return {
      div: (g('pac') + g('dri')) / 2, han: (g('dri') + g('def')) / 2, kic: g('pas'),
      ref: (g('pac') + g('dri')) / 2, spd: g('pac'), pos: (g('def') + g('men')) / 2, men: g('men'),
    };
  }
  return {
    pac: g('spd'), sho: g('kic'), pas: g('kic'), dri: g('ref'),
    def: (g('pos') + g('han')) / 2, phy: (g('div') + g('han')) / 2, men: g('men'),
  };
}

/**
 * Stats of a player at another position, no cards involved: the same stats minus the out-of-position
 * penalty, OVR recomputed with the played position's weights. GK <-> outfield remaps keys (see remapStats).
 * @param {Object<string,number>} worldStatsObj
 * @param {string} nativePos
 * @param {string} playedPos
 * @param {string[]} [altPos]
 * @returns {{ stats:Object<string,number>, ovr:number, penalty:number, label:string }}
 */
export function statsAtPosition(worldStatsObj, nativePos, playedPos, altPos = []) {
  const { penalty, label } = oopPenalty(nativePos, altPos, playedPos);
  const swap = (nativePos === 'GK') !== (playedPos === 'GK');
  const src = swap ? remapStats(worldStatsObj, playedPos === 'GK') : worldStatsObj;
  const out = {};
  for (const k of statKeysFor(playedPos)) out[k] = clamp(Math.round((src[k] || 0) - penalty), 0, STAT_CAP);
  return { stats: out, ovr: computeOvr(out, playedPos), penalty, label };
}

// ------------------------------------------------------------------ trait catalogue

/**
 * Trait cards. `stats` is a flat stat bonus applied by effectiveStats. `engineOnly:true` means the trait has no
 * stat effect: the match engine reads the trait id from MatchPlayer.traits and applies `engineEffect`.
 * Positions and stat numbers: balance.js TRAIT_RULES. Names and descriptions: strings.js S.traits.
 * @type {Record<string, {id:string, name:string, description:string, positions:string[], stats:Object<string,number>, engineOnly:boolean, engineEffect?:string}>}
 */
export const TRAIT_CATALOGUE = Object.fromEntries(Object.keys(TRAIT_RULES).map((id) => {
  const rule = TRAIT_RULES[id];
  const text = S.traits[id];
  const def = {
    id, name: text.name, description: text.description,
    positions: rule.positions.slice(), stats: { ...rule.stats }, engineOnly: Object.keys(rule.stats).length === 0,
  };
  if (text.engineEffect) def.engineEffect = text.engineEffect;
  return [id, def];
}));

// ------------------------------------------------------------------ style catalogue

/**
 * Style cards. `bonus` is the stat package at full effect (chem 3); effectiveStats scales it by chem / 3.
 * Numbers: balance.js STYLE_RULES. Names and descriptions: strings.js S.styles.
 * @type {Record<string, {id:string, name:string, description:string, positions:string[], bonus:Object<string,number>}>}
 */
export const STYLE_CARDS = Object.fromEntries(Object.keys(STYLE_RULES).map((id) => {
  const rule = STYLE_RULES[id];
  const text = S.styles[id];
  return [id, { id, name: text.name, description: text.description, positions: rule.positions.slice(), bonus: { ...rule.bonus } }];
}));
export const STYLE_IDS = Object.keys(STYLE_CARDS);

// ------------------------------------------------------------------ effective stats

/**
 * Effective stats of a player at a played position.
 * @param {Object} p
 * @param {Object<string,number>} p.stats       world stats (native key set)
 * @param {Array<{stat:string,amount:number}>} [p.upgrades]
 * @param {string[]} [p.traits]
 * @param {string|null} [p.styleId]
 * @param {number} [p.chem]                     0-3, forced to 0 when out of position
 * @param {string} p.nativePos
 * @param {string[]} [p.altPos]
 * @param {string} p.playedPos
 * @param {number} [p.fitnessAdj]               optional flat adjustment to all face stats (UI previews; the match
 *                                              engine applies fitness itself, so buildMatchTeam passes 0)
 * @param {number} [p.consistencyOffset]        per-match offset; its magnitude is subtracted (0 to -(20-c)/4 as drawn)
 * @param {string} [p.rarity]                   sets the upgrade slot limit; derived from native OVR when omitted
 * @returns {{ stats:Object<string,number>, ovr:number, delta:number, baseOvr:number, penalty:number,
 *   oopLabel:string, chem:number }}  delta = effective OVR at played position minus world OVR at native position
 */
export function effectiveStats({
  stats, upgrades = [], traits = [], styleId = null, chem = 0, nativePos, altPos = [], playedPos,
  fitnessAdj = 0, consistencyOffset = 0, rarity,
}) {
  const nativeKeys = statKeysFor(nativePos);
  const baseOvr = computeOvr(stats, nativePos);
  const rar = rarity || rarityFromOvr(baseOvr);
  const s = {};
  for (const k of nativeKeys) s[k] = stats[k] || 0;

  // 2. upgrades, limited by slots
  const slots = upgradeSlots(rar);
  for (let i = 0; i < upgrades.length && i < slots; i++) {
    const u = upgrades[i];
    if (u && u.stat in s) s[u.stat] += clamp(u.amount, 0, TRAINING_AMOUNT.max);
  }
  // 3. trait stat effects
  for (const t of traits) {
    const def = TRAIT_CATALOGUE[t];
    if (!def) continue;
    for (const k in def.stats) if (k in s) s[k] += def.stats[k];
  }
  // 4. key remap for keeper <-> outfield
  const swap = (nativePos === 'GK') !== (playedPos === 'GK');
  let cur = swap ? remapStats(s, playedPos === 'GK') : s;
  const keys = statKeysFor(playedPos);

  const natural = isNaturalPosition({ pos: playedPos, nativePos, altPos });
  const chemEff = natural ? clamp(chem, 0, CHEM.perPlayerMax) : 0;

  // 5. style, scaled by chem / 3
  const style = styleId ? STYLE_CARDS[styleId] : null;
  if (style && style.positions.includes(playedPos)) {
    const scale = chemEff / CHEM.perPlayerMax;
    for (const k in style.bonus) if (keys.includes(k)) cur[k] += style.bonus[k] * scale;
  }
  // 6. chemistry flat bonus (never negative)
  const chemBonus = chemEff * CHEM.statBonusPerPoint;
  // 8. penalty
  const { penalty, label } = oopPenalty(nativePos, altPos, playedPos);
  const cons = Math.abs(consistencyOffset || 0);

  const out = {};
  for (const k of keys) {
    const v = (cur[k] || 0) + chemBonus + fitnessAdj - penalty - cons;
    out[k] = clamp(Math.round(v), 0, STAT_CAP);
  }
  const ovr = computeOvr(out, playedPos);
  return { stats: out, ovr, delta: ovr - baseOvr, baseOvr, penalty, oopLabel: label, chem: chemEff };
}

// ------------------------------------------------------------------ applying cards

const fail = (error, message) => ({ ok: false, error, message });

function rarityOfCard(card, worldPlayer) {
  return card.rarity || rarityFromOvr(worldPlayer.ovr);
}

function playerPositions(worldPlayer) {
  return [worldPlayer.pos, ...(worldPlayer.altPos || [])];
}

/** @returns {{ok:boolean, error?:string, message?:string}} */
export function canApplyTrait(card, worldPlayer, traitId) {
  const t = TRAIT_CATALOGUE[traitId];
  const E = S.errors.cards;
  if (!t) return fail('unknown_trait', fmt(E.unknownTrait, { id: traitId }));
  if ((card.traits || []).includes(traitId)) return fail('duplicate_trait', fmt(E.duplicateTrait, { name: t.name }));
  if ((card.traits || []).length >= MAX_TRAITS) return fail('trait_slots_full', fmt(E.traitSlotsFull, { n: MAX_TRAITS }));
  if (!playerPositions(worldPlayer).some((p) => t.positions.includes(p))) {
    return fail('position_restricted', fmt(E.positionRestricted, { name: t.name, list: t.positions.join(', ') }));
  }
  return { ok: true };
}

/** styleId null means "remove the style" and is always allowed. */
export function canApplyStyle(card, worldPlayer, styleId) {
  if (styleId === null || styleId === undefined) return { ok: true };
  const s = STYLE_CARDS[styleId];
  if (!s) return fail('unknown_style', fmt(S.errors.cards.unknownStyle, { id: styleId }));
  if (!playerPositions(worldPlayer).some((p) => s.positions.includes(p))) {
    return fail('position_restricted', fmt(S.errors.cards.positionRestricted, { name: s.name, list: s.positions.join(', ') }));
  }
  return { ok: true };
}

/**
 * Apply a training card: +amount on one face stat, using one upgrade slot (slots by rarity).
 * Returns a new card (the input is not mutated). The caller must also raise the player's potential in the world
 * by `potentialDelta.amount` on `potentialDelta.stat` (permanent, per spec).
 * @returns {{ok:true, card:object, potentialDelta:{stat:string, amount:number}} | {ok:false, error:string, message:string}}
 */
export function applyTrainingCard(card, worldPlayer, { stat, amount }) {
  if (!Number.isInteger(amount) || amount < TRAINING_AMOUNT.min || amount > TRAINING_AMOUNT.max) {
    return fail('bad_amount', fmt(S.errors.cards.badAmount, { min: TRAINING_AMOUNT.min, max: TRAINING_AMOUNT.max }));
  }
  if (!statKeysFor(worldPlayer.pos).includes(stat)) return fail('bad_stat', fmt(S.errors.cards.badStat, { stat, pos: worldPlayer.pos }));
  const rarity = rarityOfCard(card, worldPlayer);
  const used = (card.upgrades || []).length;
  if (used >= upgradeSlots(rarity)) return fail('no_slot', fmt(S.errors.cards.noUpgradeSlot, { n: upgradeSlots(rarity), rarity }));
  const current = (worldPlayer.stats[stat] || 0)
    + (card.upgrades || []).filter((u) => u.stat === stat).reduce((a, u) => a + u.amount, 0);
  if (current >= STAT_CAP) return fail('stat_maxed', fmt(S.errors.cards.statMaxed, { stat, cap: STAT_CAP }));
  const applied = Math.min(amount, STAT_CAP - current);
  const next = { ...card, upgrades: [...(card.upgrades || []), { stat, amount: applied }] };
  return { ok: true, card: next, potentialDelta: { stat, amount: applied } };
}

/** @returns {{ok:true, card:object} | {ok:false, error:string, message:string}} */
export function applyTrait(card, worldPlayer, traitId) {
  const c = canApplyTrait(card, worldPlayer, traitId);
  if (!c.ok) return c;
  return { ok: true, card: { ...card, traits: [...(card.traits || []), traitId] } };
}

/** Equip (or replace) the style. styleId null clears it. */
export function applyStyle(card, worldPlayer, styleId) {
  const c = canApplyStyle(card, worldPlayer, styleId);
  if (!c.ok) return c;
  return { ok: true, card: { ...card, styleId: styleId ?? null } };
}

// ------------------------------------------------------------------ squad evaluation helpers

/**
 * Evaluate an XI of extended slot entries. Each entry = chemistry entry fields plus
 * { stats, upgrades?, traits?, styleId?, rarity? }. Slot order. Used by predictSwap and the squad header.
 * @returns {{ chem:object, players:Array<object>, ovr:number }}
 */
export function evaluateXi(entries, manager = null) {
  const chem = computeChemistry(entries, manager);
  const players = entries.map((e, i) => effectiveStats({
    stats: e.stats, upgrades: e.upgrades, traits: e.traits, styleId: e.styleId, chem: chem.perPlayer[i],
    nativePos: e.nativePos, altPos: e.altPos, playedPos: e.pos, rarity: e.rarity,
  }));
  const ovr = players.reduce((a, p) => a + p.ovr, 0) / (players.length || 1);
  return { chem, players, ovr };
}

/**
 * UI drag preview: put `candidate` into slot `slotIndex`.
 *  - bench / reserve candidate: `candidateSlot` omitted or -1, he takes the slot, the displaced starter leaves the XI.
 *  - XI candidate: pass his current index as `candidateSlot`, the two starters exchange slots.
 * The candidate entry's `pos` is overwritten with the target slot's position.
 * Team OVR values are the mean of effective starter OVRs rounded to 1 decimal.
 * @param {{ xi:object[], slotIndex:number, candidate:object, candidateSlot?:number, manager?:object|null }} args
 * @returns {{ ovrBefore:number, ovrAfter:number, chemBefore:number, chemAfter:number, effectiveOvr:number,
 *   slotOvrBefore:number, effectiveStats:Object<string,number>, penalty:number, oopLabel:string, chemPlayer:number, xiAfter:object[] }}
 */
export function predictSwap({ xi, slotIndex, candidate, candidateSlot = -1, manager = null }) {
  const before = evaluateXi(xi, manager);
  const after = xi.map((e) => e);
  const target = xi[slotIndex];
  const cand = { ...candidate, pos: target.pos };
  after[slotIndex] = cand;
  if (candidateSlot >= 0 && candidateSlot !== slotIndex) {
    after[candidateSlot] = { ...target, pos: xi[candidateSlot].pos };
  }
  const res = evaluateXi(after, manager);
  const me = res.players[slotIndex];
  return {
    ovrBefore: round1(before.ovr), ovrAfter: round1(res.ovr),
    chemBefore: before.chem.team, chemAfter: res.chem.team,
    effectiveOvr: me.ovr, slotOvrBefore: before.players[slotIndex].ovr,
    effectiveStats: me.stats, penalty: me.penalty, oopLabel: me.oopLabel,
    chemPlayer: res.chem.perPlayer[slotIndex], xiAfter: after,
  };
}

// ------------------------------------------------------------------ MatchTeam builders

const STAFF_ROLES = STAFF.roles;

function staffLevels(staff) {
  const out = {};
  for (const r of STAFF_ROLES) out[r] = 0;
  if (Array.isArray(staff)) {
    for (const s of staff) if (s && s.role in out) out[s.role] = Math.max(out[s.role], s.level || 0);
  } else if (staff && typeof staff === 'object') {
    for (const r of STAFF_ROLES) if (typeof staff[r] === 'number') out[r] = clamp(staff[r], 0, STAFF.maxLevel);
  }
  return out;
}

/** Draw the per-match consistency offset ONCE per player: 0 to -(20 - consistency)/4. */
function drawConsistencyOffset(rng, consistency) {
  const max = (20 - clamp(consistency, 1, 20)) / ENGINE.consistencyOffsetDiv;
  return -rng.float(0, max);
}

/**
 * Shared builder. members = [{ wp, card|null, number, leagueId, isIcon }] for xi then bench.
 */
function assembleTeam({ id, name, colours, crest, formation, xi, bench, settings, tacticCards, roles, staff, manager, isHome, isAI, rng }) {
  const formationDef = FORMATIONS[formation];
  if (!formationDef) throw new Error(`Unknown formation ${formation}`);
  if (xi.length !== formationDef.slots.length) throw new Error(`xi must have ${formationDef.slots.length} players, got ${xi.length}`);
  if (!rng || typeof rng.float !== 'function') throw new Error('buildMatchTeam needs an rng');

  const entries = xi.map((m, i) => ({
    playerId: m.wp.id, nation: m.wp.nation,
    clubId: m.card ? m.card.signedFromClubId : m.wp.clubId,
    leagueId: m.leagueId, isIcon: !!m.isIcon,
    pos: formationDef.slots[i].pos, nativePos: m.wp.pos, altPos: m.wp.altPos || [],
  }));
  const chem = computeChemistry(entries, manager);

  const toMatchPlayer = (m, playedPos, chemPts) => {
    const c = m.card;
    const offset = drawConsistencyOffset(rng, m.wp.consistency);
    const eff = effectiveStats({
      stats: m.wp.stats, upgrades: c ? c.upgrades : [], traits: c ? c.traits : [], styleId: c ? c.styleId : null,
      chem: chemPts, nativePos: m.wp.pos, altPos: m.wp.altPos || [], playedPos,
      consistencyOffset: offset, rarity: c && c.rarity ? c.rarity : (m.isIcon ? 'icon' : undefined),
    });
    return {
      id: m.wp.id, name: m.wp.name, nation: m.wp.nation, number: m.number, pos: playedPos, nativePos: m.wp.pos,
      stats: eff.stats, ovr: eff.ovr,
      fitness: c ? c.fitness : FITNESS.start, morale: c ? c.morale : MORALE.start, form: c ? c.form : 0,
      traits: c ? [...c.traits] : [], styleId: c ? c.styleId : null,
      altPos: [...(m.wp.altPos || [])], injuryProne: m.wp.injuryProne, consistency: m.wp.consistency, chem: chemPts, yellows: 0,
    };
  };

  const xiPlayers = xi.map((m, i) => toMatchPlayer(m, formationDef.slots[i].pos, chem.perPlayer[i]));
  // Bench: played at his own position, no chemistry (not part of the starting XI).
  const benchPlayers = bench.slice(0, BENCH_MAX).map((m) => toMatchPlayer(m, m.wp.pos, 0));

  // roles may hold card ids (GameState.squad.roles) or world player ids: resolve to world ids.
  const cardToWorld = new Map();
  for (const m of [...xi, ...bench]) if (m.card) cardToWorld.set(m.card.id, m.wp.id);
  const resolveRole = (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return v;
    return cardToWorld.has(v) ? cardToWorld.get(v) : null;
  };
  const r = roles || {};

  return {
    id, name, colours: [...colours], crest, formation, xi: xiPlayers, bench: benchPlayers,
    settings: { ...DEFAULT_SETTINGS, ...(settings || {}) },
    tacticCards: (tacticCards || []).slice(0, SQUAD_RULES.tacticSlots),
    roles: {
      captain: resolveRole(r.captain), penalties: resolveRole(r.penalties),
      freeKicks: resolveRole(r.freeKicks), corners: resolveRole(r.corners),
    },
    staff: staffLevels(staff),
    chemistry: chem.team,
    isHome: !!isHome, isAI: !!isAI,
  };
}

const isIconCard = (card) => !!card && (card.isIcon === true || card.rarity === 'icon');

/**
 * Build a MatchTeam from my cards.
 * xiCards / benchCards: [{ card: PlayerCard, worldPlayer: WorldPlayer, number }] (xi in formation slot order).
 * Icon cards are detected by `card.isIcon === true` or `card.rarity === 'icon'` (their worldPlayer is the snapshot).
 * The per-match consistency offset is drawn once per player from `seedForConsistency` (an rng; `rng` is an alias),
 * xi first, then bench. Chemistry is computed on the XI only; bench players carry chem 0.
 * @returns {import('./cards.js').MatchTeam}
 */
export function buildMatchTeam({
  id, name, colours, crest, formation, xiCards, benchCards = [], settings, tacticCards, roles, staff, manager = null,
  isHome = true, isAI = false, seedForConsistency, rng,
}) {
  const toMember = ({ card, worldPlayer, number }) => ({
    wp: worldPlayer, card, number, leagueId: card.leagueId, isIcon: isIconCard(card),
  });
  return assembleTeam({
    id, name, colours, crest, formation,
    xi: xiCards.map(toMember), bench: benchCards.map(toMember),
    settings, tacticCards, roles, staff, manager, isHome, isAI, rng: seedForConsistency || rng,
  });
}

/**
 * Build a MatchTeam for an AI club from world players only: fitness 100, morale 50, form 0, no upgrades,
 * traits or style. A WorldPlayer has no league field, so give each entry `leagueId`, or pass `leagueOf(clubId)`;
 * fallback is the player's nation (background clubs count as their nation's league).
 * xiPlayers / benchPlayers: [{ worldPlayer, number, leagueId? }].
 * @returns {import('./cards.js').MatchTeam}
 */
export function buildAITeam({
  id, name, colours, crest, formation, xiPlayers, benchPlayers = [], settings, tacticCards, roles, staff, manager = null,
  isHome = false, leagueOf, seedForConsistency, rng,
}) {
  const toMember = ({ worldPlayer, number, leagueId }) => ({
    wp: worldPlayer, card: null, number,
    leagueId: leagueId ?? (leagueOf ? leagueOf(worldPlayer.clubId) : undefined) ?? worldPlayer.nation,
    isIcon: false,
  });
  return assembleTeam({
    id, name, colours, crest, formation,
    xi: xiPlayers.map(toMember), bench: benchPlayers.map(toMember),
    settings, tacticCards, roles, staff, manager, isHome, isAI: true, rng: seedForConsistency || rng,
  });
}

// ------------------------------------------------------------------ team ratings

function weightedMean(players, rule) {
  let sw = 0, sv = 0;
  for (const p of players) {
    const w = rule.weights[p.pos];
    if (!w) continue;
    sw += w;
    sv += w * rule.value(p.stats);
  }
  return sw ? sv / sw : 0;
}

const DS = LINE_WEIGHTS.defStats;
const LINE_RULES = {
  // PROMPT "Match engine algorithm" step 1, no fitness/morale/home/tactic modifiers. Weights: balance.js LINE_WEIGHTS.
  att: { weights: LINE_WEIGHTS.att, value: (s) => (s.sho + s.dri + s.pac) / 3 },
  mid: { weights: LINE_WEIGHTS.mid, value: (s) => (s.pas + s.dri + s.phy + s.men) / 4 },
  def: { weights: LINE_WEIGHTS.def, value: (s) => (s.def * DS.def + s.phy * DS.phy + s.pac * DS.pac + s.men * DS.men) / DS.div },
};

/**
 * Header ratings for the squad screen. All values rounded to 1 decimal (round for display).
 * @param {import('./cards.js').MatchTeam} matchTeam
 * @returns {{ ovr:number, att:number, mid:number, def:number, gk:number }}
 */
export function teamRatings(matchTeam) {
  const xi = matchTeam.xi;
  const gkP = xi.find((p) => p.pos === 'GK');
  return {
    ovr: round1(xi.reduce((a, p) => a + p.ovr, 0) / (xi.length || 1)),
    att: round1(weightedMean(xi, LINE_RULES.att)),
    mid: round1(weightedMean(xi, LINE_RULES.mid)),
    def: round1(weightedMean(xi, LINE_RULES.def)),
    gk: gkP ? gkP.ovr : 0,
  };
}

