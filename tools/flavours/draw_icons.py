"""SCREAM-129: placeholder pixel pictures of the four ice creams, until SCREAM-113's art.

    python3 tools/flavours/draw_icons.py public/assets/flavours/icons.png

One row of frames, FRAME_W x FRAME_H art pixels each, transparent background, in the
order of FLAVOURS in src/config/flavours.ts: eclair, spongepop, explorer, cookie.
The game scales them up with nearest-neighbour filtering. Original designs (no real
products or characters). Fixed random seed, so it redraws the same.
"""
import random
import sys

from PIL import Image, ImageDraw

FRAME_W, FRAME_H = 28, 36
ORDER = ["eclair", "spongepop", "explorer", "cookie"]
rnd = random.Random(129)

sheet = Image.new("RGBA", (FRAME_W * len(ORDER), FRAME_H), (0, 0, 0, 0))


def frame(index):
    img = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    R = lambda x, y, w, h, c: d.rectangle([x, y, x + w - 1, y + h - 1], fill=c)
    return img, d, R


def stick(R, cx, top, length=8):
    R(cx - 1, top, 3, length, (222, 190, 130, 255))
    R(cx + 1, top, 1, length, (190, 150, 95, 255))


def eclair():
    img, d, R = frame(0)
    cx, cy = 14, 15
    stick(R, cx, cy + 12)
    R(cx - 7, cy - 13, 15, 26, (70, 40, 22, 255))
    R(cx - 6, cy - 12, 13, 24, (150, 96, 54, 255))
    for _ in range(46):
        R(cx - 6 + rnd.randint(0, 12), cy - 12 + rnd.randint(0, 23), 1, 1,
          rnd.choice([(196, 140, 82, 255), (110, 66, 34, 255), (232, 196, 140, 255)]))
    # A bite from the top corner: vanilla with a chocolate middle.
    d.polygon([(cx + 8, cy - 14), (cx, cy - 14), (cx + 8, cy - 5)], fill=(0, 0, 0, 0))
    d.polygon([(cx + 6, cy - 12), (cx + 1, cy - 12), (cx + 6, cy - 6)], fill=(250, 244, 228, 255))
    d.polygon([(cx + 5, cy - 11), (cx + 3, cy - 11), (cx + 5, cy - 8)], fill=(75, 42, 26, 255))
    return img


def spongepop():
    img, d, R = frame(1)
    cx, cy = 14, 15
    stick(R, cx, cy + 11)
    R(cx - 9, cy - 12, 19, 24, (120, 96, 18, 255))
    R(cx - 8, cy - 11, 17, 22, (250, 222, 60, 255))
    R(cx - 8, cy + 9, 17, 2, (226, 190, 40, 255))
    for hx, hy, s in [(-6, -8, 2), (2, -9, 3), (-2, -3, 2), (4, -1, 3), (-7, 2, 3), (1, 5, 2), (6, 6, 1), (-4, 7, 1)]:
        R(cx + hx, cy + hy, s, s, (206, 168, 30, 255))
    R(cx - 8, cy - 11, 17, 1, (255, 245, 160, 255))
    return img


def explorer():
    img, d, R = frame(2)
    cx, cy = 14, 16
    stick(R, cx, cy + 11)
    d.polygon([(cx - 6, cy - 6), (cx, cy - 16), (cx + 6, cy - 6)], fill=(220, 50, 50, 255), outline=(120, 30, 30, 255))
    R(cx - 6, cy - 6, 13, 17, (245, 245, 240, 255))
    R(cx - 6, cy - 6, 1, 17, (190, 190, 186, 255))
    d.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=(60, 140, 220, 255), outline=(40, 40, 60, 255))
    d.polygon([(cx - 6, cy + 3), (cx - 11, cy + 11), (cx - 6, cy + 11)], fill=(240, 140, 30, 255))
    d.polygon([(cx + 6, cy + 3), (cx + 11, cy + 11), (cx + 6, cy + 11)], fill=(240, 140, 30, 255))
    R(cx - 6, cy + 9, 13, 2, (240, 140, 30, 255))
    return img


def cookie():
    img, d, R = frame(3)
    cx, cy = 14, 18
    for top in (cy - 10, cy + 3):
        R(cx - 13, top, 27, 7, (60, 34, 18, 255))
        R(cx - 12, top + 1, 25, 5, (100, 60, 34, 255))
        for _ in range(10):
            R(cx - 11 + rnd.randint(0, 22), top + rnd.randint(1, 5), 1, 1, (40, 22, 10, 255))
    R(cx - 12, cy - 3, 25, 6, (252, 246, 226, 255))
    R(cx - 12, cy + 2, 25, 1, (230, 220, 190, 255))
    return img


for i, fn in enumerate([eclair, spongepop, explorer, cookie]):
    sheet.paste(fn(), (i * FRAME_W, 0))
sheet.save(sys.argv[1] if len(sys.argv) > 1 else "icons.png")
