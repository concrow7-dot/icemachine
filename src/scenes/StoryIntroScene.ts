import * as Phaser from 'phaser';
import { BIKE_PRICE_CENTS, STORY_DAYS, STORY_START_CASH_CENTS } from '../config/tuning';
import { SceneKeys, startStoryEvening } from '../flow';
import { fadeTo, loadStoryAhead } from './loadAhead';
import { formatMoney } from '../util/format';

// SCREAM-18 (PO, October 31): the story's intro, a plain text screen for now.
// The player is saving up for a new bike before school starts. The text below
// is engineering's PLACEHOLDER: the PO writes the real story and provides the
// art (SCREAM-76).

const MONO = 'monospace';

/** Placeholder story text (SCREAM-76 replaces it). */
function introText(): string {
  return [
    `School starts in ${STORY_DAYS} days.`,
    '',
    `There's a new bike in the shop window: ${formatMoney(BIKE_PRICE_CENTS)}.`,
    `You've got ${formatMoney(STORY_START_CASH_CENTS)} and an ice cream truck.`,
    '',
    'Sell enough ice cream before school starts',
    'to buy that bike.',
  ].join('\n');
}

export class StoryIntroScene extends Phaser.Scene {
  private leaving = false;

  constructor() {
    super(SceneKeys.StoryIntro);
  }

  create(): void {
    const { width, height } = this.scale;
    this.leaving = false;
    loadStoryAhead(this); // SCREAM-243: normally all loaded at the title already
    this.add.text(width / 2, 70, 'THE NEW BIKE', { fontFamily: MONO, fontSize: '36px', color: '#ffe8a3' }).setOrigin(0.5);
    this.add
      .text(width / 2, 250, introText(), { fontFamily: MONO, fontSize: '22px', color: '#d6deeb', align: 'center', lineSpacing: 10 })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height - 80, 'Placeholder text: the final story and art are coming (SCREAM-76)', {
        fontFamily: MONO,
        fontSize: '13px',
        color: '#6b7a93',
      })
      .setOrigin(0.5);
    this.add.text(width / 2, height - 36, 'Click Or Enter: Start Monday', { fontFamily: MONO, fontSize: '20px', color: '#8a9bb3' }).setOrigin(0.5).setName('begin-hint');

    // SCREAM-270 (PO, November 12): a left click begins, as well as Enter.
    const begin = () => {
      if (this.leaving) return;
      this.leaving = true;
      // SCREAM-243: a short fade into the game.
      fadeTo(this, [SceneKeys.Cooler, SceneKeys.Hud], () => startStoryEvening(this));
    };
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) begin();
    });
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      // A held key (Enter still down from the title screen) doesn't count.
      if (event.key === 'Enter' && !event.repeat) begin();
    });
  }
}
