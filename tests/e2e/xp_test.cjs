// SCREAM-395: XP. Earned in Story (not in Quick play, not while the uncle is with you) from sales,
// driving and a clean evening; shown as a pop-up and on the end-of-day screen; carried and saved
// with the run; spent on the cork board's XP tree (the hub suite buys with it).
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
  const scenes = () => page.evaluate(() => window.__game.scene.getScenes(true).map(s => s.scene.key).join(','));
  const flow = (call) => page.evaluate(`(async () => { const f = await import('/src/flow.js'); const s = window.__game.scene.getScenes(true)[0]; ${call}; return true; })()`);
  const wait = ms => page.waitForTimeout(ms);
  const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(50); } await wait(120); };
  const until = async (fn, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await wait(50); } return false; };
  let pass = 0, fail = 0;
  const check = (name, got, want) => { const ok = String(got) === String(want); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(68) + ' got=' + got + (ok ? '' : ' want=' + want)); };
  // A stand-in paid sale to one person (or nobody from the map), through the evening's own chargeForSale.
  // Returns the XP it earned. `tipPercent` 20 is the top step: a fast, correct price.
  const serve = (id, tipPercent = 0) => page.evaluate(async ([id, tipPercent]) => {
    const e = window.__game.registry.get('evening');
    const { Sale } = await import('/src/state/Sale.js');
    const s = new Sale([{ slot: 0, flavour: 'eclair', count: 1 }], 4, 0, false);
    s.phase = 'ordering'; s.order = [{ slot: 0, flavour: 'eclair', count: 1 }];
    e.servingNow = e.residents.all.find(p => p.resident.id === id) ?? null;
    e.saleNow = s; e.hintChance = 0; e.scheduleLineChance = 0;
    s.charge = () => { s.phase = 'over'; s.outcome = { kind: 'paid', priceCents: 0, tipCents: 0, tipPercent }; s.line = 'Thanks!'; return 'paid'; };
    const before = e.xp;
    e.chargeForSale(0);
    e.saleNow = null; e.servingNow = null;
    return e.xp - before;
  }, [id, tipPercent]);
  const xpLines = () => ev("e.xpEarned.lines.map(l => l.label + ' ' + l.count + 'x ' + l.points).join(' | ')");
  const popup = () => sc('Hud', 's.lastXpPopup');
  const tuning = (name) => page.evaluate(async (name) => (await import('/src/config/tuning.js'))[name], name);
  const [NEW, REG, HARD, WALK, FAST, DENTS, STEPS, DIST] = await Promise.all(['XP_NEW_PERSON', 'XP_REGULAR', 'XP_HARD_TO_FIND', 'XP_WALKER', 'XP_FAST_PRICE', 'XP_NO_DENTS', 'XP_SERVED_STEPS', 'XP_DISTANCE_STEPS_PX'].map(tuning));
  const stepXp = (n) => (STEPS.find(([at]) => at === n) ?? [0, 0])[1];

  // ---- Quick play: no XP at all (PO: "No xp in quickplay") ----
  await page.click('canvas'); await press('Enter'); await wait(400);
  check('Quick play: XP is off', (await ev('e.xpOn')) + ' ' + (await ev('e.xp')), 'false 0');
  check('...a sale earns none', await serve(await ev('e.residents.all[0].resident.id'), 20), 0);
  check('...driving earns none', await ev('(e.burnFuel(600), e.xp)'), 0);
  await ev('(e.endNow(), true)'); await wait(600);
  check('...and a clean evening earns none', (await ev('e.xp')) + ' ' + (await ev('e.xpEarned.total')), '0 0');

  // ---- Story with the uncle: none while he is with you; from when he leaves (or is skipped), yes ----
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  await page.click('canvas'); await wait(200);
  await flow('f.startStory(s, true)');
  await until(async () => (await ev('!!e && !!e.tutorial')) === true);
  check('PO: "No xp when the uncle is with you": off on his evening', (await ev('e.tutorial.step')) + ' ' + (await ev('e.xpOn')), 'stock false');
  check('...his evening earns nothing from a sale or from driving', (await serve(await ev('e.residents.all[0].resident.id'), 20)) + ' ' + (await ev('(e.burnFuel(600), e.xp)')), '0 0');
  await ev('(e.tutorial.skip(), true)'); await wait(150);
  check('PO: "but once he leaves then you can": on once he is gone', (await ev('e.tutorial.skipped')) + ' ' + (await ev('e.xpOn')), 'true true');
  check('...driving now earns the first distance step', await ev('(e.burnFuel(' + DIST[0] + '), e.xp)'), 1);

  // ---- Story, on my own ----
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  await page.click('canvas'); await wait(200);
  await page.evaluate(() => localStorage.removeItem('icemachine.story.v2'));
  await flow('f.startStory(s, false)');
  await until(async () => (await scenes()).includes('StoryIntro')); await press('Enter');
  await until(async () => (await scenes()).includes('Cooler')); await wait(300);
  check('A new Story starts with no XP, and XP is on', (await ev('e.xp')) + ' ' + (await ev('e.xpOn')), '0 true');
  const ids = await ev("(() => { const k = (p) => e.residents.kindOf(p.resident); const a = e.residents.all; const pick = (f) => (a.find(f) ?? {resident:{id:''}}).resident.id; return [pick(p => k(p) === 'regular' && !p.resident.walker && !p.resident.hardToFind), pick(p => p.resident.walker), pick(p => p.resident.hardToFind), pick(p => k(p) === 'sometimes' && !p.resident.walker && !p.resident.hardToFind && !p.resident.visitor)].join(); })()");
  const [regular, walker, hard, sometimes] = ids.split(',');
  check('The map has a regular, a walker, a hard-to-find customer and a some-days customer to serve', [regular, walker, hard, sometimes].every(Boolean), true);
  // First sale of the evening, to a regular never served: the step for 1 customer, a new face, a regular.
  check('First sale, a regular: customers step 1 + new face + regular', await serve(regular), stepXp(1) + NEW + REG);
  await wait(100);
  check('...shown as one pop-up', await popup(), `+${stepXp(1) + NEW + REG} XP Sale`);
  await page.screenshot({ path: outDir + '/xp_popup.png' });
  check('Second sale, the same regular: only the regular\'s XP (2 is no step, no new face)', await serve(regular), REG);
  check('Third sale, a walker: customers step 3 + new face + walker', await serve(walker), stepXp(3) + NEW + WALK);
  check('Fourth, a hard-to-find customer (big): new face + hard to find', await serve(hard), NEW + HARD);
  check('Fifth, a some-days customer with a fast correct price: step 5 + new face + fast price', await serve(sometimes, 20), stepXp(5) + NEW + FAST);
  check('...a slow price (a lower tip step) earns no fast-price XP', await serve(sometimes, 15), 0);
  check('...a stand-in customer from nowhere earns nothing but the count', await serve('nobody'), 0);
  const fromSales = stepXp(1) + stepXp(3) + stepXp(5) + NEW * 4 + REG * 2 + WALK + HARD + FAST;
  check('The XP in hand is the sum', await ev('e.xp'), fromSales);
  // Distance: steps of the evening's driving.
  check('PO: "distance driven ... 100px, 250px, so on": 99 px is nothing, 100 is the first step', (await ev('(e.burnFuel(' + (DIST[0] - 1) + '), e.xp)')) - fromSales + ' ' + ((await ev('(e.burnFuel(1), e.xp)')) - fromSales), '0 1');
  check('...one long stretch passes several steps at once', (await ev('(e.burnFuel(' + (DIST[3] - DIST[0]) + '), e.xp)')) - fromSales, 4);
  check('...shown as a pop-up too', await popup(), '+1 XP Distance');
  check('The list for the end of the day, biggest first', await xpLines(), [['Hard to find', 1, HARD], ['New faces', 4, NEW * 4], ['Customers', 3, stepXp(1) + stepXp(3) + stepXp(5)], ['Regulars', 2, REG * 2], ['Walkers', 1, WALK], ['Distance', 4, 4], ['Fast prices', 1, FAST]].sort((a, b) => b[2] - a[2]).map(l => `${l[0]} ${l[1]}x ${l[2]}`).join(' | '));
  // The evening ends with no dents.
  const before = await ev('e.xp');
  await ev('(e.endNow(), true)');
  await until(async () => (await scenes()).includes('DayEnd'));
  await wait(300);
  check('PO: "an evening with no dents": XP at the end of a clean evening', (await ev('e.xp')) - before, DENTS);
  check('The end-of-day screen tells tonight\'s XP and the XP to spend', await sc('DayEnd', 's.xpLine'), `XP earned: +${before + DENTS}   XP to spend: ${before + DENTS}`);
  check('...and where it came from', (await sc('DayEnd', "s.children.getByName('xp-from').text")).startsWith(`Hard to find +${HARD} · New faces +${NEW * 4}`), true);
  check('...the message sits under it, clear of the footer', await sc('DayEnd', "(() => { const from = s.children.getByName('xp-from').getBounds(), m = s.children.getByName('day-message').getBounds(), f = s.children.getByName('continue-hint').getBounds(); return m.top >= from.bottom + 8 && m.bottom <= f.top; })()"), true);
  await page.screenshot({ path: outDir + '/xp_day_end.png' });
  check('The run carries it, and it is saved', (await page.evaluate(() => window.__game.registry.get('story').xp)) + ' ' + (await page.evaluate(() => JSON.parse(localStorage.getItem('icemachine.story.v2')).xp)), `${before + DENTS} ${before + DENTS}`);
  await wait(900); await press('Enter');
  await until(async () => (await ev('!!e && !e.ended')) === true);
  check('Day 2 starts with it', (await page.evaluate(() => window.__game.registry.get('story').day)) + ' ' + (await ev('e.xp')) + ' ' + (await ev('e.xpEarned.total')), `2 ${before + DENTS} 0`);
  check('...yesterday\'s customer is no new face today, but the evening\'s first customer step counts again', await serve(regular), stepXp(1) + REG);
  // A dented evening earns no clean-evening XP.
  const day2 = await ev("(e.burnFuel(50), e.takeDamage(100, 'Damage'), e.xp)");
  await ev('(e.endNow(), true)');
  await until(async () => (await scenes()).includes('DayEnd')); await wait(200);
  check('A dented evening earns no no-dents XP', (await ev('e.xp')) - day2, 0);
  // Continue from the save: the XP comes back; a new Story starts at 0 with nothing unlocked.
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  await page.click('canvas'); await wait(200);
  await flow('f.continueStory(s)');
  await until(async () => (await ev('!!e && !e.ended')) === true);
  check('Continue: day 3 with the saved XP', (await page.evaluate(() => window.__game.registry.get('story').day)) + ' ' + (await ev('e.xp')), `3 ${day2}`);
  // An evening where the truck never left home earns no no-dents XP.
  await ev('(e.endNow(), true)');
  await until(async () => (await scenes()).includes('DayEnd')); await wait(200);
  check('An evening spent at home earns no no-dents XP', await ev('e.xp'), day2);
  await flow('f.startStory(s, false)');
  await until(async () => (await scenes()).includes('StoryIntro')); await press('Enter');
  await until(async () => (await scenes()).includes('Cooler')); await wait(300);
  check('PO: "Should reset, as well as all powerups unlocked": a new Story starts at 0 XP with no power-ups', (await ev('e.xp')) + ' [' + (await ev('e.powerUps.join()')) + ']', '0 []');

  console.log(`xp: ${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(" / ") : "none"}`);
  await browser.close();
  process.exit(fail || errors.length ? 1 : 0);
})();
