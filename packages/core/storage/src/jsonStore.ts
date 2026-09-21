import { type ZodType } from 'zod';

import { type KeyValueStore } from './keyValueStore';

/**
 * A serialised document in a key-value store.
 *
 * This is the same choice the Kotlin project made and for the same reason: a
 * portfolio is a handful of rows read whole and written whole, with no queries,
 * no joins and no migrations to speak of, so a document is proportionate rather
 * than a compromise. SQLDelight was rejected there because it has no wasm
 * driver; here the equivalent would be SQLite, and the same argument applies
 * with less force since OP-SQLite does have a web story. The document stays
 * because the data does not need more.
 *
 * The difference from the Kotlin version is the schema. `multiplatform-settings`
 * round-trips a string and trusts it. Zod validates on read, so a document
 * written by an older build that no longer matches the model is rejected and
 * treated as absent, rather than producing a half-populated object that crashes
 * somewhere unrelated.
 */
export interface JsonStore<T> {
  read(): T | undefined;
  write(value: T): void;
  clear(): void;
}

export function createJsonStore<T>(
  store: KeyValueStore,
  key: string,
  schema: ZodType<T>,
): JsonStore<T> {
  return {
    read(): T | undefined {
      const raw = store.getString(key);
      if (raw === undefined) return undefined;

      try {
        const parsed: unknown = JSON.parse(raw);
        const result = schema.safeParse(parsed);
        return result.success ? result.data : undefined;
      } catch {
        // Corrupt JSON is the same as no JSON. Returning undefined lets the
        // caller fall back to an empty portfolio instead of failing to start.
        return undefined;
      }
    },

    write(value: T): void {
      store.setString(key, JSON.stringify(value));
    },

    clear(): void {
      store.remove(key);
    },
  };
}
