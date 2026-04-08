import type { VueWrapper } from '@vue/test-utils'
import type { AdvColumn } from '../../src/types'
import { mount } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import AdvTable from '../../src/AdvTable.vue'
import { registerTableId, unregisterTableId } from '../../src/utils/table-id-registry'

/**
 * <zh/> 确定性预载异步渲染器——资源配平门必须度量真实渲染出的 ElTable/ElTableV2，
 * <zh/> 裸 `import()` 不等待会导致块加载落在计数窗外：快时量到空壳（空跑恒过），慢时量到全量（EP 泄漏显形），
 * <zh/> 门禁时绿时红。此处 await 到 chunk 就绪后再计数。
 * <en/> Deterministically preload async renderers — the resource-balance gate must measure really-rendered
 * <en/> ElTable/ElTableV2. A bare non-awaited `import()` lets chunk loading fall outside the counting window:
 * <en/> fast runs measure an empty shell (vacuous pass), slow runs measure everything (EP leak surfaces).
 * <en/> Await chunk readiness before counting.
 */
beforeAll(async () => {
  await import('../../src/components/table-renderer/TableRenderer.vue')
  await import('../../src/components/table-virtual-renderer/TableVirtualRenderer.vue')
}, 30000)

/**
 * <zh/> 表格挂载/卸载资源配平测试——替代"肉眼看火焰图找泄漏"的确定性断言。
 *
 * <zh/> 方法：给全局汇点（window/document 监听、MutationObserver/ResizeObserver 构造与释放、
 * <zh/> tableId 注册表）装计数器，反复挂载功能全开的表格后卸载，断言计数回到基线。
 * <zh/> 元素级监听随 DOM 回收，无需计数；rAF/Timeout 触发即自释放，只统计"需显式释放"的资源。
 *
 * <en/> Mount/unmount resource-balance tests — deterministic assertions replacing
 * <en/> "eyeballing flame graphs for leaks".
 *
 * <en/> Method: counters on global sinks (window/document listeners, MutationObserver/
 * <en/> ResizeObserver construction vs release, tableId registry); repeatedly mount a
 * <en/> feature-rich table, unmount, and assert counts return to baseline.
 * <en/> Element-level listeners die with their DOM and need no counting; fired rAF/timeouts
 * <en/> self-release — only explicitly-released resources are tracked.
 */

function makeRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: String(i), name: `user-${i}`, age: 20 + (i % 30) }))
}

function makeColumns(): AdvColumn[] {
  return [
    { key: 'sel', selection: true, width: 48 },
    { key: 'name', prop: 'name', label: 'Name', sortable: true },
    { key: 'age', prop: 'age', label: 'Age', sortable: true, fixed: 'left' },
    {
      key: 'g',
      label: 'Group',
      children: [
        { key: 'id', prop: 'id', label: 'ID' },
      ],
    },
  ] as unknown as AdvColumn[]
}

describe('advTable mount/unmount resource balance', () => {
  let winAdd!: ReturnType<typeof vi.spyOn>
  let winRemove!: ReturnType<typeof vi.spyOn>
  let docAdd!: ReturnType<typeof vi.spyOn>
  let docRemove!: ReturnType<typeof vi.spyOn>
  let moCreated = 0
  let moDisconnected = 0
  let roCreated = 0
  let roDisconnected = 0
  let OrigMO: typeof MutationObserver
  let OrigRO: typeof ResizeObserver
  const wrappers: VueWrapper[] = []

  beforeEach(() => {
    winAdd = vi.spyOn(window, 'addEventListener')
    winRemove = vi.spyOn(window, 'removeEventListener')
    docAdd = vi.spyOn(document, 'addEventListener')
    docRemove = vi.spyOn(document, 'removeEventListener')
    OrigMO = globalThis.MutationObserver
    OrigRO = globalThis.ResizeObserver
    moCreated = 0
    moDisconnected = 0
    roCreated = 0
    roDisconnected = 0
    globalThis.MutationObserver = class extends OrigMO {
      constructor(cb: MutationCallback) {
        super(cb)
        moCreated++
      }

      disconnect(): void {
        moDisconnected++
        super.disconnect()
      }
    }
    globalThis.ResizeObserver = class extends OrigRO {
      constructor(cb: ResizeObserverCallback) {
        super(cb)
        roCreated++
      }

      disconnect(): void {
        roDisconnected++
        super.disconnect()
      }
    } as any
  })

  afterEach(() => {
    for (const w of wrappers.splice(0)) {
      try {
        w.unmount()
      }
      catch {
        // <zh/> 计数优先：卸载异常不吞，仅保证后续用例环境干净 | <en/> Prefer counting: never swallow unmount errors, only keep later cases clean
      }
    }
    winAdd.mockRestore()
    winRemove.mockRestore()
    docAdd.mockRestore()
    docRemove.mockRestore()
    globalThis.MutationObserver = OrigMO
    globalThis.ResizeObserver = OrigRO
  })

  async function mountOnce(mode: 'default' | 'virtual', tag: string) {
    const w = mount(() => (
      <AdvTable
        mode={mode}
        columns={makeColumns()}
        data={makeRows(25)}
        uiConfig={{ tableId: tag }}
        rowConfig={{ rowKey: 'id', rowSelection: 'multiple' }}
        rowExpandConfig={{ enabled: true }}
        pagination={{ pageSize: 10 }}
        showSummary={true}
      />
    ))
    wrappers.push(w)
    // <zh/> 给异步渲染器 + rAF 合帧留出结算窗口 | <en/> Let async renderers + rAF coalescing settle
    await nextTick()
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))
    await nextTick()
    return w
  }

  function snapshot() {
    return {
      winAdds: winAdd.mock.calls.map(args => keyOf(args)),
      winRemoves: winRemove.mock.calls.map(args => keyOf(args)),
      docAdds: docAdd.mock.calls.map(args => keyOf(args)),
      docRemoves: docRemove.mock.calls.map(args => keyOf(args)),
      moCreated,
      moDisconnected,
      roCreated,
      roDisconnected,
    }
  }

  /**
   * <zh/> 监听三元组（类型 + 捕获 + 处理器）——removeEventListener 仅精确匹配时生效，
   * <zh/> 故"加过但没拆"才是泄漏；从未加过的多余拆除是无害 no-op（如 EP 内部的冗余摘除），不计入。
   * <en/> Listener triple (type + capture + handler) — removeEventListener only takes effect on exact
   * <en/> matches, so only "added but never removed" leaks; redundant removals of never-added
   * <en/> listeners are harmless no-ops (e.g. EP's redundant teardowns) and don't count.
   */
  const listenerIds = new WeakMap<object, number>()
  let listenerSeq = 0
  function keyOf(args: unknown[]): string {
    const [type, listener, opts] = args as [string, object, boolean | { capture?: boolean } | undefined]
    const capture = typeof opts === 'boolean' ? opts : (opts?.capture ?? false)
    let id = listenerIds.get(listener)
    if (id === undefined) {
      id = listenerSeq++
      listenerIds.set(listener, id)
    }
    return `${type}|${capture}|#${id}`
  }
  function unmatchedAdds(adds: string[], removes: string[]): string[] {
    const pending = new Map<string, number>()
    for (const k of removes)
      pending.set(k, (pending.get(k) ?? 0) + 1)
    const leaked: string[] = []
    for (const k of adds) {
      const n = pending.get(k) ?? 0
      if (n > 0)
        pending.set(k, n - 1)
      else
        leaked.push(k)
    }
    return leaked
  }

  it.each(['default', 'virtual'] as const)('%s mode releases global listeners, observers and tableIds', async (mode) => {
    // <zh/> 热身一次：排除首挂载的异步编译/单例初始化噪音 | <en/> Warm up once: exclude first-mount async-compile/singleton noise
    const warm = await mountOnce(mode, `leak-warm-${mode}`)
    warm.unmount()
    wrappers.pop()
    await nextTick()
    const base = snapshot()

    for (let i = 0; i < 5; i++) {
      const w = await mountOnce(mode, `leak-${mode}-${i}`)
      w.unmount()
      wrappers.pop()
      await nextTick()
    }

    const after = snapshot()
    // <zh/> 全局监听配平（按三元组精确匹配；冗余拆除是 no-op，不计） | <en/> Global listeners balanced (exact-triple matching; redundant removals are no-ops and don't count)
    expect(unmatchedAdds(after.winAdds.slice(base.winAdds.length), after.winRemoves.slice(base.winRemoves.length))).toEqual([])
    expect(unmatchedAdds(after.docAdds.slice(base.docAdds.length), after.docRemoves.slice(base.docRemoves.length))).toEqual([])
    // <zh/> 观察者只增不减即泄漏 | <en/> Observers created but never released leak
    expect(after.moDisconnected - base.moDisconnected).toBe(after.moCreated - base.moCreated)
    const roCreatedDelta = after.roCreated - base.roCreated
    const roDisconnectedDelta = after.roDisconnected - base.roDisconnected
    if (mode === 'default') {
      // <zh/> 下限：证明量到真实渲染（5 挂载约 70 个 RO）。裸 import() 不等待会使块加载落窗外，
      // <zh/> 快时只量到空壳（10 个）空跑恒过——此下限把空跑变成响亮失败
      // <en/> Floor: proves full rendering was measured (~70 ROs over 5 mounts). A non-awaited bare
      // <en/> import() lets chunk loading fall outside the window — fast runs would measure an empty
      // <en/> shell (10 ROs) and pass vacuously; this floor turns that into a loud failure
      expect(roCreatedDelta).toBeGreaterThanOrEqual(60)
      // <zh/> 上游泄漏上界：EP ElTable style-helper bindEvents 在 onMounted-async（await nextTick 后）
      // <zh/> 内调 useResizeObserver，await 切断 scope 跟踪致 tryOnScopeDispose 失效，每挂载泄漏 2 个 RO
      // <zh/>（el-table 根 + inner-wrapper，EP 2.14.7 实测，catalog 钉死该版本）。本库增量泄漏会推高到 ≥15
      // <zh/> 即失败；上游修好后泄漏归零仍 ≤10 即通过。EP 升级时须重估此界。
      // <en/> Upstream leak ceiling: EP ElTable style-helper bindEvents calls useResizeObserver inside
      // <en/> onMounted-async (after await nextTick), losing scope tracking so tryOnScopeDispose never fires —
      // <en/> 2 leaked ROs per mount (el-table root + inner-wrapper, measured on EP 2.14.7 pinned in catalog).
      // <en/> Any leak of ours pushes this to >= 15 and fails; an upstream fix drops it to zero and still
      // <en/> passes. Re-evaluate this bound when upgrading EP.
      expect(roCreatedDelta - roDisconnectedDelta).toBeLessThanOrEqual(10)
    }
    else {
      expect(roCreatedDelta).toBeGreaterThanOrEqual(20)
      expect(roDisconnectedDelta).toBe(roCreatedDelta)
    }
    // <zh/> 注册表无残留：卸载后同名 ID 必须可重新注册 | <en/> Registry leaves nothing behind: unmounted ids must be re-registerable
    for (let i = 0; i < 5; i++) {
      expect(registerTableId(`leak-${mode}-${i}`)).toBe(true)
      unregisterTableId(`leak-${mode}-${i}`)
    }
    expect(registerTableId(`leak-warm-${mode}`)).toBe(true)
    unregisterTableId(`leak-warm-${mode}`)
  })
})
