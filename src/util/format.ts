/** Formats whole cents as dollars, e.g. 450 -> "$4.50", -200 -> "-$2.00". */
export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

/** Formats a signed change, e.g. 450 -> "+$4.50", -200 -> "-$2.00". */
export function formatMoneyChange(cents: number): string {
  return cents >= 0 ? `+${formatMoney(cents)}` : formatMoney(cents);
}

/** Formats minutes since midnight as a 12-hour clock, e.g. 1020 -> "5:00 PM". */
export function formatClock(minutesSinceMidnight: number): string {
  const total = Math.floor(minutesSinceMidnight);
  const hours24 = Math.floor(total / 60) % 24;
  const minutes = total % 60;
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${suffix}`;
}
