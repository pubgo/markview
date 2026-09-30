import { describe, expect, it } from "vitest";
import { computeFitScale, SLIDE_FIT_MIN_SCALE, SLIDE_FIT_TOLERANCE_PX } from "./slideFit";

describe("computeFitScale", () => {
  it("returns 1 when content fits", () => {
    expect(computeFitScale(600, 600)).toBe(1);
    expect(computeFitScale(600, 300)).toBe(1);
  });

  it("tolerates sub-pixel overflow", () => {
    expect(computeFitScale(600, 600 + SLIDE_FIT_TOLERANCE_PX)).toBe(1);
    expect(computeFitScale(600, 600 + SLIDE_FIT_TOLERANCE_PX + 1)).toBeLessThan(1);
  });

  it("scales down proportionally on overflow", () => {
    expect(computeFitScale(600, 1200)).toBeCloseTo(0.5);
    expect(computeFitScale(600, 900)).toBeCloseTo(600 / 900);
  });

  it("never shrinks below the minimum scale", () => {
    expect(computeFitScale(600, 6000)).toBe(SLIDE_FIT_MIN_SCALE);
  });

  it("returns 1 for degenerate measurements", () => {
    expect(computeFitScale(0, 1200)).toBe(1);
    expect(computeFitScale(600, 0)).toBe(1);
    expect(computeFitScale(-1, -1)).toBe(1);
  });
});
