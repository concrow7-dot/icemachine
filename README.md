# Ice Machine

An ice cream truck video game: a 2D browser game about running an ice cream truck for an evening. Stock the cooler, drive the neighbourhood, serve customers at the window (memory and maths), avoid potholes and parked cars, and beat your high score.

**Play:** https://concrow7-dot.github.io/icemachine/

Built in the open as a product management case study. The product owner (Conor Crowley) decides what gets built and why; an AI engineering team (Claude) proposes, builds and tests. Every decision, with the reasons behind it, is written down.

## Modes

- **Tutorial:** one evening on a small map, guided by your uncle, who dropped a box of ice cream on his foot and needs you to run the truck. New players play this first.
- **Quick play:** one evening in Worcester, MA, on real streets.
- **Story:** a 3-day run saving up for a $200 bike. Your money carries over; the game saves in your browser.

## How this project works

- **Tickets** live in Jira (project SCREAM). Stories are features that need discussion; tasks are small, clear items. Each sits under an epic.
- **Decisions** are recorded in [`docs/decision-log.md`](docs/decision-log.md), newest first: what was decided, the options considered, the product owner's reason, and engineering's own calls (labelled as proposals, never as the PO's reasons).
- **Every change** is a branch (`feature/SCREAM-NN-short-name`), a pull request, and a test plan the product owner runs by hand before merging. Pull requests are type-checked and built automatically.
- **Every merge to `main`** builds and publishes the game to GitHub Pages within a few minutes.
- **Playtests** run in rounds with a feedback form; the results feed the backlog.
- **Devlogs** tell the story milestone by milestone, in the product owner's voice.

Test plans, playtest results, product decision documents and devlogs live in Google Drive. The decision log in this repo is the canonical record of what was decided and why.

## Run it locally

Requires Node.js 22 (LTS).

```
npm install
npm run dev
```

Then open the address it prints (usually http://localhost:5173).

Browser tests (Playwright, headless Chromium): `node tests/e2e/run.mjs` runs every suite, `node tests/e2e/run.mjs feel drive` just those. See [`tests/e2e/README.md`](tests/e2e/README.md).

## Tech

[Phaser 4](https://phaser.io) game engine · [TypeScript](https://www.typescriptlang.org) · [Vite](https://vite.dev) build tool · GitHub Pages hosting · [Playwright](https://playwright.dev) browser tests.

The map is built from real [OpenStreetMap](https://www.openstreetmap.org) street data for Worcester, MA (`tools/worcester`), and the tutorial map is laid out by hand in [Tiled](https://www.mapeditor.org) (`tools/tiled`).

## Art and music

Map, truck and people use [LimeZu](https://limezu.itch.io)'s Modern Exteriors and Modern Interiors pixel art packs (paid licence; only the pieces the game uses are in this repo, see `public/assets/limezu/README.md`). The truck interior, cooler and sales window are the product owner's own hand-drawn cartoons. Credits tune: "Ice Cream Truck" by Travis Morgan, SoundEffectsFactory.com (see `public/assets/audio/README.md`).
