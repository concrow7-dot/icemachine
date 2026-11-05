import * as Phaser from 'phaser';
import { TutorialEvents, type TutorialPoint, type TutorialRun } from '../state/Tutorial';

/**
 * SCREAM-170 (engineering's proposal): while the uncle talks about a part of the screen, it gets
 * the same pulsing yellow outline as the cooler in the truck (SCREAM-177). Each screen says
 * where its parts are; a part's rectangle can be worked out when it's needed (a button that moves).
 */
const HIGHLIGHT = 0xffe066;
const OUTLINE = 0x3b2a1a;

export type PointRects = Partial<Record<TutorialPoint, () => Phaser.Geom.Rectangle | null>>;

export function addUnclePointer(scene: Phaser.Scene, run: TutorialRun, rects: PointRects): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(40).setName('uncle-pointer');
  // SCREAM-180 (PO): a stronger flash, so it shows even on the clipboard's own gold frame.
  scene.tweens.add({ targets: g, alpha: 0.2, duration: 380, yoyo: true, repeat: -1 });
  const draw = () => {
    g.clear();
    const at = run.pointAt;
    const r = at ? rects[at]?.() : null;
    if (!r) return g.setVisible(false);
    g.setVisible(true);
    g.fillStyle(HIGHLIGHT, 0.3).fillRoundedRect(r.x, r.y, r.width, r.height, 10);
    g.lineStyle(12, OUTLINE, 0.9).strokeRoundedRect(r.x, r.y, r.width, r.height, 10);
    g.lineStyle(7, HIGHLIGHT, 1).strokeRoundedRect(r.x, r.y, r.width, r.height, 10);
    return g;
  };
  run.on(TutorialEvents.Changed, draw);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => run.off(TutorialEvents.Changed, draw));
  draw();
  return g;
}
