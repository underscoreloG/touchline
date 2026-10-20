// Pack odds report. node tools/sim.js --packs [--n 10000] [--world 50000]
// 1) rolled rarity over N openings per pack type (pure odds + pity), 2) delivered rarity through the real world
// (economy.openPack on a fresh world per chunk), including fallbacks when a band is thin in the pack source.

import { rngFrom } from '../src/logic/rng.js';
import { PACKS, PACK_PITY, RARITIES } from '../src/balance.js';
import { rollRarity, openPack, openStarter } from '../src/logic/economy.js';
import { generateWorld } from '../src/logic/generator.js';
import { rarityFromOvr } from '../src/logic/cards.js';

const pct = (v, n) => ((100 * v) / n).toFixed(2).padStart(6) + '%';

export function packOdds({ n = 10000, worldSize = 50000 } = {}) {
  console.log(`== Pack odds: rolled rarity over ${n} openings per pack (published odds vs measured) ==`);
  for (const type of ['bronze', 'silver', 'gold', 'promo', 'gk', 'def', 'prospect', 'veteran']) {
    const def = PACKS[type];
    const rng = rngFrom('odds:' + type);
    const counts = Object.fromEntries(RARITIES.map((r) => [r, 0]));
    let slots = 0, pity = 0, forced = 0, noEliteStreakMax = 0;
    for (let i = 0; i < n; i++) {
      let got = false;
      const force = type === 'gold' && pity + 1 >= PACK_PITY.goldNoElite;
      for (let s = 0; s < def.players; s++) {
        const f = force && s === def.players - 1 && !got;
        const r = rollRarity(rng, type, f);
        if (f) forced++;
        counts[r]++; slots++;
        if (r === 'elite' || r === 'icon') got = true;
      }
      if (type === 'gold') { pity = got ? 0 : pity + 1; noEliteStreakMax = Math.max(noEliteStreakMax, pity); }
    }
    const published = Object.entries(def.odds).map(([r, v]) => `${r} ${v}%`).join(' / ');
    console.log(`${type.padEnd(7)} ${String(def.price).padStart(6)} coins  published: ${published}`);
    console.log('        measured: ' + RARITIES.filter((r) => counts[r]).map((r) => `${r} ${pct(counts[r], slots)}`).join(' / ')
      + (type === 'gold' ? `   pity forced ${forced} times, longest no-elite streak ${noEliteStreakMax} (cap ${PACK_PITY.goldNoElite})` : ''));
  }

  console.log(`\n== Delivered rarity through the real world (${worldSize} players, fresh world per 300 openings) ==`);
  const perChunk = 300;
  for (const type of ['bronze', 'silver', 'gold', 'promo', 'gk', 'def', 'prospect', 'veteran']) {
    const delivered = Object.fromEntries(RARITIES.map((r) => [r, 0]));
    let total = 0, short = 0, openings = 0;
    const chunks = Math.max(1, Math.round(Math.min(n, 3000) / perChunk));
    for (let c = 0; c < chunks; c++) {
      const world = generateWorld(1000 + c, worldSize, () => {});
      const rng = rngFrom(`deliver:${type}:${c}`);
      const state = { cards: [], pity: { gold: 0 }, coins: 0, counters: { card: 1 }, iconPool: [], country: 'ENG' };
      for (let i = 0; i < perChunk; i++) {
        const p = openPack(type, state, world, rng);
        openings++;
        let players = 0;
        for (const card of p.cards) {
          if (card.kind !== 'player') continue;
          players++;
          const ovr = world.getPlayer(card.playerId).ovr;
          delivered[rarityFromOvr(ovr)]++; total++;
        }
        short += PACKS[type].players - players;
      }
    }
    console.log(`${type.padEnd(7)} delivered: ${RARITIES.filter((r) => delivered[r]).map((r) => `${r} ${pct(delivered[r], total)}`).join(' / ')}   (${openings} openings, ${short} player slots unfilled)`);
  }
}
