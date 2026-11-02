import * as Phaser from 'phaser';
import { defaultPriceCents, FLAVOURS, getFlavour, type FlavourId } from '../config/flavours';
import type { CoolerOrder } from './CoolerOrder';
import { generateOrder, orderTotalCents, Sale } from './Sale';
import { WORCESTER } from '../config/worcester';
import { RESIDENTS } from '../config/residents';
import { Residents, type ResidentNow } from './Residents';
import {
  COOLER_SLOTS,
  EVENING_END_HOUR,
  EVENING_LENGTH_SECONDS,
  EVENING_START_HOUR,
  FUEL_FULL_TANK_CENTS,
  FUEL_QUICK_PLAY_START,
  FUEL_STEP_CENTS,
  FUEL_TANK_PX,
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
  /** () — the sale at the window changed phase or ended (#13-#15) */
  SaleChanged: 'sale-changed',
} as const;

/** The four arrow keys (and W A S D): up is gas, down is brake and reverse, left and right steer (#32). */
export type Facing = 'up' | 'down' | 'left' | 'right';

/** Where the truck is parked in the neighbourhood, in pixels, and the way it points in degrees (0 = right, 90 = down). */
export type TruckPosition = { x: number; y: number; angle: number };

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
  /** #66: the evening opens at the cooler with the clock stopped at 5:00 PM; it starts when you leave the cooler. */
  private clockRunning = false;
  private ended = false;
  private readonly startCashCents: number;
  private cashCents: number;
  private customerAtWindow = false;
  private prepLocked = false;
  private readonly lengthMs = EVENING_LENGTH_SECONDS * 1000;
  /** SCREAM-67: the resident being served at the window, or null. */
  private servingNow: ResidentNow | null = null;
  /** Keeps running after 8 PM, so a sale in progress can finish (#15). */
  private nowMsValue = 0;
  private endPending = false;
  private saleNow: Sale | null = null;
  private damageTotalCents = 0;
  private salesTotalCents = 0;
  private tipsTotalCents = 0;
  private stockSpentCents = 0;
  /** SCREAM-22: gas in the tank, from 0 (empty) to 1 (full). */
  private fuelLeft: number;
  private gasSpentCents = 0;
  private lastSalePhase: string | null = null;

  /** The truck starts each evening on the road outside home (#9). */
  private truckPosition: TruckPosition = {
    x: WORCESTER.homeStart.x,
    y: WORCESTER.homeStart.y,
    angle: WORCESTER.homeStart.angle,
  };

  /** The neighbourhood's people (SCREAM-59, SCREAM-73), going in and out of their houses all evening. */
  readonly residents = new Residents(RESIDENTS);

  /** The cooler starts with the first three flavours selected and empty. */
  private readonly coolerSlots: CoolerSlot[] = FLAVOURS.slice(0, COOLER_SLOTS).map((f) => ({
    flavour: f.id,
    quantity: 0,
    priceCents: defaultPriceCents(f.id),
  }));

  /**
   * Quick play starts every evening fresh. Story mode (SCREAM-19) passes in the
   * cash and the cooler left over from the evening before.
   */
  constructor(carry?: { cashCents: number; slots: readonly Readonly<CoolerSlot>[]; fuel: number }) {
    super();
    this.startCashCents = carry?.cashCents ?? STARTING_CASH_CENTS;
    this.cashCents = this.startCashCents;
    this.fuelLeft = Phaser.Math.Clamp(carry?.fuel ?? FUEL_QUICK_PLAY_START, 0, 1);
    carry?.slots.forEach((slot, i) => {
      const target = this.coolerSlots.at(i);
      if (target) Object.assign(target, slot);
    });
  }

  /** A copy of the cooler as it is now, to carry into the next evening (SCREAM-19). */
  get slotsSnapshot(): CoolerSlot[] {
    return this.coolerSlots.map((s) => ({ ...s }));
  }

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
  get breakdown(): { salesCents: number; tipsCents: number; stockCents: number; gasCents: number; damageCents: number } {
    return {
      salesCents: this.salesTotalCents,
      tipsCents: this.tipsTotalCents,
      stockCents: this.stockSpentCents,
      gasCents: this.gasSpentCents,
      damageCents: this.damageTotalCents,
    };
  }

  // ---- Fuel (SCREAM-22) ----

  /** Gas in the tank, from 0 (empty) to 1 (full). */
  get fuel(): number {
    return this.fuelLeft;
  }

  get isOutOfFuel(): boolean {
    return this.fuelLeft <= 0;
  }

  /** Uses up the gas for driving this many px (forward or back). */
  burnFuel(px: number): void {
    if (this.ended || px <= 0) return;
    this.fuelLeft = Math.max(0, this.fuelLeft - px / FUEL_TANK_PX);
  }

  /** The most gas the player can buy now, in cents: whole $5 steps that fit in the tank and in the wallet. */
  get maxGasCents(): number {
    // The small extra lets a tank that's exactly a step short still take that step, despite rounding.
    const room = Math.floor(((1 - this.fuelLeft) * FUEL_FULL_TANK_CENTS) / FUEL_STEP_CENTS + 1e-6) * FUEL_STEP_CENTS;
    const affordable = Math.floor(Math.max(0, this.cashCents) / FUEL_STEP_CENTS) * FUEL_STEP_CENTS;
    return Math.max(0, Math.min(room, affordable));
  }

  /** Buys gas at the pump: a whole number of $5 steps, no more than maxGasCents. Returns false, changing nothing, otherwise. */
  buyGas(cents: number): boolean {
    if (this.ended || cents <= 0 || cents % FUEL_STEP_CENTS !== 0 || cents > this.maxGasCents) return false;
    this.fuelLeft = Math.min(1, this.fuelLeft + cents / FUEL_FULL_TANK_CENTS);
    this.gasSpentCents += cents;
    this.changeMoney(-cents, 'Gas');
    return true;
  }

  // ---- Customers (#7, set for real by #12) ----

  /** True while a customer is waiting at the window (issue #7: window only usable during a sale). */
  get customerWaiting(): boolean {
    return this.customerAtWindow;
  }

  /** Sets whether a customer is at the window. */
  setCustomerWaiting(waiting: boolean): void {
    if (this.customerAtWindow === waiting) return;
    this.customerAtWindow = waiting;
    this.emit(EveningEvents.CustomerChanged, waiting);
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
   * SCREAM-67: whether anyone new may start wanting ice cream when they hear the
   * truck: only once the truck is on the road, with stock to sell, before 8 PM.
   * Customers already at the curb keep waiting either way.
   */
  get acceptingCustomers(): boolean {
    return this.prepLocked && !this.ended && !this.isAfterHours && !this.isSoldOut;
  }

  /** The resident being served at the window (SCREAM-99 shows their name), or null. */
  get customer(): ResidentNow | null {
    return this.servingNow;
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
  startSale(customer?: ResidentNow): Sale {
    // SCREAM-67: the resident steps up to the window (the Shift+4 debug key starts a sale with nobody).
    if (customer) {
      this.residents.startServing(customer);
      this.servingNow = customer;
    }
    this.setCustomerWaiting(true);
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
    if (this.servingNow) this.residents.finishServing(this.servingNow);
    this.servingNow = null;
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

  /** Called when the player first heads for the road; from then on, people who hear the truck may want ice cream. */
  lockPrep(): void {
    this.prepLocked = true;
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
