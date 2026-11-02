// SCREAM-59 + SCREAM-73: the neighbourhood's residents (named people with homes,
// drawn with LimeZu Modern Interiors characters). Buying comes later (SCREAM-67).
const { chromium } = require('playwright');
(async () => {
  const [port, outDir] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  const ev = (fn) => page.evaluate(`(() => { const e = window.__game.registry.get('evening'); return ${fn}; })()`);
  const drive = (fn) => page.evaluate(`(() => { const s = window.__game.scene.getScene('Drive'); return ${fn}; })()`);
  const wait = ms => page.waitForTimeout(ms);
  const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(40); } await wait(80); };
  let pass = 0, fail = 0;
  const check = (name, got, want) => { const ok = String(got) === String(want); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(64) + ' got=' + got + (ok ? '' : ' want=' + want)); };

  // Quick play: buy some stock and drive off.
  await page.click('canvas'); await press('Enter'); await wait(200);
  await press('+', 4); await press('Enter'); await wait(200);
  await press('ArrowRight'); await press('Enter'); await wait(500);

  // The list, from the PO's sheet (doc 38)
  const n = await ev('e.residents.all.length');
  check('160 residents, one per house (home not included)', n, 160);
  check('Every resident has an ID and a name', await ev('e.residents.all.every(p => /^R\\d{3}$/.test(p.resident.id) && p.resident.name.length > 2)'), true);
  check('IDs are all different', await ev('new Set(e.residents.all.map(p => p.resident.id)).size'), 160);
  check('Likelihoods are from 0 to 1', await ev('e.residents.all.every(p => p.resident.likelihood >= 0 && p.resident.likelihood <= 1)'), true);
  check('About 1 in 3 are kids (30 to 70 of 160)', await ev('(k => k >= 30 && k <= 70)(e.residents.all.filter(p => p.resident.kid).length)'), true);
  check('Everyone has at least 2 yard spots', await ev('e.residents.all.every(p => p.resident.yard.length >= 4)'), true);

  // Yards: off the road and sidewalk, close to home
  const offStreet = await drive(`s.evening.residents.all.every(p => {
    const r = p.resident; const pts = [r.door, ...Array.from({ length: r.yard.length / 2 }, (_, i) => [r.yard[i * 2], r.yard[i * 2 + 1]])];
    return pts.every(([x, y]) => { const g = s.roads.nearestSegment(x, y); if (!g) return true; const vx = g.bx - g.ax, vy = g.by - g.ay, L2 = vx * vx + vy * vy;
      const t = Math.max(0, Math.min(1, ((x - g.ax) * vx + (y - g.ay) * vy) / L2)); return Math.hypot(x - g.ax - t * vx, y - g.ay - t * vy) > 74; });
  })`);
  check('Every door and yard spot is off the road and sidewalk', offStreet, true);
  check('Every yard spot is within 100 px of the door', await ev(`e.residents.all.every(p => { const r = p.resident; for (let i = 0; i < r.yard.length; i += 2) if (Math.hypot(r.yard[i] - r.door[0], r.yard[i + 1] - r.door[1]) > 100) return false; return true; })`), true);
  check('Everyone has a street name', await ev('e.residents.all.every(p => p.resident.street.endsWith("Street") || p.resident.street.endsWith("Road") || p.resident.street.endsWith("Avenue") || p.resident.street.endsWith("Place"))'), true);

  // Start of the evening: about half are out
  const out0 = await ev('e.residents.all.filter(p => p.outside).length');
  check('About half start outside (50 to 110)', out0 >= 50 && out0 <= 110, true);

  // The sprite sheet: 160 looks, two rows each of 24 frames, 16 x 32 px
  check('Sprite sheet frames are 16 x 32', await drive("[s.textures.get('residents').get(0).width, s.textures.get('residents').get(0).height].join('x')"), '16x32');
  check('Sprite sheet has room for every look', await drive("s.textures.get('residents').frameTotal - 1 >= 160 * 48"), true);
  check('One sprite per resident', await drive('s.residentSprites.length'), 160);

  // Five minutes of evening, simulated: people go in and out, walk, and stay home
  const sim = await ev(`(() => {
    const r = e.residents; const wasOut = r.all.map(p => p.outside); let wentIn = 0, cameOut = 0, walked = 0, farthest = 0, facingOk = true, prev = r.all.map(p => [p.x, p.y]);
    for (let t = 0; t < 300 * 10; t++) {
      r.update(0.1);
      r.all.forEach((p, i) => {
        if (p.outside !== wasOut[i]) { if (p.outside) cameOut++; else wentIn++; wasOut[i] = p.outside; }
        const [px, py] = prev[i]; const dx = p.x - px, dy = p.y - py;
        if (p.walking && Math.hypot(dx, dy) > 0.5) { walked++;
          const f = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
          if (f !== p.facing && Math.abs(Math.abs(dx) - Math.abs(dy)) > 0.3) facingOk = false; }
        prev[i] = [p.x, p.y];
        farthest = Math.max(farthest, Math.hypot(p.x - p.resident.door[0], p.y - p.resident.door[1]));
      });
    }
    return { wentIn, cameOut, walked, farthest: Math.round(farthest), facingOk, out: r.all.filter(p => p.outside).length };
  })()`);
  check('Over 5 minutes, people go inside (50+ times)', sim.wentIn >= 50, true);
  check('...and come out (50+ times)', sim.cameOut >= 50, true);
  check('...and walk around', sim.walked > 1000, true);
  check('...facing the way they walk', sim.facingOk, true);
  check('...never more than 100 px from their door', sim.farthest <= 100, true);
  check('...and some are still out at the end (30 to 130)', sim.out >= 30 && sim.out <= 130, true);

  // On screen: drive to someone who is outside
  const target = await ev('(p => [p.resident.id, Math.round(p.x), Math.round(p.y)])(e.residents.all.find(p => p.outside && !p.walking) || e.residents.all.find(p => p.outside))');
  const idx = await ev(`e.residents.all.findIndex(p => p.resident.id === '${target[0]}')`);
  await drive(`(s.truck.setPosition(${target[1]}, ${target[2]}), s.speed = 0, s.parkBrake = true, s.cameras.main.centerOn(${target[1]}, ${target[2]}))`);
  await wait(600);
  const shown = await drive(`(() => { const sp = s.residentSprites[${idx}], p = s.evening.residents.all[${idx}]; return [sp.visible === p.outside, Math.abs(sp.x - Math.round(p.x)) <= 2 && Math.abs(sp.y - Math.round(p.y)) <= 2].join(' '); })()`);
  check('Someone outside near the truck is drawn where they stand', shown, 'true true');
  check('Inside residents are never drawn', await drive('s.evening.residents.all.every((p, i) => p.outside || !s.residentSprites[i].visible)'), true);
  check('Far-away residents are not drawn', await drive('s.evening.residents.all.every((p, i) => !s.residentSprites[i].visible || (Math.abs(p.x - s.truck.x) < 700 && Math.abs(p.y - s.truck.y) < 500))'), true);
  check('Residents are drawn under the truck', await drive('s.residentSprites[0].depth < s.truck.depth'), true);
  await page.screenshot({ path: outDir + '/residents.png' });

  // The same people carry on after a trip back into the truck
  await ev('(window.__residentsBefore = e.residents, true)');
  await drive("s.scene.start('Truck', { station: 'driver' })"); await wait(300);
  check('Residents belong to the evening (same people after leaving the road)', await ev('e.residents === window.__residentsBefore'), true);
  console.log(`\n${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await browser.close();
})();
