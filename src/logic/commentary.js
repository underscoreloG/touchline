// Commentary: one-line text for match events and short labels for action steps.
// Pure module. Variation comes from the rng passed in ctx (the engine passes its cosmetic stream,
// so commentary never changes a match result). No real player or club names.

import { S, fmt } from '../strings.js';

/**
 * Templates per event type live in strings.js (S.commentary). Placeholders:
 * {p} player, {a} assister, {k} opposing keeper, {t} team, {o} opponent team, {s} score line, {m} added minutes,
 * {out} player going off (subs).
 */
const T = S.commentary;

/**
 * One-line commentary for an engine event.
 * @param {import('./cards.js').MatchEvent} event
 * @param {Object} ctx
 * @param {{pick:Function}} ctx.rng            seeded rng (cosmetic stream)
 * @param {(id:number|null)=>string} ctx.nameOf
 * @param {(side:'home'|'away')=>string} ctx.teamName
 * @param {{home:number,away:number}} [ctx.score]
 * @param {number|null} [ctx.keeperId]         opposing keeper for shot events
 * @param {number|null} [ctx.outId]            player going off for subs
 * @param {boolean} [ctx.secondYellow]
 * @param {number} [ctx.addedMinutes]
 * @returns {string}
 */
export function commentaryFor(event, ctx) {
  let key = event.type;
  if (key === 'goal' && event.assistId != null) key = 'goalAssisted';
  if (key === 'red' && ctx.secondYellow) key = 'secondYellow';
  const list = T[key] || T.quiet;
  const opp = event.team === 'home' ? 'away' : 'home';
  const sc = ctx.score ? `${ctx.teamName('home')} ${ctx.score.home}-${ctx.score.away} ${ctx.teamName('away')}` : '';
  const v = {
    p: ctx.nameOf(event.playerId),
    a: event.assistId != null ? ctx.nameOf(event.assistId) : '',
    k: ctx.keeperId != null ? ctx.nameOf(ctx.keeperId) : S.commentaryWords.theKeeper,
    t: ctx.teamName(event.team),
    o: ctx.teamName(opp),
    s: sc,
    m: ctx.addedMinutes ?? '',
    out: ctx.outId != null ? ctx.nameOf(ctx.outId) : '',
  };
  return fmt(ctx.rng.pick(list), v);
}

/** Short deterministic label for an action step (no rng, keeps the cosmetic stream light). Templates: S.actionLine. */
export function actionLine(type, a, b) {
  const t = S.actionLine[type];
  if (t === undefined) return a || '';
  // a template is either one string or [with target, without target]
  const tpl = Array.isArray(t) ? (b ? t[0] : t[1]) : t;
  return fmt(tpl, { a: a ?? '', b: b ?? '' });
}

export const COMMENTARY_TYPES = Object.keys(T);
