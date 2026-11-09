// SCREAM-19: Story mode's wallet. Cash and stock carry from one evening to the
// next, Restart evening goes back to how tonight started, running out of money
// is game over, and Quick play is unchanged.
// SCREAM-17: the run is saved at the end of each evening; Continue and New story.
// SCREAM-18: the bike story: intro screen, bike goal, end of run with the Story high scores.
// SCREAM-205, SCREAM-85: on the tutorial map, 5 days, $50 to start, a $600 bike. These play
// On My Own (the uncle's Day 1 is in the tutorial suite).
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
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  const ev = (fn) => page.evaluate(`(() => { const e = window.__game.registry.get('evening'); return ${fn}; })()`);
  const story = (fn) => page.evaluate(`(() => { const r = window.__game.registry.get('story'); return ${fn}; })()`);
  const sc = (key, fn) => page.evaluate(`(() => { const s = window.__game.scene.getScene('${key}'); return ${fn}; })()`);
  const texts = (key) => sc(key, "s.children.list.filter(o => o.type === 'Text').map(o => o.text).join(' | ')");
  const scenes = () => page.evaluate(() => window.__game.scene.getScenes(true).map(s => s.scene.key).join(','));
  const wait = ms => page.waitForTimeout(ms);
  const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(60); } await wait(150); };
  const shift = async (d) => { await page.keyboard.down('Shift'); await page.keyboard.press('Digit' + d); await page.keyboard.up('Shift'); await wait(300); };
  const hudClock = () => sc('Hud', 's.clockText.text');
  const saved = () => page.evaluate(() => { const r = localStorage.getItem('icemachine.story.v2'); if (!r) return 'none'; const d = JSON.parse(r); return d.day + ' ' + d.cashCents + ' ' + d.slots.map(s => s.quantity).join('/'); });
  let pass = 0, fail = 0;
  const check = (name, got, want) => { const ok = String(got) === String(want); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(68) + ' got=' + got + (ok ? '' : ' want=' + want)); };

  // ---- Title: two modes ----
  await page.click('canvas'); await wait(200);
  const title = await texts('Title');
  check('Title shows Quick play (picked) and Story', /> Quick Play </.test(title) && /Story/.test(title), true);
  await press('ArrowDown');
  check('Down arrow picks Story', /> Story </.test(await texts('Title')), true);
  await page.screenshot({ path: outDir + '/story_title.png' });
  // SCREAM-107: the truck drives around the opening screen, trailing music notes.
  const tx0 = await sc('Title', "Math.round(s.children.getByName('title-truck').x)"); await page.waitForTimeout(400);
  const tx1 = await sc('Title', "Math.round(s.children.getByName('title-truck').x)");
  check('Title: the ice cream truck drives across the screen (SCREAM-107)', tx0 !== tx1, true);
  check('...trailing music notes', await sc('Title', "s.children.list.some(o => o.name === 'title-note')"), true);
  check('...in its lanes, clear of the menu', await sc('Title', "(() => { const t = s.children.getByName('title-truck'); const top = t.y - t.displayHeight / 2, bottom = t.y + t.displayHeight / 2; return s.modeTexts.every(m => m.y + m.height / 2 < top || m.y - m.height / 2 > bottom); })()"), true);
  // SCREAM-90: the mouse. Pointing at an option picks it.
  const optionAt = (label) => sc('Title', `(() => { const t = s.modeTexts.find(o => o.text.includes('${label}')); return [Math.round(t.x), Math.round(t.y)]; })()`);
  const [qx, qy] = await optionAt('Quick Play');
  await page.mouse.move(qx, qy); await wait(150);
  check('Mouse over Quick play picks it', /> Quick Play </.test(await texts('Title')), true);
  const [sx, sy] = await optionAt('Story');
  await page.mouse.move(sx, sy); await wait(150);
  check('Mouse over Story picks it', /> Story </.test(await texts('Title')), true);
  await page.mouse.move(5, 5); await wait(100);

  // ---- SCREAM-205: tutorial done, so a new Story asks about the uncle ----
  await press('Enter'); await wait(300);
  check('Story: asks With Uncle / On My Own', (await sc('Title', 's.confirming && s.asking')) + ' ' + /With Uncle \(U\)/.test(await texts('Title')) + ' ' + /On My Own \(O\)/.test(await texts('Title')), 'uncle true true');
  await page.screenshot({ path: outDir + '/story_uncle_choice.png' });
  await press('Escape');
  check('...Esc closes it, still on the title', (await sc('Title', 's.confirming')) + ' ' + (await scenes()), 'false Title');

  // ---- SCREAM-18: the intro ----
  await press('Enter'); await wait(200); await press('o'); await wait(300);
  const intro = await texts('StoryIntro');
  check('A new story opens with the intro screen', await scenes(), 'StoryIntro');
  check('...about the $600 bike and school in 5 days, marked as a placeholder', /\$600\.00/.test(intro) && /School starts in 5 days/.test(intro) && /Placeholder/.test(intro), true);
  await page.screenshot({ path: outDir + '/story_intro.png' });

  // ---- Day 1 ----
  await press('Enter'); await wait(300);
  check('Enter: day 1 starts at the cooler', (await scenes()).startsWith('Cooler'), true);
  check('Story starts on day 1 of 5', await story('r.day + "/" + r.days'), '1/5');
  check('Story starts with $50', await ev('e.moneyCents'), 5000);
  check('...on the tutorial map, without the uncle (On My Own)', (await ev('e.mapId')) + ' ' + (await ev('e.tutorial === null')), 'tutorial true');
  check('HUD shows the day beside the clock', /Day 1\/5/.test(await hudClock()), true);
  check('Top bar no longer shows the bike (end-of-day screen only)', /Bike/.test(await hudClock()), false);
  // SCREAM-88: only Shift+3 shows, to the right of the day, not on top of it.
  check('Debug hint shows only Shift+3: end evening', await sc('Hud', 's.debugText.text'), 'DEBUG Shift+3: End Evening');
  check('...and starts right of the clock and day', await sc('Hud', 's.debugText.x > s.clockText.x + s.clockText.width'), true);
  // ---- SCREAM-103: hints about big regulars after tipped sales (the rules, on a stand-in sale) ----
  const hint = (paid, chance = 1) => page.evaluate(async ([paid, chance]) => {
    const e = window.__game.registry.get('evening');
    const { Sale } = await import('/src/state/Sale.js');
    const s = new Sale([{ slot: 0, flavour: 'eclair', count: 1 }], 4, 0, false);
    s.phase = 'over'; s.outcome = { kind: 'paid', priceCents: 200, tipCents: 20, tipPercent: 10 }; s.line = 'Thanks!';
    e.paidSales = paid; e.hintChance = chance;
    e.maybeHint(s);
    return s.hintAbout ? s.hintAbout + '|' + s.line : 'none';
  }, [paid, chance]);
  const hinters = await ev("[...e.hintFor.keys()].sort().join(',')");
  check('Hints: the 4 Hinted regulars on the tutorial map each have one line this run', hinters, 'T003,T015,T024,T034');
  const day1Hints = await ev("JSON.stringify([...e.hintFor.entries()].sort())");
  check('...none before the 3rd paid sale', await hint(2), 'none');
  check('...none when the dice say no', await hint(3, 0), 'none');
  const h1 = await hint(3);
  check('...the 3rd paid sale can give one, after the thanks', /^T0\d\d\|Thanks! .+$/.test(h1), true);
  check("...and it's that regular's line for this run", await ev(`e.hintFor.get('${h1.split('|')[0]}')`) === h1.split('|')[1].replace(/^Thanks! /, ''), true);
  check('...none again until 4 more paid sales', await hint(6), 'none');
  const h2 = await hint(7);
  check('...then a second one, about somebody else', h2 !== 'none' && h2.split('|')[0] !== h1.split('|')[0], true);
  check('...and no more than 2 a night', await hint(20), 'none');
  check('...Shift+6 (debug): the next tipped sale gives one anyway', await page.evaluate(async () => {
    const e = window.__game.registry.get('evening');
    const { Sale } = await import('/src/state/Sale.js');
    e.hintsGiven.length = 0; e.lastHintAtSale = -Infinity; e.forceHint = true;
    const s = new Sale([{ slot: 0, flavour: 'eclair', count: 1 }], 4, 0, false);
    s.phase = 'over'; s.outcome = { kind: 'paid', priceCents: 200, tipCents: 20, tipPercent: 10 }; s.line = 'Thanks!';
    e.paidSales = 1; e.hintChance = 0; e.maybeHint(s);
    const out = (s.hintAbout !== null) + ' ' + e.forceHint;
    e.hintsGiven.length = 0; e.hintChance = 0.35;
    return out;
  }), 'true false');
  check('...never about the customer at the window', await page.evaluate(async () => {
    const e = window.__game.registry.get('evening');
    const { Sale } = await import('/src/state/Sale.js');
    const kev = e.residents.all.find(p => p.resident.id === 'T034');
    let aboutSelf = false;
    for (let i = 0; i < 30; i++) {
      e.hintsGiven.length = 0; e.paidSales = 3; e.servingNow = kev;
      const s = new Sale([{ slot: 0, flavour: 'eclair', count: 1 }], 4, 0, false);
      s.phase = 'over'; s.outcome = { kind: 'paid', priceCents: 200, tipCents: 20, tipPercent: 10 }; s.line = 'Thanks!';
      e.lastHintAtSale = -Infinity; e.maybeHint(s);
      if (s.hintAbout === 'T034') aboutSelf = true;
    }
    e.servingNow = null; e.hintsGiven.length = 0; e.paidSales = 0; e.lastHintAtSale = -Infinity;
    return aboutSelf;
  }), false);

  // ---- SCREAM-145: a regular's second visit tells the way to the other neighbourhood (stand-in sales) ----
  const serve = (id, tip = 0) => page.evaluate(async ([id, tip]) => {
    const e = window.__game.registry.get('evening');
    const { Sale } = await import('/src/state/Sale.js');
    const s = new Sale([{ slot: 0, flavour: 'eclair', count: 1 }], 4, 0, false);
    s.phase = 'ordering'; s.order = [{ slot: 0, flavour: 'eclair', count: 1 }];
    e.servingNow = e.residents.all.find(p => p.resident.id === id);
    e.saleNow = s; e.hintChance = 0;
    s.charge = () => { s.phase = 'over'; s.outcome = { kind: 'paid', priceCents: 0, tipCents: tip, tipPercent: 0 }; s.line = 'Thanks!'; return 'paid'; }; // $0, so the wallet checks below hold
    e.chargeForSale(0);
    e.saleNow = null; e.servingNow = null;
    return (s.toldAboutRotary ? 'told' : 'quiet') + '|' + s.line;
  }, [id, tip]);
  const regulars = await ev("e.residents.all.filter(p => p.resident.likelihood >= 0.5).map(p => p.resident.id).slice(0, 3).join(',')");
  const [r1, r2, r3] = regulars.split(',');
  const sometimes = await ev("e.residents.all.find(p => p.resident.likelihood > 0 && p.resident.likelihood < 0.5).resident.id");
  check('Rotary hint: first visits say nothing', (await serve(r1)).split('|')[0] + ' ' + (await serve(r2)).split('|')[0] + ' ' + (await serve(sometimes)).split('|')[0], 'quiet quiet quiet');
  check('...visits are counted per person', await ev(`e.visits['${r1}'] + ' ' + e.visits['${sometimes}']`), '1 1');
  check('...the first regular served twice says nothing', (await serve(r1)).split('|')[0], 'quiet');
  check('...a sometimes buyer served twice says nothing (not a regular)', (await serve(sometimes)).split('|')[0], 'quiet');
  const told = await serve(r2);
  check('...the second regular served twice tells the trick, after the thanks', /^told\|Thanks! Psst, .*Highland Street three times/.test(told), true);
  check('...once per run: a third regular served twice says nothing', (await serve(r3)) && (await serve(r3)).split('|')[0], 'quiet');
  check('...and no big-regular hint on top of it in the same breath', /Here's a hint/.test(told), false);
  check('...marked as given', (await ev('e.rotaryHintGiven')) + ' ' + (await ev('e.secondVisits.join(",")')), 'true ' + r1 + ',' + r2 + ',' + r3);

  await press('+', 3); await press('Enter'); await wait(300);
  check('Bought 3 ice creams ($3)', (await ev('e.moneyCents')) + ' ' + (await ev('e.stockLeft')), '4700 3');
  await shift(3); await wait(300);
  check('Day 1 over: end-of-day screen, not the results screen', await scenes(), 'DayEnd');
  const day1 = await texts('DayEnd');
  check('...it says END OF DAY 1 and shows the wallet', /END OF DAY 1/.test(day1) && /WALLET/.test(day1) && /\$47\.00/.test(day1), true);
  check('...and the ice creams left', /Ice creams left: 3/.test(day1), true);
  check('...and Enter starts day 2', /Enter: Start Day 2/.test(day1), true);
  check('...and says Game saved', /Game saved/.test(day1), true);
  check('...and the largest sale (none on a day with no sales, SCREAM-93)', /Largest sale: none yet/.test(day1), true);
  check('...and shows the Bike $600.00 badge', /Bike\n\$600\.00/.test(day1), true);
  check('Saved: day 2, $47, 3 bars in the first slot', await saved(), '2 4700 3/0/0/0');
  check('...and where each ice cream sits (SCREAM-131): 48 squares, 3 eclairs', await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('icemachine.story.v2')); return d.cells.length + ' ' + d.cells.filter(c => c === 'eclair').length; }), '48 3');
  await page.screenshot({ path: outDir + '/story_day_end.png' });

  // ---- Day 2: cash and stock carried over ----
  await press('Enter'); await wait(300);
  check('Day 2 opens at the cooler', (await scenes()).startsWith('Cooler'), true);
  check('Cash carried over ($47)', await ev('e.moneyCents'), 4700);
  check('Stock carried over (3 bars, same flavour)', await ev('e.coolerSlots[0].quantity + " " + e.coolerSlots[0].flavour'), '3 eclair');
  check("Tonight's profit starts at $0", await ev('e.profitCents'), 0);
  check('HUD says Day 2/5', /Day 2\/5/.test(await hudClock()), true);
  check('Visits and the rotary hint carried over to day 2 (SCREAM-145)', (await ev(`e.visits['${r1}']`)) + ' ' + (await ev('e.rotaryHintGiven')) + ' ' + (await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('icemachine.story.v2')); return d.rotaryHintGiven + ' ' + Object.keys(d.visits).length; })), '2 true true 4');
  check('Hints (PO): each regular keeps the same line on day 2 as on day 1', await ev("JSON.stringify([...e.hintFor.entries()].sort())"), day1Hints);
  check('High scores untouched by Story', await page.evaluate(() => localStorage.getItem('icemachine.highscores.v1')), 'null');

  // ---- SCREAM-145: the roundabouts join Elm Park (tutorial) and Foley Stadium (worcester) in Story ----
  await press('+'); await press('Enter'); await wait(300);
  check('Bought 1 more on day 2', (await ev('e.moneyCents')) + ' ' + (await ev('e.stockLeft')), '4600 4');
  await press('ArrowRight'); await press('Enter'); await wait(600);
  check('Roundabouts: on the road in Elm Park, with a roundabout', (await scenes()) + ' ' + (await sc('Drive', 's.laps !== null')), 'Drive,Hud true');
  check('...the roundabouts lead somewhere in Story, home is Elm Park', (await ev('e.mapsJoined')) + ' ' + (await ev('e.homeMapId')) + ' ' + (await ev('e.awayFromHome')), 'true tutorial false');
  const ring = await sc('Drive', "JSON.stringify(s.laps.ring)");
  check('...Elm Park\'s roundabout is at the west end of Highland Street', JSON.parse(ring).x < 300 && JSON.parse(ring).y > 2100, true);
  // Drive round it by moving the truck along the ring (the camera glides after it).
  const lapRing = (laps, step = 15) => page.evaluate(async ([laps, step]) => {
    const s = window.__game.scene.getScene('Drive');
    const r = s.laps.ring;
    // A little over, since the count starts from wherever the truck was first seen on the ring.
    for (let d = 0; d <= laps * 360 + 30; d += step) {
      const a = d * Math.PI / 180;
      s.truck.setPosition(r.x + r.r * Math.cos(a), r.y + r.r * Math.sin(a));
      await new Promise(f => setTimeout(f, 20));
    }
    return true;
  }, [laps, step]);
  await lapRing(2); await wait(100);
  check('...two laps: still in Elm Park, 2 of 3 counted, nothing shown on screen (PO)', (await ev('e.mapId')) + ' ' + (await sc('Drive', 's.lapsDone + " " + s.lapLabel.visible + " " + s.lapLabel.text')), 'tutorial 2 false 2 / 3 laps');
  await sc('Drive', "(s.truck.setPosition(s.laps.ring.x + 600, s.laps.ring.y), true)"); await wait(100);
  check('...driving off the roundabout starts the count again', await sc('Drive', 's.lapsDone + " " + s.lapLabel.text'), '0 ');
  const clockBefore = await ev('e.nowMs');
  const cashBefore = await ev('e.moneyCents');
  await lapRing(3); await wait(1500);
  check('Three laps: the truck is in Foley Stadium', (await ev('e.mapId')) + ' ' + (await ev('e.mapSwitches')), 'worcester 1');
  check('...the top bar names the neighbourhood', /Day 2\/5  Foley Stadium/.test(await hudClock()), true);
  check('...on the road there, on Newton Square (the roundabout)', (await scenes()) + ' ' + (await sc('Drive', "(() => { const r = s.laps.ring; return Math.round(Math.hypot(s.truck.x - r.x, s.truck.y - r.y)) === r.r; })()")), 'Drive,Hud true');
  check('...Newton Square is at the top of the map', await sc('Drive', 's.laps.ring.y < 600'), true);
  check('...Foley Stadium\'s own people are out (sheet 15), with their state kept apart from Elm Park\'s', await ev("e.residents.all.length > 100 && e.residents.all.every(p => !p.resident.id.startsWith('T'))"), true);
  check('...the clock and the cash carried on', (await ev('e.nowMs') >= clockBefore) + ' ' + (await ev('e.moneyCents')), 'true ' + cashBefore);
  check('...still Day 2 of the same run', await story('r.day'), 2);
  check('...away from home: no driveway here, the way home is the roundabout', (await ev('e.awayFromHome')) + ' ' + (await sc('Drive', 's.homeBay.visible')), 'true false');
  await ev('(e.coolerSlots.forEach(sl => sl.quantity = 0), e.syncCells(), true)'); await wait(200);
  check('...sold out: the HOME arrow points at Newton Square, not at Foley\'s driveway', await sc('Drive', "(() => { const r = s.laps.ring; const a = s.homeArrow; const v = s.cameras.main.worldView; return a.visible && Math.hypot(a.x - r.x, a.y - (r.y - 70)) < 40 || !Phaser.Geom.Rectangle.Contains(v, r.x, r.y); })()"), true);
  await ev('(e.coolerSlots[0].quantity = 4, e.syncCells(), true)');
  await lapRing(3); await wait(1500);
  check('Three laps of Newton Square: back home in Elm Park', (await ev('e.mapId')) + ' ' + (await ev('e.mapSwitches')) + ' ' + (await ev('e.awayFromHome')), 'tutorial 2 false');
  check('...on Elm Park\'s roundabout, Elm Park\'s people as they were', await ev("e.residents.all.every(p => p.resident.id.startsWith('T'))"), true);
  check('...the driveway works again', await sc('Drive', 's.homeBay.visible'), true);
  check('...the top bar says Elm Park again', /Elm Park/.test(await hudClock()), true);
  await page.screenshot({ path: outDir + '/story_roundabout.png' });
  await press('Escape'); await wait(200); await press('ArrowDown'); await press('Enter'); await wait(150);
  await press('y'); await wait(400);
  check('Restart evening: back at the cooler', (await scenes()).startsWith('Cooler'), true);

  // ---- Restart evening goes back to how tonight started ----
  await press('+'); await press('Enter'); await wait(300);
  check('Bought 1 more on day 2', (await ev('e.moneyCents')) + ' ' + (await ev('e.stockLeft')), '4600 4');
  await press('Escape'); await wait(200); await press('ArrowDown'); await press('Enter'); await wait(150);
  check('Restart prompt explains Story restarts', /Cash, stock and gas go back/.test(await texts('Pause')), true);
  // SCREAM-89: the question stays inside the pause box (420 px wide, centred).
  check('...and fits inside the pause box', await sc('Pause', 's.prompt.width <= 410'), true);
  await page.screenshot({ path: outDir + '/story_pause_restart.png' });
  await press('y'); await wait(400);
  check('Restart: back to $47 and 3 bars, still day 2', (await ev('e.moneyCents')) + ' ' + (await ev('e.stockLeft')) + ' ' + (await story('r.day')), '4700 3 2');

  // ---- Days 3 and 4, then day 5, the last ----
  await shift(3); await press('Enter'); await wait(300);
  check('Day 3 starts', await story('r.day'), 3);
  await shift(3); await press('Enter'); await wait(300);
  await shift(3); await press('Enter'); await wait(300);
  check('Day 5 starts, the last', (await story('r.day')) + ' ' + /Day 5\/5/.test(await hudClock()), '5 true');
  await shift(3); await wait(300);
  const last = await texts('DayEnd');
  check('After day 5: STORY COMPLETE', /STORY COMPLETE/.test(last), true);
  check('...short of the bike ($47 of $600: $553 short)', /\$553\.00 short of the bike/.test(last), true);
  check('...Enter goes to the Story high scores', /Enter: Story High Scores/.test(last), true);
  await press('Enter'); await wait(300);
  check('Story results screen', await scenes(), 'Results');
  const runRes = await texts('Results');
  check('...run stats: 5 days, $3 stock, final cash $47, no bike', /5 DAYS/.test(runRes) && /-\$3\.00/.test(runRes) && /Final cash/.test(runRes) && /\$47\.00/.test(runRes) && /Maybe Next Summer/.test(runRes), true);
  // SCREAM-94: short of the bike, the F stamp lands (after a short pause).
  await wait(1000);
  check('...the F stamp is on screen, landed', await sc('Results', "(() => { const f = s.children.getByName('f-stamp'); return !!f && f.scale === 1 && f.alpha > 0.8; })()"), true);
  check('...and no victory truck', await sc('Results', "!s.children.getByName('victory-truck')"), true);
  await page.screenshot({ path: outDir + '/story_results_f.png' });
  check('...first Story score: asks for initials', await sc('Results', 's.entering'), true);
  await page.keyboard.type('CON', { delay: 80 }); await press('Enter'); await wait(200); // typed at a person's pace
  check('...saved to the Story table, not the Quick play one',
    await page.evaluate(() => { const st = JSON.parse(localStorage.getItem('icemachine.highscores.story.v2') || '[]'); return st.map(x => x.initials + x.scoreCents).join() + ' ' + localStorage.getItem('icemachine.highscores.v1'); }), 'CON4700 null');
  check('...STORY HIGH SCORES, Enter: back to the title', /STORY HIGH SCORES/.test(await texts('Results')) && /Enter: Back To The Title/.test(await texts('Results')), true);
  await page.screenshot({ path: outDir + '/story_results.png' });
  await press('Enter'); await wait(300);
  check('Back at the title, Story run cleared', (await scenes()) + ' ' + (await story('r')), 'Title null');
  check('Run complete: the save is cleared', await saved(), 'none');
  check('...so the title offers Story, not Continue', /Continue/.test(await texts('Title')), false);

  // ---- Out of money: game over ----
  await press('ArrowDown'); await press('Enter'); await wait(300); await press('o'); await wait(300);
  await press('Enter'); await wait(300); // past the intro
  await ev('(e.cashCents = -100, true)');
  await shift(3); await wait(300);
  const over = await texts('DayEnd');
  check('Below $0 at the end of an evening: GAME OVER', /GAME OVER/.test(over) && /out of money/.test(over), true);
  check('...the run is over', await story('r.outcome'), 'broke');
  check('...and nothing is saved', await saved(), 'none');
  await page.screenshot({ path: outDir + '/story_game_over.png' });
  await press('Enter'); await wait(300);
  check('...Enter: back to the title', await scenes(), 'Title');

  // Empty cooler and less than the cheapest bar ($1): game over too.
  await press('ArrowDown'); await press('Enter'); await wait(300); await press('o'); await wait(300);
  await press('Enter'); await wait(300); // past the intro
  await ev('(e.cashCents = 50, true)');
  await shift(3); await wait(300);
  check('Empty cooler and $0.50: GAME OVER', /GAME OVER/.test(await texts('DayEnd')), true);
  await press('Enter'); await wait(300);
  // ...but with stock left, $0.50 isn't game over: you can still sell.
  await press('ArrowDown'); await press('Enter'); await wait(300); await press('o'); await wait(300);
  await press('Enter'); await wait(300); // past the intro
  await press('+', 2); await press('Enter'); await wait(300);
  await ev('(e.cashCents = 50, true)');
  await shift(3); await wait(300);
  check('$0.50 with 2 bars left: carries on to day 2', /END OF DAY 1/.test(await texts('DayEnd')), true);

  // ---- Quitting a Story run from the pause menu ----
  await press('Enter'); await wait(300); await press('Enter'); await wait(300);
  await press('Escape'); await wait(200); await press('ArrowDown', 2); await press('Enter'); await wait(150);
  check('Quit prompt says Continue picks up at the start of this evening', /Continue picks up at\s+the start of this evening/.test(await texts('Pause')), true);
  check('...and fits inside the pause box', await sc('Pause', 's.prompt.width <= 410'), true);
  await press('y'); await wait(300);
  check('Quit: title, Story run cleared', (await scenes()) + ' ' + (await story('r')), 'Title null');

  // ---- SCREAM-17: Continue ----
  const withSave = await texts('Title');
  check('Title offers Continue story (Day 2, $0.50) and New story', /Continue Story: Day 2, \$0\.50/.test(withSave) && /New Story/.test(withSave), true);
  await page.screenshot({ path: outDir + '/story_title_continue.png' });
  await press('ArrowDown'); await press('Enter'); await wait(300);
  check('Continue skips the intro: day 2 at the cooler, $0.50 and the 2 bars', (await scenes()).split(',')[0] + ' ' + (await story('r.day')) + ' ' + (await ev('e.moneyCents')) + ' ' + (await ev('e.stockLeft')), 'Cooler 2 50 2');
  check('Continue: HUD says Day 2/5', /Day 2\/5/.test(await hudClock()), true);
  // A reload (closing the browser) keeps the save too.
  await page.reload(); await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0); await page.click('canvas'); await wait(200);
  check('After reloading the page the save is still there', /Continue Story: Day 2/.test(await texts('Title')), true);

  // ---- SCREAM-17: New story asks first ----
  await press('ArrowDown', 2); await press('Enter'); await wait(200); // New Story
  check('New story over a save: asks first', /Start a new story\?/.test(await texts('Title')) && (await scenes()) === 'Title', true);
  await page.screenshot({ path: outDir + '/story_new_confirm.png' });
  await press('Enter'); await wait(200);
  check('...Enter alone does not wipe the save', (await scenes()) + ' ' + (await saved()), 'Title 2 50 2/0/0/0');
  await press('n'); await wait(200);
  check('...N: still on the title, save kept', (await scenes()) + ' ' + (await saved()), 'Title 2 50 2/0/0/0');
  // SCREAM-90: the question's No can be clicked too.
  await press('Enter'); await wait(200);
  const noAt = await sc('Title', "(() => { const t = s.confirmGroup.find(o => o.text === 'No (N)'); return [Math.round(t.x), Math.round(t.y)]; })()");
  await page.mouse.click(noAt[0], noAt[1]); await wait(200);
  check('...clicking No closes it, save kept', (await sc('Title', 's.confirming')) + ' ' + (await saved()), 'false 2 50 2/0/0/0');
  await press('Enter'); await wait(200); await press('y'); await wait(300);
  check('...Y: then the uncle question (SCREAM-205)', await sc('Title', 's.confirming && s.asking'), 'uncle');
  await press('o'); await wait(300);
  await press('Enter'); await wait(300); // past the intro
  check('...O: a new run at day 1 with $50, old save gone', (await story('r.day')) + ' ' + (await ev('e.moneyCents')) + ' ' + (await saved()), '1 5000 none');
  await press('Escape'); await wait(200); await press('ArrowDown', 2); await press('Enter'); await wait(150); await press('y'); await wait(300);

  // ---- SCREAM-94: reaching the bike's price gets a victory lap ----
  await press('ArrowDown'); await press('Enter'); await wait(300); await press('o'); await wait(300);
  await press('Enter'); await wait(300); // past the intro
  await story('(r.days = 1, true)'); // a one-day run, to reach the end quickly
  await ev('(e.cashCents = 65000, true)');
  await shift(3); await wait(300);
  check('Day 1 of a 1-day run with $650: you can buy the bike', /You can buy the bike/.test(await texts('DayEnd')), true);
  await press('Enter'); await wait(500);
  const winRes = await texts('Results');
  check('Story results say New Bike!!!!', /New Bike!!!!/.test(winRes) && !/Maybe Next Summer/.test(winRes), true);
  check('...no F stamp', await sc('Results', "!s.children.getByName('f-stamp')"), true);
  const t0 = await sc('Results', "Math.round(s.children.getByName('victory-truck').x)");
  await wait(600);
  const t1 = await sc('Results', "Math.round(s.children.getByName('victory-truck').x)");
  check('...the truck drives across the screen', t1 !== t0, true);
  check('...with Ws trailing behind it', await sc('Results', "s.children.list.filter(o => o.name === 'victory-w').length > 0"), true);
  await page.screenshot({ path: outDir + '/story_results_win.png' });
  await page.keyboard.type('WIN', { delay: 80 }); await press('Enter'); await wait(200);
  await press('Enter'); await wait(300);
  check('...then back to the title', await scenes(), 'Title');

  // ---- Quick play unchanged ----
  check('Title remembers nothing: Quick play picked again', /> Quick Play </.test(await texts('Title')), true);
  // SCREAM-90: click to start.
  const [cx, cy] = await optionAt('Quick Play');
  await page.mouse.click(cx, cy); await wait(300);
  check('Quick play: $50, no Story run', (await ev('e.moneyCents')) + ' ' + (await story('r')), '5000 null');
  check('Quick play: HUD shows no day', /Day/.test(await hudClock()), false);
  await shift(3); await wait(300);
  check('Quick play ends on the results screen', await scenes(), 'Results');

  console.log(`\n${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await browser.close();
})();
