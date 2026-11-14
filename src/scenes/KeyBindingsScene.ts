import * as Phaser from 'phaser';
import { KEY_GROUPS, type KeyGroup } from '../config/keyBindings';
import { SceneKeys } from '../flow';

// SCREAM-206 (decision 104): the pause menu's Key Bindings page, the one place a player can
// always look up the controls. The list is src/config/keyBindings.ts. It opens over the pause
// menu (which waits, frozen) and Esc, B or Backspace (or a click on Back) returns to it.

/** The most lines (a group's title and its rows) one page holds. */
export const KEY_PAGE_LINES = 17;

const INK = '#ffffff';
const HIGHLIGHT = '#ffe066';
const QUIET = '#b7c2d6';
const TITLE = '#ffe8a3';

/** The groups, in order, packed onto pages of at most `maxLines` lines (a group is never split). */
export function paginateKeyGroups(groups: readonly KeyGroup[], maxLines = KEY_PAGE_LINES): KeyGroup[][] {
  const pages: KeyGroup[][] = [];
  let page: KeyGroup[] = [];
  let used = 0;
  for (const group of groups) {
    const lines = group.rows.length + 1;
    if (page.length > 0 && used + lines > maxLines) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push(group);
    used += lines;
  }
  if (page.length > 0) pages.push(page);
  return pages;
}

export class KeyBindingsScene extends Phaser.Scene {
  /** The pause menu behind this page, resumed when it closes. */
  private opener: string = SceneKeys.Pause;
  private pages: KeyGroup[][] = [];
  /** Test hook: the page on screen (0 is the first). */
  page = 0;
  private shown: Phaser.GameObjects.GameObject[] = [];
  private pageLabel!: Phaser.GameObjects.Text;
  /** Test hook: every line of text on the page now, "keys: what it does". */
  lines: string[] = [];

  constructor() {
    super(SceneKeys.KeyBindings);
  }

  create(data: { opener?: string }): void {
    this.opener = data.opener ?? SceneKeys.Pause;
    this.pages = paginateKeyGroups(KEY_GROUPS);
    this.page = 0;
    this.shown = [];
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.55).setInteractive();
    this.add.rectangle(width / 2, height / 2, 800, 500, 0x1f2a44).setStrokeStyle(3, 0x8a9bb3);
    this.add.text(width / 2, 52, 'KEY BINDINGS', { fontFamily: 'monospace', fontSize: '28px', color: TITLE }).setOrigin(0.5);

    this.pageLabel = this.add.text(width / 2, height - 52, '', { fontFamily: 'monospace', fontSize: '14px', color: QUIET }).setOrigin(0.5);
    this.button(width / 2 - 330, height - 52, '< Previous', () => this.turn(-1));
    this.button(width / 2 + 330, height - 52, 'Next >', () => this.turn(1));
    this.button(width / 2, height - 78, 'Back', () => this.back());

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const key = event.key;
      if (event.repeat) return; // a key still held from opening this page doesn't count
      if (key === 'Escape' || key === 'b' || key === 'B' || key === 'Backspace') this.back();
      else if (key === 'ArrowRight' || key === 'd' || key === 'D' || key === 'ArrowDown' || key === 's' || key === 'S') this.turn(1);
      else if (key === 'ArrowLeft' || key === 'a' || key === 'A' || key === 'ArrowUp' || key === 'w' || key === 'W') this.turn(-1);
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.turn(dy > 0 ? 1 : -1));
    this.show();
  }

  private button(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, label, { fontFamily: 'monospace', fontSize: '16px', color: INK, backgroundColor: '#3a4a6c', padding: { x: 10, y: 4 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onClick);
  }

  /** The groups of the current page, drawn one under the other. */
  private show(): void {
    for (const object of this.shown) object.destroy();
    this.shown = [];
    this.lines = [];
    const keysX = 130;
    const doesX = 360;
    let y = 92;
    for (const group of this.pages[this.page] ?? []) {
      this.shown.push(this.add.text(keysX, y, group.title, { fontFamily: 'monospace', fontSize: '17px', color: TITLE }));
      y += 24;
      for (const [keys, does] of group.rows) {
        this.shown.push(this.add.text(keysX + 14, y, keys, { fontFamily: 'monospace', fontSize: '15px', color: HIGHLIGHT }));
        this.shown.push(this.add.text(doesX, y, does, { fontFamily: 'monospace', fontSize: '15px', color: INK }));
        this.lines.push(`${keys}: ${does}`);
        y += 20;
      }
      y += 8;
    }
    this.pageLabel.setText(`Page ${this.page + 1} Of ${this.pages.length}    ← →: Turn The Page    Esc Or B: Back`);
  }

  /** Test hook and keys: the next page (or the one before), stopping at the ends. */
  turn(step: number): void {
    const next = Phaser.Math.Clamp(this.page + step, 0, this.pages.length - 1);
    if (next === this.page) return;
    this.page = next;
    this.show();
  }

  /** Back to the pause menu. */
  back(): void {
    this.scene.resume(this.opener);
    this.scene.stop();
  }
}
