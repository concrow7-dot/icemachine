"""Dresses the Foley Stadium (Worcester) Tiled map as three neighbourhoods (SCREAM-384 to 387).

The PO's plan (November 17): small houses in the middle of the map, apartment buildings along
Chandler Street and east of the stadium, modern looking buildings on the west side. In each
neighbourhood the buildings look alike but differ in shape and colour, and the yards and
streets get the kind of decoration Elm Park has. This script writes engineering's first draft
into the Tiled file; the PO then adjusts it in Tiled.

Usage (run from the repo root):
    python3 tools/tiled/dress_worcester.py <worcester-map folder> <singles folder> <zone> [<zone> ...]
    then: python3 tools/tiled/import_tiled.py <worcester-map folder>/worcester-map.tmx <singles folder>

<zone> is small, apartments or modern. Each zone is dressed once (the Tiled file remembers which
are done, in its "dressed" property); dressing the zones one after another gives the same map
as dressing them together. Do not rerun a zone after the PO has edited it in Tiled.

What a zone's run does, inside that neighbourhood only:
- every numbered house keeps its number, its lot and the side that faces its street, and gets a
  building from the neighbourhood's set (home is never touched);
- the old garden ornaments are taken out and new ones put in: by each building, and along the
  streets (lamps, hydrants, benches and so on);
- the trees change to the neighbourhood's kinds; trees that would hide a new building go.
New pictures are made from the art pack into <folder>/sprites-neighbourhoods/ (a second
"Map pieces" tileset, so the import keeps their names). Roads, curb spots, the gas stations
and the parks are not touched.
"""
import colorsys, json, math, os, random, re, sys
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ZONES = ('small', 'apartments', 'modern')
NEW_SET = 'Map pieces: neighbourhoods (game, 16 px)'
NEW_FIRST_GID = 2001          # after the game's own pieces (1...) and the pack tileset (157...)
NEW_DIR = 'sprites-neighbourhoods'

# ---- Which streets are which neighbourhood (from the PO's picture) ----
RED = {'Chandler Street', 'Carlisle Street', 'Abbott Street', 'Abbott Place', 'Park Avenue', 'Norman Avenue', 'Federal Place'}
GREEN = {'Berkmans Street', 'Brownell Street', 'Edgewood Street', 'Lovell Street', 'Calmia Street'}
JUNE_SPLIT_X = 2700           # June Street: west of this is the modern side, east of it the small houses
PLEASANT_SPLIT_X = 4500       # Pleasant Street: east of this is by the stadium (apartments)
ZONE_REACH = 460              # trees and ornaments farther than this from any street are left alone


def zone_of_street(name, x):
    if name in RED: return 'apartments'
    if name in GREEN: return 'modern'
    if name == 'June Street': return 'modern' if x < JUNE_SPLIT_X else 'small'
    if name == 'Pleasant Street': return 'apartments' if x > PLEASANT_SPLIT_X else 'small'
    return 'small'


# ---- The pictures: (key, pack file without "_48x48", how to colour it) ----
WALL_ROOF = {  # the game's own schemes (tools/worcester/build_map.py), painted onto grey walls and roofs
    'cream': ((255, 236, 196), (168, 62, 50)), 'mint': ((206, 238, 214), (52, 102, 70)),
    'sky': ((206, 226, 250), (48, 70, 120)), 'pink': ((250, 214, 222), (110, 74, 60)),
    'butter': ((250, 240, 170), (70, 92, 128)), 'lavender': ((226, 214, 244), (64, 60, 70)),
}
WALL_ONLY = {'white': (250, 244, 232), 'sage': (212, 226, 204), 'ice': (208, 222, 238), 'sand': (236, 220, 190)}
CABIN = {'white': ((250, 246, 238), (58, 60, 68)), 'ice': ((214, 226, 240), (52, 62, 80)), 'sand': ((238, 224, 196), (70, 64, 60))}  # pale walls, dark roof
BRICK = {'sand': (0.10, 0.55, 1.12), 'slate': (0.60, 0.35, 0.95), 'olive': (0.20, 0.45, 0.95)}  # hue, saturation x, value x


def building_sets():
    small = []
    for i in range(1, 9):
        small.append((f'house_cottage_{i}', f'ME_Singles_Camping_Mobile_House_Small_{i}', None))
        for c in WALL_ROOF: small.append((f'house_cottage_{i}_{c}', f'ME_Singles_Camping_Mobile_House_Small_{i}', ('wallroof', c)))
    apartments = []
    for n, f in (('corner', 'Condo_4_38'), ('corner_b', 'Condo_4_39'), ('tower', 'Condo_4_40')):
        apartments.append((f'house_apt_brick_{n}', f'ME_Singles_Generic_Building_{f}', None))
        for c in BRICK: apartments.append((f'house_apt_brick_{n}_{c}', f'ME_Singles_Generic_Building_{f}', ('brick', c)))
    for n, f in (('two', 'Condo_3_45'), ('four', 'Condo_3_46')):
        apartments.append((f'house_apt_walkup_{n}', f'ME_Singles_Generic_Building_{f}', None))
    apartments.append(('house_apt_stairs', 'ME_Singles_Generic_Building_Condo_8', None))
    apartments.append(('house_apt_stone', 'ME_Singles_Generic_Building_Condo_6', None))
    apartments.append(('house_apt_loft', 'ME_Singles_Generic_Building_Condo_9', None))
    apartments.append(('house_apt_small', 'ME_Singles_Generic_Building_Condo_3_44', None))
    modern = []
    for i in range(1, 7):
        for stem, n in ((f'24_Additional_Houses_Terraced_House_{i}', f'house_modern_{i}'),
                        (f'24_Additional_Houses_Terraced_House_Modular_{i}', f'house_modern_slim_{i}')):
            modern.append((n, stem, None))
            for c in WALL_ONLY: modern.append((f'{n}_{c}', stem, ('wall', c)))
    for n, stem in (('house_modern_deck', '24_Additional_Houses_Modern_House'), ('house_modern_deck_plain', '24_Additional_Houses_Modern_House_Unadorned'),
                    ('house_modern_garage', '24_Additional_Houses_One_Story_House')):
        modern.append((n, stem, None))
        for c in ('white', 'sand'): modern.append((f'{n}_{c}', stem, ('wall', c)))
    for i in (1, 2, 3): modern.append((f'house_modern_block_{i}', f'ME_Singles_Generic_Building_Condo_5_{i}', None))
    # Low houses for the lots too shallow for anything taller: the small houses' shapes in plain modern colours.
    for i in range(1, 9):
        for c in CABIN: modern.append((f'house_modern_cabin_{i}_{c}', f'ME_Singles_Camping_Mobile_House_Small_{i}', ('cabin', c)))
    return {'small': small, 'apartments': apartments, 'modern': modern}


def P(key, stem): return (key, stem, None)
ME = 'ME_Singles_'
DECOR = {  # every zone's ornaments, trees and street pieces
    'small': dict(
        yard=[P('orn_mailbox_blue', '22_Post_Office_Blue_Mailbox_1_Front'), P('orn_mailbox_red', '22_Post_Office_Red_Mailbox_1_Front'),
              P('orn_mailbox_black', '22_Post_Office_Black_Mailbox_1_Front')],
        garden=[(P('orn_sunflower', ME + 'Garden_Big_Sunflower'), 5), (P('orn_white_flower', ME + 'Garden_Big_White_Flower'), 4),
                (P('orn_flower_pot_white', ME + 'Graveyard_White_1_Flowers_Pot'), 4), (P('orn_flower_pot_pink', ME + 'Graveyard_Pink_Flowers_Pot'), 4),
                (P('orn_red_flowers', ME + 'Graveyard_Red_Group_Flowers'), 3), (P('orn_flower_bush_pink', ME + 'City_Props_Flower_Bush_1'), 2),
                (P('orn_flower_bush_orange', ME + 'City_Props_Flower_Bush_2'), 2), (P('orn_bush_round', ME + 'Garden_Bush_11'), 3),
                (P('orn_bush_flowering', ME + 'Garden_Bush_17'), 3), (P('orn_shrub_small', ME + 'City_Props_Shrub_5'), 5),
                (P('orn_shrub_fern', ME + 'City_Props_Shrub_6'), 5), (P('orn_rock', ME + 'Camping_Rock_3'), 2),
                (P('orn_mushrooms', ME + 'Camping_Mushrooms_5'), 2), (P('orn_yard_ball', ME + 'Villas_Villa_Yard_Props_3'), 2),
                (P('orn_yard_log', ME + 'Villas_Villa_Yard_Props_18'), 1), (P('orn_bird_house', ME + 'Garden_Brown_Little_Bird_House'), 2)],
        big=[(P('orn_rocking_toy', ME + 'Villas_Villa_Yard_Toy_Rocking_7'), 3), (P('orn_sand_box', ME + 'Villas_Villa_Yard_Toy_Sand_Box_2'), 2),
             (P('orn_trampoline', ME + 'Villas_Villa_Yard_Toy_Trampoline_3'), 1), (P('orn_basketball_net', ME + 'Villas_Villa_Yard_Basketball_Net_3'), 2),
             (P('orn_picnic_table', ME + 'Camping_Benched_Table_2'), 2), (P('orn_barbecue', ME + 'Camping_Barbecue_1'), 2),
             (P('orn_garden_bench', ME + 'Garden_Big_Bench_Horizontal'), 2)],
        big_chance=0.45, yard_count=(4, 7),
        fence=('24_Additional_Houses_Fence_1', 'orn_fence_wood', 0.5),
        trees=[(P('tree_oak', ME + 'Camping_Tree_1'), 5), (P('tree_oak_wide', ME + 'Camping_Tree_157'), 2), (P('tree_tall', ME + 'Camping_Tree_110'), 3),
               (P('tree_pine', ME + 'Camping_Tree_213'), 4), (P('tree_round', ME + 'Camping_Tree_7'), 3), (P('tree_leafy', ME + 'Camping_Tree_73'), 3),
               (P('tree_autumn', ME + 'Camping_Tree_226'), 1), (P('tree_young', ME + 'City_Props_Tree_11'), 3)],
        tree_keep=1.0,
        street=[(P('lamp_double', ME + 'City_Props_Street_Lamp_2'), 300, 0), (P('orn_hydrant', ME + 'Fire_Station_Fire_Hydrant'), 1100, 150),
                (P('orn_street_shrub', ME + 'City_Props_Shrub_10'), 700, 420)],
    ),
    'apartments': dict(
        yard=[P('orn_mailbox_big_blue', '22_Post_Office_Big_Blue_Mailbox'), P('orn_mailbox_big_grey', '22_Post_Office_Big_Grey_Mailbox')],
        garden=[(P('orn_trash_can', ME + 'City_Props_Small_Closed_Trash_Can'), 5), (P('orn_trash_bag', ME + 'City_Props_Single_Trash_3'), 3),
                (P('orn_recycling_bin', ME + 'City_Props_Blue_Closed_Trash_Can'), 3), (P('orn_bin_black', ME + 'City_Props_Black_Closed_Trash_Can'), 3),
                (P('orn_planter_tall', ME + 'Subway_and_Train_Station_Plant_Vase_2'), 5), (P('orn_potted_plant', '24_Additional_Houses_Terraced_House_Potted_Plant_4'), 4),
                (P('orn_potted_plant_2', '24_Additional_Houses_Terraced_House_Potted_Plant_2'), 4), (P('orn_ac_unit', '24_Additional_Houses_Terraced_House_AC_Unit'), 3),
                (P('orn_barrel', ME + 'City_Props_Barrel_2'), 2), (P('orn_cone', ME + 'City_Props_Cone_6'), 2), (P('orn_shrub_box', ME + 'City_Props_Shrub_4'), 4),
                (P('orn_boxes', ME + 'City_Props_Cardboard_Trash_1'), 2)],
        big=[(P('orn_dumpster', ME + 'City_Props_Dumpster_1'), 3), (P('orn_dumpster_green', ME + 'City_Props_Dumpster_3'), 2),
             (P('orn_planter_box', ME + 'City_Props_Shrub_11'), 4), (P('orn_city_bench', ME + 'City_Props_Bench_1'), 3)],
        big_chance=0.7, yard_count=(3, 6),
        fence=None,
        trees=[(P('tree_city', ME + 'City_Props_Tree_1'), 5), (P('tree_city_round', ME + 'City_Props_Tree_3'), 4), (P('tree_young', ME + 'City_Props_Tree_11'), 4),
               (P('tree_leafy', ME + 'Camping_Tree_73'), 1)],
        tree_keep=0.6,
        street=[(P('lamp_single', ME + 'City_Props_Street_Lamp_5'), 240, 0), (P('lamp_power_pole', ME + 'City_Props_Electric_Pole_6'), 760, 120),
                (P('orn_hydrant', ME + 'Fire_Station_Fire_Hydrant'), 900, 300), (P('orn_city_bench_side', ME + 'City_Props_Bench_3'), 820, 500),
                (P('orn_street_bin', ME + 'City_Props_Blue_Open_Lateral_Full_Trash_Can'), 820, 540), (P('lamp_street_sign', ME + 'City_Props_Traffic_Sign_27'), 1500, 60)],
    ),
    'modern': dict(
        yard=[P('orn_mailbox_modern', '24_Additional_Houses_Terraced_House_Mailbox'), P('orn_mailbox_black', '22_Post_Office_Black_Mailbox_1_Front')],
        garden=[(P('orn_modern_plant', '24_Additional_Houses_Modern_House_Potted_Plant'), 5), (P('orn_modern_plant_bloomed', '24_Additional_Houses_Modern_House_Potted_Plant_Bloomed'), 5),
                (P('orn_topiary_ball', ME + 'Garden_Bush_11'), 4), (P('orn_hedge_block', ME + 'Garden_Grass_Wall_1_Flowered_4'), 4),
                (P('orn_planter_tall', ME + 'Subway_and_Train_Station_Plant_Vase_2'), 4), (P('orn_potted_plant', '24_Additional_Houses_Terraced_House_Potted_Plant_4'), 3),
                (P('orn_potted_plant_3', '24_Additional_Houses_Terraced_House_Potted_Plant_3'), 3), (P('orn_shrub_small', ME + 'City_Props_Shrub_5'), 3),
                (P('orn_rock', ME + 'Camping_Rock_3'), 2), (P('orn_white_flower', ME + 'Garden_Big_White_Flower'), 2)],
        big=[(P('orn_topiary_animal', ME + 'Garden_Grass_Statue_5'), 2), (P('orn_topiary_animal_2', ME + 'Garden_Grass_Statue_1'), 2),
             (P('orn_sunbed', ME + 'Swimming_Pool_Sunbed_7'), 3), (P('orn_patio_umbrella', '24_Additional_Houses_Modern_House_Umbrella_Composition'), 3),
             (P('orn_pergola', ME + 'Garden_Pergola_Structure'), 1), (P('orn_fountain', ME + 'City_Props_Fountain_1'), 1),
             (P('orn_hedge_arch', ME + 'Garden_Grass_Arch_1'), 1)],
        big_chance=0.6, yard_count=(3, 6),
        fence=('24_Additional_Houses_Fence_6', 'orn_fence_modern', 0.45),
        trees=[(P('tree_pine', ME + 'Camping_Tree_213'), 5), (P('tree_pine_blue', ME + 'Camping_Tree_237'), 4), (P('tree_cypress', ME + 'City_Props_Tree_15'), 4),
               (P('tree_city_round', ME + 'City_Props_Tree_3'), 3), (P('tree_tall', ME + 'Camping_Tree_110'), 2)],
        tree_keep=0.85,
        street=[(P('lamp_curved', ME + 'City_Props_Street_Lamp_1'), 280, 0), (P('orn_hydrant', ME + 'Fire_Station_Fire_Hydrant'), 1200, 200),
                (P('orn_street_planter', ME + 'City_Props_Shrub_11'), 640, 380)],
    ),
}


# ---- Pictures ----
class Art:
    def __init__(self, folder, singles):
        self.dir = os.path.join(folder, NEW_DIR)
        os.makedirs(self.dir, exist_ok=True)
        self.by = {}
        for dp, _, fs in os.walk(singles):
            for f in fs:
                if f.endswith('.png'): self.by[f.replace('_48x48', '')[:-4].lower()] = os.path.join(dp, f)
        self.size = {}

    def make(self, piece):
        """Writes the 16 px picture for a piece (once) and returns (key, w, h)."""
        key, stem, colour = piece
        if key in self.size: return (key,) + self.size[key]
        src = self.by.get(stem.lower())
        if not src: sys.exit(f'the art pack has no "{stem}"')
        im = Image.open(src).convert('RGBA')
        im = im.resize((im.width // 3, im.height // 3), Image.NEAREST)
        if colour: im = recolour(im, *colour)
        bb = im.getbbox()
        im = im.crop(bb)
        im.save(os.path.join(self.dir, key + '.png'), optimize=True)
        self.size[key] = im.size
        return (key,) + im.size


def recolour(im, kind, name):
    a = np.asarray(im).astype(np.float32)
    rgb = a[:, :, :3] / 255
    mx, mn = rgb.max(axis=2), rgb.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    lum = rgb.mean(axis=2)
    solid = a[:, :, 3] > 0
    out = rgb.copy()
    if kind in ('wallroof', 'wall', 'cabin'):
        grey = (sat < 0.22) & solid
        walls = grey & (lum > 0.68)
        wall = WALL_ROOF[name][0] if kind == 'wallroof' else CABIN[name][0] if kind == 'cabin' else WALL_ONLY[name]
        out[walls] = (rgb[walls] * (np.array(wall) / 255)[None, :]) ** 0.9
        if kind in ('wallroof', 'cabin'):
            roofs = grey & (lum > 0.28) & (lum <= 0.68)
            out[roofs] = np.clip(rgb[roofs] / 0.5 * (np.array((WALL_ROOF if kind == 'wallroof' else CABIN)[name][1]) / 255)[None, :], 0, 1)
    else:  # brick: the red and orange parts take a new hue
        hue, s_mul, v_mul = BRICK[name]
        h = np.zeros_like(lum)
        d = np.maximum(mx - mn, 1e-6)
        r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
        h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
        brick = solid & (sat > 0.38) & ((h < 0.07) | (h > 0.95)) & (r > 0.35)
        ys, xs = np.nonzero(brick)
        for y, x in zip(ys, xs):
            out[y, x] = colorsys.hsv_to_rgb(hue, min(1, sat[y, x] * s_mul), min(1, mx[y, x] * v_mul))
    res = np.dstack([(out * 255).clip(0, 255), a[:, :, 3]]).astype(np.uint8)
    return Image.fromarray(res, 'RGBA')


# ---- Geometry ----
def seg_near(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    L = dx * dx + dy * dy
    t = 0 if L == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L))
    qx, qy = ax + t * dx, ay + t * dy
    return math.hypot(px - qx, py - qy), qx, qy


class World:
    def __init__(self, folder, base):
        self.W, self.H = base['width'], base['height']
        self.road = np.asarray(Image.open(os.path.join(folder, 'images', 'roads.png')).convert('RGBA'))[:, :, 3] > 0
        self.park = np.asarray(Image.open(os.path.join(folder, 'images', 'parks-and-fields.png')).convert('RGBA'))[:, :, 3] > 0
        self.roads = [(r['name'], [(r['points'][i], r['points'][i + 1]) for i in range(0, len(r['points']), 2)]) for r in base['roads']]
        self.keep_clear = [(c['customerX'], c['customerY'], 34) for c in base['curbSpots']] + [(c['x'], c['y'], 40) for c in base['curbSpots']]
        self.gas = [(g['pad']['x'], g['pad']['y'], max(g['pad']['length'], g['pad']['depth']) / 2 + 40) for g in base['gasStations']]
        self.keep_clear += self.gas
        self.buildings = {}   # object id -> rect
        self.things = []      # rects of ornaments placed this run and kept from before

    def nearest_road(self, x, y):
        best = None
        for name, pts in self.roads:
            for (ax, ay), (bx, by) in zip(pts, pts[1:]):
                d, qx, qy = seg_near(x, y, ax, ay, bx, by)
                if best is None or d < best[0]: best = (d, name, qx, qy)
        return best

    def zone(self, x, y, reach=None):
        d, name, qx, qy = self.nearest_road(x, y)
        if reach is not None and d > reach: return None
        return zone_of_street(name, qx)

    def any(self, mask, l, t, r, b):
        l, t, r, b = max(0, int(l)), max(0, int(t)), min(self.W, int(math.ceil(r))), min(self.H, int(math.ceil(b)))
        return bool(mask[t:b, l:r].any()) if r > l and b > t else True

    def inside(self, l, t, r, b): return l >= 4 and t >= 4 and r <= self.W - 4 and b <= self.H - 4

    def hits_building(self, rect, gap, skip=None):
        for oid, q in self.buildings.items():
            if oid != skip and not (rect[2] + gap <= q[0] or rect[0] - gap >= q[2] or rect[3] + gap <= q[1] or rect[1] - gap >= q[3]): return True
        return False

    def building_fits(self, rect, skip, loose=False, park_ok=False):
        pad, gap = (1, 3) if loose else (6, 12)
        return (self.inside(*rect) and not self.any(self.road, rect[0] - pad, rect[1] - pad, rect[2] + pad, rect[3] + pad)
                and (park_ok or not self.any(self.park, *rect)) and not self.hits_building(rect, gap, skip)
                and not any(rect[0] - r < x < rect[2] + r and rect[1] - r < y < rect[3] + r for x, y, r in self.gas))

    def thing_fits(self, rect, gap=3, on_road=False):
        if not self.inside(*rect): return False
        if not on_road and self.any(self.road, rect[0] - 1, rect[1] - 1, rect[2] + 1, rect[3] + 1): return False
        if self.any(self.park, *rect) or self.hits_building(rect, 2): return False
        for x, y, r in self.keep_clear:
            if rect[0] - r < x < rect[2] + r and rect[1] - r < y < rect[3] + r: return False
        for q in self.things:
            if not (rect[2] + gap <= q[0] or rect[0] - gap >= q[2] or rect[3] + gap <= q[1] or rect[1] - gap >= q[3]): return False
        return True


def weighted(rng, items):
    total = sum(w for _, w in items)
    v = rng.uniform(0, total)
    for it, w in items:
        v -= w
        if v <= 0: return it
    return items[-1][0]


# ---- The Tiled file ----
class Tmx:
    def __init__(self, path):
        self.path = path
        self.tree = ET.parse(path)
        self.root = self.tree.getroot()
        self.next_id = int(self.root.get('nextobjectid'))
        self.game = {}  # gid -> key, for the game's first tileset
        sets = self.root.findall('tileset')
        for t in sets[0].findall('tile'):
            self.game[int(sets[0].get('firstgid')) + int(t.get('id'))] = os.path.splitext(os.path.basename(t.find('image').get('source')))[0]
        self.new = next((s for s in sets if s.get('name') == NEW_SET), None)
        if self.new is None:
            self.new = ET.Element('tileset', dict(firstgid=str(NEW_FIRST_GID), name=NEW_SET, tilewidth='16', tileheight='16', tilecount='0',
                                                 columns='0', objectalignment='bottom'))
            ET.SubElement(self.new, 'grid', dict(orientation='orthogonal', width='1', height='1'))
            self.root.insert(list(self.root).index(sets[-1]) + 1, self.new)
        self.new_gid = {}
        for t in self.new.findall('tile'):
            k = os.path.splitext(os.path.basename(t.find('image').get('source')))[0]
            self.new_gid[k] = NEW_FIRST_GID + int(t.get('id'))
        self.layers = {g.get('name'): g for g in self.root.iter('objectgroup')}

    def prop(self, name, value=None):
        props = self.root.find('properties')
        for p in props:
            if p.get('name') == name:
                if value is not None: p.set('value', value)
                return p.get('value')
        if value is not None: ET.SubElement(props, 'property', dict(name=name, value=value))
        return value

    def layer(self, name, after):
        if name not in self.layers:
            g = ET.Element('objectgroup', dict(color='#ffffff', id=self.root.get('nextlayerid'), name=name))
            self.root.set('nextlayerid', str(int(self.root.get('nextlayerid')) + 1))
            self.root.insert(list(self.root).index(self.layers[after]) + 1, g)
            self.layers[name] = g
        return self.layers[name]

    def gid(self, key, w, h):
        if key not in self.new_gid:
            n = len(self.new.findall('tile'))
            t = ET.SubElement(self.new, 'tile', dict(id=str(n)))
            ET.SubElement(t, 'image', dict(source=f'{NEW_DIR}/{key}.png', width=str(w), height=str(h)))
            self.new_gid[key] = NEW_FIRST_GID + n
            self.new.set('tilecount', str(n + 1))
            self.new.set('tilewidth', str(max(int(self.new.get('tilewidth')), w)))
            self.new.set('tileheight', str(max(int(self.new.get('tileheight')), h)))
        return self.new_gid[key]

    def add(self, layer, key, w, h, x, y):
        o = ET.SubElement(self.layers[layer], 'object', dict(id=str(self.next_id), gid=str(self.gid(key, w, h)), x=f'{x:.1f}', y=f'{y:.1f}',
                                                              width=str(w), height=str(h)))
        self.next_id += 1
        return o

    def save(self):
        self.root.set('nextobjectid', str(self.next_id))
        ET.indent(self.tree, space=' ')
        self.tree.write(self.path, encoding='UTF-8', xml_declaration=True)


def rect_of(o):
    x, y, w, h = float(o.get('x')), float(o.get('y')), float(o.get('width')), float(o.get('height'))
    return (x - w / 2, y - h, x + w / 2, y)


def house_number(o):
    for p in o.iter('property'):
        if p.get('name') == 'house number': return int(p.get('value'))
    return None


def dress(folder, singles, zones):
    tmx = Tmx(os.path.join(folder, 'worcester-map.tmx'))
    done = [z for z in (tmx.prop('dressed') or '').split(',') if z]
    for z in zones:
        if z not in ZONES: sys.exit(f'unknown zone "{z}": use {", ".join(ZONES)}')
        if z in done: sys.exit(f'the {z} zone is already dressed in this Tiled file (rerunning would undo edits made since)')
    s = open(os.path.join(ROOT, 'src', 'config', 'worcester.ts'), encoding='utf-8').read()
    base = json.JSONDecoder().raw_decode(s[s.index('WORCESTER: WorcesterMap = ') + len('WORCESTER: WorcesterMap = '):])[0]
    world = World(folder, base)
    art = Art(folder, singles)
    sets = building_sets()
    tmx.layer('Street lamps', 'Trees')
    houses = [o for o in tmx.layers['Houses'].findall('object') if o.get('gid')]
    for o in houses: world.buildings[o.get('id')] = rect_of(o)
    for layer in ('Garden ornaments', 'Street lamps'):
        for o in tmx.layers[layer].findall('object'):
            if o.get('gid'): world.things.append(rect_of(o))

    for zone in zones:
        cfg = DECOR[zone]
        report = dict(houses=0, kept=0, ornaments_out=0, ornaments_in=0, street=0, trees=0, trees_out=0)
        # 1. Buildings
        mine = []
        used = {}  # house number -> (x, y, key, shape) of the building chosen, so neighbours differ
        todo = []
        for o in sorted(houses, key=lambda o: house_number(o) or 0):
            n = house_number(o)
            if n is None: continue  # home, or a piece with no number
            l, t, r, b = rect_of(o)
            d, name, qx, qy = world.nearest_road((l + r) / 2, (t + b) / 2)
            if zone_of_street(name, qx) != zone: continue
            dx, dy = qx - (l + r) / 2, qy - (t + b) / 2
            front = (0, 1 if dy > 0 else -1) if abs(dy) >= abs(dx) else (1 if dx > 0 else -1, 0)
            todo.append((o, (l, t, r, b), front))
            mine.append((o, front))
        colours = '|'.join(list(WALL_ROOF) + list(WALL_ONLY) + list(BRICK))

        def place(o, lot, front, cands, passes, rng, reach=520):
            """Puts the first building that fits on the lot: the edge that faces the street stays where the old
            house's was; if the lot is too tight, the building steps back from the street, then along it."""
            l, t, r, b = lot
            cx, cy = (l + r) / 2, (t + b) / 2
            n = house_number(o)
            park_ok = world.any(world.park, l, t, r, b)  # a house that already stands on a park's edge may stay there
            for strict, loose in passes:
                for piece in cands:
                    key, w, h = art.make(piece)
                    shape = re.sub(r'_(' + colours + r')$', '', key)
                    if strict and any(m != n and math.hypot(ux - cx, uy - cy) < 330 and (uk == key or (us == shape and math.hypot(ux - cx, uy - cy) < 190))
                                      for m, (ux, uy, uk, us) in used.items()): continue
                    for back in (0, 14, 28, 44, 70, 100, 140, 190, 250, 320):
                        for along in (0, -24, 24, -48, 48, -80, 80):
                            if front[1]:
                                bottom = (b if front[1] > 0 else t + h) - front[1] * back
                                x = cx + along
                            else:
                                x = (r - w / 2 if front[0] > 0 else l + w / 2) - front[0] * back
                                bottom = b + along
                            rect = (x - w / 2, bottom - h, x + w / 2, bottom)
                            if world.building_fits(rect, o.get('id'), loose, park_ok):
                                o.set('gid', str(tmx.gid(key, w, h))); o.set('width', str(w)); o.set('height', str(h))
                                o.set('x', f'{x:.1f}'); o.set('y', f'{bottom:.1f}')
                                world.buildings[o.get('id')] = rect
                                used[n] = (x, bottom - h / 2, key, shape)
                                return True
            # No room on the lot: the nearest free spot beside one of the neighbourhood's streets.
            near = sorted((math.hypot(ax - cx, ay - cy), ax, ay, nx, ny, m) for ax, ay, nx, ny, m in anchors if math.hypot(ax - cx, ay - cy) < reach)
            for strict in (True, False):
                for dist, ax, ay, nx, ny, m in near:
                    for piece in cands[:6]:
                        key, w, h = art.make(piece)
                        shape = re.sub(r'_(' + colours + r')$', '', key)
                        if strict and any(m2 != n and math.hypot(ux - ax, uy - ay) < 330 and uk == key for m2, (ux, uy, uk, us) in used.items()): continue
                        out = m + 16 + (w / 2) * abs(nx) + (h / 2) * abs(ny)
                        x, mid = ax + nx * out, ay + ny * out
                        rect = (x - w / 2, mid - h / 2, x + w / 2, mid + h / 2)
                        if world.building_fits(rect, o.get('id'), False, False):
                            o.set('gid', str(tmx.gid(key, w, h))); o.set('width', str(w)); o.set('height', str(h))
                            o.set('x', f'{x:.1f}'); o.set('y', f'{mid + h / 2:.1f}')
                            world.buildings[o.get('id')] = rect
                            used[n] = (x, mid, key, shape)
                            report['moved'] = report.get('moved', 0) + 1
                            return True
            return False

        # Spots beside this neighbourhood's streets, for buildings that have to move: (point on the street's middle, the way out, how far the grass is).
        anchors = []
        for name, pts in world.roads:
            if name == 'Newton Square': continue
            for (ax, ay), (bx, by) in zip(pts, pts[1:]):
                L = math.hypot(bx - ax, by - ay)
                for i in range(int(L // 30) + 1):
                    px, py = ax + (bx - ax) * (i * 30 / L), ay + (by - ay) * (i * 30 / L)
                    if zone_of_street(name, px) != zone: continue
                    for side in (1, -1):
                        nx, ny = -(by - ay) / L * side, (bx - ax) / L * side
                        for dist in range(30, 190, 2):
                            tx, ty = px + nx * dist, py + ny * dist
                            if not (0 <= int(tx) < world.W and 0 <= int(ty) < world.H): break
                            if not world.road[int(ty), int(tx)]: anchors.append((px, py, nx, ny, dist)); break

        # Round one: every lot gets one of the set's narrow buildings (these fit where the old houses stood).
        # Round two: where there is room, a lot trades up to one of the set's wide buildings.
        wide_words = {'small': (), 'apartments': ('corner', 'stone'), 'modern': ('modern_1', 'modern_2', 'modern_3', 'modern_4', 'modern_5', 'modern_6', 'slim', 'deck', 'garage')}[zone]
        narrow = [p for p in sets[zone] if not any(w in p[0] for w in wide_words)]
        wide = [p for p in sets[zone] if any(w in p[0] for w in wide_words)]
        placed = set()
        for o, lot, front in todo:
            rng = random.Random(f'{zone}-house-{house_number(o)}')
            cands = narrow[:]; rng.shuffle(cands)
            cands.sort(key=lambda p: 'cabin' in p[0])  # modern: the blocks first, a low house only where a block is too tall
            if place(o, lot, front, cands, ((True, False), (False, False), (False, True)), rng): placed.add(o.get('id'))
            else: report['kept'] += 1
        order = todo[:]
        random.Random(f'{zone}-wide').shuffle(order)
        for o, lot, front in order:
            if not wide or o.get('id') not in placed: continue
            rng = random.Random(f'{zone}-wide-{house_number(o)}')
            if zone == 'apartments' and rng.random() < 0.35: continue  # some lots keep their narrow building, for the mix
            cands = wide[:]; rng.shuffle(cands)
            if zone == 'modern': cands.sort(key=lambda p: rng.random() + (0.3 if 'deck' in p[0] or 'garage' in p[0] else 0))
            if place(o, lot, front, cands, ((True, False),), rng, 380 if zone == 'modern' else 0): report['wide'] = report.get('wide', 0) + 1
        report['houses'] = len(placed)

        # 2. The old ornaments of this neighbourhood go
        orn = tmx.layers['Garden ornaments']
        for o in list(orn.findall('object')):
            if not o.get('gid'): continue
            q = rect_of(o)
            if world.zone((q[0] + q[2]) / 2, q[3], ZONE_REACH) == zone:
                orn.remove(o); report['ornaments_out'] += 1
                if q in world.things: world.things.remove(q)

        # 3. Trees: the neighbourhood's kinds; none in front of or under a building
        tree_layer = tmx.layers['Trees']
        for o in list(tree_layer.findall('object')):
            if not o.get('gid'): continue
            x, y = float(o.get('x')), float(o.get('y'))
            if world.zone(x, y, ZONE_REACH) != zone: continue
            rng = random.Random(f'{zone}-tree-{o.get("id")}')
            hidden = any(q[0] - 26 < x < q[2] + 26 and q[1] - 8 < y < q[3] + 70 for q in world.buildings.values())
            if hidden or rng.random() > cfg['tree_keep']:
                tree_layer.remove(o); report['trees_out'] += 1; continue
            key, w, h = art.make(weighted(rng, cfg['trees']))
            o.set('gid', str(tmx.gid(key, w, h))); o.set('width', str(w)); o.set('height', str(h))
            report['trees'] += 1
        trunks = [(float(o.get('x')) - 10, float(o.get('y')) - 14, float(o.get('x')) + 10, float(o.get('y'))) for o in tree_layer.findall('object') if o.get('gid')]
        world.things += trunks

        def put(layer, piece, x, bottom, gap=3, foot=False):
            key, w, h = art.make(piece)
            rect = (x - w / 2, bottom - h, x + w / 2, bottom) if not foot else (x - 6, bottom - 10, x + 6, bottom)
            if not world.thing_fits(rect, gap): return False
            tmx.add(layer, key, w, h, x, bottom)
            world.things.append(rect)
            return True

        # 4. Along the streets: lamps and the rest, on the grass just past the sidewalk
        for name, pts in world.roads:
            if name == 'Newton Square': continue
            for piece, step, phase in cfg['street']:
                rng = random.Random(f'{zone}-street-{name}-{piece[0]}')
                travelled, k = -phase, 0
                for (ax, ay), (bx, by) in zip(pts, pts[1:]):
                    L = math.hypot(bx - ax, by - ay)
                    if L == 0: continue
                    ux, uy = (bx - ax) / L, (by - ay) / L
                    while travelled + step <= L:
                        travelled += step
                        px, py = ax + ux * travelled, ay + uy * travelled
                        if zone_of_street(name, px) != zone: continue
                        side = 1 if k % 2 == 0 else -1
                        k += 1
                        nx, ny = -uy * side, ux * side
                        m = None
                        for dist in range(30, 190, 2):  # walk out from the middle of the road to the grass
                            tx, ty = px + nx * dist, py + ny * dist
                            if not (0 <= int(tx) < world.W and 0 <= int(ty) < world.H): break
                            if not world.road[int(ty), int(tx)]: m = dist; break
                        if m is None: continue
                        off = m + 9 + rng.uniform(0, 3)
                        if put('Street lamps' if piece[0].startswith('lamp_') else 'Garden ornaments', piece, px + nx * off, py + ny * off + 5, gap=6, foot=True):
                            report['street'] += 1
                    travelled -= L

        # 5. By each building: a mailbox out front, things round the yard, sometimes a fence or hedge at the back
        for o, _ in mine:
            n = house_number(o)
            rng = random.Random(f'{zone}-yard-{n}')
            l, t, r, b = rect_of(o)
            _, _, qx, qy = world.nearest_road((l + r) / 2, (t + b) / 2)
            dx, dy = qx - (l + r) / 2, qy - (t + b) / 2
            front = (0, 1 if dy > 0 else -1) if abs(dy) >= abs(dx) else (1 if dx > 0 else -1, 0)
            w, h = r - l, b - t
            cx = (l + r) / 2
            # the mailbox: toward the street, to one side of the door
            fx, fy = (cx + rng.choice((-1, 1)) * min(w / 2 - 6, 30), b + 14) if front[1] >= 0 and front[0] == 0 else \
                     ((cx + rng.choice((-1, 1)) * (w / 2 + 12), b + 4) if front[0] == 0 else (l - 12 if front[0] < 0 else r + 12, b + 6))
            if put('Garden ornaments', rng.choice(cfg['yard']), fx, fy): report['ornaments_in'] += 1
            # a fence or hedge run along the back (the side away from the street), or along the foot when the street is behind
            if cfg['fence'] and rng.random() < cfg['fence'][2]:
                stem, fkey, _ = cfg['fence']
                fy2 = t - 8 if front[1] >= 0 else b + 26
                count = int((w + 40) // 16)
                x0 = cx - count * 8 + 8
                row = [(f'{fkey}_left', f'{stem}_Bottom_Left', None)] + [(f'{fkey}_middle', f'{stem}_Bottom_Middle', None)] * (count - 2) + [(f'{fkey}_right', f'{stem}_Bottom_Right', None)]
                rects = []
                for i, piece in enumerate(row):
                    key, pw, ph = art.make(piece)
                    rects.append((piece, x0 + i * 16, (x0 + i * 16 - pw / 2, fy2 - ph, x0 + i * 16 + pw / 2, fy2)))
                if all(world.thing_fits(q, gap=-1) for _, _, q in rects):
                    for piece, x, q in rects:
                        key, pw, ph = art.make(piece)
                        tmx.add('Garden ornaments', key, pw, ph, x, fy2); world.things.append(q); report['ornaments_in'] += 1
            # one bigger thing in the yard, beside or behind the building
            if rng.random() < cfg['big_chance']:
                piece = weighted(rng, cfg['big'])
                for _ in range(14):
                    side = rng.choice((-1, 1))
                    x = cx + side * (w / 2 + rng.uniform(26, 60))
                    y = rng.uniform(t + h * 0.45, b + 6) if front[0] == 0 else rng.uniform(t + h * 0.6, b + 30)
                    if put('Garden ornaments', piece, x, y, gap=6): report['ornaments_in'] += 1; break
            # small things round the building
            for _ in range(rng.randint(*cfg['yard_count'])):
                piece = weighted(rng, cfg['garden'])
                for _ in range(10):
                    where = rng.random()
                    if where < 0.5:    # along the foot of the building
                        x, y = rng.uniform(l - 6, r + 6), b + rng.uniform(4, 22)
                    elif where < 0.9:  # to the sides
                        x, y = rng.choice((l - rng.uniform(8, 34), r + rng.uniform(8, 34))), rng.uniform(t + h * 0.5, b + 14)
                    else:              # farther out in the yard
                        x, y = cx + rng.uniform(-w, w), b + rng.uniform(24, 60)
                    if put('Garden ornaments', piece, x, y): report['ornaments_in'] += 1; break
        for q in trunks:
            if q in world.things: world.things.remove(q)
        done.append(zone)
        print(f'{zone}: {report["houses"]} buildings changed, {report.get("wide", 0)} of them wide, {report.get("moved", 0)} moved off their lot ({report["kept"]} kept as they were: nothing in the set fitted the lot), '
              f'{report["ornaments_out"]} old ornaments out, {report["ornaments_in"]} new by the buildings, {report["street"]} along the streets, '
              f'{report["trees"]} trees changed, {report["trees_out"]} trees taken out')
    tmx.prop('dressed', ','.join(done))
    tmx.save()


if __name__ == '__main__':
    if len(sys.argv) < 4: sys.exit(__doc__)
    dress(sys.argv[1], sys.argv[2], sys.argv[3:])
