import * as Phaser from 'phaser';
import {
  EVENING_END_HOUR,
  EVENING_LENGTH_SECONDS,
  EVENING_START_HOUR,
} from '../config/tuning';

/** Events the evening sends out. Scenes listen for these instead of checking every frame. */
export const EveningEvents = {
  /** (changeCents: number, totalCents: number, label: string) */
  MoneyChanged: 'money-changed',
  /** () — the clock reached 8pm */
  Ended: 'ended',
  /** (waiting: boolean) — a customer arrived at, or left, the window */
  CustomerChanged: 'customer-changed',
} as const;

/**
 * Everything about the current evening: the clock and the money.
 * A brand-new EveningState is created for every evening, so starting
 * again always resets everything (issue #4).
 *
 * Money is stored in whole cents to avoid rounding errors.
 */
export class EveningState extends Phaser.Events.EventEmitter {
  private elapsedMs = 0;
  private ended = false;
  private totalCents = 0;
  private customerAtWindow = false;
  private readonly lengthMs = EVENING_LENGTH_SECONDS * 1000;

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

  get moneyCents(): number {
    return this.totalCents;
  }

  get isOver(): boolean {
    return this.ended;
  }

  /** True while a customer is waiting at the window (issue #7: window only usable during a sale). */
  get customerWaiting(): boolean {
    return this.customerAtWindow;
  }

  setCustomerWaiting(waiting: boolean): void {
    if (this.customerAtWindow === waiting) return;
    this.customerAtWindow = waiting;
    this.emit(EveningEvents.CustomerChanged, waiting);
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

  /** Adds (or, with a negative amount, removes) money. The total may go below zero. */
  changeMoney(cents: number, label: string): void {
    if (this.ended) return;
    this.totalCents += cents;
    this.emit(EveningEvents.MoneyChanged, cents, this.totalCents, label);
  }

  /** Ends the evening immediately (used by the debug shortcut). */
  endNow(): void {
    if (this.ended) return;
    this.elapsedMs = this.lengthMs;
    this.ended = true;
    this.emit(EveningEvents.Ended);
  }
}
