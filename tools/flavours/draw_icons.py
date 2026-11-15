"""SCREAM-129: placeholder pixel pictures of the four ice creams, until SCREAM-113's art.

    python3 tools/flavours/draw_icons.py public/assets/flavours/icons.png

One row of frames, FRAME_W x FRAME_H art pixels each, transparent background, in the
order of FLAVOURS in src/config/flavours.ts: eclair, spongepop, explorer, cookie, louball, drumcone.
The game scales them up with nearest-neighbour filtering. Original designs (no real
products or characters). Fixed random seed, so it redraws the same.
"""
import random
import sys

from PIL import Image, ImageDraw

FRAME_W, FRAME_H = 28, 36
ORDER = ["eclair", "spongepop", "explorer", "cookie", "louball", "drumcone"]
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
    """SCREAM-130 (PO, November 2): a character pop, shaped like a face, with gumball eyes.
    Our own explorer girl: ginger braids with bows, freckles, a safari hat (not any real
    character). PO: a girl, and smaller eyes (the big ones looked creepy)."""
    img, d, R = frame(2)
    cx = 14
    stick(R, cx, 27, 8)
    # Ginger braids down each side, tied with green bows, behind the face.
    for side in (-1, 1):
        bx = cx + side * 10
        for k, y in enumerate(range(13, 25, 3)):
            R(bx - 2 + (k % 2) * side, y, 4, 3, (214, 110, 46, 255))
            R(bx - 2 + (k % 2) * side, y + 2, 4, 1, (160, 74, 28, 255))
        R(bx - 2, 25, 4, 2, (60, 160, 80, 255))
    # The face: a round pop in one even colour (PO: the strawberry layer below read as a beard).
    d.ellipse([cx - 9, 9, cx + 9, 28], fill=(120, 60, 50, 255))
    d.ellipse([cx - 8, 10, cx + 8, 27], fill=(250, 210, 186, 255))
    # Ginger fringe under the hat.
    d.chord([cx - 8, 10, cx + 8, 22], 200, 340, fill=(214, 110, 46, 255))
    # Gumball eyes: small and round, with a shine.
    for ex in (cx - 4, cx + 3):
        R(ex, 17, 2, 3, (40, 120, 210, 255))
        R(ex, 17, 1, 1, (255, 255, 255, 255))
        R(ex - 1, 16, 1, 1, (90, 50, 40, 255))   # a lash
    # Freckles, rosy cheeks and a smile.
    for fx in (cx - 6, cx - 5, cx + 5, cx + 6):
        R(fx, 21, 1, 1, (200, 110, 90, 255))
    for chx in (cx - 7, cx + 5):
        R(chx, 22, 2, 1, (244, 156, 166, 255))
    d.arc([cx - 3, 20, cx + 3, 25], 20, 160, fill=(150, 40, 50, 255), width=1)
    # The safari hat: a khaki dome with a wide brim and a dark band.
    d.ellipse([cx - 8, 1, cx + 8, 14], fill=(206, 184, 120, 255), outline=(120, 100, 56, 255))
    R(cx - 13, 11, 27, 3, (190, 166, 102, 255))
    R(cx - 13, 13, 27, 1, (120, 100, 56, 255))
    R(cx - 8, 9, 17, 2, (110, 74, 40, 255))
    R(cx - 4, 3, 3, 2, (232, 216, 160, 255))   # shine on the dome
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


def louball():
    """SCREAM-334 (the PO's second sketch, November 15, "Lets switch to this design"): a long
    cone-shaped cup lying on a slant, point down to the left; a round lid on top that says
    "Lou" with "II" under it; two gumballs side by side in the point. (His first sketch had a
    crowned smiling face on the lid.)"""
    img, d, R = frame(4)
    ink = (60, 34, 30, 255)
    blue = (40, 70, 160, 255)
    # The cup: a cone from the lid down to a rounded point, bottom left. Cherry ice inside.
    d.polygon([(8, 11), (25, 17), (6, 35), (2, 34), (1, 30)], fill=ink)
    d.polygon([(9, 13), (23, 18), (6, 33), (3, 32), (3, 30)], fill=(232, 70, 96, 255))
    d.polygon([(10, 14), (14, 15), (5, 30), (4, 30)], fill=(248, 128, 146, 255))  # a shine down one side
    # Two gumballs in the point, side by side.
    d.ellipse([3, 27, 8, 32], fill=ink)
    d.ellipse([4, 28, 7, 31], fill=(70, 150, 240, 255))
    d.ellipse([8, 25, 13, 30], fill=ink)
    d.ellipse([9, 26, 12, 29], fill=(250, 214, 70, 255))
    R(5, 28, 1, 1, (200, 226, 255, 255))
    R(10, 26, 1, 1, (255, 246, 190, 255))
    # The lid: a flat oval, tilted with the cup.
    d.ellipse([5, 0, 27, 16], fill=ink)
    d.ellipse([6, 1, 26, 15], fill=(250, 246, 234, 255))
    # "LOU" in 3 x 5 pixel letters...
    x, y = 9, 3
    R(x, y, 1, 5, blue); R(x, y + 4, 3, 1, blue)                                   # L
    x += 4
    R(x, y, 1, 5, blue); R(x + 2, y, 1, 5, blue); R(x, y, 3, 1, blue); R(x, y + 4, 3, 1, blue)  # O
    x += 4
    R(x, y, 1, 5, blue); R(x + 2, y, 1, 5, blue); R(x, y + 4, 3, 1, blue)          # U
    # ...and "II" under it, to the right, with its bars top and bottom.
    R(15, 10, 5, 1, blue); R(15, 13, 5, 1, blue)
    R(16, 10, 1, 4, blue); R(18, 10, 1, 4, blue)
    return img


def drumcone():
    """SCREAM-335 (the PO's sketch, November 15): an upright waffle cone with crosshatch marks,
    a rounded scoop on top with a bumpy chocolate coating and bits on it, and a bite out of
    the top left of the scoop (vanilla showing)."""
    img, d, R = frame(5)
    ink = (60, 34, 20, 255)
    cx = 14
    # The scoop: a bumpy dome of chocolate coating over the cone's top.
    d.ellipse([cx - 11, 1, cx + 11, 19], fill=ink)
    d.ellipse([cx - 10, 2, cx + 10, 18], fill=(110, 62, 34, 255))
    for bx, by in [(-9, 11), (-4, 12), (1, 12), (6, 12), (9, 11)]:
        d.ellipse([cx + bx - 3, by, cx + bx + 3, by + 5], fill=ink)
        d.ellipse([cx + bx - 2, by, cx + bx + 2, by + 4], fill=(110, 62, 34, 255))
    R(cx - 8, 11, 17, 3, (110, 62, 34, 255))
    # Bits on the coating.
    for bx, by in [(2, 5), (6, 8), (-1, 9), (4, 12), (-5, 12), (8, 12), (0, 14), (-8, 10)]:
        R(cx + bx, by, 2, 1, (240, 214, 160, 255))
    R(cx + 3, 3, 3, 1, (150, 96, 60, 255))  # a shine
    # The bite, top left: vanilla inside, a dark edge.
    d.ellipse([cx - 13, -2, cx - 2, 9], fill=(0, 0, 0, 0))
    d.ellipse([cx - 6, 4, cx - 1, 10], fill=(252, 244, 222, 255))
    d.ellipse([cx - 9, 6, cx - 4, 11], fill=(252, 244, 222, 255))
    # The cone: a long triangle, waffle brown, with a crosshatch.
    d.polygon([(cx - 8, 16), (cx + 8, 16), (cx, 35)], fill=ink)
    d.polygon([(cx - 6, 17), (cx + 6, 17), (cx, 33)], fill=(222, 170, 96, 255))
    for k in range(-12, 13, 4):
        for y in range(17, 33):
            for x in (cx + k + (y - 17), cx + k - (y - 17)):
                if abs(x - cx) <= (33 - y) * 6 / 17 - 0.5:
                    R(int(x), y, 1, 1, (170, 112, 52, 255))
    return img


for i, fn in enumerate([eclair, spongepop, explorer, cookie, louball, drumcone]):
    sheet.paste(fn(), (i * FRAME_W, 0))
sheet.save(sys.argv[1] if len(sys.argv) > 1 else "icons.png")
