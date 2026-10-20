// League pyramid checks. Usage: node tools/check-league.js [--size 50000] [--seed 7] [--seasons 10] [--quick]
// Structure, 10 simulated seasons (bot plays my matches instantly), table consistency, promotion/relegation counts,
// tie-break and playoff unit tests, my club up/down, background exchange, determinism, plausibility, timings.
// Exit code 1 when a check fails. Tools may use performance.now; src/logic may not.

import { performance } from 'node:perf_hooks';
import { LEAGUE_SYSTEM, WORLD } from '../src/balance.js';
import { rngFrom } from '../src/logic/rng.js';
import { generateWorld } from '../src/logic/generator.js';
import {
  createState, startGame, nextMatchInfo, playInstant, prepareMatch, applyMatchResult, simRounds, simToSeasonEnd,
  newSeason, leagueRows,
} from '../src/logic/game.js';
import {
  leagueKey, levelRules, promotedFrom, relegatedFrom, myLeague, membershipIssues, beginPlayoffs, stageFixtures,
  recordPlayoffLeg, playRound,
} from '../src/logic/pyramid.js';
import { sortLeague, createLeague, recordResult, penaltyShootout } from '../src/logic/season.js';
import { simulate } from '../src/logic/matchEngine.js';
import { MY_CLUB_ID } from '../src/logic/economy.js';
import { setBoost } from '../src/logic/cheats.js';
import { aiCacheStats } from '../src/logic/aiTeams.js';
import { teamStats, leagueStats } from '../src/logic/stats.js';
import { autoBestXI, autoFixFitness } from '../src/logic/squad.js';

const args = process.argv.slice(2);
const argVal = (name, def) => { const i = args.indexOf(name); return i >= 0 ? Number(args[i + 1]) : def; };
const SIZE = argVal('--size', 50000);
const SEED = argVal('--seed', 7);
const SEASONS = argVal('--seasons', args.includes('--quick') ? 3 : 10);
const LS = LEAGUE_SYSTEM;
const C = WORLD.countries;

let failures = 0;
const results = [];
function check(label, ok, detail = '') {
  results.push({ label, ok, detail });
  if (!ok) failures++;
}
const section = (t) => console.log(`\n== ${t} ==`);
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);
const table = (rows, widths) => { for (const r of rows) console.log('  ' + r.map((c, i) => (i === 0 ? pad(c, widths[i]) : rpad(c, widths[i]))).join(' ')); };
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const club = { name: 'Check FC', colours: ['#c8102e', '#ffffff'], crest: {} };

function newGame(seed = SEED, size = SIZE, country = 'ENG') {
  const world = generateWorld(seed, size);
  const state = createState({ seed, worldSize: size, country, club });
  startGame(state, world, rngFrom(seed));
  return { world, state };
}

console.log(`Touchline league pyramid check: size ${SIZE}, seed ${SEED}, ${SEASONS} seasons per bot run`);

// ---------------------------------------------------------------- structure
section('Structure (LEAGUE_SYSTEM)');
{
  const t0 = performance.now();
  const { world, state } = newGame();
  console.log(`  world + new game ${(performance.now() - t0).toFixed(0)} ms`);
  const py = state.season.pyramid;
  const rows = [['country', 'L1', 'L2', 'L3', 'L4', 'L5', 'up (auto+po)', 'matchdays']];
  let structOk = true, fixturesOk = true, total = 0;
  for (const c of C) {
    const r = [c];
    for (let l = 1; l <= LS.levels; l++) {
      const lg = py.leagues[leagueKey(c, l)];
      const rule = levelRules(c, l);
      total += lg.clubIds.length;
      r.push(lg.clubIds.length);
      if (lg.clubIds.length !== rule.clubs) structOk = false;
      const worldCount = world.clubsOf(c, l).length + (c === state.country && l === LS.startLevel ? 1 : 0);
      if (worldCount !== rule.clubs) structOk = false;
      // fixtures: 2(n-1) matchdays, everyone once per day, each ordered pair exactly once
      const n = rule.clubs;
      if (lg.fixtures.length !== 2 * (n - 1)) fixturesOk = false;
      const pairs = new Set();
      for (const day of lg.fixtures) {
        const seen = new Set();
        for (const [h, a] of day) { if (seen.has(h) || seen.has(a)) fixturesOk = false; seen.add(h); seen.add(a); pairs.add(h + '>' + a); }
        if (seen.size !== n) fixturesOk = false;
      }
      if (pairs.size !== n * (n - 1)) fixturesOk = false;
    }
    r.push([1, 2, 3, 4, 5].map((l) => promotedFrom(c, l)).join('/'));
    r.push([1, 2, 3, 4, 5].map((l) => 2 * (levelRules(c, l).clubs - 1)).join('/'));
    rows.push(r);
  }
  table(rows, [8, 4, 4, 4, 4, 4, 14, 16]);
  console.log(`  ${total} clubs in the pyramid (my club included), ${world.clubs.filter((x) => !x.isBackground).length} playable AI clubs in the world`);
  check('every league has the LEAGUE_SYSTEM size (pyramid and world)', structOk);
  check('500 clubs in the pyramid', total === 500, String(total));
  check('club ids 0..499 ordered by country, level, index at generation', (() => {
    const w = generateWorld(SEED, 30000);
    let i = 0;
    for (const c of C) for (let l = 1; l <= LS.levels; l++) for (let k = 0; k < levelRules(c, l).clubs; k++, i++) {
      const x = w.clubs[i];
      if (!x || x.id !== i || x.country !== c || x.division !== l || x.isBackground) return false;
    }
    return w.clubs[500] && w.clubs[500].isBackground;
  })());
  check('fixtures: 2(n-1) matchdays, one match per club per day, every ordered pair once', fixturesOk);
  check('my club starts in level 5 of my country, the weakest AI club of it went to the background', myLeague(state).clubIds.includes(MY_CLUB_ID) && state.season.level === 5 && membershipIssues(state, world, Object.fromEntries(py.order.map((k) => [k, py.leagues[k].clubIds]))).length === 0);
  check('rounds = longest league (46 for 24 clubs)', py.rounds === 46, String(py.rounds));
  check('playoffs only where LEAGUE_SYSTEM says so', C.every((c) => !levelRules(c, 1).playoff));
}

// ---------------------------------------------------------------- tie-breaks
section('Tie-break unit tests');
{
  // league helper: clubs 1..n, results list -> table
  const mk = (country, n, res) => {
    const lg = createLeague(Array.from({ length: n }, (_, i) => i + 1), null, { key: 'T', country, level: 1 });
    res.forEach(([h, a, hg, ag]) => recordResult(lg, 0, h, a, hg, ag));
    return lg;
  };
  const order = (lg, tb) => sortLeague(lg, tb).map((r) => r.clubId).join(',');
  // 1 and 2 level on points; 1 beat 2 head to head, 2 has the better goal difference
  const res = [[1, 2, 1, 0], [2, 1, 0, 0], [2, 3, 5, 0], [3, 2, 0, 3], [1, 3, 1, 0], [3, 1, 1, 0]];
  const lg = mk('ENG', 3, res);
  const t = Object.fromEntries(Object.values(lg.table).map((r) => [r.clubId, r]));
  console.log(`  points 1:${t[1].pts} 2:${t[2].pts} 3:${t[3].pts}; gd 1:${t[1].gf - t[1].ga} 2:${t[2].gf - t[2].ga}; h2h 1 vs 2: 1-0, 0-0`);
  check('tie-break gd first (ENG): better goal difference wins', order(lg, LS.tiebreak.ENG) === '2,1,3', order(lg, LS.tiebreak.ENG));
  check('tie-break h2h first (ESP, ITA): head-to-head wins over goal difference', order(lg, LS.tiebreak.ESP) === '1,2,3' && order(lg, LS.tiebreak.ITA) === '1,2,3', order(lg, LS.tiebreak.ESP));
  // GER: gd, gf, h2h -> 1 and 2 equal on points, gd and gf; 2 won the head-to-head (3 trails on goals)
  const lg2 = mk('GER', 3, [[1, 2, 1, 2], [2, 1, 1, 1], [1, 3, 1, 0], [3, 1, 0, 0], [2, 3, 0, 1], [3, 2, 0, 0]]);
  const t2 = Object.fromEntries(Object.values(lg2.table).map((r) => [r.clubId, r]));
  const tied = [1, 2].map((id) => `${id}: ${t2[id].pts} pts gd ${t2[id].gf - t2[id].ga} gf ${t2[id].gf}`).join(' / ');
  check('tie-break gd, gf, then h2h (GER): equal gd and gf, head-to-head decides', t2[1].pts === t2[2].pts && t2[1].gf === t2[2].gf && t2[1].ga === t2[2].ga && order(lg2, LS.tiebreak.GER) === '2,1,3' && order(lg2, LS.tiebreak.ENG) === '1,2,3', `${tied}; GER ${order(lg2, LS.tiebreak.GER)}, ENG ${order(lg2, LS.tiebreak.ENG)}`);
  // three-way h2h mini table: 1 > 2 > 3 > 1 cycle on h2h points, mini goal difference decides (2 has the best overall gd)
  const lg3 = mk('ITA', 4, [[1, 2, 3, 0], [2, 3, 1, 0], [3, 1, 1, 0], [4, 1, 0, 1], [4, 2, 0, 6], [4, 3, 0, 1]]);
  check('three-way h2h: mini table among the tied clubs (ITA), overall gd would differ (ENG)', order(lg3, LS.tiebreak.ITA) === '1,3,2,4' && order(lg3, LS.tiebreak.ENG) === '2,1,3,4', `ITA ${order(lg3, LS.tiebreak.ITA)}, ENG ${order(lg3, LS.tiebreak.ENG)}`);
  // recursion: h2h level (1-1, 1-1) -> next criterion (overall gd) decides
  const lg4 = mk('ESP', 3, [[1, 2, 1, 1], [2, 1, 1, 1], [1, 3, 1, 0], [3, 1, 0, 0], [2, 3, 4, 0], [3, 2, 0, 0]]);
  check('recursive tie-break: level on h2h, overall goal difference decides (ESP)', order(lg4, LS.tiebreak.ESP) === '2,1,3', order(lg4, LS.tiebreak.ESP));
  check('equal on everything: club id fallback is deterministic', order(mk('FRA', 2, [[1, 2, 1, 1], [2, 1, 1, 1]]), LS.tiebreak.FRA) === '1,2');
}

// ---------------------------------------------------------------- playoffs (unit)
section('Playoff unit tests');
{
  const { world, state } = newGame(SEED, 30000);
  simToSeasonEnd(state, world);
  const py = state.season.pyramid;
  const pos = py.playoffs;
  let seedsOk = true, legsOk = true, onlyPlayoffLevels = true, winnersPromoted = true;
  for (const key of py.order) {
    const lg = py.leagues[key];
    const rule = levelRules(lg.country, lg.level);
    if (!!pos[key] !== rule.playoff) onlyPlayoffLevels = false;
    if (!pos[key]) continue;
    const po = pos[key];
    const rows = sortLeague(lg).map((r) => r.clubId);
    const want = rows.slice(rule.promoteAuto, rule.promoteAuto + 4);
    if (JSON.stringify(po.seeds) !== JSON.stringify(want)) seedsOk = false;
    if (po.ties[0].a !== want[0] || po.ties[0].b !== want[3] || po.ties[1].a !== want[1] || po.ties[1].b !== want[2]) seedsOk = false;
    if (state.season.phase === 'done') {
      for (const ti of [0, 1]) {
        const tie = po.ties[ti];
        if (tie.legs.length !== 2 || tie.legs[0].home !== tie.b || tie.legs[1].home !== tie.a) legsOk = false;
      }
      const f = po.ties[2];
      const better = [po.ties[0].winner, po.ties[1].winner].sort((x, y) => po.seeds.indexOf(x) - po.seeds.indexOf(y));
      if (f.legs.length !== 1 || f.a !== better[0] || f.legs[0].home !== better[0] || f.b !== better[1]) legsOk = false;
      if (!py.outcome.promoted[key].includes(po.winner)) winnersPromoted = false;
    }
  }
  const pens = Object.values(pos).flatMap((p) => p.ties).filter((t) => t.pens).length;
  console.log(`  ${Object.keys(pos).length} brackets; ties decided on penalties this season: ${pens}`);
  check('playoff brackets only on levels with playoff: true', onlyPlayoffLevels);
  check('seeds = positions promoteAuto+1 .. promoteAuto+4; semis 1v4 and 2v3', seedsOk);
  check('semi leg 1 hosted by the lower seed, leg 2 by the higher; one-match final hosted by the better seed', legsOk);
  check('playoff winner is promoted', winnersPromoted && Object.keys(py.outcome.playoffWinners).length === Object.keys(pos).length);
  // forced aggregate tie -> penalties
  const fake = { seeds: [11, 12, 13, 14], winner: null, ties: [
    { stage: 'semi', a: 11, b: 14, legs: [], pens: null, winner: null }, { stage: 'semi', a: 12, b: 13, legs: [], pens: null, winner: null },
    { stage: 'final', a: null, b: null, legs: [], pens: null, winner: null }] };
  const fx0 = stageFixtures(fake, 0), fx1 = stageFixtures(fake, 1);
  check('stage fixtures: leg 1 at the lower seed, leg 2 at the higher', fx0[0][1] === 14 && fx0[0][2] === 11 && fx1[0][1] === 11 && fx1[1][1] === 12);
  recordPlayoffLeg(fake, 0, 0, 14, 11, 1, 0, 60, 60, 1);
  recordPlayoffLeg(fake, 1, 0, 13, 12, 0, 2, 60, 60, 2);
  const r1 = recordPlayoffLeg(fake, 0, 1, 11, 14, 1, 0, 62, 58, 3); // aggregate 1-1 -> penalties
  const r2 = recordPlayoffLeg(fake, 1, 1, 12, 13, 0, 0, 60, 60, 4); // 2-0 aggregate, no penalties
  check('aggregate tie goes to penalties, winner by the shootout', r1.pens && r1.pens.home !== r1.pens.away && fake.ties[0].winner === (fake.ties[0].pens.a > fake.ties[0].pens.b ? 11 : 14), JSON.stringify(fake.ties[0].pens));
  check('no penalties when the aggregate is decided', r2.pens === null && fake.ties[1].winner === 12);
  check('final pairing: better seed hosts', fake.ties[2].a === Math.min(fake.ties[0].winner, 12) && stageFixtures(fake, 2)[0][1] === fake.ties[2].a);
  const rf = recordPlayoffLeg(fake, 2, 2, fake.ties[2].a, fake.ties[2].b, 2, 2, 60, 60, 5);
  check('drawn final goes to penalties and sets the playoff winner', rf.pens && fake.winner === fake.ties[2].winner && fake.winner != null);
  // shootout statistics: stronger side wins more often, never level
  let aw = 0, lvl = 0;
  for (let i = 0; i < 4000; i++) { const s = penaltyShootout(rngFrom(1000 + i), 70, 60); if (s.a === s.b) lvl++; if (s.a > s.b) aw++; }
  console.log(`  shootouts 70 vs 60 rating: stronger side wins ${(aw / 40).toFixed(1)}% of 4000`);
  check('shootouts never end level; rating weighting favours the stronger side (55-70% at +10)', lvl === 0 && aw / 4000 > 0.55 && aw / 4000 < 0.7, `${(aw / 40).toFixed(1)}%`);
}

// ---------------------------------------------------------------- my club in a playoff (forced), drawn decider
section('My club through the playoff match flow (forced into the playoff places)');
{
  let done = false;
  for (let attempt = 0; attempt < 6 && !done; attempt++) {
    const { world, state } = newGame(SEED + 100 + attempt, 30000);
    const py = state.season.pyramid;
    while (py.round < py.rounds - 1) { const r = simRounds(state, world, 1); if (!r.ok) throw new Error(r.error); }
    // one round left: put my club 10 points behind the leader and 10 above 6th (consistent w/d/l not needed here)
    const lg = myLeague(state);
    const rows = sortLeague(lg);
    const me = lg.table[MY_CLUB_ID];
    const others = rows.filter((r) => r.clubId !== MY_CLUB_ID);
    others[0].pts += 60; // a runaway leader takes the automatic place
    me.pts = others[4].pts + 10; // at most 4 clubs above me, 7+ points clear of 6th with one round left
    simRounds(state, world, 1);
    if (state.season.phase !== 'playoffs' || !nextMatchInfo(state, world)) continue;
    done = true;
    const i1 = nextMatchInfo(state, world);
    const po = py.playoffs[i1.leagueKey];
    const seedIdx = po.seeds.indexOf(MY_CLUB_ID);
    check('playoff phase: nextMatchInfo returns my semi-final leg 1', i1.phase === 'playoffs' && i1.stage === 0 && i1.playoffStage === 'semi1');
    check('leg 1 hosted by the lower seed', (seedIdx <= 1) === !i1.homeIsMe, `my seed ${seedIdx + 1}, home ${i1.homeIsMe}`);
    const p1 = prepareMatch(state, world);
    const r1 = simulate(p1.home, p1.away, p1.seed, {});
    r1.score = { home: 1, away: 0 };
    applyMatchResult(state, world, r1, p1);
    const i2 = nextMatchInfo(state, world);
    check('leg 2 next, hosted by the higher seed', i2 && i2.stage === 1 && (seedIdx <= 1) === i2.homeIsMe);
    const p2 = prepareMatch(state, world);
    const r2 = simulate(p2.home, p2.away, p2.seed, {});
    r2.score = { home: 1, away: 0 }; // aggregate 1-1 -> penalties decide instantly
    const s2 = applyMatchResult(state, world, r2, p2);
    const tie = po.ties.find((t) => t.a === MY_CLUB_ID || t.b === MY_CLUB_ID);
    check('my drawn deciding leg goes to an instant shootout and is recorded', s2.pens && s2.pens.for !== s2.pens.against && tie.pens && tie.winner != null, JSON.stringify(s2.pens));
    const won = tie.winner === MY_CLUB_ID;
    if (won) {
      const i3 = nextMatchInfo(state, world);
      check('after winning the semi: the final is my next match', i3 && i3.stage === 2 && i3.playoffStage === 'final');
      const r = playInstant(state, world);
      check('final played through the match flow, season finished', r && !r.error && state.season.phase === 'done');
    } else {
      check('after losing the semi: the rest of the playoffs are simulated and the season is done', state.season.phase === 'done' && nextMatchInfo(state, world) === null);
    }
    const s = state.season.summary;
    check('summary records my playoff result and my new level', s.playoff === (po.winner === MY_CLUB_ID ? 'won' : won ? 'lostFinal' : 'lostSemi') && s.newLevel === (po.winner === MY_CLUB_ID ? 4 : 5), `${s.playoff}, new level ${s.newLevel}`);
  }
  check('forced playoff case reached', done);
}

// ---------------------------------------------------------------- my club up and down (forced)
section('My club promoted as champion, relegated, and protected at the bottom of level 5');
{
  const { world, state } = newGame(SEED, 30000);
  setBoost(state, 30);
  simToSeasonEnd(state, world);
  const s1 = state.season.summary;
  console.log(`  season 1 with boost +30: level ${s1.level}, position ${s1.position}, points ${s1.points}, new level ${s1.newLevel}`);
  check('champion of level 5 is promoted to level 4', s1.position === 1 && s1.promoted && s1.newLevel === 4);
  newSeason(state, world);
  check('next season my club plays in ENG4', state.season.level === 4 && myLeague(state).key === 'ENG4' && myLeague(state).clubIds.includes(MY_CLUB_ID) && !state.season.pyramid.leagues.ENG5.clubIds.includes(MY_CLUB_ID));
  setBoost(state, -25);
  simToSeasonEnd(state, world);
  const s2 = state.season.summary;
  const zone = levelRules('ENG', 4).clubs - relegatedFrom('ENG', 4);
  console.log(`  season 2 with boost -25: level ${s2.level}, position ${s2.position}, new level ${s2.newLevel} (relegation from position ${zone + 1})`);
  check('relegated from level 4 to level 5 when finishing in the zone', s2.position > zone && s2.relegated && s2.newLevel === 5);
  newSeason(state, world);
  simToSeasonEnd(state, world);
  const s3 = state.season.summary;
  const py = state.season.pyramid;
  console.log(`  season 3 with boost -25: level ${s3.level}, position ${s3.position}, new level ${s3.newLevel}; ENG exchange out ${py.outcome.exchangeOut.ENG.length}, in ${py.outcome.exchangeIn.ENG.length}`);
  check('bottom of level 5: my club stays in the pyramid, the exchange still swaps the full count', s3.position > levelRules('ENG', 5).clubs - relegatedFrom('ENG', 5) && s3.newLevel === 5 && py.outcome.exchangeOut.ENG.length === relegatedFrom('ENG', 5) && !py.outcome.exchangeOut.ENG.includes(MY_CLUB_ID));
  check('history holds one entry per finished season with level and movement', state.history.length === 3 && state.history[0].promoted && state.history[1].relegated && state.history.every((h) => h.level && h.country === 'ENG'));
}

// ---------------------------------------------------------------- multi-season bot runs
function seasonChecks(state, world, tag, totals) {
  const py = state.season.pyramid;
  let tablesOk = true, mdOk = true;
  const issues = [];
  for (const key of py.order) {
    const lg = py.leagues[key];
    const n = lg.clubIds.length;
    let gf = 0, ga = 0;
    for (const r of Object.values(lg.table)) {
      gf += r.gf; ga += r.ga;
      if (r.pts !== LS.pointsWin * r.w + LS.pointsDraw * r.d || r.p !== r.w + r.d + r.l || r.p !== 2 * (n - 1)) { tablesOk = false; issues.push(`${key} club ${r.clubId}`); }
    }
    if (gf !== ga) { tablesOk = false; issues.push(`${key} gf ${gf} ga ${ga}`); }
    if (lg.matchday !== 2 * (n - 1) || lg.results.length !== n * (n - 1)) mdOk = false;
  }
  // promotion counts per boundary
  let boundaryOk = true;
  for (const c of C) {
    for (let l = 1; l < LS.levels; l++) {
      if (py.outcome.relegated[leagueKey(c, l)].length !== py.outcome.promoted[leagueKey(c, l + 1)].length) boundaryOk = false;
      if (py.outcome.promoted[leagueKey(c, l + 1)].length !== promotedFrom(c, l + 1)) boundaryOk = false;
    }
    if (py.outcome.exchangeOut[c].length !== relegatedFrom(c, LS.levels) || py.outcome.exchangeIn[c].length !== relegatedFrom(c, LS.levels)) boundaryOk = false;
  }
  const mIssues = membershipIssues(state, world, py.nextMembers);
  // clubs at 26, totals
  let bad26 = 0;
  for (const cl of world.clubs) if (world.clubSize(cl.id) !== WORLD.squadSize) bad26++;
  const playable = world.clubs.filter((x) => !x.isBackground).length;
  const bg = world.clubs.length - playable;
  if (totals.live === undefined) Object.assign(totals, { live: world.liveCount, playable, bg, clubs: world.clubs.length });
  const totalsOk = world.clubs.length === totals.clubs && playable === totals.playable && bg === totals.bg && world.liveCount === totals.live;
  if (!tablesOk || !mdOk || !boundaryOk || mIssues.length || bad26 || !totalsOk) {
    console.log(`  ${tag}: tables ${tablesOk} matchdays ${mdOk} boundaries ${boundaryOk} membership ${mIssues.slice(0, 3).join('; ')} clubs!=26 ${bad26} totals ${totalsOk} ${issues.slice(0, 3).join('; ')}`);
  }
  return { tablesOk, mdOk, boundaryOk, membersOk: mIssues.length === 0, bad26, totalsOk };
}

/**
 * A bot season: before each of my matches the bot does what a player would (auto best XI, then rotate tired
 * starters with Auto fix fitness), then the round is played (my match instantly); everything else is simulated.
 */
function botSeason(state, world) {
  for (let guard = 0; guard < 200 && state.season.phase !== 'done'; guard++) {
    if (nextMatchInfo(state, world)) { autoBestXI(state, world); autoFixFitness(state, world); }
    const r = simRounds(state, world, 1);
    if (!r.ok) return r;
  }
  return { ok: state.season.phase === 'done' };
}

function botRun(label, boost) {
  const t0 = performance.now();
  const { world, state } = newGame(SEED, SIZE);
  if (boost) setBoost(state, boost);
  const prep0 = prepareMatch(state, world);
  const myTeam = prep0.info.homeIsMe ? prep0.home : prep0.away;
  const xiOvr = myTeam.xi.reduce((x, p) => x + p.ovr, 0) / myTeam.xi.length;
  const rowsOut = [];
  const agg = { tablesOk: true, mdOk: true, boundaryOk: true, membersOk: true, bad26: 0, totalsOk: true };
  const totals = {};
  const seasonMs = [];
  let ups = 0, downs = 0;
  for (let s = 1; s <= SEASONS; s++) {
    const ts = performance.now();
    const r = botSeason(state, world);
    seasonMs.push(performance.now() - ts);
    if (!r.ok) { check(`${label}: season ${s} finished`, false, r.error); break; }
    const c = seasonChecks(state, world, `${label} s${s}`, totals);
    for (const k of ['tablesOk', 'mdOk', 'boundaryOk', 'membersOk', 'totalsOk']) agg[k] = agg[k] && c[k];
    agg.bad26 += c.bad26;
    const sm = state.season.summary;
    if (sm.promoted) ups++;
    if (sm.relegated) downs++;
    rowsOut.push([sm.season, `${sm.country}${sm.level}`, sm.position, sm.points, sm.champion.slice(0, 24), sm.playoff || '-', sm.promoted ? 'UP' : sm.relegated ? 'DOWN' : '-', sm.newLevel]);
    newSeason(state, world);
  }
  console.log(`\n  ${label} (team boost ${boost >= 0 ? '+' : ''}${boost}, XI OVR in matches ${xiOvr.toFixed(1)}): ${(performance.now() - t0).toFixed(0)} ms total, season median ${median(seasonMs).toFixed(0)} ms`);
  table([['season', 'league', 'pos', 'pts', 'champion of my league', 'playoff', 'move', 'next'], ...rowsOut], [7, 7, 4, 4, 25, 10, 5, 5]);
  console.log(`  promotions ${ups}, relegations ${downs}`);
  check(`${label}: tables consistent every season (pts = 3w + d, p = 2(n-1), goals for = goals against)`, agg.tablesOk && agg.mdOk);
  check(`${label}: promoted = relegated at every boundary, exchange = level-5 promoted count`, agg.boundaryOk);
  check(`${label}: every level keeps its size, no club twice, world divisions match the pyramid`, agg.membersOk);
  check(`${label}: every club keeps 26 players, totals constant (players, playable and background clubs)`, agg.bad26 === 0 && agg.totalsOk);
  return { ups, downs, state, world, seasonMs };
}

section(`Bot runs: ${SEASONS} seasons, my matches instant, everything else simulated (size ${SIZE})`);
const bad = botRun('starter squad', 0);
const good = botRun('decent squad', 16);
check('a decent squad climbs (net promotions >= 2), the starter squad does not out-climb it', good.ups - good.downs >= Math.min(2, SEASONS - 1) && good.state.season.level < bad.state.season.level, `decent level ${good.state.season.level}, starter level ${bad.state.season.level}`);
check('stats screen views work on the final season state', (() => { try { const t = teamStats(good.state, good.world); const l = leagueStats(good.state, good.world); return t && l && l.table.length === myLeague(good.state).clubIds.length; } catch (e) { console.log(e); return false; } })());

// ---------------------------------------------------------------- determinism, plausibility, timings
section('Determinism, plausibility and timings (one season, size ' + SIZE + ')');
{
  const run = () => {
    const { world, state } = newGame(SEED, SIZE);
    const rt = [];
    const tSeason = performance.now();
    let guard = 0;
    while (state.season.phase === 'league' && guard++ < 100) {
      const t = performance.now();
      simRounds(state, world, 1);
      rt.push(performance.now() - t);
    }
    simToSeasonEnd(state, world);
    const seasonMs = performance.now() - tSeason;
    const py = state.season.pyramid;
    const tables = py.order.map((k) => sortLeague(py.leagues[k]).map((r) => [r.clubId, r.pts, r.gf, r.ga].join(':')).join(','));
    return { state, world, rt, seasonMs, sig: JSON.stringify(tables) + JSON.stringify(py.playoffs) + JSON.stringify(py.nextMembers) };
  };
  const cache0 = aiCacheStats();
  const a = run();
  const cache1 = aiCacheStats();
  const b = run();
  check('same seed twice: identical final tables of all 25 leagues, playoffs and next memberships', a.sig === b.sig, `${a.sig.length} chars`);
  const c = (() => { const { world, state } = newGame(SEED + 1, SIZE); simToSeasonEnd(state, world); const py = state.season.pyramid; return JSON.stringify(py.order.map((k) => sortLeague(py.leagues[k]).map((r) => r.clubId))); })();
  check('different seed gives different tables', c !== JSON.stringify(a.state.season.pyramid.order.map((k) => sortLeague(a.state.season.pyramid.leagues[k]).map((r) => r.clubId))));
  // plausibility across all leagues
  let games = 0, goals = 0, hw = 0, dr = 0;
  const byLevel = {};
  for (const key of a.state.season.pyramid.order) {
    const lg = a.state.season.pyramid.leagues[key];
    const L = (byLevel[lg.level] ||= { g: 0, goals: 0, hw: 0, dr: 0 });
    for (const r of lg.results) { games++; goals += r.hg + r.ag; if (r.hg > r.ag) hw++; else if (r.hg === r.ag) dr++; L.g++; L.goals += r.hg + r.ag; if (r.hg > r.ag) L.hw++; else if (r.hg === r.ag) L.dr++; }
  }
  const gpm = goals / games, hwp = (100 * hw) / games, drp = (100 * dr) / games;
  table([['level', 'matches', 'goals/m', 'home %', 'draw %', 'away %'], ...Object.entries(byLevel).map(([l, v]) => [l, v.g, (v.goals / v.g).toFixed(2), (100 * v.hw / v.g).toFixed(1), (100 * v.dr / v.g).toFixed(1), (100 - 100 * (v.hw + v.dr) / v.g).toFixed(1)]),
    ['all', games, gpm.toFixed(2), hwp.toFixed(1), drp.toFixed(1), (100 - hwp - drp).toFixed(1)]], [6, 8, 8, 7, 7, 7]);
  check('goals per match 2.5-2.9 across all leagues', gpm >= 2.5 && gpm <= 2.9, gpm.toFixed(2));
  check('home win rate 40-50% across all leagues', hwp >= 40 && hwp <= 50, hwp.toFixed(1) + '%');
  const first = a.rt[0], rest = a.rt.slice(1);
  console.log(`  rounds: first ${first.toFixed(0)} ms (cold cache), median ${median(rest).toFixed(0)} ms, max ${Math.max(...rest).toFixed(0)} ms, ${a.rt.length} rounds incl. my matches; season ${a.seasonMs.toFixed(0)} ms (run 2: ${b.seasonMs.toFixed(0)} ms)`);
  console.log(`  AI team cache: ${cache1.misses - cache0.misses} builds, ${cache1.hits - cache0.hits} hits in one season`);
  check('one round of all leagues under 400 ms (median and max after the first)', median(rest) < 400 && Math.max(...rest) < 400, `median ${median(rest).toFixed(0)}, max ${Math.max(...rest).toFixed(0)}`);
  check('a full season of the whole pyramid under 25 s', a.seasonMs < 25000, `${(a.seasonMs / 1000).toFixed(1)} s`);
  const kb = JSON.stringify(a.state).length / 1024;
  console.log(`  save size after a season (state JSON): ${kb.toFixed(0)} KB`);
  check('GameState JSON round trip after a season', JSON.stringify(JSON.parse(JSON.stringify(a.state))) === JSON.stringify(a.state));
  check('leagueRows works for any league key', leagueRows(a.state, a.world, 'GER1').length === 18 && leagueRows(a.state, a.world).some((r) => r.me));
  void playRound; void beginPlayoffs;
}

section('Checks');
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.detail ? '  [' + r.detail + ']' : ''}`);
console.log(`\n${results.length - failures} of ${results.length} checks passed, ${failures} failed.`);
process.exit(failures ? 1 : 0);
