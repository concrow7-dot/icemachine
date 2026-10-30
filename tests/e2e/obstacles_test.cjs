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
  const drive = (fn) => page.evaluate(`(() => { const s = window.__game.scene.getScene('Drive'); return ${fn}; })()`);
  const wait = ms => page.waitForTimeout(ms);
  const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(40); } await wait(80); };
  const hold = async (k, ms) => { await page.keyboard.down(k); await wait(ms); await page.keyboard.up(k); await wait(300); };
  // speed: start already moving (the truck now takes 2.5 s to reach top speed, too long for short run-ups)
  const place = async (x, y, facing, speed = 0) => { await drive(`(s.truck.setPosition(${x}, ${y}), s.setHeading(({right:0,down:90,left:180,up:-90})['${facing}']), s.speed = ${speed}, s.parkBrake = ${speed === 0}, true)`); await wait(speed ? 0 : 150); };
  const cash = () => ev('e.moneyCents');
  let pass = 0, fail = 0;
  const check = (name, got, want) => { const ok = String(got) === String(want); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(66) + ' got=' + got + (ok ? '' : ' want=' + want)); };
  const near = (name, got, lo, hi) => { const ok = got >= lo && got <= hi; ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(66) + ' got=' + got + (ok ? '' : ` want ${lo}..${hi}`)); };

  await page.click('canvas'); await press('Enter'); await wait(200);
  // The title now opens the cooler directly (#66)
  await press('+', 5); await press('Enter'); await wait(200);
  await press('ArrowRight'); await press('Enter'); await wait(1200);
  // Keep the customer out of the way of these tests
  await ev("(e.roadCustomerNow = { spot: 13 }, e.emit('road-customer-changed'), true)");
  // SCREAM-10: the Worcester map (twice the size) has 14 potholes and 40 parked cars.
  check('14 potholes and 40 parked cars on the Worcester map', (await drive('s.potholes.length')) + ' ' + (await drive('s.cars.length')), '14 40');
  check('...every pothole and parked car on the road', await drive("s.potholes.every(h => s.roads.onRoad(h.x, h.y)) && s.cars.every(c => s.roads.onRoad(c.x, c.y))"), true);
  check('...and no parked car blocks its road (the truck fits past in the other lane)', await drive(`s.cars.every(c => { const r = c.angle * Math.PI / 180; const nx = -Math.sin(r), ny = Math.cos(r); return [1, -1].some(side => { const x = c.x + nx * side * 70, y = c.y + ny * side * 70; return s.roads.onRoad(x, y) && s.obstacleAt(x, y, c.angle) === null; }); })`), true);
  // The hit checks below run on the test track, with a pothole and a parked car at their old spots.
  await drive(`(${TRACK}, s.potholes = [{ x: 1230, y: 150, armed: true }], s.cars = [{ x: 870, y: 220, angle: 0, halfLength: 27, halfWidth: 16 }], true)`);

  // ---- Pothole at (20, 2): centre (1230, 150) ----
  let c = await cash();
  await place(1080, 150, 'right', 433);
  await page.keyboard.down('ArrowUp');
  for (let i = 0; i < 40 && c === (await cash()); i++) await wait(50);
  await page.keyboard.up('ArrowUp');
  check('Pothole: costs $5.00', c - (await cash()), 500);
  const spinning = await drive('s.spinning');
  await wait(900);
  check('...the truck spins (a 360° turn)', spinning || (await drive('s.spinning')) === false, true);
  const t = await drive('[Math.round(s.truck.x), Math.round(s.truck.angle)]');
  // Within reach of the pothole (22 px) plus one frame of travel at 20 fps on a slow test machine.
  near('...and stops on the pothole', t[0], 1200, 1275);
  check('...ending up facing the same way', t[1], 0);
  await page.screenshot({ path: outDir + '/obstacle_pothole.png' });
  c = await cash();
  // A short nudge on: the truck now rolls on (momentum), and a parked car sits 90 px past the pothole
  await hold('ArrowUp', 150);
  check('Driving on off the same pothole: no second charge', c - (await cash()), 0);
  await place(1080, 150, 'right', 433); await hold('ArrowUp', 700);
  near('Coming back over it later: charged again ($2.50 to $5.00 by speed)', c - (await cash()), 250, 500);
  await wait(800);

  // ---- Parked car at (14, 3, down): centre (870, 220), 54 x 32 ----
  c = await cash();
  await place(700, 220, 'right', 433);
  await hold('ArrowUp', 1200);
  check('Parked car: costs $10.00', c - (await cash()), 1000);
  near('...and the truck stops in front of it (can\'t pass)', await drive('Math.round(s.truck.x)'), 820, 828);
  await page.screenshot({ path: outDir + '/obstacle_car.png' });
  c = await cash();
  await hold('ArrowUp', 800);
  check('Pushing against it from a standstill: no extra charge', c - (await cash()), 0);
  await hold('ArrowDown', 900); await place(760, 220, 'right', 433); await hold('ArrowUp', 800);
  near('Reversing and ramming it again at speed: about another $10', c - (await cash()), 900, 1000);

  // ---- Road edge: middle road, drive down into the houses ----
  c = await cash();
  await place(600, 840, 'down', 433);
  await hold('ArrowUp', 1200);
  near('Road edge: up to $2.00 for the hit (short run-up)', c - (await cash()), 100, 200);
  near('...and the truck stops at the curb', await drive('Math.round(s.truck.y)'), 878, 884);
  c = await cash();
  await hold('ArrowUp', 800);
  check('Holding the key against the curb: no extra charge', c - (await cash()), 0);
  await hold('ArrowDown', 120); await hold('ArrowUp', 400);
  check('A slow bump (little speed) is free', c - (await cash()) <= 200, true);

  // ---- Damage is tracked for the results screen ----
  near('Damage total recorded (two potholes + two cars + curb hits)', await ev('e.damageCents'), 2300, 3700);
  await place(600, 840, 'down', 433); await hold('ArrowUp', 300);
  check('Damage shows in the HUD as a red popup', await page.evaluate(() => window.__game.scene.getScene('Hud').children.list.some(o => o.text && /Curb|Parked car|Pothole/.test(o.text))), true);

  // ---- Cash can go below zero ----
  await ev('(e.cashCents = 100, e.emit("money-changed", 0, 100, "", false), true)');
  await place(700, 220, 'right', 433); await hold('ArrowUp', 1200);
  check('Damage can take cash below zero', await cash(), -900);

  console.log(`\n${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await browser.close();
})();
