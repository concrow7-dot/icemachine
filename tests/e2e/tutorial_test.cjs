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
  await page.evaluate(() => { localStorage.removeItem('icemachine.story.v1'); localStorage.removeItem('icemachine.highscores.tutorial.v1'); localStorage.setItem('icemachine.music.muted.v1', '1'); localStorage.setItem('icemachine.tutorial.done.v1', '1'); });
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
  // The map checks play without the uncle (SCREAM-169 has its own section below).
  await press('Enter'); await press('o'); await wait(400);
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
  // SCREAM-158: the PO's hand-made map (Tiled): 40 houses and home, no fences.
  check('The hand-made map: 40 houses and home, no fences', ((kinds.house || 0) + (kinds.villa || 0)) + ' ' + (kinds.fence || 0), '41 0');
  // SCREAM-160: every piece is in the picture sheet, and the sheet's URL carries the map's version.
  check('Every map piece is in the picture sheet', await drive("(t => s.map.objects.every(o => t.has(o.key)))(s.textures.get(s.assets.atlasKey))"), true);
  check('...which is fetched with the map version', await drive("s.assets.atlasPng.endsWith('?v=' + s.map.assetVersion) && !!s.map.assetVersion"), true);
  check('A basketball court and a playground', (kinds.court || 0) + ' ' + (kinds.play || 0), '1 1');
  check('Gardens beside a few houses', await drive("s.map.objects.filter(o => o.key.startsWith('orn_garden_bed')).length >= 4"), true);
  check('Every resident lives in a house (none in a shop)', await ev("e.residents.all.every(p => p.resident.door[1] > 0)"), true);
  await drive('(() => { const g = s.map.signs[0]; s.truck.setPosition(g.x + 40, g.y + 160); s.speed = 0; s.parkBrake = true; return true; })()'); await wait(2600);
  check('...a shop sign is shown when the truck is near', await drive("(t => !!t && t.visible)(s.children.getByName('sign-Bagel Time'))"), true);
  await page.screenshot({ path: outDir + '/tutorial_shops.png' });

  // ---- SCREAM-161: customers walk round houses, not through them ----
  const walk = await ev(`(() => {
    const R = e.residents, W = R.walls;
    const inside = (x, y) => W.some(w => x > w.x0 + 2 && x < w.x1 - 2 && y > w.y0 + 2 && y < w.y1 - 2);
    let tried = 0, through = 0, arrived = 0; const dbg = [];
    for (const w of W) {
      const cx = (w.x0 + w.x1) / 2, sx = cx, sy = w.y0 - 14, tx = cx, ty = w.y1 + 160;
      if (inside(sx, sy) || W.some(o => o !== w && sx > o.x0 - 8 && sx < o.x1 + 8 && sy > o.y0 - 8 && sy < o.y1 + 8)) continue;
      const p = R.all.filter(q => q.customer === 'none')[tried]; if (!p) break;
      R.wantIceCream(p); p.x = sx; p.y = sy; tried++;
      let hit = false, minD = 1e9;
      for (let i = 0; i < 3000 && p.customer === 'running'; i++) { R.update(0.1, { x: tx, y: ty, radius: 0, open: false }); minD = Math.min(minD, Math.hypot(p.x - tx, p.y - ty)); if (inside(p.x, p.y) && !hit) { hit = true; dbg.push([Math.round(sx), Math.round(sy), Math.round(p.x), Math.round(p.y), p.plan.kind, JSON.stringify(W.filter(o => p.x > o.x0 + 2 && p.x < o.x1 - 2 && p.y > o.y0 + 2 && p.y < o.y1 - 2))]); } }
      if (hit) through++;
      if (minD < 200 || p.customer !== 'running') arrived++; else dbg.push([Math.round(sx), Math.round(sy), Math.round(p.x), Math.round(p.y), Math.round(minD), p.customer, p.plan.kind, tx, ty]);
      p.customer = 'none'; p.plan = { kind: 'inside', until: 0 }; p.outside = false; p.waitAt = undefined; p.spotStand = undefined;
      if (tried >= 12) break;
    }
    return tried + ' tried, ' + through + ' through a house, ' + arrived + ' reached the truck' + (dbg.length ? ' ' + JSON.stringify(dbg) : '');
  })()`);
  check('Customers behind a house walk round it to the truck (12 tries)', walk, '12 tried, 0 through a house, 12 reached the truck');
  // SCREAM-162: nobody gets stuck at a corner: every resident, truck at their pink square and 250 px either way.
  const stuck = await ev(`(() => {
    const R = e.residents; let tries = 0; const out = [];
    R.all.forEach(p => {
      const c = p.resident.curb, a = c[4] * Math.PI / 180;
      for (const off of [0, 250, -250]) {
        const tx = c[2] + Math.cos(a) * off, ty = c[3] + Math.sin(a) * off;
        p.customer = 'none'; p.outside = false; p.waitAt = undefined; p.spotStand = undefined;
        R.wantIceCream(p); tries++;
        let last = [p.x, p.y], t = 0, lastT = 0;
        for (let i = 0; i < 1500 && p.customer === 'running'; i++) {
          R.update(0.1, { x: tx, y: ty, radius: 0, open: false }); t += 0.1;
          if (t - lastT >= 6) { if (Math.hypot(p.x - last[0], p.y - last[1]) < 8) { out.push(p.resident.id + '@' + Math.round(p.x) + ',' + Math.round(p.y)); break; } last = [p.x, p.y]; lastT = t; }
        }
        p.customer = 'none'; p.plan = { kind: 'inside', until: 0 }; p.outside = false; p.waitAt = undefined; p.spotStand = undefined;
      }
    });
    return tries + ' walks, stuck: ' + (out.join(' ') || 'none');
  })()`);
  check('No customer gets stuck on the way to the truck (40 residents x 3 spots)', stuck, '120 walks, stuck: none');

  // ---- SCREAM-159: Park Ave has two lanes each way; Russell St stops at Park Ave ----
  check('Park Avenue: two lanes each way (240 px of asphalt)', await drive("(r => r.lanes + ' ' + s.roads.halfWidth(s.map.roads.indexOf(r)) * 2)(s.map.roads.find(r => r.name === 'Park Avenue'))"), '2 240');
  check('...white lane lines between its lanes', await drive("s.dashes.some(d => d.white)"), true);
  check('Russell Street only south of Park Avenue', await drive("s.map.roads.filter(r => r.name === 'Russell Street').length"), 1);
  const parkSpot = await ev("(() => { const f = e.residents.curbs; const r = f.roads; const i = r.names.indexOf('Park Avenue'); const sg = r.segments.find(q => q.road === i); const mx = (sg.ax + sg.bx) / 2, my = (sg.ay + sg.by) / 2; const L = Math.hypot(sg.bx - sg.ax, sg.by - sg.ay); const nx = -(sg.by - sg.ay) / L, ny = (sg.bx - sg.ax) / L; const sp = f.near(mx + nx * 140, my + ny * 140, [], 0); if (!sp) return 'none'; return Math.round(Math.abs((sp.square[0] - mx) * nx + (sp.square[1] - my) * ny)) + ' ' + r.onRoad(sp.square[0], sp.square[1]) + ' ' + !r.onRoad(sp.stand[0], sp.stand[1]); })()");
  check('...a pink square beside Park Ave goes in its outside lane, the customer on the sidewalk', parkSpot, '90 true true');
  await drive("(() => { const r = s.map.roads.find(q => q.name === 'Park Avenue').points; s.truck.setPosition((r[0] + r[2]) / 2, (r[1] + r[3]) / 2); s.speed = 0; s.parkBrake = true; return 1; })()"); await wait(2600);
  await page.screenshot({ path: outDir + '/tutorial_parkave.png' });
  await drive("(g => { s.truck.setPosition(g.pad.x - 250, g.pad.y); s.speed = 0; s.parkBrake = true; return 1; })(s.map.gasStations[0])"); await wait(2600);
  await page.screenshot({ path: outDir + '/tutorial_gas.png' });

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

  check('Quick Play: no uncle', await ev('e.tutorial === null && !window.__game.scene.getScene("Hud").uncleBox'), true);

  // ---- SCREAM-169: the uncle's steps ----
  // Music on for this part, to hear the credits' tune (SCREAM-178).
  await page.evaluate(() => { localStorage.removeItem('icemachine.tutorial.done.v1'); localStorage.setItem('icemachine.music.muted.v1', '0'); });
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).some(s => s.scene.key === 'Title'));
  await page.click('canvas'); await wait(200);
  const uncle = () => page.evaluate(() => (b => b ? b.shown : '')(window.__game.scene.getScene('Hud').uncleBox));
  await press('ArrowDown', 2); await press('Enter'); await wait(500);
  check('First Tutorial: no question, the uncle comes along', await ev('!!e.tutorial'), true);
  await page.waitForFunction(() => window.__game.scene.isActive('TutorialCrawl')); await wait(1500);
  check('...the ice cream truck tune playing', await sc('TutorialCrawl', 's.sound.getAll("credits-tune").some(t => t.isPlaying)'), true);
  check('...over the tutorial map, zoomed out', await sc('TutorialCrawl', '(m => !!m && m.scale < 0.5)(s.children.getByName("crawl-map"))'), true);
  check('It opens with the credits: the blue line, no top bar', (await sc('TutorialCrawl', 's.children.getByName("crawl-still").alpha > 0.5')) + ' ' + (await page.evaluate(() => window.__game.scene.getScene('Hud').cameras.main.visible)), 'true false');
  await page.screenshot({ path: outDir + '/uncle_credits_still.png' });
  await wait(6000);
  check('...then the story scrolls away in yellow', await sc('TutorialCrawl', 's.lines.filter(t => t.visible).length > 2 && s.lines[0].scale < 1'), true);
  await page.screenshot({ path: outDir + '/uncle_credits_scroll.png' });
  await press('Enter');
  await page.waitForFunction(() => window.__game.scene.isActive('UncleIntro')); await wait(500);
  await wait(1500);
  check('...the tune fades out once the uncle appears', await sc('UncleIntro', 's.sound.getAll("credits-tune").length'), 0);
  check('Enter skips the rest: the uncle in the truck, on step 1', (await scenes()) + ' ' + (await ev('e.tutorial.step')), 'UncleIntro,Hud stock');
  check('...his first line in his quote box', await sc('UncleIntro', 's.shown'), "Thanks for helping out, kiddo. I can't work with this foot.");
  check('...drawn like a customer at the window', await sc('UncleIntro', 's.children.getByName("uncle").texture.key'), 'uncle-smooth');
  check('...the small box hidden meanwhile', await uncle(), '');
  check('...and the clock waits', await ev('e.clockRunning'), false);
  await page.screenshot({ path: outDir + '/uncle_intro.png' });
  await page.mouse.click(700, 200); await wait(200);
  check('Click: his next line', (await sc('UncleIntro', 's.shown')).startsWith("I'll help you get set up"), true);
  await page.mouse.click(700, 200); await wait(200);
  check('...then he asks for the cooler, outlined', (await sc('UncleIntro', 's.shown')).startsWith("Let's start by selecting your stock") + ' ' + (await sc('UncleIntro', 's.askingForCooler')), 'true true');
  await page.screenshot({ path: outDir + '/uncle_click_cooler.png' });
  await page.mouse.click(700, 200); await wait(300);
  check('...a click elsewhere does nothing', await scenes(), 'UncleIntro,Hud');
  await page.mouse.click(150, 450); await wait(600);
  check('Clicking the cooler: to the cooler, his small box carries on', (await scenes()) + ' ' + (await uncle()), 'Cooler,Hud Select what you want from the "Available Ice Cream" clipboard.');
  const pointer = () => sc('Cooler', '(g => g && g.visible ? "on" : "off")(s.children.getByName("uncle-pointer"))');
  check('...the clipboard outlined', await pointer(), 'on');
  await page.screenshot({ path: outDir + '/uncle_cooler.png' });
  await wait(6500);
  check('...that line waits for a flavour (no moving on by itself)', (await uncle()).startsWith('Select what you want'), true);
  await page.mouse.click(600, 80); await wait(200);
  check('...nor when clicked', (await uncle()).startsWith('Select what you want'), true);
  await press('+'); await wait(90);
  await page.screenshot({ path: outDir + '/uncle_pop_mid.png' });
  await wait(250);
  check('A new line pops in: the bubble grows back to full size', await page.evaluate(() => (b => b.bubble.scale > 0.95 && b.bubble.alpha > 0.95)(window.__game.scene.getScene('Hud').uncleBox)), true);
  await page.screenshot({ path: outDir + '/uncle_menu.png' });
  check('Adding a flavour: on to the price line, Today\'s Menu outlined', (await uncle()) + ' ' + (await pointer()), 'Once you\'ve added a new flavor, you can set the price in "Today\'s Menu". on');
  await page.mouse.click(600, 80); await wait(200);
  check('Click: be careful with prices', (await uncle()).startsWith('Be careful: too expensive'), true);
  await page.mouse.click(600, 80); await wait(200);
  check('Click: Buy Stock, outlined', (await uncle()).startsWith('When you\'re ready, "Buy Stock"') + ' ' + (await pointer()), 'true on');
  await page.screenshot({ path: outDir + '/uncle_buy.png' });
  await press('+', 4); await press('Enter'); await wait(700);
  // ---- SCREAM-171: the uncle drives, stopping for his regular, then on to the pump ----
  check('Buy Stock: back in the truck, the uncle says it\'s time for gas', (await scenes()) + ' ' + (await ev('e.tutorial.step')) + ' ' + (await sc('UncleIntro', 's.shown')).startsWith("Let's go get some gas"), 'UncleIntro,Hud drive true');
  check('...a quarter tank to start', await ev('Math.round(e.fuel * 100)'), 25);
  await page.screenshot({ path: outDir + '/uncle_heading_out.png' });
  await wait(7000);
  check('...his line waits until read', await scenes(), 'UncleIntro,Hud');
  await press('Enter'); await wait(900);
  check('Enter: he turns and walks toward the cab', await sc('UncleIntro', 's.children.getByName("uncle").texture.key'), 'uncle-smooth-walk-away');
  await wait(350);
  check('...toward the driver\'s seat on the left, clear of the cooler', await sc('UncleIntro', '(u => u.x < 470 && u.x - u.displayWidth * 0.3 > 362)(s.children.getByName("uncle"))'), true);
  await page.screenshot({ path: outDir + '/uncle_walking.png' });
  await page.waitForFunction(() => window.__game.scene.isActive('Drive'), null, { timeout: 8000 });
  await wait(400);
  check('...fade to the road: he has the wheel, heading for his regular', (await drive('s.uncleLeg')) + ' ' + (await ev('e.isPrepLocked')), 'toRegular true');
  check('...his line about the sun', (await uncle()).startsWith('The sun has been setting at 8 PM'), true);
  check('His route stays on the road and clear of parked cars', await drive('(r => { let bad = []; for (let d = 0; d < r.length; d += 6) { const p = r.at(d); const hit = s.obstacleAt(p.x, p.y, p.heading); if (hit) bad.push(Math.round(d) + hit); } return bad.join(" ") || "clear"; })(s.uncleRoute)'), 'clear');
  check('Nobody else comes out while he drives', await ev('e.residents.hearingOff'), true);
  const onRoute = () => drive('(p => Math.hypot(p.x - s.truck.x, p.y - s.truck.y) < 3)(s.uncleRoute.at(s.uncleAlong))');
  await page.keyboard.down('ArrowLeft'); await page.keyboard.down('ArrowUp'); await wait(900);
  check('Steering does nothing: still on his route', await onRoute(), true);
  await page.keyboard.up('ArrowLeft'); await page.keyboard.up('ArrowUp');
  await page.screenshot({ path: outDir + '/uncle_drive.png' });
  // PO (November 6): about 10 seconds from home to his regular (4 times as long as before).
  const leftHome = Date.now();
  await page.waitForFunction(() => window.__game.registry.get('evening').tutorial.step === 'regular', null, { timeout: 25000 });
  const toRegular = (Date.now() - leftHome) / 1000 + 1.3;
  check('Home to his regular takes about 10 seconds (was about 2.6)', toRegular > 8.5 && toRegular < 13.5 ? 'ok' : toRegular.toFixed(1), 'ok');
  await wait(600);
  check('The instant she has her "!": he names her', (await uncle()) + ' | ' + (await ev("e.residents.all.find(p => p.resident.id === 'T008').customer")), "Oh hey, it's Chloe Hogan... They buy ice cream pretty much every night. | running");
  check('...and the truck stops', await drive('s.speed < 1'), true);
  await page.screenshot({ path: outDir + '/uncle_spotted.png' });
  const spottedAt = Date.now();
  await page.waitForFunction(() => window.__game.registry.get('evening').tutorial.lineNumber === 1, null, { timeout: 9000 });
  const held = (Date.now() - spottedAt) / 1000 + 0.6;
  check('...for about 4 seconds', held > 3.4 && held < 4.8 ? 'ok' : held.toFixed(1), 'ok');
  await wait(1200);
  check('Then his second line, and the truck creeps forward', (await uncle()) + ' | ' + (await drive('s.speed > 5 && s.speed < 40')), 'Try and figure out where the regulars are. Chloe Hogan gets ice cream almost every night. | true');
  await page.waitForFunction(() => { const s = window.__game.scene.getScene('Drive'); return !s.scene.isActive() || !s.uncleLeg; }, null, { timeout: 15000 });
  const creep = (Date.now() - spottedAt) / 1000 - held;
  check('...for about 4 to 6 seconds, up to her square', creep > 3.5 && creep < 7 ? 'ok' : creep.toFixed(1), 'ok');
  if (await drive('s.scene.isActive()')) check('He pulls up straight, at her square, park brake on', (await drive('s.speed === 0 && s.parkBrake')) + ' ' + (await drive("(c => Math.hypot(s.truck.x - c[2], s.truck.y - c[3]) < 30)(window.__game.registry.get('evening').residents.all.find(p => p.resident.id === 'T008').resident.curb)")) + ' ' + (await drive('Math.abs(s.uncleRoute.at(s.uncleRoute.distanceAlong(s.truck.x, s.truck.y)).heading - 95.9) < 2')), 'true true true');
  await page.screenshot({ path: outDir + '/uncle_regular.png' });
  // SCREAM-172: pulled up, he says his line; her window waits until it's read.
  check('Pulled up: his line about the sale, and the window waits for it', (await uncle()) + ' | ' + (await ev('e.tutorial.holdsWindow')), 'Remember the order, add the ice cream from the cooler, and calculate the price. | true');
  await wait(1500);
  check('...1.5 seconds on: still on the road', await scenes(), 'Drive,Hud');
  await page.mouse.click(430, 84);
  await page.waitForFunction(() => window.__game.scene.isActive('Sales'), null, { timeout: 5000 });
  check('Clicking his line: her window opens: Chloe', await ev("e.residents.all.find(p => p.resident.id === 'T008').customer"), 'window');
  check('...his line stays up while she orders', (await uncle()) + ' | ' + (await ev('e.sale.phase')), 'Remember the order, add the ice cream from the cooler, and calculate the price. | ordering');
  await page.screenshot({ path: outDir + '/uncle_sales.png' });
  await page.waitForFunction(() => window.__game.registry.get('evening').sale.phase === 'deciding', null, { timeout: 9000 });
  await wait(400);
  check('Once she has ordered: his tip about R', (await uncle()) + ' | ' + (await ev('e.tutorial.holdsSale')), 'Customers will usually let you ask for a repeat of their order. (Hit R) | true');
  check('...with "R: Ask Again" outlined', await sc('Sales', '(g => g.visible && s.repeatHintRect() !== null)(s.children.getByName("uncle-pointer"))'), true);
  await page.screenshot({ path: outDir + '/uncle_repeat.png' });
  const patience0 = await ev('e.sale.patienceLeftSeconds(e.nowMs)');
  const tip0 = await ev('e.sale.countdownSeconds(e.nowMs)');
  await wait(4000);
  check('...4 seconds on: her wait and the tip countdown haven\'t moved', (await ev(`Math.round(e.sale.patienceLeftSeconds(e.nowMs) - ${patience0})`)) + ' ' + (await ev(`Math.round(e.sale.countdownSeconds(e.nowMs) - ${tip0})`)), '0 0');
  await press('r'); await wait(300);
  check('R: she repeats it, and his last line', (await ev('e.sale.phase')) + ' ' + (await ev('e.tutorial.holdsSale')) + ' | ' + (await uncle()), 'ordering false | Make sure to get the order and price correct.');
  await wait(1500);
  check('...her wait counts down now', await ev(`e.sale.patienceLeftSeconds(e.nowMs) < ${patience0} - 1`), true);
  await press('b'); await wait(900);
  check('Sale over (here, driven off): back on the road, he drives on to the pump', (await scenes()) + ' ' + (await ev('e.tutorial.step')) + ' ' + (await drive('s.uncleLeg')), 'Drive,Hud pump toPump');
  check('...saying', await uncle(), "Now, let's get that gas.");
  await page.waitForFunction(() => window.__game.scene.isActive('Pump'), null, { timeout: 25000 });
  check('He stops in the pump bay: the pump opens', await scenes(), 'Pump,Hud');
  await page.screenshot({ path: outDir + '/uncle_pump.png' });
  await press('Enter'); await wait(800);
  check('Gas bought: the rest of the evening is the player\'s', (await scenes()) + ' ' + (await ev('e.tutorial.step')) + ' ' + (await ev('e.residents.hearingOff')), 'Drive,Hud alone false');
  await page.keyboard.down('ArrowUp'); await wait(700); await page.keyboard.up('ArrowUp');
  check('...and the player drives', await drive('s.speed > 0'), true);
  await page.mouse.click(430, 84); await wait(300);
  check('...his last line read: he is done', await ev('e.tutorial.step'), 'done');
  await page.keyboard.press('Shift+Digit3'); await wait(600);
  check('Ending the evening marks the tutorial done', await page.evaluate(() => localStorage.getItem('icemachine.tutorial.done.v1')), '1');
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).some(s => s.scene.key === 'Title'));
  await page.click('canvas'); await wait(200);
  await press('ArrowDown', 2); await press('Enter'); await wait(300);
  check('The title screen credits the tune', await sc('Title', 's.children.list.some(o => o.text && o.text.includes("Tune: Travis Morgan"))'), true);
  check('Tutorial again: asks whether to bring the uncle', await sc('Title', 's.confirming && s.asking'), 'uncle');
  await page.screenshot({ path: outDir + '/uncle_choice.png' });
  await page.evaluate(() => localStorage.setItem('icemachine.music.muted.v1', '1'));
  await press('o'); await wait(500);
  check('On My Own: the tutorial map, no uncle', (await ev('e.mapId')) + ' ' + (await ev('e.tutorial === null')), 'tutorial true');

  console.log(`tutorial: ${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' / ') : 'none'}`);
  await browser.close();
  process.exit(fail || errors.length ? 1 : 0);
})();
