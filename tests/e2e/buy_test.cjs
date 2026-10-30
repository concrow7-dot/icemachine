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

  // --- Draft changes cost nothing until Buy Stock ---
  await press('+', 4);
  check('+4 changes the draft to 4 eclairs', await draft(0), 'eclair:4:200');
  check('...but the cooler is untouched', await owned(0), 'eclair:0:200');
  check('...and no money is taken yet', await cash(), 5000);
  check('Totals preview the order', await coolerText('totals'), 'This order: $4.00     Cash: $50.00 → $46.00');
  check('Button shows the order cost', await coolerText('buyButton'), 'BUY STOCK  $4.00');
  await press('ArrowDown'); await press('+', 2);
  check('Price change is part of the draft', await draft(0), 'eclair:4:250');
  await page.screenshot({ path: outDir + '/buy_draft.png' });

  // --- The cooler can't be left empty (#66 feedback) ---
  await press('b'); await wait(150);
  check("B with nothing bought: stays at the cooler", await scenes(), 'Cooler,Hud');
  check('...and says why, in red', (await coolerText('note')) + ' ' + (await page.evaluate(() => window.__game.scene.getScene('Cooler').note.style.color)), 'Add at least one ice cream before you leave the cooler. #b3261e');
  check('...draft kept, nothing charged', (await draft(0)) + ' ' + (await cash()), 'eclair:4:250 5000');
  await page.screenshot({ path: outDir + '/buy_empty_blocked.png' });
  await press('Backspace'); await wait(150);
  check('Backspace is blocked too', await scenes(), 'Cooler,Hud');
  await press('ArrowUp'); await press('-', 4);
  await press('Enter'); await wait(150);
  check('Buying an empty order: blocked, still at the cooler', await scenes(), 'Cooler,Hud');
  await wait(2700);
  check('The usual note comes back after a moment', await coolerText('note'), 'The clock starts when you leave the cooler. Everything locks when you drive off.');
  check('The clock is still waiting', await ev('e.isClockRunning'), false);

  // --- Draft can't overspend ---
  await press('+', 15); await press('ArrowRight'); await press('+', 15); await press('ArrowRight'); await press('+', 15);
  check("Draft stops when cash runs out (8 explorers)", await draft(2), 'explorer:8:250');
  check('Order costs $49.50', await page.evaluate(() => window.__game.scene.getScene('Cooler').order.costCents), 4950);
  // Throw the draft away by reopening the cooler (B can't leave an empty cooler)
  await page.evaluate(() => window.__game.scene.getScene('Cooler').scene.restart()); await wait(200);
  check('Draft thrown away: still $50, fresh draft', (await cash()) + ' ' + (await draft(0)), '5000 eclair:0:200');

  // --- Buy Stock with Enter ---
  await press('+', 5); await press('ArrowRight'); await press('+', 2);
  await press('Enter'); await wait(200);
  check('Enter buys and returns to the truck', await scenes(), 'Truck,Hud');
  check('Truck selection stays on the cooler', await page.evaluate(() => window.__game.scene.getScene('Truck').selected), 'cooler');
  check('Bought: 5 eclairs, 2 SpongePops', (await owned(0)) + ' ' + (await owned(1)), 'eclair:5:200 spongepop:2:250');
  check('Charged $8.00 (cash $42.00)', await cash(), 4200);

  // --- Re-entry: add more only ---
  await openCooler();
  check('Reopen shows bought stock', await draft(0), 'eclair:5:200');
  check('Owned label shown', await page.evaluate(() => window.__game.scene.getScene('Cooler').columns[0].owned.text), '5 already bought');
  await press('-', 3);
  check("Can't go below bought stock", await draft(0), 'eclair:5:200');
  await press('+', 2);
  check('Can add more', await draft(0), 'eclair:7:200');
  check('Order only charges the extra 2 ($2.00)', await coolerText('buyButton'), 'BUY STOCK  $2.00');
  await press('-');
  check('Can remove extras again', await draft(0), 'eclair:6:200');

  // --- B cancels, now there is stock in the cooler ---
  await press('b'); await wait(150);
  check('B returns to the truck once stock is bought', await scenes(), 'Truck,Hud');
  check('Cancel: extras thrown away, cash still $42.00', (await owned(0)) + ' ' + (await cash()), 'eclair:5:200 4200');
  await openCooler();
  check('Reopening shows a fresh draft', await draft(0), 'eclair:5:200');
  await press('+');
  await press('ArrowUp'); await press('+');
  check('Flavour locked on a slot with bought stock', await draft(0), 'eclair:6:200');
  const alpha = await page.evaluate(() => window.__game.scene.getScene('Cooler').columns[0].buttons[0].alpha);
  check('...and its flavour arrows are dimmed', alpha, 0.3);
  await press('ArrowRight', 2); await press('+');
  check('Empty slot 3 can still change flavour', await draft(2), 'cookie:0:300');
  await press('ArrowDown'); await press('+', 3);
  check('Add 3 cookies', await draft(2), 'cookie:3:300');
  await page.screenshot({ path: outDir + '/buy_reentry.png' });

  // Mouse: click the Buy Stock button (centre x=480, y=458)
  await page.mouse.click(480, 458); await wait(200);
  check('Clicking BUY STOCK buys and returns', await scenes(), 'Truck,Hud');
  check('Cooler now: 6 eclairs, 2 SpongePops, 3 cookies',
    [await owned(0), await owned(1), await owned(2)].join(' '), 'eclair:6:200 spongepop:2:250 cookie:3:300');
  check('Charged $1.00 + $6.00 (cash $35.00)', await cash(), 3500);
  check('Stock cost total $15.00', await ev('e.stockCostCents'), 1500);

  // --- Price-only order ---
  await openCooler();
  await press('ArrowDown'); await press('+', 2); await press('Enter'); await wait(200);
  check('Price-only Buy saves the price, costs $0', (await owned(0)) + ' ' + (await cash()), 'eclair:6:250 3500');

  // --- Driver's seat locks ---
  await press('ArrowRight'); await press('Enter'); await wait(150);
  check("Driver's seat locks prep", await ev('e.isPrepLocked'), true);
  // The hub can't be reached after driving any more (sales go straight to the window), so open the locked cooler directly
  await page.evaluate(() => { const g = window.__game; g.scene.stop('Drive'); g.scene.start('Cooler'); }); await wait(300);
  check('Cooler opens in locked mode', await scenes(), 'Cooler,Hud');
  check('Locked: no Buy button', await page.evaluate(() => window.__game.scene.getScene('Cooler').buyButton === undefined), true);
  await press('+', 2); await press('Enter'); await wait(200);
  check('Locked: + and Enter do nothing', (await scenes()) + ' ' + (await owned(0)) + ' ' + (await cash()), 'Cooler,Hud eclair:6:250 3500');
  check('Locked totals', await coolerText('totals'), 'Spent on stock: $15.00');
  await page.screenshot({ path: outDir + '/buy_locked.png' });
  await press('Backspace'); await wait(150);
  check('B/Backspace returns to truck', await scenes(), 'Truck,Hud');
  check('Profit = -$15.00 so far', await ev('e.profitCents'), -1500);

  await page.keyboard.down('Shift'); await page.keyboard.press('Digit3'); await page.keyboard.up('Shift'); await wait(300); await press('Enter'); await wait(250); await press('Enter'); await wait(200);
  check('New evening resets cash and cooler', (await cash()) + ' ' + (await owned(0)) + ' ' + (await ev('e.isPrepLocked')), '5000 eclair:0:200 false');

  console.log(`\n${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await browser.close();
})();
