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
  // These checks cover hard (car-style) driving; the title remembers the last difficulty picked
  await page.evaluate(() => localStorage.setItem('icemachine.difficulty', 'hard')); await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  const ev = (fn) => page.evaluate(`(() => { const e = window.__game.registry.get('evening'); return ${fn}; })()`);
  const scenes = () => page.evaluate(() => window.__game.scene.getScenes(true).map(s => s.scene.key).join(','));
  const sc = (key, fn) => page.evaluate(`(() => { const s = window.__game.scene.getScene('${key}'); return ${fn}; })()`);
  const wait = ms => page.waitForTimeout(ms);
  const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(40); } await wait(100); };
  const tick = async (ms) => { await ev(`e.tick(${ms})`); await wait(150); };
  const stock = () => ev('e.slots.map(s => s.quantity).join(",")');
  const cash = () => ev('e.moneyCents');
  // Replace the random order with a known one, so each case is predictable.
  const setOrder = (lines) => ev(`(() => { const s = e.sale; s.order.splice(0, s.order.length, ...${JSON.stringify(lines)}); s.line = ${JSON.stringify('ORDER')}; return true; })()`);
  const serveNow = async () => { await page.keyboard.down('Shift'); await page.keyboard.press('Digit4'); await page.keyboard.up('Shift'); await wait(300); };
  let pass = 0, fail = 0;
  const check = (name, got, want) => { const ok = String(got) === String(want); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(66) + ' got=' + got + (ok ? '' : ' want=' + want)); };

  // ---- Pure rules (Sale.ts) ----
  const rules = await page.evaluate(async () => {
    const m = await import('/src/state/Sale.js');
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 20000; i++) counts[m.pickOrderSize(Math.random()) - 1]++;
    const tips = [0, 9.9, 10, 19.9, 20, 29.9, 30, 39.9, 40, 55].map(m.tipPercentAt);
    const slots = [
      { flavour: 'eclair', quantity: 2, priceCents: 200 },
      { flavour: 'spongepop', quantity: 1, priceCents: 250 },
      { flavour: 'cookie', quantity: 10, priceCents: 450 },
    ];
    let maxed = true, noCookie = true;
    for (let i = 0; i < 500; i++) {
      const o = m.generateOrder(slots);
      const by = Object.fromEntries(o.map(l => [l.slot, l.count]));
      if ((by[0] ?? 0) > 2 || (by[1] ?? 0) > 1) maxed = false;
      if (by[2]) noCookie = false;
    }
    const tooDear = m.generateOrder([{ flavour: 'cookie', quantity: 5, priceCents: 425 }]).length;
    const desc = m.describeOrder([{ slot: 0, flavour: 'eclair', count: 2 }, { slot: 1, flavour: 'spongepop', count: 1 }]);
    return { pct: counts.map(c => Math.round(c / 200)), tips, maxed, noCookie, tooDear, desc };
  });
  check('Order sizes 1-6 follow the weights (~15/30/30/12/8/5 %)', rules.pct.every((p, i) => Math.abs(p - [15, 30, 30, 12, 8, 5][i]) <= 2), true);
  check('Tip steps: 20,20,15,15,10,10,5,5,0,0', rules.tips.join(','), '20,20,15,15,10,10,5,5,0,0');
  check('Orders never ask for more than is in the cooler', rules.maxed, true);
  check('Orders leave out flavours priced over $4.00', rules.noCookie, true);
  check('Every flavour over $4.00: no order (too expensive)', rules.tooDear, 0);
  check('Order text: "2 Chocolate Eclair, 1 SpongePop"', rules.desc, '2 Chocolate Eclair, 1 SpongePop');

  // ---- Prep: 10 eclairs, 5 SpongePops, 5 Explorer Pops at default prices ($2.00, $2.50, $2.50) ----
  await page.click('canvas'); await press('Enter'); await wait(200);
  // SCREAM-129: the clipboard's rows are picked with Down; + adds one ice cream.
  await press('+', 10); await press('ArrowDown'); await press('+', 5); await press('ArrowDown'); await press('+', 5);
  await press('Enter'); await wait(200);
  check('Prep: stock 10,5,5 (and no cookies) and cash $25.00', (await stock()) + ' ' + (await cash()), '10,5,5,0 2500');
  await press('ArrowRight'); await press('Enter'); await wait(400);

  // ---- Sale 1: perfect and fast ----
  // SCREAM-137: orders in words for these checks (the picture orders have their own below).
  await ev('(e.orderPictureChance = 0, true)');
  await ev("e.residents.callNow(e.residents.all.find(p => p.customer === 'none'))"); await wait(200);
  await sc('Drive', '(s.truck.setPosition(s.pickupZone.x, s.pickupZone.y), s.speed = 0, s.parkBrake = true)'); await wait(400);
  check('Pulling up to a customer opens the sales screen (no hub)', await scenes(), 'Sales,Hud');
  check('The customer gives an order', await ev('e.sale.phase') + ' ' + (await ev('e.sale.order.length > 0')), 'ordering true');
  check('Bubble shows the order', await sc('Sales', 's.bubbleText.text') === await ev('e.sale.line'), true);
  check('Tip cup on the counter, full, no % while the order is showing (SCREAM-134)', (await sc('Sales', 's.tipBar.container.visible')) + ' ' + (await sc('Sales', 'JSON.stringify(s.tipBar.label.text)')), 'true ""');
  await page.screenshot({ path: outDir + '/sale_order.png' });
  await setOrder([{ slot: 0, flavour: 'eclair', count: 2 }, { slot: 1, flavour: 'spongepop', count: 1 }]);
  await tick(5100);
  check('After 5 s the order is hidden', (await ev('e.sale.phase')) + ' ' + (await sc('Sales', 's.bubbleText.text')), 'deciding …');
  check('Tip countdown starts: 20%', (await sc('Sales', 's.tipBar.container.visible')) + ' ' + (await sc('Sales', 's.tipBar.label.text')), 'true 20%');
  check('SCREAM-284: ...on a full green bar as tall as the jar', await sc('Sales', '(f => (f.displayHeight > 62 && f.displayHeight <= 70) + " " + (f.fillColor === 0x2e7d32))(s.tipBar.fill)'), 'true true');
  await press('Enter'); await wait(300);
  check('Enter goes to the cooler (fill mode)', await scenes(), 'Fill,Hud');
  check('Tip bar still showing at the cooler', await sc('Fill', 's.tipBar.container.visible'), true);
  // SCREAM-131: open a crate and click an ice cream (the test hook opens the right crate at once).
  await sc('Fill', 's.takeFlavour("eclair")'); await wait(100); await sc('Fill', 's.takeFlavour("eclair")'); await wait(100); await sc('Fill', 's.takeFlavour("spongepop")'); await wait(100);
  check('Picking takes ice creams out of the cooler', (await stock()) + ' bag ' + (await ev('e.sale.bag.join(",")')), '8,4,5,0 bag 2,1,0,0');
  await press('-'); await sc('Fill', 's.takeFlavour("spongepop")'); await wait(100);
  check('Putting one back and taking it again', await ev('e.sale.bag.join(",")'), '2,1,0,0');
  // ---- SCREAM-131: a shut cooler, one crate open at a time ----
  const fill = (fn) => sc('Fill', fn);
  check('One crate open (the one used); its ice creams show, the others are hidden', (await fill('s.openCrate')) + ' ' + (await fill('s.cellIcons.slice(16).some(i => i.visible)')), '0 false');
  await page.keyboard.press('2'); await wait(60);
  check('Press 2: crate 1 hidden at once, crate 2 still opening', (await fill('s.openCrate')) + ' ' + (await fill('s.cellIcons.slice(0, 16).some(i => i.visible)')), 'null false');
  check('...crate 1\'s lid is sliding shut (SCREAM-138)', await fill('s.lids[0].visible && s.lids[0].scaleY > 0 && s.lids[0].scaleY < 1'), true);
  await wait(250);
  check('...crate 2 is open after about 0.2 s (SCREAM-138)', await fill('s.openCrate'), 1);
  await wait(400);
  check('...and crate 1\'s lid is fully shut after about half a second', await fill('s.lids[0].scaleY'), 1);
  // The PO: click on the cooler to open it. A real mouse click on lid 3.
  await page.mouse.click(719 + 80, 96 + 80); await wait(400);
  check('Clicking lid 3 with the mouse opens crate 3', await fill('s.openCrate'), 2);
  await page.mouse.click(519 + 80, 96 + 80); await wait(400);
  check('...and clicking lid 2 opens crate 2 again', await fill('s.openCrate'), 1);
  const back = await ev('e.bagContents[0].cell');
  const bagSpot = await fill('[s.bagIcons[0].x, s.bagIcons[0].y]');
  await page.mouse.click(bagSpot[0], bagSpot[1]); await wait(150);
  check('Click an ice cream in the bag: it goes back to its own square', (await ev('e.cells[' + back + ']')) + ' ' + (await ev('e.sale.bag.join(",")')), 'eclair 1,1,0,0');
  await fill('s.takeFlavour("eclair")'); await wait(100);
  await page.screenshot({ path: outDir + '/sale_fill.png' });
  await press('Enter'); await wait(300);
  check('Serve: back at the window, "How much?"', (await scenes()) + ' ' + (await ev('e.sale.line')), 'Sales,Hud How much?');
  check('Calculator and your prices shown, display at 0 (SCREAM-12)', [await sc('Sales', 's.calculator.container.visible'), await sc('Sales', 's.priceCard.visible'), await sc('Sales', 's.calculator.display.text')].join(' '), 'true true 0');
  check('...$ on the left of the display, digits right-aligned', await sc('Sales', '(() => { const d = s.calculator.container.list.find(o => o.text === "$"); return [d.originX, s.calculator.display.originX, d.x < s.calculator.display.x].join(); })()'), '0,1,true');
  check('...12 number keys plus C, back and CHARGE', await sc('Sales', '[...s.calculator.keys.keys()].join(" ")'), '7 8 9 C 4 5 6 BACK 1 2 3 CHARGE 0 00 .');
  check('...in the middle of the window: clear of YOUR PRICES, the customer and the hints', await sc('Sales', '(() => { const b = s.calculator.container.getBounds(); const p = s.priceCard.getBounds(); return [p.right < b.left, b.right < 675, b.top > 275, b.bottom < s.hint.getBounds().top].join(); })()'), 'true,true,true,true');
  const box = () => sc('Sales', 's.calculator.display.text');
  const typed = [];
  for (const k of ['7', '.', '2', '5']) { await page.keyboard.type(k); await wait(80); typed.push(await box()); }
  check('Calculator typing, left to right: 7 . 2 5 -> 7, 7., 7.2, 7.25', typed.join(' '), '7 7. 7.2 7.25');
  await press('Backspace');
  check('Backspace takes the last key off', await box(), '7.2');
  await press('Delete');
  check('Delete clears the display', await box(), '0');
  await page.keyboard.type('06.509'); await wait(150);
  check('Leading 0 replaced, at most 2 decimals: 0 6 . 5 0 9 -> 6.50', await box(), '6.50');
  await page.screenshot({ path: outDir + '/sale_price.png' });
  const c1 = await cash();
  await press('Enter'); await wait(300);
  check('Right items, right price: paid $6.50 + 20% tip ($1.30)', (await cash()) - c1, 780);
  check('...outcome paid, customer says thanks', (await ev('e.sale.outcome.kind')) + ' ' + (await ev('e.sale.line')), 'paid Thanks!');
  check('Paid: a BACK ON THE ROAD button (ICE-15)', (await sc('Sales', 's.roadButton.visible')) + ' ' + (await sc('Sales', 's.roadButton.text')), 'true BACK ON THE ROAD');
  check('...centred below the counter, where GO TO THE COOLER sits (ICE-14)', await sc('Sales', '[s.roadButton.x, s.roadButton.y, s.coolerButton.x, s.coolerButton.y].join()'), '480,478,480,478');
  check('...its top is below the counter, its bottom above the hint line', await sc('Sales', '[s.roadButton.getBounds().top > 436, s.roadButton.getBounds().bottom < s.hint.getBounds().top].join()'), 'true,true');
  check('...GO TO THE COOLER is hidden now', await sc('Sales', 's.coolerButton.visible'), false);
  await wait(400); await page.screenshot({ path: outDir + '/sale_paid.png' });
  await press('Enter'); await wait(400);
  check('Enter: straight back on the road, the customer has gone', (await scenes()) + ' ' + (await ev('e.customer === null')), 'Drive,Hud true');
  check('Sold ice creams are gone from stock', await stock(), '8,4,5,0');

  // ---- Sale 2: wrong items once -> corrected order, retry, undercharge accepted with no tip ----
  await serveNow();
  check('Shift+4 (debug) starts a sale right away', await scenes(), 'Sales,Hud');
  await setOrder([{ slot: 2, flavour: 'explorer', count: 1 }]);
  await tick(5100); await tick(12000);
  check('12 s into the countdown: 15%', await sc('Sales', 's.tipBar.label.text'), '15%');
  check('SCREAM-284: at the window the bar has shrunk to about 70% of the jar\'s height and turned lighter green', await sc('Sales', '(f => (f.displayHeight > 44 && f.displayHeight < 52) + " " + (f.fillColor === 0x7cb342))(s.tipBar.fill)'), 'true true');
  await page.screenshot({ path: outDir + '/sale_tip_bar.png' });
  await press('c'); await wait(300); await sc('Fill', 's.takeFlavour("eclair")'); await wait(100); await press('Enter'); await wait(300);
  await page.keyboard.type('2'); await press('Enter');
  check('Wrong items, first time: the customer says the right order', (await ev('e.sale.line')).includes('I wanted 1 Lil Explorer Pop'), true);
  check('...items go back in the cooler, order shown again', (await stock()) + ' ' + (await ev('e.sale.phase')), '8,4,5,0 ordering');
  check('...and the tip is gone', await sc('Sales', 's.tipBar.label.text'), 'No tip');
  await tick(5100);
  await press('c'); await wait(300); await sc('Fill', 's.takeFlavour("explorer")'); await wait(100); await press('Enter'); await wait(300);
  const c2 = await cash();
  await page.keyboard.type('2'); await press('Enter');
  check('Right items, undercharged ($2.00 < $2.50): accepted, no tip', ((await cash()) - c2) + ' ' + (await ev('e.sale.outcome.kind')), '200 paid');
  await press('Enter'); await wait(300);

  // ---- Go to the cooler while the order is still showing (PO, PR #38) ----
  await serveNow();
  check('Order showing, with a GO TO THE COOLER button', (await ev('e.sale.phase')) + ' ' + (await sc('Sales', 's.coolerButton.visible')), 'ordering true');
  check('...and no BACK ON THE ROAD button before the sale is over', await sc('Sales', 's.roadButton.visible'), false);
  await page.screenshot({ path: outDir + '/sale_cooler_button.png' });
  await press('c'); await wait(300);
  check('C during the order: straight to the cooler, order hidden', (await scenes()) + ' ' + (await ev('e.sale.phase')), 'Fill,Hud deciding');
  check('...tip countdown starts then (20%)', await sc('Fill', 's.tipBar.label.text'), '20%');
  // ---- SCREAM-281 (PO, November 12): a tall green bar above the cup that shrinks with the tip ----
  check('SCREAM-281: at the cooler the cup has a tall bar marked 20%, 15%, 10%, 5%; the window has the same bar at the jar\'s height, without side labels (SCREAM-284)', (await sc('Fill', 's.tipBar.fullHeight + " " + s.tipBar.zoneLabels.map(l => l.text).join()')) + ' / ' + (await sc('Sales', 's.tipBar.fullHeight + " " + s.tipBar.zoneLabels.length')), '190 20%,15%,10%,5% / 70 0');
  check('...nearly full and green at the start', await sc('Fill', '(f => f.displayHeight > 170 && f.fillColor === 0x2e7d32)(s.tipBar.fill)'), true);
  check('...it stays left of the counter and under the clock strip', await sc('Fill', '(b => b.right < 245 && b.top > 45)(s.tipBar.container.getBounds())'), true);
  await tick(12000);
  check('...12 s on: about 70% of its height, a lighter green, and 15%', await sc('Fill', '(f => (f.displayHeight > 120 && f.displayHeight < 140) + " " + (f.fillColor === 0x7cb342))(s.tipBar.fill) + " " + s.tipBar.label.text'), 'true true 15%');
  await page.screenshot({ path: outDir + '/fill_tip_bar.png' });
  check('SCREAM-273, SCREAM-282: FORGOT ORDER on the left under the tip jar, SERVE in the middle', await sc('Fill', 's.windowButton.visible + " " + s.windowButton.text + " " + s.windowButton.x + " " + s.serveButton.x + " " + (s.windowButton.getBounds().right < s.serveButton.getBounds().left)'), 'true FORGOT ORDER 124 600 true');
  check('...under the tip jar, not over it or the counter with the bag', await sc('Fill', '(b => b.top > 386 && b.left >= 0 && b.right < 245)(s.windowButton.getBounds())'), true);
  check('...and SERVE is clear of a full row of 10 in the bag', await sc('Fill', '(b => b.top > 410 + 24)(s.serveButton.getBounds())'), true);
  await page.screenshot({ path: outDir + '/fill_window_button.png' });
  await page.mouse.click(124, 470); await wait(300);
  check('SCREAM-282: clicking it goes to the window with the customer saying the order again, and the tip is gone', (await scenes()) + ' ' + (await ev('e.sale.phase')) + ' ' + (await ev('e.sale.askedAgain')) + ' ' + (await ev('e.sale.tipPercent(e.nowMs)')), 'Sales,Hud ordering true 0');
  check('SCREAM-287: no tip, so the countdown bar is gone at the window: just the cup and "No tip" right above it', await sc('Sales', '(t => t.fill.visible + " " + t.barParts.some(p => p.visible) + " " + t.label.text + " " + (t.label.y > -100))(s.tipBar)'), 'false false No tip true');
  await page.screenshot({ path: outDir + '/sale_no_tip.png' });
  await tick(5100); await press('c'); await wait(300);
  check('SCREAM-287: ...and gone at the cooler too, side labels and all', await sc('Fill', '(t => t.fill.visible + " " + t.barParts.some(p => p.visible) + " " + t.label.text + " " + (t.label.y > -100))(s.tipBar)'), 'false false No tip true');
  await page.screenshot({ path: outDir + '/fill_no_tip.png' });
  check('...the Fill screen\'s keys say B: Forgot Order', /B: Forgot Order/.test(await page.evaluate(() => window.__game.scene.getScene('Fill').children.list.filter(o => o.type === 'Text').map(o => o.text).join(' | '))), true);
  await press('b'); await wait(300);
  check('...B does the same, a second time too', (await scenes()) + ' ' + (await ev('e.sale.phase')), 'Sales,Hud ordering');
  check('SCREAM-288: that was the second and last time for this customer', (await ev('e.sale.asksLeft')) + ' ' + (await ev('e.sale.askAgain(e.nowMs)')), '0 false');
  await press('b'); await wait(300);

  // ---- Sale 3: overcharge twice -> they leave with it for free ----
  await serveNow(); await setOrder([{ slot: 0, flavour: 'eclair', count: 1 }]); await tick(5100);
  await press('c'); await wait(300); await sc('Fill', 's.takeFlavour("eclair")'); await wait(100); await press('Enter'); await wait(300);
  const c3 = await cash();
  await page.keyboard.type('999'); await press('Enter');
  // SCREAM-120 (PO): the first overcharge gets a second chance, but no tip.
  check('First overcharge: the customer says so and you can try again (SCREAM-120)', (await ev('e.sale.line')) + ' | ' + (await ev('e.sale.phase')), "That's more than it's supposed to be. Try again? | pricing");
  check('...the tip is gone', (await ev('e.sale.tipPercent(e.nowMs)')) + ' ' + (await sc('Sales', 's.tipBar.label.text')), '0 No tip');
  check('...and the price display is cleared', await sc('Sales', 's.typed'), '');
  await page.keyboard.type('999'); await press('Enter');
  check('Overcharge again: "That\'s more than it\'s supposed to be."', await ev('e.sale.line'), "That's more than it's supposed to be.");
  check('...the button says BACK ON THE ROAD; the hint still says sorry', (await sc('Sales', 's.roadButton.visible')) + ' ' + (await sc('Sales', 's.hint.text')), "true Enter: Say Sorry, It's On The House");
  await page.screenshot({ path: outDir + '/sale_overcharge.png' });
  const rb = await sc('Sales', '[s.roadButton.x, s.roadButton.y]'); const bb = await (await page.$('canvas')).boundingBox();
  await page.mouse.click(bb.x + rb[0], bb.y + rb[1]); await wait(300);
  check('Clicking BACK ON THE ROAD leaves the window', await scenes(), 'Drive,Hud');
  check('...no money, and the ice cream is gone', ((await cash()) - c3) + ' ' + (await stock()), '0 7,4,4,0');

  // ---- Sale 3b (SCREAM-120): overcharge, then fix the price: paid, no tip ----
  await serveNow(); await setOrder([{ slot: 0, flavour: 'eclair', count: 1 }]); await tick(5100);
  await press('c'); await wait(300); await sc('Fill', 's.takeFlavour("eclair")'); await wait(100); await press('Enter'); await wait(300);
  const c3b = await cash();
  await page.keyboard.type('999'); await press('Enter');
  await page.keyboard.type('1'); await press('Enter');
  check('Overcharge, then a fair price: paid, with no tip (SCREAM-120)', (await ev('e.sale.outcome.kind')) + ' ' + (await ev('e.sale.outcome.tipCents')) + ' ' + ((await cash()) - c3b), 'paid 0 100');
  await press('Enter'); await wait(300);
  
  // ---- SCREAM-283 (PO, November 12): RETURN TO COOLER at "How much?" ----
  await serveNow(); await setOrder([{ slot: 0, flavour: 'eclair', count: 1 }]); await tick(5100);
  const stock283 = await stock();
  await press('c'); await wait(300); await sc('Fill', 's.takeFlavour("spongepop")'); await wait(100); await press('Enter'); await wait(300);
  check('SCREAM-283: at "How much?" a RETURN TO COOLER button in the bottom left, under the counter', (await ev('e.sale.phase')) + ' ' + (await sc('Sales', '(b => s.returnButton.visible + " " + s.returnButton.text + " " + (b.left >= 0 && b.right < 240 && b.top > 455 && b.bottom < 505))(s.returnButton.getBounds())')), 'pricing true RETURN TO COOLER true');
  check('...and the keys along the bottom fit on the screen and name C', await sc('Sales', '(b => b.left > 0 && b.right < 960)(s.hint.getBounds()) + " " + /C: Return To Cooler/.test(s.hint.text)'), 'true true');
  await page.screenshot({ path: outDir + '/sale_return_to_cooler.png' });
  await page.keyboard.type('9');
  await page.mouse.click(118, 478); await wait(300);
  check('...clicking it: back at the cooler, the sale still on, the bag as it was', (await scenes()) + ' ' + (await ev('e.sale.phase')) + ' ' + (await ev('e.bagContents.map(b => b.flavour).join()')), 'Fill,Hud deciding spongepop');
  await ev('(e.putBack(0), true)'); await sc('Fill', 's.takeFlavour("eclair")'); await wait(100); await press('Enter'); await wait(300);
  check('...swap it and SERVE: "How much?" again, the typed price cleared', (await ev('e.sale.phase')) + ' ' + (await ev('e.sale.bagMatchesOrder')) + ' ' + JSON.stringify(await sc('Sales', 's.typed')), 'pricing true ""');
  await press('c'); await wait(300);
  check('...C does the same as the button', (await scenes()) + ' ' + (await ev('e.sale.phase')), 'Fill,Hud deciding');
  await press('Enter'); await wait(300);
  check('...not shown before "How much?" or once the sale is over', await (async () => { const a = await sc('Sales', 's.returnButton.visible'); await press('b'); await wait(300); return a + ' ' + (await sc('Sales', 's.returnButton.visible')); })(), 'true false');
  await press('Enter'); await wait(300);
  check('...driving off puts the bag back in the cooler', await stock(), stock283);

  // ---- SCREAM-285 (PO, November 12): ASK AGAIN at the window, after the cooler too ----
  await serveNow(); await setOrder([{ slot: 0, flavour: 'eclair', count: 1 }]);
  const stock285 = await stock();
  check('SCREAM-285: no ASK AGAIN while the order is showing', await sc('Sales', 's.askButton.visible'), false);
  await tick(5100);
  check('...order hidden: ASK AGAIN (NO TIP) at the right end of the strip under the counter', await sc('Sales', '(b => s.askButton.visible + " " + s.askButton.text + " " + (b.left > 720 && b.right <= 955 && b.top > 455 && b.bottom < 505))(s.askButton.getBounds())'), 'true ASK AGAIN (NO TIP) true');
  await press('c'); await wait(300); await sc('Fill', 's.takeFlavour("eclair")'); await wait(100); await press('Enter'); await wait(300);
  check('...after the cooler, at "How much?": still there, clear of the keys along the bottom, which fit', (await ev('e.sale.phase')) + ' ' + (await sc('Sales', 's.askButton.visible + " " + (s.askButton.getBounds().bottom < s.hint.getBounds().top) + " " + (h => h.left > 0 && h.right < 960)(s.hint.getBounds())')), 'pricing true true true');
  await page.screenshot({ path: outDir + '/sale_ask_again.png' });
  await page.keyboard.type('4');
  await page.mouse.click(836, 478); await wait(300);
  check('...clicking it: the customer says the order again, the calculator is away, the tip is gone', (await ev('e.sale.phase')) + ' ' + (await ev('e.sale.orderVisible')) + ' ' + (await sc('Sales', 's.calculator.container.visible')) + ' ' + (await ev('e.sale.tipPercent(e.nowMs)')), 'ordering true false 0');
  await tick(5100);
  check('...then "How much?" again, the bag still served, the typed price cleared, the button now plain ASK AGAIN', (await ev('e.sale.phase')) + ' ' + (await ev('e.sale.line')) + ' ' + (await ev('e.sale.bagCount')) + ' ' + JSON.stringify(await sc('Sales', 's.typed')) + ' ' + (await sc('Sales', 's.askButton.text')), 'pricing How much? 1 "" ASK AGAIN');
  await press('r'); await wait(200);
  check('...R does the same; and going to the cooler while they repeat it works', await (async () => { const p = await ev('e.sale.phase'); await press('c'); await wait(300); return p + ' ' + (await scenes()) + ' ' + (await ev('e.sale.phase')); })(), 'ordering Fill,Hud deciding');
  check('SCREAM-288: asked twice, so FORGOT ORDER is gone at the cooler, B is off the keys line and does nothing', await (async () => { const v = await sc('Fill', 's.windowButton.visible + " " + /Forgot Order/.test(s.keysLine.text)'); await press('b'); await wait(300); return v + ' ' + (await scenes()) + ' ' + (await ev('e.sale.timesAsked')); })(), 'false false Fill,Hud 2');
  await press('Enter'); await wait(300);
  check('...SERVE again: "How much?"', (await scenes()) + ' ' + (await ev('e.sale.phase')), 'Sales,Hud pricing');
  check('SCREAM-288: ...and ASK AGAIN is gone at the window; R does nothing and is off the keys line', await (async () => { const v = await sc('Sales', 's.askButton.visible + " " + /Ask Again/.test(s.hint.text)'); await press('r'); await wait(200); return v + ' ' + (await ev('e.sale.phase')) + ' ' + (await ev('e.sale.timesAsked')); })(), 'false false pricing 2');
  await page.screenshot({ path: outDir + '/sale_asked_twice.png' });
  await press('b'); await wait(300); await press('Enter'); await wait(300);
  check('...(driving off puts the bag back)', await stock(), stock285);

  // ---- Sale 4: ask again (R), then wrong -> no retry, given away ----
  await serveNow(); await setOrder([{ slot: 1, flavour: 'spongepop', count: 2 }]); await tick(5100);
  await press('r');
  check('R: the order is shown again', (await ev('e.sale.phase')) + ' ' + (await ev('e.sale.askedAgain')), 'ordering true');
  await tick(5100);
  check('SCREAM-282: R can be asked again (nothing more to lose)', (await ev('e.sale.askAgain(e.nowMs)')) + ' ' + (await ev('e.sale.phase')), 'true ordering');
  await tick(5100);
  await press('c'); await wait(300); await sc('Fill', 's.takeFlavour("spongepop")'); await wait(100); await press('Enter'); await wait(300);
  await page.keyboard.type('5'); await press('Enter');
  check('After R, a wrong order fails: "That\'s not what I asked for."', (await ev('e.sale.outcome.kind')) + ' ' + (await ev('e.sale.line')), "wrong-order That's not what I asked for.");
  await press('Enter'); await wait(300);
  check('...the wrong item is given away', await stock(), '6,3,4,0');

  // ---- Sale 5: the minute runs out while at the cooler ----
  await serveNow(); await setOrder([{ slot: 0, flavour: 'eclair', count: 3 }]); await tick(5100);
  await press('c'); await wait(300); await sc('Fill', 's.takeFlavour("eclair")'); await wait(100);
  await tick(50000);
  check('Tip bar runs out: "Took too long", customer still waiting', (await ev('e.sale.phase')) + ' ' + (await sc('Fill', 's.tipBar.label.text.replace("\\n", " ")')), 'deciding Took too long');
  check('5 s left: pulsing "!" in the top bar', await sc('Hud', 's.patienceWarning.visible'), true);
  await page.screenshot({ path: outDir + '/sale_warning.png' });
  await tick(5500);
  check('Time\'s up: back at the window, "Sorry, I have to go."', (await scenes()) + ' ' + (await ev('e.sale.line')), 'Sales,Hud Sorry, I have to go.');
  check('...warning gone', await sc('Hud', 's.patienceWarning.visible'), false);
  await press('Enter'); await wait(300);
  check('...the picked ice cream goes back in the cooler', await stock(), '6,3,4,0');

  // ---- Sale 6: drive off ----
  await serveNow(); await tick(5100); const c6 = await cash();
  await press('b'); await wait(300);
  check('B: drive off, a lost sale, back on the road', (await scenes()) + ' ' + ((await cash()) - c6), 'Drive,Hud 0');

  // ---- SCREAM-241: someone else is waiting at the truck: NEXT CUSTOMER, and B to drive off ----
  await serveNow(); await ev('(e.driveOffFromSale(), true)'); await wait(200);
  check('SCREAM-241: nobody else waiting: the button says BACK ON THE ROAD', (await sc('Sales', 's.roadButton.visible')) + ' ' + (await sc('Sales', 's.roadButton.text')), 'true BACK ON THE ROAD');
  const callNext = (n) => ev(`(() => { const p = e.residents.all.filter(q => q.customer === 'none' && q !== e.customer)[${n}]; e.residents.callNow(p); window.__next = p; e.nextAtTruck = () => (window.__next.customer === 'waiting' ? window.__next : undefined); return p.resident.name; })()`);
  const firstNext = await callNext(0); await wait(200);
  check('...someone walks up while the finished sale is on screen: it changes to NEXT CUSTOMER', await sc('Sales', 's.roadButton.text'), 'NEXT CUSTOMER');
  check('...and the hint offers both keys', await sc('Sales', 's.hint.text'), 'Enter: Next Customer    B: Drive Off');
  await press('Enter'); await wait(400);
  check('Enter: the next customer is at the window, without going back to the road', (await scenes()) + ' ' + (await ev('e.sale.phase')) + ' ' + (await ev('e.customer.resident.name')), 'Sales,Hud ordering ' + firstNext);
  check('...they are the one being served now', await ev('window.__next.customer'), 'window');
  await ev('(e.driveOffFromSale(), true)'); await wait(200);
  check('...and with nobody behind them the button is BACK ON THE ROAD again', await sc('Sales', 's.roadButton.text') + ' | ' + await sc('Sales', 's.hint.text'), 'BACK ON THE ROAD | Enter: Back On The Road');
  await callNext(1); await wait(200);
  check('Someone waiting again: NEXT CUSTOMER', await sc('Sales', 's.roadButton.text'), 'NEXT CUSTOMER');
  await press('b'); await wait(400);
  check('B: drive off instead, back on the road; they are left waiting', (await scenes()) + ' ' + (await ev('window.__next.customer')) + ' ' + (await ev('e.windowShutUntilMoved')), 'Drive,Hud waiting true');
  // The road's side: two people standing at the parked truck.
  const pair = await ev(`(() => { const s = window.__game.scene.getScene('Drive'); s.speed = 0; const two = e.residents.all.filter(q => q.customer === 'none').slice(0, 2);
    two.forEach((p, i) => { e.residents.callNow(p); p.pickup = [s.truck.x + i, s.truck.y, s.heading]; }); window.__two = two; return two.map(p => p.resident.name).join('|'); })()`);
  await wait(500);
  check('...parked beside them, nobody is served until the truck has moved', await scenes(), 'Drive,Hud');
  await ev('(e.windowShutUntilMoved = false, true)'); await wait(500);
  check('Once it has moved (flag cleared), the first of them is served', (await scenes()) + ' ' + (await ev('e.customer.resident.name')), 'Sales,Hud ' + pair.split('|')[0]);
  check('...and the road has told the window who is next at the truck', await ev('e.nextAtTruck().resident.name'), pair.split('|')[1]);
  await ev('(e.driveOffFromSale(), true)'); await wait(200);
  check('...so the button says NEXT CUSTOMER', await sc('Sales', 's.roadButton.text'), 'NEXT CUSTOMER');
  await page.screenshot({ path: outDir + '/sales_next_customer.png' });
  await page.mouse.click(480, 478); await wait(400);
  check('Clicking it brings the second one to the window', (await scenes()) + ' ' + (await ev('e.customer.resident.name')), 'Sales,Hud ' + pair.split('|')[1]);
  await ev('(e.driveOffFromSale(), true)'); await wait(200);
  await ev('(window.__next.customer = "done", e.nextAtTruck = null, true)');
  await press('Enter'); await wait(400);
  check('...then Enter goes back on the road', await scenes(), 'Drive,Hud');

  // ---- Too expensive ----
  await ev('(e.coolerSlots.forEach(s => s.priceCents = 450), true)');
  await serveNow();
  check('Every flavour over $4.00: "Too expensive!"', (await ev('e.sale.outcome.kind')) + ' ' + (await sc('Sales', 's.bubbleText.text')), 'too-expensive Too expensive!');
  await press('Enter'); await wait(300);
  await ev('(e.coolerSlots.forEach((s, i) => s.priceCents = [200, 250, 250, 300][i]), true)');

  // ---- SCREAM-218: sold out (even at prices over $4.00) is its own line, said by the player ----
  await ev('(e.coolerSlots.forEach(s => s.priceCents = 450), window.__keep = e.coolerSlots.map(s => s.quantity), e.coolerSlots.forEach(s => s.quantity = 0), true)');
  await serveNow();
  check('Sold out: the player says "Sorry, I\'m sold out." (not "Too expensive!")', (await ev('e.sale.outcome.kind')) + ' ' + (await sc('Sales', 's.bubbleText.text')), "sold-out Sorry, I'm sold out.");
  check('...the bubble is named "You", in blue, its tail pointing down', (await ev('e.sale.speaker')) + ' ' + (await sc('Sales', 's.speakerText.text')) + ' ' + (await sc('Sales', 's.speakerText.style.color')), 'player You #1d5c8c');
  check('...no price check, nothing charged, back on the road next', (await ev('e.sale.repriceUsed')) + ' ' + (await sc('Sales', 's.hint.text')), 'false Enter: Back On The Road');
  await page.screenshot({ path: outDir + '/sale_sold_out.png' });
  await press('Enter'); await wait(300);
  await ev('(window.__keep.forEach((q, i) => e.coolerSlots[i].quantity = q), e.coolerSlots.forEach((s, i) => s.priceCents = [200, 250, 250, 300][i]), true)');
  await serveNow();
  check('...the next customer with stock is named again, in pink', (await ev('e.sale.speaker')) + ' ' + (await sc('Sales', 's.speakerText.style.color')), 'customer #c2185b');
  await press('b'); await wait(300);

  // ---- SCREAM-225 (PO, November 9): the speech bubble is drawn on every visit to the window ----
  // (Phaser reuses the scene; it used to skip drawing a bubble the same height as last time.)
  const bubbleDrawn = () => sc('Sales', 's.bubble.commandBuffer.length > 50'); // an empty, cleared graphics still has a few commands
  let drawnEvery = true;
  for (let i = 0; i < 3; i++) {
    await serveNow();
    if (!(await bubbleDrawn())) drawnEvery = false;
    await press('b'); await wait(300);
  }
  check('The speech bubble is drawn for every customer, sale after sale (SCREAM-225)', drawnEvery, true);
  // The same picture order twice in a row: the pictures show both times.
  // Only one Chocolate Eclair in the cooler, so both customers order exactly "1 Chocolate Eclair".
  await ev('(e.orderPictureChance = 1, window.__keep2 = e.coolerSlots.map(s => s.quantity), e.coolerSlots.forEach((s, i) => s.quantity = i === 0 ? 1 : 0), true)');
  const pics = [];
  for (let i = 0; i < 2; i++) {
    await serveNow();
    pics.push((await ev('e.sale.order.map(l => l.count + l.flavour).join()')) + ':' + (await sc('Sales', 's.orderPictures.list.filter(o => o.name === "order-pic-eclair").length')));
    await press('b'); await wait(300);
  }
  check('...and the same picture order twice in a row shows its pictures both times', pics.join(','), '1eclair:1,1eclair:1');
  await ev('(e.orderPictureChance = 0, window.__keep2.forEach((q, i) => e.coolerSlots[i].quantity = q), true)');

  // ---- SCREAM-137: an order shown in pictures ----
  await ev('(e.orderPictureChance = 1, true)');
  await serveNow();
  const picOrder = await ev('e.sale.order.map(l => l.flavour).join(",")');
  check('Picture order: no words, one picture per ice cream in the order', JSON.stringify(await sc('Sales', 's.bubbleText.text')) + ' ' + (await sc('Sales', 's.orderPictures.list.filter(o => o.name.startsWith("order-pic-")).map(o => o.name.slice(10)).join(",")')), '"" ' + picOrder);
  check('...with each count beside its picture', await sc('Sales', 's.orderPictures.list.filter(o => o.type === "Text").map(o => o.text).join(",")'), await ev('e.sale.order.map(l => l.count + " ×").join(",")'));
  await page.screenshot({ path: outDir + '/sale_pictures.png' });
  await tick(5100);
  check('...the pictures go when the order hides', (await sc('Sales', 's.orderPictures.list.length')) + ' ' + (await sc('Sales', 's.bubbleText.text')), '0 …');
  await press('r'); await wait(150);
  check('R: the repeat is in pictures too', (await sc('Sales', 's.orderPictures.list.length')) > 0, true);
  await press('b'); await wait(300);
  await ev('(e.orderPictureChance = 0, true)');

  // ---- Debug keys moved to Shift ----
  const c7 = await cash();
  await press('1');
  check('Plain 1 no longer changes money', (await cash()) - c7, 0);
  await page.keyboard.down('Shift'); await page.keyboard.press('Digit1'); await page.keyboard.up('Shift'); await wait(150);
  check('Shift+1 still adds $4.50', (await cash()) - c7, 450);

  // ---- 8 PM during a sale ----
  await serveNow(); await tick(5100);
  await page.keyboard.down('Shift'); await page.keyboard.press('Digit3'); await page.keyboard.up('Shift'); await wait(300);
  check('8 PM mid-sale: the sale carries on', (await scenes()) + ' ' + (await ev('e.isOver')), 'Sales,Hud false');
  check('...no new customers after 8 PM', await ev('e.isAfterHours'), true);
  await press('b'); await wait(400);
  check('When the sale ends, the results screen appears', await scenes(), 'Results');

  console.log(`\n${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await browser.close();
})();
