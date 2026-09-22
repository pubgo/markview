export const PRESENTER_CHANNEL = "markview-slides-presenter";

export type PresenterHello = {
  type: "hello";
  sessionId: string;
};

export type PresenterState = {
  type: "state";
  sessionId: string;
  fileId: string;
  slideIndex: number;
  slideCount: number;
  notes: string;
  title: string;
  prevTitle: string | null;
  nextTitle: string | null;
  deckRevision: number;
};

export type PresenterGoto = {
  type: "goto";
  sessionId: string;
  slideIndex: number;
};

export type PresenterMessage = PresenterHello | PresenterState | PresenterGoto;

export function createPresenterSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildPresenterUrl(
  sessionId: string,
  location: Pick<Location, "origin" | "pathname"> = window.location,
): string {
  const url = new URL(location.pathname || "/", location.origin);
  url.searchParams.set("presenter", "1");
  url.searchParams.set("session", sessionId);
  return url.toString();
}

export function isPresenterMessage(data: unknown): data is PresenterMessage {
  if (!data || typeof data !== "object") return false;
  const msg = data as Record<string, unknown>;
  if (typeof msg.sessionId !== "string" || msg.sessionId.length === 0) return false;
  if (msg.type === "hello") return true;
  if (msg.type === "goto") {
    return typeof msg.slideIndex === "number" && Number.isFinite(msg.slideIndex);
  }
  if (msg.type === "state") {
    return (
      typeof msg.fileId === "string" &&
      typeof msg.slideIndex === "number" &&
      typeof msg.slideCount === "number" &&
      typeof msg.notes === "string" &&
      typeof msg.title === "string" &&
      (msg.prevTitle === null || typeof msg.prevTitle === "string") &&
      (msg.nextTitle === null || typeof msg.nextTitle === "string") &&
      typeof msg.deckRevision === "number"
    );
  }
  return false;
}

export function parsePresenterSearch(search: string): { sessionId: string } | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  if (params.get("presenter") !== "1") return null;
  const sessionId = params.get("session");
  if (!sessionId) return null;
  return { sessionId };
}
