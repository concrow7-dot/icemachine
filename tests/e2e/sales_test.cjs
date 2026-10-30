const { chromium } = require('playwright');
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
  await press('+', 10); await press('ArrowRight'); await press('+', 5); await press('ArrowRight'); await press('+', 5);
  await press('Enter'); await wait(200);
  check('Prep: stock 10,5,5 and cash $25.00', (await stock()) + ' ' + (await cash()), '10,5,5 2500');
  await press('ArrowRight'); await press('Enter'); await wait(400);

  // ---- Sale 1: perfect and fast ----
  await sc('Drive', '(s.truck.setPosition(s.pickupZone.x, s.pickupZone.y), s.speed = 0, s.parkBrake = true)'); await wait(400);
  check('Pulling up to a customer opens the sales screen (no hub)', await scenes(), 'Sales,Hud');
  check('The customer gives an order', await ev('e.sale.phase') + ' ' + (await ev('e.sale.order.length > 0')), 'ordering true');
  check('Bubble shows the order', await sc('Sales', 's.bubbleText.text') === await ev('e.sale.line'), true);
  check('Tip bar hidden while the order is showing', await sc('Sales', 's.tipBar.container.visible'), false);
  await page.screenshot({ path: outDir + '/sale_order.png' });
  await setOrder([{ slot: 0, flavour: 'eclair', count: 2 }, { slot: 1, flavour: 'spongepop', count: 1 }]);
  await tick(5100);
  check('After 5 s the order is hidden', (await ev('e.sale.phase')) + ' ' + (await sc('Sales', 's.bubbleText.text')), 'deciding …');
  check('Tip countdown starts: 20%', (await sc('Sales', 's.tipBar.container.visible')) + ' ' + (await sc('Sales', 's.tipBar.label.text')), 'true 20%');
  await press('Enter'); await wait(300);
  check('Enter goes to the cooler (fill mode)', await scenes(), 'Fill,Hud');
  check('Tip bar still showing at the cooler', await sc('Fill', 's.tipBar.container.visible'), true);
  await press('+', 2); await press('ArrowRight'); await press('ArrowUp');
  check('Picking takes ice creams out of the cooler', (await stock()) + ' bag ' + (await ev('e.sale.bag.join(",")')), '8,4,5 bag 2,1,0');
  await press('-'); await press('+');
  check('Putting one back and taking it again', await ev('e.sale.bag.join(",")'), '2,1,0');
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
  check('Enter: straight back on the road, next customer waiting', (await scenes()) + ' ' + (await ev('e.roadCustomer !== null')), 'Drive,Hud true');
  check('Sold ice creams are gone from stock', await stock(), '8,4,5');

  // ---- Sale 2: wrong items once -> corrected order, retry, undercharge accepted with no tip ----
  await serveNow();
  check('Shift+4 (debug) starts a sale right away', await scenes(), 'Sales,Hud');
  await setOrder([{ slot: 2, flavour: 'explorer', count: 1 }]);
  await tick(5100); await tick(12000);
  check('12 s into the countdown: 15%', await sc('Sales', 's.tipBar.label.text'), '15%');
  await press('c'); await wait(300); await press('+'); await press('Enter'); await wait(300);
  await page.keyboard.type('2'); await press('Enter');
  check('Wrong items, first time: the customer says the right order', (await ev('e.sale.line')).includes('I wanted 1 Lil Explorer Pop'), true);
  check('...items go back in the cooler, order shown again', (await stock()) + ' ' + (await ev('e.sale.phase')), '8,4,5 ordering');
  check('...and the tip is gone', await sc('Sales', 's.tipBar.label.text'), 'no tip');
  await tick(5100);
  await press('c'); await wait(300); await press('ArrowRight'); await press('ArrowRight'); await press('+'); await press('Enter'); await wait(300);
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
  await press('b'); await wait(300); await press('b'); await wait(300);

  // ---- Sale 3: overcharge -> they leave with it for free ----
  await serveNow(); await setOrder([{ slot: 0, flavour: 'eclair', count: 1 }]); await tick(5100);
  await press('c'); await wait(300); await press('+'); await press('Enter'); await wait(300);
  const c3 = await cash();
  await page.keyboard.type('999'); await press('Enter');
  check('Overcharge: "That\'s more than it\'s supposed to be."', await ev('e.sale.line'), "That's more than it's supposed to be.");
  check('...the button says BACK ON THE ROAD; the hint still says sorry', (await sc('Sales', 's.roadButton.visible')) + ' ' + (await sc('Sales', 's.hint.text')), "true Enter: say sorry, it's on the house");
  await page.screenshot({ path: outDir + '/sale_overcharge.png' });
  const rb = await sc('Sales', '[s.roadButton.x, s.roadButton.y]'); const bb = await (await page.$('canvas')).boundingBox();
  await page.mouse.click(bb.x + rb[0], bb.y + rb[1]); await wait(300);
  check('Clicking BACK ON THE ROAD leaves the window', await scenes(), 'Drive,Hud');
  check('...no money, and the ice cream is gone', ((await cash()) - c3) + ' ' + (await stock()), '0 7,4,4');

  // ---- Sale 4: ask again (R), then wrong -> no retry, given away ----
  await serveNow(); await setOrder([{ slot: 1, flavour: 'spongepop', count: 2 }]); await tick(5100);
  await press('r');
  check('R: the order is shown again', (await ev('e.sale.phase')) + ' ' + (await ev('e.sale.askedAgain')), 'ordering true');
  await tick(5100);
  check('R a second time does nothing', await ev('e.sale.askAgain(e.nowMs)'), false);
  await press('c'); await wait(300); await press('ArrowRight'); await press('+'); await press('Enter'); await wait(300);
  await page.keyboard.type('5'); await press('Enter');
  check('After R, a wrong order fails: "That\'s not what I asked for."', (await ev('e.sale.outcome.kind')) + ' ' + (await ev('e.sale.line')), "wrong-order That's not what I asked for.");
  await press('Enter'); await wait(300);
  check('...the wrong item is given away', await stock(), '7,3,4');

  // ---- Sale 5: the minute runs out while at the cooler ----
  await serveNow(); await setOrder([{ slot: 0, flavour: 'eclair', count: 3 }]); await tick(5100);
  await press('c'); await wait(300); await press('+');
  await tick(50000);
  check('Tip bar runs out: "Took too long", customer still waiting', (await ev('e.sale.phase')) + ' ' + (await sc('Fill', 's.tipBar.label.text')), 'deciding Took too long');
  check('5 s left: pulsing "!" in the top bar', await sc('Hud', 's.patienceWarning.visible'), true);
  await page.screenshot({ path: outDir + '/sale_warning.png' });
  await tick(5500);
  check('Time\'s up: back at the window, "Sorry, I have to go."', (await scenes()) + ' ' + (await ev('e.sale.line')), 'Sales,Hud Sorry, I have to go.');
  check('...warning gone', await sc('Hud', 's.patienceWarning.visible'), false);
  await press('Enter'); await wait(300);
  check('...the picked ice cream goes back in the cooler', await stock(), '7,3,4');

  // ---- Sale 6: drive off ----
  await serveNow(); await tick(5100); const c6 = await cash();
  await press('b'); await wait(300);
  check('B: drive off, a lost sale, back on the road', (await scenes()) + ' ' + ((await cash()) - c6), 'Drive,Hud 0');

  // ---- Too expensive ----
  await ev('(e.coolerSlots.forEach(s => s.priceCents = 450), true)');
  await serveNow();
  check('Every flavour over $4.00: "Too expensive!"', (await ev('e.sale.outcome.kind')) + ' ' + (await sc('Sales', 's.bubbleText.text')), 'too-expensive Too expensive!');
  await press('Enter'); await wait(300);
  await ev('(e.coolerSlots.forEach((s, i) => s.priceCents = [200, 250, 250][i]), true)');

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
