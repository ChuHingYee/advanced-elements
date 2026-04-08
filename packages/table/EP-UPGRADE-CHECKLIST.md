# Element Plus 升级检查清单（AdvTable 耦合点）

> AdvTable 对 Element Plus 非公开实现的运行时依赖已收敛到以下单点（9 项，含样式与无障碍各 1 项）。
> 升级 `element-plus` 主/次版本后，按本清单逐项回归；补丁版本跑单测 + dom-adapter-guard，
> 涉及 `use-v2-row-height-reset` / 滚动对账文件变更时必须真机走查（私有耦合下 patch 也可能静默失效）。

## 1. 单点收敛位置（优先检查）

| # | 位置 | 依赖内容 | 失效症状 | 回归方法 |
|---|---|---|---|---|
| 1 | `src/components/table-virtual-renderer/use-v2-scroll-api.ts` | `ElTableV2` 实例的 `scrollTo` / `scrollToRow` / `scrollToTop`（公开 API，集中探针，miss 返回 false，禁 DOM 降级） | 滚动定位 API 全部返回 `false`：`scrollToRow`/`scrollToColumn`/悬停滚动/重挂载恢复失效 | 单测覆盖探针；真机调用 `tableApi.scrollToRow(key)` |
| 1b | `src/components/table-virtual-renderer/use-v2-row-height-reset.ts` + `use-scroll-reconcile.ts` | Vue 私有实例形状（`component.exposed/subTree`、`$.subTree`、`$el.__vnode`、`$forceUpdate`）+ EP 未暴露的 `TableGrid.resetAfterRowIndex` / 行 `style.top` 定位约定 / `scrollTo` early-return 守卫语义 | 动态行高静默失效（行重叠/裁切）、滚动自愈循环失效或误写滚动位置 | 单测锁定探测有效性；真机异步撑高 + 程序化滚动走查；EP 暴露公开重测口后删除探测分支。**探测失败现已是生产可观测事件** `TABLE_ROW_HEIGHT_RESET_UNAVAILABLE`（经 `rendererError` 汇入 `@error`），`cause.reason` 区分 `fixed-grid` / `no-instance`（均正常）与 `no-native-entry`（**真正的 EP 漂移**）——升级后先查 `@error` 是否有该码，即可判定本项是否已断 |
| 2 | `src/components/renderer-core/{default,virtual}-dom-adapter.ts` | EP DOM **结构与层级**（行容器路径、主网格作用域、滚动条包装层、单元格定位器解析）——JS 侧唯一出口 | 滚动自愈、悬停定位、网格导航作用域、拖拽容器定位、单元格行列反查失效 | 跑 `__tests__/components/renderer-core/dom-adapter-guard.test.ts`（对拍真实渲染产物，CI 已纳入 unit） |
| 3 | `src/utils/ep-selectors.ts` | `.el-table-v2__*` / `.el-table__*` DOM 类名常量 + 命名空间化构造器（`epTableRow(ns)` 等）+ 点击判定用命名空间无关子串选择器（`EP_ANY_*_SELECTOR`） | 同上（适配器据此构造选择器；发类经构造器按运行时命名空间生成） | 全文搜索新增散落类名；跑虚拟滚动单测 + `ep-selectors.guard` |
| 4 | `src/style/_ep-classes.scss`（样式侧单点，构建期 `$ep-namespace`）+ 各样式文件头覆盖行 | 同上（CSS 侧）：一切 EP 类选择器跟随 `$ep-namespace`；静默字面量已清零 | 样式失效（边框/斑马纹/汇总条带）+ 自定义命名空间下整套 EP 相关规则脱钩 | 视觉走查 summary + border + stripe；`sass` 编译默认输出与基线逐选择器对拍；覆盖编译断言零 `.el-` 选择器 |
| 5 | `number-editor.vue` / `text-editor.vue` 的 BEM 类守卫 | `.el-input-number__increase`、`.el-input__clear`（公开主题契约，稳定） | 点击步进器/清空按钮时输入框失焦（仅体验退化） | 点击测试 |
| 6 | `src/components/renderer-core/el-table-tree-isolation.ts` | 内建树形激活机制：EP 无“关闭内建树形”开关，只能让 `tree-props` 指向不存在的键（`walkTreeNode` 取不到 children）；**只要传了 `row-key` 就会执行** | 树形渲染视觉异常；选择全选沿 children 重复级联 | 跑 `__tests__/components/renderer-core/el-table-tree-isolation.test.ts`（断言无 `${ns}-table__row--level-N`）；树形 demo 走查。**若 EP 新增显式开关，改为使用该开关并删除本模块** |
| 7 | `use-table-renderer.ts` / `use-virtual-renderer.ts` 的 props 白名单 | `Object.keys(ElTable.props)` 快照透传 | EP 新增 prop 不生效（功能缺失，非崩溃） | 对照 EP changelog 补白名单 |
| 8 | `src/components/renderer-core/grid-a11y-attrs.ts` 的 `normalizeGridHierarchy` | 渲染器产物的 **ARIA 角色约定**（`role="cell"` / `gridcell` / `row` / `rowgroup`）+ 原生 `table/thead/tbody/tr/td` 结构；锚点为库自有类名 `.adv-table__main`（非 EP 类名） | 网格无障碍归一静默失效（无报错）：`role` 层级错误 → axe 规则命中、屏幕阅读器行/列计数错乱 | 跑 `__tests__/integration/axe-full.test.ts` 与 `__tests__/components/renderer-core/renderer-dom-parity.test.ts`；用 axe DevTools 走查 default/virtual 两种模式的 `role` 树 |

## 2. 升级步骤

1. 升级前记录本清单第 1 项单测基线（`use-v2-scroll-api` 相关 + 虚拟滚动套件）。
2. 升级后依次执行：`pnpm typecheck`（捕获类型声明变更）→ 相关域单测（**必跑两个守护套件**：`renderer-core/dom-adapter-guard`、`renderer-core/el-table-tree-isolation`，前者现经 `dom-contract.assertDomContract` 一次列出全部失配选择器）→ play 真机走查（滚动/固定列/汇总/编辑聚焦/树形）。
3. EP 大版本：重新审计上表全部 8 项；次版本：审计第 1、2、3、6 项。
4. **peer 复用跟随**：本包 `dayjs` / `lodash-es` / `@vueuse/core` / `async-validator` 以 peer 复用 EP 副本（见 `package.json`）。EP 主/次升级后 diff `element-plus` 的 dependencies 与本包 peer ranges，失配即同步（peer 用 caret，EP 补丁升级零动作，仅跨次/主需对齐）。基线（EP 2.14.0）：`dayjs ^1.11.20` / `lodash-es ^4.18.1` / `@vueuse/core ^14.3.0` / `async-validator ^4.2.5`。

## 3. 已知 EP 内部竞态（勿删的防御代码）

- `table-virtual-renderer.vue` 的 `gridInstanceKey` 重挂载：规避 EP 2.14 `useData` pre-watcher 与网格类型切换的竞态（详见该处注释）。EP 修复该竞态前不得删除。
- `use-request.ts` 超时回调捕获“自家控制器”（注释记载的历史修复），EP/浏览器 Abort 语义变更时复查。

## 4. 已复核的 EP 类名硬编码（附理由与现状）

发布前审查（`2.md` 第六章「中危 7 处未命名空间化 `.el-*`」）建议把这些选择器并入
`ep-selectors.ts` 的命名空间化构造器。复核结论更新如下——凡标记“已解决”者均已完成改造并有守卫锁定：

| 位置 | 选择器 | 结论与理由 |
|---|---|---|
| `utils/drag-ghost.ts` | `td .cell` | **不改**：与命名空间无关：EP 在 `td` 内渲染的是裸 `cell` 类（无 `el-` 前缀），重编译 EP 改 `$namespace` 也不影响它。按建议改造反而会把它写成 `.${ns}-cell` 而**永不命中**。 |
| `use-editor-blur.ts` / `use-context-menu.ts` | `.el-popper` / `.el-select__popper` / `.el-picker__popper` / `.el-color-picker__panel` | **已解决**（命名空间专项）：改走命名空间无关的 `EP_ANY_POPPER_SELECTOR` 子串匹配（`[class*=...]`，任意前缀命中）。原“需给 6+ 模块补 namespace 串接”的成本判断已过时——但子串方案比串接更优（零 plumbing、未知前缀同样免疫），故采用子串而非串接。 |
| `use-table-renderer-events.ts` / `use-cell-range-selection.ts` | `.el-checkbox` / `.el-radio` / `.el-switch` | **已解决**：改走 `EP_ANY_CHECKABLE_SELECTOR` / `EP_ANY_SWITCH_SELECTOR` 子串匹配。`adv-table__switch` 包裹层同样命中，属同一排除域，行为不变。 |
| `text-editor.vue` / `number-editor.vue` | `.el-input__clear` / `.el-input-number__increase` 等 | **已解决**：改走 `EP_ANY_INPUT_CLEAR_SELECTOR` / `EP_ANY_INPUT_STEPPER_SELECTOR` 子串匹配。失配仍回退默认浏览器行为（无崩溃），语义不变。 |
| `column-renderer.tsx` 发出的展开/缩进/`el-icon` 类 | `el-table__expand-icon` 系 | **已解决**：发类一律经 `epTableExpandIcon(ns)` 等构造器按运行时命名空间生成，`namespace` 由 `TableContext`（`core.namespace`）透传。 |
| 样式侧 `.el-*` 字面量（tree/rtl/_mixins/virtual-table 等 10 余处） | 各见 `git log` | **已解决**：全部收敛到 `_ep-classes.scss`（构建期 `$ep-namespace` 单点，各文件头覆盖行跟随）。默认输出经 `sass` 编译与基线逐选择器对拍一致。 |

自定义命名空间现为受支持配置（非罕见例外）：运行时四元（EP ConfigProvider namespace / `uiConfig.namespace` / 本包 SASS `$ep-namespace` / EP 自身 SASS `$namespace`）必须配对，见 README 命名空间章节；失配改由 `TABLE_NAMESPACE_MISMATCH` 响亮失败（配置冲突走守卫校验，渲染产物脱钩走挂载后 DOM 实测），不再静默。

## 5. `TABLE_NAMESPACE_MISMATCH` 探针回归项（S-01，F-B01 缓解）

> 口径：尽力而为的兜底探针（`setupAdvTableLifecycle.probeNamespaceDom`），非全量断言。以下任一成立即跳过本次探测（不误报）：异步渲染器实例未就位、可见数据为空、表格根节点缺失、选择器抛错。

- **触发条件**：可见数据非空（`visibleData.length > 0`）且渲染器已就位，但按当前 dom 适配器选择器（`dom.getRowSelector()`，命名空间构造器按运行时命名空间生成）在 `#tableId` 根内零命中。
- **复现步骤**：配置 `uiConfig.namespace: 'custom'` 但不同时配对 SASS `$ep-namespace` 与 EP ConfigProvider namespace → 挂载含数据的表格 → 监听 `@error` 是否出现 `TABLE_NAMESPACE_MISMATCH`（`cause.source === 'dom-probe'`，含 `expectedSelector/namespace/visibleRows`）。
- **升级回归**：EP 主/次升级后，若 `@error` 出现该码，先按第 1 节第 2/3 项重跑 `dom-adapter-guard` + `ep-selectors.guard`；同一成因持续成立时仅告警一次（`validationFiredCodes` 去重），修复后解除去重标记。
- **回滚**：本文档变更为纯文档追加，回滚即 revert 本节；零运行时变更。

## 6. `TABLE_ROW_HEIGHT_RESET_UNAVAILABLE` 探针回归项（S-01，F-B02 缓解）

> 口径：`use-v2-row-height-reset.ts` 三路探测（直挂 `resetAfterRowIndex` → `$subTree` 子树漫步 → `$el.__vnode` 祖先链）
> 任一失败分支经 `use-v2-grid-core.ts:181-183` 的 `onUnavailable` 转接为 `rendererError` 汇入表格 `@error`
>（码 `TABLE_ROW_HEIGHT_RESET_UNAVAILABLE`，`cause.reason` 区分）。失败仅降级（返回 `false` + dev 一次性告警），不抛错。
> 本节锁定"探测失败 → 返回 false → 上报该码且 reason 可区分"的行为契约；单测锁定见
> `__tests__/components/table-virtual-renderer/use-v2-row-height-reset.test.ts`（`onUnavailable` reason 三分支）。

- **触发条件**（按 `cause.reason`，定义见 `src/components/table-virtual-renderer/use-v2-row-height-reset.ts:43`）：
  - `fixed-grid`：固定行高网格（`gridInstanceKey === 'fixed'`）——**正常**，无缓存行高可清，连实例探测都不做。
  - `no-instance`：动态网格但 ElTableV2 实例未就绪（`getInstance()` 为空）——**正常**，时序问题（挂载前/重挂载窗口）。
  - `no-native-entry`：实例就绪但三路探测全 miss——**真正的 EP 漂移**（EP 改名 `resetAfterRowIndex` 或改 TableGrid 层级/`exposed` 形状），需按升级排查。
- **复现步骤**：
  1. `no-native-entry`：mock `mode="virtual"` + 动态网格（`estimatedRowHeight`），提供无原生入口的实例（`getInstance: () => ({})`）→ 调用 `resetAfterRowIndex()` → 返回 `false`，`onUnavailable` 收到 `'no-native-entry'`，`@error` 出现该码。
  2. `no-instance`：`getInstance: () => null` → 返回 `false`，`onUnavailable` 收到 `'no-instance'`。
  3. `fixed-grid`：`isDynamic: () => false` → 返回 `false`，`onUnavailable` 收到 `'fixed-grid'`，且全程不触碰实例（可断言 `getInstance` 未被调用）。
- **升级回归**：EP 主/次升级后，若 `@error` 出现该码且 `cause.reason === 'no-native-entry'`，先跑
  `use-v2-row-height-reset.test.ts` 全文件（直挂 / `$subTree` 漫步 / `$el.__vnode` 回退三分支）；任一分支红灯即确认 EP 内部结构已漂移，
  按 `use-v2-row-height-reset.ts` 文件头"失效预案"更新探测路径（EP 若暴露官方重测 API 则删除三路探测改直调）；`fixed-grid` / `no-instance`
  出现时无需动作（均为正常分支，升级后出现频率变化才需关注）。
- **回滚**：本文档变更为纯文档追加，回滚即 revert 本节；零运行时变更。

## 7. 上游 EP 卸载泄漏（已知问题，11.1 surface 页每轮访问 +~150MB）

> 口径：Element Plus 2.14.7 自身在卸载时不断开 observer，本包侧已自证干净（见下“排除结论”），
> 故本节为纯文档记录 + 升级回归项；零运行时变更，回滚即 revert 本节。

- **成因（已定位到 EP 源码行）**：
  - ElTable：`es/components/table/src/table/style-helper.mjs` 的 `bindEvents()` 在 `onMounted` 内调用
    `useResizeObserver` ×2（`table.vnode.el` 与 `tableInnerWrapper`，`props.fit` 默认 true 时两者都建）+
    `initWatchDom` 的 MutationObserver ×1；`onMounted` 回调无 effect scope，
    `tryOnScopeDispose` 恒为 no-op，卸载不断开、不移除监听。每挂载一个 default 模式表泄漏 2 RO + 1 MO，
    Blink 持有未 disconnect 的 observer → 经其回调闭包 + `parentNode` 链扣住整棵子树（含本包 chrome 层）。
  - ElTableV2：卸载后整棵网格子树同样被扣（12 行表约 62 div），但无 RO/MO 数量增长——机制未定位，
    属 EP 内部状态（Grid 缓存/闭包），同样与本包无关（本包 virtual 路径 observer 计数恒为 +0/+0）。
- **复现与证据**（play dev + headless Chrome，`--js-flags=--expose-gc`，两次 GC 后计数）：
  1. 裸 EP 对照（与本包无关的 `createApp` 直挂）：ElTable 挂载静置再卸载 ×5 → RO +10、MO +5、游离 div +210；
     ElTableV2 ×5 → RO/MO +0、游离 div +310。
  2. 本包对照（同数据同列）：default 表 ×5 → RO +10、MO +5（与裸 EP **完全一致**，本包 4 处
     `useElementSize` 零新增）；virtual 表 ×5 → RO/MO +0。
  3. 11.1 surface 页（101 表）一切换：RO +166、MO +83、堆 +~150MB；切走后 DOM 节点数归零，
     堆经 GC 仍线性增长（3 轮：237 → 389 → 540MB）。生产构建（`vite build` + preview）复现一致，
    排除 devtools/HMR 因素。
- **排除结论（本包侧干净）**：4 处 `useElementSize`（interaction-orchestrator ×1、use-table-renderer ×2、
  TableRenderer.vue ×1、TableVirtualRenderer.vue ×1）全部位于 setup 顶层作用域；`v-grid-a11y` 指令
  `beforeUnmount` 断开 + 删键（WeakMap）；header/scroll 两看门狗、teleport 矩形、hover 层、拖拽暂态监听、
  rAF/Timer 均有卸载清理（见各模块 `onBeforeUnmount`/`onDeactivated`）。全局监听（window blur/resize、
  document visibilitychange）在 101 表卸载后 104→2、203→4，已归零。
- **升级回归**：每次 EP 主/次升级后跑一遍上面的裸 EP 对照（挂载静置 400ms 再卸载 ×5，GC 后计数）；
  RO/MO/游离数归零即确认上游已修，本节删除。补丁版本若 EP 触及 `style-helper.mjs` 同样复查。
- **上报**：向 element-plus 上游提 issue（`bindEvents` 的 observer/listener 缺卸载清理 + ElTableV2 网格子树
  卸载残留），附本节复现步骤。本包侧不做 hack（EP 未暴露 observer 句柄，任何外部 disconnect 都依赖
  其内部结构，违反“DOM 适配器唯一出口”原则）。
