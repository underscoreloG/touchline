// New game / onboarding: name the club, pick country, colours, crest, world size.

import { S, fmt } from '../strings.js';
import { rngFrom } from '../logic/rng.js';
import { makeCrest, crestSVG } from './components/crest.js';
import { NATION_BY_CODE, PLAYABLE_COUNTRIES } from '../logic/nations.js';
import { WORLD } from '../balance.js';

const PALETTE = ['#c8102e', '#0b3d91', '#1f7a3a', '#f2c200', '#111318', '#ffffff', '#6a1b9a', '#e35205', '#00a3e0', '#7a1f2b', '#0f5e5a', '#ff4f9a'];
const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function mountNewGame(root, store) {
  const form = { name: S.newGame.defaultName, country: 'ENG', c1: '#c8102e', c2: '#ffffff', size: WORLD.defaultPlayers, seed: 2026, crestSeed: 1 };
  const initials = (n) => n.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || 'FC';
  const crest = () => {
    const c = makeCrest(rngFrom('crest' + form.crestSeed), [form.c1, form.c2]);
    return { ...c, colours: [form.c1, form.c2], initials: initials(form.name) };
  };
  const swatches = (key) => PALETTE.map((c) => `<button class="sw ${form[key] === c ? 'on' : ''}" data-key="${key}" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join('');

  function render() {
    root.innerHTML = `
      <section class="newgame">
        <div class="ng-hero">
          <div class="ng-logo">${S.brand}</div>
          <p class="ng-tag">${S.tagline}</p>
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
          <button type="submit" class="btn primary big" id="ng-start">${S.newGame.start}</button>
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
    root.querySelector('.ng-form').onsubmit = async (e) => {
      e.preventDefault();
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
}
