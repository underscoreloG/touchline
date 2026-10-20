# Touchline - handoff (saved 2026-10-12)

Football card-manager game built from PROMPT.md. Phase 1 (vertical slice) is playable. Phase 2 has not started.

## Run it
- Play: open `dist/index.html` (standalone, offline) or run `node tools/serve.js 5400` then http://localhost:5400/dist/index.html
- Build: `node tools/build.js` (esbuild bundles src/ into dist/index.html, also packs sounds into src/ui/soundData.js)
- Hidden cheat menu in game: backtick key, Ctrl+Shift+K, or click the TOUCHLINE logo 5 times
- Bot season: `dist/index.html?bot&seed=5&size=30000` (logs `[bot] season done` in the console; 20,000 is no longer a valid size)
- Headless hooks: `window.__game` (state, world getters; simulateMatch, openPack, simulateSeason work on copies; step(ms) drives the match clock because the preview pane throttles rAF)
- Preview tool note: `preview_start` needs `.claude/launch.json` in `C:\Users\Kévin\Downloads\Claude\`, which does not exist; use `node tools/serve.js 5400` instead (or the already-written one in this folder's .claude/launch.json is NOT picked up).

## Checks (all passing at save time unless noted)
- `node tools/sim.js` (10,000 matches: goals 2.7, H/D/A 44.9/24.7/30.5, shots 12.5, +10 gap = 65% favourite wins, chem 33 vs 0 = 61% of decisive results)
- `node tools/sim.js --packs` (rolled and delivered pack odds), `node tools/sim.js --viz-check --n 200 [--pacing]`
- `node tools/check-cards.js` (128), `check-squad.js` (118), `check-world.js --size 50000` (91), `check-names.js`, `check-game.js` (23), `check-cheats.js` (11), `check-shouts.js` (8), `check-packs.js` (26)

## What exists
- logic/: rng, balance (all tunables), nations (65), names (28 cultures), world (typed arrays, 45 B/player), generator, worker, cards, cardEffects, chemistry, formations, tactics, matchEngine, commentary, choreography (2D view), squad, season, economy, game, stats, cheats
- ui/: newgame, hub, squad (3D pitch, drag/tap, detail panel on click, quick sell), tactics, packs shop (bronze/silver/gold), packOpening (GSAP), match (2D top-down view) + matchFlow (prematch, live match, half-time panel, touchline shouts with cooldowns, postmatch), halftime, stats (My team / League / History), league, cheats, audio (real CC0 samples), components (card, avatar, crest, pitch, squadPitch)
- Game flow: new game -> starter pack (18 players + manager) -> auto XI -> league pyramid season in level 5 of my country (see "League pyramid" below) -> prize, promotion / relegation -> next season. Phase 1 scope only: no contracts, wages, market, save.

## Decisions and deviations to remember
- Engine runs 4 possession phases per 3-minute tick (needed to reach the spec's 11-13 shots); overlapping full-backs raise ATT by 2.5% per FB; offside trap takes 6% from opponent chances; set-piece coach also affects free kicks. Calibrated values live in balance.js ENGINE (old values in comments).
- Watched match == Instant result with default answers (verified 8/8). Starting a match commits it; leaving mid-match finishes it by sim.
- Highlights mode (default) is about 89 s per match at x1, full mode about 177 s ("broadcast pace").
- Starter squad is weak by design (finished 6th and 3rd in bot runs).
- Packs sign from free agents, youth and background clubs only. Background lower-league clubs of ENG/ESP/ITA/GER/FRA ARE pack-eligible (ambiguous in the spec; decide).
- Signing from background clubs makes the world grow by one slot per refill (world size is no longer constant).
- Wage budget in the spec is inconsistent with squad wages (starter squad about 550-1380 per match vs budget about 185). Fix in Phase 2 calibration.

## Cleanups finished at save time
1. DONE (verified at save time): real club and player names removed. Generator rejects real places/clubs via an 8,800+ entry gazetteer; real players are blocked by 5,334 hashed names (src/logic/realNames.js). 0 hits in 3 seeds x 50k worlds for the review examples. Not exhaustive (lists written from memory): French communes, small German villages and lower-profile players can still collide. Existing seeds now give different club names.
2. DONE (verified at save time): UI text moved to strings.js and spec numbers to balance.js, behaviour identical (all checks and bot season in the browser pass; dist is 1.9 MB). Still inline English: cheat menu, the LATER chip on the match canvas, stats table headers (S.league keys exist), toLocaleString('en-US').
3. Both agents have reported; nothing is running in the background.

## Done on resume (2026-10-12)
- More pack types, all buyable in the shop (tabs): Bronze, Silver, Gold, Promo | GK, Defender, Midfielder, Attacker | Prospect (age <= 20), Veteran (age >= 30) | Staff, Training. Config in balance.js (PACKS, PACK_SHOP, ITEMS); logic in economy.js (openPack, makeItemCard); UI in ui/packs.js.
- Player packs now follow the spec "other slot" mix (50% consumable, 25% training, 15% tactic/style, 10% staff); managers only come from Staff packs and the starter pack. Training cards leave the stat open (pick it when applying from the player panel).
- Prospect and Veteran published odds are set to what the world can deliver (young Golds and old Elites are scarce); a thin band falls back to lower rarities so a pack never has fewer players than promised.
- Hub shows owned staff levels. Staff, tactic, trait, style, training and consumable cards all apply (tools/check-packs.js, 26 checks).

- Supporter crowd noise (done): real recordings from Gregor Quendel's Free Crowd Cheering Sounds (CC BY 4.0, credit shown on the new-game screen and in src/assets/sounds/LICENSES.md). crowd_roar plays on goals (with applause after it), crowd_soft is the kickoff and pack-walkout swell. Cut losslessly with tools/mp3cut.js (5 s each, about 200 KB). Real ball, post and tackle sounds now play on match events (throttled). dist is 2.6 MB. No real whistle or horn exists yet. The other 9 tracks (soft cheering, rhythmic cheering, ambience, a 3.7-minute full recording) are in the scratchpad download only; they could add a looping stadium ambience bed or chants later.

- Squad view shaking: real cause found and fixed. The pitch ResizeObserver re-ran layout on its own height change and flipped between two sizes forever (heights 599/593). Layout now re-runs only when stage width or window size changes (squad.js relayoutIfNeeded). Verified: 2 observer callbacks then silence. Cards are still only about 80 px wide at 1920x1080 (pitch width is height-bound): the user asked for bigger cards, consider a larger pitch or a flatter perspective next.
- Cheat menu keys now: F2, the key left of 1 (backtick or the 2-superscript key on AZERTY), Ctrl+Shift+K, Ctrl+Alt+C, or click the logo 5 times.

- Bigger squad cards (done): the pitch height budget was read from a CSS clamp() custom property as a number (always NaN, fell back to 640), so the pitch never grew with the window. Now computed in JS from the window height (squadPitch.js), pitch angle 35 to 27 degrees, more overlap allowed, plus a Card size slider in the squad header (localStorage touchline.cardScale). Measured after a rendered frame: 1920x1080 cards about 128 px (was 76), 1366x768 about 108 px; on a 768-high laptop the goalkeeper row sits below the fold (scroll). NOTE for testing: the preview pane only renders frames when a screenshot is taken, so measure after a screenshot.

- Goalkeeper always visible without scrolling (done): relayout shrinks the pitch until the lowest card plus its label fits the window height. Measured: 1920x1080 cards 127-131 px, 1366x768 about 80 px, 390x844 about 73 px. tokens.css reduced-motion rule now disables transitions and animations outright (a 0.01 ms duration still started layout transitions that made geometry reads stale; users with OS reduced motion would have seen cards bunch up).

## In progress (2026-10-12)
- 5-level league pyramid replacing the mini league (user request). Contract written: balance.js LEAGUE_SYSTEM (real club counts and rules: ENG 20/24/24/24/24, ESP 20/22/20/20/20, ITA 5x20, GER 18/18/20/20/18, FRA 18/20/18/16/16; 3 points; tie-breaks; automatic promotion + 4-team playoffs; relegation; bottom level exchanges with background clubs; my club starts at level 5). An engine agent (world generator, league logic, promotion/relegation, playoffs, economy, tests) is building it; the UI (country/level tabs, promotion zones, playoff view, season summary, sim controls, other-leagues screen) is the NEXT step once its API report is in. World sizes become 30k/50k/100k (500 clubs x 26 players = 13k players in playable clubs).

## Open requests from the user (not done)
- Verify visually: the new time-lapse cut in the match view (pixel check did not catch a cut in the throttled pane), the squad screen after the blur fix at the user's real screen size.

## Known gaps and review leftovers
- Phase 2: IndexedDB save/export/import, development/ageing/retirement/regens, 5 countries x 3 divisions, cup, market, contracts, fitness persistence beyond a match, other-leagues and player-database screens, 40-season world sim, bot.js economy report
- Match view: Opponent / Tactics / Settings buttons are no-ops; substitutions only at half-time; spacing metric "defender who just shot or passed" is 1.67 per match in full mode (target < 1)
- Card visuals agent never delivered its own final report (screenshots exist in tools/demos/cards)
- Review minors: choreography QUAL_BY_XG infers chance quality from xG thresholds; engine and cardEffects have two keeper-outfield conversions; ui/components/modal.js missing from the required layout; cross-engine determinism of Math.log/cos in generation is unverified
- Sounds: 28 real CC0 samples in src/assets/sounds (see LICENSES.md), synth kept only as fallback; Safari may not decode Ogg
- Dev tool strings (cheat menu, half-time and touchline text) may still be inline English

## League pyramid (engine and UI done 2026-10-12)
- What changed: the 6-club mini league is gone. 5 countries x 5 levels from balance.js LEAGUE_SYSTEM (500 clubs, ids 0..499 by country, level, index; club.division = level, 0 = background). Real rules: 3/1 points, double round robin (2(n-1) matchdays), per-country tie-breaks (h2h = mini table of the still-tied clubs, then the next criterion, club id as last resort), automatic promotion + 4-team playoff (two-leg semis 1v4 / 2v3, higher seed hosts leg 2, one-match final at the better seed, level after 90 min / aggregate = seeded rating-weighted shootout, PYRAMID.penalties), relegation = promoted count of the level below, level 5 swaps the same count with the country's strongest background clubs (world.clubRating). My club (MY_CLUB_ID 0xfffe) replaces the weakest level-5 club of my country at game start (that club goes to the background) and never drops into the background: if it finishes in the level-5 exit zone the next club up leaves instead.
- One round = one matchday in all 25 leagues (shorter leagues finish earlier). Other fixtures use the lite engine, seeds from state.seed + season + round + club ids. AI MatchTeam selection is cached per club (aiTeams.js, invalidated by world.rosterVer / world.epoch). Stats (tstats / pstats) are recorded for every league.
- Modules: logic/season.js (tables, sortLeague with tie-breaks, penaltyShootout, leagueKey, levelRules, promotedFrom, relegatedFrom, myLeague, myLeagueKey), logic/pyramid.js (initialMembers, startPyramidSeason, playRound, beginPlayoffs, stageFixtures, myPlayoffFixture, recordPlayoffLeg, playPlayoffStage, settle, finishSeason, membershipIssues, clubLabel), logic/aiTeams.js (pickAIXI, buildOpponentTeam, awayColours, teamXiRating; re-exported by game.js), world.setClubDivision(id, level).
- game.js API for the UI: nextMatchInfo (phase 'league' | 'playoffs', playoffStage 'semi1' | 'semi2' | 'final'), prepareMatch / applyMatchResult / playInstant (moves the whole pyramid), simRounds(state, world, n), simToSeasonEnd(state, world), newSeason(state, world), leagueRows(state, world, key?), myLeague(state), myLeagueKey(state), myLeagueInfo(state), clubName / clubRecord. main.js actions: 'season/next', 'season/simRounds' {n}, 'season/simToEnd'.
- State shape: state.season = { number, country, level (this season's level), phase 'league' | 'playoffs' | 'done', complete, summary, pyramid }; pyramid = { season, round, rounds, order, leagues{key: League}, playoffs{key: Playoff} | null, playoffStage, outcome{promoted, relegated, exchangeOut, exchangeIn, champions, playoffWinners} | null, nextMembers }. season.division and season.league no longer exist. summary / history: { season, country, level, position, points, prize, champion, championId, promoted, relegated, playoff 'won' | 'lostFinal' | 'lostSemi' | null, newLevel } (summary also has rows). Save JSON is about 1.7 MB after a season (25 leagues of results + player stats).
- Economy: matchIncome({ ..., level }) and leaguePrize(pos, n, level) use LEAGUE_SYSTEM.incomeMultByLevel (COINS.divisionMult removed). World: sizes 30k / 50k / 100k (WORLD.minPlayers 30,000); every pyramid country keeps >= 12 background clubs (GEN.minBackgroundClubsPlayable) and enough home-nation quota for 65% home players at 30k.
- Checks: `node tools/check-league.js` (53 checks, about 3.5 min at 50k; `--quick` = 3 seasons), check-world at 30k / 50k / 100k (106 / 106 / 103), check-game 23, check-cheats 12, check-packs 26, check-squad 119, check-shouts 8, check-cards 128, check-names, sim.js --n 3000 unchanged, build OK.
- Timings (this machine, 50k): round of all leagues median 112 ms, max 136 ms, cold first round 143 ms; full season about 4.6-5 s; 499 AI team builds and about 18,900 cache hits per season. Browser: 38 instant matches of a Spanish season in 4.4 s.
- Known weak spots: (1) fitness: FIXED: recovery is now balance.js recoverFitness (flat 8 + 45% of the missing points per matchday); a full match drains about 29, an unrotated XI now settles at about 85 before kick-off over a 46-match season (measured). (2) Veteran pack delivers gold 43.7% vs 54% published (was 50.5%): old golds now sit in pyramid clubs. (3) The bottom-level exchange count equals level 5's promoted count (the LEAGUE_SYSTEM comment mentions an `exchange` key that does not exist). (4) simRounds lets an outfielder play in goal when no keeper is available (otherwise injuries and bans never tick down); the normal match flow still refuses with "No available goalkeeper".
- UI done (ui/league.js): sim bar (1 / 5 / 10 rounds, to season end; my matches are played instantly), country and level tabs for all 25 leagues, table with promotion / playoff / relegation zones (zoneOf), results by matchday, playoff bracket (projected seeds before it starts), season review tab (champions, promoted, relegated, background exchange, my movement), next-season button. Hub: Simulate 5 rounds / to end of season, Season review button. Stats history has level and movement columns. Verified in the browser (Spain, 30k, full season, playoffs, next season, no console errors). Not done: playoff match 2D view check, per-league stats screen for other leagues (leagueStats accepts a league), player database screen.
