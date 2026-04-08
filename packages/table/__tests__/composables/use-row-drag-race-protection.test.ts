import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useRowDrag } from '../../src/composables/interaction/use-row-drag'
import { DEFAULT_RENDERER_CAPS } from '../../src/types/renderer-caps'

/**
 * <zh/> 行拖拽竞态防护回归测试。
 *
 * <zh/> 场景一：beforeDrag 异步守卫期间全量数据被外部替换时，必须中止重排而非以陈旧快照覆写新数据。
 * <zh/> 场景二：目标行未命中（newIndex 越界 / key 查不到 / 同行）时不得将 null 断言为非空喂给
 * <zh/> beforeDrag，也不得按 DOM 顺序盲目覆写；仅按契约透出 onRowDragEnd(targetRow=null)。
 *
 * <zh/> 本文件用可捕获 options 的 useDraggable 替身驱动 onStart/onEnd 生命周期，
 * <zh/> 绕开真实 SortableJS 的 DOM 拖拽模拟。
 *
 * <en/> Row-drag race-protection regression tests.
 *
 * <en/> Case 1: when the full dataset is replaced externally during the async beforeDrag window,
 * <en/> the reorder must abort instead of overwriting new data with a stale snapshot.
 * <en/> Case 2: when the target row cannot be resolved (newIndex out of range / key lookup miss /
 * <en/> same row), null must NOT be asserted into the non-null beforeDrag contract, and data must
 * <en/> not be blindly overwritten by DOM order; only surface onRowDragEnd(targetRow=null).
 *
 * <en/> Drives onStart/onEnd via an options-capturing useDraggable stub, bypassing real
 * <en/> SortableJS DOM drag simulation.
 */
const draggableState = vi.hoisted(() => ({
  options: null as Record<string, any> | null,
}))

vi.mock('vue-draggable-plus', () => {
  return {
    VueDraggable: { name: 'VueDraggable', render: () => null },
    useDraggable: vi.fn((_container: unknown, options: Record<string, any>) => {
      draggableState.options = options
      return { pause: vi.fn(), destroy: vi.fn() }
    }),
    vDraggable: {},
  }
})

interface Harness {
  fullData: ReturnType<typeof ref>
  container: HTMLElement
  items: HTMLElement[]
  onDataReorder: ReturnType<typeof vi.fn>
  onRowDragEndCb: ReturnType<typeof vi.fn>
  beforeDragSpy: ReturnType<typeof vi.fn> | undefined
  opts: Record<string, any>
}

async function createHarness(options?: {
  beforeDrag?: (...args: any[]) => any
  rows?: Array<Record<string, string>>
}): Promise<Harness> {
  const rows = options?.rows ?? [{ id: '1' }, { id: '2' }, { id: '3' }]
  const fullData = ref(rows)
  const container = document.createElement('div')
  const items = rows.map((row) => {
    const el = document.createElement('tr')
    el.setAttribute('data-adv-table-row-key', String(row.id))
    container.appendChild(el)
    return el
  })

  const onDataReorder = vi.fn()
  const onRowDragEndCb = vi.fn()

  useRowDrag({
    rowDraggable: true,
    fullData,
    rowKey: ref((row: any) => String(row.id)),
    getRowMap: () => new Map(fullData.value.map((row: any) => [String(row.id), row])),
    onDataReorder,
    dragLocator: {
      getRowContainer: () => container,
      getCurrentRowKeys: () => fullData.value.map((row: any) => String(row.id)),
      getDragHandleSelector: () => '.drag-handle',
      getDraggableRowSelector: () => 'tr',
      getVisibleRowElements: (container: HTMLElement) => Array.from(container.querySelectorAll<HTMLElement>('tr')),
      getAnimation: () => 150,
      getGhostClass: () => 'ghost',
      getScrollContainer: () => null,
      getRowHeight: () => 48,
      getInsertIndicatorContainer: () => null,
    } as any,
    tableId: 'race-test-table',
    // <zh/> 能力表取代模式布尔量：本组用例覆盖非行虚拟化的 default 提交体制
    // <en/> Capability table replaces the mode boolean: this suite covers the non-virtualized default regime
    caps: DEFAULT_RENDERER_CAPS,
    // <zh/> beforeDrag 类型为 MaybeRefOrGetter——裸传函数会被 toValue 调用，须用 getter 返回回调
    // <en/> beforeDrag is MaybeRefOrGetter — a bare function would be INVOKED by toValue; wrap in a getter
    beforeDrag: (options?.beforeDrag ? () => options.beforeDrag : undefined) as any,
    onRowDragEnd: onRowDragEndCb as any,
  })

  // <zh/> watch(immediate, post) → initRowDrag → nextTick → resolveDragContainer(onReady) → setupDraggable
  await nextTick()
  await nextTick()

  const opts = draggableState.options
  expect(opts).not.toBeNull()

  return { fullData, container, items, onDataReorder, onRowDragEndCb, beforeDragSpy: undefined, opts: opts! }
}

describe('useRowDrag race protection (default mode)', () => {
  beforeEach(() => {
    draggableState.options = null
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.className = ''
  })

  it('commits reorder when beforeDrag passes within a fresh dataset', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const h = await createHarness({ beforeDrag: async () => true })

    h.opts.onStart({ item: h.items[0], oldIndex: 0 })
    h.opts.onEnd({ item: h.items[0], from: h.container, oldIndex: 0, newIndex: 2 })
    await nextTick()
    await nextTick()

    expect(h.onDataReorder).toHaveBeenCalledTimes(1)
    const newData = h.onDataReorder.mock.calls[0][0] as any[]
    expect(newData.map(row => row.id)).toEqual(['1', '2', '3'])
    expect(h.onRowDragEndCb).toHaveBeenCalledTimes(1)
    // <zh/> 仅断言拖拽流程自身无告警；排除裸调用场景下 Vue 的实例级生命周期注册噪音
    // <en/> Assert no drag-flow warnings only; excludes Vue instance-lifecycle registration noise from bare invocation
    expect(warnSpy.mock.calls.some(([msg]) => typeof msg === 'string' && msg.includes('useRowDrag'))).toBe(false)
  })

  it('aborts reorder when fullData is replaced during the async beforeDrag window', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let release!: (value: boolean) => void
    const gate = new Promise<boolean>((resolve) => {
      release = resolve
    })
    const h = await createHarness({ beforeDrag: () => gate })

    h.opts.onStart({ item: h.items[0], oldIndex: 0 })
    // <zh/> drop 发生：此刻守卫捕获 fullData 快照并挂起等待 beforeDrag 结果
    // <en/> Drop happens: the guard snapshots fullData here and suspends awaiting beforeDrag
    h.opts.onEnd({ item: h.items[0], from: h.container, oldIndex: 0, newIndex: 2 })

    // <zh/> 异步窗口期内数据被外部替换（刷新/排序/编辑提交场景）
    // <en/> Data replaced externally during the async window (refresh/sort/edit-commit scenarios)
    h.fullData.value = [{ id: '9', name: 'replacement' }]
    release(true)

    await nextTick()
    await nextTick()

    // <zh/> 陈旧快照不得覆写新数据 | <en/> Stale snapshot must not overwrite new data
    expect(h.onDataReorder).not.toHaveBeenCalled()
    expect(
      warnSpy.mock.calls.some(([msg]) => typeof msg === 'string' && msg.includes('data changed during async beforeDrag')),
    ).toBe(true)
  })

  it('does not invoke beforeDrag with an out-of-range target and surfaces targetRow=null', async () => {
    const beforeDragSpy = vi.fn(() => true)
    const h = await createHarness({ beforeDrag: beforeDragSpy })

    h.opts.onStart({ item: h.items[0], oldIndex: 0 })
    // newIndex=7 越界：originalKeys 只有 3 条，targetKey 解析为空
    h.opts.onEnd({ item: h.items[0], from: h.container, oldIndex: 0, newIndex: 7 })
    await nextTick()

    // <zh/> 修复前：beforeDrag 收到 targetRow:null（类型违约）且 commit 仍按 DOM 顺序覆写数据
    // <en/> Pre-fix: beforeDrag received targetRow:null (contract violation) and commit still overwrote data
    expect(beforeDragSpy).not.toHaveBeenCalled()
    expect(h.onDataReorder).not.toHaveBeenCalled()
    expect(h.onRowDragEndCb).toHaveBeenCalledWith(expect.objectContaining({
      sourceIndex: 0,
      targetRow: null,
      targetIndex: 7,
    }))
  })

  it('does not invoke beforeDrag when the target resolves to the source row (duplicate keys)', async () => {
    const beforeDragSpy = vi.fn(() => true)
    // <zh/> 重复 key：originalKeys=['a','b','b']，oldIndex=1 与 newIndex=2 解析出同一 key 'b'
    // <en/> Duplicate keys: originalKeys=['a','b','b']; oldIndex=1 and newIndex=2 resolve to the same key 'b'
    const h = await createHarness({
      beforeDrag: beforeDragSpy,
      rows: [{ id: 'a' }, { id: 'b' }, { id: 'b' }],
    })

    h.opts.onStart({ item: h.items[1], oldIndex: 1 })
    h.opts.onEnd({ item: h.items[1], from: h.container, oldIndex: 1, newIndex: 2 })
    await nextTick()

    expect(beforeDragSpy).not.toHaveBeenCalled()
    expect(h.onDataReorder).not.toHaveBeenCalled()
    expect(h.onRowDragEndCb).toHaveBeenCalledWith(expect.objectContaining({
      targetRow: null,
    }))
  })
})
