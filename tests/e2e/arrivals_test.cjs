// SCREAM-379 and SCREAM-380 (PO, November 17): in Story, people whose day is not ticked are away at
// the start of the evening and come home from 5:30 PM: on foot from the map's edge, or, if they
// have a car, driving it along the road to their parking spot. A car on its way stops and waits for
// the truck; driving into it is the same bump as a parked car.
const { chromium } = require('playwright');
(async () => {
  const [port, outDir] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.addInitScript(() => { try { localStorage.setItem('icemachine.tutorial.done.v1', '1'); localStorage.setItem('icemachine.howtodrive.off.v1', '1'); } catch {} });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  const ev = (fn) => page.evaluate(`(() => { const e = window.__game.registry.get('evening'); const res = e.residents; return ${fn}; })()`);
  const sc = (key, fn) => page.evaluate(`(() => { const s = window.__game.scene.getScene('${key}'); return ${fn}; })()`);
  const wait = ms => page.waitForTimeout(ms);
  const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(60); } await wait(150); };
  const scenes = () => page.evaluate(() => window.__game.scene.getScenes(true).map(s => s.scene.key).join(','));
  const until = async (fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await wait(100); } return false; };
  let pass = 0, fail = 0;
  const check = (name, got, want) => { const ok = String(got) === String(want); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(66) + ' got=' + got + (ok ? '' : ' want=' + want)); };

  // ---- A new Story, On My Own: Monday, on the road in Elm Park ----
  await page.click('canvas'); await wait(200);
  await press('ArrowDown'); await press('Enter'); await wait(300);
  await press('ArrowRight'); await press('Enter'); await wait(300);
  await page.mouse.click(480, 270); await until(async () => (await scenes()).startsWith('Cooler'));
  await press('+', 4); await press('Enter'); await wait(300);
  await page.evaluate(() => window.__game.scene.getScene('Cooler').scene.start('Truck')); await until(async () => (await scenes()) === 'Truck,Hud');
  await press('ArrowRight'); await press('Enter'); await until(async () => (await scenes()) === 'Drive,Hud');
  check('Story, Monday, on the road in Elm Park', (await scenes()) + ' ' + (await ev('e.mapId')) + ' ' + (await ev('e.clockMinutes < 965')), 'Drive,Hud tutorial true');
  await ev('(res.hearingOff = true, true)');
  // Keep the truck out of everyone's way, and the evening's own clock still: these checks move time themselves.
  await sc('Drive', '(s.truck.setPosition(2600, 600), s.speed = 0, s.parkBrake = true, true)'); await wait(200);

  // ---- SCREAM-394: people walking the streets ----
  check('SCREAM-394: nine walkers are out on the streets at 4:00, of the sheet\'s 20, with no porch light', await ev("res.walkersNow.length + ' ' + res.all.filter(p => p.resident.walker).length + ' ' + res.walkersNow.every(p => p.outside && !res.porchLit(p))"), '9 20 true');
  const walkerId = await ev('res.walkersNow[0].resident.id');
  const walkerAt = await ev('(() => { const p = res.walkersNow[0]; return [p.x, p.y]; })()');
  await sc('Drive', `(s.truck.setPosition(${walkerAt[0]} + 110, ${walkerAt[1]} + 20), true)`);
  // They pause up to 7 seconds at a corner before setting off.
  check('...and they walk: one has moved along the sidewalk', await until(() => ev(`(() => { const p = res.walkersNow.find(q => q.resident.id === '${walkerId}'); return !!p && Math.hypot(p.x - ${walkerAt[0]}, p.y - ${walkerAt[1]}) > 12; })()`), 12000), true);
  await page.screenshot({ path: outDir + '/arrivals_walker.png' });
  await sc('Drive', '(s.truck.setPosition(2600, 600), true)'); await wait(200);

  // ---- SCREAM-379: who is away ----
  check('SCREAM-379: the people not ticked for Monday are away (not the park\'s residents or the hard-to-find)', await ev("(() => { const want = res.all.filter(p => { const x = p.resident; return !x.visitor && !x.hardToFind && !x.park && x.days && !x.days.includes(0); }); const away = res.awayNow; return away.length + ' ' + (away.length === want.length) + ' ' + away.every(p => want.includes(p)); })()"), '17 true true');
  check('...they are not on their property, their porch light is off and their car is not outside', await ev("res.awayNow.every(p => !p.outside && !res.porchLit(p) && !res.carsNow.some(c => c.id === p.resident.id))"), true);
  check('...nobody comes home before 5:30 PM; some stay out all evening', await ev("(() => { const t = res.awayNow.map(p => res.arrivesAt(p)); return t.filter(m => m !== null).every(m => m >= 1050 && m <= 1170) + ' ' + (t.filter(m => m === null).length > 0) + ' ' + (t.filter(m => m !== null).length > 5); })()"), 'true true true');
  check('...someone ticked for Monday is home as usual', await ev("res.all.some(p => p.resident.days && p.resident.days.includes(0) && !p.away && !p.resident.park && (p.outside || res.porchLit(p)))"), true);

  // ---- SCREAM-379: someone without a car walks in from the edge of the map ----
  const walker = await page.evaluate(() => {
    const e = window.__game.registry.get('evening'); const res = e.residents;
    const p = res.awayNow.filter(p => !p.resident.car && res.arrivesAt(p) !== null).sort((a, b) => res.arrivesAt(a) - res.arrivesAt(b))[0];
    window.__walker = p; window.__far = { x: 2600, y: 600, radius: 10, open: false, heading: 0 };
    e.elapsedMs = (res.arrivesAt(p) - 960) * 1750 + 500;
    res.update(0.1, window.__far);
    const map = { w: 2962, h: 2510 };
    return [p.resident.name, p.comingHome, p.outside, p.away, p.x < 40 || p.y < 40 || p.x > map.w - 40 || p.y > map.h - 40, res.porchLit(p), res.drivingHome(p)].join(' ');
  });
  check('SCREAM-379: at their time a walker appears at the edge of the map, walking home (no porch light yet)', walker.split(' ').slice(-6).join(' '), 'true true false true false false');
  const walked = await page.evaluate(() => {
    const e = window.__game.registry.get('evening'); const res = e.residents; const p = window.__walker;
    for (let t = 0; t < 900 && p.comingHome; t++) { res.update(0.1, window.__far); e.elapsedMs += 100; }
    return [p.comingHome, p.away, Math.hypot(p.x - p.resident.door[0], p.y - p.resident.door[1]) < 5, res.porchLit(p) || p.outside, res.likelihoodNow(p.resident) === Math.min(1, p.resident.likelihood * 1.25)].join(' ');
  });
  check('...they walk to their door and go in; once home they are as likely to buy as on a ticked day', walked, 'false false true true true');

  // ---- SCREAM-380: a car owner drives home ----
  const driver = await page.evaluate(() => {
    const e = window.__game.registry.get('evening'); const res = e.residents;
    const p = res.awayNow.filter(p => p.resident.car && res.arrivesAt(p) !== null).sort((a, b) => res.arrivesAt(a) - res.arrivesAt(b))[0];
    window.__driver = p;
    e.elapsedMs = Math.max(e.elapsedMs, (res.arrivesAt(p) - 960) * 1750 + 500);
    let c;
    // On until it is 400 px along its way (past the way in, wherever it lives); `ahead` is where its way goes 230 px on.
    let ahead = null;
    for (let t = 0; t < 600; t++) { res.update(0.1, window.__far); e.elapsedMs += 100; c = res.carsNow.find(c => c.id === p.resident.id); const d = res.drives.get(p.resident.id); if (c && d && d.s > 400) { ahead = d.at(d.s + 230); break; } }
    return c && ahead ? { id: c.id, x: c.x, y: c.y, angle: c.angle, moving: !!c.moving, away: p.away, outside: p.outside, driving: res.drivingHome(p), ahead } : null;
  });
  check('SCREAM-380: an away car owner comes in by car along the road; the owner is not on the map while driving', driver && [driver.moving, driver.away, driver.outside, driver.driving].join(' '), 'true true false true');
  check('...the car is on the asphalt', await sc('Drive', `s.roads.onRoad(${driver.x}, ${driver.y})`), true);
  // The truck stops in the car's lane ahead of it: the car stops and waits.
  const tx = driver.ahead.x, ty = driver.ahead.y;
  await sc('Drive', `(s.truck.setPosition(${tx}, ${ty}), s.setHeading(${driver.ahead.angle}), s.speed = 0, s.parkBrake = true, true)`);
  await until(async () => await ev(`(d => !!d && d.waiting && d.v === 0)(res.drives.get('${driver.id}'))`), 6000);
  await wait(300);
  const car = () => ev(`(c => c ? { x: c.x, y: c.y, angle: c.angle, moving: !!c.moving, hl: c.halfLength } : null)(res.carsNow.find(c => c.id === '${driver.id}'))`);
  const w1 = await car(); await wait(500); const w2 = await car();
  const apart = Math.hypot(w1.x - tx, w1.y - ty);
  const touching = await page.evaluate(async ([c, tx, ty, th]) => { const { boxesOverlap } = await import('/src/state/RoadGeometry.js'); return boxesOverlap({ x: c.x, y: c.y, angle: c.angle, halfLength: c.hl, halfWidth: 14 }, { x: tx, y: ty, angle: th, halfLength: 52, halfWidth: 21 }); }, [w1, tx, ty, driver.ahead.angle]);
  check('SCREAM-380: with the truck in its way the car stops and waits behind it, without touching', [w1.moving, Math.hypot(w2.x - w1.x, w2.y - w1.y) < 0.5, touching, apart < 170 ? 'close' : 'apart ' + apart.toFixed(0)].join(' '), 'true true false close');
  check('...it is drawn where it is, turned the way it is going', await sc('Drive', `(g => !!g && g.visible && Math.hypot(g.x - ${w2.x}, g.y - ${w2.y}) < 1)(s.residentCars.get('${driver.id}'))`), true);
  check('...and it is an obstacle like a parked car: the truck cannot drive into it', await sc('Drive', `s.obstacleAt(${w2.x}, ${w2.y}, ${w2.angle})`), 'car');
  await page.screenshot({ path: outDir + '/arrivals_car_waiting.png' });
  // The truck drives off: the car carries on, parks, and its owner walks to the door.
  await sc('Drive', '(s.truck.setPosition(2600, 600), s.setHeading(0), s.speed = 0, s.parkBrake = true, true)'); await wait(300);
  const parked = await page.evaluate(() => {
    const e = window.__game.registry.get('evening'); const res = e.residents; const p = window.__driver;
    for (let t = 0; t < 1200 && res.drivingHome(p); t++) { res.update(0.1, window.__far); e.elapsedMs += 100; }
    const c = res.carsNow.find(c => c.id === p.resident.id);
    const out = [res.drivingHome(p), !!c && !c.moving && c.x === p.resident.car[0] && c.y === p.resident.car[1] && c.angle === p.resident.car[2], p.comingHome && p.outside && !p.away];
    for (let t = 0; t < 900 && p.comingHome; t++) { res.update(0.1, window.__far); e.elapsedMs += 100; }
    out.push(!p.comingHome && Math.hypot(p.x - p.resident.door[0], p.y - p.resident.door[1]) < 5, res.carsNow.some(c => c.id === p.resident.id && !c.moving), e.clockMinutes < 1200);
    return out.join(' ');
  });
  check('SCREAM-380: once the truck has gone the car parks in its own spot and the owner gets out...', parked.split(' ').slice(0, 3).join(' '), 'false true true');
  check('...walks to the door and goes in, the car staying outside (all before 8 PM)', parked.split(' ').slice(3).join(' '), 'true true true');
  await wait(200);
  console.log(`\n${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await browser.close();
})();
