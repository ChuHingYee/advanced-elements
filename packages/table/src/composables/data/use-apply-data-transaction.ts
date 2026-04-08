import type { Ref } from 'vue'
import type { DataTransactionReturn } from './use-data-transaction'

/**
 * <zh/> AG Grid 风格的增量数据事务操作集合。
 *
 * <zh/> - `add`：追加到全量数据末尾（保持传入顺序）
 * <zh/> - `update`：按行键定位并整行替换（保持原位置；未命中计入 skipped，不静默丢弃）
 * <zh/> - `remove`：行对象或原始行键均可；按行键定位移除（未命中计入 skipped）
 * <zh/> 三类操作在同一份快照上计算，语义对齐 AG Grid 的 applyTransaction。
 *
 * <en/> AG Grid-style incremental data transaction ops.
 *
 * <en/> - `add`: appended to the end of the full dataset (input order preserved)
 * <en/> - `update`: located by rowKey and replaced whole-row (position preserved; misses counted
 * <en/>   in `skipped`, never silently dropped)
 * <en/> - `remove`: accepts a row object or a raw rowKey; located by rowKey and removed
 * <en/> All three op kinds are computed against the same snapshot, matching AG Grid's applyTransaction semantics.
 */
export interface DataTransactionOps<T> {
  add?: T[]
  update?: T[]
  remove?: Array<T | string | number>
}

/**
 * <zh/> 事务应用结果计数——skipped 包含：update/remove 未命中行键、update 行缺少行键。
 * <en/> Transaction application counters — `skipped` covers update/remove key misses and
 * <en/> update rows lacking a row key.
 */
export interface ApplyTransactionResult {
  added: number
  updated: number
  removed: number
  skipped: number
}

export interface UseApplyDataTransactionOptions<T> {
  /** <zh/> 全量数据源（只读取快照） | <en/> full data source (snapshot read-only) */
  tableData: Ref<T[]> | (() => T[])
  /** <zh/> 写回通道——走既有 update 桥（自动区分 request 域 / v-model 域） | <en/> write-back channel — reuses the existing update bridge (request vs v-model domain resolved internally) */
  writeFull: (data: T[]) => void
  /** <zh/> 行键提取函数 | <en/> row-key extractor */
  rowKeyFn: (row: T) => string
  /** <zh/> 既有数据事务内核（veto/rollback/事件发射） | <en/> existing data-transaction kernel (veto/rollback/event emission) */
  dataTransaction: DataTransactionReturn
}

export interface UseApplyDataTransactionReturn<T> {
  /**
   * <zh/> 应用一次增量事务。**不支持消费方否决**（模板 return false 生产不生效，beforeHook 为内部注入点）；
   * <zh/> 写入后依次派发 dataChange / afterDataChange，失败可用公开 rollbackLast 回滚。
   * <zh/> **行数据不可变**：`update` 整行替换（保持原位置），派生缓存（合并映射/行视图/脏标记）以行对象引用
   * <zh/> 为失效依据——绕过本函数直接原地修改行对象（`row.name = 'x'`）不会触发重算，缓存保持陈旧。
   * <zh/> @param reason - 事件与审计用原因标识，默认 'transaction'
   * <zh/> @returns 成功时返回计数；被内部守卫拒绝/竞态失败返回 null
   * <en/> Apply one incremental transaction. No consumer-side veto (a template `false` never vetoes in
   * <en/> production; beforeHook is an internal injection point); emits dataChange then afterDataChange
   * <en/> after writing; the public rollbackLast undoes it.
   * <en/> **Row immutability**: `update` replaces whole rows (position preserved); derived caches
   * <en/> (span maps / row views / dirty marks) key off row-object identity — mutating a row in place
   * <en/> (`row.name = 'x'`) bypassing this function never triggers recomputation and leaves caches stale.
   * <en/> @returns counters on success; null when an internal guard refused or a race was lost.
   */
  applyTransaction: (op: DataTransactionOps<T>, reason?: string) => Promise<ApplyTransactionResult | null>
}

/**
 * <zh/> 从行或原始行键中解析行键 | <en/> Resolve a row key from either a row object or a raw key
 */
function resolveKey<T>(entry: T | string | number, rowKeyFn: (row: T) => string): string {
  if (entry != null && typeof entry === 'object')
    return rowKeyFn(entry as T)
  return String(entry)
}

/**
 * <zh/> 增量数据事务组装器——在既有 update 桥（按行键合并）与数据事务内核（veto/rollback/事件）
 * <zh/> 之上提供 AG Grid 风格的 applyTransaction(add/update/remove)。纯组装逻辑，
 * <zh/> 不直接触碰响应式状态与事件，全部委托给注入的两个依赖，保证与既有写路径零分叉。
 *
 * <en/> Incremental data-transaction assembler — provides AG Grid-style applyTransaction(add/update/
 * <en/> remove) atop the existing update bridge (row-key merge) and the data-transaction kernel
 * <en/> (veto/rollback/events). Pure assembly logic: it never touches reactive state or events
 * <en/> directly, delegating entirely to the two injected dependencies so the write path stays singular.
 */
export function useApplyDataTransaction<T>(
  options: UseApplyDataTransactionOptions<T>,
): UseApplyDataTransactionReturn<T> {
  const { tableData, writeFull, rowKeyFn, dataTransaction } = options

  async function applyTransaction(
    op: DataTransactionOps<T>,
    reason = 'transaction',
  ): Promise<ApplyTransactionResult | null> {
    const current = typeof tableData === 'function' ? tableData() : tableData.value
    const result: ApplyTransactionResult = { added: 0, updated: 0, removed: 0, skipped: 0 }

    // <zh/> 统一在原始快照上定位——更新/删除使用原索引域，互不干扰；删除延后统一执行避免索引位移
    // <en/> Locate everything on the original snapshot — updates/removals share the original index
    // <en/> domain without interfering; removals are deferred and batched to avoid index shifts
    const keyToIndex = new Map<string, number>()
    for (let i = 0; i < current.length; i++)
      keyToIndex.set(rowKeyFn(current[i]), i)

    let next = current.slice()
    const removeIndices = new Set<number>()

    if (op.update) {
      for (const row of op.update) {
        const idx = keyToIndex.get(rowKeyFn(row))
        if (idx == null || idx < 0) {
          result.skipped++
          continue
        }
        next[idx] = row
        result.updated++
      }
    }

    if (op.remove) {
      for (const entry of op.remove) {
        const idx = keyToIndex.get(resolveKey(entry, rowKeyFn))
        if (idx == null || idx < 0 || removeIndices.has(idx)) {
          result.skipped++
          continue
        }
        removeIndices.add(idx)
        result.removed++
      }
      if (removeIndices.size > 0)
        next = next.filter((_, i) => !removeIndices.has(i))
    }

    if (op.add && op.add.length > 0) {
      next = next.concat(op.add)
      result.added += op.add.length
    }

    const unchanged = result.added === 0 && result.updated === 0 && result.removed === 0
    if (unchanged)
      return result

    const ok = await dataTransaction.executeTransaction(
      reason,
      current,
      next,
      data => writeFull(data as T[]),
    )
    return ok ? result : null
  }

  return { applyTransaction }
}
