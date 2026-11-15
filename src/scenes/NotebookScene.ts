import * as Phaser from 'phaser';
import { getEvening, returnToTruck, SceneKeys } from '../flow';
import { NOTEBOOK_ENTRIES_PER_PAGE } from '../config/tuning';
import { notebookPages, type NotebookEntry } from '../state/Notebook';
import { weekdayName } from '../state/Residents';
import { loadFlavourArt, MARKER_FONT } from '../ui/flavourArt';
import { showLoadingWhileLoading } from './LoadingScene';

// SCREAM-245 (PO, November 14, notepad sketch): the Handy Notebook, opened from the truck view
// ("Notebook should be a new clickable item in the truck view"). Every hint customers have said
// at the window since it was bought, newest first, a few to a page. Reading only: nothing here
// changes the evening, so it also opens while looking inside from the road (Tab).
// Placeholder art by engineering (a spiral pad on the truck's floor colour) until the PO draws it.

const INK = '#2b1d10';
const PAPER = 0xfff8d6;
const RULE = 0xb9d3ea;
/** The page on the 960 x 540 screen. The top strip is left to the clock and the money. */
const PAGE = { x: 180, y: 56, w: 600, h: 438 };

export const NOTEBOOK_EMPTY_TEXT = 'Nothing written down yet. Hints customers give you at the window will be written here.';
const HINT_ONE_PAGE = 'B: Back To The Truck';
const HINT_PAGES = '← → Turn The Page    B: Back To The Truck';

export class NotebookScene extends Phaser.Scene {
  /** Test hooks: the pages (newest entry first), the page shown, and the words on it, top to bottom. */
  pages: NotebookEntry[][] = [[]];
  page = 0;
  lines: string[] = [];
  pageLabel!: Phaser.GameObjects.Text;
  private written: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SceneKeys.Notebook);
  }

  preload(): void {
    loadFlavourArt(this); // the marker font
    showLoadingWhileLoading(this);
  }

  create(): void {
    const { width, height } = this.scale;
    const evening = getEvening(this);
    this.pages = notebookPages(evening.notebook, NOTEBOOK_ENTRIES_PER_PAGE);
    this.page = 0;
    this.written = [];

    this.add.rectangle(0, 0, width, height, 0x6b6f76).setOrigin(0, 0);
    // The pad: a blue back cover, the page with its ruled lines, and the rings along the top.
    const g = this.add.graphics();
    g.fillStyle(0x2884d6, 1).fillRoundedRect(PAGE.x + 10, PAGE.y + 10, PAGE.w, PAGE.h, 8);
    g.lineStyle(5, 0x2b1d10, 1).strokeRoundedRect(PAGE.x + 10, PAGE.y + 10, PAGE.w, PAGE.h, 8);
    g.fillStyle(PAPER, 1).fillRoundedRect(PAGE.x, PAGE.y, PAGE.w, PAGE.h, 8);
    g.lineStyle(5, 0x2b1d10, 1).strokeRoundedRect(PAGE.x, PAGE.y, PAGE.w, PAGE.h, 8);
    g.lineStyle(1, RULE, 1);
    for (let y = PAGE.y + 86; y < PAGE.y + PAGE.h - 16; y += 22) g.lineBetween(PAGE.x + 16, y, PAGE.x + PAGE.w - 16, y);
    for (let i = 0; i < 14; i++) {
      const x = PAGE.x + 34 + i * 41;
      g.fillStyle(0x4b4f55, 1).fillCircle(x, PAGE.y + 14, 5);
      g.lineStyle(4, 0x2b1d10, 1).strokeEllipse(x, PAGE.y + 4, 10, 30);
    }
    this.add.text(PAGE.x + PAGE.w / 2, PAGE.y + 50, 'HANDY NOTEBOOK', { fontFamily: MARKER_FONT, fontSize: '28px', color: INK }).setOrigin(0.5);
    this.pageLabel = this.add
      .text(PAGE.x + PAGE.w - 22, PAGE.y + PAGE.h - 20, '', { fontFamily: 'monospace', fontSize: '14px', color: INK })
      .setOrigin(1, 0.5);

    this.add.rectangle(0, height - 34, width, 34, 0x000000, 0.45).setOrigin(0, 0);
    this.add
      .text(width / 2, height - 17, this.pages.length > 1 ? HINT_PAGES : HINT_ONE_PAGE, { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' })
      .setOrigin(0.5);

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-LEFT', () => this.turn(-1));
    keyboard?.on('keydown-A', () => this.turn(-1));
    keyboard?.on('keydown-RIGHT', () => this.turn(1));
    keyboard?.on('keydown-D', () => this.turn(1));
    for (const key of ['B', 'BACKSPACE', 'ENTER', 'SPACE']) keyboard?.on(`keydown-${key}`, () => this.back());
    // A click on the left or right half of the page turns it; anywhere else goes back.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const onPage = pointer.x >= PAGE.x && pointer.x <= PAGE.x + PAGE.w && pointer.y >= PAGE.y && pointer.y <= PAGE.y + PAGE.h;
      if (!onPage) this.back();
      else if (this.pages.length > 1) this.turn(pointer.x < PAGE.x + PAGE.w / 2 ? -1 : 1);
    });

    this.show();
  }

  /** Turns to the next (1) or the previous (-1) page; stays put at either end. */
  turn(step: -1 | 1): void {
    const next = Phaser.Math.Clamp(this.page + step, 0, this.pages.length - 1);
    if (next === this.page) return;
    this.page = next;
    this.show();
  }

  back(): void {
    returnToTruck(this, 'notebook', false);
  }

  private show(): void {
    for (const o of this.written) o.destroy();
    this.written = [];
    this.lines = [];
    const entries = this.pages[this.page] ?? [];
    const left = PAGE.x + 28;
    const wrap = PAGE.w - 56;
    let y = PAGE.y + 84;
    if (entries.length === 0) {
      this.lines.push(NOTEBOOK_EMPTY_TEXT);
      this.written.push(this.add.text(left, y + 8, NOTEBOOK_EMPTY_TEXT, { fontFamily: 'monospace', fontSize: '16px', color: INK, wordWrap: { width: wrap } }));
    }
    for (const entry of entries) {
      const head = `${weekdayName(entry.day)} Day ${entry.day}: ${entry.who}`;
      const title = this.add.text(left, y, head, { fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold', color: '#1f5f9e' });
      const words = this.add.text(left, y + 20, entry.text, { fontFamily: 'monospace', fontSize: '14px', color: INK, wordWrap: { width: wrap }, lineSpacing: 2 });
      this.written.push(title, words);
      this.lines.push(head, entry.text);
      y += 20 + Math.max(words.height, 18) + 14;
    }
    this.pageLabel.setText(this.pages.length > 1 ? `Page ${this.page + 1} Of ${this.pages.length}` : '');
  }
}
