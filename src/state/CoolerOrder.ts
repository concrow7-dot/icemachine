import { getFlavour, type FlavourId } from '../config/flavours';
import { COOLER_CAPACITY, MAX_PRICE_CENTS, MIN_PRICE_CENTS } from '../config/tuning';
import type { CoolerSlot } from './EveningState';

/** One square of the cooler's crates: which ice cream sits there, and whether it's been paid for. */
export type CoolerCell = { flavour: FlavourId; paid: boolean } | null;

/**
 * A draft order at the cooler (PR #29 feedback). The player edits a copy of the
 * cooler; nothing is paid or saved until they press Buy Stock. Going back to
 * the truck simply throws the draft away.
 *
 * SCREAM-129 (PO, November 2): the player picks single ice creams from the
 * clipboard, and each one drops into the next empty square of the cooler's crates
 * (3 crates of 4 x 4). One stock line per flavour; stock already paid for can't be
 * taken back out, ice creams picked in this draft can (by clicking their square).
 */
export class CoolerOrder {
  /** One line per flavour (the order of FLAVOURS), with the draft's quantities and prices. */
  readonly slots: CoolerSlot[];
  private readonly owned: readonly Readonly<CoolerSlot>[];
  private readonly cash: () => number;
  /** The ice creams picked in this draft, in the order they were picked. */
  private readonly picked: FlavourId[] = [];

  /** `owned` is the cooler as it is now; `cash` reads the player's current cash. */
  constructor(owned: readonly Readonly<CoolerSlot>[], cash: () => number) {
    this.owned = owned.map((s) => ({ ...s }));
    this.cash = cash;
    this.slots = owned.map((s) => ({ ...s }));
  }

  /** Ice creams of this flavour already paid for tonight. */
  ownedQuantity(flavour: FlavourId): number {
    return this.owned.find((s) => s.flavour === flavour)?.quantity ?? 0;
  }

  /** How many of this flavour the cooler will hold after this order. */
  quantity(flavour: FlavourId): number {
    return this.slot(flavour)?.quantity ?? 0;
  }

  /** How many ice creams the cooler will hold after this order. */
  get total(): number {
    return this.slots.reduce((sum, s) => sum + s.quantity, 0);
  }

  /** True when every square is taken. */
  get isFull(): boolean {
    return this.total >= COOLER_CAPACITY;
  }

  /** What Buy Stock will charge: only what's been picked in this draft. */
  get costCents(): number {
    return this.picked.reduce((sum, f) => sum + getFlavour(f).costCents, 0);
  }

  /** Cash the player will have left after buying this order. */
  get cashAfterCents(): number {
    return this.cash() - this.costCents;
  }

  /** True if anything differs from what is in the cooler now. */
  get hasChanges(): boolean {
    return this.picked.length > 0 || this.slots.some((s) => s.priceCents !== this.owned.find((o) => o.flavour === s.flavour)?.priceCents);
  }

  /**
   * The cooler's squares, crate by crate and row by row: paid stock first (by flavour),
   * then this draft's picks in the order they were picked, then empty squares.
   */
  get cells(): CoolerCell[] {
    const cells: CoolerCell[] = [];
    for (const slot of this.slots) {
      for (let n = 0; n < this.ownedQuantity(slot.flavour); n++) cells.push({ flavour: slot.flavour, paid: true });
    }
    for (const flavour of this.picked) cells.push({ flavour, paid: false });
    while (cells.length < COOLER_CAPACITY) cells.push(null);
    return cells.slice(0, COOLER_CAPACITY);
  }

  /** Picks one ice cream from the clipboard into the next empty square. False if the cooler is full or there's not enough cash. */
  addOne(flavour: FlavourId): boolean {
    const slot = this.slot(flavour);
    if (!slot || this.isFull) return false;
    if (getFlavour(flavour).costCents > this.cashAfterCents) return false;
    slot.quantity += 1;
    this.picked.push(flavour);
    return true;
  }

  /** Takes an unpaid ice cream back out by its square. Paid stock and empty squares say no. */
  removeAt(cellIndex: number): boolean {
    const cell = this.cells.at(cellIndex);
    if (!cell || cell.paid) return false;
    const pickIndex = cellIndex - this.paidCount;
    const flavour = this.picked.at(pickIndex);
    const slot = flavour ? this.slot(flavour) : undefined;
    if (!flavour || !slot) return false;
    this.picked.splice(pickIndex, 1);
    slot.quantity -= 1;
    return true;
  }

  /** Takes back the last unpaid ice cream of this flavour (the keyboard's minus). */
  removeOne(flavour: FlavourId): boolean {
    const pickIndex = this.picked.lastIndexOf(flavour);
    return pickIndex >= 0 && this.removeAt(this.paidCount + pickIndex);
  }

  /** Raises or lowers a flavour's selling price on Today's Menu, within the allowed range. */
  changePrice(flavour: FlavourId, deltaCents: number): boolean {
    const slot = this.slot(flavour);
    if (!slot) return false;
    const next = slot.priceCents + deltaCents;
    if (next < MIN_PRICE_CENTS || next > MAX_PRICE_CENTS) return false;
    slot.priceCents = next;
    return true;
  }

  private get paidCount(): number {
    return this.owned.reduce((sum, s) => sum + s.quantity, 0);
  }

  private slot(flavour: FlavourId): CoolerSlot | undefined {
    return this.slots.find((s) => s.flavour === flavour);
  }
}
