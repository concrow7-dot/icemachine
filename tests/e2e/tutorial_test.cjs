// SCREAM-146: the tutorial map. Tutorial on the title screen plays one evening on the smaller
// map (Institute Rd, Highland St, Haviland St, Park Ave) with its own 40 residents, one gas
// station and home on Westland St. Quick play and Story stay on Worcester.
const { chromium } = require('playwright');
(async () => {
  const [port, outDir] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.evaluate(() => { localStorage.removeItem('icemachine.story.v1'); localStorage.removeItem('icemachine.highscores.tutorial.v1'); localStorage.setItem('icemachine.music.muted.v1', '1'); });
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  const ev = (fn) => page.evaluate(`(() => { const e = window.__game.registry.get('evening'); return ${fn}; })()`);
  const sc = (key, fn) => page.evaluate(`(() => { const s = window.__game.scene.getScene('${key}'); return ${fn}; })()`);
  const drive = (fn) => sc('Drive', fn);
  const scenes = () => page.evaluate(() => window.__game.scene.getScenes(true).map(s => s.scene.key).join(','));
  const wait = ms => page.waitForTimeout(ms);
  const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(40); } await wait(120); };
  let pass = 0, fail = 0;
  const check = (name, got, want) => { const ok = String(got) === String(want); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(64) + ' got=' + got + (ok ? '' : ' want=' + want)); };

  // ---- The title menu ----
  await page.click('canvas'); await wait(200);
  check('Title menu: Quick Play, Story, Tutorial', await sc('Title', 's.options.map(o => o.label).join()'), 'Quick Play,Story,Tutorial');
  await press('ArrowDown', 2);
  await page.screenshot({ path: outDir + '/tutorial_title.png' });
  check('↓ ↓ highlights Tutorial', await sc('Title', 's.modeTexts[2].text'), '> Tutorial <');
  await press('Enter'); await wait(400);
  check('Tutorial starts an evening on the tutorial map', await ev('e.mapId'), 'tutorial');
  check('...with its own 40 residents (sheet 23)', await ev('e.residents.all.length + " " + e.residents.all.every(p => p.resident.id.startsWith("T"))'), '40 true');

  // ---- On the road ----
  await press('+', 5); await press('Enter'); await wait(250);
  await press('ArrowRight'); await press('Enter'); await wait(800);
  await ev('(e.residents.hearingOff = true, true)');
  check('On the road', await scenes(), 'Drive,Hud');
  check('The smaller map is drawn (2962 x 2510 px)', await drive('s.map.width + "x" + s.map.height'), '2962x2510');
  check('...starting outside home on Westland Street', await drive('Math.round(Math.hypot(s.map.homeStart.x - s.truck.x, s.map.homeStart.y - s.truck.y)) < 10'), true);
  check('...with Westland Street on the map', await drive('s.map.roads.some(r => r.name === "Westland Street") && !s.map.roads.some(r => r.name === "Dover Street")'), true);
  check('One gas station, with its bay', await drive('s.pumpBays.length'), 1);
  check('Residents drawn from the tutorial sheet', await drive('s.residentSprites.length + " " + s.residentSprites[0].texture.key'), '40 residents-tutorial');
  await wait(2500);
  await page.screenshot({ path: outDir + '/tutorial_drive.png' });

  // ---- SCREAM-52: the neighbourhood's matching details ----
  check('Six businesses on Park Avenue, with their names on their signs', await drive('s.map.signs.map(g => g.text).join()'), 'Bagel Time,Dippin Donuts,UPS Store,Fancy Florist,The Boynton,Thai Time');
  const kinds = await drive("(() => { const c = {}; for (const o of s.map.objects) { const k = o.key.split('_')[0]; c[k] = (c[k] || 0) + 1; } return c; })()");
  check('Matching street lamps along the streets', kinds.lamp > 15, true);
  check('Picket fences round some houses', kinds.fence > 50, true);
  check('A basketball court and a playground', (kinds.court || 0) + ' ' + (kinds.play || 0), '1 1');
  check('Gardens beside a few houses', await drive("s.map.objects.filter(o => o.key.startsWith('orn_garden_bed')).length >= 4"), true);
  check('Every resident lives in a house (none in a shop)', await ev("e.residents.all.every(p => p.resident.door[1] > 0)"), true);
  await drive('(() => { const g = s.map.signs[0]; s.truck.setPosition(g.x + 40, g.y + 160); s.speed = 0; s.parkBrake = true; return true; })()'); await wait(2600);
  check('...a shop sign is shown when the truck is near', await drive("(t => !!t && t.visible)(s.children.getByName('sign-Bagel Time'))"), true);
  await page.screenshot({ path: outDir + '/tutorial_shops.png' });

  // ---- A customer at the window ----
  const idx = await ev("e.residents.all.findIndex(p => p.customer === 'none')");
  await ev(`e.residents.callNow(e.residents.all[${idx}])`); await wait(300);
  check('A customer gets a pink square on a tutorial street', await drive(`(z => !!z && z.visible && s.roads.onRoad(z.x, z.y))(s.pickupZones.get(${idx}))`), true);
  await drive(`(z => { s.truck.setPosition(z.x, z.y); s.setHeading(z.angle); s.speed = 0; s.parkBrake = true; })(s.pickupZones.get(${idx}))`); await wait(500);
  check('Stopped in the square: the sales window opens', await scenes(), 'Sales,Hud');
  check('...the customer drawn from the tutorial sheet', await page.evaluate(() => (p => p && p.texture.key)(window.__game.scene.getScene('Sales').children.getByName('customer'))), 'customer-smooth-residents-tutorial-' + (await ev('e.customer.resident.look')));

  // ---- Restart keeps the map; Quit then Quick play goes back to Worcester ----
  await press('Escape'); await press('ArrowDown'); await press('Enter'); await press('y'); await wait(500);
  check('Restart evening: still on the tutorial map', (await scenes()) + ' ' + (await ev('e.mapId')), 'Cooler,Hud tutorial');
  await press('Escape'); await press('ArrowDown', 2); await press('Enter'); await press('y'); await wait(500);
  check('Quit: title screen', await scenes(), 'Title');
  await press('Enter'); await wait(400);
  check('Quick Play: back on Worcester with its 160 residents', (await ev('e.mapId')) + ' ' + (await ev('e.residents.all.length')), 'worcester 160');
  await press('+', 5); await press('Enter'); await wait(250);
  await press('ArrowRight'); await press('Enter'); await wait(800);
  check('...the big map drawn, two gas stations', (await drive('s.map.width')) + ' ' + (await drive('s.pumpBays.length')), '6242 2');

  console.log(`tutorial: ${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' / ') : 'none'}`);
  await browser.close();
  process.exit(fail || errors.length ? 1 : 0);
})();
