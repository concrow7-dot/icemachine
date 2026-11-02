"""SCREAM-115: builds the driving truck's four views from LimeZu Modern Exteriors.

Left and right are the pack's own ice cream truck (the title screen's truck).
The pack has no ice cream truck seen from the front or back, so those two views
are its ambulance (the same van body) repainted in the ice cream truck's colours,
with the truck's cone and scoop on the roof.

Run: python3 tools/truck/build_truck.py <Modern_Exteriors_Complete_Singles_48x48.zip>
Writes public/assets/limezu/truck_views.png: four 16 px views, two by two
(right, down, left, up), each centred in a 110 px square frame.
"""
import sys, zipfile, io, json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
P = 'Modern_Exteriors_Complete_Singles_48x48/ME_Singles_Vehicles_48x48_'


def load(z, name):
    im = Image.open(io.BytesIO(z.read(P + name))).convert('RGBA')
    im = im.crop(im.getbbox())
    # The pack's 48 px art is a 3x enlargement of 16 px art.
    return im.resize((im.width // 3, im.height // 3), Image.NEAREST)


def hx(s):
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


# Ambulance colour -> ice cream truck colour, for the roof and for the body.
ROOF = {
    'f8f8f8': '6fb5a0', 'ebe4f2': '5ea592', 'd8d0e0': '49928f', 'c6bdd5': '367f82', 'b2aecb': '367f82',
    '989ebe': 'b95d72', '4995e3': 'eea5b8', '50a7e8': 'f6c9d4', '3d56d2': 'd6779d',
    '6b383b': '94566f', 'e63f38': 'eea5b8',
}
BODY = {
    'f8f8f8': 'f2b6c6', 'ebe4f2': 'eea5b8', 'd8d0e0': 'd6779d', 'c6bdd5': 'b95d72', 'b2aecb': 'b95d72',
    '9da3b7': '94566f', '6b383b': '94566f', 'fc5c46': '5ea592', 'a82b2d': '367f82', '9e2b2d': '367f82',
    '4995e3': 'eea5b8', '50a7e8': 'f6c9d4', '3d56d2': 'd6779d', '989ebe': 'b95d72', 'e63f38': 'eea5b8',
}


def repaint(im, roof_end, red_rows_to_body):
    out = im.copy()
    px = out.load()
    for y in range(im.height):
        table = ROOF if y < roof_end else BODY
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            k = '%02x%02x%02x' % (r, g, b)
            if k == 'cb2a2a':
                # The rear doors' red crosses and stripes: crosses become plain door, stripes teal.
                new = 'd6779d' if y in red_rows_to_body else '367f82'
            elif y in red_rows_to_body and k == 'f8f8f8':
                new = 'd6779d'
            else:
                new = table.get(k)
            if new:
                px[x, y] = hx(new) + (a,)
    return out


def cone(side):
    """The cone and scoop from the side view's roof (everything above the roof line)."""
    top = side.crop((0, 0, side.width, 30))
    px = top.load()
    keep = Image.new('RGBA', top.size)
    kp = keep.load()
    teal = {hx(c) for c in ('367f82', '5ea592', '49928f', '2e7177', '3a3a50', '46465e', '565972', '7d7f99')}
    for y in range(top.height):
        for x in range(top.width):
            p = px[x, y]
            if p[3] and p[:3] not in teal:
                kp[x, y] = p
    bb = keep.getbbox()
    return keep.crop(bb)


def main(zip_path):
    z = zipfile.ZipFile(zip_path)
    side = load(z, 'Ice_Cream_Truck_1.png')
    down = repaint(load(z, 'Ambulance_Down_1.png'), 60, set())
    up = repaint(load(z, 'Ambulance_Up_1.png'), 63, set(range(70, 82)))
    c = cone(side)
    for v, roof_mid in ((down, 30), (up, 33)):
        v.alpha_composite(c, ((v.width - c.width) // 2, roof_mid - c.height // 2))
    right = side
    left = side.transpose(Image.FLIP_LEFT_RIGHT)
    # The pack's side view faces left (cab on the right means driving right).
    views = [right, down, left, up]
    size = max(max(v.width, v.height) for v in views)
    # Two by two (right, down / left, up): a long one-row sheet drew the last view torn when tilted.
    sheet = Image.new('RGBA', (size * 2, size * 2))
    for i, v in enumerate(views):
        sheet.alpha_composite(v, ((i % 2) * size + (size - v.width) // 2, (i // 2) * size + (size - v.height) // 2))
    out = ROOT / 'public/assets/limezu/truck_views.png'
    sheet.save(out)
    print(out, sheet.size, [v.size for v in views])


if __name__ == '__main__':
    main(sys.argv[1])
