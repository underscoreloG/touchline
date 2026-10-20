// CSS 3D squad pitch: stadium surround, perspective pitch (rotateX), markings, floodlight glow, and two flat
// overlays (link lines + cards) placed on the projected anchor points so cards stay upright and crisp.
// Generic component: knows nothing about cards or squads. Used by ui/squad.js.
//
//   const p = createSquadPitch();
//   p.setAnchors([{ x, y }])     x 0..100 left->right, y 0..100 top (attack) -> bottom (own goal), in pitch plane
//   p.layout()                   size the pitch to the stage, returns measure()
//   p.measure() -> [{ x, y, s }]  stage-local pixel centre of every anchor + perspective scale (1 = near goal line)
//   p.drawLinks(links, pts)      links: [{ a, b, colour:'green'|'orange'|'red'|'none', cls? }]
//   p.el, p.cards (overlay for cards), p.svg (overlay for lines)

const SVGNS = 'http://www.w3.org/2000/svg';
export const PITCH_TILT_DEG = 35;

function markingsSVG() {
  // 68 x 100 plane units, own goal at the bottom. Stylised (not to scale vertically).
  const L = 'stroke="rgba(255,255,255,0.55)" stroke-width="0.45" fill="none"';
  return `<svg class="sp-marks" viewBox="0 0 68 100" preserveAspectRatio="none" aria-hidden="true">
    <rect x="2" y="2" width="64" height="96" ${L}/>
    <line x1="2" y1="50" x2="66" y2="50" ${L}/>
    <circle cx="34" cy="50" r="8" ${L}/>
    <circle cx="34" cy="50" r="0.7" fill="rgba(255,255,255,0.6)"/>
    <rect x="15" y="2" width="38" height="14.5" ${L}/>
    <rect x="24.5" y="2" width="19" height="5.2" ${L}/>
    <circle cx="34" cy="12" r="0.6" fill="rgba(255,255,255,0.6)"/>
    <path d="M27.3,16.5 A8,8 0 0 0 40.7,16.5" ${L}/>
    <rect x="15" y="83.5" width="38" height="14.5" ${L}/>
    <rect x="24.5" y="92.8" width="19" height="5.2" ${L}/>
    <circle cx="34" cy="88" r="0.6" fill="rgba(255,255,255,0.6)"/>
    <path d="M27.3,83.5 A8,8 0 0 1 40.7,83.5" ${L}/>
    <path d="M2,4 A2,2 0 0 0 4,2 M64,2 A2,2 0 0 0 66,4 M2,96 A2,2 0 0 1 4,98 M66,96 A2,2 0 0 0 64,98" ${L}/>
    <rect x="29.5" y="0.4" width="9" height="1.6" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.7)" stroke-width="0.35"/>
    <rect x="29.5" y="98" width="9" height="1.6" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.7)" stroke-width="0.35"/>
  </svg>`;
}

export function createSquadPitch() {
  const el = document.createElement('div');
  el.className = 'sp-stage';
  el.innerHTML = `
    <div class="sp-stands" aria-hidden="true"><i class="sp-light sp-light-l"></i><i class="sp-light sp-light-r"></i></div>
    <div class="sp-persp"><div class="sp-pitch">
      <div class="sp-grass"></div>${markingsSVG()}<div class="sp-anchors"></div>
    </div></div>
    <div class="sp-vignette" aria-hidden="true"></div>
    <svg class="sp-links" aria-hidden="true"></svg>
    <div class="sp-cards"></div>`;
  const persp = el.querySelector('.sp-persp');
  const pitch = el.querySelector('.sp-pitch');
  const anchorsEl = el.querySelector('.sp-anchors');
  const svg = el.querySelector('.sp-links');
  const cards = el.querySelector('.sp-cards');
  let anchors = [];

  function setAnchors(points) {
    anchorsEl.innerHTML = '';
    anchors = points.map((p) => {
      const a = document.createElement('i');
      a.className = 'sp-anchor';
      a.style.left = p.x + '%';
      a.style.top = p.y + '%';
      anchorsEl.appendChild(a);
      return a;
    });
  }

  /** Fit the pitch plane to the stage. Width from the stage width and the available height. */
  let lastMaxH = 0;
  function layout(maxHOverride) {
    const w = el.clientWidth || 360;
    // Height budget from the window (a CSS clamp() custom property cannot be read as a number: it used to fall back to a
    // fixed 640 here, so the pitch never grew with the window). The bench strip sits below and may need a short scroll.
    const maxH = maxHOverride || Math.max(380, Math.min(940, window.innerHeight - 240));
    lastMaxH = maxH;
    const narrow = w < 560;
    // plane aspect (w/h) 0.8; projected height is about 0.82 of the plane height
    const maxW = Math.min(w * (narrow ? 0.96 : 0.9), 820);
    let pw = Math.round(Math.min(maxW, maxH * 0.8));
    // two passes: measure the projected height (perspective makes it hard to predict) and rescale to fit maxH
    for (let pass = 0; pass < 2; pass++) {
      el.style.setProperty('--sp-pw', pw + 'px');
      persp.style.marginTop = '0px';
      const pr = pitch.getBoundingClientRect();
      const layoutTop = persp.getBoundingClientRect().top;
      const gap = pr.top - layoutTop;
      const stands = Math.max(36, pw * 0.1);
      persp.style.marginTop = Math.round(stands - gap) + 'px';
      el.style.setProperty('--sp-stands-h', Math.round(stands + pw * 0.04) + 'px');
      const total = stands + pr.height + pw * 0.1;
      if (pass === 0 && total > maxH) pw = Math.max(240, Math.round(pw * (maxH / total)));
      else break;
    }
    return measure();
  }

  function measure() {
    const sb = el.getBoundingClientRect();
    const base = 10; // anchor size in CSS px on the plane
    let near = 0;
    const pts = anchors.map((a) => {
      const r = a.getBoundingClientRect();
      const s = r.width / base;
      if (s > near) near = s;
      return { x: r.left + r.width / 2 - sb.left, y: r.top + r.height / 2 - sb.top, s };
    });
    return pts.map((p) => ({ ...p, s: near ? p.s / near : 1 }));
  }

  function drawLinks(links, pts) {
    const b = el.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${Math.max(1, b.width)} ${Math.max(1, b.height)}`);
    svg.setAttribute('width', b.width);
    svg.setAttribute('height', b.height);
    let out = '';
    links.forEach((l, i) => {
      const p = pts[l.a];
      const q = pts[l.b];
      if (!p || !q) return;
      const cls = `sp-link sp-${l.colour}${l.cls ? ' ' + l.cls : ''}`;
      const d = `M${p.x.toFixed(1)},${p.y.toFixed(1)} L${q.x.toFixed(1)},${q.y.toFixed(1)}`;
      out += `<g class="${cls}" data-link="${i}" data-a="${l.a}" data-b="${l.b}"><path class="sp-link-under" d="${d}"/><path class="sp-link-line" d="${d}"/></g>`;
    });
    svg.innerHTML = out;
  }

  return { el, cards, svg, pitch, setAnchors, layout, measure, drawLinks, SVGNS, get lastMaxH() { return lastMaxH; } };
}

/** Small top-down pitch (SVG string) with dots, for the tactics preview and formation picker. */
export function miniPitchSVG(points, opts = {}) {
  const w = 68;
  const h = 100;
  const r = opts.r || 3.1;
  const L = 'stroke="rgba(255,255,255,0.35)" stroke-width="0.5" fill="none"';
  const dots = points.map((p) => {
    const x = 3 + (p.lat / 100) * (w - 6);
    const y = h - 3 - (p.depth / 100) * (h - 6);
    const gk = p.pos === 'GK';
    const label = opts.labels ? `<text x="${x.toFixed(1)}" y="${(y + 1.3).toFixed(1)}" text-anchor="middle" font-size="3" font-weight="700" fill="${gk ? '#14161c' : '#fff'}">${p.pos}</text>` : '';
    return `<g class="mp-dot${gk ? ' mp-gk' : ''}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"/>${label}</g>`;
  }).join('');
  const extra = opts.extra || '';
  return `<svg class="mini-pitch" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <rect x="0" y="0" width="${w}" height="${h}" rx="2" class="mp-grass"/>
    <rect x="2" y="2" width="${w - 4}" height="${h - 4}" ${L}/><line x1="2" y1="50" x2="${w - 2}" y2="50" ${L}/>
    <circle cx="34" cy="50" r="7" ${L}/><rect x="16" y="2" width="36" height="13" ${L}/><rect x="16" y="85" width="36" height="13" ${L}/>
    ${extra}${dots}</svg>`;
}
