/**
 * Slide auto-fit: when a slide's content is taller than its page (tall
 * diagrams, long lists), scale the content down inside the fixed page frame
 * instead of clipping the bottom or shrinking the frame.
 */

export const SLIDE_FIT_MIN_SCALE = 0.5;
/** Tolerance in px: differences within this count as "fits". */
export const SLIDE_FIT_TOLERANCE_PX = 2;

/**
 * Compute the scale factor for a slide page.
 * Returns 1 when the content fits; otherwise available / contentHeight,
 * clamped so a runaway slide never shrinks below SLIDE_FIT_MIN_SCALE.
 * Callers pass layout measurements of the content box (available) and the
 * unscaled natural content height (contentHeight); transform does not affect
 * layout, so the value stays stable while scaled.
 */
export function computeFitScale(available: number, contentHeight: number): number {
  if (available <= 0 || contentHeight <= 0) return 1;
  if (contentHeight <= available + SLIDE_FIT_TOLERANCE_PX) return 1;
  const scale = available / contentHeight;
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return Math.max(SLIDE_FIT_MIN_SCALE, scale);
}
