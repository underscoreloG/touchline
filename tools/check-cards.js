// Unit checks for chemistry.js and cardEffects.js. Run: node tools/check-cards.js
// Exit code 1 on any failure.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { computeChemistry, linkColour, linkGroups } from '../src/logic/chemistry.js';
import {
  oopPenalty, statsAtPosition, effectiveStats, STYLE_CARDS, STYLE_IDS, TRAIT_CATALOGUE, canApplyTrait, canApplyStyle,
  applyTrainingCard, applyTrait, applyStyle, buildMatchTeam, buildAITeam, teamRatings, predictSwap, remapStats,
} from '../src/logic/cardEffects.js';
import { computeOvr, statKeysFor, upgradeSlots } from '../src/logic/cards.js';
import { FORMATIONS } from '../src/logic/formations.js';
import { rngFrom } from '../src/logic/rng.js';
import {
  CHEM, OOP_PENALTY, RARITIES, POSITIONS, TRAIT_IDS, FORMATION_IDS, TACTIC_OPTIONS, OUTFIELD_STATS,
} from '../src/balance.js';

let passed = 0, failed = 0;
function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  ok   ${name}`); } else { failed++; console.log(`  FAIL ${name} ${extra}`); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const section = (t) => console.log(`\n${t}`);

// ------------------------------------------------------------------ helpers
const NATIONS = ['FRA', 'ENG', 'ESP', 'ITA', 'GER', 'BRA', 'ARG', 'POR', 'NED', 'BEL', 'URU'];
const LEAGUES = ['ENG', 'ESP', 'ITA', 'GER', 'FRA', 'BRA', 'ARG', 'POR', 'NED', 'BEL', 'URU'];
const SLOT_POS = FORMATIONS['4-3-3'].slots.map((s) => s.pos);

const entry = (i, over = {}) => {
  const pos = SLOT_POS[i];
  return {
    playerId: 100 + i, nation: NATIONS[i], clubId: 1000 + i, leagueId: LEAGUES[i], isIcon: false,
    pos, nativePos: pos, altPos: [], ...over,
  };
};
const allDifferent = () => SLOT_POS.map((_, i) => entry(i));
const allSame = () => SLOT_POS.map((_, i) => entry(i, { nation: 'FRA', clubId: 7, leagueId: 'FRA' }));

function stats(pos, v, over = {}) {
  const out = {};
  for (const k of statKeysFor(pos)) out[k] = v;
  return { ...out, ...over };
}
function worldPlayer(id, pos, v, over = {}) {
  return {
    id, name: `Player ${id}`, nation: NATIONS[id % NATIONS.length], age: 25, foot: 'R', clubId: id, pos, altPos: [],
    stats: stats(pos, v), potential: stats(pos, v + 5), devType: 'standard', peakStart: 25, peakEnd: 30,
    professionalism: 12, injuryProne: 10, consistency: 12, ovr: v, peakOvr: v, caps: 0, intlGoals: 0,
    season: { apps: 0, goals: 0, assists: 0, avgRating: 6 }, ...over,
  };
}
function playerCard(wp, over = {}) {
  return {
    id: `c${wp.id}`, kind: 'player', playerId: wp.id, signedFromClubId: wp.clubId, leagueId: LEAGUES[wp.id % LEAGUES.length],
    upgrades: [], traits: [], styleId: null, fitness: 100, morale: 50, form: 0, contract: 16,
    injuredFor: 0, suspendedFor: 0, yellows: 0, career: { apps: 0, goals: 0, assists: 0, cleanSheets: 0, avgRating: 0 }, ...over,
  };
}

// ------------------------------------------------------------------ MatchTeam validator
function validateMatchTeam(t) {
  const errs = [];
  const e = (m) => errs.push(m);
  const TEAM_KEYS = ['id', 'name', 'colours', 'crest', 'formation', 'xi', 'bench', 'settings', 'tacticCards', 'roles', 'staff', 'chemistry', 'isHome', 'isAI'];
  const PLAYER_KEYS = ['id', 'name', 'nation', 'number', 'pos', 'nativePos', 'altPos', 'stats', 'ovr', 'fitness', 'morale', 'form', 'traits', 'styleId', 'injuryProne', 'consistency', 'chem', 'yellows'];
  if (!eq(Object.keys(t).sort(), [...TEAM_KEYS].sort())) e(`team keys: ${Object.keys(t).join(',')}`);
  if (typeof t.id !== 'string' || typeof t.name !== 'string') e('id/name');
  if (!Array.isArray(t.colours) || t.colours.length !== 2) e('colours');
  if (typeof t.crest !== 'object' || t.crest === null) e('crest');
  if (!FORMATION_IDS.includes(t.formation)) e('formation');
  if (!Array.isArray(t.xi) || t.xi.length !== 11) e('xi length');
  if (!Array.isArray(t.bench) || t.bench.length > 7) e('bench length');
  const slots = FORMATIONS[t.formation] ? FORMATIONS[t.formation].slots : [];
  const checkPlayer = (p, where, slotPos) => {
    if (!eq(Object.keys(p).sort(), [...PLAYER_KEYS].sort())) e(`${where} keys: ${Object.keys(p).join(',')}`);
    if (!Number.isInteger(p.id)) e(`${where} id`);
    if (typeof p.name !== 'string' || typeof p.nation !== 'string') e(`${where} name/nation`);
    if (!Number.isInteger(p.number) || p.number < 1 || p.number > 99) e(`${where} number`);
    if (!POSITIONS.includes(p.pos) || !POSITIONS.includes(p.nativePos)) e(`${where} pos`);
    if (slotPos && p.pos !== slotPos) e(`${where} pos ${p.pos} != slot ${slotPos}`);
    const keys = statKeysFor(p.pos);
    if (!eq(Object.keys(p.stats).sort(), [...keys].sort())) e(`${where} stat keys`);
    for (const k of keys) if (!Number.isInteger(p.stats[k]) || p.stats[k] < 0 || p.stats[k] > 99) e(`${where} stat ${k}=${p.stats[k]}`);
    if (p.ovr !== computeOvr(p.stats, p.pos)) e(`${where} ovr mismatch`);
    if (!(p.fitness >= 0 && p.fitness <= 100)) e(`${where} fitness`);
    if (!(p.morale >= 0 && p.morale <= 100)) e(`${where} morale`);
    if (!(p.form >= -2 && p.form <= 2)) e(`${where} form`);
    if (!Array.isArray(p.traits) || p.traits.length > 2) e(`${where} traits`);
    if (p.styleId !== null && typeof p.styleId !== 'string') e(`${where} styleId`);
    if (!(p.injuryProne >= 1 && p.injuryProne <= 20)) e(`${where} injuryProne`);
    if (!(p.consistency >= 1 && p.consistency <= 20)) e(`${where} consistency`);
    if (!Number.isInteger(p.chem) || p.chem < 0 || p.chem > 3) e(`${where} chem`);
    if (p.yellows !== 0) e(`${where} yellows`);
  };
  (t.xi || []).forEach((p, i) => checkPlayer(p, `xi[${i}]`, slots[i] && slots[i].pos));
  (t.bench || []).forEach((p, i) => checkPlayer(p, `bench[${i}]`, null));
  if (t.xi && t.xi[0] && t.xi[0].pos !== 'GK') e('xi[0] not GK');
  for (const k of Object.keys(TACTIC_OPTIONS)) if (!TACTIC_OPTIONS[k].includes(t.settings && t.settings[k])) e(`settings.${k}`);
  if (!Array.isArray(t.tacticCards) || t.tacticCards.length > 3) e('tacticCards');
  const rk = ['captain', 'penalties', 'freeKicks', 'corners'];
  if (!eq(Object.keys(t.roles || {}).sort(), [...rk].sort())) e('roles keys');
  for (const k of rk) if (t.roles && t.roles[k] !== null && !Number.isInteger(t.roles[k])) e(`roles.${k}`);
  const sk = ['fitness', 'physio', 'scout', 'gk', 'setPiece', 'youth', 'analyst'];
  if (!eq(Object.keys(t.staff || {}).sort(), [...sk].sort())) e('staff keys');
  for (const k of sk) if (!(t.staff && t.staff[k] >= 0 && t.staff[k] <= 3)) e(`staff.${k}`);
  if (!Number.isInteger(t.chemistry) || t.chemistry < 0 || t.chemistry > CHEM.teamMax) e('chemistry');
  if (typeof t.isHome !== 'boolean' || typeof t.isAI !== 'boolean') e('isHome/isAI');
  return errs;
}

// ------------------------------------------------------------------ chemistry
section('Chemistry');
{
  const zero = computeChemistry(allDifferent(), null);
  check('0 chem: 11 different clubs/leagues/nations', zero.team === 0 && zero.perPlayer.every((v) => v === 0), JSON.stringify(zero.perPlayer));
  check('perPlayer has 11 entries', zero.perPlayer.length === 11);

  // partial: 4 same nation (idx 0-3, nation count 4 -> 1pt), 2 same club (idx 0-1 -> 1pt)
  const part = allDifferent();
  for (let i = 0; i < 4; i++) part[i].nation = 'FRA';
  part[0].clubId = 5; part[1].clubId = 5;
  const pc = computeChemistry(part, null);
  check('partial: expected per player [2,2,1,1,0...]', eq(pc.perPlayer, [2, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0]), JSON.stringify(pc.perPlayer));
  check('partial: team = 6', pc.team === 6);

  const full = computeChemistry(allSame(), null);
  check('33 chem: 11 same club/nation/league', full.team === 33 && full.perPlayer.every((v) => v === 3), `${full.team}`);

  // threshold tables, one link type at a time (others all different)
  const only = (field, n, value) => {
    const xi = allDifferent();
    for (let i = 0; i < n; i++) xi[i][field] = value;
    return computeChemistry(xi, null).perPlayer[0];
  };
  check('club thresholds 1/2/4/7 -> 0/1/2/3', eq([only('clubId', 1, 9), only('clubId', 2, 9), only('clubId', 4, 9), only('clubId', 7, 9)], [0, 1, 2, 3]));
  check('nation thresholds 1/2/5/8', eq([only('nation', 1, 'ZZZ'), only('nation', 2, 'ZZZ'), only('nation', 5, 'ZZZ'), only('nation', 8, 'ZZZ')], [0, 1, 2, 3]));
  check('league thresholds 2/3/5/8', eq([only('leagueId', 2, 'XXX'), only('leagueId', 3, 'XXX'), only('leagueId', 5, 'XXX'), only('leagueId', 8, 'XXX')], [0, 1, 2, 3]));

  // cap at 3 per player: 11 same nation + club + league would be 9 raw points
  check('per-player cap 3', computeChemistry(allSame(), null).perPlayer.every((v) => v <= CHEM.perPlayerMax));

  // manager
  const four = allDifferent();
  for (let i = 0; i < 4; i++) four[i].nation = 'FRA'; // count 4 -> 1pt; manager makes 5 -> 2pt
  const noMgr = computeChemistry(four, null).perPlayer[0];
  const mgrNation = computeChemistry(four, { chemBonus: { type: 'nation', value: 'FRA' } }).perPlayer[0];
  check('manager nation bonus lifts 4 -> 5 (1pt -> 2pt)', noMgr === 1 && mgrNation === 2, `${noMgr} ${mgrNation}`);
  const mgrWrong = computeChemistry(four, { chemBonus: { type: 'nation', value: 'BRA' } }).perPlayer[0];
  check('manager bonus for other nation does not help', mgrWrong === 1);
  const lg = allDifferent();
  lg[0].leagueId = 'ESP'; lg[1].leagueId = 'ESP'; // 2 in league -> 0pt, manager -> 3 -> 1pt
  const lgNo = computeChemistry(lg, null).perPlayer[0];
  const lgYes = computeChemistry(lg, { chemBonus: { type: 'league', value: 'ESP' } }).perPlayer[0];
  check('manager league bonus 2 -> 3 (0pt -> 1pt)', lgNo === 0 && lgYes === 1, `${lgNo} ${lgYes}`);
  check('manager does not add to the 11 or team cap', computeChemistry(allSame(), { chemBonus: { type: 'nation', value: 'FRA' } }).team === 33);

  // icons
  const ic = allDifferent();
  ic[0] = entry(0, { isIcon: true, nation: 'FRA', clubId: -1, leagueId: 'ICON' });
  ic[1].nation = 'FRA'; // icon (2) + 1 = 3 -> 1pt nation
  const icRes = computeChemistry(ic, null);
  check('icon counts 2 for nation (icon + 1 FRA = 3 -> 1pt)', icRes.detail[1].nation === 1 && icRes.detail[0].nation === 1, JSON.stringify(icRes.detail[0]));
  const ic2 = allDifferent();
  ic2[0] = entry(0, { isIcon: true, nation: 'FRA', clubId: -1, leagueId: 'ICON' });
  ic2[1].leagueId = 'ESP'; ic2[2].leagueId = 'ESP'; // 2 + icon wildcard = 3 -> 1pt league
  const ic2Res = computeChemistry(ic2, null);
  check('icon counts 1 in every league (2 ESP + icon = 3 -> 1pt)', ic2Res.detail[1].league === 1 && ic2Res.detail[2].league === 1);
  check('icon league chem uses best league', ic2Res.detail[0].league === 1, JSON.stringify(ic2Res.detail[0]));
  const ic3 = allDifferent();
  ic3[0] = entry(0, { isIcon: true, nation: 'FRA', clubId: -1, leagueId: 'ICON' });
  check('lone icon: leagues 1 each -> 0', computeChemistry(ic3, null).detail[5].league === 0);
  for (let i = 1; i < 6; i++) ic3[i].nation = 'FRA'; // 5 + 2 for the icon = 7 -> 2pt
  check('icon + 5 same nation = 7 -> 2pt', computeChemistry(ic3, null).detail[1].nation === 2);

  // out of position
  const oop = allSame();
  oop[3].pos = 'ST'; oop[3].nativePos = 'CB'; // CB played at ST: not native, no altPos
  const oopRes = computeChemistry(oop, null);
  check('out of position player gets 0 chem', oopRes.perPlayer[3] === 0 && oopRes.detail[3].oop);
  check('others keep full chem when a team-mate is OOP (he still counts as a member)', oopRes.perPlayer.filter((v, i) => i !== 3).every((v) => v === 3) && oopRes.team === 30);
  const alt = allSame();
  alt[3].pos = 'ST'; alt[3].nativePos = 'CB'; alt[3].altPos = ['ST'];
  check('secondary position keeps chemistry', computeChemistry(alt, null).perPlayer[3] === 3);

  // link colours
  const a = entry(0, { nation: 'FRA', clubId: 1, leagueId: 'FRA' });
  check('link green: shares 3', linkColour(a, entry(1, { nation: 'FRA', clubId: 1, leagueId: 'FRA' })) === 'green');
  check('link green: shares 2 (nation + league)', linkColour(a, entry(1, { nation: 'FRA', clubId: 2, leagueId: 'FRA' })) === 'green');
  check('link orange: shares 1 (nation)', linkColour(a, entry(1, { nation: 'FRA', clubId: 2, leagueId: 'ESP' })) === 'orange');
  check('link orange: shares 1 (club)', linkColour(a, entry(1, { nation: 'BRA', clubId: 1, leagueId: 'ESP' })) === 'orange');
  check('link red: shares 0', linkColour(a, entry(1, { nation: 'BRA', clubId: 2, leagueId: 'ESP' })) === 'red');
  check('free agents (clubId -1) never link by club', linkColour(entry(0, { clubId: -1, nation: 'FRA', leagueId: 'A' }), entry(1, { clubId: -1, nation: 'BRA', leagueId: 'B' })) === 'red');
  check('icon links by league with everyone', linkColour(entry(0, { isIcon: true, nation: 'FRA', clubId: -1, leagueId: 'ICON' }), entry(1, { nation: 'FRA', clubId: 2, leagueId: 'ESP' })) === 'green');

  const grp = allDifferent();
  grp[2].nation = grp[0].nation; grp[4].clubId = grp[0].clubId; grp[6].leagueId = grp[0].leagueId;
  check('linkGroups returns idx sharing at least one link', eq(linkGroups(grp, 0), [2, 4, 6]), JSON.stringify(linkGroups(grp, 0)));
  check('linkGroups excludes self and non-linked', !linkGroups(grp, 0).includes(0) && linkGroups(allDifferent(), 0).length === 0);
}

// ------------------------------------------------------------------ OOP penalties
section('Out-of-position penalties');
{
  const p = (n, alt, played) => oopPenalty(n, alt, played).penalty;
  check('natural position 0', p('ST', [], 'ST') === 0);
  check('secondary position 0', p('CB', ['FB'], 'FB') === OOP_PENALTY.secondary && p('CB', ['FB'], 'FB') === 0);
  check('same line: CM at DM -5', p('CM', [], 'DM') === OOP_PENALTY.sameLine);
  check('same line: CM at AM -5', p('CM', [], 'AM') === 5);
  check('same line: CB at FB -5', p('CB', [], 'FB') === 5);
  check('same line: W at ST -5', p('W', [], 'ST') === 5);
  check('adjacent: CB at DM -12', p('CB', [], 'DM') === OOP_PENALTY.adjacentLine);
  check('adjacent: FB at CM -12', p('FB', [], 'CM') === 12);
  check('adjacent: DM at W -12', p('DM', [], 'W') === 12);
  check('adjacent: CM at ST -12', p('CM', [], 'ST') === 12);
  check('adjacent: ST at AM is same line? AM is mid, ST att -> -12', p('ST', [], 'AM') === 12);
  check('outfield in goal -40', p('CB', [], 'GK') === OOP_PENALTY.goalkeeperSwap && p('ST', [], 'GK') === 40);
  check('keeper outfield -40', p('GK', [], 'CB') === 40 && p('GK', [], 'ST') === 40);
  check('uses best origin among native + alt (ST native, CM alt, at DM -> 5)', p('ST', ['CM'], 'DM') === 5);
  check('far line (CB at ST) uses farLine', p('CB', [], 'ST') === OOP_PENALTY.farLine);
  check('label for each case', oopPenalty('CM', [], 'DM').label === 'same line' && oopPenalty('CB', [], 'DM').label === 'adjacent line'
    && oopPenalty('CB', [], 'GK').label === 'keeper swap' && oopPenalty('CB', ['FB'], 'FB').label === 'secondary position' && oopPenalty('CB', [], 'CB').label === 'natural');

  const sap = statsAtPosition(stats('CM', 70), 'CM', 'DM');
  check('statsAtPosition subtracts penalty and recomputes OVR with played weights',
    sap.penalty === 5 && OUTFIELD_STATS.every((k) => sap.stats[k] === 65) && sap.ovr === computeOvr(stats('DM', 65), 'DM'));
  const toGk = statsAtPosition(stats('CB', 80), 'CB', 'GK');
  check('outfield played in goal: GK keys, -40 applied', eq(Object.keys(toGk.stats).sort(), [...statKeysFor('GK')].sort()) && Object.values(toGk.stats).every((v) => v <= 40), JSON.stringify(toGk.stats));
  const toOut = statsAtPosition(stats('GK', 80), 'GK', 'CB');
  check('keeper played outfield: outfield keys, -40 applied', eq(Object.keys(toOut.stats).sort(), [...statKeysFor('CB')].sort()) && Object.values(toOut.stats).every((v) => v <= 40), JSON.stringify(toOut.stats));
  check('remapStats maps both ways', Object.keys(remapStats(stats('ST', 60), true)).length === 7 && Object.keys(remapStats(stats('GK', 60), false)).length === 7);
}

// ------------------------------------------------------------------ training, traits, styles
section('Training, traits, styles');
{
  for (const [rarity, ovr] of [['bronze', 55], ['silver', 70], ['gold', 80], ['elite', 88]]) {
    const wp = worldPlayer(1, 'ST', ovr);
    let card = playerCard(wp);
    const slots = upgradeSlots(rarity);
    let okCount = 0, lastErr = null;
    for (let i = 0; i < 5; i++) {
      const r = applyTrainingCard(card, wp, { stat: 'sho', amount: 1 });
      if (r.ok) { okCount++; card = r.card; } else lastErr = r.error;
    }
    check(`training slots ${rarity} (${ovr}): ${slots}`, okCount === slots && lastErr === 'no_slot', `ok=${okCount} err=${lastErr}`);
  }
  {
    const wp = worldPlayer(1, 'ST', 90);
    const r = applyTrainingCard(playerCard(wp, { rarity: 'icon' }), wp, { stat: 'sho', amount: 1 });
    check('icon: 0 slots', !r.ok && r.error === 'no_slot');
  }
  {
    const wp = worldPlayer(2, 'W', 70);
    const card = playerCard(wp);
    const r = applyTrainingCard(card, wp, { stat: 'pac', amount: 3 });
    check('training returns new card and potentialDelta, input untouched',
      r.ok && r.card !== card && card.upgrades.length === 0 && r.card.upgrades.length === 1 && eq(r.potentialDelta, { stat: 'pac', amount: 3 }));
    check('amount 0 / 4 / 1.5 rejected', ['0', '4', '1.5'].every((a) => applyTrainingCard(card, wp, { stat: 'pac', amount: Number(a) }).error === 'bad_amount'));
    check('keeper stat on outfield rejected', applyTrainingCard(card, wp, { stat: 'div', amount: 1 }).error === 'bad_stat');
    const gk = worldPlayer(3, 'GK', 70);
    check('keeper stat on keeper accepted', applyTrainingCard(playerCard(gk), gk, { stat: 'div', amount: 2 }).ok);
    const capped = worldPlayer(4, 'ST', 98);
    const rc = applyTrainingCard(playerCard(capped), capped, { stat: 'sho', amount: 3 });
    check('stat cap 99: amount trimmed', rc.ok && rc.potentialDelta.amount === 1, JSON.stringify(rc));
    const maxed = worldPlayer(5, 'ST', 99);
    check('stat already 99 rejected', applyTrainingCard(playerCard(maxed), maxed, { stat: 'sho', amount: 1 }).error === 'stat_maxed');
  }
  {
    const wp = worldPlayer(6, 'ST', 80);
    let card = playerCard(wp);
    const wrongPos = worldPlayer(7, 'GK', 80);
    check('trait position restriction', !canApplyTrait(card, wp, 'penaltySaver').ok && canApplyTrait(card, wp, 'finisher').ok
      && !canApplyTrait(playerCard(wrongPos), wrongPos, 'finisher').ok && canApplyTrait(playerCard(wrongPos), wrongPos, 'penaltySaver').ok);
    card = applyTrait(card, wp, 'finisher').card;
    check('no duplicate trait', canApplyTrait(card, wp, 'finisher').error === 'duplicate_trait');
    card = applyTrait(card, wp, 'clutch').card;
    check('max 2 traits', canApplyTrait(card, wp, 'leader').error === 'trait_slots_full' && card.traits.length === 2);
    check('secondary position can satisfy restriction', canApplyTrait(playerCard(worldPlayer(8, 'CM', 70, { altPos: ['AM'] })), worldPlayer(8, 'CM', 70, { altPos: ['AM'] }), 'finisher').ok);
    check('unknown trait rejected', canApplyTrait(card, wp, 'nope').error === 'unknown_trait');
    check('style position restriction', canApplyStyle(card, wp, 'poacher').ok && !canApplyStyle(card, wp, 'anchor').ok && !canApplyStyle(card, wp, 'zzz').ok);
    const withStyle = applyStyle(card, wp, 'poacher');
    check('applyStyle sets and clears', withStyle.ok && withStyle.card.styleId === 'poacher' && applyStyle(withStyle.card, wp, null).card.styleId === null && card.styleId === null);
  }
  check('trait catalogue covers exactly TRAIT_IDS (13)', eq(Object.keys(TRAIT_CATALOGUE).sort(), [...TRAIT_IDS].sort()) && TRAIT_IDS.length === 13);
  check('every trait has name, description, positions, engineOnly consistent with stats',
    TRAIT_IDS.every((id) => { const t = TRAIT_CATALOGUE[id]; return t.name && t.description && t.positions.length && t.engineOnly === (Object.keys(t.stats).length === 0) && (!t.engineOnly || t.engineEffect); }));
  check('trait stat keys valid for their positions', TRAIT_IDS.every((id) => { const t = TRAIT_CATALOGUE[id]; return Object.keys(t.stats).every((k) => t.positions.some((p) => statKeysFor(p).includes(k))); }));
  check(`>= 8 styles incl. required ones (have ${STYLE_IDS.length})`, STYLE_IDS.length >= 8
    && ['poacher', 'targetMan', 'boxToBox', 'anchor', 'invertedWinger', 'ballPlayingDefender', 'playmaker', 'engine'].every((s) => STYLE_CARDS[s])
    && STYLE_IDS.some((s) => STYLE_CARDS[s].positions.includes('GK')));
  check('style bonuses are small integers and keys valid', STYLE_IDS.every((id) => {
    const s = STYLE_CARDS[id];
    return Object.entries(s.bonus).every(([k, v]) => Number.isInteger(v) && Math.abs(v) <= 4 && s.positions.every((p) => statKeysFor(p).includes(k)));
  }));
}

// ------------------------------------------------------------------ effective stats
section('Effective stats');
{
  const base = stats('ST', 70);
  const run = (over) => effectiveStats({ stats: base, nativePos: 'ST', playedPos: 'ST', ...over });
  const plain = run({});
  check('no cards, no chem: stats unchanged', OUTFIELD_STATS.every((k) => plain.stats[k] === 70) && plain.delta === 0);
  const chem2 = run({ chem: 2 });
  check('chem adds +1 per point to all face stats', OUTFIELD_STATS.every((k) => chem2.stats[k] === 72) && chem2.delta === 2);
  const up = run({ upgrades: [{ stat: 'sho', amount: 3 }, { stat: 'pac', amount: 2 }] });
  check('upgrades add to the stat', up.stats.sho === 73 && up.stats.pac === 72 && up.stats.pas === 70);
  const upSlots = run({ upgrades: [{ stat: 'sho', amount: 3 }, { stat: 'pac', amount: 2 }, { stat: 'dri', amount: 3 }, { stat: 'phy', amount: 3 }], rarity: 'gold' });
  check('upgrades beyond slot limit ignored (gold = 3)', upSlots.stats.sho === 73 && upSlots.stats.pac === 72 && upSlots.stats.dri === 73 && upSlots.stats.phy === 70);
  check('icon rarity ignores all upgrades', run({ upgrades: [{ stat: 'sho', amount: 3 }], rarity: 'icon' }).stats.sho === 70);

  // style scales with chem / 3
  const poach = (chem) => run({ styleId: 'poacher', chem });
  const noStyle = (chem) => run({ chem });
  check('style 0 at zero chem', eq(poach(0).stats, noStyle(0).stats));
  check('style chem 1 = bonus/3 (+1 SHO, +1 PAC (round 0.67->1), -0 PHY)', poach(1).stats.sho - noStyle(1).stats.sho === 1 && poach(1).stats.pac - noStyle(1).stats.pac === 1 && poach(1).stats.phy - noStyle(1).stats.phy === 0,
    JSON.stringify([poach(1).stats, noStyle(1).stats]));
  check('style chem 2 = 2/3', poach(2).stats.sho - noStyle(2).stats.sho === 2 && poach(2).stats.pac - noStyle(2).stats.pac === 1);
  check('style chem 3 = full (+3 SHO, +2 PAC, -1 PHY)', poach(3).stats.sho - noStyle(3).stats.sho === 3 && poach(3).stats.pac - noStyle(3).stats.pac === 2 && poach(3).stats.phy - noStyle(3).stats.phy === -1);
  check('style monotone in chem (SHO)', poach(0).stats.sho <= poach(1).stats.sho && poach(1).stats.sho <= poach(2).stats.sho && poach(2).stats.sho <= poach(3).stats.sho);
  check('style ignored at a position not in its list', eq(run({ styleId: 'anchor', chem: 3 }).stats, noStyle(3).stats));

  // trait stat effects
  check('trait stat effect (finisher +2 SHO, paceMerchant +3 PAC)', run({ traits: ['finisher', 'paceMerchant'] }).stats.sho === 72 && run({ traits: ['finisher', 'paceMerchant'] }).stats.pac === 73);
  check('engine-only trait changes nothing', eq(run({ traits: ['clutch'] }).stats, plain.stats));

  // OOP
  const oopCm = effectiveStats({ stats: stats('CM', 70), nativePos: 'CM', playedPos: 'ST', chem: 3 });
  check('OOP: penalty -12 applied and chem forced to 0', OUTFIELD_STATS.every((k) => oopCm.stats[k] === 58) && oopCm.chem === 0 && oopCm.penalty === 12);
  const secondary = effectiveStats({ stats: stats('CM', 70), nativePos: 'CM', altPos: ['AM'], playedPos: 'AM', chem: 3 });
  check('secondary position: no penalty, chem kept', secondary.penalty === 0 && secondary.stats.pac === 73);
  const gkOut = effectiveStats({ stats: stats('GK', 80), nativePos: 'GK', playedPos: 'CB', chem: 3 });
  check('keeper at CB: outfield keys, <= 40', eq(Object.keys(gkOut.stats), statKeysFor('CB')) && Object.values(gkOut.stats).every((v) => v <= 40));
  const stGk = effectiveStats({ stats: stats('ST', 80), nativePos: 'ST', playedPos: 'GK', chem: 3 });
  check('striker in goal: GK keys', eq(Object.keys(stGk.stats), statKeysFor('GK')) && stGk.ovr < 45);
  check('OVR recomputed at played position', effectiveStats({ stats: stats('CM', 70), nativePos: 'CM', playedPos: 'DM' }).ovr === computeOvr(stats('DM', 65), 'DM'));

  // consistency and fitness adj
  check('consistencyOffset magnitude subtracted (either sign)', run({ consistencyOffset: -4 }).stats.sho === 66 && run({ consistencyOffset: 4 }).stats.sho === 66);
  check('fitnessAdj flat', run({ fitnessAdj: -3 }).stats.sho === 67);

  // clamp fuzz
  const rng = rngFrom(12345);
  let bad = 0;
  for (let n = 0; n < 5000; n++) {
    const nativePos = rng.pick(POSITIONS);
    const playedPos = rng.pick(POSITIONS);
    const st = {};
    for (const k of statKeysFor(nativePos)) st[k] = rng.pick([0, 1, 5, 30, 60, 90, 97, 99, 99]);
    const upgrades = Array.from({ length: rng.int(0, 4) }, () => ({ stat: rng.pick(statKeysFor(nativePos)), amount: rng.int(1, 3) }));
    const r = effectiveStats({
      stats: st, upgrades, traits: rng.shuffle([...TRAIT_IDS]).slice(0, 2), styleId: rng.pick([null, ...STYLE_IDS]), chem: rng.int(0, 3),
      nativePos, altPos: rng.chance(0.3) ? [rng.pick(POSITIONS)] : [], playedPos, fitnessAdj: rng.int(-5, 5), consistencyOffset: -rng.float(0, 4.75),
    });
    const keys = statKeysFor(playedPos);
    if (!eq(Object.keys(r.stats), keys) || keys.some((k) => !Number.isInteger(r.stats[k]) || r.stats[k] < 0 || r.stats[k] > 99) || r.ovr < 0 || r.ovr > 99) bad++;
  }
  check('5000 random inputs: stats always integer in 0-99, right keys', bad === 0, `bad=${bad}`);
  const maxed = effectiveStats({ stats: stats('ST', 99), upgrades: [{ stat: 'sho', amount: 3 }], traits: ['finisher'], styleId: 'poacher', chem: 3, nativePos: 'ST', playedPos: 'ST', rarity: 'gold' });
  check('99 stays 99 with everything stacked', maxed.stats.sho === 99 && maxed.stats.pac === 99);
  check('0 stays 0 under penalties', effectiveStats({ stats: stats('ST', 5), nativePos: 'ST', playedPos: 'GK', consistencyOffset: -4 }).ovr === 0);
}

// ------------------------------------------------------------------ MatchTeam
section('buildMatchTeam / buildAITeam / ratings / predictSwap');
{
  const formation = '4-3-3';
  const slots = FORMATIONS[formation].slots;
  const wps = slots.map((s, i) => worldPlayer(i + 1, s.pos, 60 + i * 2, { nation: i < 6 ? 'FRA' : NATIONS[i], clubId: i < 3 ? 50 : 100 + i, consistency: 1 + (i % 20), altPos: i === 5 ? ['CM'] : [] }));
  const cards = wps.map((wp, i) => playerCard(wp, { leagueId: i < 6 ? 'FRA' : LEAGUES[i], traits: i === 9 ? ['finisher'] : [], styleId: i === 9 ? 'poacher' : null, upgrades: i === 9 ? [{ stat: 'sho', amount: 2 }] : [], fitness: 90 - i, morale: 40 + i, form: i % 3 - 1 }));
  const benchWps = [worldPlayer(50, 'GK', 55), worldPlayer(51, 'CB', 58), worldPlayer(52, 'ST', 60)];
  const benchCards = benchWps.map((wp) => playerCard(wp, { leagueId: 'ESP' }));
  const args = (rng) => ({
    id: 'me', name: 'My FC', colours: ['#ff0000', '#ffffff'], crest: { shape: 'shield' }, formation,
    xiCards: wps.map((wp, i) => ({ card: cards[i], worldPlayer: wp, number: i + 1 })),
    benchCards: benchWps.map((wp, i) => ({ card: benchCards[i], worldPlayer: wp, number: 12 + i })),
    settings: { mentality: 'attacking' }, tacticCards: ['counter', 'a', 'b', 'c'],
    roles: { captain: cards[3].id, penalties: wps[9].id, freeKicks: null, corners: undefined },
    staff: [{ role: 'physio', level: 2 }, { role: 'scout', level: 1 }],
    manager: { chemBonus: { type: 'nation', value: 'FRA' } }, isHome: true, isAI: false, seedForConsistency: rng,
  });
  const team = buildMatchTeam(args(rngFrom(77)));
  const errs = validateMatchTeam(team);
  check('buildMatchTeam output validates against MatchTeam typedef', errs.length === 0, errs.slice(0, 5).join(' | '));
  check('settings merged with defaults, tacticCards capped at 3', team.settings.mentality === 'attacking' && team.settings.pressing === 'medium' && team.tacticCards.length === 3);
  check('roles resolved from card ids to world ids', team.roles.captain === wps[3].id && team.roles.penalties === wps[9].id && team.roles.freeKicks === null && team.roles.corners === null);
  check('staff array -> levels', team.staff.physio === 2 && team.staff.scout === 1 && team.staff.fitness === 0);
  check('carries fitness/morale/form from the card', team.xi[2].fitness === 88 && team.xi[2].morale === 42 && team.xi[2].form === cards[2].form);
  check('traits and style carried', eq(team.xi[9].traits, ['finisher']) && team.xi[9].styleId === 'poacher');
  const ref = computeChemistry(wps.map((wp, i) => ({ playerId: wp.id, nation: wp.nation, clubId: wp.clubId, leagueId: cards[i].leagueId, isIcon: false, pos: slots[i].pos, nativePos: wp.pos, altPos: wp.altPos })), args().manager);
  check('team.chemistry equals computeChemistry team', team.chemistry === ref.team, `${team.chemistry} vs ${ref.team}`);
  check('player chem equals per-player chemistry', team.xi.every((p, i) => p.chem === ref.perPlayer[i]));
  check('bench has chem 0 and plays native position', team.bench.length === 3 && team.bench.every((p) => p.chem === 0 && p.pos === p.nativePos));
  check('determinism: same seed -> identical team', eq(buildMatchTeam(args(rngFrom(77))), team));
  check('different seed -> different consistency draws somewhere', !eq(buildMatchTeam(args(rngFrom(78))).xi.map((p) => p.stats), team.xi.map((p) => p.stats)));

  // consistency offset bounds: compare to a zero-offset build (rng returning 0 gives offset 0)
  const zeroRng = { float: () => 0 };
  const noOffset = buildMatchTeam(args(zeroRng));
  let within = true;
  for (let seed = 1; seed <= 200 && within; seed++) {
    const t = buildMatchTeam(args(rngFrom(seed)));
    t.xi.forEach((p, i) => {
      const maxOff = (20 - wps[i].consistency) / 4;
      for (const k of statKeysFor(p.pos)) {
        const d = noOffset.xi[i].stats[k] - p.stats[k];
        if (d < 0 || d > Math.ceil(maxOff) + 0.0001) within = false;
      }
      if (wps[i].consistency === 20 && !eq(p.stats, noOffset.xi[i].stats)) within = false;
    });
  }
  check('consistency offset within 0..(20-c)/4 for 200 seeds, none at consistency 20', within);
  const meanDrop = (() => {
    let sum = 0, n = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const t = buildMatchTeam(args(rngFrom(seed)));
      t.xi.forEach((p, i) => { sum += noOffset.xi[i].ovr - p.ovr; n++; });
    }
    return sum / n;
  })();
  check('consistency offset lowers OVR on average, never raises', meanDrop > 0, `mean drop ${meanDrop.toFixed(2)}`);

  // rejects bad input
  let threw = false;
  try { buildMatchTeam({ ...args(rngFrom(1)), xiCards: args(rngFrom(1)).xiCards.slice(0, 10) }); } catch { threw = true; }
  check('xi of 10 throws', threw);

  // AI
  const aiTeam = buildAITeam({
    id: 'ai1', name: 'AI United', colours: ['#0000ff', '#ffff00'], crest: { shape: 'round' }, formation: '4-4-2',
    xiPlayers: FORMATIONS['4-4-2'].slots.map((s, i) => ({ worldPlayer: worldPlayer(200 + i, s.pos, 62, { nation: 'ESP', clubId: 9 }), number: i + 1, leagueId: 'ESP' })),
    benchPlayers: [{ worldPlayer: worldPlayer(300, 'GK', 55, { nation: 'ESP', clubId: 9 }), number: 12 }],
    isHome: false, rng: rngFrom(5),
  });
  const aiErrs = validateMatchTeam(aiTeam);
  check('buildAITeam validates', aiErrs.length === 0, aiErrs.slice(0, 5).join(' | '));
  check('AI: fitness 100, morale 50, no upgrades/traits/style, isAI, full chemistry (same club/nation/league)',
    aiTeam.isAI && aiTeam.xi.every((p) => p.fitness === 100 && p.morale === 50 && p.form === 0 && p.traits.length === 0 && p.styleId === null) && aiTeam.chemistry === 33, `${aiTeam.chemistry}`);
  const aiLeagueFallback = buildAITeam({
    id: 'ai2', name: 'Fallback', colours: ['#000000', '#ffffff'], crest: {}, formation: '4-3-3',
    xiPlayers: slots.map((s, i) => ({ worldPlayer: worldPlayer(400 + i, s.pos, 60, { nation: 'ITA', clubId: 40 + i }), number: i + 1 })), rng: rngFrom(1),
  });
  check('AI league fallback is the nation (11 ITA on 11 clubs: nation 3 + league 3, capped 3 each -> 33)', aiLeagueFallback.chemistry === 33, `${aiLeagueFallback.chemistry}`);
  check('AI league via leagueOf callback', (() => {
    const t = buildAITeam({
      id: 'ai3', name: 'Cb', colours: ['#000000', '#ffffff'], crest: {}, formation: '4-3-3', leagueOf: () => 'ENG',
      xiPlayers: slots.map((s, i) => ({ worldPlayer: worldPlayer(500 + i, s.pos, 60, { nation: NATIONS[i], clubId: 70 + i }), number: i + 1 })), rng: rngFrom(1),
    });
    return t.chemistry === 33; // 11 different nations and clubs, but one league via leagueOf: 3 pts each
  })());

  // team ratings
  const tr = teamRatings(team);
  const manual = team.xi.reduce((a, p) => a + p.ovr, 0) / 11;
  check('teamRatings.ovr is mean of XI OVR', Math.abs(tr.ovr - manual) < 0.06, `${tr.ovr} vs ${manual}`);
  check('teamRatings gk is keeper OVR; att/mid/def sensible numbers', tr.gk === team.xi[0].ovr && [tr.att, tr.mid, tr.def].every((v) => v > 0 && v < 100));
  const flat = buildMatchTeam({
    ...args(zeroRng), manager: null,
    xiCards: slots.map((s, i) => { const wp = worldPlayer(600 + i, s.pos, 70, { consistency: 20, nation: NATIONS[i], clubId: 900 + i }); return { card: playerCard(wp, { leagueId: LEAGUES[i] }), worldPlayer: wp, number: i + 1 }; }),
    benchCards: [],
  });
  const ft = teamRatings(flat);
  check('flat 70 team: att = 70, mid = 70, def = 70, ovr = 70, gk = 70', ft.att === 70 && ft.mid === 70 && ft.def === 70 && ft.ovr === 70 && ft.gk === 70, JSON.stringify(ft));

  // predictSwap
  const mkEntry = (wp, card, pos) => ({
    playerId: wp.id, nation: wp.nation, clubId: card.signedFromClubId, leagueId: card.leagueId, isIcon: false,
    pos, nativePos: wp.pos, altPos: wp.altPos, stats: wp.stats, upgrades: card.upgrades, traits: card.traits, styleId: card.styleId,
  });
  const xiEntries = wps.map((wp, i) => mkEntry(wp, cards[i], slots[i].pos));
  const strongBench = worldPlayer(700, 'ST', 90, { nation: 'FRA', clubId: 50 });
  const strongCard = playerCard(strongBench, { leagueId: 'FRA' });
  const pred = predictSwap({ xi: xiEntries, slotIndex: 9, candidate: mkEntry(strongBench, strongCard, 'ST'), manager: null });
  check('predictSwap: better player raises OVR and returns all fields',
    pred.ovrAfter > pred.ovrBefore && ['ovrBefore', 'ovrAfter', 'chemBefore', 'chemAfter', 'effectiveOvr'].every((k) => typeof pred[k] === 'number'));
  check('predictSwap: effectiveOvr matches direct effectiveStats', pred.effectiveOvr === effectiveStats({
    stats: strongBench.stats, nativePos: 'ST', playedPos: 'ST', chem: pred.chemPlayer,
  }).ovr);
  check('predictSwap does not mutate the input XI', xiEntries[9].playerId === wps[9].id);
  const oopPred = predictSwap({ xi: xiEntries, slotIndex: 0, candidate: mkEntry(strongBench, strongCard, 'ST'), manager: null });
  check('predictSwap: striker in goal -> big OVR drop, chem 0 for him', oopPred.ovrAfter < oopPred.ovrBefore && oopPred.chemPlayer === 0 && oopPred.penalty === 40);
  const inXi = predictSwap({ xi: xiEntries, slotIndex: 1, candidate: xiEntries[4], candidateSlot: 4, manager: null });
  check('predictSwap: XI-to-XI swap exchanges the two slots', inXi.xiAfter[1].playerId === wps[4].id && inXi.xiAfter[4].playerId === wps[1].id && inXi.xiAfter[4].pos === 'FB');
  const chemUp = (() => {
    const xi = allDifferent().map((e, i) => ({ ...e, stats: stats(e.pos, 70), upgrades: [], traits: [], styleId: null }));
    const cand = { ...xi[1], playerId: 999, nation: xi[0].nation, clubId: xi[0].clubId, leagueId: xi[0].leagueId, stats: stats(xi[1].pos, 70) };
    const r = predictSwap({ xi, slotIndex: 1, candidate: cand });
    return r.chemAfter > r.chemBefore;
  })();
  check('predictSwap: team chemistry rises when the candidate links with a starter', chemUp);
}

// ------------------------------------------------------------------ hygiene
section('Source hygiene');
{
  const here = dirname(fileURLToPath(import.meta.url));
  const files = ['../src/logic/chemistry.js', '../src/logic/cardEffects.js', './check-cards.js'];
  for (const f of files) {
    const txt = readFileSync(join(here, f), 'utf8');
    check(`${f}: no em/en dashes`, !new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']').test(txt));
    if (f.startsWith('../src/logic')) check(`${f}: no Math.random / Date.now`, !/Math\.random|Date\.now/.test(txt));
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
