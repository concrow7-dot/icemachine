// SCREAM-22: fuel. The gauge, driving uses gas, an empty tank crawls at a quarter
// speed, the gas station's pump bay on Park Avenue, buying in $5 steps up to $30 a
// tank, Quick play's full tank, Story's quarter tank on day 1 carried over and saved.
const { chromium } = require('playwright');
(async () => {
  const [port, outDir] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.evaluate(() => { localStorage.removeItem('icemachine.story.v1'); localStorage.setItem('icemachine.music.muted.v1', '1'); });
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
  const awayFromBay = () => drive(`(() => { const b = s.pumpBays[0]; s.truck.setPosition(b.x + Math.cos(b.rotation) * 160, b.y + Math.sin(b.rotation) * 160); s.speed = 0; s.parkBrake = true; return true; })()`);
  const fuel = async () => Math.round((await ev('e.fuel')) * 10000) / 10000;

  // ---- Quick play: a full tank ----
  await page.click('canvas'); await press('Enter'); await wait(200);
  check('Quick play starts with a full tank', await ev('e.fuel'), 1);
  check('No gauge at the cooler (shown while driving)', await sc('Hud', 's.fuelGauge.visible'), false);
  await press('+', 6); await press('Enter'); await wait(200);
  await press('ArrowRight'); await press('Enter'); await wait(400);
  await ev('(e.residents.hearingOff = true, true)');
  check('On the road: the gauge shows in the top bar', await sc('Hud', 's.fuelGauge.visible'), true);
  await page.screenshot({ path: outDir + '/fuel_hud.png' });

  // ---- Driving uses gas, by distance ----
  const start = await drive('[s.truck.x, s.truck.y]');
  const before = await ev('e.fuel');
  await drive('(s.parkBrake = false, true)');
  await page.keyboard.down('ArrowUp'); await wait(1200); await page.keyboard.up('ArrowUp'); await wait(200);
  const end = await drive('[s.truck.x, s.truck.y]');
  const used = before - (await ev('e.fuel'));
  const straight = Math.hypot(end[0] - start[0], end[1] - start[1]);
  check('Driving uses gas', used > 0, true);
  near('...about 1 tank per 78,000 px (used x 78,000 / straight-line px)', Math.round((used * 78000 / straight) * 100) / 100, 0.99, 1.6);
  check('Parked, no gas is used', await (async () => { await drive('(s.speed = 0, s.parkBrake = true, true)'); const a = await ev('e.fuel'); await wait(500); return a === (await ev('e.fuel')); })(), true);

  // ---- An empty tank: a quarter speed ----
  await ev('(e.burnFuel(1e9), true)');
  check('Burning more than is left stops at empty', await ev('e.fuel + " " + e.isOutOfFuel'), '0 true');
  await awayFromBay();
  await drive('(s.parkBrake = false, true)');
  await page.keyboard.down('ArrowUp'); await wait(2500);
  near('Empty: the truck crawls at a quarter of 433 px/s', Math.round(await drive('s.speed')), 100, 109);
  await page.keyboard.up('ArrowUp'); await wait(200);
  await drive('(s.speed = 433, true)'); await wait(600);
  near('Running dry at full speed: slows to the crawl', Math.round(await drive('s.speed')), 0, 109);
  await drive('(s.speed = 0, s.parkBrake = true, true)');

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
  check('Empty tank, $44 cash: the pump starts at $30, a full tank', await sc('Pump', 's.amount'), 3000);
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
  check('Half a tank: the pump starts at $15', await sc('Pump', 's.amount'), 1500);
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
  check('Gas only in $5 steps', await ev('e.buyGas(300)'), false);
  check('No more than fits ($20 into half a tank)', await ev('e.buyGas(2000)'), false);
  check('Filling up with $15', (await ev('e.buyGas(1500)')) + ' ' + (await fuel()), 'true 1');
  check('Full: nothing more to buy', await ev('e.maxGasCents'), 0);
  await awayFromBay(); await wait(200); await intoBay();
  await until(async () => (await scenes()) === 'Pump,Hud');
  check("Full tank at the pump: says the tank's full", /tank's full/.test(await texts('Pump')), true);
  await press('Enter'); await wait(300);
  check('Enter with nothing to buy just drives off', await scenes(), 'Drive,Hud');
  await ev('(e.burnFuel(78000 * 0.75), e.changeMoney(-e.moneyCents + 1200, "test", false), true)');
  check('$12 and a quarter tank: only whole $5 steps the wallet covers ($10)', await ev('e.maxGasCents'), 1000);
  await ev('(e.burnFuel(78000 * 0.1), true)');
  check('A tank a step short of full in steps: 0.15 tank, room for $25', await ev('(e.changeMoney(5000, "test", false), e.maxGasCents)'), 2500);
  await ev('(e.changeMoney(-e.moneyCents + 300, "test", false), true)');
  await awayFromBay(); await wait(200); await intoBay();
  await until(async () => (await scenes()) === 'Pump,Hud');
  check('$3: not enough cash, and it says so', /Not enough cash/.test(await texts('Pump')) + ' ' + (await sc('Pump', 's.amount')), 'true 0');
  await press('b'); await wait(300);

  // ---- Results ----
  await shift(3); await wait(400);
  const results = await texts('Results');
  check("Results: a Gas line with tonight's gas", /Gas/.test(results) && /-\$30\.00/.test(results), true);
  await page.screenshot({ path: outDir + '/fuel_results.png' });

  // ---- Story: a quarter tank on day 1, carried over and saved ----
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  await page.click('canvas'); await press('ArrowDown'); await press('Enter'); await wait(300); await press('Enter'); await wait(300);
  check('Story day 1: $100 and a quarter tank', (await ev('e.moneyCents')) + ' ' + (await ev('e.fuel')), '10000 0.25');
  await press('+', 2); await press('Enter'); await wait(200);
  await press('ArrowRight'); await press('Enter'); await wait(400);
  await ev('(e.residents.hearingOff = true, true)');
  await intoBay();
  await until(async () => (await scenes()) === 'Pump,Hud');
  check('A quarter tank: the pump starts at $20 (the next $5 would overflow)', (await sc('Pump', 's.amount')) + ' ' + /overflow/.test(await texts('Pump')), '2000 true');
  await press('Enter'); await wait(300);
  const tank = await ev('e.fuel');
  near('...$20 is 2/3 of a tank: now 11/12', Math.round(tank * 1000) / 1000, 0.916, 0.917);
  await shift(3); await wait(300);
  check('End of day 1: Gas line on the end-of-day screen', /Gas/.test(await texts('DayEnd')) && /-\$20\.00/.test(await texts('DayEnd')), true);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('icemachine.story.v1')));
  check("The save keeps the tank and the run's gas", Math.abs(saved.fuel - tank) < 1e-9 && saved.totals.gasCents === 2000, true);
  await press('Enter'); await wait(300);
  check('Day 2 starts with what was left in the tank', Math.abs((await ev('e.fuel')) - tank) < 1e-9, true);
  // Restart this evening (pause menu): back to how tonight started, tank included.
  await ev('(e.burnFuel(30000), true)');
  await press('Escape'); await wait(200); await press('ArrowDown'); await press('Enter'); await wait(150); await press('y'); await wait(400);
  check("Restarting the evening puts back tonight's starting tank", Math.abs((await ev('e.fuel')) - tank) < 1e-9, true);
  // A save from before fuel: a quarter tank.
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('icemachine.story.v1')); delete d.fuel; delete d.totals.gasCents; localStorage.setItem('icemachine.story.v1', JSON.stringify(d)); });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  await page.click('canvas'); await press('ArrowDown'); await press('Enter'); await wait(400);
  check('An old save (no fuel in it) continues with a quarter tank', await ev('e.fuel'), 0.25);

  console.log(`fuel: ${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' / ') : 'none'}`);
  await browser.close();
  process.exit(fail || errors.length ? 1 : 0);
})();
