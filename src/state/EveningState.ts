import * as Phaser from 'phaser';
import { defaultPriceCents, FLAVOURS, getFlavour, type FlavourId } from '../config/flavours';
import type { CoolerOrder } from './CoolerOrder';
import { CURB_SPOTS, HOME_START, TILE_SIZE } from '../config/neighbourhood';
import {
  COOLER_SLOTS,
  CUSTOMER_PATIENCE_SECONDS,
  EVENING_END_HOUR,
  EVENING_LENGTH_SECONDS,
  EVENING_START_HOUR,
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
  /** () — the customer waiting at the curb appeared, moved, gave up or was picked up (#12) */
  RoadCustomerChanged: 'road-customer-changed',
} as const;

/** Which way the truck is pointing (issue #9: four-direction driving). */
export type Facing = 'up' | 'down' | 'left' | 'right';

/** Where the truck is parked in the neighbourhood, in pixels. */
export type TruckPosition = { x: number; y: number; facing: Facing };

/** The one customer waiting at the curb (#12): which CURB_SPOTS entry, and when they arrived. */
export type RoadCustomer = { spot: number; sinceMs: number };

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
  private roadCustomerNow: RoadCustomer | null = null;

  /** The truck starts each evening on the road outside home (#9). */
  private truckPosition: TruckPosition = {
    x: HOME_START.col * TILE_SIZE,
    y: HOME_START.row * TILE_SIZE,
    facing: 'right',
  };

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
    this.checkCustomerPatience();
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
   * the total below zero; buying stock never does (see CoolerOrder).
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

  /** Sets whether a customer is at the window. When they leave, the next one appears at the curb (#12). */
  setCustomerWaiting(waiting: boolean): void {
    if (this.customerAtWindow === waiting) return;
    this.customerAtWindow = waiting;
    this.emit(EveningEvents.CustomerChanged, waiting);
    if (!waiting) this.spawnRoadCustomer();
  }

  /** The customer waiting at the curb, or null if there isn't one (#12: one at a time). */
  get roadCustomer(): Readonly<RoadCustomer> | null {
    return this.roadCustomerNow;
  }

  /** Seconds the curb customer will still wait before giving up. */
  get roadCustomerSecondsLeft(): number {
    if (!this.roadCustomerNow) return 0;
    return Math.max(0, CUSTOMER_PATIENCE_SECONDS - (this.elapsedMs - this.roadCustomerNow.sinceMs) / 1000);
  }

  /** Total ice creams left in the cooler. */
  get stockLeft(): number {
    return this.coolerSlots.reduce((sum, s) => sum + s.quantity, 0);
  }

  /** On the road with nothing left to sell: no customers come, and the HUD says so (#12). */
  get isSoldOut(): boolean {
    return this.prepLocked && this.stockLeft === 0;
  }

  /**
   * The truck drove into the curb customer (PO decision on #9): they step up
   * to the window. The next one appears once this sale is over.
   */
  meetCustomer(): void {
    if (!this.roadCustomerNow) return;
    this.roadCustomerNow = null;
    this.emit(EveningEvents.RoadCustomerChanged);
    this.setCustomerWaiting(true);
  }

  /**
   * Puts the next customer at a random curb spot, different from the last one.
   * Only while on the road, with stock to sell, before 8 PM and with nobody at the window.
   */
  private spawnRoadCustomer(): void {
    const previous = this.roadCustomerNow?.spot;
    this.roadCustomerNow = null;
    if (!this.ended && !this.isSoldOut && this.prepLocked && !this.customerAtWindow) {
      const choices = CURB_SPOTS.map((_, i) => i).filter((i) => i !== previous);
      const spot = choices[Math.floor(Math.random() * choices.length)] ?? 0;
      this.roadCustomerNow = { spot, sinceMs: this.elapsedMs };
    }
    this.emit(EveningEvents.RoadCustomerChanged);
  }

  /** A customer who has waited too long gives up, and the next one appears elsewhere (#12). */
  private checkCustomerPatience(): void {
    if (this.roadCustomerNow && this.roadCustomerSecondsLeft <= 0) this.spawnRoadCustomer();
  }

  // ---- Driving (#9) ----

  get truck(): Readonly<TruckPosition> {
    return this.truckPosition;
  }

  /** Remembers where the truck stopped, so driving resumes from the same place. */
  parkTruck(position: TruckPosition): void {
    this.truckPosition = { ...position };
  }

  // ---- Cooler prep (#8) and selling prices (#23) ----

  get slots(): readonly Readonly<CoolerSlot>[] {
    return this.coolerSlots;
  }

  /** Prep is locked once the player first heads for the driver's seat. */
  get isPrepLocked(): boolean {
    return this.prepLocked;
  }

  /** Called when the player first heads for the road. The first customer appears then, so prep doesn't use up their patience. */
  lockPrep(): void {
    if (this.prepLocked) return;
    this.prepLocked = true;
    this.spawnRoadCustomer();
  }

  /** Total spent on the stock currently in the cooler. */
  get stockCostCents(): number {
    return this.coolerSlots.reduce((sum, s) => sum + s.quantity * getFlavour(s.flavour).costCents, 0);
  }

  /**
   * Buy Stock (PR #29 feedback): pays for a draft order from the cooler and
   * makes it the cooler's contents. Returns false, changing nothing, if prep is
   * locked, the evening is over, or the player can't afford it.
   */
  buyStock(order: CoolerOrder): boolean {
    if (this.prepLocked || this.ended) return false;
    const cost = order.costCents;
    if (cost > this.cashCents) return false;

    order.slots.forEach((slot, i) => {
      const target = this.coolerSlots.at(i);
      if (target) Object.assign(target, slot);
    });
    if (cost !== 0) this.changeMoney(-cost, 'Stock', false);
    this.emit(EveningEvents.CoolerChanged);
    return true;
  }
}
