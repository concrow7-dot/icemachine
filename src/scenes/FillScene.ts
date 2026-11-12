import * as Phaser from 'phaser';
import { COOLER_CAPACITY, CRATE_SIDE } from '../config/tuning';
import { addCoveredHalf } from '../ui/coveredHalf';
import { getEvening, SceneKeys } from '../flow';
import { EveningEvents, EveningState } from '../state/EveningState';
import { addFlavourIcon, flavourFrame, FLAVOUR_ICONS_KEY, loadFlavourArt, MARKER_FONT } from '../ui/flavourArt';
import { TipBar } from '../ui/TipBar';
import { showLoadingWhileLoading } from './LoadingScene';

// Issue #14: the cooler during a sale. The player picks the ice creams they remember the
// customer ordering, then serves them. The tip countdown stays on screen (PO, doc 12 Q12).
//
// SCREAM-131 (PO, November 2): a memory challenge. The cooler is the prep screen's freezer
// (no clipboard or menu), shut. Each crate has its own lid, and only one can be open at a
// time: opening one shuts the others. Ice creams taken go into the paper bag on the counter;
// clicking one in the bag puts it back in its square. Opening a lid takes about half a
// second, while the tip keeps ticking. A shut lid hides everything.

const FILL_KEY = 'cooler-fill';
const FILL_URL = 'assets/interior/cooler-fill.png';
/** Shared with the prep screen and draw_cooler.py: where the crates and squares are. */
const CRATE_LEFTS = [319, 519, 719];
const CRATE_TOP = 96;
const CELL = 38;
const CELL_PAD = 4;
const CRATE_PX = CRATE_SIDE * CELL + 2 * CELL_PAD;
const CRATE_CELLS = CRATE_SIDE * CRATE_SIDE;
/** SCREAM-138 (PO, November 2): a lid opens quickly, and the one that was open takes about half a second to close. */
const LID_OPEN_MS = 200;
const LID_CLOSE_MS = 500;
/** The bag's contents: a row on the counter, right of the paper bag. */
const BAG_FIRST_X = 380;
const BAG_Y = 410;
const BAG_GAP = 48;
const INK = '#2b1d10';

export class FillScene extends Phaser.Scene {
  private evening!: EveningState;
  private tipBar!: TipBar;
  private serveButton!: Phaser.GameObjects.Text;
  /** SCREAM-240: BACK TO THE WINDOW, the same as B. */
  windowButton!: Phaser.GameObjects.Text;
  private cellIcons: Phaser.GameObjects.Image[] = [];
  private lids: Phaser.GameObjects.Container[] = [];
  /** SCREAM-269: the shut, plain doors over the covered half of each crate in Story (test hook). */
  coveredHalves: Phaser.GameObjects.Container[] = [];
  private bagIcons: Phaser.GameObjects.Image[] = [];
  private bagEmpty!: Phaser.GameObjects.Text;
  private focusMark!: Phaser.GameObjects.Graphics;
  /** The crate whose lid is fully open, or null. */
  openCrate: number | null = null;
  /** The crate whose lid is opening right now, or null. */
  private opening: number | null = null;
  /** The keyboard's square within the open crate (0-15). */
  private focus = 0;

  constructor() {
    super(SceneKeys.Fill);
  }

  preload(): void {
    if (!this.textures.exists(FILL_KEY)) this.load.image(FILL_KEY, FILL_URL);
    loadFlavourArt(this);
    showLoadingWhileLoading(this); // SCREAM-75
  }

  create(): void {
    this.evening = getEvening(this);
    this.cellIcons = [];
    this.lids = [];
    this.bagIcons = [];
    this.openCrate = null;
    this.opening = null;
    this.focus = 0;
    const { width, height } = this.scale;

    this.add.image(0, 0, FILL_KEY).setOrigin(0, 0).setDisplaySize(width, height);
    this.add
      .text(599, 61, 'THE COOLER  –  FILL THE ORDER', { fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold', color: INK })
      .setOrigin(0.5);
    // The tip cup stands on the shelf on the left wall.
    this.tipBar = new TipBar(this, 124, 386, true);

    for (let i = 0; i < COOLER_CAPACITY; i++) {
      const { x, y } = cellCentre(i);
      const icon = this.add.image(x, y, FLAVOUR_ICONS_KEY, 0).setScale(0.92).setVisible(false);
      icon.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.take(i));
      this.cellIcons.push(icon);
    }
    this.focusMark = this.add.graphics();
    // SCREAM-269 (PO's sketch, November 12): in Story each crate has two half doors with a handle
    // each. The left one opens (swinging up); the right one is a plain panel that stays shut.
    // Quick play keeps one lid per crate.
    this.coveredHalves = [];
    const half = this.evening.spec.coolerHalfCovered;
    CRATE_LEFTS.forEach((left, crate) => {
      this.lids.push(this.makeLid(left, crate, half ? CRATE_PX / 2 : CRATE_PX));
      if (half) this.coveredHalves.push(addCoveredHalf(this, left + CRATE_PX / 2, CRATE_TOP, CRATE_PX / 2, CRATE_PX, true));
    });

    this.add.text(BAG_FIRST_X - 14, 340, 'IN THE BAG', { fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold', color: INK });
    this.bagEmpty = this.add.text(BAG_FIRST_X - 14, BAG_Y - 8, 'Nothing yet: open a crate and click an ice cream.', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#5a4636',
    });

    this.serveButton = this.add
      .text(880, 470, 'SERVE', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#ffffff',
        backgroundColor: '#2e7d32',
        padding: { x: 18, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.serveButton.on('pointerdown', () => this.serve());

    // SCREAM-240 (PO, November 10): a button for B, in the middle of the serving area, on SERVE's row.
    this.windowButton = this.add
      .text(600, 470, 'BACK TO THE WINDOW', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: '#1d5c8c',
        padding: { x: 14, y: 7 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.windowButton.on('pointerdown', () => this.scene.start(SceneKeys.Sales));

    this.add
      .text(width / 2, height - 9, '1 2 3: Open A Crate   ↑↓←→ Move   + Take   − Put Back   Enter: Serve   B: Back To The Window', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: INK,
      })
      .setOrigin(0.5);

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (event.shiftKey && /^Digit[0-9]$/.test(event.code)) return; // debug shortcuts
      const key = event.key;
      if (key === '1' || key === '2' || key === '3') this.open(Number(key) - 1);
      if (key === 'ArrowLeft') this.moveFocus(-1, 0);
      if (key === 'ArrowRight') this.moveFocus(1, 0);
      if (key === 'ArrowUp') this.moveFocus(0, -1);
      if (key === 'ArrowDown') this.moveFocus(0, 1);
      if ((key === '+' || key === '=') && this.openCrate !== null) this.take(this.openCrate * CRATE_CELLS + this.focus);
      if (key === '-' || key === '_') this.evening.putBack(this.evening.bagContents.length - 1);
      if (key === 'Enter' || key === ' ') this.serve();
      if (key === 'b' || key === 'B' || key === 'Backspace') this.scene.start(SceneKeys.Sales);
    });

    const onChange = () => this.onSaleChanged();
    this.evening.on(EveningEvents.CoolerChanged, onChange);
    this.evening.on(EveningEvents.SaleChanged, onChange);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.evening.off(EveningEvents.CoolerChanged, onChange);
      this.evening.off(EveningEvents.SaleChanged, onChange);
    });

    this.refresh();
  }

  update(): void {
    this.tipBar.update(this.evening);
  }

  /** A crate's lid: frosted, solid (no peeking), with its number on it. Clicking the crate opens it. */
  private makeLid(left: number, crate: number, w: number = CRATE_PX): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(0xdff3f8, 1).fillRect(0, 0, w, CRATE_PX);
    g.fillStyle(0xffffff, 0.7);
    for (let k = 0; k < 18; k++) g.fillCircle(((k * 53) % (w - 12)) + 6, ((k * 37) % CRATE_PX) + 6, 2 + (k % 3));
    g.lineStyle(10, 0xffffff, 0.6).lineBetween(w * 0.15, CRATE_PX, w * 0.45, 0);
    g.lineStyle(4, 0x7f7f7f, 1).strokeRect(2, 2, w - 4, CRATE_PX - 4);
    // The handle (narrower on a half door).
    const handle = w < CRATE_PX ? 28 : 44;
    g.fillStyle(0xffffff, 1).fillRect(w / 2 - handle / 2, CRATE_PX - 22, handle, 10);
    g.lineStyle(3, 0x7f7f7f, 1).strokeRect(w / 2 - handle / 2, CRATE_PX - 22, handle, 10);
    const number = this.add
      .text(w / 2, CRATE_PX / 2 - 6, String(crate + 1), { fontFamily: MARKER_FONT, fontSize: '48px', color: '#5a6b7a' })
      .setOrigin(0.5);
    const lid = this.add.container(left, CRATE_TOP, [g, number]).setDepth(10);
    // PO (November 2): click on the cooler to open it. A plain click zone over the whole crate,
    // under the ice creams (once the crate is open, clicking an ice cream takes it instead).
    this.add
      .zone(left, CRATE_TOP, w, CRATE_PX)
      .setOrigin(0, 0)
      .setDepth(-1)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.open(crate));
    return lid;
  }

  /**
   * Opens a crate: this lid folds up quickly (0.2 s) while the one that was open slides shut
   * (0.5 s, its ice creams hidden at once). `instant` skips the wait (the tests use it).
   */
  open(crate: number, instant = false): void {
    if (crate < 0 || crate >= this.lids.length || this.openCrate === crate || this.opening === crate) return;
    const wasOpen = this.openCrate ?? this.opening;
    this.openCrate = null;
    this.opening = crate;
    this.focus = 0;
    this.lids.forEach((lid, i) => {
      if (i === crate) return;
      this.tweens.killTweensOf(lid);
      lid.setVisible(true);
      // The crate that was open slides shut (its ice creams are hidden straight away); the rest stay shut.
      if (i === wasOpen && !instant) this.tweens.add({ targets: lid, scaleY: 1, duration: LID_CLOSE_MS, ease: 'Cubic.easeOut' });
      else lid.setScale(1, 1);
    });
    this.tweens.killTweensOf(this.lids[crate] ?? []);
    const done = () => {
      if (this.opening !== crate) return;
      this.opening = null;
      this.openCrate = crate;
      // Folded right up (and out of the way), so closing it later slides it back down.
      this.lids[crate]?.setScale(1, 0).setVisible(false);
      this.refresh();
    };
    if (instant) done();
    else this.tweens.add({ targets: this.lids[crate], scaleY: 0, duration: LID_OPEN_MS, ease: 'Cubic.easeIn', onComplete: done });
    this.refresh();
  }

  /** Takes the ice cream in a square, if its crate is open. */
  private take(cell: number): void {
    if (this.openCrate === null || Math.floor(cell / CRATE_CELLS) !== this.openCrate) return;
    this.focus = cell % CRATE_CELLS;
    this.evening.pickCell(cell);
  }

  /** Test hook: takes one of a flavour from wherever it is, opening its crate at once. */
  takeFlavour(flavour: string): boolean {
    const cell = this.evening.cells.indexOf(flavour as never);
    if (cell < 0) return false;
    this.open(Math.floor(cell / CRATE_CELLS), true);
    this.take(cell);
    return true;
  }

  private moveFocus(dx: number, dy: number): void {
    if (this.openCrate === null) return;
    // SCREAM-269: with the right half covered, the keyboard stays in the open columns.
    const cols = this.evening.spec.coolerHalfCovered ? CRATE_SIDE / 2 : CRATE_SIDE;
    const col = (this.focus % CRATE_SIDE + dx + cols) % cols;
    const row = (Math.floor(this.focus / CRATE_SIDE) + dy + CRATE_SIDE) % CRATE_SIDE;
    this.focus = row * CRATE_SIDE + col;
    this.refresh();
  }

  /** Hands the bag over at the window; the customer will ask "How much?". */
  private serve(): void {
    if (this.evening.sale?.handOver()) this.scene.start(SceneKeys.Sales);
  }

  /** If the customer gives up while the player is at the cooler, go back to the window to hear it. */
  private onSaleChanged(): void {
    if (this.evening.sale?.phase !== 'deciding') {
      this.scene.start(SceneKeys.Sales);
      return;
    }
    this.refresh();
  }

  private refresh(): void {
    const sale = this.evening.sale;
    if (!sale) return;
    const cells = this.evening.cells;
    // Only the open crate's ice creams show; a shut lid hides everything.
    this.cellIcons.forEach((icon, i) => {
      const f = cells[i];
      const visible = !!f && this.openCrate === Math.floor(i / CRATE_CELLS);
      icon.setVisible(visible);
      if (f) icon.setFrame(flavourFrame(f));
    });
    this.focusMark.clear();
    if (this.openCrate !== null) {
      const c = cellCentre(this.openCrate * CRATE_CELLS + this.focus);
      this.focusMark.lineStyle(3, 0xffc533, 1).strokeRect(c.x - CELL / 2 + 1, c.y - CELL / 2 + 1, CELL - 2, CELL - 2);
    }

    // The bag: what's been taken, in order; click one to put it back.
    this.bagIcons.forEach((icon) => icon.destroy());
    this.bagIcons = this.evening.bagContents.map((item, n) =>
      addFlavourIcon(this, BAG_FIRST_X + n * BAG_GAP, BAG_Y, item.flavour, 1.2)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.evening.putBack(n)),
    );
    this.bagEmpty.setVisible(this.bagIcons.length === 0);
    this.serveButton.setAlpha(sale.bagCount > 0 ? 1 : 0.4);
  }
}

/** The middle of a square on screen (the same places as on the prep screen). */
function cellCentre(i: number): { x: number; y: number } {
  const crate = Math.floor(i / CRATE_CELLS);
  const inCrate = i % CRATE_CELLS;
  return {
    x: (CRATE_LEFTS[crate] ?? 0) + CELL_PAD + (inCrate % CRATE_SIDE) * CELL + CELL / 2,
    y: CRATE_TOP + CELL_PAD + Math.floor(inCrate / CRATE_SIDE) * CELL + CELL / 2,
  };
}
