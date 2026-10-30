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
  const drive = (fn) => page.evaluate(`(() => { const s = window.__game.scene.getScene('Drive'); const e = window.__game.registry.get('evening'); return ${fn}; })()`);
  const wait = ms => page.waitForTimeout(ms);
  const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(40); } await wait(100); };
  let pass = 0, fail = 0;
  const check = (name, got, want) => { const ok = String(got) === String(want); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(68) + ' got=' + got + (ok ? '' : ' want=' + want)); };
  const near = (name, got, lo, hi) => { const ok = got >= lo && got <= hi; ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(68) + ' got=' + got + (ok ? '' : ` want ${lo}..${hi}`)); };

  await page.click('canvas'); await press('Enter'); await wait(200);
  // The title now opens the cooler directly (#66)
  await press('+', 5); await press('Enter'); await wait(200);
  await press('ArrowRight'); await press('Enter'); await wait(1200);
  await ev("(e.roadCustomerNow = { spot: 13 }, e.emit('road-customer-changed'), true)");

  // Frame-by-frame checks: drive the scene's own update with fixed 16 ms frames on an open stretch (top road).
  // The game loop is paused for these so only our frames move the truck.
  await drive("(s.scene.pause(), true)");
  // On the test track: the old map's straight roads (SCREAM-10).
  await drive(TRACK);

  // A frame loop that can hold the speed steady (keep = px/s) to measure turns cleanly.
  const run = (setup, frames, keep) => drive(`(() => { ${keep !== undefined ? 's.parkBrake = false;' : ''} ${setup}; const out = []; for (let i = 0; i < ${frames}; i++) { ${keep !== undefined ? `s.speed = ${keep};` : ''} s.update(0, 16); out.push([Math.round(s.truck.x), Math.round(s.truck.y), Math.round(s.heading), Math.round(s.speed)]); } return out; })()`);
  const sim = (setup, frames) => run(setup, frames);
  const startDamage = await ev('e.damageCents');

  // ---- Momentum: let go of the gas and the truck rolls ----
  let r = await sim("s.truck.setPosition(400, 180); s.setHeading(0); s.speed = 433; s.parkBrake = false; s.held = []", 40);
  const creepAt = r.findIndex(f => f[3] === 72);
  near('Let go at top speed: slows to a creep in about 0.34 s (frames)', creepAt + 1, 20, 23);
  check('...and keeps creeping (never stops on its own)', r.at(-1)[3] + ' ' + (r.at(-1)[0] > r.at(-2)[0]), '72 true');
  r = await sim("s.truck.setPosition(400, 180); s.setHeading(0); s.speed = 72; s.parkBrake = false; s.held = ['right']", 20);
  near('Steering while creeping still turns the truck (degrees)', r.at(-1)[2], 25, 40);

  // ---- Slow to pick up speed, like a train ----
  r = await sim("s.truck.setPosition(150, 180); s.setHeading(0); s.speed = 0; s.held = ['up']", 165);
  near('Gas from a stop: after 1 s, only about 40% of top speed (px/s)', r[61][3], 165, 182);
  near('...full speed takes about 2.5 s (frames of 16 ms)', r.findIndex(f => f[3] === 433) + 1, 150, 160);

  // ---- Brake, then reverse ----
  r = await sim("s.truck.setPosition(400, 180); s.setHeading(0); s.speed = 433; s.parkBrake = false; s.held = ['down']", 50);
  const stopped = r.findIndex(f => f[3] <= 0);
  near('Down arrow at speed: brakes to a full stop in about 0.15 s (frames)', stopped + 1, 9, 11);
  near('...sliding only about 33 px', r[stopped][0] - 400, 26, 38);
  check('...waits a moment at a stop (0.4 s) before reversing', r[stopped + 20][3], 0);
  check('...then reverses: backwards, still facing forward', (r.at(-1)[0] < r[stopped][0]) + ' ' + r.at(-1)[2] + ' ' + (r.at(-1)[3] < 0), 'true 0 true');
  r = await sim("s.truck.setPosition(700, 180); s.setHeading(0); s.speed = 0; s.parkBrake = false; s.held = ['down']", 90);
  check('Reverse tops out at a quarter of top speed: 433 / 4, about 108 px/s (ICE-13)', -Math.min(...r.map(f => f[3])), Math.round(433 / 4));
  r = await sim("s.truck.setPosition(400, 180); s.setHeading(0); s.speed = 60; s.parkBrake = false; s.held = ['down']", 8);
  let r2 = await sim("s.held = []", 40);
  check('Brake to a stop, then let go: it rolls on at a creep (no park brake)', r2.at(-1)[3] + ' ' + (r2.at(-1)[0] > r2[0][0]), '72 true');
  await sim("s.held = ['down']", 15);
  await drive("(s.held = [], s.toggleParkBrake(), true)");
  r2 = await sim("s.held = []", 40);
  check('Brake to a stop, then Q: park brake on, the truck stays put', (await drive('s.parkBrake')) + ' ' + r2.at(-1)[3] + ' ' + (r2.at(-1)[0] === r2[0][0]), 'true 0 true');
  check('...and a PARK BRAKE sign shows', await drive('s.parkLabel.visible'), true);
  r2 = await sim("s.held = ['up']", 10);
  check('Gas releases the park brake and drives off', (await drive('s.parkBrake')) + ' ' + (r2.at(-1)[3] > 0), 'false true');
  await drive("(s.speed = 200, s.toggleParkBrake(), true)");
  check('Q faster than a creep: not engaged', await drive('s.parkBrake'), false);
  check('...and a message says to slow down first', await drive("s.notice && s.notice.active && s.notice.text"), 'Slow to a creep to use the park brake');
  await drive("(s.parkBrake = false, s.held = [], s.speed = 72, s.toggleParkBrake(), true)");
  r2 = await sim("s.held = []", 20);
  check('Q while creeping (#64): park brake on, truck stops on the spot', (await drive('s.parkBrake')) + ' ' + r2.at(-1)[3] + ' ' + (r2.at(-1)[0] === r2[0][0]), 'true 0 true');
  await drive("(s.parkBrake = false, s.speed = -175, s.toggleParkBrake(), true)");
  r2 = await sim("s.held = []", 20);
  check('Q while reversing (#64): park brake on, truck stops', (await drive('s.parkBrake')) + ' ' + r2.at(-1)[3], 'true 0');

  // ---- No flipping round on the spot ----
  r = await sim("s.truck.setPosition(400, 180); s.setHeading(0); s.speed = 0; s.parkBrake = true; s.held = ['left']", 20);
  check('Steering while stopped (park brake on) does nothing: a car can\'t turn on the spot', r.at(-1)[2], 0);

  // ---- Any angle ----
  r = await run("s.truck.setPosition(400, 180); s.setHeading(0); s.held = ['right']", 5, 300);
  near('A quick tap of right: about 15 degrees', r.at(-1)[2], 13, 18);
  r = await run("s.truck.setPosition(400, 180); s.setHeading(0); s.held = ['right']", 14, 300);
  near('A bit longer: about 45 degrees', r.at(-1)[2], 42, 48);
  r = await run("s.truck.setPosition(400, 180); s.setHeading(0); s.held = ['left']", 5, 300);
  near('Left turns the other way (anticlockwise)', r.at(-1)[2], -18, -13);

  // ---- A U-turn like a car, across the two-lane middle road ----
  r = await run("s.truck.setPosition(450, 800); s.setHeading(0); s.held = ['right']", 60, 150);
  near('Slow U-turn: facing back the way it came (|heading|)', Math.abs(r.at(-1)[2]), 170, 180);
  near('...in a half circle into the other lane (moved down px)', r.at(-1)[1] - 800, 70, 90);
  check('...without hitting anything', (await ev('e.damageCents')) - startDamage, 0);

  // ---- Turns get wider at speed ----
  const radiusAt = async (speed) => drive(`(() => { s.parkBrake = false; s.truck.setPosition(1200, 840); s.setHeading(0); s.held = ['right']; let path = 0; for (let i = 0; i < 10; i++) { s.speed = ${speed}; const x = s.truck.x, y = s.truck.y; s.update(0, 16); path += Math.hypot(s.truck.x - x, s.truck.y - y); } return Math.round(path / (s.heading * Math.PI / 180)); })()`);
  near('Tightest turn (slow): radius about 40 px', await radiusAt(100), 35, 45);
  near('At top speed the turn is wider: radius about 124 px', await radiusAt(433), 110, 135);
  r = await sim("s.truck.setPosition(1200, 840); s.setHeading(0); s.speed = 433; s.held = ['up', 'right']", 1);
  near('Turning hard at top speed scrubs a little speed off', r[0][3], 420, 432);

  // ---- In reverse, the wheel works the other way round ----
  r = await run("s.truck.setPosition(600, 840); s.setHeading(0); s.held = ['right']", 5, -100);
  check('Reversing with right held turns the nose the other way', r.at(-1)[2] < 0, true);

  // ---- Glancing off the curb slides along it ----
  const before = await ev('e.damageCents');
  r = await run("s.truck.setPosition(600, 878); s.setHeading(20); s.held = ['up']", 15, 200);
  check('Shallow angle into the curb: slides along it, no charge', ((await ev('e.damageCents')) - before) + ' ' + (r.at(-1)[0] - 600 > 40), '0 true');

  // ---- Passing a parked car (PO screenshot, PR #58) ----
  const carCase = await drive(`(() => {
    // The test track's parked car, against the left curb of the x = 1020 road (turned boxes since SCREAM-10).
    const k = s.cars[0];
    const c = { left: k.x - k.halfWidth, right: k.x + k.halfWidth, top: k.y - k.halfLength, bottom: k.y + k.halfLength };
    const before = e.damageCents;
    const clearX = c.right + 15;
    const clearNow = s.obstacleAt(clearX, (c.top + c.bottom) / 2, 90) === null;
    s.truck.setPosition(clearX + 1, c.top + 8); s.setHeading(97); s.held = ['up']; s.parkBrake = false;
    for (let i = 0; i < 90; i++) { s.speed = 120; s.update(0, 16); }
    return [clearNow, Math.round(s.truck.y) > c.bottom + 20, e.damageCents - before];
  })()`);
  check('A truck that looks clear of a parked car is clear (shape matches the drawing)', carCase[0], true);
  check('Driving past a parked car angled slightly into it: slides by, not stuck', carCase[1], true);
  check('...without a charge', carCase[2], 0);
  const turnBlocked = await drive(`(() => { s.truck.setPosition(600, 878); s.setHeading(0); s.held = ['right']; s.parkBrake = false; for (let i = 0; i < 20; i++) { s.speed = 100; s.update(0, 16); } return [Math.round(s.heading), s.obstacleAt(s.truck.x, s.truck.y)]; })()`);
  check('Steering beside a wall can\'t swing the truck into it', turnBlocked[1], null);

  // ---- Harder hits cost more ----
  const hit = async (kind, speed) => drive(`(() => { const before = e.damageCents; s.setHeading(0); s.speed = ${speed}; s.crash('${kind}'); return e.damageCents - before; })()`);
  check('Parked car at top speed: full $10.00', await hit('car', 433), 1000);
  check('Parked car at half speed: $6.75 (between half and full)', await hit('car', 216.5), 675);
  check('Parked car at the slowest hit that counts (1/4 speed): half, $5.00', await hit('car', 108.25), 500);
  check('Curb at top speed: $2.00', await hit('edge', 433), 200);
  check('Curb at 1/4 speed: $1.00', await hit('edge', 108.25), 100);
  const holeCost = await drive(`(() => { const before = e.damageCents; const h = s.potholes[0]; h.armed = true; s.truck.setPosition(h.x, h.y); s.speed = 40; s.checkPotholes(); return e.damageCents - before; })()`);
  check('Pothole crept over slowly: half price, $2.50', holeCost, 250);
  check('...the popup shows the lower price', await drive("s.children.list.some(o => o.type === 'Text' && o.text === '-$2.50')"), true);
  await wait(800);

  // ---- With real keys, in the running game ----
  await drive("(s.held = [], s.speed = 0, s.spinning = false, s.tweens.killAll(), s.setHeading(0), s.truck.setPosition(400, 180), s.scene.resume(), true)");
  await drive('(s.speed = 433, s.parkBrake = false, true)');
  await wait(200);
  await page.keyboard.down('ArrowUp'); await wait(800);
  const xAtRelease = await drive('s.truck.x');
  await page.keyboard.up('ArrowUp'); await wait(700);
  near('Real keys: after letting go, the truck rolls on and keeps creeping (px)', Math.round((await drive('s.truck.x')) - xAtRelease), 70, 170);
  check('...at creep speed', Math.round(await drive('s.speed')), 72);
  await page.keyboard.press('q'); await wait(400);
  const xStopped = await drive('Math.round(s.truck.x)'); await wait(400);
  check('Real keys: while creeping, a single Q stops it and it stays stopped', (await drive('Math.round(s.truck.x)')) - xStopped + ' ' + (await drive('s.parkLabel.visible')), '0 true');

  console.log(`\n${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await browser.close();
})();
