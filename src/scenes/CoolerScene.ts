import * as Phaser from 'phaser';
import { FLAVOURS, getFlavour, type FlavourId } from '../config/flavours';
import { COOLER_CAPACITY, CRATE_SIDE, PRICE_STEP_CENTS } from '../config/tuning';
import { addCoveredHalf } from '../ui/coveredHalf';
import { getEvening, returnToTruck, SceneKeys } from '../flow';
import { CoolerOrder } from '../state/CoolerOrder';
import { EveningEvents, EveningState } from '../state/EveningState';
import { addFlavourIcon, flavourFrame, FLAVOUR_ICONS_KEY, loadFlavourArt, MARKER_FONT, MENU_COLOURS } from '../ui/flavourArt';
import { formatMoney } from '../util/format';
import { showLoadingWhileLoading } from './LoadingScene';
import { addUnclePointer } from '../ui/unclePointer';

// Issue #8 (with #21 and #23): prepping the cooler. Changes are a draft order: Buy Stock
// pays for it and goes back to the truck; B goes back and cancels it (PR #29 feedback).
// Stock already bought can be added to but not returned. Everything locks once the
// player heads for the driver's seat.
//
// SCREAM-129 (PO, November 2; the PO's sketch): three parts.
// - The "Available Ice Cream" clipboard, left: each flavour's picture and what it costs.
//   Picking one drops a single ice cream into the next empty square of the cooler. The
//   order's total and BUY STOCK sit at the bottom of the clipboard.
// - The freezer, top right: 3 crates of 4 x 4 squares. Ice creams not paid for yet have a
//   dashed yellow outline; clicking one takes it back out.
// - Today's Menu, bottom right, on the truck's outside wall: a card for each flavour in the
//   cooler, with its price written in marker, set with - and +.
// The background (clipboard, freezer, crates, wall) is drawn by tools/interior/draw_cooler.py.

const COOLER_KEY = 'cooler-inside';
const COOLER_URL = 'assets/interior/cooler-inside.png';

/** Screen positions; the "shared" ones match draw_cooler.py. */
const COOLER_LAYOUT = {
  /** Shared: the freezer's dark opening. */
  opening: { left: 262, top: 72, right: 936, bottom: 280 },
  /** Shared: each crate's left edge, the crates' top, and the size of a square. */
  crateLefts: [319, 519, 719],
  crateTop: 96,
  cell: 38,
  cellPad: 4,
  /** The clipboard's paper, and the centres of its flavour rows. */
  paper: { left: 24, right: 224 },
  rowY: [152, 214, 276, 338],
  /** Today's Menu: the cards' size, where they start, and the gap between them. */
  card: { w: 156, h: 160, top: 334, firstLeft: 262, gap: 18 },
};
const LID_OPEN_MS = 600;
/** How long the lids stay shut before opening, so the player sees them. */
const LID_WAIT_MS = 250;
const INK = '#2b1d10';
const BUTTON = '#1d5c8c';
const UNPAID = 0xffcf33;

type Focus = { area: 'clipboard'; row: number } | { area: 'menu'; index: number };

type MenuCard = {
  flavour: FlavourId;
  container: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Rectangle;
  price: Phaser.GameObjects.Text;
  margin: Phaser.GameObjects.Text;
};

export class CoolerScene extends Phaser.Scene {
  private evening!: EveningState;
  private order!: CoolerOrder;
  private locked = false;
  /** SCREAM-54: at the cooler after pulling into Home's driveway; leaving goes back to the road. */
  private restocking = false;
  private buyButton?: Phaser.GameObjects.Text;
  /** SCREAM-277: the keys along the bottom (test hook). */
  keysLine?: Phaser.GameObjects.Text;
  private focus: Focus = { area: 'clipboard', row: 0 };
  private rowHighlight!: Phaser.GameObjects.Rectangle;
  private rowCounts: Phaser.GameObjects.Text[] = [];
  /** SCREAM-133: each row's add button, the ice cream's picture with a "+" on it, by flavour. */
  private addButtons = new Map<FlavourId, Phaser.GameObjects.Container>();
  private cellIcons: Phaser.GameObjects.Image[] = [];
  private unpaidMarks!: Phaser.GameObjects.Graphics;
  /** SCREAM-131: the yellow outline round the crate new picks go into. */
  private crateMark!: Phaser.GameObjects.Graphics;
  /** SCREAM-269: the plain panels over the covered half of each crate in Story (test hook). */
  coveredHalves: Phaser.GameObjects.Container[] = [];
  private cards: MenuCard[] = [];
  private emptyMenu!: Phaser.GameObjects.Text;
  private title!: Phaser.GameObjects.Text;
  private totals!: Phaser.GameObjects.Text;
  private note!: Phaser.GameObjects.Text;
  private noteText = '';
  private noteColor = '';
  private noteTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super(SceneKeys.Cooler);
  }

  preload(): void {
    if (!this.textures.exists(COOLER_KEY)) this.load.image(COOLER_KEY, COOLER_URL);
    loadFlavourArt(this);
    showLoadingWhileLoading(this); // SCREAM-75
  }

  create(): void {
    this.evening = getEvening(this);
    // SCREAM-191: counts the uncle's $50 before he hands it over (guided tutorial).
    this.order = new CoolerOrder(this.evening.slots, () => this.evening.stockBudgetCents, this.evening.cells, (i) => this.evening.cellOpen(i));
    this.restocking = this.evening.isRestocking;
    this.locked = this.evening.isPrepLocked && !this.restocking;
    this.buyButton = undefined;
    this.focus = { area: 'clipboard', row: 0 };
    this.rowCounts = [];
    this.cellIcons = [];
    this.cards = [];
    const { width, height } = this.scale;

    this.add.image(0, 0, COOLER_KEY).setOrigin(0, 0).setDisplaySize(width, height);
    this.title = this.add
      .text(599, 61, '', { fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold', color: INK })
      .setOrigin(0.5);

    this.makeClipboard();
    this.makeCells();
    this.makeMenu();
    // SCREAM-170: in the guided tutorial, what the uncle talks about gets an outline.
    const tutorial = this.evening.tutorial;
    if (tutorial && !this.locked) {
      addUnclePointer(this, tutorial, {
        clipboard: () => new Phaser.Geom.Rectangle(15, 46, 220, 448),
        menu: () => new Phaser.Geom.Rectangle(250, 294, 702, 210),
        buy: () => (this.buyButton ? Phaser.Geom.Rectangle.Inflate(this.buyButton.getBounds(), 6, 6) : null),
      });
    }

    this.note = this.add
      .text(
        width / 2,
        516,
        this.locked
          ? 'Stock and prices were locked when you left for the road.'
          : this.restocking
            ? 'Restocking at home: the clock is running. Bought stock can be added to, not returned.'
            : !this.evening.isClockRunning
            ? 'The clock starts when you leave the cooler. Everything locks when you drive off.'
            : 'Bought stock can be added to, not returned. Everything locks when you drive off.',
        { fontFamily: 'monospace', fontSize: '12px', color: !this.locked && !this.evening.isClockRunning ? '#1d5c8c' : '#5a4636' },
      )
      .setOrigin(0.5);
    this.keysLine = this.add
      .text(width / 2, height - 9, this.keysText(), { fontFamily: 'monospace', fontSize: '13px', color: INK })
      .setOrigin(0.5);
    this.noteText = this.note.text;
    this.noteColor = this.note.style.color as string;
    this.noteTimer = undefined;

    this.addKeys();

    const onChange = () => this.refresh();
    this.evening.on(EveningEvents.CoolerChanged, onChange);
    this.evening.on(EveningEvents.MoneyChanged, onChange);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.evening.off(EveningEvents.CoolerChanged, onChange);
      this.evening.off(EveningEvents.MoneyChanged, onChange);
    });

    this.refresh();
    this.openLids();
  }

  // ---- The clipboard ----

  private makeClipboard(): void {
    const { paper, rowY } = COOLER_LAYOUT;
    const middle = (paper.left + paper.right) / 2;
    this.add
      .text(middle, 104, 'Available Ice Cream', { fontFamily: MARKER_FONT, fontSize: '19px', color: INK })
      .setOrigin(0.5);
    this.rowHighlight = this.add.rectangle(middle, rowY[0] ?? 0, paper.right - paper.left - 6, 56, 0xffe066, 0.55);

    FLAVOURS.forEach((flavour, row) => {
      const y = rowY.at(row) ?? 0;
      // SCREAM-144 (PO, November 3): no picture on the left; name and price left-aligned, the add picture on the right.
      const textLeft = paper.left + 12;
      this.add
        .text(textLeft, y - 14, flavour.name, {
          fontFamily: 'monospace',
          fontSize: '13px',
          fontStyle: 'bold',
          color: INK,
          wordWrap: { width: 132 },
        })
        .setOrigin(0, 0.5)
        .setLineSpacing(-2);
      this.add.text(textLeft, y + 16, `${formatMoney(flavour.costCents)} each`, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#5a4636',
      }).setOrigin(0, 0.5);
      // How many of this flavour are in the cooler.
      this.rowCounts.push(
        this.add
          .text(paper.right - 52, y + 16, '', { fontFamily: 'monospace', fontSize: '12px', color: '#5a4636' })
          .setOrigin(1, 0.5),
      );
      if (!this.locked) {
        // The whole row picks one; so does its + button.
        const hit = this.add
          .rectangle(middle, y, paper.right - paper.left - 6, 56, 0xffffff, 0.001)
          .setInteractive({ useHandCursor: true });
        hit.on('pointerdown', () => {
          this.focus = { area: 'clipboard', row };
          this.pick(flavour.id);
        });
        this.makeAddButton(paper.right - 26, y, flavour.id, () => {
          this.focus = { area: 'clipboard', row };
          this.pick(flavour.id);
        });
      }
    });

    this.totals = this.add
      .text(middle, 392, '', { fontFamily: 'monospace', fontSize: '13px', color: INK, align: 'center', lineSpacing: 4 })
      .setOrigin(0.5);
    if (!this.locked) {
      // A sample of the not-paid-yet outline, as a key.
      const key = this.add.graphics();
      dashedSquare(key, paper.left + 34, 428, 18, UNPAID);
      this.add.text(paper.left + 50, 428, '= not paid for yet', { fontFamily: 'monospace', fontSize: '11px', color: '#5a4636' }).setOrigin(0, 0.5);
      this.buyButton = this.add
        .text(middle, 466, '', {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#ffffff',
          backgroundColor: '#2e7d32',
          padding: { x: 10, y: 6 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      this.buyButton.on('pointerdown', () => this.buy());
    }
  }

  // ---- The crates ----

  private makeCells(): void {
    const { crateLefts, crateTop, cell, cellPad } = COOLER_LAYOUT;
    const crateSize = CRATE_SIDE * cell + 2 * cellPad;
    // SCREAM-131 (PO, November 2): picks go into the chosen crate. Click a crate (or press 1, 2, 3) to choose it.
    this.crateMark = this.add.graphics();
    if (!this.locked) {
      crateLefts.forEach((left, crate) => {
        this.add
          .rectangle(left, crateTop, crateSize, crateSize, 0xffffff, 0.001)
          .setOrigin(0, 0)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => {
            this.order.chooseCrate(crate);
            this.refresh();
          });
      });
    }
    // SCREAM-269: in Story the right half of every crate is under a plain panel.
    this.coveredHalves = [];
    if (this.evening.spec.coolerHalfCovered) {
      crateLefts.forEach((left) => this.coveredHalves.push(addCoveredHalf(this, left + crateSize / 2, crateTop, crateSize / 2, crateSize)));
    }
    for (let i = 0; i < COOLER_CAPACITY; i++) {
      const { x, y } = this.cellCentre(i);
      const icon = this.add.image(x, y, FLAVOUR_ICONS_KEY, 0).setScale(0.92).setVisible(false);
      this.cellIcons.push(icon);
      if (!this.locked) {
        // SCREAM-132 (PO, November 2): drag an ice cream to another square; a click (no drag)
        // takes out one not paid for yet.
        icon.setInteractive({ useHandCursor: true, draggable: true });
        icon.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => icon.setPosition(dx, dy).setDepth(5));
        icon.on('dragend', (pointer: Phaser.Input.Pointer) => {
          const moved = Phaser.Math.Distance.Between(pointer.downX, pointer.downY, pointer.upX, pointer.upY);
          const home = this.cellCentre(i);
          icon.setPosition(home.x, home.y).setDepth(0);
          if (moved < 6) this.order.removeAt(i);
          else {
            const target = this.cellAt(pointer.upX, pointer.upY);
            if (target >= 0) this.order.move(i, target);
          }
          this.refresh();
        });
      }
    }
    // The dashed outlines on squares not paid for yet, pulsing gently.
    this.unpaidMarks = this.add.graphics();
    this.tweens.add({ targets: this.unpaidMarks, alpha: 0.45, duration: 600, yoyo: true, repeat: -1 });
  }

  /** The middle of a square on screen. */
  private cellCentre(i: number): { x: number; y: number } {
    const { crateLefts, crateTop, cell, cellPad } = COOLER_LAYOUT;
    const crate = Math.floor(i / (CRATE_SIDE * CRATE_SIDE));
    const inCrate = i % (CRATE_SIDE * CRATE_SIDE);
    return {
      x: (crateLefts.at(crate) ?? 0) + cellPad + (inCrate % CRATE_SIDE) * cell + cell / 2,
      y: crateTop + cellPad + Math.floor(inCrate / CRATE_SIDE) * cell + cell / 2,
    };
  }

  /** The square under a screen point, or -1. */
  private cellAt(x: number, y: number): number {
    const { cell } = COOLER_LAYOUT;
    for (let i = 0; i < COOLER_CAPACITY; i++) {
      if (!this.evening.cellOpen(i)) continue; // SCREAM-269: nothing drops onto a covered half
      const c = this.cellCentre(i);
      if (Math.abs(x - c.x) <= cell / 2 && Math.abs(y - c.y) <= cell / 2) return i;
    }
    return -1;
  }

  // ---- Today's Menu ----

  private makeMenu(): void {
    this.add.text(599, 314, "Today's Menu", { fontFamily: MARKER_FONT, fontSize: '22px', color: INK }).setOrigin(0.5);
    this.emptyMenu = this.add
      .text(599, 414, 'Pick ice creams from the clipboard.\nEach flavour you stock goes on the menu here.', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#5a4636',
        align: 'center',
      })
      .setOrigin(0.5);
    const { w, h } = COOLER_LAYOUT.card;
    FLAVOURS.forEach((flavour, n) => {
      const colours = MENU_COLOURS[flavour.id];
      const parts: Phaser.GameObjects.GameObject[] = [];
      const frame = this.add.rectangle(0, 0, w, h, 0x3c3c3c).setOrigin(0, 0);
      parts.push(frame);
      parts.push(this.add.rectangle(2, 2, w - 4, h - 4, colours.card).setOrigin(0, 0));
      // A sunburst behind the ice cream, like the real cards.
      const rays = this.add.graphics().fillStyle(colours.burst, 1);
      const cx = w / 2;
      const cy = 56;
      for (let a = 0; a < 360; a += 30) {
        const r = Phaser.Math.DegToRad(a);
        rays.fillTriangle(cx, cy, cx + Math.cos(r) * 34, cy + Math.sin(r) * 34, cx + Math.cos(r + 0.26) * 34, cy + Math.sin(r + 0.26) * 34);
      }
      parts.push(rays);
      parts.push(this.add.image(cx, cy, FLAVOUR_ICONS_KEY, flavourFrame(flavour.id)).setScale(1.7));
      // The name strip and the white space where the price is written.
      parts.push(this.add.rectangle(2, 2, w - 4, 18, 0xffffff).setOrigin(0, 0));
      parts.push(
        this.add
          .text(cx, 11, flavour.name.toUpperCase(), {
            fontFamily: 'monospace',
            fontSize: flavour.name.length > 18 ? '9px' : '11px',
            fontStyle: 'bold',
            color: '#3c3c3c',
          })
          .setOrigin(0.5),
      );
      parts.push(this.add.rectangle(2, 94, w - 4, h - 96, 0xffffff).setOrigin(0, 0));
      parts.push(this.add.rectangle(2, 93, w - 4, 1, 0x3c3c3c).setOrigin(0, 0));
      const price = this.add
        .text(cx, 120, '', { fontFamily: MARKER_FONT, fontSize: '30px', color: '#141418' })
        .setOrigin(0.5)
        .setAngle([-5, 3, -3, 5][n] ?? 0);
      parts.push(price);
      const margin = this.add.text(cx, 148, '', { fontFamily: 'monospace', fontSize: '11px', color: '#2e7d32' }).setOrigin(0.5);
      parts.push(margin);
      const container = this.add.container(0, 0, parts);
      if (!this.locked) {
        const change = (direction: -1 | 1) => () => {
          this.focus = { area: 'menu', index: this.visibleCards().findIndex((c) => c.flavour === flavour.id) };
          this.order.changePrice(flavour.id, direction * PRICE_STEP_CENTS);
          this.refresh();
        };
        container.add(this.makeButton(16, 120, '−', change(-1), 16, false));
        container.add(this.makeButton(w - 16, 120, '+', change(1), 16, false));
      }
      this.cards.push({ flavour: flavour.id, container, frame, price, margin });
    });
  }

  /** The menu's cards in order: one for each flavour the cooler will hold. */
  private visibleCards(): MenuCard[] {
    return this.cards.filter((card) => this.order.quantity(card.flavour) > 0);
  }

  // ---- Shared bits ----

  /**
   * SCREAM-133 (PO, November 2): the clipboard's add button is the ice cream's picture with a
   * "+" badge on it that gently pulses. It grows a little under the mouse and bounces when it adds one.
   */
  private makeAddButton(x: number, y: number, flavour: FlavourId, onClick: () => void): void {
    const picture = addFlavourIcon(this, 0, 0, flavour, 1.4);
    const badge = this.add.container(15, -20, [
      this.add.circle(0, 0, 8, 0x2e7d32).setStrokeStyle(2, 0xffffff),
      this.add.text(0, -1, '+', { fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5),
    ]);
    this.tweens.add({ targets: badge, scale: 1.25, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const button = this.add.container(x, y, [picture, badge]).setName(`add-${flavour}`);
    // A zone for the click area (a container's own hit area sits off-centre).
    const hit = this.add.zone(x - 22, y - 27, 44, 54).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => picture.setScale(1.55));
    hit.on('pointerout', () => picture.setScale(1.4));
    hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      onClick();
    });
    this.addButtons.set(flavour, button);
  }

  private makeButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    size: number,
    addToScene = true,
  ): Phaser.GameObjects.Text {
    const button = (addToScene ? this.add.text(x, y, label) : this.make.text({ x, y, text: label }, false))
      .setStyle({ fontFamily: 'monospace', fontSize: `${size}px`, color: '#ffffff', backgroundColor: BUTTON, padding: { x: 6, y: 1 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    button.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      onClick();
    });
    return button;
  }

  private addKeys(): void {
    const keyboard = this.input.keyboard;
    // Going back without buying throws the draft order away. The truck can't
    // leave the cooler empty, though (#66 feedback): buy at least one first.
    let leaving = false;
    const back = () => {
      if (leaving) return;
      // At home (SCREAM-54) the player may drive off without buying (out of cash, say).
      if (!this.locked && !this.restocking && this.evening.stockLeft === 0) {
        this.warnEmpty();
        return;
      }
      leaving = true;
      this.leave();
    };
    keyboard?.on('keydown-B', back);
    keyboard?.on('keydown-BACKSPACE', back);
    if (this.locked) return;

    keyboard?.on('keydown-ENTER', () => this.buy());
    keyboard?.on('keydown-SPACE', () => this.buy());
    keyboard?.on('keydown-UP', () => this.moveFocus(-1));
    keyboard?.on('keydown-DOWN', () => this.moveFocus(1));
    keyboard?.on('keydown-LEFT', () => this.switchArea(-1));
    keyboard?.on('keydown-RIGHT', () => this.switchArea(1));
    // Read the typed character so + and - work on every keyboard layout and browser.
    // SCREAM-131: 1, 2, 3 choose the crate new picks go into.
    (['ONE', 'TWO', 'THREE'] as const).forEach((key, crate) =>
      keyboard?.on(`keydown-${key}`, () => {
        this.order.chooseCrate(crate);
        this.refresh();
      }),
    );
    keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (event.key === '+' || event.key === '=') this.adjust(1);
      if (event.key === '-' || event.key === '_') this.adjust(-1);
    });
  }

  /** Up and down: between the clipboard's flavours, or along the menu's cards. */
  private moveFocus(direction: -1 | 1): void {
    if (this.focus.area === 'clipboard') {
      this.focus = { area: 'clipboard', row: (this.focus.row + direction + FLAVOURS.length) % FLAVOURS.length };
    } else {
      const count = this.visibleCards().length;
      if (count > 0) this.focus = { area: 'menu', index: (this.focus.index + direction + count) % count };
    }
    this.refresh();
  }

  /** Left and right: between the clipboard and the menu (when it has cards). */
  private switchArea(direction: -1 | 1): void {
    if (this.focus.area === 'clipboard' && direction === 1 && this.visibleCards().length > 0) {
      this.focus = { area: 'menu', index: 0 };
    } else if (this.focus.area === 'menu' && direction === -1) {
      this.focus = { area: 'clipboard', row: 0 };
    } else if (this.focus.area === 'menu') {
      this.moveFocus(direction);
      return;
    }
    this.refresh();
  }

  /** + and -: on the clipboard, pick one or put the last one back; on the menu, change the price. */
  private adjust(direction: -1 | 1): void {
    if (this.focus.area === 'clipboard') {
      const flavour = FLAVOURS.at(this.focus.row)?.id;
      if (!flavour) return;
      if (direction === 1) this.pick(flavour);
      else if (this.order.removeOne(flavour)) this.refresh();
    } else {
      const card = this.visibleCards().at(this.focus.index);
      if (card) this.order.changePrice(card.flavour, direction * PRICE_STEP_CENTS);
      this.refresh();
    }
  }

  private pick(flavour: FlavourId): void {
    if (this.order.addOne(flavour)) {
      this.evening.tutorial?.signal('flavourAdded');
      // SCREAM-133: the picture bounces as one goes into the cooler.
      const button = this.addButtons.get(flavour);
      if (button) {
        this.tweens.killTweensOf(button);
        button.setScale(1);
        this.tweens.add({ targets: button, scale: 1.2, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
      }
    } else {
      const r = this.order.refusal;
      this.flashNote(
        r === 'full' ? 'The cooler is full.' : 'Not enough cash for that one.',
      );
    }
    this.refresh();
  }

  /** SCREAM-277: nothing new has been picked, so the button would charge nothing. */
  private get nothingNew(): boolean {
    return this.order.costCents === 0;
  }

  /** The line of keys along the bottom; Enter is named after what the button says (SCREAM-277). */
  private keysText(): string {
    if (this.locked) return 'B Or Backspace: Back To The Truck';
    const enter = this.nothingNew ? 'Enter: Done' : 'Enter: Buy Stock';
    return `↑↓←→ Move   + / − Change   ${enter}   ${this.restocking ? 'B: Back On The Road' : 'B: Cancel And Go Back'}`;
  }

  /** Pays for the draft order (nothing, when the button says DONE) and heads back to the truck. */
  private buy(): void {
    // An order that leaves the cooler empty doesn't count (#66 feedback).
    if (this.order.total === 0) {
      this.warnEmpty();
      return;
    }
    if (this.evening.buyStock(this.order)) this.leave();
  }

  /** Back to the truck after prep; back on the road after restocking at home (SCREAM-54). */
  private leave(): void {
    if (this.restocking) {
      this.evening.endRestock();
      if (!this.evening.isOver) this.scene.start(SceneKeys.Drive);
      return;
    }
    returnToTruck(this, 'cooler');
  }

  /** Says why the player can't leave yet, in red, then puts the usual note back. */
  private warnEmpty(): void {
    this.flashNote('Add at least one ice cream before you leave the cooler.');
  }

  private flashNote(text: string): void {
    this.note.setText(text).setColor('#b3261e');
    this.noteTimer?.remove();
    this.noteTimer = this.time.delayedCall(2500, () => this.note.setText(this.noteText).setColor(this.noteColor));
  }

  /**
   * SCREAM-124 (PO): the freezer opens. Two glass lids cover the opening, then fold away
   * into the rim at the top. Nothing on them is clickable, so the buttons work straight away.
   */
  private openLids(): void {
    const { left, top, right, bottom } = COOLER_LAYOUT.opening;
    const mid = (left + right) / 2;
    for (const [x0, x1] of [[left, mid], [mid, right]]) {
      const w = (x1 ?? 0) - (x0 ?? 0);
      const h = bottom - top;
      const lid = this.add.graphics().setDepth(10);
      lid.fillStyle(0xcfeef5, 1).fillRect(0, 0, w, h);
      lid.lineStyle(10, 0xffffff, 0.7).lineBetween(w * 0.15, h, w * 0.45, 0).lineBetween(w * 0.3, h, w * 0.6, 0);
      lid.lineStyle(6, 0x7f7f7f, 1).strokeRect(3, 3, w - 6, h - 6);
      lid.fillStyle(0xffffff, 1).fillRect(w / 2 - 22, h - 26, 44, 10);
      lid.lineStyle(3, 0x7f7f7f, 1).strokeRect(w / 2 - 22, h - 26, 44, 10);
      lid.setPosition(x0 ?? 0, top);
      this.tweens.add({
        targets: lid,
        scaleY: 0,
        alpha: 0.6,
        delay: LID_WAIT_MS,
        duration: LID_OPEN_MS,
        ease: 'Cubic.easeIn',
        onComplete: () => lid.destroy(),
      });
    }
  }

  private refresh(): void {
    const { rowY, cell, card: cardSize } = COOLER_LAYOUT;
    const total = this.order.total;
    this.title.setText(
      (this.locked ? 'THE COOLER  (stock is set for tonight)' : this.restocking ? 'THE COOLER  –  RESTOCK AT HOME' : 'THE COOLER  –  PREP') +
        `     ${total} / ${this.order.capacity}`,
    );

    // Clipboard: how many of each, and the focus.
    FLAVOURS.forEach((flavour, row) => {
      const count = this.order.quantity(flavour.id);
      this.rowCounts.at(row)?.setText(count > 0 ? `x${count}` : '');
    });
    this.rowHighlight.setVisible(this.focus.area === 'clipboard' && !this.locked);
    if (this.focus.area === 'clipboard') this.rowHighlight.setY(rowY.at(this.focus.row) ?? 0);

    // The crates, and the outline round the one new picks go into.
    const cells = this.order.cells;
    this.crateMark.clear();
    if (!this.locked) {
      const { crateLefts, crateTop, cellPad } = COOLER_LAYOUT;
      const size = CRATE_SIDE * cell + 2 * cellPad;
      this.crateMark.lineStyle(4, 0xffc533, 1).strokeRect((crateLefts.at(this.order.crate) ?? 0) - 3, crateTop - 3, size + 6, size + 6);
    }
    this.unpaidMarks.clear();
    cells.forEach((c, i) => {
      const icon = this.cellIcons.at(i);
      if (!icon) return;
      icon.setVisible(!!c);
      if (!c) return;
      icon.setFrame(flavourFrame(c.flavour));
      if (!c.paid) dashedSquare(this.unpaidMarks, icon.x, icon.y, cell - 4, UNPAID);
    });

    // Today's Menu: a card per flavour in the cooler, left to right.
    const visible = this.visibleCards();
    if (this.focus.area === 'menu' && this.focus.index >= visible.length) {
      this.focus = visible.length > 0 ? { area: 'menu', index: visible.length - 1 } : { area: 'clipboard', row: 0 };
    }
    this.emptyMenu.setVisible(visible.length === 0);
    this.cards.forEach((card) => card.container.setVisible(false));
    visible.forEach((card, n) => {
      const slot = this.order.slots.find((s) => s.flavour === card.flavour);
      if (!slot) return;
      card.container.setVisible(true).setPosition(cardSize.firstLeft + n * (cardSize.w + cardSize.gap), cardSize.top);
      card.price.setText(formatMoney(slot.priceCents).replace(/\.00$/, ''));
      const profitEach = slot.priceCents - getFlavour(slot.flavour).costCents;
      // SCREAM-72 (PO): no "$4" warning; players find the price ceiling from how customers react.
      if (profitEach <= 0) card.margin.setText('No profit at this price').setColor('#b3261e');
      else card.margin.setText(`Profit ${formatMoney(profitEach)} each`).setColor('#2e7d32');
      const focused = this.focus.area === 'menu' && this.focus.index === n && !this.locked;
      card.frame.setFillStyle(focused ? 0xffc533 : 0x3c3c3c);
    });

    // The order, at the bottom of the clipboard.
    if (this.locked) {
      this.totals.setText(`Spent on stock:\n${formatMoney(this.evening.stockCostCents)}`);
    } else {
      this.totals.setText(
        `This order: ${formatMoney(this.order.costCents)}\n` +
          // SCREAM-191: before the uncle hands over his $50, it's what the player is spending.
          `${this.evening.uncleGiftComing ? "Uncle's" : 'Cash:'} ${formatMoney(this.evening.stockBudgetCents)} → ${formatMoney(this.order.cashAfterCents)}`,
      );
      // SCREAM-277 (PO, November 12): with nothing new picked there is nothing to buy, so the
      // button says DONE with no price. It goes back to BUY STOCK as soon as something is picked.
      this.buyButton?.setText(this.nothingNew ? 'DONE' : `BUY STOCK  ${formatMoney(this.order.costCents)}`);
      this.keysLine?.setText(this.keysText());
    }
  }
}

/** A square outline of dashes, centred on (x, y). */
function dashedSquare(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number, colour: number): void {
  const half = size / 2;
  const dash = 4;
  g.fillStyle(colour, 1);
  for (let t = 0; t < size; t += dash * 2) {
    const len = Math.min(dash, size - t);
    g.fillRect(x - half + t, y - half, len, 2);
    g.fillRect(x - half + t, y + half - 2, len, 2);
    g.fillRect(x - half, y - half + t, 2, len);
    g.fillRect(x + half - 2, y - half + t, 2, len);
  }
}
