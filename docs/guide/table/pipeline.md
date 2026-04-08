# Pipeline | 数据管线

> `use-table-data-pipeline.ts:311` `540` 行 `Filter → QuickFilter → ExternalFilter → Sort → Tree → Group → Expand → Pagination → Pin → Span`

## 1. 流程

```
localColumns → classifyColumns → columnClassification
pipelineData → useColumnFilter → afterColumnFilter
afterColumnFilter → useQuickFilter → afterQuickFilter
afterQuickFilter → externalFilter → afterExternalFilter
afterExternalFilter → useColumnSort → finalDisplayData
finalDisplayData → usePaginationVisibility → visibleData
visibleData → useRowPin → renderData
renderData → useCellSpan → spanMap
```

`WeakMap` 列分类 `O(m)` 仅首次，`rowKeyMeta` `WeakMap` `O(1)`，`span` 窗口 `O(window×m)`

## 2. 分支

- `includeSynthetic:true` 合成行计入分页 `visibleDataBefore`，`false` 仅数据行分页后 `expandedAfter`
- `tree` 与 `rowGroup` 互斥 `dev` 警告 `use-table-data-pipeline.ts:351`
- `span×pin` `span×Dynamic` 双 `dev` 警告

## 3. 扩展

- `use-column-classification.ts:1` 已抽取 `classifyColumns`
- `use-pagination-visibility.ts:1` 已抽取 `visibleData` 双分支
- 后续 `Filter/Sort/Hierarchy` 可独立 `composable`
