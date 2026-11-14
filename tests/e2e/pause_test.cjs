const { chromium } = require('playwright');
(async () => {
  const [port, outDir] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  // SCREAM-175: these suites play as a player who has finished the tutorial (every mode unlocked).
  await page.addInitScript(() => { try { localStorage.setItem('icemachine.tutorial.done.v1', '1'); localStorage.setItem('icemachine.howtodrive.off.v1', '1'); } catch {} });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('icemachine.difficulty', 'hard'); });
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  const ev = (fn) => page.evaluate(`(() => { const e = window.__game.registry.get('evening'); return ${fn}; })()`);
  const sc = (key, fn) => page.evaluate(`(() => { const s = window.__game.scene.getScene('${key}'); return ${fn}; })()`);
  const scenes = () => page.evaluate(() => window.__game.scene.getScenes(true).map(s => s.scene.key).join(','));
  const status = (key) => page.evaluate((k) => { const s = window.__game.scene.getScene(k); return s.sys.isPaused() ? 'paused' : s.sys.isActive() ? 'running' : 'off'; }, key);
  const wait = ms => page.waitForTimeout(ms);
  const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(60); } await wait(150); };
  const shift = async (d) => { await page.keyboard.down('Shift'); await page.keyboard.press('Digit' + d); await page.keyboard.up('Shift'); await wait(300); };
  const scoresSaved = () => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('icemachine.highscores')).length);
  let pass = 0, fail = 0;
  const check = (name, got, want) => { const ok = String(got) === String(want); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(68) + ' got=' + got + (ok ? '' : ' want=' + want)); };

  await page.click('canvas'); await wait(200);
  await press('Escape');
  check('Title screen: Esc does nothing', await scenes(), 'Title');

  // ---- In the truck (the evening opens at the cooler; buying one ice cream goes to the truck and starts the clock) ----
  await press('Enter'); await wait(300); await press('+'); await press('Enter'); await wait(300);
  await press('Escape');
  check('Esc in the truck: pause menu opens', await status('Pause'), 'running');
  check('...the truck screen and the HUD are frozen', (await status('Truck')) + ' ' + (await status('Hud')), 'paused paused');
  check('Pause menu sits over the truck interior picture (SCREAM-123)', await page.evaluate(() => window.__game.scene.getScene('Pause').children.list.some(o => o.texture && o.texture.key === 'truck-interior')), true);
  const c0 = await ev('e.clockMinutes'); await wait(1500);
  check('...the clock stops while paused', await ev('e.clockMinutes'), c0);
  await page.screenshot({ path: outDir + '/pause_menu.png' });
  await press('Escape');
  check('Esc again: back to the truck, menu gone', (await status('Pause')) + ' ' + (await status('Truck')) + ' ' + (await status('Hud')), 'off running running');
  await wait(1200);
  check('...and the clock runs again', (await ev('e.clockMinutes')) > c0, true);

  // ---- Driving ----
  await press('Enter'); await wait(200); await press('+', 5); await press('Enter'); await wait(200);
  await press('ArrowRight'); await press('Enter'); await wait(800);
  // Nobody wants ice cream during these checks, so driving never starts a sale (SCREAM-67)
  await ev('(e.residents.hearingOff = true, true)');
  await page.keyboard.down('ArrowUp'); await wait(800);
  await press('Escape');
  const x0 = await sc('Drive', 'Math.round(s.truck.x)');
  await page.keyboard.up('ArrowUp'); await wait(1000);
  check('Paused while driving: the truck stands still', await sc('Drive', 'Math.round(s.truck.x)'), x0);
  await press('Enter'); // Resume is highlighted
  check('Enter on Resume: driving again', (await status('Pause')) + ' ' + (await status('Drive')), 'off running');
  check('...gas let go during the pause is not stuck on', JSON.stringify(await sc('Drive', 's.held')), '[]');

  // ---- At the sales window: timers stop ----
  await shift(4); await wait(300);
  const p0 = await ev('Math.round(e.sale.patienceLeftSeconds(e.nowMs) * 10)');
  await press('Escape'); await wait(2000);
  check('Paused at the sales window: the customer\'s patience stops too', await ev('Math.round(e.sale.patienceLeftSeconds(e.nowMs) * 10)'), p0);
  // Resume with a click
  const box = await (await page.$('canvas')).boundingBox();
  const resume = await sc('Pause', '(() => { const t = s.items[0]; return [t.x, t.y]; })()');
  await page.mouse.click(box.x + resume[0], box.y + resume[1]); await wait(300);
  check('Clicking Resume works too', (await status('Pause')) + ' ' + (await status('Sales')), 'off running');

  // ---- Restart, with "Are you sure?" ----
  await press('Escape');
  check('SCREAM-206: the menu reads Resume, End Evening, Restart Evening, Key Bindings, Quit To Title (Quick play: nothing to save)', await sc('Pause', "s.items.map(t => t.text.replace(/[<>]/g, '').trim()).join(', ')"), 'Resume, End Evening, Restart Evening, Key Bindings, Quit To Title');
  check('...the items sit in the middle, between PAUSED and the hint line', await sc('Pause', '(() => { const mid = (s.items[0].y + s.items[s.items.length - 1].y) / 2; const title = s.children.list.find(o => o.text === "PAUSED"); return Math.abs(mid - ((title.y + 17) + (s.hint.y - 7)) / 2) <= 6; })()'), true);
  // SCREAM-206: the Key Bindings page (fourth; quitting is last).
  await press('ArrowDown', 3);
  check('SCREAM-206: ↓ x3 highlights Key Bindings', await sc('Pause', 's.items[s.selected].text.replace(/[<>]/g, "").trim()'), 'Key Bindings');
  await press('Enter');
  check('SCREAM-206: Key Bindings opens over the menu, which waits', (await status('KeyBindings')) + ' ' + (await status('Pause')), 'running paused');
  check('...the evening behind stays frozen', (await status('Sales')) + ' ' + (await status('Hud')), 'paused paused');
  check('...page 1 lists the driving keys', await sc('KeyBindings', "s.lines.includes('Q: Park Brake (When Stopped)') && s.lines.includes('↑ Or W: Gas')"), true);
  check('...there is more than one page', await sc('KeyBindings', 's.pages.length > 1'), true);
  await page.screenshot({ path: outDir + '/key_bindings_1.png' });
  await press('ArrowRight');
  check('...→ turns to page 2, which has lines too', (await sc('KeyBindings', 's.page')) + ' ' + (await sc('KeyBindings', 's.lines.length > 3')), '1 true');
  check('...every group of keys is on some page', await sc('KeyBindings', "s.pages.flat().length"), 12);
  await press('ArrowLeft');
  check('...← turns back to page 1', await sc('KeyBindings', 's.page'), 0);
  await press('Escape');
  check('SCREAM-206: Esc closes the page: the pause menu is back', (await status('KeyBindings')) + ' ' + (await status('Pause')) + ' ' + (await status('Sales')), 'off running paused');
  await press('ArrowDown', 2); // from Key Bindings, past the last item, round to Resume
  await press('ArrowDown', 2);
  check('↓ ↓ highlights Restart evening', await sc('Pause', 's.selected'), 2);
  await press('Enter');
  check('Restart asks "Are you sure?"', /Restart this evening\?/.test(await sc('Pause', 's.prompt.visible && s.prompt.text')), true);
  await page.screenshot({ path: outDir + '/pause_confirm.png' });
  check('Yes and No are shown, with No picked first (the safe choice)', (await sc('Pause', 's.answers.map(a => a.visible).join()')) + ' ' + (await sc('Pause', 's.answer')), 'true,true 1');
  await press('Enter');
  check('Enter on No: back to the menu, nothing restarted', (await sc('Pause', 's.items[0].visible')) + ' ' + (await status('Sales')), 'true paused');
  await press('Enter'); await press('ArrowLeft');
  check('← moves the highlight to Yes', await sc('Pause', 's.answer'), 0);
  await press('ArrowRight'); await press('n');
  check('N still works as a shortcut for no', (await sc('Pause', 's.items[0].visible')) + ' ' + (await status('Sales')), 'true paused');
  await press('Enter');
  const yesAt = await sc('Pause', '[s.answers[0].x, s.answers[0].y]');
  const b2 = await (await page.$('canvas')).boundingBox();
  await page.mouse.click(b2.x + yesAt[0], b2.y + yesAt[1]); await wait(400);
  check('Clicking Yes restarts', (await scenes()) + ' ' + Math.floor(await ev('e.clockMinutes')), 'Cooler,Hud 1020');
  await wait(300); await press('+'); await press('Enter'); await wait(300); await press('Escape'); await press('ArrowDown', 2);
  await press('Enter'); await press('y'); await wait(400);
  check('Y (shortcut): a brand-new evening (cooler, 5:00 PM, $50, menu gone)', [await scenes(), Math.floor(await ev('e.clockMinutes')), await ev('e.moneyCents')].join(' '), 'Cooler,Hud 1020 5000');
  check('...and the restarted evening saved no high score', await scoresSaved(), 0);

  // ---- Quit ----
  await wait(500); await press('Escape'); await press('ArrowUp'); await press('Enter'); // ↑ from Resume wraps to the last item
  check('Quit asks "Are you sure?"', /Quit to the title screen\?/.test(await sc('Pause', 's.prompt.text')), true);
  await press('y'); await wait(400);
  check('Y: title screen, every evening screen stopped', await scenes(), 'Title');
  check('...no high score from the quit evening', await scoresSaved(), 0);

  // ---- Results keep Esc for the title ----
  // SCREAM-290: End Evening, from the cooler, does what Shift+3 does.
  await press('Enter'); await wait(300); await press('Escape'); await wait(200); await press('ArrowDown'); await press('Enter');
  check('SCREAM-290: End Evening asks first', /End this evening now\?/.test(await sc('Pause', 's.prompt.visible && s.prompt.text')) + ' ' + (await sc('Pause', 's.answer')), 'true 1');
  await page.screenshot({ path: outDir + '/pause_end_evening.png' });
  await press('y'); await wait(500);
  check('...Y: the evening ends (results screen)', (await scenes()).includes('Results'), true);
  await page.evaluate(() => { const s = window.__game.scene.getScene('Results'); if (s.entering) s.save(); }); await wait(150);
  await press('Escape'); await wait(300);
  check('Results screen: Esc still goes to the title (no pause menu)', await scenes(), 'Title');

  console.log(`\n${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await browser.close();
})();
