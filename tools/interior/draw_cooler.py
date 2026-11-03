"""SCREAM-124 / SCREAM-129: the cooler screen's background, in the style of the PO's truck drawing.

Three parts, from the PO's sketch (SCREAM-129):
- left: the "Available Ice Cream" clipboard (wooden board, metal clip, paper);
- top right: the open freezer, steel rim, dark inside with cartoon icicles and boxes,
  and three plastic crates of 4 x 4 squares (the PO's photo of a real truck freezer);
- bottom right: the truck's outside wall, where Today's Menu hangs.
The game draws everything that changes on top: the clipboard's rows and total, the ice
creams in the squares, the menu cards, and the glass lids that slide open.

    python3 tools/interior/draw_cooler.py public/assets/interior/cooler-inside.png

Coordinates are on the 960 x 540 screen; the picture is drawn at twice that, like
truck-interior.png. Fixed random seed, so it redraws the same. Keep the numbers marked
"shared" in step with COOLER_LAYOUT in src/scenes/CoolerScene.ts.
"""
import math
import random
import sys

from PIL import Image, ImageDraw

S = 2
W, H = 960 * S, 540 * S
rnd = random.Random(124)

OUTLINE = (127, 127, 127)
WALL_CREAM = (239, 228, 176)
WALL_GREEN = (225, 245, 165)
FLOOR = (195, 195, 195)
STEEL = (204, 204, 204)
INSIDE = (18, 27, 40)
INSIDE_BACK = (33, 47, 68)
ICE = (233, 251, 255)
ICE_EDGE = (150, 205, 225)
BOX = (185, 122, 87)
BOX_TOP = (205, 148, 110)
BOX_TAPE = (222, 196, 150)
CRATE = (228, 214, 176)
CRATE_EDGE = (150, 128, 88)
CRATE_CELL = (214, 198, 156)
WOOD = (176, 120, 70)
WOOD_DARK = (128, 84, 46)
PAPER = (252, 250, 240)
PAPER_LINE = (200, 222, 240)
CLIP = (170, 176, 182)
PANEL = (231, 236, 238)
PANEL_FRAME = (160, 168, 172)

# Shared with CoolerScene (COOLER_LAYOUT).
CLIPBOARD = (12, 50, 236, 504)
PAPER_BOX = (24, 82, 224, 494)
FREEZER = (248, 50, 950, 288)
OPENING = (262, 72, 936, 280)
CRATE_LEFTS = [319, 519, 719]
CRATE_TOP = 96
CELL = 38
CELL_PAD = 4
CRATE_SIZE = 4 * CELL + 2 * CELL_PAD   # 160
BOARD = (248, 296, 950, 504)

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


# ---- Truck wall behind, floor strip at the bottom (the key hints sit there) ----
for y in range(0, 510, 20):
    rect(0, y, 960, y + 10, WALL_GREEN)
rect(0, 506, 960, 540, FLOOR)
d.line([0, 506 * S, W, 506 * S], fill=OUTLINE, width=2 * S)

# ---- The clipboard ----
box(*CLIPBOARD, WOOD, outline=WOOD_DARK, width=3, cut=12)
box(*PAPER_BOX, PAPER, outline=(190, 186, 170), width=2, cut=2, amp=0.8)
for y in range(PAPER_BOX[1] + 40, PAPER_BOX[3] - 6, 18):
    d.line([(PAPER_BOX[0] + 6) * S, y * S, (PAPER_BOX[2] - 6) * S, y * S], fill=PAPER_LINE, width=S)
d.line([(PAPER_BOX[0] + 22) * S, (PAPER_BOX[1] + 2) * S, (PAPER_BOX[0] + 22) * S, (PAPER_BOX[3] - 2) * S], fill=(240, 180, 180), width=S)
# The metal clip across the top.
cx = (CLIPBOARD[0] + CLIPBOARD[2]) / 2
box(cx - 52, 56, cx + 52, 88, CLIP, outline=(110, 114, 120), width=3, cut=8)
box(cx - 20, 48, cx + 20, 62, CLIP, outline=(110, 114, 120), width=3, cut=6)
d.ellipse([(cx - 6) * S, 51 * S, (cx + 6) * S, 59 * S], fill=(90, 94, 100))

# ---- The freezer ----
box(*FREEZER, STEEL, width=4, cut=12)
ox0, oy0, ox1, oy1 = OPENING
box(ox0, oy0, ox1, oy1, INSIDE, width=4, cut=6)
rect(ox0 + 4, oy0 + 4, ox1 - 4, oy0 + 20, INSIDE_BACK)
for _ in range(110):
    x, y = rnd.uniform(ox0 + 8, ox1 - 8), rnd.uniform(oy0 + 6, oy1 - 6)
    r = rnd.uniform(0.6, 1.4)
    d.ellipse([(x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S], fill=(70, 96, 122))
# Cardboard boxes at the back and in the gaps between crates.
for bx, bw, bh in [(272, 40, 20), (350, 60, 16), (470, 52, 22), (566, 64, 14), (672, 44, 20), (770, 58, 16), (880, 48, 22)]:
    top = CRATE_TOP + 6 - bh
    box(bx, top, bx + bw, CRATE_TOP + 12, BOX, width=2, amp=1.0)
    rect(bx + 3, top + 3, bx + bw - 3, top + 7, BOX_TOP)
    rect(bx + bw / 2 - 4, top + 2, bx + bw / 2 + 4, CRATE_TOP + 10, BOX_TAPE)
# The crates, 4 x 4 squares each.
for left in CRATE_LEFTS:
    top = CRATE_TOP
    box(left, top, left + CRATE_SIZE, top + CRATE_SIZE, CRATE, outline=CRATE_EDGE, width=3, cut=8)
    for i in range(4):
        for j in range(4):
            x = left + CELL_PAD + i * CELL
            y = top + CELL_PAD + j * CELL
            rect(x + 2, y + 2, x + CELL - 2, y + CELL - 2, CRATE_CELL)
# Icicles along the rim, drawn last so they hang over the back.
x = ox0 + 10
while x < ox1 - 14:
    w = rnd.uniform(8, 16)
    length = rnd.choice([8, 10, 12, 14]) if rnd.random() < 0.8 else rnd.uniform(16, 20)
    tip_x = x + w / 2 + rnd.uniform(-2, 2)
    pts = wobbly([(x, oy0 + 2), (x + w, oy0 + 2), (tip_x, oy0 + 2 + length)], amp=0.5)
    d.polygon(pts, fill=ICE)
    d.line(pts + [pts[0]], fill=ICE_EDGE, width=2 * S)
    d.line([((x + w * 0.3) * S, (oy0 + 5) * S), ((tip_x - 1) * S, (oy0 + length - 2) * S)], fill=(255, 255, 255), width=S * 2)
    x += w + rnd.uniform(0, 6)
rect(ox0 + 2, oy0 - 1, ox1 - 2, oy0 + 4, ICE)

# ---- The truck's outside wall, where Today's Menu hangs ----
box(*BOARD, PANEL_FRAME, outline=OUTLINE, width=3, cut=6)
rect(BOARD[0] + 8, BOARD[1] + 8, BOARD[2] - 8, BOARD[3] - 8, PANEL)
for rx in range(BOARD[0] + 20, BOARD[2] - 10, 40):
    for ry in (BOARD[1] + 4, BOARD[3] - 5):
        rect(rx, ry, rx + 3, ry + 2, (214, 218, 220))
for x0 in (BOARD[0] + 60, BOARD[0] + 420):
    for k in range(3):
        d.line([((x0 + k * 10) * S, (BOARD[3] - 12) * S), ((x0 + 120 + k * 10) * S, (BOARD[1] + 12) * S)], fill=(242, 246, 247), width=3 * S)

img.save(sys.argv[1] if len(sys.argv) > 1 else "cooler-inside.png")
