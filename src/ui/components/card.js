// Card component: every card type, three sizes, rarity frames, holographic foil, tilt, in-place updates.
//
// ============================================================================ VIEW MODEL (flat, built by caller)
// The caller (screen code) builds a flat object. This module never reads game state and never rolls anything.
//
// Common fields (all kinds)
//   kind        'player'|'manager'|'staff'|'training'|'trait'|'style'|'tactic'|'consumable'|'club'|'position'
//   rarity      'bronze'|'silver'|'gold'|'elite'|'icon'. Training-pack tiers are accepted too and mapped:
//               'common' -> bronze, 'rare' -> gold, 'epic' -> elite.
//   id          optional, copied to data-id
//   title       display title for non-player cards (e.g. "Fitness coach", "+3 Pace", "Ball winner")
//   text        one or two short lines of rules text for non-player cards
//   value       optional big value line for non-player cards (e.g. "+3 PAC", "4-3-3", "x2")
//   icon        optional icon id override (see ICON_IDS export)
//
// Player (kind 'player')
//   ovr         number, effective OVR to show
//   pos         position PLAYED / shown ('GK','CB','FB','DM','CM','AM','W','ST')
//   altPos      optional string[] secondary positions (full card shows them small)
//   name        full display name; shortName optional (mini card shows shortName or last word of name)
//   nation      nation code (e.g. 'FRA'); flag = emoji string from nations.js; nationColours optional [hex..]
//               (used for the flag fallback badge on platforms without flag emoji)
//   nationName  optional, shown during the walkout
//   crest       crest descriptor (makeCrest / crestSVG input); clubName string; clubInitials optional
//   age         number
//   stats       { pac, sho, pas, dri, def, phy, men } or GK keys { div, han, kic, ref, spd, pos, men }, in display order
//   statDeltas  optional { pac:+2, def:-3, ... } shown as small green / red deltas next to the stat
//   ovrDelta    optional number shown next to OVR (e.g. live drag preview)
//   avatarSeed  number|string, kitColour / kitColour2 optional hex
//   traits      optional string[] display labels (max 2 shown)
//   styleLabel  optional string, equipped style card label
//   status      optional { fitness:0-100, injured:bool|number, suspended:bool|number, contractLow:bool,
//                         outOfPos:0|1|2 (or bool), chem:0-3 }
//   upgradesUsed, upgradeSlots  optional numbers (pips on the full card)
//   isIcon      optional bool (implied by rarity 'icon')
//
// Manager:   name, nation, flag, avatarSeed, value (formation), styleLabel (tactical style), text (perk + chem bonus)
// Staff:     role ('fitness'|'physio'|'scout'|'gk'|'setPiece'|'youth'|'analyst'), title, level 1-3, text, name optional
// Others:    title, value, text, icon optional (consumable icons: 'fitnessDrink','heal','contract','morale';
//            club icons: 'stadium','kit','crest','facility'; club cards may pass `crest` to draw the crest itself)
//
// ============================================================================ API
//   cardEl(data, opts?) -> HTMLElement      opts: { size:'full'|'mini'|'thumb', width:px, t:strings, tilt:bool, animLevel }
//   updateCard(el, data, opts?)             patch in place, numbers tick up/down with GSAP
//   attachTilt(el, opts?) -> detach()       opts: { animLevel:0|1|2, respectReducedMotion=true } ; no-op on bronze / silver,
//                                           animLevel 0, or prefers-reduced-motion (unless respectReducedMotion:false,
//                                           for when the player explicitly picked an animation level in settings)
//   setTilt(el, px, py, strength?)          pose a card's foil / tilt directly (px, py in 0..1), for demos and sweeps
//   promoteCard(el, fromRarity, toRarity, opts?) -> gsap timeline   opts: { respectReducedMotion }
//   cardBack(opts?) -> HTMLElement          opts: { size, width, packType, t }
//   countTo(node, to, opts?)                animated integer tick-up used across the UI
//   CARD_STRINGS                            defaults (strings.js S.card); pass `opts.t` (same shape) to override
//
// GSAP is a global (inlined by tools/build.js). Everything degrades to instant updates when it is missing.

import { STAT_LABELS, RARITIES } from '../../balance.js';
import { S } from '../../strings.js';
import { avatarSVG } from './avatar.js';
import { crestSVG, flagHTML } from './crest.js';

/** Default strings: the shared table in strings.js (S.card). `opts.t` (same shape) overrides single entries. */
export const CARD_STRINGS = S.card;

const RARITY_ALIAS = { common: 'bronze', rare: 'gold', epic: 'elite' };
export const normRarity = (r) => (RARITIES.includes(r) ? r : RARITY_ALIAS[r] || 'bronze');
const FOIL = { gold: true, elite: true, icon: true };
const SIZES = { full: 220, mini: 88, thumb: 62 };

// ---------------------------------------------------------------- frame silhouettes (140 x 200 box)
export const SHAPES = {
  // player cards: one silhouette per rarity (readable at thumbnail size)
  bronze: 'M14,0 H126 L140,14 V186 L126,200 H14 L0,186 V14 Z',
  silver: 'M16,0 H56 L70,12 L84,0 H124 Q140,0 140,16 V184 Q140,200 124,200 H16 Q0,200 0,184 V16 Q0,0 16,0 Z',
  gold: 'M0,12 Q0,0 12,0 Q42,12 70,12 Q98,12 128,0 Q140,0 140,12 V168 L70,200 L0,168 Z',
  elite: 'M0,24 L70,0 L140,24 V82 L131,92 L140,102 V172 L70,200 L0,172 V102 L9,92 L0,82 Z',
  icon: 'M0,28 L22,4 L44,22 L70,0 L96,22 L118,4 L140,28 V176 Q140,200 116,200 H24 Q0,200 0,176 Z',
  // other kinds: one silhouette per kind
  manager: 'M0,70 A70,70 0 0 1 140,70 V190 Q140,200 130,200 H10 Q0,200 0,190 Z',
  staff: 'M12,0 H128 Q140,0 140,12 V188 Q140,200 128,200 H12 Q0,200 0,188 V12 Q0,0 12,0 Z M56,9 H84 A4.5,4.5 0 0 1 84,18 H56 A4.5,4.5 0 0 1 56,9 Z',
  training: 'M18,0 H122 A18,18 0 0 0 140,18 V182 A18,18 0 0 0 122,200 H18 A18,18 0 0 0 0,182 V18 A18,18 0 0 0 18,0 Z',
  trait: 'M10,0 H130 Q140,0 140,10 V86 A14,14 0 0 0 140,114 V190 Q140,200 130,200 H10 Q0,200 0,190 V114 A14,14 0 0 0 0,86 V10 Q0,0 10,0 Z',
  style: 'M0,22 Q0,14 8,13 L132,0 Q140,0 140,8 V178 Q140,186 132,187 L8,200 Q0,200 0,192 Z',
  tactic: 'M8,12 H48 V5 Q48,0 53,0 H87 Q92,0 92,5 V12 H132 Q140,12 140,20 V192 Q140,200 132,200 H8 Q0,200 0,192 V20 Q0,12 8,12 Z',
  consumable: 'M34,0 H106 A34,34 0 0 1 140,34 V166 A34,34 0 0 1 106,200 H34 A34,34 0 0 1 0,166 V34 A34,34 0 0 1 34,0 Z',
  club: 'M0,8 Q0,0 8,0 H132 Q140,0 140,8 V200 L70,176 L0,200 Z',
  position: 'M14,0 H126 V14 H140 V186 H126 V200 H14 V186 H0 V14 H14 Z',
  back: 'M14,0 H126 Q140,0 140,14 V186 Q140,200 126,200 H14 Q0,200 0,186 V14 Q0,0 14,0 Z',
};
const maskCache = {};
function maskUrl(key) {
  if (!maskCache[key]) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 140 200' preserveAspectRatio='none'><path d='${SHAPES[key]}' fill='black' fill-rule='evenodd'/></svg>`;
    maskCache[key] = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }
  return maskCache[key];
}

// ---------------------------------------------------------------- icons (24 x 24, stroke = currentColor)
const P = (d, extra = '') => `<path d="${d}" ${extra}/>`;
const ICONS = {
  manager: P('M4 20c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5') + '<circle cx="12" cy="7.5" r="3.6"/>' + P('M9.5 13.8 12 17l2.5-3.2'),
  staff: '<rect x="4" y="3.5" width="16" height="17" rx="2.5"/>' + '<circle cx="12" cy="10" r="2.8"/>' + P('M8 17c.8-2 2.2-3 4-3s3.2 1 4 3'),
  fitness: P('M2.5 12h3M18.5 12h3M5.5 8v8M18.5 8v8M8 6.5v11M16 6.5v11M8 12h8'),
  physio: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/>' + P('M12 7.5v9M7.5 12h9', 'stroke-width="2.6"'),
  scout: '<circle cx="7" cy="14.5" r="4"/><circle cx="17" cy="14.5" r="4"/>' + P('M11 14h2M5 10.5 7.5 5h2l1 4M19 10.5 16.5 5h-2l-1 4'),
  gk: P('M7 21v-5L4.5 11.5a1.5 1.5 0 0 1 2.6-1.5L9 13V5a1.5 1.5 0 0 1 3 0v6V4a1.5 1.5 0 0 1 3 0v7V5.5a1.5 1.5 0 0 1 3 0V15c0 3-2 6-5 6Z'),
  setPiece: P('M5 21V3.5M5 4h11l-3 4 3 4H5') + '<circle cx="17.5" cy="18.5" r="2.5"/>',
  youth: P('M12 21v-9M12 12c0-4 3-6.5 7-6.5 0 4-3 6.5-7 6.5ZM12 15c0-3-2.4-5-5.5-5 0 3 2.4 5 5.5 5Z'),
  analyst: P('M4 20h16M7 16v-4M11 16V8M15 16v-6M19 16V5'),
  training: P('M5 19 19 5M19 5h-7M19 5v7') + P('M4 13v6h6'),
  trait: P('M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9Z'),
  style: '<circle cx="14" cy="4.5" r="2"/>' + P('M7 21l3-6 3 2v4M13 17l-1-6 3-3 3 4h3M12 11l-4 1-2 3'),
  tactic: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/>' + P('M7 7l3 3M10 7l-3 3M15.5 15.5a1.8 1.8 0 1 0 0 .1M8.5 16c2-4 5-6 8.5-7M14 8.5h3v3'),
  consumable: '<rect x="7" y="7" width="10" height="14" rx="3"/>' + P('M9 7V4.5h6V7M10 13h4M12 11v4'),
  fitnessDrink: '<rect x="7" y="7" width="10" height="14" rx="3"/>' + P('M9 7V4.5h6V7M12.6 10.5l-2.4 3.7h3.4l-2.2 3.6'),
  heal: P('M8 3.5h8v5h5v8h-5v5H8v-5H3v-8h5Z'),
  contract: P('M6 3.5h8l4 4v13H6Z M14 3.5v4h4M9 12.5h6M9 16h4'),
  morale: P('M4 10v4h3l7 5V5l-7 5Z M17.5 9a4 4 0 0 1 0 6M19.8 6.5a7.5 7.5 0 0 1 0 11'),
  club: P('M12 3 4.5 6v6c0 4.5 3.2 7.6 7.5 9 4.3-1.4 7.5-4.5 7.5-9V6Z'),
  stadium: P('M3 9c0-2 4-3.5 9-3.5S21 7 21 9v7c0 2-4 3.5-9 3.5S3 18 3 16Z M3 9c0 2 4 3.5 9 3.5S21 11 21 9M8 12.2v6.8M16 12.2v6.8'),
  kit: P('M8.5 3.5 4 6l-1.5 4.5 3 1.2V20.5h13v-8.8l3-1.2L20 6l-4.5-2.5c-.5 1.5-1.8 2.4-3.5 2.4S9 5 8.5 3.5Z'),
  crest: P('M12 3 4.5 6v6c0 4.5 3.2 7.6 7.5 9 4.3-1.4 7.5-4.5 7.5-9V6Z M12 8l1.3 2.7 3 .4-2.2 2 .6 3-2.7-1.4-2.7 1.4.6-3-2.2-2 3-.4Z'),
  facility: P('M3 20.5h18M5 20.5V10l7-5 7 5v10.5M9.5 20.5v-5h5v5M8 11h2M14 11h2'),
  position: P('M7 4 3.5 7.5 7 11M3.5 7.5h11M17 13l3.5 3.5L17 20M20.5 16.5h-11'),
  injury: P('M12 6v12M6 12h12', 'stroke-width="3.4"'),
  warning: P('M12 3.5 2.5 20h19Z M12 10v4.5', 'stroke-width="2.2"') + '<circle cx="12" cy="17.3" r=".9" fill="currentColor"/>',
  star: P('M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9Z', 'fill="currentColor"'),
};
export const ICON_IDS = Object.keys(ICONS);
export function iconSVG(id, cls = '') {
  const body = ICONS[id] || ICONS.star;
  return `<svg class="tc-ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

// ---------------------------------------------------------------- helpers
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const G = () => (typeof window !== 'undefined' ? window.gsap : undefined);
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const strings = (t) => (t ? { ...CARD_STRINGS, ...t, kind: { ...CARD_STRINGS.kind, ...(t.kind || {}) }, rarity: { ...CARD_STRINGS.rarity, ...(t.rarity || {}) }, staffRole: { ...CARD_STRINGS.staffRole, ...(t.staffRole || {}) }, status: { ...CARD_STRINGS.status, ...(t.status || {}) } } : CARD_STRINGS);
/** Full-card name: long names become "A. Surname" before CSS ever has to ellipsize. */
const fitName = (n) => {
  const s = String(n || '').trim();
  if (s.length <= 15) return s;
  const parts = s.split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : s;
};
const nameCls = (n) => { const l = fitName(n).length; return l > 15 ? ' tc-name-xl' : l > 12 ? ' tc-name-l' : ''; };
const shortName = (d) => d.shortName || String(d.name || '').trim().split(/\s+/).slice(-1)[0] || '';
const shapeKey = (d) => (d.kind === 'player' || !d.kind ? normRarity(d.rarity) : d.kind);

/** Frame overlay: rarity metal stroke, inner hairline, ornaments. */
function frameSVG(d, size) {
  const key = shapeKey(d);
  const r = normRarity(d.rarity);
  const path = SHAPES[key];
  const sw = size === 'thumb' ? 11 : size === 'mini' ? 9 : 7;
  let orn = '';
  if (d.kind === 'player' || !d.kind) {
    if (r === 'gold') orn = '<circle cx="12" cy="13" r="3" class="tc-orn"/><circle cx="128" cy="13" r="3" class="tc-orn"/><path d="M65,191 L70,186 L75,191 L70,196 Z" class="tc-orn"/>';
    if (r === 'elite') orn = '<path d="M70,4 L76,13 L70,22 L64,13 Z" class="tc-orn"/><path d="M4,92 L12,86 L12,98 Z M136,92 L128,86 L128,98 Z" class="tc-orn"/><path d="M70,196 L65,188 L75,188 Z" class="tc-orn"/>';
    if (r === 'icon') orn = '<circle cx="70" cy="7" r="4.5" class="tc-orn"/><circle cx="22" cy="10" r="3" class="tc-orn"/><circle cx="118" cy="10" r="3" class="tc-orn"/><path d="M58,192 H82" class="tc-orn-line"/>';
    if (r === 'silver') orn = '<path d="M64,16 L70,22 L76,16" class="tc-orn-line"/>';
  }
  const inner = size === 'thumb' ? '' : `<path d="${path}" class="tc-frame-inner" transform="translate(70 100) scale(0.93 0.95) translate(-70 -100)" fill-rule="evenodd"/>`;
  return `<svg class="tc-frame" viewBox="0 0 140 200" preserveAspectRatio="none" aria-hidden="true">`
    + `<path d="${path}" class="tc-frame-outer" style="stroke-width:${sw}" fill-rule="evenodd"/>${inner}${orn}</svg>`;
}

function flagFor(d, cls) { return flagHTML({ flag: d.flag, code: d.nation, colours: d.nationColours, cls }); }

function statusIcons(st, T) {
  if (!st) return '';
  let s = '';
  if (st.injured) s += `<span class="tc-st tc-st-inj" title="${esc(T.status.injured)}">${iconSVG('injury')}</span>`;
  if (st.suspended) s += `<span class="tc-st tc-st-sus" title="${esc(T.status.suspended)}"><i></i></span>`;
  if (st.contractLow) s += `<span class="tc-st tc-st-con" title="${esc(T.status.contractLow)}">${iconSVG('contract')}</span>`;
  const oop = st.outOfPos === true ? 1 : (st.outOfPos | 0);
  if (oop) s += `<span class="tc-st tc-st-oop tc-oop-${oop}" title="${esc(T.status.outOfPos)}">${iconSVG('warning')}</span>`;
  return s;
}
function chemPips(st, T) {
  if (!st || st.chem == null) return '';
  const c = Math.max(0, Math.min(3, st.chem | 0));
  return `<span class="tc-chem" data-f="chem" title="${esc(T.status.chem)} ${c}/3">${[0, 1, 2].map((i) => `<i class="${i < c ? 'on' : ''}"></i>`).join('')}</span>`;
}
function fitnessBar(st, T) {
  if (!st || st.fitness == null) return '';
  const f = Math.max(0, Math.min(100, st.fitness));
  const cls = f >= 75 ? 'ok' : f >= 60 ? 'mid' : 'low';
  return `<span class="tc-fit tc-fit-${cls}" data-f="fit" title="${esc(T.status.fitness)} ${Math.round(f)}"><i style="width:${f}%"></i></span>`;
}
function deltaHTML(v) {
  if (!v) return '';
  return `<i class="tc-delta ${v > 0 ? 'up' : 'down'}">${v > 0 ? '+' : ''}${v}</i>`;
}

function avatarFor(d) {
  return avatarSVG({ seed: d.avatarSeed ?? d.name ?? 0, kitColour: d.kitColour || (d.crest && d.crest.colours && d.crest.colours[0]), kitColour2: d.kitColour2 || (d.crest && d.crest.colours && d.crest.colours[1]), pos: d.pos, nation: d.nation, age: d.age });
}

// ---------------------------------------------------------------- face renderers (return HTML strings)
function playerFace(d, size, T) {
  const r = normRarity(d.rarity);
  const st = d.status || {};
  const crest = d.crest ? `<span class="tc-crest">${crestSVG(d.crest)}</span>` : '';
  const iconTag = (r === 'icon' || d.isIcon) ? `<span class="tc-icontag">${esc(T.icon)}</span>` : '';
  if (size === 'thumb') {
    return `<div class="tc-avatar">${avatarFor(d)}</div>`
      + `<div class="tc-col"><b class="tc-ovr" data-f="ovr">${d.ovr ?? ''}</b><span class="tc-pos" data-f="pos">${esc(d.pos)}</span></div>`;
  }
  if (size === 'mini') {
    return `<div class="tc-avatar">${avatarFor(d)}</div>`
      + `<div class="tc-col"><b class="tc-ovr" data-f="ovr">${d.ovr ?? ''}</b><span class="tc-pos" data-f="pos">${esc(d.pos)}</span>${flagFor(d, 'tc-flag')}${crest}</div>`
      + `<div class="tc-side">${chemPips(st, T)}<span class="tc-sts" data-f="sts">${statusIcons(st, T)}</span></div>`
      + `<div class="tc-name">${esc(shortName(d))}</div>`
      + `<div class="tc-fitwrap">${fitnessBar(st, T)}</div>`;
  }
  // full
  const keys = Object.keys(d.stats || {});
  const half = Math.ceil(keys.length / 2);
  const deltas = d.statDeltas || {};
  const statRow = (k) => `<div class="tc-stat"><b data-stat="${k}">${d.stats[k]}</b><span>${esc(STAT_LABELS[k] || k.toUpperCase())}</span><em data-sd="${k}">${deltaHTML(deltas[k])}</em></div>`;
  const stats = `<div class="tc-stats"><div>${keys.slice(0, half).map(statRow).join('')}</div><div>${keys.slice(half).map(statRow).join('')}</div></div>`;
  const traitList = (d.traits || []).slice(0, 2).map((x) => `<span class="tc-chip tc-chip-trait">${esc(x)}</span>`).join('');
  const traits = traitList ? `<div class="tc-traits">${traitList}</div>` : '';
  const style = d.styleLabel ? `<span class="tc-chip tc-chip-style">${esc(d.styleLabel)}</span>` : '';
  const slots = d.upgradeSlots ?? 0;
  const pips = slots ? `<span class="tc-pips" data-f="pips">${Array.from({ length: slots }, (_, i) => `<i class="${i < (d.upgradesUsed || 0) ? 'on' : ''}"></i>`).join('')}</span>` : '';
  const alt = (d.altPos && d.altPos.length) ? `<span class="tc-alt">${d.altPos.map(esc).join(' ')}</span>` : '';
  return `<div class="tc-avatar">${avatarFor(d)}</div>`
    + `<div class="tc-col"><b class="tc-ovr" data-f="ovr">${d.ovr ?? ''}</b><em class="tc-ovrd" data-f="ovrd">${deltaHTML(d.ovrDelta)}</em><span class="tc-pos" data-f="pos">${esc(d.pos)}</span>${alt}${flagFor(d, 'tc-flag')}${crest}</div>`
    + `<div class="tc-side">${chemPips(st, T)}<span class="tc-sts" data-f="sts">${statusIcons(st, T)}</span></div>`
    + iconTag + traits
    + `<div class="tc-name${nameCls(d.name)}">${esc(fitName(d.name))}</div>`
    + stats
    + ((style || pips) ? `<div class="tc-foot">${style}${pips}</div>` : '');
}

const KIND_ICON = { manager: 'manager', staff: 'staff', training: 'training', trait: 'trait', style: 'style', tactic: 'tactic', consumable: 'consumable', club: 'club', position: 'position' };

function otherFace(d, size, T) {
  const r = normRarity(d.rarity);
  const kind = d.kind;
  const iconId = d.icon || (kind === 'staff' && d.role ? d.role : KIND_ICON[kind]) || 'star';
  let art;
  if (kind === 'manager' && d.avatarSeed != null) art = `<div class="tc-art tc-art-avatar">${avatarFor({ ...d, pos: 'MGR', kitColour: d.kitColour || '#1d2740', kitColour2: '#e9eef8' })}</div>`;
  else if (kind === 'club' && d.crest) art = `<div class="tc-art tc-art-crest">${crestSVG(d.crest)}</div>`;
  else art = `<div class="tc-art tc-art-icon">${iconSVG(iconId)}</div>`;
  const gems = `<span class="tc-gems">${Array.from({ length: RARITIES.indexOf(r) + 1 }, () => '<i></i>').join('')}</span>`;
  const title = d.title || (kind === 'staff' && d.role ? T.staffRole[d.role] : '') || d.name || T.kind[kind] || '';
  if (size === 'thumb') return `<span class="tc-kind">${esc(T.kind[kind] || kind)}</span>${art}`;
  if (size === 'mini') return `<span class="tc-kind">${esc(T.kind[kind] || kind)}</span>${art}<div class="tc-title">${esc(title)}</div>${gems}`;
  const level = kind === 'staff' && d.level ? `<span class="tc-level">${Array.from({ length: 3 }, (_, i) => `<i class="${i < d.level ? 'on' : ''}">${iconSVG('star')}</i>`).join('')}</span>` : '';
  const flag = kind === 'manager' && (d.flag || d.nation) ? flagFor(d, 'tc-flag tc-flag-mgr') : '';
  const value = d.value != null ? `<div class="tc-value">${esc(d.value)}</div>` : '';
  const sub = kind === 'manager' && d.name && d.name !== title ? `<div class="tc-sub">${esc(d.name)}</div>` : '';
  const style = d.styleLabel ? `<span class="tc-chip tc-chip-style">${esc(d.styleLabel)}</span>` : '';
  return `<span class="tc-kind">${iconSVG(KIND_ICON[kind] || 'star', 'tc-kind-ico')}${esc(T.kind[kind] || kind)}</span>${gems}${flag}`
    + art + `<div class="tc-info"><div class="tc-title">${esc(title)}</div>${sub}${value}${level}`
    + (d.text ? `<div class="tc-text">${esc(d.text)}</div>` : '') + (style ? `<div class="tc-foot">${style}</div>` : '') + '</div>';
}

function faceHTML(d, size, T) {
  const r = normRarity(d.rarity);
  const content = (d.kind === 'player' || !d.kind) ? playerFace(d, size, T) : otherFace(d, size, T);
  const foil = FOIL[r] ? '<div class="tc-foil"></div><div class="tc-glare"></div>' : '<div class="tc-glare tc-glare-flat"></div>';
  return `<div class="tc-bg"></div><div class="tc-content">${content}</div>${foil}${frameSVG(d, size)}`;
}

function applyClasses(el, d, size) {
  const r = normRarity(d.rarity);
  const kind = d.kind || 'player';
  el.className = `tc-card tc-size-${size} tc-r-${r} tc-k-${kind}` + (FOIL[r] ? ' tc-foiled' : '') + (el.__tc && el.__tc.extraCls ? ' ' + el.__tc.extraCls : '');
  el.dataset.rarity = r;
  el.dataset.kind = kind;
  if (d.id != null) el.dataset.id = d.id;
}

function ariaLabel(d, T) {
  const r = T.rarity[normRarity(d.rarity)] || '';
  if (d.kind === 'player' || !d.kind) return `${r} ${d.name || ''}, ${d.ovr ?? ''} ${d.pos || ''}`.trim();
  return `${r} ${T.kind[d.kind] || d.kind}: ${d.title || d.name || ''}`.trim();
}

/**
 * Build a card element.
 * @param {object} data view model (see top of file)
 * @param {{size?:'full'|'mini'|'thumb', width?:number, t?:object, tilt?:boolean, animLevel?:number}} [opts]
 */
export function cardEl(data, opts = {}) {
  ensureDefs();
  const size = SIZES[opts.size] ? opts.size : 'full';
  const T = strings(opts.t);
  const d = { kind: 'player', ...data };
  const el = document.createElement('div');
  el.__tc = { data: d, size, T, extraCls: '' };
  applyClasses(el, d, size);
  if (opts.width) el.style.setProperty('--tcw', opts.width + 'px');
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', ariaLabel(d, T));
  const tilt = document.createElement('div');
  tilt.className = 'tc-tilt';
  const face = document.createElement('div');
  face.className = 'tc-face';
  setMask(face, shapeKey(d));
  face.innerHTML = faceHTML(d, size, T);
  tilt.appendChild(face);
  el.appendChild(tilt);
  if (size === 'mini' && d.kind === 'player' && d.styleLabel) {
    const u = document.createElement('div');
    u.className = 'tc-under';
    u.textContent = d.styleLabel;
    el.appendChild(u);
  }
  if (opts.tilt) attachTilt(el, opts);
  return el;
}

// Shared SVG paint servers for the metal frames: one hidden <svg> per document (not display:none, so the
// gradients resolve in every engine).
const METAL = {
  bronze: ['#5e3315', '#e9ae74', '#8a5426', '#f0be8a', '#6e3f1c'],
  silver: ['#6f7a8e', '#ffffff', '#97a3b7', '#f4f8ff', '#6f7a8e'],
  gold: ['#8f6200', '#fff2b0', '#d29c0c', '#ffe78a', '#9c6c00'],
  elite: ['#19e3ff', '#7a5cff', '#ff4fd8', '#7a5cff', '#19e3ff'],
  icon: ['#ffcf5a', '#ff6ad5', '#fff4d0', '#ff8fd9', '#ffcf5a'],
};
function ensureDefs() {
  if (typeof document === 'undefined' || document.getElementById('tc-defs')) return;
  const stops = (cols) => cols.map((c, i) => `<stop offset="${(i / (cols.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('');
  const svg = `<svg id="tc-defs" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false"><defs>`
    + Object.entries(METAL).map(([k, c]) => `<linearGradient id="tcg-${k}" x1="0" y1="0" x2="1" y2="1">${stops(c)}</linearGradient>`).join('')
    + '</defs></svg>';
  document.body.insertAdjacentHTML('afterbegin', svg);
}

function setMask(face, key) {
  const m = maskUrl(key);
  face.style.webkitMaskImage = m;
  face.style.maskImage = m;
}

/**
 * Integer tick-up on a text node / element. Uses GSAP when present.
 * @param {Element} node
 * @param {number} to
 * @param {{from?:number, duration?:number, delay?:number, ease?:string}} [o]
 */
export function countTo(node, to, o = {}) {
  if (!node) return null;
  const from = o.from ?? (parseInt(node.textContent, 10) || 0);
  const g = G();
  if (!g || from === to || o.duration === 0) { node.textContent = String(to); return null; }
  const obj = { v: from };
  node.textContent = String(from);
  return g.to(obj, {
    v: to, duration: o.duration ?? 0.6, delay: o.delay ?? 0, ease: o.ease || 'power2.out',
    onUpdate: () => { node.textContent = String(Math.round(obj.v)); },
    onComplete: () => { node.textContent = String(to); },
  });
}

/**
 * Patch a card in place. Same kind / size / rarity -> numbers animate, status blocks refresh.
 * Otherwise the face is rebuilt (listeners on `el` survive).
 */
export function updateCard(el, data, opts = {}) {
  const st = el.__tc;
  if (!st) return el;
  const prev = st.data;
  const d = { ...prev, ...data };
  st.data = d;
  const T = st.T;
  const size = st.size;
  const face = el.querySelector('.tc-face');
  el.setAttribute('aria-label', ariaLabel(d, T));
  const sameShell = prev.kind === d.kind && normRarity(prev.rarity) === normRarity(d.rarity) && (prev.avatarSeed === d.avatarSeed) && (prev.name === d.name) && d.kind === 'player';
  if (!sameShell) {
    applyClasses(el, d, size);
    setMask(face, shapeKey(d));
    face.innerHTML = faceHTML(d, size, T);
    const u = el.querySelector('.tc-under');
    if (u) u.textContent = d.styleLabel || '';
    return el;
  }
  const dur = opts.duration ?? 0.7;
  const ovr = face.querySelector('[data-f="ovr"]');
  if (ovr && prev.ovr !== d.ovr) countTo(ovr, d.ovr, { duration: dur });
  const pos = face.querySelector('[data-f="pos"]');
  if (pos) pos.textContent = d.pos || '';
  const ovrd = face.querySelector('[data-f="ovrd"]');
  if (ovrd) ovrd.innerHTML = deltaHTML(d.ovrDelta);
  if (d.stats) {
    for (const k of Object.keys(d.stats)) {
      const n = face.querySelector(`[data-stat="${k}"]`);
      if (n && (!prev.stats || prev.stats[k] !== d.stats[k])) {
        countTo(n, d.stats[k], { duration: dur });
        const g = G();
        if (g && prev.stats && prev.stats[k] !== d.stats[k]) {
          g.fromTo(n, { color: d.stats[k] > prev.stats[k] ? '#3ddc97' : '#ff4d5e' }, { color: '', duration: dur + 0.4, clearProps: 'color' });
        }
      }
      const sd = face.querySelector(`[data-sd="${k}"]`);
      if (sd) sd.innerHTML = deltaHTML((d.statDeltas || {})[k]);
    }
  }
  const sts = face.querySelector('[data-f="sts"]');
  if (sts) sts.innerHTML = statusIcons(d.status, T);
  const chem = face.querySelector('[data-f="chem"]');
  if (chem) chem.outerHTML = chemPips(d.status, T);
  const fit = face.querySelector('[data-f="fit"] i');
  if (fit && d.status && d.status.fitness != null) {
    const f = Math.max(0, Math.min(100, d.status.fitness));
    fit.parentElement.className = `tc-fit tc-fit-${f >= 75 ? 'ok' : f >= 60 ? 'mid' : 'low'}`;
    const g = G();
    if (g) g.to(fit, { width: f + '%', duration: dur }); else fit.style.width = f + '%';
  }
  const pips = face.querySelector('[data-f="pips"]');
  if (pips) pips.querySelectorAll('i').forEach((p, i) => p.classList.toggle('on', i < (d.upgradesUsed || 0)));
  const u = el.querySelector('.tc-under');
  if (u) u.textContent = d.styleLabel || '';
  return el;
}

// ---------------------------------------------------------------- tilt + foil

/** Pose a card: px, py in 0..1 (0.5 = centre). strength 0..1 scales the tilt angle. */
export function setTilt(el, px, py, strength = 1, maxDeg = 14) {
  const cx = px - 0.5; const cy = py - 0.5;
  const hyp = Math.min(1, Math.sqrt(cx * cx + cy * cy) * 2);
  const s = el.style;
  s.setProperty('--mx', (px * 100).toFixed(1) + '%');
  s.setProperty('--my', (py * 100).toFixed(1) + '%');
  s.setProperty('--rx', (-cy * 2 * maxDeg * strength).toFixed(2) + 'deg');
  s.setProperty('--ry', (cx * 2 * maxDeg * strength).toFixed(2) + 'deg');
  s.setProperty('--bx', (50 + cx * 70).toFixed(1) + '%');
  s.setProperty('--by', (50 + cy * 70).toFixed(1) + '%');
  s.setProperty('--hyp', hyp.toFixed(3));
}

/**
 * Pointer-tracked tilt + foil for gold / elite / icon. Returns a detach function.
 * Bronze and silver get no listeners at all. animLevel 0 or prefers-reduced-motion -> static foil, no tilt.
 * @param {HTMLElement} el
 * @param {{animLevel?:0|1|2}} [opts]
 */
export function attachTilt(el, opts = {}) {
  const noop = () => {};
  if (!el || !el.__tc) return noop;
  const r = normRarity(el.__tc.data.rarity);
  const level = opts.animLevel ?? 2;
  if (!FOIL[r] || level === 0 || (opts.respectReducedMotion !== false && reducedMotion())) return noop;
  if (el.__tcDetach) return el.__tcDetach;
  const maxDeg = level === 1 ? 6 : r === 'gold' ? 10 : 14;
  let raf = 0; let tx = 0.5; let ty = 0.5; let tween = null;
  const state = { x: 0.5, y: 0.5, s: 0 };
  const write = () => { raf = 0; setTilt(el, state.x, state.y, state.s, maxDeg); };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(write); };
  const onMove = (e) => {
    const b = el.getBoundingClientRect();
    if (!b.width) return;
    tx = Math.max(0, Math.min(1, (e.clientX - b.left) / b.width));
    ty = Math.max(0, Math.min(1, (e.clientY - b.top) / b.height));
    if (tween) { tween.kill(); tween = null; }
    state.x = tx; state.y = ty; state.s = 1;
    el.classList.add('tc-active');
    schedule();
  };
  const onLeave = () => {
    const g = G();
    if (g) {
      tween = g.to(state, { x: 0.5, y: 0.5, s: 0, duration: 0.7, ease: 'power3.out', onUpdate: () => setTilt(el, state.x, state.y, state.s, maxDeg), onComplete: () => { el.classList.remove('tc-active'); tween = null; } });
    } else {
      state.x = 0.5; state.y = 0.5; state.s = 0; write(); el.classList.remove('tc-active');
    }
  };
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerdown', onMove);
  el.addEventListener('pointerleave', onLeave);
  el.addEventListener('pointercancel', onLeave);
  el.classList.add('tc-tiltable');
  const detach = () => {
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerdown', onMove);
    el.removeEventListener('pointerleave', onLeave);
    el.removeEventListener('pointercancel', onLeave);
    if (raf) cancelAnimationFrame(raf);
    if (tween) tween.kill();
    el.classList.remove('tc-tiltable', 'tc-active');
    el.__tcDetach = null;
  };
  el.__tcDetach = detach;
  return detach;
}

/** Light sweep across the foil (used on reveal). Returns a tween or null. */
export function shineSweep(el, duration = 0.9) {
  const g = G();
  if (!g || !el) return null;
  const st = { x: 0.05, y: 0.15 };
  return g.to(st, { x: 0.95, y: 0.85, duration, ease: 'power1.inOut', onUpdate: () => setTilt(el, st.x, st.y, 0) , onComplete: () => setTilt(el, 0.5, 0.5, 0) });
}

// ---------------------------------------------------------------- promotion

const RARITY_GLOW = { bronze: '#e2a46a', silver: '#eef3fb', gold: '#ffd84a', elite: '#7a5cff', icon: '#ff6ad5' };

/**
 * Rarity upgrade animation (bronze -> silver etc.). Short GSAP timeline, ~1.3 s.
 * @returns {object|null} gsap timeline
 */
export function promoteCard(el, fromRarity, toRarity, opts = {}) {
  if (!el || !el.__tc) return null;
  const g = G();
  if (fromRarity && normRarity(el.__tc.data.rarity) !== normRarity(fromRarity)) updateCard(el, { rarity: fromRarity });
  if (!g || (opts.respectReducedMotion !== false && reducedMotion())) { updateCard(el, { rarity: toRarity }); return null; }
  const tilt = el.querySelector('.tc-tilt');
  const flash = document.createElement('div');
  flash.className = 'tc-flash';
  flash.style.setProperty('--glow', RARITY_GLOW[normRarity(toRarity)]);
  el.appendChild(flash);
  const sparks = [];
  for (let i = 0; i < 14; i++) {
    const s = document.createElement('i');
    s.className = 'tc-spark';
    s.style.setProperty('--glow', RARITY_GLOW[normRarity(toRarity)]);
    el.appendChild(s);
    sparks.push(s);
  }
  const tl = g.timeline({ onComplete: () => { flash.remove(); sparks.forEach((s) => s.remove()); } });
  tl.to(tilt, { scale: 1.08, duration: 0.22, ease: 'power2.out' })
    .to(tilt, { rotateY: 90, duration: 0.18, ease: 'power2.in' })
    .to(flash, { opacity: 1, duration: 0.15 }, '<')
    .add(() => updateCard(el, { rarity: toRarity }))
    .to(tilt, { rotateY: 0, duration: 0.32, ease: 'back.out(2)' })
    .to(flash, { opacity: 0, duration: 0.5 }, '<')
    .to(sparks, {
      x: (i) => Math.cos((i / sparks.length) * Math.PI * 2) * 120,
      y: (i) => Math.sin((i / sparks.length) * Math.PI * 2) * 150,
      opacity: 0, scale: 0.3, duration: 0.7, ease: 'power3.out',
    }, '<')
    .to(tilt, { scale: 1, duration: 0.45, ease: 'elastic.out(1, 0.5)', clearProps: 'transform' }, '-=0.3');
  return tl;
}

// ---------------------------------------------------------------- card back

const PACK_TINT = { bronze: '#b7773f', silver: '#b9c4d6', gold: '#f2c440', elite: '#7a5cff', icon: '#ff6ad5', promo: '#ff6ad5', starter: '#3ddc97', staff: '#19e3ff', training: '#3ddc97' };

/** Card back for pack reveals. Neutral silhouette so the front's frame shape is the reveal. */
export function cardBack(opts = {}) {
  const size = SIZES[opts.size] ? opts.size : 'full';
  const T = strings(opts.t);
  ensureDefs();
  const el = document.createElement('div');
  el.className = `tc-card tc-back tc-size-${size}`;
  if (opts.width) el.style.setProperty('--tcw', opts.width + 'px');
  el.style.setProperty('--tint', PACK_TINT[opts.packType] || PACK_TINT.gold);
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<div class="tc-tilt"><div class="tc-face">'
    + `<div class="tc-back-bg"></div><div class="tc-back-mark"><svg viewBox="0 0 100 100" aria-hidden="true">`
    + `<circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="50" cy="50" r="31" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".6"/>`
    + `<path d="M30,34 H70 V43 H55 V72 H45 V43 H30 Z" fill="currentColor"/></svg></div>`
    + `<div class="tc-back-word">${esc(T.cardBack)}</div>`
    + `<svg class="tc-frame" viewBox="0 0 140 200" preserveAspectRatio="none"><path d="${SHAPES.back}" class="tc-frame-outer" style="stroke-width:7"/></svg>`
    + '</div></div>';
  setMask(el.querySelector('.tc-face'), 'back');
  return el;
}
