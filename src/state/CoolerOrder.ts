import { defaultPriceCents, FLAVOURS, getFlavour } from '../config/flavours';
import { MAX_PRICE_CENTS, MIN_PRICE_CENTS, SLOT_CAPACITY } from '../config/tuning';
import type { CoolerSlot } from './EveningState';

/**
 * A draft order at the cooler (PR #29 feedback). The player edits a copy of the
 * cooler; nothing is paid or saved until they press Buy Stock. Going back to
 * the truck simply throws the draft away.
 *
 * Stock already bought tonight can be added to but not returned: a slot's
 * quantity never drops below what is owned, and a slot holding owned stock
 * keeps its flavour.
 */
export class CoolerOrder {
  readonly slots: CoolerSlot[];
  private readonly owned: readonly Readonly<CoolerSlot>[];
  private readonly cash: () => number;

  /** `owned` is the cooler as it is now; `cash` reads the player's current cash. */
  constructor(owned: readonly Readonly<CoolerSlot>[], cash: () => number) {
    this.owned = owned.map((s) => ({ ...s }));
    this.cash = cash;
    this.slots = owned.map((s) => ({ ...s }));
  }

  /** Bars of this slot's flavour already bought tonight (0 if the draft changed its flavour). */
  ownedQuantity(index: number): number {
    const owned = this.owned.at(index);
    const slot = this.slots.at(index);
    if (!owned || !slot || owned.flavour !== slot.flavour) return 0;
    return owned.quantity;
  }

  /** True when the slot holds owned stock, so its flavour can't change. */
  isFlavourLocked(index: number): boolean {
    return (this.owned.at(index)?.quantity ?? 0) > 0;
  }

  /** What Buy Stock will charge: only the extra bars in this order. */
  get costCents(): number {
    return this.slots.reduce(
      (sum, slot, i) => sum + (slot.quantity - this.ownedQuantity(i)) * getFlavour(slot.flavour).costCents,
      0,
    );
  }

  /** Cash the player will have left after buying this order. */
  get cashAfterCents(): number {
    return this.cash() - this.costCents;
  }

  /** True if anything differs from what is in the cooler now. */
  get hasChanges(): boolean {
    return this.slots.some((slot, i) => {
      const owned = this.owned.at(i);
      return (
        !owned ||
        owned.flavour !== slot.flavour ||
        owned.quantity !== slot.quantity ||
        owned.priceCents !== slot.priceCents
      );
    });
  }

  /** Switches an empty slot to the next (or previous) flavour not used by another slot. */
  cycleFlavour(index: number, direction: -1 | 1): boolean {
    const slot = this.slots.at(index);
    if (!slot || this.isFlavourLocked(index)) return false;

    const taken = new Set(this.slots.filter((s) => s !== slot).map((s) => s.flavour));
    const ids = FLAVOURS.map((f) => f.id);
    let i = ids.indexOf(slot.flavour);
    for (let step = 0; step < ids.length; step++) {
      i = (i + direction + ids.length) % ids.length;
      const candidate = ids.at(i);
      if (candidate && !taken.has(candidate)) {
        if (candidate === slot.flavour) return false;
        slot.flavour = candidate;
        slot.quantity = 0;
        slot.priceCents = defaultPriceCents(candidate);
        return true;
      }
    }
    return false;
  }

  /** Adds or removes bars in the draft. Can't go below owned stock, overfill, or overspend. */
  changeQuantity(index: number, delta: number): boolean {
    const slot = this.slots.at(index);
    if (!slot || delta === 0) return false;

    const next = slot.quantity + delta;
    if (next < this.ownedQuantity(index) || next > SLOT_CAPACITY) return false;

    const extraCost = delta * getFlavour(slot.flavour).costCents;
    if (extraCost > this.cashAfterCents) return false;

    slot.quantity = next;
    return true;
  }

  /** Raises or lowers a slot's selling price, within the allowed range. */
  changePrice(index: number, deltaCents: number): boolean {
    const slot = this.slots.at(index);
    if (!slot) return false;

    const next = slot.priceCents + deltaCents;
    if (next < MIN_PRICE_CENTS || next > MAX_PRICE_CENTS) return false;

    slot.priceCents = next;
    return true;
  }
}
