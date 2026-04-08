/**
 * @component V2Header
 * @displayName 虚拟多级表头
 * @displayName V2 Header
 * @description <zh/> V2 多级表头渲染器 | <en/> V2 multi-level header renderer
 * @category 数据展示 | Data Display
 *
 * @remarks
 * <zh/> 职责单一：根据列分组深度、区域（主/左固定/右固定）和折叠状态，构建多级表头的 VNode 树。
 * <zh/> 包含 buildGroupRowCells（列分组行单元格构建）和 CustomHeader（表头渲染入口）。
 * <en/> Single responsibility: builds multi-level header VNode tree based on column group depth, region (main/left-fixed/right-fixed), and collapse state.
 * <en/> Includes buildGroupRowCells (column group row cell builder) and CustomHeader (header rendering entry point).
 */
import type { ComputedRef, MaybeRefOrGetter, Slots, VNode } from 'vue'
import type { ProcessedColumn as LocalColumn } from '../../types'
import type { SortState } from '../../types/sort'
import type { PreparedColumnsResult } from './use-virtual-columns'
import { toValue } from 'vue'
import { DEFAULT_COLUMN_WIDTH, findColumnByKey, getLeafCount } from '../../utils/column-tree'
import { getColumnKey, isGroupColumn } from '../../utils/shared'
import { COLLAPSED_ARROW_PATH, EXPANDED_ARROW_PATH } from '../renderer-core/render-helpers'
import { buildSharedHeaderContent } from '../shared/column-renderer'

interface GroupRowCell {
  type: 'group' | 'leaf' | 'placeholder'
  col?: LocalColumn
  width: number
  depth?: number
}

export interface V2HeaderDeps {
  globalHeaderDepth: ComputedRef<number>
  preparedColumns: ComputedRef<PreparedColumnsResult>
  headerMainFilteredTree: ComputedRef<LocalColumn[]>
  headerMainLeafWidths: ComputedRef<number[]>
  headerMainDepth: ComputedRef<number>
  leftDepth: ComputedRef<number>
  rightDepth: ComputedRef<number>
  needsFixedWidth: ComputedRef<boolean>
  selectionV2Columns: ComputedRef<any[]>
  headerCellHeight: () => number
  floatingFilter: () => boolean | undefined
  floatingFilterHeight: () => number
  isCollapsed: ((columnKey: string) => boolean) | undefined
  canCollapse: ((col: LocalColumn) => boolean) | undefined
  originalColumns: () => LocalColumn[]
  slots: MaybeRefOrGetter<Slots>
  displayNormalColumns: MaybeRefOrGetter<LocalColumn[]>
  onToggleColumnGroupCollapse: (key: string) => void
  /** <zh/> 排序状态——用于 ARIA aria-sort 属性 | <en/> Sort state — used for ARIA aria-sort attribute */
  sortState: ComputedRef<SortState[] | undefined>
}

/**
 * <zh/> 构建列分组行单元格
 * <en/> Build column group row cells
 */
function buildGroupRowCells(
  tree: LocalColumn[],
  headerIndex: number,
  leafWidths: number[],
  _regionDepth: number,
): (GroupRowCell | null)[] {
  const result: (GroupRowCell | null)[] = []
  let leafIndex = 0

  const traverse = (nodes: LocalColumn[], depth: number) => {
    for (const node of nodes) {
      const isGroup = isGroupColumn(node)
      if (isGroup) {
        const children = node.children
        const leafCount = getLeafCount(children)
        if (depth === headerIndex) {
          let totalWidth = 0
          for (let i = 0; i < leafCount; i++)
            totalWidth += leafWidths[leafIndex + i]
          result.push({ type: 'group', col: node, width: totalWidth })
          for (let i = 1; i < leafCount; i++)
            result.push(null)
          leafIndex += leafCount
        }
        else {
          traverse(children, depth + 1)
        }
      }
      else {
        if (depth === headerIndex) {
          result.push({ type: 'leaf', col: node, width: leafWidths[leafIndex], depth })
        }
        else if (depth === 0 && headerIndex > 0) {
          result.push({ type: 'leaf', col: node, width: leafWidths[leafIndex], depth })
        }
        else {
          result.push({ type: 'placeholder', width: leafWidths[leafIndex] })
        }
        leafIndex++
      }
    }
  }

  traverse(tree, 0)
  return result
}

/**
 * <zh/> 创建 V2 多级表头渲染函数
 * <en/> Create V2 multi-level header render function
 *
 * @param deps - <zh/> 表头渲染所需的所有响应式依赖和回调 | <en/> All reactive dependencies and callbacks needed for header rendering
 * @returns <zh/> 可用于 ElTableV2 #header 插槽的渲染函数 | <en/> Render function usable as ElTableV2 #header slot
 */
export function createV2HeaderRenderer(deps: V2HeaderDeps) {
  const {
    globalHeaderDepth,
    preparedColumns,
    headerMainFilteredTree,
    headerMainLeafWidths,
    headerMainDepth,
    leftDepth,
    rightDepth,
    needsFixedWidth,
    selectionV2Columns,
    headerCellHeight,
    floatingFilter,
    floatingFilterHeight,
    isCollapsed,
    canCollapse,
    originalColumns,
    slots,
    displayNormalColumns,
    onToggleColumnGroupCollapse,
    sortState,
  } = deps

  /**
   * <zh/> 获取列的 aria-sort 值 | <en/> Get aria-sort value for a column
   */
  function getAriaSort(col: LocalColumn | undefined): 'ascending' | 'descending' | 'none' {
    if (!col?.sortable)
      return 'none'
    const colKey = col ? getColumnKey(col) : undefined
    if (!colKey)
      return 'none'
    const sort = sortState.value?.find(s => (s.columnKey ?? s.prop) === colKey)
    if (!sort || !sort.order)
      return 'none'
    return sort.order === 'ascending' ? 'ascending' : 'descending'
  }

  /**
   * <zh/> V2 多级表头渲染函数，用作 ElTableV2 的 #header 插槽
   * <en/> V2 multi-level header render function, used as ElTableV2's #header slot
   */
  function V2Header({ cells, headerIndex, columns }: { cells: any[], headerIndex: number, columns: any[] }): VNode[] {
    const globalDepth = globalHeaderDepth.value
    const prepared = preparedColumns.value
    // <zh/> 缺宽占位回退统一走 DEFAULT_COLUMN_WIDTH | <en/> Missing-width placeholder fallback uses DEFAULT_COLUMN_WIDTH
    const fallbackPx = `${DEFAULT_COLUMN_WIDTH}px`

    if (globalDepth <= 1)
      return cells

    const hasNormalColumn = columns.some((col: any) => !col.fixed)
    const isMainArea = hasNormalColumn

    let filteredTree: LocalColumn[]
    let leafWidths: number[]
    let regionDepth: number

    if (isMainArea) {
      filteredTree = headerMainFilteredTree.value
      leafWidths = headerMainLeafWidths.value
      regionDepth = headerMainDepth.value
    }
    else {
      const rawFixed = (columns[0] as unknown as { fixed?: unknown } | undefined)?.fixed ?? 'right'
      const fixed = (rawFixed === true ? 'left' : rawFixed) as 'left' | 'right'
      if (fixed === 'left') {
        filteredTree = prepared.leftFiltered
        leafWidths = prepared.leftLeafWidths
        regionDepth = leftDepth.value
      }
      else {
        filteredTree = prepared.rightFiltered
        leafWidths = prepared.rightLeafWidths
        regionDepth = rightDepth.value
      }
    }

    if (headerIndex >= regionDepth) {
      if (!isMainArea && regionDepth < globalDepth) {
        return cells.map((_: any, i: number) => (
          <div key={i} class="adv-table__header-cell adv-table__v2-header-cell adv-table__v2-header-cell--placeholder" style={{ height: 0, width: leafWidths?.[i] ? `${leafWidths[i]}px` : fallbackPx, flex: needsFixedWidth.value ? '0 0 auto' : '0 1 auto', overflow: 'hidden' }} />
        ))
      }
      return cells.map((cell: any, i: number) => {
        const cellWidth = cell?.props?.style?.width ?? fallbackPx
        return <div key={i} class="adv-table__header-cell adv-table__v2-header-cell adv-table__v2-header-cell--placeholder" style={{ height: '100%', width: cellWidth, flex: needsFixedWidth.value ? '0 0 auto' : '0 1 auto' }} />
      })
    }

    if (!isMainArea && regionDepth <= 1 && globalDepth > 1) {
      if (headerIndex === 0) {
        const leafHeight = globalDepth * headerCellHeight() + (floatingFilter() ? floatingFilterHeight() : 0)
        return cells.map((cell: any, i: number) => {
          const cellWidth = leafWidths?.[i] ? `${leafWidths[i]}px` : (cell?.props?.style?.width ?? fallbackPx)
          return (
            <div
              key={i}
              class="adv-table__header-cell adv-table__v2-header-cell adv-table__v2-header-cell--leaf-span"
              role="columnheader"
              aria-sort={getAriaSort(columns[i])}
              style={{
                width: cellWidth,
                height: `${leafHeight}px`,
                flex: needsFixedWidth.value ? '0 0 auto' : '0 1 auto',
              }}
            >
              {cell}
            </div>
          )
        })
      }
      return cells.map((_: any, i: number) => (
        <div key={i} class="adv-table__header-cell adv-table__v2-header-cell adv-table__v2-header-cell--placeholder" style={{ height: 0, width: leafWidths?.[i] ? `${leafWidths[i]}px` : fallbackPx, flex: needsFixedWidth.value ? '0 0 auto' : '0 1 auto', overflow: 'hidden' }} />
      ))
    }

    if (regionDepth <= 1)
      return cells

    const groupRowCells = buildGroupRowCells(filteredTree, headerIndex, leafWidths, globalDepth)

    const result: any[] = []

    for (let i = 0; i < cells.length; i++) {
      const config = groupRowCells[i]
      const colKey = config?.col ? getColumnKey(config.col) : undefined
      const stableKey = colKey ?? `cell-${i}`

      if (config === null || config === undefined) {
        if (config === null)
          continue
        result.push(<div key={stableKey} class="adv-table__header-cell adv-table__v2-header-cell adv-table__v2-header-cell--placeholder" style={{ height: '100%', width: fallbackPx, flex: needsFixedWidth.value ? '0 0 auto' : '0 1 auto' }} />)
        continue
      }

      if (config.type === 'placeholder') {
        result.push(<div key={stableKey} class="adv-table__header-cell adv-table__v2-header-cell adv-table__v2-header-cell--placeholder" style={{ height: '100%', width: `${config.width}px`, flex: needsFixedWidth.value ? '0 0 auto' : '0 1 auto' }} />)
        continue
      }

      if (config.type === 'leaf') {
        const leafDepth = config.depth ?? 0
        if (headerIndex === leafDepth) {
          const leafHeight = (globalDepth - headerIndex) * headerCellHeight() + (floatingFilter() ? floatingFilterHeight() : 0)
          const cellContent = i < selectionV2Columns.value.length
            ? (
                // <zh/> 自有 framed 框：复刻 EP header-cell 视觉（见 virtual-table.scss），不再依赖 EP 类名；
                // <zh/> 命中解析走自有挂钩（use-column-resize OWNED_HEADER_CELL_SELECTORS）
                // <en/> Owned framed box: replicates the EP header-cell visuals (see virtual-table.scss)
                // <en/> without the EP class; hit-testing uses the owned hooks
                // <en/> (use-column-resize OWNED_HEADER_CELL_SELECTORS)
                <div class="adv-table__v2-header-cell--framed" role="columnheader" style={`flex: ${needsFixedWidth.value ? '0 0 auto' : '0 1 auto'};`}>
                  {selectionV2Columns.value[i]?.headerCellRenderer?.()}
                </div>
              )
            : cells[i]
          result.push(
            <div
              key={stableKey}
              class="adv-table__header-cell adv-table__v2-header-cell adv-table__v2-header-cell--leaf-span"
              role="columnheader"
              data-adv-table-column-key={getColumnKey(config.col!)}
              aria-sort={getAriaSort(config.col)}
              style={{
                width: `${config.width}px`,
                height: `${leafHeight}px`,
                flex: needsFixedWidth.value ? '0 0 auto' : '0 1 auto',
              }}
            >
              {cellContent}
            </div>,
          )
        }
        else {
          result.push(
            <div
              key={stableKey}
              class="adv-table__header-cell adv-table__v2-header-cell adv-table__v2-header-cell--placeholder"
              data-adv-table-column-key={colKey}
              style={{
                height: '100%',
                width: `${config.width}px`,
                flex: needsFixedWidth.value ? '0 0 auto' : '0 1 auto',
              }}
            />,
          )
        }
        continue
      }

      const col = config.col!
      const key = getColumnKey(col)
      const collapsed = isCollapsed?.(key) ?? false
      const origCol = findColumnByKey(originalColumns() ?? [], key) ?? col
      const collapsible = canCollapse?.(origCol) ?? false

      const forwardedSlots = toValue(slots)
      const titleText = (col as { label?: string }).label ?? ''
      const mergedSlots = {
        ...forwardedSlots,
        [`${key}-header`]: () => titleText,
      }
      const sharedContent = buildSharedHeaderContent({
        col,
        colIndex: 0,
        columns: toValue(displayNormalColumns),
        slots: mergedSlots,
        skipActions: true,
      })

      const headerContent = collapsible
        ? (
            <span class="adv-table-column-group-header">
              {sharedContent}
              <span
                class={['adv-table-column-group-header__toggle', collapsed ? 'adv-table-column-group-header__toggle--collapsed' : 'adv-table-column-group-header__toggle--expanded']}
                onClick={(e: Event) => {
                  e.stopPropagation()
                  onToggleColumnGroupCollapse(key)
                }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d={collapsed ? COLLAPSED_ARROW_PATH : EXPANDED_ARROW_PATH} />
                </svg>
              </span>
            </span>
          )
        : sharedContent

      result.push(
        <div
          key={colKey ?? `grp-${i}`}
          class="adv-table__v2-header-cell--framed"
          data-key={key}
          data-adv-table-column-key={key}
          role="columnheader"
          style={{
            flex: needsFixedWidth.value ? '0 0 auto' : '0 1 auto',
            width: `${config.width}px`,
          }}
        >
          <div
            class="adv-table__header-cell adv-table__v2-header-cell adv-table__v2-header-cell--group"
            data-adv-table-column-key={key}
          >
            {headerContent}
          </div>
        </div>,
      )
    }

    return result
  }

  return V2Header
}
