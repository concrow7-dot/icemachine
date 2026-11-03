# Truck interior art (SCREAM-57)

- `truck-interior-lineart.png`: engineering's line art of the PO's pen sketch (version 3), 1920 x 1080, black on white, every area closed so Paint's bucket fills it.
- `draw_truck_interior.py`: draws it. `python3 tools/interior/draw_truck_interior.py out.png` writes `out.png` and `out-labelled.png` (a key with each part named). Needs Pillow.
- The game uses the PO's coloured version: `public/assets/interior/truck-interior.png`. To change the picture, colour a new copy of the line art and replace that file. If parts move, update the click outlines (`ZONES`) in `src/scenes/TruckScene.ts`; they are traced on the 960 x 540 screen, half the picture's size.
- `draw_cooler.py` (SCREAM-124): draws the cooler screen's background, the open freezer (steel rim, dark inside, icicles, boxes, a crate per slot), in the drawing's style. `python3 tools/interior/draw_cooler.py public/assets/interior/cooler-inside.png`. Fixed seed, so it redraws the same. The glass lids that slide open are drawn by `CoolerScene`; keep the crate and opening positions in step with `COLUMN_X`, `ROW_Y` and `OPENING` there.
