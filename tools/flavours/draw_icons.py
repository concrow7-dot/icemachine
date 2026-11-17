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
    Our own explorer girl: braids with bows, a safari hat (not any real character). PO: a girl,
    and smaller eyes (the big ones looked creepy). SCREAM-375 (PO, November 16): "make a more
    latino looking explorer": warm brown skin, dark brown braids and fringe, brown eyes (she was
    ginger with freckles and blue eyes)."""
    img, d, R = frame(2)
    cx = 14
    hair, hair_dark = (64, 38, 24, 255), (38, 22, 14, 255)
    stick(R, cx, 27, 8)
    # Dark brown braids down each side, tied with green bows, behind the face.
    for side in (-1, 1):
        bx = cx + side * 10
        for k, y in enumerate(range(13, 25, 3)):
            R(bx - 2 + (k % 2) * side, y, 4, 3, hair)
            R(bx - 2 + (k % 2) * side, y + 2, 4, 1, hair_dark)
        R(bx - 2, 25, 4, 2, (60, 160, 80, 255))
    # The face: a round pop in one even colour (PO: the strawberry layer below read as a beard).
    d.ellipse([cx - 9, 9, cx + 9, 28], fill=(104, 58, 36, 255))
    d.ellipse([cx - 8, 10, cx + 8, 27], fill=(198, 140, 96, 255))
    # Dark fringe under the hat.
    d.chord([cx - 8, 10, cx + 8, 22], 200, 340, fill=hair)
    # Gumball eyes: small and round, brown, with a shine.
    for ex in (cx - 4, cx + 3):
        R(ex, 17, 2, 3, (58, 32, 18, 255))
        R(ex, 17, 1, 1, (255, 255, 255, 255))
        R(ex - 1, 16, 1, 1, hair_dark)   # a lash
    # Rosy cheeks and a smile.
    for chx in (cx - 7, cx + 5):
        R(chx, 22, 2, 1, (226, 124, 112, 255))
    d.arc([cx - 3, 20, cx + 3, 25], 20, 160, fill=(120, 34, 40, 255), width=1)
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
    """SCREAM-334. The PO's sketches and words, November 15: a cone cup on a slant with two
    gumballs in the point; "It should look more like this" (a photo of a cup of ice); "Make sure
    to include the two balls at the bottom of the cone"; with a close-up sketch of the rim, "I
    want the edges to meet" (the cup's sides run straight from the two ends of the lid's oval)
    and "Remove lou and I" (a plain lid); then "Still too circular", with a sketch of a long
    flat oval tilted up to the right: the lid is seen nearly edge-on."""
    import math
    img, d, R = frame(4)
    ink = (60, 34, 30, 255)
    plastic = (236, 226, 230, 255)

    def oval(cx, cy, rx, ry, degrees):
        t = math.radians(degrees)
        return [(cx + rx * math.cos(a) * math.cos(t) - ry * math.sin(a) * math.sin(t),
                 cy + rx * math.cos(a) * math.sin(t) + ry * math.sin(a) * math.cos(t))
                for a in [k * math.pi / 18 for k in range(36)]]

    # The lid: a long flat oval, tilted up to the right. Its two ends are where the cup's sides start.
    cx, cy, rx, ry, tilt = 16, 6, 11, 3.6, -13
    t = math.radians(tilt)
    left_end = (round(cx - rx * math.cos(t)), round(cy - rx * math.sin(t)))
    right_end = (round(cx + rx * math.cos(t)), round(cy + rx * math.sin(t)))
    # The cup: straight sides from the oval's ends down to a rounded point, bottom left.
    d.polygon([left_end, right_end, (9, 35), (4, 35), (1, 32), (1, 28)], fill=ink)
    # Clear plastic wall, then the cherry ice inside it, with a shine down one side.
    d.polygon([(left_end[0] + 1, left_end[1] + 1), (right_end[0] - 2, right_end[1] + 1), (8, 34), (5, 34), (2, 32), (2, 28)], fill=plastic)
    d.polygon([(8, 10), (23, 6), (11, 30), (6, 27)], fill=(226, 60, 88, 255))
    d.polygon([(9, 12), (12, 11), (8, 25), (7, 24)], fill=(246, 122, 140, 255))
    d.polygon([(20, 10), (22, 8), (12, 29), (11, 29)], fill=(190, 40, 70, 255))
    # The two balls at the bottom of the cone, side by side.
    d.ellipse([2, 27, 8, 33], fill=ink)
    d.ellipse([3, 28, 7, 32], fill=(70, 150, 240, 255))
    d.ellipse([7, 24, 13, 30], fill=ink)
    d.ellipse([8, 25, 12, 29], fill=(250, 214, 70, 255))
    R(4, 29, 1, 1, (210, 232, 255, 255))
    R(9, 26, 1, 1, (255, 248, 200, 255))
    # The lid, drawn over the top of the cup so the edges meet: a dark edge, a rim, a plain white top.
    d.polygon(oval(cx, cy, rx, ry, tilt), fill=ink)
    d.polygon(oval(cx, cy, rx - 1, ry - 1, tilt), fill=(214, 216, 226, 255))
    d.polygon(oval(cx, cy - 0.3, rx - 2.2, ry - 1.7, tilt), fill=(252, 250, 244, 255))
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
