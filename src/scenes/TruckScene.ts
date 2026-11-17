import * as Phaser from 'phaser';
import { getEvening, getStory, pauseEvening, SceneKeys, type Station } from '../flow';
import { EveningEvents, EveningState } from '../state/EveningState';
import { showLoadingWhileLoading } from './LoadingScene';
import { INTERIOR_KEY, loadTruckInterior } from '../ui/truckInterior';
import { drawNotepad } from '../ui/powerUpLogo';
import { drawMapPoster, mapPosterPoints } from '../ui/mapPoster';

// Issue #7: the truck interior hub, like the Backyard Baseball treehouse.
// SCREAM-57: the PO's coloured drawing of the inside of the truck (from his pen
// sketch and engineering's line art, tools/interior/). Parts of the picture are
// clickable: the freezer opens the cooler, the front of the truck starts
// driving, the menu board opens the menu, and the serving window opens a sale
// (only while one is going on). Arrow keys move between them in screen order.
// SCREAM-267 (PO, November 11): in Story the board on the wall above the cooler is the cork
// board: it opens the power-ups skill map instead of the menu (Esc still opens the menu).
// Not in the uncle's evening, and not in Quick play (decision 076).


export const HIGHLIGHT = 0xffe066;
export const OUTLINE = 0x3b2a1a;

/** SCREAM-267: the board's name tag in Story. */
export const POWER_UPS_TAG = 'POWER-UPS';

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
  // SCREAM-245 (PO, November 14: "Notebook should be a new clickable item in the truck view"): the
  // Handy Notebook, once it is owned. PO, November 14, on the first build (it hung on the side door):
  // "Lets have notebook hang under the tip jar": under the green cup on the shelf by the window.
  {
    id: 'notebook',
    name: 'NOTEBOOK',
    points: [866, 364, 928, 364, 928, 438, 866, 438],
    tag: { x: 880, y: 456 },
  },
  // SCREAM-377 (PO, November 16, his red sketch on a screenshot: a "MAP" poster on the wall between
  // the side door and the window): "Here is where I want to add it in the truck. Any time the player
  // can get to this view, they should be able to see the map."
  // Engineering's call: the arrow keys skip it (N opens it, or a click), so Left and Right move
  // between the stations exactly as before.
  {
    id: 'map',
    name: 'MAP',
    points: mapPosterPoints(),
    tag: { x: 806, y: 130 },
  },
];

/** SCREAM-245: where the Handy Notebook hangs (the middle of its picture) and how big it is drawn. */
export const NOTEBOOK_AT = { x: 897, y: 402, size: 58 };

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
    this.restockWarning = null; // SCREAM-368: the scene is reused between visits
    this.warnedAlready = false;
    this.evening = getEvening(this);
    const { width, height } = this.scale;

    this.add.image(0, 0, INTERIOR_KEY).setOrigin(0, 0).setDisplaySize(width, height);

    // SCREAM-377: the map poster on the wall (ui/mapPoster.ts), from the PO's sketches.
    drawMapPoster(this);

    // SCREAM-245: the notebook itself, on a nail under the tip jar's shelf (only once it is owned).
    if (this.evening.hasNotebook) {
      const pad = this.add.graphics().setPosition(NOTEBOOK_AT.x, NOTEBOOK_AT.y);
      pad.lineStyle(2, OUTLINE, 1).lineBetween(-12, -24, 0, -38).lineBetween(12, -24, 0, -38);
      pad.fillStyle(OUTLINE, 1).fillCircle(0, -38, 3);
      drawNotepad(pad, NOTEBOOK_AT.size, false);
    }

    for (const zone of ZONES) {
      if (!this.isAvailable(zone.id) && zone.id === 'notebook') continue; // nothing to click until it is owned
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
      .text(width / 2, height - 17, this.evening.isPeeking ? '← → Choose    Enter: Go    N: Map    Tab Or B: Back To The Road' : this.onTheRoad() ? '← → Choose    Enter: Go    N: Map    B: Back To The Road' : '← → Choose    Enter: Go    N: Map    Or Use The Mouse', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const keyboard = this.input.keyboard;
    // SCREAM-368: the not-restocked pop-up's keys (Y drives anyway, C goes to the cooler, B closes it).
    keyboard?.on('keydown-Y', () => this.restockWarning && this.driveAnyway());
    keyboard?.on('keydown-C', () => this.restockWarning && this.goToCooler());
    keyboard?.on('keydown-B', () => this.restockWarning && this.closeRestockWarning());
    keyboard?.on('keydown-LEFT', () => this.move(-1));
    keyboard?.on('keydown-A', () => this.move(-1));
    keyboard?.on('keydown-RIGHT', () => this.move(1));
    keyboard?.on('keydown-D', () => this.move(1));
    keyboard?.on('keydown-N', () => this.activate('map')); // SCREAM-377
    keyboard?.on('keydown-ENTER', () => this.activate(this.selected));
    keyboard?.on('keydown-SPACE', () => this.activate(this.selected));
    // SCREAM-319: stopped at home after setting off, B goes back on the road, like DRIVE.
    // SCREAM-321: looking inside with Tab, B or Tab goes back on the road.
    if (this.onTheRoad()) {
      keyboard?.on('keydown-B', () => this.activate('driver'));
      keyboard?.addCapture('TAB');
      keyboard?.on('keydown-TAB', () => this.activate('driver'));
    }

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
    if (id === 'notebook') return this.evening.hasNotebook; // SCREAM-245
    return id !== 'window' || this.evening.customerWaiting;
  }

  /** SCREAM-319: the truck has been out tonight and stopped in here (at home): B drives off again. */
  private onTheRoad(): boolean {
    return this.evening.isPrepLocked && (this.evening.isRestocking || this.evening.isPeeking);
  }

  /** SCREAM-267: Story's cork board (after the uncle's evening) opens the power-ups. */
  boardIsPowerUps(): boolean {
    return !!getStory(this) && !this.evening.tutorial;
  }

  /**
   * SCREAM-368 (PO, November 16): "If the player goes to drive and they haven't restocked the truck,
   * warn them." His answers: "No stock bought tonight" and "Pop-up with two buttons". Engineering's
   * calls: only when first setting off; the wording; Y / C / B for the keys.
   */
  restockWarning: Phaser.GameObjects.Container | null = null;
  /** Set once the player chose DRIVE ANYWAY, so the seat drives off this time. */
  private warnedAlready = false;

  private openRestockWarning(): void {
    const { width, height } = this.scale;
    const box = this.add.container(0, 0).setDepth(50);
    box.add(this.add.rectangle(0, 0, width, height, 0x000000, 0.5).setOrigin(0, 0).setInteractive());
    box.add(this.add.rectangle(width / 2, height / 2, 520, 230, 0xfff6e0).setStrokeStyle(4, 0x6b4a2b));
    box.add(this.add.text(width / 2, height / 2 - 80, "YOU HAVEN'T RESTOCKED", { fontFamily: 'monospace', fontSize: '24px', fontStyle: 'bold', color: '#b3261e' }).setOrigin(0.5));
    const left = this.evening.stockLeft;
    box.add(
      this.add
        .text(width / 2, height / 2 - 34, `You haven't bought any ice cream tonight.\nThere ${left === 1 ? 'is 1 ice cream' : `are ${left} ice creams`} left in the cooler.`, {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#2b1d10',
          align: 'center',
        })
        .setOrigin(0.5),
    );
    const button = (x: number, label: string, colour: number, onClick: () => void) => {
      const rect = this.add.rectangle(x, height / 2 + 50, 220, 48, colour).setStrokeStyle(3, 0x2b1d10).setInteractive({ useHandCursor: true });
      rect.on('pointerdown', onClick);
      box.add(rect);
      box.add(this.add.text(x, height / 2 + 50, label, { fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5));
      return rect;
    };
    button(width / 2 - 120, 'C  GO TO THE COOLER', 0x2e7d32, () => this.goToCooler());
    button(width / 2 + 120, 'Y  DRIVE ANYWAY', 0x8a5a2b, () => this.driveAnyway());
    box.add(this.add.text(width / 2, height / 2 + 94, 'B: Close', { fontFamily: 'monospace', fontSize: '13px', color: '#6b4a2b' }).setOrigin(0.5));
    this.restockWarning = box;
  }

  private closeRestockWarning(): void {
    this.restockWarning?.destroy();
    this.restockWarning = null;
  }

  private goToCooler(): void {
    this.closeRestockWarning();
    this.scene.start(SceneKeys.Cooler);
  }

  private driveAnyway(): void {
    this.closeRestockWarning();
    this.warnedAlready = true;
    this.activate('driver');
  }

  /** Moves the highlight left or right, skipping zones that aren't available. */
  private move(direction: -1 | 1): void {
    if (this.restockWarning) return; // SCREAM-368
    const order = ZONES.map((z) => z.id);
    let index = order.indexOf(this.selected);
    for (let step = 0; step < order.length; step++) {
      index = (index + direction + order.length) % order.length;
      const candidate = order.at(index);
      if (candidate && candidate !== 'map' && this.isAvailable(candidate)) { // SCREAM-377: the map has its own key
        this.selected = candidate;
        break;
      }
    }
    this.refresh();
  }

  private activate(id: Station): void {
    if (!this.isAvailable(id) || this.restockWarning) return;
    if (id === 'menu') {
      if (this.boardIsPowerUps()) this.scene.start(SceneKeys.PowerUps);
      else pauseEvening(this);
    }
    if (id === 'cooler') this.scene.start(SceneKeys.Cooler);
    if (id === 'notebook') this.scene.start(SceneKeys.Notebook); // SCREAM-245: reading only
    if (id === 'map') this.scene.start(SceneKeys.Map); // SCREAM-377: reading only
    if (id === 'driver') {
      // SCREAM-307: from the hub with nothing stocked yet, the cooler opens with its warning
      // instead (the truck can't set off empty, as the cooler already said, #66).
      if (!this.evening.isPrepLocked && this.evening.stockLeft === 0) {
        this.scene.start(SceneKeys.Cooler, { warnEmpty: true });
        return;
      }
      // SCREAM-368: something left in the cooler but nothing bought tonight: ask first.
      if (this.evening.shouldWarnNotRestocked && !this.warnedAlready) {
        this.openRestockWarning();
        return;
      }
      // Heading for the road ends prep: stock and prices are set for the evening (#8, #23).
      this.evening.startClock(); // SCREAM-307: from the hub the clock may still be waiting
      // SCREAM-319: leaving a home stop ends the restock (stock and prices lock again).
      if (this.evening.isRestocking) this.evening.endRestock();
      this.evening.endPeek(); // SCREAM-321
      if (!this.evening.isPrepLocked) this.evening.lockPrep();
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
    this.tag.setText(zone.id === 'menu' && this.boardIsPowerUps() ? POWER_UPS_TAG : zone.name).setPosition(zone.tag.x, zone.tag.y).setVisible(true);
  }
}
