"""SCREAM-124: the cooler screen's background, in the style of the PO's truck drawing.

Looking down into the open freezer: steel rim, dark inside, cartoon icicles hanging
from the rim, cardboard boxes at the back and three beige plastic crates (the PO's
photo of a real truck freezer), one for each slot. The glass lids are drawn by the
game (they slide open), not here.

    python3 tools/interior/draw_cooler.py public/assets/interior/cooler-inside.png

Coordinates below are on the 960 x 540 screen; the picture is drawn at twice that
(1920 x 1080), like truck-interior.png. Fixed random seed, so it redraws the same.
Keep CRATE_X / CRATE_Y in step with COLUMN_X and the crate box in CoolerScene.ts.
"""
import math
import random
import sys

from PIL import Image, ImageDraw

S = 2  # picture px per screen px
W, H = 960 * S, 540 * S
rnd = random.Random(124)

OUTLINE = (127, 127, 127)       # the drawing's grey outlines
WALL_CREAM = (239, 228, 176)
WALL_GREEN = (225, 245, 165)
FLOOR = (195, 195, 195)
STEEL = (204, 204, 204)
STEEL_SHADE = (178, 178, 178)
INSIDE = (18, 27, 40)
INSIDE_BACK = (33, 47, 68)
ICE = (233, 251, 255)
ICE_EDGE = (150, 205, 225)
BOX = (185, 122, 87)            # the drawing's cardboard box
BOX_TOP = (205, 148, 110)
BOX_TAPE = (222, 196, 150)
CRATE = (228, 214, 176)
CRATE_EDGE = (150, 128, 88)
CRATE_INNER = (205, 188, 146)

# Matches CoolerScene: slot columns and the crate box (centre x, top, bottom, width).
CRATE_X = [170, 480, 790]
CRATE_TOP, CRATE_BOTTOM, CRATE_W = 114, 392, 290
OPENING = (24, 74, 936, 404)    # left, top, right, bottom of the dark inside
RIM = (8, 46, 952, 512)

img = Image.new("RGB", (W, H), WALL_CREAM)
d = ImageDraw.Draw(img)


def wobbly(points, closed=True, step=9, amp=1.6):
    """Cuts each edge into short pieces and nudges them, for a hand-drawn line (screen px in, picture px out)."""
    out = []
    n = len(points)
    for i in range(n if closed else n - 1):
        (x0, y0), (x1, y1) = points[i], points[(i + 1) % n]
        length = math.hypot(x1 - x0, y1 - y0)
        pieces = max(1, int(length / step))
        nx, ny = (-(y1 - y0) / length, (x1 - x0) / length) if length else (0, 0)
        phase = rnd.uniform(0, 6.28)
        for k in range(pieces):
            t = k / pieces
            w = amp * math.sin(phase + t * 5.0) * math.sin(math.pi * t)
            out.append(((x0 + (x1 - x0) * t + nx * w) * S, (y0 + (y1 - y0) * t + ny * w) * S))
    if not closed:
        out.append((points[-1][0] * S, points[-1][1] * S))
    return out


def shape(points, fill, outline=OUTLINE, width=3, amp=1.6):
    pts = wobbly(points, amp=amp)
    d.polygon(pts, fill=fill)
    if outline:
        d.line(pts + [pts[0]], fill=outline, width=width * S, joint="curve")


def box(x0, y0, x1, y1, fill, outline=OUTLINE, width=3, cut=0, amp=1.6):
    """A rectangle, optionally with its corners cut (a rounded look)."""
    c = cut
    pts = [(x0 + c, y0), (x1 - c, y0), (x1, y0 + c), (x1, y1 - c), (x1 - c, y1), (x0 + c, y1), (x0, y1 - c), (x0, y0 + c)]
    shape(pts, fill, outline, width, amp)


# ---- The truck behind: wall stripes at the top, floor at the bottom ----
for y in range(0, 50, 20):
    d.rectangle([0, y * S, W, (y + 10) * S], fill=WALL_GREEN)
d.rectangle([0, 505 * S, W, H], fill=FLOOR)
for x in list(range(20, 140, 46)) + list(range(830, 960, 46)):
    for y in (516, 532):
        xx = x + (23 if y == 532 else 0)
        d.ellipse([(xx - 6) * S, (y - 1.5) * S, (xx + 6) * S, (y + 1.5) * S], fill=(40, 40, 40))

# ---- The freezer: steel rim and the dark inside ----
box(*RIM, STEEL, width=4, cut=14)
# A darker band along the front edge, like the steel's bevel.
box(RIM[0] + 10, 470, RIM[2] - 10, RIM[3] - 8, STEEL_SHADE, outline=None, cut=8, amp=0.8)
ox0, oy0, ox1, oy1 = OPENING
box(ox0, oy0, ox1, oy1, INSIDE, width=4, cut=6)
# The back wall, a little lighter, and frost specks.
d.rectangle([(ox0 + 4) * S, (oy0 + 4) * S, (ox1 - 4) * S, (oy0 + 22) * S], fill=INSIDE_BACK)
for _ in range(140):
    x, y = rnd.uniform(ox0 + 8, ox1 - 8), rnd.uniform(oy0 + 6, oy1 - 6)
    r = rnd.uniform(0.6, 1.4)
    d.ellipse([(x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S], fill=(70, 96, 122))

# ---- Cardboard boxes at the back, peeking out above the crates ----
for bx, bw, bh in [(44, 70, 30), (128, 52, 24), (352, 64, 28), (430, 80, 22), (560, 46, 30), (668, 74, 26), (842, 60, 28), (250, 58, 32), (760, 50, 20)]:
    top = CRATE_TOP + 6 - bh
    box(bx, top, bx + bw, CRATE_TOP + 10, BOX, width=2, amp=1.0)
    d.rectangle([(bx + 3) * S, (top + 3) * S, (bx + bw - 3) * S, (top + 8) * S], fill=BOX_TOP)
    tx = bx + bw / 2
    d.rectangle([(tx - 4) * S, (top + 2) * S, (tx + 4) * S, (CRATE_TOP + 8) * S], fill=BOX_TAPE)

# ---- The crates, one per slot ----
for cx in CRATE_X:
    x0, x1 = cx - CRATE_W / 2, cx + CRATE_W / 2
    box(x0, CRATE_TOP, x1, CRATE_BOTTOM, CRATE, outline=CRATE_EDGE, width=3, cut=10)
    # Inner rim, and the handle slots on the front lip.
    # The lip along the top, a little darker, then the inner rim.
    d.rectangle([(x0 + 4) * S, (CRATE_TOP + 3) * S, (x1 - 4) * S, (CRATE_TOP + 9) * S], fill=CRATE_INNER)
    box(x0 + 8, CRATE_TOP + 12, x1 - 8, CRATE_BOTTOM - 8, None, outline=CRATE_INNER, width=2, cut=6, amp=0.8)
    for hx in (cx - 60, cx + 60):
        d.rounded_rectangle([(hx - 18) * S, (CRATE_BOTTOM - 7) * S, (hx + 18) * S, (CRATE_BOTTOM - 2) * S], radius=3 * S, fill=CRATE_EDGE)

# ---- Icicles along the top of the opening, drawn last so they hang over everything ----
x = ox0 + 10
while x < ox1 - 14:
    w = rnd.uniform(8, 18)
    # Mostly short; the odd long one, kept clear of the slot headings (crates start at y 114).
    length = rnd.choice([8, 10, 12, 14, 16]) if rnd.random() < 0.8 else rnd.uniform(18, 28)
    tip_x = x + w / 2 + rnd.uniform(-2, 2)
    shape([(x, oy0 + 2), (x + w, oy0 + 2), (tip_x, oy0 + 2 + length)], ICE, outline=ICE_EDGE, width=2, amp=0.5)
    # A shine down one side.
    d.line([((x + w * 0.3) * S, (oy0 + 5) * S), ((tip_x - 1) * S, (oy0 + length - 2) * S)], fill=(255, 255, 255), width=S * 2)
    x += w + rnd.uniform(0, 6)
# Snow along the rim's edge, above the icicles.
d.rectangle([(ox0 + 2) * S, (oy0 - 1) * S, (ox1 - 2) * S, (oy0 + 4) * S], fill=ICE)

img.save(sys.argv[1] if len(sys.argv) > 1 else "cooler-inside.png")
