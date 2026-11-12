import { getFlavour, type FlavourId } from '../config/flavours';
import { COOLER_CAPACITY, CRATE_SIDE, MAX_PRICE_CENTS, MIN_PRICE_CENTS } from '../config/tuning';
import type { CoolerSlot } from './EveningState';

/** One square of the cooler's crates: which ice cream sits there, and whether it's been paid for. */
export type CoolerCell = { flavour: FlavourId; paid: boolean } | null;

/** Squares in one crate. */
const CRATE_CELLS = CRATE_SIDE * CRATE_SIDE;

/**
 * A draft order at the cooler (PR #29 feedback). The player edits a copy of the
 * cooler; nothing is paid or saved until they press Buy Stock. Going back to
 * the truck simply throws the draft away.
 *
 * SCREAM-129 (PO, November 2): the player picks single ice creams from the clipboard.
 * SCREAM-131 / SCREAM-132 (PO, November 2): every ice cream has its own square, because
 * filling an order means remembering where things are. Picks drop into the chosen crate's
 * next empty square; any ice cream can be dragged to another square; one not paid for yet
 * can be clicked out (leaving a gap). Paid stock can be moved but not taken out.
 */
export class CoolerOrder {
  /** One line per flavour (the order of FLAVOURS), with the draft's quantities and prices. */
  readonly slots: CoolerSlot[];
  private readonly owned: readonly Readonly<CoolerSlot>[];
  private readonly cash: () => number;
  private readonly draft: CoolerCell[];
  /** SCREAM-269: how many squares can be used (in Story half of every crate is covered to start). */
  readonly capacity: number;
  /** SCREAM-269: whether a square can be used. */
  private readonly open: (cell: number) => boolean;
  /** The squares holding this draft's picks, in the order they were picked. */
  private picked: number[] = [];
  private moved = false;
  /** The crate new picks go into (0, 1 or 2). */
  crate = 0;
  /** Why the last pick was refused: the cooler or the crate is full, or the cash ran out. */
  refusal: 'full' | 'cash' | null = null;

  /**
   * `owned` is the cooler's stock as it is now, `cells` where each of those ice creams sits,
   * `cash` reads the player's current cash.
   */
  constructor(owned: readonly Readonly<CoolerSlot>[], cash: () => number, cells: readonly (FlavourId | null)[] = [], open: (cell: number) => boolean = () => true) {
    this.open = open;
    this.capacity = Array.from({ length: COOLER_CAPACITY }, (_, i) => i).filter((i) => open(i)).length;
    this.owned = owned.map((s) => ({ ...s }));
    this.cash = cash;
    this.slots = owned.map((s) => ({ ...s }));
    this.draft = Array.from({ length: COOLER_CAPACITY }, (_, i) => {
      const f = open(i) ? (cells[i] ?? null) : null;
      return f ? { flavour: f, paid: true } : null;
    });
    // Start on the first crate with room.
    const firstEmpty = this.draft.findIndex((c, i) => c === null && open(i));
    this.crate = firstEmpty < 0 ? 0 : Math.floor(firstEmpty / CRATE_CELLS);
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
    return this.total >= this.capacity;
  }

  /** What Buy Stock will charge: only what's been picked in this draft. */
  get costCents(): number {
    return this.picked.reduce((sum, i) => sum + getFlavour(this.draft[i]?.flavour ?? 'eclair').costCents, 0);
  }

  /** Cash the player will have left after buying this order. */
  get cashAfterCents(): number {
    return this.cash() - this.costCents;
  }

  /** True if anything differs from what is in the cooler now. */
  get hasChanges(): boolean {
    return (
      this.picked.length > 0 ||
      this.moved ||
      this.slots.some((s) => s.priceCents !== this.owned.find((o) => o.flavour === s.flavour)?.priceCents)
    );
  }

  /** The cooler's squares, crate by crate and row by row. */
  get cells(): CoolerCell[] {
    return this.draft.map((c) => (c ? { ...c } : null));
  }

  /** Just the flavours, for Buy Stock to store. */
  get layout(): (FlavourId | null)[] {
    return this.draft.map((c) => c?.flavour ?? null);
  }

  /** Chooses the crate new picks go into. */
  chooseCrate(crate: number): void {
    if (crate >= 0 && crate * CRATE_CELLS < COOLER_CAPACITY) this.crate = crate;
  }

  /** Picks one ice cream from the clipboard into the chosen crate's next empty square. */
  addOne(flavour: FlavourId): boolean {
    this.refusal = null;
    const slot = this.slot(flavour);
    if (!slot) return false;
    if (this.isFull) return this.refuse('full');
    if (getFlavour(flavour).costCents > this.cashAfterCents) return this.refuse('cash');
    // The chosen crate's next empty square; if that crate is full, the next crate with room
    // (which becomes the chosen one), so stocking up never stalls.
    const crates = COOLER_CAPACITY / CRATE_CELLS;
    let target = -1;
    for (let step = 0; step < crates && target < 0; step++) {
      const crate = (this.crate + step) % crates;
      for (let i = crate * CRATE_CELLS; i < (crate + 1) * CRATE_CELLS; i++) {
        if (this.draft[i] === null && this.open(i)) {
          target = i;
          this.crate = crate;
          break;
        }
      }
    }
    if (target < 0) return this.refuse('full');
    this.draft[target] = { flavour, paid: false };
    this.picked.push(target);
    slot.quantity += 1;
    return true;
  }

  /** Takes an unpaid ice cream back out by its square, leaving the square empty. Paid stock says no. */
  removeAt(cellIndex: number): boolean {
    const cell = this.draft[cellIndex];
    if (!cell || cell.paid) return false;
    const slot = this.slot(cell.flavour);
    if (!slot) return false;
    this.draft[cellIndex] = null;
    this.picked = this.picked.filter((i) => i !== cellIndex);
    slot.quantity -= 1;
    return true;
  }

  /** Takes back the last unpaid ice cream of this flavour picked (the keyboard's minus). */
  removeOne(flavour: FlavourId): boolean {
    for (let n = this.picked.length - 1; n >= 0; n--) {
      const i = this.picked[n] ?? -1;
      if (this.draft[i]?.flavour === flavour) return this.removeAt(i);
    }
    return false;
  }

  /** SCREAM-132: moves an ice cream to another square, swapping with whatever is there. */
  move(from: number, to: number): boolean {
    if (from === to || from < 0 || to < 0 || from >= COOLER_CAPACITY || to >= COOLER_CAPACITY || !this.open(to)) return false;
    const a = this.draft[from] ?? null;
    if (!a) return false;
    const b = this.draft[to] ?? null;
    this.draft[to] = a;
    this.draft[from] = b;
    this.picked = this.picked.map((i) => (i === from ? to : i === to ? from : i));
    this.moved = true;
    return true;
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

  private refuse(reason: 'full' | 'cash'): false {
    this.refusal = reason;
    return false;
  }

  private slot(flavour: FlavourId): CoolerSlot | undefined {
    return this.slots.find((s) => s.flavour === flavour);
  }
}
