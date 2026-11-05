import * as Phaser from 'phaser';
import { getEvening, pauseEvening, SceneKeys, type Station } from '../flow';
import { EveningEvents, EveningState } from '../state/EveningState';
import { showLoadingWhileLoading } from './LoadingScene';
import { INTERIOR_KEY, loadTruckInterior } from '../ui/truckInterior';

// Issue #7: the truck interior hub, like the Backyard Baseball treehouse.
// SCREAM-57: the PO's coloured drawing of the inside of the truck (from his pen
// sketch and engineering's line art, tools/interior/). Parts of the picture are
// clickable: the freezer opens the cooler, the front of the truck starts
// driving, the menu board opens the menu, and the serving window opens a sale
// (only while one is going on). Arrow keys move between them in screen order.


export const HIGHLIGHT = 0xffe066;
export const OUTLINE = 0x3b2a1a;

type Zone = {
  id: Station;
  name: string;
  /** Outline on the 960 x 540 screen, traced round the part of the picture. */
  points: number[];
  /** Where the name tag sits when the zone is highlighted. */
  tag: { x: number; y: number };
};

// Left to right on screen, the order the arrow keys follow.
export const ZONES: Zone[] = [
  {
    id: 'menu',
    name: 'MENU',
    points: [52, 95, 212, 125, 210, 237, 50, 265],
    tag: { x: 131, y: 180 },
  },
  {
    id: 'cooler',
    name: 'COOLER',
    points: [0, 360, 215, 280, 362, 280, 362, 410, 296, 540, 0, 540],
    tag: { x: 170, y: 420 },
  },
  {
    id: 'driver',
    name: 'DRIVE',
    points: [290, 108, 672, 108, 672, 392, 362, 392, 362, 282, 290, 282],
    tag: { x: 481, y: 140 },
  },
  {
    id: 'window',
    name: 'WINDOW',
    points: [845, 82, 955, 78, 955, 362, 785, 352, 785, 268, 845, 268],
    tag: { x: 880, y: 200 },
  },
];

export class TruckScene extends Phaser.Scene {
  private evening!: EveningState;
  private selected: Station = 'cooler';
  private outline!: Phaser.GameObjects.Graphics;
  private tag!: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKeys.Truck);
  }

  init(data: { station?: Station }): void {
    this.selected = data.station ?? 'cooler';
  }

  preload(): void {
    loadTruckInterior(this);
    showLoadingWhileLoading(this); // SCREAM-75
  }

  create(): void {
    this.evening = getEvening(this);
    const { width, height } = this.scale;

    this.add.image(0, 0, INTERIOR_KEY).setOrigin(0, 0).setDisplaySize(width, height);

    for (const zone of ZONES) {
      // A screen-sized invisible zone whose clickable area is just the traced outline.
      const shape = this.add
        .zone(0, 0, width, height)
        .setOrigin(0, 0)
        .setInteractive(new Phaser.Geom.Polygon(zone.points), Phaser.Geom.Polygon.Contains);
      shape.input!.cursor = 'pointer';
      shape.on('pointerover', () => {
        if (!this.isAvailable(zone.id)) return;
        this.selected = zone.id;
        this.refresh();
      });
      shape.on('pointerdown', () => this.activate(zone.id));
    }

    this.outline = this.add.graphics();
    this.tag = this.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#2b1d10',
        backgroundColor: '#ffe066',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5);

    this.add.rectangle(0, height - 34, width, 34, 0x000000, 0.45).setOrigin(0, 0);
    this.add
      .text(width / 2, height - 17, '← → Choose    Enter: Go    Or Use The Mouse', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-LEFT', () => this.move(-1));
    keyboard?.on('keydown-A', () => this.move(-1));
    keyboard?.on('keydown-RIGHT', () => this.move(1));
    keyboard?.on('keydown-D', () => this.move(1));
    keyboard?.on('keydown-ENTER', () => this.activate(this.selected));
    keyboard?.on('keydown-SPACE', () => this.activate(this.selected));

    const onCustomer = () => {
      // If the customer leaves while the window is highlighted, move to the
      // driver's seat (its neighbour) so something is always highlighted.
      if (!this.isAvailable(this.selected)) this.selected = 'driver';
      this.refresh();
    };
    this.evening.on(EveningEvents.CustomerChanged, onCustomer);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.evening.off(EveningEvents.CustomerChanged, onCustomer);
    });

    if (!this.isAvailable(this.selected)) this.selected = 'cooler';
    this.refresh();
  }

  /** The window can only be used while a customer is waiting (PO decision on #7). */
  private isAvailable(id: Station): boolean {
    return id !== 'window' || this.evening.customerWaiting;
  }

  /** Moves the highlight left or right, skipping zones that aren't available. */
  private move(direction: -1 | 1): void {
    const order = ZONES.map((z) => z.id);
    let index = order.indexOf(this.selected);
    for (let step = 0; step < order.length; step++) {
      index = (index + direction + order.length) % order.length;
      const candidate = order.at(index);
      if (candidate && this.isAvailable(candidate)) {
        this.selected = candidate;
        break;
      }
    }
    this.refresh();
  }

  private activate(id: Station): void {
    if (!this.isAvailable(id)) return;
    if (id === 'menu') pauseEvening(this);
    if (id === 'cooler') this.scene.start(SceneKeys.Cooler);
    if (id === 'driver') {
      // Heading for the road ends prep: stock and prices are set for the evening (#8, #23).
      this.evening.lockPrep();
      this.scene.start(SceneKeys.Drive);
    }
    if (id === 'window' && this.evening.sale) this.scene.start(SceneKeys.Sales);
  }

  private refresh(): void {
    const zone = ZONES.find((z) => z.id === this.selected);
    this.outline.clear();
    if (!zone || !this.isAvailable(zone.id)) {
      this.tag.setVisible(false);
      return;
    }
    const pts = zone.points;
    const path: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < pts.length; i += 2) path.push(new Phaser.Math.Vector2(pts[i], pts[i + 1]));
    this.outline.lineStyle(9, OUTLINE, 0.9).strokePoints(path, true, true);
    this.outline.lineStyle(5, HIGHLIGHT, 1).strokePoints(path, true, true);
    this.tag.setText(zone.name).setPosition(zone.tag.x, zone.tag.y).setVisible(true);
  }
}
