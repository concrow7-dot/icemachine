// SCREAM-53 (PO, October 30): Easy mode removed. One way to drive (car-style), no difficulty choice.
// Replaces difficulty_test.cjs.
const { chromium } = require('playwright');
(async () => {
  const [port, outDir] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  // A returning player: Easy was their last pick, with scores on both old tables.
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('icemachine.difficulty', 'easy');
    localStorage.setItem('icemachine.highscores.v1', JSON.stringify([{ initials: 'HRD', scoreCents: 1234, date: '2026-10-29' }]));
    localStorage.setItem('icemachine.highscores.easy.v1', JSON.stringify([{ initials: 'EZY', scoreCents: 99999, date: '2026-10-29' }]));
  });
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  const ev = (fn) => page.evaluate(`(() => { const e = window.__game.registry.get('evening'); return ${fn}; })()`);
  const sc = (key, fn) => page.evaluate(`(() => { const s = window.__game.scene.getScene('${key}'); return ${fn}; })()`);
  const scenes = () => page.evaluate(() => window.__game.scene.getScenes(true).map(s => s.scene.key).join(','));
  const texts = (key) => sc(key, 's.children.list.filter(o => o.type === "Text" && o.visible).map(o => o.text).join(" | ")');
  const wait = ms => page.waitForTimeout(ms);
  const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(60); } await wait(150); };
  const shift = async (d) => { await page.keyboard.down('Shift'); await page.keyboard.press('Digit' + d); await page.keyboard.up('Shift'); await wait(300); };
  const truck = () => sc('Drive', '[Math.round(s.truck.x), Math.round(s.truck.y), Math.round(s.heading), Math.round(s.speed)]');
  let pass = 0, fail = 0;
  const check = (name, got, want) => { const ok = String(got) === String(want); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(68) + ' got=' + got + (ok ? '' : ' want=' + want)); };

  // ---- Title: no choice, just how to drive ----
  const title = await texts('Title');
  check('Title: no difficulty choice (no EASY / HARD)', /EASY|HARD|Choose a difficulty/.test(title), false);
  check('Title: shows HOW TO DRIVE with the car-style controls', /HOW TO DRIVE/.test(title) && /gas/.test(title) && /Q park brake/.test(title), true);
  check('Title: Press Enter to start, credits still shown', /Press Enter to start/.test(title) && /LimeZu/.test(title) && /OpenStreetMap/.test(title), true);
  await page.screenshot({ path: outDir + '/title_oneway.png' });
  await page.click('canvas'); await press('ArrowLeft'); await press('ArrowRight');
  check('Arrow keys on the title do nothing (still on the title)', await scenes(), 'Title');

  // ---- Driving: car-style, even for a player who last picked Easy ----
  await press('Enter'); await wait(300);
  check('Enter starts the evening at the cooler', (await scenes()).startsWith('Cooler'), true);
  await press('+', 5); await press('Enter'); await wait(200); await press('ArrowRight'); await press('Enter'); await wait(800);
  await ev("(e.roadCustomerNow = { spot: 2 }, e.emit('road-customer-changed'), true)");
  check('Driving: park brake on at the start, sign showing', (await sc('Drive', 's.parkBrake')) + ' ' + (await sc('Drive', 's.parkLabel.visible')), 'true true');
  check('Driving: the hint shows the car-style controls', /↑ gas/.test(await texts('Drive')), true);
  const t0 = await truck();
  await page.keyboard.down('ArrowRight'); await wait(300); await page.keyboard.up('ArrowRight'); await wait(150);
  check('Right at a standstill does not turn the truck (no arrows-point-the-way)', (await truck())[2], t0[2]);
  await page.keyboard.down('ArrowUp'); await wait(300); await page.keyboard.up('ArrowUp');
  const t1 = await truck();
  check('Up is the gas: the truck pulls away slowly, still facing along the road', (t1[3] > 0 && t1[3] < 200) + ' ' + (t1[2] === t0[2]), 'true true');
  await wait(400);
  check('Let go and it rolls on at a creep (it doesn\'t stop dead)', (await truck())[3], 72);

  // ---- One high score table ----
  await shift(3); await wait(300);
  check('Results: the evening ends', await scenes(), 'Results');
  await page.evaluate(() => { const s = window.__game.scene.getScene('Results'); if (s.entering) s.save(); }); await wait(200);
  const results = await texts('Results');
  check('One table, headed HIGH SCORES (no difficulty)', /HIGH SCORES(?! ·)/.test(results) && !/EASY|HARD/.test(results), true);
  check('Scores saved before carry over (the old Hard table); old Easy scores are not shown', /HRD/.test(results) + ' ' + /EZY/.test(results), 'true false');
  check('Footer: no "change difficulty"', /change difficulty/.test(results), false);
  check('Tonight saved to the one table', await page.evaluate(() => JSON.parse(localStorage.getItem('icemachine.highscores.v1')).length), 2);
  await page.screenshot({ path: outDir + '/results_oneway.png' });

  console.log(`\n${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await browser.close();
})();
