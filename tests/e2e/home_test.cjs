// SCREAM-54: Home's driveway. Stop in the marked spot outside home to restock: the same
// cooler screen, the clock keeps running, prices can change, leaving goes back to the road.
// When sold out, an arrow points home (Tom Cobb, round 2).
const { chromium } = require('playwright');
(async () => {
  const [port, outDir] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  // SCREAM-175: these suites play as a player who has finished the tutorial (every mode unlocked).
  await page.addInitScript(() => { try { localStorage.setItem('icemachine.tutorial.done.v1', '1'); localStorage.setItem('icemachine.howtodrive.off.v1', '1'); } catch {} });
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
  const wait = ms => page.waitForTimeout(ms);
  const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(40); } await wait(120); };
  let pass = 0, fail = 0;
  const check = (name, got, want) => { const ok = String(got) === String(want); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(64) + ' got=' + got + (ok ? '' : ' want=' + want)); };
  const stock = () => ev('e.slots.map(s => s.quantity).join(",")');
  // Parks the truck stopped in the driveway spot, or 400 px down the road from it.
  const intoDriveway = () => drive('(s.truck.setPosition(s.homeBay.x, s.homeBay.y), s.setHeading(s.homeBay.angle), s.speed = 0, s.parkBrake = true, true)');
  const awayFromDriveway = () => drive('(() => { const r = s.homeBay.rotation; s.truck.setPosition(s.homeBay.x + Math.cos(r) * 400, s.homeBay.y + Math.sin(r) * 400); s.speed = 0; s.parkBrake = true; return true; })()');

  // ---- Stock up and drive off ----
  await page.click('canvas'); await press('Enter'); await wait(300);
  await press('+', 5); await press('Enter'); await wait(250);
  await press('ArrowRight'); await press('Enter'); await wait(500);
  await ev('(e.residents.hearingOff = true, true)');
  check('On the road', await scenes(), 'Drive,Hud');
  check('A driveway spot outside home, where the evening starts', await drive('Math.round(Math.hypot(s.homeBay.x - s.truck.x, s.homeBay.y - s.truck.y)) < 10'), true);
  check('...starting in it does not open the cooler', await scenes(), 'Drive,Hud');
  check('No arrow with stock in the cooler', await drive('s.homeArrow.visible'), false);

  // ---- Sold out: the arrow ----
  await awayFromDriveway(); await wait(300);
  await ev("(e.coolerSlots.forEach(s => s.quantity = 0), e.emit('cooler-changed'), true)"); await wait(200);
  check('Sold out: an arrow points home', await drive('s.homeArrow.visible'), true);
  await drive('(s.truck.setPosition(s.homeBay.x + 2500, s.homeBay.y), true)'); await wait(2500); // the camera glides after the truck
  check('...far away: at the edge of the view, pointing toward home', await drive('(() => { const v = s.cameras.main.worldView; const a = s.homeArrow; return a.x >= v.x && a.x <= v.right && a.y >= v.y && a.y <= v.bottom && a.x < s.truck.x; })()'), true);
  await page.screenshot({ path: outDir + '/home_arrow.png' });

  // ---- Pull into the driveway: restock ----
  const clock = await ev('e.clockMinutes');
  await intoDriveway(); await wait(400);
  check('Stopped in the driveway: the cooler opens', await scenes(), 'Cooler,Hud');
  check('...in restock mode', (await ev('e.isRestocking')) + ' ' + (await sc('Cooler', 's.title.text')).startsWith('THE COOLER  –  RESTOCK AT HOME'), 'true true');
  await wait(1500);
  check('...the clock keeps running', (await ev('e.clockMinutes')) > clock, true);
  await page.screenshot({ path: outDir + '/home_restock.png' });
  const cash = await ev('e.moneyCents');
  await press('+', 3); await press('ArrowRight'); await press('+', 2);
  check('Pick 3 eclairs and raise their price', await sc('Cooler', 's.order.slots[0].quantity + ":" + s.order.slots[0].priceCents'), '3:250');
  await press('Enter'); await wait(400);
  check('Buy Stock: back on the road (not the truck)', await scenes(), 'Drive,Hud');
  check('...3 eclairs in the cooler, $3.00 charged, price $2.50', (await stock()) + ' ' + (cash - (await ev('e.moneyCents'))) + ' ' + (await ev('e.slots[0].priceCents')), '3,0,0,0 300 250');
  check('...not restocking any more; the arrow has gone', (await ev('e.isRestocking')) + ' ' + (await drive('s.homeArrow.visible')), 'false false');
  check('...still in the spot, it does not open again', await scenes(), 'Drive,Hud');
  await drive('(s.speed = 20, s.parkBrake = false, true)'); await wait(80); await drive('(s.speed = 0, s.parkBrake = true, true)'); await wait(300);
  check('SCREAM-304: Quick play unchanged: moving and stopping in the spot does not open it', await scenes(), 'Drive,Hud');
  await awayFromDriveway(); await wait(300); await intoDriveway(); await wait(400);
  check('Leave the spot and come back: it opens again', await scenes(), 'Cooler,Hud');
  await press('b'); await wait(400);
  check('B: back on the road without buying', (await scenes()) + ' ' + (await stock()), 'Drive,Hud 3,0,0,0');

  console.log(`home: ${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' / ') : 'none'}`);
  await browser.close();
  process.exit(fail || errors.length ? 1 : 0);
})();
