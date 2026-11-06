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
  const fmt = (s) => s.flavour + ':' + s.quantity + ':' + s.priceCents;
  const owned = (i) => ev(`(() => { const s = e.slots[${i}]; return s.flavour + ':' + s.quantity + ':' + s.priceCents; })()`);
  const draft = (i) => page.evaluate((i) => { const s = window.__game.scene.getScene('Cooler').order.slots[i]; return s.flavour + ':' + s.quantity + ':' + s.priceCents; }, i);
  const cash = () => ev('e.moneyCents');
  const coolerText = (k) => page.evaluate((k) => window.__game.scene.getScene('Cooler')[k].text, k);
  const wait = ms => page.waitForTimeout(ms);
  const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(40); } await wait(80); };
  let pass = 0, fail = 0;
  const check = (name, got, want) => { const ok = String(got) === String(want); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(60) + ' got=' + got + (ok ? '' : ' want=' + want)); };
  const openCooler = async () => { await press('Enter'); await wait(200); };

  await page.click('canvas'); await press('Enter'); await wait(200);
  check('The evening opens at the cooler (#66)', await scenes(), 'Cooler,Hud');
  check('Button reads BUY STOCK $0.00', await coolerText('buyButton'), 'BUY STOCK  $0.00');

  // SCREAM-129: the clipboard (rows: eclair, SpongePop, Explorer, cookie), 3 crates of 4 x 4, Today's Menu.
  const cooler = (fn) => page.evaluate(`(() => { const s = window.__game.scene.getScene('Cooler'); return ${fn}; })()`);
  const cells = (n) => cooler(`s.order.cells.slice(0, ${n}).map(c => c ? c.flavour + (c.paid ? '' : '*') : '-').join(',')`);
  const menu = () => cooler(`s.visibleCards().map(c => c.flavour + ' ' + c.price.text).join(', ')`);
  const clickAt = async (fn) => { const [x, y] = await cooler(fn); await page.mouse.click(x, y); await wait(150); };

  // --- SCREAM-133: each row's add button is the ice cream's picture with a "+" on it ---
  check('Add buttons: a picture with a pulsing "+" for each flavour', await cooler('["eclair","spongepop","explorer","cookie"].map(f => { const b = s.addButtons.get(f); return b && b.list.length === 2 && s.tweens.getTweensOf(b.list[1]).length === 1; }).join(",")'), 'true,true,true,true');
  await clickAt('(() => { const b = s.addButtons.get("spongepop"); return [b.x, b.y]; })()');
  check('Clicking the SpongePop picture adds one SpongePop', await cells(1), 'spongepop*');
  await press('-'); await press('ArrowUp');
  check('...(taken back out with -)', await cells(1), '-');

  // --- Picking costs nothing until Buy Stock ---
  await press('+', 4);
  check('+4 on the clipboard: 4 eclairs in the draft', await draft(0), 'eclair:4:200');
  check('...dropped into the first 4 squares, not paid for (*)', await cells(5), 'eclair*,eclair*,eclair*,eclair*,-');
  check('...but the cooler is untouched', await owned(0), 'eclair:0:200');
  check('...and no money is taken yet', await cash(), 5000);
  check('Totals preview the order', await coolerText('totals'), 'This order: $4.00\nCash: $50.00 → $46.00');
  check('Button shows the order cost', await coolerText('buyButton'), 'BUY STOCK  $4.00');
  check('Title counts the squares', await coolerText('title'), 'THE COOLER  –  PREP     4 / 48');
  check("Today's Menu: a card for eclairs only, price in marker", await menu(), 'eclair $2');
  await press('ArrowRight'); await press('+', 2);
  check('Right, then +2: the menu price goes up (part of the draft)', (await draft(0)) + ' / ' + (await menu()), 'eclair:4:250 / eclair $2.50');
  await page.screenshot({ path: outDir + '/buy_draft.png' });

  // --- The cooler can't be left empty (#66 feedback) ---
  await press('b'); await wait(150);
  check("B with nothing bought: stays at the cooler", await scenes(), 'Cooler,Hud');
  check('...and says why, in red', (await coolerText('note')) + ' ' + (await page.evaluate(() => window.__game.scene.getScene('Cooler').note.style.color)), 'Add at least one ice cream before you leave the cooler. #b3261e');
  check('...draft kept, nothing charged', (await draft(0)) + ' ' + (await cash()), 'eclair:4:250 5000');
  await page.screenshot({ path: outDir + '/buy_empty_blocked.png' });
  await press('Backspace'); await wait(150);
  check('Backspace is blocked too', await scenes(), 'Cooler,Hud');
  await press('ArrowLeft'); await press('-', 4);
  check('Left, then -4: back on the clipboard, all 4 put back', (await draft(0)) + ' ' + (await cells(1)) + ' ' + (await menu()), 'eclair:0:250 - ');
  await press('Enter'); await wait(150);
  check('Buying an empty order: blocked, still at the cooler', await scenes(), 'Cooler,Hud');
  await wait(2700);
  check('The usual note comes back after a moment', await coolerText('note'), 'The clock starts when you leave the cooler. Everything locks when you drive off.');
  check('The clock is still waiting', await ev('e.isClockRunning'), false);

  // --- SCREAM-72: no "$4" warning; a price over $4 just shows its profit ---
  const hint = await cooler(`(() => { s.order.addOne('eclair'); const keep = s.order.slots[0].priceCents; s.order.slots[0].priceCents = 450; s.refresh(); const t = s.cards[0].margin.text; s.order.slots[0].priceCents = keep; s.order.removeOne('eclair'); s.refresh(); return t; })()`);
  check('A price over $4.00: no "customers refuse" warning, just the profit', /refuse/.test(hint) + ' ' + /^Profit /.test(hint), 'false true');

  // --- Can't overspend, can't overfill ---
  await press('ArrowDown', 3); await press('+', 30);
  check('Cookies ($2.00) stop when the cash runs out: 25', await draft(3), 'cookie:25:300');
  check('...the note says why', await coolerText('note'), 'Not enough cash for that one.');
  await cooler('s.scene.restart()'); await wait(400);
  check('Draft thrown away: still $50, fresh draft', (await cash()) + ' ' + (await draft(3)), '5000 cookie:0:300');
  await press('+', 50);
  check('Eclairs ($1.00) stop when the cooler is full: 48', (await draft(0)) + ' ' + (await coolerText('title')), 'eclair:48:200 THE COOLER  –  PREP     48 / 48');
  check('...the note says why', await coolerText('note'), 'The cooler is full.');
  await cooler('s.scene.restart()'); await wait(400);

  // --- Clicking an unpaid square takes it out ---
  await press('+', 3); await press('ArrowDown'); await press('+', 2);
  check('3 eclairs then 2 SpongePops, in picking order', await cells(6), 'eclair*,eclair*,eclair*,spongepop*,spongepop*,-');
  await clickAt('[s.cellIcons[1].x, s.cellIcons[1].y]');
  check('Clicking the 2nd square takes that eclair out, leaving a gap (SCREAM-132)', (await cells(5)) + ' ' + (await draft(0)), 'eclair*,-,eclair*,spongepop*,spongepop* eclair:2:200');
  check("Today's Menu: eclairs and SpongePops", await menu(), 'eclair $2, spongepop $2.50');

  // --- Buy Stock with Enter ---
  await press('Enter'); await wait(200);
  check('Enter buys and returns to the truck', await scenes(), 'Truck,Hud');
  check('Truck selection stays on the cooler', await page.evaluate(() => window.__game.scene.getScene('Truck').selected), 'cooler');
  check('Bought: 2 eclairs, 2 SpongePops', (await owned(0)) + ' ' + (await owned(1)), 'eclair:2:200 spongepop:2:250');
  check('Charged $5.00 (cash $45.00)', await cash(), 4500);

  // --- Re-entry: paid stock stays, more can be added ---
  await openCooler(); await wait(200);
  check('Reopen: bought stock is paid for (no *), each in its own square', await cells(5), 'eclair,-,eclair,spongepop,spongepop');
  await press('-', 2);
  check("Minus can't take out paid stock", await draft(0), 'eclair:2:200');
  await clickAt('[s.cellIcons[0].x, s.cellIcons[0].y]');
  check('...and neither can clicking it', await draft(0), 'eclair:2:200');
  await press('+', 2);
  check('Can add more: the gap fills first', (await draft(0)) + ' ' + (await cells(7)), 'eclair:4:200 eclair,eclair*,eclair,spongepop,spongepop,eclair*,-');
  check('Order only charges the extra 2 ($2.00)', await coolerText('buyButton'), 'BUY STOCK  $2.00');
  await press('-');
  check('Can take extras out again', await draft(0), 'eclair:3:200');

  // --- B cancels, now there is stock in the cooler ---
  await press('b'); await wait(150);
  check('B returns to the truck once stock is bought', await scenes(), 'Truck,Hud');
  check('Cancel: extras thrown away, cash still $45.00', (await owned(0)) + ' ' + (await cash()), 'eclair:2:200 4500');
  await openCooler(); await wait(200);
  await press('ArrowDown', 3); await press('+', 3);
  check('Add 3 cookies', (await draft(3)) + ' ' + (await cells(8)), 'cookie:3:300 eclair,cookie*,eclair,spongepop,spongepop,cookie*,cookie*,-');

  // ---- SCREAM-131: choosing a crate; SCREAM-132: dragging between squares ----
  await press('2'); await press('-'); await press('+');
  check('Press 2: the next pick goes into crate 2 (square 16)', (await cells(17)).split(',')[16] + ' ' + (await cooler('s.order.crate')), 'cookie* 1');
  await clickAt('[s.cellCentre(40).x, s.cellCentre(40).y]');
  check('Click a crate: picks go there now', await cooler('s.order.crate'), 2);
  const dragFrom = await cooler('[s.cellIcons[0].x, s.cellIcons[0].y]');
  const dragTo = await cooler('[s.cellCentre(47).x, s.cellCentre(47).y]');
  await page.mouse.move(dragFrom[0], dragFrom[1]); await page.mouse.down();
  await page.mouse.move((dragFrom[0] + dragTo[0]) / 2, (dragFrom[1] + dragTo[1]) / 2, { steps: 5 });
  await page.mouse.move(dragTo[0], dragTo[1], { steps: 5 }); await page.mouse.up(); await wait(200);
  check('Drag a paid eclair from square 1 to the last square (crate 3)', (await cooler('s.order.cells[0] === null')) + ' ' + (await cooler('s.order.cells[47].flavour + s.order.cells[47].paid')), 'true eclairtrue');
  check('...dragging costs nothing', await coolerText('buyButton'), 'BUY STOCK  $6.00');
  await page.screenshot({ path: outDir + '/buy_reentry.png' });

  // Mouse: click the BUY STOCK button
  await clickAt('[s.buyButton.x, s.buyButton.y]'); await wait(100);
  check('Clicking BUY STOCK buys and returns', await scenes(), 'Truck,Hud');
  check('...and the cooler keeps the arrangement', await ev('e.cells[47] + " " + e.cells[0] + " " + e.cells[16]'), 'eclair null cookie');
  check('Cooler now: 2 eclairs, 2 SpongePops, 3 cookies',
    [await owned(0), await owned(1), await owned(3)].join(' '), 'eclair:2:200 spongepop:2:250 cookie:3:300');
  check('Charged $6.00 (cash $39.00)', await cash(), 3900);
  check('Stock cost total $11.00', await ev('e.stockCostCents'), 1100);

  // --- Price-only order: the menu's + button ---
  await openCooler(); await wait(200);
  await clickAt('[s.cards[0].container.x + 140, s.cards[0].container.y + 120]');
  await clickAt('[s.cards[0].container.x + 140, s.cards[0].container.y + 120]');
  await press('Enter'); await wait(200);
  check('Price-only Buy (menu + clicked twice) saves the price, costs $0', (await owned(0)) + ' ' + (await cash()), 'eclair:2:250 3900');

  // --- Driver's seat locks ---
  await press('ArrowRight'); await press('Enter'); await wait(150);
  check("Driver's seat locks prep", await ev('e.isPrepLocked'), true);
  // The hub can't be reached after driving any more (sales go straight to the window), so open the locked cooler directly
  await page.evaluate(() => { const g = window.__game; g.scene.stop('Drive'); g.scene.start('Cooler'); }); await wait(400);
  check('Cooler opens in locked mode', await scenes(), 'Cooler,Hud');
  check('Locked: no Buy button', await page.evaluate(() => window.__game.scene.getScene('Cooler').buyButton === undefined), true);
  await press('+', 2); await press('Enter'); await wait(200);
  check('Locked: + and Enter do nothing', (await scenes()) + ' ' + (await owned(0)) + ' ' + (await cash()), 'Cooler,Hud eclair:2:250 3900');
  check('Locked totals', await coolerText('totals'), 'Spent on stock:\n$11.00');
  check('Locked title', await coolerText('title'), 'THE COOLER  (stock is set for tonight)     7 / 48');
  await page.screenshot({ path: outDir + '/buy_locked.png' });
  await press('Backspace'); await wait(150);
  check('B/Backspace returns to truck', await scenes(), 'Truck,Hud');
  check('Profit = -$11.00 so far', await ev('e.profitCents'), -1100);

  await page.keyboard.down('Shift'); await page.keyboard.press('Digit3'); await page.keyboard.up('Shift'); await wait(300); await press('Enter'); await wait(250); await press('Enter'); await wait(200);
  check('New evening resets cash and cooler', (await cash()) + ' ' + (await owned(0)) + ' ' + (await ev('e.isPrepLocked')), '5000 eclair:0:200 false');

  console.log(`\n${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await browser.close();
})();
