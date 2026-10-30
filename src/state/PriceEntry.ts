// SCREAM-12 (PO, October 30): the price is typed like a calculator, left to right.
// 7 . 2 5 reads $7.25, and with no decimal point the number is whole dollars
// (7 reads $7.00). This replaced cash-register typing (PR #38), where digits
// filled from the right, and the whole-dollars click (PR #40).

/** Up to $999.99. */
export const MAX_DOLLAR_DIGITS = 3;
const MAX_CENT_DIGITS = 2;

/** One calculator key: a digit, '00' or '.'. Returns the new typed text (unchanged if the key doesn't fit). */
export function pressPriceKey(typed: string, key: string): string {
  if (key === '00') return pressPriceKey(pressPriceKey(typed, '0'), '0');
  const dot = typed.indexOf('.');
  if (key === '.') {
    if (dot >= 0) return typed;
    return (typed === '' ? '0' : typed) + '.';
  }
  if (!/^[0-9]$/.test(key)) return typed;
  if (dot >= 0) return typed.length - dot - 1 >= MAX_CENT_DIGITS ? typed : typed + key;
  if (typed === '0') return key; // a leading zero is replaced, like a calculator
  if (typed.length >= MAX_DOLLAR_DIGITS) return typed;
  return typed + key;
}

/** The typed text in cents, or null when nothing (or only zero) is typed. */
export function priceEntryCents(typed: string): number | null {
  if (typed === '') return null;
  const [dollars = '', cents = ''] = typed.split('.');
  const value = Number.parseInt(dollars || '0', 10) * 100 + Number.parseInt(`${cents}00`.slice(0, 2), 10);
  return value > 0 ? value : null;
}
