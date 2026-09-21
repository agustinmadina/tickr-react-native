/**
 * Key-value storage, behind an interface.
 *
 * The Kotlin project uses multiplatform-settings with an `expect`/`actual` per
 * platform: SharedPreferences, NSUserDefaults, localStorage. Here the
 * implementation is react-native-mmkv, which is one library covering Android
 * and iOS, and localStorage on web. MMKV is synchronous, which matters: the
 * Kotlin version's reads are suspend-free too, and a portfolio that has to
 * await its own holdings before it can render would flash an empty state on
 * every cold start.
 *
 * The interface exists so tests get the memory implementation and never touch
 * native storage.
 */
export interface KeyValueStore {
  getString(key: string): string | undefined;
  setString(key: string, value: string): void;
  getBoolean(key: string): boolean | undefined;
  setBoolean(key: string, value: boolean): void;
  remove(key: string): void;
  clearAll(): void;
}

export function createMemoryStore(seed: Record<string, string> = {}): KeyValueStore {
  const map = new Map<string, string>(Object.entries(seed));
  const booleans = new Map<string, boolean>();

  return {
    getString: (key) => map.get(key),
    setString: (key, value) => {
      map.set(key, value);
    },
    getBoolean: (key) => booleans.get(key),
    setBoolean: (key, value) => {
      booleans.set(key, value);
    },
    remove: (key) => {
      map.delete(key);
      booleans.delete(key);
    },
    clearAll: () => {
      map.clear();
      booleans.clear();
    },
  };
}
