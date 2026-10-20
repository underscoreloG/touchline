// Regression checks for the game flow (logic/game.js, economy.js). node tools/check-game.js
import { rngFrom } from '../src/logic/rng.js';
import { generateWorld } from '../src/logic/generator.js';
import { createState, startGame, prepareMatch, playInstant, createLiveMatch, nextMatchInfo, repairLineup, newSeason, applyMatchResult, myLeague, simToSeasonEnd } from '../src/logic/game.js';
import { buyPack, MY_CLUB_ID } from '../src/logic/economy.js';
import { stepTick, isFinished, summarise } from '../src/logic/matchEngine.js';
import { quickSell } from '../src/logic/squad.js';

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { if (ok) pass++; else fail++; console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${extra ? '  ' + extra : ''}`); };

function fresh(seed = 7) {
  const world = generateWorld(seed, 30000, () => {});
  const rng = rngFrom(seed);
  const st = createState({ seed, worldSize: 30000, country: 'ENG', club: { name: 'T FC', colours: ['#c8102e', '#ffffff'], crest: {} } });
  startGame(st, world, rng);
  return { world, rng, st };
}

{
  const { world, st } = fresh();
  // B1: empty XI slot
  st.squad.xi[4] = null;
  let prep = prepareMatch(st, world);
  check('empty XI slot is repaired, match prepares', prep && !prep.error && st.squad.xi.every(Boolean) && new Set(st.squad.xi).size === 11);

  // M1: injured / suspended starter never plays
  const victim = st.cards.find((c) => c.id === st.squad.xi[2]);
  victim.injuredFor = 3;
  const victim2 = st.cards.find((c) => c.id === st.squad.xi[7]);
  victim2.suspendedFor = 2;
  prep = prepareMatch(st, world);
  const ids = new Set(prep.home.xi.concat(prep.away.xi).concat(prep.home.bench, prep.away.bench).map((p) => p.id));
  check('injured and suspended cards are not in the squad sheet', !ids.has(victim.playerId) && !ids.has(victim2.playerId));
  const r = playInstant(st, world);
  check('their counters tick down on missed matches', victim.injuredFor === 2 && victim2.suspendedFor === 1, `${victim.injuredFor}/${victim2.suspendedFor}`);
  check('instant match applied, the whole pyramid moved one round', r && r.summary && myLeague(st).matchday === 1 && st.season.pyramid.round === 1 && Object.values(st.season.pyramid.leagues).every((lg) => lg.matchday === 1));

  // sell a starter via the squad action, then repair
  const sellId = st.squad.xi[0];
  quickSell(st, world, sellId);
  const fix = repairLineup(st, world);
  check('selling a starter leaves a valid XI after repair', fix.ok && st.squad.xi.every(Boolean) && !st.squad.xi.includes(sellId));

  // not enough players
  const mine = st.cards.filter((c) => c.kind === 'player');
  const keep = mine.slice(0, 8).map((c) => c.id);
  const clone = structuredClone(st);
  clone.cards = clone.cards.filter((c) => c.kind !== 'player' || keep.includes(c.id));
  const bad = repairLineup(clone, world);
  check('fewer than 11 fit players is reported, not thrown', bad.ok === false && typeof bad.error === 'string');
}

{
  // M2: watched match == instant with default answers
  let same = 0, total = 0;
  for (let seed = 21; seed < 29; seed++) {
    const a = fresh(seed), b = fresh(seed);
    const prepA = prepareMatch(a.st, a.world), prepB = prepareMatch(b.st, b.world);
    const resA = playInstant(a.st, a.world).res;
    const m = createLiveMatch(prepB);
    let guard = 0;
    while (!isFinished(m) && guard++ < 200) stepTick(m);
    const resB = summarise(m);
    total++;
    if (resA.score.home === resB.score.home && resA.score.away === resB.score.away) same++;
  }
  check('watched match equals instant result with default answers', same === total, `${same}/${total}`);
}

{
  // m1 / pack purchase safety
  const { world, st, rng } = fresh();
  st.coins = 100000;
  for (const bad of ['constructor', '__proto__', 'toString', 'starter', 'nope', 5, null]) {
    const before = st.coins;
    const r = buyPack(st, world, rng, bad);
    check(`buyPack rejects ${String(bad)}`, !r.ok && st.coins === before && Number.isFinite(st.coins));
  }
  const before = st.coins;
  const ok = buyPack(st, world, rng, 'gold');
  check('gold pack buys and charges exactly the price', ok.ok && st.coins === before - 5000);
  st.coins = 100;
  const poor = buyPack(st, world, rng, 'bronze');
  check('not enough coins: no pack, no charge', !poor.ok && st.coins === 100);
  const noPlayerFromPlayableLeagues = st.cards.filter((c) => c.kind === 'player' && !c.isIcon).every((c) => c.signedFromClubId < 0 || !world.getClub(c.signedFromClubId) || world.getClub(c.signedFromClubId).isBackground);
  check('packs never sign from the 500 pyramid clubs', noPlayerFromPlayableLeagues);
  check('no coin bundle cards (phase 1)', !st.cards.some((c) => c.kind === 'coins'));
}

{
  // m2: season/next guard; fitness recovery; season completes
  const { world, st } = fresh(9);
  const early = newSeason(st, world);
  check('next season refused while the season is running', early.ok === false && myLeague(st).matchday === 0);
  let guard = 0;
  while (nextMatchInfo(st, world) && guard++ < 5) { const r = playInstant(st, world); if (r.error) break; }
  const avgFit = st.cards.filter((c) => c.kind === 'player').reduce((a, c) => a + c.fitness, 0) / st.cards.filter((c) => c.kind === 'player').length;
  check('fitness does not collapse over 5 matches without rotation (recovery works)', avgFit > 40, avgFit.toFixed(1));
  const done = simToSeasonEnd(st, world);
  check('pyramid season completes (my matches instant, 24 other leagues and playoffs simulated)', done.ok && st.season.complete && st.season.phase === 'done' && st.season.summary && st.history.length === 1, `${done.mine} of my matches`);
  const ok = newSeason(st, world);
  check('next season starts after completion', ok.ok && !st.season.complete && st.season.phase === 'league' && myLeague(st).matchday === 0 && st.season.number === 2);
  check('GameState survives JSON round trip', JSON.stringify(JSON.parse(JSON.stringify(st))) === JSON.stringify(st));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
