import type { Group } from "../hooks/useApi";

export function allFileIds(groups: Group[]): Set<string> {
  const ids = new Set<string>();
  for (const g of groups) {
    for (const f of g.files) {
      ids.add(f.id);
    }
  }
  return ids;
}

/** App mount path for static hosting under a subpath (e.g. "/markview"). Empty on local server. */
export function getAppBasePath(): string {
  if (typeof window === "undefined") return "";
  const raw = window.__MARKVIEW_BASE_PATH__;
  if (typeof raw !== "string" || raw.trim() === "" || raw === "/") return "";
  return raw.replace(/\/+$/, "") || "";
}

export function parseGroupFromPath(pathname: string): string {
  const base = getAppBasePath();
  let path = pathname;
  if (base && (path === base || path.startsWith(`${base}/`))) {
    path = path.slice(base.length) || "/";
  }
  path = path.replace(/^\//, "").replace(/\/$/, "");
  return path || "default";
}

export function groupToPath(groupName: string): string {
  const base = getAppBasePath();
  if (groupName === "default") {
    return base || "/";
  }
  return `${base}/${groupName}`;
}

export function buildFileUrl(groupName: string, fileId: string): string {
  return `${groupToPath(groupName)}?file=${fileId}`;
}

export function parseFileIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  const raw = params.get("file");
  if (raw == null || raw === "") return null;
  return raw;
}
