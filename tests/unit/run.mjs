// Unit tests for the game's pure logic (no browser, no Phaser): the state classes and
// functions that take numbers in and give numbers out.
//
//   node tests/unit/run.mjs            run every unit test
//   npm run test:unit                  same
//
// It strips the TypeScript types into tests/unit/.run (like the browser harness) and runs
// every *.test.mjs here with Node's own test runner. Only modules that don't import Phaser
// can be tested this way: src/state/Sale, AutoRoute, CurbFinder, RoadGeometry, PriceEntry,
// Damage, Residents (the maths), and src/config.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripSources } from '../strip.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const out = path.join(here, '.run');
fs.rmSync(out, { recursive: true, force: true });
stripSources(repo, out);
const tests = fs.readdirSync(here).filter((f) => f.endsWith('.test.mjs')).map((f) => path.join(here, f));
const result = spawnSync(process.execPath, ['--test', ...tests], { stdio: 'inherit' });
process.exit(result.status ?? 1);
