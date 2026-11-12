// SCREAM-22: fuel. The gauge, driving uses gas, an empty tank ends the evening (SCREAM-119; it used to crawl at a quarter
// speed, the gas station's pump bay on Park Avenue, buying in $5 steps up to $30 a
// tank, Quick play's full tank, Story's quarter tank on day 1 carried over and saved.
const { chromium } = require('playwright');
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
  await page.evaluate(() => { localStorage.removeItem('icemachine.story.v2'); localStorage.setItem('icemachine.music.muted.v1', '1'); });
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  const ev = (fn) => page.evaluate(`(() => { const e = window.__game.registry.get('evening'); return ${fn}; })()`);
  const sc = (key, fn) => page.evaluate(`(() => { const s = window.__game.scene.getScene('${key}'); return ${fn}; })()`);
  const drive = (fn) => sc('Drive', fn);
  const scenes = () => page.evaluate(() => window.__game.scene.getScenes(true).map(s => s.scene.key).join(','));
  const texts = (key) => sc(key, "s.children.list.filter(o => o.type === 'Text' && o.visible).map(o => o.text).join(' | ')");
  const wait = ms => page.waitForTimeout(ms);
  const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(50); } await wait(120); };
  const shift = async (d) => { await page.keyboard.down('Shift'); await page.keyboard.press('Digit' + d); await page.keyboard.up('Shift'); await wait(300); };
  const until = async (fn, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await wait(50); } return false; };
  let pass = 0, fail = 0;
  const check = (name, got, want) => { const ok = String(got) === String(want); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(64) + ' got=' + got + (ok ? '' : ' want=' + want)); };
  const near = (name, got, lo, hi) => { const ok = got >= lo && got <= hi; ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(64) + ' got=' + got + (ok ? '' : ` want ${lo}..${hi}`)); };
  // Parks the truck in the pump bay, stopped, facing up Park Avenue.
  const intoBay = () => drive(`(() => { const b = s.pumpBays[0]; s.truck.setPosition(b.x, b.y); s.setHeading(b.angle); s.speed = 0; s.parkBrake = true; return true; })()`);
  // SCREAM-115: 160 px along the road from the bay, facing the way with the most clear road
  // ahead (the 104 px truck runs into the street's end sooner).
  const awayFromBay = () => drive(`(() => {
    const b = s.pumpBays[0];
    const clearAhead = (x, y, deg) => { const r = deg * Math.PI / 180; let d = 0; while (d < 600 && s.obstacleAt(x + Math.cos(r) * d, y + Math.sin(r) * d, deg) === null) d += 10; return d; };
    const best = [1, -1].map(dir => { const x = b.x + Math.cos(b.rotation) * 160 * dir, y = b.y + Math.sin(b.rotation) * 160 * dir;
      return [0, 180].map(turn => { const deg = b.angle + turn; return { x, y, deg, clear: clearAhead(x, y, deg) }; }); }).flat().sort((a, c) => c.clear - a.clear)[0];
    s.truck.setPosition(best.x, best.y); s.setHeading(best.deg); s.speed = 0; s.parkBrake = true; return true;
  })()`);
  const fuel = async () => Math.round((await ev('e.fuel')) * 10000) / 10000;

  // ---- Quick play: a full tank ----
  await page.click('canvas'); await press('Enter'); await wait(200);
  check('Quick play starts with a full tank', await ev('e.fuel'), 1);
  check('No gauge at the cooler (shown while driving)', await sc('Hud', 's.fuelGauge.visible'), false);
  await press('+', 6); await press('Enter'); await wait(200);
  await press('ArrowRight'); await press('Enter'); await wait(400);
  await ev('(e.residents.hearingOff = true, true)');
  check('On the road: the gauge shows', await sc('Hud', 's.fuelGauge.visible'), true);
  // SCREAM-238 (PO, November 10; replaces SCREAM-219): bigger, at the bottom left, above the controls hint.
  const gaugeAt = () => sc('Hud', '(() => { const g = s.fuelGauge; return g.x < s.scale.width / 4 && g.y > s.scale.height * 0.8 && g.y <= 506; })()');
  check('The gauge sits at the bottom left, above the controls hint (SCREAM-238)', await gaugeAt(), true);
  check('...and it is bigger than the old one (E and F are more than 80 px apart; they were 57)', await sc('Hud', 's.emptyLabel.x < 0 && Math.abs(s.emptyLabel.x) * 2 > 80'), true);
  check('...the park brake sign starts right of it, not under it', await sc('Drive', 's.parkLabel.x >= s.scene.get("Hud").fuelGauge.x + 68'), true);
  await ev('(e.changeMoney(123400, "test", false), true)'); await wait(150);
  check('...and it stays put when the cash gets wider ($1,000s)', await gaugeAt(), true);
  await ev('(e.changeMoney(-123400, "test", false), true)'); await wait(150);
  await ev('(window.__q = e.coolerSlots.map(s => s.quantity), e.coolerSlots.forEach(s => s.quantity = 0), e.emit("cooler-changed"), true)'); await wait(150);
  check('...SOLD OUT sits just left of the money', await sc('Hud', '(() => { const m = s.moneyText, left = m.x - m.width; return s.soldOutText.visible && s.soldOutText.x < left && left - s.soldOutText.x <= 30; })()'), true);
  await page.screenshot({ path: outDir + '/fuel_gauge_sold_out.png' });
  await ev('(window.__q.forEach((q, i) => e.coolerSlots[i].quantity = q), e.emit("cooler-changed"), true)'); await wait(150);
  await page.screenshot({ path: outDir + '/fuel_hud.png' });

  // ---- SCREAM-121: the old-school dial; steady above a quarter tank, jumping around below ----
  const needleSpread = async (fuelLevel) => {
    await ev(`(e.fuelLeft = ${fuelLevel}, true)`);
    // SCREAM-231: let the HUD draw a few frames first, so the first reading isn't the old level.
    await wait(200);
    let lo = 9, hi = -9;
    for (let i = 0; i < 25; i++) { const n = await sc('Hud', 's.fuelNeedle'); lo = Math.min(lo, n); hi = Math.max(hi, n); await wait(60); }
    return [lo, hi];
  };
  await drive('(s.speed = 0, s.parkBrake = true, true)');
  const [fullLo, fullHi] = await needleSpread(1);
  check('Full tank: the needle sits on F', `${fullLo},${fullHi}`, '1,1');
  const [halfLo, halfHi] = await needleSpread(0.5);
  check('Half a tank: the needle holds steady at 1/2', `${halfLo},${halfHi}`, '0.5,0.5');
  const [lowLo, lowHi] = await needleSpread(0.08);
  check('Low (0.08): the needle jumps around', lowHi - lowLo > 0.02, true);
  check('...but stays within 0.1 of a tank of the truth', lowLo >= 0.08 - 0.1 - 1e-9 && lowHi <= 0.08 + 0.1 + 1e-9, true);
  await ev('(e.fuelLeft = 0.08, true)'); await wait(200);
  await page.screenshot({ path: outDir + '/fuel_dial_low.png' });
  await ev('(e.fuelLeft = 1, true)'); await wait(200);

  // ---- Driving uses gas, by distance ----
  const start = await drive('[s.truck.x, s.truck.y]');
  const before = await ev('e.fuel');
  await drive('(s.parkBrake = false, true)');
  await page.keyboard.down('ArrowUp'); await wait(1200); await page.keyboard.up('ArrowUp'); await wait(200);
  const end = await drive('[s.truck.x, s.truck.y]');
  const used = before - (await ev('e.fuel'));
  const straight = Math.hypot(end[0] - start[0], end[1] - start[1]);
  check('Driving uses gas', used > 0, true);
  near('...about 1 tank per 32,100 px (used x 32,100 / straight-line px; SCREAM-151)', Math.round((used * 32100 / straight) * 100) / 100, 0.99, 1.6);
  check('Parked, no gas is used', await (async () => { await drive('(s.speed = 0, s.parkBrake = true, true)'); const a = await ev('e.fuel'); await wait(500); return a === (await ev('e.fuel')); })(), true);

  // ---- An empty tank (SCREAM-119): checked at the end of this evening, as it ends the evening ----
  // For the pump checks below, empty the tank without driving it dry.
  await ev('(e.fuelLeft = 0, true)');
  check('An empty tank, set directly, leaves the evening running', await ev('e.isOutOfFuel + " " + e.isOver'), 'true false');

  // ---- The gas station ----
  // SCREAM-109: two stations, the Speedway on Park Ave and one on June Street, each with two pumps on a clear forecourt.
  check('Two gas stations: Park Avenue and June Street (SCREAM-109)', await drive("s.map.gasStations.map(g => g.name).join()"), 'Speedway,June Street');
  check('Each bay is on the road; two pumps each', await drive("[s.pumpBays.every(b => s.roads.onRoad(b.x, b.y)), s.sortedObjects.filter(o => o.key === 'pump').length].join()"), 'true,4');
  check('No house, tree or ornament stands on a forecourt', await drive(`s.map.gasStations.every(g => s.map.objects.every(o => Math.hypot(o.x - g.pad.x, o.y - g.pad.y) > 70))`), true);
  check('No resident lives or walks on a forecourt', await drive(`s.map.gasStations.every(g => s.evening.residents.all.every(p => { const r = p.resident; const pts = [r.door, ...Array.from({ length: r.yard.length / 2 }, (_, i) => [r.yard[i * 2], r.yard[i * 2 + 1]])]; return pts.every(([x, y]) => Math.hypot(x - g.pad.x, y - g.pad.y) > 70); }))`), true);
  check('A GAS sign at each station', await drive("s.mapTexts.filter(t => t.obj.text === 'GAS').length"), 2);
  await drive(`(() => { const b = s.pumpBays[0]; s.truck.setPosition(b.x + Math.cos(b.rotation) * 90, b.y + Math.sin(b.rotation) * 90); s.setHeading(b.angle + 180); return true; })()`); await wait(500);
  await page.screenshot({ path: outDir + '/fuel_station.png' });
  const curbClash = await drive(`s.evening.residents.all.filter(p => s.pumpBays.some(b => Math.hypot(p.resident.curb[2] - b.x, p.resident.curb[3] - b.y) < 60)).length`);
  check("No customer's pink square overlaps the pump bay", curbClash, 0);
  // Rolling through doesn't count; stopped in the bay, the pump opens.
  await drive(`(() => { const b = s.pumpBays[0]; s.truck.setPosition(b.x, b.y); s.setHeading(b.angle); s.speed = 40; s.parkBrake = false; return true; })()`); await wait(40);
  check('Rolling through the bay: no pump', (await scenes()).includes('Pump'), false);
  await drive('(s.leaving = false, true)');
  await intoBay();
  check('Stopped in the bay: the pump opens', await until(async () => (await scenes()) === 'Pump,Hud'), true);
  check('The pump screen shows the pump picture (SCREAM-111)', await sc('Pump', "(p => p ? p.texture.key + ':' + p.frame.name : 'none')(s.children.getByName('pump'))"), 'map-atlas:pump');
  await page.screenshot({ path: outDir + '/fuel_pump.png' });
  const clock0 = await ev('e.clockMinutes'); await wait(800);
  check('The clock keeps running at the pump', (await ev('e.clockMinutes')) > clock0, true);
  check('The gauge shows at the pump too', await sc('Hud', 's.fuelGauge.visible'), true);
  check('...in the bottom left corner, below the pump (SCREAM-238)', await sc('Hud', '(() => { const g = s.fuelGauge, pump = s.scene.get("Pump").children.getByName("pump").getBounds(); return g.y - 72 >= pump.bottom - 14 && g.y <= s.scale.height && g.x - 72 >= 0; })()'), true);
  check('The pump opens at $0.00 (SCREAM-184)', (await sc('Pump', 's.amount')) + ' ' + (await sc('Pump', 's.payButton.visible')), '0 false');
  await press('ArrowUp', 10);
  check('Empty tank, $44 cash: up to $30, a full tank', await sc('Pump', 's.amount'), 3000);
  check('...and says it fills it up', /Fills it up/.test(await texts('Pump')), true);
  await press('ArrowDown');
  check('Down: $5 less', await sc('Pump', 's.amount'), 2500);
  await press('ArrowDown', 8);
  check('Never below $0; no PAY button at $0', (await sc('Pump', 's.amount')) + ' ' + (await sc('Pump', 's.payButton.visible')), '0 false');
  await press('ArrowUp', 3);
  check('Up: $5 more (3 times = $15, half a tank)', (await sc('Pump', 's.amount')) + ' ' + /\+1\/2 tank/.test(await texts('Pump')), '1500 true');
  await press('ArrowUp', 10);
  check('Never above a full tank ($30)', await sc('Pump', 's.amount'), 3000);
  // SCREAM-112: the mouse. Click the $5 less and $5 more buttons, or scroll the wheel.
  const clickBtn = async (name) => { const [x, y] = await sc('Pump', `(b => [b.x + b.width / 2, b.y + b.height / 2])(s.${name})`); await page.mouse.click(x, y); await wait(120); };
  await clickBtn('lessButton');
  check('Clicking "$5 less" takes $5 off (SCREAM-112)', await sc('Pump', 's.amount'), 2500);
  await clickBtn('moreButton');
  check('Clicking "$5 more" adds $5', await sc('Pump', 's.amount'), 3000);
  check('...and at the most you can buy, "$5 more" is faded', await sc('Pump', 's.moreButton.alpha < 1 && s.lessButton.alpha === 1'), true);
  await clickBtn('moreButton');
  check('...and clicking it then does nothing', await sc('Pump', 's.amount'), 3000);
  await page.mouse.move(600, 300); await page.mouse.wheel(0, 100); await wait(150);
  check('Scrolling the mouse wheel down: $5 less', await sc('Pump', 's.amount'), 2500);
  await page.mouse.wheel(0, -100); await wait(150);
  check('Scrolling up: $5 more', await sc('Pump', 's.amount'), 3000);
  await press('ArrowDown', 3);
  const cash0 = await ev('e.moneyCents');
  await press('Enter'); await wait(300);
  check('Enter: pays and drives off', await scenes(), 'Drive,Hud');
  check('...$15 off the cash, half a tank in', (cash0 - (await ev('e.moneyCents'))) + ' ' + (await fuel()), '1500 0.5');
  check("...counted as tonight's gas", await ev('e.breakdown.gasCents'), 1500);
  await wait(500);
  check("Still in the bay after paying: the pump doesn't open again", await scenes(), 'Drive,Hud');
  await awayFromBay(); await wait(200);
  await intoBay();
  check('Leave the bay and come back: it opens again', await until(async () => (await scenes()) === 'Pump,Hud'), true);
  check('Half a tank: the pump opens at $0.00 again', await sc('Pump', 's.amount'), 0);
  await ev('(e.burnFuel(642), true)'); // two hundredths of a tank more: 60 cents' worth
  await press('ArrowUp', 4);
  const fill = await ev('e.fillUpCents');
  check('...a fill-up costs what it takes, to the nearest 50 cents (SCREAM-184)', fill === 1550, true);
  check('...$5, $10, $15, then the last step fills it up ($15.50)', (await sc('Pump', 's.amount')) === fill && /Fills it up/.test(await texts('Pump')), true);
  await press('ArrowDown');
  check('...and $5 less from there is back to $15', await sc('Pump', 's.amount'), 1500);
  const cash1 = await ev('e.moneyCents');
  await press('b'); await wait(300);
  check('B: drives off without buying', (await scenes()) + ' ' + ((await ev('e.moneyCents')) === cash1), 'Drive,Hud true');
  // The June Street station works the same way.
  await awayFromBay(); await wait(200);
  await drive(`(() => { const b = s.pumpBays[1]; s.truck.setPosition(b.x, b.y); s.setHeading(b.angle); s.speed = 0; s.parkBrake = true; return true; })()`);
  check('Stopped in the June Street bay: the pump opens too', await until(async () => (await scenes()) === 'Pump,Hud'), true);
  check('...with the pump picture drawn, not the missing-picture box (SCREAM-111)', await sc('Pump', "(p => p ? p.texture.key + ':' + p.frame.name : 'none')(s.children.getByName('pump'))"), 'map-atlas:pump');
  await page.screenshot({ path: outDir + '/fuel_pump_june.png' });
  await press('b'); await wait(300);
  await drive(`(() => { const b = s.pumpBays[1]; s.truck.setPosition(b.x + Math.cos(b.rotation) * 90, b.y + Math.sin(b.rotation) * 90); s.setHeading(b.angle + 180); s.speed = 0; s.parkBrake = true; return true; })()`); await wait(500);
  await page.screenshot({ path: outDir + '/fuel_station_june.png' });

  // ---- What can be bought ----
  check('Gas only in whole 50 cents', await ev('e.buyGas(320)'), false);
  check('No more than fits ($20 into half a tank)', await ev('e.buyGas(2000)'), false);
  check('Filling up to the top (SCREAM-184)', (await ev('e.buyGas(e.fillUpCents)')) + ' ' + (await fuel()), 'true 1');
  check('Full: nothing more to buy', await ev('e.maxGasCents'), 0);
  await awayFromBay(); await wait(200); await intoBay();
  await until(async () => (await scenes()) === 'Pump,Hud');
  check("Full tank at the pump: says the tank's full", /tank's full/.test(await texts('Pump')), true);
  await press('Enter'); await wait(300);
  check('Enter with nothing to buy just drives off', await scenes(), 'Drive,Hud');
  await ev('(e.burnFuel(32100 * 0.75), e.changeMoney(-e.moneyCents + 1200, "test", false), true)');
  check('$12 and a quarter tank: as much as the wallet holds ($12)', await ev('e.maxGasCents'), 1200);
  await ev('(e.burnFuel(32100 * 0.1), true)');
  check('0.15 tank: filling it to the top is $25.50', await ev('(e.changeMoney(5000, "test", false), e.maxGasCents)'), 2550);
  await ev('(e.changeMoney(-e.moneyCents + 300, "test", false), true)');
  await awayFromBay(); await wait(200); await intoBay();
  await until(async () => (await scenes()) === 'Pump,Hud');
  await press('ArrowUp');
  check('$3: $3 of gas, and it says that is all the cash allows', /all the cash allows/.test(await texts('Pump')) + ' ' + (await sc('Pump', 's.amount')), 'true 300');
  await ev('(e.changeMoney(-e.moneyCents, "test", false), true)');
  await press('b'); await wait(300); await awayFromBay(); await wait(200); await intoBay();
  await until(async () => (await scenes()) === 'Pump,Hud');
  check('$0: not enough cash, and it says so', /Not enough cash/.test(await texts('Pump')) + ' ' + (await sc('Pump', 's.amount')), 'true 0');
  await press('b'); await wait(300);

  // ---- Results ----
  // SCREAM-119 (PO): driving the tank dry ends the evening, on the OUT OF GAS results screen.
  await drive(`(() => { const b = s.pumpBays[0]; s.truck.setPosition(b.x + Math.cos(b.rotation) * 160, b.y + Math.sin(b.rotation) * 160); return true; })()`);
  await ev('(e.burnFuel(1e9), true)'); await wait(600);
  // SCREAM-208: first the truck stops, the gauge flashes and "Needed a tow home." shows.
  check('Out of gas: the truck stops and "Needed a tow home." shows (SCREAM-208)', (await scenes()) + ' ' + (await sc('Drive', 's.speed')) + ' ' + (await sc('Hud', 's.towing && s.towText.visible && s.towText.text')), 'Drive,Hud 0 Needed a tow home.');
  const flashes = new Set();
  for (let i = 0; i < 8; i++) { flashes.add(await sc('Hud', 's.gaugeRed')); await wait(60); }
  check('...the gas gauge flashes (red on and off)', [...flashes].sort().join(','), 'false,true');
  await page.screenshot({ path: outDir + '/fuel_tow.png' });
  await until(async () => (await scenes()) === 'Results');
  check('Driving the tank dry ends the evening (SCREAM-119)', (await ev('e.isOver + " " + e.endedOutOfGas')) + ' ' + (await scenes()), 'true true Results');
  const results = await texts('Results');
  check('...the results say OUT OF GAS', /OUT OF GAS/.test(results), true);
  check("Results: a Gas line with tonight's gas", /Gas/.test(results) && /-\$30\.50/.test(results), true);
  await page.screenshot({ path: outDir + '/fuel_results.png' });

  // ---- Story: a quarter tank on day 1, carried over and saved ----
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  // SCREAM-205: a new Story asks about the uncle (O: on my own), then the intro.
  await page.click('canvas'); await press('ArrowDown'); await press('Enter'); await wait(300); await press('o'); await wait(300); await press('Enter'); await wait(300);
  check('Story day 1: $50 and a quarter tank (SCREAM-205)', (await ev('e.moneyCents')) + ' ' + (await ev('e.fuel')), '5000 0.25');
  await press('+', 2); await press('Enter'); await wait(200);
  await press('ArrowRight'); await press('Enter'); await wait(400);
  await ev('(e.residents.hearingOff = true, true)');
  await intoBay();
  await until(async () => (await scenes()) === 'Pump,Hud');
  await press('ArrowUp', 4);
  check('A quarter tank: $20 is 4 steps', await sc('Pump', 's.amount'), 2000);
  await press('Enter'); await wait(300);
  const tank = await ev('e.fuel');
  near('...$20 is 2/3 of a tank: now 11/12', Math.round(tank * 1000) / 1000, 0.916, 0.917);
  await shift(3); await wait(300);
  check('End of day 1: Gas line on the end-of-day screen', /Gas/.test(await texts('DayEnd')) && /-\$20\.00/.test(await texts('DayEnd')), true);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('icemachine.story.v2')));
  check("The save keeps the tank and the run's gas", Math.abs(saved.fuel - tank) < 1e-9 && saved.totals.gasCents === 2000, true);
  await press('Enter'); await wait(300);
  check('Day 2 starts with what was left in the tank', Math.abs((await ev('e.fuel')) - tank) < 1e-9, true);
  // Restart this evening (pause menu): back to how tonight started, tank included.
  await ev('(e.burnFuel(32100 * 0.3), true)');
  await press('Escape'); await wait(200); await press('ArrowDown'); await press('Enter'); await wait(150); await press('y'); await wait(400);
  check("Restarting the evening puts back tonight's starting tank", Math.abs((await ev('e.fuel')) - tank) < 1e-9, true);
  // SCREAM-119 (PO): running out of gas ends the day; SCREAM-204 (PO, November 12): the next day starts with 1/3 of a tank (it was 1/6).
  await press('ArrowRight'); await press('Enter'); await wait(400);
  await ev('(e.residents.hearingOff = true, true)');
  // SCREAM-208: the tank only runs dry on the road, so drive off first.
  if ((await scenes()).startsWith('Truck')) { await press('ArrowRight'); await press('Enter'); await wait(400); }
  await ev('(e.burnFuel(1e9), true)'); await wait(600);
  check('Story: out of gas shows "Needed a tow home." first too', (await scenes()) + ' ' + (await sc('Hud', 's.towText && s.towText.text')), 'Drive,Hud Needed a tow home.');
  await until(async () => (await scenes()).startsWith('DayEnd'));
  const dayEnd = await texts('DayEnd');
  check('Story: out of gas ends the day, and says tomorrow starts with 1/3 of a tank (SCREAM-204)', /ran out of gas/.test(dayEnd) && /1\/3 of a tank/.test(dayEnd), true);
  await press('Enter'); await wait(300);
  check('...and the next day starts with 1/3 of a tank', Math.round(await ev("e.fuel") * 1000) / 1000, 0.333);
  // A save from before fuel: a quarter tank.
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('icemachine.story.v2')); d.day = 2; localStorage.setItem('icemachine.story.v2', JSON.stringify(d)); });
  // ...and from before SCREAM-129: three slots, any flavours (cookies in the third).
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('icemachine.story.v2')); delete d.fuel; delete d.totals.gasCents;
    d.slots = [{ flavour: 'eclair', quantity: 3, priceCents: 225 }, { flavour: 'spongepop', quantity: 0, priceCents: 250 }, { flavour: 'cookie', quantity: 2, priceCents: 325 }];
    localStorage.setItem('icemachine.story.v2', JSON.stringify(d)); });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  await page.click('canvas'); await press('ArrowDown'); await press('Enter'); await wait(400);
  check('An old save (no fuel in it) continues with a quarter tank', await ev('e.fuel'), 0.25);
  check('An old 3-slot save (SCREAM-129): stock and prices kept, by flavour', await ev("e.slots.map(s => s.flavour + ':' + s.quantity + ':' + s.priceCents).join(' ')"), 'eclair:3:225 spongepop:0:250 explorer:0:250 cookie:2:325');

  console.log(`fuel: ${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' / ') : 'none'}`);
  await browser.close();
  process.exit(fail || errors.length ? 1 : 0);
})();
