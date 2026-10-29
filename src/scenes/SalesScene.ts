import * as Phaser from 'phaser';
import { getFlavour } from '../config/flavours';
import { getEvening, SceneKeys } from '../flow';
import { EveningEvents, EveningState } from '../state/EveningState';
import { TipBar } from '../ui/TipBar';
import { formatMoney } from '../util/format';

// Issues #13 and #15: the sales screen, zoomed in on the window (PO sketch in
// doc 12): a speech bubble on the left, the customer on the right of the
// window frame. The customer gives their order, the player goes to the cooler
// (#14), comes back, and types what to charge.

const INK = '#2b1d10';
const PRICE_PATTERN = /^\d{0,3}(\.\d{0,2})?$/;

export class SalesScene extends Phaser.Scene {
  private evening!: EveningState;
  private tipBar!: TipBar;
  private bubbleText!: Phaser.GameObjects.Text;
  private priceCard!: Phaser.GameObjects.Text;
  private priceBox!: Phaser.GameObjects.Text;
  private chargeLabel!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private sorryButton!: Phaser.GameObjects.Text;
  private typed = '';

  constructor() {
    super(SceneKeys.Sales);
  }

  create(): void {
    this.evening = getEvening(this);
    this.typed = '';
    const { width, height } = this.scale;

    // The truck wall, and the serving window.
    this.add.rectangle(0, 44, width, height - 44, 0xc89b6d).setOrigin(0, 0);
    this.add.rectangle(480, 255, 840, 330, 0x9ecbff).setStrokeStyle(10, 0x5a4636);
    this.add.rectangle(612, 255, 10, 330, 0x5a4636);
    this.add.rectangle(480, 427, 860, 18, 0x8a6a4a); // the counter

    // The customer, on the right side of the window.
    this.add.circle(770, 210, 46, 0xffd1b0).setStrokeStyle(4, 0x2b1d10);
    this.add.ellipse(770, 380, 190, 150, 0xff8fbf).setStrokeStyle(4, 0x2b1d10);

    // The speech bubble, reaching across from the customer.
    this.add.rectangle(330, 200, 480, 150, 0xfffdf9).setStrokeStyle(4, 0x2b1d10);
    this.add.triangle(590, 205, 0, -18, 0, 18, 110, 8, 0xfffdf9).setStrokeStyle(4, 0x2b1d10);
    this.add.rectangle(568, 205, 10, 30, 0xfffdf9); // hides the bubble's edge where the tail joins
    this.bubbleText = this.add
      .text(330, 200, '', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: INK,
        align: 'center',
        wordWrap: { width: 440 },
      })
      .setOrigin(0.5);

    this.tipBar = new TipBar(this, 100, 66);

    this.priceCard = this.add
      .text(90, 296, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: INK,
        lineSpacing: 4,
        backgroundColor: '#fffdf9',
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0, 0);
    this.chargeLabel = this.add
      .text(700, 470, 'CHARGE', { fontFamily: 'monospace', fontSize: '20px', color: INK, fontStyle: 'bold' })
      .setOrigin(1, 0.5);
    this.priceBox = this.add
      .text(720, 470, '', {
        fontFamily: 'monospace',
        fontSize: '30px',
        color: INK,
        backgroundColor: '#fffdf9',
        padding: { x: 12, y: 4 },
      })
      .setOrigin(0, 0.5);

    this.sorryButton = this.add
      .text(330, 330, "Sorry, ice cream's on me", {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#ffffff',
        backgroundColor: '#1d5c8c',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.sorryButton.on('pointerdown', () => this.leave());

    this.hint = this.add
      .text(width / 2, height - 18, '', { fontFamily: 'monospace', fontSize: '15px', color: INK })
      .setOrigin(0.5);

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.onKey(event));

    const onSale = () => this.refresh();
    this.evening.on(EveningEvents.SaleChanged, onSale);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.evening.off(EveningEvents.SaleChanged, onSale));

    this.refresh();
  }

  update(): void {
    this.tipBar.update(this.evening);
  }

  private onKey(event: KeyboardEvent): void {
    const sale = this.evening.sale;
    if (!sale || event.shiftKey) return; // Shift + number keys are the debug shortcuts
    const key = event.key;

    if (sale.phase === 'over') {
      if (key === 'Enter' || key === ' ') this.leave();
      return;
    }

    // B: drive off at any point before the sale is over (a lost sale).
    if (key === 'b' || key === 'B') {
      this.driveOff();
      return;
    }

    if (sale.phase === 'deciding') {
      if (key === 'Enter' || key === 'c' || key === 'C') this.scene.start(SceneKeys.Fill);
      else if ((key === 'r' || key === 'R') && sale.askAgain(this.evening.nowMs)) this.refresh();
      return;
    }

    if (sale.phase === 'pricing') {
      if (key === 'Backspace') this.typed = this.typed.slice(0, -1);
      else if (key === 'Enter') this.charge();
      else if (/^[0-9.]$/.test(key) && PRICE_PATTERN.test(this.typed + key)) this.typed += key;
      this.refresh();
    }
  }

  private charge(): void {
    if (this.typed === '' || this.typed === '.') return;
    const cents = Math.round(Number.parseFloat(this.typed) * 100);
    this.typed = '';
    this.evening.chargeForSale(cents);
    const outcome = this.evening.sale?.outcome;
    if (outcome?.kind === 'paid') this.celebrate(outcome.priceCents, outcome.tipCents);
  }

  /** PO, doc 12 Q16: the payment flashes on screen, then the tip. */
  private celebrate(priceCents: number, tipCents: number): void {
    const flash = (text: string, y: number, colour: string, delay: number) => {
      const t = this.add
        .text(330, y, text, { fontFamily: 'monospace', fontSize: '44px', color: colour, fontStyle: 'bold' })
        .setOrigin(0.5)
        .setStroke('#ffffff', 6)
        .setAlpha(0)
        .setScale(0.6);
      this.tweens.add({ targets: t, alpha: 1, scale: 1.15, duration: 250, delay, yoyo: true, hold: 900, repeat: 1 });
    };
    flash(`+${formatMoney(priceCents)}`, 300, '#2e7d32', 0);
    flash(tipCents > 0 ? `+${formatMoney(tipCents)} TIP` : 'no tip', 360, tipCents > 0 ? '#1d5c8c' : '#8a6a4a', 700);
  }

  private driveOff(): void {
    this.evening.driveOffFromSale();
    this.leave();
  }

  /** Back on the road; the next customer appears (or the evening ends if it's past 8 PM). */
  private leave(): void {
    this.evening.closeSale();
    if (this.evening.isOver) return; // the HUD is taking us to the results screen
    this.scene.start(SceneKeys.Drive);
  }

  private refresh(): void {
    const sale = this.evening.sale;
    if (!sale) return;
    this.bubbleText.setText(sale.line);

    const slots = this.evening.slots;
    const pricing = sale.phase === 'pricing';
    this.priceCard
      .setText(
        'YOUR PRICES\n' +
          slots
            .filter((s) => s.quantity > 0 || sale.order.some((l) => l.flavour === s.flavour))
            .map((s) => `${getFlavour(s.flavour).name.padEnd(26)} ${formatMoney(s.priceCents)}`)
            .join('\n'),
      )
      .setVisible(pricing);
    this.priceBox.setText(`$${this.typed === '' ? '__.__' : this.typed}`).setVisible(pricing);
    this.chargeLabel.setVisible(pricing);

    const freebie = sale.outcome?.kind === 'overcharged' || sale.outcome?.kind === 'wrong-order';
    this.sorryButton.setVisible(freebie);

    let hint = '';
    if (sale.phase === 'ordering') hint = 'Remember the order!    B: drive off';
    if (sale.phase === 'deciding') {
      const canAsk = !sale.askedAgain && !sale.retryUsed;
      hint = `C or Enter: go to the cooler    ${canAsk ? 'R: ask again (no tip)    ' : ''}B: drive off`;
    }
    if (pricing) hint = 'Type the price, then Enter to charge    Backspace: fix    B: drive off';
    if (sale.phase === 'over') hint = freebie ? "Enter: say sorry, it's on the house" : 'Enter: back on the road';
    this.hint.setText(hint);
  }
}
