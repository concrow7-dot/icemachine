import * as Phaser from 'phaser';
import { getFlavour } from '../config/flavours';
import { PRICE_STEP_CENTS, REFUSE_ABOVE_CENTS, SLOT_CAPACITY } from '../config/tuning';
import { getEvening, returnToTruck, SceneKeys } from '../flow';
import { CoolerOrder } from '../state/CoolerOrder';
import { EveningEvents, EveningState } from '../state/EveningState';
import { formatMoney } from '../util/format';

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
const ROW_Y = [150, 235, 320];
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

  constructor() {
    super(SceneKeys.Cooler);
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

    this.add.rectangle(0, 44, width, height - 44, 0xd8eef5).setOrigin(0, 0);
    this.focus = this.add.rectangle(0, 0, 270, 40, 0xffe066, 0.55);

    this.add
      .text(width / 2, 70, locked ? 'THE COOLER  (stock is set for tonight)' : 'THE COOLER  -  PREP', {
        fontFamily: 'monospace',
        fontSize: '24px',
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

    this.add
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
          ? 'B or Backspace: back to the truck'
          : '↑↓←→ move   + / − change   Enter: buy stock   B: cancel and go back',
        { fontFamily: 'monospace', fontSize: '15px', color: INK },
      )
      .setOrigin(0.5);

    const keyboard = this.input.keyboard;
    // Going back without buying throws the draft order away.
    const back = () => returnToTruck(this, 'cooler');
    keyboard?.once('keydown-B', back);
    keyboard?.once('keydown-BACKSPACE', back);

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
  }

  private makeColumn(index: number, locked: boolean): Column {
    const x = COLUMN_X.at(index) ?? 0;
    const text = (y: number, size: number, color = INK) =>
      this.add
        .text(x, y, '', { fontFamily: 'monospace', fontSize: `${size}px`, color })
        .setOrigin(0.5);

    this.add.rectangle(x, 245, 290, 300, 0xffffff, 0.55).setStrokeStyle(2, 0x7aa7b8);
    text(112, 18).setText(`SLOT ${index + 1}`).setFontStyle('bold');

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
    if (this.evening.buyStock(this.order)) returnToTruck(this, 'cooler');
  }

  private refresh(): void {
    const slots = this.order.slots;
    this.columns.forEach((column, i) => {
      const slot = slots.at(i);
      if (!slot) return;
      const flavour = getFlavour(slot.flavour);
      // Long names (e.g. Cookie Ice Cream Sandwich) shrink to fit between the arrows.
      column.name.setText(flavour.name).setFontSize(flavour.name.length > 18 ? 13 : 17);
      column.cost.setText(`costs you ${formatMoney(flavour.costCents)} each`);
      column.quantity.setText(`${slot.quantity} / ${SLOT_CAPACITY}`);
      const owned = this.order.ownedQuantity(i);
      column.owned.setText(owned > 0 && !this.evening.isPrepLocked ? `${owned} already bought` : '');
      // A slot holding bought stock keeps its flavour, so dim its flavour arrows.
      const flavourLocked = this.order.isFlavourLocked(i);
      column.buttons.slice(0, 2).forEach((b) => b.setAlpha(flavourLocked ? 0.3 : 1));
      column.price.setText(formatMoney(slot.priceCents));

      const profitEach = slot.priceCents - flavour.costCents;
      if (slot.priceCents > REFUSE_ABOVE_CENTS) {
        column.margin.setText(`over ${formatMoney(REFUSE_ABOVE_CENTS)}: customers refuse!`).setColor('#b3261e');
      } else if (profitEach <= 0) {
        column.margin.setText('no profit at this price').setColor('#b3261e');
      } else {
        column.margin.setText(`profit ${formatMoney(profitEach)} each`).setColor('#2e7d32');
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
