# MEMORY

## 这个仓库的硬事实（反复踩到的）

- 包管理只认 pnpm（`preinstall` 拦 npm/yarn）；共享依赖走 `pnpm-workspace.yaml:catalog:`；用 `pnpm`，不用 npm。
- 写注释按根 `COMMENT_CONVENTIONS.md`：`<zh/>` 在前 `<en/>` 在后；props/emits/expose/类型写 JSDoc，组件头/slot 写 HTML 注释；纯透传/测试/私有 helper 不写。
- `packages/table/src` 通用层禁 `axios` / `pinia` / `vuex` / `fetch` / `useStore`（数据经 `request.source`，状态经 props/provide）——写示例也别引入这些。
- 文档站的示例是真组件：`docs/examples/**/*.vue` + `:::demo <标题> <文件>`；示例代码即面板内容，改示例等于改文档，两边不会漂移。写法见 `docs/guide/contributing.md`。
- docs 目录没有 `package.json`，`.vitepress` 下的新模块用 `.mjs`（否则 vite 8 的 `configLoader: 'native'` 会报 "ESM syntax in a file loaded as CommonJS"）。
- docs 里多数 `.md` 是 CRLF 行尾且仓库无 `.gitattributes`；批量改写这些文件要保持行尾，否则整文件 diff。

## AdvTable API 的反直觉点

- 默认渲染模式是 `virtual`（ElTableV2）；SSR 下虚拟网格渲染不出行，会 hydration mismatch。
- 选择列不会自动注入：`columns` 里要写 `{ selection: true }`，`rowConfig.rowSelection` 只决定行为。
- `valueEnum` 要配 `valueType: 'select'` 才渲染标签。
- `pagination.mode: 'manual'` 不调用 `request.source`，只派发 `pageChange`；本地数据追加必须显式传 `total`。
- 事件是「载荷 + tableId」两个位置参数，handler 第一个参数才是载荷。
- 类型以 `packages/table/src/types/*.ts` 为准，文档示例曾经写错过（`autoSize()`、`topRowHeight`、`search type: 'daterange'` 都不存在）。