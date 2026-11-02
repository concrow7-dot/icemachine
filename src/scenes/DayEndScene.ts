import * as Phaser from 'phaser';
import { clearStory, getEvening, getStory, SceneKeys, startStoryEvening } from '../flow';
import type { DayOutcome } from '../state/StoryRun';
import { formatMoney } from '../util/format';
import { BIKE_PRICE_CENTS } from '../config/tuning';

// SCREAM-19 (PO, October 31): the end of an evening in Story mode. Tonight's
// takings and what you carry into tomorrow: the wallet and the ice cream left
// in the cooler. Out of money is game over. After the last evening the run is
// complete (SCREAM-18 adds the story's ending and its high score table).
// SCREAM-17: the run is saved here, or the save cleared when the run ends.

const MONO = 'monospace';
/** Space between the breakdown's rows: 27 px since Gas made it five (SCREAM-22). */
const ROW_GAP = 27;

export class DayEndScene extends Phaser.Scene {
  private outcome: DayOutcome = 'next';

  constructor() {
    super(SceneKeys.DayEnd);
  }

  create(): void {
    const { width, height } = this.scale;
    const evening = getEvening(this);
    const story = getStory(this);
    if (!story) {
      this.scene.start(SceneKeys.Title);
      return;
    }
    const finishedDay = story.day;
    this.outcome = story.finishDay(evening);

    const heading =
      this.outcome === 'broke' ? 'GAME OVER' : this.outcome === 'complete' ? 'STORY COMPLETE' : `END OF DAY ${finishedDay}`;
    this.add
      .text(width / 2, 50, heading, { fontFamily: MONO, fontSize: '36px', color: this.outcome === 'broke' ? '#ff9c9c' : '#ffe8a3' })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 92, `Day ${finishedDay} of ${story.days}`, { fontFamily: MONO, fontSize: '18px', color: '#8a9bb3' })
      .setOrigin(0.5);

    // ---- Tonight ----
    const b = evening.breakdown;
    const rows: [string, number, string][] = [
      ['Sales', b.salesCents, '#c8f7c5'],
      ['Tips', b.tipsCents, '#c8f7c5'],
      ['Stock', -b.stockCents, '#ff9c9c'],
      ['Gas', -b.gasCents, '#ff9c9c'],
      ['Damage', -b.damageCents, '#ff9c9c'],
    ];
    this.add.text(110, 130, 'TONIGHT', { fontFamily: MONO, fontSize: '18px', color: '#8a9bb3' });
    rows.forEach(([label, cents, colour], i) => {
      const y = 165 + i * ROW_GAP;
      this.add.text(110, y, label, { fontFamily: MONO, fontSize: '22px', color: '#d6deeb' });
      this.add.text(420, y, formatMoney(cents), { fontFamily: MONO, fontSize: '22px', color: colour }).setOrigin(1, 0);
    });
    this.add.rectangle(110, 308, 310, 2, 0x8a9bb3).setOrigin(0, 0.5);
    this.add.text(110, 322, "Tonight's profit", { fontFamily: MONO, fontSize: '22px', color: '#ffffff' });
    const profit = evening.profitCents;
    this.add
      .text(420, 354, formatMoney(profit), { fontFamily: MONO, fontSize: '32px', color: profit < 0 ? '#ff9c9c' : '#c8f7c5' })
      .setOrigin(1, 0);

    // ---- The wallet and the cooler ----
    this.add.text(540, 130, 'WALLET', { fontFamily: MONO, fontSize: '18px', color: '#8a9bb3' });
    this.add.text(540, 160, formatMoney(evening.moneyCents), {
      fontFamily: MONO,
      fontSize: '40px',
      color: evening.moneyCents < 0 ? '#ff9c9c' : '#c8f7c5',
    });
    this.drawBikeBadge(width - 120, 95);

    const stock = evening.stockLeft;
    this.add.text(540, 230, `Ice creams left: ${stock}`, { fontFamily: MONO, fontSize: '20px', color: '#d6deeb' });

    const message =
      this.outcome === 'broke'
        ? "You're out of money.\nThe truck stays parked."
        : this.outcome === 'complete'
          ? story.canAffordBike // SCREAM-18: the bike (placeholder wording, SCREAM-76)
            ? `School starts tomorrow.\nYou can buy the bike!`
            : `School starts tomorrow.\nYou're ${formatMoney(BIKE_PRICE_CENTS - story.cashCents)} short of the bike.`
          : (stock > 0 ? 'Your cash and ice cream\ncarry over to tomorrow.' : 'Your cash carries over to tomorrow.') +
            '\n\nGame saved.'; // SCREAM-17: saved at the end of each evening
    this.add.text(540, 280, message, { fontFamily: MONO, fontSize: '18px', color: '#d6deeb', lineSpacing: 6 });

    const footer =
      this.outcome === 'next' ? `Enter: start day ${story.day}` : this.outcome === 'complete' ? 'Enter: Story high scores' : 'Enter: back to the title';
    this.add.text(width / 2, height - 30, footer, { fontFamily: MONO, fontSize: '20px', color: '#8a9bb3' }).setOrigin(0.5);

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return;
      if (this.outcome === 'next') startStoryEvening(this);
      else if (this.outcome === 'complete') this.scene.start(SceneKeys.Results, { story: true }); // SCREAM-18
      else {
        clearStory(this);
        this.scene.start(SceneKeys.Title);
      }
    });
  }

  /**
   * SCREAM-18 (PO, November 2, from his sketch): the goal, "Bike $200", in a
   * red starburst in the top-right corner. Shown here only, not on the top bar.
   */
  private drawBikeBadge(x: number, y: number): void {
    const points: Phaser.Math.Vector2[] = [];
    const spikes = 14;
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? 82 : 60;
      points.push(new Phaser.Math.Vector2(x + Math.cos(angle) * r * 1.15, y + Math.sin(angle) * r * 0.8));
    }
    const g = this.add.graphics();
    g.fillStyle(0x3a1620, 1);
    g.fillPoints(points, true);
    g.lineStyle(3, 0xff4d4d, 1);
    g.strokePoints(points, true);
    this.add
      .text(x, y, `Bike\n${formatMoney(BIKE_PRICE_CENTS)}`, {
        fontFamily: MONO,
        fontSize: '24px',
        color: '#ff7a7a',
        align: 'center',
        lineSpacing: 2,
      })
      .setOrigin(0.5)
      .setName('bike-badge');
  }
}
