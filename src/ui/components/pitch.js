// Top-down pitch renderer for the match view. Canvas 2D, devicePixelRatio aware.
// Logical coordinates are pitch metres (105 x 68) with a stand / advertising-board surround; one toScreen(x, y).
// The renderer only reads the choreography state (src/logic/choreography.js); it never changes it.
//
//   const pitch = createPitch(canvas, { home: MatchTeam, away: MatchTeam });
//   pitch.resize(cssWidth, cssHeight);
//   pitch.render(ch, alpha);          // alpha: interpolation between the previous and the current 20 ms step
//   pitch.toScreen(x, y)              // -> {x, y} in CSS pixels
//   pitch.metrics()                   // -> { scale, discPx } for tests (disc diameter in CSS px)

import { rngFrom } from '../../logic/rng.js';
import { PITCH, clockLabel } from '../../logic/choreography.js';
import { S } from '../../strings.js';

const L = PITCH.L, W = PITCH.W;
const MARGIN_X = 5.5, MARGIN_Y = 5;       // metres of surround (boards + stand)
const DISC_R = 1.4;
const MIN_DISC_PX = 7.2;                  // radius in CSS px: discs stay >= 14 px wide at 390 px

const KEEPER_COLOURS = ['#f2c440', '#3ddc97', '#ff7ad9', '#19e3ff', '#ff8a00', '#b6ff3b', '#7a5cff'];

function hexRgb(hex) {
  const h = String(hex || '#888888').replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
function luma(hex) { const [r, g, b] = hexRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
function colDist(a, b) { const x = hexRgb(a), y = hexRgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); }
function rgba(hex, a) { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; }

/**
 * Kit colours for both sides: away switches to its second colour when the primaries clash, keepers get two
 * distinct colours far from both kits.
 */
export function kitColours(home, away) {
  const hc = (home.colours && home.colours[0]) || '#2b6cff';
  const hs = (home.colours && home.colours[1]) || '#ffffff';
  let ac = (away.colours && away.colours[0]) || '#e5484d';
  let as = (away.colours && away.colours[1]) || '#111111';
  if (colDist(hc, ac) < 110) { const t = ac; ac = as; as = t; }
  if (colDist(hc, ac) < 110) { ac = luma(hc) > 0.5 ? '#1b1f2a' : '#f4f4f4'; as = luma(ac) > 0.5 ? '#111111' : '#ffffff'; }
  const score = (c) => Math.min(colDist(c, hc), colDist(c, ac), colDist(c, '#3f8f3a'));
  const ks = KEEPER_COLOURS.slice().sort((a, b) => score(b) - score(a));
  const ring = (fill, sec) => (colDist(fill, sec) > 120 ? sec : luma(fill) > 0.55 ? '#111111' : '#ffffff');
  return {
    home: { fill: hc, ring: ring(hc, hs), text: luma(hc) > 0.55 ? '#111111' : '#ffffff' },
    away: { fill: ac, ring: ring(ac, as), text: luma(ac) > 0.55 ? '#111111' : '#ffffff' },
    homeGK: { fill: ks[0], ring: '#111111', text: luma(ks[0]) > 0.55 ? '#111111' : '#ffffff' },
    awayGK: { fill: ks[1], ring: '#111111', text: luma(ks[1]) > 0.55 ? '#111111' : '#ffffff' },
  };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{home:object, away:object, boards?:string[]}} opts
 */
export function createPitch(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  const kits = kitColours(opts.home || {}, opts.away || {});
  const boards = opts.boards || S.match.boards;
  let cssW = 0, cssH = 0, dpr = 1, scale = 1, ox = 0, oy = 0, discR = DISC_R;
  let bg = null;
  const toScreen = (x, y) => ({ x: ox + (x + MARGIN_X) * scale, y: oy + (y + MARGIN_Y) * scale });

  function resize(w, h) {
    dpr = Math.min(3, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    cssW = Math.max(100, Math.floor(w));
    cssH = Math.max(80, Math.floor(h));
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    const tw = L + MARGIN_X * 2, th = W + MARGIN_Y * 2;
    scale = Math.min(cssW / tw, cssH / th);
    ox = (cssW - tw * scale) / 2;
    oy = (cssH - th * scale) / 2;
    discR = Math.max(DISC_R, MIN_DISC_PX / scale);
    bg = drawBackground();
  }

  // ---------------------------------------------------------------- static background (cached)

  function drawBackground() {
    const off = document.createElement('canvas');
    off.width = canvas.width; off.height = canvas.height;
    const g = off.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // stadium surround
    g.fillStyle = '#0a0d14';
    g.fillRect(0, 0, cssW, cssH);
    const s0 = toScreen(-MARGIN_X, -MARGIN_Y), s1 = toScreen(L + MARGIN_X, W + MARGIN_Y);
    const st = g.createLinearGradient(0, s0.y, 0, s1.y);
    st.addColorStop(0, '#161b29'); st.addColorStop(0.5, '#10141f'); st.addColorStop(1, '#161b29');
    g.fillStyle = st;
    g.fillRect(s0.x, s0.y, s1.x - s0.x, s1.y - s0.y);
    // crowd specks (seeded)
    const rng = rngFrom('stand');
    const n = Math.round((s1.x - s0.x) * (s1.y - s0.y) / 90);
    for (let i = 0; i < n; i++) {
      const x = s0.x + rng.next() * (s1.x - s0.x), y = s0.y + rng.next() * (s1.y - s0.y);
      const p = { x: (x - ox) / scale - MARGIN_X, y: (y - oy) / scale - MARGIN_Y };
      if (p.x > -2.6 && p.x < L + 2.6 && p.y > -2.6 && p.y < W + 2.6) continue;
      g.fillStyle = rng.next() < 0.5 ? 'rgba(255,255,255,0.07)' : rng.next() < 0.5 ? rgba(kits.home.fill, 0.18) : rgba(kits.away.fill, 0.16);
      g.fillRect(x, y, 1.2, 1.2);
    }
    // advertising boards around the pitch
    const bw = 1.1 * scale;
    const a0 = toScreen(-2.6, -2.6), a1 = toScreen(L + 2.6, W + 2.6);
    g.fillStyle = '#1f2638';
    g.fillRect(a0.x, a0.y, a1.x - a0.x, bw); g.fillRect(a0.x, a1.y - bw, a1.x - a0.x, bw);
    g.fillRect(a0.x, a0.y, bw, a1.y - a0.y); g.fillRect(a1.x - bw, a0.y, bw, a1.y - a0.y);
    const segs = 6;
    const segW = (a1.x - a0.x) / segs;
    g.font = `700 ${Math.max(6, bw * 0.62)}px "Arial Narrow", Arial, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < segs; i++) {
      const hue = i % 2 ? kits.home.fill : kits.away.fill;
      for (const yy of [a0.y, a1.y - bw]) {
        g.fillStyle = rgba(hue, 0.55);
        g.fillRect(a0.x + i * segW + 1, yy + 0.5, segW - 2, bw - 1);
        g.fillStyle = 'rgba(255,255,255,0.85)';
        if (bw > 5) g.fillText(boards[i % boards.length], a0.x + (i + 0.5) * segW, yy + bw / 2 + 0.5);
      }
    }
    // grass with mown stripes
    const p0 = toScreen(-2, -2), p1 = toScreen(L + 2, W + 2);
    g.fillStyle = '#2f7a35';
    g.fillRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
    const stripes = 14;
    for (let i = 0; i < stripes; i++) {
      const xa = toScreen(i * L / stripes, 0).x, xb = toScreen((i + 1) * L / stripes, 0).x;
      g.fillStyle = i % 2 ? '#358a3c' : '#2e7b34';
      g.fillRect(xa, toScreen(0, 0).y, xb - xa + 0.5, (W) * scale);
    }
    // markings
    g.strokeStyle = 'rgba(255,255,255,0.86)';
    g.lineWidth = Math.max(1, 0.13 * scale);
    const rect = (x, y, w, h) => { const a = toScreen(x, y); g.strokeRect(a.x, a.y, w * scale, h * scale); };
    rect(0, 0, L, W);
    const half = toScreen(L / 2, 0);
    g.beginPath(); g.moveTo(half.x, half.y); g.lineTo(half.x, half.y + W * scale); g.stroke();
    const c = toScreen(L / 2, W / 2);
    g.beginPath(); g.arc(c.x, c.y, PITCH.circle * scale, 0, Math.PI * 2); g.stroke();
    const dot = (x, y) => { const p = toScreen(x, y); g.beginPath(); g.arc(p.x, p.y, Math.max(1.2, 0.25 * scale), 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.9)'; g.fill(); };
    dot(L / 2, W / 2);
    for (const side of [0, 1]) {
      const bx = side ? L - PITCH.boxDepth : 0;
      rect(bx, W / 2 - PITCH.boxHalf, PITCH.boxDepth, PITCH.boxHalf * 2);
      const sx = side ? L - PITCH.sixDepth : 0;
      rect(sx, W / 2 - PITCH.sixHalf, PITCH.sixDepth, PITCH.sixHalf * 2);
      const spot = side ? L - PITCH.spot : PITCH.spot;
      dot(spot, W / 2);
      // penalty arc: the part of the 9.15 m circle outside the box
      const sp = toScreen(spot, W / 2);
      const dx = PITCH.boxDepth - PITCH.spot;
      const ang = Math.acos(dx / PITCH.circle);
      g.beginPath();
      if (side) g.arc(sp.x, sp.y, PITCH.circle * scale, Math.PI - ang, Math.PI + ang);
      else g.arc(sp.x, sp.y, PITCH.circle * scale, -ang, ang);
      g.stroke();
      // goal and net
      const gy0 = W / 2 - PITCH.goalHalf;
      const gx = side ? L : -PITCH.netDepth;
      const gp = toScreen(gx, gy0);
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.fillRect(gp.x, gp.y, PITCH.netDepth * scale, PITCH.goalHalf * 2 * scale);
      g.save();
      g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 0.6;
      for (let k = 0.5; k < PITCH.goalHalf * 2; k += 0.7) { const q = toScreen(gx, gy0 + k); g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x + PITCH.netDepth * scale, q.y); g.stroke(); }
      for (let k = 0.5; k < PITCH.netDepth; k += 0.7) { const q = toScreen(gx + k, gy0); g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x, q.y + PITCH.goalHalf * 2 * scale); g.stroke(); }
      g.restore();
      g.lineWidth = Math.max(1.5, 0.2 * scale);
      g.strokeStyle = '#f4f4f4';
      g.strokeRect(gp.x, gp.y, PITCH.netDepth * scale, PITCH.goalHalf * 2 * scale);
      g.lineWidth = Math.max(1, 0.13 * scale);
      g.strokeStyle = 'rgba(255,255,255,0.86)';
    }
    // corner arcs
    for (const [x, y, a0c, a1c] of [[0, 0, 0, Math.PI / 2], [L, 0, Math.PI / 2, Math.PI], [L, W, Math.PI, Math.PI * 1.5], [0, W, Math.PI * 1.5, Math.PI * 2]]) {
      const p = toScreen(x, y);
      g.beginPath(); g.arc(p.x, p.y, 1 * scale, a0c, a1c); g.stroke();
    }
    // vignette
    const vg = g.createRadialGradient(cssW / 2, cssH / 2, Math.min(cssW, cssH) * 0.35, cssW / 2, cssH / 2, Math.max(cssW, cssH) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    g.fillStyle = vg;
    g.fillRect(0, 0, cssW, cssH);
    return off;
  }

  // ---------------------------------------------------------------- dynamic layer

  function kitFor(d) {
    if (d.pos === 'GK') return d.side === 'home' ? kits.homeGK : kits.awayGK;
    return kits[d.side];
  }

  function drawDisc(x, y, d, alpha) {
    const k = kitFor(d);
    const r = discR * scale;
    ctx.globalAlpha = alpha;
    // soft shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(x + r * 0.25, y + r * 0.35, r * 0.95, r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = k.fill;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = Math.max(1.4, r * 0.2);
    ctx.strokeStyle = k.ring;
    ctx.stroke();
    if (d.number != null) {
      ctx.fillStyle = k.text;
      ctx.font = `800 ${Math.max(7.5, r * 1.05)}px "Segoe UI", system-ui, Arial, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(d.number), x, y + r * 0.06);
    }
    // cards and injury
    if (d.red || d.yellow) {
      ctx.fillStyle = d.red ? '#ff3341' : '#ffd21f';
      ctx.fillRect(x + r * 0.55, y - r * 1.25, Math.max(3, r * 0.42), Math.max(4.5, r * 0.6));
    }
    if (d.injured) {
      ctx.strokeStyle = '#ff2d3d';
      ctx.lineWidth = Math.max(1.8, r * 0.28);
      const q = r * 0.55;
      ctx.beginPath(); ctx.moveTo(x - q, y - r - q * 1.4); ctx.lineTo(x + q, y - r + q * 0.2);
      ctx.moveTo(x + q, y - r - q * 1.4); ctx.lineTo(x - q, y - r + q * 0.2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function label(x, y, text, k) {
    if (!text) return;
    ctx.font = `700 ${Math.max(10, Math.min(14, scale * 2.3))}px "Segoe UI", system-ui, Arial, sans-serif`;
    const w = ctx.measureText(text).width + 10;
    const h = Math.max(15, Math.min(20, scale * 3.2));
    const r = discR * scale;
    let lx = x - w / 2, ly = y - r - h - 4;
    if (ly < 2) ly = y + r + 4;
    lx = Math.max(2, Math.min(cssW - w - 2, lx));
    ctx.fillStyle = 'rgba(8,10,16,0.82)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(lx, ly, w, h, h / 2); else ctx.rect(lx, ly, w, h);
    ctx.fill();
    ctx.fillStyle = k.fill;
    ctx.fillRect(lx + 4, ly + h - 3, w - 8, 1.5);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, lx + w / 2, ly + h / 2);
  }

  const lerp = (a, b, u) => a + (b - a) * u;

  /** Draw one frame of the choreography state. */
  function render(ch, alpha = 1) {
    if (!bg) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // screen shake on a goal
    let sx = 0, sy = 0;
    if (ch.shake > 0) { const m = ch.shake * 5; sx = Math.sin(ch.t * 83) * m; sy = Math.cos(ch.t * 71) * m; }
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.drawImage(bg, 0, 0, bg.width, bg.height, 0, 0, cssW, cssH);
    const fade = ch.fade ? ch.fade.a : 1;

    // net flash
    if (ch.net && ch.t - ch.net.t < 0.9) {
      const k = 1 - (ch.t - ch.net.t) / 0.9;
      const gx = ch.net.x >= L / 2 ? L : -PITCH.netDepth;
      const p = toScreen(gx, W / 2 - PITCH.goalHalf);
      ctx.fillStyle = `rgba(255,255,255,${0.75 * k})`;
      ctx.fillRect(p.x, p.y, PITCH.netDepth * scale, PITCH.goalHalf * 2 * scale);
    }
    // pass trails (fade over 0.4 s)
    for (const tr of ch.trails) {
      const age = ch.t - tr.t;
      if (age > 0.6 || age < 0) continue;
      const a = toScreen(tr.x0, tr.y0), b = toScreen(tr.x1, tr.y1);
      ctx.strokeStyle = `rgba(255,255,255,${0.42 * (1 - age / 0.6) * fade})`;
      ctx.lineWidth = Math.max(1, 0.28 * scale);
      ctx.setLineDash(tr.kind === 'longBall' || tr.kind === 'cross' || tr.kind === 'clear' ? [4, 4] : []);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.setLineDash([]);

    // officials
    for (const o of ch.officials) {
      const x = lerp(o.px || o.x, o.x, alpha), y = lerp(o.py || o.y, o.y, alpha);
      const p = toScreen(x, y);
      const r = (o.kind === 'ref' ? discR * 0.7 : discR * 0.5) * scale;
      ctx.globalAlpha = fade;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(p.x + r * 0.25, p.y + r * 0.3, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = o.kind === 'ref' ? '#0b0b0b' : '#27c46b';
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 1.4; ctx.strokeStyle = o.kind === 'ref' ? '#ffd21f' : '#0b3b20'; ctx.stroke();
      if (o.kind !== 'ref' && ch.flag && ((o.kind === 'ar1') === (ch.flag.x >= L / 2))) {
        ctx.fillStyle = '#ffd21f';
        ctx.fillRect(p.x + r * 0.6, p.y - r * 3.2, r * 1.6, r * 1.2);
        ctx.strokeStyle = '#ffd21f'; ctx.beginPath(); ctx.moveTo(p.x + r * 0.6, p.y); ctx.lineTo(p.x + r * 0.6, p.y - r * 3.2); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // players, sorted by y for a little depth
    const ds = ch.discs.slice().sort((a, b) => a.y - b.y);
    for (const d of ds) {
      if (!d.onPitch && !d.leaving) continue;
      const x = lerp(d.px, d.x, alpha), y = lerp(d.py, d.y, alpha);
      const p = toScreen(x, y);
      drawDisc(p.x, p.y, d, Math.max(0, Math.min(1, (d.alpha ?? 1) * fade)));
    }

    // ball
    const b = ch.ball;
    let bxp = lerp(b.px, b.x, alpha), byp = lerp(b.py, b.y, alpha);
    if (b.owner) {
      // at the feet: drawn just outside the (enlarged) disc so it stays visible
      const ow = b.owner;
      const oxp = lerp(ow.px, ow.x, alpha), oyp = lerp(ow.py, ow.y, alpha);
      let dx = bxp - oxp, dy = byp - oyp;
      const dl = Math.hypot(dx, dy) || 1;
      if (dl < 1e-3) { dx = ow.fxd || 1; dy = ow.fyd || 0; }
      const off = discR + Math.max(3.2, 0.55 * scale) / scale + 0.1;
      bxp = oxp + dx / (Math.hypot(dx, dy) || 1) * off; byp = oyp + dy / (Math.hypot(dx, dy) || 1) * off;
    }
    const h = b.h || 0;
    const bs = 1 + 0.6 * Math.min(1, h);
    const bp = toScreen(bxp, byp);
    const br = Math.max(3.2, 0.55 * scale) * bs;
    ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(bp.x + 1 + h * 6, bp.y + 1.5 + h * 8, br * 0.9, br * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(bp.x, bp.y - h * 4, br, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath(); ctx.arc(bp.x, bp.y - h * 4, br, -0.6, 0.9); ctx.lineTo(bp.x, bp.y - h * 4); ctx.fill();
    ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.arc(bp.x, bp.y - h * 4, br, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;

    // name label on the ball carrier (or the player the ball is travelling to)
    const who = b.owner || (b.fl && b.fl.recv) || null;
    if (who && fade > 0.5) {
      const x = lerp(who.px, who.x, alpha), y = lerp(who.py, who.y, alpha);
      const p = toScreen(x, y);
      label(p.x, p.y, who.name, kitFor(who));
    }
    ctx.restore();
    // cut between two moments: a light time-lapse wipe and a clock chip instead of a dark fade
    const fd = ch.fade;
    if (fd && fd.phase) {
      if (fd.phase === 'out' && !cutInfo.active) cutInfo = { active: true, from: clockLabel(ch) };
      const p = fd.phase === 'out' ? 0.5 * (1 - fd.a) : 0.5 + 0.5 * fd.a; // 0..1 over the whole cut
      drawTimeLapse(p, cutInfo.from, clockLabel(ch), fd.phase);
    } else cutInfo.active = false;
  }

  let cutInfo = { active: false, from: '' };

  function drawTimeLapse(p, from, to, phase) {
    const bell = Math.sin(Math.PI * Math.min(1, Math.max(0, p))); // 0 -> 1 -> 0
    ctx.save();
    // soft cool veil (never dark)
    ctx.fillStyle = `rgba(150,190,255,${0.12 * bell})`;
    ctx.fillRect(0, 0, cssW, cssH);
    // light band sweeping left to right
    const bw = cssW * 0.45;
    const x = -bw + p * (cssW + bw * 2);
    const g = ctx.createLinearGradient(x, 0, x + bw, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, `rgba(255,255,255,${0.2 * bell})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, bw, cssH);
    // speed lines
    ctx.strokeStyle = `rgba(255,255,255,${0.28 * bell})`;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 9; i++) {
      const y = cssH * (0.12 + i * 0.095);
      const len = cssW * (0.12 + ((i * 37) % 11) * 0.012);
      const sx = ((p * 1.6 + i * 0.173) % 1) * (cssW + len) - len;
      ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx + len, y); ctx.stroke();
    }
    // clock chip: only when the match clock actually moved
    if (phase === 'in' && to !== from) {
      const w = Math.min(cssW * 0.5, 230), h = Math.max(44, Math.min(60, cssH * 0.12));
      const cx = cssW / 2, cy = cssH * 0.2;
      const a = Math.min(1, bell * 2.2);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(12,16,30,0.82)';
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.2;
      const r = h / 2;
      ctx.beginPath();
      ctx.moveTo(cx - w / 2 + r, cy - h / 2); ctx.lineTo(cx + w / 2 - r, cy - h / 2);
      ctx.arc(cx + w / 2 - r, cy, r, -Math.PI / 2, Math.PI / 2); ctx.lineTo(cx - w / 2 + r, cy + h / 2);
      ctx.arc(cx - w / 2 + r, cy, r, Math.PI / 2, Math.PI * 1.5); ctx.closePath();
      ctx.fill(); ctx.stroke();
      // little clock face with a spinning hand
      const fx = cx - w / 2 + r, fr = r * 0.52;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(fx, cy, fr, 0, Math.PI * 2); ctx.stroke();
      const ang = p * Math.PI * 6;
      ctx.beginPath(); ctx.moveTo(fx, cy); ctx.lineTo(fx + Math.sin(ang) * fr * 0.8, cy - Math.cos(ang) * fr * 0.8); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(h * 0.42)}px system-ui, sans-serif`;
      ctx.fillText(`${from}  →  ${to}`, cx + r * 0.45, cy);
      ctx.font = `600 ${Math.round(h * 0.2)}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText('LATER', cx + r * 0.45, cy - h * 0.38);
    }
    ctx.restore();
  }

  return {
    resize, render, toScreen,
    metrics: () => ({ scale, discPx: discR * scale * 2, cssW, cssH }),
    kits,
    destroy() { bg = null; },
  };
}
