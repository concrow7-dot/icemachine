import * as Phaser from 'phaser';
import { defaultPriceCents, FLAVOURS, getFlavour, type FlavourId } from '../config/flavours';
import type { CoolerOrder } from './CoolerOrder';
import { generateOrder, orderTotalCents, Sale } from './Sale';
import type { Difficulty } from './Difficulty';
import { CURB_SPOTS, HOME_START, TILE_SIZE } from '../config/neighbourhood';
import {
  COOLER_SLOTS,
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
  /** () — the sale at the window changed phase or ended (#13-#15) */
  SaleChanged: 'sale-changed',
} as const;

/** A new curb customer appears at least this many tiles from the truck (so leaving the window never starts another sale on the spot). */
const SPAWN_CLEAR_OF_TRUCK_TILES = 3;

/** The four arrow keys (and W A S D): up is gas, down is brake and reverse, left and right steer (#32). */
export type Facing = 'up' | 'down' | 'left' | 'right';

/** Where the truck is parked in the neighbourhood, in pixels, and the way it points in degrees (0 = right, 90 = down). */
export type TruckPosition = { x: number; y: number; angle: number };

/** The one customer waiting at the curb (#12): which CURB_SPOTS entry. They wait until picked up. */
export type RoadCustomer = { spot: number };

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
  /** Picked on the title screen; fixed for the evening (easy: arrows point the way, hard: car-style). */
  difficulty: Difficulty = 'hard';
  private elapsedMs = 0;
  /** #66: the evening opens at the cooler with the clock stopped at 5:00 PM; it starts when you leave the cooler. */
  private clockRunning = false;
  private ended = false;
  private readonly startCashCents = STARTING_CASH_CENTS;
  private cashCents = STARTING_CASH_CENTS;
  private customerAtWindow = false;
  private prepLocked = false;
  private readonly lengthMs = EVENING_LENGTH_SECONDS * 1000;
  private roadCustomerNow: RoadCustomer | null = null;
  /** Keeps running after 8 PM, so a sale in progress can finish (#15). */
  private nowMsValue = 0;
  private endPending = false;
  private saleNow: Sale | null = null;
  private damageTotalCents = 0;
  private salesTotalCents = 0;
  private tipsTotalCents = 0;
  private stockSpentCents = 0;
  private lastSalePhase: string | null = null;

  /** The truck starts each evening on the road outside home (#9). */
  private truckPosition: TruckPosition = {
    x: HOME_START.col * TILE_SIZE,
    y: HOME_START.row * TILE_SIZE,
    angle: 0,
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

  /** Has the clock started? (It waits while you stock the cooler at the start, #66.) */
  get isClockRunning(): boolean {
    return this.clockRunning;
  }

  /** Starts the evening's clock: leaving the cooler for the first time (#66). Safe to call again. */
  startClock(): void {
    this.clockRunning = true;
  }

  /** Advances the clock. Called every frame by the HUD, whatever phase the player is in. */
  tick(deltaMs: number): void {
    if (this.ended || !this.clockRunning) return;
    this.nowMsValue += deltaMs;
    this.updateSale();
    if (this.endPending) return;
    this.elapsedMs += deltaMs;
    if (this.elapsedMs >= this.lengthMs) {
      this.elapsedMs = this.lengthMs;
      this.finishEvening();
    }
  }

  /** Ends the evening now (debug shortcut). A sale in progress still finishes first. */
  endNow(): void {
    if (this.ended) return;
    this.elapsedMs = this.lengthMs;
    this.finishEvening();
  }

  /** 8 PM: the evening ends, unless a sale is under way, which finishes first (PO, doc 12 Q31). */
  private finishEvening(): void {
    if (this.saleNow) {
      this.endPending = true;
      return;
    }
    this.ended = true;
    this.emit(EveningEvents.Ended);
  }

  /** Past 8 PM: no new customers. */
  get isAfterHours(): boolean {
    return this.elapsedMs >= this.lengthMs;
  }

  /** The evening's running clock in milliseconds; keeps going while a sale finishes after 8 PM. */
  get nowMs(): number {
    return this.nowMsValue;
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

  // ---- Damage (#10) ----

  /** Charges for a hit on the road (pothole, parked car, road edge). Cash may go below zero. */
  takeDamage(cents: number, label: string): void {
    if (this.ended) return;
    this.damageTotalCents += cents;
    this.changeMoney(-cents, label);
  }

  /** Total paid in damage tonight. */
  get damageCents(): number {
    return this.damageTotalCents;
  }

  /** Tonight's breakdown for the results screen (#16). */
  get breakdown(): { salesCents: number; tipsCents: number; stockCents: number; damageCents: number } {
    return {
      salesCents: this.salesTotalCents,
      tipsCents: this.tipsTotalCents,
      stockCents: this.stockSpentCents,
      damageCents: this.damageTotalCents,
    };
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
    if (!this.ended && !this.isAfterHours && !this.isSoldOut && this.prepLocked && !this.customerAtWindow) {
      // Never right where the truck is: a customer there would start a sale the
      // moment you leave the window (the spot just served was being picked again).
      const nearTruck = (i: number) => {
        const s = CURB_SPOTS[i];
        if (!s) return false;
        const dx = (s.col + 0.5) * TILE_SIZE - this.truckPosition.x;
        const dy = (s.row + 0.5) * TILE_SIZE - this.truckPosition.y;
        return Math.hypot(dx, dy) < SPAWN_CLEAR_OF_TRUCK_TILES * TILE_SIZE;
      };
      const choices = CURB_SPOTS.map((_, i) => i).filter((i) => i !== previous && !nearTruck(i));
      const spot = choices[Math.floor(Math.random() * choices.length)] ?? 0;
      this.roadCustomerNow = { spot };
    }
    this.emit(EveningEvents.RoadCustomerChanged);
  }

  // ---- Selling (#13-#15) ----

  /** The sale at the window, or null. */
  get sale(): Sale | null {
    return this.saleNow;
  }

  /**
   * The truck reached a customer: they step up to the window and order from
   * what's in the cooler (PO, doc 12 Q22: straight to the sales screen).
   */
  startSale(): Sale {
    this.meetCustomer();
    this.saleNow = new Sale(generateOrder(this.coolerSlots), this.coolerSlots.length, this.nowMsValue);
    this.lastSalePhase = this.saleNow.phase;
    this.emit(EveningEvents.SaleChanged);
    return this.saleNow;
  }

  /** At the cooler during a sale: moves one ice cream between the slot and the bag (+1 or -1). */
  pickForSale(slot: number, delta: 1 | -1): boolean {
    const sale = this.saleNow;
    const stock = this.coolerSlots[slot];
    if (!sale || sale.phase !== 'deciding' || !stock) return false;
    const inBag = sale.bag[slot] ?? 0;
    if (delta > 0 && stock.quantity <= 0) return false;
    if (delta < 0 && inBag <= 0) return false;
    stock.quantity -= delta;
    sale.bag[slot] = inBag + delta;
    this.emit(EveningEvents.CoolerChanged);
    return true;
  }

  /** The player types a price and presses Enter (#15). */
  chargeForSale(priceCents: number): void {
    const sale = this.saleNow;
    if (!sale) return;
    const result = sale.charge(priceCents, orderTotalCents(sale.order, this.coolerSlots), this.nowMsValue);
    if (result === 'retry') this.returnBagToStock(sale);
    if (sale.outcome?.kind === 'paid') {
      this.changeMoney(sale.outcome.priceCents, 'Sale');
      this.salesTotalCents += sale.outcome.priceCents;
      if (sale.outcome.tipCents > 0) this.changeMoney(sale.outcome.tipCents, 'Tip');
      this.tipsTotalCents += sale.outcome.tipCents;
    }
    this.afterSaleChange();
  }

  /** B on the sales screen: drive off without serving (a lost sale). */
  driveOffFromSale(): void {
    this.saleNow?.driveOff();
    this.afterSaleChange();
  }

  /**
   * The player leaves the sales screen after the sale is over. Items handed
   * over in a failed sale are gone; anything else in the bag goes back in the
   * cooler. The next customer appears, or the evening ends if it's past 8 PM.
   */
  closeSale(): void {
    const sale = this.saleNow;
    if (!sale || sale.phase !== 'over') return;
    if (!sale.itemsGivenAway && sale.outcome?.kind !== 'paid') this.returnBagToStock(sale);
    this.saleNow = null;
    this.lastSalePhase = null;
    this.setCustomerWaiting(false);
    this.emit(EveningEvents.SaleChanged);
    if (this.endPending) {
      this.endPending = false;
      this.ended = true;
      this.emit(EveningEvents.Ended);
    }
  }

  private returnBagToStock(sale: Sale): void {
    sale.bag.forEach((count, slot) => {
      const stock = this.coolerSlots[slot];
      if (stock) stock.quantity += count;
      sale.bag[slot] = 0;
    });
    this.emit(EveningEvents.CoolerChanged);
  }

  /** Advances the sale's timers and tells the scenes when its phase changes. */
  private updateSale(): void {
    const sale = this.saleNow;
    if (!sale) return;
    sale.update(this.nowMsValue);
    if (sale.phase !== this.lastSalePhase) this.afterSaleChange();
  }

  private afterSaleChange(): void {
    this.lastSalePhase = this.saleNow?.phase ?? null;
    this.emit(EveningEvents.SaleChanged);
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

  /** Called when the player first heads for the road; the first customer appears then. */
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
    this.stockSpentCents += cost;
    this.emit(EveningEvents.CoolerChanged);
    return true;
  }
}
