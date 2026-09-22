import { describe, expect, it } from "vitest";
import {
  PRESENTER_CHANNEL,
  buildPresenterUrl,
  createPresenterSessionId,
  isPresenterMessage,
} from "./slidesPresenterChannel";

describe("slidesPresenterChannel", () => {
  it("exposes a stable channel name", () => {
    expect(PRESENTER_CHANNEL).toBe("markview-slides-presenter");
  });

  it("creates non-empty session ids", () => {
    const a = createPresenterSessionId();
    const b = createPresenterSessionId();
    expect(a.length).toBeGreaterThan(8);
    expect(a).not.toBe(b);
  });

  it("builds a same-origin presenter url with session", () => {
    const url = buildPresenterUrl("sess-1", {
      origin: "http://127.0.0.1:16275",
      pathname: "/g/default",
    });
    expect(url).toBe("http://127.0.0.1:16275/g/default?presenter=1&session=sess-1");
  });

  it("accepts valid presenter messages and rejects junk", () => {
    expect(
      isPresenterMessage({
        type: "hello",
        sessionId: "s",
      }),
    ).toBe(true);
    expect(
      isPresenterMessage({
        type: "goto",
        sessionId: "s",
        slideIndex: 2,
      }),
    ).toBe(true);
    expect(
      isPresenterMessage({
        type: "state",
        sessionId: "s",
        fileId: "f",
        slideIndex: 0,
        slideCount: 3,
        notes: "n",
        title: "t",
        prevTitle: null,
        nextTitle: "next",
        deckRevision: 1,
      }),
    ).toBe(true);
    expect(isPresenterMessage(null)).toBe(false);
    expect(isPresenterMessage({ type: "goto" })).toBe(false);
    expect(isPresenterMessage({ type: "nope", sessionId: "s" })).toBe(false);
  });
});
