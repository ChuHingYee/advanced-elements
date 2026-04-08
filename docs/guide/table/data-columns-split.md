# DataColumns Split | 数据列拆分设计

> `use-adv-table-data-columns.ts:629` 单文件承载 `columns+request+pipeline` 三职责，循环依赖被迫合并

## 1. 现状

- `Columns ↔ Data` 循环：`pipeline` 需 `effectiveColumns`，`columnState` 需 `sortState`
- `817` 行 `use-table-data-pipeline` 含 `filter/sort/tree/group/expand/pin/span` `7` 管线串行

## 2. 目标

```
ColumnsOrchestrator (localColumns, classify, state)
RequestOrchestrator (request, pagination, urlState)
PipelineOrchestrator (filter, sort, tree, group, expand, pin, span)
```

`Columns` 与 `Request` 无依赖可并行，`Pipeline` 依赖前两者结果，`Selection` 依赖 `Pipeline` 输出

## 3. 收益

- 单文件 `629→200` 行，`Pipeline` `817→3×250` 行
- `WeakMap` 列分类 `O(m)` 仅首次，`visibleData` 双管线可合并为 `includeSynthetic` 单分支

## 4. 实施

- `Stage14` 已 `WeakMap` 缓存 `classifyColumns`
- `Stage15` 拆 `Pipeline` 为 `FilterPipeline/SortPipeline/HierarchyPipeline` 独立 `composable`
