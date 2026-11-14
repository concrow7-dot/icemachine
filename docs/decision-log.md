# Decision log

Newest first. Each entry: what was decided, the options considered, and why.

## 104 — Pause menu: a Key Bindings page listing every key (2026-11-13)

**Decision (Jira SCREAM-206, under SCREAM-5, PO, November 13: "go ahead"):** the pause menu gets a Key Bindings option. It opens a page that lists every key a player can press, grouped by screen. This is the one place a player can always look up the controls now that the title screen's HOW TO DRIVE box is gone (087).

**Options considered:** a page of its own opened from the pause menu (chosen, as the ticket says); a longer hint line on every screen (the PO removed most of those in 087).

**Why (product owner's rationale):** not given yet beyond the ticket's wording. *(Placeholder: engineering will ask.)*

**Engineering's calls (proposals):**

- The list is built from the scenes' key handlers and kept in one file, `src/config/keyBindings.ts`; the page and the "How To Drive" pop-up (SCREAM-207) both read it. Twelve groups: driving, in the truck, the cooler, the sales window, filling an order, the gas pump, the cork board, the end of the day, the title screen, the uncle, the pause menu, the high scores. Debug keys (Shift + a number) are left out, as the ticket says.
- The groups are packed onto pages of at most 17 lines (6 pages today), turned with the arrow keys, W A S D, the mouse wheel or the Previous and Next buttons. Esc, B, Backspace or the Back button returns to the pause menu. Nothing scrolls, so no screen is cut off.
- "Key Bindings" is the last item on the menu, so Resume, End Evening, Restart Evening and Quit To Title keep their places. It is on every pause menu (the uncle's evening and the high score screen too).
- Text follows doc 15's style (Title Case, "Or" between two keys).

## 103 — Starting Story: pictures are loaded ahead and screens fade, so the loading screen no longer flashes (2026-11-13)

**Decision (Jira SCREAM-243, under SCREAM-6, PO, November 12):** the split-second flash between Play Story and the game was the loading screen, up for 0.15 to 0.4 s while the next screen fetched its pictures. Offered three options, the PO chose the first ("Thats good with me"): load the next screen's pictures earlier, while the title or New Bike screen is up, so nothing shows in between, plus a short fade between screens.

**Options considered:** load ahead plus a short fade (chosen); keep the loading screen up for a minimum time (about 0.6 s) so it looks intentional; only a fade over the in-between.

**Why (product owner's rationale):** not given yet beyond agreeing to engineering's suggestion. *(Placeholder: engineering will ask.)*

**Engineering's calls (proposals):**

- While the title is up, the game fetches the cooler, the ice cream pictures and their font, and the inside of the truck. A new player (whose Story always starts with the uncle) also gets his credits' map and tune and his picture; a returning player gets those when the title asks "Bring your uncle along again?".
- The fade is 0.2 s to black and 0.2 s back in, on these steps only: title to the New Bike screen, title to the uncle's credits, the New Bike screen to the cooler, and Continue to the cooler.
- If someone starts in the page's very first moments, before those pictures have arrived, the game waits for them under the black; the loading screen comes up only if that takes more than 0.6 s (a slow connection).
- Quick play gets no fade (076). In those same first moments it too waits for the pictures already on their way, so no picture is fetched twice.
- The first drive of an evening still shows the loading screen while the map loads: that is a longer, real wait and was not the flash in this ticket.

## 102 — The end-of-day screen moves on with a click as well as Enter (2026-11-13)

**Decision (Jira SCREAM-295, under SCREAM-7, PO, November 12):** on the end-of-day screen, clicking the mouse works as well as pressing Enter. Enter keeps working. Like 079 (click or Enter to begin).

**Options considered:** a click anywhere on the screen (chosen, as on the opening screen); a button to click.

**Why (product owner's rationale):** not given yet. *(Placeholder: engineering will ask.)*

**Engineering's calls (proposals):**

- The end-of-day screen is only ever shown in Story (Quick play goes straight to its results), so there was no both-modes question to answer.
- The hint at the bottom reads "Click Or Enter: Start Tuesday" (or "Story High Scores", or "Back To The Title"), in the opening screen's wording.
- Only the left button counts, and a click in the screen's first half second is ignored, so a click meant for the sales window as the evening ends doesn't skip the screen.
- The screens after it are unchanged: the high score screen still takes the keyboard (it asks for initials).

## 101 — Story burns gas 5% faster (2026-11-13)

**Decision (Jira SCREAM-298, under SCREAM-7, PO, November 13):** "increase the rate that gas burns by 5%".

**Options considered:** the burn rate times 1.05 (chosen: engineering's reading of "by 5%"); 5 points more of the tank per evening.

**Why (product owner's rationale):** not given yet. *(Placeholder: engineering will ask: why 5%, and what he saw in play.)*

**Engineering's calls (proposals):**

- Story's truck already burned gas 1.3 times as fast as Quick play's (074); it is now 1.3 x 1.05 = 1.365 times. A full tank goes about 23,500 px in Story (it was about 24,700).
- Story only (076), the uncle's evening included, since it uses Story's truck. Quick play is unchanged.
- The Temporary Gas Can (099) still pours in a fifth of a tank, which now goes 5% less far too.

## 100 — Story starts with $25, not $50 (2026-11-13)

**Decision (Jira SCREAM-294, under SCREAM-78, PO, November 12):** Story's starting money (the uncle's $50, decision 046) becomes $25. The $600 bike stays as it is. Story only (076); Quick play keeps its $50.

**Options considered:** $25 (chosen, the PO's); leave it at $50.

**Why (product owner's rationale):** not given yet. *(Placeholder: engineering will ask.)*

**Engineering's calls (proposals):**

- The uncle leaves what Story starts with, so his line at the cooler now reads "I left $25 on the truck for you to get started." (his words with the number changed; the PO to confirm the wording).
- His $20 for gas (088) is separate and unchanged, so a new player still has $25 for stock plus $20 of gas.
- The opening screen already reads the amount from the setting ("You've got $25.00 and an ice cream truck.").
- A run saved before this change keeps the cash it has.
- Worth knowing: with $25, buying the Temporary Gas Can ($15, 099) on the first evening leaves $10 for stock.

## 099 — The first power-up: the Temporary Gas Can ($15, bought once, full again every day) (2026-11-13)

**Decision (Jira SCREAM-122, under SCREAM-78, PO, November 13):** "The first powerup I want to add is under truck. It should be called temporary gas can. It will fill up your tank 1/5 of the way. If the player runs out of gas it automatically puts the gas in the tank. The game should pause and the temporary gas tank should pop onto the screen pulse a few times and then go away. I want to make the logo for the powerup to be similar to the image provided. I want it to look like the art style of the trucks inside." (The image: a photo of a red plastic gas can with a black spout.) His answers to engineering's questions: the price: "Lets say $15"; which note: "Top on under the truck"; how many: "Just the one"; an unused can: "Every day the can should start full", which he confirmed means **buy once, refills daily** (pay $15 once; every evening after that starts with a full can, good for one rescue that evening, for the rest of the Story run); the picture, drawn by engineering in code in the hub's cartoon style as an original design with no brand label: "Sounds great."

**This changes the November 11 plan** (SCREAM-122's comment, 073): the can was going to be bought again each time it was used up. It is now bought once.

**Options considered:** how the can lasts: buy once and it refills daily (chosen); buy again after each use, an unused can carrying over; buy fresh every day. Price: $15 (chosen, the PO's); $5, the dummy price (engineering's proposal). Used by itself when the tank runs dry (chosen, the PO's); used by hand.

**Why (product owner's rationale):** not given yet. *(Placeholder: engineering will ask.)*

**Engineering's calls (proposals):**

- The can sets the tank to a fifth (the tank is empty when it pours). Running empty a second time the same evening ends the evening as before (025, SCREAM-119).
- The pop-up: the game stops like a pause, the clock too, for 1.5 seconds; the can pops into the middle of the screen, pulses three times and pops out. No words on it. The numbers are in `tuning.ts`.
- Bought at home and full straight away, so it works the same evening.
- The note's id changed from `truck-1` to `temp-gas-can`, so a dummy TRUCK 1 bought while testing 098 does not become a gas can.
- The other Truck notes are still dummies and hang from the can.
- Nothing on the road shows whether today's can is still full (the board says "Yours" either way). A small can beside the gas dial would do it: not built, to ask.

## 098 — Cork board notes open bigger and can be bought: grey until bought, unlocked by the note above, at home only (2026-11-12)

**Decision (Jira SCREAM-296, under SCREAM-78, PO, November 12):** "I think the next item to work on is having the ability of the player to click on the skill, and have it magnify. The "?" on the current screen (post it notes) would be a fun image. If the player clicks on the post it, the note should open to be bigger. The note should have the logo and a description. With the price listed, and the ability to purchase the skill. No button if already purchased." On how notes look: "Lets have the notes that aren't purchased, greyed out. The the items purchased will look as they do now. The user can still look at the greyed out notes." He agreed to engineering's proposals ("Agreed on the last 3", then "I agree with all"): a note you can't afford shows its price in red with the button greyed out; Enter opens the marked note and Enter again buys it, with no "are you sure" step; Restart Evening gives back anything bought that evening; buying is real in this ticket (the cash leaves and the note is saved as owned) although the notes are still dummies; the strings lock notes (a note can be bought once you own a note it hangs from; the top notes are open); placeholder pictures by engineering, one per tree; buying only while parked at home, the board readable anywhere; a locked note is greyed like any unbought note and says what to buy first in place of the button. Builds on 073 and 097.

**Options considered:** how an owned note looks: unbought notes grey and bought ones in colour (chosen, the PO's); a "SOLD" stamp on bought notes (engineering's first proposal). Buying: real now, with dummy notes (chosen); wait for the first real power-up. Strings: lock the notes below (chosen); decoration only. Pictures: engineering's placeholders (chosen); wait for the PO's drawings. Where: at home only (chosen); anywhere the board opens. Confirming a purchase: none (chosen); an "are you sure" step.

**Why (product owner's rationale):** PO, November 13: "I wanted to promote the player needing to plan their build out. So they couldn't just get anything whenever you wanted."

**Engineering's calls (proposals):**

- "At home" means before first setting off for the evening. A stop at home to restock opens only the cooler and goes straight back to the road, so there is no way to the board then; 073's "on any stop at home to restock" needs its own change (a way from the restock cooler to the board).
- A note hanging from two notes needs only one of them ("Buy TRUCK 2 or TRUCK 3 first").
- Dummy prices: $5.00 for the top row, $5.00 more each row down ($25.00 at the bottom). Dummy description: "A dummy power-up. It does nothing yet."
- The pictures: a wheel (Truck), a loudspeaker (Speaker), a coin (Sales), drawn in code.
- The opened note closes with B, Backspace or a click on the dimmed board. After buying, it stays open and says "Yours".
- Money spent at the board is a "Power-ups" row on the end-of-day screen and the end-of-run screen, shown only when something was bought, so the rows still add up to the profit.
- What is owned is kept in the Story run and its save (`powerUps`); older saves read as owning nothing.

## 097 — The cork board opens a power-ups skill map: three trees (Truck, Speaker, Sales), a dummy to look at first (2026-11-12)

**Decision (Jira SCREAM-267, under SCREAM-78, PO, November 12):** "IM ready to start working on powerups. My thinking is to start by letting the player to click into the cork board (above the cooler. They should see something similar to the pasted photo. For now lets just add a dummy skill map. As we add more powerups, the actual skill trees will take shape." The photo was another game's skill map: three framed trees side by side, squares joined by lines. Asked three questions, the PO answered: the trees are called **"Truck, Speaker, Sales"** (his own names, in place of engineering's proposal of Window, Truck, Neighbourhood); the squares are **look only** for now (nothing can be bought; buying comes with the first real power-up); and the screen is a **cork board with pinned notes** joined by string, not a dark panel like the photo. Builds on 073 (power-ups are bought with money, at the cork board).

**Options considered:** tree names: Truck, Speaker, Sales (chosen, the PO's); Window, Truck, Neighbourhood; placeholder names; one tree. Dummy behaviour: look only (chosen); notes that can be bought and do nothing. Look: cork board with pinned notes (chosen); a dark panel like the photo.

**Why (product owner's rationale):** PO, November 13, on the trees and their names: "I'm still toying with exactly what the columns should be. Those are just first ideas." So Truck, Speaker and Sales are first ideas, open to change. *(Why a skill map with trees rather than a plain list: not given yet.)*

**Engineering's calls (proposals):**

- In Story the board on the wall above the cooler was the MENU (it opened the pause menu). It now opens the skill map and is tagged POWER-UPS; Esc still opens the menu everywhere. Quick play keeps MENU (076), and so does the uncle's evening (like End Evening, 091: nothing new while he is teaching).
- 25 dummy notes (9, 7 and 9), each a "?" with a name like "TRUCK 3", "Not for sale yet" and one line of text. The shapes of the trees mean nothing yet. The data is `src/config/powerUps.ts`: each power-up ticket replaces a dummy note with a real one.
- Arrow keys (or W A S D) move to the nearest note that way, across trees; pointing with the mouse marks a note; B, Backspace or the BACK button returns to the hub. Enter does nothing yet.
- The board can be looked at wherever the hub can be opened, and the clock keeps running, as at the cooler (029). 073's "bought at home" rule belongs to buying, so it comes with the first real power-up.
- Placeholder art drawn in code by engineering (cork, paper notes, pins, string), until the PO draws the board in his own style.

## 096 — Francine Fudge gets a new outfit (Look 11851), so she has no "big mouth" at the window (2026-11-12)

**Decision (Jira SCREAM-289, under SCREAM-11, PO, November 12):** "Some players get what looks like an extra large mouth when they are made for the sales window." The cause is in the art: the chin line with bare skin under it. The PO chose "Change those customers' outfits in the Residents sheet", then "lets just fix Francine only", and picked option 5 of five (Look 11851): "Lets go with this one".

**Options considered:** a new outfit for Francine only (chosen); new outfits for everyone with the pattern (about 13 on Elm Park, 41 on Foley Stadium); shading the chin line at the window in code.

**Why (product owner's rationale):** not given yet. *(Placeholder: engineering will ask.)*

**Engineering's calls (proposals):**

- The five options kept her body (skin), hair and age and changed the outfit and eyes; Look 11851 gives a patterned top up to the chin.
- The Residents sheet's Elm Park tab now says 11851 (engineering changed the cell for the PO). The build puts looks in number order, so in residents-tutorial.png she moves to the end and the others move up one place; every other picture is unchanged.

## 095 — Title screen: the title and the menu together, centred (2026-11-12)

**Decision (Jira SCREAM-292, under SCREAM-6, PO, November 12):** "Lets Move the Title and Menu options together and Vertically center the text." Follows 087, which took the HOW TO DRIVE box off the title screen and left a gap.

**Options considered:** the title, the options and the lock note as one group in the middle of the screen (chosen); the menu moved up under the title where it was.

**Why (product owner's rationale):** not given yet. *(Placeholder: engineering will ask.)*

**Engineering's calls (proposals):**

- 36 px between the title and the first option (a little under the title's height). The group is centred on the whole screen, with 2, 3 or 4 options and the lock note when it shows.
- The title truck's two lanes (top and bottom) are unchanged; the group sits between them.

## 094 — Story's crates are three rows tall: no grey strip where the bottom row was (2026-11-12)

**Decision (Jira SCREAM-293, a subtask of SCREAM-291, PO, November 12, testing PR #199 with a marked screenshot):** "completely remove the row highlighted in red." Changes how 092 draws the missing row.

**Options considered:** the crates drawn a row shorter (chosen); a grey strip over the bottom row (092 as built).

**Why (product owner's rationale):** not given yet. *(Placeholder: engineering will ask.)*

**Engineering's calls (proposals):**

- The crates keep their tops and end a row sooner, at the cooler and the Fill screen. The pictures have four rows drawn in, so the bottom one is painted over in the freezer's dark blue and the crate gets a new cardboard edge.
- The doors (the open half's lid at the Fill screen and the plain right half) and the yellow outline round the chosen crate are a row shorter to match. Quick play is unchanged.

**Then (PO, November 12, testing #201, with a marked screenshot):** "I want to move the cooler down so it is vertically aligned", and: "I do want to eventually reveal the other sections of the cooler, so don't completely remove what is already built." Engineering: the crates are centred top to bottom in the freezer. Nothing is removed: the pictures keep all four rows and both halves, and Quick play uses them. The open part of each crate is one setting (`STORY_COOLER_COLUMNS` 2, `STORY_COOLER_ROWS` 3 in `tuning.ts`; `spec.coolerColumns` / `coolerRows`), and the squares, the crates' height and place, the grey panel, the doors, the outline and the arrow keys all follow it, so an upgrade (SCREAM-25) only has to change those numbers.

## 093 — M mutes the credits tune too (2026-11-12)

**Decision (Jira SCREAM-186, under SCREAM-6, PO, November 6):** the music can be muted and unmuted on every screen that plays music, not only while driving, with one setting for the whole game.

**What engineering found:** every evening screen already took M (the top bar handles it off the road, SCREAM-118), and the title, pause, end-of-day, results and high score screens play no music. The one gap was the uncle's credits tune: it didn't start if the music was muted, and M did nothing to it.

**Options considered:** the credits tune follows the music's mute (chosen); a separate sound setting.

**Why (product owner's rationale):** not given yet (the ticket gives the problem, not a reason). *(Placeholder: engineering will ask.)*

**Engineering's calls (proposals):**

- The tune always starts, muted if the music is, and M mutes or unmutes it while it plays (into the uncle's first lines, where it fades out).
- No on-screen mute button: no screen has one today (the driving view shows "Music off (M)").

## 092 — Story's cooler: the bottom row is gone, 18 ice creams to start (2026-11-12)

**Decision (Jira SCREAM-291, under SCREAM-78, PO, November 12):** "I want to completely remove the bottom row of the cooler. So there should be 18 total slots. 6 per cooler now." Changes 075 (24).

**Options considered:** the bottom row gone, 18 (chosen, the PO's own answer); 12 with one column open; 16 or 8 with whole crates covered (engineering's offers).

**Why (product owner's rationale):** not given yet. *(Placeholder: engineering will ask.)*

**Engineering's calls (proposals):**

- Story only (076); Quick play keeps 48. In each crate, the left two columns of the top three rows are open.
- Drawn as a plain strip over the bottom row of each crate's open half, the same grey as the covered half, at the cooler and the Fill screen. The keyboard at the Fill screen skips the bottom row.
- A Story save with more than 18 in the cooler leaves the extras behind (as 075 did for 24). The uncle's evening uses the same cooler; his steps still work.

## 091 — End Evening on the pause menu (2026-11-12)

**Decision (Jira SCREAM-290, under SCREAM-9, PO, November 12):** "A player to be able to end the night as it stands." "This is just like the shift + 3 command is all." Where: the pause menu with a Yes / No check, in Story and Quick play (the PO picked engineering's recommendation).

**Options considered:** an End Evening item on the Esc menu (chosen); a key of its own; a button on the truck screens.

**Why (product owner's rationale):** "If its 7:30 and I am out of stock. I may just want to end the evening." (the ticket)

**Engineering's calls (proposals):**

- The menu reads Resume, End Evening, Restart Evening, Quit To Title. Yes / No starts on No, like the others.
- It does what Shift+3 does: the clock runs out now. A sale under way finishes first (as at 8 PM), and the question says so ("It ends once this sale is done.").
- Story says "You keep what you made."; Quick play says "It still counts for high scores."
- Not on the menu while the uncle is running his evening; once he is skipped or done, it's there.
- Not on the high score screen's menu (the evening is already over).

## 090 — Story: the gas dial inside the truck and on the end-of-day screen (2026-11-12)

**Decision (Jira SCREAM-276, under SCREAM-7, PO, November 12):** "Add gas level to end of day screen and inside truck screen (not cooler)". How it looks: "Same as the roads dial. Except it doesn't wobble under 1/4 full like on the road. Similar spot in the bottom left corner."

**Options considered:** the road's dial, steady, bottom left (chosen); a line of text ("Gas: 1/4 tank"); a smaller dial.

**Why (product owner's rationale):** "so player can know to get gas soon or buy a temporary gas tank." (the ticket)

**Engineering's calls (proposals):**

- Story only (076), in both places. Quick play's hub has no dial yet; it is one line if wanted.
- The same size as on the road, at the pump's spot (pivot 80, 530), so in the hub it sits over the cooler's bottom-left corner.
- E turns red below 15%, as on the road; no wobble in the truck or on the end-of-day screen.
- The end-of-day screen shows tomorrow's tank (after a near-empty night the 1/6, after running out the 1/3), and only when there is a tomorrow (not on GAME OVER or STORY COMPLETE).
- The dial's drawing moved from HudScene into `src/ui/fuelDial.ts`, shared by both screens.

## 089 — Schedule and neighbour lines: only about special customers, at most one a night (2026-11-12)

**Decision (Jira SCREAM-275, under SCREAM-11, PO, November 12):** "I want to remove the lines about customers' schedule. Unless it's a customer that has special levels of tip or order number. It should surface less." Who is special: "People like Pizza Joe and Big Kev who will give you better business." How often: at most one a night ("Yes"). Changes 064 and 065.

**Options considered:** only special customers, one a night (chosen); as before (30% / 60% of paid sales, 4 a night, anyone); removing the lines altogether.

**Why (product owner's rationale):** not given yet. *(Placeholder: engineering will ask.)*

**Engineering's calls (proposals):**

- Special = a set order size (042) or hard to find (067): today Pizza Joe, Zombie A Poplicks, Ruth Butter Ginsburg (10 ice creams, tip x4) and Big Kev (7), all on Elm Park. Foley Stadium has none, so no lines there for now.
- Both kinds: a special customer can say something about their own week (064); anyone can say something about a special neighbour on their street (065), never an ordinary one. Hours lines are schedule lines, so the same rule.
- The chances (30% / 60%, and the neighbour shares) are unchanged; the limit drops from 4 to 1 a night. Hard-to-find neighbours are still passed over most of the time (067), so lines about them stay rare.
- The draft lines for ordinary customers stay in the Residents sheet's tabs and the code; they just aren't said. Hints about a big regular (048) are untouched.

## 088 — Story: the uncle's $20 for gas waits at the first pump for a player who goes without him (2026-11-12)

**Decision (Jira SCREAM-268, under SCREAM-5, PO, November 12):** "Player should get uncle benefits even if they decide not to use him (gas)". How: "When the player goes to the gas station for the first time, lets have the station say 'Your uncle left $20 for you to use.'" The $20 is "Just at the gas station", not added to the cash.

**Before:** only the uncle's evening had his $20 at the pump (SCREAM-173). On My Own, or skipping him before the pump, the player paid for their first gas.

**Options considered:** the $20 at the first pump (chosen); $20 added to the cash; a fuller tank at the start.

**Why (product owner's rationale):** "Player should get uncle benefits even if they decide not to use him (gas)" (the ticket).

**Engineering's calls (proposals):**

- Once per Story run, at the first pump where gas is bought: the pump says "Your uncle left $20 for you to use.", the button reads UNCLE PAYS, up to $20 (more than $20 is not allowed at that visit, as at his pump). Any of the $20 not used that visit is lost.
- Driving off without buying doesn't use it up: it waits for the next pump.
- Used at the uncle's own pump on his evening, so a With Uncle run that reaches his pump gets no second $20. Skipped before his pump, it waits like On My Own.
- Kept in the Story save. Saves from before this have it unused, so a run already under way gets the $20 at its next pump.
- Story only (076). Gas bought with it doesn't count as gas spent on the end-of-day screen.

## 087 — Fewer hint lines: the PO's Keep / Remove marks on every screen (2026-11-12)

**Decision (Jira SCREAM-286, PO, November 12):** every screen's hint lines went into a sheet ("SCREAM-286 - Hint lines (Keep or Remove)", Product Management Decisions) with a screenshot each; the PO marked them: "If nothing Keep. If remove, remove." Removed: the title's line of keys, the title's HOW TO DRIVE box, the line under the answers to "Bring your uncle along again?" and "Start a new story?", "X: Skip The Uncle" in the uncle's box, all of the cooler's line but Enter ("Leave Enter: Done"), "People in your ring may want ice cream (!)" on the drive line, and "Backspace: Undo" at "How much?". Everything else stays.

**Options considered:** the PO's marks, line by line (chosen); removing every hint line (the ticket's first wording).

**Why (product owner's rationale, November 12):** "Some of the tips weren't that helpful. Others felt in the way."

**Engineering's calls (proposals):**

- Row 7's note "Leave Enter: Done" (on the uncle's-box row, whose screenshot also outlined the cooler's line) is read with row 9 (the cooler's line, Remove): the cooler's line keeps only "Enter: Done" or "Enter: Buy Stock".
- Removing "X: Skip The Uncle" from his box also removes clicking it to skip him. X still skips him, and the truck's line along the bottom still says "X: Skip The Uncle".
- The cooler's locked line ("B Or Backspace: Back To The Truck") wasn't in the sheet and stays.
- The title's menu stays where it was, so there is a gap where the HOW TO DRIVE box was.
- Both modes: these are shared screens, and a hint missing in one mode only would be odd, so 076 is not stretched far.

## 086 — Asking for the order again: at most twice per customer (2026-11-12)

**Decision (Jira SCREAM-288, under SCREAM-154, PO, November 12):** "Only let the user click 'Ask Again' twice". This replaces "as often as the player likes" in 081 and 084, which was engineering's call and was on a branch for under an hour.

**Options considered:** twice per customer (chosen); as often as the player likes (081, 084); once only (the rule before 081).

**Why (product owner's rationale, November 12):** "I wanted it to be somewhat realistic. You can't keep asking a customer before they get annoyed."

**Engineering's calls (proposals):**

- The two are counted per customer and shared between the window (ASK AGAIN, R) and the cooler (FORGOT ORDER, B): they are the same action.
- After the second, ASK AGAIN and FORGOT ORDER go away, R and B do nothing, and both are dropped from the keys along the bottom. At the cooler the player then has to SERVE what they have.
- The customer correcting a wrong order ("That's not what I asked for. I wanted...") is not counted: the player didn't ask.
- Nothing on screen counts them down; the window's button reads ASK AGAIN (NO TIP), then ASK AGAIN, then is gone.
- The number is `ASK_AGAIN_LIMIT` in `tuning.ts`, so a power-up could raise it (the whiteboard's "Another order reminder").

## 085 — Tip bar: once there is no tip, the countdown goes away and the cup just says "No tip" (2026-11-12)

**Decision (Jira SCREAM-287, under SCREAM-154, PO, November 12):** "when user gets no tip. The countdown over the tip can end. Just show no tip." Follows 080 and 083, where the bar turned grey and kept shrinking.

**Options considered:** no bar once the tip is gone, only the words (chosen); a grey bar that carries on shrinking (080, 083).

**Why (product owner's rationale, November 12):** "I want the player to realize why they got no tip, so just some more context for them." Keeping "Took too long" when time runs out: confirmed (the same reason).

**Engineering's calls (proposals):**

- The whole bar goes: the green, its outline and lines, and the side labels at the cooler. "No tip" sits just above the cup.
- The same on the Fill screen and at the window.
- When the 40 seconds simply run out the bar has already shrunk to nothing; the words there are still "Took too long", which says why.

## 084 — Window: asking for the order again is a button, and works after the cooler too (2026-11-12)

**Decision (Jira SCREAM-285, under SCREAM-154, PO, November 12):** "user should be able to ask for the order again at the sales window, after the cooler."

**Before:** R asked again at the window, once, and only before the bag was served; it was named only in the line of keys along the bottom. After SERVE, at "How much?", there was no way to hear the order again.

**Options considered:** an ASK AGAIN button at the window, before and after the cooler (chosen, engineering's reading); the "..." bubble with dialog options (SCREAM-239, not built); leaving it to the R key alone.

**Why (product owner's rationale, November 12):** "I think this will be possibly replaced by the '...'. For now I went with this and will rethink it." So SCREAM-239 (the "..." bubble) stays open and may replace this button later.

**Engineering's calls (proposals):**

- The button sits at the right end of the strip under the counter, opposite RETURN TO COOLER (082), in the same blue. It reads ASK AGAIN (NO TIP) until the tip has been given up, then ASK AGAIN. R does the same.
- It shows once the order is hidden and at "How much?"; not while the order is still on screen, and not once the sale is over.
- At "How much?" the customer says the order for the usual five seconds and then asks the price again; the bag stays served. To change the bag, RETURN TO COOLER (or GO TO THE COOLER while they are saying it).
- It costs the tip, the same rule as before (Q9) and as FORGOT ORDER (081). It can be asked as often as the player likes.
- The uncle's tip about asking again now outlines the button.
- The keys along the bottom at "How much?" gained "R: Ask Again" and were shortened to fit ("Type The Price").
- SCREAM-239 (the "..." bubble, first option: repeat the order) overlaps with this: the PO to say whether it is still wanted.

## 083 — Window: the tip cup has the same countdown bar as the cooler, at the jar's size (2026-11-12)

**Decision (Jira SCREAM-284, under SCREAM-154, PO, November 12):** "The tip should continue the same countdown at the sales window, just smaller, the size of the tip jar". Follows 080 (the tall bar at the cooler).

**Options considered:** the same bar, as tall as the jar (chosen); the short stub of bills, as before; the cooler's full-height bar at the window too.

**Why (product owner's rationale, November 12):** "Want it to fit and I think it was a helpful mechanic."

**Engineering's calls (proposals):**

- "The size of the tip jar" is read as a bar as tall as the cup (70 px), standing above it; the cooler's is 190 px.
- Same colours as the cooler's bar (green, lighter green, amber, grey with no tip) and the same lines where the tip steps down. The small 20% / 15% / 10% / 5% labels down the side are left off: there is no room at that size. The tip on offer is still written above the bar.
- While the order is still showing, before the countdown starts, the bar is full and green.

## 082 — Window: a RETURN TO COOLER button at "How much?" (2026-11-12)

**Decision (Jira SCREAM-283, under SCREAM-154, PO, November 12, with two screenshots):** "on this screen, add a 'Return to Cooler' button in the bottom left." Where: "Under the tip jar bottom left (of the whole screen) not that section where the paper bag is", then circled on a screenshot: the left end of the strip under the counter.

**Options considered:** a button on the strip under the counter, bottom left (chosen, the PO's mark); on the counter beside the paper bag, under Today's Menu (engineering's first suggestion; the PO said no); no way back once the bag is served, as before.

**Why (product owner's rationale, November 12):** "I want to build this to be mouse friendly and eventually phone friendly so having all the buttons should be helpful."

**Agreed with the PO ("I agree with all the other suggestions"):** the sale stays on and the ice creams served are back in the bag to change; C does the same as the button; the tip keeps counting down; a price already typed is cleared.

**Engineering's calls (proposals):**

- The same blue as the Fill screen's button, with 18 px letters.
- The keys along the bottom gained "C: Return To Cooler" and lost "or click the keys" so the line still fits the screen.
- Both modes and the uncle's evening (one shared screen).

## 081 — Fill screen: BACK TO THE WINDOW becomes FORGOT ORDER, and the customer says the order again (2026-11-12)

**Decision (Jira SCREAM-282, under SCREAM-154, PO, November 12):** "changing the text on the 'Back to the window' button to 'Forgot Order' and it brings you straight to the customer redoing the order". One step where there were two (back to the window, then R to ask again).

**Options considered:** the button asks again in one step and says so (chosen); going back to the window and asking there with R, as before.

**Why (product owner's rationale, November 12):** "Back to the window was long and made it almost seem like you were serving the ice cream to them. Changed the name to clarify."

**Engineering's calls (proposals):**

- It costs the tip, like asking again at the window (Q9): engineering asked the PO and built the existing rule while waiting. Confirmed by the PO, November 12: "Yes", it costs the tip.
- Asking again is no longer once only. The first time still loses the tip and the second chance after a wrong order; after that (and after a corrected mistake) the player can ask as often as they like, since there is nothing more to lose. Otherwise FORGOT ORDER would sometimes do nothing.
- B does the same as the button, and the keys along the bottom read "B: Forgot Order". There is no longer a way back to the window without asking again.
- What is in the bag stays in the bag.
- Both modes and the uncle's evening (one shared screen).

## 080 — Fill screen: a tall green tip bar above the cup that shrinks as the tip counts down (2026-11-12)

**Decision (Jira SCREAM-281, under SCREAM-154, PO, November 12):** "Lets also add the tip countdown on the left side of that screen. [...] On the left side where the tip cup is. Lets extend the green bar to show the tip amount at 20%. As the time ticks away, show the tip decrease."

**Options considered:** a tall bar above the cup on the left, full at 20% and shrinking (chosen); the short stub of bills sticking out of the cup, as before (SCREAM-125, SCREAM-134).

**Why (product owner's rationale, November 12):** "Currently there isn't much indication that the players tip is ticking down."

**Engineering's calls (proposals):**

- "Tip amount" is shown as the percentage. The dollar amount isn't known on this screen: the player hasn't typed the price yet.
- The bar is 190 px tall when full, with a line and a small label where the tip steps down (20%, 15%, 10%, 5%), and the tip on offer in bigger letters above it.
- It changes colour as the tip drops (green, lighter green, amber) and goes grey when there is no tip.
- Only the Fill screen changes. The cup at the window keeps its short stub: there the customer's patience and the order are what the player is watching.
- Both modes: the Fill screen is shared.

## 079 — New Story: a left click or Enter begins, on every screen before the first evening (2026-11-12)

**Decision (Jira SCREAM-270, under SCREAM-9, PO, November 12):** "On new story mode. Be able to click left mouse (and enter) to be begin."

**Options considered:** a left click and Enter both work on every screen between choosing New Story and the first evening (chosen, engineering's reading of the PO's line); only on the New Bike screen; leaving the two questions on their letter keys.

**Why (product owner's rationale):** no separate reason given. The PO confirmed engineering's two calls below (With Uncle marked first; No marked first on "Start a new story?") on November 12: "Yes".

**Engineering's calls (proposals):**

- The New Bike screen (shown when starting On My Own) began on Enter only: a left click anywhere now begins too, and its hint reads "Click Or Enter: Start Monday".
- The two questions ("Bring your uncle along again?" and "Start a new story? Your saved story will be lost.") could already be clicked, but Enter did nothing. Now one answer is marked like the title menu's choices (> ... <), ← and → move the mark, Enter picks it, and a line under the answers says so. The letter keys (U, O, Y, N) and Esc still work.
- "Bring your uncle along again?" starts with With Uncle marked (the first answer). "Start a new story?" starts with No marked, so pressing Enter twice can't wipe a saved story by accident.
- Only the left mouse button counts on these screens, and a key held down from the screen before doesn't.
- With Uncle still has no New Bike screen (062), so there is nothing to click there: his evening starts straight away.

## 078 — Cooler: the button says DONE, with no price, when nothing new is picked (2026-11-12)

**Decision (Jira SCREAM-277, under SCREAM-154, PO, November 12):** "When in cooler and no new inventory is selected, change button from 'buy stock' to 'Done' (no price)." As soon as something is picked it reads BUY STOCK with its price again.

**Options considered:** DONE with no price when there is nothing to buy (chosen); BUY STOCK $0.00 as before.

**Why (product owner's rationale, November 12):** "Buy Stock, with zero stock didn't really make sense. Just cleaning that up a bit."

**Engineering's calls (proposals):**

- Written DONE, in capitals like the screen's other buttons; same place, same green, same key (Enter). The line of keys along the bottom says "Enter: Done" or "Enter: Buy Stock" to match.
- Everywhere the cooler is used for stocking: before setting off, restock stops at home, the uncle's evening, and both modes (one shared screen; the button's wording is not a balance change, so 076 is not stretched far).
- DONE charges nothing and leaves the cooler. A price changed on Today's Menu is still kept, as it was with BUY STOCK $0.00.
- An empty cooler still can't be left with DONE: the "Add at least one ice cream" line shows, as before.
- The uncle still says 'hit "Buy Stock"': by then the player has to pick something, so the button reads BUY STOCK.

## 077 — Fill screen: BACK TO THE WINDOW moves left under the tip jar, SERVE to the middle (2026-11-12)

**Decision (Jira SCREAM-273, under SCREAM-154, PO, November 12, with a screenshot):** "Move 'Back to the window' to the left side under tips. Move Serve to where back to window is now." This changes where 071 (SCREAM-240) put the two buttons.

**Options considered:** BACK TO THE WINDOW on the left under the tip jar and SERVE in the middle of the counter (chosen); as 071 left them (BACK TO THE WINDOW in the middle, SERVE at the bottom right).

**Why (product owner's rationale, November 12):** "It's what felt more natural. The SERVE button is associated with the ice cream. Back to window is with the tip jar."

**Engineering's calls (proposals):**

- BACK TO THE WINDOW is centred under the tip jar on SERVE's row, with its letters a little smaller (18 px, was 20) so it fits between the edge of the screen and the counter.
- Keys are unchanged (B, Enter), and so is the line of keys along the bottom.
- Both modes: the Fill screen is shared, and a button in a different place in each mode would be a trap.

## 076 — From now on, changes apply to Story only unless the PO says otherwise (2026-11-12)

**Decision (PO, November 12):** "from now on, all changes to the game will be on story mode unless explicitly stated otherwise." Quick play stays as it is.

**Options considered:** Story only by default (chosen); asking for each change whether Quick play gets it too, as before.

**Why (product owner's rationale, November 12):** "Quickplay is more arcade mode. Story mode is you start \"bad\" and build up."

**Engineering's calls (proposals):** bug fixes still go to both modes. A change to something the two modes share (a screen's text, a key) is checked against Quick play in its tests, and the ticket says which mode it is for.

## 075 — Story's cooler: half of every crate is covered, 24 ice creams to start (2026-11-12)

**Decision (Jira SCREAM-269, under SCREAM-78, PO, November 12, with a sketch):** "Here is how I want the cooler to be. 24 to start." In Story the cooler keeps its three crates, but half of each is covered: 3 crates x 8 squares = 24 ice creams. Each crate has two half doors with a handle each; the open one swings up when filling an order, and the covered one is a plain panel with no words on it. This replaces the first version from 074 (two whole crates and a third marked LOCKED, 32 ice creams), which was on main for a few hours.

**Options considered:** half of every crate covered, 24 (chosen, the PO's sketch); two whole crates and a locked third, 32 (engineering's first guess in 074); one whole crate, 16.

**Why (product owner's rationale, November 12):** "The biggest reason is for players to plan inventory. They are more likely to need to restock. They will be more likely to run out of stock in one area and need to remember that."

**Engineering's calls (proposals):**

- The covered half is the right two columns of each crate; the left two are open.
- When filling an order one door is open at a time, as crates were before (the PO confirmed). Today each crate has only one door that opens; when a bigger-cooler power-up (SCREAM-25) uncovers a second half, its door will open separately.
- Keys 1, 2 and 3 still choose a crate. The arrow keys stay in the two open columns.
- On the prep screen the covered halves are the same plain panels, without handles (the crates there are shown open).
- Quick play is unchanged: whole lids, 48 squares (076).
- A Story save holding more than 24 ice creams loses the extras when it is next opened; anything that sat under a covered half moves to the first open square.

## 074 — Story starts with a weaker truck, so power-ups feel earned (2026-11-12)

**Decision (Jira SCREAM-204, under SCREAM-78, PO, November 8, 11 and 12):** in Story the player starts out worse at four things, and power-ups (073) will win them back. Quick play keeps the truck as it was.

- **Driving:** the truck is slower, slower to speed up, slower to stop, rolls more slowly, and turns a little wider at speed. The PO's numbers (November 12): "the brake is way too good. If the person holds break it should take 400x longer to break. Acceleration should be worse by double. And roll speed should be reduced by 75%." So braking takes 4 times as long (0.15 s to 0.6 s), reaching top speed twice as long (2.5 s to 5 s), and the roll is a quarter of the speed. A second round the same night (02:17): "Reverse speed should be maxed out at 1/3 of current. Reverse acceleration should be reduced. Should be half of current. Brake speed should be reduced by 2x. Music radius reduced more, the same amount. Acceleration should be reduced by 2x." and "Roll speed should be reduced by 1/3". So now: braking 8 times as long as Quick play (1.2 s), reaching top speed 4 times as long (10 s), the roll a sixth of the speed (12 px/s), reverse a third as fast (about 46 px/s) and twice as long to get there (1 s), music 70% (210). A third round (02:36): "Braking reduced again. 2x worse" and "At any speed above roll: turning should be 2x worse". So braking takes 16 times as long as Quick play (2.4 s from top speed), and whenever the truck is going faster than its roll the wheel turns it half as fast, so every turn is twice as wide; at roll speed or slower it turns as tightly as before. Also "reduce the music radius. another 85% of max": read as another 15 points of Quick play's radius, so 55% (165); the PO confirmed 55% afterwards. And (02:49): "I get the roll and creep language. I think the creep will be at a good spot. I think the roll for 10 seconds is too long, lets go to 4 seconds": after the gas is let go, Story's truck rolls down from top speed to its creep in 4 seconds (Quick play about 10).
- **Music:** it reaches less far: 85% of Quick play's radius (300 to 255), then 70% (210) in the second round. PO, November 12: "Let's reduce radius by 85%" (read as "to 85%", one of the two sizes engineering offered; a cut of 85% would leave a ring smaller than the truck).
- **Cooler:** it is smaller. First 2 crates (32 ice creams) instead of 3 (48), with the third marked LOCKED; replaced the same day by 075 (half of every crate covered, 24).
- **Gas:** it burns faster. After an evening that ends out of gas, the next day starts with 1/3 of a tank (it was 1/6): "when player runs out, then should start with 1/3 tank now" (PO).

**Options considered:** Story starts weaker (chosen); everything stays at full strength and power-ups only add on top.

**Why (product owner's rationale, November 11):** "I think there are two areas of the game we should make the player worse at, at the beginning of the game, so that the powers up feel like they are earned: 1. Driving - truck 2. Music - radius the music reaches". Then: "Cooler size needs to be reduced as well" and "Also Fuel - it needs to go down faster". November 12: "Making things worse is the main priority".

**Engineering's calls (proposals; every number is a starting guess in `tuning.ts`, easy to change):**

- Top speed 80% (547 to 438) and turning at speed 90% (the tightest slow turn is unchanged, so a U-turn still fits the road) are engineering's guesses; gas burns 1.3 times as fast (also engineering's).
- The PO's three driving numbers were read like this: "400x longer" as 400%, so 4 times as long (400 times would be a full minute to stop); "roll speed" as the creep, the speed the truck rolls at with no key held (72 to 18 px/s). How far the truck coasts after letting go of the gas (SCREAM-114's momentum) was not changed in the first two rounds; the third sets it to 4 seconds, with the words agreed with the PO: the roll is the coasting after the gas is let go, the creep is the slow speed it settles at. In the second round: "reduced by 2x" as twice as long again; "half of current" reverse acceleration as twice as long to reach full reverse speed; music "the same amount" as another 15 points of Quick play's radius; roll "reduced by 1/3" as two thirds of the round-one creep.
- Quick play is unchanged, so its high scores still compare with older ones.
- The uncle's evening uses the weaker truck too: it is Day 1 of Story, and this way nothing is taken away on Day 2.
- A day that ends low on gas without running out still starts the next with at least 1/6 of a tank, as before; only running right out gives 1/3.
- A Story save from before this change holding more than the cooler now holds loses the extras when it is next opened.
- Scenes now read the truck's abilities from `evening.spec` (`src/state/TruckSpec.ts`), which is where power-ups will change them.

## 073 — Power-ups are bought with money (2026-11-11)

**Decision (Jira SCREAM-79, under SCREAM-78, PO, November 11):** players get power-ups and upgrades by spending the money they earn. The details the PO agreed the same evening:

- **Where:** at home, in the hub. The cork board above the cooler is the power-ups area: "The user can click into that and see the powerups menu." (PO)
- **When:** before setting off, and on any stop at home to restock.
- **Two kinds:** cheap ones that last one evening, and dearer ones that last the rest of the Story run (better brakes, for example). Some are bought again and again: "an emergency supply of gas is something I want to make a ticket for" (PO; that is SCREAM-122, the spare can of gas).
- **Story only** for now. Quick play is one evening with no savings.
- **One pot of money:** power-ups are paid for from the same money that is saving for the $600 bike.

**Options considered:** buy them with money (chosen); roguelike, where the player is offered a choice of power-ups as a run goes on; find them on the map while driving.

**Why (product owner's rationale, November 11):** "I think it's a more fun experience. I was kicking around the idea of making the game a rogue-like, but I think the real fun comes from weighing money vs the help you will get from the powerups. The saying 'Gotta spend money to make money.'"

**Engineering's calls (proposals):**

- Where and when to buy, the two kinds, Story only and the one pot of money were engineering's proposals; the PO agreed to each, and the cork board is his own idea.
- With one pot of money, prices need tuning so that buying nothing is not always the best way to reach the bike. To be worked out with SCREAM-204 and the first power-ups.
- The power-ups menu itself is a new ticket (SCREAM-267), to be built before any single power-up.

## 072 — Esc on the high score screen opens the pause menu, with a warning (2026-11-11)

**Decision (Jira SCREAM-181, under SCREAM-8, PO, November 6):** while the high score screen is asking for initials, Esc opens the pause menu with the line "Quitting won't save your high score." Resume goes back to the screen as it was, with any letters already typed. Quit To Title asks "Are you sure?" and, on Yes, leaves without saving the score.

**Options considered:** the pause menu with a warning (chosen, the PO's design in the ticket); Esc going straight to the title; Esc doing nothing, as before.

**Why (from the ticket, November 6):** Esc did nothing on this screen, and the PO presses it there wanting to go back and change game mode.

**Engineering's calls (proposals):**

- The menu opened from here has no Restart Evening: the evening is over, and in Story restarting would replay the last day of a finished run. It shows Resume and Quit To Title.
- Only while initials are being asked for. Once the table is showing there is nothing to lose, so Esc goes to the title as before.
- The hint under the initials gains a third line, "Esc: Menu", so the way out is on screen.
- The Tutorial table in the ticket's checks can't be reached any more (decision 045), so it isn't tested.

## 071 — Filling an order: a BACK TO THE WINDOW button (2026-11-11)

**Decision (Jira SCREAM-240, under SCREAM-154, PO, November 10):** the cooler screen where an order is filled gets a button that goes back to the sales window, the same as the B key. The PO's note: "Moved the center of the serving area."

**Options considered:** a button (chosen); the B key alone, as before.

**Why (product owner's rationale, November 11):** "If I forget a customer's order, I want an easy way to go back. The user might not know the button to use."

**Engineering's calls (proposals):** the PO was asked where the button should sit and didn't answer, so the placement is engineering's reading of his note: the middle of the serving area (the "In the bag" panel), on the same row as SERVE, below the ice creams in the bag so a full bag of 10 doesn't touch it. It is blue like BACK ON THE ROAD, so SERVE stays the one green button.

## 070 — At the window, "Next Customer" when someone is waiting; driving off instead is a key (2026-11-11)

**Decision (Jira SCREAM-241, under SCREAM-154, PO, November 10 and 11):** when a sale is over and another customer is waiting at the truck, the button under the window says NEXT CUSTOMER instead of BACK ON THE ROAD and brings that customer straight to the window. The player can still drive off instead, with a key: "Have drive off be a keyboard button" (PO, November 11).

**Options considered (for driving off with people waiting):** a key (chosen, the PO's own answer); a second, smaller Drive Off button beside Next Customer; no way to drive off until everyone is served.

**Why (product owner's rationale, November 11):** "I don't think Drive Off will be used much, the customer is there, so you'll want the business."

**Engineering's calls (proposals):**

- The key is **B**, the same key that drives off during a sale. The hint line reads "Enter: Next Customer    B: Drive Off".
- "Waiting" means standing at the parked truck right now (their pink square under it). The button changes back if they give up while the finished sale is still on screen, and changes to NEXT CUSTOMER if someone walks up.
- After B, the people left behind keep waiting, and nobody is served until the truck has moved (otherwise the road would open the window for them at once).
- Not during the uncle's evening: his steps expect the road between sales.

## 069 — The gas gauge is bigger and sits at the bottom left (2026-11-11)

**Decision (Jira SCREAM-238, under SCREAM-7, PO, November 10):** the gas gauge is bigger and moves from the top right (055) to the bottom left of the screen, while driving and at the pump. This replaces 055.

**Options considered:** bottom left, bigger (chosen); leave it by the money (055).

**Why (product owner's rationale, November 11):** "I was finding it difficult to notice when I was getting low on gas."

**Engineering's calls (proposals):**

- About one and a half times the size (the dial's radius goes from 46 to 72 px).
- On the road it sits just above the controls hint; the park brake sign and the short yellow notices start to its right instead of under it.
- At the pump it sits in the corner itself, below the pump's picture.
- SOLD OUT and the customer's 5-second "!" go back to sitting just left of the money.
- The uncle's line said "the gauge up top", which is no longer true. It now reads "Keep an eye on the gas gauge. Run dry and the night's over." This wording is engineering's draft for the PO to change.

## 068 — The public site is published from a release branch, not from every merge to main (2026-11-10)

**Decision (Jira SCREAM-266, under SCREAM-202, PO, November 10):** the public site is built only from a branch called `release`. Work still merges to main, but that no longer changes what players see. To publish, engineering opens a pull request from main into `release` and the PO merges it.

**Why (product owner's rationale):** "I do want to keep making edits to the game, without changing the game that testers see." Playtest round 3 was about to start. On choosing a release branch over the other options (PO, November 10): "It was engineering teams suggestion, I've used different branches in the past so I think it makes sense to do this in general, just a matter of how best to do it within GitHub."

**Options considered (engineering laid them out and proposed the first; the PO: "Yes go ahead"):**

- A release branch (chosen): main and the public site are separated, and an urgent fix during a playtest can go to `release` alone.
- Merge nothing until the round ends: no setup, but pull requests pile up and start depending on each other (the trouble behind PR #117).
- A deploy button pressed by hand: the smallest change, but an urgent fix would publish everything else on main with it.
- A second, frozen copy of the game at its own link for testers: more to build, and two live versions to keep track of.

**Engineering's calls (proposals):**

- Release pull requests are merged with "Create a merge commit", so the next one shows only what's new.
- Pull requests into `release` run the same automatic checks as pull requests into main.
- A manual "Run workflow" only publishes when started from `release`.
- An urgent fix made on `release` is then merged back into main by a second pull request, so it isn't lost at the next release.
- How to publish is written up in `docs/engineering.md` ("Publishing").

## 067 — Hard-to-find customers: a 30-second window, 10 ice creams, a 4x tip (2026-11-10)

**Decision (Jira SCREAM-250, under SCREAM-11, PO, November 10):** in Story a few customers are nearly impossible to catch. Each has a short window; catch them in it and they buy big.

- **The order is 10 ice creams, memorised like any other, and the tip is 4 times the usual** ("Lets make it 10 items, they have to memorize but the tip is 4x"). It was "like 15 say" in the brainstorm (063).
- **The window is 30 seconds of play**, which is 18 minutes on the game's clock. He first said 20 seconds ("Lets say 20 second window"), then, before testing: "Lets move it to a 30 second window." _His reason for the change: to ask._
- **"While these people should be nearly impossible to find at other times, they should be 100% in the window given though."**
- **"I want these hints to be a little less common than the others."**
- Engineering proposes who they are ("Go ahead and suggest some").
- They aren't "recluses" (064): some have the same window every day, others one moment a week, and the reason differs per person.

**Options considered:** an order of 15 or 10 (chosen), memorised (chosen) or shown as a list; a window of "6 to 6:05" (about 8 seconds), 20 seconds, or 30 seconds (chosen); outside the window never, or nearly never (chosen).

**Why (product owner's rationale, from 063):** "I want to have some challenging aspects to the game, and if the player puts in the effort, I want the player to be rewarded. If a player gets used to the neighborhood, they should start to wonder why particular houses are impossible to get. The payoff of finally getting a house should be important."

**Engineering's calls (proposals):**

- A **Hard to find** column (Yes) on both map tabs of the Residents sheet. It needs From and Until (the window) and at least one ticked day; the 10 comes from Order size.
- **Caught** means the truck's music reaches their house inside the window on a ticked day: they come out for certain, and are served as normal even if the window closes while they walk.
- **Nearly impossible otherwise:** outside the window (or on an unticked day) they get one roll an evening at their Likelihood from the sheet, set to 2%. They're home all evening and may be seen in the yard, so the player can wonder about the house.
- **Hints:** their own line and their street's line give the window ("Nobody ever catches [Name]. Try between [From] and [Until]."), using `[From]` and `[Until]` together. They're never described as "home every day". When a hard-to-find neighbour comes up as the one to talk about, they're passed over half the time (`HARD_TO_FIND_HINT_SKIP`), so their hints are rarer. 8 new draft lines.
- **Starting three, Elm Park** (people who almost never bought before): Pizza Joe (Westland Street) every day 6:00 to 6:18; Zombie Poplicks (Lee Street) every day 7:30 to 7:48; Ruth Butter Ginsburg (Germain Street) Fridays only, 7:00 to 7:18. Foley Stadium has the column, all blank.
- Not in the uncle's evening. Quick play ignores the column.
- `HARD_TO_FIND_TIP_FACTOR` = 4 in `tuning.ts`. The order is shown for the usual time before it must be remembered; nothing was changed for 10 items.

## 066 — Some customers are only home at certain hours of the evening (2026-11-10)

**Decision (Jira SCREAM-249, under SCREAM-11, PO, November 10):** in Story, a resident can have hours as well as days: home only from a certain time ("home every day but only after 7") or only until one. Outside their hours they stay indoors and don't come to the truck. They and their neighbours can say so. The PO picked it as the next customer ticket, with SCREAM-250 (hard-to-find customers) to follow, since 250 needs it.

**Also decided (PO, November 10):**

- **The time hints move here from SCREAM-248**, so 248 can be Done. "I don't want this to be the only change made to these dialogs, we will continue to add more."
- **Only one Big Kev:** "Big Kev should be the regular that the uncle suggests" (the kid on Institute Road, T034). The other one (T028, an adult on Haviland Street) is renamed; "Sherbert Hoover" is engineering's stand-in name for the PO to change.

**Options considered:** hours as two sheet columns, From and Until (chosen), or a single text column; people out of their hours simply don't buy, or also stay indoors (chosen, so what the player sees agrees with what they're told).

**Why (product owner's rationale):** from the brainstorm (063): the neighbourhood should be "memorable, learnable", and "I want the map to be interesting, so you can always find out another detail." _To ask the PO if he wants to add a reason specific to hours._

**Engineering's calls (proposals):**

- Two columns on both map tabs of the Residents sheet, **From** and **Until**: a time from 5:00 PM to 8:00 PM (the evening), blank for no limit. Story only; Quick play ignores them.
- Starting values, Elm Park only, five people: Drake Maye from 7:00 (a regular: the PO's "every day but only after 7"), Lucy Dulce until 6:30 (a kid regular with a bedtime), Joe Sullivan from 6:00, Kathleen Scoopley from 6:30, Mrs. O'Hoolahan until 7:00. Not the uncle's regular (Chloe Hogan), Big Kev, or the Hinted regulars, whose lines say "every evening". Foley Stadium has the columns, all blank.
- Someone who isn't home yet starts the evening indoors and doesn't hear the truck; when their time comes they get a fresh first chance. Someone whose time is up goes indoors; anyone already on their way to the truck or waiting at the curb still gets served.
- New tags `[From]` and `[Until]` on the Schedule lines and Neighbour lines tabs ("I'm never home before [From]." / "[Name] on [Street] is gone by [Until]."); times are said as "7" or "6:30". 14 new lines, all engineering's drafts. A person with hours keeps their other lines too.
- No visible tell yet beyond staying indoors: lit windows and cars (SCREAM-251, 252) will show it.

## 065 — Neighbours tell the player about each other's days (2026-11-10)

**Decision (Jira SCREAM-248, under SCREAM-11, PO, November 10):** in Story, customers sometimes say when someone else is home: the community knows itself ("I want to be thinking about the community aspect too. They know someone who is home every day but only after 7."). The PO picked this as the next customer ticket after 247 ("Go ahead with the next item"). This PR does days; times of the evening wait for SCREAM-249.

**Options considered:** anyone can talk about anyone, or only people who know each other (chosen: for now, people on the same street).

**Why (product owner's rationale):** the community aspect, as quoted above; 063's reasons apply too ("I want the neighborhood and people to become memorable, learnable").

**Engineering's calls (proposals):**

- **Who knows whom:** people on the same street of the same map. A "Friend of" column (SCREAM-254) can widen it later.
- **Who gets talked about:** anyone with ticked days who buys (not 0%). The lines are a new **Neighbour lines** tab in the Residents sheet ("sync neighbour lines"), with the same tags as the schedule lines plus `[Name]` and `[Street]`; all 24 are engineering's drafts.
- **One way of describing each person per run:** each resident gets one neighbour line of each kind for the run, so everyone on the street says the same thing about them (the PO's rule for hints, November 8: never hinted at in two different ways in the same story).
- **No reasons in neighbour lines** ("has soccer"): the person gives their own reason in their own line (064), and the two could disagree.
- **When:** it shares the moment and the limits of 064 (after a paid sale, no tip needed, 4 a night in all, never with a hint, not in the uncle's evening). When a customer has something to say, it's about a neighbour 70% of the time for people home every day (their own line says little) and 30% for everyone else (`NEIGHBOUR_LINE_SHARE_*` in `tuning.ts`). Never the same neighbour or the same wording twice in an evening. A regular who has used up their own lines tonight talks about a neighbour instead.
- Unlike the hints of 048, the neighbour may already have been served tonight: the days are still worth knowing.
- Debug: Shift+8 makes the next paid sale end with a line about a neighbour.

## 064 — Customers mention their own schedule at the window, in many different wordings (2026-11-10)

**Decision (Jira SCREAM-247, under SCREAM-11, PO, November 10):** now and then, in Story, a customer leaving the window says something true about their own week, such as "See you Thursday!". There are many ways of saying it, so the dialogue doesn't repeat. The PO's examples: "I have soccer until Thursday", "I work every day except...", "The best days to visit are...", "Nobody is home on...". The lines live in a new **Schedule lines** tab of the Residents sheet ("sync schedule lines"), for the PO to add to and rewrite.

**Also decided the same day (for later tickets):**

- **Order of work:** a few of the customer tickets, then playtest round 3, then power-ups.
- **The memorable few (SCREAM-246):** about 35% of residents get memorable traits. They lean towards likely customers, "however we do want to have interesting unlikely people".
- **Hard-to-find customers (SCREAM-250, called "recluses" in 063):** a few have the same window every day ("like 6 - 6:05 every day"), others one moment in the week ("Friday after 7"). "Reclusive isn't the right word": they could be busy all week and then have a party on Friday at 7. "More of a hard to find customer than reclusive, although that could be an excuse for one of those customers."

**Options considered:** one wording ("See you Thursday!") or many (chosen); lines fixed in the code or in the sheet (chosen, like the hint lines).

**Why (product owner's rationale, November 10):** "I don't want the dialog to get very repetitive."

**Engineering's calls (proposals):**

- A line uses one tag and the game fills it in from the person's Mon to Sun ticks, so every line is true: `[Next]` the next day they're home; `[Back]` the same, used only when they're away tomorrow ("until Thursday"); `[Home]` the days they're home; `[Away]` the days they're out; no tag for people home all seven days. Lists stop at three days (someone home five days says which two they're out). `[Next]` and `[Back]` only name a day still to come in this run, so the player can act on it; on the last day people give their list of days.
- Each person keeps the same few lines for a whole run, one of each kind (so a kid's excuse is always soccer, not soccer on Monday and swimming on Wednesday), picked from the run's seed: that follows 063 (traits don't change in a playthrough). Different people get different lines. Kid, Adult or Any, like the hint lines.
- When: after any paid sale, with or without a tip (it's about themselves, not a reward like the hints of 048); a 30% chance; 4 a night at most; never on top of a hint or the rotary hint; not in the uncle's evening (his lines only). Both maps' people. Numbers in `tuning.ts` (`SCHEDULE_LINE_CHANCE`, `SCHEDULE_LINES_MAX_PER_EVENING`).
- People with no ticked days say nothing. Quick play has none (063).
- **After the PO's first test (November 10: "The only prompt I got was, Im home every day. I didn't get any others, I would like a variety"):** the customers a player meets most are the regulars, who are home all seven days and had only a few "every day" lines between them. Now each regular gets three different "every day" lines (everyone else still one line per kind); there are 16 "every day" wordings, most of which don't say "every day" ("See you tomorrow!"); the same wording is never heard twice in one evening; and people with only some days ticked, who come out less and whose line tells the player more, say theirs 60% of the time (`SCHEDULE_LINE_CHANCE_SOME_DAYS`).
- 33 of the 38 starting lines are engineering's drafts, marked so in the sheet.
- Debug: Shift+7 makes the next paid sale end with the customer's line.

## 063 — Customers get fixed personal traits, in Story only, each with a tell (2026-11-10)

**Decision (under SCREAM-11, PO, November 10; from a brainstorm on making customers more dynamic and interesting):**

- **Traits are fixed per person** and don't change during a playthrough. If a trait matters to the player, the game hints at it through dialogue or something visible.
- **Everyone gets traits; a memorable few get a lot.** Everyone else is mildly different (for example, occasional hints about their own schedule). The neighbourhood knows itself: customers can tell you about each other ("they know someone who is home every day but only after 7").
- **Story only.** Quick play has no traits.
- **Home tells are both cars and lights, with variety:** "some people park, some don't have a car so the lights on, some are both."
- **Remembering is the point for now.** The game doesn't keep notes for the player. A power-up, "The Handy Notebook" (SCREAM-245), tracks the tips customers give.
- **Recluses:** some people are hinted to be reclusive, and catching them at just the right time brings a huge order ("like 15 say").

The tickets: High, schedules and where people are: SCREAM-246 (the sheet's trait columns and the memorable few), 247 ("See you Thursday!"), 248 (neighbours' hints), 249 (hours of the evening), 250 (recluses), 251 (lit windows), 252 (cars), 253 (weekday routines), 254 (friends and siblings), 255 (a dog in the yard), 224 (at the park), 212 (parties). Medium, temperament, the window and memory: SCREAM-256 (slow to leave, or right away or not at all), 257 (walking speed by age), 258 (tipping), 259 (awkward payers), 260 (chatterboxes), 261 (indecisive), 262 (grudges), 263 (word of mouth); already there: 168 (chasing, now per person), 222, 84, 166, 102.

**Options considered:** for the home tell, cars, lit windows, or both with variety (chosen); a notebook the game keeps for everyone, or the player remembers and a power-up helps (chosen); traits in both modes or Story only (chosen); traits for everyone, for a memorable handful only, or everyone a little and a few a lot (chosen).

**Why (product owner's rationale, November 10):**

- Fixed traits: "I want the neighborhood and people to become memorable, learnable. I want players to build routes around the regulars and other events and schedules that they pick up on."
- Cars and lights, with variety: "I want it to be a little subtle and different."
- Remembering, with the notebook as a power-up: "I want the beginning of the game to be difficult. I want players to weigh spending money vs convenience."
- Story only: "You can't get to know a weekly schedule over 1 night. I want the story to be more about the neighborhood and the people. The quick mode being a scramble to get customers."
- Everyone gets traits: "I want the map to be interesting, so you can always find out another detail."
- Recluses: "I want to have some challenging aspects to the game, and if the player puts in the effort, I want the player to be rewarded. If a player gets used to the neighborhood, they should start to wonder why particular houses are impossible to get. The payoff of finally getting a house should be important."

**Engineering's calls (proposals):** one column per trait in the Residents sheet, blank meaning "ordinary", added as each trait is built; a "Home tell" column (car, lights, both); "From" and "Until" columns for hours, which recluses and time hints build on; neighbours' hints reuse the hint lines (048) and are checked against the sheet so they're always true. Most of the ideas in the Medium tickets, and the dog, routines and word of mouth, are engineering's ideas that the PO asked to have ticketed: each still needs his answers to its "to discuss" questions. Still open: how many memorable few per map; whether a recluse's window is the same every day. SCREAM-168 stays High (it was already).

## 062 — Riding with the uncle skips the New Bike screen; the credits' scroll sets up the bike (2026-11-10)

**Decision (Jira SCREAM-235, SCREAM-236, PO, November 10):** a new Story With Uncle goes from the title straight into the uncle's evening (the credits' scroll, then him in the truck), with no New Bike screen. On My Own keeps the New Bike screen as it was ("on my own screen, the bike info stays"). So the bike stays the goal, the scroll now ends with it, in the PO's words: "You saw a new bike in the shop window the other day for $600.00. Better get to work, that's a lot of Ice Cream..." (the PO also dropped "You agree, since you could use a little more money before school starts in the fall...").

**Options considered:** drop the screen With Uncle and move the bike into the scroll (chosen); drop the screen for both; keep it for both.

**Why (product owner's rationale, November 10):** "It felt like two different intro screens saying almost the same thing."

**Engineering's calls (proposals):** the bike lines come after the PO's text, so they're the last thing on screen when the scroll cuts to the truck; the price comes from `BIKE_PRICE_CENTS`, so it follows the tuning. The scroll is about the same length as before (one line longer); `CUT_EARLY_MS` can shorten it.

## 061 — Foley Stadium's new likelihoods are on purpose; the tests follow the sheet (2026-11-10)

**Decision (Jira SCREAM-231, PO, November 9):** the likelihoods synced in SCREAM-228 stay: most Foley Stadium customers who were 0% ("never") now have 1-16%, so in Quick play the mix is 40 regulars, 117 one-day-in-3 buyers and 3 never-buyers (it was 40 / 80 / 40, the 25% / 50% / 25% split of SCREAM-148). The residents tests now work out the expected mix from the sheet, so a later sync doesn't turn them red.

**Options considered:** keep the new percentages and update the tests (chosen); set those customers back to 0% in the sheet; decide later.

**Why (product owner's rationale, November 10):** "In quickplay you aren't spending as much time exploring for the future."

**Engineering's calls (proposals):** in Story the weekly ticks (057) decide instead, so this mix is Quick play's only.

## 060 — The residents build leaves roundabouts out of streets and curbs; each resident's yard has its own seed (2026-11-09)

**Decision (Jira SCREAM-230, under SCREAM-202; engineering, November 9):** when the build works out a resident's street, which way their house faces, and their curb, it uses the ordinary streets only: a roundabout (a road with a `ring`, 050) is never anyone's street or curb. The ring still counts as road, so nobody stands on it and no pink square is nearer to it than to its own street. Each resident's yard spots now come from their own random seed (their ID) instead of one shared sequence, so one person's change no longer shifts everyone listed after them. A `check` command lists who a build would move, without the art; `build --no-art` rewrites only the residents file.

**Options considered:** for streets, leave rings out (chosen) or keep them and fix the two people by hand in the sheet; for yards, keep the shared sequence (every change ripples on) or one seed per resident (chosen; everyone's yard spots move once now, then stay put).

**Why:** engineering's call (code health, not a product decision): without it, a full rebuild (needed for the Foley Stadium Tiled import) would give Amy Polar the street "Newton Square" and Tomas Thanks "Elm Park Rotary", which hints say out loud, and move 63 people's yard spots.

**Engineering's calls (proposals):** both residents files rebuilt with the fix in the same PR. Amy Polar's curb moves a few pixels along June Street, and Tomas Thanks's door moves 20 px along his house front: both come from the map changes for the rings, not from the rings themselves. Yard spots are only where people wander outside, so moving them once is safe.

## 059 — A portal opens in the roundabout on the way between the maps (2026-11-09)

**Decision (Jira SCREAM-229, under SCREAM-10, PO, November 9):** driving round a roundabout (050) opens a portal in its middle. Nothing on the first lap; on the second a faint portal appears in the middle and grows; on the third it grows over the ring road; when the last lap is done it swallows the whole screen, and on the other map it starts over the screen and closes back into that map's roundabout. It has a sound (PO: "I'd love to add a noise"). The look follows the PO's two references (a photo of a portal picture and his own sketch, both in Personal Notes): a dark middle, blue turning violet towards a soft edge, and lines swirling inward. Leaving the roundabout partway: the portal fades and there's no trip. Arriving: the player can drive off straight away while it closes (no skip needed). Story only, like the laps. Drawn in code, and each part (the swallow, the close) takes about a second: both engineering's proposals, agreed by the PO. It replaces SCREAM-145's half-second fade to black.

**Options considered:** for leaving partway, fade away (chosen) or stay; for arriving, a skip or speed-up, or drive off at once (chosen); Story only (chosen) or Quick play too; drawn in code (chosen) or new art.

**Why (product owner's rationale, November 9):** _to ask the PO (why a portal, and why a sound)._

**Engineering's calls (proposals):** the sound is made in code with the browser's sound (like the music): a rushing wind that wobbles as the portal swirls, with a low hum, rising to a whoosh as it swallows the screen and falling away as it closes; M mutes it with the music, and it goes quiet while paused. Its loudest is 0.1 (the music plays at 0.07). Sizes: the size of the grass island (80 px) by the end of lap 2, over the ring road (175 px, under the truck) by the end of lap 3. It's faint on lap 2 (up to 60% strength) and full on lap 3. The swallow ends on the portal's dark middle, which also covers the moment the other map loads. The animation moves on with the game's frames rather than a timer, so a slow frame (the other map loading) slows it down rather than skipping it. The numbers are in `tuning.ts` (`PORTAL_*`).

## 058 — Both maps' residents in one Residents sheet, in a new Customers folder (2026-11-09)

**Decision (PO, November 9):** sheets 15 (Foley Stadium's residents) and 23 (Elm Park's) are one Google Sheet, **Residents**, with a tab per map (Elm Park, Foley Stadium) plus Hint lines, Rotary hint and Old likelihoods. It lives in a new **Customers** folder in IceMachine, next to Product Management Decisions. It keeps sheet 15's link. Product Management Decisions is renumbered to close the gaps: 16 → 15, 17 → 16, 18 → 17, 19 → 18, 20 → 19, 21 → 20, 22 → 21, 24 → 22 (the PO renames it: the Drive connector can't find it), 25 → 23; the next number is 24. Both maps' tabs now have an Order size column (Elm Park's had lost it; Big Kev is 7 again).

**Options considered:** keep sheet 15's file and copy Elm Park's tabs into it (chosen) or start a new file; leave the gaps in the numbering or renumber (chosen).

**Why (product owner's rationale, November 9):** "The decision log is getting large so I wanted to separate that out for easier finding."

**Engineering's calls (proposals):** the old Elm Park file is locked, renamed "OLD - Tutorial Residents (now the Elm Park tab of Residents)" and kept in Customers until the PO deletes it. Old doc numbers in tickets, devlogs and code comments are not rewritten; the brief lists the mapping. One combined "How to use" tab.

## 057 — Customers have a weekly schedule (2026-11-09)

**Decision (Jira SCREAM-221 and SCREAM-223, under SCREAM-11, PO, November 9):** each customer has seven checkboxes, Mon to Sun: checked means home that day. In Story the checkboxes replace Likelihood's buyer kind (033): someone ticked for Monday comes out every Monday. Story's evenings get weekday names the player can see, starting on Monday. Quick play is separate: the day of the week doesn't affect it, and it keeps using Likelihood. Starting ticks (SCREAM-223): regulars every day; customers who bought one day in 3 now 2 or 3 weekdays; never-buyers no days. Customers who aren't home may later be found at a park (SCREAM-224, Low).

**Options considered:** one "days available" text column, or seven checkboxes (chosen); replace Likelihood (chosen) or apply both; Quick play on a fixed day, a random day, or unaffected (chosen).

**Why (product owner's rationale, November 9):** "I want to create a schedule and pattern that people can figure out over time." And for the starting ticks: "The goal is to have neighborhoods that are different throughout the week."

**Engineering's calls (proposals):** the occasional customers' days were picked at random but kept even, so each weekday has about the same number, with a different mix; they are ticked on weekdays only, since Story is Monday to Friday. A customer ticked on all seven days counts as a regular (reliable at the window, 034). Hints (048) point only at customers home that day. The weekday shows on the hub and by the day number in the HUD. **Built (SCREAM-221, November 10), changed by the PO the same night (SCREAM-232):** only the weekday shows, no day numbers ("Let's just call it Tuesday. Let's leave it at the day of the week."): the HUD (over the hub and the road) "Monday"; the end-of-day screen "END OF MONDAY" and "Enter: Start Tuesday"; the title "Continue Story: Tuesday, $0.50"; the Story intro "Enter: Start Monday". The ticks are no longer on/off (PO: "on the days ticked the person is a bit more likely to be a customer. On days not ticked they become much more likely to not be a customer"): in Story anyone but 0% may come out any evening, and their Likelihood is multiplied by `SCHEDULE_TICKED_FACTOR` (1.25, capped at 100%) on a ticked day and `SCHEDULE_UNTICKED_FACTOR` (0.2) on an unticked one (engineering's starting numbers, in `tuning.ts`). Ticked all 7 days is still a regular; 0% is still never. The build warns about anyone ticked with 0%. A map without day columns falls back to Likelihood. The buyer kind used for the rotary hint's "second visit by a regular" (050) follows the ticks in Story too.

## 056 — One skip key in the uncle's evening: X (2026-11-09)

**Decision (Jira SCREAM-217, under SCREAM-5, PO, November 9; changed from S to X the same day while testing, SCREAM-226):** X skips at every point of the uncle's evening (Story Day 1), and every prompt names it. The opening credits used to skip with Enter or Space ("Enter: Skip"); now they say "X: Skip". The truck screen and the small box on the road said "S: Skip The Uncle"; now "X: Skip The Uncle". S no longer skips anything.

**Options considered:** S everywhere (engineering's proposal, first built); Enter everywhere; X everywhere (chosen by the PO while testing).

**Why (product owner's rationale, November 9):** *placeholder, to ask the PO: why one key, and why X rather than S.*

**Engineering's calls (proposals):** on the credits, X skips the credits only (then the uncle, who can be skipped with X again); a click still skips them; Enter and Space no longer do, so the Enter that starts Day 1 on the Story intro can't skip the credits by accident. A held X (the keyboard repeating it) counts once, so holding X on the credits doesn't skip the uncle too.

## 055 — The gas gauge sits at the top right, left of the money (2026-11-09)

*Replaced by 069 (the gauge is bigger, at the bottom left).*

**Decision (Jira SCREAM-219, under SCREAM-7, PO, November 9):** the gas gauge moves from the middle of the top bar to the top right, just left of the money ("Cash $..."), while driving and at the pump.

**Options considered:** left of the money (chosen); right of the money (the gauge in the far corner).

**Why (product owner's rationale, November 9):** *placeholder, to ask the PO.*

**Engineering's calls (proposals):** the gauge follows the money's left edge, so it moves over as the amount gets wider; SOLD OUT and the customer's 5-second "!" now sit left of the gauge (left of the money when the gauge is hidden). The uncle's outline round the gauge ("Keep an eye on the gauge up top") follows it.

## 054 — Out of gas: a tow message before the end-of-evening screen (2026-11-09)

**Decision (Jira SCREAM-208, under SCREAM-7, PO, November 8):** when the tank runs dry on the road the truck stops, the gas gauge flashes and "Needed a tow home." shows; then the end-of-evening screen opens as before. Running out of gas still ends the evening (016, 025, SCREAM-119). The $30 tow charge is SCREAM-209.

**Options considered:** straight to the end-of-evening screen (as before); a pause with the message first (chosen).

**Why (product owner's rationale, November 8):** *placeholder, to ask the PO* (the ticket says it was easy to miss why the evening ended).

**Engineering's calls (proposals):** the message shows for 2.5 seconds (`TOW_MESSAGE_SECONDS`), in the middle of the screen; the gauge's red edge flashes faster and bolder meanwhile. The clock jumps to 8:00 PM as the evening ends, as it did before (now visible during the message).

## 053 — Sold out at the window: the player says "Sorry, I'm sold out." (2026-11-09)

**Decision (Jira SCREAM-218, under SCREAM-154, PO, November 9):** a customer who reaches the window after the truck has sold out no longer says "Too expensive!". Instead the player speaks: the speech bubble reads "Sorry, I'm sold out." and looks like it comes from the player. Sold out is checked before any price, and isn't an overcharge (no second chance used, 026).

**Options considered:** the customer says "Aw, you're sold out!" (the ticket's example); the customer says "Sold out? Next time!" (engineering's alternative); the player says "Sorry, I'm sold out." (chosen, the PO's own wording).

**Why (product owner's rationale, November 9):** *placeholder, to ask the PO.*

**Engineering's calls (proposals):** "from the player" is drawn as the same bubble named "You" in the truck's blue (instead of the customer's name in pink), with its tail pointing down toward the player inside the truck instead of across to the customer. The customer then goes home as after any sale that didn't happen. SCREAM-155 (customers still coming after a sell-out) is unchanged.

## 052 — The HUD's debug hint shows only with ?debug (2026-11-09)

**Decision (Jira SCREAM-220, under SCREAM-202, PO, November 9):** players no longer see the purple "DEBUG Shift+3: End Evening" at the top of the HUD. It shows only when the address ends in `?debug` (e.g. https://concrow7-dot.github.io/icemachine/?debug).

**Options considered:** show it only with `?debug` (chosen; engineering's proposal); remove it completely.

**Why (product owner's rationale, November 9):** players shouldn't see it (from the ticket); *why keep it behind ?debug: placeholder, to ask the PO.*

**Engineering's calls (proposals):** the Shift debug keys (Shift+1 to Shift+6) still work without `?debug`; gating them too is a separate job (Current state's loose ends).

## 051 — Two new design pillars: deep economics (RollerCoaster Tycoon) and learn the loop (Westworld) (2026-11-09)

**Decision (PO, November 9):** the game gets two more design pillars, each with the work it takes after, the way the first four name theirs (Crash Team Racing, Overcooked, Backyard Baseball). They are written into the pitch (doc 04) and the project brief.

- **Deep economics.** Money decisions have real depth: what to stock, what to charge, where to drive, what to spend on. Like RollerCoaster Tycoon and Motherload.
- **Learn the loop.** Each evening the neighbourhood resets: the same people, the same routines, the same secrets. The map is a puzzle you solve over many evenings, and customers' hints point the way. Like Westworld.

A third inspiration, **Motherload** (XGen Studios' 2004 Flash mining game), goes with **deep economics** (PO, November 9). In this game, deep economics means (PO, November 9): customers' price points, how long a customer waits before they won't buy any more, power-ups, and marketing (business cards, a newspaper ad, a billboard); all under the power-ups epic SCREAM-78 (SCREAM-222 price points and waiting, SCREAM-83 marketing).

The pillars are now: race the sunset; chaos on the road; sharp at the window; comfortable inside; deep economics; learn the loop.

**Options considered:** keep the four pillars from the pitch; add the two (chosen).

**Why (product owner's rationale, November 9):** RollerCoaster Tycoon for its deep economics mechanics; Westworld for its puzzle: a map that resets, with hints. Motherload: it's a solid 2D game with an upgrade system and an economy this game can take inspiration from. It took him a few attempts to complete (PO, November 9). (Engineering's note: the same idea as 050's reason, that a player may not win Story the first time; see SCREAM-216.)

**Engineering's calls (proposals):** the pillar names and one-line descriptions are engineering's wording for the PO to change. Westworld here means the HBO series (it grew out of Michael Crichton's 1973 film; there is no original novel). Work already on main that serves "learn the loop": regulars with fixed routines (033, 034), customers' hints (048), the roundabout secret (050); and SCREAM-216 (Story runs as years). Work that serves "deep economics": calculator prices (007), stocking the cooler (028), fuel (016), crash costs, and how players get power-ups (SCREAM-79).

## 050 — The maps join: 3 laps of a roundabout take the truck to the other neighbourhood (2026-11-09)

**Decision (Jira SCREAM-145, under SCREAM-10, PO, November 8-9):** the two maps get names: **Elm Park** (the tutorial map, where home is) and **Foley Stadium** (the Worcester map). In Story, every day starts at home in Elm Park. At the west end of Highland Street there's a roundabout; drive round it three times and the truck comes out on Newton Square in Foley Stadium, at the top of that map, which is a roundabout too; three laps of Newton Square bring the truck home. The clock, cash, cooler and gas carry on as they are. The way the player finds out: a regular tells them, on the regular's second visit of the run: the second regular in the Story run to be served a second time says it after their thanks. Visits add up across the whole run (not per evening) and the run's save keeps them; the uncle's guided sale on Day 1 doesn't count, every other sale that night does. A "teleport home" power-up is a separate ticket (SCREAM-215). Quick play is unchanged: one evening in Foley Stadium.

**Options considered:** a plain road between the maps; a typed password; one lap instead of three; one lap to come home; no way back the same evening; the hint per evening instead of per run; placing the roundabout at an existing junction (engineering's first idea).

**Why (product owner's rationale, November 9):** the player may not win the first time they play Story; the next time they know more about the city, like who buys and the trick at the roundabout. (Each Story run as the next year, with a count of how many years it took to win, is SCREAM-216.)

**Engineering's calls (proposals):** the laps work even if nobody has told the player (a secret to stumble on); the hint is how most will find it. Nothing shows on screen while the truck goes round (PO, November 9: a lap count would give the secret away); driving off or turning round starts the count again. The roundabouts only lead anywhere in Story, and not during the uncle's evening (his route and lines assume Elm Park). Away from home there's no driveway on Foley Stadium: when sold out, the HOME arrow points at Newton Square. Each map's people keep their own state while the truck is away. The hint is said in the same speech bubble as the big-regular hints (048), tip or no tip, and doesn't count toward their limit; its text is engineering's draft for the PO to rewrite. Newton Square was moved a little north-east of the old junction, into the woods, so no house was lost; `build_map.py` draws it after placing everything else, so the rest of Foley Stadium is unchanged. Elm Park's roundabout is a `ring` road in `tools/tutorial/roads.json`; 101 small pieces (shrubs, mushrooms, a fence, the cones and barriers at the old dead end) were taken off the PO's Tiled map where the new road goes. The top bar names the neighbourhood after the day in Story.

## 049 — The Worcester map can be laid out by hand in Tiled (2026-11-08)

**Decision (Jira SCREAM-211, under SCREAM-10, PO, November 8):** the PO wants to edit the Worcester map (Quick play) himself in Tiled, the way he edits the tutorial map (038). Engineering exported the generated map to a Tiled project (`tiled/worcester-map/` in the private art repo) and the converter now reads either map. Until the PO imports his edits, the game's Worcester map stays the generated one.

**Options considered:** keep generating Worcester with `build_map.py` and describe changes in words; edit it in Tiled like the tutorial map (chosen).

**Why (product owner's rationale, November 8):** the same reasons as the tutorial map (038): it seemed like a fun thing to learn; laying it out himself lets him dial in the exact design he wants; and it should save tokens compared with describing every change for engineering to build.

**Engineering's calls (proposals):** `tools/tiled/export_tiled.py` writes the Tiled project with the tutorial map's layer names; every house is "House N" with the residents sheet's (15) House number, so residents stay with their houses when houses move. The Tiled file's "map" property (worcester or tutorial) tells `import_tiled.py` which map it is. Roads, curb spots, potholes, parked cars, gas stations and the truck's start stay generated and locked, as on the tutorial map. Parks and fields are a locked picture in Tiled for reference only; the game still draws them itself. Checked: importing the unedited export gives the same 2,078 pieces in the same places and house order, and the drive, obstacles, customers, residents, home and fuel suites pass on it; importing the tutorial map gives byte-identical files. Once the PO's first Worcester import is merged, Worcester is edited only in Tiled (`build_map.py` would undo his changes), as for the tutorial map (engineering's proposal; PO agreed, November 8).

## 048 — Customers sometimes hint at a big regular after a tipped sale (2026-11-08)

**Decision (Jira SCREAM-103, PO, November 8):** the first part of customer dialog is hints. A customer says something only after a sale where the player earned a tip: the sale ends, they say thanks, then pass on a hint about one of the neighbourhood's big regulars ("Here's a hint: Big Kev on Institute Road buys a ton of ice cream."). Hints are rare: about 1, maybe 2 a night, when the player is getting a good number of customers. The regulars hinted at are ones who buy a lot and often, 3 to 4 of them on the tutorial map. A hint is just words: no map marker, and the regular is no more likely to come out; the player has to remember and go find them. Parties (the rest of SCREAM-103) are a later step.

**Update (PO, November 8, later):** many different hint lines, in four tones: average, funny, dark and absurd (the PO wrote the first three average ones). A regular is never hinted at in two different ways in the same story: not "they have a big family" one day and "the family just moved away" another. So the lines live in their own tab of sheet 23 ("Hint lines": ID, Tone, Who, Line with [Name] and [Street]), and the Residents tab's "Hinted" column (Yes) marks the regulars. At the start of a Story run each Hinted regular gets one line, kept for the whole run.

**Options considered:** a "Talk" button at the window that costs time; a line during every sale; the hint marking the map, or making the regular more likely to come out; the PO writing every line, or lines generated from each resident's traits; doing parties in the same change.

**Why (product owner's rationale, November 8):** hints come after a tip because after a job well done, the customer is willing to send you along to a friend. One reason per regular for the whole run because he doesn't want conflicting reasons, or for it to feel like a bunch of random hints are thrown at you: he's keeping the feel that this is a real neighbourhood. No hints in Quick Play: there isn't enough time to develop the story in one evening; but people who play Story have an advantage in Quick Play, knowing the people most likely to buy. (Related: 047, the names were settled first so hints could name people; 042, finding people with better orders should feel like a puzzle.)

**Engineering's calls (proposals):** the numbers (in `tuning.ts`): no hint before the 3rd paid sale of the evening, at least 4 paid sales between hints, at most 2 a night, and a 35% chance on each tipped sale once those allow one. Never about the customer at the window, someone already hinted at tonight, someone already served tonight, or someone who doesn't buy tonight. No hints during the uncle's evening (his lines only). The four regulars picked: Big Kev, Julia Crowley, Shamooz and Erin Broccolich (the highest Likelihood; Big Kev's order of 7). Lines are picked at random from the run's seed (the same every day of a run), no two regulars share a line in a run, and a "Who" column keeps adult-only lines (divorce, landlord) off kids and kid lines (allowance, recess) off adults. Engineering wrote 40 more lines (11 average, 11 funny, 11 dark, 10 absurd counting the PO's three) as drafts; "dark" stays on the light side of dark (sad or bleak, nothing harmful), since the game is public. Lines are capped at 90 characters and spoken right after "Thanks!". A long hint makes the speech bubble taller, downwards, at the usual text size (PO, November 8: grow the bubble rather than shrink the text). Quick Play never gives hints, even if sheet 15 ever marks regulars Hinted (PO). Note for later: Story is on the tutorial map and Quick Play on Worcester, so for now what a player learns in Story doesn't carry into Quick Play; it would once the maps are joined (SCREAM-145).

## 047 — Customers get parody names of famous people and characters (2026-11-08)

**Decision (Jira SCREAM-210, under SCREAM-11, PO, November 8):** every customer in sheet 15 (Residents) and sheet 23 (Tutorial Residents) gets a play-on-words name of a celebrity, TV or film character, world leader, athlete or video game character (e.g. "Taylor Shift", "Lebron Jams", "Mary Poppsicles"), except the 25 names the PO had already set himself and Chloe Hogan (the uncle's regular, 041), which stay. 145 new names in sheet 15, 29 in sheet 23. The four real names the PO set (Helen Keller, Barack Obama, Drake Maye, Michael Jordan) stay for now; open question below.

**Options considered:** the real names; parody names (engineering's proposal, since the game is public and the project rule is "never copy licensed characters"). The PO chose parody names.

**Why (product owner's rationale, November 8):** done now because he wants to start adding customer hints about other customers (SCREAM-103), so the names need to be settled first. *Why famous names at all: placeholder, to ask the PO.*

**Engineering's calls (proposals):** each new name keeps the person's age (kid or adult) and roughly matches the old first name's gender, so it fits the existing look; a lot of the puns are dessert or ice cream themed; a few nods to Boston sport (Tom Brrrady, Larry Birdseed, Pedro Martinice, Big Poppsicle). Only the Name column changed; nothing else in either sheet.

**Open:** keep the four real names, or give them parody names too?

## 046 — Story is 5 days, starts with $50, and the bike costs $600 (2026-11-08)

**Decision (Jira SCREAM-85, PO, November 8):** a Story run is 5 evenings, a full week (was 3; the first idea was 7). It starts with the uncle's $50 (was $100), and the bike now costs $600 (was $200). Built together with 045.

**Options considered:** 7 days (SCREAM-85's first idea); keeping $200 with the longer run; starting with $100.

**Why (product owner's rationale, November 8):** the goal over time is to make the game longer, but a longer run is harder to test, so he is increasing the number of days slowly as features get added.

**Engineering's calls (proposals):** sometimes buyers keep buying one day in 3 (decision 033), so over 5 days some buy twice (days 1 and 4, or 2 and 5). Running out of money is still game over. The Story intro's placeholder text (SCREAM-76) reads the new numbers.

## 045 — The tutorial leads into Story: the uncle's evening is Day 1, on the tutorial map (2026-11-08)

**Decision (Jira SCREAM-205, under SCREAM-5, PO, November 8):** Story is played on the tutorial map for now; the Worcester map is left alone, to be connected to the tutorial map in the game later (SCREAM-145), and Quick Play stays on Worcester. The uncle's tutorial evening is Day 1 of the Story, and its cash, stock and gas carry on into Day 2. A brand-new player sees only Story; Quick Play unlocks after the uncle's evening (finished or skipped). Tutorial comes off the title menu: the uncle's evening only happens in Story. After the first run, New Story asks "With Uncle" or "On My Own" (On My Own plays Day 1 without him). This replaces 040's "Tutorial stays its own mode" and changes 043: new players still play the uncle's evening first, now as Story's first day.

**Options considered:** the tutorial as a prologue with Days 1 to 5 after it (6 evenings); the uncle on every new Story, or only on the very first; keeping Tutorial on the menu as a one-evening practice mode; new players picking Tutorial (which would then run on into Story) rather than Story.

**Why (product owner's rationale, November 8):** the tutorial is only helpful once, so he wanted it on the first play and that's it.

**Engineering's calls (proposals):** a new Story shows the Story intro (bike, days left; placeholder text) first, then, with the uncle, the credits and him in the truck. Story saves from before this (3 days on Worcester) aren't offered to continue: the save moved to a new key (`icemachine.story.v2`). Story gets a fresh high score table (`icemachine.highscores.story.v2`), since 5-day runs on the smaller map don't compare with the old ones. Anyone with an old high score or a finished tutorial still has Quick Play unlocked. Quick Play stays first on the menu, so Enter alone still starts it for returning players; for a new player the arrow starts on Story.

## 044 — The uncle can be skipped; the game counts anonymous plays (2026-11-07)

**Decision (Jira SCREAM-200 and SCREAM-201, under SCREAM-5, PO, November 7):** from the uncle's first line on, the player can skip him: "S: Skip The Uncle" shows in his box (and in the hint line while he talks in the truck). Skipping ends his part at once wherever the player is, he says one goodbye line, the $50 is handed over if it hasn't been, and the rest of the tutorial evening plays alone. Skipping counts as having finished the tutorial, so Quick Play and Story unlock. The PO chose a visible skip over a hidden link for hiring managers, or no skip at all. And the game counts anonymous plays: tutorial started, skipped and finished, the first paid sale of a visit, each evening ended, and the seconds from the start of the guided tutorial to taking the wheel. The PO chose a Google Form (answers in a sheet in Product Management Decisions) over an analytics service.

**Why (product owner's rationale, November 8):** the skip is so that experienced players don't need to keep getting instructions. Counting plays is to find out how many people are using the game, and especially how many finish it; it should give some insight into the game, and make for a more impressive story if play-throughs can be shown. Engineering's case, which the PO accepted: since decision 043 the first thing anyone sees at the public link is the credits and the uncle's drive, which playtesters need but a visitor with three minutes may not sit through; and with no counts at all, every product decision rests on the PO's own play and a few playtest forms.

**Engineering's calls (proposals):** the skip key is S (it is also brake/reverse with WASD, but the player never has the wheel while the uncle can still be skipped); the goodbye line is engineering's draft ("Alright, you've got this. Good luck kiddo."); skipping at the pump means the uncle doesn't pay and no gas is pumped for free: the player buys their own if they want it (confirmed by the PO, November 8); the counter is off on localhost and in the tests, sends nothing personal and keeps nothing in the browser between visits, each visit gets a random id so its events can be grouped, the build's commit is sent so counts can be split by version, and the title screen says "Counts anonymous plays" once the form is connected. Until the PO makes the form and its ids go into `src/config/counter.ts`, the counter is off. The uncle's driving moved out of DriveScene into `src/scenes/uncleDrive.ts` while this was built.

## 043 — New players play the Tutorial first (2026-11-06)

**Decision (Jira SCREAM-175, under SCREAM-5, PO, November 5):** the first time someone plays, Tutorial is the only mode they can pick. Once they finish its evening (day 1) with the uncle, Quick Play and Story unlock.

**Why (product owner's rationale, November 6):** he wants a first-time player to be given instructions on how to play. People were unsure of the controls and mechanics, so the tutorial gives them a quick rundown, with enough time to absorb what's going on without dragging on too long.

**Engineering's calls (proposals):** Quick Play and Story stay on the title screen, dimmed and marked "(Locked)", with "Finish the Tutorial to unlock Quick Play and Story." under the menu, so new players can see what's coming; the arrows skip them and a click on one makes the note flash. "Finished" means the evening reached its end (the results screen), saved in the browser. Anyone with a saved Story or any high score already counts as finished, so current players and playtesters aren't locked out.

## 042 — Some customers always order a set number of ice creams (2026-11-06)

**Decision (Jira SCREAM-189, under SCREAM-11, PO, November 6):** a customer can be given a fixed order size. The residents sheets get an optional "Order size" column (sheet 23 first): blank is the usual random size (1 to 6), a number means that person always orders that many, or everything in stock if there are fewer. Big Kev (sheet 23, Institute Rd) always orders 7, and the uncle's last line in the tutorial tells the player to go find him.

**Why (product owner's rationale):** he wants the game to be a little like a puzzle, with people suggesting and hinting at locations with better orders, so finding them is worth the trip. "You finally find a person and they order 1 ice cream, it won't be as exciting."

**Engineering's calls (proposals):** flavours stay random (a "specific flavours" column could follow); the size counts only ice creams in stock and priced $4.00 or under, like every order; the column is read only if a sheet has it, so sheet 15 can get it later.

## 041 — The uncle drives in the tutorial, stopping for Chloe Hogan (2026-11-05)

**Decision (Jira SCREAM-171, under SCREAM-5, PO, November 5):** after Buy Stock, the uncle says "Let's go get some gas", turns and walks to the cab, the screen fades, and the truck drives itself: down Westland St, left along Highland St, left up Park Ave into the pump bay. On the way he stops for his regular, Chloe Hogan (a kid on Westland St). The PO picked her from engineering's options: no existing regular lived on the truck's side of the street along the direct route, so her Likelihood in sheet 23 went from 15% to 80% (an every-day regular). She comes out as soon as the truck is in range and always buys. The tutorial starts with a quarter tank. PO testing (November 6): the drive from home to Chloe takes 4 times as long (about 10 seconds), so his line can be read; at her "!" the truck stops for 4 seconds ("Oh hey, it's Chloe Hogan..."), then creeps up to her square ("Try and figure out where the regulars are...") and pulls up straight; at the window the sale waits (no countdown) until the player has read "Remember the order, add the ice cream from the cooler, and calculate the price." The parked car just past Chloe's square moved to the other side of Westland St (the PO's second option) so the truck can pull up straight; Zoe Ferreira's pink square moved 70 px along to stay clear of it. His walk to the cab now heads left toward the driver's seat.

**Why (product owner's rationale, November 6):** he wanted the uncle to give the player tips along the drive, and felt that if the player were driving they wouldn't be able to read them. Stopping for a regular lets the uncle walk the player through the sales window: the player sees how a customer calls for ice cream, and the uncle hints that some people are more likely to buy and that there are daily customers. The pacing changes were about timing, so the player can read all of it in time.

**Engineering's calls (proposals):** the truck follows a planned path along the streets (rounded corners, keeping right, swinging out round parked cars, moving into Park Ave's curb lane after the turn), at about a third of top speed, slowing for corners and stopping where it should; the player can't steer while the uncle drives. Nobody else comes out until the player has the wheel (after the gas). If the sale ends without being paid, he still drives on to the pump. The route is fixed for the tutorial map (`src/config/tutorialRoute.ts`).

## 040 — The uncle's guided tutorial: how it runs, skipping, and how he looks (2026-11-05)

**Decision (Jira SCREAM-169 and SCREAM-174, under SCREAM-5, PO, November 5):** the uncle's tutorial is six stories (SCREAM-169 to 174). The truck visibly drives itself while the uncle drives (SCREAM-171). After his last step (the pump) the player plays the rest of the evening alone on the tutorial map, and Tutorial stays its own mode on the title screen; the PO wants it to roll into Story mode eventually, but separate for now. The first time, the uncle always comes along; after a player has finished an evening with him, Tutorial asks "With Uncle" or "On My Own". The regular lives on the way to the gas station and comes out as soon as the truck is in range, always buying (SCREAM-172). New players must finish the tutorial before the other modes unlock (SCREAM-175). The uncle is drawn like a customer at the sales window, standing inside the truck (the PO's interior drawing) when he first talks, and his lines use the sales window's quote box. The guided tutorial opens with credits in the style of a famous space film's opening crawl ("In an ice cream truck, not that far away...", then the story scrolling in yellow), then the uncle's three opening lines, ending with the player clicking the cooler (SCREAM-177; the PO's words, in Personal Notes).

**Why (product owner's rationale, November 6):** he wanted to give the player a feel for how the game would look and feel, with the uncle as the introduction to that (hence the truck visibly driving). The tutorial stays separate for now because the plan is to join it to Story soon; he needs a connection between the two first: he wants to work on customers and their ability to have dialog, then have a customer drop a hint on how to move on to the other map. Once players know what they're doing they won't need the uncle's help; the "With Uncle" / "On My Own" choice was left in for ease of testing, and in future the uncle should mostly go away after the first play: players can still find him, but the game won't ask every time.

**Engineering's calls (proposals):** his lines are drafts until the PO rewrites them. After the opening in the truck, a smaller quote box carries his lines on every evening screen: near the top, or bottom right on the cooler (clear of Buy Stock); his lines move on by themselves after 6 seconds or when clicked. Until SCREAM-170 to 173 build each step, the player does them and the tutorial moves on when the evening reports each one done (setting off, a customer at the window, a paid sale, the sale closed, gas bought). "Finished" means the evening ended (the results screen), saved in the browser. Play Again from the results screen plays without him. His look: LimeZu Modern Interiors' character generator, like the residents (brown hair, a mustache, a red shirt), built by `tools/uncle/build_uncle.py`.

## 039 — Park Ave gets two lanes each way; Russell St stops at Park Ave (2026-11-04)

**Decision (Jira SCREAM-159, under SCREAM-10, PO, November 4):** on the tutorial map, Park Avenue (the diagonal from Highland St to Institute Rd) is twice as wide, two lanes each way, widened on its east side only; the shops' side stays where it was. Russell Street's short piece north of Park Ave is removed. Everything east of Park Ave moved east to make room (houses, Russell St, the gas station, trees); the map kept its size, so 37 trees pushed past the right edge were dropped (no houses). The roads stay generated; everything else is edited in Tiled (PO agreed to engineering's proposal, November 4).

**Why (product owner's rationale):** it's true to the real streets, and he wants a difference between main roads and side roads; in future, perhaps cars that travel on the main road (see SCREAM-55 main vs side streets, SCREAM-98 moving cars).

**Engineering's calls (proposals):** streets can now have more than one lane each way (`lanes` in the map data); a wider street gets white dashed lines between its lanes, pink squares in its outside lane and customers at its curb. The tutorial map's roads live in `tools/tutorial/roads.json` and are built by `tools/tiled/build_roads.py`, which also makes the road picture for the PO's Tiled map. Everything east of Park Ave moved 147 px straight east (120 px out from Park Ave), so nothing ends up on the new lanes. Russell St's junction with Park Ave stays where you see it; the wide street's ends stop at Highland St and Institute Rd without bulging past them.

## 038 — The tutorial map is laid out by hand in Tiled (2026-11-04)

**Decision (Jira SCREAM-158, under SCREAM-10, PO, November 4):** the PO laid out the tutorial map himself in Tiled (a free map editor), starting from an export of the generated map, and it replaces the generated tutorial map. He removed the 66 houses nobody lived in (40 houses and home remain, one per resident), removed all the fences, moved and restyled houses (some with pictures from the full LimeZu pack, some with chimneys, solar panels and side wings added), and rearranged trees and ornaments. The streets, curb spots, potholes, parked cars, the truck's start and the gas station are unchanged.

**Why (product owner's rationale):** it seemed like a fun thing to learn; laying it out himself lets him dial in the exact design he wants; and it should save tokens compared with describing every change for engineering to build.

**Options considered:** keep generating the map with `build_map.py` and describe changes in words (the way SCREAM-52 was done); have the game read Tiled maps directly (a much bigger change to the drive scene).

**Engineering's calls (proposals):** a converter, `tools/tiled/import_tiled.py`, reads the Tiled file and writes the same map data and pictures the game already uses, so driving, customers and tests work as before. The Tiled project lives in the private art repo (`tiled/tutorial-map/`), because it uses paid LimeZu art. Hidden houses are left out; the others keep their numbers (the names in Tiled, "House 27"), so sheet 23 keeps its House column and only the streets of moved houses change. Pieces on a "House details" layer that overlap a house are merged into that house's picture. Proposal, to confirm: from now on the tutorial map is edited only in Tiled (`build_map.py`'s tutorial mode would undo the PO's changes).

## 037 — A neighbourhood that looks like one place: lamps, fences, gardens, a court, a playground, Park Ave shops (2026-11-04)

**Decision (Jira SCREAM-52, under SCREAM-10, PO, November 4):** on the tutorial map only, for now: matching street lamps along the streets; white picket fences round about a quarter of the houses; some gardens; a basketball court; a playground; and six businesses on Park Avenue, each with art that matches its name or kind of business: Bagel Time, Dippin Donuts, UPS Store, The Boynton (restaurant), Fancy Florist, Thai Time (restaurant).

**Why (product owner's rationale):** he wanted the neighbourhood to feel more uniform. He plans a few different neighbourhoods, and each should feel like its own separate place.

**Options considered:** both maps (PO: tutorial map only for now); generic shops with made-up names (PO chose his list); fences round every house (PO: about a quarter).

**Engineering's calls (proposals):** one lamp design (LimeZu's classic street lamp), every 300 px along each street, alternating sides, on the grass just past the sidewalk, kept off junctions, home's driveway and the pump bay; fences only round houses whose front door faces the road or that have the road beside them, never across a front, and residents walk round them; the bakery fronts for Bagel Time and Dippin Donuts (bread and donuts in the window), a front with parcel boxes in the window for the UPS Store, one with potted flowers for Fancy Florist (plus vases outside), and diner fronts with striped awnings and patio tables for the two restaurants; each sign's lettering is painted out and the name is written on it in the game, plain text, no logos; the shops stand in a row along the north-west side of Park Ave, facing it. 4 houses made way for the shops, so the residents sheet's house numbers were updated (one resident moved to the nearest empty house). The court and playground went on open lawn near the middle of the map, trees cleared.

## 036 — A smaller tutorial map from real streets, and a guided tutorial (2026-11-04)

**Decision (Jira SCREAM-146, under SCREAM-5, PO, November 4):** a second, smaller map for the tutorial, built from real Worcester streets just north of the main map: Institute Rd (north), Highland St (south, out to Dover St), Haviland St and the woods (west), with Park Ave through the middle and Germain, Westland, Lee and Russell St inside. Dover St is left out. Home is on Westland St; the one gas station is on Park Ave near Market 32. 40 residents, in their own sheet (doc 23, "Tutorial residents"), with the same columns and the same buyer mix as sheet 15. The two maps will be joined at one point later. The tutorial itself is guided: the player's uncle (who dropped a box of ice cream on his foot) helps stock the cooler and set prices, drives to the gas station, pulls over for a regular, walks the player through a sale, and explains filling up (the PO's "Tutorial and Story mode idea session" note). This changes the October 29 call (SCREAM-5) of mostly learning by doing. Story keeps the $200 bike; working for the uncle before summer ends is part of the story.

**Why (product owner's rationale):** he knows this area well, and its streets run mostly left-right and up-down, so driving will be a little easier for a new player. On the guided tutorial: playtest feedback asked for more direction at the start; he wants to introduce mechanics without spelling them out, and that balance is something to keep trying to hold.

**Options considered:** a made-up "starting island" map (the PO's "island" is just the usual game term for a small starting area); about 20 residents (PO chose 40).

**Engineering's calls (proposals):** the first version is a Tutorial option at the bottom of the title menu that plays one Quick-play-style evening on the tutorial map, with its own top-5 scores; the uncle's script, tips (SCREAM-56) and moving on to the main map come in later tickets. The map uses the same build script as Worcester (`build_map.py build <art> tutorial`), so streets keep their real angles; residents' looks start at 201, so nobody looks like someone on the main map. Restart evening and Play again stay on the tutorial map; Quick play and Story always use Worcester.

## 035 — Customers are served only from the sidewalk, and can share a spot (2026-11-03)

**Decision (Jira SCREAM-150 and SCREAM-156, PO, November 3):** customers may walk across streets, but the sales window only opens for a customer standing on the sidewalk. A customer who can't be served where they are keeps looking for a spot where they can be. Customers can stand at the same spot: someone arriving near a customer who's already waiting joins them, with one pink square for the spot, and they're served one after another.

**Why (product owner's rationale):** he's fine with customers walking across streets, but they should only open the sales window while they're on the sidewalk. A customer he saw in the street had been walking to stand where another customer was; when that spot was blocked, they walked to the next open location, so letting customers stand at the same location should fix it. He agreed with merging the pink squares into one.

**Engineering's calls (proposals):** up to 3 customers at one spot (`CUSTOMER_SPOT_MAX`), standing 12 px apart along the curb (`CUSTOMER_SIDE_BY_SIDE`); a waiting spot is at most 240 px from the truck (`CUSTOMER_SPOT_REACH`), so customers don't set off after the truck again and come back to the same spot in a loop; "on the sidewalk" means the spot and 4 px around it are off the road, as the residents build checks; anyone found waiting in the road starts looking again; if nothing near the truck has room, they wait at their own curb spot (always on the sidewalk, with room for a square). After a sale, the next person at the same spot is served without moving the truck.

## 034 — Fewer customers per stop; regulars you get to know (2026-11-03)

**Decision (Jira SCREAM-152, under SCREAM-148, PO, November 3):** the chance someone comes out when they first hear the truck drops from 25% to 10% a second (falling toward 3%, was 5%). After about 30 seconds of hearing it without coming out, nobody new comes out. Regulars come out reliably and quickly, and are outside in their yard more (about 3/4 of the time, like the one-in-3 buyers).

**Why (product owner's rationale):** to encourage more exploration. He wants people who play many times to notice the same people, so meeting someone new is an exciting moment, and to get to know the regulars, so that over several days they learn where those people are.

**Options considered:** only lowering the first-second chance (engineering pointed out that alone rewards parking: everyone still comes out eventually); letting the chance keep getting lower instead of stopping at 30 seconds (PO chose stopping). Also approved, for later: a "New customer!" moment and a count of people met across games (added to SCREAM-102), and regulars' routines (SCREAM-84).

**Engineering's calls (proposals):** once someone has heard the truck for 30 seconds without coming out, they've decided for the rest of the evening, even if the truck leaves and comes back (`CUSTOMER_DECIDE_SECONDS`), so a parked spot dries up; regulars' chance is a steady 35% a second times their likelihood (`CUSTOMER_REGULAR_CHANCE`; a 75% regular outside comes out within 5 seconds about 3 times in 4), still halved indoors; never buyers keep the old in-and-out routine.

## 033 — Fewer customers: regulars, sometimes buyers and never buyers (2026-11-03)

**Decision (Jira SCREAM-148, PO, November 3):** residents come in three kinds. 25% are every-day regulars, more likely to buy than before; 50% buy on only 1 day in 3; 25% never buy. The 1-in-3 people are outside more, about 3/4 of the time. In Story, each 1-in-3 person buys on exactly one of the three days; in Quick play they have a 1-in-3 chance that evening. The kind comes from the Likelihood (%) in the residents sheet (sheet 15), not a new column: 0% never buys, under 50% buys 1 day in 3, 50% and up every day.

**Why (product owner's rationale):** there were a lot of customers coming to the truck, so he never had to explore anywhere. Customers following the truck (decision 032) meant even more could reach it; before, he might have had to drive around the neighbourhood to someone on a different street.

**Options considered:** a new "buyer type" column in sheet 15 (PO: no, just lower the percentages); rolling each person's kind at random every game (not chosen); a 1-in-3 chance every Story day, so someone might buy 0 to 3 times (PO chose exactly one day).

**Engineering's calls (proposals):** the 50% line between the two buying groups (`BUYER_REGULAR_FROM`); sheet 15's new numbers, picked at random with last week's keenest 40 people (shuffled a little) as regulars at 60 to 90% and the least keen 40 at 0%, the rest at 15 to 35% (kids stay keener: 27 of 47 kids are regulars); the old numbers are kept in sheet 15's "Old likelihoods (before SCREAM-148)" tab. 1-in-3 people start outside 75% of the time (was 50%), stay out 40 to 100 seconds (was 25 to 70) and stay in 10 to 30 (was 20 to 60). Which day a Story 1-in-3 person buys comes from a number saved with the run, so it doesn't change if you quit and continue (older saves get a new one). Someone who isn't buying tonight never gets the "!", even with the truck parked by their house.

## 032 — Customers walk toward the truck (2026-11-02)

**Decision (Jira SCREAM-140 and SCREAM-142, PO, November 2):** customers start walking toward the truck as soon as they want ice cream (when the "!" shows), not only while you serve. They head straight for the truck (not to the street first) and keep following it, with no limit on how far. They stop a short way off, where their pink square appears. Everyone walks at about half the old speed (customers 37 px/s, was 75; residents 11, was 22). Per-person speeds come later (SCREAM-141).

**Why (product owner's rationale):** that's how it worked when he drove the ice cream truck: people tended to try to help and come over to the truck, so it was quicker for them too.

**Engineering's calls (proposals):** within 150 px of the truck (`CUSTOMER_STOP_GAP`) they step to the curb beside them and wait; the pink square only goes where there's room (on the asphalt, not in a junction, clear of parked cars, the pump bays, home's driveway, and 100 px from other squares, `CUSTOMER_QUEUE_GAP`), so customers queue up; if the truck gets more than 260 px away (`CUSTOMER_FOLLOW_AGAIN`) they set off after it again, and their 30 seconds of patience only count down while they stand still; they walk straight across yards and streets; after the sale, or if they give up, they walk straight home.

## 031 — Orders in words or in pictures (2026-11-02)

**Decision (Jira SCREAM-137, PO, November 2):** some customers say the ice creams' names, others show their pictures ("2 ×" and the ice cream). Which one is random for each customer (`ORDER_PICTURE_CHANCE`, 50% for now). Asking again (R) and "That's not what I asked for. I wanted..." after a mistake use the same way as that customer's order.

**Why (product owner's rationale):** to add some variety to the sales window.

**Engineering's calls (proposals):** the chance is a tuning value, so it can change later (for example by day, or by customer); "That's not what I asked for. I wanted:" stays in words above the pictures.

## 030 — A shut cooler, one crate open at a time; stock placed square by square (2026-11-02)

**Decision (Jira SCREAM-131 and SCREAM-132, PO, November 2):**
- Filling an order happens at the cooler itself (the prep screen's freezer, without the clipboard and menu). The cooler is shut; each of its 3 crates has its own lid, and opening one shuts the others. A shut lid hides everything. A lid takes about half a second to open while the tip keeps ticking; no other cost.
- Ice creams taken go into a paper bag on the counter; clicking one in the bag puts it back in its square. Keys: 1, 2, 3 open a crate, arrows move, + takes, - puts back, Enter serves, B goes back to the window.
- The cooler remembers where every ice cream sits all evening and between Story days. A sold one leaves a gap; restocking fills gaps in the crate you choose.
- In prep, the player chooses the crate new picks go into (click it, or 1, 2, 3). Any ice cream can be dragged to another square; clicking one not paid for yet takes it out (leaving a gap). Paid stock can be moved but not taken out (no refunds).

**Why (product owner's rationale):** to make the cooler a memory challenge, so players place their stock strategically.

**Engineering's calls (proposals, not the PO's reasons):** when the chosen crate is full, picks spill into the next crate with room, which becomes the chosen one (so stocking up never stalls); the cooler stores a map of its 48 squares next to the stock counts and keeps them in step, so selling and old saves still work (old Story saves get a fresh layout); the tip cup stands on a shelf on the left while filling; the bag shows the ice creams in the order taken.

## 029 — Drive home to restock: Home's driveway (2026-11-02)

**Decision (Jira SCREAM-54, PO, November 2):**
- Home has a driveway spot, marked on the road outside home where each evening starts. Pulling in works like a customer pickup: stop with half the truck in the spot.
- It opens the same cooler screen as the start of the evening, to buy more stock and change prices on Today's Menu.
- The clock keeps running while you restock, so a trip home costs daylight, like the pump. Decision 005 (the clock waits) now applies only to stocking before you first set off.
- Home is for restocking only; gas stays at the gas stations.
- When the cooler is sold out, an arrow points home (from Tom Cobb's round 2 playtest); it's gone once there's stock again. It's a different arrow from the customer arrow removed in SCREAM-68.

**Why (product owner's rationale):** it's a game mechanic: managing inventory was always part of the PO's experience owning the truck, and it gives the game another layer.

**Engineering's calls (proposals, not the PO's reasons):** the spot is a blue box on the road (the truck starts in it, so it only opens once the truck has left and come back, like the pump bay); the arrow sits at the edge of the view pointing home, or bobs above the spot when it's on screen; leaving the cooler from home (buying or B) goes straight back to the road, and B may leave without buying.

## 028 — Stocking one ice cream at a time: clipboard, crates and Today's Menu (2026-11-02)

**Decision (Jira SCREAM-129, the PO's sketch, November 2):** the cooler prep screen is redesigned in three parts.
- An "Available Ice Cream" clipboard lists every flavour with its picture and what it costs. Picking one drops a single ice cream into the next empty square of the cooler. The order's total and BUY STOCK sit at the bottom of the clipboard; nothing is charged until BUY STOCK.
- The cooler is 3 crates of 4 x 4 squares: 48 ice creams, any mix of flavours (was 3 slots of up to 15, one flavour each). The PO kept the total close to the old 45.
- Ice creams not paid for yet are marked (a dashed yellow outline); clicking one takes it back out. Paid stock can't be taken out.
- Today's Menu, on the truck's outside wall, shows a card for every flavour in the cooler, like a real truck's menu board: bright colours, a picture of the ice cream, the price written big in marker. Prices are set there in prep, and can be changed again on a trip home (SCREAM-54).
- "Chocolate Chip" on the sketch is the existing Cookie Ice Cream Sandwich; no new flavour.

**Why (product owner's rationale):** the old cooler felt clunky, and the PO is moving the game toward a memory-based sales process, which this helps.

**Engineering's calls (proposals, not the PO's reasons):** one stock line per flavour behind the scenes, so selling and saving work as before (old Story saves are merged flavour by flavour); squares fill paid stock first (by flavour), then this visit's picks in picking order; the keyboard: Up and Down move along the clipboard (or the menu), Left and Right switch between them, + and - pick and put back (or change a price); the ice cream pictures are placeholders until SCREAM-113 (and SCREAM-130 for the Lil Explorer Pop); the marker font is Permanent Marker (free, Apache 2.0 licence, bundled with the game); the order-filling screen at the window shows four columns, one per flavour, until SCREAM-125 redesigns it.

**Revisit if:** 48 is too many or too few once customers' numbers are tuned (SCREAM-25 could add a crate).

## 027 — The truck interior is the PO's drawing, with clickable parts (2026-11-02)

**Decision (Jira SCREAM-57, PO, November 2):** the hub (the inside of the truck) is the PO's coloured drawing, made from his pen sketch and engineering's line art, instead of placeholder boxes. Clicking the freezer opens the cooler; clicking the front of the truck starts driving; clicking the menu board on the wall behind the freezer opens the menu. No art pack was bought: doc 18 found no front-on truck interior to match.

**Why (product owner's rationale):** it was the cheapest option, and the drawing got to a point where it looks good enough for now.

**Confirmed by the PO (November 2):** "the menu" is the pause menu (Resume, Restart Evening, Quit To Title).

**Also (SCREAM-123, PO, November 2):** the same picture sits behind the pause menu and the end-of-evening screens, under a coloured layer so the text reads clearly.

**Engineering's calls (proposals, not the PO's reasons):** the serving window stays clickable during a sale, as before; the arrow keys move left to right across the picture (menu board, freezer, front, window); the highlighted part gets a yellow outline and a name tag (MENU, COOLER, DRIVE, WINDOW).

**Revisit if:** the game needs more polish (doc 18: a commission from the same line art, about $50-$300).

## 026 — Overcharging gets a second chance, without a tip (2026-11-02)

**Decision (Jira SCREAM-120, PO, November 2):** the first time the player charges more than the order costs, the customer says "That's more than it's supposed to be. Try again?" and the player can type the price again, but loses the tip. Overcharging a second time ends the sale as before: the customer leaves with the ice cream for free.

**Why (product owner's rationale):** The other mistakes (handing over the wrong items) already get a second chance. Getting the price wrong once and losing the sale is harsh, so a second chance seems fair (PO, November 2).

**Engineering's calls (proposals, not the PO's reasons):** this chance is separate from the one for handing over the wrong items (both can happen in one sale); the customer's wording.

## 025 — Out of gas ends the evening; gas runs out 30% faster (2026-11-02)

**Decision (Jira SCREAM-119, PO, November 2):**
- When the tank runs empty, the evening ends: Quick play goes to the results screen (headed OUT OF GAS), Story to the end-of-day screen ("You ran out of gas!"). This replaces decision 016's quarter-speed crawl to the pumps.
- In Story, the next day starts with 1/6 of a tank (raised from 1/8 on November 2: the PO ran out on the way to the station while testing), enough to reach a gas station.
- Gas runs out 30% faster: a full tank drives about 41,700 px (was 54,200).

**Why (product owner's rationale):** From the PO's own time driving an ice cream truck: if you run out of gas, it takes so long to get more that the evening is already over (PO, November 2). Future idea from the PO: a power-up, a spare can of gas in the truck that gives just enough to reach a gas station if you run out.

**Engineering's calls (proposals, not the PO's reasons):** a Story day never starts with less than 1/6 of a tank, however the last one ended (`FUEL_STORY_MIN_START`); the evening ends at the moment the tank runs dry, not when an already-empty tank is driven.

**Revisit if:** running out feels too harsh (a tow for a fee, or the old crawl) or 1/6 of a tank isn't enough to reach a station from where the truck starts.

## 024 — Music at the counter; customers come out while you serve, and wait twice as long (2026-11-02)

**Decision (Jira SCREAM-118, from Tom Cobb's round 2 playtest):**
- The truck's music keeps playing off the road once the truck has been out (the window, filling the order, the hub, the pump); M and N work there too. It stops while paused.
- While you serve someone (from the window opening until the sale ends), people in the music ring can still hear it and come out wanting ice cream. This changes decision 019, where nobody new came out off the road. At the hub and the pump, still nobody new comes out.
- While you serve someone, customers waiting at the curb are willing to wait twice as long: their 30 seconds run at half speed (`SERVING_PATIENCE` in tuning.ts).

**Options considered:** music only for mood (nobody new comes out while serving, engineering's first proposal) or the ring stays live while serving.

**Why (product owner's rationale):** to keep the game true to the PO's own ice cream truck experience: customers were actually more likely to come when the truck was stopped.

**Engineering's calls (proposals, not the PO's reasons):** "serving" covers the window and filling the order at the cooler; the countdown runs at half speed rather than giving new arrivals 60 seconds; the music also plays at the pump.

**Revisit if:** serving feels too hectic (too many arrivals) or too easy (nobody gives up), or if "more customers when stopped" should also apply when parked on the road.

## 023 — On-screen text style (2026-11-02)

**Decision (Jira SCREAM-96, PO's picks in sheet 16):**
- Headings and buttons stay in ALL CAPS (THE COOLER, BUY STOCK, CHARGE).
- Menu choices: a capital on each word (Quick Play, New Story, Restart Evening, Quit To Title).
- Key hints at the bottom: key name, colon, then a capital on each word (Enter: Start Day 2, B: Drive Off).
- Short status lines: a capital first letter, no full stop (No tip, Costs you $1.00 each).
- Full sentences and customer speech: a capital first letter and a full stop, question mark or exclamation mark.
- A proper dash in headings: THE COOLER – PREP.

**Engineering's calls (proposals, not the PO's reasons):** "each word" was applied literally, small words included (Quit To Title, Back To The Title); they can go lowercase if the PO prefers. The flavour names (SpongePop, Lil Explorer Pop) and the Story placeholder text (SCREAM-76) are unchanged.

**Why (product owner's rationale):** He liked how they looked after some trial and error (PO, November 2).

## 022 — Loading screens: the truck laps the screen and fills it with music notes; the $4 warning goes (2026-11-02)

**Decision (Jira SCREAM-75, SCREAM-72):**
- Any loading screen shows the title's ice cream truck driving back and forth like the winning screen, a row lower each lap, leaving music notes that stay, so the page slowly fills. Engineering's proposals: it only appears if loading takes more than 0.15 s (no flash on quick loads), and Shift+5 shows it for 5 seconds (debug).
- The cooler no longer says "over $4.00: customers refuse!". Customers still refuse prices over $4; the "profit $x each" hint stays.

**Options considered:** for loading, a spinning ice cream cone (the ticket's description) or the truck covering the page (its newer title); the PO picked the truck (November 2).

**Why (product owner's rationale):** the $4 warning: players should organically figure out the price ceiling (doc 08, Q11). The loading screen: the game had no spinners yet, and he likes the truck as a transition design better.

## 021 — Largest sale: tonight's and an all-time record, tip included, in both modes (2026-11-02)

**Decision (Jira SCREAM-93):** the most paid for one order at the window, price plus tip. Quick play's results screen and Story's end-of-day screen show tonight's largest sale and the record ("NEW RECORD!" when it's beaten); Story's final results show the run's largest. Quick play and Story keep separate records, like their high scores, saved in the browser.

**Options considered:** tonight only, a record only, or both; tip in or out; one mode or both.

**Why (product owner's rationale):** It gives the player a reason to seek out bigger customers (PO, November 2). (He picked engineering's recommended option.)

## 020 — The title screen's LimeZu truck drives the map, full size, in any direction (2026-11-02)

**Decision (Jira SCREAM-115):**
- The driving truck is LimeZu's ice cream truck from the title screen, at the pack's own size (the same scale as the houses and trees), replacing the drawn rectangles.
- LimeZu only draws it from the side. Front and back views are the pack's ambulance (the same van body) repainted in the truck's colours, with the cone on the roof (`tools/truck/build_truck.py`).
- Any direction: the side view shows within 25° of straight left or right; otherwise the front or back view, tilted to the truck's exact heading. (Engineering's proposal, after the PO asked for any direction: a side view tilted further looked like it was tipping over.)
- The bump box grows to match the picture: 104 x 42 px (was 60 x 36). Pickup squares and pump bays grow with it (86 x 58 px) so "half the truck in the square" still works.

**Options considered:** full size tilted, full size snapping to four directions, 3/4 size, or today's size; growing the bump box or keeping it (picture overlapping parked cars).

**Why (product owner's rationale):** the PO likes the title screen's truck and wants the driving truck to look as good, in any direction (November 2). Full size: he likes the larger truck, and will play with it to check the size is right. The bigger bump box: so what hits matches what you see.

**Engineering's calls (proposals, not the PO's reasons):**
- Turning round on a two-lane street still works, now in two or three moves. Every street stays reachable (checked by the extras suite).
- A truck sliding along a curb or past a parked car may now ease sideways either way across the road (it used to ease only toward the middle), so the longer truck doesn't stick.
- The game draws with one texture per batch (`main.ts`): with several, the tilted truck drew with a chunk missing in the test browser.
- Known rough edge: the picture switches between the side and top views in one frame at about 25°. Removing it needs diagonal views, which LimeZu doesn't sell: a commissioned artist, the PO's own drawings (SCREAM-58), or live with it.

**Revisit if:** the switch at 25° bothers players, the truck feels too big for the streets, or diagonal art becomes available.

## 019 — Tuning: customers keep waiting while you serve; fewer willing customers; bigger, faster truck; smaller and more cars; closer view; thirstier truck (2026-11-02)

**Decision (Jira SCREAM-114, SCREAM-97):**
- The neighbourhood keeps going while you're off the road (the window, the cooler, the pump, the truck): customers waiting at the curb keep counting down their 30 seconds and can give up while you serve someone. The music is off there, so nobody new comes out. Pausing still freezes everything.
- Every resident's likelihood in the residents sheet (doc 15) was cut by 40%, rounded to 5% (average 52% became 31%).
- The truck is 1.3x bigger (60 x 36 px); parked cars are 0.8x (43 x 26 px), and there are twice as many (80). Lanes stay 60 px, so the truck can't U-turn in one sweep any more: turning round takes a three-point turn.
- The driving view is zoomed in 1.2x.
- Gas burns 1.5x as fast: a full tank drives 78,000 px (about a full evening of driving). Then 15% faster again (PO, November 2): 67,800 px; then 25% faster again: 54,200 px.
- Top speed is 10% higher, then 15% higher again: 547 px/s (was 433). It also burns gas faster per second at top speed.
- Momentum (PO, November 2): first 25% more (rolling down to a creep over 0.5 s, was 0.4); then much more: let go of the gas and the truck keeps 90% of its speed every half second, so it rolls on almost at the same speed until you brake, taking about 10 s to roll down to a creep. (The PO wrote "lose 90% per .5 seconds"; engineering read it as keeping 90%, which matches "basically keep that speed", and the PO agreed.) Braking is unchanged; to use the park brake, brake to a creep first.
- Each resident buys at most once a night (PO, November 2): already the rule since decision 015, and tested.
- Kept as they were (PO, November 2): how fast people come out while you're parked, speed not mattering much, and the 300 px music ring.

**Options considered:** for serving, keep the neighbourhood frozen or let it run; for parked, a steady trickle, a rush then a trickle, or as is; for driving, slower being better, about the same, or as is; for the ring, 300, 400 or 500 px; for the truck, 1.15x (U-turns still work), 1.3x with three-point turns, or 1.3x with wider lanes.

**Why (product owner's rationale):** to feel more realistic (decision 015's reason): sometimes a bunch of customers are waiting and some leave because you take too long, which only happens if waiting continues while you serve. The PO asked for fewer willing customers, a bigger truck, smaller and more parked cars, a view closer to the street, and quicker gas use (comment on SCREAM-114), then a 10% faster truck and gas 15% quicker again, then another 15% speed, 25% more momentum and gas 25% quicker (in chat). Fewer willing customers: it felt like there were too many, so the player never really had to drive around. The bigger, faster truck with more momentum, smaller and more parked cars, the closer view and faster gas: to make driving harder and feel a bit more like driving an actual ice cream truck.

**Engineering's calls (proposals, not the PO's reasons):**
- The amounts (1.3x, 0.8x, 80 cars, 1.2x zoom, 40% fewer, 1.5x gas) are starting points, all in `tuning.ts` or the residents sheet, to change after playing.
- Measured before and after (20 replays, 5 minutes): driving round brings out about 42 customers instead of 64. Parked, people come out more slowly, but nearly everyone in earshot still comes out eventually, because likelihood only slows the per-second chance down. If some people should never buy on a given evening, that's a change to how likelihood works.
- The extra cars are added last by the map generator, with their own random numbers, so houses, yards and residents stay where they were.

**Revisit if:** the truck feels too big for the streets (or the lanes should widen), customers feel too scarce or too plentiful, or gas runs out too often.

## 018 — A second gas station, on June Street; stations placed by the map generator (2026-11-02)

**Decision:** There are two gas stations (Jira SCREAM-109): the Speedway on Park Avenue (decision 016) and a second one on June Street, the main road along the map's west edge. Both work the same way and look the same: two pumps on a forecourt, a GAS sign and a yellow bay.

**Options considered:** the other real station in the map data (on Park Ave near Pleasant St, on the same east edge as the Speedway); an invented spot on the west side; or a spot the PO names.

**Why (product owner's rationale):** the PO chose the west side (November 2), so there's gas near both ends of the map. His reason for the Speedway (decision 016) also guided where on the west side: on a main road at the edge of the map, away from home, so the player explores.

**Engineering's calls (proposals, not the PO's reasons):**
- The map generator now places the stations (`gasStations` in `worcester.ts`) on the side of the road away from the middle of the map. The June Street one is about 2,000 px from home.
- A house standing on a forecourt moves to the nearest free spot along the same street and keeps its number in the residents sheet, so its resident moves with it. This also fixes a resident who lived "inside" the Speedway after decision 016 (house 146; house 148 moved too).
- Customers' pink squares are kept off the pump bays.

**Revisit if:** gas feels too far away or too close (move a station, or add one), or the map grows (SCREAM-66).

## 017 — Varied houses and yards; houses keep their lots (2026-11-02)

**Decision:** The neighbourhood's houses are no longer all small mobile homes (Jira SCREAM-108). Every lot gets a house picked from every style in the LimeZu pack that fits there: small, medium and big mobile homes, Victorian houses and villas (the terraced houses are too big for any lot). Each style comes in its own colours plus three of six wall-and-roof colour schemes. Yards get one to three garden ornaments: mailboxes, flower pots, sunflowers, bird houses, sheds, bushes, benches and fountains.

**Options considered:** every style that fits; lean on the tall Victorian houses (like Worcester's triple-deckers); or keep the mobile homes and only add colour.

**Why (product owner's rationale):** the PO chose "everything that fits" (November 2); the ticket asks for as many different assets as possible. It makes the map more interesting and worth exploring, and the streets more memorable and different from each other.

**Engineering's calls (proposals, not the PO's reasons):**
- Every house keeps its lot and its place in the list, because the residents sheet (doc 15) numbers houses in map order; a bigger house grows away from the street. Trees a bigger house now stands on were taken out.
- The map generator does this as a last step with its own random numbers, so the roads, potholes and parked cars are unchanged. Houses, trees, ornaments and the gas pump are packed into one picture sheet, because 150-odd separate files made the first drive slow to load.
- Residents can't stand on an ornament but can walk past one. Lots with a shallow front lawn get ornaments only at the sides, away from the front corners. Every yard spot is within 100 px of the door.
- Two corner houses now count as being on the cross street (R013 Brownell St, R017 Berkmans St); the PO had sheet 15 updated to match (November 2).

**Revisit if:** the PO wants a particular style or colour on a particular street, or the map grows (SCREAM-66).

## 016 — Fuel: a tank to budget for, and the Speedway on Park Avenue (2026-11-02)

**Decision:** The truck has a gas tank (Jira SCREAM-22). Driving uses gas by distance; with an empty tank the truck crawls at a quarter of its top speed. Gas is bought at a gas station on the map: the real Speedway on Park Avenue at Chandler Street, drawn as two of LimeZu's charging stations side by side as pumps, on a concrete forecourt with a GAS sign. Stop in the yellow bay beside the pumps and the pump screen opens; gas is bought in $5 steps, $30 for a full tank, and the clock keeps running while you're there. Both modes have fuel: Quick play starts each evening with a full tank; Story starts day 1 with $100 and a quarter tank, and whatever is left carries over to the next evening (and into the save). Gas spent gets its own line on the results and end-of-day screens.

**Options considered:**
- *Which modes:* Story only; Story and Quick play the same; or both, with Quick play starting full.
- *Where:* the Speedway at Park Ave and Chandler (just off the map's edge in real life), or the unnamed station near Pleasant Street.
- *Buying:* a pump screen with the clock running; with the clock stopped (like the cooler); or typing the amount on the calculator.
- *Between Story evenings:* the tank carries over, or goes back to a quarter.
- *How it looks:* a building pieced together from the pack, or the pack's charging stations as pumps.

**Why (product owner's rationale):**
- *Budgeting for gas alongside stock:* from the ticket's user story (October 29).
- *A station on the map, so stopping costs daylight; part tanks in $5 steps, $30 full; crawling to the pumps when dry, no tow fee for now; day 1 with $100 and a quarter tank:* the PO's decisions on October 29 (doc 10).
- *Both modes, Quick play full:* the PO's call (November 2). Quick play is a learning area: less is at stake, so players can see how much gas a day burns through without wasting time or money in Story mode.
- *The Speedway at Park Ave and Chandler:* the PO's call (November 2). He wanted it toward the edge of the map on a main road, and not near home, so the player has to explore a bit.
- *Pump screen with the clock running:* the PO's call (November 2), which keeps October 29's "stopping costs daylight".
- *The tank carries over in Story:* the PO's call (November 2). Like stock and money, it's all part of a few continuous days.
- *Looks like a gas station, using a couple of the pack's charging stations:* the PO's calls (November 2). They looked the most like a gas pump of anything in the pack; nothing was exact, but it's close enough.

**Engineering's calls (proposals, not the PO's reasons):**
- Numbers (all in `tuning.ts`): a full tank drives 117,000 px. "A full evening uses about 2/3 of a tank" was read as moving 60% of the 300-second evening at top speed (about 78,000 px). Driving flat out the whole evening would use slightly more than a full tank.
- The station sits on Park Avenue's east side just north of the Chandler corner, because the real one is just past the corner, off the map. One scenery house on that spot is left off the map. Placement is hand-set in `src/config/gasStation.ts`.
- The pump opens with the same rule as a customer: stopped, with half the truck in the bay. It starts at the most you can buy (filling up, or what the cash allows); ↑ and ↓ change it by $5; Enter pays and drives off; B drives off without gas. After paying, the bay doesn't reopen until the truck has left it.
- The gauge (E to F, in the top bar) shows while driving and at the pump, turns red at 15% and flashes when empty.
- Restarting a Story evening puts the tank back to how the evening started. Story saves from before fuel continue with a quarter tank.

**Revisit if:** gas feels too cheap or too tight (tune the tank size), the map grows past Park Avenue (SCREAM-66), or the home driveway restock (SCREAM-54) or power-ups (SCREAM-78) change how the truck refuels.

## 015 — Customers come from the music ring; the arrow goes; the truck plays music (2026-11-02)

**Decision:** Customers are the residents (decision 014), and the truck's music is how they find out it's near (Jira SCREAM-67, 68, 24, 99; doc 14). A faint ring round the truck shows how far the music reaches. Every second a resident is inside it, the game rolls a chance that they want ice cream: it's highest the moment they first hear it (25%) and then falls toward 5%, each second by less than the last, times their likelihood from the residents sheet, and halved while they're indoors. If they want some, a "!" thought bubble pops up and they run to the curb and wait; after 30 seconds they give up and walk home. There's no limit on how many wait at once, but nobody is a customer twice in one evening, so a parked truck runs out of customers. A sale starts as before: stop fully with half the truck in the pink square beside them. Their name shows at the window. The pink pointer arrow is gone. The truck plays chiptune versions of public-domain tunes while you drive, shuffled; M mutes (remembered), N skips.

**Options considered:**
- *Finding customers:* follow an arrow to a marker, or watch the neighbourhood.
- *What makes someone come out:* the truck's speed, or a chance each second they hear it.
- *How many at once:* a cap (engineering suggested 3), or no limit.
- *Music:* make, commission or licence it; always on, or on a key; which songs.

**Why (product owner's rationale):**
- *Watching the neighbourhood, not a beacon:* from the PO's user story (October 29): "I find customers by watching the neighbourhood, not by following a beacon." On the arrow (October 28): nice in early testing, but it should be hidden later; it's removed together with the ring (October 29) so players always have a way to find customers.
- *A chance each second, not speed:* speed still matters, because a truck driving fast spends less time near each person and the rules already lower its chances; he didn't want velocity to be the measure (November 2).
- *Indoors half as likely:* people at home are less likely to hear the truck, for example because they have the AC on (November 2).
- *Highest chance at first, then less and less:* someone is most likely to want ice cream the instant they hear the truck. Their mind may still change after that, but at a decreasing rate; that's been the PO's experience (November 2). Overall, the longer someone hears the truck, the more likely they've come out.
- *No limit on waiting customers, and no new customers if you stay in one spot long enough:* the PO's rules (November 2). He wants it to feel more realistic: sometimes a bunch of customers are waiting for you, and some leave because you take too long; and the longer you sit in one place, the longer the people around you have to hear the music. Tuning the numbers to match is SCREAM-114.
- *Music pulled into this work:* the PO's call (November 2); the truck's music is how customers know it's near (his idea on SCREAM-24, October 29). More than one song; no songs with a bad origin.

**Engineering's calls (proposals, not the PO's reasons):**
- Numbers (all in `tuning.ts`): ring 300 px; 25% in the first second falling to 5%, about two thirds of the way down after 6 seconds; running 75 px a second.
- Seconds heard are counted in a row: someone who hears the truck again later gets a fresh first-second chance.
- The first version had this the wrong way round (5% growing to 25%); the PO's reason showed the chance should start high. Fixed before merging.
- "Once per evening" is how staying in one spot runs out of customers. Giving up counts as their turn.
- Each resident has their own curb spot (where they stand, and the pink square beside them in the curb lane, clear of parked cars), worked out by `tools/residents/build_residents.py`.
- Songs: The Entertainer, Take Me Out to the Ball Game, Für Elise and Pop Goes the Weasel. Maple Leaf Rag and In the Good Old Summer Time were swapped out because they're hard to arrange well from memory. Turkey in the Straw (and Do Your Ears Hang Low, the same tune) and Stephen Foster's minstrel songs are left out for their history.
- The name at the window is a name tag on the customer's shirt.

**Revisit if:** customers feel too rare or too common (tune the numbers), named residents get days out (SCREAM-101) or parties (SCREAM-103), or sound effects arrive.

## 014 — Residents: named people with homes, edited in a sheet, drawn with LimeZu Modern Interiors (2026-11-02)

**Decision:** The neighbourhood has residents (Jira SCREAM-59, SCREAM-73; doc 14). There is about one per house: 160, since the map has 161 houses and one is home. Each has a name, a house (and so a street), an age (adult or kid) and their own likelihood of buying ice cream. They stay near their home all evening: they go in and out of their house and wander their yard. They are drawn with LimeZu's Modern Interiors character generator, each with their own combination of body, clothes and hair. The list lives in a Google Sheet the PO can edit (doc 15, "15 - Residents"); "sync residents" copies it into `tools/residents/residents.csv` and rebuilds the game's data with `tools/residents/build_residents.py`. Buying (the sonar ring, the chance check) comes next, in SCREAM-67.

**Options considered:**
- *Art:* LimeZu Modern Interiors ($1.50 minimum), free packs (Modern Chibis, Kenney's RPG Urban Kit), or another paid pack (comparison in doc 14).
- *Customers:* random people appearing anywhere, or named residents tied to houses.
- *Getting sheet edits into the game:* engineering syncs it on request; a script the PO runs; or the live game reads the sheet each time it loads.

**Why (product owner's rationale):**
- *Named residents tied to houses:* the PO asked for this on SCREAM-59 (November 2): everyone appears on the map, has a name, and is near their home; there are about as many as houses; and he wants a sheet where he can change their names and likelihood to buy. **Why** (November 2): he wants it to feel like an actual place, so that when a player does more than one run, they start to learn the people. Ideas he plans for later customer updates: the customer's name on screen when they ask for their order, and dialog that hints at a pricey ice cream someone wants or a party they're holding on a certain day of the run (a party means more people and more orders in a row).
- *LimeZu Modern Interiors:* the PO followed engineering's recommendation (November 2).
- *Engineering syncs the sheet on request, about 1 in 3 are kids, residents first and buying second:* the PO agreed to engineering's proposals (November 2).

**Engineering's calls (proposals, not the PO's reasons):**
- Why LimeZu: nearly free, and the only pack that matches the map's art exactly; the generator can give every resident a different look.
- Left out of the looks: grey, pink and blue skin; bright anime hair colours; work uniforms; costume hoods; and a red cap that looks like a famous game character's.
- Starting likelihoods: adults 20 to 70%, kids 50 to 95%. Names are made up.
- Timings (in `tuning.ts`): out for 25 to 70 seconds, in for 20 to 60, half outside when the evening starts.
- Yard spots are chosen so no walk crosses a house or a road; doors are on the front (bottom) wall, as in the art.

**Revisit if:** the PO wants more than one person per house, residents tied to particular houses by name (SCREAM-73's fuller version), or the sheet read live by the game.

## 013 — The story: save up for a $200 bike, 3 days, its own high scores (2026-10-31)

**Decision:** Story mode has a goal: the player is saving up for a new bike that costs $200 before school starts (Jira SCREAM-18). A new run opens with a plain text intro screen; the top bar shows the bike's price during the run. The run is 3 days for now (decision 011), then it ends: the last day's screen says whether you can afford the bike, then a results screen shows the whole run's stats and a Story top-5 table, separate from Quick play's. After that you start a new game from the title. The bike price is `BIKE_PRICE_CENTS` in `tuning.ts`.

**Options considered:**
- *Length:* 21 days (the original idea) or 3 to start.
- *Reaching $200 early:* end the run with a win, or play on to the last day.
- *Story text and art:* engineering drafts it, or the PO writes it.

**Why (product owner's rationale):** answered on October 31. The goal is a new bike, $200. 3 days for now, "to keep it easier to test and build". At the end you see your stats and compare Story high scores, then start a new game. The PO writes the story and provides the art himself (SCREAM-76, under SCREAM-6); plain text screens until then. Why school as the deadline: the PO drove an ice cream truck as a summer job in high school, and ice cream trucks mostly make their money in the summer, so the start of school is a natural countdown to the end of it. It gives the game a little story. Why a bike: cheap enough that a high school kid would really work towards it. He considered something like a PlayStation, but plans to build the story out more later, so the bike is a quick goal for now.

**Engineering's calls (proposals, not the PO's reasons):**
- The Story score is the cash at the end of the run. Reaching $200 early doesn't end the run.
- Game over (out of money) doesn't go on the Story table.
- The intro text in the game is engineering's placeholder, marked as one on screen.

**Revisit if:** the PO's own text arrives (SCREAM-76), the story is built out further (the goal may change), or the run grows towards 21 days.

## 012 — Story mode is saved in the browser, at the end of each evening (2026-10-31)

**Decision:** A Story run is saved in the browser, the same way high scores are (decision 004): no accounts, one save slot, and clearing the browser's data loses it (Jira SCREAM-17). The game saves automatically at the end of each evening, so quitting mid-evening means replaying that evening. With a save, the title screen offers "Continue story" (showing the day and the cash) and "New story"; New story asks first, and only the Y key confirms. The save is cleared when a run ends (the last day, or game over). Quick play never touches the save.

**Options considered:** save at the end of each evening, or also mid-evening; one slot or several; accounts or the browser only.

**Why (product owner's rationale):** the PO accepted engineering's proposal on October 31, mostly following engineering's lead because it was the simpler option. In his words, saving mid-evening "didn't seem all that important", and it "adds a wrinkle for the player to manage".

**Engineering notes:** saved under `icemachine.story.v1` (`src/state/StorySave.ts`): the next day, the cash and the cooler. A save that can't be read (damaged, or from a future format) is ignored rather than crashing the title screen.

**Revisit if:** runs get long (21 days) and replaying a whole evening after quitting feels harsh.

## 011 — Two modes: Quick play and Story, with a wallet that carries over (2026-10-31)

**Decision:** The title screen offers two modes (Jira SCREAM-19, SCREAM-21). Quick play is the one-evening game as it was, with its $50 start and its high score table. Story is a run of evenings in a row: it starts with $100, and the cash and the ice cream left in the cooler carry from one evening to the next. Leftover ice cream keeps overnight. Running out of money is game over. A run is 3 evenings for now (decision 006, SCREAM-65), growing to 21 later; the number is `STORY_DAYS` in `tuning.ts`.

**Options considered:**
- *Modes:* make the whole game multi-day, or keep the one-evening game and add Story beside it.
- *Length:* start at 21 days, or with the 3-day loop and extend it later.
- *Leftover ice cream:* keeps overnight, or some melts.
- *Running out of money:* can't happen (you just can't spend what you don't have), or game over.

**Why (product owner's rationale):** answered on October 31. Keep Quick play as it is and add Story beside it. 3 days first, "to keep it easier to test and build", then extend it later. $100 to start. Leftover ice cream keeps, for now. You can run out of money, and then it's game over. Why game over rather than carrying on in debt: the PO thinks it's a fun mechanic that makes players more careful with their driving and their spending. It also leaves room for power-ups he plans to add: if players could go into debt, they could buy every power-up.

**Engineering's calls (proposals, not the PO's reasons):**
- "Out of money" means: at the end of an evening, cash is below $0, or the cooler is empty and you can't afford even the cheapest ice cream ($1). During an evening you keep playing below $0, since you can still sell.
- Between evenings an end-of-day screen shows tonight's takings, the wallet and the ice creams left. Story evenings don't go on the Quick play high score table.
- Restart evening (pause menu) in Story puts the cash and stock back to how that evening started; Quit ends the run (until saving arrives, SCREAM-17).

**Revisit if:** runs feel too easy or too hard once they're longer than 3 days, once fuel (SCREAM-22) costs money each evening, or when power-ups are priced.

## 010 — One way to drive: Easy mode removed (2026-10-30)

**Decision:** The game has one way to drive: car-style, with gas, brake/reverse, steering and a park brake (the old Hard). Easy mode is gone, along with the difficulty choice on the title screen; the arrows pointed the way in Easy. The title now shows the controls. There's one high score table: the old Hard table, so those scores carry over. The Easy table is no longer shown. (Jira SCREAM-53.)

**Options considered:** keep both difficulties, change Easy (on the Worcester map it became "arrows point the way, two together go diagonal"), or remove it.

**Why (product owner's rationale):** removed "based on more feedback" from playtesting. *(The details of the feedback to be added.)*

**Engineering notes:** the title, the evening state, the high scores and the results screen no longer know about difficulty. `icemachine.difficulty` and `icemachine.highscores.easy.v1` stay in players' browsers but aren't read.

**Revisit if:** new players find car-style driving too hard to start with. A short driving tutorial (SCREAM-5) would be the first thing to try.

## 009 — The Worcester map: real streets at their real angles (2026-10-30)

**Decision:** The driving map is the real neighbourhood bounded by June St, Pleasant St, Park Ave and Chandler St in Worcester, MA, with real street names (Jira SCREAM-10). Street shapes come from OpenStreetMap, simplified into straight segments that keep their real angles. The map is about twice the size of the old one: two 60 px lanes per road as before, 6,242 x 5,178 px. Houses, trees and grass are LimeZu sprites at the pack's 16 px size. Home is on Longfellow Road, in the middle of the area (engineering's proposal, confirmed by the PO on October 30). Credits for OpenStreetMap ("Map data © OpenStreetMap contributors") and LimeZu are on the title screen, with the OSM credit also in a corner of the driving view.

**Options considered:**
- *Map shape:* roads straightened onto the tile grid (first choice) against roads at their real angles. On the grid, this area's diagonal streets (June, Pleasant, Chandler and many inside) became staircases, shown side by side in small and big steps.
- *Scale:* keep about 20 s across, about 40 s (twice as big), or real scale.
- *Street names:* real, or changed slightly.
- *Street data:* the PO exports it from openstreetmap.org, or the workspace fetches it (the workspace couldn't reach the site, so the PO exported it).

**Why (product owner's rationale):** answered in the session on October 30. Real street names. About 40 seconds across rather than 20 or real scale. Simplified for driving. Then, after seeing the staircase layouts: angled roads, with the more work they need. Why Worcester and real streets: the PO sold ice cream on these streets, and using a real place lets him draw on that experience so the neighbourhood feels real. Home on Longfellow Road: a good central location.

**Engineering notes:**
- "On the road" no longer uses tiles: every point round the truck's outline must be on the asphalt (`src/state/RoadGeometry.ts`).
- Easy driving (removed since, decision 010): the arrows point the way, and two arrows together point between them (diagonals), so angled streets can be driven. The first version also followed the road by itself; the PO took that out after playtesting PR #80: "they should have to steer in all the directions".
- Street corners are rounded (PO, testing PR #80: some corners were too sharp). The generator rounds every inside corner with a 48 px radius and draws the road surface as images; the road edge is read from a map made from the same shape, so the curb you see is the curb you hit.
- Grinding along a curb you're already touching isn't a new hit: on slanted curbs the truck creeps along them, and it used to be charged again every 0.4 s.
- The ground, roads, potholes, parked cars, houses, trees and names round the camera are painted into one image, which is repainted when the camera moves into a new 512 px square. Drawing 2,000 houses and trees separately every frame was about 3x slower than the old map; painted, it runs faster than the old map.
- The map is generated by `tools/worcester/build_map.py` from the OSM extract in `tools/worcester/worcester-osm.json` (ODbL) and the private LimeZu pack. It's rebuilt by running the script, not by editing `src/config/worcester.ts`.

**Revisit if:** the PO wants Home somewhere else, or more of Worcester.

## 008 — Art from a paid pack, kept out of the public repo (2026-10-30)

**Decision:** The game's art comes from LimeZu's Modern Exteriors pack (48x48), bought by the product owner. The full pack lives in a private repository (`icemachine-art`); only the individual sprites the game uses are copied into this public repo, under `public/assets/limezu/`. LimeZu is credited on the title screen. The first piece is LimeZu's ice cream truck beside the title. The pack only draws it side-on, so the top-down driving truck is drawn in code in its colours. (Jira SCREAM-6.)

**Options considered:**
- *Simpler route (chosen):* commit only the sprites in use to the public repo.
- *Build-time pull:* the build fetches art from the private repo, so no pack files are ever in the public repo. More setup (a deploy key and a build step).
- *Driving truck:* the side-on truck on screens with a matching top-down truck for driving (chosen), a 4-direction pack vehicle snapped to 4 directions, or keeping the placeholder.

**Why (product owner's rationale):** the simpler route fits the licence, which allows use in open-source projects on GitHub but not redistributing the pack itself, so single sprites used in the game are fine while the whole pack stays private.

**Revisit if:** the game uses so many sprites that the public folder starts to look like a copy of the pack.

## 007 — Prices are entered on a calculator, typed left to right (2026-10-30)

**Decision:** The price at the sales window is entered on an on-screen calculator in the middle of the window: a large display with the $ on the left and digits right-aligned, the number keys 7–9, 4–6, 1–3, 0, 00 and ".", plus C, back and CHARGE keys. Typing works like a calculator, left to right: 7 . 2 5 is $7.25, and with no decimal point the number is whole dollars (7 is $7.00). Keyboard and mouse both work and can be mixed. (Jira SCREAM-12; doc 13.)

**Changes:** cash-register typing from PR #38 (digits filled from the right, so 725 read $7.25) and the whole-dollars click from PR #40 (removed).

**Options considered (doc 13):** an on-screen number pad, counting out bills and coins (Supermarket Simulator style), tapping each item to build the total, or a different method per difficulty.

**Why (product owner's rationale):** the key needs are quick, easy money entry that works with typing and/or the mouse. The PO likes the Supermarket Simulator style, but it's too complex for this early in the game, so it's in the backlog at the lowest priority (SCREAM-50).

**Revisit if:** playtests show the calculator slows sales down, or when the art epic makes bills and coins possible.

## 006 — The 3-day calendar becomes the extended game's beta (2026-10-30)

**Decision:** The short 3-day calendar is no longer a P1 item of its own. It moves into the *New game mode: extended game* epic (Jira ICE-9, low priority) as that mode's beta: a 3-day experiment before the full 21-day summer. Tickets that assumed the calendar (carry cash, fuel, save, intro story, two game modes, game over) build on that beta. (Jira ICE-34, formerly GitHub #53.)

**Changes:** decision Q3 in *10 - Next Phase Discussion*, which put the short calendar in P1.

**Why (product owner's rationale):** "I cut the 3 day calendar, but I probably should've merged it. Maybe the beta version of the 21 days is a 3 day experiment." It was cut outright in the mid-P1 prioritization session, then folded into the extended game the same night.

**Revisit if:** the extended game moves up in priority, or the beta shows a multi-day run isn't fun.

## 005 — The clock waits while you stock the cooler (2026-10-30)

**Decision:** Each evening opens straight at the cooler with the clock stopped at 5:00 PM. The clock starts when you leave the cooler for the first time. Later trips back to the cooler still cost daylight. (Issue #66.)

**Added while testing PR #70 (product owner's request):** the player can't leave the opening cooler until at least one ice cream is bought; B and an empty Buy Stock show a warning instead.

**Changes:** the pitch's rule that the clock starts at 5 PM and never stops, so that even the first stock-up cost time.

**Why (proposed by engineering; product owner to confirm or replace):** the opening stock-up is setup, not play. Starting at the cooler with the clock waiting gets a new player straight to the first real decision without losing evening time to learning the screen.

**Revisit if:** players spend so long in the opening prep that it slows the game down, or the 21-day calendar (#53) needs each day to start differently.

## 004 — High scores kept on this computer (2026-10-29)

**Decision:** A pinball-style top 5, stored in the player's browser on this computer. Scores stay when a new version of the game is deployed. Negative evenings count if they make the top 5.

**Options considered:** Local browser storage now vs an online leaderboard (needs a hosted backend, issue #3). A longer table vs a top 5 to start.

**Why (product owner's rationale):**
- *Scope:* storing scores locally is enough to give the loop a goal; an online board can come later.
- *Cost:* no backend, no accounts, no hosting cost.
- *Scores that last:* first proposed as resetting with each new build; changed while testing PR #42 so players keep their scores through updates.

**Deferred:** a fuller scoreboard with fun records (lowest score ever, least money earned), tracked as its own ticket.

**Revisit if:** the game ships on itch.io and players want to compare scores (issue #3).

## 003 — TypeScript instead of JavaScript (2026-10-27)

**Decision:** Convert the codebase to TypeScript and add a type check that runs on every pull request.

**Options considered:** Switch to TypeScript now (bundled with the Phaser 4 upgrade), or stay on JavaScript. Full analysis: "03 - JavaScript vs TypeScript Analysis" in the project Drive folder.

**Why (product owner's rationale):**
- *Sound engineering reasoning:* the engineering team's case held up, and I back the team's call when the reasoning is sound.
- *Cost:* no price impact; TypeScript is free and the switch costs one PR.
- *Building for the future:* types make the codebase easier to review and safer to grow as features are added.

**Engineering rationale:** Phaser 4's bundled type definitions describe the real v4 API, so any Phaser 3-style call fails the type check automatically. This guards the main risk identified in decision 002.

**Revisit if:** type errors become a recurring drag on delivery with no bugs caught.

## 002 — Upgrade to Phaser 4 (2026-10-27)

**Decision:** Upgrade from Phaser 3.90 to Phaser 4.2 before any game code is written.

**Options considered:** Upgrade now; upgrade before the vertical slice; stay on Phaser 3. Full analysis: "02 - Phaser 4 Upgrade Analysis" in the project Drive folder. Triggered by the tech stack audit ("01 - Tech Stack Audit").

**Why (product owner's rationale):**
- *Sound engineering reasoning:* the engineering team's case held up, and I back the team's call when the reasoning is sound.
- *Cost:* Phaser stays free (MIT); no price increase.
- *Building for the future:* new features and fixes go to Phaser 4 only, and upgrading is cheapest while the codebase is one screen.

**Known risk:** the engineering team's Phaser knowledge is mostly v3. Mitigated by the official migration guide and the TypeScript check (decision 003).

**Revisit if:** a needed plugin or feature is only available for Phaser 3.

## 001 — Tech stack and hosting (2026-10-27)

**Decision:** Phaser 3 + Vite, plain JavaScript, hosted on GitHub Pages.

**Options considered:**
- *Engine:* Phaser 3 vs Godot (web export) vs a hand-built canvas engine. Phaser runs natively in the browser, is purpose-built for 2D, and has extensive documentation.
- *Language:* JavaScript vs TypeScript. JavaScript keeps the code simpler to read for review; TypeScript remains an option to revisit.
- *Hosting:* GitHub Pages vs itch.io vs Netlify. GitHub Pages deploys automatically from the repo at no cost; itch.io will be added later as the distribution storefront.

**Why (product owner's rationale):**
- *Familiarity:* tools I've used before in previous software work, so less ramp-up time.
- *Cost:* every piece is free, which fits a solo portfolio project with no budget.
- *Engineering recommendation:* the engineering side recommended this stack for a static 2D browser game, and I accepted it.

**Engineering rationale:** The game is static files with no server needs. This stack keeps code and process in one public place and puts every change one merge away from being live.

**Revisit if:** the game needs online features (leaderboards, accounts), at which point a hosted backend such as Supabase is the likely addition.
