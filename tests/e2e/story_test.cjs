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
  const until = async (fn, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await wait(50); } return false; };
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
  check('SCREAM-270: With Uncle is marked, with no line of keys under it (SCREAM-286)', (await sc('Title', 's.answers[s.answerSelected].label')) + ' ' + /> With Uncle \(U\) </.test(await texts('Title')) + ' ' + /Enter Or Click To Pick/.test(await texts('Title')), 'With Uncle (U) true false');
  await page.screenshot({ path: outDir + '/story_uncle_choice.png' });
  await press('Escape');
  check('...Esc closes it, still on the title', (await sc('Title', 's.confirming')) + ' ' + (await scenes()), 'false Title');

  // ---- SCREAM-18: the intro ----
  await press('Enter'); await wait(200); await press('ArrowRight');
  check('SCREAM-270: → marks On My Own', /> On My Own \(O\) </.test(await texts('Title')), true);
  await press('Enter'); await wait(300);
  const intro = await texts('StoryIntro');
  check('A new story opens with the intro screen', await scenes(), 'StoryIntro');
  check('...about the $600 bike and school in 5 days, marked as a placeholder', /\$600\.00/.test(intro) && /School starts in 5 days/.test(intro) && /Placeholder/.test(intro), true);
  await page.screenshot({ path: outDir + '/story_intro.png' });

  // ---- Day 1 ----
  check('SCREAM-270: the hint says Click Or Enter', /Click Or Enter: Start Monday/.test(intro), true);
  await page.mouse.click(480, 270, { button: 'right' }); await wait(300);
  check('...a right click does not begin', await scenes(), 'StoryIntro');
  await page.mouse.click(480, 270); await wait(300);
  check('...a left click: day 1 starts at the cooler', (await scenes()).startsWith('Cooler'), true);
  check('Story starts on day 1 of 5', await story('r.day + "/" + r.days'), '1/5');
  check('Story starts with $50', await ev('e.moneyCents'), 5000);
  check('...on the tutorial map, without the uncle (On My Own)', (await ev('e.mapId')) + ' ' + (await ev('e.tutorial === null')), 'tutorial true');
  // ---- SCREAM-204 (PO, November 11-12): Story starts with a weaker truck ----
  const tune = await page.evaluate(async () => { const t = await import('/src/config/tuning.js'); return { speed: t.TRUCK_SPEED, ring: t.MUSIC_RING_RADIUS, tank: t.FUEL_TANK_PX, acc: t.TRUCK_ACCELERATION_SECONDS, brake: t.TRUCK_BRAKING_SECONDS, turn: t.TRUCK_MAX_TURN_DEGREES_PER_SECOND }; });
  const spec = await ev('e.spec');
  check('Story: the truck is the weaker one (SCREAM-204)', spec.weak, true);
  check('...slower, slower to speed up, slower to stop, wider turns at speed', [spec.topSpeed < tune.speed, spec.accelerationSeconds > tune.acc, spec.brakingSeconds > tune.brake, spec.maxTurnDegrees < tune.turn].join(), 'true,true,true,true');
  check('...the music reaches less far', spec.musicRadius < tune.ring, true);
  check('...a tank of gas goes less far', spec.fuelTankPx < tune.tank, true);
  // SCREAM-269 (PO, November 12: "24 to start"): half of every crate is covered by a plain panel.
  check('...the cooler holds 24: half of every crate is covered (SCREAM-269)', spec.coolerHalfCovered + ' ' + spec.coolerCapacity + ' ' + (await ev('e.cells.length')), 'true 24 48');
  check('...the cooler screen counts out of 24', /\/ 24$/.test(await sc('Cooler', 's.title.text')), true);
  check('...with a plain panel over the right half of each of the 3 crates, no words on it', await sc('Cooler', "s.coveredHalves.length + ' ' + s.coveredHalves.every(c => c.list.every(o => o.type !== 'Text'))"), '3 true');
  check('...each panel covers exactly the right half of its crate', await sc('Cooler', "s.coveredHalves.map(c => Math.round(c.x)).join()"), [319, 519, 719].map(x => x + 80).join());
  await page.keyboard.press('3'); await wait(150);
  check('...pressing 3 still chooses crate 3 (its left half is open)', await sc('Cooler', 's.order.crate'), 2);
  await page.keyboard.press('1'); await wait(150);
  const fill24 = await sc('Cooler', "(() => { const o = s.order; let n = 0; while (o.addOne('eclair')) n++; const cells = o.cells; const r = n + ' ' + o.refusal + ' ' + cells.every((c, i) => !c || i % 4 < 2) + ' ' + [0, 1, 2].map(k => cells.slice(k * 16, k * 16 + 16).filter(Boolean).length).join('/'); for (let k = 0; k < n; k++) o.removeOne('eclair'); return r; })()");
  check('...it fills to 24 and stops: 8 in each crate, none under a panel', fill24, '24 full true 8/8/8');
  check('...an ice cream can\'t be dragged onto a covered square', await sc('Cooler', "(() => { const o = s.order; o.addOne('eclair'); const moved = o.move(0, 2); o.removeOne('eclair'); return moved; })()"), false);
  await sc('Cooler', '(s.refresh(), true)');
  await page.screenshot({ path: outDir + '/story_cooler_half_covered.png' });
  // SCREAM-221 / SCREAM-232 (PO): Story starts on a Monday; the HUD shows just the weekday.
  check('HUD shows the weekday beside the clock: Monday', /Monday/.test(await hudClock()) && !/Day 1/.test(await hudClock()), true);
  // SCREAM-232: ticked today a bit likelier, not ticked much less likely; anyone but 0% may come.
  check('Day 1 (Monday): everyone but 0% may come out tonight', await ev('e.residents.all.every(p => p.buys === (p.resident.likelihood > 0))'), true);
  check('...people ticked for Monday are likelier, the rest much less likely', await ev(`(() => { const R = e.residents.constructor; const st = { day: 1, seed: 1 }; return e.residents.all.every(p => (R.scheduleFactor(p.resident, st) > 1) === p.resident.days.includes(0) && R.scheduleFactor(p.resident, st) !== 1); })()`), true);
  check('...the ones ticked every day are the regulars tonight', await ev(`e.residents.all.every(p => (e.residents.kindOf(p.resident) === 'regular') === (p.resident.days.length === 7))`), true);
  check('Top bar no longer shows the bike (end-of-day screen only)', /Bike/.test(await hudClock()), false);
  // SCREAM-220: players see no debug hint (it shows only with ?debug; checked at the end).
  check('No debug hint on the HUD for players (SCREAM-220)', await sc('Hud', 's.debugText === undefined'), true);
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
    e.saleNow = s; e.hintChance = 0; e.scheduleLineChance = 0; // SCREAM-247: no schedule lines in these checks
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

  // ---- SCREAM-247: customers mention their own schedule after a paid sale (stand-in sales; Story's Day 1 is a Monday) ----
  const sched = (id, chance = 1, opts = {}) => page.evaluate(async ([id, chance, opts]) => {
    const e = window.__game.registry.get('evening');
    const { Sale } = await import('/src/state/Sale.js');
    const L = await import('/src/state/ScheduleLines.js');
    const s = new Sale([{ slot: 0, flavour: 'eclair', count: 1 }], 4, 0, false);
    s.phase = 'ordering'; s.order = [{ slot: 0, flavour: 'eclair', count: 1 }];
    const p = e.residents.all.find(p => p.resident.id === id);
    e.servingNow = p; e.saleNow = s; e.hintChance = 0; e.scheduleLineChance = chance; e.neighbourLineShare = opts.share ?? 0;
    if (opts.told === 'clear') e.neighboursToldAbout.length = 0;
    if (opts.forceNeighbour) e.forceNeighbourLine = true;
    if (opts.said !== undefined) e.scheduleLinesSaid = opts.said;
    if (opts.heard === 'clear') e.scheduleLinesHeard.length = 0;
    if (opts.force) e.forceScheduleLine = true;
    s.charge = () => { s.phase = 'over'; s.outcome = { kind: 'paid', priceCents: 0, tipCents: 0, tipPercent: 0 }; s.line = 'Thanks!'; return 'paid'; };
    const before = { visits: JSON.stringify(e.visits), second: e.secondVisits.length, paid: e.paidSales }; // leave the SCREAM-145 counts as they were
    e.chargeForSale(0);
    e.saleNow = null; e.servingNow = null;
    for (const k of Object.keys(e.visits)) delete e.visits[k];
    Object.assign(e.visits, JSON.parse(before.visits)); e.secondVisits.length = before.second; e.paidSales = before.paid;
    const own = (e.scheduleLinesFor.get(id) || []).map(l => 'Thanks! ' + L.fillSchedule(l.text, p.resident, 1));
    const about = s.neighbourAbout ? e.residents.all.find(q => q.resident.id === s.neighbourAbout).resident : null;
    const theirs = about ? (e.neighbourLinesFor.get(about.id) || []).map(l => 'Thanks! ' + L.fillNeighbour(l.text, about, 1)) : [];
    return { said: s.saidSchedule, line: s.line, own: own.includes(s.line), force: e.forceScheduleLine, count: e.scheduleLinesSaid,
      about: about ? about.id : '', neighbour: !!about && about.id !== id && about.street === p.resident.street && s.line.includes(about.name.trim()) && theirs.includes(s.line), forceN: e.forceNeighbourLine };
  }, [id, chance, opts]);
  const monThuOnly = await ev("(e.residents.all.find(p => p.resident.days && p.resident.days.length >= 2 && p.resident.days.length <= 3 && p.resident.days.includes(3) && !p.resident.days.includes(1) && !p.resident.days.includes(2)) || { resident: { id: '' } }).resident.id");
  // SCREAM-275: only special customers (a set order size, or hard to find) have schedule lines said. Big Kev (T034) is one,
  // every day on Institute Road; Francine Fudge (T003) is an ordinary neighbour of his there.
  const allWeek = 'T034', ordinary = 'T003';
  check('Schedule lines: everyone with ticked days has their own lines this run', await ev("e.residents.all.filter(p => p.resident.days && p.resident.days.length > 0).every(p => (e.scheduleLinesFor.get(p.resident.id) || []).length > 0)"), true);
  const day1Sched = await ev("JSON.stringify([...e.scheduleLinesFor.entries()].map(([id, l]) => id + ':' + l.map(x => x.id).join('+')).sort())");
  check('...none when the dice say no', (await sched(allWeek, 0, { said: 0 })).said, false);
  const s1 = await sched(allWeek, 1, { said: 0 });
  check("...a paid sale (no tip needed) can end with one, after the thanks, from the customer's own lines", s1.said + ' ' + s1.own + ' ' + /^Thanks! .+/.test(s1.line), 'true true true');
  check('...someone home every day names no weekday', /Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/.test(s1.line), false);
  const s1b = await sched(allWeek, 1, { said: 0 }), s1c = await sched(allWeek, 1, { said: 0 }), s1d = await sched(allWeek, 1, { said: 0 });
  check('...(PO, testing) the same regular says three different things, then has nothing new of their own tonight', new Set([s1.line, s1b.line, s1c.line]).size + ' ' + s1d.said, '3 false');
  check('...and with no special neighbour on his street, says nothing more (SCREAM-275)', s1d.about, '');
  await sched(allWeek, 0, { heard: 'clear', told: 'clear' });
  const o1 = await sched(ordinary, 1, { said: 0, share: 0, heard: 'clear', told: 'clear' });
  check('SCREAM-275: an ordinary customer never says their own week', o1.said + ' ' + o1.own, 'false false');
  check('...but can talk about a special neighbour (Big Kev)', o1.about + ' ' + o1.neighbour, 'T034 true');
  const others = []; for (let i = 0; i < 6; i++) others.push((await sched('T005', 1, { said: 0, share: 1, heard: 'clear', told: 'clear' })).about);
  check('...and never about an ordinary neighbour (Westland Street: only Pizza Joe, or nobody)', others.every(a => a === '' || a === 'T006'), true);
  await sched(allWeek, 0, { heard: 'clear', told: 'clear' });
  const s2 = await sched('T021', 1, { said: 0 });
  check('...Ruth Butter Ginsburg (hard to find, Fridays only) has her own lines to say', s2.said + ' ' + s2.own, 'true true');
  check('...no more than 1 a night (SCREAM-275; was 4)', (await sched(allWeek, 1, { said: 1, heard: 'clear' })).said, false);
  const forced = await sched(allWeek, 0, { said: 1, force: true, heard: 'clear' });
  check('...Shift+7 (debug) forces one on the next paid sale, once', forced.said + ' ' + forced.force, 'true false');
  // ---- SCREAM-249: hours of the evening (Drake Maye, T036, is only home after 7) ----
  check('Hours: at the start of the evening (5 PM) Drake Maye is not home; at 7 he is', await ev("(() => { const r = e.residents, d = r.all.find(p => p.resident.id === 'T036').resident; const now = r.homeNow(d); const real = r.nowMinutes; r.nowMinutes = () => 1141; const later = r.homeNow(d); r.nowMinutes = real; return Math.round(real()) + ' ' + now + ' ' + later; })()"), '1020 false true');
  check('...everyone without hours is home all evening', await ev("e.residents.all.filter(p => !p.resident.hours).every(p => e.residents.homeNow(p.resident))"), true);
  check('...he has a line about the time, and so does his street', await ev("[...e.scheduleLinesFor.get('T036'), ...e.neighbourLinesFor.get('T036')].filter(l => l.text.includes('[From]')).length"), 2);
  // ---- SCREAM-250: hard-to-find customers (Pizza Joe, T006: 6:00 to 6:18 every day, 10 ice creams, tip x4) ----
  check('Hard to find: Pizza Joe is one, with 10 ice creams and a window', await ev("(() => { const d = e.residents.all.find(p => p.resident.id === 'T006').resident; return d.hardToFind + ' ' + d.orderSize + ' ' + d.hours.join('-'); })()"), 'true 10 1080-1098');
  check('...they are on (this is not the uncle\'s evening) and count as home all evening', await ev("e.residents.hardToFindOn + ' ' + e.residents.homeNow(e.residents.all.find(p => p.resident.id === 'T006').resident)"), 'true true');
  check('...at the window their tip is 4 times the usual; anyone else\'s is not', await ev("(() => { const joe = e.residents.all.find(p => p.resident.id === 'T006'), other = e.residents.all.find(p => p.resident.id === 'T005'); const was = { c: joe.customer, o: joe.outside, w: joe.walking }, was2 = { c: other.customer, o: other.outside, w: other.walking }; joe.customer = 'waiting'; other.customer = 'waiting'; const a = e.startSale(joe).tipFactor; e.saleNow = null; e.servingNow = null; const b = e.startSale(other).tipFactor; e.saleNow = null; e.servingNow = null; Object.assign(joe, { customer: was.c, outside: was.o, walking: was.w }); Object.assign(other, { customer: was2.c, outside: was2.o, walking: was2.w }); e.setCustomerWaiting && e.setCustomerWaiting(false); return a + ' ' + b; })()"), '4 1');
  check('...their own line and their street\'s line give the window', await ev("[...e.scheduleLinesFor.get('T006'), ...e.neighbourLinesFor.get('T006')].every(l => l.text.includes('[From]') && l.text.includes('[Until]'))"), true);
  // ---- SCREAM-248: neighbours know each other's days (same stand-in sales) ----
  check('Neighbour lines: everyone here with ticked days who buys can be talked about, and nobody else', await ev("e.residents.all.every(p => e.neighbourLinesFor.has(p.resident.id) === (p.resident.likelihood > 0 && !!p.resident.days && p.resident.days.length > 0))"), true);
  const day1Neighbours = await ev("JSON.stringify([...e.neighbourLinesFor.entries()].map(([id, l]) => id + ':' + l.map(x => x.id).join('+')).sort())");
  const n1 = await sched(ordinary, 1, { said: 0, share: 1, heard: 'clear', told: 'clear' });
  check("...a customer can say when someone else on their street is home: true, by name, from that neighbour's lines", n1.neighbour + ' ' + n1.said, 'true false');
  const n2 = await sched(ordinary, 1, { said: 0, share: 1 });
  check('...never about the same neighbour twice in an evening', n2.about !== n1.about, true);
  check('...none when the share says no (their own line instead)', (await sched(allWeek, 1, { said: 0, share: 0, heard: 'clear', told: 'clear' })).said, true);
  check('...they count towards the same 1 a night', (await sched(ordinary, 1, { said: 1, share: 1, heard: 'clear', told: 'clear' })).about, '');
  const forcedN = await sched(ordinary, 0, { said: 1, share: 0, forceNeighbour: true, heard: 'clear', told: 'clear' });
  check('...Shift+8 (debug) forces one on the next paid sale, once', forcedN.neighbour + ' ' + forcedN.forceN, 'true false');
  await ev('(e.scheduleLinesSaid = 0, e.scheduleLinesHeard.length = 0, e.neighboursToldAbout.length = 0, e.scheduleLineChance = 0, 0)');

  await press('+', 3); await press('Enter'); await wait(300);
  check('Bought 3 ice creams ($3)', (await ev('e.moneyCents')) + ' ' + (await ev('e.stockLeft')), '4700 3');
  await shift(3); await wait(300);
  check('Day 1 over: end-of-day screen, not the results screen', await scenes(), 'DayEnd');
  const day1 = await texts('DayEnd');
  check('...it says END OF MONDAY and shows the wallet', /END OF MONDAY/.test(day1) && /WALLET/.test(day1) && /\$47\.00/.test(day1), true);
  check('...and the ice creams left', /Ice creams left: 3/.test(day1), true);
  check('...and Enter starts day 2 (SCREAM-232: "Start Tuesday")', /Enter: Start Tuesday(?!,)/.test(day1) && /END OF MONDAY/.test(day1), true);
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
  check('HUD says Tuesday', /Tuesday/.test(await hudClock()), true);
  check('Day 2 (Tuesday): people ticked for Tuesday are the likelier ones', await ev(`(() => { const R = e.residents.constructor; return e.residents.all.every(p => (R.scheduleFactor(p.resident, { day: 2, seed: 1 }) > 1) === p.resident.days.includes(1)); })()`), true);
  check('Visits and the rotary hint carried over to day 2 (SCREAM-145)', (await ev(`e.visits['${r1}']`)) + ' ' + (await ev('e.rotaryHintGiven')) + ' ' + (await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('icemachine.story.v2')); return d.rotaryHintGiven + ' ' + Object.keys(d.visits).length; })), '2 true true 4');
  check('Hints (PO): each regular keeps the same line on day 2 as on day 1', await ev("JSON.stringify([...e.hintFor.entries()].sort())"), day1Hints);
  check('Schedule lines (063): everyone keeps the same lines on day 2 as on day 1', await ev("JSON.stringify([...e.scheduleLinesFor.entries()].map(([id, l]) => id + ':' + l.map(x => x.id).join('+')).sort())"), day1Sched);
  check('Neighbour lines: the street says the same about everyone on day 2 as on day 1', await ev("JSON.stringify([...e.neighbourLinesFor.entries()].map(([id, l]) => id + ':' + l.map(x => x.id).join('+')).sort())"), day1Neighbours);
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
  // SCREAM-229: the portal in the roundabout; waits for the evening to reach the other map.
  const portalArrived = (mapId) => page.waitForFunction((mapId) => {
    const s = window.__game.scene.getScene('Drive');
    return window.__game.registry.get('evening').mapId === mapId && s.sys.isActive() && s.portal && s.portal.state === 'closing';
  }, mapId, { timeout: 15000 }).then(() => true, () => false);
  check('Portal (SCREAM-229): none before the laps', await sc('Drive', 's.portal.visible + " " + s.portal.state'), 'false lapping');
  // lapRing goes a little over (30 degrees), and each call carries on the count from 0 degrees.
  await lapRing(0.9); await wait(300);
  check('...one lap: still nothing (PO: it appears on the second)', await sc('Drive', 's.lapsDone + " " + s.portal.visible + " " + s.portal.shown'), '0 false 0');
  await lapRing(0.8); await wait(600);
  check('...on the second lap: a faint portal in the middle of the roundabout, under the truck, with its sound', await sc('Drive', "s.portal.visible + ' ' + (s.portal.shown > 0.2 && s.portal.shown <= 0.5) + ' ' + (s.portal.glow.alpha < 0.6) + ' ' + (s.portal.radius <= 80) + ' ' + (s.portal.glow.depth < s.truckLook.depth) + ' ' + (s.portal.glow.x === s.laps.ring.x && s.portal.glow.y === s.laps.ring.y) + ' ' + s.portalSound.lastEvent"), 'true true true true true true hum');
  await lapRing(0.4); await wait(100);
  check('...two laps: still in Elm Park, 2 of 3 counted, nothing shown on screen (PO)', (await ev('e.mapId')) + ' ' + (await sc('Drive', 's.lapsDone + " " + s.lapLabel.visible + " " + s.lapLabel.text')), 'tutorial 2 false 2 / 3 laps');
  await sc('Drive', "(s.truck.setPosition(s.laps.ring.x + 600, s.laps.ring.y), true)"); await wait(100);
  check('...driving off the roundabout starts the count again', await sc('Drive', 's.lapsDone + " " + s.lapLabel.text'), '0 ');
  await wait(1500);
  check('...and the portal fades away; no trip (PO)', await sc('Drive', "s.portal.visible + ' ' + s.portal.shown + ' ' + s.portalSound.level"), 'false 0 0');
  const clockBefore = await ev('e.nowMs');
  const cashBefore = await ev('e.moneyCents');
  await lapRing(2.6); await wait(500);
  check('...late in the third lap: bigger and stronger, over the ring road', await sc('Drive', "(s.portal.shown > 0.65) + ' ' + (s.portal.radius > 120) + ' ' + (s.portal.glow.alpha > 0.7)"), 'true true true');
  await sc('Drive', "(s.truck.setPosition(s.laps.ring.x + 600, s.laps.ring.y), true)"); await wait(1500);
  await lapRing(3, 15); await wait(250);
  check('...three laps: the portal swallows the screen, over everything, with a whoosh', await sc('Drive', "s.portal.state + ' ' + (s.portal.glow.depth > 100) + ' ' + s.portalSound.lastEvent + ' ' + s.portal.visible"), 'swallowing true swallow true');
  check('...it takes about a second: still in Elm Park a quarter of a second in', await ev('e.mapId'), 'tutorial');
  check('...arriving: the portal covers the screen and closes', await portalArrived('worcester'), true);
  check('...the portal is centred on Newton Square, over everything, still big', await sc('Drive', "(s.portal.glow.x === s.laps.ring.x) + ' ' + (s.portal.glow.depth > 100) + ' ' + s.portal.visible + ' ' + (s.portal.radius > 300)"), 'true true true true');
  // Waits rather than a fixed time: the portal moves on with the game's frames, slower on a busy machine.
  const portalWait = (fn) => page.waitForFunction(`(() => { const s = window.__game.scene.getScene('Drive'); return ${fn}; })()`, null, { timeout: 8000 }).then(() => true, () => false);
  const bigRadius = await sc('Drive', 's.portal.radius');
  check('...shrinking, its sound falling away', (await portalWait(`s.portal.radius < ${bigRadius} * 0.8`)) + ' ' + (await sc('Drive', 's.portalSound.lastEvent')), 'true close');
  check('...the player can drive meanwhile (PO)', await sc('Drive', 's.leaving + " " + s.switchingMap'), 'false false');
  const closeStart = Date.now();
  check('...then it has closed', (await portalWait("s.portal.state === 'lapping'")) + ' ' + (await sc('Drive', 's.portal.visible')), 'true false');
  check('...in about a second (well under 4 even on a busy machine)', Date.now() - closeStart < 4000, true);
  check('Three laps: the truck is in Foley Stadium', (await ev('e.mapId')) + ' ' + (await ev('e.mapSwitches')), 'worcester 1');
  check('...the top bar names the neighbourhood', /Tuesday  Foley Stadium/.test(await hudClock()), true);
  check('...on the road there, on Newton Square (the roundabout)', (await scenes()) + ' ' + (await sc('Drive', "(() => { const r = s.laps.ring; return Math.round(Math.hypot(s.truck.x - r.x, s.truck.y - r.y)) === r.r; })()")), 'Drive,Hud true');
  check('...Newton Square is at the top of the map', await sc('Drive', 's.laps.ring.y < 600'), true);
  check('...Foley Stadium\'s own people are out (sheet 15), with their state kept apart from Elm Park\'s', await ev("e.residents.all.length > 100 && e.residents.all.every(p => !p.resident.id.startsWith('T'))"), true);
  check('...the clock and the cash carried on', (await ev('e.nowMs') >= clockBefore) + ' ' + (await ev('e.moneyCents')), 'true ' + cashBefore);
  check('...still Day 2 of the same run', await story('r.day'), 2);
  check('...away from home: no driveway here, the way home is the roundabout', (await ev('e.awayFromHome')) + ' ' + (await sc('Drive', 's.homeBay.visible')), 'true false');
  await ev('(e.coolerSlots.forEach(sl => sl.quantity = 0), e.syncCells(), true)'); await wait(200);
  check('...sold out: the HOME arrow points at Newton Square, not at Foley\'s driveway', await sc('Drive', "(() => { const r = s.laps.ring; const a = s.homeArrow; const v = s.cameras.main.worldView; return a.visible && Math.hypot(a.x - r.x, a.y - (r.y - 70)) < 40 || !Phaser.Geom.Rectangle.Contains(v, r.x, r.y); })()"), true);
  await ev('(e.coolerSlots[0].quantity = 4, e.syncCells(), true)');
  await lapRing(3);
  check('Three laps of Newton Square: the portal opens back to Elm Park', await portalArrived('tutorial'), true);
  await wait(1300);
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
  check('Day 5 starts, the last', (await story('r.day')) + ' ' + /Friday/.test(await hudClock()), '5 true');
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
  // SCREAM-181: Esc here opens the pause menu with the warning; Resume comes back to the initials.
  await press('Escape'); await wait(300);
  check('...Esc: the pause menu with the high score warning', /Quitting won't save your high score\./.test(await texts('Pause')) && !/Restart/.test(await texts('Pause')), true);
  await press('Escape'); await wait(300);
  check('...Esc again: back to the initials', (await scenes()) + ' ' + (await sc('Results', 's.entering')), 'Results true');
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
  check('$0.50 with 2 bars left: carries on to day 2', /END OF MONDAY/.test(await texts('DayEnd')), true);

  // ---- Quitting a Story run from the pause menu ----
  await press('Enter'); await wait(300); await press('Enter'); await wait(300);
  await press('Escape'); await wait(200); await press('ArrowDown', 2); await press('Enter'); await wait(150);
  check('Quit prompt says Continue picks up at the start of this evening', /Continue picks up at\s+the start of this evening/.test(await texts('Pause')), true);
  check('...and fits inside the pause box', await sc('Pause', 's.prompt.width <= 410'), true);
  await press('y'); await wait(300);
  check('Quit: title, Story run cleared', (await scenes()) + ' ' + (await story('r')), 'Title null');

  // ---- SCREAM-17: Continue ----
  const withSave = await texts('Title');
  check('Title offers Continue story (Tuesday, $0.50) and New story', /Continue Story: Tuesday, \$0\.50/.test(withSave) && /New Story/.test(withSave), true);
  await page.screenshot({ path: outDir + '/story_title_continue.png' });
  await press('ArrowDown'); await press('Enter'); await wait(300);
  check('Continue skips the intro: day 2 at the cooler, $0.50 and the 2 bars', (await scenes()).split(',')[0] + ' ' + (await story('r.day')) + ' ' + (await ev('e.moneyCents')) + ' ' + (await ev('e.stockLeft')), 'Cooler 2 50 2');
  check('Continue: HUD says Tuesday', /Tuesday/.test(await hudClock()), true);
  // A reload (closing the browser) keeps the save too.
  await page.reload(); await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0); await page.click('canvas'); await wait(200);
  check('After reloading the page the save is still there', /Continue Story: Tuesday/.test(await texts('Title')), true);

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
  check('SCREAM-270: Start a new story? has No marked', await sc('Title', 's.answers[s.answerSelected].label'), 'No (N)');
  await press('Enter'); await wait(200);
  check('...so Enter closes it, save kept', (await sc('Title', 's.confirming')) + ' ' + (await saved()), 'false 2 50 2/0/0/0');
  await press('Enter'); await wait(200); await press('ArrowLeft'); await press('Enter'); await wait(300);
  check('...← then Enter: Yes, on to the uncle question', await sc('Title', 's.confirming && s.asking'), 'uncle');
  await press('Escape'); await wait(200); await press('Enter'); await wait(200);
  const noAt = await sc('Title', "(() => { const t = s.answers[1].text; return [Math.round(t.x), Math.round(t.y)]; })()");
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
  check('Quick play: no hints (PO: Story only)', await ev('e.hintFor.size'), 0);
  check('Quick play: no schedule lines (PO: Story only)', await ev('e.scheduleLinesFor.size'), 0);
  check('Quick play: no neighbour lines (PO: Story only)', await ev('e.neighbourLinesFor.size'), 0);
  await shift(3); await wait(300);
  check('Quick play ends on the results screen', await scenes(), 'Results');

  // ---- SCREAM-269: filling an order in Story: half doors, the right half of each crate shut ----
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('icemachine.tutorial.done.v1', '1'); });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  await page.click('canvas'); await wait(200);
  await press('ArrowDown'); await press('Enter'); await wait(200); await press('o'); await wait(300); await press('Enter'); await wait(400);
  await press('+', 3); await press('Enter'); await wait(300);
  if ((await scenes()).startsWith('Truck')) { await press('ArrowRight'); await press('Enter'); await wait(400); }
  await ev('(e.orderPictureChance = 0, true)');
  await ev("e.residents.callNow(e.residents.all.find(p => p.customer === 'none'))"); await wait(200);
  await sc('Drive', '(s.truck.setPosition(s.pickupZone.x, s.pickupZone.y), s.speed = 0, s.parkBrake = true)'); await wait(500);
  await until(async () => (await ev("e.sale && e.sale.phase")) === 'deciding', 9000);
  await press('Enter'); await wait(400);
  check('Story: at the cooler to fill an order (SCREAM-269)', await scenes(), 'Fill,Hud');
  const fillS = (fn) => sc('Fill', fn);
  check('...each crate has a half door (half as wide) and a shut plain half beside it', await fillS("s.lids.length + ' ' + s.coveredHalves.length + ' ' + s.lids.every((l, i) => Math.round(s.coveredHalves[i].x - l.x) === 80)"), '3 3 true');
  check('...the shut halves have no words on them', await fillS("s.coveredHalves.every(c => c.list.every(o => o.type !== 'Text'))"), true);
  await press('1'); await wait(400);
  check('...pressing 1 opens crate 1\'s door; the three eclairs show, the plain half stays shut', await fillS("s.openCrate + ' ' + s.cellIcons.filter(i => i.visible).length + ' ' + s.coveredHalves[0].visible"), '0 3 true');
  await press('ArrowRight', 2);
  check('...the arrow keys stay in the two open columns', await fillS('s.focus % 4'), 0);
  await press('ArrowRight');
  check('...and reach the second column', await fillS('s.focus % 4'), 1);
  await page.screenshot({ path: outDir + '/story_fill_half_doors.png' });

  // ---- SCREAM-268: On My Own, the uncle's $20 for gas waits at the first pump ----
  {
    const flow = (call) => page.evaluate(`(async () => { const f = await import('/src/flow.js'); const s = window.__game.scene.getScenes(true)[0]; ${call}; return true; })()`);
    const pump = async () => { await page.evaluate(() => { const g = window.__game; if (g.scene.isActive('Drive')) g.scene.getScene('Drive').scene.pause(); g.scene.start('Pump'); }); await wait(600); };
    await flow('f.startStory(s, false)');
    await until(async () => (await scenes()).includes('StoryIntro')); await press('Enter');
    await until(async () => (await scenes()).includes('Cooler')); await wait(300);
    check('SCREAM-268: On My Own: the uncle\'s gas is waiting', await ev('e.uncleLeftGas + " " + e.unclePaysGas'), 'true true');
    await pump();
    check('...the first pump says he left $20', await sc('Pump', 's.noteText.text'), 'Your uncle left $20 for you to use.');
    const cash0 = await ev('e.cashCents'); const fuel0 = await ev('e.fuel');
    await press('ArrowUp', 6);
    check('...up to $20, and he pays', (await sc('Pump', 's.amount')) + ' | ' + (await sc('Pump', 's.payButton.text')) + ' | ' + (await sc('Pump', 's.noteText.text')), "2000 | UNCLE PAYS $20.00 | That's the uncle's $20.");
    await press('Enter'); await wait(400);
    check('...the tank fills by $20 and the cash is untouched', ((await ev('e.fuel')) - fuel0 > 0.6) + ' ' + ((await ev('e.cashCents')) === cash0), 'true true');
    check('...used up: the next pump is the player\'s', await ev('e.uncleLeftGas + " " + e.unclePaysGas + " " + e.uncleGasUsed'), 'false false true');
    await flow("f.endEvening(window.__game.scene.getScenes(true)[0])"); await until(async () => (await scenes()).includes('DayEnd')); await wait(300);
    check('SCREAM-276: the end-of-day screen shows the gas dial, bottom left, at tomorrow\'s level', await sc('DayEnd', "(d => !!d && d.container.x < 160 && d.container.y > 450)(s.gasDial)"), true);
    await page.screenshot({ path: outDir + '/story_day_end_gas.png' });
    check('...and stays used up in the save', (await story('r.uncleGasUsed')) + ' ' + (await page.evaluate(() => JSON.parse(localStorage.getItem('icemachine.story.v2')).uncleGasUsed)), 'true true');
    await press('Enter'); await until(async () => (await scenes()).includes('Cooler')); await wait(300);
    check('...Tuesday: no uncle\'s gas', await ev('e.uncleLeftGas + " " + e.unclePaysGas'), 'false false');
    check('SCREAM-276: no gas dial at the cooler', await sc('Hud', 's.fuelGauge.visible'), false);
    await ev('(e.fuelLeft = 0.1, true)');
    await page.evaluate(() => window.__game.scene.getScene('Cooler').scene.start('Truck')); await wait(600);
    check('SCREAM-276: inside the truck (Story) the gas dial shows, bottom left', await sc('Hud', 's.fuelGauge.visible + " " + (s.fuelGauge.x < 160) + " " + (s.fuelGauge.y > 450)'), 'true true true');
    const needles = []; for (let i = 0; i < 5; i++) { needles.push(await sc('Hud', 's.fuelNeedle')); await wait(150); }
    check('...steady below a quarter (no wobble in the truck), at the true level', needles.every(n => n === 0.1), true);
    await page.screenshot({ path: outDir + '/story_hub_gas.png' });
    // With Uncle, skipped before his pump: the same $20 waits.
    await flow('f.startStory(s, true)');
    await until(async () => (await scenes()).includes('TutorialCrawl')); await wait(500);
    await press('x'); await until(async () => (await scenes()).includes('UncleIntro')); await wait(500);
    await press('x'); await wait(500);
    check('SCREAM-268: With Uncle, skipped before the pump: the uncle\'s gas waits too', await ev('e.tutorial.skipped + " " + e.uncleLeftGas + " " + e.unclePaysGas'), 'true true true');
  }

  // ---- SCREAM-220: with ?debug in the address, the debug hint is back (SCREAM-88: only Shift+3, right of the clock) ----
  await page.goto(`http://127.0.0.1:${port}/index.html?debug`);
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  const [dx, dy] = await optionAt('Quick Play');
  await page.mouse.click(dx, dy); await wait(400);
  check('?debug: the debug hint shows only Shift+3: end evening', await sc('Hud', 's.debugText && s.debugText.text'), 'DEBUG Shift+3: End Evening');
  check('...and starts right of the clock', await sc('Hud', 's.debugText.x > s.clockText.x + s.clockText.width'), true);

  console.log(`\n${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await browser.close();
})();
