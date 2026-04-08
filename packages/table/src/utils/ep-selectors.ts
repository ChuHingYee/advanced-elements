/**
 * <zh/> Element Plus 内部 DOM 类名集中管理
 * <en/> Centrally managed Element Plus internal DOM class names
 *
 * @remarks
 * <zh/> 这些选择器用于运行时 DOM 查询（querySelector / closest），
 * 集中管理避免类名变更时散落多处修改
 * <en/> These selectors are used for runtime DOM queries (querySelector / closest),
 * centralized management avoids scattered modifications when class names change
 *
 * <zh/> 注意：CSS 文件中的类名选择器不在此处管理——CSS 与 JS 关注点不同，
 * 样式层直接使用类名更符合 CSS 工程惯例
 * <en/> Note: CSS class name selectors are not managed here — CSS and JS have different concerns,
 * using class names directly in the style layer is more in line with CSS engineering conventions
 *
 * <zh/> 已对 element-plus@2.14.0 验证（升级按 EP-UPGRADE-CHECKLIST.md 回归）
 * <en/> Verified against element-plus@2.14.0 (regress per EP-UPGRADE-CHECKLIST.md on upgrade)
 */

/** ElTable（default 模式）行元素类名 */
export const EP_TABLE_ROW_SELECTOR = '.el-table__row'

/** ElTableV2（virtual 模式）行元素类名 */
export const EP_TABLE_V2_ROW_SELECTOR = '.el-table-v2__row'

/** 两种渲染器行元素的联合选择器（用于 closest 查找） */
export const EP_ROW_SELECTOR = `${EP_TABLE_V2_ROW_SELECTOR}, ${EP_TABLE_ROW_SELECTOR}`

/** ElTableV2 表体滚动容器类名 */
export const EP_TABLE_V2_BODY_SELECTOR = '.el-table-v2__body'

/** ElTable 表体包装容器类名 */
export const EP_TABLE_BODY_WRAPPER_SELECTOR = '.el-table__body-wrapper'

/** <zh/> ElTable 表头包装容器类名（收敛：default 模式列拖拽容器查询共用） | <en/> ElTable header wrapper class (convergence: shared by default-mode column drag-container lookup) */
export const EP_TABLE_HEADER_WRAPPER_SELECTOR = '.el-table__header-wrapper'

/** ElTableV2 主区域容器类名 */
export const EP_TABLE_V2_MAIN_SELECTOR = '.el-table-v2__main'

/** ElTableV2 行单元格类名 */
export const EP_TABLE_V2_ROW_CELL_SELECTOR = '.el-table-v2__row-cell'

/**
 * <zh/> EP 树形/展开视觉类名（JS 侧收敛：column-renderer / v2-row-class 共用，
 * <zh/> EP 改名仅改此处；SCSS 层刻意保留字面量以保视觉一致，不在此管理）
 * <zh/> 注意：EP 当前行高亮类是**裸 `current-row`**（其 CSS 形如
 * <zh/> `tr.el-table__row--striped.current-row`），无 `el-table__` 前缀，故此处刻意不声明
 * <zh/> `el-table__row--current`（旧常量与 EP 实际不符且无消费方，已移除）。
 * <en/> EP tree/expand visual class names (JS-side convergence; SCSS keeps literals intentionally).
 * <en/> Note: EP's current-row class is the **bare `current-row`** (its CSS looks like
 * <en/> `tr.el-table__row--striped.current-row`) with no `el-table__` prefix, so
 * <en/> `el-table__row--current` is deliberately not declared here (the stale constant was
 * <en/> both wrong and unused, hence removed).
 *
 * <zh/> 静态常量仅保留作默认命名空间快照与守卫测试锚点（`__tests__/guards/ep-selectors.guard.test.ts`
 * <zh/> 断言其与构造器在 `'el'` 下一致）。**新代码一律使用下方命名空间构造器**，禁止引用静态常量——
 * <zh/> 静态常量在自定义 `uiConfig.namespace` 下恒为 `el-` 前缀，是命名空间失配的源头之一。
 * <en/> The static constants remain only as default-namespace snapshots and guard-test anchors
 * <en/> (`__tests__/guards/ep-selectors.guard.test.ts` asserts they equal the builders under `'el'`).
 * <en/> **New code must use the namespace builders below** and never reference the static constants —
 * <en/> the statics are forever `el-`-prefixed and are one source of namespace mismatch under a custom
 * <en/> `uiConfig.namespace`.
 */
export const EP_EXPAND_ICON_CLASS = 'el-table__expand-icon'
export const EP_EXPAND_ICON_EXPANDED_CLASS = 'el-table__expand-icon--expanded'
export const EP_INDENT_CLASS = 'el-table__indent'

/** <zh/> ElTable 展开图标类（无前导点，发类用） | <en/> ElTable expand-icon class (no leading dot, for class emission) */
export const epTableExpandIcon = (ns: string): string => `${ns}-table__expand-icon`
/** <zh/> ElTable 展开图标展开态类（无前导点，发类用） | <en/> ElTable expand-icon expanded class (no leading dot, for class emission) */
export const epTableExpandIconExpanded = (ns: string): string => `${ns}-table__expand-icon--expanded`
/** <zh/> ElTable 展开图标占位类（无前导点，发类用） | <en/> ElTable expand-icon placeholder class (no leading dot, for class emission) */
export const epTableExpandIconPlaceholder = (ns: string): string => `${ns}-table__expand-icon--placeholder`
/** <zh/> ElTable 树形缩进类（无前导点，发类用） | <en/> ElTable tree-indent class (no leading dot, for class emission) */
export const epTableIndent = (ns: string): string => `${ns}-table__indent`
/** <zh/> EP 图标根类（无前导点，发类用，替代硬编码 `el-icon`） | <en/> EP icon root class (no leading dot, for class emission; replaces hard-coded `el-icon`) */
export const epIcon = (ns: string): string => `${ns}-icon`

/**
 * <zh/> 点击目标分类选择器（命名空间无关）——`[class*=...]` 子串匹配，任意前缀命中。
 * <zh/> 仅用于“点击是否落在某类 EP 控件/弹层内”的布尔判定（失焦提交、菜单关闭、范围选择互斥），
 * <zh/> 不用于渲染定位。子串匹配比命名空间化构造器更鲁棒：未知前缀同样命中，且零串接成本
 * <zh/> （调用方多为拿不到 tableContext 的判定点，见 EP-UPGRADE-CHECKLIST §4）。
 * <zh/> 过匹配方向一律偏向“保守排除”（多判为控件内），误伤仅为跳过一次交互，不断言、不抛错。
 * <en/> Click-target classification selectors (namespace-agnostic) — `[class*=...]` substring
 * <en/> matching hits any prefix. For boolean "did the click land inside an EP control/popup" checks
 * <en/> only (blur commit, menu close, range-select exclusion), never for render lookups. Substring
 * <en/> matching is strictly more robust than namespace builders here: unknown prefixes still hit, with
 * <en/> zero plumbing (most call sites cannot reach tableContext, see EP-UPGRADE-CHECKLIST §4).
 * <en/> Over-matching always leans toward conservative exclusion (a skipped interaction, never an
 * <en/> assertion or a throw).
 */
/** <zh/> 任意 EP 弹出层（Teleport 到 body 的 popper 系 + 颜色面板） | <en/> Any EP popup (body-teleported poppers + color panel) */
export const EP_ANY_POPPER_SELECTOR = '[class*="-popper"], [class*="-color-picker__panel"]'
/** <zh/> 任意 EP 勾选类控件 | <en/> Any EP checkable control */
export const EP_ANY_CHECKABLE_SELECTOR = '[class*="-checkbox"], [class*="-radio"]'
/** <zh/> 任意 EP 开关控件（含本包 `adv-table__switch` 包裹层——内为 EP 开关，同属排除域） | <en/> Any EP switch (including this package's `adv-table__switch` wrapper — it wraps an EP switch, same exclusion domain) */
export const EP_ANY_SWITCH_SELECTOR = '[class*="-switch"]'
/** <zh/> 任意 EP 输入框清空按钮（含后缀图标关闭态） | <en/> Any EP input clear button (including suffix-icon close state) */
export const EP_ANY_INPUT_CLEAR_SELECTOR = '[class*="-input__clear"], [class*="-input__suffix-inner"] [class*="-circle-close"]'
/** <zh/> 任意 EP 数字步进按钮 | <en/> Any EP numeric stepper button */
export const EP_ANY_INPUT_STEPPER_SELECTOR = '[class*="-input-number__increase"], [class*="-input-number__decrease"]'

/**
 * <zh/> ElTableV2 表头行元素（收敛：use-virtual-renderer 列/行拖拽容器查询共用，
 * <zh/> EP 改名仅需改此处 + 回归拖拽单测）。
 * <en/> ElTableV2 header-row elements (convergence: shared by the
 * <en/> use-virtual-renderer column/row drag-container lookups; an EP rename only touches this file).
 */
export const EP_TABLE_V2_HEADER_ROW_SELECTOR = '.el-table-v2__header-row'

/** <zh/> ElTableV2 表头容器回退选择器 | <en/> ElTableV2 header container fallback selector */
export const EP_TABLE_V2_HEADER_SELECTOR = '.el-table-v2__header'
/** <zh/> ElTableV2 表头行元素（命名空间化） | <en/> ElTableV2 header-row element (namespace-aware) */
export const epTableV2HeaderRow = (ns: string): string => `.${ns}-table-v2__header-row`
/** <zh/> ElTableV2 表头容器（命名空间化） | <en/> ElTableV2 header container (namespace-aware) */
export const epTableV2Header = (ns: string): string => `.${ns}-table-v2__header`
/** <zh/> ElTableV2 表头单元格（命名空间化） | <en/> ElTableV2 header cell (namespace-aware) */
export const epTableV2HeaderCell = (ns: string): string => `.${ns}-table-v2__header-cell`

/** <zh/> ElTableV2 表头单元格类名（列拖拽手柄/列宽代理共用） | <en/> ElTableV2 header cell class (shared by column-drag handles / resize proxies) */
export const EP_TABLE_V2_HEADER_CELL_SELECTOR = '.el-table-v2__header-cell'

/**
 * <zh/> 命名空间化选择器构造器——EP 类名以命名空间前缀（默认 `el`）开头，
 * <zh/> 可由 `uiConfig.namespace` 覆盖。集中构造，避免各消费点内联手写模板串
 * <zh/> （DOM 适配层是唯一出口，见 `components/renderer-core/dom-adapter.ts`）。
 * <en/> Namespace-aware selector builders — EP class names are prefixed with the namespace
 * <en/> (default `el`), overridable via `uiConfig.namespace`. Centralized so no consumer
 * <en/> hand-writes the template strings (the DOM adapter is the only outlet, see
 * <en/> `components/renderer-core/dom-adapter.ts`).
 */
export const epTableBodyWrapper = (ns: string): string => `.${ns}-table__body-wrapper`
/** <zh/> ElTable 表头包装容器（命名空间化） | <en/> ElTable header wrapper (namespace-aware) */
export const epTableHeaderWrapper = (ns: string): string => `.${ns}-table__header-wrapper`
/** <zh/> ElTable 表头单元格（命名空间化，原生 th 上类名） | <en/> ElTable header cell (namespace-aware, class on native th) */
export const epTableHeaderCell = (ns: string): string => `.${ns}-table__cell`
/** <zh/> ElTable 行元素（命名空间化） | <en/> ElTable row element (namespace-aware) */
export const epTableRow = (ns: string): string => `.${ns}-table__row`
/** <zh/> ElTableV2 主区域容器（命名空间化） | <en/> ElTableV2 main container (namespace-aware) */
export const epTableV2Main = (ns: string): string => `.${ns}-table-v2__main`
/** <zh/> ElTableV2 表体容器（命名空间化） | <en/> ElTableV2 body container (namespace-aware) */
export const epTableV2Body = (ns: string): string => `.${ns}-table-v2__body`
/** <zh/> ElTableV2 行元素（命名空间化） | <en/> ElTableV2 row element (namespace-aware) */
export const epTableV2Row = (ns: string): string => `.${ns}-table-v2__row`
/** <zh/> ElTableV2 行单元格（命名空间化）——拖拽 ghost 回退样式同步用 | <en/> ElTableV2 row cell (namespace-aware) — used by drag-ghost fallback style sync */
export const epTableV2RowCell = (ns: string): string => `.${ns}-table-v2__row-cell`
/**
 * <zh/> ElScrollbar 内容包装元素（命名空间化）——滚动条规格三件套之一；
 * <zh/> 与行/表体选择器同口径构造，`uiConfig.namespace` 自定义命名空间下不得退回 `.el-` 字面量。
 * <en/> ElScrollbar content wrap (namespace-aware) — one of the scrollbar-spec trio; built from the
 * <en/> namespace like the row/body selectors, never falling back to an `.el-` literal under a
 * <en/> custom `uiConfig.namespace`.
 */
export const epScrollbarWrap = (ns: string): string => `.${ns}-scrollbar__wrap`
/** <zh/> ElScrollbar 自定义竖向滚动条轨道（命名空间化） | <en/> ElScrollbar custom vertical bar track (namespace-aware) */
export const epScrollbarVerticalBar = (ns: string): string => `.${ns}-scrollbar__bar.is-vertical`
/** <zh/> 虚拟列表竖向滚动条（virtual-list 产物，命名空间化） | <en/> Virtual-list vertical bar (virtual-list artifact, namespace-aware) */
export const epVlVertical = (ns: string): string => `.${ns}-vl__vertical`
