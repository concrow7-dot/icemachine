import * as Phaser from 'phaser';
import { getEvening, returnToTruck, SceneKeys } from '../flow';
import { POWER_UP_TREES } from '../config/powerUps';
import { BOARD_LAYOUT, nextNote, placeNotes, type BoardDirection, type BuyStatus, type PlacedNote } from '../state/PowerUpBoard';
import { EveningEvents, EveningState } from '../state/EveningState';
import { loadFlavourArt, MARKER_FONT } from '../ui/flavourArt';
import { addPowerUpLogo } from '../ui/powerUpLogo';
import { formatMoney } from '../util/format';
import { showLoadingWhileLoading } from './LoadingScene';
import { HIGHLIGHT, OUTLINE } from './TruckScene';

// SCREAM-267: the cork board above the cooler, opened from the hub (Story). The PO's reference
// was a game's skill map: three trees side by side, squares joined by lines. Here they are
// paper notes pinned to cork and joined by string: TRUCK, SPEAKER and SALES (the PO's names).
// SCREAM-296 (PO, November 12): each note shows a picture; clicking one opens it bigger, with
// the picture, a description, the price and a BUY button ("No button if already purchased").
// Notes not bought yet are greyed out and can still be opened; bought ones are in colour.
// The notes are still dummies: buying one costs real Story cash and does nothing yet.
// Placeholder art by engineering until the PO draws the board.

const INK = '#2b1d10';
const RED = '#b3261e';
const WOOD = 0x7a4a22;
const WOOD_DARK = 0x4f2e12;
const CORK = 0xc99a5b;
const CORK_SPECKS = [0xb5843f, 0xdcb277, 0xa87838];
const GREY_PAPER = 0xd9d6cf;
/** The cork inside the wooden frame. The top strip is left to the clock and the money. */
const CORK_RECT = { x: 16, y: 50, w: 928, h: 444 };
const DETAIL = { x: 300, y: 454, w: 520, h: 60 };
const BACK = { x: 866, y: 454, w: 108, h: 44 };
/** The opened note, in the middle of the board. */
const BIG = { x: 480, y: 268, w: 330, h: 372 };

const HINT_CLOSED = '← ↑ ↓ → Look Around    Enter: Open Note    B: Back To The Truck';
const HINT_OPEN_BUY = 'Enter: Buy    B: Close Note';
const HINT_OPEN = 'B: Close Note';

export class PowerUpsScene extends Phaser.Scene {
  /** Test hooks: every note with its place, the one highlighted, and whether it is opened big. */
  notes: PlacedNote[] = [];
  selected = '';
  open = false;
  detailName!: Phaser.GameObjects.Text;
  detailStatus!: Phaser.GameObjects.Text;
  detailText!: Phaser.GameObjects.Text;
  backButton!: Phaser.GameObjects.Zone;
  /** The opened note's BUY button, or null when there is none (owned, locked, away from home). */
  buyButton: Phaser.GameObjects.Zone | null = null;
  /** The opened note's words, top to bottom (name, description, price, the line under it). */
  bigTexts: string[] = [];
  hint!: Phaser.GameObjects.Text;
  private evening!: EveningState;
  private ring!: Phaser.GameObjects.Graphics;
  private noteArt = new Map<string, Phaser.GameObjects.Container>();
  private big: Phaser.GameObjects.Container | null = null;

  constructor() {
    super(SceneKeys.PowerUps);
  }

  preload(): void {
    loadFlavourArt(this); // the marker font
    showLoadingWhileLoading(this);
  }

  create(): void {
    const { width, height } = this.scale;
    this.evening = getEvening(this);
    this.notes = placeNotes(POWER_UP_TREES);
    if (!this.notes.some((n) => n.id === this.selected)) this.selected = this.notes[0].id;
    this.open = false;
    this.big = null;
    this.buyButton = null;
    this.bigTexts = [];
    this.noteArt.clear();

    this.drawBoard(width, height);
    this.drawStrings();
    for (const note of this.notes) this.addNote(note);
    POWER_UP_TREES.forEach((tree, t) => this.addTreeLabel(tree.name, BOARD_LAYOUT.treeX[t], tree.string));

    this.ring = this.add.graphics().setDepth(5);
    this.addDetail();
    this.addBack();

    this.add.rectangle(0, height - 34, width, 34, 0x000000, 0.45).setOrigin(0, 0).setDepth(30);
    this.hint = this.add
      .text(width / 2, height - 17, HINT_CLOSED, { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(31);

    const keyboard = this.input.keyboard;
    const moves: [string, BoardDirection][] = [
      ['LEFT', 'left'], ['A', 'left'], ['RIGHT', 'right'], ['D', 'right'],
      ['UP', 'up'], ['W', 'up'], ['DOWN', 'down'], ['S', 'down'],
    ];
    for (const [key, direction] of moves) keyboard?.on(`keydown-${key}`, () => this.move(direction));
    keyboard?.on('keydown-B', () => this.back());
    keyboard?.on('keydown-BACKSPACE', () => this.back());
    keyboard?.on('keydown-ENTER', () => this.enter());
    keyboard?.on('keydown-SPACE', () => this.enter());

    // The cash can change while the board is open (a debug key, or a purchase): redraw what depends on it.
    const onMoney = () => this.refresh();
    this.evening.on(EveningEvents.MoneyChanged, onMoney);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.evening.off(EveningEvents.MoneyChanged, onMoney));

    this.refresh();
  }

  /** Can the note be bought now, and if not, why (test hook too). */
  status(id = this.selected): BuyStatus {
    return this.evening.powerUpStatus(id) ?? 'locked';
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

  /** One note's click area; its picture is drawn (and redrawn after a purchase) by drawNote. */
  private addNote(note: PlacedNote): void {
    const size = BOARD_LAYOUT.note;
    const zone = this.add.zone(note.x - size / 2, note.y - size / 2, size, size).setOrigin(0, 0).setInteractive();
    zone.input!.cursor = 'pointer';
    zone.on('pointerover', () => {
      if (this.open) return;
      this.selected = note.id;
      this.refresh();
    });
    zone.on('pointerdown', () => {
      this.selected = note.id;
      this.openNote();
    });
  }

  /** The paper note: a little crooked, pinned at the top, with its tree's picture. Grey until it is bought. */
  private drawNote(note: PlacedNote): void {
    this.noteArt.get(note.id)?.destroy();
    const tree = POWER_UP_TREES[note.tree];
    const owned = this.status(note.id) === 'owned';
    const size = BOARD_LAYOUT.note;
    const tilt = ((note.number * 7 + note.tree * 3) % 9) - 4; // -4 to 4 degrees, the same every time
    const art = this.add.container(note.x, note.y).setAngle(tilt).setDepth(2);
    art.add(this.add.rectangle(2, 3, size, size, 0x000000, 0.22));
    art.add(this.add.rectangle(0, 0, size, size, owned ? tree.paper : GREY_PAPER, 1).setStrokeStyle(2, OUTLINE, 0.9));
    const logo = this.add.container(0, 5);
    addPowerUpLogo(this, logo, note.logo, note.logo === 'gas-can' ? 30 : 26, !owned);
    art.add(logo);
    const pinY = -size / 2 + 5;
    art.add(this.add.circle(1, pinY + 1, 5, 0x000000, 0.3));
    art.add(this.add.circle(0, pinY, 5, tree.string, 1).setStrokeStyle(1.5, OUTLINE, 1));
    art.add(this.add.circle(-1.5, pinY - 1.5, 1.5, 0xffffff, 0.8));
    this.noteArt.set(note.id, art);
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

  /** The index card at the bottom: the highlighted note's name, and its price or that it's yours. */
  private addDetail(): void {
    const { x, y, w, h } = DETAIL;
    this.add.rectangle(x + 2, y + 3, w, h, 0x000000, 0.22);
    this.add.rectangle(x, y, w, h, 0xfffdf2, 1).setStrokeStyle(2, OUTLINE, 0.9);
    this.detailName = this.add.text(x - w / 2 + 16, y - 13, '', { fontFamily: MARKER_FONT, fontSize: '22px', color: INK }).setOrigin(0, 0.5);
    this.detailStatus = this.add
      .text(x + w / 2 - 16, y - 13, '', { fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold', color: INK })
      .setOrigin(1, 0.5);
    this.detailText = this.add.text(x - w / 2 + 16, y + 15, '', { fontFamily: 'monospace', fontSize: '14px', color: INK }).setOrigin(0, 0.5);
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
    if (this.open) return;
    this.selected = nextNote(this.notes, this.selected, direction);
    this.refresh();
  }

  /** B: closes the opened note, or goes back to the hub with the board still highlighted. */
  private back(): void {
    if (this.open) return this.closeNote();
    returnToTruck(this, 'menu');
  }

  /** Enter: opens the highlighted note; on an opened note, buys it (PO: no "are you sure" step). */
  private enter(): void {
    if (!this.open) return this.openNote();
    this.buy();
  }

  openNote(): void {
    this.open = true;
    this.refresh();
  }

  closeNote(): void {
    this.open = false;
    this.refresh();
  }

  /** Buys the opened note if it can be bought. The money change redraws the board. */
  buy(): void {
    if (!this.open) return;
    this.evening.buyPowerUp(this.selected);
  }

  /** What the opened note says under its price when there is no button to press. */
  private reason(note: PlacedNote, status: BuyStatus): string {
    if (status === 'owned') return 'Yours';
    if (status === 'away') return 'Buy at home, before you set off';
    if (status === 'locked') {
      const names = note.from.map((id) => this.notes.find((n) => n.id === id)?.name ?? id);
      return `Buy ${names.join(' or ')} first`;
    }
    return '';
  }

  /**
   * The note opened bigger, over a dimmed board: pin, picture, name, description, price, and a
   * BUY button. No button when it's owned, locked or the truck is away from home; a greyed-out
   * button and a red price when there isn't enough cash.
   */
  private drawBig(note: PlacedNote): void {
    const { width, height } = this.scale;
    const { x, y, w, h } = BIG;
    const tree = POWER_UP_TREES[note.tree];
    const status = this.status(note.id);
    const owned = status === 'owned';
    const big = this.add.container(0, 0).setDepth(20);
    this.big = big;

    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0, 0).setInteractive();
    dim.on('pointerdown', () => this.closeNote());
    big.add(dim);
    big.add(this.add.rectangle(x + 5, y + 7, w, h, 0x000000, 0.3));
    // The paper swallows clicks, so only a click on the dimmed board closes the note.
    big.add(this.add.rectangle(x, y, w, h, owned ? tree.paper : GREY_PAPER, 1).setStrokeStyle(3, OUTLINE, 1).setInteractive());
    const top = y - h / 2;
    big.add(this.add.circle(x + 2, top + 16, 9, 0x000000, 0.3));
    big.add(this.add.circle(x, top + 14, 9, tree.string, 1).setStrokeStyle(2, OUTLINE, 1));
    big.add(this.add.circle(x - 3, top + 11, 2.5, 0xffffff, 0.8));

    const logo = this.add.container(x, top + 84);
    addPowerUpLogo(this, logo, note.logo, note.logo === 'gas-can' ? 104 : 92, !owned);
    big.add(logo);

    const name = this.add.text(x, top + 158, note.name, { fontFamily: MARKER_FONT, fontSize: note.name.length > 12 ? '24px' : '30px', color: INK }).setOrigin(0.5);
    const description = this.add
      .text(x, top + 210, note.description, { fontFamily: 'monospace', fontSize: '15px', color: INK, align: 'center', wordWrap: { width: w - 40 } })
      .setOrigin(0.5);
    const price = this.add
      .text(x, top + 266, formatMoney(note.priceCents), { fontFamily: MARKER_FONT, fontSize: '32px', color: status === 'poor' ? RED : INK })
      .setOrigin(0.5);
    big.add([name, description, price]);
    this.bigTexts = [note.name, note.description, formatMoney(note.priceCents)];

    this.buyButton = null;
    const buttonY = top + 320;
    if (status === 'ok' || status === 'poor') {
      const can = status === 'ok';
      big.add(this.add.rectangle(x + 2, buttonY + 3, 150, 46, 0x000000, 0.22));
      big.add(this.add.rectangle(x, buttonY, 150, 46, can ? HIGHLIGHT : 0xb9b6ae, 1).setStrokeStyle(2, OUTLINE, can ? 0.9 : 0.4));
      big.add(
        this.add
          .text(x, buttonY, 'BUY', { fontFamily: 'monospace', fontSize: '24px', fontStyle: 'bold', color: can ? INK : '#77736b' })
          .setOrigin(0.5),
      );
      this.bigTexts.push('BUY');
      if (can) {
        const zone = this.add.zone(x - 75, buttonY - 23, 150, 46).setOrigin(0, 0).setInteractive();
        zone.input!.cursor = 'pointer';
        zone.on('pointerdown', () => this.buy());
        big.add(zone);
        this.buyButton = zone;
      }
    } else {
      const line = this.reason(note, status);
      big.add(
        this.add
          .text(x, buttonY, line, { fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold', color: owned ? '#1f6b2e' : INK, align: 'center', wordWrap: { width: w - 30 } })
          .setOrigin(0.5),
      );
      this.bigTexts.push(line);
    }
    this.hint.setText(status === 'ok' ? HINT_OPEN_BUY : HINT_OPEN);
  }

  private refresh(): void {
    for (const n of this.notes) this.drawNote(n);
    this.big?.destroy();
    this.big = null;
    this.buyButton = null;
    this.bigTexts = [];
    this.hint.setText(HINT_CLOSED);

    const note = this.notes.find((n) => n.id === this.selected);
    this.ring.clear();
    if (!note) return;
    const half = BOARD_LAYOUT.note / 2 + 6;
    this.ring.lineStyle(8, OUTLINE, 0.9).strokeRect(note.x - half, note.y - half, half * 2, half * 2);
    this.ring.lineStyle(4, HIGHLIGHT, 1).strokeRect(note.x - half, note.y - half, half * 2, half * 2);
    const status = this.status(note.id);
    this.detailName.setText(note.name);
    // The card has one line: a long description is cut short there (the opened note has all of it).
    this.detailText.setText(note.description.length > 58 ? `${note.description.slice(0, 55).trimEnd()}...` : note.description);
    this.detailStatus.setText(status === 'owned' ? 'Yours' : formatMoney(note.priceCents)).setColor(status === 'owned' ? '#1f6b2e' : status === 'poor' ? RED : INK);
    if (this.open) this.drawBig(note);
  }
}
