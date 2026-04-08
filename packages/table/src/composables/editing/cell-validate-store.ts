import type { ValidateError } from '../../types/edit'
import { shallowRef } from 'vue'

/**
 * <zh/> 校验错误存储依赖 | <en/> Validation error-store deps
 */
export interface CellValidateStoreDeps<T = any> {
  rowKeyFnGetter?: () => ((row: T) => string) | undefined
}

/**
 * <zh/> 校验错误存储——errorMap（O(1) 键值存取）+ errors shallowRef 同步、rowKey 键域统一、
 * <zh/> epoch/isValidatingAll 竞态标志与全部清除/查询 API。
 *
 * <zh/> 自 use-cell-validate.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 C），主体逐字未改；
 * <zh/> epoch/isValidatingAll 由 let 改为 { value } 持有对象（跨模块共享可变标志）。
 * <en/> Validation error store — the errorMap (O(1) keyed store) + errors shallowRef sync,
 * <en/> the rowKey key-domain unification, the epoch/isValidatingAll race flags and every
 * <en/> clear/query API.
 *
 * <en/> Migrated verbatim from use-cell-validate.ts (COMPLEXITY-PLAN battle line 3, knife C);
 * <en/> epoch/isValidatingAll move from `let` booleans to `{ value }` holders (shared mutable flags).
 */
export function useCellValidateStore<T = any>(deps: CellValidateStoreDeps<T>) {
  const { rowKeyFnGetter } = deps

  /**
   * <zh/> 从 rowIndex 推导 rowKey——优先使用 rowKeyFn，不可用时回退到 rowIndex。
   *
   * <zh/> **键域统一为 string**：错误键与 UI 匹配（`cell-edit-trigger` 用 `rowKeyFn(row)` 求值后
   * <zh/> 与 `error.rowKey` 做 `===` 比较）必须在同一键域。此前回退分支返回 number，且错误键是
   * <zh/> `string | number`，一旦某条错误的 rowKey 为 number 就会比较失败，错误提示静默丢失。
   * <en/> Derive rowKey from rowIndex — prefers rowKeyFn, falls back to rowIndex.
   *
   * <en/> **The key domain is uniformly string**: the error key and the UI matcher (which compares
   * <en/> `rowKeyFn(row)` against `error.rowKey` with `===` in `cell-edit-trigger`) must share one domain.
   * <en/> The fallback branch used to return a number and the error key was `string | number`, so any error
   * <en/> carrying a numeric rowKey silently failed the comparison and never displayed.
   */
  function resolveRowKey(rowIndex: number, rowData?: unknown): string {
    const fn = rowKeyFnGetter?.()
    if (fn && rowData != null)
      return String(fn(rowData as T))
    return String(rowIndex)
  }

  function errorKey(rowKey: string | number, columnKey: string): string {
    return `${rowKey}:${columnKey}`
  }

  const errorMap = new Map<string, ValidateError>()

  /** 公开错误列表——从 Map 同步，供模板渲染和 provide/inject 消费 */
  const errors = shallowRef<ValidateError[]>([])

  function syncErrors(): void {
    errors.value = Array.from(errorMap.values())
  }

  /** <zh/> 原子更新单个单元格的错误状态——O(1) Map 操作；rowKey 键域统一为 string（B11） | <en/> Atomically update one cell error state — O(1) Map op; rowKey domain uniformly string (B11) */
  function applyCellResult(
    rowIndex: number,
    rowKey: string,
    columnKey: string,
    prop: string,
    message: string | null,
  ): void {
    const key = errorKey(rowKey, columnKey)
    if (message) {
      errorMap.set(key, { rowIndex, rowKey, columnKey, prop, message })
      syncErrors()
    }
    else if (errorMap.has(key)) {
      errorMap.delete(key)
      syncErrors()
    }
  }

  const epoch = { value: 0 }
  /** <zh/> 在飞批量计数——>0 即抑制单格写入；全量清除归零（调用方放弃整轮） | <en/> in-flight bulk count — >0 suppresses single-cell writes; a full clear zeroes it (caller abandons the round) */
  const isValidatingAll = { value: 0 }

  function clearErrors(target?: { rowIndex?: number, columnKey?: string }): void {
    epoch.value++
    // 仅全量清除时重置 isValidatingAll（调用方明确放弃整轮校验，含进行中的 validateAll）。
    // 定向清除不触碰该标志，避免误中止 validateAll 的批量重建。
    // Only a full clear resets isValidatingAll (the caller abandons the whole round,
    // including an in-flight validateAll). Targeted clears leave it untouched so they
    // cannot abort validateAll's batch rebuild.
    if (!target) {
      isValidatingAll.value = 0
      errorMap.clear()
      syncErrors()
      return
    }

    /** 按 target 条件删除 Map 条目——O(n) 遍历 key，但 Map.delete 本身 O(1) */
    const keysToDelete: string[] = []
    for (const [key, err] of errorMap) {
      if (target.rowIndex !== undefined && err.rowIndex !== target.rowIndex)
        continue
      if (target.columnKey !== undefined && err.columnKey !== target.columnKey)
        continue
      keysToDelete.push(key)
    }
    if (keysToDelete.length > 0) {
      for (const key of keysToDelete) {
        errorMap.delete(key)
      }
      syncErrors()
    }
  }

  /** O(1) Map 查找替代 Array.find 的 O(n) 扫描；跨字段错误按 `__row__:i` 键存储，查询时展开匹配 */
  function getCellError(rowIndex: number, columnKey: string, rowData?: unknown): string | undefined {
    const rk = resolveRowKey(rowIndex, rowData)
    const direct = errorMap.get(errorKey(rk, columnKey))
    if (direct)
      return direct.message
    if (columnKey.startsWith('__row__')) {
      const prefix = `${rk}:__row__:`
      for (const [key, err] of errorMap) {
        if (key.startsWith(prefix) && err.rowKey === rk) {
          return err.message
        }
      }
    }
    return undefined
  }

  function clearRowCrossFieldErrors(rowIndex: number, rowData?: unknown): void {
    const rk = resolveRowKey(rowIndex, rowData)
    let changed = false
    for (const [key, err] of errorMap) {
      if ((err.rowKey ?? err.rowIndex) === rk && err.prop === '__crossField__') {
        errorMap.delete(key)
        changed = true
      }
    }
    if (changed)
      syncErrors()
  }

  function clearRowErrors(rowIndex: number, rowData?: unknown): void {
    const rk = resolveRowKey(rowIndex, rowData)
    let changed = false
    for (const [key, err] of errorMap) {
      if ((err.rowKey ?? err.rowIndex) === rk) {
        errorMap.delete(key)
        changed = true
      }
    }
    if (changed)
      syncErrors()
  }

  function clearCellError(rowIndex: number, columnKey: string, rowData?: unknown): void {
    const rk = resolveRowKey(rowIndex, rowData)
    const key = errorKey(rk, columnKey)
    if (errorMap.has(key)) {
      errorMap.delete(key)
      syncErrors()
    }
  }
  return {
    errors,
    errorMap,
    epoch,
    isValidatingAll,
    resolveRowKey,
    errorKey,
    syncErrors,
    applyCellResult,
    clearErrors,
    getCellError,
    clearRowCrossFieldErrors,
    clearRowErrors,
    clearCellError,
  }
}
