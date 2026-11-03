import * as Phaser from 'phaser';
import { getFlavour } from '../config/flavours';
import { PRICE_STEP_CENTS, SLOT_CAPACITY } from '../config/tuning';
import { getEvening, returnToTruck, SceneKeys } from '../flow';
import { CoolerOrder } from '../state/CoolerOrder';
import { EveningEvents, EveningState } from '../state/EveningState';
import { formatMoney } from '../util/format';
import { showLoadingWhileLoading } from './LoadingScene';

// Issue #8 (with #21 and #23): prepping the cooler. Three flavour slots; for
// each, the player picks a flavour, how many bars (up to 15) and a selling
// price. Changes are a draft order: Buy Stock pays for it and goes back to the
// truck; B goes back and cancels it (PR #29 feedback). Stock already bought can
// be added to but not returned. Everything locks once they head for the
// driver's seat.

type Row = 0 | 1 | 2; // 0 = flavour, 1 = how many, 2 = sell price

type Column = {
  name: Phaser.GameObjects.Text;
  cost: Phaser.GameObjects.Text;
  quantity: Phaser.GameObjects.Text;
  owned: Phaser.GameObjects.Text;
  price: Phaser.GameObjects.Text;
  margin: Phaser.GameObjects.Text;
  buttons: Phaser.GameObjects.Text[];
};

const COLUMN_X = [170, 480, 790];
// SCREAM-124: one row lower than before, to sit inside the crates of the freezer picture.
const ROW_Y = [164, 249, 334];
const SLOT_LABEL_Y = 128;

/**
 * SCREAM-124 (PO, November 2): the cooler looks like the inside of the PO's truck drawing.
 * The picture (drawn by tools/interior/draw_cooler.py) is the open freezer: steel rim, dark
 * inside with icicles, boxes at the back and a crate for each slot. The glass lids are
 * drawn here so they can slide open.
 */
const COOLER_KEY = 'cooler-inside';
const COOLER_URL = 'assets/interior/cooler-inside.png';
/** The freezer's dark opening on screen (matches OPENING in draw_cooler.py). */
const OPENING = { left: 24, top: 74, right: 936, bottom: 404 };
const LID_OPEN_MS = 600;
/** How long the lids stay shut before opening, so the player sees them. */
const LID_WAIT_MS = 250;
const INK = '#2b1d10';
const BUTTON = '#1d5c8c';

export class CoolerScene extends Phaser.Scene {
  private evening!: EveningState;
  private order!: CoolerOrder;
  private buyButton?: Phaser.GameObjects.Text;
  private columns: Column[] = [];
  private focus!: Phaser.GameObjects.Rectangle;
  private focusCol = 0;
  private focusRow: Row = 1;
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
    showLoadingWhileLoading(this); // SCREAM-75
  }

  create(): void {
    this.evening = getEvening(this);
    this.order = new CoolerOrder(this.evening.slots, () => this.evening.moneyCents);
    this.buyButton = undefined;
    this.columns = [];
    this.focusCol = 0;
    this.focusRow = 1;
    const { width, height } = this.scale;
    const locked = this.evening.isPrepLocked;

    this.add.image(0, 0, COOLER_KEY).setOrigin(0, 0).setDisplaySize(width, height);
    this.focus = this.add.rectangle(0, 0, 270, 40, 0xffe066, 0.55);

    // On the steel rim above the opening.
    this.add
      .text(width / 2, 60, locked ? 'THE COOLER  (stock is set for tonight)' : 'THE COOLER  –  PREP', {
        fontFamily: 'monospace',
        fontSize: '19px',
        fontStyle: 'bold',
        color: INK,
      })
      .setOrigin(0.5);

    for (let i = 0; i < COLUMN_X.length; i++) this.columns.push(this.makeColumn(i, locked));

    this.totals = this.add
      .text(width / 2, 418, '', { fontFamily: 'monospace', fontSize: '17px', color: INK })
      .setOrigin(0.5);

    if (!locked) {
      this.buyButton = this.add
        .text(width / 2, 458, '', {
          fontFamily: 'monospace',
          fontSize: '20px',
          color: '#ffffff',
          backgroundColor: '#2e7d32',
          padding: { x: 14, y: 6 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      this.buyButton.on('pointerdown', () => this.buy());
    }

    this.note = this.add
      .text(
        width / 2,
        locked ? 458 : 494,
        locked
          ? 'Stock and prices were locked when you left for the road.'
          : !this.evening.isClockRunning
            ? 'The clock starts when you leave the cooler. Everything locks when you drive off.'
            : 'Bought stock can be added to, not returned. Everything locks when you drive off.',
        { fontFamily: 'monospace', fontSize: '13px', color: !locked && !this.evening.isClockRunning ? '#1d5c8c' : '#5a4636' },
      )
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        height - 18,
        locked
          ? 'B Or Backspace: Back To The Truck'
          : '↑↓←→ Move   + / − Change   Enter: Buy Stock   B: Cancel And Go Back',
        { fontFamily: 'monospace', fontSize: '15px', color: INK },
      )
      .setOrigin(0.5);

    this.noteText = this.note.text;
    this.noteColor = this.note.style.color as string;
    this.noteTimer = undefined;

    const keyboard = this.input.keyboard;
    // Going back without buying throws the draft order away. The truck can't
    // leave the cooler empty, though (#66 feedback): buy at least one first.
    let leaving = false;
    const back = () => {
      if (leaving) return;
      if (!locked && this.evening.stockLeft === 0) {
        this.warnEmpty();
        return;
      }
      leaving = true;
      returnToTruck(this, 'cooler');
    };
    keyboard?.on('keydown-B', back);
    keyboard?.on('keydown-BACKSPACE', back);

    if (!locked) {
      keyboard?.on('keydown-ENTER', () => this.buy());
      keyboard?.on('keydown-SPACE', () => this.buy());
      keyboard?.on('keydown-UP', () => this.moveFocus(0, -1));
      keyboard?.on('keydown-DOWN', () => this.moveFocus(0, 1));
      keyboard?.on('keydown-LEFT', () => this.moveFocus(-1, 0));
      keyboard?.on('keydown-RIGHT', () => this.moveFocus(1, 0));
      // Read the typed character so + and - work on every keyboard layout and browser.
      keyboard?.on('keydown', (event: KeyboardEvent) => {
        if (event.key === '+' || event.key === '=') this.adjust(this.focusCol, this.focusRow, 1);
        if (event.key === '-' || event.key === '_') this.adjust(this.focusCol, this.focusRow, -1);
      });
    }

    const onCooler = () => this.refresh();
    const onMoney = () => this.refresh();
    this.evening.on(EveningEvents.CoolerChanged, onCooler);
    this.evening.on(EveningEvents.MoneyChanged, onMoney);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.evening.off(EveningEvents.CoolerChanged, onCooler);
      this.evening.off(EveningEvents.MoneyChanged, onMoney);
    });

    this.focus.setVisible(!locked);
    this.refresh();
    this.openLids();
  }

  /**
   * SCREAM-124 (PO): the freezer opens. Two glass lids cover the opening, then slide back
   * and fold away into the rim at the top. Nothing on them is clickable, so the buttons
   * underneath work straight away.
   */
  private openLids(): void {
    const { left, top, right, bottom } = OPENING;
    const mid = (left + right) / 2;
    for (const [x0, x1] of [[left, mid], [mid, right]]) {
      const w = x1 - x0;
      const h = bottom - top;
      const lid = this.add.graphics().setDepth(10);
      lid.fillStyle(0xcfeef5, 1).fillRect(0, 0, w, h);
      // Shine across the glass, the frame and a handle (the drawing's freezer lids).
      lid.lineStyle(10, 0xffffff, 0.7).lineBetween(w * 0.15, h, w * 0.45, 0).lineBetween(w * 0.3, h, w * 0.6, 0);
      lid.lineStyle(6, 0x7f7f7f, 1).strokeRect(3, 3, w - 6, h - 6);
      lid.fillStyle(0xffffff, 1).fillRect(w / 2 - 22, h - 26, 44, 10);
      lid.lineStyle(3, 0x7f7f7f, 1).strokeRect(w / 2 - 22, h - 26, 44, 10);
      lid.setPosition(x0, top);
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

  private makeColumn(index: number, locked: boolean): Column {
    const x = COLUMN_X.at(index) ?? 0;
    const text = (y: number, size: number, color = INK) =>
      this.add
        .text(x, y, '', { fontFamily: 'monospace', fontSize: `${size}px`, color })
        .setOrigin(0.5);

    // SCREAM-124: the slot is a crate in the freezer picture, so no panel is drawn here.
    text(SLOT_LABEL_Y, 18).setText(`SLOT ${index + 1}`).setFontStyle('bold');

    const name = text(ROW_Y[0], 17);
    const cost = text(ROW_Y[0] + 24, 13, '#5a4636');
    text(ROW_Y[1] - 26, 13, '#5a4636').setText('HOW MANY');
    const quantity = text(ROW_Y[1], 20);
    const owned = text(ROW_Y[1] + 24, 12, '#5a4636');
    text(ROW_Y[2] - 26, 13, '#5a4636').setText('SELL PRICE');
    const price = text(ROW_Y[2], 20);
    const margin = text(ROW_Y[2] + 28, 13);

    const buttons: Phaser.GameObjects.Text[] = [];
    if (!locked) {
      const labels: [Row, string, string][] = [
        [0, '◀', '▶'],
        [1, '−', '+'],
        [2, '−', '+'],
      ];
      for (const [row, minus, plus] of labels) {
        const y = ROW_Y.at(row) ?? 0;
        const offset = row === 0 ? 125 : 85;
        buttons.push(this.makeButton(x - offset, y, minus, () => this.adjust(index, row, -1), index, row));
        buttons.push(this.makeButton(x + offset, y, plus, () => this.adjust(index, row, 1), index, row));
      }
    }

    return { name, cost, quantity, owned, price, margin, buttons };
  }

  private makeButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    col: number,
    row: Row,
  ): Phaser.GameObjects.Text {
    const button = this.add
      .text(x, y, label, {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#ffffff',
        backgroundColor: BUTTON,
        padding: { x: 8, y: 2 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    button.on('pointerdown', () => {
      this.focusCol = col;
      this.focusRow = row;
      onClick();
      this.refresh();
    });
    return button;
  }

  private moveFocus(dCol: number, dRow: number): void {
    this.focusCol = (this.focusCol + dCol + COLUMN_X.length) % COLUMN_X.length;
    this.focusRow = (((this.focusRow + dRow) % 3) + 3) % 3 as Row;
    this.refresh();
  }

  /** Applies a + or - to one field of the draft. Invalid changes (too many, no cash) are simply ignored. */
  private adjust(col: number, row: Row, direction: -1 | 1): void {
    if (row === 0) this.order.cycleFlavour(col, direction);
    if (row === 1) this.order.changeQuantity(col, direction);
    if (row === 2) this.order.changePrice(col, direction * PRICE_STEP_CENTS);
    this.refresh();
  }

  /** Pays for the draft order and heads back to the truck. */
  private buy(): void {
    // An order that leaves the cooler empty doesn't count (#66 feedback).
    const total = this.order.slots.reduce((sum, slot) => sum + slot.quantity, 0);
    if (total === 0) {
      this.warnEmpty();
      return;
    }
    if (this.evening.buyStock(this.order)) returnToTruck(this, 'cooler');
  }

  /** Says why the player can't leave yet, in red, then puts the usual note back. */
  private warnEmpty(): void {
    this.note.setText('Add at least one ice cream before you leave the cooler.').setColor('#b3261e');
    this.noteTimer?.remove();
    this.noteTimer = this.time.delayedCall(2500, () => this.note.setText(this.noteText).setColor(this.noteColor));
  }

  private refresh(): void {
    const slots = this.order.slots;
    this.columns.forEach((column, i) => {
      const slot = slots.at(i);
      if (!slot) return;
      const flavour = getFlavour(slot.flavour);
      // Long names (e.g. Cookie Ice Cream Sandwich) shrink to fit between the arrows.
      column.name.setText(flavour.name).setFontSize(flavour.name.length > 18 ? 13 : 17);
      column.cost.setText(`Costs you ${formatMoney(flavour.costCents)} each`);
      column.quantity.setText(`${slot.quantity} / ${SLOT_CAPACITY}`);
      const owned = this.order.ownedQuantity(i);
      column.owned.setText(owned > 0 && !this.evening.isPrepLocked ? `${owned} already bought` : '');
      // A slot holding bought stock keeps its flavour, so dim its flavour arrows.
      const flavourLocked = this.order.isFlavourLocked(i);
      column.buttons.slice(0, 2).forEach((b) => b.setAlpha(flavourLocked ? 0.3 : 1));
      column.price.setText(formatMoney(slot.priceCents));

      const profitEach = slot.priceCents - flavour.costCents;
      // SCREAM-72 (PO): no "$4" warning; players find the price ceiling from how customers react.
      if (profitEach <= 0) {
        column.margin.setText('No profit at this price').setColor('#b3261e');
      } else {
        column.margin.setText(`Profit ${formatMoney(profitEach)} each`).setColor('#2e7d32');
      }
    });

    const x = COLUMN_X.at(this.focusCol) ?? 0;
    const y = ROW_Y.at(this.focusRow) ?? 0;
    this.focus.setPosition(x, y);

    if (this.evening.isPrepLocked) {
      this.totals.setText(`Spent on stock: ${formatMoney(this.evening.stockCostCents)}`);
    } else {
      this.totals.setText(
        `This order: ${formatMoney(this.order.costCents)}     ` +
          `Cash: ${formatMoney(this.evening.moneyCents)} → ${formatMoney(this.order.cashAfterCents)}`,
      );
      this.buyButton?.setText(`BUY STOCK  ${formatMoney(this.order.costCents)}`);
    }
  }
}
