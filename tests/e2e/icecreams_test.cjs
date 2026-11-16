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
  check('...and its cooler has no slot for them', await ev("e.slots.map(s => s.flavour).join()"), 'eclair,spongepop,explorer,cookie');
  check('...and the Story ice creams are not unlocked there', await ev("['louball','drumcone'].map(f => e.flavourUnlocked(f)).join()"), 'false,false');
  check('SCREAM-251: Quick play has no porch lights', await drive('s.porchLights.length'), 0);
  check('SCREAM-342: Quick play has no chasing rules: everyone keeps following at the old speed', await ev("e.residents.chaseRules + ' ' + e.residents.runSpeedOf(e.residents.all[0].resident) + ' ' + e.residents.chaseSecondsOf(e.residents.all[0].resident)"), 'false 37 Infinity');
  check('SCREAM-343: Quick play\'s menu is not capped: the eclair goes past $2.50', await sc('Cooler', "(() => { s.order.addOne('eclair'); for (let i = 0; i < 8; i++) s.order.changePrice('eclair', 25); const p = s.order.slots[0].priceCents; for (let i = 0; i < 8; i++) s.order.changePrice('eclair', -25); s.order.removeOne('eclair'); s.refresh(); return p; })()"), 400);

  // ---- Story, On My Own: the board ----
  await flow('f.startStory(s, false)');
  await until(async () => (await scenes()).includes('StoryIntro')); await press('Enter');
  await until(async () => (await scenes()).includes('Cooler')); await wait(300);
  await ev("(e.changeMoney(30000, 'Test', false), true)");
  check('SCREAM-334: the Two Ball Lou Ball\'s note: $30, under SpongePop, with the PO\'s line and the $3.00 limit', await page.evaluate(async () => { const { POWER_UP_TREES } = await import('/src/config/powerUps.js'); const n = POWER_UP_TREES.find(t => t.id === 'icecream').notes.find(n => n.id === 'icecream-louball'); return [n.name, n.priceCents, n.col, n.row, n.from.join(), n.description].join(' | '); }), "TWO BALL LOU BALL | 3000 | 0 | 2 | icecream-spongepop | High upside, crazy downside. The average person won't pay more than $3.00 for one. Costs you $1.00 each to stock.");
  check('...it can\'t be bought before SpongePop; after SpongePop it can', (await ev("e.buyPowerUp('icecream-louball')")) + ' ' + (await ev("e.buyPowerUp('icecream-spongepop')")) + ' ' + (await ev("e.buyPowerUp('icecream-louball')")) + ' ' + (await ev('e.unlockedFlavours.join()')), 'false true true eclair,spongepop,louball');
  check('...it costs $1.00 to stock (SCREAM-351) and is refused above $3.00', await page.evaluate(async () => { const { getFlavour } = await import('/src/config/flavours.js'); const e = window.__game.registry.get('evening'); return getFlavour('louball').costCents + ' ' + e.refuseAboveCents('louball') + ' ' + e.slots.find(x => x.flavour === 'louball').priceCents; }), '100 300 300');
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
  check('...clicking each picture adds one of each', await sc('Cooler', "s.order.slots.filter(x => x.quantity > 0).map(x => x.flavour + ':' + x.quantity).join()"), 'eclair:1,spongepop:1,explorer:1,cookie:1,louball:1');
  check("...Today's Menu shows five cards, smaller, all on the wall (left of x 940)", await sc('Cooler', "(() => { const v = s.cards.filter(c => c.container.visible); const last = v[v.length - 1].container; return v.length + ' ' + (last.scaleX < 1) + ' ' + (last.x + 156 * last.scaleX <= 941) + ' ' + (v[0].container.x === 262); })()"), '5 true true true');
  await page.mouse.move(5, 5); await wait(150);
  await page.screenshot({ path: outDir + '/icecreams_cooler_five.png' });

  // ---- SCREAM-25: More Space for Scream opens a bottom row of two squares in each crate ----
  {
    const own = (on) => page.evaluate(async (on) => { const { truckSpec } = await import('/src/state/TruckSpec.js'); const e = window.__game.registry.get('evening'); const i = e.powerUpsOwned.indexOf('more-junk'); if (on && i < 0) e.powerUpsOwned.push('more-junk'); if (!on && i >= 0) e.powerUpsOwned.splice(i, 1); e.truckNow = truckSpec(true, e.powerUps); window.__game.scene.getScene('Cooler').scene.restart(); }, on);
    const open = () => ev("[0, 1, 2, 8, 9, 12, 13, 14, 28, 29, 44, 45, 46].filter(i => e.cellOpen(i)).join()");
    check('Before More Space for Scream: Story\'s cooler holds 18, three rows of two in each crate', (await sc('Cooler', 's.order.capacity')) + ' ' + (await ev('e.spec.coolerRows')) + ' | ' + (await open()), '18 3 | 0,1,8,9');
    await own(true); await wait(700);
    check('SCREAM-25: with More Space for Scream it holds 24: a fourth row of two opens at the bottom of all three crates', (await sc('Cooler', 's.order.capacity')) + ' ' + (await ev('e.spec.coolerRows')) + ' | ' + (await open()), '24 4 | 0,1,8,9,12,13,28,29,44,45');
    check('...an ice cream can be dropped on a new bottom square', await sc('Cooler', "(() => { s.order.addOne('eclair'); const from = s.order.cells.findIndex(c => c); const ok = s.order.move(from, 12); const there = !!s.order.cells[12]; s.order.move(12, from); s.order.removeOne('eclair'); s.refresh(); return ok + ' ' + there; })()"), 'true true');
    await page.mouse.move(5, 5); await wait(150);
    await page.screenshot({ path: outDir + '/icecreams_more_junk.png' });
    await own(false); await wait(700);
    check('...without it the cooler is 18 again', await sc('Cooler', 's.order.capacity'), 18);
    for (const f of ['eclair', 'spongepop', 'explorer', 'cookie', 'louball']) await sc('Cooler', `(s.order.addOne('${f}'), true)`);
    await sc('Cooler', '(s.refresh(), true)');
  }

  // ---- SCREAM-343: Today's Menu stops at the price on the ice cream's cork board note ----
  const raise = (f, n) => sc('Cooler', `(() => { for (let i = 0; i < ${n}; i++) s.order.changePrice('${f}', 25); s.refresh(); return s.order.slots.find(x => x.flavour === '${f}').priceCents; })()`);
  const plusAlpha = (f) => sc('Cooler', `s.cards.find(c => c.flavour === '${f}').plus.alpha`);
  check('SCREAM-343: the eclair starts under its top price: the + is bright', (await sc('Cooler', "s.order.slots[0].priceCents")) + ' ' + (await plusAlpha('eclair')), '200 1');
  check('...raised 20 times it stops at the $2.50 on its note, and the + is greyed', (await raise('eclair', 20)) + ' ' + (await plusAlpha('eclair')), '250 0.35');
  check('...SpongePop, the Explorer Pop and the Lou Ball stop at $3.00; the sandwich at the general $4.00', [await raise('spongepop', 20), await raise('explorer', 20), await raise('louball', 20), await raise('cookie', 20)].join(), '300,300,300,400');
  await page.screenshot({ path: outDir + '/icecreams_price_cap.png' });
  check('...lowered one step the + is bright again', (await sc('Cooler', "(s.order.changePrice('eclair', -25), s.refresh(), s.order.slots[0].priceCents)")) + ' ' + (await plusAlpha('eclair')), '225 1');
  check('...an old save\'s higher price is brought down when the cooler opens', await (async () => { await ev("(e.coolerSlots[0].priceCents = 900, true)"); await sc('Cooler', '(s.scene.restart(), true)'); await wait(700); const got = (await ev('e.slots[0].priceCents')) + ' ' + (await sc('Cooler', 's.order.slots[0].priceCents')); for (const f of ['eclair', 'spongepop', 'explorer', 'cookie', 'louball']) await sc('Cooler', `(s.order.addOne('${f}'), true)`); await sc('Cooler', '(s.refresh(), true)'); return got; })(), '250 250');
  {
    // The price buttons on a small card still work (SpongePop: SCREAM-343 leaves it room under its $3.00).
    const [x, y] = await sc('Cooler', "(() => { const c = s.cards.find(c => c.flavour === 'spongepop').container; return [c.x + (156 - 16) * c.scaleX, c.y + 120 * c.scaleY]; })()");
    const was = await sc('Cooler', "s.order.slots.find(x => x.flavour === 'spongepop').priceCents");
    await page.mouse.click(x, y); await wait(150);
    check('...a small card\'s + still raises its price', (await sc('Cooler', "s.order.slots.find(x => x.flavour === 'spongepop').priceCents")) - was, 25);
  }
  // ---- SCREAM-335: the Drum Cone's note, and the cooler with all six ----
  check('SCREAM-335: the Drum Cone\'s note: $30, under the Lil Explorer Pop, with the PO\'s line and the $3.00 limit', await page.evaluate(async () => { const { POWER_UP_TREES } = await import('/src/config/powerUps.js'); const n = POWER_UP_TREES.find(t => t.id === 'icecream').notes.find(n => n.id === 'icecream-drumcone'); return [n.name, n.priceCents, n.col, n.row, n.from.join(), n.description].join(' | '); }), "DRUM CONE | 3000 | 2 | 2 | icecream-explorer | Drum solo reaches more of the neighborhood. The average person won't pay more than $3.00 for one. Costs you $1.00 each to stock.");
  check('...bought (the Explorer Pop is owned): $1.00 to stock (SCREAM-351), refused above $3.00', (await ev("e.buyPowerUp('icecream-drumcone')")) + ' ' + (await page.evaluate(async () => { const { getFlavour } = await import('/src/config/flavours.js'); const e = window.__game.registry.get('evening'); return getFlavour('drumcone').costCents + ' ' + e.refuseAboveCents('drumcone') + ' ' + e.slots.find(x => x.flavour === 'drumcone').priceCents; })), 'true 100 300 300');
  await sc('Cooler', '(s.scene.restart(), true)'); await wait(700);
  check('Six ice creams unlocked: six rows, all above the totals', await sc('Cooler', "s.offered.map(f => f.id).join() + ' ' + s.rowYs.join() + ' ' + (Math.max(...s.rowYs) + 20 < s.totals.y - 14)"), 'eclair,spongepop,explorer,cookie,louball,drumcone 140,182,224,266,308,350 true');
  for (const f of ['eclair', 'spongepop', 'explorer', 'cookie', 'louball', 'drumcone']) {
    const [x, y] = await sc('Cooler', `(() => { const b = s.addButtons.get('${f}'); return [b.x, b.y]; })()`);
    await page.mouse.click(x, y); await wait(120);
  }
  check("...Today's Menu shows six cards, all on the wall", await sc('Cooler', "(() => { const v = s.cards.filter(c => c.container.visible); const last = v[v.length - 1].container; return v.length + ' ' + (last.x + 156 * last.scaleX <= 941) + ' ' + v.map(c => c.flavour).join(); })()"), '6 true eclair,spongepop,explorer,cookie,louball,drumcone');
  await page.mouse.move(5, 5); await wait(150);
  await page.screenshot({ path: outDir + '/icecreams_cooler_six.png' });
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

  // ---- SCREAM-335: the Drum Cone's drum solo ----
  const music = (fn) => page.evaluate(`(async () => { const { musicFor } = await import('/src/audio/Music.js'); const m = musicFor(window.__game.scene.getScene('Drive')); return ${fn}; })()`);
  const radius0 = await ev('Math.round(e.spec.musicRadius * 100) / 100');
  check('Before a Drum Cone sale: the usual tune, the usual ring, no countdown', (await music('m.drumSolo')) + ' ' + (await ev('e.drumSolo')) + ' ' + (await drive('s.drumLabel.visible')) + ' ' + (await drive('Math.round(s.ring.radius * 100) / 100 === ' + radius0)), 'false false false true');
  check('SCREAM-335: a sale with a Drum Cone starts 30 seconds of drum solo (the usual tip, no reversed steering)', (await sell('drumcone')) + ' | solo ' + (await ev('e.drumSoloMs > 29000 && e.drumSoloMs <= 30000')), 'drumcone | factor 1 | tip 80 | reversed 0 | solo true');
  await wait(500);
  check('...the music is the drum solo and its name shows like a song\'s', (await music('m.drumSolo')) + ' | ' + (await drive('s.songLabel.text')), 'true | ♪ Drum Solo');
  check('...the music ring is 10% bigger, on the road and for who hears it', (await ev('Math.round(e.spec.musicRadius / ' + radius0 + ' * 100) / 100')) + ' ' + (await drive('Math.round(s.ring.radius / ' + radius0 + ' * 100) / 100')), '1.1 1.1');
  check('...a countdown says so, under where STEERING REVERSED goes', (await drive('s.drumLabel.visible')) + ' | ' + (await drive('/^DRUM SOLO  (29|30)$/.test(s.drumLabel.text)')) + ' | ' + (await drive('s.drumLabel.y > s.reversedLabel.y')), 'true | true | true');
  await page.screenshot({ path: outDir + '/icecreams_drum_solo.png' });
  check('...a second sale starts the 30 seconds again; it doesn\'t add up', (await sell('drumcone')) && (await ev('e.drumSoloMs > 29000 && e.drumSoloMs <= 30000')), true);
  check('...with the speaker upgrade the 10% is on top of it', await ev("(() => { const before = e.spec.musicRadius; e.powerUpsOwned.push('upgrade-speaker'); e.buyPowerUp('nothing'); return true; })()") && await page.evaluate(async () => { const { truckSpec } = await import('/src/state/TruckSpec.js'); const e = window.__game.registry.get('evening'); const base = truckSpec(true, e.powerUpsOwned).musicRadius; e.truckNow = truckSpec(true, e.powerUpsOwned); return Math.round((e.spec.musicRadius / base) * 100) / 100 + ' ' + (base > 170); }), '1.1 true');
  await ev('(e.drumSoloMs = 200, true)'); await wait(600);
  check('...when the 30 seconds run out the tune is back, the ring is its own size and the countdown goes', (await music('m.drumSolo')) + ' ' + (await ev('e.drumSolo')) + ' ' + (await drive('s.drumLabel.visible')) + ' ' + (await drive('Math.round(s.ring.radius) === Math.round(' + (await ev('e.truckNow.musicRadius')) + ')')) + ' ' + (await drive('s.songLabel.text !== "♪ Drum Solo"')), 'false false false true true');
  check('...a sale with both: double tip, reversed steering and the drum solo together', await page.evaluate(() => { const e = window.__game.registry.get('evening'); const before = e.coolerSlots.map(s => s.quantity); e.coolerSlots.forEach(s => { s.quantity = s.flavour === 'louball' || s.flavour === 'drumcone' ? 1 : 0; }); let sale; for (let i = 0; i < 40 && !(sale && sale.louBall && sale.drumCone); i++) { sale = e.startSale(); e.saleNow = null; e.setCustomerWaiting(false); } e.coolerSlots.forEach((s, i) => { s.quantity = before[i]; }); return sale.louBall + ' ' + sale.drumCone + ' ' + sale.tipFactor; }), 'true true 2');

  // ---- SCREAM-340: Back It Up ----
  {
    const before = await ev('e.spec.reverseSpeed');
    await page.evaluate(async () => { const { truckSpec } = await import('/src/state/TruckSpec.js'); const e = window.__game.registry.get('evening'); e.powerUpsOwned.push('back-it-up'); e.truckNow = truckSpec(true, e.powerUps); });
    check('SCREAM-340: with Back It Up the truck\'s top reverse speed is half as much again', Math.round((await ev('e.spec.reverseSpeed')) / before * 100) / 100, 1.5);
  }

  // ---- SCREAM-341: Better Mirrors ----
  {
    await ev('(e.residents.hearingOff = true, true)');
    const far = await drive("(() => { const e = window.__game.registry.get('evening'); const v = s.cameras.main.worldView; let best = -1, bd = 0; e.residents.all.forEach((p, i) => { const d = Math.hypot(p.x - s.truck.x, p.y - s.truck.y); const off = p.x < v.x - 60 || p.x > v.right + 60 || p.y < v.y - 60 || p.y > v.bottom + 60; if (off && p.customer === 'none' && d > bd && d < 900) { bd = d; best = i; } }); return best; })()");
    await ev(`(e.residents.callNow(e.residents.all[${far}]), true)`); await wait(400);
    const marker = (fn) => drive(`(() => { const m = s.mirrorMarkers.get(${far}); return ${fn}; })()`);
    check('Without Better Mirrors: a customer waiting off screen has no marker', (await ev(`e.residents.all[${far}].customer`)) + ' ' + (await marker('!!m && m.visible')), 'waiting false');
    await ev("(e.powerUpsOwned.push('better-mirrors'), true)"); await wait(300);
    check('SCREAM-341: with Better Mirrors that customer has a marker at the edge of the screen', await marker('!!m && m.visible'), true);
    check('...it sits just inside the view, clear of the labels and the gas dial', await drive(`(() => { const m = s.mirrorMarkers.get(${far}); const v = s.cameras.main.worldView; const dx = Math.min(m.x - v.x, v.right - m.x); const dy = Math.min(m.y - v.y, v.bottom - m.y); const dial = m.x - v.x < 175 && v.bottom - m.y < 119; return dx >= 23 && m.y - v.y >= 36 && v.bottom - m.y >= 81 && !dial; })()`), true);
    check('...its pointer aims at the customer', await drive(`(() => { const e = window.__game.registry.get('evening'); const m = s.mirrorMarkers.get(${far}); const p = e.residents.all[${far}]; const want = Math.atan2(p.y - 16 - m.y, p.x - m.x); const d = Math.abs(m.getByName('pointer').rotation - want); return Math.min(d, Math.PI * 2 - d) < 0.05; })()`), true);
    check('...and shows that customer\'s own face', await drive(`(async () => { const { residentFrame } = await import('/src/ui/residentLook.js'); const e = window.__game.registry.get('evening'); const m = s.mirrorMarkers.get(${far}); return m.getByName('head').frame.name === residentFrame(e.residents.all[${far}].resident.look, false, 'down', 0); })()`), true);
    await page.screenshot({ path: outDir + '/icecreams_better_mirrors.png' });
    check('...only customers on their way have one', await drive('[...s.mirrorMarkers.values()].filter(m => m.visible).length') <= await ev("e.residents.all.filter(p => p.customer === 'running' || p.customer === 'waiting').length"), true);
    await drive(`(() => { const e = window.__game.registry.get('evening'); const p = e.residents.all[${far}]; s.truck.setPosition(p.x + 60, p.y + 40); s.speed = 0; return true; })()`); await wait(2600);
    check('...when the customer is on screen the marker goes', await marker('m.visible'), false);
  }

  // ---- SCREAM-342: Story's chasing rules, and Speedy Neighbors ----
  {
    // One customer of a kind sets off after a truck that stays far away; time is stepped by hand.
    const chase = (kind, seconds) => page.evaluate(([kind, seconds]) => {
      const e = window.__game.registry.get('evening'); const res = e.residents; res.hearingOff = true;
      const plain = r => res.kindOf(r) !== 'regular'; // SCREAM-168: regulars have their own rules
      const is = { adult: r => !r.kid && plain(r), slowKid: r => r.kid && !r.fast && plain(r), fastKid: r => r.kid && r.fast, chaser: r => res.isChaser(r) && !r.fast }[kind];
      const p = res.all.find(q => q.customer === 'none' && is(q.resident) && !q.resident.hardToFind);
      const ring = { x: p.x + 5000, y: p.y + 5000, radius: 1, open: false };
      res.wantIceCream(p);
      let t = 0, path = 0, x = p.x, y = p.y;
      while (t < seconds - 1e-6 && p.customer === 'running') { res.update(0.1, ring); t += 0.1; path += Math.hypot(p.x - x, p.y - y); x = p.x; y = p.y; }
      const speed = path / t; const known = [37, 46.25, 55.5, 69.375].find(v => Math.abs(v - speed) < 1.5); // the path bends round houses, so the measured speed is a touch off
      return p.customer + ' after ' + Math.round(t) + ' s at ' + (known ?? speed.toFixed(1)) + ' px/s';
    }, [kind, seconds]);
    check('SCREAM-342: Story has the chasing rules on, and four fast kids in Elm Park', (await ev('e.residents.chaseRules')) + ' ' + (await ev("e.residents.all.filter(p => p.resident.fast).map(p => p.resident.id).join()")), 'true T007,T011,T017,T027');
    const gaveUp = await ev('e.residents.chaseGiveUps');
    check('...an adult follows the truck for 30 seconds, then goes home', await chase('adult', 60), 'done after 30 s at 37 px/s');
    check('...a slower kid gives up after 20 seconds', await chase('slowKid', 60), 'done after 20 s at 37 px/s');
    check('...a fast kid is quicker and is still following after a minute', await chase('fastKid', 60), 'running after 60 s at 55.5 px/s');
    check('...the two who gave up are counted', (await ev('e.residents.chaseGiveUps')) - gaveUp, 2);
    await page.evaluate(() => { const e = window.__game.registry.get('evening'); e.powerUpsOwned.push('speedy-neighbors'); for (const people of e.residentsByMap.values()) people.speedyFactor = e.speedyFactor; });
    check('SCREAM-342: with Speedy Neighbors an adult goes after the truck faster (still 30 seconds)', await chase('adult', 60), 'done after 30 s at 46.25 px/s');
    check('...so does a fast kid', await chase('fastKid', 20), 'running after 20 s at 69.375 px/s');
    check('...the slower kids are not: that is the "most"', await chase('slowKid', 60), 'done after 20 s at 37 px/s');

    // ---- SCREAM-168: 70% of regulars chase forever; the others wait at their own curb (no tell: the PO took the waving hand out) ----
    const regulars = await ev("(() => { const r = e.residents.all.map(p => p.resident).filter(r => e.residents.kindOf(r) === 'regular'); return r.length + ' regulars, ' + r.filter(x => e.residents.isChaser(x)).length + ' chase'; })()");
    check('SCREAM-168: 70% of Elm Park\'s regulars are picked to chase (the nearest whole number)', regulars, await ev("(() => { const n = e.residents.all.filter(p => e.residents.kindOf(p.resident) === 'regular').length; return n + ' regulars, ' + Math.round(n * 0.7) + ' chase'; })()"));
    check('...and nobody who is not a regular is picked', await ev("e.residents.all.filter(p => e.residents.isChaser(p.resident) && e.residents.kindOf(p.resident) !== 'regular').length"), 0);
    check('...a chasing regular is still following after two minutes', (await chase('chaser', 120)).replace(/ at .*/, ''), 'running after 120 s');
    const curb = await page.evaluate(() => {
      const e = window.__game.registry.get('evening'); const res = e.residents;
      const p = res.all.find(q => q.customer === 'none' && res.staysAtCurb(q.resident) && !q.resident.hardToFind);
      const ring = { x: p.x + 5000, y: p.y + 5000, radius: 1, open: false };
      res.wantIceCream(p);
      let t = 0;
      while (t < 60 && p.customer === 'running') { res.update(0.1, ring); t += 0.1; }
      const at = () => Math.round(Math.hypot(p.x - p.resident.curb[0], p.y - p.resident.curb[1]));
      const first = p.customer + ' ' + at() + ' px from their own curb';
      for (let k = 0; k < 100; k++) res.update(0.1, ring); // ten more seconds with the truck far away
      return first + '; ten seconds on: ' + p.customer + ' ' + at() + ' px';
    });
    check('SCREAM-168: a regular who does not chase waits at their own curb and stays there', curb, 'waiting 0 px from their own curb; ten seconds on: waiting 0 px');
    check('SCREAM-168: Quick play\'s rules are off: nobody chases forever or stays at their curb', await page.evaluate(() => { const e = window.__game.registry.get('evening'); const res = e.residents; res.chaseRules = false; const r = res.all.map(p => p.resident); const out = r.filter(x => res.chasesForever(x) || res.staysAtCurb(x)).length + ' ' + res.chaseSecondsOf(r[0]); res.chaseRules = true; return out; }), '0 Infinity');
  }

  console.log(`\n${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await browser.close();
})();
