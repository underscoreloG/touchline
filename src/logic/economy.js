// Rewards, prices, wages and pack opening. Pure and seeded. Pack signing mutates the world through its API.

import { RARITY, RARITIES, PACKS, PACK_PITY, PACK_OTHER_SLOTS, ITEMS, STAFF, TRAIT_IDS, COINS, GAME, FITNESS, MORALE, PACK_ROLL, STARTER_COMPOSITION, ICON_PROFILE, LEAGUE_SYSTEM } from '../balance.js';
import { S } from '../strings.js';
import { rarityFromOvr } from './cards.js';
import { makeManager, makeStaff } from './generator.js';
import { STYLE_IDS } from './cardEffects.js';
import { TACTIC_CARD_IDS } from './tactics.js';
import { NO_CLUB } from './world.js';

/** Club id used in the world store for "registered with my club". Must be accepted by world.moveToClub. */
export const MY_CLUB_ID = 0xfffe;

// ------------------------------------------------------------------ match income

/** Coin multiplier of a pyramid level (LEAGUE_SYSTEM.incomeMultByLevel; unknown level = bottom level). */
export const levelIncomeMult = (level) => LEAGUE_SYSTEM.incomeMultByLevel[level] ?? LEAGUE_SYSTEM.incomeMultByLevel[LEAGUE_SYSTEM.levels];

/**
 * Coins earned for a match. result: { goalsFor, goalsAgainst, home }.
 * level 1-5 = pyramid level of my club (continental cup passes continental:true).
 */
export function matchIncome({ goalsFor, goalsAgainst, home, level = LEAGUE_SYSTEM.startLevel, stadiumTier = 0, continental = false }) {
  const base = goalsFor > goalsAgainst ? COINS.matchResult.win : goalsFor === goalsAgainst ? COINS.matchResult.draw : COINS.matchResult.loss;
  let v = base + goalsFor * COINS.perGoal + (goalsAgainst === 0 ? COINS.cleanSheet : 0);
  v *= continental ? COINS.continentalMult : levelIncomeMult(level);
  if (home) v += COINS.gatePerStadiumTier * (1 + stadiumTier);
  return Math.round(v);
}

/** League prize by final position (1-based) in a table of `n` clubs at a pyramid level. Title = full, last = 20%. */
export function leaguePrize(position, n, level = LEAGUE_SYSTEM.startLevel) {
  const f = 1 - (position - 1) / Math.max(1, n - 1) * (1 - COINS.leaguePrizeLastFraction);
  return Math.round(COINS.leaguePrizeTitle * levelIncomeMult(level) * f);
}

export const quickSellValue = (rarity) => RARITY[rarity].quickSell;

/** Market price of a player card. */
export function marketPrice(ovr, age) {
  const rarity = rarityFromOvr(ovr);
  const m = COINS.marketPrice;
  let p = RARITY[rarity].quickSell * (m.base + (ovr - RARITY[rarity].min) * m.perOvr);
  if (age < m.youngAge) p *= m.youngBonus;
  if (age > m.oldAge) p *= m.oldMult;
  return Math.round(p);
}
export const priceAfterTax = (price) => Math.round(price * (1 - COINS.marketPrice.saleTax));

export const wagePerMatch = (ovr) => Math.round(((ovr - COINS.wage.ovrOffset) ** 2) / COINS.wage.divisor);

// ------------------------------------------------------------------ packs

/** Roll the rarity of one player slot. */
export function rollRarity(rng, packType, forceElite = false) {
  const odds = PACKS[packType].odds;
  const keys = Object.keys(odds);
  if (forceElite) {
    const hi = keys.filter((k) => RARITIES.indexOf(k) >= RARITIES.indexOf('elite'));
    return hi.length ? rng.weighted(hi, hi.map((k) => odds[k])) : 'elite';
  }
  return rng.weighted(keys, keys.map((k) => odds[k]));
}

/** Weighted OVR inside a rarity band: lower values more common. */
function rollOvr(rng, rarity) {
  const { min, max } = RARITY[rarity];
  const span = max - min;
  const u = rng.next();
  return Math.min(max, min + Math.floor(Math.pow(u, PACK_ROLL.ovrCurve) * (span + 1)));
}

/** One random pack-eligible player in an OVR band that also satisfies an age filter (exact, through world.query). */
function pickByQuery(world, rng, band, f) {
  const ids = world.query({ packEligible: true, ovrMin: band[0], ovrMax: band[1], pos: f.pos, ageMin: f.ageMin, ageMax: f.ageMax });
  return ids.length ? ids[rng.int(0, ids.length - 1)] : -1;
}

function pickWorldPlayer(world, rng, rarity, filters) {
  // try the exact OVR first, then widen inside the rarity band, then fall back to the nearest rarity below
  let r = rarity;
  for (let tries = 0; tries < PACK_ROLL.tries; tries++) {
    const ovr = rollOvr(rng, r);
    const spread = tries < PACK_ROLL.spreadUntil[0] ? PACK_ROLL.spread[0] : tries < PACK_ROLL.spreadUntil[1] ? PACK_ROLL.spread[1] : PACK_ROLL.spread[2];
    const band = [Math.max(RARITY[r].min, ovr - spread), Math.min(RARITY[r].max, ovr + spread)];
    const aged = filters && (filters.ageMin !== undefined || filters.ageMax !== undefined);
    const id = aged ? pickByQuery(world, rng, band, filters) : world.randomPlayer(rng, { ovrMin: band[0], ovrMax: band[1], source: 'pack', ...filters });
    if (id != null && id >= 0) return { id, rarity: r };
    if (tries === PACK_ROLL.dropRarityAtTry && RARITIES.indexOf(r) > 0) r = RARITIES[RARITIES.indexOf(r) - 1];
  }
  return null;
}

/** Icons live outside the world: a pool of fictional retired greats stored in the save. */
export function iconWorldPlayer(card) {
  const i = card.icon;
  return {
    id: card.playerId, name: i.name, nation: i.nation, age: i.age, foot: i.foot, clubId: -1, pos: i.pos, altPos: [],
    stats: { ...i.stats }, potential: { ...i.stats }, devType: ICON_PROFILE.devType, peakStart: ICON_PROFILE.peakStart, peakEnd: ICON_PROFILE.peakEnd,
    professionalism: ICON_PROFILE.professionalism, injuryProne: ICON_PROFILE.injuryProne, consistency: ICON_PROFILE.consistency, ovr: i.ovr, peakOvr: i.ovr, caps: 0, intlGoals: 0,
    season: { apps: 0, goals: 0, assists: 0, avgRating: 0 },
  };
}

/**
 * Buy and open a pack: validates the type (own-property whitelist), takes the coins only if the pack opens.
 * Returns { ok, pack } or { ok:false, error }.
 */
export function buyPack(state, world, rng, type) {
  if (typeof type !== 'string' || !GAME.buyablePacks.includes(type) || !Object.hasOwn(PACKS, type)) return { ok: false, error: S.errors.unknownPack };
  const price = PACKS[type].price;
  if (!(state.coins >= price)) return { ok: false, error: S.packs.notEnough };
  const pack = openPack(type, state, world, rng);
  state.coins -= price;
  return { ok: true, pack };
}

/** Item card of a kind and tier (common / rare / epic). Training cards leave the stat open: the player picks it when applying. */
export function makeItemCard(rng, state, kind, tier = 'common') {
  const id = (p) => `${p}${state.counters.card++}`;
  const rarity = ITEMS.tierRarity[tier];
  if (kind === 'consumable') {
    const d = rng.weighted(ITEMS.consumables, ITEMS.consumables.map((x) => x.weight));
    return { id: id('c'), kind: 'consumable', effect: d.effect, amount: d.amount, rarity: 'bronze' };
  }
  if (kind === 'training') return { id: id('t'), kind: 'training', stat: null, amount: ITEMS.trainingAmount[tier], rarity };
  if (kind === 'trait') return { id: id('r'), kind: 'trait', traitId: rng.pick(TRAIT_IDS), rarity };
  if (kind === 'style') return { id: id('y'), kind: 'style', styleId: rng.pick(STYLE_IDS), rarity };
  return { id: id('a'), kind: 'tactic', tacticId: rng.pick(TACTIC_CARD_IDS), rarity };
}

const tierRoll = (rng, odds) => rng.weighted(Object.keys(odds), Object.values(odds));

/** One "other" slot of a player pack, by the spec mix (club items are not built yet: they become staff). */
function otherCard(rng, state) {
  const kinds = ['consumable', 'training', 'tacticOrStyle', 'staffOrClub'];
  const k = rng.weighted(kinds, kinds.map((x) => PACK_OTHER_SLOTS[x]));
  if (k === 'consumable') return makeItemCard(rng, state, 'consumable');
  if (k === 'training') return makeItemCard(rng, state, 'training', tierRoll(rng, ITEMS.otherTierOdds));
  if (k === 'tacticOrStyle') return makeItemCard(rng, state, rng.chance(0.5) ? 'tactic' : 'style', tierRoll(rng, ITEMS.otherTierOdds));
  return { ...makeStaff(rng, rng.pick(STAFF.roles), rng.weighted(['bronze', 'silver', 'gold'], [60, 32, 8])), id: `s${state.counters.card++}` };
}

/**
 * Open a pack. Mutates `state` (cards, pity, counters) and the world (signed players move to MY_CLUB_ID and the donor
 * club is refilled). Paying is done by buyPack. Icons come from state.iconPool and never touch the world; if the pool is
 * empty an Icon roll becomes an Elite roll.
 *  - Player packs: `players` signed players (position and age packs filter them), then `others` item cards by the spec
 *    mix PACK_OTHER_SLOTS (consumable / training / tactic or style / staff).
 *  - Staff pack: `others` cards that are staff (or a manager, ITEMS.staffManagerShare), rarity by the pack odds.
 *  - Training pack: `others` cards of kinds ITEMS.trainingPackKinds, tier by the pack odds.
 * Returns { type, cards:[card...], summary:{best} }.
 */
export function openPack(type, state, world, rng, opts = {}) {
  const def = PACKS[type];
  if (!def) throw new Error('unknown pack ' + type);
  const out = [];
  state.pity = state.pity || { gold: 0 };
  state.counters = state.counters || { card: 1 };
  state.iconPool = state.iconPool || [];
  const nextId = (p) => `${p}${state.counters.card++}`;
  const push = (card) => { state.cards.push(card); out.push(card); return card; };

  if (type === 'staff') {
    for (let i = 0; i < def.others; i++) {
      const rarity = tierRoll(rng, def.odds);
      if (rng.chance(ITEMS.staffManagerShare)) push({ ...makeManager(rng, { rarity }), id: nextId('m') });
      else push({ ...makeStaff(rng, rng.pick(STAFF.roles), rarity), id: nextId('s') });
    }
    return { type, cards: out, summary: { best: null } };
  }
  if (type === 'training') {
    const kinds = Object.keys(ITEMS.trainingPackKinds);
    for (let i = 0; i < def.others; i++) {
      const kind = rng.weighted(kinds, kinds.map((k) => ITEMS.trainingPackKinds[k]));
      push(makeItemCard(rng, state, kind, tierRoll(rng, def.odds)));
    }
    return { type, cards: out, summary: { best: null } };
  }

  const nPlayers = type === 'starter' ? 0 : def.players;
  let gotElite = false;
  const forcedElite = type === 'gold' && state.pity.gold + 1 >= PACK_PITY.goldNoElite;
  for (let i = 0; i < nPlayers; i++) {
    const force = forcedElite && i === nPlayers - 1 && !gotElite;
    let rar = rollRarity(rng, type, force);
    if (rar === 'icon') {
      if (state.iconPool.length) {
        const icon = rng.pick(state.iconPool);
        state.iconPool = state.iconPool.filter((c) => c !== icon);
        push({ ...icon, id: nextId('i') });
        gotElite = true;
        continue;
      }
      rar = 'elite';
    }
    const filters = { ...(opts.filters || {}), ...(def.filter || {}) };
    if (Array.isArray(filters.pos)) filters.pos = rng.pick(filters.pos); // one position of the group per slot
    // a thin band (for example Elite players aged 30+) falls back to lower rarities, then to the plain pool,
    // so a pack never comes back with fewer players than it promises
    const picked = pickWorldPlayer(world, rng, rar, filters) || pickWorldPlayer(world, rng, 'silver', filters)
      || pickWorldPlayer(world, rng, 'bronze', filters) || pickWorldPlayer(world, rng, 'bronze', { ...filters, ageMin: undefined, ageMax: undefined });
    if (!picked) continue;
    out.push(signPlayer(picked.id, world, rng, state));
    if (RARITIES.indexOf(picked.rarity) >= RARITIES.indexOf('elite')) gotElite = true;
  }
  if (type === 'gold') state.pity.gold = gotElite ? 0 : state.pity.gold + 1;

  const nOthers = type === 'starter' ? 0 : def.others || 0;
  for (let i = 0; i < nOthers; i++) push(otherCard(rng, state));

  const order = (c) => (c.kind === 'player' ? RARITIES.indexOf(c.isIcon ? 'icon' : rarityFromOvr(world.getPlayer(c.playerId)?.ovr ?? 0)) : -1);
  const best = out.reduce((b, c) => Math.max(b, order(c)), -1);
  return { type, cards: out, summary: { best: best >= 0 ? RARITIES[best] : null } };
}

/** Register a world player with my club and top up the donor club. */
export function signPlayer(playerId, world, rng, state) {
  const p = world.getPlayer(playerId);
  const fromClub = p.clubId >= 0 && p.clubId !== NO_CLUB ? world.getClub(p.clubId) : null;
  const card = {
    id: `p${playerId}`, kind: 'player', playerId,
    signedFromClubId: fromClub ? fromClub.id : -1,
    leagueId: fromClub ? fromClub.country : p.nation,
    upgrades: [], traits: [], styleId: null,
    fitness: FITNESS.start, morale: MORALE.start, form: 0, contract: COINS.contractStart,
    injuredFor: 0, suspendedFor: 0, yellows: 0,
    career: { apps: 0, goals: 0, assists: 0, cleanSheets: 0, avgRating: 0 },
  };
  world.moveToClub(playerId, MY_CLUB_ID);
  if (fromClub && world.refillClub) world.refillClub(rng, fromClub.id);
  state.cards.push(card);
  return card;
}

/** Starter pack: 18 players (Bronze 80 / Silver 20, two keepers guaranteed) plus a manager. */
export function openStarter(state, world, rng) {
  state.pity = state.pity || { gold: 0 };
  state.counters = state.counters || { card: 1 };
  const out = [];
  const rarityPicks = () => (rng.chance(RARITY.silver.starterWeight) ? 'silver' : 'bronze');
  // composition: 2 GK, 6 defenders, 6 midfielders, 4 attackers (balance.js STARTER_COMPOSITION)
  for (const pos of STARTER_COMPOSITION) {
    const picked = pickWorldPlayer(world, rng, rarityPicks(), { pos, ...(state.country ? { nations: undefined } : {}) });
    if (!picked) continue;
    out.push(signPlayer(picked.id, world, rng, state));
  }
  const m = makeManager(rng, { rarity: 'bronze', nation: state.country });
  const mc = { ...m, id: `m${state.counters.card++}` };
  state.cards.push(mc);
  out.push(mc);
  return { type: 'starter', cards: out, summary: { best: 'silver', coins: 0 } };
}
