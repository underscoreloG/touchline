// Headless check of the 2D match view choreography (PROMPT "How to verify it").
//   node tools/sim.js --viz-check [--n 200] [--layer 1|2|3] [--highlights] [--seed0 1]
//   node tools/viz-check.js       (same options)
// Replays N seeded matches: the engine plays each tick (stepTick, full mode), the choreography animates it
// exactly as the view does (fixed 20 ms steps), and every "never allowed" rule is counted. Shape metrics are
// sampled every 100 ms of animation time in open play.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { makeTeam } from './sim.js';
import { createMatch, stepTick } from '../src/logic/matchEngine.js';
import { rngFrom } from '../src/logic/rng.js';
import { TACTIC_OPTIONS } from '../src/balance.js';
import * as C from '../src/logic/choreography.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const { L, W } = C.PITCH;
const CY = W / 2;
const STEP = C.VIEW.stepDt;

const QUAL_BY_XG = (xg) => (xg >= 0.25 ? 'big' : xg >= 0.09 ? 'decent' : 'half');

const shotLocationOk = C.shotLocationOk;

function teamsFor(seed) {
  const r = rngFrom(seed * 7919 + 13);
  const home = makeTeam(seed * 2 + 1, { rating: r.float(64, 76), chem: r.int(8, 26), isHome: true, id: 'Home' });
  const away = makeTeam(seed * 2 + 2, { rating: r.float(64, 76), chem: r.int(8, 26), isHome: false, id: 'Away' });
  // vary the free settings so every option shows up in the metrics (the engine still decides the result)
  for (const t of [home, away]) {
    const s = {};
    for (const k in TACTIC_OPTIONS) s[k] = r.pick(TACTIC_OPTIONS[k]);
    t.settings = s;
  }
  home.colours = ['#1f6feb', '#ffffff']; away.colours = ['#d73a49', '#111111'];
  return { home, away };
}

function newTotals() {
  return {
    matches: 0, simSeconds: 0, steps: 0, ms: 0, maxStepMs: 0,
    v: {
      illegalPass: 0, offsidePass: 0, wrongScorer: 0, wrongAssister: 0, wrongLocation: 0, goalNotBetweenPosts: 0,
      nonGoalBetweenPosts: 0, saveFar: 0, scoreMismatch: 0, minuteMismatch: 0,
      standingStill: 0, swarm: 0, defenderAhead: 0, defenderAheadAfterAttack: 0, keeperOutside: 0, strikerOwnBox: 0, teammatesClose: 0,
      outOfBounds: 0, speedCap: 0, ballFloating: 0,
    },
    passes: 0, forward: 0, passLen: { short: [0, 0], mixed: [0, 0], direct: [0, 0] }, shots: 0, goals: 0,
    shape: { inDepth: [0, 0], outDepth: [0, 0], inWidth: [0, 0], outWidth: [0, 0], lineSpreadOut: [0, 0], lineSpreadIn: [0, 0] },
    actionsPerEvent: { ok: 0, n: 0 }, blockedWaits: 0, examples: {},
  };
}

const add = (a, v) => { a[0] += v; a[1]++; };
const avg = (a) => (a[1] ? a[0] / a[1] : 0);

/** Episode counter: a condition that must not hold for longer than `limit` seconds. */
function episodes() {
  const m = new Map();
  return {
    tick(key, on, now, limit) {
      const e = m.get(key);
      if (on) {
        if (!e) { m.set(key, { start: now, counted: false }); return false; }
        if (!e.counted && now - e.start > limit) { e.counted = true; return true; }
        return false;
      }
      if (e) m.delete(key);
      return false;
    },
  };
}

let CUR = null;
function example(tot, key, info) {
  if (!tot.examples[key]) tot.examples[key] = [];
  if (tot.examples[key].length < 6) {
    if (CUR) { const b = CUR.ball; info.ctx = `${CUR.mode} task=${CUR.task ? CUR.task.name : '-'} poss=${CUR.poss} ball=(${b.x.toFixed(1)},${b.y.toFixed(1)}) half=${CUR.half} owner=${b.owner ? b.owner.side + b.owner.pos : '-'}`; }
    tot.examples[key].push(info);
  }
}

export function runOne(seed, opts, tot) {
  const { home, away } = teamsFor(seed);
  const match = createMatch(home, away, seed, { autoSubs: true });
  const ch = C.createChoreo({ home, away, seed, layer: opts.layer, highlights: opts.highlights, recordSnaps: true });
  CUR = ch;
  const engineGoals = [];
  const ep = episodes();
  const v = tot.v;
  let sampleT = 0;
  let curShot = null;
  let setPieceEnd = -9;
  const passingOf = { home: home.settings.passing, away: away.settings.passing };
  const lastPos = new Map();
  const involved = new Map(); // player id -> time he last shot or played the ball before a shot
  let lastPasserId = null;
  let guard = 0;
  const t0 = performance.now();
  while (guard++ < 400000) {
    if (C.isIdle(ch)) {
      if (match.phase === 'finished') break;
      const evs = stepTick(match);
      for (const e of evs) if (e.type === 'goal') engineGoals.push(e);
      C.pushBatch(ch, evs);
    }
    const s0 = performance.now();
    const cues = C.advance(ch, STEP);
    const sm = performance.now() - s0;
    tot.steps++; if (sm > tot.maxStepMs) tot.maxStepMs = sm;
    const now = ch.t;
    const open = ch.mode === 'open' && !ch.fade.phase;
    if (ch.mode === 'setpiece') setPieceEnd = now;

    // ---- per-step checks: speed cap (outside faded resets), bounds
    const faded = !!ch.fade.phase || (ch.fade.resetAt != null && now - ch.fade.resetAt < 0.05);
    for (const d of ch.discs) {
      const lp = lastPos.get(d);
      if (lp && !faded && !d.leaving && !d.entering && d.onPitch) {
        const sp = Math.hypot(d.x - lp.x, d.y - lp.y) / STEP;
        if (sp > d.vmax * 1.01 + 0.05) { v.speedCap++; example(tot, 'speedCap', { seed, t: now, id: d.id, sp: sp.toFixed(2), vmax: d.vmax.toFixed(2) }); }
      }
      lastPos.set(d, { x: d.x, y: d.y });
      if (d.onPitch && !d.leaving && (d.x < -2 || d.x > L + 2 || d.y < -2 || d.y > W + 2)) { if (ep.tick(`oob${d.id}`, true, now, 0)) { v.outOfBounds++; example(tot, 'outOfBounds', { seed, t: now, pos: d.pos, x: d.x.toFixed(1), y: d.y.toFixed(1), tx: d.tx.toFixed(1), ty: d.ty.toFixed(1), ovr: ch.ovr.has(d.id), mode: ch.mode, task: ch.task && ch.task.name }); } }
      else ep.tick(`oob${d.id}`, false, now, 0);
    }

    // ---- cues: passes, shots, goals, saves
    for (const c of cues) {
      if (c.type === 'action' && c.pass) lastPasserId = c.a.playerId;
      if (c.type === 'action' && c.pass && !c.intercepted && c.snap) {
        tot.passes++;
        const a = c.a;
        const side = c.side;
        const g = C.dirOf(ch, side);
        const ax = (x) => (g > 0 ? x : L - x);
        const from = c.snap.ball;
        const aerial = !!c.aerial;
        const block = C.laneBlocker(from, c.snap.to || a.to, c.snap.opp, aerial);
        if (block) { v.illegalPass++; example(tot, 'illegalPass', { seed, t: a.t, type: a.type, known: c.knownIllegal, task: c.snap.task, chance: !!(ch.chance), seg: ch.seg && ch.seg.ev.type, sp: c.setPiece, from: a.from, to: a.to, block: { x: +block.x.toFixed(1), y: +block.y.toFixed(1) } }); }
        if (!c.allowOffside && c.snap.recv) {
          const xs = c.snap.opp.map((o) => ax(o.x)).sort((p, q) => q - p);
          const second = xs.length > 1 ? xs[1] : xs[0];
          if (C.offsideAt(ax(c.snap.recv.x), ax(from.x), second)) { v.offsidePass++; example(tot, 'offsidePass', { seed, t: a.t, type: a.type, recvAx: ax(c.snap.recv.x).toFixed(1), second: second.toFixed(1) }); }
        }
        if (!c.setPiece && (a.type === 'pass' || a.type === 'longBall')) {
          const len = Math.hypot(a.to.x - a.from.x, a.to.y - a.from.y);
          add(tot.passLen[passingOf[side]], len);
          if (ax(a.to.x) - ax(a.from.x) > 0) tot.forward++;
        }
      }
      if (c.type === 'action' && c.shot) {
        tot.shots++;
        const q = c.quality === 'penalty' || c.quality === 'corner' || c.quality === 'freeKick' ? c.quality : QUAL_BY_XG(c.xg);
        const ok = shotLocationOk(q, c.setPiece, c.header, c.fromA.x, c.fromA.y);
        if (!ok) { v.wrongLocation++; example(tot, 'wrongLocation', { seed, t: c.a.t, q, sp: c.setPiece, header: c.header, ax: c.fromA.x.toFixed(1), ay: c.fromA.y.toFixed(1) }); }
        if (c.a.playerId !== c.evPlayerId) v.wrongScorer++;
        curShot = { outcome: c.outcome, side: c.side, cross: [] };
        involved.set(c.a.playerId, now); if (lastPasserId != null) involved.set(lastPasserId, now);
      }
      if (c.type === 'lineCross' && curShot) curShot.cross.push(c);
      if (c.type === 'goal') {
        tot.goals++;
        const g = c.goal;
        if (g.onScreenScorer !== g.playerId) { v.wrongScorer++; example(tot, 'wrongScorer', { seed, g }); }
        if ((g.onScreenAssist ?? null) !== (g.assistId ?? null)) { v.wrongAssister++; example(tot, 'wrongAssister', { seed, t: now, onScreen: g.onScreenAssist, engine: g.assistId }); }
        const gx = C.dirOf(ch, g.team) > 0 ? L : 0;
        const okCross = curShot && curShot.cross.some((x) => x.x === gx && Math.abs(x.y - CY) < C.PITCH.goalHalf);
        if (!okCross) { v.goalNotBetweenPosts++; example(tot, 'goalNotBetweenPosts', { seed, t: now, cross: curShot && curShot.cross }); }
      }
      if (c.type === 'save' && c.dist > 2.5) { v.saveFar++; example(tot, 'saveFar', { seed, t: now, dist: c.dist.toFixed(2) }); }
    }
    if (curShot && curShot.outcome !== 'goal') {
      for (const x of curShot.cross) if (Math.abs(x.y - CY) < C.PITCH.goalHalf) { v.nonGoalBetweenPosts++; example(tot, 'nonGoalBetweenPosts', { seed, t: now, outcome: curShot.outcome, y: x.y }); }
      curShot.cross.length = 0;
    }

    // ---- sampled checks every 100 ms
    if (now - sampleT < 0.1 - 1e-9) continue;
    sampleT = now;
    const b = ch.ball;
    if (open && !b.owner && !b.fl) { if (ep.tick('ballfree', true, now, 0.2)) { v.ballFloating++; example(tot, 'ballFloating', { seed, t: now }); } }
    else ep.tick('ballfree', false, now, 0);
    // corners and free kicks excepted: players get 4 s to recover their positions after a set piece
    const afterSP = now - setPieceEnd < 4;
    const flightRecv = b.fl ? b.fl.recv : null;
    for (const side of ['home', 'away']) {
      const T = ch.teams[side];
      const g = C.dirOf(ch, side);
      const ax = (x) => (g > 0 ? x : L - x);
      const ps = C.onPitch(T);
      const inPoss = ch.poss === side;
      // shape metrics (open play, no transition running)
      if (open && !(ch.transition && now < ch.transition.until)) {
        const of = ps.filter((d) => d.pos !== 'GK');
        if (of.length >= 8) {
          let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
          for (const d of of) { const a = ax(d.x); x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, d.y); y1 = Math.max(y1, d.y); }
          add(inPoss ? tot.shape.inDepth : tot.shape.outDepth, x1 - x0);
          add(inPoss ? tot.shape.inWidth : tot.shape.outWidth, y1 - y0);
          const line = ps.filter((d) => T.anchors[d.slot] && T.anchors[d.slot].line === 'def');
          if (line.length >= 3) {
            let l0 = Infinity, l1 = -Infinity;
            for (const d of line) { const a = ax(d.x); l0 = Math.min(l0, a); l1 = Math.max(l1, a); }
            add(inPoss ? tot.shape.lineSpreadIn : tot.shape.lineSpreadOut, l1 - l0);
          }
        }
      }
      // midfield line for the defender rule
      let ms = 0, mn = 0;
      for (const d of ps) if (d.pos === 'DM' || d.pos === 'CM' || d.pos === 'AM') { ms += ax(d.x); mn++; }
      const mid = mn ? ms / mn : null;
      for (const d of ps) {
        const a = ax(d.x), dy = Math.abs(d.y - CY);
        // standing still in open play
        const sp = Math.hypot(d.vx, d.vy);
        if (ep.tick(`still${d.id}`, open && sp < 0.25 && !d.down && !d.injured && d !== flightRecv, now, 2)) { v.standingStill++; example(tot, 'standingStill', { seed, t: now, side, pos: d.pos + d.number, ovr: ch.ovr.has(d.id), carrier: b.owner === d, x: d.x.toFixed(1), y: d.y.toFixed(1), tx: d.tx.toFixed(1), ty: d.ty.toFixed(1) }); }
        if (d.pos === 'GK') {
          if (ep.tick(`gk${d.id}`, open && (a > C.PITCH.boxDepth || dy > C.PITCH.boxHalf), now, 0.3)) { v.keeperOutside++; example(tot, 'keeperOutside', { seed, t: now, ax: a.toFixed(1) }); }
          continue;
        }
        const isDef = d.pos === 'CB' || (d.pos === 'FB' && T.anchors[d.slot] && T.anchors[d.slot].line === 'def' && !inPoss);
        // transition window: a defender caught upfield when the ball is lost is sprinting back (PROMPT Layer 1)
        const recovering = ch.transition && now < ch.transition.until && ch.transition.side !== side;
        // after a corner or free kick a centre-back needs ~6 s to sprint back from the opponent's box
        const spGrace = now - setPieceEnd < 6;
        const bad = open && !spGrace && !recovering && isDef && mid != null && a > mid + 1;
        // a defender who just took part in the attack (shot or final pass) is counted apart: he is running back
        const justAttacked = (involved.has(d.id) && now - involved.get(d.id) < 8) || ch.runners.has(d.id) || (ch.chance && (ch.chance.shooterId === d.id || ch.chance.assistId === d.id));
        if (ep.tick(`dfa${d.id}`, bad && justAttacked, now, 0.5)) v.defenderAheadAfterAttack++;
        if (ep.tick(`def${d.id}`, bad && !justAttacked, now, 0.5)) { v.defenderAhead++; example(tot, 'defenderAhead', { seed, t: now, side, pos: d.pos, num: d.number, ax: a.toFixed(1), mid: mid.toFixed(1), ovr: ch.ovr.has(d.id) }); }
        if (ep.tick(`st${d.id}`, open && !afterSP && d.pos === 'ST' && a < C.PITCH.boxDepth && dy < C.PITCH.boxHalf, now, 0.3)) { v.strikerOwnBox++; example(tot, 'strikerOwnBox', { seed, t: now }); }
      }
      // team-mates within 3 m for more than 1 s (outside set pieces and celebrations)
      // set pieces: from the layout until 2.5 s after the kick (wall and markers break up)
      const spacingOn = (ch.mode === 'open' || ch.mode === 'dead') && !ch.fade.phase && now - setPieceEnd > 2.5;
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        const close = spacingOn && Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y) < 3;
        if (ep.tick(`pair${ps[i].id}-${ps[j].id}`, close, now, 1)) { v.teammatesClose++; example(tot, 'teammatesClose', { seed, t: now, side, a: ps[i].pos + ps[i].number + (ch.ovr.has(ps[i].id) ? '*' : ''), b: ps[j].pos + ps[j].number + (ch.ovr.has(ps[j].id) ? '*' : '') }); }
      }
    }
    // swarm: at most 2 defenders and 1 supporting attacker converge on the carrier
    if (b.owner && open) {
      const c = b.owner;
      let opp = 0, mates = 0;
      for (const d of ch.discs) {
        if (d === c || !d.onPitch || d.leaving) continue;
        if (Math.hypot(d.x - c.x, d.y - c.y) < 4) { if (d.side === c.side) mates++; else opp++; }
      }
      if (ep.tick('swarm', opp > 2 || mates > 1, now, 1)) { v.swarm++; example(tot, 'swarm', { seed, t: now, opp, mates }); }
    } else ep.tick('swarm', false, now, 1);
  }
  tot.ms += performance.now() - t0;
  tot.simSeconds += ch.t;
  tot.matches++;
  tot.blockedWaits += ch.stats.blockedWaits;
  // score, scorers, minutes: view == engine
  const viewG = ch.goals.map((g) => `${g.team}:${g.playerId}:${g.minute}+${g.addedMin || 0}`);
  const engG = engineGoals.map((e) => `${e.team}:${e.playerId}:${e.minute}+${e.addedMin || 0}`);
  if (ch.score.home !== match.score.home || ch.score.away !== match.score.away || viewG.length !== engG.length) { v.scoreMismatch++; example(tot, 'scoreMismatch', { seed, view: ch.score, engine: match.score }); }
  else if (viewG.join('|') !== engG.join('|')) { v.minuteMismatch++; example(tot, 'minuteMismatch', { seed, viewG, engG }); }
  // actions per event: 2 to 6 for play events
  for (const e of match.events) {
    if (!e._seg || e.type === 'sub' || e.type === 'addedTime' || e.type === 'halftime' || e.type === 'fulltime' || e.type === 'yellow' || e.type === 'red') continue;
    const n = e._seg.actions.length;
    tot.actionsPerEvent.n++;
    if (n >= 2 && n <= 6) tot.actionsPerEvent.ok++;
  }
  return ch;
}

export function report(tot, opts) {
  const n = tot.matches;
  const per = (x) => (x / n).toFixed(2);
  const lines = [];
  lines.push(`Touchline viz-check: ${n} matches, layer ${opts.layer}, ${opts.highlights ? 'highlights' : 'full'} mode`);
  lines.push(`animation ${(tot.simSeconds / n).toFixed(0)} s per match (x1), ${(tot.ms / 1000).toFixed(1)} s wall, step ${(tot.ms / tot.steps * 1000).toFixed(0)} us avg / ${tot.maxStepMs.toFixed(2)} ms max`);
  lines.push('');
  lines.push('Never allowed (total, per match):');
  const targets = {
    illegalPass: 0, offsidePass: 0, wrongScorer: 0, wrongAssister: 0, wrongLocation: 0, goalNotBetweenPosts: 0, nonGoalBetweenPosts: 0,
    saveFar: 0, scoreMismatch: 0, minuteMismatch: 0, outOfBounds: 0, speedCap: 0, ballFloating: 0,
  };
  for (const k in tot.v) {
    const zero = k in targets;
    const ok = zero ? tot.v[k] === 0 : tot.v[k] / n < 1;
    lines.push(`  ${k.padEnd(22)} ${String(tot.v[k]).padStart(6)}  ${per(tot.v[k]).padStart(7)}/match   target ${zero ? '0' : '< 1/match'}  ${ok ? 'OK' : 'FAIL'}`);
  }
  lines.push('');
  lines.push('Shape metrics (open play, outfield players, metres):');
  const S = tot.shape;
  lines.push(`  team depth   in possession ${avg(S.inDepth).toFixed(1)} (target 35-40)   out of possession ${avg(S.outDepth).toFixed(1)} (target 25-30)`);
  lines.push(`  team width   in possession ${avg(S.inWidth).toFixed(1)}   out of possession ${avg(S.outWidth).toFixed(1)}`);
  lines.push(`  back line x spread  out of possession ${avg(S.lineSpreadOut).toFixed(1)} (target <= 3 unless a CB steps out)   in possession ${avg(S.lineSpreadIn).toFixed(1)}`);
  lines.push(`  pass length  short ${avg(tot.passLen.short).toFixed(1)}   mixed ${avg(tot.passLen.mixed).toFixed(1)}   direct ${avg(tot.passLen.direct).toFixed(1)}`);
  const op = tot.passLen.short[1] + tot.passLen.mixed[1] + tot.passLen.direct[1];
  lines.push(`  forward passes ${(100 * tot.forward / Math.max(1, op)).toFixed(1)}% of ${op} open-play passes, ${per(tot.passes)} passes and ${per(tot.shots)} shots per match`);
  lines.push(`  events with 2-6 action steps ${(100 * tot.actionsPerEvent.ok / Math.max(1, tot.actionsPerEvent.n)).toFixed(1)}%   forced releases after waiting ${per(tot.blockedWaits)}/match`);
  return lines.join('\n');
}

export async function vizCheck(opts = {}) {
  const o = { n: 200, layer: 3, highlights: false, seed0: 1, ...opts };
  const tot = newTotals();
  for (let i = 0; i < o.n; i++) runOne(o.seed0 + i, o, tot);
  const text = report(tot, o);
  console.log(text);
  const outDir = join(HERE, 'out');
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `viz-check-L${o.layer}${o.highlights ? '-hl' : ''}.json`);
  writeFileSync(file, JSON.stringify({ opts: o, totals: { ...tot, examples: undefined }, examples: tot.examples }, null, 1));
  console.log(`\nexamples written to ${file}`);
  return tot;
}

/**
 * Pacing check: animation seconds per match at x1 (= real seconds at x1) over N seeds, both modes.
 * Also confirms that the view's score, scorers and minutes equal the engine for every match played.
 */
export function pacing(opts = {}) {
  const n = opts.n ?? 50, seed0 = opts.seed0 ?? 1;
  const out = {};
  for (const hl of [true, false]) {
    const ts = [];
    let mismatch = 0;
    for (let i = 0; i < n; i++) {
      const seed = seed0 + i;
      const { home, away } = teamsFor(seed);
      const match = createMatch(home, away, seed, { autoSubs: true });
      const ch = C.createChoreo({ home, away, seed, highlights: hl });
      const goals = [];
      let guard = 0;
      while (guard++ < 400000) {
        if (C.isIdle(ch)) { if (match.phase === 'finished') break; const evs = stepTick(match); for (const e of evs) if (e.type === 'goal') goals.push(e); C.pushBatch(ch, evs); }
        C.advance(ch, 0.1);
      }
      const a = ch.goals.map((g) => g.team + g.playerId + ':' + g.minute + '+' + g.addedMin).join('|');
      const b = goals.map((e) => e.team + e.playerId + ':' + e.minute + '+' + (e.addedMin || 0)).join('|');
      if (a !== b || ch.score.home !== match.score.home || ch.score.away !== match.score.away) mismatch++;
      ts.push(ch.t);
    }
    ts.sort((x, y) => x - y);
    const q = (p) => ts[Math.min(ts.length - 1, Math.floor(p * ts.length))];
    const mean = ts.reduce((x, y) => x + y, 0) / ts.length;
    const hist = {};
    for (const t of ts) { const k = Math.floor(t / 15) * 15; hist[k] = (hist[k] || 0) + 1; }
    const name = hl ? 'highlights' : 'full';
    out[name] = { mean, min: ts[0], p10: q(0.1), median: q(0.5), p90: q(0.9), max: ts[ts.length - 1], mismatch };
    const f0 = (v) => v.toFixed(0);
    console.log(`${name.padEnd(10)} ${n} matches  mean ${f0(mean)} s  min ${f0(ts[0])}  p10 ${f0(q(0.1))}  median ${f0(q(0.5))}  p90 ${f0(q(0.9))}  max ${f0(ts[ts.length - 1])}  (seconds at x1)  engine mismatches ${mismatch}`);
    console.log('           histogram (15 s bins): ' + Object.keys(hist).sort((x, y) => x - y).map((k) => `${k}-${+k + 15}: ${hist[k]}`).join('  '));
  }
  return out;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const val = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] != null ? args[i + 1] : d; };
  if (args.includes('--pacing')) pacing({ n: +val('--n', 50), seed0: +val('--seed0', 1) });
  else vizCheck({ n: +val('--n', 200), layer: +val('--layer', 3), highlights: args.includes('--highlights'), seed0: +val('--seed0', 1) });
}
