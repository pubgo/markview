import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildPresenterRelayUrls,
  isPresenterMessage,
  type PresenterState,
} from "../utils/slidesPresenterChannel";

type PresenterTeleprompterProps = {
  sessionId: string;
  /** Use the server relay (SSE + POST) instead of BroadcastChannel so other devices can control the deck. */
  remote?: boolean;
};

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function PresenterTeleprompter({ sessionId, remote = false }: PresenterTeleprompterProps) {
  const [state, setState] = useState<PresenterState | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const postGotoRef = useRef<((slideIndex: number) => void) | null>(null);

  // Elapsed talk timer: starts on mount, pausable, resettable.
  const [elapsedMs, setElapsedMs] = useState(0);
  const [timerRunning, setTimerRunning] = useState(true);
  const timerBaseRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!timerRunning) return;
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - timerBaseRef.current);
    }, 500);
    return () => window.clearInterval(timer);
  }, [timerRunning]);

  const toggleTimer = useCallback(() => {
    setTimerRunning((running) => {
      if (running) {
        setElapsedMs(Date.now() - timerBaseRef.current);
      } else {
        timerBaseRef.current = Date.now() - elapsedMs;
      }
      return !running;
    });
  }, [elapsedMs]);

  const resetTimer = useCallback(() => {
    timerBaseRef.current = Date.now();
    setElapsedMs(0);
    setTimerRunning(true);
  }, []);

  useEffect(() => {
    if (remote) {
      // Server-relay transport: works from any device that can reach the
      // markview server (e.g. a phone on the same LAN).
      const { eventsUrl, postUrl } = buildPresenterRelayUrls(sessionId);
      postGotoRef.current = (slideIndex: number) => {
        void fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "goto", sessionId, slideIndex }),
        }).catch(() => {});
      };
      const source = new EventSource(eventsUrl);
      source.addEventListener("message", (event: MessageEvent<string>) => {
        try {
          const data: unknown = JSON.parse(event.data);
          if (isPresenterMessage(data) && data.type === "state") {
            setState(data);
          }
        } catch {
          // Ignore malformed payloads.
        }
      });
      return () => {
        source.close();
        postGotoRef.current = null;
      };
    }

    const channel = new BroadcastChannel("markview-slides-presenter");
    channelRef.current = channel;
    postGotoRef.current = (slideIndex: number) => {
      channel.postMessage({ type: "goto", sessionId, slideIndex });
    };
    const onMessage = (event: MessageEvent) => {
      if (!isPresenterMessage(event.data)) return;
      if (event.data.sessionId !== sessionId) return;
      if (event.data.type === "state") {
        setState(event.data);
      }
    };
    channel.addEventListener("message", onMessage);
    channel.postMessage({ type: "hello", sessionId });
    return () => {
      channel.removeEventListener("message", onMessage);
      channel.close();
      channelRef.current = null;
      postGotoRef.current = null;
    };
  }, [sessionId, remote]);

  const goRelative = useCallback(
    (delta: number) => {
      if (!state) return;
      const nextIndex = Math.min(state.slideCount - 1, Math.max(0, state.slideIndex + delta));
      if (nextIndex === state.slideIndex) return;
      postGotoRef.current?.(nextIndex);
    },
    [state],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!state) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      let delta: number | null = null;
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(event.key)) {
        delta = 1;
      } else if (["ArrowLeft", "PageUp"].includes(event.key)) {
        delta = -1;
      }
      if (delta == null) return;
      event.preventDefault();
      goRelative(delta);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goRelative, state]);

  const hasNotes = Boolean(state?.notes.trim());

  return (
    <div className="presenter-teleprompter" data-testid="presenter-teleprompter">
      <header className="presenter-teleprompter__header">
        <div className="presenter-teleprompter__brand">
          提词器
          {remote && <span className="presenter-teleprompter__remote-badge">远程</span>}
        </div>
        <div className="presenter-teleprompter__page" data-testid="presenter-page">
          {state ? `${state.slideIndex + 1} / ${state.slideCount}` : "— / —"}
        </div>
      </header>

      <div className="presenter-teleprompter__timer" data-testid="presenter-timer">
        <span className={`presenter-teleprompter__clock${timerRunning ? "" : " is-paused"}`}>
          {formatElapsed(elapsedMs)}
        </span>
        <div className="presenter-teleprompter__timer-actions">
          <button type="button" onClick={toggleTimer} data-testid="presenter-timer-toggle">
            {timerRunning ? "暂停" : "继续"}
          </button>
          <button type="button" onClick={resetTimer} data-testid="presenter-timer-reset">
            归零
          </button>
        </div>
      </div>

      {!state ? (
        <p className="presenter-teleprompter__waiting">等待主窗口同步…</p>
      ) : (
        <>
          <p className="presenter-teleprompter__slide" data-testid="presenter-title">
            {state.title}
          </p>
          <pre
            className={`presenter-teleprompter__notes${hasNotes ? "" : " presenter-teleprompter__notes--empty"}`}
            data-testid="presenter-notes"
          >
            {hasNotes ? state.notes : "（本页无备注）"}
          </pre>
          <footer className="presenter-teleprompter__footer">
            <button
              type="button"
              className="presenter-teleprompter__nav"
              onClick={() => goRelative(-1)}
              disabled={!state.prevTitle && state.slideIndex === 0}
            >
              <span className="presenter-teleprompter__nav-label">上一页</span>
              <span className="presenter-teleprompter__nav-title">{state.prevTitle ?? "—"}</span>
            </button>
            <button
              type="button"
              className="presenter-teleprompter__nav"
              onClick={() => goRelative(1)}
              disabled={!state.nextTitle && state.slideIndex >= state.slideCount - 1}
            >
              <span className="presenter-teleprompter__nav-label">下一页</span>
              <span className="presenter-teleprompter__nav-title">{state.nextTitle ?? "—"}</span>
            </button>
          </footer>
        </>
      )}
    </div>
  );
}
