// Chemistry: count-based, no adjacency needed. See PROMPT.md "Chemistry" and balance.js CHEM.
// Pure module: no DOM, no randomness.
//
// A "slot entry" describes one starter in formation slot order:
//   { playerId, nation, clubId, leagueId, isIcon, pos, nativePos, altPos:[] }
//   pos = position PLAYED in the slot, nativePos = his own position, altPos = secondary positions.
// Extra properties on entries are ignored here (cardEffects.predictSwap adds stats, upgrades, ...).

import { CHEM } from '../balance.js';

/** @typedef {{ playerId:number, nation:string, clubId:number, leagueId:string, isIcon:boolean, pos:string, nativePos:string, altPos:string[] }} SlotEntry */

const hasClub = (e) => typeof e.clubId === 'number' && e.clubId >= 0;
const hasLeague = (e) => e.leagueId !== undefined && e.leagueId !== null && e.leagueId !== '';

/** Points (0-3) earned by `count` members against a threshold table [1pt, 2pt, 3pt]. */
function pointsFor(count, table) {
  let p = 0;
  for (let i = 0; i < table.length; i++) if (count >= table[i]) p = i + 1;
  return p;
}

/** True when the played position is his native one or one of his secondary positions. */
export function isNaturalPosition(e) {
  return e.pos === e.nativePos || (Array.isArray(e.altPos) && e.altPos.includes(e.pos));
}

/**
 * Chemistry of a starting XI.
 *
 * Counting rules (all counts are over the whole XI, adjacency does not matter):
 *  - club: players sharing clubId (clubId < 0 or null = free agent / no club, never links).
 *  - nation: players sharing a nation; an Icon counts as CHEM.iconNationCounts (2) players for his nation.
 *  - league: players sharing leagueId; an Icon counts as 1 player in EVERY league (wildcard).
 *    An Icon's own league count is the best league count in the XI (he is a member of all of them).
 *  - manager (ManagerCard or null) counts as one extra member for his chemBonus nation or league.
 * Points per link type come from the CHEM threshold tables, summed and capped at CHEM.perPlayerMax.
 * A player whose played position is neither native nor secondary gets 0 chemistry.
 *
 * @param {SlotEntry[]} xiEntries
 * @param {{chemBonus?:{type:'nation'|'league', value:string}}|null} [manager]
 * @returns {{ perPlayer:number[], team:number, detail:Array<{club:number,nation:number,league:number,oop:boolean}> }}
 */
export function computeChemistry(xiEntries, manager = null) {
  const clubN = new Map();
  const nationN = new Map();
  const leagueN = new Map(); // non-icon members only
  let icons = 0;
  const bump = (m, k, by) => m.set(k, (m.get(k) || 0) + by);

  for (const e of xiEntries) {
    if (hasClub(e)) bump(clubN, e.clubId, 1);
    if (e.nation) bump(nationN, e.nation, e.isIcon ? CHEM.iconNationCounts : 1);
    if (e.isIcon) icons++;
    else if (hasLeague(e)) bump(leagueN, e.leagueId, 1);
  }
  const bonus = manager && manager.chemBonus;
  if (bonus && bonus.value) {
    if (bonus.type === 'nation') bump(nationN, bonus.value, 1);
    else if (bonus.type === 'league') bump(leagueN, bonus.value, 1);
  }
  let bestLeague = 0;
  for (const v of leagueN.values()) if (v > bestLeague) bestLeague = v;

  const perPlayer = [];
  const detail = [];
  let team = 0;
  for (const e of xiEntries) {
    const oop = !isNaturalPosition(e);
    let c = 0, n = 0, l = 0;
    if (!oop) {
      c = hasClub(e) ? pointsFor(clubN.get(e.clubId) || 0, CHEM.club) : 0;
      n = e.nation ? pointsFor(nationN.get(e.nation) || 0, CHEM.nation) : 0;
      const leagueCount = e.isIcon
        ? bestLeague + icons
        : hasLeague(e) ? (leagueN.get(e.leagueId) || 0) + icons : 0;
      l = pointsFor(leagueCount, CHEM.league);
    }
    const pts = oop ? 0 : Math.min(CHEM.perPlayerMax, c + n + l);
    perPlayer.push(pts);
    detail.push({ club: c, nation: n, league: l, oop });
    team += pts;
  }
  return { perPlayer, team: Math.min(CHEM.teamMax, team), detail };
}

/** Number of shared link types (0-3) between two slot entries: club, league, nation. */
export function sharedLinks(a, b) {
  let n = 0;
  if (hasClub(a) && hasClub(b) && a.clubId === b.clubId) n++;
  if (a.isIcon || b.isIcon) n++; // an Icon is a member of every league
  else if (hasLeague(a) && hasLeague(b) && a.leagueId === b.leagueId) n++;
  if (a.nation && a.nation === b.nation) n++;
  return n;
}

/**
 * Colour of the link line between two slot entries (visual guide only).
 * green = shares 2 or more of club / league / nation, orange = 1, red = 0.
 * @returns {'green'|'orange'|'red'}
 */
export function linkColour(a, b) {
  const n = sharedLinks(a, b);
  if (n >= CHEM.linkGreen) return 'green';
  if (n >= CHEM.linkOrange) return 'orange';
  return 'red';
}

/**
 * Indexes (excluding `idx` itself) of players sharing at least one link with player `idx`.
 * Used for the hover highlight on the squad screen.
 * @returns {number[]}
 */
export function linkGroups(xiEntries, idx) {
  const me = xiEntries[idx];
  const out = [];
  if (!me) return out;
  for (let j = 0; j < xiEntries.length; j++) {
    if (j !== idx && sharedLinks(me, xiEntries[j]) >= CHEM.linkOrange) out.push(j);
  }
  return out;
}
