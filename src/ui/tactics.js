// Tactics panel: formation picker, the 5 free settings with their exact engine effects, 3 tactic card slots,
// captain / set-piece role pickers, top-down team shape preview, plain-language trade-offs, Analyst report.
// UI only: reads tacticsView (logic/squad.js) and dispatches actions.
//
// mountTactics(root, store, opts?) -> cleanup()
//   store.ctx (optional object or function): { analyst?:bool, opponent?:opponentReport(...) }
//   When store.ctx gives no opponent, the next league opponent is looked up through logic/game.js nextMatchInfo.

import { tacticsView, opponentReport } from '../logic/squad.js';
import { nextMatchInfo } from '../logic/game.js';
import { FORMATIONS } from '../logic/formations.js';
import { SQUAD_ROLES } from '../balance.js';
import { S } from '../strings.js';
import { miniPitchSVG } from './components/squadPitch.js';
import { crestSVG } from './components/crest.js';
import { makeT, esc, ctxOf, act, makeToast } from './squad.js';

export function mountTactics(root, store) {
  const T = makeT(store);
  root.innerHTML = '';
  const el = document.createElement('section');
  el.className = 'tx';
  root.appendChild(el);
  const toastHost = document.createElement('div');
  toastHost.className = 'sq-toast';
  const toast = makeToast(toastHost);

  function opponent() {
    const ctx = ctxOf(store);
    if (ctx.opponent) return ctx.opponent;
    try {
      const info = nextMatchInfo(store.state, store.world);
      return info ? opponentReport(store.world, info.oppId) : null;
    } catch (e) { return null; }
  }

  function render() {
    const { state, world } = store;
    if (!state || !world) return;
    const ctx = ctxOf(store);
    const v = tacticsView(state, world, { analyst: ctx.analyst, opponent: null });
    const opp = v.analyst ? opponent() : null;
    const optLabel = (o) => T('tactics.opt.' + o);
    const formations = v.formations.map((f) => `<button class="tx-form ${f.id === v.formation ? 'on' : ''}" data-form="${f.id}" aria-pressed="${f.id === v.formation}">
        ${miniPitchSVG(f.slots, { r: 3.6 })}<b>${f.id}</b></button>`).join('');
    const settings = v.settings.map((s) => `<div class="tx-set">
        <div class="tx-set-h"><b>${esc(T('tactics.' + s.key))}</b></div>
        <div class="tx-seg" role="radiogroup" aria-label="${esc(T('tactics.' + s.key))}">${s.options.map((o) => `<button role="radio" aria-checked="${o === s.value}" class="${o === s.value ? 'on' : ''}" data-set="${s.key}" data-val="${o}" title="${esc(s.summaries[o])}">${esc(optLabel(o))}</button>`).join('')}</div>
        <p class="tx-eff ${s.isDefault ? 'dim' : ''}">${esc(s.summary)}</p></div>`).join('');
    const owned = v.ownedTactics;
    const slots = v.tacticSlots.map((ts) => {
      const c = ts.card;
      const opts = `<option value="">${esc(T('tactics.emptySlot'))}</option>` + owned.map((o) => `<option value="${esc(o.cardId)}" ${c && c.cardId === o.cardId ? 'selected' : ''}>${esc(o.name)}</option>`).join('');
      return `<div class="tx-tslot ${c ? 'full' : ''}">
        <div class="tx-tslot-h"><span>${esc(T('tactics.slot', { n: ts.slot + 1 }))}</span>
          <select data-tslot="${ts.slot}" ${owned.length ? '' : 'disabled'} aria-label="${esc(T('tactics.slot', { n: ts.slot + 1 }))}">${opts}</select></div>
        ${c ? `<b class="tx-tname">${esc(c.name)}</b><p class="tx-up">${esc(c.upside)}</p><p class="tx-cost">${esc(c.cost)}</p>` : `<p class="dim">${esc(T('tactics.emptySlot'))}</p>`}
      </div>`;
    }).join('');
    const roles = SQUAD_ROLES.map((r) => {
      const cands = v.roleCandidates[r];
      const cur = v.roles[r].cardId;
      return `<label class="tx-role"><span>${esc(T('tactics.roleName.' + r))}</span>
        <select data-role="${r}"><option value="">${esc(T('tactics.none'))}</option>${cands.map((c) => `<option value="${esc(c.cardId)}" ${c.cardId === cur ? 'selected' : ''}>${esc(c.name)} (${esc(c.pos)}${c.value != null ? ', ' + esc(c.statLabel) + ' ' + c.value : ''})${c.leader && r === 'captain' ? ' *' : ''}${c.deadBall && r !== 'captain' ? ' *' : ''}${c.where === 'bench' ? ' - ' + esc(T('tactics.onBench')) : ''}</option>`).join('')}</select></label>`;
    }).join('');
    const shape = v.shape;
    const base = FORMATIONS[v.formation].slots;
    const ghost = base.map((s) => {
      const x = 3 + (s.lat / 100) * 62; const y = 97 - (s.depth / 100) * 94;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.2" class="mp-ghost"/>`;
    }).join('');
    const defs = shape.points.filter((p) => p.pos === 'CB' || p.pos === 'FB');
    const lineY = defs.length ? 97 - (defs.reduce((a, p) => a + p.depth, 0) / defs.length / 100) * 94 : 0;
    const extra = ghost + (defs.length ? `<line x1="2" x2="66" y1="${lineY.toFixed(1)}" y2="${lineY.toFixed(1)}" class="mp-line"/>` : '');
    const trade = v.tradeoffKeys.map((k) => `<li>${esc(T('tactics.tradeoff.' + k))}</li>`).join('')
      + v.activeTactics.map((c) => `<li><b>${esc(c.name)}:</b> ${esc(c.upside)} <span class="tx-cost">${esc(c.cost)}</span></li>`).join('');
    const analyst = v.analyst ? `<div class="tx-card tx-analyst"><h3>${esc(T('tactics.analyst'))}</h3>${opp ? `
        <div class="tx-opp"><span class="tx-crest">${opp.crest ? crestSVG(opp.crest) : ''}</span><div><small>${esc(T('tactics.nextOpp'))}</small><b>${esc(opp.name)}</b></div></div>
        <dl><dt>${esc(T('tactics.oppFormation'))}</dt><dd>${esc(opp.formation || '-')}</dd><dt>${esc(T('tactics.oppStyle'))}</dt><dd>${esc(S.clubStyle[opp.style] || opp.style || '-')}</dd>
        <dt>${esc(T('tactics.weakest'))}</dt><dd class="tx-weak">${esc(T('tactics.lines.' + opp.weakestLine))} (${Math.round(opp.ratings[opp.weakestLine])})</dd></dl>
        <p class="dim">${esc(T('squad.att'))} ${Math.round(opp.ratings.att)} / ${esc(T('squad.mid'))} ${Math.round(opp.ratings.mid)} / ${esc(T('squad.def'))} ${Math.round(opp.ratings.def)} / ${esc(T('tactics.gk'))} ${opp.ratings.gk}</p>` : `<p class="dim">${esc(T('tactics.noOpp'))}</p>`}</div>` : '';
    el.innerHTML = `
      <div class="tx-col tx-col-a">
        <div class="tx-card"><h3>${esc(T('tactics.formation'))}</h3><div class="tx-forms">${formations}</div></div>
        <div class="tx-card"><h3>${esc(T('tactics.settings'))}</h3>${settings}</div>
      </div>
      <div class="tx-col tx-col-b">
        <div class="tx-card tx-prev"><h3>${esc(T('tactics.preview'))}</h3>
          <div class="tx-prevpitch">${miniPitchSVG(shape.points, { r: 3.4, labels: true, extra })}</div>
          <p class="tx-metrics"><span>${esc(T('tactics.metricLine', { m: shape.metrics.lineHeightM }))}</span><span>${esc(T('tactics.metricDepth', { m: shape.metrics.blockDepthM }))}</span><span>${esc(T('tactics.metricWidth', { m: shape.metrics.widthM }))}</span></p>
          <h3>${esc(T('tactics.tradeoffs'))}</h3><ul class="tx-trade">${trade || `<li class="dim">${esc(T('tactics.balancedAll'))}</li>`}</ul>
        </div>
        ${analyst}
        <div class="tx-card"><h3>${esc(T('tactics.cards'))}</h3>${owned.length ? '' : `<p class="dim">${esc(T('tactics.noTacticCards'))}</p>`}<div class="tx-tslots">${slots}</div></div>
        <div class="tx-card"><h3>${esc(T('tactics.roles'))}</h3><div class="tx-roles">${roles}</div><p class="dim tx-note">* ${esc(T('tactics.leaderNote'))}</p></div>
      </div>`;
    el.appendChild(toastHost);
    el.querySelectorAll('[data-form]').forEach((b) => b.addEventListener('click', () => act(store, toast, 'tactics/set', { key: 'formation', value: b.dataset.form })));
    el.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', () => act(store, toast, 'tactics/set', { key: b.dataset.set, value: b.dataset.val })));
    el.querySelectorAll('[data-tslot]').forEach((s) => s.addEventListener('change', () => act(store, toast, 'tactics/tacticCard', { slot: Number(s.dataset.tslot), cardId: s.value || null })));
    el.querySelectorAll('[data-role]').forEach((s) => s.addEventListener('change', () => act(store, toast, 'tactics/role', { role: s.dataset.role, cardId: s.value || null })));
  }

  const unsub = store.subscribe(render);
  render();
  return () => { unsub && unsub(); root.innerHTML = ''; };
}
