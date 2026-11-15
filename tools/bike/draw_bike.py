"""SCREAM-242: the new bike on Story's New Bike screen, drawn in pixels.

    python3 tools/bike/draw_bike.py public/assets/story/bike.png

An original drawing (no real product). The PO's reference (November 15) was for the shape
only: a chunky bike seen from the front left, a triangle frame, raised handlebars, a black
saddle, silver spoked wheels. He chose red. The game shows it 3 times as big with
nearest-neighbour filtering. No randomness: it redraws the same.
"""
import math
import sys

from PIL import Image, ImageDraw

W, H = 112, 80
INK = (38, 24, 40, 255)
RED = (214, 40, 48, 255)
RED_DARK = (150, 22, 40, 255)
RED_LIGHT = (255, 120, 110, 255)
TYRE = (74, 70, 92, 255)
TYRE_LIGHT = (132, 128, 152, 255)
RIM = (214, 220, 230, 255)
RIM_DARK = (150, 158, 172, 255)
SPOKE = (188, 194, 206, 255)
BLACK = (58, 54, 70, 255)
BLACK_LIGHT = (120, 116, 138, 255)

img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(img)


def ring(cx, cy, rx, ry, colour, width=1):
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], outline=colour, width=width)


def wheel(cx, cy, rx, ry):
    # Spokes first, then the rim and the tyre over their ends.
    for k in range(12):
        a = math.pi * 2 * k / 12 + 0.2
        d.line([cx, cy, cx + math.cos(a) * (rx - 4), cy + math.sin(a) * (ry - 4)], fill=SPOKE, width=1)
    ring(cx, cy, rx + 1, ry + 1, INK, 1)
    ring(cx, cy, rx, ry, TYRE, 4)
    ring(cx, cy, rx - 4, ry - 4, RIM, 1)
    ring(cx, cy, rx - 5, ry - 5, RIM_DARK, 1)
    # A lighter arc along the top left of the tyre.
    d.arc([cx - rx + 1, cy - ry + 1, cx + rx - 1, cy + ry - 1], 200, 280, fill=TYRE_LIGHT, width=1)
    d.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=RIM, outline=INK)


def tube(x1, y1, x2, y2, width=4, colour=RED, light=RED_LIGHT, dark=RED_DARK):
    d.line([x1, y1, x2, y2], fill=INK, width=width + 2)
    d.line([x1, y1, x2, y2], fill=colour, width=width)
    # Shade below, a highlight above (the tubes look round).
    n = math.hypot(x2 - x1, y2 - y1) or 1
    ox, oy = -(y2 - y1) / n, (x2 - x1) / n
    if oy > 0:
        ox, oy = -ox, -oy
    s = width / 2 - 1
    d.line([x1 - ox * s, y1 - oy * s, x2 - ox * s, y2 - oy * s], fill=dark, width=1)
    d.line([x1 + ox * s, y1 + oy * s, x2 + ox * s, y2 + oy * s], fill=light, width=1)


FRONT = (27, 53)  # front hub
REAR = (85, 46)  # rear hub
BB = (58, 56)  # bottom bracket (the pedals' axle)
HEAD_TOP = (33, 17)
HEAD_LOW = (31, 30)
SEAT_TOP = (63, 23)

# The far side of the rear triangle, then the wheels, then the near tubes over them.
wheel(REAR[0], REAR[1], 17, 22)
wheel(FRONT[0], FRONT[1], 20, 25)
tube(BB[0], BB[1], REAR[0], REAR[1], 3)  # chain stay
tube(SEAT_TOP[0] + 1, SEAT_TOP[1] + 4, REAR[0], REAR[1], 3)  # seat stay
tube(HEAD_LOW[0], HEAD_LOW[1], FRONT[0], FRONT[1], 3)  # fork
tube(HEAD_LOW[0] + 1, HEAD_LOW[1] - 2, BB[0], BB[1], 4)  # down tube
tube(HEAD_TOP[0], HEAD_TOP[1] + 5, SEAT_TOP[0], SEAT_TOP[1] + 5, 4)  # top tube
tube(SEAT_TOP[0], SEAT_TOP[1], BB[0], BB[1], 4)  # seat tube
tube(HEAD_TOP[0], HEAD_TOP[1], HEAD_LOW[0], HEAD_LOW[1], 4)  # head tube

# Chain wheel and pedals.
d.ellipse([BB[0] - 6, BB[1] - 6, BB[0] + 6, BB[1] + 6], fill=RIM_DARK, outline=INK)
d.ellipse([BB[0] - 4, BB[1] - 4, BB[0] + 4, BB[1] + 4], outline=RIM)
d.ellipse([BB[0] - 2, BB[1] - 2, BB[0] + 2, BB[1] + 2], fill=RED, outline=INK)
d.line([BB[0], BB[1], BB[0] - 8, BB[1] + 7], fill=INK, width=2)
d.rectangle([BB[0] - 13, BB[1] + 7, BB[0] - 6, BB[1] + 9], fill=BLACK, outline=INK)
d.line([BB[0], BB[1], BB[0] + 8, BB[1] - 6], fill=INK, width=2)
d.rectangle([BB[0] + 6, BB[1] - 8, BB[0] + 13, BB[1] - 6], fill=BLACK, outline=INK)

# Saddle.
d.ellipse([SEAT_TOP[0] - 10, SEAT_TOP[1] - 8, SEAT_TOP[0] + 9, SEAT_TOP[1] + 1], fill=BLACK, outline=INK)
d.line([SEAT_TOP[0] - 6, SEAT_TOP[1] - 6, SEAT_TOP[0] + 3, SEAT_TOP[1] - 6], fill=BLACK_LIGHT, width=1)

# Raised handlebars: up from the stem, out to both sides, black grips.
tube(HEAD_TOP[0], HEAD_TOP[1], HEAD_TOP[0], HEAD_TOP[1] - 4, 3)
tube(HEAD_TOP[0], HEAD_TOP[1] - 4, 22, 8, 3)
tube(HEAD_TOP[0], HEAD_TOP[1] - 4, 44, 16, 3)
for (x1, y1, x2, y2) in ((22, 8, 15, 4), (44, 16, 51, 19)):
    d.line([x1, y1, x2, y2], fill=INK, width=5)
    d.line([x1, y1, x2, y2], fill=BLACK, width=3)

img.save(sys.argv[1])
