// SCREAM-19: Story mode's wallet. Cash and stock carry from one evening to the
// next, Restart evening goes back to how tonight started, running out of money
// is game over, and Quick play is unchanged.
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

  // ---- Day 1 ----
  await press('Enter'); await wait(300);
  check('Story starts at the cooler', (await scenes()).startsWith('Cooler'), true);
  check('Story starts on day 1 of 3', await story('r.day + "/" + r.days'), '1/3');
  check('Story starts with $100', await ev('e.moneyCents'), 10000);
  check('HUD shows the day beside the clock', /Day 1\/3/.test(await hudClock()), true);
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
  check('...Enter goes back to the title', /Enter: back to the title/.test(last), true);
  await press('Enter'); await wait(300);
  check('Back at the title, Story run cleared', (await scenes()) + ' ' + (await story('r')), 'Title null');

  // ---- Out of money: game over ----
  await press('ArrowDown'); await press('Enter'); await wait(300);
  await ev('(e.cashCents = -100, true)');
  await shift(3); await wait(300);
  const over = await texts('DayEnd');
  check('Below $0 at the end of an evening: GAME OVER', /GAME OVER/.test(over) && /out of money/.test(over), true);
  check('...the run is over', await story('r.outcome'), 'broke');
  await page.screenshot({ path: outDir + '/story_game_over.png' });
  await press('Enter'); await wait(300);
  check('...Enter: back to the title', await scenes(), 'Title');

  // Empty cooler and less than the cheapest bar ($1): game over too.
  await press('ArrowDown'); await press('Enter'); await wait(300);
  await ev('(e.cashCents = 50, true)');
  await shift(3); await wait(300);
  check('Empty cooler and $0.50: GAME OVER', /GAME OVER/.test(await texts('DayEnd')), true);
  await press('Enter'); await wait(300);
  // ...but with stock left, $0.50 isn't game over: you can still sell.
  await press('ArrowDown'); await press('Enter'); await wait(300);
  await press('+', 2); await press('Enter'); await wait(300);
  await ev('(e.cashCents = 50, true)');
  await shift(3); await wait(300);
  check('$0.50 with 2 bars left: carries on to day 2', /END OF DAY 1/.test(await texts('DayEnd')), true);

  // ---- Quitting a Story run from the pause menu ----
  await press('Enter'); await wait(300); await press('Enter'); await wait(300);
  await press('Escape'); await wait(200); await press('ArrowDown', 2); await press('Enter'); await wait(150);
  check('Quit prompt says the Story run will end', /Story run will end/.test(await texts('Pause')), true);
  await press('y'); await wait(300);
  check('Quit: title, Story run cleared', (await scenes()) + ' ' + (await story('r')), 'Title null');

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
