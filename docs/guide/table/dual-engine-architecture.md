# Dual-Engine Architecture | 双引擎架构

> `mode: 'virtual' | 'default'` 单点分发，`ITableRenderer` 显式契约

## 1. 分发点

- `useTableConfig` → `isVirtual: ComputedRef<boolean>` → `useTableRendererRefs.rendererAdapter.component` → `table.vue:rendererProps` `defaultRendererProps / virtualRendererProps`
- **禁止** `v-if="mode==='virtual'"` 硬分支，新增功能仅实现 `types/renderer-interface.ts:ITableRenderer`

## 2. 域

```
Core (config/i18n/error/rowKey)
 → DataColumns (columns/request/pipeline)
  → Selection (rowKeyMeta)
   → Interaction (drag/range)
    → SharedEditing (tooltip/edit)
     → Features (search/export)
      → RendererIntegration (events/provide)
```

`reactive(tableOrchestrator)` 单 `Proxy`，`api` 经 `markRaw` 透传，`shallowRef` 持有 `tableData`。

## 3. 双模式差异矩阵

| 功能 | default (ElTable) | virtual (ElTableV2) | 统一 |
|------|-------------------|---------------------|------|
| stripe | `stripe` prop | `row-class adv-table-v2__stripe-row` `var(--el-table-row-striped-bg-color)` | 视觉一致 |
| height | `string\|number` 透传 | `numericHeight` 解析 `400` 回退 | `ElAutoResizer` |
| span | `span-method` | `cellProps: spanCellProps` | `getSpanInfo` |
| fixed | 透传 `fixed` | 抽 `fixedV2Columns` `needsFixedWidth` | `hasFixed` |

## 4. 能力公开矩阵（C4 公开承诺）

> 源头：`src/types/renderer-caps.ts`（`RendererCaps` + `RENDERER_CAPS` 穷尽注册）。新增渲染模式只需登记一套 caps，消费方零改动；下表是对外行为承诺，改动即 breaking。

| 能力位 | default | virtual | 降级/忽略行为 |
|---|---|---|---|
| `declarativeColumns` | ✅ `<el-table-column>` 声明式列 | ❌ 不支持 | 具名 `default` 插槽被忽略，派发 `TABLE_VIRTUAL_SLOT_IGNORED` |
| `spanWithDynamicHeight` | ✅ 共存 | ❌ 动态网格裁切 rowspan | 派发 `TABLE_SPAN_DYNAMIC_HEIGHT_UNSUPPORTED`（C6 `rfc-overlay` 为长期解） |
| `smoothScroll` | ✅ `behavior` 生效 | ❌ 忽略 | 静默按即时滚动 |
| `rowIndexDomain` | `composed`（pin 交错） | `unpinned`（网格＋独立条带） | 逻辑层统一 unpinned，跨 pin 一律经 adapter `toRenderIndex`/`toRowKey` 换算 |
| `selectionScope` | `page`（当前页） | `filtered`（全部筛选结果，跨页） | 有意设计（对齐 AG Grid）；`selectAllOnCurrentPage` 恒为当前页 |
| `scrollFollow` | 否（目标已渲染） | 是（目标可能未渲染，委托渲染器滚动） | — |
| `columnDomain` | `cells`（事件域同构，恒等） | `event`（经列 key 映射翻译） | 未命中返回 `-1`（域外，优雅降级不高亮） |

单模式 prop 按 `mode` 判别收窄类型（传错模式即编译报错，见 `AdvTableProps` 判别联合；dev 提示保留用于 JS 侧）：

| prop | 生效模式 | 异模式行为 |
|---|---|---|
| `size` | default | virtual 下传参即编译报错（`size?: never`，密度改走 `uiConfig.sizeConfig`） |
| `tableLayout` | default | virtual 下传参即编译报错（virtual 恒按显式列宽布局） |
| `estimatedRowHeight` | virtual | default 下传参即编译报错；置数后 virtual 切 `DynamicSizeGrid`（性能显著下降，见 prop 文档） |

## 4. 性能

- `rowKeyMeta` `WeakMap` 缓存 `O(1)` 命中，`virtualKeyToIndex` 窗口 `O(window)` `ROW_KEY_FALLBACK_LIMIT`
- `spanMap` 按 `renderData` 域，`pagination` 即新引用必重建
- `aria-selected` `>500` 跳过，`quickFilter` `5000` 缓存

## 5. 长期

- `span×Dynamic` 覆盖层 `composables/rendering/use-span-overlay.ts`（RFC）
- `ITableRenderer` 已显式 `satisfies`，后续 `useStableComputed` 普及
