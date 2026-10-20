// Real nations used by the game. Pure data plus tiny helpers, no DOM, no randomness.
// code: 3-letter id used everywhere (nation of a player, national team id, league country).
// tier: 1 = strongest football nation ... 5 = weakest. Sets population share and quality.
// culture: key into CULTURES (names.js). clubNameStyle: key into the background club styles (names.js).
// Order of NATIONS is STABLE (saves may store nation indices). Only ever append.

/** @typedef {'EU'|'SA'|'NA'|'AF'|'AS'|'OC'} Continent */
/**
 * @typedef {Object} Nation
 * @property {string} code            3-letter code, e.g. "FRA"
 * @property {string} name
 * @property {string} iso2            used to build the emoji flag
 * @property {string} flag            emoji flag string
 * @property {Continent} continent
 * @property {1|2|3|4|5} tier
 * @property {[string,string]} colours  [primary, secondary] hex of the national kit
 * @property {string} culture         name culture id (names.js)
 * @property {string} clubNameStyle   background club name style (names.js)
 * @property {boolean} playable       true for the 5 playable championships
 */

function regionalFlag(iso2) {
  const cps = [];
  for (const ch of iso2.toUpperCase()) cps.push(0x1f1e6 + ch.charCodeAt(0) - 65);
  return String.fromCodePoint(...cps);
}

/** Subdivision flags (England, Scotland, Wales) are tag sequences: black flag + tag letters + cancel tag. */
function subdivisionFlag(tag) {
  const cps = [0x1f3f4];
  for (const ch of tag) cps.push(0xe0000 + ch.charCodeAt(0));
  cps.push(0xe007f);
  return String.fromCodePoint(...cps);
}

const SUBDIVISION_TAGS = { 'gb-eng': 'gbeng', 'gb-sct': 'gbsct', 'gb-wls': 'gbwls' };

function flagFor(iso2) {
  return SUBDIVISION_TAGS[iso2] ? subdivisionFlag(SUBDIVISION_TAGS[iso2]) : regionalFlag(iso2);
}

// [code, name, iso2, continent, tier, primary, secondary, culture, clubNameStyle]
const ROWS = [
  // ---- tier 1 (8)
  ['FRA', 'France', 'fr', 'EU', 1, '#1b3f94', '#ffffff', 'french', 'french'],
  ['ENG', 'England', 'gb-eng', 'EU', 1, '#f4f4f4', '#c8102e', 'english', 'english'],
  ['BRA', 'Brazil', 'br', 'SA', 1, '#f7d117', '#0b8f3c', 'portuguese-brazilian', 'portuguese'],
  ['ARG', 'Argentina', 'ar', 'SA', 1, '#75aadb', '#ffffff', 'latin-american', 'latin'],
  ['ESP', 'Spain', 'es', 'EU', 1, '#c8102e', '#f1bf00', 'spanish-iberian', 'iberian'],
  ['GER', 'Germany', 'de', 'EU', 1, '#f4f4f4', '#1c1c1c', 'german', 'german'],
  ['ITA', 'Italy', 'it', 'EU', 1, '#0a5fb4', '#ffffff', 'italian', 'italian'],
  ['POR', 'Portugal', 'pt', 'EU', 1, '#a1122f', '#0b6b3a', 'portuguese-brazilian', 'portuguese'],
  // ---- tier 2 (12)
  ['NED', 'Netherlands', 'nl', 'EU', 2, '#f26b1d', '#1b2a6b', 'dutch-flemish', 'dutch'],
  ['BEL', 'Belgium', 'be', 'EU', 2, '#c8102e', '#f6d100', 'dutch-flemish', 'dutch'],
  ['CRO', 'Croatia', 'hr', 'EU', 2, '#e8e8e8', '#d7263d', 'slavic-south', 'southslavic'],
  ['URU', 'Uruguay', 'uy', 'SA', 2, '#5eb6e4', '#1c1c1c', 'latin-american', 'latin'],
  ['COL', 'Colombia', 'co', 'SA', 2, '#f9d71c', '#1d3f8f', 'latin-american', 'latin'],
  ['DEN', 'Denmark', 'dk', 'EU', 2, '#c8102e', '#ffffff', 'scandinavian', 'nordic'],
  ['SUI', 'Switzerland', 'ch', 'EU', 2, '#d52b1e', '#ffffff', 'german', 'german'],
  ['MAR', 'Morocco', 'ma', 'AF', 2, '#b3202a', '#0a6b3c', 'arabic-maghreb', 'arabic'],
  ['SEN', 'Senegal', 'sn', 'AF', 2, '#f4f4f4', '#00853f', 'west-african-franco', 'franco-african'],
  ['USA', 'United States', 'us', 'NA', 2, '#f4f4f4', '#1d2d6b', 'anglo-oceanian-american', 'american'],
  ['MEX', 'Mexico', 'mx', 'NA', 2, '#0b6b3a', '#c8102e', 'latin-american', 'latin'],
  ['JPN', 'Japan', 'jp', 'AS', 2, '#1c3d99', '#ffffff', 'japanese', 'japanese'],
  // ---- tier 3 (17)
  ['SRB', 'Serbia', 'rs', 'EU', 3, '#c6363c', '#1f2f6b', 'slavic-south', 'southslavic'],
  ['POL', 'Poland', 'pl', 'EU', 3, '#f4f4f4', '#dc143c', 'slavic-west', 'westslavic'],
  ['SWE', 'Sweden', 'se', 'EU', 3, '#f6cc00', '#1f5aa6', 'scandinavian', 'nordic'],
  ['AUT', 'Austria', 'at', 'EU', 3, '#d11a2a', '#ffffff', 'german', 'german'],
  ['TUR', 'Turkey', 'tr', 'EU', 3, '#e30a17', '#ffffff', 'turkish', 'turkish'],
  ['NOR', 'Norway', 'no', 'EU', 3, '#c8102e', '#1c2e6b', 'scandinavian', 'nordic'],
  ['CZE', 'Czechia', 'cz', 'EU', 3, '#d7141a', '#11457e', 'slavic-west', 'czechoslovak'],
  ['UKR', 'Ukraine', 'ua', 'EU', 3, '#f4d000', '#0057b8', 'slavic-east', 'eastslavic'],
  ['SCO', 'Scotland', 'gb-sct', 'EU', 3, '#13306b', '#ffffff', 'celtic', 'celtic'],
  ['CHI', 'Chile', 'cl', 'SA', 3, '#d52b1e', '#0039a6', 'latin-american', 'latin'],
  ['ECU', 'Ecuador', 'ec', 'SA', 3, '#f9d71c', '#0b3d91', 'latin-american', 'latin'],
  ['NGA', 'Nigeria', 'ng', 'AF', 3, '#0b8f3c', '#f4f4f4', 'west-african-anglo', 'anglo-african'],
  ['EGY', 'Egypt', 'eg', 'AF', 3, '#c8102e', '#1c1c1c', 'arabic-gulf', 'arabic'],
  ['CIV', 'Ivory Coast', 'ci', 'AF', 3, '#f77f00', '#009e60', 'west-african-franco', 'franco-african'],
  ['KOR', 'South Korea', 'kr', 'AS', 3, '#c8102e', '#f4f4f4', 'korean', 'korean'],
  ['ALG', 'Algeria', 'dz', 'AF', 3, '#f4f4f4', '#0a8f48', 'arabic-maghreb', 'arabic'],
  ['AUS', 'Australia', 'au', 'OC', 3, '#f6c500', '#0b5a35', 'anglo-oceanian-american', 'american'],
  // ---- tier 4 (17)
  ['WAL', 'Wales', 'gb-wls', 'EU', 4, '#c8102e', '#ffffff', 'celtic', 'celtic'],
  ['IRL', 'Republic of Ireland', 'ie', 'EU', 4, '#169b62', '#ffffff', 'celtic', 'celtic'],
  ['GRE', 'Greece', 'gr', 'EU', 4, '#0d5eaf', '#ffffff', 'greek', 'greek'],
  ['ROU', 'Romania', 'ro', 'EU', 4, '#fcd116', '#002b7f', 'romanian', 'romanian'],
  ['HUN', 'Hungary', 'hu', 'EU', 4, '#c8102e', '#2f6b3a', 'hungarian', 'magyar'],
  ['RUS', 'Russia', 'ru', 'EU', 4, '#c8102e', '#ffffff', 'slavic-east', 'eastslavic'],
  ['IRN', 'Iran', 'ir', 'AS', 4, '#f4f4f4', '#239f40', 'persian', 'persian'],
  ['CAN', 'Canada', 'ca', 'NA', 4, '#d52b1e', '#ffffff', 'anglo-oceanian-american', 'american'],
  ['PAR', 'Paraguay', 'py', 'SA', 4, '#d52b1e', '#ffffff', 'latin-american', 'latin'],
  ['PER', 'Peru', 'pe', 'SA', 4, '#f4f4f4', '#d91023', 'latin-american', 'latin'],
  ['GHA', 'Ghana', 'gh', 'AF', 4, '#f4f4f4', '#006b3f', 'west-african-anglo', 'anglo-african'],
  ['CMR', 'Cameroon', 'cm', 'AF', 4, '#007a5e', '#fcd116', 'west-african-franco', 'franco-african'],
  ['TUN', 'Tunisia', 'tn', 'AF', 4, '#e70013', '#ffffff', 'arabic-maghreb', 'arabic'],
  ['MLI', 'Mali', 'ml', 'AF', 4, '#f9d71c', '#14b53a', 'west-african-franco', 'franco-african'],
  ['SVK', 'Slovakia', 'sk', 'EU', 4, '#2a4fa3', '#ffffff', 'slavic-west', 'czechoslovak'],
  ['BIH', 'Bosnia and Herzegovina', 'ba', 'EU', 4, '#1d4f9c', '#f6d100', 'slavic-south', 'southslavic'],
  ['KSA', 'Saudi Arabia', 'sa', 'AS', 4, '#0a7a3d', '#ffffff', 'arabic-gulf', 'arabic'],
  // ---- tier 5 (11)
  ['BOL', 'Bolivia', 'bo', 'SA', 5, '#0b8f3c', '#d52b1e', 'latin-american', 'latin'],
  ['NIR', 'Northern Ireland', 'gb', 'EU', 5, '#0b6b3a', '#ffffff', 'celtic', 'celtic'],
  ['ALB', 'Albania', 'al', 'EU', 5, '#c8102e', '#1c1c1c', 'balkan', 'balkan'],
  ['JAM', 'Jamaica', 'jm', 'NA', 5, '#f6d100', '#0a6b3a', 'anglo-oceanian-american', 'american'],
  ['QAT', 'Qatar', 'qa', 'AS', 5, '#8a1538', '#ffffff', 'arabic-gulf', 'arabic'],
  ['CHN', 'China', 'cn', 'AS', 5, '#d7141a', '#f6d100', 'chinese', 'chinese'],
  ['NZL', 'New Zealand', 'nz', 'OC', 5, '#f4f4f4', '#1c1c1c', 'anglo-oceanian-american', 'american'],
  ['VEN', 'Venezuela', 've', 'SA', 5, '#7a1a2e', '#f6c500', 'latin-american', 'latin'],
  ['CRC', 'Costa Rica', 'cr', 'NA', 5, '#d52b1e', '#1f3f8f', 'latin-american', 'latin'],
  ['RSA', 'South Africa', 'za', 'AF', 5, '#f6c500', '#0b6b3a', 'east-southern-african', 'anglo-african'],
  ['SVN', 'Slovenia', 'si', 'EU', 5, '#f4f4f4', '#1f6fb5', 'slavic-south', 'southslavic'],
];

/** The 5 playable championship countries, in menu order. */
export const PLAYABLE_COUNTRIES = ['ENG', 'ESP', 'ITA', 'GER', 'FRA'];

/** @type {Nation[]} */
export const NATIONS = ROWS.map(([code, name, iso2, continent, tier, c1, c2, culture, clubNameStyle]) => ({
  code,
  name,
  iso2,
  // Northern Ireland has no emoji flag of its own: it uses the United Kingdom flag.
  flag: flagFor(iso2),
  continent,
  tier,
  colours: [c1, c2],
  culture,
  clubNameStyle,
  playable: PLAYABLE_COUNTRIES.includes(code),
}));

/** @type {Object<string, Nation>} */
export const NATION_BY_CODE = Object.fromEntries(NATIONS.map((n) => [n.code, n]));

/** @param {string} code @returns {Nation|undefined} */
export function nationByCode(code) {
  return NATION_BY_CODE[code];
}

/** Emoji flag for a nation code (empty string if unknown). */
export function flagOf(code) {
  const n = NATION_BY_CODE[code];
  return n ? n.flag : '';
}

/** Index of a nation in NATIONS (stable), or -1. */
export const NATION_INDEX = Object.fromEntries(NATIONS.map((n, i) => [n.code, i]));

/** All nations of a given tier. */
export function nationsOfTier(tier) {
  return NATIONS.filter((n) => n.tier === tier);
}
