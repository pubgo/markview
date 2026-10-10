import { useCallback, useEffect, useState } from "react";
import { isStaticMode } from "../utils/staticData";
import {
  restartServer,
  fetchVersion,
  checkForUpdate,
  applyUpdate,
  type VersionInfo,
} from "../hooks/useApi";

type Status = "idle" | "restarting" | "updating";

export function RestartButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [updateInfo, setUpdateInfo] = useState<{ latest: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    fetchVersion()
      .then(setVersion)
      .catch(() => {});
    if (isStaticMode()) return;
    checkForUpdate()
      .then((check) => {
        if (check.available) setUpdateInfo({ latest: check.latest });
      })
      .catch(() => {});
  }, []);

  const pollUntilReady = useCallback((previousVersion: string) => {
    const poll = (attempt: number) => {
      setTimeout(async () => {
        try {
          const info = await fetchVersion();
          // Reload once the server answers with the upgraded version, or
          // after a minute regardless (the restart may race the poll).
          if (info.version !== previousVersion || attempt >= 30) {
            window.location.reload();
            return;
          }
          poll(attempt + 1);
        } catch {
          poll(attempt + 1);
        }
      }, 1000);
    };
    poll(0);
  }, []);

  const handleClick = useCallback(async () => {
    if (status !== "idle") return;

    // With a newer release available the button upgrades instead of merely
    // restarting. The upgrade is confirmed with a second click so a stray
    // click on the badge never kicks off a multi-minute download.
    if (updateInfo) {
      if (!confirming) {
        setConfirming(true);
        setTimeout(() => setConfirming(false), 5000);
        return;
      }
      setConfirming(false);
      setStatus("updating");
      try {
        await applyUpdate();
      } catch (err) {
        window.alert(`升级失败:${err instanceof Error ? err.message : String(err)}`);
        setStatus("idle");
        return;
      }
      pollUntilReady(version?.version ?? "");
      return;
    }

    setStatus("restarting");
    try {
      await restartServer();
    } catch {
      // Server may close before responding
    }
    pollUntilReady(version?.version ?? "");
  }, [status, updateInfo, confirming, version, pollUntilReady]);

  const title =
    status === "updating"
      ? "正在升级..."
      : updateInfo
        ? confirming
          ? `再次点击确认升级到 ${updateInfo.latest}`
          : `有新版本 ${updateInfo.latest}(当前 ${version?.version ?? "?"})\n点击升级`
        : version
          ? `markview ${version.version} (${version.revision})\nClick to restart`
          : "Restart server";

  return (
    <>
      <button
        className="fixed bottom-4 right-4 flex items-center justify-center bg-transparent border border-gh-border rounded-md p-1.5 text-gh-text-secondary cursor-pointer transition-colors duration-150 hover:bg-gh-bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleClick}
        disabled={status !== "idle"}
        title={title}
      >
        <span className="relative">
          <svg
            className={`size-5${status !== "idle" ? " animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M20.016 4.356v4.992"
            />
          </svg>
          {updateInfo && status === "idle" && (
            <span className="absolute -top-1 -right-1 size-2 rounded-full bg-orange-400" />
          )}
        </span>
      </button>
      {status !== "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gh-bg/80">
          <div className="flex items-center gap-3 text-gh-text-secondary">
            <svg
              className="size-6 animate-spin"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M20.016 4.356v4.992"
              />
            </svg>
            <span className="text-lg">
              {status === "updating" ? "正在升级,下载并重启服务..." : "Restarting..."}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
