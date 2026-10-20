// Match view choreography: turns the engine's tick events into a continuous, believable 2D replay.
// Pure and seeded (rng.js). No DOM, no Date.now, no Math.random. Rendering never changes a result:
// this module only reads engine events and never calls the engine.
//
// Model
//   createChoreo(opts)      builds the discs (both XIs and benches), the ball and the three officials.
//   pushBatch(ch, events)   queues the events of one engine tick (one stepTick() call, or one tick of a log).
//   advance(ch, dt)         runs the fixed 20 ms simulation step (dt in animation seconds, already x speed)
//                           and returns cues for the UI (event, action, goal, card, fade, text...).
//   isIdle(ch)              true when every queued event has been played: the caller feeds the next tick.
//
// The engine has already decided each outcome (who shoots, who assists, the keeper, the xG band, fouls, cards,
// offsides). The choreography builds a plausible path to it in three layers (PROMPT "Player intelligence"):
//   Layer 1  team shape, every frame, all 22 players (shapeTeam)
//   Layer 2  roles by position and equipped style (applyRoles)
//   Layer 3  ball decisions inside each tick (choosePass, planners, legality checks)
// opts.layer (1 | 2 | 3) switches the upper layers off, so tools/viz-check.js can compare them.
//
// Coordinates: absolute pitch metres, x 0..105, y 0..68. A side's "attack frame" (ax, ay): ax 0 = own goal
// line, ax 105 = the goal it attacks. The away frame is the pitch rotated 180 degrees, as in the engine.

import { FORMATIONS } from './formations.js';
import { rngFrom, hashSeed, clamp } from './rng.js';
import { DEFAULT_SETTINGS, TACTIC_OPTIONS, ENGINE, VIEW, CARD_LIMITS } from '../balance.js';
import { actionLine } from './commentary.js';

// ------------------------------------------------------------------ constants

export const PITCH = {
  L: 105, W: 68, goalHalf: 3.66, boxDepth: 16.5, boxHalf: 20.16, sixDepth: 5.5, sixHalf: 9.16,
  spot: 11, circle: 9.15, netDepth: 2,
};

/** View tunables live in balance.js (VIEW); re-exported here for the screens and tools that import it from this module. */
export { VIEW };

const L = PITCH.L, W = PITCH.W, CY = W / 2;
const STEP = VIEW.stepDt;
const HALF_TICKS = ENGINE.ticks / 2;
const TAU = Math.PI * 2;
const OTHER = { home: 'away', away: 'home' };
const QUAL_BY_XG = (xg) => (xg >= 0.25 ? 'big' : xg >= 0.09 ? 'decent' : 'half');

const hyp = Math.hypot;
const lerp = (a, b, u) => a + (b - a) * u;

// ------------------------------------------------------------------ geometry helpers (exported for viz-check)

/** Distance from point (px,py) to segment a-b, plus the position s (metres from a) of the projection. */
export function segDist(ax, ay, bx, by, px, py) {
  const dx = bx - ax, dy = by - ay;
  const len = hyp(dx, dy) || 1e-6;
  let s = ((px - ax) * dx + (py - ay) * dy) / len;
  const sc = clamp(s, 0, len);
  const qx = ax + dx * sc / len, qy = ay + dy * sc / len;
  return { d: hyp(px - qx, py - qy), s, len };
}

/**
 * Pass lane rule. A ground pass is illegal when an opponent stands within 2 m of the lane, ignoring the first
 * 1 m at the passer's feet and the last 0.8 m at the reception point. Aerial balls (long ball, cross, goal kick)
 * only need the first 4 m clear (the take-off), since they travel over the players.
 * @returns {object|null} the blocking opponent or null when the lane is clear
 */
export function laneBlocker(from, to, opponents, aerial, margin = 2.0) {
  const len = hyp(to.x - from.x, to.y - from.y);
  const s0 = 1.0, s1 = aerial ? Math.min(len - 0.8, 4) : len - 0.8;
  if (s1 <= s0) return null;
  for (const o of opponents) {
    const r = segDist(from.x, from.y, to.x, to.y, o.x, o.y);
    if (r.s >= s0 && r.s <= s1 && r.d < margin) return o;
  }
  return null;
}

/**
 * Shot location consistent with its xG band (attack frame of the shooting side). Used by the planner and by
 * tools/viz-check.js. big: inside the box and central; decent: edge of the box or wide inside it; half: from
 * distance (16 m or more) or a tight angle; headers and corners: inside the box; free kick 16-36 m; penalty spot.
 */
export function shotLocationOk(q, setPiece, header, ax, ay) {
  const dy = Math.abs(ay - CY);
  const inBox = ax >= L - PITCH.boxDepth && dy <= PITCH.boxHalf;
  const dist = Math.hypot(L - ax, dy);
  if (setPiece === 'penalty' || q === 'penalty') return Math.abs(ax - (L - PITCH.spot)) < 0.8 && dy < 0.8;
  if (setPiece === 'freeKick' || q === 'freeKick') return dist >= 16 && dist <= 36;
  if (setPiece === 'corner' || q === 'corner' || header) return inBox;
  if (q === 'big') return inBox && dy <= PITCH.sixHalf;
  if (q === 'decent') return ax >= L - PITCH.boxDepth - 3.5 && dy <= PITCH.boxHalf && !(ax >= 97 && dy <= 4);
  return (dist >= 16 || (dy >= 11 && ax >= 94)) && !(ax >= 94 && dy < 6);
}

/** Offside position (attack frame values): in the opponent half, ahead of the ball and of the second-last opponent. */
export function offsideAt(rAx, ballAx, secondLastAx) {
  return rAx > L / 2 && rAx > ballAx + 0.3 && rAx > secondLastAx + 0.3;
}

// ------------------------------------------------------------------ frames

function dirOf(ch, side) { return (side === 'home') === (ch.half === 1) ? 1 : -1; }
/** absolute x <-> attack-frame x (the mapping is its own inverse) */
function fx(ch, side, x) { return dirOf(ch, side) > 0 ? x : L - x; }
function fy(ch, side, y) { return dirOf(ch, side) > 0 ? y : W - y; }
function toAbs(ch, side, ax, ay) { return { x: fx(ch, side, ax), y: fy(ch, side, ay) }; }

// ------------------------------------------------------------------ construction

function makeDisc(p, side, slot, rng) {
  const isGK = p.pos === 'GK';
  const s = p.stats || {};
  const pace = isGK ? (s.spd ?? s.pac ?? 55) : (s.pac ?? 60);
  return {
    id: p.id, name: p.name || '', number: p.number ?? 0, pos: p.pos, nativePos: p.nativePos || p.pos,
    side, slot, lastSlot: slot, styleId: p.styleId || null, traits: p.traits || [],
    pas: s.pas ?? s.kic ?? 55, dri: s.dri ?? 50, phy: s.phy ?? 60, pac: pace,
    vmax: 4 + pace / 20,
    x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, tx: 0, ty: 0, urg: VIEW.jog, fxd: 1, fyd: 0,
    alpha: 1, yellow: 0, red: false, injured: false, onPitch: slot != null, leaving: 0, entering: 0,
    w1: rng.next() * TAU, w2: rng.next() * TAU, w3: rng.next() * TAU, w4: rng.next() * TAU,
    f1: 0.5 + rng.next() * 0.3, f2: 0.9 + rng.next() * 0.5,
    touches: 0,
  };
}

function normSettings(s) {
  const out = { ...DEFAULT_SETTINGS };
  if (s) for (const k in TACTIC_OPTIONS) if (TACTIC_OPTIONS[k].includes(s[k])) out[k] = s[k];
  return out;
}

function makeTeamState(team, key, rng) {
  const formation = FORMATIONS[team.formation] ? team.formation : '4-3-3';
  const T = {
    key, name: team.name || key, colours: team.colours || ['#cccccc', '#222222'], crest: team.crest || null,
    formation, settings: normSettings(team.settings), cards: (team.tacticCards || []).filter(Boolean),
    slots: new Array(11).fill(null), all: new Map(), anchors: null,
  };
  (team.xi || []).slice(0, 11).forEach((p, i) => {
    const d = makeDisc(p, key, i, rng);
    T.slots[i] = d; T.all.set(d.id, d);
  });
  for (const p of (team.bench || []).slice(0, CARD_LIMITS.benchSize)) {
    const d = makeDisc(p, key, null, rng);
    d.onPitch = false;
    T.all.set(d.id, d);
  }
  buildAnchors(T);
  return T;
}

/**
 * Formation anchors in the attack frame with the settings applied (PROMPT "Tactics panel": defensive line
 * shifts the back four by +/- 8 m, width scales the y spread by 0.85 / 1 / 1.15, mentality moves the block).
 */
function buildAnchors(T) {
  const f = FORMATIONS[T.formation];
  const s = T.settings;
  const dl = VIEW.defLineShift[s.defLine] || 0;
  const ws = VIEW.widthScale[s.width] || 1;
  const ms = VIEW.mentalityShift[s.mentality] || 0;
  T.anchors = f.slots.map((sl) => {
    const line = sl.pos === 'GK' ? 'gk' : sl.depth < 35 ? 'def' : sl.depth < 72 ? 'mid' : 'att';
    let ax = sl.depth * 1.05 + (line === 'gk' ? 0 : ms);
    if (line === 'def') ax += dl;
    const ay = CY + (sl.lat * 0.68 - CY) * ws;
    return { ax, ay, line, pos: sl.pos, latSide: Math.sign(sl.lat - 50) };
  });
  let lo = Infinity, hi = -Infinity;
  for (const a of T.anchors) if (a.line !== 'gk') { lo = Math.min(lo, a.ax); hi = Math.max(hi, a.ax); }
  T.lo = lo; T.hi = hi; T.span = Math.max(20, hi - lo); T.c0 = (lo + hi) / 2;
}

/**
 * Anchors of a formation in the attack frame, for the tactics panel preview. Layer 1 shape only.
 * @param {string} formation
 * @param {object} settings
 * @param {{inPossession?:boolean, ball?:{x:number,y:number}}} [o]  ball in the same attack frame
 * @returns {Array<{pos:string, x:number, y:number}>}
 */
export function shapePreview(formation, settings, o = {}) {
  const T = { formation, settings: normSettings(settings) };
  buildAnchors(T);
  const ball = o.ball || { x: o.inPossession ? 55 : 50, y: CY };
  const players = T.anchors.map((a, i) => ({ slot: i, pos: a.pos }));
  const out = baseShape(T, players, !!o.inPossession, ball.x, ball.y, null);
  return players.map((p, i) => ({ pos: p.pos, x: out[i].ax, y: out[i].ay }));
}

/**
 * @param {object} opts
 * @param {import('./cards.js').MatchTeam} opts.home
 * @param {import('./cards.js').MatchTeam} opts.away
 * @param {number|string} [opts.seed]
 * @param {1|2|3} [opts.layer]
 * @param {boolean} [opts.highlights]
 */
export function createChoreo(opts) {
  const seed = typeof opts.seed === 'number' ? opts.seed >>> 0 : hashSeed(opts.seed ?? 1);
  const rng = rngFrom((seed ^ hashSeed('choreography')) >>> 0);
  const ch = {
    rng, layer: opts.layer ?? 3, highlights: !!opts.highlights, compact: opts.compact ?? true,
    t: 0, acc: 0, half: 1,
    teams: null, discs: [],
    ball: { x: L / 2, y: CY, px: L / 2, py: CY, h: 0, owner: null, fl: null, rest: true, lastTouch: null },
    poss: null, mode: 'dead', modeUntil: 0, setPiece: null,
    ovr: new Map(), runners: new Map(), transition: null, chance: null, keeperHold: null, refTarget: null,
    layout: null, kickTaker: null, kickMate: null, needCut: false, fkSpot: null, cornerAy: null, lastRecv: null,
    recordSnaps: !!opts.recordSnaps,
    tasks: [], task: null, evq: [], batchInfo: null,
    fade: { a: 1, phase: null, t: 0, apply: null },
    officials: [
      { kind: 'ref', x: L / 2 - 8, y: CY + 10, px: 0, py: 0, vx: 0, vy: 0 },
      { kind: 'ar1', x: L * 0.75, y: -0.8, px: 0, py: 0, vx: 0, vy: 0 },
      { kind: 'ar2', x: L * 0.25, y: W + 0.8, px: 0, py: 0, vx: 0, vy: 0 },
    ],
    score: { home: 0, away: 0 }, goals: [], cards: [],
    clock: { half: 1, c: 0, target: 0, rate: 1, added: 0 },
    text: '', cues: [], actions: [], segAct: null,
    flag: null, finished: false, possTime: { home: 0, away: 0 }, momentum: 0,
    trails: [], net: null, shake: 0, lastPasser: null, lastPassT: -9, recvAt: null,
    stats: { blockedWaits: 0 },
  };
  ch.teams = { home: makeTeamState(opts.home, 'home', rng), away: makeTeamState(opts.away, 'away', rng) };
  rebuildDiscs(ch);
  kickoffLayout(ch, 'home', true);
  return ch;
}

function rebuildDiscs(ch) {
  ch.discs = [];
  for (const k of ['home', 'away']) for (const d of ch.teams[k].slots) if (d) ch.discs.push(d);
  for (const k of ['home', 'away']) for (const d of ch.teams[k].all.values()) if (d.leaving > 0 && !ch.discs.includes(d)) ch.discs.push(d);
}

const onPitch = (T) => T.slots.filter((d) => d && !d.leaving);
const keeperOf = (T) => T.slots[0];
const sideOf = (ch, k) => ch.teams[k];
function findDisc(ch, id) {
  if (id == null) return null;
  return ch.teams.home.all.get(id) || ch.teams.away.all.get(id) || null;
}

// ------------------------------------------------------------------ Layer 1: team shape

/**
 * Base shape in the attack frame for a list of players {slot, pos}. Returns [{ax, ay, line}] in the same order.
 * opp: optional { offLim } used to keep attackers onside in possession.
 */
function baseShape(T, players, inPoss, bx, by, ctx) {
  const k = (inPoss ? VIEW.depthIn : VIEW.depthOut) / T.span;
  const center = inPoss ? T.c0 - 2 + VIEW.shiftPoss * (bx - L / 2) : T.c0 - 6 + VIEW.shiftDef * (bx - L / 2);
  const out = [];
  const lineSum = { def: 0, mid: 0, att: 0 }, lineN = { def: 0, mid: 0, att: 0 };
  for (const p of players) {
    const a = T.anchors[p.slot];
    if (a.line === 'gk') { out.push({ ax: 0, ay: CY, line: 'gk' }); continue; }
    let ax = center + (a.ax - T.c0) * k;
    let ay;
    if (inPoss) ay = CY + (a.ay - CY) * 1.12 + VIEW.shiftY * (by - CY);
    else {
      ay = CY + (a.ay - CY) * 0.8 + (VIEW.shiftY + VIEW.ballSideOut) * (by - CY);
      // far-side wide player tucks in
      if ((a.pos === 'W' || (a.pos === 'FB' && a.line === 'mid')) && (a.ay - CY) * (by - CY) < 0 && Math.abs(by - CY) > 6) ay = CY + (ay - CY) * 0.62;
    }
    out.push({ ax, ay, line: a.line });
    lineSum[a.line] += ax; lineN[a.line]++;
  }
  // back line moves as a unit: one common x (full-backs 1.5 m higher in possession)
  if (lineN.def) {
    const lx = lineSum.def / lineN.def;
    out.forEach((o, i) => { if (o.line === 'def') o.ax = lx + (inPoss && players[i].pos === 'FB' ? 1.5 : 0); });
  }
  const mean = (ln) => {
    let s = 0, n = 0;
    out.forEach((o) => { if (o.line === ln) { s += o.ax; n++; } });
    return n ? s / n : null;
  };
  // lines at least 8 m apart
  const md = mean('def'), mm = mean('mid');
  if (md != null && mm != null && mm - md < VIEW.lineGap) { const d = VIEW.lineGap - (mm - md); out.forEach((o) => { if (o.line === 'mid' || o.line === 'att') o.ax += d; }); }
  const mm2 = mean('mid'), ma = mean('att');
  if (mm2 != null && ma != null && ma - mm2 < VIEW.lineGap) { const d = VIEW.lineGap - (ma - mm2); out.forEach((o) => { if (o.line === 'att') o.ax += d; }); }
  if (!inPoss) {
    // the defensive line never passes the ball's x, drops when the ball goes over it, stops at the six-yard line
    const lx = mean('def');
    if (lx != null) {
      let shift = 0;
      if (lx > bx - 1.5) shift = bx - 1.5 - lx;
      if (lx + shift < PITCH.sixDepth + 1) shift = PITCH.sixDepth + 1 - lx;
      if (shift) out.forEach((o) => { if (o.line !== 'gk') o.ax += shift; });
    }
  } else if (ctx && ctx.offLim != null) {
    for (const o of out) if (o.line !== 'gk' && o.ax > ctx.offLim - 0.8) o.ax = ctx.offLim - 0.8;
  }
  for (const o of out) { o.ax = clamp(o.ax, 2, L - 1.5); o.ay = clamp(o.ay, 2, W - 2); }
  return out;
}

/** Keeper target in the attack frame: on the line ball - goal centre, 2-12 m off his line, inside the box. */
function keeperSpot(bx, by, inPoss) {
  const d = hyp(bx, by - CY) || 1;
  let off = 2 + 10 * clamp((d - 12) / 48, 0, 1);
  if (inPoss) off = Math.min(14, off + 2);
  return { ax: clamp(off * bx / d, 1, 14.5), ay: clamp(CY + off * (by - CY) / d, CY - 8, CY + 8) };
}

// ------------------------------------------------------------------ per-frame context

/** Positions of a team's players in a given side's attack frame. */
function frameList(ch, T, side) {
  const res = [];
  for (const d of T.slots) if (d && !d.leaving) res.push({ d, ax: fx(ch, side, d.x), ay: fy(ch, side, d.y) });
  return res;
}

/** Offside limit of `side` (attack frame): max(halfway, ball, second-last opponent). */
function offsideLimit(ch, side) {
  const opp = ch.teams[OTHER[side]];
  const xs = [];
  for (const d of opp.slots) if (d && !d.leaving) xs.push(fx(ch, side, d.x));
  xs.sort((a, b) => b - a);
  const second = xs.length > 1 ? xs[1] : xs[0] ?? L;
  return { second, lim: Math.max(L / 2, fx(ch, side, ballFocus(ch).x), second) };
}

/** Where players read the ball: its landing point while in flight. */
function ballFocus(ch) {
  const b = ch.ball;
  if (b.fl) return { x: b.fl.x1, y: b.fl.y1 };
  return { x: b.x, y: b.y };
}

// ------------------------------------------------------------------ targets

function computeTargets(ch) {
  const focus = ballFocus(ch);
  const carrier = ch.ball.owner;
  for (const side of ['home', 'away']) {
    const T = ch.teams[side];
    const ps = onPitch(T);
    const inPoss = ch.poss === side;
    const bx = fx(ch, side, focus.x), by = fy(ch, side, focus.y);
    const off = offsideLimit(ch, side);
    const shape = baseShape(T, ps, inPoss, bx, by, { offLim: off.lim });
    const ctx = { ch, T, side, inPoss, bx, by, off, shape, ps, carrier };
    if (ch.layer >= 2 && ch.mode === 'open') applyRoles(ctx);
    const tr = ch.transition && ch.t < ch.transition.until ? ch.transition : null;
    const t = ch.t;
    const midNow = ch.layer >= 2 ? midLineAx(ch, side) : null;
    ps.forEach((d, i) => {
      const s = shape[i];
      let ax, ay, urg = VIEW.jog;
      // slow seeded wander, up to ~2 m (back line mostly sideways so it keeps its line, keeper a little)
      const amx = s.line === 'gk' ? 0.7 : s.line === 'def' ? VIEW.wanderAmpLine : VIEW.wanderAmp;
      const amy = s.line === 'gk' ? 1.6 : VIEW.wanderAmp;
      const wx = amx * (0.6 * Math.sin(t * d.f1 + d.w1) + 0.4 * Math.sin(t * d.f2 + d.w2));
      const wy = amy * (0.6 * Math.sin(t * d.f1 * 0.9 + d.w3) + 0.4 * Math.sin(t * d.f2 * 1.1 + d.w4));
      if (s.line === 'gk') {
        const k = keeperSpot(bx, by, inPoss);
        ax = clamp(k.ax + wx, 0.8, 15); ay = k.ay + wy; urg = 0.75;
      } else {
        ax = s.ax; ay = s.ay;
        if (s.urg) urg = s.urg;
        if (tr && (ch.mode === 'open' || ch.mode === 'dead')) {
          if (side !== tr.side) urg = 1; // the team that lost the ball retreats at full speed
          else if (s.line === 'att' || d.pos === 'W' || d.pos === 'ST' || d.pos === 'AM') { ax = Math.min(ax + 10, off.lim - 0.8); urg = 1; }
        }
        ax = clamp(ax + wx, 1.5, L - 1.5); ay = clamp(ay + wy, 1.2, W - 1.2);
        // a back-line player caught ahead of his midfield sprints back
        if (midNow != null && s.line === 'def' && fx(ch, side, d.x) > midNow - 1 && ax < fx(ch, side, d.x)) urg = 1;
      }
      const p = toAbs(ch, side, ax, ay);
      d.tx = p.x; d.ty = p.y; d.urg = urg;
    });
  }
  if (ch.mode === 'open' && carrier) applyPressing(ch, carrier);
  applyOverrides(ch);
  applySpacing(ch);
  if (ch.layer >= 2 && (ch.mode === 'open' || ch.mode === 'dead')) for (const side of ['home', 'away']) backLineBehindMidfield(ch, side);
  if (ch.mode === 'setpiece' && ch.layout) applyLayout(ch);
}

/** Final pass on targets: no back-line player is asked to stand ahead of his own midfield line. */
function backLineBehindMidfield(ch, side) {
  const T = ch.teams[side];
  const ps = onPitch(T);
  let s = 0, n = 0;
  for (const d of ps) if (d.pos === 'DM' || d.pos === 'CM' || d.pos === 'AM') { s += fx(ch, side, d.tx); n++; }
  if (!n) return;
  const cap = s / n - 2.5;
  let need = 0;
  for (const d of ps) {
    const back = d.pos === 'CB' || (d.pos === 'FB' && T.anchors[d.slot].line === 'def' && ch.poss !== side);
    if (!back || ch.ball.owner === d || (ch.ovr.has(d.id) && !ch.ovr.get(d.id).soft)) continue;
    const ax = fx(ch, side, d.tx);
    if (ax <= cap) continue;
    const nx = Math.max(cap, PITCH.sixDepth + 0.5);
    d.tx = fx(ch, side, nx);
    if (nx > cap) need = Math.max(need, nx - cap);
  }
  if (need > 0) for (const d of ps) if ((d.pos === 'DM' || d.pos === 'CM' || d.pos === 'AM') && !ch.ovr.has(d.id)) d.tx = fx(ch, side, fx(ch, side, d.tx) + need);
}

function applyPressing(ch, carrier) {
  if (ch.task && ch.task.name === 'foul') return; // the fouler is the one closing him down
  const dside = OTHER[carrier.side];
  const T = ch.teams[dside];
  const n = ch.layer >= 3 ? (VIEW.pressers[T.settings.pressing] || 1) : 1;
  const cand = onPitch(T).filter((d) => d.pos !== 'GK' && !ch.ovr.has(d.id) && (ch.layer < 2 || canStepOut(ch, d, carrier.x)));
  cand.sort((a, b) => hyp(a.x - carrier.x, a.y - carrier.y) - hyp(b.x - carrier.x, b.y - carrier.y));
  const beaten = !!(ch.chance && carrier.side === ch.chance.side);
  const dir = dirOf(ch, dside); // defenders' own goal is toward -dir in absolute x
  for (let i = 0; i < Math.min(n, cand.length); i++) {
    const d = cand[i];
    if (hyp(d.x - carrier.x, d.y - carrier.y) > 25) break;
    // goal-side by 1.9 m; when the attack is a chance the closer is a step late (behind the carrier)
    const lat = i === 0 ? 0 : (d.y > carrier.y ? 1.6 : -1.6);
    d.tx = carrier.x + (beaten ? dir * 2.6 : -dir * 1.9);
    d.ty = carrier.y + lat;
    d.urg = 0.95;
    d.pressing = ch.t;
  }
}

function applyOverrides(ch) {
  // runners: hold the shoulder of the last defender (onside), then go when the pass is played
  for (const [id, r] of ch.runners) {
    const d = findDisc(ch, id);
    if (!d || !d.onPitch || ch.ball.owner === d || ch.ovr.has(id)) continue;
    const lim = ch.layer >= 3 ? onsideLimit(ch, d.side) - 1.2 : Infinity;
    const ax = Math.min(fx(ch, d.side, r.x), lim);
    d.tx = fx(ch, d.side, ax); d.ty = r.y; d.urg = 0.9;
  }
  for (const [id, o] of ch.ovr) {
    const d = findDisc(ch, id);
    if (!d || !d.onPitch) continue;
    if (o.until != null && ch.t > o.until) { ch.ovr.delete(id); continue; }
    d.tx = o.x; d.ty = o.y; d.urg = o.urg ?? 1;
    if (o.arrive != null) {
      // a pass receiver times his run to arrive with the ball, instead of sprinting and waiting
      const rem = o.arrive - ch.t;
      const dist = hyp(o.x - d.x, o.y - d.y);
      d.urg = rem > 0.05 ? clamp(dist / (rem * d.vmax * 0.85), 0.3, 1) : 1;
    }
  }
}

/**
 * Team-mates keep apart: targets closer than 4.5 m are pushed apart (pinned players do not move). Players who
 * are already within 3.4 m of each other get a wider gap and a quicker step so they separate within a second.
 */
function applySpacing(ch) {
  if (ch.mode === 'setpiece' || ch.mode === 'celebrate') return;
  const carrier = ch.ball.owner;
  const recv = ch.ball.fl && ch.ball.fl.recv;
  const pinned = (d) => d === carrier || d === recv || d.pos === 'GK' || (ch.ovr.has(d.id) && !ch.ovr.get(d.id).soft);
  const bf = ballFocus(ch);
  for (const side of ['home', 'away']) {
    const ps = onPitch(ch.teams[side]);
    for (let it = 0; it < 3; it++) {
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const a = ps[i], b = ps[j];
          let dx = b.tx - a.tx, dy = b.ty - a.ty;
          let dd = hyp(dx, dy);
          const cur = hyp(b.x - a.x, b.y - a.y);
          const close = cur < 3.6;
          // around the ball the gaps are wider, so the play does not bunch up
          const nearBall = hyp(a.tx - bf.x, a.ty - bf.y) < 12 || hyp(b.tx - bf.x, b.ty - bf.y) < 12;
          const need = close ? 6 : nearBall ? 6.5 : 4.6;
          if (dd >= need) continue;
          if (dd < 1e-3) { dx = b.x - a.x || 0.1; dy = b.y - a.y || 0.1; dd = hyp(dx, dy); }
          const push = (need - dd) / 2;
          const ux = dx / dd, uy = dy / dd;
          const pinA = pinned(a), pinB = pinned(b);
          if (pinA && pinB) continue;
          if (pinA) { b.tx += ux * push * 2; b.ty += uy * push * 2; if (close) b.urg = Math.max(b.urg, 0.9); }
          else if (pinB) { a.tx -= ux * push * 2; a.ty -= uy * push * 2; if (close) a.urg = Math.max(a.urg, 0.9); }
          else {
            a.tx -= ux * push; a.ty -= uy * push; b.tx += ux * push; b.ty += uy * push;
            if (close) { a.urg = Math.max(a.urg, 0.9); b.urg = Math.max(b.urg, 0.9); }
          }
        }
      }
    }
    for (const d of ps) { d.tx = clamp(d.tx, 0.8, L - 0.8); d.ty = clamp(d.ty, 0.8, W - 0.8); }
  }
}

function applyLayout(ch) {
  for (const d of ch.discs) {
    const p = ch.layout.get(d.id);
    if (!p || ch.ovr.has(d.id)) continue;
    d.tx = p.x; d.ty = p.y; d.urg = 0.5;
  }
}

// ------------------------------------------------------------------ Layer 2: roles

function oppList(ctx) {
  if (!ctx.opp) ctx.opp = frameList(ctx.ch, ctx.ch.teams[OTHER[ctx.side]], ctx.side);
  return ctx.opp;
}
function nearestOpp(ctx, ax, ay, filter) {
  let best = null, bd = Infinity;
  for (const o of oppList(ctx)) {
    if (filter && !filter(o)) continue;
    const dd = hyp(o.ax - ax, o.ay - ay);
    if (dd < bd) { bd = dd; best = o; }
  }
  return best ? { o: best, d: bd } : null;
}
function lineMean(list, test) {
  let s = 0, n = 0;
  for (const o of list) if (test(o)) { s += o.ax; n++; }
  return n ? s / n : null;
}

/**
 * Two team-mates near the carrier move into passing angles: 10-16 m away, in free space, with no opponent in
 * the lane, at different angles. Keeps the carrier from being isolated and gives Layer 3 legal options.
 */
function offerSupport(ctx, opp) {
  const { ch, ps, shape, carrier, off } = ctx;
  const cax = fx(ch, ctx.side, carrier.x), cay = fy(ch, ctx.side, carrier.y);
  const cand = [];
  ps.forEach((d, i) => {
    if (d === carrier || d.pos === 'GK' || ch.ovr.has(d.id) || ch.runners.has(d.id)) return;
    if (d.pos === 'CB' && cax > 45) return;
    const dd = hyp(fx(ch, ctx.side, d.x) - cax, fy(ch, ctx.side, d.y) - cay);
    if (dd < 28) cand.push({ i, d, dd });
  });
  cand.sort((a, b) => a.dd - b.dd);
  const taken = [];
  for (const c of cand.slice(0, 2)) {
    let best = null, bv = -Infinity;
    for (let k = -8; k <= 8; k++) {
      const ang = k * 0.27;
      for (const r of [11, 15]) {
        const px = cax + Math.cos(ang) * r, py = cay + Math.sin(ang) * r;
        if (px < 3 || px > off.lim - 1 || py < 3 || py > W - 3) continue;
        let free = 9, lane = 9;
        for (const o of opp) {
          free = Math.min(free, hyp(o.ax - px, o.ay - py));
          const sd = segDist(cax, cay, px, py, o.ax, o.ay);
          if (sd.s > 1 && sd.s < r - 0.8) lane = Math.min(lane, sd.d);
        }
        if (lane < 2.6) continue;
        let v = Math.min(free, 8) + Math.min(lane, 5) * 0.5 - Math.abs(ang) * 0.9 + (px > cax ? 1 : 0);
        v -= hyp(px - shape[c.i].ax, py - shape[c.i].ay) * 0.12;
        for (const t of taken) if (hyp(px - t.x, py - t.y) < 8) v -= 6;
        if (v > bv) { bv = v; best = { x: px, y: py }; }
      }
    }
    if (best) { shape[c.i].ax = best.x; shape[c.i].ay = best.y; shape[c.i].urg = 0.8; taken.push(best); }
  }
}

/** Layer 2: per-position behaviour (PROMPT table), adjusts the shape targets in place (attack frame). */
function applyRoles(ctx) {
  const { ch, T, inPoss, bx, by, off, shape, ps, carrier } = ctx;
  const opp = oppList(ctx);
  const oppDefLine = lineMean(opp, (o) => o.d.pos === 'CB' || o.d.pos === 'FB');
  const oppMidLine = lineMean(opp, (o) => o.d.pos === 'DM' || o.d.pos === 'CM' || o.d.pos === 'AM');
  let defLine = null, midLine = null;
  {
    let s = 0, n = 0, s2 = 0, n2 = 0;
    ps.forEach((d, i) => {
      if (d.pos === 'CB') { s += shape[i].ax; n++; }
      if (d.pos === 'DM' || d.pos === 'CM' || d.pos === 'AM') { s2 += shape[i].ax; n2++; }
    });
    defLine = n ? s / n : null; midLine = n2 ? s2 / n2 : null;
  }
  const carrierMine = carrier && carrier.side === ctx.side;
  const carrierMidFwd = carrierMine && (carrier.pos === 'CM' || carrier.pos === 'DM' || carrier.pos === 'AM');
  const ballSide = Math.sign(by - CY);
  const finalThird = bx > 70;
  const onside = off.lim - 0.8;
  const hasDM = ps.some((d) => d.pos === 'DM');
  // which full-back overlaps: the ball-side one, only one at a time
  let overlapFB = null;
  if (inPoss && hasDM && Math.abs(by - CY) > 8 && bx > 45) {
    ps.forEach((d, i) => { if (d.pos === 'FB' && T.anchors[d.slot].line === 'def' && Math.sign(T.anchors[d.slot].ay - CY) === ballSide) overlapFB = i; });
  }
  // which CM joins the attack late: box-to-box first, else the more advanced anchor
  let lateCM = -1;
  if (inPoss && finalThird) {
    let best = -Infinity;
    ps.forEach((d, i) => { if (d.pos === 'CM') { const v = (d.styleId === 'boxToBox' ? 100 : 0) + T.anchors[d.slot].ax + (d.slot % 2); if (v > best) { best = v; lateCM = i; } } });
  }
  let cmSeen = 0;
  // CB marking: nearer CB challenges the striker, the other covers
  let cbs = [];
  ps.forEach((d, i) => { if (d.pos === 'CB') cbs.push(i); });
  const oppST = opp.filter((o) => o.d.pos === 'ST');

  ps.forEach((d, i) => {
    const s = shape[i];
    if (s.line === 'gk' || d.injured) return;
    const a = T.anchors[d.slot];
    const sideSign = a.latSide || Math.sign(a.ay - CY) || 1;
    if (inPoss) {
      switch (d.pos) {
        case 'ST': {
          const tm = d.styleId === 'targetMan';
          s.ax = tm ? Math.min(onside - 6, Math.max(s.ax, bx + 6)) : onside;
          if (s.ax < bx - 4 && !tm) s.ax = Math.min(onside, bx + 4);
          break;
        }
        case 'W': {
          if (finalThird) {
            if (d.styleId === 'invertedWinger') { s.ay = CY + sideSign * 12; s.ax = Math.min(onside, bx + 6); }
            else if (overlapFB != null && Math.sign(a.ay - CY) === ballSide) { s.ay = CY + sideSign * 14; s.ax = Math.min(onside, bx + 6); }
            else { s.ay = CY + sideSign * 29.5; s.ax = Math.min(onside, Math.max(s.ax, bx + 4)); }
          } else {
            s.ay = d.styleId === 'invertedWinger' ? CY + sideSign * 20 : CY + sideSign * 29.5;
          }
          break;
        }
        case 'AM': {
          if (oppDefLine != null && oppMidLine != null) s.ax = clamp((oppDefLine + oppMidLine) / 2, bx - 4, onside - 1);
          // pick the lane with the most space
          let best = s.ay, bv = -1;
          for (const cy of [CY - 10, CY, CY + 10]) {
            const n = nearestOpp(ctx, s.ax, cy);
            const v = n ? n.d : 99;
            if (v > bv) { bv = v; best = cy; }
          }
          s.ay = lerp(s.ay, best, 0.6);
          break;
        }
        case 'CM': {
          cmSeen++;
          if (i === lateCM) {
            s.ax = Math.min(onside - 0.5, d.styleId === 'boxToBox' ? 90 : Math.max(s.ax, bx + 2));
            s.ay = CY + sideSign * 7;
          } else if (carrierMine && carrier !== d) {
            // short option at its own angle from the carrier
            const cax = fx(ch, ctx.side, carrier.x), cay = fy(ch, ctx.side, carrier.y);
            const angle = (cmSeen % 2 ? 1 : -1) * (finalThird ? 1.9 : 1.2);
            s.ax = clamp(cax + Math.cos(angle) * 12, 4, onside - 1);
            s.ay = clamp(cay + Math.sin(angle) * 12, 4, W - 4);
            if (finalThird && i !== lateCM) s.ax = Math.min(s.ax, bx - 6);
          }
          break;
        }
        case 'DM': {
          s.ax = Math.max((defLine ?? s.ax) + 6, Math.min(s.ax, bx - 10));
          s.ay = CY + (by - CY) * 0.4;
          break;
        }
        case 'FB': {
          if (a.line === 'def') {
            if (i === overlapFB) { s.ax = Math.min(onside, Math.max(bx + 4, s.ax + 18)); s.ay = CY + sideSign * 30.5; }
            else s.ay = CY + sideSign * (bx < 40 ? 27 : 24);
          } else s.ay = CY + sideSign * 29; // wing-backs hug the line
          break;
        }
        case 'CB': {
          if (bx < 40) s.ay = CY + (s.ay - CY) * 1.9; // split wide for the build-up
          break;
        }
        default: break;
      }
    } else {
      switch (d.pos) {
        case 'ST': {
          // block the pass between the opponent centre-backs (stays with the block), never chase past halfway
          const ocb = opp.filter((o) => o.d.pos === 'CB');
          if (ocb.length) {
            let sx = 0, sy = 0; for (const o of ocb) { sx += o.ax; sy += o.ay; }
            s.ax = Math.min(sx / ocb.length - 7, s.ax + 3); s.ay = lerp(s.ay, sy / ocb.length, 0.6);
          }
          s.ax = Math.max(s.ax, L / 2 - 5);
          break;
        }
        case 'W': {
          // track the opposing full-back back to his own third (does not climb past the block to find him)
          const fb = nearestOpp(ctx, a.ax, a.ay, (o) => o.d.pos === 'FB');
          if (fb && Math.sign(fb.o.ay - CY) === Math.sign(a.ay - CY)) { s.ax = clamp(fb.o.ax - 2, 35, Math.max(35, s.ax + 2)); s.ay = lerp(s.ay, fb.o.ay, 0.7); }
          break;
        }
        case 'AM': {
          // screen the opponent's deepest midfielder
          let deep = null;
          for (const o of opp) if ((o.d.pos === 'DM' || o.d.pos === 'CM') && (!deep || o.ax > deep.ax)) deep = o;
          if (deep) { s.ax = Math.min(deep.ax + 3, s.ax + 3); s.ay = lerp(s.ay, deep.ay, 0.6); }
          break;
        }
        case 'CM': {
          // close the nearest free opponent midfielder, staying goal-side
          ctx.taken = ctx.taken || new Set();
          const n = nearestOpp(ctx, s.ax, s.ay, (o) => (o.d.pos === 'CM' || o.d.pos === 'AM' || o.d.pos === 'DM') && !ctx.taken.has(o.d.id));
          if (n && n.d < 12) { ctx.taken.add(n.o.d.id); s.ax = Math.min(s.ax, n.o.ax - 2); s.ay = lerp(s.ay, n.o.ay, 0.5); }
          if (midLine != null) s.ax = Math.min(s.ax, bx);
          break;
        }
        case 'DM': {
          if (defLine != null) s.ax = defLine + 7;
          s.ax = Math.min(s.ax, bx - 1);
          s.ay = CY + (by - CY) * 0.5;
          break;
        }
        case 'FB': {
          if (a.line === 'def') {
            if (Math.abs(by - CY) > 8 && Math.sign(by - CY) !== Math.sign(a.ay - CY)) s.ay = CY + sideSign * 13; // tuck in
            else {
              const w = nearestOpp(ctx, s.ax, a.ay, (o) => o.d.pos === 'W' || (o.d.pos === 'FB' && o.ax < L / 2));
              if (w && w.d < 18) s.ay = lerp(s.ay, w.o.ay, 0.7);
            }
          }
          break;
        }
        default: break;
      }
    }
  });
  // support play: the two nearest team-mates offer short options in free space with a clear lane
  if (inPoss && carrierMine && ctx.ch.layer >= 2) offerSupport(ctx, opp);
  // centre-backs out of possession: nearer one marks the striker goal-side, the other covers 3-5 m behind
  if (!inPoss && cbs.length >= 2 && oppST.length) {
    let bestI = -1, bestST = null, bd = Infinity;
    for (const ci of cbs) for (const o of oppST) {
      const dd = hyp(shape[ci].ax - o.ax, shape[ci].ay - o.ay) + Math.abs(o.ay - by) * 0.3;
      if (dd < bd) { bd = dd; bestI = ci; bestST = o; }
    }
    if (bestST && bestST.ax < shape[bestI].ax + 12) {
      const ch0 = shape[bestI];
      ch0.ax = Math.min(ch0.ax + 1, Math.max(bestST.ax - 2, ch0.ax - 2)); ch0.ay = lerp(ch0.ay, bestST.ay, 0.75);
      for (const ci of cbs) if (ci !== bestI) shape[ci].ax = Math.min(shape[ci].ax, ch0.ax - 3);
    }
  }
  // constraints that roles must not break: the back line stays behind the (post-role) midfield line,
  // and when it cannot drop any further (six-yard line) the midfield steps up instead
  let ms = 0, mn = 0;
  ps.forEach((d, i) => { if (d.pos === 'DM' || d.pos === 'CM' || d.pos === 'AM') { ms += shape[i].ax; mn++; } });
  const mid2 = mn ? ms / mn : null;
  const isBack = (d) => d.pos === 'CB' || (d.pos === 'FB' && T.anchors[d.slot].line === 'def');
  if (mid2 != null) {
    let need = 0;
    ps.forEach((d, i) => {
      if (!isBack(d)) return;
      const cap = mid2 - 3;
      if (shape[i].ax > cap) {
        shape[i].ax = Math.max(cap, PITCH.sixDepth + 0.5);
        if (shape[i].ax > cap) need = Math.max(need, shape[i].ax - cap);
      }
    });
    if (need > 0) ps.forEach((d, i) => { if (d.pos === 'DM' || d.pos === 'CM' || d.pos === 'AM') shape[i].ax += need; });
  }
  ps.forEach((d, i) => {
    const s = shape[i];
    if (s.line === 'gk') return;
    if (inPoss && s.ax > onside) s.ax = onside;
    s.ax = clamp(s.ax, 2, L - 1.5); s.ay = clamp(s.ay, 1.8, W - 1.8);
  });
}

// ------------------------------------------------------------------ movement

/** Separation steering: team-mates closer than 3.6 m push each other's velocity apart (paths diverge). */
function separation(ch) {
  const on = ch.mode === 'open' || ch.mode === 'dead';
  for (const d of ch.discs) { d.sx = 0; d.sy = 0; }
  if (!on || ch.layer < 1) return;
  // right after a corner, free kick or throw-in the box group breaks up: wider, stronger separation for 2.5 s
  const boost = ch.t - (ch.spEnd ?? -99) < 2.5;
  const R = boost ? 5 : 4, K = boost ? 3.6 : 2.6;
  for (const side of ['home', 'away']) {
    const ps = onPitch(ch.teams[side]);
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dd = hyp(dx, dy);
        if (dd >= R || dd < 1e-4) continue;
        const k = (R - dd) / dd * K;
        a.sx -= dx * k; a.sy -= dy * k; b.sx += dx * k; b.sy += dy * k;
      }
    }
  }
}

function moveDiscs(ch) {
  const dt = STEP;
  separation(ch);
  for (const d of ch.discs) {
    d.px = d.x; d.py = d.y;
    if (d.leaving) {
      d.leaving = Math.max(0, d.leaving - dt);
      d.alpha = d.leaving / 0.6;
      if (!d.leaving) { d.alpha = 0; d.onPitch = false; }
      d.vx = d.vy = 0;
      continue;
    }
    if (d.entering) { d.entering = Math.max(0, d.entering - dt); d.alpha = 1 - d.entering / 0.4; }
    if (d.down) { d.vx *= 0.8; d.vy *= 0.8; d.x += d.vx * dt; d.y += d.vy * dt; continue; }
    const dx = d.tx - d.x, dy = d.ty - d.y;
    const dist = hyp(dx, dy);
    let urg = d.urg;
    if (dist > 7 && urg < 0.85) urg = 0.85;
    if (ch.mode === 'dead' && !ch.ovr.has(d.id) && urg < 0.89) urg = Math.min(urg, 0.6);
    const want = Math.min(d.vmax * urg, dist * 2.2);
    let wx = dist > 1e-4 ? dx / dist * want : 0, wy = dist > 1e-4 ? dy / dist * want : 0;
    if (d.sx || d.sy) {
      const pin = ch.ball.owner === d ? 0.3 : 1;
      wx += d.sx * pin; wy += d.sy * pin;
      const m = hyp(wx, wy), cap = d.vmax * Math.max(urg, 0.75);
      if (m > cap) { wx *= cap / m; wy *= cap / m; }
    }
    let ax = wx - d.vx, ay = wy - d.vy;
    const am = hyp(ax, ay);
    const amax = (urg >= 0.9 ? VIEW.sprintAccel : VIEW.accel) * dt;
    if (am > amax) { ax *= amax / am; ay *= amax / am; }
    d.vx += ax; d.vy += ay;
    const sp = hyp(d.vx, d.vy);
    if (sp > d.vmax) { d.vx *= d.vmax / sp; d.vy *= d.vmax / sp; }
    d.x += d.vx * dt; d.y += d.vy * dt;
    // never pushed (by separation in a crowded box) more than 1.2 m beyond a line
    if (d.x < -1.2 || d.x > L + 1.2) { d.x = clamp(d.x, -1.2, L + 1.2); d.vx = 0; }
    if (d.y < -1.2 || d.y > W + 1.2) { d.y = clamp(d.y, -1.2, W + 1.2); d.vy = 0; }
    // facing: movement direction when moving, else toward the attacked goal
    if (sp > 0.8) { d.fxd = d.vx / sp; d.fyd = d.vy / sp; }
    else { const g = dirOf(ch, d.side); d.fxd = lerp(d.fxd, g, 0.05); d.fyd = lerp(d.fyd, 0, 0.05); const n = hyp(d.fxd, d.fyd) || 1; d.fxd /= n; d.fyd /= n; }
  }
}

function moveOfficials(ch) {
  const b = ballFocus(ch);
  const dt = STEP;
  for (const o of ch.officials) {
    o.px = o.x; o.py = o.y;
    let tx, ty;
    if (o.kind === 'ref') {
      tx = clamp(b.x - 9, 6, L - 6); ty = clamp(b.y + (b.y < CY ? 9 : -9), 4, W - 4);
      if (ch.refTarget) { tx = ch.refTarget.x; ty = ch.refTarget.y; }
    } else {
      // assistants follow the second-last defender of their half, on the touchline
      const right = o.kind === 'ar1';
      const defSide = (dirOf(ch, 'home') > 0) === right ? 'away' : 'home';
      const lim = offsideLimit(ch, OTHER[defSide]).second;
      const absX = fx(ch, OTHER[defSide], lim);
      tx = right ? clamp(absX, L / 2, L) : clamp(absX, 0, L / 2);
      ty = right ? -0.8 : W + 0.8;
    }
    const dx = tx - o.x, dy = ty - o.y, dd = hyp(dx, dy);
    const want = Math.min(7, dd * 1.2);
    const wx = dd > 1e-4 ? dx / dd * want : 0, wy = dd > 1e-4 ? dy / dd * want : 0;
    o.vx = lerp(o.vx, wx, 0.08); o.vy = lerp(o.vy, wy, 0.08);
    o.x += o.vx * dt; o.y += o.vy * dt;
  }
}

// ------------------------------------------------------------------ ball

function giveBall(ch, d, quiet) {
  const b = ch.ball;
  b.owner = d; b.fl = null; b.h = 0; b.rest = false;
  ch.lastRecv = null;
  if (d) ch.runners.delete(d.id);
  if (d) {
    d.touches++;
    b.lastTouch = d;
    if (ch.poss !== d.side) {
      const prev = ch.poss;
      ch.poss = d.side;
      // transition: the side that lost the ball recovers its shape at full speed (longer right after a set
      // piece, when its centre-backs are still up in the opponent's box)
      if (prev && ch.mode !== 'setpiece') ch.transition = { side: d.side, until: ch.t + VIEW.transition + (ch.t - (ch.spEnd ?? -99) < 6 ? 2 : 0) };
    }
  }
}

/**
 * Start a ball flight. kind: pass | longBall | cross | shot | header | clear | roll | throw
 * peak: rendering height 0..1 at mid-flight (scale up to 1.6x and offset shadow in the view)
 */
function launch(ch, kind, to, dur, opts = {}) {
  const b = ch.ball;
  const fromOwner = b.owner;
  b.owner = null; b.rest = false;
  b.fl = {
    kind, x0: b.x, y0: b.y, x1: to.x, y1: to.y, t: 0, dur: Math.max(0.12, dur),
    peak: opts.peak ?? (kind === 'longBall' || kind === 'cross' || kind === 'clear' ? 0.9 : kind === 'shot' ? 0.12 : kind === 'header' ? 0.3 : 0),
    onEnd: opts.onEnd || null, from: fromOwner, ease: opts.ease ?? (kind === 'pass' || kind === 'roll' ? 'out' : 'linear'),
    recv: opts.recv || null,
  };
  if (fromOwner) b.lastTouch = fromOwner;
  ch.trails.push({ x0: b.x, y0: b.y, x1: to.x, y1: to.y, t: ch.t, kind });
  if (ch.trails.length > 8) ch.trails.shift();
}

function updateBall(ch) {
  const b = ch.ball;
  b.px = b.x; b.py = b.y;
  if (b.owner) {
    const d = b.owner;
    if (d.pos === 'GK' && ch.keeperHold === d) { b.x = d.x + d.fxd * 0.5; b.y = d.y + d.fyd * 0.5; }
    else { b.x = d.x + d.fxd * VIEW.ballOffset; b.y = d.y + d.fyd * VIEW.ballOffset; }
    b.h = 0;
    return;
  }
  if (!b.fl) return;
  const f = b.fl;
  f.t += STEP;
  const u = clamp(f.t / f.dur, 0, 1);
  const e = f.ease === 'out' ? 1 - Math.pow(1 - u, 1.7) : u;
  const ox = b.x;
  b.x = lerp(f.x0, f.x1, e); b.y = lerp(f.y0, f.y1, e);
  b.h = f.peak * 4 * u * (1 - u);
  // goal line crossing cue
  if ((ox <= L && b.x > L) || (ox >= 0 && b.x < 0)) {
    const lineX = b.x > L ? L : 0;
    const k = (lineX - ox) / ((b.x - ox) || 1e-6);
    const yc = b.py + (b.y - b.py) * k;
    ch.cues.push({ type: 'lineCross', x: lineX, y: yc, kind: f.kind, t: ch.t });
  }
  if (u >= 1) {
    b.fl = null;
    b.h = 0;
    b.rest = true;
    if (f.onEnd) f.onEnd(ch);
  }
}

// ------------------------------------------------------------------ fades and layouts

function startFade(ch, apply) {
  ch.fade = { a: 1, phase: 'out', t: 0, apply };
  ch.cues.push({ type: 'fade', t: ch.t });
}

function updateFade(ch) {
  const f = ch.fade;
  if (!f.phase) return;
  f.t += STEP;
  if (f.phase === 'out') {
    f.a = Math.max(0, 1 - f.t / VIEW.fade);
    if (f.t >= VIEW.fade) {
      if (f.apply) f.apply(ch);
      for (const d of ch.discs) { d.px = d.x; d.py = d.y; d.vx = 0; d.vy = 0; }
      ch.ball.px = ch.ball.x; ch.ball.py = ch.ball.y;
      f.phase = 'in'; f.t = 0; f.resetAt = ch.t;
    }
  } else {
    f.a = Math.min(1, f.t / VIEW.fade);
    if (f.t >= VIEW.fade) { f.phase = null; f.a = 1; }
  }
}

/** Place every on-pitch disc of a side at attack-frame positions (instant, only inside a fade). */
function place(ch, side, map) {
  for (const d of onPitch(ch.teams[side])) {
    const p = map.get(d.id);
    if (!p) continue;
    const a = toAbs(ch, side, p.ax, p.ay);
    d.x = d.tx = d.px = a.x; d.y = d.ty = d.py = a.y;
    d.vx = d.vy = 0;
    d.fxd = dirOf(ch, side); d.fyd = 0;
  }
}

/** Shape positions (attack frame) of a side for a given ball (attack frame of that side). */
function shapeMap(ch, side, inPoss, bx, by) {
  const T = ch.teams[side];
  const ps = onPitch(T);
  const out = baseShape(T, ps, inPoss, bx, by, null);
  const m = new Map();
  ps.forEach((d, i) => {
    if (out[i].line === 'gk') { const k = keeperSpot(bx, by, inPoss); m.set(d.id, { ax: k.ax, ay: k.ay }); }
    else m.set(d.id, { ax: out[i].ax, ay: out[i].ay });
  });
  return m;
}

function spreadMap(m, minD) {
  const arr = [...m.values()];
  for (let it = 0; it < 4; it++) {
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      const a = arr[i], b = arr[j];
      const dx = b.ax - a.ax, dy = b.ay - a.ay, dd = hyp(dx, dy) || 1e-3;
      if (dd < minD && !a.fixed && !b.fixed) { const p = (minD - dd) / 2; a.ax -= dx / dd * p; a.ay -= dy / dd * p; b.ax += dx / dd * p; b.ay += dy / dd * p; }
      else if (dd < minD && a.fixed && !b.fixed) { b.ax += dx / dd * (minD - dd); b.ay += dy / dd * (minD - dd); }
      else if (dd < minD && b.fixed && !a.fixed) { a.ax -= dx / dd * (minD - dd); a.ay -= dy / dd * (minD - dd); }
    }
  }
  for (const a of arr) { a.ax = clamp(a.ax, 1, L - 1); a.ay = clamp(a.ay, 1, W - 1); }
}

function kickoffLayout(ch, kickSide, instant) {
  const apply = (c) => {
    for (const side of ['home', 'away']) {
      const T = c.teams[side];
      const m = new Map();
      for (const d of onPitch(T)) {
        const a = T.anchors[d.slot];
        if (a.line === 'gk') { m.set(d.id, { ax: 4, ay: CY }); continue; }
        let ax = 12 + a.ax * 0.42, ay = a.ay;
        ax = Math.min(ax, L / 2 - 1.2);
        const dd = hyp(ax - L / 2, ay - CY);
        if (dd < PITCH.circle + 0.8) { const k = (PITCH.circle + 0.8) / (dd || 1); ax = L / 2 + (ax - L / 2) * k; ay = CY + (ay - CY) * k; ax = Math.min(ax, L / 2 - 1.2); }
        m.set(d.id, { ax, ay });
      }
      if (side === kickSide) {
        const ps = onPitch(T);
        const st = ps.find((d) => d.pos === 'ST') || ps.find((d) => d.pos === 'AM') || ps.find((d) => d.pos !== 'GK');
        const mate = ps.find((d) => d !== st && (d.pos === 'CM' || d.pos === 'AM' || d.pos === 'DM')) || ps.find((d) => d !== st && d.pos !== 'GK');
        if (st) m.set(st.id, { ax: L / 2 - 0.6, ay: CY + 0.4, fixed: true });
        if (mate) m.set(mate.id, { ax: L / 2 - 7, ay: CY - 3, fixed: true });
        c.kickTaker = st; c.kickMate = mate;
      }
      spreadMap(m, 4.2);
      place(c, side, m);
    }
    c.poss = kickSide;
    giveBall(c, c.kickTaker, true);
    c.ball.x = L / 2; c.ball.y = CY;
    c.mode = 'setpiece'; c.layout = layoutFromDiscs(c);
    c.ovr.clear(); c.transition = null;
  };
  if (instant) apply(ch); else startFade(ch, apply);
}

function layoutFromDiscs(ch) {
  const m = new Map();
  for (const d of ch.discs) m.set(d.id, { x: d.x, y: d.y });
  return m;
}

/** Goal kick for `side`: keeper on the six-yard line, team spread, opponents outside the box. */
function goalKickLayout(ch, side) {
  return (c) => {
    const gy = CY + (c.rng.next() < 0.5 ? -4 : 4);
    const own = shapeMap(c, side, true, 8, gy);
    const k = keeperOf(c.teams[side]);
    if (k) own.set(k.id, { ax: PITCH.sixDepth, ay: gy, fixed: true });
    for (const d of onPitch(c.teams[side])) if (d.pos === 'CB') { const p = own.get(d.id); p.ax = 15; p.ay = CY + Math.sign(p.ay - CY || 1) * 17; }
    spreadMap(own, 4.5);
    place(c, side, own);
    const os = OTHER[side];
    const opp = shapeMap(c, os, false, L - 10, W - gy);
    for (const p of opp.values()) {
      // outside the penalty area (attack frame of the pressing side: box is ax > 88.5)
      if (p.ax > L - PITCH.boxDepth - 0.5 && Math.abs(p.ay - CY) < PITCH.boxHalf + 0.5) p.ax = L - PITCH.boxDepth - 1;
      p.ax = Math.min(p.ax, L - PITCH.boxDepth - 1);
    }
    const ok = keeperOf(c.teams[os]);
    if (ok) opp.set(ok.id, { ax: 10, ay: CY, fixed: true });
    spreadMap(opp, 4.5);
    place(c, os, opp);
    c.poss = side;
    if (k) { giveBall(c, k, true); c.keeperHold = null; }
    c.ball.x = fx(c, side, PITCH.sixDepth); c.ball.y = fy(c, side, gy);
    c.mode = 'setpiece'; c.layout = layoutFromDiscs(c);
    c.ovr.clear(); c.transition = null;
  };
}

/** Corner for side A from flag (attack frame y 0 or 68). Header shooter is placed in the box. */
function cornerLayout(ch, A, taker, shooter, flagAy) {
  return (c) => {
    const D = OTHER[A];
    const TA = c.teams[A], TD = c.teams[D];
    const fyA = flagAy < CY ? 0.6 : W - 0.6;
    const mA = new Map(), mD = new Map();
    const boxSpots = [[94, 29], [97.5, 37.5], [100, 31], [91.5, 41], [99.5, 42.5], [93, 23.5]];
    const psA = onPitch(TA).filter((d) => d.pos !== 'GK' && d !== taker);
    // the header candidates: shooter first, then forwards and centre-backs, then the strongest
    const aerialScore = (d) => d.phy + (d.pos === 'ST' || d.pos === 'CB' ? 15 : d.pos === 'FB' || d.pos === 'DM' ? -10 : 0);
    const cands = psA.slice().sort((a, b) => (b === shooter) - (a === shooter) || aerialScore(b) - aerialScore(a));
    const inBox = cands.slice(0, 5);
    inBox.forEach((d, i) => { const s = boxSpots[i]; mA.set(d.id, { ax: s[0] + (c.rng.next() - 0.5), ay: s[1] + (c.rng.next() - 0.5) * 2 }); });
    const rest = cands.slice(5);
    rest.forEach((d, i) => {
      if (i === 0) mA.set(d.id, { ax: 86, ay: CY + (c.rng.next() - 0.5) * 8 });
      else mA.set(d.id, { ax: 58 + i * 2, ay: CY + (i % 2 ? -12 : 12) });
    });
    if (taker) mA.set(taker.id, { ax: L - 0.4 - VIEW.ballOffset, ay: fyA < CY ? 0.5 : W - 0.5, fixed: true });
    const ka = keeperOf(TA); if (ka) mA.set(ka.id, { ax: 12, ay: CY });
    // defenders: keeper on line, markers goal-side of each attacker in the box, two zonal at the near post, one or two up
    const psD = onPitch(TD).filter((d) => d.pos !== 'GK');
    const kd = keeperOf(TD); if (kd) mD.set(kd.id, { ax: 1.2, ay: W - CY, fixed: true });
    const order = psD.slice().sort((a, b) => (a.pos === 'ST') - (b.pos === 'ST') || b.phy - a.phy);
    let k = 0;
    for (const d of inBox) {
      const t = mA.get(d.id);
      const md = order[k++]; if (!md) break;
      mD.set(md.id, { ax: L - (t.ax + 1.6), ay: W - (t.ay + (t.ay > CY ? -1.2 : 1.2)) });
    }
    const zonal = [[L - 103, W - (fyA < CY ? 29 : 39)], [L - 98.5, W - (CY + (fyA < CY ? -6 : 6))], [L - 87, W - CY]];
    for (const z of zonal) { const md = order[k++]; if (!md) break; mD.set(md.id, { ax: z[0], ay: z[1] }); }
    while (k < order.length) { const md = order[k++]; mD.set(md.id, { ax: 38 + k, ay: CY + (k % 2 ? 9 : -9) }); }
    spreadMap(mA, 4.2); spreadMap(mD, 4.2);
    place(c, A, mA); place(c, D, mD);
    if (taker) { c.poss = A; giveBall(c, taker, true); }
    c.ball.x = fx(c, A, L - 0.6); c.ball.y = fy(c, A, fyA);
    c.mode = 'setpiece'; c.setPiece = 'corner'; c.layout = layoutFromDiscs(c);
    c.ovr.clear(); c.transition = null;
  };
}

/** Direct free kick at spot (attack frame of A): wall of 4 at 9.15 m on the line to goal. */
function freeKickLayout(ch, A, taker, spot) {
  return (c) => {
    const D = OTHER[A];
    const TA = c.teams[A], TD = c.teams[D];
    const mA = new Map(), mD = new Map();
    const gx = L, gy = CY;
    const dx = gx - spot.ax, dy = gy - spot.ay, dd = hyp(dx, dy);
    const ux = dx / dd, uy = dy / dd;
    const wx = spot.ax + ux * PITCH.circle, wy = spot.ay + uy * PITCH.circle;
    if (taker) mA.set(taker.id, { ax: spot.ax - VIEW.ballOffset, ay: spot.ay, fixed: true });
    const psD = onPitch(TD).filter((d) => d.pos !== 'GK').sort((a, b) => (b.pos === 'ST') - (a.pos === 'ST') || a.phy - b.phy);
    const wall = psD.slice(-4);
    wall.forEach((d, i) => { const o = (i - 1.5) * 1.5; mD.set(d.id, { ax: L - (wx - uy * o), ay: W - (wy + ux * o), fixed: true }); });
    const kd = keeperOf(TD); if (kd) mD.set(kd.id, { ax: 1.0, ay: W - (CY + clamp((spot.ay - CY) * -0.15, -2, 2)), fixed: true });
    // attackers on the edge of the box (forwards first, then the tallest), the rest stay back
    const ATT_ORDER = { ST: 0, W: 1, AM: 2, CM: 3, CB: 4, DM: 5, FB: 6 };
    const psA = onPitch(TA).filter((d) => d.pos !== 'GK' && d !== taker).sort((a, b) => (ATT_ORDER[a.pos] ?? 9) - (ATT_ORDER[b.pos] ?? 9));
    const lineAx = Math.max(spot.ax + 3, L - PITCH.boxDepth - 1.5);
    const edge = [];
    psA.forEach((d, i) => {
      if (i < 5) { const p = { ax: lineAx + (i % 2) * 1.5, ay: CY - 13 + i * 6.5 }; mA.set(d.id, p); edge.push(p); }
      else mA.set(d.id, { ax: Math.min(56 + (i - 5) * 3, spot.ax - 12), ay: CY + ((i - 5) % 2 ? -13 : 13) });
    });
    const ka = keeperOf(TA); if (ka) mA.set(ka.id, { ax: 12, ay: CY });
    const markers = psD.slice(0, -4);
    markers.forEach((d, i) => {
      const t = edge[i];
      if (t) mD.set(d.id, { ax: L - (t.ax + 1.3), ay: W - t.ay });
      else mD.set(d.id, { ax: 40 + i * 2, ay: CY + (i % 2 ? 10 : -10) });
    });
    spreadMap(mA, 3.2); spreadMap(mD, 1.4);
    place(c, A, mA); place(c, D, mD);
    if (taker) { c.poss = A; giveBall(c, taker, true); }
    const b = toAbs(c, A, spot.ax, spot.ay);
    c.ball.x = b.x; c.ball.y = b.y;
    c.mode = 'setpiece'; c.setPiece = 'freeKick'; c.layout = layoutFromDiscs(c);
    c.ovr.clear(); c.transition = null;
  };
}

/** Penalty for A: taker at the spot, keeper on his line, everyone else outside the box and the arc. */
function penaltyLayout(ch, A, taker) {
  return (c) => {
    const D = OTHER[A];
    const mA = new Map(), mD = new Map();
    const spotAx = L - PITCH.spot;
    if (taker) mA.set(taker.id, { ax: spotAx - VIEW.ballOffset, ay: CY, fixed: true });
    const kd = keeperOf(c.teams[D]); if (kd) mD.set(kd.id, { ax: 0.4, ay: CY, fixed: true });
    const ka = keeperOf(c.teams[A]); if (ka) mA.set(ka.id, { ax: 12, ay: CY });
    const psA = onPitch(c.teams[A]).filter((d) => d.pos !== 'GK' && d !== taker);
    const psD = onPitch(c.teams[D]).filter((d) => d.pos !== 'GK');
    const slots = [];
    for (let i = 0; i < 12; i++) slots.push({ ax: L - PITCH.boxDepth - 1.4, ay: 16 + i * 3.3 });
    let si = 0;
    const edge = (d, mine) => {
      const s = slots[si++];
      if (!s) return false;
      // keep out of the arc (9.15 m from the spot)
      let ax = s.ax;
      const dd = hyp(ax - spotAx, s.ay - CY);
      if (dd < PITCH.circle + 0.6) ax = spotAx - Math.sqrt(Math.max(0, (PITCH.circle + 0.6) ** 2 - (s.ay - CY) ** 2));
      if (mine) mA.set(d.id, { ax, ay: s.ay }); else mD.set(d.id, { ax: L - ax, ay: W - s.ay });
      return true;
    };
    const a5 = psA.slice(0, 5), d5 = psD.slice(0, 6);
    for (let i = 0; i < 6; i++) { if (a5[i]) edge(a5[i], true); if (d5[i]) edge(d5[i], false); }
    psA.slice(5).forEach((d, i) => mA.set(d.id, { ax: 60 + i * 3, ay: CY + (i % 2 ? -10 : 10) }));
    psD.slice(6).forEach((d, i) => mD.set(d.id, { ax: L - (66 + i * 3), ay: W - (CY + (i % 2 ? 12 : -12)) }));
    spreadMap(mA, 2.9); spreadMap(mD, 2.9);
    place(c, A, mA); place(c, D, mD);
    if (taker) { c.poss = A; giveBall(c, taker, true); }
    const b = toAbs(c, A, spotAx, CY);
    c.ball.x = b.x; c.ball.y = b.y;
    c.mode = 'setpiece'; c.setPiece = 'penalty'; c.layout = layoutFromDiscs(c);
    c.ovr.clear(); c.transition = null;
  };
}

/**
 * Highlights cut into a chance: the carrier (assister, or the shooter for a solo run) has the ball at preA,
 * both shapes are set around it, the shooter waits onside near his run.
 */
function chanceCut(ch, A, S, Ast, spotA, preA) {
  return (c) => {
    const D = OTHER[A];
    const mA = shapeMap(c, A, true, preA.ax, preA.ay);
    const mD = shapeMap(c, D, false, L - preA.ax, W - preA.ay);
    const carrier = Ast || S;
    mA.set(carrier.id, { ax: preA.ax, ay: preA.ay, fixed: true });
    if (Ast) {
      // second-last defender in A's frame, the shooter one step onside of it, on the side of his spot
      const xs = [...mD.values()].map((p) => L - p.ax).sort((a, b) => b - a);
      const line = Math.max(L / 2, xs.length > 1 ? xs[1] : xs[0], preA.ax);
      mA.set(S.id, { ax: Math.min(spotA.ax - 1, line - 1.2), ay: clamp(spotA.ay + (spotA.ay > CY ? 2.5 : -2.5), 4, W - 4), fixed: true });
    }
    spreadMap(mA, 5); spreadMap(mD, 5);
    for (const p of mD.values()) {
      const dd = hyp(L - p.ax - preA.ax, W - p.ay - preA.ay);
      if (dd < 5) p.ax -= 5 - dd;
    }
    place(c, A, mA); place(c, D, mD);
    c.poss = A;
    giveBall(c, carrier, true);
    c.mode = 'open'; c.layout = null; c.setPiece = null;
    c.ovr.clear(); c.runners.clear(); c.transition = null;
  };
}

/** Open-play cut (highlights mode): side A has the ball around attack-frame (bx, by). */
function openLayout(ch, A, bx, by, carrierPick) {
  return (c) => {
    const D = OTHER[A];
    const mA = shapeMap(c, A, true, bx, by);
    const mD = shapeMap(c, D, false, L - bx, W - by);
    let carrier = carrierPick ? carrierPick(c) : null;
    if (!carrier) {
      let bd = Infinity;
      for (const d of onPitch(c.teams[A])) {
        if (d.pos === 'GK') continue;
        const p = mA.get(d.id);
        const dd = hyp(p.ax - bx, p.ay - by);
        if (dd < bd) { bd = dd; carrier = d; }
      }
    }
    if (carrier) mA.set(carrier.id, { ax: bx, ay: by, fixed: true });
    spreadMap(mA, 5); spreadMap(mD, 5);
    // no opponent within 3 m of the carrier at the cut
    for (const p of mD.values()) { const dd = hyp(L - p.ax - bx, W - p.ay - by); if (dd < 4) { p.ax -= 3; } }
    place(c, A, mA); place(c, D, mD);
    c.poss = A;
    giveBall(c, carrier, true);
    c.mode = 'open'; c.layout = null; c.setPiece = null;
    c.ovr.clear(); c.transition = null;
  };
}

// ------------------------------------------------------------------ small queries

function secondLast(ch, side) {
  const xs = [];
  for (const d of ch.teams[OTHER[side]].slots) if (d && !d.leaving) xs.push(fx(ch, side, d.x));
  xs.sort((a, b) => b - a);
  return xs.length > 1 ? xs[1] : (xs[0] ?? L);
}
/** Attack-frame x a player of `side` may reach and stay onside (judged with the ball where it is now). */
function onsideLimit(ch, side) {
  return Math.max(L / 2, fx(ch, side, ch.ball.x), secondLast(ch, side));
}
function isOffside(ch, side, d) {
  return offsideAt(fx(ch, side, d.x), fx(ch, side, ch.ball.x), secondLast(ch, side));
}
function nearestOf(ch, side, x, y, outfield, exclude) {
  let best = null, bd = Infinity;
  for (const d of onPitch(ch.teams[side])) {
    if ((outfield && d.pos === 'GK') || d.injured || (exclude && exclude.has(d.id))) continue;
    const dd = hyp(d.x - x, d.y - y);
    if (dd < bd) { bd = dd; best = d; }
  }
  return best;
}
const lead = (d, k = 0.3) => ({ x: clamp(d.x + d.vx * k, 1, L - 1), y: clamp(d.y + d.vy * k, 1, W - 1) });
const etaTo = (d, p) => hyp(p.x - d.x, p.y - d.y) / (d.vmax * 0.92) + 0.15;
const isAerial = (kind) => kind === 'longBall' || kind === 'cross' || kind === 'goalKick' || kind === 'clear';
function activeDisc(ch, id) {
  const d = findDisc(ch, id);
  return d && d.onPitch && !d.leaving && d.slot != null ? d : null;
}
function opponentsOf(ch, side) { return onPitch(ch.teams[OTHER[side]]); }
function freeSpace(ch, side, p) {
  let m = Infinity;
  for (const o of opponentsOf(ch, side)) m = Math.min(m, hyp(o.x - p.x, o.y - p.y));
  return m;
}
const U = (ch, a, b) => a + ch.rng.next() * (b - a);

function midLineAx(ch, side) {
  let s = 0, n = 0;
  for (const d of onPitch(ch.teams[side])) if (d.pos === 'DM' || d.pos === 'CM' || d.pos === 'AM') { s += fx(ch, side, d.x); n++; }
  return n ? s / n : null;
}
/** A back-line player only steps out to a point behind his own midfield line (never ahead of it). */
function canStepOut(ch, d, x) {
  const T = ch.teams[d.side];
  const backLine = d.pos === 'CB' || (d.pos === 'FB' && T.anchors[d.slot] && T.anchors[d.slot].line === 'def');
  if (!backLine) return true;
  const ml = midLineAx(ch, d.side);
  return ml == null || fx(ch, d.side, x) <= ml - 1.5;
}

// ------------------------------------------------------------------ actions, cues, text

const r1 = (v) => Math.round(v * 10) / 10;

/** Record an action step (PROMPT step shape) for the current segment and emit an `action` cue. */
function act(ch, type, player, target, from, to, extra) {
  const a = {
    t: r1(ch.t), type, playerId: player ? player.id : null, targetId: target ? target.id : null,
    from: { x: r1(from.x), y: r1(from.y) }, to: { x: r1(to.x), y: r1(to.y) },
    text: actionLine(type, player ? player.name : '', target ? target.name : ''),
  };
  if (ch.seg) ch.seg.actions.push(a);
  const cue = { type: 'action', a, t: ch.t, side: player ? player.side : null, ...(extra || {}) };
  if (ch.recordSnaps && extra && extra.pass) {
    cue.snap = { opp: opponentsOf(ch, player.side).map((d) => ({ x: d.x, y: d.y })), ball: { x: ch.ball.x, y: ch.ball.y }, to: { x: to.x, y: to.y }, recv: target ? { x: target.x, y: target.y } : null, task: ch.task ? ch.task.name : null };
  }
  ch.cues.push(cue);
  if (!(extra && extra.silent)) setText(ch, a.text, player ? player.side : null);
  return a;
}
function setText(ch, text, side) { if (text) { ch.text = text; ch.textSide = side ?? ch.poss; } }

// ------------------------------------------------------------------ task runner

function task(name, fn) { return { name, fn, st: { t: 0, n: 0 } }; }
function front(ch, ...tks) { ch.tasks.unshift(...tks); }

function runTasks(ch) {
  for (let guard = 0; guard < 24; guard++) {
    if (!ch.task) {
      if (ch.tasks.length) ch.task = ch.tasks.shift();
      else if (ch.evq.length) { planNext(ch); continue; }
      else {
        // the caller can feed the next tick from inside the step loop (the view pulls ticks as needed)
        if (ch.onIdle && !ch.finished) { const fed = ch.onIdle(ch); if (fed && ch.evq.length) continue; }
        return;
      }
    }
    const tk = ch.task;
    const done = tk.fn(ch, tk.st);
    tk.st.n++;
    if (done) { ch.task = null; continue; }
    tk.st.t += STEP;
    return;
  }
}

const tCall = (fn) => task('call', (ch) => { fn(ch); return true; });
const tWait = (sec) => task('wait', (ch, st) => st.t >= sec);
const tDead = (sec) => task('dead', (ch, st) => { if (st.n === 0 && ch.mode === 'open') ch.mode = 'dead'; return st.t >= sec * (ch.compact ? 0.5 : 1); });
const tOpen = () => tCall((ch) => { ch.mode = 'open'; ch.layout = null; ch.setPiece = null; });
const tFade = (apply) => task('fade', (ch, st) => { if (st.n === 0) startFade(ch, apply); return !ch.fade.phase; });

/** The carrier keeps the ball while waiting: shield, or drift into space at walking pace. */
function keepBall(ch, c, st) {
  if (!c) return;
  if (st.kb == null || ch.t - st.kb > 0.5) {
    st.kb = ch.t;
    const g = dirOf(ch, c.side);
    let best = null, bv = -Infinity;
    // a back-line player on the ball never carries it past his own midfield line
    const T = ch.teams[c.side];
    const backLine = c.pos === 'CB' || (c.pos === 'FB' && T.anchors[c.slot] && T.anchors[c.slot].line === 'def');
    const ml = backLine ? midLineAx(ch, c.side) : null;
    for (const ang of [0, 0.7, -0.7, 1.4, -1.4]) {
      const p = { x: clamp(c.x + Math.cos(ang) * g * 4, 2, L - 2), y: clamp(c.y + Math.sin(ang) * 4, 2, W - 2) };
      if (ml != null && fx(ch, c.side, p.x) > ml - 2.5) p.x = fx(ch, c.side, Math.min(fx(ch, c.side, c.x), ml - 2.5));
      const v = Math.min(freeSpace(ch, c.side, p), 8) - Math.abs(ang) * 0.6;
      if (v > bv) { bv = v; best = p; }
    }
    st.kbp = best;
  }
  ch.ovr.set(c.id, { x: st.kbp.x, y: st.kbp.y, urg: 0.42 });
}

/** In a chance, defenders standing in the planned lane are a step late: they get pulled aside. */
function clearLane(ch, side, from, to, aerial) {
  const len = hyp(to.x - from.x, to.y - from.y);
  const s1 = aerial ? Math.min(len - 0.8, 4.5) : len - 0.6;
  for (const o of opponentsOf(ch, side)) {
    if (o.pos === 'GK') continue;
    const r = segDist(from.x, from.y, to.x, to.y, o.x, o.y);
    if (r.s < 0.6 || r.s > s1 || r.d > 2.9) continue;
    const ux = (to.x - from.x) / (len || 1), uy = (to.y - from.y) / (len || 1);
    let nx = -uy, ny = ux;
    const qx = from.x + ux * r.s, qy = from.y + uy * r.s;
    if ((o.x - qx) * nx + (o.y - qy) * ny < 0) { nx = -nx; ny = -ny; }
    // move him sideways only by what is needed (keeps two cleared defenders apart)
    const need = 3.4 - r.d;
    const p = { x: clamp(o.x + nx * need, 1, L - 1), y: clamp(o.y + ny * need, 1, W - 1) };
    if (p.y <= 1.2 || p.y >= W - 1.2 || !canStepOut(ch, o, p.x)) { const k = 3.4 + r.d; p.x = clamp(o.x - nx * k, 1, L - 1); p.y = clamp(o.y - ny * k, 1, W - 1); }
    ch.ovr.set(o.id, { x: p.x, y: p.y, urg: 1, until: ch.t + 1.0, soft: true });
  }
}

// ------------------------------------------------------------------ Layer 3: pass choice

function passLegal(ch, side, from, R, recv, aerial, o) {
  if (laneBlocker(from, R, opponentsOf(ch, side), aerial, 2.25)) return false;
  if (!(o && (o.allowOffside || o.setPiece)) && recv && isOffside(ch, side, recv)) return false;
  return true;
}

/**
 * Score every team-mate as a pass target (PROMPT Layer 3) and pick one of the best.
 * opts: toward {x,y} + towardW, prefer disc, exclude Set, allowBack, maxLen, minLen, ignoreLegal, aerial
 */
function choosePass(ch, carrier, opts = {}) {
  const side = carrier.side;
  const T = ch.teams[side];
  const b = ch.ball;
  const from = { x: b.x, y: b.y };
  const cax = fx(ch, side, from.x);
  const opps = opponentsOf(ch, side);
  let pressed = false;
  for (const o of opps) if (hyp(o.x - carrier.x, o.y - carrier.y) < 3.6) pressed = true;
  const passing = T.settings.passing;
  const pas = carrier.pas;
  const naive = ch.layer < 3;
  const out = [];
  for (const r of onPitch(T)) {
    if (r === carrier || r.injured) continue;
    if (opts.exclude && opts.exclude.has(r.id)) continue;
    if (r.pos === 'GK' && !(pressed && cax < 35) && !opts.allowGK) continue;
    const R = lead(r, 0.35);
    const d = hyp(R.x - from.x, R.y - from.y);
    if (d < (opts.minLen ?? 6) || d > (opts.maxLen ?? 42)) continue;
    const aerial = opts.aerial || d > 30;
    if (!naive && !opts.ignoreLegal && !passLegal(ch, side, from, R, r, aerial, opts)) continue;
    const prog = fx(ch, side, R.x) - cax;
    if (!naive && prog < -3 && !pressed && !opts.allowBack) continue;
    let sc = 0;
    if (!naive) {
      const wProg = 0.10 + (pas - 60) / 500 + (passing === 'direct' ? 0.07 : passing === 'short' ? -0.03 : 0);
      sc += prog * wProg;
      const free = freeSpace(ch, side, R);
      sc += free >= 4 ? 1.2 : (free - 4) * 0.45;
      const pref = passing === 'short' ? [6, 14] : passing === 'direct' ? [14, 34] : [8, 22];
      const plus = (pas - 65) / 5;
      if (d < pref[0]) sc -= (pref[0] - d) * 0.15;
      if (d > pref[1] + plus) sc -= (d - pref[1] - plus) * 0.14;
      if (aerial) sc -= 0.6;
    }
    if (opts.toward) sc -= hyp(R.x - opts.toward.x, R.y - opts.toward.y) * (opts.towardW ?? 0.1);
    if (opts.prefer === r) sc += 2.5;
    out.push({ r, R, sc, aerial, d });
  }
  if (!out.length) return null;
  if (naive) return out[Math.floor(ch.rng.next() * out.length)];
  out.sort((a, b) => b.sc - a.sc);
  const top = out.slice(0, 3);
  const w = top.map((o) => Math.exp((o.sc - top[0].sc) * 1.6));
  return top[ch.rng.weightedIndex(w)];
}

/** Hold time before releasing a pass: low-rated players take more touches. */
function holdTime(ch, c) {
  return clamp(0.14 + (72 - c.pas) / 130 + (c.dri < 55 ? 0.06 : 0), 0.08, 0.5);
}

/**
 * Relay passes go into the receiver's run: the furthest point on his way to `R` that he reaches when a ball
 * at normal pace does. The final ball to the shooter does not use this (its point is the shot spot).
 */
function adaptPoint(ch, b, recv, R, kind) {
  const sp = VIEW.speeds[kind] || VIEW.speeds.pass;
  const v = (sp[0] + sp[1]) / 2;
  for (let f = 1; f >= 0; f -= 0.1) {
    const p = { x: recv.x + (R.x - recv.x) * f, y: recv.y + (R.y - recv.y) * f };
    if (etaTo(recv, p) <= hyp(p.x - b.x, p.y - b.y) / v + 0.25) return p;
  }
  return lead(recv);
}

/**
 * Pass task. o: { to, point, kind, forced, allowOffside, setPiece, restart, maxWait, choose, runner, onRecv,
 *   offsideCall, silent }
 */
function tPass(o = {}) {
  return task('pass', (ch, st) => {
    const b = ch.ball;
    if (st.n === 0) {
      st.passer = b.owner;
      if (!st.passer) return true;
      if (ch.mode !== 'open' && !o.restart) { ch.mode = 'open'; ch.layout = null; ch.setPiece = null; }
    }
    if (st.released) return !!st.done && !b.fl;
    const passer = b.owner;
    if (!passer || passer !== st.passer) return true;
    const maxWait = o.maxWait ?? 1.2;
    let recv = o.to && o.to.onPitch && !o.to.leaving ? o.to : null;
    let R, kind = o.kind, aerial;
    if (recv) {
      R = o.point ? { x: o.point.x, y: o.point.y } : lead(recv);
      if (o.adapt && o.point) R = adaptPoint(ch, b, recv, R, o.kind || 'pass');
      const len = hyp(R.x - b.x, R.y - b.y);
      if (!kind) kind = len > 32 ? 'longBall' : 'pass';
      aerial = isAerial(kind);
      if (ch.layer >= 3) {
        if (o.forced || o.runner) {
          if (!ch.runners.has(recv.id) && o.point) ch.runners.set(recv.id, { x: R.x, y: R.y });
          if (ch.chance) clearLane(ch, passer.side, b, R, aerial);
        }
        if (st.t < (o.quick ? 0.05 : 0.15) + (o.restart || o.quick ? 0 : holdTime(ch, passer) * 0.5)) { if (!o.restart) keepBall(ch, passer, st); return false; }
        let ok = passLegal(ch, passer.side, b, R, recv, aerial, o);
        const sp = VIEW.speeds[kind] || VIEW.speeds.pass;
        const ready = etaTo(recv, R) <= len / (sp[0] * (aerial ? 0.75 : 0.75)) + 0.3;
        if ((!ok || !ready) && st.t < maxWait) { if (!o.restart) keepBall(ch, passer, st); return false; }
        if (!ok && !aerial && passLegal(ch, passer.side, b, R, recv, true, o)) { kind = 'longBall'; aerial = true; ok = true; }
        if (!ok && !o.restart && (o.tries || 0) < 2) {
          // still no clean lane: turn away from the pressure, then try again
          ch.ovr.delete(passer.id);
          front(ch, tTurn(), tPass({ ...o, tries: (o.tries || 0) + 1, maxWait: 1.0 }));
          return true;
        }
        if (!ok) { ch.stats.blockedWaits++; st.illegal = 'forced'; }
      }
    } else {
      if (st.t < holdTime(ch, passer)) { keepBall(ch, passer, st); return false; }
      let pick = choosePass(ch, passer, o.choose || {});
      if (!pick && ch.layer >= 3) {
        // nothing on: go back, then go long over the top (aerial ball, take-off must be clear)
        pick = choosePass(ch, passer, { ...(o.choose || {}), allowBack: true, allowGK: true });
        if (!pick && st.t > holdTime(ch, passer) + 0.5) pick = choosePass(ch, passer, { ...(o.choose || {}), allowBack: true, aerial: true, maxLen: 55, minLen: 15 });
      }
      if (!pick) {
        if (st.t < maxWait + holdTime(ch, passer) + 0.6) { keepBall(ch, passer, st); return false; }
        if (!o.restart && (o.tries || 0) < 2 && ch.layer >= 3) {
          ch.ovr.delete(passer.id);
          front(ch, tTurn(), tPass({ ...o, tries: (o.tries || 0) + 1, maxWait: 0.8 }));
          return true;
        }
        pick = choosePass(ch, passer, { ...(o.choose || {}), ignoreLegal: true, allowBack: true });
        if (!pick) { ch.ovr.delete(passer.id); return true; }
        ch.stats.blockedWaits++; st.illegal = 'chooser';
      }
      recv = pick.r; R = pick.R;
      if (!kind) kind = pick.d > 30 ? 'longBall' : 'pass';
      aerial = isAerial(kind) || pick.aerial;
      if (aerial && kind === 'pass') kind = 'longBall';
    }
    releasePass(ch, st, passer, recv, R, kind, aerial, o);
    return false;
  });
}

function releasePass(ch, st, passer, recv, R, kind, aerial, o) {
  const b = ch.ball;
  const from = { x: b.x, y: b.y };
  const len = hyp(R.x - from.x, R.y - from.y);
  const sp = VIEW.speeds[kind] || VIEW.speeds.pass;
  const v = lerp(sp[0], sp[1], clamp((passer.pas - 45) / 45, 0, 1));
  let dur = len / v;
  const eta = etaTo(recv, R) + 0.05;
  if (eta > dur) dur = Math.min(eta, len / Math.max(5, sp[0] * (aerial ? 0.55 : 0.55)));
  const offs = isOffside(ch, passer.side, recv);
  act(ch, kind, passer, recv, from, R, {
    pass: true, aerial, allowOffside: !!(o.allowOffside || o.setPiece), offsideAtRelease: offs, intercepted: false,
    setPiece: o.setPiece || null, offsideCall: !!o.offsideCall, silent: !!o.silent, knownIllegal: st.illegal || null,
  });
  if (o.restart) { ch.mode = 'open'; ch.layout = null; ch.setPiece = null; }
  if (ch.keeperHold === passer) ch.keeperHold = null;
  ch.ovr.delete(passer.id);
  ch.runners.delete(recv.id);
  ch.ovr.set(recv.id, { x: R.x, y: R.y, urg: 1, arrive: ch.t + dur });
  passer.fxd = (R.x - from.x) / (len || 1); passer.fyd = (R.y - from.y) / (len || 1);
  st.released = true;
  st.rolls = 0;
  launch(ch, kind, R, dur, { recv, onEnd: (c) => receive(c, recv, passer, st, o) });
}

function receive(ch, recv, passer, st, o) {
  const b = ch.ball;
  const dd = hyp(recv.x - b.x, recv.y - b.y);
  if (dd > 1.4 && st.rolls < 3 && recv.onPitch && !recv.leaving) {
    st.rolls++;
    const p = lead(recv, 0.25);
    launch(ch, 'roll', p, Math.max(0.12, hyp(p.x - b.x, p.y - b.y) / 7), { onEnd: (c) => receive(c, recv, passer, st, o) });
    return;
  }
  ch.ovr.delete(recv.id);
  if (!recv.onPitch || recv.leaving) { st.done = true; return; }
  giveBall(ch, recv);
  ch.lastRecv = { recv, passer, x: b.x, y: b.y, t: ch.t };
  st.done = true;
  if (o.onRecv) o.onRecv(ch, recv);
}

/** Dribble task: the carrier runs with the ball to `to` (abs point or fn). */
function tDribble(o) {
  return task('dribble', (ch, st) => {
    const c = ch.ball.owner;
    if (ch.ball.fl) return false;
    if (st.n === 0) {
      if (!c) return true;
      st.c = c;
      st.to = typeof o.to === 'function' ? o.to(ch, c) : o.to;
      if (!st.to) return true;
      act(ch, 'dribble', c, null, { x: ch.ball.x, y: ch.ball.y }, st.to);
      if (ch.mode !== 'open') { ch.mode = 'open'; ch.layout = null; ch.setPiece = null; }
    }
    if (c !== st.c) return true;
    ch.ovr.set(c.id, { x: st.to.x, y: st.to.y, urg: o.urg ?? 0.78 });
    if (o.clear && ch.layer >= 3) clearLane(ch, c.side, c, st.to, false);
    if (hyp(c.x - st.to.x, c.y - st.to.y) < 0.9 || st.t > (o.maxT ?? 4)) { ch.ovr.delete(c.id); return true; }
    return false;
  });
}

/** The carrier turns away from pressure: a short carry (4-6 m) toward the most open direction. */
function tTurn() {
  return tDribble({
    to: (ch, c) => {
      let best = null, bv = -Infinity;
      for (let k = 0; k < 8; k++) {
        const ang = k * Math.PI / 4;
        const p = { x: clamp(c.x + Math.cos(ang) * 5, 3, L - 3), y: clamp(c.y + Math.sin(ang) * 5, 3, W - 3) };
        const v = Math.min(freeSpace(ch, c.side, p), 9) + (canStepOut(ch, c, p.x) ? 0 : -20);
        if (v > bv) { bv = v; best = p; }
      }
      return best;
    },
    urg: 0.75, maxT: 1.3,
  });
}

/** Free space straight ahead of the carrier (no opponent within 4 m in the next 8 m). */
function spaceAhead(ch, c, dist = 8) {
  const g = dirOf(ch, c.side);
  const to = { x: clamp(c.x + g * dist, 2, L - 2), y: c.y };
  for (const o of opponentsOf(ch, c.side)) {
    const r = segDist(c.x, c.y, to.x, to.y, o.x, o.y);
    if (r.s > -1 && r.d < 4) return null;
  }
  return to;
}

// ------------------------------------------------------------------ winning the ball

function planWin(ch, side, own) {
  let ps = onPitch(ch.teams[side]).filter((d) => d.pos !== 'GK');
  if (ch.layer >= 2) { const f = ps.filter((d) => canStepOut(ch, d, own.x)); if (f.length) ps = f; }
  let near = null, nd = Infinity;
  for (const d of ps) { const dd = hyp(d.x - own.x, d.y - own.y); if (dd < nd) { nd = dd; near = d; } }
  if (nd < 5 || ch.layer < 3) return { kind: 'tackle', who: near };
  let best = null;
  for (const r of onPitch(ch.teams[own.side])) {
    if (r === own || r.pos === 'GK') continue;
    const len = hyp(r.x - own.x, r.y - own.y);
    if (len < 8 || len > 32) continue;
    for (const d of ps) {
      const sd = segDist(own.x, own.y, r.x, r.y, d.x, d.y);
      if (sd.s < 3 || sd.s > len - 2 || sd.d > 3) continue;
      if (!best || sd.d < best.dd) best = { recv: r, who: d, dd: sd.d, s: sd.s, len };
    }
  }
  if (best) return { kind: 'intercept', ...best };
  return { kind: 'tackle', who: near };
}

function intercept(ch, own, plan, st) {
  const b = ch.ball;
  const from = { x: b.x, y: b.y };
  const ux = (plan.recv.x - own.x) / plan.len, uy = (plan.recv.y - own.y) / plan.len;
  const P = { x: own.x + ux * plan.s, y: own.y + uy * plan.s };
  const dur = Math.max(plan.s / 14, etaTo(plan.who, P));
  act(ch, 'pass', own, plan.recv, from, P, { pass: true, intercepted: true, aerial: false, silent: true });
  ch.ovr.delete(own.id);
  ch.ovr.set(plan.who.id, { x: P.x, y: P.y, urg: 1 });
  const who = plan.who;
  launch(ch, 'pass', P, dur, {
    onEnd: (c) => { c.ovr.delete(who.id); giveBall(c, who); act(c, 'interception', who, plan.recv, P, P); if (st) st.got = true; },
  });
}

/** Make `side` the team in possession (tackle, interception, loose ball). */
function tGain(side, depth = 0) {
  return task('gain', (ch, st) => {
    const b = ch.ball;
    if (st.n === 0 && ch.mode !== 'open' && !(b.owner && b.owner.side === side)) {
      if (ch.mode !== 'dead' || !b.owner) { ch.mode = 'open'; ch.layout = null; ch.setPiece = null; }
    }
    const own = b.owner;
    if (own && own.side === side) {
      if (st.who) ch.ovr.delete(st.who.id);
      if (ch.mode === 'dead' && !ch.keeperHold) { ch.mode = 'open'; ch.layout = null; ch.setPiece = null; }
      return true;
    }
    if (b.fl) return false;
    // ball out of play or resting: cut to a fresh open-play situation
    if (!own && (b.x < 0 || b.x > L || b.y < 0 || b.y > W || st.t > 2.5)) {
      const p = { ax: clamp(fx(ch, side, b.x), 25, 60), ay: clamp(fy(ch, side, b.y), 12, 56) };
      front(ch, tFade(openLayout(ch, side, p.ax, p.ay)));
      return true;
    }
    if (!own) {
      const p = nearestOf(ch, side, b.x, b.y, true);
      if (!p) return true;
      st.who = p;
      ch.ovr.set(p.id, { x: b.x, y: b.y, urg: 1 });
      if (hyp(p.x - b.x, p.y - b.y) < 1.3) { ch.ovr.delete(p.id); giveBall(ch, p); act(ch, 'interception', p, null, b, b); return true; }
      return false;
    }
    // opponent keeper holds it: he distributes first
    if (own.pos === 'GK' && depth < 2) { front(ch, tKeeperDistribute(own.side), tGain(side, depth + 1)); return true; }
    if (ch.mode !== 'open') { ch.mode = 'open'; ch.layout = null; ch.setPiece = null; }
    if (!st.plan) {
      st.plan = planWin(ch, side, own);
      if (st.plan.kind === 'intercept') { intercept(ch, own, st.plan, st); return false; }
    }
    if (st.plan.kind === 'intercept') return false; // waits for the flight (owner check above ends it)
    let tk = st.plan.who;
    if (!tk) return true;
    if (ch.layer >= 2 && !canStepOut(ch, tk, own.x) && (st.replans || 0) < 3) {
      // the carrier moved past the tackler's midfield line: someone further up takes over
      ch.ovr.delete(tk.id);
      st.replans = (st.replans || 0) + 1;
      st.plan = planWin(ch, side, own);
      if (st.plan.kind === 'intercept') { intercept(ch, own, st.plan, st); return false; }
      tk = st.plan.who;
      if (!tk) return true;
    }
    ch.ovr.set(tk.id, { x: own.x, y: own.y, urg: 1 });
    ch.ovr.set(own.id, { x: own.x + dirOf(ch, own.side) * 1.5, y: own.y, urg: 0.35 });
    const dd = hyp(tk.x - own.x, tk.y - own.y);
    if (dd < 1.8 || st.t > 4) {
      ch.ovr.delete(tk.id); ch.ovr.delete(own.id);
      act(ch, 'tackle', tk, own, { x: own.x, y: own.y }, { x: own.x, y: own.y });
      if (dd >= 1.8) { st.plan = { kind: 'intercept' }; launch(ch, 'roll', lead(tk, 0.2), Math.max(0.15, dd / 7), { onEnd: (c) => giveBall(c, tk) }); return false; }
      giveBall(ch, tk);
      return true;
    }
    return false;
  });
}

/** Keeper holding the ball throws or rolls it to a defender. */
function tKeeperDistribute(side) {
  return task('distribute', (ch, st) => {
    const b = ch.ball;
    const k = b.owner;
    if (!k || k.side !== side || k.pos !== 'GK') { ch.keeperHold = null; return true; }
    if (st.n === 0) { ch.keeperHold = k; ch.mode = 'dead'; }
    if (st.t < 0.6) return false;
    ch.mode = 'open'; ch.layout = null; ch.setPiece = null;
    front(ch, tPass({ choose: { maxLen: 32, allowBack: true }, maxWait: 0.8 }), tCall((c) => { c.keeperHold = null; }));
    return true;
  });
}

/** Turnover: the carrier's pass is cut out where the defending team is densest, or he is tackled. */
function tLose(A, loser) {
  return task('lose', (ch, st) => {
    const b = ch.ball;
    if (b.fl) return false;
    if (st.n === 0) st.t0 = ch.t;
    const c = b.owner;
    if (!c || c.side !== A) return true;
    if (st.t < holdTime(ch, c)) { keepBall(ch, c, st); return false; }
    const D = OTHER[A];
    const ds = onPitch(ch.teams[D]).filter((d) => d.pos !== 'GK' && canStepOut(ch, d, d.x));
    let best = null;
    for (const r of onPitch(ch.teams[A])) {
      if (r === c || r.pos === 'GK') continue;
      const len = hyp(r.x - c.x, r.y - c.y);
      if (len < 8 || len > 30) continue;
      let dens = 0;
      for (const d of ds) if (hyp(d.x - r.x, d.y - r.y) < 9) dens++;
      for (const d of ds) {
        const sd = segDist(c.x, c.y, r.x, r.y, d.x, d.y);
        if (sd.s < 3 || sd.s > len - 1.5 || sd.d > 2.6) continue;
        const v = dens * 2 - sd.d + (r === loser ? 1.5 : 0);
        if (!best || v > best.v) best = { v, recv: r, who: d, s: sd.s, len, dd: sd.d };
      }
    }
    const nearD = nearestOf(ch, D, c.x, c.y, true);
    const tackleNow = nearD && hyp(nearD.x - c.x, nearD.y - c.y) < 6 && (ch.rng.next() < 0.5 || !best);
    if (best && !tackleNow) {
      intercept(ch, c, best, null);
      front(ch, task('flight', (c2) => !c2.ball.fl));
      return true;
    }
    // tackle; near a touchline the ball can go out for a throw-in
    front(ch, tGain(D), tMaybeThrow(D));
    return true;
  });
}

/** After a tackle near the touchline: sometimes the ball runs out and the winner throws it in. */
function tMaybeThrow(side) {
  return task('maybeThrow', (ch) => {
    const b = ch.ball;
    const c = b.owner;
    if (!c || c.side !== side) return true;
    const edge = c.y < 7 ? 0 : c.y > W - 7 ? W : null;
    if (edge == null || ch.rng.next() > 0.45) return true;
    const spot = { x: clamp(c.x, 3, L - 3), y: edge === 0 ? -0.4 : W + 0.4 };
    act(ch, 'clearance', c, null, { x: b.x, y: b.y }, spot, { silent: true });
    launch(ch, 'roll', spot, 0.4, {});
    front(ch, tThrowIn(side, spot));
    return true;
  });
}

function tThrowIn(side, spot) {
  return task('throwIn', (ch, st) => {
    const b = ch.ball;
    if (b.fl) return false;
    if (st.n === 0 || !st.thrower) {
      ch.mode = 'dead';
      st.thrower = nearestOf(ch, side, spot.x, spot.y, true);
      if (!st.thrower) return true;
    }
    const th = st.thrower;
    const stand = { x: spot.x, y: spot.y < 0 ? 0.2 : W - 0.2 };
    ch.ovr.set(th.id, { x: stand.x, y: stand.y, urg: 0.9 });
    // two team-mates come short
    if (!st.short) {
      st.short = true;
      const mates = onPitch(ch.teams[side]).filter((d) => d !== th && d.pos !== 'GK')
        .sort((a, b2) => hyp(a.x - spot.x, a.y - spot.y) - hyp(b2.x - spot.x, b2.y - spot.y)).slice(0, 2);
      mates.forEach((m, i) => {
        const g = dirOf(ch, side);
        ch.ovr.set(m.id, { x: clamp(spot.x + g * (i ? 9 : -6), 2, L - 2), y: spot.y < 0 ? 9 + i * 4 : W - 9 - i * 4, urg: 0.8, until: ch.t + 4 });
      });
    }
    if (hyp(th.x - stand.x, th.y - stand.y) < 1.2 && !st.has) {
      st.has = true;
      launch(ch, 'roll', { x: th.x, y: th.y }, 0.15, { onEnd: (c) => { giveBall(c, th, true); c.keeperHold = null; } });
      ch.setPiece = 'throwIn';
      return false;
    }
    if (st.has && b.owner === th) {
      ch.ovr.delete(th.id);
      front(ch, tPass({ choose: { maxLen: 20, allowBack: true }, kind: 'throwIn', setPiece: 'throwIn', restart: true, maxWait: 1 }));
      act(ch, 'throwIn', th, null, b, b, { silent: false });
      return true;
    }
    return st.t > 6;
  });
}

// ------------------------------------------------------------------ shots

/** Shot location for a quality band (attack frame). */
function shotSpot(ch, side, q, cross, S) {
  const sAy = S ? fy(ch, side, S.y) : CY;
  const sg = sAy >= CY ? 1 : -1;
  if (cross) {
    if (q === 'big') return { ax: U(ch, 96, 99.5), ay: CY + sg * U(ch, 0, 4.5) };
    if (q === 'decent') return { ax: U(ch, 92, 96), ay: CY + sg * U(ch, 1, 8) };
    return { ax: U(ch, 89, 93), ay: CY + sg * U(ch, 3, 12) };
  }
  if (q === 'corner') return { ax: U(ch, 95, 99.5), ay: CY + sg * U(ch, 0, 6) };
  if (q === 'big') return { ax: U(ch, 95, 99), ay: CY + sg * U(ch, 0, 4.5) };
  if (q === 'decent') {
    if (ch.rng.next() < 0.5) return { ax: U(ch, 85.5, 88.5), ay: CY + sg * U(ch, 0, 9) };
    return { ax: U(ch, 91, 96), ay: CY + sg * U(ch, 9.5, 15) };
  }
  if (ch.rng.next() < 0.65) return { ax: U(ch, 76, 84), ay: CY + sg * U(ch, 0, 13) };
  return { ax: U(ch, 98, 102), ay: CY + sg * U(ch, 12.5, 17) };
}

/** Where the assister should have the ball before the final pass (attack frame). */
function preAssistSpot(ch, side, cross, q, spotA, Ast, through) {
  const aAy = fy(ch, side, Ast.y);
  const sg = aAy >= CY ? 1 : -1;
  let p;
  if (cross) p = { ax: U(ch, 86, 94), ay: CY + sg * U(ch, 24, 29) };
  else if (through) p = { ax: U(ch, 64, 72), ay: CY + sg * U(ch, 4, 13) };
  else if (q === 'half' && spotA.ax < 90) p = { ax: U(ch, 64, 72), ay: CY + sg * U(ch, 6, 18) };
  else p = { ax: U(ch, 73, 83), ay: CY + sg * U(ch, 9, 20) };
  if (hyp(p.ax - spotA.ax, p.ay - spotA.ay) < 9) p.ax = spotA.ax - 10;
  return p;
}

function keeperShotPoint(ch, A, from, K) {
  // the line from the ball through the keeper, extended to the goal line, clamped inside the posts
  const kA = { ax: fx(ch, A, K.x), ay: fy(ch, A, K.y) };
  const fA = { ax: fx(ch, A, from.x), ay: fy(ch, A, from.y) };
  const dx = kA.ax - fA.ax || 0.1;
  const k = (L - fA.ax) / dx;
  let gy = fA.ay + (kA.ay - fA.ay) * k;
  gy = clamp(gy + U(ch, -0.8, 0.8), CY - PITCH.goalHalf + 0.6, CY + PITCH.goalHalf - 0.6);
  return { ax: L, ay: gy };
}

/**
 * Shot task. o: { S, ev, outcome, q, kind ('open'|'header'|'freeKick'|'penalty'), nextCorner }
 */
function tShot(o) {
  return task('shot', (ch, st) => {
    const b = ch.ball;
    const S = o.S;
    const A = S.side, D = OTHER[A];
    if (st.released) return !!st.ended && !b.fl;
    if (b.fl) return false;
    if (b.owner !== S) {
      // safety net: the shooter must have the ball; a loose ball rolls to him
      if (!st.fix) {
        st.fix = true;
        if (b.owner) ch.stats.shooterFix = (ch.stats.shooterFix || 0) + 1;
        launch(ch, 'roll', lead(S, 0.2), Math.max(0.15, hyp(S.x - b.x, S.y - b.y) / 9), { onEnd: (c) => { giveBall(c, S); } });
      }
      return false;
    }
    if (st.n0 == null) {
      st.n0 = st.t;
      // the shot must come from a spot that fits its xG: if the build-up left the shooter elsewhere, he carries
      // the ball there first (open play only)
      if ((o.kind === 'open' || o.kind === 'header') && !st.moved) {
        const ax = fx(ch, A, b.x), ay = fy(ch, A, b.y);
        // an unassisted goal must not look assisted: the shooter carries it at least 8 m after a pass
        const lr = ch.lastRecv;
        const looksAssisted = o.ev.type === 'goal' && o.ev.assistId == null && lr && lr.recv === S && hyp(b.x - lr.x, b.y - lr.y) < 8;
        if (looksAssisted && !o.relocated) {
          st.moved = true;
          let best = null;
          for (let k = 0; k < 8 && !best; k++) { const sp = shotSpot(ch, A, o.q, false, S); const p = toAbs(ch, A, sp.ax, sp.ay); if (hyp(p.x - lr.x, p.y - lr.y) >= 9) best = p; }
          if (best) { front(ch, tDribble({ to: best, urg: 0.9, clear: true, maxT: 6 }), tShot({ ...o, kind: 'open', relocated: true })); return true; }
        }
        if (!shotLocationOk(o.q, null, o.kind === 'header', ax, ay)) {
          st.moved = true;
          const sp = shotSpot(ch, A, o.q, false, S);
          const to = toAbs(ch, A, sp.ax, sp.ay);
          ch.stats.shotRelocated = (ch.stats.shotRelocated || 0) + 1;
          front(ch, tDribble({ to, urg: 0.9, clear: true, maxT: 6 }), tShot({ ...o, kind: 'open', relocated: true }));
          return true;
        }
      }
    }
    if (ch.mode !== 'open' && o.kind !== 'penalty' && o.kind !== 'freeKick') { ch.mode = 'open'; ch.layout = null; }
    const from = { x: b.x, y: b.y };
    const K = keeperOf(ch.teams[D]);
    // blocked shots need a defender in the shot path
    if (o.outcome === 'blocked') {
      if (!st.blocker) {
        const ds = onPitch(ch.teams[D]).filter((d) => d.pos !== 'GK');
        const goal = toAbs(ch, A, L, CY);
        let best = null, bv = Infinity;
        for (const d of ds) {
          const r = segDist(from.x, from.y, goal.x, goal.y, d.x, d.y);
          const v = r.d + Math.abs(clamp(r.s, 2, 7) - r.s) + (r.s < 0 ? 10 : 0);
          if (v < bv) { bv = v; best = d; }
        }
        st.blocker = best;
        const gx = goal.x - from.x, gy = goal.y - from.y, gl = hyp(gx, gy) || 1;
        // the block happens inside the field, at least 1.5 m before the goal line
        const sMax = Math.max(1.2, Math.min(6, gl - 1.5 - (L - fx(ch, A, goal.x))));
        const s = clamp(best ? segDist(from.x, from.y, goal.x, goal.y, best.x, best.y).s : 3, Math.min(2.5, sMax), sMax);
        st.bp = { x: from.x + gx / gl * s, y: from.y + gy / gl * s };
      }
      const B = st.blocker;
      if (B) {
        ch.ovr.set(B.id, { x: st.bp.x, y: st.bp.y, urg: 1 });
        if (!st.hold) st.hold = { x: S.x, y: S.y };
        if (hyp(B.x - st.bp.x, B.y - st.bp.y) > 1.2 && st.t - st.n0 < 1.2) { ch.ovr.set(S.id, { x: st.hold.x, y: st.hold.y, urg: 0.2 }); return false; }
      }
    } else if (o.kind === 'penalty' || o.kind === 'freeKick') {
      if (st.t - st.n0 < 0.5) return false;
    }
    // last check at the moment of the shot: the spot must still fit the xG band
    if ((o.kind === 'open' || o.kind === 'header') && (o.reloc || 0) < 2 && !shotLocationOk(o.q, null, o.kind === 'header', fx(ch, A, from.x), fy(ch, A, from.y))) {
      const sp = shotSpot(ch, A, o.q, false, S);
      ch.ovr.delete(S.id);
      front(ch, tDribble({ to: toAbs(ch, A, sp.ax, sp.ay), urg: 0.9, clear: true, maxT: 6 }), tShot({ ...o, kind: 'open', relocated: true, reloc: (o.reloc || 0) + 1 }));
      if (st.blocker) ch.ovr.delete(st.blocker.id);
      return true;
    }
    // target by outcome
    let tA;
    const sAy = fy(ch, A, from.y);
    if (o.outcome === 'goal') {
      const kAy = K ? fy(ch, A, K.y) : CY;
      // aim at a point on the goal line between the posts, then carry on 1.3 m into the net
      let ly = kAy > CY ? U(ch, 30.9, 32.6) : U(ch, 35.4, 37.1);
      if (o.kind === 'penalty') ly = ch.rng.next() < 0.5 ? U(ch, 30.9, 32.2) : U(ch, 35.8, 37.1);
      const fA = { ax: fx(ch, A, from.x), ay: fy(ch, A, from.y) };
      const dx = L - fA.ax, dy = ly - fA.ay, dl = Math.hypot(dx, dy) || 1;
      tA = { ax: L + dx / dl * 1.3, ay: ly + dy / dl * 1.3 };
    } else if (o.outcome === 'save' && K) {
      tA = keeperShotPoint(ch, A, from, K);
    } else if (o.outcome === 'woodwork') {
      tA = { ax: L, ay: CY + (sAy >= CY ? -1 : 1) * PITCH.goalHalf * (ch.rng.next() < 0.7 ? 1 : -1) };
    } else if (o.outcome === 'blocked' && st.bp) {
      tA = { ax: fx(ch, A, st.bp.x), ay: fy(ch, A, st.bp.y) };
    } else {
      // wide of the post: aim at a point on the goal line outside the posts, then carry on 2.5 m
      const sg = ch.rng.next() < 0.5 ? 1 : -1;
      const ly = CY + sg * U(ch, 4.8, 9);
      const fA = { ax: fx(ch, A, from.x), ay: fy(ch, A, from.y) };
      const dx = L - fA.ax, dy = ly - fA.ay, dl = Math.hypot(dx, dy) || 1;
      tA = { ax: L + dx / dl * 2.5, ay: ly + dy / dl * 2.5 };
    }
    let to = toAbs(ch, A, tA.ax, tA.ay);
    const kind = o.kind === 'header' ? 'header' : 'shot';
    const sp = VIEW.speeds[kind];
    let v = lerp(sp[0], sp[1], ch.rng.next());
    if (o.outcome === 'save' && K) {
      // the ball meets the keeper on the line from the shot to the goal: he moves along it
      const gl = hyp(to.x - from.x, to.y - from.y);
      const r = segDist(from.x, from.y, to.x, to.y, K.x, K.y);
      const s = clamp(r.s, Math.max(3, gl - 9), gl - 0.4);
      to = { x: from.x + (to.x - from.x) * s / gl, y: from.y + (to.y - from.y) * s / gl };
      ch.ovr.set(K.id, { x: to.x, y: to.y, urg: 1 });
    } else if (K && (o.outcome === 'goal' || o.outcome === 'miss' || o.outcome === 'woodwork')) {
      // keeper dives late toward the ball's line
      const p = toAbs(ch, A, L - 1.2, clamp(lerp(fy(ch, A, K.y), tA.ay, 0.45), CY - 3, CY + 3));
      ch.ovr.set(K.id, { x: p.x, y: p.y, urg: 1 });
    }
    const len = hyp(to.x - from.x, to.y - from.y);
    const dur = len / v;
    // on-screen assister: last pass to the shooter if he did not then dribble 8 m or more
    let assistOnScreen = null;
    const lr = ch.lastRecv;
    if (lr && lr.recv === S && hyp(from.x - lr.x, from.y - lr.y) < 8) assistOnScreen = lr.passer.id;
    st.assistOnScreen = assistOnScreen;
    act(ch, 'shot', S, null, from, to, {
      shot: true, quality: o.q, xg: o.ev.xg, setPiece: o.ev.setPiece || null, header: kind === 'header', outcome: o.outcome,
      evPlayerId: o.ev.playerId, fromA: { x: fx(ch, A, from.x), y: fy(ch, A, from.y) },
    });
    ch.ovr.delete(S.id);
    ch.runners.delete(S.id);
    if (ch.mode === 'setpiece') { ch.mode = 'open'; ch.layout = null; ch.setPiece = null; }
    st.released = true;
    launch(ch, kind, to, dur, { onEnd: (c) => shotEnd(c, o, st) });
    return false;
  });
}

function shotEnd(ch, o, st) {
  const ev = o.ev, S = o.S, A = S.side, D = OTHER[A];
  const b = ch.ball;
  const K = keeperOf(ch.teams[D]);
  st.ended = true;
  ch.chance = null;
  switch (o.outcome) {
    case 'goal': {
      const end = toAbs(ch, A, L + 1.8, fy(ch, A, b.y));
      launch(ch, 'roll', end, 0.25, { ease: 'out' });
      ch.score[A]++;
      const g = {
        team: A, playerId: ev.playerId, assistId: ev.assistId ?? null, minute: ev.minute, addedMin: ev.addedMin || 0, half: ev.half,
        onScreenScorer: S.id, onScreenAssist: st.assistOnScreen,
      };
      ch.goals.push(g);
      ch.cues.push({ type: 'goal', goal: g, ev, t: ch.t });
      act(ch, 'goal', S, findDisc(ch, ev.assistId), b, b, { silent: true });
      setText(ch, ev.text, A);
      ch.net = { t: ch.t, x: fx(ch, A, L), y: b.y };
      ch.shake = 0.6;
      ch.mode = 'celebrate';
      break;
    }
    case 'save': {
      if (K) {
        ch.cues.push({ type: 'save', keeperId: K.id, dist: hyp(K.x - b.x, K.y - b.y), t: ch.t });
        act(ch, 'save', K, S, b, b, { silent: true });
        setText(ch, ev.text, D);
        ch.ovr.delete(K.id);
        if (o.nextCorner) {
          const side = fy(ch, A, b.y) >= CY ? 1 : -1;
          const out = toAbs(ch, A, L + 0.7, CY + side * U(ch, 13, 16));
          ch.cornerAy = side > 0 ? W : 0;
          launch(ch, 'clear', out, 0.45, { peak: 0.5 });
          ch.mode = 'dead';
        } else {
          giveBall(ch, K, true);
          ch.poss = D;
          ch.keeperHold = K;
          ch.mode = 'dead';
        }
      }
      break;
    }
    case 'blocked': {
      const B = st.blocker || nearestOf(ch, D, b.x, b.y, true);
      if (B) ch.ovr.delete(B.id);
      act(ch, 'clearance', B, S, b, b, { silent: true });
      setText(ch, ev.text, D);
      if (o.nextCorner) {
        const side = fy(ch, A, b.y) >= CY ? 1 : -1;
        ch.cornerAy = side > 0 ? W : 0;
        launch(ch, 'clear', toAbs(ch, A, L + 1.5, CY + side * U(ch, 10, 18)), 0.6, { peak: 0.6 });
        ch.mode = 'dead';
      } else if (B) {
        giveBall(ch, B);
        if (!ch.compact) ch.tasks.unshift(tClear(D));
      }
      break;
    }
    case 'woodwork': {
      act(ch, 'miss', S, null, b, b, { silent: true });
      setText(ch, ev.text, A);
      ch.cues.push({ type: 'woodwork', t: ch.t });
      const pA = { ax: U(ch, 91, 97), ay: CY + (fy(ch, A, b.y) >= CY ? 1 : -1) * U(ch, 3, 9) };
      const p = toAbs(ch, A, pA.ax, pA.ay);
      const R = nearestOf(ch, D, p.x, p.y, true);
      if (R) {
        ch.ovr.set(R.id, { x: p.x, y: p.y, urg: 1 });
        launch(ch, 'roll', p, Math.max(0.5, etaTo(R, p)), { onEnd: (c) => { c.ovr.delete(R.id); giveBall(c, R); } });
      }
      break;
    }
    default: {
      act(ch, 'miss', S, null, b, b, { silent: true });
      setText(ch, ev.text, A);
      ch.mode = 'dead';
      break;
    }
  }
}

/** Defender clears his lines: a long ball upfield to a team-mate. */
function tClear(side) {
  return task('clear', (ch, st) => {
    const b = ch.ball;
    if (b.fl) return false;
    const c = b.owner;
    if (!c || c.side !== side) return true;
    if (st.t < 0.2) return false;
    const pick = choosePass(ch, c, { minLen: 18, maxLen: 50, ignoreLegal: true, aerial: true, allowBack: false });
    if (!pick) return true;
    const sp = VIEW.speeds.clear;
    act(ch, 'clearance', c, pick.r, { x: b.x, y: b.y }, pick.R, { clear: true });
    ch.ovr.set(pick.r.id, { x: pick.R.x, y: pick.R.y, urg: 1 });
    const r = pick.r;
    launch(ch, 'clear', pick.R, Math.max(pick.d / sp[1], etaTo(r, pick.R)), { onEnd: (c2) => { c2.ovr.delete(r.id); giveBall(c2, r); } });
    front(ch, task('flight', (c2) => !c2.ball.fl));
    return true;
  });
}

function tCelebrate(S) {
  return task('celebrate', (ch, st) => {
    const A = S.side;
    if (st.n === 0) {
      ch.mode = 'celebrate';
      const sAy = fy(ch, A, S.y);
      st.flag = toAbs(ch, A, L - 2.2, sAy >= CY ? W - 2.5 : 2.5);
      ch.ovr.set(S.id, { x: st.flag.x, y: st.flag.y, urg: 1 });
      const mates = onPitch(ch.teams[A]).filter((d) => d !== S && d.pos !== 'GK')
        .sort((a, b) => hyp(a.x - S.x, a.y - S.y) - hyp(b.x - S.x, b.y - S.y)).slice(0, 3);
      mates.forEach((m, i) => {
        const ang = (i - 1) * 0.9;
        const g = dirOf(ch, A);
        ch.ovr.set(m.id, { x: clamp(st.flag.x - g * (2.6 + Math.cos(ang)), 1, L - 1), y: clamp(st.flag.y + Math.sin(ang) * 2.6 * (sAy >= CY ? -1 : 1), 1, W - 1), urg: 0.95 });
      });
    }
    if (st.hold == null && (hyp(S.x - st.flag.x, S.y - st.flag.y) < 2.2 || st.t > 2.2)) st.hold = st.t;
    return st.hold != null && st.t - st.hold >= 1.5;
  });
}

function tKickoff(side) {
  return task('kickoff', (ch, st) => {
    if (st.t < 0.5) return false;
    const tk = ch.kickTaker, mate = ch.kickMate;
    if (!tk || !mate || ch.ball.owner !== tk) { ch.mode = 'open'; ch.layout = null; return true; }
    act(ch, 'kickOff', tk, mate, ch.ball, ch.ball, { silent: true });
    front(ch, tPass({ to: mate, point: { x: mate.x + dirOf(ch, side) * 1.5, y: mate.y }, kind: 'pass', setPiece: 'kickOff', restart: true, maxWait: 0.2 }));
    return true;
  });
}

function tGoalKick(side) {
  return task('goalKick', (ch, st) => {
    if (st.t < 0.6) return false;
    const k = ch.ball.owner;
    if (!k || k.side !== side) { ch.mode = 'open'; ch.layout = null; return true; }
    act(ch, 'goalKick', k, null, ch.ball, ch.ball, { silent: false });
    front(ch, tPass({ choose: { minLen: 22, maxLen: 55, aerial: true, allowBack: true }, kind: 'goalKick', setPiece: 'goalKick', restart: true, maxWait: 0.6 }));
    return true;
  });
}

// ------------------------------------------------------------------ fouls, cards, offside, injuries, subs

function tFoulMeet(fouler, fouled, spot, kind) {
  return task('foul', (ch, st) => {
    const b = ch.ball;
    if (b.fl) return false;
    if (b.owner !== fouled) {
      if (b.owner && b.owner.side === fouled.side && st.t < 0.1) { front(ch, tPass({ to: fouled, forced: true, maxWait: 1.5 }), tFoulMeet(fouler, fouled, spot, kind)); return true; }
      if (st.t < 1) return false;
    }
    if (st.n0 == null) {
      st.n0 = st.t;
      // when the fouler is far away, meet him halfway
      const eta = etaTo(fouler, spot);
      st.meet = eta > (kind === 'fk' ? 4 : 2.5) ? { x: lerp(spot.x, fouler.x, 0.45), y: lerp(spot.y, fouler.y, 0.45) } : spot;
    }
    const c = fouled;
    ch.ovr.set(c.id, { x: st.meet.x, y: st.meet.y, urg: 0.72 });
    // the fouler waits near the spot, then goes in when his man arrives
    if (hyp(c.x - st.meet.x, c.y - st.meet.y) > 6) ch.ovr.set(fouler.id, { x: st.meet.x + Math.sin(ch.t * 1.3) * 1.5, y: st.meet.y + Math.cos(ch.t * 1.1) * 1.5, urg: 0.9 });
    else ch.ovr.set(fouler.id, { x: c.x, y: c.y, urg: 1 });
    // a back-line fouler never steps ahead of his own midfield: he holds, the attacker runs into him
    if (!canStepOut(ch, fouler, ch.ovr.get(fouler.id).x)) {
      const ml = midLineAx(ch, fouler.side);
      const o = ch.ovr.get(fouler.id);
      o.x = fx(ch, fouler.side, Math.min(fx(ch, fouler.side, o.x), ml - 2));
      ch.ovr.set(c.id, { x: fouler.x, y: fouler.y, urg: 0.75 });
    }
    const dd = hyp(fouler.x - c.x, fouler.y - c.y);
    if (dd < 1.7 || st.t > 7) {
      ch.ovr.delete(c.id); ch.ovr.delete(fouler.id);
      const at = { x: b.x, y: b.y };
      act(ch, 'foul', fouler, fouled, at, at);
      ch.chance = null;
      ch.mode = 'dead';
      ch.cues.push({ type: 'whistle', t: ch.t });
      ch.foulSpot = at;
      c.down = true; c.downUntil = ch.t + 0.9;
      c.vx *= 0.3; c.vy *= 0.3;
      return true;
    }
    return false;
  });
}

function tCard(p, kind, ev) {
  return task('card', (ch, st) => {
    if (st.n === 0) ch.mode = 'dead';
    ch.refTarget = { x: clamp(p.x + 2.5, 1, L - 1), y: clamp(p.y + (p.y < CY ? 2.5 : -2.5), 1, W - 1) };
    const ref = ch.officials[0];
    if (st.shown == null && (hyp(ref.x - p.x, ref.y - p.y) < 5 || st.t > (ch.compact ? 0.9 : 2.2))) {
      st.shown = st.t;
      if (kind === 'yellow') p.yellow++; else p.red = true;
      ch.cards.push({ team: p.side, playerId: p.id, type: kind, minute: ev.minute, addedMin: ev.addedMin || 0, half: ev.half });
      ch.cues.push({ type: 'card', kind, playerId: p.id, side: p.side, ev, t: ch.t });
      setText(ch, ev.text, p.side);
    }
    if (st.shown != null && st.t - st.shown > (ch.compact ? 0.9 : 1.1)) {
      ch.refTarget = null;
      if (kind === 'red') sendOff(ch, p);
      return true;
    }
    return false;
  });
}

function removeFromSlot(ch, p) {
  const T = ch.teams[p.side];
  if (p.slot != null && T.slots[p.slot] === p) T.slots[p.slot] = null;
  p.lastSlot = p.slot ?? p.lastSlot;
  p.slot = null;
}

function sendOff(ch, p) {
  if (ch.ball.owner === p) {
    const m = nearestOf(ch, p.side, p.x, p.y, true, new Set([p.id]));
    if (m) giveBall(ch, m, true);
  }
  ch.ovr.delete(p.id); ch.runners.delete(p.id);
  removeFromSlot(ch, p);
  p.leaving = 0.6;
  rebuildDiscs(ch);
}

/** Emergency keeper (engine rule): if the GK slot is empty, the outfielder with the highest PHY goes in goal. */
function ensureKeeper(ch, side) {
  const T = ch.teams[side];
  if (T.slots[0]) return;
  let best = null;
  for (const d of T.slots) if (d && !d.leaving && (!best || d.phy > best.phy)) best = d;
  if (!best) return;
  T.slots[best.slot] = null;
  best.slot = 0; best.lastSlot = 0; best.pos = 'GK';
  T.slots[0] = best;
  rebuildDiscs(ch);
}

function tInjury(p, ev, keep) {
  return task('injury', (ch, st) => {
    if (st.n === 0) {
      ch.mode = 'dead';
      p.injured = true; p.down = true; p.downUntil = Infinity;
      if (ch.ball.owner === p) { const m = nearestOf(ch, p.side, p.x, p.y, true, new Set([p.id])); if (m) giveBall(ch, m, true); }
      ch.cues.push({ type: 'injury', playerId: p.id, side: p.side, ev, t: ch.t });
      setText(ch, ev.text, p.side);
    }
    if (st.t < 1.8 * (ch.compact ? 0.7 : 1)) return false;
    if (!keep) {
      p.down = false;
      ch.ovr.delete(p.id);
      removeFromSlot(ch, p);
      p.leaving = 0.6;
      rebuildDiscs(ch);
      ensureKeeper(ch, p.side);
    }
    return true;
  });
}

/** Substitution (instant fade swap on the pitch). */
function doSub(ch, ev) {
  const T = ch.teams[ev.team];
  const inP = T.all.get(ev.playerId);
  const outP = ev.outId != null ? T.all.get(ev.outId) : null;
  if (!inP) return;
  let slot = null, pos = null;
  if (outP && outP.slot != null && T.slots[outP.slot] === outP) {
    slot = outP.slot; pos = { x: outP.x, y: outP.y };
    if (ch.ball.owner === outP) { const m = nearestOf(ch, outP.side, outP.x, outP.y, true, new Set([outP.id])); if (m) giveBall(ch, m, true); }
    ch.ovr.delete(outP.id); ch.runners.delete(outP.id);
    removeFromSlot(ch, outP);
    outP.leaving = 0.6;
  } else if (outP) {
    slot = outP.lastSlot;
  }
  if (inP.pos === 'GK' && !T.slots[0]) slot = 0;
  if (slot == null || T.slots[slot]) {
    slot = T.slots.findIndex((d, i) => !d && i > 0);
    if (slot < 0) return;
  }
  const fp = FORMATIONS[T.formation].slots[slot].pos;
  inP.pos = fp;
  inP.slot = slot; inP.lastSlot = slot; inP.onPitch = true; inP.leaving = 0; inP.injured = false; inP.down = false;
  T.slots[slot] = inP;
  // the substitute fades in at his slot's place in the current shape (never at a stale or upfield spot)
  {
    const f = ballFocus(ch);
    const inPoss = ch.poss === ev.team;
    const m = shapeMap(ch, ev.team, inPoss, fx(ch, ev.team, f.x), fy(ch, ev.team, f.y));
    const p = m.get(inP.id);
    if (p) pos = toAbs(ch, ev.team, p.ax, p.ay);
  }
  if (!pos) pos = { x: L / 2 + (ch.rng.next() - 0.5) * 6, y: ev.team === 'home' ? 1 : W - 1 };
  inP.x = inP.px = inP.tx = pos.x + 0.6; inP.y = inP.py = inP.ty = pos.y;
  inP.vx = inP.vy = 0;
  inP.entering = 0.4; inP.alpha = 0;
  rebuildDiscs(ch);
  ch.cues.push({ type: 'sub', inId: inP.id, outId: outP ? outP.id : null, side: ev.team, ev, t: ch.t });
}

function tOffsideSetup(A, runner, ev) {
  return task('offside', (ch, st) => {
    const b = ch.ball;
    if (b.fl) return false;
    const c = b.owner;
    if (!c || c.side !== A) { if (st.t > 3) return true; front(ch, tGain(A), tOffsideSetup(A, runner, ev)); return true; }
    if (c === runner) { front(ch, tPass({ choose: { exclude: new Set([runner.id]), allowBack: true } }), tOffsideSetup(A, runner, ev)); return true; }
    const lim = Math.max(L / 2, fx(ch, A, b.x), secondLast(ch, A));
    const tg = toAbs(ch, A, Math.min(lim + 3.5, 100), clamp(fy(ch, A, runner.y), 10, 58));
    ch.ovr.set(runner.id, { x: tg.x, y: tg.y, urg: 1 });
    keepBall(ch, c, st);
    const rax = fx(ch, A, runner.x);
    if ((isOffside(ch, A, runner) && rax > secondLast(ch, A) + 1.2) || st.t > (ch.compact ? 2.5 : 4)) {
      ch.ovr.delete(runner.id);
      front(ch, tPass({ to: runner, kind: 'longBall', allowOffside: true, offsideCall: true, maxWait: 0.8 }), tOffsideCall(A, runner, ev));
      return true;
    }
    return false;
  });
}

function tOffsideCall(A, runner, ev) {
  return task('flag', (ch, st) => {
    const b = ch.ball;
    if (b.fl) return false;
    if (st.n === 0) {
      ch.chance = null;
      ch.flag = { t: ch.t, x: b.x, side: A };
      ch.mode = 'dead';
      act(ch, 'offside', runner, null, b, b, { silent: true });
      setText(ch, ev.text, A);
      ch.cues.push({ type: 'whistle', t: ch.t });
    }
    if (st.t < (ch.compact ? 0.8 : 1.0)) return false;
    if (ch.compact) { ch.flag = null; return true; } // broadcast cut: the restart is not shown
    // indirect free kick for the defending side: the nearest defender takes it
    if (!st.taker) {
      const D = OTHER[A];
      st.taker = nearestOf(ch, D, b.x, b.y, true);
      if (!st.taker) return true;
      const tk = st.taker;
      const p = lead(tk, 0.3);
      launch(ch, 'roll', p, Math.max(0.5, etaTo(tk, p)), { onEnd: (c) => giveBall(c, tk, true) });
      return false;
    }
    if (b.owner !== st.taker) return st.t > 5;
    ch.flag = null;
    front(ch, tWait(0.4), tPass({ choose: { allowBack: true, maxLen: 30 }, setPiece: 'freeKick', restart: true }));
    return true;
  });
}

/** Short free kick restart after a foul: opponents back off 9.15 m, then a short pass. */
function tFreeKickShort(A) {
  return task('fkShort', (ch, st) => {
    const b = ch.ball;
    const c = b.owner;
    if (!c || c.side !== A) return true;
    if (st.n === 0) { ch.mode = 'dead'; c.down = false; }
    for (const o of opponentsOf(ch, A)) {
      const dd = hyp(o.x - b.x, o.y - b.y);
      if (dd < 9.6 && o.pos !== 'GK') {
        const k = 10 / (dd || 1);
        ch.ovr.set(o.id, { x: clamp(b.x + (o.x - b.x) * k, 1, L - 1), y: clamp(b.y + (o.y - b.y) * k, 1, W - 1), urg: 0.6, until: ch.t + 1.6 });
      }
    }
    if (st.t < 0.6) return false;
    front(ch, tPass({ choose: { allowBack: true, maxLen: 30 }, setPiece: 'freeKick', restart: true, maxWait: 1 }));
    return true;
  });
}

// ------------------------------------------------------------------ chance build-up (Layer 3)

function tRelay(o) {
  return task('relay', (ch, st) => {
    const b = ch.ball;
    if (b.fl) return false;
    const c = b.owner;
    const side = o.target.side;
    if (!c) return true;
    if (c.side !== side) { if ((o.depth || 0) > 1) return true; front(ch, tGain(side), tRelay({ ...o, depth: (o.depth || 0) + 1 })); return true; }
    if (c === o.target) return true;
    if (!ch.runners.has(o.target.id)) ch.runners.set(o.target.id, { x: o.point.x, y: o.point.y });
    const d = hyp(c.x - o.point.x, c.y - o.point.y);
    const passing = ch.teams[side].settings.passing;
    const left = (o.maxPasses ?? 2) + (passing === 'short' && !o.extra && (o.maxPasses ?? 2) > 1 ? 1 : 0);
    const reach = passing === 'short' ? 20 : passing === 'direct' ? 40 : 30;
    const direct = d < reach && ch.layer >= 3 && passLegal(ch, side, b, o.point, o.target, d > 30, {});
    if (left <= 1 || direct || ch.layer < 3) {
      front(ch, tPass({ to: o.target, point: o.point, forced: true, runner: true, adapt: true, maxWait: 1.4 }));
      return true;
    }
    front(ch, tPass({ choose: { toward: o.point, towardW: 0.12, exclude: new Set([o.target.id]) }, maxWait: 1 }), tRelay({ ...o, maxPasses: left - 1, extra: true }));
    return true;
  });
}

function tChanceBuild(o) {
  return task('chance', (ch, st) => {
    const { S, Ast, cross, q, ev } = o;
    const A = S.side;
    const b = ch.ball;
    if (b.fl) return false;
    const c = b.owner;
    if (!c || c.side !== A) { if ((o.depth || 0) > 1) return true; front(ch, tGain(A), tChanceBuild({ ...o, depth: (o.depth || 0) + 1 })); return true; }
    ch.chance = { shooterId: S.id, assistId: Ast ? Ast.id : null, side: A };
    const spotA = o.spotA || shotSpot(ch, A, q, cross, S);
    const spot = toAbs(ch, A, spotA.ax, spotA.ay);
    const list = [];
    ch.runners.set(S.id, { x: spot.x, y: spot.y });
    if (Ast) {
      const D = ch.teams[OTHER[A]];
      const through = !cross && q === 'big' && (D.settings.defLine === 'high' || ch.rng.next() < 0.35);
      const preA = o.preA ? { ...o.preA } : preAssistSpot(ch, A, cross, q, spotA, Ast, through);
      // the assister stays near his own zone: a deep player plays the final ball from where he is
      const aA = { ax: fx(ch, A, Ast.x), ay: fy(ch, A, Ast.y) };
      const deep = !o.short && !o.counter && (Ast.pos === 'CB' || Ast.pos === 'DM' || (Ast.pos === 'FB' && !cross));
      if (o.short) { /* highlights short form: the cut already put him at preA */ } else if (deep) { preA.ax = clamp(aA.ax + 5, 20, 75); preA.ay = clamp(aA.ay, 6, W - 6); }
      else {
        const dd = hyp(preA.ax - aA.ax, preA.ay - aA.ay);
        const lim = o.counter ? 30 : 14; // on a counter the assister sprints forward into his zone
        if (dd > lim) { preA.ax = aA.ax + (preA.ax - aA.ax) * lim / dd; preA.ay = aA.ay + (preA.ay - aA.ay) * lim / dd; }
        if (o.counter) preA.ax = Math.max(preA.ax, fx(ch, A, c.x) + 8);
      }
      if (hyp(preA.ax - spotA.ax, preA.ay - spotA.ay) < 9) preA.ax = spotA.ax - 10;
      const pre = toAbs(ch, A, preA.ax, preA.ay);
      if (o.counter && c !== Ast) { const ahead = spaceAhead(ch, c, 9); if (ahead) list.push(tDribble({ to: ahead, urg: 0.95, maxT: 1.4 })); }
      if (c !== Ast) list.push(tRelay({ target: Ast, point: pre, maxPasses: c.pos === 'GK' ? 2 : 1 }));
      if (cross && !o.short) list.push(tDribble({ to: (c2, cc) => { const ax = Math.min(fx(c2, A, cc.x) + 6, 99); return toAbs(c2, A, ax, fy(c2, A, cc.y)); }, urg: 0.8, maxT: 1.4, clear: true }));
      list.push(task('finalBall', (c2) => {
        const own = c2.ball.owner;
        if (!own || own.side !== A) return true;
        const len = hyp(spot.x - own.x, spot.y - own.y);
        const wide = Math.abs(fy(c2, A, own.y) - CY) > 18 && fx(c2, A, own.x) > 70;
        const kind = cross && wide ? 'cross' : len > 26 ? 'longBall' : 'pass';
        front(c2, tPass({ to: S, point: spot, kind, forced: true, runner: true, maxWait: o.short ? 0.6 : 1.6, quick: o.short }));
        return true;
      }));
    } else {
      const rA = { ax: spotA.ax - U(ch, 10, 15), ay: clamp(spotA.ay + U(ch, -6, 6), 6, W - 6) };
      if (rA.ax < 55) rA.ax = 55;
      const rcv = toAbs(ch, A, rA.ax, rA.ay);
      if (c !== S) list.push(tRelay({ target: S, point: rcv, maxPasses: c.pos === 'GK' ? 2 : 1 }));
      list.push(tDribble({ to: spot, urg: 0.85, clear: true, maxT: 4.5 }));
    }
    front(ch, ...list);
    return true;
  });
}

// ------------------------------------------------------------------ planners (one engine event -> tasks)

const PLAY_TYPES = new Set(['goal', 'save', 'miss', 'blocked', 'woodwork']);
const ADMIN = new Set(['sub', 'addedTime', 'halftime', 'fulltime', 'kickoff']);

function peek(ch) {
  const e = ch.evq[0];
  return e && !e.type.startsWith('_') ? e : null;
}

/** Highlights mode: which events are animated. */
/** Highlights mode: which events are animated (marked by pushBatch as ev._hl). */
function isAnimated(ev) { return !!ev._hl; }

/**
 * Highlights selection: goals, penalties, cards, injuries, kick-offs and whistles, and chances with xG >= 0.10 or
 * on target (save). A corner or a foul is shown only when what follows it is shown. Everything else is a 0.3 s
 * clock fast-forward per tick (its events still reach onEvent, so live stats stay complete).
 */
export const HIGHLIGHT_XG = 0.10;
function markHighlights(evs) {
  const shot = (e) => PLAY_TYPES.has(e.type);
  for (const e of evs) {
    if (shot(e)) e._hl = e.type === 'goal' || e.type === 'save' || (e.xg || 0) >= HIGHLIGHT_XG;
    else e._hl = ['penalty', 'yellow', 'red', 'injury', 'kickoff', 'halftime', 'fulltime'].includes(e.type);
  }
  for (let i = 0; i < evs.length; i++) {
    const e = evs[i];
    if (e.type === 'corner') {
      const nx = evs.slice(i + 1).find((x) => x.type !== 'sub');
      e._hl = !!(nx && nx.setPiece === 'corner' && nx._hl);
    } else if (e.type === 'foul') {
      let j = i + 1, anim = false;
      while (evs[j] && (evs[j].type === 'yellow' || evs[j].type === 'red') && evs[j].playerId === e.playerId) { anim = true; j++; }
      while (evs[j] && evs[j].type === 'sub') j++;
      if (evs[j] && evs[j].setPiece === 'freeKick' && evs[j]._hl) anim = true;
      e._hl = anim;
      e._anim = anim || !!(evs[j] && evs[j].setPiece === 'freeKick');
    }
  }
}

function planNext(ch) {
  const ev = ch.evq.shift();
  if (ev.type === '_batch') { beginBatch(ch, ev._info); return; }
  if (ev.type === '_skip') {
    beginBatch(ch, ev._info);
    ch.clock.rate = 3 / VIEW.highlightsSkip;
    for (const e of ev._events) {
      ch.cues.push({ type: 'event', ev: e, skipped: true, t: ch.t });
      if (e.type === 'sub') doSub(ch, e);
      if (e.text) setText(ch, e.text, e.team);
    }
    ch.needCut = true;
    ch.tasks.push(tWait(VIEW.highlightsSkip));
    return;
  }
  if (ch.half !== ev.half && ev.half != null && ev.type !== 'kickoff') ch.half = ev.half;
  // a keeper slot left empty (red card, injury) and no keeper coming on next: emergency keeper, as in the engine
  for (const k of ['home', 'away']) {
    if (ch.teams[k].slots[0]) continue;
    const gkIn = ev.type === 'sub' && ev.team === k && (ch.teams[k].all.get(ev.playerId) || {}).pos === 'GK';
    if (!gkIn) ensureKeeper(ch, k);
  }
  ch.seg = { ev, actions: [] };
  ev._seg = ch.seg;
  ch.cues.push({ type: 'event', ev, t: ch.t });
  if (ev.half != null) ch.clock.half = ev.half;
  const ec = evC(ev);
  if (ec != null && ch.batchInfo) ch.clock.c = clamp(Math.max(ch.clock.c, ec - 1), ch.batchInfo.start, ch.batchInfo.end);
  if (ch.highlights && !isAnimated(ev)) {
    if (ev.type === 'sub') doSub(ch, ev);
    if (ev.text) setText(ch, ev.text, ev.team);
    return;
  }
  const tasks = planEvent(ch, ev) || [];
  ch.tasks.push(...tasks);
}

function evC(ev) {
  if (ev.type === 'kickoff') return 0;
  if (ev.addedMin) return 45 + ev.addedMin;
  if (ev.minute == null) return null;
  return ev.minute - ((ev.half || 1) - 1) * 45;
}

function beginBatch(ch, info) {
  ch.batchInfo = info;
  if (info.half !== ch.clock.half && info.start === 0) ch.clock.c = 0;
  ch.clock.c = Math.max(Math.min(ch.clock.c, info.end), info.start);
  ch.clock.rate = 3 / VIEW.tickSeconds;
}

function cutTo(ch, A, bx, by, exclude) {
  return tFade(openLayout(ch, A, bx, by, (c) => {
    const ps = onPitch(c.teams[A]).filter((d) => d.pos !== 'GK' && !(exclude && exclude.has(d.id)));
    const pref = ps.filter((d) => d.pos === 'CM' || d.pos === 'DM' || d.pos === 'AM');
    const pool = pref.length ? pref : ps;
    return pool[Math.floor(c.rng.next() * pool.length)] || null;
  }));
}

function planEvent(ch, ev) {
  const T = (k) => ch.teams[k];
  const cut = (A, bx, by, ex) => (ch.compact ? [cutTo(ch, A, bx, by, ex)] : []);
  switch (ev.type) {
    case 'kickoff': {
      const side = ev.team;
      return [
        tFade((c) => { c.half = ev.half || 1; c.clock.half = c.half; c.clock.c = 0; kickoffLayout(c, side, true); }),
        tDead(0.8), tKickoff(side),
      ];
    }
    case 'quiet': {
      const A = ev.team;
      const pref = activeDisc(ch, ev.playerId);
      const n = ch.compact ? 2 : T(A).settings.passing === 'short' ? 3 : T(A).settings.passing === 'direct' ? 2 : (ch.rng.next() < 0.5 ? 2 : 3);
      const list = [tGain(A), tMaybeCarry(A)];
      for (let i = 0; i < n; i++) list.push(tPass({ choose: { prefer: i === 0 ? pref : null } }));
      return list;
    }
    case 'turnover': {
      const A = ev.team;
      const loser = activeDisc(ch, ev.playerId);
      return [tGain(A), tPass({ choose: { prefer: loser } }), tLose(A, loser)];
    }
    case 'foul': return planFoul(ch, ev, cut);
    case 'yellow': case 'red': {
      // a card not glued to its foul (should not happen with the engine's ordering)
      const p = activeDisc(ch, ev.playerId);
      return p ? [tCard(p, ev.type, ev)] : [];
    }
    case 'offside': {
      const A = ev.team;
      const runner = activeDisc(ch, ev.playerId);
      if (!runner) return [];
      const pre = ch.compact ? [cutTo(ch, A, U(ch, 48, 60), U(ch, 14, 54), new Set([runner.id]))] : [];
      return [...pre, tGain(A), tCall((c) => { c.chance = { side: A, shooterId: null, assistId: null }; }), tOffsideSetup(A, runner, ev)];
    }
    case 'penalty': {
      const A = ev.team, D = OTHER[A];
      const fouled = activeDisc(ch, ev.fouledId);
      const fouler = activeDisc(ch, ev.foulerId);
      setText(ch, ev.text, A);
      if (!fouled || !fouler) return [tDead(1.2)];
      const boxA = { ax: U(ch, 92, 99), ay: CY + (ch.rng.next() < 0.5 ? -1 : 1) * U(ch, 4, 14) };
      const spot = toAbs(ch, A, boxA.ax, boxA.ay);
      const edge = toAbs(ch, A, 82, boxA.ay);
      ch.chance = { shooterId: fouled.id, assistId: null, side: A };
      return [
        ...cut(A, 55, CY, new Set([fouled.id])),
        tGain(A), tRelay({ target: fouled, point: edge, maxPasses: 2 }),
        tFoulMeet(fouler, fouled, spot, 'pen'),
        tCall((c) => { c.refTarget = toAbs(c, A, L - PITCH.spot - 2, CY + 6); c.cues.push({ type: 'penaltyAwarded', side: A, t: c.t }); setText(c, ev.text, A); c.chance = null; }),
        tDead(1.2), tCall((c) => { c.refTarget = null; }),
      ];
    }
    case 'corner': {
      const A = ev.team;
      const taker = activeDisc(ch, ev.playerId);
      const nx = peek(ch);
      const shooter = nx && nx.setPiece === 'corner' ? activeDisc(ch, nx.playerId) : null;
      const flagAy = ch.cornerAy != null ? ch.cornerAy : (ch.rng.next() < 0.5 ? 0 : W);
      ch.cornerAy = null;
      let tk = taker;
      if (!tk) { const ps = onPitch(ch.teams[A]).filter((d) => d.pos !== 'GK' && d !== shooter); tk = ps.sort((a, b) => b.pas - a.pas)[0] || null; }
      if (!tk) return [];
      const taker2 = tk;
      return [
        tDead(0.5),
        tCall((c) => { act(c, 'corner', taker2, null, c.ball, c.ball, { silent: true }); setText(c, ev.text, A); }),
        tFade(cornerLayout(ch, A, taker2, shooter, flagAy)),
        tDead(0.8),
      ];
    }
    case 'goal': case 'save': case 'miss': case 'blocked': case 'woodwork':
      return planChance(ch, ev, cut);
    case 'injury': {
      const p = activeDisc(ch, ev.playerId);
      if (!p) return [];
      const nx = peek(ch);
      const keep = !!(nx && nx.type === 'sub' && nx.outId === p.id);
      return [...cut(OTHER[p.side], 50, CY, null), tInjury(p, ev, keep)];
    }
    case 'sub': return [tCall((c) => { doSub(c, ev); setText(c, ev.text, ev.team); ensureKeeper(c, ev.team); })];
    case 'addedTime': return [tCall((c) => setText(c, ev.text, null))];
    case 'halftime': return [tCall((c) => { setText(c, ev.text, null); c.cues.push({ type: 'halftime', t: c.t }); c.cues.push({ type: 'whistle', t: c.t }); }), tDead(1.6)];
    case 'fulltime': return [tCall((c) => { setText(c, ev.text, null); c.cues.push({ type: 'whistle', t: c.t }); }), tDead(1.6), tCall((c) => { c.finished = true; c.cues.push({ type: 'fulltime', t: c.t }); })];
    default: return [];
  }
}

/** CB steps up with the ball if unpressed (Layer 2 role, Layer 3 action). */
function tMaybeCarry(A) {
  return task('carry', (ch) => {
    const c = ch.ball.owner;
    if (!c || c.side !== A || ch.layer < 2) return true;
    if (c.pos !== 'CB' && c.pos !== 'DM' && !(c.dri >= 72 && ch.rng.next() < 0.5)) return true;
    const to = spaceAhead(ch, c, c.pos === 'CB' ? 8 : 7);
    if (!to) return true;
    front(ch, tDribble({ to, urg: 0.7, maxT: 2 }));
    return true;
  });
}

function planFoul(ch, ev, cut) {
  const D = ev.team, A = OTHER[D];
  const fouler = activeDisc(ch, ev.playerId);
  const fouled = activeDisc(ch, ev.fouledId);
  // cards for this fouler that follow, then maybe a direct free-kick shot
  const cards = [];
  while (peek(ch) && (peek(ch).type === 'yellow' || peek(ch).type === 'red') && peek(ch).playerId === ev.playerId) {
    const ce = ch.evq.shift();
    ch.cues.push({ type: 'event', ev: ce, t: ch.t, glued: true });
    cards.push(ce);
  }
  let nx = null;
  for (const e of ch.evq) { if (e.type.startsWith('_')) break; if (e.type === 'sub') continue; nx = e; break; }
  const fk = nx && nx.setPiece === 'freeKick' && nx.team === A ? nx : null;
  if (!fouler || !fouled) return cards.map((ce) => { const p = activeDisc(ch, ce.playerId); return p ? tCard(p, ce.type, ce) : tWait(0.1); });
  let spotA;
  if (fk) spotA = { ax: U(ch, 75, 83), ay: clamp(fy(ch, A, fouled.y), 18, 50) };
  else {
    const hint = ev.actions && ev.actions[1] ? ev.actions[1].to : null;
    const hA = hint ? fx(ch, A, hint.x) : 50;
    spotA = { ax: hA >= 66 ? clamp(fx(ch, A, fouler.x), 66, 88) : clamp(lerp(fx(ch, A, fouled.x), fx(ch, A, fouler.x), 0.5), 30, 66), ay: clamp(lerp(fy(ch, A, fouled.y), fy(ch, A, fouler.y), 0.5), 6, 62) };
    // a back-line fouler stays behind his own midfield: the foul happens in his zone
    const TD = ch.teams[D];
    if (fouler.pos === 'CB' || (fouler.pos === 'FB' && TD.anchors[fouler.slot] && TD.anchors[fouler.slot].line === 'def')) {
      const ml = midLineAx(ch, D);
      const fA = L - fx(ch, D, fouler.x); // fouler in A's frame
      spotA.ax = clamp(fA + 2, 20, 95);
      if (ml != null) spotA.ax = Math.max(spotA.ax, L - (ml - 3));
      spotA.ay = clamp(fy(ch, A, fouler.y), 6, 62);
    }
  }
  // a fouled back-line player is caught in his own zone, behind his midfield
  const TA = ch.teams[A];
  if (!fk && (fouled.pos === 'CB' || (fouled.pos === 'FB' && TA.anchors[fouled.slot] && TA.anchors[fouled.slot].line === 'def'))) {
    const ml = midLineAx(ch, A);
    if (ml != null) spotA.ax = Math.min(spotA.ax, Math.max(20, ml - 4));
  }
  const spot = toAbs(ch, A, spotA.ax, spotA.ay);
  const near = toAbs(ch, A, Math.max(spotA.ax - 7, 8), spotA.ay);
  const list = [];
  if (ch.compact) {
    // highlights: cut to the fouled player on the ball a few metres from the spot, the fouler closing in
    const backFouled = fouled.pos === 'CB' || (fouled.pos === 'FB' && ch.teams[A].anchors[fouled.slot] && ch.teams[A].anchors[fouled.slot].line === 'def');
    const cA = { ax: clamp(spotA.ax - (backFouled ? 2 : 7), 25, 95), ay: spotA.ay };
    list.push(tFade((c) => {
      openLayout(c, A, cA.ax, cA.ay, () => fouled)(c);
      const p = toAbs(c, D, clamp(L - spotA.ax - 2, 3, 100), W - spotA.ay);
      fouler.x = fouler.px = fouler.tx = p.x; fouler.y = fouler.py = fouler.ty = p.y; fouler.vx = fouler.vy = 0;
    }));
  }
  if (!ch.compact && ((ch.ball.owner && ch.ball.owner.side !== A) || hyp(ch.ball.x - near.x, ch.ball.y - near.y) > 35)) list.push(tFade((c) => openLayout(c, A, clamp(spotA.ax - 9, 25, 95), spotA.ay, () => fouled)(c)));
  list.push(tGain(A));
  list.push(tCall((c) => { c.chance = { side: A, shooterId: null, assistId: null }; }));
  list.push(tRelay({ target: fouled, point: near, maxPasses: 1 }));
  list.push(tFoulMeet(fouler, fouled, spot, fk ? 'fk' : 'open'));
  list.push(tCall((c) => setText(c, ev.text, D)));
  list.push(tDead(0.5));
  for (const ce of cards) { const p = activeDisc(ch, ce.playerId); if (p) list.push(tCard(p, ce.type, ce)); }
  if (fk) list.push(tCall((c) => { c.fkSpot = { ...spotA }; }));
  else if (!ch.compact) list.push(tFreeKickShort(A));
  return list;
}

function planChance(ch, ev, cut) {
  const A = ev.team;
  const S = activeDisc(ch, ev.playerId);
  if (!S) return [];
  const sp = ev.setPiece || null;
  const q = sp === 'penalty' ? 'penalty' : sp === 'corner' ? 'corner' : sp === 'freeKick' ? 'freeKick' : QUAL_BY_XG(ev.xg);
  const nx = peek(ch);
  const nextCorner = !!(nx && nx.type === 'corner' && nx.team === A);
  const outcome = ev.type;
  const base = { S, ev, outcome, q, nextCorner };
  const list = [];
  if (sp === 'penalty') {
    list.push(tFade(penaltyLayout(ch, A, S)), tDead(1.0), tShot({ ...base, kind: 'penalty' }));
  } else if (sp === 'freeKick') {
    const spotA = ch.fkSpot || { ax: U(ch, 75, 83), ay: U(ch, 20, 48) };
    ch.fkSpot = null;
    list.push(tFade(freeKickLayout(ch, A, S, spotA)), tDead(1.0), tShot({ ...base, kind: 'freeKick' }));
  } else if (sp === 'corner') {
    const taker = activeDisc(ch, ev.assistId ?? ev.creatorId) || null;
    const spotA = shotSpot(ch, A, 'corner', false, S);
    list.push(task('cornerKick', (c, st) => {
      const tk = c.ball.owner;
      if (!tk || tk.side !== A) return true;
      const spot = toAbs(c, A, spotA.ax, spotA.ay);
      c.ovr.set(S.id, { x: spot.x, y: spot.y, urg: 0.9 });
      front(c, tPass({ to: S, point: spot, kind: 'cross', forced: true, setPiece: 'corner', restart: true, maxWait: 0.4 }));
      return true;
    }));
    if (taker == null) { /* the layout's taker kicks it */ }
    list.push(tShot({ ...base, kind: 'header' }));
  } else {
    const astId = ev.assistId ?? ev.creatorId ?? null;
    let Ast = astId != null ? activeDisc(ch, astId) : null;
    if (Ast && (Ast === S || Ast.side !== A || Ast.pos === 'GK')) Ast = null;
    const cross = !!Ast && (ev.actions || []).some((a) => a.type === 'cross');
    const spotA = shotSpot(ch, A, q, cross, S);
    const o = { S, Ast, cross, q, ev, spotA };
    // counter-attack: the opponent has the ball in midfield, the chance comes straight from winning it back
    // (played continuously: tackle or interception, then a quick break); full mode any chance, highlights only
    // goals and big chances, and only while the pace budget allows it
    const bo0 = ch.ball.owner;
    const el0 = (ch.clock.half - 1) * 45 + ch.clock.c;
    const counter = ch.compact && bo0 && bo0.side !== A && bo0.pos !== 'GK' && ch.mode === 'open'
      && fx(ch, A, ch.ball.x) >= 40 && fx(ch, A, ch.ball.x) <= 80
      && (ch.highlights ? (outcome === 'goal' || q === 'big') && ch.t / Math.max(12, el0) < 1.0 : ch.t / Math.max(12, el0) < 2.0);
    if (counter) o.counter = true;
    if (ch.compact && !counter) {
      // highlights start a few seconds before the shot: cut to the assister on the ball, shooter ready to run
      const through = !cross && q === 'big' && ch.rng.next() < 0.4;
      // short form (2-3 steps, about 2-3 s) for every chance that is not a goal or a big chance
      // pace budget: about 1 s of highlights per match minute; behind budget, big chances go short too
      const elapsed = (ch.clock.half - 1) * 45 + ch.clock.c;
      const hurry = ch.t / Math.max(12, elapsed) > (ch.highlights ? 1.1 : 2.0);
      o.short = (outcome !== 'goal' && q !== 'big') || hurry;
      // a low-xG effort (or any non-goal when behind budget) is shown as the shooter's own touch and shot
      if (o.short && outcome !== 'goal' && (hurry || (ev.xg || 0) < HIGHLIGHT_XG)) { o.Ast = null; o.cross = false; }
      const sg = spotA.ay >= CY ? 1 : -1;
      if (o.short) {
        if (o.Ast && o.cross) o.preA = { ax: clamp(spotA.ax - 6, 82, 97), ay: CY + sg * U(ch, 20, 25) };
        else if (o.Ast) o.preA = { ax: spotA.ax - U(ch, 10, 13), ay: clamp(spotA.ay + U(ch, -5, 5), 8, W - 8) };
        else o.preA = { ax: spotA.ax - (outcome === 'goal' ? U(ch, 9, 11) : U(ch, 4, 6)), ay: clamp(spotA.ay + U(ch, -3, 3), 6, W - 6) };
      } else o.preA = Ast ? preAssistSpot(ch, A, cross, q, spotA, Ast, through) : { ax: Math.max(55, spotA.ax - U(ch, 12, 17)), ay: clamp(spotA.ay + U(ch, -6, 6), 6, W - 6) };
      list.push(tFade(chanceCut(ch, A, S, o.Ast, spotA, o.preA)));
    } else {
      // full mode: the shooter starts his run as soon as the chance is on.
      // full mode: if the opponent has the ball deep in our half, cut (a tick spans three minutes) to our
      // midfielder on the ball in the middle third and play the whole chain from there
      const bo = ch.ball.owner;
      const far = (bo && bo.side !== A && fx(ch, A, ch.ball.x) < 35) || ch.ball.x < 0 || ch.ball.x > L;
      if (far) list.push(cutTo(ch, A, U(ch, 44, 54), U(ch, 18, 50), new Set(Ast ? [S.id, Ast.id] : [S.id])));
      list.push(tCall((c) => { const p = toAbs(c, A, spotA.ax, spotA.ay); c.runners.set(S.id, p); }));
    }
    list.push(tGain(A), tChanceBuild(o), tShot({ ...base, kind: o.cross ? 'header' : 'open' }));
  }
  // what happens after the shot
  if (outcome === 'goal') {
    const D = OTHER[A];
    if (ch.compact) list.push(tCelebrate(S), tFade((c) => kickoffLayout(c, D, true)), tDead(0.3));
    else list.push(tCelebrate(S), tFade((c) => kickoffLayout(c, D, true)), tDead(0.6), tKickoff(D));
  } else if (outcome === 'save' && !nextCorner) {
    if (!ch.compact) list.push(tKeeperDistribute(OTHER[A]));
    else list.push(tDead(0.6));
  } else if (outcome === 'miss') {
    if (!ch.compact) list.push(tDead(0.5), tFade(goalKickLayout(ch, OTHER[A])), tGoalKick(OTHER[A]));
    else list.push(tDead(0.6));
  } else if (nextCorner) {
    list.push(task('settle', (c) => !c.ball.fl));
  } else {
    list.push(task('settle', (c) => !c.ball.fl));
  }
  return list;
}

// ------------------------------------------------------------------ clock, tallies

function updateClock(ch) {
  const ck = ch.clock;
  const info = ch.batchInfo;
  if (!info) return;
  if (ch.mode === 'celebrate' || ch.fade.phase) return;
  ck.c = Math.min(info.end, ck.c + ck.rate * STEP);
}

function tally(ch) {
  if (ch.mode === 'open' && ch.poss) ch.possTime[ch.poss] += STEP;
  const target = ch.poss === 'home' ? 1 : ch.poss === 'away' ? -1 : 0;
  ch.momentum = clamp(ch.momentum + (target - ch.momentum) * STEP * 0.15, -1, 1);
  for (const d of ch.discs) if (d.down && ch.t > (d.downUntil ?? 0)) d.down = false;
  if (ch.shake > 0) ch.shake = Math.max(0, ch.shake - STEP);
  if (ch.flag && ch.t - ch.flag.t > 2.5) ch.flag = null;
}

// ------------------------------------------------------------------ public API

function stepOnce(ch) {
  if ((ch.prevMode === 'setpiece' && ch.mode !== 'setpiece') || (ch.prevSP && !ch.setPiece)) ch.spEnd = ch.t;
  ch.prevSP = ch.setPiece;
  ch.prevMode = ch.mode;
  runTasks(ch);
  computeTargets(ch);
  moveDiscs(ch);
  updateBall(ch);
  moveOfficials(ch);
  updateFade(ch);
  updateClock(ch);
  tally(ch);
  ch.t += STEP;
}

/**
 * Advance the choreography by dt seconds of animation time (dt already multiplied by the match speed).
 * Runs whole 20 ms steps; the remainder is kept for the next call. Returns the cues emitted.
 */
export function advance(ch, dt) {
  ch.cues = [];
  ch.acc += Math.max(0, dt || 0);
  let n = 0;
  while (ch.acc >= STEP - 1e-9 && n < 5000) { ch.acc -= STEP; stepOnce(ch); n++; }
  return ch.cues;
}

/** Interpolation factor between the previous and the current step, for smooth rendering. */
export function frameAlpha(ch) { return clamp(ch.acc / STEP, 0, 1); }

/** Every queued event has been played: the caller feeds the next tick (or the match is over). */
export function isIdle(ch) { return !ch.task && !ch.tasks.length && !ch.evq.length; }

/** Clock range of a tick, in minutes of the half (added time continues past 45). */
function batchInfo(events) {
  let half = 1, start = null;
  for (const e of events) {
    if (e.half) half = e.half;
    if (e.type === 'kickoff') { start = 0; break; }
    if (ADMIN.has(e.type)) continue;
    const c = evC(e);
    if (c != null) { start = Math.max(0, Math.floor((c - 1) / 3) * 3); break; }
  }
  if (start == null) {
    const e = events.find((x) => x.minute != null);
    start = e ? Math.max(0, Math.floor((evC(e) - 1) / 3) * 3) : 0;
  }
  return { half, start, end: start + 3 };
}

/**
 * Queue the events of one engine tick. Call when isIdle(ch). Events keep their engine order.
 * @param {import('./cards.js').MatchEvent[]} events
 */
export function pushBatch(ch, events) {
  const evs = (events || []).filter(Boolean);
  if (!evs.length) return;
  markHighlights(evs);
  const info = batchInfo(evs);
  const animated = evs.some((e) => isAnimated(e));
  if (ch.highlights && !animated) ch.evq.push({ type: '_skip', _events: evs, _info: info });
  else { ch.evq.push({ type: '_batch', _info: info }); for (const e of evs) ch.evq.push(e); }
}

/** Split a flat event log into ticks (same grouping as successive stepTick() calls). */
export function groupBatches(events) {
  const out = [];
  let cur = null, key = null;
  for (const e of events) {
    let k;
    if (e.type === 'kickoff') k = `${e.half || 1}:0`;
    else if (e.type === 'halftime' || e.type === 'fulltime' || e.type === 'addedTime') k = key;
    else {
      const c = evC(e);
      k = c == null ? key : `${e.half || 1}:${Math.max(0, Math.floor((c - 1) / 3))}`;
      if (e.type === 'sub' && key && cur && cur.length) {
        // subs carry the minute of the end of their tick, they stay with it
        const kc = Number(String(key).split(':')[1]);
        const sc = Math.max(0, Math.floor((c - 1) / 3));
        if (String(key).split(':')[0] === String(e.half || 1) && sc - kc <= 1) k = key;
      }
    }
    if (!cur || k !== key) { cur = []; out.push(cur); key = k; }
    cur.push(e);
  }
  return out;
}

export function setHighlights(ch, on) { ch.highlights = !!on; }

/**
 * Apply an event outside the tick flow (a manager decision during the match, e.g. a substitution returned by
 * applyDecision). Subs swap the discs at once (fade); other types only update the commentary.
 */
export function applyNow(ch, ev) {
  if (!ev) return;
  ch.cues.push({ type: 'event', ev, t: ch.t, decision: true });
  if (ev.type === 'sub') { doSub(ch, ev); ensureKeeper(ch, ev.team); }
  if (ev.text) setText(ch, ev.text, ev.team);
}

/** Live tactic change (mentality, settings) for the shape. */
export function setTeamSettings(ch, side, settings) {
  const T = ch.teams[side];
  T.settings = normSettings({ ...T.settings, ...settings });
  buildAnchors(T);
}

/** Display minute label, e.g. "37'" or "45+2'". */
export function clockLabel(ch) {
  const ck = ch.clock;
  const base = (ck.half - 1) * 45;
  const c = Math.floor(ck.c);
  if (c <= 45) return `${base + c}'`;
  return `${base + 45}+${c - 45}'`;
}

/** Plain snapshot for state() hooks and tests. */
export function snapshot(ch) {
  return {
    t: r1(ch.t), half: ch.half, clock: clockLabel(ch), score: { ...ch.score }, mode: ch.mode, poss: ch.poss,
    ball: { x: r1(ch.ball.x), y: r1(ch.ball.y), owner: ch.ball.owner ? ch.ball.owner.id : null },
    players: ch.discs.map((d) => ({ id: d.id, side: d.side, pos: d.pos, number: d.number, x: r1(d.x), y: r1(d.y) })),
    goals: ch.goals.slice(), text: ch.text, finished: ch.finished,
  };
}

export { onPitch, dirOf, fx, fy, toAbs, secondLast, keeperOf };
