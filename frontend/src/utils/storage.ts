const PREFIX = 'enterprise-ai';

export function getStorageKey(key: string): string {
  return `${PREFIX}:${key}`;
}

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(getStorageKey(key));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(getStorageKey(key), JSON.stringify(value));
  } catch {
    // storage unavailable (private mode, quota) — fail silently, non-critical
  }
}

export function removeStorage(key: string): void {
  localStorage.removeItem(getStorageKey(key));
}
