import type { OutlineTreeNode } from "./outlineTreeModel";

export interface OutlineTreeListProps {
  root: OutlineTreeNode;
  collapsedIds: Set<string>;
  onToggleCollapse: (nodeId: string) => void;
  onOpenNode: (data: OutlineTreeNode["data"]) => void;
}

function visibleRows(root: OutlineTreeNode, collapsedIds: Set<string>): OutlineTreeNode[] {
  const rows: OutlineTreeNode[] = [];
  function walk(node: OutlineTreeNode, skipSelf: boolean) {
    if (!skipSelf) rows.push(node);
    const collapsed = collapsedIds.has(node.id);
    const kids = node.children;
    if (!collapsed && kids?.length) {
      for (const child of kids) walk(child, false);
    }
  }
  // Skip synthetic root; start at file children.
  for (const child of root.children ?? []) walk(child, false);
  return rows;
}

export function OutlineTreeList({
  root,
  collapsedIds,
  onToggleCollapse,
  onOpenNode,
}: OutlineTreeListProps) {
  const rows = visibleRows(root, collapsedIds);

  return (
    <div className="min-h-0 flex-1 overflow-auto py-1" data-testid="outline-tree-list">
      {rows.map((node) => {
        const depth = node.data.depth ?? 1;
        const canCollapse = !!node.data.hasChildren || (node.children?.length ?? 0) > 0;
        const collapsed = collapsedIds.has(node.id);
        const pad = Math.max(0, depth - 1) * 16;

        return (
          <div
            key={node.id}
            className="group flex items-center gap-0.5 rounded-md px-1 py-0.5 text-sm text-gh-text hover:bg-gh-bg-hover"
            style={{ paddingLeft: pad + 4 }}
          >
            {canCollapse ? (
              <button
                type="button"
                className="flex size-5 shrink-0 items-center justify-center rounded text-gh-text-secondary hover:bg-gh-bg-active"
                data-testid={`outline-tree-toggle-${node.id}`}
                aria-label={collapsed ? `expand ${node.data.value}` : `collapse ${node.data.value}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse(node.id);
                }}
              >
                <span className="text-[10px] leading-none">{collapsed ? "▶" : "▼"}</span>
              </button>
            ) : (
              <span className="inline-block size-5 shrink-0" aria-hidden />
            )}
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left bg-transparent border-0 cursor-pointer text-gh-text"
              onClick={() => onOpenNode(node.data)}
              title={node.data.value}
            >
              {node.data.value}
            </button>
          </div>
        );
      })}
    </div>
  );
}
