# Ownership Matrix（跨路径规则唯一实现位置）

> R2 附属：新增跨路径规则必须先登记本表，否则 PR 不合入。

| 规则 | 唯一实现 | 说明 |
|---|---|---|
| 树级联可选性 | `composables/data/use-tree-data.ts` | 级联选中唯一口径 |
| `pause/destroy` 顺序 | `composables/interaction/use-row-drag.ts:rowCleanup` | 先 destroy 实例再 pause |
| `fixed:true` 口径 | 主编排加固盘（归左） | 左固定唯一归宿 |
| 双排序（远程/本地） | `composables/data/use-table-request.ts` + 管线 | 远程以服务端为准 |
| 行号域 | `use-renderer-adapter.ts:toRenderIndex/toRowKey`（R3） | unpinned 基准 |
| 选择作用域 | `selection/use-table-selection.ts:resolveScopeData` | 查 `selectionScope` |
| 受控判定 | `use-adv-table.ts:validateTableConfig`（ADR-002） | 统一矩阵 |
| 跨层字段新增 | 按域 `injection-keys.ts` 加键（R2） | 禁入上帝（已删除） |
| 空闲调度 | `utils/raf.ts:idleSchedule`（D4） | span 与 summary 同源；代际守卫归调用方 |
| 列宽下限 | `constants:clampMinWidth`（D4） | 非法值/键盘/拖拽三处同语义调用 |
| 尾随防抖 | `utils/debounce.ts:createTrailingDebounce`（D4） | 列落盘/远程 refetch；`useDebounceFn`（无 flush，用于 clipboard）`refDebounced`（值防抖）`rafThrottle`（滚动 leading+trailing 节流）语义不同，各守其位 |
