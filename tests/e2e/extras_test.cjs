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
  const sales = (fn) => page.evaluate(`(() => { const s = window.__game.scene.getScene('Sales'); return ${fn}; })()`);
  const wait = ms => page.waitForTimeout(ms);
  const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(40); } await wait(100); };
  const hold = async (k, ms) => { await page.keyboard.down(k); await wait(ms); await page.keyboard.up(k); await wait(100); };
  // speed: start already moving (the truck now takes 2.5 s to reach top speed, too long for short run-ups)
  const place = async (x, y, facing, speed = 0) => { await drive(`(s.truck.setPosition(${x}, ${y}), s.setHeading(({right:0,down:90,left:180,up:-90})['${facing}']), s.speed = ${speed}, s.parkBrake = ${speed === 0}, true)`); await wait(speed ? 0 : 150); };
  const popups = () => drive(`s.children.list.filter(o => o.type === 'Text' && /^-\\$/.test(o.text)).map(o => o.text + '@' + Math.round(o.x) + ',' + Math.round(o.y))`);
  let pass = 0, fail = 0;
  const check = (name, got, want) => { const ok = String(got) === String(want); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(66) + ' got=' + got + (ok ? '' : ' want=' + want)); };
  const near = (name, got, lo, hi) => { const ok = got >= lo && got <= hi; ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(66) + ' got=' + got + (ok ? '' : ` want ${lo}..${hi}`)); };

  await page.click('canvas'); await press('Enter'); await wait(200);
  // The title now opens the cooler directly (#66)
  await press('+', 5); await press('Enter'); await wait(200);
  await press('ArrowRight'); await press('Enter'); await wait(1200);
  await ev("(e.roadCustomerNow = { spot: 13 }, e.emit('road-customer-changed'), true)");

  // ---- SCREAM-10: every street on the Worcester map can be reached ----
  const blocked = await page.evaluate(() => {
    // Flood fill on a 30 px grid from the start: a point counts if the truck fits there at some angle.
    const s = window.__game.scene.getScene('Drive'); const G = 30;
    const fits = (x, y) => [0, 45, 90, 135].some(a => s.obstacleAt(x, y, a) === null);
    const key = (c, r) => c * 100000 + r;
    const seen = new Set(); const q = [[Math.round(s.truck.x / G), Math.round(s.truck.y / G)]];
    while (q.length) { const [c, r] = q.pop(); const k = key(c, r); if (seen.has(k) || !fits(c * G, r * G)) continue; seen.add(k); q.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]); }
    let roads = 0, bad = 0; const names = new Set();
    for (let c = 0; c * G < 6400; c++) for (let r = 0; r * G < 5400; r++) {
      if (!s.roads.onRoad(c * G, r * G) || !fits(c * G, r * G)) continue;
      roads++;
      if (!seen.has(key(c, r))) { bad++; names.add(s.roads.streetAt(c * G, r * G)); }
    }
    return roads + ' road points, ' + bad + ' unreachable ' + [...names].join('/');
  });
  check('No street is cut off: every road point the truck fits on is reachable', blocked.split(', ')[1].trim(), '0 unreachable');

  // The hit checks below run on the test track, with a pothole and a parked car at their old spots.
  await drive(`(${TRACK}, s.potholes = [{ x: 1230, y: 150, armed: true }], s.cars = [{ x: 870, y: 220, angle: 0, halfLength: 27, halfWidth: 16 }], true)`);

  // ---- Cost shown at the point of contact ----
  await place(700, 220, 'right', 433);
  await hold('ArrowUp', 1200);
  const truckX = await drive('Math.round(s.truck.x)');
  const carPop = (await popups()).find(p => p.startsWith('-$10.00'));
  check('Parked car: "-$10.00" pops up', !!carPop, true);
  near('...at the front of the truck, where it hit (x)', Number(carPop?.split('@')[1].split(',')[0]), truckX, truckX + 22);
  await page.screenshot({ path: outDir + '/extras_car_cost.png' });
  await wait(1500);
  check('...and fades away', (await popups()).length, 0);

  await place(1080, 150, 'right', 433);
  await page.keyboard.down('ArrowUp');
  for (let i = 0; i < 40 && !(await popups()).length; i++) await wait(50);
  await page.keyboard.up('ArrowUp');
  const holePop = (await popups())[0] ?? '';
  check('Pothole: "-$5.00" pops up', holePop.split('@')[0], '-$5.00');
  near('...on the pothole (x near 1230)', Number(holePop.split('@')[1]?.split(',')[0]), 1220, 1240);
  await wait(1500);
  await place(600, 840, 'down', 433); await hold('ArrowUp', 1000);
  check('Road edge: its cost (-$1.00 to -$2.00) pops up', /^-\$(1\.\d\d|2\.00)$/.test(((await popups())[0] ?? '').split('@')[0]), true);
  await wait(1500);

  // ---- Sales: the calculator, mouse only (SCREAM-12) ----
  await page.keyboard.down('Shift'); await page.keyboard.press('Digit4'); await page.keyboard.up('Shift'); await wait(300);
  await ev(`(() => { const s = e.sale; s.order.splice(0, s.order.length, { slot: 0, flavour: 'eclair', count: 1 }); return true; })()`);
  await press('c'); await wait(300); await press('+'); await press('Enter'); await wait(300);
  check('Pricing: the calculator display starts at 0', await sales('s.calculator.display.text'), '0');
  check('The old whole-dollars click is gone (no price box)', await sales('s.priceBox === undefined'), true);
  const canvas = await page.$('canvas'); const cb = await canvas.boundingBox();
  const clickKey = async (k) => {
    const p = await sales(`(() => { const r = s.calculator.keys.get('${k}'); return [s.calculator.container.x + r.x, s.calculator.container.y + r.y]; })()`);
    await page.mouse.click(cb.x + p[0], cb.y + p[1]); await wait(120);
  };
  await clickKey('7'); await clickKey('00');
  check('Click 7, 00: 700 (no decimal point means whole dollars)', await sales('s.calculator.display.text'), '700');
  await clickKey('C');
  check('C clears', await sales('s.calculator.display.text'), '0');
  await clickKey('1'); await clickKey('.'); await clickKey('5'); await clickKey('BACK'); await clickKey('00');
  check('1 . 5, back, 00: 1.00', await sales('s.calculator.display.text'), '1.00');
  await clickKey('9');
  check('No third decimal: still 1.00', await sales('s.calculator.display.text'), '1.00');
  await clickKey('C'); for (const k of ['9', '9', '9', '9']) await clickKey(k);
  check('At most 3 dollar digits: 999', await sales('s.calculator.display.text'), '999');
  await clickKey('C'); await clickKey('.');
  check('. first shows 0.', await sales('s.calculator.display.text'), '0.');
  await clickKey('CHARGE');
  check('CHARGE with nothing (0) does nothing', await ev('e.sale.phase'), 'pricing');
  await clickKey('C'); await page.keyboard.type('1'); await clickKey('.'); await page.keyboard.type('5');
  check('Keyboard and mouse mix: 1, click ., 5 -> 1.5', await sales('s.calculator.display.text'), '1.5');
  await page.screenshot({ path: outDir + '/extras_calculator.png' });
  await clickKey('C'); await clickKey('2');
  await clickKey('CHARGE'); await wait(300);
  check('Clicking CHARGE charges 2 as $2.00 (paid)', await ev('e.sale?.outcome?.kind + " " + e.sale?.outcome?.priceCents'), 'paid 200');
  // The paid flash (#69): once, held 1.5x longer (it used to flash twice)
  const flashAt = () => sales('(() => { const t = s.children.list.find(o => o.type === "Text" && o.text === "+$2.00"); return t ? Math.round(t.alpha * 100) : -1; })()');
  await wait(1100);
  check('Paid flash: the price is held on screen about 1.5 s in', await flashAt(), 100);
  await wait(1400);
  check('...and it flashes only once (gone by 2.5 s, no second flash)', await flashAt(), -1);

  // ---- A new curb customer never appears right where the truck is parked ----
  const nearCount = await page.evaluate(() => {
    const e = window.__game.registry.get('evening'); const d = window.__game.scene.getScene('Drive'); let bad = 0;
    // Where each curb spot's pickup square is.
    const spots = d.map.curbSpots.map(c => [c.x, c.y]);
    for (let i = 0; i < 340; i++) {
      const [x, y] = spots[i % spots.length];
      e.parkTruck({ x, y, angle: 0 });
      e.roadCustomerNow = null; e.spawnRoadCustomer();
      const n = e.roadCustomer; if (!n) continue;
      const [nx, ny] = spots[n.spot];
      if (Math.hypot(nx - x, ny - y) < 180) bad++;
    }
    return bad + ' of ' + spots.length + ' spots';
  });
  check('New customers never appear within 180 px of the parked truck (340 tries)', nearCount, '0 of 34 spots');

  console.log(`\n${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await browser.close();
})();
