"""Builds the uncle's picture (SCREAM-169, SCREAM-174).

Usage (run from the repo root):
    python3 tools/uncle/build_uncle.py <folder>

<folder> is LimeZu Modern Interiors' Character_Generator folder, from the private art
repo (icemachine-art/modern-interiors/2_Characters/Character_Generator).

PO (November 5): the uncle is drawn like the customers at the sales window, from the same
LimeZu character generator as the residents. Engineering picked his pieces below (brown
hair, a mustache, a red shirt); change them here and rebuild to give him another look.

Writes public/assets/limezu/uncle.png in the residents' layout for one look (384 x 64,
16 x 32 frames): idle, then walk; in a row right, up, left, down, six frames each.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'residents'))
import build_residents  # noqa: E402  (shares how layers are read and combined)

OUT_PNG = os.path.join(ROOT, 'public', 'assets', 'limezu', 'uncle.png')

UNCLE = [
    ('Bodies', 'Body_48x48_01.png'),
    ('Eyes', 'Eyes_48x48_04.png'),
    ('Outfits', 'Outfit_14_48x48_01.png'),
    ('Hairstyles', 'Hairstyle_12_48x48_03.png'),
    ('Accessories', 'Accessory_12_Mustache_48x48_03.png'),
]


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    build_residents.compose(sys.argv[1], UNCLE).save(OUT_PNG)
    print('wrote', os.path.relpath(OUT_PNG, ROOT))


if __name__ == '__main__':
    main()
