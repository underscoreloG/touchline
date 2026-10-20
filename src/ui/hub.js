// Hub: next match, my league table, last result, quick links.

import { S, fmt } from '../strings.js';
import { leagueRows, nextMatchInfo, clubName, staffLevelsOf } from '../logic/game.js';
import { NATION_BY_CODE } from '../logic/nations.js';
import { squadView } from '../logic/squad.js';
import { crestSVG } from './components/crest.js';

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function mountHub(root, store) {
  function render() {
    const { state, world } = store;
    const info = nextMatchInfo(state, world);
    const rows = leagueRows(state, world);
    let rating = null;
    try { const h = squadView(state, world, {}).header; rating = { ovr: h.ovr, att: h.att, mid: h.mid, def: h.def }; } catch (e) { rating = null; }
    const managers = state.cards.filter((c) => c.kind === 'manager');
    const staffLv = staffLevelsOf(state);
    const staffText = Object.keys(staffLv).map((r) => `${S.card.staffRole[r] || r} ${S.card.level} ${staffLv[r]}`).join(', ') || S.hub.noStaff;
    const last = state.lastMatch;
    const done = state.season.complete;
    root.innerHTML = `
      <section class="hub">
        <div class="hub-main">
          ${done ? seasonDone(state) : nextCard(info, state)}
          ${last ? lastCard(last, state, world) : ''}
          <div class="panel quick">
            <h3>${S.hub.squadTitle}</h3>
            ${rating ? `<div class="kv"><span>${S.hub.teamOvr}</span><b>${Math.round(rating.ovr)}</b></div>
            <div class="kv"><span>${S.hub.linesLabel}</span><b>${Math.round(rating.att)} / ${Math.round(rating.mid)} / ${Math.round(rating.def)}</b></div>` : ''}
            ${managers.length ? `<label class="kv"><span>${S.hub.manager}</span><select id="hub-mgr">${managers.map((m) => `<option value="${esc(m.id)}" ${m.id === state.squad.managerId ? 'selected' : ''}>${fmt(S.hub.managerOption, { name: esc(m.name), formation: esc(m.formation), rarity: esc(m.rarity) })}</option>`).join('')}</select></label>` : ''}
            <div class="kv"><span>${S.hub.staff}</span><b>${esc(staffText)}</b></div>
            <div class="row"><button class="btn" data-go="squad">${S.hub.editSquad}</button><button class="btn" data-go="tactics">${S.nav.tactics}</button><button class="btn" data-go="packs">${S.hub.openPacks}</button></div>
          </div>
        </div>
        <aside class="panel table-mini">
          <h3>${esc(leagueName(state))}</h3>
          ${tableHTML(rows)}
        </aside>
      </section>`;
    root.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => store.dispatch('nav', { screen: b.dataset.go }); });
    const play = root.querySelector('#hub-play');
    if (play) play.onclick = () => store.dispatch('nav', { screen: 'match' });
    const inst = root.querySelector('#hub-instant');
    if (inst) inst.onclick = async () => {
      inst.disabled = true;
      const r = await store.dispatch('match/instant');
      if (r && r.error) { inst.disabled = false; inst.textContent = r.error; return; }
      store.dispatch('nav', { screen: 'hub' });
    };
    const mgr = root.querySelector('#hub-mgr');
    if (mgr) mgr.onchange = () => store.dispatch('squad/setManager', { cardId: mgr.value });
    const simEnd = root.querySelector('#hub-simend');
    if (simEnd) simEnd.onclick = async () => { simEnd.disabled = true; await store.dispatch('season/simToEnd'); store.dispatch('nav', { screen: 'hub' }); };
    const sim5 = root.querySelector('#hub-sim5');
    if (sim5) sim5.onclick = async () => { sim5.disabled = true; await store.dispatch('season/simRounds', { n: 5 }); store.dispatch('nav', { screen: 'hub' }); };
    const simRound = root.querySelector('#hub-simround');
    if (simRound) simRound.onclick = async () => { simRound.disabled = true; await store.dispatch('season/simRounds', { n: 1 }); store.dispatch('nav', { screen: 'hub' }); };
    const next = root.querySelector('#hub-nextseason');
    if (next) next.onclick = async () => { await store.dispatch('season/next'); store.dispatch('nav', { screen: 'hub' }); };
  }

  function leagueName(state) {
    const n = NATION_BY_CODE[state.season.country];
    return fmt(S.league.leagueName, { country: n ? n.name : state.season.country, level: state.season.level });
  }

  function nextCard(info, state) {
    if (!info) {
      // my league is done (or a bye) while other leagues still play: simulate on demand
      return `<div class="panel next"><h3>${S.hub.nextMatch}</h3><p>${S.hub.leagueDone}</p>
        <div class="row"><button class="btn primary" id="hub-simend">${S.hub.simToEnd}</button><button class="btn" id="hub-simround">${S.hub.simRound}</button></div></div>`;
    }
    const opp = info.opp;
    const title = info.phase === 'playoffs' ? S.hub.playoffMatch[info.playoffStage] : fmt(S.hub.nextMatchDay, { n: info.matchday + 1 });
    return `<div class="panel next">
      <h3>${esc(title)}</h3>
      <div class="vs">
        <div class="side">${crestSVG({ ...state.club.crest, size: 72 })}<b>${esc(state.club.name)}</b></div>
        <div class="vs-mid">${info.homeIsMe ? S.hub.home : S.hub.away}<small>${S.hub.vs}</small></div>
        <div class="side">${crestSVG({ ...opp.crest, size: 72 })}<b>${esc(opp.name)}</b><small>${fmt(S.hub.oppRating, { n: info.oppRating.toFixed(1) })}</small></div>
      </div>
      <div class="row"><button class="btn primary big" id="hub-play">${S.hub.playMatch}</button><button class="btn" id="hub-instant">${S.hub.instant}</button><button class="btn" id="hub-sim5">${S.hub.simFive}</button><button class="btn" id="hub-simend">${S.hub.simToEnd}</button></div>
    </div>`;
  }

  function seasonDone(state) {
    const s = state.season.summary;
    return `<div class="panel next">
      <h3>${S.league.champion}: ${esc(s.champion)}</h3>
      <p>${fmt(S.hub.finished, { pos: s.position, pts: s.points, prize: s.prize.toLocaleString('en-US') })}</p>
      <p>${s.playoff ? S.hub.playoffResult[s.playoff] + ' ' : ''}${fmt(s.promoted ? S.hub.promoted : s.relegated ? S.hub.relegated : S.hub.stayed, { n: s.newLevel })}</p>
      <div class="row"><button class="btn primary big" id="hub-nextseason">${S.hub.nextSeason}</button><button class="btn" data-go="league">${S.hub.seasonReview}</button></div>
    </div>`;
  }

  function lastCard(last, state, world) {
    const win = last.goalsFor > last.goalsAgainst, draw = last.goalsFor === last.goalsAgainst;
    const res = win ? S.hub.win : draw ? S.hub.draw : S.hub.loss;
    const resCls = win ? 'win' : draw ? 'draw' : 'loss'; // css class, not text
    return `<div class="panel last"><h3>${S.hub.lastResult}</h3>
      <div class="score-line ${resCls}"><b>${last.goalsFor} - ${last.goalsAgainst}</b> ${S.hub.vs} ${esc(clubName(state, world, last.opp))} <span class="chip">${res}</span>${last.pens ? ` <span class="chip">${fmt(S.match.penaltiesResult, last.pens)}</span>` : ''} <span class="chip">${fmt(S.hub.coinsGain, { n: last.income })}</span></div></div>`;
  }

  function tableHTML(rows) {
    return `<table class="tbl"><thead><tr><th>${S.league.rank}</th><th>${S.league.club}</th><th>${S.league.pld}</th><th>${S.league.gd}</th><th>${S.league.pts}</th></tr></thead><tbody>${rows.map((r) =>
      `<tr class="${r.me ? 'me' : ''}"><td>${r.pos}</td><td class="nm">${crestSVG({ ...r.club.crest, size: 18 })} ${esc(r.name)}</td><td>${r.p}</td><td>${r.gf - r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}</tbody></table>`;
  }

  render();
  return store.subscribe(render);
}
