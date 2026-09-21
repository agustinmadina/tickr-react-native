import { defineConfig } from 'vitest/config';

/**
 * Vitest, configured for the whole workspace.
 *
 * The tests are colocated with the source (`backoff.test.ts` next to
 * `backoff.ts`) rather than in a parallel `test/` tree, which is the opposite of
 * the Kotlin project's `commonTest` layout. The reason is that the Kotlin
 * layout exists because the Kotlin compiler needs a separate source set to see
 * the test dependencies; TypeScript has no such constraint, and colocation
 * makes it obvious when a file has no test.
 *
 * `environment: 'node'` is deliberate. The pure logic under test — the backoff
 * curve, the portfolio maths, the store — has no DOM dependency, and running it
 * in node is several times faster than jsdom. The component tests, when they
 * arrive, will need a per-file `@vitest-environment jsdom` override rather than
 * paying for jsdom on every file.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/src/**/*.test.ts', 'apps/**/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.expo/**'],
    passWithNoTests: true,
  },
});
