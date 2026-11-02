"""Builds the neighbourhood's residents (SCREAM-59 people sprites, SCREAM-73 named residents).

Usage (run from the repo root):
    python3 tools/residents/build_residents.py seed            # map -> tools/residents/residents.csv (first time only)
    python3 tools/residents/build_residents.py build <folder>  # csv + map + art -> src/config/residents.ts + sprites

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
EDGE = ROAD_HALF + SIDEWALK           # from a road's centre line to the edge of its sidewalk
FRAME_W, FRAME_H = 16, 32             # one frame, at 16 px
FRAMES_PER_ROW = 24                   # 4 directions x 6 frames
LOOKS_ACROSS = 5
YARD_POINTS = 6
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


def segments(m):
    for r in m['roads']:
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
    segs = list(segments(m))
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
        out.append({'id': rid, 'name': (r['Name'] or '').strip(), 'kid': age == 'kid', 'house': house,
                    'likelihood': likely / 100, 'look': look})
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
    """Where a resident walks: a door on the side facing the street, and spots around the house."""
    x, y, w, h = house['x'], house['y'], house['w'], house['h']
    cx, cy = x, y - h / 2
    _, _, (rx, ry) = nearest_road(segs, cx, cy)
    nx, ny = rx - cx, ry - cy
    L = math.hypot(nx, ny) or 1
    nx, ny = nx / L, ny / L
    near_segs = [sg for sg in segs if min(sg[1], sg[3]) - 400 < x < max(sg[1], sg[3]) + 400
                 and min(sg[2], sg[4]) - 400 < y < max(sg[2], sg[4]) + 400]
    near_houses = [o for o in others if abs(o['x'] - x) < 400 and abs(o['y'] - y) < 400]
    near_trees = [o for o in m['objects'] if o['key'].startswith('tree') and abs(o['x'] - x) < 400 and abs(o['y'] - y) < 400]

    def feet_ok(px, py):
        """A spot a person can stand on: off every road and sidewalk, not on a house, not on a
        tree trunk. Standing in front of or behind a house or tree is fine: the game draws
        front to back (SCREAM-104)."""
        if not (8 < px < m['width'] - 8 and 32 < py < m['height'] - 4):
            return False
        if any(seg_dist(px, py, *sg[1:])[0] < EDGE + 4 for sg in near_segs):
            return False
        if any(o['x'] - o['w'] / 2 - 6 < px < o['x'] + o['w'] / 2 + 6 and o['y'] - o['h'] - 2 < py < o['y'] + 3
               for o in near_houses):
            return False
        # Off tree trunks: people walk behind or in front of a tree, not through its trunk.
        return not any(abs(px - t['x']) < 11 and t['y'] - 14 < py < t['y'] + 4 for t in near_trees)

    def clear(a, b):
        """A straight walk from a to b that never crosses a house or a road."""
        steps = max(1, int(math.dist(a, b) // 4))
        return all(feet_ok(a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps) for k in range(steps + 1))

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
        if feet_ok(*p) and all(math.dist(p, q) > 14 for q in pts) and clear(door, p) and all(clear(p, q) for q in pts):
            pts.append(p)
    return [round(door[0], 1), round(door[1], 1)], [c for p in pts for c in p]


def build(folder):
    from PIL import Image
    m = load_map()
    segs = list(segments(m))
    houses = houses_of(m)
    people = read_csv()
    rnd = random.Random(73)
    # Everything people must not walk through: the residents' houses and the player's home.
    sizes = {sp['key']: sp for sp in m['sprites']}
    blocks = houses + ([{'x': m['home']['x'], 'y': m['home']['y'], 'w': sizes[m['home']['key']]['w'],
                         'h': sizes[m['home']['key']]['h']}] if m['home'] else [])
    # One image of every look in use.
    looks = sorted({(p['look'], p['kid']) for p in people})
    index = {k: i for i, k in enumerate(looks)}
    rows = math.ceil(len(looks) / LOOKS_ACROSS)
    sheet = Image.new('RGBA', (LOOKS_ACROSS * FRAMES_PER_ROW * FRAME_W, rows * 2 * FRAME_H))
    for (look, kid), i in index.items():
        sheet.alpha_composite(compose(folder, recipe(folder, look, kid)),
                              ((i % LOOKS_ACROSS) * FRAMES_PER_ROW * FRAME_W, (i // LOOKS_ACROSS) * 2 * FRAME_H))
    os.makedirs(os.path.dirname(OUT_PNG), exist_ok=True)
    sheet.save(OUT_PNG, optimize=True)

    out = []
    for p in people:
        if not 1 <= p['house'] <= len(houses):
            sys.exit(f'{p["id"]}: House must be from 1 to {len(houses)}')
        h = houses[p['house'] - 1]
        door, pts = yard(m, segs, h, blocks, rnd)
        out.append({'id': p['id'], 'name': p['name'], 'kid': p['kid'], 'street': street_of(segs, h),
                    'likelihood': p['likelihood'], 'look': index[(p['look'], p['kid'])],
                    'door': door, 'yard': pts})
    ts = ['// GENERATED by tools/residents/build_residents.py from tools/residents/residents.csv',
          '// (a copy of the PO\'s residents sheet, doc 38): edit the sheet, not this file.',
          '// Art: LimeZu Modern Interiors (limezu.itch.io).',
          '',
          "import type { Resident } from '../state/Residents';",
          '',
          f'/** Looks across in residents.png; each look is two rows (idle, walk) of {FRAMES_PER_ROW} frames. */',
          f'export const RESIDENT_LOOKS_ACROSS = {LOOKS_ACROSS};',
          f'export const RESIDENT_FRAME = {{ width: {FRAME_W}, height: {FRAME_H} }};',
          '',
          f'export const RESIDENTS: Resident[] = {json.dumps(out, separators=(",", ":"))};', '']
    open(OUT_TS, 'w').write('\n'.join(ts))
    few = [o['id'] for o in out if len(o['yard']) < 4]
    print(f'{len(out)} residents, {len(looks)} looks -> {OUT_TS}, {OUT_PNG} ({sheet.width}x{sheet.height}); '
          f'{len(few)} with under 2 yard spots: {few[:10]}')


if __name__ == '__main__':
    if sys.argv[1:2] == ['seed']:
        seed()
    elif sys.argv[1:2] == ['build'] and len(sys.argv) == 3:
        build(sys.argv[2])
    else:
        sys.exit(__doc__)
