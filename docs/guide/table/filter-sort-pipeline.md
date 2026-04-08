# Filter/Sort Pipeline | 过滤排序管线

> `use-filter-pipeline.ts:1` `use-sort-pipeline.ts:1` 抽取自 `use-table-data-pipeline:311`

## 1. 过滤三阶段 `O(3n)`

```
afterColumnFilter (useColumnFilter: text/number/date/enum)
 → afterQuickFilter (useQuickFilter: 快速筛选 5000 缓存)
  → afterExternalFilter (externalFilter.isExternalFilterPresent/dosePass)
```

`filterState` `Record<string, ColumnFilterValue>` 每次 `setFilter` 新对象，需 `shallowEqualByValue` 去重，避免远程 `refetch` 风暴

## 2. 排序 `O(n log n)`

```
afterExternalFilter → useColumnSort → finalDisplayData
```

`maxSortColumns` 限制多列，`Worker` 阈值 `sortWorkerThreshold` 后台 `postMessage` 克隆 `10k ~8ms`

## 3. 集成

- `use-table-data-pipeline` 占位，后续可 `useFilterPipeline`/`useSortPipeline` 直接接入
- `benchmark-pipeline.mjs` 基准 `filter 0.87ms` `sort 14ms` `10k×5`
