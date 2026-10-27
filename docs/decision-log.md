# Decision log

Newest first. Each entry: what was decided, the options considered, and why.

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
