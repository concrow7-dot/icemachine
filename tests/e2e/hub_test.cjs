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
  // These checks cover hard (car-style) driving; the title remembers the last difficulty picked
  await page.evaluate(() => localStorage.setItem('icemachine.difficulty', 'hard')); await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  const scenes = () => page.evaluate(() => window.__game.scene.getScenes(true).map(s => s.scene.key).join(','));
  const sel = () => page.evaluate(() => window.__game.scene.getScene('Truck').selected);
  const clock = () => page.evaluate(() => window.__game.registry.get('evening')?.clockMinutes.toFixed(2));
  const wait = ms => page.waitForTimeout(ms);
  const press = async k => { await page.keyboard.press(k); await wait(150); };
  let pass = 0, fail = 0;
  const check = (name, got, want) => { const ok = String(got) === String(want); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(52) + ' got=' + got + (ok ? '' : ' want=' + want)); };

  await page.click('canvas'); await press('Enter'); await wait(200);
  check('Enter on title opens the cooler first (#66)', await scenes(), 'Cooler,Hud');
  const clockAt = async () => page.evaluate(() => window.__game.registry.get('evening').clockMinutes);
  const k0 = await clockAt(); await wait(1200);
  check('...with the clock waiting at 4:00 PM', (await clockAt()) === k0 && Math.floor(k0) === 960, true);
  check('...and a note saying so', await page.evaluate(() => window.__game.scene.getScene('Cooler').children.list.some(o => o.text && o.text.startsWith('The clock starts when you leave the cooler'))), true);
  await press('b'); await wait(200);
  check("B with an empty cooler: can't leave yet", await scenes(), 'Cooler,Hud');
  await press('+'); await press('Enter'); await wait(200);
  check('Buying one ice cream leaves for the truck hub', await scenes(), 'Truck,Hud');
  const k1 = await clockAt(); await wait(1200);
  check('...and the clock starts', (await clockAt()) > k1, true);
  check('Cooler highlighted by default', await sel(), 'cooler');
  await page.screenshot({ path: outDir + '/hub_no_customer.png' });
  await press('ArrowRight');
  check('Right -> driver seat', await sel(), 'driver');
  await press('ArrowRight');
  check('Right again skips unavailable window -> menu board (SCREAM-57)', await sel(), 'menu');
  await press('ArrowRight');
  check('Right from the menu board -> cooler', await sel(), 'cooler');
  await press('ArrowLeft'); await press('ArrowLeft');
  check('Left from the menu board skips window -> driver', await sel(), 'driver');
  // Mouse on unavailable window: no highlight, no action
  await page.mouse.move(890, 200); await wait(150);
  check('Hovering unavailable window keeps highlight', await sel(), 'driver');
  await page.mouse.click(890, 200); await wait(250);
  check('Clicking unavailable window does nothing', await scenes(), 'Truck,Hud');
  // SCREAM-57: the hub is the PO's drawing, with the parts of it clickable
  check('Hub shows the truck interior picture', await page.evaluate(() => window.__game.scene.getScene('Truck').children.list.some(o => o.texture && o.texture.key === 'truck-interior')), true);
  await page.mouse.move(480, 200); await wait(150);
  check('Hover the front of the truck highlights driving', await sel(), 'driver');
  check('...with a DRIVE tag', await page.evaluate(() => window.__game.scene.getScene('Truck').tag.text), 'DRIVE');
  await page.mouse.move(130, 180); await wait(150);
  check('Hover the menu board highlights it', await sel(), 'menu');
  check('...tagged MENU in Quick play (SCREAM-267)', await page.evaluate(() => window.__game.scene.getScene('Truck').tag.text), 'MENU');
  await page.mouse.click(130, 180); await wait(250);
  check('Click the menu board opens the menu', await page.evaluate(() => window.__game.scene.isActive('Pause')), true);
  await press('Escape'); await wait(250);
  check('...and Esc closes it back to the truck', await scenes(), 'Truck,Hud');
  await page.mouse.move(480, 500); await wait(150);
  check('Hovering the floor changes nothing', await sel(), 'menu');
  // mouse hover + click cooler (the freezer)
  await page.mouse.move(150, 440); await wait(150);
  check('Hover cooler highlights it', await sel(), 'cooler');
  await page.mouse.click(150, 440); await wait(250);
  check('Click cooler opens cooler screen', await scenes(), 'Cooler,Hud');
  await press('Backspace'); await wait(150);
  check('Backspace returns to truck', await scenes(), 'Truck,Hud');
  check('...with cooler highlighted', await sel(), 'cooler');
  // driver seat via keyboard
  await press('ArrowRight'); await press('Enter');
  await page.waitForFunction(() => window.__game.scene.getScenes(true).map(s => s.scene.key).join(',') === 'Drive,Hud', null, { timeout: 3000 }).catch(() => {}); // slow machines take longer to switch
  check("Enter on driver's seat opens driving view", await scenes(), 'Drive,Hud');
  const c1 = await clock(); await wait(1200); const c2 = await clock();
  check('Clock keeps running while driving', Number(c2) > Number(c1), true);
  await page.evaluate(() => { const e = window.__game.registry.get('evening'); e.coolerSlots[0].quantity = 3; e.residents.callNow(e.residents.all.find(p => p.customer === 'none')); }); await wait(200);
  await page.evaluate(() => { const s = window.__game.scene.getScene('Drive'); (s.truck.setPosition(s.pickupZone.x, s.pickupZone.y), s.speed = 0, s.parkBrake = true); }); await wait(300);
  check('Reaching a customer opens the sales screen', await scenes(), 'Sales,Hud');
  const c3 = await clock(); await wait(1200); const c4 = await clock();
  check('Clock keeps running at the window', Number(c4) > Number(c3), true);
  await press('1');
  check('Plain 1 does nothing (free for typing prices)', await page.evaluate(() => window.__game.registry.get('evening').moneyCents), 4900);
  await page.keyboard.down('Shift'); await page.keyboard.press('Digit1'); await page.keyboard.up('Shift'); await wait(200);
  check('Shift+1 adds $4.50', await page.evaluate(() => window.__game.registry.get('evening').moneyCents), 5350);
  await press('b'); await wait(300);
  await page.keyboard.down('Shift'); await page.keyboard.press('Digit3'); await page.keyboard.up('Shift'); await wait(200);
  check('Shift+3 ends the evening from the road', await scenes(), 'Results');
  // A first evening makes the (empty) high score table: save the initials to continue (#16)
  await page.evaluate(() => { const s = window.__game.scene.getScene('Results'); if (s.entering) s.save(); }); await wait(100); 
  await press('Enter'); await wait(250);
  check('New evening opens at the cooler again, clock waiting', (await scenes()) + ' ' + (await page.evaluate(() => window.__game.registry.get('evening').isClockRunning)), 'Cooler,Hud false');
  check('New evening has no customer waiting', await page.evaluate(() => window.__game.registry.get('evening').customerWaiting), false);
  // ---- SCREAM-267: Story's cork board opens the power-ups skill map (a dummy to look at) ----
  const sc = (key, fn) => page.evaluate(`(() => { const s = window.__game.scene.getScene('${key}'); return ${fn}; })()`);
  const until = async (fn, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await wait(50); } return false; };
  await page.evaluate(() => localStorage.removeItem('icemachine.story.v2'));
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  await page.click('canvas'); await page.mouse.move(5, 5); await wait(200);
  await sc('Title', "(() => { const i = s.modeTexts.findIndex(o => o.text.includes('Story')); s.modeTexts[i].emit('pointerover'); })()");
  await press('Enter'); await wait(300); await press('o'); await wait(300);
  await until(async () => (await scenes()) === 'StoryIntro');
  await press('Enter');
  await until(async () => (await scenes()).startsWith('Cooler'));
  await press('+'); await press('Enter');
  await until(async () => (await scenes()) === 'Truck,Hud');
  check('SCREAM-267: Story, On My Own: in the hub', await scenes(), 'Truck,Hud');
  await page.mouse.move(130, 180); await wait(150);
  check('...the board above the cooler is tagged POWER-UPS', (await sel()) + ' ' + (await sc('Truck', 's.tag.text')), 'menu POWER-UPS');
  await page.mouse.click(130, 180);
  await until(async () => (await scenes()) === 'PowerUps,Hud');
  check('...a click opens the cork board, not the menu', await scenes(), 'PowerUps,Hud');
  const boardTexts = () => sc('PowerUps', "s.children.list.filter(o => o.type === 'Text').map(o => o.text).join(' | ')");
  check('SCREAM-395: ...with two trees, MONEY and XP (SCREAM-398: the XP label has no amount)', (await boardTexts()).split(' | ').filter(t => ['TRUCK', 'ICE CREAM', 'CUSTOMER', 'MONEY', 'XP', 'XP: 0'].includes(t)).join(','), 'MONEY,XP');
  check('...21 notes pinned to it (SCREAM-395: no dummies; SCREAM-396: no sandwich)', await sc('PowerUps', 's.notes.length'), 21);
  // SCREAM-296: notes have pictures and prices, open bigger, and can be bought.
  const pu = (fn) => sc('PowerUps', fn);
  const cashNow = () => page.evaluate(() => window.__game.registry.get('evening').moneyCents);
  const noteAt = (id) => pu(`s.reveal('${id}')`); // SCREAM-397: scrolls the board to the note first
  const big = () => pu("s.open + ' | ' + s.bigTexts.join(' | ') + ' | button=' + !!s.buyButton");
  check('...the first note is marked, and the card gives its name and price', (await pu('s.selected')) + ' / ' + (await pu('s.detailName.text')) + ' / ' + (await pu('s.detailStatus.text')), 'temp-gas-can / TEMPORARY GAS CAN / $10.00');
  check('...no ice cream says ? any more (SCREAM-334, SCREAM-335)', await pu("s.notes.filter(n => n.logo === 'question').map(n => n.id).join()"), '');
  check('...nothing is owned yet but the Chocolate Eclair (SCREAM-271)', await pu("s.notes.filter(n => s.status(n.id) === 'owned').map(n => n.id).join()"), 'icecream-eclair');
  check('SCREAM-396: the eclair on top, SpongePop under the Speaker and the Drum Cone under the Bass, the Lou Ball and the Explorer Pop last under More Space for Scream; no sandwich', await pu("s.notes.filter(n => n.id.startsWith('icecream')).map(n => n.name + '<' + n.from.join('+')).join(' | ')"), 'CHOCOLATE ECLAIR< | SPONGEPOP<upgrade-speaker | DRUM CONE<heavier-bass | TWO BALL LOU BALL<more-junk | LIL EXPLORER POP<more-junk');
  check('...SpongePop and the Drum Cone sit level, left and right of the eclair; the Lou Ball and the Explorer Pop are lowest (SCREAM-397: below the view until the board scrolls)', await pu("(() => { const at = (id) => s.notes.find(n => n.id === 'icecream-' + id); const [e, sp, ex, l, r] = ['eclair','spongepop','drumcone','louball','explorer'].map(at); return [sp.y === ex.y, sp.x < e.x && e.x < ex.x, l.x === sp.x && r.x === ex.x, l.y === r.y && l.y > sp.y, l.y === Math.max(...s.notes.map(n => n.y)) && l.y > 420 && s.maxScroll > 0].join(); })()"), 'true,true,true,true,true');
  check('SCREAM-396: only the gas can can be bought first; the speakers and the ice creams wait', await pu("['temp-gas-can','upgrade-speaker','heavier-bass','icecream-spongepop','icecream-drumcone','service-with-a-smile','more-junk','icecream-louball'].map(id => s.status(id)).join()"), 'ok,locked,locked,locked,locked,locked,locked,locked');
  await page.mouse.move(5, 5); await wait(100);
  await page.screenshot({ path: outDir + '/hub_cork_board.png' });
  // ---- SCREAM-397: the cork board scrolls; both trees move together ----
  {
    const ys = () => pu("['icecream-eclair','icecream-louball','trot'].map(id => Math.round(s.notes.find(n => n.id === id).y)).join()");
    const buttons = () => pu("s.scrollArt.map(a => a.visible).join()");
    check('SCREAM-397: the board opens at the top: rows 60 px apart, the last Money rows below the view, only the down button showing', (await pu('s.scrollY')) + ' ' + (await pu('s.maxScroll')) + ' ' + (await ys()) + ' ' + (await buttons()), '0 107 136,496,136 false,true');
    await page.mouse.move(480, 300); await page.mouse.wheel(0, 100); await wait(150);
    check('...the mouse wheel moves it down a row; both trees move together; both buttons show', (await pu('s.scrollY')) + ' ' + (await ys()) + ' ' + (await buttons()), '60 76,436,76 true,true');
    check('...a note scrolled under the labels can\'t be clicked; one in the view can', await pu("s.zones.get('icecream-eclair').input.enabled + ' ' + s.zones.get('temp-gas-can').input.enabled"), 'false true');
    const down = await pu('[s.scrollDownButton.x + 20, s.scrollDownButton.y + 20]');
    await page.mouse.click(down[0], down[1]); await wait(150);
    check('...the down button moves it to the end and then hides', (await pu('s.scrollY')) + ' ' + (await ys()) + ' ' + (await buttons()), '107 29,389,29 true,false');
    await page.mouse.move(5, 5); await wait(100);
    await page.screenshot({ path: outDir + '/hub_cork_board_scrolled.png' });
    await page.mouse.move(700, 300); await page.mouse.down(); await page.mouse.move(700, 340, { steps: 4 }); await page.mouse.up(); await wait(150);
    check('...dragging the cork down 40 px moves the board back 40', await pu('s.scrollY'), 67);
    const lou = await pu("(() => { const n = s.notes.find(n => n.id === 'icecream-drumcone'); return [n.x, n.y]; })()");
    await page.mouse.move(lou[0], lou[1]); await page.mouse.down(); await page.mouse.move(lou[0], lou[1] + 30, { steps: 4 }); await page.mouse.up(); await wait(150);
    check('...a drag that starts on a note scrolls and doesn\'t open it', (await pu('s.scrollY')) + ' ' + (await pu('s.open')), '37 false');
    const up = await pu('[s.scrollUpButton.x + 20, s.scrollUpButton.y + 20]');
    await page.mouse.click(up[0], up[1]); await wait(150);
    check('...the up button goes back to the top', (await pu('s.scrollY')) + ' ' + (await buttons()), '0 false,true');
    await page.mouse.move(5, 5); await wait(100);
    await pu("(s.selected = 'more-junk', s.refresh(), true)");
    await press('ArrowDown');
    check('...the arrow keys bring the highlighted note into view (Down from More Space for Scream)', (await pu('s.selected')) + ' ' + (await pu('s.scrollY')) + ' ' + (await pu("Math.round(s.notes.find(n => n.id === s.selected).y) <= 420 - 23")), 'icecream-louball 107 true');
    check('...showing the gas can again scrolls back only as far as needed; showing the eclair, to the top', (await pu("(s.reveal('temp-gas-can'), s.scrollY)")) + ' ' + (await pu("(s.reveal('icecream-eclair'), s.scrollY)")), '59 0');
    await pu("(s.selected = 'temp-gas-can', s.refresh(), true)");
  }
  await press('ArrowDown');
  check('...Down moves to the nearest note below (SCREAM-396: Service With A Smile, straight under the gas can)', await pu('s.selected'), 'service-with-a-smile');
  for (let i = 0; i < 4; i++) await press('ArrowRight');
  check('...Right four times crosses into the next tree', (await pu('s.selected')) + ' / ' + (await pu('s.detailName.text')) + ' / ' + (await pu('s.detailStatus.text')), 'back-it-up / BACK IT UP / 60 XP');
  {
    // SCREAM-25 (PO, November 15): "Change "more Junk" to "More Space for Scream"": a long name, on two lines.
    const junk = await noteAt('more-junk');
    await page.mouse.click(junk[0], junk[1]); await wait(150);
    check('SCREAM-25, SCREAM-364: the cooler note is MORE SPACE FOR SCREAM, $15 (SCREAM-369), locked until Service With A Smile (SCREAM-396)', await big(), 'true | MORE SPACE FOR SCREAM | More room in the cooler: a new bottom row opens in every crate. | $15.00 | SERVICE WITH A SMILE Required | button=false');
    await page.screenshot({ path: outDir + '/hub_note_more_space.png' });
    await press('b');
  }
  let ice = await noteAt('icecream-eclair');
  await page.mouse.click(ice[0], ice[1]); await wait(150);
  check('SCREAM-271: the Chocolate Eclair is yours from the start, with its price note and no $0.00', await big(), "true | CHOCOLATE ECLAIR | Owned from the start. If you have these stocked in your cooler, every customer will buy an extra ice cream. The average person won't pay more than $2.50 for one. Costs you $1.00 each to stock. | Owned | button=false");
  check('SCREAM-352: its four paragraphs have an empty line between, and everything fits on the paper', await pu("(() => { const l = s.bigLayout; return [s.bigDescription.text.split('\\n\\n').length, l.top >= 8, l.bottom <= 500, l.textBottom + 12 <= (false ? l.priceY - 16 : l.buttonY - 10), l.buttonY + 23 <= l.bottom - 6].join(' '); })()"), '4 true true true true');
  await page.screenshot({ path: outDir + '/hub_note_eclair.png' });
  await press('b');
  ice = await noteAt('icecream-spongepop');
  await page.mouse.click(ice[0], ice[1]); await wait(150);
  check('...SpongePop costs $15.00 (SCREAM-376) and waits for the Speaker (SCREAM-396)', await big(), "true | SPONGEPOP | Kids who order one tip more. The average person won't pay more than $3.00 for one. Costs you $1.25 each to stock. | $15.00 | UPGRADE SPEAKER Required | button=false");
  check('SCREAM-352: SpongePop\'s note: what it does, the most a customer pays, what it costs to stock; the price and BUY sit below', (await pu("s.bigDescription.text.split('\\n\\n').join(' / ')")) + ' | ' + (await pu("(() => { const l = s.bigLayout; return [s.bigDescription.text.split('\\n\\n').length, l.top >= 8, l.bottom <= 500, l.textBottom + 12 <= (true ? l.priceY - 16 : l.buttonY - 10), l.buttonY + 23 <= l.bottom - 6].join(' '); })()")), "Kids who order one tip more. / The average person won't pay more than $3.00 for one. / Costs you $1.25 each to stock. | 3 true true true true");
  await page.screenshot({ path: outDir + '/hub_note_spongepop.png' });
  await page.mouse.move(5, 300); await wait(100);
  await page.screenshot({ path: outDir + '/hub_cork_note_ice_cream.png' });
  await press('b');
  ice = await noteAt('service-with-a-smile');
  await page.mouse.click(ice[0], ice[1]); await wait(150);
  check('SCREAM-303: Service With A Smile, $10 (SCREAM-369), under SpongePop or the Drum Cone (SCREAM-396)', await big(), 'true | SERVICE WITH A SMILE | Tips start higher, and you get more time to earn one. | $10.00 | SPONGEPOP or DRUM CONE Required | button=false');
  await page.mouse.move(5, 300); await wait(100);
  await page.screenshot({ path: outDir + '/hub_cork_note_smile.png' });
  check('SCREAM-396: ...the eclair is the Money tree\'s only top note, and More Space for Scream hangs under Service With A Smile', await pu("s.notes.filter(n => n.tree === 0 && n.from.length === 0).map(n => n.id).join() + ' ' + s.notes.filter(n => n.from.includes('service-with-a-smile')).map(n => n.id).join()"), 'icecream-eclair more-junk');
  // SCREAM-81 (PO, November 14): the left note under it is Upgrade Speaker, $30.
  await press('b');
  ice = await noteAt('upgrade-speaker');
  await page.mouse.click(ice[0], ice[1]); await wait(150);
  check('SCREAM-81: Upgrade Speaker, $15, under the gas can (SCREAM-396)', await big(), 'true | UPGRADE SPEAKER | Increase the reach of the speaker. | $15.00 | TEMPORARY GAS CAN Required | button=false');
  await page.mouse.move(5, 300); await wait(100);
  await page.screenshot({ path: outDir + '/hub_cork_note_speaker.png' });
  // SCREAM-317 (PO, November 14): the right note under it is Calculator, $30.
  await press('b');
  ice = await noteAt('calculator');
  await page.mouse.click(ice[0], ice[1]); await wait(150);
  check('SCREAM-317: Calculator; SCREAM-398: 50 XP, under Trot', await big(), 'true | CALCULATOR | Get a calculator to use at the sales window. | 50 XP | TROT Required | button=false');
  await page.mouse.move(5, 300); await wait(100);
  await page.screenshot({ path: outDir + '/hub_cork_note_calculator.png' });
  // SCREAM-329 (PO, November 14, notepad sketch): the third row's left note is Speaker with Heavier Bass, $40.
  await press('b');
  ice = await noteAt('heavier-bass');
  await page.mouse.click(ice[0], ice[1]); await wait(150);
  check('SCREAM-329: Speaker with Heavier Bass, $20, under the gas can too (SCREAM-396)', await big(), 'true | SPEAKER WITH HEAVIER BASS | More likely to get customers in their home. | $20.00 | TEMPORARY GAS CAN Required | button=false');
  await page.mouse.move(5, 300); await wait(100);
  await page.screenshot({ path: outDir + '/hub_cork_note_bass.png' });
  // SCREAM-245 (PO, November 14, the same sketch): the middle note is Handy Notebook, $40, under the speaker or the calculator.
  await press('b');
  ice = await noteAt('handy-notebook');
  await page.mouse.click(ice[0], ice[1]); await wait(150);
  check('SCREAM-245: Handy Notebook; SCREAM-395: 60 XP, under the Calculator or Brakes (SCREAM-398)', await big(), 'true | HANDY NOTEBOOK | Hints given by customers are written down. | 60 XP | CALCULATOR or BRAKES MADE THIS CENTURY Required | button=false');
  await page.mouse.move(5, 300); await wait(100);
  await page.screenshot({ path: outDir + '/hub_cork_note_notebook.png' });
  // SCREAM-330 (PO, November 14, the same sketch): the right note is This Century Register, $40, under the calculator.
  await press('b');
  ice = await noteAt('this-century-register');
  await page.mouse.click(ice[0], ice[1]); await wait(150);
  check('SCREAM-330: This Century Register; SCREAM-398: last in the XP tree, 120 XP', await big(), 'true | THIS CENTURY REGISTER | Click the icons of the ice cream to calculate price. | 120 XP | GITTY UP Required | button=false');
  await page.mouse.move(5, 300); await wait(100);
  await page.screenshot({ path: outDir + '/hub_cork_note_register.png' });
  await press('b');
  let spot = await noteAt('better-mirrors');
  await page.mouse.move(spot[0], spot[1]); await wait(150);
  check('...pointing at a note marks it', (await pu('s.detailName.text')) + ' ' + (await pu('s.open')), 'BETTER MIRRORS false');
  // SCREAM-294: Story starts with $25 now, so the test adds $35 to afford the two notes it buys below (SCREAM-364: More Space for Scream, under the gas can, is $20).
  await page.evaluate(() => window.__game.registry.get('evening').changeMoney(3500, 'Test', false)); await wait(100);
  const cash = await cashNow();
  await page.mouse.click(spot[0], spot[1]); await wait(150);
  check('SCREAM-296: a click opens the note bigger; a locked one says what to buy first (PO, November 14: "CUSTOMER 4 Required"), with no button', await big(), 'true | BETTER MIRRORS | A marker at the edge of the screen points at each customer on their way to you. | 120 XP | SPEEDY NEIGHBORS Required | button=false');
  check('...a note under two says either one', await pu("s.reason(s.notes.find(n => n.id === 'service-with-a-smile'), 'locked')"), 'SPONGEPOP or DRUM CONE Required');
  await page.screenshot({ path: outDir + '/hub_cork_note_locked.png' });
  await press('Enter');
  check('...Enter on a locked note buys nothing', (await cashNow()) + ' ' + (await pu("s.status('better-mirrors')")), cash + ' locked');
  await press('ArrowLeft');
  check('...the arrow keys wait while a note is open', await pu('s.selected'), 'better-mirrors');
  await press('b');
  check('...B closes the note, still at the board', (await pu('s.open')) + ' ' + (await scenes()), 'false PowerUps,Hud');
  spot = await noteAt('temp-gas-can');
  await page.mouse.click(spot[0], spot[1]); await wait(150);
  check('...a top note you can afford has a BUY button', await big(), 'true | TEMPORARY GAS CAN | Run out of gas and it pours itself in: a splash to get you going. Refills daily. | $10.00 | BUY | button=true');
  check('...and the bottom line says Enter: Buy', await pu('s.hint.text'), 'Enter: Buy    B: Close Note');
  await page.mouse.move(5, 300); await wait(100);
  await page.screenshot({ path: outDir + '/hub_cork_note_buy.png' });
  const buyAt = await pu('[s.buyButton.x + 75, s.buyButton.y + 23]');
  await page.mouse.click(buyAt[0], buyAt[1]); await wait(200);
  check('...clicking BUY takes $10.00', (await cashNow()), cash - 1000);
  check('...and the note is yours, with no button (PO)', await big(), 'true | TEMPORARY GAS CAN | Run out of gas and it pours itself in: a splash to get you going. Refills daily. | $10.00 | Owned | button=false');
  await page.mouse.move(5, 300); await wait(100);
  await page.screenshot({ path: outDir + '/hub_cork_note_owned.png' });
  await press('Enter');
  check('...Enter on a note you own takes nothing more', await cashNow(), cash - 1000);
  check('SCREAM-122: bought at home, the can is full straight away', await page.evaluate(() => window.__game.registry.get('evening').gasCanFull), true);
  await page.mouse.click(40, 300); await wait(150);
  check('...a click on the dimmed board closes the note', await pu('s.open'), false);
  check('...the card says Owned', await pu('s.detailStatus.text'), 'Owned');
  // SCREAM-396: the two speakers hang under the gas can now; Upgrade Speaker is $15.
  spot = await noteAt('upgrade-speaker');
  await page.mouse.move(spot[0], spot[1]); await wait(150);
  check('...the note under it is unlocked now', (await pu('s.selected')) + ' ' + (await pu('s.status()')), 'upgrade-speaker ok');
  const ringBefore = await page.evaluate(() => window.__game.registry.get('evening').spec.musicRadius);
  await press('Enter');
  await page.mouse.move(5, 300); await wait(100);
  await page.screenshot({ path: outDir + '/hub_cork_more_space.png' });
  await press('Enter');
  check('SCREAM-396: Enter opens Upgrade Speaker and Enter again buys it for $15, no question asked', (await cashNow()) + ' ' + (await big()), (cash - 2500) + " true | UPGRADE SPEAKER | Increase the reach of the speaker. | $15.00 | Owned | button=false");
  await page.mouse.move(5, 300); await wait(100);
  await page.screenshot({ path: outDir + '/hub_cork_more_space_owned.png' });
  check('SCREAM-81: ...bought, the music ring goes from 150 (SCREAM-393) to 181.5 px', ringBefore + ' ' + (await page.evaluate(() => Math.round(window.__game.registry.get('evening').spec.musicRadius * 10) / 10)), '150 181.5');
  await press('Backspace');
  await page.evaluate(() => { const e = window.__game.registry.get('evening'); e.changeMoney(300 - e.moneyCents, 'Test', false); }); await wait(100);
  spot = await noteAt('icecream-spongepop');
  await page.mouse.click(spot[0], spot[1]); await wait(150);
  check('...not enough cash: BUY is shown greyed out and can\'t be pressed', (await pu('s.status()')) + ' ' + (await pu('s.bigTexts.slice(-2).join()')) + ' ' + (await pu('!!s.buyButton')), 'poor $15.00,BUY false');
  await page.screenshot({ path: outDir + '/hub_cork_note_poor.png' });
  await press('Enter');
  check('...and Enter buys nothing', (await cashNow()) + ' ' + (await pu("s.status('icecream-spongepop')")), '300 poor');
  await page.evaluate((c) => { const e = window.__game.registry.get('evening'); e.changeMoney(c - e.moneyCents, 'Test', false); }, Math.max(cash - 2500, 3000)); await wait(100);
  check('...with the cash back, the same note can be bought', (await pu('s.status()')) + ' ' + (await pu('!!s.buyButton')), 'ok true');
  // SCREAM-395: the XP tree. Trot costs 40 XP: with none, BUY is greyed; cash doesn't help.
  await press('b');
  spot = await noteAt('trot');
  await page.mouse.click(spot[0], spot[1]); await wait(150);
  check('SCREAM-395: an XP note with no XP: 40 XP in red terms, BUY greyed out, whatever the cash', (await pu('s.status()')) + ' ' + (await big()), 'poor true | TROT | Increase the speed of the truck as it rolls without any gas pedal pushed. | 40 XP | BUY | button=false');
  await page.mouse.move(5, 300); await wait(100);
  await page.screenshot({ path: outDir + '/hub_cork_xp_poor.png' });
  const cashBeforeXp = await cashNow();
  await press('Enter');
  check('...Enter buys nothing', (await cashNow()) + ' ' + (await pu("s.status('trot')")), cashBeforeXp + ' poor');
  await page.evaluate(() => window.__game.registry.get('evening').debugAddXp(50)); await wait(120);
  check('...with 50 XP (the debug key\'s) BUY lights up; SCREAM-398: the label still says only XP', (await pu('s.xpLabel.text')) + ' ' + (await pu('s.status()')) + ' ' + (await pu('!!s.buyButton')), 'XP ok true');
  await press('Enter'); await wait(150);
  check('...Enter buys it with 40 XP and no cash', (await pu('s.xpLabel.text')) + ' ' + (await cashNow()) + ' ' + (await pu('s.bigTexts.slice(-2).join()')) + ' ' + (await page.evaluate(() => window.__game.registry.get('evening').powerUps.includes('trot'))), 'XP ' + cashBeforeXp + ' 40 XP,Owned true');
  await page.mouse.move(5, 300); await wait(100);
  await page.screenshot({ path: outDir + '/hub_cork_xp_owned.png' });
  check('...the notes under it are unlocked, and short of XP', await pu("['calculator','brakes-made-this-century','train-off-the-tracks','handy-notebook'].map(id => s.status(id)).join()"), 'poor,poor,locked,locked');
  const c0 = await clockAt(); await wait(600);
  check('SCREAM-318: ...the clock waits at the board until DRIVE (Story)', (await clockAt()) === c0, true);
  await press('Escape'); await wait(250);
  check('...Esc still opens the menu', await page.evaluate(() => window.__game.scene.isActive('Pause')), true);
  await press('Escape'); await wait(250);
  await press('b'); await press('b');
  await until(async () => (await scenes()) === 'Truck,Hud');
  check('...B closes the note, B again goes back to the hub with the board marked', (await scenes()) + ' ' + (await sel()), 'Truck,Hud menu');
  await press('Enter');
  await until(async () => (await scenes()) === 'PowerUps,Hud');
  check('...Enter on the board opens it again, on the note left marked, not opened', (await scenes()) + ' ' + (await pu('s.selected')) + ' ' + (await pu('s.open')), 'PowerUps,Hud trot false');
  check('...Restart Evening would give tonight\'s notes back (SCREAM-395: and tonight\'s XP): the run still has none', await page.evaluate(() => { const g = window.__game.registry; return g.get('evening').powerUps.join(',') + ' / ' + g.get('story').powerUps.join(',') + ' / ' + g.get('story').newEvening().powerUps.length + ' / xp ' + g.get('evening').xp + ' ' + g.get('story').xp + ' ' + g.get('story').newEvening().xp; }), 'temp-gas-can,upgrade-speaker,trot /  / 0 / xp 10 0 0');
  const back = await pu('[s.backButton.x + s.backButton.width / 2, s.backButton.y + s.backButton.height / 2]');
  await page.mouse.click(back[0], back[1]);
  await until(async () => (await scenes()) === 'Truck,Hud');
  check('...the BACK button goes back too', await scenes(), 'Truck,Hud');
  // The evening ends: the notes are kept for the run, saved, and the money shows on the end screen.
  await page.keyboard.down('Shift'); await page.keyboard.press('Digit3'); await page.keyboard.up('Shift');
  await until(async () => (await scenes()) === 'DayEnd');
  const dayEnd = await sc('DayEnd', "s.children.list.filter(o => o.type === 'Text').map(o => o.text).join(' | ')");
  check('SCREAM-296: the end of the day lists Power-ups -$25.00', /Power-ups \| -\$25\.00/.test(dayEnd), true);
  await page.screenshot({ path: outDir + '/hub_day_end_power_ups.png' });
  check('...the run keeps the notes, and so does the save', await page.evaluate(() => window.__game.registry.get('story').powerUps.join(',') + ' / ' + JSON.parse(localStorage.getItem('icemachine.story.v2')).powerUps.join(',')), 'temp-gas-can,upgrade-speaker,trot / temp-gas-can,upgrade-speaker,trot');
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.scene.getScenes(true).length > 0);
  await page.click('canvas'); await page.mouse.move(5, 5); await wait(200);
  await sc('Title', "(() => { const i = s.modeTexts.findIndex(o => o.text.includes('Continue')); s.modeTexts[i].emit('pointerover'); })()");
  await press('Enter');
  await until(async () => (await scenes()) === 'Truck,Hud');
  // ---- SCREAM-307: from the second night the evening opens at the truck screen ----
  check('SCREAM-307: Continue on day 2 opens at the truck screen, cooler highlighted, clock waiting', (await scenes()) + ' ' + (await sel()) + ' ' + (await page.evaluate(() => window.__game.registry.get('evening').isClockRunning)), 'Truck,Hud cooler false');
  // SCREAM-324 (PO, November 14): Shift+9 adds $50 on any evening screen; profit doesn't count it.
  const cash9 = await page.evaluate(() => window.__game.registry.get('evening').moneyCents);
  const profit9 = await page.evaluate(() => window.__game.registry.get('evening').profitCents);
  await page.keyboard.down('Shift'); await page.keyboard.press('Digit9'); await page.keyboard.up('Shift'); await wait(150);
  check('SCREAM-324: Shift+9 on the truck screen adds $50 to the cash, not to the profit', await page.evaluate(([c, p]) => { const e = window.__game.registry.get('evening'); return (e.moneyCents - c) + ' ' + (e.profitCents - p); }, [cash9, profit9]), '5000 0');
  await page.evaluate((c) => { const e = window.__game.registry.get('evening'); e.changeMoney(c - e.moneyCents, 'Test', false); }, cash9); await wait(100);
  // SCREAM-337 (PO, November 15): Shift+0 fills the gas tank on any evening screen, for free.
  {
    const before = await page.evaluate(() => { const e = window.__game.registry.get('evening'); const was = { fuel: e.fuel, cash: e.moneyCents, profit: e.profitCents, can: e.gasCanFull }; e.fuelLeft = 0.25; return was; });
    await page.keyboard.down('Shift'); await page.keyboard.press('Digit0'); await page.keyboard.up('Shift'); await wait(150);
    check('SCREAM-337: Shift+0 on the truck screen fills the tank; cash, profit and the gas can don\'t change', await page.evaluate((b) => { const e = window.__game.registry.get('evening'); const out = e.fuel + ' ' + (e.moneyCents - b.cash) + ' ' + (e.profitCents - b.profit) + ' ' + (e.gasCanFull === b.can); e.fuelLeft = b.fuel; return out; }, before), '1 0 0 true');
    check('...it is a debug key: not on the Key Bindings page', await page.evaluate(async () => { const { KEY_GROUPS } = await import('/src/config/keyBindings.js'); return JSON.stringify(KEY_GROUPS).includes('Shift+0'); }), false);
  }
  await press('ArrowRight'); await press('ArrowRight');
  check('...the board can be picked first', await sel(), 'menu');
  await press('Enter'); await until(async () => (await scenes()) === 'PowerUps,Hud');
  await press('b'); await until(async () => (await scenes()) === 'Truck,Hud');
  check('...back from the board, the clock is still waiting', await page.evaluate(() => window.__game.registry.get('evening').isClockRunning), false);
  await page.evaluate(() => { const e = window.__game.registry.get('evening'); e.coolerSlots.forEach(s => (s.quantity = 0)); e.syncCells(); });
  await press('ArrowLeft');
  check('...the driver\'s seat with nothing in the cooler', (await sel()) + ' ' + (await page.evaluate(() => window.__game.registry.get('evening').stockLeft)), 'driver 0');
  await press('Enter'); await until(async () => (await scenes()).startsWith('Cooler'));
  check('...opens the cooler instead, with the warning, and the truck stays home', (await scenes()) + ' ' + (await page.evaluate(() => window.__game.registry.get('evening').isPrepLocked)) + ' ' + (await sc('Cooler', 's.note.text')), 'Cooler,Hud false Add at least one ice cream before you leave the cooler.');
  await wait(300); await press('b'); await until(async () => (await scenes()) === 'Truck,Hud');
  check('...B with an empty cooler goes back to the truck screen, the clock still waiting', (await scenes()) + ' ' + (await page.evaluate(() => window.__game.registry.get('evening').isClockRunning)), 'Truck,Hud false');
  check('...with the cooler highlighted', await sel(), 'cooler');
  await press('Enter'); await until(async () => (await scenes()).startsWith('Cooler'));
  check('...Continue after closing the game: day 2 still owns them', await page.evaluate(() => { const g = window.__game.registry; return g.get('story').day + ' ' + g.get('evening').powerUps.join(',') + ' ' + g.get('evening').spec.coolerCapacity; }), '2 temp-gas-can,upgrade-speaker,trot 18');
  check('SCREAM-395: ...and the XP left over (10) is carried too, with anything the evening earned', await page.evaluate(() => { const g = window.__game.registry; return g.get('evening').xp >= 10 && g.get('evening').xp === g.get('story').xp; }), true);
  const ev = (fn) => page.evaluate(`(() => { const e = window.__game.registry.get('evening'); return ${fn}; })()`);
  // ---- SCREAM-271: in Story only the Chocolate Eclair can be stocked until an ice cream is bought on the board ----
  check('SCREAM-271: Story\'s clipboard offers only the Chocolate Eclair', (await sc('Cooler', "s.offered.map(f => f.id).join()")) + ' ' + (await sc('Cooler', '[...s.addButtons.keys()].join()')), 'eclair eclair');
  check('...the others are locked', await ev("['eclair','spongepop','explorer','cookie'].map(f => e.flavourUnlocked(f)).join()"), 'true,false,false,false');
  check('...the average person won\'t pay over $2.50 for an eclair, $3.00 for SpongePop and the Explorer Pop (PO, November 14); the sandwich keeps $4.00', await ev("['eclair','spongepop','explorer','cookie'].map(f => e.refuseAboveCents(f)).join()"), '250,300,300,400');
  await ev("(e.changeMoney(2000, 'Test', false), true)");
  check('SCREAM-376: the notes cost $15 (SpongePop) and $20 (Lil Explorer Pop); SCREAM-396: the sandwich has no note', await pu("['icecream-spongepop','icecream-explorer'].map(id => s.notes.find(n => n.id === id).priceCents).join() + ' ' + s.notes.some(n => n.id === 'icecream-cookie')"), '1500,2000 false');
  check('SCREAM-396: the sandwich can\'t be bought at all, the Drum Cone not before the Bass; SpongePop (under the Speaker, owned) can', (await ev("e.buyPowerUp('icecream-cookie')")) + ' ' + (await ev("e.buyPowerUp('icecream-drumcone')")) + ' ' + (await ev("e.buyPowerUp('icecream-spongepop')")) + ' ' + (await ev('e.unlockedFlavours.join()')), 'false false true eclair,spongepop');
  await press('b'); await until(async () => (await scenes()) === 'Truck,Hud', 1500);
  if ((await scenes()) === 'Truck,Hud') { await press('Enter'); await until(async () => (await scenes()).startsWith('Cooler')); }
  else { await sc('Cooler', '(s.scene.restart(), true)'); await wait(400); }
  check('...opened again, the clipboard offers SpongePop too', await sc('Cooler', "s.offered.map(f => f.id).join()"), 'eclair,spongepop');
  // ---- SCREAM-303: Service With A Smile: tips start at 25% and the countdown is 10 s longer ----
  check('SCREAM-303: without the power-up the tip steps are 20, 15, 10, 5', await ev('e.tipSteps.join()'), '20,15,10,5');
  await ev("(e.changeMoney(1500, 'Test', false), true)");
  check('SCREAM-396: the note hangs under SpongePop (owned) now: it can be bought; More Space for Scream under it waits', (await ev("e.powerUpStatus('service-with-a-smile')")) + ' ' + (await ev("e.powerUpStatus('more-junk')")), 'ok locked');
  check('...bought at home: 25% first, five steps', (await ev("e.buyPowerUp('service-with-a-smile')")) + ' ' + (await ev('e.tipSteps.join()')), 'true 25,20,15,10,5');
  // ---- SCREAM-122: the Temporary Gas Can pours itself in when the tank runs empty ----
  check('SCREAM-122: day 2 starts with the can full', await ev('e.gasCanFull'), true);
  check('SCREAM-310: Trot (bought with XP on day 1) is still owned: tonight\'s creep is 25.2 px/s, not 12 (SCREAM-336)', (await ev("e.powerUpStatus('trot')")) + ' ' + (await ev('Math.round(e.spec.creepSpeed * 10) / 10')), 'owned 25.2');
  // SCREAM-395: XP notes are bought with XP: cash alone doesn't do it.
  const xp0 = await ev('(e.changeMoney(5000, \'Test\', false), e.debugAddXp(60 - e.xp % 60), e.xp)');
  check('SCREAM-395: at home a note under an owned one can be bought with XP; the cash is left alone', (await ev("e.powerUpStatus('brakes-made-this-century')")) + ' ' + (await ev("(() => { const cash = e.moneyCents; const ok = e.buyPowerUp('brakes-made-this-century'); return ok + ' ' + (e.moneyCents === cash); })()")) + ' ' + ((await ev('e.xp')) - xp0), 'ok true true -50'); // SCREAM-398: Brakes is in the 50 XP row
  await ev('(e.debugAddXp(300), true)');
  check('SCREAM-81: Upgrade Speaker (bought on day 1) is still owned: tonight\'s ring is 181.5 px', (await ev("e.powerUpStatus('upgrade-speaker')")) + ' ' + (await ev('Math.round(e.spec.musicRadius * 10) / 10')), 'owned 181.5');
  check('SCREAM-25, SCREAM-396: More Space for Scream, under Service With A Smile, bought at home: the cooler holds 24, not 18', (await ev('e.spec.coolerCapacity')) + ' ' + (await ev("(e.changeMoney(3000, 'Test', false), e.buyPowerUp('more-junk'))")) + ' ' + (await ev('e.spec.coolerCapacity')), '18 true 24');
  check('SCREAM-329, SCREAM-366: Speaker with Heavier Bass bought at home: people indoors go from a tenth as likely to as likely as in their yard (SCREAM-393), from now on', (await ev('e.residents.indoorsFactor')) + ' ' + (await ev("(e.changeMoney(4000, 'Test', false), e.buyPowerUp('heavier-bass'))")) + ' ' + (await ev('e.residents.indoorsFactor')), '0.1 true 1');
  check('SCREAM-245: Handy Notebook bought at home (SCREAM-398: with XP; Brakes, owned, already unlocks it)', (await ev('e.hasNotebook')) + ' ' + (await ev("e.powerUpStatus('handy-notebook') + ' ' + e.buyPowerUp('calculator') + ' ' + e.buyPowerUp('handy-notebook')")) + ' ' + (await ev('e.hasNotebook')), 'false ok true true true');
  await press('+'); await press('Enter');
  await until(async () => (await scenes()) === 'Truck,Hud');
  // SCREAM-245 (PO): "Notebook should be a new clickable item in the truck view".
  await press('ArrowRight'); await press('ArrowRight');
  check('SCREAM-245: the notebook is a part of the truck view now, hanging under the tip jar (PO)', (await sel()) + ' ' + (await sc('Truck', 's.tag.text')), 'notebook NOTEBOOK');
  await page.screenshot({ path: outDir + '/hub_notebook_in_truck.png' });
  await press('Enter');
  await until(async () => (await scenes()) === 'Notebook,Hud');
  check('...Enter opens it: nothing written down yet', await sc('Notebook', "s.lines.join(' | ') + ' / ' + s.pages.length"), 'Nothing written down yet. Hints customers give you at the window will be written here. / 1');
  await page.evaluate(() => { const e = window.__game.registry.get('evening'); for (let i = 1; i <= 5; i++) e.notebook.push({ day: 2, who: 'Test Person', text: 'Hint number ' + i + '.' }); window.__game.scene.getScene('Notebook').scene.restart(); });
  await wait(300);
  check('...with hints in it: newest first, who and when, four to a page', await sc('Notebook', "s.lines.slice(0, 2).join(' | ') + ' / ' + s.pages.length + ' / ' + s.pageLabel.text"), 'Tuesday Day 2: Test Person | Hint number 5. / 2 / Page 1 Of 2');
  await page.screenshot({ path: outDir + '/hub_notebook_open.png' });
  await press('ArrowRight');
  check('...Right turns the page', await sc('Notebook', "s.lines.join(' | ') + ' / ' + s.pageLabel.text"), 'Tuesday Day 2: Test Person | Hint number 1. / Page 2 Of 2');
  await page.evaluate(() => { window.__game.registry.get('evening').notebook.length = 0; });
  await press('b');
  await until(async () => (await scenes()) === 'Truck,Hud');
  check('...B goes back to the truck, the notebook still marked', await sel(), 'notebook');
  // ---- SCREAM-377 (PO, November 16): the map on the truck's wall ----
  await press('ArrowRight');
  check('SCREAM-377: the arrow keys move between the stations as before (the map has its own key)', await sel(), 'menu');
  {
    const [mx, my] = await sc('Truck', "(() => { const z = s.constructor.name && window.__game.scene.getScene('Truck'); return [804, 205]; })()");
    await page.mouse.move(mx, my); await wait(150);
    check('...pointing at the poster on the wall by the window marks it: MAP', (await sel()) + ' ' + (await sc('Truck', 's.tag.text')), 'map MAP');
    await page.screenshot({ path: outDir + '/hub_map_in_truck.png' });
    await page.mouse.move(5, 300);
  }
  await press('n');
  await until(async () => (await scenes()) === 'Map,Hud');
  const mapNow = () => sc('Map', "s.known.join() + ' | ' + s.title.text + ' | ' + s.marks.map(m => m.kind).sort().join() + ' | arrows ' + s.arrows.length");
  check('...N opens it: Elm Park only, with home, the gas station, the park and the truck; no arrows yet', await mapNow(), 'tutorial | ELM PARK | gas,home,park,truck | arrows 0');
  check('...street names are written on it', await sc('Map', "s.streets.includes('Haviland Street') && s.streets.includes('Park Avenue')"), true);
  check('...every marker is on the sheet', await sc('Map', "s.marks.every(m => m.x > 144 && m.x < 816 && m.y > 110 && m.y < 442)"), true);
  await page.screenshot({ path: outDir + '/hub_map_elm_park.png' });
  await press('ArrowRight');
  check('...with one map known, Right changes nothing', await sc('Map', 's.title.text'), 'ELM PARK');
  // The truck has been through the roundabout: the other map is known, and the roundabout is marked.
  await page.evaluate(() => { window.__game.registry.get('evening').otherMapSeen = true; window.__game.scene.getScene('Map').scene.restart(); });
  await wait(300);
  check('...after teleporting: both maps, two arrows, and the roundabout marked', await mapNow(), 'tutorial,worcester | ELM PARK | gas,home,park,portal,truck | arrows 2');
  await press('ArrowRight');
  check('...Right shows Foley Stadium: its gas stations, parks and roundabout; no home and no truck (they are in Elm Park)', await mapNow(), 'tutorial,worcester | FOLEY STADIUM | gas,gas,park,park,park,portal | arrows 2');
  await page.screenshot({ path: outDir + '/hub_map_foley_stadium.png' });
  {
    const [ax, ay] = await sc('Map', '[s.arrows[0].x, s.arrows[0].y]');
    await page.mouse.click(ax, ay); await wait(150);
    check('...clicking the arrow button goes back to Elm Park', await sc('Map', 's.title.text'), 'ELM PARK');
    const clock0 = await ev('e.clockMinutes');
    const [bx, by] = await sc('Map', '[s.backButton.x, s.backButton.y]');
    await page.mouse.click(bx, by);
    await until(async () => (await scenes()) === 'Truck,Hud');
    check('...the BACK button goes back to the truck, the map marked', await sel(), 'map');
    check('...looking at the map changed nothing in the evening', (await ev('e.clockMinutes')) === clock0, true);
  }
  await page.evaluate(() => { window.__game.registry.get('evening').otherMapSeen = false; });
  await press('ArrowLeft');
  check('...Left from the map goes to the notebook', await sel(), 'notebook');
  await press('ArrowLeft'); await press('Enter');
  await until(async () => (await scenes()) === 'Drive,Hud');
  check('SCREAM-81: ...and the ring drawn round the truck is the bigger one', await page.evaluate(() => Math.round(window.__game.scene.getScene('Drive').ring.radius * 10) / 10), 181.5);
  check('...once the truck sets off, nothing can be bought', (await ev("e.powerUpStatus('train-off-the-tracks')")) + ' ' + (await ev("e.buyPowerUp('train-off-the-tracks')")), 'away false');
  // SCREAM-320 (PO, November 14): "purchase powerups while at home at any time": a home stop later in the evening.
  check('SCREAM-320: ...away from home the board says to buy it at home', await ev("e.powerUpStatus('back-it-up')"), 'away');
  await ev("(e.changeMoney(3000, 'Test', false), e.startRestock(), true)");
  check('SCREAM-320: on a home stop after setting off, notes can be bought again', (await ev("e.powerUpStatus('back-it-up')")) + ' ' + (await ev("e.buyPowerUp('back-it-up')")) + ' ' + (await ev("e.powerUpStatus('back-it-up')")), 'ok true owned');
  await ev('(e.endRestock(), true)');
  check('SCREAM-320: ...back on the road, not any more', await ev("e.powerUpStatus('steam-engine')"), 'away');
  await page.keyboard.down('ArrowUp'); await wait(300); await page.keyboard.up('ArrowUp'); await wait(2000);
  check('SCREAM-310: with Trot, after a tap of the gas the truck creeps on at 25.2 px/s with no key held (SCREAM-336)', await page.evaluate(() => Math.round(Math.abs(window.__game.scene.getScene('Drive').speed) * 10) / 10), 25.2);
  await ev('(e.fuelLeft = 0.004, true)');
  await page.keyboard.down('ArrowUp');
  const popped = await until(() => page.evaluate(() => window.__game.scene.isActive('GasCan')), 8000);
  check('...the tank runs empty: the can pops onto the screen', popped, true);
  const frozen = await page.evaluate(() => { const m = window.__game.scene; return m.isPaused('Drive') + ' ' + m.isPaused('Hud'); });
  check('...the game stops behind it (the road and the clock)', frozen, 'true true');
  const clockThen = await clockAt(); await wait(500);
  check('...the clock waits while the can shows', await clockAt(), clockThen);
  await page.screenshot({ path: outDir + '/hub_gas_can_pop.png' });
  check('...the evening has not ended, and the tank is a fifth full', (await ev('e.isOver')) + ' ' + (await ev('Math.round(e.fuel * 100) / 100')), 'false 0.2');
  await until(async () => !(await page.evaluate(() => window.__game.scene.isActive('GasCan'))), 4000);
  await page.keyboard.up('ArrowUp'); await wait(150);
  check('...the can goes away by itself and the game carries on', (await scenes()) + ' ' + (await page.evaluate(() => window.__game.scene.isPaused('Drive'))), 'Drive,Hud false');
  check('...the can is empty for the rest of the evening', (await ev('e.gasCanFull')) + ' ' + (await ev('e.gasCansUsed')), 'false 1');
  check('...the board still says Owned (bought once)', await ev("e.powerUpStatus('temp-gas-can')"), 'owned');
  await ev('(e.fuelLeft = 0.004, true)');
  await page.keyboard.down('ArrowUp');
  await until(() => ev('e.isOver'), 8000);
  await page.keyboard.up('ArrowUp');
  check('...running empty a second time the same evening ends it, as before', (await ev('e.endedOutOfGas')) + ' ' + (await page.evaluate(() => window.__game.scene.isActive('GasCan'))), 'true false');
  check('...and tomorrow the can is full again', await page.evaluate(() => { const g = window.__game.registry; const s = g.get('story'); return s.newEvening ? (s.powerUps.includes('temp-gas-can') && s.newEvening().gasCanFull) : null; }), true);
  check('SCREAM-303: the power-up is in tonight\'s notes, which the run keeps when the day ends (SCREAM-296)', (await ev("e.powerUps.includes('service-with-a-smile')")) + ' ' + (await ev('e.tipSteps.join()')), 'true 25,20,15,10,5');
  console.log(`\n${pass} passed, ${fail} failed; errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await browser.close();
})();
