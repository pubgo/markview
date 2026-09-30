import { useCallback, useEffect, useState } from "react";

type LanHint = { ip: string; port: string };

type PresenterQrButtonProps = {
  /** Active presenter session; the button ensures one exists before showing the QR. */
  sessionId: string | null;
  /** Creates a presenter session without opening the desktop teleprompter popup. */
  onEnsureSession: () => void;
};

/**
 * Slides-toolbar button that shows a scannable QR code of the presenter
 * remote URL, so a phone on the same LAN can act as the teleprompter.
 */
export function PresenterQrButton({ sessionId, onEnsureSession }: PresenterQrButtonProps) {
  const [open, setOpen] = useState(false);
  const [lan, setLan] = useState<LanHint | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const ensureSession = useCallback(() => {
    setOpen((prev) => !prev);
    if (!sessionId) onEnsureSession();
  }, [onEnsureSession, sessionId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/_/api/lan-hint")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("unavailable"))))
      .then((hint: LanHint) => {
        if (!cancelled && hint.ip) setLan(hint);
        else if (!cancelled) setUnavailable(true);
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const remoteUrl =
    lan && sessionId
      ? `http://${lan.ip}:${lan.port}/?presenter=1&session=${sessionId}&remote=1`
      : null;

  return (
    <div className="presenter-qr" data-testid="presenter-qr">
      <button
        type="button"
        className="presenter-qr__toggle"
        onClick={ensureSession}
        title="手机扫码作为遥控提词器"
      >
        手机遥控
      </button>
      {open && (
        <div className="presenter-qr__popover" data-testid="presenter-qr-popover">
          <div className="presenter-qr__title">手机扫码遥控</div>
          {remoteUrl ? (
            <>
              <img
                className="presenter-qr__image"
                src={`/_/api/presenter/qr?text=${encodeURIComponent(remoteUrl)}`}
                alt="遥控地址二维码"
                data-testid="presenter-qr-image"
              />
              <div className="presenter-qr__url">{remoteUrl}</div>
              <div className="presenter-qr__hint">手机连同一 Wi-Fi，扫码后即可查看备注并翻页</div>
            </>
          ) : unavailable ? (
            <div className="presenter-qr__hint">未找到局域网地址，无法生成遥控二维码</div>
          ) : (
            <div className="presenter-qr__hint">正在生成二维码…</div>
          )}
        </div>
      )}
    </div>
  );
}
