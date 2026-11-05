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

/** Things the evening reports that can finish a step. */
export type TutorialSignal = 'setOff' | 'customerAtWindow' | 'salePaid' | 'saleClosed' | 'gasBought';

export type TutorialStepId = 'stock' | 'drive' | 'regular' | 'sale' | 'tomorrow' | 'pump' | 'alone';

type Step = {
  id: TutorialStepId;
  /** The uncle's lines, shown one after another. The last one stays up until the step is done. */
  lines: string[];
  /** What finishes the step. Without one, the step is done once its lines have been read. */
  doneWhen?: TutorialSignal;
};

/** The uncle's lines: the PO's opening lines, then engineering's DRAFTS for the PO to rewrite. */
export const TUTORIAL_STEPS: readonly Step[] = [
  {
    id: 'stock',
    // SCREAM-177 (PO's note, November 5): his first three lines, in the truck. The third
    // asks the player to click the cooler; the last line (engineering's draft) is at the cooler.
    lines: [
      "Thanks for helping out, kiddo. I can't work with this foot.",
      "I'll help you get set up, and then you're on your own.",
      "Let's start by selecting your stock. Click on the cooler.",
      "When you're happy with your stock, head for the driver's seat.",
    ],
    doneWhen: 'setOff',
  },
  {
    id: 'drive',
    lines: [
      "The gas is low. Let's head for the station on Park Ave.",
      'Keep your ears open on the way. People hear the music and come out.',
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
    return TUTORIAL_STEPS[this.stepIndex]!.lines[this.lineIndex] ?? null;
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
    const step = TUTORIAL_STEPS[this.stepIndex]!;
    if (this.moreLines) this.lineIndex++;
    else if (!step.doneWhen) return this.advance();
    else return;
    this.emit(TutorialEvents.Changed);
  }

  /** The evening reports something; if it's what the current step is waiting for, move on. */
  signal(what: TutorialSignal): void {
    if (this.finished || TUTORIAL_STEPS[this.stepIndex]!.doneWhen !== what) return;
    this.advance();
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
