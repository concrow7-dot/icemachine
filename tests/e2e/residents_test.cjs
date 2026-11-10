// SCREAM-59 + SCREAM-73: the neighbourhood's residents (named people with homes,
// drawn with LimeZu Modern Interiors characters). Buying comes later (SCREAM-67).
const { chromium } = require('playwright');
(async () => {
  const [port, outDir] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  // SCREAM-175: these suites play as a player who has finished the tutorial (every mode unlocked).
  await page.addInitScript(() => { try { localStorage.setItem('icemachine.tutorial.done.v1', '1'); } catch {} });
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
  // SCREAM-148: regulars near home now come out quickly; keep this suite about the residents' routines.
  await ev('e.residents.hearingOff = true');

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

  // SCREAM-148 (PO, November 3): 25% every-day regulars, 50% sometimes (1 day in 3), 25% never
  const kinds = await ev(`(() => { const k = e.residents.constructor.kind; const c = { regular: 0, sometimes: 0, never: 0 }; e.residents.all.forEach(p => c[k(p.resident.likelihood)]++); return [c.regular, c.sometimes, c.never].join(','); })()`);
  // SCREAM-231 (PO, November 9): the mix follows the sheet (SCREAM-228 made most former 0% customers 1-16%),
  // so the expected counts come from the likelihoods by the rule (0% never, 50%+ regular, else sometimes).
  const byRule = await ev(`(() => { const c = [0, 0, 0]; e.residents.all.forEach(p => { const l = p.resident.likelihood; c[l >= 0.5 ? 0 : l > 0 ? 1 : 2]++; }); return c.join(','); })()`);
  check('Buyer kinds from the sheet (regular, sometimes, never) follow the likelihoods: ' + byRule, kinds, byRule);
  check('...and the sheet has some of each kind', byRule.split(',').every(n => +n > 0), true);
  check('Kinds by likelihood: 0% never, 35% sometimes, 50% and 80% regular', await ev('[0, 0.35, 0.5, 0.8].map(e.residents.constructor.kind).join()'), 'never,sometimes,regular,regular');
  check('Tonight: never buyers never buy, regulars always can', await ev(`e.residents.all.every(p => { const k = e.residents.constructor.kind(p.resident.likelihood); return k === 'sometimes' || p.buys === (k === 'regular'); })`), true);
  const story = await ev(`(() => { const R = e.residents.constructor; const some = e.residents.all.filter(p => R.kind(p.resident.likelihood) === 'sometimes').map(p => p.resident);
    let exactlyOne = true; const perDay = [0, 0, 0];
    for (const seed of [1, 2, 3, 12345]) for (const r of some) { const days = [1, 2, 3].filter(d => R.buysTonight(r, Math.random, { day: d, seed })); if (days.length !== 1) exactlyOne = false; else if (seed === 12345) perDay[days[0] - 1]++; }
    return [exactlyOne, perDay.every(n => n >= 12)].join(); })()`);
  check('Story: each sometimes buyer buys on exactly 1 of the 3 days; days spread out', story, 'true,true');
  const quick = await ev(`(() => { const R = e.residents.constructor; const r = e.residents.all.find(p => R.kind(p.resident.likelihood) === 'sometimes').resident; let n = 0; for (let i = 0; i < 3000; i++) if (R.buysTonight(r, Math.random)) n++; return n; })()`);
  check('Quick play: a sometimes buyer buys on about 1 evening in 3', quick > 850 && quick < 1150, true);
  const nobuy = await ev(`(() => { const R = e.residents.constructor; const r = new R(e.residents.all.map(p => p.resident), Math.random, undefined, { day: 1, seed: 7 });
    const off = r.all.filter(p => !p.buys); r.update(0.5, { x: 0, y: 0, radius: 1e9, open: true }); for (let t = 0; t < 120; t++) r.update(1, { x: 0, y: 0, radius: 1e9, open: true });
    return [off.length > 0, off.every(p => p.customer === 'none'), r.all.some(p => p.customer !== 'none')].join(); })()`);
  check("Two minutes in the ring: people who don't buy tonight never come; others do", nobuy, 'true,true,true');

  // Start of the evening (SCREAM-152): never buyers half out, everyone else 3/4 out (about 110 of 160)
  const out0 = await ev('e.residents.all.filter(p => p.outside).length');
  check('About 70% start outside (85 to 135)', out0 >= 85 && out0 <= 135, true);
  const someOut = await ev(`(() => { const R = e.residents.constructor; let o = 0, n = 0; for (let k = 0; k < 10; k++) { const r = new R(e.residents.all.map(p => p.resident)); for (let t = 0; t < 1200; t++) r.update(0.5); r.all.forEach(p => { if (R.kind(p.resident.likelihood) !== 'never') { n++; if (p.outside) o++; } }); } return o / n; })()`);
  check('Regulars and sometimes buyers are outside about 3/4 of the time (65% to 88%)', someOut > 0.65 && someOut < 0.88, true);

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
  // SCREAM-231: about half the never buyers and 3/4 of everyone else are out at any time (SCREAM-152), give or take 25.
  const outExpected = await ev(`e.residents.all.reduce((n, p) => n + (p.resident.likelihood > 0 ? 0.75 : 0.5), 0)`);
  check(`...and some are still out at the end (about ${Math.round(outExpected)}, give or take 25)`, Math.abs(sim.out - outExpected) <= 25 ? 'ok' : sim.out, 'ok');

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
  // SCREAM-108: houses in many styles and colours, with ornaments in the yards.
  check('Houses come in 40+ different styles and colours (SCREAM-108)', await drive("new Set(s.map.objects.filter(o => /^(house|villa)/.test(o.key)).map(o => o.key)).size >= 40"), true);
  check('...including Victorian houses and bigger mobile homes', await drive("['house_victorian', 'house_medium', 'house_big'].every(k => s.map.objects.some(o => o.key.startsWith(k)))"), true);
  check('...and 150+ yard ornaments of 40+ kinds', await drive("(o => o.length >= 150 && new Set(o.map(x => x.key)).size >= 40)(s.map.objects.filter(o => o.key.startsWith('orn_')))"), true);
  await page.screenshot({ path: outDir + '/residents.png' });

  // The same people carry on after a trip back into the truck
  // SCREAM-104: front to back, not through trees and houses
  check('No door or yard spot is on a tree trunk or inside a house', await drive(`s.evening.residents.all.every(p => {
    const r = p.resident; const pts = [r.door, ...Array.from({ length: r.yard.length / 2 }, (_, i) => [r.yard[i * 2], r.yard[i * 2 + 1]])];
    return pts.every(([x, y]) => s.map.objects.every(o => { const z = s.map.sprites.find(q => q.key === o.key);
      if (o.key.startsWith('tree')) return !(Math.abs(x - o.x) < 11 && y > o.y - 14 && y < o.y + 4);
      return !(x > o.x - z.w / 2 && x < o.x + z.w / 2 && y > o.y - z.h && y < o.y); }));
  })`), true);
  // Stand someone just behind a tree, then just in front of it
  const tree = await drive(`(() => { const t = s.map.objects.find(o => o.key.startsWith('tree') && Math.hypot(o.x - s.truck.x, o.y - s.truck.y) < 250); return t ? [t.x, t.y, s.map.objects.indexOf(t)] : null; })()`);
  if (tree) {
    const place = (y) => ev(`(p => { p.outside = true; p.walking = false; p.x = ${tree[0]}; p.y = ${y}; p.plan = { kind: 'idle', until: 1e9 }; })(e.residents.all[${idx}])`);
    await place(tree[1] - 8); await wait(300);
    check('Behind a tree: the tree is drawn over the person', await drive(`(o => !!o && o.visible && o.depth > s.residentSprites[${idx}].depth)(s.occluders.get(${tree[2]}))`), true);
    await page.screenshot({ path: outDir + '/resident_behind_tree.png' });
    await place(tree[1] + 8); await wait(300);
    check('In front of the tree: the person is drawn over it', await drive(`(o => !o || !o.visible)(s.occluders.get(${tree[2]}))`), true);
  } else check('A tree near the truck to test with', false, true);
  check('Residents lower on screen are drawn in front', await drive('(() => { const v = s.residentSprites.filter(x => x.visible); return v.every(a => v.every(b => a.y <= b.y || a.depth > b.depth)); })()'), true);

  await ev('(window.__residentsBefore = e.residents, true)');
  await drive("s.scene.start('Truck', { station: 'driver' })"); await wait(300);
  check('Residents belong to the evening (same people after leaving the road)', await ev('e.residents === window.__residentsBefore'), true);
  console.log(`\n${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await browser.close();
})();
