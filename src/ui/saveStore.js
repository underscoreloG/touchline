// Browser side of the save system: IndexedDB (one autosave slot), debounced autosave, file export and import.
// The format itself (pack, check, unpack) is logic/save.js. Everything here fails soft: if IndexedDB is blocked
// (private window, storage disabled) the game keeps running and only reports that saving is unavailable.

import { packSave, unpackSave, toPortable, fromPortable } from '../logic/save.js';

const DB_NAME = 'touchline';
const STORE = 'saves';
const SLOT = 'auto';
const META = 'auto-meta';
const FILE_EXT = '.touchline';

let dbPromise = null;
function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB is not available')); return; }
      let req;
      try { req = indexedDB.open(DB_NAME, 1); } catch (e) { reject(e); return; }
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
      req.onblocked = () => reject(new Error('IndexedDB is blocked'));
    }).catch((e) => { dbPromise = null; throw e; });
  }
  return dbPromise;
}

function tx(mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const os = t.objectStore(STORE);
    let out;
    try { out = fn(os); } catch (e) { reject(e); return; }
    t.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
    t.onerror = () => reject(t.error || new Error('IndexedDB transaction failed'));
    t.onabort = () => reject(t.error || new Error('IndexedDB transaction aborted'));
  }));
}

/**
 * Write the full save and its small summary in one transaction. `makeSave` runs inside the transaction callback, in the
 * same tick as the put calls (which clone the objects), so the packed state, world and checksum always agree.
 */
export function writeSave(makeSave) {
  return tx('readwrite', (os) => {
    const save = makeSave();
    os.put(save, SLOT);
    os.put({ summary: save.summary, savedAt: save.savedAt }, META);
  });
}
/** The summary card for the main menu, or null. Never throws. */
export async function readMeta() {
  try { return (await tx('readonly', (os) => os.get(META))) || null; } catch (e) { return null; }
}
export function readSave() { return tx('readonly', (os) => os.get(SLOT)); }
export function deleteSave() { return tx('readwrite', (os) => { os.delete(SLOT); os.delete(META); }); }

// ------------------------------------------------------------------ autosave
/**
 * Debounced autosave of the live game. `getLive()` returns { state, world, rng } or null. mark() after every change,
 * flush() to write right now (menu, tab hidden). `onStatus(text)` reports 'saved' / 'error' for the top bar.
 */
export function createAutosave(getLive, onStatus = () => {}, delayMs = 1500) {
  let timer = null, running = null, dirty = false;
  const api = {
    disabled: false,
    available: true,
    lastSavedAt: null,
    mark() {
      if (api.disabled || !api.available) return;
      dirty = true;
      if (timer) return;
      timer = setTimeout(() => { timer = null; api.flush(); }, delayMs);
    },
    /** Forget pending changes (after a reset). */
    cancel() { if (timer) { clearTimeout(timer); timer = null; } dirty = false; },
    async flush() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (running) { await running; }
      if (api.disabled || !api.available || !dirty) return;
      const live = getLive();
      if (!live) { dirty = false; return; }
      dirty = false;
      running = (async () => {
        try {
          const at = Date.now();
          await writeSave(() => packSave(getLive() || live, at));
          api.lastSavedAt = at;
          onStatus('saved', at);
        } catch (e) {
          console.warn('autosave failed', e);
          api.available = false;
          onStatus('error', null);
        }
      })();
      await running;
      running = null;
      if (dirty) api.mark();
    },
  };
  return api;
}

// ------------------------------------------------------------------ files
async function gzip(text) {
  if (typeof CompressionStream === 'undefined') return new Blob([text], { type: 'application/json' });
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}
async function gunzip(blob) {
  const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  const zipped = head[0] === 0x1f && head[1] === 0x8b;
  if (!zipped) return blob.text();
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open compressed saves.');
  return new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text();
}

/** Download the given save (from packSave or readSave) as a file. */
export async function exportToFile(save) {
  const blob = await gzip(JSON.stringify(toPortable(save)));
  const safe = String(save.summary.club).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'save';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `touchline-${safe}-season-${save.summary.season}${FILE_EXT}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** Read a file chosen by the user and rebuild the live game: { state, world, rng, summary, save }. */
export async function importFromFile(file) {
  let obj;
  try { obj = JSON.parse(await gunzip(file)); } catch (e) { throw new Error('This file is not a Touchline save.'); }
  const save = fromPortable(obj);
  return { ...unpackSave(save), save };
}

export { unpackSave };
