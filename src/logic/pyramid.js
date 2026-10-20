// League pyramid: 5 countries x 5 levels (LEAGUE_SYSTEM), all simulated round by round.
// Pure: no DOM, no Math.random, no Date.now. All randomness is seeded from state.seed + season + round + club ids.
//
// State (JSON-safe, lives in state.season):
//   state.season = { number, country, level, phase: 'league' | 'playoffs' | 'done', complete, summary, pyramid }
//   pyramid = {
//     season, round,            // round = next league round index (= matchdays played in the longest league)
//     rounds,                   // max matchdays over the 25 leagues
//     order: ['ENG1' .. 'FRA5'],
//     leagues: { key: League },  // season.js League (+ tstats / pstats from stats.js), MY_CLUB_ID = my club
//     playoffs: { key: Playoff } | null, playoffStage: 0 semi leg 1 | 1 semi leg 2 | 2 final | 3 done,
//     outcome: null | { promoted, relegated, exchangeOut, exchangeIn, champions, playoffWinners },
//     nextMembers: null | { key: clubIds },   // memberships for next season, set when the season is finished
//   }
//   Playoff = { key, country, level, seeds:[4 club ids by final position], winner, ties:[
//     { stage:'semi', a, b, legs:[{home, away, hg, ag}], pens:null|{a, b}, winner },  // a = higher seed (1 / 2)
//     { stage:'semi', a, b, ... }, { stage:'final', a, b, legs, pens, winner } ] }   // final: a = better seed
//
// Flow: one round = one matchday in every league still running (leagues with fewer matchdays finish earlier).
// My own match goes through game.js (prepareMatch / applyMatchResult), which then calls playRound / playPlayoffStage
// for everybody else. settle() moves the season on: all leagues done -> playoffs; playoff stages without me are
// simulated at once; all done -> finishSeason (promotion, relegation, background exchange, prize, history).

import { LEAGUE_SYSTEM, WORLD } from '../balance.js';
import { rngFrom, hashSeed } from './rng.js';
import {
  createLeague, recordResult, sortLeague, isLeagueDone, penaltyShootout, leagueKey, levelRules, promotedFrom,
  relegatedFrom, myLeague, myLeagueKey,
} from './season.js';
import { simulate } from './matchEngine.js';
import { buildOpponentTeam, teamXiRating } from './aiTeams.js';
import { recordMatchStats } from './stats.js';
import { MY_CLUB_ID, leaguePrize } from './economy.js';

export { leagueKey, levelRules, promotedFrom, relegatedFrom, myLeague, myLeagueKey };

const LS = LEAGUE_SYSTEM;
const STAGES = 3; // semi leg 1, semi leg 2, final

// ------------------------------------------------------------------ setup
/**
 * Memberships at game start: every AI club by world division; my club takes the place of the weakest level-5 club of
 * my country (by world.clubRating, ties: higher id), which drops to the background (division 0).
 * Mutates the world (that one club). Returns { key: clubIds }.
 */
export function initialMembers(state, world) {
  const members = {};
  const country = state.season.country;
  for (const c of WORLD.countries) {
    for (let level = 1; level <= LS.levels; level++) members[leagueKey(c, level)] = world.clubsOf(c, level).map((x) => x.id);
  }
  const key = leagueKey(country, LS.startLevel);
  const ids = members[key];
  let weakest = -1, wr = Infinity;
  for (const id of ids) {
    const r = world.clubRating(id);
    if (r < wr || (r === wr && id > weakest)) { wr = r; weakest = id; }
  }
  members[key] = ids.map((id) => (id === weakest ? MY_CLUB_ID : id));
  world.setClubDivision(weakest, 0);
  return members;
}

/** New season of the pyramid from memberships: fixtures for 25 leagues, phase 'league'. */
export function startPyramidSeason(state, members) {
  const n = state.season.number;
  const leagues = {};
  const order = [];
  for (const country of WORLD.countries) {
    for (let level = 1; level <= LS.levels; level++) {
      const key = leagueKey(country, level);
      const ids = members[key];
      if (!ids || ids.length !== levelRules(country, level).clubs) throw new Error(`pyramid: ${key} has ${ids ? ids.length : 0} clubs`);
      const rng = rngFrom(hashSeed(`fixtures|${state.seed}|${n}|${key}`));
      leagues[key] = createLeague(ids, rng, { key, country, level });
      order.push(key);
    }
  }
  state.season.pyramid = {
    season: n, round: 0, rounds: Math.max(...order.map((k) => leagues[k].fixtures.length)), order, leagues,
    playoffs: null, playoffStage: 0, outcome: null, nextMembers: null,
  };
  state.season.phase = 'league';
  state.season.complete = false;
  state.season.summary = null;
}

// ------------------------------------------------------------------ simulation helpers
const matchSeed = (state, tag) => hashSeed(`${tag}|${state.seed}|${state.season.number}`);

/** Lite-engine match between two AI clubs. Returns { res, home, away } (MatchTeams for ratings). */
function simAI(state, world, h, a, seedTag) {
  const seed = matchSeed(state, seedTag);
  const rng = rngFrom(seed);
  const home = buildOpponentTeam(state, world, h, rng, { isHome: true });
  const away = buildOpponentTeam(state, world, a, rng, { isHome: false });
  const res = simulate(home, away, seed, { lite: true });
  return { res, home, away };
}

export const allLeaguesDone = (py) => py.order.every((k) => isLeagueDone(py.leagues[k]));

const involvesMe = (h, a) => h === MY_CLUB_ID || a === MY_CLUB_ID;

/**
 * Play the current round in every league still running, except my own fixture, which must already be recorded
 * (game.applyMatchResult does that first). Returns the results of my league in this round (other fixtures only).
 */
export function playRound(state, world) {
  if (state.season.phase !== 'league') throw new Error('pyramid: playRound outside the league phase');
  const py = state.season.pyramid;
  const myKey = myLeagueKey(state);
  const mine = [];
  for (const key of py.order) {
    const lg = py.leagues[key];
    if (isLeagueDone(lg)) continue;
    const md = lg.matchday;
    for (const [h, a] of lg.fixtures[md]) {
      if (involvesMe(h, a)) {
        if (!lg.results.some((r) => r.matchday === md && involvesMe(r.home, r.away))) throw new Error('pyramid: my match of this round is not played yet');
        continue;
      }
      const { res } = simAI(state, world, h, a, `m|${py.round}|${h}|${a}`);
      recordResult(lg, md, h, a, res.score.home, res.score.away);
      recordMatchStats(lg, h, a, res);
      if (key === myKey) mine.push({ home: h, away: a, hg: res.score.home, ag: res.score.away });
    }
    lg.matchday++;
  }
  py.round++;
  return mine;
}

// ------------------------------------------------------------------ playoffs
/** Build the playoff brackets from the final tables (levels with playoff: true). Phase -> 'playoffs'. */
export function beginPlayoffs(state) {
  const py = state.season.pyramid;
  py.playoffs = {};
  for (const key of py.order) {
    const lg = py.leagues[key];
    const rules = levelRules(lg.country, lg.level);
    if (!rules.playoff) continue;
    const rows = sortLeague(lg);
    const seeds = rows.slice(rules.promoteAuto, rules.promoteAuto + LS.playoff.teams).map((r) => r.clubId);
    py.playoffs[key] = {
      key, country: lg.country, level: lg.level, seeds, winner: null,
      ties: [
        { stage: 'semi', a: seeds[0], b: seeds[3], legs: [], pens: null, winner: null },
        { stage: 'semi', a: seeds[1], b: seeds[2], legs: [], pens: null, winner: null },
        { stage: 'final', a: null, b: null, legs: [], pens: null, winner: null },
      ],
    };
  }
  py.playoffStage = 0;
  state.season.phase = 'playoffs';
}

/** Ties of a stage: [tieIndex, home, away] (semi leg 1 hosted by the lower seed, leg 2 and final by the higher). */
export function stageFixtures(po, stage) {
  if (stage === 0) return [0, 1].map((i) => [i, po.ties[i].b, po.ties[i].a]);
  if (stage === 1) return [0, 1].map((i) => [i, po.ties[i].a, po.ties[i].b]);
  if (stage === 2) return [[2, po.ties[2].a, po.ties[2].b]];
  return [];
}

/** My playoff match at the current stage that is not played yet: { key, tieIndex, stage, home, away } or null. */
export function myPlayoffFixture(state) {
  const py = state.season.pyramid;
  if (state.season.phase !== 'playoffs' || !py.playoffs) return null;
  const po = py.playoffs[myLeagueKey(state)];
  if (!po || py.playoffStage >= STAGES) return null;
  for (const [ti, h, a] of stageFixtures(po, py.playoffStage)) {
    if (!involvesMe(h, a)) continue;
    const tie = po.ties[ti];
    const legNo = py.playoffStage === 1 ? 1 : 0;
    if (tie.legs.length > legNo) return null; // already played
    return { key: po.key, tieIndex: ti, stage: py.playoffStage, home: h, away: a };
  }
  return null;
}

/**
 * Record one playoff leg. On the deciding leg (semi leg 2, final) a level tie (aggregate for semis) goes to a
 * rating-weighted shootout seeded by `pensSeed`. Returns { pens: null | {home, away} } for the leg.
 */
export function recordPlayoffLeg(po, tieIndex, stage, home, away, hg, ag, ratingHome, ratingAway, pensSeed) {
  const tie = po.ties[tieIndex];
  tie.legs.push({ home, away, hg, ag });
  const deciding = stage === 1 || stage === 2;
  if (!deciding) return { pens: null };
  let ga = 0, gb = 0;
  for (const l of tie.legs) {
    ga += l.home === tie.a ? l.hg : l.ag;
    gb += l.home === tie.b ? l.hg : l.ag;
  }
  let pens = null;
  if (ga > gb) tie.winner = tie.a;
  else if (gb > ga) tie.winner = tie.b;
  else {
    const s = penaltyShootout(rngFrom(pensSeed >>> 0), ratingHome, ratingAway); // home side kicks first
    pens = { home: s.a, away: s.b };
    tie.pens = home === tie.a ? { a: s.a, b: s.b } : { a: s.b, b: s.a };
    tie.winner = tie.pens.a > tie.pens.b ? tie.a : tie.b;
  }
  if (stage === 1 && po.ties[0].winner != null && po.ties[1].winner != null) {
    const w = [po.ties[0].winner, po.ties[1].winner];
    const seedIdx = (id) => po.seeds.indexOf(id);
    w.sort((x, y) => seedIdx(x) - seedIdx(y));
    po.ties[2].a = w[0];
    po.ties[2].b = w[1];
  }
  if (stage === 2) po.winner = tie.winner;
  return { pens };
}

/** Simulate the current playoff stage in every bracket (my tie is skipped: game.js records it), then advance. */
export function playPlayoffStage(state, world) {
  const py = state.season.pyramid;
  if (state.season.phase !== 'playoffs') throw new Error('pyramid: not in the playoffs');
  const stage = py.playoffStage;
  for (const key of Object.keys(py.playoffs)) {
    const po = py.playoffs[key];
    for (const [ti, h, a] of stageFixtures(po, stage)) {
      const tie = po.ties[ti];
      const legNo = stage === 1 ? 1 : 0;
      if (tie.legs.length > legNo) continue; // already recorded (my match)
      if (involvesMe(h, a)) throw new Error('pyramid: my playoff match of this stage is not played yet');
      const tag = `po|${key}|${stage}|${h}|${a}`;
      const { res, home, away } = simAI(state, world, h, a, tag);
      recordPlayoffLeg(po, ti, stage, h, a, res.score.home, res.score.away, teamXiRating(home), teamXiRating(away), matchSeed(state, 'pens|' + tag));
    }
  }
  py.playoffStage++;
}

// ------------------------------------------------------------------ moving the season on
/**
 * Advance whatever does not need me: start the playoffs when every league is done, simulate playoff stages without
 * my club, finish the season after the final stage. Stops when I have a match to play or the season is done.
 * Returns the phase.
 */
export function settle(state, world) {
  const py = state.season.pyramid;
  if (state.season.phase === 'league') {
    if (!allLeaguesDone(py)) return state.season.phase;
    beginPlayoffs(state);
  }
  let guard = 0;
  while (state.season.phase === 'playoffs' && guard++ < 10) {
    if (myPlayoffFixture(state)) return state.season.phase;
    if (py.playoffStage >= STAGES) { finishSeason(state, world); break; }
    playPlayoffStage(state, world);
  }
  return state.season.phase;
}

/** Display name of a club id (my club included). */
export function clubLabel(state, world, id) {
  return id === MY_CLUB_ID ? state.club.name : (world.getClub(id)?.name ?? '?');
}

/**
 * End of season: promotion (automatic + playoff winner), relegation (as many as the level below promotes), the level-5
 * exchange with the country's strongest background clubs, world divisions updated, my prize, summary and history.
 * Phase -> 'done', season.complete = true. Next season: game.newSeason (uses pyramid.nextMembers).
 */
export function finishSeason(state, world) {
  const py = state.season.pyramid;
  const promoted = {}, relegated = {}, exchangeOut = {}, exchangeIn = {}, champions = {}, playoffWinners = {};
  const next = {};
  const newLevel = new Map(); // club id -> new level (0 = background)
  for (const country of WORLD.countries) {
    const rows = {};
    for (let l = 1; l <= LS.levels; l++) rows[l] = sortLeague(py.leagues[leagueKey(country, l)]).map((r) => r.clubId);
    const up = {}, down = {};
    for (let l = 1; l <= LS.levels; l++) {
      const key = leagueKey(country, l);
      const rules = levelRules(country, l);
      champions[key] = rows[l][0];
      up[l] = l > 1 ? rows[l].slice(0, rules.promoteAuto) : [];
      if (l > 1 && rules.playoff) {
        const w = py.playoffs && py.playoffs[key] ? py.playoffs[key].winner : null;
        if (w == null) throw new Error(`pyramid: playoff of ${key} has no winner`);
        up[l].push(w);
        playoffWinners[key] = w;
      }
      if (l < LS.levels) down[l] = rows[l].slice(rows[l].length - relegatedFrom(country, l));
    }
    // bottom level: exchange with the background (my club never leaves the pyramid: skip it, take the next one up)
    const nOut = relegatedFrom(country, LS.levels);
    const outIds = [];
    for (let i = rows[LS.levels].length - 1; i >= 0 && outIds.length < nOut; i--) {
      const id = rows[LS.levels][i];
      if (id === MY_CLUB_ID || up[LS.levels].includes(id)) continue;
      outIds.push(id);
    }
    down[LS.levels] = outIds;
    const bg = world.backgroundClubsOf(country).map((c) => ({ id: c.id, r: world.clubRating(c.id) }));
    bg.sort((x, y) => y.r - x.r || x.id - y.id);
    const inIds = bg.slice(0, nOut).map((x) => x.id);
    if (inIds.length < nOut) throw new Error(`pyramid: ${country} has only ${inIds.length} background clubs for the exchange`);
    exchangeOut[country] = outIds;
    exchangeIn[country] = inIds;
    for (let l = 1; l <= LS.levels; l++) {
      const key = leagueKey(country, l);
      promoted[key] = up[l];
      relegated[key] = down[l];
      const leaving = new Set([...up[l], ...down[l]]);
      const stay = py.leagues[key].clubIds.filter((id) => !leaving.has(id));
      const fromAbove = l > 1 ? down[l - 1] : [];
      const fromBelow = l < LS.levels ? up[l + 1] : inIds;
      next[key] = [...stay, ...fromAbove, ...fromBelow];
      for (const id of fromAbove) newLevel.set(id, l);
      for (const id of fromBelow) newLevel.set(id, l);
      if (next[key].length !== levelRules(country, l).clubs) throw new Error(`pyramid: ${key} would have ${next[key].length} clubs`);
    }
    for (const id of outIds) newLevel.set(id, 0);
  }
  for (const [id, l] of newLevel) if (id !== MY_CLUB_ID) world.setClubDivision(id, l);

  // my club
  const myKey = myLeagueKey(state);
  const lg = py.leagues[myKey];
  const rows = sortLeague(lg);
  const pos = rows.findIndex((r) => r.clubId === MY_CLUB_ID) + 1;
  const me = rows[pos - 1];
  const level = state.season.level;
  const myNew = newLevel.has(MY_CLUB_ID) ? newLevel.get(MY_CLUB_ID) : level;
  const prize = leaguePrize(pos, rows.length, level);
  state.coins += prize;
  const po = py.playoffs && py.playoffs[myKey];
  let playoff = null;
  if (po && po.seeds.includes(MY_CLUB_ID)) {
    playoff = po.winner === MY_CLUB_ID ? 'won' : (po.ties[2].a === MY_CLUB_ID || po.ties[2].b === MY_CLUB_ID) ? 'lostFinal' : 'lostSemi';
  }
  const summary = {
    season: state.season.number, country: state.season.country, level, position: pos, points: me.pts, prize,
    champion: clubLabel(state, world, rows[0].clubId), championId: rows[0].clubId,
    promoted: myNew < level, relegated: myNew > level, playoff, newLevel: myNew,
    rows: rows.map((r) => ({ clubId: r.clubId, name: clubLabel(state, world, r.clubId), p: r.p, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, pts: r.pts })),
  };
  py.outcome = { promoted, relegated, exchangeOut, exchangeIn, champions, playoffWinners };
  py.nextMembers = next;
  state.season.summary = summary;
  state.season.phase = 'done';
  state.season.complete = true;
  const { rows: _omit, ...hist } = summary;
  state.history.push(hist);
  return summary;
}

/** True when the pyramid memberships match the world divisions (AI clubs) and no club appears twice. Tools. */
export function membershipIssues(state, world, members) {
  const issues = [];
  const seen = new Set();
  for (const country of WORLD.countries) {
    for (let l = 1; l <= LS.levels; l++) {
      const key = leagueKey(country, l);
      const ids = members[key];
      if (ids.length !== levelRules(country, l).clubs) issues.push(`${key} size ${ids.length}`);
      for (const id of ids) {
        if (seen.has(id)) issues.push(`club ${id} twice`);
        seen.add(id);
        if (id === MY_CLUB_ID) continue;
        const c = world.getClub(id);
        if (!c || c.country !== country || c.division !== l || c.isBackground) issues.push(`club ${id} in ${key} but world says ${c && c.country}${c && c.division}`);
      }
    }
  }
  const playable = world.clubs.filter((c) => !c.isBackground).length;
  if (playable + 1 !== seen.size) issues.push(`world has ${playable} playable clubs, pyramid ${seen.size - 1} AI clubs`);
  return issues;
}
