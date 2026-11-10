const { chromium } = require('playwright');
const { TRACK } = require('./track.cjs');
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
  // SCREAM-75: the map's first load ran the loading screen, which closed once it was done
  const loadingNow = () => page.evaluate(() => window.__game.scene.isActive('Loading'));
  check('The driving view\'s first load showed the loading screen, then closed it', (await page.evaluate(() => window.__game.registry.get('loadingShown') >= 1)) + ' ' + (await loadingNow()), 'true false');
  await page.keyboard.down('Shift'); await page.keyboard.press('Digit5'); await page.keyboard.up('Shift'); await wait(1500);
  const loadingLook = await page.evaluate(() => { const l = window.__game.scene.getScene('Loading'); const layer = l.children.getByName('loading-layer'); return [l.scene.isActive(), layer.alpha, layer.list.filter(o => o.name === 'loading-note').length > 5, !!layer.getByName('loading-truck')]; });
  check('Shift+5: the loading screen shows the truck leaving a trail of notes that stays', loadingLook.join(' '), 'true 1 true true');
  await page.screenshot({ path: outDir + '/loading.png' });
  await wait(4000);
  check('...and closes after 5 seconds', await loadingNow(), false);
  // SCREAM-10: Home is on Longfellow Road (proposal); the truck starts in its lane, pointing along the road.
  const home = await truck();
  check('Truck starts outside Home, on Longfellow Road', await drive('s.roads.streetAt(s.truck.x, s.truck.y)'), 'Longfellow Road');
  check('...clear of the curb, pointing along the road', await drive(`(() => { const g = s.roads.nearestSegment(s.truck.x, s.truck.y); const t = Math.atan2(g.by - g.ay, g.bx - g.ax) * 180 / Math.PI; const off = Math.abs(((s.heading - t + 540) % 360) - 180); return (s.obstacleAt(s.truck.x, s.truck.y) === null) + ' ' + (off < 1 || off > 179); })()`), 'true true');
  check('Prep locked', await ev('e.isPrepLocked'), true);
  const cam = await page.evaluate(() => { const c = window.__game.scene.getScene('Drive').cameras.main; return [c.y, c.height].join(','); });
  check('Camera sits below the HUD (y=44, height 496)', cam, '44,496');
  await page.screenshot({ path: outDir + '/drive_start.png' });

  check('The music ring is drawn round the truck (SCREAM-67)', await drive('s.ring.visible && Math.round(s.ring.x) === Math.round(s.truck.x) && Math.round(s.ring.y) === Math.round(s.truck.y)'), true);

  // Nobody wants ice cream during the driving checks, so driving never starts a sale by accident
  await ev('(e.residents.hearingOff = true, true)');
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
  check('Gas for 1s from a stop: slow to get going, like a train (well short of top speed)', (speed1 > 0 && speed1 < 547 * 0.75) + ' ' + (t1.x - t0.x > 20), 'true true');
  check('...in a straight line', t1.y, t0.y);
  await wait(800);
  const tc = await truck(); await wait(300);
  check('Let go: the truck keeps creeping forward', (await truck()).x > tc.x, true);
  // SCREAM-231: hold S until the truck has actually stopped (a fixed 250 ms was too short on a slow machine), then Q.
  await page.keyboard.down('s');
  await page.waitForFunction(() => Math.abs(window.__game.scene.getScene('Drive').speed) < 1, null, { timeout: 5000 });
  await page.keyboard.press('q'); await page.keyboard.up('s'); await wait(300);
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
  // SCREAM-115: the truck's nose is truckHalf.length ahead of its middle (52 px since the LimeZu truck).
  const nose = Math.round((await ds('truckHalf')).length);
  near('Blocked by houses below the road (its nose at the edge, y = 900)', (await truck()).y + nose, 894, 902);
  await aim(600, 840, -90); await driveUntilStop('ArrowUp');
  near('Blocked by houses above the road (its nose at the edge, y = 780)', (await truck()).y - nose, 778, 786);

  // Map edge: along the middle road to the far-left road, then up its open lane to the top road
  await aim(450, 840, 180); await driveUntilStop('ArrowUp');
  // The truck's nose stops it at the map edge (x about 120), whatever the truck's size.
  near('Left edge stops the truck at its nose (x about 120)', (await truck()).x - nose, 117, 123);
  check('No pointer arrow (SCREAM-68)', await page.evaluate(() => window.__game.scene.getScene('Drive').pointer), undefined);
  await aim(210, 840, -90); await driveUntilStop('ArrowUp');
  near('Top edge stops the truck at its nose (y about 120)', (await truck()).y - nose, 117, 123);
  // SCREAM-114: zoomed in, the top of what's shown (worldView) is the map's top edge.
  const camTop = await page.evaluate(() => window.__game.scene.getScene('Drive').cameras.main.worldView.y);
  check('Camera follows to the top of the map', Math.round(camTop), 0);

  // Pull into the customer's pickup zone
  const clockBefore = await ev('e.clockMinutes');
  await wait(1000);
  await ev("e.residents.callNow(e.residents.all.find(p => p.customer === 'none'))"); await wait(200);
  await page.evaluate(() => { const s = window.__game.scene.getScene('Drive'); (s.truck.setPosition(s.pickupZone.x, s.pickupZone.y), s.speed = 0, s.parkBrake = true); }); await wait(300);
  check('Driving into the customer opens the sales screen', await scenes(), 'Sales,Hud');
  check('...with a customer at the window', await ev('e.customerWaiting'), true);
  check('...and the window knows which resident it is', await ev("e.customer && e.customer.customer"), 'window');
  const parked = await ev('JSON.stringify({x: Math.round(e.truck.x), y: Math.round(e.truck.y)})');
  near('Clock kept running while driving', (await ev('e.clockMinutes')) - clockBefore, 0.3, 30);

  const cashBefore = await ev('e.moneyCents');
  // On a slow machine the sales screen's loading screen can still be up: wait for it to clear before B.
  await page.waitForFunction(() => window.__game.scene.isActive('Sales') && !window.__game.scene.isActive('Loading'), null, { timeout: 10000 });
  await wait(500); await press('b'); await wait(300);
  check('B: drive off, straight back on the road, no money', (await scenes()) + ' ' + ((await ev('e.moneyCents')) - cashBefore), 'Drive,Hud 0');
  check('Truck resumes where it stopped', JSON.stringify({ x: (await truck()).x, y: (await truck()).y }), parked);
  check('The customer walks home afterwards (no second sale)', await ev("e.residents.all.filter(p => p.customer === 'done').length"), 1);

  // Evening ends while driving (debug is Shift+3 now)
  await page.keyboard.down('Shift'); await page.keyboard.press('Digit3'); await page.keyboard.up('Shift'); await wait(300);
  check('Evening ends from the driving view: results', await scenes(), 'Results');
  // A first evening makes the (empty) high score table: save the initials to continue (#16)
  await page.evaluate(() => { const s = window.__game.scene.getScene('Results'); if (s.entering) s.save(); }); await wait(100); 
  await press('Enter'); await wait(300);
  check('New evening: truck back at Home, no customer until you drive', (await ev('JSON.stringify([Math.round(e.truck.x), Math.round(e.truck.y), Math.round(e.truck.angle), e.residents.waiting.length])')), JSON.stringify([home.x, home.y, home.angle, 0]));


  console.log(`\n${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await browser.close();
})();
