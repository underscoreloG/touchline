// Test cheats (hidden menu). Dev tool: every call marks the save as cheated. Pure, seeded, no DOM.
// Each function mutates `state` / `world` and returns { ok, msg, pack? }.

import { RARITY } from '../balance.js';
import { openPack, signPlayer } from './economy.js';
import { makeStaff } from './generator.js';
import { playInstant, nextMatchInfo, newSeason, simToSeasonEnd } from './game.js';

const mark = (state) => { state.cheated = true; };

export function addCoins(state, amount) {
  mark(state);
  state.coins += amount;
  return { ok: true, msg: `+${amount.toLocaleString('en-US')} coins` };
}

/** Free pack of any type (promo included). `elite:true` forces an Elite or better in the pack. */
export function freePack(state, world, rng, type, { elite = false } = {}) {
  mark(state);
  if (elite) state.pity.gold = 99;
  const pack = openPack(type, state, world, rng);
  if (elite) state.pity.gold = 0;
  return { ok: true, msg: `Opened a free ${type} pack`, pack };
}

/** Sign one random pack-eligible player of a rarity band (optionally a position). */
export function signOne(state, world, rng, rarity, pos) {
  mark(state);
  if (rarity === 'icon') {
    if (!state.iconPool.length) return { ok: false, msg: 'Icon pool is empty' };
    const icon = rng.pick(state.iconPool);
    state.iconPool = state.iconPool.filter((c) => c !== icon);
    const card = { ...icon, id: `i${state.counters.card++}` };
    state.cards.push(card);
    return { ok: true, msg: `Signed icon ${card.icon.name}`, pack: { type: 'icon', cards: [card] } };
  }
  const r = RARITY[rarity];
  const id = world.randomPlayer(rng, { ovrMin: r.min, ovrMax: r.max, pos, source: 'pack' });
  if (id == null || id < 0) return { ok: false, msg: `No ${rarity}${pos ? ' ' + pos : ''} player available` };
  const card = signPlayer(id, world, rng, state);
  return { ok: true, msg: `Signed ${world.getPlayer(id).name} (${world.getPlayer(id).ovr})`, pack: { type: rarity, cards: [card] } };
}

export function giveStaff(state, rng, role, rarity = 'gold') {
  mark(state);
  const card = { ...makeStaff(rng, role, rarity), id: `s${state.counters.card++}` };
  state.cards.push(card);
  return { ok: true, msg: `Added ${role} staff`, pack: { type: rarity, cards: [card] } };
}

export function healAll(state) {
  mark(state);
  for (const c of state.cards) {
    if (c.kind !== 'player') continue;
    c.fitness = 100; c.injuredFor = 0; c.suspendedFor = 0; c.yellows = 0; c.morale = 100;
  }
  return { ok: true, msg: 'Everyone fit, healthy and happy' };
}

/** Flat boost to every stat of my players in matches (0 clears it). Read by game.buildMyTeam. */
export function setBoost(state, amount) {
  mark(state);
  state.cheats = { ...(state.cheats || {}), boost: amount };
  return { ok: true, msg: amount ? `Team boost +${amount} to all stats` : 'Team boost off' };
}

export function playMatches(state, world, n) {
  mark(state);
  let played = 0;
  while (played < n && nextMatchInfo(state, world)) {
    const r = playInstant(state, world);
    if (r && r.error) return { ok: false, msg: r.error };
    played++;
  }
  return { ok: true, msg: `Played ${played} match${played === 1 ? '' : 'es'}` };
}

/** Play the rest of the season: my matches instantly, the other leagues and the playoffs simulated. */
export function finishSeason(state, world) {
  mark(state);
  const r = simToSeasonEnd(state, world);
  return r.ok ? { ok: true, msg: `Season finished (${r.mine} of my matches played)` } : { ok: false, msg: r.error || 'Season could not finish' };
}

export function nextSeason(state, world) {
  mark(state);
  const done = simToSeasonEnd(state, world);
  if (!done.ok) return { ok: false, msg: done.error || 'Season could not finish' };
  const r = newSeason(state, world);
  return r.ok ? { ok: true, msg: `Season ${state.season.number} started` } : { ok: false, msg: r.error };
}
