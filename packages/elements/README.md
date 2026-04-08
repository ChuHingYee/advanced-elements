# @advanced-elements/elements

> 🌐 Languages: **中文** · [English](./README.en.md)

统一导出包。将 `@advanced-elements/*` 系列组件聚合为一个包，只需安装一次即可使用所有组件。

## Install

```bash
pnpm add @advanced-elements/elements
```

## Usage

### 命名导入（推荐）

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
app.use(AdvancedElements) // 自动注册 AdvTable 等全部组件
```

### 类型导入

```ts
import type { AdvColumn } from '@advanced-elements/elements'
```

## 包含的组件

| 组件              | 来源包                            | 说明         |
| ----------------- | --------------------------------- | ------------ |
| AdvTable          | `@advanced-elements/table`        | 增强表格组件 |
| AdvConfigProvider | `@advanced-elements/config-provider` | 全局配置注入 |

> 当前仅发布表格与全局配置两个组件（及其 composables / 工具 / 类型再导出）。表单类组件（`AdvForm` 等）尚未发布，出现其引用时请以本包实际导出为准。

## 与直接使用子包的区别

| 方式                 | 安装                           | 导入             |
| -------------------- | ------------------------------ | ---------------- |
| 统一导出（推荐）     | `@advanced-elements/elements`  | 一次安装，随意取 |
| 直接子包             | `@advanced-elements/table`     | 按需安装，按需取 |

具名导入时，统一包在最终产物中 **不会引入额外体积**，得益于 ESM tree-shaking 和 Vite/Rollup 的自动优化。全局安装（`app.use(AdvancedElements)`）会注册全部组件，仅适合快速原型开发。
