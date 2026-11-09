"""Brings the PO's hand-made maps from Tiled into the game: the tutorial map (SCREAM-158) and
Worcester (SCREAM-211; the Tiled file made by tools/tiled/export_tiled.py).

Usage (run from the repo root):
    python3 tools/tiled/import_tiled.py <map.tmx> <singles folder>

<map.tmx> is the PO's Tiled map (private art repo, tiled/tutorial-map/ or tiled/worcester-map/);
its "map" property (tutorial or worcester) says which map it is. <singles folder> is
LimeZu Modern Exteriors' 48x48 singles (the zip in the private art repo, unzipped): pieces
from the PO's own 16 px tilesets are looked up there by name when the 16 px file isn't at
hand (the 48 px files are exact 3x enlargements).

What it writes (Worcester: src/config/worcester.ts, public/assets/limezu/map/ and public/assets/map/;
then rebuild the residents without "tutorial"): src/config/tutorial.ts (the map data), public/assets/limezu/map-tutorial/
atlas.png + atlas.json (only the pictures the map uses) and public/assets/map-tutorial/roads_*.png
(the ground: roads, sidewalks and anything the PO painted). Then rebuild the residents:
    python3 tools/residents/build_residents.py build <Character_Generator folder> tutorial

How the Tiled file is read:
- Object layers: every visible piece is a map object, at the spot and with the picture the PO
  chose. Pieces from the game's own tileset ("Map pieces") keep their game names; other
  pieces are named by layer: Houses house_, Businesses shop_, Trees tree_, Street lamps lamp_,
  Fences fence_, everything else orn_ (residents walk round them).
- Houses: the "house number" property links residents (sheet 23's House column), and houses keep
  their numbers, gaps and all (the map's houseNumbers). Hidden houses, and houses on a
  "Removed houses" layer, are left out.
  The house marked "home" is the player's home.
- "House details" layers: a piece that overlaps a house is merged into that house's picture
  (in front if the layer is above Houses, behind if below). Pieces that touch no house stay
  as ornaments.
- Businesses: the object's name is the name painted on its sign.
- Tile layers and image layers (except grass, and "Parks and fields", which the game draws itself)
  make the ground, in layer order.
- Kept from the road data (locked in the Tiled file; built by tools/tiled/build_roads.py from
  tools/tutorial/roads.json, SCREAM-159): roads for driving, curb spots, potholes, parked cars,
  the truck's start, the gas station, street names.
"""
import base64, csv, gzip, hashlib, json, math, os, re, sys, zlib
import xml.etree.ElementTree as ET
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
# Where each map's data and pictures go (SCREAM-211: Worcester too).
MAPS = {
    'tutorial': dict(ts='tutorial.ts', export='TUTORIAL', art='map-tutorial', roads='map-tutorial',
                     residents=os.path.join('tools', 'tutorial', 'residents.csv'), sheet='sheet 23'),
    'worcester': dict(ts='worcester.ts', export='WORCESTER', art='map', roads='map',
                      residents=os.path.join('tools', 'residents', 'residents.csv'), sheet='sheet 15'),
}


def use_map(name):
    global OUT_TS, OUT_ART, OUT_ROADS, RESIDENTS_CSV, EXPORT, SHEET
    c = MAPS[name]
    OUT_TS = os.path.join(ROOT, 'src', 'config', c['ts'])
    OUT_ART = os.path.join(ROOT, 'public', 'assets', 'limezu', c['art'])
    OUT_ROADS = os.path.join(ROOT, 'public', 'assets', c['roads'])
    RESIDENTS_CSV = os.path.join(ROOT, c['residents'])
    EXPORT, SHEET = c['export'], c['sheet']


use_map('tutorial')
GROUND_TILE = 512
FLIP_H, FLIP_V, FLIP_D, FLIP_R = 0x80000000, 0x40000000, 0x20000000, 0x10000000
PREFIX = {'Houses': 'house_', 'Removed houses': 'house_', 'Businesses': 'shop_', 'Trees': 'tree_',
          'Street lamps': 'lamp_', 'Fences': 'fence_'}


def read_base():
    s = open(OUT_TS, encoding='utf-8').read()
    i = s.index(f'{EXPORT}: WorcesterMap = ') + len(f'{EXPORT}: WorcesterMap = ')
    return json.JSONDecoder().raw_decode(s[i:])[0]


class Tilesets:
    """Every tile picture the map uses, by global id, plus where it came from."""

    def __init__(self, tmx_dir, singles):
        self.tmx_dir, self.singles, self.sets = tmx_dir, singles, []
        self.cache, self.missing = {}, set()
        self.by48 = {}
        if singles and os.path.isdir(singles):
            for dp, _, fs in os.walk(singles):
                for f in fs:
                    if f.endswith('.png'): self.by48[f] = os.path.join(dp, f)

    def add(self, el):
        first = int(el.get('firstgid'))
        base_dir = self.tmx_dir
        if el.get('source'):
            path = os.path.normpath(os.path.join(self.tmx_dir, el.get('source').replace('\\', '/')))
            if not os.path.exists(path):
                self.missing.add(f'tileset {os.path.basename(path)} (pieces from it are left out)'); return
            el, base_dir = ET.parse(path).getroot(), os.path.dirname(path)
        name = el.get('name', '')
        align = el.get('objectalignment', 'unspecified')
        tiles = {}
        img = el.find('image')
        if img is not None:  # one sheet cut into tiles
            tw, th = int(el.get('tilewidth')), int(el.get('tileheight'))
            sp, mg = int(el.get('spacing', 0)), int(el.get('margin', 0))
            cols = int(el.get('columns') or 0) or 1
            for i in range(int(el.get('tilecount'))):
                c, r = i % cols, i // cols
                tiles[i] = ('sheet', os.path.join(base_dir, img.get('source')), (mg + c * (tw + sp), mg + r * (th + sp), tw, th))
        for t in el.findall('tile'):  # a collection of images
            im = t.find('image')
            if im is not None:
                tiles[int(t.get('id'))] = ('file', os.path.join(base_dir, im.get('source')), None)
        self.sets.append((first, name, align, tiles))

    def lookup(self, gid):
        g = gid & ~(FLIP_H | FLIP_V | FLIP_D | FLIP_R)
        for first, name, align, tiles in sorted(self.sets, reverse=True):
            if g >= first and (g - first) in tiles:
                return name, align, tiles[g - first], gid & (FLIP_H | FLIP_V | FLIP_D)
        return None

    def image(self, src):
        kind, path, box = src
        key = (path, box)
        if key in self.cache: return self.cache[key]
        path = path.replace('\\', '/')
        im = None
        if os.path.exists(path):
            im = Image.open(path).convert('RGBA')
        else:  # a 16 px pack file that isn't here: its 48 px twin, shrunk 3x
            f = os.path.basename(path)
            f = re.sub(r' - Copy( \(\d+\))?(?=\.png$)', '', f)  # a copy of a pack file: the original
            twin = self.by48.get(f.replace('16x16', '48x48')) or self.by48.get(f)
            if twin:
                im = Image.open(twin).convert('RGBA')
                if '16x16' in f or im.width > 0: im = im.resize((im.width // 3, im.height // 3), Image.NEAREST)
            else:
                self.missing.add(os.path.basename(path)); return None
        if box:
            im = im.crop((box[0], box[1], box[0] + box[2], box[1] + box[3]))
        self.cache[key] = im
        return im


def flipped(im, flags):
    if flags & FLIP_D: im = im.transpose(Image.TRANSPOSE)
    if flags & FLIP_H: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    if flags & FLIP_V: im = im.transpose(Image.FLIP_TOP_BOTTOM)
    return im


def props(el):
    p = el.find('properties')
    return {} if p is None else {q.get('name'): q.get('value', q.text) for q in p.findall('property')}


def walk_layers(el, out, visible=True):
    """The map's layers bottom to top, with group layers opened up."""
    for ch in el:
        if ch.tag not in ('layer', 'objectgroup', 'imagelayer', 'group'): continue
        vis = visible and ch.get('visible', '1') != '0'
        if ch.tag == 'group': walk_layers(ch, out, vis)
        else: out.append((ch, vis))


def main(tmx, singles):
    root = ET.parse(tmx).getroot()
    which = props(root).get('map', 'tutorial')
    if which not in MAPS: sys.exit(f'the Tiled map\'s "map" property is "{which}": expected one of {", ".join(MAPS)}')
    use_map(which)
    print(f'map: {which}')
    base = read_base()
    W, H = base['width'], base['height']
    ts = Tilesets(os.path.dirname(os.path.abspath(tmx)), singles)
    for el in root.findall('tileset'): ts.add(el)
    TW, TH = int(root.get('tilewidth')), int(root.get('tileheight'))
    layers = []; walk_layers(root, layers)
    warnings = []

    # ---- Ground: image layers (not grass) and painted tile layers, bottom to top ----
    ground = Image.new('RGBA', (W, H))
    for el, vis in layers:
        if not vis: continue
        if el.tag == 'imagelayer':
            img = el.find('image')
            lname = el.get('name', '').lower()
            if img is None or 'grass' in lname or lname.startswith('parks and fields') or el.get('repeatx') == '1': continue
            im = Image.open(os.path.join(os.path.dirname(os.path.abspath(tmx)), img.get('source'))).convert('RGBA')
            ground.alpha_composite(im.crop((0, 0, min(im.width, W), min(im.height, H))),
                                   (round(float(el.get('offsetx', 0))), round(float(el.get('offsety', 0)))))
        elif el.tag == 'layer':
            data = el.find('data')
            cols = int(el.get('width'))
            enc, comp = data.get('encoding'), data.get('compression')
            if enc == 'csv':
                gids = [int(v) for v in data.text.replace('\n', '').split(',') if v.strip()]
            elif enc == 'base64':
                raw = base64.b64decode(data.text.strip())
                if comp == 'zlib': raw = zlib.decompress(raw)
                elif comp == 'gzip': raw = gzip.decompress(raw)
                elif comp: sys.exit(f'tile layer {el.get("name")}: {comp} compression is not supported; '
                                    'set Map Properties > Tile Layer Format to CSV')
                gids = [int.from_bytes(raw[i:i + 4], 'little') for i in range(0, len(raw), 4)]
            else:
                gids = [int(t.get('gid', 0)) for t in data.findall('tile')]
            painted = 0
            for i, gid in enumerate(gids):
                if not gid: continue
                hit = ts.lookup(gid)
                if not hit: continue
                im = ts.image(hit[2])
                if im is None: continue
                im = flipped(im, hit[3])
                c, r = i % cols, i // cols
                ground.alpha_composite(im, (c * TW, (r + 1) * TH - im.height)) if c * TW < W and (r + 1) * TH - im.height < H else None
                painted += 1
            if painted: print(f'ground: {painted} tiles painted on "{el.get("name")}"')

    # ---- Objects ----
    def place(o, layer_name):
        """A tile object's picture and where its full picture sits on the map."""
        gid = int(o.get('gid'))
        hit = ts.lookup(gid)
        if not hit: return None
        set_name, align, src, flags = hit
        im = ts.image(src)
        if im is None: return None
        im = flipped(im, flags)
        w, h = float(o.get('width', im.width)), float(o.get('height', im.height))
        if (round(w), round(h)) != im.size: im = im.resize((max(1, round(w)), max(1, round(h))), Image.NEAREST)
        x, y = float(o.get('x')), float(o.get('y'))
        if align in ('unspecified', 'bottomleft'): left, top = x, y - h
        elif align == 'bottom': left, top = x - w / 2, y - h
        elif align == 'bottomright': left, top = x - w, y - h
        elif align == 'topleft': left, top = x, y
        elif align == 'top': left, top = x - w / 2, y
        elif align == 'center': left, top = x - w / 2, y - h / 2
        else: left, top = x, y - h
        # A turned piece (SCREAM-157): Tiled turns it clockwise round its anchor point. Turns close
        # to a quarter turn are snapped to it, so pixel art stays crisp; others are turned as they are.
        rot = float(o.get('rotation', 0)) % 360
        if rot > 0.5 and rot < 359.5:
            q = round(rot / 90) * 90
            if abs(rot - q) <= 10:
                notes['snapped'] = notes.get('snapped', 0) + 1
                rot = q % 360
            else:
                notes['turned'] = notes.get('turned', 0) + 1
            if rot:
                a = math.radians(rot)
                pts = [(cx - x, cy - y) for cx, cy in ((left, top), (left + w, top), (left, top + h), (left + w, top + h))]
                rp = [(px * math.cos(a) - py * math.sin(a), px * math.sin(a) + py * math.cos(a)) for px, py in pts]
                if rot in (90, 180, 270):
                    im = im.transpose({90: Image.ROTATE_270, 180: Image.ROTATE_180, 270: Image.ROTATE_90}[int(rot)])
                else:
                    im = im.rotate(-rot, resample=Image.NEAREST, expand=True)
                left, top = x + min(p[0] for p in rp), y + min(p[1] for p in rp)
                flags |= 1 << 8  # a picture of its own
        game = set_name.startswith('Map pieces')
        turned = bool(flags & (1 << 8)); flags &= ~(1 << 8)
        stem = os.path.splitext(os.path.basename(src[1]))[0]
        if game and not flags and not turned:
            key = stem
        else:
            name = re.sub(r'^(ME_Singles_|\d+_[A-Za-z_]+?_)', '', stem)
            name = re.sub(r'_(16x16|48x48)', '', name).lower()
            key = PREFIX.get(layer_name, 'orn_') + ('' if game else 'me_') + name + ('_f' if flags else '') + (f'_r{round(rot)}' if turned else '')
            if key.startswith(('house_house', 'shop_shop', 'tree_tree', 'lamp_lamp', 'fence_fence')): key = key.split('_', 1)[1]
            if game and stem.startswith(('house', 'villa')) and layer_name in ('Houses', 'Removed houses'): key = stem + ('_f' if flags else '')
        return {'im': im, 'left': left, 'top': top, 'key': key, 'name': o.get('name', ''), 'props': props(o),
                'game': game and not flags and not turned, 'stem': stem}

    houses, removed, details, others, flat = [], [], [], [], []
    notes = {}
    as_decor = {'Houses': 0, 'Businesses': 0}
    houses_z = None
    for z, (el, vis) in enumerate(layers):
        if el.tag != 'objectgroup': continue
        lname = el.get('name', '')
        if lname.startswith('Game markers'): continue
        objs = [o for o in el.findall('object') if o.get('gid')]
        if el.get('draworder', 'topdown') == 'topdown': objs.sort(key=lambda o: float(o.get('y')))
        for o in objs:
            hidden = not vis or o.get('visible', '1') == '0'
            if lname == 'Removed houses' or (lname == 'Houses' and hidden):
                if lname == 'Houses' or lname == 'Removed houses':
                    p = props(o)
                    if 'house number' in p: removed.append(int(p['house number']))
                continue
            if hidden: continue
            pc = place(o, lname)
            if not pc: continue
            pc['layer'], pc['z'] = lname, z
            # Flat things (SCREAM-157): pieces on "Flat ground" from the pack, and pack terrain
            # pieces (asphalt, paths) anywhere, are painted into the ground, under everyone.
            if (lname == 'Flat ground' and not pc['game']) or 'Terrains' in pc['stem']:
                flat.append(pc); continue
            # Only numbered houses (and home) are houses; other pieces on the Houses layer, and
            # unnamed pieces on Businesses, are decorations (mailboxes, shrubs, a bench).
            if lname == 'Houses' and 'house number' not in pc['props'] and pc['props'].get('home') != 'true':
                as_decor['Houses'] += 1; pc['layer'] = 'Garden ornaments'; pc['key'] = re.sub(r'^house_', 'orn_', pc['key'])
                if not pc['key'].startswith('orn_'): pc['key'] = 'orn_' + pc['key']
                others.append(pc); continue
            if lname == 'Businesses' and not pc['name'] and not pc['key'].startswith('shop_') or \
               lname == 'Businesses' and not pc['name'] and pc['key'].startswith('shop_me_'):
                as_decor['Businesses'] += 1; pc['layer'] = 'Garden ornaments'; pc['key'] = re.sub(r'^shop_', 'orn_', pc['key'])
                others.append(pc); continue
            if lname == 'Houses': houses.append(pc); houses_z = z
            elif lname.lower().startswith('house details'): details.append(pc)
            elif lname == 'Gas station': continue  # kept from the generated map
            else: others.append(pc)

    def box(pc):
        bb = pc['im'].getbbox() or (0, 0, 1, 1)  # where the visible picture is, on the map
        return (pc['left'] + bb[0], pc['top'] + bb[1], pc['left'] + bb[2], pc['top'] + bb[3])

    def overlap(a, b):
        return max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(0, min(a[3], b[3]) - max(a[1], b[1]))

    # House details: merged into the house they overlap most.
    for d in details:
        db = box(d)
        best = max(houses, key=lambda h: overlap(db, box(h)), default=None)
        if best is not None and overlap(db, box(best)) > 0:
            best.setdefault('parts', []).append(d)
        else:
            d['key'] = re.sub(r'^[a-z]+_', 'orn_', d['key']) if not d['key'].startswith('orn_') else d['key']
            others.append(d)

    # ---- Sprites: crop, merge, give each picture a key ----
    sprites = {}

    def sprite_of(pc):
        """Crops the piece to its picture, merges house parts, returns the map object."""
        im, left, top, key = pc['im'], pc['left'], pc['top'], pc['key']
        if pc.get('parts'):
            parts = [pc] + pc['parts']
            l = min(p['left'] for p in parts); t = min(p['top'] for p in parts)
            r = max(p['left'] + p['im'].width for p in parts); b = max(p['top'] + p['im'].height for p in parts)
            canvas = Image.new('RGBA', (round(r - l), round(b - t)))
            # Layers below Houses go behind the house, layers above go in front, in layer order.
            for p in sorted(parts, key=lambda p: (p['z'] if p is not pc else houses_z, 0 if p is pc else 1)):
                canvas.alpha_composite(p['im'], (round(p['left'] - l), round(p['top'] - t)))
            im, left, top = canvas, l, t
            n = pc['props'].get('house number') or ('home' if pc['props'].get('home') == 'true' else str(len(sprites)))
            key = f"{key}_m{n}"
        bb = im.getbbox() or (0, 0, 1, 1)
        im = im.crop(bb)
        old = sprites.get(key)
        if old is not None and (old.size != im.size or old.tobytes() != im.tobytes()):
            k = 2
            while f'{key}_{k}' in sprites and (sprites[f'{key}_{k}'].tobytes() != im.tobytes()): k += 1
            key = f'{key}_{k}'
        sprites[key] = im
        return {'key': key, 'x': round(left + bb[0] + im.width / 2, 1), 'y': round(top + bb[1] + im.height, 1)}

    home, numbered, unnumbered = None, [], []
    for h in houses:
        o = sprite_of(h)
        if h['props'].get('home') == 'true': home = o
        elif 'house number' in h['props']: numbered.append((int(h['props']['house number']), o))
        else: unnumbered.append(o)
    numbered.sort(key=lambda q: q[0])
    nums = [n for n, _ in numbered]
    if len(set(nums)) != len(nums):
        dup = sorted({n for n in nums if nums.count(n) > 1})
        sys.exit(f'house numbers used twice: {dup} (a copied house keeps its number; delete the copy or give it no number)')
    if unnumbered: warnings.append(f'{len(unnumbered)} house(s) with no house number: numbered from {max(nums, default=0) + 1}, no resident yet')
    if home is None: sys.exit('no house is marked as home')
    house_numbers = nums + list(range(max(nums, default=0) + 1, max(nums, default=0) + 1 + len(unnumbered)))

    rest = [sprite_of(pc) for pc in others]
    objects = [home] + [o for _, o in numbered] + unnumbered + rest

    # Business signs: the name is the object's name; the sign keeps its place on the shop front.
    base_shops = [o for o in base['objects'] if o['key'].startswith('shop_')]
    sign_off = {}
    for sg in base.get('signs', []):
        s = min(base_shops, key=lambda o: abs(o['x'] - sg['x']) + abs(o['y'] - sg['y']), default=None)
        if s: sign_off[sg['text']] = (sg['x'] - s['x'], sg['y'] - s['y'], sg['colour'], s['key'])
    signs = []
    for pc, o in zip(others, rest):
        if pc['layer'] != 'Businesses': continue
        name = pc['name']
        if name in sign_off:
            dx, dy, colour, was = sign_off[name]
            colour = pc['props'].get('sign colour', colour)
            if len(colour) == 9: colour = '#' + colour[3:]  # Tiled colours are #AARRGGBB
            signs.append({'text': name, 'x': round(o['x'] + dx, 1), 'y': round(o['y'] + dy, 1), 'colour': colour})
        elif name:
            warnings.append(f'business "{name}" has no sign position yet (new business): no name drawn')

    if math.hypot(home['x'] - base['homeStart']['x'], home['y'] - base['homeStart']['y']) > 400:
        warnings.append('home is far from where the truck starts (the start stays on the generated spot)')

    # Flat pieces into the ground, in layer order, top to bottom.
    for pc in sorted(flat, key=lambda q: (q['z'], q['top'] + q['im'].height)):
        ground.alpha_composite(pc['im'], (round(pc['left']), round(pc['top']))) if pc['left'] >= 0 and pc['top'] >= 0 else \
            ground.paste(Image.alpha_composite(ground.crop((round(pc['left']), round(pc['top']), round(pc['left']) + pc['im'].width,
                                                            round(pc['top']) + pc['im'].height)), pc['im']), (round(pc['left']), round(pc['top'])))
    if flat: print(f'ground: {len(flat)} flat pieces painted in (Flat ground layer, asphalt and paths)')
    if notes.get('snapped'): warnings.append(f'{notes["snapped"]} turned piece(s) were nearly a quarter turn: snapped to exactly 90 degrees')
    if notes.get('turned'): warnings.append(f'{notes["turned"]} piece(s) turned by an odd angle: turned as they are (pixels may look rough)')
    for layer, n in as_decor.items():
        if n: warnings.append(f'{n} piece(s) on the {layer} layer without a house number or business name: treated as decorations')

    # ---- Write the pictures ----
    for f in os.listdir(OUT_ROADS):
        if f.startswith('roads_') and f.endswith('.png'): os.remove(os.path.join(OUT_ROADS, f))
    road_tiles = []
    for ty in range(0, H, GROUND_TILE):
        for tx in range(0, W, GROUND_TILE):
            part = ground.crop((tx, ty, min(W, tx + GROUND_TILE), min(H, ty + GROUND_TILE)))
            if not part.getbbox(): continue
            key = f'roads_{tx // GROUND_TILE}_{ty // GROUND_TILE}'
            part.save(os.path.join(OUT_ROADS, key + '.png'), optimize=True)
            road_tiles.append({'key': key, 'x': tx, 'y': ty})

    pack = [{'key': k, 'im': im} for k, im in sprites.items()]
    pump = os.path.join(OUT_ART, 'pump.png')
    if os.path.exists(pump): pack.append({'key': 'pump', 'im': Image.open(pump).convert('RGBA')})
    ATLAS_W, PAD = 1024, 2
    x = y = row_h = 0
    for sp in sorted(pack, key=lambda q: (-q['im'].height, q['key'])):
        w, h = sp['im'].size
        if x + w > ATLAS_W: x, y, row_h = 0, y + row_h + PAD, 0
        sp['ax'], sp['ay'] = x, y
        x += w + PAD; row_h = max(row_h, h)
    atlas = Image.new('RGBA', (ATLAS_W, y + row_h))
    frames = {}
    for sp in pack:
        w, h = sp['im'].size
        atlas.paste(sp['im'], (sp['ax'], sp['ay']))
        frames[sp['key']] = {'frame': {'x': sp['ax'], 'y': sp['ay'], 'w': w, 'h': h}, 'rotated': False, 'trimmed': False,
                             'spriteSourceSize': {'x': 0, 'y': 0, 'w': w, 'h': h}, 'sourceSize': {'w': w, 'h': h}}
    atlas.save(os.path.join(OUT_ART, 'atlas.png'), optimize=True)
    json.dump({'frames': frames, 'meta': {'image': 'atlas.png', 'size': {'w': ATLAS_W, 'h': atlas.height}, 'scale': '1'}},
              open(os.path.join(OUT_ART, 'atlas.json'), 'w'), separators=(',', ':'))

    # SCREAM-160: a version that changes with the pictures, added to their URLs so browsers
    # never mix an old picture sheet with new map data.
    h = hashlib.sha1()
    for f in [os.path.join(OUT_ART, 'atlas.png'), os.path.join(OUT_ART, 'atlas.json')] + \
             [os.path.join(OUT_ROADS, t['key'] + '.png') for t in road_tiles]:
        h.update(open(f, 'rb').read())
    out = dict(base)
    out.update({'home': home, 'objects': objects, 'signs': signs,
                'sprites': [{'key': k, 'w': im.width, 'h': im.height} for k, im in sprites.items()],
                'houseNumbers': house_numbers, 'roadTiles': road_tiles, 'roadTileScale': 1,
                'assetVersion': h.hexdigest()[:10]})
    order = ['width', 'height', 'roads', 'labels', 'areas', 'homeStart', 'signs', 'home', 'gasStations', 'curbSpots',
             'potholes', 'parkedCars', 'objects', 'houseNumbers', 'sprites', 'roadTiles', 'roadTileScale', 'roadMask',
             'assetVersion']
    out = {k: out[k] for k in order if k in out}
    lines = ['// GENERATED by tools/tiled/import_tiled.py from the PO\'s Tiled map (SCREAM-158): edit the map in Tiled,',
             '// then rerun the script; don\'t edit this file. Street data (c) OpenStreetMap contributors (ODbL). Art: LimeZu.',
             '// Positions are in pixels from the top-left of the map; angles in degrees (0 = right, 90 = down).',
             '', "import type { WorcesterMap } from './mapTypes';", '',
             f'export const {EXPORT}: WorcesterMap = {json.dumps(out, separators=(",", ":"))};', '']
    open(OUT_TS, 'w', encoding='utf-8').write('\n'.join(lines))

    # ---- Residents: each lives in the house with their number (the names in Tiled: "House 27") ----
    if os.path.exists(RESIDENTS_CSV):
        for r in csv.DictReader(open(RESIDENTS_CSV, newline='', encoding='utf-8')):
            if r.get('House', '').strip() and int(r['House']) not in house_numbers:
                warnings.append(f'resident {r["ID"]} lives in house {r["House"]}, which is hidden or gone: '
                                f'give them another house in {SHEET}')

    kinds = {}
    for o in objects: kinds[o['key'].split('_')[0]] = kinds.get(o['key'].split('_')[0], 0) + 1
    print(f'{len(numbered)} houses + home ({len(removed)} removed), {len(objects)} objects {kinds}, '
          f'{sum(1 for h in houses if h.get("parts"))} houses with merged details, {len(sprites)} pictures, '
          f'{len(road_tiles)} ground images, {len(signs)} signs')
    if ts.missing: warnings.append('pictures not found (left out): ' + ', '.join(sorted(ts.missing)))
    for w in warnings: print('NOTE:', w)


if __name__ == '__main__':
    if len(sys.argv) < 2: sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
