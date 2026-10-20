// Game rules that sit above the engine: new game, team building for matches, applying results, the season flow
// through the league pyramid (pyramid.js). Pure: no DOM, no Math.random, no Date.now. Randomness comes from rng
// arguments or from seeds derived from state.seed.

import { rngFrom, hashSeed } from './rng.js';
import { WORLD, DEFAULT_SETTINGS, FITNESS, recoverFitness, MORALE, FORM, GAME, CARD_LIMITS, RARITY, LEAGUE_SYSTEM } from '../balance.js';
import { FORMATIONS } from './formations.js';
import { buildMatchTeam } from './cardEffects.js';
import { simulate, createMatch } from './matchEngine.js';
import { nextFixture, recordResult, sortLeague, isLeagueDone } from './season.js';
import { MY_CLUB_ID, openStarter, matchIncome, iconWorldPlayer } from './economy.js';
import { recordMatchStats } from './stats.js';
import { autoBestXI, equippedTacticIds, isAvailable } from './squad.js';
import { awayColours, buildOpponentTeam, teamXiRating } from './aiTeams.js';
import {
  initialMembers, startPyramidSeason, playRound, playPlayoffStage, settle, myPlayoffFixture, recordPlayoffLeg,
  myLeague, myLeagueKey, allLeaguesDone,
} from './pyramid.js';
import { S } from '../strings.js';

export { awayColours, pickAIXI, buildOpponentTeam, STYLE_SETTINGS } from './aiTeams.js';
export { myLeague, myLeagueKey, leagueKey } from './pyramid.js';

export const STATE_VERSION = 2;

/** Fresh game state (no world yet). `club` = { name, colours:[a,b], crest }. */
export function createState({ seed, worldSize = WORLD.defaultPlayers, country = 'ENG', club, favouriteNation = null, settings = {} }) {
  return {
    version: STATE_VERSION, seed, worldSize, country, favouriteNation: favouriteNation || country, nationalJob: null,
    coins: 0,
    club: { name: club.name, colours: club.colours, crest: club.crest, stadiumTier: 0, facilities: { training: 0, medical: 0, academy: 0 } },
    cards: [],
    squad: {
      formation: '4-3-3', xi: [], bench: [], tacticCards: [],
      settings: { ...DEFAULT_SETTINGS },
      roles: { captain: null, penalties: null, freeKicks: null, corners: null },
      managerId: null, presets: [null, null, null],
    },
    // pyramid: see pyramid.js. level = the level my club plays THIS season (summary.newLevel after it ends).
    season: { number: 1, country, level: LEAGUE_SYSTEM.startLevel, phase: 'league', complete: false, summary: null, pyramid: null },
    market: [], objectives: [], pity: { gold: 0 },
    settings: { sound: true, animation: 2, matchSpeed: 1, highlights: true, ...settings },
    counters: { card: 1, match: 0 },
    iconPool: [], history: [], lastMatch: null,
  };
}

/** Starter pack, auto-built XI, first pyramid season (my club replaces the weakest level-5 club of my country). */
export function startGame(state, world, rng) {
  state.iconPool = makeIconPool(rng.fork('icons'), 12);
  const pack = openStarter(state, world, rng.fork('starter'));
  const mgr = state.cards.find((c) => c.kind === 'manager');
  if (mgr) state.squad.managerId = mgr.id;
  autoBestXI(state, world);
  state.season.country = state.country;
  state.season.level = LEAGUE_SYSTEM.startLevel;
  startPyramidSeason(state, initialMembers(state, world));
  return pack;
}

// ------------------------------------------------------------------ icons (outside the world)
const ICON_POS = ['ST', 'W', 'AM', 'CM', 'DM', 'CB', 'FB', 'GK'];
export function makeIconPool(rng, n) {
  const out = [];
  const names = ['Valerio Brandt', 'Matteo Okonjo', 'Rafael Montero', 'Dmitri Halvorsen', 'Kofi Lindqvist', 'Aurelien Faure', 'Tomas Ibarra', 'Nikolai Reyes', 'Cesar Petrov', 'Bruno Adeyemi', 'Lucien Marchetti', 'Hakan Oyelaran'];
  const nations = ['FRA', 'BRA', 'ARG', 'ESP', 'ITA', 'GER', 'NED', 'POR', 'ENG', 'URU'];
  for (let i = 0; i < n; i++) {
    const pos = ICON_POS[i % ICON_POS.length];
    const ovr = rng.int(RARITY.icon.min, RARITY.icon.max);
    const keys = pos === 'GK' ? ['div', 'han', 'kic', 'ref', 'spd', 'pos', 'men'] : ['pac', 'sho', 'pas', 'dri', 'def', 'phy', 'men'];
    const stats = {};
    for (const k of keys) stats[k] = Math.min(99, ovr + rng.int(-6, 6));
    out.push({
      id: `icon${i}`, kind: 'player', playerId: 900000 + i, isIcon: true, rarity: 'icon', signedFromClubId: -1, leagueId: '',
      upgrades: [], traits: [], styleId: null, fitness: 100, morale: GAME.iconStartMorale, form: 0, contract: GAME.iconContract,
      injuredFor: 0, suspendedFor: 0, yellows: 0, career: { apps: 0, goals: 0, assists: 0, cleanSheets: 0, avgRating: 0 },
      icon: { name: names[i % names.length], nation: nations[i % nations.length], pos, age: 35, foot: 'R', stats, ovr },
    });
  }
  return out;
}

// ------------------------------------------------------------------ league views
export function clubRecord(state, world, id) {
  if (id === MY_CLUB_ID) return { id, name: state.club.name, colours: state.club.colours, crest: state.club.crest, country: state.country };
  return world.getClub(id);
}
export const clubName = (state, world, id) => clubRecord(state, world, id)?.name ?? '?';

/**
 * Sorted table rows of a league with the country tie-breaks (default: my league).
 * Each row: { clubId, p, w, d, l, gf, ga, pts, pos, name, me, club }.
 */
export function leagueRows(state, world, key = null) {
  const py = state.season.pyramid;
  const lg = key ? py && py.leagues[key] : myLeague(state);
  if (!lg) return [];
  return sortLeague(lg).map((r, i) => ({ ...r, pos: i + 1, name: clubName(state, world, r.clubId), me: r.clubId === MY_CLUB_ID, club: clubRecord(state, world, r.clubId) }));
}

// ------------------------------------------------------------------ team building
export function worldPlayerOf(card, world) {
  return card.isIcon ? iconWorldPlayer(card) : world.getPlayer(card.playerId);
}

export function staffLevelsOf(state) {
  const lv = {};
  for (const c of state.cards) if (c.kind === 'staff') lv[c.role] = Math.max(lv[c.role] || 0, c.level || 1);
  return lv;
}

/**
 * Make the XI playable: every slot filled with an available, distinct player card. Empty or unavailable (injured,
 * suspended) starters are replaced from the bench, then the reserves, preferring natural position, then secondary,
 * then any outfielder (keeper slot: keepers only). Bench entries that are unavailable or duplicated are dropped.
 * Returns { ok, changes, error }. ok=false when fewer than 11 available cards exist (or no keeper).
 * opts.emergencyKeeper: with no available keeper, an outfielder goes in goal instead of failing (used by the season
 * simulation, so a long season cannot deadlock: injuries and bans only count down when my club plays).
 */
export function repairLineup(state, world, opts = {}) {
  const sq = state.squad;
  const byId = new Map(state.cards.map((c) => [c.id, c]));
  const slots = FORMATIONS[sq.formation].slots;
  const usable = (id) => { const c = byId.get(id); return c && c.kind === 'player' && isAvailable(c); };
  const changes = [];
  const used = new Set();
  const xi = Array.from({ length: slots.length }, (_, i) => sq.xi[i] ?? null);
  for (let i = 0; i < xi.length; i++) {
    if (xi[i] != null && usable(xi[i]) && !used.has(xi[i])) used.add(xi[i]); else xi[i] = null;
  }
  const pool = () => {
    const ids = [...sq.bench, ...state.cards.filter((c) => c.kind === 'player').map((c) => c.id)];
    return ids.filter((id, k) => ids.indexOf(id) === k && usable(id) && !used.has(id));
  };
  for (let i = 0; i < xi.length; i++) {
    if (xi[i] != null) continue;
    const want = slots[i].pos;
    const cand = pool();
    const wp = (id) => worldPlayerOf(byId.get(id), world);
    let pick = cand.find((id) => wp(id).pos === want)
      ?? cand.find((id) => (wp(id).altPos || []).includes(want))
      ?? cand.find((id) => (want === 'GK') === (wp(id).pos === 'GK'))
      ?? (want === 'GK' && opts.emergencyKeeper ? cand[0] : undefined);
    if (pick == null) {
      return { ok: false, changes, error: want === 'GK' ? S.errors.noGoalkeeper : S.errors.notEnoughFit };
    }
    xi[i] = pick; used.add(pick);
    changes.push({ slot: i, card: pick });
  }
  const bench = [];
  for (const id of sq.bench) if (usable(id) && !used.has(id) && !bench.includes(id)) bench.push(id);
  for (const id of pool()) { if (bench.length >= CARD_LIMITS.benchSize) break; if (!bench.includes(id)) bench.push(id); }
  sq.xi = xi;
  sq.bench = bench.slice(0, CARD_LIMITS.benchSize);
  return { ok: true, changes };
}

/** My MatchTeam from the current squad (call repairLineup first; it throws on an invalid XI). */
export function buildMyTeam(state, world, rng, { isHome = true, vsColour = null } = {}) {
  const byId = new Map(state.cards.map((c) => [c.id, c]));
  const sq = state.squad;
  if (sq.xi.length !== FORMATIONS[sq.formation].slots.length || sq.xi.some((id) => !byId.get(id))) throw new Error('invalid XI');
  const member = (cardId, number) => {
    const card = byId.get(cardId);
    return { card, worldPlayer: worldPlayerOf(card, world), number };
  };
  const manager = sq.managerId ? byId.get(sq.managerId) : null;
  const boost = (state.cheats && state.cheats.boost) || 0; // cheat menu only
  const colours = vsColour ? awayColours(vsColour, state.club.colours) : state.club.colours;
  const team = buildMatchTeam({
    id: String(MY_CLUB_ID), name: state.club.name, colours, crest: state.club.crest, formation: sq.formation,
    xiCards: sq.xi.map((id, i) => member(id, i + 1)), benchCards: sq.bench.map((id, i) => member(id, 12 + i)),
    settings: sq.settings, tacticCards: equippedTacticIds(state), roles: sq.roles, staff: staffLevelsOf(state), manager,
    isHome, isAI: false, rng: rng.fork('mycons'),
  });
  if (boost) {
    for (const p of [...team.xi, ...team.bench]) {
      for (const k of Object.keys(p.stats)) p.stats[k] = Math.min(99, p.stats[k] + boost);
      p.ovr = Math.min(99, p.ovr + boost);
    }
  }
  return team;
}

// ------------------------------------------------------------------ match flow
const PLAYOFF_STAGE_IDS = ['semi1', 'semi2', 'final'];

function infoOf(state, world, home, away, extra) {
  const homeIsMe = home === MY_CLUB_ID;
  const oppId = homeIsMe ? away : home;
  return { ...extra, fixture: [home, away], homeIsMe, oppId, opp: world.getClub(oppId), oppRating: world.clubRating(oppId) };
}

/**
 * My next match, or null (season done, my league finished while others play on, or a bye).
 * League: { phase:'league', leagueKey, matchday, round, fixture:[home, away], homeIsMe, oppId, opp, oppRating }.
 * Playoffs: same plus { phase:'playoffs', stage: 0|1|2, playoffStage: 'semi1'|'semi2'|'final', tieIndex };
 * matchday then counts on from the league matchdays (display and match seed only).
 */
export function nextMatchInfo(state, world) {
  const s = state.season;
  const py = s && s.pyramid;
  if (!py) return null;
  if (s.phase === 'league') {
    const lg = myLeague(state);
    if (!lg || isLeagueDone(lg)) return null;
    const fx = nextFixture(lg, MY_CLUB_ID);
    if (!fx) return null;
    return infoOf(state, world, fx[0], fx[1], { phase: 'league', leagueKey: lg.key, matchday: lg.matchday, round: py.round });
  }
  if (s.phase === 'playoffs') {
    const p = myPlayoffFixture(state);
    if (!p) return null;
    const lg = myLeague(state);
    return infoOf(state, world, p.home, p.away, {
      phase: 'playoffs', leagueKey: p.key, matchday: lg.fixtures.length + p.stage, round: py.round + p.stage,
      stage: p.stage, playoffStage: PLAYOFF_STAGE_IDS[p.stage], tieIndex: p.tieIndex,
    });
  }
  return null;
}

/** Teams for the next match (home side first). Seed per match number so replays are reproducible. */
export function prepareMatch(state, world, opts = {}) {
  const info = nextMatchInfo(state, world);
  if (!info) return null;
  const fix = repairLineup(state, world, opts);
  if (!fix.ok) return { error: fix.error, info };
  const seed = (state.seed * 31 + state.counters.match * 977 + info.matchday) >>> 0;
  const rng = rngFrom(seed);
  const me = buildMyTeam(state, world, rng, { isHome: info.homeIsMe, vsColour: info.homeIsMe ? null : world.getClub(info.oppId).colours[0] });
  const opp = buildOpponentTeam(state, world, info.oppId, rng, { isHome: !info.homeIsMe, vsColour: info.homeIsMe ? state.club.colours[0] : null });
  const home = info.homeIsMe ? me : opp;
  const away = info.homeIsMe ? opp : me;
  return { info, seed, home, away, repaired: fix.changes };
}

const sameFixture = (a, b) => !!a && !!b && a.phase === b.phase && a.matchday === b.matchday && a.fixture[0] === b.fixture[0] && a.fixture[1] === b.fixture[1];

/**
 * Apply a finished match of mine (engine `simulate` / `summarise` result) to the state.
 * Updates cards (fitness, injuries, suspensions, form, morale, career) and coins, records the result, then moves the
 * whole pyramid on: league phase -> every other fixture of the round in all 25 leagues (lite engine); playoffs ->
 * every other tie of the stage (a drawn deciding match of mine goes to an instant penalty shootout). Then settle():
 * playoffs start when all leagues are done, the season finishes after the last playoff stage.
 */
export function applyMatchResult(state, world, res, prep) {
  const { info } = prep;
  if (!sameFixture(info, nextMatchInfo(state, world))) throw new Error('applyMatchResult: this match is not the next one (already applied?)');
  const goalsFor = info.homeIsMe ? res.score.home : res.score.away;
  const goalsAgainst = info.homeIsMe ? res.score.away : res.score.home;
  const won = goalsFor > goalsAgainst, drew = goalsFor === goalsAgainst;

  const lineup = new Set([...state.squad.xi, ...state.squad.bench]);
  for (const c of state.cards) {
    if (c.kind !== 'player') continue;
    const wasOut = c.injuredFor > 0 || c.suspendedFor > 0;
    if (c.injuredFor > 0) c.injuredFor--;
    if (c.suspendedFor > 0) c.suspendedFor--;
    const stat = res.players ? res.players[c.playerId] : null;
    if (stat && stat.minutes > 0) {
      c.fitness = Math.max(0, Math.round(stat.fitness));
      c.career.apps++;
      c.career.goals += stat.goals || 0;
      c.career.assists += stat.assists || 0;
      if (stat.cleanSheet) c.career.cleanSheets++;
      const r = res.ratings ? res.ratings[c.playerId] : undefined;
      if (r !== undefined) {
        c.career.avgRating = Math.round(((c.career.avgRating * (c.career.apps - 1) + r) / c.career.apps) * 100) / 100;
        c.form = Math.max(-FORM.maxSwing, Math.min(FORM.maxSwing, Math.round(c.form * GAME.formKeep + (r - GAME.formRatingBase) * GAME.formRatingScale)));
      }
      if (stat.injured) c.injuredFor = Math.max(c.injuredFor, stat.injuryMatches || 1);
      c.yellows += stat.yellows ? (stat.red && stat.yellows >= 2 ? 0 : stat.yellows) : 0;
      if (stat.red) { c.suspendedFor = Math.max(c.suspendedFor, GAME.redBanMatches); c.yellows = 0; }
      if (c.yellows >= GAME.yellowsForBan) { c.suspendedFor = Math.max(c.suspendedFor, GAME.banMatches); c.yellows = 0; }
      c.morale = clampMorale(c.morale + (won ? GAME.moraleWin : drew ? GAME.moraleDraw : GAME.moraleLoss));
      c.fitness = recoverFitness(c.fitness); // everybody recovers between matches
    } else {
      c.fitness = recoverFitness(c.fitness);
      if (!wasOut) c.morale = clampMorale(c.morale + (lineup.has(c.id) ? GAME.moraleBenchIdle : GAME.moraleUnused));
    }
  }

  const income = matchIncome({ goalsFor, goalsAgainst, home: info.homeIsMe, level: state.season.level, stadiumTier: state.club.stadiumTier });
  state.coins += income;

  const [h, a] = info.fixture;
  let others = [];
  let pens = null;
  if (info.phase === 'playoffs') {
    const po = state.season.pyramid.playoffs[info.leagueKey];
    const r = recordPlayoffLeg(po, info.tieIndex, info.stage, h, a, res.score.home, res.score.away,
      teamXiRating(prep.home), teamXiRating(prep.away), hashSeed(`pens|${state.seed}|${prep.seed}`));
    if (r.pens) pens = info.homeIsMe ? { for: r.pens.home, against: r.pens.away } : { for: r.pens.away, against: r.pens.home };
    playPlayoffStage(state, world);
  } else {
    const lg = myLeague(state);
    recordResult(lg, info.matchday, h, a, res.score.home, res.score.away);
    recordMatchStats(lg, h, a, res);
    others = playRound(state, world);
  }
  state.counters.match++;

  const summary = {
    phase: info.phase, matchday: info.matchday, playoffStage: info.playoffStage || null,
    opp: info.oppId, homeIsMe: info.homeIsMe, goalsFor, goalsAgainst, pens, income,
    mom: res.manOfTheMatch ?? null, others,
  };
  state.lastMatch = summary;
  settle(state, world);
  return summary;
}

function clampMorale(v) { return Math.max(MORALE.min, Math.min(MORALE.max, Math.round(v))); }

/** Live (watched) match: same engine options as the instant path, so default answers give the identical result. */
export function createLiveMatch(prep) {
  return createMatch(prep.home, prep.away, prep.seed, { keyMoments: true, ...GAME.engineOptions });
}

/**
 * Instant result: play my next match with the engine, no view, and apply it (moves the whole pyramid on).
 * opts.emergencyKeeper: see repairLineup.
 */
export function playInstant(state, world, opts = {}) {
  const prep = prepareMatch(state, world, opts);
  if (!prep) return null;
  if (prep.error) return { error: prep.error };
  const res = simulate(prep.home, prep.away, prep.seed, { ...GAME.engineOptions });
  const summary = applyMatchResult(state, world, res, prep);
  return { prep, res, summary };
}

/**
 * Simulate up to n rounds (league rounds, or playoff stages). A round where I have a match plays it instantly
 * (playInstant, an outfielder goes in goal if no keeper is available), otherwise only the other leagues move.
 * Stops at the end of the season. Returns { ok, rounds, mine, error? }.
 */
export function simRounds(state, world, n = 1) {
  let rounds = 0, mine = 0;
  for (let i = 0; i < n; i++) {
    const s = state.season;
    if (!s.pyramid || s.phase === 'done') break;
    if (nextMatchInfo(state, world)) {
      const r = playInstant(state, world, { emergencyKeeper: true });
      if (!r || r.error) return { ok: false, error: r ? r.error : S.match.noFixture, rounds, mine };
      mine++; rounds++;
      continue;
    }
    if (s.phase === 'league' && !allLeaguesDone(s.pyramid)) playRound(state, world);
    else if (s.phase === 'playoffs' && s.pyramid.playoffStage < 3) playPlayoffStage(state, world);
    settle(state, world);
    rounds++;
  }
  return { ok: true, rounds, mine };
}

/** Simulate the rest of the season (my matches instantly) up to phase 'done'. */
export function simToSeasonEnd(state, world) {
  let rounds = 0, mine = 0;
  for (let guard = 0; guard < 200 && state.season.phase !== 'done'; guard++) {
    const r = simRounds(state, world, 1);
    rounds += r.rounds; mine += r.mine;
    if (!r.ok) return { ...r, rounds, mine };
  }
  return { ok: state.season.phase === 'done', rounds, mine };
}

/** Start the next season after the current one is done: my new level, new fixtures for all 25 leagues, fitness reset. */
export function newSeason(state, world) {
  if (!state.season.complete || state.season.phase !== 'done') return { ok: false, error: S.errors.seasonNotFinished };
  const members = state.season.pyramid.nextMembers;
  state.season.number++;
  state.season.level = state.season.summary.newLevel;
  startPyramidSeason(state, members);
  for (const c of state.cards) if (c.kind === 'player') c.fitness = 100;
  return { ok: true };
}

/** Short label data for my current league: { country, level, key }. */
export function myLeagueInfo(state) {
  return { country: state.season.country, level: state.season.level, key: myLeagueKey(state) };
}
