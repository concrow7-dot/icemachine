import { FLAVOURS } from '../config/flavours';
import { STORY_DAYS, STORY_START_CASH_CENTS } from '../config/tuning';
import { EveningState, type CoolerSlot } from './EveningState';
import { clearStorySave, saveStory, type StorySave } from './StorySave';

// SCREAM-19 (PO, October 31): Story mode. Several evenings in a row; the cash
// and the ice cream left in the cooler carry from one evening to the next
// (leftover ice cream keeps overnight, for now). Running out of money is game
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

export class StoryRun {
  /** Which evening this is, from 1. */
  day = 1;
  readonly days = STORY_DAYS;
  /** What tonight started with: the cash and the cooler. Restarting the evening goes back to this. */
  cashCents = STORY_START_CASH_CENTS;
  slots: CoolerSlot[] | null = null;
  /** Set once the run is over (the last day ended, or out of money). */
  outcome: DayOutcome | null = null;

  /** A new run at day 1, or (SCREAM-17) one picked up from a save. */
  constructor(save?: StorySave) {
    if (save) {
      this.day = save.day;
      this.cashCents = save.cashCents;
      this.slots = save.slots.map((s) => ({ ...s }));
    }
  }

  /** A new evening built from what tonight started with. */
  newEvening(): EveningState {
    return new EveningState({ cashCents: this.cashCents, slots: this.slots ?? [] });
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
    if (result === 'next') {
      this.day += 1;
      // SCREAM-17: save at the end of each evening, ready for the next one.
      saveStory({ day: this.day, cashCents: this.cashCents, slots: this.slots });
    } else {
      this.outcome = result;
      clearStorySave(); // The run is over: start a new game next time.
    }
    return result;
  }
}
