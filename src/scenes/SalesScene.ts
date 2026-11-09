import * as Phaser from 'phaser';
import { drawBubble } from '../ui/speechBubble';
import { showLoadingWhileLoading } from './LoadingScene';
import { getFlavour } from '../config/flavours';
import { getEvening, SceneKeys } from '../flow';
import { EveningEvents, EveningState } from '../state/EveningState';
import { pressPriceKey, priceEntryCents } from '../state/PriceEntry';
import { Calculator, type CalculatorKey } from '../ui/Calculator';
import { TipBar } from '../ui/TipBar';
import { formatMoney } from '../util/format';
import { loadResidentSheet } from '../ui/residentLook';
import { smoothCustomerTexture, SMOOTH_FACTOR } from '../ui/smoothPixels';
import { addFlavourIcon, loadFlavourArt, MARKER_FONT } from '../ui/flavourArt';
import { addUnclePointer } from '../ui/unclePointer';

// Issues #13 and #15: the sales screen, zoomed in on the window (PO sketch in
// doc 08): a speech bubble on the left, the customer on the right of the
// window frame. The customer gives their order, the player goes to the cooler
// (#14), comes back, and types what to charge.

const INK = '#2b1d10';
/** The window's buttons sit centred below the counter, above the key hints (ICE-14). */
const BUTTON_X = 480;
const BUTTON_Y = 478;
/** The calculator sits in the middle of the window during pricing, beside YOUR PRICES (SCREAM-12). */
const CALC_X = 390;
const CALC_Y = 278;
/** The speech bubble's top and usual height; SCREAM-103: room for the name above a hint, and padding. */
const BUBBLE_Y = 125;
const BUBBLE_H = 150;
const BUBBLE_NAME_SPACE = 36;
const BUBBLE_PAD = 14;
/** The paid flash (PO, doc 08 Q16): the price, then the tip. Each flashes once (#69): 1.5x the old 250 ms in, 900 ms hold. */
const FLASH_IN_MS = 375;
const FLASH_HOLD_MS = 1350;
const TIP_FLASH_DELAY_MS = 1050;
/** SCREAM-106: the customer in the right half of the window, their map sprite blown up 13x (SCREAM-110: smoothed). */
const CUSTOMER_X = 756;
const CUSTOMER_SCALE = 13;
/** Only the top 29 of the frame's 32 px rows show (head to hips): the counter hides the feet. */
const CUSTOMER_ROWS = 29;
/** The top of the counter, where the cropped sprite's bottom edge sits. */
const COUNTER_TOP = 418;

/**
 * SCREAM-125 (PO, November 2): the window looks like the inside of the PO's truck drawing.
 * The picture (tools/interior/draw_sales.py): the striped wall, a chunky grey frame, the
 * glass pane slid over the left half, the awning's underside, sky and lawn outside, and the
 * counter shelf with the drawing's box and green cup.
 */
const WINDOW_KEY = 'sales-window';
const WINDOW_URL = 'assets/interior/sales-window.png';
/** The mini Today's Menu taped to the glass while pricing (top-left corner, width). */
const MENU_CARD = { x: 66, y: 282, w: 290 };

export class SalesScene extends Phaser.Scene {
  private evening!: EveningState;
  private tipBar!: TipBar;
  private bubbleText!: Phaser.GameObjects.Text;
  /** The speech bubble, and its height now (SCREAM-103: it grows for a long hint). */
  private bubble!: Phaser.GameObjects.Graphics;
  private bubbleH = 0;
  /** SCREAM-137: the order drawn as pictures in the bubble, and what it shows (so it's only rebuilt on a change). */
  private orderPictures!: Phaser.GameObjects.Container;
  private orderPicturesKey = '';
  /** SCREAM-125: a mini Today's Menu taped to the glass while pricing (was a plain YOUR PRICES card). */
  private priceCard!: Phaser.GameObjects.Container;
  private calculator!: Calculator;
  private hint!: Phaser.GameObjects.Text;
  /** SCREAM-172: redraws the uncle's outline round "R: Ask Again" when the hint line changes. */
  private redrawPointer?: () => void;
  private roadButton!: Phaser.GameObjects.Text;
  private coolerButton!: Phaser.GameObjects.Text;
  /** The price as typed on the calculator, left to right (SCREAM-12): '7.25', '7' ($7.00). */
  private typed = '';

  constructor() {
    super(SceneKeys.Sales);
  }

  preload(): void {
    loadResidentSheet(this);
    if (!this.textures.exists(WINDOW_KEY)) this.load.image(WINDOW_KEY, WINDOW_URL);
    loadFlavourArt(this);
    showLoadingWhileLoading(this); // SCREAM-75
  }

  create(): void {
    this.evening = getEvening(this);
    this.typed = '';
    const { width, height } = this.scale;

    // The truck wall and the serving window (SCREAM-125: the truck drawing's style).
    this.add.image(0, 0, WINDOW_KEY).setOrigin(0, 0).setDisplaySize(width, height);

    // The customer, on the right side of the window. SCREAM-106 (PO, November 2): the
    // same person you saw on the map, in their own look, from the head down to the counter.
    const customer = this.evening.customer;
    if (customer) {
      const look = customer.resident.look;
      // SCREAM-110 (PO, November 2): drawn from smoothed, 8x frames, so the edges are rounded, not blocky.
      const key = smoothCustomerTexture(this, look);
      const scale = CUSTOMER_SCALE / SMOOTH_FACTOR;
      const person = this.add
        .sprite(CUSTOMER_X, COUNTER_TOP - CUSTOMER_ROWS * CUSTOMER_SCALE, key, 0)
        .setOrigin(0.5, 0)
        .setScale(scale)
        .setName('customer');
      const show = (step: number) =>
        person.setFrame(step % 6).setCrop(0, 0, person.frame.width, CUSTOMER_ROWS * SMOOTH_FACTOR);
      show(0);
      // Standing at the window, breathing (the same idle frames as on the map).
      let step = 0;
      this.time.addEvent({ delay: 160, loop: true, callback: () => show(++step) });
    } else {
      // A sale with nobody from the map (the debug serve key): a plain stand-in.
      this.add.circle(CUSTOMER_X, 210, 46, 0xffd1b0).setStrokeStyle(4, 0x2b1d10);
      this.add.ellipse(CUSTOMER_X, 380, 190, 150, 0xff8fbf).setStrokeStyle(4, 0x2b1d10);
    }

    // The speech bubble, reaching across from the customer.
    // SCREAM-126: the game's shared pixel bubble (Pokémon Yellow-style), tail stepping toward the customer.
    this.bubble = this.add.graphics();
    this.sizeBubble(BUBBLE_H);
    // SCREAM-127 (PO, November 2): the customer's name sits in the speech bubble, top left, like
    // the speaker's name in a Pokémon text box (it used to be a name tag under the customer).
    if (customer) {
      this.add.text(118, 141, customer.resident.name, {
        fontFamily: 'monospace',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#c2185b',
      });
    }
    this.bubbleText = this.add
      .text(330, 212, '', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: INK,
        align: 'center',
        wordWrap: { width: 440 },
      })
      .setOrigin(0.5);
    this.orderPictures = this.add.container(330, 212);

    // SCREAM-125 (PO, November 2): a tip jar on the counter, right of the customer.
    this.tipBar = new TipBar(this, 892, 412, true);

    this.priceCard = this.add.container(MENU_CARD.x, MENU_CARD.y);
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

    // SCREAM-172: his tip about asking again outlines the R key's hint.
    this.redrawPointer = undefined;
    const tutorial = this.evening.tutorial;
    if (tutorial) this.redrawPointer = addUnclePointer(this, tutorial, { repeat: () => this.repeatHintRect() }).redraw;

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
      else if ((key === 'r' || key === 'R') && sale.askAgain(this.evening.nowMs)) {
        this.evening.tutorial?.release(); // SCREAM-172: he asked her to repeat it, as the uncle said
        this.refresh();
      }
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
    if (!this.evening.sale?.skipToCooler(this.evening.nowMs)) return;
    this.evening.tutorial?.skipRepeatTip(); // SCREAM-172: the R tip is no use at the cooler
    this.scene.start(SceneKeys.Fill);
  }

  /** Where "R: Ask Again (No Tip)" is in the hint line (it's monospace, so by its letters). */
  private repeatHintRect(): Phaser.Geom.Rectangle | null {
    const text = this.hint?.text ?? '';
    const at = text.indexOf('R: Ask Again');
    if (at < 0 || !this.hint.visible) return null;
    const label = 'R: Ask Again (No Tip)';
    const b = this.hint.getBounds();
    const letter = b.width / text.length;
    return new Phaser.Geom.Rectangle(b.x + at * letter - 8, b.y - 5, label.length * letter + 16, b.height + 10);
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

  /** PO, doc 08 Q16: the payment flashes on screen, then the tip. */
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
    flash(tipCents > 0 ? `+${formatMoney(tipCents)} TIP` : 'No tip', 360, tipCents > 0 ? '#1d5c8c' : '#8a6a4a', TIP_FLASH_DELAY_MS);
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

  /**
   * SCREAM-125: the prices, as a mini Today's Menu taped to the glass: each flavour in the
   * cooler (or in this order) with its picture and its price in marker, like the cooler's board.
   */
  private drawMenuCard(): void {
    const sale = this.evening.sale;
    if (!sale) return;
    const rows = this.evening.slots.filter((s) => s.quantity > 0 || sale.order.some((l) => l.flavour === s.flavour));
    const rowH = 26;
    const h = 34 + rows.length * rowH + 6;
    const { w } = MENU_CARD;
    this.priceCard.removeAll(true);
    const paper = this.add.graphics();
    paper.fillStyle(0xfffdf0, 1).fillRect(0, 0, w, h);
    paper.lineStyle(3, 0x7f7f7f, 1).strokeRect(0, 0, w, h);
    // Two strips of tape holding it to the glass.
    paper.fillStyle(0xf2e6b8, 0.85).fillRect(-8, -6, 40, 14).fillRect(w - 32, -6, 40, 14);
    const parts: Phaser.GameObjects.GameObject[] = [paper];
    parts.push(this.add.text(w / 2, 16, "Today's Menu", { fontFamily: MARKER_FONT, fontSize: '17px', color: INK }).setOrigin(0.5));
    rows.forEach((slot, i) => {
      const y = 34 + i * rowH + rowH / 2;
      parts.push(addFlavourIcon(this, 18, y, slot.flavour, 0.66));
      parts.push(
        this.add
          .text(36, y, getFlavour(slot.flavour).name, { fontFamily: 'monospace', fontSize: '12px', color: INK })
          .setOrigin(0, 0.5),
      );
      parts.push(
        this.add
          .text(w - 10, y, formatMoney(slot.priceCents).replace(/\.00$/, ''), { fontFamily: MARKER_FONT, fontSize: '18px', color: '#141418' })
          .setOrigin(1, 0.5),
      );
    });
    this.priceCard.add(parts);
  }

  /**
   * SCREAM-137 (PO, November 2): some customers say the ice creams' names, others show their
   * pictures ("2 ×" and the ice cream), at random. Any words before the order go above the pictures.
   */
  private showLine(sale: NonNullable<EveningState['sale']>): void {
    const pictures = sale.pictureLine;
    if (!pictures) {
      this.bubbleText.setText(sale.line);
      // SCREAM-103 (PO, November 8): a long hint makes the bubble taller (downwards), not the text smaller.
      const h = sale.hintAbout ? Math.max(BUBBLE_H, Math.ceil(this.bubbleText.height) + BUBBLE_NAME_SPACE + 2 * BUBBLE_PAD) : BUBBLE_H;
      this.sizeBubble(h);
      this.bubbleText.setY(sale.hintAbout ? BUBBLE_Y + BUBBLE_NAME_SPACE + (h - BUBBLE_NAME_SPACE) / 2 : 212);
      this.setOrderPictures('', []);
      return;
    }
    this.bubbleText.setText(pictures.prefix).setY(pictures.prefix ? 184 : 212);
    const key = `${pictures.prefix ? 'low' : 'mid'}|${pictures.order.map((l) => `${l.count}${l.flavour}`).join(',')}`;
    this.setOrderPictures(key, pictures.order, pictures.prefix ? 236 : 212);
  }

  /** Draws the speech bubble at this height (its top and tail stay put). */
  private sizeBubble(h: number): void {
    if (h === this.bubbleH) return;
    this.bubbleH = h;
    drawBubble(this.bubble.clear(), {
      x: 90, y: BUBBLE_Y, w: 480, h, unit: 4, innerLine: true,
      tail: { side: 'right', at: 96, steps: 7, reach: 3 },
    });
  }

  private setOrderPictures(key: string, order: readonly { flavour: Parameters<typeof addFlavourIcon>[3]; count: number }[], y = 212): void {
    if (key === this.orderPicturesKey) return;
    this.orderPicturesKey = key;
    this.orderPictures.removeAll(true).setY(y);
    const itemW = 96;
    let x = -((order.length - 1) * itemW) / 2;
    for (const line of order) {
      this.orderPictures.add(
        this.add.text(x - 14, 0, `${line.count} ×`, { fontFamily: 'monospace', fontSize: '22px', fontStyle: 'bold', color: INK }).setOrigin(1, 0.5),
      );
      this.orderPictures.add(addFlavourIcon(this, x + 14, 0, line.flavour, 1.4).setName(`order-pic-${line.flavour}`));
      x += itemW;
    }
  }

  private refresh(): void {
    const sale = this.evening.sale;
    if (!sale) return;
    this.showLine(sale);

    const pricing = sale.phase === 'pricing';
    if (pricing) this.drawMenuCard();
    this.priceCard.setVisible(pricing);
    this.calculator.show(this.typed);
    this.calculator.setVisible(pricing);

    const freebie = sale.outcome?.kind === 'overcharged' || sale.outcome?.kind === 'wrong-order';
    this.roadButton.setVisible(sale.phase === 'over');
    this.coolerButton.setVisible(sale.phase === 'ordering' || sale.phase === 'deciding');

    let hint = '';
    if (sale.phase === 'ordering') hint = 'Remember the order!    C Or Enter: Go To The Cooler Now    B: Drive Off';
    if (sale.phase === 'deciding') {
      const canAsk = !sale.askedAgain && !sale.retryUsed;
      hint = `C Or Enter: Go To The Cooler    ${canAsk ? 'R: Ask Again (No Tip)    ' : ''}B: Drive Off`;
    }
    if (pricing) {
      hint = 'Type the price (7.25) or click the keys.    Enter: Charge    Backspace: Undo    B: Drive Off';
    }
    if (sale.phase === 'over') hint = freebie ? "Enter: Say Sorry, It's On The House" : 'Enter: Back On The Road';
    this.hint.setText(hint);
    this.redrawPointer?.();
  }
}
