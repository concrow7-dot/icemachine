# Decision log

Newest first. Each entry: what was decided, the options considered, and why.

## 013 — The story: save up for a $200 bike, 3 days, its own high scores (2026-10-31)

**Decision:** Story mode has a goal: the player is saving up for a new bike that costs $200 before school starts (Jira SCREAM-18). A new run opens with a plain text intro screen; the top bar shows the bike's price during the run. The run is 3 days for now (decision 011), then it ends: the last day's screen says whether you can afford the bike, then a results screen shows the whole run's stats and a Story top-5 table, separate from Quick play's. After that you start a new game from the title. The bike price is `BIKE_PRICE_CENTS` in `tuning.ts`.

**Options considered:**
- *Length:* 21 days (the original idea) or 3 to start.
- *Reaching $200 early:* end the run with a win, or play on to the last day.
- *Story text and art:* engineering drafts it, or the PO writes it.

**Why (product owner's rationale):** answered on October 31. The goal is a new bike, $200. 3 days for now, "to keep it easier to test and build". At the end you see your stats and compare Story high scores, then start a new game. The PO writes the story and provides the art himself (SCREAM-76, under SCREAM-6); plain text screens until then. Why school as the deadline: the PO drove an ice cream truck as a summer job in high school, and ice cream trucks mostly make their money in the summer, so the start of school is a natural countdown to the end of it. It gives the game a little story. Why a bike: cheap enough that a high school kid would really work towards it. He considered something like a PlayStation, but plans to build the story out more later, so the bike is a quick goal for now.

**Engineering's calls (proposals, not the PO's reasons):**
- The Story score is the cash at the end of the run. Reaching $200 early doesn't end the run.
- Game over (out of money) doesn't go on the Story table.
- The intro text in the game is engineering's placeholder, marked as one on screen.

**Revisit if:** the PO's own text arrives (SCREAM-76), the story is built out further (the goal may change), or the run grows towards 21 days.

## 012 — Story mode is saved in the browser, at the end of each evening (2026-10-31)

**Decision:** A Story run is saved in the browser, the same way high scores are (decision 004): no accounts, one save slot, and clearing the browser's data loses it (Jira SCREAM-17). The game saves automatically at the end of each evening, so quitting mid-evening means replaying that evening. With a save, the title screen offers "Continue story" (showing the day and the cash) and "New story"; New story asks first, and only the Y key confirms. The save is cleared when a run ends (the last day, or game over). Quick play never touches the save.

**Options considered:** save at the end of each evening, or also mid-evening; one slot or several; accounts or the browser only.

**Why (product owner's rationale):** the PO accepted engineering's proposal on October 31, mostly following engineering's lead because it was the simpler option. In his words, saving mid-evening "didn't seem all that important", and it "adds a wrinkle for the player to manage".

**Engineering notes:** saved under `icemachine.story.v1` (`src/state/StorySave.ts`): the next day, the cash and the cooler. A save that can't be read (damaged, or from a future format) is ignored rather than crashing the title screen.

**Revisit if:** runs get long (21 days) and replaying a whole evening after quitting feels harsh.

## 011 — Two modes: Quick play and Story, with a wallet that carries over (2026-10-31)

**Decision:** The title screen offers two modes (Jira SCREAM-19, SCREAM-21). Quick play is the one-evening game as it was, with its $50 start and its high score table. Story is a run of evenings in a row: it starts with $100, and the cash and the ice cream left in the cooler carry from one evening to the next. Leftover ice cream keeps overnight. Running out of money is game over. A run is 3 evenings for now (decision 006, SCREAM-65), growing to 21 later; the number is `STORY_DAYS` in `tuning.ts`.

**Options considered:**
- *Modes:* make the whole game multi-day, or keep the one-evening game and add Story beside it.
- *Length:* start at 21 days, or with the 3-day loop and extend it later.
- *Leftover ice cream:* keeps overnight, or some melts.
- *Running out of money:* can't happen (you just can't spend what you don't have), or game over.

**Why (product owner's rationale):** answered on October 31. Keep Quick play as it is and add Story beside it. 3 days first, "to keep it easier to test and build", then extend it later. $100 to start. Leftover ice cream keeps, for now. You can run out of money, and then it's game over. Why game over rather than carrying on in debt: the PO thinks it's a fun mechanic that makes players more careful with their driving and their spending. It also leaves room for power-ups he plans to add: if players could go into debt, they could buy every power-up.

**Engineering's calls (proposals, not the PO's reasons):**
- "Out of money" means: at the end of an evening, cash is below $0, or the cooler is empty and you can't afford even the cheapest ice cream ($1). During an evening you keep playing below $0, since you can still sell.
- Between evenings an end-of-day screen shows tonight's takings, the wallet and the ice creams left. Story evenings don't go on the Quick play high score table.
- Restart evening (pause menu) in Story puts the cash and stock back to how that evening started; Quit ends the run (until saving arrives, SCREAM-17).

**Revisit if:** runs feel too easy or too hard once they're longer than 3 days, once fuel (SCREAM-22) costs money each evening, or when power-ups are priced.

## 010 — One way to drive: Easy mode removed (2026-10-30)

**Decision:** The game has one way to drive: car-style, with gas, brake/reverse, steering and a park brake (the old Hard). Easy mode is gone, along with the difficulty choice on the title screen; the arrows pointed the way in Easy. The title now shows the controls. There's one high score table: the old Hard table, so those scores carry over. The Easy table is no longer shown. (Jira SCREAM-53.)

**Options considered:** keep both difficulties, change Easy (on the Worcester map it became "arrows point the way, two together go diagonal"), or remove it.

**Why (product owner's rationale):** removed "based on more feedback" from playtesting. *(The details of the feedback to be added.)*

**Engineering notes:** the title, the evening state, the high scores and the results screen no longer know about difficulty. `icemachine.difficulty` and `icemachine.highscores.easy.v1` stay in players' browsers but aren't read.

**Revisit if:** new players find car-style driving too hard to start with. A short driving tutorial (SCREAM-5) would be the first thing to try.

## 009 — The Worcester map: real streets at their real angles (2026-10-30)

**Decision:** The driving map is the real neighbourhood bounded by June St, Pleasant St, Park Ave and Chandler St in Worcester, MA, with real street names (Jira SCREAM-10). Street shapes come from OpenStreetMap, simplified into straight segments that keep their real angles. The map is about twice the size of the old one: two 60 px lanes per road as before, 6,242 x 5,178 px. Houses, trees and grass are LimeZu sprites at the pack's 16 px size. Home is on Longfellow Road, in the middle of the area (engineering's proposal, confirmed by the PO on October 30). Credits for OpenStreetMap ("Map data © OpenStreetMap contributors") and LimeZu are on the title screen, with the OSM credit also in a corner of the driving view.

**Options considered:**
- *Map shape:* roads straightened onto the tile grid (first choice) against roads at their real angles. On the grid, this area's diagonal streets (June, Pleasant, Chandler and many inside) became staircases, shown side by side in small and big steps.
- *Scale:* keep about 20 s across, about 40 s (twice as big), or real scale.
- *Street names:* real, or changed slightly.
- *Street data:* the PO exports it from openstreetmap.org, or the workspace fetches it (the workspace couldn't reach the site, so the PO exported it).

**Why (product owner's rationale):** answered in the session on October 30. Real street names. About 40 seconds across rather than 20 or real scale. Simplified for driving. Then, after seeing the staircase layouts: angled roads, with the more work they need. Why Worcester and real streets: the PO sold ice cream on these streets, and using a real place lets him draw on that experience so the neighbourhood feels real. Home on Longfellow Road: a good central location.

**Engineering notes:**
- "On the road" no longer uses tiles: every point round the truck's outline must be on the asphalt (`src/state/RoadGeometry.ts`).
- Easy driving (removed since, decision 010): the arrows point the way, and two arrows together point between them (diagonals), so angled streets can be driven. The first version also followed the road by itself; the PO took that out after playtesting PR #80: "they should have to steer in all the directions".
- Street corners are rounded (PO, testing PR #80: some corners were too sharp). The generator rounds every inside corner with a 48 px radius and draws the road surface as images; the road edge is read from a map made from the same shape, so the curb you see is the curb you hit.
- Grinding along a curb you're already touching isn't a new hit: on slanted curbs the truck creeps along them, and it used to be charged again every 0.4 s.
- The ground, roads, potholes, parked cars, houses, trees and names round the camera are painted into one image, which is repainted when the camera moves into a new 512 px square. Drawing 2,000 houses and trees separately every frame was about 3x slower than the old map; painted, it runs faster than the old map.
- The map is generated by `tools/worcester/build_map.py` from the OSM extract in `tools/worcester/worcester-osm.json` (ODbL) and the private LimeZu pack. It's rebuilt by running the script, not by editing `src/config/worcester.ts`.

**Revisit if:** the PO wants Home somewhere else, or more of Worcester.

## 008 — Art from a paid pack, kept out of the public repo (2026-10-30)

**Decision:** The game's art comes from LimeZu's Modern Exteriors pack (48x48), bought by the product owner. The full pack lives in a private repository (`icemachine-art`); only the individual sprites the game uses are copied into this public repo, under `public/assets/limezu/`. LimeZu is credited on the title screen. The first piece is LimeZu's ice cream truck beside the title. The pack only draws it side-on, so the top-down driving truck is drawn in code in its colours. (Jira SCREAM-6.)

**Options considered:**
- *Simpler route (chosen):* commit only the sprites in use to the public repo.
- *Build-time pull:* the build fetches art from the private repo, so no pack files are ever in the public repo. More setup (a deploy key and a build step).
- *Driving truck:* the side-on truck on screens with a matching top-down truck for driving (chosen), a 4-direction pack vehicle snapped to 4 directions, or keeping the placeholder.

**Why (product owner's rationale):** the simpler route fits the licence, which allows use in open-source projects on GitHub but not redistributing the pack itself, so single sprites used in the game are fine while the whole pack stays private.

**Revisit if:** the game uses so many sprites that the public folder starts to look like a copy of the pack.

## 007 — Prices are entered on a calculator, typed left to right (2026-10-30)

**Decision:** The price at the sales window is entered on an on-screen calculator in the middle of the window: a large display with the $ on the left and digits right-aligned, the number keys 7–9, 4–6, 1–3, 0, 00 and ".", plus C, back and CHARGE keys. Typing works like a calculator, left to right: 7 . 2 5 is $7.25, and with no decimal point the number is whole dollars (7 is $7.00). Keyboard and mouse both work and can be mixed. (Jira SCREAM-12; doc 28.)

**Changes:** cash-register typing from PR #38 (digits filled from the right, so 725 read $7.25) and the whole-dollars click from PR #40 (removed).

**Options considered (doc 28):** an on-screen number pad, counting out bills and coins (Supermarket Simulator style), tapping each item to build the total, or a different method per difficulty.

**Why (product owner's rationale):** the key needs are quick, easy money entry that works with typing and/or the mouse. The PO likes the Supermarket Simulator style, but it's too complex for this early in the game, so it's in the backlog at the lowest priority (SCREAM-50).

**Revisit if:** playtests show the calculator slows sales down, or when the art epic makes bills and coins possible.

## 006 — The 3-day calendar becomes the extended game's beta (2026-10-30)

**Decision:** The short 3-day calendar is no longer a P1 item of its own. It moves into the *New game mode: extended game* epic (Jira ICE-9, low priority) as that mode's beta: a 3-day experiment before the full 21-day summer. Tickets that assumed the calendar (carry cash, fuel, save, intro story, two game modes, game over) build on that beta. (Jira ICE-34, formerly GitHub #53.)

**Changes:** decision Q3 in *18 - Next Phase Discussion*, which put the short calendar in P1.

**Why (product owner's rationale):** "I cut the 3 day calendar, but I probably should've merged it. Maybe the beta version of the 21 days is a 3 day experiment." It was cut outright in the mid-P1 prioritization session, then folded into the extended game the same night.

**Revisit if:** the extended game moves up in priority, or the beta shows a multi-day run isn't fun.

## 005 — The clock waits while you stock the cooler (2026-10-30)

**Decision:** Each evening opens straight at the cooler with the clock stopped at 5:00 PM. The clock starts when you leave the cooler for the first time. Later trips back to the cooler still cost daylight. (Issue #66.)

**Added while testing PR #70 (product owner's request):** the player can't leave the opening cooler until at least one ice cream is bought; B and an empty Buy Stock show a warning instead.

**Changes:** the pitch's rule that the clock starts at 5 PM and never stops, so that even the first stock-up cost time.

**Why (proposed by engineering; product owner to confirm or replace):** the opening stock-up is setup, not play. Starting at the cooler with the clock waiting gets a new player straight to the first real decision without losing evening time to learning the screen.

**Revisit if:** players spend so long in the opening prep that it slows the game down, or the 21-day calendar (#53) needs each day to start differently.

## 004 — High scores kept on this computer (2026-10-29)

**Decision:** A pinball-style top 5, stored in the player's browser on this computer. Scores stay when a new version of the game is deployed. Negative evenings count if they make the top 5.

**Options considered:** Local browser storage now vs an online leaderboard (needs a hosted backend, issue #3). A longer table vs a top 5 to start.

**Why (product owner's rationale):**
- *Scope:* storing scores locally is enough to give the loop a goal; an online board can come later.
- *Cost:* no backend, no accounts, no hosting cost.
- *Scores that last:* first proposed as resetting with each new build; changed while testing PR #42 so players keep their scores through updates.

**Deferred:** a fuller scoreboard with fun records (lowest score ever, least money earned), tracked as its own ticket.

**Revisit if:** the game ships on itch.io and players want to compare scores (issue #3).

## 003 — TypeScript instead of JavaScript (2026-10-27)

**Decision:** Convert the codebase to TypeScript and add a type check that runs on every pull request.

**Options considered:** Switch to TypeScript now (bundled with the Phaser 4 upgrade), or stay on JavaScript. Full analysis: "03 - JavaScript vs TypeScript Analysis" in the project Drive folder.

**Why (product owner's rationale):**
- *Sound engineering reasoning:* the engineering team's case held up, and I back the team's call when the reasoning is sound.
- *Cost:* no price impact; TypeScript is free and the switch costs one PR.
- *Building for the future:* types make the codebase easier to review and safer to grow as features are added.

**Engineering rationale:** Phaser 4's bundled type definitions describe the real v4 API, so any Phaser 3-style call fails the type check automatically. This guards the main risk identified in decision 002.

**Revisit if:** type errors become a recurring drag on delivery with no bugs caught.

## 002 — Upgrade to Phaser 4 (2026-10-27)

**Decision:** Upgrade from Phaser 3.90 to Phaser 4.2 before any game code is written.

**Options considered:** Upgrade now; upgrade before the vertical slice; stay on Phaser 3. Full analysis: "02 - Phaser 4 Upgrade Analysis" in the project Drive folder. Triggered by the tech stack audit ("01 - Tech Stack Audit").

**Why (product owner's rationale):**
- *Sound engineering reasoning:* the engineering team's case held up, and I back the team's call when the reasoning is sound.
- *Cost:* Phaser stays free (MIT); no price increase.
- *Building for the future:* new features and fixes go to Phaser 4 only, and upgrading is cheapest while the codebase is one screen.

**Known risk:** the engineering team's Phaser knowledge is mostly v3. Mitigated by the official migration guide and the TypeScript check (decision 003).

**Revisit if:** a needed plugin or feature is only available for Phaser 3.

## 001 — Tech stack and hosting (2026-10-27)

**Decision:** Phaser 3 + Vite, plain JavaScript, hosted on GitHub Pages.

**Options considered:**
- *Engine:* Phaser 3 vs Godot (web export) vs a hand-built canvas engine. Phaser runs natively in the browser, is purpose-built for 2D, and has extensive documentation.
- *Language:* JavaScript vs TypeScript. JavaScript keeps the code simpler to read for review; TypeScript remains an option to revisit.
- *Hosting:* GitHub Pages vs itch.io vs Netlify. GitHub Pages deploys automatically from the repo at no cost; itch.io will be added later as the distribution storefront.

**Why (product owner's rationale):**
- *Familiarity:* tools I've used before in previous software work, so less ramp-up time.
- *Cost:* every piece is free, which fits a solo portfolio project with no budget.
- *Engineering recommendation:* the engineering side recommended this stack for a static 2D browser game, and I accepted it.

**Engineering rationale:** The game is static files with no server needs. This stack keeps code and process in one public place and puts every change one merge away from being live.

**Revisit if:** the game needs online features (leaderboards, accounts), at which point a hosted backend such as Supabase is the likely addition.
