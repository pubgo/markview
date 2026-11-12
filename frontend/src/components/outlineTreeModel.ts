import type { Outline } from "../hooks/useApi";

export const OUTLINE_TREE_ROOT_ID = "root";

export const OUTLINE_TREE_COLORS = [
  "#5B8FF9",
  "#F6BD16",
  "#5AD8A6",
  "#945FB9",
  "#E86452",
  "#6DC8EC",
  "#FF99C3",
  "#1E9493",
  "#FF9845",
  "#5D7092",
];

export interface OutlineTreeNodeData extends Record<string, unknown> {
  value: string;
  depth?: number;
  fileId?: string;
  group?: string;
  targetFileId?: string;
  targetGroup?: string;
  isFile?: boolean;
  isH1?: boolean;
  isH2?: boolean;
  isLink?: boolean;
  hasLinks?: boolean;
  hasChildren?: boolean;
  fileColorIndex?: number;
}

export interface OutlineTreeNode {
  id: string;
  data: OutlineTreeNodeData;
  children?: OutlineTreeNode[];
}

type OutlineFile = Outline["files"][number];

const MAX_LINK_DEPTH = 4;
const MANY_FILES_THRESHOLD = 6;

function buildFileOutline(
  file: OutlineFile,
  outline: Outline,
  fileIds: Set<string>,
  fileById: Map<string, OutlineFile>,
  fileColorIndex: number,
  visited: Set<string>,
  depth: number,
  pathPrefix: string,
  collapsedIds: Set<string>,
): OutlineTreeNode[] {
  if (depth >= MAX_LINK_DEPTH || visited.has(file.id)) return [];
  visited.add(file.id);

  const idPrefix = pathPrefix ? `${pathPrefix}_` : "";

  const h1Nodes: OutlineTreeNode[] = [];
  for (let i = 0; i < file.headings.length; i++) {
    const h = file.headings[i];
    if (h.level === 1) {
      const h2Nodes: OutlineTreeNode[] = [];
      for (let j = i + 1; j < file.headings.length; j++) {
        const h2 = file.headings[j];
        if (h2.level === 1) break;
        if (h2.level === 2) {
          const linked = (h2.linkedFileIds ?? []).filter((id) => fileIds.has(id));
          const h2Id = `${idPrefix}n_${file.id}_${j}`.replace(/-/g, "_");

          const linkChildren: OutlineTreeNode[] = [];
          for (const tid of linked) {
            const target = fileById.get(tid);
            const targetFile = outline.files.find((f) => f.id === tid);
            const linkId = `${idPrefix}link_${file.id}_${j}_${tid}`.replace(/-/g, "_");
            const targetColorIdx = targetFile
              ? outline.files.indexOf(targetFile) % OUTLINE_TREE_COLORS.length
              : 0;
            const hasTargetContent = !!targetFile?.headings.length;
            const targetOutline =
              hasTargetContent && !collapsedIds.has(linkId)
                ? buildFileOutline(
                    targetFile,
                    outline,
                    fileIds,
                    fileById,
                    targetColorIdx,
                    new Set(visited),
                    depth + 1,
                    linkId,
                    collapsedIds,
                  )
                : [];

            linkChildren.push({
              id: linkId,
              data: {
                value: `→ ${target?.name ?? tid}`,
                targetFileId: tid,
                targetGroup: target?.group ?? "default",
                isLink: true,
                hasChildren: hasTargetContent,
                fileColorIndex: targetColorIdx,
              },
              children: targetOutline.length > 0 ? targetOutline : undefined,
            });
          }

          const hasLinks = linkChildren.length > 0;
          const h2Collapsed = collapsedIds.has(h2Id);
          h2Nodes.push({
            id: h2Id,
            data: {
              value: h2.text,
              fileId: file.id,
              group: file.group,
              isH2: true,
              hasLinks,
              hasChildren: hasLinks,
              fileColorIndex,
            },
            children: hasLinks && !h2Collapsed ? linkChildren : undefined,
          });
        }
      }

      const h1Id = `${idPrefix}h1_${file.id}_${i}`.replace(/-/g, "_");
      const h1Collapsed = collapsedIds.has(h1Id);
      h1Nodes.push({
        id: h1Id,
        data: {
          value: h.text,
          fileId: file.id,
          group: file.group,
          isH1: true,
          hasChildren: h2Nodes.length > 0,
          fileColorIndex,
        },
        children: h2Nodes.length > 0 && !h1Collapsed ? h2Nodes : undefined,
      });
    }
  }

  visited.delete(file.id);
  return h1Nodes;
}

function findRootFiles(outline: Outline): OutlineFile[] {
  const fileIds = new Set(outline.files.map((f) => f.id));
  const linkedTo = new Set<string>();
  for (const file of outline.files) {
    for (const h of file.headings) {
      for (const tid of h.linkedFileIds ?? []) {
        if (fileIds.has(tid)) linkedTo.add(tid);
      }
    }
  }
  return outline.files.filter((f) => !linkedTo.has(f.id));
}

/** 默认折叠：H2 和链接节点；文档名、H1 展开以展示层级。文件多时默认折叠文件节点以减小宽度。 */
export function collectDefaultCollapsedIds(outline: Outline): Set<string> {
  const ids = new Set<string>();
  const fileIds = new Set(outline.files.map((f) => f.id));
  const safe = (s: string) => s.replace(/-/g, "_");
  const collapseFiles = outline.files.length > MANY_FILES_THRESHOLD;

  function collectFromFile(file: OutlineFile, pathPrefix: string, visited: Set<string>) {
    if (visited.has(file.id)) return;
    visited.add(file.id);
    const prefix = pathPrefix ? `${pathPrefix}_` : "";
    for (let i = 0; i < file.headings.length; i++) {
      const h = file.headings[i];
      if (h.level !== 1) continue;
      for (let j = i + 1; j < file.headings.length; j++) {
        const h2 = file.headings[j];
        if (h2.level === 1) break;
        if (h2.level === 2) {
          ids.add(`${prefix}n_${safe(file.id)}_${j}`);
          const linked = (h2.linkedFileIds ?? []).filter((id) => fileIds.has(id));
          for (const tid of linked) {
            const targetFile = outline.files.find((f) => f.id === tid);
            if (targetFile?.headings.length) {
              ids.add(`${prefix}link_${safe(file.id)}_${j}_${safe(tid)}`);
              collectFromFile(
                targetFile,
                `${prefix}link_${safe(file.id)}_${j}_${safe(tid)}`,
                visited,
              );
            }
          }
        }
      }
    }
    visited.delete(file.id);
  }

  const rootFiles = findRootFiles(outline);
  const files = rootFiles.length > 0 ? rootFiles : outline.files;
  for (const file of files) {
    if (collapseFiles) ids.add(`fl_${safe(file.id)}`);
    collectFromFile(file, "", new Set());
  }
  return ids;
}

export function outlineToTreeData(outline: Outline, collapsedIds: Set<string>): OutlineTreeNode {
  const fileIds = new Set(outline.files.map((f) => f.id));
  const fileById = new Map(outline.files.map((f) => [f.id, f]));
  const rootFiles = findRootFiles(outline);
  const fileNodes: OutlineTreeNode[] = (rootFiles.length > 0 ? rootFiles : outline.files).map(
    (file, idx) => {
      const fileIdx = outline.files.findIndex((f) => f.id === file.id);
      const fileColorIndex = (fileIdx >= 0 ? fileIdx : idx) % OUTLINE_TREE_COLORS.length;
      const h1Nodes = buildFileOutline(
        file,
        outline,
        fileIds,
        fileById,
        fileColorIndex,
        new Set(),
        0,
        "",
        collapsedIds,
      );

      const fileId = `fl_${file.id.replace(/-/g, "_")}`;
      const fileCollapsed = collapsedIds.has(fileId);
      return {
        id: fileId,
        data: {
          value: file.name,
          fileId: file.id,
          group: file.group,
          isFile: true,
          hasChildren: h1Nodes.length > 0,
          fileColorIndex,
        },
        children: h1Nodes.length > 0 && !fileCollapsed ? h1Nodes : undefined,
      };
    },
  );

  const rootCollapsed = collapsedIds.has(OUTLINE_TREE_ROOT_ID);
  const root: OutlineTreeNode = {
    id: OUTLINE_TREE_ROOT_ID,
    data: { value: "文档" },
    children: rootCollapsed ? undefined : fileNodes,
  };

  function assignDepth(node: OutlineTreeNode, depth: number) {
    node.data.depth = depth;
    node.children?.forEach((c) => assignDepth(c, depth + 1));
  }
  assignDepth(root, 0);

  return root;
}
