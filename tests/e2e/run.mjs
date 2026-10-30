// SCREAM-74: runs the browser test suites against the current code.
//
//   node tests/e2e/run.mjs              run every suite
//   node tests/e2e/run.mjs feel drive   run only these suites
//
// It builds the game into tests/e2e/.run (TypeScript types stripped, no bundler),
// serves it on a local port, and runs each *_test.cjs suite with Playwright.
// Screenshots go to tests/e2e/.shots. Needs Node 22+ and Playwright with Chromium
// (pre-installed in Claude's workspaces; elsewhere: npm i -D playwright && npx playwright install chromium).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const out = path.join(here, '.run');
const shots = path.join(here, '.shots');
const PORT = Number(process.env.E2E_PORT ?? 8766);

// Phaser's browser build: from node_modules, or the fallback copy in the private art repo
// (for sessions where npm can't be reached), cloned next to this repo.
const PHASER_CANDIDATES = [
  path.join(repo, 'node_modules', 'phaser', 'dist', 'phaser.esm.js'),
  path.resolve(repo, '..', 'icemachine-art', 'tooling', 'phaser-4.2.1', 'phaser.esm.js'),
];
const phaser = PHASER_CANDIDATES.find((p) => fs.existsSync(p));
if (!phaser) {
  console.error('Phaser not found. Run npm install, or clone icemachine-art next to this repo.\nLooked in:\n  ' + PHASER_CANDIDATES.join('\n  '));
  process.exit(2);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(shots, { recursive: true });
fs.copyFileSync(phaser, path.join(out, 'phaser.esm.js'));
const built = spawnSync(process.execPath, [path.join(here, 'build_harness.mjs'), repo, out], { encoding: 'utf8' });
if (built.status !== 0) {
  console.error(built.stderr);
  process.exit(built.status ?? 1);
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };
const server = http
  .createServer((req, res) => {
    const file = path.join(out, decodeURIComponent((req.url ?? '/').split('?')[0]));
    if (!file.startsWith(out) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT);

const all = fs.readdirSync(here).filter((f) => f.endsWith('_test.cjs')).map((f) => f.replace('_test.cjs', '')).sort();
const wanted = process.argv.slice(2);
const suites = wanted.length ? wanted : all;
let failed = 0;
let checks = 0;
for (const name of suites) {
  const file = path.join(here, `${name}_test.cjs`);
  if (!fs.existsSync(file)) {
    console.log(`${name}: no such suite (have: ${all.join(', ')})`);
    failed++;
    continue;
  }
  // Run asynchronously so this process keeps serving the game while the suite runs.
  const result = await new Promise((resolve) => {
    let text = '';
    const child = spawn(process.execPath, [file, String(PORT), shots], { cwd: here });
    child.stdout.on('data', (d) => (text += d));
    child.stderr.on('data', (d) => (text += d));
    child.on('close', (code) => resolve({ code, text }));
  });
  const fails = result.text.split('\n').filter((l) => l.startsWith('FAIL'));
  const summary = result.text.match(/(\d+) passed, (\d+) failed; errors: (.*)/);
  if (summary) checks += Number(summary[1]) + Number(summary[2]);
  fails.forEach((l) => console.log('  ' + l));
  console.log(`${name}: ${summary ? summary[0] : 'did not finish\n' + result.text.split('\n').slice(-8).join('\n')}`);
  if (!summary || summary[2] !== '0' || summary[3] !== 'none') failed++;
}
server.close();
console.log(`\n${suites.length - failed} of ${suites.length} suites passed (${checks} checks).`);
process.exit(failed ? 1 : 0);
