import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Graph, idOf, positionOf, treeToGraphData } from "@antv/g6";
import type { Outline } from "../hooks/useApi";
import { fetchOutline } from "../hooks/useApi";
import { buildFileUrl } from "../utils/groups";
import { OutlineTreeList } from "./OutlineTreeList";
import {
  collectDefaultCollapsedIds,
  outlineToTreeData,
  OUTLINE_TREE_ROOT_ID,
  type OutlineTreeNode,
} from "./outlineTreeModel";

const MANY_FILES_THRESHOLD = 6;
const LAYOUT_DIRECTION_KEY = "markview-outline-layout-direction";
const PRESENTATION_KEY = "markview-outline-tree-mode";

type Presentation = "list" | "mindmap";

function readPresentation(): Presentation {
  try {
    const v = localStorage.getItem(PRESENTATION_KEY);
    if (v === "list" || v === "mindmap") return v;
  } catch {
    /* ignore */
  }
  return "list";
}

function getNodeWidth(text: string, isRoot: boolean): number {
  const padding = isRoot ? 40 : 24;
  const len = typeof text === "string" ? text.length : 0;
  return Math.max(60, Math.min(len * 8 + padding, 240));
}

function getNodeSize(
  d: { data?: { value?: string }; value?: string },
  isRoot: boolean,
): [number, number] {
  const text = (d.value ?? d.data?.value ?? "") as string;
  const width = getNodeWidth(text, isRoot);
  const height = isRoot ? 40 : 36;
  return [width, height];
}

function getNodeSide(
  nodeData: { id: string; style?: { x?: number; y?: number } },
  parentData: { id: string; style?: { x?: number; y?: number } } | undefined,
): "left" | "right" | "center" {
  if (!parentData) return "center";
  const nodePos = positionOf(nodeData);
  const parentPos = positionOf(parentData);
  return parentPos[0] > nodePos[0] ? "left" : "right";
}

interface OutlineTreeViewProps {
  onClose: () => void;
  onSelectFile?: (fileId: string, group: string) => void;
  embedded?: boolean;
}

export function OutlineTreeView({ onClose, onSelectFile, embedded = false }: OutlineTreeViewProps) {
  const [outline, setOutline] = useState<Outline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [presentation, setPresentation] = useState<Presentation>(() => readPresentation());
  const [layoutDirection, setLayoutDirection] = useState<"H" | "V">(() => {
    try {
      const v = localStorage.getItem(LAYOUT_DIRECTION_KEY);
      if (v === "V" || v === "H") return v;
    } catch {
      /* ignore */
    }
    return "V";
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<InstanceType<typeof Graph> | null>(null);

  const setPresentationMode = useCallback((mode: Presentation) => {
    setPresentation(mode);
    try {
      localStorage.setItem(PRESENTATION_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleLayoutDirection = useCallback(() => {
    setLayoutDirection((prev) => {
      const next = prev === "H" ? "V" : "H";
      try {
        localStorage.setItem(LAYOUT_DIRECTION_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchOutline()
      .then((data) => {
        if (!cancelled) {
          setOutline(data);
          setCollapsedIds(collectDefaultCollapsedIds(data));
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load outline");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCollapse = useCallback((nodeId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const handleNodeClick = useCallback(
    (_nodeId: string, d: OutlineTreeNode["data"]) => {
      if (d.isLink && d.targetFileId && d.targetGroup) {
        if (onSelectFile) {
          onSelectFile(d.targetFileId, d.targetGroup);
          return;
        }
        const path = buildFileUrl(d.targetGroup, d.targetFileId);
        window.open(`${window.location.origin}${path}`, "_blank", "noopener,noreferrer");
      } else if ((d.isFile || d.isH1 || (d.isH2 && !d.hasLinks)) && d.fileId && d.group) {
        if (onSelectFile) {
          onSelectFile(d.fileId, d.group);
          return;
        }
        const path = buildFileUrl(d.group, d.fileId);
        window.open(`${window.location.origin}${path}`, "_blank", "noopener,noreferrer");
      }
    },
    [onSelectFile],
  );

  const handleListOpen = useCallback(
    (data: OutlineTreeNode["data"]) => {
      handleNodeClick("", data);
    },
    [handleNodeClick],
  );

  const treeRoot = useMemo(
    () => (outline ? outlineToTreeData(outline, collapsedIds) : null),
    [outline, collapsedIds],
  );

  useEffect(() => {
    if (presentation !== "mindmap") return;
    if (!outline || outline.files.length === 0 || !containerRef.current) return;

    const treeData = outlineToTreeData(outline, collapsedIds);
    const graphData = treeToGraphData(treeData, {
      getNodeData: (datum, depth) => {
        const node = datum as OutlineTreeNode;
        const value = node.data?.value ?? node.id;
        const base = node.children
          ? { id: node.id, data: node.data, depth, children: node.children.map((c) => c.id) }
          : { id: node.id, data: node.data, depth };
        return { ...base, value };
      },
      getChildren: (datum) => (datum as OutlineTreeNode).children ?? [],
    });

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const textColor = isDark ? "#e6edf3" : "#1f2328";
    const fillColor = isDark ? "#161b22" : "#ffffff";
    const rootFill = isDark ? "#21262d" : "#f6f8fa";
    const strokeColor = isDark ? "#8b949e" : "#656d76";

    const rootId = OUTLINE_TREE_ROOT_ID;
    let g: InstanceType<typeof Graph> | null = null;

    const graph = new Graph({
      container: containerRef.current,
      width: containerRef.current.offsetWidth,
      height: containerRef.current.offsetHeight,
      data: graphData,
      autoFit: "view",
      layout: {
        type: "mindmap",
        direction: layoutDirection,
        getHeight: () => 36,
        getWidth: (node: { id: string; data?: { value?: string }; value?: string }) =>
          getNodeWidth((node.value ?? node.data?.value ?? "") as string, node.id === rootId),
        getVGap: () => 24,
        getHGap: () => ((outline?.files.length ?? 0) > MANY_FILES_THRESHOLD ? 24 : 48),
        animation: false,
      },
      node: {
        style: (d) => {
          const nodeId = idOf(d);
          const isRoot = nodeId === rootId;
          const parent = g?.getParentData?.(nodeId, "tree");
          const direction = getNodeSide(d, parent);
          const data = d.data as OutlineTreeNode["data"];
          const collapsed = collapsedIds.has(nodeId);
          const hasChildren = (d as { children?: unknown[] }).children?.length;
          const canCollapse =
            collapsed ||
            (nodeId === rootId && hasChildren) ||
            (data?.isFile && data?.hasChildren) ||
            (data?.isH1 && data?.hasChildren) ||
            (data?.isH2 && data?.hasLinks) ||
            (data?.isLink && data?.hasChildren);
          const displayText = (d.value ?? d.data?.value ?? "") as string;
          const isRootNode = nodeId === rootId;
          const labelText = isRootNode
            ? displayText
            : canCollapse
              ? `${collapsed ? "▶ " : "▼ "}${displayText}`
              : displayText;
          const baseSize = getNodeSize(d, isRoot);
          const size: [number, number] = canCollapse ? [baseSize[0] + 20, baseSize[1]] : baseSize;
          return {
            size,
            fill: isRoot ? rootFill : fillColor,
            stroke: isRoot && !canCollapse ? "transparent" : strokeColor,
            lineWidth: 1,
            radius: 6,
            labelText,
            labelFill: textColor,
            labelFontSize: 14,
            labelFontWeight: isRoot ? 600 : 400,
            labelPlacement: "center",
            labelMaxWidth: 220,
            labelTextOverflow: "ellipsis",
            labelBackground: false,
            labelPadding: direction === "left" ? [2, 0, 10, 40] : [2, 40, 10, 0],
            visibility: "visible" as const,
            cursor: canCollapse ? "pointer" : undefined,
            ports: isRoot
              ? [{ placement: "right" }, { placement: "left" }]
              : [{ placement: "right-bottom" }, { placement: "left-bottom" }],
          };
        },
      },
      edge: {
        type: "cubic-horizontal",
        style: () => ({ lineWidth: 1.5, stroke: strokeColor }),
      },
      behaviors: [
        { type: "scroll-canvas", key: "scroll-canvas" },
        { type: "drag-canvas", key: "drag-canvas" },
        { type: "zoom-canvas", key: "zoom-canvas" },
      ],
    });

    g = graph;
    graph.render();

    const handleClick = (evt: unknown) => {
      const e = evt as {
        target?: { id?: string };
        ctrlKey?: boolean;
        metaKey?: boolean;
        nativeEvent?: { ctrlKey?: boolean; metaKey?: boolean };
      };
      const nodeId = e.target?.id;
      if (!nodeId) return;
      const nodeData = graph.getNodeData(nodeId);
      const data = nodeData?.data as OutlineTreeNode["data"] | undefined;
      const canCollapse =
        (data?.isFile && data?.hasChildren) ||
        (data?.isH1 && data?.hasChildren) ||
        (data?.isH2 && data?.hasLinks) ||
        (data?.isLink && data?.hasChildren);
      const canOpen = data?.isLink || (data?.isH2 && !data?.hasLinks) || data?.isFile || data?.isH1;
      const modifier = e.ctrlKey || e.metaKey || e.nativeEvent?.ctrlKey || e.nativeEvent?.metaKey;
      if (modifier && canOpen && data) {
        handleNodeClick(nodeId, data);
      } else if (canCollapse) {
        toggleCollapse(nodeId);
      } else if (data) {
        handleNodeClick(nodeId, data);
      }
    };

    graph.on("node:click", handleClick as (evt: unknown) => void);
    graphRef.current = graph;

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && graphRef.current && !graphRef.current.destroyed) {
        graphRef.current.setSize(
          containerRef.current.offsetWidth,
          containerRef.current.offsetHeight,
        );
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      graph.off("node:click", handleClick);
      graph.destroy();
      graphRef.current = null;
    };
  }, [presentation, outline, collapsedIds, layoutDirection, handleNodeClick, toggleCollapse]);

  const header = (
    <div className="flex shrink-0 flex-wrap items-center gap-2 pb-2">
      {!embedded && (
        <button
          type="button"
          className="rounded-md border border-gh-border bg-transparent px-2 py-1.5 text-sm text-gh-text-secondary hover:bg-gh-bg-hover"
          onClick={onClose}
        >
          返回文档
        </button>
      )}
      <div className="inline-flex rounded-md border border-gh-border overflow-hidden" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={presentation === "list"}
          className={`px-3 py-1.5 text-sm cursor-pointer ${
            presentation === "list"
              ? "bg-gh-bg-hover text-gh-text"
              : "bg-transparent text-gh-text-secondary hover:bg-gh-bg-hover"
          }`}
          onClick={() => setPresentationMode("list")}
        >
          大纲
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={presentation === "mindmap"}
          className={`px-3 py-1.5 text-sm cursor-pointer border-l border-gh-border ${
            presentation === "mindmap"
              ? "bg-gh-bg-hover text-gh-text"
              : "bg-transparent text-gh-text-secondary hover:bg-gh-bg-hover"
          }`}
          onClick={() => setPresentationMode("mindmap")}
        >
          导图
        </button>
      </div>
      {presentation === "mindmap" && (
        <button
          type="button"
          className="rounded-md border border-gh-border bg-transparent px-2 py-1.5 text-sm text-gh-text-secondary hover:bg-gh-bg-hover"
          onClick={toggleLayoutDirection}
          title={
            layoutDirection === "H"
              ? "横向布局（文件多时较宽），点击切换为纵向"
              : "纵向布局（文件上下排列），点击切换为横向"
          }
        >
          {layoutDirection === "H" ? "横向" : "纵向"}
        </button>
      )}
      <span className="text-sm text-gh-text-secondary">
        {presentation === "list"
          ? "大纲：折叠层级，点击打开文档"
          : embedded
            ? "导图：折叠节点；点击在右侧打开"
            : "导图：折叠节点；Ctrl/Cmd+点击打开"}
      </span>
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        {header}
        <div className="flex flex-1 items-center justify-center text-sm text-gh-text-secondary">
          加载中…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        {header}
        <div className="flex flex-1 items-center justify-center text-sm text-red-500">{error}</div>
      </div>
    );
  }

  if (!outline || outline.files.length === 0 || !treeRoot) {
    return (
      <div className="flex flex-col h-full">
        {header}
        <div className="flex flex-1 items-center justify-center text-sm text-gh-text-secondary">
          暂无文档或标题
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {header}
      {presentation === "list" ? (
        <OutlineTreeList
          root={treeRoot}
          collapsedIds={collapsedIds}
          onToggleCollapse={toggleCollapse}
          onOpenNode={handleListOpen}
        />
      ) : (
        <div
          ref={containerRef}
          className="min-h-0 flex-1"
          style={{ minHeight: 300 }}
          data-testid="outline-tree-mindmap"
        />
      )}
    </div>
  );
}
