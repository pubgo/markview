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

  return (
    <div className="presenter-teleprompter" data-testid="presenter-teleprompter">
      <header className="presenter-teleprompter__header">
        <div className="presenter-teleprompter__brand">markview 提词器</div>
        <div className="presenter-teleprompter__page" data-testid="presenter-page">
          {state ? `${state.slideIndex + 1} / ${state.slideCount}` : "— / —"}
        </div>
      </header>

      {!state ? (
        <p className="presenter-teleprompter__waiting">等待主窗口同步…</p>
      ) : (
        <>
          <h1 className="presenter-teleprompter__title" data-testid="presenter-title">
            {state.title}
          </h1>
          <pre className="presenter-teleprompter__notes" data-testid="presenter-notes">
            {state.notes.trim().length > 0 ? state.notes : "（无备注）"}
          </pre>
          <div className="presenter-teleprompter__neighbors">
            <div className="presenter-teleprompter__neighbor">
              <span className="presenter-teleprompter__neighbor-label">上一页</span>
              <span>{state.prevTitle ?? "—"}</span>
            </div>
            <div className="presenter-teleprompter__neighbor">
              <span className="presenter-teleprompter__neighbor-label">下一页</span>
              <span>{state.nextTitle ?? "—"}</span>
            </div>
          </div>
          <div className="presenter-teleprompter__actions">
            <button type="button" onClick={() => goRelative(-1)}>
              上一页
            </button>
            <button type="button" onClick={() => goRelative(1)}>
              下一页
            </button>
          </div>
        </>
      )}
    </div>
  );
}
