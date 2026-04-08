# ADR-001：行索引域 unpinned 基准 + 身份换算

> 状态：已实施（R3）| 日期：2026-09-22

## 背景
`span × rowPin` 合并错位：span 按全表行号建图，pin 条带与 grand 合计行插空后全表错位。

## 决策
逻辑层统一 unpinned 基准 + 行对象身份换算；default 的 composed 交错仅为渲染装配细节。
跨 pin 调用方一律经 adapter `toRenderIndex/toRowKey`（`use-renderer-adapter.ts`），禁裸 index。

## 为何不用偏移量
grand 顶/底滚动行插空（`use-v2-grand-total.ts:164-177`）使偏移量非常数；身份换算对插空天然免疫。

## 为何不动 virtual
virtual 网格 + 独立 pin 条带已是 unpinned 实现，改 composed 反而引入回归。

## 产品语义
pin 条带与 grand 合计行永不参与合并；`ranges` 按 unpinned 数据顺序声明（`docs/guide/table/span.md`、`row-pin.md`）。
