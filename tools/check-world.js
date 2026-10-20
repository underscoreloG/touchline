// World generation check. Usage: node tools/check-world.js [--size N] [--seed N] [--quiet]
// Prints the numbers (timings, distributions, club averages, pack supply, query speed, round trips) and
// exits with code 1 when a hard check fails. This tool may use performance.now; src/logic may not.

import { performance } from 'node:perf_hooks';
import { POSITIONS, WORLD, LEAGUE_SYSTEM, BACKGROUND_CLUB_STRENGTH, PERFORMANCE_BUDGET_MS, RARITY, GEN } from '../src/balance.js';
import { NATIONS, NATION_INDEX } from '../src/logic/nations.js';
import { computeOvr } from '../src/logic/cards.js';
import { rngFrom } from '../src/logic/rng.js';
import { generateWorld } from '../src/logic/generator.js';
import { World, FLAG, NO_CLUB, MY_CLUB } from '../src/logic/world.js';
import { handleMessage } from '../src/logic/worker.js';

const args = process.argv.slice(2);
const argVal = (name, def) => { const i = args.indexOf(name); return i >= 0 ? Number(args[i + 1]) : def; };
const SIZE = argVal('--size', 50000);
const SEED = argVal('--seed', 7);

let failures = 0;
const results = [];
function check(label, ok, detail = '') {
  results.push({ label, ok, detail });
  if (!ok) failures++;
}
const pct = (x, d = 2) => (100 * x).toFixed(d) + '%';
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);
function section(t) { console.log(`\n== ${t} ==`); }
function table(rows, widths) {
  for (const r of rows) console.log('  ' + r.map((c, i) => (i === 0 ? pad(c, widths[i]) : rpad(c, widths[i]))).join(' '));
}
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

// ---------------------------------------------------------------- generation
console.log(`Touchline world check: size ${SIZE}, seed ${SEED}`);
if (global.gc) global.gc();
const memBefore = process.memoryUsage();
let lastLabel = '';
const labels = [];
const t0 = performance.now();
const w = generateWorld(SEED, SIZE, (p, label) => { if (label !== lastLabel) { labels.push([label, performance.now() - t0]); lastLabel = label; } });
const genMs = performance.now() - t0;
const memAfter = process.memoryUsage();

section('Generation');
const bytes = w.byteSize();
console.log(`  time ${genMs.toFixed(0)} ms (budget at 100,000: ${PERFORMANCE_BUDGET_MS.generation100k} ms); phases: ${labels.map(([l, t]) => `${l}@${t.toFixed(0)}`).join(', ')}`);
console.log(`  typed arrays ${(bytes / 1048576).toFixed(2)} MB = ${(bytes / SIZE).toFixed(1)} bytes/player (target <= ${WORLD.bytesPerPlayerTarget}); arrayBuffers delta ${((memAfter.arrayBuffers - memBefore.arrayBuffers) / 1048576).toFixed(1)} MB, heap delta ${((memAfter.heapUsed - memBefore.heapUsed) / 1048576).toFixed(1)} MB (clubs JSON + name tables included)`);
console.log(`  players ${w.liveCount}, clubs ${w.clubCount} (${w.clubs.filter((c) => !c.isBackground).length} playable, ${w.clubs.filter((c) => c.isBackground).length} background), free agents ${w.freeAgentCount}`);
if (SIZE >= 100000) check('generation time at 100,000', genMs < PERFORMANCE_BUDGET_MS.generation100k, `${genMs.toFixed(0)} ms`);
else check('generation time scales (informational budget 6 s at 100k)', genMs < PERFORMANCE_BUDGET_MS.generation100k * (SIZE / 100000) * 1.5 + 200, `${genMs.toFixed(0)} ms`);
check('bytes per player <= 48', bytes / SIZE <= WORLD.bytesPerPlayerTarget, (bytes / SIZE).toFixed(1));
check('player count', w.liveCount === SIZE, String(w.liveCount));

// ---------------------------------------------------------------- nations
section('Nations');
const natCount = new Int32Array(NATIONS.length);
for (let id = 0; id < w.size; id++) natCount[w.nation[id]]++;
const nonEmpty = natCount.filter((c) => c > 0).length;
const tierPlayers = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
const tierNations = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
NATIONS.forEach((n, i) => { tierPlayers[n.tier] += natCount[i]; tierNations[n.tier]++; });
const wSum = NATIONS.reduce((a, n) => a + WORLD.tierWeight[n.tier], 0);
console.log(`  nations with players: ${nonEmpty} of ${NATIONS.length}`);
table([['tier', 'nations', 'players', 'share', 'target', 'avg/nation'],
  ...[1, 2, 3, 4, 5].map((t) => [t, tierNations[t], tierPlayers[t], pct(tierPlayers[t] / SIZE, 1), pct(tierNations[t] * WORLD.tierWeight[t] / wSum, 1), Math.round(tierPlayers[t] / tierNations[t])])], [6, 8, 9, 8, 8, 11]);
check('about 65 nations (>= 60 populated)', nonEmpty >= 60, String(nonEmpty));
const smallest = Math.min(...Array.from(natCount));
console.log(`  smallest nation ${smallest} players, largest ${Math.max(...Array.from(natCount))}`);

// ---------------------------------------------------------------- OVR distribution
section('OVR distribution (target 0.5% at 85+, 6% at 75-84, 24% at 65-74, rest below)');
let n85 = 0, n75 = 0, n65 = 0, nLow = 0, ovrMax = 0, ovrMin = 255;
const histOvr = new Int32Array(100);
for (let id = 0; id < w.size; id++) {
  const o = w.ovr[id]; histOvr[o]++;
  if (o > ovrMax) ovrMax = o;
  if (o < ovrMin) ovrMin = o;
  if (o >= 85) n85++; else if (o >= 75) n75++; else if (o >= 65) n65++; else nLow++;
}
table([['band', 'count', 'share', 'target'],
  ['85+', n85, pct(n85 / SIZE), pct(WORLD.ovrShare.elite85)],
  ['75-84', n75, pct(n75 / SIZE), pct(WORLD.ovrShare.high75to84)],
  ['65-74', n65, pct(n65 / SIZE), pct(WORLD.ovrShare.mid65to74)],
  ['below 65', nLow, pct(nLow / SIZE), pct(1 - WORLD.ovrShare.elite85 - WORLD.ovrShare.high75to84 - WORLD.ovrShare.mid65to74)]], [10, 8, 9, 9]);
console.log(`  min ${ovrMin}, max ${ovrMax}; top rows: ${[94, 92, 90, 88, 86, 85].map((o) => `${o}:${histOvr[o]}`).join(' ')}`);
check('85+ share within +/-0.1 pt of 0.5%', Math.abs(n85 / SIZE - WORLD.ovrShare.elite85) <= 0.001, pct(n85 / SIZE));
check('75-84 share within +/-0.5 pt of 6%', Math.abs(n75 / SIZE - WORLD.ovrShare.high75to84) <= 0.005, pct(n75 / SIZE));
check('65-74 share within +/-1 pt of 24%', Math.abs(n65 / SIZE - WORLD.ovrShare.mid65to74) <= 0.01, pct(n65 / SIZE));
// where the top sits
let top85T1 = 0, top85D1 = 0, top85Play = 0, top75T1 = 0, top75D1 = 0, top75Play = 0, top85Free = 0;
for (let id = 0; id < w.size; id++) {
  const o = w.ovr[id];
  if (o < 75) continue;
  const tier1 = NATIONS[w.nation[id]].tier === 1;
  const c = w.club[id];
  const playable = c !== NO_CLUB && c < w.clubCount && !w.clubs[c].isBackground;
  const d1 = playable && w.clubs[c].division === 1;
  if (o >= 85) { if (tier1) top85T1++; if (d1) top85D1++; if (playable) top85Play++; if (c === NO_CLUB) top85Free++; }
  else { if (tier1) top75T1++; if (d1) top75D1++; if (playable) top75Play++; }
}
console.log(`  85+: ${pct(top85T1 / n85, 0)} from tier-1 nations, ${pct(top85D1 / n85, 0)} in level 1 clubs, ${pct(top85Play / n85, 0)} in the 25 pyramid leagues, ${top85Free} free agents`);
console.log(`  75-84: ${pct(top75T1 / n75, 0)} from tier-1 nations, ${pct(top75D1 / n75, 0)} in level 1 clubs, ${pct(top75Play / n75, 0)} in the 25 pyramid leagues`);
check('tier-1 nations hold most of the 85+ (>50%)', top85T1 / n85 > 0.5, pct(top85T1 / n85, 0));
check('level 1 clubs hold most of the 85+ among pyramid clubs (>50% of those)', top85D1 / Math.max(1, top85Play) > 0.5, pct(top85D1 / Math.max(1, top85Play), 0));

// ---------------------------------------------------------------- positions
section('Position mix (world)');
const posCount = new Int32Array(8);
for (let id = 0; id < w.size; id++) posCount[w.pos[id]]++;
table([['pos', 'count', 'share', 'target'], ...POSITIONS.map((p, i) => [p, posCount[i], pct(posCount[i] / SIZE, 1), pct(WORLD.positionMix[p], 1)])], [6, 8, 8, 8]);
for (let i = 0; i < 8; i++) check(`position ${POSITIONS[i]} within +/-1.5 pt`, Math.abs(posCount[i] / SIZE - WORLD.positionMix[POSITIONS[i]]) <= 0.015, pct(posCount[i] / SIZE, 1));

// ---------------------------------------------------------------- free agents
section('Free agents');
const fa = w.freeAgents();
let faYouth = 0, faAge = 0, faOvr = 0;
for (const id of fa) { if (w.flags[id] & FLAG.YOUTH) faYouth++; faAge += w.age[id]; faOvr += w.ovr[id]; }
console.log(`  ${fa.length} = ${pct(fa.length / SIZE)} (target about 4%); youth-flagged ${faYouth} (${pct(faYouth / Math.max(1, fa.length), 0)}); mean age ${f1(faAge / fa.length)}, mean OVR ${f1(faOvr / fa.length)}`);
check('free agents 3.5-4.5%', fa.length / SIZE >= 0.035 && fa.length / SIZE <= 0.045, pct(fa.length / SIZE));
check('some free agents are young and flagged', faYouth > 0);

// ---------------------------------------------------------------- playable clubs
const LS = LEAGUE_SYSTEM;
const LEVELS = [1, 2, 3, 4, 5].slice(0, LS.levels);
section('Average XI by level and country (best XI, 4-3-3 shape); cells: clubs mean (min-max)');
const rows = [['country', ...LEVELS.map((l) => `L${l} (target ${LS.strengthByLevel[l]})`)]];
const divMeans = Object.fromEntries(LEVELS.map((l) => [l, []]));
let hardOk = true;
let pyramidClubs = 0;
for (const country of WORLD.countries) {
  const r = [country];
  for (const d of LEVELS) {
    const clubs = w.clubsOf(country, d);
    pyramidClubs += clubs.length;
    const vals = clubs.map((c) => w.clubRating(c.id));
    const m = mean(vals);
    divMeans[d].push(m);
    r.push(`${clubs.length} ${f1(m)} (${f1(Math.min(...vals))}-${f1(Math.max(...vals))})`);
    const target = LS.strengthByLevel[d];
    if (Math.abs(m - target) > LS.countryJitter + 0.6) hardOk = false;
    if (Math.min(...vals) < target - LS.spread - LS.countryJitter - 0.8 || Math.max(...vals) > target + LS.spread + LS.countryJitter + 0.8) hardOk = false;
    const want = LS.countries[country][d - 1].clubs;
    check(`${country} level ${d} has ${want} clubs`, clubs.length === want, String(clubs.length));
  }
  rows.push(r);
}
table(rows, [8, ...LEVELS.map(() => 22)]);
console.log(`  grand mean: ${LEVELS.map((l) => `L${l} ${f1(mean(divMeans[l]))} (${LS.strengthByLevel[l]})`).join(', ')}; allowed: +/-${LS.countryJitter} per country, +/-${LS.spread} inside a level; ${pyramidClubs} pyramid clubs`);
check('club XI averages inside targets (country +/-1, spread +/-4)', hardOk);
check('500 pyramid clubs', pyramidClubs === 500, String(pyramidClubs));
check('club ids 0..499 ordered by country, level, index', (() => {
  let i = 0;
  for (const country of WORLD.countries) for (const d of LEVELS) for (let k = 0; k < LS.countries[country][d - 1].clubs; k++, i++) {
    const c = w.clubs[i];
    if (!c || c.id !== i || c.country !== country || c.division !== d || c.isBackground) return false;
  }
  return w.clubs[i] && w.clubs[i].isBackground;
})());

// home nation share + foreign mix
section('Home-nation share in the 5 countries');
const hrows = [['country', 'home', 'foreign', 'players']];
let allHome = 0, allPl = 0;
for (const country of WORLD.countries) {
  let home = 0, tot = 0;
  for (const c of w.clubsOf(country)) for (const id of w.clubSquad(c.id)) { tot++; if (w.nationCode(id) === country) home++; }
  allHome += home; allPl += tot;
  hrows.push([country, pct(home / tot, 1), pct(1 - home / tot, 1), tot]);
  check(`${country} home-nation share 61-69%`, home / tot > 0.61 && home / tot < 0.69, pct(home / tot, 1));
}
table(hrows, [8, 8, 9, 8]);
console.log(`  overall ${pct(allHome / allPl, 1)} (target about 65%)`);

// ---------------------------------------------------------------- background clubs
section('Background clubs (average XI by nation tier; spec range 45-76)');
const tierVals = { 1: [], 2: [], 3: [], 4: [], 5: [] };
const playableBg = [];
let bgCount = 0, bgPlayers = 0, bgForeign = 0;
for (const c of w.clubs) {
  if (!c.isBackground) continue;
  bgCount++;
  const nat = NATIONS[NATION_INDEX[c.country]];
  (nat.playable ? playableBg : tierVals[nat.tier]).push(w.clubRating(c.id));
  for (const id of w.clubSquad(c.id)) { bgPlayers++; if (w.nationCode(id) !== c.country) bgForeign++; }
}
const bgRow = (label, v, target) => [label, v.length, f1(mean(v)), f1(Math.min(...v)), f1(Math.max(...v)), f1(median(v)), target];
table([['nations', 'clubs', 'mean', 'min', 'max', 'median', 'spec'],
  ...[1, 2, 3, 4, 5].map((t) => bgRow(`tier ${t} (not playable)`, tierVals[t], BACKGROUND_CLUB_STRENGTH[t])),
  bgRow('ENG/ESP/ITA/GER/FRA lower leagues', playableBg, 'below L5')], [34, 7, 7, 7, 7, 8, 9]);
console.log(`  ${bgCount} background clubs, ${bgPlayers} players, ${bgForeign} foreign players inside them`);
{
  const all = [...Object.values(tierVals).flat(), ...playableBg];
  const ts = [1, 2, 3, 4, 5].filter((t) => tierVals[t].length);
  check('background averages ordered by nation tier (not playable nations)', ts.every((t, i) => i === 0 || mean(tierVals[ts[i - 1]]) > mean(tierVals[t])));
  check('background tier means within 7 of the spec value (small worlds drift down: playable clubs absorb more of the histogram)', ts.every((t) => Math.abs(mean(tierVals[t]) - BACKGROUND_CLUB_STRENGTH[t]) <= 7), ts.map((t) => f1(mean(tierVals[t]))).join('/'));
  const d1Max = Math.max(...WORLD.countries.flatMap((cc) => w.clubsOf(cc, 1).map((c) => w.clubRating(c.id))));
  console.log(`  strongest background club ${f1(Math.max(...all))} vs strongest level 1 club ${f1(d1Max)}; weakest background club ${f1(Math.min(...all))}`);
  check('strongest background club is not above the strongest level 1 club + 4', Math.max(...all) <= d1Max + 4, `${f1(Math.max(...all))} vs ${f1(d1Max)}`);
  check('weakest background club at least 38', Math.min(...all) >= 38, f1(Math.min(...all)));
  check('background club players are of the club nation', bgForeign === 0, String(bgForeign));
  const pool = WORLD.countries.map((cc) => w.backgroundClubsOf(cc).length);
  const l5 = WORLD.countries.flatMap((cc) => w.clubsOf(cc, LS.levels).map((c) => w.clubRating(c.id)));
  const topBg = WORLD.countries.map((cc) => Math.max(...w.backgroundClubsOf(cc).map((c) => w.clubRating(c.id))));
  console.log(`  non-league pool per pyramid country (level-5 exchange): ${WORLD.countries.map((cc, i) => `${cc} ${pool[i]} (best ${f1(topBg[i])})`).join(', ')}; level 5 range ${f1(Math.min(...l5))}-${f1(Math.max(...l5))}`);
  check(`every pyramid country keeps >= ${GEN.minBackgroundClubsPlayable} background clubs for the exchange`, pool.every((n) => n >= GEN.minBackgroundClubsPlayable), pool.join('/'));
}

// ---------------------------------------------------------------- ages and potential
section('Ages');
const ageHist = new Int32Array(60);
let ageSum = 0, ageMin = 99, ageMax = 0;
for (let id = 0; id < w.size; id++) { const a = w.age[id]; ageHist[a]++; ageSum += a; if (a < ageMin) ageMin = a; if (a > ageMax) ageMax = a; }
console.log(`  mean ${f1(ageSum / SIZE)}, min ${ageMin}, max ${ageMax}`);
{
  const lines = [];
  let line = '';
  for (let a = ageMin; a <= ageMax; a++) {
    const bar = '#'.repeat(Math.round(ageHist[a] / SIZE * 400));
    lines.push(`  ${rpad(a, 3)} ${rpad(ageHist[a], 6)} ${pct(ageHist[a] / SIZE, 1).padStart(6)} ${bar}`);
  }
  console.log(lines.join('\n'));
}
check('ages 16-38', ageMin >= 16 && ageMax <= 38, `${ageMin}-${ageMax}`);
check('mean age 25-27', ageSum / SIZE >= 25 && ageSum / SIZE <= 27, f1(ageSum / SIZE));
{
  // potential / peak window consistency
  let badWindow = 0, youngNoGrowth = 0, youngCount = 0, oldGrowth = 0, potBelow = 0, statOver = 0, ovrMismatch = 0;
  const gapByAge = {};
  const pe = [], ps = [];
  for (let id = 0; id < w.size; id++) {
    if (w.peakEnd[id] < w.peakStart[id] + 2) badWindow++;
    ps.push(w.peakStart[id]); pe.push(w.peakEnd[id]);
    const pOvr = w.potentialOvr(id);
    if (pOvr < w.ovr[id]) potBelow++;
    for (let k = 0; k < 7; k++) { if (w.pot[k][id] < w.stat[k][id]) potBelow++; if (w.stat[k][id] > 99) statOver++; }
    const gap = pOvr - w.ovr[id];
    const b = Math.min(38, w.age[id]);
    (gapByAge[b] ||= []).push(gap);
    if (w.age[id] < w.peakStart[id] - 1) { youngCount++; if (gap <= 0) youngNoGrowth++; }
    if (w.age[id] > w.peakEnd[id] + 1 && gap > 2) oldGrowth++;
    if (w.ovr[id] !== w.computeOvr(id)) ovrMismatch++;
  }
  console.log(`  mean potential gap (potential OVR - OVR) by age: ${Object.keys(gapByAge).sort((a, b) => a - b).filter((a) => a % 2 === 0 || a < 24).map((a) => `${a}:${f1(mean(gapByAge[a]))}`).join(' ')}`);
  console.log(`  peak windows: mean start ${f1(mean(ps))}, mean end ${f1(mean(pe))}; players before their window with no headroom ${youngNoGrowth}/${youngCount}; past window with headroom>2 ${oldGrowth}`);
  check('peak windows valid (end >= start + 2)', badWindow === 0, String(badWindow));
  check('potential never below current', potBelow === 0, String(potBelow));
  check('players well before their window have headroom', youngNoGrowth / Math.max(1, youngCount) < 0.02, `${youngNoGrowth}/${youngCount}`);
  check('players past their window have little headroom', oldGrowth / SIZE < 0.01, String(oldGrowth));
  check('stored OVR equals computeOvr of stored stats', ovrMismatch === 0, String(ovrMismatch));
}
{
  // full cross-check against cards.js computeOvr through getPlayer (the object view)
  let bad = 0, badStat = 0;
  for (let id = 0; id < w.size; id += 7) {
    const p = w.getPlayer(id);
    if (computeOvr(p.stats, p.pos) !== p.ovr) bad++;
    for (const v of Object.values(p.stats)) if (v < 0 || v > 99 || !Number.isInteger(v)) badStat++;
  }
  check('getPlayer: ovr equals cards.js computeOvr (1 in 7 sampled)', bad === 0 && badStat === 0, `${bad} + ${badStat} bad`);
}

// ---------------------------------------------------------------- top players
section('Hidden values and age structure of the top');
{
  const dev = new Int32Array(4);
  let prof = 0, inj = 0, cons = 0, capsSum = 0, capped = 0, intlG = 0;
  for (let id = 0; id < w.size; id++) { dev[w.devType[id]]++; prof += w.professionalism[id]; inj += w.injuryProne[id]; cons += w.consistency[id]; if (w.caps[id] > 0) { capped++; capsSum += w.caps[id]; } intlG += w.intlGoals[id]; }
  console.log(`  dev types early/standard/late/evergreen: ${Array.from(dev).map((d) => pct(d / SIZE, 1)).join(' / ')} (target 20/55/20/5)`);
  console.log(`  mean professionalism ${f1(prof / SIZE)}, injuryProne ${f1(inj / SIZE)}, consistency ${f1(cons / SIZE)}; players with caps ${capped}, mean caps of those ${f1(capsSum / Math.max(1, capped))}, intl goals total ${intlG}`);
  const ageOf = (ids) => mean(ids.map((id) => w.age[id]));
  const top100 = w.topN(null, null, 100);
  const byPos = Object.fromEntries(POSITIONS.map((p) => [p, ageOf(w.topN(null, p, 100))]));
  console.log(`  mean age of the top 100: ${f1(ageOf(top100))} (phase 2 target 26-29); top-100 by position: ${POSITIONS.map((p) => `${p} ${f1(byPos[p])}`).join(', ')}`);
  check('top 100 mean age 25-30 at generation', ageOf(top100) >= 25 && ageOf(top100) <= 30, f1(ageOf(top100)));
  const buckets = [[16, 18], [19, 21], [22, 24], [25, 28], [29, 31], [32, 34], [35, 38]];
  console.log(`  mean OVR by age: ${buckets.map(([a, b]) => { const v = []; for (let id = 0; id < w.size; id++) if (w.age[id] >= a && w.age[id] <= b) v.push(w.ovr[id]); return `${a}-${b}: ${f1(mean(v))}`; }).join(', ')}`);
}

section('Top 20 players');
{
  const top = w.topN(null, null, 20);
  table([['#', 'name', 'nation', 'age', 'pos', 'ovr', 'pot', 'dev', 'club'],
    ...top.map((id, i) => {
      const c = w.getClub(w.clubIdOf(id));
      return [i + 1, w.name(id), w.nationCode(id), w.age[id], w.posName(id), w.ovr[id], w.potentialOvr(id), w.getPlayer(id).devType, c ? `${c.name} (${c.country}${c.isBackground ? ' bg' : ' L' + c.division})` : 'free agent'];
    })], [3, 24, 7, 4, 4, 4, 4, 10, 38]);
  const best = {};
  for (const p of POSITIONS) best[p] = w.ovr[w.topN(null, p, 1)[0]];
  console.log(`  best per position: ${POSITIONS.map((p) => `${p} ${best[p]}`).join(', ')}`);
}

// ---------------------------------------------------------------- pack supply
section('Pack-source supply (free agents + youth + background clubs; never the 5 playable countries)');
{
  const bands = [['bronze 45-64', 45, 64], ['silver 65-74', 65, 74], ['gold 75-84', 75, 84], ['elite 85-91', 85, 91], ['85+', 85, 99]];
  const rowsP = [['band', 'in world', 'pack source', 'free agents', 'bg clubs']];
  const counts = {};
  for (const [name, lo, hi] of bands) {
    let all = 0, pk = 0, faC = 0, bg = 0;
    for (let id = 0; id < w.size; id++) {
      const o = w.ovr[id];
      if (o < lo || o > hi) continue;
      all++;
      if (w.isPackEligible(id)) { pk++; if (w.club[id] === NO_CLUB) faC++; else bg++; }
    }
    counts[name] = pk;
    rowsP.push([name, all, pk, faC, bg]);
  }
  table(rowsP, [14, 10, 12, 12, 10]);
  // by position in the gold band, and elite by nation tier
  const goldPos = new Int32Array(8), eliteHi = new Int32Array(8);
  for (let id = 0; id < w.size; id++) { if (!w.isPackEligible(id)) continue; if (w.ovr[id] >= 75 && w.ovr[id] <= 84) goldPos[w.pos[id]]++; if (w.ovr[id] >= 85) eliteHi[w.pos[id]]++; }
  console.log(`  75-84 in pack source by position: ${POSITIONS.map((p, i) => `${p} ${goldPos[i]}`).join(', ')}`);
  console.log(`  85+ in pack source by position:   ${POSITIONS.map((p, i) => `${p} ${eliteHi[i]}`).join(', ')}`);
  const need85 = SIZE >= 50000 ? 25 : Math.round(25 * SIZE / 50000);
  check(`pack source holds >= ${need85} players at 85+ (25 at 50,000)`, counts['85+'] >= need85, String(counts['85+']));
  check('pack source holds a good number at 75-84 (>= 1.5% of world)', counts['gold 75-84'] >= 0.015 * SIZE, String(counts['gold 75-84']));
  check('pack source has every position at 75-84', Array.from(goldPos).every((c) => c >= 20 * SIZE / 50000), Array.from(goldPos).join(','));
}

// ---------------------------------------------------------------- query speed
section('Query and topN timings (ms, median of 7 runs / worst)');
{
  const cases = [
    ['all, sort ovr desc', {}],
    ['all, sort name', { sortBy: 'name' }],
    ['all, sort age', { sortBy: 'age' }],
    ['all, sort potential desc', { sortBy: 'potential' }],
    ['nations [BRA,ARG] + pos ST + ovr 70+', { nations: ['BRA', 'ARG'], pos: 'ST', ovrMin: 70 }],
    ['age 16-21 + ovr 60+, sort potential', { ageMin: 16, ageMax: 21, ovrMin: 60, sortBy: 'potential' }],
    ['free agents only', { freeAgent: true }],
    ['club country ENG, sort club', { clubCountry: 'ENG', sortBy: 'club' }],
    ['text "mar"', { text: 'mar' }],
    ['text "jose silva" (full name)', { text: 'jose silva' }],
    ['clubId 5', { clubId: 5 }],
    ['page: ovr desc limit 50 offset 1000', { limit: 50, offset: 1000 }],
  ];
  let worst = 0;
  const trows = [['filter', 'results', 'median', 'worst']];
  for (const [label, f] of cases) {
    const times = [];
    let res = 0;
    for (let i = 0; i < 7; i++) { const t = performance.now(); const r = w.query(f); times.push(performance.now() - t); res = r.length; }
    trows.push([label, res, median(times).toFixed(1), Math.max(...times).toFixed(1)]);
    worst = Math.max(worst, Math.max(...times));
  }
  const tn = [];
  for (let i = 0; i < 7; i++) { const t = performance.now(); w.topN('FRA', 'ST', 20); w.topN(null, null, 100); tn.push(performance.now() - t); }
  trows.push(['topN(FRA,ST,20) + topN(all,100)', 120, median(tn).toFixed(1), Math.max(...tn).toFixed(1)]);
  table(trows, [40, 9, 8, 8]);
  check(`every query under ${PERFORMANCE_BUDGET_MS.databaseFilter} ms`, worst < PERFORMANCE_BUDGET_MS.databaseFilter, `worst ${worst.toFixed(1)} ms`);
  {
    const probe = Math.floor(SIZE / 3);
    const full = w.name(probe);
    const found = w.query({ text: full });
    const accentless = w.query({ text: full.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase() });
    check('text search finds a player by full name, accents and case ignored', Array.from(found).includes(probe) && Array.from(accentless).includes(probe), `"${full}" -> ${found.length} / ${accentless.length} hits`);
  }
  const rr = rngFrom(99);
  const tr = performance.now();
  let got = 0;
  for (let i = 0; i < 200; i++) if (w.randomPlayer(rr, { ovrMin: 85, ovrMax: 91, source: 'pack' }) >= 0) got++;
  console.log(`  randomPlayer(85-91, pack) x200: ${((performance.now() - tr)).toFixed(1)} ms total, ${got} hits`);
}

// ---------------------------------------------------------------- club integrity
section('Club integrity');
{
  let badSize = 0, dupNames = 0, rosterMismatch = 0, wrongClub = 0, vacant = 0;
  let seen = 0;
  for (const c of w.clubs) {
    const sq = w.clubSquad(c.id);
    seen += sq.length;
    if (sq.length !== WORLD.squadSize) badSize++;
    const names = new Set();
    for (const id of sq) {
      if (w.club[id] !== c.id) wrongClub++;
      const nm = w.name(id);
      if (names.has(nm)) dupNames++;
      names.add(nm);
    }
    if (w.clubSize(c.id) !== sq.length) rosterMismatch++;
  }
  seen += w.freeAgentCount;
  for (let id = 0; id < w.size; id++) if (w.flags[id] & FLAG.VACANT) vacant++;
  console.log(`  clubs with a size other than 26: ${badSize}; duplicate full names inside a club: ${dupNames}; roster/count mismatches: ${rosterMismatch}; players in a list but not that club: ${wrongClub}; players covered by lists ${seen}/${SIZE}; vacant slots ${vacant}`);
  check('every club has exactly 26 players', badSize === 0, String(badSize));
  check('no duplicate full name inside a club', dupNames === 0, String(dupNames));
  check('rosters consistent', rosterMismatch === 0 && wrongClub === 0 && seen === SIZE, `${rosterMismatch}/${wrongClub}/${seen}`);
  let fewGK = 0, shortXI = 0, minGK = 99, maxGK = 0;
  for (const c of w.clubs) {
    const sq = w.clubSquad(c.id);
    let gk = 0;
    for (const id of sq) if (w.pos[id] === 0) gk++;
    minGK = Math.min(minGK, gk); maxGK = Math.max(maxGK, gk);
    if (gk < 2) fewGK++;
    if (w.bestXI(c.id).length !== 11) shortXI++;
  }
  let wonder = 0;
  for (let id = 0; id < w.size; id++) if (w.flags[id] & FLAG.WONDERKID) wonder++;
  console.log(`  goalkeepers per club ${minGK}-${maxGK}; wonderkid-flagged players ${wonder}`);
  check('every club has at least 2 goalkeepers and a full best XI', fewGK === 0 && shortXI === 0, `${fewGK}/${shortXI}`);
  const crestOk = w.clubs.every((c) => c.crest && c.crest.shape && c.crest.colours.length === 2 && c.colours.length === 2 && c.name && c.stadium);
  check('club records complete (name, crest, colours, stadium)', crestOk);
  const nameSet = new Map();
  let dupClubNames = 0;
  for (const c of w.clubs) { const k = c.country + '|' + c.name; if (nameSet.has(k)) dupClubNames++; nameSet.set(k, 1); }
  check('club names unique inside a country', dupClubNames === 0, String(dupClubNames));
}

// ---------------------------------------------------------------- economy API (main session contract)
section('API contract used by economy.js');
{
  const rng = rngFrom(5);
  const id = w.randomPlayer(rng, { ovrMin: 70, ovrMax: 74, pos: 'CM', nations: undefined, source: 'pack' });
  check('randomPlayer(pack) returns a pack-eligible id', id >= 0 && w.isPackEligible(id), String(id));
  const before = w.getPlayer(id);
  const fromClub = before.clubId;
  const donor = fromClub >= 0 ? w.getClub(fromClub) : null;
  const sizeBefore = donor ? w.clubSize(donor.id) : -1;
  w.moveToClub(id, MY_CLUB);
  check('moveToClub(0xfffe) accepted and reported by getPlayer', w.getPlayer(id).clubId === MY_CLUB && w.isMine(id));
  check('my players are excluded from squads and pack sources', !w.isPackEligible(id) && w.myPlayers().includes(id) && !(donor && w.clubSquad(donor.id).includes(id)) && !w.query({ packEligible: true, ovrMin: before.ovr, ovrMax: before.ovr }).includes(id));
  if (donor) {
    check('donor club is one short', w.clubSize(donor.id) === sizeBefore - 1);
    const added = w.refillClub(rng, donor.id);
    const pl = added.map((a) => w.getPlayer(a));
    check('refillClub tops the donor back up to 26', w.clubSize(donor.id) === 26 && added.length === 1, `added ${pl.map((p) => `${p.pos} ${p.ovr}`).join(',')} (replaced ${before.pos} ${before.ovr})`);
    const names = new Set(Array.from(w.clubSquad(donor.id)).map((x) => w.name(x)));
    check('refill keeps names unique', names.size === 26);
  }
  // refill with a forced regen path: empty a background club to 20 and refill many times
  const bg = w.clubs.find((c) => c.isBackground && c.country === 'BRA');
  for (const pid of Array.from(w.clubSquad(bg.id)).slice(0, 6)) w.releaseToFreeAgents(pid);
  const faBefore = w.freeAgentCount;
  const added = w.refillClub(rng, bg.id);
  check('refillClub of a background club works for 6 vacancies', w.clubSize(bg.id) === 26 && added.length === 6, `FA ${faBefore} -> ${w.freeAgentCount}, regens ${added.filter((a) => w.isRegen(a)).length}`);
  check('background refill keeps the club nation', w.clubSquad(bg.id).every((x) => w.nationCode(x) === 'BRA' || !added.includes(x)));
  w.releaseToFreeAgents(id);
  check('releaseToFreeAgents works for my player', w.getPlayer(id).clubId === -1 && w.freeAgents().includes(id));
  const mk = (rr) => {};
  // retire + regen path (phase 2)
  const live0 = w.liveCount;
  const victim = w.clubSquad(bg.id)[0];
  w.retire(victim);
  const regenId = World.regenFactory(w, rng, 'BRA', bg.id, {});
  check('retire + regen keeps the population constant and recycles the slot', w.liveCount === live0 && regenId === victim && w.clubSize(bg.id) === 26 && w.getPlayer(regenId).age >= 15 && w.getPlayer(regenId).age <= 17);
  check('regen OVR 40-58, potential above OVR', w.ovr[regenId] >= 40 && w.ovr[regenId] <= 58 && w.potentialOvr(regenId) > w.ovr[regenId], `ovr ${w.ovr[regenId]} pot ${w.potentialOvr(regenId)}`);
  check('getClub returns {id,country,...}', (() => { const c = w.getClub(3); return c && c.id === 3 && c.country === 'ENG'; })());
}

// ---------------------------------------------------------------- economy smoke test on a copy of the world
section('economy.js smoke test (starter pack + 30 gold + 30 silver packs on a copy)');
{
  const { openStarter, openPack } = await import('../src/logic/economy.js');
  const w2 = World.fromSnapshot(w.snapshot());
  const rng = rngFrom(11);
  const state = { country: 'ENG', cards: [], coins: 0, pity: { gold: 0 } };
  const size0 = w2.size;
  let t = performance.now();
  openStarter(state, w2, rng);
  const starterMs = performance.now() - t;
  const rar = { bronze: 0, silver: 0, gold: 0, elite: 0, icon: 0 };
  t = performance.now();
  let packs = 0;
  for (let i = 0; i < 30; i++) { for (const type of ['gold', 'silver']) { const res = openPack(type, state, w2, rng); packs++; for (const c of res.cards) if (c.kind === 'player') { const o = w2.getPlayer(c.playerId).ovr; rar[o >= 85 ? 'elite' : o >= 75 ? 'gold' : o >= 65 ? 'silver' : 'bronze']++; } } }
  const packMs = (performance.now() - t) / packs;
  const mine = w2.myPlayers();
  const playerCards = state.cards.filter((c) => c.kind === 'player');
  let bad = 0;
  for (const c of w2.clubs) if (w2.clubSize(c.id) !== 26) bad++;
  const sources = new Set(playerCards.map((c) => c.signedFromClubId >= 0 ? (w2.getClub(c.signedFromClubId).isBackground ? 'bg' : 'PLAYABLE') : 'fa'));
  console.log(`  starter ${starterMs.toFixed(1)} ms, ${packs} packs at ${packMs.toFixed(2)} ms each; my players ${mine.length}, player cards ${playerCards.length}; world grew by ${w2.size - size0} slots (academy regens replacing signed players); pulled ${JSON.stringify(rar)}; signed from: ${Array.from(sources).join(',')}`);
  check('economy: all my cards are registered in the world exactly once', mine.length === playerCards.length && new Set(playerCards.map((c) => c.playerId)).size === playerCards.length);
  check('economy: every club still has 26 players after signings', bad === 0, String(bad));
  check('economy: nobody was signed from the 5 playable countries', !sources.has('PLAYABLE'));
  check('economy: pack opening is fast (< 5 ms per pack)', packMs < 5, packMs.toFixed(2) + ' ms');
}

// ---------------------------------------------------------------- snapshot, determinism, worker
section('Persistence and determinism');
{
  const cs = w.checksum();
  let t = performance.now();
  const snap = w.snapshot();
  const w2 = World.fromSnapshot(snap);
  const rtMs = performance.now() - t;
  check('snapshot -> fromSnapshot checksum equal', w2.checksum() === cs, `${cs} vs ${w2.checksum()} (${rtMs.toFixed(0)} ms)`);
  const sc = structuredClone(snap);
  check('structuredClone of snapshot -> same checksum', World.fromSnapshot(sc).checksum() === cs);
  check('restored world behaves identically (query)', JSON.stringify(Array.from(w2.query({ limit: 30 }))) === JSON.stringify(Array.from(w.query({ limit: 30 }))));
  // promotion / relegation mutates club divisions: they must survive a snapshot round trip
  const up = w.clubsOf('ITA', 5)[0].id, down = w.backgroundClubsOf('ITA')[0].id;
  w.setClubDivision(up, 4); w.setClubDivision(down, 5);
  const w4 = World.fromSnapshot(structuredClone(w.snapshot()));
  check('division changes (setClubDivision) survive a snapshot round trip', w4.checksum() === w.checksum() && w4.getClub(up).division === 4 && w4.getClub(down).division === 5 && !w4.getClub(down).isBackground && w4.clubDivision[down] === 5 && w4.clubIsBackground[down] === 0 && w4.clubsOf('ITA', 5).some((c) => c.id === down), `${w.checksum()} vs ${w4.checksum()}`);
  check('a club promoted out of the background is no longer a pack source', !w4.clubSquad(down).some((pid) => w4.isPackEligible(pid)));
  w.setClubDivision(up, 5); w.setClubDivision(down, 0);
  check('setClubDivision back restores the checksum', w.checksum() === cs);
  const snapMB = Object.values(snap.buffers).reduce((a, b) => a + b.byteLength, 0) / 1048576;
  console.log(`  snapshot buffers ${snapMB.toFixed(2)} MB, clubs JSON ${(JSON.stringify(snap.meta.clubs).length / 1024).toFixed(0)} KB, round trip ${rtMs.toFixed(0)} ms`);

  // determinism (fresh generations; the world above was mutated by the API checks)
  const a = generateWorld(SEED, SIZE).checksum();
  const b = generateWorld(SEED, SIZE).checksum();
  const c = generateWorld(SEED + 1, SIZE).checksum();
  check('same seed + size gives the same checksum', a === b, `${a} ${b}`);
  check('different seed gives a different checksum', a !== c);
  console.log(`  checksum seed ${SEED}: ${a}; seed ${SEED + 1}: ${c}`);

  // worker protocol
  const msgs = [];
  const transferred = [];
  handleMessage({ type: 'generate', seed: SEED, size: SIZE }, (m, tr) => { msgs.push(m); if (tr) transferred.push(...tr); });
  const done = msgs.find((m) => m.type === 'done');
  const progressCount = msgs.filter((m) => m.type === 'progress').length;
  check('worker: progress messages then done with snapshot', !!done && progressCount > 0 && msgs[msgs.length - 1] === done, `${progressCount} progress messages, ${transferred.length} transferables`);
  if (done) {
    const w3 = World.fromSnapshot(done.snapshot);
    check('worker snapshot checksum equals direct generation', w3.checksum() === a);
    check('worker transfers ArrayBuffers', transferred.length >= 20 && transferred.every((x) => x instanceof ArrayBuffer));
  }
  const err = [];
  handleMessage({ type: 'nope' }, (m) => err.push(m));
  check('worker: unknown message type answers with an error message', err.length === 1 && err[0].type === 'error');
}

// ---------------------------------------------------------------- summary
section('Checks');
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.detail ? '  [' + r.detail + ']' : ''}`);
console.log(`\n${results.length - failures} of ${results.length} checks passed, ${failures} failed.`);
process.exit(failures ? 1 : 0);
