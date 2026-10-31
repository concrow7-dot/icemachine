import * as Phaser from 'phaser';
import { BIKE_PRICE_CENTS } from '../config/tuning';
import { clearStory, getEvening, getStory, SceneKeys, startEvening } from '../flow';
import { addHighScore, HIGH_SCORE_COUNT, isHighScore, loadHighScores, type HighScore, type ScoreTable } from '../state/HighScores';
import { formatMoney } from '../util/format';

// Issue #16: the results screen. The evening's breakdown on the left, and a
// pinball-style top 5 on the right. A score that makes the top 5 (negative
// ones too) asks for 3 initials first: ↑ ↓ change a letter, ← → move, or just
// type them, Enter to save.
// SCREAM-18 (PO, October 31): at the end of a Story run this screen shows the
// whole run's stats and the Story table (score: cash at the end of the run).
// Then you start a new game: Enter and Esc both go to the title.

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MONO = 'monospace';

export class ResultsScene extends Phaser.Scene {
  private profit = 0;
  private table: ScoreTable = 'quick';
  private entering = false;
  private initials = [0, 0, 0];
  private cursor = 0;
  private letterTexts: Phaser.GameObjects.Text[] = [];
  private entryGroup: Phaser.GameObjects.GameObject[] = [];
  private tableGroup: Phaser.GameObjects.GameObject[] = [];
  private footer!: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKeys.Results);
  }

  create(data?: { story?: boolean }): void {
    const { width, height } = this.scale;
    const story = data?.story ? getStory(this) : null;
    this.table = story ? 'story' : 'quick';
    this.initials = [0, 0, 0];
    this.cursor = 0;
    this.letterTexts = [];
    this.entryGroup = [];
    this.tableGroup = [];

    this.footer = this.add
      .text(width / 2, height - 30, '', { fontFamily: MONO, fontSize: '20px', color: '#8a9bb3' })
      .setOrigin(0.5);
    if (story) this.showRunStats(story.totals, story.cashCents, story.days, story.canAffordBike);
    else this.showTonight();

    this.entering = isHighScore(this.profit, loadHighScores(this.table));
    if (this.entering) this.showEntry();
    else this.showTable(loadHighScores(this.table), -1);

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.onKey(event));
  }

  /** Quick play: tonight's breakdown; the score is tonight's profit. */
  private showTonight(): void {
    const { width } = this.scale;
    const evening = getEvening(this);
    this.profit = evening.profitCents;
    this.add.text(width / 2, 50, 'THE SUN HAS SET', { fontFamily: MONO, fontSize: '36px', color: '#ffe8a3' }).setOrigin(0.5);

    // ---- Tonight's breakdown ----
    const b = evening.breakdown;
    const rows: [string, number, string][] = [
      ['Sales', b.salesCents, '#c8f7c5'],
      ['Tips', b.tipsCents, '#c8f7c5'],
      ['Stock', -b.stockCents, '#ff9c9c'],
      ['Damage', -b.damageCents, '#ff9c9c'],
    ];
    this.add.text(110, 110, 'TONIGHT', { fontFamily: MONO, fontSize: '18px', color: '#8a9bb3' });
    rows.forEach(([label, cents, colour], i) => {
      const y = 145 + i * 34;
      this.add.text(110, y, label, { fontFamily: MONO, fontSize: '22px', color: '#d6deeb' });
      this.add
        .text(420, y, cents < 0 ? `-${formatMoney(-cents)}` : formatMoney(cents), { fontFamily: MONO, fontSize: '22px', color: colour })
        .setOrigin(1, 0);
    });
    this.add.rectangle(110, 288, 310, 2, 0x8a9bb3).setOrigin(0, 0.5);
    this.add.text(110, 302, "Tonight's profit", { fontFamily: MONO, fontSize: '22px', color: '#ffffff' });
    this.add
      .text(420, 334, formatMoney(this.profit), { fontFamily: MONO, fontSize: '36px', color: this.profit < 0 ? '#ff9c9c' : '#c8f7c5' })
      .setOrigin(1, 0);
    this.add.text(110, 392, `Cash on hand: ${formatMoney(evening.moneyCents)}`, { fontFamily: MONO, fontSize: '18px', color: '#8a9bb3' });
  }

  /** SCREAM-18: the end of a Story run. The whole run's takings; the score is the cash at the end. */
  private showRunStats(
    t: { salesCents: number; tipsCents: number; stockCents: number; damageCents: number },
    cashCents: number,
    days: number,
    bike: boolean,
  ): void {
    const { width } = this.scale;
    this.profit = cashCents;
    this.add.text(width / 2, 50, 'STORY COMPLETE', { fontFamily: MONO, fontSize: '36px', color: '#ffe8a3' }).setOrigin(0.5);
    this.add.text(110, 110, `${days} DAYS`, { fontFamily: MONO, fontSize: '18px', color: '#8a9bb3' });
    const rows: [string, number, string][] = [
      ['Sales', t.salesCents, '#c8f7c5'],
      ['Tips', t.tipsCents, '#c8f7c5'],
      ['Stock', -t.stockCents, '#ff9c9c'],
      ['Damage', -t.damageCents, '#ff9c9c'],
    ];
    rows.forEach(([label, cents, colour], i) => {
      const y = 145 + i * 34;
      this.add.text(110, y, label, { fontFamily: MONO, fontSize: '22px', color: '#d6deeb' });
      this.add.text(420, y, formatMoney(cents), { fontFamily: MONO, fontSize: '22px', color: colour }).setOrigin(1, 0);
    });
    this.add.rectangle(110, 288, 310, 2, 0x8a9bb3).setOrigin(0, 0.5);
    this.add.text(110, 302, 'Final cash', { fontFamily: MONO, fontSize: '22px', color: '#ffffff' });
    this.add
      .text(420, 334, formatMoney(cashCents), { fontFamily: MONO, fontSize: '36px', color: cashCents < 0 ? '#ff9c9c' : '#c8f7c5' })
      .setOrigin(1, 0);
    this.add.text(110, 392, bike ? `New bike (${formatMoney(BIKE_PRICE_CENTS)}): you can buy it!` : `New bike (${formatMoney(BIKE_PRICE_CENTS)}): not this time`, {
      fontFamily: MONO,
      fontSize: '18px',
      color: bike ? '#ffe066' : '#8a9bb3',
    });
  }

  private onKey(event: KeyboardEvent): void {
    if (!this.entering) {
      if (this.table === 'story') {
        // SCREAM-18: the run is over; a new game starts from the title.
        if (event.key === 'Enter' || event.key === 'Escape') {
          clearStory(this);
          this.scene.start(SceneKeys.Title);
        }
        return;
      }
      if (event.key === 'Enter') startEvening(this);
      if (event.key === 'Escape') this.scene.start(SceneKeys.Title);
      return;
    }
    const key = event.key;
    if (key === 'ArrowUp') this.changeLetter(1);
    else if (key === 'ArrowDown') this.changeLetter(-1);
    else if (key === 'ArrowLeft') this.cursor = Math.max(0, this.cursor - 1);
    else if (key === 'ArrowRight') this.cursor = Math.min(2, this.cursor + 1);
    else if (key === 'Backspace') this.cursor = Math.max(0, this.cursor - 1);
    else if (key === 'Enter') return this.save();
    else if (/^[a-zA-Z]$/.test(key)) {
      this.initials[this.cursor] = LETTERS.indexOf(key.toUpperCase());
      this.cursor = Math.min(2, this.cursor + 1);
    }
    this.refreshEntry();
  }

  private changeLetter(step: number): void {
    const current = this.initials[this.cursor] ?? 0;
    this.initials[this.cursor] = (current + step + LETTERS.length) % LETTERS.length;
  }

  private get initialsText(): string {
    return this.initials.map((i) => LETTERS[i] ?? 'A').join('');
  }

  // ---- Entering initials ----

  private showEntry(): void {
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (this.entryGroup.push(o), o);
    add(this.add.text(700, 120, 'NEW HIGH SCORE!', { fontFamily: MONO, fontSize: '30px', color: '#ffe066' }).setOrigin(0.5));
    add(this.add.text(700, 165, 'Enter your initials', { fontFamily: MONO, fontSize: '20px', color: '#d6deeb' }).setOrigin(0.5));
    for (let i = 0; i < 3; i++) {
      const box = add(this.add.rectangle(630 + i * 70, 245, 56, 72, 0x2a3446).setStrokeStyle(3, 0x8a9bb3));
      const letter = add(this.add.text(630 + i * 70, 245, 'A', { fontFamily: MONO, fontSize: '48px', color: '#ffffff' }).setOrigin(0.5));
      this.letterTexts.push(letter);
      box.setData('index', i);
    }
    add(
      this.add
        .text(700, 330, '↑ ↓ change   ← → move\nor type letters   Enter: save', {
          fontFamily: MONO,
          fontSize: '16px',
          color: '#8a9bb3',
          align: 'center',
        })
        .setOrigin(0.5),
    );
    this.footer.setText('');
    this.refreshEntry();
  }

  private refreshEntry(): void {
    this.letterTexts.forEach((t, i) => {
      t.setText(LETTERS[this.initials[i] ?? 0] ?? 'A');
      t.setColor(i === this.cursor ? '#ffe066' : '#ffffff');
    });
    this.entryGroup.forEach((o) => {
      if (o instanceof Phaser.GameObjects.Rectangle && o.getData('index') !== undefined) {
        const selected = o.getData('index') === this.cursor;
        o.setStrokeStyle(selected ? 5 : 3, selected ? 0xffe066 : 0x8a9bb3);
      }
    });
  }

  private save(): void {
    const { scores, rank } = addHighScore(this.initialsText, this.profit, new Date(), this.table);
    this.entering = false;
    this.entryGroup.forEach((o) => o.destroy());
    this.entryGroup = [];
    this.showTable(scores, rank);
  }

  // ---- The table ----

  private showTable(scores: readonly HighScore[], highlight: number): void {
    this.tableGroup.forEach((o) => o.destroy());
    this.tableGroup = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => (this.tableGroup.push(o), o);

    add(
      this.add
        .text(700, 115, this.table === 'story' ? 'STORY HIGH SCORES' : 'HIGH SCORES', { fontFamily: MONO, fontSize: '26px', color: '#ffe8a3' })
        .setOrigin(0.5),
    );
    for (let i = 0; i < HIGH_SCORE_COUNT; i++) {
      const y = 165 + i * 44;
      const s = scores[i];
      const isNew = i === highlight;
      if (isNew) add(this.add.rectangle(700, y + 12, 400, 38, 0xffe066, 0.25).setStrokeStyle(2, 0xffe066));
      const colour = isNew ? '#ffe066' : s ? '#d6deeb' : '#4d5a70';
      const date = s ? new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
      add(this.add.text(515, y, `${i + 1}.`, { fontFamily: MONO, fontSize: '22px', color: colour }));
      add(this.add.text(565, y, s ? s.initials : '---', { fontFamily: MONO, fontSize: '22px', color: colour }));
      add(
        this.add
          .text(790, y, s ? (s.scoreCents < 0 ? `-${formatMoney(-s.scoreCents)}` : formatMoney(s.scoreCents)) : '', {
            fontFamily: MONO,
            fontSize: '22px',
            color: colour,
          })
          .setOrigin(1, 0),
      );
      add(this.add.text(810, y + 3, date, { fontFamily: MONO, fontSize: '16px', color: colour }));
    }
    if (!this.entering && highlight === -1 && isHighScore(this.profit, scores) === false) {
      add(
        this.add
          .text(700, 400, 'Not in the top 5 this time', { fontFamily: MONO, fontSize: '16px', color: '#8a9bb3' })
          .setOrigin(0.5),
      );
    }
    this.footer.setText(this.table === 'story' ? 'Enter: back to the title' : 'Enter: new evening    Esc: title');
  }
}
