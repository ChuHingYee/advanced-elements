/**
 * <zh/> 虚拟渲染器列准备 composable
 * <en/> Virtual renderer column preparation composable
 *
 * @remarks
 * <zh/> 职责单一：将输入列配置变换为 ElTableV2 所需的分区、过滤、展平结构。包含固定列分区、折叠过滤、深度/宽度计算、叶子展平等纯计算逻辑
 * <en/> Single responsibility: transforms input column config into the partition, filter, and flatten structure required by ElTableV2. Includes pure computation logic like fixed column partitioning, collapse filtering, depth/width calculation, leaf flattening, etc.
 */
import type { ComputedRef } from 'vue'
import type { ProcessedColumn as LocalColumn } from '../../types'
import { computed } from 'vue'
import { buildFilteredTree, ensureColumnIds, extractLeafWidths, flattenLeafColumns } from '../../utils/column-tree'

import { getColumnDepth, isGroupColumn } from '../../utils/shared'

export interface PreparedColumnsResult {
  mainFiltered: LocalColumn[]
  leftFiltered: LocalColumn[]
  rightFiltered: LocalColumn[]
  mainLeafWidths: number[]
  leftLeafWidths: number[]
  rightLeafWidths: number[]
  mainLeaves: LocalColumn[]
  leftLeaves: LocalColumn[]
  rightLeaves: LocalColumn[]
  allLeaves: LocalColumn[]
  maxDepth: number
}

export interface UseVirtualColumnsReturn {
  normalizedColumns: ComputedRef<LocalColumn[]>
  partitionedColumns: ComputedRef<{ main: LocalColumn[], left: LocalColumn[], right: LocalColumn[] }>
  mainRawColumns: ComputedRef<LocalColumn[]>
  leftRawColumns: ComputedRef<LocalColumn[]>
  rightRawColumns: ComputedRef<LocalColumn[]>
  mainFiltered: ComputedRef<LocalColumn[]>
  leftFiltered: ComputedRef<LocalColumn[]>
  rightFiltered: ComputedRef<LocalColumn[]>
  mainDepth: ComputedRef<number>
  leftDepth: ComputedRef<number>
  rightDepth: ComputedRef<number>
  mainLeafWidths: ComputedRef<number[]>
  leftLeafWidths: ComputedRef<number[]>
  rightLeafWidths: ComputedRef<number[]>
  mainLeaves: ComputedRef<LocalColumn[]>
  leftLeaves: ComputedRef<LocalColumn[]>
  rightLeaves: ComputedRef<LocalColumn[]>
  allLeaves: ComputedRef<LocalColumn[]>
  preparedColumns: ComputedRef<PreparedColumnsResult>
}

export interface UseVirtualColumnsDeps {
  columns: () => LocalColumn[]
  isCollapsed?: (columnKey: string) => boolean
  getColumnWidth: (col: LocalColumn) => number
}

/**
 * <zh/> 判断列数组中是否存在固定列（递归检查子列）。
 * <en/> Check whether the column array contains fixed columns (recursively checks child columns).
 */
export function hasFixedColumns(cols: LocalColumn[]): boolean {
  for (const col of cols) {
    if (col.fixed)
      return true
    if (isGroupColumn(col) && col.children?.length && hasFixedColumns(col.children))
      return true
  }
  return false
}

/**
 * <zh/> 按固定方向（left/right/无）递归分区列树。
 * <en/> Recursively partition the column tree by fixed direction (left/right/none).
 * <zh/> 分组列的子列可能分散到不同固定区域。
 * <en/> A group column's children may be distributed across different fixed areas.
 */
export function partitionColumnsByFixed(cols: LocalColumn[]): {
  main: LocalColumn[]
  left: LocalColumn[]
  right: LocalColumn[]
} {
  if (!hasFixedColumns(cols))
    return { main: cols, left: [] as LocalColumn[], right: [] as LocalColumn[] }

  const main: LocalColumn[] = []
  const left: LocalColumn[] = []
  const right: LocalColumn[] = []

  for (const col of cols) {
    // fixed:true 等价左固定（与列状态/拖拽守卫口径一致），此处归一化后再分区
    const rawFixed = (col as unknown as { fixed?: unknown }).fixed
    const fixed = (rawFixed === true ? 'left' : rawFixed) as 'left' | 'right' | undefined

    // <zh/> 分组列统一处理：按子列所在区域克隆组头到对应区，仅当该区确实持有 ≥1 个子列时才产出克隆。
    // <zh/> 约束：fixed:'left'|'right' 的分组列在子列全部落在 main 区时禁止向 fixed 区推入
    // <zh/> 持有"原始全量子集 children"的克隆，否则同一组列在固定区与主区重复渲染。
    // <en/> Unified group handling: clone the group header into each region that actually owns ≥1 child.
    // <en/> Constraint: a group column with fixed:'left'|'right' whose children all resolve to the
    // <en/> main region must not push a clone holding the ORIGINAL full children subset into the fixed
    // <en/> region — otherwise the same group columns render twice (fixed strip + main body).
    if ((fixed === 'left' || fixed === 'right') && isGroupColumn(col) && col.children?.length) {
      const children = partitionColumnsByFixed(col.children)
      const ownRegion = children[fixed]
      if (ownRegion.length)
        (fixed === 'left' ? left : right).push({ ...col, children: ownRegion })
      if (children.right.length && fixed !== 'right')
        right.push({ ...col, children: children.right })
      if (children.left.length && fixed !== 'left')
        left.push({ ...col, children: children.left })
      if (children.main.length) {
        main.push({ ...col, children: children.main })
      }
    }
    else if (fixed === 'left') {
      left.push({ ...col })
    }
    else if (fixed === 'right') {
      right.push({ ...col })
    }
    else if (isGroupColumn(col) && col.children?.length) {
      const children = partitionColumnsByFixed(col.children)
      if (children.left.length) {
        left.push({ ...col, children: children.left })
      }
      if (children.right.length) {
        right.push({ ...col, children: children.right })
      }
      if (children.main.length) {
        main.push({ ...col, children: children.main })
      }
    }
    else {
      main.push(col)
    }
  }

  return { main, left, right }
}

/**
 * <zh/> 虚拟渲染器列准备 composable——对输入列做固定分区、折叠过滤、叶子展平与深度/宽度计算。
 * <en/> Virtual renderer column preparation composable — fixed partitioning, collapse filtering,
 * <en/> leaf flattening and depth/width calculation over the input columns.
 *
 * @param deps - <zh/> 依赖函数：列来源、折叠判定与列宽获取 | <en/> dependency functions: column source, collapse checker and column width getter
 * @returns <zh/> 分区/过滤/展平后的列结构与深度、宽度派生 computed 集合 | <en/> computeds of partitioned, filtered and flattened columns with depth/width derivations
 */
export function useVirtualColumns(deps: UseVirtualColumnsDeps): UseVirtualColumnsReturn {
  const { columns, isCollapsed, getColumnWidth } = deps

  const normalizedColumns = computed(() =>
    ensureColumnIds(columns()),
  )

  const partitionedColumns = computed(() =>
    partitionColumnsByFixed(normalizedColumns.value),
  )
  const mainRawColumns = computed(() => partitionedColumns.value.main)
  const leftRawColumns = computed(() => partitionedColumns.value.left)
  const rightRawColumns = computed(() => partitionedColumns.value.right)

  const mainFiltered = computed(() =>
    buildFilteredTree(mainRawColumns.value, isCollapsed),
  )
  const leftFiltered = computed(() =>
    buildFilteredTree(leftRawColumns.value, isCollapsed),
  )
  const rightFiltered = computed(() =>
    buildFilteredTree(rightRawColumns.value, isCollapsed),
  )

  const mainDepth = computed(() => getColumnDepth(mainFiltered.value))

  /**
   * <zh/> 锚定方向表头深度——除该区过滤后列树的深度外，还需计入"自身声明 fixed 方向的
   * <zh/> 顶层分组"的子树深度：此类组的子列可能全部落回主区（分区器不为空壳克隆），
   * <zh/> 但其多级表头仍渲染在该固定方向的表头层级中，深度必须参与计算，
   * <zh/> 否则固定条带表头高度不足、层级错位（depth 契约测试锁定）。
   * <en/> Anchored-direction header depth — beyond the region's filtered tree, include the subtree
   * <en/> depth of top-level groups whose OWN fixed flag declares this direction: such groups may
   * <en/> have all children resolve back to main (the partitioner emits no empty clones), yet their
   * <en/> multi-level headers still occupy this direction's header levels. Excluding them starves
   * <en/> the fixed strip's header height (locked by the depth contract test).
   */
  function anchoredDirectionDepth(direction: 'left' | 'right'): number {
    let depth = 0
    for (const col of normalizedColumns.value) {
      if (col.fixed !== direction)
        continue
      depth = Math.max(depth, getColumnDepth([col]))
    }
    return depth
  }

  const leftDepth = computed(() => Math.max(getColumnDepth(leftFiltered.value), anchoredDirectionDepth('left')))
  const rightDepth = computed(() => Math.max(getColumnDepth(rightFiltered.value), anchoredDirectionDepth('right')))
  const mainLeafWidths = computed(() => extractLeafWidths(mainFiltered.value, getColumnWidth))
  const leftLeafWidths = computed(() => extractLeafWidths(leftFiltered.value, getColumnWidth))
  const rightLeafWidths = computed(() => extractLeafWidths(rightFiltered.value, getColumnWidth))

  const mainLeaves = computed(() => flattenLeafColumns(mainFiltered.value))
  const leftLeaves = computed(() => flattenLeafColumns(leftFiltered.value))
  const rightLeaves = computed(() => flattenLeafColumns(rightFiltered.value))

  const allLeaves = computed(() => [...mainLeaves.value, ...leftLeaves.value, ...rightLeaves.value])

  const preparedColumns = computed<PreparedColumnsResult>((prev) => {
    const next: PreparedColumnsResult = {
      mainFiltered: mainFiltered.value,
      leftFiltered: leftFiltered.value,
      rightFiltered: rightFiltered.value,
      mainLeafWidths: mainLeafWidths.value,
      leftLeafWidths: leftLeafWidths.value,
      rightLeafWidths: rightLeafWidths.value,
      mainLeaves: mainLeaves.value,
      leftLeaves: leftLeaves.value,
      rightLeaves: rightLeaves.value,
      allLeaves: allLeaves.value,
      maxDepth: Math.max(mainDepth.value, leftDepth.value, rightDepth.value),
    }
    if (prev
      && prev.mainFiltered === next.mainFiltered
      && prev.leftFiltered === next.leftFiltered
      && prev.rightFiltered === next.rightFiltered
      && prev.mainLeafWidths === next.mainLeafWidths
      && prev.leftLeafWidths === next.leftLeafWidths
      && prev.rightLeafWidths === next.rightLeafWidths
      && prev.mainLeaves === next.mainLeaves
      && prev.leftLeaves === next.leftLeaves
      && prev.rightLeaves === next.rightLeaves
      && prev.allLeaves === next.allLeaves
      && prev.maxDepth === next.maxDepth) {
      return prev
    }
    return next
  })

  return {
    normalizedColumns,
    partitionedColumns,
    mainRawColumns,
    leftRawColumns,
    rightRawColumns,
    mainFiltered,
    leftFiltered,
    rightFiltered,
    mainDepth,
    leftDepth,
    rightDepth,
    mainLeafWidths,
    leftLeafWidths,
    rightLeafWidths,
    mainLeaves,
    leftLeaves,
    rightLeaves,
    allLeaves,
    preparedColumns,
  }
}
