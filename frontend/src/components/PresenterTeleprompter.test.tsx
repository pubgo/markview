import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor, fireEvent } from "@testing-library/react";
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

  it("tracks elapsed time with pause and reset", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<PresenterTeleprompter sessionId="sess-timer" />);
      await waitFor(() => expect(MockBroadcastChannel.instances.length).toBeGreaterThanOrEqual(1));

      const clockText = () => screen.getByTestId("presenter-timer").textContent;

      // Starts running from mount: the clock advances with time.
      act(() => {
        vi.advanceTimersByTime(3100);
      });
      const running = clockText();
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(clockText()).not.toBe(running);

      // Pause freezes the clock.
      fireEvent.click(screen.getByTestId("presenter-timer-toggle"));
      expect(screen.getByText("继续")).toBeInTheDocument();
      const frozen = clockText();
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(clockText()).toBe(frozen);

      // Resume keeps counting from the frozen value.
      fireEvent.click(screen.getByTestId("presenter-timer-toggle"));
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(clockText()).not.toBe(frozen);

      // Reset returns to zero and keeps running.
      fireEvent.click(screen.getByTestId("presenter-timer-reset"));
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(clockText()).toMatch(/^00:0[01]/);
      expect(screen.getByText("暂停")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  }, 10000);
});

describe("PresenterTeleprompter remote mode", () => {
  class MockEventSource {
    static instances: MockEventSource[] = [];
    url: string;
    closed = false;
    private listeners = new Map<string, Array<(event: MessageEvent<string>) => void>>();

    constructor(url: string) {
      this.url = url;
      MockEventSource.instances.push(this);
    }

    addEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
      const list = this.listeners.get(type) ?? [];
      list.push(listener);
      this.listeners.set(type, list);
    }

    emit(type: string, data: string) {
      for (const listener of this.listeners.get(type) ?? []) {
        listener({ data } as MessageEvent<string>);
      }
    }

    close() {
      this.closed = true;
    }
  }

  const postCalls: Array<{ url: string; body: unknown }> = [];

  beforeEach(() => {
    MockEventSource.instances = [];
    postCalls.length = 0;
    vi.stubGlobal("EventSource", MockEventSource);
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        postCalls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
        return Promise.resolve(new Response(null, { status: 204 }));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const state = {
    type: "state",
    sessionId: "sess-remote",
    fileId: "f1",
    slideIndex: 1,
    slideCount: 5,
    notes: "远程备注",
    title: "远程页",
    prevTitle: "上一页",
    nextTitle: "下一页",
    deckRevision: 1,
  };

  it("receives state via EventSource and posts goto via fetch", async () => {
    render(<PresenterTeleprompter sessionId="sess-remote" remote />);

    await waitFor(() => expect(MockEventSource.instances.length).toBe(1));
    expect(MockEventSource.instances[0].url).toBe(
      "http://localhost:3000/_/api/presenter/sess-remote/events",
    );

    MockEventSource.instances[0].emit("message", JSON.stringify(state));
    await screen.findByTestId("presenter-notes");
    expect(screen.getByTestId("presenter-notes")).toHaveTextContent("远程备注");

    fireEvent.click(screen.getByRole("button", { name: /下一页/ }));
    await waitFor(() => {
      expect(postCalls.length).toBe(1);
    });
    expect(postCalls[0].url).toBe("http://localhost:3000/_/api/presenter/sess-remote/messages");
    expect(postCalls[0].body).toMatchObject({ type: "goto", slideIndex: 2 });

    expect(MockBroadcastChannel.instances.length).toBe(0);
  });

  it("toggles main-window notes via a config message", async () => {
    render(<PresenterTeleprompter sessionId="sess-remote" remote />);

    await waitFor(() => expect(MockEventSource.instances.length).toBe(1));
    MockEventSource.instances[0].emit("message", JSON.stringify(state));
    await screen.findByTestId("presenter-notes");

    // Remote sessions start with the projector notes hidden.
    const toggle = screen.getByTestId("presenter-notes-toggle");
    expect(toggle.textContent).toContain("关");

    fireEvent.click(toggle);
    await waitFor(() => expect(postCalls.length).toBe(1));
    expect(postCalls[0].body).toMatchObject({ type: "config", notesVisible: true });
    expect(toggle.textContent).toContain("开");

    fireEvent.click(toggle);
    await waitFor(() => expect(postCalls.length).toBe(2));
    expect(postCalls[1].body).toMatchObject({ type: "config", notesVisible: false });
  });
});
