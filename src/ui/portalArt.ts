import type * as Phaser from 'phaser';

// SCREAM-229 (PO, November 9): the portal in the roundabout, drawn in code (no art files). Two
// pictures, laid one over the other: a round glow (dark in the middle, blue then violet towards a
// soft edge, from the PO's reference photo) and swirl lines curling inward (from his sketch),
// which turn.

export const PORTAL_GLOW_KEY = 'portal-glow';
export const PORTAL_SWIRL_KEY = 'portal-swirl';
/** Both pictures are this many pixels across. */
export const PORTAL_ART_SIZE = 512;

/** Makes the two pictures, once per game. */
export function makePortalArt(scene: Phaser.Scene): void {
  const size = PORTAL_ART_SIZE;
  const c = size / 2;
  if (!scene.textures.exists(PORTAL_GLOW_KEY)) {
    const tex = scene.textures.createCanvas(PORTAL_GLOW_KEY, size, size);
    const g = tex?.getContext();
    if (tex && g) {
      const grad = g.createRadialGradient(c, c, 0, c, c, c);
      grad.addColorStop(0, 'rgba(3, 3, 18, 1)');
      grad.addColorStop(0.28, 'rgba(10, 12, 58, 1)');
      grad.addColorStop(0.52, 'rgba(36, 58, 214, 1)');
      grad.addColorStop(0.72, 'rgba(108, 62, 226, 0.95)');
      grad.addColorStop(0.88, 'rgba(150, 128, 240, 0.4)');
      grad.addColorStop(1, 'rgba(180, 165, 255, 0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      tex.refresh();
    }
  }
  if (!scene.textures.exists(PORTAL_SWIRL_KEY)) {
    const tex = scene.textures.createCanvas(PORTAL_SWIRL_KEY, size, size);
    const g = tex?.getContext();
    if (tex && g) {
      // Each arm is one smooth line, solid, widening as it goes out; then the whole picture fades
      // towards its edge (a soft mask), so the lines melt into the glow.
      g.lineCap = 'round';
      g.lineJoin = 'round';
      const arms = 7;
      const turns = 1.6;
      const steps = 90;
      for (let k = 0; k < arms; k++) {
        const start = (k / arms) * Math.PI * 2;
        g.strokeStyle = k % 2 ? 'rgb(196, 176, 255)' : 'rgb(140, 190, 255)';
        // Drawn in a few pieces, each a little wider than the last.
        const pieces = 6;
        for (let p = 0; p < pieces; p++) {
          g.lineWidth = (2 + 9 * (p / pieces)) * (size / 512);
          g.beginPath();
          for (let i = Math.floor((p / pieces) * steps); i <= Math.floor(((p + 1) / pieces) * steps); i++) {
            const t = Math.max(i, 4) / steps;
            const a = start + t * turns * Math.PI * 2;
            const r = c * 0.86 * Math.pow(t, 0.85);
            const x = c + r * Math.cos(a);
            const y = c + r * Math.sin(a);
            if (i === Math.floor((p / pieces) * steps)) g.moveTo(x, y);
            else g.lineTo(x, y);
          }
          g.stroke();
        }
      }
      g.globalCompositeOperation = 'destination-in';
      const fade = g.createRadialGradient(c, c, 0, c, c, c);
      fade.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
      fade.addColorStop(0.3, 'rgba(0, 0, 0, 0.8)');
      fade.addColorStop(0.75, 'rgba(0, 0, 0, 0.6)');
      fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = fade;
      g.fillRect(0, 0, size, size);
      g.globalCompositeOperation = 'source-over';
      tex.refresh();
    }
  }
}
