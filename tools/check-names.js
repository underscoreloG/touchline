// Throwaway checker for src/logic/nations.js and src/logic/names.js.
//   node tools/check-names.js
// Prints samples and summary counts, exits with code 1 on any failed assertion.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rngFrom } from '../src/logic/rng.js';
import {
  NATIONS, NATION_BY_CODE, PLAYABLE_COUNTRIES, nationByCode, flagOf,
} from '../src/logic/nations.js';
import {
  CULTURES, CULTURE_BY_ID, FIRST_COUNT, LAST_COUNT, cultureOfNation, pickNameIndices, nameFromIndices,
  shortNameFromIndices, makeName, makeManagerName, makeClubName, makeBackgroundClubName, makeStadiumName,
  makeSponsorName, isRealClubName, isRealPlaceName, isGuardedPlayerName, guardedPairCount, REAL_CLUB_BLOCKLIST, normKey, CLUB_PLACES, CLUB_NAME_STYLES, BG_CLUB_STYLES,
} from '../src/logic/names.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const fail = (msg) => { failures++; console.log(`FAIL: ${msg}`); };
const check = (cond, msg) => { if (!cond) fail(msg); };
const section = (t) => console.log(`\n=== ${t}`);

// ---------------------------------------------------------------- nations
section('nations');
check(NATIONS.length >= 55 && NATIONS.length <= 70, `nation count ${NATIONS.length} not about 60`);
const codes = new Set(NATIONS.map((n) => n.code));
check(codes.size === NATIONS.length, 'duplicate nation codes');
for (const n of NATIONS) {
  check(/^[A-Z]{3}$/.test(n.code), `bad code ${n.code}`);
  check(['EU', 'SA', 'NA', 'AF', 'AS', 'OC'].includes(n.continent), `bad continent ${n.code}`);
  check(n.tier >= 1 && n.tier <= 5, `bad tier ${n.code}`);
  check(n.colours.length === 2 && n.colours.every((c) => /^#[0-9a-f]{6}$/i.test(c)), `bad colours ${n.code}`);
  check(typeof n.flag === 'string' && n.flag.length > 0, `no flag ${n.code}`);
  check(!!CULTURE_BY_ID[n.culture], `nation ${n.code} has unknown culture ${n.culture}`);
  check(CLUB_NAME_STYLES.includes(n.clubNameStyle), `nation ${n.code} has unknown clubNameStyle ${n.clubNameStyle}`);
  check(cultureOfNation(n.code) === n.culture, `cultureOfNation mismatch ${n.code}`);
  check(NATION_BY_CODE[n.code] === n && nationByCode(n.code) === n && flagOf(n.code) === n.flag, `lookup mismatch ${n.code}`);
}
check(PLAYABLE_COUNTRIES.join() === 'ENG,ESP,ITA,GER,FRA', 'PLAYABLE_COUNTRIES order');
check(NATIONS.filter((n) => n.playable).map((n) => n.code).sort().join() === [...PLAYABLE_COUNTRIES].sort().join(), 'playable flags');
for (const must of ['ENG', 'ESP', 'ITA', 'GER', 'FRA', 'SCO', 'WAL', 'NIR', 'IRL', 'BRA', 'ARG', 'URU', 'COL', 'CHI', 'ECU', 'PAR', 'PER', 'VEN', 'BOL', 'POR', 'NED', 'BEL', 'CRO', 'SRB', 'DEN', 'SWE', 'NOR', 'SUI', 'AUT', 'POL', 'CZE', 'TUR', 'GRE', 'UKR', 'ROU', 'HUN', 'RUS', 'USA', 'MEX', 'CAN', 'CRC', 'JAM', 'NGA', 'SEN', 'MAR', 'EGY', 'GHA', 'CIV', 'CMR', 'ALG', 'TUN', 'MLI', 'RSA', 'JPN', 'KOR', 'AUS', 'IRN', 'KSA', 'QAT', 'CHN', 'NZL']) {
  check(codes.has(must), `missing nation ${must}`);
}
const byTier = [1, 2, 3, 4, 5].map((t) => NATIONS.filter((n) => n.tier === t).length);
const byCont = {};
for (const n of NATIONS) byCont[n.continent] = (byCont[n.continent] || 0) + 1;
console.log(`nations: ${NATIONS.length}; per tier ${byTier.join('/')}; per continent ${JSON.stringify(byCont)}`);
console.log('flags sample:', NATIONS.slice(0, 12).map((n) => `${n.code}${n.flag}`).join(' '), '| SCO', flagOf('SCO'), 'WAL', flagOf('WAL'), 'NIR', flagOf('NIR'));

// ---------------------------------------------------------------- cultures
section('cultures');
check(CULTURES.length >= 20, `only ${CULTURES.length} cultures`);
let minFirst = Infinity;
let minLast = Infinity;
for (const c of CULTURES) {
  check(c.first.length >= 150, `culture ${c.id}: ${c.first.length} first names (<150)`);
  check(c.last.length >= 300, `culture ${c.id}: ${c.last.length} surnames (<300)`);
  check(c.first.length < 65536 && c.last.length < 65536, `culture ${c.id}: index overflow`);
  check(new Set(c.first).size === c.first.length && new Set(c.last).size === c.last.length, `culture ${c.id}: duplicates`);
  check(FIRST_COUNT[c.id] === c.first.length && LAST_COUNT[c.id] === c.last.length, `culture ${c.id}: count helpers`);
  for (const n of [...c.first, ...c.last]) {
    if (n !== n.trim() || n.length < 1 || /[0-9,;]/.test(n) || n.includes('  ')) fail(`culture ${c.id}: bad entry "${n}"`);
  }
  minFirst = Math.min(minFirst, c.first.length);
  minLast = Math.min(minLast, c.last.length);
}
const usedCultures = new Set(NATIONS.map((n) => n.culture));
for (const c of CULTURES) check(usedCultures.has(c.id), `culture ${c.id} is used by no nation`);
console.log(`${CULTURES.length} cultures; min first ${minFirst}, min last ${minLast}; total first ${CULTURES.reduce((s, c) => s + c.first.length, 0)}, total last ${CULTURES.reduce((s, c) => s + c.last.length, 0)}`);
console.log(CULTURES.map((c) => `${c.id}(${c.first.length}/${c.last.length})`).join('  '));

// ---------------------------------------------------------------- player names
section('player names (5000 across all nations)');
{
  const rng = rngFrom('check-names-players');
  const sample = [];
  const perCulture = new Map();
  for (let i = 0; i < 5000; i++) {
    const nation = NATIONS[rng.int(0, NATIONS.length - 1)];
    const [f, l] = pickNameIndices(rng, nation.culture);
    check(Number.isInteger(f) && Number.isInteger(l) && f >= 0 && l >= 0 && f <= 65535 && l <= 65535, 'index out of Uint16');
    const full = nameFromIndices(nation.culture, f, l);
    sample.push({ nation: nation.code, full, key: `${nation.culture}|${f}|${l}` });
    perCulture.set(nation.culture, (perCulture.get(nation.culture) || 0) + 1);
  }
  const keys = new Map();
  for (const s of sample) keys.set(s.key, (keys.get(s.key) || 0) + 1);
  const dupGroups = [...keys.values()].filter((v) => v > 1).length;
  console.log(`distinct (culture, first, last) combos: ${keys.size}/5000; duplicate groups: ${dupGroups}`);
  check(dupGroups < 25, `too many duplicate groups (${dupGroups})`);
  console.log('40 random names:');
  const show = rngFrom('show').shuffle(sample.slice()).slice(0, 40);
  for (let i = 0; i < show.length; i += 4) {
    console.log('  ' + show.slice(i, i + 4).map((s) => `${s.nation} ${s.full}`.padEnd(34)).join(''));
  }
  const m = makeName(rngFrom(1), 'french');
  check(m.full === nameFromIndices('french', m.firstIdx, m.lastIdx), 'makeName/nameFromIndices mismatch');
  check(shortNameFromIndices('french', m.firstIdx, m.lastIdx).startsWith(`${Array.from(m.first)[0]}. `), 'short name');
  console.log('short form:', shortNameFromIndices('french', m.firstIdx, m.lastIdx), '| manager:', makeManagerName(rngFrom(2), 'JPN'));
  // determinism
  const a = [pickNameIndices(rngFrom(77), 'german'), pickNameIndices(rngFrom(77), 'german')];
  check(a[0].join() === a[1].join(), 'pickNameIndices not deterministic');
  // famous-name guard: force the rng to the blocked pair, the next draw must differ
  let guardedTotal = 0;
  let guardedTested = false;
  for (const c of CULTURES) {
    const n = guardedPairCount(c.id);
    guardedTotal += n;
    if (n > 0 && !guardedTested) {
      // find one guarded pair, force the rng onto it, the pick must move to another pair
      let found = null;
      for (let f = 0; f < c.first.length && !found; f++) {
        for (let l = 0; l < c.last.length; l++) {
          if (isGuardedPlayerName(c.id, f, l)) { found = [f, l]; break; }
        }
      }
      check(!!found, `guard count>0 but no pair found in ${c.id}`);
      const script = [found[0], found[1], 3, 4];
      const picked = pickNameIndices({ int: () => script.shift() }, c.id);
      check(!(picked[0] === found[0] && picked[1] === found[1]), 'guard did not re-roll a guarded real-player name');
      check(!isGuardedPlayerName(c.id, picked[0], picked[1]), 'guard returned a guarded pair');
      guardedTested = true;
      console.log(`guard re-roll test OK on ${c.id}: "${nameFromIndices(c.id, found[0], found[1])}" refused`);
    }
  }
  check(guardedTested, 'no guarded pairs exist at all');
  console.log(`guarded real-player name pairs across all cultures: ${guardedTotal}`);
  // the guard must hold for a large random sample too
  const grng = rngFrom('guard-sample');
  for (const c of CULTURES) {
    for (let i = 0; i < 4000; i++) {
      const [f, l] = pickNameIndices(grng, c.id);
      if (isGuardedPlayerName(c.id, f, l)) { fail(`guarded pair produced in ${c.id}`); break; }
    }
  }
}

// ---------------------------------------------------------------- club names
section('club names: 42 per playable country');
{
  const blocklistKeys = new Set(REAL_CLUB_BLOCKLIST.map(normKey));
  for (const code of PLAYABLE_COUNTRIES) {
    check((CLUB_PLACES[code] || []).length >= 60, `${code}: only ${(CLUB_PLACES[code] || []).length} places`);
    const rng = rngFrom(`check-clubs-${code}`);
    const used = new Set();
    const names = [];
    for (let i = 0; i < 42; i++) names.push(makeClubName(rng, code, used));
    check(new Set(names).size === 42, `${code}: duplicate club names`);
    check(new Set(names.map(normKey)).size === 42, `${code}: duplicate normalised club names`);
    for (const n of names) {
      check(!blocklistKeys.has(normKey(n)) && !isRealClubName(n), `${code}: generated real club name "${n}"`);
    }
    console.log(`${code} (${nationByCode(code).flag}):`);
    for (let i = 0; i < names.length; i += 3) console.log('  ' + names.slice(i, i + 3).map((s) => s.padEnd(34)).join(''));
  }
  // stress: lots of names per country must stay unique and never hit the blocklist
  for (const code of PLAYABLE_COUNTRIES) {
    const rng = rngFrom(`stress-${code}`);
    const used = new Set();
    for (let i = 0; i < 600; i++) {
      const n = makeClubName(rng, code, used);
      if (isRealClubName(n)) fail(`${code}: stress produced real club "${n}"`);
    }
    check(used.size === 600, `${code}: stress uniqueness (${used.size}/600)`);
  }
  console.log('stress: 600 unique names per playable country OK');
}

section('blocklist behaviour');
{
  for (const real of ['Real Madrid', 'FC Barcelona', 'Arsenal', 'Arsenal FC', 'Juventus', 'Inter', 'Napoli', 'AC Milan', 'Bayern Munich', 'Paris Saint-Germain', 'Olympique de Marseille', 'real madrid cf', 'F.C. Barcelona', 'Manchester United', 'Borussia Dortmund', 'Ajax']) {
    check(isRealClubName(real), `blocklist should refuse "${real}"`);
  }
  for (const ok of ['Northgate Rovers', 'Real Costa Dorada', 'Virtus Dolcemare', 'SV Rotenau 1904', 'Olympique de Rochemare']) {
    check(!isRealClubName(ok), `blocklist should accept "${ok}"`);
  }
  console.log(`blocklist entries: ${REAL_CLUB_BLOCKLIST.length}`);
  check(REAL_CLUB_BLOCKLIST.length >= 150, 'blocklist shorter than 150');
}

section('background club names: 30 for 6 nations');
{
  for (const code of ['JPN', 'BRA', 'NGA', 'TUR', 'KSA', 'POL']) {
    const rng = rngFrom(`bg-${code}`);
    const used = new Set();
    const names = [];
    for (let i = 0; i < 5; i++) names.push(makeBackgroundClubName(rng, code, used));
    console.log(`${code} ${flagOf(code)}: ${names.join(' | ')}`);
  }
  // all nations, many names, none real, unique within nation
  let total = 0;
  for (const n of NATIONS) {
    const rng = rngFrom(`bgall-${n.code}`);
    const used = new Set();
    for (let i = 0; i < 400; i++) {
      const name = makeBackgroundClubName(rng, n.code, used);
      total++;
      if (isRealClubName(name)) fail(`${n.code}: background club is a real name "${name}"`);
      if (!name || /undefined|NaN|\{|\}/.test(name)) fail(`${n.code}: malformed club name "${name}"`);
    }
    if (used.size !== 400) fail(`${n.code}: background uniqueness ${used.size}/400`);
  }
  console.log(`${total} background club names over ${NATIONS.length} nations: none real, unique per nation`);
  check(CLUB_NAME_STYLES.length === Object.keys(BG_CLUB_STYLES).length, 'style list');
}

// ---------------------------------------------------------------- independent real-world tests
// Everything below uses its own normaliser and its own data (tools/real-clubs-test.json and the plaintext
// player list in this file). Nothing from the generator's gazetteer or hash list is reused, so the check
// cannot share a blind spot with it.
const t_fold = (s) => s.toLowerCase().replace(/ß/g, 'ss').replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/œ/g, 'oe').replace(/ł/g, 'l')
  .replace(/đ/g, 'd').replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/ı/g, 'i').normalize('NFD').replace(/[̀-ͯ]/g, '');
const T_GENERIC = new Set('fc afc cf ac as sc cd ud sv fk sk ssc us vfl vfb tsv fsv rc ogc cs club the of and de du des la le les di del della da el al sg ad sd rcd city town united athletic athletico atletico rovers wanderers rangers albion county borough real sporting sport sports racing deportivo dynamo dinamo lokomotiv olympique olympic stade union virtus calcio pro eintracht fortuna viktoria concordia germania rot weiss blau schwarz kf nk hnk ks mks lks gks se te vse tj mfk acs csm ik if bk ff ifk boys harriers victoria orient alexandra argyle swifts villa thistle stars chiefs eagles lions warriors storm thunder phoenix dragons rising stella citizen belediye genclik gucu idman yurdu nadi shabab'.split(' '));
const t_core = (name) => t_fold(name).replace(/[^a-z0-9]+/g, ' ').trim().split(' ')
  .map((w) => (w.length > 4 && w.endsWith('spor') ? w.slice(0, -4) : w))
  .filter((w) => w && !T_GENERIC.has(w) && !/^\d+$/.test(w)).join(' ');
const T_PREFIX = new Set(['saint', 'sainte', 'st', 'san', 'santa', 'sao', 'north', 'south', 'east', 'west', 'new', 'old', 'bad', 'neu', 'alt', 'agios', 'agia']);
const t_variants = (name) => {
  const out = new Set();
  let core = t_core(name);
  while (core) {
    out.add(core); out.add(core.replace(/ /g, ''));
    const toks = core.split(' ');
    if (toks.length > 1 && T_PREFIX.has(toks[0])) core = toks.slice(1).join(' '); else break;
  }
  return out;
};
const REAL_TEST = JSON.parse(readFileSync(join(ROOT, 'tools', 'real-clubs-test.json'), 'utf8'));
const TEST_CORES = new Set();
let testEntries = 0;
for (const [k, v] of Object.entries(REAL_TEST)) {
  if (k.startsWith('_')) continue;
  for (const e of v.split(/\s*,\s*/).filter(Boolean)) { testEntries++; const c = t_core(e); if (c) { TEST_CORES.add(c); TEST_CORES.add(c.replace(/ /g, '')); } }
}
const testHit = (name) => [...t_variants(name)].some((v) => TEST_CORES.has(v));

section('independent real-club test (separate list, own normaliser)');
{
  check(testEntries >= 3000, `independent club list too small (${testEntries})`);
  // the producible real names named in the review must now be refused by the generator
  const known = ['Oxford United', 'Oxford City', 'Whitby Town', 'Ashton United', 'Ashford United', 'Fehérvár FC', 'Akhisarspor', 'Karabükspor', 'Hwaseong FC', 'Mokpo City', 'Cheongju FC', 'Nanjing City', 'Ulsan Citizen', 'Lorient'];
  for (const n of known) { check(testHit(n), `test list should contain "${n}"`); check(isRealClubName(n), `generator should refuse "${n}"`); }
  // exhaustive enumeration of every background place (a x b, optional prefix word): any place that the independent list knows
  // must be rejected by the generator (so it can never reach a club name), and a quick rate check keeps the supply healthy
  let places = 0; let rejected = 0; let missed = 0;
  for (const id of CLUB_NAME_STYLES) {
    const st = BG_CLUB_STYLES[id];
    const base = [];
    for (const a of st.a) for (const b of st.b) base.push(a + (st.join || '') + b);
    const all = [...base];
    if (st.pre) for (const w of st.pre.words) for (const p of base) all.push(w + st.pre.sep + p);
    let styleRej = 0;
    for (const p of all) {
      places++;
      const gen = isRealPlaceName(p);
      if (gen) { rejected++; styleRej++; }
      if (testHit(p) && !gen) { missed++; if (missed <= 40) fail(`style ${id}: place "${p}" is a real town/club per the independent list but is not rejected`); }
    }
    check(styleRej / all.length < 0.5, `style ${id}: ${(100 * styleRej / all.length).toFixed(0)}% of places rejected, supply too thin`);
  }
  console.log(`enumerated ${places} background places over ${CLUB_NAME_STYLES.length} styles: ${rejected} rejected by the gazetteer, ${missed} missed vs the independent list`);
  // playable place lists
  for (const code of PLAYABLE_COUNTRIES) for (const p of CLUB_PLACES[code]) if (testHit(p) || isRealPlaceName(p)) fail(`${code}: playable place "${p}" matches a real club/town`);
  // sampling: every nation, several seeds, thousands of names, zero hits
  let sampled = 0;
  for (const seed of ['s1', 's2', 's3', 'review-2026', 'x7']) {
    for (const n of NATIONS) {
      const rng = rngFrom(`${seed}-${n.code}`);
      const used = new Set();
      for (let i = 0; i < 60; i++) {
        const name = PLAYABLE_COUNTRIES.includes(n.code) ? makeClubName(rng, n.code, used) : makeBackgroundClubName(rng, n.code, used);
        sampled++;
        if (testHit(name)) fail(`${n.code}: generated club "${name}" matches the independent real-club list`);
      }
    }
  }
  console.log(`sampled ${sampled} club names (${NATIONS.length} nations x 5 seeds): zero hits required`);
}

section('independent real-player test (plaintext list, small)');
{
  const REAL_PLAYERS = ['Claudio Pizarro', 'Raúl Jiménez', 'Bryan Ruiz', 'Willian Borges', 'Hugo Sanchez', 'Nahuel Molina', 'Lisandro Martínez', 'Nuno Mendes', 'Bruno Guimarães',
    'Samir Nasri', 'Javier Hernández', 'Teófilo Cubillas', 'Marcelo Salas', 'Tim Howard', 'Leon Bailey', 'Hernán Crespo', 'Sadio Mané', 'Kalidou Koulibaly', 'Dušan Vlahović',
    'Rafael Leão', 'Arda Güler', 'Sergio Ramos', 'Fernando Torres', 'David Silva', 'Luis Suárez', 'Alexis Sánchez', 'Lautaro Martínez', 'Enzo Fernández', 'Rúben Dias',
    'Bruno Fernandes', 'Bernardo Silva', 'Declan Rice', 'Kyle Walker', 'Harry Kane', 'Jordan Henderson', 'Thomas Müller', 'Timo Werner', 'Thierry Henry', 'Paul Pogba',
    'Antoine Griezmann', 'Kevin De Bruyne', 'Eden Hazard', 'Virgil van Dijk', 'Matthijs de Ligt', 'Memphis Depay', 'Christian Eriksen', 'Zlatan Ibrahimovic', 'Luka Modrić',
    'Ivan Rakitić', 'Robert Lewandowski', 'Mohamed Salah', 'Riyad Mahrez', 'Victor Osimhen', 'Samuel Eto\'o', 'Didier Drogba', 'Son Heung-min', 'Takumi Minamino', 'Park Ji-sung',
    'Cristiano Ronaldo', 'Lionel Messi', 'Neymar Junior', 'Diego Costa', 'Gabriel Jesus', 'Ashley Cole', 'Michael Owen', 'Luke Shaw', 'Phil Jones', 'Ben White', 'Tom Davies',
    'Daniel Alves', 'Jordi Alba', 'Sergio Busquets', 'Luis Díaz', 'Federico Valverde', 'Darwin Núñez', 'Cristian Romero', 'Emiliano Martínez', 'Julián Álvarez', 'Paulo Dybala'];
  const rk = (s) => t_fold(s).replace(/[^a-z0-9]+/g, ' ').trim();
  const index = new Map();
  for (const c of CULTURES) {
    const fm = new Map(); const lm = new Map();
    c.first.forEach((n, i) => { const k = rk(n); (fm.get(k) || fm.set(k, []).get(k)).push(i); });
    c.last.forEach((n, i) => { const k = rk(n); (lm.get(k) || lm.set(k, []).get(k)).push(i); });
    index.set(c.id, { fm, lm });
  }
  let producible = 0;
  for (const full of REAL_PLAYERS) {
    const toks = rk(full).split(' ');
    for (let cut = 1; cut < toks.length; cut++) {
      const f = toks.slice(0, cut).join(' '); const l = toks.slice(cut).join(' ');
      for (const c of CULTURES) {
        const { fm, lm } = index.get(c.id);
        for (const fi of fm.get(f) || []) for (const li of lm.get(l) || []) {
          producible++;
          check(isGuardedPlayerName(c.id, fi, li), `real player "${full}" is producible in culture ${c.id} and not guarded`);
        }
      }
    }
  }
  console.log(`${REAL_PLAYERS.length} plaintext real players checked; ${producible} (culture, first, last) hits all guarded`);
  // a rng that keeps proposing a guarded pair must never get it back
  for (const c of CULTURES) {
    let found = null;
    for (let f = 0; f < c.first.length && !found; f++) for (let l = 0; l < c.last.length; l++) if (isGuardedPlayerName(c.id, f, l)) { found = [f, l]; break; }
    if (!found) continue;
    let k = 0;
    const stuck = { int: (lo) => (k++ % 2 === 0 ? found[0] : found[1]) + 0 * lo };
    const got = pickNameIndices(stuck, c.id);
    check(!isGuardedPlayerName(c.id, got[0], got[1]), `culture ${c.id}: stuck rng still returned a guarded pair`);
  }
}

section('stadiums and sponsors');
{
  const rng = rngFrom('stadium');
  for (const code of [...PLAYABLE_COUNTRIES, 'BRA', 'JPN']) {
    const list = [];
    for (let i = 0; i < 4; i++) list.push(makeStadiumName(rng, code));
    console.log(`${code}: ${list.join(' | ')}`);
    check(list.every((s) => s && !/undefined|NaN|\{|\}/.test(s)), `${code}: malformed stadium`);
  }
  const sp = [];
  for (let i = 0; i < 10; i++) sp.push(makeSponsorName(rng));
  console.log('sponsors:', sp.join(' | '));
}

// ---------------------------------------------------------------- source scans
section('source scans (forbidden words, dashes, banned calls)');
{
  const j = (...p) => p.join('');
  const forbidden = [
    new RegExp(`\\b${j('Ligue', ' ', '1')}\\b`, 'i'),
    new RegExp(`\\b${j('Premier', ' ', 'League')}\\b`, 'i'),
    new RegExp(`\\b${j('La', ' ', 'Liga')}\\b`, 'i'),
    new RegExp(`\\b${j('Serie', ' ', 'A')}\\b`, 'i'),
    new RegExp(`\\b${j('Bundes', 'liga')}\\b`, 'i'),
    new RegExp(`\\b${j('FI', 'FA')}\\b`, 'i'),
    new RegExp(`\\b${j('UE', 'FA')}\\b`, 'i'),
  ];
  const dashes = /[\u2013\u2014]/;
  const CONTROL_CHARS = new RegExp(`[${String.fromCharCode(0)}-${String.fromCharCode(8)}${String.fromCharCode(11, 12)}${String.fromCharCode(14)}-${String.fromCharCode(31)}]`);
  const banned = [/Math\.random/, /Date\.now/];
  for (const f of ['src/logic/nations.js', 'src/logic/names.js', 'src/logic/realNames.js', 'tools/check-names.js', 'tools/real-clubs-test.json']) {
    const text = readFileSync(join(ROOT, f), 'utf8');
    forbidden.forEach((re) => check(!re.test(text), `${f}: forbidden brand word matches ${re}`));
    check(!dashes.test(text), `${f}: contains an em or en dash`);
    check(!CONTROL_CHARS.test(text), `${f}: contains a control character`);
    banned.forEach((re) => check(!re.test(text), `${f}: contains ${re}`));
  }
  // also scan everything the generators can emit
  const all = [];
  for (const c of CULTURES) all.push(...c.first, ...c.last);
  for (const n of NATIONS) all.push(n.name);
  for (const t of Object.values(CLUB_PLACES)) all.push(...t);
  const joined = all.join('\n');
  forbidden.forEach((re) => check(!re.test(joined), `data: forbidden brand word matches ${re}`));
  check(!dashes.test(joined), 'data: contains an em or en dash');
  console.log('scans done');
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
