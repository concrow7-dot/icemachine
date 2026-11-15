// SCREAM-334 and SCREAM-335: the Ice Cream tree's third row. The Two Ball Lou Ball (double tip,
// then the steering is reversed for 10 seconds of driving) and the Drum Cone (a drum solo that
// reaches further for 30 seconds). Also the cooler with more than four ice creams unlocked.
const { chromium } = require('playwright');
(async () => {
  const [port, outDir] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
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
  const until = async (fn, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await wait(50); } return false; };
  const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(60); } await wait(150); };
  const flow = (call) => page.evaluate(`(async () => { const f = await import('/src/flow.js'); const s = window.__game.scene.getScenes(true)[0]; ${call}; return true; })()`);
  let pass = 0, fail = 0;
  const check = (name, got, want) => { const ok = String(got) === String(want); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(68) + ' got=' + got + (ok ? '' : ' want=' + want)); };
  // A stand-in paid sale of one ice cream, through the evening's own startSale and chargeForSale.
  const sell = (flavour, tipPercent = 20) => page.evaluate(([flavour, tipPercent]) => {
    const e = window.__game.registry.get('evening');
    const before = e.coolerSlots.map(s => s.quantity);
    e.coolerSlots.forEach(s => { s.quantity = s.flavour === flavour ? 3 : 0; });
    const sale = e.startSale();
    const price = 400;
    const tip = Math.round(((price * tipPercent) / 100) * sale.tipFactor);
    sale.charge = () => { sale.phase = 'over'; sale.outcome = { kind: 'paid', priceCents: price, tipCents: tip, tipPercent }; sale.line = 'Thanks!'; return 'paid'; };
    e.hintChance = 0; e.scheduleLineChance = 0;
    e.chargeForSale(price);
    e.saleNow = null; e.servingNow = null; e.setCustomerWaiting(false);
    e.coolerSlots.forEach((s, i) => { s.quantity = before[i]; });
    return [...new Set(sale.order.map(l => l.flavour))].join() + ' | factor ' + sale.tipFactor + ' | tip ' + tip + ' | reversed ' + e.steeringReversedMs;
  }, [flavour, tipPercent]);

  // ---- Quick play never offers a Story ice cream ----
  await page.click('canvas'); await press('Enter'); await wait(400);
  check('Quick play: the clipboard offers the four old ice creams only', (await scenes()) + ' ' + (await sc('Cooler', "s.offered.map(f => f.id).join()")), 'Cooler,Hud eclair,spongepop,explorer,cookie');
  check('...and the Story ice creams are not unlocked there', await ev("['louball'].map(f => e.flavourUnlocked(f)).join()"), 'false');

  // ---- Story, On My Own: the board ----
  await flow('f.startStory(s, false)');
  await until(async () => (await scenes()).includes('StoryIntro')); await press('Enter');
  await until(async () => (await scenes()).includes('Cooler')); await wait(300);
  await ev("(e.changeMoney(30000, 'Test', false), true)");
  check('SCREAM-334: the Two Ball Lou Ball\'s note: $30, under SpongePop, with the PO\'s line and the $3.75 limit', await page.evaluate(async () => { const { POWER_UP_TREES } = await import('/src/config/powerUps.js'); const n = POWER_UP_TREES.find(t => t.id === 'icecream').notes.find(n => n.id === 'icecream-louball'); return [n.name, n.priceCents, n.col, n.row, n.from.join(), n.description].join(' | '); }), "TWO BALL LOU BALL | 3000 | 0 | 2 | icecream-spongepop | High upside, crazy downside. The average person won't pay more than $3.75 for one.");
  check('...it can\'t be bought before SpongePop; after SpongePop it can', (await ev("e.buyPowerUp('icecream-louball')")) + ' ' + (await ev("e.buyPowerUp('icecream-spongepop')")) + ' ' + (await ev("e.buyPowerUp('icecream-louball')")) + ' ' + (await ev('e.unlockedFlavours.join()')), 'false true true eclair,spongepop,louball');
  check('...it costs $2.00 to stock and is refused above $3.75', await page.evaluate(async () => { const { getFlavour } = await import('/src/config/flavours.js'); const e = window.__game.registry.get('evening'); return getFlavour('louball').costCents + ' ' + e.refuseAboveCents('louball'); }), '200 375');
  check('...the sandwich hangs from it: it can be bought now', await ev("e.buyPowerUp('icecream-cookie')"), true);
  await ev("(e.buyPowerUp('icecream-explorer'), true)");

  // ---- The cooler with five ice creams ----
  await sc('Cooler', '(s.scene.restart(), true)'); await wait(700);
  check('Five ice creams unlocked: the clipboard lists all five, in the order of the list', await sc('Cooler', "s.offered.map(f => f.id).join()"), 'eclair,spongepop,explorer,cookie,louball');
  check('...the rows sit closer together and every row is above the totals', await sc('Cooler', "s.rowYs.join() + ' ' + (Math.max(...s.rowYs) + 20 < s.totals.y - 14)"), '140,182,224,266,308 true');
  for (const f of ['eclair', 'spongepop', 'explorer', 'cookie', 'louball']) {
    const [x, y] = await sc('Cooler', `(() => { const b = s.addButtons.get('${f}'); return [b.x, b.y]; })()`);
    await page.mouse.click(x, y); await wait(120);
  }
  check('...clicking each picture adds one of each', await sc('Cooler', "s.order.slots.map(x => x.flavour + ':' + x.quantity).join()"), 'eclair:1,spongepop:1,explorer:1,cookie:1,louball:1');
  check("...Today's Menu shows five cards, smaller, all on the wall (left of x 940)", await sc('Cooler', "(() => { const v = s.cards.filter(c => c.container.visible); const last = v[v.length - 1].container; return v.length + ' ' + (last.scaleX < 1) + ' ' + (last.x + 156 * last.scaleX <= 941) + ' ' + (v[0].container.x === 262); })()"), '5 true true true');
  await page.mouse.move(5, 5); await wait(150);
  await page.screenshot({ path: outDir + '/icecreams_cooler_five.png' });
  {
    // The price buttons on a small card still work.
    const [x, y] = await sc('Cooler', "(() => { const c = s.cards.find(c => c.flavour === 'louball').container; return [c.x + (156 - 16) * c.scaleX, c.y + 120 * c.scaleY]; })()");
    const was = await sc('Cooler', "s.order.slots.find(x => x.flavour === 'louball').priceCents");
    await page.mouse.click(x, y); await wait(150);
    check('...a small card\'s + still raises its price', (await sc('Cooler', "s.order.slots.find(x => x.flavour === 'louball').priceCents")) - was, 25);
  }
  await sc('Cooler', '(s.buyButton.emit("pointerdown"), true)'); await wait(300);
  check('...bought: one Two Ball Lou Ball in the cooler', await ev("e.slots.find(s => s.flavour === 'louball').quantity"), 1);

  // ---- On the road ----
  await ev('(e.lockPrep(), true)');
  await page.evaluate(() => window.__game.scene.getScene('Cooler').scene.start('Drive'));
  await until(async () => (await scenes()).includes('Drive')); await wait(1500);
  await ev('(e.residents.hearingOff = true, true)');
  // Out of home's driveway, on the park brake.
  await drive('(() => { const r = s.homeBay.rotation; s.truck.setPosition(s.homeBay.x + Math.cos(r) * 300, s.homeBay.y + Math.sin(r) * 300); s.homeArmed = false; s.speed = 0; s.parkBrake = true; return true; })()');
  check('Before any sale the steering is normal and nothing is shown', (await ev('e.steeringReversed')) + ' ' + (await drive('s.reversedLabel.visible')), 'false false');
  check('A sale of an eclair: the usual tip, steering still normal', await sell('eclair'), 'eclair | factor 1 | tip 80 | reversed 0');
  check('SCREAM-334: a sale with a Two Ball Lou Ball pays double the tip, and the steering is reversed for 10 seconds', await sell('louball'), 'louball | factor 2 | tip 160 | reversed 10000');
  await wait(400);
  check('...the countdown shows, starting at 10', (await drive('s.reversedLabel.visible')) + ' | ' + (await drive('s.reversedLabel.text')) + ' | ' + (await ev('e.steeringReversedMs') >= 9000), 'true | STEERING REVERSED  10 | true');
  await page.screenshot({ path: outDir + '/icecreams_steering_reversed.png' });
  // Driving with Right held, frame by frame (like the feel suite). Reversed, the truck turns left (its heading goes down).
  const turned = () => drive(`(() => { const g = s.roads.nearestSegment(s.truck.x, s.truck.y); s.truck.setPosition((g.ax + g.bx) / 2, (g.ay + g.by) / 2); s.setHeading(Math.atan2(g.by - g.ay, g.bx - g.ax) * 180 / Math.PI); const h0 = s.heading; s.parkBrake = false; s.held = ['right']; for (let i = 0; i < 6; i++) { s.speed = 40; s.update(0, 16); } const d = s.heading - h0; s.held = []; s.speed = 0; s.parkBrake = true; return Math.abs(d) < 0.2 ? 0 : Math.sign(d); })()`);
  check('...holding Right turns the truck left', await turned(), -1);
  check('...the 10 seconds run down in the driving view', await ev('e.steeringReversedMs < 9600 && e.steeringReversedMs > 7500'), true);
  const left = await ev('e.steeringReversedMs'); await wait(600);
  check('...parked on the brake they still count', (await ev('e.steeringReversedMs')) < left, true);
  check('...a second sale starts the 10 seconds again; it doesn\'t add up', await sell('louball'), 'louball | factor 2 | tip 160 | reversed 10000');
  await ev('(e.steeringReversedMs = 200, true)'); await wait(500);
  check('...when they run out the steering is normal again and the countdown goes', (await ev('e.steeringReversed')) + ' ' + (await drive('s.reversedLabel.visible')) + ' ' + (await turned()), 'false false 1');

  console.log(`\n${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await browser.close();
})();
