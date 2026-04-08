# @advanced-elements/resolvers

> 🌐 Languages: **中文** · [English](./README.en.md)

[unplugin-vue-components](https://github.com/unplugin/unplugin-vue-components) 的组件解析器。在模板中使用组件时自动按需导入，无需手动 import。

## Install

```bash
pnpm add @advanced-elements/resolvers unplugin-vue-components
```

## 使用

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

参见 [unplugin-vue-components 文档](https://github.com/unplugin/unplugin-vue-components#installation)。

## 选项

```ts
interface AdvancedElementsResolverOptions {
  /**
   * 从独立子包导入（如 @advanced-elements/table），
   * 而非统一包 @advanced-elements/elements。
   *
   * @default false
   */
  direct?: boolean

  /**
   * 自动引入组件样式（CSS）。
   *
   * @default true
   */
  sideEffects?: boolean
}
```

### 示例

```ts
// 从统一包导入（默认）
AdvancedElementsResolver()
// → import { AdvTable } from '@advanced-elements/elements'

// 从独立子包导入
AdvancedElementsResolver({ direct: true })
// → import { AdvTable } from '@advanced-elements/table'

// 自动引入样式
AdvancedElementsResolver({ sideEffects: true })
// → import { AdvTable } from '@advanced-elements/elements'
// → import '@advanced-elements/table/style'
```

## 原理

解析器内置组件名 → 包名的映射表。当 `unplugin-vue-components` 在模板中发现 `<AdvTable>` 时，自动注入相应的 import 语句和（可选的）样式导入。
