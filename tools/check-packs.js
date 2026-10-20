// Checks for every pack type. node tools/check-packs.js
import { rngFrom } from '../src/logic/rng.js';
import { generateWorld } from '../src/logic/generator.js';
import { createState, startGame, staffLevelsOf, prepareMatch } from '../src/logic/game.js';
import { buyPack, openPack } from '../src/logic/economy.js';
import { applyItemCard, applicableItems, equipTacticCard, tacticsView } from '../src/logic/squad.js';
import { PACKS, GAME, PACK_SHOP, ITEMS } from '../src/balance.js';
import { cardView } from '../src/ui/viewmodel.js';

let pass = 0, fail = 0;
const check = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? '  ok  ' : '  FAIL'} ${n} ${x}`); };

const world = generateWorld(7, 50000, () => {});
const rng = rngFrom(7);
const st = createState({ seed: 7, worldSize: 50000, country: 'ENG', club: { name: 'T', colours: ['#c8102e', '#fff'], crest: {} } });
startGame(st, world, rng);
st.coins = 1e9;

const shopPacks = PACK_SHOP.flatMap((g) => g.packs);
check('shop lists exactly the buyable packs', JSON.stringify([...shopPacks].sort()) === JSON.stringify([...GAME.buyablePacks].sort()), shopPacks.join(','));
check('every shop pack has a price and odds', shopPacks.every((t) => PACKS[t].price > 0 && PACKS[t].odds));

// player packs: counts, filters
const groups = { gk: ['GK'], def: ['CB', 'FB'], mid: ['DM', 'CM', 'AM'], att: ['W', 'ST'] };
for (const [type, posList] of Object.entries(groups)) {
  let ok = true, n = 0;
  for (let i = 0; i < 60; i++) {
    const r = buyPack(st, world, rng, type);
    if (!r.ok) { ok = false; break; }
    for (const c of r.pack.cards.filter((x) => x.kind === 'player' && !x.isIcon)) { n++; if (!posList.includes(world.getPlayer(c.playerId).pos)) ok = false; }
  }
  check(`${type} pack: ${n} players all in ${posList.join('/')}`, ok && n >= 150);
}
{
  let young = 0, n = 0, old = 0, m = 0, okSize = true;
  for (let i = 0; i < 60; i++) {
    const a = buyPack(st, world, rng, 'prospect'), b = buyPack(st, world, rng, 'veteran');
    for (const c of a.pack.cards.filter((x) => x.kind === 'player' && !x.isIcon)) { n++; if (world.getPlayer(c.playerId).age <= 20) young++; }
    for (const c of b.pack.cards.filter((x) => x.kind === 'player' && !x.isIcon)) { m++; if (world.getPlayer(c.playerId).age >= 30) old++; }
    if (a.pack.cards.filter((x) => x.kind === 'player').length < 1 || b.pack.cards.filter((x) => x.kind === 'player').length < 1) okSize = false;
  }
  check(`prospect pack: ${young}/${n} players aged 20 or under`, young === n && n >= 100);
  check(`veteran pack: ${old}/${m} players aged 30 or over`, old === m && m >= 100);
  check('age packs never come back empty', okSize);
}
{
  const p = buyPack(st, world, rng, 'promo');
  check('promo pack opens with 4 players + 2 others', p.ok && p.pack.cards.filter((c) => c.kind === 'player').length === 4 && p.pack.cards.length === 6);
}

// item packs
const staffKinds = {}, trainingKinds = {}, tiers = {};
for (let i = 0; i < 80; i++) {
  for (const c of buyPack(st, world, rng, 'staff').pack.cards) staffKinds[c.kind] = (staffKinds[c.kind] || 0) + 1;
  for (const c of buyPack(st, world, rng, 'training').pack.cards) { trainingKinds[c.kind] = (trainingKinds[c.kind] || 0) + 1; tiers[c.rarity] = (tiers[c.rarity] || 0) + 1; }
}
check('staff pack gives staff and some managers only', Object.keys(staffKinds).every((k) => k === 'staff' || k === 'manager') && staffKinds.staff > 0 && staffKinds.manager > 0, JSON.stringify(staffKinds));
check('training pack gives training/trait/style/tactic only', Object.keys(trainingKinds).every((k) => ['training', 'trait', 'style', 'tactic'].includes(k)) && Object.keys(trainingKinds).length === 4, JSON.stringify(trainingKinds));
check('training pack tiers follow 70/25/5', tiers.bronze > tiers.gold && tiers.gold > (tiers.elite || 0), JSON.stringify(tiers));
{
  const total = Object.values(tiers).reduce((a, b) => a + b, 0);
  check('common share near 70%', Math.abs(tiers.bronze / total - 0.7) < 0.08, (tiers.bronze / total).toFixed(2));
}

// "other" slots of player packs follow the spec mix
const kinds = {};
for (let i = 0; i < 150; i++) {
  const r = buyPack(st, world, rng, 'gold');
  for (const c of r.pack.cards.filter((x) => x.kind !== 'player')) kinds[c.kind] = (kinds[c.kind] || 0) + 1;
}
const kt = Object.values(kinds).reduce((a, b) => a + b, 0);
check('other slots: consumables about half', Math.abs((kinds.consumable || 0) / kt - 0.5) < 0.1, JSON.stringify(kinds));
check('other slots include training, tactic/style and staff', kinds.training > 0 && kinds.staff > 0 && (kinds.tactic || 0) + (kinds.style || 0) > 0);
check('no manager or coin cards in player-pack other slots', !kinds.manager && !kinds.coins);

// every card kind has a view model
const kindsSeen = new Set(st.cards.map((c) => c.kind));
let viewsOk = true;
for (const c of st.cards) { const v = cardView(c, world, st); if (!v || !v.kind || (v.kind !== 'player' && !v.title && !v.name && v.kind !== 'staff')) viewsOk = false; }
check(`view models exist for kinds: ${[...kindsSeen].join(',')}`, viewsOk);

// items are usable: training, trait, style, consumable, tactic
{
  const mine = st.cards.filter((c) => c.kind === 'player' && !c.isIcon);
  const pc = mine.find((c) => world.getPlayer(c.playerId).pos !== 'GK' && c.upgrades.length === 0);
  const training = st.cards.find((c) => c.kind === 'training');
  const ap = applyItemCard(st, world, { itemCardId: training.id, playerCardId: pc.id, stat: 'pac' });
  check('training card applies and is consumed', ap.ok && !st.cards.some((c) => c.id === training.id) && pc.upgrades.length === 1, ap.message || '');
  const consumable = st.cards.find((c) => c.kind === 'consumable' && c.effect === 'contract');
  if (consumable) {
    const before = pc.contract;
    const r = applyItemCard(st, world, { itemCardId: consumable.id, playerCardId: pc.id });
    check('contract consumable adds matches', r.ok && pc.contract === before + consumable.amount);
  } else check('contract consumable exists (skipped)', true);
  const tactic = st.cards.find((c) => c.kind === 'tactic');
  const eq = equipTacticCard(st, 0, tactic.id);
  check('tactic card equips into a slot', eq.ok && st.squad.tacticCards[0] === tactic.id, eq.message || '');
  const prep = prepareMatch(st, world);
  const mine2 = prep.info.homeIsMe ? prep.home : prep.away;
  check('equipped tactic reaches the match team', mine2.tacticCards.length === 1);
  const lv = staffLevelsOf(st);
  check('staff cards produce staff levels', Object.keys(lv).length > 0, JSON.stringify(lv));
  check('item cards listed for a player', applicableItems(st, world, pc.id).length > 0);
}

check('GameState survives JSON round trip with all card kinds', JSON.stringify(JSON.parse(JSON.stringify(st))) === JSON.stringify(st));
check('determinism: same seed, same pack', (() => {
  const a = generateWorld(9, 30000, () => {}), b = generateWorld(9, 30000, () => {});
  const s1 = createState({ seed: 9, worldSize: 30000, country: 'ENG', club: { name: 'x', colours: ['#000', '#fff'], crest: {} } });
  const s2 = createState({ seed: 9, worldSize: 30000, country: 'ENG', club: { name: 'x', colours: ['#000', '#fff'], crest: {} } });
  startGame(s1, a, rngFrom(9)); startGame(s2, b, rngFrom(9));
  return ['training', 'att', 'staff'].every((t) => JSON.stringify(openPack(t, s1, a, rngFrom(5))) === JSON.stringify(openPack(t, s2, b, rngFrom(5))));
})());
void ITEMS;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
