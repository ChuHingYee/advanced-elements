# @advanced-elements/table

## 2.2.0-beta.0

### Minor Changes

- 208a1ea: <zh/> 2.2.0-beta 线随本预发版交付：`RequestMode` 请求模式与跨页选择（`selectedRowKeys`）；列设置与行拖拽由 sortablejs 迁移至 vue-draggable-plus；`default`/`virtual` 双引擎行为对齐。完整能力清单见文档站表格组件页。
  <en/> The 2.2.0-beta line ships with this prerelease: `RequestMode` and cross-page selection (`selectedRowKeys`); column-setting and row drag migrated from SortableJS to vue-draggable-plus; `default`/`virtual` dual-engine behavior aligned. See the docs site table page for the full capability list.

### Patch Changes

- Updated dependencies [208a1ea]
  - @advanced-elements/config-provider@0.1.0-beta.0

## 4.0.0

### Major Changes

- Beta 主线：`mode` 默认 `virtual`，双引擎（`default` 走 `ElTable`、`virtual` 走 `ElTableV2`）
- 挂载/卸载资源配平门：全局监听、`MutationObserver`、`tableId` 注册表严格配平；`ResizeObserver` 设上界（EP ElTable `style-helper` 每挂载泄漏 2 个，EP 2.14.7 实测的上游问题，升级 EP 时重估）
- 完整 API 见文档站表格组件页与 `docs/guide/table/migration-guide.md` 的 v3 → v4 说明
