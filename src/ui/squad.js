// Squad screen: perspective pitch with 11 mini cards and link lines, live header, bench + reserves strip,
// drag-and-drop (mouse and touch via pointer events), tap-then-tap, detail panel, auto buttons and presets.
// UI only: every rule lives in logic/squad.js. This file reads store.state, calls read-only queries
// (squadView, previewTargets, applicableItems) and dispatches actions.
//
// mountSquad(root, store) -> cleanup()
// store = { state, world, dispatch(type, payload), subscribe(fn) -> unsubscribe, t, ctx? }
//   store.t    strings table (object, same shape as strings.js S) or a function (key) -> string
//   store.ctx  optional object or () => object: { avgMatchIncome }

import { S, fmt } from '../strings.js';
import { STAT_LABELS, POSITIONS, RARITIES, CHEM } from '../balance.js';
import { cardEl, updateCard, attachTilt } from './components/card.js';
import { createSquadPitch } from './components/squadPitch.js';
import { flagHTML } from './components/crest.js';
import { FORMATION_LIST } from '../logic/formations.js';
import { TRAIT_CATALOGUE, STYLE_CARDS } from '../logic/cardEffects.js';
import { quickSellValue } from '../logic/economy.js';
import {
  SQUAD_ACTIONS, squadView, previewTargets, filterStrip, applicableItems, rarityOfCard, worldPlayerOf,
} from '../logic/squad.js';

/** Action handlers for main.js: type -> (state, payload, world) => result. Mutate state in place. */
export const squadActions = SQUAD_ACTIONS;

// ------------------------------------------------------------------ helpers shared with ui/tactics.js

const getPath = (o, key) => key.split('.').reduce((a, k) => (a && typeof a === 'object' ? a[k] : undefined), o);

/** String lookup: store.t, then strings.js S, then the key itself. */
export function makeT(store) {
  return (key, vars) => {
    let v;
    if (typeof store.t === 'function') { v = store.t(key, vars); if (v === key) v = undefined; } else if (store.t && typeof store.t === 'object') v = getPath(store.t, key);
    if (v == null || typeof v === 'object') v = getPath(S, key);
    if (v == null || typeof v === 'object') v = key;
    return fmt(v, vars);
  };
}
export const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const ctxOf = (store) => (typeof store.ctx === 'function' ? store.ctx() : store.ctx) || {};
const G = () => (typeof window !== 'undefined' ? window.gsap : undefined);

/** Dispatch and surface a failure in a toast. Works with sync or async dispatch. */
export function act(store, toast, type, payload, onOk) {
  return Promise.resolve(store.dispatch(type, payload)).then((res) => {
    if (res && res.ok === false) toast(res.message || res.error || S.common.notAllowed, 'bad');
    else if (onOk) onOk(res || {});
    return res;
  });
}

export function makeToast(host) {
  let timer = 0;
  return (msg, kind = '') => {
    host.textContent = msg;
    host.className = `sq-toast show ${kind}`;
    clearTimeout(timer);
    timer = setTimeout(() => { host.className = 'sq-toast'; }, 2600);
  };
}

/** Animate a number in place (decimals allowed). */
function tweenNum(node, to, decimals = 0) {
  if (!node) return;
  const from = parseFloat(node.dataset.v ?? node.textContent) || 0;
  node.dataset.v = String(to);
  const show = (v) => { node.textContent = decimals ? v.toFixed(decimals) : String(Math.round(v)); };
  const g = G();
  if (!g || from === to) { show(to); return; }
  const o = { v: from };
  g.to(o, { v: to, duration: 0.6, ease: 'power2.out', onUpdate: () => show(o.v), onComplete: () => show(to) });
  node.classList.remove('sq-up', 'sq-down');
  void node.offsetWidth;
  node.classList.add(to > from ? 'sq-up' : 'sq-down');
}

// Slot display position on the pitch plane (x 0..100 left -> right, y 0..100 attack -> own goal).
// Depths are grouped into rows (within ROW_TOL) and rows are spread evenly over the pitch so tall cards do not
// stack on each other; inside a row the small depth differences are kept.
const ROW_TOL = 9;
function slotPositions(slots) {
  const depths = [...new Set(slots.map((s) => s.depth))].sort((a, b) => a - b);
  const rows = [];
  for (const d of depths) {
    const r = rows[rows.length - 1];
    if (r && d - r.max <= ROW_TOL) { r.max = d; r.list.push(d); } else rows.push({ min: d, max: d, list: [d] });
  }
  const top = 11;
  const bottom = 91;
  const span = rows.length > 1 ? (bottom - top) / (rows.length - 1) : 0;
  return slots.map((s) => {
    const ri = rows.findIndex((r) => s.depth >= r.min && s.depth <= r.max);
    const r = rows[ri];
    const mid = (r.min + r.max) / 2;
    return { x: 8 + (s.lat / 100) * 84, y: bottom - ri * span - (s.depth - mid) * 0.5 };
  });
}
const keyOf = (ref) => (ref.zone === 'xi' ? 'xi:' + ref.index : ref.zone === 'bench' ? 'bench:' + ref.index : 'res:' + (ref.cardId || ''));
const refOfEl = (el) => {
  const z = el.dataset.zone;
  if (z === 'xi' || z === 'bench') return { zone: z, index: Number(el.dataset.index) };
  if (z === 'reserve') return el.dataset.card ? { zone: 'reserve', cardId: el.dataset.card } : { zone: 'reserve' };
  return null;
};
const LONG_PRESS_MS = 520;
const DRAG_START_PX = 8;

// ------------------------------------------------------------------ screen

/** Card size chosen with the header slider (1 = automatic fit). Kept in localStorage, which may be blocked. */
function loadCardScale() {
  try { const v = Number(localStorage.getItem('touchline.cardScale')); return v >= 0.8 && v <= 1.7 ? v : 1; } catch (e) { return 1; }
}
function saveCardScale(v) {
  try { localStorage.setItem('touchline.cardScale', String(v)); } catch (e) { /* storage may be blocked */ }
}

export function mountSquad(root, store) {
  const T = makeT(store);
  root.innerHTML = '';
  const screen = document.createElement('section');
  screen.className = 'sq';
  screen.innerHTML = `
    <header class="sq-head">
      <label class="sq-h sq-h-form"><span>${esc(T('squad.formation'))}</span>
        <select class="sq-formation" aria-label="${esc(T('squad.formation'))}">${FORMATION_LIST.map((f) => `<option value="${f.id}">${f.id}</option>`).join('')}</select></label>
      <div class="sq-h"><span>${esc(T('squad.teamOvr'))}</span><b class="sq-big" data-h="ovr">0</b></div>
      <div class="sq-h sq-h-lines">
        <div><span>${esc(T('squad.att'))}</span><b data-h="att">0</b></div>
        <div><span>${esc(T('squad.mid'))}</span><b data-h="mid">0</b></div>
        <div><span>${esc(T('squad.def'))}</span><b data-h="def">0</b></div>
      </div>
      <div class="sq-h sq-h-chem"><span>${esc(T('squad.chemistry'))}</span><b><i data-h="chem">0</i><small>/${CHEM.teamMax}</small></b><em class="sq-chembar"><i></i></em></div>
      <div class="sq-h sq-h-wage"><span>${esc(T('squad.wages'))}</span><b><i data-h="wages">0</i><small> / <i data-h="budget">0</i></small></b></div>
      <div class="sq-tools">
      <button class="sq-btn sq-btn-main" data-act="autoBest">${esc(T('squad.autoBest'))}</button>
      <button class="sq-btn" data-act="autoFitness">${esc(T('squad.autoFitness'))}</button>
      <div class="sq-presets" role="group" aria-label="${esc(T('squad.presets'))}">
        <span class="sq-presets-l">${esc(T('squad.presets'))}</span>
        ${[0, 1, 2].map((i) => `<span class="sq-preset"><button class="sq-btn sq-pl" data-pl="${i}" title="${esc(T('squad.load'))}">${i + 1}</button><button class="sq-btn sq-ps" data-ps="${i}" title="${esc(T('squad.save'))} ${esc(T('squad.preset', { n: i + 1 }))}" aria-label="${esc(T('squad.save'))} ${esc(T('squad.preset', { n: i + 1 }))}">${saveIcon()}</button></span>`).join('')}
      </div>
      <label class="sq-size" title="${esc(T('squad.cardSize'))}"><span>${esc(T('squad.cardSize'))}</span><input type="range" id="sq-size" min="80" max="170" step="5" value="${Math.round(loadCardScale() * 100)}"></label>
      </div>
    </header>
    <div class="sq-main"><div class="sq-issues" aria-live="polite"></div><p class="sq-hint">${esc(T('squad.hint'))}</p></div>
    <div class="sq-strip">
      <div class="sq-strip-bar">
        <b class="sq-strip-t">${esc(T('squad.bench'))}</b>
        <span class="sq-strip-sp"></span>
        <b class="sq-strip-t">${esc(T('squad.reserves'))} <i class="sq-rescount"></i></b>
        <select class="sq-f-pos" aria-label="${esc(T('squad.filterPos'))}"><option value="ALL">${esc(T('squad.all'))}</option>${POSITIONS.map((p) => `<option>${p}</option>`).join('')}</select>
        <select class="sq-f-rar" aria-label="${esc(T('squad.filterRarity'))}"><option value="ALL">${esc(T('squad.allRarities'))}</option>${RARITIES.map((r) => `<option value="${r}">${esc(T('rarity.' + r))}</option>`).join('')}</select>
        <select class="sq-f-sort" aria-label="${esc(T('squad.sort'))}"><option value="ovr">${esc(T('squad.sortOvr'))}</option><option value="fitness">${esc(T('squad.sortFitness'))}</option></select>
      </div>
      <div class="sq-strip-row"><div class="sq-bench"></div><div class="sq-res" data-zone="reserve" data-drop="res:"></div></div>
    </div>
    <div class="sq-toast" role="status"></div>`;
  root.appendChild(screen);
  const $ = (s) => screen.querySelector(s);
  const toast = makeToast($('.sq-toast'));
  const pitch = createSquadPitch();
  $('.sq-main').appendChild(pitch.el);
  const filters = { pos: 'ALL', rarity: 'ALL', sort: 'ovr' };

  let view = null;
  let lastFormation = null;
  let pts = [];
  const slotEls = new Map(); // 'xi:i' -> { wrap, card, cardId }
  const tilts = [];

  // ---------------------------------------------------------------- render
  function render() {
    const { state, world } = store;
    if (!state || !world) return;
    view = squadView(state, world, ctxOf(store));
    renderHeader();
    if (view.formation !== lastFormation) {
      lastFormation = view.formation;
      pitch.setAnchors(slotPositions(view.slots));
      for (const s of slotEls.values()) s.wrap.remove();
      slotEls.clear();
      relayout();
    }
    renderSlots();
    renderLinks();
    renderStrip();
    renderIssues();
    $('.sq-formation').value = view.formation;
    screen.querySelectorAll('[data-pl]').forEach((b) => { b.disabled = !view.presets[Number(b.dataset.pl)]; });
    if (selected) decorateTargets(selected, false);
  }

  function renderHeader() {
    const h = view.header;
    tweenNum($('[data-h="ovr"]'), h.ovr, 1);
    tweenNum($('[data-h="att"]'), Math.round(h.att));
    tweenNum($('[data-h="mid"]'), Math.round(h.mid));
    tweenNum($('[data-h="def"]'), Math.round(h.def));
    tweenNum($('[data-h="chem"]'), h.chemistry);
    tweenNum($('[data-h="wages"]'), h.wages);
    tweenNum($('[data-h="budget"]'), h.wageBudget);
    const bar = $('.sq-chembar i');
    bar.style.width = (h.chemistry / h.chemMax) * 100 + '%';
    const wage = $('.sq-h-wage');
    wage.classList.toggle('over', h.overBudget);
    wage.title = h.overBudget ? T('squad.overBudget') : '';
  }

  function renderIssues() {
    const iss = view.issues;
    const codes = [...iss.errors, ...iss.warnings].map((x) => x.code).filter((c) => S.squad.issues[c]);
    const uniq = [...new Set(codes)];
    $('.sq-issues').innerHTML = uniq.map((c) => `<span class="sq-issue ${iss.errors.some((e) => e.code === c) ? 'err' : ''}">${esc(T('squad.issues.' + c))}</span>`).join('');
  }

  // The layout is re-run only when the space it depends on changes (stage width, window size). The pitch's own height is
  // NOT an input: observing it made relayout flip between two sizes forever (the squad view "shaking").
  let layoutKey = '';
  const sizeKey = () => `${pitch.el.clientWidth}|${window.innerWidth}|${window.innerHeight}`;
  function relayoutIfNeeded() { if (sizeKey() !== layoutKey) relayout(); }

  /** Document-space bottom of the lowest card (the goalkeeper) plus room for its position label. */
  function lowestCardBottom() {
    let low = 0;
    for (const e of slotEls.values()) low = Math.max(low, e.wrap.getBoundingClientRect().bottom);
    return low + window.scrollY + 26;
  }

  function relayout() {
    // card width follows the pitch width (times the player's own card-size setting). The goalkeeper must stay visible
    // without scrolling: if the lowest card ends up below the window bottom, the pitch is shrunk until it fits.
    let budget; // undefined = automatic height budget
    for (let attempt = 0; attempt < 5; attempt++) {
      pts = pitch.layout(budget);
      const pw = parseFloat(pitch.el.style.getPropertyValue('--sp-pw')) || 400;
      // largest card width for which no two neighbouring cards overlap by more than a little
      let cw = Math.min(190, pw * 0.27);
      const fits = (w) => {
        for (let i = 0; i < pts.length; i++) {
          for (let j = i + 1; j < pts.length; j++) {
            const a = pts[i]; const b = pts[j];
            const sc = (0.82 + 0.18 * Math.max(a.s, b.s));
            if (Math.abs(a.x - b.x) < w * sc * 0.86 && Math.abs(a.y - b.y) < w * sc * 1.43 * 0.42) return false;
          }
        }
        return true;
      };
      while (cw > 52 && !fits(cw)) cw -= 2;
      cw = Math.min(240, cw * loadCardScale()); // the slider may push cards past the no-overlap size on purpose
      pitch.cards.style.setProperty('--card-w-mini', Math.round(Math.max(50, cw)) + 'px');
      positionSlots();
      const over = lowestCardBottom() - (window.innerHeight - 8);
      if (over <= 0 || pitch.lastMaxH <= 300) break;
      budget = Math.max(300, pitch.lastMaxH - over * 1.15);
    }
    renderLinks();
    layoutKey = sizeKey();
  }

  function positionSlots() {
    view && view.slots.forEach((s, i) => {
      const e = slotEls.get('xi:' + i);
      const p = pts[i];
      if (!e || !p) return;
      e.wrap.style.left = p.x + 'px';
      e.wrap.style.top = p.y + 'px';
      e.wrap.style.setProperty('--ps', (0.82 + 0.18 * p.s).toFixed(3));
      e.wrap.style.zIndex = String(10 + Math.round(p.y));
    });
  }

  function renderSlots() {
    view.slots.forEach((s, i) => {
      const key = 'xi:' + i;
      let e = slotEls.get(key);
      if (!e) {
        const wrap = document.createElement('div');
        wrap.className = 'sq-slot';
        wrap.dataset.zone = 'xi';
        wrap.dataset.index = String(i);
        wrap.dataset.drop = key;
        wrap.innerHTML = '<div class="sq-cardbox"></div><span class="sq-slabel"></span><span class="sq-roles"></span><span class="sq-pred"></span>';
        pitch.cards.appendChild(wrap);
        e = { wrap, card: null, cardId: undefined };
        slotEls.set(key, e);
        wrap.addEventListener('pointerenter', (ev) => { if (ev.pointerType === 'mouse' && !drag) hoverSlot(i); });
        wrap.addEventListener('pointerleave', (ev) => { if (ev.pointerType === 'mouse') hoverSlot(-1); });
      }
      const box = e.wrap.querySelector('.sq-cardbox');
      if (s.empty) {
        if (e.cardId !== null) { box.innerHTML = `<div class="sq-emptycard"><b>+</b><span>${esc(s.slotPos)}</span></div>`; e.card = null; e.cardId = null; }
        delete e.wrap.dataset.drag;
        delete e.wrap.dataset.card;
      } else if (e.cardId !== s.cardId || !e.card) {
        box.innerHTML = '';
        e.card = cardEl(s.view, { size: 'mini', t: store.t && store.t.card });
        box.appendChild(e.card);
        e.cardId = s.cardId;
        e.wrap.dataset.drag = '1';
        e.wrap.dataset.card = s.cardId;
        const g = G();
        if (g && lastFormation) g.fromTo(e.card, { scale: 0.86, opacity: 0.4 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2)', clearProps: 'transform,opacity' });
      } else {
        updateCard(e.card, s.view, { duration: 0.5 });
      }
      const lab = e.wrap.querySelector('.sq-slabel');
      lab.textContent = s.slotPos;
      lab.className = `sq-slabel oop-${s.empty ? 0 : s.oop}`;
      lab.title = s.empty ? '' : T('squad.oop.' + s.oop);
      e.wrap.querySelector('.sq-roles').innerHTML = (s.roles || []).map((r) => `<i class="sq-role sq-role-${r}" title="${esc(T('tactics.roleName.' + r))}">${esc(T('squad.roleShort.' + r))}</i>`).join('');
      e.wrap.classList.toggle('is-empty', !!s.empty);
      e.wrap.classList.toggle('is-unavail', !s.empty && !s.available);
      e.wrap.setAttribute('aria-label', s.empty ? `${s.slotPos} ${T('squad.empty')}` : `${s.slotPos}: ${s.wp.name}, ${s.ovr}`);
    });
    positionSlots();
  }

  function renderLinks(hl = -1) {
    if (!view) return;
    const links = view.links.map((l) => ({ ...l, cls: hl < 0 ? '' : (l.a === hl || l.b === hl) ? 'is-on' : 'is-off' }));
    pitch.drawLinks(links, pts);
  }

  function hoverSlot(i) {
    pitch.el.classList.toggle('sp-hover', i >= 0);
    const linked = i >= 0 ? new Set(view.linked[i]) : new Set();
    for (const [key, e] of slotEls) {
      const idx = Number(key.slice(3));
      e.wrap.classList.toggle('is-hover', idx === i);
      e.wrap.classList.toggle('is-linked', linked.has(idx));
    }
    renderLinks(i);
  }

  function stripCell(item, zone, index) {
    const cell = document.createElement('div');
    cell.className = 'sq-cell';
    cell.dataset.zone = zone;
    if (zone === 'bench') { cell.dataset.index = String(index); cell.dataset.drop = 'bench:' + index; } else { cell.dataset.card = item.cardId; cell.dataset.drop = 'res:' + item.cardId; }
    if (item.empty) {
      cell.classList.add('is-empty');
      cell.innerHTML = `<div class="sq-emptycard sq-emptycard-s"><b>+</b><span>${esc(T('squad.sub', { n: index + 1 }))}</span></div><span class="sq-pred"></span>`;
      return cell;
    }
    cell.dataset.drag = '1';
    cell.dataset.card = item.cardId;
    const c = cardEl(item.view, { size: 'mini', t: store.t && store.t.card });
    cell.appendChild(c);
    cell.insertAdjacentHTML('beforeend', '<span class="sq-pred"></span>');
    if (!item.available) cell.classList.add('is-unavail');
    return cell; // no pointer tilt on small cards: it made the strip wobble as the mouse moved
  }

  function renderStrip() {
    while (tilts.length) tilts.pop()();
    const bench = $('.sq-bench');
    bench.innerHTML = '';
    view.bench.forEach((b, i) => bench.appendChild(stripCell(b, 'bench', i)));
    const res = $('.sq-res');
    res.innerHTML = '';
    const list = filterStrip(view.reserves, filters);
    $('.sq-rescount').textContent = `(${view.reserves.length})`;
    if (!list.length) res.insertAdjacentHTML('beforeend', `<p class="sq-nores">${esc(T('squad.noReserves'))}</p>`);
    list.forEach((r) => res.appendChild(stripCell(r, 'reserve', -1)));
    res.insertAdjacentHTML('beforeend', `<div class="sq-resdrop" data-zone="reserve" data-drop="res:"><span>${esc(T('squad.dropReserves'))}</span></div>`);
  }

  // ---------------------------------------------------------------- targets (drag and tap-tap)
  let previews = null;
  function decorateTargets(fromRef, fresh = true) {
    if (fresh || !previews) previews = previewTargets(store.state, store.world, fromRef);
    screen.classList.add('sq-picking');
    const fromKey = keyOf(fromRef);
    screen.querySelectorAll('[data-drop]').forEach((el) => {
      const key = el.dataset.drop;
      const p = previews[key];
      el.classList.toggle('is-source', key === fromKey || (fromRef.zone === 'reserve' && el.dataset.card === fromRef.cardId && key !== 'res:'));
      el.classList.toggle('is-valid', !!p);
      el.classList.remove('good', 'bad');
      const badge = el.querySelector(':scope > .sq-pred');
      if (!p) { if (badge) badge.innerHTML = ''; return; }
      const delta = p.dOvr !== 0 ? p.dOvr : p.dChem;
      el.classList.add(delta > 0 ? 'good' : delta < 0 ? 'bad' : 'flat');
      if (badge && !p.landing && !p.dOvr && !p.dChem) badge.innerHTML = '';
      else if (badge) {
        const sign = (v) => (v > 0 ? '+' : '') + v;
        badge.innerHTML = (p.landing ? `<b class="oop-${p.landing.oop}">${p.landing.ovr}</b>` : '')
          + `<span class="${p.dOvr > 0 ? 'up' : p.dOvr < 0 ? 'down' : ''}">${sign(p.dOvr)}</span>`
          + `<span class="c ${p.dChem > 0 ? 'up' : p.dChem < 0 ? 'down' : ''}">${sign(p.dChem)}<i>${esc(T('squad.chemWord'))}</i></span>`;
      }
    });
  }
  function clearTargets() {
    previews = null;
    screen.classList.remove('sq-picking');
    screen.querySelectorAll('.is-valid, .is-source, .is-over').forEach((el) => el.classList.remove('is-valid', 'is-source', 'is-over', 'good', 'bad', 'flat'));
    screen.querySelectorAll('.sq-pred').forEach((b) => { b.innerHTML = ''; });
  }

  let selected = null;
  function select(ref, el) {
    selected = ref;
    screen.querySelectorAll('.is-selected').forEach((x) => x.classList.remove('is-selected'));
    if (el) el.classList.add('is-selected');
    decorateTargets(ref);
  }
  function deselect() {
    selected = null;
    screen.querySelectorAll('.is-selected').forEach((x) => x.classList.remove('is-selected'));
    clearTargets();
  }
  function doSwap(a, b) {
    deselect();
    act(store, toast, 'squad/swap', { a, b });
  }

  // ---------------------------------------------------------------- pointer controller
  let press = null;
  let drag = null;
  const dropUnder = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const t = el && el.closest('[data-drop]');
    return t && screen.contains(t) ? t : null;
  };

  function onDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    const src = e.target.closest('[data-drag], [data-drop]');
    if (!src || !screen.contains(src) || detailOpen) return;
    press = { x: e.clientX, y: e.clientY, el: src, id: e.pointerId, type: e.pointerType, long: false, drag: !!src.dataset.drag };
    if (press.drag && e.pointerType !== 'mouse') {
      press.timer = setTimeout(() => {
        if (!press || drag) return;
        press.long = true;
        openDetail(src.dataset.card);
      }, LONG_PRESS_MS);
    }
  }
  function onMove(e) {
    if (drag && e.pointerId === drag.id) {
      e.preventDefault();
      moveGhost(e.clientX, e.clientY);
      const t = dropUnder(e.clientX, e.clientY);
      if (t !== drag.over) {
        if (drag.over) drag.over.classList.remove('is-over');
        drag.over = t && t.classList.contains('is-valid') ? t : null;
        if (drag.over) drag.over.classList.add('is-over');
      }
      return;
    }
    if (!press || e.pointerId !== press.id || !press.drag || press.long) return;
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    if (Math.hypot(dx, dy) < DRAG_START_PX) return;
    // in the strip a mostly horizontal touch move is a scroll, not a drag
    if (press.type !== 'mouse' && press.el.classList.contains('sq-cell') && Math.abs(dx) > Math.abs(dy)) { cancelPress(); return; }
    startDrag(e);
  }
  function startDrag(e) {
    clearTimeout(press.timer);
    const from = refOfEl(press.el);
    const cardNode = press.el.querySelector('.tc-card');
    if (!from || !cardNode) { cancelPress(); return; }
    if (selected) deselect();
    hoverSlot(-1);
    const r = cardNode.getBoundingClientRect();
    const ghost = cardNode.cloneNode(true);
    ghost.classList.add('sq-ghost');
    ghost.style.setProperty('--tcw', r.width + 'px');
    ghost.style.width = r.width + 'px';
    document.body.appendChild(ghost);
    drag = { id: press.id, from, ghost, w: r.width, h: r.height, src: press.el, over: null };
    press.el.classList.add('is-dragging');
    press = null;
    decorateTargets(from);
    moveGhost(e.clientX, e.clientY);
  }
  function moveGhost(x, y) {
    if (!drag) return;
    drag.ghost.style.transform = `translate(${x - drag.w / 2}px, ${y - drag.h * 0.6}px) rotate(-3deg) scale(1.08)`;
  }
  function endDrag(e, cancelled) {
    const d = drag;
    drag = null;
    d.ghost.remove();
    d.src.classList.remove('is-dragging');
    const t = cancelled ? null : dropUnder(e.clientX, e.clientY);
    const to = t && t.classList.contains('is-valid') ? refOfEl(t) : null;
    clearTargets();
    if (to) doSwap(d.from, to);
  }
  function onUp(e) {
    if (drag && e.pointerId === drag.id) { endDrag(e, false); return; }
    if (!press || e.pointerId !== press.id) return;
    clearTimeout(press.timer);
    const p = press;
    press = null;
    if (p.long) return;
    onTap(p.el);
  }
  function cancelPress() { if (press) clearTimeout(press.timer); press = null; }
  function onCancel(e) {
    if (drag && e.pointerId === drag.id) endDrag(e, true);
    else cancelPress();
  }
  function onTap(el) {
    const ref = refOfEl(el);
    if (!ref) return;
    if (selected) {
      const k = keyOf(ref);
      if (k === keyOf(selected) || (selected.zone === 'reserve' && ref.zone === 'reserve' && ref.cardId === selected.cardId)) { deselect(); return; }
      if (previews && previews[k]) { doSwap(selected, ref); return; }
      if (el.dataset.drag) { select(ref, el); return; }
      deselect();
      return;
    }
    if (el.dataset.drag) {
      // a plain click shows the player's stats (with sell and "move" buttons); drag a card to swap it directly
      openDetail(el.dataset.card);
      return;
      // eslint-disable-next-line no-unreachable
      const card = store.state.cards.find((c) => c.id === el.dataset.card);
      const wp = card ? worldPlayerOf(card, store.world) : null;
      if (wp) toast(T('squad.selected', { name: wp.name }));
    }
  }
  function onContext(e) {
    const src = e.target.closest('[data-drag]');
    if (!src || !screen.contains(src)) return;
    e.preventDefault();
    cancelPress();
    openDetail(src.dataset.card);
  }
  function onBgClick(e) {
    if (selected && !e.target.closest('[data-drop], [data-drag], select, button')) deselect();
  }
  function onKey(e) {
    if (e.key === 'Escape') { if (detailOpen) closeDetail(); else if (selected) deselect(); }
  }

  screen.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  screen.addEventListener('contextmenu', onContext);
  screen.addEventListener('click', onBgClick);
  window.addEventListener('keydown', onKey);

  // ---------------------------------------------------------------- toolbar
  $('.sq-formation').addEventListener('change', (e) => act(store, toast, 'squad/setFormation', { formation: e.target.value }));
  screen.querySelector('[data-act="autoBest"]').addEventListener('click', () => act(store, toast, 'squad/autoBest', {}, (r) => toast(r.warning === 'no_keeper' ? T('squad.noKeeper') : T('squad.autoDone'), r.warning ? 'bad' : 'good')));
  screen.querySelector('[data-act="autoFitness"]').addEventListener('click', () => act(store, toast, 'squad/autoFitness', {}, (r) => {
    const fixed = (r.fixed || []).length;
    const unfixed = (r.unfixed || []).map((i) => view.slots[i] && view.slots[i].slotPos).filter(Boolean);
    let msg = fixed ? T('squad.fixed', { n: fixed }) : T('squad.fixNone');
    if (unfixed.length) msg += '. ' + T('squad.unfixed', { list: unfixed.join(', ') });
    toast(msg, unfixed.length ? 'bad' : 'good');
  }));
  const sizeInput = screen.querySelector('#sq-size');
  if (sizeInput) sizeInput.addEventListener('input', () => { saveCardScale(Number(sizeInput.value) / 100); relayout(); });
  screen.querySelectorAll('[data-pl]').forEach((b) => b.addEventListener('click', () => {
    const n = Number(b.dataset.pl);
    act(store, toast, 'squad/preset/load', { slot: n }, (r) => toast(T('squad.presetLoaded', { n: n + 1 }) + ((r.missing || []).length ? '. ' + T('squad.presetMissing', { n: r.missing.length }) : ''), 'good'));
  }));
  screen.querySelectorAll('[data-ps]').forEach((b) => b.addEventListener('click', () => {
    const n = Number(b.dataset.ps);
    act(store, toast, 'squad/preset/save', { slot: n }, () => toast(T('squad.presetSaved', { n: n + 1 }), 'good'));
  }));
  $('.sq-f-pos').addEventListener('change', (e) => { filters.pos = e.target.value; renderStrip(); });
  $('.sq-f-rar').addEventListener('change', (e) => { filters.rarity = e.target.value; renderStrip(); });
  $('.sq-f-sort').addEventListener('change', (e) => { filters.sort = e.target.value; renderStrip(); });

  // ---------------------------------------------------------------- detail panel
  let detailOpen = null;
  const detailHost = document.createElement('div');
  detailHost.className = 'sq-detail-host';
  screen.appendChild(detailHost);

  function findItem(cardId) {
    const s = view.slots.find((x) => x.cardId === cardId);
    if (s) return { kind: 'xi', slot: s };
    const b = view.bench.find((x) => x.cardId === cardId) || view.reserves.find((x) => x.cardId === cardId);
    return b ? { kind: b.zone, item: b } : null;
  }

  function openDetail(cardId) {
    if (!cardId || !view) return;
    const found = findItem(cardId);
    if (!found) return;
    if (selected) deselect();
    detailOpen = cardId;
    renderDetail();
  }
  function closeDetail() {
    detailOpen = null;
    detailHost.innerHTML = '';
    detailHost.classList.remove('open');
  }

  function renderDetail() {
    const found = findItem(detailOpen);
    if (!found) { closeDetail(); return; }
    const { state, world } = store;
    const card = state.cards.find((c) => c.id === detailOpen);
    const wp = worldPlayerOf(card, world);
    const inXi = found.kind === 'xi';
    const s = found.slot;
    const v = inXi ? s.view : found.item.view;
    const base = wp.stats;
    const statDeltas = {};
    if (inXi) for (const k in s.stats) statDeltas[k] = s.stats[k] - (base[k] ?? s.stats[k]);
    const rar = rarityOfCard(card, wp);
    const qs = quickSellValue(rar) || 0;
    const items = applicableItems(state, world, card.id);
    const club = card.signedFromClubId >= 0 ? world.getClub(card.signedFromClubId) : null;
    const chemLine = inXi && s.chemDetail ? T('detail.chemSplit', { c: s.chemDetail.club, n: s.chemDetail.nation, l: s.chemDetail.league }) : '';
    const statRows = Object.keys(inXi ? s.stats : base).map((k) => {
      const ev = inXi ? s.stats[k] : base[k];
      const d = inXi ? ev - (base[k] ?? ev) : 0;
      return `<tr><th>${esc(STAT_LABELS[k] || k)}</th><td>${base[k] ?? '-'}</td><td><b>${ev}</b>${d ? ` <i class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</i>` : ''}</td><td class="bar"><i style="width:${Math.min(100, ev)}%"></i></td></tr>`;
    }).join('');
    const traits = (card.traits || []).map((t) => TRAIT_CATALOGUE[t]).filter(Boolean)
      .map((t) => `<li><b>${esc(t.name)}</b> <span>${esc(t.description)}</span></li>`).join('') || `<li class="dim">${esc(T('detail.none'))}</li>`;
    const style = card.styleId && STYLE_CARDS[card.styleId] ? `<b>${esc(STYLE_CARDS[card.styleId].name)}</b> <span>${esc(STYLE_CARDS[card.styleId].description)}</span>` : `<span class="dim">${esc(T('detail.none'))}</span>`;
    const ups = (card.upgrades || []).map((u) => `<span class="sq-chip">+${u.amount} ${esc(STAT_LABELS[u.stat] || u.stat)}</span>`).join(' ');
    const itemRows = items.length ? items.map(({ card: it, check }) => {
      const needStat = it.kind === 'training' && !it.stat;
      const label = it.title || it.name || (it.kind === 'trait' && TRAIT_CATALOGUE[it.traitId] ? TRAIT_CATALOGUE[it.traitId].name : it.kind === 'style' && STYLE_CARDS[it.styleId] ? STYLE_CARDS[it.styleId].name : it.kind === 'training' ? `+${it.amount} ${STAT_LABELS[it.stat] || ''}` : `${it.effect || it.kind} ${it.amount ? '+' + it.amount : ''}`);
      const statSel = needStat ? `<select data-stat="${esc(it.id)}" aria-label="${esc(T('detail.pickStat'))}">${Object.keys(base).map((k) => `<option value="${k}">${STAT_LABELS[k]}</option>`).join('')}</select>` : '';
      const ok = check.ok || (needStat && check.error === 'need_stat');
      return `<li class="${ok ? '' : 'dim'}"><span class="sq-kind sq-kind-${esc(it.kind)}">${esc(it.kind)}</span> ${esc(label)} ${statSel}
        <button class="sq-btn sq-btn-s" data-apply="${esc(it.id)}" ${ok ? '' : 'disabled'} title="${esc(ok ? '' : check.message || '')}">${esc(T('detail.applyBtn'))}</button>${ok ? '' : `<small>${esc(check.message || '')}</small>`}</li>`;
    }).join('') : `<li class="dim">${esc(T('detail.noItems'))}</li>`;
    const nat = v.nationName || wp.nation;
    detailHost.innerHTML = `<div class="sq-d-back"></div>
      <aside class="sq-detail" role="dialog" aria-modal="true" aria-label="${esc(wp.name)}">
        <button class="sq-d-close" aria-label="${esc(T('detail.close'))}">&times;</button>
        <div class="sq-d-cardcol"><div class="sq-d-card"></div></div>
        <div class="sq-d-info">
          <h2>${esc(wp.name)}</h2>
          <p class="sq-d-sub">${flagHTML({ flag: v.flag, code: wp.nation, colours: v.nationColours, cls: 'sq-d-flag' })} ${esc(nat)} &middot; ${esc(T('detail.age'))} ${wp.age} &middot; ${esc(T('detail.positions'))}: <b>${esc([wp.pos, ...(wp.altPos || [])].join(' / '))}</b></p>
          <p class="sq-d-sub">${esc(T('detail.club'))}: ${club ? esc(club.name) : esc(T('detail.freeAgent'))} (${esc(card.leagueId || '')})</p>
          <div class="sq-d-kpis">
            <div><span>${esc(T('detail.base'))}</span><b>${wp.ovr}</b><small>${esc(wp.pos)}</small></div>
            ${inXi ? `<div><span>${esc(T('detail.here'))}</span><b class="oop-${s.oop}">${s.ovr}</b><small>${esc(s.slotPos)}</small></div>
            <div><span>${esc(T('detail.chem'))}</span><b>${s.chem}/3</b><small>${esc(chemLine)}</small></div>` : ''}
            <div><span>${esc(T('detail.fitness'))}</span><b>${Math.round(card.fitness ?? 100)}</b></div>
            <div><span>${esc(T('detail.morale'))}</span><b>${Math.round(card.morale ?? 50)}</b></div>
            <div><span>${esc(T('detail.contract'))}</span><b>${card.contract ?? '-'}</b></div>
          </div>
          ${card.injuredFor > 0 ? `<p class="sq-d-warn">${esc(T('squad.status.injured', { n: card.injuredFor }))}</p>` : ''}
          ${card.suspendedFor > 0 ? `<p class="sq-d-warn">${esc(T('squad.status.suspended', { n: card.suspendedFor }))}</p>` : ''}
          <h3>${esc(T('detail.stats'))}</h3>
          <table class="sq-d-stats"><thead><tr><th></th><th>${esc(T('detail.base'))}</th><th>${esc(inXi ? T('detail.here') : T('detail.overall'))}</th><th></th></tr></thead><tbody>${statRows}</tbody></table>
          <h3>${esc(T('detail.traits'))}</h3><ul class="sq-d-list">${traits}</ul>
          <h3>${esc(T('detail.style'))}</h3><p class="sq-d-p">${style}</p>
          <h3>${esc(T('detail.upgrades'))}</h3><p class="sq-d-p">${ups} <span class="dim">${esc(T('detail.slotsUsed', { u: (card.upgrades || []).length, s: v.upgradeSlots }))}</span></p>
          <p class="sq-d-p dim">${esc(T('detail.career', { a: card.career?.apps ?? 0, g: card.career?.goals ?? 0, as: card.career?.assists ?? 0 }))}</p>
          <h3>${esc(T('detail.apply'))}</h3><ul class="sq-d-list sq-d-items">${itemRows}</ul>
          <div class="sq-d-actions">
            <button class="sq-btn" data-move="1">${esc(T('detail.move'))}</button>
            <button class="sq-btn sq-btn-warn" data-sell="1" ${qs > 0 ? '' : 'disabled'}>${esc(T('detail.quickSell', { v: qs }))}</button>
            <button class="sq-btn" data-list="1">${esc(T('detail.listForSale'))}</button>
          </div>
        </div>
      </aside>`;
    detailHost.classList.add('open');
    const full = cardEl({ ...v, statDeltas: inXi ? statDeltas : undefined, ovrDelta: inXi ? s.ovr - wp.ovr : undefined }, { size: 'full', t: store.t && store.t.card });
    detailHost.querySelector('.sq-d-card').appendChild(full);
    tilts.push(attachTilt(full, { animLevel: 2 }));
    detailHost.querySelector('.sq-d-back').addEventListener('click', closeDetail);
    detailHost.querySelector('.sq-d-close').addEventListener('click', closeDetail);
    detailHost.querySelectorAll('[data-apply]').forEach((b) => b.addEventListener('click', () => {
      const sel = detailHost.querySelector(`[data-stat="${CSS.escape(b.dataset.apply)}"]`);
      act(store, toast, 'card/apply', { itemCardId: b.dataset.apply, playerCardId: card.id, stat: sel ? sel.value : undefined }, () => toast(T('detail.applied'), 'good'));
    }));
    detailHost.querySelector('[data-move]').addEventListener('click', () => {
      const id = card.id;
      closeDetail();
      const el = screen.querySelector(`[data-drag][data-card="${CSS.escape(id)}"]`);
      const ref = el ? refOfEl(el) : null;
      if (ref) { select(ref, el); toast(T('squad.selected', { name: wp.name })); }
    });
    const sell = detailHost.querySelector('[data-sell]');
    sell.addEventListener('click', () => {
      if (!sell.classList.contains('confirm')) { sell.classList.add('confirm'); sell.textContent = T('detail.confirmSell', { v: qs }); return; }
      const id = card.id;
      closeDetail();
      act(store, toast, 'card/quickSell', { cardId: id }, (r) => toast(T('detail.sold', { v: r.coins ?? qs }), 'good'));
    });
    detailHost.querySelector('[data-list]').addEventListener('click', () => {
      const id = card.id;
      closeDetail();
      act(store, toast, 'card/listForSale', { cardId: id });
    });
    const g = G();
    if (g) g.fromTo(detailHost.querySelector('.sq-detail'), { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.28, ease: 'power2.out', clearProps: 'transform,opacity' });
  }

  // ---------------------------------------------------------------- lifecycle
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => relayoutIfNeeded()) : null;
  if (ro) ro.observe(pitch.el);
  const onResize = () => relayoutIfNeeded();
  window.addEventListener('resize', onResize);
  const unsub = store.subscribe(() => { render(); if (detailOpen) renderDetail(); });
  render();
  // fonts and the first layout pass can shift sizes: measure again on the next frame
  requestAnimationFrame(() => relayout());

  const api = {
    render, relayout, openDetail, closeDetail, select: (ref) => select(ref, screen.querySelector(`[data-drop="${keyOf(ref)}"]`)), deselect,
    get view() { return view; }, pitch,
  };
  root.__squad = api;
  return () => {
    unsub && unsub();
    if (ro) ro.disconnect();
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('keydown', onKey);
    while (tilts.length) tilts.pop()();
    if (drag) { drag.ghost.remove(); drag = null; }
    delete root.__squad;
    root.innerHTML = '';
  };
}

function saveIcon() {
  return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h8V3M8 21v-7h8v7"/></svg>';
}
