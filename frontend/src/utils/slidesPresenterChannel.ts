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

/** Remote control of presentation-affecting UI on the main window. */
export type PresenterConfig = {
  type: "config";
  sessionId: string;
  /** Whether the main window (projector page) shows the notes panel. */
  notesVisible: boolean;
};

export type PresenterMessage = PresenterHello | PresenterState | PresenterGoto | PresenterConfig;

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
  // remote=1 switches the teleprompter to the server-relay transport so the
  // same URL also works from other devices (e.g. a phone on the same LAN).
  url.searchParams.set("remote", "1");
  return url.toString();
}

/** Server relay endpoints for the cross-device presenter transport. */
export function buildPresenterRelayUrls(
  sessionId: string,
  location: Pick<Location, "origin"> = window.location,
): { postUrl: string; eventsUrl: string } {
  const session = encodeURIComponent(sessionId);
  return {
    postUrl: `${location.origin}/_/api/presenter/${session}/messages`,
    eventsUrl: `${location.origin}/_/api/presenter/${session}/events`,
  };
}

export function isRemotePresenterSearch(search: string): boolean {
  return new URLSearchParams(search.startsWith("?") ? search : `?${search}`).get("remote") === "1";
}

export function isPresenterMessage(data: unknown): data is PresenterMessage {
  if (!data || typeof data !== "object") return false;
  const msg = data as Record<string, unknown>;
  if (typeof msg.sessionId !== "string" || msg.sessionId.length === 0) return false;
  if (msg.type === "hello") return true;
  if (msg.type === "goto") {
    return typeof msg.slideIndex === "number" && Number.isFinite(msg.slideIndex);
  }
  if (msg.type === "config") {
    return typeof msg.notesVisible === "boolean";
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

export function parsePresenterSearch(
  search: string,
): { sessionId: string; remote: boolean } | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  if (params.get("presenter") !== "1") return null;
  const sessionId = params.get("session");
  if (!sessionId) return null;
  return { sessionId, remote: isRemotePresenterSearch(search) };
}
