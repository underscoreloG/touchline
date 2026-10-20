// League screen: browse every league of the 5-level pyramid (country and level tabs), tables with promotion, playoff and
// relegation zones, results by matchday, playoff brackets, the season review, and simulation controls.

import { S, fmt } from '../strings.js';
import { leagueRows, clubName, myLeagueKey } from '../logic/game.js';
import { levelRules, relegatedFrom, leagueKey } from '../logic/season.js';
import { NATION_BY_CODE } from '../logic/nations.js';
import { WORLD, LEAGUE_SYSTEM } from '../balance.js';
import { crestSVG } from './components/crest.js';
import { MY_CLUB_ID } from '../logic/economy.js';

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const L = S.league;
const LEVELS = Array.from({ length: LEAGUE_SYSTEM.levels }, (_, i) => i + 1);

/** Zone of a table position: 'up' (automatic promotion), 'po' (playoff places), 'down' (relegation) or ''. */
export function zoneOf(country, level, pos, n) {
  const rules = levelRules(country, level);
  if (pos <= rules.promoteAuto) return 'up';
  if (rules.playoff && pos <= rules.promoteAuto + LEAGUE_SYSTEM.playoff.teams) return 'po';
  if (pos > n - relegatedFrom(country, level)) return 'down';
  return '';
}

export function mountLeague(root, store) {
  const mine = () => ({ country: store.state.season.country, level: store.state.season.level });
  let sel = mine();
  let tab = store.state.season.complete ? 'review' : 'table';
  let day = null; // matchday index shown in Results (null = the latest played)
  let busy = false;
  let note = '';

  const nationName = (c) => (NATION_BY_CODE[c] ? NATION_BY_CODE[c].name : c);
  const crest = (state, world, id, size) => {
    const c = id === MY_CLUB_ID ? state.club : world.getClub(id);
    return c ? crestSVG({ ...c.crest, size }) : '';
  };
  const cname = (id) => (id == null ? L.tbd : esc(clubName(store.state, store.world, id)));

  // ------------------------------------------------------------------ pieces
  function simBar(state) {
    const done = state.season.phase === 'done';
    const py = state.season.pyramid;
    const mine = py.leagues[myLeagueKey(state)];
    const progress = state.season.phase === 'playoffs' ? L.playoffsOn
      : mine.matchday >= mine.fixtures.length ? S.hub.leagueDone
      : fmt(L.round, { n: mine.matchday + 1, total: mine.fixtures.length });
    if (done) {
      return `<div class="lg-sim panel"><div><b>${L.seasonDone}</b></div><div class="row"><button class="btn primary" id="lg-next">${L.nextSeason}</button></div></div>`;
    }
    const dis = busy ? 'disabled' : '';
    return `<div class="lg-sim panel">
      <div class="lg-sim-info"><b>${esc(progress)}</b><small class="dim">${L.simNote}</small>${note ? `<small class="lg-note">${esc(note)}</small>` : ''}</div>
      <div class="row"><span class="dim lg-sim-t">${L.simTitle}</span>
        <button class="btn" data-sim="1" ${dis}>${L.sim1}</button><button class="btn" data-sim="5" ${dis}>${L.sim5}</button><button class="btn" data-sim="10" ${dis}>${L.sim10}</button>
        <button class="btn" data-sim="end" ${dis}>${L.simEnd}</button></div>
    </div>`;
  }

  function tabsBar(state) {
    const py = state.season.pyramid;
    const myKey = myLeagueKey(state);
    const countries = WORLD.countries;
    const country = countries.map((c) => `<button class="lg-tab ${sel.country === c ? 'on' : ''}" data-country="${c}">${esc(nationName(c))}${c === state.season.country ? '<i class="lg-dot" title="' + esc(L.myLeague) + '"></i>' : ''}</button>`).join('');
    const level = LEVELS.map((l) => {
      const key = leagueKey(sel.country, l);
      const lg = py.leagues[key];
      const sub = lg ? `${lg.matchday}/${lg.fixtures.length}` : '';
      return `<button class="lg-tab ${sel.level === l ? 'on' : ''}" data-level="${l}">${fmt(L.level, { n: l })}${key === myKey ? '<i class="lg-dot"></i>' : ''}<small>${sub}</small></button>`;
    }).join('');
    const isMine = sel.country === state.season.country && sel.level === state.season.level;
    const views = ['table', 'results', 'playoffs'].concat(state.season.complete ? ['review'] : [])
      .map((k) => `<button class="lg-tab sub ${tab === k ? 'on' : ''}" data-view="${k}">${L.tabs[k]}</button>`).join('');
    return `<div class="lg-tabs">
      <div class="lg-row">${country}</div>
      <div class="lg-row">${level}${isMine ? '' : `<button class="btn lg-mine" data-mine>${L.myLeague}</button>`}</div>
      <div class="lg-row views">${views}</div>
    </div>`;
  }

  function tableView(state, world) {
    const key = leagueKey(sel.country, sel.level);
    const rows = leagueRows(state, world, key);
    const n = rows.length;
    const rules = levelRules(sel.country, sel.level);
    const zones = new Set(rows.map((r) => zoneOf(sel.country, sel.level, r.pos, n)));
    const legend = ['up', 'po', 'down'].filter((z) => zones.has(z)).map((z) => {
      const label = z === 'down' && sel.level === LEAGUE_SYSTEM.levels ? L.zone.downBottom : L.zone[z];
      const cnt = z === 'up' ? rules.promoteAuto : z === 'po' ? LEAGUE_SYSTEM.playoff.teams : relegatedFrom(sel.country, sel.level);
      return `<span class="lg-key z-${z}"><i></i>${esc(label)} (${cnt})</span>`;
    }).join('');
    return `<div class="panel">
      <h3>${esc(fmt(L.title, { league: `${nationName(sel.country)} - ${fmt(L.level, { n: sel.level })}`, n: state.season.number }))}</h3>
      <div class="lg-legend">${legend}</div>
      <table class="tbl big lg-tbl"><thead><tr><th>${L.pos}</th><th>${L.club}</th><th>${L.pld}</th><th>${L.w}</th><th>${L.d}</th><th>${L.l}</th><th>${L.gf}</th><th>${L.ga}</th><th>${L.gd}</th><th>${L.pts}</th></tr></thead>
      <tbody>${rows.map((r) => {
        const z = zoneOf(sel.country, sel.level, r.pos, n);
        return `<tr class="${r.me ? 'me' : ''} ${z ? 'z-' + z : ''}"><td>${r.pos}</td><td class="nm">${crestSVG({ ...r.club.crest, size: 22 })} ${esc(r.name)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.gf - r.ga}</td><td><b>${r.pts}</b></td></tr>`;
      }).join('')}</tbody></table>
    </div>`;
  }

  function resultsView(state, world) {
    const lg = state.season.pyramid.leagues[leagueKey(sel.country, sel.level)];
    const total = lg.fixtures.length;
    const d = day == null ? Math.max(0, Math.min(total - 1, lg.matchday - 1)) : Math.max(0, Math.min(total - 1, day));
    const played = lg.results.filter((r) => r.matchday === d);
    const todo = d >= lg.matchday ? lg.fixtures[d] || [] : [];
    const line = (h, a, mid, mineCls) => `<div class="res ${mineCls ? 'mine' : ''}"><span class="h">${cname(h)} ${crest(state, world, h, 16)}</span><b>${mid}</b><span class="a">${crest(state, world, a, 16)} ${cname(a)}</span></div>`;
    const body = played.length
      ? played.map((r) => line(r.home, r.away, `${r.hg} - ${r.ag}`, r.home === MY_CLUB_ID || r.away === MY_CLUB_ID)).join('')
      : todo.length ? `<p class="dim">${L.upcoming}</p>` + todo.map(([h, a]) => line(h, a, S.hub.vs, h === MY_CLUB_ID || a === MY_CLUB_ID)).join('') : `<p class="dim">${L.noMatches}</p>`;
    return `<div class="panel">
      <div class="lg-day"><button class="btn" data-day="${d - 1}" ${d <= 0 ? 'disabled' : ''}>${L.prev}</button>
        <h3>${fmt(L.matchdayOf, { n: d + 1, total })}</h3>
        <button class="btn" data-day="${d + 1}" ${d >= total - 1 ? 'disabled' : ''}>${L.next}</button></div>
      <div class="day">${body}</div>
    </div>`;
  }

  /** One tie of a bracket: two club rows with their aggregate, the legs and the shootout. */
  function tieHTML(state, world, po, ti) {
    const tie = po.ties[ti];
    const agg = (id) => tie.legs.reduce((s, l) => s + (l.home === id ? l.hg : l.away === id ? l.ag : 0), 0);
    const row = (id) => {
      const seed = id != null ? po.seeds.indexOf(id) + 1 : 0;
      const win = tie.winner != null && tie.winner === id;
      return `<div class="po-club ${win ? 'win' : ''} ${id === MY_CLUB_ID ? 'me' : ''}">${id != null ? crest(state, world, id, 20) : ''}<span>${cname(id)}</span>${seed ? `<small>${fmt(L.seed, { n: seed })}</small>` : ''}<b>${id != null && tie.legs.length ? agg(id) : ''}</b></div>`;
    };
    const legs = tie.legs.map((l, i) => `<small>${fmt(L.leg, { n: i + 1 })}: ${cname(l.home)} ${l.hg} - ${l.ag} ${cname(l.away)}</small>`).join('');
    const pens = tie.pens ? `<small>${fmt(L.pens, { a: tie.pens.a, b: tie.pens.b })}</small>` : '';
    return `<div class="po-tie">${row(tie.a)}${row(tie.b)}<div class="po-legs">${legs}${pens}</div></div>`;
  }

  function playoffsView(state, world) {
    const key = leagueKey(sel.country, sel.level);
    const rules = levelRules(sel.country, sel.level);
    if (!rules.playoff) return `<div class="panel"><p class="dim">${L.noPlayoffs}</p></div>`;
    const po = state.season.pyramid.playoffs && state.season.pyramid.playoffs[key];
    if (!po) {
      const rows = leagueRows(state, world, key).slice(rules.promoteAuto, rules.promoteAuto + LEAGUE_SYSTEM.playoff.teams);
      return `<div class="panel"><h3>${L.playoffs}</h3><p class="dim">${L.playoffsLater}</p>
        <table class="tbl"><tbody>${rows.map((r, i) => `<tr class="${r.me ? 'me' : ''}"><td>${fmt(L.seed, { n: i + 1 })}</td><td class="nm">${crestSVG({ ...r.club.crest, size: 18 })} ${esc(r.name)}</td><td>${r.pts} ${L.pts}</td></tr>`).join('')}</tbody></table></div>`;
    }
    return `<div class="panel"><h3>${L.playoffs}</h3>
      <div class="po-bracket">
        <div class="po-col"><h4>${L.semi}</h4>${tieHTML(state, world, po, 0)}${tieHTML(state, world, po, 1)}</div>
        <div class="po-col"><h4>${L.final}</h4>${tieHTML(state, world, po, 2)}</div>
        <div class="po-col"><h4>${L.winner}</h4><div class="po-tie champ">${po.winner != null ? `<div class="po-club win ${po.winner === MY_CLUB_ID ? 'me' : ''}">${crest(state, world, po.winner, 28)}<span>${cname(po.winner)}</span></div>` : `<div class="po-club"><span class="dim">${L.tbd}</span></div>`}</div></div>
      </div></div>`;
  }

  function reviewView(state, world) {
    const py = state.season.pyramid;
    const out = py.outcome;
    const s = state.season.summary;
    if (!out || !s) return `<div class="panel"><p class="dim">${L.reviewHint}</p></div>`;
    const move = s.promoted ? fmt(L.moved.up, { n: s.newLevel }) : s.relegated ? (s.newLevel === 0 ? L.moved.out : fmt(L.moved.down, { n: s.newLevel })) : fmt(L.moved.same, { n: s.newLevel });
    const names = (ids) => (ids && ids.length ? ids.map((id) => `<span class="${id === MY_CLUB_ID ? 'me' : ''}">${cname(id)}</span>`).join(', ') : `<span class="dim">${L.none}</span>`);
    const c = sel.country;
    const rowsHTML = LEVELS.map((l) => {
      const key = leagueKey(c, l);
      return `<tr><td><b>${fmt(L.level, { n: l })}</b></td>
        <td>${names([out.champions[key]])}</td>
        <td>${l > 1 ? names(out.promoted[key]) : '<span class="dim">-</span>'}</td>
        <td>${names(out.relegated[key])}</td></tr>`;
    }).join('');
    return `<div class="panel lg-review">
      <h3>${esc(fmt(L.reviewTitle, { n: s.season }))}</h3>
      <div class="lg-mine-sum"><b>${L.yourSeason}</b>: ${esc(fmt(S.hub.finished, { pos: s.position, pts: s.points, prize: s.prize.toLocaleString('en-US') }).replace(/<[^>]+>/g, ''))}
        ${s.playoff ? ' ' + esc(S.hub.playoffResult[s.playoff]) : ''} <span class="chip">${esc(move)}</span></div>
      <h4>${esc(nationName(c))}</h4>
      <table class="tbl lg-rev"><thead><tr><th>${L.levelHdr}</th><th>${L.champions}</th><th>${L.promoted}</th><th>${L.relegated}</th></tr></thead><tbody>${rowsHTML}</tbody></table>
      <div class="lg-exch"><span><b>${L.exchangeIn}</b>: ${names(out.exchangeIn[c])}</span><span><b>${L.exchangeOut}</b>: ${names(out.exchangeOut[c])}</span></div>
    </div>`;
  }

  // ------------------------------------------------------------------ render and events
  function render() {
    const { state, world } = store;
    if (!state.season.pyramid) return;
    if (tab === 'review' && !state.season.complete) tab = 'table';
    const body = tab === 'results' ? resultsView(state, world) : tab === 'playoffs' ? playoffsView(state, world) : tab === 'review' ? reviewView(state, world) : tableView(state, world);
    root.innerHTML = `<section class="league2">${simBar(state)}${tabsBar(state)}${body}</section>`;
    root.querySelectorAll('[data-country]').forEach((b) => { b.onclick = () => { sel.country = b.dataset.country; day = null; render(); }; });
    root.querySelectorAll('[data-level]').forEach((b) => { b.onclick = () => { sel.level = Number(b.dataset.level); day = null; render(); }; });
    root.querySelectorAll('[data-view]').forEach((b) => { b.onclick = () => { tab = b.dataset.view; render(); }; });
    root.querySelectorAll('[data-day]').forEach((b) => { b.onclick = () => { day = Number(b.dataset.day); render(); }; });
    const m = root.querySelector('[data-mine]');
    if (m) m.onclick = () => { sel = mine(); day = null; render(); };
    root.querySelectorAll('[data-sim]').forEach((b) => {
      b.onclick = async () => {
        busy = true; note = L.simBusy + '...'; render();
        await new Promise((r) => setTimeout(r, 30)); // let the busy state paint before the synchronous simulation
        const r = b.dataset.sim === 'end' ? await store.dispatch('season/simToEnd') : await store.dispatch('season/simRounds', { n: Number(b.dataset.sim) });
        busy = false;
        note = r && r.ok === false ? (r.error || '') : fmt(L.simDone, { n: r.rounds, m: r.mine });
        if (store.state.season.complete) tab = 'review';
        render();
      };
    });
    const nx = root.querySelector('#lg-next');
    if (nx) nx.onclick = async () => { await store.dispatch('season/next'); sel = mine(); tab = 'table'; day = null; store.dispatch('nav', { screen: 'hub' }); };
  }
  render();
  return store.subscribe(() => { if (!busy) render(); });
}
