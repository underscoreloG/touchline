# Touchline

Single-player browser football card manager. Open a pack, build a squad, set tactics, and climb a 5-level league pyramid across 5 countries. Everything runs offline in one HTML file. All people, clubs and sponsors are fictional.

Play: https://underscoreloG.github.io/touchline/

Status: playable demo. There is no save game yet, so progress is lost when the page reloads.

## Build

    npm ci
    node tools/build.js      # writes dist/index.html (standalone, about 2.6 MB)
    node tools/serve.js 5400 # then open http://localhost:5400/dist/index.html

Checks: `node tools/check-league.js`, `check-game.js`, `check-squad.js`, `check-packs.js`, `sim.js --n 3000`. See `HANDOFF.md` for the design notes and open work.

## Credits

Sounds are real recordings: Kenney (CC0), qubodup (CC0) and Gregor Quendel's Free Crowd Cheering Sounds (CC BY 4.0). Details in `src/assets/sounds/LICENSES.md`.
