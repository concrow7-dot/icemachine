import type { FlavourId } from '../config/flavours';
import { FLAVOURS } from '../config/flavours';
import { BIKE_PRICE_CENTS, FUEL_STORY_MIN_START, FUEL_STORY_OUT_OF_GAS_START, FUEL_STORY_START, STORY_DAYS, STORY_START_CASH_CENTS } from '../config/tuning';
import type { MapId } from '../config/maps';
import { EveningState, type CoolerSlot } from './EveningState';
import { clearStorySave, saveStory, type StorySave } from './StorySave';

// SCREAM-19 (PO, October 31): Story mode. Several evenings in a row; the cash
// and the ice cream left in the cooler carry from one evening to the next
// (leftover ice cream keeps overnight, for now), and so does the gas (SCREAM-22). Running out of money is game
// over. Quick play doesn't use any of this.

/**
 * SCREAM-205 (PO, November 8): Story is played on the tutorial map for now. The Worcester map is
 * left alone; later it's reached from the tutorial map in the game (SCREAM-145). Quick Play stays on Worcester.
 */
export const STORY_MAP: MapId = 'tutorial';

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
  /** SCREAM-296: spent at the cork board. */
  powerUpsCents: number;
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
  /** SCREAM-131: where each ice cream sat in the cooler. */
  cells: (FlavourId | null)[] | null = null;
  /** SCREAM-22: what tonight's tank started with. PO: a quarter on day 1; after that, what was left. */
  fuel = FUEL_STORY_START;
  /** SCREAM-148: picks which day each sometimes buyer buys on; the same all run. */
  seed = Math.floor(Math.random() * 2 ** 31);
  /** SCREAM-145: paid sales per resident so far this run, and whether a regular has told the roundabout's trick. */
  visits: Record<string, number> = {};
  rotaryHintGiven = false;
  /**
   * SCREAM-268 (PO, November 12): the uncle's $20 for gas. Used at his pump on his evening; a player
   * who goes On My Own or skips him first gets it at their first pump instead.
   */
  uncleGasUsed = false;
  /** SCREAM-296: the power-ups owned when tonight started (note ids). Bought with the run's cash; kept for the rest of the run. */
  powerUps: string[] = [];
  /** Set once the run is over (the last day ended, or out of money). */
  outcome: DayOutcome | null = null;
  /** SCREAM-18: the whole run's takings, for the end-of-run stats. */
  totals: RunTotals = { salesCents: 0, tipsCents: 0, stockCents: 0, gasCents: 0, damageCents: 0, powerUpsCents: 0, largestSaleCents: 0 };

  /** SCREAM-205 (PO, November 8): the uncle's tutorial evening is Day 1 (unless the player chose On My Own). */
  readonly withUncle: boolean;

  /** A new run at day 1 (with or without the uncle), or (SCREAM-17) one picked up from a save. */
  constructor(save?: StorySave, withUncle = false) {
    this.withUncle = !save && withUncle;
    if (save) {
      this.day = save.day;
      this.cashCents = save.cashCents;
      this.slots = save.slots.map((s) => ({ ...s }));
      this.cells = save.cells ? [...save.cells] : null;
      this.fuel = save.fuel;
      this.totals = { ...save.totals };
      this.visits = { ...(save.visits ?? {}) };
      this.rotaryHintGiven = save.rotaryHintGiven ?? false;
      this.uncleGasUsed = save.uncleGasUsed ?? false;
      this.powerUps = [...(save.powerUps ?? [])];
      if (save.seed !== undefined) this.seed = save.seed;
    }
  }

  /** A new evening built from what tonight started with. */
  newEvening(): EveningState {
    return new EveningState(
      {
        cashCents: this.cashCents,
        slots: this.slots ?? [],
        fuel: this.fuel,
        cells: this.cells ?? undefined,
        story: { day: this.day, seed: this.seed },
        visits: this.visits,
        rotaryHintGiven: this.rotaryHintGiven,
        uncleGas: !this.uncleGasUsed,
        powerUps: this.powerUps,
      },
      STORY_MAP,
      this.withUncle && this.day === 1,
    );
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
    this.cells = evening.cellsSnapshot;
    // SCREAM-119: nearly out of gas, the next day starts with 1/6 of a tank, enough to reach a station.
    // SCREAM-204 (PO, November 12): after running right out, with 1/3 (gas burns faster in Story now).
    this.fuel = evening.endedOutOfGas ? FUEL_STORY_OUT_OF_GAS_START : Math.max(evening.fuel, FUEL_STORY_MIN_START);
    this.visits = { ...evening.visits }; // SCREAM-145
    this.rotaryHintGiven = evening.rotaryHintGiven;
    if (evening.uncleGasUsed) this.uncleGasUsed = true;
    this.powerUps = [...evening.powerUps]; // SCREAM-296
    const b = evening.breakdown;
    this.totals = {
      salesCents: this.totals.salesCents + b.salesCents,
      tipsCents: this.totals.tipsCents + b.tipsCents,
      stockCents: this.totals.stockCents + b.stockCents,
      gasCents: this.totals.gasCents + b.gasCents,
      damageCents: this.totals.damageCents + b.damageCents,
      powerUpsCents: this.totals.powerUpsCents + b.powerUpsCents,
      largestSaleCents: Math.max(this.totals.largestSaleCents, evening.largestSaleCents),
    };
    if (result === 'next') {
      this.day += 1;
      // SCREAM-17: save at the end of each evening, ready for the next one.
      saveStory({
        day: this.day,
        cashCents: this.cashCents,
        slots: this.slots,
        cells: this.cells ?? undefined,
        fuel: this.fuel,
        totals: this.totals,
        seed: this.seed,
        visits: this.visits,
        rotaryHintGiven: this.rotaryHintGiven,
        uncleGasUsed: this.uncleGasUsed,
        powerUps: this.powerUps,
      });
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
