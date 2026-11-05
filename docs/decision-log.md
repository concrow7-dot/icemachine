# Decision log

Newest first. Each entry: what was decided, the options considered, and why.

## 040 — The uncle's guided tutorial: how it runs, skipping, and how he looks (2026-11-05)

**Decision (Jira SCREAM-169 and SCREAM-174, under SCREAM-5, PO, November 5):** the uncle's tutorial is six stories (SCREAM-169 to 174). The truck visibly drives itself while the uncle drives (SCREAM-171). After his last step (the pump) the player plays the rest of the evening alone on the tutorial map, and Tutorial stays its own mode on the title screen; the PO wants it to roll into Story mode eventually, but separate for now. The first time, the uncle always comes along; after a player has finished an evening with him, Tutorial asks "With Uncle" or "On My Own". The regular lives on the way to the gas station and comes out as soon as the truck is in range, always buying (SCREAM-172). New players must finish the tutorial before the other modes unlock (SCREAM-175). The uncle is drawn like a customer at the sales window, standing inside the truck (the PO's interior drawing) when he first talks, and his lines use the sales window's quote box.

**Why (product owner's rationale):** _to fill in: waiting on the PO (asked November 5)._

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
