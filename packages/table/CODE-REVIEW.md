# AdvTable（packages/table）代码审查报告

> 审查基准：严格、可执行、基于证据；拒绝过度优化；全新版本无历史包袱
> 审查日期：2026-10-13 / 版本：`@advanced-elements/table@4.0.0` / 引擎：`ElTable` + `ElTableV2` 双引擎，默认 `virtual`

---

## 1. 审查范围与假设

### 1.1 已读文件（基于证据，非抽样臆测）

| 类别 | 范围 | 规模（实测） |
|---|---|---|
| 根 | `src/AdvTable.vue (812行)`、`src/index.ts (145行)` | 薄外壳 + 装配 |
| 类型 | `src/types/` 33 文件，核心 `column.ts (937行)`、`table-props.ts (548行)`、`table-emits.ts (54事件)`、`slots.ts`、`edit.ts (545行)`、`config-options.ts (511行)` | 公共 API 定义 |
| 列域 | `composables/columns/` 12 文件：`use-columns.ts (545行)`、`use-column-state.ts (837行)`、`use-column-setting.ts`、`use-column-resize*.ts`、`use-column-drag.ts`、`use-column-group.ts`、`use-column-collapse.ts`、`use-columns-orchestrator.ts (107行)`、`use-column-features.ts (174行)` | 真源 + 持久化 + 面板 |
| 数据域 | `composables/data/` 27 文件：`use-table-request.ts (977行)`、`use-request.ts (506行)`、`use-remote-refetch.ts (242行)`、`pagination-effects.ts`、`use-tree-data.ts (815行)`、`use-cell-span.ts (777行)`、`use-table-data-pipeline.ts (725行)`、`use-column-sort.ts (710行)`、`use-column-filter.ts (594行)` | transport + 分页 + 管线 |
| 渲染域 | `components/table-renderer/TableRenderer.vue (791行)`、`components/table-virtual-renderer/TableVirtualRenderer.vue (701行)` + 33 个 V2 支撑文件、`renderer-core/` 15 文件（`dom-adapter.ts`、`column-build-shared.ts`）、`components/cell/`、`cell-editors/` 11、`cell-renderers/` 12 | 双引擎 |
| 编排 | `composables/use-adv-table.ts (404行)`、`composables/core/` 21 文件（`use-column-domain.ts`、`use-adv-table-data-columns.ts` 等）、`composables/api/use-table-api.ts (687行)`、`composables/selection/`、`editing/`、`interaction/`、`features/`、`rendering/` | 组装链 |
| 工具/契约 | `utils/ep-selectors.ts`、`utils/renderer-props-factory.ts`、`utils/table-emitter.ts`、`utils/column-tree.ts`、`__type-guards__/` 5 文件（`api-contract.keys.ts 110键`、`event-naming-manifest.ts` 等）、`constants/index.ts` | 适配层 + 门禁 |
| 文档/门禁 | `ARCHITECTURE.md`、`README.md`、`EP-UPGRADE-CHECKLIST.md`、`NAMESPACE-CHECKLIST.md`、`scripts/check-*.mjs`、`__tests__/` 352 文件 | 能力声明 + CI 门 |
| 样式/国际化 | `style/` 24 文件（`table.scss 571行`、`virtual-table.scss`）、`locale/` 4 文件 | 全局 BEM，无 scoped |

总量：`src` 下 409 文件 / 约 86233 行（`.ts 333` + `.vue 41` + `.tsx 11` + `.scss 24`，均值约 210 行/文件）。

### 1.2 审查方法

1. 三路并行勘察（结构 / 缺陷耦合 / 复杂度冗余架构）+ 主报告人对 4 个热点文件复读验证（`AdvTable.vue:41-87`、`cell-edit-trigger.vue`、`use-v2-row-height-reset.ts:31-60`、`column-filter-form.vue:40-45`）。
2. 行号以 `Get-Content.Count` 实测为准；`ARCHITECTURE.md` 内声明行数已漂移（见 §3-R13），引用时以实测为准。
3. 先找正确性缺陷，再找架构/耦合，再找复杂度/冗余，最后可读性/风格。凡无法判断标注“需确认”。

### 1.3 假设与边界

- 假设 `README.md` 的能力声明即真实需求集合（虚拟滚动/树/编辑/筛选排序/选择/合并/拖拽/导入导出/右键菜单/持久化/多语言），不把 AG Grid 全功能当必须。
- 假设 `element-plus` 为 `catalog:` 跟随最新版，`vue ^3.5.28`（`prev` 复用结果对象依赖此版本）。
- 未运行大数据量压测、无生产 EP 升级回归数据，性能结论为静态推断，已标注“需确认”。

---

## 2. 总体结论

- **总体质量评分：7.5 / 10**
  - 加分：双引擎分支唯一收敛（`caps` + `renderer-props-factory` + `dom-adapter`）、白名单 `defineExpose` + 双向契约测试、四门 CI（EP props/selectors/事件命名/注释）、`computed + prev` 缓存模式全库统一、a11y（`role=grid` + roving tabindex）双端统一、352 测试文件含 parity 校准。
  - 扣分：3 个 700+ 行状态机单体（request 977 / column-state 837 / tree 815）、列宽双源、EP 内部探测、2 处真实表单/注入缺陷、20 个 inject 隐式契约、零 scoped（虽有对冲仍是债）。
- **主要风险：**
  1. EP 升级即可能失效的 V2 行高探测（有降级 + 告警，不静默错位，但三网格重测全残）。
  2. 列宽真源 `col.width` vs 覆盖层 `columnWidths` 双源导致的“幽灵列宽”（已有两处 devWarn 实证）。
  3. 筛选草稿丢 falsy + 类型切换不重置；编辑错误 `inject` 在 `computed` 内导致排序/筛选后错位。
- **是否建议重构：否（大重构），是（4 项最小修复 + 2 项合并候选顺手做）。**
  - 按 `1.md §10` 六问检验：薄转发层（orchestrator/features/projection）合并能降低导航成本，但不能降低总复杂度，且需触碰五跳 `setColumns` 链，风险大于收益，不值得单独立项。`ARCHITECTURE.md:11-13` 的“下次编辑顺手合”规则正确，应保留。
- **重构边界：** 不动公共 API（43 props / 54 emits / 12+动态 slots / 109 expose 键全部冻结）；不动双引擎不对称（列宽/分组头/合计行三处）；只修内部实现。
- **最优先修复的三件事：**
  1. `column-filter-form.vue:40-45` 草稿同步：`if (filterValue)` → `if (filterValue !== undefined)` + 增加 `watch(filterType)` 重置（R02）。
  2. `cell-edit-trigger.vue:101` `inject` 移到 setup 顶层（R01）。
  3. `use-columns.ts:324-325` 与 `TableRenderer.vue:289-291` 宽度下限统一走 `use-column-resize(-proxy)` 唯一出口，消灭 `Math.max` 绕行（R06，顺手消除幽灵列宽诱因之一）。

---

## 3. 问题清单

| 级别 | 维度 | 位置 | 问题 | 证据 | 影响 | 建议 | 是否重构 |
|---|---|---|---|---|---|---|---|
| P1 | 缺陷 | `src/components/cell-editors/cell-edit-trigger.vue:95-106` | `inject(advTableKey)` 写在 `computed` 回调内，setup 异步重算时 `currentInstance=null` 回退 `undefined`，只能走 `rowIndex` 匹配 | `const errorMessage = computed(() => { const rowKeyFn = inject(advTableKey, undefined)?.rowKeyMeta?.value?.keyFn`；同文件 `92-93` 顶层 `inject` 正确，对比即知 | 排序/筛选/分页后校验错误定位错位，错误气泡挂错行 | 移到 setup 顶层：`const tableCtx = inject(advTableKey, undefined)`，`computed` 内只读 `tableCtx?.rowKeyMeta?.value?.keyFn`。见 §6-F01 | 否，最小修复 |
| P1 | 缺陷 | `src/components/filter-panel/column-filter-form.vue:40-45,267-275` | 草稿同步丢 falsy：父清空为 `null/undefined` 时 `if(filterValue)` 丢弃，`draft` 残留旧值；`filterType` 切换不重置 `draft` 形状过期；另 `immediate:true` 挂载即求值一次 | `watch(() => modelValue.value, (filterValue) => { if (filterValue) draft.value = cloneDeep(filterValue) })`；`draft` 初始化仅一次，无 `watch(filterType)` | 清空筛选不清表单；`text→number` 列筛选形状非法，确认后写回脏值 | `if (filterValue !== undefined) draft.value = cloneDeep(filterValue ?? createDefaultFilterValue(props.filterType))` + `watch(() => props.filterType, () => draft.value = createDefaultFilterValue(...))`。见 §6-F02 | 否，最小修复 |
| P1 | 耦合 | `src/components/table-virtual-renderer/use-v2-row-height-reset.ts:126-160,206-208` | 直探 `$subTree/__vnode/exposed.resetAfterRowIndex/$forceUpdate`，依赖 EP 内部实现 | 文件头 `31-37` 自认“依赖EP内部实现，升级即可能失效”；`vnode.component?.exposed?.resetAfterRowIndex`、`host.$?.subTree`、`host.$el?.__vnode`、`$forceUpdate` | EP 改名即三网格重测全残（动态行高撑高后下方行 `top` 错位）。当前全 miss 返回 `false+devWarn+onUnavailable`，不静默错位 | 不消除探测（无官方 API 前必要），但补生产可观测：调用点传入 `onUnavailable` 转 `@error (TABLE_RENDER_ERROR)`；升级前必跑 `EP-UPGRADE-CHECKLIST.md`。见 §6-F03 | 否，适配层已收敛，不重构 |
| P1 | 架构 | 列宽双源 `col.width` vs `columnWidths` 覆盖层 | 真源与覆盖层分离，`apply/reset` 忘清即幽灵列宽；`onResetColumnWidths` 在 5 文件接力 | `use-column-resize.ts:140,175-178`；`use-column-state.ts:89,476-487,602-611`；`use-column-features.ts:60-65,137`；`use-column-domain.ts:80,148,167-172`；`TableVirtualRenderer.vue:512`（default 无此方法即空操作） | 持久化恢复/重置后列宽与显示不一致，需二次 reset 才恢复 | 统一 `getColumnWidth` 单读口 + `apply/reset` 必清覆盖层并断言；长期将覆盖层并入 `localColumns` 单真源（需确认虚拟 V2 宽度数学是否允许）。见 §7-T01 | 是（顺手合，不单独立项） |
| P2 | 缺陷 | `src/components/header/header.vue:45-52,86-88` + `src/AdvTable.vue:41-58,81-87` | 同名 `defineProps` + `defineModel` 双声明，手工双向（`:is-polling/:columns` + `@update:` 手工回写 `145-157`） | `defineProps<{columns,isPolling}>` 与 `defineModel('columns')/defineModel('isPolling')` 同名；`AdvTable.vue:599,595` 单向传值 + 手工回写；`locale/lang/zh-cn.ts:319,323` 自证“父推送 `:data/:columns` 会静默覆盖” | 能跑但易被后人误改单边；model 优先/未绑定回退 prop 双写源心智负担 | 二选一：要真双向就删 `defineProps` 同名键只留 `defineModel` + `v-model:`；要单向就删 `defineModel` 只留 props + 显式 emit。未改前在注释标明“手工双向，非真 v-model”。见 §6-F04 | 否 |
| P2 | 缺陷 | `src/components/search/search.vue:277-311` | `componentRefs` 泄漏：`watch` 清了 `formItemRefs/layout/disabled/hidden` 唯独不删 `componentRefs` | `bindComponentRef(key,el){if(el) componentRefs[key]=el}` 无 delete 分支 | 动态增删搜索字段时旧组件实例常驻，`getComponentRefs/resize` 拿到已卸载实例 | `watch` 清理分支加 `delete componentRefs[removedKey]`；卸载钩子 `onBeforeUnmount` 清空。见 §6-F05 | 否 |
| P2 | 缺陷 | `src/components/footer/footer.vue:63-64,73-79` vs `src/AdvTable.vue:816-817` | 自发 `update:currentPage (camel)`，上下游/EP 均为 `kebab (update:current-page)`，靠 Vue 归一化才通 | `emit('update:currentPage')` vs `@update:current-page`；与 `ElPagination` 口径不一致 | 消费者照 EP 文档写 kebab 能通、写 camel 也能通，纯迷惑；后人易“统一”改错一边 | 统一为 `kebab: update:current-page / update:page-size`，与 EP 一致。见 §6-F06 | 否 |
| P2 | 复杂度 | `use-table-request.ts 977行 (~810行单函数)`、`use-column-state.ts 837行 (~685行单函数)`、`use-tree-data.ts 815行`、`AdvTable.vue 812行`、`TableRenderer.vue 791行` 等 29 文件 >500 行 | 单函数职责过多：transport+分页+URL+脏行+键检查+manual/auto 双协议同体；持久化+校验+防抖+代际+KeepAlive 同体 | §4.1 实测表；`ARCHITECTURE.md` 行数声明已漂移（521→545、805→837、890→977） | 新人定位成本高；改一处需读全文件；测试锁死现状而非降低圈复杂度 | 不拆文件（风险>收益），只做函数内分区注释 + 纯函数外提（`normalize/merge/signature`）。见 §7-T02 | 暂不优化（顺手分区） |
| P2 | 耦合 | `src/types/injection-keys.ts:43-99` 20 个 Symbol + `use-renderer-integration.ts:230-254` 13 个 provide | 20 隐式契约，消费全 fail-open（缺 provide 静默降级），仅 `polling-btn.vue:75-77` 缺失抛错 | `advTableKey/Edit/FilterSort/Tree/RowGroup/RowExpand/RowPin/...`；`TableVirtualRenderer 7 inject` + `TableRenderer 6 inject` | 跨层改名/删键编译器不报错，运行时静默降级难定位 | 已部分对冲（`use-safe-inject` 统一 devWarn + `injection-contract.test.ts`）。补：每个 key 注释拥有域 + 默认降级语义。见 §6-F07 | 否 |
| P2 | 冗余 | 列标识口径未统一 + 宽度下限四写法 + 排序双 `stableReorderByKey` | `getColumnKey` 80+ 调用点，`key??prop` vs `property` vs `columnKey??prop` 三口径靠 `buildColumnByKeyMap` 三注册兜底；`clampMinWidth` vs 内联 vs `Math.max(DEFAULT_MIN...)` vs `resolveStretchLowerBound` | `use-columns.ts:291,357,373,461`；`column-tree.ts:64`；`use-column-resize.ts:522-523`；`TableRenderer.vue:289-291`；`column-build-shared.ts:74-83`（注释自证曾 `Math.max(x,undefined)→NaN` 分叉） | 改一处下限/键规则需改四处，易分叉 | 收敛到 `column-tree.ts` + `use-column-resize(-proxy)` 唯一出口；`TableRenderer` 绕行改为调出口。见 §6-F08 | 否 |
| P2 | 性能 | `use-column-filter.ts:428 deep+immediate+flush:sync` + 7 处 `flush:sync` + `normal-column.tsx:230 {...rest}` 每帧新对象 | 全库唯一 `deep:true` 全量遍历 + 同步阻塞渲染；`{...rest}` 递归透传削弱 `shouldUpdateComponent` 浅比对 | `use-column-filter.ts:385-428`（注释自辩有签名守卫）；`use-selection-core.ts:167`、`use-column-sort.ts:571,621`、`use-quick-filter.ts:188,243`；`adv-table-cell.tsx:106` 渲染闭包内解构正确但 `normal-column` 透传新对象 | 大列数/大数据量下同步链过长，筛选嵌套赋值卡顿；列渲染多余更新 | 保留 sync（原子性所需），但 `deep` 改为签名 computed（仿 `use-column-state.ts:643` `prev` 比较）；`rest` 透传改为显式 prop 透传。需确认：大列数压测数据。见 §6-F09 | 否 |
| P2 | 可维护 | `TableRenderer.vue:827,833` vs `TableVirtualRenderer.vue:192-199,700-709` 插槽不对称 + 转发 4 跳 | `#append` 仅 default 有，virtual 合成末行 `dataWithAppend`；`AdvTable 154→368-428→factory 157→computedSlots/hasAppendSlot→v2-header 309` | `TableVirtualRenderer.vue:192-199` 注释引 `ARCHITECTURE §4` 为刻意；`header.vue:64,92-98` 父透传致子 `useSlots` 不可用改用 prop | 文档不写清则消费者误报 bug | 已在代码注释，补到 `README` “双模式差异”表。见 §6-F10 | 否 |
| P2 | 可读 | 三处索引 key + 7 个传统 SFC + 零 scoped + 魔法常量散落 | `rate-cell.vue:71 :key=i`、`row-action-bar.vue:427 :key=label-i`、`context-menu.vue:273,278,304 group-gi` 可重排列表不稳定；`cell-edit-trigger/header/footer/filter-panel` 等选项式与 setup 混存；全库无 `<style>` | 实测 grep；`table.scss:571` 全局唯一；`LAYOUT_CLASS_PREFIX` 透传 | 重排/过滤后复用错 DOM；样式污染靠契约测试对冲，仍需知悉 | 索引 key 改为 `getColumnKey/action.value/group.id` 稳定键；传统 SFC 仅在触碰时顺手迁 setup；样式保持现状。见 §6 | 否 |
| P3 | 风格 | `polling-btn/header/column-setting` 手工双向、`searchParams` 经 reactive 解包可写、`floating-filter-cell` 默认 modelValue 正确 | 风格不一致但均正确 | `polling-btn.vue:35`、`column-setting.vue:31`、`AdvTable.vue:567`、`search.vue:126,315-322` | 无功能影响，阅读成本 | 统一用 `v-model:` 语法糖，注释标明。 | 否 |
| P3 | 风格 | `ARCHITECTURE.md` 行数漂移、`use-columns-orchestrator (107行无独立state)` + `use-column-features (174行纯组合)` 薄转发 | 导航税，文档承认 | `ARCHITECTURE §1:21,24,39-40` | 新人多跳 2-3 步 | 更新行数 + 保留“下次编辑顺手合”规则，不单独立项。 | 暂不优化 |

> 无 P0（阻断/数据错误/内存泄漏/安全严重缺陷未发现；定时器/监听器/Observer 均有清理：`polling-btn.vue:126-135`、`row-action-bar.vue:176-188`、`drag-container-resolver.ts:65-75`）。

每个 P1/P2 的最小复现思路见 §8 对应用例。

---

## 4. 各维度审查

### 4.1 代码复杂度 — P2，中等偏高但多为真实需求

- **超长文件实测 Top（`Get-Content.Count`）：** 977 `use-table-request.ts` / 937 `column.ts` / 837 `use-column-state.ts` / 815 `use-tree-data.ts` / 812 `AdvTable.vue` / 791 `TableRenderer.vue` / 777 `use-cell-span.ts` / 725 `use-table-data-pipeline.ts` / 717 `use-editing-orchestrator.ts` / 710 `use-column-sort.ts` / 701 `TableVirtualRenderer.vue` / 687 `use-table-api.ts` / 633 `use-row-drag.ts`。29 文件 >500 行。
- **点名三文件：** `useColumns()` 单函数 ~483 行（快照+三级合并+归一+签名+合并+外部重排检测+watch 双分支）；`useColumnState()` ~685 行（校验+裁剪+防抖+`apply ~160行`+`restore ~84行`+四生命周期+KeepAlive once-watcher）；`useTableRequest()` ~810 行（transport+分页+URL+`cleanedAndMeta ~130行 O(n)`+manual/auto 双路+三加载入口）。`deepCloneColumnTree:232` 每次 `setColumns:422` 深拷，成本随 `fieldProps/cellEditorParams` 放大（文件自述）。
- **判定：** 复杂度来自 EP 双引擎 + KeepAlive + manual/auto 双协议 + 持久化代际等真实约束，非为优雅而抽象。`ARCHITECTURE.md` 已自首导航税并给出“有 state+lifecycle 才抽 composable”规则，正确。按 §10 第2/6问检验，强拆只转移复杂度且单场景居多 → **暂不优化**，只做函数内分区 + 纯函数外提（见 §7-T02）。

### 4.2 代码耦合度 — P1 一处，P2 若干，均已收敛大半

- **EP 私有耦合：** 最高 `use-v2-row-height-reset.ts`（`exposed.resetAfterRowIndex/$subTree/$el.__vnode/$forceUpdate`）。好在 miss 即 `false+devWarn+onUnavailable`，不静默错位；`ep-selectors.ts:21-42` 为唯一类名出口（`56-63` 禁静态常量、`134-160` namespace 构造器、`ANY_CHECKABLE` 子串抗前缀），`dom-adapter.ts:44-122 + default/virtual-dom-adapter` 为唯一 DOM 出口，`check:ep-selectors/check:ep-props` 守门。`TableRenderer.vue:518,538,584,619` 与 V2 侧 `$el+querySelector` 均经适配器，已收敛。样式侧 `virtual-table.scss:47 / table.scss:415-420 / hover-option.scss:10-11` 后代选择器 + `drag-ghost.ts:61,140` + `drag-container-resolver.ts:88 getElementById` 为剩余耦合面，靠 `table-id-registry` 唯一性保障。
- **业务侵入：** 未发现列定义/渲染器/编辑器与具体业务字段硬编码；`interceptor/sort/filter/valueType` 均为注册表 + provide 覆盖，无业务 if。
- **隐式耦合：** 22 Symbol 中 `advTableKey` 上帝上下文已删（R2 注释为证），剩余 20 按域注入是 EP 双渲染器 + KeepAlive 所需，但 20 即 20 隐式契约，`injection-contract.test.ts` 是唯一文档（见 R09）。
- **适配层：** `dom-adapter + ep-selectors + column-build-shared + renderer-caps + renderer-props-factory` 即适配层本身，设计正确。宽度双源是唯一适配层内债（见 R04）。

### 4.3 代码冗余 — P2，重复多但多有诱因，仅两处可动手

- **列标识三口径：** 80+ 处 `getColumnKey`，靠 `use-column-domain.ts:94-125` 三注册兜底，`175-208` 长注释承认 dual-domain 是 EP `property` 不可达所致 → 真实约束，不删，只统一调用口径。
- **宽度下限四写法 + 双源：** 唯一可动手债（R06/R04）。
- **插槽 4 跳 / 事件 5 `tableEmit` + 双包装：** `createTableEmitter` 已消除 30+ 手拼 `tableId`；渲染器内 `tableEventBindings + createRowEventHandlers + resolveColumn` vs `v2-emit-adapter + use-table-renderer-events` + `AdvTable 4 纯转发 + Virtual 2 同名转发` 是双引擎税，非可合并。
- **选择三层 / 排序筛选并立 / 分页扇出 / 请求三模块：** `selection-state→table-selection→orchestrator` 各加一圈（`rowKeyMeta/selectableFn/treeApi/caps/dom`）；`data-pipeline noop替身 + 懒升级 + 点火链` 分工干净；`pagination-effects dispose() 可被忽略` 是扇出所有权小口；manual 两侧各一套 abort/序号是协议所致。均不合并。
- **无意义包装：** 未发现大面积无意义 computed/watch/ref；`computed + prev` 复用模式全库统一且必要（虚拟表“仅引用变化 reset”）。

### 4.4 代码缺陷 — P1×2 + P2×3，无 P0

见 §3 R01/R02/R04/R05/R06/R07 及 §6 最小修复。已排除的非问题（有证据）：`render-helpers.ts:48-54 / create-search-fields.ts:62-94` 局部 `props` 非组件 props；`adv-table-cell.tsx:106 / normal-column.tsx:152` 渲染闭包内解构非 setup 顶层丢失响应式（但后者 `{...rest}` 有性能代价，R10）；`table-emitter.ts:31-37` 传 `computed` 本体故意且正确；定时器/监听器均有清理。

### 4.5 代码可阅读性 — P2，命名与结构好，缺口在键与样式心智

- **命名：** 准确一致可搜索（`use-*` 按域、`column-*`、`v2-*`、`TABLE_*` 错误码）；`buildColumnByKeyMap/stableReorderByKey/collectUserState` 动词清晰。
- **结构：** `composables/{columns,data,editing,selection,interaction,features,rendering,core,api}` 按域拆分 + `ARCHITECTURE.md` 地图，清晰。唯行数漂移需更新。
- **模板：** `AdvTable.vue:434-501` 徽标预计算，模板零方法调用，合格；`TableRenderer 856行` 模板含多分支但多为 EP 透传，接受。
- **类型注释：** 双语 `<zh/><en/>` JSDoc + `check:comment` 门，覆盖率高。`use-column-domain.ts:175-208`、`pagination 138-155`、`cleanedAndMeta 360-402` 长注释记录病因，优秀。
- **魔法值：** `constants/index.ts` 已收敛（`LARGE_DATASET_THRESHOLD=1000`、`PINNED_ROWS_DEFAULT_LIMIT=50`、`DEFAULT_SEARCH_DEBOUNCE=300`、`ASYNC_PANEL_DELAY_MS=200` 等），残留 EP 类名字面量已收敛到适配器。
- **公共 API 可预测：** 43 props + 54 emits（末参统一 `tableId`）+ 12 内置 slots（kebab）+ 动态 `#prop/#prop-header`，一致。唯 `footer update:camel` 与 EP 口径不一致（R07）。

### 4.6 代码可维护性 — P2，稳定且有门，但有三处债

- **稳定：** 全新版本无历史包袱；`api-contract.keys.ts 110键` 双向锁 `defineExpose`；事件命名 manifest 锁 `<subject>Change`；`EP-UPGRADE-CHECKLIST/NAMESPACE-CHECKLIST` 升级路径明确。
- **扩展：** `registerCellEditor/registerFilterType/registerValueType` 三注册表 + `InterceptorSlot<H>=H|H[]` 11 类型化事件槽，简单类型安全，不过度抽象。
- **测试文档类型：** 352 测试文件 + README 能力表 + ARCHITECTURE 地图 + 类型全导出，优秀。
- **债：** 列宽双源（R04）、20 inject 隐式契约文档单薄（R09）、零 scoped 靠契约测试对冲（新 EP 类需同步更新选择器，否则布局测试先红，接受但需知悉）。

### 4.7 代码架构 — 可接受的过度拆分，非微内核

- **分层：** 展示（双 Renderer）/ 逻辑（columns/data/editing/selection）/ 适配（dom-adapter/ep-selectors/caps/factory/column-build-shared）/ 状态（各域自持 + `reactive(orchestrator)` 12 域解构下发）清晰。`useAdvTable` 注释链 `Core→DataColumns→Selection→Interaction→SharedEditing→Features→RendererIntegration→Watchers→ApiAssembly→Lifecycle` 即装配顺序，props 在此拆窄切片 ISP 下发，正确。
- **状态归属：** 受控/非受控明确（`use-adv-table.ts:117-118 model优先、未绑定回退prop` + `use-table-config-guard.ts:164-174`），`shallowRef` 列突变必 `touchColumns [...换引用]`（`use-column-state.ts:630-641` 自述 computed 感知不到深突变），正确但需文档强调。
- **拆分：** `use-adv-table.ts 404行 7域组装 → core 9 件 → orchestrator 107行（无独立state）→ features 165行（纯组合）→ domain → data-columns` 五跳 `setColumns` 是文档承认的导航税。按“有 state+lifecycle 才抽”规则，`orchestrator/features/projection` 是合流候选但单独立项风险>收益 → **不重构**。
- **无插件/总线/全局 store：** `interceptor` 实为 11 类型化槽非插件内核；无 `mitt`（`table-emitter` 只是 per-instance emit 代理）；无 `pinia/vuex/fetch/axios`（src 禁令）；插件仅 `install=app.component`。全局可变仅 `table-id-registry liveTableIds（SSR跳过+计数防掩盖+onScopeDispose释放）` + `storage adapter（可注入替换）` + 三注册表（显式 `unregister/clear`），代价已知可接受。
- **泛型：** 全库仅 `<T=row>` 透传 + `OmitTableId` 去尾元组 + `Record<RendererModeName,…>` 穷尽分发，`core-generics.guard` 锁死，无黑魔法。

### 4.8 Vue 最佳实践 — 主链达标，缺口 3 处

| 项 | 结论 |
|---|---|
| `<script setup lang="ts" generic="T">` | 主链全 setup（`AdvTable/TableRenderer/TableVirtualRenderer tsx+setup/search/side-panel/cell-editors`）；`cell-edit-trigger/column-setting-list/side-panel/context-menu/filter-panel/header/footer` 7 个传统 SFC 混存，不一致但非缺陷，触碰时顺手迁 |
| `defineProps/Emits/Expose/Model` 类型完整 | 完整且有 `satisfies TableExpose/ItableRenderer` 锚定；唯同名双声明（R05）与 footer camel（R07）需统一 |
| 单向数据流 | 无直接改 props 实证；`zh-cn.ts:319,323` 双写源为设计如此，需文档警示 |
| `ref/reactive/shallowRef/markRaw` | 恰当：列 `shallowRef + touch换引用`、`draft shallowRef`、`prev` 缓存需 `vue^3.5`（`273` 注明） |
| computed 优先，watch 精确 | 规范；`prev` 内容比较防抖前置全库统一；唯 `deep+immediate+flush:sync` 一处（R10）可优化为签名 computed |
| 生命周期/异步清理 | 合格，四重清理（`use-table-request.ts:512-572`）、`dispose()` 唯分页扇出口可被忽略 |
| 稳定 key | 合格，`getColumnKey/getRowKey/gridInstanceKey` 主流；唯三处索引 key（R12） |
| 插槽转发完整类型安全 | 完整（12 内置 + 动态列/表头 + 别名），4 跳各有 mode 理由；`#append` 不对称刻意 |
| composables/provide 边界 | 按域注入正确，20 键规模大但收敛；缺失 devWarn 统一 |
| 内联对象/函数重渲染 | `rendererProps computed(factory)` + `computedSlots prev保引用` + `EMPTY_SLOTS` 已优化；唯 `normal-column {...rest}` 每帧新对象 |
| 虚拟滚动/`v-memo`/`shallowRef` | 虚拟默认 + `estimatedRowHeight` + 动态/固定网格 + `resetAfterRowIndex` 探测；`v-memo` 未用（EP 行复用已覆盖，不引入） |
| 样式 scoped | 零 scoped 刻意（EP 覆盖 + 双端共享），`adv-table__*` BEM + 契约测试对冲，接受 |
| a11y/键盘/ARIA | 双端统一到 `grid-a11y-attrs + vGridA11y`：`role=status/alert/grid + aria-rowcount/colcount + roving tabindex + focus({preventScroll}) + :focus-visible`；缺口仅 >500/1000 跳过分支无替代通告 |
| 测试 | 352 文件：guards + parity + 单测 + axe，超长文件均有单测但未降圈复杂度 |

### 4.9 对标 AG Grid 能力矩阵

> 标记：✅支持 / ⚠️部分 / ❌未支持；必须/可选/不需要/当前过度按“常用数据表格能力、非完整复刻”判定。

| 能力 | 当前 | 实现方式 | 真实需求 | 当前问题 | 建议 |
|---|---|---|---|---|---|
| 列：字段/标题/宽度/最小最大宽/固定/隐藏/排序/筛选/格式化/渲染器/编辑器/对齐 | ✅ | `column.ts 937行` + `defaultColDef→columnTypes→column` 三级合并 + `normalizeColumn` | 必须 | 宽度下限四写法（R06） | 统一出口，不加功能 |
| 多级表头/分组表头 | ✅（不对称） | default 递归 `children`，virtual 扁平 V2 叶列，`column-build-shared` 锁谓词 | 必须 | 无，parity 锁定 | 不动 |
| 列拖拽/宽调整/固定/显隐/设置面板/持久化/命名视图 | ✅ | `use-column-drag/resize/group/collapse/setting/state` + storage 适配器 + 代际 guards | 必须 | 双源幽灵列宽（R04） | 修双源，不加功能 |
| 行：客户端/服务端/分页/无限滚动/虚拟滚动/树/展开/主从/pin/拖拽 | ✅ | `mode virtual默认(ElTableV2)` + `use-table-request/tree-data/infinite-scroll/row-drag/row-expand/row-pin/row-group` | 必须（主从=展开明细已覆盖） | V2 行高探测耦合（R03） | 补可观测，不自研网格 |
| 单列/多列排序（含 Worker） | ✅ | `use-column-sort 710行` + worker plan | 必须 | `flush:sync` 链长 | 保留，不优化 |
| 筛选/快速过滤/外部过滤器/浮动筛选/侧边面板 | ✅ | `use-column-filter + filter-registry + floating-filter-cell + use-quick-filter + externalFilter(isPresent/doesPass)` | 必须 | 草稿丢 falsy（R02）、`deep` 全遍历（R10） | 修 R02/R10，不加功能 |
| 列宽调整/列固定/显隐 | ✅ | 同上 | 必须 | 同上 | 同上 |
| 行高（估计+动态重测） | ⚠️部分 | `estimatedRowHeight` + `use-v2-row-height-reset` 探测 | 必须 | EP 内部探测 | 补 `@error` 可观测 |
| 单元格编辑 + 批量 + undo-redo + 跨字段校验 | ✅ | `editing 23文件 + use-editing-orchestrator 717行 + use-cell-validate 607行 + cell-editors 11` | 必须 | `inject` 在 computed（R01） | 修 R01 |
| 剪贴板/范围选择（Excel 风格） | ✅ | `use-cell-range-selection 507行 + use-clipboard-handler 563行` + EP 选择器 | 可选（已支持则保留） | EP 选择器语义耦合 | 保留，不扩展 |
| 导出 CSV/Excel/打印/导入/拷贝 | ✅ | `export-csv/excel + import-helpers + xlsx可选` | 必须 | 无 | 不动 |
| 右键菜单/工具栏/搜索/分页器/合计行 | ✅ | `context-menu/search/footer/use-grand-total-core（双端拼接差异 parity 锁定）` | 必须 | `#append` 不对称（文档缺口） | 补 README，不改实现 |
| 行选择（单/多/跨页/`selectAllOnCurrentPage`/`reserve-selection`） | ✅ | `selection 11文件 三层` + `rowKeyMeta` | 必须 | 三层转发面大但各有圈 | 不合并 |
| 合并（行/列/区域） | ✅ | `use-cell-span 777行` | 可选 | 超长但真实 | 不动 |
| API/事件：获取/设置状态/刷新/滚动/选择/编辑/校验/生命周期 | ✅ | `use-table-api 687行 + 109 expose + 54 emits（末参tableId）+ applyTransaction/rollbackLast/before/afterDataChange` | 必须 | 暴露面大但白名单+契约锁 | 冻结，不增删 |
| 性能：大数据/虚拟/浅响应/稳定key/避免全量渲染 | ⚠️部分 | `LARGE_DATASET_THRESHOLD=1000` + `prev` 缓存 + 单趟 O(n) + `cleanedAndMeta` | 必须 | 索引 key 三处、`{...rest}` 新对象、`deep` 遍历 | 修 key/rest，不自研复用 |
| 渲染器/编辑器/筛选器扩展 | ✅ | 三注册表 + 类型化槽，无插件内核 | 必须 | 全局可变跨实例污染靠显式清理 | 文档强调清理，不改机制 |
| AG 全功能（`columnGroups` 复杂分组/企业级聚合透视/服务端行模型全量/图表集成） | ❌未支持 | — | 不需要 | — | **不实现**，把 AG 全功能当必须即过度设计 |
| 剪贴板企业级范围填充/右键企业菜单全量 | ❌/⚠️ | 基础已覆盖 | 可选 | — | 暂不优化 |

**边界结论：** 当前覆盖即 AG 常用能力子集，无为对标而堆的无用功能，无缺失的必须能力。不要新增 AG 企业功能。

### 4.10 过度优化风险 — 无微内核，按协议判两项“暂不优化”

任何重构已过 §10 六问：

1. 薄转发合并（`orchestrator/features/projection`）：解决导航痛但不降总复杂度 → **暂不优化**，顺手合。
2. 超长单体拆分：无性能数据/维护痛点支撑，且双引擎/KeepAlive/manual 约束下拆分即转移复杂度 → **暂不优化**，只分区注释 + 纯函数外提。
3. `interceptor plugins compose` 自称实为 11 类型化槽 → 非插件系统，不“修复”。
4. 泛型仅 `<T>` 透传 → 无黑魔法，不“简化”。
5. `v-memo`/自研虚拟/自研复用 → 无数据支撑，**不建议**。
6. 唯一通过检验的是 §7-T01（列宽单真源，解决真实幽灵列宽）与 §6 最小修复（解决真实缺陷），且均有可逆替代方案。

---

## 5. 架构建议

### 5.1 当前架构问题（按严重排序）

1. 列宽双源（P1）：真源与覆盖层分离 + 五文件接力清理，易忘。
2. EP 内部探测集中但仍是运行时硬耦合（P1）：无官方 API 前必要，需生产可观测。
3. 超长状态机 + 薄转发导航税（P2）：真实约束所致，文档已自首但行数漂移。
4. 20 inject 隐式契约文档单薄（P2）：fail-open 静默降级难定位。

### 5.2 建议目标架构（不动公共 API，不动双引擎不对称）

```text
AdvTable.vue (薄壳: props/emits/slots/models/expose + async panels)
  └─ useAdvTable (唯一装配点, ISP 切片下发)
       ├─ core/      配置守卫 + column-domain (键映射三注册) + data-columns
       ├─ columns/   真源 use-columns + 持久化 use-column-state + 特性 use-column-resize/drag/group/collapse/setting
       ├─ data/      transport use-request + 表面 use-table-request + 策略 use-remote-refetch + 管线 pipeline + sort/filter/tree/span
       ├─ selection/editing/interaction/features/rendering  按域自持 state+lifecycle
       ├─ renderer-props-factory (单装配点, 按 caps 分发)
       │    ├─ TableRenderer (ElTable, 宽托 EP table-layout)
       │    └─ TableVirtualRenderer (ElTableV2, 自算数值宽)
       └─ 适配层唯一出口: dom-adapter + ep-selectors + column-build-shared + renderer-caps
```

与现状一致 — **不需要目标重构**，只需补齐三处收敛（列宽单读口、选择器/键口径、文档行数）。

### 5.3 目录结构草案（现状即目标，仅两处顺手合）

```text
src/
  AdvTable.vue  index.ts
  composables/
    use-adv-table.ts  core/  columns/  data/  selection/  editing/
    interaction/  features/  rendering/  api/  view-model/  shared/
  components/
    table-renderer/  table-virtual-renderer/  renderer-core/
    cell-editors/  cell-renderers/  filter-panel/  column-setting/ ...
  utils/  types/  constants/  locale/  style/
  __type-guards__/  stories/
```

候选顺手合（下次编辑该文件时做，不单独立项）：`use-columns-orchestrator → use-columns`；`use-column-features → use-column-domain`；`use-adv-table-projection → use-adv-table`。合后 `setColumns` 由五跳变三跳。

### 5.4 组件拆分草案

- 保持双 Renderer + Header/Footer/Search + 5 异步面板（`delay 200 + KeepAlive` 缓存语义不可变）。
- 传统 SFC 7 个触碰时顺手迁 `<script setup>`，不批量迁。

### 5.5 composables 拆分草案

- 不新增 composable；只在超长单体内用分区注释 + 纯函数外提到 `utils/`（`normalizeColumn/mergeColumns/buildSignature/collectUserState`）。
- `use-table-request` 内 `cleanedAndMeta O(n)` 与 `requestOptions prev` 缓存保留（虚拟表热路径）。

### 5.6 适配层草案（现状即正确，补可观测）

```ts
// 唯一允许持有 EP 类名/内部入口的模块:
renderer-core/dom-adapter.ts + utils/ep-selectors.ts
components/table-virtual-renderer/use-v2-row-height-reset.ts // 唯一 (v2 as any) 探测点
utils/renderer-props-factory.ts // 单装配点 buildRendererProps(mode, domains)
renderer-core/column-build-shared.ts // 双端谓词单点
types/renderer-caps.ts + core/use-renderer-adapter.ts // 唯一 mode 分支, 模板禁 isVirtual (lint R3)
```

新增 `onUnavailable(reason) → @error(TABLE_RENDER_ERROR)` 生产通道（见 §6-F03）。

### 5.7 公共 API 草案（冻结现状，只统一口径）

- **props (43)：** `AdvTableBaseProps` 现状冻结；`mode` 判别联合（`virtual:estimatedRowHeight` vs `default:size/tableLayout`，错模式编译报错）保留。
- **emits (54)：** 末参统一 `tableId` 保留；`footer` 改 `update:current-page/update:page-size (kebab)` 与 EP 一致。
- **slots (12+动态)：** kebab 规范 + `expandRow/expand-row`、`groupHeader/group-header` 别名保留；动态 `#prop/#prop-header` 保留；`#append` 双模式差异写入 README。
- **expose (109)：** `apiContractKeys 110 + version/tableRootRef − 3内部` 冻结，`typecheck` 双向锁保留。

### 5.8 分阶段迁移方案

- **P0（本周）：** §6-F01/F02/F03（inject、草稿、行高可观测），零 API 变更，直接合入。
- **P1（下次迭代）：** §6-F04~F10（双声明注释/清理/`kebab`/宽度出口/`deep`→签名/文档），零 API 变更。
- **P2（顺手）：** §7-T01/T02（列宽单真源论证、纯函数外提、行数文档更新），触碰该文件时做。
- **不做：** 双引擎统一、超长文件强拆、插件化、自研虚拟、AG 企业功能。

---

## 6. 最小修复清单（按优先级，可直接改，不涉及大重构）

- **F01 `cell-edit-trigger.vue:92-106`（P1）：**
  ```ts
  // before (computed 内 inject):
  const errorMessage = computed(() => {
    const rowKeyFn = inject(advTableKey, undefined)?.rowKeyMeta?.value?.keyFn
  // after (顶层一次):
  const tableCtx = inject(advTableKey, undefined)
  const errorMessage = computed(() => {
    const rowKeyFn = tableCtx?.rowKeyMeta?.value?.keyFn
  ```
  验证：`mount + sort + validate` 用例断言错误行 key 不变。

- **F02 `column-filter-form.vue:40-45`（P1）：**
  ```ts
  watch(() => modelValue.value, (v) => {
    if (v !== undefined) draft.value = cloneDeep(v ?? createDefaultFilterValue(props.filterType))
  })
  watch(() => props.filterType, () => { draft.value = createDefaultFilterValue(props.filterType) })
  // 移除 active watcher 的 immediate:true, 改为 open 时显式初始化
  ```
  验证：清空→草稿空；`text→number` 切换→形状重置。

- **F03 `use-v2-row-height-reset.ts`（P1）：** 调用点传入 `onUnavailable: (reason) => emit('error', { code: 'TABLE_RENDER_ERROR', cause: reason })`；`EP-UPGRADE-CHECKLIST.md` 加复核项。验证：mock 全 miss → `@error` 上报而非仅 devWarn。

- **F04 双声明（P2）：** `header.vue` 与 `AdvTable.vue` 二选一（真双向删 props 同名键 / 单向删 model），未改前加注释“手工双向，非真 v-model，勿改单边”。验证：`update:columns/isPolling` 双向用例。

- **F05 `search.vue:277-311`（P2）：** 清理分支加 `delete componentRefs[key]` + `onBeforeUnmount` 清空。验证：动态删字段后 `getComponentRefs()` 无残留。

- **F06 `footer.vue:63-64`（P2）：** `update:currentPage → update:current-page`（含类型声明），与 EP 一致。验证：kebab/camel 双写监听均通。

- **F07 inject 文档（P2）：** 20 key 逐个补拥有域 + 降级语义注释；`polling-btn refresh` 缺失抛错保留。验证：`injection-contract.test.ts` 增补降级断言。

- **F08 宽度出口（P2）：** `TableRenderer.vue:289-291 Math.max` 改调 `getColumnWidth/clampMinWidth` 唯一出口；统一 `key??prop` 口径。验证：`minWidth/width undefined` 不再 `NaN`（`column-build-shared` 已有回归）。

- **F09 性能（P2）：** `use-column-filter.ts:428 deep` 改为签名 computed（仿 `use-column-state.ts:643 prev` 比较）；`normal-column.tsx:230 {...rest}` 改显式透传。验证：大列数筛选赋值火焰图同步时长下降（需确认：补压测数据）。

- **F10 文档（P2）：** README“双模式差异”表补 `#append`（default 插槽 vs virtual 合成末行）、列宽溢出、分组头策略三行；`ARCHITECTURE.md` 更新三文件实测行数。验证：文档评审。

- **F11 索引 key（P2）：** `rate-cell :key=i` → 行 key；`row-action-bar label-i` → `action.value ?? label`；`context-menu group-gi` → 稳定 id。验证：重排后 DOM 复用正确。

---

## 7. 建议重构清单（只列真实必要，每项含替代方案）

### T01 列宽单真源（P1，顺手做，不单独立项）

- **目标：** 消除 `col.width` vs `columnWidths` 双源幽灵列宽。
- **涉及：** `use-column-resize.ts:140`、`use-column-state.ts`、`use-column-features.ts`、`use-column-domain.ts`、`TableVirtualRenderer.vue:512`。
- **步骤：** ①统一 `getColumnWidth` 单读口 + `apply/reset` 必清覆盖层并 dev 断言；②论证虚拟 V2 数值宽能否并入 `localColumns`（需确认：V2 对齐数学）；③若允许则覆盖层并入真源，`onResetColumnWidths` 接力删除。
- **风险：** 中（触碰持久化 + 双端宽度数学，需 parity 全绿）。
- **收益：** 根除幽灵列宽 + 删除五文件接力。
- **不重构替代：** 只做①（F08），保留双源 + 断言，成本最小。

### T02 超长单体纯函数外提（P2，顺手做）

- **目标：** `use-columns (normalize/merge/signature/snapshot)`、`use-column-state (校验/代际)`、`use-table-request (cleanedAndMeta)` 纯函数移到 `utils/`，单函数降 100-150 行，不拆状态机。
- **涉及：** 上述三文件 + `utils/column-tree.ts`。
- **步骤：** 纯移 + 单测跟随，不改调用语义。
- **风险：** 低（纯函数，有单测锁）。
- **收益：** 阅读定位成本降，无行为变更。
- **不重构替代：** 只加分区注释，零风险。

> 其余候选（orchestrator/features 合并、传统 SFC 批量迁 setup、自研 `v-memo`/虚拟、AG 企业功能）按 §10 检验未通过 → **不建议重构**。

---

## 8. 测试建议

| 类别 | 用例（最小复现思路） |
|---|---|
| 单元 | `column-filter-form`：清空→草稿空；`filterType text→number`→形状重置；`cell-edit-trigger`：排序后错误行 key 不变；`column-width`：`minWidth/width undefined` 不 `NaN`；`footer`：kebab/camel 双写均通；`search`：删字段后 `componentRefs` 无残留 |
| 组件 | `AdvTable model优先`：未绑定回退 prop、父推送覆盖告警；`columns/data/loading/selectedRowKeys` 双写源一致性；`#append` 双模式差异快照；索引 key 重排复用 |
| 集成 | 列持久化 `apply/restore/reset` + KeepAlive `deactivate flush` + 代际过期 + 坏档清理；manual/auto 双路 abort + `requestId` 守卫 + 空页纠偏 `correctPage`；选择跨页 + `selectAllOnCurrentPage` + `reserve-selection`；编辑批量 + undo-redo + 跨字段校验错位回归 |
| E2E | 虚拟 10k 行滚动 + 动态行高异步撑高重测；树 5k 节点展开；导入导出 CSV/Excel 回环；URL 同步 + 分页回退 |
| 边界 | 空数据/异步后到/列全隐藏/固定列+分组头/列宽 0/`undefined`/超宽/坏 `localStorage JSON`/schema 升级/SSR（`table-id-registry` 跳过）/多实例同页 id 唯一 |
| 性能 | 大列数（200列）筛选嵌套赋值 `flush:sync` 火焰图；10k 行 `cleanedAndMeta O(n) + prev` 缓存命中率；`normal-column {...rest}` 优化前后重渲染计数。**需确认：当前无压测基线，先补 `benchmark-pipeline` 数据再判优化** |
| 契约 | `typecheck（expose 双向锁）` + `check:ep-props/ep-selectors` + `event-naming guard` + `injection-contract` + 双端 parity（渲染/选择/排序/合计）全绿为合入门槛 |

---

## 9. 需要补充的信息

1. **真实需求边界：** `selectAllOnCurrentPage` 默认值、服务端分页下跨页选择保留策略、剪贴板范围填充是否为必须 — 决定选择/剪贴板三层是否可裁。
2. **性能基线：** 大列数（≥100列）+ 大数据量（≥10k行）下的筛选/排序/虚拟滚动火焰图与 `benchmark-pipeline.mjs` 输出 — 决定 `deep+sync` 与 `cleanedAndMeta` 是否真需优化（当前为静态推断）。
3. **EP 版本策略：** 跟随最新还是锁定版本 — 决定 `use-v2-row-height-reset` 探测是长期债还是过渡方案，以及 `check:ep-*` 运行频率。
4. **V2 宽度数学：** 虚拟模式数值宽能否并入 `localColumns` 单真源而不破坏 header/body/summary 对齐 — 决定 T01 能否走到②。
5. **受控语义：** `columns/data/selectedRowKeys` 双写源下“父拒绝更新保持真正受控”的约定是否有消费者依赖 — 决定 F04 走真双向还是单向。
6. **a11y 口径：** >500/1000 跳过分支的替代通告要求 — 决定是否为缺口。
7. **文件：** `use-table-config-guard.ts:164-174` 全文、`use-adv-table.ts:111-127` 装配注释、`table-id-registry.ts` 多实例冲突日志（如有），用于确认双写源与 id 唯一性在生产的表现。

---

---

## 10. 二次审查结论（2026-10-13，与初版的差异）

二次审查逐项复核 §6-F01~F11 方案后，4 项修正、2 项驳回、1 项已实施确认：

| 原方案 | 二次审查结论 | 最终处置 |
|---|---|---|
| F01 `inject` 移顶层 | 属实，违反 Vue `inject` 须在 setup 同步链调用的规则 | ✅ 已实施（`cell-edit-trigger.vue`） |
| F02 草稿同步 `if (v !== undefined)` | 建议写法仍留 bug：`undefined` 时跳过即保留残留；`active watcher immediate:true` 在 `active=false` 时为空操作，无需动 | ✅ 修正后实施：无条件同步 + `filterType` watcher，`active` watcher 保持原状 |
| F03 行高 `onUnavailable` 装配 | **已实施**：`use-v2-grid-core.ts:181-183` 已经 `rendererError` 汇入 `error` 通道，初版不知悉 | ⏭️ 跳过，无需改动 |
| F04 双声明二选一 | 属实，但改声明即破坏性公共 API 变更，与 §5.7 冻结矛盾 | ✅ 降级：双语警示注释（`header.vue` + `AdvTable.vue`），行为不动 |
| F05 `componentRefs` 清理 | 属实；另发现模板 ref 卸载回传 `null` 被忽略是同根问题 | ✅ 已实施：`bindComponentRef` null 删除 + fields watcher 清理 + `onBeforeUnmount` 清空 |
| F06 footer 改 kebab | **驳回**：与 §5.7 API 冻结矛盾；`footer.test.ts:226` 已锁定 camel 断言；Vue 对 `update:` 做 camel↔kebab 归一化，双写法均可触发 | ✅ 降级：双语注释说明，不改名 |
| F07 inject 注释 | 安全，范围收敛为文件头约定块（20 键逐键补成本大于收益） | ✅ 已实施（`injection-keys.ts` 头注释） |
| F08 宽度出口 | 属实且为真 bug：`Math.max(全局默认, …)` 会把 `minWidth` 更大的列压到自身下限之下 | ✅ 已实施：`TableRenderer.vue` 改走 `clampMinWidth` + 列级 `minWidth` |
| F09 `deep`→签名 / `{...rest}` 显式透传 | **驳回/延期**：`deep` 移除需压测基线（§9-2 无数据）；`{...rest}` 指控不成立——JSX spread 展开为逐个 prop，子组件按 prop 独立比对，不存在对象身份导致的重渲染 | ⏭️ 均不实施，已记录 |
| F10 文档 | 安全 | ✅ 已实施：README `#append` 双模式小节 + ARCHITECTURE 行数（545/837/977/506/109/152） |
| F11 索引 key | **部分驳回**：`rate-cell :key=i`（静态星形列表，无重排）与 `context-menu group-gi`（静态菜单）指控不成立；`row-action-bar` 的 `ActionConfig` 无稳定 id 字段，去索引反而在 label 重复时碰撞 | ✅ 降级：`row-action-bar` 加选 key 说明注释，不改 key；另两处不动 |
| T01/T02 | 按“下次编辑顺手合”协议 | ⏭️ 本次不做 |

*审查人注：本报告每条 P1/P2 均有文件:行号证据；未臆造不存在的问题；凡需压测/生产数据支撑的均已标“需确认”。若上述最小修复落地且 parity/契约门全绿，结论“不需要大重构”成立。*
