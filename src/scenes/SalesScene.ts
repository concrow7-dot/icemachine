import * as Phaser from 'phaser';
import { getFlavour } from '../config/flavours';
import { getEvening, SceneKeys } from '../flow';
import { EveningEvents, EveningState } from '../state/EveningState';
import { pressPriceKey, priceEntryCents } from '../state/PriceEntry';
import { Calculator, type CalculatorKey } from '../ui/Calculator';
import { TipBar } from '../ui/TipBar';
import { formatMoney } from '../util/format';

// Issues #13 and #15: the sales screen, zoomed in on the window (PO sketch in
// doc 12): a speech bubble on the left, the customer on the right of the
// window frame. The customer gives their order, the player goes to the cooler
// (#14), comes back, and types what to charge.

const INK = '#2b1d10';
/** The window's buttons sit centred below the counter, above the key hints (ICE-14). */
const BUTTON_X = 480;
const BUTTON_Y = 478;
/** The calculator sits in the middle of the window during pricing, beside YOUR PRICES (SCREAM-12). */
const CALC_X = 390;
const CALC_Y = 278;
/** The paid flash (PO, doc 12 Q16): the price, then the tip. Each flashes once (#69): 1.5x the old 250 ms in, 900 ms hold. */
const FLASH_IN_MS = 375;
const FLASH_HOLD_MS = 1350;
const TIP_FLASH_DELAY_MS = 1050;

export class SalesScene extends Phaser.Scene {
  private evening!: EveningState;
  private tipBar!: TipBar;
  private bubbleText!: Phaser.GameObjects.Text;
  private priceCard!: Phaser.GameObjects.Text;
  private calculator!: Calculator;
  private hint!: Phaser.GameObjects.Text;
  private roadButton!: Phaser.GameObjects.Text;
  private coolerButton!: Phaser.GameObjects.Text;
  /** The price as typed on the calculator, left to right (SCREAM-12): '7.25', '7' ($7.00). */
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
        fontSize: '14px',
        color: INK,
        lineSpacing: 4,
        backgroundColor: '#fffdf9',
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0, 0);
    this.calculator = new Calculator(this, CALC_X, CALC_Y, (key) => this.pressKey(key)).setVisible(false);

    // Below the window, centred, where GO TO THE COOLER sits (ICE-14, ICE-15). Shows once the
    // sale is over, paid or not; the hint still says sorry when the ice cream ends up free.
    this.roadButton = this.add
      .text(BUTTON_X, BUTTON_Y, 'BACK ON THE ROAD', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: '#1d5c8c',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.roadButton.on('pointerdown', () => this.leave());

    this.coolerButton = this.add
      .text(BUTTON_X, BUTTON_Y, 'GO TO THE COOLER', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: '#2e7d32',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.coolerButton.on('pointerdown', () => this.goToCooler());

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

    if (sale.phase === 'ordering' || sale.phase === 'deciding') {
      if (key === 'Enter' || key === 'c' || key === 'C') this.goToCooler();
      else if ((key === 'r' || key === 'R') && sale.askAgain(this.evening.nowMs)) this.refresh();
      return;
    }

    if (sale.phase === 'pricing') {
      // Typed like a calculator (SCREAM-12); the number pad's keys arrive as the same characters.
      if (key === 'Backspace') this.pressKey('BACK');
      else if (key === 'Delete') this.pressKey('C');
      else if (key === 'Enter') this.pressKey('CHARGE');
      else if (/^[0-9]$/.test(key) || key === '.') this.pressKey(key as CalculatorKey);
      return;
    }
  }

  /** To the cooler, even while the order is still showing (PO, PR #38). */
  private goToCooler(): void {
    if (this.evening.sale?.skipToCooler(this.evening.nowMs)) this.scene.start(SceneKeys.Fill);
  }

  /** A calculator key, clicked or typed. */
  private pressKey(key: CalculatorKey): void {
    if (this.evening.sale?.phase !== 'pricing') return;
    if (key === 'CHARGE') {
      this.charge();
      return;
    }
    if (key === 'C') this.typed = '';
    else if (key === 'BACK') this.typed = this.typed.slice(0, -1);
    else this.typed = pressPriceKey(this.typed, key);
    this.refresh();
  }

  private charge(): void {
    const cents = priceEntryCents(this.typed);
    if (cents === null) return;
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
      // One flash each, held 1.5x longer than before (PO, October 30: it used to flash twice).
      this.tweens.add({
        targets: t,
        alpha: 1,
        scale: 1.15,
        duration: FLASH_IN_MS,
        delay,
        yoyo: true,
        hold: FLASH_HOLD_MS,
        onComplete: () => t.destroy(),
      });
    };
    flash(`+${formatMoney(priceCents)}`, 300, '#2e7d32', 0);
    flash(tipCents > 0 ? `+${formatMoney(tipCents)} TIP` : 'no tip', 360, tipCents > 0 ? '#1d5c8c' : '#8a6a4a', TIP_FLASH_DELAY_MS);
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
            .map((s) => `${getFlavour(s.flavour).name.padEnd(25)} ${formatMoney(s.priceCents)}`)
            .join('\n'),
      )
      .setVisible(pricing);
    this.calculator.show(this.typed);
    this.calculator.setVisible(pricing);

    const freebie = sale.outcome?.kind === 'overcharged' || sale.outcome?.kind === 'wrong-order';
    this.roadButton.setVisible(sale.phase === 'over');
    this.coolerButton.setVisible(sale.phase === 'ordering' || sale.phase === 'deciding');

    let hint = '';
    if (sale.phase === 'ordering') hint = 'Remember the order!    C or Enter: go to the cooler now    B: drive off';
    if (sale.phase === 'deciding') {
      const canAsk = !sale.askedAgain && !sale.retryUsed;
      hint = `C or Enter: go to the cooler    ${canAsk ? 'R: ask again (no tip)    ' : ''}B: drive off`;
    }
    if (pricing) {
      hint = 'Type the price (7.25) or click the keys    Enter: charge    Backspace: undo    B: drive off';
    }
    if (sale.phase === 'over') hint = freebie ? "Enter: say sorry, it's on the house" : 'Enter: back on the road';
    this.hint.setText(hint);
  }
}
