import * as Phaser from 'phaser';
import type { FlavourId } from '../config/flavours';
import { POWER_UP_TREES, type PowerUpNote } from '../config/powerUps';
import { MARKER_FONT } from './flavourArt';
import { addPowerUpLogo } from './powerUpLogo';

// SCREAM-355 (PO, November 15: "From this screen, I want to be able to click on flavors and see the
// power"; he chose "The cork board's note"). An ice cream's note from the cork board, opened big
// over another screen (the cooler), to read only: the pin, the picture, the name and the note's
// paragraphs (its power, the most a customer pays, what it costs to stock). No price and no BUY
// button. A click anywhere or any key closes it; nothing under it reacts while it is open.

const INK = '#2b1d10';
const OUTLINE = 0x3b2a1a;
const NOTE = { x: 480, y: 276, w: 330, minH: 300 };
const TEXT_TOP = 184;

/** The cork board's note for this ice cream, or undefined (Quick play's ice creams have none of their own tree). */
export function flavourNoteOf(flavour: FlavourId): PowerUpNote | undefined {
  return POWER_UP_TREES.flatMap((t) => t.notes).find((n) => n.flavour === flavour);
}

export type OpenFlavourNote = { flavour: FlavourId; texts: string[]; close: () => void };

/** Opens the note over `scene`. `onClose` runs once, however it is closed. */
export function showFlavourNote(scene: Phaser.Scene, flavour: FlavourId, onClose: () => void): OpenFlavourNote | null {
  const tree = POWER_UP_TREES.find((t) => t.notes.some((n) => n.flavour === flavour));
  const note = flavourNoteOf(flavour);
  if (!tree || !note) return null;
  const { width, height } = scene.scale;
  const { x, w } = NOTE;
  const paragraphs = note.paragraphs ?? [note.description ?? ''];
  const name = note.name ?? '';
  const words = name.split(' ');
  const twoLines = name.length > 20 && (words.length === 3 || words.length === 4);
  const description = scene.add
    .text(0, 0, paragraphs.join('\n\n'), { fontFamily: 'monospace', fontSize: '15px', color: INK, align: 'center', wordWrap: { width: w - 40 } })
    .setOrigin(0.5, 0);
  const textTop = twoLines ? TEXT_TOP + 12 : TEXT_TOP;
  const h = Math.max(NOTE.minH, textTop + description.height + 52);
  const y = Math.min(NOTE.y, height - h / 2 - 8);
  const top = y - h / 2;
  const box = scene.add.container(0, 0).setDepth(1000);
  // The dim layer takes every click: the first one closes the note, and nothing under it is reached.
  const dim = scene.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0, 0).setInteractive();
  box.add(dim);
  box.add(scene.add.rectangle(x + 5, y + 7, w, h, 0x000000, 0.3));
  box.add(scene.add.rectangle(x, y, w, h, tree.paper, 1).setStrokeStyle(3, OUTLINE, 1));
  box.add(scene.add.circle(x + 2, top + 16, 9, 0x000000, 0.3));
  box.add(scene.add.circle(x, top + 14, 9, tree.string, 1).setStrokeStyle(2, OUTLINE, 1));
  box.add(scene.add.circle(x - 3, top + 11, 2.5, 0xffffff, 0.8));
  const logo = scene.add.container(x, top + 84);
  addPowerUpLogo(scene, logo, note.logo ?? 'icecream', 92, false);
  box.add(logo);
  const shown = twoLines ? `${words[0]} ${words[1]}\n${words.slice(2).join(' ')}` : name;
  box.add(
    scene.add
      .text(x, top + (twoLines ? 164 : 158), shown, { fontFamily: MARKER_FONT, fontSize: name.length > 12 ? '24px' : '30px', color: INK, align: 'center' })
      .setOrigin(0.5),
  );
  description.setPosition(x, top + textTop);
  box.add(description);
  box.add(
    scene.add
      .text(x, top + h - 22, 'Click anywhere to close', { fontFamily: 'monospace', fontSize: '12px', color: '#6b5a48' })
      .setOrigin(0.5),
  );

  let closed = false;
  // Any key closes it, and only that: the key never reaches the screen underneath (or the pause key).
  const onKey = (event: KeyboardEvent) => {
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return; // debug keys and browser shortcuts pass
    event.stopImmediatePropagation();
    event.preventDefault();
    close();
  };
  const close = () => {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKey, true);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, close);
    box.destroy(true);
    onClose();
  };
  window.addEventListener('keydown', onKey, true);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, close);
  dim.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
    event.stopPropagation();
    close();
  });
  return { flavour, texts: [name, ...paragraphs], close };
}
