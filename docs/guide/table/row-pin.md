# 行固定（Pin）

`rowPinConfig` 允许将任意行固定在表格顶部或底部，典型场景是合计行、小计行。

## 基础用法

:::demo 行固定 table/row-pin.vue
:::

- `topRowKeys` / `bottomRowKeys`：按行键（rowKey 解析结果）固定
- 固定行不参与排序/筛选/分页，始终位于视口顶部/底部
- `maxPinnedRows`：顶部 + 底部合计上限（默认 50），超出部分回退滚动区并派发 `TABLE_PIN_LIMIT_EXCEEDED`

## 运行时 API

```ts
const tableRef = ref<TableInstanceExpose<Row>>()

tableRef.value?.pinRow('summary-total', 'top') // 运行时动态固定
tableRef.value?.unpinRow('summary-total') // 取消固定
tableRef.value?.isRowPinned('summary-total') // 是否已固定
tableRef.value?.clearPinnedRows() // 清空全部固定
```

运行时固定的键不必出现在初始配置中；渲染顺序 = 配置序 ∪ 运行时插入序，清除固定后自动回到原位。

## 注意事项

- 固定行的行键需能在数据中唯一定位；键缺失的行会被忽略并告警
- default 模式下固定行通过渲染顺序实现（置顶/置底），virtual 模式由虚拟列表预留高度槽位
- 与 `spanConfig` / `spanMethod` 已支持组合：合并统一索引域已落地，`spanMap` 建在 `unpinned` 数据顺序上，`ranges` 按 `unpinned` 顺序声明；pin 条带与 grand 合计行永不参与合并，可放心组合
- 与固定列同时启用时，固定行条带以 `z-index: 2` 覆盖，固定列宽度需为数值，否则可能出现横向错位（开发期会给出提示）
