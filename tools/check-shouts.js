// Checks for the in-match shouts. node tools/check-shouts.js
import { rngFrom } from '../src/logic/rng.js';
import { generateWorld } from '../src/logic/generator.js';
import { createState, startGame, prepareMatch } from '../src/logic/game.js';
import { createMatch, stepTick, applyDecision, isFinished, summarise, matchState } from '../src/logic/matchEngine.js';
let pass = 0, fail = 0;
const check = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? '  ok  ' : '  FAIL'} ${n} ${x}`); };
const world = generateWorld(7, 30000, () => {});
const st = createState({ seed: 7, worldSize: 30000, country: 'ENG', club: { name: 'T', colours: ['#c8102e', '#fff'], crest: {} } });
startGame(st, world, rngFrom(7));
const prep = prepareMatch(st, world);
const mk = prep.info.homeIsMe ? 'home' : 'away';

const m = createMatch(prep.home, prep.away, prep.seed, { keyMoments: true, autoSubs: true });
stepTick(m);
let r = applyDecision(m, { type: 'shout', team: mk, value: 'shout' });
check('shout accepted', r.ok);
r = applyDecision(m, { type: 'shout', team: mk, value: 'calm' });
check('shared cooldown blocks another shout right away', !r.ok && r.error === 'cooldown' && r.readyIn > 0, JSON.stringify(r));
r = applyDecision(m, { type: 'shout', team: mk, value: 'shout' });
check('same shout is on cooldown', !r.ok && r.error === 'cooldown');
const s1 = matchState(m)[mk];
check('state exposes cooldowns', s1.shouts.shout >= 4 && s1.shoutActive === 'shout', JSON.stringify(s1.shouts));
stepTick(m); stepTick(m);
const s2 = matchState(m)[mk];
check('shared cooldown expires after 2 ticks, shout still cooling', s2.shouts.calm === 0 && s2.shouts.shout > 0, JSON.stringify(s2.shouts));
check('unknown shout rejected', !applyDecision(m, { type: 'shout', team: mk, value: 'bogus' }).ok);

// no shouts = identical to the plain result (determinism and instant == watched)
const a = createMatch(prep.home, prep.away, prep.seed, { keyMoments: true, autoSubs: true });
const b = createMatch(prep.home, prep.away, prep.seed, { keyMoments: false, autoSubs: true });
let g = 0; while (!isFinished(a) && g++ < 200) stepTick(a);
g = 0; while (!isFinished(b) && g++ < 200) stepTick(b);
check('no shouts: unchanged and deterministic', JSON.stringify(summarise(a).score) === JSON.stringify(summarise(b).score));

// effect on the result over many seeds: shouting when behind should help a little, not break anything
let sumPlain = 0, sumShout = 0, n = 0;
for (let seed = 1; seed <= 300; seed++) {
  const p1 = createMatch(prep.home, prep.away, seed, { autoSubs: true });
  const p2 = createMatch(prep.home, prep.away, seed, { autoSubs: true });
  let k = 0;
  while (!isFinished(p1) && k++ < 200) stepTick(p1);
  k = 0;
  while (!isFinished(p2) && k++ < 200) {
    stepTick(p2);
    if (k % 6 === 1) applyDecision(p2, { type: 'shout', team: mk, value: 'encourage' });
  }
  const s1_ = summarise(p1).score, s2_ = summarise(p2).score;
  const opp = mk === 'home' ? 'away' : 'home';
  sumPlain += s1_[mk] - s1_[opp]; sumShout += s2_[mk] - s2_[opp]; n++;
}
console.log(`  avg goal difference over ${n} seeds: plain ${(sumPlain / n).toFixed(3)}  with encourage every 6 ticks ${(sumShout / n).toFixed(3)}`);
check('shouts help a little, nothing wild', sumShout / n - sumPlain / n < 0.35);
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
