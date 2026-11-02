// SCREAM-67, 68, 24, 99: customers are the residents. The truck's music ring, the
// once-a-second chance, running to the curb, waiting 30 seconds, the pink square,
// no pointer arrow, the music, and the customer's name at the window.
const { chromium } = require('playwright');
(async () => {
  const [port, outDir] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.evaluate(() => localStorage.removeItem('icemachine.music.muted.v1'));
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  const ev = (fn) => page.evaluate(`(() => { const e = window.__game.registry.get('evening'); return ${fn}; })()`);
  const scenes = () => page.evaluate(() => window.__game.scene.getScenes(true).map(s => s.scene.key).join(','));
  const drive = (fn) => page.evaluate(`(() => { const s = window.__game.scene.getScene('Drive'); return ${fn}; })()`);
  const wait = ms => page.waitForTimeout(ms);
  const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(40); } await wait(80); };
  let pass = 0, fail = 0;
  const check = (name, got, want) => { const ok = String(got) === String(want); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(64) + ' got=' + got + (ok ? '' : ' want=' + want)); };

  // ---- The chance formula (PO, November 2) ----
  await page.click('canvas'); await press('Enter'); await wait(200);
  const chance = (h, l, indoors) => ev(`Math.round(e.residents.constructor.chance(${h}, ${l}, ${indoors}) * 10000) / 10000`);
  check('First second heard: 25%, the most likely moment (likelihood 100%, outside)', await chance(1, 1, false), 0.25);
  const c = []; for (const h of [1, 2, 3, 6, 12, 30, 120]) c.push(await chance(h, 1, false));
  check('The chance falls each second after that', c.every((x, i) => i === 0 || x < c[i - 1]), true);
  check('...by less each second (diminishing)', (c[0] - c[1]) > (c[1] - c[2]), true);
  check('...toward 5%, never below it', c[6] >= 0.05 && c[6] < 0.051, true);
  // The chance they've come out after hearing it for n seconds in a row: 1 minus the chance they said no every second.
  const comeOut = await ev('(() => { const f = e.residents.constructor.chance; const out = n => { let stay = 1; for (let h = 1; h <= n; h++) stay *= 1 - f(h, 1, false); return 1 - stay; }; return [out(1), out(5), out(15)]; })()');
  check('Overall, the longer they hear it, the more likely they come out', comeOut[0] < comeOut[1] && comeOut[1] < comeOut[2], true);
  check('Indoors: half as likely', Math.abs((await chance(5, 1, true)) - (await chance(5, 1, false)) / 2) < 0.0002, true);
  check("The resident's likelihood scales it (40%)", Math.abs((await chance(5, 0.4, false)) - (await chance(5, 1, false)) * 0.4) < 0.0002, true);
  check('Likelihood 0%: never', await chance(30, 0, false), 0);

  // ---- In the cooler, before driving: nobody wants ice cream yet ----
  check('Before driving, no new customers', await ev('e.acceptingCustomers'), false);
  await press('+', 6); await press('Enter'); await wait(200);
  await press('ArrowRight'); await press('Enter'); await wait(400);
  check('On the road with stock: people may want ice cream', await ev('e.acceptingCustomers'), true);
  check('The music ring is round the truck, 300 px', await drive('[s.ring.visible, Math.round(s.ring.radius), Math.round(s.ring.x) === Math.round(s.truck.x)].join()'), 'true,300,true');
  check('No pointer arrow (SCREAM-68)', await drive('s.pointer'), undefined);
  check('Hint line explains the ring and the music keys', await drive("s.children.list.some(o => o.type === 'Text' && /ring/.test(o.text) && /M mute/.test(o.text))"), true);

  // ---- Curb spots: every resident has one ----
  const curbs = await drive(`(() => { let stand = 0, square = 0, cars = 0;
    for (const p of s.evening.residents.all) { const [sx, sy, qx, qy] = p.resident.curb;
      const g = s.roads.nearestSegment(sx, sy); const vx = g.bx - g.ax, vy = g.by - g.ay, L2 = vx * vx + vy * vy;
      const t = Math.max(0, Math.min(1, ((sx - g.ax) * vx + (sy - g.ay) * vy) / L2)); const d = Math.hypot(sx - g.ax - t * vx, sy - g.ay - t * vy);
      if (!s.roads.onRoad(sx, sy) && d <= 74) stand++;
      if (s.roads.onRoad(qx, qy)) square++;
      if (s.map.parkedCars.every(c => Math.hypot(c.x - qx, c.y - qy) >= 59)) cars++; }
    return [stand, square, cars].join(); })()`);
  check('All 160: stand on the sidewalk, square on the road, clear of parked cars', curbs, '160,160,160');

  // ---- A simulation: a parked truck in a fresh neighbourhood ----
  const sim = await ev(`(() => {
    const R = e.residents.constructor; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const list = e.residents.all.map(p => p.resident);
    const busiest = list.map(q => list.filter(o => Math.hypot(o.door[0] - q.door[0], o.door[1] - q.door[1]) < 300).length); const r = new R(list, rnd); const home = list[busiest.indexOf(Math.max(...busiest))].door; const ring = { x: home[0], y: home[1], radius: 300, open: true };
    let became = 0, outsideRing = 0, backToNone = 0, late = 0, gaveUp = 0, atCurb = true; const was = r.all.map(p => p.customer);
    for (let t = 0; t < 600 * 10; t++) {
      r.update(0.1, ring);
      r.all.forEach((p, i) => {
        if (p.customer !== was[i]) {
          if (was[i] === 'none') { became++; if (t > 450 * 10) late++;
            const [x, y] = p.outside ? [p.x, p.y] : p.resident.door; if (Math.hypot(x - ring.x, y - ring.y) > 310) outsideRing++; }
          if (p.customer === 'none') backToNone++;
          if (was[i] === 'waiting' && p.customer === 'done') gaveUp++;
          if (p.customer === 'waiting' && (Math.abs(p.x - p.resident.curb[0]) > 1 || Math.abs(p.y - p.resident.curb[1]) > 1)) atCurb = false;
          was[i] = p.customer; }
      });
    }
    const inRing = list.filter(q => Math.hypot(q.door[0] - ring.x, q.door[1] - ring.y) < 250).length;
    return { became, inRing, outsideRing, backToNone, gaveUp, late, atCurb };
  })()`);
  check('Parked 10 minutes: people near the truck come out for ice cream', sim.became >= Math.min(5, sim.inRing), true);
  check('...only people who could hear it', sim.outsideRing, 0);
  check('...nobody is a customer twice in one evening', sim.backToNone, 0);
  check('...waiting customers stand at their curb spot', sim.atCurb, true);
  check('...unserved customers give up and walk home', sim.gaveUp, sim.became);
  check('...and staying put runs out of customers (none in the last 2.5 min)', sim.late, 0);
  const many = await ev(`(() => {
    const R = e.residents.constructor; let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const list = e.residents.all.map(p => ({ ...p.resident, likelihood: 1 }));
    const busiest = list.map(q => list.filter(o => Math.hypot(o.door[0] - q.door[0], o.door[1] - q.door[1]) < 300).length); const r = new R(list, rnd); const home = list[busiest.indexOf(Math.max(...busiest))].door; const ring = { x: home[0], y: home[1], radius: 300, open: true };
    let most = 0; for (let t = 0; t < 120 * 10; t++) { r.update(0.1, ring); most = Math.max(most, r.waiting.length); } return most; })()`);
  check('No limit on customers waiting at once (more than 3 seen)', many > 3, true);
  const closed = await ev(`(() => { const R = e.residents.constructor; const r = new R(e.residents.all.map(p => ({ ...p.resident, likelihood: 1 })));
    const home = r.all[40].resident.door; for (let t = 0; t < 600; t++) r.update(0.1, { x: home[0], y: home[1], radius: 300, open: false });
    return r.all.filter(p => p.customer !== 'none').length; })()`);
  check('Ring closed (sold out, after 8 PM): nobody new', closed, 0);
  const away = await ev(`(() => { const R = e.residents.constructor; const r = new R(e.residents.all.map(p => ({ ...p.resident, likelihood: 1 })));
    for (let t = 0; t < 600; t++) r.update(0.1); return r.all.filter(p => p.customer !== 'none').length; })()`);
  check('No truck nearby: nobody wants ice cream', away, 0);

  // ---- In the game: a customer at the curb ----
  await ev('(e.residents.hearingOff = true, true)');
  const idx = await ev("e.residents.all.findIndex(p => p.customer === 'none')");
  const name = await ev(`e.residents.all[${idx}].resident.name`);
  await ev(`e.residents.callNow(e.residents.all[${idx}])`); await wait(300);
  check('A waiting customer gets a pink square in the curb lane', await drive(`(z => !!z && z.visible && s.roads.onRoad(z.x, z.y))(s.pickupZones.get(${idx}))`), true);
  check('...and a "!" thought bubble over their head', await drive(`(b => !!b && b.visible)(s.bubbles.get(${idx}))`), true);
  check('...standing on the sidewalk beside it', await ev(`(p => Math.hypot(p.x - p.resident.curb[0], p.y - p.resident.curb[1]) < 1)(e.residents.all[${idx}])`), true);

  // Truck in the far lane (60 px over, toward the road's middle) does not pick up
  await drive(`(z => { const [sx, sy] = s.evening.residents.all[${idx}].resident.curb; const dx = z.x - sx, dy = z.y - sy, L = Math.hypot(dx, dy);
    s.truck.setPosition(z.x + dx / L * 60, z.y + dy / L * 60); s.setHeading(z.angle); s.speed = 0; s.parkBrake = true; })(s.pickupZones.get(${idx}))`);
  await wait(300);
  check('Truck in the far lane (60 px from the square) does not pick up', await scenes(), 'Drive,Hud');
  await drive(`(z => { const r = z.rotation; s.truck.setPosition(z.x - Math.cos(r) * 90, z.y - Math.sin(r) * 90); s.setHeading(z.angle); s.speed = 0; s.parkBrake = true; })(s.pickupZones.get(${idx}))`);
  await wait(400);
  await page.screenshot({ path: outDir + '/customer_waiting.png' });
  check('Truck short of the square: no sale yet', await scenes(), 'Drive,Hud');

  // Rolling through the square doesn't count until fully stopped; then the window opens
  await drive(`(z => { s.truck.setPosition(z.x, z.y); s.speed = 30; s.parkBrake = false; })(s.pickupZones.get(${idx}))`); await wait(30);
  await drive(`(z => { s.truck.setPosition(z.x, z.y); s.speed = 0; s.parkBrake = true; })(s.pickupZones.get(${idx}))`); await wait(400);
  check('Stopped in the square: the sales window opens', await scenes(), 'Sales,Hud');
  check("...the window knows who's there", await ev('e.customer && e.customer.resident.name'), name);
  check('...and shows their name (SCREAM-99)', await page.evaluate((n) => window.__game.scene.getScene('Sales').children.list.some(o => o.type === 'Text' && o.text === n && o.visible), name), true);
  // SCREAM-106: the person at the window is drawn in the same look they have on the map.
  const shown = await page.evaluate(() => { const p = window.__game.scene.getScene('Sales').children.list.find(o => o.type === 'Sprite' && o.texture.key === 'residents'); return p ? Number(p.frame.name) : -1; });
  const lookOf = (f) => { const across = 5 * 24, row = Math.floor(f / across), col = f % across; return Math.floor(row / 2) * 5 + Math.floor(col / 24); };
  check('...drawn in their own look from the map (SCREAM-106)', lookOf(shown), await ev('e.customer.resident.look'));
  check('...standing still, facing you (idle row, facing down)', Math.floor(shown / 120) % 2 === 0 && Math.floor((shown % 24) / 6) === 3, true);
  await page.screenshot({ path: outDir + '/customer_name.png' });
  check('...and they are off the map while at the window', await ev(`e.residents.all[${idx}].outside`), false);

  // Drive off without serving: they walk home; no second sale from them tonight
  await wait(400); await press('b'); await wait(400);
  check('B: back on the road', await scenes(), 'Drive,Hud');
  check('The customer is done for the evening', await ev(`e.residents.all[${idx}].customer`), 'done');
  check('...their square and bubble are gone', await drive(`[s.pickupZones.has(${idx}) && s.pickupZones.get(${idx}).visible, s.bubbles.has(${idx}) && s.bubbles.get(${idx}).visible].join()`), 'false,false');
  check('...and the truck sitting in their square starts no sale', await scenes(), 'Drive,Hud');

  // Waiting 30 seconds, then giving up
  const idx2 = await ev("e.residents.all.findIndex(p => p.customer === 'none')");
  await ev(`e.residents.callNow(e.residents.all[${idx2}])`);
  await ev('e.residents.update(25)'); await wait(200);
  check('After 25 s at the curb, still waiting', await ev(`e.residents.all[${idx2}].customer`), 'waiting');
  await ev('e.residents.update(6)'); await wait(200);
  check('After 30 s, they give up and walk home', await ev(`e.residents.all[${idx2}].customer`), 'done');
  check('...and their square is gone', await drive(`s.pickupZones.get(${idx2}).visible`), false);

  // ---- Music (SCREAM-24) ----
  const songs = ['The Entertainer', 'Take Me Out to the Ball Game', 'Für Elise', 'Pop Goes the Weasel'];
  const title = await drive('s.music.song && s.music.song.title');
  check('Music plays while driving: one of the 4 songs', songs.includes(title), true);
  await press('n'); await wait(200);
  check('N: the next song', (await drive('s.music.song.title')) !== title, true);
  check('...its name is shown', await drive("s.songLabel.text.startsWith('♪') && s.songLabel.alpha > 0"), true);
  await press('m'); await wait(100);
  check('M: music off', await drive('s.music.muted'), true);
  check('...remembered in the browser', await page.evaluate(() => localStorage.getItem('icemachine.music.muted.v1')), '1');
  await press('m'); await wait(100);
  check('M again: music back on', await drive('s.music.muted'), false);

  // ---- Sold out ----
  await page.evaluate(() => { const e = window.__game.registry.get('evening'); e.coolerSlots.forEach(s => { s.quantity = 0; }); e.emit('cooler-changed'); });
  await wait(200);
  check('Empty cooler on the road: no new customers', await ev('e.acceptingCustomers'), false);
  check('...and the HUD says SOLD OUT', await page.evaluate(() => window.__game.scene.getScene('Hud').soldOutText.visible), true);

  console.log(`\n${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await browser.close();
})();
