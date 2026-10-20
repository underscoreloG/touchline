// Procedural head-and-shoulders portraits as SVG strings, deterministic per player seed.
//
//   avatarSVG({ seed, kitColour, kitColour2, pos, nation, age, size }) -> SVG string (viewBox 0 0 100 100,
//   transparent background, the card supplies the backdrop).
//
// 8 skin tones, 16 hair styles, 7 natural hair colours plus grey, 5 beard styles, 3 collar styles.
// Nation only nudges palette weights (a light regional hint); every combination can appear anywhere.
// Keepers (pos 'GK') wear a keeper kit colour picked to contrast with the outfield kit.

import { rngFrom } from '../../logic/rng.js';

const SKIN = ['#f7d7c4', '#efc3a4', '#e0aa84', '#c98f66', '#ab7149', '#8b5637', '#6b3f27', '#4b2b1a'];
const HAIR = ['#17110d', '#33221a', '#563620', '#7e5733', '#a8814b', '#d4b06a', '#a9502a'];
const GREY = '#a7a7ab';
const STYLES = ['bald', 'buzz', 'crop', 'sidepart', 'quiff', 'afro', 'curly', 'bun', 'long', 'mohawk', 'dreads', 'cornrows', 'slick', 'fringe', 'hightop', 'receding'];
const KEEPER_KITS = ['#39d353', '#ff8c1a', '#1c1d24', '#8b5cf6', '#f2e30b', '#16b8f3', '#ff3d7f'];

// Regional skin-tone weights (index = SKIN). Kept broad on purpose.
const REGION_SKIN = {
  nordic: [5, 4, 2, 0.5, 0.3, 0.2, 0.15, 0.1],
  west: [3, 3, 2, 1.1, 0.9, 0.8, 0.7, 0.4],
  east: [5, 4, 2, 0.6, 0.15, 0.05, 0.03, 0.02],
  south: [2, 3.5, 3, 1.5, 0.5, 0.25, 0.15, 0.05],
  mena: [0.3, 1, 2.5, 3, 2, 0.7, 0.25, 0.1],
  africa: [0, 0, 0.05, 0.25, 0.7, 2, 3, 3],
  eastAsia: [1.2, 3, 3, 1.2, 0.3, 0.05, 0, 0],
  southAsia: [0, 0.3, 1, 2.5, 3, 2, 0.8, 0.2],
  brazil: [0.8, 1.3, 2, 2, 1.7, 1.3, 1.1, 0.7],
  plata: [2, 3, 3, 1.2, 0.4, 0.2, 0.1, 0.05],
  andes: [0.4, 1.2, 2.6, 3, 1.8, 0.6, 0.3, 0.1],
  caribbean: [0, 0, 0.1, 0.4, 1, 2, 3, 2],
  newWorld: [2.5, 2.5, 2, 1.2, 0.9, 0.9, 0.8, 0.5],
};
const REGION_OF = {};
const assign = (region, codes) => codes.split(' ').forEach((c) => { REGION_OF[c] = region; });
assign('nordic', 'NOR SWE DEN DNK FIN ISL SCO IRL NIR WAL');
assign('west', 'ENG FRA NED NLD BEL GER DEU SUI CHE AUT LUX');
assign('east', 'POL CZE SVK UKR RUS HUN ROU BUL BGR SRB CRO HRV SVN BIH MNE MKD ALB GEO ARM LTU LVA EST BLR');
assign('south', 'ESP ITA POR PRT GRE GRC TUR CYP MLT ISR');
assign('mena', 'MAR ALG DZA TUN EGY KSA SAU QAT UAE ARE IRQ IRN JOR SYR LBN OMA KUW BHR LBY UZB');
assign('africa', 'SEN CIV GHA NGA CMR MLI BFA GUI GIN COD CGO RSA ZAF ANG GAB TOG BEN KEN ZAM ZIM CPV GAM ETH SLE TAN UGA MOZ');
assign('eastAsia', 'JPN KOR CHN PRK HKG TPE VIE VNM THA IDN MAS PHI MNG');
assign('southAsia', 'IND PAK BAN SRI NEP');
assign('brazil', 'BRA COL VEN PAN CUB DOM');
assign('plata', 'ARG URU URY CHI CHL PAR PRY');
assign('andes', 'PER ECU BOL MEX CRC CRI HON HND GUA SLV NCA');
assign('caribbean', 'JAM HAI TRI TTO CUW SUR');
assign('newWorld', 'USA CAN AUS NZL');

// Hair style weights by broad tone band. Order = STYLES.
const STYLE_W = {
  light: [0.4, 1.4, 2, 1.6, 1.4, 0, 0.6, 0.6, 0.7, 0.4, 0.05, 0, 1.2, 1, 0, 0.6],
  mid: [0.6, 1.6, 1.8, 1, 1.2, 0.4, 1.2, 0.6, 0.6, 0.5, 0.4, 0.3, 1, 0.6, 0.2, 0.4],
  dark: [1, 2.2, 1.2, 0.2, 0.4, 1.2, 1.4, 0.3, 0.15, 0.6, 1.2, 1.2, 0.3, 0.1, 0.7, 0.3],
  eastAsia: [0.2, 1.2, 2, 1.4, 1.2, 0, 0.3, 0.3, 0.6, 0.2, 0, 0, 1, 2.2, 0, 0.2],
};

function hexToRgb(h) {
  const s = String(h || '#888888').replace('#', '');
  const f = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) || 0);
}
function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
function shade(hex, k) {
  // k < 0 darkens, k > 0 lightens, -1..1
  const c = hexToRgb(hex);
  return rgbToHex(c.map((v) => (k < 0 ? v * (1 + k) : v + (255 - v) * k)));
}
function dist(a, b) {
  const x = hexToRgb(a); const y = hexToRgb(b);
  return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]);
}
const lum = (hex) => { const [r, g, b] = hexToRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

/** Hair front layers. Coordinates for a head spanning x 34..66, crown at y 27.5. */
function hairFront(style, col, hi) {
  switch (style) {
    case 'bald': return '';
    case 'buzz': return `<path d="M33.4,45 C31.5,31 38,24.5 50,24.5 C62,24.5 68.5,31 66.6,45 C66,39 64.5,35.5 62,34 C56,34.8 44,34.8 38,34 C35.5,35.5 34,39 33.4,45 Z" fill="${col}" opacity="0.72"/>`;
    case 'crop': return `<path d="M33,46 C30.5,30 37,21.5 50,21.5 C63,21.5 69.5,30 67,46 C66.2,40 65,36 62,33.5 C58,35 54,34 50,35 C46,34 42,35 38,33.5 C35,36 33.8,40 33,46 Z" fill="${col}"/>`;
    case 'sidepart': return `<path d="M33,47 C29.5,28 39,19.5 52,20 C64.5,20.5 70,29 67,46 C66.2,39 64,35 61,32.5 C53,32 46,30.5 41,35 C37.5,37.5 34.5,42 33,47 Z" fill="${col}"/>`
      + `<path d="M43,22.5 Q41.5,28 41,34" stroke="${hi}" stroke-width="1.1" fill="none" opacity="0.7"/>`;
    case 'quiff': return `<path d="M33,46 C30.5,32 34,26.5 39,24 C41,15.5 51,11 60,13.5 C68,16.5 70,26 67,46 C66.2,39 64.5,35 61,33 C54,31 46,33 39.5,35 C36,37 34,41 33,46 Z" fill="${col}"/>`
      + `<path d="M44,19 Q52,13.5 61,16" stroke="${hi}" stroke-width="1.3" fill="none" opacity="0.55"/>`;
    case 'afro': return `<path d="M33,45 C33,37 37,33.5 50,33 C63,33.5 67,37 67,45 L69,44 C71,30 63,21 50,21 C37,21 29,30 31,44 Z" fill="${col}"/>`;
    case 'curly': {
      let d = `<path d="M33,46 C31,31 37,23 50,23 C63,23 69,31 67,46 C66,40 65,36 62,34 C56,35.5 44,35.5 38,34 C35,36 34,40 33,46 Z" fill="${col}"/>`;
      const pts = [[35, 33], [38, 27.5], [43, 24], [50, 22.5], [57, 24], [62, 27.5], [65, 33], [40.5, 33.5], [46, 32], [53, 32], [59.5, 33.5]];
      d += pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.6" fill="${col}"/>`).join('');
      d += pts.slice(0, 7).map(([x, y]) => `<path d="M${x - 1.6},${y - 0.6} q1.6,-1.6 3.2,0" stroke="${hi}" stroke-width="0.8" fill="none" opacity="0.45"/>`).join('');
      return d;
    }
    case 'bun': return `<circle cx="50" cy="18.5" r="6" fill="${col}"/><path d="M45.5,22.5 H54.5" stroke="${shade(col, -0.4)}" stroke-width="1.6"/>`
      + `<path d="M33,45 C31,29 38,23 50,23 C62,23 69,29 67,45 C66,37.5 63,32.5 58,31 C52,30 46,30 42,31 C37,32.5 34,37.5 33,45 Z" fill="${col}"/>`
      + `<path d="M40,27 Q50,24 60,27" stroke="${hi}" stroke-width="1" fill="none" opacity="0.5"/>`;
    case 'long': return `<path d="M33,48 C30.5,28 40,21 50,21 C60,21 69.5,28 67,48 C66,40 62,33 52,31 L50,28.5 L48,31 C38,33 34,40 33,48 Z" fill="${col}"/>`;
    case 'mohawk': return `<path d="M33.4,45 C31.5,31 38,25 50,25 C62,25 68.5,31 66.6,45 C66,39 64.5,35.5 62,34 C56,34.8 44,34.8 38,34 C35.5,35.5 34,39 33.4,45 Z" fill="${col}" opacity="0.35"/>`
      + `<path d="M45,34.5 C44,23 46,14 50,11.5 C54,14 56,23 55,34.5 C52,33.5 48,33.5 45,34.5 Z" fill="${col}"/>`;
    case 'dreads': return `<path d="M33,46 C30.5,30 37,22 50,22 C63,22 69.5,30 67,46 C66,40 65,36 62,33.5 C56,35 44,35 38,33.5 C35,36 34,40 33,46 Z" fill="${col}"/>`
      + [38, 43, 48, 53, 58, 63].map((x) => `<path d="M${x},${x < 50 ? 34 : 34} Q${x - 0.8},28 ${x + (x - 50) * 0.08},24" stroke="${hi}" stroke-width="0.9" fill="none" opacity="0.4"/>`).join('');
    case 'cornrows': return `<path d="M33.5,46 C31,30 37.5,23.5 50,23.5 C62.5,23.5 69,30 66.5,46 C66,40 65,36 62.5,33.5 C56,34 44,34 37.5,33.5 C35,36 34,40 33.5,46 Z" fill="${col}"/>`
      + [39, 44, 50, 56, 61].map((x) => `<path d="M${x},33.6 Q${x + (x - 50) * 0.12},28 ${50 + (x - 50) * 0.55},24.5" stroke="${shade(col, 0.35)}" stroke-width="0.9" fill="none" stroke-dasharray="1.4 1"/>`).join('');
    case 'slick': return `<path d="M33,45 C31,28 38,21.5 50,21.5 C62,21.5 69,28 67,45 C66,37 63.5,32 59,30 C53,29 47,29 41,30 C36.5,32 34,37 33,45 Z" fill="${col}"/>`
      + `<path d="M40,26 Q50,21 61,25.5 M42,28.5 Q51,24.5 60,28" stroke="${hi}" stroke-width="1" fill="none" opacity="0.55"/>`;
    case 'fringe': return `<path d="M33,46 C30.5,28 38,20.5 50,20.5 C62,20.5 69.5,28 67,46 C66.4,43 66,41 65,39.5 L62,38 L59,40 L55.5,38.2 L52,40 L48.5,38.2 L45,40 L41.5,38.2 L38,40 L35,39 C34,41 33.4,43 33,46 Z" fill="${col}"/>`;
    case 'hightop': return `<path d="M34,41 L34.5,14 Q50,10.5 65.5,14 L66,41 C63,35.5 57,34 50,34 C43,34 37,35.5 34,41 Z" fill="${col}"/>`
      + `<path d="M36,16 Q50,13 64,16" stroke="${hi}" stroke-width="0.9" fill="none" opacity="0.4"/>`;
    case 'receding': return `<path d="M33,46 C31,30 38,23 50,23 C62,23 69,30 67,46 C66,38 64,32.5 60.5,29.5 C57.5,32 53.5,31 50,32.5 C46.5,31 42.5,32 39.5,29.5 C36,32.5 34,38 33,46 Z" fill="${col}"/>`;
    default: return '';
  }
}

/** Hair layers drawn behind the head. */
function hairBack(style, col, hi) {
  switch (style) {
    case 'afro': {
      let s = `<ellipse cx="50" cy="33" rx="23.5" ry="19" fill="${col}"/>`;
      for (let i = 0; i < 16; i++) {
        const a = Math.PI + (i / 15) * Math.PI * 1.35 - 0.18;
        const x = 50 + 22.5 * Math.cos(a); const y = 34 + 18 * Math.sin(a);
        if (y < 48) s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.6" fill="${col}"/>`;
      }
      return s + `<path d="M36,22 Q44,15.5 54,16" stroke="${hi}" stroke-width="1.4" fill="none" opacity="0.35"/>`;
    }
    case 'long': return `<path d="M30.5,44 C28,26 38,18.5 50,18.5 C62,18.5 72,26 69.5,44 L71.5,71 C66.5,75 61,73.5 58.5,69 L41.5,69 C39,73.5 33.5,75 28.5,71 Z" fill="${col}"/>`;
    case 'dreads': {
      let s = '';
      [[30, 36, 66], [33.5, 30, 70], [37.5, 27, 63], [62.5, 27, 63], [66.5, 30, 70], [70, 36, 66], [28.5, 42, 60], [71.5, 42, 60]].forEach(([x, y0, y1]) => {
        s += `<path d="M${x},${y0} L${x + (x < 50 ? -1 : 1)},${y1}" stroke="${col}" stroke-width="4.4" stroke-linecap="round"/>`;
        s += `<path d="M${x},${y0 + 4} L${x + (x < 50 ? -1 : 1) * 0.8},${y1 - 2}" stroke="${hi}" stroke-width="0.8" stroke-dasharray="1.2 2" opacity="0.5"/>`;
      });
      return s;
    }
    case 'bun': return '';
    default: return '';
  }
}

function beard(style, col, w) {
  const L = 50 - w; const R = 50 + w;
  switch (style) {
    case 'stubble': return `<path d="M${L},49 C${L},60 ${50 - w * 0.45},67.5 50,67.5 C${50 + w * 0.45},67.5 ${R},60 ${R},49 C${R - 2.5},56 ${55},55.5 50,56.5 C${45},55.5 ${L + 2.5},56 ${L},49 Z" fill="${col}" opacity="0.30"/>`;
    case 'full': return `<path d="M${L - 0.5},47 C${L - 0.5},61 ${50 - w * 0.5},70.5 50,70.5 C${50 + w * 0.5},70.5 ${R + 0.5},61 ${R + 0.5},47 C${R - 2},55 ${56},56.5 53,57 C51,56.2 49,56.2 47,57 C${44},56.5 ${L + 2},55 ${L - 0.5},47 Z" fill="${col}"/>`
      + `<path d="M44,57.6 Q50,54.6 56,57.6 Q50,56.6 44,57.6 Z" fill="${col}"/>`;
    case 'goatee': return `<path d="M45.5,61.2 Q50,60 54.5,61.2 L53.8,67 Q50,69.2 46.2,67 Z" fill="${col}"/>`
      + `<path d="M44.2,57.8 Q50,55 55.8,57.8 Q50,57 44.2,57.8 Z" fill="${col}"/>`;
    case 'moustache': return `<path d="M43.8,57.9 Q50,54.4 56.2,57.9 Q53,57.6 50,57.2 Q47,57.6 43.8,57.9 Z" fill="${col}"/>`;
    default: return '';
  }
}

/**
 * @param {{seed:number|string, kitColour?:string, kitColour2?:string, pos?:string, nation?:string, age?:number, size?:number}} o
 * @returns {string} SVG markup
 */
export function avatarSVG(o = {}) {
  const rng = rngFrom('avatar:' + (o.seed ?? 0));
  const region = REGION_OF[String(o.nation || '').toUpperCase()] || 'west';
  const skinIdx = rng.weightedIndex(REGION_SKIN[region]);
  const skin = SKIN[skinIdx];
  const skinShade = shade(skin, -0.18);
  const skinDeep = shade(skin, -0.32);
  const band = region === 'eastAsia' ? 'eastAsia' : skinIdx <= 2 ? 'light' : skinIdx <= 4 ? 'mid' : 'dark';

  // hair colour
  let hw = skinIdx <= 1 ? [1, 2.5, 2.5, 1.6, 1.1, 0.8, 0.45] : skinIdx <= 3 ? [3, 3, 1.5, 0.5, 0.2, 0.1, 0.05] : [9, 1.5, 0.2, 0, 0, 0, 0];
  if (region === 'nordic') hw = hw.map((v, i) => (i >= 3 ? v * 2.4 : v));
  if (region === 'eastAsia' || region === 'southAsia' || region === 'mena') hw = [9, 2, 0.3, 0.05, 0, 0, 0];
  const age = o.age || 25;
  let hair = HAIR[rng.weightedIndex(hw)];
  const greyRoll = rng.next();
  if ((age >= 34 && greyRoll < 0.45) || (age >= 40 && greyRoll < 0.8)) hair = GREY;
  const hairHi = shade(hair, 0.35);

  // style
  const sw = STYLE_W[band].slice();
  if (age >= 31) { sw[0] *= 2.2; sw[15] *= 2.5; }
  if (age <= 21) { sw[0] *= 0.3; sw[15] *= 0.2; }
  const style = STYLES[rng.weightedIndex(sw)];

  // beard
  const beardChance = age < 21 ? 0.15 : age < 27 ? 0.35 : 0.5;
  const beardStyle = rng.chance(beardChance) ? rng.weighted(['stubble', 'full', 'goatee', 'moustache'], [4.5, 2.5, 1.5, 1]) : 'none';
  const beardCol = hair === GREY ? '#8d8d92' : shade(hair, skinIdx >= 5 ? 0 : 0.05);

  // face geometry
  const w = rng.float(14.6, 16.6);
  const ey = rng.float(45.8, 47.6);
  const ex = rng.float(6.2, 7.6);
  const browTilt = rng.float(-1.2, 1.0);
  const browW = rng.float(1.5, 2.3);
  const mw = rng.float(3.4, 5);
  const smile = rng.float(-0.4, 1.8);
  const noseLen = rng.float(6.5, 9);
  const eyeR = rng.float(1.45, 1.9);

  // kit
  const isGK = o.pos === 'GK';
  let kit = o.kitColour || '#c8102e';
  if (isGK) {
    const cands = KEEPER_KITS.filter((c) => dist(c, kit) > 220);
    kit = rng.pick(cands.length ? cands : KEEPER_KITS);
  }
  const trim = o.kitColour2 && !isGK ? o.kitColour2 : (lum(kit) > 0.62 ? '#14161c' : '#ffffff');
  const collar = rng.pick(isGK ? ['crew', 'crew', 'polo'] : ['crew', 'vneck', 'polo']);
  const stripes = !isGK && rng.chance(0.4);

  const L = 50 - w; const R = 50 + w;
  const head = `M${L},44 C${L},22 ${R},22 ${R},44 L${R},50 C${R},60 ${50 + w * 0.45},67.5 50,67.5 C${50 - w * 0.45},67.5 ${L},60 ${L},50 Z`;
  const neckline = collar === 'vneck' ? 'L42,74 L50,85 L58,74' : 'L41,74 Q50,82 59,74';
  const kitPath = `M3,100 C5,85 19,77.5 35,74.5 ${neckline} L65,74.5 C81,77.5 95,85 97,100 Z`;
  const trimPath = collar === 'vneck' ? 'M42,74 L50,85 L58,74' : 'M41,74 Q50,82 59,74';
  const hairT = `translate(50 0) scale(${(w / 16).toFixed(3)} 1) translate(-50 0)`;

  const s = [];
  const size = o.size ? ` width="${o.size}" height="${o.size}"` : ' width="100%" height="100%"';
  s.push(`<svg class="avatar" viewBox="0 0 100 100"${size} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`);
  // back hair
  s.push(`<g transform="${hairT}">${hairBack(style, hair, hairHi)}</g>`);
  // neck
  s.push(`<path d="M42.5,58 L42.5,86 L57.5,86 L57.5,58 Z" fill="${skin}"/>`);
  s.push(`<path d="M42.5,63 Q50,71 57.5,63 L57.5,70 Q50,76 42.5,70 Z" fill="${skinDeep}" opacity="0.45"/>`);
  // kit
  s.push(`<path d="${kitPath}" fill="${kit}"/>`);
  if (stripes) s.push(`<path d="M30,76 L27,100 M70,76 L73,100" stroke="${trim}" stroke-width="3.2" opacity="0.85"/>`);
  if (isGK) s.push(`<path d="M8,96 C12,86 20,81 30,78 L33,83 C24,86 16,90 12,98 Z M92,96 C88,86 80,81 70,78 L67,83 C76,86 84,90 88,98 Z" fill="${shade(kit, -0.3)}" opacity="0.8"/>`);
  s.push(`<path d="M3,100 C5,88 12,82 22,78.5 L24,100 Z" fill="#000" opacity="0.16"/>`);
  s.push(`<path d="M76,78 C86,82 94,88 97,100 L80,100 Z" fill="#fff" opacity="0.08"/>`);
  s.push(`<path d="${trimPath}" fill="none" stroke="${trim}" stroke-width="2.6" stroke-linejoin="round"/>`);
  if (collar === 'polo') s.push(`<path d="M41,74 L37,80.5 L46,79 Z M59,74 L63,80.5 L54,79 Z" fill="${trim}"/>`);
  // ears
  s.push(`<ellipse cx="${L - 0.6}" cy="49" rx="2.7" ry="4.4" fill="${skin}"/><ellipse cx="${R + 0.6}" cy="49" rx="2.7" ry="4.4" fill="${skin}"/>`);
  s.push(`<ellipse cx="${L - 0.4}" cy="49.3" rx="1.2" ry="2.4" fill="${skinShade}"/><ellipse cx="${R + 0.4}" cy="49.3" rx="1.2" ry="2.4" fill="${skinShade}"/>`);
  // head
  s.push(`<path d="${head}" fill="${skin}"/>`);
  s.push(`<path d="M${R},40 C${R},56 ${R - 3},64 54,67 C${R - 4},60 ${R - 2},52 ${R - 2.5},40 Z" fill="${skinShade}" opacity="0.35"/>`);
  // beard sits under features
  s.push(beard(beardStyle, beardCol, w));
  // brows
  const browY = ey - 5.2;
  s.push(`<path d="M${50 - ex - 3.6},${(browY + 0.4 + browTilt * 0.5).toFixed(2)} Q${50 - ex},${(browY - 1.2).toFixed(2)} ${50 - ex + 3.2},${(browY + 0.2 - browTilt * 0.5).toFixed(2)}" stroke="${shade(hair === GREY ? '#6a6a6e' : hair, -0.1)}" stroke-width="${browW.toFixed(2)}" fill="none" stroke-linecap="round"/>`);
  s.push(`<path d="M${50 + ex + 3.6},${(browY + 0.4 + browTilt * 0.5).toFixed(2)} Q${50 + ex},${(browY - 1.2).toFixed(2)} ${50 + ex - 3.2},${(browY + 0.2 - browTilt * 0.5).toFixed(2)}" stroke="${shade(hair === GREY ? '#6a6a6e' : hair, -0.1)}" stroke-width="${browW.toFixed(2)}" fill="none" stroke-linecap="round"/>`);
  // eyes
  s.push(`<ellipse cx="${50 - ex}" cy="${ey}" rx="${eyeR.toFixed(2)}" ry="${(eyeR * 1.12).toFixed(2)}" fill="#1b1310"/><ellipse cx="${50 + ex}" cy="${ey}" rx="${eyeR.toFixed(2)}" ry="${(eyeR * 1.12).toFixed(2)}" fill="#1b1310"/>`);
  s.push(`<circle cx="${50 - ex + 0.55}" cy="${ey - 0.6}" r="0.5" fill="#fff" opacity="0.85"/><circle cx="${50 + ex + 0.55}" cy="${ey - 0.6}" r="0.5" fill="#fff" opacity="0.85"/>`);
  // nose
  s.push(`<path d="M50.2,${ey + 1} Q48.4,${ey + noseLen * 0.75} 47.6,${ey + noseLen} Q50,${ey + noseLen + 1.4} 52.4,${ey + noseLen}" stroke="${skinDeep}" stroke-width="1.15" fill="none" stroke-linecap="round" opacity="0.8"/>`);
  // mouth
  const my = 59.2 + (noseLen - 7.5) * 0.3;
  s.push(`<path d="M${50 - mw},${my.toFixed(2)} Q50,${(my + smile).toFixed(2)} ${50 + mw},${my.toFixed(2)}" stroke="${shade(skin, -0.45)}" stroke-width="1.35" fill="none" stroke-linecap="round"/>`);
  // front hair
  s.push(`<g transform="${hairT}">${hairFront(style, hair, hairHi)}</g>`);
  s.push('</svg>');
  return s.join('');
}

/** Exposed for the demo / tests: the style list and palettes. */
export const AVATAR_INFO = { skins: SKIN.length, styles: STYLES.slice(), hairColours: HAIR.length + 1 };
