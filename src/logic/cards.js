// Card and player schemas (JSDoc typedefs) plus a few core pure helpers.
// FIELD NAMES ARE FROZEN. If a schema change is needed, report it to the main session.
// Effects (chemistry-adjusted stats, training, traits, styles, buildMatchTeam) live in cardEffects.js.

import { RARITY, RARITIES, OVR_WEIGHTS, GK_WEIGHTS, OUTFIELD_STATS, GK_STATS } from '../balance.js';

/**
 * Stat object. Outfield keys: pac sho pas dri def phy men. Keeper keys: div han kic ref spd pos men.
 * @typedef {Object<string, number>} Stats
 */

/**
 * World player: the object view returned by world.getPlayer(id). Stored as typed arrays, not as objects.
 * @typedef {Object} WorldPlayer
 * @property {number} id
 * @property {string} name            built from two name-pool indices
 * @property {string} nation          nation code, e.g. "FRA"
 * @property {number} age
 * @property {'L'|'R'|'B'} foot
 * @property {number} clubId          -1 = free agent
 * @property {string} pos             GK CB FB DM CM AM W ST
 * @property {string[]} altPos
 * @property {Stats} stats
 * @property {Stats} potential
 * @property {'early'|'standard'|'late'|'evergreen'} devType
 * @property {number} peakStart
 * @property {number} peakEnd
 * @property {number} professionalism  1-20
 * @property {number} injuryProne      1-20
 * @property {number} consistency      1-20
 * @property {number} ovr
 * @property {number} peakOvr
 * @property {number} caps
 * @property {number} intlGoals
 * @property {{apps:number, goals:number, assists:number, avgRating:number}} season
 */

/**
 * Player card: only for players registered with my club. Everything else is read from the world by playerId.
 * @typedef {Object} PlayerCard
 * @property {string} id
 * @property {'player'} kind
 * @property {number} playerId
 * @property {string} [rarity]          optional override, normally derived from OVR
 * @property {boolean} [isIcon]        Icon snapshot card (not in the world)
 * @property {number} signedFromClubId
 * @property {string} leagueId        country code of the league he was signed from (or his nation for background clubs)
 * @property {Array<{stat:string, amount:number}>} upgrades
 * @property {string[]} traits
 * @property {string|null} styleId
 * @property {number} fitness
 * @property {number} morale
 * @property {number} form
 * @property {number} contract
 * @property {number} injuredFor
 * @property {number} suspendedFor
 * @property {number} yellows
 * @property {{apps:number, goals:number, assists:number, cleanSheets:number, avgRating:number}} career
 */

/**
 * @typedef {Object} ManagerCard
 * @property {string} id
 * @property {'manager'} kind
 * @property {string} name
 * @property {string} nation
 * @property {string} rarity
 * @property {string} formation        preferred formation id
 * @property {string} style            tactical style label
 * @property {{type:'nation'|'league', value:string}} chemBonus
 * @property {string} perk             perk id
 */

/**
 * @typedef {Object} StaffCard
 * @property {string} id
 * @property {'staff'} kind
 * @property {'fitness'|'physio'|'scout'|'gk'|'setPiece'|'youth'|'analyst'} role
 * @property {string} name
 * @property {string} rarity
 * @property {number} level           1-3
 */

/** Match event, emitted by the engine. Players are world player ids.
 * @typedef {Object} MatchEvent
 * @property {number} minute
 * @property {'goal'|'shot'|'save'|'miss'|'blocked'|'woodwork'|'foul'|'yellow'|'red'|'injury'|'penalty'|'corner'|'freeKick'|'offside'|'turnover'|'sub'|'kickoff'|'halftime'|'fulltime'|'quiet'} type
 * @property {'home'|'away'} team
 * @property {number|null} playerId
 * @property {number|null} assistId
 * @property {number} xg
 * @property {string} text
 * @property {Array<{t:number, type:string, playerId:number|null, targetId:number|null, from:{x:number,y:number}, to:{x:number,y:number}, text:string}>} actions
 * Extra optional fields added by the engine: half, addedMin, setPiece ('corner'|'freeKick'|'penalty'), keeperId, creatorId, outId (subs),
 * secondYellow, foulerId, fouledId, matches (injury length). Extra event type: 'addedTime'.
 */

/**
 * A player as the match engine sees him. `stats` are already effective: chemistry, out-of-position penalty,
 * upgrades, style and consistency offset are applied by buildMatchTeam (cardEffects.js). The engine applies
 * fitness, morale and form on top, per tick.
 * @typedef {Object} MatchPlayer
 * @property {number} id              world player id (stable, shown in events)
 * @property {string} name
 * @property {string} nation
 * @property {number} number          shirt number 1-99
 * @property {string} pos             position PLAYED in this slot (slot pos)
 * @property {string} nativePos
 * @property {string[]} altPos         secondary positions (no out-of-position penalty there)
 * @property {Stats} stats            effective stats, keys depend on whether pos is GK
 * @property {number} ovr             effective OVR at the played position
 * @property {number} fitness         0-100
 * @property {number} morale          0-100
 * @property {number} form            -2..+2
 * @property {string[]} traits
 * @property {string|null} styleId
 * @property {number} injuryProne     1-20
 * @property {number} consistency     1-20
 * @property {number} chem            0-3
 * @property {number} yellows         cards already carried in this match (0 at kickoff)
 */

/**
 * A side for the match engine. Same shape for my team and AI teams.
 * @typedef {Object} MatchTeam
 * @property {string} id
 * @property {string} name
 * @property {string[]} colours        [primary, secondary] hex
 * @property {Object} crest            crest descriptor for the procedural crest component
 * @property {string} formation        formation id
 * @property {MatchPlayer[]} xi        11 players in slot order of the formation (index 0 = GK)
 * @property {MatchPlayer[]} bench     up to 7
 * @property {{mentality:string,pressing:string,width:string,passing:string,defLine:string}} settings
 * @property {string[]} tacticCards    up to 3 tactic card ids
 * @property {{captain:number|null,penalties:number|null,freeKicks:number|null,corners:number|null}} roles  world player ids
 * @property {{fitness:number,physio:number,scout:number,gk:number,setPiece:number,youth:number,analyst:number}} staff  levels 0-3
 * @property {number} chemistry        team chemistry 0-33
 * @property {boolean} isHome
 * @property {boolean} isAI            AI sides switch mentality and make subs on their own
 */

/** Game state. Field names frozen.
 * @typedef {Object} GameState
 * @property {number} version
 * @property {number} seed
 * @property {number} worldSize
 * @property {string} country
 * @property {string} favouriteNation
 * @property {null|object} nationalJob
 * @property {number} coins
 * @property {{name:string, colours:string[], crest:object, stadiumTier:number, facilities:{training:number, medical:number, academy:number}}} club
 * @property {Array<PlayerCard|ManagerCard|StaffCard|object>} cards
 * @property {{formation:string, xi:string[], bench:string[], tacticCards:string[],
 *   settings:{mentality:string,pressing:string,width:string,passing:string,defLine:string},
 *   roles:{captain:string|null,penalties:string|null,freeKicks:string|null,corners:string|null}}} squad
 * @property {object} season
 * @property {object[]} market
 * @property {object[]} objectives
 * @property {{gold:number}} pity
 * @property {object} settings
 */

// ------------------------------------------------------------------ core helpers

export const isGKPos = (pos) => pos === 'GK';
export const statKeysFor = (pos) => (pos === 'GK' ? GK_STATS : OUTFIELD_STATS);

/** OVR of a stats object at a position, rounded. Stats are clamped to 0-99 by the caller. */
export function computeOvr(stats, pos) {
  const w = pos === 'GK' ? GK_WEIGHTS : OVR_WEIGHTS[pos];
  let sum = 0;
  for (const k in w) sum += (stats[k] || 0) * w[k];
  return Math.round(sum);
}

/** Rarity derived from current OVR. Icons are a separate card type and are never returned here. */
export function rarityFromOvr(ovr) {
  if (ovr >= RARITY.elite.min) return 'elite';
  if (ovr >= RARITY.gold.min) return 'gold';
  if (ovr >= RARITY.silver.min) return 'silver';
  return 'bronze';
}

export const rarityIndex = (r) => RARITIES.indexOf(r);

/** Upgrade slots of a card: by rarity. */
export const upgradeSlots = (rarity) => RARITY[rarity].slots;
