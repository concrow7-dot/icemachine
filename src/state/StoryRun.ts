import { FLAVOURS } from '../config/flavours';
import { BIKE_PRICE_CENTS, FUEL_STORY_START, STORY_DAYS, STORY_START_CASH_CENTS } from '../config/tuning';
import { EveningState, type CoolerSlot } from './EveningState';
import { clearStorySave, saveStory, type StorySave } from './StorySave';

// SCREAM-19 (PO, October 31): Story mode. Several evenings in a row; the cash
// and the ice cream left in the cooler carry from one evening to the next
// (leftover ice cream keeps overnight, for now), and so does the gas (SCREAM-22). Running out of money is game
// over. Quick play doesn't use any of this.

/** How an evening of a Story run ended. */
export type DayOutcome = 'next' | 'complete' | 'broke';

/** The cheapest ice cream to buy, in cents. */
const CHEAPEST_COST_CENTS = Math.min(...FLAVOURS.map((f) => f.costCents));

/**
 * Out of money (engineering's call, SCREAM-19): at the end of an evening, cash
 * is below $0, or the cooler is empty and you can't afford a single ice cream.
 * During an evening you keep playing even below $0, since you can still sell.
 */
export function isBroke(cashCents: number, stockLeft: number): boolean {
  return cashCents < 0 || (stockLeft === 0 && cashCents < CHEAPEST_COST_CENTS);
}

/** Sales, tips, stock and damage added up over every evening of a run. */
export type RunTotals = {
  salesCents: number;
  tipsCents: number;
  stockCents: number;
  gasCents: number;
  damageCents: number;
  /** SCREAM-93: the run's largest single sale (price plus tip). */
  largestSaleCents: number;
};

export class StoryRun {
  /** Which evening this is, from 1. */
  day = 1;
  readonly days = STORY_DAYS;
  /** What tonight started with: the cash and the cooler. Restarting the evening goes back to this. */
  cashCents = STORY_START_CASH_CENTS;
  slots: CoolerSlot[] | null = null;
  /** SCREAM-22: what tonight's tank started with. PO: a quarter on day 1; after that, what was left. */
  fuel = FUEL_STORY_START;
  /** Set once the run is over (the last day ended, or out of money). */
  outcome: DayOutcome | null = null;
  /** SCREAM-18: the whole run's takings, for the end-of-run stats. */
  totals: RunTotals = { salesCents: 0, tipsCents: 0, stockCents: 0, gasCents: 0, damageCents: 0, largestSaleCents: 0 };

  /** A new run at day 1, or (SCREAM-17) one picked up from a save. */
  constructor(save?: StorySave) {
    if (save) {
      this.day = save.day;
      this.cashCents = save.cashCents;
      this.slots = save.slots.map((s) => ({ ...s }));
      this.fuel = save.fuel;
      this.totals = { ...save.totals };
    }
  }

  /** A new evening built from what tonight started with. */
  newEvening(): EveningState {
    return new EveningState({ cashCents: this.cashCents, slots: this.slots ?? [], fuel: this.fuel });
  }

  /** The evening is over: works out what happens next and, if the run goes on, carries the cash and stock forward. Call once per evening. */
  finishDay(evening: EveningState): DayOutcome {
    const result: DayOutcome = isBroke(evening.moneyCents, evening.stockLeft)
      ? 'broke'
      : this.day >= this.days
        ? 'complete'
        : 'next';
    this.cashCents = evening.moneyCents;
    this.slots = evening.slotsSnapshot;
    this.fuel = evening.fuel;
    const b = evening.breakdown;
    this.totals = {
      salesCents: this.totals.salesCents + b.salesCents,
      tipsCents: this.totals.tipsCents + b.tipsCents,
      stockCents: this.totals.stockCents + b.stockCents,
      gasCents: this.totals.gasCents + b.gasCents,
      damageCents: this.totals.damageCents + b.damageCents,
      largestSaleCents: Math.max(this.totals.largestSaleCents, evening.largestSaleCents),
    };
    if (result === 'next') {
      this.day += 1;
      // SCREAM-17: save at the end of each evening, ready for the next one.
      saveStory({ day: this.day, cashCents: this.cashCents, slots: this.slots, fuel: this.fuel, totals: this.totals });
    } else {
      this.outcome = result;
      clearStorySave(); // The run is over: start a new game next time.
    }
    return result;
  }

  /** SCREAM-18: can the player afford the bike with the cash they have? */
  get canAffordBike(): boolean {
    return this.cashCents >= BIKE_PRICE_CENTS;
  }
}
