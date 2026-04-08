# @advanced-elements/table

[![npm version](https://img.shields.io/npm/v/@advanced-elements/table.svg)](https://www.npmjs.com/package/@advanced-elements/table)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

基于 Element Plus `ElTable` / `ElTableV2` 的企业级 Vue 3 表格组件：配置驱动（config-driven），支持虚拟滚动、树形、分组、行固定、单元格编辑、合并、筛选/排序、范围选择、导入导出与打印。

> 🌐 Languages: **中文** · [English](./README.en.md)

> 在线体验：[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/ChuHingYee/advanced-elements) · 完整 API 见 [`docs/components/table.md`](https://github.com/ChuHingYee/advanced-elements/blob/develop/docs/components/table.md)（props / events / slots / expose 全量覆盖，与 `src/types/table-props.ts` / `table-emits.ts` / `use-table-api.ts` 同源）

## 安装

```bash
npm install @advanced-elements/table
# 宿主应用需要安装的 peer dependencies：
npm install vue element-plus @element-plus/icons-vue @vueuse/core lodash-es dayjs @advanced-elements/config-provider
# 可选 peer（仅在使用对应功能时需要）：
npm install vue-router      # URL 状态同步
npm install xlsx            # Excel 导入导出（npm 最新为 0.18.5，安全说明见下）
npm install async-validator # 跨字段校验规则
```

> `@vueuse/core` 与 `@advanced-elements/config-provider` 为 **peer dependencies**（运行时必需，保持 peer 以避免重复副本 / 单例冲突），**不会**自动安装。

在应用入口引入样式一次：

```ts
import '@advanced-elements/table/style' // 完整样式（sass 源 + 编译 css）
```

## 最小用法

```vue
<script setup lang="ts">
import { AdvTable } from '@advanced-elements/table'
import '@advanced-elements/table/style'

interface Row { id: string; name: string; age: number }
const columns = [{ prop: 'name', label: '姓名' }, { prop: 'age', label: '年龄' }]
const data: Row[] = [{ id: '1', name: 'Ada', age: 36 }]
</script>

<template>
  <AdvTable<Row>
    mode="virtual"
    :columns="columns"
    :data="data"
    :row-config="{ rowKey: 'id' }"
  />
</template>
```

完整 API、指南与示例见 [`docs/components/table.md`](https://github.com/ChuHingYee/advanced-elements/blob/develop/docs/components/table.md)。

## 功能概览

| 领域 | 说明 |
| --- | --- |
| 渲染模式 | `mode="default"`（ElTable）/ `mode="virtual"`（**默认**，ElTableV2 虚拟滚动） |
| 列 | 设置 / 分组 / 拖拽排序 / 折叠 / 调整大小 / 状态持久化 |
| 排序 | 多列排序，可选 Web Worker |
| 筛选 | 列筛选 / 快速搜索 / 外部筛选 / 浮动筛选 / 侧边面板 |
| 选择 | 单选 / 多选 / 跨页 / 当前页全选 / 资格谓词 |
| 编辑 | 编辑器注册表 / 批量编辑 / 撤销重做 / 单元格与跨字段校验 |
| 单元格 | Excel 风格范围选择 / 剪贴板复制粘贴 |
| 合并 | 行 / 列 / 范围合并 |
| 层级 | 树形 / 行分组 / 展开明细行 / 固定行 |
| 拖拽 | 行拖拽 / 列拖拽（vue-draggable-plus） |
| 右键菜单 | 内置复制 / 清空 / 编辑 / 排序筛选重置 / 导入导出，可自定义 |
| IO | CSV/Excel 导出导入（`xlsx` 可选）/ 打印 |
| 状态同步 | URL 状态同步（分页 / 搜索） |
| 国际化 | 内置 `zhCn` / `en`，可通过 `advLocaleKey` 自定义 |
| 扩展 | 拦截器 / 编辑器注册表（`registerCellEditor`）/ 筛选器注册表（`registerFilterType`） |
| 错误 | 渲染错误边界 + 结构化 `@error` 事件（`TABLE_*` 错误码） |

## 兼容性

| 依赖 | 支持范围 | 测试版本 |
| --- | --- | --- |
| `vue` | `^3.5.0` | 3.5.x |
| `element-plus` | `^2.14.0` | 2.14.x（小版本升级需回归，见 `EP-UPGRADE-CHECKLIST.md`） |
| `typescript` | `^5.0.0`（类型以 5.9 构建） | 5.9.x |
| `node`（构建/开发） | monorepo 开发要求 `>=22`；发布包运行时无 node 要求 | — |
| 浏览器 | Chrome/Edge ≥ 94，Firefox ≥ 93，Safari/iOS ≥ 15.4 | — |
| SSR | 已做守卫（`typeof window/document`、storage 探测、多表页面需 `tableId` 以保持 hydration id 稳定） | — |

破坏性变更与迁移说明见 [CHANGELOG](./CHANGELOG.md)。

## 常见问题与注意事项

- **默认模式为 `virtual`**：首次渲染走 ElTableV2；需要经典 ElTable 行为请用 `mode="default"`。
- **全选范围随模式变化**：`default` = 当前页，`virtual` = 全部筛选行。与模式无关的当前页全选：`selectAllOnCurrentPage`。多选、树形、展开务必设置 `rowConfig.rowKey`，否则数据刷新后选择/展开会静默失效。服务端分页下 virtual 的"全部筛选行"仅当前页；跨页选择需 `keepSelectionAcrossPages` + 受控 `selectedRowKeys`，且 `getSelectedRows()` / `selectionChange.rows` 仅含当前页行——完整行通过 `meta.keys` 解析。
- **树形 + 服务端分页不支持**（`TABLE_TREE_REMOTE_PAGINATION_UNSUPPORTED`）：树形需要全量数据——使用 `pagination.mode="client"` 或 `pagination.enabled=false`。树形与行分组互斥（运行时忽略分组）。
- **服务端数据源 + `autoParams` 关闭 = 页内排序/筛选**：本地列排序仅排序当前页（不重新请求/不重置页码）；列筛选 / `quickFilter` / `externalFilter` 仅筛选当前页（开发环境会警告）。声明 `{ type: 'server' }` / `'custom'` 可排序列并开启 `request.autoParams` 以获得服务端行为。
- **编辑 + 远程数据源**：排序/筛选/分页重新请求会整体替换 `data` 并丢弃未提交的编辑——请先调用 `saveCells()` / `discard()`。
- **`size` / `tableLayout`** 仅影响 `default` 模式；**`estimatedRowHeight`** 仅影响 `virtual` 模式（被忽略时开发环境提示）。**`pagination.infiniteScroll`** 仅在 `virtual` 模式有效。
- **动态列插槽名需要显式行类型**（`AdvTable<Row>`）；使用默认 `Record<string, unknown>` 时插槽名拼写错误无法类型检查（这是"插槽名 = 列 prop"设计的固有限制）。
- **`mode` 不能在运行时切换**：切换会丢失编辑/滚动/Shift 选择状态；请用 `v-if` 重建。

### 列宽溢出在两种模式下不同（设计如此）

| 模式 | 总列宽超过表格宽度时的行为 |
| --- | --- |
| `virtual` | 显式溢出检测（`v2ColumnsOverflow`）强制固定宽度；表头/表体/汇总保持像素对齐。 |
| `default` | 溢出由 ElTable 的 `table-layout` 原生处理（横向滚动）；包装层不增加第二套溢出策略。 |

这种不对称是刻意的：虚拟渲染器拥有自己的宽度计算（必须输出数值宽度以保证表头/表体/汇总一致），而默认渲染器委托给 Element Plus。请勿期望两种模式溢出视觉完全一致。

### `#append` 插槽在两种模式下不同（设计如此）

| 模式 | `#append` 行为 |
| --- | --- |
| `default` | ElTable 原生 `#append` 插槽，渲染在最后一行之后。 |
| `virtual` | 无模板出口（ElTableV2 没有 `#append` 插槽）——追加内容被合成为尾部数据行（`dataWithAppend`）。 |

这种不对称是刻意的：内容相同，挂载策略不同。请勿将其报告为"缺少插槽"的 bug。合成行上的合并与动态网格交互仅开发环境警告（见 `renderer-interface.ts`）。

### 每种模式可用的列字段

大多数列字段两种模式通用。例外在 `AdvColumn` 中行内文档标注为 `// only for virtual mode` / `// only for default mode`。常见坑：`flexGrow` / `flexShrink` / `maxWidth` **仅 virtual 模式**（ElTableV2 原生），在 `default` 模式被忽略。

开启 `autoSizeColumns` 时，两种模式共享同一下限规则（`width` 与 `minWidth` 的较大值，经 `resolveStretchLowerBound`）。非数值 `minWidth`（如 `'100px'`）计为"无 minWidth"，回退到 `width`——这取代了原先 `Math.max(width, undefined)` → `NaN` 的路径。

### 单元格值格式化用 `format`，不是 `formatter`

部分用户常找 `formatter`。本组件使用 **`format`**（配合 `valueGetter` 解析值、`valueEnum` / `valueType` 控制展示）。列上的 `formatter` 键会被静默忽略——请使用 `format`。

### 运行时列变更必须走 `setColumns`

内部列列表是 `shallowRef`（对大型列配置做深度响应式代理代价高），因此原地修改列对象 **不会** 触发重渲染。运行时增删改列时请使用暴露的 `setColumns(newArray)`，或通过 `v-model:columns` 替换数组引用。列拖拽与列调整大小已内部处理。

### 筛选状态：非受控（默认）或受控

- **非受控（默认）**：筛选内部处理。使用 `setFilter` / `resetColumnFilter` / `resetAllFilters` / `getFilterValue` / `isColumnFiltered`，并通过 `@filter-change` 监听结果。
- **受控**：传入 `:filter-model="myFilters"`（键为规范列键——与 `filterChange` 载荷同口径）。内容相等检查后向内同步，因此从 `filterChange` 监听器回传相等值不会循环。混用 prop 与 `setFilter` 时最后写入者胜出。

`filterChange` 与 `sortChange` 镜像：仅在实质性的内部筛选变化时触发，跳过初始化与内容相等的重写（noop→real 组合式升级、对相同值的重复应用）。

### 自定义 Element Plus 命名空间（四方配对）

Element Plus 允许宿主通过 `ConfigProvider namespace` 更改 CSS 类前缀（`el-` → `xxx-`）。本库跟随它，但 **四边必须一致**——任何不匹配都会触发 `TABLE_NAMESPACE_MISMATCH`（警告，生产可见）而非静默破坏拖拽/滚动/悬停查找：

| # | 侧 | 位置 | 示例 |
|---|---|---|---|
| 1 | EP 运行时 | `<ElConfigProvider namespace="xxx">` | `namespace="xxx"` |
| 2 | 本库运行时 | `uiConfig.namespace`（或省略以自动跟随 EP） | `:ui-config="{ namespace: 'xxx' }"` |
| 3 | 本库 CSS（构建时） | SASS `$ep-namespace`（见 `src/style/_ep-classes.scss`） | `@use '.../style/ep-classes' with ($ep-namespace: 'xxx');` **在** 任何 `@use '.../style/index.scss'` **之前** |
| 4 | EP 自身 CSS（构建时） | SASS `$namespace`，EP 文档方式 | 按 Element Plus 自定义命名空间文档 |

规则：

- **尽可能省略 `uiConfig.namespace`**——表格自动读取 EP `ConfigProvider` 的命名空间（`core.namespace`：`uiConfig.namespace ?? EP namespace ?? 'el'`）。只有两边设成不同值才会触发不匹配错误。
- **运行时命名空间切换不支持样式**：JS 查找立即跟随，但 CSS 在构建时烘焙——运行时更改前缀在 CSS 重建前会破坏视觉。
- 若直接使用 `dist` CSS，仅默认 `el` 前缀可用。自定义前缀需要从源 SCSS 构建样式（与 Element Plus 本身相同约束）。
- EP 升级重命名类时，仅 `src/utils/ep-selectors.ts` + `src/style/_ep-classes.scss` 变更，按 `EP-UPGRADE-CHECKLIST.md` 回归（由 `check:ep-props` / `check:ep-selectors` 守护）。

## 安全说明

- **xlsx（可选）已知 CVE**：xlsx 0.18.x 存在原型污染 / ReDoS 告警（含 CVE-2023-30533、CVE-2024-22363）。启用 Excel 导入导出前：
  - npm 最后发布的 xlsx 为 **0.18.5**——修补版（≥ 0.19.3）仅从 SheetJS CDN 分发：
    `pnpm add https://cdn.sheetjs.com/xlsx-latest.tgz`（见 https://docs.sheetjs.com/docs/getting-started/installation/nodejs）；
  - 或保留 npm 0.18.5 并仅对可信输入启用导入；内置原型污染守卫（`sanitizeDataArray`）在导入管线中保持开启，导出路径运行公式注入净化。
- **优先 npm install 而非 CDN dist**：CDN 绕过 peer 解析（`element-plus` / `vue-router` / `xlsx`）与 lockfile 审计。

## 工程

- **performanceProfile**：`'high' | 'low'`（prop 或 ConfigProvider `table.performanceProfile`）。`'low'` 面向低端设备：关闭滚动失步看门狗、滚动速度跟踪与悬停鼠标跟踪；reconcile 与范围选择不受影响。
- **browserslist**：ES2022 基线（Chrome/Edge ≥ 94，Firefox ≥ 93，Safari/iOS ≥ 15.4）。

### 插槽命名

kebab-case 为规范写法；camelCase 拼写保留为兼容别名，运行时行为一致。

| 规范（kebab） | 别名（camel，遗留） |
| --- | --- |
| `header-left`、`header-right`、`footer`、`footer-extra`、`empty`、`append`、`error` | —（已是 kebab） |
| `expand-row` | `expandRow` |
| `group-header` | `groupHeader` |

新代码请优先使用 kebab 名称。

## 元信息

- 许可证：[MIT](./LICENSE)
- Issues：<https://github.com/ChuHingYee/advanced-elements/issues>
- 版本：`3.x` 对应 Vue 3（+ Element Plus 2.x）；`2.x` 为遗留 Vue 3 线；`1.x` 为遗留 Vue 2 线。

完整英文版见 [README.en.md](./README.en.md)。
