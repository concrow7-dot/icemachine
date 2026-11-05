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
  | 'customerAtWindow'
  | 'salePaid'
  | 'saleClosed'
  | 'gasBought';

export type TutorialStepId = 'stock' | 'drive' | 'regular' | 'sale' | 'tomorrow' | 'pump' | 'alone';

/** SCREAM-170: what a line is about, so the screen can outline it (the cooler's clipboard, its menu, Buy Stock). */
export type TutorialPoint = 'clipboard' | 'menu' | 'buy';

/**
 * One of the uncle's lines. A plain line moves on when read (clicked, or after a while).
 * SCREAM-170: a line with `until` waits for the player to do what it says.
 */
type Line = string | { text: string; until?: TutorialSignal; point?: TutorialPoint };

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
      { text: 'When you\'re ready, "Buy Stock" and we\'ll hit the road!', point: 'buy' },
    ],
    doneWhen: 'stockBought',
  },
  {
    id: 'drive',
    // SCREAM-170: the PO's line back inside the truck (SCREAM-171 has him walk to the cab
    // and drive). Until then, the second line (engineering's draft) sends the player.
    lines: [
      "Let's go get some gas, and then you'll be ready to go.",
      "Head for the driver's seat. The station's on Park Ave.",
    ],
    doneWhen: 'customerAtWindow',
  },
  { id: 'regular', lines: ['Look who it is: one of my regulars!'] },
  {
    id: 'sale',
    lines: ['Remember the order, fill it from the cooler, then add up the price.'],
    doneWhen: 'salePaid',
  },
  { id: 'tomorrow', lines: ["Regulars come back. They'll want you tomorrow too."], doneWhen: 'saleClosed' },
  {
    id: 'pump',
    lines: ['Now, that gas. Pull into the bay by the pump and fill her up.'],
    doneWhen: 'gasBought',
  },
  { id: 'alone', lines: ["That's the job. The rest of the evening is yours. Sell all you can before 8!"] },
];

const textOf = (line: Line | undefined): string | null => (line === undefined ? null : typeof line === 'string' ? line : line.text);

export const TutorialEvents = {
  /** () — the uncle's line on screen changed (a new step or the next line), or he's done. */
  Changed: 'tutorial-changed',
} as const;

/** One evening's run through the uncle's steps. Only made for the tutorial map with the uncle on. */
export class TutorialRun extends Phaser.Events.EventEmitter {
  private stepIndex = 0;
  private lineIndex = 0;
  private finished = false;

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
    return textOf(this.current);
  }

  private get current(): Line | undefined {
    return this.finished ? undefined : TUTORIAL_STEPS[this.stepIndex]!.lines[this.lineIndex];
  }

  /** SCREAM-170: what the line on screen is waiting for the player to do, if anything. */
  get waitingFor(): TutorialSignal | null {
    const line = this.current;
    return typeof line === 'object' ? (line.until ?? null) : null;
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
    if (this.finished || this.waitingFor) return;
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
