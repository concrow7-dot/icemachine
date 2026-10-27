# Decision log

Newest first. Each entry: what was decided, the options considered, and why.

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
