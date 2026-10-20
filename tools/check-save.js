// Regression checks for the save game format (logic/save.js). node tools/check-save.js
import { rngFrom } from '../src/logic/rng.js';
import { generateWorld } from '../src/logic/generator.js';
import { createState, startGame, playInstant, simRounds } from '../src/logic/game.js';
import { buyPack } from '../src/logic/economy.js';
import { packSave, unpackSave, toPortable, fromPortable, saveSummary, SAVE_FORMAT } from '../src/logic/save.js';

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { if (ok) pass++; else fail++; console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${extra ? '  ' + extra : ''}`); };

function fresh(seed = 7) {
  const world = generateWorld(seed, 30000, () => {});
  const rng = rngFrom(seed);
  const state = createState({ seed, worldSize: 30000, country: 'ENG', club: { name: 'Save FC', colours: ['#c8102e', '#ffffff'], crest: {} } });
  startGame(state, world, rng);
  return { world, rng, state };
}

/** Same actions on both games: matches, a pack bought with the shared rng-derived seed, more rounds. */
function play(g, n) {
  for (let i = 0; i < n; i++) playInstant(g.state, g.world);
  g.state.coins += 5000;
  const prng = rngFrom((g.state.seed * 13 + g.state.counters.card * 7919 + g.state.counters.match) >>> 0);
  const r = buyPack(g.state, g.world, prng, 'silver');
  g.rng.next(); g.rng.next(); // the shared rng is consumed by squad actions; its position must survive a save
  simRounds(g.state, g.world, 3);
  return r;
}

const a = fresh();
play(a, 6);

// 1. round trip through the portable (file) form, as JSON text
const t0 = Date.now();
const save = packSave(a, 1760000000000);
const text = JSON.stringify(toPortable(save));
const back = unpackSave(fromPortable(JSON.parse(text)));
check('format constants', save.format === SAVE_FORMAT && save.savedAt === 1760000000000);
check('state survives the round trip', JSON.stringify(back.state) === JSON.stringify(a.state));
check('world checksum is identical', back.world.checksum() === a.world.checksum());
check('rng position is restored', back.rng.state() === a.rng.state() && back.rng.next() === (() => a.rng.next())());
check('summary matches the state', JSON.stringify(save.summary) === JSON.stringify(saveSummary(a.state)) && save.summary.club === 'Save FC');
console.log(`       save text ${(text.length / 1e6).toFixed(2)} MB, pack + portable + unpack ${Date.now() - t0} ms`);

// 2. the loaded game continues exactly like the original
const b = { state: back.state, world: back.world, rng: back.rng };
const ra = play(a, 8);
const rb = play(b, 8);
check('continued play is identical: state', JSON.stringify(a.state) === JSON.stringify(b.state));
check('continued play is identical: world', a.world.checksum() === b.world.checksum());
check('continued play is identical: pack', ra.ok === rb.ok && JSON.stringify(ra.pack) === JSON.stringify(rb.pack));

// 3. structured-clone form (what IndexedDB stores) works the same
const c = unpackSave(structuredClone(packSave(b, 1)));
check('IndexedDB-style structured clone round trip', JSON.stringify(c.state) === JSON.stringify(b.state) && c.world.checksum() === b.world.checksum());

// 4. damaged or foreign saves are refused with a readable message
const bad = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
const dmg = structuredClone(packSave(b, 1));
new Uint8Array(dmg.world.buffers[Object.keys(dmg.world.buffers)[0]])[10] ^= 0xff;
check('flipped byte in the world is refused', /damaged/.test(bad(() => unpackSave(dmg)) || ''));
const wrongVer = structuredClone(packSave(b, 1)); wrongVer.stateVersion = 0;
check('incompatible version is refused', /incompatible/.test(bad(() => unpackSave(wrongVer)) || ''));
const wrongFmt = structuredClone(packSave(b, 1)); wrongFmt.format = 99;
check('unknown format is refused', /format/.test(bad(() => unpackSave(wrongFmt)) || ''));
check('garbage is refused', bad(() => unpackSave(null)) !== null && bad(() => fromPortable({ nope: 1 })) !== null && bad(() => unpackSave({ format: SAVE_FORMAT })) !== null);

// 5. new season after loading still works (pyramid memberships restored)
const d = unpackSave(structuredClone(packSave(a, 2)));
check('a loaded save can reach the next season', (() => {
  const st = d.state; const w = d.world;
  for (let i = 0; i < 400 && st.season.phase !== 'done'; i++) { const r = simRounds(st, w, 10); if (!r.ok) return false; }
  return st.season.phase === 'done' && st.season.complete;
})());

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
