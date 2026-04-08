# AdvConfigProvider 全局配置

全局配置提供者，以组件名为 key 配置所有 Advanced Elements 子组件的全局默认值。组件 props 始终优先于全局配置。

## 安装

```shell
pnpm add @advanced-elements/config-provider
```

或通过统一包引入：

```shell
pnpm add @advanced-elements/elements
```

## 用法

```vue
<script setup>
import AdvConfigProvider from '@advanced-elements/config-provider'
// 或 import { AdvConfigProvider } from '@advanced-elements/elements'

const globalConfig = {
  table: {
    pagination: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    toolbar: { exportBtn: true, columnSetting: true },
    border: true,
    resizable: true,
  },
}
</script>

<template>
  <AdvConfigProvider :config="globalConfig">
    <AdvTable :columns="columns" :data="data" />
  </AdvConfigProvider>
</template>
```

支持嵌套覆盖：子级 `AdvConfigProvider` 中设置的配置会与父级合并，子级优先级更高。

```vue
<template>
  <AdvConfigProvider :config="globalConfig">
    <!-- 子级覆盖父级的 pageSize -->
    <AdvConfigProvider :config="{ table: { pagination: { pageSize: 50 } } }">
      <AdvTable :columns="columns" :data="data" />
    </AdvConfigProvider>
  </AdvConfigProvider>
</template>
```

---

## Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `config` | `AdvConfig` | `{}` | 全局配置对象，以组件名为 key |

---

## Slots

| 插槽名 | 说明 |
|--------|------|
| `default` | 子组件内容 |

---

## AdvConfig 类型

```typescript
interface AdvConfig {
  table?: AdvTableConfig
  // 未来扩展：form?, dialog?
}
```

---

## AdvTableConfig 完整定义

> **子集声明**：全局配置是组件 props 的**默认值子集**（key 与 `AdvTableProps` prop 名一致，未指定的 prop 用此处值；组件上显式传的 prop 始终优先）。
> 完整 prop 类型（含 `ExportOptions`/`ImportOptions`/`PrintConfig` 等展开结构）见[表格组件文档](/components/table)。
> 表格语言不在此配置：请用 Element Plus 自身的 ConfigProvider（`locale`）切换。

### 基础配置

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `border` | `boolean` | `true` | 显示表格边框 |
| `resizable` | `boolean` | `true` | 允许拖拽调整列宽 |
| `emptyText` | `string` | - | 空数据时显示的文本 |
| `performanceProfile` | `'high' \| 'low'` | - | 性能档位，`'low'` 关闭滚动看门狗等重路径（低端设备） |
| `containerLayout` | `'bordered' \| 'bare'` | `'bordered'` | 容器布局模式 |

### 请求配置 `request`

| 属性 | 类型 | 说明 |
|------|------|------|
| `auto` | `boolean` | 初始化时是否自动请求 |
| `formatMaps` | `Record<string, string>` | 响应数据字段映射 |
| `paramKeys` | `{ page?, size? }` | 分页参数 key 映射 |
| `transformRequest` | `(page, size, params) => Record<string, unknown>` | 请求参数转换函数 |
| `transformResponse` | `(response) => any` | 响应数据转换函数 |

### 分页配置 `pagination`

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `true` | 是否启用分页 |
| `pageSize` | `number` | `10` | 每页条数 |
| `pageSizes` | `number[]` | `[10, 20, 30]` | 每页条数选项 |
| `layout` | `string` | `'total, sizes, prev, pager, next, jumper'` | 分页布局 |
| `background` | `boolean` | - | 分页组件背景色 |
| `mode` | `'page' \| 'manual' \| 'client'` | `'page'` | 分页模式 |
| `sticky` | `boolean` | `true` | 是否固定底栏 |
| `containerHeight` | `number` | `450` | 容器高度（virtual 模式） |
| `rowHeight` | `number` | `48` | 行高（autoPageSize/virtual 模式） |
| `autoPageSize` | `boolean` | `false` | 自动计算每页条数 |
| `infiniteScroll` | `boolean` | `false` | 无限滚动自动加载（manual + virtual 模式） |

### 搜索配置 `search`

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用搜索 |
| `collapsed` | `boolean` | `false` | 是否默认折叠 |
| `buttons` | `('query' \| 'reset' \| 'add' \| 'fullscreen')[]` | `['query', 'reset']` | 按钮配置 |
| `debounceTime` | `number` | `300` | 防抖时间(ms) |
| `span` | `number` | `6` | 表单项栅格占比 |

### 工具栏配置 `toolbar`

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `columnSetting` | `boolean` | `true` | 显示列设置按钮 |
| `refreshBtn` | `boolean` | `false` | 显示刷新按钮 |
| `pollingBtn` | `boolean` | `false` | 显示轮询按钮 |
| `pollingOptions` | `{ time?, immediate? }` | - | 轮询配置（间隔 ms，默认 3000；是否立即开始） |
| `exportBtn` | `boolean` | `false` | 显示 Excel 导出按钮 |
| `exportOptions` | `{ filename?, sheetName?, columnMode? }` | - | Excel 导出配置（完整结构见表格文档 `ExportOptions`） |
| `exportCsvBtn` | `boolean` | `false` | 显示 CSV 导出按钮 |
| `exportCsvOptions` | `{ filename?, columnMode? }` | - | CSV 导出配置 |
| `importBtn` | `boolean` | `false` | 显示导入按钮 |
| `importOptions` | `Record<string, unknown>` | - | 导入配置（完整结构见表格文档 `ImportOptions`） |
| `printBtn` | `boolean` | `false` | 显示打印按钮 |
| `printOptions` | `Record<string, unknown>` | - | 打印配置（完整结构见表格文档 `PrintConfig`） |

### 行配置 `rowConfig`

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `rowSelection` | `'single' \| 'multiple'` | `'multiple'` | 行选择模式 |
| `rowMultiSelectWithClick` | `boolean` | `true` | 允许单击多选 |
| `suppressRowClickSelection` | `boolean` | `false` | 禁止点击行选中 |
| `rowClickSelect` | `boolean` | `true` | 点击行触发选中 |
| `rowDraggable` | `boolean` | `false` | 启用行拖拽排序 |
| `rowDragHandle` | `string` | - | 拖拽手柄 CSS 选择器 |

### 列配置 `columnConfig`

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `sidePanel` | `boolean` | `false` | 启用列设置侧边面板 |
| `sidePanelPosition` | `'left' \| 'right'` | `'right'` | 面板位置 |
| `sidePanelDefaultOpen` | `boolean` | `false` | 初始展开面板 |
| `sidePanelDestroyOnClose` | `boolean` | `true` | 关闭销毁内容 |

### 筛选配置 `filterConfig`

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `sidePanel` | `boolean` | `false` | 启用侧边筛选面板 |
| `sidePanelPosition` | `'left' \| 'right'` | `'right'` | 面板位置 |
| `sidePanelDefaultOpen` | `boolean` | `false` | 初始展开面板 |
| `sidePanelDestroyOnClose` | `boolean` | `true` | 关闭销毁内容 |
| `floatingFilter` | `boolean` | `false` | 启用内联浮动筛选 |

### URL 状态同步 `urlState`

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 启用 URL 状态同步 |
| `pageKey` | `string` | `'p'` | 页码 URL 参数名 |
| `sizeKey` | `string` | `'s'` | 每页条数 URL 参数名 |

### UI 配置 `uiConfig`

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `columnEmptyText` | `string` | `'-'` | 空单元格占位符 |
| `sizeConfig` | `{ headerCellHeight?, cellPadding?, headerCellPadding?, floatingFilterHeight?, cellFontSize?, rowHeight?, summaryRowHeight? }` | - | 尺寸预设的个别值覆盖（完整结构见表格文档 `SizeConfig`；`size`/`namespace` 走 EP 自身 ConfigProvider） |

### 通知

| 属性 | 类型 | 说明 |
|------|------|------|
| `notify` | `(type, message, source) => void` | 自定义通知通道，覆盖默认 ElMessage（SSR 下默认降级 console） |

### 其他

| 属性 | 类型 | 说明 |
|------|------|------|
| `interceptor` | `Record<string, (params) => boolean \| void>` | 全局拦截器：返回 `true` 阻止默认行为；实例级 `interceptor` prop 优先于全局执行 |

---

## 包导出 API

### 组件

```typescript
import AdvConfigProvider from '@advanced-elements/config-provider'
// 或
import { AdvConfigProvider } from '@advanced-elements/elements'
```

### Composables

```typescript
import { useAdvConfig, provideAdvConfig, advConfigKey } from '@advanced-elements/config-provider'
```

| 名称 | 类型 | 说明 |
|------|------|------|
| `useAdvConfig()` | `() => Ref<AdvConfig>` | 注入祖先组件的全局配置，无 Provider 时返回空 ref `{}` |
| `provideAdvConfig` | `(ref: Ref<AdvConfig>) => void` | 向后代提供配置（组件内部使用） |
| `advConfigKey` | `InjectionKey<Ref<AdvConfig>>` | 注入 key Symbol |

### 类型导出

```typescript
import type { AdvConfig, AdvTableConfig } from '@advanced-elements/config-provider'
```

---

## 示例

### 基础用法

```vue
<script setup>
import AdvConfigProvider from '@advanced-elements/config-provider'

const config = {
  table: {
    pagination: { pageSize: 20 },
    border: true,
    resizable: true,
    toolbar: { exportBtn: true, columnSetting: true },
  },
}
</script>

<template>
  <AdvConfigProvider :config="config">
    <AdvTable :columns="columns" :data="data" />
  </AdvConfigProvider>
</template>
```

### 嵌套覆盖

```vue
<template>
  <AdvConfigProvider :config="{ table: { border: true } }">
    <!-- 所有表格默认有边框 -->
    <AdvTable :columns="columns" :data="data1" />

    <AdvConfigProvider :config="{ table: { border: false, resizable: false } }">
      <!-- 此表格无边框、不可拖拽列宽 -->
      <AdvTable :columns="columns" :data="data2" />
    </AdvConfigProvider>
  </AdvConfigProvider>
</template>
```

### 编程式读取配置

```vue
<script setup>
import { useAdvConfig } from '@advanced-elements/config-provider'

const config = useAdvConfig()
// config.value.table?.pagination?.pageSize → 20
// config.value.table?.border → true
</script>
```
