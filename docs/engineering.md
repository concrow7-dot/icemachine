# Engineering notes

How the code is laid out and the things you need to know before changing it. Kept here, next to the code, so it stays in step. The product side (what we're building and why) is in the decision log and the project brief.

## How the code is laid out

- `src/scenes/`: Title (Quick Play, Story / Continue / New Story, Tutorial last; locked modes dimmed until the tutorial is finished), StoryIntro, Truck (hub; the PO's drawing with clickable parts), Cooler (prep and restock at home: clipboard with picture add buttons, three 4 x 4 crates, Today's Menu), Drive, Pump, Sales (window, calculator, mini Today's Menu, tip cup, picture orders), Fill (filling an order at the shut cooler: one crate lid open at a time, paper bag, SERVE), DayEnd, Results, Hud, Pause, Loading (`showLoadingWhileLoading(this)` at the end of preload), UncleIntro, TutorialCrawl.
- `src/state/`: EveningState (clock, money, stock, fuel, residents, the customer at the window; `mapId`; the cooler as `coolerSlots` (one per flavour) plus `coolerCells` (48 squares) kept in step by `syncCells()`; restock at home; `pinkSquareFitsOn`), CoolerOrder (the prep draft), Sale (one customer's order; `pictures` and `pictureLine` for picture orders), Residents (buyer kinds: `buyerKind`, `buysTonight`, `sometimesDay`), CurbFinder, RoadGeometry, AutoRoute (the truck driving itself), Tutorial (the uncle's steps and lines), PriceEntry, HighScores (tables quick, story, tutorial), Records, Damage, StoryRun (run `seed`), StorySave (saves the cells and the seed).
- `src/audio/`: Music and songs.
- `src/ui/`: Calculator, TipBar, speechBubble (`drawBubble`), flavourArt (`addFlavourIcon`, `MARKER_FONT` "Permanent Marker", `MENU_COLOURS`), residentLook (`residentsKey()` per map), truckLaps, smoothPixels, truckViews, truckInterior, uncleBox, unclePointer, mapOverview.
- `src/config/`: `tuning.ts` (every tuning number; change values here, not in scenes), flavours, gasStation (`gasStations()` for the current map), `maps.ts` (`MAPS`, `currentMap()`, `setCurrentMap()`), `tutorialRoute.ts`, and generated data (`worcester.ts`, `residents.ts`, `tutorial.ts`, `tutorialResidents.ts`; never edit by hand).
- `src/flow.ts`: scene keys and starting or continuing an evening; the Story run lives in the registry under `story`.
- `tools/`: Python build scripts. `worcester/build_map.py` (the Worcester map from OpenStreetMap data), `tiled/import_tiled.py` and `tiled/build_roads.py` (the tutorial map from the PO's Tiled project in the private art repo; roads from `tools/tutorial/roads.json`), `residents/build_residents.py` (from `residents.csv`; `tutorial` for `tools/tutorial/residents.csv`, which has Windows line endings), `truck/build_truck.py`, `uncle/build_uncle.py`, `interior/` and `flavours/` (the PO's cartoon screens and the flavour pictures, drawn at 2x in a wobbly hand-drawn line). The LimeZu singles are the zip in the art repo, unzipped. Worcester rebuilds byte for byte.

## Maps

- `EveningState`'s constructor takes a `mapId` (default `worcester`) and calls `setCurrentMap`; everything else reads `currentMap()`. DriveScene switches map in preload (`useMap`). `startEvening(from, map, guided)`.
- Texture keys: Worcester `map-atlas`, `map-grass`, `map-roads_x_y`, `residents`; tutorial `tut-atlas`, `tut-grass`, `tut-roads_x_y`, `residents-tutorial`. The pump screen always uses Worcester's atlas (it has the pump). Smoothed customer textures are `customer-smooth-<sheet key>-<look>`.
- The map is painted round the camera into one image, repainted per 512 px square. Map sprites are 16 px. With the 1.2x zoom, on-screen labels in DriveScene go through `pin()`. `render.maxTextures` is 1 in `main.ts`.
- The tutorial map is edited only in Tiled by the PO (everything but roads); `build_map.py`'s tutorial mode would undo his changes. Street data for new areas comes from the OpenStreetMap API (the cloud workspace can't reach openstreetmap.org; fetch it in a browser: open `api.openstreetmap.org/api/versions`, then `fetch('/api/0.6/map?bbox=...')` in its page and return a trimmed JSON).

## Residents and customers

- 16 x 32 frames; `residents.png` five looks across; front-to-back drawing via `occluders`; depth 5 + y/10000; the truck is 10. At the window the customer is cropped with `setCrop`.
- `Residents.update(dt, ring)`: the ring's centre is the truck's position. States none → running (walking to the truck, plan `follow`) → waiting → window → done. `new Residents(list, rnd, curbs?, story?)`: without a `CurbFinder` they run to their own curb spot (unit-test style); `story` is `{ day, seed }` and picks each one-in-3 buyer's day. `p.buys` says whether they'd buy tonight; `p.decided` once they've heard the truck 30 s without coming. `Residents.chance(heard, likelihood, indoors, regular?)`. Each person's pink square is `p.pickup`.
- Curb spots: `CurbFinder.near(x, y, taken, gap, around?)` tries the nearest street first (150 px, same side), then `further` (400 px along every street within reach, both sides); every stand must pass `standClear` (on the sidewalk) and be within `around` (the truck, 240 px). `Residents.joinSpot` lets a customer share a waiting spot (`spotStand`); DriveScene draws one square per spot and only for customers off the road. The residents build's `curb()` mirrors the game's pink-square check (CAR_CLEAR 80, BAY_CLEAR 100, home, road index).
- Test hooks: `residents.hearingOff`, `residents.callNow(person)` (works on anyone; waits at their own curb and doesn't follow), `residents.wantIceCream(person)`, `Residents.kind`, `Residents.buysTonight`, `DriveScene.pickupZone`, `e.residents.curbs` (`finder.squareFits`, `finder.roads`). Camera lerp: wait about 2.5 s after teleporting the truck in tests.
- Order sizes: sheet 23's optional "Order size" column → `Resident.orderSize` → `generateOrder(..., fixedSize)`. The build reads the column only if a sheet has it.

## Cooler, sales, fuel, music

- Cooler: `pickCell`, `putBack`, `bagContents`, `placeInCell`, `returnBagToStock` (one sync at the end). FillScene test hook `takeFlavour(flavour)`. CoolerScene `addButtons` (by flavour). Phaser container hit areas are offset: use a `zone` with `setOrigin(0,0)` for click areas.
- Picture orders: `evening.orderPictureChance` (tests set 0 or 1); `SalesScene.orderPictures` container, icons named `order-pic-<flavour>`.
- Marker font: loaded with `scene.load.font`; check it's loaded with `document.fonts.forEach` (`check()` returns true for unknown fonts).
- Fuel: `evening.fuel`, `burnFuel`, `maxGasCents`, `buyGas`, `fillUpCents`; `FUEL_` tuning values; pump bays `DriveScene.pumpBays`. The pump opens at $0 and fills to 100% rounded to 50 cents.
- Music lives in the registry (`musicFor(scene)`); mute saved under `icemachine.music.muted.v1`.
- Browser storage keys: `icemachine.story.v1` (the Story save, with `cells` and `seed`), `icemachine.tutorial.done.v1` (the tutorial finished; unlocks the other modes), `icemachine.music.muted.v1`, plus the high score tables.

## The uncle's tutorial

- `EveningState.tutorial` is a `TutorialRun` (only with the uncle on). The evening calls `tutorial.signal()` on setOff, customerAtWindow, salePaid, saleClosed, gasBought, pulledUp, orderHidden, stockBought, arrivedHome. Steps and lines are in `TUTORIAL_STEPS` (`src/state/Tutorial.ts`); lines can wait (`until`), point (`point`), gate the window (`gate`, `holdsWindow`), hold the sale's clocks (`hold`, `holdsSale`; `Sale.wait` also pushes the tip countdown) or give cash (`gift`).
- While he drives, DriveScene moves the truck along `AutoRoute` (`src/config/tutorialRoute.ts`: Westland St, Highland St, Park Ave into the pump bay; home again via `UNCLE_HOME_CORNERS`). `TutorialRun.legToDrive` / `uncleDriving` / `finishLeg`; no steering and `residents.hearingOff` meanwhile. The regular (Chloe Hogan, T008) comes out via `Residents.comeOutToOwnCurb` when the truck is within `REGULAR_CALL_DISTANCE`.
- `TitleScene.modesUnlocked()`: tutorial done, a saved Story, or any high score. Every e2e suite except tutorial sets `icemachine.tutorial.done.v1` with `page.addInitScript` so they start unlocked. The tutorial suite's SCREAM-169 section clears it.

## Debug keys (temporary)

Shift+1 +$4.50, Shift+2 −$2.00, Shift+3 end the evening (the only one shown on screen), Shift+4 start a sale, Shift+5 show the loading screen. They are live on the public site too.

## Tests

- `tests/e2e/`: 16 Playwright suites (`feel drive obstacles extras customers hub sales buy scores pause oneway story residents fuel home tutorial`), about 750 checks. `node tests/e2e/run.mjs [suite ...]`; the runner prints PASS/FAIL lines and only the last 8 lines of a crash; screenshots go to `tests/e2e/.shots`. See `tests/e2e/README.md`.
- Rotation: run the suites that touch the changed code plus a third of the rest; everything for big or risky changes. A PR that changes on-screen text, how many customers come, or the title menu can break checks in any suite: run all suites then.
- Known flaky timing checks: pause patience, extras hit popup, obstacles pothole / road edge / damage popup (pothole "stops on the pothole" also fails on main), feel coasting (fails on main in the cloud workspace), buy's "B returns to truck" (Loading still showing), pause's "Paused at the sales window: the customer's patience stops too" (fails on main, off by one). Rerun alone before worrying.
- The test harness strips TypeScript types without compiling: no constructor parameter properties.

## Working in the cloud workspace

- Clone both repos side by side (`icemachine` and the private `icemachine-art`); `npm install --no-save --no-package-lock` (or the fallback Phaser in `icemachine-art/tooling/phaser-4.2.1`); `npx tsc --noEmit -p .`. Don't commit `package-lock.json`.
- Pushing needs the repo attached with push access; set the fetch refspec and `git push -u`. PRs are opened with `gh api repos/concrow7-dot/icemachine/pulls`.
- Before telling the PO a PR is ready: push everything, then don't push again without saying so. Check a PR's head commit against what was pushed last before marking its ticket Done (PR #117 was merged one commit early).

## The PO's setup

Windows, PowerShell in VS Code, tests in Chrome or Edge. For a new branch: `git fetch`, `git checkout <branch>`, `git pull`. If commands don't go in, `npm run dev` is holding the terminal: Ctrl+C first, then `npm run dev` again and Ctrl+Shift+R in the browser. Saying "git pull" is enough; he knows the routine.
