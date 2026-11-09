"""Pictures of each resident as they look at the sales window, for the residents sheets.

Usage (from the repo root): python3 tools/residents/portraits.py
Writes docs/portraits/<ID>.png for every resident on both maps: the idle, facing-down
frame from the residents sheet, cropped to the rows the window shows (head down to the
counter, SalesScene's CUSTOMER_ROWS) and smoothed 8x with Scale2x, like the window does
(src/ui/smoothPixels.ts). Sheets 15 and 23 show them with =IMAGE() in their Picture column.
"""
import os, re
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'docs', 'portraits')
FW, FH, ACROSS, ROWS = 16, 32, 5, 29  # frame size, looks across, CUSTOMER_ROWS
SETS = [('src/config/residents.ts', 'public/assets/limezu/residents.png'),
        ('src/config/tutorialResidents.ts', 'public/assets/limezu/residents-tutorial.png')]

def scale2x(im):
    w, h = im.size; s = im.load(); out = Image.new('RGBA', (w * 2, h * 2)); o = out.load()
    at = lambda x, y: s[min(w - 1, max(0, x)), min(h - 1, max(0, y))]
    for y in range(h):
        for x in range(w):
            p, a, b, c, d = at(x, y), at(x, y - 1), at(x + 1, y), at(x - 1, y), at(x, y + 1)
            o[2*x, 2*y] = a if c == a and c != d and a != b else p
            o[2*x+1, 2*y] = b if a == b and a != c and b != d else p
            o[2*x, 2*y+1] = c if d == c and d != b and c != a else p
            o[2*x+1, 2*y+1] = d if b == d and b != a and d != c else p
    return out

os.makedirs(OUT, exist_ok=True)
for ts, png in SETS:
    sheet = Image.open(os.path.join(ROOT, png)).convert('RGBA')
    for rid, look in re.findall(r'"id":"(\w+)","name":"[^"]*","kid":\w+,"street":"[^"]*","likelihood":[\d.]+,"look":(\d+)', open(os.path.join(ROOT, ts)).read()):
        look = int(look)
        x = (look % ACROSS) * 24 * FW + 3 * 6 * FW  # facing down, first idle frame
        y = (look // ACROSS) * 2 * FH
        im = sheet.crop((x, y, x + FW, y + ROWS))
        for _ in range(3): im = scale2x(im)
        im.save(os.path.join(OUT, f'{rid}.png'))
print(len(os.listdir(OUT)), 'pictures in docs/portraits')
