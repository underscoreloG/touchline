// Half-time dressing room: first-half summary, an assistant's read of the game, a team talk with the players' reaction,
// a mentality switch and substitutions. Resolves with the team-talk decision for the engine prompt.
// Mentality and subs are applied immediately through view.decide(). No game rules here: the engine decides the effects.

import { matchState, summarise } from '../logic/matchEngine.js';
import { S } from '../strings.js';

// Text: strings.js S.halftime.
export const HALFTIME_TEXT = S.halftime;

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Which assistant line fits the first half, from the stats. */
export function assistantKey(stats, myKey, score, onPitch) {
  const opp = myKey === 'home' ? 'away' : 'home';
  const diff = score[myKey] - score[opp];
  const xgMe = stats.xg[myKey], xgOpp = stats.xg[opp];
  const poss = stats.possession[myKey];
  const tired = onPitch.filter((p) => p && p.fitness < 62).length;
  const carded = onPitch.filter((p) => p && p.yellows > 0).length;
  if (diff < 0 && xgMe >= xgOpp) return 'unlucky';
  if (diff > 0 && xgOpp > xgMe + 0.3) return 'lucky';
  if (tired >= 3) return 'tired';
  if (carded >= 2) return 'cards';
  if (poss >= 58 && stats.shots[myKey] <= stats.shots[opp] + 1) return 'passing';
  if (poss <= 42 && diff <= 0) return 'pressed';
  if (diff > 0 && xgMe > xgOpp) return 'dominant';
  return 'even';
}

/**
 * @param {{match:object, view:{decide:Function}, myKey:'home'|'away', host:HTMLElement, t?:object, onSound?:Function}} o
 * @returns {Promise<{type:'teamTalk', team:string, value:string}>}
 */
export function askHalftime({ match, view, myKey, host, t = HALFTIME_TEXT, onSound }) {
  const T = { ...HALFTIME_TEXT, ...t };
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal ht-modal';
    host.appendChild(wrap);
    let talk = null; // chosen value
    let reaction = '';

    const situation = () => {
      const s = matchState(match).score;
      const opp = myKey === 'home' ? 'away' : 'home';
      return s[myKey] < s[opp] ? 'behind' : s[myKey] > s[opp] ? 'ahead' : 'level';
    };

    function render() {
      const ms = matchState(match);
      const me = ms[myKey];
      const sum = summarise(match);
      const st = sum.stats;
      const opp = myKey === 'home' ? 'away' : 'home';
      const sit = situation();
      const row = (label, a, b) => `<div class="ht-row"><b>${a}</b><span>${label}</span><b>${b}</b></div>`;
      const aKey = assistantKey(st, myKey, ms.score, me.onPitch);
      const tired = me.onPitch.filter((p) => p && !p.red && p.fitness < 70).sort((a, b) => a.fitness - b.fitness).slice(0, 5);
      const bench = me.bench.filter((b) => b.available);
      const subsOk = me.subsLeft > 0 && bench.length > 0;
      const options = (p) => bench.filter((b) => (b.pos === 'GK') === (p.pos === 'GK')); // keepers for keepers only
      wrap.innerHTML = `<div class="modal-card ht-card" role="dialog" aria-label="${esc(T.title)}">
        <h3>${esc(T.title)}</h3>
        <div class="ht-grid">
          <section class="ht-col">
            <h4>${esc(T.firstHalf)}</h4>
            <div class="ht-score"><span>${esc(ms[myKey].name)}</span><b>${ms.score[myKey]} - ${ms.score[opp]}</b><span>${esc(ms[opp].name)}</span></div>
            ${row(T.possession, Math.round(st.possession[myKey]) + '%', Math.round(st.possession[opp]) + '%')}
            ${row(T.shots, st.shots[myKey], st.shots[opp])}
            ${row(T.onTarget, st.shotsOnTarget[myKey], st.shotsOnTarget[opp])}
            ${row(T.xg, st.xg[myKey].toFixed(2), st.xg[opp].toFixed(2))}
            <div class="ht-assist"><small>${esc(T.assistant)}</small><p>${esc(T.assist[aKey])}</p></div>
          </section>
          <section class="ht-col">
            <h4>${esc(T.talkTitle)}</h4>
            <p class="ht-dim">${esc(T.talkHint)}</p>
            <div class="ht-talks">${T.talks[sit].map((o) => `<button class="btn ht-talk ${talk === o.value ? 'primary' : ''}" data-talk="${o.value}" ${talk ? 'disabled' : ''}>${esc(o.say)}</button>`).join('')}</div>
            ${reaction ? `<div class="ht-react"><small>${esc(T.reactionTitle)}</small><p>${esc(reaction)}</p></div>` : ''}
          </section>
          <section class="ht-col">
            <h4>${esc(T.tacticsTitle)}</h4>
            <div class="ht-seg" role="group" aria-label="${esc(T.mentalityNow)}">${['defensive', 'balanced', 'attacking'].map((m) => `<button class="btn ${me.mentality === m ? 'primary' : ''}" data-ment="${m}">${esc(T.mentality[m])}</button>`).join('')}</div>
            <h4>${esc(T.subsTitle)} <small>${esc(T.subsLeft)}: ${me.subsLeft}</small></h4>
            ${tired.length ? tired.map((p) => `<div class="ht-sub"><span>${esc(p.pos)} ${esc(p.name)} <i>${esc(T.tired)} ${p.fitness}</i></span>
              ${subsOk && options(p).length ? `<select data-out="${p.id}"><option value="">${esc(T.swapFor)}</option>${options(p).map((b) => `<option value="${b.id}">${esc(b.pos)} ${esc(b.name)} (${b.fitness})</option>`).join('')}</select><button class="btn" data-sub="${p.id}">${esc(T.doSub)}</button>` : ''}</div>`).join('') : `<p class="ht-dim">${esc(T.noTired)}</p>`}
          </section>
        </div>
        <div class="row"><button class="btn primary big" id="ht-go">${esc(T.startSecond)}</button></div>
      </div>`;

      wrap.querySelectorAll('[data-talk]').forEach((b) => {
        b.onclick = () => {
          talk = b.dataset.talk;
          const line = T.talks[sit].find((o) => o.value === talk);
          reaction = T.reactions[`${talk}:${sit}`] || '';
          if (onSound) onSound(talk);
          render();
          void line;
        };
      });
      wrap.querySelectorAll('[data-ment]').forEach((b) => {
        b.onclick = () => { view.decide({ type: 'mentality', team: myKey, value: b.dataset.ment }); render(); };
      });
      wrap.querySelectorAll('[data-sub]').forEach((b) => {
        b.onclick = () => {
          const sel = wrap.querySelector(`select[data-out="${b.dataset.sub}"]`);
          if (!sel || !sel.value) return;
          view.decide({ type: 'sub', team: myKey, outId: Number(b.dataset.sub), inId: Number(sel.value) });
          render();
        };
      });
      wrap.querySelector('#ht-go').onclick = () => {
        wrap.remove();
        resolve({ type: 'teamTalk', team: myKey, value: talk || 'none' });
      };
    }
    render();
  });
}

export const HALFTIME_CSS = `
.ht-card { width: min(980px, 96vw); max-height: 94vh; overflow: auto; }
.ht-grid { display: grid; grid-template-columns: 1fr 1.1fr 1fr; gap: 16px; }
.ht-col h4 { margin: 4px 0 8px; font: 700 12px var(--font-ui); letter-spacing: .12em; text-transform: uppercase; color: var(--text-dim); }
.ht-col h4 small { margin-left: 8px; color: var(--text); }
.ht-score { display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; align-items: center; text-align: center; margin-bottom: 8px; }
.ht-score b { font: 800 30px var(--font-display); }
.ht-score span { font-size: 12px; color: var(--text-dim); }
.ht-row { display: grid; grid-template-columns: 60px 1fr 60px; text-align: center; padding: 5px 0; border-top: 1px solid var(--line); font-size: 14px; }
.ht-row span { color: var(--text-dim); }
.ht-assist, .ht-react { margin-top: 12px; background: var(--bg-1); border-left: 3px solid var(--accent-2); border-radius: 6px; padding: 8px 10px; }
.ht-assist small, .ht-react small { color: var(--text-dim); text-transform: uppercase; letter-spacing: .1em; font-size: 10px; }
.ht-assist p, .ht-react p { margin: 4px 0 0; font-size: 14px; }
.ht-react { border-left-color: var(--warn); }
.ht-dim { color: var(--text-dim); font-size: 12px; margin: 0 0 8px; }
.ht-talks { display: flex; flex-direction: column; gap: 8px; }
.ht-talk { text-align: left; white-space: normal; line-height: 1.35; }
.ht-seg { display: flex; gap: 6px; margin-bottom: 12px; }
.ht-seg .btn { flex: 1; padding: 8px 4px; }
.ht-sub { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 6px 0; border-top: 1px solid var(--line); font-size: 13px; }
.ht-sub span { flex: 1 1 100%; } .ht-sub i { color: var(--warn); font-style: normal; margin-left: 6px; }
.ht-sub select { flex: 1; background: var(--bg-2); color: var(--text); border: 1px solid var(--line); border-radius: 6px; padding: 6px; }
.ht-sub .btn { padding: 6px 12px; }
@media (max-width: 860px) { .ht-grid { grid-template-columns: 1fr; } }
`;
