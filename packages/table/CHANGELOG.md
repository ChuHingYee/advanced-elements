# @advanced-elements/table

## 4.0.0

### Major Changes

- Beta 主线：`mode` 默认 `virtual`，双引擎（`default` 走 `ElTable`、`virtual` 走 `ElTableV2`）
- 挂载/卸载资源配平门：全局监听、`MutationObserver`、`tableId` 注册表严格配平；`ResizeObserver` 设上界（EP ElTable `style-helper` 每挂载泄漏 2 个，EP 2.14.7 实测的上游问题，升级 EP 时重估）
- 完整 API 见文档站表格组件页与 `docs/guide/table/migration-guide.md` 的 v3 → v4 说明
