// Seeded PRNG. All randomness in the game goes through this module.
// No Math.random, no Date.now anywhere in src/logic.

/** @typedef {{ next:()=>number, int:(lo:number,hi:number)=>number, float:(lo:number,hi:number)=>number,
 *   chance:(p:number)=>boolean, pick:<T>(arr:T[])=>T, weighted:<T>(items:T[], weights:number[])=>T,
 *   weightedIndex:(weights:number[])=>number, normal:(mean:number, sd:number)=>number,
 *   shuffle:<T>(arr:T[])=>T[], fork:(label:string|number)=>Rng, state:()=>number, setState:(v:number)=>void }} Rng */

/** Hash any string or number to a 32-bit unsigned integer (xmur3-style). */
export function hashSeed(input) {
  const s = String(input);
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** mulberry32 core. Returns a function producing floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build an Rng from a number or string seed.
 * @param {number|string} seed
 * @returns {Rng}
 */
export function rngFrom(seed) {
  const s0 = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  let a = s0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    next,
    /** Integer in [lo, hi] inclusive. */
    int(lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); },
    float(lo, hi) { return lo + next() * (hi - lo); },
    chance(p) { return next() < p; },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    weightedIndex(weights) {
      let total = 0;
      for (let i = 0; i < weights.length; i++) total += weights[i];
      if (total <= 0) return Math.floor(next() * weights.length);
      let r = next() * total;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r < 0) return i;
      }
      return weights.length - 1;
    },
    weighted(items, weights) { return items[rng.weightedIndex(weights)]; },
    /** Box-Muller normal. */
    normal(mean = 0, sd = 1) {
      let u = 0, v = 0;
      while (u === 0) u = next();
      while (v === 0) v = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    /** In-place Fisher-Yates, returns the same array. */
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    },
    /** Independent child stream derived from this seed state and a label. */
    fork(label) { return rngFrom((s0 ^ hashSeed(label)) >>> 0); },
    state() { return a; },
    /** Restore a position read with state() (save games). */
    setState(v) { a = v >>> 0; },
  };
  return rng;
}

/** Clamp helper shared by logic modules. */
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
