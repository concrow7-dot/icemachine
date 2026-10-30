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
  const scenes = () => page.evaluate(() => window.__game.scene.getScenes(true).map(s => s.scene.key).join(','));
  const sel = () => page.evaluate(() => window.__game.scene.getScene('Truck').selected);
  const clock = () => page.evaluate(() => window.__game.registry.get('evening')?.clockMinutes.toFixed(2));
  const wait = ms => page.waitForTimeout(ms);
  const press = async k => { await page.keyboard.press(k); await wait(150); };
  let pass = 0, fail = 0;
  const check = (name, got, want) => { const ok = String(got) === String(want); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(52) + ' got=' + got + (ok ? '' : ' want=' + want)); };

  await page.click('canvas'); await press('Enter'); await wait(200);
  check('Enter on title opens the cooler first (#66)', await scenes(), 'Cooler,Hud');
  const clockAt = async () => page.evaluate(() => window.__game.registry.get('evening').clockMinutes);
  const k0 = await clockAt(); await wait(1200);
  check('...with the clock waiting at 5:00 PM', (await clockAt()) === k0 && Math.floor(k0) === 1020, true);
  check('...and a note saying so', await page.evaluate(() => window.__game.scene.getScene('Cooler').children.list.some(o => o.text && o.text.startsWith('The clock starts when you leave the cooler'))), true);
  await press('b'); await wait(200);
  check("B with an empty cooler: can't leave yet", await scenes(), 'Cooler,Hud');
  await press('+'); await press('Enter'); await wait(200);
  check('Buying one ice cream leaves for the truck hub', await scenes(), 'Truck,Hud');
  const k1 = await clockAt(); await wait(1200);
  check('...and the clock starts', (await clockAt()) > k1, true);
  check('Cooler highlighted by default', await sel(), 'cooler');
  await page.screenshot({ path: outDir + '/hub_no_customer.png' });
  await press('ArrowRight');
  check('Right -> driver seat', await sel(), 'driver');
  await press('ArrowRight');
  check('Right again skips unavailable window -> cooler', await sel(), 'cooler');
  await press('ArrowLeft');
  check('Left from cooler skips window -> driver', await sel(), 'driver');
  // Mouse on unavailable window: no highlight, no action
  await page.mouse.move(790, 250); await wait(150);
  check('Hovering unavailable window keeps highlight', await sel(), 'driver');
  await page.mouse.click(790, 250); await wait(250);
  check('Clicking unavailable window does nothing', await scenes(), 'Truck,Hud');
  // The window is only for a sale in progress (#13): customers now go straight to the sales screen
  await press('ArrowRight');
  check('Window stays greyed out in the hub (no sale)', await sel(), 'cooler');
  await press('ArrowRight');
  await press('ArrowLeft');
  // mouse hover + click cooler
  await page.mouse.move(180, 360); await wait(150);
  check('Hover cooler highlights it', await sel(), 'cooler');
  await page.mouse.click(180, 360); await wait(250);
  check('Click cooler opens cooler screen', await scenes(), 'Cooler,Hud');
  await press('Backspace'); await wait(150);
  check('Backspace returns to truck', await scenes(), 'Truck,Hud');
  check('...with cooler highlighted', await sel(), 'cooler');
  // driver seat via keyboard
  await press('ArrowRight'); await press('Enter');
  await page.waitForFunction(() => window.__game.scene.getScenes(true).map(s => s.scene.key).join(',') === 'Drive,Hud', null, { timeout: 3000 }).catch(() => {}); // slow machines take longer to switch
  check("Enter on driver's seat opens driving view", await scenes(), 'Drive,Hud');
  const c1 = await clock(); await wait(1200); const c2 = await clock();
  check('Clock keeps running while driving', Number(c2) > Number(c1), true);
  await page.evaluate(() => { const e = window.__game.registry.get('evening'); e.coolerSlots[0].quantity = 3; e.spawnRoadCustomer(); }); await wait(100);
  await page.evaluate(() => { const s = window.__game.scene.getScene('Drive'); (s.truck.setPosition(s.pickupZone.x, s.pickupZone.y), s.speed = 0, s.parkBrake = true); }); await wait(300);
  check('Reaching a customer opens the sales screen', await scenes(), 'Sales,Hud');
  const c3 = await clock(); await wait(1200); const c4 = await clock();
  check('Clock keeps running at the window', Number(c4) > Number(c3), true);
  await press('1');
  check('Plain 1 does nothing (free for typing prices)', await page.evaluate(() => window.__game.registry.get('evening').moneyCents), 4900);
  await page.keyboard.down('Shift'); await page.keyboard.press('Digit1'); await page.keyboard.up('Shift'); await wait(200);
  check('Shift+1 adds $4.50', await page.evaluate(() => window.__game.registry.get('evening').moneyCents), 5350);
  await press('b'); await wait(300);
  await page.keyboard.down('Shift'); await page.keyboard.press('Digit3'); await page.keyboard.up('Shift'); await wait(200);
  check('Shift+3 ends the evening from the road', await scenes(), 'Results');
  // A first evening makes the (empty) high score table: save the initials to continue (#16)
  await page.evaluate(() => { const s = window.__game.scene.getScene('Results'); if (s.entering) s.save(); }); await wait(100); 
  await press('Enter'); await wait(250);
  check('New evening opens at the cooler again, clock waiting', (await scenes()) + ' ' + (await page.evaluate(() => window.__game.registry.get('evening').isClockRunning)), 'Cooler,Hud false');
  check('New evening has no customer waiting', await page.evaluate(() => window.__game.registry.get('evening').customerWaiting), false);
  console.log(`\n${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await browser.close();
})();
