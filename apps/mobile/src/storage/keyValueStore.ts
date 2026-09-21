import { type KeyValueStore } from '@tickr/core-storage';
import { Platform } from 'react-native';
import { type MMKV } from 'react-native-mmkv';

/** The constructor, taken as a type so the module itself stays a runtime require. */
type MMKVConstructor = new (configuration?: { id?: string }) => MMKV;

/**
 * The platform key-value store, and the replacement for `SettingsFactory`.
 *
 * The Kotlin project has one `expect fun createSettings(name: String): Settings`
 * with three `actual`s: SharedPreferences, NSUserDefaults, and localStorage.
 * This is the same shape with two branches rather than three, because MMKV
 * covers both native platforms and the web branch is the same localStorage the
 * Kotlin wasm target uses.
 *
 * The web branch is not a fallback. The web build is the reason the project
 * exists, so `localStorage` is a first-class target here, and the guard for its
 * absence is for the server-side render pass that Expo's static web export
 * performs, where `window` genuinely does not exist.
 *
 * MMKV is synchronous, and so is localStorage, which is why the interface is
 * synchronous. An async interface would force every read through a promise for
 * no benefit on any of the three platforms.
 *
 * The interface is the contract, not a suggestion: an earlier version of this
 * file implemented `getString`/`set`/`remove` and nothing else, which left
 * `createJsonStore` calling a `setString` that did not exist. TypeScript caught
 * the narrower half of that and the first write would have thrown at runtime;
 * the conversion below is the whole of what the interface asks for.
 */
export function createPlatformKeyValueStore(id: string): KeyValueStore {
  if (Platform.OS === 'web') {
    return createWebStore(id);
  }

  // Required, not imported, and this is load-bearing rather than stylistic. MMKV
  // has no web implementation, and Metro evaluates top-level imports eagerly, so
  // a static import would put the native-only module into the web bundle that is
  // the whole point of this project. The type import above is erased and costs
  // nothing at runtime.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const required = require('react-native-mmkv') as { MMKV: MMKVConstructor };
  const mmkv = new required.MMKV({ id });

  return {
    // MMKV itself returns `string | undefined`, so its null-ish result maps
    // across unchanged.
    getString: (key) => mmkv.getString(key),
    setString: (key, value) => {
      mmkv.set(key, value);
    },
    getBoolean: (key) => mmkv.getBoolean(key),
    setBoolean: (key, value) => {
      mmkv.set(key, value);
    },
    remove: (key) => {
      mmkv.delete(key);
    },
    clearAll: () => {
      mmkv.clearAll();
    },
  };
}

function createWebStore(id: string): KeyValueStore {
  const prefix = `${id}.`;

  const storage = (): Storage | null => {
    // Absent during the static export's server pass, present in the browser.
    if (typeof globalThis.localStorage === 'undefined') return null;
    return globalThis.localStorage;
  };

  return {
    // localStorage answers `null` for a missing key and the interface asks for
    // `undefined`, so the two absences are normalised onto one. JSON documents
    // are the only caller and they treat both as "no document".
    getString: (key) => storage()?.getItem(prefix + key) ?? undefined,
    setString: (key, value) => {
      storage()?.setItem(prefix + key, value);
    },
    // localStorage has no booleans. The Kotlin version gets them from
    // multiplatform-settings; here they share the string encoding, tagged so a
    // `"true"` document can never be mistaken for the boolean `true`.
    getBoolean: (key) => {
      const raw = storage()?.getItem(prefix + key);
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      return undefined;
    },
    setBoolean: (key, value) => {
      storage()?.setItem(prefix + key, value ? 'true' : 'false');
    },
    remove: (key) => {
      storage()?.removeItem(prefix + key);
    },
    clearAll: () => {
      const local = storage();
      if (local === null) return;

      // A prefix is not a namespace, so removeAll would take the whole origin's
      // storage with it, including the other applications the demo is served
      // beside. Collect first, then delete, because removing while iterating a
      // Storage shifts the indices underneath the loop.
      const owned: string[] = [];
      for (let i = 0; i < local.length; i++) {
        const key = local.key(i);
        if (key !== null && key.startsWith(prefix)) owned.push(key);
      }
      for (const key of owned) local.removeItem(key);
    },
  };
}
