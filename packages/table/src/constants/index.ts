/**
 * @file constants/index.ts
 * @description AdvTable 全局常量集中管理——消除散布在各文件中的魔法数字和重复定义。
 *
 * @architecture
 *   所有跨文件共享的常量应定义在此处，按领域分组。
 *   文件内私有常量（如组件内部使用的默认 prop 值）仍可保留在组件内。
 */

//  性能阈值 | Performance thresholds

/** <zh/> 大数据量性能警告阈值——超过此行数且未启用虚拟滚动时发出警告 | <en/> Large dataset performance warning threshold — warns when exceeding this row count without virtual scrolling */
export const LARGE_DATASET_THRESHOLD = 1000

/**
 * <zh/> 固定行默认上限——顶部 + 底部固定（pinned）行合计超过此值时，超出部分被截断并移回
 * <zh/> 滚动区，同时派发 TABLE_PIN_LIMIT_EXCEEDED 事件。可经 rowPinConfig.maxPinnedRows 覆盖。
 *
 * <zh/> 固定条带不参与虚拟化，每条固定行 × 每列都会立即调用 cellRenderer 闭包构建单元格；
 * <zh/> 数百条固定行（尤其列含闭包/编辑态时）会在一次渲染内全量构建，带来内存与首帧卡顿风险。
 * <zh/> 被截断行的渲染与事件转发（rowIndex=-1）语义不变，只是回到可滚动区参与虚拟化。
 *
 * <en/> Default pinned-row cap — when the combined top/bottom pinned-row count exceeds this value,
 * <en/> extras are truncated back to the scroll area with a TABLE_PIN_LIMIT_EXCEEDED event.
 * <en/> Overridable via rowPinConfig.maxPinnedRows.
 *
 * <en/> Pinned strips bypass virtualization: every pinned row × column invokes its cellRenderer
 * <en/> closure immediately, so hundreds of pinned rows build all cells in one render pass
 * <en/> (memory + first-frame cost). Truncated rows keep their rendering and event-forwarding
 * <en/> (rowIndex=-1) semantics inside the virtualized scroll area.
 */
export const PINNED_ROWS_DEFAULT_LIMIT = 50

/**
 * <zh/> 校验并发分批上限——单次 `Promise.all` 最多并发执行的校验任务数。
 *
 * <zh/> 全表校验（`useCellValidate.validateAll`）与批量提交校验（`useBatchCommit` 的 Phase B）
 * <zh/> 共用此值：粘贴/全表校验时若一次性并发，10k+ 个 async-validator 实例会同时进入
 * <zh/> 微任务队列，长时间阻塞主线程（表现为 UI 冻结）。
 *
 * <en/> Validation concurrency batch limit — max validation tasks running concurrently in one `Promise.all`.
 *
 * <en/> Shared by full-table validation (`useCellValidate.validateAll`) and batch-commit validation
 * <en/> (Phase B of `useBatchCommit`): without batching, 10k+ async-validator instances enter the
 * <en/> microtask queue at once and block the main thread for a long time (UI freeze).
 */
export const VALIDATE_BATCH_SIZE = 50

//  列宽默认值 | Column width defaults

/** <zh/> 选择列默认宽度（px） | <en/> Selection column default width (px) */
export const SELECTION_COLUMN_WIDTH = 50

/** <zh/> 列宽调整默认最小宽度（px） | <en/> Default minimum column width for resize (px) */
export const DEFAULT_MIN_COLUMN_WIDTH = 50

/**
 * <zh/> 列宽下限钳制（收敛）——非法/过小宽度统一钳制到下限；三处语义（非法值钳制/键盘调整下限/拖拽下限）均为"下限钳制"，调用点语义不变。
 * <en/> Column-width lower clamp (convergence) — clamps illegal/undersized widths to the floor; the three call sites (invalid-value clamp / keyboard floor / drag floor) share this lower-clamp semantic.
 */
export function clampMinWidth(width: number, min: number = DEFAULT_MIN_COLUMN_WIDTH): number {
  if (!Number.isFinite(width) || width < min)
    return min
  return width
}

//  搜索表单默认值 | Search form defaults

/** <zh/> 搜索表单默认防抖时间（ms） | <en/> Search form default debounce time (ms) */
export const DEFAULT_SEARCH_DEBOUNCE = 300

/**
 * <zh/> 异步面板占位延迟（ms）——`defineAsyncComponent` 的 `delay`，5 个低频面板（列设置/列分组/筛选/右键菜单/列筛选表单）共用；
 * <zh/> 弱网首开面板时 200ms 内完成加载则不闪占位，超时才显示 `PanelLoading`。改动点 5→1。
 * <en/> Async panel placeholder delay (ms) — shared `delay` for the 5 lazily-loaded panels; shows `PanelLoading` only when loading exceeds 200ms.
 */
export const ASYNC_PANEL_DELAY_MS = 200

//  拖拽默认值 | Drag defaults

/** <zh/> 拖拽排序动画时长（ms）——列设置 / 列分组的 VueDraggable 共用，保持拖拽手感一致 | <en/> Drag-sort animation duration (ms) — shared by VueDraggable in column setting / column grouping for consistent feel */
export const DRAG_ANIMATION_MS = 150

//  分页默认值 | Pagination defaults

/** <zh/> 默认分页大小选项 | <en/> Default page size options */
export const DEFAULT_PAGE_SIZES: number[] = [10, 20, 30]

/** <zh/> 默认每页行数 | <en/> Default page size */
export const DEFAULT_PAGE_SIZE = 10

/**
 * <zh/> 默认行高（px）——所有「行高缺省兜底」的唯一真源 | <en/> Default row height (px) — the single source for every row-height fallback
 *
 * @remarks
 * <zh/> 消费方（勿再写死 48）：`span-row-renderer` 的 `V2_DEFAULT_ROW_HEIGHT`、
 * <zh/> `virtual-dom-adapter` 的实测兜底、`use-row-drag`/`row-drag-utils` 的行高兜底、
 * <zh/> `use-default-grand` / `use-v2-grand-total` 的合计条带行高、virtual 渲染器 `rowHeight` prop 默认值。
 * <zh/>
 * <zh/> **刻意不覆盖的一处**：`use-table-config.ts` 的 `sizeConfig` 尺寸档位表（`large/default/small`
 * <zh/> 的 `rowHeight: 56/48/40` 与 `summaryRowHeight`）保持字面量。那是**尺寸档位刻度**而非
 * <zh/> 「默认行高兜底」——它与本常量数值相同纯属巧合（两者同为 EP 默认行高）。
 * <zh/> 若绑定，改本常量会连带改掉 small 档刻度，造成「只改默认值却让小尺寸档跳变」；
 * <zh/> 档位表另有 40/50/56 等刻度，本就无法由单一常量推导。
 * <en/> Consumers (stop hard-coding 48): `span-row-renderer`'s `V2_DEFAULT_ROW_HEIGHT`, the measured
 * <en/> fallback in `virtual-dom-adapter`, the row-height fallbacks in `use-row-drag`/`row-drag-utils`,
 * <en/> the total-strip row heights in `use-default-grand`/`use-v2-grand-total`, and the virtual
 * <en/> renderer's `rowHeight` prop default.
 * <en/>
 * <en/> **Deliberately NOT covered**: the `sizeConfig` scale in `use-table-config.ts` (`rowHeight:
 * <en/> 56/48/40` and `summaryRowHeight` across `large`/`default`/`small`) keeps its literals. That is a
 * <en/> **size scale**, not a "default row height fallback" — it merely coincides with this constant
 * <en/> (both are EP's default row height). Binding them would make a change here silently move the
 * <en/> small/large ticks, and the scale's other rungs (40/50/56) cannot be derived from one constant.
 */
export const DEFAULT_ROW_HEIGHT = 48

//  列标识常量 | Column identity constants

/** <zh/> 内部列 ID 属性名，用于列缺少 key/prop 时的兜底标识 | <en/> Internal column ID attribute name, fallback identity when a column lacks key/prop */
export const ADV_TABLE_INTERNAL_COLUMN_ID = '__advTableColumnId' as const

/**
 * <zh/> 选择列内置 key——`{ selection: true }` 列无需用户手动设置 key/prop，
 * <zh/> ensureColumnIds 会自动赋此值，也可供用户在 API 调用中引用选择列 |
 * <en/> Built-in key for selection columns — `{ selection: true }` columns don't require a manual key/prop,
 * <en/> ensureColumnIds assigns this automatically; users can also reference the selection column in API calls
 */
export const ADV_TABLE_SELECTION_COLUMN_KEY = '__advTableSelectionColumn' as const

/**
 * <zh/> 操作列内置 key——`{ valueType: 'option' }` 列无需用户手动设置 key/prop，
 * <zh/> ensureColumnIds 会自动赋此值，也可供用户在 API 调用中引用操作列 |
 * <en/> Built-in key for option/action columns — `{ valueType: 'option' }` columns don't require a manual key/prop,
 * <en/> ensureColumnIds assigns this automatically; users can also reference the option column in API calls
 */
export const ADV_TABLE_OPTION_COLUMN_KEY = '__advTableOptionColumn' as const

/** <zh/> 列 key 的 data 属性名，标记在 DOM 上供拖拽识别列身份 | <en/> Column key's data attribute name, marked on the DOM for drag column identity */
export const ADV_TABLE_COLUMN_KEY_ATTR = 'data-adv-table-column-key' as const

/** <zh/> 行 key 的 data 属性名，标记在 DOM 上供拖拽识别行身份 | <en/> Row key's data attribute name, marked on the DOM for drag row identity */
export const ADV_TABLE_ROW_KEY_ATTR = 'data-adv-table-row-key' as const
