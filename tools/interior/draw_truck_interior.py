import sys, math, random
from PIL import Image, ImageDraw, ImageFont

# Hand-drawn style: every straight edge is cut into short pieces and nudged by a
# smooth wobble that depends only on the edge's two end points, so faces that
# share an edge share the same wobbly line and stay closed for Paint's bucket.
W, H = 1920, 1080
F = 960.0
CX, CY = 960, 380
EYE = 0.85
LW = 6
WOB = 5.5          # wobble size in px
BULGE = -0.07      # barrel bulge (negative = rounder room)
BLK, WHT = (0, 0, 0), (255, 255, 255)

img = Image.new("RGB", (W, H), WHT)
d = ImageDraw.Draw(img)

NIB = math.radians(35)   # angle of the broad pen nib

def stroke(pts, w, seed=0):
    """Calligraphy pen: thick across the nib, thin along it, with a little pressure change."""
    if len(pts) < 2:
        return
    rnd = random.Random(str((round(pts[0][0]), round(pts[0][1]), len(pts), seed)))
    ph = rnd.uniform(0, 6.28)
    n = len(pts) - 1
    for i in range(n):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        a = math.atan2(y1 - y0, x1 - x0)
        press = 1 + 0.15 * math.sin(ph + 5 * i / max(n, 1))
        ww = max(2.2, w * press * (0.22 + 1.45 * abs(math.sin(a - NIB))))
        L = math.hypot(x1 - x0, y1 - y0) or 1
        nx, ny = -(y1 - y0) / L * ww / 2, (x1 - x0) / L * ww / 2
        d.polygon([(x0 + nx, y0 + ny), (x1 + nx, y1 + ny), (x1 - nx, y1 - ny), (x0 - nx, y0 - ny)], fill=BLK)
        r = ww / 2
        d.ellipse([x1 - r, y1 - r, x1 + r, y1 + r], fill=BLK)
        if i == 0:
            d.ellipse([x0 - r, y0 - r, x0 + r, y0 + r], fill=BLK)

def warp(x, y):
    u, v = (x - 960) / 960, (y - 540) / 960
    f = (1 + BULGE * (u * u + v * v)) * 1.04
    return (960 + u * f * 960, 540 + v * f * 960)

def P(x, y, z):
    return warp(CX + x * F / z, CY - (y - EYE) * F / z)

def _key(p):
    return tuple(round(c, 4) for c in p)

def edge_pts(a, b, amp=None):
    amp = WOB if amp is None else amp
    """Wobbly screen points from 3D a to 3D b (both ends exact)."""
    ka, kb = _key(a), _key(b)
    flip = kb < ka
    if flip:
        a, b = b, a
    rnd = random.Random(str((_key(a), _key(b))))
    ph1, ph2 = rnd.uniform(0, 6.28), rnd.uniform(0, 6.28)
    f1, f2 = rnd.uniform(1.0, 2.0), rnd.uniform(2.5, 4.0)
    sa, sb = P(*a), P(*b)
    length = math.dist(sa, sb)
    n = max(2, int(length / 14))
    nx, ny = (-(sb[1] - sa[1]) / (length or 1), (sb[0] - sa[0]) / (length or 1))
    k = min(1.0, length / 120)
    out = []
    for i in range(n + 1):
        t = i / n
        q = P(*(a[j] + (b[j] - a[j]) * t for j in range(3)))
        env = math.sin(math.pi * t)
        off = amp * k * env * (0.7 * math.sin(ph1 + f1 * math.pi * t) + 0.3 * math.sin(ph2 + f2 * math.pi * t))
        out.append((q[0] + nx * off, q[1] + ny * off))
    return out[::-1] if flip else out

def poly(pts3, fill=WHT, round_=False):
    pts = []
    for i in range(len(pts3)):
        seg = edge_pts(pts3[i], pts3[(i + 1) % len(pts3)])
        pts.extend(seg[:-1])
    if round_:
        pts = chaikin(pts, 2)
    d.polygon(pts, fill=fill)
    stroke(pts + [pts[0]], LW)

def chaikin(pts, it):
    for _ in range(it):
        new = []
        for i in range(len(pts)):
            p, q = pts[i], pts[(i + 1) % len(pts)]
            new += [(0.8 * p[0] + 0.2 * q[0], 0.8 * p[1] + 0.2 * q[1]),
                    (0.2 * p[0] + 0.8 * q[0], 0.2 * p[1] + 0.8 * q[1])]
        pts = new
    return pts

def line(a, b, w=LW):
    stroke(edge_pts(a, b), w)

def box(x0, x1, y0, y1, z0, z1, round_front=False):
    if x1 < 0:
        poly([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)])
    if x0 > 0:
        poly([(x0, y0, z0), (x0, y1, z0), (x0, y1, z1), (x0, y0, z1)])
    if y1 < EYE:
        poly([(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)])
    if y0 > EYE:
        poly([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)])
    poly([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)], round_=round_front)

def _oval(cx, cy, rx, ry, seed):
    rnd = random.Random(str(seed))
    ph = rnd.uniform(0, 6.28)
    n = max(24, int((rx + ry) / 3))
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        w = 1 + 0.05 * math.sin(2 * t + ph)
        pts.append((cx + rx * w * math.cos(t), cy + ry * w * math.sin(t)))
    return pts

def oval_shape(pts):
    d.polygon(pts, fill=WHT)
    stroke(pts + [pts[0]], LW)

def ellipse_at(x, y, z, rx, ry):
    cx, cy = P(x, y, z)
    s = F / z
    oval_shape(_oval(cx, cy, rx * s, ry * s, (x, y, z)))

def cylinder(x, y0, y1, z, r):
    s = F / z
    bx, by = P(x, y0, z)
    tx, ty = P(x, y1, z)
    rx, ry = r * s, r * s * 0.35
    body = [(bx - rx * 0.96, ty), (tx + rx * 0.96, ty)]
    body = [(tx - rx, ty)] + [(bx + rx * math.cos(math.pi - math.pi * i / 16) * 1.0,
                                by + ry * math.sin(math.pi - math.pi * i / 16)) for i in range(17)][::-1][::-1] + [(tx + rx, ty)]
    # left side down, bottom curve, right side up
    side = [(tx - rx, ty), (bx - rx * 1.04, by)]
    bottom = [(bx + rx * 1.04 * math.cos(math.pi - math.pi * i / 16), by + ry * math.sin(math.pi * i / 16)) for i in range(17)]
    shape = [(tx - rx, ty)] + bottom + [(tx + rx, ty)]
    oval_shape(shape)
    oval_shape(_oval(tx, ty, rx, ry, (x, y1, z)))

def rounded_handle(cx, cy, w, h):
    d.rounded_rectangle([cx - w, cy - h, cx + w, cy + h], radius=min(w, h), fill=WHT, outline=BLK, width=LW - 1)

ZB = 2.6   # back wall (cab)
ZF = 0.55  # well in front of the screen (lines run off the edges)
ROOF = 1.25

# ---- room: back wall, floor, ceiling, side walls ----
poly([(-1, 0, ZB), (1, 0, ZB), (1, ROOF, ZB), (-1, ROOF, ZB)])
for a, b in [((-1, 0, ZB), (-1, 0, ZF)), ((1, 0, ZB), (1, 0, ZF)),
             ((-1, ROOF, ZB), (-1, ROOF, ZF)), ((1, ROOF, ZB), (1, ROOF, ZF))]:
    line(a, b, 7)

# wood planks: floor boards toward the cab, wall boards along the sides
# diamond plate floor: pairs of raised lens shapes, alternating across and along the truck
def lens(a3, b3, half_w):
    sa, sb = P(*a3), P(*b3)
    L = math.dist(sa, sb)
    if L < 7:
        return
    nx, ny = -(sb[1] - sa[1]) / L, (sb[0] - sa[0]) / L
    zmid = (a3[2] + b3[2]) / 2
    w = max(1.2, half_w * F / zmid)
    top, bot = [], []
    for i in range(13):
        t = i / 12
        px, py = sa[0] + (sb[0] - sa[0]) * t, sa[1] + (sb[1] - sa[1]) * t
        k = w * math.sin(math.pi * t) ** 0.8
        top.append((px + nx * k, py + ny * k))
        bot.append((px - nx * k, py - ny * k))
    d.polygon(top + bot[::-1], fill=BLK)

CELL = 0.15
zc = 0.6
row = 0
while zc < ZB - 0.05:
    xc = -1 + CELL / 2
    col = 0
    while xc < 1 - 0.04:
        across = (row + col) % 2 == 0
        for off in (-0.022, 0.022):
            if across:   # lenses running across the truck
                lens((xc - 0.05, 0, zc + off), (xc + 0.05, 0, zc + off), 0.006)
            else:        # lenses running toward the cab
                lens((xc + off, 0, zc - 0.05), (xc + off, 0, zc + 0.05), 0.006)
        xc += CELL
        col += 1
    zc += CELL
    row += 1
for py in (0.22, 0.44, 0.66, 0.88, 1.1):
    line((-1, py, 0.55), (-1, py + 0.01, ZB - 0.03), 2)
    line((1, py, 0.55), (1, py + 0.01, ZB - 0.03), 2)
for px in (-0.5, 0.0, 0.5):
    line((px, ROOF, 0.55), (px, ROOF, ZB - 0.02), 2)

# windshield + dashboard
poly([(-0.9, 0.74, ZB), (0.9, 0.74, ZB), (0.85, 1.16, ZB), (-0.85, 1.16, ZB)], round_=True)
box(-1, 1, 0.6, 0.72, 2.45, ZB)
# side windows of the cab
poly([(-1, 0.76, 2.2), (-1, 0.76, 2.55), (-1, 1.12, 2.55), (-1, 1.08, 2.2)], round_=True)
poly([(1, 0.76, 2.2), (1, 0.76, 2.55), (1, 1.12, 2.55), (1, 1.08, 2.2)], round_=True)

# rear-view mirror with the hanging cone
box(-0.12, 0.12, 1.07, 1.12, 2.5, 2.52)
line((0, 1.07, 2.51), (0, 1.0, 2.51), 3)
ellipse_at(0, 0.98, 2.51, 0.03, 0.03)
cx, cy = P(0, 0.965, 2.51)
cone = [(cx - 12, cy), (cx + 12, cy), (cx, cy + 38)]
d.polygon(cone, fill=WHT)
stroke(cone + [cone[0]], 4)
d.line([(cx - 7, cy + 8), (cx + 4, cy + 20)], fill=BLK, width=2)
d.line([(cx + 7, cy + 8), (cx - 4, cy + 20)], fill=BLK, width=2)

# steering wheel: a circle; the driver's seat hides its lower part
ellipse_at(-0.548, 0.78, 2.4, 0.19, 0.19)
ellipse_at(-0.548, 0.78, 2.4, 0.15, 0.15)

# pedals (gas and brake) under the dash
box(-0.62, -0.53, 0.03, 0.14, 2.38, 2.42)
box(-0.36, -0.3, 0.03, 0.18, 2.38, 2.42)

# gearbox between the seats
box(-0.1, 0.1, 0, 0.28, 2.1, 2.35)
line((0, 0.28, 2.2), (0, 0.46, 2.2))
ellipse_at(0, 0.48, 2.2, 0.035, 0.035)

# two seats facing the windshield (we see their backs), each on a pole with a round base
for sx in (-0.45, 0.45):
    ellipse_at(sx, 0, 2.15, 0.14, 0.04)
    WOB = 1.0
    box(sx - 0.025, sx + 0.025, 0, 0.34, 2.13, 2.17)
    WOB = 5.5
    box(sx - 0.18, sx + 0.18, 0.34, 0.42, 2.0, 2.32)                       # cushion (mostly hidden)
    box(sx - 0.09, sx + 0.09, 0.79, 0.92, 1.97, 2.01, round_front=True)   # headrest
    box(sx - 0.18, sx + 0.18, 0.36, 0.79, 1.95, 2.02, round_front=True)   # back of the seat

# ---- right side: side door with the trash hole, trash can against it ----
poly([(1, 0, 1.74), (1, 0, 2.18), (1, 1.08, 2.18), (1, 1.08, 1.74)])
hx, hy = P(1, 0.55, 1.8)
d.rounded_rectangle([hx - 9, hy - 38, hx + 9, hy + 38], radius=8, fill=WHT, outline=BLK, width=LW)
poly([(1, 0.68, 1.86), (1, 0.68, 2.12), (1, 0.98, 2.12), (1, 0.98, 1.86)], round_=True)   # door window
poly([(1, 0.4, 1.9), (1, 0.4, 2.08), (1, 0.52, 2.08), (1, 0.52, 1.9)], round_=True)       # trash hole
cylinder(0.88, 0, 0.26, 1.99, 0.075)                                                       # trash can

# serving window: opening, the propped-open panel, and the ledge
poly([(1, 0.55, 0.98), (1, 0.55, 1.3), (1, 1.08, 1.3), (1, 1.08, 0.98)])
poly([(1, 1.08, 0.98), (1, 1.08, 1.3), (0.78, 1.2, 1.3), (0.78, 1.2, 0.98)])
box(0.82, 1, 0.5, 0.55, 0.98, 1.3)          # ledge
# cash box and tip jar on the ledge
box(0.84, 0.97, 0.55, 0.64, 1.14, 1.27)
line((0.905, 0.64, 1.14), (0.905, 0.64, 1.27), 3)
cylinder(0.9, 0.55, 0.7, 1.02, 0.045)
tx, ty = P(0.9, 0.64, 1.02)
d.text((tx - 30, ty - 22), "TIPS", fill=BLK, font=ImageFont.load_default(size=26))

# rear wheel well: a hump on the right wall under the serving window, running off the screen
WZ0, WZ1 = 0.72, 1.32
poly([(0.86, 0.32, WZ0), (1, 0.32, WZ0), (1, 0.32, WZ1), (0.86, 0.32, WZ1)])          # top
poly([(0.72, 0.22, WZ0), (0.86, 0.32, WZ0), (0.86, 0.32, WZ1), (0.72, 0.22, WZ1)])    # sloped edge
poly([(0.72, 0, WZ0), (0.72, 0.22, WZ0), (0.72, 0.22, WZ1), (0.72, 0, WZ1)])          # inner side
poly([(0.72, 0, WZ0), (1, 0, WZ0), (1, 0.32, WZ0), (0.86, 0.32, WZ0), (0.72, 0.22, WZ0)])  # near end

# ---- left side: the big freezer ----
FX = -0.45
box(-1, FX, 0, 0.5, 0.95, 1.85)
# sliding lids on top
for z0, z1 in [(1.05, 1.32), (1.37, 1.58), (1.62, 1.8)]:
    poly([(-0.95, 0.5, z0), (FX - 0.05, 0.5, z0), (FX - 0.05, 0.5, z1), (-0.95, 0.5, z1)], round_=True)
    hx0, hy0 = P(FX - 0.12, 0.5, (z0 + z1) / 2)
    d.rounded_rectangle([hx0 - 22, hy0 - 5, hx0 + 6, hy0 + 5], radius=3, fill=WHT, outline=BLK, width=3)
# flavour labels on the freezer side
for z0, z1 in [(1.1, 1.3), (1.38, 1.55), (1.62, 1.78)]:
    poly([(FX, 0.25, z0), (FX, 0.25, z1), (FX, 0.4, z1), (FX, 0.4, z0)])

# ---- decorations (proposals) ----
# menu board above the freezer
poly([(-1, 0.68, 1.1), (-1, 0.68, 1.8), (-1, 1.08, 1.8), (-1, 1.08, 1.1)], round_=True)
for yy in (0.8, 0.88, 0.96):
    line((-1, yy, 1.2), (-1, yy, 1.7), 3)
# pennant string across the ceiling, near the cab
zs = 1.55
a, b = P(-1, 1.2, zs), P(1, 1.2, zs)
def rope(t):  # sagging string
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + 45 * math.sin(math.pi * t))
stroke([rope(i / 60) for i in range(61)], 4)
n = 9
for i in range(n):
    t0, t1 = (i + 0.18) / n, (i + 0.82) / n
    p0, p1 = rope(t0), rope(t1)
    ang = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
    mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
    tip = (mx - 58 * math.sin(ang) + 6 * math.cos(ang), my + 58 * math.cos(ang))
    tri = chaikin([p0, p1, tip], 1)
    tri = [p0, p1] + tri[3:]
    d.polygon(tri, fill=WHT)
    stroke(tri + [tri[0]], 4)
stroke([rope(i / 60) for i in range(61)], 4)

out = sys.argv[1]
img.save(out)

# labelled guide copy
lab = img.copy()
ld = ImageDraw.Draw(lab)
font = ImageFont.load_default(size=30)
labels = [
    ("Ceiling", (900, 90)), ("Menu board", (180, 140)), ("Pennants", (1180, 150)),
    ("Windshield", (1060, 300)), ("Mirror + cone", (985, 345)), ("Steering wheel", (560, 280)),
    ("Side windows", (450, 430)), ("Dashboard", (870, 445)), ("Back of driver's seat", (600, 495)),
    ("Back of passenger seat", (1040, 495)), ("Gearbox", (900, 790)), ("Pedals", (780, 700)),
    ("Seat pole", (1190, 700)), ("Freezer", (300, 860)), ("Lids", (330, 630)),
    ("Labels", (620, 950)), ("Side door", (1300, 640)), ("Trash hole", (1490, 300)),
    ("Trash can", (1250, 830)), ("Serving window", (1600, 260)), ("Cash box", (1600, 495)),
    ("Tip jar", (1700, 700)), ("Wheel well", (1560, 960)), ("Floor", (900, 1000)),
]
for text, (x, y) in labels:
    bb = ld.textbbox((x, y), text, font=font)
    ld.rectangle([bb[0] - 6, bb[1] - 4, bb[2] + 6, bb[3] + 4], fill=(255, 235, 120), outline=BLK, width=2)
    ld.text((x, y), text, fill=BLK, font=font)
lab.save(out.replace(".png", "-labelled.png"))
