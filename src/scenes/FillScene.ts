import * as Phaser from 'phaser';
import { getFlavour } from '../config/flavours';
import { getEvening, SceneKeys } from '../flow';
import { EveningEvents, EveningState } from '../state/EveningState';
import { TipBar } from '../ui/TipBar';

// Issue #14: the cooler during a sale. The player picks the ice creams they
// remember the customer ordering, then serves them. The tip countdown stays
// on screen (PO, doc 12 Q12). Buying stock and changing prices stay locked.

const COLUMN_X = [170, 480, 790];
const INK = '#2b1d10';
const BUTTON = '#1d5c8c';

type Column = {
  name: Phaser.GameObjects.Text;
  left: Phaser.GameObjects.Text;
  bag: Phaser.GameObjects.Text;
  frame: Phaser.GameObjects.Rectangle;
};

export class FillScene extends Phaser.Scene {
  private evening!: EveningState;
  private tipBar!: TipBar;
  private columns: Column[] = [];
  private focus = 0;
  private serveButton!: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKeys.Fill);
  }

  create(): void {
    this.evening = getEvening(this);
    this.columns = [];
    this.focus = 0;
    const { width, height } = this.scale;

    this.add.rectangle(0, 44, width, height - 44, 0xd8eef5).setOrigin(0, 0);
    this.add
      .text(width / 2, 104, 'THE COOLER  -  FILL THE ORDER', { fontFamily: 'monospace', fontSize: '24px', color: INK })
      .setOrigin(0.5);
    this.tipBar = new TipBar(this, 270, 66);

    for (let i = 0; i < COLUMN_X.length; i++) this.columns.push(this.makeColumn(i));

    this.serveButton = this.add
      .text(width / 2, 440, 'SERVE', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#ffffff',
        backgroundColor: '#2e7d32',
        padding: { x: 18, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.serveButton.on('pointerdown', () => this.serve());

    this.add
      .text(width / 2, height - 18, '← → choose    + / − or ↑ ↓: take out / put back    Enter: serve    B: back to the window', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: INK,
      })
      .setOrigin(0.5);

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (event.shiftKey && /^Digit[0-9]$/.test(event.code)) return; // debug shortcuts
      const key = event.key;
      if (key === 'ArrowLeft') this.moveFocus(-1);
      if (key === 'ArrowRight') this.moveFocus(1);
      if (key === '+' || key === '=' || key === 'ArrowUp') this.evening.pickForSale(this.focus, 1);
      if (key === '-' || key === '_' || key === 'ArrowDown') this.evening.pickForSale(this.focus, -1);
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

  private makeColumn(index: number): Column {
    const x = COLUMN_X.at(index) ?? 0;
    const frame = this.add.rectangle(x, 270, 290, 250, 0xffffff, 0.55).setStrokeStyle(3, 0x7aa7b8);
    const name = this.add.text(x, 175, '', { fontFamily: 'monospace', fontSize: '17px', color: INK }).setOrigin(0.5);
    const left = this.add.text(x, 205, '', { fontFamily: 'monospace', fontSize: '14px', color: '#5a4636' }).setOrigin(0.5);
    this.add.text(x, 250, 'IN THE BAG', { fontFamily: 'monospace', fontSize: '13px', color: '#5a4636' }).setOrigin(0.5);
    const bag = this.add.text(x, 290, '', { fontFamily: 'monospace', fontSize: '40px', color: INK }).setOrigin(0.5);

    const button = (dx: number, label: string, delta: 1 | -1) =>
      this.add
        .text(x + dx, 290, label, {
          fontFamily: 'monospace',
          fontSize: '24px',
          color: '#ffffff',
          backgroundColor: BUTTON,
          padding: { x: 10, y: 2 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.focus = index;
          this.evening.pickForSale(index, delta);
          this.refresh();
        });
    button(-90, '−', -1);
    button(90, '+', 1);
    return { name, left, bag, frame };
  }

  private moveFocus(direction: -1 | 1): void {
    this.focus = (this.focus + direction + COLUMN_X.length) % COLUMN_X.length;
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
    this.columns.forEach((column, i) => {
      const slot = this.evening.slots[i];
      if (!slot) return;
      const name = getFlavour(slot.flavour).name;
      column.name.setText(name).setFontSize(name.length > 18 ? 13 : 17);
      column.left.setText(`${slot.quantity} left in the cooler`);
      column.bag.setText(String(sale.bag[i] ?? 0));
      column.frame.setStrokeStyle(this.focus === i ? 6 : 3, this.focus === i ? 0xffc533 : 0x7aa7b8);
    });
    this.serveButton.setAlpha(sale.bagCount > 0 ? 1 : 0.4);
  }
}
