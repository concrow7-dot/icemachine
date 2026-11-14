// SCREAM-146: the tutorial map: the smaller map (Institute Rd, Highland St, Haviland St, Park Ave)
// with its own 40 residents, one gas station and home on Westland St.
// SCREAM-205: Story is played on it (the uncle's evening is Day 1); Quick Play stays on Worcester.
const { chromium } = require('playwright');
(async () => {
  const [port, outDir] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.evaluate(() => { localStorage.removeItem('icemachine.story.v2'); localStorage.removeItem('icemachine.highscores.tutorial.v1'); localStorage.setItem('icemachine.music.muted.v1', '1'); localStorage.setItem('icemachine.tutorial.done.v1', '1'); });
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
  check('Title menu: Quick Play, Story (no Tutorial, SCREAM-205)', await sc('Title', 's.options.map(o => o.label).join()'), 'Quick Play,Story');
  await press('ArrowDown');
  await page.screenshot({ path: outDir + '/tutorial_title.png' });
  check('↓ highlights Story', await sc('Title', 's.modeTexts[1].text'), '> Story <');
  // The map checks play without the uncle (SCREAM-169 has its own section below).
  await press('Enter'); await wait(200);
  check('Tutorial already played: Story asks whether to bring the uncle', await sc('Title', 's.confirming && s.asking'), 'uncle');
  await press('o'); await wait(300); await press('Enter'); await wait(400); // past the Story intro
  check('Story starts an evening on the tutorial map, no uncle', (await ev('e.mapId')) + ' ' + (await ev('e.tutorial === null')), 'tutorial true');
  check('...Day 1 of 5, with $25', (await page.evaluate(() => (r => r.day + '/' + r.days)(window.__game.registry.get('story')))) + ' ' + (await ev('e.moneyCents')), '1/5 2500');
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

  // ---- SCREAM-189: Big Kev always orders 7 (sheet 23's "Order size") ----
  check('Big Kev: an order size of 7 from the sheet', await ev("e.residents.all.find(p => p.resident.id === 'T034').resident.orderSize"), 7);
  await ev("(e.coolerSlots.forEach((c, i) => { if (i < 3) { c.quantity = 4; c.priceCents = 200; } }), e.orderPictureChance = 0, true)");
  await drive("(s.serve(window.__game.registry.get('evening').residents.all.find(p => p.resident.id === 'T034')), true)");
  await page.waitForFunction(() => window.__game.scene.isActive('Sales'), null, { timeout: 5000 }); await wait(1500);
  check('...he orders 7 ice creams', await ev('e.sale.order.reduce((n, l) => n + l.count, 0)'), 7);
  await page.screenshot({ path: outDir + '/bigkev_words.png' });
  await press('b'); await wait(600);
  await ev("(e.orderPictureChance = 1, e.coolerSlots.forEach((c, i) => { if (i < 3) c.quantity = 4; }), true)");
  await drive("(s.serve(window.__game.registry.get('evening').residents.all.find(p => p.resident.id === 'T034')), true)");
  await page.waitForFunction(() => window.__game.scene.isActive('Sales'), null, { timeout: 5000 }); await wait(1500);
  check('...in pictures too', (await ev('e.sale.pictures')) + ' ' + (await ev('e.sale.order.reduce((n, l) => n + l.count, 0)')), 'true 7');
  await page.screenshot({ path: outDir + '/bigkev_pictures.png' });
  await press('b'); await wait(600);
  await ev("(e.coolerSlots.forEach((c, i) => { if (i < 3) c.quantity = 1; }), e.orderPictureChance = 0.5, true)");
  await drive("(s.serve(window.__game.registry.get('evening').residents.all.find(p => p.resident.id === 'T034')), true)");
  await page.waitForFunction(() => window.__game.scene.isActive('Sales'), null, { timeout: 5000 }); await wait(400);
  check('...with only 3 in stock, he orders all 3', await ev('e.sale.order.reduce((n, l) => n + l.count, 0)'), 3);
  await press('b'); await wait(600);
  await ev("(e.coolerSlots.forEach(c => { c.quantity = 0; }), true)");

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
  await press('Escape'); await press('ArrowDown', 2); await press('Enter'); await press('y'); await wait(500);
  check('Restart evening: still on the tutorial map', (await scenes()) + ' ' + (await ev('e.mapId')), 'Cooler,Hud tutorial');
  await press('Escape'); await press('ArrowUp'); await press('Enter'); await press('y'); await wait(500); // ↑ from Resume wraps to the last item
  check('Quit: title screen', await scenes(), 'Title');
  await press('Enter'); await wait(400);
  check('Quick Play: back on Worcester with its 160 residents', (await ev('e.mapId')) + ' ' + (await ev('e.residents.all.length')), 'worcester 160');
  await press('+', 5); await press('Enter'); await wait(250);
  await press('ArrowRight'); await press('Enter'); await wait(800);
  check('...the big map drawn, two gas stations', (await drive('s.map.width')) + ' ' + (await drive('s.pumpBays.length')), '6242 2');

  check('Quick Play: no uncle', await ev('e.tutorial === null && !window.__game.scene.getScene("Hud").uncleBox'), true);

  // ---- SCREAM-169: the uncle's steps ----
  // Music on for this part, to hear the credits' tune (SCREAM-178).
  // SCREAM-175: a brand-new player (no tutorial finished, no Story, no high scores).
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k !== 'icemachine.music.muted.v1') localStorage.removeItem(k); localStorage.setItem('icemachine.music.muted.v1', '0'); });
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).some(s => s.scene.key === 'Title'));
  await page.click('canvas'); await wait(200);
  check('New player: Quick Play locked, Story picked (SCREAM-175, 205)', await sc('Title', 's.modeTexts.map(t => t.text).join("|")'), 'Quick Play (Locked)|> Story <');
  check('...with a note saying why', await sc('Title', 's.children.getByName("lock-note").text'), "Play Story's first day to unlock Quick Play.");
  await page.screenshot({ path: outDir + '/title_locked.png' });
  await press('ArrowUp');
  check('...the arrows skip the locked modes', await sc('Title', 's.selected'), 1);
  await page.mouse.click(480, 345); await wait(300);
  check('...clicking Quick Play does nothing', await scenes(), 'Title');
  const uncle = () => page.evaluate(() => (b => b ? b.shown : '')(window.__game.scene.getScene('Hud').uncleBox));
  await press('ArrowDown', 2); await press('Enter'); await wait(500);
  // SCREAM-235 (PO, November 10): riding with the uncle skips the New Bike screen.
  check('First Story: no question, no New Bike screen', (await sc('Title', 's.confirming')) + ' ' + (await page.evaluate(() => window.__game.scene.isActive('StoryIntro'))), 'false false');
  check('...straight into Day 1 with the uncle, on the tutorial map', (await ev('!!e.tutorial')) + ' ' + (await ev('e.mapId')) + ' ' + (await page.evaluate(() => window.__game.registry.get('story').day)), 'true tutorial 1');
  await page.waitForFunction(() => window.__game.scene.isActive('TutorialCrawl')); await wait(1500);
  check('...the ice cream truck tune playing', await sc('TutorialCrawl', 's.sound.getAll("credits-tune").some(t => t.isPlaying)'), true);
  check('...over the tutorial map, zoomed out', await sc('TutorialCrawl', '(m => !!m && m.scale < 0.5)(s.children.getByName("crawl-map"))'), true);
  check('It opens with the credits: the blue line, no top bar', (await sc('TutorialCrawl', 's.children.getByName("crawl-still").alpha > 0.5')) + ' ' + (await page.evaluate(() => window.__game.scene.getScene('Hud').cameras.main.visible)), 'true false');
  await page.screenshot({ path: outDir + '/uncle_credits_still.png' });
  await wait(6000);
  check('...then the story scrolls away in yellow', await sc('TutorialCrawl', 's.lines.filter(t => t.visible).length > 2 && s.lines[0].scale < 1'), true);
  // SCREAM-236: the scroll sets up the bike instead.
  check('...ending with the $600 bike', /new bike in the shop window the other day for \$600\.00\. Better get to work/.test(await sc('TutorialCrawl', 's.lines.map(t => t.text).join(" ")')), true);
  await page.screenshot({ path: outDir + '/uncle_credits_scroll.png' });
  // SCREAM-186: M mutes the credits tune too, and M again brings it back.
  await page.keyboard.press('m'); await wait(150);
  check('SCREAM-186: M during the credits mutes the tune (and the music)', await sc('TutorialCrawl', 's.sound.getAll("credits-tune").every(t => t.mute) + " " + window.__game.registry.get("music").muted'), 'true true');
  await page.keyboard.press('m'); await wait(150);
  check('...M again: the tune is back', await sc('TutorialCrawl', 's.sound.getAll("credits-tune").some(t => !t.mute && t.isPlaying) + " " + window.__game.registry.get("music").muted'), 'true false');
  // SCREAM-217 (PO, November 9): X is the one skip key in the uncle's evening (PO changed it from S the same day); Enter and S no longer skip the credits.
  check('The credits say X skips them (SCREAM-217)', await sc('TutorialCrawl', "s.children.list.filter(o => o.type === 'Text').some(t => t.text === 'X: Skip')"), true);
  await press('Enter'); await wait(300);
  check('...Enter does not skip the credits', await page.evaluate(() => window.__game.scene.isActive('TutorialCrawl')), true);
  await page.keyboard.down('x'); await wait(900); await page.keyboard.up('x'); await wait(200);
  check('...a held X skips the credits but not the uncle too', (await page.evaluate(() => window.__game.scene.isActive('UncleIntro'))) + ' ' + (await ev('e.tutorial.skipped')), 'true false');
  await page.waitForFunction(() => window.__game.scene.isActive('UncleIntro')); await wait(500);
  await wait(1500);
  check('...the tune fades out once the uncle appears', await sc('UncleIntro', 's.sound.getAll("credits-tune").length'), 0);
  check('X skips the rest: the uncle in the truck, on step 1', (await scenes()) + ' ' + (await ev('e.tutorial.step')), 'UncleIntro,Hud stock');
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
  const giftBefore = await ev('e.moneyCents');
  check('With the uncle the cash starts empty (SCREAM-191)', giftBefore, 0);
  await page.mouse.click(600, 80); await wait(400);
  check('Click: Buy Stock, outlined, and the $25 he left (SCREAM-187)', (await uncle()) + ' | ' + (await pointer()) + ' ' + ((await ev('e.moneyCents')) - giftBefore), 'When you are ready, hit "Buy Stock". I left $25 on the truck for you to get started. | on 2500');
  await page.screenshot({ path: outDir + '/uncle_cooler_gift.png' });
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
  // SCREAM-231: his stop is timed in game time (a Phaser timer), which runs behind the wall clock on a
  // slow machine; so add up the game's own frame times from the moment he spots her.
  await ev(`(window.__held = 0, window.__heldFn = (t, d) => { window.__held += d; }, window.__game.scene.getScene('Drive').events.on('update', window.__heldFn), true)`);
  check('Home to his regular takes about 10 seconds (was about 2.6)', toRegular > 8.5 && toRegular < 13.5 ? 'ok' : toRegular.toFixed(1), 'ok');
  await wait(600);
  check('The instant she has her "!": he names her', (await uncle()) + ' | ' + (await ev("e.residents.all.find(p => p.resident.id === 'T008').customer")), "Oh hey, it's Chloe Hogan... They buy ice cream pretty much every night. | running");
  check('...and the truck stops', await drive('s.speed < 1'), true);
  await page.screenshot({ path: outDir + '/uncle_spotted.png' });
  const spottedAt = Date.now();
  await page.waitForFunction(() => window.__game.registry.get('evening').tutorial.lineNumber === 1, null, { timeout: 9000 });
  const heldWall = (Date.now() - spottedAt) / 1000 + 0.6;   // the creep below is measured on the wall clock
  const held = await ev(`(window.__game.scene.getScene('Drive').events.off('update', window.__heldFn), window.__held / 1000)`);
  check('...for about 4 seconds', held > 3.4 && held < 4.8 ? 'ok' : held.toFixed(1), 'ok');
  await wait(1200);
  check('Then his second line, and the truck creeps forward', (await uncle()) + ' | ' + (await drive('s.speed > 5 && s.speed < 40')), 'My best customers buy ice cream almost every night! Remembering where they live is the hard part. | true');
  check('...a long line: his box grows a second row, and it fits', await page.evaluate(() => (b => b.height > 58 && b.text.y + b.text.height <= b.height - 58 / 2 - 6)(window.__game.scene.getScene('Hud').uncleBox)), true);
  await page.screenshot({ path: outDir + '/uncle_creep.png' });
  await page.waitForFunction(() => { const s = window.__game.scene.getScene('Drive'); return !s.scene.isActive() || !s.uncleLeg; }, null, { timeout: 15000 });
  const creep = (Date.now() - spottedAt) / 1000 - heldWall;
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
  // SCREAM-145 (PO, November 9): the uncle's guided sale doesn't count as a visit to Chloe.
  check('The uncle\'s sale would not count as a visit (SCREAM-145)', await page.evaluate(async () => {
    const e = window.__game.registry.get('evening');
    const { Sale } = await import('/src/state/Sale.js');
    const s = new Sale([{ slot: 0, flavour: 'eclair', count: 1 }], 4, 0, false);
    s.phase = 'over'; s.outcome = { kind: 'paid', priceCents: 0, tipCents: 0, tipPercent: 0 }; s.line = 'Thanks!';
    e.countVisit(s);
    return e.tutorial.step + ' ' + JSON.stringify(e.visits) + ' ' + e.mapsJoined;
  }), 'sale {} false');
  await press('b'); await wait(900);
  check('Sale over (here, driven off): back on the road, he drives on to the pump', (await scenes()) + ' ' + (await ev('e.tutorial.step')) + ' ' + (await drive('s.uncleLeg')), 'Drive,Hud pump toPump');
  check('...saying (SCREAM-173)', await uncle(), "Keep an eye on the gas gauge. Run dry and the night's over.");
  check('...with the gauge outlined', await sc('Hud', 's.children.getByName("uncle-pointer").visible'), true);
  check('...the outline is round the gauge at the bottom left (SCREAM-238)', await sc('Hud', '(() => { const g = s.fuelGauge; return g.x < 200 && g.y > 400; })()'), true);
  const toPumpAt = Date.now();
  await page.screenshot({ path: outDir + '/uncle_gauge.png' });
  await page.waitForFunction(() => window.__game.scene.isActive('Pump'), null, { timeout: 25000 });
  const toPump = (Date.now() - toPumpAt) / 1000;
  await wait(500);
  check('He drives there fast (under 9 seconds)', toPump < 9 ? 'ok' : toPump.toFixed(1), 'ok');
  check('He stops in the pump bay: the pump opens at $0.00', (await scenes()) + ' ' + (await sc('Pump', 's.amount')), 'Pump,Hud 0');
  check('...he says he has twenty bucks on him; the outline goes', (await uncle()) + ' | ' + (await sc('Hud', 's.children.getByName("uncle-pointer").visible')), "I have twenty bucks on me, add that and I'll pay this time. | false");
  await press('ArrowUp', 6);
  check('...up to his $20, no more; the button says he pays', (await sc('Pump', 's.amount')) + ' ' + (await sc('Pump', 's.payButton.text')), '2000 UNCLE PAYS $20.00');
  await page.screenshot({ path: outDir + '/uncle_pump.png' });
  const cashBefore = await ev('e.moneyCents');
  const fuelBefore = await ev('e.fuel');
  await press('Enter'); await wait(800);
  check('...he pays: none of it on your gas bill, $20 of gas in', ((await ev('e.breakdown.gasCents')) === 0) + ' ' + (Math.abs((await ev('e.fuel')) - fuelBefore - 2 / 3) < 0.01), 'true true');
  // ---- SCREAM-185: the uncle drives home ----
  check('Gas bought: he drives home, saying to come home for stock', (await scenes()) + ' ' + (await ev('e.tutorial.step')) + ' ' + (await drive('s.uncleLeg')) + ' | ' + (await uncle()), "Drive,Hud home toHome | Return home to fill up on stock when you need.");
  check('...no more cash from him (the $25 was at the cooler)', (await ev('e.moneyCents')) - cashBefore, 0);
  check('...no steering, nobody else comes out', (await ev('e.tutorial.uncleDriving')) + ' ' + (await ev('e.residents.hearingOff')), 'true true');
  const homeAt = Date.now();
  await page.waitForFunction(() => window.__game.scene.isActive('UncleIntro'), null, { timeout: 25000 });
  const homeSecs = (Date.now() - homeAt) / 1000;
  check('...at the same speed as to the gas (under 15 seconds)', homeSecs < 15 ? 'ok' : homeSecs.toFixed(1), 'ok');
  await wait(800);
  check('Arrived home: the truck screen with the uncle returns', (await ev('e.tutorial.step')) + ' ' + (await sc('UncleIntro', 's.children.getByName("uncle").visible')), 'alone true');
  check('...not the restock cooler', await ev('e.isRestocking'), false);
  check('...near home', await ev('Math.hypot(e.truck.x - 1426.8, e.truck.y - 630.3) < 90'), true);
  check('...Big Kev, in the big box; the small one stays away (SCREAM-188)', (await sc('UncleIntro', 's.shown')) + ' | ' + (await uncle()), "You should go find Big Kev on Institute Rd. He's usually around this time of night and gets a big order. | ");
  await page.screenshot({ path: outDir + '/uncle_home.png' });
  await page.mouse.click(600, 300); await wait(300);
  check('Click: his last words', (await sc('UncleIntro', 's.shown')) + ' ' + (await scenes()), 'Good luck, kiddo. UncleIntro,Hud');
  await page.mouse.click(600, 300);
  await page.waitForFunction(() => window.__game.scene.isActive('Drive'), null, { timeout: 5000 }); await wait(600);
  check('Click: on the road alone; he is done', (await ev('e.tutorial.step')) + ' ' + (await ev('e.residents.hearingOff')) + ' ' + (await uncle()), 'done false ');
  // SCREAM-190: he steps out of the truck and walks home.
  check('...and he steps out of the truck, map-sized', await drive('(w => !!w && w.active && w.texture.key)(s.children.getByName("uncle-walker"))'), 'uncle-walker');
  const walkFrom = await drive('(w => w.x + "," + w.y)(s.children.getByName("uncle-walker"))');
  await wait(5000);
  await page.screenshot({ path: outDir + '/uncle_walk_home.png' });
  check('...walking toward home', (await drive('(w => w.x + "," + w.y)(s.children.getByName("uncle-walker"))')) !== walkFrom, true);
  await page.waitForFunction(() => !window.__game.scene.getScene('Drive').children.getByName('uncle-walker'), null, { timeout: 15000 });
  check('...and he goes in at the front door', await drive('s.uncleWalkPath.length'), 0);
  await page.keyboard.down('ArrowUp'); await wait(700); await page.keyboard.up('ArrowUp');
  check('...and the player drives', await drive('s.speed > 0'), true);
  await page.keyboard.press('Shift+Digit3'); await wait(600);
  check('Ending the evening marks the tutorial done', await page.evaluate(() => localStorage.getItem('icemachine.tutorial.done.v1')), '1');
  check("...and it's the end of Story's Day 1, saved for Day 2", (await scenes()) + ' ' + (await page.evaluate(() => JSON.parse(localStorage.getItem('icemachine.story.v2')).day)), 'DayEnd 2');
  await page.screenshot({ path: outDir + '/uncle_day_end.png' });
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).some(s => s.scene.key === 'Title'));
  await page.click('canvas'); await wait(200);
  check('Tutorial finished: every mode unlocked', await sc('Title', 's.options.some(o => o.locked) + " " + s.children.getByName("lock-note").text'), 'false ');
  check('...and Day 2 to continue', /^Quick Play,Continue Story: Tuesday, \$[0-9.]+,New Story$/.test(await sc('Title', 's.options.map(o => o.label).join()')), true);
  await press('ArrowDown', 2); await press('Enter'); await wait(300);
  check('The title screen credits the tune', await sc('Title', 's.children.list.some(o => o.text && o.text.includes("Tune: Travis Morgan"))'), true);
  await press('y'); await wait(300);
  check('New Story again: asks whether to bring the uncle', await sc('Title', 's.confirming && s.asking'), 'uncle');
  await page.screenshot({ path: outDir + '/uncle_choice.png' });
  await page.evaluate(() => localStorage.setItem('icemachine.music.muted.v1', '1'));
  await press('o'); await wait(500); await press('Enter'); await wait(500); // past the Story intro
  check('On My Own: Day 1 on the tutorial map, no uncle', (await ev('e.mapId')) + ' ' + (await ev('e.tutorial === null')) + ' ' + (await page.evaluate(() => window.__game.registry.get('story').day)), 'tutorial true 1');

  // ---- SCREAM-200: skipping the uncle ----
  // A brand-new player again; skip him on his very first line, in the truck.
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k !== 'icemachine.music.muted.v1') localStorage.removeItem(k); localStorage.setItem('icemachine.music.muted.v1', '1'); });
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).some(s => s.scene.key === 'Title'));
  await page.click('canvas'); await wait(200);
  await press('ArrowDown', 2); await press('Enter'); await wait(500); // With Uncle: no Story intro (SCREAM-235)
  await page.waitForFunction(() => window.__game.scene.isActive('TutorialCrawl')); await wait(800);
  await press('x'); // SCREAM-217: X skips the credits
  await page.waitForFunction(() => window.__game.scene.isActive('UncleIntro')); await wait(800);
  check('In the truck: the hint says X skips him', (await sc('UncleIntro', 's.hint.text')).includes('X: Skip The Uncle'), true);
  await press('s'); await wait(300);
  check('...S does not skip him', await ev('e.tutorial.skipped'), false);
  await press('x');
  await page.waitForFunction(() => window.__game.scene.isActive('Cooler'), null, { timeout: 5000 }); await wait(500);
  check('X in the truck: straight to the cooler, his part over', (await scenes()) + ' ' + (await ev('e.tutorial.step')) + ' ' + (await ev('e.tutorial.skipped')), 'Cooler,Hud done true');
  check('...he says goodbye in the small box', await uncle(), "Alright, you've got this. Good luck, kiddo.");
  check('...his $25 handed over anyway', await ev('e.moneyCents'), 2500);
  check('...and the tutorial counts as finished', await page.evaluate(() => localStorage.getItem('icemachine.tutorial.done.v1')), '1');
  check('...no outline left behind at the cooler', await sc('Cooler', '(g => !g || !g.visible)(s.children.getByName("uncle-pointer"))'), true);
  await page.screenshot({ path: outDir + '/uncle_skipped_cooler.png' });
  await press('+', 3); await press('Enter'); await wait(700);
  check('Buy Stock: the plain truck screen (no uncle walking to the cab)', await scenes(), 'Truck,Hud');

  // Skip him while he drives: the truck stops, the player has the wheel.
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k !== 'icemachine.music.muted.v1') localStorage.removeItem(k); });
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).some(s => s.scene.key === 'Title'));
  await page.click('canvas'); await wait(200);
  await press('ArrowDown', 2); await press('Enter'); await wait(500); // With Uncle: no Story intro (SCREAM-235)
  await page.waitForFunction(() => window.__game.scene.isActive('TutorialCrawl')); await wait(800);
  await press('s'); await wait(300);
  check('S does not skip the credits (X does)', await page.evaluate(() => window.__game.scene.isActive('TutorialCrawl')), true);
  await press('x'); // SCREAM-217: X skips the credits
  await page.waitForFunction(() => window.__game.scene.isActive('UncleIntro')); await wait(800);
  await page.mouse.click(700, 200); await wait(200); await page.mouse.click(700, 200); await wait(200);
  await page.mouse.click(150, 450); await wait(600);
  check('SCREAM-286: Back with him: no skip hint in his small box', await page.evaluate(() => (b => !!b && !b.container.list.some(o => o.list && o.list.some(t => t.text === 'X: Skip The Uncle')))(window.__game.scene.getScene('Hud').uncleBox)), true);
  await press('+'); await wait(300); await page.mouse.click(600, 80); await wait(200); await page.mouse.click(600, 80); await wait(400);
  await press('+', 3); await press('Enter'); await wait(700);
  await press('Enter'); await wait(900);
  await page.waitForFunction(() => window.__game.scene.isActive('Drive'), null, { timeout: 8000 }); await wait(1500);
  check('He is driving', (await drive('s.uncleLeg')) + ' ' + (await drive('s.speed > 0')), 'toRegular true');
  await press('x'); await wait(300);
  check('X on the road: he stops, parked, the player has the wheel', (await drive('s.uncleLeg')) + ' ' + (await drive('s.speed')) + ' ' + (await drive('s.parkBrake')) + ' ' + (await ev('e.tutorial.step')), 'null 0 true done');
  check('...everyone can hear the truck again', await ev('e.residents.hearingOff'), false);
  check('...his goodbye up', 'false ' + (await uncle()), "false Alright, you've got this. Good luck, kiddo.");
  await page.keyboard.down('ArrowUp'); await wait(700); await page.keyboard.up('ArrowUp');
  check('...and the player drives', await drive('s.speed > 0'), true);
  await page.screenshot({ path: outDir + '/uncle_skipped_road.png' });

  console.log(`tutorial: ${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' / ') : 'none'}`);
  await browser.close();
  process.exit(fail || errors.length ? 1 : 0);
})();
