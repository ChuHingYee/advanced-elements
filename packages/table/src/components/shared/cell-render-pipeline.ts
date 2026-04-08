import type { Ref, VNode } from 'vue'
import type { CellState } from '../../composables/view-model/use-row-view-model'
import type { ProcessedColumn as LocalColumn } from '../../types'
import type { TableEditApi } from '../../types/config'
import type { EditConfig } from '../../types/edit'
import type { Translator } from '../../types/translator'
import { h } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { createStopEditingHandler } from '../../utils/edit-helpers'
import { isDev } from '../../utils/env'
import { AUTO_KEY_NAME } from '../../utils/normalize-row-key'
import { ADV_TABLE_ROW_KEY_ATTR } from '../../utils/table-drag'
import CellEditTrigger from '../cell-editors/cell-edit-trigger.vue'

/** <zh/> 已告警的误写槽名——渲染高频路径，每个误写键仅告警一次 | <en/> Already-warned misspelled slot names — hot render path, warn once per misspelled key */
const warnedExpandSlotKeys = new Set<string>()

/**
 * <zh/> 明细行（detail 合成行）的沉降高度种子，按行 `AUTO_KEY_NAME` 索引。
 *
 * <zh/> 存在的意义：virtual 模式下行高由 ElTableV2 动态测量，而 EP 仅在行挂载时实测一次，
 * <zh/> 且内嵌内容（如主/明细嵌套 ElTable 的 doLayout）常在行挂载后 1~2 帧才沉降——首次实测
 * <zh/> 必然偏小，行高锁死、内嵌表被裁切。virtual 渲染器观测到内容沉降高度后写入本表，
 * <zh/> `renderDetailRowContent` 渲染时以 `min-height` 兜底：重测（整表重挂载）时行的自动高度
 * <zh/> 即不低于种子值，实测随之收敛到正确高度。default 模式内容驱动高度，无人写入 → 恒空。
 *
 * <en/> Settled-height seeds for detail (synthetic) rows, keyed by the row's `AUTO_KEY_NAME`.
 *
 * <en/> Why this exists: in virtual mode row heights come from ElTableV2's dynamic measurement,
 * <en/> which runs only on row mount, while embedded content (e.g. a nested ElTable's doLayout)
 * <en/> settles 1–2 frames later — the first measurement necessarily undershoots, locking the row
 * <en/> height and clipping the embedded table. The virtual renderer writes the observed settled
 * <en/> height here, and `renderDetailRowContent` applies it as a `min-height` floor: on remeasure
 * <en/> (grid remount) the row's auto height is at least the seed, so the measurement converges to
 * <en/> the correct height. Default mode sizes by content and never writes here → always empty.
 */
const detailRowHeightSeeds = new Map<string, number>()

/** <zh/> 写入/更新明细行沉降高度种子 | <en/> Write/update a detail row's settled-height seed */
export function setDetailRowHeightSeed(autoKey: string, height: number): void {
  if (!Number.isFinite(height) || height <= 0)
    return
  detailRowHeightSeeds.set(autoKey, Math.round(height))
}

/** <zh/> 读取明细行沉降高度种子（无则 undefined） | <en/> Read a detail row's settled-height seed (undefined when absent) */
export function getDetailRowHeightSeed(autoKey: string): number | undefined {
  return detailRowHeightSeeds.get(autoKey)
}

/**
 * <zh/> 剪除已不在数据中的种子——折叠/删除行后随 WeakMap 语义由调用方按需清理，防 Map 无界增长。
 * <en/> Prune seeds whose rows are no longer live — the caller clears them on collapse/removal so the Map cannot grow unbounded.
 */
export function pruneDetailRowHeightSeeds(liveAutoKeys: Set<string>): void {
  for (const key of detailRowHeightSeeds.keys()) {
    if (!liveAutoKeys.has(key))
      detailRowHeightSeeds.delete(key)
  }
}

/**
 * <zh/> 渲染编辑态单元格——构建 CellEditTrigger 组件 VNode 并包裹在 adv-table__cell span 中
 * <en/> Render editing cell — build CellEditTrigger component VNode wrapped in an adv-table__cell span
 *
 * @param params - <zh/> 参数对象 | <en/> params object
 * @param params.col - <zh/> 当前列配置 | <en/> current column config
 * @param params.row - <zh/> 当前行数据 | <en/> current row data
 * @param params.rowIndex - <zh/> 当前行索引 | <en/> current row index
 * @param params.colIndex - <zh/> 当前列索引（V2 为全局列索引） | <en/> current column index (global for V2)
 * @param params.colKey - <zh/> 当前列 key | <en/> current column key
 * @param params.editApi - <zh/> 编辑 API（通过 inject 获取） | <en/> edit API (obtained via inject)
 * @param params.editConfig - <zh/> 编辑配置（调用方需先 resolve） | <en/> edit config (caller must resolve first)
 * @param params.cellState - <zh/> 单元格状态（来自 RowViewModel） | <en/> cell state (from RowViewModel)
 * @param params.rowKeyStr - <zh/> 行 key 字符串（用于 data 属性） | <en/> row key string (for data attributes)
 * @param params.tabindex - <zh/> 是否添加 tabindex=-1（V2 需要） | <en/> whether to add tabindex=-1 (V2 needs it)
 * @returns <zh/> 编辑态单元格 VNode，无编辑器组件时返回 null | <en/> editing cell VNode, or null when no editor component
 *
 * @remarks
 * <zh/> 两种渲染器（default / virtual）共用，确保编辑器 props 和 stopEditing handler 始终一致。
 * <zh/> 调用方负责将返回值与 tree elements / hover inline VNode 组合（因两种渲染器集成方式不同）。
 * <en/> Shared by both renderers (default / virtual), ensuring editor props and stopEditing handler are always consistent.
 * <en/> The caller is responsible for combining the return value with tree elements / hover inline VNode (as the two renderers integrate differently).
 */
export function renderEditingCell(params: {
  col: LocalColumn
  row: Record<string, any>
  rowIndex: number
  colIndex: number
  colKey: string
  editApi: TableEditApi | undefined
  editConfig: EditConfig | undefined
  cellState?: CellState
  rowKeyStr: string
  tabindex?: boolean
}): VNode | null {
  const {
    col,
    row,
    rowIndex,
    colIndex,
    colKey,
    editApi,
    editConfig,
    cellState,
    rowKeyStr,
    tabindex,
  } = params

  const editorComponent = editApi?.getEditorComponent?.(col, row, rowIndex)
  if (!editorComponent)
    return null

  const cellValue = editApi?.getCellEditingValue
    ? editApi.getCellEditingValue(colKey)
    : editApi?.editingValue?.value

  const onUpdateVal = editApi?.updateCellEditingValue
    ? (val: any) => editApi!.updateCellEditingValue!(colKey, val)
    : editApi?.updateEditingValue

  const stopEditingHandler = createStopEditingHandler({
    editApi: editApi!,
    editConfig,
    rowIndex,
    columnKey: colKey,
    row,
  })

  const isEditingDirty = cellState?.isDirty ?? false

  return h('span', {
    'class': ['adv-table__cell', 'adv-table__drag-row-marker', isEditingDirty && 'adv-table__cell--dirty'].filter(Boolean).join(' '),
    [ADV_TABLE_ROW_KEY_ATTR]: rowKeyStr,
    'data-adv-cell-row': rowIndex,
    'data-adv-cell-col': colIndex,
    'tabindex': tabindex ? -1 : undefined,
    'role': 'gridcell',
    'aria-rowindex': rowIndex + 1,
    'aria-colindex': colIndex + 1,
  }, h(CellEditTrigger, {
    'editor': editorComponent,
    'modelValue': cellValue,
    'onUpdate:modelValue': (val: any) => {
      onUpdateVal?.(val)
    },
    row,
    'rowIndex': rowIndex,
    'column': col,
    'editorParams': (() => {
      const raw = editApi?.getEditorSelectorParams?.(col, row, rowIndex) ?? col.cellEditorParams ?? {}
      return typeof raw === 'function' ? raw({ row, rowIndex, column: col }) : raw
    })(),
    'popupRenderer': col.popupRenderer,
    'onStopEditing': stopEditingHandler,
  }))
}

/**
 * <zh/> 创建普通单元格 span 包裹器——统一 class 和 data 属性
 * <en/> Create normal cell span wrapper — unify class and data attributes
 *
 * @param params - <zh/> 参数对象 | <en/> params object
 * @param params.content - <zh/> 单元格内容 VNode 或字符串 | <en/> cell content VNode or string
 * @param params.rowKeyStr - <zh/> 行 key 字符串 | <en/> row key string
 * @param params.rowIndex - <zh/> 行索引 | <en/> row index
 * @param params.colIndex - <zh/> 列索引 | <en/> column index
 * @param params.isRangeSelected - <zh/> 是否被范围选中 | <en/> whether range-selected
 * @param params.isDirty - <zh/> 是否有未提交修改 | <en/> whether has uncommitted changes
 * @param params.cellClassRulesResult - <zh/> cellClassRules 评估结果（V2 传入，V1 省略） | <en/> cellClassRules evaluation result (V2 passes it, V1 omits)
 * @param params.isSelected - <zh/> 是否被选中 | <en/> whether selected
 * @param params.tabindex - <zh/> 是否添加 tabindex=-1（两种渲染器均需要：使单元格可聚焦以激活键盘/剪贴板管线） | <en/> whether to add tabindex=-1 (needed by BOTH renderers: makes cells focusable to activate the keyboard/clipboard pipeline)
 * @returns <zh/> 单元格 span VNode | <en/> cell span VNode
 *
 * @remarks
 * <zh/> 两种渲染器（default / virtual）共用，确保 class 模式和 data 属性始终一致。
 * <en/> Shared by both renderers (default / virtual), ensuring class pattern and data attributes are always consistent.
 */
export function createCellSpan(params: {
  content: VNode | string
  rowKeyStr: string
  rowIndex: number
  colIndex: number
  isRangeSelected: boolean
  isDirty: boolean
  cellClassRulesResult?: string
  tabindex?: boolean
  isSelected?: boolean
}): VNode {
  const {
    content,
    rowKeyStr,
    rowIndex,
    colIndex,
    isRangeSelected,
    isDirty,
    cellClassRulesResult,
    tabindex,
    isSelected,
  } = params

  const ariaSelected = isRangeSelected || isSelected ? 'true' : undefined

  return h('span', {
    'class': [
      'adv-table__cell',
      'adv-table__drag-row-marker',
      cellClassRulesResult,
      isRangeSelected && 'adv-table__cell--range-selected',
      isDirty && 'adv-table__cell--dirty',
    ],
    [ADV_TABLE_ROW_KEY_ATTR]: rowKeyStr,
    'data-adv-cell-row': rowIndex,
    'data-adv-cell-col': colIndex,
    'tabindex': tabindex ? -1 : undefined,
    'role': 'gridcell',
    'aria-selected': ariaSelected,
    'aria-rowindex': rowIndex + 1,
    'aria-colindex': colIndex + 1,
  }, content)
}

// 单元格输出装配内核（default / virtual 双渲染器共享）
// Cell output assembly kernel (shared by default & virtual renderers)

/**
 * <zh/> 装配单元格最终输出——统一「树形/展开前缀 × 行内 hover」四象限的数组拼装。
 * <zh/> 该分支逻辑在两个渲染器中收敛为一处，禁止各重复 3-4 处（存在细微漂移风险）；
 * <zh/> 新增输出形态只需改一处。
 *
 * <en/> Assemble the final cell output — unifies the four-quadrant array assembly of
 * <en/> "tree/expand prefix × inline hover". This branch logic converges in one place for both renderers;
 * <en/> duplicating it 3-4 times per renderer risks subtle drift; new output shapes change in one place.
 *
 * @param params - <zh/> 参数对象 | <en/> params object
 * @param params.base - <zh/> 主体单元格（VNode 或已组装数组，如编辑态 [前缀, 控件]） | <en/> main cell (VNode or pre-assembled array, e.g. edit [prefix, control])
 * @param params.prefixNodes - <zh/> 树形缩进/展开图标前缀 | <en/> tree indent / expand icon prefix nodes
 * @param params.hoverInlineVNode - <zh/> 行内 hover 操作节点 | <en/> inline hover action node
 * @param params.shouldShowInline - <zh/> 是否渲染行内 hover | <en/> whether to render the inline hover
 */
export function finalizeCellNodes(params: {
  base: VNode | VNode[]
  prefixNodes?: (VNode | null)[] | undefined
  hoverInlineVNode?: VNode | undefined
  shouldShowInline?: boolean
}): VNode | VNode[] {
  const { base, hoverInlineVNode, shouldShowInline } = params
  const baseArr = Array.isArray(base) ? base : [base]
  const prefixNodes = params.prefixNodes?.filter((n): n is VNode => n != null)

  if (prefixNodes && prefixNodes.length > 0) {
    const withPrefix = [...prefixNodes, ...baseArr]
    return shouldShowInline ? [...withPrefix, hoverInlineVNode!] : withPrefix
  }
  return shouldShowInline ? [...baseArr, hoverInlineVNode!] : (baseArr.length === 1 ? baseArr[0]! : baseArr)
}

/**
 * <zh/> 判别合成行类型——detail 展开行优先于 group 分组头行（与两渲染器既有顺序一致）。
 * <zh/> 调用方须在 rowKeyFn 之前调用：合成行缺少 rowKey 字段，直接调用会触发 dev 警告。
 *
 * <en/> Resolve the synthetic-row kind — detail expand rows take priority over group header rows
 * <en/> (matching both renderers' existing order). Callers must invoke BEFORE rowKeyFn:
 * <en/> synthetic rows lack the rowKey field and would trigger a dev warning.
 */
export function resolveSyntheticRowKind(
  row: unknown,
  apis: {
    rowExpand?: { expandEnabled: Ref<boolean>, isDetailRow: (row: unknown) => boolean } | undefined | null
    rowGroup?: { groupEnabled: Ref<boolean>, isGroupHeaderRow: (row: unknown) => boolean } | undefined | null
  },
): 'detail' | 'group' | null {
  if (apis.rowExpand?.expandEnabled.value && apis.rowExpand.isDetailRow(row))
    return 'detail'
  if (apis.rowGroup?.groupEnabled.value && apis.rowGroup.isGroupHeaderRow(row))
    return 'group'
  return null
}

/**
 * <zh/> 渲染 detail 展开行首列内容——插槽优先，缺省回退到 i18n 文案。
 * <zh/> 类名由调用方传入（default 模式 adv-table__expand-row / virtual 模式 adv-table__detail-cell，
 * <zh/> DOM 形态刻意保持与各自宿主一致）。
 *
 * <en/> Render detail expand-row first-column content — slot first, i18n fallback second.
 * <en/> Class name is caller-supplied (default mode adv-table__expand-row vs virtual mode
 * <en/> adv-table__detail-cell; DOM shapes intentionally match each host).
 */
export function renderDetailRowContent(params: {
  rowData: any
  slots: Record<string, any> | undefined
  t?: () => Translator | undefined
  className: string
}): VNode {
  const detailRow = params.rowData
  const originalRow = detailRow.__detailRowData
  const rowKey = detailRow.__detailRowKey
  // <zh/> 插槽名规范：kebab-case（`expand-row`）为规范名，camelCase（`expandRow`）为兼容别名，运行时等价
  // <en/> Slot naming: kebab-case (`expand-row`) is canonical, camelCase (`expandRow`) is the compat alias; equivalent at runtime
  const expandRowSlot = params.slots?.expandRow ?? params.slots?.['expand-row']
  if (!expandRowSlot && isDev && params.slots && typeof console !== 'undefined') {
    // <zh/> 常见误写（expanded-row）静默回退曾导致“展开无内容” long-debug，现一次性告警指路
    // <en/> Common misspellings (expanded-row) used to silently fall back, causing long debugging sessions; warn once to point the way
    for (const misspelled of ['expanded-row']) {
      if (misspelled in params.slots && !warnedExpandSlotKeys.has(misspelled)) {
        warnedExpandSlotKeys.add(misspelled)
        devWarn(`[AdvTable] Unknown slot "${misspelled}" for detail expand rows. Did you mean #expand-row?`)
      }
    }
  }
  // <zh/> virtual 模式高度种子：内嵌内容沉降后由渲染器写入，min-height 兜底使重测收敛
  // <zh/> （EP 仅挂载时实测一次，不兜底则行高锁死在首次偏小值）。default 模式无人写入，恒 undefined。
  // <en/> Virtual-mode height seed: written by the renderer after embedded content settles; the
  // <en/> min-height floor makes remeasurement converge (EP measures only on mount, so without the
  // <en/> floor the row sticks at the first undershoot). Default mode never writes it → always undefined.
  const seed = getDetailRowHeightSeed(String(detailRow[AUTO_KEY_NAME] ?? ''))
  const anchorStyle = seed !== undefined ? { minHeight: `${seed}px` } : undefined
  if (expandRowSlot) {
    return h('div', { class: params.className, style: anchorStyle }, expandRowSlot({ row: originalRow, rowKey }))
  }
  const fallback = typeof params.t === 'function' ? params.t()?.('table.rowExpand') : undefined
  return h('div', { class: params.className, style: anchorStyle }, fallback?.replace('{rowKey}', String(rowKey)) ?? `Row ${rowKey}`)
}
