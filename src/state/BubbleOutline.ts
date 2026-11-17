/**
 * SCREAM-378 (PO, November 16): the hand-drawn speech bubble's outline, as a closed ring of
 * points. No Phaser here, so it can be unit-tested; `src/ui/handBubble.ts` paints it.
 *
 * The shape is a rounded box whose edge wanders a little in and out, as a line drawn by hand
 * does, with a curved tail. The wander comes from `seed`, so the same bubble is the same
 * every time it is drawn (it doesn't shimmer when the box grows for a long line).
 */
export interface BubbleTail {
  /** Which side of the box it leaves from. */
  side: 'down' | 'right';
  /** The middle of the tail's root: px from the box's left for 'down', from its top for 'right'. */
  at: number;
  /** How wide the root is, and how far the tip reaches from the box, in px. */
  width: number;
  length: number;
  /** How far the tip leans along the side (px; positive is right for 'down', down for 'right'). */
  lean: number;
}

export interface BubbleShape {
  w: number;
  h: number;
  /** Corner radius, px. */
  radius: number;
  /** The most the edge wanders in or out, px. */
  wobble: number;
  seed: number;
  tail?: BubbleTail;
}

export type Point = [number, number];

/** A small seeded random number maker (mulberry32): the same seed gives the same numbers. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Sample {
  x: number;
  y: number;
  nx: number;
  ny: number;
  /** Which stretch of the edge it is on. */
  part: 'top' | 'right' | 'bottom' | 'left' | 'corner';
}

const STEP = 3;

/** Points along a curve from `a` to `b` that bends toward `c` (a quadratic Bézier), without `a`. */
function curve(a: Point, c: Point, b: Point, steps: number): Point[] {
  const pts: Point[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return pts;
}

/**
 * The outline, clockwise from the top edge, in px with the box's top-left corner at (0, 0).
 * The tail's tip is the only sharp point.
 */
export function bubbleOutline(s: BubbleShape): Point[] {
  const { w, h } = s;
  const r = Math.max(0, Math.min(s.radius, w / 2, h / 2));
  const samples: Sample[] = [];
  const line = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number, part: Sample['part']) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.round(len / STEP));
    for (let i = 0; i < n; i++) samples.push({ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n, nx, ny, part });
  };
  const corner = (cx: number, cy: number, from: number) => {
    const n = Math.max(2, Math.round((r * Math.PI) / 2 / STEP));
    for (let i = 0; i < n; i++) {
      const a = from + ((Math.PI / 2) * i) / n;
      samples.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a), part: 'corner' });
    }
  };
  line(r, 0, w - r, 0, 0, -1, 'top');
  corner(w - r, r, -Math.PI / 2);
  line(w, r, w, h - r, 1, 0, 'right');
  corner(w - r, h - r, 0);
  line(w - r, h, r, h, 0, 1, 'bottom');
  corner(r, h - r, Math.PI / 2);
  line(0, h - r, 0, r, -1, 0, 'left');
  corner(r, r, Math.PI);

  // The wander: two slow waves round the whole edge (whole numbers of waves, so the ring closes).
  const rnd = seeded(s.seed);
  const perimeter = samples.length * STEP;
  const waves = [
    { n: Math.max(3, Math.round(perimeter / 180)), amp: 0.65, phase: rnd() * Math.PI * 2 },
    { n: Math.max(7, Math.round(perimeter / 75)), amp: 0.35, phase: rnd() * Math.PI * 2 },
  ];
  const moved = samples.map((p, i): { pt: Point; part: Sample['part'] } => {
    const u = (i / samples.length) * Math.PI * 2;
    let off = 0;
    for (const wv of waves) off += wv.amp * Math.sin(wv.n * u + wv.phase);
    off *= s.wobble;
    return { pt: [p.x + p.nx * off, p.y + p.ny * off], part: p.part };
  });

  const tail = s.tail;
  if (!tail || tail.length <= 0) return moved.map((m) => m.pt);

  // The tail replaces the stretch of its side between its root's two ends.
  const lo = tail.at - tail.width / 2;
  const hi = tail.at + tail.width / 2;
  const side = tail.side === 'right' ? 'right' : 'bottom';
  const along = (pt: Point) => (tail.side === 'right' ? pt[1] : pt[0]);
  const out: Point[] = [];
  let done = false;
  for (let i = 0; i < moved.length; i++) {
    const m = moved[i];
    const inRoot = m.part === side && along(m.pt) >= lo && along(m.pt) <= hi;
    if (!inRoot) {
      out.push(m.pt);
      continue;
    }
    if (done) continue;
    done = true;
    // The first and last points of the root, in the order the edge is walked.
    let j = i;
    while (j + 1 < moved.length && moved[j + 1].part === side && along(moved[j + 1].pt) >= lo && along(moved[j + 1].pt) <= hi) j++;
    const a = m.pt;
    const b = moved[j].pt;
    out.push(a);
    if (tail.side === 'right') {
      const tip: Point = [w + tail.length, tail.at + tail.lean];
      out.push(...curve(a, [w + tail.length * 0.55, a[1] + tail.lean * 0.25], tip, 8));
      out.push(...curve(tip, [w + tail.length * 0.35, b[1] + tail.lean * 0.55], b, 8));
    } else {
      const tip: Point = [tail.at + tail.lean, h + tail.length];
      out.push(...curve(a, [a[0] + tail.lean * 0.55, h + tail.length * 0.35], tip, 8));
      out.push(...curve(tip, [b[0] + tail.lean * 0.25, h + tail.length * 0.55], b, 8));
    }
  }
  return out;
}
