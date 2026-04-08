/**
 * @component NormalV2Column
 * @displayName 虚拟普通列
 * @displayName Normal V2 Column
 * @description <zh/> virtual 模式普通列配置工厂（V2 列描述生成） | <en/> Virtual-mode normal column config factory (V2 column descriptor generation)
 * @category 数据展示 | Data Display
 */
import type { MaybeRefOrGetter, Slots } from 'vue'
import type { ProcessedColumn as LocalColumn } from '../../types'
import type { TableHoverLayerApi } from '../../types/config-api'
import type { Translator } from '../../types/translator'
import { computed, h, inject, toValue } from 'vue'
import { advTableHoverLayerKey } from '../../types/config'
import { buildFilteredTree, DEFAULT_COLUMN_WIDTH } from '../../utils/column-tree'
import { getColumnKey, isGroupColumn, resolveCellClassRules } from '../../utils/shared'
import { ADV_TABLE_COLUMN_KEY_ATTR, ADV_TABLE_ROW_KEY_ATTR } from '../../utils/table-drag'
import { resolveCellValue } from '../../utils/value-pipeline'
import { filterTeleportHoverColumns, resolveStretchLowerBound, shouldShowInlineHover } from '../renderer-core/column-build-shared'
import { createColumnVNodeFactory } from '../renderer-core/column-vnode-factory'
import { extractColumnRenderProps, injectRendererContext } from '../renderer-core/render-helpers'
import { renderDetailRowContent } from '../shared/cell-render-pipeline'
import { renderGroupHeaderCell, renderTreeCellPrefix } from '../shared/column-renderer'
import { isAppendRowData } from './append-row-helpers'

/** <zh/> 预处理列树结果（来自 table-virtual-renderer.vue 的 preparedColumns） | <en/> Preprocessed column tree results (from table-virtual-renderer.vue's preparedColumns) */
export interface PreparedColumnTrees {
  mainFiltered: LocalColumn[]
  mainLeafWidths: number[]
  mainLeaves: LocalColumn[]
  leftFiltered?: LocalColumn[]
  leftLeafWidths?: number[]
  leftLeaves?: LocalColumn[]
  rightFiltered?: LocalColumn[]
  rightLeafWidths?: number[]
  rightLeaves?: LocalColumn[]
  /**
   * <zh/> 所有叶子列（主区域 + 固定区域）
   * <en/> All leaf columns (main region + fixed regions)
   */
  allLeaves?: LocalColumn[]
  /**
   * <zh/> 最大表头层级（useVirtualColumns 的 PreparedColumnsResult 恒产出；缺省按单层处理）——
   * <zh/> >1 时 needsFixedWidth 恒真，无宽列不参与拉伸（表头/汇总固定宽，表体单独拉伸会错位）
   * <en/> Max header depth (always emitted by useVirtualColumns' PreparedColumnsResult; treated as
   * <en/> single-level when absent) — when >1 needsFixedWidth is always true and width-less columns
   * <en/> do not stretch (header/summary are fixed-width; a body-only stretch would misalign)
   */
  maxDepth?: number
}

export interface NormalV2ColumnOptions {
  /** <zh/> 用于数据渲染的列（叶子列，扁平） | <en/> Columns for data rendering (leaf columns, flat) */
  displayNormalColumns: MaybeRefOrGetter<LocalColumn[]>
  /** <zh/> 用于多级表头的列（含分组） | <en/> Columns for multi-level headers (including groups) */
  displayColumns: MaybeRefOrGetter<LocalColumn[]>
  /** <zh/> 列索引偏移量，用于计算全局列索引（通常等于 selection 列数量） | <en/> Column index offset for calculating global column index (usually equals selection column count) */
  columnIndexOffset?: MaybeRefOrGetter<number>
  /** <zh/> 是否存在 hover 操作列 | <en/> Whether there are hover option columns */
  hasHoverOptionColumns: MaybeRefOrGetter<boolean>
  /** <zh/> hover 操作列 | <en/> Hover option columns */
  hoverOptionColumns: MaybeRefOrGetter<LocalColumn[]>
  /**
   * <zh/> hover 层 API——由渲染器自身 setup 传入（useHoverLayerProvider 的 api）。
   * <zh/> 注意：渲染器自己 provide 的 advTableHoverLayerKey 对其自身 setup 不可见（inject 只读父级），
   * <zh/> 因此必须显式传递，而不能靠注入获取。
   * <en/> Hover layer API — passed explicitly by the renderer's own setup (the api of useHoverLayerProvider).
   * <en/> NOTE: a renderer cannot inject its own provide (inject reads parent provides only),
   * <en/> so the api must be passed explicitly; the inject below is only a fallback.
   */
  hoverApi?: TableHoverLayerApi | undefined
  /** <zh/> 转发的插槽（无深度响应式追踪） | <en/> Forwarded slots (no deep reactive tracking) */
  slots: MaybeRefOrGetter<Slots>
  t: () => Translator | undefined
  /** <zh/> 行 key 函数 | <en/> Row key function */
  rowKeyFn: MaybeRefOrGetter<(row: any) => string>
  getColumnWidth: (col: any) => number
  /** <zh/> 列宽覆盖状态（用户在 useColumnResize 拖拽后的列宽），用于 autoSize 模式下固定被拖拽列 | <en/> Column width override state (column width after user drags in useColumnResize), used to fix dragged columns in autoSize mode */
  columnWidths?: Record<string, number>
  /** <zh/> 是否使用 teleport 模式（跳过行内渲染） | <en/> Whether to use teleport mode (skip inline rendering) */
  hoverOptionTeleport: MaybeRefOrGetter<boolean | undefined>
  /** <zh/> Teleport 是否真正可用（考虑祖先 transform 等因素） | <en/> Whether Teleport is actually usable (considering ancestor transform, etc.) */
  shouldUseTeleport?: MaybeRefOrGetter<boolean>
  /** <zh/> 表头点击回调 | <en/> Header click callback */
  onHeaderClick?: (params: { column: LocalColumn, columnIndex: number, event: Event }) => void
  /** <zh/> 表头右键回调 | <en/> Header context menu callback */
  onHeaderContextmenu?: (params: { column: LocalColumn, columnIndex: number, event: Event }) => void
  /** <zh/> 检查列是否可折叠 | <en/> Check if column can be collapsed */
  canCollapse?: (col: LocalColumn) => boolean
  /** <zh/> 检查列是否已折叠 | <en/> Check if column is collapsed */
  isCollapsed?: (columnKey: string) => boolean
  /** <zh/> 切换列分组折叠 | <en/> Toggle column group collapse */
  onToggleColumnGroupCollapse?: (columnKey: string) => void
  /** <zh/> 原始列（未过滤），用于 canCollapse 检查 | <en/> Original columns (unfiltered), used for canCollapse check */
  originalColumns?: LocalColumn[]
  /** <zh/> 预处理列树（可选，用于性能优化） | <en/> Preprocessed column tree (optional, for performance optimization) */
  preparedColumns?: MaybeRefOrGetter<PreparedColumnTrees>
  /** <zh/> 列自适应宽度模式 | <en/> Auto-size columns mode */
  autoSizeColumns?: MaybeRefOrGetter<boolean | undefined>
  /** <zh/> 启用内联浮动筛选 | <en/> Enable floating filter in header cells */
  floatingFilter?: MaybeRefOrGetter<boolean | undefined>
  /**
   * <zh/> 是否允许列宽拖拽调整（由 AdvTable 的 resizable 属性控制）
   * <en/> Whether column width drag resize is allowed (controlled by AdvTable's resizable prop)
   */
  resizable?: MaybeRefOrGetter<boolean | undefined>
  /** <zh/> 编辑配置 | <en/> Edit config */
  editConfig?: MaybeRefOrGetter<import('../../types/edit').EditConfig | undefined>
}

/**
 * <zh/> 扁平化列树，只保留叶子列，并根据折叠状态 + columnGroupShow 过滤
 * <en/> Flatten column tree, only keep leaf columns, filter by collapse state + columnGroupShow
 * @remarks
 * <zh/> 用于 ElTableV2 的列配置（需要扁平的叶子列数组）
 * <en/> Used for ElTableV2 column configuration (requires a flat array of leaf columns)
 */
function flattenAndFilterLeaves(
  cols: LocalColumn[],
  isCollapsedFn?: (key: string) => boolean,
): LocalColumn[] {
  const filteredTree = buildFilteredTree(cols, isCollapsedFn)
  const result: LocalColumn[] = []

  function walk(columns: LocalColumn[]) {
    for (const col of columns) {
      if (isGroupColumn(col) && col.children?.length) {
        walk(col.children)
      }
      else {
        result.push(col)
      }
    }
  }
  walk(filteredTree)
  return result
}

/** <zh/> 列构建上下文（共享给各构建函数） | <en/> Column build context (shared across builder functions) */
interface ColumnBuildContext {
  currentSlots: any
  currentRowKeyFn: (row: any) => string
  hasHover: boolean
  hoverCols: LocalColumn[]
  firstNormalColIndex: number
  /**
   * <zh/> 无显式 width 的列是否参与拉伸（flexGrow=1）。
   * <zh/> 与 needsFixedWidth 负相关：存在固定列或多级表头时表头/汇总行走固定宽，表体不可单独拉伸。
   * <en/> Whether width-less columns join stretching (flexGrow=1).
   * <en/> Mirrors !needsFixedWidth: with fixed columns or multi-level headers the header/summary run
   * <en/> fixed widths, so the body must not stretch alone.
   */
  canStretch: boolean
}

/**
 * <zh/> 为 ElTableV2 创建普通列配置
 * <en/> Create normal column config for ElTableV2
 */
export function useNormalV2Columns(options: NormalV2ColumnOptions) {
  const {
    displayColumns,
    hasHoverOptionColumns,
    hoverOptionColumns,
    slots,
    t,
    rowKeyFn,
    getColumnWidth,
    columnWidths,
    hoverOptionTeleport,
    shouldUseTeleport,
    onHeaderClick,
    onHeaderContextmenu,
    isCollapsed,
    preparedColumns,
  } = options

  const columnIndexOffset = computed(() => toValue(options.columnIndexOffset) ?? 0)

  const {
    tableContext,
    editApi,
    filterSortApi,
    treeApi,
    rowGroupApi,
    rowExpandApi,
    sharedHeaderTooltip,
    rowViewModelContext,
  } = injectRendererContext()

  // hoverApi 由渲染器显式传入（见 NormalV2ColumnOptions.hoverApi），
  // 注入仅为组件树外/测试环境的兜底，未提供时为 undefined（功能静默降级）
  // hoverApi is passed explicitly by the renderer; the inject is a fallback for
  // contexts where the key was provided by an ancestor (undefined = feature degraded)
  const hoverApi = options.hoverApi ?? inject(advTableHoverLayerKey, undefined)

  //  <zh/> 列 VNode 工厂——单元格/表头内容管线统一由此产出；
  //  <zh/> 本 composable 退化为布局插件：叶子扁平化/flex 宽度策略/config 组装。
  //  <en/> Column VNode factory — cell/header content pipelines come from here;
  //  <en/> this composable degrades to a layout plugin: leaf flattening / flex width policy / config assembly.
  const factory = createColumnVNodeFactory(
    {
      tableContext,
      editApi,
      filterSortApi,
      treeApi,
      rowGroupApi,
      rowExpandApi,
      sharedHeaderTooltip,
      rowViewModelContext,
    },
    {
      getEditConfig: () => toValue(options.editConfig),
      resolveCellClassRulesResult: ({ col, row, rowIndex, colIndex }) => resolveCellClassRulesResult(col, row, rowIndex, colIndex),
      resolveHoverTeleport: () => hoverApi?.hoverOptionTeleport?.value ?? toValue(shouldUseTeleport) ?? toValue(hoverOptionTeleport) ?? false,
      resolveHoverColumns: () => toValue(hoverOptionColumns),
      // <zh/> virtual 模式编辑态不保留展开图标（仅树形缩进）——图标由工厂尾部自动附加
      // <en/> virtual mode does NOT keep the expand icon in edit state (tree indent only) — icon auto-appended by the factory tail
      autoExpandIcon: true,
      resolveTreePrefix: ({ row, rowKeyStr, isFirstNormalTarget }) => {
        if (!isFirstNormalTarget || !treeApi?.treeEnabled.value)
          return []
        const meta = treeApi.getTreeMeta(row)
        return meta
          ? renderTreeCellPrefix(meta, rowKeyStr, (k) => { void treeApi!.toggleRowExpand(String(k)) }, undefined, tableContext?.namespace?.value ?? 'el')
          : []
      },
      renderDetailFirstCol: rowData => renderDetailRowContent({
        rowData,
        slots: toValue(slots),
        t,
        className: 'adv-table__detail-cell',
      }),
      renderSyntheticEmptyCol: kind => h('span', {
        class: kind === 'detail' ? 'adv-table__expand-row-empty-cell' : 'adv-table__group-header-empty-cell',
      }),
      renderGroupFirstCol: rowData => renderGroupHeaderCell(rowData, rowGroupApi!, toValue(slots), undefined, tableContext?.namespace?.value ?? 'el'),
      appendRow: {
        isAppendRow: isAppendRowData,
        renderPlaceholder: ({ rowIndex, spanColIndex }) => renderAppendRowCell(rowIndex, spanColIndex),
      },
    },
  )

  //  <zh/> 拆分 buildColumnConfig 为职责单一的构建函数
  //  <en/> Split buildColumnConfig into single-responsibility builder functions

  /**
   * <zh/> 计算列宽/flex 配置（autoSize 与非 autoSize 两种模式）
   * <en/> Compute column width/flex configuration (autoSize and non-autoSize modes)
   */
  function computeColumnWidth(col: LocalColumn, columnConfig: Record<string, any>, canStretch: boolean) {
    const key = getColumnKey(col)
    const autoSize = toValue(options.autoSizeColumns)
    const hasExplicitFlexGrow = 'flexGrow' in col
    const hasExplicitFlexShrink = 'flexShrink' in col
    const hasExplicitMinWidth = 'minWidth' in col
    const hasExplicitWidth = 'width' in col

    if (autoSize) {
      // 用户拖拽过的列：固定为拖拽后的宽度，关闭 flex | User-dragged columns: fixed to dragged width, flex disabled
      const userDraggedWidth = columnWidths?.[key]
      if (userDraggedWidth !== undefined) {
        columnConfig.width = userDraggedWidth
        columnConfig.minWidth = userDraggedWidth
        columnConfig.flexGrow = 0
        columnConfig.flexShrink = 0
      }
      else if (col.stretch === false) {
        // stretch: false → 固定宽度，不参与拉伸分配 | stretch: false → fixed width, does not participate in flex distribution
        columnConfig.flexGrow = 0
        columnConfig.flexShrink = 0
        if (hasExplicitWidth) {
          columnConfig.width = col.width
          columnConfig.minWidth = col.width
        }
      }
      else {
        // 参与拉伸：minWidth 为下限，flexGrow=1 等比分配剩余空间 | Participates in stretching: minWidth as lower bound, flexGrow=1 distributes remaining space proportionally
        // <zh/> 下限口径与 default 侧同源（resolveStretchLowerBound），修一处即两端同步
        // <en/> The lower-bound rule is shared with the default side (resolveStretchLowerBound); one fix covers both
        const lowerBound = resolveStretchLowerBound(col)
        if (lowerBound !== undefined) {
          columnConfig.width = lowerBound
          columnConfig.minWidth = lowerBound
        }
        else {
          // 无任何宽度约束：仍然必须下发数值宽度，避免该列被内容撑开导致表头/表体/汇总三处错位。
          // V2 列宽缺失时 flex-basis 退化为 auto（内容宽）——表头按标题文本宽、表体按数据宽、
          // 汇总按汇总值宽，三者天然不同且随数据漂移；下发同源数值宽（拖拽宽 → 列宽 → 默认宽）
          // 后再由 flexGrow=1 等比分配剩余空间，既保留 autoSize 拉伸语义又保证三行逐像素一致。
          // Even with no width constraint a numeric width must be emitted, otherwise the column is sized
          // by its content and header/body/summary drift apart. A missing V2 width degrades flex-basis to
          // auto (content size) — header sizes by its title, body by data, summary by its summary value,
          // naturally different and drifting with the data; emitting the shared numeric width (drag width →
          // column width → default) plus flexGrow=1 distribution keeps the autoSize stretch semantics while
          // guaranteeing pixel-identical rows.
          columnConfig.width = options.getColumnWidth(col) ?? DEFAULT_COLUMN_WIDTH
          columnConfig.minWidth = undefined
        }
        columnConfig.flexGrow = hasExplicitFlexGrow ? col.flexGrow : 1
        columnConfig.flexShrink = hasExplicitFlexShrink ? col.flexShrink : 0
      }
      if (col.maxWidth != null)
        columnConfig.maxWidth = col.maxWidth
    }
    else {
      // <zh/> 无显式 width 的列参与拉伸（flexGrow=1）——对齐经典 ElTable table-layout:fixed 语义：
      // <zh/> 固定宽列占位后，剩余空间由无宽列均分吸收，default 模式"名称"列因此占满剩余宽度。
      // <zh/> 仅当 canStretch（无固定列 + 单层表头）时生效：否则 needsFixedWidth 恒真，表头（自有格
      // <zh/> inline flex）与汇总行（forced 0/0）走固定宽，表体单独 flexGrow 会与二者列边界错位。
      // <zh/> 溢出时无剩余空间可分，flexGrow 自然惰性；stretch:false 显式退出拉伸。
      // <en/> Width-less columns join stretching (flexGrow=1) — matches classic ElTable
      // <en/> table-layout:fixed: after fixed-width columns take their share, width-less columns
      // <en/> split the leftover equally, which is why default mode's name column fills the row.
      // <en/> Only when canStretch (no fixed columns + single header depth): otherwise
      // <en/> needsFixedWidth forces fixed widths on the header (owned cells' inline flex) and the
      // <en/> summary row (forced 0/0), so a body-only flexGrow would misalign column boundaries.
      // <en/> Under overflow there is no free space to distribute, so flexGrow stays inert;
      // <en/> stretch:false explicitly opts out.
      const stretchable = canStretch && col.stretch !== false && !hasExplicitWidth
      columnConfig.flexGrow = hasExplicitFlexGrow ? col.flexGrow : (stretchable ? 1 : 0)
      columnConfig.flexShrink = hasExplicitFlexShrink ? col.flexShrink : 0
      if (hasExplicitMinWidth)
        columnConfig.minWidth = col.minWidth
      if (col.maxWidth != null)
        columnConfig.maxWidth = col.maxWidth
    }
  }

  /**
   * <zh/> 构建表头单元格渲染器
   * <en/> Build header cell renderer
   */
  /**
   * <zh/> 构建表头单元格渲染器——内容经共享工厂；外层 span 携带列键属性（拖拽/定位依赖）
   * <en/> Build header cell renderer — content via shared factory; outer span carries the column-key attr (drag/locator dependency)
   */
  /** <zh/> V2 渲染器构建上下文（参数对象化：7 参收敛为 1，避免顺序传错） | <en/> V2 renderer build context (param objectification: 7 params collapsed into 1 to avoid order mistakes) */
  interface V2RendererCtx {
    col: LocalColumn
    colIndex: number
    globalColIndex: number
    filteredCols: LocalColumn[]
    key: string
    context: ColumnBuildContext
    showInlineHover?: boolean
    currentSlots?: any
  }

  function buildV2HeaderRenderer(ctx: V2RendererCtx) {
    const { col, colIndex, globalColIndex, filteredCols, key, currentSlots } = ctx
    return () => {
      return factory.buildHeaderContent({
        col,
        key,
        colIndex,
        eventColumnIndex: globalColIndex,
        columns: filteredCols,
        slots: currentSlots,
        floatingFilter: toValue(options.floatingFilter),
        onHeaderClick,
        onHeaderContextmenu,
        wrap: (k, content, ariaSort) => h('span', {
          class: 'adv-table__header-cell adv-table__v2-header-cell',
          [ADV_TABLE_COLUMN_KEY_ATTR]: k,
          ...(ariaSort ? { 'aria-sort': ariaSort, 'role': 'columnheader' } : {}),
        }, [content]),
      })
    }
  }

  /**
   * <zh/> 解析单元格 class 规则
   * <en/> Resolve cell class rules
   */
  function resolveCellClassRulesResult(
    col: LocalColumn,
    rowData: any,
    rowIndex: number,
    colIndex: number,
    cellData?: unknown,
  ): string {
    if (!col.cellClassRules)
      return ''
    // <zh/> 复用工厂已取值，消灭每格第二次 resolveCellValue；
    // <zh/> 未提供时回退本地解析一次（直接调用场景）。
    // <en/> reuse the factory-resolved value, eliminating the second
    // <en/> resolveCellValue per cell; falls back to a local resolve for direct calls.
    return resolveCellClassRules(col.cellClassRules, {
      row: rowData,
      // <zh/> 经值管线取值——与排序/筛选/导出同源，条件规则可基于 valueGetter 派生值
      // <en/> Resolve via the value pipeline — same source as sort/filter/export,
      // <en/> so class rules can key off valueGetter-derived values
      cellData: cellData !== undefined ? cellData : resolveCellValue(rowData, col, rowIndex),
      column: col,
      rowIndex,
      columnIndex: colIndex,
    })
  }

  /**
   * <zh/> 渲染 append 合成行占位单元格
   * <en/> Render append synthetic-row placeholder cell
   * @remarks
   * <zh/> Append 合成行的所有普通列单元格均渲染为空白占位——SpanRow 会将整行合并
   * <zh/> 并替换为 append 插槽内容（详见 span-row-renderer.ts 的 applyAppendRow）。
   * <zh/> 提前返回避免触发编辑态判定、值格式化、cellClassRules 评估、hover 行计算等
   * <zh/> 与合成行无关的派生计算。
   * <zh/> 关键：必须在调用 rowKeyFn 之前判断，否则 rowKey='id' 在合成行上找不到字段会触发 dev 警告。
   * <en/> Append synthetic-row cells all render as blank placeholders—SpanRow merges the whole row
   * <en/> and replaces it with the append slot content (see applyAppendRow in span-row-renderer.ts).
   * <en/> Early return avoids triggering edit-state detection, value formatting, cellClassRules evaluation,
   * <en/> hover-row calculation, and other derived computations unrelated to the synthetic row.
   * <en/> Critical: must check before calling rowKeyFn, otherwise rowKey='id' will trigger a dev warning
   * <en/> when the field is missing on the synthetic row.
   */
  function renderAppendRowCell(rowIndex: number, globalColIndex: number) {
    return h('span', {
      'class': ['adv-table__cell', 'adv-table__drag-row-marker', 'adv-table__cell--append-row'],
      [ADV_TABLE_ROW_KEY_ATTR]: 'append-row',
      'data-adv-cell-row': rowIndex,
      'data-adv-cell-col': globalColIndex,
      'tabindex': -1,
    })
  }

  /**
   * <zh/> 构建 V2 列配置（组合各构建函数）
   * <en/> Build V2 column config (composes builder functions)
   */
  function buildColumnConfig(
    col: LocalColumn,
    colIndex: number,
    filteredCols: LocalColumn[],
    context: ColumnBuildContext,
    groupOffset = 0,
  ) {
    const key = getColumnKey(col)
    const dataKey = col.dataKey ?? col.prop ?? ''
    const rest = extractColumnRenderProps(col)
    const effectiveWidth = getColumnWidth(col) ?? DEFAULT_COLUMN_WIDTH
    const showInlineHover = shouldShowInlineHover(colIndex, filteredCols.length, context.hasHover)
    const globalColIndex = colIndex + columnIndexOffset.value + groupOffset

    const columnConfig: Record<string, any> = {
      ...rest,
      key,
      dataKey,
      title: col.label ?? '',
      width: effectiveWidth,
      resizable: col.resizable !== undefined ? col.resizable : !!toValue(options.resizable),
      class: showInlineHover ? 'adv-table__hover-cell' : undefined,
    }

    computeColumnWidth(col, columnConfig, context.canStretch)
    columnConfig.headerCellRenderer = buildV2HeaderRenderer({ col, colIndex, globalColIndex, filteredCols, key, context, currentSlots: context.currentSlots })
    columnConfig.cellRenderer = buildV2CellRenderer({ col, colIndex, globalColIndex, key, filteredCols, showInlineHover, context })

    return columnConfig
  }

  const filteredLeaves = computed(() => {
    // 使用预处理结果以避免重复扁平化
    // Use preprocessed result to avoid repeated flattening
    if (preparedColumns) {
      const prepared = toValue(preparedColumns)
      // 使用所有叶子列（主区域 + 固定区域），normalV2Columns 和 fixedV2Columns 才能正确分离
      // Use all leaf columns (main region + fixed regions) so normalV2Columns and fixedV2Columns separate correctly
      return prepared.allLeaves ?? prepared.mainLeaves
    }
    return flattenAndFilterLeaves(toValue(displayColumns), isCollapsed)
  })

  // 单次遍历分区，避免 normalV2Columns 和 fixedV2Columns 各自 filter 导致双重遍历
  // Single-pass partition to avoid double traversal from separate filters in normalV2Columns and fixedV2Columns
  // <zh/> 必须早于 buildV2Columns 定义：canStretch 门禁读取 fixed 分区是否为空
  // <en/> Must precede buildV2Columns: the canStretch gate reads whether the fixed partition is empty
  const partitionedLeaves = computed(() => {
    const leaves = filteredLeaves.value
    const normal: LocalColumn[] = []
    const fixed: LocalColumn[] = []
    for (const col of leaves) {
      if (col.fixed) {
        fixed.push(col)
      }
      else {
        normal.push(col)
      }
    }
    return { normal, fixed }
  })

  function buildV2Columns(leaves: LocalColumn[], groupOffset = 0) {
    const hasHover = toValue(hasHoverOptionColumns)
    const hoverCols = toValue(hoverOptionColumns)
    const currentSlots = toValue(slots)
    const currentRowKeyFn = toValue(rowKeyFn)
    const isTeleport = toValue(shouldUseTeleport) ?? toValue(hoverOptionTeleport)

    // <zh/> 【性能约束】此处禁止读取 filterState/sortState 建立依赖：
    // <zh/> 排序/筛选仅影响表头展示，而 headerCellRenderer 闭包在 EP 表头渲染 effect 内执行，
    // <zh/> 其内部的 getSortOrder/getFilterValue 调用会惰性读取响应式状态并被该 effect 追踪——
    // <zh/> 排序切换时仅需重渲染表头，而非重建全部列配置（cellRenderer 闭包全量换新 +
    // <zh/> EP 列 diff 全量重跑）。禁止手动依赖读取，否则每次排序触发整表列重建。
    // <en/> [PERF CONSTRAINT] No manual filterState/sortState reads here:
    // <en/> sort/filter only affect header display, and the headerCellRenderer closure executes
    // <en/> inside EP's header render effect, whose internal getSortOrder/getFilterValue calls
    // <en/> lazily read reactive state tracked by that effect — a sort toggle now re-renders
    // <en/> headers only instead of rebuilding every column config (fresh cellRenderer closures
    // <en/> + full EP column diff). Manual dep-reads are forbidden — they cause a full column rebuild
    // <en/> on every sort toggle.

    const filteredCols = filterTeleportHoverColumns(leaves, isTeleport)

    const firstNormalColIndex = filteredCols.findIndex(col => !col.selection)
    const context: ColumnBuildContext = {
      currentSlots,
      currentRowKeyFn,
      hasHover,
      hoverCols,
      firstNormalColIndex,
      // <zh/> 无宽列拉伸安全条件（与 needsFixedWidth 负相关）：存在固定列或多级表头时，表头与
      // <zh/> 汇总行强制固定宽，表体不可单独拉伸；溢出时无剩余空间可分，flexGrow 天然惰性。
      // <en/> Stretch-safety condition for width-less columns (mirrors !needsFixedWidth): with fixed
      // <en/> columns or multi-level headers the header and summary are forced to fixed widths, so the
      // <en/> body must not stretch alone; under overflow there is no free space, so flexGrow is inert.
      canStretch: partitionedLeaves.value.fixed.length === 0 && (toValue(preparedColumns)?.maxDepth ?? 1) <= 1,
    }
    return filteredCols.map((col, colIndex) => buildColumnConfig(col, colIndex, filteredCols, context, groupOffset))
  }

  /**
   * <zh/> 叶子列 → cells 查找索引（混合序、去 selection、经 teleport 过滤——与 default 模式
   * <zh/> 的 v-for 过滤域一致）映射。供 factory.renderCell 的 cellsColIndex 使用，
   * <zh/> 使 v2 的编辑态/脏标/范围高亮查找与 RowViewModel cells 数组同域。
   * <en/> Leaf column → cells lookup index (mixed order, selection excluded, teleport-filtered —
   * <en/> matching default mode's v-for filter domain) map. Consumed as factory.renderCell's
   * <en/> cellsColIndex so v2 editing/dirty/range lookups share the RowViewModel cells domain.
   */
  const leafCellsIndexMap = computed(() => {
    const isTeleport = toValue(shouldUseTeleport) ?? toValue(hoverOptionTeleport)
    const leaves = filteredLeaves.value
    const filtered = filterTeleportHoverColumns(leaves, isTeleport)
    const map = new Map<string, number>()
    filtered.forEach((col, i) => map.set(getColumnKey(col), i))
    return map
  })

  /**
   * <zh/> 构建单元格渲染器（策略分发）
   * <en/> Build cell renderer (strategy dispatch)
   * @remarks
   * <zh/> 按优先级处理 6 种渲染情况：append 合成行、detail 展开行、group 分组头、编辑态、树形/展开图标列、普通单元格
   * <en/> Handles 6 rendering cases by priority: append synthetic row, detail expand row, group header, edit state, tree/expand-icon column, normal cell
   */
  function buildV2CellRenderer(ctx: V2RendererCtx) {
    const { col, colIndex, globalColIndex, key, filteredCols, context, showInlineHover = false } = ctx
    return ({ rowData, rowIndex }: { rowData: any, rowIndex: number }) => {
      return factory.renderCell({
        col,
        key,
        colIndex,
        // <zh/> cells 查找域（混合序去 selection）——与 RowViewModel cells 数组同域；
        // <zh/> colIndex（= globalColIndex）是事件域，二者在固定列/selection 列存在时分叉
        // <en/> cells lookup domain (mixed order minus selection) — same domain as the
        // <en/> RowViewModel cells array; colIndex (= globalColIndex) is the event domain,
        // <en/> the two diverge once fixed/selection columns exist
        cellsColIndex: leafCellsIndexMap.value.get(key) ?? colIndex,
        spanColIndex: globalColIndex,
        columns: filteredCols,
        row: rowData,
        rowIndex,
        showInlineHover,
        syntheticFirstColIndex: 0,
        firstNormalColIndex: context.firstNormalColIndex >= 0 ? context.firstNormalColIndex : undefined,
        slots: context.currentSlots,
        t: t(),
        rowKeyFn: context.currentRowKeyFn,
      })
    }
  }

  const normalV2Columns = computed(() => buildV2Columns(partitionedLeaves.value.normal))

  /**
   * <zh/> fixed 列的 groupOffset = 过滤后的 normal 列数量
   * <zh/> fixed 列在 V2 列数组中位于 normal 列之后（[...selection, ...normal, ...fixed]），
   * <zh/> 因此 globalColIndex 需要加上 normal 列数量作为偏移量
   * <en/> groupOffset for fixed columns = filtered normal column count
   * <en/> Fixed columns are placed after normal columns in the V2 column array
   * <en/> ([...selection, ...normal, ...fixed]), so globalColIndex needs
   * <en/> normal column count as offset
   */
  const fixedV2Columns = computed(() => {
    const normalLeaves = partitionedLeaves.value.normal
    const isTeleport = toValue(shouldUseTeleport) ?? toValue(hoverOptionTeleport)
    const filteredNormalCount = isTeleport
      ? filterTeleportHoverColumns(normalLeaves, true).length
      : normalLeaves.length
    return buildV2Columns(partitionedLeaves.value.fixed, filteredNormalCount)
  })

  return {
    normalV2Columns,
    fixedV2Columns,
  }
}
