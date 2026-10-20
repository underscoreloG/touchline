# Build prompt: football card-manager game (working title "Touchline")

Paste everything below the line into a fresh session.

---

## Role and goal

Build a single-player browser game that sits between Football Manager and FIFA Ultimate Team: I open card packs, build a squad from the cards, and take it through seasons and cups against AI clubs. It must be far simpler than Football Manager (no spreadsheets, no 40 attributes), and it must look and feel premium: the pack opening and the card art are the hook.

Work in phases (see "Phases"). Stop at the end of each phase, show me real proof it runs (screenshots + sim stats), and wait for my verdict before the next phase.

## Hard constraints

- Offline, no backend, no accounts, no real money, no ads. All currency is earned in-game.
- Real countries, fictional everything else: real nations, flags and national teams, but generated player names, clubs, crests and sponsors. No real player, club, league-brand or competition names (call leagues "France - Division 1", never "Ligue 1"; "World Cup" is fine, "FIFA" is not), no lookalike "Lionel Messy" jokes, no real kits or logos. A generated club name must never equal a real club's name.
- Deliverable: one standalone `dist/index.html` produced by a small `build.js` from `src/` (ES modules, CSS, data). Libraries are vendored and inlined, no CDN at runtime.
- Desktop first (1280px+), playable down to 390px wide. Mouse and touch.
- Save in IndexedDB (the world is too big for `localStorage`): typed-array world as binary blobs, the rest as JSON, versioned schema with migration, autosave after every match, plus export/import of the whole save as one downloadable file. Only settings go in `localStorage`.
- All randomness goes through one seeded PRNG (mulberry32 or similar) so matches and packs are reproducible in tests.
- Never use em dashes or en dashes in any text or code comment. Plain hyphen only.
- UI language: English, all strings in one `strings.js` table so a French version is a later swap.

## Tech stack

- DOM + CSS for all screens (this is a UI game, not a canvas game). No framework, no Phaser.
- GSAP for timelines: pack shake, rip, card flips, walkout, screen transitions, number tick-ups.
- CSS holographic foil on rare cards: pointer-tracked tilt via CSS variables, layered gradients, blend modes (the technique popularised by the "Pokemon Cards CSS" project). Cheap cards stay flat.
- canvas-confetti (or a tiny custom particle canvas) only for elite pulls and trophies.
- Audio: small WebAudio synth for clicks, whooshes, crowd swell, goal horn. No audio files required. Mute toggle.
- Player portraits: procedurally generated SVG avatars (skin, hair, beard, kit colour) from the player seed. Club crests: procedural SVG (shape + 2 colours + emblem).
- Match pitch: top-down 2D view on a Canvas 2D element with 22 numbered discs and a ball, in the style of Football Manager Mobile's 2D match view (see "2D top-down match view"). Choreographed from engine events, no physics engine.

If you think another library earns its place, propose it with the reason before adding it.

## Core loop

Play match -> earn coins + objectives progress -> open packs / buy on market -> improve squad and upgrade cards -> next match. One match must take 60-120 seconds at normal speed, with an instant-result option. A full season should fit in one evening.

## The world

One persistent football world, generated from the save seed, that lives and ages whether I look at it or not.

### Size and structure

- `WORLD_PLAYERS` = 50,000 by default, selectable at new game (20,000 / 50,000 / 100,000). Everything must work at 100,000.
- About 60 real nations, each with a strength tier 1-5 that sets how many players it produces and how good they are. Include at least the 5 home nations below, plus the usual football nations of every continent.
- 5 playable championships, in 5 real countries: England, Spain, Italy, Germany, France. Each has 3 divisions of 14 clubs (26 matchdays), a national cup, promotion and relegation (top 2 up, bottom 2 down). That is 210 clubs with 26 players each. At new game I pick my country and start in its Division 3.
- Rest of the world: every other player belongs to a "background club" in his own nation (about 26 players per club, as many clubs as needed to hold the population) or is a free agent (about 4%). Background clubs never play simulated matches; their players get synthetic season stats and develop normally. They exist to feed packs, the market, scouting and national teams.
- Clubs in the 5 countries are about 65% home-nation players, the rest foreign.
- World OVR distribution at generation and in steady state: about 0.5% at 85+, 6% at 75-84, 24% at 65-74, the rest below. Tier-1 nations and Division 1 clubs hold most of the top.

### Players are unique

- Every player exists exactly once. A player card in my club is that player's registration with me, not a copy. There are no duplicate player cards (other card types can be duplicated).
- Packs "sign" players from free agents, the youth intake and background clubs, never from clubs in the 5 playable countries. Those can only be bought on the transfer market, where AI clubs list players.
- When a player leaves an AI or background club (pack, transfer, retirement), the club's squad is topped up from free agents or a regen so every club always has 26.
- A card's rarity is derived from the player's current OVR, so a card can be promoted (Bronze to Silver, with a short upgrade animation) or demoted as he develops and ages.
- Icons are the exception: a snapshot of a retired great at his peak, stored as a special card outside the world, never ageing, not eligible for national teams.
- Player database screen (search and scout): filter the whole world by nation, age, position, OVR range, club, free agent; sortable, virtualised list so 100,000 rows stay smooth. Potential and development type show as a vague range unless I own a Scout staff card.

### Careers: growth, peak, decline, retirement, regens

Every player ages one year at each season end. Stats rise toward a personal ceiling, hold during a personal peak window, then fall, at different speeds for different kinds of stats. Exact formulas are in "Exact specs > Player development". Requirements:

- Not everyone peaks at the same age. Some are stars at 18-25 and fade early, some are ordinary until 25 and excellent until 32. Position matters (pace-dependent wingers and strikers peak and fade earlier, centre-backs and keepers later), and so does the individual (development type, professionalism).
- Physical stats rise early and fall first; technical stats hold longer; mental quality keeps improving into the 30s. So a 33-year-old playmaker can still be excellent while a 33-year-old winger usually is not.
- What a position needs decides how ageing hits it: losing pace ruins a winger's OVR, barely touches a centre-back's.
- Playing time, training facilities and staff speed up growth for my own players; rotting on the bench slows it.
- Retirement: from age 33 (keepers 35), probability rising each year, forced at 40, earlier for free agents and for players whose OVR has collapsed.
- Regens: the world population is constant. Each retired player is replaced at season end by a new 15-17 year old of the same nation, with a fresh name, random position (rebalanced toward the world's target position mix), random potential, attached to the retiring player's club academy or to free agents. A handful per season are announced in the news feed as "wonderkids".
- AI clubs manage themselves at season end: release the worst and oldest, promote academy regens, and buy upward (better players drift toward richer divisions) with a simple rule-based transfer pass.

### National teams

- Every nation has a national team picked automatically from all its eligible players in the world: best 23 by effective OVR with a sensible position mix (3 GK, 8 DEF, 8 MID, 4 ATT), re-picked before each international window. Kits in the nation's colours, procedural crest, real flag.
- Calendar: 3 international windows per season (after matchdays 7 and 16, and after the season) with friendlies and qualifiers; a 32-team World Cup after every 4th season; continental championships (Europe 16 teams, others quick-simulated) after every 4th season, offset by 2.
- Effect on my club: called-up players get caps and international goals on their card, a morale boost, come back with -15 fitness and a small injury risk; a tournament winner gets a permanent badge and a value bump.
- I can watch any international match in the 2D view, and the hub shows results, squads, rankings and a world ranking table.
- Managing a national team (phase 4): at new game I pick a favourite nation. Once my club reaches Division 1, or wins a cup, I am offered that nation's job. As national manager there are no cards and no coins: I select 23 from every eligible player in the world, set tactics on the same squad and tactics screens, and play the windows and tournaments. I keep my club at the same time.

## Cards

Rarities: Bronze, Silver, Gold, Elite, Icon (retired fictional legends). Rarity sets the rating range and the visual treatment.

Card types:

1. **Player**: position (GK, CB, FB, DM, CM, AM, W, ST) with 0-2 secondary positions, overall rating, 7 stats (the six classic face stats PAC, SHO, PAS, DRI, DEF, PHY plus MEN for mental; keepers get their own set), age, nationality, club, league, preferred foot, 0-2 traits, fitness, morale, contract matches left, caps. Hidden values, partly revealed by a Scout: potential per stat, development type and peak window, professionalism, injury proneness, consistency.
2. **Manager**: preferred formation, tactical style, a chemistry bonus for one nation or league, one perk (e.g. "+ youth growth", "better late-game subs").
3. **Staff** (one slot each): Fitness coach (less fatigue), Physio (fewer and shorter injuries), Scout (better pack odds for one position or region, reveals potential), GK coach, Set-piece coach, Youth coach, Analyst (shows opponent weaknesses before a match).
4. **Training cards** (permanent, capped): +1 to +3 on one face stat, limited upgrade slots per player by rarity. The bonus is added on top of natural development and raises that stat's potential by the same amount; it still erodes with age like the rest of the stat.
5. **Trait cards** (permanent, max 2 traits per player, position-restricted): realistic ones only, e.g. Finisher, Long shots, Playmaker, Dead-ball specialist, Aerial threat, Ball winner, Engine, Pace merchant, Penalty saver, Sweeper keeper, Leader (morale aura), Clutch (late-game bonus), Injury resistant.
6. **Style cards** (swappable, one per player): role-shaped stat packages like Poacher, Target man, Box-to-box, Anchor, Inverted winger, Ball-playing defender. Bigger effect at high chemistry.
7. **Position retrain card**: adds a secondary position after N matches.
8. **Consumables**: fitness recovery, injury healing, contract extension, morale boost (team talk).
9. **Tactic cards** (equip up to 3 per match, on top of the free tactic settings in "Squad and tactics screen"): special game plans that do not duplicate the settings. Counter-attack (big-chance share +6 points while defending deep or leading), Offside trap (opponent offside chance x2, but +3 points of big chances conceded if their ST PAC beats my CB PAC), Overlapping full-backs (FB count at full weight in ATT, DEF x0.96), Target man (shooter weight uses PHY for ST, crosses +50%), Man-mark their star (their best attacker's stats -6, my marker's fitness drain x1.4), Set-piece routine (corner and free-kick xG +0.03), Park the bus (DEF x1.10, ATT x0.85, only usable when leading), Time wasting (ticks after minute 75 have 30% fewer attacks for both sides, yellow chance +2 points). Every card has an upside and a cost.
10. **Club cards**: stadium tiers (gate income, home advantage), kit, crest, facilities (training ground, medical centre, academy).

## Squad and tactics screen

Reference: the classic FIFA Ultimate Team squad screen (FIFA 15 era). A pitch drawn in perspective under stadium floodlights, the 11 cards standing on their positions, coloured link lines between neighbouring positions, a position label next to each slot, and a horizontal strip of bench and reserve cards along the bottom. Reproduce the layout, with our own card design and procedural avatars instead of photos.

### Pitch and cards

- Pitch: CSS 3D perspective (rotateX about 35 degrees) with markings, dark stands and floodlight glow behind. Cards stay upright (counter-rotated) so they read flat. Own goal at the bottom, attack at the top.
- Mini card on the pitch shows: OVR, position played, avatar, nation flag, club crest, equipped style label under the card, and small status icons (fitness bar, injury, suspension, contract low, out-of-position warning, chemistry 0-3 pips).
- Slot label (GK, CB, FB, ...) sits next to each slot and turns amber or red when the card is out of position.
- Link lines between adjacent slots of the formation (each formation defines its neighbour pairs): green if the two players share 2 or more of club / league / nation, orange for 1, red for 0. The lines are a visual guide only; chemistry points are still computed with the count-based table in "Chemistry". Hovering a card highlights the players that share a link with it.
- Header: formation name, team OVR, ATT / MID / DEF line ratings, team chemistry out of 33, total wages vs budget. All update live.
- Bottom strip: 7 bench cards then reserves, horizontally scrollable, with filters (position, rarity) and sort (OVR, fitness).
- Interactions: drag a card onto another to swap (pitch, bench, reserves), tap a card then tap a target as the touch alternative, long-press or right-click for a detail panel (full stats, traits, upgrades, apply a training / trait / style / consumable card, sell). While dragging, valid slots glow and each shows the predicted OVR and chemistry delta.
- Buttons: Auto best XI, Auto fix fitness (swap out players under 60 fitness), Save / load squad presets (3 slots).

### Tactics panel (tab next to the squad, also reachable during a match)

Free settings, always available, each with exactly these engine effects:

| Setting | Options (default in bold) | Effect |
|---|---|---|
| Formation | 4-4-2, **4-3-3**, 4-2-3-1, 3-5-2, 5-3-2, 4-1-4-1 | Sets slots, neighbour pairs and choreography anchors |
| Mentality | Defensive / **Balanced** / Attacking | ATT x0.94 and DEF x1.08 / none / ATT x1.08 and DEF x0.94 |
| Pressing | Low / **Medium** / High | Low: DEF x1.03, MID x0.96, fatigue x0.9. High: opponent MID x0.95, fatigue x1.3, foul chance +3 points |
| Width | Narrow / **Balanced** / Wide | Narrow: MID x1.03, ATT x0.97. Wide: ATT x1.03, MID x0.97, crosses +30% |
| Passing | Short / **Mixed** / Direct | Short: MID x1.04, 3 points of chance mix move from big to half. Direct: MID x0.96, 3 points move from half to big |
| Defensive line | Deep / **Normal** / High | Deep: opponent big-chance share -4 points, MID x0.96. High: opponent pChance -0.03, but opponent big-chance share +4 points when their fastest attacker's PAC beats my slowest CB's PAC |

Also on the panel: 3 tactic card slots, and role pickers for captain (Leader trait doubles the morale effect), penalty taker, free-kick taker, corner taker (engine uses these players for those events).

The panel shows a small top-down pitch preview where the team shape reacts to the settings (line height, width, compactness), and a plain-language summary of the trade-offs ("High press: you win the ball more, your players tire 30% faster"). With an Analyst staff card, it also shows the next opponent's formation, style and weakest line.

The 2D match view must reflect these settings: defensive line height shifts the back four's anchors by +/- 8 m, width scales anchor y-spread by 0.85 / 1.0 / 1.15, pressing increases how many defenders close down the carrier (1 / 1 / 2).

AI clubs use the same settings, picked from their generated identity.

### Squad rules

- Formations as listed above. Drag and drop cards onto the pitch, 11 + 7 bench + reserves.
- Chemistry, simplified from modern Ultimate Team: each player gets 0-3 chemistry points from shared club, league and nationality counts across the starting XI (no adjacency needed), plus manager bonus. Out of position = 0 chemistry and a rating penalty scaled by how far the position is. Low chemistry never gives negative stats; chemistry only adds.
- Show the effective rating and stat deltas live while dragging so decisions are readable.
- Auto-build button (best XI) for people who want to skip.

## Match engine

Event-based, not a physics sim. Requirements:

- Derive team attack, midfield and defence strength per zone from the 11 effective player stats, formation, tactic cards, chemistry, fitness, morale, home advantage.
- Midfield strength drives possession and number of attacks; each attack resolves through a short chain (build-up -> chance creation -> shot -> keeper) using the stats of the specific players involved, so individual cards visibly matter and scorers/assisters make sense.
- Each chance carries an xG value; goals are sampled from it. Calibrate so averages land near real football: about 2.6-2.8 goals per match, roughly 25% draws, home win rate around 45%, favourites lose often enough that upsets feel real. Prove this with a headless 10,000-match sim and print the numbers.
- Game state matters: a trailing AI pushes forward, a leading one drops off; fatigue grows through the match and with pressing; red cards and injuries change strengths immediately.
- Events: goals, assists, shots, saves, woodwork, fouls, yellow/red cards, injuries, penalties, corners and free kicks (set-piece coach and Dead-ball trait matter), offside, added time.
- Presentation: the 2D top-down match view described below, with a one-line commentary bar, score bug, momentum bar, live stats (possession, shots, xG), player ratings out of 10 at full time, man of the match.
- My decisions during a match: 5 subs, change mentality (defensive / balanced / attacking), swap a tactic card at half time, and 2-3 "key moment" prompts per match (e.g. who takes the penalty, shout at the team or stay calm at half time). Speeds x1 / x2 / x4 / instant.

## 2D top-down match view

Reference: the Football Manager Mobile 2D match screen. Whole pitch seen from above, every player a coloured disc with a shirt number, a small ball, the ball carrier's name next to their disc, a one-line commentary bar under the pitch describing the current action ("Bitsamou drives forward with the ball"). Reproduce the idea and layout, not the assets: own colours, own fonts, own stadium surround.

Principle: the match engine stays the single source of truth. The view is a choreographed replay of engine events. Rendering never changes a result, and the instant-result path never touches the view.

### Layout

- Top bar: match clock with a row of period dots, home crest + name, two score boxes, away name + crest, Pause button. Home half of the bar in home colour, away half in away colour.
- Under it: a thin possession/momentum bar split in the two team colours, with small markers for goals and cards on a timeline.
- Centre: the pitch, landscape, mown stripes, full markings (boxes, six-yard boxes, centre circle, penalty arcs, corner arcs, goals), a simple stand/advertising-board surround, vignette.
- Bottom: commentary bar tinted in the colour of the team in possession, then a control row: Opponent, Tactics, speed (x1 / x2 / x4), highlights mode, settings.

### Rendering

- Canvas 2D, devicePixelRatio aware, logical pitch coordinates 105 x 68 (metres), one `toScreen(x, y)` helper. Home attacks left to right in the first half, sides swap at half time.
- Discs: radius about 1.4 m, team colour fill, contrasting ring and shirt number. Keepers in a distinct colour. Referee as a black disc and two assistants on the touchlines as small green discs. Soft drop shadow under each disc.
- Ball: small white disc with an orange accent and a shadow; for long balls, crosses and shots, scale the ball up to 1.6x mid-flight and offset the shadow to fake height.
- Overlays: name label on the ball carrier, small yellow/red card icon on booked players, a red cross on an injured player, a brief pass trail line (fades in 300 ms), net flash and screen shake on a goal.

### Choreography model (`logic/choreography.js`, pure, seeded)

1. Extend each engine tick to output an `actions` array of 2 to 6 steps ending in the tick's outcome. Step shape: `{ t, type, playerId, targetId, from:{x,y}, to:{x,y}, text }` with `type` in `pass, dribble, longBall, cross, tackle, interception, clearance, shot, save, goal, miss, foul, offside, corner, freeKick, penalty, goalKick, throwIn, kickOff`. The players named in the final steps must be the engine's shooter, assister and keeper.
2. Player targets every frame: each player has a formation anchor (x, y) per formation. Target = anchor shifted toward the ball: x shift = 35% of (ballX - 52.5) for the team in possession and 25% for the defending team, y shift = 20% of (ballY - 34); defensive line never passes the ball's x; lines keep at least 8 m apart. Add a slow per-player wander of up to 2 m (seeded noise).
3. Special roles per step: the nearest defender closes down the ball carrier; the pass target moves to the reception point; on a cross, two attackers and three defenders move into the box; on a shot, the keeper moves along the goal line toward the shot's y.
4. Movement: discs move toward their target with eased velocity, max speed `4 + PAC / 20` m/s scaled by match speed. No teleporting, except set-piece resets, which use a 250 ms fade out/in.
5. Set-piece layouts: kick-off, goal kick, corner (both sides), direct free kick with a wall, penalty, throw-in. After a goal: scorer runs toward a corner flag, nearest three team-mates converge, 1.5 s hold, then kick-off reset.
6. The ball is always either attached to a player (offset 0.8 m in their facing direction) or tweening between two points. Never free-floating.

### Player intelligence (what "playing properly" means)

The result comes from the engine, so intelligence here means one thing: someone who watches football must find the 22 discs believable at every moment. Do not build machine learning or a free-running agent simulation. Build three layers, in this order, all in `logic/choreography.js`:

**Layer 1: team shape (every frame, all 22 players).** The base rule in step 2 above, plus:

- In possession the team spreads out: full-backs and wingers go wide, the block is 35-40 m deep. Out of possession it contracts toward the ball: 25-30 m deep, shifted to the ball's side, far-side winger tucks in.
- The back line moves as a unit (same x within 3 m, unless one centre-back steps out to press), holds an offside line, and drops when the ball goes over it.
- Keeper stays on the line between ball and goal centre, 2-12 m off the goal line depending on how far the ball is.
- Transitions are visible: on a turnover the team that lost the ball retreats toward its anchors at full speed while the other team's forwards sprint ahead, for about 2 seconds before shapes settle.

**Layer 2: roles (per player, depends on position and on the equipped style card).**

| Role | With the ball in the team | Without the ball |
|---|---|---|
| ST | Stays on the shoulder of the last defender, runs in behind when a midfielder has the ball facing forward; Target man holds position and receives to feet | Blocks the pass between the centre-backs, does not chase past the halfway line |
| W | Hugs the touchline, then cuts inside or goes to the byline in the final third; Inverted winger drifts into the half-space | Tracks the opposing full-back back to his own third |
| AM | Finds space between the opponent's midfield and defensive lines | Screens the opponent's deepest midfielder |
| CM | Offers a short pass option at a different angle from team-mates, one CM joins the attack late, the other stays; Box-to-box arrives in the box | Closes the nearest midfielder, stays goal-side |
| DM | Stays behind the ball as cover, available for the back pass | Sits in front of the centre-backs, never ahead of the ball |
| FB | Overlaps outside the winger when the ball is on his side and the DM covers; stays if the other full-back has already gone | Marks the winger, tucks next to the centre-back when the ball is on the far side |
| CB | Splits wide for build-up, one steps up with the ball if unpressed | Marks the striker goal-side, nearer one challenges, the other covers 3-5 m behind |

**Layer 3: ball decisions (which actions fill each tick).** The engine has already decided the tick's outcome (quiet possession, turnover, foul, chance of a given quality, goal or not). The choreography must build a plausible path to that outcome. For each step, score every candidate action for the ball carrier and pick the best one that still allows the outcome to be reached in the remaining steps:

- Candidates: pass to each team-mate, dribble forward 5-10 m, cross (only from wide in the final third), shoot (only as the final step of a chance tick), clear (defenders under pressure in their own third).
- Pass score = progress toward goal (+), receiver unmarked by 4 m or more (+), passing lane not within 2 m of an opponent (required, otherwise the pass is illegal), distance 8-25 m preferred, backward pass allowed only when the carrier is pressed, receiver would be offside = illegal. Weight the score with the carrier's PAS and the Passing setting (Short prefers under 15 m, Direct prefers progress).
- Dribble only into free space (no opponent within 4 m ahead), more often for high DRI players.
- A chance tick must end with a shot from a location consistent with its xG: big chance inside the box and central, decent chance edge of box or wide inside it, half chance from distance or a tight angle, and the build-up must fit the tactic (cross and header under Wide or Target man, through ball in behind against a High line, quick 3-pass break under Counter-attack).
- A turnover tick ends in a tackle, an interception of a pass through a tight lane, or a misplaced long ball, at the place where the defending team is densest.
- Better players look better: high PAS players attempt longer and more forward passes, high PAC players win foot races shown on screen, low-rated players take more touches before releasing.

**Never allowed (treat any of these as a bug):**

- Ball passed through an opponent, or to a player in an offside position (unless the tick's outcome is offside).
- Players standing still for more than 2 seconds in open play, or all drifting toward the ball like a swarm (at most 2 defenders and 1 supporting attacker may converge on the carrier).
- A defender ahead of his own midfield in open play, a keeper outside his box, a striker defending in his own box (corners and free kicks excepted).
- Two team-mates within 3 m of each other for more than 1 second outside set pieces.
- A shot from a spot that contradicts its xG, a goal where the ball does not cross the goal line between the posts, a save where the keeper is not near the ball.
- The scorer or assister on screen differing from the engine's event.

**How to verify it (required proof, not optional):**

- `tools/sim.js --viz-check` replays 200 seeded matches headless through the choreography and counts each "never allowed" violation. Target: zero for the illegal-pass, offside, wrong-scorer and wrong-location rules, under 1 per match for the spacing rules.
- It also prints shape metrics averaged over the matches: team depth and width in and out of possession, back-line x spread, average pass length by Passing setting, share of forward passes. Check them against the numbers in Layer 1.
- Then watch: capture an 8-frame screenshot strip (one frame every 0.5 s via `__game.step(500)`) for one open-play attack, one counter-attack, one corner and one goal, look at them yourself, and describe what is wrong before showing me. Iterate until the strips read as football.

### Pacing

- Full match mode: each 3-minute tick plays in about 3 seconds at x1 (a match in about 90 seconds), quiet ticks show 2 or 3 passes in midfield, chance ticks play the full chain.
- Highlights mode: quiet ticks collapse to 0.3 s with the clock running fast; only chances, cards, injuries and goals are animated. This is the default.
- Decisions (subs, tactic changes, key-moment prompts) pause the animation.
- The animation clock is a variable advanced by `requestAnimationFrame` deltas and also by `window.__game.step(ms)`, so tests can drive it without real time (the preview pane throttles rAF).

### Acceptance checks for the view

- Final score, scorers and minutes shown in the view equal the engine's event log for 200 seeded matches (automated check through `step`).
- No disc ever leaves the pitch bounds by more than 2 m; no disc exceeds its max speed outside a faded reset; no two same-team discs overlap for more than 1 second.
- 60 fps at x4 on a mid-range laptop; under 2 ms per frame of script time.
- Readable at 390 px wide: discs stay at least 14 px in diameter, numbers legible.

## Game modes

- **League**: my country's 3 divisions of 14 clubs, home and away, top 2 up, bottom 2 down. I start in Division 3 with a starter pack. The other 4 countries' leagues run in parallel every matchday (quick-simulated with the same engine, no choreography) and I can browse their tables, results, top scorers and squads.
- **National cup**: knockout across my country's 3 divisions, extra time and penalty shootouts (interactive shootout: pick the taker order).
- **Continental cup**: the top 3 of each of the 5 first divisions plus the title holder (16 clubs), 4 groups of 4, then two-legged quarter and semi finals and a one-match final, played on midweek slots.
- **International football**: see "National teams".
- **Weekly tournaments** with squad rules (e.g. "max 2 Gold cards", "one nation only", "under-23") so lower-rarity cards stay useful.
- **Draft mode**: pick 1 of 5 cards per position, play a 4-match gauntlet, rewards by wins. Costs a ticket.
- **Squad challenges**: trade in cards meeting a requirement (e.g. "11 Silvers, 3 leagues, chemistry 20+") for a guaranteed reward. This is the sink for unwanted and ageing players; traded-in players become free agents.

AI clubs have a generated identity (style, formation, star player, rivalries) and their squads evolve between seasons.

## Economy and progression

- Coins from matches (result, goals, clean sheet, attendance), league prize money, cup runs, sponsor deals, selling cards.
- Sponsor objectives: pick 1 of 3 sponsors per season, each with targets (finish top 6, score 30 goals, field 3 academy players) and payouts.
- Packs: Bronze, Silver, Gold, Position packs, Staff pack, Training pack, Promo pack. Published odds on every pack, pity timer for Elite. Duplicate non-player cards convert to coins. Quick-selling a player releases him to free agency.
- Transfer market: simulated AI listings refreshed after each matchday, prices driven by rating, age, position scarcity and form. Buy now and sell only, no bidding wars.
- Player lifecycle: see "Careers" in "The world"; a rare few retiring greats become Icon cards. Because my squad ages, I must keep renewing it: that is the long-term loop. Contracts tick down per match and need renewal (higher wages for better cards, wage budget caps squad quality so I cannot just stack Elites).
- Form: recent match ratings move a card's temporary rating +/- 2. Morale reacts to results, playing time and team talks.
- Fitness and injuries force squad rotation. Suspensions from card accumulation.
- Youth academy: one prospect per month to promote or release, quality tied to academy level and youth coach.
- Card evolutions: slot a card into an evolution path (e.g. "score 5 goals with this striker in 6 matches") for a permanent upgrade and a new card skin.
- Daily and season objectives, a season pass track of free rewards, a collection album with set-completion bonuses, a trophy cabinet, season awards (top scorer, best XI), and a club history page with records.

## UX and look

- Dark stadium-night theme, strong typography, card-centric layouts. Rarity must be readable at thumbnail size from frame shape and colour alone.
- Pack opening is the showpiece: pack shake, rip, light colour hints at best rarity, cards revealed one by one with flips, a "walkout" sequence for Elite and Icon (nation flag -> position -> club crest -> card), skip button always available.
- Every number that changes animates. Every screen reachable in two clicks from the hub. No dead-end modals.
- First-run onboarding in under 3 minutes: name club, pick colours and crest, open starter packs, auto-build, play first match.
- Settings: sound, animation intensity (reduced motion respected), match speed default, reset save (with confirmation).

## Exact specs (starting values, all in `balance.js`, tune only via the sim)

Do not invent alternatives to these. If a value fails calibration, change the value in `balance.js`, re-run the sim, and report old -> new.

### Ratings

| Rarity | OVR range | Upgrade slots | Starter-pack weight |
|---|---|---|---|
| Bronze | 45-64 | 1 | 80% |
| Silver | 65-74 | 2 | 20% |
| Gold | 75-84 | 3 | 0 |
| Elite | 85-91 | 3 | 0 |
| Icon | 88-95 | 0 (fixed) | 0 |

Average XI rating of AI clubs at world generation: Division 3 = 60, D2 = 69, D1 = 78, spread +/- 4 inside a division, same in all 5 countries (+/- 1 per country). Background clubs: 45 to 76 depending on nation tier. After generation, club strength is whatever the players' careers and transfers make it.

The 7 stats (0-99) and what they stand for (the sub-attributes are descriptive only, do not store them):

| Stat | Group | Covers (Ultimate Team / Football Manager vocabulary) |
|---|---|---|
| PAC | Physical | acceleration, sprint speed |
| PHY | Physical | strength, stamina, jumping, aggression |
| SHO | Technical | finishing, shot power, long shots, volleys, penalties |
| PAS | Technical | short and long passing, crossing, free kicks, technique |
| DRI | Technical | dribbling, ball control, first touch, agility, balance |
| DEF | Technical | tackling, marking, interceptions, heading |
| MEN | Mental | decisions, positioning, anticipation, vision, composure, concentration |

Keeper stats: DIV (diving, Physical), REF (reflexes, Physical), SPD (speed, Physical), HAN (handling, Technical), KIC (kicking, Technical), POS (positioning, Mental), MEN (Mental).

OVR = weighted sum, rounded. The weights are what each position needs:

| Position | PAC | SHO | PAS | DRI | DEF | PHY | MEN |
|---|---|---|---|---|---|---|---|
| ST | .18 | .37 | .05 | .17 | .00 | .13 | .10 |
| W | .28 | .18 | .14 | .28 | .00 | .04 | .08 |
| AM | .08 | .18 | .28 | .26 | .00 | .06 | .14 |
| CM | .05 | .08 | .30 | .17 | .13 | .12 | .15 |
| DM | .05 | .00 | .20 | .08 | .35 | .17 | .15 |
| FB | .23 | .00 | .13 | .13 | .31 | .10 | .10 |
| CB | .08 | .00 | .05 | .00 | .47 | .25 | .15 |

GK weights: DIV .22, HAN .18, KIC .05, REF .22, SPD .05, POS .18, MEN .10.

A generated player's stats follow his position's weights (high-weight stats are his best ones) with +/- 6 individual variation, so two strikers with the same OVR can be a fast poacher and a strong target man.

Hidden per player: `potential` per stat, `devType`, `peakStart`, `peakEnd`, `professionalism` 1-20, `injuryProne` 1-20 (multiplies injury chance by 0.6 to 1.6), `consistency` 1-20 (each match, effective stats get a random offset of 0 to -(20 - consistency)/4, drawn once per match).

Out-of-position penalty on all face stats: secondary position 0, same line (e.g. CM at DM) -5, adjacent line -12, outfield in goal or keeper outfield -40.

### Chemistry

Count starters (manager counts as one extra for their nation or league). Per player, points from each link type, summed and capped at 3:

| Link | 1 pt | 2 pts | 3 pts |
|---|---|---|---|
| Same club | 2 players | 4 | 7 |
| Same nation | 2 | 5 | 8 |
| Same league | 3 | 5 | 8 |

"Club" and "league" on a card mean the club he was signed from and that club's country championship (all divisions of a country count as one league; background clubs count as their nation's league). They do not change when he joins me. Icons count as 2 players for their nation and 1 for every league. Team chemistry = sum, max 33. Effect per player: +1 to all face stats per chemistry point; the equipped style card applies `chem / 3` of its bonus (so 0 at zero chemistry).

### Match engine algorithm

Deterministic given `(homeTeam, awayTeam, seed)`. The match is 30 ticks of 3 minutes, plus 0-2 added ticks per half.

1. Line strengths per team, recomputed whenever a sub, card, injury or tactic changes:
   - `ATT` = mean of (SHO + DRI + PAC) / 3 over ST, W, AM, with CM at half weight.
   - `MID` = mean of (PAS + DRI + PHY + MEN) / 4 over AM, CM, DM, with FB at half weight.
   - `DEF` = mean of (DEF*1.5 + PHY + PAC*0.5 + MEN) / 4 over CB, FB, DM.
   - `GK` = keeper OVR.
   - Multiply each by fitness factor (`0.85 + 0.15 * fitness/100`), morale factor (0.97 to 1.03), home factor 1.04 for the home side, then tactic and mentality modifiers.
2. Each tick, possession: `pHome = MIDh^2 / (MIDh^2 + MIDa^2)`. The side in possession attacks with probability 0.55.
3. Attack -> chance: `pChance = clamp(0.30 + (ATT - oppDEF) / 100, 0.10, 0.60)`. Otherwise the event is a turnover, foul (12%), or offside (6%).
4. Chance quality, sampled: half chance xG 0.05 (50%), decent 0.12 (30%), big 0.33 (17%), penalty 0.76 (3%). Shift 5 points of probability from half to big for every 10 of (ATT - oppDEF) above 0, and the reverse below.
5. Pick the shooter weighted by position (ST 40, W 20, AM 15, CM 10, others 15 split) x SHO; pick the assister weighted by PAS among the rest (25% of goals unassisted).
6. Goal probability = `clamp(xG * (1 + (shooterSHO*0.8 + shooterMEN*0.2 - oppGK) / 100), 0.01, 0.95)`. Otherwise: save 55%, off target 35%, blocked 8%, woodwork 2%. A save has a 20% chance to give a corner; a corner is a new chance at xG 0.03 (+0.02 with set-piece coach, shooter weighted by PHY).
7. Per tick, per player on the pitch: fitness drain 0.9 (x1.3 under High press, x0.8 with fitness coach); injury chance 0.04% (x2 below 50 fitness, x0.6 with physio); foul events give yellow 18%, straight red 1.5%; second yellow = red.
8. AI game state: trailing after minute 60 -> attacking mentality (ATT x1.08, DEF x0.94); leading after minute 75 -> defensive (reverse). AI subs at minutes 60, 70, 80 replacing the lowest-fitness outfield players.
9. Player match rating: start 6.0, goal +1.0, assist +0.7, clean sheet (GK/DEF) +0.8, save +0.2, yellow -0.3, red -1.5, conceded (GK/DEF) -0.3 each, team win +0.3, clamp 3-10.

Expected output of step 2-6 at equal strength: about 11-13 shots and 1.3-1.4 goals per team. If the sim disagrees, tune the 0.55 attack rate and the chance mix first.

### Packs and prices

| Pack | Price | Cards | Player rarity odds (per player slot) |
|---|---|---|---|
| Starter (free, once) | 0 | 18 players + manager + 3 staff + kit, crest, stadium | see rarity table, guaranteed 2 GK |
| Bronze | 400 | 5 (3 players, 2 other) | Bronze 90 / Silver 10 |
| Silver | 1,500 | 5 (3 players, 2 other) | Bronze 30 / Silver 62 / Gold 8 |
| Gold | 5,000 | 6 (3 players, 3 other) | Silver 35 / Gold 60 / Elite 4.7 / Icon 0.3 |
| Promo | 12,000 | 6 (4 players, 2 other) | Gold 80 / Elite 18 / Icon 2 |
| Staff | 2,000 | 3 staff or manager | by tier, same odds as Silver |
| Training | 2,500 | 4 training/trait/style/tactic | 70 common / 25 rare / 5 epic |

Pity: an Elite or better is guaranteed on the 20th Gold pack without one. "Other" slots: 50% consumable, 25% training, 15% tactic or style, 10% staff or club item.

### Coins

Match: win 400, draw 200, loss 100, +25 per goal, +75 clean sheet, x1.0 / 1.5 / 2.2 by division (D3 to D1), x2.5 in the continental cup, home gate +50 per stadium tier. League prize: 3,000 x division multiplier for the title, sliding down to 20% for last. Quick-sell: Bronze 25, Silver 150, Gold 600, Elite 4,000. Market price = `quickSell x (4 + (OVR - rarityMin) x 0.8)`, x1.2 under age 23, x0.6 over 31, 5% sale tax.

Wage per match = `(OVR - 40)^2 / 10` coins per squad player; wage budget = 60% of the average match income of the current division. Contracts start at 16 matches (one league season = 26 matches).

### Player development

Runs for every player in the world twice per season (mid-season and season end, half the yearly amounts each time), in one pass over the typed arrays. Age increases by 1 at season end.

**Peak window.** Each player gets `peakStart` and `peakEnd` at creation = position default, shifted by development type, plus an individual jitter of -1 to +1 on each bound.

| Position | Default peak window |
|---|---|
| W | 23-28 |
| ST, AM, FB | 24-29 |
| CM | 25-30 |
| DM, CB | 26-31 |
| GK | 27-33 |

| Development type | Share | Effect |
|---|---|---|
| Early bloomer | 20% | Window shifted -4 years (a winger peaks 19-24), starts at 80% of potential by 18, declines 1.3x faster |
| Standard | 55% | Position default |
| Late bloomer | 20% | Window shifted +3 years, growth rate x0.6 before 22 and x1.4 after |
| Evergreen | 5% | `peakEnd` +3, decline x0.5 |

**Stat groups use offset windows.** Physical stats use the player's window shifted -2 years, Technical stats use it as is, Mental stats use it shifted +2 at the start and +4 at the end. That single rule produces the realistic pattern: pace goes first, the brain goes last.

**Per stat, per year** (apply to each stat with its group's window, `age` = current age):

- Growing (`age < windowStart`): `gain = round((potentialStat - stat) x rate + noise)`, `rate = 0.30` at 3+ years before the window, `0.22` at 2 years, `0.15` in the last year, `noise` in {-1, 0, +1}. Multiply `rate` by the professionalism factor (`0.75 + professionalism / 40`, so 0.78 to 1.25) and by the playing-time factor (league appearances that season: under 5 = 0.6, 5 to 14 = 0.85, 15+ = 1.0, and 1.15 if average match rating was 7.0+). For my players also multiply by `1 + 0.08 x trainingGroundLevel` and by 1.1 for players under 21 with a Youth coach.
- At peak (`windowStart <= age <= windowEnd`): change of -1, 0 or +1 with probabilities 15 / 60 / 25, never above potential.
- Declining (`age > windowEnd`): `loss = base x (1 + 0.25 x (age - windowEnd - 1)) x typeFactor x (1.25 - professionalism / 40)`, rounded with a random remainder. `base` = 2.5 for Physical, 1.2 for Technical, 0.5 for Mental. A Fitness coach reduces Physical loss by 15% for my players.
- Potential per stat is fixed at creation: `potentialStat = currentStat + headroom`, headroom spread by the position weights so the potential OVR hits the generated target. Potential OVR distribution for a 16-year-old regen: mean 68, standard deviation 8, capped at 96; tier-1 nations +3, tier-5 nations -5.
- Training cards add to both the stat and its potential (permanent), within the slot limits.

**Retirement, each season end:** probability 0 before 33 (35 for GK), then 15%, 30%, 45%, 60%, 80%, 100% by 40. Add 20 points for a free agent, add 25 points if OVR is more than 12 below his career peak. One retiring player in 400 with career-peak OVR 88+ becomes an Icon card in the Icon pool.

**Regens:** one per retiree, same nation, age 15-17, current OVR 40-58, position drawn to pull the world back toward GK 10%, CB 18%, FB 14%, DM 8%, CM 16%, AM 8%, W 12%, ST 14%. New name from the nation's name pool, never an exact duplicate inside one club.

**Expected results to verify with the sim:** average age of the world's top 100 players 26-29; top 100 wingers on average 2-3 years younger than the top 100 centre-backs and 4-5 younger than the top 100 keepers; a typical Standard striker gains about 15-20 OVR from 17 to 24 and loses about 8-12 from 30 to 35; world size, position mix, OVR distribution and each national team's rating stay within +/- 5% of their starting values over 40 simulated seasons (no inflation, no collapse).

### World performance budget

- World stored as struct-of-arrays in typed arrays inside `logic/world.js` (one `Uint8Array` per stat and per small field, `Uint16Array` for name indices and club id, `Uint32Array` only where needed). Names are two indices into name pools, never strings per player. Target about 48 bytes per player, so under 5 MB at 100,000.
- `getPlayer(id)` returns a plain object view; `forEachPlayer`, `query(filters)` and `topN(nation, position, n)` work on the arrays directly. Never materialise all players as objects.
- Only my own cards and career stats of notable players are stored as JSON objects.
- World generation, season rollover and background matchdays run in a Web Worker with a progress bar. Budgets on a mid-range laptop at 100,000 players: generation under 6 s, development pass under 300 ms, season rollover under 2 s, one background matchday (about 100 quick-sim matches: every fixture in the 5 countries except mine) under 400 ms, database screen filter under 100 ms.
- Background clubs get synthetic stats: appearances drawn from squad rank, average rating from OVR versus club average, no match simulation.

## Architecture rules

File layout (create exactly this, add files only inside these folders):

```
src/
  index.html            shell + root element
  main.js               boot, router, state store
  balance.js            every tunable number from the specs above
  strings.js            all UI text
  logic/                pure modules, no DOM, no Date.now, no Math.random
    rng.js              mulberry32, rngFrom(seed), pick, weighted, int, chance
    nations.js          about 60 real nations: code, name, flag, continent, tier 1-5, colours, name culture
    names.js            about 20 name cultures (several nations share one), each 150+ first names and 300+ surnames; club name parts per home country
    world.js            typed-array player store, getPlayer, query, topN, clubs, free agents
    generator.js        generateWorld(seed, size), makeRegen, makeClub, makeManager, makeStaff
    development.js      peak windows, growth/decline pass, retirement, regens, AI club squad upkeep and transfers
    international.js    national squad selection, windows, qualifiers, World Cup and continental tournaments, rankings
    worker.js           runs generation, rollover and background matchdays off the main thread
    cards.js            card schemas, effective stats, apply training/trait/style
    chemistry.js        computeChemistry(xi, manager), linkColour(a, b)
    formations.js       slots (pos, x, y), neighbour pairs, choreography anchors per formation
    tactics.js          settings + tactic cards -> strength modifiers (the table in "Tactics panel")
    matchEngine.js      createMatch, stepTick, applyDecision, simulate
    commentary.js       event/action -> text line (5+ variants per type)
    choreography.js     tick events -> action steps, formation anchors, set-piece layouts, target positions
    season.js           fixtures (round robin), table, promotion, cup draws
    economy.js          rewards, wages, prices, pack opening
    market.js           AI listings refresh
    save.js             IndexedDB: typed arrays as blobs + JSON state, migrate, export/import file
  ui/                   one file per screen: hub, squad, tactics, packOpening, match, market, league, world (other leagues), database (player search), international, club, collection
    components/         card.js, pitch.js, avatar.js, crest.js, modal.js
  styles/               tokens.css, card.css, holo.css, screens.css
  vendor/               gsap.min.js, confetti.min.js
tools/
  build.js              inlines everything into dist/index.html
  sim.js                node script: calibration tables
  bot.js                node script: plays N seasons with a simple policy, prints economy report
```

Schemas (write these first, in `logic/cards.js`, as JSDoc typedefs, and do not change field names later):

```js
// World player: the object view returned by world.getPlayer(id). Stored as typed arrays, not as objects.
{ id, name, nation, age, foot, clubId, pos, altPos:[],
  stats:{pac,sho,pas,dri,def,phy,men},   // or GK keys
  potential:{...same keys}, devType, peakStart, peakEnd,
  professionalism, injuryProne, consistency,
  ovr, peakOvr, caps, intlGoals,
  season:{apps,goals,assists,avgRating} }
// Player card: only for players registered with my club. Everything else is read from the world by playerId.
{ id, kind:'player', playerId, signedFromClubId, leagueId,
  upgrades:[{stat,amount}], traits:[], styleId:null,
  fitness:100, morale:50, form:0, contract:16,
  injuredFor:0, suspendedFor:0, yellows:0,
  career:{apps,goals,assists,cleanSheets,avgRating} }
// Match event
{ minute, type, team:'home'|'away', playerId, assistId, xg, text,
  actions:[{ t, type, playerId, targetId, from:{x,y}, to:{x,y}, text }] }
// Game state
{ version, seed, worldSize, country, favouriteNation, nationalJob:null,
  coins, club, cards:[], squad:{formation,xi:[],bench:[],tacticCards:[],
         settings:{mentality,pressing,width,passing,defLine},
         roles:{captain,penalties,freeKicks,corners}},
  season:{number,division,fixtures,table,cup}, market:[], objectives:[], pity:{gold:0}, settings }
```

Rules:

- UI modules only read state and dispatch actions through `main.js`. No game rules in `ui/`.
- Every logic function that needs randomness takes an `rng` argument.
- Headless hooks: `window.__game` exposing `simulateMatch(seed)`, `simulateSeason(seed)`, `openPack(type, seed)`, `state`, `step()`. A `?bot` URL flag auto-plays a season and logs a summary.
- `node tools/sim.js` prints: goals per match, home/draw/away %, shots per team, win % by rating gap (0, 5, 10, 15), chemistry 0 vs 33 win %, cards and injuries per match, pack rarity distribution over 10,000 openings.
- `node tools/sim.js --world 100000 --seasons 40` generates a world, runs 40 season rollovers with quick-simulated leagues, and prints per decade: population, age histogram, OVR distribution, position mix, average age of the top 100 per position, 5 sample career tables (age vs each stat) for each development type, national team top-10 ranking, retirements and regens per season, and timings against the performance budget.

## Delegation (sub-agents)

Sub-agents start with no context. Only delegate after the contracts exist on disk (`balance.js`, schemas in `cards.js`, `rng.js`), and tell each agent to read those files first and to touch only the files listed for it. Run independent agents in parallel. Do everything else yourself in the main session, including all integration and all files in `main.js` and `ui/` unless listed below.

| Work package | Delegate? | Files it owns | Brief must include | Done when |
|---|---|---|---|---|
| Contracts: schemas, `balance.js`, `rng.js`, file tree | No, main session, first | - | - | Files exist, `node -e "import('./src/logic/rng.js')"` works |
| Nations + name pools (pure content, large) | Yes | `logic/nations.js`, `logic/names.js` | Nation and name-culture requirements, "real countries, fictional people and clubs" rule, the rule that a generated club name must not match a real club | 60 nations with tiers; every culture has 150+ first names and 300+ surnames; a script samples 5,000 names and 210 club names for manual spot check |
| World store + generator | Yes, after nations | `logic/world.js`, `logic/generator.js`, `logic/worker.js` | "The world" section, ratings and stat tables, performance budget, schemas | 100,000 players generated inside the time and memory budget; OVR distribution, club averages and position mix match the spec; `query` and `topN` timings printed |
| Player development + regens | Yes, phase 2, strongest model available | `logic/development.js`, the `--world` mode of `tools/sim.js` | Full "Player development" spec and "Careers" requirements | 40-season sim meets every line of "Expected results to verify with the sim"; career tables attached |
| National teams | Yes, phase 4 | `logic/international.js`, `ui/international.js` | "National teams" section, season calendar, engine API | A World Cup and a qualifying cycle simulate without error; squads have a valid position mix; call-ups update my cards |
| Match engine + commentary + `tools/sim.js` | Yes | `logic/matchEngine.js`, `logic/commentary.js`, `tools/sim.js` | Full "Match engine algorithm" section, calibration targets | Sim table printed and inside targets, same seed gives same result |
| 2D match view (start after the match engine agent has delivered) | Yes, strongest model available | `logic/choreography.js`, `ui/components/pitch.js`, `ui/match.js` HUD markup, `styles/match.css` | Full "2D top-down match view" section, the event schema, a recorded event log from `sim.js` to replay | Standalone demo replays 3 seeded matches; view acceptance checks and `--viz-check` pass; the four 8-frame screenshot strips from "Player intelligence" attached with the agent's own critique. Build layer 1, verify, then layer 2, verify, then layer 3 |
| Squad and tactics screen (start after the card component exists) | Yes, strongest model available | `ui/squad.js`, `ui/tactics.js`, `styles/squad.css`, formation slot + neighbour data in `logic/formations.js` | Full "Squad and tactics screen" section, chemistry table, card schema, a generated 25-card club to render | Standalone demo: drag swap works with mouse and touch, link lines and header update live, all 6 formations render, tactics settings write to state; screenshots |
| Chemistry + cards effects | Yes (small, can merge with generator agent) | `logic/chemistry.js`, `logic/cards.js` functions | Chemistry table, penalties | Unit checks for 0, partial and 33 chemistry pass |
| Card component + holo CSS + pack opening | Yes | `ui/components/card.js`, `avatar.js`, `crest.js`, `styles/card.css`, `styles/holo.css`, `ui/packOpening.js` | "UX and look" section, rarity list, card schema, a mock card array to render | Standalone demo page opens a mock pack with all 5 rarities, screenshots attached |
| Season, economy, market, save | Yes, phase 2 | matching `logic/` files, `tools/bot.js` | Coins, packs, wage and growth specs | Bot report over 3 seasons meets the economy acceptance check |
| Screens wiring, router, state store | No, main session | `main.js`, `ui/*.js` | - | Full loop playable in the browser pane |
| Adversarial review at end of each phase | Yes, read-only, strongest model available | none (reports only) | "Find rule violations: Math.random in logic, game rules in ui, numbers outside balance.js, real names, dashes, exploits in buy/sell" | Report with file:line findings; main session fixes them |

Recommended models if the harness lets you choose: logic and sim agents on the session model; the card/pack visual agent and the adversarial reviewer on the strongest model available, since those are where quality gaps show.

Never let two agents edit the same file. If an agent needs a schema change, it reports back instead of changing `cards.js` or `balance.js`.

## Phases

1. **Vertical slice**, in this order: (a) contracts and file tree, (b) in parallel via sub-agents: generator, match engine + sim, chemistry, card + pack opening visuals; then the 2D match view agent once the engine's event log exists, (c) main session wires squad screen, match screen, hub and a 5-match mini league (6 clubs, single round robin), (d) build to `dist/index.html`, (e) adversarial review, fix, re-run sim. Only Bronze, Silver and Gold packs, players + manager only, no staff, no contracts, no wages, no ageing yet. The full-size world store and generator are part of this phase (packs and the mini league draw from the real world), so the data model never has to be redone. Proof: screenshots of squad, pack opening and match screens, 10,000-match calibration table, pack odds over 10,000 openings.
2. **Season game and living world**: the 5 countries with 3 divisions each, background matchdays, cup, economy, market, contracts, fitness, injuries, staff and manager cards, IndexedDB save/load, player development, retirement and regens, AI club upkeep, the other-leagues and player database screens. Proof includes the 40-season world sim report.
3. **Customisation depth**: training, trait, style, tactic cards, evolutions, youth academy.
4. **Extra modes and polish**: continental cup, national teams (windows, World Cup, continental championships, the national manager job), weekly tournaments, draft, squad challenges, objectives, album, awards, audio, onboarding, mobile layout.

After each phase, list what is stubbed or untested. Never claim something works without having run it.

## Acceptance checks (every phase)

- No console errors across a bot-played full season.
- Sim numbers within the calibration targets above.
- A 10-rating-point gap between sides gives the favourite roughly 60-70% wins, not 95%.
- An equal-rating squad with full chemistry beats the same squad at zero chemistry clearly but not always.
- Economy check: a bot playing 3 seasons without smart market play reaches division 2 but not the top division; no infinite coin loop through buy/sell or challenges.
- Save, reload, and export/import produce an identical state, including the world arrays (compare checksums).
- From phase 2: the 40-season world sim stays inside the "Expected results" bounds and the performance budget at 100,000 players, and a browser session that plays 3 seasons shows no growth in memory beyond 20%.
