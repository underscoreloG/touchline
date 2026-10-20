// Match flow: pre-match panel, live match view with key-moment prompts, post-match summary.
// The 2D view (ui/match.js) is a choreographed replay of the engine; this file only sequences screens.

import { S, fmt } from '../strings.js';
import { prepareMatch, createLiveMatch } from '../logic/game.js';
import { teamRatings } from '../logic/cardEffects.js';
import { crestSVG } from './components/crest.js';
import { mountMatchView } from './match.js';
import { matchState } from '../logic/matchEngine.js';
import { ENGINE_DETAIL } from '../balance.js';
import { askHalftime, HALFTIME_CSS } from './halftime.js';
import audio from './audio.js';

// Touchline text: strings.js S.touchline
const TL_TEXT = S.touchline;
const TL_CSS = `
.match-wrap { display: flex; flex-direction: column; min-height: calc(100vh - 110px); }
.match-wrap .match-host { flex: 1; min-height: 0; }
.tl-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 12px; background: var(--bg-1); border-top: 1px solid var(--line); }
.tl-title { font: 700 11px var(--font-ui); letter-spacing: .14em; text-transform: uppercase; color: var(--text-dim); margin-right: 4px; }
.tl-btn { position: relative; overflow: hidden; display: inline-flex; align-items: center; gap: 8px; background: var(--bg-3); border: 1px solid var(--line); border-radius: 10px; padding: 9px 14px; color: var(--text); min-width: 120px; }
.tl-btn b { position: relative; z-index: 1; }
.tl-btn small { position: relative; z-index: 1; margin-left: auto; color: var(--warn); font-variant-numeric: tabular-nums; }
.tl-btn kbd { position: relative; z-index: 1; font: 11px var(--font-ui); background: rgba(255,255,255,.08); border-radius: 4px; padding: 1px 5px; color: var(--text-dim); }
.tl-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: rgba(255, 255, 255, .12); transition: width .2s linear; }
.tl-btn:hover:not(:disabled) { background: #28345a; }
.tl-btn:disabled { opacity: .65; cursor: not-allowed; }
.tl-btn.active { border-color: var(--accent-2); box-shadow: 0 0 0 1px var(--accent-2) inset, 0 0 14px rgba(61, 220, 151, .35); }
.tl-msg { color: var(--text-dim); font-size: 13px; margin-left: 6px; }
@media (max-width: 600px) { .tl-btn { min-width: 0; flex: 1; padding: 8px; } .tl-btn kbd, .tl-title { display: none; } }
`;

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function mountMatchFlow(root, store) {
  const { state, world } = store;
  let view = null;
  let alive = true;
  const prep = prepareMatch(state, world);
  if (!prep || prep.error) {
    root.innerHTML = `<div class="panel"><h3>${S.match.cannotPlay}</h3><p>${esc(prep ? prep.error : S.match.noFixture)}</p><div class="row"><button class="btn primary" id="pm-fix">${S.nav.squad}</button><button class="btn ghost" id="pm-back">${S.common.back}</button></div></div>`;
    root.querySelector('#pm-fix').onclick = () => store.dispatch('nav', { screen: 'squad' });
    root.querySelector('#pm-back').onclick = () => store.dispatch('nav', { screen: 'hub' });
    return;
  }
  let started = false, finished = false;
  const myKey = prep.info.homeIsMe ? 'home' : 'away';

  function preMatch() {
    const hr = teamRatings(prep.home), ar = teamRatings(prep.away);
    const row = (label, a, b) => `<div class="pm-row"><b>${Math.round(a)}</b><span>${label}</span><b>${Math.round(b)}</b></div>`;
    root.innerHTML = `<section class="prematch panel">
      <h3>${prep.info.phase === 'playoffs' ? S.hub.playoffMatch[prep.info.playoffStage] : fmt(S.match.matchdayN, { n: prep.info.matchday + 1 })}</h3>
      <div class="vs">
        <div class="side">${crestSVG({ ...(prep.info.homeIsMe ? state.club.crest : prep.info.opp.crest), size: 84 })}<b>${esc(prep.home.name)}</b></div>
        <div class="vs-mid">${prep.info.homeIsMe ? S.match.home : S.match.away}<small>${fmt(S.match.formationVs, { h: esc(prep.home.formation), a: esc(prep.away.formation) })}</small></div>
        <div class="side">${crestSVG({ ...(prep.info.homeIsMe ? prep.info.opp.crest : state.club.crest), size: 84 })}<b>${esc(prep.away.name)}</b></div>
      </div>
      <div class="pm-ratings">${row(S.match.overall, hr.ovr, ar.ovr)}${row(S.match.attack, hr.att, ar.att)}${row(S.match.midfield, hr.mid, ar.mid)}${row(S.match.defence, hr.def, ar.def)}${row(S.match.chemistry, prep.home.chemistry, prep.away.chemistry)}</div>
      <div class="row">
        <button class="btn primary big" id="pm-kick">${S.match.kickoff}</button>
        <button class="btn" id="pm-squad">${S.nav.squad}</button>
        <button class="btn" id="pm-tactics">${S.nav.tactics}</button>
        <button class="btn ghost" id="pm-back">${S.common.back}</button>
      </div></section>`;
    root.querySelector('#pm-kick').onclick = kickOff;
    root.querySelector('#pm-squad').onclick = () => store.dispatch('nav', { screen: 'squad' });
    root.querySelector('#pm-tactics').onclick = () => store.dispatch('nav', { screen: 'tactics' });
    root.querySelector('#pm-back').onclick = () => store.dispatch('nav', { screen: 'hub' });
  }

  // Real recordings for match events. Throttled so highlights fast-forward and x4 speed do not turn into sound spam.
  let lastSfx = 0;
  function matchSound(ev) {
    const now = performance.now();
    if (ev.type === 'goal') { lastSfx = now; audio.goalHorn(); return; }
    if (now - lastSfx < 450) return;
    if (ev.type === 'woodwork') { lastSfx = now; audio.post(); }
    else if (ev.type === 'shot' || ev.type === 'save' || ev.type === 'miss' || ev.type === 'blocked') { lastSfx = now; audio.kick((ev.xg || 0) >= 0.15); }
    else if (ev.type === 'foul') { lastSfx = now; audio.tackle(); }
  }

  function kickOff() {
    root.innerHTML = '<div class="match-wrap"><div class="match-host" id="match-host"></div><div class="tl-bar" id="tl-bar"></div></div>';
    const host = root.querySelector('#match-host');
    ensureStyle();
    started = true;
    const match = createLiveMatch(prep);
    const names = new Map();
    for (const t of [prep.home, prep.away]) for (const p of [...t.xi, ...t.bench]) names.set(p.id, p.name);
    audio.crowdSwell();
    view = mountMatchView(host, {
      home: prep.home, away: prep.away, match, seed: prep.seed,
      speed: store.ui.matchSpeed, highlights: store.ui.highlights,
      onKeyMoment: (prompt) => (prompt.type === 'halftimeTalk' && prompt.team === myKey
        ? askHalftime({ match, view, myKey, host: document.getElementById('overlay'), onSound: () => audio.confirm() })
        : askKeyMoment(prompt, names)),
      onOpenTactics: () => {}, onOpenOpponent: () => {}, onOpenSettings: () => {},
      onEvent: matchSound,
      onFinish: async (result) => {
        if (!alive) return;
        finished = true;
        stopTouchline();
        const summary = await store.dispatch('match/applyResult', { result, prep });
        postMatch(result, summary);
      },
    });
    startTouchline(match);
  }

  // ---- touchline shouts: always visible, each with a cooldown (counted in match minutes)
  const SHOUTS = [
    { id: 'shout', key: '1', label: TL_TEXT.shout, tip: TL_TEXT.shoutTip },
    { id: 'calm', key: '2', label: TL_TEXT.calm, tip: TL_TEXT.calmTip },
    { id: 'encourage', key: '3', label: TL_TEXT.encourage, tip: TL_TEXT.encourageTip },
  ];
  let tlTimer = null, tlKey = null, tlMatch = null;
  function startTouchline(match) {
    tlMatch = match;
    const bar = root.querySelector('#tl-bar');
    bar.innerHTML = `<span class="tl-title">${TL_TEXT.title}</span>` + SHOUTS.map((s) => `<button class="tl-btn" data-shout="${s.id}" title="${s.tip}"><i class="tl-fill"></i><b>${s.label}</b><small class="tl-cd"></small><kbd>${s.key}</kbd></button>`).join('') + '<span class="tl-msg" id="tl-msg"></span>';
    bar.querySelectorAll('[data-shout]').forEach((b) => { b.onclick = () => doShout(b.dataset.shout); });
    tlKey = (e) => { const s = SHOUTS.find((x) => x.key === e.key); if (s && !e.ctrlKey && !e.metaKey && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName || '')) doShout(s.id); };
    window.addEventListener('keydown', tlKey);
    tlTimer = setInterval(updateTouchline, 200);
    updateTouchline();
  }
  function stopTouchline() {
    if (tlTimer) clearInterval(tlTimer);
    if (tlKey) window.removeEventListener('keydown', tlKey);
    tlTimer = null; tlKey = null;
    const bar = root.querySelector('#tl-bar');
    if (bar) bar.innerHTML = '';
  }
  function doShout(id) {
    if (!view || !tlMatch) return;
    const r = view.decide({ type: 'shout', team: myKey, value: id });
    const msg = root.querySelector('#tl-msg');
    if (r && r.ok === false) { audio.error(); if (msg) msg.textContent = r.error === 'cooldown' ? TL_TEXT.cooling : (r.error || ''); }
    else { audio.confirm(); if (msg) msg.textContent = TL_TEXT.done[id]; }
    updateTouchline();
  }
  function updateTouchline() {
    if (!tlMatch) return;
    const sd = matchState(tlMatch)[myKey];
    const SH = ENGINE_DETAIL.shouts;
    root.querySelectorAll('[data-shout]').forEach((b) => {
      const id = b.dataset.shout;
      const left = sd.shouts[id];
      const total = Math.max(SH.cooldown[id], SH.sharedCooldown);
      b.classList.toggle('cooling', left > 0);
      b.classList.toggle('active', sd.shoutActive === id);
      b.disabled = left > 0;
      b.querySelector('.tl-fill').style.width = left > 0 ? Math.min(100, (left / total) * 100) + '%' : '0%';
      b.querySelector('.tl-cd').textContent = left > 0 ? left * 3 + "'" : '';
    });
  }
  let styled = false;
  function ensureStyle() {
    if (styled || document.getElementById('ht-style')) return;
    styled = true;
    const st = document.createElement('style');
    st.id = 'ht-style';
    st.textContent = HALFTIME_CSS + TL_CSS;
    document.head.appendChild(st);
  }

  function askKeyMoment(prompt, names) {
    if (prompt.team !== myKey) return Promise.resolve(null);
    return new Promise((resolve) => {
      const dlg = document.createElement('div');
      dlg.className = 'modal';
      const nm = (id) => esc(names.get(id) || id);
      let title = '', body = '';
      if (prompt.type === 'penaltyTaker') {
        title = S.match.penalty.title; body = `<p>${S.match.penalty.body}</p>` + prompt.options.slice(0, 5).map((id) => `<button class="btn ${id === prompt.defaultId ? 'primary' : ''}" data-v="${id}">${nm(id)}</button>`).join('');
      } else if (prompt.type === 'halftimeTalk') {
        title = S.match.halfTime; body = `<p>${S.match.teamTalk.title}</p><button class="btn" data-v="shout">${S.match.teamTalk.shout}</button><button class="btn" data-v="calm">${S.match.teamTalk.calm}</button><button class="btn" data-v="none">${S.match.teamTalk.none}</button>`;
      } else if (prompt.type === 'lateGame') {
        title = S.match.lateGame.title; body = `<p>${S.match.lateGame.body}</p><button class="btn" data-v="push">${S.match.lateGame.push}</button><button class="btn" data-v="hold">${S.match.lateGame.hold}</button><button class="btn" data-v="keep">${S.match.lateGame.keep}</button>`;
      } else if (prompt.type === 'injurySub') {
        title = S.match.injury.title; body = `<p>${fmt(S.match.injury.body, { name: nm(prompt.outId) })}</p>` + prompt.options.map((id) => `<button class="btn ${id === prompt.defaultId ? 'primary' : ''}" data-v="${id}">${nm(id)}</button>`).join('');
      }
      dlg.innerHTML = `<div class="modal-card"><h3>${title}</h3>${body}</div>`;
      document.getElementById('overlay').appendChild(dlg);
      dlg.querySelectorAll('[data-v]').forEach((b) => {
        b.onclick = () => {
          dlg.remove();
          const raw = b.dataset.v;
          const id = Number(raw);
          if (prompt.type === 'penaltyTaker') resolve({ type: 'penaltyTaker', team: prompt.team, playerId: id });
          else if (prompt.type === 'halftimeTalk') resolve({ type: 'teamTalk', team: prompt.team, value: raw });
          else if (prompt.type === 'lateGame') resolve({ type: 'lateGame', team: prompt.team, value: raw });
          else resolve({ type: 'sub', team: prompt.team, outId: prompt.outId, inId: id });
        };
      });
    });
  }

  function postMatch(result, summary) {
    if (!alive) return;
    const mine = myKey === 'home' ? prep.home : prep.away;
    const names = new Map();
    for (const t of [prep.home, prep.away]) for (const p of [...t.xi, ...t.bench]) names.set(p.id, p.name);
    const goals = result.events.filter((e) => e.type === 'goal');
    const goalLines = goals.map((e) => `<li class="${e.team === myKey ? 'mine' : ''}">${e.minute}' ${esc(names.get(e.playerId) || S.match.unknownPlayer)}${e.assistId ? ` <small>(${esc(names.get(e.assistId))})</small>` : ''}</li>`).join('');
    const ratings = mine.xi.map((p) => ({ name: p.name, pos: p.pos, r: result.ratings[p.id] })).sort((a, b) => (b.r || 0) - (a.r || 0));
    const mom = result.manOfTheMatch;
    root.innerHTML = `<section class="postmatch panel">
      <h3>${S.match.fullTime}</h3>
      <div class="final"><span>${esc(prep.home.name)}</span><b>${result.score.home} - ${result.score.away}</b><span>${esc(prep.away.name)}</span></div>
      ${summary.pens ? `<p class="dim">${fmt(S.match.penaltiesResult, summary.pens)}</p>` : ''}
      <ul class="goals">${goalLines || `<li class="dim">${S.match.noGoals}</li>`}</ul>
      <div class="pm-grid">
        <div><h4>${S.match.stats}</h4>
          <div class="kv"><span>${S.match.possession}</span><b>${Math.round(result.stats.possession.home)} - ${Math.round(result.stats.possession.away)}</b></div>
          <div class="kv"><span>${S.match.shots}</span><b>${result.stats.shots.home} - ${result.stats.shots.away}</b></div>
          <div class="kv"><span>${S.match.xg}</span><b>${result.stats.xg.home.toFixed(2)} - ${result.stats.xg.away.toFixed(2)}</b></div>
          <div class="kv"><span>${S.match.coinsEarned}</span><b>+${summary.income}</b></div>
          ${mom != null ? `<div class="kv"><span>${S.match.manOfTheMatch}</span><b>${esc(names.get(typeof mom === 'object' ? mom.id : mom) || S.match.unknownPlayer)}</b></div>` : ''}
        </div>
        <div><h4>${S.match.yourRatings}</h4>${ratings.map((x) => `<div class="kv"><span>${esc(x.pos)} ${esc(x.name)}</span><b>${x.r != null ? x.r.toFixed(1) : '-'}</b></div>`).join('')}</div>
      </div>
      <div class="row"><button class="btn primary big" id="pm-continue">${S.match.continue}</button></div>
    </section>`;
    root.querySelector('#pm-continue').onclick = () => store.dispatch('nav', { screen: 'hub' });
  }

  preMatch();
  return () => {
    alive = false;
    stopTouchline();
    if (view && view.destroy) view.destroy();
    // leaving a started match commits it: the engine finishes it with the default answers (no re-rolling a result)
    if (started && !finished) store.dispatch('match/instant');
  };
}
