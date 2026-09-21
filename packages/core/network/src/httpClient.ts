import { type ZodType } from 'zod';

/**
 * The Ktor client, as a thin wrapper over fetch.
 *
 * The Kotlin version exists because Ktor needs a per-platform engine: OkHttp on
 * Android, Darwin on iOS, the browser's own networking on wasm. `fetch` is the
 * same API on all three, so the seam disappears entirely. This is one of the
 * few places where React Native is genuinely simpler than the Kotlin project
 * rather than merely different.
 *
 * What is kept from the Kotlin side is the validation posture. Ktor is
 * configured with `ignoreUnknownKeys = true` because these are third-party
 * feeds and an exchange adding a field must not take the app down. Zod gives
 * the same guarantee more precisely: unknown keys are stripped, and a payload
 * that is missing a field the app actually needs fails loudly at the boundary
 * instead of producing `undefined` three layers down.
 */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    readonly body: string,
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpError';
  }
}

export interface HttpClient {
  getJson<T>(url: string, schema: ZodType<T>, signal?: AbortSignal): Promise<T>;
}

export function createHttpClient(options: { baseUrl?: string } = {}): HttpClient {
  const { baseUrl = '' } = options;

  return {
    async getJson<T>(url: string, schema: ZodType<T>, signal?: AbortSignal): Promise<T> {
      const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        ...(signal ? { signal } : {}),
      });

      if (!response.ok) {
        // Read the body for the error message, but never let a failure to read
        // it mask the status code, which is the part that actually matters.
        const body = await response.text().catch(() => '');
        throw new HttpError(response.status, fullUrl, body);
      }

      const raw: unknown = await response.json();
      return schema.parse(raw);
    },
  };
}
