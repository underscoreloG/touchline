// Save game format (pure, no IndexedDB, no clock): pack the live game into one structured-cloneable object, check and
// unpack it again. The browser side (IndexedDB, files, autosave) lives in ui/saveStore.js.
//
// A save holds: the game state (JSON-safe), the world (typed-array buffers + club table), the position of the shared
// rng, and a checksum of the world so a damaged save is refused instead of loaded.

import { World } from './world.js';
import { rngFrom } from './rng.js';
import { STATE_VERSION } from './game.js';

export const SAVE_FORMAT = 1;

/** Small description of a save for the main menu (read without loading the world). */
export function saveSummary(state) {
  const s = state.season;
  return {
    club: state.club.name, crest: state.club.crest, colours: state.club.colours,
    country: s.country, level: s.level, season: s.number, phase: s.phase,
    coins: state.coins, matches: state.counters.match, seed: state.seed, worldSize: state.worldSize,
  };
}

/**
 * Pack the live game. `savedAt` (epoch ms) comes from the caller because logic code never reads the clock.
 * The result shares buffers with the live world: hand it to IndexedDB (which clones at call time) or to toPortable
 * right away; do not keep it around while the game keeps running.
 */
export function packSave({ state, world, rng }, savedAt) {
  const snap = world.snapshot({ copy: false });
  return {
    format: SAVE_FORMAT, stateVersion: STATE_VERSION, savedAt,
    summary: saveSummary(state),
    state,
    world: snap,
    worldChecksum: world.checksum(),
    rngState: rng ? rng.state() : null,
  };
}

/** Validate a save and rebuild the live objects: { state, world, rng, summary }. Throws a readable Error. */
export function unpackSave(save) {
  if (!save || typeof save !== 'object') throw new Error('This is not a Touchline save.');
  if (save.format !== SAVE_FORMAT) throw new Error(`Unsupported save format ${save.format}.`);
  if (save.stateVersion !== STATE_VERSION || !save.state || save.state.version !== STATE_VERSION) {
    throw new Error('This save comes from an incompatible version of the game.');
  }
  let world;
  try { world = World.fromSnapshot(save.world); } catch (e) { throw new Error('The saved world is unreadable: ' + e.message); }
  if (save.worldChecksum != null && world.checksum() !== save.worldChecksum) throw new Error('The saved world is damaged (checksum mismatch).');
  const rng = rngFrom(save.state.seed);
  if (save.rngState != null) rng.setState(save.rngState);
  return { state: save.state, world, rng, summary: save.summary || saveSummary(save.state) };
}

// ------------------------------------------------------------------ portable (file) form: JSON-safe
function toB64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(str) {
  const s = atob(str);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes.buffer;
}

/** JSON-safe copy of a save (buffers as base64). */
export function toPortable(save) {
  const buffers = {};
  for (const k of Object.keys(save.world.buffers)) buffers[k] = toB64(save.world.buffers[k]);
  return { ...save, world: { meta: save.world.meta, buffers } };
}

/** Inverse of toPortable. */
export function fromPortable(obj) {
  if (!obj || !obj.world || !obj.world.buffers) throw new Error('This is not a Touchline save.');
  const buffers = {};
  for (const k of Object.keys(obj.world.buffers)) buffers[k] = fromB64(obj.world.buffers[k]);
  return { ...obj, world: { meta: obj.world.meta, buffers } };
}
