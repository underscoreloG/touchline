// Formation data. Single source for slots, neighbour pairs and choreography anchors.
// Slot coordinates: `lat` 0 = left touchline .. 100 = right touchline (own team's view, attacking "up").
// `depth` 0 = own goal line .. 100 = opponent goal line.
// Slot index 0 is always the goalkeeper.
// Pitch metres (105 x 68, team attacking toward +x): x = depth * 1.05, y = lat * 0.68.

import { SHAPE_MODS, SHAPE_SCALE } from '../balance.js';

/** @typedef {{ pos:string, lat:number, depth:number }} Slot */
/** @typedef {{ id:string, slots:Slot[], links:Array<[number,number]> }} Formation */

const S = (pos, lat, depth) => ({ pos, lat, depth });

/** @type {Record<string, Formation>} */
export const FORMATIONS = {
  '4-4-2': {
    id: '4-4-2',
    slots: [
      S('GK', 50, 5),
      S('FB', 15, 25), S('CB', 38, 22), S('CB', 62, 22), S('FB', 85, 25),
      S('W', 12, 55), S('CM', 38, 50), S('CM', 62, 50), S('W', 88, 55),
      S('ST', 38, 82), S('ST', 62, 82),
    ],
    links: [[0, 2], [0, 3], [1, 2], [2, 3], [3, 4], [1, 5], [2, 6], [3, 7], [4, 8], [5, 6], [6, 7], [7, 8], [5, 9], [6, 9], [7, 10], [8, 10], [9, 10]],
  },
  '4-3-3': {
    id: '4-3-3',
    slots: [
      S('GK', 50, 5),
      S('FB', 15, 25), S('CB', 38, 22), S('CB', 62, 22), S('FB', 85, 25),
      S('CM', 30, 52), S('DM', 50, 40), S('CM', 70, 52),
      S('W', 15, 78), S('ST', 50, 86), S('W', 85, 78),
    ],
    links: [[0, 2], [0, 3], [1, 2], [2, 3], [3, 4], [1, 5], [2, 6], [3, 6], [4, 7], [5, 6], [6, 7], [5, 8], [5, 9], [7, 9], [7, 10], [8, 9], [9, 10]],
  },
  '4-2-3-1': {
    id: '4-2-3-1',
    slots: [
      S('GK', 50, 5),
      S('FB', 15, 25), S('CB', 38, 22), S('CB', 62, 22), S('FB', 85, 25),
      S('DM', 38, 42), S('CM', 62, 44),
      S('W', 15, 68), S('AM', 50, 66), S('W', 85, 68),
      S('ST', 50, 88),
    ],
    links: [[0, 2], [0, 3], [1, 2], [2, 3], [3, 4], [1, 5], [2, 5], [3, 6], [4, 6], [5, 6], [5, 8], [6, 8], [1, 7], [4, 9], [7, 8], [8, 9], [7, 10], [8, 10], [9, 10]],
  },
  '3-5-2': {
    id: '3-5-2',
    slots: [
      S('GK', 50, 5),
      S('CB', 25, 22), S('CB', 50, 20), S('CB', 75, 22),
      S('FB', 8, 52), S('CM', 33, 50), S('DM', 50, 40), S('CM', 67, 50), S('FB', 92, 52),
      S('ST', 38, 82), S('ST', 62, 82),
    ],
    links: [[0, 1], [0, 2], [0, 3], [1, 2], [2, 3], [1, 4], [1, 5], [2, 6], [3, 7], [3, 8], [4, 5], [5, 6], [6, 7], [7, 8], [5, 9], [7, 10], [4, 9], [8, 10], [9, 10]],
  },
  '5-3-2': {
    id: '5-3-2',
    slots: [
      S('GK', 50, 5),
      S('FB', 8, 30), S('CB', 30, 22), S('CB', 50, 20), S('CB', 70, 22), S('FB', 92, 30),
      S('CM', 30, 52), S('DM', 50, 45), S('CM', 70, 52),
      S('ST', 38, 82), S('ST', 62, 82),
    ],
    links: [[0, 2], [0, 3], [0, 4], [1, 2], [2, 3], [3, 4], [4, 5], [1, 6], [2, 6], [3, 7], [4, 8], [5, 8], [6, 7], [7, 8], [6, 9], [8, 10], [7, 9], [7, 10], [9, 10]],
  },
  '4-1-4-1': {
    id: '4-1-4-1',
    slots: [
      S('GK', 50, 5),
      S('FB', 15, 25), S('CB', 38, 22), S('CB', 62, 22), S('FB', 85, 25),
      S('DM', 50, 38),
      S('W', 12, 58), S('CM', 38, 55), S('CM', 62, 55), S('W', 88, 58),
      S('ST', 50, 85),
    ],
    links: [[0, 2], [0, 3], [1, 2], [2, 3], [3, 4], [2, 5], [3, 5], [1, 6], [4, 9], [5, 7], [5, 8], [6, 7], [7, 8], [8, 9], [7, 10], [8, 10], [6, 10], [9, 10]],
  },
};

export const FORMATION_LIST = Object.values(FORMATIONS);

/** Anchor in pitch metres for slot `i`, team attacking toward +x. Mirror x and y for the other side. */
export function anchorFor(formationId, i) {
  const s = FORMATIONS[formationId].slots[i];
  return { x: s.depth * 1.05, y: s.lat * 0.68 };
}

/** Slot positions of a formation as an array of position codes. */
export function positionsOf(formationId) {
  return FORMATIONS[formationId].slots.map((s) => s.pos);
}

// ------------------------------------------------------------------ team shape (tactics preview, choreography hint)

export { SHAPE_MODS };
const M_PER_DEPTH = SHAPE_SCALE.mPerDepth;
const M_PER_LAT = SHAPE_SCALE.mPerLat;
const DEF_POS = { CB: 1, FB: 1 };
const ATT_POS = { ST: 1, W: 1, AM: 1 };

/**
 * Team shape after the settings, for the small top-down preview.
 * @param {string} formationId
 * @param {{mentality?:string, pressing?:string, width?:string, defLine?:string}} settings
 * @returns {{ points:Array<{pos:string, lat:number, depth:number}>, metrics:{ lineHeightM:number, blockDepthM:number, widthM:number } }}
 */
export function shapePreview(formationId, settings = {}) {
  const f = FORMATIONS[formationId] || FORMATIONS['4-3-3'];
  const s = settings || {};
  const defShift = (SHAPE_MODS.defLineM[s.defLine] ?? 0) / M_PER_DEPTH;
  const press = (SHAPE_MODS.pressBlockM[s.pressing] ?? 0) / M_PER_DEPTH;
  const compact = SHAPE_MODS.pressCompact[s.pressing] ?? 1;
  const ment = (SHAPE_MODS.mentalityM[s.mentality] ?? 0) / M_PER_DEPTH;
  const wScale = SHAPE_MODS.widthScale[s.width] ?? 1;
  const out = f.slots.filter((x) => x.pos !== 'GK');
  const centre = out.reduce((a, x) => a + x.depth, 0) / out.length;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const points = f.slots.map((x) => {
    if (x.pos === 'GK') return { pos: x.pos, lat: 50, depth: clamp(x.depth + defShift * 0.3, 2, 14) };
    let d = centre + (x.depth - centre) * compact + press;
    if (DEF_POS[x.pos]) d += defShift;
    else if (ATT_POS[x.pos]) d += ment;
    else d += ment / 2 + defShift / 3;
    const lat = 50 + (x.lat - 50) * wScale;
    return { pos: x.pos, lat: clamp(lat, 3, 97), depth: clamp(d, 10, 95) };
  });
  const defs = points.filter((p) => DEF_POS[p.pos]);
  const outs = points.filter((p) => p.pos !== 'GK');
  const lineHeightM = defs.length ? (defs.reduce((a, p) => a + p.depth, 0) / defs.length) * M_PER_DEPTH : 0;
  const depths = outs.map((p) => p.depth);
  const lats = outs.map((p) => p.lat);
  return {
    points,
    metrics: {
      lineHeightM: Math.round(lineHeightM),
      blockDepthM: Math.round((Math.max(...depths) - Math.min(...depths)) * M_PER_DEPTH),
      widthM: Math.round((Math.max(...lats) - Math.min(...lats)) * M_PER_LAT),
    },
  };
}
