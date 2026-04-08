# @advanced-elements/elements 统一导出包

所有组件的统一入口包，一次安装即可使用全部组件。

## 安装

```shell
pnpm add @advanced-elements/elements
```

## 引入

### 全局安装（推荐用于完整使用）

```ts
import { createApp } from 'vue'
import AdvancedElements from '@advanced-elements/elements'
import '@advanced-elements/elements/style'

const app = createApp(App)
app.use(AdvancedElements)
```

### 按名引入

```vue
<script setup>
import { AdvTable, AdvConfigProvider } from '@advanced-elements/elements'
import '@advanced-elements/elements/style'
</script>
```

### 自动按需导入（推荐用于生产）

配合 `@advanced-elements/resolvers` 实现零配置按需导入，详见 [按需导入](/components/resolver)。

---

## 包含组件

| 组件 | 来源包 | 说明 |
|------|--------|------|
| `AdvTable` | `@advanced-elements/table` | 高级表格 |
| `AdvConfigProvider` | `@advanced-elements/config-provider` | 全局配置 |

---

## 导出内容

### 组件

```typescript
import {
  AdvTable,
  AdvConfigProvider,
} from '@advanced-elements/elements'
```

### Composables

```typescript
// 配置
import { useAdvConfig, provideAdvConfig, advConfigKey } from '@advanced-elements/elements'

// 表格相关（完整列表见表格文档）
import {
  useTableApi,
  useTableConfig,
  useTableSelection,
  useBatchEdit,
  useCellEdit,
  useCellValidate,
  useColumnState,
  useEditUndo,
} from '@advanced-elements/elements'
```

### 工具函数

```typescript
// 编辑器
import { registerEditor, unregisterEditor, getEditor } from '@advanced-elements/elements'

// 导出
import { exportExcel, exportCsv, importExcel, importCsv } from '@advanced-elements/elements'

// 复制
import { copyCellToClipboard, copyRowToClipboard, copyRowsToClipboard } from '@advanced-elements/elements'

// 行键
import { normalizeRowKey } from '@advanced-elements/elements'

// 国际化
import { useAdvLocale, zhCn, en } from '@advanced-elements/elements'

// 筛选
import { registerFilterType, getFilterStrategy } from '@advanced-elements/elements'

// 拦截器
import { useInterceptor, addInterceptor, removeInterceptor } from '@advanced-elements/elements'
```

### 类型导出

```typescript
// 表格类型
import type {
  AdvColumn,
  AdvTableProps,
  EditConfig,
  CellEditorType,
  CellEditorParams,
  SpanConfig,
  TreeConfig,
  RowGroupConfig,
  RowExpandConfig,
  ColumnState,
  ColumnStatePersistence,
  ContextMenuConfig,
  InterceptorConfig,
  ToolbarConfig,
  SearchConfig,
  ExportOptions,
  ImportOptions,
  PrintConfig,
  RowConfig,
  ColumnConfig,
  FilterConfig,
  UiConfig,
  SizeConfig,
  RangeSelectionConfig,
  PaginationConfig,
  UrlStateConfig,
  ValidateError,
  ColumnEditorRules,
} from '@advanced-elements/elements'

// 配置类型
import type { AdvConfig, AdvTableConfig } from '@advanced-elements/elements'
```

> **说明**：表单（`AdvForm` 等）相关类型属于规划中的 `@advanced-elements/form` 包，当前仓库尚未发布，不在上述导出范围内；如在某版本文档中见到表单类型引用，请以包实际导出为准。

---

## 样式引入

```ts
// 方式 1：JS 中引入
import '@advanced-elements/elements/style'

// 方式 2：SCSS 中引入
@import '@advanced-elements/elements/style/index.scss';

// 方式 3：CSS 中引入
@import '@advanced-elements/elements/style/index.css';
```

---

## Peer Dependencies

| 依赖 | 版本要求 | 说明 |
|------|---------|------|
| `vue` | `^3.5.28` | 必需 |
| `vue-router` | `^4.0.0 \|\| ^5.0.0` | 可选（URL State 功能） |
| `xlsx` | `^0.18.5` | 可选（Excel 导入导出） |
