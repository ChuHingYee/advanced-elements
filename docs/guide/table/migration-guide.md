# Migration Guide | 迁移指南

> `ElTable` → `AdvTable` / `AdvTable v1` → `v2.3`

## 1. ElTable → AdvTable

| ElTable | AdvTable | 备注 |
|---------|----------|------|
| `<el-table :data>` | `:data` 或 `:request="{source, auto}"` | `request` 优先，`data` 透传闭环 |
| `stripe` | `stripe` 双模式一致 `var(--el-table-row-striped-bg-color)` | `virtual` 经 `row-class` |
| `height` | `height` 字符串/数值，`virtual` 回退 `400` | `numericHeight` 解析 |
| `tree-props` | `:tree-config="{children}"` | 禁用 `ElTable` 原生 `tree`，手动 `flattenedData` |
| `span-method` | `:span-config` + `:span-method` 优先 | `spanMethod` 覆盖 `spanConfig` |

## 2. v1 → v2.3

- `mode` 默认 `virtual`，`height` 未传回退 `400` 避免白屏
- `rowKey` 必传 `string`，`selectedRowKeys` `string|number` 归一 `string`
- `quickFilter` 防抖 `300ms` `filterConfig.quickFilterDebounce`
- `beforeDataChange` 可 `return false` 否决，需 `writeFn` 内写入
- `ITableRenderer` 显式 `types/renderer-interface.ts`

## 3. v3 → v4（beta）

- `mode` 默认 `virtual`（未传时按虚拟渲染；需 ElTable 语义请显式 `mode="default"`，见 `AdvTable.vue` 默认值）
- 双引擎：`default` 走 `ElTable`，`virtual` 走 `ElTableV2`，列/事件口径见表格完整 API
- 已知上游行为：`default` 模式下 EP ElTable 每次挂载泄漏 2 个 `ResizeObserver`（`style-helper`，EP 2.14.7 实测），属上游问题，本库挂载/卸载配平门已据此设界，升级 EP 时重估

## 4. 检查清单

- [ ] `check:comment` `npm run check:comment` 双语 `warn-only`
- [ ] `typecheck` `vue-tsc` 契约锚定
- [ ] `high-risk-combo` `3` 用例 `vitest`
