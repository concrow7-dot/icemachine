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
  // Nobody wants ice cream during these checks, so driving never starts a sale (SCREAM-67)
  await ev('(e.residents.hearingOff = true, true)');

  // Frame-by-frame checks: drive the scene's own update with fixed 16 ms frames on an open stretch (top road).
  // The game loop is paused for these so only our frames move the truck.
  await drive("(s.scene.pause(), true)");
  // On the test track: the old map's straight roads (SCREAM-10).
  await drive(TRACK);

  // A frame loop that can hold the speed steady (keep = px/s) to measure turns cleanly.
  const run = (setup, frames, keep) => drive(`(() => { ${keep !== undefined ? 's.parkBrake = false;' : ''} ${setup}; const out = []; for (let i = 0; i < ${frames}; i++) { ${keep !== undefined ? `s.speed = ${keep};` : ''} s.update(0, 16); out.push([Math.round(s.truck.x), Math.round(s.truck.y), Math.round(s.heading), Math.round(s.speed)]); } return out; })()`);
  const sim = (setup, frames) => run(setup, frames);

  // ---- Momentum: let go of the gas and the truck rolls ----
  // SCREAM-114 (PO, November 2): it keeps 90% of its speed every half second, so it rolls on
  // almost as fast until you brake, and takes about 10 s to roll down to a creep.
  let r = await sim("s.truck.setPosition(400, 180); s.setHeading(0); s.speed = 547; s.parkBrake = false; s.held = []", 31);
  near('Let go at top speed: half a second later it still has about 90% of its speed (px/s)', r.at(-1)[3], 485, 500);
  r = await sim("s.truck.setPosition(250, 180); s.setHeading(0); s.speed = 547; s.parkBrake = false; s.held = []", 700);
  const creepAt = r.findIndex(f => f[3] === 72);
  near('...and rolls down to a creep only after about 10 s (s)', Math.round((creepAt + 1) * 0.016), 8, 11);
  check('...then keeps creeping (never stops on its own)', r.at(-1)[3], 72); // 10 s of rolling runs off the test track, so check the speed
  r = await sim("s.truck.setPosition(400, 180); s.setHeading(0); s.speed = 72; s.parkBrake = false; s.held = ['right']", 20);
  near('Steering while creeping still turns the truck (degrees)', r.at(-1)[2], 25, 40);

  // ---- Slow to pick up speed, like a train ----
  // SCREAM-115: starts far enough along that the longer truck's tail is on the road.
  r = await sim("s.truck.setPosition(200, 180); s.setHeading(0); s.speed = 0; s.held = ['up']", 165);
  near('Gas from a stop: after 1 s, only about 40% of top speed (px/s)', r[61][3], 209, 230);
  near('...full speed takes about 2.5 s (frames of 16 ms)', r.findIndex(f => f[3] === 547) + 1, 150, 160);

  // ---- Brake, then reverse ----
  r = await sim("s.truck.setPosition(400, 180); s.setHeading(0); s.speed = 547; s.parkBrake = false; s.held = ['down']", 50);
  const stopped = r.findIndex(f => f[3] <= 0);
  near('Down arrow at speed: brakes to a full stop in about 0.15 s (frames)', stopped + 1, 9, 11);
  near('...sliding only about 33 px', r[stopped][0] - 400, 26, 38);
  check('...waits a moment at a stop (0.4 s) before reversing', r[stopped + 20][3], 0);
  check('...then reverses: backwards, still facing forward', (r.at(-1)[0] < r[stopped][0]) + ' ' + r.at(-1)[2] + ' ' + (r.at(-1)[3] < 0), 'true 0 true');
  r = await sim("s.truck.setPosition(700, 180); s.setHeading(0); s.speed = 0; s.parkBrake = false; s.held = ['down']", 90);
  check('Reverse tops out at a quarter of top speed: 547 / 4, about 137 px/s (ICE-13)', -Math.min(...r.map(f => f[3])), Math.round(547 / 4));
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
  check('...and a message says to slow down first', await drive("s.notice && s.notice.active && s.notice.text"), 'Slow to a creep to use the park brake.');
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
  // SCREAM-115: measured crossing the junction at x = 1020, y = 840, so the longer truck's nose meets no curb.
  r = await run("s.truck.setPosition(960, 840); s.setHeading(0); s.held = ['right']", 5, 300);
  near('A quick tap of right: about 15 degrees', r.at(-1)[2], 13, 18);
  r = await run("s.truck.setPosition(960, 840); s.setHeading(0); s.held = ['right']", 14, 300);
  near('A bit longer: about 45 degrees', r.at(-1)[2], 42, 48);
  r = await run("s.truck.setPosition(960, 840); s.setHeading(0); s.held = ['left']", 5, 300);
  near('Left turns the other way (anticlockwise)', r.at(-1)[2], -18, -13);

  // ---- Turning round on a two-lane street ----
  // SCREAM-114 (PO, November 2): like a real truck it can't U-turn in one sweep: full lock
  // stops short, facing the curb. SCREAM-115: the truck is now 104 px long. Each leg below
  // goes (forward with right, back with left, ...) until the truck can't turn any further.
  r = await run("s.truck.setPosition(450, 810); s.setHeading(0); s.held = ['right']", 60, 150);
  near('Full lock on a two-lane street: stops short of turning round (|heading|)', Math.abs(r.at(-1)[2]), 80, 165);
  const turnDamage = await ev('e.damageCents');
  const turn3 = await drive(`(() => {
    s.parkBrake = false; s.truck.setPosition(450, 810); s.setHeading(0);
    for (let leg = 1; leg <= 5; leg++) {
      const fwd = leg % 2 === 1;
      s.held = fwd ? ['right'] : ['left'];
      let last = 999, still = 0;
      for (let i = 0; i < 300 && still < 6; i++) {
        s.speed = fwd ? 150 : -100; s.update(0, 16);
        still = Math.abs(s.heading - last) < 0.01 ? still + 1 : 0; last = s.heading;
        if (Math.abs(s.heading) >= 175) return [leg, Math.round(Math.abs(s.heading))];
      }
    }
    return [99, Math.round(Math.abs(s.heading))];
  })()`);
  near('A three-point turn (or less) gets it round: legs', turn3[0], 2, 3);
  check('...without hitting anything', (await ev('e.damageCents')) - turnDamage, 0);

  // ---- Turns get wider at speed ----
  // Measured in the junction (x = 1020, y = 840), clear of any curb.
  const radiusAt = async (speed) => drive(`(() => { s.parkBrake = false; s.truck.setPosition(950, 840); s.setHeading(0); s.held = ['right']; let path = 0; for (let i = 0; i < 10; i++) { s.speed = ${speed}; const x = s.truck.x, y = s.truck.y; s.update(0, 16); path += Math.hypot(s.truck.x - x, s.truck.y - y); } return Math.round(path / (s.heading * Math.PI / 180)); })()`);
  near('Tightest turn (slow): radius about 40 px', await radiusAt(100), 35, 45);
  near('At top speed the turn is wider: radius about 150 px', await radiusAt(547), 138, 162);
  r = await sim("s.truck.setPosition(1200, 840); s.setHeading(0); s.speed = 547; s.held = ['up', 'right']", 1);
  near('Turning hard at top speed scrubs a little speed off', r[0][3], 532, 546);

  // ---- In reverse, the wheel works the other way round ----
  r = await run("s.truck.setPosition(600, 840); s.setHeading(0); s.held = ['right']", 5, -100);
  check('Reversing with right held turns the nose the other way', r.at(-1)[2] < 0, true);

  // ---- Glancing off the curb slides along it ----
  const before = await ev('e.damageCents');
  // Starts with its nose corner 4 px from the curb (y = 900), whatever the truck's size (SCREAM-115).
  r = await run("s.truck.setPosition(600, 896 - s.truckHalf.length * Math.sin(20 * Math.PI / 180) - s.truckHalf.width * Math.cos(20 * Math.PI / 180)); s.setHeading(20); s.held = ['up']", 15, 200);
  check('Shallow angle into the curb: slides along it, no charge', ((await ev('e.damageCents')) - before) + ' ' + (r.at(-1)[0] - 600 > 40), '0 true');

  // ---- Passing a parked car (PO screenshot, PR #58) ----
  const carCase = await drive(`(() => {
    // The test track's parked car, against the left curb of the x = 1020 road (turned boxes since SCREAM-10).
    const k = s.cars[0];
    const c = { left: k.x - k.halfWidth, right: k.x + k.halfWidth, top: k.y - k.halfLength, bottom: k.y + k.halfLength };
    const before = e.damageCents;
    const clearX = c.right + s.truckHalf.width + 2; // just clear of it, whatever the truck's size (SCREAM-114)
    const clearNow = s.obstacleAt(clearX, (c.top + c.bottom) / 2, 90) === null;
    // Starts alongside the car, angled 7 degrees into it. SCREAM-115: 6 px clear (was 1), as the
    // longer truck's slant would otherwise start it touching the car.
    s.truck.setPosition(clearX + 6, c.top + 8); s.setHeading(97); s.held = ['up']; s.parkBrake = false;
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
  check('Parked car at top speed: full $10.00', await hit('car', 547), 1000);
  check('Parked car at half speed: $6.75 (between half and full)', await hit('car', 547 / 2), 675);
  check('Parked car at the slowest hit that counts (1/4 speed): half, $5.00', await hit('car', 108.25), 500);
  check('Curb at top speed: $2.00', await hit('edge', 547), 200);
  check('Curb at 1/4 speed: $1.00', await hit('edge', 108.25), 100);
  const holeCost = await drive(`(() => { const before = e.damageCents; const h = s.potholes[0]; h.armed = true; s.truck.setPosition(h.x, h.y); s.speed = 40; s.checkPotholes(); return e.damageCents - before; })()`);
  check('Pothole crept over slowly: half price, $2.50', holeCost, 250);
  check('...the popup shows the lower price', await drive("s.children.list.some(o => o.type === 'Text' && o.text === '-$2.50')"), true);
  await wait(800);

  // ---- With real keys, in the running game ----
  await drive("(s.held = [], s.speed = 0, s.spinning = false, s.tweens.killAll(), s.setHeading(0), s.truck.setPosition(400, 180), s.scene.resume(), true)");
  await drive('(s.speed = 547, s.parkBrake = false, true)');
  await wait(200);
  await page.keyboard.down('ArrowUp'); await wait(800);
  const xAtRelease = await drive('s.truck.x');
  const speedAtRelease = await drive('s.speed');
  await page.keyboard.up('ArrowUp'); await wait(700);
  near('Real keys: after letting go, the truck rolls on (px)', Math.round((await drive('s.truck.x')) - xAtRelease), 150, 560);
  check('...still near the speed it had (momentum, SCREAM-114)', (await drive('s.speed')) > speedAtRelease * 0.8, true);
  // To stop, brake down to a creep first, then Q.
  await page.keyboard.down('ArrowDown'); await wait(250); await page.keyboard.up('ArrowDown'); await wait(150);
  await page.keyboard.press('q'); await wait(400);
  const xStopped = await drive('Math.round(s.truck.x)'); await wait(400);
  check('Real keys: braked to a creep, a single Q stops it and it stays stopped', (await drive('Math.round(s.truck.x)')) - xStopped + ' ' + (await drive('s.parkLabel.visible')), '0 true');

  console.log(`\n${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await browser.close();
})();
