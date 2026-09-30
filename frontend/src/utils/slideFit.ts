/**
 * Slide auto-fit: when a slide's content is taller than the page (tall
 * diagrams, long lists), scale the page down instead of clipping the bottom.
 */

export const SLIDE_FIT_MIN_SCALE = 0.5;
/** Tolerance in px: differences within this count as "fits". */
export const SLIDE_FIT_TOLERANCE_PX = 2;

/**
 * Compute the scale factor for a slide page.
 * Returns 1 when the content fits; otherwise clientHeight / scrollHeight,
 * clamped so a runaway slide never shrinks below SLIDE_FIT_MIN_SCALE.
 * Callers pass layout measurements (transform does not affect them, so the
 * value stays stable while scaled).
 */
export function computeFitScale(clientHeight: number, scrollHeight: number): number {
  if (clientHeight <= 0 || scrollHeight <= 0) return 1;
  if (scrollHeight <= clientHeight + SLIDE_FIT_TOLERANCE_PX) return 1;
  const scale = clientHeight / scrollHeight;
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return Math.max(SLIDE_FIT_MIN_SCALE, scale);
}
