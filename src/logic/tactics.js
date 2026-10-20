// Tactics: free settings + tactic cards -> engine modifiers.
// Pure module, no randomness. Effects follow PROMPT.md "Tactics panel" and "Cards > Tactic cards".
//
// Numbers: balance.js (TACTICS for the free settings, TACTIC_CARD_VALUES for the cards). Text: strings.js.

import { TACTICS, DEFAULT_SETTINGS, TACTIC_OPTIONS, TACTIC_CARD_VALUES, SQUAD_RULES } from '../balance.js';
import { S } from '../strings.js';

export { TACTIC_CARD_VALUES };

/** Card catalogue for the UI. `upside` and `cost` are plain-language strings (strings.js S.tacticCards). */
export const TACTIC_CARDS = Object.keys(TACTIC_CARD_VALUES).map((id) => ({ id, ...S.tacticCards[id] }));

export const TACTIC_CARD_IDS = TACTIC_CARDS.map((c) => c.id);

/** Plain-language summary lines for the tactics panel. */
export const SETTING_SUMMARY = S.settingSummary;

/** Normalise a settings object: unknown or missing values fall back to the defaults. */
export function normaliseSettings(settings) {
  const out = { ...DEFAULT_SETTINGS };
  if (settings) {
    for (const k in TACTIC_OPTIONS) {
      if (TACTIC_OPTIONS[k].includes(settings[k])) out[k] = settings[k];
    }
  }
  return out;
}

/**
 * Turn the free settings and the equipped tactic cards into engine modifiers.
 *
 * @param {{mentality:string,pressing:string,width:string,passing:string,defLine:string}} settings
 * @param {string[]} tacticCardIds   up to 3 card ids (unknown ids and nulls are ignored)
 * @param {Object} [ctx]             live context; every field is optional
 * @param {boolean} [ctx.leading]                 this side is ahead on the scoreboard
 * @param {number}  [ctx.minute]                  current match minute
 * @param {number}  [ctx.oppFastestAttackerPac]   max PAC among the opponent's ST/W/AM on the pitch
 * @param {number}  [ctx.oppFastestStrikerPac]    max PAC among the opponent's ST on the pitch
 * @param {number}  [ctx.mySlowestCbPac]          min PAC among my CB on the pitch
 * @returns {TacticMods}
 *
 * @typedef {Object} TacticMods
 * @property {number} att       own ATT multiplier
 * @property {number} mid       own MID multiplier
 * @property {number} def       own DEF multiplier
 * @property {number} oppMid    multiplier applied to the OPPONENT's MID (high press)
 * @property {number} fatigue   own fitness drain multiplier
 * @property {number} foulPts   added to the foul share when this side defends (probability, 0.03 = 3 points)
 * @property {number} yellowPts added to this side's yellow probability per foul
 * @property {number} crosses   multiplier on the share of own chances that come from crosses
 * @property {number} bigShift  own chance mix: probability moved from half to big (negative = big to half)
 * @property {number} oppBigShift  added to the OPPONENT's big-chance shift
 * @property {number} oppPChance   added to the OPPONENT's pChance
 * @property {number} oppOffsideMult  multiplier on the OPPONENT's offside share
 * @property {number} setPieceXg   added to own corner and free-kick xG
 * @property {number} fbAttBonus   own ATT x (1 + fbAttBonus per full-back on the pitch), Overlapping full-backs
 * @property {number} oppOffsideMult  also: the extra share (offside x (mult - 1)) turns opponent chances into offsides
 * @property {boolean} targetMan   striker shooter weight uses PHY instead of SHO
 * @property {boolean} manMark     mark the opponent's best attacker
 * @property {number} starStatMalus  stats removed from the marked star
 * @property {number} markerDrain    marker fatigue multiplier
 * @property {boolean} timeWasting   attacks x attackMult for both sides after afterMinute
 * @property {number} timeWastingAfter
 * @property {number} timeWastingAttackMult
 * @property {string[]} active   ids of the equipped cards whose effect currently applies
 */
export function tacticModifiers(settings, tacticCardIds, ctx = {}) {
  const s = normaliseSettings(settings);
  const m = {
    att: 1, mid: 1, def: 1, oppMid: 1, fatigue: 1, foulPts: 0, yellowPts: 0, crosses: 1,
    bigShift: 0, oppBigShift: 0, oppPChance: 0, oppOffsideMult: 1, setPieceXg: 0, fbAttBonus: 0,
    targetMan: false, manMark: false, starStatMalus: 0, markerDrain: 1,
    timeWasting: false, timeWastingAfter: TACTIC_CARD_VALUES.timeWasting.afterMinute,
    timeWastingAttackMult: TACTIC_CARD_VALUES.timeWasting.attackMult,
    active: [],
  };
  const mul = (o) => {
    if (!o) return;
    if (o.att) m.att *= o.att;
    if (o.mid) m.mid *= o.mid;
    if (o.def) m.def *= o.def;
  };

  // Mentality
  mul(TACTICS.mentality[s.mentality]);
  // Pressing
  const pr = TACTICS.pressing[s.pressing];
  mul(pr);
  if (pr.oppMid) m.oppMid *= pr.oppMid;
  if (pr.fatigue) m.fatigue *= pr.fatigue;
  if (pr.foulPts) m.foulPts += pr.foulPts;
  // Width
  const wd = TACTICS.width[s.width];
  mul(wd);
  if (wd.crosses) m.crosses *= wd.crosses;
  // Passing
  const ps = TACTICS.passing[s.passing];
  mul(ps);
  if (ps.halfToBig) m.bigShift += ps.halfToBig;
  if (ps.bigToHalf) m.bigShift -= ps.bigToHalf;
  // Defensive line
  const dl = TACTICS.defLine[s.defLine];
  mul(dl);
  if (dl.oppBigShare) m.oppBigShift += dl.oppBigShare;
  if (dl.oppPChance) m.oppPChance += dl.oppPChance;
  if (dl.oppBigShareIfFaster) {
    const fast = ctx.oppFastestAttackerPac ?? 0;
    const slow = ctx.mySlowestCbPac ?? 99;
    if (fast > slow) m.oppBigShift += dl.oppBigShareIfFaster;
  }

  // Tactic cards (max SQUAD_RULES.tacticSlots, duplicates ignored)
  const seen = new Set();
  const ids = (tacticCardIds || []).filter((id) => id && TACTIC_CARD_VALUES[id] && !seen.has(id) && seen.add(id)).slice(0, SQUAD_RULES.tacticSlots);
  const V = TACTIC_CARD_VALUES;
  for (const id of ids) {
    switch (id) {
      case 'counterAttack':
        if (s.defLine === 'deep' || ctx.leading) { m.bigShift += V.counterAttack.bigShift; m.active.push(id); }
        break;
      case 'offsideTrap':
        m.oppOffsideMult *= V.offsideTrap.oppOffsideMult;
        if ((ctx.oppFastestStrikerPac ?? 0) > (ctx.mySlowestCbPac ?? 99)) m.oppBigShift += V.offsideTrap.oppBigShiftIfFaster;
        m.active.push(id);
        break;
      case 'overlappingFullBacks':
        m.fbAttBonus = V.overlappingFullBacks.attPerFB;
        m.def *= V.overlappingFullBacks.def;
        m.active.push(id);
        break;
      case 'targetMan':
        m.targetMan = true;
        m.crosses *= V.targetMan.crosses;
        m.active.push(id);
        break;
      case 'manMark':
        m.manMark = true;
        m.starStatMalus = V.manMark.starStatMalus;
        m.markerDrain = V.manMark.markerDrain;
        m.active.push(id);
        break;
      case 'setPieceRoutine':
        m.setPieceXg += V.setPieceRoutine.setPieceXg;
        m.active.push(id);
        break;
      case 'parkTheBus':
        if (ctx.leading) { m.def *= V.parkTheBus.def; m.att *= V.parkTheBus.att; m.active.push(id); }
        break;
      case 'timeWasting':
        m.timeWasting = true;
        if ((ctx.minute ?? 0) >= V.timeWasting.afterMinute) { m.yellowPts += V.timeWasting.yellowPts; m.active.push(id); }
        break;
      default:
        break;
    }
  }
  return m;
}
