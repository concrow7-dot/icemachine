import * as Phaser from 'phaser';
import { returnToTruck, SceneKeys } from '../flow';
import { DUMMY_NOTE_STATUS, DUMMY_NOTE_TEXT, POWER_UP_TREES } from '../config/powerUps';
import { BOARD_LAYOUT, nextNote, placeNotes, type BoardDirection, type PlacedNote } from '../state/PowerUpBoard';
import { loadFlavourArt, MARKER_FONT } from '../ui/flavourArt';
import { showLoadingWhileLoading } from './LoadingScene';
import { HIGHLIGHT, OUTLINE } from './TruckScene';

// SCREAM-267: the cork board above the cooler, opened from the hub (Story). The PO's reference
// was a game's skill map: three trees side by side, squares joined by lines. Here they are
// paper notes pinned to cork and joined by string: TRUCK, SPEAKER and SALES (the PO's names).
// This first version is a dummy to look at: nothing can be bought, and every note only marks a
// place. Placeholder art by engineering until the PO draws the board.

const INK = '#2b1d10';
const WOOD = 0x7a4a22;
const WOOD_DARK = 0x4f2e12;
const CORK = 0xc99a5b;
const CORK_SPECKS = [0xb5843f, 0xdcb277, 0xa87838];
/** The cork inside the wooden frame. The top strip is left to the clock and the money. */
const CORK_RECT = { x: 16, y: 50, w: 928, h: 444 };
const DETAIL = { x: 300, y: 454, w: 520, h: 60 };
const BACK = { x: 866, y: 454, w: 108, h: 44 };

export class PowerUpsScene extends Phaser.Scene {
  /** Test hooks: every note with its place, and the one highlighted. */
  notes: PlacedNote[] = [];
  selected = '';
  detailName!: Phaser.GameObjects.Text;
  detailStatus!: Phaser.GameObjects.Text;
  backButton!: Phaser.GameObjects.Zone;
  private ring!: Phaser.GameObjects.Graphics;

  constructor() {
    super(SceneKeys.PowerUps);
  }

  preload(): void {
    loadFlavourArt(this); // the marker font
    showLoadingWhileLoading(this);
  }

  create(): void {
    const { width, height } = this.scale;
    this.notes = placeNotes(POWER_UP_TREES);
    if (!this.notes.some((n) => n.id === this.selected)) this.selected = this.notes[0].id;

    this.drawBoard(width, height);
    this.drawStrings();
    for (const note of this.notes) this.addNote(note);
    POWER_UP_TREES.forEach((tree, t) => this.addTreeLabel(tree.name, BOARD_LAYOUT.treeX[t], tree.string));

    this.ring = this.add.graphics();
    this.addDetail();
    this.addBack();

    this.add.rectangle(0, height - 34, width, 34, 0x000000, 0.45).setOrigin(0, 0);
    this.add
      .text(width / 2, height - 17, '← ↑ ↓ → Look Around    B: Back To The Truck    Or Use The Mouse', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const keyboard = this.input.keyboard;
    const moves: [string, BoardDirection][] = [
      ['LEFT', 'left'], ['A', 'left'], ['RIGHT', 'right'], ['D', 'right'],
      ['UP', 'up'], ['W', 'up'], ['DOWN', 'down'], ['S', 'down'],
    ];
    for (const [key, direction] of moves) keyboard?.on(`keydown-${key}`, () => this.move(direction));
    keyboard?.on('keydown-B', () => this.back());
    keyboard?.on('keydown-BACKSPACE', () => this.back());

    this.refresh();
  }

  /** The wooden frame and the cork, with specks so it doesn't look like a flat colour. */
  private drawBoard(width: number, height: number): void {
    const g = this.add.graphics();
    g.fillStyle(WOOD, 1).fillRect(0, 0, width, height);
    g.lineStyle(4, WOOD_DARK, 1).strokeRect(CORK_RECT.x - 4, CORK_RECT.y - 4, CORK_RECT.w + 8, CORK_RECT.h + 8);
    g.fillStyle(CORK, 1).fillRect(CORK_RECT.x, CORK_RECT.y, CORK_RECT.w, CORK_RECT.h);
    // The same specks every time: a small fixed-seed generator, not Math.random.
    let seed = 267;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let i = 0; i < 700; i++) {
      g.fillStyle(CORK_SPECKS[i % CORK_SPECKS.length], 0.7);
      g.fillRect(CORK_RECT.x + next() * (CORK_RECT.w - 3), CORK_RECT.y + next() * (CORK_RECT.h - 3), 2 + next() * 2, 2 + next() * 2);
    }
  }

  /** A string from each note's pin up to the pin of every note it hangs from. */
  private drawStrings(): void {
    const g = this.add.graphics();
    const pin = (n: PlacedNote) => ({ x: n.x, y: n.y - BOARD_LAYOUT.note / 2 + 5 });
    for (const note of this.notes) {
      for (const id of note.from) {
        const parent = this.notes.find((n) => n.id === id);
        if (!parent) continue;
        const a = pin(parent);
        const b = pin(note);
        g.lineStyle(5, 0x000000, 0.18).lineBetween(a.x + 1, a.y + 2, b.x + 1, b.y + 2);
        g.lineStyle(3, POWER_UP_TREES[note.tree].string, 1).lineBetween(a.x, a.y, b.x, b.y);
      }
    }
  }

  /** One paper note: a little crooked, pinned at the top, with a question mark for now. */
  private addNote(note: PlacedNote): void {
    const tree = POWER_UP_TREES[note.tree];
    const size = BOARD_LAYOUT.note;
    const tilt = ((note.number * 7 + note.tree * 3) % 9) - 4; // -4 to 4 degrees, the same every time
    this.add.rectangle(note.x + 2, note.y + 3, size, size, 0x000000, 0.22).setAngle(tilt);
    this.add.rectangle(note.x, note.y, size, size, tree.paper, 1).setStrokeStyle(2, OUTLINE, 0.9).setAngle(tilt);
    this.add.text(note.x, note.y + 5, '?', { fontFamily: MARKER_FONT, fontSize: '24px', color: INK }).setOrigin(0.5).setAngle(tilt);
    const pinY = note.y - size / 2 + 5;
    this.add.circle(note.x + 1, pinY + 1, 5, 0x000000, 0.3);
    this.add.circle(note.x, pinY, 5, tree.string, 1).setStrokeStyle(1.5, OUTLINE, 1);
    this.add.circle(note.x - 1.5, pinY - 1.5, 1.5, 0xffffff, 0.8);

    const zone = this.add.zone(note.x - size / 2, note.y - size / 2, size, size).setOrigin(0, 0).setInteractive();
    zone.input!.cursor = 'pointer';
    const pick = () => {
      this.selected = note.id;
      this.refresh();
    };
    zone.on('pointerover', pick);
    zone.on('pointerdown', pick);
  }

  /** The tree's name on a strip of paper, pinned at both ends. */
  private addTreeLabel(name: string, x: number, pinColour: number): void {
    const y = 80;
    const w = 190;
    this.add.rectangle(x + 2, y + 3, w, 36, 0x000000, 0.22);
    this.add.rectangle(x, y, w, 36, 0xfffdf2, 1).setStrokeStyle(2, OUTLINE, 0.9);
    this.add.text(x, y + 1, name, { fontFamily: MARKER_FONT, fontSize: '24px', color: INK }).setOrigin(0.5).setName(`tree-${name}`);
    for (const px of [x - w / 2 + 10, x + w / 2 - 10]) {
      this.add.circle(px, y, 5, pinColour, 1).setStrokeStyle(1.5, OUTLINE, 1);
    }
  }

  /** The index card at the bottom that says what the highlighted note is. */
  private addDetail(): void {
    const { x, y, w, h } = DETAIL;
    this.add.rectangle(x + 2, y + 3, w, h, 0x000000, 0.22);
    this.add.rectangle(x, y, w, h, 0xfffdf2, 1).setStrokeStyle(2, OUTLINE, 0.9);
    this.detailName = this.add.text(x - w / 2 + 16, y - 13, '', { fontFamily: MARKER_FONT, fontSize: '22px', color: INK }).setOrigin(0, 0.5);
    this.detailStatus = this.add
      .text(x + w / 2 - 16, y - 13, DUMMY_NOTE_STATUS, { fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold', color: '#8a2a1c' })
      .setOrigin(1, 0.5);
    this.add.text(x - w / 2 + 16, y + 15, DUMMY_NOTE_TEXT, { fontFamily: 'monospace', fontSize: '14px', color: INK }).setOrigin(0, 0.5);
  }

  private addBack(): void {
    const { x, y, w, h } = BACK;
    this.add.rectangle(x + 2, y + 3, w, h, 0x000000, 0.22);
    this.add.rectangle(x, y, w, h, HIGHLIGHT, 1).setStrokeStyle(2, OUTLINE, 0.9);
    this.add.text(x, y, 'BACK', { fontFamily: 'monospace', fontSize: '20px', fontStyle: 'bold', color: INK }).setOrigin(0.5);
    this.backButton = this.add.zone(x - w / 2, y - h / 2, w, h).setOrigin(0, 0).setInteractive();
    this.backButton.input!.cursor = 'pointer';
    this.backButton.on('pointerdown', () => this.back());
  }

  private move(direction: BoardDirection): void {
    this.selected = nextNote(this.notes, this.selected, direction);
    this.refresh();
  }

  /** Back to the hub with the board still highlighted. */
  private back(): void {
    returnToTruck(this, 'menu');
  }

  private refresh(): void {
    const note = this.notes.find((n) => n.id === this.selected);
    this.ring.clear();
    if (!note) return;
    const half = BOARD_LAYOUT.note / 2 + 6;
    this.ring.lineStyle(8, OUTLINE, 0.9).strokeRect(note.x - half, note.y - half, half * 2, half * 2);
    this.ring.lineStyle(4, HIGHLIGHT, 1).strokeRect(note.x - half, note.y - half, half * 2, half * 2);
    this.detailName.setText(`${POWER_UP_TREES[note.tree].name} ${note.number}`);
  }
}
