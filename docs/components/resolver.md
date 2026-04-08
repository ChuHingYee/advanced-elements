# AdvancedElementsResolver 自动按需导入

配合 `unplugin-vue-components` 实现组件自动按需导入，无需手动 import。

## 安装

```shell
pnpm add @advanced-elements/resolvers unplugin-vue-components -D
```

## 配置

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

## 选项

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `direct` | `boolean` | `false` | 是否从独立子包导入（`@advanced-elements/table`），而非统一包（`@advanced-elements/elements`），可更精细 tree-shaking |
| `sideEffects` | `boolean` | `true` | 是否自动导入样式（CSS） |

## 使用

配置后直接在模板中使用组件，无需引入：

```vue
<template>
  <AdvTable :columns="columns" :data="data" />
  <AdvConfigProvider :config="globalConfig">
    <AdvTable :columns="columns" :data="data" />
  </AdvConfigProvider>
</template>
```

## 支持列表

| 组件名 | 来源包 | 样式 |
|--------|--------|------|
| `AdvTable` | `@advanced-elements/table` | `@advanced-elements/table/style` |
| `AdvConfigProvider` | `@advanced-elements/config-provider` | - |
