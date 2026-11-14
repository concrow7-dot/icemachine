// SCREAM-317 (PO, November 14): the Calculator power-up. Once it is owned, the price pad at the
// sales window works like the desk calculator in his photo: + − × ÷ and =, so an order can be
// added up there (2.50 + 2.50 + 3 =) before CHARGE. Worked left to right, like a cheap
// calculator (no "times before plus"). Money is kept in cents; each number is typed with the
// same rules as a price (pressPriceKey). No Phaser, unit-tested.

import { pressPriceKey } from './PriceEntry';

export type CalcOp = '+' | '-' | '*' | '/';

/** The typed text in cents; 0 for nothing or zero (unlike priceEntryCents, zero is a number here). */
function typedCents(typed: string): number {
  if (typed === '') return 0;
  const [dollars = '', cents = ''] = typed.split('.');
  return Number.parseInt(dollars || '0', 10) * 100 + Number.parseInt(`${cents}00`.slice(0, 2), 10);
}

/** a op b, in cents. × and ÷ treat the second number as a plain number (3 × 2.50 = 7.50). */
export function applyOp(a: number, op: CalcOp, b: number): number {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '*') return Math.round((a * b) / 100);
  return b === 0 ? a : Math.round((a * 100) / b); // ÷ 0 leaves the number alone
}

/** A number of cents as the display shows it: 750 is "7.50", -200 is "-2.00". */
export function formatCalc(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export class CalcSum {
  /** The number being typed now, like a price ('7.25', '3'). */
  typed = '';
  /** The running total, in cents (null before the first + − × ÷ or =). */
  total: number | null = null;
  /** The sign waiting for its second number. */
  op: CalcOp | null = null;

  clear(): void {
    this.typed = '';
    this.total = null;
    this.op = null;
  }

  /** A digit, '00' or '.': starts a new number after = . */
  digit(key: string): void {
    if (this.typed === '' && this.op === null) this.total = null; // after =, a new sum
    this.typed = pressPriceKey(this.typed, key);
  }

  /** ← takes off the last digit typed; a worked-out total stays. */
  back(): void {
    this.typed = this.typed.slice(0, -1);
  }

  /** + − × ÷: works out what is waiting, then waits for the next number. */
  operator(op: CalcOp): void {
    if (this.typed !== '') this.settle();
    else if (this.total === null) return; // nothing to work on yet
    this.op = op;
  }

  /** =: works out the sum. */
  equals(): void {
    if (this.typed !== '') this.settle();
    this.op = null;
  }

  /** The number on the display. */
  display(): string {
    if (this.typed !== '') return this.typed;
    if (this.total !== null) return formatCalc(this.total);
    return '0';
  }

  /** CHARGE: the sum worked out, in cents, or null when it is nothing (or below zero). */
  chargeCents(): number | null {
    this.equals();
    const cents = this.total ?? 0;
    return cents > 0 ? cents : null;
  }

  private settle(): void {
    const value = typedCents(this.typed);
    this.total = this.total === null || this.op === null ? value : applyOp(this.total, this.op, value);
    this.typed = '';
  }
}
