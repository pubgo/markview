import { useEffect, useMemo, useRef, useState } from "react";
import type { Group } from "../hooks/useApi";
import { fetchFileContent } from "../hooks/useApi";
import { extractFromFiles, type ExtractHit, type ExtractKind } from "../utils/contentExtract";

export interface ContentExtractSelection {
  groupName: string;
  fileId: string;
  lineNumber: number;
  lineText: string;
  query: string;
}

interface ContentExtractControlProps {
  isOpen: boolean;
  group: Group | undefined;
  onClose: () => void;
  onSelect: (selection: ContentExtractSelection) => void;
  onToggle: () => void;
}

type Tab = ExtractKind;

export function ContentExtractControl({
  isOpen,
  group,
  onClose,
  onSelect,
  onToggle,
}: ContentExtractControlProps) {
  const [tab, setTab] = useState<Tab>("todo");
  const [showDone, setShowDone] = useState(false);
  const [hits, setHits] = useState<ExtractHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTab("todo");
    setShowDone(false);

    const files = group?.files ?? [];
    if (files.length === 0) {
      setHits([]);
      setLoading(false);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    void (async () => {
      const loaded = await Promise.all(
        files.map(async (file) => {
          try {
            const res = await fetchFileContent(file.id);
            return {
              ok: true as const,
              file: {
                fileId: file.id,
                fileName: file.name,
                groupName: group!.name,
                content: res.content,
              },
            };
          } catch {
            return { ok: false as const };
          }
        }),
      );
      if (cancelled) return;
      const okFiles = loaded.flatMap((item) => (item.ok ? [item.file] : []));
      const failed = loaded.length - okFiles.length;
      setHits(extractFromFiles(okFiles));
      setLoading(false);
      setLoadError(failed > 0 ? `有 ${failed} 个文件读取失败` : null);
    })();

    return () => {
      cancelled = true;
    };
  }, [group, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    const onPointerDown = (e: MouseEvent) => {
      const root = rootRef.current;
      if (root && !root.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointerDown);
    };
  }, [isOpen, onClose]);

  const visible = useMemo(() => {
    if (tab === "todo") {
      return hits.filter((h) => h.kind === "todo" && (showDone || !h.done));
    }
    return hits.filter((h) => h.kind === tab);
  }, [hits, showDone, tab]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={`flex items-center justify-center gap-1 rounded-md px-2 py-1.5 cursor-pointer transition-colors duration-150 border ${
          isOpen
            ? "bg-gh-bg-hover border-gh-border"
            : "bg-transparent border-gh-border hover:bg-gh-bg-hover"
        } text-gh-header-text`}
        onClick={onToggle}
        aria-label="Content extract"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title={isOpen ? "关闭提炼" : "提炼（TODO / #tag# / [[wiki]]）"}
      >
        <svg
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
        </svg>
        <span className="text-sm leading-none whitespace-nowrap">提炼</span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="内容提炼"
          className="absolute left-0 top-full mt-1 z-50 w-[min(100vw-2rem,22rem)] max-h-[min(70vh,28rem)] flex flex-col bg-gh-bg-secondary border border-gh-border rounded-xl shadow-xl overflow-hidden"
        >
          <div className="flex items-center gap-1 p-2 border-b border-gh-border">
            {(
              [
                ["todo", "TODO"],
                ["tag", "标签"],
                ["topic", "话题"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`px-2 py-1 text-xs rounded-md border ${
                  tab === id
                    ? "bg-gh-bg-hover border-gh-border text-gh-text"
                    : "bg-transparent border-transparent text-gh-text-secondary hover:bg-gh-bg-hover"
                }`}
                onClick={() => setTab(id)}
                aria-pressed={tab === id}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "todo" && (
            <label className="flex items-center gap-2 px-3 py-2 text-xs text-gh-text-secondary border-b border-gh-border cursor-pointer">
              <input
                type="checkbox"
                checked={showDone}
                onChange={(e) => setShowDone(e.target.checked)}
              />
              显示已完成
            </label>
          )}

          {tab === "tag" && (
            <p className="px-3 py-1.5 text-[11px] text-gh-text-secondary border-b border-gh-border">
              正文标签格式：#hello#（两端 #）；另含 frontmatter tags
            </p>
          )}

          {tab === "topic" && (
            <p className="px-3 py-1.5 text-[11px] text-gh-text-secondary border-b border-gh-border">
              仅 [[wiki]] 双括号；普通 [text](url) 不算话题
            </p>
          )}

          <div className="flex-1 overflow-y-auto p-1">
            {loading && <p className="px-2 py-3 text-sm text-gh-text-secondary">正在扫描…</p>}
            {!loading && visible.length === 0 && (
              <p className="px-2 py-3 text-sm text-gh-text-secondary">当前分组没有可展示项</p>
            )}
            {!loading &&
              visible.map((hit, index) => (
                <button
                  key={`${hit.kind}-${hit.fileId}-${hit.lineNumber}-${hit.key}-${index}`}
                  type="button"
                  className="w-full text-left px-2 py-2 rounded-md hover:bg-gh-bg-hover transition-colors"
                  onClick={() => {
                    onSelect({
                      groupName: hit.groupName,
                      fileId: hit.fileId,
                      lineNumber: hit.lineNumber,
                      lineText: hit.lineText,
                      query: hit.query,
                    });
                    onClose();
                  }}
                >
                  <p className="text-sm text-gh-text font-medium break-all">
                    {hit.kind === "todo" && (
                      <span className="mr-1 text-gh-text-secondary">{hit.done ? "☑" : "☐"}</span>
                    )}
                    {hit.label}
                  </p>
                  <p className="mt-0.5 text-xs text-gh-text-secondary">
                    {hit.fileName}
                    <span className="ml-2">L{hit.lineNumber}</span>
                  </p>
                </button>
              ))}
            {loadError && <p className="px-2 py-2 text-xs text-red-500">{loadError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/** @deprecated use ContentExtractControl */
export const ContentExtractToggle = ContentExtractControl;
export const ContentExtractPanel = ContentExtractControl;
