import { getFlavour, type FlavourId } from '../config/flavours';
import {
  ORDER_SHOW_SECONDS,
  ORDER_SIZE_WEIGHTS,
  REFUSE_ABOVE_CENTS,
  TIP_COUNTDOWN_SECONDS,
  TIP_PERCENT_STEPS,
  TIP_STEP_SECONDS,
  WINDOW_PATIENCE_SECONDS,
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
  | { kind: 'too-expensive' } // every flavour over $4.00: no order
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
export function generateOrder(slots: readonly Readonly<CoolerSlot>[], random: () => number = Math.random): OrderLine[] {
  const left = slots.map((s) => (s.priceCents <= REFUSE_ABOVE_CENTS ? s.quantity : 0));
  const available = left.reduce((a, b) => a + b, 0);
  if (available === 0) return [];

  const size = Math.min(pickOrderSize(random()), available);
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
export function tipPercentAt(seconds: number): number {
  if (seconds >= TIP_COUNTDOWN_SECONDS) return 0;
  const step = Math.floor(Math.max(0, seconds) / TIP_STEP_SECONDS);
  return TIP_PERCENT_STEPS[step] ?? 0;
}

/**
 * One sale. Times are milliseconds on the evening's running clock (`nowMs`),
 * passed in by EveningState, so the sale keeps time on every screen.
 */
export class Sale {
  phase: SalePhase = 'ordering';
  outcome: SaleOutcome | null = null;
  /** Ice creams picked at the cooler, per slot, not yet handed over. */
  readonly bag: number[];
  /** True once the player has pressed R (ask again): no tip, no retry (PO, Q9 and Q28). */
  askedAgain = false;
  /** True once a wrong order has been corrected (one retry only, Q27). */
  retryUsed = false;
  /** The customer's current line in the speech bubble. */
  line = '';

  private readonly startedMs: number;
  private orderHiddenMs: number | null = null;
  private showUntilMs: number;

  readonly order: OrderLine[];

  constructor(order: OrderLine[], slotCount: number, nowMs: number) {
    this.order = order;
    this.bag = Array.from({ length: slotCount }, () => 0);
    this.startedMs = nowMs;
    this.showUntilMs = nowMs + ORDER_SHOW_SECONDS * 1000;
    if (order.length === 0) {
      this.finish({ kind: 'too-expensive' }, 'Too expensive!');
    } else {
      this.line = describeOrder(order);
    }
  }

  /** Called every frame. Hides the order after 5 seconds and ends the sale after the 1-minute wait. */
  update(nowMs: number): void {
    if (this.phase === 'over') return;
    if (this.phase === 'ordering' && nowMs >= this.showUntilMs) {
      this.phase = 'deciding';
      this.line = '…';
      // The tip countdown starts the first time the order is hidden (Q23).
      if (this.orderHiddenMs === null) this.orderHiddenMs = nowMs;
    }
    if (this.patienceLeftSeconds(nowMs) <= 0) this.finish({ kind: 'timed-out' }, 'Sorry, I have to go.');
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
    if (seconds === null || this.askedAgain || this.retryUsed) return 0;
    return tipPercentAt(seconds);
  }

  /** True while the order is showing in the bubble. */
  get orderVisible(): boolean {
    return this.phase === 'ordering';
  }

  /** R: the customer repeats the order. Once only, cancels the tip, and uses up the retry (Q9, Q28). */
  askAgain(nowMs: number): boolean {
    if (this.phase !== 'deciding' || this.askedAgain || this.retryUsed) return false;
    this.askedAgain = true;
    this.showOrder(nowMs, describeOrder(this.order));
    return true;
  }

  /** The player comes back from the cooler and hands the items over: the customer asks the price. */
  handOver(): boolean {
    if (this.phase !== 'deciding' || this.bagCount === 0) return false;
    this.phase = 'pricing';
    this.line = 'How much?';
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
   * - otherwise the sale is over (see `outcome`)
   */
  charge(priceCents: number, realTotalCents: number, nowMs: number): 'retry' | 'over' {
    if (this.phase !== 'pricing') return 'over';

    if (!this.bagMatchesOrder) {
      if (!this.askedAgain && !this.retryUsed) {
        this.retryUsed = true;
        this.showOrder(nowMs, `That's not what I asked for. I wanted ${describeOrder(this.order)}.`);
        return 'retry';
      }
      this.finish({ kind: 'wrong-order' }, "That's not what I asked for.");
      return 'over';
    }

    if (priceCents > realTotalCents) {
      this.finish({ kind: 'overcharged' }, "That's more than it's supposed to be.");
      return 'over';
    }

    // An undercharge is simply accepted (Q18); the tip is a share of what was charged (Q29).
    const tipPercent = this.tipPercent(nowMs);
    const tipCents = Math.round((priceCents * tipPercent) / 100);
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

  private showOrder(nowMs: number, line: string): void {
    this.phase = 'ordering';
    this.line = line;
    this.showUntilMs = nowMs + ORDER_SHOW_SECONDS * 1000;
  }

  private finish(outcome: SaleOutcome, line: string): void {
    this.phase = 'over';
    this.outcome = outcome;
    this.line = line;
  }
}
