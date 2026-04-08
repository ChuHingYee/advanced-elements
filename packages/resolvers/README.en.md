# @advanced-elements/resolvers

> 🌐 Languages: [中文](./README.md) · **English**

Resolver for [unplugin-vue-components](https://github.com/unplugin/unplugin-vue-components). Auto-imports components on demand when used in templates — no manual imports.

## Install

```bash
pnpm add @advanced-elements/resolvers unplugin-vue-components
```

## Usage

### Vite

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { AdvancedElementsResolver } from '@advanced-elements/resolvers'

export default defineConfig({
  plugins: [
    vue(),
    Components({
      resolvers: [AdvancedElementsResolver()],
    }),
  ],
})
```

### Nuxt

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@unplugin-vue-components/nuxt'],
  components: {
    resolvers: [
      AdvancedElementsResolver(),
    ],
  },
})
```

### Webpack / Rollup / esbuild

See the [unplugin-vue-components docs](https://github.com/unplugin/unplugin-vue-components#installation).

## Options

```ts
interface AdvancedElementsResolverOptions {
  /**
   * Import from individual sub-packages (e.g. @advanced-elements/table)
   * instead of the unified @advanced-elements/elements.
   *
   * @default false
   */
  direct?: boolean

  /**
   * Auto-import component styles (CSS).
   *
   * @default true
   */
  sideEffects?: boolean
}
```

### Examples

```ts
// Import from unified package (default)
AdvancedElementsResolver()
// → import { AdvTable } from '@advanced-elements/elements'

// Import from individual sub-package
AdvancedElementsResolver({ direct: true })
// → import { AdvTable } from '@advanced-elements/table'

// Auto-import styles
AdvancedElementsResolver({ sideEffects: true })
// → import { AdvTable } from '@advanced-elements/elements'
// → import '@advanced-elements/table/style'
```

## How it works

The resolver ships a built-in component-name → package-name mapping. When `unplugin-vue-components` finds `<AdvTable>` in a template, it automatically injects the corresponding import statement and (optionally) the style import.
