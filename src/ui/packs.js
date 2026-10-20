// Pack shop: every pack on sale, grouped. Odds are published on every pack.

import { S, fmt } from '../strings.js';
import { PACKS, PACK_PITY, PACK_SHOP } from '../balance.js';

const COL = {
  bronze: ['#6e3f1c', '#e2a46a'], silver: ['#6f7a8e', '#f1f5fb'], gold: ['#9c6c00', '#ffe27a'], promo: ['#35157a', '#ff6ad5'],
  gk: ['#0b4f5c', '#19e3ff'], def: ['#14307a', '#6fa0ff'], mid: ['#0f5a2f', '#5be08a'], att: ['#7a1420', '#ff6a78'],
  prospect: ['#3a5a0f', '#c8f26a'], veteran: ['#4a4036', '#d6c3a5'], staff: ['#0d3d5a', '#19e3ff'], training: ['#4a3a0f', '#ffd36b'],
};
const SHORT = { gk: 'GK', def: 'DEF', mid: 'MID', att: 'ATT', prospect: 'U21', veteran: '30+', staff: 'STAFF', training: 'TRAIN' };

export function mountPacks(root, store) {
  let cat = PACK_SHOP[0].id;

  function render() {
    const { state } = store;
    const group = PACK_SHOP.find((g) => g.id === cat) || PACK_SHOP[0];
    root.innerHTML = `<section class="packs">
      <div class="panel"><h3>${S.packs.title}</h3><p class="dim">${fmt(S.packs.intro, { n: PACK_PITY.goldNoElite, streak: state.pity.gold })}</p>
        <div class="st-tabs pk-tabs" role="tablist">${PACK_SHOP.map((g) => `<button class="st-tab ${g.id === cat ? 'on' : ''}" data-cat="${g.id}" role="tab">${S.packs.cat[g.id]}</button>`).join('')}</div>
      </div>
      <div class="pack-grid">${group.packs.map((t) => card(t, state)).join('')}</div>
    </section>`;
    root.querySelectorAll('[data-cat]').forEach((b) => { b.onclick = () => { cat = b.dataset.cat; render(); }; });
    root.querySelectorAll('[data-buy]').forEach((b) => {
      b.onclick = async () => {
        b.disabled = true;
        const r = await store.dispatch('pack/buy', { type: b.dataset.buy });
        if (r && r.ok === false) { b.textContent = r.error; setTimeout(render, 1200); }
      };
    });
  }

  function card(t, state) {
    const d = PACKS[t];
    const [c1, c2] = COL[t] || COL.gold;
    const can = state.coins >= d.price;
    const oddsLabel = (k) => S.rarity[k] || S.packs.itemOdds[k] || k;
    const odds = Object.entries(d.odds || {}).map(([r, v]) => `<li><i class="dot r-${S.rarity[r] ? r : r === 'epic' ? 'elite' : r === 'rare' ? 'gold' : 'bronze'}"></i>${oddsLabel(r)}<b>${v}%</b></li>`).join('');
    const extras = d.players ? fmt(S.packs.extras, { players: d.players, others: d.others }) : fmt(S.packs.extrasItems, { others: d.others });
    return `<div class="pack-card" style="--p1:${c1};--p2:${c2}">
      <div class="pack-art"><span>${(S.rarity[t] || SHORT[t] || t).toUpperCase()}</span></div>
      <h4>${S.packs.name[t]}</h4>
      <p class="dim">${S.packs.desc[t] || ''}</p>
      <p class="dim pk-extras">${extras}</p>
      <ul class="odds">${odds}</ul>
      <button class="btn ${can ? 'primary' : ''}" data-buy="${t}" ${can ? '' : 'disabled'}>${S.packs.buy} - ${d.price.toLocaleString('en-US')}</button>
    </div>`;
  }
  render();
  return store.subscribe(render);
}
