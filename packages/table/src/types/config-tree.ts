import type { ComputedRef, ShallowRef, VNode } from 'vue'
import type { ProcessedColumn } from './column'

/**
 * <zh/> 树形数据配置 — 将层级数据展平为带缩进信息的行数组
 * <zh/> 展平后的行通过 `__treeMeta` 属性携带层级、展开状态等元信息，
 * <zh/> 渲染器据此渲染缩进和展开/折叠图标。
 * <zh/> 数据管线执行顺序为「筛选 → 排序 → 树形展平」，
 * <zh/> 排序仅在同级节点间生效，不会破坏父子层级关系。
 * <zh/> 筛选作用于原始嵌套数据，若父节点被过滤则其子节点一并隐藏。
 * <en/> Tree data config — flattens hierarchical data into a row array with indentation info.
 * <en/> Flattened rows carry level and expanded-state metadata via the `__treeMeta` property,
 * <en/> based on which renderers draw indentation and expand/collapse icons.
 * <en/> The data pipeline runs in order "filter → sort → tree flatten";
 * <en/> sorting only applies between sibling nodes and never breaks parent-child relationships.
 * <en/> Filtering works on the original nested data: if a parent is filtered out, its children are hidden too.
 */
export interface TreeConfig {
  /** <zh/> 子节点字段名，默认 'children' | <en/> Children field name, defaults to 'children' */
  children?: string
  /** <zh/> 默认展开所有节点 | <en/> Expand all nodes by default */
  defaultExpandAll?: boolean
  /** <zh/> 默认展开的行 keys | <en/> Row keys expanded by default */
  defaultExpandedRowKeys?: (string | number)[]
  /** <zh/> 缩进宽度（px），默认 20 | <en/> Indent width (px), defaults to 20 */
  indent?: number
  /**
   * <zh/> 异步加载子节点 — 返回子节点数组
   * <zh/> 设置后，未加载过的节点显示 loading 图标。
   * <zh/> 选中级联按已加载子树计算：先选父后展开时，未来加载的子保持未选（需展开后级联）；
   * <zh/> 折叠中子孙的祖先冒泡已支持（按全量路径回退），但级联到未加载子孙需先展开加载。
   * <en/> Asynchronously load children — returns the children array.
   * <en/> When set, not-yet-loaded nodes show a loading icon.
   * <en/> Selection cascade resolves over loaded subtrees only: selecting a parent before expanding
   * <en/> leaves future children unselected (expand first, then cascade); ancestor bubbling for folded
   * <en/> descendants falls back to the full path, but cascading down to unloaded descendants requires loading.
   * @param row - <zh/> 父行数据 | <en/> parent row data
   * @param rowKey - <zh/> 父行键 | <en/> parent row key
   * @param options - <zh/> 加载选项 | <en/> load options
   * @param options.signal - <zh/> AbortSignal，组件卸载或 deactivated 时用于取消请求。| <en/> AbortSignal，component卸载或 deactivated 时用于cancel请求。
   *  实现方可选择监听此信号以中断网络请求，未监听时仍能通过返回值丢弃机制保证状态一致性。
   */
  loadData?: (row: any, rowKey: string | number, options?: { signal?: AbortSignal }) => Promise<any[]> // Note: 异步加载的父行与子行类型为业务类型，接口层不约束 | async-loaded parent/child row types are business types, not constrained at interface layer
  hasChildren?: string
  /**
   * <zh/> 父子节点选中是否独立，默认 false（联动） | <en/> 父子节点selectwhether独立，default false（联动）
   * <zh/> false: 选中父节点自动选中所有子孙，子节点全选时父节点自动选中 | <en/> false: select父节点自动selectall子孙，子节点select all时父节点自动select
   * <zh/> true: 父子节点选中状态互不影响 | <en/> true: 父子节点selectstate互不影响
   */
  checkStrictly?: boolean
}

/** <zh/> 行级树形元信息，附加到每行的 `__treeMeta` 属性 | <en/> Row-level tree metadata, attached to each row's `__treeMeta` property */
export interface TreeRowMeta {
  /** <zh/> 层级深度，0 = 根节点 | <en/> Depth level, 0 = root node */
  level: number
  /** <zh/> 是否有子节点（含异步未加载的叶子判断） | <en/> Whether it has children (including async not-yet-loaded leaves) */
  hasChildren: boolean
  /** <zh/> 是否展开 | <en/> Whether expanded */
  expanded: boolean
  /** <zh/> 父节点 key，根节点为 null | <en/> Parent node key, null for root nodes */
  parentKey: string | number | null
  /** <zh/> 缩进像素值 = level * indent | <en/> Indent in pixels = level * indent */
  indentPx: number
  /** <zh/> 异步子节点是否已加载 | <en/> Whether async children have been loaded */
  loaded?: boolean
  /** <zh/> 异步加载中 | <en/> Async loading in progress */
  loading?: boolean
}

/**
 * <zh/> 树形 API — 通过 provide/inject 传递给渲染器
 * <zh/> 渲染器仅消费此接口，不直接依赖 composable 内部状态
 * <en/> Tree API — passed to renderers via provide/inject.
 * <en/> Renderers only consume this interface and do not depend on composable internal state
 */
export interface TreeApi {
  /** <zh/> 获取指定行的树形元信息 | <en/> Get the tree metadata of the given row */
  getTreeMeta: (row: any) => TreeRowMeta | undefined // Note: 行数据类型由业务决定，接口层不约束 | row data type is decided by business, not constrained at interface layer
  /** <zh/> 切换行展开/折叠（异步懒加载时返回 Promise） | <en/> Toggle row expand/collapse (returns a Promise under async lazy loading) */
  toggleRowExpand: (rowKey: string | number) => void | Promise<void>
  /** <zh/> 展开指定行（异步懒加载时返回 Promise） | <en/> Expand the given row (returns a Promise under async lazy loading) */
  expandRow: (rowKey: string | number) => void | Promise<void>
  /** <zh/> 折叠指定行 | <en/> Collapse the given row */
  collapseRow: (rowKey: string | number) => void | Promise<void>
  /** <zh/> 展开所有行 | <en/> Expand all rows */
  expandAll: () => void
  /** <zh/> 折叠所有行 | <en/> Collapse all rows */
  collapseAll: () => void
  /** <zh/> 当前展开的行 keys | <en/> Currently expanded row keys */
  expandedRowKeys: ShallowRef<Set<string | number>>
  /** <zh/> 树形配置是否启用 | <en/> Whether tree config is enabled */
  treeEnabled: ComputedRef<boolean>
  /** <zh/> 缩进宽度 | <en/> Indent width */
  indent: ComputedRef<number>
  /** <zh/> 获取指定行的所有子孙节点 keys（递归，含嵌套 children） | <en/> Get all descendant keys of the given row (recursive, including nested children) */
  getDescendantKeys: (rowKey: string | number) => Set<string | number>
  /** <zh/> 获取指定行的所有祖先节点 keys（从父到根） | <en/> Get all ancestor keys of the given row (from parent up to root) */
  getAncestorKeys: (rowKey: string | number) => string[]
  /** <zh/> 父子节点选中是否独立 | <en/> Whether parent-child selection is independent */
  checkStrictly: ComputedRef<boolean>
}

/**
 * <zh/> 分组聚合函数类型——与 utils/summary-defaults 的 AggFuncName 同口径（含 count/first/last）
 * <en/> Group aggregate type — same caliber as AggFuncName in utils/summary-defaults (incl. count/first/last)
 */
export type GroupAggregateType = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'first' | 'last'

/**
 * <zh/> 分组聚合函数——内置名或自定义归约 (values, rows) => 结果，与 summary 口径一致
 * <en/> Group aggregate function — built-in name or custom reducer (values, rows) => result, same caliber as summary
 */
export type GroupAggFuncLike = GroupAggregateType | ((values: unknown[], rows: any[]) => unknown)

/**
 * <zh/> 单个聚合声明——field 为数据字段名，agg 为聚合函数
 * <en/> One aggregate declaration — `field` is the data field name, `agg` the reduce function
 */
export interface GroupAggregateColumnSpec {
  field: string
  agg: GroupAggFuncLike
}

/**
 * <zh/> 聚合结果表：键为 `${field}:${agg}`（见 utils/group-aggregates 的 getGroupAggregateKey），
 * <zh/> 值为聚合结果；分组内无可数值时为 null（count 除外：行数，空组不落键）。
 * <zh/> first/last/自定义可返回非数值，故值类型为 unknown。
 * <en/> Aggregate results keyed by `${field}:${agg}` (see getGroupAggregateKey in utils/group-aggregates);
 * <en/> value is the aggregate result; null when the group has no valid numbers
 * <en/> (except count: row count, no key for empty groups).
 * <en/> first/last/custom may return non-numbers, hence unknown values.
 */
export type GroupAggregates = Record<string, unknown>

/**
 * <zh/> 行分组配置 — 将数据按指定字段值分组，生成带分组头的行数组
 * <zh/> 分组头行作为特殊行插入数据数组，渲染器据此渲染跨全列的分组头。
 * <en/> Row group config — groups data by specified field values and produces a row array with group headers.
 * <en/> Group header rows are inserted as special rows into the data array; renderers draw full-width group headers from them.
 */
export interface RowGroupConfig {
  /** <zh/> 分组字段（支持多字段分组） | <en/> Grouping field(s) (multi-field grouping supported) */
  field: string | string[]
  /** <zh/> 分组头渲染函数，不传则显示字段值 | <en/> Group header renderer; falls back to the field value when absent */
  headerRenderer?: (params: { value: unknown, count: number, expanded: boolean, aggregates?: GroupAggregates }) => VNode | string
  /** <zh/> 默认展开所有分组 | <en/> Expand all groups by default */
  defaultExpandAll?: boolean
  /** <zh/> 默认展开的分组值 | <en/> Group values expanded by default */
  defaultExpandedGroupValues?: unknown[]
  /**
   * <zh/> 聚合列声明 — 对每组行集计算 sum/avg/min/max/count/first/last/自定义，结果挂到组头行 __groupAggregates，
   * <zh/> 并透传给 headerRenderer 与 #groupHeader 插槽的 aggregates 参数。
   * <zh/> 数值口径与汇总行一致（见 utils/summary-defaults runSummaryPass）：仅统计 typeof === 'number' 且非 NaN 的单元格；无可数值时为 null（count 返回行数）。
   * <en/> Aggregate column declarations — computes sum/avg/min/max/count/first/last/custom for each group's rows,
   * <en/> attaches results to the group header row's __groupAggregates, and passes them to
   * <en/> headerRenderer and the #groupHeader slot's aggregates param.
   * <en/> Same numeric criteria as summary rows (see runSummaryPass in utils/summary-defaults): only cells with typeof === 'number' and not NaN count; null when no valid numbers (count returns the row count).
   */
  aggregateColumns?: GroupAggregateColumnSpec[]
}

/** <zh/> 分组头行标记 — 插入到数据数组中的特殊行 | <en/> Group header row marker — a special row inserted into the data array */
export interface GroupHeaderRow<T = any> {
  /** <zh/> 分组头行标识，始终为 true | <en/> Group header row flag, always true */
  __isGroupHeader: true
  /** <zh/> 分组字段值 | <en/> Group field value */
  __groupValue: unknown
  /** <zh/> 分组内数据行数 | <en/> Number of data rows in the group */
  __groupCount: number
  /** <zh/> 分组是否展开 | <en/> Whether the group is expanded */
  __groupExpanded: boolean
  /** <zh/> 分组内的原始数据行 | <en/> Original data rows within the group */
  __groupRows: T[]
  /** <zh/> 分组字段名 | <en/> Group field name */
  __groupField: string
  /** <zh/> 分组字段层级索引（多字段分组时用于唯一定位展开状态） | <en/> Group field level index (uniquely locates expanded state in multi-field grouping) */
  __groupFieldIndex: number
  /** <zh/> 聚合结果表（配置 aggregateColumns 时存在），键为 `${field}:${agg}` | <en/> Aggregate results map (present when aggregateColumns is configured), keyed by `${field}:${agg}` */
  __groupAggregates?: GroupAggregates
  /** <zh/> 允许动态属性（如 AUTO_KEY_NAME） | <en/> Allows dynamic properties (e.g. AUTO_KEY_NAME) */
  [key: string]: any // Note: 分组头行需附加不可预知的动态属性 | group header rows need unpredictable dynamic props attached
}

/**
 * <zh/> 行分组 API — 通过 provide/inject 传递给渲染器
 * <en/> Row group API — passed to renderers via provide/inject
 */
export interface RowGroupApi {
  /** <zh/> 分组是否启用 | <en/> Whether grouping is enabled */
  groupEnabled: ComputedRef<boolean>
  /** <zh/> 当前展开的分组值集合（内部为复合 key：fieldIndex__field__value） | <en/> Currently expanded group values (internally composite keys: fieldIndex__field__value) */
  expandedGroupValues: ShallowRef<Set<unknown>>
  /** <zh/> 切换分组展开/折叠（多字段分组时 fieldIndex 唯一定位层级，缺省为第一级） | <en/> Toggle group expand/collapse (fieldIndex uniquely locates the level in multi-field grouping, defaults to the first level) */
  toggleGroupExpand: (groupValue: unknown, fieldIndex?: number) => void
  /** <zh/> 展开所有分组 | <en/> Expand all groups */
  expandAllGroups: () => void
  /** <zh/> 折叠所有分组 | <en/> Collapse all groups */
  collapseAllGroups: () => void
  /** <zh/> 判断行是否为分组头行 | <en/> Whether the row is a group header row */
  isGroupHeaderRow: (row: unknown) => row is GroupHeaderRow
  /** <zh/> 分组字段 | <en/> Grouping fields */
  groupFields: ComputedRef<string[]>
}

/**
 * <zh/> 行 Pinning 配置——将指定行固定在顶部或底部
 *
 * <zh/> 适用场景：汇总行、总计行、关键数据行需要在滚动时始终可见。
 * <zh/> 实现方式：在数据管线末端（分页之后）将 pinned 行从数据数组中提取，
 * <zh/> 分别插入到可见数据的顶部和底部，渲染器据此渲染固定行。
 *
 * <en/> Row pinning config — pin specified rows to top or bottom
 *
 * <en/> Use cases: summary rows, total rows, key data rows that need to remain visible during scrolling.
 * <en/> Implementation: at the end of the data pipeline (after pagination), extract pinned rows
 * <en/> from the data array and insert them at the top/bottom of visible data.
 */
export interface RowPinConfig {
  /** <zh/> 固定在顶部的行 keys | <en/> Row keys pinned to the top */
  topRowKeys?: (string | number)[]
  /** <zh/> 固定在底部的行 keys | <en/> Row keys pinned to the bottom */
  bottomRowKeys?: (string | number)[]
  /**
   * <zh/> 固定行总数上限（顶部 + 底部），默认 50。固定行条带不参与虚拟化，
   * <zh/> 超出部分会被截断并移回滚动区，同时派发 TABLE_PIN_LIMIT_EXCEEDED 事件。
   * <en/> Cap on the total pinned-row count (top + bottom), default 50. Pinned strips bypass
   * <en/> virtualization; extras are truncated back to the scroll area with a
   * <en/> TABLE_PIN_LIMIT_EXCEEDED event.
   */
  maxPinnedRows?: number
}

/**
 * <zh/> renderData 域行索引——pin 启用时已剔除固定行，`validateRow` 与渲染器/编辑链的唯一合法域。
 * <zh/> 运行时即 number（零开销），类型层与裸 number / VisibleDataIndex 互斥，误传 visibleData 域索引在编译期可见。
 * <en/> RenderData-domain row index — pinned rows excluded when pinning is on; the only valid domain for `validateRow` and the renderer/editing chain.
 * <en/> A plain number at runtime (zero cost); mutually exclusive with bare numbers / VisibleDataIndex at the type level.
 */
export type RenderDataIndex = number & { readonly __advRenderDataIndex: unique symbol }

/**
 * <zh/> visibleData 域行索引——含固定行（顶部固定行在前）。禁止直传 `validateRow`，须经 `toRenderDataIndex` 换算。
 * <en/> VisibleData-domain row index — includes pinned rows (top pins first). Never pass to `validateRow` directly; convert via `toRenderDataIndex`.
 */
export type VisibleDataIndex = number & { readonly __advVisibleDataIndex: unique symbol }

/**
 * <zh/> 行 Pinning API — 通过 provide/inject 传递给渲染器
 * <en/> Row pinning API — provided to renderers via provide/inject
 */
export interface RowPinApi {
  /** <zh/> 行 pinning 是否启用 | <en/> Whether row pinning is enabled */
  pinEnabled: import('vue').ComputedRef<boolean>
  /** <zh/> 顶部固定行数据 | <en/> Top pinned row data */
  topPinnedRows: import('vue').ComputedRef<any[]>
  /** <zh/> 底部固定行数据 | <en/> Bottom pinned row data */
  bottomPinnedRows: import('vue').ComputedRef<any[]>
  /** <zh/> 固定行到顶部 | <en/> Pin row to top */
  pinRow: (rowKey: string | number, position: 'top' | 'bottom') => void
  /** <zh/> 取消固定行 | <en/> Unpin row */
  unpinRow: (rowKey: string | number) => void
  /** <zh/> 判断行是否被固定 | <en/> Check if a row is pinned */
  isRowPinned: (rowKey: string | number) => boolean
  /** <zh/> 清除所有固定行 | <en/> Clear all pinned rows */
  clearPinnedRows: () => void
}

/**
 * <zh/> 展开行配置 — 支持基础展开行和主/明细视图
 * <zh/> 基础展开行：展开后显示自定义内容（如描述文本）
 * <zh/> 主/明细视图：展开后显示嵌套子表格（支持独立排序/筛选/分页）
 * <zh/> 实现方式：在数据数组中插入 DetailRow 特殊行，渲染器识别后合并所有列渲染展开内容。
 * <en/> Expand-row config — supports basic expanded rows and master/detail views.
 * <en/> Basic expanded row: shows custom content (e.g. description text) after expansion.
 * <en/> Master/detail view: shows a nested sub-table (with independent sorting/filtering/pagination) after expansion.
 * <en/> Implementation: inserts DetailRow special rows into the data array; renderers merge all columns to render the expanded content.
 */
export interface RowExpandConfig {
  /** <zh/> 是否启用展开行功能 | <en/> Whether the expand-row feature is enabled */
  enabled?: boolean
  /** <zh/> 默认展开的行 keys | <en/> Row keys expanded by default */
  defaultExpandedRowKeys?: (string | number)[]
  /**
   * <zh/> 展开区高度改由 `expandRow` 插槽内容自身决定（default 模式由内容撑开，
   * <zh/> virtual 模式经 `getBoundingClientRect` 实测行高）——已移除无效的
   * <zh/> `expandRowHeight` 配置项（原值仅写入合成行字段、无人消费）。
   * <en/> Expanded-region height is determined by the `expandRow` slot content itself (default
   * <en/> content-sized; virtual measures via `getBoundingClientRect`) — the ineffective
   * <en/> `expandRowHeight` option was removed in (its value was only written, never read).
   */
  /** <zh/> 手风琴模式：同时只展开一行 | <en/> Accordion mode: only one row expanded at a time */
  accordion?: boolean
  /**
   * <zh/> 展开行异步加载回调 — 返回行数据后触发展开
   * <zh/> 首次展开时调用，后续展开使用缓存数据；返回 null/undefined 表示无数据
   * <en/> Async load callback for expanded rows — expansion is triggered once the row data is returned.
   * <en/> Called on first expansion; later expansions use cached data. Returning null/undefined means no data.
   */
  load?: (row: any, rowKey: string | number) => Promise<any> // Note: 主/明细展开行的父行与返回类型为业务类型 | master/detail expand row parent & return types are business types
  /** <zh/> 展开状态持久化配置 | <en/> Expanded-state persistence config */
  persistence?: {
    /** <zh/> 存储 key，建议使用表格唯一标识 | <en/> Storage key; a unique table identifier is recommended */
    key: string
    /** <zh/> 存储类型，默认 'localStorage' | <en/> Storage type, defaults to 'localStorage' */
    storage?: 'localStorage' | 'sessionStorage'
  }
}

/** <zh/> 展开行标记 — 插入到数据数组中的特殊行 | <en/> Expanded-row marker — a special row inserted into the data array */
export interface DetailRow<T = any> {
  /** <zh/> 展开行标识，始终为 true | <en/> Expanded-row flag, always true */
  __isDetailRow: true
  /** <zh/> 关联的原始数据行 | <en/> The associated original data row */
  __detailRowData: T
  /** <zh/> 关联行的 key | <en/> Key of the associated row */
  __detailRowKey: string | number
  /** <zh/> 允许动态属性（如 AUTO_KEY_NAME） | <en/> Allows dynamic properties (e.g. AUTO_KEY_NAME) */
  [key: string]: any // Note: 展开行需附加不可预知的动态属性 | expand rows need unpredictable dynamic props attached
}

/**
 * <zh/> 展开行 API — 通过 provide/inject 传递给渲染器
 * <en/> Expanded-row API — passed to renderers via provide/inject
 */
export interface RowExpandApi {
  /** <zh/> 展开行功能是否启用 | <en/> Whether the expand-row feature is enabled */
  expandEnabled: ComputedRef<boolean>
  /** <zh/> 当前展开的行 keys | <en/> Currently expanded row keys */
  expandedRowKeys: ShallowRef<Set<string | number>>
  /** <zh/> 切换行展开/折叠 | <en/> Toggle row expand/collapse */
  toggleRowExpand: (rowKey: string | number) => void
  /**
   * <zh/> 展开指定行（同步，不触发异步 load）——数据已就绪时用此入口；
   * <zh/> 需要懒加载时请用 toggleRowExpand（未加载行经此入口展开会显示空详情）。
   * <en/> Expand the given row (synchronous, never triggers async load) — use this when data is
   * <en/> ready; for lazy loading use toggleRowExpand (an unloaded row expanded here shows empty details).
   */
  expandDetailRow: (rowKey: string | number) => void
  /** <zh/> 折叠指定行 | <en/> Collapse the given row */
  collapseDetailRow: (rowKey: string | number) => void
  /** <zh/> 展开所有行 | <en/> Expand all rows */
  expandAllDetailRows: () => void
  /** <zh/> 折叠所有行 | <en/> Collapse all rows */
  collapseAllDetailRows: () => void
  /** <zh/> 是否手风琴模式 | <en/> Whether accordion mode is on */
  accordion: ComputedRef<boolean>
  /** <zh/> 判断行是否为展开行 | <en/> Whether the row is an expanded (detail) row */
  isDetailRow: (row: any) => row is DetailRow // Note: 行数据类型由业务决定，类型守卫不约束 | row data type is decided by business, type guard doesn't constrain
  /** <zh/> 正在异步加载的行 keys | <en/> Row keys currently being async-loaded */
  loadingRowKeys: ShallowRef<Set<string | number>>
  /**
   * <zh/> 查询行的逻辑索引（排除 DetailRow 后的索引），供 index/indexBorder valueType 使用
   * <zh/> 内部基于 WeakMap 实现，不再 mutate 用户传入的行对象
   *
   * <en/> Look up a row's logical index (index excluding DetailRows) for index/indexBorder valueType
   * <en/> Internally backed by a WeakMap; no longer mutates user-provided row objects
   * @param row - <zh/> 行数据对象 | <en/> row data object
   * @returns <zh/> 逻辑索引，未登记时返回 undefined | <en/> logical index, or undefined if not registered
   */
  getLogicalIndex?: (row: any) => number | undefined
}

/**
 * <zh/> RowViewModel 的 provide/inject 接口。
 *
 * <zh/> 预计算每行装饰态（isEditing/isDirty/isRangeSelected），
 * <zh/> 通过 provide 注入渲染器，插槽通过 rowKey 获取引用稳定的 cellState。
 * <zh/> 装饰态变化不再污染 ElTable render effect。
 *
 * <en/> RowViewModel provide/inject interface.
 *
 * <en/> Pre-compute each row's decoration state (isEditing/isDirty/isRangeSelected),
 * <en/> inject into renderer via provide, slots obtain reference-stable cellState via rowKey.
 * <en/> Decoration state changes no longer pollute ElTable render effect.
 */
export interface RowViewModelContext {
  /**
   * <zh/> 行视图模型数组——引用稳定，仅状态变化的行重建
   *
   * <zh/> 类型为 ComputedRef——直接暴露 computed 结果，避免 watch + shallowRef 桥接反模式
   * <en/> Typed as ComputedRef — exposes the computed directly, avoiding the watch + shallowRef bridge anti-pattern
   */
  rowViewModels: ComputedRef<import('../composables/view-model/use-row-view-model').RowViewModel[]>
  /** <zh/> 按行 key 查找 cellState 数组——O(1) 访问 | <en/> Look up the cellState array by row key — O(1) access */
  getCellsByRowKey: (rowKey: string) => readonly import('../composables/view-model/use-row-view-model').CellState[] | undefined
}

/**
 * <zh/> 表头分组动态编排配置
 * <zh/> 启用后提供侧边面板，允许用户运行时创建/删除/重命名分组列、
 * <zh/> 拖拽列跨层级移动，实现表头分组结构的动态调整。
 * <en/> Dynamic header group orchestration config.
 * <en/> When enabled, a side panel lets users create/delete/rename group columns and drag
 * <en/> columns across levels at runtime, adjusting the header group structure dynamically.
 */
export interface ColumnGroupConfig {
  /** <zh/> 是否启用表头编排面板 | <en/> Whether the header orchestration panel is enabled */
  enabled?: boolean
  /** <zh/> 面板位置，默认 'right' | <en/> Panel position, defaults to 'right' */
  sidePanelPosition?: 'left' | 'right'
  /** <zh/> 初始是否展开面板，默认 false | <en/> Whether the panel is open initially, defaults to false */
  sidePanelDefaultOpen?: boolean
  /** <zh/> 关闭时是否销毁内容，默认 true | <en/> Whether to destroy content on close, defaults to true */
  sidePanelDestroyOnClose?: boolean
  /** <zh/> 分组最大嵌套深度，默认 3 | <en/> Maximum group nesting depth, defaults to 3 */
  maxDepth?: number
  /** <zh/> 是否允许创建分组，默认 true | <en/> Whether creating groups is allowed, defaults to true */
  allowCreateGroup?: boolean
  /** <zh/> 是否允许重命名分组，默认 true | <en/> Whether renaming groups is allowed, defaults to true */
  allowRename?: boolean
  /** <zh/> 是否允许删除空分组，默认 true | <en/> Whether deleting empty groups is allowed, defaults to true */
  allowDeleteGroup?: boolean
  /**
   * <zh/> 锁定列的归属分组——列 key 数组，被锁定的列不允许拖出其当前父分组
   * <zh/> 用于保护业务关键列的分组归属
   * <en/> Lock columns' group membership — an array of column keys; locked columns cannot be dragged out of their current parent group.
   * <en/> Used to protect the group membership of business-critical columns.
   */
  lockGroupMembership?: string[]
}

/**
 * <zh/> 列组管理 API — 通过 provide/inject 提供给面板及树节点子组件 | <en/> column组管理 API — via provide/inject provide给panel及树节点子component
 */
export interface ColumnGroupApi {
  /**
   * <zh/> 当前编辑中的列树（**结构克隆**副本）——编排操作一律不可变更新，故编辑不会直接回写 `localColumns`。
   * <zh/> 注意：克隆仅隔离结构与 `children`，其余字段（含嵌套对象）仍与 `localColumns` 共享引用，
   * <zh/> 消费方不得就地修改嵌套字段（详见 use-column-group 中 cloneColumnTree 的共享边界说明）。
   * <en/> The column tree being edited (a **structural clone**) — every orchestration operation is an
   * <en/> immutable update, so edits never write back to `localColumns` directly. Note the clone only
   * <en/> isolates the structure and `children`; all other fields (nested objects included) remain shared
   * <en/> with `localColumns`, so consumers must not mutate nested fields in place (see the sharing-boundary
   * <en/> notes on cloneColumnTree in use-column-group).
   */
  configTree: ShallowRef<ProcessedColumn[]>
  /** <zh/> 是否存在未提交的变更 | <en/> Whether uncommitted changes exist */
  isDirty: ComputedRef<boolean>
  /** <zh/> 面板位置 | <en/> Panel position */
  panelPosition: ComputedRef<'left' | 'right'>
  /** <zh/> 配置项（已合并默认值） | <en/> Options (defaults merged in) */
  options: ComputedRef<Required<Omit<ColumnGroupConfig, 'lockGroupMembership'>> & { lockGroupMembership: Set<string> }>
  /** <zh/> 创建分组列并插入到指定父级下 | <en/> Create a group column and insert it under the given parent */
  createGroup: (parentKey: string | null, index: number, groupName?: string) => string
  /** <zh/> 删除空分组列 | <en/> Delete an empty group column */
  deleteGroup: (groupKey: string) => void
  /** <zh/> 重命名分组列 | <en/> Rename a group column */
  renameGroup: (groupKey: string, newName: string) => void
  /** <zh/> 拖拽后原子性更新指定父级的子列表 | <en/> Atomically update the given parent's children list after a drag */
  updateList: (parentKey: string | null, newChildren: ProcessedColumn[]) => void
  /** <zh/> 提交编辑结果到表格 localColumns | <en/> Commit the edited result to the table's localColumns */
  applyConfig: () => void
  /** <zh/> 放弃编辑并从 localColumns 重新初始化 | <en/> Discard edits and re-initialize from localColumns */
  resetConfig: () => void
}
