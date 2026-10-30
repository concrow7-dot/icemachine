# Decision log

Newest first. Each entry: what was decided, the options considered, and why.

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
