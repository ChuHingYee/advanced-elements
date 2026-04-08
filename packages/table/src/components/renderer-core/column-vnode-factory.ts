/**
 * @file column-vnode-factory.ts
 * @description
 * <zh/> 列描述符 → VNode 工厂（双渲染器内核合一）。
 * <zh/> 职责：产出单元格/表头的**内容 VNode**——合成行分发、编辑态、树形前缀、装饰态、行内 hover
 * <zh/> 的完整装配管线。布局策略（ElTableColumn 插槽 vs ElTableV2 配置对象、宽度/flex 策略、
 * <zh/> 分组递归 vs 叶子扁平化）由各渲染器自持，本工厂不感知宿主形态。
 * <zh/> 渲染器由此退化为「布局插件」：仅负责把工厂产物装入各自宿主容器。
 *
 * <zh/> **响应式契约（性能关键，勿破坏）**：filterSortApi 的读取全部发生在返回的渲染闭包内，
 * <zh/> 由宿主（EP 表头渲染 effect）惰性追踪——排序/筛选切换只重渲染表头，
 * <zh/> 不触发列配置数组重建（否则每次排序都会全量重建列配置）。
 *
 * <en/> Column descriptor → VNode factory (dual-renderer kernel unification).
 * <en/> Responsibility: produce cell/header CONTENT VNodes — the full assembly pipeline of
 * <en/> synthetic-row dispatch, edit state, tree prefixes, decorations and inline hover.
 * <en/> Layout strategy (ElTableColumn slots vs ElTableV2 config objects, width/flex policies,
 * <en/> group recursion vs leaf flattening) stays with each renderer as a layout plugin.
 *
 * <en/> **Reactivity contract (perf-critical, do not break)**: filterSortApi reads happen inside
 * <en/> returned render closures only, lazily tracked by the host effect (EP header render)
 * <en/> sort/filter toggles re-render headers without rebuilding column config arrays
 * <en/> (a manual dep-read would rebuild the whole column config on every sort toggle).
 */
import type { VNode } from 'vue'
import type { ProcessedColumn as LocalColumn } from '../../types'
import type { EditConfig } from '../../types/edit'
import type { Translator } from '../../types/translator'
import { h } from 'vue'
import { resolveCellValue } from '../../utils/value-pipeline'
import {
  createCellSpan,
  finalizeCellNodes,
  renderEditingCell,
  resolveSyntheticRowKind,
} from '../shared/cell-render-pipeline'
import { buildSharedHeaderContent, renderRowExpandIcon } from '../shared/column-renderer'
import { buildCellContent } from './cell-render-content'

/** <zh/> 注入上下文——直接复用 injectRendererContext 返回形状（Partial 化支持测试/降级） | <en/> Injected apis — reuses injectRendererContext's return shape (Partial for tests/degradation) */
export interface ColumnFactoryInjectedApis extends Partial<ReturnType<typeof import('./render-helpers')['injectRendererContext']>> {}

/** <zh/> 宿主策略钩子——封装两渲染器间刻意保留的差异 | <en/> Host strategy hooks — encapsulate intentional per-renderer differences */
export interface ColumnFactoryStrategies {
  /** <zh/> 编辑配置 getter | <en/> Edit config getter */
  getEditConfig: () => EditConfig | undefined
  /** <zh/> 行内 hover 的 teleport 判定（两渲染器回退链不同） | <en/> Inline-hover teleport resolution (fallback chains differ per renderer) */
  resolveHoverTeleport: () => boolean
  /** <zh/> hover 操作列集合 | <en/> Hover action columns */
  resolveHoverColumns: () => LocalColumn[]
  /**
   * <zh/> 是否由工厂在尾部自动附加展开图标（非树形首普通列）。
   * <zh/> default 模式置 false——其编辑态也保留图标，故图标并入自身 resolveTreePrefix；
   * <zh/> virtual 模式置 true（默认）——图标仅出现在尾部装配，不进入编辑态输出。
   * <en/> Whether the factory appends the expand icon at the tail automatically (non-tree first
   * <en/> normal column). Default renderer sets false — its edit state also keeps the icon, so the
   * <en/> icon folds into its own resolveTreePrefix; virtual renderer leaves true (default) so the
   * <en/> icon appears only in tail assembly, never in edit-state output.
   */
  autoExpandIcon?: boolean
  /**
   * <zh/> 树形缩进前缀解析——仅在树目标列返回缩进前缀，否则空数组。
   * <zh/> 编辑态保留与尾部装配共用此单点。
   * <en/> Tree-indent prefix resolver — returns indent nodes only on the tree-target column,
   * <en/> empty otherwise. Shared by edit-preserve and tail assembly.
   */
  resolveTreePrefix: (params: { row: any, rowKeyStr: string, colIndex: number, isFirstNormalTarget: boolean }) => VNode[]
  /** <zh/> detail 展开行首列渲染（类名等宿主差异在此收口） | <en/> Detail-row first-column render (host class differences close here) */
  renderDetailFirstCol: (rowData: any) => VNode
  /** <zh/> 合成行非首列的空占位：default 返回 null，virtual 返回带类名的 span | <en/> Synthetic-row non-first-col placeholder: default returns null, virtual returns a classed span */
  renderSyntheticEmptyCol: (kind: 'detail' | 'group') => VNode | null
  /** <zh/> group 分组头行首列渲染 | <en/> Group-header-row first-column render */
  renderGroupFirstCol: (rowData: any) => VNode
  /**
   * <zh/> cellClassRules 结果解析——virtual 宿主在 createCellSpan 上附加规则结果类名；
   * <zh/> default 宿主经由 ElTableColumn className 函数机制实现，不使用此钩子。
   * <zh/> 接受工厂预解析的 cellData（`in` 判定提供与否），避免每格第二次 resolveCellValue。
   * <en/> cellClassRules resolver — the virtual host appends rule-result classes onto createCellSpan;
   * <en/> the default host implements it via ElTableColumn's className function instead.
   * <en/> accepts the factory-pre-resolved cellData (presence via `in`),
   * <en/> avoiding a second resolveCellValue per cell.
   */
  resolveCellClassRulesResult?: (params: { col: LocalColumn, row: any, rowIndex: number, colIndex: number, cellData?: unknown }) => string
  /** <zh/> append 合成行判定与占位（仅虚拟模式提供；default 无此路径） | <en/> Append-row detection & placeholder (virtual only; default has no such path) */
  appendRow?: {
    isAppendRow: (row: unknown) => boolean
    renderPlaceholder: (params: { rowIndex: number, spanColIndex: number }) => VNode
  }
}

export interface ColumnVNodeFactory {
  /**
   * <zh/> 表头内容工厂。wrap 为宿主外层包装：default 传拖拽标记包装，virtual 传带列键属性的 span。
   * <zh/> 内部对 filterSortApi 的调用惰性执行于 EP 表头渲染 effect 中（响应式契约见文件头）。
   * <en/> Header content factory. `wrap` is the host wrapper: default passes the drag-marker,
   * <en/> virtual passes a span carrying the column-key attribute. filterSortApi calls execute
   * <en/> lazily inside EP's header render effect (see reactivity contract above).
   */
  buildHeaderContent: (params: {
    col: LocalColumn
    key: string
    colIndex: number
    eventColumnIndex?: number
    columns: LocalColumn[]
    slots: Record<string, any>
    skipActions?: boolean
    floatingFilter?: boolean
    onHeaderClick?: (params: { column: LocalColumn, columnIndex: number, event: Event }) => void
    onHeaderContextmenu?: (params: { column: LocalColumn, columnIndex: number, event: Event }) => void
    wrap: (key: string, content: VNode, ariaSort?: string) => VNode
  }) => VNode

  /**
   * <zh/> 单元格全管线工厂——合成行分发 → 装饰态查找 → 编辑态(保留树前缀) → 内容构建 → 装饰 span → 输出装配。
   * <en/> Full cell pipeline — synthetic dispatch → decoration lookup → edit state (prefix preserved)
   * <en/> → content build → decorated span → output assembly.
   *
   * @param params - <zh/> 渲染参数 | <en/> render params
   * @param params.col - <zh/> 列配置 | <en/> column config
   * @param params.key - <zh/> 列 key | <en/> column key
   * @param params.colIndex - <zh/> 宿主过滤列表内的局部索引（DOM attr 与 buildCellContent 共用；v2=事件域全局值） | <en/> local index within the host-filtered list (shared by the DOM attr and buildCellContent; v2 = event-domain global value)
   * @param params.cellsColIndex - <zh/> RowViewModel cells 查找索引（selection-exclusive 混合域）。v2 的 colIndex 是事件域（[selection, nonFixed, fixed]），与 cells 数组域（混合序去 selection）相差固定列分区/selection 偏移——缺省回退 colIndex（default 两域同构） | <en/> RowViewModel cells lookup index (selection-exclusive mixed domain). v2's colIndex is the event domain ([selection, nonFixed, fixed]), offset from the cells domain (mixed order minus selection) by the fixed partition/selection — falls back to colIndex (identical domains in default mode)
   * @param params.spanColIndex - <zh/> data-adv-cell-col 坐标（default=局部；virtual=含 offset 的全局值） | <en/> data-adv-cell-col coordinate (default=local; virtual=global incl. offsets)
   * @param params.syntheticFirstColIndex - <zh/> 合成行首列判定索引（两渲染器均为 0；独立于树形谓词以精确保留各自语义） | <en/> synthetic first-col index (0 in both; kept separate from the tree predicate to preserve exact semantics)
   * @param params.firstNormalColIndex - <zh/> 首个普通列索引——透传给 buildCellContent 的树目标列判定；undefined 表示不参与 | <en/> first normal col index — forwarded to buildCellContent's tree-target predicate; undefined = not applicable
   * @param params.columns - <zh/> 完整列配置数组 | <en/> full column config array
   * @param params.row - <zh/> 行数据 | <en/> row data
   * @param params.rowIndex - <zh/> 行索引 | <en/> row index
   * @param params.showInlineHover - <zh/> 是否显示行内 hover 操作层 | <en/> whether to show inline hover action layer
   * @param params.slots - <zh/> 插槽集合 | <en/> slot collection
   * @param params.t - <zh/> 国际化翻译函数 | <en/> i18n translator
   * @param params.rowKeyFn - <zh/> 行键函数（append 合成行已在内部先行拦截） | <en/> row-key fn (append synthetic rows are intercepted internally before this point)
   */
  renderCell: (params: {
    col: LocalColumn
    key: string
    colIndex: number
    spanColIndex: number
    cellsColIndex?: number
    columns: LocalColumn[]
    row: Record<string, any>
    rowIndex: number
    showInlineHover: boolean
    syntheticFirstColIndex: number
    firstNormalColIndex?: number
    slots: Record<string, any>
    t: Translator | undefined
    rowKeyFn: (row: any) => string
  }) => VNode | VNode[]
}

/**
 * <zh/> 创建列 VNode 工厂实例（每个渲染器 setup 各一）
 * <en/> Create a column VNode factory instance (one per renderer setup)
 */
export function createColumnVNodeFactory(
  apis: ColumnFactoryInjectedApis,
  strategies: ColumnFactoryStrategies,
): ColumnVNodeFactory {
  const { rowExpandApi, rowGroupApi, treeApi } = apis

  function buildHeaderContent(params: Parameters<ColumnVNodeFactory['buildHeaderContent']>[0]): VNode {
    const sharedContent = buildSharedHeaderContent({
      col: params.col,
      colIndex: params.colIndex,
      ...(params.eventColumnIndex !== undefined ? { headerEventColumnIndex: params.eventColumnIndex } : {}),
      columns: params.columns,
      slots: params.slots,
      skipActions: params.skipActions,
      getSortOrder: apis.filterSortApi?.getSortOrder,
      getSortIndex: apis.filterSortApi?.getSortIndex,
      toggleSort: apis.filterSortApi?.onToggleSort,
      getFilterValue: apis.filterSortApi?.getFilterValue,
      setFilter: apis.filterSortApi?.setFilter,
      isColumnFiltered: apis.filterSortApi?.isColumnFiltered,
      getEnumOptions: apis.filterSortApi?.getEnumOptions,
      filterT: apis.filterSortApi?.filterT,
      onHeaderClick: params.onHeaderClick,
      onHeaderContextmenu: params.onHeaderContextmenu,
      floatingFilter: params.floatingFilter,
      onHeaderEnter: apis.sharedHeaderTooltip?.onHeaderEnter,
      onHeaderLeave: apis.sharedHeaderTooltip?.onHeaderLeave,
    })
    const ariaSort = params.col.sortable
      ? (() => {
          const order = apis.filterSortApi?.getSortOrder?.(params.key)
          return order === 'ascending' ? 'ascending' : order === 'descending' ? 'descending' : 'none'
        })()
      : undefined
    return params.wrap(params.key, sharedContent, ariaSort)
  }

  function renderCell(params: Parameters<ColumnVNodeFactory['renderCell']>[0]): VNode | VNode[] {
    const { col, key, colIndex, spanColIndex, columns, row, rowIndex, showInlineHover, slots, t, rowKeyFn } = params

    // ── Strategy 1: append 合成行——须先于 rowKeyFn（虚拟模式专属路径） ──
    // ── Strategy 1: append synthetic row — must run BEFORE rowKeyFn (virtual-only path) ──
    if (strategies.appendRow && strategies.appendRow.isAppendRow(row)) {
      return strategies.appendRow.renderPlaceholder({ rowIndex, spanColIndex })
    }
    // ── Strategy 2/3: 合成行统一判别（detail 优先于 group）──
    // ── Strategy 2/3: unified synthetic dispatch (detail before group) ──
    // 必须在任何 rowKeyFn / RowViewModel 查询之前，synthetic 行缺少业务 id，
    // 严格 rowKey（如 row => row.id.toString()）会直接抛错。
    const syntheticKind = (rowExpandApi || rowGroupApi)
      ? resolveSyntheticRowKind(row, { rowExpand: rowExpandApi ?? undefined, rowGroup: rowGroupApi ?? undefined })
      : null
    if (syntheticKind != null) {
      if (colIndex === params.syntheticFirstColIndex) {
        return syntheticKind === 'detail'
          ? strategies.renderDetailFirstCol(row)
          : strategies.renderGroupFirstCol(row)
      }
      const empty = strategies.renderSyntheticEmptyCol(syntheticKind)
      return empty ?? h('span')
    }
    const rowKeyStr = String(rowKeyFn(row))
    // <zh/> cells 查找走 cellsColIndex（混合域）——v2 的 colIndex 是事件域，直接用作下标
    // <zh/> 会在存在固定列/selection 列时错位（编辑态/脏标落到错误的列）
    // <en/> cells lookup uses cellsColIndex (mixed domain) — v2's colIndex is the event domain;
    // <en/> using it directly misaligns editing/dirty states when fixed/selection columns exist
    const cellState = apis.rowViewModelContext?.getCellsByRowKey?.(rowKeyStr)?.[params.cellsColIndex ?? colIndex]

    // ── Strategy 2/3 已在 rowKeyFn 之前提前返回，此处不再重复判别 ──

    // <zh/> 树形缩进前缀单点解析——编辑态保留与尾部装配共用同一份结果 |
    // <en/> Single-source tree-indent prefix — reused by edit-preserve and tail assembly
    const isFirstNormalTarget = params.firstNormalColIndex !== undefined
      && colIndex === params.firstNormalColIndex
    const prefixNodes = strategies.resolveTreePrefix({ row, rowKeyStr, colIndex, isFirstNormalTarget })

    // ── Strategy 4: 编辑态（不可编辑则落入普通渲染） | edit state (fall through when not editable) ──
    if (cellState?.isEditing ?? false) {
      const editCell = renderEditingCell({
        col,
        row,
        rowIndex,
        colIndex,
        colKey: key,
        editApi: apis.editApi,
        editConfig: strategies.getEditConfig(),
        cellState,
        rowKeyStr,
        tabindex: true,
      })
      if (editCell) {
        return finalizeCellNodes({ base: editCell, prefixNodes })
      }
    }

    // ── Strategy 5/6: 内容构建 + 装饰 span + 输出装配 ──
    // <zh/> 每格单次取值——此处解析一次，后续内容构建与 class 规则共享，消除高频重复 resolve。
    // <zh/> 取值口径与内容渲染咽喉一致：valueGetter 优先，否则按 dataKey ?? prop 直取
    // <zh/>（约束：tooltip/class/内容三者必须统一为显示值，口径分裂即导致自定义 dataKey 列错乱）。
    // <en/> resolve once per cell — parsed here a single time and shared by content
    // <en/> building and class rules, eliminating high-frequency duplicate resolves.
    // <en/> Caliber matches the content-render choke point: valueGetter first, else a direct
    // <en/> dataKey ?? prop lookup (constraint: tooltip/class/content must unify on the display value;
    // <en/> split calibers misrender custom-dataKey columns).
    const cellData = col.valueGetter
      ? resolveCellValue(row, col, rowIndex)
      : row[((col as { dataKey?: unknown }).dataKey ?? col.prop) as string]
    const built = buildCellContent({
      col,
      colIndex,
      columns,
      row,
      rowIndex,
      slots,
      slotKey: key,
      t,
      ctx: apis.tableContext,
      showInlineHover,
      hoverOptionTeleport: strategies.resolveHoverTeleport(),
      hoverOptionColumns: strategies.resolveHoverColumns(),
      rowKeyStr,
      firstNormalColIndex: params.firstNormalColIndex,
      treeApi: treeApi ?? undefined,
      cellState,
      cellData,
    })

    const baseCell = createCellSpan({
      content: built.cellContent,
      rowKeyStr,
      rowIndex,
      colIndex: spanColIndex,
      isRangeSelected: cellState?.isRangeSelected ?? false,
      isDirty: cellState?.isDirty ?? false,
      isSelected: cellState?.isSelected ?? false,
      cellClassRulesResult: strategies.resolveCellClassRulesResult?.({ col, row, rowIndex, colIndex, cellData }),
      tabindex: true,
    })

    // <zh/> 展开图标（非树形首普通列）——按宿主策略决定是否由工厂自动附加 |
    // <en/> Expand icon (non-tree first normal column) — appended by factory per host strategy
    let prefix = prefixNodes
    if ((strategies.autoExpandIcon ?? true)
      && params.firstNormalColIndex !== undefined
      && colIndex === params.firstNormalColIndex
      && rowExpandApi?.expandEnabled.value
      && !treeApi?.treeEnabled.value) {
      // <zh/> 命名空间经 tableContext 透传（渲染闭包内读取，运行时变更跟随）；缺省回退 'el' 与原硬编码一致
      // <en/> Namespace forwarded via tableContext (read inside the render closure, following runtime changes); absent falls back to 'el', identical to the previous hard-code
      const expandIcon = renderRowExpandIcon(rowKeyStr, rowExpandApi.expandedRowKeys.value.has(rowKeyStr), rowExpandApi!, undefined, apis.tableContext?.namespace?.value ?? 'el')
      prefix = [expandIcon, ...prefix]
    }

    return finalizeCellNodes({
      base: baseCell,
      prefixNodes: prefix.length > 0 ? prefix : undefined,
      hoverInlineVNode: built.hoverInlineVNode,
      shouldShowInline: built.shouldShowInline,
    })
  }

  return { buildHeaderContent, renderCell }
}
