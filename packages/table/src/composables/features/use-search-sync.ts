import type { Ref, ShallowRef } from 'vue'
import { nextTick, watch } from 'vue'
import { shallowEqual } from '../../utils/equality'

/**
 * <zh/> searchParams ↔ searchValuesModel 双向同步
 * <en/> searchParams ↔ searchValuesModel two-way sync
 *
 * @remarks
 * <zh/> 使用布尔锁防止循环更新：写入方持锁，nextTick 后释放；锁窗口内到达的外部写入暂存并在释放后补刷，不静默丢弃
 * <zh/> 写入前必须做 `shallowEqual` 值比较（幂等闸门）：两侧每次都写入 `{ ...val }` 新对象，
 * <zh/> 引用比较下"内容相同"也会持续触发对方 watcher。当同一 model 被多个表格实例共享时
 * <zh/>（demo 4.7 即 Default + Virtual 双绑定），两个实例会互相回写形成 ping-pong 微任务死循环，
 * <zh/> 表单表现为卡死；幂等闸门使内容相同的写入被短路，链路必然收敛。
 * <en/> Uses boolean lock to prevent circular updates: writer holds the lock, releases after nextTick;
 * <en/> external writes arriving in the lock window are queued and flushed on release instead of being dropped.
 * <en/> Every write is gated by `shallowEqual` first (idempotence gate): both sides always assign a fresh
 * <en/> `{ ...val }`, so under reference comparison even an identical write keeps waking the peer's watcher.
 * <en/> When one model is shared by multiple table instances (demo 4.7 binds Default + Virtual to the same
 * <en/> model), those instances ping-pong each other into a microtask livelock that freezes the form.
 * <en/> Gating equal-content writes makes the chain provably terminate.
 *
 * @param searchParams - <zh/> 内部搜索参数 ref | <en/> internal search params ref
 * @param searchValuesModel - <zh/> 外部双向绑定的搜索值 model ref | <en/> externally bound search values model ref
 */
export function useSearchSync(
  searchParams: ShallowRef<Record<string, unknown>>,
  searchValuesModel: Ref<Record<string, unknown> | undefined>,
): void {
  let searchSyncLock = false
  let pendingExternal: Record<string, unknown> | null = null

  function flushPendingExternal(): void {
    if (pendingExternal == null || searchSyncLock)
      return
    const next = pendingExternal
    pendingExternal = null
    if (shallowEqual(searchParams.value, next))
      return
    searchSyncLock = true
    searchParams.value = { ...next }
    nextTick(() => {
      searchSyncLock = false
      // 锁期间又到达的外部写入在下一轮 flush
      if (pendingExternal != null)
        flushPendingExternal()
    })
  }

  /**
   * <zh/> 调度解锁——无条件释放，不设 cancelled 门控。
   * <zh/> watcher 重入时前一次 tick 可能被取消而不释放锁，而重入回调走暂存/幂等分支时又不排新 tick，
   * <zh/> 有条件释放会在此路径永久漏锁导致表单冻结，故释放必须是无条件的。
   * <zh/> 无条件释放是安全的：所有写入均有 shallowEqual 幂等闸门，多余的释放/补刷只会收敛，不会形成循环。
   * <en/> Schedule unlock — unconditional release, no cancelled gate.
   * <en/> A re-entered watcher may cancel the previous tick without unlocking, while the re-entrant run
   * <en/> takes the queue/idempotence branch and schedules no replacement tick — a conditional release
   * <en/> would leak the lock permanently on this path and freeze the form, so the release is unconditional.
   * <en/> Unconditional release is safe: every write is idempotence-gated by shallowEqual,
   * <en/> so redundant releases/flushes converge instead of looping.
   */
  function scheduleUnlock(): void {
    nextTick(() => {
      searchSyncLock = false
      // 释放后若有被暂存的外部写入，立即补刷，避免静默丢失
      flushPendingExternal()
    })
  }

  watch(searchParams, (val) => {
    if (searchValuesModel.value === undefined)
      return
    // 幂等闸门：内容与 model 一致时不回写，否则与外部写入互为回声形成 ping-pong
    if (shallowEqual(searchValuesModel.value, val))
      return
    searchSyncLock = true
    searchValuesModel.value = { ...val }
    scheduleUnlock()
  })

  watch(searchValuesModel, (val) => {
    if (val == null)
      return
    if (searchSyncLock) {
      // 锁窗口内到达的外部写入暂存而非丢弃，并兜底调度一次补刷——
      // 若持锁者的 tick 已被重入取消，此 tick 保证暂存值仍能落定，不冻结。
      pendingExternal = { ...val }
      nextTick(() => flushPendingExternal())
      return
    }
    // 幂等闸门：内容与内部搜索参数一致时不写入，避免无谓的重新过滤
    if (shallowEqual(searchParams.value, val))
      return
    searchSyncLock = true
    searchParams.value = { ...val }
    scheduleUnlock()
  })
}
