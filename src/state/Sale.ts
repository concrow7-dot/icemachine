import { getFlavour, type FlavourId } from '../config/flavours';
import {
  ORDER_SHOW_SECONDS,
  ORDER_SIZE_WEIGHTS,
  REFUSE_ABOVE_CENTS,
  TIP_PERCENT_STEPS,
  TIP_STEP_SECONDS,
  WINDOW_PATIENCE_SECONDS,
  ASK_AGAIN_LIMIT,
} from '../config/tuning';
import type { CoolerSlot } from './EveningState';

// Issues #13-#15: one sale at the window, from the order to the payment.
// The rules come from *12 - Tickets #12-#15 Selling Discussion*. This file has
// no Phaser in it, so the rules can be tested on their own.

/** One flavour in an order: which cooler slot it comes from, and how many. */
export type OrderLine = { slot: number; flavour: FlavourId; count: number };

/**
 * Where the sale is:
 * - `ordering`: the order is in the speech bubble (5 s)
 * - `deciding`: order hidden; go to the cooler, ask again, or drive off
 * - `pricing`: items handed over; the customer asks "How much?"
 * - `over`: finished one way or another (see `outcome`)
 */
export type SalePhase = 'ordering' | 'deciding' | 'pricing' | 'over';

/** How a sale ended. */
export type SaleOutcome =
  | { kind: 'paid'; priceCents: number; tipCents: number; tipPercent: number }
  | { kind: 'overcharged' } // price too high: they leave with the ice cream for free
  | { kind: 'wrong-order' } // wrong items with no retry left: they leave with them for free
  | { kind: 'timed-out' } // waited the full minute: "Sorry, I have to go"
  | { kind: 'too-expensive' } // every flavour priced over what they'd pay ($4.00; Story: SCREAM-271): no order
  | { kind: 'sold-out' } // SCREAM-218: nothing left in the cooler; the player says sorry
  | { kind: 'drove-off' }; // the player left without serving: a lost sale

/** Picks an order size from 1 to 6 using the PO's weights. `roll` is a random number from 0 to 1. */
export function pickOrderSize(roll: number): number {
  const total = ORDER_SIZE_WEIGHTS.reduce((a, b) => a + b, 0);
  let target = roll * total;
  for (let i = 0; i < ORDER_SIZE_WEIGHTS.length; i++) {
    target -= ORDER_SIZE_WEIGHTS[i] ?? 0;
    if (target < 0) return i + 1;
  }
  return ORDER_SIZE_WEIGHTS.length;
}

/**
 * Builds a customer's order from what's in the cooler. Customers only order
 * flavours the truck has, never more than is left, and leave out anything
 * priced over $4.00 (PO, doc 12 Q10 and Q11). Returns an empty order when
 * every flavour in stock is too expensive.
 */
export function generateOrder(
  slots: readonly Readonly<CoolerSlot>[],
  random: () => number = Math.random,
  /** SCREAM-189: this customer always orders this many (the sheet's "Order size"). */
  fixedSize?: number,
  /** SCREAM-271: the most they pay for one of a flavour (Story has its own per ice cream). */
  refuseAbove: (flavour: FlavourId) => number = () => REFUSE_ABOVE_CENTS,
): OrderLine[] {
  const left = slots.map((s) => (s.priceCents <= refuseAbove(s.flavour) ? s.quantity : 0));
  const available = left.reduce((a, b) => a + b, 0);
  if (available === 0) return [];

  const size = Math.min(fixedSize ?? pickOrderSize(random()), available);
  const counts = slots.map(() => 0);
  for (let n = 0; n < size; n++) {
    const choices = left.map((q, i) => (q > counts[i]! ? i : -1)).filter((i) => i >= 0);
    const slot = choices[Math.floor(random() * choices.length)] ?? choices[0] ?? 0;
    counts[slot] = (counts[slot] ?? 0) + 1;
  }
  return counts.flatMap((count, slot) => {
    const flavour = slots[slot]?.flavour;
    return count > 0 && flavour ? [{ slot, flavour, count }] : [];
  });
}

/** "2 Chocolate Eclair, 1 SpongePop" */
export function describeOrder(order: readonly OrderLine[]): string {
  return order.map((line) => `${line.count} ${getFlavour(line.flavour).name}`).join(', ');
}

/** The real total for an order at the player's own prices. */
export function orderTotalCents(order: readonly OrderLine[], slots: readonly Readonly<CoolerSlot>[]): number {
  return order.reduce((sum, line) => sum + line.count * (slots[line.slot]?.priceCents ?? 0), 0);
}

/** Tip percentage after this many seconds of the countdown: 20, 15, 10, 5, then 0 (PO, doc 12 Q29). */
export function tipPercentAt(seconds: number, steps: readonly number[] = TIP_PERCENT_STEPS): number {
  if (seconds >= tipCountdownSeconds(steps)) return 0;
  const step = Math.floor(Math.max(0, seconds) / TIP_STEP_SECONDS);
  return steps[step] ?? 0;
}

/** SCREAM-303: how long the tip countdown runs for these steps (10 seconds each: 40, or 50 with the power-up). */
export function tipCountdownSeconds(steps: readonly number[] = TIP_PERCENT_STEPS): number {
  return steps.length * TIP_STEP_SECONDS;
}

/**
 * One sale. Times are milliseconds on the evening's running clock (`nowMs`),
 * passed in by EveningState, so the sale keeps time on every screen.
 */
export class Sale {
  phase: SalePhase = 'ordering';
  /** SCREAM-303: the tip on offer for each 10-second step (the Service With A Smile power-up has one more, at 25%). */
  tipSteps: readonly number[] = TIP_PERCENT_STEPS;
  outcome: SaleOutcome | null = null;
  /** Ice creams picked at the cooler, per slot, not yet handed over. */
  readonly bag: number[];
  /** True once the player has asked for the order again (R, or FORGOT ORDER): no tip, no retry (PO, Q9 and Q28). */
  askedAgain = false;
  /** SCREAM-288: how many times the order has been asked for again. */
  timesAsked = 0;
  /** True once a wrong order has been corrected (one retry only, Q27). */
  retryUsed = false;
  /** SCREAM-120: the player overcharged once and is trying the price again (no tip after that). */
  repriceUsed = false;
  /** The customer's current line in the speech bubble. */
  line = '';
  /**
   * SCREAM-218 (PO, November 9): who is talking in the speech bubble. Usually the customer;
   * when the truck is sold out, the player says "Sorry, I'm sold out."
   */
  speaker: 'customer' | 'player' = 'customer';
  /**
   * SCREAM-137 (PO, November 2): true if this customer shows the ice creams' pictures instead
   * of saying their names (decided at random when the sale starts). Repeats (R) and "I wanted..."
   * after a mistake follow the same choice.
   */
  readonly pictures: boolean;
  /** While the current line shows the order: any words before it ('' for the order alone); otherwise null. */
  private orderPrefix: string | null = null;

  /** SCREAM-285: the order is being repeated at "How much?"; when it hides, the price is asked again. */
  private backToPricing = false;

  private startedMs: number;
  private orderHiddenMs: number | null = null;
  private showUntilMs: number;

  readonly order: OrderLine[];

  constructor(order: OrderLine[], slotCount: number, nowMs: number, pictures = false, soldOut = false) {
    this.order = order;
    this.pictures = pictures;
    this.bag = Array.from({ length: slotCount }, () => 0);
    this.startedMs = nowMs;
    this.showUntilMs = nowMs + ORDER_SHOW_SECONDS * 1000;
    if (soldOut) {
      // SCREAM-218: sold out is checked before any price, and isn't an overcharge (no second chance used, 026).
      this.speaker = 'player';
      this.finish({ kind: 'sold-out' }, "Sorry, I'm sold out.");
    } else if (order.length === 0) {
      this.finish({ kind: 'too-expensive' }, 'Too expensive!');
    } else {
      this.line = describeOrder(order);
      this.orderPrefix = '';
    }
  }

  /**
   * PO (November 6): in the guided tutorial the sale waits while the uncle explains it: the
   * order stays up and the customer's wait doesn't count down. Pushes both timers on by `ms`.
   */
  wait(ms: number): void {
    if (this.phase === 'over') return;
    this.startedMs += ms;
    if (this.phase === 'ordering') this.showUntilMs += ms;
    // SCREAM-172: after the order is hidden, the tip's countdown waits too.
    if (this.orderHiddenMs !== null) this.orderHiddenMs += ms;
  }

  /** Called every frame. Hides the order after 5 seconds and ends the sale after the 1-minute wait. */
  update(nowMs: number): void {
    if (this.phase === 'over') return;
    if (this.phase === 'ordering' && nowMs >= this.showUntilMs) this.hideOrder(nowMs);
    if (this.patienceLeftSeconds(nowMs) <= 0) this.finish({ kind: 'timed-out' }, 'Sorry, I have to go.');
  }

  /**
   * PO, PR #38: the player can head to the cooler while the order is still
   * showing, without waiting out the 5 seconds. Hides the order now.
   */
  skipToCooler(nowMs: number): boolean {
    this.backToPricing = false; // SCREAM-285: going to the cooler instead of hearing "How much?" again
    if (this.phase === 'ordering') this.hideOrder(nowMs);
    return this.phase === 'deciding';
  }

  private hideOrder(nowMs: number): void {
    if (this.backToPricing) {
      // SCREAM-285: the order was asked for again at "How much?": back to the price.
      this.backToPricing = false;
      this.phase = 'pricing';
      this.say('How much?');
      return;
    }
    this.phase = 'deciding';
    this.say('…');
    // The tip countdown starts the first time the order is hidden (Q23).
    if (this.orderHiddenMs === null) this.orderHiddenMs = nowMs;
  }

  /** Seconds left of the customer's 1-minute wait, which starts when the conversation starts. */
  patienceLeftSeconds(nowMs: number): number {
    return Math.max(0, WINDOW_PATIENCE_SECONDS - (nowMs - this.startedMs) / 1000);
  }

  /** Seconds since the order was first hidden (the tip countdown), or null before then. */
  countdownSeconds(nowMs: number): number | null {
    return this.orderHiddenMs === null ? null : (nowMs - this.orderHiddenMs) / 1000;
  }

  /** The tip on offer right now, in percent. Zero after asking again or a mistake. */
  tipPercent(nowMs: number): number {
    const seconds = this.countdownSeconds(nowMs);
    if (seconds === null || this.askedAgain || this.retryUsed || this.repriceUsed) return 0;
    return tipPercentAt(seconds, this.tipSteps);
  }

  /** True while the order is showing in the bubble. */
  get orderVisible(): boolean {
    return this.phase === 'ordering';
  }

  /**
   * R at the window, FORGOT ORDER at the cooler: the customer repeats the order. The first time
   * cancels the tip and uses up the retry (Q9, Q28). SCREAM-282: it can be asked again after
   * that, and after a corrected mistake; SCREAM-288: twice in all.
   */
  askAgain(nowMs: number): boolean {
    // SCREAM-285 (PO, November 12): also after the bag is served, at "How much?". The customer
    // says the order, then asks the price again (unless the player heads for the cooler).
    if (!this.canAskAgain) return false;
    this.backToPricing = this.phase === 'pricing';
    this.askedAgain = true;
    this.timesAsked++;
    this.showOrder(nowMs, describeOrder(this.order), '');
    return true;
  }

  /**
   * SCREAM-288 (PO, November 12): each customer can be asked at most twice (`ASK_AGAIN_LIMIT`),
   * counting the window (ASK AGAIN, R) and the cooler (FORGOT ORDER, B) together.
   */
  get canAskAgain(): boolean {
    return (this.phase === 'deciding' || this.phase === 'pricing') && this.timesAsked < ASK_AGAIN_LIMIT;
  }

  /** How many times this customer can still be asked for the order again. */
  get asksLeft(): number {
    return Math.max(0, ASK_AGAIN_LIMIT - this.timesAsked);
  }

  /** The player comes back from the cooler and hands the items over: the customer asks the price. */
  handOver(): boolean {
    if (this.phase !== 'deciding' || this.bagCount === 0) return false;
    this.phase = 'pricing';
    this.say('How much?');
    return true;
  }

  /**
   * SCREAM-283 (PO, November 12): RETURN TO COOLER at "How much?". The player takes the bag
   * back to the cooler to change it; the sale and its clocks carry on.
   */
  backToCooler(): boolean {
    if (this.phase !== 'pricing') return false;
    this.phase = 'deciding';
    this.say('…');
    return true;
  }

  get bagCount(): number {
    return this.bag.reduce((a, b) => a + b, 0);
  }

  /** True when the bag holds exactly what was ordered. */
  get bagMatchesOrder(): boolean {
    return this.bag.every((count, slot) => count === (this.order.find((l) => l.slot === slot)?.count ?? 0));
  }

  /**
   * The player types a price and presses Enter. Returns what happened:
   * - `retry`: wrong items, first time: the customer says the right order again,
   *   the items go back in the cooler, and the player tries again (Q27)
   * - `reprice`: too high, first time (SCREAM-120): the customer says so and the
   *   player types the price again, with no tip
   * - otherwise the sale is over (see `outcome`)
   */
  charge(priceCents: number, realTotalCents: number, nowMs: number): 'retry' | 'reprice' | 'over' {
    if (this.phase !== 'pricing') return 'over';

    if (!this.bagMatchesOrder) {
      if (!this.askedAgain && !this.retryUsed) {
        this.retryUsed = true;
        this.showOrder(nowMs, `That's not what I asked for. I wanted ${describeOrder(this.order)}.`, "That's not what I asked for. I wanted:");
        return 'retry';
      }
      this.finish({ kind: 'wrong-order' }, "That's not what I asked for.");
      return 'over';
    }

    if (priceCents > realTotalCents) {
      // SCREAM-120 (PO, November 2): a second chance to fix the price, but no tip.
      if (!this.repriceUsed) {
        this.repriceUsed = true;
        this.say("That's more than it's supposed to be. Try again?");
        return 'reprice';
      }
      this.finish({ kind: 'overcharged' }, "That's more than it's supposed to be.");
      return 'over';
    }

    // An undercharge is simply accepted (Q18); the tip is a share of what was charged (Q29).
    const tipPercent = this.tipPercent(nowMs);
    const tipCents = Math.round(((priceCents * tipPercent) / 100) * this.tipFactor);
    this.finish({ kind: 'paid', priceCents, tipCents, tipPercent }, 'Thanks!');
    return 'over';
  }

  /** B on the sales screen: drive off without serving. A lost sale (Q4). */
  driveOff(): void {
    if (this.phase === 'over') return;
    this.finish({ kind: 'drove-off' }, '');
  }

  /** True when the customer keeps whatever was handed over (a failed sale, Q13 and Q26). */
  get itemsGivenAway(): boolean {
    return this.outcome?.kind === 'overcharged' || this.outcome?.kind === 'wrong-order';
  }

  /**
   * SCREAM-137: when this customer shows pictures and the current line is the order, the
   * words to show before the pictures, and the order to draw; otherwise null.
   */
  get pictureLine(): { prefix: string; order: readonly OrderLine[] } | null {
    return this.pictures && this.orderPrefix !== null ? { prefix: this.orderPrefix, order: this.order } : null;
  }

  /** SCREAM-103: the resident this customer pointed the player to, or null. */
  hintAbout: string | null = null;

  /**
   * SCREAM-103 (PO, November 8): after a tipped sale the customer sometimes passes on a hint
   * about a big regular, after their thanks.
   */
  addHint(residentId: string, hint: string): void {
    if (this.outcome?.kind !== 'paid') return;
    this.hintAbout = residentId;
    this.say(`${this.line} ${hint}`);
  }

  /** SCREAM-247: this customer said something about their own week. */
  saidSchedule = false;

  /**
   * SCREAM-247 (PO, November 10): after a paid sale the customer sometimes mentions their own
   * schedule ("See you Thursday!"), after their thanks.
   */
  addScheduleLine(text: string): void {
    if (this.outcome?.kind !== 'paid') return;
    this.saidSchedule = true;
    this.say(`${this.line} ${text}`);
  }

  /** SCREAM-250: the tip is multiplied by this (4 for a hard-to-find customer). */
  tipFactor = 1;

  /** SCREAM-248: the neighbour this customer told the player about (resident id), or null. */
  neighbourAbout: string | null = null;

  /**
   * SCREAM-248 (PO, November 10): after a paid sale the customer sometimes says when a neighbour
   * is home, after their thanks.
   */
  addNeighbourLine(residentId: string, text: string): void {
    if (this.outcome?.kind !== 'paid') return;
    this.neighbourAbout = residentId;
    this.say(`${this.line} ${text}`);
  }

  /** SCREAM-145: this customer told the player the trick at the roundabout. */
  toldAboutRotary = false;

  /**
   * SCREAM-145 (PO, November 9): a regular's second visit can come with the way to the other
   * neighbourhood, after their thanks (the second regular to be served a second time in the run).
   */
  addRotaryHint(text: string): void {
    if (this.outcome?.kind !== 'paid') return;
    this.toldAboutRotary = true;
    this.say(`${this.line} ${text}`);
  }

  /** A line that isn't the order. */
  private say(line: string): void {
    this.line = line;
    this.orderPrefix = null;
  }

  private showOrder(nowMs: number, line: string, prefix: string): void {
    this.phase = 'ordering';
    this.line = line;
    this.orderPrefix = prefix;
    this.showUntilMs = nowMs + ORDER_SHOW_SECONDS * 1000;
  }

  private finish(outcome: SaleOutcome, line: string): void {
    this.phase = 'over';
    this.outcome = outcome;
    this.say(line);
  }
}
