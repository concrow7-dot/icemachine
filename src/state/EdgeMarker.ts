/**
 * SCREAM-341 (PO, November 15: "Better Mirrors: indicator for customers, show exact customer"; he
 * chose edge markers): where a marker for something off screen goes. No Phaser, unit-tested.
 */
export type ViewBox = { x: number; y: number; right: number; bottom: number };

export type EdgeMarker = {
  /** The marker's middle, on the edge of the view (`margin` inside it). */
  x: number;
  y: number;
  /** The direction from the marker to the thing it points at, in radians (0 = right, π/2 = down). */
  angle: number;
};

/**
 * The marker for a point: null when the point is inside the view (nothing to point at), else a
 * spot `margin` inside the view's edge, on the straight line from the view's middle to the point.
 */
export function edgeMarker(view: ViewBox, px: number, py: number, margin: number): EdgeMarker | null {
  if (px >= view.x && px <= view.right && py >= view.y && py <= view.bottom) return null;
  const cx = (view.x + view.right) / 2;
  const cy = (view.y + view.bottom) / 2;
  const halfW = Math.max(1, (view.right - view.x) / 2 - margin);
  const halfH = Math.max(1, (view.bottom - view.y) / 2 - margin);
  const dx = px - cx;
  const dy = py - cy;
  // Shrink the line to the middle until it touches the inner box.
  const k = Math.min(dx === 0 ? Infinity : halfW / Math.abs(dx), dy === 0 ? Infinity : halfH / Math.abs(dy));
  const x = cx + dx * k;
  const y = cy + dy * k;
  return { x, y, angle: Math.atan2(py - y, px - x) };
}
