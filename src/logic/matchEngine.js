// Match engine. Event-based, deterministic given (homeTeam, awayTeam, seed, decisions).
// Implements PROMPT.md "Exact specs > Match engine algorithm" steps 1-9.
//
// Streams of randomness:
//   match.rng   main stream, decides every outcome.
//   match.vrng  cosmetic stream (action positions, commentary variants). Never read by outcome code, so
//               the lite mode (no actions, no commentary) gives exactly the same results.
//   penalty kicks use a stream forked per (tick, phase), so choosing a penalty taker in a key-moment
//               prompt never shifts the main stream.
//
// Structural reading of the spec (documented, see the report):
//   - Each 3-minute tick holds ENGINE.phasesPerTick possession phases. Steps 2-3 (possession, attack 0.55,
//     pChance) run once per phase. With one phase per tick the spec numbers give ~2.5 shots per team.
//   - Line strengths are recomputed every tick (fitness changes every tick) and right after any card,
//     injury, sub or tactic change.
//   - A side with fewer than 10 outfielders loses ENGINE.manDownPerPlayer on ATT/MID/DEF per missing man,
//     on top of the missing player's removal from the line means.
//   - Keeper sent off or injured: a bench keeper comes on if a sub is left (replacing the lowest-fitness
//     outfielder when the keeper was sent off). Otherwise the outfielder with the highest PHY goes in goal:
//     his keeper stats are the mean of his face stats minus OOP_PENALTY.goalkeeperSwap (40).

import {
  ENGINE as ENGINE_BASE, OOP_PENALTY, POS_LINE, OUTFIELD_STATS, GK_STATS, GK_WEIGHTS, TACTIC_OPTIONS, TRAIT_EFFECTS, LINE_WEIGHTS,
  ENGINE_DETAIL, TACTIC_CARD_VALUES, CARD_LIMITS, SQUAD_RULES,
} from '../balance.js';
import { rngFrom, hashSeed, clamp } from './rng.js';
import { tacticModifiers, normaliseSettings } from './tactics.js';
import { commentaryFor, actionLine } from './commentary.js';
import { FORMATIONS } from './formations.js';
import { oopPenalty as cardOopPenalty } from './cardEffects.js';

// ------------------------------------------------------------------ calibration

/**
 * Local overrides merged over balance.js ENGINE. The main session moves these into balance.js.
 * Keys that do not exist in balance.js yet are proposals (see report).
 */
// Calibrated values now live in balance.js ENGINE. Keep this hook empty for local experiments.
export const CALIBRATION_OVERRIDES = {};

function mergeDeep(base, over) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const k in over) {
    const v = over[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) out[k] = mergeDeep(base[k], v);
    else out[k] = v;
  }
  return out;
}

/** Effective engine constants: balance.js ENGINE with CALIBRATION_OVERRIDES on top. */
export const ENGINE = mergeDeep(ENGINE_BASE, CALIBRATION_OVERRIDES);
const E = ENGINE;
const HALF_TICKS = E.ticks / 2;

// ------------------------------------------------------------------ traits

// Trait effects (TRAIT_EFFECTS) and the other engine constants live in balance.js; re-exported for tools and tests.
export { TRAIT_EFFECTS };

// ------------------------------------------------------------------ helpers

const OTHER = { home: 'away', away: 'home' };
const FALLBACK_LINE = ENGINE_DETAIL.fallbackLine;
const r1 = (v) => Math.round(v * 10) / 10;


function toKeeperStats(stats) {
  let s = 0, n = 0;
  for (const k of OUTFIELD_STATS) { s += stats[k] || 0; n++; }
  const v = Math.max(1, Math.round(s / n) - OOP_PENALTY.goalkeeperSwap);
  const out = {};
  for (const k of GK_STATS) out[k] = v;
  return out;
}

function toOutfieldStats(stats) {
  let s = 0, n = 0;
  for (const k of GK_STATS) { s += stats[k] || 0; n++; }
  const v = Math.max(1, Math.round(s / n) - OOP_PENALTY.goalkeeperSwap);
  const out = {};
  for (const k of OUTFIELD_STATS) out[k] = v;
  return out;
}

function livePlayer(p, sideKey, slot) {
  const traits = new Set(p.traits || []);
  return {
    id: p.id, name: p.name, number: p.number, nation: p.nation,
    pos: p.pos, nativePos: p.nativePos || p.pos, altPos: p.altPos || [], slot,
    stats: { ...p.stats }, ovr: p.ovr,
    fitness: p.fitness ?? 100, morale: p.morale ?? 50, form: p.form || 0,
    traits, injuryProne: p.injuryProne ?? 10, chem: p.chem ?? 0,
    yellows: p.yellows || 0, red: false, injured: false, injuryMatches: 0,
    onPitch: slot != null, subbedOff: false, minOn: slot != null ? 0 : null, minOff: null,
    goals: 0, assists: 0, saves: 0, shots: 0, conceded: 0, side: sideKey,
    e: null, // effective stats for the current tick
  };
}

function makeSide(team, key) {
  const formation = FORMATIONS[team.formation] ? team.formation : '4-3-3';
  const slots = (team.xi || []).slice(0, 11).map((p, i) => livePlayer(p, key, i));
  while (slots.length < 11) slots.push(null);
  const bench = (team.bench || []).slice(0, CARD_LIMITS.benchSize).map((p) => livePlayer(p, key, null));
  const side = {
    key, team, _live: true,
    id: team.id, name: team.name || key, formation,
    settings: normaliseSettings(team.settings),
    tacticCards: (team.tacticCards || []).slice(0, SQUAD_RULES.tacticSlots),
    roles: { captain: null, penalties: null, freeKicks: null, corners: null, ...(team.roles || {}) },
    staff: { fitness: 0, physio: 0, scout: 0, gk: 0, setPiece: 0, youth: 0, analyst: 0, ...(team.staff || {}) },
    isAI: !!team.isAI, isHome: key === 'home',
    slots, bench, all: new Map(), list: [],
    subsUsed: 0, mentality: null, penaltyTaker: null, teamTalk: 0,
    shout: null, shoutNow: 0, shoutReady: { shout: 0, calm: 0, encourage: 0 }, shoutShared: 0,
    mods: null, lines: { ATT: 0, MID: 0, DEF: 0, GK: 0 },
    markedStarId: null, markerId: null, starMalus: 0, emergencyGK: false,
  };
  for (const p of slots) if (p) side.all.set(p.id, p);
  for (const p of bench) side.all.set(p.id, p);
  rebuildList(side);
  return side;
}

function rebuildList(side) {
  side.list = side.slots.filter((p) => p);
}

const keeperOf = (side) => side.slots[0];
const outfieldCount = (side) => side.list.length - (side.slots[0] ? 1 : 0);

// ------------------------------------------------------------------ line strengths

function moraleFactor(side) {
  const [lo, hi] = E.moraleRange;
  let sum = 0, n = 0, aura = 0;
  for (const p of side.list) {
    sum += p.morale; n++;
    if (p.traits.has('leader')) {
      const a = TRAIT_EFFECTS.leader.moraleAura * (side.roles.captain === p.id ? TRAIT_EFFECTS.leader.captainMult : 1);
      if (a > aura) aura = a;
    }
  }
  const avg = n ? sum / n : 50;
  return lo + (hi - lo) * (avg / 100) + aura + side.teamTalk + side.shoutNow;
}

function fitFactor(p) { return E.fitnessFloor + E.fitnessWeight * (p.fitness / 100); }

/** Fill p.e with effective stats for this tick (form, traits, marking, fitness). */
function computeEff(side, p, minute) {
  const keys = p.pos === 'GK' ? GK_STATS : OUTFIELD_STATS;
  const ff = fitFactor(p);
  let add = p.form;
  if (p.traits.has('clutch') && minute >= TRAIT_EFFECTS.clutch.afterMinute) add += TRAIT_EFFECTS.clutch.statAdd;
  if (p.id === side.markedStarId) add -= side.starMalus;
  const e = p.e || (p.e = {});
  for (const k of keys) {
    let v = (p.stats[k] ?? 0) + add;
    if (k === 'pac' && p.traits.has('paceMerchant')) v += TRAIT_EFFECTS.paceMerchant.pacAdd;
    e[k] = v * ff;
  }
  return e;
}

function tacticCtx(side, opp, match) {
  let fastAtt = 0, fastSt = 0, slowCb = 99;
  for (const p of opp.list) {
    const pac = p.stats.pac ?? 0;
    if (p.pos === 'ST' || p.pos === 'W' || p.pos === 'AM') fastAtt = Math.max(fastAtt, pac);
    if (p.pos === 'ST') fastSt = Math.max(fastSt, pac);
  }
  for (const p of side.list) if (p.pos === 'CB') slowCb = Math.min(slowCb, p.stats.pac ?? 99);
  const diff = match ? match.score[side.key] - match.score[opp.key] : 0;
  return { leading: diff > 0, minute: match ? match.minute : 0, oppFastestAttackerPac: fastAtt, oppFastestStrikerPac: fastSt, mySlowestCbPac: slowCb };
}

function currentSettings(side) {
  return side.mentality ? { ...side.settings, mentality: side.mentality } : side.settings;
}

/** Choose the opponent star to mark and our marker (Man-mark their star). */
function updateMarking(side, opp) {
  // `side` is the marking team. The star belongs to `opp`.
  if (!side.mods || !side.mods.manMark) { opp.markedStarId = null; opp.starMalus = 0; side.markerId = null; return; }
  let best = null, bv = -1;
  for (const p of opp.list) {
    if (p.pos !== 'ST' && p.pos !== 'W' && p.pos !== 'AM') continue;
    const v = ((p.stats.sho ?? 0) + (p.stats.dri ?? 0) + (p.stats.pac ?? 0)) / 3;
    if (v > bv) { bv = v; best = p; }
  }
  opp.markedStarId = best ? best.id : null;
  opp.starMalus = best ? side.mods.starStatMalus : 0;
  let marker = null, mv = -1;
  for (const pref of ['DM', 'CB', 'CM', 'FB']) {
    for (const p of side.list) if (p.pos === pref && (p.stats.def ?? 0) > mv) { mv = p.stats.def; marker = p; }
    if (marker) break;
  }
  side.markerId = marker ? marker.id : null;
}

const LW = LINE_WEIGHTS;
const DS = LINE_WEIGHTS.defStats;

function rawLines(side, minute) {
  let aW = 0, aS = 0, mW = 0, mS = 0, dW = 0, dS = 0, fbs = 0;
  let gk = 0;
  for (const p of side.list) {
    const e = computeEff(side, p, minute);
    const pos = p.pos;
    if (pos === 'GK') { gk = keeperOvr(e); continue; }
    let w;
    // ATT
    w = LW.att[pos] || 0;
    if (w) { aW += w; aS += w * (e.sho + e.dri + e.pac) / 3; }
    if (pos === 'FB') fbs++;
    // MID
    w = LW.mid[pos] || 0;
    if (w) { mW += w; mS += w * (e.pas + e.dri + e.phy + e.men) / 4; }
    // DEF
    if (LW.def[pos]) {
      const def = e.def + (p.traits.has('ballWinner') ? TRAIT_EFFECTS.ballWinner.defStatAdd : 0);
      dW += 1; dS += (def * DS.def + e.phy * DS.phy + e.pac * DS.pac + e.men * DS.men) / DS.div;
    }
  }
  const fbBonus = side.mods && side.mods.fbAttBonus ? 1 + side.mods.fbAttBonus * fbs : 1;
  return {
    ATT: (aW ? aS / aW : FALLBACK_LINE) * fbBonus,
    MID: mW ? mS / mW : FALLBACK_LINE,
    DEF: dW ? dS / dW : FALLBACK_LINE,
    GK: gk || FALLBACK_LINE,
  };
}

/** Keeper OVR as a float (cards.computeOvr rounds, the engine keeps decimals). */
function keeperOvr(e) {
  let s = 0;
  for (const k in GK_WEIGHTS) s += (e[k] || 0) * GK_WEIGHTS[k];
  return s;
}

/** Recompute modifiers and line strengths for both sides. */
function refresh(match) {
  const { home, away } = match;
  for (const [s, o] of [[home, away], [away, home]]) s.mods = tacticModifiers(currentSettings(s), s.tacticCards, tacticCtx(s, o, match));
  updateMarking(home, away);
  updateMarking(away, home);
  for (const [s, o] of [[home, away], [away, home]]) {
    const raw = rawLines(s, match.minute);
    const mf = moraleFactor(s);
    const hf = s.isHome ? E.homeFactor : 1;
    const missing = Math.max(0, 10 - outfieldCount(s));
    const md = 1 - E.manDownPerPlayer * missing;
    s.lines.ATT = raw.ATT * mf * hf * s.mods.att * md;
    s.lines.MID = raw.MID * mf * hf * s.mods.mid * o.mods.oppMid * md;
    s.lines.DEF = raw.DEF * mf * hf * s.mods.def * md;
    s.lines.GK = raw.GK * mf * hf;
  }
  match.dirty = false;
}

/**
 * Line strengths for the UI.
 * @param {import('./cards.js').MatchTeam|Object} team  a MatchTeam, or a live side from match.home / match.away
 * @param {Object} [state]  optional: { opp: MatchTeam|side, minute, score:{home,away} } or a match object
 * @returns {{ATT:number, MID:number, DEF:number, GK:number}}
 */
export function lineStrengths(team, state = {}) {
  if (state && state.home && state.away && state.home._live) {
    // state is a match
    if (state.dirty || !team._live) refresh(state);
    const side = team._live ? team : (state.home.team === team ? state.home : state.away);
    return roundLines(side.lines);
  }
  const key = team.isHome === false ? 'away' : 'home';
  const side = team._live ? team : makeSide(team, key);
  side.isHome = team._live ? side.isHome : team.isHome !== false;
  const oppTeam = state.opp;
  const opp = oppTeam ? (oppTeam._live ? oppTeam : makeSide(oppTeam, OTHER[key])) : makeSide({ xi: [], settings: {}, isHome: false }, OTHER[key]);
  const pseudo = { home: key === 'home' ? side : opp, away: key === 'home' ? opp : side, minute: state.minute || 0, score: state.score || { home: 0, away: 0 } };
  refresh(pseudo);
  return roundLines(side.lines);
}

const roundLines = (l) => ({ ATT: r1(l.ATT), MID: r1(l.MID), DEF: r1(l.DEF), GK: r1(l.GK) });

// ------------------------------------------------------------------ match creation

/**
 * @param {import('./cards.js').MatchTeam} home
 * @param {import('./cards.js').MatchTeam} away
 * @param {number|string} seed
 * @param {{keyMoments?:boolean, lite?:boolean, autoSubs?:boolean}} [opts]
 *   keyMoments: stepTick sets match.prompt for the human side (penalty taker, half-time talk, late-game call,
 *               injury sub). Unanswered prompts resolve to their default, which equals the non-interactive path.
 *   lite:       skip actions and commentary (same results, faster). For headless sims.
 *   autoSubs:   the engine also makes the 60/70/80 subs for non-AI sides (simulate() default true).
 */
export function createMatch(home, away, seed, opts = {}) {
  const s0 = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  const rng = rngFrom(s0);
  const match = {
    seed: s0, rng, vrng: rng.fork('view'), opts: { keyMoments: false, lite: false, autoSubs: false, ...opts },
    home: makeSide(home, 'home'), away: makeSide(away, 'away'),
    phase: 'pre', half: 1, tickInHalf: 0, tickCount: 0, minute: 0, addedMin: 0,
    added: { h1: null, h2: null }, stoppages: { 1: 0, 2: 0 },
    score: { home: 0, away: 0 },
    stats: newStats(),
    possSum: 0,
    momentum: 0,
    events: [], injuries: [], cards: [], subs: [],
    prompt: null, pending: null, aiSubsDone: { home: 0, away: 0 }, lateGameAsked: false,
    dirty: true,
  };
  match.home.isHome = true;
  match.away.isHome = false;
  match.sides = { home: match.home, away: match.away };
  refresh(match);
  return match;
}

function newStats() {
  const t = () => ({ shots: 0, shotsOnTarget: 0, xg: 0, corners: 0, fouls: 0, offsides: 0, yellows: 0, reds: 0 });
  return { home: t(), away: t() };
}

export const isFinished = (match) => match.phase === 'finished';

// ------------------------------------------------------------------ event helpers

function evMinute(match, phaseIdx) {
  if (match.tickInHalf < HALF_TICKS) {
    const base = (match.half - 1) * 45 + match.tickInHalf * 3;
    return { minute: base + 1 + Math.floor(phaseIdx * 3 / E.phasesPerTick), addedMin: 0 };
  }
  const base = (match.tickInHalf - HALF_TICKS) * 3;
  return { minute: match.half * 45, addedMin: base + 1 + Math.floor(phaseIdx * 3 / E.phasesPerTick) };
}

function nameOf(match, id) {
  if (id == null) return '';
  const p = match.home.all.get(id) || match.away.all.get(id);
  return p ? p.name : '';
}

function pushEvent(match, out, ev, cctx = {}) {
  if (!match.opts.lite) {
    ev.text = commentaryFor(ev, {
      rng: match.vrng,
      nameOf: (id) => nameOf(match, id),
      teamName: (k) => match[k].name,
      score: match.score,
      ...cctx,
    });
  } else ev.text = '';
  // keep action times monotonic inside the tick: shift this event's steps after the previous event's
  const acts = ev.actions;
  if (acts.length) {
    const off = Math.max(0, (match.tCursor || 0) - acts[0].t);
    if (off) for (const a of acts) a.t += off;
    match.tCursor = acts[acts.length - 1].t + 2;
  }
  out.push(ev);
  match.events.push(ev);
  return ev;
}

function baseEvent(match, type, team, phaseIdx, extra) {
  const { minute, addedMin } = evMinute(match, phaseIdx);
  return { minute, half: match.half, addedMin, type, team, playerId: null, assistId: null, xg: 0, text: '', actions: [], ...extra };
}

// ---- cosmetic positions (vrng only). Attack frame: ax 0..105 toward the opponent goal, ay 0..68.

function dirOf(match, sideKey) { return (sideKey === 'home') === (match.half === 1) ? 1 : -1; }
function P(match, sideKey, ax, ay) {
  const d = dirOf(match, sideKey);
  return d > 0 ? { x: r1(ax), y: r1(ay) } : { x: r1(105 - ax), y: r1(68 - ay) };
}
function anchorAtt(side, p) {
  const f = FORMATIONS[side.formation];
  const s = f.slots[p.slot != null ? p.slot : 0] || f.slots[0];
  return [s.depth * 1.05, s.lat * 0.68];
}
function vr(match, lo, hi) { return lo + match.vrng.next() * (hi - lo); }

function step(match, t, type, sideKey, player, target, fromA, toA, nameA, nameB) {
  return {
    t, type, playerId: player ? player.id : null, targetId: target ? target.id : null,
    from: P(match, sideKey, fromA[0], fromA[1]), to: P(match, sideKey, toA[0], toA[1]),
    text: actionLine(type, nameA ?? (player ? player.name : ''), nameB ?? (target ? target.name : '')),
  };
}

function shotSpot(match, quality, cross) {
  if (cross) {
    // headers and volleys from a cross: inside the box, further out for lower quality
    if (quality === 'big') return [vr(match, 96, 100), vr(match, 29, 39)];
    if (quality === 'decent') return [vr(match, 92, 97), vr(match, 26, 42)];
    return [vr(match, 88, 94), vr(match, 22, 46)];
  }
  switch (quality) {
    case 'big': return [vr(match, 94, 99), vr(match, 29, 39)];
    case 'decent': return [vr(match, 87, 93), vr(match, 22, 46)];
    case 'penalty': return [94, 34];
    case 'corner': return [vr(match, 95, 99.5), vr(match, 28, 40)];
    case 'freeKick': return [vr(match, 75, 84), vr(match, 18, 50)];
    default: return [vr(match, 76, 87), vr(match, 14, 54)];
  }
}

function outcomeTarget(match, outcome) {
  switch (outcome) {
    case 'goal': return [105, vr(match, 30.8, 37.2)];
    case 'save': return [vr(match, 103, 104.5), vr(match, 31, 37)];
    case 'woodwork': return [105, match.vrng.next() < 0.5 ? 30.4 : 37.6];
    case 'blocked': return null;
    default: return [105, match.vrng.next() < 0.5 ? vr(match, 24, 29.5) : vr(match, 38.5, 44)];
  }
}

function pickBy(match, list, pred) {
  const c = list.filter(pred);
  return c.length ? c[Math.floor(match.vrng.next() * c.length)] : null;
}

// ------------------------------------------------------------------ choices (main rng)

function pickShooter(match, A, cross) {
  const rng = match.rng;
  const W = E.shooterPositionWeight;
  const groups = { ST: [], W: [], AM: [], CM: [], other: [] };
  for (const p of A.list) {
    if (p.pos === 'GK') continue;
    (groups[p.pos] || groups.other).push(p);
  }
  const ps = [], ws = [];
  for (const g in groups) {
    const arr = groups[g];
    if (!arr.length) continue;
    const gw = (W[g] ?? W.other) / arr.length;
    for (const p of arr) {
      const e = p.e;
      let stat = e.sho;
      if (g === 'ST' && A.mods.targetMan) stat = e.phy;
      if (cross) {
        stat = (stat + e.phy) / 2;
        if (p.traits.has('aerial')) stat *= TRAIT_EFFECTS.aerial.headerWeightMult;
      }
      ps.push(p); ws.push(gw * Math.max(1, stat));
    }
  }
  return ps.length ? ps[rng.weightedIndex(ws)] : null;
}

function pickAssister(match, A, shooter, cross) {
  const rng = match.rng;
  if (rng.next() < E.unassistedShare) return null;
  const ps = [], ws = [];
  for (const p of A.list) {
    if (p === shooter || p.pos === 'GK') continue;
    let w = Math.max(1, p.e.pas);
    if (cross && (p.pos === 'W' || p.pos === 'FB')) w *= ENGINE_DETAIL.crossAssistMult;
    if (p.traits.has('playmaker')) w *= TRAIT_EFFECTS.playmaker.assistWeightMult;
    ps.push(p); ws.push(w);
  }
  return ps.length ? ps[rng.weightedIndex(ws)] : null;
}

function bestBy(list, f, exclude) {
  let best = null, bv = -Infinity;
  for (const p of list) {
    if (p === exclude || p.pos === 'GK') continue;
    const v = f(p);
    if (v > bv) { bv = v; best = p; }
  }
  return best;
}

function roleTaker(side, roleKey, f) {
  const id = roleKey === 'penalties' && side.penaltyTaker != null ? side.penaltyTaker : side.roles[roleKey];
  if (id != null) {
    const p = side.all.get(id);
    if (p && p.onPitch && p.pos !== 'GK') return p;
  }
  return bestBy(side.list, f);
}

const penaltyDefault = (side) => roleTaker(side, 'penalties', (p) => p.stats.sho ?? 0);
const freeKickTaker = (side) => roleTaker(side, 'freeKicks', (p) => (p.stats.sho ?? 0) + (p.stats.pas ?? 0) + (p.traits.has('deadBall') ? 20 : 0));
const cornerTaker = (side) => roleTaker(side, 'corners', (p) => (p.stats.pas ?? 0) + (p.traits.has('deadBall') ? 10 : 0));

function weightedPlayer(rng, list, wf) {
  if (!list.length) return null;
  const ws = list.map(wf);
  return list[rng.weightedIndex(ws)];
}

// ------------------------------------------------------------------ shot resolution

/**
 * Resolve one shot. Draws from `r` (main rng, or a forked stream for penalties).
 * Returns the outcome string.
 */
function resolveShot(match, r, A, D, shooter, xg, kind, quality) {
  const keeper = keeperOf(D);
  const e = shooter.e;
  let sho = e.sho;
  if (kind === 'header') sho = (e.sho + e.phy) / 2;
  let p = xg * (1 + (sho * E.goalFormula.shoWeight + e.men * E.goalFormula.menWeight - D.lines.GK) / E.goalFormula.divisor);
  if (shooter.traits.has('finisher')) p *= TRAIT_EFFECTS.finisher.goalProbMult;
  if (quality === 'half' && shooter.traits.has('longShots')) p *= TRAIT_EFFECTS.longShots.halfChanceGoalMult;
  if (kind === 'penalty') {
    if (shooter.traits.has('deadBall')) p += TRAIT_EFFECTS.deadBall.penaltyGoalAdd;
    if (keeper && keeper.traits.has('penaltySaver')) p *= TRAIT_EFFECTS.penaltySaver.oppPenaltyGoalMult;
  }
  p = clamp(p, E.goalFormula.min, E.goalFormula.max);
  if (r.next() < p) return 'goal';
  const ng = E.nonGoal;
  const x = r.next() * (ng.save + ng.off + ng.blocked + ng.woodwork);
  if (x < ng.save) return keeper ? 'save' : 'miss';
  if (x < ng.save + ng.off) return 'miss';
  if (x < ng.save + ng.off + ng.blocked) return kind === 'penalty' ? 'miss' : 'blocked';
  return 'woodwork';
}

/** Book-keeping and event for a shot outcome. */
function recordShot(match, out, A, D, shooter, assister, xg, outcome, phaseIdx, setPiece, quality, cross) {
  const st = match.stats[A.key];
  st.shots++; st.xg += xg;
  shooter.shots++;
  const keeper = keeperOf(D);
  if (outcome === 'goal' || outcome === 'save') st.shotsOnTarget++;
  if (outcome === 'goal') {
    match.score[A.key]++;
    shooter.goals++;
    if (assister) assister.assists++;
    for (const p of D.list) p.conceded++;
    match.dirty = true;
  } else if (outcome === 'save' && keeper) keeper.saves++;

  const type = outcome === 'woodwork' ? 'woodwork' : outcome;
  const ev = baseEvent(match, type, A.key, phaseIdx, { playerId: shooter.id, assistId: outcome === 'goal' && assister ? assister.id : null, xg: Math.round(xg * 100) / 100, setPiece: setPiece || null, keeperId: keeper ? keeper.id : null });
  if (outcome !== 'goal' && assister) ev.creatorId = assister.id;
  if (!match.opts.lite) ev.actions = chanceActions(match, A, D, shooter, assister, keeper, outcome, setPiece, quality, cross, phaseIdx);
  pushEvent(match, out, ev, { keeperId: keeper ? keeper.id : null });
  return ev;
}

function chanceActions(match, A, D, shooter, assister, keeper, outcome, setPiece, quality, cross, phaseIdx) {
  const k = A.key;
  const acts = [];
  let t = phaseIdx * 45 + 2;
  const spot = shotSpot(match, setPiece === 'corner' ? 'corner' : setPiece === 'freeKick' ? 'freeKick' : setPiece === 'penalty' ? 'penalty' : quality, cross && !setPiece);
  if (setPiece === 'corner') {
    const fy = match.cornerFlagY ?? 0.5;
    acts.push(step(match, t, 'cross', k, assister, shooter, [104.5, fy], spot)); t += 3;
    acts.push(step(match, t, 'shot', k, shooter, null, spot, outcomeTarget(match, outcome) || [spot[0] + 2, spot[1]]));
  } else if (setPiece === 'freeKick') {
    acts.push(step(match, t, 'freeKick', k, shooter, null, spot, spot)); t += 4;
    acts.push(step(match, t, 'shot', k, shooter, null, spot, outcomeTarget(match, outcome) || [spot[0] + 9, spot[1]]));
  } else if (setPiece === 'penalty') {
    acts.push(step(match, t, 'penalty', k, shooter, null, spot, spot)); t += 4;
    acts.push(step(match, t, 'shot', k, shooter, null, spot, outcomeTarget(match, outcome) || [105, 34]));
  } else {
    const starter = pickBy(match, A.list, (p) => p !== shooter && p !== assister && (p.pos === 'CB' || p.pos === 'DM' || p.pos === 'CM' || p.pos === 'FB'));
    const recv = assister || shooter;
    if (starter) {
      const a = anchorAtt(A, starter);
      const mid = [vr(match, 55, 70), vr(match, 14, 54)];
      acts.push(step(match, t, quality === 'big' && match.vrng.next() < 0.3 ? 'longBall' : 'pass', k, starter, recv, [a[0] + 10, a[1]], mid)); t += 4;
      if (assister) {
        if (cross) {
          const wy = mid[1] < 34 ? vr(match, 3, 9) : vr(match, 59, 65);
          const wide = [vr(match, 88, 97), wy];
          acts.push(step(match, t, 'dribble', k, assister, null, mid, wide)); t += 4;
          acts.push(step(match, t, 'cross', k, assister, shooter, wide, spot)); t += 3;
        } else {
          const pre = [vr(match, 72, 84), vr(match, 20, 48)];
          acts.push(step(match, t, 'dribble', k, assister, null, mid, pre)); t += 4;
          acts.push(step(match, t, 'pass', k, assister, shooter, pre, spot)); t += 3;
        }
      } else {
        acts.push(step(match, t, 'dribble', k, shooter, null, mid, spot)); t += 5;
      }
    } else {
      acts.push(step(match, t, 'dribble', k, shooter, null, [60, 34], spot)); t += 5;
    }
    acts.push(step(match, t, 'shot', k, shooter, null, spot, outcomeTarget(match, outcome) || [spot[0] + 2, spot[1]]));
  }
  t += 2;
  const last = acts[acts.length - 1];
  // outcome step, in absolute coordinates taken from the shot step's target
  const to = last.to;
  if (outcome === 'goal') acts.push({ t, type: 'goal', playerId: shooter.id, targetId: assister ? assister.id : null, from: { ...to }, to: { ...to }, text: actionLine('goal', shooter.name) });
  else if (outcome === 'save') acts.push({ t, type: 'save', playerId: keeper.id, targetId: shooter.id, from: { ...to }, to: { ...to }, text: actionLine('save', keeper.name) });
  else if (outcome === 'blocked') {
    const blocker = pickBy(match, D.list, (p) => p.pos === 'CB' || p.pos === 'FB' || p.pos === 'DM') || keeperOf(D);
    acts.push({ t, type: 'clearance', playerId: blocker ? blocker.id : null, targetId: shooter.id, from: { ...to }, to: P(match, k, vr(match, 70, 85), vr(match, 5, 63)), text: blocker ? actionLine('blocks', blocker.name) : actionLine('blocked') });
  } else acts.push({ t, type: 'miss', playerId: shooter.id, targetId: null, from: { ...to }, to: { ...to }, text: outcome === 'woodwork' ? actionLine('woodwork', shooter.name) : actionLine('miss', shooter.name) });
  return acts;
}

// ------------------------------------------------------------------ phases

function chanceMix(A, D) {
  const m = E.chanceMix;
  let shift = E.mixShiftPer10 * (A.lines.ATT - D.lines.DEF) / 10 + A.mods.bigShift + D.mods.oppBigShift;
  const k = keeperOf(D);
  if (k && k.traits.has('sweeperKeeper')) shift += TRAIT_EFFECTS.sweeperKeeper.oppBigShift;
  const half = Math.max(ENGINE_DETAIL.mixFloor, m.half - shift);
  const big = Math.max(ENGINE_DETAIL.mixFloor, m.big + shift);
  return [half, m.decent, big, m.penalty];
}

const QUAL = ['half', 'decent', 'big', 'penalty'];

function playChance(match, out, A, D, phaseIdx) {
  const rng = match.rng;
  const q = QUAL[rng.weightedIndex(chanceMix(A, D))];
  if (q === 'penalty') return awardPenalty(match, out, A, D, phaseIdx);
  const cross = rng.next() < E.crossShare * A.mods.crosses;
  const shooter = pickShooter(match, A, cross);
  if (!shooter) return;
  const assister = pickAssister(match, A, shooter, cross);
  const xg = E.chanceXg[q];
  const outcome = resolveShot(match, rng, A, D, shooter, xg, cross ? 'header' : 'open', q);
  recordShot(match, out, A, D, shooter, assister, xg, outcome, phaseIdx, null, q, cross);
  afterShot(match, out, A, D, outcome, phaseIdx);
}

function afterShot(match, out, A, D, outcome, phaseIdx) {
  if (outcome === 'save' && match.rng.next() < E.cornerAfterSave) playCorner(match, out, A, D, phaseIdx);
  else if (outcome === 'blocked' && match.rng.next() < E.cornerAfterBlocked) playCorner(match, out, A, D, phaseIdx);
}

function playCorner(match, out, A, D, phaseIdx) {
  const rng = match.rng;
  const st = match.stats[A.key];
  st.corners++;
  const taker = cornerTaker(A);
  // corner header: shooter weighted by PHY
  const cands = A.list.filter((p) => p.pos !== 'GK' && p !== taker);
  if (!cands.length || !taker) return;
  const shooter = weightedPlayer(rng, cands, (p) => Math.max(1, p.e.phy) * (p.traits.has('aerial') ? TRAIT_EFFECTS.aerial.headerWeightMult : 1));
  let xg = E.corner.xg + (A.staff.setPiece > 0 ? E.corner.setPieceCoachBonus : 0) + A.mods.setPieceXg;
  if (taker.traits.has('deadBall')) xg += TRAIT_EFFECTS.deadBall.setPieceXg;
  // corner event (dead ball set-up)
  const ev = baseEvent(match, 'corner', A.key, phaseIdx, { playerId: taker.id, setPiece: 'corner' });
  if (!match.opts.lite) {
    const fy = match.vrng.next() < 0.5 ? 0.5 : 67.5;
    match.cornerFlagY = fy;
    const k = keeperOf(D) || D.list[0];
    ev.actions = [
      { t: phaseIdx * 45 + 20, type: 'clearance', playerId: k ? k.id : null, targetId: null, from: P(match, A.key, 103, 34), to: P(match, A.key, 105, fy), text: k ? actionLine('turnsBehind', k.name) : actionLine('behindForCorner') },
      { t: phaseIdx * 45 + 26, type: 'corner', playerId: taker.id, targetId: null, from: P(match, A.key, 104.5, fy), to: P(match, A.key, 104.5, fy), text: actionLine('corner', taker.name) },
    ];
  }
  pushEvent(match, out, ev);
  const outcome = resolveShot(match, rng, A, D, shooter, xg, 'header', 'corner');
  recordShot(match, out, A, D, shooter, taker, xg, outcome, phaseIdx, 'corner', 'corner', true);
}

function awardPenalty(match, out, A, D, phaseIdx) {
  const rng = match.rng;
  const fouled = weightedPlayer(rng, A.list.filter((p) => p.pos !== 'GK'), (p) => E.fouledPosWeight[p.pos] || 1);
  const fouler = weightedPlayer(rng, D.list.filter((p) => p.pos !== 'GK'), (p) => E.foulPosWeight[p.pos] || 1);
  const def = penaltyDefault(A);
  const ev = baseEvent(match, 'penalty', A.key, phaseIdx, { playerId: def ? def.id : null, setPiece: 'penalty', foulerId: fouler ? fouler.id : null, fouledId: fouled ? fouled.id : null });
  if (!match.opts.lite && fouled && fouler) {
    const t = phaseIdx * 45 + 4;
    const box = [vr(match, 90, 99), vr(match, 22, 46)];
    ev.actions = [
      step(match, t, 'dribble', A.key, fouled, null, [vr(match, 75, 85), box[1]], box),
      step(match, t + 4, 'foul', A.key, fouler, fouled, box, box),
      step(match, t + 8, 'penalty', A.key, def, null, [94, 34], [94, 34]),
    ];
  }
  pushEvent(match, out, ev);
  if (match.opts.keyMoments && !A.isAI && def) {
    const options = A.list.filter((p) => p.pos !== 'GK').sort((a, b) => (b.stats.sho ?? 0) - (a.stats.sho ?? 0)).map((p) => p.id);
    match.prompt = { type: 'penaltyTaker', team: A.key, options, defaultId: def.id, minute: ev.minute };
    match.pending = { kind: 'penalty', side: A.key, phaseIdx };
    return 'pause';
  }
  takePenalty(match, out, A, D, phaseIdx, def);
}

function takePenalty(match, out, A, D, phaseIdx, taker) {
  if (!taker) return;
  const fr = rngFrom((match.seed ^ hashSeed(`pen:${match.tickCount}:${phaseIdx}`)) >>> 0);
  const xg = E.chanceXg.penalty;
  const outcome = resolveShot(match, fr, A, D, taker, xg, 'penalty', 'penalty');
  recordShot(match, out, A, D, taker, null, xg, outcome, phaseIdx, 'penalty', 'penalty', false);
  // no corner chain after a penalty save (stream independence: penalty draws stay on the forked stream)
}

const FS = ENGINE_DETAIL.foulStat;

function playFoul(match, out, A, D, phaseIdx, inAttack) {
  // D commits the foul on A.
  const rng = match.rng;
  const fouler = weightedPlayer(rng, D.list, (p) => (E.foulPosWeight[p.pos] || 1) * Math.max(FS.floor, (p.e && p.e.phy) || FS.fallback) / FS.ref);
  const fouled = weightedPlayer(rng, A.list.filter((p) => p.pos !== 'GK'), (p) => (E.fouledPosWeight[p.pos] || 1) * Math.max(FS.floor, (p.e && p.e.dri) || FS.fallback) / FS.ref);
  if (!fouler) return;
  match.stats[D.key].fouls++;
  const ev = baseEvent(match, 'foul', D.key, phaseIdx, { playerId: fouler.id, fouledId: fouled ? fouled.id : null });
  let spot = null;
  if (!match.opts.lite && fouled) {
    const t = phaseIdx * 45 + 10;
    spot = inAttack ? [vr(match, 68, 88), vr(match, 12, 56)] : [vr(match, 35, 65), vr(match, 8, 60)];
    ev.actions = [
      step(match, t, 'dribble', A.key, fouled, null, [spot[0] - 6, spot[1]], spot),
      step(match, t + 3, 'foul', A.key, fouler, fouled, spot, spot),
    ];
  }
  pushEvent(match, out, ev);

  // cards (fouler side's mods carry time-wasting yellow points)
  const yellowP = E.yellowOnFoul + D.mods.yellowPts;
  const x = rng.next();
  if (x < E.redOnFoul) giveCard(match, out, D, fouler, 'red', phaseIdx, false, spot, A);
  else if (x < E.redOnFoul + yellowP) {
    fouler.yellows++;
    if (fouler.yellows >= 2) giveCard(match, out, D, fouler, 'red', phaseIdx, true, spot, A);
    else giveCard(match, out, D, fouler, 'yellow', phaseIdx, false, spot, A);
  }

  // direct free kick for the fouled side, only from attacking fouls
  if (inAttack && rng.next() < E.freeKick.shotShare) {
    if (match.dirty) refresh(match);
    const taker = freeKickTaker(A);
    if (!taker) return;
    let xg = E.freeKick.xg + A.mods.setPieceXg + (A.staff.setPiece > 0 ? E.corner.setPieceCoachBonus : 0);
    if (taker.traits.has('deadBall')) xg += TRAIT_EFFECTS.deadBall.setPieceXg;
    const outcome = resolveShot(match, rng, A, D, taker, xg, 'freeKick', 'freeKick');
    recordShot(match, out, A, D, taker, null, xg, outcome, phaseIdx, 'freeKick', 'freeKick', false);
    afterShot(match, out, A, D, outcome, phaseIdx);
  }
}

function giveCard(match, out, side, p, kind, phaseIdx, second, spot, opp) {
  const st = match.stats[side.key];
  const ev = baseEvent(match, kind, side.key, phaseIdx, { playerId: p.id, secondYellow: second });
  if (!match.opts.lite) {
    const s = spot || [52, 34];
    const taker = bestBy(opp.list, (q) => q.stats.pas ?? 0);
    ev.actions = [
      step(match, phaseIdx * 45 + 16, 'foul', opp.key, p, null, s, s, p.name, ''),
      step(match, phaseIdx * 45 + 30, 'freeKick', opp.key, taker, null, s, s),
    ];
  }
  pushEvent(match, out, ev, { secondYellow: second });
  match.cards.push({ team: side.key, playerId: p.id, minute: ev.minute, addedMin: ev.addedMin, type: kind, second });
  match.stoppages[match.half] += E.addedTime.perCard;
  if (kind === 'yellow') { st.yellows++; return; }
  st.reds++;
  p.red = true;
  removeFromPitch(match, out, side, p, phaseIdx, 'red');
}

function playOffside(match, out, A, D, phaseIdx) {
  const rng = match.rng;
  const runners = A.list.filter((p) => p.pos === 'ST' || p.pos === 'W' || p.pos === 'AM');
  const pool = runners.length ? runners : A.list.filter((p) => p.pos !== 'GK');
  const p = weightedPlayer(rng, pool, (q) => Math.max(1, q.e.pac));
  if (!p) return;
  match.stats[A.key].offsides++;
  const ev = baseEvent(match, 'offside', A.key, phaseIdx, { playerId: p.id });
  if (!match.opts.lite) {
    const passer = pickBy(match, A.list, (q) => q !== p && q.pos !== 'GK' && q.pos !== 'ST');
    const t = phaseIdx * 45 + 8;
    const from = [vr(match, 45, 65), vr(match, 14, 54)];
    const to = [vr(match, 82, 92), vr(match, 18, 50)];
    ev.actions = [
      step(match, t, 'longBall', A.key, passer, p, from, to),
      step(match, t + 4, 'offside', A.key, p, null, to, to),
    ];
  }
  pushEvent(match, out, ev);
}

/** Filler event for a tick with no notable play. */
function fillerEvent(match, out, A, D, type, phaseIdx) {
  const ev = baseEvent(match, type, A.key, phaseIdx, {});
  const outfield = A.list.filter((p) => p.pos !== 'GK');
  if (!outfield.length) return;
  const mids = outfield.filter((p) => p.pos === 'CM' || p.pos === 'DM' || p.pos === 'AM' || p.pos === 'CB' || p.pos === 'FB');
  const pool = mids.length >= 2 ? mids : outfield;
  // carrier chosen without any rng so lite and full modes agree on playerId
  let cur = pool[match.tickCount % pool.length];
  ev.playerId = cur.id;
  if (!match.opts.lite) {
    const n = type === 'quiet' ? 2 + Math.floor(match.vrng.next() * 2) : 2;
    let a = anchorAtt(A, cur);
    let pos = [a[0] + 8, a[1]];
    let t = 6;
    for (let i = 0; i < n; i++) {
      let nxt = pool[Math.floor(match.vrng.next() * pool.length)];
      if (nxt === cur) nxt = pool[(pool.indexOf(cur) + 1) % pool.length];
      const b = anchorAtt(A, nxt);
      const to = [b[0] + 8 + vr(match, -4, 6), b[1] + vr(match, -4, 4)];
      if (type === 'turnover' && i === n - 1) {
        const tk = pickBy(match, D.list, (p) => p.pos === 'CM' || p.pos === 'DM' || p.pos === 'CB' || p.pos === 'FB') || D.list[0];
        ev.actions.push(step(match, t, 'pass', A.key, cur, nxt, pos, to));
        ev.actions.push(step(match, t + 3, match.vrng.next() < 0.5 ? 'tackle' : 'interception', A.key, tk, nxt, to, to, tk ? tk.name : '', nxt.name));
        break;
      }
      ev.actions.push(step(match, t, 'pass', A.key, cur, nxt, pos, to));
      cur = nxt; pos = to; t += 5;
    }
  }
  pushEvent(match, out, ev);
}

// ------------------------------------------------------------------ subs, injuries, removal

function removeFromPitch(match, out, side, p, phaseIdx, why) {
  if (p.slot == null) return;
  const slot = p.slot;
  side.slots[slot] = null;
  p.onPitch = false;
  p.minOff = currentMinute(match);
  p.lastSlot = slot;
  p.slot = null;
  rebuildList(side);
  match.dirty = true;
  if (slot === 0) handleKeeperLoss(match, out, side, phaseIdx, why, p);
}

function handleKeeperLoss(match, out, side, phaseIdx, why, gone) {
  // 1) bench keeper if a sub is left
  if (side.subsUsed < E.subs) {
    const gk = side.bench.find((b) => b.pos === 'GK' && !b.onPitch && !b.subbedOff && b.minOn == null);
    if (gk) {
      if (why === 'red') {
        // sacrifice the lowest-fitness outfielder
        let low = null;
        for (const q of side.list) if (q.pos !== 'GK' && (!low || q.fitness < low.fitness)) low = q;
        if (low) {
          const s = low.slot;
          side.slots[s] = null; low.onPitch = false; low.subbedOff = true; low.minOff = currentMinute(match); low.lastSlot = s; low.slot = null;
          rebuildList(side);
          doSubIn(match, out, side, gk, 0, low, phaseIdx);
          return;
        }
      }
      if (why === 'injury' && side.isAI === false && match.opts.keyMoments && !match.opts.autoSubs) {
        // human with key moments: prompt handles it (default = this keeper)
        return;
      }
      doSubIn(match, out, side, gk, 0, gone, phaseIdx);
      return;
    }
  }
  emergencyKeeper(match, side);
}

function emergencyKeeper(match, side) {
  let best = null;
  for (const q of side.list) if (q.pos !== 'GK' && (!best || (q.stats.phy ?? 0) > (best.stats.phy ?? 0))) best = q;
  if (!best) return;
  side.slots[best.slot] = null;
  best.slot = 0;
  side.slots[0] = best;
  best.pos = 'GK';
  best.stats = toKeeperStats(best.stats);
  best.e = null;
  side.emergencyGK = true;
  rebuildList(side);
  match.dirty = true;
}

function currentMinute(match) {
  if (match.phase === 'pre') return 0;
  if (match.tickInHalf < HALF_TICKS) return (match.half - 1) * 45 + match.tickInHalf * 3 + 3;
  return match.half * 45 + (match.tickInHalf - HALF_TICKS) * 3 + 3;
}

/** Put bench player `inP` into `slot`. `outP` (may be null) already left the pitch. */
function doSubIn(match, out, side, inP, slot, outP, phaseIdx) {
  const slotPos = FORMATIONS[side.formation].slots[slot].pos;
  const pen = cardOopPenalty(inP.nativePos || inP.pos, inP.altPos || [], slotPos).penalty;
  if (slotPos === 'GK' && inP.pos !== 'GK') inP.stats = toKeeperStats(inP.stats);
  else if (slotPos !== 'GK' && inP.pos === 'GK') inP.stats = toOutfieldStats(inP.stats);
  else if (pen) for (const k in inP.stats) inP.stats[k] = Math.max(1, inP.stats[k] - pen);
  inP.pos = slotPos;
  inP.slot = slot;
  inP.onPitch = true;
  inP.minOn = currentMinute(match);
  inP.e = null;
  side.slots[slot] = inP;
  side.subsUsed++;
  if (outP) outP.subbedOff = true;
  rebuildList(side);
  match.dirty = true;
  match.stoppages[match.half] += E.addedTime.perSub;
  match.subs.push({ team: side.key, inId: inP.id, outId: outP ? outP.id : null, minute: inP.minOn });
  const ev = baseEvent(match, 'sub', side.key, phaseIdx, { playerId: inP.id, outId: outP ? outP.id : null });
  pushEvent(match, out, ev, { outId: outP ? outP.id : null });
}

function benchCandidate(side, slotPos) {
  let best = null, bv = -Infinity;
  for (const b of side.bench) {
    if (b.onPitch || b.subbedOff || b.minOn != null || b.injured) continue;
    if ((b.pos === 'GK') !== (slotPos === 'GK')) continue;
    const v = (b.ovr ?? ENGINE_DETAIL.benchDefaultOvr) - cardOopPenalty(b.nativePos || b.pos, b.altPos || [], slotPos).penalty + b.fitness / ENGINE_DETAIL.benchFitnessDiv;
    if (v > bv) { bv = v; best = b; }
  }
  return best;
}

function autoSub(match, out, side, outP, phaseIdx) {
  if (side.subsUsed >= E.subs) return false;
  const slot = outP.slot != null ? outP.slot : outP.lastSlot;
  const slotPos = FORMATIONS[side.formation].slots[slot].pos;
  const inP = benchCandidate(side, slotPos);
  if (!inP) return false;
  if (outP.onPitch) {
    side.slots[slot] = null; outP.onPitch = false; outP.minOff = currentMinute(match); outP.lastSlot = slot; outP.slot = null;
    rebuildList(side);
  }
  doSubIn(match, out, side, inP, slot, outP, phaseIdx);
  return true;
}

function injuryMatches(match, side) {
  const im = E.injuryMatches;
  let n = 1 + match.rng.weightedIndex(im.weights);
  if (side.staff.physio > 0) n = Math.max(1, n - im.physioShorter);
  return n;
}

function endOfTick(match, out) {
  const rng = match.rng;
  const minute = currentMinute(match);
  for (const side of [match.home, match.away]) {
    const fat = E.fitnessDrain * side.mods.fatigue * (side.staff.fitness > 0 ? E.fitnessCoachDrain : 1);
    const injured = [];
    for (const p of side.list) {
      let d = fat;
      if (p.traits.has('engine')) d *= TRAIT_EFFECTS.engine.fatigueMult;
      if (p.id === side.markerId) d *= side.mods.markerDrain;
      p.fitness = Math.max(0, p.fitness - d);
      let ic = E.injuryChance;
      if (p.fitness < E.injuryLowFitnessBelow) ic *= E.injuryLowFitnessMult;
      if (side.staff.physio > 0) ic *= E.physioMult;
      const [lo, hi] = E.injuryProneRange;
      ic *= lo + (hi - lo) * ((clamp(p.injuryProne, 1, 20) - 1) / 19);
      if (p.traits.has('injuryResistant')) ic *= TRAIT_EFFECTS.injuryResistant.injuryMult;
      if (rng.next() < ic) injured.push(p);
    }
    for (const p of injured) {
      p.injured = true;
      p.injuryMatches = injuryMatches(match, side);
      match.injuries.push({ team: side.key, playerId: p.id, minute, matches: p.injuryMatches });
      match.stoppages[match.half] += E.addedTime.perInjury;
      const ev = baseEvent(match, 'injury', side.key, E.phasesPerTick - 1, { playerId: p.id, matches: p.injuryMatches });
      if (!match.opts.lite) {
        const opp = match[OTHER[side.key]];
        const c = pickBy(match, opp.list, (q) => q.pos !== 'GK');
        const a = anchorAtt(side, p);
        ev.actions = [
          step(match, 170, 'dribble', side.key, p, null, [a[0] + 5, a[1]], [a[0] + 9, a[1]]),
          step(match, 174, 'clearance', side.key, c, null, [a[0] + 9, a[1]], [a[0] + 9, a[1] < 34 ? 0 : 68]),
        ];
      }
      pushEvent(match, out, ev);
      const wasKeeper = p.slot === 0;
      const humanPrompt = !side.isAI && match.opts.keyMoments && !match.opts.autoSubs;
      if (wasKeeper) {
        removeFromPitch(match, out, side, p, E.phasesPerTick - 1, 'injury');
        if (humanPrompt && !side.slots[0]) setInjuryPrompt(match, side, p);
      } else if (humanPrompt && !match.pending) {
        removeFromPitch(match, out, side, p, E.phasesPerTick - 1, 'injury');
        setInjuryPrompt(match, side, p);
      } else if (!autoSub(match, out, side, p, E.phasesPerTick - 1)) {
        removeFromPitch(match, out, side, p, E.phasesPerTick - 1, 'injury');
      }
    }
  }
  // AI game state and subs
  for (const side of [match.home, match.away]) {
    const diff = match.score[side.key] - match.score[OTHER[side.key]];
    if (side.isAI) {
      const prev = side.mentality;
      if (minute >= E.aiTrailAfter && diff < 0) side.mentality = 'attacking';
      else if (minute >= E.aiLeadAfter && diff > 0) side.mentality = 'defensive';
      else side.mentality = null;
      if (prev !== side.mentality) match.dirty = true;
    }
    if (side.isAI || match.opts.autoSubs) {
      const mins = E.aiSubMinutes;
      while (match.aiSubsDone[side.key] < mins.length && minute >= mins[match.aiSubsDone[side.key]]) {
        match.aiSubsDone[side.key]++;
        let low = null;
        for (const p of side.list) if (p.pos !== 'GK' && (!low || p.fitness < low.fitness)) low = p;
        if (low) autoSub(match, out, side, low, E.phasesPerTick - 1);
      }
    }
  }
}

function setInjuryPrompt(match, side, p) {
  const slot = p.lastSlot;
  const slotPos = FORMATIONS[side.formation].slots[slot].pos;
  const def = side.subsUsed < E.subs ? benchCandidate(side, slotPos) : null;
  const options = side.bench.filter((b) => !b.onPitch && !b.subbedOff && b.minOn == null).map((b) => b.id);
  if (!options.length || side.subsUsed >= E.subs) {
    if (slot === 0 && !side.slots[0]) emergencyKeeper(match, side);
    return;
  }
  match.prompt = { type: 'injurySub', team: side.key, outId: p.id, options, defaultId: def ? def.id : null };
  match.pending = { kind: 'injurySub', side: side.key, outId: p.id };
}

// ------------------------------------------------------------------ prompts

function resolvePending(match, out) {
  const pd = match.pending;
  const pr = match.prompt;
  match.pending = null;
  match.prompt = null;
  if (!pd) return null;
  if (pd.kind === 'penalty') {
    const A = match[pd.side], D = match[OTHER[pd.side]];
    if (match.dirty) refresh(match);
    let taker = null;
    const chosen = pr && pr.chosenId != null ? A.all.get(pr.chosenId) : null;
    if (chosen && chosen.onPitch) taker = chosen;
    if (!taker) taker = penaltyDefault(A);
    if (taker && !taker.e) computeEff(A, taker, match.minute);
    takePenalty(match, out, A, D, pd.phaseIdx, taker);
    return pd.phaseIdx + 1;
  }
  if (pd.kind === 'injurySub') {
    const side = match[pd.side];
    const outP = side.all.get(pd.outId);
    if (outP && !outP.subbedOff && side.subsUsed < E.subs) {
      const slot = outP.lastSlot;
      const slotPos = FORMATIONS[side.formation].slots[slot].pos;
      let inP = pr && pr.chosenId != null ? side.all.get(pr.chosenId) : null;
      if (!inP || inP.onPitch || inP.subbedOff || inP.minOn != null) inP = benchCandidate(side, slotPos);
      if (inP && !side.slots[slot]) doSubIn(match, out, side, inP, slot, outP, 0);
    }
    if (!side.slots[0]) emergencyKeeper(match, side);
  }
  // halftimeTalk and lateGame need nothing on default
  return null;
}

// ------------------------------------------------------------------ the tick

/**
 * Play one 3-minute tick (or finish a tick paused on a key-moment prompt).
 * @param {Object} match
 * @returns {import('./cards.js').MatchEvent[]} events of this tick; `.prompt` is set when a key moment is open
 */
export function stepTick(match) {
  const out = [];
  if (match.phase === 'finished') return out;
  let startPhase = 0;
  if (match.pending || match.prompt) {
    const resume = resolvePending(match, out);
    if (resume != null) startPhase = resume;
  }
  if (startPhase === 0) {
    match.tCursor = 0;
    if (match.phase === 'pre' || match.phase === 'halftime') {
      const kicking = match.phase === 'pre' ? match.home : match.away;
      if (match.phase === 'halftime') { match.half = 2; match.tickInHalf = 0; }
      match.phase = match.half === 1 ? 'first' : 'second';
      kickoffEvent(match, out, kicking);
    }
  }
  const tm = evMinute(match, 0);
  match.minute = tm.minute;
  match.addedMin = tm.addedMin;
  if (startPhase === 0) {
    for (const sd of [match.home, match.away]) {
      if (sd.shout && match.tickCount >= sd.shout.until) sd.shout = null;
      sd.shoutNow = sd.shout ? sd.shout.amount : 0;
    }
    refresh(match);
    const pHome = possessionHome(match);
    match.tickPHome = pHome;
    match.tickXg = { home: match.stats.home.xg, away: match.stats.away.xg };
    match.tickOutcomes = null;
  }
  const r = runPhases(match, out, startPhase);
  if (r === 'pause') { out.prompt = match.prompt; return out; }
  finishTick(match, out);
  out.prompt = match.prompt;
  return out;
}

function possessionHome(match) {
  const a = match.home.lines.MID, b = match.away.lines.MID;
  return (a * a) / (a * a + b * b);
}

function runPhases(match, out, start) {
  const rng = match.rng;
  let pHome = match.tickPHome;
  for (let i = start; i < E.phasesPerTick; i++) {
    if (match.dirty) { refresh(match); pHome = possessionHome(match); }
    const A = rng.next() < pHome ? match.home : match.away;
    const D = match[OTHER[A.key]];
    let ar = E.attackRate;
    const tw = (A.mods.timeWasting || D.mods.timeWasting) && match.minute >= TACTIC_CARD_VALUES.timeWasting.afterMinute;
    if (tw) ar *= TACTIC_CARD_VALUES.timeWasting.attackMult;
    let outcome;
    if (rng.next() < ar) {
      const pc = clamp(E.pChance.base + (A.lines.ATT - D.lines.DEF) / E.pChance.divisor + D.mods.oppPChance, E.pChance.min, E.pChance.max);
      if (rng.next() < pc) {
        outcome = 'chance';
        // Offside trap: the extra offside share is taken from the attacker's chances
        if (D.mods.oppOffsideMult > 1 && rng.next() < E.nonChance.offside * (D.mods.oppOffsideMult - 1)) {
          outcome = 'offside';
          playOffside(match, out, A, D, i);
          match.lastPhaseSide = A.key;
          match.lastOutcome = outcome;
          continue;
        }
        const res = playChance(match, out, A, D, i);
        if (res === 'pause') { match.lastPhaseSide = A.key; return 'pause'; }
      } else {
        const foulP = E.nonChance.foul + D.mods.foulPts;
        const offP = E.nonChance.offside * D.mods.oppOffsideMult;
        const x = rng.next();
        if (x < foulP) { outcome = 'foul'; playFoul(match, out, A, D, i, true); }
        else if (x < foulP + offP) { outcome = 'offside'; playOffside(match, out, A, D, i); }
        else outcome = 'turnover';
      }
    } else {
      outcome = 'quiet';
      if (E.quietFoul > 0 && rng.next() < E.quietFoul + D.mods.foulPts) { outcome = 'foul'; playFoul(match, out, A, D, i, false); }
    }
    match.lastPhaseSide = A.key;
    match.lastOutcome = outcome;
  }
  return 'done';
}

function kickoffEvent(match, out, side) {
  const ev = baseEvent(match, 'kickoff', side.key, 0, {});
  const st = side.list.find((p) => p.pos === 'ST') || side.list.find((p) => p.pos !== 'GK');
  const mate = side.list.find((p) => p !== st && (p.pos === 'CM' || p.pos === 'AM' || p.pos === 'DM')) || side.list.find((p) => p !== st && p.pos !== 'GK');
  if (st) ev.playerId = st.id;
  if (match.half === 2) { ev.minute = 45; } else ev.minute = 0;
  if (!match.opts.lite && st && mate) {
    const a = anchorAtt(side, mate);
    ev.actions = [
      step(match, 0, 'kickOff', side.key, st, mate, [52.5, 34], [51, 34]),
      step(match, 2, 'pass', side.key, st, mate, [51, 34], [a[0] + 5, a[1]]),
    ];
  }
  pushEvent(match, out, ev);
}

function finishTick(match, out) {
  // filler when the tick had no play event
  const playTypes = out.some((e) => e.type !== 'kickoff' && e.type !== 'sub');
  if (!playTypes) {
    const A = match[match.lastPhaseSide || 'home'];
    fillerEvent(match, out, A, match[OTHER[A.key]], match.lastOutcome === 'turnover' ? 'turnover' : 'quiet', E.phasesPerTick - 1);
  }
  match.minute = evMinute(match, E.phasesPerTick - 1).minute;
  endOfTick(match, out);

  // possession and momentum
  const pHome = match.tickPHome;
  match.possSum += pHome;
  match.tickCount++;
  const dx = (match.stats.home.xg - match.tickXg.home) - (match.stats.away.xg - match.tickXg.away);
  const MO = ENGINE_DETAIL.momentum;
  const signal = clamp((pHome - 0.5) * MO.possScale + dx * MO.xgScale, -1, 1);
  match.momentum = Math.round(clamp(MO.keep * match.momentum + MO.signal * signal, -1, 1) * MO.round) / MO.round;

  match.tickInHalf++;
  if (match.tickInHalf === HALF_TICKS) {
    const s = E.addedTime;
    const a = Math.min(E.maxAddedTicksPerHalf, Math.floor((s.base + match.stoppages[match.half]) / s.per));
    if (match.half === 1) match.added.h1 = a; else match.added.h2 = a;
    if (a > 0) {
      const ev = baseEvent(match, 'addedTime', 'home', E.phasesPerTick - 1, { minutes: a * 3 });
      ev.minute = match.half * 45;
      ev.addedMin = 0;
      pushEvent(match, out, ev, { addedMinutes: a * 3 });
    }
  }
  const addedNow = match.half === 1 ? match.added.h1 : match.added.h2;
  if (addedNow != null && match.tickInHalf >= HALF_TICKS + addedNow) {
    if (match.half === 1) {
      match.phase = 'halftime';
      const ev = baseEvent(match, 'halftime', 'home', 0, {});
      ev.minute = 45; ev.addedMin = (match.added.h1 || 0) * 3;
      pushEvent(match, out, ev);
      if (match.opts.keyMoments && !match.prompt) {
        const human = !match.home.isAI ? 'home' : !match.away.isAI ? 'away' : null;
        if (human) match.prompt = { type: 'halftimeTalk', team: human, options: ['shout', 'calm', 'none'], defaultId: 'none' };
      }
    } else {
      match.phase = 'finished';
      match.minute = 90;
      const ev = baseEvent(match, 'fulltime', 'home', 0, {});
      ev.minute = 90; ev.addedMin = (match.added.h2 || 0) * 3;
      pushEvent(match, out, ev);
      for (const side of [match.home, match.away]) for (const p of side.list) if (p.minOff == null) p.minOff = 90 + (match.added.h2 || 0) * 3;
      match.prompt = null;
    }
  } else if (match.opts.keyMoments && !match.prompt && !match.lateGameAsked && match.half === 2 && currentMinute(match) >= 75) {
    const human = !match.home.isAI ? 'home' : !match.away.isAI ? 'away' : null;
    if (human) {
      match.lateGameAsked = true;
      const diff = match.score[human] - match.score[OTHER[human]];
      if (Math.abs(diff) <= 1) match.prompt = { type: 'lateGame', team: human, options: ['push', 'hold', 'keep'], defaultId: 'keep', diff };
    }
  }
  match.dirty = true;
}

// ------------------------------------------------------------------ decisions

const PROMPT_ANSWERS = new Set(['penaltyTaker', 'injurySub', 'halftimeTalk', 'lateGame']);

/**
 * Apply a manager decision. Returns { ok:boolean, error?:string }.
 * Decisions:
 *   {type:'sub', team, outId, inId}             max 5, inId from the bench, outId on the pitch (or just injured)
 *   {type:'mentality', team, value}             defensive | balanced | attacking
 *   {type:'tacticCard', team, slot, cardId}     half time only, slot 0-2, cardId null clears
 *   {type:'settings', team, patch}              any of mentality, pressing, width, passing, defLine
 *   {type:'penaltyTaker', team, playerId}       answers an open penalty prompt, or sets the taker for later penalties
 *   {type:'teamTalk', team, value}              half-time prompt: 'shout' | 'calm' | 'none'
 *   {type:'lateGame', team, value}              minute-75 prompt: 'push' | 'hold' | 'keep'
 */
export function applyDecision(match, d) {
  if (!d || !match[d.team]) return { ok: false, error: 'unknown team' };
  if (match.phase === 'finished') return { ok: false, error: 'match finished' };
  const side = match[d.team];
  const out = [];
  switch (d.type) {
    case 'sub': {
      if (side.subsUsed >= E.subs) return { ok: false, error: 'no subs left' };
      const outP = side.all.get(d.outId);
      const inP = side.all.get(d.inId);
      if (!outP || !inP) return { ok: false, error: 'unknown player' };
      if (!side.bench.includes(inP) || inP.onPitch || inP.subbedOff || inP.minOn != null) return { ok: false, error: 'in player not available on the bench' };
      if (outP.red) return { ok: false, error: 'player was sent off' };
      if (outP.subbedOff) return { ok: false, error: 'player already off' };
      let slot;
      if (outP.onPitch) {
        slot = outP.slot;
        side.slots[slot] = null; outP.onPitch = false; outP.minOff = currentMinute(match); outP.lastSlot = slot; outP.slot = null;
        rebuildList(side);
      } else if (outP.injured && outP.lastSlot != null && !side.slots[outP.lastSlot]) slot = outP.lastSlot;
      else return { ok: false, error: 'out player not on the pitch' };
      if (side.slots[0] && side.slots[0].id === inP.id) return { ok: false, error: 'invalid' };
      // an emergency keeper case: if the GK slot is empty and the in player is a keeper, he goes in goal
      if (inP.pos === 'GK' && slot !== 0 && !side.slots[0]) slot = 0;
      doSubIn(match, out, side, inP, slot, outP, E.phasesPerTick - 1);
      if (match.pending && match.pending.kind === 'injurySub' && match.pending.outId === outP.id) { match.pending = null; match.prompt = null; }
      break;
    }
    case 'mentality':
      if (!TACTIC_OPTIONS.mentality.includes(d.value)) return { ok: false, error: 'bad mentality' };
      side.settings = { ...side.settings, mentality: d.value };
      side.mentality = null;
      break;
    case 'settings': {
      const next = { ...side.settings };
      for (const k in d.patch || {}) {
        if (!TACTIC_OPTIONS[k] || !TACTIC_OPTIONS[k].includes(d.patch[k])) return { ok: false, error: `bad setting ${k}` };
        next[k] = d.patch[k];
      }
      side.settings = next;
      break;
    }
    case 'tacticCard': {
      if (match.phase !== 'halftime') return { ok: false, error: 'tactic cards change only at half time' };
      if (!(d.slot >= 0 && d.slot < SQUAD_RULES.tacticSlots)) return { ok: false, error: 'bad slot' };
      if (d.cardId != null && !TACTIC_CARD_VALUES[d.cardId]) return { ok: false, error: 'unknown card' };
      const cards = side.tacticCards.slice();
      while (cards.length < SQUAD_RULES.tacticSlots) cards.push(null);
      if (d.cardId != null && cards.some((c, i) => c === d.cardId && i !== d.slot)) return { ok: false, error: 'card already equipped' };
      cards[d.slot] = d.cardId ?? null;
      side.tacticCards = cards;
      break;
    }
    case 'penaltyTaker': {
      const p = side.all.get(d.playerId);
      if (!p) return { ok: false, error: 'unknown player' };
      side.penaltyTaker = d.playerId;
      if (match.prompt && match.prompt.type === 'penaltyTaker' && match.prompt.team === d.team) match.prompt.chosenId = d.playerId;
      break;
    }
    case 'teamTalk': {
      if (!match.prompt || match.prompt.type !== 'halftimeTalk' || match.prompt.team !== d.team) return { ok: false, error: 'no half-time talk open' };
      const diff = match.score[d.team] - match.score[OTHER[d.team]];
      // shout lifts a side that is not ahead, irritates a winning one; calm settles a winning side
      const TT = ENGINE_DETAIL.teamTalk;
      if (d.value === 'shout') side.teamTalk = diff <= 0 ? TT.shout.notAhead : TT.shout.ahead;
      else if (d.value === 'calm') side.teamTalk = diff > 0 ? TT.calm.ahead : TT.calm.notAhead;
      match.prompt = null; match.pending = null;
      break;
    }
    case 'shout': {
      const SH = ENGINE_DETAIL.shouts;
      if (!SH.duration[d.value]) return { ok: false, error: 'unknown shout' };
      if (match.phase === 'finished' || match.phase === 'halftime') return { ok: false, error: 'not now' };
      const ready = Math.max(side.shoutReady[d.value], side.shoutShared);
      if (match.tickCount < ready) return { ok: false, error: 'cooldown', readyIn: ready - match.tickCount };
      const ahead = match.score[d.team] > match.score[OTHER[d.team]];
      const amt = SH.amount[d.value][ahead ? 'ahead' : 'notAhead'];
      side.shout = { kind: d.value, amount: amt, until: match.tickCount + SH.duration[d.value] };
      side.shoutNow = amt;
      side.shoutReady[d.value] = match.tickCount + SH.cooldown[d.value];
      side.shoutShared = match.tickCount + SH.sharedCooldown;
      break;
    }
    case 'lateGame': {
      if (!match.prompt || match.prompt.type !== 'lateGame' || match.prompt.team !== d.team) return { ok: false, error: 'no late-game call open' };
      if (d.value === 'push') side.settings = { ...side.settings, mentality: 'attacking' };
      else if (d.value === 'hold') side.settings = { ...side.settings, mentality: 'defensive' };
      match.prompt = null; match.pending = null;
      break;
    }
    default:
      return { ok: false, error: 'unknown decision' };
  }
  match.dirty = true;
  return { ok: true, events: out };
}

// ------------------------------------------------------------------ ratings and summary

function computeRatings(match) {
  const R = E.rating;
  const ratings = {};
  const endMin = match.phase === 'finished' ? 90 + (match.added.h2 || 0) * 3 : currentMinute(match);
  for (const side of [match.home, match.away]) {
    const opp = OTHER[side.key];
    const won = match.phase === 'finished' && match.score[side.key] > match.score[opp];
    for (const p of side.all.values()) {
      if (p.minOn == null) continue;
      const minutes = (p.minOff == null ? endMin : p.minOff) - p.minOn;
      let r = R.start + p.goals * R.goal + p.assists * R.assist;
      const defLine = p.pos === 'GK' || POS_LINE[p.pos] === 'def';
      if (p.pos === 'GK') r += p.saves * R.save;
      if (defLine) {
        if (p.conceded === 0 && minutes >= ENGINE_DETAIL.cleanSheetMinutes) r += R.cleanSheet;
        r += p.conceded * R.conceded;
      }
      if (p.red) r += R.red;
      else if (p.yellows > 0) r += R.yellow;
      if (won) r += R.win;
      ratings[p.id] = r1(clamp(r, R.min, R.max));
    }
  }
  return ratings;
}

/**
 * Summary of a match (finished or in progress). Same shape as simulate().
 */
export function summarise(match) {
  const ratings = computeRatings(match);
  let motm = null, best = -1;
  for (const side of [match.home, match.away]) {
    const opp = OTHER[side.key];
    const won = match.score[side.key] > match.score[opp];
    for (const p of side.all.values()) {
      if (ratings[p.id] == null) continue;
      const M = ENGINE_DETAIL.motm;
      const v = ratings[p.id] * M.rating + (p.goals + p.assists) * M.contribution + (won ? M.win : 0) + p.saves * M.save + (p.ovr ?? 0) / M.ovrDiv;
      if (v > best) { best = v; motm = p.id; }
    }
  }
  const ticks = Math.max(1, match.tickCount);
  const possHome = Math.round((match.possSum / ticks) * 100);
  const S = match.stats;
  const tstat = (k) => ({ home: S.home[k], away: S.away[k] });
  const players = {};
  for (const side of [match.home, match.away]) {
    for (const p of side.all.values()) {
      players[p.id] = {
        team: side.key, fitness: Math.round(p.fitness), yellows: p.yellows, red: p.red, injured: p.injured, injuryMatches: p.injuryMatches,
        minutes: p.minOn == null ? 0 : ((p.minOff == null ? currentMinute(match) : p.minOff) - p.minOn),
        goals: p.goals, assists: p.assists, saves: p.saves, shots: p.shots,
      };
    }
  }
  return {
    score: { ...match.score },
    events: match.events,
    stats: {
      possession: { home: possHome, away: 100 - possHome },
      shots: tstat('shots'), shotsOnTarget: tstat('shotsOnTarget'),
      xg: { home: Math.round(S.home.xg * 100) / 100, away: Math.round(S.away.xg * 100) / 100 },
      corners: tstat('corners'), fouls: tstat('fouls'), offsides: tstat('offsides'),
      cards: { home: { yellow: S.home.yellows, red: S.home.reds }, away: { yellow: S.away.yellows, red: S.away.reds } },
    },
    ratings,
    manOfTheMatch: motm,
    injuries: match.injuries.slice(),
    cards: match.cards.slice(),
    subs: match.subs.slice(),
    added: { h1: match.added.h1 || 0, h2: match.added.h2 || 0 },
    players,
    finished: match.phase === 'finished',
  };
}

/**
 * Play a whole match headless.
 * @param {import('./cards.js').MatchTeam} home
 * @param {import('./cards.js').MatchTeam} away
 * @param {number|string} seed
 * @param {{lite?:boolean, autoSubs?:boolean, keyMoments?:boolean}} [opts]  autoSubs defaults to true here
 */
export function simulate(home, away, seed, opts = {}) {
  const match = createMatch(home, away, seed, { autoSubs: true, ...opts, keyMoments: false });
  let guard = 0;
  while (match.phase !== 'finished' && guard++ < 200) stepTick(match);
  return summarise(match);
}

/** Public view of the live state for the UI (no internals). */
export function matchState(match) {
  const side = (s) => ({
    name: s.name, formation: s.formation, settings: { ...s.settings }, mentality: s.mentality || s.settings.mentality,
    tacticCards: s.tacticCards.slice(), subsUsed: s.subsUsed, subsLeft: E.subs - s.subsUsed,
    shouts: Object.fromEntries(Object.keys(ENGINE_DETAIL.shouts.duration).map((k) => [k, Math.max(0, Math.max(s.shoutReady[k], s.shoutShared) - match.tickCount)])),
    shoutActive: s.shout ? s.shout.kind : null,
    lines: roundLines(s.lines),
    onPitch: s.slots.map((p) => p && { id: p.id, name: p.name, number: p.number, pos: p.pos, slot: p.slot, fitness: Math.round(p.fitness), yellows: p.yellows, red: p.red, injured: p.injured }),
    bench: s.bench.map((p) => ({ id: p.id, name: p.name, number: p.number, pos: p.pos, available: !p.onPitch && !p.subbedOff && p.minOn == null, fitness: Math.round(p.fitness) })),
    off: [...s.all.values()].filter((p) => !p.onPitch && p.minOn != null).map((p) => ({ id: p.id, name: p.name, red: p.red, injured: p.injured, subbedOff: p.subbedOff })),
  });
  return {
    phase: match.phase, half: match.half, minute: match.minute, addedMin: match.addedMin,
    score: { ...match.score }, momentum: match.momentum, prompt: match.prompt,
    home: side(match.home), away: side(match.away),
  };
}
