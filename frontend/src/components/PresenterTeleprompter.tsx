import { useEffect, useRef, useState } from "react";
import {
  PRESENTER_CHANNEL,
  isPresenterMessage,
  type PresenterState,
} from "../utils/slidesPresenterChannel";

type PresenterTeleprompterProps = {
  sessionId: string;
};

export function PresenterTeleprompter({ sessionId }: PresenterTeleprompterProps) {
  const [state, setState] = useState<PresenterState | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const channel = new BroadcastChannel(PRESENTER_CHANNEL);
    channelRef.current = channel;

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
    };
  }, [sessionId]);

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

      let nextIndex: number | null = null;
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(event.key)) {
        nextIndex = Math.min(state.slideCount - 1, state.slideIndex + 1);
      } else if (["ArrowLeft", "PageUp"].includes(event.key)) {
        nextIndex = Math.max(0, state.slideIndex - 1);
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = Math.max(0, state.slideCount - 1);
      }

      if (nextIndex == null || nextIndex === state.slideIndex) return;
      event.preventDefault();
      channelRef.current?.postMessage({
        type: "goto",
        sessionId,
        slideIndex: nextIndex,
      });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sessionId, state]);

  const goRelative = (delta: number) => {
    if (!state) return;
    const nextIndex = Math.min(state.slideCount - 1, Math.max(0, state.slideIndex + delta));
    if (nextIndex === state.slideIndex) return;
    channelRef.current?.postMessage({
      type: "goto",
      sessionId,
      slideIndex: nextIndex,
    });
  };

  const hasNotes = Boolean(state?.notes.trim());

  return (
    <div className="presenter-teleprompter" data-testid="presenter-teleprompter">
      <header className="presenter-teleprompter__header">
        <div className="presenter-teleprompter__brand">提词器</div>
        <div className="presenter-teleprompter__page" data-testid="presenter-page">
          {state ? `${state.slideIndex + 1} / ${state.slideCount}` : "— / —"}
        </div>
      </header>

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
