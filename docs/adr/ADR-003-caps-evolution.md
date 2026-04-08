# ADR-003：caps 演进流程

> 状态：已实施（R3）| 日期：2026-09-22

## 能力位
`declarativeColumns` / `spanWithDynamicHeight` / `smoothScroll` / `rowIndexDomain` / `selectionScope` / `scrollFollow` / `columnDomain`。
`rowVirtualization` 已删除；`isVirtual`/`mode ===` 字面量冻结，模板一律查 caps。

## 新增能力位三步
1. `types/renderer-caps.ts` 加位 + 两套 caps 赋值；
2. `use-renderer-adapter.ts` 登记（穷尽检查即红）；
3. 旧分支逐个迁到 caps 查询，每处独立 PR + 单测。

## 模板规则
`table.vue` 禁 `isVirtual` 字面量：`declarativeColumns` 判插槽、`rowIndexDomain` 派发工厂。
