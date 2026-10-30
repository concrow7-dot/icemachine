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
import json, math, os, random, sys
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

    out = {
        'width': W, 'height': H,
        'roads': [{'name': n, 'points': [c for p in pts for c in p]} for n, pts in pieces],
        'labels': labels, 'areas': areas, 'homeStart': home_start,
        'home': home_obj, 'curbSpots': curb, 'potholes': holes, 'parkedCars': cars, 'objects': objects,
        'sprites': [{'key': s['key'], 'w': s['w'], 'h': s['h']} for s in houses + villas + trees],
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
