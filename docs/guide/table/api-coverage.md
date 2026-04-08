# API Coverage | 接口覆盖

> `11.md` 14 功能 × `table-props.ts` `AdvTableProps` 校验

| # | 功能 | Props | 已覆盖 | 缺口 |
|---|------|-------|--------|------|
| 1 | 数据加载 | `request.source/auto` `data` | ✅ `use-table-request` `WeakMap` | - |
| 2 | 分页 | `pagination` `isClient` | ✅ `isCorrectingPage` | - |
| 3 | 多选 | `rowConfig.rowSelection` `selectedRowKeys` | ✅ `aria-selected Set` | - |
| 4 | 排序 | `sortConfig.maxSortColumns` | ✅ `isSortStateEqual` 含 `columnKey` | - |
| 5 | 筛选 | `filterConfig` `quickFilter` `externalFilter` | ✅ `300ms debounce` | - |
| 6 | 合并 | `spanConfig` `spanMethod` | ✅ `span×pin` `fixed×pin` 双守卫 | `span×Dynamic` 仅 `warn`，`RFC` 占位 |
| 7 | 展开 | `rowExpandConfig` `treeConfig` | ✅ `DynamicSizeGrid` 回退 | - |
| 8 | 拖拽 | `rowConfig.draggable` | ✅ `rowKey` 快照 | `P1-6` 回收小众 |
| 9 | 动态列 | `columns` `v-model:columns` | ✅ `ShallowRef` `classifyColumns` | - |
| 10 | 自定义渲染 | `render/cellRenderer` | ✅ `resolveColumn` 统一 `ProcessedColumn` | - |
| 11 | 树形 | `treeConfig` | ✅ `flattenedData` `WeakMap` | - |
| 12 | 固定列 | `fixed` | ✅ `needsFixedWidth` `z-index:2` | - |
| 13 | 行编辑 | `editConfig` `rowKey?` | ✅ `batchCommit rowKey?` | 全链 `rowKey` 待 `codemod` |
| 14 | 虚拟 | `mode` `height` `estimatedRowHeight` | ✅ `numericHeight 400` `cache` | `v-memo` 跳过 |

> 覆盖率 `13/14` `93%`，剩余 `span×Dynamic` 为 `RFC` 不计入。
