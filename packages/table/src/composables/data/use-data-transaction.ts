/**
 * @file use-data-transaction.ts
 * @description
 * <zh/> 数据变更事务性管理——确保 beforeDataChange → dataChange → afterDataChange 的原子性执行。
 *
 * <zh/> **事务流程**：
 * <zh/> 1. `beforeDataChange` 事件触发——消费方可拦截、验证或修改数据
 * <zh/> 2. 若 beforeDataChange 返回 false 或 Promise<false>，事务中止，旧数据保留
 * <zh/> 3. 数据写入 tableData，触发管线重算
 * <zh/> 4. `dataChange` 事件触发——通知消费方数据已变更
 * <zh/> 5. nextTick 后 `afterDataChange` 事件触发——确保 DOM 已更新
 *
 * <zh/> **竞态防护**：
 * <zh/> 使用事务序号（transactionId）防止并发数据变更互相覆盖。
 * <zh/> 每次 beginTransaction 递增序号，commit 时检查序号是否匹配。
 *
 * <en/> Data change transactional management — ensures atomic execution of
 * <en/> beforeDataChange → dataChange → afterDataChange.
 */
import type { MaybeRefOrGetter } from 'vue'
import type { AdvTableEmitFn } from '../../types/events'
import { nextTick, toValue } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'

export interface DataTransactionOptions {
  /** <zh/> 表格实例 ID | <en/> Table instance ID */
  tableId: MaybeRefOrGetter<string>
  /** <zh/> emit 函数 | <en/> emit function */
  emit: AdvTableEmitFn
  /**
   * <zh/> 真正可用的否决钩子——Vue SFC `emit` 运行时返回 void，监听器 `return false`
   * <zh/> 无法回传，故 SFC 侧否决必须走此钩子（由上层装配拦截器注入）。
   * <en/> The actually-working veto hook — Vue SFC `emit` returns void at runtime,
   * <en/> so a listener's `return false` never propagates; SFC-side veto must use this hook.
   */
  beforeHook?: (params: { reason: string, oldData: unknown[], newData: unknown[], tableId: string }) => boolean | Promise<boolean> | void | Promise<void>
}

/**
 * <zh/> 单次事务执行选项
 * <en/> Per-transaction execution options
 */
export interface ExecuteTransactionOptions {
  /**
   * <zh/> 静默中间事件——跳过 beforeDataChange/afterDataChange，仅发 dataChange。
   * <zh/> 大数据事务降内存峰值（before/after 各持新旧全量数组引用）；代价是放弃 before 拦截中止能力，按需使用。
   * <en/> Silence middle events — skip beforeDataChange/afterDataChange, emit dataChange only.
   * <en/> Lowers the memory peak of large transactions (before/after each retain old+new full arrays); costs the before veto capability. Opt in deliberately.
   */
  silentMiddle?: boolean
}
/**
 * <zh/> 创建数据变更事务管理器 | <en/> Create data change transaction manager
 *
 * <zh/> 事务流程：beforeDataChange → (通过验证) → 写入数据 → dataChange → afterDataChange
 * <en/> Flow: beforeDataChange → (passed) → write data → dataChange → afterDataChange
 *
 * @param options - <zh/> 事务配置 | <en/> transaction config
 * @returns <zh/> 事务执行函数 | <en/> transaction executor function
 */
export function useDataTransaction<T = any>(options: DataTransactionOptions) {
  const { tableId, emit } = options
  let beforeHook = options.beforeHook

  /** <zh/> 事务序号——防止并发事务互相覆盖 | <en/> Transaction sequence — prevents concurrent overwrites */
  let transactionId = 0
  /** <zh/> 正在进行的事务序号集合 | <en/> Set of in-flight transaction IDs */
  const inflightTransactions = new Set<number>()
  /** <zh/> 最近一次已提交事务——rollbackLast 的还原目标 | <en/> Last committed tx — restore target of rollbackLast */
  let lastTransaction: { reason: string, oldData: T[], newData: T[], writeFn: (data: T[]) => void } | null = null

  /**
   * <zh/> 执行数据变更事务
   *
   * <zh/> @param reason - <zh/> 变更原因 | <en/> change reason
   * <zh/> @param oldData - <zh/> 旧数据 | <en/> old data
   * <zh/> @param newData - <zh/> 新数据 | <en/> new data
   * <zh/> @param writeFn - <zh/> 数据写入函数（将 newData 写入 tableData） | <en/> data write function
   * <zh/> @returns <zh/> 是否成功提交 | <en/> whether committed successfully
   *
   * <en/> Execute a data change transaction
   */
  async function executeTransaction(
    reason: string,
    oldData: T[],
    newData: T[],
    writeFn: (data: T[]) => void,
    options?: ExecuteTransactionOptions,
  ): Promise<boolean> {
    const tid = ++transactionId
    const tidStr = toValue(tableId)
    const silentMiddle = options?.silentMiddle === true

    // 1. beforeDataChange — 允许消费方拦截（silentMiddle 下跳过，同时放弃中止能力）
    // <zh/> Vue SFC emit 返回 void，监听器 return false 无法回传生产否决；
    // <zh/> 真正否决走 beforeHook（拦截器注入），emit 仅作通知 + 兼容旧 mock（mock emit 可返回 false）。
    // <en/> Vue SFC emit returns void, so listener `return false` never vetoes in production;
    // <en/> real veto goes via beforeHook, emit stays as notification + legacy mock compat.
    if (!silentMiddle) {
      if (beforeHook) {
        const hookResult: unknown = await Promise.resolve(beforeHook({ reason, oldData, newData, tableId: tidStr }))
        if (hookResult === false)
          return false
      }
      const beforeResult: unknown = await Promise.resolve((emit as unknown as (...args: unknown[]) => unknown)('beforeDataChange', { reason, oldData, newData }, tidStr))
      if (beforeResult === false) {
        if (isDev && !beforeHook)
          devWarn('[AdvTable] beforeDataChange veto via SFC return false is unreliable (Vue emit returns void); wire DataTransactionOptions.beforeHook for production veto.')
        return false
      }
    }

    // 竞态检查：如果在 await 期间有新事务开始，放弃当前事务
    if (tid !== transactionId) {
      return false
    }

    inflightTransactions.add(tid)

    try {
      // 2. 写入数据——写入抛错时尽力还原旧数据（部分写入防护）
      try {
        writeFn(newData)
      }
      catch (err) {
        // <zh/> writeFn 半途失败：数据可能已脏——尽力回写旧数组引用并上报失败。
        // <zh/> 回写本身失败则只能吞掉（避免掩盖原始错误），由调用方日志兜底。
        // <en/> writeFn failed midway: data may be dirty — best-effort restore of the old array
        // <en/> reference and report failure. A failing restore is swallowed (never masks the
        // <en/> original error); caller-side logging covers it.
        try {
          writeFn(oldData)
        }
        catch {
          /* restore best-effort */
        }
        if (isDev && typeof console !== 'undefined') {
          devWarn(`[AdvTable] Transaction "${reason}" write failed; rolled back.`, err)
        }
        return false
      }

      // <zh/> 记录最近一次已提交事务——供 rollbackLast 手动逆向 | <en/> Track last committed tx — for rollbackLast
      lastTransaction = { reason, oldData, newData, writeFn }

      // 3. dataChange 事件
      emit('dataChange', { reason, data: newData }, tidStr)

      // 4. afterDataChange — 在 nextTick 后触发，确保 DOM 已更新（silentMiddle 下跳过）
      if (!silentMiddle) {
        await nextTick()

        // 竞态检查：如果在 await 期间组件已卸载或有新事务，跳过 afterDataChange
        if (tid !== transactionId) {
          return true
        }

        emit('afterDataChange', { reason, data: newData, oldData }, tidStr)
      }

      return true
    }
    finally {
      inflightTransactions.delete(tid)
    }
  }

  /**
   * <zh/> 回滚最近一次已提交的事务：用 oldData 引用重新执行 writeFn。
   * <zh/> 典型用途——宿主异步落库失败后手动还原表格数据（与 saveCells 悲观协议互补的手动档）。
   * <en/> Roll back the last committed transaction by re-running writeFn with the oldData reference.
   * <en/> Typical use — manual data restoration after a failed async host persistence
   * <en/> (the manual counterpart of the saveCells pessimistic protocol).
   */
  function rollbackLast(): boolean {
    const tx = lastTransaction
    if (!tx)
      return false
    try {
      tx.writeFn(tx.oldData)
      lastTransaction = null
      return true
    }
    catch {
      return false
    }
  }

  /**
   * <zh/> 检查是否有事务正在进行 | <en/> Check if any transaction is in-flight
   */
  function hasInflightTransaction(): boolean {
    return inflightTransactions.size > 0
  }

  /**
   * <zh/> 中止所有进行中的事务 | <en/> Abort all in-flight transactions
   */
  function abortAllTransactions(): void {
    transactionId++
    inflightTransactions.clear()
  }

  function setBeforeHook(hook: DataTransactionOptions['beforeHook']): void {
    beforeHook = hook
  }

  return {
    executeTransaction,
    rollbackLast,
    hasInflightTransaction,
    abortAllTransactions,
    setBeforeHook,
  }
}

/** <zh/> 数据事务返回类型——显式 any 实例化，避免默认 unknown 与调用方 T[] 不兼容 | <en/> Data transaction return type — explicit any instantiation to avoid the unknown default clashing with callers' T[] */
export type DataTransactionReturn<T = any> = ReturnType<typeof useDataTransaction<T>>
