# Advanced Elements

> 🌐 Languages: **中文** · [English](./README.en.md)

[![CI](https://github.com/ChuHingYee/advanced-elements/actions/workflows/ci.yml/badge.svg)](https://github.com/ChuHingYee/advanced-elements/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D.svg)](https://vuejs.org/)
[![Element Plus](https://img.shields.io/badge/Element_Plus-2.14-409EFF.svg)](https://element-plus.org/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220.svg)](https://pnpm.io/)

基于 **Vue 3 + Element Plus** 的企业级组件库，以「配置驱动（config-driven）」的方式提供高级表格、表单及配套工具，开箱即用且具备完整的类型定义。

仓库采用 **pnpm workspace monorepo** 管理，文档基于 **VitePress**，构建使用 **rolldown / Rollup**，测试基于 **Vitest**，工程编排使用 **Turbo**。

> 本地文档：`pnpm docs:dev`（构建：`pnpm docs:build`）
>
> 在线体验：[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/ChuHingYee/advanced-elements)（浏览器内直接跑 `play` playground，无需本地安装）

---

## 特性

- **高级表格**（`@advanced-elements/table`）：在 Element Plus `ElTable` / `ElTableV2` 之上封装，支持 `default` 与 `virtual` 两种渲染模式。
- **统一的数据管线**：排序 → 列筛选 → 外部筛选 → 派生处理，链路化、可组合。
- **内置编辑与校验体系**：单元格 / 整行 / 批量编辑，规则校验、跨字段校验、撤销 / 重做。
- **虚拟滚动**：基于 `ElTableV2` 的万级数据流畅渲染。
- **树形数据 / 行分组 / 展开行**：多维数据组织与展示。
- **右键菜单**：内置复制 / 剪切 / 粘贴 / 编辑 / 删除 / 导出等菜单项，支持自定义。
- **列状态持久化**：列宽、显隐、固定、排序等状态本地存储与恢复。
- **数据导入导出与打印**：CSV / Excel 导出、Excel / CSV 导入、打印预览。
- **范围选择 / 拖拽排序**：单元格范围选择、列拖拽、行拖拽。
- **事件拦截器**：在键盘、编辑、点击、排序等事件前后介入控制行为。
- **URL 状态同步、轮询刷新、外部筛选器** 等进阶能力。
- **自动按需导入**（`@advanced-elements/resolvers`）：配合 `unplugin-vue-components` 自动导入组件。

---

## 包结构

| 包名 | 说明 | 版本 |
|------|------|------|
| `@advanced-elements/elements` | 统一导出包，一次安装即可使用全部组件 | `2.1.1` |
| `@advanced-elements/table` | 高级表格组件（核心） | `4.0.0` |
| `@advanced-elements/config-provider` | 全局默认配置提供者 | `2.1.0` |
| `@advanced-elements/resolvers` | `unplugin-vue-components` 自动导入解析器 | `2.1.0` |

---

## 快速开始

### 安装

```shell
# 方式一：使用统一导出包（推荐）
pnpm add @advanced-elements/elements

# 方式二：仅安装表格
pnpm add @advanced-elements/table
```

### 使用

```vue
<script setup lang="ts">
import { AdvTable } from '@advanced-elements/elements'
import '@advanced-elements/elements/style'

const columns = [
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'age', label: '年龄', width: 80 },
  { prop: 'email', label: '邮箱', minWidth: 200 },
  { prop: 'status', label: '状态', valueType: 'select', valueEnum: { 1: '启用', 0: '禁用' } },
]

const data = [
  { name: '张三', age: 28, email: 'zhangsan@example.com', status: 1 },
  { name: '李四', age: 32, email: 'lisi@example.com', status: 0 },
]
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

配合 `unplugin-vue-components` 与 `@advanced-elements/resolvers`，模板中直接使用组件而无需手写 import：

```ts
// vite.config.ts
import Components from 'unplugin-vue-components/vite'
import { AdvancedElementsResolver } from '@advanced-elements/resolvers'

export default defineConfig({
  plugins: [
    Components({ resolvers: [AdvancedElementsResolver()] }),
  ],
})
```

---

## 基础示例

```vue
<script setup lang="ts">
import AdvTable from '@advanced-elements/table'

const columns = [
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'age', label: '年龄', width: 80, align: 'center' },
  { prop: 'address', label: '地址', minWidth: 200 },
]

const data = [
  { id: '1', name: '张三', age: 25, address: '北京市' },
  { id: '2', name: '李四', age: 30, address: '上海市' },
]
</script>

<template>
  <AdvTable :columns="columns" :data="data" />
</template>
```

更多用法（远程数据、分页、搜索、虚拟滚动、编辑、树形数据、右键菜单、导入导出等）请参阅 [组件文档](docs/components/table.md) 与 VitePress 文档站。

---

## 技术栈

- **Vue 3**（`<script setup>` + TSX）
- **Element Plus** / `@element-plus/icons-vue`
- **TypeScript** 5.x，类型安全优先
- **pnpm** workspace + **Turbo** 编排
- **rolldown / Rollup** 构建， **VitePress** 文档， **Vitest** 测试

### 主要依赖

| 包 | 用途 |
|----|------|
| `element-plus` | UI 基础 |
| `@vueuse/core` | 组合式工具 |
| `dayjs` | 日期处理 |
| `lodash-es` | 工具函数 |
| `sortablejs` / `vue-draggable-plus` | 拖拽 |
| `nanoid` | 唯一 ID |
| `xlsx`（可选） | Excel 导入导出 |

---

## 脚本

在仓库根目录执行（基于 pnpm + Turbo）：

```shell
pnpm install            # 安装依赖（必须使用 pnpm）

pnpm play              # 启动本地 playground 开发环境
pnpm dev:all           # 启动所有包的 dev 构建

pnpm build:all         # 构建所有 packages

pnpm test              # 运行测试（turbo 编排）
pnpm coverage          # 运行并生成覆盖率

pnpm lint              # ESLint 检查并自动修复

pnpm docs:dev          # 本地启动 VitePress 文档
pnpm docs:build        # 构建文档

pnpm release:version   # 发版第一步：消费 changeset、写版本号/CHANGELOG、打发版提交（本地）
pnpm release:publish   # 发版第二步：构建并发布（CI / tag 触发）
pnpm release:verify    # 发版前演练：本地 verdaccio 全链路（不改版本号）
pnpm docs:release      # 文档站构建并强推 gh-pages
```

单包开发可进入对应目录执行其 `package.json` 中的脚本，例如：

```shell
cd packages/table
pnpm dev       # rolldown watch 构建
pnpm test      # vitest
pnpm build     # 构建并生成 d.ts
```

---

## 文档

- 组件总览：`docs/components/`（表格：`docs/components/table.md`）
- 本地文档：`pnpm docs:dev`
- 表格组件完整 API：`docs/components/table.md`
- 快速开始：`docs/guide/getting-started.md`
- 在线体验（StackBlitz）：<https://stackblitz.com/github/ChuHingYee/advanced-elements>（跑 `play` playground）

---

## 开发约定

- 提交信息遵循 Conventional Commits（由 `scripts/verify-commit.ts` 校验）。
- 单文件超过约定规模（约 300 行）优先考虑拆分（详见根目录 `CONTRIBUTING.md`）。
- 文档与示例代码需同步更新。

---

## License

[MIT](./LICENSE) © ChuHingYee
