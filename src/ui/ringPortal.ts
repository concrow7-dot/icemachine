import type * as Phaser from 'phaser';
import {
  PORTAL_CLOSE_MS,
  PORTAL_EASE_PER_SECOND,
  PORTAL_FULL_RADIUS,
  PORTAL_HALFWAY_ALPHA,
  PORTAL_ISLAND_RADIUS,
  PORTAL_SWALLOW_MS,
} from '../config/tuning';
import type { PortalSound } from '../audio/PortalSound';
import type { Ring } from '../state/RingLaps';
import { makePortalArt, PORTAL_ART_SIZE, PORTAL_GLOW_KEY, PORTAL_SWIRL_KEY } from './portalArt';

// SCREAM-229 (PO, November 9): the portal in the middle of the roundabout.
// - Lapping: it follows the laps (`portalStrength`): nothing on lap 1, faint on lap 2 and growing
//   to the size of the grass island, then on lap 3 growing over the ring road (under the truck).
//   Leaving the roundabout partway: it fades away and nothing happens (PO).
// - Swallowing: the last lap done, it grows over the whole screen in about a second, until the
//   screen is the portal's dark middle; then the game switches map.
// - Closing: on the other map it starts over the whole screen and shrinks back into that map's
//   roundabout in about a second. The player can drive off meanwhile (PO).

/** Depth while lapping: on the road, under the truck (10) and the people (5 and up). */
const LAPPING_DEPTH = 4.5;
/** Depth while swallowing or closing: over everything on the map. */
const COVER_DEPTH = 1000;
/** The middle this much of the portal's radius is dark enough to hide the map. */
const DARK_PART = 0.3;

export type PortalState = 'lapping' | 'swallowing' | 'closing';

export class RingPortal {
  private readonly scene: Phaser.Scene;
  private readonly ring: Ring;
  private readonly sound: PortalSound;
  readonly glow: Phaser.GameObjects.Image;
  readonly swirl: Phaser.GameObjects.Image;
  /** The strength on screen (0 to 1): catches up with the laps over a fraction of a second. */
  shown = 0;
  /** The radius on screen (px). */
  radius = 0;
  state: PortalState = 'lapping';
  private spin = 0;
  private animT = 0;
  private animFrom = 0;
  private animTo = 0;
  private onDone: (() => void) | null = null;

  constructor(scene: Phaser.Scene, ring: Ring, sound: PortalSound) {
    this.scene = scene;
    this.ring = ring;
    this.sound = sound;
    makePortalArt(scene);
    this.glow = scene.add.image(ring.x, ring.y, PORTAL_GLOW_KEY).setVisible(false);
    this.swirl = scene.add.image(ring.x, ring.y, PORTAL_SWIRL_KEY).setVisible(false);
    this.cover(false);
  }

  /** How big the portal has to be for its dark middle to cover the whole screen, seen from the truck on the ring. */
  private screenRadius(): number {
    const cam = this.scene.cameras.main;
    const halfDiagonal = Math.hypot(this.scene.scale.width, this.scene.scale.height) / 2 / (cam.zoom || 1);
    return (this.ring.r + halfDiagonal + 40) / DARK_PART;
  }

  /** Every frame while lapping, with the strength the laps give (`portalStrength`). */
  update(target: number, dt: number): void {
    if (this.state !== 'lapping') return;
    // Eases towards the laps' strength, but never slower than a third of the way a second, so a fade finishes.
    const gap = target - this.shown;
    const step = Math.max(Math.abs(gap) * Math.min(1, dt * PORTAL_EASE_PER_SECOND), dt / 3);
    this.shown = Math.abs(gap) <= step ? target : this.shown + Math.sign(gap) * step;
    const s = this.shown;
    // The first half (lap 2): faint and small, up to the island; the second (lap 3): over the ring road.
    const alpha = s < 0.5 ? (s / 0.5) * PORTAL_HALFWAY_ALPHA : PORTAL_HALFWAY_ALPHA + ((s - 0.5) / 0.5) * (1 - PORTAL_HALFWAY_ALPHA);
    const radius =
      s < 0.5 ? PORTAL_ISLAND_RADIUS * (0.35 + 0.65 * (s / 0.5)) : PORTAL_ISLAND_RADIUS + (PORTAL_FULL_RADIUS - PORTAL_ISLAND_RADIUS) * ((s - 0.5) / 0.5);
    this.spin += dt * (0.6 + 2.6 * s);
    this.draw(radius, alpha);
    this.sound.setStrength(s);
  }

  /** The last lap is done: grows over the whole screen (see `tick`), then calls `done`. */
  swallow(done: () => void): void {
    this.state = 'swallowing';
    this.cover(true);
    this.sound.swallow(PORTAL_SWALLOW_MS);
    this.animFrom = Math.max(this.radius, PORTAL_FULL_RADIUS);
    this.animTo = this.screenRadius();
    this.animT = 0;
    this.onDone = done;
  }

  /** The way didn't open after all (the evening ended at that moment): back to the roundabout. */
  cancelSwallow(): void {
    this.state = 'lapping';
    this.cover(false);
    this.shown = 0;
    this.draw(0, 0);
    this.sound.setStrength(0);
  }

  /** Arriving on this map: starts over the whole screen and shrinks back into the roundabout (see `tick`). */
  close(): void {
    this.state = 'closing';
    this.cover(true);
    this.animFrom = this.screenRadius();
    this.animT = -1; // the sound starts with the first frame
    this.draw(this.animFrom, 1);
  }

  /**
   * Every frame, even while the truck is held still for the swallow. Runs the swallow and the
   * close from the game's frames, not a timer: each frame moves them on by at most 1/30 s, so a
   * slow frame (the other map's pictures loading) slows them down rather than skipping them.
   */
  tick(deltaMs: number): void {
    if (this.state === 'lapping') return;
    const dt = Math.min(deltaMs, 1000 / 30);
    if (this.state === 'swallowing') {
      this.animT = Math.min(1, this.animT + dt / PORTAL_SWALLOW_MS);
      const t = this.animT * this.animT; // speeding up
      this.spin += (dt / 1000) * (3 + 6 * t);
      this.draw(this.animFrom + (this.animTo - this.animFrom) * t, 1);
      if (this.animT >= 1) {
        const done = this.onDone;
        this.onDone = null;
        done?.();
      }
      return;
    }
    // Closing.
    if (this.animT < 0) {
      this.animT = 0;
      this.sound.close(PORTAL_CLOSE_MS);
    }
    this.animT = Math.min(1, this.animT + dt / PORTAL_CLOSE_MS);
    const t = 1 - (1 - this.animT) * (1 - this.animT); // slowing down
    this.spin += (dt / 1000) * (8 - 6 * t);
    // It shrinks all the way into the middle, fading over the last part.
    this.draw(this.animFrom * (1 - t), this.animT < 0.7 ? 1 : 1 - (this.animT - 0.7) / 0.3);
    if (this.animT >= 1) {
      this.state = 'lapping';
      this.shown = 0;
      this.cover(false);
      this.draw(0, 0);
    }
  }

  /** Over everything (swallowing, closing), or on the road under the truck (lapping). */
  private cover(on: boolean): void {
    this.glow.setDepth(on ? COVER_DEPTH : LAPPING_DEPTH);
    this.swirl.setDepth((on ? COVER_DEPTH : LAPPING_DEPTH) + 0.01);
  }

  private draw(radius: number, alpha: number): void {
    this.radius = radius;
    const on = alpha > 0.01 && radius > 1;
    const scale = (radius * 2) / PORTAL_ART_SIZE;
    const pulse = 1 + 0.03 * Math.sin(this.scene.time.now / 180);
    this.glow.setVisible(on).setAlpha(alpha).setScale(scale * pulse);
    // The swirl turns so its lines seem to pour in towards the middle, and sits a little inside the glow.
    this.swirl.setVisible(on).setAlpha(alpha * 0.9).setScale(scale * 0.95).setRotation(this.spin);
  }

  get visible(): boolean {
    return this.glow.visible;
  }
}
