import type { ComputedRef, ShallowRef } from 'vue'
import type { ProcessedColumn } from '../../types'
import { computed } from 'vue'
import { APPEND_ROW_FLAG } from '../../components/table-virtual-renderer/append-row-helpers'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { getSyntheticRowStableKey, isSyntheticRow as isBaseSyntheticRow } from '../../utils/synthetic-row'

/**
 * <zh/> 判断行数据是否为合成行（详情展开行 / 分组头行 / 追加行 / 合计行）。
 * <zh/> 合成行缺少 rowKey 字段（如 'id'），直接调用 keyFn 会触发 dev 警告。
 * <zh/> 基础四态复用单一源，另加虚拟追加行标记。
 * <en/> Check if row data is a synthetic row (detail expand row / group header row / append row / total rows).
 * <en/> Synthetic rows lack the rowKey field (e.g. 'id'), calling keyFn directly triggers a dev warning.
 */
function isSyntheticRow(row: unknown): boolean {
  if (isBaseSyntheticRow(row))
    return true
  if (!row || typeof row !== 'object')
    return false
  return (row as Record<string, unknown>)[APPEND_ROW_FLAG] === true
}

/**
 * <zh/> 单元格装饰态——引用稳定的不可变对象
 * <en/> Cell decoration state — reference-stable immutable object
 *
 * @remarks
 * <zh/> 订阅契约：每行 cells 数组封装为 shallowRef，经 RowViewModelContext 提供；
 * <zh/> 单元格 render effect 只读本行 ref，重渲染范围收敛到 cells 引用变化的行。
 * <zh/> 引用未变的行不赋值也不触发，因此未受影响行零重渲染。
 * <en/> Subscription contract: each row's cells array is exposed as a shallowRef through
 * <en/> RowViewModelContext; a cell's render effect reads only its own row ref, so re-rendering is
 * <en/> limited to rows whose cells reference changed. Unchanged rows are neither assigned nor
 * <en/> triggered and therefore never re-render.
 *
 * <zh/> 引用稳定性保证：
 * <zh/> - RowViewModel.cells 数组在行状态未变时复用上一次的引用
 * <zh/> - 仅当该行的编辑/选择/dirty 等状态变化时才重建该行的 cells 数组
 * <en/> Reference stability guarantee:
 * <en/> - RowViewModel.cells array reuses the previous reference when row state hasn't changed
 * <en/> - Only rebuilds the row's cells array when that row's editing/selection/dirty state changes
 */
export interface CellState {
  /** <zh/> 是否正在编辑 | <en/> Whether currently editing */
  readonly isEditing: boolean
  /** <zh/> 是否有未提交的修改 | <en/> Whether there are uncommitted changes */
  readonly isDirty: boolean
  /**
   * 是否在范围选择选区内
   * Whether inside the range-selection selection area
   */
  readonly isRangeSelected: boolean
  /**
   * <zh/> 是否被行选中——当前构建器暂不填充（恒 false），保留字段供行选中高亮演进，禁止再用 as any 读取
   * <en/> Whether row-selected — currently never populated by builders (always false); kept for row-selection highlight evolution, never read via as any again
   */
  readonly isSelected?: boolean
}

/**
 * 空的 cellState 常量——无装饰态时复用，避免创建新对象。
 * 使用 Object.freeze 冻结，确保不可变语义。
 */
export const EMPTY_CELL_STATE: CellState = Object.freeze({
  isEditing: false,
  isDirty: false,
  isRangeSelected: false,
}) as CellState

export interface RowViewModel<T = any> {
  /**
   * 原始行数据
   * Original row data
   */
  readonly row: T
  /** 行 key */
  readonly rowKey: string
  /**
   * 行索引
   * Row index
   */
  readonly rowIndex: number
  /**
   * 每列的装饰态数组，引用稳定——除非该行状态变化
   * Per-column decoration-state array with stable references — unless the row's state changes
   */
  readonly cells: readonly CellState[]
}

/**
 * <zh/> 归一化选区矩形 | <en/> Normalized selection rectangle
 */
export interface DecorationRangeRect {
  startRow: number
  endRow: number
  startCol: number
  endCol: number
}

/**
 * <zh/> 装饰态源快照——稀疏化反转"受影响行集"的依据。
 *
 * <zh/> **依赖对等契约**：snapshot 必须在**单次同步调用内读取**装饰谓词可能依赖的全部响应式来源
 * <zh/> （editingCell/editingRowIndex/isFullRowEdit/rangeSelection/dirtyRowKeys/dirtyTrackingEnabled）。
 * <zh/> snapshot 在 rowViewModels computed 内部被调用，其中的响应式读取会被 Vue 追踪——
 * <zh/> 这是稀疏路径唯一的失效信号来源。漏读任一来源将导致对应装饰态维度不触发重算（装饰态卡死）。
 *
 * <en/> Decoration-state source snapshot — the basis for the sparse "affected row set" inversion.
 *
 * <en/> **Dependency-parity contract**: snapshot must read ALL reactive sources that decoration
 * <en/> predicates may depend on within a single synchronous call. It runs inside the rowViewModels
 * <en/> computed, so those reads are tracked by Vue — they are the ONLY invalidation signal of the
 * <en/> sparse path. Missing any source freezes that decoration dimension (stale decorations).
 */
export interface RowViewModelDecorationSnapshot {
  /** <zh/> 当前编辑单元格（单格模式；fullRow 模式恒 null） | <en/> Currently editing cell (single-cell mode; always null in fullRow mode) */
  editingCell: { rowIndex: number, columnKey: string } | null
  /** <zh/> 当前编辑行索引（fullRow 模式使用） | <en/> Currently editing row index (used in fullRow mode) */
  editingRowIndex: number | null
  /** <zh/> 是否整行编辑模式——模式翻转触发全量重建 | <en/> Whether full-row edit mode — mode flip triggers a full rebuild */
  isFullRowEdit: boolean
  /** <zh/> 当前范围选择矩形（无选区时 null） | <en/> Current range-selection rectangle (null when no selection) */
  rangeSelection: DecorationRangeRect | null
  /** <zh/> 持有脏记录的行键集合（rowKey 域，与 dirtyCells 同步增量维护） | <en/> Row keys holding dirty records (rowKey domain, incrementally synced with dirtyCells) */
  dirtyRowKeys: ReadonlySet<string>
  /** <zh/> 脏标记追踪开关（editConfig.showStatus）——翻转触发全量重建 | <en/> Dirty tracking switch (editConfig.showStatus) — flip triggers a full rebuild */
  dirtyTrackingEnabled: boolean
}

/**
 * <zh/> RowViewModel 构建选项 | <en/> RowViewModel 构建option
 */
export interface UseRowViewModelOptions<T> {
  /**
   * 可见行数据
   * Visible row data
   */
  visibleData: ShallowRef<T[]> | ComputedRef<T[]>
  /** 行 key 函数 */
  rowKeyFn: () => (row: T) => string
  /** 编辑状态查询——判断某 cell 是否正在编辑 */
  isCellEditing: (rowIndex: number, colKey: string) => boolean
  /** dirty 状态查询——判断某 cell 是否有未提交修改 */
  isCellDirty: (rowIndex: number, colKey: string) => boolean
  /** 范围选择状态查询——判断某 cell 是否在选区内 */
  isCellSelected: (rowIndex: number, colIndex: number) => boolean
  /** 有效列配置（不含 selection 列） */
  columns: ComputedRef<ProcessedColumn[]>
  /**
   * <zh/> 装饰态源快照 getter——提供时启用**稀疏重算**：computed 内先差分快照求出受影响行集，
   * <zh/> 仅对这些行调用谓词评估，其余行整体复用上次的 RowViewModel（对象与 cells 引用均不变）。
   * <zh/> 单格提交的重算成本由 O(n×m) 次谓词查询降为 O(受影响行×m)。
   * <zh/> 缺省时走稠密路径（每次全量 n×m 谓词查询 + 逐行比较复用）。
   * <en/> Decoration snapshot getter — enables **sparse recomputation** when provided: the computed
   * <en/> diffs snapshots to derive the affected row set, evaluates predicates only for those rows,
   * <en/> and reuses previous RowViewModel objects wholesale for all other rows.
   * <en/> Single-cell commit cost drops from O(n×m) predicate queries to O(affected rows × m).
   * <en/> When omitted, falls back to the dense path (full n×m predicate queries + per-row compare
   * <en/> reuse) — identical to the historical behavior.
   */
  snapshot?: () => RowViewModelDecorationSnapshot
}

/** <zh/> 空的脏行键集常量——语义占位，供快照提供方在无脏记录时复用 | <en/> Empty dirty-key-set constant — reusable by snapshot providers when no dirty records exist */
export const EMPTY_ROW_KEY_SET: ReadonlySet<string> = new Set<string>()

function rectsEqual(a: DecorationRangeRect | null, b: DecorationRangeRect | null): boolean {
  if (a === b)
    return true
  if (!a || !b)
    return false
  return a.startRow === b.startRow && a.endRow === b.endRow
    && a.startCol === b.startCol && a.endCol === b.endCol
}

/** <zh/> 逐元素比较 cells 内容是否等值（用于变更行的引用回收） | <en/> Element-wise cells equality (reference salvage for changed rows) */
function cellsEquivalent(prev: readonly CellState[], next: readonly CellState[]): boolean {
  if (prev.length !== next.length)
    return false
  for (let i = 0; i < next.length; i++) {
    const p = prev[i] ?? EMPTY_CELL_STATE
    const c = next[i] ?? EMPTY_CELL_STATE
    if (p.isEditing !== c.isEditing || p.isDirty !== c.isDirty || p.isRangeSelected !== c.isRangeSelected)
      return false
  }
  return true
}

function addAffectedIndex(affected: Set<number>, rowIndex: number | undefined | null, bound: number): void {
  if (rowIndex == null)
    return
  if (rowIndex < 0 || rowIndex >= bound)
    return
  affected.add(rowIndex)
}

function mergeRectRows(affected: Set<number>, rect: DecorationRangeRect | null, bound: number): void {
  if (!rect)
    return
  const start = Math.max(0, rect.startRow)
  const end = Math.min(bound - 1, rect.endRow)
  for (let r = start; r <= end; r++)
    affected.add(r)
}

/**
 * <zh/> useRowViewModel 实例的稀疏差分基线。由 computed 闭包独占持有。
 * <en/> Per-instance sparse diff baselines. Owned exclusively by the computed closure.
 */
interface DiffBaselines<T> {
  prevRowMap: Map<string, RowViewModel<T>>
  lastData: T[] | null
  lastCols: ProcessedColumn[] | null
  lastKeyFn: ((row: T) => string) | null
  lastSnap: RowViewModelDecorationSnapshot | null
}

function commitBaselines<T>(
  baselines: DiffBaselines<T>,
  data: T[],
  cols: ProcessedColumn[],
  keyFn: (row: T) => string,
  snap: RowViewModelDecorationSnapshot,
): void {
  baselines.lastData = data
  baselines.lastCols = cols
  baselines.lastKeyFn = keyFn
  baselines.lastSnap = snap
}

/**
 * <zh/> 行视图模型 composable——以稀疏差分计算 rowViewModels：未受影响的行复用上一基线，仅增量重建变化行。
 * <en/> Row view model composable — computes rowViewModels with sparse diffing: unaffected rows reuse
 * <en/> the previous baseline, only changed rows are rebuilt incrementally.
 *
 * @param options - <zh/> 构建视图模型所需的数据、列与编辑/选中状态注入 | <en/> Data, columns and edit/selection state feeds for the view models
 * @returns <zh/> rowViewModels——行视图模型数组的响应式引用 | <en/> rowViewModels — a computed ref of the row view model array
 */
export function useRowViewModel<T>(options: UseRowViewModelOptions<T>): {
  rowViewModels: ComputedRef<RowViewModel<T>[]>
} {
  // 使用 Map 索引上次的 RowViewModel，避免 O(n) find
  const baselines: DiffBaselines<T> = {
    prevRowMap: new Map(),
    lastData: null,
    lastCols: null,
    lastKeyFn: null,
    lastSnap: null,
  }

  /**
   * <zh/> selection 列过滤缓存——cells 索引域与渲染端 colIndex 域对齐的关键。
   *
   * <zh/> 渲染端传给 cells 查找的 colIndex 是**排除 selection 列**的索引
   * <zh/> （default: displayNormalColumns 下标；v2: 叶子局部下标），而编排器传入的
   * <zh/> effectiveColumns 含用户声明的 `{ selection: true }` 列——cells 数组必须按
   * <zh/> 不含 selection 的列序构建，否则声明 selection 列后其后所有列的编辑态/脏标/范围
   * <zh/> 高亮整体错位 selectionCount 列。按本文档"不含 selection 列"的契约在入口
   * <zh/> 统一过滤，并 dev 提示一次。
   * <zh/> 过滤结果按 rawCols 引用缓存：避免每次重算生成新数组引用令 baselines.lastCols
   * <zh/> 的引用比较失效（否则稀疏路径每次都全量重建，性能回归）。
   * <en/> Selection-column filter cache — the key to aligning the cells index domain with the
   * <en/> renderer's colIndex domain.
   *
   * <en/> The colIndex handed to the cells lookup EXCLUDES selection columns (default:
   * <en/> displayNormalColumns index; v2: leaf-local index), while the orchestrator passes
   * <en/> effectiveColumns which contains user-declared `{ selection: true }` columns — cells
   * <en/> must be built in the selection-exclusive order, otherwise declaring a selection
   * <en/> column shifts every later column's editing/dirty/range state by selectionCount.
   * <en/> Filter at the entry per this file's documented contract ("no selection columns"),
   * <en/> with a one-shot dev warning. The filter result is cached by rawCols reference so the
   * <en/> baselines.lastCols reference comparison stays stable (otherwise the sparse path would
   * <en/> fully rebuild on every recomputation — a performance regression).
   */
  let lastRawCols: ProcessedColumn[] | null = null
  let lastFilteredCols: ProcessedColumn[] | null = null
  function resolveCols(raw: ProcessedColumn[]): ProcessedColumn[] {
    if (raw === lastRawCols)
      return lastFilteredCols ?? raw
    lastRawCols = raw
    const hasSelection = raw.some(c => c.selection === true)
    if (hasSelection && isDev) {
      devWarn(
        '[AdvTable] useRowViewModel received selection columns ({ selection: true }); '
        + 'they are excluded from the cells index domain to match the renderer\'s colIndex (selection-exclusive). '
        + 'If editing/dirty/range highlights look shifted, ensure the columns source does not mix selection columns into effectiveColumns.',
      )
    }
    lastFilteredCols = hasSelection ? raw.filter(c => c.selection !== true) : raw
    return lastFilteredCols
  }

  // 直接以 computed 暴露——computed 自身会在任一依赖变化时重算，
  // 无需 watch + shallowRef 桥接（消除 Vue 反模式）
  // Expose the computed directly — computed recomputes on any dependency change,
  // no watch + shallowRef bridge needed (eliminates the Vue anti-pattern)
  const rowViewModels = computed<RowViewModel<T>[]>(() => {
    const data = options.visibleData.value
    const cols = resolveCols(options.columns.value)

    // ── 稀疏路径：提供快照时启用（依赖对等契约见 RowViewModelDecorationSnapshot）──
    // ── Sparse path: enabled when a snapshot source is provided ──
    if (options.snapshot)
      return computeSparse(data, cols, options, options.snapshot, baselines)

    // ── 稠密回退：无快照时的默认行为约束，输出保持逐引用一致 ──
    // ── Dense fallback: default behavior without snapshot, outputs stay referentially consistent ──
    return computeDense(data, cols, options, baselines.prevRowMap, next => (baselines.prevRowMap = next))
  })

  return { rowViewModels }
}

// 稀疏路径——快照差分 → 受影响行集 → 局部重建
// Sparse path — snapshot diffing → affected row set → partial rebuild

/**
 * <zh/> 稀疏重算主流程
 * <en/> Sparse recomputation main flow
 *
 * @remarks
 * <zh/> 失效路由：① 全量重建——首次/列标识/keyFn/fullRow 模式/showStatus 翻转（列序错位或全行分支变化）；
 * <zh/> ② 结构性数据换（数组标识变、列/keyFn/模式未变）——编辑/选区按索引寻址须重评当前索引，
 * <zh/> 脏值比较域随值迁移，仅持有脏记录的行（按 keyFn 映射）重评，其余按 rowKey 复用 prev cells；
 * <zh/> ③ 纯装饰态变化（数据引用未变）——编辑单元格移动取新旧行索引并集，选区移动取新旧矩形行并集，
 * <zh/> 脏键集变化取新旧集合对称差映射为行索引（O(n) keyFn 遍历）。未受影响行整体复用 prev vm，
 * <zh/> 重建行内容等值时回收 prev 引用——输出与稠密路径逐引用等价。
 * <en/> Invalidation routing: ① full rebuild — first run / column identity / keyFn / fullRow-mode / showStatus flip
 * <en/> (column reorder misaligns indices; flips alter every row's branch); ② structural data swap (new array
 * <en/> identity, same cols/keyFn/mode) — index-addressed editing/selection must re-evaluate at current indices;
 * <en/> dirty value-comparison domain moves with values, only rows holding dirty records (mapped via keyFn) re-evaluate,
 * <en/> others reuse prev cells keyed by rowKey; ③ pure decoration change (same data identity) — editing-cell move
 * <en/> unions old+new row indices, range move unions old+new rect rows, dirty-set change maps the symmetric
 * <en/> difference to indices (O(n) keyFn walk). Untouched rows reuse prev vm wholesale; rebuilt rows salvage
 * <en/> the prev reference when contents are equivalent — output is reference-for-reference equivalent to dense.
 */
function computeSparse<T>(
  data: T[],
  cols: ProcessedColumn[],
  options: UseRowViewModelOptions<T>,
  snapshot: () => RowViewModelDecorationSnapshot,
  baselines: DiffBaselines<T>,
): RowViewModel<T>[] {
  // 无数据时返回空数组（保持 prevMap 与稠密路径一致的保留语义）
  // Return empty array when there is no data (prevMap retention mirrors the dense path)
  if (data.length === 0) {
    commitBaselines(baselines, data, cols, options.rowKeyFn(), snapshot())
    return []
  }

  const keyFn = options.rowKeyFn()
  // <zh/> 快照必须在依赖探测点同步读取——其响应式读取是稀疏路径的唯一失效信号 |
  // <en/> The snapshot MUST be read at this dependency-probe point — its reactive reads are
  // <en/> the only invalidation signal of the sparse path
  const snap = snapshot()

  const lastSnap = baselines.lastSnap
  const firstRun = lastSnap == null && baselines.lastData == null
  // <zh/> 输入重置：列序位移使 cells 下标错位；keyFn 变化改写全部行键；模式/开关翻转改变
  // <zh/> 全部行的判定分支——均无法证明复用安全，保守全量重建。
  // <en/> Input reset: column reorder misaligns cell indices; keyFn change rewrites every row
  // <en/> key; mode/switch flips alter every row's evaluation branch — reuse cannot be proven,
  // <en/> so a conservative full rebuild applies.
  const inputsReset = firstRun
    || cols !== baselines.lastCols
    || keyFn !== baselines.lastKeyFn
    || (!firstRun && (snap.isFullRowEdit !== lastSnap!.isFullRowEdit
      || snap.dirtyTrackingEnabled !== lastSnap!.dirtyTrackingEnabled))
  // <zh/> 数据换（数组标识变化但输入未重置）：按 rowKey 复用仍可证明安全 |
  // <en/> Data swap (new array identity without input reset): rowKey-keyed reuse stays provable
  const dataSwapped = !inputsReset && data !== baselines.lastData
  const fullRebuild = inputsReset

  const affected = new Set<number>()
  if (!fullRebuild) {
    // 编辑域：新旧编辑位置都标记（移动语义——离开的行要清除高亮）。
    // 单格模式标记 editingCell.rowIndex；fullRow 模式标记 editingRowIndex——两者都无条件标记，
    // 冗余标记无害（引用回收兜底），漏标记才会导致装饰态卡死。
    // Editing domain: mark both old+new positions (move semantics — the vacated row must clear).
    // Single-cell mode marks editingCell.rowIndex; fullRow mode marks editingRowIndex — mark BOTH
    // unconditionally: redundant marking is harmless (reference salvage backstops), missing
    // markings freeze decorations.
    addAffectedIndex(affected, lastSnap!.editingCell?.rowIndex, data.length)
    addAffectedIndex(affected, snap.editingCell?.rowIndex, data.length)
    addAffectedIndex(affected, lastSnap!.editingRowIndex, data.length)
    addAffectedIndex(affected, snap.editingRowIndex, data.length)
    // 选区域：新旧矩形的行并集（矩形相等时跳过）
    // Selection domain: row union of old+new rectangles (skipped when the rect is unchanged)
    if (!rectsEqual(lastSnap!.rangeSelection, snap.rangeSelection)) {
      mergeRectRows(affected, lastSnap!.rangeSelection, data.length)
      mergeRectRows(affected, snap.rangeSelection, data.length)
    }

    if (dataSwapped) {
      // 数据换：编辑/选区为索引域已随上方标记当前值；脏值比较域随数据值迁移，
      // 持有脏记录的行（按当前 keyFn 映射新索引）需重新评估值比较。
      // Data swap: editing/selection index domains are marked above at their current values;
      // the dirty value-comparison domain moves with data values — rows holding dirty records
      // (mapped to fresh indices via the current keyFn) must re-evaluate.
      markDirtyRecordRows(affected, data, keyFn, snap.dirtyRowKeys)
    }
    else if (snap.dirtyRowKeys !== lastSnap!.dirtyRowKeys) {
      // 纯装饰态：脏键集对称差映射为行索引
      // Pure decoration: symmetric difference of dirty-key sets mapped to indices
      const changed = new Set<string>(snap.dirtyRowKeys)
      for (const k of lastSnap!.dirtyRowKeys) {
        if (snap.dirtyRowKeys.has(k))
          changed.delete(k)
        else
          changed.add(k)
      }
      markDirtyRecordRows(affected, data, keyFn, changed)
    }
  }

  const next: RowViewModel<T>[] = []
  const newPrevMap = new Map<string, RowViewModel<T>>()

  for (let i = 0; i < data.length; i++) {
    const row = data[i]

    // 合成行跳过 keyFn（稳定预置键），消费者不会访问其 RowViewModel，但需占位以保持索引对齐
    // Synthetic rows skip keyFn (stable preassigned key); consumers never access them but alignment is kept
    const isSynthetic = isSyntheticRow(row)
    const rowKey = isSynthetic ? getSyntheticRowStableKey(row, i) : keyFn(row)

    const prevVm = baselines.prevRowMap.get(rowKey)
    if (!fullRebuild && !affected.has(i)) {
      if (prevVm != null && prevVm.row === row && prevVm.rowIndex === i) {
        // 未受影响且行对象/索引未移位——整体复用上次对象（含 cells 引用），零分配
        // Unaffected with same row object & index — reuse the previous vm wholesale, zero alloc
        next.push(prevVm)
        newPrevMap.set(rowKey, prevVm)
        continue
      }
      if (prevVm != null && movableSalvageable(prevVm.rowIndex, i, snap)) {
        // <zh/> 行对象存在但位置移位（排序/插入/删除）——仅当索引域谓词在新旧位置输出可证相同时
        // <zh/> 才能免评估回收 prev cells：
        // <zh/> - 脏为 rowKey 域（持有记录的行已标记）+ 值比较取同一行对象——位置无关；
        // <zh/> - 编辑/选区为索引域——新旧位置相对活跃索引/选区矩形的命中关系必须一致，
        // <zh/>   否则该行需重新评估（如编辑行在排序后移出编辑索引，须清除高亮）。
        // <en/> Row exists but moved (sort/insert/delete) — salvage without evaluation ONLY when the
        // <en/> index-domain predicates provably yield identical outputs at both positions:
        // <en/> - dirty is a rowKey domain (record-holding rows are already marked) + its value
        // <en/>   comparison reads the same row object — position-independent;
        // <en/> - editing & selection are index domains — the old/new positions must hit the active
        // <en/>   editing index / selection rect identically, otherwise re-evaluate (e.g. a row that
        // <en/>   was the edited one must lose its highlight after sorting moves it away).
        const rowVm: RowViewModel<T> = { row, rowKey, rowIndex: i, cells: prevVm.cells }
        next.push(rowVm)
        newPrevMap.set(rowKey, rowVm)
        continue
      }
      // 全新出现的行——必须评估 | Brand-new row — must evaluate
    }

    const fresh = buildFreshRowCells(i, cols, options.isCellEditing, options.isCellDirty, options.isCellSelected)
    // 内容与 prev 等值时回收 prev 引用——与稠密路径 allUnchanged 分支的输出完全一致
    // Salvage the prev reference when contents are equivalent — matches the dense path's
    // allUnchanged branch output exactly
    const cells = prevVm != null && cellsEquivalent(prevVm.cells, fresh) ? prevVm.cells : fresh

    const rowVm: RowViewModel<T> = {
      row,
      rowKey,
      rowIndex: i,
      cells,
    }

    next.push(rowVm)
    newPrevMap.set(rowKey, rowVm)
  }

  baselines.prevRowMap = newPrevMap
  commitBaselines(baselines, data, cols, keyFn, snap)

  return next
}

/**
 * <zh/> 判断移动行在新旧位置上，索引域谓词（编辑/选区）的行级命中是否一致。
 * <zh/> 一致 ⇒ cells 可免评估回收；不一致（如旧位置是编辑行/在选区内而新位置不是）⇒ 需重新评估。
 *
 * <en/> Whether a moved row's index-domain predicates (editing/selection) hit identically at the
 * <en/> old and new positions. Identical ⇒ cells salvageable without evaluation; divergent (e.g.
 * <en/> the old position was the edited row / inside the rect but the new one is not) ⇒ re-evaluate.
 */
function movableSalvageable(
  oldIndex: number,
  newIndex: number,
  snap: RowViewModelDecorationSnapshot,
): boolean {
  const activeEditIndex = snap.isFullRowEdit
    ? snap.editingRowIndex
    : snap.editingCell?.rowIndex ?? null
  const editHitOld = activeEditIndex != null && activeEditIndex === oldIndex
  const editHitNew = activeEditIndex != null && activeEditIndex === newIndex
  if (editHitOld !== editHitNew)
    return false

  const rect = snap.rangeSelection
  if (rect) {
    const inOld = oldIndex >= rect.startRow && oldIndex <= rect.endRow
    const inNew = newIndex >= rect.startRow && newIndex <= rect.endRow
    if (inOld !== inNew)
      return false
  }
  return true
}

function markDirtyRecordRows(
  affected: Set<number>,
  data: unknown[],
  keyFn: (row: any) => string,
  keys: ReadonlySet<string>,
): void {
  if (keys.size === 0)
    return
  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    if (isSyntheticRow(row))
      continue
    if (keys.has(keyFn(row)))
      affected.add(i)
  }
}

// 稠密回退（无快照时的默认行为）
// Dense fallback — verbatim port of the historical implementation

function computeDense<T>(
  data: T[],
  cols: ProcessedColumn[],
  options: UseRowViewModelOptions<T>,
  prevRowMap: Map<string, RowViewModel<T>>,
  setPrevRowMap: (next: Map<string, RowViewModel<T>>) => void,
): RowViewModel<T>[] {
  // 无数据时返回空数组 | Return empty array when there is no data
  if (data.length === 0) {
    return []
  }

  const keyFn = options.rowKeyFn()
  const next: RowViewModel<T>[] = []
  // 构建新的 prevRowMap 供下次使用
  const newPrevMap = new Map<string, RowViewModel<T>>()

  for (let i = 0; i < data.length; i++) {
    const row = data[i]

    // <zh/> 合成行（详情展开行 / 分组头行 / 追加行）跳过 keyFn 调用，
    // <zh/> 使用稳定预置键，避免因合成行缺少 rowKey 字段触发 dev 警告。
    // <en/> Synthetic rows (detail expand row / group header row / append row) skip keyFn call,
    // <en/> use a stable preassigned key to avoid dev warning caused by missing rowKey field on synthetic rows.
    // <en/> The RowViewModel for synthetic rows is never accessed by consumers (renderers return early), but still needs a placeholder to maintain index alignment.
    const isSynthetic = isSyntheticRow(row)
    const rowKey = isSynthetic ? getSyntheticRowStableKey(row, i) : keyFn(row)

    // 检查该行的装饰态是否与上次一致 | Check whether the row's decoration state matches the last time
    const prevRowVm = prevRowMap.get(rowKey)
    const cells = buildRowCells(
      i,
      cols,
      prevRowVm,
      options.isCellEditing,
      options.isCellDirty,
      options.isCellSelected,
    )

    const rowVm: RowViewModel<T> = {
      row,
      rowKey,
      rowIndex: i,
      cells,
    }

    next.push(rowVm)
    newPrevMap.set(rowKey, rowVm)
  }

  // 更新 prevRowMap 供下次 computed 使用
  setPrevRowMap(newPrevMap)

  return next
}

function buildRowCells<T>(
  rowIndex: number,
  columns: ProcessedColumn[],
  prevRowVm: RowViewModel<T> | undefined,
  isCellEditing: (rowIndex: number, colKey: string) => boolean,
  isCellDirty: (rowIndex: number, colKey: string) => boolean,
  isCellSelected: (rowIndex: number, colIndex: number) => boolean,
): readonly CellState[] {
  // 无 prev 时直接构建
  if (!prevRowVm) {
    return buildFreshRowCells(rowIndex, columns, isCellEditing, isCellDirty, isCellSelected)
  }

  const prevCells = prevRowVm.cells
  // 快速路径：逐列比较，若全部未变则复用 prev
  let allUnchanged = true
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]
    const colKey = col.key ?? col.prop ?? ''
    const newIsEditing = isCellEditing(rowIndex, colKey)
    const newIsDirty = isCellDirty(rowIndex, colKey)
    const newIsRangeSelected = isCellSelected(rowIndex, i)

    const prevCell = prevCells[i] ?? EMPTY_CELL_STATE
    if (
      prevCell.isEditing !== newIsEditing
      || prevCell.isDirty !== newIsDirty
      || prevCell.isRangeSelected !== newIsRangeSelected
    ) {
      allUnchanged = false
      break
    }
  }

  if (allUnchanged) {
    return prevCells
  }

  // 有变化时构建新数组 | Build a new array when there is a change
  return buildFreshRowCells(rowIndex, columns, isCellEditing, isCellDirty, isCellSelected)
}

function buildFreshRowCells(
  rowIndex: number,
  columns: ProcessedColumn[],
  isCellEditing: (rowIndex: number, colKey: string) => boolean,
  isCellDirty: (rowIndex: number, colKey: string) => boolean,
  isCellSelected: (rowIndex: number, colIndex: number) => boolean,
): readonly CellState[] {
  const cells: CellState[] = Array.from({ length: columns.length })

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]
    const colKey = col.key ?? col.prop ?? ''
    const isEditing = isCellEditing(rowIndex, colKey)
    const isDirty = isCellDirty(rowIndex, colKey)
    const isRangeSelected = isCellSelected(rowIndex, i)

    // 无装饰态时复用常量，避免创建新对象 | Reuse constants when there is no decoration state, to avoid creating new objects
    if (!isEditing && !isDirty && !isRangeSelected) {
      cells[i] = EMPTY_CELL_STATE
    }
    else {
      cells[i] = { isEditing, isDirty, isRangeSelected }
    }
  }

  return cells
}
