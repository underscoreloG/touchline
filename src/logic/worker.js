// Web Worker entry: runs the heavy world jobs off the main thread.
//
// Protocol (all messages are plain objects; an optional `id` on a request is echoed on every reply):
//   -> { type:'generate', seed, size }
//   <- { type:'progress', p:0..1, label }              zero or more
//   <- { type:'done', seed, size, snapshot:{meta, buffers} }   buffers are transferred, not copied
//   <- { type:'error', message }                       on any failure or unknown request type
// Phase 2 adds 'rollover' and 'matchday' with registerHandler(type, fn) (or by adding entries to HANDLERS):
//   a handler is fn(msg, post, ctx) where ctx.world holds the live World between messages
//   (set by 'generate' or by a 'load' message carrying a snapshot).
//
// The module is importable in Node (tools/check-world.js): the worker bootstrap at the bottom only runs
// inside a real WorkerGlobalScope. handleMessage(msg, post) is the whole logic: post(message, transferList?).

import { generateWorld } from './generator.js';
import { World } from './world.js';

/** State kept between messages inside one worker. */
const ctx = { world: null };

/** type -> handler(msg, post, ctx). Add phase 2 jobs here. */
export const HANDLERS = {
  generate(msg, post, c) {
    const seed = msg.seed;
    const size = msg.size;
    let lastStep = -1;
    const world = generateWorld(seed, size, (p, label) => {
      // at most ~100 progress messages
      const step = Math.floor(p * 100);
      if (step === lastStep && p < 1) return;
      lastStep = step;
      post({ type: 'progress', p, label });
    });
    c.world = world;
    const snapshot = world.snapshot({ copy: false });
    post({ type: 'done', seed, size: world.size, snapshot }, Object.values(snapshot.buffers));
  },

  /** Replace the live world with a snapshot sent by the main thread (e.g. after loading a save). */
  load(msg, post, c) {
    c.world = World.fromSnapshot(msg.snapshot);
    post({ type: 'loaded', size: c.world.size, checksum: c.world.checksum() });
  },
};

export function registerHandler(type, fn) { HANDLERS[type] = fn; }

/**
 * Handle one request. Never throws: failures become an { type:'error' } reply.
 * @param {{type:string, id?:*}} msg
 * @param {(message:object, transfer?:ArrayBuffer[])=>void} post
 */
export function handleMessage(msg, post) {
  const reply = msg && msg.id !== undefined ? (m, tr) => post({ ...m, id: msg.id }, tr) : post;
  try {
    const h = msg && HANDLERS[msg.type];
    if (!h) { reply({ type: 'error', message: `unknown message type "${msg && msg.type}"` }); return; }
    h(msg, reply, ctx);
  } catch (e) {
    reply({ type: 'error', message: e && e.message ? e.message : String(e) });
  }
}

// ---- browser bootstrap (skipped in Node and on the main thread)
if (typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.onmessage = (e) => handleMessage(e.data, (m, tr) => self.postMessage(m, tr || []));
}
