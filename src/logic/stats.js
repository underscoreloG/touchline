// Season statistics: recording (game.applyMatchResult for my matches, pyramid.playRound for every other league match)
// and read-only views for the stats screen. Data lives inside each league of state.season.pyramid (JSON-safe):
// tstats per club, pstats per player id. The views read MY league (season.js myLeague) unless a league is passed.

import { MY_CLUB_ID } from './economy.js';
import { sortLeague, myLeague } from './season.js';

const num = (v) => (Number.isFinite(v) ? v : 0);

export function emptyTeamStats() {
  return { shots: 0, sot: 0, xgf: 0, xga: 0, poss: 0, corners: 0, fouls: 0, yellows: 0, reds: 0, cleanSheets: 0, played: 0 };
}

/** Record one finished match (engine result `res`) for both clubs and every player who took part. */
export function recordMatchStats(lg, homeId, awayId, res) {
  lg.tstats = lg.tstats || {};
  lg.pstats = lg.pstats || {};
  const side = (key, clubId, oppKey) => {
    const t = lg.tstats[clubId] || (lg.tstats[clubId] = emptyTeamStats());
    const st = res.stats || {};
    t.played++;
    t.shots += num(st.shots?.[key]);
    t.sot += num(st.shotsOnTarget?.[key]);
    t.xgf += num(st.xg?.[key]);
    t.xga += num(st.xg?.[oppKey]);
    t.poss += num(st.possession?.[key]);
    t.corners += num(st.corners?.[key]);
    t.fouls += num(st.fouls?.[key]);
    t.yellows += num(st.cards?.[key]?.yellow);
    t.reds += num(st.cards?.[key]?.red);
    if (res.score[oppKey] === 0) t.cleanSheets++;
  };
  side('home', homeId, 'away');
  side('away', awayId, 'home');
  for (const [idStr, p] of Object.entries(res.players || {})) {
    if (!(p.minutes > 0)) continue;
    const clubId = p.team === 'home' ? homeId : awayId;
    const r = lg.pstats[idStr] || (lg.pstats[idStr] = { club: clubId, apps: 0, goals: 0, assists: 0, rating: 0, rated: 0, cs: 0, yellows: 0, reds: 0, saves: 0 });
    r.club = clubId;
    r.apps++;
    r.goals += p.goals || 0;
    r.assists += p.assists || 0;
    r.saves += p.saves || 0;
    if (p.cleanSheet) r.cs++;
    r.yellows += p.yellows || 0;
    if (p.red) r.reds++;
    const rating = res.ratings ? res.ratings[idStr] : undefined;
    if (rating !== undefined) { r.rating += rating; r.rated++; }
  }
}

// ------------------------------------------------------------------ helpers
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

export function playerName(state, world, id) {
  const wp = id < world.size ? world.getPlayer(id) : null;
  if (wp) return wp.name;
  const icon = state.cards.find((c) => c.isIcon && c.playerId === id);
  return icon ? icon.icon.name : '#' + id;
}

export const clubNameOf = (state, world, id) => (id === MY_CLUB_ID ? state.club.name : (world.getClub(id)?.name ?? '?'));

function resultsOf(lg, clubId) {
  return lg.results.filter((r) => r.home === clubId || r.away === clubId).map((r) => {
    const home = r.home === clubId;
    const gf = home ? r.hg : r.ag, ga = home ? r.ag : r.hg;
    return { matchday: r.matchday, home, opp: home ? r.away : r.home, gf, ga, res: gf > ga ? 'W' : gf === ga ? 'D' : 'L' };
  }).sort((a, b) => a.matchday - b.matchday);
}

function pstatRows(state, world, lg, filterClub) {
  return Object.entries(lg.pstats || {})
    .filter(([, p]) => (filterClub === undefined ? true : p.club === filterClub))
    .map(([id, p]) => ({ id: Number(id), name: playerName(state, world, Number(id)), club: p.club, clubName: clubNameOf(state, world, p.club), apps: p.apps, goals: p.goals, assists: p.assists, avg: p.rated ? r2(p.rating / p.rated) : 0, cs: p.cs, yellows: p.yellows, reds: p.reds, saves: p.saves }));
}

// ------------------------------------------------------------------ views
/** My team: record, form, splits, team numbers, and my players this season plus career. */
export function teamStats(state, world, lg = myLeague(state)) {
  const me = MY_CLUB_ID;
  const row = sortLeague(lg).map((r, i) => ({ ...r, pos: i + 1 })).find((r) => r.clubId === me);
  const res = resultsOf(lg, me);
  const split = (list) => ({ p: list.length, w: list.filter((x) => x.res === 'W').length, d: list.filter((x) => x.res === 'D').length, l: list.filter((x) => x.res === 'L').length, gf: list.reduce((a, x) => a + x.gf, 0), ga: list.reduce((a, x) => a + x.ga, 0) });
  const t = (lg.tstats && lg.tstats[me]) || emptyTeamStats();
  const played = Math.max(1, t.played);
  const best = res.slice().sort((a, b) => (b.gf - b.ga) - (a.gf - a.ga))[0] || null;
  const worst = res.slice().sort((a, b) => (a.gf - a.ga) - (b.gf - b.ga))[0] || null;
  const players = pstatRows(state, world, lg, me).sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.avg - a.avg);
  const cards = state.cards.filter((c) => c.kind === 'player').map((c) => ({
    name: playerName(state, world, c.playerId), apps: c.career.apps, goals: c.career.goals, assists: c.career.assists, cs: c.career.cleanSheets, avg: c.career.avgRating,
    fitness: Math.round(c.fitness), form: c.form, morale: Math.round(c.morale), injured: c.injuredFor, suspended: c.suspendedFor,
  })).sort((a, b) => b.apps - a.apps || b.goals - a.goals);
  return {
    position: row ? row.pos : null, points: row ? row.pts : 0, record: split(res), home: split(res.filter((x) => x.home)), away: split(res.filter((x) => !x.home)),
    form: res.slice(-5).map((x) => x.res), recent: res.slice(-5).reverse().map((x) => ({ ...x, oppName: clubNameOf(state, world, x.opp) })),
    team: { played: t.played, shots: r1(t.shots / played), sot: r1(t.sot / played), xgf: r2(t.xgf / played), xga: r2(t.xga / played), possession: Math.round(t.poss / played), corners: r1(t.corners / played), fouls: r1(t.fouls / played), yellows: t.yellows, reds: t.reds, cleanSheets: t.cleanSheets },
    best, worst, bestName: best ? clubNameOf(state, world, best.opp) : '', worstName: worst ? clubNameOf(state, world, worst.opp) : '',
    players, careers: cards, coins: state.coins,
  };
}

/** League: top lists, records and averages across every club in the league. */
export function leagueStats(state, world, lg = myLeague(state)) {
  const rows = sortLeague(lg).map((r, i) => ({ ...r, pos: i + 1, name: clubNameOf(state, world, r.clubId), me: r.clubId === MY_CLUB_ID }));
  const all = pstatRows(state, world, lg);
  const top = (key, minApps = 1, n = 10) => all.filter((p) => p.apps >= minApps && p[key] > 0).sort((a, b) => b[key] - a[key] || b.avg - a.avg).slice(0, n);
  const played = lg.results.length;
  const goals = lg.results.reduce((a, r) => a + r.hg + r.ag, 0);
  const hw = lg.results.filter((r) => r.hg > r.ag).length, dr = lg.results.filter((r) => r.hg === r.ag).length, aw = played - hw - dr;
  const biggest = lg.results.slice().sort((a, b) => Math.abs(b.hg - b.ag) - Math.abs(a.hg - a.ag))[0] || null;
  const highest = lg.results.slice().sort((a, b) => (b.hg + b.ag) - (a.hg + a.ag))[0] || null;
  const mk = (r) => r && { matchday: r.matchday + 1, home: clubNameOf(state, world, r.home), away: clubNameOf(state, world, r.away), hg: r.hg, ag: r.ag };
  const byTeam = (fn, n = 5, dir = -1) => rows.filter((r) => r.p > 0).map((r) => ({ name: r.name, me: r.me, v: fn(r) })).sort((a, b) => dir * (a.v - b.v)).slice(0, n);
  const ts = (id) => (lg.tstats && lg.tstats[id]) || emptyTeamStats();
  return {
    table: rows, played, goals, goalsPerMatch: played ? r2(goals / played) : 0,
    homeWinPct: played ? Math.round((100 * hw) / played) : 0, drawPct: played ? Math.round((100 * dr) / played) : 0, awayWinPct: played ? Math.round((100 * aw) / played) : 0,
    topScorers: top('goals'), topAssists: top('assists'), bestRated: all.filter((p) => p.apps >= 2 && p.avg > 0).sort((a, b) => b.avg - a.avg).slice(0, 10),
    bestAttack: byTeam((r) => r.gf), bestDefence: byTeam((r) => r.ga, 5, 1),
    cleanSheets: rows.map((r) => ({ name: r.name, me: r.me, v: ts(r.clubId).cleanSheets })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 5),
    mostPossession: rows.filter((r) => ts(r.clubId).played).map((r) => ({ name: r.name, me: r.me, v: Math.round(ts(r.clubId).poss / ts(r.clubId).played) })).sort((a, b) => b.v - a.v).slice(0, 5),
    dirtiest: rows.map((r) => ({ name: r.name, me: r.me, v: ts(r.clubId).yellows + ts(r.clubId).reds * 2 })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 5),
    biggestWin: mk(biggest), highestScoring: mk(highest),
  };
}

/** Past seasons of this save. */
export function historyStats(state) {
  return (state.history || []).map((h) => ({
    season: h.season, country: h.country, level: h.level, position: h.position, points: h.points, champion: h.champion, prize: h.prize,
    promoted: !!h.promoted, relegated: !!h.relegated, playoff: h.playoff || null, newLevel: h.newLevel,
  }));
}
