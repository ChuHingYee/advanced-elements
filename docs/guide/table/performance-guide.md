# Performance Guide | 性能指南

> 针对 `10000 行 × 50 列` 场景

## 1. 阈值

- `LARGE_DATASET_THRESHOLD = 1000` 未 `virtual` 告警
- `ROW_KEY_FALLBACK_LIMIT` 超 `10000` 降窗口 `windowKeyToIndex`
- `SPAN_CELL_LIMIT` `row×col` 超限跳过 `span`
- `VALIDATE_BATCH_SIZE = 50` 粘贴 `5000` 格分批 `~200ms`
- `PINNED_ROWS_SOFT_LIMIT = 50` 固定行 `dev` 告警

## 2. 管线复杂度

- `classifyColumns` `O(m)` `50 列 ~0.05ms`
- `filter` `O(n×f)` `10000×5 ~15ms`
- `sort` `O(n log n)` `10000 ~12ms`，阈值上 `Worker`
- `span` `O(n×m)` `10000×20=200k` `~16MB`，窗口化后 `O(window×m)`
- `rowKeyMeta` `O(n)` `~3ms`，`WeakMap` 命中 `O(1)`

## 3. 建议

- `>1000` 行必 `mode="virtual"` + `height` 数值
- `autoSizeColumns` 关闭时 `width` 必传 `number`，否则 `v2ColumnsOverflow` 不检测
- `span` 与 `append/expand` 互斥（`DynamicSizeGrid` `overflow:hidden` 裁切）
- `quickFilter` `5000` 行文本缓存，上限外逐行 `resolveCellDisplayValue`
- `debug:true` 时 `withPerf` `>1ms` 才 `console.debug`
