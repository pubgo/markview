import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "markview-slide-transition";

export type SlideTransition = "fade" | "slide" | "none";

export const SLIDE_TRANSITION_DEFAULT: SlideTransition = "fade";

export const SLIDE_TRANSITION_OPTIONS: Array<{ value: SlideTransition; label: string }> = [
  { value: "fade", label: "淡入" },
  { value: "slide", label: "滑动" },
  { value: "none", label: "无" },
];

let listeners: Array<() => void> = [];
let cached: SlideTransition | null = null;

function readFromStorage(): SlideTransition {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "fade" || raw === "slide" || raw === "none") {
      cached = raw;
      return cached;
    }
  } catch {
    // ignore
  }
  cached = SLIDE_TRANSITION_DEFAULT;
  return cached;
}

function writeToStorage(value: SlideTransition) {
  cached = value;
  localStorage.setItem(STORAGE_KEY, value);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): SlideTransition {
  return readFromStorage();
}

export function useSlideTransition(): [SlideTransition, (value: SlideTransition) => void] {
  const value = useSyncExternalStore(subscribe, getSnapshot);

  const setTransition = useCallback((next: SlideTransition) => {
    writeToStorage(next);
  }, []);

  return [value, setTransition];
}
