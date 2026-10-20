// README screenshots: drives a headless Chrome through the built game (dist/index.html) with the DevTools protocol.
//   node tools/build.js && node tools/shots.js      -> docs/screenshots/*.png
// Needs Chrome or Edge installed (path below) and Node 22+ (global WebSocket).

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'docs/screenshots');
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
if (!CHROME) throw new Error('No Chrome or Edge found');
mkdirSync(out, { recursive: true });

const PORT = 9333;
const profile = resolve(tmpdir(), 'touchline-shots-profile');
const proc = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--window-size=1440,900',
  '--hide-scrollbars', '--mute-audio', '--no-first-run', '--disable-gpu', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function wsUrl() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch (e) { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('Chrome did not start');
}

const ws = new WebSocket(await wsUrl());
await new Promise((r) => { ws.onopen = r; });
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const run = async (js) => {
  const r = await send('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true });
  if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails.exception || r.result.exceptionDetails));
  return r.result && r.result.result && r.result.result.value;
};
async function shot(name, settle = 700) {
  await sleep(settle);
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(resolve(out, `${name}.png`), Buffer.from(r.result.data, 'base64'));
  console.log('saved', name);
}

try {
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: pathToFileURL(resolve(root, 'dist/index.html')).href });
  await sleep(1500);
  await shot('01-new-game');

  await run(`window.__game.newGame({ skipPack: true, seed: 11, size: 30000, country: 'ENG', club: { name: 'Northbridge FC', colours: ['#c8102e', '#ffffff'], crest: { shape: 'shield', colours: ['#c8102e', '#ffffff'], emblem: 'star', pattern: 'plain', trim: '#ffffff', initials: 'NF' } } }).then(() => 1)`);
  await run(`window.__game.store.dispatch('cheat/boost', { arg: 14 }).then(() => 1)`);
  await run(`window.__game.store.dispatch('season/simRounds', { n: 14 }).then(() => 1)`);
  await run(`window.__game.go('hub')`);
  await shot('02-hub');

  await run(`window.__game.go('squad')`);
  await shot('03-squad', 1600);

  await run(`window.__game.go('league')`);
  await shot('04-league');

  await run(`window.__game.go('stats')`);
  await shot('05-stats');

  await run(`window.__game.go('packs')`);
  await shot('06-packs');

  // pack opening: do not await, the overlay stays up until the walkout is clicked
  await run(`window.__game.store.dispatch('cheat/coins', { arg: 100000 }).then(() => 1)`);
  await run(`void window.__game.store.dispatch('pack/buy', { type: 'gold' }); 1`);
  await sleep(1500);
  await run(`document.querySelector('.tp-pack').click(); 1`);
  await shot('07-pack-opening', 4200);
  await run(`document.querySelector('.tp-revealall').click(); 1`);
  await shot('07b-pack-summary', 5000);
  await run(`document.querySelector('.tp-continue').click(); 1`);
  await sleep(1200);

  // live match: kick off and let it run a while
  await run(`window.__game.go('match')`);
  await sleep(600);
  await run(`document.querySelector('#pm-kick').click(); 1`);
  await shot('08-match', 12000);
} finally {
  ws.close();
  proc.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch (e) { /* profile may still be locked */ }
}
