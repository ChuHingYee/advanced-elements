import type { UseSelectionStateEmits } from './selection-types'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'

/**
 * <zh/> 选中变更守卫——抑制 `rowMap` watcher 在选中操作期间的重入剪除。
 * <en/> Selection-mutation guard — suppresses the `rowMap` watcher's re-entrant pruning
 * <en/> while a selection operation is in flight.
 *
 * <zh/> 与 `selection-emit-guard` 的分工：本模块管**变更期重入抑制**（深度计数），
 * <zh/> `selection-emit-guard` 管 **selectionChange 派发去重**（键集指纹）。两者正交，不要混用。
 * <en/> Relation to `selection-emit-guard`: this module handles **in-mutation re-entry suppression**
 * <en/> (depth counting); `selection-emit-guard` handles **selectionChange dispatch dedupe**
 * <en/> (key-set fingerprint). They are orthogonal — do not mix them up.
 *
 * @remarks
 * <zh/> 采用**深度计数**而非布尔标志：批量入口（`batchSelectionUpdate`）会在守卫内调用
 * <zh/> 同样带守卫的单行入口（`toggleRowSelection`）。布尔标志会被内层 `finally` 提前复位，
 * <zh/> 导致第 2 行起守卫静默失效——批量操作只在第一行受保护。计数深度与同文件的
 * <zh/> `emitSuspendDepth` 保持一致的可重入语义。
 * <en/> Uses a **depth counter** instead of a boolean: batch entry points
 * <en/> (`batchSelectionUpdate`) call guarded single-row entry points (`toggleRowSelection`)
 * <en/> from inside the guard. A boolean gets reset by the inner `finally`, silently
 * <en/> disabling the guard from the second row onward — the batch would only be protected
 * <en/> on its first row. The counter keeps re-entrant semantics consistent with
 * <en/> `emitSuspendDepth` in the same module.
 */
export interface SelectionMutationGuard {
  /** <zh/> 在守卫作用域内执行（可嵌套） | <en/> Run inside the guard scope (re-entrant) */
  withSelectionGuard: <R>(fn: () => R) => R
  /** <zh/> 是否处于任一守卫作用域内 | <en/> Whether any guard scope is active */
  isMutating: () => boolean
}

/**
 * <zh/> 创建选中变更守卫（独立实例，无模块级共享状态）
 * <en/> Create a selection-mutation guard (per-instance, no module-level shared state)
 */
export function createSelectionMutationGuard(): SelectionMutationGuard {
  let guardDepth = 0

  function withSelectionGuard<R>(fn: () => R): R {
    guardDepth++
    try {
      return fn()
    }
    finally {
      guardDepth--
    }
  }

  return { withSelectionGuard, isMutating: () => guardDepth > 0 }
}

/**
 * <zh/> safeNotify——隔离父监听器异常：父回调抛错时仅 dev 下 devWarn 并吞掉，不重抛。
 * <zh/> 父监听器抛错不得打断 selectedKeys/lastClickedKey 的原子更新，也不得阻断同批后续通知
 * <zh/>（如 select 分支内 onSelectionChange 抛错仍需触发 onSelect/onRowSelected）。
 * <zh/> flush 语义保持 sync 不变，仅收敛抛错面。
 * <en/> safeNotify — isolate parent-listener exceptions: when a parent callback throws,
 * <en/> devWarn in dev only and swallow it without rethrowing.
 * <en/> A throwing parent listener must not break the atomic selectedKeys/lastClickedKey
 * <en/> update nor block subsequent notifications in the same batch (e.g. a throwing
 * <en/> onSelectionChange must still allow onSelect/onRowSelected to fire).
 * <en/> Flush semantics stay sync; only the throw surface is narrowed.
 */
export function safeNotify(fn: (() => void) | undefined, name: string): void {
  if (!fn)
    return
  try {
    fn()
  }
  catch (err) {
    if (isDev) {
      devWarn(`[AdvTable] selection listener "${name}" threw and was swallowed to keep selection state consistent: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}

/**
 * <zh/> safeEmits——内部统一经此派发，四个回调分别包装为吞错版本。
 * <en/> safeEmits — all internal dispatches go through here; each of the four callbacks is wrapped to swallow errors.
 */
export function createSafeEmits<T = any>(emits: UseSelectionStateEmits<T>): UseSelectionStateEmits<T> {
  return {
    onSelectionChange: (rows, meta) => safeNotify(() => emits.onSelectionChange?.(rows, meta), 'onSelectionChange'),
    onSelect: payload => safeNotify(() => emits.onSelect?.(payload), 'onSelect'),
    onSelectAll: selection => safeNotify(() => emits.onSelectAll?.(selection), 'onSelectAll'),
    onRowSelected: payload => safeNotify(() => emits.onRowSelected?.(payload), 'onRowSelected'),
  }
}
