// AI club match teams: XI selection, kit clash, MatchTeam construction, plus a per-world cache so the pyramid can
// simulate a round of about 250 matches without rebuilding every squad. Pure: no DOM, no Math.random, no Date.now.

import { DEFAULT_SETTINGS, CARD_LIMITS, POSITIONS } from '../balance.js';
import { FORMATIONS } from './formations.js';
import { buildAITeam } from './cardEffects.js';

const luma = (hex) => {
  const h = hex.replace('#', '');
  return (0.299 * parseInt(h.slice(0, 2), 16) + 0.587 * parseInt(h.slice(2, 4), 16) + 0.114 * parseInt(h.slice(4, 6), 16)) / 255;
};
const colourDist = (a, b) => Math.abs(luma(a) - luma(b));

/** Pick an away kit that does not clash with the home primary. */
export function awayColours(homePrimary, colours) {
  const [a, b] = colours;
  if (colourDist(homePrimary, a) > 0.18) return [a, b];
  if (colourDist(homePrimary, b) > 0.18) return [b, a];
  return [luma(homePrimary) > 0.5 ? '#14161c' : '#f2f2f2', a];
}

export const STYLE_SETTINGS = {
  possession: { passing: 'short', pressing: 'medium', width: 'balanced' },
  'counter-attack': { passing: 'direct', mentality: 'defensive', defLine: 'deep' },
  'high press': { pressing: 'high', defLine: 'high', mentality: 'attacking' },
  direct: { passing: 'direct', width: 'balanced' },
  balanced: {},
  'wing play': { width: 'wide', passing: 'mixed' },
  compact: { width: 'narrow', defLine: 'deep', mentality: 'defensive' },
};

/**
 * Best XI of an AI club for a formation: natural position first, then secondary, then anyone (keeper slot: keepers).
 * Reads the typed arrays directly (no getPlayer allocation). Returns { xi, bench } as world player ids.
 */
export function pickAIXI(world, clubId, formationId) {
  const squad = Array.from(world.clubSquad(clubId));
  squad.sort((a, b) => world.ovr[b] - world.ovr[a]);
  const used = new Set();
  const slots = FORMATIONS[formationId].slots;
  const xi = new Array(slots.length).fill(-1);
  const order = slots.map((s, i) => i).sort((a, b) => (slots[a].pos === 'GK' ? -1 : slots[b].pos === 'GK' ? 1 : 0));
  const posOf = (id) => POSITIONS[world.pos[id]];
  for (const i of order) {
    const want = slots[i].pos;
    let pick = -1;
    for (const id of squad) { if (!used.has(id) && posOf(id) === want) { pick = id; break; } }
    if (pick < 0) for (const id of squad) { if (!used.has(id) && world.altPosOf(id).includes(want)) { pick = id; break; } }
    if (pick < 0) for (const id of squad) { if (!used.has(id) && (want === 'GK') === (posOf(id) === 'GK')) { pick = id; break; } }
    if (pick < 0) for (const id of squad) { if (!used.has(id)) { pick = id; break; } }
    xi[i] = pick; used.add(pick);
  }
  const bench = [];
  const hasGk = () => bench.some((id) => posOf(id) === 'GK');
  for (const id of squad) {
    if (used.has(id)) continue;
    if (bench.length < CARD_LIMITS.benchSize) { bench.push(id); used.add(id); }
  }
  if (!hasGk()) {
    const gk = squad.find((id) => !xi.includes(id) && posOf(id) === 'GK');
    if (gk !== undefined && !bench.includes(gk)) bench[bench.length - 1] = gk;
  }
  return { xi, bench };
}

// ------------------------------------------------------------------ cache
// Per world: clubId -> { ver, epoch, formation, xi:[WorldPlayer], bench:[WorldPlayer] }. Valid while the club roster
// (world.rosterVer) and the player data (world.epoch) are unchanged, so it never changes a result, it only skips work.
const CACHE = new WeakMap();
let cacheHits = 0, cacheMisses = 0;

function selectionOf(world, clubId) {
  let m = CACHE.get(world);
  if (!m) { m = new Map(); CACHE.set(world, m); }
  const ver = world.rosterVer ? world.rosterVer[clubId] : 0;
  const e = m.get(clubId);
  if (e && e.ver === ver && e.epoch === world.epoch) { cacheHits++; return e; }
  cacheMisses++;
  const club = world.getClub(clubId);
  const formation = club.identity.formation;
  const { xi, bench } = pickAIXI(world, clubId, formation);
  const entry = {
    ver, epoch: world.epoch, formation,
    xi: xi.map((id) => world.getPlayer(id)), bench: bench.map((id) => world.getPlayer(id)),
    leagueId: club.country,
  };
  m.set(clubId, entry);
  return entry;
}

/** Cache counters (tools). */
export function aiCacheStats() { return { hits: cacheHits, misses: cacheMisses }; }

/**
 * MatchTeam of an AI club. The XI/bench selection and player objects are cached per club; the per-match parts
 * (consistency offsets from `rng`, kit) are built each time.
 */
export function buildOpponentTeam(state, world, clubId, rng, { isHome = false, vsColour = null } = {}) {
  const club = world.getClub(clubId);
  const sel = selectionOf(world, clubId);
  const mk = (wp, number) => ({ worldPlayer: wp, number });
  const colours = vsColour ? awayColours(vsColour, club.colours) : club.colours;
  return buildAITeam({
    id: String(clubId), name: club.name, colours, crest: club.crest, formation: sel.formation,
    xiPlayers: sel.xi.map((wp, i) => mk(wp, i + 1)), benchPlayers: sel.bench.map((wp, i) => mk(wp, 12 + i)),
    settings: { ...DEFAULT_SETTINGS, ...(STYLE_SETTINGS[club.identity.style] || {}) },
    isHome, leagueOf: (cid) => world.leagueOf(cid), rng: rng.fork('cons' + clubId),
  });
}

/** Average OVR of a MatchTeam's XI (penalty shootouts). */
export function teamXiRating(team) {
  const xi = team.xi || [];
  return xi.length ? xi.reduce((a, p) => a + (p.ovr || 0), 0) / xi.length : 0;
}
