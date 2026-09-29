import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "markview-plantuml-settings";

export interface PlantUmlSettings {
  /**
   * Kroki-compatible server base URL (e.g. a self-hosted kroki instance for
   * offline use). Empty means the public default https://kroki.io.
   */
  serverUrl: string;
}

export const PLANTUML_SETTINGS_DEFAULTS: PlantUmlSettings = {
  serverUrl: "",
};

export const PLANTUML_SERVER_URL_DEFAULT = "https://kroki.io";

let listeners: Array<() => void> = [];
let cachedSettings: PlantUmlSettings | null = null;

function readFromStorage(): PlantUmlSettings {
  if (cachedSettings) return cachedSettings;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      cachedSettings = { ...PLANTUML_SETTINGS_DEFAULTS, ...parsed };
      return cachedSettings!;
    }
  } catch {
    // ignore
  }
  cachedSettings = { ...PLANTUML_SETTINGS_DEFAULTS };
  return cachedSettings;
}

function writeToStorage(settings: PlantUmlSettings) {
  cachedSettings = settings;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): PlantUmlSettings {
  return readFromStorage();
}

export function usePlantUmlSettings(): [
  PlantUmlSettings,
  (patch: Partial<PlantUmlSettings>) => void,
  () => void,
] {
  const settings = useSyncExternalStore(subscribe, getSnapshot);

  const update = useCallback((patch: Partial<PlantUmlSettings>) => {
    const current = readFromStorage();
    writeToStorage({ ...current, ...patch });
  }, []);

  const reset = useCallback(() => {
    writeToStorage({ ...PLANTUML_SETTINGS_DEFAULTS });
  }, []);

  return [settings, update, reset];
}

/** Resolved server base URL (defaults applied), for use outside React. */
export function getPlantUmlServerUrl(): string {
  const url = readFromStorage().serverUrl.trim().replace(/\/+$/, "");
  return url || PLANTUML_SERVER_URL_DEFAULT;
}
