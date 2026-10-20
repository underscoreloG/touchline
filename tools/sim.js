// Headless calibration for the match engine.
//   node tools/sim.js                 full calibration tables (10,000 matches per table)
//   node tools/sim.js --n 2000        fewer matches per table
//   node tools/sim.js --replay 42     write tools/out/match-42.json (one full match, actions included)
//   node tools/sim.js --packs         pack odds over 10,000 openings (rolled and delivered)
// Synthetic teams are generated here (self-contained), following the OVR weights of balance.js.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { OVR_WEIGHTS, GK_WEIGHTS, OUTFIELD_STATS, GK_STATS, FORMATION_IDS, DEFAULT_SETTINGS, TACTIC_OPTIONS, TRAIT_IDS } from '../src/balance.js';
import { rngFrom, clamp } from '../src/logic/rng.js';
import { computeOvr } from '../src/logic/cards.js';
import { FORMATIONS } from '../src/logic/formations.js';
import { simulate, createMatch, stepTick, summarise, lineStrengths, ENGINE, CALIBRATION_OVERRIDES } from '../src/logic/matchEngine.js';
import { TACTIC_CARD_IDS } from '../src/logic/tactics.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const argVal = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] != null ? args[i + 1] : def;
};
const N = Math.max(100, parseInt(argVal('--n', '10000'), 10) || 10000);

// ------------------------------------------------------------------ synthetic teams

const SYL = ['ka', 'lo', 'mi', 'ren', 'to', 'sa', 'vel', 'dor', 'an', 'is', 'bru', 'ne', 'gal', 'tes', 'mon', 'ri', 'que', 'zan', 'pe', 'lu'];
function fakeName(rng) {
  const w = (n) => { let s = ''; for (let i = 0; i < n; i++) s += rng.pick(SYL); return s[0].toUpperCase() + s.slice(1); };
  return `${w(2)} ${w(rng.int(2, 3))}`;
}

const BENCH_POS = ['GK', 'CB', 'FB', 'DM', 'CM', 'W', 'ST'];

/** Player with stats following the position weights, OVR close to `target`, +/- 6 individual variation. */
function makePlayer(rng, id, pos, target, chemPts) {
  const gk = pos === 'GK';
  const W = gk ? GK_WEIGHTS : OVR_WEIGHTS[pos];
  const keys = gk ? GK_STATS : OUTFIELD_STATS;
  const stats = {};
  for (const k of keys) stats[k] = target + 80 * (W[k] - 1 / 7) + rng.float(-6, 6);
  const ovr0 = keys.reduce((s, k) => s + stats[k] * W[k], 0);
  const shift = target - ovr0;
  for (const k of keys) stats[k] = clamp(Math.round(stats[k] + shift + chemPts), 1, 99);
  return {
    id, name: fakeName(rng), nation: 'XXX', number: 0, pos, nativePos: pos, stats,
    ovr: computeOvr(stats, pos), fitness: 100, morale: 50, form: 0, traits: [], styleId: null,
    injuryProne: rng.int(1, 20), consistency: rng.int(1, 20), chem: chemPts, yellows: 0,
  };
}

/**
 * @param {number} seed
 * @param {{rating:number, chem?:number, formation?:string, id?:string, isHome?:boolean, random?:boolean}} o
 *   chem: team chemistry 0-33, modelled as +1 per point per player on all stats (11 players, max 3 each)
 *   random: random settings, tactic cards and traits (smoke test)
 */
function makeTeam(seed, o) {
  const rng = rngFrom(seed);
  const formation = o.formation || rng.pick(FORMATION_IDS);
  const chemPer = Math.min(3, Math.floor((o.chem || 0) / 11));
  const chemExtra = (o.chem || 0) - chemPer * 11; // remaining points spread on the first players
  const base = (seed % 100000) * 100;
  const xi = FORMATIONS[formation].slots.map((s, i) => {
    const c = Math.min(3, chemPer + (i < chemExtra ? 1 : 0));
    const p = makePlayer(rng, base + i + 1, s.pos, o.rating + rng.float(-3, 3), c);
    p.number = i + 1;
    return p;
  });
  const bench = BENCH_POS.map((pos, i) => {
    const p = makePlayer(rng, base + 20 + i, pos, o.rating - 3 + rng.float(-3, 3), 0);
    p.number = 12 + i;
    return p;
  });
  let settings = { ...DEFAULT_SETTINGS };
  let tacticCards = [];
  if (o.random) {
    settings = {};
    for (const k in TACTIC_OPTIONS) settings[k] = rng.pick(TACTIC_OPTIONS[k]);
    tacticCards = rng.shuffle(TACTIC_CARD_IDS.slice()).slice(0, rng.int(0, 3));
    for (const p of [...xi, ...bench]) if (rng.chance(0.3)) p.traits = [rng.pick(TRAIT_IDS)];
  }
  const roles = { captain: xi[5].id, penalties: null, freeKicks: null, corners: null };
  return {
    id: o.id || `T${seed}`, name: o.id || `Club ${seed % 1000}`, colours: ['#c0392b', '#ffffff'], crest: {},
    formation, xi, bench, settings, tacticCards, roles,
    staff: { fitness: 0, physio: 0, scout: 0, gk: 0, setPiece: 0, youth: 0, analyst: 0 },
    chemistry: o.chem || 0, isHome: !!o.isHome, isAI: true,
  };
}

// ------------------------------------------------------------------ helpers

const pct = (a, n) => (100 * a / n).toFixed(1);
const f2 = (v) => v.toFixed(2);
const inRange = (v, [lo, hi]) => v >= lo && v <= hi;
const mark = (ok) => (ok ? 'OK ' : 'OUT');
const pad = (s, n) => String(s).padEnd(n);
/** En and em dash, built from char codes so this file stays plain ASCII. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);

export { makeTeam };

// ------------------------------------------------------------------ modes

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();

function main() {
  if (args.includes('--viz-check')) {
    import('./viz-check.js').then((m) => args.includes('--pacing') ? m.pacing({ n: +argVal('--n', 50), seed0: +argVal('--seed0', 1) }) : m.vizCheck({ n: +argVal('--n', 200), layer: +argVal('--layer', 3), highlights: args.includes('--highlights'), seed0: +argVal('--seed0', 1) }));
    return;
  }
  if (args.includes('--packs')) {
    import('./pack-odds.js').then((m) => m.packOdds({ n: +argVal('--n', 10000), worldSize: +argVal('--world', 50000) }));
    return;
  }

  if (args.includes('--replay')) {
    const seed = parseInt(argVal('--replay', '1'), 10) || 1;
    const home = makeTeam(seed * 2 + 1, { rating: 72, chem: 22, isHome: true, id: 'Northbridge' });
    const away = makeTeam(seed * 2 + 2, { rating: 70, chem: 18, isHome: false, id: 'Lowmoor' });
    home.colours = ['#1f6feb', '#ffffff'];
    away.colours = ['#d73a49', '#111111'];
    const res = simulate(home, away, seed);
    const slim = (t) => ({
      id: t.id, name: t.name, colours: t.colours, formation: t.formation, settings: t.settings, tacticCards: t.tacticCards,
      xi: t.xi.map((p) => ({ id: p.id, name: p.name, number: p.number, pos: p.pos, stats: p.stats, ovr: p.ovr })),
      bench: t.bench.map((p) => ({ id: p.id, name: p.name, number: p.number, pos: p.pos, stats: p.stats, ovr: p.ovr })),
    });
    const outDir = join(HERE, 'out');
    mkdirSync(outDir, { recursive: true });
    const file = join(outDir, `match-${seed}.json`);
    writeFileSync(file, JSON.stringify({
      seed, pitch: { length: 105, width: 68, note: 'metres; home attacks +x in the first half, sides swap at half time' },
      home: slim(home), away: slim(away), result: { ...res, events: undefined }, events: res.events,
    }, null, 1));
    console.log(`Replay written: ${file}`);
    console.log(`${home.name} ${res.score.home}-${res.score.away} ${away.name}, ${res.events.length} events`);
    process.exit(0);
  }

  // ------------------------------------------------------------------ calibration

  console.log(`Touchline match engine calibration, ${N} matches per table`);
  console.log(`CALIBRATION_OVERRIDES: ${JSON.stringify(CALIBRATION_OVERRIDES)}`);
  console.log('');

  const T = ENGINE.targets;
  let allOk = true;
  const check = (ok) => { if (!ok) allOk = false; return mark(ok); };

  // 1) league-like main run: ratings 66-74, chemistry 10-25, random formations, default settings
  {
    const acc = { goals: 0, hg: 0, ag: 0, hw: 0, d: 0, aw: 0, shots: 0, sot: 0, xg: 0, corners: 0, fouls: 0, offsides: 0, y: 0, r: 0, inj: 0, pens: 0, added1: 0, added2: 0, poss: 0, subs: 0 };
    const goalDist = new Array(9).fill(0);
    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      const r = rngFrom(1000003 + i);
      const h = makeTeam(10_000_000 + i * 2, { rating: r.float(66, 74), chem: r.int(10, 25), isHome: true });
      const a = makeTeam(10_000_001 + i * 2, { rating: r.float(66, 74), chem: r.int(10, 25), isHome: false });
      const res = simulate(h, a, 500000 + i, { lite: true });
      const g = res.score.home + res.score.away;
      acc.goals += g; acc.hg += res.score.home; acc.ag += res.score.away;
      goalDist[Math.min(8, g)]++;
      if (res.score.home > res.score.away) acc.hw++; else if (res.score.home < res.score.away) acc.aw++; else acc.d++;
      const s = res.stats;
      acc.shots += s.shots.home + s.shots.away; acc.sot += s.shotsOnTarget.home + s.shotsOnTarget.away;
      acc.xg += s.xg.home + s.xg.away; acc.corners += s.corners.home + s.corners.away;
      acc.fouls += s.fouls.home + s.fouls.away; acc.offsides += s.offsides.home + s.offsides.away;
      acc.y += s.cards.home.yellow + s.cards.away.yellow; acc.r += s.cards.home.red + s.cards.away.red;
      acc.inj += res.injuries.length; acc.added1 += res.added.h1; acc.added2 += res.added.h2;
      acc.poss += s.possession.home; acc.subs += res.subs.length;
      for (const e of res.events) if (e.type === 'penalty') acc.pens++;
    }
    const ms = performance.now() - t0;
    const gpm = acc.goals / N;
    const spt = acc.shots / N / 2;
    const dp = +pct(acc.d, N), hp = +pct(acc.hw, N);
    console.log('== League-like run (ratings 66-74, chemistry 10-25, random formations, both sides AI) ==');
    console.log(`goals per match        ${f2(gpm)}   target ${T.goalsPerMatch.join('-')}   ${check(inRange(gpm, T.goalsPerMatch))}`);
    console.log(`  home / away goals    ${f2(acc.hg / N)} / ${f2(acc.ag / N)}`);
    console.log(`home / draw / away %   ${pct(acc.hw, N)} / ${pct(acc.d, N)} / ${pct(acc.aw, N)}   targets home ${T.homeWinPct.join('-')} ${check(inRange(hp, T.homeWinPct))}, draw ${T.drawPct.join('-')} ${check(inRange(dp, T.drawPct))}`);
    console.log(`shots per team         ${f2(spt)}   target ${T.shotsPerTeam.join('-')}   ${check(inRange(spt, T.shotsPerTeam))}`);
    console.log(`shots on target / team ${f2(acc.sot / N / 2)}`);
    console.log(`xG per team            ${f2(acc.xg / N / 2)}`);
    console.log(`corners per match      ${f2(acc.corners / N)}`);
    console.log(`fouls per match        ${f2(acc.fouls / N)}   offsides ${f2(acc.offsides / N)}   penalties ${f2(acc.pens / N)}`);
    console.log(`yellow / red per match ${f2(acc.y / N)} / ${f2(acc.r / N)}`);
    console.log(`injuries per match     ${f2(acc.inj / N)}`);
    console.log(`subs per match         ${f2(acc.subs / N)}   added ticks H1 ${f2(acc.added1 / N)}  H2 ${f2(acc.added2 / N)}`);
    console.log(`home possession %      ${f2(acc.poss / N)}`);
    console.log(`total goals histogram  ${goalDist.map((c, g) => `${g}${g === 8 ? '+' : ''}:${pct(c, N)}%`).join('  ')}`);
    console.log(`time ${(ms / 1000).toFixed(1)} s incl. team generation, ${Math.round(N / (ms / 1000))} matches/s`);
    console.log('');
  }

  // 2) rating gap, equal chemistry, venue alternated so home advantage cancels out
  console.log('== Win % by rating gap (equal chemistry 15, venue alternated) ==');
  console.log(`${pad('gap', 5)}${pad('fav win', 9)}${pad('draw', 7)}${pad('fav loss', 10)}${pad('decisive share', 16)}fav goals - dog goals`);
  for (const gap of [0, 5, 10, 15]) {
    let w = 0, d = 0, l = 0, gf = 0, ga = 0;
    for (let i = 0; i < N; i++) {
      const favHome = i % 2 === 0;
      const fav = makeTeam(20_000_000 + gap * 1_000_000 + i * 2, { rating: 70 + gap / 2, chem: 15, isHome: favHome });
      const dog = makeTeam(20_000_001 + gap * 1_000_000 + i * 2, { rating: 70 - gap / 2, chem: 15, isHome: !favHome });
      const res = favHome ? simulate(fav, dog, 700000 + i, { lite: true }) : simulate(dog, fav, 700000 + i, { lite: true });
      const fs = favHome ? res.score.home : res.score.away;
      const ds = favHome ? res.score.away : res.score.home;
      gf += fs; ga += ds;
      if (fs > ds) w++; else if (fs < ds) l++; else d++;
    }
    const wp = +pct(w, N);
    const tag = gap === 10 ? `   target ${T.favouriteWinAt10.join('-')} ${check(inRange(wp, T.favouriteWinAt10))}` : '';
    console.log(`${pad(gap, 5)}${pad(pct(w, N), 9)}${pad(pct(d, N), 7)}${pad(pct(l, N), 10)}${pad(pct(w, w + l), 16)}${f2(gf / N)} - ${f2(ga / N)}${tag}`);
  }
  console.log('');

  // 3) chemistry 33 vs 0 at equal rating
  {
    let w = 0, d = 0, l = 0;
    for (let i = 0; i < N; i++) {
      const chemHome = i % 2 === 0;
      const hi = makeTeam(30_000_000 + i * 2, { rating: 70, chem: 33, isHome: chemHome });
      const lo = makeTeam(30_000_001 + i * 2, { rating: 70, chem: 0, isHome: !chemHome });
      const res = chemHome ? simulate(hi, lo, 900000 + i, { lite: true }) : simulate(lo, hi, 900000 + i, { lite: true });
      const a = chemHome ? res.score.home : res.score.away;
      const b = chemHome ? res.score.away : res.score.home;
      if (a > b) w++; else if (a < b) l++; else d++;
    }
    const share = +pct(w, w + l);
    console.log('== Chemistry 33 vs 0 at equal rating 70 (venue alternated) ==');
    console.log(`chem 33 win / draw / loss %  ${pct(w, N)} / ${pct(d, N)} / ${pct(l, N)}`);
    console.log(`chem 33 share of decisive results ${share}%   target 58-66 ${check(inRange(share, [58, 66]))}`);
    console.log(`chem 33 points share (3/1/0)      ${pct(3 * w + d, 3 * w + 2 * d + 3 * l)}%`);
    console.log('');
  }

  // 4) smoke: random settings, tactic cards and traits must never crash and stay sane
  {
    let goals = 0, errors = 0, minEvents = Infinity;
    const M = Math.min(N, 2000);
    for (let i = 0; i < M; i++) {
      try {
        const h = makeTeam(40_000_000 + i * 2, { rating: 70, chem: 20, isHome: true, random: true });
        const a = makeTeam(40_000_001 + i * 2, { rating: 70, chem: 20, isHome: false, random: true });
        const res = simulate(h, a, 1_100_000 + i);
        goals += res.score.home + res.score.away;
        minEvents = Math.min(minEvents, res.events.length);
        for (const e of res.events) {
          const admin = e.type === 'sub' || e.type === 'halftime' || e.type === 'fulltime' || e.type === 'addedTime';
          if (!admin && (e.actions.length < 2 || e.actions.length > 6)) throw new Error(`event ${e.type} has ${e.actions.length} actions`);
          if (DASHES.test(e.text)) throw new Error('dash in commentary');
        }
      } catch (err) {
        errors++;
        if (errors <= 3) console.log('  smoke error:', err.message);
      }
    }
    console.log(`== Smoke: ${M} matches with random settings, tactic cards, traits (full actions + commentary) ==`);
    console.log(`errors ${errors}   goals per match ${f2(goals / M)}   min events per match ${minEvents}   ${check(errors === 0)}`);
    console.log('');
  }

  // 5) determinism: same seed twice gives identical event logs (20 seeds), lite == full results,
  //    and an interactive run with key moments left unanswered equals simulate()
  {
    let same = 0, liteSame = 0, kmSame = 0;
    for (let s = 1; s <= 20; s++) {
      const h = makeTeam(50_000_000 + s * 2, { rating: 70, chem: 20, isHome: true, random: s % 2 === 0 });
      const a = makeTeam(50_000_001 + s * 2, { rating: 70, chem: 20, isHome: false, random: s % 3 === 0 });
      const r1 = simulate(h, a, s);
      const r2 = simulate(h, a, s);
      if (JSON.stringify(r1) === JSON.stringify(r2)) same++;
      const rl = simulate(h, a, s, { lite: true });
      const strip = (r) => JSON.stringify({ ...r, events: r.events.map((e) => ({ ...e, text: '', actions: [] })) });
      if (strip(rl) === strip(r1)) liteSame++;
      const hu = { ...h, isAI: false };
      const m = createMatch(hu, a, s, { keyMoments: true, autoSubs: true });
      let guard = 0;
      while (m.phase !== 'finished' && guard++ < 300) stepTick(m);
      const rk = summarise(m);
      const r3 = simulate(hu, a, s);
      if (JSON.stringify(rk) === JSON.stringify(r3)) kmSame++;
    }
    console.log('== Determinism (20 seeds) ==');
    console.log(`same seed twice, identical event logs   ${same}/20   ${check(same === 20)}`);
    console.log(`lite mode gives identical results       ${liteSame}/20   ${check(liteSame === 20)}`);
    console.log(`key moments unanswered == simulate()    ${kmSame}/20   ${check(kmSame === 20)}`);
    console.log('');
  }

  // 6) performance on pre-built teams
  {
    const M = Math.min(N, 3000);
    const teams = [];
    for (let i = 0; i < 40; i++) teams.push(makeTeam(60_000_000 + i, { rating: 70, chem: 20, isHome: i % 2 === 0 }));
    const run = (lite) => {
      const t0 = performance.now();
      for (let i = 0; i < M; i++) simulate(teams[(i * 2) % 40], teams[(i * 2 + 1) % 40], 2_000_000 + i, { lite });
      return M / ((performance.now() - t0) / 1000);
    };
    run(true); // warm-up
    const full = run(false);
    const lite = run(true);
    console.log(`== Performance (${M} matches, one core) ==`);
    console.log(`full (actions + commentary) ${Math.round(full)} matches/s   target 500 ${check(full >= 500)}`);
    console.log(`lite (results only)         ${Math.round(lite)} matches/s`);
    const ls = lineStrengths(teams[0], { opp: teams[1] });
    console.log(`sample lineStrengths (rating 70, chem 20, home): ATT ${ls.ATT} MID ${ls.MID} DEF ${ls.DEF} GK ${ls.GK}`);
    console.log('');
  }

  console.log(allOk ? 'ALL CHECKS INSIDE TARGETS' : 'SOME CHECKS OUTSIDE TARGETS');
  process.exitCode = allOk ? 0 : 1;
}
