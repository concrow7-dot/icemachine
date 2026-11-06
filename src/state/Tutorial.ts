import * as Phaser from 'phaser';

/**
 * SCREAM-169 (PO, November 4-5): the uncle's guided tutorial (SCREAM-5). This tracks which
 * of his steps the player is on and what he says at each one. The six steps are the PO's
 * (SCREAM-5's description); each later ticket fills one in:
 *   1 stocking and prices (SCREAM-170), 2-3 and 6 the uncle drives (SCREAM-171),
 *   4-5 the guided sale with a regular (SCREAM-172), 6 the pump (SCREAM-173).
 * Until those land, the player does each step themselves and the tracker moves on when
 * the evening reports it done.
 *
 * The uncle's lines are engineering's drafts, waiting for the PO's wording (SCREAM-76), except
 * his opening lines, which are the PO's (SCREAM-177).
 */

/** Things the game reports that can move the uncle on: finish a step, or a line that waits for them. */
export type TutorialSignal =
  | 'coolerOpened'
  | 'flavourAdded'
  | 'stockBought'
  | 'setOff'
  | 'regularSpotted'
  | 'pulledUp'
  | 'orderHidden'
  | 'atPump'
  | 'arrivedHome'
  | 'customerAtWindow'
  | 'salePaid'
  | 'saleClosed'
  | 'gasBought';

export type TutorialStepId = 'stock' | 'drive' | 'regular' | 'sale' | 'pump' | 'home' | 'alone';

/** SCREAM-170: what a line is about, so the screen can outline it (the cooler's clipboard, its menu, Buy Stock). */
export type TutorialPoint = 'clipboard' | 'menu' | 'buy' | 'repeat' | 'gauge';

/**
 * One of the uncle's lines. A plain line moves on when read (clicked, or after a while).
 * SCREAM-170: a line with `until` waits for the player to do what it says.
 */
/**
 * SCREAM-172: `gate`: the sales window waits to open until the line is read (clicked, or after a
 * while); `hold`: the sale's clocks (her wait, the tip) wait until it's read (clicked, or the
 * player acts: R or the cooler).
 */
type Line = string | { text: string; until?: TutorialSignal; point?: TutorialPoint; hold?: boolean; gate?: boolean; gift?: boolean };

type Step = {
  id: TutorialStepId;
  /** The uncle's lines, shown one after another. The last one stays up until the step is done. */
  lines: Line[];
  /** What finishes the step (even if some of its lines are still to come). Without one, the step is done once its lines have been read. */
  doneWhen?: TutorialSignal;
};

/** The uncle's lines: the PO's (SCREAM-170, 177), then engineering's DRAFTS for the PO to rewrite. */
export const TUTORIAL_STEPS: readonly Step[] = [
  {
    id: 'stock',
    // SCREAM-177 (PO's note, November 5): his first three lines, in the truck; the third waits
    // for the player to click the cooler. SCREAM-170 (PO's note): his four lines at the cooler.
    lines: [
      "Thanks for helping out, kiddo. I can't work with this foot.",
      "I'll help you get set up, and then you're on your own.",
      { text: "Let's start by selecting your stock. Click on the cooler.", until: 'coolerOpened' },
      { text: 'Select what you want from the "Available Ice Cream" clipboard.', until: 'flavourAdded', point: 'clipboard' },
      { text: 'Once you\'ve added a new flavor, you can set the price in "Today\'s Menu".', point: 'menu' },
      { text: "Be careful: too expensive, and most people won't want to buy.", point: 'menu' },
      // SCREAM-187 (PO, November 6): the $50 comes with this line (it was on the drive home).
      { text: 'When you are ready, hit "Buy Stock". I left $50 on the truck for you to get started.', point: 'buy', gift: true },
    ],
    doneWhen: 'stockBought',
  },
  {
    id: 'drive',
    // SCREAM-170, 171 (PO's notes): back inside the truck he says the first line, then walks to
    // the cab; the second, he says while he drives. It stays up until the regular comes out.
    lines: [
      "Let's go get some gas, and then you'll be ready to go.",
      "The sun has been setting at 8 PM... you won't get business after that.",
    ],
    doneWhen: 'regularSpotted',
  },
  {
    id: 'regular',
    // SCREAM-171 (PO's note): when the regular stops the truck. {regular} is her name.
    // PO (November 6): the second line reworded; it stays up while he creeps to her square
    // and pulls up, until she's at the window.
    lines: [
      "Oh hey, it's {regular}... They buy ice cream pretty much every night.",
      // PO (November 6, testing PR #130): his line as the truck creeps up to her.
      { text: 'My best customers buy ice cream almost every night! Remembering where they live is the hard part.', until: 'pulledUp' },
    ],
  },
  {
    id: 'sale',
    // SCREAM-172 (PO's note, November 6): as the truck pulls up he says the first line, then
    // the window opens and she gives her order; once she has, the second (R is outlined), and
    // the third stays up until she's paid.
    lines: [
      { text: 'Remember the order, add the ice cream from the cooler, and calculate the price.', gate: true, until: 'orderHidden' },
      { text: 'Customers will usually let you ask for a repeat of their order. (Hit R)', hold: true, point: 'repeat' },
      'Make sure to get the order and price correct.',
    ],
    // PO (November 6, testing PR #130): no "come back tomorrow" line after the sale (his lines
    // as the truck pulls up cover regulars), so his last line stays until the window closes.
    doneWhen: 'saleClosed',
  },
  {
    id: 'pump',
    // SCREAM-173 (PO, November 6): on the way, the gauge (outlined); at the pump, he pays.
    lines: [
      { text: "Keep an eye on the gauge up top. Run dry and the night's over.", until: 'atPump', point: 'gauge' },
      "I have twenty bucks on me, add that and I'll pay this time.",
    ],
    doneWhen: 'gasBought',
  },
  {
    id: 'home',
    // SCREAM-185 (PO's note, November 6): he drives home, as fast as to the gas, saying these.
    // SCREAM-187: "I left $50..." moved to the cooler.
    lines: ['Return home to fill up on stock when you need.'],
    doneWhen: 'arrivedHome',
  },
  // SCREAM-185: back in the truck at home (the truck screen returns). Engineering's placeholder
  // until the PO's next script; read it and the player is on the road alone.
  { id: 'alone', lines: ["That's the job. The rest of the evening is yours. Sell all you can before 8!"] },
];

const textOf = (line: Line | undefined): string | null => (line === undefined ? null : typeof line === 'string' ? line : line.text);

/** SCREAM-171: the stretches of road the uncle drives in the tutorial. */
export type UncleLeg = 'toRegular' | 'toPump' | 'toHome';

export const TutorialEvents = {
  /** () — the uncle's line on screen changed (a new step or the next line), or he's done. */
  Changed: 'tutorial-changed',
} as const;

/** One evening's run through the uncle's steps. Only made for the tutorial map with the uncle on. */
export class TutorialRun extends Phaser.Events.EventEmitter {
  private stepIndex = 0;
  private lineIndex = 0;
  private finished = false;
  /** SCREAM-172: which line (step:line) that gates the window or holds the sale has been read. */
  private releasedLine = '';
  private get released(): boolean {
    return this.releasedLine === `${this.stepIndex}:${this.lineIndex}`;
  }
  /** SCREAM-171: the regular's name, for his lines about her. */
  regularName = '';
  /** SCREAM-171: the legs he has finished driving. */
  private readonly driven = new Set<UncleLeg>();

  get step(): TutorialStepId | 'done' {
    return this.finished ? 'done' : TUTORIAL_STEPS[this.stepIndex]!.id;
  }

  /** 1-based, for tests and the box: which of the steps the player is on. */
  get stepNumber(): number {
    return this.stepIndex + 1;
  }

  /** The uncle's line on screen, or null once he's said everything. */
  get line(): string | null {
    if (this.finished) return null;
    return textOf(this.current)?.replace('{regular}', this.regularName || 'my regular') ?? null;
  }

  /**
   * SCREAM-171: the uncle has the wheel from when he walks to the cab until the truck is in
   * the pump bay: no steering, and nobody but his regular comes out.
   */
  get uncleDriving(): boolean {
    const step = this.step;
    return (
      step === 'drive' ||
      step === 'regular' ||
      step === 'sale' ||
      (step === 'pump' && !this.driven.has('toPump')) ||
      (step === 'home' && !this.driven.has('toHome'))
    );
  }

  /** Which leg he should be driving now, if any (and not yet finished). */
  get legToDrive(): UncleLeg | null {
    if (this.step === 'drive' && !this.driven.has('toRegular')) return 'toRegular';
    if (this.step === 'pump' && !this.driven.has('toPump')) return 'toPump';
    if (this.step === 'home' && !this.driven.has('toHome')) return 'toHome';
    return null;
  }


  /** SCREAM-187: his line about the $50 he left on the truck is on screen. */
  get givesCash(): boolean {
    const line = this.current;
    return typeof line === 'object' && !!line.gift;
  }

  finishLeg(leg: UncleLeg): void {
    this.driven.add(leg);
  }

  private get current(): Line | undefined {
    return this.finished ? undefined : TUTORIAL_STEPS[this.stepIndex]!.lines[this.lineIndex];
  }

  /** SCREAM-170: what the line on screen is waiting for the player to do, if anything. */
  get waitingFor(): TutorialSignal | null {
    const line = this.current;
    return typeof line === 'object' ? (line.until ?? null) : null;
  }

  /** SCREAM-172: the sales window waits to open until his line has been read. */
  get holdsWindow(): boolean {
    const line = this.current;
    return !this.released && typeof line === 'object' && !!line.gate;
  }

  /** SCREAM-172: the sale's clocks (her wait, the tip) wait until his line has been read. */
  get holdsSale(): boolean {
    const line = this.current;
    return !this.released && typeof line === 'object' && !!line.hold;
  }

  /**
   * His gating or holding line has been read (clicked, timed out, or the player acted). A gate
   * stays up (until its signal); a hold moves on to the next line.
   */
  release(): void {
    const line = this.current;
    if (this.released || typeof line !== 'object' || !(line.gate || line.hold)) return;
    this.releasedLine = `${this.stepIndex}:${this.lineIndex}`;
    if (line.hold && this.moreLines) this.lineIndex++;
    this.emit(TutorialEvents.Changed);
  }

  /** SCREAM-172: the player went to the cooler: past the R tip (it's no use there). */
  skipRepeatTip(): void {
    if (this.step !== 'sale') return;
    const repeatAt = TUTORIAL_STEPS[this.stepIndex]!.lines.findIndex((l) => typeof l === 'object' && l.point === 'repeat');
    if (repeatAt < 0 || this.lineIndex > repeatAt) return;
    this.lineIndex = repeatAt + 1;
    this.emit(TutorialEvents.Changed);
  }

  /** SCREAM-170: what the line on screen is about, for the screen to outline. */
  get pointAt(): TutorialPoint | null {
    const line = this.current;
    return typeof line === 'object' ? (line.point ?? null) : null;
  }

  /** Which line of this step is on screen (0 is the first), and how many lines it has. */
  get lineNumber(): number {
    return this.lineIndex;
  }

  get lineCount(): number {
    return this.finished ? 0 : TUTORIAL_STEPS[this.stepIndex]!.lines.length;
  }

  /** True if there's another line in this step after the one on screen. */
  get moreLines(): boolean {
    return !this.finished && this.lineIndex < TUTORIAL_STEPS[this.stepIndex]!.lines.length - 1;
  }

  /** True if this step is only the uncle talking: it finishes once its lines are read. */
  get talkOnly(): boolean {
    return !this.finished && !TUTORIAL_STEPS[this.stepIndex]!.doneWhen;
  }

  /** The player read the line (clicked it, or it timed out): show the next one, or finish a talk-only step. */
  nextLine(): void {
    if (this.finished) return;
    if (this.holdsWindow || this.holdsSale) return this.release();
    if (this.waitingFor) return;
    const step = TUTORIAL_STEPS[this.stepIndex]!;
    if (this.moreLines) this.lineIndex++;
    else if (!step.doneWhen) return this.advance();
    else return;
    this.emit(TutorialEvents.Changed);
  }

  /**
   * The game reports something. If it finishes the current step, on to the next step; if it's
   * what the line on screen is waiting for, on to the next line.
   */
  signal(what: TutorialSignal): void {
    if (this.finished) return;
    if (TUTORIAL_STEPS[this.stepIndex]!.doneWhen === what) return this.advance();
    // SCREAM-171: a sale that ends without being paid (the regular gave up, or he drove off)
    // still ends that part: on to the gas.
    if (what === 'saleClosed' && (this.step === 'regular' || this.step === 'sale')) {
      this.stepIndex = TUTORIAL_STEPS.findIndex((st) => st.id === 'pump');
      this.lineIndex = 0;
      this.emit(TutorialEvents.Changed);
      return;
    }
    if (this.waitingFor !== what) return;
    if (this.moreLines) {
      this.lineIndex++;
      this.emit(TutorialEvents.Changed);
    } else this.advance();
  }

  private advance(): void {
    if (this.stepIndex >= TUTORIAL_STEPS.length - 1) this.finished = true;
    else {
      this.stepIndex++;
      this.lineIndex = 0;
    }
    this.emit(TutorialEvents.Changed);
  }
}

/** Saved in the browser once a player has finished an evening with the uncle (SCREAM-169's skip; SCREAM-175 later). */
const DONE_KEY = 'icemachine.tutorial.done.v1';

export function tutorialDone(): boolean {
  try {
    return window.localStorage.getItem(DONE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markTutorialDone(): void {
  try {
    window.localStorage.setItem(DONE_KEY, '1');
  } catch {
    // Storage blocked: the uncle just shows up again next time.
  }
}
