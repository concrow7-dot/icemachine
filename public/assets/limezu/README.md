# LimeZu art

Sprites in this folder come from **Modern Exteriors** by LimeZu (https://limezu.itch.io/),
bought by the project owner. The licence allows use and editing in commercial and
non-commercial projects, including open-source ones on GitHub, but not reselling or
redistributing the assets themselves, and asks for a credit to https://limezu.itch.io/.

Only the individual sprites the game uses are kept here (decision 008). The full pack
lives in a private repository and must not be copied into this one.

- `ice_cream_truck.png`: `ME_Singles_Vehicles_48x48_Ice_Cream_Truck_1.png`, cropped to its edges.
- `truck_views.png` (SCREAM-115): the driving truck's four views, written by `tools/truck/build_truck.py`.
  Left and right are `ME_Singles_Vehicles_48x48_Ice_Cream_Truck_1.png`; front and back are
  `ME_Singles_Vehicles_48x48_Ambulance_Down_1.png` / `_Up_1.png` repainted in the truck's colours,
  with the truck's cone and scoop on the roof. Shrunk to 16 px like the map.
- `map/`: the Worcester driving map's houses, trees and grass (SCREAM-10), written by
  `tools/worcester/build_map.py`. The pack's 48 px files are exact 3x enlargements of its
  16 px art, so these are shrunk back to 16 px, which matches the size of the driving truck:
  `Camping_48x48_Mobile_House_Small_1/3/5/7`, `Villas_48x48_Villa_1-5`, `Villas_48x48_Tree_1-4`,
  and a 64 px grass patch made from `Terrains_and_Fences_48x48_Grass_1_9-12/22`.
- `residents.png`: the neighbourhood's residents (SCREAM-59, SCREAM-73), from **Modern
  Interiors** by LimeZu (same licence and credit, also bought by the project owner).
  Each look combines the character generator's layers (body, eyes, outfit, hairstyle,
  accessory); only the idle and walk frames are kept, shrunk to 16 px. Written by
  `tools/residents/build_residents.py`.
