// League tables: fixtures, results, tie-breaks, penalty shootouts. Pure, seeded, JSON-safe data only.
// The 25-league pyramid that uses these lives in pyramid.js.

import { LEAGUE_SYSTEM, PYRAMID } from '../balance.js';
import { clamp } from './rng.js';

/**
 * Circle-method round robin. Returns an array of matchdays, each an array of [homeId, awayId].
 * double=true appends the mirrored second half: 2 * (n - 1) matchdays, every pair meets home and away.
 * Home/away is balanced as well as the circle method allows. Odd counts get a bye (that club sits the day out).
 */
export function roundRobin(clubIds, rng, { double = true } = {}) {
  const ids = clubIds.slice();
  if (rng) rng.shuffle(ids);
  if (ids.length % 2) ids.push(null); // bye
  const n = ids.length;
  const rounds = [];
  const arr = ids.slice();
  const homes = new Map(), streak = new Map(); // streak > 0 = consecutive home games, < 0 = away
  for (const id of ids) { homes.set(id, 0); streak.set(id, 0); }
  for (let r = 0; r < n - 1; r++) {
    const day = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a === null || b === null) continue;
      // greedy: the side that has played fewer recent home games hosts; break ties by home count
      const sa = streak.get(a), sb = streak.get(b);
      const wantA = sa < sb ? 1 : sa > sb ? -1 : homes.get(a) < homes.get(b) ? 1 : homes.get(a) > homes.get(b) ? -1 : (r + i) % 2 === 0 ? 1 : -1;
      const [h, w] = wantA > 0 ? [a, b] : [b, a];
      homes.set(h, homes.get(h) + 1);
      streak.set(h, streak.get(h) > 0 ? streak.get(h) + 1 : 1);
      streak.set(w, streak.get(w) < 0 ? streak.get(w) - 1 : -1);
      day.push([h, w]);
    }
    rounds.push(day);
    // rotate all but the first element
    arr.splice(1, 0, arr.pop());
  }
  if (double) {
    const second = rounds.map((day) => day.map(([h, a]) => [a, h]));
    return rounds.concat(second);
  }
  return rounds;
}

export function emptyTable(clubIds) {
  const t = {};
  for (const id of clubIds) t[id] = { clubId: id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  return t;
}

/** Add one result to a table (win LEAGUE_SYSTEM.pointsWin, draw pointsDraw). */
export function applyResult(table, homeId, awayId, hg, ag) {
  const h = table[homeId], a = table[awayId];
  const W = LEAGUE_SYSTEM.pointsWin, D = LEAGUE_SYSTEM.pointsDraw;
  h.p++; a.p++; h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg;
  if (hg > ag) { h.w++; a.l++; h.pts += W; }
  else if (hg < ag) { a.w++; h.l++; a.pts += W; }
  else { h.d++; a.d++; h.pts += D; a.pts += D; }
}

/**
 * League record (JSON). key e.g. 'ENG3', level 1 = top.
 * @typedef {Object} League
 * @property {string} key
 * @property {string} country
 * @property {number} level
 * @property {number[]} clubIds          club ids (MY_CLUB_ID 0xfffe for my club)
 * @property {Array<Array<[number,number]>>} fixtures  matchdays of [home, away]
 * @property {number} matchday           next matchday index (= number of matchdays played)
 * @property {Object<string,{clubId:number,p:number,w:number,d:number,l:number,gf:number,ga:number,pts:number}>} table
 * @property {{matchday:number, home:number, away:number, hg:number, ag:number}[]} results
 * @property {Object} [tstats]  team stats per club id (stats.js)
 * @property {Object} [pstats]  player stats per world player id (stats.js)
 */

/** A league for a season: double round robin fixtures, empty table. */
export function createLeague(clubIds, rng, { key = '', country = '', level = 0, double = true } = {}) {
  return {
    key, country, level,
    clubIds: clubIds.slice(),
    fixtures: roundRobin(clubIds, rng, { double }),
    matchday: 0,
    table: emptyTable(clubIds),
    results: [],
  };
}

/** The fixture of `clubId` on the league's current matchday, or null (bye / league finished). */
export function nextFixture(league, clubId) {
  const day = league.fixtures[league.matchday];
  if (!day) return null;
  return day.find(([h, a]) => h === clubId || a === clubId) || null;
}

export function recordResult(league, matchday, home, away, hg, ag) {
  applyResult(league.table, home, away, hg, ag);
  league.results.push({ matchday, home, away, hg, ag });
}

export const isLeagueDone = (league) => league.matchday >= league.fixtures.length;

// ------------------------------------------------------------------ sorting and tie-breaks
const gd = (r) => r.gf - r.ga;

/** Mini table of the clubs in `ids` from the league results between them: clubId -> {pts, gd, gf}. */
function headToHead(results, ids) {
  const set = new Set(ids);
  const t = new Map(ids.map((id) => [id, { pts: 0, gd: 0, gf: 0 }]));
  const W = LEAGUE_SYSTEM.pointsWin, D = LEAGUE_SYSTEM.pointsDraw;
  for (const r of results) {
    if (!set.has(r.home) || !set.has(r.away)) continue;
    const h = t.get(r.home), a = t.get(r.away);
    h.gf += r.hg; a.gf += r.ag; h.gd += r.hg - r.ag; a.gd += r.ag - r.hg;
    if (r.hg > r.ag) h.pts += W; else if (r.hg < r.ag) a.pts += W; else { h.pts += D; a.pts += D; }
  }
  return t;
}

/**
 * Order rows that are level on points with the criteria list, recursively: sort by the first criterion, split the
 * group where the value changes, apply the remaining criteria inside each sub-group. 'h2h' is the mini table of the
 * clubs still tied at that point (points, then goal difference, then goals in those matches). Final fallback: club id
 * (stands in for the drawing of lots, so the order stays deterministic).
 */
function orderTied(rows, criteria, results) {
  if (rows.length < 2) return rows;
  if (!criteria.length) return rows.slice().sort((x, y) => x.clubId - y.clubId);
  const [c, ...rest] = criteria;
  let key;
  if (c === 'gd') key = (r) => [gd(r)];
  else if (c === 'gf') key = (r) => [r.gf];
  else if (c === 'h2h') {
    const t = headToHead(results, rows.map((r) => r.clubId));
    key = (r) => { const m = t.get(r.clubId); return [m.pts, m.gd, m.gf]; };
  } else throw new Error(`season: unknown tie-break ${c}`);
  const keyed = rows.map((r) => ({ r, k: key(r) }));
  const cmp = (a, b) => { for (let i = 0; i < a.k.length; i++) if (a.k[i] !== b.k[i]) return b.k[i] - a.k[i]; return 0; };
  keyed.sort((a, b) => cmp(a, b) || a.r.clubId - b.r.clubId);
  const out = [];
  for (let i = 0; i < keyed.length;) {
    let j = i + 1;
    while (j < keyed.length && cmp(keyed[i], keyed[j]) === 0) j++;
    const group = keyed.slice(i, j).map((x) => x.r);
    out.push(...(group.length > 1 ? orderTied(group, rest, results) : group));
    i = j;
  }
  return out;
}

/**
 * Sorted table rows of a league: points, then the country tie-break order (LEAGUE_SYSTEM.tiebreak; default gd, gf),
 * then club id. Pass `tiebreak` to override (unit tests).
 */
export function sortLeague(league, tiebreak = null) {
  const crit = tiebreak || LEAGUE_SYSTEM.tiebreak[league.country] || ['gd', 'gf'];
  const rows = Object.values(league.table).sort((x, y) => y.pts - x.pts || x.clubId - y.clubId);
  const out = [];
  for (let i = 0; i < rows.length;) {
    let j = i + 1;
    while (j < rows.length && rows[j].pts === rows[i].pts) j++;
    const group = rows.slice(i, j);
    out.push(...(group.length > 1 ? orderTied(group, crit, league.results) : group));
    i = j;
  }
  return out;
}

/** Plain points / goal difference / goals order (no league context). */
export function sortedTable(table) {
  return Object.values(table).sort((x, y) =>
    y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.clubId - y.clubId);
}

// ------------------------------------------------------------------ pyramid keys and rules (LEAGUE_SYSTEM)
/** League key of a country and level, e.g. 'ENG3'. */
export const leagueKey = (country, level) => `${country}${level}`;
/** LEAGUE_SYSTEM row of a level: { clubs, promoteAuto, playoff }. */
export const levelRules = (country, level) => LEAGUE_SYSTEM.countries[country][level - 1];
/** Clubs promoted out of a level (automatic places + playoff winner); 0 for level 1. */
export function promotedFrom(country, level) {
  if (level <= 1) return 0;
  const r = levelRules(country, level);
  return r.promoteAuto + (r.playoff ? 1 : 0);
}
/** Clubs relegated out of a level: as many as the level below promotes. The bottom level sends as many to the
 *  background as it promotes (the non-league exchange). */
export function relegatedFrom(country, level) {
  return level < LEAGUE_SYSTEM.levels ? promotedFrom(country, level + 1) : promotedFrom(country, level);
}
/** Key of the league my club plays in this season (state.season.country / level). */
export const myLeagueKey = (state) => leagueKey(state.season.country, state.season.level);
/** My league record (season.js League), or null before the first season starts. */
export function myLeague(state) {
  const py = state && state.season && state.season.pyramid;
  return py ? py.leagues[myLeagueKey(state)] || null : null;
}

// ------------------------------------------------------------------ penalties
/**
 * Seeded rating-weighted shootout. ratingA / ratingB = average XI rating of each side; A kicks first.
 * Best of PYRAMID.penalties.kicks, stops early when decided, then sudden death. Returns { a, b } (never equal).
 */
export function penaltyShootout(rng, ratingA, ratingB) {
  const P = PYRAMID.penalties;
  const pA = clamp(P.base + P.perRatingPoint * (ratingA - ratingB), P.min, P.max);
  const pB = clamp(P.base + P.perRatingPoint * (ratingB - ratingA), P.min, P.max);
  let a = 0, b = 0;
  for (let k = 0; k < P.kicks; k++) {
    if (rng.chance(pA)) a++;
    if (a > b + (P.kicks - k)) break; // B cannot catch up even scoring the rest
    if (b > a + (P.kicks - k - 1)) break;
    if (rng.chance(pB)) b++;
    if (a > b + (P.kicks - k - 1) || b > a + (P.kicks - k - 1)) break;
  }
  for (let r = 0; a === b && r < P.maxRounds; r++) {
    const sa = rng.chance(pA), sb = rng.chance(pB);
    if (sa) a++;
    if (sb) b++;
  }
  if (a === b) { if (ratingA >= ratingB) a++; else b++; } // safety net, practically unreachable
  return { a, b };
}
