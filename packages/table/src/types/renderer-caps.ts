/**
 * <zh/> 渲染器能力表——用“能力查询”替代散落的 `if (isVirtual)` 模式判断。
 * <en/> Renderer capability table — capability queries replacing scattered `if (isVirtual)` mode checks.
 *
 * @remarks
 * <zh/> 背景：`isVirtual` 布尔二分法在 60+ 处以不同语义分叉（行号域、DOM 选择器、
 * <zh/> smooth 滚动、声明式列、合并×动态行高等），新增第三种渲染模式需逐处修改。
 * <zh/> 目标：hook 只问能力（`caps.smoothScroll`），不问模式；新增模式 = 新增一套 caps 实现。
 * <zh/> 迁移策略：新代码用 caps；既有 `isVirtual` 分支逐个迁移，不得新增。
 * <en/> Background: the `isVirtual` boolean bifurcates in 60+ places with different semantics
 * <en/> (row-index domain, DOM selectors, smooth scroll, declarative columns, span×dynamic height…);
 * <en/> a third renderer would require touching every branch. Goal: hooks ask for capabilities
 * <en/> (`caps.smoothScroll`), never for the mode; a new mode ships one caps implementation.
 * <en/> Migration: new code uses caps; existing `isVirtual` branches migrate one by one, no new ones.
 *
 * 能力→支持模式→降级行为公开矩阵（公开承诺）| 用户侧版本见 `docs/guide/table/dual-engine-architecture.md` §4
 * Capability → mode support → fallback matrix (public commitment) | User-facing version: `docs/guide/table/dual-engine-architecture.md` §4
 *
 * | capability | default | virtual | 降级行为 / fallback |
 * |---|---|---|---|
 * | declarativeColumns | true（支持 `<el-table-column>` 声明式列） | false（忽略 default slot，见 TABLE_VIRTUAL_SLOT_IGNORED） | virtual 下声明式列静默忽略，须用 `columns` 配置 |
 * | spanWithDynamicHeight | true（合并×动态行高共存） | false（仅告警，见 TABLE_SPAN_DYNAMIC_HEIGHT_UNSUPPORTED；`spanDynamicMode:'rfc-overlay'` 为 opt-in 覆盖层） | virtual 下视觉不支持，默认 warn-only；rfc-overlay 时 origin 格走绝对定位覆盖层 |
 * | smoothScroll | true（`scrollTo` 支持 smooth/instant） | false（ElTableV2 scrollToRow 无 behavior 支持，按即时滚动） | virtual 下 behavior 参数被忽略 |
 * | rowIndexDomain | 'composed'（含 pin 交错） | 'unpinned'（网格 + 独立 pin 条带） | 跨 pin 调用方经 adapter `toRenderIndex/toRowKey`（rowKey 换算） |
 * | selectionScope | 'page'（当前页） | 'filtered'（全部筛选结果，跨页） | `toggleAllSelection`/表头全选语义随模式变化；`selectAllOnCurrentPage` 恒为当前页 |
 * | scrollFollow | false（目标恒已渲染，无需跟随） | true（目标可能未渲染，需跟随滚动） | virtual 下滚动 API 在目标未渲染时先滚动再定位 |
 * | columnDomain | 'cells'（事件域与 cells 域同构，恒等） | 'event'（事件域与 cells 域不同构，需翻译） | virtual 下单元格事件经列域翻译再定位 |
 *
 * <zh/> 单模式 prop 按模式收窄类型属 major 变更，当前仅 JSDoc 警示（见 `AdvTableProps.size/tableLayout/estimatedRowHeight`，
 * <zh/> 风格参照本文件泛型警示先例 `table-props.ts:30`），类型保持宽松以零破坏。
 * <en/> Narrowing single-mode prop types per mode is a major change; currently JSDoc warnings only
 * <en/> (see `AdvTableProps.size/tableLayout/estimatedRowHeight`, following the generic-warning precedent
 * <en/> at `table-props.ts:30`); types stay loose for zero breakage.
 */

export interface RendererCaps {
  /**
   * <zh/> 是否支持声明式列插槽（`<el-table-column>` default slot）| <en/> Whether declarative column slots are supported
   * <en/> default: true; virtual: false (see TABLE_VIRTUAL_SLOT_IGNORED)
   */
  declarativeColumns: boolean
  /**
   * <zh/> 合并单元格与动态行高是否可共存 | <en/> Whether cell-span coexists with dynamic row heights
   * <en/> default: true; virtual: false (see TABLE_SPAN_DYNAMIC_HEIGHT_UNSUPPORTED)
   */
  spanWithDynamicHeight: boolean
  /**
   * <zh/> scrollTo 是否支持 smooth/instant behavior（virtual 经 scrollIntoView 以外路径忽略） | <en/> Whether scrollTo honors smooth/instant behavior
   * <en/> default: true; virtual: false (ElTableV2 scrollToRow has no behavior support)
   */
  smoothScroll: boolean
  /**
   * <zh/> 行索引域——default 为 composed（含 pin 交错），virtual 为 unpinned（网格 + 独立 pin 条带）
   * <en/> Row-index domain — default is composed (pin-interleaved), virtual is unpinned (grid plus independent pin strips)
   */
  rowIndexDomain: 'composed' | 'unpinned'
  /**
   * <zh/> 选择作用域——virtual 跨页（全部筛选结果），default 当前页 | <en/> Selection scope — virtual is cross-page (all filtered), default is current page
   *
   * <zh/> 对照例：default 下表头全选仅选中当前页（`selectAllOnCurrentPage` 恒为当前页）；
   * <zh/> virtual 下表头全选选中全部筛选结果（跨页），只选当前页请显式调用 `selectAllOnCurrentPage`。
   * <zh/> 切模式后全选范围会变化，属 EP 原生差异的诚实暴露（非缺陷），行为统一任一方向均为破坏性变更，故维持双语义。
   * <en/> Contrast: in default mode header select-all selects the current page only
   * <en/> (`selectAllOnCurrentPage` is always the current page); in virtual mode it selects all
   * <en/> filtered rows (cross-page) — call `selectAllOnCurrentPage` explicitly for the current page.
   */
  selectionScope: 'filtered' | 'page'
  /**
   * <zh/> 滚动跟随——virtual 目标可能未渲染需跟随滚动，default 无需 | <en/> Scroll-follow — virtual targets may be unrendered and need follow, default does not
   */
  scrollFollow: boolean
  /**
   * <zh/> 列域——virtual 事件域与 cells 域不同构需翻译，default 同构恒等 | <en/> Column domain — virtual event domain differs from cells domain, default is isomorphic
   */
  columnDomain: 'cells' | 'event'
}

/** <zh/> default 模式能力表 | <en/> Capability table for default mode */
export const DEFAULT_RENDERER_CAPS: RendererCaps = {
  declarativeColumns: true,
  spanWithDynamicHeight: true,
  smoothScroll: true,
  rowIndexDomain: 'composed',
  selectionScope: 'page',
  scrollFollow: false,
  columnDomain: 'cells',
}

/** <zh/> virtual 模式能力表 | <en/> Capability table for virtual mode */
export const VIRTUAL_RENDERER_CAPS: RendererCaps = {
  declarativeColumns: false,
  spanWithDynamicHeight: false,
  smoothScroll: false,
  rowIndexDomain: 'unpinned',
  selectionScope: 'filtered',
  scrollFollow: true,
  columnDomain: 'event',
}

/**
 * <zh/> 渲染模式名联合——全库"存在哪些模式"的唯一声明。
 * <zh/> 新增模式时在此扩展，`RENDERER_CAPS` 与渲染器适配器的登记表将因穷尽性检查而编译报错，
 * <zh/> 从而无法遗漏任一处装配。
 * <en/> Renderer mode name union — the single declaration of which modes exist.
 * <en/> Extend here when adding a mode: `RENDERER_CAPS` and the renderer adapter's registry then fail
 * <en/> exhaustiveness checking at compile time, so no assembly point can be missed.
 */
export type RendererModeName = 'default' | 'virtual'

/**
 * <zh/> 按模式索引的能力表——适配器与消费方的单点查询入口。
 * <en/> Mode-indexed capability table — the single query entry for the adapter and consumers.
 */
export const RENDERER_CAPS: Record<RendererModeName, RendererCaps> = {
  default: DEFAULT_RENDERER_CAPS,
  virtual: VIRTUAL_RENDERER_CAPS,
}
