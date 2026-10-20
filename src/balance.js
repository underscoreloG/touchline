// Every tunable number of the game. Values come from PROMPT.md "Exact specs".
// Tune only via the sim and report old -> new. No logic in this file, just data.
// UI text never lives here: the one exception is STAT_LABELS, which points into strings.js.

import { S } from './strings.js';

export const POSITIONS = ['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST'];
export const OUTFIELD_STATS = ['pac', 'sho', 'pas', 'dri', 'def', 'phy', 'men'];
export const GK_STATS = ['div', 'han', 'kic', 'ref', 'spd', 'pos', 'men'];
export const STAT_GROUP = {
  // outfield
  pac: 'physical', phy: 'physical', sho: 'technical', pas: 'technical', dri: 'technical', def: 'technical', men: 'mental',
  // keepers
  div: 'physical', ref: 'physical', spd: 'physical', han: 'technical', kic: 'technical', pos: 'mental',
};
/** Short stat names shown on cards and panels (text lives in strings.js S.statLabels). */
export const STAT_LABELS = S.statLabels;
/** Position line used for out-of-position distance and ATT/MID/DEF line ratings. */
export const POS_LINE = { GK: 'gk', CB: 'def', FB: 'def', DM: 'mid', CM: 'mid', AM: 'mid', W: 'att', ST: 'att' };

// ---------------------------------------------------------------- Ratings
export const RARITIES = ['bronze', 'silver', 'gold', 'elite', 'icon'];
export const RARITY = {
  bronze: { min: 45, max: 64, slots: 1, starterWeight: 0.80, quickSell: 25 },
  silver: { min: 65, max: 74, slots: 2, starterWeight: 0.20, quickSell: 150 },
  gold: { min: 75, max: 84, slots: 3, starterWeight: 0, quickSell: 600 },
  elite: { min: 85, max: 91, slots: 3, starterWeight: 0, quickSell: 4000 },
  icon: { min: 88, max: 95, slots: 0, starterWeight: 0, quickSell: 0 },
};

/** Position weights for OVR. Rows sum to 1. */
export const OVR_WEIGHTS = {
  ST: { pac: .18, sho: .37, pas: .05, dri: .17, def: .00, phy: .13, men: .10 },
  W: { pac: .28, sho: .18, pas: .14, dri: .28, def: .00, phy: .04, men: .08 },
  AM: { pac: .08, sho: .18, pas: .28, dri: .26, def: .00, phy: .06, men: .14 },
  CM: { pac: .05, sho: .08, pas: .30, dri: .17, def: .13, phy: .12, men: .15 },
  DM: { pac: .05, sho: .00, pas: .20, dri: .08, def: .35, phy: .17, men: .15 },
  FB: { pac: .23, sho: .00, pas: .13, dri: .13, def: .31, phy: .10, men: .10 },
  CB: { pac: .08, sho: .00, pas: .05, dri: .00, def: .47, phy: .25, men: .15 },
};
export const GK_WEIGHTS = { div: .22, han: .18, kic: .05, ref: .22, spd: .05, pos: .18, men: .10 };

/** Generated stats follow position weights with +/- this individual variation. */
export const STAT_VARIATION = 6;
/** Out-of-position penalty on all face stats. */
export const OOP_PENALTY = { secondary: 0, sameLine: 5, adjacentLine: 12, farLine: 18, goalkeeperSwap: 40 };

// Average XI rating of AI clubs at world generation: LEAGUE_SYSTEM.strengthByLevel / spread / countryJitter (end of file).
/** Background club average XI by nation tier at generation. */
export const BACKGROUND_CLUB_STRENGTH = { 1: 76, 2: 70, 3: 62, 4: 54, 5: 45 };

// ---------------------------------------------------------------- World
export const WORLD = {
  defaultPlayers: 50000,
  // 500 playable clubs x 26 = 13,000 players sit in the pyramid, so the smallest world is 30,000.
  sizes: [30000, 50000, 100000],
  minPlayers: 30000,
  nationCount: 60,
  squadSize: 26,
  freeAgentShare: 0.04,
  homeNationShareInTopClubs: 0.65,
  countries: ['ENG', 'ESP', 'ITA', 'GER', 'FRA'],
  // Divisions, club counts, matchdays, promotion and relegation: LEAGUE_SYSTEM (end of file).
  /** Target OVR distribution (share of world population). */
  ovrShare: { elite85: 0.005, high75to84: 0.06, mid65to74: 0.24 },
  /** Target position mix for the world and regens. */
  positionMix: { GK: 0.10, CB: 0.18, FB: 0.14, DM: 0.08, CM: 0.16, AM: 0.08, W: 0.12, ST: 0.14 },
  /** Nation tier -> relative weight of how many players it produces. */
  tierWeight: { 1: 5, 2: 3, 3: 1.6, 4: 0.8, 5: 0.35 },
  /** Nation tier -> OVR shift on generated players (before club adjustment). */
  tierOvrShift: { 1: 3, 2: 1, 3: -1, 4: -4, 5: -7 },
  /** Typed array budget: bytes per player and memory target. */
  bytesPerPlayerTarget: 48,
};

export const PERFORMANCE_BUDGET_MS = {
  generation100k: 6000, developmentPass: 300, seasonRollover: 2000, backgroundMatchday: 400, databaseFilter: 100,
};

// ---------------------------------------------------------------- Development
export const PEAK_WINDOW = {
  W: [23, 28], ST: [24, 29], AM: [24, 29], FB: [24, 29], CM: [25, 30], DM: [26, 31], CB: [26, 31], GK: [27, 33],
};
export const DEV_TYPES = ['early', 'standard', 'late', 'evergreen'];
export const DEV_TYPE_SHARE = { early: 0.20, standard: 0.55, late: 0.20, evergreen: 0.05 };
export const DEV = {
  early: { windowShift: -4, startFracAt18: 0.80, declineMult: 1.3 },
  standard: { windowShift: 0, declineMult: 1 },
  late: { windowShift: 3, growthBefore22: 0.6, growthAfter22: 1.4, declineMult: 1 },
  evergreen: { peakEndShift: 3, declineMult: 0.5 },
};
/** Per stat group: [startShift, endShift] applied to the player's window. */
export const GROUP_WINDOW_SHIFT = { physical: [-2, -2], technical: [0, 0], mental: [2, 4] };
export const GROWTH = {
  rateFar: 0.30, rateTwo: 0.22, rateLast: 0.15, noise: [-1, 0, 1],
  profBase: 0.75, profDiv: 40,
  playingTime: { under5: 0.6, under15: 0.85, full: 1.0, strongRating: 1.15, strongRatingThreshold: 7.0 },
  trainingGroundPerLevel: 0.08, youthCoachUnder21: 1.1,
};
export const PEAK_CHANGE = { values: [-1, 0, 1], probs: [0.15, 0.60, 0.25] };
export const DECLINE = {
  base: { physical: 2.5, technical: 1.2, mental: 0.5 },
  perYearStep: 0.25, profBase: 1.25, profDiv: 40, fitnessCoachPhysical: 0.85,
};
export const POTENTIAL_REGEN = { mean: 68, sd: 8, cap: 96, tierShift: { 1: 3, 2: 1.5, 3: 0, 4: -2.5, 5: -5 } };
export const RETIREMENT = {
  startAge: 33, startAgeGK: 35, byYear: [0.15, 0.30, 0.45, 0.60, 0.80, 1.0], forcedAge: 40,
  freeAgentBonus: 0.20, collapseBonus: 0.25, collapseGap: 12,
  iconPeakOvr: 88, iconOneIn: 400,
};
export const REGEN = { minAge: 15, maxAge: 17, minOvr: 40, maxOvr: 58, wonderkidsPerSeason: 6 };
export const DEV_EXPECTATIONS = {
  top100AvgAge: [26, 29], wingerYoungerThanCB: [2, 3], wingerYoungerThanGK: [4, 5], worldDriftPct: 5,
};

// ---------------------------------------------------------------- Chemistry
/** Thresholds: number of starters sharing the link needed for 1 / 2 / 3 points. */
export const CHEM = {
  club: [2, 4, 7],
  nation: [2, 5, 8],
  league: [3, 5, 8],
  perPlayerMax: 3,
  teamMax: 33,
  statBonusPerPoint: 1,
  iconNationCounts: 2,
  linkGreen: 2, linkOrange: 1,
};

// ---------------------------------------------------------------- Tactics
export const FORMATION_IDS = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2', '4-1-4-1'];
export const DEFAULT_SETTINGS = { mentality: 'balanced', pressing: 'medium', width: 'balanced', passing: 'mixed', defLine: 'normal' };
export const TACTIC_OPTIONS = {
  mentality: ['defensive', 'balanced', 'attacking'],
  pressing: ['low', 'medium', 'high'],
  width: ['narrow', 'balanced', 'wide'],
  passing: ['short', 'mixed', 'direct'],
  defLine: ['deep', 'normal', 'high'],
};
/** Multipliers on line strengths and event parameters. See PROMPT.md "Tactics panel". */
export const TACTICS = {
  mentality: {
    defensive: { att: 0.94, def: 1.08 }, balanced: { att: 1, def: 1 }, attacking: { att: 1.08, def: 0.94 },
  },
  pressing: {
    low: { def: 1.03, mid: 0.96, fatigue: 0.9 },
    medium: {},
    high: { oppMid: 0.95, fatigue: 1.3, foulPts: 0.03 },
  },
  width: {
    narrow: { mid: 1.03, att: 0.97 }, balanced: {}, wide: { att: 1.03, mid: 0.97, crosses: 1.3 },
  },
  passing: {
    short: { mid: 1.04, bigToHalf: 0.03 }, mixed: {}, direct: { mid: 0.96, halfToBig: 0.03 },
  },
  defLine: {
    deep: { oppBigShare: -0.04, mid: 0.96 },
    normal: {},
    high: { oppPChance: -0.03, oppBigShareIfFaster: 0.04 },
  },
};

// ---------------------------------------------------------------- Match engine
export const ENGINE = {
  ticks: 30, minutesPerTick: 3, maxAddedTicksPerHalf: 2,
  fitnessFloor: 0.85, fitnessWeight: 0.15,
  moraleRange: [0.97, 1.03], homeFactor: 1.04,
  attackRate: 0.53, // 0.55 -> 0.53 (sim calibration)
  pChance: { base: 0.30, divisor: 170, // 100 -> 170
    min: 0.10, max: 0.60 },
  nonChance: { foul: 0.12, offside: 0.06 },
  chanceXg: { half: 0.05, decent: 0.12, big: 0.33, penalty: 0.76 },
  chanceMix: { half: 0.60, decent: 0.27, big: 0.10, penalty: 0.03 }, // was .50/.30/.17/.03
  /** Probability points moved from half to big per 10 of (ATT - oppDEF). */
  mixShiftPer10: 0.03, // 0.05 -> 0.03
  shooterPositionWeight: { ST: 40, W: 20, AM: 15, CM: 10, other: 15 },
  unassistedShare: 0.25,
  goalFormula: { shoWeight: 0.8, menWeight: 0.2, divisor: 150, min: 0.01, max: 0.95 }, // goal divisor 100 -> 150
  nonGoal: { save: 0.32, off: 0.40, blocked: 0.26, woodwork: 0.02 }, // was .55/.35/.08/.02
  cornerAfterSave: 0.20,
  corner: { xg: 0.03, setPieceCoachBonus: 0.02 },
  fitnessDrain: 0.9, highPressDrain: 1.3, fitnessCoachDrain: 0.8,
  injuryChance: 0.0004, injuryLowFitnessMult: 2, injuryLowFitnessBelow: 50, physioMult: 0.6,
  injuryProneRange: [0.6, 1.6],
  yellowOnFoul: 0.18, redOnFoul: 0.015,
  aiTrailAfter: 60, aiLeadAfter: 75, aiSubMinutes: [60, 70, 80],
  rating: { start: 6.0, goal: 1.0, assist: 0.7, cleanSheet: 0.8, save: 0.2, yellow: -0.3, red: -1.5, conceded: -0.3, win: 0.3, min: 3, max: 10 },
  consistencyOffsetDiv: 4,
  /** Calibration targets checked by tools/sim.js. */
  targets: { goalsPerMatch: [2.6, 2.8], drawPct: [22, 28], homeWinPct: [42, 48], shotsPerTeam: [11, 13], favouriteWinAt10: [60, 70] },
  subs: 5,
  // added by the engine agent (not in the original spec)
  phasesPerTick: 4, crossShare: 0.20, freeKick: { shotShare: 0.25, xg: 0.06 }, quietFoul: 0.10, cornerAfterBlocked: 0.30,
  manDownPerPlayer: 0.05, addedTime: { base: 2, perCard: 1, perInjury: 2, perSub: 0.5, per: 4 },
  injuryMatches: { weights: [30, 25, 18, 12, 9, 6], physioShorter: 1 },
  foulPosWeight: { GK: 0.2, CB: 3, FB: 3, DM: 4, CM: 2.5, AM: 1.5, W: 1.5, ST: 1.5 },
  fouledPosWeight: { GK: 0.2, CB: 0.5, FB: 1, DM: 1, CM: 1.5, AM: 2, W: 3, ST: 3 },
};

// ---------------------------------------------------------------- Economy
export const PACKS = {
  bronze: { price: 400, players: 3, others: 2, odds: { bronze: 90, silver: 10 } },
  silver: { price: 1500, players: 3, others: 2, odds: { bronze: 30, silver: 62, gold: 8 } },
  gold: { price: 5000, players: 3, others: 3, odds: { silver: 35, gold: 60, elite: 4.7, icon: 0.3 } },
  promo: { price: 12000, players: 4, others: 2, odds: { gold: 80, elite: 18, icon: 2 } },
  // Position packs: every player is in the position group (one position drawn per slot).
  gk: { price: 2200, players: 3, others: 1, filter: { pos: ['GK'] }, odds: { bronze: 20, silver: 58, gold: 20, elite: 2 } },
  def: { price: 2200, players: 3, others: 1, filter: { pos: ['CB', 'FB'] }, odds: { bronze: 20, silver: 58, gold: 20, elite: 2 } },
  mid: { price: 2200, players: 3, others: 1, filter: { pos: ['DM', 'CM', 'AM'] }, odds: { bronze: 20, silver: 58, gold: 20, elite: 2 } },
  att: { price: 2200, players: 3, others: 1, filter: { pos: ['W', 'ST'] }, odds: { bronze: 20, silver: 58, gold: 20, elite: 2 } },
  // Age packs. Young high-rated players are scarce: when a band has nobody the roll drops one rarity.
  prospect: { price: 2000, players: 3, others: 1, filter: { ageMax: 20 }, odds: { bronze: 56, silver: 38, gold: 6 } },
  veteran: { price: 3800, players: 3, others: 1, filter: { ageMin: 30 }, odds: { silver: 42, gold: 54, elite: 4 } },
  // Item packs: no players. Staff pack = staff cards (and the odd manager), Training pack = training/trait/style/tactic.
  staff: { price: 2000, players: 0, others: 3, odds: { bronze: 30, silver: 62, gold: 8 } },
  training: { price: 2500, players: 0, others: 4, odds: { common: 70, rare: 25, epic: 5 } },
  starter: { price: 0, players: 18, guaranteedGK: 2 },
};
/** Shop layout: which packs are on sale, grouped. */
export const PACK_SHOP = [
  { id: 'players', packs: ['bronze', 'silver', 'gold', 'promo'] },
  { id: 'position', packs: ['gk', 'def', 'mid', 'att'] },
  { id: 'special', packs: ['prospect', 'veteran'] },
  { id: 'items', packs: ['staff', 'training'] },
];
/** Item cards (consumables, training, traits, styles, tactics) and staff, as found in packs. */
export const ITEMS = {
  consumables: [
    { effect: 'fitness', amount: 40, weight: 4 },
    { effect: 'heal', amount: 0, weight: 2 },
    { effect: 'contract', amount: 8, weight: 3 },
    { effect: 'morale', amount: 20, weight: 3 },
  ],
  tierRarity: { common: 'bronze', rare: 'gold', epic: 'elite' },
  trainingAmount: { common: 1, rare: 2, epic: 3 },
  /** Training pack content mix (4 cards) by kind. */
  trainingPackKinds: { training: 40, trait: 25, style: 20, tactic: 15 },
  /** Tier odds of item cards found in the "other" slots of player packs. */
  otherTierOdds: { common: 80, rare: 17, epic: 3 },
  /** Staff pack: share of manager cards among the 3 cards. */
  staffManagerShare: 0.25,
};
export const PACK_PITY = { goldNoElite: 20 };
export const PACK_OTHER_SLOTS = { consumable: 0.50, training: 0.25, tacticOrStyle: 0.15, staffOrClub: 0.10 };

export const COINS = {
  matchResult: { win: 400, draw: 200, loss: 100 }, perGoal: 25, cleanSheet: 75,
  // level multiplier: LEAGUE_SYSTEM.incomeMultByLevel (replaces the old 3-division divisionMult)
  continentalMult: 2.5, gatePerStadiumTier: 50,
  leaguePrizeTitle: 3000, leaguePrizeLastFraction: 0.20,
  marketPrice: { base: 4, perOvr: 0.8, youngBonus: 1.2, youngAge: 23, oldMult: 0.6, oldAge: 31, saleTax: 0.05 },
  wage: { ovrOffset: 40, divisor: 10 }, wageBudgetShare: 0.60, contractStart: 16, seasonMatches: 26,
};

// ---------------------------------------------------------------- Form, fitness, misc
export const FORM = { maxSwing: 2 };
// Recovery between two matchdays: a flat part plus a share of the missing fitness (tired players recover more points).
// A full match drains about 29 (measured: 80+ minute players end at about 71), so a starter who plays every week settles
// around 82-85 before kick-off (flat 8 + 45% of the missing points = 29); a rested player is back to 100 in two matchdays.
export const FITNESS = { start: 100, recoverFlat: 8, recoverShare: 0.45, lowThreshold: 60 };
/** Fitness after one matchday of rest. */
export const recoverFitness = (f) => Math.min(100, Math.round(f + FITNESS.recoverFlat + FITNESS.recoverShare * (100 - f)));
export const MORALE = { start: 50, min: 0, max: 100 };

// ---------------------------------------------------------------- Cards
export const TRAIT_IDS = [
  'finisher', 'longShots', 'playmaker', 'deadBall', 'aerial', 'ballWinner', 'engine', 'paceMerchant',
  'penaltySaver', 'sweeperKeeper', 'leader', 'clutch', 'injuryResistant',
];
export const SQUAD_ROLES = ['captain', 'penalties', 'freeKicks', 'corners'];

// Card limits (the single source: cardEffects.js, game.js, matchEngine.js and choreography.js read these)
export const CARD_LIMITS = { maxTraits: 2, trainingMin: 1, trainingMax: 3, benchSize: 7, statCap: 99 };

// ---------------------------------------------------------------- Game flow constants (match aftermath, packs phase 1)
export const GAME = {
  yellowsForBan: 5, banMatches: 1, redBanMatches: 1,
  formKeep: 0.5, formRatingBase: 6.5, formRatingScale: 1.2,
  moraleWin: 6, moraleDraw: 0, moraleLoss: -6, moraleBenchIdle: -1, moraleUnused: -2,
  iconOvr: [88, 95], iconPoolSize: 12, iconStartMorale: 70, iconContract: 99,
  engineOptions: { autoSubs: true },
  // Phase 1 pack extras: no coin bundles, only a chance of a manager card in each "other" slot
  buyablePacks: ['bronze', 'silver', 'gold', 'promo', 'gk', 'def', 'mid', 'att', 'prospect', 'veteran', 'staff', 'training'],
};

// ================================================================ numbers moved out of logic/ and ui/
// Everything below used to be inline in logic modules or screens. Values are unchanged; the text that goes with
// them (names, descriptions, summaries) lives in strings.js.

// ---------------------------------------------------------------- Squad rules (structural squad numbers)
export const SQUAD_RULES = {
  benchSize: CARD_LIMITS.benchSize,
  lowFitness: FITNESS.lowThreshold,
  contractLowAt: 3, // a card with this many matches left (or fewer) shows the "contract expiring" status
  presetSlots: 3,
  tacticSlots: 3,
  defaultFormation: '4-3-3',
};

// ---------------------------------------------------------------- Tactic cards
/** Numbers of the tactic cards (PROMPT.md "Cards > Tactic cards"). */
export const TACTIC_CARD_VALUES = {
  counterAttack: { bigShift: 0.06 },
  // The extra offsides (base share x (mult - 1)) are taken from the opponent's chances, otherwise
  // doubling offsides inside the non-chance branch only relabels turnovers and the card has no upside.
  offsideTrap: { oppOffsideMult: 2, oppBigShiftIfFaster: 0.03 },
  // ATT is a mean, so adding full-backs to it at full weight would LOWER it (they are weaker attackers)
  // and the card would be pure cost. Implemented instead as ATT x (1 + attPerFB per full-back on the pitch).
  overlappingFullBacks: { attPerFB: 0.025, def: 0.96 },
  targetMan: { crosses: 1.5 },
  manMark: { starStatMalus: 6, markerDrain: 1.4 },
  setPieceRoutine: { setPieceXg: 0.03 },
  parkTheBus: { def: 1.10, att: 0.85 },
  timeWasting: { afterMinute: 75, attackMult: 0.7, yellowPts: 0.02 },
};

// ---------------------------------------------------------------- Team shape (tactics preview and 2D view)
/**
 * How the free settings move the formation anchors. defLineM and widthScale are the spec values for the 2D match
 * view ("defensive line height shifts the back four's anchors by +/- 8 m, width scales anchor y-spread by
 * 0.85 / 1.0 / 1.15"); the 2D view (VIEW below) reads the very same objects. pressBlockM, pressCompact and
 * mentalityM are used by the tactics preview (mentalityM also by the 2D view).
 */
export const SHAPE_MODS = {
  defLineM: { deep: -8, normal: 0, high: 8 },
  widthScale: { narrow: 0.85, balanced: 1, wide: 1.15 },
  pressBlockM: { low: -5, medium: 0, high: 5 },
  pressCompact: { low: 0.9, medium: 1, high: 0.88 },
  mentalityM: { defensive: -4, balanced: 0, attacking: 4 },
};
/** Metres per formation unit (depth 0-100 along the 105 m pitch, lat 0-100 across the 68 m pitch). */
export const SHAPE_SCALE = { mPerDepth: 1.05, mPerLat: 0.68 };

/** 2D match view tunables (src/logic/choreography.js). */
export const VIEW = {
  stepDt: 0.02,                 // fixed simulation step, seconds of animation time
  discR: 1.4,
  ballOffset: 0.8,
  accel: 9, sprintAccel: 13,    // m/s^2
  jog: 0.58,                    // shape movement as a share of max speed
  wanderAmp: 1.7, wanderAmpLine: 0.7,
  depthIn: 37, depthOut: 27,    // block depth in / out of possession (Layer 1 targets 35-40 / 25-30)
  shiftPoss: 0.35, shiftDef: 0.25, shiftY: 0.20, ballSideOut: 0.12,
  lineGap: 8,
  defLineShift: SHAPE_MODS.defLineM,
  widthScale: SHAPE_MODS.widthScale,
  pressers: { low: 1, medium: 1, high: 2 },
  mentalityShift: SHAPE_MODS.mentalityM,
  transition: 2,
  fade: 0.25,
  speeds: { pass: [13, 24], longBall: [20, 28], cross: [18, 24], shot: [24, 31], header: [14, 18], clear: [20, 26], goalKick: [22, 28], throwIn: [10, 14] },
  highlightsSkip: 0.3,
  tickSeconds: 3,
};

// ---------------------------------------------------------------- Match engine details
/** Trait effects in the engine. Each one is deliberately small. */
export const TRAIT_EFFECTS = {
  finisher: { goalProbMult: 1.06 },                       // open play and set-piece shots
  longShots: { halfChanceGoalMult: 1.15 },                // half chances only
  playmaker: { assistWeightMult: 1.5 },                   // more likely to be the assister
  deadBall: { setPieceXg: 0.02, penaltyGoalAdd: 0.03 },   // as corner / free-kick / penalty taker
  aerial: { headerWeightMult: 1.5 },                      // shooter weight on crosses and corners
  ballWinner: { defStatAdd: 2 },                          // +2 DEF in the DEF line only
  engine: { fatigueMult: 0.85 },
  paceMerchant: { pacAdd: 2 },
  penaltySaver: { oppPenaltyGoalMult: 0.85 },             // keeper trait
  sweeperKeeper: { oppBigShift: -0.01 },                  // keeper trait
  leader: { moraleAura: 0.005, captainMult: 2 },          // team morale factor, x2 if he is captain
  clutch: { afterMinute: 75, statAdd: 3 },                // all his stats after minute 75
  injuryResistant: { injuryMult: 0.5 },
};

/**
 * Line strengths (PROMPT.md "Match engine algorithm" step 1). Position weights per line; the DEF line also weights
 * the stats of each defender (def x1.5, phy, pac x0.5, men) over `div`. Read by matchEngine.js (live lines) and
 * cardEffects.js (squad screen header ratings), so the two always agree.
 */
export const LINE_WEIGHTS = {
  att: { ST: 1, W: 1, AM: 1, CM: 0.5 },
  mid: { AM: 1, CM: 1, DM: 1, FB: 0.5 },
  def: { CB: 1, FB: 1, DM: 1 },
  defStats: { def: 1.5, phy: 1, pac: 0.5, men: 1, div: 4 },
};

/** Further engine constants that used to be inline in matchEngine.js. */
export const ENGINE_DETAIL = {
  fallbackLine: 30,                 // line strength of a side with nobody in that line
  crossAssistMult: 3,               // W and FB are 3x as likely to assist a cross
  mixFloor: 0.02,                   // smallest share of half / big chances after the shift
  teamTalk: { shout: { notAhead: 0.02, ahead: -0.01 }, calm: { ahead: 0.01, notAhead: 0 } },
  // In-match touchline shouts (always available, with cooldowns counted in 3-minute ticks). The bonus is added to the
  // side's morale factor for `duration` ticks. Score "ahead" is read when the shout is made.
  shouts: {
    duration: { shout: 2, calm: 3, encourage: 3 },
    cooldown: { shout: 5, calm: 5, encourage: 4 },
    sharedCooldown: 2,
    amount: {
      shout: { notAhead: 0.025, ahead: -0.015 },
      calm: { ahead: 0.012, notAhead: 0.004 },
      encourage: { notAhead: 0.012, ahead: 0.008 },
    },
  },
  momentum: { keep: 0.75, signal: 0.25, possScale: 2, xgScale: 3, round: 1000 },
  foulStat: { floor: 20, fallback: 60, ref: 70 }, // fouler PHY / fouled DRI weighting
  benchFitnessDiv: 50, benchDefaultOvr: 60, // auto-sub candidate score: ovr - oop penalty + fitness / 50
  cleanSheetMinutes: 60,            // minutes a defender must play for the clean-sheet rating bonus
  motm: { rating: 100, contribution: 5, win: 2, save: 0.5, ovrDiv: 100 },
};

// ---------------------------------------------------------------- Card catalogues (numbers; texts in strings.js)
/** Trait cards: positions that may take the trait and the flat stat bonus (empty = engine-only trait). */
export const TRAIT_RULES = {
  finisher: { positions: ['ST', 'W', 'AM'], stats: { sho: 2 } },
  longShots: { positions: ['CM', 'AM', 'W', 'DM', 'ST'], stats: {} },
  playmaker: { positions: ['CM', 'AM', 'DM', 'W'], stats: { pas: 2, men: 1 } },
  deadBall: { positions: ['CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST'], stats: {} },
  aerial: { positions: ['ST', 'CB', 'DM', 'CM'], stats: { phy: 2 } },
  ballWinner: { positions: ['DM', 'CM', 'CB', 'FB'], stats: { def: 2 } },
  engine: { positions: ['CM', 'DM', 'FB', 'W', 'AM'], stats: {} },
  paceMerchant: { positions: ['W', 'ST', 'FB', 'AM'], stats: { pac: 3 } },
  penaltySaver: { positions: ['GK'], stats: {} },
  sweeperKeeper: { positions: ['GK'], stats: { spd: 3, kic: 1 } },
  leader: { positions: POSITIONS.slice(), stats: {} },
  clutch: { positions: POSITIONS.slice(), stats: {} },
  injuryResistant: { positions: POSITIONS.slice(), stats: {} },
};

/** Style cards: positions allowed and the stat package at full effect (chemistry 3); scaled by chem / 3. */
export const STYLE_RULES = {
  poacher: { positions: ['ST'], bonus: { sho: 3, pac: 2, phy: -1 } },
  targetMan: { positions: ['ST'], bonus: { phy: 3, sho: 2, pac: -2 } },
  boxToBox: { positions: ['CM', 'DM'], bonus: { phy: 2, pac: 1, def: 1, pas: 1, dri: -1 } },
  anchor: { positions: ['DM', 'CB'], bonus: { def: 3, phy: 1, men: 1, pac: -1 } },
  invertedWinger: { positions: ['W'], bonus: { sho: 2, dri: 2, pas: 1, phy: -1 } },
  ballPlayingDefender: { positions: ['CB'], bonus: { pas: 3, dri: 2, men: 1, pac: -1 } },
  playmaker: { positions: ['CM', 'AM', 'DM'], bonus: { pas: 3, men: 2, dri: 1, phy: -1 } },
  engine: { positions: ['CM', 'DM', 'FB', 'W'], bonus: { phy: 3, pac: 1, def: 1, sho: -1 } },
  attackingFullBack: { positions: ['FB'], bonus: { pac: 2, pas: 2, dri: 1, def: -2 } },
  classicWinger: { positions: ['W'], bonus: { pac: 2, pas: 2, dri: 1, sho: -1 } },
  shotStopper: { positions: ['GK'], bonus: { div: 2, ref: 2, han: 1, kic: -1 } },
  sweeperGk: { positions: ['GK'], bonus: { spd: 3, kic: 2, pos: 1, han: -1 } },
};

/** Staff card roles (match-engine staff effects are in ENGINE). Level cap for the squad's staff levels. */
export const STAFF = { roles: ['fitness', 'physio', 'scout', 'gk', 'setPiece', 'youth', 'analyst'], maxLevel: 3 };

// ---------------------------------------------------------------- Packs: rolls and starter squad
export const PACK_ROLL = {
  ovrCurve: 1.6,                // lower OVRs inside a rarity band are more common: u ^ ovrCurve
  tries: 12,                    // attempts to find a player before giving up
  spreadUntil: [4, 8],          // tries below 4: exact OVR; below 8: +/- spread[1]; later: +/- spread[2]
  spread: [0, 2, 4],
  dropRarityAtTry: 7,           // one rarity down after this many failed tries
};
/** Starter pack composition: 2 GK, 6 defenders, 6 midfielders, 4 attackers. */
export const STARTER_COMPOSITION = ['GK', 'GK', 'CB', 'CB', 'CB', 'FB', 'FB', 'FB', 'DM', 'CM', 'CM', 'CM', 'AM', 'W', 'W', 'ST', 'ST', 'ST'];
/** Hidden profile of an Icon (retired great) when it is shown as a world player. */
export const ICON_PROFILE = { devType: 'standard', peakStart: 24, peakEnd: 30, professionalism: 18, injuryProne: 5, consistency: 18 };

// ---------------------------------------------------------------- World upkeep: club refills (world.js)
export const REFILL = {
  core: { GK: 2, CB: 4, FB: 3, DM: 2, CM: 4, AM: 2, W: 3, ST: 3 }, // fixed core of a squad, also GEN.squadFixed
  academy: 0.10, academyBackground: 0.06, // share of refills that promote an academy regen instead of a free agent
  refRank: 14, refMargin: 6, defaultStrength: 55, // club level: the 15th best player, else intended strength - margin
  windows: [6, 12], needFloor: 0.05,
};

// ---------------------------------------------------------------- World generation (generator.js)
export const GEN = {
  squadFixed: REFILL.core, // + 3 extras drawn so the mix hits positionMix
  youthPerSquad: 3,
  backupPerSquad: 4,
  // role: [ovr offset vs club XI target, noise sd]
  role: { starter: [0, 2.5], rotation: [-4, 3], backup: [-7, 3.5], youth: [-2, 3], fa: [0, 6] },
  // ages: [mean, sd, min, max]; youth: [min, max]
  age: { starter: [27, 3.3, 18, 36], rotation: [25.5, 4.5, 17, 37], backup: [28, 5.5, 17, 38], youth: [16, 19],
    fa: [28.5, 5, 18, 38], faYouth: [16, 18], gkExtra: 1 },
  faYouthShare: 0.12,
  faBelowBackground: 9,
  youthDeficitPerYear: 1.7,
  youthDeficitCap: 16,
  declinePerYear: 1.0, // OVR lost per year past peakEnd (grows by 1/8 per extra year), times devType declineMult
  declineCap: 14,
  playableTierShift: 0.5, // x WORLD.tierOvrShift on the latent of playable-club players (recentred by the squad shift)
  // nation-tier weights of the foreign players of a playable club, by pyramid level (1 = top)
  foreignTierWeight: {
    1: { 1: 3, 2: 2, 3: 1, 4: 0.5, 5: 0.25 }, 2: { 1: 1.6, 2: 1.5, 3: 1, 4: 0.7, 5: 0.4 },
    3: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }, 4: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }, 5: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 },
  },
  bgBelowBottomLevel: 4, // background clubs of ENG/ESP/ITA/GER/FRA are their non-league: below pyramid level 5 (was 6 below D3)
  minBackgroundClubsPlayable: 12, // non-league pool per pyramid country, also at 30,000 players (level-5 exchange)
  bgPyramidEvery: 14, bgPyramidStep: 2, bgPyramidCap: 8,
  growthPerYear: [2.7, 0.6], // potential headroom per year before the group window: normal(mean, sd)
  wonderkidShare: 0.04, wonderkidBoost: 1.5, wonderkidPotential: 86, wonderkidMaxAge: 19,
  regenWonderkidPotential: 85,
  potentialCap: 96,
  ovrMin: 30, ovrMax: 94,
  zeroWeightStat: [0.45, 8], // stats a position does not use: T * a + b
  foot: [0.70, 0.24, 0.06], // R L B
  altPosCount: [0.45, 0.40, 0.15],
  capsPoolPerNation: 40,
  // Stars: a few starters sit well above their club's level, so the top of the world is spread over many clubs
  // instead of piling up in the strongest ones, and level 1 clubs hold a real share of the 85+.
  // d1Stars = expected stars per level 1 club at 50,000 players (scaled by sqrt(size / 50,000), max 1); d2 = level 2.
  d1Stars: 1.1, d1StarBump: [9, 2.5],
  d2Stars: 0.25, d2StarBump: [7, 2.5],
  // Background stars: the 85+ left over after the playable clubs go to individual stars (a big bump on top of the
  // club level, probability by nation tier), not to the few strongest clubs, so no background club towers over
  // Division 1. starOversupply = stars drawn per elite slot to fill; local stars in playable-country lower leagues
  // and in weak nations only reach the 60s-70s.
  bgStarBump: [15, 3.5], starOversupply: 1.25, starTierMult: { 1: 3, 2: 1.6, 3: 0.7, 4: 0.2, 5: 0.05 },
  lowerLeagueStarProb: 0.012, lowerLeagueStarBump: [10, 3],
  bgClubSpread: 2.5, // +/- spread of background club strength inside a nation (uniform)
  lowRamp: [30, 22], // histogram below 65: weight = min(ovr - 30, 22), so about 20% of the world sits under 45
  // ---- values that used to be inline in generator.js
  histRatio: { elite: 0.65, high: 0.82, mid: 0.93 }, // geometric decay inside each OVR band of the target histogram
  eliteOvr: 85,                                      // OVR from which a player counts as elite when sizing the star pool
  statOffset: { k: 14, ref: 0.17, lo: -22, hi: 14 }, // stat offset by weight: clamp(k * ln(w / ref), lo, hi)
  headroom: { base: 0.5, slope: 0.8 },               // HEAD_FACTOR = base + slope * w / maxW
  statMin: 10, statMax: 99, zeroStatMax: 80, zeroStatNoise: 1.5, fitMaxIterations: 400,
  ageCurve: 0.125,                                   // past-peak decline: y + ageCurve * y * (y - 1)
  earlyYouthDeficitMult: 0.8,                        // early developers lose less before their window
  youngAge: 21, headroomMin: 0.8, noHeadroomBump: 3, // may be a wonderkid up to youngAge; min growth per year; bump when potential <= OVR
  fitSquadIterations: 4, fitSquadTolerance: 0.05, latentJitter: 0.49,
  starProb: { div: 8, lo: 0.3, hi: 1.7, perXi: 11 }, starScaleSize: 50000,
  bgNationColourShare: 0.35, crestLumaGap: 0.25,
  managerRarityWeights: [55, 30, 12, 3], managerNationChemShare: 0.6, staffLevel: { bronze: 1, silver: 2, gold: 3 },
  hidden: { // professionalism / injury proneness / consistency: normal(mean, sd), clamped to [min, max]
    professionalism: [11, 4], injuryProne: [9, 4], consistency: { base: 7, ovrRef: 45, ovrDiv: 5, sd: 3 }, min: 1, max: 20,
  },
  caps: {
    minAge: 19, baseAge: 18, perYear: [1.5, 6], qOffset: 3, max: 180,
    goalRate: { ST: 0.38, W: 0.2, AM: 0.2, CM: 0.08, GK: 0, other: 0.04 }, goalNoise: [0.5, 1.4], goalMax: 255,
  },
  regenOvrCurve: 1.3, regenPotentialMargin: 5, regenPositionWeightBase: 10,
};

// ================================================================ League pyramid (5 levels in each of the 5 countries)
// Real-football structure, simplified to ONE national table per level (regional groups of the lower real tiers are
// collapsed into a single table). Level 1 is the top. Names are generic: "England - Division 1" (no real brand names).
// Per level: clubs = table size; promoteAuto = automatic promotion places (top n); playoff = true when the next four
// clubs (positions promoteAuto+1 .. promoteAuto+4) play a playoff whose winner is promoted too.
// Promoted from level l (l >= 2) = promoteAuto + (playoff ? 1 : 0). Relegated from level l = promoted from level l+1,
// so every level keeps its size. The bottom level exchanges `exchange` clubs with the unsimulated lower leagues
// (the background clubs of that country): its bottom clubs go out, the strongest background clubs come in.
// Matchdays = 2 * (clubs - 1) (home and away). Points: win 3, draw 1.
export const LEAGUE_SYSTEM = {
  levels: 5,
  startLevel: 5,                 // my club starts at the bottom of my country's pyramid
  pointsWin: 3, pointsDraw: 1,
  playoff: { teams: 4, semiLegs: 2, finalLegs: 1 }, // semi-finals over two legs (higher seed hosts leg 2), one-match final; a draw after 90 minutes goes to penalties
  /** Average XI rating of AI clubs at world generation per level (spread +/- 4 inside a level, +/- 1 per country). */
  strengthByLevel: { 1: 78, 2: 70, 3: 63, 4: 56, 5: 50 },
  spread: 4, countryJitter: 1,
  /** Coin multiplier by level (replaces COINS.divisionMult for the pyramid). */
  incomeMultByLevel: { 5: 1.0, 4: 1.2, 3: 1.5, 2: 1.8, 1: 2.2 },
  /** Tie-break order when points are level. 'h2h' = mini table of the tied clubs (points, goal difference, goals). */
  tiebreak: { ENG: ['gd', 'gf'], ESP: ['h2h', 'gd', 'gf'], ITA: ['h2h', 'gd', 'gf'], GER: ['gd', 'gf', 'h2h'], FRA: ['gd', 'gf'] },
  countries: {
    ENG: [
      { clubs: 20, promoteAuto: 0, playoff: false },
      { clubs: 24, promoteAuto: 2, playoff: true },
      { clubs: 24, promoteAuto: 2, playoff: true },
      { clubs: 24, promoteAuto: 3, playoff: true },
      { clubs: 24, promoteAuto: 1, playoff: true },
    ],
    ESP: [
      { clubs: 20, promoteAuto: 0, playoff: false },
      { clubs: 22, promoteAuto: 2, playoff: true },
      { clubs: 20, promoteAuto: 3, playoff: true },
      { clubs: 20, promoteAuto: 3, playoff: true },
      { clubs: 20, promoteAuto: 3, playoff: true },
    ],
    ITA: [
      { clubs: 20, promoteAuto: 0, playoff: false },
      { clubs: 20, promoteAuto: 2, playoff: true },
      { clubs: 20, promoteAuto: 3, playoff: true },
      { clubs: 20, promoteAuto: 3, playoff: true },
      { clubs: 20, promoteAuto: 3, playoff: true },
    ],
    GER: [
      { clubs: 18, promoteAuto: 0, playoff: false },
      { clubs: 18, promoteAuto: 2, playoff: true },
      { clubs: 20, promoteAuto: 2, playoff: true },
      { clubs: 20, promoteAuto: 3, playoff: true },
      { clubs: 18, promoteAuto: 2, playoff: true },
    ],
    FRA: [
      { clubs: 18, promoteAuto: 0, playoff: false },
      { clubs: 20, promoteAuto: 2, playoff: true },
      { clubs: 18, promoteAuto: 2, playoff: true },
      { clubs: 16, promoteAuto: 2, playoff: true },
      { clubs: 16, promoteAuto: 2, playoff: true },
    ],
  },
};

/**
 * Pyramid simulation details that are not part of the LEAGUE_SYSTEM contract (added by the pyramid agent).
 * penalties: shootout after a drawn deciding playoff match. Each kick scores with
 *   clamp(base + perRatingPoint * (shooting side XI rating - other side XI rating), min, max); 5 kicks each, then
 *   sudden death (maxRounds is only a safety net, never reached in practice).
 * bgExchange: the level-5 exchange with the background clubs uses as many clubs as level 5 promotes
 *   (promoteAuto + playoff winner), as the brief says. My club never drops into the background: when it finishes in
 *   the exit zone, the next club above it leaves instead.
 */
export const PYRAMID = {
  penalties: { base: 0.76, perRatingPoint: 0.004, min: 0.62, max: 0.88, kicks: 5, maxRounds: 30 },
};
