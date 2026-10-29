import * as Phaser from 'phaser';
import { getEvening, SceneKeys, startEvening } from '../flow';
import { addHighScore, HIGH_SCORE_COUNT, isHighScore, loadHighScores, type HighScore } from '../state/HighScores';
import { formatMoney } from '../util/format';

// Issue #16: the results screen. The evening's breakdown on the left, and a
// pinball-style top 5 on the right. A score that makes the top 5 (negative
// ones too) asks for 3 initials first: ↑ ↓ change a letter, ← → move, or just
// type them, Enter to save.

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MONO = 'monospace';

export class ResultsScene extends Phaser.Scene {
  private profit = 0;
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

  create(): void {
    const { width, height } = this.scale;
    const evening = getEvening(this);
    this.profit = evening.profitCents;
    this.initials = [0, 0, 0];
    this.cursor = 0;
    this.letterTexts = [];
    this.entryGroup = [];
    this.tableGroup = [];

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

    this.footer = this.add
      .text(width / 2, height - 30, '', { fontFamily: MONO, fontSize: '20px', color: '#8a9bb3' })
      .setOrigin(0.5);

    this.entering = isHighScore(this.profit);
    if (this.entering) this.showEntry();
    else this.showTable(loadHighScores(), -1);

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.onKey(event));
  }

  private onKey(event: KeyboardEvent): void {
    if (!this.entering) {
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
    const { scores, rank } = addHighScore(this.initialsText, this.profit);
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

    add(this.add.text(700, 115, 'HIGH SCORES', { fontFamily: MONO, fontSize: '28px', color: '#ffe8a3' }).setOrigin(0.5));
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
    this.footer.setText('Enter: new evening    Esc: title screen');
  }
}
