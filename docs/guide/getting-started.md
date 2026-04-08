# 快速开始

## 环境要求

| 工具 | 要求 | 说明 |
|------|------|------|
| Node.js | `>=22` | 开发与构建；发布产物运行时无要求 |
| pnpm | `>=9`（仓库锁定 `12.11.2`） | 必须用 pnpm 安装（`preinstall` 会拦截 npm/yarn） |
| Vue | `^3.5.0` | 3.5.x 实测 |
| Element Plus | `^2.14.0` | peer 依赖，需自行安装 |
| TypeScript | `^5.0.0` | 类型用 5.9 构建 |

## 安装

```shell
pnpm add @advanced-elements/table
```

或使用统一导出包（推荐，一次安装即可使用所有组件）：

```shell
pnpm add @advanced-elements/elements
```

## 引入

### 直接使用子包

```vue
<script setup lang="ts">
import AdvTable from '@advanced-elements/table'
import '@advanced-elements/table/style'
</script>

<template>
  <AdvTable :columns="columns" :data="data" />
</template>
```

> **样式说明**：库的 `style` 入口**不包含 Element Plus 样式**，按下表三选一引入 EP 样式（三种互斥）：
>
> | 消费方现状 | 引入方式 | 说明 |
> |---|---|---|
> | 全量引入 EP | `import 'element-plus/dist/index.css'` | 一次覆盖所有组件，最简单 |
> | `unplugin-vue-components` 按需引入 | `import '@advanced-elements/table/style/element-plus'` | 该入口逐行复述库内部使用的 EP 样式模块，描述符与 `ElementPlusResolver` 默认输出一致，打包器按模块去重——resolver 已注入的不重复，库独占的（如 `table-v2`）得以覆盖；版本恒为你自己的 peer EP |
> | 无 EP 按需方案 | 同上，引入 `@advanced-elements/table/style/element-plus` | 精确覆盖库内部用量，不引入全量 |
>
> 同时使用多个子包时，各自的样式入口引入一次即可，共享组件（`button`/`input` 等）按模块去重只打包一份。
>
> 注意：`importStyle: 'sass'` 模式的描述符体系不同（`.../style/index`），与本入口并用仍会重复，请改用默认 css 模式；CJS/SSR 环境请使用全量 css，本入口仅提供 ESM 条件导出。

### 使用统一导出包

```vue
<script setup lang="ts">
import { AdvTable } from '@advanced-elements/elements'
import '@advanced-elements/elements/style'
</script>

<template>
  <AdvTable :columns="columns" :data="data" />
</template>
```

### 全局安装

```ts
import { createApp } from 'vue'
import AdvancedElements from '@advanced-elements/elements'

const app = createApp(App)
app.use(AdvancedElements)
```

### 自动按需导入

配合 `unplugin-vue-components` 使用 `@advanced-elements/resolvers`，模板中使用组件时自动导入，无需手写 import 语句。

```shell
pnpm add @advanced-elements/resolvers unplugin-vue-components -D
```

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

引入后直接在模板中使用即可：

```vue
<template>
  <AdvTable :columns="columns" :data="data" />
</template>
```

## 基础示例

:::demo 基础表格 table/basic.vue
:::

## 下一步

- [表格组件](/components/table) — 高级表格，支持筛选、排序、编辑、树形数据等
- [全局配置](/components/config-provider) — 全局默认配置
- [按需导入](/components/resolver) — 自动按需导入配置
- [统一导出包](/components/elements) — 一次安装使用所有组件

> 无需本地安装也可体验：[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/ChuHingYee/advanced-elements)（浏览器内运行 `play` playground，含表格全功能演示 `/table` 与 namespace 演示 `/namespace`）
