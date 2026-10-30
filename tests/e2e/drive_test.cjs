const { chromium } = require('playwright');
const { TRACK } = require('./track.cjs');
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
  const truck = () => page.evaluate(() => { const t = window.__game.scene.getScene('Drive').truck; return { x: Math.round(t.x), y: Math.round(t.y), angle: Math.round(t.angle) }; });
  const drive = (fn) => page.evaluate(`(() => { const s = window.__game.scene.getScene('Drive'); const e = window.__game.registry.get('evening'); return ${fn}; })()`);
  const ds = (k) => page.evaluate((k) => window.__game.scene.getScene('Drive')[k], k);
  const wait = ms => page.waitForTimeout(ms);
  const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(40); } await wait(80); };
  const hold = async (k, ms) => { await page.keyboard.down(k); await wait(ms); await page.keyboard.up(k); await wait(250); };
  // Drives in one direction until the truck stops moving (hits a wall) or a scene change.
  const driveUntilStop = async (k, maxMs = 15000) => {
    await page.keyboard.down(k);
    let last = null; const start = Date.now();
    while (Date.now() - start < maxMs) {
      await wait(300);
      if ((await scenes()) !== 'Drive,Hud') break;
      const t = await truck();
      if (last && t.x === last.x && t.y === last.y) break;
      last = t;
    }
    await page.keyboard.up(k); await wait(250);
  };
  let pass = 0, fail = 0;
  const check = (name, got, want) => { const ok = String(got) === String(want); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(62) + ' got=' + got + (ok ? '' : ' want=' + want)); };
  const near = (name, got, lo, hi) => { const ok = got >= lo && got <= hi; ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(62) + ' got=' + got + (ok ? '' : ` want ${lo}..${hi}`)); };

  await page.click('canvas'); await press('Enter'); await wait(200);
  // Buy 5 Chocolate Eclairs so customers come (#12: none when sold out)
  // The title now opens the cooler directly (#66)
  await press('+', 5); await press('Enter'); await wait(200);
  await press('ArrowRight'); await press('Enter'); await wait(300);
  check("Driver's seat opens the driving view", await scenes(), 'Drive,Hud');
  // SCREAM-10: Home is on Longfellow Road (proposal); the truck starts in its lane, pointing along the road.
  const home = await truck();
  check('Truck starts outside Home, on Longfellow Road', await drive('s.roads.streetAt(s.truck.x, s.truck.y)'), 'Longfellow Road');
  check('...clear of the curb, pointing along the road', await drive(`(() => { const g = s.roads.nearestSegment(s.truck.x, s.truck.y); const t = Math.atan2(g.by - g.ay, g.bx - g.ax) * 180 / Math.PI; const off = Math.abs(((s.heading - t + 540) % 360) - 180); return (s.obstacleAt(s.truck.x, s.truck.y) === null) + ' ' + (off < 1 || off > 179); })()`), 'true true');
  check('Prep locked', await ev('e.isPrepLocked'), true);
  const cam = await page.evaluate(() => { const c = window.__game.scene.getScene('Drive').cameras.main; return [c.y, c.height].join(','); });
  check('Camera sits below the HUD (y=44, height 496)', cam, '44,496');
  await page.screenshot({ path: outDir + '/drive_start.png' });

  check('A customer is waiting at the curb', await page.evaluate(() => window.__game.scene.getScene('Drive').customer.visible), true);

  // Park the customer far from the test route so driving doesn't start a sale by accident
  await ev("(e.roadCustomerNow = { spot: 2 }, e.emit('road-customer-changed'), true)");
  // The driving checks below run on the test track (the old map's straight roads), from the old Home spot.
  await drive(TRACK);
  await drive('(s.truck.setPosition(450, 840), s.setHeading(0), s.speed = 0, s.parkBrake = true, true)');
  // Speed: hold right for 1 second (after the scene has warmed up)
  await wait(1500);
  const t0 = await truck();
  await page.keyboard.down('ArrowUp'); await wait(1000);
  const t1 = await truck();
  const speed1 = Math.round(await ds('speed'));
  await page.keyboard.up('ArrowUp');
  // Speed, not distance: on a slow test machine the two readings are well over 1 s apart.
  // (feel_test measures the exact acceleration frame by frame.)
  check('Gas for 1s from a stop: slow to get going, like a train (well short of top speed)', (speed1 > 0 && speed1 < 433 * 0.75) + ' ' + (t1.x - t0.x > 20), 'true true');
  check('...in a straight line', t1.y, t0.y);
  await wait(800);
  const tc = await truck(); await wait(300);
  check('Let go: the truck keeps creeping forward', (await truck()).x > tc.x, true);
  await page.keyboard.down('s'); await wait(250); await page.keyboard.press('q'); await page.keyboard.up('s'); await wait(300);
  const t2 = await truck(); await wait(300);
  check('S (brake) to a full stop, then Q (park brake): it stays stopped', JSON.stringify(await truck()), JSON.stringify(t2));

  // Holding S at a stop reverses after a moment (WASD works), still facing the same way
  await hold('s', 900);
  const t3 = await truck();
  check('S from a stop: reverses (moves backwards), still facing right', (t3.x < t2.x) + ' ' + t3.angle, 'true 0');

  // Steering: gas plus D turns the truck clockwise, to any angle
  await page.keyboard.down('w'); await wait(300); await page.keyboard.down('d'); await wait(150); await page.keyboard.up('d');
  const turned = (await truck()).angle;
  await page.keyboard.up('w'); await wait(600);
  near('W + a short D: turns part way, not a full 90 degrees', turned, 5, 80);

  // Walls, with the truck aimed straight
  const aim = (x, y, deg) => page.evaluate(([x, y, deg]) => { const s = window.__game.scene.getScene('Drive'); s.truck.setPosition(x, y); s.setHeading(deg); s.speed = 0; }, [x, y, deg]);
  await aim(600, 840, 90); await driveUntilStop('ArrowUp');
  near('Blocked by houses below the road (y<=884)', (await truck()).y, 860, 884);
  await aim(600, 840, -90); await driveUntilStop('ArrowUp');
  near('Blocked by houses above the road (y>=796)', (await truck()).y, 796, 820);

  // Map edge: along the middle road to the far-left road, then up its open lane to the top road
  await aim(450, 840, 180); await driveUntilStop('ArrowUp');
  near('Left edge stops the truck at its nose (x about 142)', (await truck()).x, 140, 146);
  check('Pointer arrow shows while customer is off screen', await page.evaluate(() => window.__game.scene.getScene('Drive').pointer.visible), true);
  await page.screenshot({ path: outDir + '/drive_pointer.png' });
  await aim(210, 840, -90); await driveUntilStop('ArrowUp');
  near('Top edge stops the truck at its nose (y about 142)', (await truck()).y, 140, 146);
  const camScroll = await page.evaluate(() => window.__game.scene.getScene('Drive').cameras.main.scrollY);
  check('Camera follows to the top of the map', Math.round(camScroll), 0);

  // Pull into the customer's pickup zone
  const clockBefore = await ev('e.clockMinutes');
  await wait(1000);
  await page.evaluate(() => { const s = window.__game.scene.getScene('Drive'); (s.truck.setPosition(s.pickupZone.x, s.pickupZone.y), s.speed = 0, s.parkBrake = true); }); await wait(300);
  check('Driving into the customer opens the sales screen', await scenes(), 'Sales,Hud');
  check('...with a customer at the window', await ev('e.customerWaiting'), true);
  check('...nobody else at the curb during the sale', await ev('e.roadCustomer'), null);
  const parked = await ev('JSON.stringify({x: Math.round(e.truck.x), y: Math.round(e.truck.y)})');
  near('Clock kept running while driving', (await ev('e.clockMinutes')) - clockBefore, 0.3, 30);

  const cashBefore = await ev('e.moneyCents');
  await wait(500); await press('b'); await wait(300);
  check('B: drive off, straight back on the road, no money', (await scenes()) + ' ' + ((await ev('e.moneyCents')) - cashBefore), 'Drive,Hud 0');
  check('Truck resumes where it stopped', JSON.stringify({ x: (await truck()).x, y: (await truck()).y }), parked);
  check('Next customer is waiting at the curb', await page.evaluate(() => window.__game.scene.getScene('Drive').customer.visible), true);

  // Evening ends while driving (debug is Shift+3 now)
  await page.keyboard.down('Shift'); await page.keyboard.press('Digit3'); await page.keyboard.up('Shift'); await wait(300);
  check('Evening ends from the driving view: results', await scenes(), 'Results');
  // A first evening makes the (empty) high score table: save the initials to continue (#16)
  await page.evaluate(() => { const s = window.__game.scene.getScene('Results'); if (s.entering) s.save(); }); await wait(100); 
  await press('Enter'); await wait(300);
  check('New evening: truck back at Home, no customer until you drive', (await ev('JSON.stringify([Math.round(e.truck.x), Math.round(e.truck.y), Math.round(e.truck.angle), e.roadCustomer])')), JSON.stringify([home.x, home.y, home.angle, null]));


  console.log(`\n${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await browser.close();
})();
