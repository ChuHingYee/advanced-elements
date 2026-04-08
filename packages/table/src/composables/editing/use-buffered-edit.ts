/**
 * <zh/> 批量编辑 Composable
 * <en/> Batch edit composable
 *
 * @remarks
 * <zh/> 缓冲单元格变更而不写入数据源。仅在显式调用 commitBatchEdit 时应用变更。取消操作将丢弃所有缓冲的变更
 * <en/> Buffers cell changes without writing them to the data source. Changes are only applied when commitBatchEdit is called explicitly. Canceling discards all buffered changes
 */
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { EditConfig } from '../../types/edit'
import { computed, shallowRef, toValue } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { buildKeyToIndexMap } from '../../utils/shared'

/**
 * <zh/> 批量编辑配置选项
 * <en/> Batch edit configuration options
 *
 * @remarks
 * <zh/> 定义批量编辑所需的数据源、行键函数、编辑配置、数据更新回调和可选校验函数
 * <en/> Defines the data source, row key function, edit config, data update callback, and optional validation function for batch editing
 *
 * @typeParam T - <zh/> 行数据类型 | <en/> row data type
 */
export interface UseBufferedEditOptions<T = any> {
  /** <zh/> 表格数据（计算属性），用于读取当前数据快照 | <en/> Table data (computed ref), used to read current data snapshot */
  data: ComputedRef<T[]>
  /** <zh/> 行键提取函数，从行数据中提取唯一标识（string）。支持 Ref/getter 以响应运行时 rowKey 变更 | <en/> Row key extraction function, extracts unique identifier (string) from row data. Supports Ref/getter to respond to runtime rowKey changes */
  rowKeyFn: MaybeRefOrGetter<(row: T) => string>
  /** <zh/> 编辑配置（计算属性），用于判断是否为批量编辑模式 | <en/> Edit config (computed ref), used to determine if batch edit mode is active */
  editConfig: ComputedRef<EditConfig | undefined>
  /** <zh/> 数据更新回调，批量提交后传入新数据数组；source 省略时默认 'view-slice'，因 useBufferedEdit 操作的是可见数据（页切片），由编排器按 rowKey 合并回全量数据 | <en/> Data update callback, receives new data array after batch commit; source defaults to 'view-slice' when omitted, since useBufferedEdit operates on visible data (page slice); the orchestrator merges it back into the full dataset by rowKey */
  onDataUpdate: (newData: T[], source?: 'full' | 'view-slice') => void
  /**
   * <zh/> 批量提交校验函数 — 应用挂起变更前调用。返回 true 允许提交，false 阻止提交
   * <en/> Validation function for batch commit — called before applying pending changes. Return true to allow commit, false to block it
   */
  validateFn?: (stagedData: T[]) => Promise<boolean>
  /**
   * <zh/> 批量提交校验失败回调 — validateFn 返回 false 时触发，供调用方派发结构化错误
   * <en/> Callback invoked when batch commit validation fails (validateFn returns false), for the caller to dispatch structured errors
   */
  onValidationError?: () => void
  /**
   * <zh/> 批量提交成功回调 — 提交完成后携带全部已应用的单元格变更（row 为新值行引用），
   * <zh/> 供编排层派发 cellValueChanged 事件、失效快速筛选缓存并入撤销栈
   * <en/> Batch commit success callback — all applied cell changes (row references the new-value row),
   * <en/> letting the orchestrator emit cellValueChanged, invalidate quick-filter cache and push undo
   */
  onBatchCommitted?: (changes: BufferedCommitChange<T>[]) => void
}

/**
 * <zh/> 批量提交时单个单元格的已应用变更
 * <en/> A single applied cell change at batch commit time
 */
export interface BufferedCommitChange<T = any> {
  /** <zh/> 应用新值后的行对象 | <en/> Row object with the new value applied */
  row: T
  /** <zh/> 行索引（基于提交时数据） | <en/> Row index (based on the data at commit time) */
  rowIndex: number
  /** <zh/> 变更字段名 | <en/> Changed field name */
  prop: string
  /** <zh/> 变更前旧值（记录变更时捕获） | <en/> Old value before the change (captured at record time) */
  oldValue: any
  /** <zh/> 变更后新值 | <en/> New value after the change */
  newValue: any
}

/**
 * <zh/> 批量编辑返回值
 * <en/> Batch edit return value
 *
 * @remarks
 * <zh/> 提供挂起的变更集合、状态标志、记录变更/提交/取消等方法
 * <en/> Provides pending changes collection, status flags, record/commit/cancel methods
 */
export interface UseBufferedEditReturn {
  /** <zh/> 挂起的变更集合，Map<行键, 字段名→新值映射> | <en/> Pending changes collection, Map<rowKey, field→newValue> */
  pendingChanges: Ref<Map<string | number, Record<string, any>>>
  /** <zh/> 是否有未提交的挂起变更 | <en/> Whether there are uncommitted pending changes */
  hasPendingChanges: ComputedRef<boolean>
  /** <zh/> 记录单元格变更，参数：行键、属性名、新值、旧值（可选，用于撤销与事件） | <en/> Record a cell change, params: rowKey, prop, newValue, oldValue (optional, for undo and events) */
  recordChange: (rowKey: string | number, prop: string, newValue: any, oldValue?: any) => void
  /** <zh/> 提交所有挂起的变更到数据源 | <en/> Commit all pending changes to the data source */
  commitBatchEdit: () => Promise<void>
  /** <zh/> 取消所有挂起的变更，清空缓冲区 | <en/> Cancel all pending changes, clear the buffer */
  cancelBatchEdit: () => void
  /** <zh/> 当前是否为批量编辑模式（editType === 'batch'） | <en/> Whether batch edit mode is active (editType === 'batch') */
  isBatchEdit: ComputedRef<boolean>
  /** <zh/> 合并 pendingChanges 后的展示数据 — 渲染器使用此数据以显示暂存的变更 | <en/> Display data after merging pendingChanges — renderer uses this data to show staged changes */
  displayData: ComputedRef<any[]>
}

/**
 * <zh/> 批量编辑组合式函数
 * <en/> Composable for batch editing
 *
 * @remarks
 * <zh/> 缓冲单元格变更，显式提交或取消，不直接写入数据源
 * <en/> Buffers cell changes, explicit commit or cancel, does not write directly to the data source
 *
 * @param options - <zh/> 批量编辑配置 | <en/> batch edit options
 * @returns <zh/> 批量编辑方法与状态 | <en/> batch edit methods and state
 * @example
 * ```ts
 * const batchEdit = useBufferedEdit({
 *   data: tableData,
 *   rowKeyFn: row => row.id,
 *   editConfig: computed( => props.editConfig),
 *   onDataUpdate: (newData) => { data.value = newData },
 * })
 * ```
 */
export function useBufferedEdit<T = any>(options: UseBufferedEditOptions<T>): UseBufferedEditReturn {
  const { data, editConfig, onDataUpdate, validateFn, onValidationError, onBatchCommitted } = options
  const rowKeyFn = computed(() => toValue(options.rowKeyFn))

  const pendingChanges = shallowRef<Map<string | number, Record<string, any>>>(new Map())
  /**
   * <zh/> 挂起变更的旧值快照 Map（rowKey → prop → oldValue），与 pendingChanges 并行维护。
   * <zh/> 提交时用于构造 cellValueChanged / 撤销记录；不并入 public pendingChanges 以免破坏既有 API 形状
   * <en/> Old-value snapshot Map (rowKey → prop → oldValue) maintained in parallel with pendingChanges.
   * <en/> Used at commit time for cellValueChanged / undo records; kept out of the public pendingChanges to preserve its API shape
   */
  const pendingOldValues = shallowRef<Map<string | number, Record<string, any>>>(new Map())

  const isBatchEdit = computed(() => editConfig.value?.editType === 'batch')

  const hasPendingChanges = computed(() => pendingChanges.value.size > 0)

  /**
   * <zh/> keyToIndex Map 缓存——仅在 data 引用变化时重建，避免每次 pendingChanges 变更都 O(n) 遍历
   * <en/> keyToIndex Map cache — only rebuild when data reference changes, avoids O(n) traversal on every pendingChanges change
   * @remarks
   * <zh/> 批量编辑场景下用户可能连续编辑多个单元格，每次 recordChange 都会触发 displayData 重算
   * <en/> In batch edit mode, users may edit multiple cells consecutively, each recordChange triggers displayData recomputation
   */
  let cachedKeyToIndex: Map<string, number> | null = null
  let cachedDataRef: T[] | null = null
  let cachedRowKeyFn: ((row: T) => string) | null = null

  /**
   * <zh/> 合并 pendingChanges 后的展示数据 — 渲染器使用此数据以显示暂存的变更
   * <en/> Display data after merging pendingChanges — renderer uses this to show staged changes
   * @remarks
   * <zh/> 仅在批量编辑模式且有挂起变更时才创建新数组，避免不必要的重渲染。
   * keyToIndex Map 在 data 引用不变时复用缓存，将每次编辑的开销从 O(n+m) 降为 O(m)
   * <en/> Only creates a new array in batch edit mode with pending changes, avoiding unnecessary re-renders.
   * keyToIndex Map reuses cache when data reference is unchanged, reducing per-edit cost from O(n+m) to O(m)
   */
  const displayData = computed<T[]>(() => {
    if (!isBatchEdit.value || pendingChanges.value.size === 0)
      return data.value
    // 仅在 data 引用或 rowKeyFn 变化时重建 Map（rowKeyFn 支持运行时变更，忽略会导致索引错位）
    // Only rebuild Map when data reference or rowKeyFn changes (rowKeyFn supports runtime changes; ignoring it would misalign indices)
    if (cachedDataRef !== data.value || cachedRowKeyFn !== rowKeyFn.value) {
      cachedDataRef = data.value
      cachedRowKeyFn = rowKeyFn.value
      cachedKeyToIndex = buildKeyToIndexMap(data.value, rowKeyFn.value)
    }
    const result = [...data.value]
    for (const [key, changes] of pendingChanges.value) {
      const rowIndex = cachedKeyToIndex!.get(String(key)) ?? -1
      if (rowIndex >= 0) {
        result[rowIndex] = { ...(result[rowIndex] as Record<string, unknown>), ...changes } as T
      }
    }
    return result
  })

  function recordChange(rowKey: string | number, prop: string, newValue: any, oldValue?: any): void {
    const existing = pendingChanges.value.get(rowKey) ?? {}
    const newMap = new Map(pendingChanges.value)
    newMap.set(rowKey, { ...existing, [prop]: newValue })
    pendingChanges.value = newMap
    // 捕获旧值快照，供提交时构造 cellValueChanged / 撤销记录（无旧值时跳过）
    // Capture old-value snapshot for cellValueChanged / undo records at commit time (skipped when absent)
    if (oldValue !== undefined) {
      const existingOld = pendingOldValues.value.get(rowKey) ?? {}
      /**
       * <zh/> 首次记录胜出（first-wins）：同一单元格在提交前被多次编辑时，仅保留最初的旧值。
       * <zh/> 无条件覆盖会把中间值当作 oldValue，导致撤销只能回到中间态、cellValueChanged 的 oldValue 错误。
       * <en/> First record wins: when the same cell is edited multiple times before commit,
       * <en/> only the original old value is kept. Unconditional overwrite would treat an
       * <en/> intermediate value as oldValue, breaking undo and cellValueChanged.
       */
      if (!(prop in existingOld)) {
        pendingOldValues.value = new Map(pendingOldValues.value).set(rowKey, { ...existingOld, [prop]: oldValue })
      }
    }
  }

  async function commitBatchEdit(): Promise<void> {
    if (pendingChanges.value.size === 0)
      return

    if (validateFn) {
      const valid = await validateFn(displayData.value)
      if (!valid) {
        // 校验失败时通知调用方，供其派发结构化错误（如 emit('error')）
        // Notify caller on validation failure so it can dispatch structured errors (e.g. emit('error'))
        onValidationError?.()
        return
      }
    }

    const newData = [...data.value]
    /** <zh/> 构建 key→index Map 做 O(1) 查找，避免对每个 pendingChange 做 O(n) findIndex | <en/> Build key→index Map for O(1) lookup, avoids O(n) findIndex for each pendingChange */
    const keyToIndex = buildKeyToIndexMap(newData, rowKeyFn.value)
    const missing: Array<string | number> = []
    const committed: BufferedCommitChange<T>[] = []
    for (const [key, changes] of pendingChanges.value) {
      const rowIndex = keyToIndex.get(String(key)) ?? -1
      if (rowIndex >= 0) {
        newData[rowIndex] = { ...(newData[rowIndex] as Record<string, unknown>), ...changes } as T
        const oldValues = pendingOldValues.value.get(key) ?? {}
        for (const prop of Object.keys(changes)) {
          committed.push({
            row: newData[rowIndex],
            rowIndex,
            prop,
            oldValue: oldValues[prop],
            newValue: changes[prop],
          })
        }
      }
      else {
        missing.push(key)
      }
    }
    if (missing.length > 0 && isDev) {
      devWarn(
        `[AdvTable] batch 提交时 ${missing.length} 行未在数据中找到（key: ${missing.join(', ')}），已跳过。`,
        `Batch commit skipped ${missing.length} row(s) not found in data (keys: ${missing.join(', ')}).`,
      )
    }
    onDataUpdate(newData)
    pendingChanges.value = new Map()
    pendingOldValues.value = new Map()
    // 提交后再通知——与单格路径一致，回调收到时数据已落地
    // Notify after commit — consistent with the single-cell path, data is already applied when the callback runs
    onBatchCommitted?.(committed)
  }

  function cancelBatchEdit(): void {
    pendingChanges.value = new Map()
    pendingOldValues.value = new Map()
  }

  return {
    pendingChanges,
    hasPendingChanges,
    recordChange,
    commitBatchEdit,
    cancelBatchEdit,
    isBatchEdit,
    displayData,
  }
}
