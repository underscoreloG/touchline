// Procedural club crests (SVG strings) and flag helpers.
//
//   makeCrest(rng, colours?)  -> stable descriptor { shape, colours:[c1,c2], emblem, pattern, trim }
//   crestSVG({ shape, colours, emblem, pattern, trim, initials, size }) -> SVG string
//   flagEmoji(code)           -> emoji string from an ISO alpha-2 / FIFA-style alpha-3 code ('' if unknown)
//   flagHTML({ flag, code, colours, cls }) -> <span> with the emoji, or a striped colour badge when the
//                                platform cannot render flag emoji (Windows desktop browsers show letters).
//
// No real club emblems: every emblem is a generic heraldic or abstract shape. No randomness here except via
// the rng passed to makeCrest.

export const CREST_SHAPES = ['shield', 'round', 'diamond', 'pointed', 'hex', 'banner', 'oval', 'octagon', 'french'];
export const CREST_PATTERNS = ['plain', 'halves', 'stripes', 'hoops', 'sash', 'chevron', 'quarters', 'border'];
export const CREST_EMBLEMS = [
  'star', 'tower', 'ship', 'wave', 'bird', 'sword', 'ball', 'crown', 'tree', 'anchor',
  'bolt', 'mountain', 'sun', 'flame', 'key', 'wheel', 'arrow', 'flower',
];
const CREST_PALETTE = [
  '#c8102e', '#0b3d91', '#1f7a3a', '#f2c200', '#111318', '#ffffff', '#6a1b9a', '#e35205',
  '#00a3e0', '#7a1f2b', '#0f5e5a', '#d4af37', '#8a8d91', '#ff4f9a', '#183a2b', '#2b2f8f',
];
const TRIMS = ['#ffffff', '#ffd659', '#14161c'];

// Shape outlines in a 100 x 100 box. `c` = emblem centre, `s` = emblem scale.
const SHAPES = {
  shield: { d: 'M10,8 H90 V44 C90,72 70,88 50,97 C30,88 10,72 10,44 Z', c: [50, 44], s: 1 },
  round: { d: 'M50,5 A45,45 0 1 1 49.9,5 Z', c: [50, 50], s: 1 },
  diamond: { d: 'M50,3 L96,50 L50,97 L4,50 Z', c: [50, 50], s: 0.86 },
  pointed: { d: 'M50,3 L92,20 V58 C92,78 72,90 50,97 C28,90 8,78 8,58 V20 Z', c: [50, 48], s: 1 },
  hex: { d: 'M50,3 L91,26 V74 L50,97 L9,74 V26 Z', c: [50, 50], s: 0.96 },
  banner: { d: 'M12,5 H88 V95 L50,77 L12,95 Z', c: [50, 40], s: 0.96 },
  oval: { d: 'M50,4 C74,4 89,25 89,50 C89,75 74,96 50,96 C26,96 11,75 11,50 C11,25 26,4 50,4 Z', c: [50, 50], s: 0.96 },
  octagon: { d: 'M31,4 H69 L96,31 V69 L69,96 H31 L4,69 V31 Z', c: [50, 50], s: 1 },
  french: { d: 'M9,6 H91 V60 Q91,80 70,84 Q56,86 50,97 Q44,86 30,84 Q9,80 9,60 Z', c: [50, 45], s: 1 },
};

// Emblems drawn in a 40 x 40 box. Each part: [pathData, role] where role is 'f' (main fill) or 'd' (dark detail).
function starPath(cx, cy, ro, ri, n = 5, rot = -Math.PI / 2) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro;
    const a = rot + (i * Math.PI) / n;
    d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(2) + ',' + (cy + r * Math.sin(a)).toFixed(2);
  }
  return d + 'Z';
}
function circ(cx, cy, r) {
  return `M${cx - r},${cy} A${r},${r} 0 1 0 ${cx + r},${cy} A${r},${r} 0 1 0 ${cx - r},${cy} Z`;
}
function gear(cx, cy, ro, ri, teeth) {
  let d = '';
  const n = teeth * 4;
  for (let i = 0; i < n; i++) {
    const r = (i % 4 < 2) ? ro : ri;
    const a = (i * Math.PI * 2) / n;
    d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(2) + ',' + (cy + r * Math.sin(a)).toFixed(2);
  }
  return d + 'Z' + circ(cx, cy, ri * 0.45);
}
const sunRays = (() => {
  let d = circ(20, 20, 8.5);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const p = (r, da) => (20 + r * Math.cos(a + da)).toFixed(2) + ',' + (20 + r * Math.sin(a + da)).toFixed(2);
    d += `M${p(11, -0.16)} L${p(19, 0)} L${p(11, 0.16)} Z`;
  }
  return d;
})();

const EMBLEMS = {
  star: [[starPath(20, 21, 18, 7.4), 'f']],
  tower: [['M7,38 V13 H12 V7 H17 V13 H23 V7 H28 V13 H33 V38 Z M17,38 V29 Q20,24 23,29 V38 Z M18,17 H22 V22 H18 Z', 'f']],
  ship: [['M3,26 H37 L31,35 H9 Z', 'f'], ['M19,3 H21 V26 H19 Z', 'd'], ['M22,5 Q34,13 33,23 H22 Z M18,8 Q8,15 8,23 H18 Z', 'f']],
  wave: [['M1,17 Q7,9 13,17 Q19,25 25,17 Q31,9 39,17 V23 Q31,15 25,23 Q19,31 13,23 Q7,15 1,23 Z M1,29 Q7,21 13,29 Q19,37 25,29 Q31,21 39,29 V35 Q31,27 25,35 Q19,43 13,35 Q7,27 1,35 Z', 'f']],
  bird: [['M2,15 Q13,11 20,21 Q25,8 39,6 Q30,15 27,25 Q23,35 13,37 Q18,29 16,25 Q10,18 2,15 Z', 'f']],
  sword: [['M18.6,2 L21.4,2 L22.4,27 L17.6,27 Z', 'f'], ['M10,26 H30 V30 H10 Z', 'f'], ['M18.4,30 H21.6 V36 H18.4 Z', 'd'], [circ(20, 37.5, 2.3), 'f']],
  ball: [[circ(20, 20, 17), 'f'], [starPath(20, 20, 6.5, 6.5 * 0.81, 5) + 'M20,3 L20,13 M5,14 L13.8,18 M35,14 L26.2,18 M10,34 L16,25.5 M30,34 L24,25.5', 'd']],
  crown: [['M4,30 L5,9 L13,19 L20,5 L27,19 L35,9 L36,30 Z M4,32 H36 V37 H4 Z', 'f'], [circ(20, 25, 2.4), 'd']],
  tree: [[circ(20, 14, 10) + circ(11, 19, 7) + circ(29, 19, 7) + 'M17.5,22 H22.5 V38 H17.5 Z', 'f']],
  anchor: [['M18.2,9 H21.8 V33 H18.2 Z M10,13 H30 V16.5 H10 Z ' + circ(20, 6, 4.2) + ' M3,23 Q5,37 20,37 Q35,37 37,23 L32.5,25.5 Q30,32.5 20,32.5 Q10,32.5 7.5,25.5 Z', 'f'], [circ(20, 6, 2), 'd']],
  bolt: [['M25,1 L7,23 H18 L13,39 L33,15 H22 L29,1 Z', 'f']],
  mountain: [['M1,35 L14,11 L20,19 L27,6 L39,35 Z', 'f'], ['M27,6 L31.5,14.5 L28.5,13 L26,16 L23,13.5 Z M14,11 L17,16.5 L14.5,15.5 L12,17 Z', 'd']],
  sun: [[sunRays, 'f']],
  flame: [['M20,1 Q31,13 28,23 Q34,20 32,13 Q41,26 33,35 Q27,40 20,39 Q8,39 7,28 Q7,20 13,15 Q13,23 18,24 Q12,11 20,1 Z', 'f'], ['M20,22 Q26,29 23,35 Q20,38 17,35 Q14,30 20,22 Z', 'd']],
  key: [[circ(12, 12, 9.5) + 'M18,16 L35,33 L32,36 L29,33 L27,35 L24.5,32.5 L26.5,30.5 L15,19 Z', 'f'], [circ(12, 12, 4), 'd']],
  wheel: [[gear(20, 20, 18, 13.5, 9), 'f']],
  arrow: [['M20,1 L33,15 H24.5 V39 H15.5 V15 H7 Z', 'f']],
  flower: [[circ(20, 10, 7) + circ(29.5, 17, 7) + circ(26, 28.5, 7) + circ(14, 28.5, 7) + circ(10.5, 17, 7), 'f'], [circ(20, 20, 5.5), 'd']],
};

const PATTERN_PARTS = {
  plain: () => '',
  halves: (c2) => `<rect x="50" y="0" width="50" height="100" fill="${c2}"/>`,
  stripes: (c2) => [20, 50, 80].map((x) => `<rect x="${x - 7}" y="0" width="14" height="100" fill="${c2}"/>`).join(''),
  hoops: (c2) => [18, 50, 82].map((y) => `<rect x="0" y="${y - 8}" width="100" height="16" fill="${c2}"/>`).join(''),
  sash: (c2) => `<path d="M-10,20 L20,-10 L110,80 L80,110 Z" fill="${c2}"/>`,
  chevron: (c2) => `<path d="M0,40 L50,72 L100,40 V60 L50,92 L0,60 Z" fill="${c2}"/>`,
  quarters: (c2) => `<rect x="50" y="0" width="50" height="50" fill="${c2}"/><rect x="0" y="50" width="50" height="50" fill="${c2}"/>`,
  border: (c2) => `<path d="M-5,-5 H105 V105 H-5 Z M50,22 A28,28 0 1 0 50.1,22 Z" fill="${c2}" fill-rule="evenodd"/>`,
};

let uid = 0;

/** Lightness 0-1 of a hex colour (perceived). */
export function luma(hex) {
  const h = String(hex || '#888').replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => parseInt(c + c, 16)) : [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2]) / 255;
}

/**
 * Stable crest descriptor. Uses only the rng you pass in.
 * @param {import('../../logic/rng.js').Rng} rng
 * @param {string[]} [colours] [primary, secondary]; picked from a palette when missing
 */
export function makeCrest(rng, colours) {
  let c1 = colours && colours[0];
  let c2 = colours && colours[1];
  if (!c1) c1 = rng.pick(CREST_PALETTE);
  if (!c2 || c2 === c1) {
    const opts = CREST_PALETTE.filter((c) => c !== c1 && Math.abs(luma(c) - luma(c1)) > 0.25);
    c2 = rng.pick(opts.length ? opts : CREST_PALETTE);
  }
  const shape = rng.pick(CREST_SHAPES);
  const pattern = rng.weighted(CREST_PATTERNS, [3, 2, 2, 1.5, 1.5, 1.2, 1, 1.5]);
  const emblem = rng.pick(CREST_EMBLEMS);
  const trim = rng.weighted(TRIMS, [3, 2, 1]);
  return { shape, colours: [c1, c2], emblem, pattern, trim };
}

/**
 * Crest SVG string.
 * @param {{shape?:string, colours?:string[], emblem?:string, pattern?:string, trim?:string, initials?:string, size?:number, title?:string}} o
 */
export function crestSVG(o = {}) {
  const shape = SHAPES[o.shape] || SHAPES.shield;
  const [c1, c2] = (o.colours && o.colours.length) ? [o.colours[0], o.colours[1] || '#ffffff'] : ['#1d2740', '#eef2fb'];
  const trim = o.trim || '#ffffff';
  const pattern = PATTERN_PARTS[o.pattern] ? o.pattern : 'plain';
  const parts = EMBLEMS[o.emblem] || EMBLEMS.star;
  const id = 'crc' + (uid++).toString(36);
  const initials = (o.initials || '').toUpperCase().slice(0, 4);
  // Emblem colour: trim on dark fields, dark ink on light fields, always with a contrasting outline.
  const fieldLuma = pattern === 'plain' ? luma(c1) : (luma(c1) + luma(c2)) / 2;
  const ink = luma(trim) > 0.5 && fieldLuma > 0.72 ? '#14161c' : trim;
  const outline = luma(ink) > 0.5 ? 'rgba(10,12,20,0.75)' : 'rgba(255,255,255,0.85)';
  const detail = luma(ink) > 0.5 ? '#14161c' : '#f4f4f4';
  const [cx, cy0] = shape.c;
  const cy = initials ? cy0 - 6 : cy0;
  const sc = shape.s * (initials ? 0.95 : 1.1);
  const tx = (cx - 20 * sc).toFixed(2);
  const ty = (cy - 20 * sc).toFixed(2);
  const emblem = parts.map(([d, role]) => role === 'f'
    ? `<path d="${d}" fill="${ink}" stroke="${outline}" stroke-width="2.6" paint-order="stroke" stroke-linejoin="round" fill-rule="evenodd"/>`
    : `<path d="${d}" fill="${detail}" stroke="${detail}" stroke-width="1.6" stroke-linejoin="round" fill-rule="evenodd"/>`).join('');
  const ribbon = initials
    ? `<g><path d="M14,${cy0 + 18} H86 L82,${cy0 + 25} L86,${cy0 + 32} H14 L18,${cy0 + 25} Z" fill="${trim === '#14161c' ? '#14161c' : '#0d1220'}" stroke="${trim}" stroke-width="1.5"/>`
      + `<text x="50" y="${cy0 + 28.6}" text-anchor="middle" font-family="Arial Narrow, Arial, sans-serif" font-weight="700" font-size="${initials.length > 3 ? 9 : 10.5}" letter-spacing="1.2" fill="#ffffff">${initials}</text></g>`
    : '';
  const size = o.size ? ` width="${o.size}" height="${o.size}"` : ' width="100%" height="100%"';
  const title = o.title ? `<title>${String(o.title).replace(/[<&>]/g, '')}</title>` : '';
  return `<svg class="crest" viewBox="0 0 100 100"${size} xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="${o.title ? 'false' : 'true'}">${title}`
    + `<defs><clipPath id="${id}"><path d="${shape.d}"/></clipPath></defs>`
    + `<path d="${shape.d}" fill="${c1}"/>`
    + `<g clip-path="url(#${id})">${PATTERN_PARTS[pattern](c2)}`
    + `<path d="M0,0 H100 V48 Q50,38 0,52 Z" fill="#ffffff" opacity="0.10"/></g>`
    + `<path d="${shape.d}" fill="none" stroke="${trim}" stroke-width="5" stroke-linejoin="round"/>`
    + `<path d="${shape.d}" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="1" transform="translate(50 50) scale(0.88) translate(-50 -50)"/>`
    + `<g transform="translate(${tx} ${ty}) scale(${sc.toFixed(3)})">${emblem}</g>`
    + ribbon + '</svg>';
}

// ------------------------------------------------------------------ flags

const A3_TO_A2 = {
  FRA: 'FR', ESP: 'ES', ITA: 'IT', GER: 'DE', DEU: 'DE', POR: 'PT', PRT: 'PT', NED: 'NL', NLD: 'NL', BEL: 'BE',
  SUI: 'CH', CHE: 'CH', AUT: 'AT', DEN: 'DK', DNK: 'DK', SWE: 'SE', NOR: 'NO', FIN: 'FI', ISL: 'IS', IRL: 'IE',
  POL: 'PL', CZE: 'CZ', SVK: 'SK', HUN: 'HU', ROU: 'RO', BUL: 'BG', BGR: 'BG', GRE: 'GR', GRC: 'GR', TUR: 'TR',
  CRO: 'HR', HRV: 'HR', SRB: 'RS', SVN: 'SI', BIH: 'BA', ALB: 'AL', UKR: 'UA', RUS: 'RU', GEO: 'GE', ARM: 'AM',
  BRA: 'BR', ARG: 'AR', URU: 'UY', URY: 'UY', COL: 'CO', CHI: 'CL', CHL: 'CL', PER: 'PE', ECU: 'EC', PAR: 'PY',
  PRY: 'PY', VEN: 'VE', BOL: 'BO', MEX: 'MX', USA: 'US', CAN: 'CA', CRC: 'CR', CRI: 'CR', PAN: 'PA', JAM: 'JM',
  HON: 'HN', HND: 'HN', SEN: 'SN', CIV: 'CI', GHA: 'GH', NGA: 'NG', CMR: 'CM', MLI: 'ML', MAR: 'MA', ALG: 'DZ',
  DZA: 'DZ', TUN: 'TN', EGY: 'EG', RSA: 'ZA', ZAF: 'ZA', BFA: 'BF', GUI: 'GN', GIN: 'GN', COD: 'CD', JPN: 'JP',
  KOR: 'KR', CHN: 'CN', AUS: 'AU', NZL: 'NZ', IRN: 'IR', KSA: 'SA', SAU: 'SA', QAT: 'QA', UAE: 'AE', ARE: 'AE',
  IRQ: 'IQ', JOR: 'JO', IND: 'IN', IDN: 'ID', THA: 'TH', VIE: 'VN', VNM: 'VN', UZB: 'UZ', ISR: 'IL', CPV: 'CV',
};
const SUBDIVISION = { ENG: 'gbeng', SCO: 'gbsct', WAL: 'gbwls' };

/** Emoji flag from a 2- or 3-letter code. Prefer the emoji string from nations.js when you have it. */
export function flagEmoji(code) {
  if (!code) return '';
  const c = String(code).toUpperCase();
  if (SUBDIVISION[c]) {
    return '\u{1F3F4}' + [...SUBDIVISION[c]].map((ch) => String.fromCodePoint(0xE0000 + ch.charCodeAt(0))).join('') + '\u{E007F}';
  }
  const a2 = c.length === 2 ? c : A3_TO_A2[c];
  if (!a2) return '';
  return String.fromCodePoint(...[...a2].map((ch) => 0x1F1E6 + ch.charCodeAt(0) - 65));
}

let flagSupport = null;
/** True when the platform draws regional-indicator pairs as colour flags (false on most Windows desktops). */
export function supportsFlagEmoji() {
  if (flagSupport !== null) return flagSupport;
  flagSupport = false;
  try {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 32;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#000';
    g.textBaseline = 'top';
    g.font = '28px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    g.fillText('\u{1F1EB}\u{1F1F7}', 0, 0);
    const px = g.getImageData(0, 0, 32, 32).data;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] > 100 && (Math.abs(px[i] - px[i + 2]) > 60 || Math.abs(px[i + 1] - px[i + 2]) > 60)) { flagSupport = true; break; }
    }
  } catch (e) { flagSupport = false; }
  return flagSupport;
}

/**
 * Flag markup. Uses the emoji when the platform can draw it, otherwise a small striped badge in the
 * nation colours with the code on top, so the flag never degrades into two loose letters.
 * @param {{flag?:string, code?:string, colours?:string[], cls?:string, label?:boolean}} o
 */
export function flagHTML(o = {}) {
  const cls = 'flag ' + (o.cls || '');
  const code = String(o.code || '').toUpperCase().slice(0, 3);
  const emoji = o.flag || flagEmoji(code);
  if (emoji && supportsFlagEmoji()) return `<span class="${cls} flag-emoji" role="img" aria-label="${code}">${emoji}</span>`;
  const cols = (o.colours && o.colours.length ? o.colours : ['#3a4566', '#69779c']).slice(0, 3);
  const w = 100 / cols.length;
  const stripes = cols.map((c, i) => `<rect x="${(i * w).toFixed(2)}" y="0" width="${(w + 0.5).toFixed(2)}" height="66" fill="${c}"/>`).join('');
  const txt = o.label === false ? '' : `<text x="50" y="44" text-anchor="middle" font-family="Arial Narrow, Arial, sans-serif" font-weight="800" font-size="30" fill="#fff" stroke="rgba(0,0,0,.65)" stroke-width="5" paint-order="stroke">${code}</text>`;
  return `<span class="${cls} flag-badge" role="img" aria-label="${code}"><svg viewBox="0 0 100 66" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${stripes}`
    + `<rect x="1" y="1" width="98" height="64" rx="7" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="2"/>${txt}</svg></span>`;
}
