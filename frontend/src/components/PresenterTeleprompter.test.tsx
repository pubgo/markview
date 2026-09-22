import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { PresenterTeleprompter } from "./PresenterTeleprompter";
import {
  PRESENTER_CHANNEL,
  isPresenterMessage,
  type PresenterMessage,
} from "../utils/slidesPresenterChannel";

type Listener = (event: MessageEvent) => void;

class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = [];
  name: string;
  onmessage: Listener | null = null;
  private listeners = new Set<Listener>();

  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.instances.push(this);
  }

  addEventListener(_type: string, listener: Listener) {
    this.listeners.add(listener);
  }

  removeEventListener(_type: string, listener: Listener) {
    this.listeners.delete(listener);
  }

  postMessage(data: PresenterMessage) {
    for (const instance of MockBroadcastChannel.instances) {
      if (instance === this || instance.name !== this.name) continue;
      const event = { data } as MessageEvent;
      instance.onmessage?.(event);
      for (const listener of instance.listeners) listener(event);
    }
  }

  close() {
    MockBroadcastChannel.instances = MockBroadcastChannel.instances.filter((i) => i !== this);
  }
}

describe("PresenterTeleprompter", () => {
  beforeEach(() => {
    MockBroadcastChannel.instances = [];
    vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders notes and page label from a state message", async () => {
    render(<PresenterTeleprompter sessionId="sess-a" />);

    await waitFor(() => {
      expect(MockBroadcastChannel.instances.length).toBeGreaterThanOrEqual(1);
    });

    const main = new MockBroadcastChannel(PRESENTER_CHANNEL);
    main.postMessage({
      type: "state",
      sessionId: "sess-a",
      fileId: "f1",
      slideIndex: 1,
      slideCount: 4,
      notes: "强调本地优先",
      title: "要点",
      prevTitle: "封面",
      nextTitle: "总结",
      deckRevision: 1,
    });

    expect(await screen.findByTestId("presenter-teleprompter")).toBeInTheDocument();
    expect(screen.getByTestId("presenter-notes")).toHaveTextContent("强调本地优先");
    expect(screen.getByTestId("presenter-page")).toHaveTextContent("2 / 4");
    expect(screen.getByTestId("presenter-title")).toHaveTextContent("要点");
    expect(screen.getByText("封面")).toBeInTheDocument();
    expect(screen.getByText("总结")).toBeInTheDocument();
  });

  it("posts goto when clicking 下一页", async () => {
    render(<PresenterTeleprompter sessionId="sess-b" />);
    await waitFor(() => expect(MockBroadcastChannel.instances.length).toBeGreaterThanOrEqual(1));

    const main = new MockBroadcastChannel(PRESENTER_CHANNEL);
    const gotos: PresenterMessage[] = [];
    main.addEventListener("message", (event) => {
      if (isPresenterMessage(event.data) && event.data.type === "goto") {
        gotos.push(event.data);
      }
    });

    main.postMessage({
      type: "state",
      sessionId: "sess-b",
      fileId: "f1",
      slideIndex: 0,
      slideCount: 3,
      notes: "n",
      title: "t",
      prevTitle: null,
      nextTitle: "next",
      deckRevision: 1,
    });

    await screen.findByTestId("presenter-notes");
    fireEvent.click(screen.getByRole("button", { name: /下一页/ }));

    await waitFor(() => {
      expect(gotos.some((m) => m.type === "goto" && m.slideIndex === 1)).toBe(true);
    });
  });
});
