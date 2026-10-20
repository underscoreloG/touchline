// Pack opening showpiece. Pure presentation: the pack is already rolled by logic, this module never rolls.
//
//   const p = openPackUI(root, pack, opts)  -> Promise<{ skipped:boolean, revealedAll:boolean }>
//   p.ui = { advance(), revealAll(), skip(), close(), phase() }   (handle for tests and demos)
//
//   pack = { type:'bronze'|'silver'|'gold'|'promo'|'starter'|'staff'|'training'|..., cards:[cardViewModel...] }
//   opts = {
//     t:           strings override (see PACK_STRINGS = strings.js S.pack for keys)
//     cardStrings: strings for card.js (see CARD_STRINGS = strings.js S.card)
//     animLevel:   0 | 1 | 2   (0 = no shake / flips / walkout)
//     respectReducedMotion: default true -> prefers-reduced-motion forces level 0. Pass false when the
//                  player explicitly chose an animation level in settings.
//     audio:       the audio module (default ./audio.js), or null for silence
//     order:       'rarity' (default: ascending, best card last) | 'given'
//   }
//
// Sequence: idle float -> growing shake with a seam glowing in the best rarity's colour -> rip + light burst
// -> cards one by one (tap / Space / Enter = next, a tap during an animation completes it) -> Elite and Icon
// players get a walkout (flag -> position -> crest -> card) -> end grid with Continue.
// "Reveal all" flips the remaining cards in the grid; "Skip" (or Esc) jumps to the grid with no flips.
// All sequence timing runs on GSAP timelines (no setTimeout), so a test can drive it with gsap.updateRoot().
// The only timer is a safety net that removes the overlay after close() if rAF is stalled.
// canvas-confetti fires only for Elite and Icon.

import { cardEl, cardBack, attachTilt, countTo, shineSweep, normRarity } from './components/card.js';
import { crestSVG, flagHTML } from './components/crest.js';
import { RARITIES } from '../balance.js';
import { S, fmt } from '../strings.js';
import { rngFrom } from '../logic/rng.js';
import defaultAudio from './audio.js';

/** Default strings: the shared table in strings.js (S.pack). `opts.t` (same shape) overrides single entries. */
export const PACK_STRINGS = S.pack;

const BURST = {
  bronze: ['#ff8a2a', '#ffd19a'],
  silver: ['#cfe0ff', '#ffffff'],
  gold: ['#ffc21a', '#fff3b0'],
  elite: ['#7a5cff', '#19e3ff'],
  icon: ['#ff4fc8', '#ffd36b'],
};
const PACK_COL = {
  bronze: ['#6e3f1c', '#e2a46a'], silver: ['#6f7a8e', '#f1f5fb'], gold: ['#9c6c00', '#ffe27a'],
  promo: ['#35157a', '#ff6ad5'], elite: ['#24157a', '#19e3ff'], icon: ['#7a1a5a', '#ffd36b'],
  starter: ['#0d5a3a', '#3ddc97'], staff: ['#0d3d5a', '#19e3ff'], training: ['#1d4a2a', '#9be15d'],
};
const CONFETTI = { elite: ['#7a5cff', '#19e3ff', '#ffffff', '#b9a8ff'], icon: ['#ff6ad5', '#ffd36b', '#fff2c2', '#ffffff'] };

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const rIdx = (r) => RARITIES.indexOf(r);

function tearPolygons(rng) {
  // Pack units: height 100. Top strip covers 0..16, body covers 14..100. Tear line around y = 15.
  const tear = [];
  for (let x = 0; x <= 100; x += 5) tear.push([x, 15 + rng.float(-1.3, 1.3)]);
  const crimp = (yBase, dir) => {
    const pts = [];
    for (let i = 0; i <= 25; i++) pts.push([i * 4, yBase + dir * (i % 2 ? 2.2 : 0)]);
    return pts;
  };
  const toTop = ([x, y]) => `${x}% ${((y / 16) * 100).toFixed(2)}%`;
  const toBody = ([x, y]) => `${x}% ${(((y - 14) / 86) * 100).toFixed(2)}%`;
  const top = [...crimp(0, 1), ...tear.slice().reverse()].map(toTop).join(',');
  const body = [...tear, ...crimp(100, -1).reverse()].map(toBody).join(',');
  return { top: `polygon(${top})`, body: `polygon(${body})` };
}

const LOGO = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-width="5"/><path d="M28,32 H72 V43 H56 V74 H44 V43 H28 Z" fill="currentColor"/></svg>';

/**
 * @param {HTMLElement} root
 * @param {{type:string, cards:object[]}} pack
 * @param {object} [opts]
 */
export function openPackUI(root, pack, opts = {}) {
  let ui;
  const promise = new Promise((resolve) => {
    const g = typeof window !== 'undefined' ? window.gsap : null;
    const tIn = opts.t || {};
    const T = { ...PACK_STRINGS, ...tIn, packName: { ...PACK_STRINGS.packName, ...(tIn.packName || {}) }, rarity: { ...PACK_STRINGS.rarity, ...(tIn.rarity || {}) } };
    const level = (!g || (opts.respectReducedMotion !== false && reducedMotion())) ? 0 : (opts.animLevel ?? 2);
    const mul = level === 1 ? 0.6 : 1;
    const D = (s) => (level === 0 ? 0.001 : s * mul);
    const audio = opts.audio === null ? null : (opts.audio || defaultAudio);
    const sfx = (n, ...a) => { try { if (audio && audio[n]) audio[n](...a); } catch (e) { /* audio is best effort */ } };
    const type = pack.type || 'gold';
    const rng = rngFrom('pack:' + type + ':' + pack.cards.length + ':' + pack.cards.map((c) => (c.name || c.title || '') + (c.ovr || '')).join('|'));

    const items = pack.cards.map((data, idx) => ({ data, idx, r: normRarity(data.rarity), revealed: false }));
    const order = opts.order === 'given' ? items.slice() : items.slice().sort((a, b) => rIdx(a.r) - rIdx(b.r) || a.idx - b.idx);
    const best = order.reduce((m, it) => (rIdx(it.r) > rIdx(m) ? it.r : m), 'bronze');
    const [b1, b2] = BURST[best];
    const [p1, p2] = PACK_COL[type] || PACK_COL.gold;

    const prevFocus = document.activeElement;
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    const ov = document.createElement('div');
    ov.className = `tp tp-lvl-${level}`;
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', T.dialog);
    ov.tabIndex = -1;
    ov.style.setProperty('--b1', b1);
    ov.style.setProperty('--b2', b2);
    ov.style.setProperty('--p1', p1);
    ov.style.setProperty('--p2', p2);
    const poly = tearPolygons(rng);
    const packName = T.packName[type] || type;
    ov.innerHTML = `
      <div class="tp-bg"></div>
      <div class="tp-rays"></div>
      <div class="tp-burst"></div>
      <div class="tp-top">
        <div class="tp-title">${esc(packName)}</div>
        <div class="tp-btns">
          <button type="button" class="tp-btn tp-revealall">${esc(T.revealAll)}</button>
          <button type="button" class="tp-btn tp-skip">${esc(T.skip)}</button>
        </div>
      </div>
      <div class="tp-stage">
        <div class="tp-pack">
          <div class="tp-pack-glow"></div>
          <div class="tp-pack-body" style="clip-path:${poly.body}">
            <div class="tp-pack-shine"></div>
            <div class="tp-pack-logo">${LOGO}</div>
            <div class="tp-pack-name">${esc(packName)}</div>
            <div class="tp-pack-count">${esc(fmt(T.cards, { n: pack.cards.length }))}</div>
          </div>
          <div class="tp-pack-top" style="clip-path:${poly.top}"><div class="tp-pack-shine"></div></div>
          <div class="tp-pack-seam"></div>
        </div>
        <div class="tp-slot"></div>
      </div>
      <div class="tp-walk" aria-hidden="true"></div>
      <div class="tp-gridwrap" hidden>
        <div class="tp-gridtitle">${esc(T.summary)}</div>
        <div class="tp-grid"></div>
        <button type="button" class="tp-btn tp-btn-main tp-continue">${esc(T.continue)}</button>
      </div>
      <div class="tp-bottom">
        <div class="tp-cap"></div>
        <div class="tp-hint">${esc(T.open)}</div>
        <div class="tp-dots">${order.map(() => '<i class="tp-dot"></i>').join('')}</div>
      </div>
      <canvas class="tp-confetti"></canvas>
      <div class="tp-live" aria-live="polite"></div>`;
    root.appendChild(ov);
    const $ = (s) => ov.querySelector(s);
    const packEl = $('.tp-pack'); const topEl = $('.tp-pack-top'); const bodyEl = $('.tp-pack-body');
    const glowEl = $('.tp-pack-glow'); const seamEl = $('.tp-pack-seam'); const burstEl = $('.tp-burst');
    const raysEl = $('.tp-rays'); const slot = $('.tp-slot'); const walk = $('.tp-walk');
    const gridWrap = $('.tp-gridwrap'); const grid = $('.tp-grid'); const hint = $('.tp-hint');
    const cap = $('.tp-cap'); const live = $('.tp-live'); const dots = [...ov.querySelectorAll('.tp-dot')];
    const btnAll = $('.tp-revealall'); const btnSkip = $('.tp-skip'); const btnCont = $('.tp-continue');

    let confettiFire = null;
    if (level > 0 && typeof window.confetti === 'function') {
      confettiFire = window.confetti.create($('.tp-confetti'), { resize: true, useWorker: false, disableForReducedMotion: opts.respectReducedMotion !== false });
    }

    let phase = 'idle';
    let cur = -1;
    let active = null;
    let currentWrap = null;
    let skipped = false; let revealedAll = false;
    const loops = [];
    const detachers = [];

    // ---------------------------------------------------------------- idle
    if (g && level > 0) {
      loops.push(g.to(packEl, { y: -10, rotation: 1.5, duration: 1.6, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
      loops.push(g.fromTo(ov.querySelectorAll('.tp-pack-shine'), { backgroundPosition: '-160% 0' }, { backgroundPosition: '260% 0', duration: 2.6, ease: 'power1.inOut', repeat: -1, repeatDelay: 0.8 }));
      g.from(packEl, { y: 80, scale: 0.8, opacity: 0, duration: 0.6, ease: 'back.out(1.6)' });
    }

    const announce = (s) => { live.textContent = s; };

    // ---------------------------------------------------------------- opening
    function startOpening() {
      phase = 'opening';
      hint.textContent = '';
      sfx('click');
      if (!g || level === 0) {
        packEl.style.display = 'none';
        showCard(0);
        return;
      }
      loops.forEach((l) => l.kill());
      const tl = g.timeline({ onComplete: () => { packEl.style.display = 'none'; } });
      active = tl;
      tl.to(packEl, { y: 0, rotation: 0, scale: 1.06, duration: D(0.25), ease: 'power2.out' });
      tl.add(() => sfx('whoosh'), 0.1);
      // Shake: 18 swings, each faster and wider than the last. Explicit positions so the glow tweens running
      // in parallel never push the shake back.
      const steps = 18;
      let at = D(0.25);
      for (let i = 0; i < steps; i++) {
        const a = 1.2 + i * 0.7;
        const sign = i % 2 ? 1 : -1;
        const dur = D(0.09 - 0.045 * (i / steps));
        tl.to(packEl, { x: sign * a * rng.float(0.75, 1.1), y: rng.float(-a, a) * 0.35, rotation: sign * a * 0.5, duration: dur, ease: 'sine.inOut' }, at);
        at += dur;
      }
      tl.to(glowEl, { opacity: 1, scale: 1.25, duration: at - D(0.2), ease: 'power1.in' }, D(0.2));
      tl.to(seamEl, { opacity: 1, scaleX: 1, duration: at - D(0.55), ease: 'power2.in' }, D(0.55));
      tl.addLabel('rip', at);
      tl.add(() => sfx('rip'), 'rip');
      tl.to(packEl, { x: 0, y: 0, rotation: 0, duration: D(0.08) }, 'rip');
      tl.to(topEl, { y: '-180%', x: 70, rotation: 24, opacity: 0, duration: D(0.55), ease: 'power2.out' }, 'rip');
      tl.fromTo(burstEl, { scale: 0.2, opacity: 0 }, { scale: 2.6, opacity: 1, duration: D(0.32), ease: 'power2.out' }, 'rip');
      tl.to(raysEl, { opacity: 0.85, duration: D(0.3) }, 'rip');
      tl.to(seamEl, { opacity: 0, duration: D(0.2) }, 'rip+=0.1');
      tl.to(bodyEl, { y: '75%', opacity: 0, duration: D(0.55), ease: 'power2.in' }, 'rip+=0.12');
      tl.to(glowEl, { opacity: 0, duration: D(0.4) }, 'rip+=0.12');
      tl.to(burstEl, { opacity: 0, scale: 3.4, duration: D(0.6), ease: 'power1.out' }, 'rip+=0.34');
      tl.to(raysEl, { opacity: 0.35, duration: D(0.8) }, 'rip+=0.5');
      tl.add(() => { loops.push(g.to(raysEl, { rotation: 360, duration: 40, ease: 'none', repeat: -1 })); showCard(0); }, 'rip+=0.42');
    }

    // ---------------------------------------------------------------- one card
    function markDot(k, r) {
      const d = dots[k];
      if (d) { d.className = `tp-dot tp-dot-${r} tp-dot-on`; }
    }

    function countUpFront(front, data, delay = 0) {
      if (level === 0) return;
      const ovr = front.querySelector('[data-f="ovr"]');
      if (ovr && data.ovr != null) countTo(ovr, data.ovr, { from: Math.max(0, data.ovr - 25), duration: D(0.9), delay });
      front.querySelectorAll('[data-stat]').forEach((n, i) => {
        const v = parseInt(n.textContent, 10);
        if (!Number.isNaN(v)) countTo(n, v, { from: Math.max(0, v - 30), duration: D(0.7), delay: delay + 0.05 + i * 0.03 });
      });
    }

    function celebrate(r) {
      if (r !== 'elite' && r !== 'icon') return;
      sfx(r === 'icon' ? 'goalHorn' : 'crowdSwell');
      if (!confettiFire) return;
      const colors = CONFETTI[r];
      confettiFire({ particleCount: r === 'icon' ? 160 : 110, spread: 75, startVelocity: 42, origin: { x: 0.5, y: 0.55 }, colors, scalar: 0.95, ticks: 220 });
      if (r === 'icon') {
        confettiFire({ particleCount: 70, angle: 60, spread: 55, origin: { x: 0, y: 0.8 }, colors });
        confettiFire({ particleCount: 70, angle: 120, spread: 55, origin: { x: 1, y: 0.8 }, colors });
      }
    }

    function flipTimeline(it, back, front, cglow) {
      const t = g.timeline();
      t.to(back, { rotateY: 90, scale: 1.03, duration: D(0.16), ease: 'power2.in' });
      t.set(back, { display: 'none' });
      t.set(front, { visibility: 'visible' });
      t.fromTo(front, { rotateY: -90, scale: 1.1 }, { rotateY: 0, scale: 1, duration: D(0.42), ease: 'back.out(1.7)' });
      t.add(() => {
        it.revealed = true;
        markDot(order.indexOf(it), it.r);
        sfx('reveal', it.r);
        countUpFront(front, it.data);
        if (it.r === 'gold' || it.r === 'elite' || it.r === 'icon') shineSweep(front, D(0.9));
        celebrate(it.r);
        detachers.push(attachTilt(front, { animLevel: level, respectReducedMotion: opts.respectReducedMotion }));
      }, '<0.04');
      t.fromTo(cglow, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: D(0.5), ease: 'power2.out' }, '<');
      return t;
    }

    function walkoutTimeline(it, wrap) {
      const d = it.data;
      walk.innerHTML = `<div class="tp-w-dim"></div><div class="tp-w-spot"></div>`
        + `<div class="tp-w-step tp-w-flag">${flagHTML({ flag: d.flag, code: d.nation, colours: d.nationColours, cls: 'tp-w-flagicon' })}<span>${esc(d.nationName || d.nation || '')}</span></div>`
        + `<div class="tp-w-step tp-w-pos"><b>${esc(d.pos || '')}</b></div>`
        + `<div class="tp-w-step tp-w-club">${d.crest ? `<div class="tp-w-crest">${crestSVG(d.crest)}</div>` : ''}<span>${esc(d.clubName || '')}</span></div>`;
      walk.style.setProperty('--wc1', BURST[it.r][0]);
      walk.style.setProperty('--wc2', BURST[it.r][1]);
      const dim = walk.querySelector('.tp-w-dim');
      const spot = walk.querySelector('.tp-w-spot');
      const steps = [...walk.querySelectorAll('.tp-w-step')];
      const t = g.timeline();
      t.set(walk, { display: 'block' });
      t.to(wrap, { scale: 1.06, duration: D(0.5), ease: 'sine.inOut' });
      t.to(wrap.querySelector('.tp-cardglow'), { opacity: 1, scale: 1.15, duration: D(0.5) }, '<');
      t.to(wrap, { opacity: 0, scale: 0.7, duration: D(0.25), ease: 'power2.in' });
      t.to(dim, { opacity: 1, duration: D(0.35) }, '<');
      t.add(() => sfx('crowdSwell', 3.4 * mul), '<');
      t.fromTo(spot, { opacity: 0, scaleX: 0.3 }, { opacity: 1, scaleX: 1, duration: D(0.5), ease: 'power2.out' }, '<0.1');
      steps.forEach((s, i) => {
        t.fromTo(s, { opacity: 0, scale: 1.6, y: 0 }, { opacity: 1, scale: 1, duration: D(0.38), ease: 'power3.out' }, i === 0 ? '>' : '>-0.05');
        t.add(() => sfx('whoosh'), '<');
        t.to(s, { opacity: 0, scale: 0.92, y: -24, duration: D(0.24), ease: 'power2.in' }, '>' + D(0.62));
      });
      t.set(wrap.querySelector('.tp-cardglow'), { opacity: 0 });
      t.fromTo(wrap, { opacity: 0, scale: 1.5, y: -30 }, { opacity: 1, scale: 1, y: 0, duration: D(0.4), ease: 'back.out(1.8)', immediateRender: false });
      t.to(spot, { opacity: 0.5, duration: D(0.4) }, '<');
      return t;
    }

    function endWalkoutDim() {
      const dim = walk.querySelector('.tp-w-dim');
      const spot = walk.querySelector('.tp-w-spot');
      if (dim) g.to([dim, spot], { opacity: 0, duration: D(0.6), delay: D(0.3), onComplete: () => { walk.style.display = 'none'; walk.innerHTML = ''; } });
    }

    function showCard(k) {
      phase = 'reveal';
      cur = k;
      const it = order[k];
      if (currentWrap) {
        const old = currentWrap;
        const oldFront = old.querySelector('.tp-front');
        if (oldFront && oldFront.__tcDetach) oldFront.__tcDetach();
        if (g && level > 0) g.to(old, { x: -140, y: 60, scale: 0.35, opacity: 0, rotation: -12, duration: D(0.32), ease: 'power2.in', onComplete: () => old.remove() });
        else old.remove();
      }
      const wrap = document.createElement('div');
      wrap.className = 'tp-card';
      const cglow = document.createElement('div');
      cglow.className = `tp-cardglow tp-cg-${it.r}`;
      const back = cardBack({ packType: type, t: opts.cardStrings });
      const front = cardEl(it.data, { size: 'full', t: opts.cardStrings });
      front.classList.add('tp-front');
      wrap.append(cglow, back, front);
      slot.appendChild(wrap);
      currentWrap = wrap;
      cap.innerHTML = '';
      hint.textContent = '';
      const n = order.length;
      const afterReveal = () => {
        cap.innerHTML = `<b class="tp-cap-r tp-cap-${it.r}">${esc(T.rarity[it.r] || it.r)}</b><span>${esc(fmt(T.cardOf, { i: k + 1, n }))}</span>`;
        hint.textContent = k === n - 1 ? T.last : T.next;
        announce(`${T.rarity[it.r] || ''} ${front.getAttribute('aria-label') || ''}. ${fmt(T.cardOf, { i: k + 1, n })}`);
      };
      if (!g || level === 0) {
        back.style.display = 'none';
        front.style.visibility = 'visible';
        cglow.style.opacity = 1;
        it.revealed = true;
        markDot(k, it.r);
        sfx('reveal', it.r);
        detachers.push(attachTilt(front, { animLevel: level, respectReducedMotion: opts.respectReducedMotion }));
        afterReveal();
        return;
      }
      const isWalk = (it.r === 'elite' || it.r === 'icon') && (it.data.kind || 'player') === 'player';
      const tl = g.timeline();
      active = tl;
      tl.fromTo(wrap, { y: 190, scale: 0.5, rotation: -7, opacity: 0 }, { y: 0, scale: 1, rotation: 0, opacity: 1, duration: D(0.45), ease: 'power3.out' });
      tl.add(() => sfx('whoosh'), 0);
      if (isWalk) {
        phase = 'walkout';
        tl.add(walkoutTimeline(it, wrap), '+=' + D(0.1));
        tl.add(flipTimeline(it, back, front, cglow), '>');
        tl.add(() => { phase = 'reveal'; endWalkoutDim(); }, '>');
      } else {
        tl.add(flipTimeline(it, back, front, cglow), '+=' + D(0.12));
      }
      tl.add(afterReveal, '>');
    }

    // ---------------------------------------------------------------- grid
    function toGrid(mode) {
      if (phase === 'grid' || phase === 'done') return;
      if (mode === 'skip') skipped = true; else revealedAll = true;
      phase = 'grid';
      if (active) { active.kill(); active = null; }
      loops.forEach((l) => l.kill());
      loops.length = 0;
      if (g) g.killTweensOf([packEl, topEl, bodyEl, glowEl, seamEl, burstEl]);
      packEl.style.display = 'none';
      burstEl.style.opacity = 0;
      walk.style.display = 'none';
      walk.innerHTML = '';
      if (currentWrap) {
        const f = currentWrap.querySelector('.tp-front');
        if (f && f.__tcDetach) f.__tcDetach();
        currentWrap.remove();
        currentWrap = null;
      }
      ov.querySelector('.tp-top .tp-btns').hidden = true;
      ov.querySelector('.tp-bottom').hidden = true;
      gridWrap.hidden = false;
      ov.classList.add('tp-at-grid');
      if (g) g.to(raysEl, { opacity: 0.18, duration: 0.5 });
      grid.innerHTML = '';
      const cells = [];
      const toFlip = [];
      order.forEach((it) => {
        const cell = document.createElement('div');
        cell.className = `tp-cell tp-cell-${it.r}`;
        const front = cardEl(it.data, { size: 'full', t: opts.cardStrings });
        front.classList.add('tp-front');
        if (mode === 'reveal' && !it.revealed && g && level > 0) {
          const back = cardBack({ packType: type, t: opts.cardStrings });
          cell.append(back, front);
          toFlip.push({ it, back, front });
        } else {
          front.style.visibility = 'visible';
          cell.append(front);
          detachers.push(attachTilt(front, { animLevel: level, respectReducedMotion: opts.respectReducedMotion }));
        }
        grid.appendChild(cell);
        cells.push(cell);
        it.revealed = true;
      });
      if (g && level > 0) {
        const tl = g.timeline();
        tl.fromTo(cells, { y: 40, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: D(0.4), stagger: D(0.06), ease: 'power3.out' });
        let bestNew = null;
        toFlip.forEach(({ it, back, front }, i) => {
          const at = D(0.35) + i * D(0.16);
          tl.to(back, { rotateY: 90, duration: D(0.14), ease: 'power2.in' }, at);
          tl.set(back, { display: 'none' }, at + D(0.14));
          tl.set(front, { visibility: 'visible' }, at + D(0.14));
          tl.fromTo(front, { rotateY: -90 }, { rotateY: 0, duration: D(0.32), ease: 'back.out(1.6)' }, at + D(0.14));
          tl.add(() => { countUpFront(front, it.data); detachers.push(attachTilt(front, { animLevel: level, respectReducedMotion: opts.respectReducedMotion })); }, at + D(0.16));
          if (!bestNew || rIdx(it.r) > rIdx(bestNew)) bestNew = it.r;
        });
        if (bestNew) tl.add(() => { sfx('reveal', bestNew); celebrate(bestNew); }, D(0.4) + toFlip.length * D(0.16));
      }
      btnCont.focus({ preventScroll: true });
      announce(T.summary);
    }

    // ---------------------------------------------------------------- controls
    function advance() {
      if (phase === 'done') return;
      if (phase === 'grid') { close(); return; }
      if (active && active.progress() < 1) { active.progress(1); return; }
      if (phase === 'idle') { startOpening(); return; }
      if (phase === 'opening') return;
      sfx('click');
      if (cur < order.length - 1) showCard(cur + 1);
      else toGrid('reveal');
    }

    function close() {
      if (phase === 'done') return;
      phase = 'done';
      detachers.forEach((f) => f && f());
      loops.forEach((l) => l.kill());
      if (active) active.kill();
      if (confettiFire && confettiFire.reset) confettiFire.reset();
      ov.removeEventListener('keydown', onKey);
      // Resolve and give the page back immediately; only the cosmetic fade-out waits on the animation clock.
      // The timer fallback removes the overlay even when rAF is stalled (background tab, throttled preview).
      let removed = false;
      const remove = () => { if (!removed) { removed = true; ov.remove(); } };
      ov.style.pointerEvents = 'none';
      document.documentElement.style.overflow = prevOverflow;
      sfx('click');
      if (g && level > 0) {
        g.to(ov, { opacity: 0, duration: 0.25, onComplete: remove });
        setTimeout(remove, 800);
      } else remove();
      if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
      resolve({ skipped, revealedAll });
    }

    function onKey(e) {
      if (e.key === 'Tab') {
        const f = [...ov.querySelectorAll('button')].filter((b) => !b.closest('[hidden]'));
        if (!f.length) { e.preventDefault(); return; }
        const i = f.indexOf(document.activeElement);
        const nx = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === f.length - 1 ? 0 : i + 1);
        f[nx].focus();
        e.preventDefault();
        return;
      }
      if (e.target && e.target.closest && e.target.closest('button') && (e.key === 'Enter' || e.key === ' ')) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance(); }
      else if (e.key === 'Escape') { e.preventDefault(); if (phase === 'grid') close(); else toGrid('skip'); }
    }

    ov.addEventListener('keydown', onKey);
    ov.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      if (phase === 'grid') return;
      advance();
    });
    btnAll.addEventListener('click', () => { sfx('click'); toGrid('reveal'); });
    btnSkip.addEventListener('click', () => { sfx('click'); toGrid('skip'); });
    btnCont.addEventListener('click', () => close());
    ov.focus({ preventScroll: true });
    if (!g) toGrid('skip');

    ui = {
      advance, close,
      revealAll: () => toGrid('reveal'),
      skip: () => toGrid('skip'),
      phase: () => phase,
      current: () => cur,
    };
  });
  promise.ui = ui;
  return promise;
}
