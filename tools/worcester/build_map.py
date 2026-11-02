"""Builds the Worcester driving map (SCREAM-10) from OpenStreetMap data and LimeZu art.

Usage (run from the repo root):
    python3 tools/worcester/build_map.py extract <map.osm>      # OSM export -> tools/worcester/worcester-osm.json
    python3 tools/worcester/build_map.py build <art-folder>     # json + LimeZu singles -> src/config/worcester.ts + sprites

<art-folder> is a folder of LimeZu Modern Exteriors 48x48 singles (from the private
art repo). Only the sprites the map uses are written to public/assets/limezu/map/,
shrunk to the pack's 16 px size (the 48 px files are exact 3x enlargements).

Street data (c) OpenStreetMap contributors, ODbL.

PO decisions (October 30, 2026; Jira SCREAM-10):
- The streets around June St, Pleasant St, Park Ave and Chandler St, with real names.
- Roads keep their real angles as straight segments (not a staircase on a tile grid).
- About twice as big as the old map.
"""
import json, math, os, random, re, sys
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OSM_JSON = os.path.join(HERE, 'worcester-osm.json')
OUT_TS = os.path.join(ROOT, 'src', 'config', 'worcester.ts')
OUT_ART = os.path.join(ROOT, 'public', 'assets', 'limezu', 'map')
OUT_ROADS = os.path.join(ROOT, 'public', 'assets', 'map')

# ---- Area ----
K = math.cos(math.radians(42.265))
LAT_MAX, LON_MIN = 42.2702, -71.8342
CORNERS = [(42.26980, -71.82530),   # Newton Square rotary (June, Pleasant, Highland)
           (42.26375, -71.81963),   # Pleasant St / Park Ave
           (42.26149, -71.82067),   # Park Ave / Chandler St
           (42.26408, -71.83378)]   # June St / Chandler St
ROTARY = CORNERS[0]
BOUNDARY = {'June Street', 'Pleasant Street', 'Park Avenue', 'Chandler Street'}
# Each boundary road runs between two corners (indexes into CORNERS).
BOUNDARY_ENDS = {'June Street': (3, 0), 'Pleasant Street': (0, 1), 'Park Avenue': (1, 2), 'Chandler Street': (2, 3)}
DRIVE = {'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link',
         'tertiary', 'tertiary_link', 'residential', 'unclassified', 'living_street'}

# ---- Scale ----
PX_PER_M = 4.6          # about twice the old map's size (PO)
MARGIN = 360            # px of scenery around the area
ROAD_HALF = 60          # two 60 px lanes, as on the old map (room for a U-turn)
SIDEWALK = 14
# Street corners are rounded with this radius (PO, testing PR #80: corners were too sharp).
CORNER_RADIUS = 48
# The road image and the road-edge map are made at half size (one pixel = 2 x 2 map pixels).
RASTER = 2
ROAD_TILE = 512   # road image tiles, in half-size pixels (1024 map pixels)
LANE = 30               # lane centre, from the road's centre line


def metres(lat, lon):
    return ((lon - LON_MIN) * K * 111320, (LAT_MAX - lat) * 111320)


def extract(osm_path):
    root = ET.parse(osm_path).getroot()
    nodes = {n.get('id'): (float(n.get('lat')), float(n.get('lon'))) for n in root.iter('node')}
    ways, areas = [], []
    for w in root.iter('way'):
        t = {x.get('k'): x.get('v') for x in w.findall('tag')}
        pts = [nodes[nd.get('ref')] for nd in w.findall('nd') if nd.get('ref') in nodes]
        pts = [[round(a, 7), round(b, 7)] for a, b in pts]
        if t.get('highway') in DRIVE:
            ways.append({'name': t.get('name', ''), 'roundabout': t.get('junction') == 'roundabout', 'pts': pts})
        elif t.get('leisure') in ('stadium', 'pitch', 'park', 'track') or t.get('amenity') == 'school':
            areas.append({'name': t.get('name', ''), 'kind': t.get('leisure') or t.get('amenity'), 'pts': pts})
    json.dump({'source': 'OpenStreetMap contributors, ODbL (openstreetmap.org/copyright)', 'ways': ways, 'areas': areas},
              open(OSM_JSON, 'w'), separators=(',', ':'))
    print('wrote', OSM_JSON, len(ways), 'ways', len(areas), 'areas')


# ---- Geometry helpers ----
def seg_dist(p, a, b):
    ax, ay = a; bx, by = b; px, py = p
    L2 = (bx - ax) ** 2 + (by - ay) ** 2
    t = 0 if L2 == 0 else max(0, min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / L2))
    return math.hypot(px - ax - t * (bx - ax), py - ay - t * (by - ay))


def inside(poly, pt):
    x, y = pt; c = False
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % len(poly)]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c


def near_poly(poly, pt, pad):
    if inside(poly, pt): return True
    return any(seg_dist(pt, poly[i], poly[(i + 1) % len(poly)]) < pad for i in range(len(poly)))


def dp(pts, tol):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; L = math.dist(a, b) or 1e-9
    ds = [abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / L for p in pts[1:-1]]
    i = max(range(len(ds)), key=ds.__getitem__)
    if ds[i] > tol: return dp(pts[:i + 2], tol)[:-1] + dp(pts[i + 1:], tol)
    return [a, b]


class Roads:
    """All road centre-line segments, with a grid for quick 'how far to the nearest road' lookups."""
    CELL = 160

    def __init__(self, pieces):
        self.segs = [(a, b, i) for i, (_, pts) in enumerate(pieces) for a, b in zip(pts, pts[1:])]
        self.grid = {}
        for k, (a, b, _) in enumerate(self.segs):
            x0, x1 = sorted((a[0], b[0])); y0, y1 = sorted((a[1], b[1]))
            for cx in range(int((x0 - 200) // self.CELL), int((x1 + 200) // self.CELL) + 1):
                for cy in range(int((y0 - 200) // self.CELL), int((y1 + 200) // self.CELL) + 1):
                    self.grid.setdefault((cx, cy), []).append(k)

    def dist(self, p, skip_piece=None):
        best = 1e9
        for k in self.grid.get((int(p[0] // self.CELL), int(p[1] // self.CELL)), []):
            a, b, i = self.segs[k]
            if i != skip_piece: best = min(best, seg_dist(p, a, b))
        return best


def build(art):
    from PIL import Image, ImageDraw
    random.seed(7)
    d = json.load(open(OSM_JSON))
    poly_m = [metres(*c) for c in CORNERS]
    rot_m = metres(*ROTARY)

    # 1. Streets inside the boundary (boundary roads up to their corners), in metres.
    def keep(name, p):
        if name not in BOUNDARY: return near_poly(poly_m, p, 6)
        # A boundary road: only between its two corners, however far it bows from the straight line.
        a, b = (poly_m[i] for i in BOUNDARY_ENDS[name])
        L = math.dist(a, b); t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / L
        return -8 <= t <= L + 8 and seg_dist(p, a, b) < 150

    pieces, clipped = [], []  # clipped: (piece index, end) where a street was cut at the boundary
    for w in d['ways']:
        if w['roundabout']: continue
        name = w['name']
        run, cut_before = [], False
        for lat, lon in w['pts']:
            p = metres(lat, lon)
            if keep(name, p):
                run.append(p)
            else:
                if len(run) > 1:
                    pieces.append([name, run]); clipped.append((cut_before, True))
                run, cut_before = [], True
        if len(run) > 1: pieces.append([name, run]); clipped.append((cut_before, False))
    keepers = [i for i, (n, r) in enumerate(pieces) if n and sum(math.dist(a, b) for a, b in zip(r, r[1:])) > 25]
    pieces = [pieces[i] for i in keepers]; clipped = [clipped[i] for i in keepers]
    # A street cut at the boundary line still reaches the boundary road (they bow outside the straight line).
    edges = [(a, b) for n, r in pieces if n in BOUNDARY for a, b in zip(r, r[1:])]
    for (name, run), ends in zip(pieces, clipped):
        if name in BOUNDARY: continue
        for idx, cut in zip((0, -1), ends):
            if not cut: continue
            e = run[idx]
            best = None
            for a, b in edges:
                L2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2
                t = max(0, min(1, ((e[0] - a[0]) * (b[0] - a[0]) + (e[1] - a[1]) * (b[1] - a[1])) / L2))
                q = (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]))
                if best is None or math.dist(e, q) < math.dist(e, best): best = q
            if best and 2 < math.dist(e, best) < 45:
                if idx == 0: run.insert(0, best)
                else: run.append(best)
    for piece in pieces:  # the tiny rotary becomes one junction
        for i in (0, -1):
            if math.dist(piece[1][i], rot_m) < 30: piece[1][i] = rot_m

    # 2. To pixels, simplified into straight segments.
    def px(p): return (round(p[0] * PX_PER_M + MARGIN, 1), round(p[1] * PX_PER_M + MARGIN, 1))
    pieces = [[n, [px(p) for p in dp(r, 3.5)]] for n, r in pieces]
    poly = [px(p) for p in poly_m]
    allpts = [p for _, r in pieces for p in r]
    W = int(max(p[0] for p in allpts) + MARGIN); H = int(max(p[1] for p in allpts) + MARGIN)
    roads = Roads(pieces)
    edge = ROAD_HALF + SIDEWALK

    # 3. Points along the roads, away from junctions: for customers, potholes and parked cars.
    def along(step, clear):
        out = []
        for i, (name, pts) in enumerate(pieces):
            for a, b in zip(pts, pts[1:]):
                L = math.dist(a, b)
                tx, ty = (b[0] - a[0]) / L, (b[1] - a[1]) / L
                for k in range(1, int(L // step) + 1):
                    p = (a[0] + tx * (k * step - step / 2), a[1] + ty * (k * step - step / 2))
                    if roads.dist(p, skip_piece=i) < clear: continue
                    if inside(poly, p) or any(seg_dist(p, poly[j], poly[(j + 1) % 4]) < 200 for j in range(4)):
                        out.append((name, p, (tx, ty)))
        return out

    def spread(cands, n, keep_away=(), gap=0):
        picked = []
        cands = [c for c in cands if all(math.dist(c[1], q) > gap for q in keep_away)]
        if not cands: return picked
        picked.append(cands[len(cands) // 2])
        while len(picked) < n:
            best = max(cands, key=lambda c: min(math.dist(c[1], q[1]) for q in picked))
            if min(math.dist(best[1], q[1]) for q in picked) < 150: break
            picked.append(best)
        return picked

    def r1(v): return round(v, 1)
    def angle(t): return r1(math.degrees(math.atan2(t[1], t[0])))

    # Home (proposal, PO to confirm): on Longfellow Road, in the middle of the area.
    home = None
    for name, p, t in along(60, 150):
        if name == 'Longfellow Road' and (home is None or abs(p[0] - (W / 2)) < abs(home[1][0] - (W / 2))):
            home = (name, p, t)
    hn = (-home[2][1], home[2][0])  # right-hand side of the direction of travel
    home_start = {'x': r1(home[1][0] + hn[0] * LANE), 'y': r1(home[1][1] + hn[1] * LANE), 'angle': angle(home[2])}

    curb = []
    for name, p, t in spread(along(90, 140), 34, keep_away=[(home_start['x'], home_start['y'])], gap=300):
        side = random.choice((1, -1))
        n = (-t[1] * side, t[0] * side)
        # On the sidewalk, 35 px from the pickup square (as on the old map), and not out on another road.
        cust = (p[0] + n[0] * (LANE + 35), p[1] + n[1] * (LANE + 35))
        if roads.dist(cust) < ROAD_HALF + 2: side = -side; n = (-n[0], -n[1]); cust = (p[0] + n[0] * (LANE + 35), p[1] + n[1] * (LANE + 35))
        if roads.dist(cust) < ROAD_HALF + 2: continue
        curb.append({'x': r1(p[0] + n[0] * LANE), 'y': r1(p[1] + n[1] * LANE), 'angle': angle(t),
                     'customerX': r1(cust[0]), 'customerY': r1(cust[1]), 'street': name})
    busy = [(c['x'], c['y']) for c in curb] + [(home_start['x'], home_start['y'])]
    holes = []
    for name, p, t in spread(along(70, 120), 14, keep_away=busy, gap=260):
        side = random.choice((1, -1))
        holes.append({'x': r1(p[0] - t[1] * side * LANE), 'y': r1(p[1] + t[0] * side * LANE)})
    busy += [(h['x'], h['y']) for h in holes]
    cars = []
    for name, p, t in spread(along(80, 150), 40, keep_away=busy, gap=220):
        side = random.choice((1, -1))
        cars.append({'x': r1(p[0] - t[1] * side * 40), 'y': r1(p[1] + t[0] * side * 40), 'angle': angle(t)})

    # 4. Street names: one label per ~900 px of street, on its longest straight stretches.
    labels = []
    by_name = {}
    for name, pts in pieces:
        for a, b in zip(pts, pts[1:]): by_name.setdefault(name, []).append((math.dist(a, b), a, b))
    for name, segs in by_name.items():
        total = sum(s[0] for s in segs)
        segs.sort(key=lambda s: -s[0])
        for L, a, b in segs[:max(1, min(3, int(total // 900)))]:
            if L < len(name) * 7: continue
            if any(math.dist(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), (l['x'], l['y'])) < 500 for l in labels if l['name'] == name): continue
            ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
            if ang > 90: ang -= 180
            if ang <= -90: ang += 180
            labels.append({'name': name, 'x': r1((a[0] + b[0]) / 2), 'y': r1((a[1] + b[1]) / 2), 'angle': r1(ang)})

    # 5. Parks and fields from OSM, drawn as green areas.
    areas = []
    for a in d['areas']:
        pts = [px(metres(*p)) for p in a['pts']]
        if len(pts) < 4: continue
        if max(p[0] for p in pts) < 0 or min(p[0] for p in pts) > W or max(p[1] for p in pts) < 0 or min(p[1] for p in pts) > H: continue
        areas.append({'name': a['name'], 'kind': a['kind'], 'points': [c for p in pts[:-1] for c in (r1(p[0]), r1(p[1]))]})

    # 6. The road surface, with rounded corners: widen every road by the corner
    # radius, then shrink it back. Straight curbs stay put; sharp inside corners
    # fill in with a curve. Done for the asphalt, the curb and the sidewalk.
    import numpy as np
    from scipy import ndimage
    W2, H2 = (W + RASTER - 1) // RASTER, (H + RASTER - 1) // RASTER
    lines = Image.new('L', (W2, H2), 255)
    ld = ImageDraw.Draw(lines)
    for _, pts in pieces:
        ld.line([(x / RASTER, y / RASTER) for x, y in pts], fill=0, width=1)
    to_centre = ndimage.distance_transform_edt(np.array(lines) > 0) * RASTER
    def rounded(half, radius):
        widened = to_centre <= half + radius
        return ndimage.distance_transform_edt(widened) * RASTER >= radius
    # The curb and sidewalk follow the asphalt's curve (same centre, so a smaller radius).
    asphalt = rounded(ROAD_HALF, CORNER_RADIUS)
    curb_mask = rounded(ROAD_HALF + 3, CORNER_RADIUS - 3)
    sidewalk_mask = rounded(edge, CORNER_RADIUS - SIDEWALK)
    img = np.zeros((H2, W2, 4), np.uint8)
    img[sidewalk_mask] = (0xd6, 0xd0, 0xc7, 255)
    img[curb_mask] = (0x7a, 0x74, 0x70, 255)
    img[asphalt] = (0x53, 0x4f, 0x52, 255)
    os.makedirs(OUT_ROADS, exist_ok=True)
    for f in os.listdir(OUT_ROADS):
        if f.startswith('roads_'): os.remove(os.path.join(OUT_ROADS, f))
    road_tiles = []
    for ty in range(0, H2, ROAD_TILE):
        for tx in range(0, W2, ROAD_TILE):
            part = img[ty:ty + ROAD_TILE, tx:tx + ROAD_TILE]
            if not part[:, :, 3].any(): continue
            key = f'roads_{tx // ROAD_TILE}_{ty // ROAD_TILE}'
            Image.fromarray(part, 'RGBA').save(os.path.join(OUT_ROADS, key + '.png'), optimize=True)
            road_tiles.append({'key': key, 'x': tx * RASTER, 'y': ty * RASTER})
    # The road-edge map: for each half-size row, the runs of asphalt as [start, end) pairs.
    road_rows = []
    for row in asphalt:
        edges = np.flatnonzero(np.diff(np.concatenate(([0], row.astype(np.int8), [0]))))
        road_rows.append(edges.tolist())
    def on_sidewalk_or_road(x, y):
        x2, y2 = int(x // RASTER), int(y // RASTER)
        return 0 <= x2 < W2 and 0 <= y2 < H2 and bool(sidewalk_mask[y2, x2])

    # 7. Sprites, shrunk to 16 px, and houses and trees placed on the lawns.
    os.makedirs(OUT_ART, exist_ok=True)
    def sprite(src, key):
        im = Image.open(os.path.join(art, src)).convert('RGBA')
        im = im.resize((im.width // 3, im.height // 3), Image.NEAREST)
        im = im.crop(im.getbbox()); im.save(os.path.join(OUT_ART, key + '.png'), optimize=True)
        return {'key': key, 'w': im.width, 'h': im.height}
    houses = [sprite(f'ME_Singles_Camping_48x48_Mobile_House_Small_{i}.png', f'house_small_{i}') for i in (1, 3, 5, 7)]
    villas = [sprite(f'ME_Singles_Villas_48x48_Villa_{i}.png', f'villa_{i}') for i in range(1, 6)]
    trees = [sprite(f'ME_Singles_Villas_48x48_Tree_{i}.png', f'tree_{i}') for i in range(1, 5)]
    grass = Image.new('RGBA', (64, 64))
    for gx in range(4):
        for gy in range(4):
            g = Image.open(os.path.join(art, f'ME_Singles_Terrains_and_Fences_48x48_Grass_1_{random.choice((9, 10, 11, 12, 22, 22))}.png')).convert('RGBA')
            grass.paste(g.resize((16, 16), Image.NEAREST), (gx * 16, gy * 16))
    grass.save(os.path.join(OUT_ART, 'grass.png'), optimize=True)

    placed = []  # (left, top, right, bottom)
    def fits(cx, bottom, w, h, gap=6):
        l, t, r, b = cx - w / 2 - gap, bottom - h - gap, cx + w / 2 + gap, bottom + gap
        if l < 0 or t < 0 or r > W or b > H: return False
        if any(not (r < q[0] or l > q[2] or b < q[1] or t > q[3]) for q in placed): return False
        for x in range(int(l), int(r) + 1, 8):
            for y in (t, b, (t + b) / 2):
                if on_sidewalk_or_road(x, y): return False
        for y in range(int(t), int(b) + 1, 8):
            for x in (l, r):
                if on_sidewalk_or_road(x, y): return False
        for a in areas:
            if inside(list(zip(a['points'][::2], a['points'][1::2])), (cx, bottom - h / 2)) or inside(list(zip(a['points'][::2], a['points'][1::2])), (cx, bottom)): return False
        return True
    objects = []
    def put(sp, cx, bottom):
        placed.append((cx - sp['w'] / 2, bottom - sp['h'], cx + sp['w'] / 2, bottom))
        objects.append({'key': sp['key'], 'x': r1(cx), 'y': r1(bottom)})

    # Home: the first house that fits beside the start, on the right-hand side of the road.
    home_obj = None
    t = home[2]
    for sp in (villas[0], houses[2]):
        for along_by in (0, 40, -40, 80, -80, 120, -120, 160, -160, 200, -200):
            for depth in (8, 20, 34):
                cx = home[1][0] + t[0] * along_by + hn[0] * (edge + depth + sp['w'] / 2 * abs(hn[0]))
                cy = home[1][1] + t[1] * along_by + hn[1] * (edge + depth + sp['h'] / 2 * abs(hn[1])) + sp['h'] / 2
                if home_obj is None and fits(cx, cy, sp['w'], sp['h']):
                    put(sp, cx, cy); home_obj = objects[-1]
    for name, pts in pieces:  # houses facing each street, both sides
        for a, b in zip(pts, pts[1:]):
            L = math.dist(a, b); t = ((b[0] - a[0]) / L, (b[1] - a[1]) / L)
            for k in range(int(L // 70)):
                p = (a[0] + t[0] * (k * 70 + 35), a[1] + t[1] * (k * 70 + 35))
                for side in (1, -1):
                    n = (-t[1] * side, t[0] * side)
                    sp = random.choice(villas) if random.random() < 0.12 else random.choice(houses)
                    for depth in (8, 20, 34):
                        cx = p[0] + n[0] * (edge + depth + sp['w'] / 2 * abs(n[0]))
                        cy = p[1] + n[1] * (edge + depth + sp['h'] / 2 * abs(n[1])) + sp['h'] / 2
                        if fits(cx, cy, sp['w'], sp['h']):
                            put(sp, cx, cy); break
    for _ in range(9000):  # trees on what's left
        sp = random.choice(trees)
        cx, cy = random.uniform(0, W), random.uniform(0, H)
        if fits(cx, cy, sp['w'] * 0.7, sp['h'] * 0.8, gap=0): put(sp, cx, cy)

    # 8. SCREAM-108 (PO, November 2): variety. Every house keeps its lot and its place in
    # the list (the residents sheet numbers houses in map order), but the house standing on
    # it is picked from every style in the pack that fits there (mobile homes in three sizes,
    # Victorian houses, terraced houses, villas), some in new colours, and yards get garden
    # ornaments. Its own random numbers, so steps 1 to 7 come out exactly as before.
    vr = random.Random(108)
    by_name = {f.replace('_48x48', ''): f for f in os.listdir(art) if f.endswith('.png')}
    def art_file(name):
        return by_name[name + '.png']
    # (wall colour, roof colour) schemes painted onto a house's pale walls and its grey roof.
    PALETTES = [((255, 236, 196), (168, 62, 50)),   # cream walls, brick-red roof
                ((206, 238, 214), (52, 102, 70)),   # mint walls, green roof
                ((206, 226, 250), (48, 70, 120)),   # sky-blue walls, navy roof
                ((250, 214, 222), (110, 74, 60)),   # pink walls, brown roof
                ((250, 240, 170), (70, 92, 128)),   # butter-yellow walls, slate-blue roof
                ((226, 214, 244), (64, 60, 70))]    # lavender walls, charcoal roof
    def recolour(sp, key, palette):
        """A copy of a house with new wall and roof colours. Only greys are painted (pale ones are
        walls, darker ones roof), keeping their shading; windows, doors and outlines stay."""
        wall, roof = palette
        im = Image.open(os.path.join(OUT_ART, sp['key'] + '.png')).convert('RGBA')
        a = np.asarray(im).astype(np.float32)
        rgb = a[:, :, :3] / 255
        mx, mn = rgb.max(axis=2), rgb.min(axis=2)
        sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
        lum = rgb.mean(axis=2)
        grey = (sat < 0.22) & (a[:, :, 3] > 0)
        walls, roofs = grey & (lum > 0.68), grey & (lum > 0.28) & (lum <= 0.68)
        out = rgb.copy()
        out[walls] = (rgb[walls] * (np.array(wall) / 255)[None, :]) ** 0.9
        out[roofs] = np.clip(rgb[roofs] / 0.5 * (np.array(roof) / 255)[None, :], 0, 1)
        res = np.dstack([(out * 255).clip(0, 255), a[:, :, 3]]).astype(np.uint8)
        Image.fromarray(res, 'RGBA').save(os.path.join(OUT_ART, key + '.png'), optimize=True)
        return {'key': key, 'w': sp['w'], 'h': sp['h']}
    families = {
        'small': houses + [sprite(art_file(f'ME_Singles_Camping_Mobile_House_Small_{i}'), f'house_small_{i}') for i in (2, 4, 6, 8)],
        'medium': [sprite(art_file(f'ME_Singles_Camping_Mobile_House_Medium_{i}'), f'house_medium_{i}') for i in range(1, 9)],
        'big': [sprite(art_file(f'ME_Singles_Camping_Mobile_House_Big_{i}'), f'house_big_{i}') for i in range(1, 9)],
        'victorian': [sprite(art_file(f'24_Additional_Houses_Victorian_House_{i}'), f'house_victorian_{i}') for i in range(1, 8)],
        'terraced': [sprite(art_file(f'24_Additional_Houses_Terraced_House_{i}'), f'house_terraced_{i}') for i in range(1, 7)],
        'villa': villas,
    }
    # Each house in its own colours plus three of the schemes above.
    for fam, sps in families.items():
        sps += [recolour(sp, f"{sp['key']}_c{n}", PALETTES[n]) for sp in list(sps) for n in sorted(vr.sample(range(len(PALETTES)), 3))]
    house_sprites = [sp for sps in families.values() for sp in sps]
    size = {sp['key']: sp for sp in house_sprites + trees}

    def rect(o, sp=None):
        sp = sp or size[o['key']]
        return (o['x'] - sp['w'] / 2, o['y'] - sp['h'], o['x'] + sp['w'] / 2, o['y'])
    def overlaps(a, b, gap=0):
        return not (a[2] + gap < b[0] or a[0] - gap > b[2] or a[3] + gap < b[1] or a[1] - gap > b[3])
    def lawn_ok(l, t, r, b):
        """Off roads, sidewalks, parks and fields, and on the map."""
        if l < 0 or t < 0 or r > W or b > H: return False
        for x in range(int(l), int(r) + 1, 8):
            for y in (t, b, (t + b) / 2):
                if on_sidewalk_or_road(x, y): return False
        for y in range(int(t), int(b) + 1, 8):
            for x in (l, r):
                if on_sidewalk_or_road(x, y): return False
        for a in areas:
            poly = list(zip(a['points'][::2], a['points'][1::2]))
            if inside(poly, ((l + r) / 2, (t + b) / 2)) or inside(poly, ((l + r) / 2, b)): return False
        return True
    def road_side(o):
        """Which way the nearest road is from a house: 'down', 'up', 'left' or 'right'."""
        sp = size[o['key']]; cx, cy = o['x'], o['y'] - sp['h'] / 2
        best = None
        for _, pts in pieces:
            for a, b in zip(pts, pts[1:]):
                vx, vy = b[0] - a[0], b[1] - a[1]; L2 = vx * vx + vy * vy or 1
                t2 = max(0, min(1, ((cx - a[0]) * vx + (cy - a[1]) * vy) / L2))
                px, py = a[0] + t2 * vx, a[1] + t2 * vy
                d = math.hypot(px - cx, py - cy)
                if best is None or d < best[0]: best = (d, px - cx, py - cy)
        _, dx, dy = best
        return ('down' if dy > 0 else 'up') if abs(dy) >= abs(dx) else ('right' if dx > 0 else 'left')

    lots = [i for i, o in enumerate(objects) if o['key'].startswith(('house', 'villa')) and o is not home_obj]
    house_idx = [i for i, o in enumerate(objects) if o['key'].startswith(('house', 'villa'))]
    for i in lots:
        o = objects[i]
        old = rect(o)
        side = road_side(o)
        others = [rect(objects[j]) for j in house_idx if j != i]
        def placed_at(sp):
            """Where `sp` stands on this lot: its front edge stays where the old house's was."""
            l, t, r, b = old
            if side == 'down': return ((l + r) / 2, b)
            if side == 'up': return ((l + r) / 2, t + sp['h'])
            if side == 'right': return (r - sp['w'] / 2, b)
            return (l + sp['w'] / 2, b)
        fitting = {}
        for fam, sps in families.items():
            for sp in sps:
                cx, bottom = placed_at(sp)
                rr = (cx - sp['w'] / 2, bottom - sp['h'], cx + sp['w'] / 2, bottom)
                if lawn_ok(rr[0] - 6, rr[1] - 6, rr[2] + 6, rr[3] + 6) and not any(overlaps(rr, q, 8) for q in others):
                    fitting.setdefault(fam, []).append((sp, cx, bottom))
        if not fitting: continue
        # Any style that fits is as likely as any other, so the rarer big ones still show up.
        sp, cx, bottom = vr.choice(fitting[vr.choice(sorted(fitting))])
        objects[i] = {'key': sp['key'], 'x': r1(cx), 'y': r1(bottom)}
    # Trees a bigger house now stands on come out.
    house_rects = [rect(objects[j]) for j in house_idx]
    def tree_rect(o):
        sp = size[o['key']]; w, h = sp['w'] * 0.7, sp['h'] * 0.8
        return (o['x'] - w / 2, o['y'] - h, o['x'] + w / 2, o['y'])
    objects = [o for o in objects if not o['key'].startswith('tree') or not any(overlaps(tree_rect(o), q, 2) for q in house_rects)]
    house_idx = [i for i, o in enumerate(objects) if o['key'].startswith(('house', 'villa'))]

    # 9. Gas stations (SCREAM-22, SCREAM-109): a forecourt with two pumps beside a main road, a
    # bay in the curb lane, and a GAS sign. A house standing on a forecourt moves to the nearest
    # free spot along the same street (it keeps its number, so its resident just moves with it);
    # trees there come out. Each is given by a point on the road and is on the side away from
    # the middle of the map, at the edge.
    STATIONS = [
        # PO (November 2): the real Speedway, just past the Chandler corner; here just north of it.
        {'name': 'Speedway', 'road': 'Park Avenue', 'near': (5540.8, 4656.3)},
        # PO (November 2, SCREAM-109): a second one on the west side, also on a main road and away from home.
        {'name': 'June Street', 'road': 'June Street', 'near': (1805.0, 2322.0)},
    ]
    PAD_LEN, PAD_DEPTH = 150, 76
    gas_stations = []
    for st in STATIONS:
        best = None
        for name, pts in pieces:
            if name != st['road']: continue
            for a2, b2 in zip(pts, pts[1:]):
                vx, vy = b2[0] - a2[0], b2[1] - a2[1]; L2 = vx * vx + vy * vy or 1
                tt = max(0, min(1, ((st['near'][0] - a2[0]) * vx + (st['near'][1] - a2[1]) * vy) / L2))
                px, py = a2[0] + tt * vx, a2[1] + tt * vy
                d = math.dist((px, py), st['near'])
                if best is None or d < best[0]: best = (d, (px, py), (vx / math.sqrt(L2), vy / math.sqrt(L2)))
        if best is None: sys.exit(f"gas station road not found: {st['road']}")
        _, (px, py), (ux, uy) = best
        nx, ny = -uy, ux
        if (px + nx - W / 2) ** 2 + (py + ny - H / 2) ** 2 < (px - W / 2) ** 2 + (py - H / 2) ** 2: nx, ny = -nx, -ny
        at = lambda side, along=0: (r1(px + ux * along + nx * side), r1(py + uy * along + ny * side))
        ang = r1(math.degrees(math.atan2(uy, ux)))
        pad_c = at(118)
        corners = [(pad_c[0] + ux * a3 + nx * b3, pad_c[1] + uy * a3 + ny * b3) for a3 in (-PAD_LEN / 2, PAD_LEN / 2) for b3 in (-PAD_DEPTH / 2, PAD_DEPTH / 2)]
        box = (min(c[0] for c in corners) - 10, min(c[1] for c in corners) - 10, max(c[0] for c in corners) + 10, max(c[1] for c in corners) + 10)
        st_out = {'name': st['name'], 'bay': {'x': at(30)[0], 'y': at(30)[1], 'angle': ang},
                  'pad': {'x': pad_c[0], 'y': pad_c[1], 'length': PAD_LEN, 'depth': PAD_DEPTH, 'angle': ang},
                  'pumps': [dict(zip('xy', at(112, -28))), dict(zip('xy', at(112, 28)))],
                  'sign': dict(zip('xy', at(118, 4)))}
        gas_stations.append(st_out)
        # Clear the forecourt (plus room for the pumps and sign to stand up from it).
        site = (box[0], box[1] - 40, box[2], box[3])
        objects = [o for o in objects if not (o['key'].startswith('tree') and overlaps(tree_rect(o), site))]
        for j, o in enumerate(objects):
            if not o['key'].startswith(('house', 'villa')) or not overlaps(rect(o), site): continue
            sp = size[o['key']]
            moved = None
            for slide in sorted(range(-900, 901, 20), key=abs):
                if moved: break
                for depth in (8, 20, 34, 60):
                    cx = px + ux * slide + nx * (edge + depth + sp['w'] / 2 * abs(nx))
                    cy = py + uy * slide + ny * (edge + depth + sp['h'] / 2 * abs(ny)) + sp['h'] / 2
                    rr = (cx - sp['w'] / 2, cy - sp['h'], cx + sp['w'] / 2, cy)
                    if (lawn_ok(rr[0] - 6, rr[1] - 6, rr[2] + 6, rr[3] + 6) and not overlaps(rr, site, 8)
                            and not any(overlaps(rr, rect(q), 8) for k, q in enumerate(objects) if k != j and q['key'].startswith(('house', 'villa')))
                            and all(not overlaps(rr, (g['pad']['x'] - 100, g['pad']['y'] - 100, g['pad']['x'] + 100, g['pad']['y'] + 100)) for g in gas_stations)):
                        moved = (r1(cx), r1(cy)); break
            if not moved: sys.exit(f"no room to move the house off the {st['name']} gas station")
            objects[j] = {'key': o['key'], 'x': moved[0], 'y': moved[1]}
            objects = [q for q in objects if not (q['key'].startswith('tree') and overlaps(tree_rect(q), rect(objects[j]), 2))]
    house_idx = [i for i, o in enumerate(objects) if o['key'].startswith(('house', 'villa'))]
    STATION_CLEAR = [(g['pad']['x'], g['pad']['y'], 200) for g in gas_stations]  # (x, y, radius): no ornaments here

    # Yard ornaments: one to three per house, beside the front and sides, off the path to the door.
    ornament_names = (
        [f'22_Post_Office_{c}_Mailbox_{n}_Front' for c in ('Black', 'Blue', 'Red') for n in (1, 2)]
        + ['24_Additional_Houses_Terraced_House_Mailbox', '24_Additional_Houses_Terraced_House_Potted_Plant_3',
           '24_Additional_Houses_Terraced_House_Potted_Plant_4', '24_Additional_Houses_Modern_House_Potted_Plant',
           '24_Additional_Houses_Modern_House_Potted_Plant_Bloomed', 'ME_Singles_Villas_Potted_Plant_1', 'ME_Singles_Villas_Potted_Plant_2']
        + [f'ME_Singles_Garden_{s}_{c}_Flower_Vase' for s in ('Big', 'Medium') for c in ('Light_Blue', 'Pink', 'Red', 'White', 'Yellow')]
        + ['ME_Singles_Garden_Big_Sunflower', 'ME_Singles_Garden_Big_Sunflower_Vase', 'ME_Singles_Garden_Medium_Sunflower']
        + [f'ME_Singles_Garden_{c}_{s}_Bird_House' for c in ('Blue', 'Brown', 'Pink', 'Red') for s in ('Big', 'Little')]
        + [f'ME_Singles_Garden_{c}_Vase_{n}_{k}_Flowers' for c in ('Blue', 'Red') for n in (1, 2) for k in ('Three', 'Four')]
        + [f'ME_Singles_Garden_{c}_Wood_Storage' for c in ('Blue_Brown', 'Blue_White', 'Brown', 'Red_Brown', 'Red_White', 'White')]
        + [f'ME_Singles_Garden_Bush_{n}' for n in range(1, 24)] + [f'ME_Singles_Garden_Bush_Potted_{n}' for n in range(1, 10)]
        + ['ME_Singles_Garden_Small_Bench_Horizontal', 'ME_Singles_Garden_Flowers_Bench_Horizontal', 'ME_Singles_Garden_Sunflower_Bench',
           'ME_Singles_Garden_Green_Watering_Can_Left_Full', 'ME_Singles_Garden_Green_Watering_Can_Right_Full',
           'ME_Singles_Garden_Wood_Box_Full_1', 'ME_Singles_Garden_Small_Wood_Cart_Full_1', 'ME_Singles_City_Props_Fountain_1',
           'ME_Singles_City_Props_Fountain_2']
        + [f'ME_Singles_Graveyard_{c}_Flowers_Pot' for c in ('Pink', 'Red', 'Violet', 'White_1')]
    )
    DOOR_CLEAR = 36  # px each side of a front door kept free of ornaments, so residents can get out
    ornaments = []
    for name in ornament_names:
        if name + '.png' not in by_name: sys.exit(f'ornament not found in the pack: {name}')
        key = 'orn_' + re.sub(r'^(ME_Singles_|22_Post_Office_|24_Additional_Houses_)', '', name).lower()
        sp = sprite(art_file(name), key)
        if sp['w'] <= 56 and sp['h'] <= 56: ornaments.append(sp)
    size.update({sp['key']: sp for sp in ornaments})
    blocking = [rect(o) for o in objects if o['key'].startswith(('house', 'villa'))] + [tree_rect(o) for o in objects if o['key'].startswith('tree')]
    added = []
    for j in house_idx:
        o = objects[j]
        if any(math.hypot(o['x'] - x, o['y'] - y) < r for x, y, r in STATION_CLEAR): continue
        l, t, r, b = rect(o)
        cx = (l + r) / 2
        # A shallow front lawn (road close to the front door) gets ornaments only at the sides,
        # so residents can still get round from the door to their yard.
        door_to_road = min(math.dist((cx, b + 4), (a2[0] + max(0, min(1, ((cx - a2[0]) * (b2[0] - a2[0]) + (b + 4 - a2[1]) * (b2[1] - a2[1]))
                                                              / (math.dist(a2, b2) ** 2 or 1))) * (b2[0] - a2[0]),
                                                  a2[1] + max(0, min(1, ((cx - a2[0]) * (b2[0] - a2[0]) + (b + 4 - a2[1]) * (b2[1] - a2[1]))
                                                              / (math.dist(a2, b2) ** 2 or 1))) * (b2[1] - a2[1])))
                           for _, pts2 in pieces for a2, b2 in zip(pts2, pts2[1:]))
        shallow = door_to_road - edge <= 40
        spots = ('left', 'right') if shallow else ('front', 'front', 'left', 'right')
        for _ in range(vr.randint(1, 3)):
            sp = vr.choice(ornaments)
            for _try in range(12):
                spot = vr.choice(spots)
                if spot == 'front':
                    x = vr.choice((vr.uniform(l + sp['w'] / 2, cx - DOOR_CLEAR - sp['w'] / 2), vr.uniform(cx + DOOR_CLEAR + sp['w'] / 2, r - sp['w'] / 2)))
                    y = b + vr.uniform(sp['h'] * 0.3 + 4, sp['h'] * 0.3 + 18)
                else:
                    x = l - 6 - sp['w'] / 2 - vr.uniform(0, 10) if spot == 'left' else r + 6 + sp['w'] / 2 + vr.uniform(0, 10)
                    # On a shallow lot the front corners stay clear too: they're the residents' yard.
                    y = vr.uniform(t + sp['h'] + (b - t) * 0.4, b - 24 if shallow else b + 10)
                orr = (x - sp['w'] / 2, y - sp['h'], x + sp['w'] / 2, y)
                if (lawn_ok(*orr) and not any(overlaps(orr, q, 3) for q in blocking)
                        and not any(math.hypot(x - sx, y - sy) < rr for sx, sy, rr in STATION_CLEAR)):
                    added.append({'key': sp['key'], 'x': r1(x), 'y': r1(y)}); blocking.append(orr); break
    objects += added
    used = {o['key'] for o in objects}
    sprites_out = [sp for sp in house_sprites + trees + ornaments if sp['key'] in used or sp['key'] in ('villa_4',)]
    for f in os.listdir(OUT_ART):
        k = f[:-4]
        # Only sprites this script makes; anything else in the folder (the gas pump) stays.
        if f.endswith('.png') and k.startswith(('house', 'villa', 'tree', 'orn_')) and k not in {sp['key'] for sp in sprites_out}:
            os.remove(os.path.join(OUT_ART, f))

    # 10. SCREAM-114 (PO, November 2): more parked cars. Added last, with their own random
    # numbers, so everything above comes out as before. Along the curbs, away from junctions,
    # home's start, potholes, the gas stations' bays and the other cars.
    cr = random.Random(114)
    EXTRA_CARS = 40
    keep = [(h['x'], h['y'], 200) for h in holes] + [(home_start['x'], home_start['y'], 260)]
    keep += [(g['bay']['x'], g['bay']['y'], 220) for g in gas_stations]
    cands = along(80, 150)
    cr.shuffle(cands)
    added_cars = 0
    for name, p, t in cands:
        if added_cars >= EXTRA_CARS: break
        side = cr.choice((1, -1))
        c = (p[0] - t[1] * side * 40, p[1] + t[0] * side * 40)
        if any(math.dist(c, (x, y)) < r for x, y, r in keep): continue
        if any(math.dist(c, (q['x'], q['y'])) < 140 for q in cars): continue
        cars.append({'x': r1(c[0]), 'y': r1(c[1]), 'angle': angle(t)}); added_cars += 1

    # One picture sheet (a texture atlas) for every house, tree and ornament, plus the gas pump:
    # 150-odd separate files made the first drive slow to load (SCREAM-108).
    pack = [dict(sp) for sp in sprites_out]
    if os.path.exists(os.path.join(OUT_ART, 'pump.png')):
        pump_im = Image.open(os.path.join(OUT_ART, 'pump.png'))
        pack.append({'key': 'pump', 'w': pump_im.width, 'h': pump_im.height})
    ATLAS_W, PAD = 1024, 2
    x = y = row_h = 0
    for sp in sorted(pack, key=lambda q: (-q['h'], q['key'])):
        if x + sp['w'] > ATLAS_W: x, y, row_h = 0, y + row_h + PAD, 0
        sp['ax'], sp['ay'] = x, y
        x += sp['w'] + PAD; row_h = max(row_h, sp['h'])
    atlas = Image.new('RGBA', (ATLAS_W, y + row_h))
    frames = {}
    for sp in pack:
        atlas.paste(Image.open(os.path.join(OUT_ART, sp['key'] + '.png')).convert('RGBA'), (sp['ax'], sp['ay']))
        frames[sp['key']] = {'frame': {'x': sp['ax'], 'y': sp['ay'], 'w': sp['w'], 'h': sp['h']}, 'rotated': False, 'trimmed': False,
                             'spriteSourceSize': {'x': 0, 'y': 0, 'w': sp['w'], 'h': sp['h']}, 'sourceSize': {'w': sp['w'], 'h': sp['h']}}
    atlas.save(os.path.join(OUT_ART, 'atlas.png'), optimize=True)
    json.dump({'frames': frames, 'meta': {'image': 'atlas.png', 'size': {'w': ATLAS_W, 'h': atlas.height}, 'scale': '1'}},
              open(os.path.join(OUT_ART, 'atlas.json'), 'w'), separators=(',', ':'))
    for f in os.listdir(OUT_ART):
        if f.endswith('.png') and f[:-4].startswith(('house', 'villa', 'tree', 'orn_')):
            os.remove(os.path.join(OUT_ART, f))

    out = {
        'width': W, 'height': H,
        'roads': [{'name': n, 'points': [c for p in pts for c in p]} for n, pts in pieces],
        'labels': labels, 'areas': areas, 'homeStart': home_start,
        'home': home_obj, 'gasStations': gas_stations, 'curbSpots': curb, 'potholes': holes, 'parkedCars': cars, 'objects': objects,
        'sprites': [{'key': s['key'], 'w': s['w'], 'h': s['h']} for s in sprites_out],
        'roadTiles': road_tiles, 'roadTileScale': RASTER,
        'roadMask': {'scale': RASTER, 'rows': road_rows},
    }
    ts = ['// GENERATED by tools/worcester/build_map.py: edit the script, not this file.',
          '// SCREAM-10: the streets around June St, Pleasant St, Park Ave and Chandler St in',
          '// Worcester, MA. Street data (c) OpenStreetMap contributors (ODbL). Art: LimeZu.',
          '// Positions are in pixels from the top-left of the map; angles in degrees (0 = right, 90 = down).',
          '',
          "import type { WorcesterMap } from './mapTypes';",
          '',
          f'export const WORCESTER: WorcesterMap = {json.dumps(out, separators=(",", ":"))};', '']
    open(OUT_TS, 'w').write('\n'.join(ts))
    print(f'map {W}x{H}px, {len(pieces)} road pieces, {len(labels)} labels, {len(curb)} curb spots, {len(holes)} potholes, '
          f'{len(cars)} cars, {len(objects)} houses+trees, home on {home[0]}')


if __name__ == '__main__':
    {'extract': extract, 'build': build}[sys.argv[1]](sys.argv[2])
