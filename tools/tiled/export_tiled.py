"""Exports the generated Worcester map to a Tiled project, so the PO can lay it out by hand
(the way the tutorial map was started for SCREAM-158).

Usage (run from the repo root):
    python3 tools/tiled/export_tiled.py <out folder> [<Modern Exteriors.tsx>]

Writes <out folder>/worcester-map.tmx plus sprites/ (the game's own map pieces at 16 px,
"Map pieces" tileset) and images/ (grass, roads and sidewalks, parks and fields: locked layers).
Give the PO's "Modern Exteriors.tsx" (art repo, tiled/tutorial-map/) to add the full pack as a
tileset too; its paths (../Modern_Exteriors_16x16/...) work when the folder sits beside
tutorial-map.

Layers follow the tutorial map's names, so tools/tiled/import_tiled.py can read it back:
Houses (each "House N" keeps the residents sheet's House number, home marked "home"),
Garden ornaments, Trees, Gas station, and the read-only Game markers.
"""
import json, math, os, shutil, sys
from xml.sax.saxutils import quoteattr as qa
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SRC_TS = os.path.join(ROOT, 'src', 'config', 'worcester.ts')
ART = os.path.join(ROOT, 'public', 'assets', 'limezu', 'map')
ROADS = os.path.join(ROOT, 'public', 'assets', 'map')
COLOURS = {'park': (0x5f, 0xae, 0x5a), 'pitch': (0x4f, 0x9d, 0x4a), 'school': (0xb9, 0xad, 0x97)}


def read_map():
    s = open(SRC_TS, encoding='utf-8').read()
    i = s.index('WorcesterMap = ') + len('WorcesterMap = ')
    return json.JSONDecoder().raw_decode(s[i:])[0]


def turned(x, y, angle, hl, hw):
    a = math.radians(angle); c, s = math.cos(a), math.sin(a)
    return [(x + dx * c - dy * s, y + dx * s + dy * c) for dx, dy in ((-hl, -hw), (hl, -hw), (hl, hw), (-hl, hw))]


def main(out, tsx=None):
    m = read_map()
    W, H = m['width'], m['height']
    os.makedirs(os.path.join(out, 'sprites'), exist_ok=True)
    os.makedirs(os.path.join(out, 'images'), exist_ok=True)

    # ---- Pictures ----
    atlas = Image.open(os.path.join(ART, 'atlas.png')).convert('RGBA')
    frames = json.load(open(os.path.join(ART, 'atlas.json')))['frames']
    keys = sorted(frames)
    for k in keys:
        f = frames[k]['frame']
        atlas.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h'])).save(os.path.join(out, 'sprites', k + '.png'))
    gid = {k: i + 1 for i, k in enumerate(keys)}
    size = {k: (frames[k]['frame']['w'], frames[k]['frame']['h']) for k in keys}
    shutil.copy(os.path.join(ART, 'grass.png'), os.path.join(out, 'images', 'grass.png'))
    gw, gh = Image.open(os.path.join(ART, 'grass.png')).size

    sc, T = m['roadTileScale'], 512
    small = Image.new('RGBA', (math.ceil(W / sc), math.ceil(H / sc)))
    for t in m['roadTiles']:
        small.alpha_composite(Image.open(os.path.join(ROADS, t['key'] + '.png')).convert('RGBA'), (t['x'] // sc, t['y'] // sc))
    roads = small.resize((small.width * sc, small.height * sc), Image.NEAREST).crop((0, 0, W, H))
    roads.save(os.path.join(out, 'images', 'roads.png'), optimize=True)

    fields = Image.new('RGBA', (W, H))
    d = ImageDraw.Draw(fields)
    for a in m['areas']:
        pts = list(zip(a['points'][0::2], a['points'][1::2]))
        d.polygon(pts, fill=COLOURS.get(a['kind'], COLOURS['pitch']) + (255,))
        if a['kind'] == 'pitch': d.line(pts + pts[:1], fill=(255, 255, 255, 204), width=3)
    for g in m['gasStations']:
        p = g['pad']; q = turned(p['x'], p['y'], p['angle'], p['length'] / 2, p['depth'] / 2)
        d.polygon(q, fill=(0x8d, 0x91, 0x96, 255), outline=(0x6b, 0x6f, 0x74, 255))
    fields.save(os.path.join(out, 'images', 'parks-and-fields.png'), optimize=True)

    # ---- Map ----
    cols, rows = math.ceil(W / 16), math.ceil(H / 16)
    nid = [1]

    def oid():
        nid[0] += 1; return nid[0] - 1

    def tile_obj(key, x, y, name=None, props=None):
        w, h = size[key]
        s = f'  <object id="{oid()}"' + (f' name={qa(name)}' if name else '') + \
            f' gid="{gid[key]}" x="{x}" y="{y}" width="{w}" height="{h}"'
        if not props: return s + '/>'
        p = ''.join(f'    <property name={qa(n)} type="{t}" value={qa(str(v))}/>\n' for n, t, v in props)
        return s + f'>\n   <properties>\n{p}   </properties>\n  </object>'

    home = m['home']
    houses, ornaments, trees = [], [], []
    n = 0
    for o in m['objects']:
        k = o['key']
        if k.startswith(('house', 'villa')):
            if home and o['x'] == home['x'] and o['y'] == home['y']:
                houses.insert(0, tile_obj(k, o['x'], o['y'], 'Home', [('home', 'bool', 'true')]))
            else:
                n += 1
                houses.append(tile_obj(k, o['x'], o['y'], f'House {n}', [('house number', 'int', n)]))
        elif k.startswith('tree'): trees.append(tile_obj(k, o['x'], o['y']))
        else: ornaments.append(tile_obj(k, o['x'], o['y']))

    gas = []
    for g in m['gasStations']:
        p = g['pad']
        gas.append(f'  <object id="{oid()}" name={qa(g["name"] + " forecourt")} x="{p["x"] - p["length"] / 2}" '
                   f'y="{p["y"] - p["depth"] / 2}" width="{p["length"]}" height="{p["depth"]}">\n'
                   f'   <properties>\n    <property name="angle" value="{p["angle"]}"/>\n   </properties>\n  </object>')
        for pu in g['pumps']: gas.append(tile_obj('pump', pu['x'], pu['y'], 'Pump'))

    markers = []
    for r in m['roads']:
        x0, y0 = r['points'][0], r['points'][1]
        pts = ' '.join(f'{round(x - x0, 1)},{round(y - y0, 1)}' for x, y in zip(r['points'][0::2], r['points'][1::2]))
        nm = r['name'] + (f' ({r["lanes"]} lanes each way)' if r.get('lanes', 1) > 1 else '')
        markers.append(f'  <object id="{oid()}" name={qa(nm)} x="{x0}" y="{y0}">\n   <polyline points="{pts}"/>\n  </object>')

    def point(name, x, y, props=()):
        p = ''.join(f'    <property name={qa(a)} value={qa(str(b))}/>\n' for a, b in props)
        p = f'   <properties>\n{p}   </properties>\n' if p else ''
        return f'  <object id="{oid()}" name={qa(name)} x="{x}" y="{y}">\n{p}   <point/>\n  </object>'

    for c in m['curbSpots']: markers.append(point('Curb spot', c['x'], c['y'], [('street', c['street'])]))
    for p in m['potholes']: markers.append(point('Pothole', p['x'], p['y']))
    for p in m['parkedCars']: markers.append(point('Parked car', p['x'], p['y'], [('angle', p['angle'])]))
    hs = m['homeStart']; markers.append(point('Truck start', hs['x'], hs['y'], [('angle', hs['angle'])]))
    for g in m['gasStations']:
        b = g['bay']; markers.append(point('Gas bay', b['x'], b['y'], [('angle', b['angle']), ('station', g['name'])]))
    for lb in m['labels']: markers.append(point('Street name: ' + lb['name'], lb['x'], lb['y'], [('angle', lb['angle'])]))

    tw, th = max(w for w, _ in size.values()), max(h for _, h in size.values())
    tiles = ''.join(f'  <tile id="{gid[k] - 1}">\n   <image source="sprites/{k}.png" width="{size[k][0]}" height="{size[k][1]}"/>\n  </tile>\n' for k in keys)
    ext = ''
    if tsx:
        shutil.copy(tsx, os.path.join(out, os.path.basename(tsx)))
        ext = f' <tileset firstgid="{len(keys) + 1}" source={qa(os.path.basename(tsx))}/>\n'
    empty = ',\n'.join(','.join(['0'] * cols) for _ in range(rows))

    def group(i, name, objs, extra=''):
        return f' <objectgroup color="#ffffff" id="{i}" name="{name}"{extra}>\n' + '\n'.join(objs) + ('\n' if objs else '') + ' </objectgroup>\n'

    xml = (f'<?xml version="1.0" encoding="UTF-8"?>\n'
           f'<map version="1.10" tiledversion="1.12.2" orientation="orthogonal" renderorder="right-down" width="{cols}" height="{rows}" '
           f'tilewidth="16" tileheight="16" infinite="0" nextlayerid="12" nextobjectid="{nid[0]}">\n'
           f' <properties>\n  <property name="made from" value="src/config/worcester.ts (tools/tiled/export_tiled.py)"/>\n'
           f'  <property name="map" value="worcester"/>\n </properties>\n'
           f' <tileset firstgid="1" name="Map pieces (game, 16 px)" tilewidth="{tw}" tileheight="{th}" tilecount="{len(keys)}" columns="0" objectalignment="bottom">\n'
           f'  <grid orientation="orthogonal" width="1" height="1"/>\n{tiles} </tileset>\n{ext}'
           f' <imagelayer id="1" name="Grass (generated)" locked="1" repeatx="1" repeaty="1">\n  <image source="images/grass.png" width="{gw}" height="{gh}"/>\n </imagelayer>\n'
           f' <imagelayer id="2" name="Parks and fields (generated)" locked="1">\n  <image source="images/parks-and-fields.png" width="{W}" height="{H}"/>\n </imagelayer>\n'
           f' <imagelayer id="3" name="Roads and sidewalks (generated)" locked="1">\n  <image source="images/roads.png" width="{W}" height="{H}"/>\n </imagelayer>\n'
           f' <layer id="4" name="Your tiles (paint here)" width="{cols}" height="{rows}">\n  <data encoding="csv">\n{empty}\n</data>\n </layer>\n'
           + group(5, 'Flat ground', []) + group(6, 'Houses', houses) + group(7, 'House Details', [])
           + group(8, 'Businesses', []) + group(9, 'Garden ornaments', ornaments) + group(10, 'Trees', trees)
           + group(11, 'Gas station', gas)
           + ' <objectgroup color="#ff3366" id="12" name="Game markers (generated, read-only)" locked="1">\n' + '\n'.join(markers) + '\n </objectgroup>\n'
           + '</map>\n').replace('nextlayerid="12"', 'nextlayerid="13"')
    open(os.path.join(out, 'worcester-map.tmx'), 'w', encoding='utf-8').write(xml)
    print(f'{n} houses + home, {len(trees)} trees, {len(ornaments)} ornaments, {len(keys)} pictures, {cols}x{rows} tiles')


if __name__ == '__main__':
    if len(sys.argv) < 2: sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
