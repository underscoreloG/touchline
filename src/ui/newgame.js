// New game / onboarding: name the club, pick country, colours, crest, world size.

import { S, fmt } from '../strings.js';
import { rngFrom } from '../logic/rng.js';
import { makeCrest, crestSVG } from './components/crest.js';
import { NATION_BY_CODE, PLAYABLE_COUNTRIES } from '../logic/nations.js';
import { WORLD } from '../balance.js';
import { readMeta } from './saveStore.js';
import { saveSummary } from '../logic/save.js';

const PALETTE = ['#c8102e', '#0b3d91', '#1f7a3a', '#f2c200', '#111318', '#ffffff', '#6a1b9a', '#e35205', '#00a3e0', '#7a1f2b', '#0f5e5a', '#ff4f9a'];
const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function mountNewGame(root, store) {
  let meta = null; // { summary, savedAt } of the saved game, read from IndexedDB
  let resetAsk = false, replaceArmed = false, busy = false, error = '';
  const live = () => (store.state ? { summary: saveSummary(store.state), savedAt: store.autosave.lastSavedAt } : null);
  const form = { name: S.newGame.defaultName, country: 'ENG', c1: '#c8102e', c2: '#ffffff', size: WORLD.defaultPlayers, seed: 2026, crestSeed: 1 };
  const initials = (n) => n.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || 'FC';
  const crest = () => {
    const c = makeCrest(rngFrom('crest' + form.crestSeed), [form.c1, form.c2]);
    return { ...c, colours: [form.c1, form.c2], initials: initials(form.name) };
  };
  const swatches = (key) => PALETTE.map((c) => `<button class="sw ${form[key] === c ? 'on' : ''}" data-key="${key}" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join('');

  const when = (t) => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  function resumeCard() {
    const m = live() || meta;
    if (!m) return `<div class="ng-resume"><button type="button" class="btn ghost" id="ng-import">${S.save.importLoose}</button><input type="file" id="ng-file" hidden></div>`;
    const s = m.summary;
    const nat = NATION_BY_CODE[s.country];
    const league = fmt(S.league.leagueName, { country: nat ? nat.name : s.country, level: s.level });
    const actions = resetAsk
      ? `<p class="ng-ask">${S.save.resetAsk}</p><div class="row"><button type="button" class="btn danger" id="ng-reset-yes">${S.save.resetYes}</button><button type="button" class="btn ghost" id="ng-reset-no">${S.save.cancel}</button></div>`
      : `<div class="row"><button type="button" class="btn primary big" id="ng-continue" ${busy ? 'disabled' : ''}>${busy ? S.save.working : S.save.continue}</button></div>
         <div class="row small"><button type="button" class="btn ghost" id="ng-export">${S.save.export}</button><button type="button" class="btn ghost" id="ng-import">${S.save.import}</button><button type="button" class="btn ghost danger" id="ng-reset">${S.save.reset}</button></div><input type="file" id="ng-file" hidden>`;
    return `<div class="ng-resume card-like">
      <div class="ng-res-head">${crestSVG({ ...s.crest, colours: s.colours, size: 54 })}<div><h3>${S.save.cardTitle}</h3><b>${esc(s.club)}</b>
        <small>${esc(fmt(S.save.cardLine, { season: s.season, league }))}</small>
        <small>${esc(fmt(S.save.coins, { n: s.coins.toLocaleString('en-US') }))} - ${esc(m.savedAt ? fmt(S.save.savedAt, { when: when(m.savedAt) }) : S.save.unsaved)}</small></div></div>
      ${error ? `<p class="ng-err">${esc(error)}</p>` : ''}${actions}</div>`;
  }

  function render() {
    root.innerHTML = `
      <section class="newgame">
        <div class="ng-hero">
          <div class="ng-logo">${S.brand}</div>
          <p class="ng-tag">${S.tagline}</p>
          ${resumeCard()}
        </div>
        <form class="ng-form" autocomplete="off">
          <label>${S.newGame.clubName}<input id="ng-name" maxlength="28" value="${esc(form.name)}"></label>
          <label>${S.newGame.country}
            <select id="ng-country">${PLAYABLE_COUNTRIES.map((c) => `<option value="${c}" ${c === form.country ? 'selected' : ''}>${NATION_BY_CODE[c].flag} ${NATION_BY_CODE[c].name}</option>`).join('')}</select>
          </label>
          <div class="ng-row"><span>${S.newGame.colours}</span><div class="swatches">${swatches('c1')}</div><div class="swatches">${swatches('c2')}</div></div>
          <div class="ng-row"><span>${S.newGame.crest}</span><div class="ng-crest">${crestSVG({ ...crest(), size: 84 })}</div><button type="button" id="ng-reroll" class="btn ghost">${S.newGame.shuffle}</button></div>
          <label>${S.newGame.worldSize}
            <select id="ng-size">${WORLD.sizes.map((n) => `<option value="${n}" ${n === form.size ? 'selected' : ''}>${fmt(S.newGame.playersCount, { n: n.toLocaleString('en-US') })}</option>`).join('')}</select>
          </label>
          <label>${S.newGame.seed}<input id="ng-seed" type="number" value="${form.seed}"></label>
          ${live() || meta ? `<p class="ng-note">${S.save.replaceNote}</p>` : ''}
          <button type="submit" class="btn primary big" id="ng-start">${replaceArmed ? S.save.replaceConfirm : S.newGame.start}</button>
          <div class="ng-progress" id="ng-progress" hidden><div class="bar"><i id="ng-bar"></i></div><span id="ng-label">${S.newGame.generating}</span></div>
        </form>
        <p class="ng-credits">${S.credits}</p>
      </section>`;
    root.querySelector('#ng-name').oninput = (e) => { form.name = e.target.value; };
    root.querySelector('#ng-country').onchange = (e) => { form.country = e.target.value; };
    root.querySelector('#ng-size').onchange = (e) => { form.size = Number(e.target.value); };
    root.querySelector('#ng-seed').onchange = (e) => { form.seed = Number(e.target.value) || 1; };
    root.querySelectorAll('.sw').forEach((b) => { b.onclick = () => { form[b.dataset.key] = b.dataset.c; render(); }; });
    root.querySelector('#ng-reroll').onclick = () => { form.crestSeed++; render(); };
    const on = (sel, fn) => { const el = root.querySelector(sel); if (el) el.onclick = fn; };
    const run = async (type, payload) => {
      busy = true; error = ''; render();
      const r = await store.dispatch(type, payload);
      busy = false;
      if (r && r.ok === false) { error = r.error || ''; render(); }
      return r;
    };
    on('#ng-continue', () => run('game/resume', { live: !!store.state }));
    on('#ng-export', async () => { const r = await store.dispatch('game/export'); if (r && r.ok === false) { error = r.error; render(); } });
    on('#ng-reset', () => { resetAsk = true; render(); });
    on('#ng-reset-no', () => { resetAsk = false; render(); });
    on('#ng-reset-yes', async () => { resetAsk = false; meta = null; await store.dispatch('game/reset'); });
    on('#ng-import', () => root.querySelector('#ng-file').click());
    const file = root.querySelector('#ng-file');
    if (file) file.onchange = () => { if (file.files[0]) run('game/import', { file: file.files[0] }); };
    root.querySelector('.ng-form').onsubmit = async (e) => {
      e.preventDefault();
      if ((live() || meta) && !replaceArmed) { replaceArmed = true; render(); return; }
      const start = root.querySelector('#ng-start');
      start.disabled = true;
      root.querySelector('#ng-progress').hidden = false;
      const bar = root.querySelector('#ng-bar'), label = root.querySelector('#ng-label');
      try {
        await store.dispatch('game/new', {
          seed: form.seed, size: form.size, country: form.country,
          club: { name: form.name.trim() || S.newGame.fallbackName, colours: [form.c1, form.c2], crest: crest() },
          onProgress: (p, l) => { bar.style.width = Math.round(p * 100) + '%'; if (l) label.textContent = l; },
        });
      } catch (err) {
        console.error(err);
        label.textContent = fmt(S.newGame.failed, { msg: err.message });
        start.disabled = false;
      }
    };
  }
  render();
  readMeta().then((m) => { meta = m; if (root.isConnected && !busy) render(); });
}
