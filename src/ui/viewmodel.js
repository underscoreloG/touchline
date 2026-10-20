// Builds the flat card view models documented at the top of components/card.js from game state + world.
// Read-only: no rules here.

import { OUTFIELD_STATS, GK_STATS, RARITY, SQUAD_RULES, STAT_LABELS } from '../balance.js';
import { S, fmt } from '../strings.js';
import { rarityFromOvr } from '../logic/cards.js';
import { effectiveStats, TRAIT_CATALOGUE, STYLE_CARDS } from '../logic/cardEffects.js';
import { NATION_BY_CODE } from '../logic/nations.js';
import { makeCrest } from './components/crest.js';
import { rngFrom } from '../logic/rng.js';
import { TACTIC_CARDS } from '../logic/tactics.js';
import { worldPlayerOf } from '../logic/game.js';

const crestCache = new Map();
function nationCrest(code) {
  if (crestCache.has(code)) return crestCache.get(code);
  const n = NATION_BY_CODE[code];
  const c = makeCrest(rngFrom('crest:' + code), n ? n.colours : ['#444444', '#aaaaaa']);
  crestCache.set(code, c);
  return c;
}

export const flagOfCode = (code) => (NATION_BY_CODE[code] ? NATION_BY_CODE[code].flag : '');
export const nationName = (code) => (NATION_BY_CODE[code] ? NATION_BY_CODE[code].name : code);

/** View model of one of my cards. `ctx` can carry { playedPos, chem, outOfPos, styleLabel }. */
export function cardView(card, world, state, ctx = {}) {
  if (card.kind === 'player') return playerView(card, world, state, ctx);
  if (card.kind === 'manager') {
    return {
      kind: 'manager', id: card.id, rarity: card.rarity, name: card.name, nation: card.nation, flag: flagOfCode(card.nation),
      avatarSeed: card.name, value: card.formation, styleLabel: S.clubStyle[card.style] || card.style,
      text: fmt(S.cardView.managerBonus, { what: card.chemBonus.type === 'nation' ? nationName(card.chemBonus.value) : card.chemBonus.value }),
    };
  }
  if (card.kind === 'staff') return { kind: 'staff', id: card.id, rarity: card.rarity, role: card.role, level: card.level, name: card.name, text: fmt(S.cardView.staffText, { n: card.level }) };
  if (card.kind === 'consumable' && S.cardView.consumable[card.effect]) {
    return { kind: 'consumable', id: card.id, rarity: card.rarity || 'bronze', title: S.cardView.consumable[card.effect], value: card.amount ? '+' + card.amount : '', text: fmt(S.cardView.consumableText[card.effect], { n: card.amount }), icon: { fitness: 'fitnessDrink', heal: 'heal', contract: 'contract', morale: 'morale' }[card.effect] };
  }
  if (card.kind === 'training') {
    const stat = card.stat ? STAT_LABELS[card.stat] || card.stat : '';
    return { kind: 'training', id: card.id, rarity: card.rarity || 'bronze', title: S.cardView.training, value: '+' + card.amount, text: stat ? fmt(S.cardView.trainingStat, { n: card.amount, stat }) : fmt(S.cardView.trainingAny, { n: card.amount }) + '. ' + S.cardView.trainingText };
  }
  if (card.kind === 'trait' && TRAIT_CATALOGUE[card.traitId]) return { kind: 'trait', id: card.id, rarity: card.rarity || 'bronze', title: TRAIT_CATALOGUE[card.traitId].name, text: TRAIT_CATALOGUE[card.traitId].description };
  if (card.kind === 'style' && STYLE_CARDS[card.styleId]) return { kind: 'style', id: card.id, rarity: card.rarity || 'bronze', title: STYLE_CARDS[card.styleId].name, text: STYLE_CARDS[card.styleId].description };
  if (card.kind === 'tactic') {
    const t = TACTIC_CARDS.find((x) => x.id === card.tacticId);
    if (t) return { kind: 'tactic', id: card.id, rarity: card.rarity || 'bronze', title: t.name, text: t.upside + ' ' + t.cost };
  }
  if (card.kind === 'coins') return { kind: 'consumable', id: card.id, rarity: card.amount >= 1000 ? 'gold' : card.amount >= 300 ? 'silver' : 'bronze', title: S.cardView.coinBundle, value: `+${card.amount}`, text: S.cardView.coinBundleText, icon: 'contract' };
  return { kind: card.kind, id: card.id, rarity: card.rarity || 'bronze', title: card.title || card.kind, text: card.text || '' };
}

export function playerView(card, world, state, ctx = {}) {
  const wp = worldPlayerOf(card, world);
  const playedPos = ctx.playedPos || wp.pos;
  const eff = effectiveStats({
    stats: wp.stats, upgrades: card.upgrades, traits: card.traits, styleId: card.styleId, chem: ctx.chem ?? 0,
    nativePos: wp.pos, altPos: wp.altPos, playedPos, rarity: card.isIcon ? 'icon' : undefined,
  });
  const club = card.signedFromClubId >= 0 ? world.getClub(card.signedFromClubId) : null;
  const keys = wp.pos === 'GK' ? GK_STATS : OUTFIELD_STATS;
  const stats = {};
  for (const k of keys) stats[k] = eff.stats[k] ?? wp.stats[k];
  const ovr = eff.ovr;
  const rarity = card.isIcon ? 'icon' : rarityFromOvr(wp.ovr);
  const slots = RARITY[rarity].slots;
  const style = card.styleId ? STYLE_CARDS[card.styleId] : null;
  return {
    kind: 'player', id: card.id, rarity, ovr, pos: playedPos, altPos: wp.altPos, name: wp.name,
    shortName: shortName(wp.name), nation: wp.nation, flag: flagOfCode(wp.nation), nationName: nationName(wp.nation),
    crest: club ? club.crest : nationCrest(wp.nation), clubName: club ? club.name : nationName(wp.nation),
    age: wp.age, stats, avatarSeed: card.isIcon ? 'icon:' + card.id : wp.id, kitColour: club ? club.colours[0] : (NATION_BY_CODE[wp.nation]?.colours[0] || '#444'),
    traits: card.traits.map((t) => TRAIT_CATALOGUE[t]?.name || t).slice(0, 2),
    styleLabel: style ? style.name : '', isIcon: !!card.isIcon,
    status: {
      fitness: Math.round(card.fitness), injured: card.injuredFor > 0 ? card.injuredFor : false,
      suspended: card.suspendedFor > 0 ? card.suspendedFor : false, contractLow: card.contract <= SQUAD_RULES.contractLowAt,
      outOfPos: ctx.outOfPos || 0, chem: ctx.chem ?? 0,
    },
    upgradesUsed: card.upgrades.length, upgradeSlots: slots,
    ...ctx.extra,
  };
}

function shortName(full) {
  const parts = String(full).split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : full;
}

/** Pack result (from economy.openPack) to the shape openPackUI expects. */
export function packView(pack, world, state) {
  return { type: pack.type, cards: pack.cards.map((c) => cardView(c, world, state)) };
}
