const { chromium } = require('playwright');
(async () => {
  const [port, outDir] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('icemachine.difficulty', 'hard'); });
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  const ev = (fn) => page.evaluate(`(() => { const e = window.__game.registry.get('evening'); return ${fn}; })()`);
  const scenes = () => page.evaluate(() => window.__game.scene.getScenes(true).map(s => s.scene.key).join(','));
  const res = (fn) => page.evaluate(`(() => { const s = window.__game.scene.getScene('Results'); return ${fn}; })()`);
  const wait = ms => page.waitForTimeout(ms);
  const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(40); } await wait(100); };
  const shift = async (d) => { await page.keyboard.down('Shift'); await page.keyboard.press('Digit' + d); await page.keyboard.up('Shift'); await wait(300); };
  const table = () => page.evaluate(() => JSON.parse(Object.entries(localStorage).find(([k]) => k.startsWith('icemachine.highscores'))?.[1] ?? '[]').map(s => s.initials + ':' + s.scoreCents).join(' '));
  // Plays an "evening" that ends with the given profit, then lands on the results screen.
  const eveningWithProfit = async (cents) => { await ev(`(e.cashCents = 5000 + ${cents}, true)`); await shift(3); };
  let pass = 0, fail = 0;
  const check = (name, got, want) => { const ok = String(got) === String(want); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(64) + ' got=' + got + (ok ? '' : ' want=' + want)); };

  // ---- Evening 1: a real sale, some damage, a negative profit ----
  await page.click('canvas'); await press('Enter'); await wait(200);
  // The title now opens the cooler directly (#66)
  await press('+', 2); await press('Enter'); await wait(200);
  await press('ArrowRight'); await press('Enter'); await wait(500);
  await shift(4);
  await ev(`(() => { const s = e.sale; s.order.splice(0, s.order.length, { slot: 0, flavour: 'eclair', count: 1 }); return true; })()`);
  await press('c'); await wait(300); await press('+'); await press('Enter'); await wait(300);
  await page.keyboard.type('2'); await press('Enter'); await press('Enter'); await wait(300);
  await ev("(e.takeDamage(500, 'Pothole'), true)");
  await shift(3);
  check('Evening over: results screen', await scenes(), 'Results');
  check('Breakdown: sales $2.00, tips $0.40, stock $2.00, damage $5.00',
    JSON.stringify(await ev('e.breakdown')), JSON.stringify({ salesCents: 200, tipsCents: 40, stockCents: 200, damageCents: 500 }));
  check("Tonight's profit = sales + tips - stock - damage (-$4.60)", await ev('e.profitCents'), -460);
  check('Empty table: even a negative evening makes the top 5', await res('s.entering'), true);
  await page.screenshot({ path: outDir + '/scores_entry.png' });
  await page.keyboard.type('con', { delay: 60 }); await wait(150);
  check('Typing letters fills the initials', await res('s.initialsText'), 'CON');
  await press('Enter'); await wait(200);
  check('Saved: CON at -$4.60', await table(), 'CON:-460');
  check('...new score highlighted at rank 1', await res('s.tableGroup.some(o => o.type === "Rectangle")'), true);
  await page.screenshot({ path: outDir + '/scores_table_1.png' });

  // ---- Fill the table, using the arrow keys for initials ----
  const plays = [[1000, 'B'], [2000, 'C'], [500, 'D'], [3000, 'E']];
  for (const [cents, letter] of plays) {
    await press('Enter'); await wait(300);
    await eveningWithProfit(cents);
    const steps = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(letter);
    await press('ArrowUp', steps); await press('Enter'); await wait(150);
  }
  check('Arrow keys: ↑ changes the letter (B, C, D, E then AA)', (await table()).split(' ').map(s => s.split(':')[0]).sort().join(','), 'BAA,CAA,CON,DAA,EAA');
  check('Table is highest first, top 5', await table(), 'EAA:3000 CAA:2000 BAA:1000 DAA:500 CON:-460');

  // ---- Not good enough ----
  await press('Enter'); await wait(300);
  await eveningWithProfit(-1000);
  check('-$10.00 is below the 5th score: no initials asked', await res('s.entering'), false);
  check('...table unchanged', await table(), 'EAA:3000 CAA:2000 BAA:1000 DAA:500 CON:-460');

  // ---- A new 3rd place pushes the lowest out ----
  await press('Enter'); await wait(300);
  await eveningWithProfit(1500);
  check('$15.00 makes the table', await res('s.entering'), true);
  await press('ArrowRight'); await press('ArrowUp', 25); await press('Enter'); await wait(150);
  check('← → move between letters, ↓ wraps (A -> Z)', (await table()).split(' ')[2], 'AZA:1500');
  check('...lands 3rd; the old 5th (CON) drops off', await table(), 'EAA:3000 CAA:2000 AZA:1500 BAA:1000 DAA:500');
  await page.screenshot({ path: outDir + '/scores_table_2.png' });

  // ---- A tie goes below the older score ----
  await press('Enter'); await wait(300);
  await eveningWithProfit(1500);
  await wait(200); await page.keyboard.type('tie', { delay: 60 }); await press('Enter');
  check('A tie goes below the older score', await table(), 'EAA:3000 CAA:2000 AZA:1500 TIE:1500 BAA:1000');

  // ---- Kept on this computer ----
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  check('Still there after reloading the page', await table(), 'EAA:3000 CAA:2000 AZA:1500 TIE:1500 BAA:1000');
  const key = await page.evaluate(() => Object.keys(localStorage).find(k => k.startsWith('icemachine.highscores')));
  check('Stored under one key for every build (scores survive updates)', key, 'icemachine.highscores.v1');

  // ---- Esc goes to the title ----
  await page.click('canvas'); await press('Enter'); await wait(200);
  await eveningWithProfit(-5000);
  await press('Escape'); await wait(200);
  check('Esc on the results screen: title', await scenes(), 'Title');

  console.log(`\n${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await browser.close();
})();
