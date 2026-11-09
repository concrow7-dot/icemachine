// Strips TypeScript types from the game source (no compiler, no bundler) so the browser
// suites and the unit tests can run it as plain JavaScript. Shared by tests/e2e/build_harness.mjs
// and tests/unit/run.mjs. Needs Node 22+. Note: no constructor parameter properties in src
// (`constructor(private x)`), which strip-only mode can't handle.
import { stripTypeScriptTypes } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

/** Writes src/**.ts as out/src/**.js. `patch(file, js)` may change a file's text on the way. */
export function stripSources(repo, out, patch = (_f, js) => js) {
  const srcRoot = path.join(repo, 'src');
  for (const f of walk(srcRoot).filter((f) => f.endsWith('.ts'))) {
    let js = stripTypeScriptTypes(fs.readFileSync(f, 'utf8'), { mode: 'strip' });
    js = js.replace(/from '(\.{1,2}\/[^']+)'/g, (m, p) => `from '${p}.js'`);
    js = patch(f, js);
    const dest = path.join(out, 'src', path.relative(srcRoot, f)).replace(/\.ts$/, '.js');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, js);
  }
}
