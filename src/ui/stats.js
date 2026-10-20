// Stats screen: My team, League, History. Read-only views from logic/stats.js.

import { S } from '../strings.js';
import { teamStats, leagueStats, historyStats } from '../logic/stats.js';
import { crestSVG } from './components/crest.js';

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const T = S.stats;
const TABS = ['team', 'league', 'history'];

export function mountStats(root, store) {
  let tab = 'team';

  function kv(label, value, cls = '') { return `<div class="kv ${cls}"><span>${esc(label)}</span><b>${value}</b></div>`; }
  function form(list) { return `<span class="st-form">${list.length ? list.map((r) => `<i class="f-${r}">${r}</i>`).join('') : '-'}</span>`; }
  const rec = (r) => `${r.w}-${r.d}-${r.l}`;
  const diff = (r) => { const d = r.gf - r.ga; return (d > 0 ? '+' : '') + d; };

  /** Horizontal bars. invert=true: a smaller value draws a longer bar (goals conceded). */
  function bars(rows, fmt = (v) => v, invert = false) {
    if (!rows.length) return `<p class="dim">${T.none}</p>`;
    const max = Math.max(...rows.map((r) => r.v), 1);
    if (invert) return rows.map((r) => `<div class="st-bar ${r.me ? 'me' : ''}"><span>${esc(r.name)}</span><div><i style="width:${(100 * (max + 1 - r.v)) / (max + 1)}%"></i></div><b>${fmt(r.v)}</b></div>`).join('');
    return rows.map((r) => `<div class="st-bar ${r.me ? 'me' : ''}"><span>${esc(r.name)}</span><div><i style="width:${(100 * r.v) / max}%"></i></div><b>${fmt(r.v)}</b></div>`).join('');
  }

  function playersTable(rows, cols) {
    if (!rows.length) return `<p class="dim">${T.none}</p>`;
    return `<table class="tbl"><thead><tr><th>${T.player}</th>${cols.map((c) => `<th>${T.col[c]}</th>`).join('')}</tr></thead><tbody>${rows.map((p) =>
      `<tr><td class="nm">${esc(p.name)}${p.clubName ? ` <small class="dim">${esc(p.clubName)}</small>` : ''}</td>${cols.map((c) => `<td>${c === 'avg' ? (p.avg ? p.avg.toFixed(2) : '-') : esc(p[c] ?? 0)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function teamTab() {
    const t = teamStats(store.state, store.world);
    return `<div class="st-grid">
      <div class="panel"><h3>${T.season}</h3>
        ${kv(T.position, t.position ? '#' + t.position : '-')}
        ${kv(T.points, t.points)}
        ${kv(T.record, rec(t.record) + ` <small class="dim">(${diff(t.record)})</small>`)}
        ${kv(T.home, rec(t.home))}
        ${kv(T.away, rec(t.away))}
        ${kv(T.form, form(t.form))}
        ${kv(T.goalsFor, t.record.gf)}
        ${kv(T.goalsAgainst, t.record.ga)}
        ${t.best ? kv(T.bestResult, `${t.best.gf}-${t.best.ga} ${esc(t.bestName)}`) : ''}
        ${t.worst && t.worst.gf - t.worst.ga < 0 ? kv(T.worstResult, `${t.worst.gf}-${t.worst.ga} ${esc(t.worstName)}`) : ''}
      </div>
      <div class="panel"><h3>${T.perMatch}</h3>
        ${kv(T.possession, t.team.possession + '%')}
        ${kv(T.shots, t.team.shots)}
        ${kv(T.shotsOnTarget, t.team.sot)}
        ${kv(T.xgFor, t.team.xgf.toFixed(2))}
        ${kv(T.xgAgainst, t.team.xga.toFixed(2))}
        ${kv(T.corners, t.team.corners)}
        ${kv(T.fouls, t.team.fouls)}
        ${kv(T.cleanSheets, t.team.cleanSheets)}
        ${kv(T.cards, `${t.team.yellows} / ${t.team.reds}`)}
      </div>
      <div class="panel"><h3>${T.recent}</h3>
        ${t.recent.length ? t.recent.map((x) => `<div class="res"><span class="h">${x.home ? esc(store.state.club.name) : esc(x.oppName)}</span><b class="f-${x.res}">${x.home ? x.gf + ' - ' + x.ga : x.ga + ' - ' + x.gf}</b><span class="a">${x.home ? esc(x.oppName) : esc(store.state.club.name)}</span></div>`).join('') : `<p class="dim">${T.none}</p>`}
      </div>
    </div>
    <div class="panel"><h3>${T.myPlayersSeason}</h3>${playersTable(t.players, ['apps', 'goals', 'assists', 'avg', 'cs', 'yellows'])}</div>
    <div class="panel"><h3>${T.careers}</h3>
      ${t.careers.length ? `<table class="tbl"><thead><tr><th>${T.player}</th><th>${T.col.apps}</th><th>${T.col.goals}</th><th>${T.col.assists}</th><th>${T.col.avg}</th><th>${T.col.cs}</th><th>${T.col.fitness}</th><th>${T.col.morale}</th></tr></thead><tbody>${t.careers.map((p) =>
        `<tr class="${p.injured || p.suspended ? 'out' : ''}"><td class="nm">${esc(p.name)}${p.injured ? ` <small class="bad">${T.injured}</small>` : ''}${p.suspended ? ` <small class="bad">${T.suspended}</small>` : ''}</td><td>${p.apps}</td><td>${p.goals}</td><td>${p.assists}</td><td>${p.avg ? p.avg.toFixed(2) : '-'}</td><td>${p.cs}</td><td>${p.fitness}</td><td>${p.morale}</td></tr>`).join('')}</tbody></table>` : `<p class="dim">${T.none}</p>`}
    </div>`;
  }

  function leagueTab() {
    const l = leagueStats(store.state, store.world);
    const mini = (m) => (m ? `${esc(m.home)} ${m.hg} - ${m.ag} ${esc(m.away)} <small class="dim">(${S.league.matchday} ${m.matchday})</small>` : '-');
    return `<div class="st-grid">
      <div class="panel"><h3>${T.leagueNumbers}</h3>
        ${kv(T.matchesPlayed, l.played)}
        ${kv(T.goalsTotal, l.goals)}
        ${kv(T.goalsPerMatch, l.goalsPerMatch.toFixed(2))}
        ${kv(T.homeDrawAway, `${l.homeWinPct}% / ${l.drawPct}% / ${l.awayWinPct}%`)}
        ${kv(T.biggestWin, mini(l.biggestWin))}
        ${kv(T.highestScoring, mini(l.highestScoring))}
      </div>
      <div class="panel"><h3>${T.bestAttack}</h3>${bars(l.bestAttack)}</div>
      <div class="panel"><h3>${T.bestDefence}</h3>${bars(l.bestDefence, (v) => v, true)}</div>
      <div class="panel"><h3>${T.cleanSheetsTitle}</h3>${bars(l.cleanSheets)}</div>
      <div class="panel"><h3>${T.mostPossession}</h3>${bars(l.mostPossession, (v) => v + '%')}</div>
      <div class="panel"><h3>${T.discipline}</h3>${bars(l.dirtiest)}</div>
    </div>
    <div class="st-grid st-grid-3">
      <div class="panel"><h3>${T.topScorers}</h3>${playersTable(l.topScorers, ['goals', 'apps'])}</div>
      <div class="panel"><h3>${T.topAssists}</h3>${playersTable(l.topAssists, ['assists', 'apps'])}</div>
      <div class="panel"><h3>${T.bestRated}</h3>${playersTable(l.bestRated, ['avg', 'apps'])}</div>
    </div>
    <div class="panel"><h3>${S.nav.league}</h3>
      <table class="tbl"><thead><tr><th>#</th><th>${S.league.club}</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead><tbody>${l.table.map((r) =>
        `<tr class="${r.me ? 'me' : ''}"><td>${r.pos}</td><td class="nm">${esc(r.name)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.gf - r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}</tbody></table>
    </div>`;
  }

  function historyTab() {
    const h = historyStats(store.state);
    return `<div class="panel"><h3>${T.history}</h3>${h.length ? `<table class="tbl"><thead><tr><th>${T.season}</th><th>${S.league.levelHdr}</th><th>${T.position}</th><th>${T.points}</th><th>${S.league.champion}</th><th>${S.league.movement}</th><th>${T.prize}</th></tr></thead><tbody>${h.map((x) =>
      `<tr><td>${x.season}</td><td>${x.country} ${x.level}</td><td>${x.position}</td><td>${x.points}</td><td class="nm">${esc(x.champion)}</td><td>${x.promoted ? '&uarr; ' + x.newLevel : x.relegated ? (x.newLevel ? '&darr; ' + x.newLevel : '&darr;') : '='}${x.playoff ? ' (' + S.league.playoffs + ')' : ''}</td><td>${x.prize.toLocaleString('en-US')}</td></tr>`).join('')}</tbody></table>` : `<p class="dim">${T.noHistory}</p>`}</div>`;
  }

  function render() {
    const body = tab === 'team' ? teamTab() : tab === 'league' ? leagueTab() : historyTab();
    root.innerHTML = `<section class="stats">
      <div class="st-head">${crestSVG({ ...store.state.club.crest, size: 40 })}<h2>${esc(store.state.club.name)}</h2>
        <div class="st-tabs" role="tablist">${TABS.map((k) => `<button class="st-tab ${tab === k ? 'on' : ''}" data-tab="${k}" role="tab">${T.tabs[k]}</button>`).join('')}</div>
      </div>${body}</section>`;
    root.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { tab = b.dataset.tab; render(); }; });
  }
  render();
  return store.subscribe(render);
}
