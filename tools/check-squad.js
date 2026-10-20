// Unit checks for src/logic/squad.js and the formation data. Run: node tools/check-squad.js
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateWorld } from '../src/logic/generator.js';
import { openStarter, openPack } from '../src/logic/economy.js';
import { rngFrom } from '../src/logic/rng.js';
import { FORMATIONS, FORMATION_LIST, shapePreview } from '../src/logic/formations.js';
import { computeChemistry } from '../src/logic/chemistry.js';
import { FORMATION_IDS, DEFAULT_SETTINGS } from '../src/balance.js';
import * as SQ from '../src/logic/squad.js';

const DASHES = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0;
let failCount = 0;
const ok = (cond, msg) => { if (cond) pass++; else { failCount++; console.log('FAIL', msg); } };
const json = (x) => JSON.stringify(x);

const world = generateWorld(7, 30000);

function freshState(seed) {
  const state = {
    version: 1, seed, worldSize: 30000, country: 'ENG', coins: 0,
    club: { name: 'Test FC', colours: ['#c8102e', '#ffffff'], crest: null, stadiumTier: 0 },
    cards: [], squad: { formation: '4-3-3', xi: [], bench: [], tacticCards: [], settings: { ...DEFAULT_SETTINGS }, roles: { captain: null, penalties: null, freeKicks: null, corners: null }, managerId: null, presets: [null, null, null] },
    season: { level: 5 }, pity: { gold: 0 }, counters: { card: 1 },
  };
  openStarter(state, world, rngFrom(seed));
  openPack('silver', state, world, rngFrom(seed + 1000)); // a few reserves beyond the 18 starters
  openPack('bronze', state, world, rngFrom(seed + 2000));
  const mgr = state.cards.find((c) => c.kind === 'manager');
  if (mgr) state.squad.managerId = mgr.id;
  return state;
}
const byId = (state) => new Map(state.cards.map((c) => [c.id, c]));
const wpOf = (state, id) => world.getPlayer(byId(state).get(id).playerId);

// ---------------------------------------------------------------- formation data
for (const f of FORMATION_LIST) {
  ok(f.slots.length === 11, `${f.id} has 11 slots`);
  ok(f.slots[0].pos === 'GK' && f.slots.filter((s) => s.pos === 'GK').length === 1, `${f.id} slot 0 is the only GK`);
  const keys = new Set();
  let valid = true;
  for (const [a, b] of f.links) {
    if (a === b || a < 0 || b < 0 || a > 10 || b > 10) valid = false;
    const k = Math.min(a, b) + '-' + Math.max(a, b);
    if (keys.has(k)) valid = false;
    keys.add(k);
  }
  ok(valid, `${f.id} links valid and unique`);
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) { const x = stack.pop(); for (const [a, b] of f.links) { const y = a === x ? b : b === x ? a : -1; if (y >= 0 && !seen.has(y)) { seen.add(y); stack.push(y); } } }
  ok(seen.size === 11, `${f.id} link graph connected`);
  const sp = shapePreview(f.id, { defLine: 'high', width: 'wide', pressing: 'high', mentality: 'attacking' });
  const base = shapePreview(f.id, DEFAULT_SETTINGS);
  ok(sp.metrics.lineHeightM > base.metrics.lineHeightM && sp.metrics.widthM > base.metrics.widthM, `${f.id} shape preview reacts to settings`);
}
ok(FORMATION_IDS.every((id) => FORMATIONS[id]), 'every balance formation id exists');

// ---------------------------------------------------------------- auto best XI
let gkFails = 0;
let validFails = 0;
for (let seed = 1; seed <= 12; seed++) {
  const st = freshState(seed);
  for (const fid of FORMATION_IDS) {
    st.squad.formation = fid;
    const r = SQ.autoBestXI(st, world);
    if (!r.ok) { validFails++; continue; }
    const xi = st.squad.xi;
    if (xi.length !== 11 || xi.some((x) => !x) || wpOf(st, xi[0]).pos !== 'GK') gkFails++;
    if (st.squad.bench.length !== 7) validFails++;
    const v = SQ.validate(st, world);
    if (!v.ok) { validFails++; console.log(seed, fid, json(v.errors)); }
    if (new Set([...xi, ...st.squad.bench]).size !== 18) validFails++;
  }
}
ok(gkFails === 0, `autoBest always puts a GK in goal (${gkFails} failures)`);
ok(validFails === 0, `autoBest squads validate (${validFails} failures)`);

// injured first-choice keeper -> the other GK plays; both keepers injured -> still a GK
{
  const st = freshState(3);
  SQ.autoBestXI(st, world);
  const gk1 = st.squad.xi[0];
  byId(st).get(gk1).injuredFor = 2;
  SQ.autoBestXI(st, world);
  ok(st.squad.xi[0] !== gk1 && wpOf(st, st.squad.xi[0]).pos === 'GK', 'injured keeper replaced by the other keeper');
  for (const c of st.cards) if (c.kind === 'player' && world.getPlayer(c.playerId).pos === 'GK') c.injuredFor = 3;
  SQ.autoBestXI(st, world);
  ok(wpOf(st, st.squad.xi[0]).pos === 'GK', 'with every keeper injured, a keeper still starts in goal');
  const inj = st.squad.xi.filter((id) => byId(st).get(id).injuredFor > 0).length;
  ok(inj === 1, `only the forced keeper is injured in the XI (${inj})`);
}

// autoBest beats a naive XI on mean effective OVR
{
  const st = freshState(5);
  SQ.autoBestXI(st, world);
  const best = SQ.squadView(st, world).header.ovr;
  const naive = structuredClone(st);
  const players = naive.cards.filter((c) => c.kind === 'player');
  const gk = players.find((c) => world.getPlayer(c.playerId).pos === 'GK');
  const rest = players.filter((c) => c !== gk).slice(0, 10);
  naive.squad.xi = [gk.id, ...rest.map((c) => c.id)];
  naive.squad.bench = [];
  ok(best >= SQ.squadView(naive, world).header.ovr, 'autoBest XI is at least as strong as a naive XI');
}

// ---------------------------------------------------------------- chemistry matches computeChemistry
for (let seed = 20; seed < 26; seed++) {
  const st = freshState(seed);
  st.squad.formation = FORMATION_IDS[seed % 6];
  SQ.autoBestXI(st, world);
  // shake it: put a reserve in, move someone out of position
  const res = SQ.reserves(st);
  if (res.length) SQ.swap(st, { zone: 'xi', index: 5 }, { zone: 'reserve', cardId: res[0] });
  SQ.swap(st, { zone: 'xi', index: 2 }, { zone: 'xi', index: 9 });
  const view = SQ.squadView(st, world);
  const m = byId(st);
  const mgr = m.get(st.squad.managerId);
  const entries = st.squad.xi.map((id, i) => {
    const c = m.get(id); const wp = world.getPlayer(c.playerId);
    return { playerId: wp.id, nation: wp.nation, clubId: c.signedFromClubId, leagueId: c.leagueId, isIcon: false, pos: FORMATIONS[st.squad.formation].slots[i].pos, nativePos: wp.pos, altPos: wp.altPos };
  });
  const chem = computeChemistry(entries, mgr);
  ok(view.header.chemistry === chem.team, `team chemistry ${view.header.chemistry} == computeChemistry ${chem.team}`);
  ok(view.slots.every((s, i) => s.chem === chem.perPlayer[i]), 'per-slot chemistry matches computeChemistry');
  ok(view.slots.every((s) => s.oop === 0 || s.chem === 0), 'out of position players have 0 chemistry');
}

// ---------------------------------------------------------------- swap legality
{
  const st = freshState(9);
  SQ.autoBestXI(st, world);
  const before = json(st);
  const xi = st.squad.xi.slice();
  const bench = st.squad.bench.slice();
  const res = SQ.reserves(st);
  let r = SQ.swap(st, { zone: 'xi', index: 1 }, { zone: 'xi', index: 1 });
  ok(!r.ok && json(st) === before, 'same slot rejected, state untouched');
  r = SQ.swap(st, { zone: 'reserve', cardId: res[0] }, { zone: 'reserve', cardId: res[0] });
  ok(!r.ok && json(st) === before, 'reserve to reserve rejected');
  r = SQ.swap(st, { zone: 'xi', index: 11 }, { zone: 'xi', index: 1 });
  ok(!r.ok && json(st) === before, 'slot 11 rejected');
  r = SQ.swap(st, { zone: 'reserve', cardId: 'nope' }, { zone: 'xi', index: 1 });
  ok(!r.ok && json(st) === before, 'unknown card rejected');
  r = SQ.swap(st, { zone: 'reserve', cardId: xi[3] }, { zone: 'xi', index: 1 });
  ok(!r.ok && json(st) === before, 'a starter is not a reserve');
  r = SQ.swap(st, { zone: 'reserve', cardId: st.squad.managerId }, { zone: 'xi', index: 1 });
  ok(!r.ok && json(st) === before, 'manager card cannot play');
  r = SQ.swap(st, { zone: 'bench', index: 7 }, { zone: 'xi', index: 1 });
  ok(!r.ok && json(st) === before, 'bench slot 8 rejected (bench holds 7)');

  r = SQ.swap(st, { zone: 'xi', index: 2 }, { zone: 'xi', index: 3 });
  ok(r.ok && st.squad.xi[2] === xi[3] && st.squad.xi[3] === xi[2], 'xi <-> xi exchanges');
  r = SQ.swap(st, { zone: 'xi', index: 2 }, { zone: 'bench', index: 4 });
  ok(r.ok && st.squad.xi[2] === bench[4] && st.squad.bench[4] === xi[3], 'xi <-> bench exchanges');
  r = SQ.swap(st, { zone: 'reserve', cardId: res[0] }, { zone: 'xi', index: 7 });
  ok(r.ok && st.squad.xi[7] === res[0] && SQ.reserves(st).includes(xi[7]), 'reserve -> xi, starter goes to reserves');
  r = SQ.swap(st, { zone: 'bench', index: 0 }, { zone: 'reserve' });
  ok(r.ok && st.squad.bench.length === 6, 'bench card moved to the reserves area');
  r = SQ.swap(st, { zone: 'reserve', cardId: SQ.reserves(st)[0] }, { zone: 'bench', index: 6 });
  ok(r.ok && st.squad.bench.length === 7, 'reserve fills an empty bench slot');
  const all = [...st.squad.xi, ...st.squad.bench];
  ok(new Set(all).size === all.length && SQ.validate(st, world).ok, 'no duplicates after a swap sequence, squad valid');

  // roles follow the squad
  SQ.setRole(st, 'captain', st.squad.xi[4]);
  const cap = st.squad.xi[4];
  SQ.swap(st, { zone: 'xi', index: 4 }, { zone: 'reserve', cardId: SQ.reserves(st)[0] });
  ok(st.squad.roles.captain === null && SQ.reserves(st).includes(cap), 'captain cleared when he leaves the squad');
  ok(!SQ.setRole(st, 'captain', SQ.reserves(st)[0]).ok, 'a reserve cannot be captain');
  ok(!SQ.setRole(st, 'kitman', st.squad.xi[1]).ok, 'unknown role rejected');
}

// ---------------------------------------------------------------- formation remap
{
  let bad = 0;
  for (let seed = 30; seed < 34; seed++) {
    const st = freshState(seed);
    SQ.autoBestXI(st, world);
    for (const from of FORMATION_IDS) {
      for (const to of FORMATION_IDS) {
        st.squad.formation = from;
        SQ.autoBestXI(st, world);
        const set = new Set(st.squad.xi);
        const gk = st.squad.xi[0];
        const r = SQ.setFormation(st, to, world);
        if (!r.ok || st.squad.formation !== to || st.squad.xi.length !== 11 || st.squad.xi.some((x) => !x)) { bad++; continue; }
        if (new Set(st.squad.xi).size !== 11 || st.squad.xi.some((x) => !set.has(x))) bad++;
        if (st.squad.xi[0] !== gk) bad++;
        if (!SQ.validate(st, world).ok) bad++;
      }
    }
  }
  ok(bad === 0, `formation remap keeps the same 11 valid cards and the keeper in goal (${bad} failures)`);
  const st = freshState(31);
  SQ.autoBestXI(st, world);
  ok(!SQ.setFormation(st, '2-3-5', world).ok, 'unknown formation rejected');
  // 4-4-2 -> 4-3-3 -> 4-4-2 keeps out-of-position count low
  st.squad.formation = '4-4-2'; SQ.autoBestXI(st, world);
  SQ.setFormation(st, '4-3-3', world);
  const oop = SQ.squadView(st, world).slots.filter((s) => s.oop === 2).length;
  ok(oop <= 2, `remap 4-4-2 -> 4-3-3 leaves at most 2 far out of position (${oop})`);
}

// ---------------------------------------------------------------- fitness fix
{
  const st = freshState(11);
  SQ.autoBestXI(st, world);
  const m = byId(st);
  // find a starter whose position is covered naturally by a bench card
  const slots = FORMATIONS[st.squad.formation].slots;
  let target = -1;
  for (let i = 1; i < 11 && target < 0; i++) {
    const pos = slots[i].pos;
    if (st.squad.bench.some((id) => { const wp = world.getPlayer(m.get(id).playerId); return wp.pos === pos || wp.altPos.includes(pos); })) target = i;
  }
  ok(target > 0, 'test setup found a covered slot');
  const tired = st.squad.xi[target];
  m.get(tired).fitness = 40;
  const r = SQ.autoFixFitness(st, world);
  const now = m.get(st.squad.xi[target]);
  const wp = world.getPlayer(now.playerId);
  ok(r.ok && st.squad.xi[target] !== tired && now.fitness >= 60, 'tired starter swapped out');
  ok(wp.pos === slots[target].pos || wp.altPos.includes(slots[target].pos), 'replacement plays the slot naturally');
  ok(st.squad.bench.includes(tired), 'tired player went to the bench');
  ok(r.fixed.length === 1 && r.fixed[0].slot === target, 'fix reported');
  // nobody fit for goal: keeper stays and is reported
  for (const c of st.cards) if (c.kind === 'player' && world.getPlayer(c.playerId).pos === 'GK') c.fitness = 30;
  const r2 = SQ.autoFixFitness(st, world);
  ok(r2.unfixed.includes(0) && wpOf(st, st.squad.xi[0]).pos === 'GK', 'no fit keeper: slot left alone and reported');
}

// ---------------------------------------------------------------- presets
{
  const st = freshState(13);
  SQ.autoBestXI(st, world);
  const snap = json({ f: st.squad.formation, xi: st.squad.xi, b: st.squad.bench });
  ok(SQ.savePreset(st, 1).ok && st.squad.presets[1], 'preset saved');
  SQ.setFormation(st, '3-5-2', world);
  SQ.swap(st, { zone: 'xi', index: 3 }, { zone: 'bench', index: 1 });
  const r = SQ.loadPreset(st, 1, world);
  ok(r.ok && json({ f: st.squad.formation, xi: st.squad.xi, b: st.squad.bench }) === snap, 'preset round trip');
  ok(!SQ.loadPreset(st, 2, world).ok, 'empty preset rejected');
  ok(!SQ.savePreset(st, 3).ok, 'preset slot 3 rejected');
  const sold = st.squad.xi[6];
  const qs = SQ.quickSell(st, world, sold);
  ok(qs.ok && qs.coins > 0 && !st.cards.some((c) => c.id === sold) && st.squad.xi[6] === null, 'quick sell removes the card');
  ok(world.getPlayer(byId({ cards: [] }).get(sold)?.playerId ?? Number(sold.slice(1))).clubId === -1, 'quick-sold player is a free agent');
  const r2 = SQ.loadPreset(st, 1, world);
  ok(r2.ok && r2.missing.includes(sold) && st.squad.xi.every(Boolean) && SQ.validate(st, world).ok, 'preset with a sold card loads and refills the slot');
}

// ---------------------------------------------------------------- previews agree with the real swap
{
  const st = freshState(15);
  SQ.autoBestXI(st, world);
  const res = SQ.reserves(st);
  const before = SQ.squadView(st, world).header;
  const p = SQ.previewSwap(st, world, { zone: 'reserve', cardId: res[0] }, { zone: 'xi', index: 8 });
  const unchanged = json(st);
  SQ.swap(st, { zone: 'reserve', cardId: res[0] }, { zone: 'xi', index: 8 });
  const after = SQ.squadView(st, world).header;
  ok(p.ok && p.chemAfter === after.chemistry && p.chemBefore === before.chemistry, 'preview chemistry matches the real swap');
  ok(Math.abs(p.ovrAfter - after.ovr) < 0.051, `preview OVR ${p.ovrAfter} matches ${after.ovr}`);
  ok(p.landing && p.landing.slot === 8, 'preview reports the landing slot');
  const st2 = freshState(15); SQ.autoBestXI(st2, world);
  const snap2 = json(st2);
  const tg = SQ.previewTargets(st2, world, { zone: 'xi', index: 4 });
  ok(Object.keys(tg).length >= 10 + 7 && tg['res:'] && !tg['xi:4'], 'previewTargets covers pitch, bench and reserves');
  ok(json(st2) === snap2, 'previews do not mutate');
  void unchanged;
}

// ---------------------------------------------------------------- settings, tactic cards, items
{
  const st = freshState(17);
  SQ.autoBestXI(st, world);
  ok(SQ.setSetting(st, 'pressing', 'high').ok && st.squad.settings.pressing === 'high', 'setting written');
  ok(!SQ.setSetting(st, 'pressing', 'insane').ok && st.squad.settings.pressing === 'high', 'bad setting value rejected');
  ok(SQ.setSetting(st, 'formation', '5-3-2', world).ok && st.squad.formation === '5-3-2', 'formation via setSetting');
  st.cards.push({ id: 't1', kind: 'tactic', tacticId: 'counterAttack' }, { id: 't2', kind: 'tactic', tacticId: 'counterAttack' }, { id: 't3', kind: 'tactic', tacticId: 'offsideTrap' });
  ok(SQ.equipTacticCard(st, 0, 't1').ok, 'tactic card equipped');
  ok(!SQ.equipTacticCard(st, 1, 't2').ok, 'same game plan twice rejected');
  ok(SQ.equipTacticCard(st, 1, 't3').ok && SQ.equippedTacticIds(st).join() === 'counterAttack,offsideTrap', 'equippedTacticIds');
  ok(SQ.equipTacticCard(st, 2, 't1').ok && st.squad.tacticCards[0] === null, 'moving a card between slots');
  ok(!SQ.equipTacticCard(st, 0, st.squad.xi[0]).ok, 'a player card is not a tactic card');
  const pid = st.squad.xi[3];
  const pc = byId(st).get(pid);
  pc.fitness = 50;
  st.cards.push({ id: 'c1', kind: 'consumable', effect: 'fitness', amount: 30 });
  const ra = SQ.applyItemCard(st, world, { itemCardId: 'c1', playerCardId: pid });
  ok(ra.ok && pc.fitness === 80 && !st.cards.some((c) => c.id === 'c1'), 'fitness consumable applied and consumed');
  const wp = world.getPlayer(pc.playerId);
  const stat = wp.pos === 'GK' ? 'div' : 'pas';
  const pot0 = wp.potential[stat];
  st.cards.push({ id: 'tr1', kind: 'training', stat, amount: 2 });
  const rt = SQ.applyItemCard(st, world, { itemCardId: 'tr1', playerCardId: pid });
  ok(rt.ok && pc.upgrades.length === 1 && world.getPlayer(pc.playerId).potential[stat] === Math.min(99, pot0 + 2), 'training applied, potential raised');
  st.cards.push({ id: 'tr2', kind: 'training', stat, amount: 2 });
  const slotsLeft = SQ.rarityOfCard(pc, wp) === 'bronze';
  if (slotsLeft) ok(!SQ.applyItemCard(st, world, { itemCardId: 'tr2', playerCardId: pid }).ok, 'bronze card has only 1 upgrade slot');
  const v = SQ.tacticsView(st, world);
  ok(v.settings.length === 5 && v.tacticSlots.length === 3 && v.formations.length === 6, 'tacticsView shape');
  ok(v.analyst === null, 'no analyst section without an Analyst card');
  st.cards.push({ id: 's1', kind: 'staff', role: 'analyst', level: 1 });
  ok(SQ.tacticsView(st, world).analyst && SQ.tacticsView(st, world).analyst.enabled, 'analyst section with an Analyst card');
  const clubId = world.clubsOf('ENG', 5)[0].id;
  const rep = SQ.opponentReport(world, clubId);
  ok(rep && ['att', 'mid', 'def'].includes(rep.weakestLine) && rep.formation, 'opponent report');
}

// ---------------------------------------------------------------- wages
{
  const st = freshState(19);
  SQ.autoBestXI(st, world);
  const w = SQ.wageSummary(st, world, { avgMatchIncome: 1000 });
  ok(w.budget === 600, 'wage budget = 60% of average match income');
  ok(w.total > 0 && SQ.squadView(st, world).header.wages === w.total, 'header wages');
}

// ---------------------------------------------------------------- source rules
for (const f of ['src/logic/squad.js', 'src/logic/formations.js']) {
  const src = readFileSync(resolve(ROOT, f), 'utf8');
  ok(!/Math\.random|Date\.now/.test(src), `${f}: no Math.random / Date.now`);
}
for (const f of ['src/logic/squad.js', 'src/logic/formations.js', 'src/ui/squad.js', 'src/ui/tactics.js', 'src/ui/components/squadPitch.js', 'src/styles/squad.css', 'tools/demos/squad/demo.js', 'tools/check-squad.js']) {
  let src = '';
  try { src = readFileSync(resolve(ROOT, f), 'utf8'); } catch (e) { continue; }
  ok(!DASHES.test(src), `${f}: no em or en dashes`);
}

console.log(`check-squad: ${pass} passed, ${failCount} failed`);
process.exit(failCount ? 1 : 0);
