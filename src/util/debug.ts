/**
 * SCREAM-220 (PO, November 9): debug-only things on screen show only when the address
 * has `?debug` in it (e.g. https://concrow7-dot.github.io/icemachine/?debug).
 * The Shift debug keys themselves still work without it (gating them is a separate job).
 */
export function debugOn(): boolean {
  try {
    return new URLSearchParams(window.location.search).has('debug');
  } catch {
    return false;
  }
}
