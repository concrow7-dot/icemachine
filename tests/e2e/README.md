# Browser tests

11 suites, 341 checks, that play the game in a headless Chromium (Playwright) and
check what happens: driving feel, the map, obstacles, customers, the truck hub,
selling, the cooler, high scores, pause, and the one way to drive.

```
node tests/e2e/run.mjs              # every suite
node tests/e2e/run.mjs feel drive   # just these
npm run test:e2e                    # same as the first line
```

The runner builds the game into `.run/` (TypeScript types stripped, no bundler),
serves it on port 8766 (`E2E_PORT` to change), runs the suites and prints each
failed check. Screenshots land in `.shots/`. Both folders are ignored by git.

## Needs

- Node 22 or later (for `stripTypeScriptTypes`).
- Playwright with Chromium. It's pre-installed in Claude's workspaces; elsewhere
  `npm i -D playwright && npx playwright install chromium`.
- Phaser's browser build: from `node_modules` after `npm install`, or, when npm
  can't reach its registry, from the private art repo cloned next to this one
  (`../icemachine-art/tooling/phaser-4.2.1/`).

## How they're written

- Each suite drives the real game through `window.__game` and checks results with
  `check(name, got, want)` and `near(name, got, low, high)`.
- `track.cjs`: driving-feel checks run on a test track, the old grid map's straight
  120 px roads, swapped in for the Worcester map so speeds and stopping distances
  are measured on level, straight road. Map checks use the real map.
- Checks are written to pass on a slow machine (about 20 fps without a graphics
  card): they compare speeds rather than wall-clock distances, and wait for screen
  changes instead of sleeping for a fixed time.

## Rotation (to save time)

Run the suites that touch the changed code plus a third of the rest, rotating.
Run everything for big or risky changes.
