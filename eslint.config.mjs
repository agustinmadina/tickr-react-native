// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import reactHooks from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';

/**
 * The architecture rules Gradle enforces for free in the Kotlin project.
 *
 * In Tickr, `ui` cannot import `data` because the Gradle module simply does not
 * declare the dependency, so a violation fails to compile. React Native has no
 * such mechanism: every package can import every other package. This config is
 * the replacement, and it is the single most important file in the repo. Without
 * it the layering erodes within weeks.
 *
 * The dependency graph, identical to the Kotlin one:
 *
 *   ui ──→ domain ←── data
 *    \        ↑        /
 *     └──→   di   ←──┘
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.expo/**',
      '**/build/**',
      // Config files sit outside every tsconfig, so the project service cannot
      // type them. They are configuration, not application code.
      '**/*.config.js',
      '**/*.config.mjs',
      '**/*.config.ts',
      '**/*.config.mts',
      'vitest.config.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      boundaries,
      'react-hooks': reactHooks,
      import: importPlugin,
    },
    settings: {
      'boundaries/elements': [
        { type: 'core-common', pattern: 'packages/core/common/src/**' },
        { type: 'core-domain', pattern: 'packages/core/domain/src/**' },
        { type: 'core-network', pattern: 'packages/core/network/src/**' },
        { type: 'core-storage', pattern: 'packages/core/storage/src/**' },
        { type: 'core-ui', pattern: 'packages/core/ui/src/**' },
        { type: 'portfolio-domain', pattern: 'packages/features/portfolio/domain/src/**' },
        { type: 'portfolio-data', pattern: 'packages/features/portfolio/data/src/**' },
        { type: 'portfolio-ui', pattern: 'packages/features/portfolio/ui/src/**' },
        { type: 'portfolio-di', pattern: 'packages/features/portfolio/di/src/**' },
        { type: 'app', pattern: 'apps/mobile/**' },
      ],
      'boundaries/ignore': ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts'],
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      'import/no-cycle': 'error',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],

      /**
       * The layering. Read as: "a file of type X may only import from these types".
       * `disallow` is the whole point; `allow` is what keeps it from being noise.
       */
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            // core/common is the bottom of the stack: no internal imports at all.
            { from: 'core-common', allow: [] },

            // core/domain: pure. No framework, no other core package.
            { from: 'core-domain', allow: ['core-common'] },

            // core/network: plumbing only, no business concepts.
            { from: 'core-network', allow: ['core-common'] },

            // core/storage: same.
            { from: 'core-storage', allow: ['core-common'] },

            // core/ui: theme and shared components. May use core/domain for base types.
            { from: 'core-ui', allow: ['core-common', 'core-domain'] },

            // feature domain: pure Kotlin-equivalent. Only core primitives.
            { from: 'portfolio-domain', allow: ['core-common', 'core-domain'] },

            // feature data: domain + network + storage. Never UI.
            {
              from: 'portfolio-data',
              allow: ['core-common', 'core-domain', 'core-network', 'core-storage', 'portfolio-domain'],
            },

            // feature ui: domain + core-ui. NEVER data. This is the rule that matters.
            { from: 'portfolio-ui', allow: ['core-common', 'core-domain', 'core-ui', 'portfolio-domain'] },

            // di: sees everything in the feature, and is the only one that does.
            {
              from: 'portfolio-di',
              allow: [
                'core-common',
                'core-domain',
                'core-network',
                'core-storage',
                'core-ui',
                'portfolio-domain',
                'portfolio-data',
                'portfolio-ui',
              ],
            },

            // the app: composition root, sees everything.
            {
              from: 'app',
              allow: [
                'core-common',
                'core-domain',
                'core-network',
                'core-storage',
                'core-ui',
                'portfolio-domain',
                'portfolio-data',
                'portfolio-ui',
                'portfolio-di',
              ],
            },
          ],
        },
      ],
    },
  },

  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      // Async iterators have to satisfy the protocol, which promises a Promise
      // from `return()`. A fake whose `return()` only sets flags is correct and
      // has nothing to await, so the rule is noise here.
      '@typescript-eslint/require-await': 'off',
    },
  },
);
