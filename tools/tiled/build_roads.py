"""Builds the tutorial map's roads from tools/tutorial/roads.json (SCREAM-159).

Usage (run from the repo root):
    python3 tools/tiled/build_roads.py <roads.png for the Tiled map>

Since SCREAM-158 the PO lays out the tutorial map in Tiled, but the roads stay generated
(PO, November 4): they decide where the truck can drive, where pink squares go and where
customers stand, so they're built from data rather than painted.

tools/tutorial/roads.json holds the streets (centre lines, x, y pairs, and `lanes` each way:
1 by default, Park Ave has 2), the gas stations, where the truck starts, the potholes and the
parked cars. This script writes:
- the road picture (asphalt, curbs, sidewalks, rounded corners) at full size, for the Tiled
  map's "Roads and sidewalks" layer (tiled/tutorial-map/images/roads.png in the art repo);
- into src/config/tutorial.ts: roads, street names, the road-edge map, potholes, parked cars,
  curb spots, gas stations and the truck's start.
Then run tools/tiled/import_tiled.py (it takes the ground from the Tiled map's road picture)
and rebuild the tutorial residents.
"""
import json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ROADS_JSON = os.path.join(ROOT, 'tools', 'tutorial', 'roads.json')
OUT_TS = os.path.join(ROOT, 'src', 'config', 'tutorial.ts')
EXPORT = 'TUTORIAL'
# As tools/worcester/build_map.py, so the streets look the same as before.
LANE_W, SIDEWALK, CORNER_RADIUS, RASTER = 60, 14, 48, 2


def half(road): return LANE_W * road.get('lanes', 1)


def strokes(road, roads):
    """The centre lines to draw a street with: its own for one lane each way; for more, lines
    LANE_W apart across its width (two lanes each way: 60 px either side of the centre), each
    end moved along the cross street it meets."""
    p = road['points']; pts = list(zip(p[0::2], p[1::2]))
    k = road.get('lanes', 1)
    if k == 1: return [pts]
    if len(pts) != 2: sys.exit(f'{road["name"]}: a street with more lanes must be one straight piece')
    (ax, ay), (bx, by) = pts
    L = math.dist(pts[0], pts[1]); ux, uy = (bx - ax) / L, (by - ay) / L; nx, ny = -uy, ux

    def cross_line(end):
        for r in roads:
            if r is road: continue
            q = r['points']; qs = list(zip(q[0::2], q[1::2]))
            for c, e in zip(qs, qs[1:]):
                if seg_dist(end, c, e) < 1: return c, e
        return None

    def slide(end, off):
        """The end of a stroke `off` px across: on the cross street's line, if one meets here."""
        sx, sy = end[0] + nx * off, end[1] + ny * off
        cl = cross_line(end)
        if not cl: return (sx, sy)
        (cx, cy), (ex, ey) = cl
        dx, dy = ex - cx, ey - cy
        den = ux * dy - uy * dx
        if abs(den) < 1e-6: return (sx, sy)
        t = ((cx - sx) * dy - (cy - sy) * dx) / den
        return (sx + ux * t, sy + uy * t)
    offs = [LANE_W * (2 * i - (k - 1)) for i in range(k)]  # 2 lanes: -60, +60
    return [[slide(pts[0], o), slide(pts[1], o)] for o in offs]


def seg_dist(p, a, b):
    vx, vy = b[0] - a[0], b[1] - a[1]
    L2 = vx * vx + vy * vy
    t = 0 if L2 == 0 else max(0, min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2))
    return math.hypot(p[0] - a[0] - t * vx, p[1] - a[1] - t * vy)


def labels_for(roads):
    """One label per ~900 px of street, on its longest straight stretches (as build_map.py)."""
    labels, by_name = [], {}
    for r in roads:
        p = r['points']; pts = list(zip(p[0::2], p[1::2]))
        for a, b in zip(pts, pts[1:]): by_name.setdefault(r['name'], []).append((math.dist(a, b), a, b))
    for name, segs in by_name.items():
        total = sum(s[0] for s in segs)
        segs.sort(key=lambda s: -s[0])
        for L, a, b in segs[:max(1, min(3, int(total // 900)))]:
            if L < len(name) * 7: continue
            mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            if any(math.dist(mid, (l['x'], l['y'])) < 500 for l in labels if l['name'] == name): continue
            ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
            if ang > 90: ang -= 180
            if ang <= -90: ang += 180
            labels.append({'name': name, 'x': round(mid[0], 1), 'y': round(mid[1], 1), 'angle': round(ang, 1)})
    return labels


def main(png_out):
    import numpy as np
    from PIL import Image, ImageDraw
    from scipy import ndimage
    d = json.load(open(ROADS_JSON))
    s = open(OUT_TS, encoding='utf-8').read()
    head = f'{EXPORT}: WorcesterMap = '
    i = s.index(head) + len(head)
    m, end = json.JSONDecoder().raw_decode(s[i:])
    W, H = m['width'], m['height']
    roads = d['roads']

    # The road surface: distance to the nearest curb line, per street width, then rounded corners
    # (widen by the corner radius and shrink back), as build_map.py does for one width.
    # A street with more lanes is drawn as several one-lane-each-way strokes side by side, each
    # trimmed to the streets its ends meet, so its wide ends stop at the cross street's centre
    # line like any other street's (no bulge past the corner).
    W2, H2 = (W + RASTER - 1) // RASTER, (H + RASTER - 1) // RASTER
    lines = Image.new('L', (W2, H2), 255); ld = ImageDraw.Draw(lines)
    for r in roads:
        for pts in strokes(r, roads):
            ld.line([(x / RASTER, y / RASTER) for x, y in pts], fill=0, width=1)
    past_curb = ndimage.distance_transform_edt(np.array(lines) > 0) * RASTER

    def rounded(h, radius):
        widened = past_curb <= h + radius
        return ndimage.distance_transform_edt(widened) * RASTER >= radius
    asphalt = rounded(LANE_W, CORNER_RADIUS)
    curb_mask = rounded(LANE_W + 3, CORNER_RADIUS - 3)
    sidewalk_mask = rounded(LANE_W + SIDEWALK, CORNER_RADIUS - SIDEWALK)
    img = np.zeros((H2, W2, 4), np.uint8)
    img[sidewalk_mask] = (0xd6, 0xd0, 0xc7, 255)
    img[curb_mask] = (0x7a, 0x74, 0x70, 255)
    img[asphalt] = (0x53, 0x4f, 0x52, 255)
    full = Image.fromarray(img, 'RGBA').resize((W2 * RASTER, H2 * RASTER), Image.NEAREST).crop((0, 0, W, H))
    full.save(png_out, optimize=True)
    rows = []
    for row in asphalt:
        e = np.flatnonzero(np.diff(np.concatenate(([0], row.astype(np.int8), [0]))))
        rows.append(e.tolist())

    out_roads = [{'name': r['name'], 'points': [round(v, 1) for v in r['points']], **({'lanes': r['lanes']} if r.get('lanes', 1) != 1 else {})}
                 for r in roads]
    m.update({'roads': out_roads, 'labels': labels_for(roads), 'homeStart': d['homeStart'], 'gasStations': d['gasStations'],
              'curbSpots': d['curbSpots'], 'potholes': d['potholes'], 'parkedCars': d['parkedCars'],
              'roadMask': {'scale': RASTER, 'rows': rows}})
    open(OUT_TS, 'w', encoding='utf-8').write(s[:i] + json.dumps(m, separators=(',', ':')) + s[i + end:])
    lanes = {r['name']: r['lanes'] for r in roads if r.get('lanes', 1) != 1}
    print(f'{len(roads)} road pieces ({lanes or "all one lane each way"}), road picture {W}x{H} -> {png_out}')


if __name__ == '__main__':
    if len(sys.argv) < 2: sys.exit(__doc__)
    main(sys.argv[1])
