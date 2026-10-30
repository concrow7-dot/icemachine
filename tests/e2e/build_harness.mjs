// Test harness: strips TypeScript types from the game source so it can run
// in a browser without npm. Usage: node build_harness.mjs <repoDir> <outDir>
import { stripTypeScriptTypes } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const [repo, out] = process.argv.slice(2);
const srcRoot = path.join(repo, 'src');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const f of walk(srcRoot).filter(f => f.endsWith('.ts'))) {
  let js = stripTypeScriptTypes(fs.readFileSync(f, 'utf8'), { mode: 'strip' });
  js = js.replace(/from '(\.{1,2}\/[^']+)'/g, (m, p) => `from '${p}.js'`);
  // Tests reach the game through window.__game. After any frame over 200 ms (on a slow test
  // machine without a graphics card, a map repaint can take that long), Phaser plays the next
  // 120 frames in slow motion; panicMax 0 turns that off so timing checks don't depend on the
  // test machine. The game itself is unchanged.
  if (f.endsWith('main.ts')) js = js.replace('new Phaser.Game(config);', 'window.__game = new Phaser.Game(config); window.__game.loop.panicMax = 0;');
  const dest = path.join(out, 'src', path.relative(srcRoot, f)).replace(/\.ts$/, '.js');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, js);
}
fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{"imports":{"phaser":"./phaser.esm.js"}}</script>
<style>html,body{margin:0;height:100%;background:#10141c}#game{height:100%}</style></head>
<body><div id="game"></div><script type="module" src="./src/main.js"></script></body></html>`);
const publicDir = path.join(repo, 'public');
if (fs.existsSync(publicDir)) fs.cpSync(publicDir, out, { recursive: true });
console.log('built');
