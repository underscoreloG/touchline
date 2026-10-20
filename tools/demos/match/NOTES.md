# 2D match view: frame strips and critique

Demo: `http://localhost:5400/tools/demos/match/out.html?seed=2&manual=1` (build command in `demo.js`).
Strips were captured in the browser pane with `window.__demo.seek(...)` then `window.__game.step(500)` between
frames (one frame every 0.5 s of real time at x1). Images are in `screens/` (`<strip>-<n>.png|jpg`).
Pitch zoom crops only; the last frame of the goal strips is a full-page screenshot with the HUD.

## Round 2 (after the pacing and spacing fixes): re-captured strips

What changed since round 1:
- **Highlights** (the default) shows only goals, penalties, cards, injuries, kick-offs and whistles, and chances
  with xG >= 0.10 or on target (save). Everything else is a 0.3 s clock fast-forward per tick; its events still
  reach `onEvent`, so live stats stay complete.
- **Both modes are "broadcast pace"**: every chance starts with a short fade cut a few seconds before the shot.
  - Short form for every non-goal, non-big chance: 2-3 steps, about 2-3 s. Low-xG efforts are shown as the
    shooter's own touch and shot.
  - Goals and big chances keep the full chain and the celebration.
  - A pace budget (highlights about 1 s per match minute, full about 2 s) shortens big chances when a match runs
    long.
  - Full mode no longer shows goal kicks, keeper distributions, free-kick or offside restarts.
  - Counter-attacks: when the opponent has the ball in midfield, the chance is played continuously (tackle or
    interception, forward carry, the assister sprints forward).
- **Spacing**: separation steering, wider gaps near the ball and a 2.5 s stronger separation after every set piece.
  Cut carriers are midfielders (never a centre-back). A fouled back-line player is caught in his own zone. Discs
  are never pushed more than 1.2 m past a line.
- **390 px**: the view sizes the pitch from the viewport, so the control row (now one row) is always on screen
  (`screens/controls-390-1.jpg`: control row bottom at 466 px of 844).

### Open-play attack v2 (`screens/openplay-v2-*`, seed 6 log, full mode, 48', home blue attacking left, big chance blocked)
Frame 1 is the fade cut. Then the shooter is on the ball in the box, the red block is all back (6 defenders in
or near the box), the blocker steps into the line and the shot is charged down (frame 8).
Honest critique: it reads as football, but it is a short scene, not a build-up. Blue has only 2-3 players near
the box and the shooter holds the ball for about 1 s while the blocker gets into place. The box is crowded but
nobody is on top of each other.

### Counter-attack v2 (`screens/counter-v2-*`, seed 6 log, full mode, 1', away red attacking left, goal)
Blue has the ball at the centre circle after the kick-off. Red wins it with a tackle (frames 1-3), carries
forward, then plays it wide to the right-back who sprints forward on the overlap (frames 5-8).
Honest critique: better than round 1 (no backward pass, the assister runs forward), but the break is still not
quick: about 4 s from the tackle to the wide ball. Blue players stay bunched around the centre circle for
1-2 s after losing the ball. Red has few runners: only the striker and the full-back break.

### Corner v2 (`screens/corner-v2-*`, seed 2 log, highlights, 28', away red attacking left, header saved)
Frames 1-2: the corner layout during the 0.6 s hold (taker at the top-left flag, attackers in the box, markers
goal-side, two zonal defenders). Frame 3: the cross. Frames 4-7: header, save, players leave the box and spread
out (no pairs stuck together). Frame 8: already the next highlight (cut).
Honest critique: the box group in the layout frames is still dense (8-9 discs in the 18-yard box is realistic,
but at this zoom they read as a cluster), and nobody jostles before the kick.

## Round 1 strips (before the pacing and spacing fixes)

## 1. Open-play attack (`screens/openplay-desktop-*`, seed 6 log, full mode, 20', home blue attacking right)

What it shows: blue keeps the ball around the centre circle, red is in a compact block (two banks, about 27 m
deep) shifted toward the ball, then a long ball over the top to the runner.

What was wrong (and what was done):
- The carrier stood almost still for about 2.5 s with 4-5 red players within 8 m while the pass lanes were
  blocked. Cause: no team-mate offered a short option. Fixed after this strip: `offerSupport` (Layer 2) puts the
  two nearest team-mates 11-15 m away in free space with a clean lane, and the planner turns away from pressure
  (`tTurn`) instead of waiting.
- Blue team-mates were spread far apart (wide in possession is right, but the nearest options were 20 m+ away).
  Same fix.
- Still weak: the build-up is "correct" but not rich, it rarely shows a give-and-go or a switch of play.

## 2. Counter-attack (`screens/counter-desktop-*`, seed 2 log, full mode, 12', home blue)

What it shows: frame 1 is a blank pitch (fade of a reset), the away keeper distributes, home intercepts in
midfield, then a long ball into the channel for the striker running in behind; the losing side sprints back.

What was wrong:
- The counter takes about 4 s to start (keeper hold + distribution + interception) before the break itself.
- Five blue discs bunched around the ball at the interception (pressers + support + carrier). Fixed after this
  strip: wider target gaps within 12 m of the ball (6.5 m) plus velocity separation steering.
- Red's shape right after losing the ball looks scattered: that is the transition rule (the side that lost the
  ball sprints back to its anchors for about 2 s), it reads as a broken team rather than a rehearsed retreat.
- Full mode no longer cuts away from a counter: the TV-style cut only happens when the opponent holds the ball in
  our own third.

## 3. Corner (`screens/corner-desktop-*`, seed 2 log, highlights, 21')

What it shows: fade into the corner layout, taker at the flag, five attackers in the box with markers goal-side,
two zonal defenders, the keeper on his line, one defender left up; the cross, the header, the ball goes wide and
players leave the box.

What was wrong (and fixed): in the first capture the box group overlapped heavily (eight discs on top of each
other at 390 px, where discs are enlarged to 14 px) and the strikers stayed at halfway. Box spots are now spread
out, markers stand 1.6 m goal-side, the header candidates prefer strikers and centre-backs.
Still weak: the two layout frames before the kick are static (1.2 s hold), which is fine for a dead ball but the
players do not jostle.

## 4. Goal (`screens/goal-desktop-*`, seed 6 log, highlights, 66', away red attacking right)

What it shows: cut to the assister wide near the byline, the shooter in the box, defenders back in the box;
cut-back to the shooter at the edge of the six-yard area on a tight angle (a 0.05 xG half chance, so the shot
comes from a tight angle, not from the penalty spot), shot, goal, celebration toward the corner flag, kick-off
reset.

What was wrong:
- The assister held the ball about 2 s near the corner flag before releasing, waiting for the runner. Partly
  fixed (the shooter starts nearer, the release check is stricter so the ball travels at pass speed).
- A first capture (seed 6, minute 1) showed a lofted through ball floating for 2.5 s: fixed (lofted balls no
  slower than 11 m/s; the runner is placed one step onside in highlights cuts).
- The ball at the carrier's feet was hidden under the disc (the disc is enlarged on small screens): the renderer
  now draws it just outside the disc.

## 390 px (`screens/goal-390-*`)

Discs are 14.4 px wide at 390 px (enlarged from 1.4 m), numbers legible, the name label and the commentary bar
stay readable, the top bar truncates long club names. The crops in this strip are cut too low (the pitch starts
lower on the phone page); the last frame (full page) shows the goal state: 1-0, ball in the net, goal and card
markers on the momentum bar.

## Overall honest verdict

Reads as football most of the time: shapes, back lines, keepers, set pieces and the goal sequence are right.
Weak points: holds before the final ball, occasional bunching right after set pieces, crowded duels near the
ball, and the full-mode pace (see the report).

## viz-check, 200 seeded matches (`node tools/sim.js --viz-check --n 200 --layer N [--highlights]`)

| rule (per match) | L1 full | L2 full | L3 full | L3 highlights |
|---|---|---|---|---|
| illegal pass | 14.84 | 15.83 | 0.005 (1) | 0 |
| offside pass | 7.80 | 6.92 | 0 | 0.005 (1) |
| wrong scorer / assister | 0 / 0.01 | 0 / 0.015 | 0 / 0.005 | 0 / 0 |
| wrong shot location | 0 | 0 | 0 | 0 |
| score, scorer or minute differs from engine | 0 | 0 | 0 | 0 |
| standing still > 2 s | 1.16 | 1.19 | 0.90 | 0.10 |
| swarm | 0.01 | 0.13 | 0.14 | 0.01 |
| defender ahead of midfield | 2.33 | 1.35 | 1.11 | 0.23 |
| same, defender just took part in the attack | 2.38 | 1.93 | 1.86 | 2.92 |
| team-mates < 3 m for > 1 s | 1.44 | 2.65 | 2.94 | 0.69 |
| keeper outside box / striker in own box | 0.07 / 0.01 | 0.07 / 0 | 0.07 / 0.01 | 0.01 / 0 |
| out of bounds, speed cap, free-floating ball | 0 | 0 | 0 | 0 |
| depth in / out of possession (m) | 36.4 / 28.5 | 39.0 / 31.5 | 37.7 / 31.3 | 38.4 / 32.3 |
| back-line x spread out of possession (m) | 3.1 | 4.3 | 4.2 | 3.6 |
| pass length short / mixed / direct (m) | 28.3 / 28.2 / 28.5 | 28.7 / 28.7 / 29.2 | 25.3 / 26.4 / 27.4 | 22.4 / 23.6 / 23.4 |
| animation per match at x1 (s) | 361 | 362 | 369 | 166 |

## Round 2 numbers (after the pacing and spacing fixes)

Pacing (`node tools/sim.js --viz-check --pacing --n 50`, seconds at x1):

| mode | before | after: mean | min | p10 | median | p90 | max | engine mismatches |
|---|---|---|---|---|---|---|---|---|
| highlights (default) | 166 | 89 | 53 | 61 | 87 | 118 | 128 | 0 |
| full (broadcast pace) | 369 | 177 | 138 | 152 | 176 | 202 | 223 | 0 |

viz-check, 200 seeds, layer 3 (per match; before / after):

| rule | full before | full after | highlights before | highlights after |
|---|---|---|---|---|
| illegal / offside pass | 0.005 / 0 | 0 / 0 | 0 / 0.005 | 0 / 0 |
| wrong scorer, assister, location, goal line, save | 0.005 (assister) | 0 | 0 | 0 |
| score, scorers or minutes differ from the engine | 0 | 0 | 0 | 0 |
| team-mates < 3 m for > 1 s | 2.94 | 0.85 | 0.69 | 0.33 |
| defender ahead of midfield | 1.11 | 0.56 | 0.23 | 0.12 |
| same, defender who just took part in the attack | 1.86 | 1.67 | 2.92 | 1.09 |
| standing still > 2 s | 0.90 | 0.10 | 0.10 | 0.03 |
| out of bounds, speed cap, free-floating ball | 0 | 0 | 0 | 0 |
| depth in / out of possession (m) | 37.7 / 31.3 | 37.9 / 31.6 | 38.4 / 32.3 | 38.5 / 31.9 |
