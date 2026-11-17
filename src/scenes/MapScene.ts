import * as Phaser from 'phaser';
import { getEvening, returnToTruck, SceneKeys } from '../flow';
import { MAPS, type MapId } from '../config/maps';
import type { WorcesterMap } from '../config/mapTypes';
import { mapMarks, mapView } from '../state/MapMarks';
import { loadFlavourArt, MARKER_FONT } from '../ui/flavourArt';
import { showLoadingWhileLoading } from './LoadingScene';

// SCREAM-377 (PO, November 16): "I want to add a map to game. The map should show the elm park
// map, and then once the player teleports to the other map, that map should become available too.
// Two arrows on the side should bring the player between maps. The map should show details like
// home and gas stations, parks." Opened from the poster on the truck's wall ("Any time the player
// can get to this view, they should be able to see the map"), so also while looking inside from
// the road. His other answers: the clock "Keeps running"; it also shows "Where the truck is",
// "Street names" and "The roundabout portal". Reading only: nothing here changes the evening.
// A drawn map (engineering's placeholder art) until the PO draws his own.

const INK = '#2b1d10';
const PAPER = 0xfff6e0;
/** The sheet of paper on the 960 x 540 screen. The top strip is left to the clock and the money. */
const SHEET = { x: 120, y: 52, w: 720, h: 444 };
/** Where the map itself is drawn on the sheet: under the title, above the key. */
const AREA = { x: SHEET.x + 24, y: SHEET.y + 58, w: SHEET.w - 48, h: SHEET.h - 58 - 54 };

export type MapMarkKind = 'home' | 'gas' | 'park' | 'portal' | 'truck';
export const MAP_KEY_WORDS: Record<MapMarkKind, string> = { home: 'Home', gas: 'Gas', park: 'Park', portal: 'Roundabout', truck: 'You' };
const HINT_ONE = 'B: Back To The Truck';
const HINT_TWO = '← → The Other Map    B: Back To The Truck';

export class MapScene extends Phaser.Scene {
  /** Test hooks: the maps the player can look at, the one shown, and what is marked on it (screen px). */
  known: MapId[] = [];
  shown = 0;
  marks: { kind: MapMarkKind; x: number; y: number }[] = [];
  streets: string[] = [];
  title!: Phaser.GameObjects.Text;
  arrows: Phaser.GameObjects.Container[] = [];
  backButton!: Phaser.GameObjects.Rectangle;
  private drawn: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SceneKeys.Map);
  }

  preload(): void {
    loadFlavourArt(this); // the marker font
    showLoadingWhileLoading(this);
  }

  create(): void {
    const { width, height } = this.scale;
    const evening = getEvening(this);
    this.known = evening.knownMaps;
    // It opens on the map the truck is on.
    this.shown = Math.max(0, this.known.indexOf(evening.mapId));
    this.drawn = [];
    this.arrows = [];

    this.add.rectangle(0, 0, width, height, 0x6b6f76).setOrigin(0, 0);
    const g = this.add.graphics();
    g.fillStyle(0x3b2a1a, 0.35).fillRoundedRect(SHEET.x + 8, SHEET.y + 8, SHEET.w, SHEET.h, 6);
    g.fillStyle(PAPER, 1).fillRoundedRect(SHEET.x, SHEET.y, SHEET.w, SHEET.h, 6);
    g.lineStyle(5, 0x2b1d10, 1).strokeRoundedRect(SHEET.x, SHEET.y, SHEET.w, SHEET.h, 6);
    this.title = this.add.text(SHEET.x + SHEET.w / 2, SHEET.y + 30, '', { fontFamily: MARKER_FONT, fontSize: '28px', color: '#b3261e' }).setOrigin(0.5);

    // The key along the bottom of the sheet: one of each marker with its word.
    const kinds: MapMarkKind[] = ['home', 'gas', 'park', 'portal', 'truck'];
    kinds.forEach((kind, i) => {
      const x = SHEET.x + 70 + i * 132;
      const y = SHEET.y + SHEET.h - 28;
      this.marker(kind, x, y);
      this.add.text(x + 16, y, MAP_KEY_WORDS[kind], { fontFamily: 'monospace', fontSize: '14px', color: INK }).setOrigin(0, 0.5);
    });

    // SCREAM-77 (the mobile rule): every action has a button on screen.
    if (this.known.length > 1) {
      this.arrows = [this.arrow(SHEET.x - 56, -1), this.arrow(SHEET.x + SHEET.w + 56, 1)];
    }
    this.backButton = this.add
      .rectangle(width - 56, height - 62, 96, 44, 0x8a5a2b)
      .setStrokeStyle(3, 0x2b1d10)
      .setInteractive({ useHandCursor: true });
    this.backButton.on('pointerdown', () => this.back());
    this.add.text(width - 56, height - 62, 'BACK', { fontFamily: 'monospace', fontSize: '18px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);

    this.add.rectangle(0, height - 34, width, 34, 0x000000, 0.45).setOrigin(0, 0);
    this.add.text(width / 2, height - 17, this.known.length > 1 ? HINT_TWO : HINT_ONE, { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' }).setOrigin(0.5);

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-LEFT', () => this.turn(-1));
    keyboard?.on('keydown-A', () => this.turn(-1));
    keyboard?.on('keydown-RIGHT', () => this.turn(1));
    keyboard?.on('keydown-D', () => this.turn(1));
    for (const key of ['B', 'BACKSPACE', 'ENTER', 'SPACE']) keyboard?.on(`keydown-${key}`, () => this.back());

    this.show();
  }

  /** Shows the next (1) or the previous (-1) map; with two maps either arrow goes to the other one. */
  turn(step: -1 | 1): void {
    if (this.known.length < 2) return;
    this.shown = (this.shown + step + this.known.length) % this.known.length;
    this.show();
  }

  back(): void {
    returnToTruck(this, 'map', false);
  }

  /** A big arrow button beside the sheet. */
  private arrow(x: number, step: -1 | 1): Phaser.GameObjects.Container {
    const y = SHEET.y + SHEET.h / 2;
    const box = this.add.container(x, y);
    const pad = this.add.rectangle(0, 0, 64, 96, 0xffe066).setStrokeStyle(4, 0x2b1d10).setInteractive({ useHandCursor: true });
    pad.on('pointerdown', () => this.turn(step));
    const head = this.add.triangle(0, 0, -14 * step, -24, -14 * step, 24, 18 * step, 0, 0x2b1d10).setOrigin(0, 0);
    box.add([pad, head]);
    return box;
  }

  /** One marker, drawn round (x, y). The key and the map use the same pictures. */
  private marker(kind: MapMarkKind, x: number, y: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setPosition(x, y);
    g.lineStyle(2, 0x2b1d10, 1);
    if (kind === 'home') {
      g.fillStyle(0xffe066, 1).fillRect(-7, -3, 14, 10).strokeRect(-7, -3, 14, 10);
      g.fillStyle(0xd94f3d, 1).fillTriangle(-10, -3, 10, -3, 0, -12).strokeTriangle(-10, -3, 10, -3, 0, -12);
    } else if (kind === 'gas') {
      g.fillStyle(0xd94f3d, 1).fillRoundedRect(-6, -9, 12, 18, 2).strokeRoundedRect(-6, -9, 12, 18, 2);
      g.fillStyle(0xffffff, 1).fillRect(-3, -6, 6, 5);
      g.lineBetween(6, -4, 10, -1).lineBetween(10, -1, 10, 6);
    } else if (kind === 'park') {
      g.fillStyle(0x8a5a2b, 1).fillRect(-2, 2, 4, 8);
      g.fillStyle(0x3f9b4b, 1).fillCircle(0, -3, 8).strokeCircle(0, -3, 8);
    } else if (kind === 'portal') {
      g.fillStyle(0x7a5cff, 1).fillCircle(0, 0, 9).strokeCircle(0, 0, 9);
      g.lineStyle(2, 0xffffff, 1).strokeCircle(0, 0, 4);
    } else {
      g.fillStyle(0xff7eb6, 1).fillCircle(0, 0, 8).strokeCircle(0, 0, 8);
      g.fillStyle(0xffffff, 1).fillCircle(0, 0, 3);
    }
    return g;
  }

  private show(): void {
    for (const o of this.drawn) o.destroy();
    this.drawn = [];
    this.marks = [];
    this.streets = [];
    const evening = getEvening(this);
    const id = this.known[this.shown] ?? evening.homeMapId;
    const data: WorcesterMap = MAPS[id].data;
    this.title.setText(MAPS[id].name.toUpperCase());

    // The map's streets (with a margin), shrunk to fit and centred.
    const view = mapView(data);
    const k = Math.min(AREA.w / view.w, AREA.h / view.h);
    const left = AREA.x + (AREA.w - view.w * k) / 2;
    const top = AREA.y + (AREA.h - view.h * k) / 2;
    const at = (x: number, y: number): [number, number] => [left + (x - view.x) * k, top + (y - view.y) * k];
    const marks = mapMarks(data);

    const g = this.add.graphics();
    this.drawn.push(g);
    g.fillStyle(0xcfe8b0, 1).fillRect(left, top, view.w * k, view.h * k);
    // Parks, under the streets.
    for (const park of marks.parks) {
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < park.points.length; i += 2) pts.push(new Phaser.Math.Vector2(...at(park.points[i]!, park.points[i + 1]!)));
      g.fillStyle(0x86c98f, 1).fillPoints(pts, true);
    }
    // Streets: a dark edge, then the road on top, so junctions join up.
    const strokes: [number, number][] = [
      [3, 0x6b6f76],
      [0, 0xffffff],
    ];
    for (const [extra, colour] of strokes) {
      for (const road of data.roads) {
        const wide = Math.max(3, 120 * (road.lanes ?? 1) * k) + extra;
        g.lineStyle(wide, colour, 1);
        if (road.ring) {
          const [cx, cy] = at(road.ring.x, road.ring.y);
          g.strokeCircle(cx, cy, Math.max(road.ring.r * k, 4));
          continue;
        }
        const pts: Phaser.Math.Vector2[] = [];
        for (let i = 0; i < road.points.length; i += 2) pts.push(new Phaser.Math.Vector2(...at(road.points[i]!, road.points[i + 1]!)));
        g.strokePoints(pts, false);
      }
    }
    g.lineStyle(3, 0x2b1d10, 1).strokeRect(left, top, view.w * k, view.h * k);

    // Street names, written along each street as on the road.
    for (const label of data.labels) {
      if (this.streets.includes(label.name)) continue; // once each: the sheet is small
      const [x, y] = at(label.x, label.y);
      const text = this.add
        .text(x, y, label.name, { fontFamily: 'monospace', fontSize: data.labels.length > 14 ? '8px' : '9px', color: INK })
        .setOrigin(0.5)
        .setAngle(label.angle);
      this.drawn.push(text);
      this.streets.push(label.name);
    }

    const put = (kind: MapMarkKind, mx: number, my: number, word = '') => {
      const [x, y] = at(mx, my);
      this.drawn.push(this.marker(kind, x, y));
      this.marks.push({ kind, x, y });
      if (word) {
        this.drawn.push(
          this.add.text(x, y + 13, word, { fontFamily: 'monospace', fontSize: '10px', fontStyle: 'bold', color: INK, backgroundColor: '#fff6e0', padding: { x: 2, y: 0 } }).setOrigin(0.5, 0),
        );
      }
    };
    for (const park of marks.parks) put('park', park.x, park.y, park.name);
    for (const station of marks.gas) put('gas', station.x, station.y, 'GAS');
    // "The roundabout portal": once the truck has been through it.
    if (marks.portal && evening.otherMapSeen) put('portal', marks.portal.x, marks.portal.y);
    // Home is on the map the evening started on.
    if (marks.home && id === evening.homeMapId) put('home', marks.home.x, marks.home.y, 'HOME');
    // "Where the truck is", on the map it is on, blinking so it is easy to find.
    if (id === evening.mapId) {
      put('truck', evening.truck.x, evening.truck.y);
      const dot = this.drawn[this.drawn.length - 1] as Phaser.GameObjects.Graphics;
      this.tweens.add({ targets: dot, scale: 1.5, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }
}
