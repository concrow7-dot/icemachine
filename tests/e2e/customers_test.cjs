const { chromium } = require('playwright');
(async () => {
  const [port, outDir] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  // These checks cover hard (car-style) driving; the title remembers the last difficulty picked
  await page.evaluate(() => localStorage.setItem('icemachine.difficulty', 'hard')); await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  const ev = (fn) => page.evaluate(`(() => { const e = window.__game.registry.get('evening'); return ${fn}; })()`);
  const scenes = () => page.evaluate(() => window.__game.scene.getScenes(true).map(s => s.scene.key).join(','));
  const drive = (fn) => page.evaluate(`(() => { const s = window.__game.scene.getScene('Drive'); return ${fn}; })()`);
  const wait = ms => page.waitForTimeout(ms);
  const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(40); } await wait(80); };
  const pickup = async () => { await drive('(s.truck.setPosition(s.pickupZone.x, s.pickupZone.y), s.speed = 0, s.parkBrake = true)'); await wait(300); };
  let pass = 0, fail = 0;
  const check = (name, got, want) => { const ok = String(got) === String(want); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(64) + ' got=' + got + (ok ? '' : ' want=' + want)); };

  // Map helpers (from the game's own map; SCREAM-10: roads by centre line, not tiles)
  const onRoad = (x, y) => page.evaluate(([x, y]) => window.__game.scene.getScene('Drive').roads.onRoad(x, y), [x, y]);
  const onSidewalk = (x, y) => page.evaluate(([x, y]) => { const r = window.__game.scene.getScene('Drive').roads; const g = r.nearestSegment(x, y); if (!g || r.onRoad(x, y)) return false; const vx = g.bx - g.ax, vy = g.by - g.ay, L2 = vx * vx + vy * vy; const t = Math.max(0, Math.min(1, ((x - g.ax) * vx + (y - g.ay) * vy) / L2)); return Math.hypot(x - g.ax - t * vx, y - g.ay - t * vy) <= 74; }, [x, y]);

  await page.click('canvas'); await press('Enter'); await wait(200);
  check('Evening start: no customer at the curb yet', await ev('e.roadCustomer'), null);
  check('...and no SOLD OUT badge during prep', await page.evaluate(() => window.__game.scene.getScene('Hud').soldOutText.visible), false);

  // Prep: buy 4 eclairs
  // The title now opens the cooler directly (#66)
  await press('+', 4); await press('Enter'); await wait(200);
  check('Bought 4 bars', await ev('e.stockLeft'), 4);
  check('Still no customer while in the truck before driving', await ev('e.roadCustomer'), null);
  await press('ArrowRight'); await press('Enter'); await wait(400);
  check('Driving off: one customer appears', await ev('e.roadCustomer !== null'), true);
  const spot1 = await ev('e.roadCustomer.spot');
  const hud = (fn) => page.evaluate(`(() => { const h = window.__game.scene.getScene('Hud'); return ${fn}; })()`);
  check('No customer timer in the HUD (curb customers wait until picked up)', await hud('h.patience === undefined'), true);

  // Placement: customer on the sidewalk (a non-road tile), pickup zone in the road
  const cust = await drive('[s.customer.x, s.customer.y]');
  const zone = await drive('[s.pickupZone.x, s.pickupZone.y]');
  check('Customer stands on the sidewalk (not the road)', await onSidewalk(cust[0], cust[1]), true);
  check('Pickup zone is in the road', await onRoad(zone[0], zone[1]), true);
  check('Customer is right beside the pickup zone (35px)', Math.round(Math.hypot(cust[0] - zone[0], cust[1] - zone[1])), 35);
  await drive('s.truck.setPosition(s.pickupZone.x - 300 < 100 ? s.pickupZone.x + 300 : s.pickupZone.x - 300, s.pickupZone.y)');
  await wait(400);
  await page.screenshot({ path: outDir + '/customer_curb.png' });

  // Every curb spot: sidewalk + road check, by forcing each spot
  const nSpots = await drive('s.map.curbSpots.length');
  let goodSpots = 0;
  for (let i = 0; i < nSpots; i++) {
    await ev(`(e.roadCustomerNow = { spot: ${i}, sinceMs: e.elapsedMs }, e.emit('road-customer-changed'))`);
    await wait(30);
    const c = await drive('[s.customer.x, s.customer.y]');
    const z = await drive('[s.pickupZone.x, s.pickupZone.y]');
    if ((await onSidewalk(c[0], c[1])) && (await onRoad(z[0], z[1]))) goodSpots++;
  }
  check(`All ${nSpots} curb spots: customer on sidewalk, pickup in road`, goodSpots, nSpots);
  check('Worcester has 34 curb spots, each on a named street', await drive("s.map.curbSpots.length + ' ' + s.map.curbSpots.every(c => s.roads.streetAt(c.x, c.y) !== '')"), '34 true');

  // Random spawns never repeat the same spot twice in a row
  let repeats = 0; let last = await ev('e.roadCustomer.spot');
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    await ev('e.spawnRoadCustomer()');
    const s = await ev('e.roadCustomer.spot'); seen.add(s);
    if (s === last) repeats++; last = s;
  }
  check('40 random spawns: never the same spot twice in a row', repeats, 0);
  check('...and they spread across the map (10+ different spots)', seen.size >= 10, true);

  // Curb customers wait as long as it takes (PO decision while testing PR #37)
  await ev('e.spawnRoadCustomer()');
  const before = await ev('e.roadCustomer.spot');
  await ev('e.tick(150000)'); await wait(700);
  check('After 2.5 minutes the same customer is still waiting', await ev('e.roadCustomer.spot'), before);
  check('...and is not flashing', await drive('s.customer.alpha'), 1);

  // SCREAM-16: the sale starts only at a full stop, with at least half the truck in the pink square
  check('Rolling through the square (creep speed): no sale', await drive('(s.setHeading(0), s.truck.setPosition(s.pickupZone.x, s.pickupZone.y), s.parkBrake = false, s.speed = 72, s.checkCustomer(), s.leaving)'), false);
  check('Stopped with under half the truck in the square: no sale', await drive('(s.truck.setPosition(s.pickupZone.x + 30, s.pickupZone.y), s.speed = 0, s.parkBrake = true, s.checkCustomer(), [s.pickupOverlap() < 0.5, s.leaving].join())'), 'true,false');
  await wait(300);
  check('...still driving', await scenes(), 'Drive,Hud');
  await drive('(s.truck.setPosition(s.pickupZone.x + 20, s.pickupZone.y), s.speed = 0, s.parkBrake = true)'); await wait(300);
  check('Stopped with over half the truck in the square: the sales screen opens straight away', (await scenes()) + ' ' + (await ev('e.sale !== null')), 'Sales,Hud true');
  check('No customer at the curb while one is at the window', await ev('e.roadCustomer'), null);

  // Drive off -> next customer at the curb
  const cashBefore = await ev('e.moneyCents');
  await press('b'); await wait(300);
  check('Driving off unserved: no money, next customer appears', ((await ev('e.moneyCents')) - cashBefore) + ' ' + (await ev('e.roadCustomer !== null')), '0 true');


  // Pickup zone needs the curb lane: a truck in the far lane doesn't trigger it
  const z2 = await drive('[s.pickupZone.x, s.pickupZone.y, s.customer.x, s.customer.y]');
  const awayX = z2[0] - (z2[2] - z2[0]) * 60 / 35, awayY = z2[1] - (z2[3] - z2[1]) * 60 / 35;
  await drive(`s.truck.setPosition(${awayX}, ${awayY})`); await wait(300);
  check('Truck in the far lane (60px from the zone) does not pick up', await scenes(), 'Drive,Hud');

  // Sold out: new evening, buy one ice cream (the cooler can't be left empty), then empty the cooler and drive
  await page.keyboard.down('Shift'); await page.keyboard.press('Digit3'); await page.keyboard.up('Shift'); await wait(300); await page.evaluate(() => { const s = window.__game.scene.getScene('Results'); if (s.entering) s.save(); }); await wait(100); await press('Enter'); await wait(300);
  await press('+'); await press('Enter'); await wait(200);
  await page.evaluate(() => { window.__game.registry.get('evening').coolerSlots.forEach(s => { s.quantity = 0; }); });
  await press('ArrowRight'); await press('Enter'); await wait(400);
  check('Empty cooler on the road: no customers', await ev('e.roadCustomer'), null);
  check('...and the HUD says SOLD OUT', await page.evaluate(() => window.__game.scene.getScene('Hud').soldOutText.visible), true);
  check('...marker and pointer hidden', (await drive('s.customer.visible')) + ' ' + (await drive('s.pointer.visible')), 'false false');
  await page.screenshot({ path: outDir + '/sold_out.png' });

  console.log(`\n${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await browser.close();
})();
