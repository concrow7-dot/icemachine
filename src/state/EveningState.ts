import * as Phaser from 'phaser';
import { defaultPriceCents, FLAVOURS, getFlavour, type FlavourId } from '../config/flavours';
import {
  COOLER_SLOTS,
  EVENING_END_HOUR,
  EVENING_LENGTH_SECONDS,
  EVENING_START_HOUR,
  MAX_PRICE_CENTS,
  MIN_PRICE_CENTS,
  SLOT_CAPACITY,
  STARTING_CASH_CENTS,
} from '../config/tuning';

/** Events the evening sends out. Scenes listen for these instead of checking every frame. */
export const EveningEvents = {
  /** (changeCents: number, cashCents: number, label: string, popup: boolean) */
  MoneyChanged: 'money-changed',
  /** () — the clock reached 8pm */
  Ended: 'ended',
  /** (waiting: boolean) — a customer arrived at, or left, the window */
  CustomerChanged: 'customer-changed',
  /** () — a cooler slot's flavour, quantity or price changed */
  CoolerChanged: 'cooler-changed',
} as const;

/** One of the cooler's flavour slots (issue #8). */
export type CoolerSlot = {
  flavour: FlavourId;
  quantity: number;
  priceCents: number;
};

/**
 * Everything about the current evening: the clock, the cash and the cooler.
 * A brand-new EveningState is created for every evening, so starting
 * again always resets everything (issue #4).
 *
 * Money is stored in whole cents to avoid rounding errors.
 */
export class EveningState extends Phaser.Events.EventEmitter {
  private elapsedMs = 0;
  private ended = false;
  private readonly startCashCents = STARTING_CASH_CENTS;
  private cashCents = STARTING_CASH_CENTS;
  private customerAtWindow = false;
  private prepLocked = false;
  private readonly lengthMs = EVENING_LENGTH_SECONDS * 1000;

  /** The cooler starts with the first three flavours selected and empty. */
  private readonly coolerSlots: CoolerSlot[] = FLAVOURS.slice(0, COOLER_SLOTS).map((f) => ({
    flavour: f.id,
    quantity: 0,
    priceCents: defaultPriceCents(f.id),
  }));

  // ---- Clock (#5) ----

  /** How far through the evening we are, from 0 (5pm) to 1 (8pm). */
  get progress(): number {
    return Math.min(this.elapsedMs / this.lengthMs, 1);
  }

  /** Current in-game time as minutes since midnight (5pm = 1020). */
  get clockMinutes(): number {
    const startMinutes = EVENING_START_HOUR * 60;
    const spanMinutes = (EVENING_END_HOUR - EVENING_START_HOUR) * 60;
    return startMinutes + this.progress * spanMinutes;
  }

  get isOver(): boolean {
    return this.ended;
  }

  /** Advances the clock. Called every frame by the HUD, whatever phase the player is in. */
  tick(deltaMs: number): void {
    if (this.ended) return;
    this.elapsedMs += deltaMs;
    if (this.elapsedMs >= this.lengthMs) {
      this.elapsedMs = this.lengthMs;
      this.ended = true;
      this.emit(EveningEvents.Ended);
    }
  }

  /** Ends the evening immediately (used by the debug shortcut). */
  endNow(): void {
    if (this.ended) return;
    this.elapsedMs = this.lengthMs;
    this.ended = true;
    this.emit(EveningEvents.Ended);
  }

  // ---- Wallet (#21) ----

  /** Cash on hand right now. */
  get moneyCents(): number {
    return this.cashCents;
  }

  /** Tonight's profit so far: cash now minus cash at the start. This is the high score. */
  get profitCents(): number {
    return this.cashCents - this.startCashCents;
  }

  /**
   * Adds (or, with a negative amount, removes) cash. Sales and damage may take
   * the total below zero; buying stock never does (see changeSlotQuantity).
   * `popup` controls whether the HUD shows a "+$x Label" popup.
   */
  changeMoney(cents: number, label: string, popup = true): void {
    if (this.ended) return;
    this.cashCents += cents;
    this.emit(EveningEvents.MoneyChanged, cents, this.cashCents, label, popup);
  }

  // ---- Customers (#7, set for real by #12) ----

  /** True while a customer is waiting at the window (issue #7: window only usable during a sale). */
  get customerWaiting(): boolean {
    return this.customerAtWindow;
  }

  setCustomerWaiting(waiting: boolean): void {
    if (this.customerAtWindow === waiting) return;
    this.customerAtWindow = waiting;
    this.emit(EveningEvents.CustomerChanged, waiting);
  }

  // ---- Cooler prep (#8) and selling prices (#23) ----

  get slots(): readonly Readonly<CoolerSlot>[] {
    return this.coolerSlots;
  }

  /** Prep is locked once the player first heads for the driver's seat. */
  get isPrepLocked(): boolean {
    return this.prepLocked;
  }

  lockPrep(): void {
    this.prepLocked = true;
  }

  /** Total spent on the stock currently in the cooler. */
  get stockCostCents(): number {
    return this.coolerSlots.reduce((sum, s) => sum + s.quantity * getFlavour(s.flavour).costCents, 0);
  }

  /**
   * Switches a slot to the next (or previous) flavour not used by another slot.
   * Any stock already bought for that slot is refunded in full.
   */
  cycleSlotFlavour(index: number, direction: -1 | 1): boolean {
    const slot = this.coolerSlots.at(index);
    if (!slot || this.prepLocked || this.ended) return false;

    const taken = new Set(this.coolerSlots.filter((s) => s !== slot).map((s) => s.flavour));
    const ids = FLAVOURS.map((f) => f.id);
    let i = ids.indexOf(slot.flavour);
    for (let step = 0; step < ids.length; step++) {
      i = (i + direction + ids.length) % ids.length;
      const candidate = ids.at(i);
      if (candidate && !taken.has(candidate)) {
        if (candidate === slot.flavour) return false;
        if (slot.quantity > 0) {
          this.changeMoney(slot.quantity * getFlavour(slot.flavour).costCents, 'Refund', false);
        }
        slot.flavour = candidate;
        slot.quantity = 0;
        slot.priceCents = defaultPriceCents(candidate);
        this.emit(EveningEvents.CoolerChanged);
        return true;
      }
    }
    return false;
  }

  /** Buys (positive) or returns (negative) bars for a slot. Can't overspend or overfill. */
  changeSlotQuantity(index: number, delta: number): boolean {
    const slot = this.coolerSlots.at(index);
    if (!slot || this.prepLocked || this.ended || delta === 0) return false;

    const next = slot.quantity + delta;
    if (next < 0 || next > SLOT_CAPACITY) return false;

    const cost = delta * getFlavour(slot.flavour).costCents;
    if (cost > this.cashCents) return false;

    slot.quantity = next;
    this.changeMoney(-cost, delta > 0 ? 'Stock' : 'Refund', false);
    this.emit(EveningEvents.CoolerChanged);
    return true;
  }

  /** Raises or lowers a slot's selling price, within the allowed range. */
  changeSlotPrice(index: number, deltaCents: number): boolean {
    const slot = this.coolerSlots.at(index);
    if (!slot || this.prepLocked || this.ended) return false;

    const next = slot.priceCents + deltaCents;
    if (next < MIN_PRICE_CENTS || next > MAX_PRICE_CENTS) return false;

    slot.priceCents = next;
    this.emit(EveningEvents.CoolerChanged);
    return true;
  }
}
