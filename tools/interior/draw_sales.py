"""SCREAM-125: the sales window screen's background, in the style of the PO's truck drawing.

Inside the truck, looking out of the serving window: the striped wall from the drawing,
a chunky grey window frame, the glass pane slid to the left half (the bubble sits over
it), the right half open to the street (the customer stands there), the underside of the
dark-red awning along the top, sky and a strip of lawn outside, and the white counter
shelf along the bottom with the drawing's cardboard box and green cup on it. A plain
panel below the counter keeps the buttons and key hints easy to read.

    python3 tools/interior/draw_sales.py public/assets/interior/sales-window.png

Coordinates are on the 960 x 540 screen; the picture is drawn at twice that, like the
other interior pictures. Fixed random seed, so it redraws the same. Keep WINDOW, PANE_SPLIT
and COUNTER in step with SalesScene.ts (COUNTER_TOP, CUSTOMER_X).
"""
import math
import random
import sys

from PIL import Image, ImageDraw

S = 2
W, H = 960 * S, 540 * S
rnd = random.Random(125)

OUTLINE = (127, 127, 127)
WALL_CREAM = (239, 228, 176)
WALL_GREEN = (225, 245, 165)
FRAME = (200, 200, 200)
SKY = (150, 215, 232)
SKY_LOW = (186, 230, 240)
CLOUD = (244, 251, 253)
LAWN = (128, 196, 96)
LAWN_DARK = (106, 172, 80)
GLASS = (207, 238, 245)
AWNING = (110, 12, 12)
AWNING_DARK = (78, 6, 6)
SHELF = (246, 246, 246)
BOX = (185, 122, 87)
BOX_TOP = (205, 148, 110)
CUP = (34, 177, 76)
CUP_DARK = (24, 140, 58)

# Shared with SalesScene.
WINDOW = (40, 76, 920, 418)      # the opening, inside the frame
PANE_SPLIT = 612                 # where the slid-open glass pane ends
COUNTER = (24, 412, 936, 444)    # the shelf along the bottom of the window

img = Image.new("RGB", (W, H), WALL_CREAM)
d = ImageDraw.Draw(img)


def wobbly(points, step=9, amp=1.6):
    out = []
    n = len(points)
    for i in range(n):
        (x0, y0), (x1, y1) = points[i], points[(i + 1) % n]
        length = math.hypot(x1 - x0, y1 - y0)
        pieces = max(1, int(length / step))
        nx, ny = (-(y1 - y0) / length, (x1 - x0) / length) if length else (0, 0)
        phase = rnd.uniform(0, 6.28)
        for k in range(pieces):
            t = k / pieces
            w = amp * math.sin(phase + t * 5.0) * math.sin(math.pi * t)
            out.append(((x0 + (x1 - x0) * t + nx * w) * S, (y0 + (y1 - y0) * t + ny * w) * S))
    return out


def box(x0, y0, x1, y1, fill, outline=OUTLINE, width=3, cut=0, amp=1.6):
    c = cut
    pts = wobbly([(x0 + c, y0), (x1 - c, y0), (x1, y0 + c), (x1, y1 - c), (x1 - c, y1), (x0 + c, y1), (x0, y1 - c), (x0, y0 + c)], amp=amp)
    if fill is not None:
        d.polygon(pts, fill=fill)
    if outline:
        d.line(pts + [pts[0]], fill=outline, width=width * S, joint="curve")


def rect(x0, y0, x1, y1, fill):
    d.rectangle([x0 * S, y0 * S, x1 * S - 1, y1 * S - 1], fill=fill)


# ---- The wall: the drawing's stripes, and a plain panel below the counter ----
for y in range(0, 450, 20):
    rect(0, y, 960, y + 10, WALL_GREEN)
rect(0, 448, 960, 540, WALL_CREAM)
d.line([0, 448 * S, W, 448 * S], fill=OUTLINE, width=2 * S)

# ---- The window frame ----
x0, y0, x1, y1 = WINDOW
box(x0 - 16, y0 - 16, x1 + 16, y1 + 8, FRAME, width=4, cut=10)

# ---- Outside: sky with a few clouds, a strip of lawn ----
rect(x0, y0, x1, y1, SKY)
rect(x0, y1 - 120, x1, y1 - 40, SKY_LOW)
for cx, cy, r in [(110, 300, 22), (146, 292, 28), (184, 302, 18), (420, 330, 20), (452, 322, 26), (760, 180, 18), (790, 172, 24), (826, 182, 18)]:
    d.ellipse([(cx - r) * S, (cy - r * 0.6) * S, (cx + r) * S, (cy + r * 0.6) * S], fill=CLOUD)
rect(x0, y1 - 40, x1, y1, LAWN)
for gx in range(x0 + 6, x1, 14):
    d.line([gx * S, (y1 - 40) * S, (gx + 3) * S, (y1 - 46) * S], fill=LAWN_DARK, width=2 * S)

# ---- The glass pane, slid open over the left part: see-through, a little lighter ----
glass = Image.new("RGB", (W, H), GLASS)
mask = Image.new("L", (W, H), 0)
ImageDraw.Draw(mask).rectangle([x0 * S, y0 * S, PANE_SPLIT * S - 1, y1 * S - 1], fill=150)
img.paste(glass, (0, 0), mask)
for sx in (120, 150, 400, 430):
    d.line([(sx) * S, (y1 - 10) * S, (sx + 120) * S, (y0 + 30) * S], fill=(255, 255, 255), width=5 * S)
box(x0, y0, PANE_SPLIT, y1, None, width=3, amp=0.8)
box(PANE_SPLIT - 3, y0, PANE_SPLIT + 9, y1, FRAME, width=3, amp=0.8)

# ---- The awning's underside along the top ----
rect(x0, y0, x1, y0 + 18, AWNING)
for sx in range(x0, x1, 40):
    d.pieslice([sx * S, (y0 + 6) * S, (sx + 40) * S, (y0 + 30) * S], 0, 180, fill=AWNING)
    d.arc([sx * S, (y0 + 6) * S, (sx + 40) * S, (y0 + 30) * S], 0, 180, fill=AWNING_DARK, width=2 * S)
box(x0 - 16, y0 - 16, x1 + 16, y1 + 8, None, width=4, cut=10)
box(x0, y0, x1, y1, None, width=3, amp=0.8)

# ---- The counter shelf, with the drawing's cardboard box and green cup ----
box(*COUNTER, SHELF, width=3, cut=4)
box(58, 360, 132, 414, BOX, width=3, amp=1.0)
rect(61, 363, 129, 372, BOX_TOP)
rect(91, 361, 99, 412, (222, 196, 150))
box(146, 352, 178, 414, CUP, width=3, cut=4, amp=0.8)
rect(150, 356, 174, 362, CUP_DARK)

img.save(sys.argv[1] if len(sys.argv) > 1 else "sales-window.png")
