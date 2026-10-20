// Hidden cheat menu for testing. Open with F2, the key left of 1 (backtick or the 2-superscript key), Ctrl+Shift+K, Ctrl+Alt+C, or by clicking the TOUCHLINE logo 5 times
// quickly (works on touch). DEV TOOL: its English labels are intentionally inline, not part of strings.js.

const GROUPS = [
  ['Coins', [
    ['+1,000', 'coins', 1000], ['+10,000', 'coins', 10000], ['+100,000', 'coins', 100000],
  ]],
  ['Free packs', [
    ['Bronze', 'pack', 'bronze'], ['Silver', 'pack', 'silver'], ['Gold', 'pack', 'gold'], ['Promo', 'pack', 'promo'], ['Guaranteed Elite', 'pack', 'elite'],
    ['GK', 'pack', 'gk'], ['Defender', 'pack', 'def'], ['Midfielder', 'pack', 'mid'], ['Attacker', 'pack', 'att'],
    ['Prospect', 'pack', 'prospect'], ['Veteran', 'pack', 'veteran'], ['Staff', 'pack', 'staff'], ['Training', 'pack', 'training'],
  ]],
  ['Sign a player', [
    ['Gold', 'sign', 'gold'], ['Elite', 'sign', 'elite'], ['Icon', 'sign', 'icon'], ['Elite GK', 'sign', 'elite:GK'], ['Elite ST', 'sign', 'elite:ST'], ['Gold CB', 'sign', 'gold:CB'],
  ]],
  ['Staff', [
    ['Fitness coach', 'staff', 'fitness'], ['Physio', 'staff', 'physio'], ['Scout', 'staff', 'scout'], ['Analyst', 'staff', 'analyst'], ['Set-piece coach', 'staff', 'setPiece'],
  ]],
  ['Squad', [
    ['Heal everyone', 'heal'], ['Boost +0', 'boost', 0], ['Boost +5', 'boost', 5], ['Boost +10', 'boost', 10], ['Boost +20', 'boost', 20],
  ]],
  ['Season', [
    ['Play next match', 'play', 1], ['Play 3 matches', 'play', 3], ['Finish season', 'finish'], ['Next season', 'next'],
  ]],
  ['Info', [
    ['Copy save JSON', 'copy'], ['Log state to console', 'log'],
  ]],
];

export function mountCheats(store) {
  let panel = null;
  let clicks = [];

  function close() { if (panel) { panel.remove(); panel = null; } }

  function toast(msg) {
    const t = panel && panel.querySelector('.ch-msg');
    if (t) t.textContent = msg;
  }

  async function run(kind, arg) {
    if (!store.state) { toast('Start a game first'); return; }
    const r = await store.dispatch('cheat/' + kind, { arg });
    toast(r && r.msg ? r.msg : 'Done');
  }

  function open() {
    if (panel) { close(); return; }
    panel = document.createElement('div');
    panel.className = 'ch-wrap';
    const coins = store.state ? store.state.coins.toLocaleString('en-US') : '-';
    panel.innerHTML = `
      <div class="ch-card" role="dialog" aria-label="Cheat menu">
        <div class="ch-head"><b>CHEATS</b> <span class="ch-dim">test only, marks the save as cheated</span><button class="ch-x" aria-label="Close">x</button></div>
        <div class="ch-msg">${store.state ? 'Coins: ' + coins : 'Start a game to use the cheats'}</div>
        ${GROUPS.map(([title, items]) => `<div class="ch-group"><h4>${title}</h4><div class="ch-row">${items.map(([label, kind, arg]) =>
          `<button class="ch-btn" data-kind="${kind}" data-arg="${arg === undefined ? '' : arg}">${label}</button>`).join('')}</div></div>`).join('')}
      </div>`;
    document.body.appendChild(panel);
    panel.querySelector('.ch-x').onclick = close;
    panel.addEventListener('click', (e) => { if (e.target === panel) close(); });
    panel.querySelectorAll('.ch-btn').forEach((b) => {
      b.onclick = () => {
        const raw = b.dataset.arg;
        const arg = raw !== '' && !isNaN(Number(raw)) ? Number(raw) : raw;
        run(b.dataset.kind, arg);
      };
    });
  }

  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const opens = e.key === '`' || e.key === '²' || e.key === 'Dead' || e.code === 'Backquote' || e.key === 'F2'
      || (e.ctrlKey && e.shiftKey && (e.key === 'K' || e.key === 'k')) || (e.ctrlKey && e.altKey && (e.key === 'c' || e.key === 'C'));
    if (opens) { e.preventDefault(); open(); }
    if (e.key === 'Escape' && panel) close();
  });
  // five quick clicks on the logo
  document.addEventListener('click', (e) => {
    if (!e.target.closest || !e.target.closest('.tb-brand')) return;
    const now = performance.now();
    clicks = clicks.filter((t) => now - t < 1800);
    clicks.push(now);
    if (clicks.length >= 5) { clicks = []; open(); }
  });

  return { open, close };
}

export const CHEAT_CSS = `
.ch-wrap { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,.6); display: grid; place-items: center; padding: 12px; }
.ch-card { width: min(560px, 100%); max-height: 92vh; overflow: auto; background: #10101a; border: 2px solid #ff3b4e; border-radius: 14px; padding: 14px 16px; color: #eef2fb; font: 14px var(--font-ui); box-shadow: 0 0 40px rgba(255,59,78,.35); }
.ch-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.ch-head b { color: #ff3b4e; letter-spacing: .2em; }
.ch-dim { color: #9aa6c4; font-size: 12px; flex: 1; }
.ch-x { background: #1d2740; border: 0; border-radius: 8px; color: #fff; width: 30px; height: 30px; }
.ch-msg { background: #07090f; border-radius: 8px; padding: 8px 10px; margin-bottom: 8px; color: #3ddc97; min-height: 20px; }
.ch-group h4 { margin: 10px 0 6px; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: #9aa6c4; }
.ch-row { display: flex; flex-wrap: wrap; gap: 6px; }
.ch-btn { background: #1d2740; border: 1px solid rgba(255,255,255,.12); color: #fff; border-radius: 8px; padding: 7px 11px; font-weight: 600; }
.ch-btn:hover { background: #2a3860; }
.ch-btn:active { transform: translateY(1px); }
`;
