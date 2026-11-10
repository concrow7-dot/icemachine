// SCREAM-67, 68, 24, 99: customers are the residents. The truck's music ring, the
// once-a-second chance, running to the curb, waiting 30 seconds, the pink square,
// no pointer arrow, the music, and the customer's name at the window.
const { chromium } = require('playwright');
(async () => {
  const [port, outDir] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  // SCREAM-175: these suites play as a player who has finished the tutorial (every mode unlocked).
  await page.addInitScript(() => { try { localStorage.setItem('icemachine.tutorial.done.v1', '1'); } catch {} });
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
  const chance = (h, l, indoors, regular = false) => ev(`Math.round(e.residents.constructor.chance(${h}, ${l}, ${indoors}, ${regular}) * 10000) / 10000`);
  // SCREAM-152 (PO, November 3): 10% in the first second (was 25%), falling toward 3% (was 5%).
  check('First second heard: 10%, the most likely moment (likelihood 100%, outside)', await chance(1, 1, false), 0.1);
  const c = []; for (const h of [1, 2, 3, 6, 12, 20, 30]) c.push(await chance(h, 1, false));
  check('The chance falls each second after that', c.every((x, i) => i === 0 || x < c[i - 1]), true);
  check('...by less each second (diminishing)', (c[0] - c[1]) > (c[1] - c[2]), true);
  check('...toward 3%, never below it while they still might come', c[6] >= 0.03 && c[6] < 0.036, true);
  check('SCREAM-152: after 30 seconds heard, nobody new comes out', [await chance(31, 1, false), await chance(31, 1, false, true), await chance(120, 1, true)].join(), '0,0,0');
  check('SCREAM-152: regulars are steady, 35% times their likelihood', [await chance(1, 0.8, false, true), await chance(25, 0.8, false, true)].join(), '0.28,0.28');
  check('...and halved indoors', await chance(5, 0.8, true, true), 0.14);
  const decided = await ev(`(() => { const R = e.residents.constructor; const some = e.residents.all.map(p => p.resident).filter(r => R.kind(r.likelihood) === 'sometimes').slice(0, 30);
    const r = new R(some.map(q => ({ ...q, likelihood: 0.000001 })), Math.random, undefined, { day: 1, seed: 1 }); const d = r.all.find(p => p.buys); if (!d) return 'none';
    const ring = { x: d.resident.door[0], y: d.resident.door[1], radius: 300, open: true }; for (let t = 0; t < 40; t++) r.update(1, ring);
    const far = { x: -1e6, y: -1e6, radius: 1, open: true }; for (let t = 0; t < 5; t++) r.update(1, far);
    return [d.decided, R.chance(1, 1, false) > 0].join(); })()`);
  check('SCREAM-152: someone who heard it 30 s without coming stays decided all evening', decided, 'true,true');
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
  check('Hint line explains the ring and the music keys', await drive("s.children.list.some(o => o.type === 'Text' && /ring/.test(o.text) && /M Mute/.test(o.text))"), true);

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
  // SCREAM-143: every resident's own pink square passes the game's own room rule (cars, bays, home, right street).
  // SCREAM-234 (PO, November 10: a customer waited on Elm Park's ring, by the portal): customers who walk
  // to the truck never wait at a roundabout, wherever the truck is around it.
  const ringSpots = await ev(`(() => { const R = e.residents.curbs.roads; const g = R.rings[0]; if (!g) return 'no ring';
    let tried = 0, found = 0, bad = 0;
    for (let a = 0; a < 360; a += 15) for (const d of [0, 60, 120, 180, 240]) {
      const x = g.x + d * Math.cos(a * Math.PI / 180), y = g.y + d * Math.sin(a * Math.PI / 180); tried++;
      const spot = e.residents.curbs.near(x, y, [], 0); if (!spot) continue; found++;
      if ([spot.stand, spot.square].some(([px, py]) => Math.hypot(px - g.x, py - g.y) < g.r + g.half)) bad++;
    }
    return [found > tried / 2, bad].join(); })()`);
  check('SCREAM-234: around Newton Square, curb spots are found, none on the roundabout or its island', ringSpots, 'true,0');
  check('SCREAM-150: all 160 own curb spots are on the sidewalk', await ev('e.residents.all.filter(p => e.residents.curbs.standClear(p.resident.curb[0], p.resident.curb[1])).length'), 160);
  check("SCREAM-143: all 160 own pink squares have room for the truck", await ev(`(() => { const f = e.residents.curbs; const roads = f.roads;
    return e.residents.all.filter(p => { const c = p.resident.curb; const g = roads.nearestSegment(c[2], c[3]); return g && f.squareFits(c[2], c[3], g.road); }).length; })()`), 160);
  // SCREAM-150: with the truck at road corners and bends, nobody who wants ice cream ends up stuck without a pink square.
  const stuck = await ev(`(() => { const R = e.residents.constructor; const finder = e.residents.curbs; const list = e.residents.all.map(p => ({ ...p.resident, likelihood: 1 }));
    const spots = []; finder.roads.segments.forEach(g => spots.push({ x: g.ax, y: g.ay }));
    let total = 0, stuckN = 0, inStreet = 0, standInRoad = 0, shared = 0;
    for (const truck of spots.slice(0, 60)) {
      const near = list.map(r => [Math.hypot(r.door[0] - truck.x, r.door[1] - truck.y), r]).sort((a, b) => a[0] - b[0]).slice(0, 6).map(a => a[1]);
      const res = new R(near, Math.random, finder); const ring = { x: truck.x, y: truck.y, radius: 0, open: false };
      res.update(0.01, ring); res.all.forEach(p => res.wantIceCream(p));
      for (let t = 0; t < 900; t++) { res.update(0.1, ring); if (t % 10 === 0) { res.all.forEach(p => { if (p.customer === 'waiting' && !finder.standClear(p.x, p.y)) standInRoad++; }); const sq = res.all.filter(p => p.customer === 'waiting').map(p => p.pickup.join()); if (sq.length > new Set(sq).size) shared++; } }
      res.all.forEach(p => { total++; if (p.customer === 'running') stuckN++; else if (!finder.roads.onRoad(p.pickup[0], p.pickup[1])) inStreet++; });
    }
    return [total > 200, stuckN, inStreet, standInRoad, shared > 0].join(); })()`);
  check('SCREAM-150: truck at corners and bends: nobody stuck, squares on the road, everyone waits on the sidewalk; some share a spot (SCREAM-156)', stuck, 'true,0,0,0,true');
  // SCREAM-156: two people heading for the same place share one spot, side by side, both on the sidewalk.
  const pair = await ev(`(() => { const R = e.residents.constructor; const finder = e.residents.curbs; const r = e.residents.all[20].resident;
    const res = new R([{ ...r, id: 'A' }, { ...r, id: 'B' }], Math.random, finder); const [a, b] = res.all; const ring = { x: r.curb[2] + 400 * Math.cos(r.curb[4] * Math.PI / 180), y: r.curb[3] + 400 * Math.sin(r.curb[4] * Math.PI / 180), radius: 0, open: false };
    res.update(0.01, ring); res.wantIceCream(a); res.update(1.5, ring); res.wantIceCream(b); for (let t = 0; t < 600 && !(a.customer === 'waiting' && b.customer === 'waiting'); t++) res.update(0.1, ring);
    return [a.customer, b.customer, a.pickup.join() === b.pickup.join(), Math.hypot(a.x - b.x, a.y - b.y) >= 10, finder.standClear(a.x, a.y) && finder.standClear(b.x, b.y)].join(); })()`);
  check('SCREAM-156: two customers heading the same way share one pink square, standing side by side on the sidewalk', pair, 'waiting,waiting,true,true,true');

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
    // SCREAM-148: only people who'd buy tonight count.
    const inRing = r.all.filter(p => p.buys).map(p => p.resident).filter(q => Math.hypot(q.door[0] - ring.x, q.door[1] - ring.y) < 250).length;
    const regulars = r.all.filter(p => p.buys && R.kind(p.resident.likelihood) === "regular" && Math.hypot(p.resident.door[0] - ring.x, p.resident.door[1] - ring.y) < 250).length;
    return { became, inRing, outsideRing, backToNone, gaveUp, late, atCurb, regulars };
  })()`);
  // SCREAM-152: regulars nearby come out; the spot then dries up, so not everyone does.
  check('Parked 10 minutes: the regulars nearby come out for ice cream', sim.became >= sim.regulars && sim.became > 0, true);
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
  check('...inside the speech bubble, not under the customer (SCREAM-127)', await page.evaluate((n) => window.__game.scene.getScene('Sales').children.list.filter(o => o.type === 'Text' && o.text === n).map(o => o.x < 570 && o.y < 200).join(), name), 'true');
  // SCREAM-106: the person at the window is drawn in the same look they have on the map.
  // SCREAM-110: drawn from a smoothed, 8x copy of their own look's idle, facing-down frames.
  const shown = await page.evaluate(() => { const p = window.__game.scene.getScene('Sales').children.getByName('customer'); return p ? [p.texture.key, p.frame.width, p.frame.height] : null; });
  check('...drawn in their own look from the map (SCREAM-106)', shown && shown[0], 'customer-smooth-residents-' + (await ev('e.customer.resident.look')));
  check('...smoothed at 8x the map sprite (SCREAM-110)', shown && shown.slice(1).join('x'), '128x256');
  const same = await page.evaluate(() => {
    // The smoothed frame shrunk back down matches the map frame: same person, same colours.
    const g = window.__game, p = g.scene.getScene('Sales').children.getByName('customer');
    const look = Number(p.texture.key.split('-').pop()), sheet = g.textures.get('residents'), f = sheet.get((Math.floor(look / 5) * 2) * 120 + (look % 5) * 24 + 18);
    const c = document.createElement('canvas'); c.width = 16; c.height = 32; const x = c.getContext('2d');
    x.drawImage(sheet.getSourceImage(), f.cutX, f.cutY, 16, 32, 0, 0, 16, 32); const a = x.getImageData(0, 0, 16, 32).data;
    const big = p.texture.getSourceImage().getContext('2d').getImageData(0, 0, 128, 256).data; let diff = 0;
    for (let yy = 0; yy < 32; yy++) for (let xx = 0; xx < 16; xx++) { const i = (yy * 16 + xx) * 4, j = ((yy * 8 + 3) * 128 + xx * 8 + 3) * 4; if (a[i] !== big[j] || a[i + 3] !== big[j + 3]) diff++; }
    return diff;
  });
  check('...and is still the same person (pixel centres match the map frame)', same, 0);
  await page.screenshot({ path: outDir + '/customer_name.png' });
  check('...and they are off the map while at the window', await ev(`e.residents.all[${idx}].outside`), false);
  // SCREAM-114: while you serve, other customers waiting at the curb keep counting down and can give up.
  const other = await ev(`(() => { const p = e.residents.all.find((q, i) => i !== ${idx} && q.customer === 'none'); e.residents.callNow(p); return e.residents.all.indexOf(p); })()`);
  const w0 = await ev(`e.residents.all[${other}].waitLeft`); await wait(1500);
  const w1 = await ev(`e.residents.all[${other}].waitLeft`);
  // SCREAM-118 (PO): while you serve, waiting customers are willing to wait twice as long (half speed).
  check('At the window, another waiting customer counts down at half speed (SCREAM-114, 118)', (w0 - w1) > 0.5 && (w0 - w1) < 1.05, true);
  // SCREAM-118: the music keeps playing at the window, and the ring is open, so people can still come out.
  const ring = await page.evaluate(() => new Promise(done => { const e = window.__game.registry.get('evening'); const r = e.residents; const real = r.update; r.update = function (dt, ring) { r.update = real; done(JSON.stringify({ open: ring.open, patience: ring.patience })); return real.call(this, dt, ring); }; }));
  check('...the music ring stays open while serving (people can come out), patience 2', ring, JSON.stringify({ open: true, patience: 2 }));
  check('The music keeps playing at the window (SCREAM-118)', await page.evaluate(() => window.__game.registry.get('music').playing), true);
  await press('m'); await wait(100);
  check('...M mutes it there too', await page.evaluate(() => window.__game.registry.get('music').muted), true);
  await press('m'); await wait(100);
  await press('Escape'); await wait(200);
  const w2 = await ev(`e.residents.all[${other}].waitLeft`); await wait(1000);
  check('...but paused, their wait stops too', await ev(`e.residents.all[${other}].waitLeft`), w2);
  check('...and the music stops while paused', await page.evaluate(() => window.__game.registry.get('music').playing), false);
  await press('Escape'); await wait(200);

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

  // ---- SCREAM-140 / SCREAM-142: customers head straight for the truck and keep following it ----
  const follow = await page.evaluate(async () => {
    const { Residents } = await import('/src/state/Residents.js');
    const { CurbFinder } = await import('/src/state/CurbFinder.js');
    const { RESIDENTS } = await import('/src/config/residents.js');
    const { WORCESTER } = await import('/src/config/worcester.js');
    const { RoadNetwork } = await import('/src/state/RoadGeometry.js');
    const t = await import('/src/config/tuning.js');
    const roads = new RoadNetwork(WORCESTER.roads, WORCESTER.roadMask);
    const finder = new CurbFinder(roads, (x, y) => roads.onRoad(x, y));
    // A point `dist` px down the road nearest a resident's pink square, from that square.
    const along = (r, dist) => {
      const seg = roads.nearestSegment(r.curb[2], r.curb[3]); const pts = WORCESTER.roads[seg.road].points;
      let best = 0, bestD = Infinity; for (let k = 0; k < pts.length; k += 2) { const d = Math.hypot(pts[k] - r.curb[2], pts[k + 1] - r.curb[3]); if (d < bestD) { bestD = d; best = k; } }
      let left = dist, k = best;
      while (k + 3 < pts.length) { const l = Math.hypot(pts[k + 2] - pts[k], pts[k + 3] - pts[k + 1]); if (l >= left) return { x: pts[k] + (pts[k + 2] - pts[k]) * left / l, y: pts[k + 1] + (pts[k + 3] - pts[k + 1]) * left / l }; left -= l; k += 2; }
      return null;
    };
    const r = RESIDENTS.find(r => along(r, 1600));
    const res = new Residents([r], () => 0.5, finder);
    const p = res.all[0];
    const until = (ring, ok, max = 200) => { let s = 0; while (!ok() && s < max) { res.update(0.1, ring); s += 0.1; } return s; };
    const ringAt = (pt) => ({ x: pt.x, y: pt.y, radius: 0, open: false });
    // 1. Truck 500 px down their street.
    let truck = along(r, 500), ring = ringAt(truck);
    res.update(0.01, ring); res.wantIceCream(p);
    const start = [p.x, p.y];
    res.update(3, ring);
    const moved = Math.atan2(p.y - start[1], p.x - start[0]), aim = Math.atan2(truck.y - start[1], truck.x - start[0]);
    const straight = Math.abs(((moved - aim + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) < 0.15;
    let pinkWhileWalking = false;
    until(ring, () => { if (p.customer === 'running' && p.pickup[0] !== r.curb[2]) pinkWhileWalking = true; return p.customer === 'waiting'; });
    const near = { state: p.customer, dist: Math.round(Math.hypot(p.pickup[0] - truck.x, p.pickup[1] - truck.y)), onRoad: roads.onRoad(p.pickup[0], p.pickup[1]), straight, pinkWhileWalking };
    // 2. The truck drives 1,100 px further on: they set off after it, patience paused.
    res.update(5, ring); const leftBefore = p.waitLeft;
    truck = along(r, 1600); ring = ringAt(truck);
    res.update(0.1, ring);
    const followsAgain = p.customer;
    until(ring, () => p.customer === 'waiting');
    const far = { state: p.customer, dist: Math.round(Math.hypot(p.pickup[0] - truck.x, p.pickup[1] - truck.y)), patienceKept: Math.abs(p.waitLeft - leftBefore) < 0.5 };
    // 3. After the sale, home.
    res.startServing(p); res.finishServing(p);
    until(ring, () => !p.outside, 400);
    return { near, far, followsAgain, home: !p.outside, speeds: [t.CUSTOMER_RUN_SPEED, t.RESIDENT_WALK_SPEED] };
  });
  check('Walking speeds halved: customers 37, residents 11 px/s', follow.speeds.join(','), '37,11');
  check('From the "!", they head straight for the truck (SCREAM-142)', follow.near.straight, true);
  check('...and wait near it (pink square within 300 px of the truck)', follow.near.state + ' ' + (follow.near.dist <= 300), 'waiting true');
  check('...their pink square is on the road', follow.near.onRoad, true);
  check('...and only appears once they stop', follow.near.pinkWhileWalking, false);
  check('The truck drives off: they set off after it again', follow.followsAgain, 'running');
  check('...no limit on how far: they catch up 1,600 px from home and wait', follow.far.state + ' ' + (follow.far.dist <= 300), 'waiting true');
  check('...their patience only counted down while they stood still', follow.far.patienceKept, true);
  check('After the sale they walk home', follow.home, true);

  console.log(`\n${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await browser.close();
})();
