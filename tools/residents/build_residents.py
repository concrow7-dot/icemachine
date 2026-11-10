"""Builds the neighbourhood's residents (SCREAM-59 people sprites, SCREAM-73 named residents).

Usage (run from the repo root):
    python3 tools/residents/build_residents.py seed            # map -> tools/residents/residents.csv (first time only)
    python3 tools/residents/build_residents.py build <folder>  # csv + map + art -> src/config/residents.ts + sprites
    python3 tools/residents/build_residents.py seed tutorial            # the tutorial map's 40 residents (SCREAM-146)
    python3 tools/residents/build_residents.py build <folder> tutorial  # -> src/config/tutorialResidents.ts + sprites
    python3 tools/residents/build_residents.py check [tutorial]  # no art needed, writes nothing: who would move?

check places everyone as build would and lists each resident whose street, door, yard or
curb would differ from the residents file in the repo (SCREAM-230). Run it before a build.

Roundabouts (a road with a "ring", SCREAM-145) are never anyone's street or curb: a
resident's street and curb come from the ordinary streets only. The ring is still road,
so nobody stands on it and no pink square is nearer to it than to its own street.

The tutorial map has its own residents sheet (doc 23, "Tutorial residents"), copied to
tools/tutorial/residents.csv ("sync tutorial residents"), with the same columns.

<folder> is LimeZu Modern Interiors' Character_Generator folder, from the private art
repo (icemachine-art/modern-interiors/2_Characters/Character_Generator).

residents.csv is a copy of the PO's residents sheet (doc 38, "Product Management
Decisions" folder). The sheet is the source of truth: edit the sheet, then copy it here
("sync residents") and run build. Columns:
    ID, Name, Age (Adult or Kid), Street, House, Likelihood (%), Look, Notes
Street is for reading only: it comes from the house. House is a number from 1 to the
number of houses (home not included). Look is any whole number; each one picks a
different combination of body, eyes, outfit, hair and accessory.

Each look is combined from the generator's layers (body, eyes, outfit, hairstyle,
accessory, in that order, as LimeZu's CHARACTER_GENERATOR.txt says), and only the idle
and walk rows are kept, shrunk to the pack's 16 px size (the 48 px files are exact 3x
enlargements). All the looks go in one image, public/assets/limezu/residents.png:
five looks across, two rows each (idle, then walk). In a row: right, up, left, down,
six frames each, 16 x 32 px.

PO decisions (November 2, 2026; Jira SCREAM-59, SCREAM-67, SCREAM-73; doc 37):
- Everyone appears on the map, has a name, a home, and their own chance of buying.
- About as many residents as houses. They stay near their home.
- The PO edits names and likelihoods in a sheet.
- Art: LimeZu Modern Interiors' character generator.
"""
import csv, json, math, os, random, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
MAP_TS = os.path.join(ROOT, 'src', 'config', 'worcester.ts')
CSV_PATH = os.path.join(HERE, 'residents.csv')
OUT_TS = os.path.join(ROOT, 'src', 'config', 'residents.ts')
OUT_PNG = os.path.join(ROOT, 'public', 'assets', 'limezu', 'residents.png')

ROAD_HALF, SIDEWALK = 60, 14          # as tools/worcester/build_map.py
LANE = 30                             # a lane's centre, from the road's centre line
CAR_CLEAR = 80                        # a curb spot's pink square stays this far from parked cars' centres (the game's PINK_CLEAR_CAR)
BAY_CLEAR = 100                       # ...and from pump bays and home's driveway (the game's PINK_CLEAR_BAY; SCREAM-143)
EDGE = ROAD_HALF + SIDEWALK           # from a road's centre line to the edge of its sidewalk


def half_of(road):
    """SCREAM-159: a street's half width: 60 px per lane each way (Park Ave on the tutorial map has 2)."""
    return ROAD_HALF * road.get('lanes', 1)
FRAME_W, FRAME_H = 16, 32             # one frame, at 16 px
FRAMES_PER_ROW = 24                   # 4 directions x 6 frames
LOOKS_ACROSS = 5
YARD_POINTS = 6
EXPORT = 'RESIDENTS'
TUTORIAL = False
HEADER = ['ID', 'Name', 'Age', 'Street', 'House', 'Likelihood (%)', 'Look', 'Notes']

# ---- Look recipes ----
# Left out: outfits 8, 22 and 33 look like work uniforms; 9, 23, 27 and 28 are costume
# hoods (some look like famous game characters). Bodies 6, 8 and 9 are grey, pink and blue
# skin, and hairstyles 27 to 29 come only in bright anime colours.
ADULT_OUTFITS_SKIP = {8, 9, 22, 23, 27, 28, 33}
ADULT_BODIES_SKIP = {6, 8, 9}
ADULT_HAIR_SKIP = {27, 28, 29}
# Everyday accessories only (no bee costume, police hat, zombie brain...).
ADULT_ACCESSORIES = ['04_Snapback', '05_Dino_Snapback', '11_Beanie', '12_Mustache', '13_Beard', '15_Glasses', '03_Backpack']
ACCESSORY_CHANCE = 0.3


def load_map():
    s = open(MAP_TS).read()
    return json.loads(s[s.index('= {') + 2:s.rindex('}') + 1])


def houses_of(m):
    """The houses residents live in, in map order, without the player's home."""
    home = m['home']
    sizes = {sp['key']: sp for sp in m['sprites']}
    out = []
    for o in m['objects']:
        if not o['key'].startswith(('house', 'villa')):
            continue
        if home and o['x'] == home['x'] and o['y'] == home['y']:
            continue
        sp = sizes[o['key']]
        out.append({'x': o['x'], 'y': o['y'], 'w': sp['w'], 'h': sp['h']})
    return out


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    t = 0 if L2 == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L2))
    cx, cy = ax + t * dx, ay + t * dy
    return math.hypot(px - cx, py - cy), (cx, cy)


def segments(m, rings=True):
    """Every road's segments as (name, ax, ay, bx, by); rings=False leaves out roundabouts."""
    for r in m['roads']:
        if not rings and r.get('ring'):
            continue
        p = r['points']
        for i in range(0, len(p) - 2, 2):
            yield r['name'], p[i], p[i + 1], p[i + 2], p[i + 3]


def nearest_road(segs, x, y):
    best = None
    for name, ax, ay, bx, by in segs:
        d, c = seg_dist(x, y, ax, ay, bx, by)
        if best is None or d < best[0]:
            best = (d, name, c)
    return best


def street_of(segs, h):
    return nearest_road(segs, h['x'], h['y'] - h['h'] / 2)[1]


# ---- seed: the first residents.csv, one resident per house ----
ADULT_FIRST = ['Maria', 'James', 'Linh', 'Kwame', 'Patricia', 'Tom', 'Rosa', 'Brendan', 'Ana', 'Mike', 'Dorota', 'Paul',
               'Grace', 'Luis', 'Kathleen', 'Hung', 'Denise', 'Carlos', 'Megan', 'Ama', 'Steve', 'Joanne', 'Arben',
               'Lucia', 'Dave', 'Thuy', 'Frank', 'Carmen', 'Sean', 'Elena', 'Kevin', 'Abena', 'Rich', 'Mai', 'Tony',
               'Nancy', 'Jorge', 'Erin', 'Kofi', 'Barbara', 'Marek', 'Sandra', 'Andre', 'Colleen', 'Duc', 'Gloria',
               'Pete', 'Fatima', 'Bill', 'Jen', 'Ramon', 'Diane', 'Ernesto', 'Theresa', 'Kim', 'Victor', 'Shannon',
               'Esi', 'Gary', 'Teresa', 'Danny', 'Helen', 'Raj', 'Liz', 'Paulo', 'Bridget', 'Sam', 'Adriana',
               'Chris', 'Monica']
KID_FIRST = ['Mason', 'Sofia', 'Liam', 'Ava', 'Noah', 'Isabella', 'Ethan', 'Mia', 'Lucas', 'Chloe', 'Jayden', 'Emma',
             'Kenny', 'Zoe', 'Mateo', 'Lily', 'Owen', 'Aaliyah', 'Bao', 'Nora', 'Kai', 'Gabby', 'Danny', 'Ella',
             'Leo', 'Maya', 'Tyler', 'Ruby', 'Elijah', 'Abby', 'Gianni', 'Hannah', 'Kojo', 'Ellie', 'Max', 'Layla',
             'Ryan', 'Ivy', 'Andy', 'Nia']
LAST = ['Sullivan', 'Nguyen', 'Mensah', 'Rodriguez', 'Kowalski', 'Murphy', 'Santos', "O'Brien", 'Tran', 'Rivera',
        'Asante', 'Shehu', 'Russo', 'Pham', 'Doherty', 'Gonzalez', 'Nowak', 'Boateng', 'Kelly', 'Le', 'Silva',
        'Moreau', 'Haddad', 'Costa', 'Walsh', 'Ortiz', 'Owusu', 'Gallagher', 'Vo', 'Morales', 'Lewandowski',
        'Ferreira', 'Brennan', 'Hoxha', 'Reyes', 'Quinn', 'Darko', 'Martins', 'Fitzgerald', 'Cruz', 'Patel',
        'Lombardi', 'Dube', 'Carroll', 'Ramirez', 'Barros', 'Flynn', 'Wisniewski', 'Torres', 'Kamara', 'Hogan',
        'Nunes', 'Delgado', 'Mahoney', 'Bui', 'Shea', 'Agyeman', 'DeMarco', 'Dinh', 'Kearney']


def seed():
    if os.path.exists(CSV_PATH):
        sys.exit(f'{CSV_PATH} already exists: it is the PO\'s sheet now. Delete it first to start over.')
    m = load_map()
    segs = list(segments(m, rings=False))
    rnd = random.Random(59)
    used = set()
    rows = []
    for i, h in enumerate(houses_of(m)):
        kid = rnd.random() < 1 / 3   # proposal agreed by the PO: about 1 in 3 residents are kids
        while True:
            name = f'{rnd.choice(KID_FIRST if kid else ADULT_FIRST)} {rnd.choice(LAST)}'
            if name not in used:
                used.add(name)
                break
        # Proposal: kids like ice cream more. Starting values; the PO tunes them in the sheet.
        likely = rnd.randrange(50, 100, 5) if kid else rnd.randrange(20, 75, 5)
        rows.append([f'R{i + 1:03d}', name, 'Kid' if kid else 'Adult', street_of(segs, h), i + 1, likely, i + 1, ''])
    with open(CSV_PATH, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(HEADER)
        w.writerows(rows)
    print(f'{len(rows)} residents written to {CSV_PATH}')


# ---- build ----
def read_csv():
    with open(CSV_PATH, newline='') as f:
        rows = list(csv.DictReader(f))
    out, seen = [], set()
    for n, r in enumerate(rows, start=2):
        def bad(msg):
            sys.exit(f'residents.csv line {n} ({r.get("ID")}): {msg}')
        rid = (r['ID'] or '').strip()
        if not rid:
            continue
        if rid in seen:
            bad('the same ID twice')
        seen.add(rid)
        age = (r['Age'] or '').strip().lower()
        if age not in ('adult', 'kid'):
            bad('Age must be Adult or Kid')
        try:
            house, likely, look = int(r['House']), float(str(r['Likelihood (%)']).rstrip('%')), int(r['Look'])
        except ValueError:
            bad('House, Likelihood (%) and Look must be numbers')
        if not 0 <= likely <= 100:
            bad('Likelihood (%) must be from 0 to 100')
        # SCREAM-189 (PO): an optional "Order size" column: blank is the usual random size.
        size = (r.get('Order size') or '').strip()
        if size and not (size.isdigit() and 1 <= int(size) <= 12):
            bad('Order size must be blank or a whole number from 1 to 12')
        person = {'id': rid, 'name': (r['Name'] or '').strip(), 'kid': age == 'kid', 'house': house,
                  'likelihood': likely / 100, 'look': look}
        if size:
            person['orderSize'] = int(size)
        # SCREAM-103 (PO, November 8): an optional "Hinted" column: Yes means other customers
        # sometimes point the player to this big regular (the lines are in tools/hints/).
        hinted = (r.get('Hinted') or '').strip().lower()
        if hinted not in ('', 'yes', 'no'):
            bad('Hinted must be Yes or blank')
        if hinted == 'yes':
            person['hinted'] = True
        out.append(person)
    return out


def layer(folder, sub, name):
    from PIL import Image
    return Image.open(os.path.join(folder, sub, '48x48', name)).convert('RGBA')


def recipe(folder, look, kid):
    """The layer files for a look number: the same number always gives the same person."""
    rnd = random.Random(look * 2 + (1 if kid else 0))
    ls = lambda sub: sorted(os.listdir(os.path.join(folder, sub, '48x48')))
    if kid:
        outfit = rnd.choice(ls('Outfits_kids'))
        hair = None if ('pajama' in outfit.lower()) else rnd.choice(ls('Hairstyles_kids'))
        return [('Bodies_kids', rnd.choice(ls('Bodies_kids'))), ('Eyes_kids', rnd.choice(ls('Eyes_kids'))),
                ('Outfits_kids', outfit)] + ([('Hairstyles_kids', hair)] if hair else [])
    outfits = [f for f in ls('Outfits') if int(f.split('_')[1]) not in ADULT_OUTFITS_SKIP]
    bodies = [f for f in ls('Bodies') if int(f.rsplit('_', 1)[1][:2]) not in ADULT_BODIES_SKIP]
    hair = [f for f in ls('Hairstyles') if int(f.split('_')[1]) not in ADULT_HAIR_SKIP]
    parts = [('Bodies', rnd.choice(bodies)), ('Eyes', rnd.choice(ls('Eyes'))),
             ('Outfits', rnd.choice(outfits)), ('Hairstyles', rnd.choice(hair))]
    if rnd.random() < ACCESSORY_CHANCE:
        acc = rnd.choice(ADULT_ACCESSORIES)
        # The red snapback (variant 01) looks like a famous game character's cap.
        options = [f for f in ls('Accessories') if f.startswith(f'Accessory_{acc}_') and f != 'Accessory_04_Snapback_48x48_01.png']
        parts.append(('Accessories', rnd.choice(options)))
    return parts


def compose(folder, parts):
    """Idle (row 1) and walk (row 2) of the layered character, at 16 px: 384 x 64."""
    from PIL import Image
    big = Image.new('RGBA', (FRAMES_PER_ROW * 48, 2 * 96))
    for sub, name in parts:
        im = layer(folder, sub, name)
        big.alpha_composite(im.crop((0, 96, FRAMES_PER_ROW * 48, 3 * 96)))
    return big.resize((big.width // 3, big.height // 3), Image.NEAREST)


def yard(m, segs, house, others, rnd):
    """Where a resident walks: a door on the side facing the street, and spots around the house.
    segs is every road (rings too: nobody stands on one); the house faces its own street."""
    x, y, w, h = house['x'], house['y'], house['w'], house['h']
    cx, cy = x, y - h / 2
    rings = {r['name'] for r in m['roads'] if r.get('ring')}
    _, _, (rx, ry) = nearest_road([sg for sg in segs if sg[0] not in rings], cx, cy)
    nx, ny = rx - cx, ry - cy
    L = math.hypot(nx, ny) or 1
    nx, ny = nx / L, ny / L
    halves = {r['name']: half_of(r) for r in m['roads']}
    near_segs = [sg for sg in segs if min(sg[1], sg[3]) - 400 < x < max(sg[1], sg[3]) + 400
                 and min(sg[2], sg[4]) - 400 < y < max(sg[2], sg[4]) + 400]
    near_houses = [o for o in others if abs(o['x'] - x) < 400 and abs(o['y'] - y) < 400]
    near_trees = [o for o in m['objects'] if o['key'].startswith(('tree', 'lamp')) and abs(o['x'] - x) < 400 and abs(o['y'] - y) < 400]  # SCREAM-52: and lamp posts
    # SCREAM-108: yard ornaments (mailboxes, planters, sheds); people walk round them.
    sizes = {sp['key']: sp for sp in m['sprites']}
    near_orns = [(o['x'], o['y'], sizes[o['key']]['w'], sizes[o['key']]['h']) for o in m['objects']
                 if o['key'].startswith('orn_') and abs(o['x'] - x) < 400 and abs(o['y'] - y) < 400]

    def feet_ok(px, py, standing=True):
        """A spot a person can stand on: off every road and sidewalk, not on a house, not on a
        tree trunk. Standing in front of or behind a house or tree is fine: the game draws
        front to back (SCREAM-104)."""
        if not (8 < px < m['width'] - 8 and 32 < py < m['height'] - 4):
            return False
        if any(seg_dist(px, py, *sg[1:])[0] < halves.get(sg[0], ROAD_HALF) + SIDEWALK + 4 for sg in near_segs):
            return False
        if any(o['x'] - o['w'] / 2 - 6 < px < o['x'] + o['w'] / 2 + 6 and o['y'] - o['h'] - 2 < py < o['y'] + 3
               for o in near_houses):
            return False
        # Nobody stands on an ornament, but walking past one is fine (drawn front to back).
        if standing and any(ox - ow / 2 - 4 < px < ox + ow / 2 + 4 and oy - oh - 2 < py < oy + 3 for ox, oy, ow, oh in near_orns):
            return False
        # Off tree trunks: people walk behind or in front of a tree, not through its trunk.
        return not any(abs(px - t['x']) < 11 and t['y'] - 14 < py < t['y'] + 4 for t in near_trees)

    def clear(a, b):
        """A straight walk from a to b that never crosses a house or a road."""
        steps = max(1, int(math.dist(a, b) // 4))
        return all(feet_ok(a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps, standing=False) for k in range(steps + 1))

    # The door: the sprites' doors are on the bottom (front) wall.
    door = (x, y + 4)
    if not feet_ok(*door):
        door = next(((x + dx, y + dy) for dy in (4, 10, 16) for dx in (0, -20, 20, -40, 40) if feet_ok(x + dx, y + dy)), door)
    pts = []
    for _ in range(600):
        if len(pts) >= YARD_POINTS:
            break
        # Around the front of the house and the side toward the street, never through it:
        # every walk (door to a spot, spot to spot) must go round, not across.
        base = math.atan2(ny, nx) if rnd.random() < 0.5 else math.pi / 2
        a = base + rnd.gauss(0, 0.9)
        r = rnd.uniform(6, 34)
        hx, hy = w / 2, h / 2
        s = min(hx / abs(math.cos(a)) if math.cos(a) else 1e9, hy / abs(math.sin(a)) if math.sin(a) else 1e9)
        p = (round(cx + math.cos(a) * (s + r), 1), round(cy + math.sin(a) * (s + r) + 16, 1))
        # Within 100 px of the door, so people stay near home even beside a big house (SCREAM-108).
        if (math.dist(door, p) <= 100 and feet_ok(*p) and all(math.dist(p, q) > 14 for q in pts)
                and clear(door, p) and all(clear(p, q) for q in pts)):
            pts.append(p)
    # SCREAM-108: a wide house with a small front lawn may leave no room in front; then try
    # beside it as well (only for these lots, so everyone else's yard stays as it was).
    for _ in range(600 if len(pts) < 2 else 0):
        if len(pts) >= 2:
            break
        a = rnd.choice((0.0, math.pi)) + rnd.gauss(0, 0.5)
        r = rnd.uniform(6, 30)
        s = min(w / 2 / abs(math.cos(a)) if math.cos(a) else 1e9, h / 2 / abs(math.sin(a)) if math.sin(a) else 1e9)
        p = (round(cx + math.cos(a) * (s + r), 1), round(cy + math.sin(a) * (s + r) + 16, 1))
        if (math.dist(door, p) <= 100 and feet_ok(*p) and all(math.dist(p, q) > 14 for q in pts)
                and clear(door, p) and all(clear(p, q) for q in pts)):
            pts.append(p)
    # Last resort for a tight lot: spots along the front of the house, either side of the door.
    for d in (18, -18, 30, -30, 42, -42, 54, -54):
        if len(pts) >= 2:
            break
        for e in (0, 4, 8):
            p = (round(door[0] + d, 1), round(door[1] + e, 1))
            if feet_ok(*p) and all(math.dist(p, q) > 14 for q in pts) and clear(door, p) and all(clear(p, q) for q in pts):
                pts.append(p)
                break
    return [round(door[0], 1), round(door[1], 1)], [c for p in pts for c in p]


def curb(m, segs, door, blocks):
    """Where a resident goes when they want ice cream (SCREAM-67): the nearest bit of
    sidewalk they can run to in a straight line from their door without crossing a
    house, with the pink pickup square in the curb lane beside them, clear of parked
    cars. Returns [stand x, stand y, square x, square y, road angle in degrees]."""
    near_blocks = [o for o in blocks if abs(o['x'] - door[0]) < 500 and abs(o['y'] - door[1]) < 500]
    # Segments as (road index, ax, ay, bx, by): the game matches a pink square to its street by index.
    idx_segs = [(ri, r['points'][i], r['points'][i + 1], r['points'][i + 2], r['points'][i + 3])
                for ri, r in enumerate(m['roads']) for i in range(0, len(r['points']) - 2, 2)]
    near_segs = [sg for sg in idx_segs if min(sg[1], sg[3]) - 500 < door[0] < max(sg[1], sg[3]) + 500
                 and min(sg[2], sg[4]) - 500 < door[1] < max(sg[2], sg[4]) + 500]

    def road_of(p):
        return min(near_segs, key=lambda sg: seg_dist(p[0], p[1], *sg[1:])[0])[0]

    def through_house(a, b):
        steps = max(1, int(math.dist(a, b) // 4))
        for k in range(steps + 1):
            px, py = a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps
            if any(o['x'] - o['w'] / 2 < px < o['x'] + o['w'] / 2 and o['y'] - o['h'] < py < o['y'] for o in near_blocks):
                return True
        return False

    mask = m['roadMask']

    def on_asphalt(px, py):
        # The same test as the game's RoadNetwork.onRoad: the drawn asphalt, rounded corners included.
        runs = mask['rows'][int(py // mask['scale'])] if 0 <= py < len(mask['rows']) * mask['scale'] else []
        col = int(px // mask['scale'])
        return any(runs[k] <= col < runs[k + 1] for k in range(0, len(runs), 2))

    def on_any_road(p, half):
        if any(on_asphalt(p[0] + dx, p[1] + dy) for dx in (-4, 0, 4) for dy in (-4, 0, 4)):
            return True
        return any(seg_dist(p[0], p[1], *sg[1:])[0] < half + half_of(m['roads'][sg[0]]) - ROAD_HALF for sg in near_segs)

    options = []
    for ri, ax, ay, bx, by in near_segs:
        if m['roads'][ri].get('ring'):
            continue  # SCREAM-230: nobody's curb is on a roundabout
        L = math.hypot(bx - ax, by - ay)
        if L < 1:
            continue
        tx, ty = (bx - ax) / L, (by - ay) / L
        d, (cx, cy) = seg_dist(door[0], door[1], ax, ay, bx, by)
        options.append((d, ax, ay, tx, ty, L, (cx - ax) * tx + (cy - ay) * ty, ri))
    options.sort()
    # Every rule first; if no spot passes, allow the run to cross a house (rare: a corner
    # lot); the pink square is always kept clear of parked cars, so the truck can fit.
    for strict in (True, False):
        for d, ax, ay, tx, ty, L, along, ri in options[:6]:
            for slide in (0, 25, -25, 50, -50, 80, -80, 120, -120, 160, -160):
                u = min(L - 30, max(30, along + slide)) if L > 60 else L / 2
                cx, cy = ax + tx * u, ay + ty * u
                # The side of the road the resident lives on.
                nx, ny = -ty, tx
                if (door[0] - cx) * nx + (door[1] - cy) * ny < 0:
                    nx, ny = -nx, -ny
                # Rounded as saved, so the game checks exactly this point (SCREAM-150).
                # SCREAM-159: on a wider street, the curb is further out and the square goes in the outside lane.
                half = half_of(m['roads'][ri])
                stand = (round(cx + nx * (half + SIDEWALK / 2), 1), round(cy + ny * (half + SIDEWALK / 2), 1))
                square = (cx + nx * (half - ROAD_HALF + LANE), cy + ny * (half - ROAD_HALF + LANE))
                if on_any_road(stand, ROAD_HALF + 2):
                    continue  # a corner: the sidewalk point is on another road
                if not on_asphalt(*square):
                    continue
                if any(math.dist(square, (c['x'], c['y'])) < CAR_CLEAR for c in m['parkedCars']):
                    continue
                # Off the gas stations' pump bays (SCREAM-109), so a customer never waits in one.
                if any(math.dist(square, (g['bay']['x'], g['bay']['y'])) < BAY_CLEAR for g in m.get('gasStations', [])):
                    continue
                # SCREAM-143: the same rules as the game's pinkSquareFits: off home's driveway, and
                # nearest to this street (not across a corner), so the truck can always pull in.
                if math.dist(square, (m['homeStart']['x'], m['homeStart']['y'])) < BAY_CLEAR:
                    continue
                if road_of(square) != ri:
                    continue
                if strict and through_house(door, stand):
                    continue
                return [round(stand[0], 1), round(stand[1], 1), round(square[0], 1), round(square[1], 1),
                        round(math.degrees(math.atan2(ty, tx)), 1)]
    sys.exit(f'No curb spot found near the door at {door}')


def blocks_of(m, houses):
    """Everything people must not walk through: the residents' houses and the player's home."""
    sizes = {sp['key']: sp for sp in m['sprites']}
    blocks = houses + ([{'x': m['home']['x'], 'y': m['home']['y'], 'w': sizes[m['home']['key']]['w'],
                         'h': sizes[m['home']['key']]['h']}] if m['home'] else [])
    # SCREAM-52 (tutorial map): shops, fences, the basketball court and the playground are walked round too.
    blocks += [{'x': o['x'], 'y': o['y'], 'w': sizes[o['key']]['w'], 'h': sizes[o['key']]['h']}
               for o in m['objects'] if o['key'].startswith(('shop_', 'fence_', 'court_', 'play_'))]
    return blocks


def place(m, people, index):
    """Everyone's street, door, yard and curb (no art needed)."""
    segs = list(segments(m))                   # every road: nobody stands on one
    streets = list(segments(m, rings=False))   # SCREAM-230: a street is never a roundabout
    houses = houses_of(m)
    blocks = blocks_of(m, houses)
    # SCREAM-158: a hand-made map (Tiled) keeps each house's own number, gaps and all.
    numbers = m.get('houseNumbers') or list(range(1, len(houses) + 1))
    by_number = dict(zip(numbers, houses))
    out = []
    for p in people:
        if p['house'] not in by_number:
            sys.exit(f'{p["id"]}: there is no house {p["house"]} on the map')
        h = by_number[p['house']]
        # SCREAM-230: each resident has their own random spots (seeded by their ID), so a
        # change to one person's yard no longer shifts everyone listed after them.
        door, pts = yard(m, segs, h, blocks, random.Random(f'73-{p["id"]}'))
        spot = curb(m, segs, door, blocks)
        out.append({'id': p['id'], 'name': p['name'], 'kid': p['kid'], 'street': street_of(streets, h),
                    'likelihood': p['likelihood'], 'look': index[(p['look'], p['kid'])],
                    'door': door, 'yard': pts, 'curb': spot,
                    **({'orderSize': p['orderSize']} if 'orderSize' in p else {}),
                    **({'hinted': True} if p.get('hinted') else {})})
    return out


def look_index(people):
    looks = sorted({(p['look'], p['kid']) for p in people})
    return looks, {k: i for i, k in enumerate(looks)}


def draw_looks(folder, looks, index):
    """One image of every look in use: public/assets/limezu/residents(-tutorial).png."""
    from PIL import Image
    rows = math.ceil(len(looks) / LOOKS_ACROSS)
    sheet = Image.new('RGBA', (LOOKS_ACROSS * FRAMES_PER_ROW * FRAME_W, rows * 2 * FRAME_H))
    for (look, kid), i in index.items():
        sheet.alpha_composite(compose(folder, recipe(folder, look, kid)),
                              ((i % LOOKS_ACROSS) * FRAMES_PER_ROW * FRAME_W, (i // LOOKS_ACROSS) * 2 * FRAME_H))
    os.makedirs(os.path.dirname(OUT_PNG), exist_ok=True)
    sheet.save(OUT_PNG, optimize=True)
    return f'{OUT_PNG} ({sheet.width}x{sheet.height})'


def build(folder):
    """folder is the Character_Generator folder, or --no-art to rewrite only the .ts file
    (fine when no Look or Age changed: residents.png stays as it is)."""
    m = load_map()
    people = read_csv()
    looks, index = look_index(people)
    png = 'no art drawn' if folder == '--no-art' else draw_looks(folder, looks, index)
    out = place(m, people, index)
    ts = ['// GENERATED by tools/residents/build_residents.py from ' + os.path.relpath(CSV_PATH, ROOT).replace(os.sep, '/'),
          ('// (a copy of the PO\'s Tutorial residents sheet, doc 23): edit the sheet, not this file.' if TUTORIAL else
           '// (a copy of the PO\'s residents sheet, doc 38): edit the sheet, not this file.'),
          '// Art: LimeZu Modern Interiors (limezu.itch.io).',
          '',
          "import type { Resident } from '../state/Residents';",
          '',
          *([] if TUTORIAL else [
          f'/** Looks across in residents.png; each look is two rows (idle, walk) of {FRAMES_PER_ROW} frames. */',
          f'export const RESIDENT_LOOKS_ACROSS = {LOOKS_ACROSS};',
          f'export const RESIDENT_FRAME = {{ width: {FRAME_W}, height: {FRAME_H} }};',
          '']),
          f'export const {EXPORT}: Resident[] = {json.dumps(out, separators=(",", ":"))};', '']
    open(OUT_TS, 'w').write('\n'.join(ts))
    few = [o['id'] for o in out if len(o['yard']) < 4]
    print(f'{len(out)} residents, {len(looks)} looks -> {OUT_TS}, {png}; '
          f'{len(few)} with under 2 yard spots: {few[:10]}')


def check():
    """SCREAM-230: who would move if build ran now? Compares with the residents file in the repo."""
    m = load_map()
    people = read_csv()
    _, index = look_index(people)
    s = open(OUT_TS).read()
    s = s[s.index(f'{EXPORT}: Resident[] = ') + len(f'{EXPORT}: Resident[] = '):]
    now = {r['id']: r for r in json.loads(s[:s.rindex(';')])}
    moved = 0
    for r in place(m, people, index):
        old = now.get(r['id'])
        if old is None:
            print(f'{r["id"]} {r["name"]}: new'); moved += 1
            continue
        diffs = [k for k in ('street', 'door', 'yard', 'curb') if old.get(k) != r[k]]
        if diffs:
            moved += 1
            what = ', '.join(f'street {old.get("street")} -> {r["street"]}' if k == 'street' else k for k in diffs)
            print(f'{r["id"]} {r["name"]}: {what}')
    print(f'{moved} of {len(people)} residents would change ({os.path.relpath(OUT_TS, ROOT)})')


def use_tutorial():
    global MAP_TS, CSV_PATH, OUT_TS, OUT_PNG, EXPORT, TUTORIAL
    MAP_TS = os.path.join(ROOT, 'src', 'config', 'tutorial.ts')
    CSV_PATH = os.path.join(ROOT, 'tools', 'tutorial', 'residents.csv')
    OUT_TS = os.path.join(ROOT, 'src', 'config', 'tutorialResidents.ts')
    OUT_PNG = os.path.join(ROOT, 'public', 'assets', 'limezu', 'residents-tutorial.png')
    EXPORT, TUTORIAL = 'TUTORIAL_RESIDENTS', True


def seed_tutorial():
    """SCREAM-146 (PO, November 4): about 40 residents on the tutorial map, spread over its houses,
    with the same mix as the main map (decision 033): a quarter every-day regulars (60-90%), half
    one day in 3 (15-35%), a quarter never (0%). New names and looks (201 up), not the main map's."""
    if os.path.exists(CSV_PATH):
        sys.exit(f'{CSV_PATH} already exists: it is the PO\'s sheet now. Delete it first to start over.')
    m = load_map()
    segs = list(segments(m, rings=False))
    houses = houses_of(m)
    rnd = random.Random(146)
    with open(os.path.join(HERE, 'residents.csv'), newline='') as f:
        used = {r['Name'] for r in csv.DictReader(f)}
    count = 40
    picks = sorted(rnd.sample(range(len(houses)), count))
    kinds = ['regular'] * 10 + ['sometimes'] * 20 + ['never'] * 10
    rnd.shuffle(kinds)
    rows = []
    for n, (i, kind) in enumerate(zip(picks, kinds)):
        kid = rnd.random() < 1 / 3
        while True:
            name = f'{rnd.choice(KID_FIRST if kid else ADULT_FIRST)} {rnd.choice(LAST)}'
            if name not in used:
                used.add(name)
                break
        likely = {'regular': rnd.randrange(60, 95, 5), 'sometimes': rnd.randrange(15, 40, 5), 'never': 0}[kind]
        rows.append([f'T{n + 1:03d}', name, 'Kid' if kid else 'Adult', street_of(segs, houses[i]), i + 1, likely, 201 + n, ''])
    with open(CSV_PATH, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(HEADER)
        w.writerows(rows)
    print(f'{len(rows)} residents written to {CSV_PATH}')


if __name__ == '__main__':
    if sys.argv[3:4] == ['tutorial'] or sys.argv[2:3] == ['tutorial']:
        use_tutorial()
    if sys.argv[1:2] == ['seed']:
        seed_tutorial() if TUTORIAL else seed()
    elif sys.argv[1:2] == ['build'] and len(sys.argv) >= 3:
        build(sys.argv[2])
    elif sys.argv[1:2] == ['check']:
        check()
    else:
        sys.exit(__doc__)
