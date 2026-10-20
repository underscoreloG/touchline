// Persistent football world: struct-of-arrays player store plus the club table.
// Pure module: no DOM, no Date.now, no Math.random. Randomness only through an rng argument.
//
// ---------------------------------------------------------------- storage layout
// Player id = array index (0 .. size-1). One typed array per field, about 45 bytes per player:
//   stat[0..6]  Uint8   current stats       pot[0..6]  Uint8   potential per stat
//   Stat slot k holds, by position:
//     slot     0    1    2    3    4    5    6
//     outfield pac  sho  pas  dri  def  phy  men   (balance.js OUTFIELD_STATS order)
//     keeper   div  han  kic  ref  spd  pos  men   (balance.js GK_STATS order)
//   A keeper keeps his keeper stats in the same seven arrays, so slot 6 is MEN for everybody.
//   firstName, lastName  Uint16  indices into the name pools of the culture of the player's nation
//   nation               Uint8   index into NATIONS (nations.js order, append-only)
//   club                 Uint16  club id, NO_CLUB (0xFFFF) = free agent (getPlayer reports -1),
//                                MY_CLUB (0xFFFE) = registered with my club (never a pack source, never in a squad)
//   pos                  Uint8   index into POSITIONS (GK CB FB DM CM AM W ST)
//   altPos               Uint8   packed: low nibble = alt 1 (pos index + 1), high nibble = alt 2, 0 = none
//   age, foot (0 R, 1 L, 2 B), devType (index into DEV_TYPES), peakStart, peakEnd,
//   professionalism, injuryProne, consistency (1-20), ovr, peakOvr, intlGoals (clamped 255)   Uint8
//   caps                 Uint16
//   seasonApps, seasonGoals, seasonAssists (clamped 255), seasonRating10 (avg rating x10)   Uint8
//   flags                Uint8   FLAG bits (REGEN, WONDERKID, YOUTH, VACANT)
//   next                 Int32   roster linked list (see below)
//
// ---------------------------------------------------------------- rosters
// Every slot sits in exactly one singly linked list: one list per club, one for free agents, one for
// vacant slots (retired players waiting for a regen), one for my club. listHead / listCount hold head id and
// length per list (list index = clubId + 3, free agents = 0, vacant = 1, my club = 2). Complexity:
//   insert O(1), remove O(length of that list) (26 for a club, about 4% of the world for free agents),
//   clubSquad O(26), freeAgents O(free agents), takeVacantSlot O(1).
// The lists are part of the snapshot, so squad order survives save/load exactly.
//
// ---------------------------------------------------------------- phase 2 (development, retirement)
// Operate in place on the public arrays: world.stat[k][id], world.pot[k][id], world.age[id], ...
// then call world.recomputeOvr(id). Use forEachPlayer(fn) or a plain `for (id < world.size)` loop that
// skips (world.flags[id] & FLAG.VACANT). retire(id) + allocSlot() + recycleSlot(id, fields) keep the
// population constant.

import { POSITIONS, OUTFIELD_STATS, GK_STATS, OVR_WEIGHTS, GK_WEIGHTS, DEV_TYPES, WORLD, REFILL } from '../balance.js';
import { NATIONS, NATION_INDEX } from './nations.js';
import { CULTURE_IDS, CULTURE_BY_ID, nameFromIndices, foldText } from './names.js';

export const NO_CLUB = 0xffff;
/** Pseudo club id for "registered with my club" (economy.js MY_CLUB_ID). Accepted by moveToClub, excluded from pack sources. */
export const MY_CLUB = 0xfffe;
export const FLAG = Object.freeze({ REGEN: 1, WONDERKID: 2, YOUTH: 4, VACANT: 8 });
export const FOOTS = Object.freeze(['R', 'L', 'B']);
export const POS_INDEX = Object.freeze(Object.fromEntries(POSITIONS.map((p, i) => [p, i])));
export const DEV_INDEX = Object.freeze(Object.fromEntries(DEV_TYPES.map((d, i) => [d, i])));
export const STAT_SLOTS = 7;
export const SNAPSHOT_VERSION = 1;
/** Sort keys pack (key * ID_SPACE + id) into a float64, so ids must stay below this. */
const ID_SPACE = 1048576;
const FA_LIST = 0;
const VACANT_LIST = 1;
const MY_LIST = 2;
const LIST_BASE = 3;

const U8_FIELDS = ['nation', 'pos', 'altPos', 'age', 'foot', 'devType', 'peakStart', 'peakEnd', 'professionalism',
  'injuryProne', 'consistency', 'ovr', 'peakOvr', 'intlGoals', 'seasonApps', 'seasonGoals', 'seasonAssists',
  'seasonRating10', 'flags'];
const U16_FIELDS = ['firstName', 'lastName', 'club', 'caps'];
const STAT_FIELDS = ['s0', 's1', 's2', 's3', 's4', 's5', 's6'];
const POT_FIELDS = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
const PLAYER_FIELDS = [...STAT_FIELDS, ...POT_FIELDS, ...U8_FIELDS, ...U16_FIELDS, 'next'];
const FIELD_TYPE = Object.fromEntries([
  ...STAT_FIELDS.map((f) => [f, Uint8Array]), ...POT_FIELDS.map((f) => [f, Uint8Array]),
  ...U8_FIELDS.map((f) => [f, Uint8Array]), ...U16_FIELDS.map((f) => [f, Uint16Array]), ['next', Int32Array],
]);

/** Stat keys of a position index (keepers use GK_STATS). */
export const statKeysOfPos = (posIdx) => (posIdx === 0 ? GK_STATS : OUTFIELD_STATS);

// OVR weights per position, summed in the exact key order cards.js computeOvr uses (`for k in w`),
// so recomputeOvr is bit-identical to computeOvr(getPlayer(id).stats, pos).
const OVR_ORDER = POSITIONS.map((p) => {
  const w = p === 'GK' ? GK_WEIGHTS : OVR_WEIGHTS[p];
  const keys = p === 'GK' ? GK_STATS : OUTFIELD_STATS;
  const ks = Object.keys(w);
  return { slots: Int8Array.from(ks.map((k) => keys.indexOf(k))), weights: Float64Array.from(ks.map((k) => w[k])) };
});
/** Weight of stat slot k at position p: WEIGHTS[p * 7 + k]. */
export const WEIGHTS = new Float64Array(POSITIONS.length * STAT_SLOTS);
POSITIONS.forEach((p, pi) => {
  const o = OVR_ORDER[pi];
  for (let j = 0; j < o.slots.length; j++) WEIGHTS[pi * STAT_SLOTS + o.slots[j]] = o.weights[j];
});

/** OVR of 7 stat values (any indexable) at a position index, identical to cards.js computeOvr. */
export function ovrOfArray(vals, posIdx) {
  const o = OVR_ORDER[posIdx];
  let sum = 0;
  for (let j = 0; j < o.slots.length; j++) sum += (vals[o.slots[j]] || 0) * o.weights[j];
  return Math.round(sum);
}

// ---------------------------------------------------------------- name search / sort tables (static, lazy)
const NATION_CULTURE = Uint8Array.from(NATIONS.map((n) => Math.max(0, CULTURE_IDS.indexOf(n.culture))));
let nameTables = null;
function getNameTables() {
  if (nameTables) return nameTables;
  const folded = CULTURE_IDS.map((cid) => ({
    first: CULTURE_BY_ID[cid].first.map(foldText), last: CULTURE_BY_ID[cid].last.map(foldText),
  }));
  const rankOf = (part) => {
    const all = [];
    folded.forEach((c, ci) => c[part].forEach((s, i) => all.push([s, ci, i])));
    all.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1] || a[2] - b[2]));
    const ranks = folded.map((c) => new Uint16Array(c[part].length));
    all.forEach(([, ci, i], r) => { ranks[ci][i] = r; });
    return ranks;
  };
  nameTables = { folded, firstRank: rankOf('first'), lastRank: rankOf('last') };
  return nameTables;
}

// ---------------------------------------------------------------- FNV-1a
function fnvBytes(h, bytes) {
  for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 16777619);
  return h >>> 0;
}
function fnvString(h, s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h = Math.imul(h ^ (c & 0xff), 16777619);
    h = Math.imul(h ^ (c >>> 8), 16777619);
  }
  return h >>> 0;
}

const toPosMask = (pos) => {
  if (pos === undefined || pos === null || pos === '') return null;
  const m = new Uint8Array(POSITIONS.length);
  for (const p of Array.isArray(pos) ? pos : [pos]) {
    const i = typeof p === 'number' ? p : POS_INDEX[p];
    if (i !== undefined) m[i] = 1;
  }
  return m;
};
const toNationMask = (nations) => {
  if (nations === undefined || nations === null) return null;
  const list = Array.isArray(nations) ? nations : [nations];
  if (!list.length) return null;
  const m = new Uint8Array(256);
  for (const n of list) {
    const i = typeof n === 'number' ? n : NATION_INDEX[n];
    if (i !== undefined && i >= 0) m[i] = 1;
  }
  return m;
};

/**
 * Club record (JSON).
 * @typedef {Object} Club
 * @property {number} id
 * @property {string} name
 * @property {string} country         nation code; also the league id used by chemistry
 * @property {number} division        pyramid level 1-5 for the 5 playable countries, 0 for background clubs
 *                                    (changes with promotion / relegation: world.setClubDivision)
 * @property {boolean} isBackground
 * @property {string[]} colours       [primary, secondary]
 * @property {{shape:string, colours:string[], emblem:string, pattern:string, trim:string, initials:string}} crest
 *   descriptor accepted by ui/components/crest.js crestSVG
 * @property {string} stadium
 * @property {{style:string, formation:string, starId:number}} identity  starId = best player at generation (-1 none)
 * @property {number} strengthTarget  intended average XI rating at generation
 */

const REFILL_CORE = Uint8Array.from(POSITIONS.map((p) => REFILL.core[p]));

export class World {
  /** (world, rng, nationCode, clubId, {pos}) -> player id. Registered by generator.js (avoids an import cycle). */
  static regenFactory = null;

  /**
   * @param {number} size     number of player slots
   * @param {Club[]} clubs
   * @param {object} [meta]   JSON-able extras (seed, generation diagnostics)
   */
  constructor(size, clubs = [], meta = {}, buffers = null) {
    this.size = size;
    this.clubs = clubs;
    this.meta = meta;
    for (const f of PLAYER_FIELDS) {
      const T = FIELD_TYPE[f];
      this[f] = buffers ? new T(buffers[f]) : new T(size);
      if (this[f].length !== size) throw new Error(`world: buffer ${f} has ${this[f].length} entries, expected ${size}`);
    }
    this.stat = STAT_FIELDS.map((f) => this[f]);
    this.pot = POT_FIELDS.map((f) => this[f]);
    this.listHead = buffers ? new Int32Array(buffers.listHead) : new Int32Array(clubs.length + LIST_BASE).fill(-1);
    this.listCount = buffers ? new Int32Array(buffers.listCount) : new Int32Array(clubs.length + LIST_BASE);
    this._indexClubs();
    this.posCounts = new Int32Array(POSITIONS.length);
    this.liveCount = 0;
    if (buffers) this._recount();
  }

  // ------------------------------------------------------------ clubs
  _indexClubs() {
    const n = this.clubs.length;
    this.clubCountry = new Uint8Array(n);
    this.clubIsBackground = new Uint8Array(n);
    this.clubDivision = new Uint8Array(n);
    // Transient change counters for caches built on top of the world (not part of the snapshot or checksum):
    // rosterVer[clubId] moves whenever a player joins or leaves that club, epoch moves on any player data change.
    this.rosterVer = new Uint32Array(n);
    this.epoch = (this.epoch || 0) + 1;
    for (let i = 0; i < n; i++) {
      const c = this.clubs[i];
      if (c.id !== i) throw new Error(`world: club ${i} has id ${c.id}`);
      this.clubCountry[i] = NATION_INDEX[c.country];
      this.clubIsBackground[i] = c.isBackground ? 1 : 0;
      this.clubDivision[i] = c.division;
    }
    this._clubNameRank = null;
  }

  get clubCount() { return this.clubs.length; }
  /** Replace the whole club table (generation) and rebuild every roster list from the club array. */
  setClubs(clubs) {
    this.clubs = clubs;
    this.listHead = new Int32Array(clubs.length + LIST_BASE).fill(-1);
    this.listCount = new Int32Array(clubs.length + LIST_BASE);
    this._indexClubs();
    this.rebuildRosters();
  }
  /** Club record by id, or null (free agent / unknown). */
  getClub(clubId) { return clubId >= 0 && clubId < this.clubs.length ? this.clubs[clubId] : null; }
  /**
   * Playable clubs of a country, optionally one pyramid level (1 = top .. LEAGUE_SYSTEM.levels), in id order.
   * Reflects promotion and relegation (club.division is kept in step by setClubDivision). My club is not in the
   * club table: the season pyramid (logic/pyramid.js) is the authority for who plays where.
   */
  clubsOf(country, level = 0) {
    return this.clubs.filter((c) => c.country === country && !c.isBackground && (!level || c.division === level));
  }
  /**
   * Move a club to another pyramid level (1..5) or to the background (0). Keeps club.division, club.isBackground and
   * the typed indexes in step; rosters and ids do not change. Players of a club that drops to the background become
   * pack-eligible, players of a club that comes up stop being pack-eligible.
   */
  setClubDivision(clubId, level) {
    const c = this.clubs[clubId];
    if (!c) throw new Error(`world: unknown club ${clubId}`);
    if (!(level >= 0 && level <= 255) || !Number.isInteger(level)) throw new Error(`world: bad level ${level}`);
    c.division = level;
    c.isBackground = level === 0;
    this.clubDivision[clubId] = level;
    this.clubIsBackground[clubId] = level === 0 ? 1 : 0;
    this.epoch++;
  }
  /** Background clubs of a nation. */
  backgroundClubsOf(nation) { return this.clubs.filter((c) => c.isBackground && c.country === nation); }
  /** League id (country code) of a club, null for a free agent. Chemistry uses this as leagueId. */
  leagueOf(clubId) { const c = this.getClub(clubId); return c ? c.country : null; }
  /**
   * Append a club (phase 2 may need new background clubs). Returns its id.
   * @param {Club} club  id is overwritten
   */
  addClub(club) {
    const id = this.clubs.length;
    if (id >= MY_CLUB) throw new Error('world: too many clubs');
    club.id = id;
    this.clubs.push(club);
    const head = new Int32Array(id + 1 + LIST_BASE).fill(-1); head.set(this.listHead);
    const cnt = new Int32Array(id + 1 + LIST_BASE); cnt.set(this.listCount);
    this.listHead = head; this.listCount = cnt;
    this._indexClubs();
    return id;
  }

  // ------------------------------------------------------------ rosters
  _listOf(id) {
    if (this.flags[id] & FLAG.VACANT) return VACANT_LIST;
    const c = this.club[id];
    return c === NO_CLUB ? FA_LIST : c === MY_CLUB ? MY_LIST : c + LIST_BASE;
  }
  /** Roster list index of a club id (-1 / NO_CLUB = free agents, MY_CLUB = my club). */
  _clubList(clubId) {
    return clubId < 0 || clubId === NO_CLUB ? FA_LIST : clubId === MY_CLUB ? MY_LIST : clubId + LIST_BASE;
  }
  _push(L, id) {
    this.next[id] = this.listHead[L]; this.listHead[L] = id; this.listCount[L]++;
    if (L >= LIST_BASE && L - LIST_BASE < this.rosterVer.length) this.rosterVer[L - LIST_BASE]++;
  }
  _remove(L, id) {
    if (L >= LIST_BASE && L - LIST_BASE < this.rosterVer.length) this.rosterVer[L - LIST_BASE]++;
    let cur = this.listHead[L];
    if (cur === id) { this.listHead[L] = this.next[id]; this.listCount[L]--; this.next[id] = -1; return; }
    while (cur !== -1) {
      const nx = this.next[cur];
      if (nx === id) { this.next[cur] = this.next[id]; this.listCount[L]--; this.next[id] = -1; return; }
      cur = nx;
    }
    throw new Error(`world: player ${id} not found in list ${L}`);
  }
  _listIds(L) {
    const out = new Int32Array(this.listCount[L]);
    let i = 0;
    for (let cur = this.listHead[L]; cur !== -1; cur = this.next[cur]) out[i++] = cur;
    return out;
  }

  /** Rebuild every roster list from the club/flags arrays (ids ascending inside each list). O(size). */
  rebuildRosters() {
    this.listHead.fill(-1);
    this.listCount.fill(0);
    for (let id = this.size - 1; id >= 0; id--) this._push(this._listOf(id), id);
    this._recount();
  }

  _recount() {
    this.posCounts.fill(0);
    let live = 0;
    for (let id = 0; id < this.size; id++) {
      if (this.flags[id] & FLAG.VACANT) continue;
      live++;
      this.posCounts[this.pos[id]]++;
    }
    this.liveCount = live;
  }

  /** Player ids of a club (Int32Array, roster order). O(squad). */
  clubSquad(clubId) { return this._listIds(this._clubList(clubId)); }
  /** Number of players in a club. O(1). */
  clubSize(clubId) { return this.listCount[this._clubList(clubId)]; }
  /** All free agent ids. O(free agents). */
  freeAgents() { return this._listIds(FA_LIST); }
  get freeAgentCount() { return this.listCount[FA_LIST]; }
  /** Players registered with my club (MY_CLUB). */
  myPlayers() { return this._listIds(MY_LIST); }
  get vacantCount() { return this.listCount[VACANT_LIST]; }

  /** Move a player to a club (clubId -1 or NO_CLUB = free agents). O(old list length). */
  moveToClub(id, clubId) {
    const target = clubId < 0 || clubId === NO_CLUB ? NO_CLUB : clubId;
    if (target !== NO_CLUB && target !== MY_CLUB && target >= this.clubs.length) throw new Error(`world: unknown club ${clubId}`);
    if (this.flags[id] & FLAG.VACANT) throw new Error(`world: slot ${id} is vacant`);
    if (this.club[id] === target) return;
    this._remove(this._listOf(id), id);
    this.club[id] = target;
    this._push(this._listOf(id), id);
  }
  releaseToFreeAgents(id) { this.moveToClub(id, NO_CLUB); }

  /**
   * Top a club back up to WORLD.squadSize (26): signs free agents (position of greatest need, OVR close to the
   * club's level, no exact duplicate name in the squad) or promotes an academy regen (makeRegen, set by
   * generator.js as World.regenFactory). Free agents and my club are never refilled. Deterministic for the rng state.
   * @returns {number[]} ids added
   */
  refillClub(rng, clubId) {
    const added = [];
    if (clubId < 0 || clubId >= this.clubs.length) return added;
    while (this.listCount[clubId + LIST_BASE] < WORLD.squadSize) added.push(this._refillOne(rng, clubId));
    return added;
  }

  _refillOne(rng, clubId) {
    const club = this.clubs[clubId];
    const squad = this._listIds(clubId + LIST_BASE);
    const counts = new Int32Array(POSITIONS.length);
    const names = new Set();
    const ovrs = [];
    for (const id of squad) { counts[this.pos[id]]++; names.add(this.name(id)); ovrs.push(this.ovr[id]); }
    // position of greatest need: below the fixed core first, then toward the world mix
    let pos = -1, best = 0;
    for (let p = 0; p < POSITIONS.length; p++) {
      const d = REFILL_CORE[p] - counts[p];
      if (d > best) { best = d; pos = p; }
    }
    if (pos < 0) {
      const wts = POSITIONS.map((code, p) => Math.max(0, WORLD.positionMix[code] * WORLD.squadSize - counts[p]) + REFILL.needFloor);
      pos = rng.weightedIndex(wts);
    }
    // club level: the 15th best player (a rotation player), or the intended strength minus a margin
    ovrs.sort((a, b) => b - a);
    const ref = ovrs.length > REFILL.refRank ? ovrs[REFILL.refRank] : Math.round((club.strengthTarget || REFILL.defaultStrength) - REFILL.refMargin);
    const homeNation = NATION_INDEX[club.country];
    const sameNationOnly = club.isBackground;
    const academy = rng.chance(club.isBackground ? REFILL.academyBackground : REFILL.academy);
    if (!academy) {
      for (const win of REFILL.windows) {
        const cands = [];
        for (let cur = this.listHead[FA_LIST]; cur !== -1; cur = this.next[cur]) {
          if (this.pos[cur] !== pos || this.flags[cur] & FLAG.YOUTH) continue;
          if (Math.abs(this.ovr[cur] - ref) > win) continue;
          if (sameNationOnly && this.nation[cur] !== homeNation) continue;
          if (names.has(this.name(cur))) continue;
          cands.push(cur);
        }
        if (cands.length) {
          const id = rng.pick(cands);
          this.moveToClub(id, clubId);
          return id;
        }
      }
    }
    const regen = World.regenFactory;
    if (!regen) throw new Error('world: refillClub needs generator.js loaded (World.regenFactory)');
    return regen(this, rng, NATIONS[homeNation].code, clubId, { pos });
  }

  // ------------------------------------------------------------ slots (phase 2)
  /** Retire a player: the slot becomes vacant and can be recycled for a regen. */
  retire(id) {
    if (this.flags[id] & FLAG.VACANT) return;
    this.epoch++;
    this._remove(this._listOf(id), id);
    this.posCounts[this.pos[id]]--;
    this.liveCount--;
    this.flags[id] = FLAG.VACANT;
    this.club[id] = NO_CLUB;
    this._push(VACANT_LIST, id);
  }
  /** Pop a vacant slot id, or -1. O(1). */
  takeVacantSlot() { return this.listHead[VACANT_LIST]; }
  /** A slot for a new player: a vacant one if any, else the store grows by one (rare). */
  allocSlot() {
    const v = this.listHead[VACANT_LIST];
    if (v !== -1) return v;
    this._grow(this.size + 1);
    const id = this.size - 1;
    this.flags[id] = FLAG.VACANT;
    this.club[id] = NO_CLUB;
    this._push(VACANT_LIST, id);
    return id;
  }
  _grow(newSize) {
    if (newSize > ID_SPACE) throw new Error('world: too many players');
    for (const f of PLAYER_FIELDS) {
      const old = this[f];
      const a = new FIELD_TYPE[f](newSize);
      a.set(old);
      this[f] = a;
    }
    this.stat = STAT_FIELDS.map((f) => this[f]);
    this.pot = POT_FIELDS.map((f) => this[f]);
    this.size = newSize;
  }

  /**
   * Write a whole new player into a vacant slot (from allocSlot) and register him with a club.
   * Season stats, caps and international goals reset; ovr computed; peakOvr = ovr unless given.
   * @param {number} id
   * @param {{firstName:number, lastName:number, nation:string|number, age:number, foot?:string|number,
   *   pos:string|number, altPos?:Array<string|number>, stats:ArrayLike<number>|Object<string,number>,
   *   potential:ArrayLike<number>|Object<string,number>, devType:string|number, peakStart:number, peakEnd:number,
   *   professionalism:number, injuryProne:number, consistency:number, flags?:number, clubId?:number, peakOvr?:number}} f
   */
  recycleSlot(id, f) {
    if (!(this.flags[id] & FLAG.VACANT)) throw new Error(`world: slot ${id} is not vacant`);
    this.epoch++;
    this._remove(VACANT_LIST, id);
    const p = typeof f.pos === 'number' ? f.pos : POS_INDEX[f.pos];
    const keys = statKeysOfPos(p);
    const val = (src, k) => (Array.isArray(src) || ArrayBuffer.isView(src) ? src[k] : src[keys[k]]);
    for (let k = 0; k < STAT_SLOTS; k++) {
      this.stat[k][id] = val(f.stats, k);
      this.pot[k][id] = Math.max(val(f.stats, k), val(f.potential, k));
    }
    this.firstName[id] = f.firstName; this.lastName[id] = f.lastName;
    this.nation[id] = typeof f.nation === 'number' ? f.nation : NATION_INDEX[f.nation];
    this.pos[id] = p;
    this.altPos[id] = packAltPos(f.altPos || []);
    this.age[id] = f.age;
    this.foot[id] = typeof f.foot === 'number' ? f.foot : Math.max(0, FOOTS.indexOf(f.foot || 'R'));
    this.devType[id] = typeof f.devType === 'number' ? f.devType : DEV_INDEX[f.devType];
    this.peakStart[id] = f.peakStart; this.peakEnd[id] = f.peakEnd;
    this.professionalism[id] = f.professionalism; this.injuryProne[id] = f.injuryProne; this.consistency[id] = f.consistency;
    this.caps[id] = 0; this.intlGoals[id] = 0;
    this.seasonApps[id] = 0; this.seasonGoals[id] = 0; this.seasonAssists[id] = 0; this.seasonRating10[id] = 0;
    this.flags[id] = (f.flags || 0) & ~FLAG.VACANT;
    const clubId = f.clubId === undefined || f.clubId < 0 ? NO_CLUB : f.clubId;
    this.club[id] = clubId;
    this.ovr[id] = this.computeOvr(id);
    this.peakOvr[id] = Math.max(this.ovr[id], f.peakOvr || 0);
    this.posCounts[p]++;
    this.liveCount++;
    this._push(this._listOf(id), id);
    return id;
  }

  // ------------------------------------------------------------ stats
  /** OVR from the stored stats (does not write). Identical to cards.js computeOvr. */
  computeOvr(id) {
    const o = OVR_ORDER[this.pos[id]];
    let sum = 0;
    for (let j = 0; j < o.slots.length; j++) sum += this.stat[o.slots[j]][id] * o.weights[j];
    return Math.round(sum);
  }
  /** Potential OVR from the stored potential stats. */
  potentialOvr(id) {
    const o = OVR_ORDER[this.pos[id]];
    let sum = 0;
    for (let j = 0; j < o.slots.length; j++) sum += this.pot[o.slots[j]][id] * o.weights[j];
    return Math.round(sum);
  }
  /** Recompute and store OVR; raises peakOvr when beaten. Returns the new OVR. */
  recomputeOvr(id) {
    const v = this.computeOvr(id);
    this.ovr[id] = v;
    this.epoch++;
    if (v > this.peakOvr[id]) this.peakOvr[id] = v;
    return v;
  }
  /** Set stat slot k (0-6, or a key such as 'pac' / 'div') to v (clamped 0-99). Does not recompute OVR. */
  setStat(id, k, v) {
    const s = typeof k === 'number' ? k : statKeysOfPos(this.pos[id]).indexOf(k);
    if (s < 0) throw new Error(`world: stat ${k} not valid for player ${id}`);
    this.stat[s][id] = v < 0 ? 0 : v > 99 ? 99 : v;
    this.epoch++;
  }
  setPotential(id, k, v) {
    const s = typeof k === 'number' ? k : statKeysOfPos(this.pos[id]).indexOf(k);
    if (s < 0) throw new Error(`world: stat ${k} not valid for player ${id}`);
    this.pot[s][id] = v < 0 ? 0 : v > 99 ? 99 : v;
    this.epoch++;
  }

  // ------------------------------------------------------------ views
  nationCode(id) { return NATIONS[this.nation[id]].code; }
  posName(id) { return POSITIONS[this.pos[id]]; }
  clubIdOf(id) { const c = this.club[id]; return c === NO_CLUB ? -1 : c; }
  /** True when the player is registered with my club. */
  isMine(id) { return this.club[id] === MY_CLUB; }
  name(id) {
    return nameFromIndices(CULTURE_IDS[NATION_CULTURE[this.nation[id]]], this.firstName[id], this.lastName[id]);
  }
  altPosOf(id) {
    const a = this.altPos[id];
    const out = [];
    if (a & 15) out.push(POSITIONS[(a & 15) - 1]);
    if (a >> 4) out.push(POSITIONS[(a >> 4) - 1]);
    return out;
  }
  isVacant(id) { return (this.flags[id] & FLAG.VACANT) !== 0; }
  isRegen(id) { return (this.flags[id] & FLAG.REGEN) !== 0; }
  isWonderkid(id) { return (this.flags[id] & FLAG.WONDERKID) !== 0; }
  isYouth(id) { return (this.flags[id] & FLAG.YOUTH) !== 0; }
  /** Pack-signable: free agent (incl. youth intake) or background club; never a club of the 5 countries. */
  isPackEligible(id) {
    if (this.flags[id] & FLAG.VACANT) return false;
    const c = this.club[id];
    return c === NO_CLUB || (c < this.clubs.length && this.clubIsBackground[c] === 1);
  }
  /** Stable avatar seed (changes when a slot is recycled into a new player). */
  avatarSeed(id) {
    let h = Math.imul(id + 1, 2654435761) ^ (this.firstName[id] << 16) ^ this.lastName[id];
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ (this.nation[id] << 8) ^ this.foot[id];
    return (h ^ (h >>> 13)) >>> 0;
  }

  /**
   * Plain WorldPlayer object (cards.js typedef). Allocates; use the arrays directly in hot loops.
   * @returns {import('./cards.js').WorldPlayer}
   */
  getPlayer(id) {
    if (id == null || !(id >= 0) || id >= this.size || (this.flags[id] & FLAG.VACANT)) return null;
    const keys = statKeysOfPos(this.pos[id]);
    const stats = {};
    const potential = {};
    for (let k = 0; k < STAT_SLOTS; k++) { stats[keys[k]] = this.stat[k][id]; potential[keys[k]] = this.pot[k][id]; }
    const apps = this.seasonApps[id];
    return {
      id,
      name: this.name(id),
      nation: this.nationCode(id),
      age: this.age[id],
      foot: FOOTS[this.foot[id]],
      clubId: this.clubIdOf(id),
      pos: POSITIONS[this.pos[id]],
      altPos: this.altPosOf(id),
      stats,
      potential,
      devType: DEV_TYPES[this.devType[id]],
      peakStart: this.peakStart[id],
      peakEnd: this.peakEnd[id],
      professionalism: this.professionalism[id],
      injuryProne: this.injuryProne[id],
      consistency: this.consistency[id],
      ovr: this.ovr[id],
      peakOvr: this.peakOvr[id],
      caps: this.caps[id],
      intlGoals: this.intlGoals[id],
      season: { apps, goals: this.seasonGoals[id], assists: this.seasonAssists[id], avgRating: apps ? this.seasonRating10[id] / 10 : 0 },
    };
  }

  /** Calls fn(id, world) for every live player, no allocation. Return false from fn to stop early. */
  forEachPlayer(fn) {
    const flags = this.flags;
    for (let id = 0; id < this.size; id++) {
      if (flags[id] & FLAG.VACANT) continue;
      if (fn(id, this) === false) return;
    }
  }

  // ------------------------------------------------------------ search
  /**
   * Database filter + sort over the arrays.
   * filters: { nations:[codes], ageMin, ageMax, pos: 'ST'|['CB','FB'], includeAltPos, ovrMin, ovrMax, clubId,
   *   freeAgent:true|false, clubCountry:'ENG'|[...], packEligible, text, sortBy, sortDir:'asc'|'desc', limit, offset }
   * sortBy: 'ovr' (default) | 'potential' | 'age' | 'name' | 'pos' | 'nation' | 'club' | 'caps' | 'peakOvr' |
   *   'apps' | 'goals' | 'assists' | 'rating' | 'id'. Ties break by id ascending.
   * Returns an Int32Array of ids (the whole sorted result when no limit: length = total, good for a virtual list).
   */
  query(filters = {}) {
    const f = filters;
    const n = this.size;
    const ageMin = f.ageMin ?? 0, ageMax = f.ageMax ?? 255;
    const ovrMin = f.ovrMin ?? 0, ovrMax = f.ovrMax ?? 255;
    const posMask = toPosMask(f.pos);
    const inclAlt = !!f.includeAltPos;
    const natMask = toNationMask(f.nations);
    let ccMask = null;
    if (f.clubCountry !== undefined && f.clubCountry !== null) {
      ccMask = new Uint8Array(256);
      for (const c of Array.isArray(f.clubCountry) ? f.clubCountry : [f.clubCountry]) ccMask[NATION_INDEX[c]] = 1;
    }
    const clubFilter = f.clubId === undefined || f.clubId === null ? -2 : (f.clubId < 0 ? NO_CLUB : f.clubId);
    const fa = f.freeAgent;
    const packOnly = !!f.packEligible;
    // text: whitespace-separated tokens; each token must be contained in the first or the last name (any order).
    // Per culture flag tables are built once per query (a few thousand string tests), the scan only does lookups.
    let tokens = null;
    let tokFirst = null, tokLast = null;
    if (f.text && String(f.text).trim()) {
      tokens = foldText(String(f.text).trim()).replace(/\s+/g, ' ').split(' ').filter(Boolean);
      const t = getNameTables();
      tokFirst = tokens.map((tk) => t.folded.map((c) => Uint8Array.from(c.first, (s) => (s.includes(tk) ? 1 : 0))));
      tokLast = tokens.map((tk) => t.folded.map((c) => Uint8Array.from(c.last, (s) => (s.includes(tk) ? 1 : 0))));
    }
    const ids = new Int32Array(n);
    let m = 0;
    const nClubs = this.clubs.length;
    const { flags, age, ovr, nation, pos, altPos, club } = this;
    for (let id = 0; id < n; id++) {
      if (flags[id] & FLAG.VACANT) continue;
      const a = age[id]; if (a < ageMin || a > ageMax) continue;
      const o = ovr[id]; if (o < ovrMin || o > ovrMax) continue;
      if (natMask && !natMask[nation[id]]) continue;
      if (posMask && !posMask[pos[id]]) {
        if (!inclAlt) continue;
        const ap = altPos[id];
        if (!((ap & 15) && posMask[(ap & 15) - 1]) && !((ap >> 4) && posMask[(ap >> 4) - 1])) continue;
      }
      const c = club[id];
      if (clubFilter !== -2 && c !== clubFilter) continue;
      if (fa === true && c !== NO_CLUB) continue;
      if (fa === false && c === NO_CLUB) continue;
      if (packOnly && c !== NO_CLUB && !(c < nClubs && this.clubIsBackground[c])) continue;
      if (ccMask && (c >= nClubs || !ccMask[this.clubCountry[c]])) continue;
      if (tokens) {
        const cu = NATION_CULTURE[nation[id]];
        let ok = true;
        for (let t = 0; t < tokens.length && ok; t++) {
          const fh = tokFirst[t][cu], lh = tokLast[t][cu];
          ok = fh[this.firstName[id] % fh.length] === 1 || lh[this.lastName[id] % lh.length] === 1;
        }
        if (!ok) continue;
      }
      ids[m++] = id;
    }
    const sorted = this._sortIds(ids.subarray(0, m), f.sortBy || 'ovr', f.sortDir || (f.sortBy === 'name' || f.sortBy === 'age' || f.sortBy === 'id' || f.sortBy === 'nation' || f.sortBy === 'club' || f.sortBy === 'pos' ? 'asc' : 'desc'));
    const off = f.offset || 0;
    if (f.limit === undefined && !off) return sorted;
    return sorted.slice(off, f.limit === undefined ? undefined : off + f.limit);
  }

  _sortKeyFn(sortBy) {
    switch (sortBy) {
      case 'ovr': return [(id) => this.ovr[id], 255];
      case 'potential': return [(id) => this.potentialOvr(id), 255];
      case 'age': return [(id) => this.age[id], 255];
      case 'peakOvr': return [(id) => this.peakOvr[id], 255];
      case 'caps': return [(id) => this.caps[id], 65535];
      case 'apps': return [(id) => this.seasonApps[id], 255];
      case 'goals': return [(id) => this.seasonGoals[id], 255];
      case 'assists': return [(id) => this.seasonAssists[id], 255];
      case 'rating': return [(id) => this.seasonRating10[id], 255];
      case 'pos': return [(id) => this.pos[id], 255];
      case 'nation': {
        const order = NATIONS.map((x, i) => i).sort((a, b) => (NATIONS[a].name < NATIONS[b].name ? -1 : 1));
        const rank = new Uint8Array(NATIONS.length);
        order.forEach((ni, r) => { rank[ni] = r; });
        return [(id) => rank[this.nation[id]], 255];
      }
      case 'club': {
        if (!this._clubNameRank) {
          const order = this.clubs.map((c) => c.id).sort((a, b) => {
            const x = this.clubs[a].name, y = this.clubs[b].name;
            return x < y ? -1 : x > y ? 1 : a - b;
          });
          this._clubNameRank = new Uint16Array(this.clubs.length);
          order.forEach((ci, r) => { this._clubNameRank[ci] = r; });
        }
        const rk = this._clubNameRank;
        return [(id) => (this.club[id] === NO_CLUB ? 65535 : rk[this.club[id]]), 65535];
      }
      case 'name': {
        const t = getNameTables();
        return [(id) => {
          const cu = NATION_CULTURE[this.nation[id]];
          const lr = t.lastRank[cu], fr = t.firstRank[cu];
          return lr[this.lastName[id] % lr.length] * 65536 + fr[this.firstName[id] % fr.length];
        }, 4294967295];
      }
      case 'id': return [() => 0, 0];
      default: throw new Error(`world: unknown sortBy ${sortBy}`);
    }
  }

  _sortIds(ids, sortBy, dir) {
    const [key, max] = this._sortKeyFn(sortBy);
    const desc = dir === 'desc';
    const keys = new Float64Array(ids.length);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const k = key(id);
      keys[i] = (desc ? max - k : k) * ID_SPACE + id;
    }
    keys.sort();
    const out = new Int32Array(ids.length);
    for (let i = 0; i < keys.length; i++) out[i] = keys[i] % ID_SPACE;
    return out;
  }

  /**
   * Best n players by OVR (ties: lower id first). nation: code, index or null for all. position: code, list or
   * null; opts.includeAltPos counts secondary positions too; opts.ageMax optional. Returns an array of ids.
   */
  topN(nation, position, n, opts = {}) {
    const ni = nation === null || nation === undefined ? -1 : (typeof nation === 'number' ? nation : NATION_INDEX[nation]);
    const posMask = toPosMask(position);
    const inclAlt = !!opts.includeAltPos;
    const ageMax = opts.ageMax ?? 255;
    const topId = new Int32Array(n).fill(-1);
    const topOvr = new Int16Array(n).fill(-1);
    let filled = 0;
    const { flags, ovr, pos, altPos, age } = this;
    const natArr = this.nation;
    for (let id = 0; id < this.size; id++) {
      if (flags[id] & FLAG.VACANT) continue;
      if (ni >= 0 && natArr[id] !== ni) continue;
      const o = ovr[id];
      if (filled === n && o <= topOvr[n - 1]) continue;
      if (age[id] > ageMax) continue;
      if (posMask && !posMask[pos[id]]) {
        if (!inclAlt) continue;
        const ap = altPos[id];
        if (!((ap & 15) && posMask[(ap & 15) - 1]) && !((ap >> 4) && posMask[(ap >> 4) - 1])) continue;
      }
      let j = filled < n ? filled++ : n - 1;
      while (j > 0 && topOvr[j - 1] < o) { topOvr[j] = topOvr[j - 1]; topId[j] = topId[j - 1]; j--; }
      topOvr[j] = o; topId[j] = id;
    }
    return Array.from(topId.subarray(0, filled));
  }

  /**
   * Uniform random live player matching the options, or -1.
   * opts: { ovrMin, ovrMax, pos (code or list), nations (codes), source:'pack'|'any', exclude:Set<number> }
   * source 'pack' = free agents (incl. youth intake) and background clubs only, never the 5 playable countries.
   * Deterministic for a given rng state: up to 48 rejection draws, then an exact scan.
   */
  randomPlayer(rng, opts = {}) {
    const ovrMin = opts.ovrMin ?? 0, ovrMax = opts.ovrMax ?? 255;
    const posMask = toPosMask(opts.pos);
    const natMask = toNationMask(opts.nations);
    const pack = opts.source === 'pack';
    const ex = opts.exclude;
    const nClubs = this.clubs.length;
    const ok = (id) => {
      if (this.flags[id] & FLAG.VACANT) return false;
      const o = this.ovr[id];
      if (o < ovrMin || o > ovrMax) return false;
      if (posMask && !posMask[this.pos[id]]) return false;
      if (natMask && !natMask[this.nation[id]]) return false;
      if (pack) { const c = this.club[id]; if (c !== NO_CLUB && !(c < nClubs && this.clubIsBackground[c])) return false; }
      if (ex && ex.has(id)) return false;
      return true;
    };
    for (let t = 0; t < 48; t++) {
      const id = rng.int(0, this.size - 1);
      if (ok(id)) return id;
    }
    // one exact pass (same rng use and same pick as counting first, then walking to the k-th match)
    const hits = [];
    for (let id = 0; id < this.size; id++) if (ok(id)) hits.push(id);
    if (!hits.length) return -1;
    return hits[rng.int(0, hits.length - 1)];
  }

  // ------------------------------------------------------------ club strength
  /**
   * Best XI of a club by OVR in a 4-3-3 shape: best GK, 2 CB, 2 FB, 3 of DM/CM/AM, 3 of W/ST/AM;
   * a missing role is filled by the best remaining outfield player. Returns 11 ids (fewer if the squad is short).
   */
  bestXI(clubId) { return bestXIOf(this.clubSquad(clubId), this.pos, this.ovr); }
  /** Average OVR of bestXI. */
  clubRating(clubId) {
    const xi = this.bestXI(clubId);
    let s = 0;
    for (const id of xi) s += this.ovr[id];
    return xi.length ? s / xi.length : 0;
  }

  // ------------------------------------------------------------ persistence
  /**
   * { meta, buffers } for IndexedDB / postMessage. copy:false hands out the live buffers (for transfer;
   * the world must not be used afterwards).
   */
  snapshot({ copy = true } = {}) {
    const buffers = {};
    for (const f of [...PLAYER_FIELDS, 'listHead', 'listCount']) {
      const a = this[f];
      buffers[f] = copy || a.byteOffset !== 0 || a.byteLength !== a.buffer.byteLength ? a.slice().buffer : a.buffer;
    }
    return {
      meta: { version: SNAPSHOT_VERSION, size: this.size, clubs: copy ? JSON.parse(JSON.stringify(this.clubs)) : this.clubs, meta: this.meta },
      buffers,
    };
  }

  /** Rebuild a World from snapshot() output (buffers are wrapped, not copied). */
  static fromSnapshot(snap) {
    const m = snap.meta;
    if (!m || m.version !== SNAPSHOT_VERSION) throw new Error(`world: unsupported snapshot version ${m && m.version}`);
    return new World(m.size, m.clubs, m.meta || {}, snap.buffers);
  }

  /** FNV-1a over every buffer (fixed order) plus the club table JSON. Stable across snapshot round trips. */
  checksum() {
    let h = 2166136261;
    h = fnvString(h, `size:${this.size}`);
    for (const f of [...PLAYER_FIELDS, 'listHead', 'listCount']) {
      const a = this[f];
      h = fnvString(h, f);
      h = fnvBytes(h, new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
    }
    h = fnvString(h, JSON.stringify(this.clubs));
    return h >>> 0;
  }

  /** Bytes held by typed arrays (players + rosters + club index). */
  byteSize() {
    let b = 0;
    for (const f of [...PLAYER_FIELDS, 'listHead', 'listCount']) b += this[f].byteLength;
    return b + this.clubCountry.byteLength + this.clubIsBackground.byteLength + this.clubDivision.byteLength;
  }
}

/** Pack an altPos list (codes or indices, max 2) into one byte. */
export function packAltPos(list) {
  let v = 0;
  for (let i = 0; i < Math.min(2, list.length); i++) {
    const p = typeof list[i] === 'number' ? list[i] : POS_INDEX[list[i]];
    v |= (p + 1) << (4 * i);
  }
  return v;
}

const XI_GROUPS = [
  [[0], 1], [[1], 2], [[2], 2], [[3, 4, 5], 3], [[6, 7, 5], 3],
];
/** Best XI ids from a squad id list, given pos and ovr arrays. Shared with the generator. */
export function bestXIOf(squad, posArr, ovrArr) {
  const sorted = Array.from(squad).sort((a, b) => ovrArr[b] - ovrArr[a] || a - b);
  const used = new Set();
  const xi = [];
  for (const [poses, count] of XI_GROUPS) {
    let got = 0;
    for (const id of sorted) {
      if (got === count) break;
      if (!used.has(id) && poses.includes(posArr[id])) { used.add(id); xi.push(id); got++; }
    }
    for (const id of sorted) {
      if (got === count) break;
      if (!used.has(id) && posArr[id] !== 0) { used.add(id); xi.push(id); got++; }
    }
  }
  return xi;
}

export { WORLD as WORLD_SETTINGS };
