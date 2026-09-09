import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: { react },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // Without this, core no-unused-vars cannot see a binding used only through JSX --
      // `motion` in `<motion.section>` reads as unused and errors. Capitalised imports
      // escape it via varsIgnorePattern above; lowercase ones like `motion` do not.
      'react/jsx-uses-vars': 'error',
      /**
       * Catches `<Foo />` where `Foo` is not in scope — a removed or mistyped component
       * import. Neither lint nor the build reported it before: `varsIgnorePattern: '^[A-Z_]'`
       * silences core `no-unused-vars` for capitalised names, and esbuild does not resolve
       * JSX identifiers, so the first sign was a blank page at runtime.
       *
       * That happened while folding `ShopBanner` into `PageBanner`: the import was replaced
       * and one `<ShopBanner/>` was left behind. `npm run lint` and `npm run build` both
       * passed on a page that could only throw.
       */
      'react/jsx-no-undef': 'error',
    },
  },
  {
    // Test and tooling files run in Node, not the browser: they use `process`, and the
    // Playwright specs bring their own `test`/`expect` via imports.
    files: ['playwright.config.js', 'e2e/**/*.js', 'scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
])
