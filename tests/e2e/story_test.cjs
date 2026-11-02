// SCREAM-19: Story mode's wallet. Cash and stock carry from one evening to the
// next, Restart evening goes back to how tonight started, running out of money
// is game over, and Quick play is unchanged.
// SCREAM-17: the run is saved at the end of each evening; Continue and New story.
// SCREAM-18: the bike story: intro screen, bike goal, end of run with the Story high scores.
const { chromium } = require('playwright');
(async () => {
  const [port, outDir] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
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
  const saved = () => page.evaluate(() => { const r = localStorage.getItem('icemachine.story.v1'); if (!r) return 'none'; const d = JSON.parse(r); return d.day + ' ' + d.cashCents + ' ' + d.slots.map(s => s.quantity).join('/'); });
  let pass = 0, fail = 0;
  const check = (name, got, want) => { const ok = String(got) === String(want); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(68) + ' got=' + got + (ok ? '' : ' want=' + want)); };

  // ---- Title: two modes ----
  await page.click('canvas'); await wait(200);
  const title = await texts('Title');
  check('Title shows Quick play (picked) and Story', /> Quick play </.test(title) && /Story/.test(title), true);
  await press('ArrowDown');
  check('Down arrow picks Story', /> Story </.test(await texts('Title')), true);
  await page.screenshot({ path: outDir + '/story_title.png' });
  // SCREAM-90: the mouse. Pointing at an option picks it.
  const optionAt = (label) => sc('Title', `(() => { const t = s.modeTexts.find(o => o.text.includes('${label}')); return [Math.round(t.x), Math.round(t.y)]; })()`);
  const [qx, qy] = await optionAt('Quick play');
  await page.mouse.move(qx, qy); await wait(150);
  check('Mouse over Quick play picks it', /> Quick play </.test(await texts('Title')), true);
  const [sx, sy] = await optionAt('Story');
  await page.mouse.move(sx, sy); await wait(150);
  check('Mouse over Story picks it', /> Story </.test(await texts('Title')), true);
  await page.mouse.move(5, 5); await wait(100);

  // ---- SCREAM-18: the intro ----
  await press('Enter'); await wait(300);
  const intro = await texts('StoryIntro');
  check('A new story opens with the intro screen', await scenes(), 'StoryIntro');
  check('...about the $200 bike and school in 3 days, marked as a placeholder', /\$200\.00/.test(intro) && /School starts in 3 days/.test(intro) && /Placeholder/.test(intro), true);
  await page.screenshot({ path: outDir + '/story_intro.png' });

  // ---- Day 1 ----
  await press('Enter'); await wait(300);
  check('Enter: day 1 starts at the cooler', (await scenes()).startsWith('Cooler'), true);
  check('Story starts on day 1 of 3', await story('r.day + "/" + r.days'), '1/3');
  check('Story starts with $100', await ev('e.moneyCents'), 10000);
  check('HUD shows the day beside the clock', /Day 1\/3/.test(await hudClock()), true);
  check('HUD shows the bike goal', /Bike \$200\.00/.test(await hudClock()), true);
  // SCREAM-88: only Shift+3 shows, to the right of the day, not on top of it.
  check('Debug hint shows only Shift+3: end evening', await sc('Hud', 's.debugText.text'), 'DEBUG Shift+3: end evening');
  check('...and starts right of the clock and day', await sc('Hud', 's.debugText.x > s.clockText.x + s.clockText.width'), true);
  await press('+', 3); await press('Enter'); await wait(300);
  check('Bought 3 ice creams ($3)', (await ev('e.moneyCents')) + ' ' + (await ev('e.stockLeft')), '9700 3');
  await shift(3); await wait(300);
  check('Day 1 over: end-of-day screen, not the results screen', await scenes(), 'DayEnd');
  const day1 = await texts('DayEnd');
  check('...it says END OF DAY 1 and shows the wallet', /END OF DAY 1/.test(day1) && /WALLET/.test(day1) && /\$97\.00/.test(day1), true);
  check('...and the ice creams left', /Ice creams left: 3/.test(day1), true);
  check('...and Enter starts day 2', /Enter: start day 2/.test(day1), true);
  check('...and says Game saved', /Game saved/.test(day1), true);
  check('Saved: day 2, $97, 3 bars in the first slot', await saved(), '2 9700 3/0/0');
  await page.screenshot({ path: outDir + '/story_day_end.png' });

  // ---- Day 2: cash and stock carried over ----
  await press('Enter'); await wait(300);
  check('Day 2 opens at the cooler', (await scenes()).startsWith('Cooler'), true);
  check('Cash carried over ($97)', await ev('e.moneyCents'), 9700);
  check('Stock carried over (3 bars, same flavour)', await ev('e.coolerSlots[0].quantity + " " + e.coolerSlots[0].flavour'), '3 eclair');
  check("Tonight's profit starts at $0", await ev('e.profitCents'), 0);
  check('HUD says Day 2/3', /Day 2\/3/.test(await hudClock()), true);
  check('High scores untouched by Story', await page.evaluate(() => localStorage.getItem('icemachine.highscores.v1')), 'null');

  // ---- Restart evening goes back to how tonight started ----
  await press('+'); await press('Enter'); await wait(300);
  check('Bought 1 more on day 2', (await ev('e.moneyCents')) + ' ' + (await ev('e.stockLeft')), '9600 4');
  await press('Escape'); await wait(200); await press('ArrowDown'); await press('Enter'); await wait(150);
  check('Restart prompt explains Story restarts', /Cash and stock go back/.test(await texts('Pause')), true);
  // SCREAM-89: the question stays inside the pause box (420 px wide, centred).
  check('...and fits inside the pause box', await sc('Pause', 's.prompt.width <= 410'), true);
  await page.screenshot({ path: outDir + '/story_pause_restart.png' });
  await press('y'); await wait(400);
  check('Restart: back to $97 and 3 bars, still day 2', (await ev('e.moneyCents')) + ' ' + (await ev('e.stockLeft')) + ' ' + (await story('r.day')), '9700 3 2');

  // ---- Day 3, the last ----
  await shift(3); await press('Enter'); await wait(300);
  check('Day 3 starts', await story('r.day'), 3);
  await shift(3); await wait(300);
  const last = await texts('DayEnd');
  check('After day 3: STORY COMPLETE', /STORY COMPLETE/.test(last), true);
  check('...short of the bike ($97 of $200: $103 short)', /\$103\.00 short of the bike/.test(last), true);
  check('...Enter goes to the Story high scores', /Enter: Story high scores/.test(last), true);
  await press('Enter'); await wait(300);
  check('Story results screen', await scenes(), 'Results');
  const runRes = await texts('Results');
  check('...run stats: 3 days, $3 stock, final cash $97, no bike', /3 DAYS/.test(runRes) && /-\$3\.00/.test(runRes) && /Final cash/.test(runRes) && /\$97\.00/.test(runRes) && /not this time/.test(runRes), true);
  check('...first Story score: asks for initials', await sc('Results', 's.entering'), true);
  await page.keyboard.type('CON'); await press('Enter'); await wait(200);
  check('...saved to the Story table, not the Quick play one',
    await page.evaluate(() => { const st = JSON.parse(localStorage.getItem('icemachine.highscores.story.v1') || '[]'); return st.map(x => x.initials + x.scoreCents).join() + ' ' + localStorage.getItem('icemachine.highscores.v1'); }), 'CON9700 null');
  check('...STORY HIGH SCORES, Enter: back to the title', /STORY HIGH SCORES/.test(await texts('Results')) && /Enter: back to the title/.test(await texts('Results')), true);
  await page.screenshot({ path: outDir + '/story_results.png' });
  await press('Enter'); await wait(300);
  check('Back at the title, Story run cleared', (await scenes()) + ' ' + (await story('r')), 'Title null');
  check('Run complete: the save is cleared', await saved(), 'none');
  check('...so the title offers Story, not Continue', /Continue/.test(await texts('Title')), false);

  // ---- Out of money: game over ----
  await press('ArrowDown'); await press('Enter'); await wait(300);
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
  await press('ArrowDown'); await press('Enter'); await wait(300);
  await press('Enter'); await wait(300); // past the intro
  await ev('(e.cashCents = 50, true)');
  await shift(3); await wait(300);
  check('Empty cooler and $0.50: GAME OVER', /GAME OVER/.test(await texts('DayEnd')), true);
  await press('Enter'); await wait(300);
  // ...but with stock left, $0.50 isn't game over: you can still sell.
  await press('ArrowDown'); await press('Enter'); await wait(300);
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
  check('Title offers Continue story (day 2, $0.50) and New story', /Continue story: day 2, \$0\.50/.test(withSave) && /New story/.test(withSave), true);
  await page.screenshot({ path: outDir + '/story_title_continue.png' });
  await press('ArrowDown'); await press('Enter'); await wait(300);
  check('Continue skips the intro: day 2 at the cooler, $0.50 and the 2 bars', (await scenes()).split(',')[0] + ' ' + (await story('r.day')) + ' ' + (await ev('e.moneyCents')) + ' ' + (await ev('e.stockLeft')), 'Cooler 2 50 2');
  check('Continue: HUD says Day 2/3', /Day 2\/3/.test(await hudClock()), true);
  // A reload (closing the browser) keeps the save too.
  await page.reload(); await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0); await page.click('canvas'); await wait(200);
  check('After reloading the page the save is still there', /Continue story: day 2/.test(await texts('Title')), true);

  // ---- SCREAM-17: New story asks first ----
  await press('ArrowUp'); await press('Enter'); await wait(200);
  check('New story over a save: asks first', /Start a new story\?/.test(await texts('Title')) && (await scenes()) === 'Title', true);
  await page.screenshot({ path: outDir + '/story_new_confirm.png' });
  await press('Enter'); await wait(200);
  check('...Enter alone does not wipe the save', (await scenes()) + ' ' + (await saved()), 'Title 2 50 2/0/0');
  await press('n'); await wait(200);
  check('...N: still on the title, save kept', (await scenes()) + ' ' + (await saved()), 'Title 2 50 2/0/0');
  // SCREAM-90: the question's No can be clicked too.
  await press('Enter'); await wait(200);
  const noAt = await sc('Title', "(() => { const t = s.confirmGroup.find(o => o.text === 'No (N)'); return [Math.round(t.x), Math.round(t.y)]; })()");
  await page.mouse.click(noAt[0], noAt[1]); await wait(200);
  check('...clicking No closes it, save kept', (await sc('Title', 's.confirming')) + ' ' + (await saved()), 'false 2 50 2/0/0');
  await press('Enter'); await wait(200); await press('y'); await wait(300);
  await press('Enter'); await wait(300); // past the intro
  check('...Y: a new run at day 1 with $100, old save gone', (await story('r.day')) + ' ' + (await ev('e.moneyCents')) + ' ' + (await saved()), '1 10000 none');
  await press('Escape'); await wait(200); await press('ArrowDown', 2); await press('Enter'); await wait(150); await press('y'); await wait(300);

  // ---- Quick play unchanged ----
  check('Title remembers nothing: Quick play picked again', /> Quick play </.test(await texts('Title')), true);
  // SCREAM-90: click to start.
  const [cx, cy] = await optionAt('Quick play');
  await page.mouse.click(cx, cy); await wait(300);
  check('Quick play: $50, no Story run', (await ev('e.moneyCents')) + ' ' + (await story('r')), '5000 null');
  check('Quick play: HUD shows no day', /Day/.test(await hudClock()), false);
  await shift(3); await wait(300);
  check('Quick play ends on the results screen', await scenes(), 'Results');

  console.log(`\n${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await browser.close();
})();
