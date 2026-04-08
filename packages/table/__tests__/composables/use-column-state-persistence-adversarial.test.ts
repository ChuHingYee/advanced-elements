import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import { useColumnState } from '../../src/composables/columns/use-column-state'

/**
 * <zh/> 列状态持久化对抗用例——损坏存档迁移、整体拒绝、跨模式宽度守卫、
 * <zh/> 防抖合并与落盘时序、错误策略降级。目标是找出问题而非凑覆盖率。
 * <en/> Column-state persistence adversarial cases — corrupted-archive migration, whole-payload
 * <en/> rejection, cross-mode width guard, debounce coalescing and flush timing, error-strategy
 * <en/> downgrades. Aimed at finding problems, not coverage.
 */

function memoryAdapter(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed))
  return {
    store,
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => {
      store.set(k, v)
    }),
    remove: vi.fn(async (k: string) => {
      store.delete(k)
    }),
  }
}

function makeCols() {
  return ref<any[]>([
    { key: 'a', prop: 'a', label: 'A', width: 100 },
    { key: 'b', prop: 'b', label: 'B', hidden: true, fixed: 'left' },
  ])
}

function setupHarness(opts: {
  seed?: Record<string, string>
  persistence?: Record<string, any>
  setSorts?: ReturnType<typeof vi.fn>
} = {}) {
  const adapter = memoryAdapter(opts.seed)
  const onStorageError = vi.fn()
  const localColumns = makeCols()
  const setColumns = vi.fn((cols: any[]) => {
    localColumns.value = cols
  })
  const setSorts = opts.setSorts ?? vi.fn()
  let api!: ReturnType<typeof useColumnState>
  const wrapper = mount(defineComponent({
    setup() {
      api = useColumnState({
        localColumns: localColumns as any,
        sortState: ref([]) as any,
        resetColumns: vi.fn(),
        setColumns,
        setSorts,
        persistence: computed(() => ({
          enabled: true,
          storage: adapter,
          debounce: 5,
          errorStrategy: 'warn',
          onStorageError,
          ...opts.persistence,
        }) as any),
        tableId: () => 't-cols',
      })
      return () => h('div')
    },
  }))
  return { api, wrapper, adapter, onStorageError, localColumns, setColumns, setSorts }
}

const cleanups: Array<() => void> = []
afterEach(() => {
  while (cleanups.length)
    cleanups.pop()!()
})

function track(wrapper: ReturnType<typeof mount>) {
  cleanups.push(() => wrapper.unmount())
  return wrapper
}

describe('useColumnState persistence (adversarial)', () => {
  it('schema version mismatch discards the archive and removes it from storage', async () => {
    // <zh/> 旧版本存档不得盲目应用：整体清除并从存储移除（否则每次挂载重复失败）
    // <en/> an old-version archive must not be applied blindly: cleared and removed from storage
    const legacy = JSON.stringify([{ colId: 'a', width: 999, schemaVersion: -1 }])
    const { adapter, localColumns } = setupHarness({ seed: { 'adv-table-cols-t-cols': legacy } })
    await new Promise(r => setTimeout(r, 20))
    expect(adapter.remove).toHaveBeenCalled()
    expect(localColumns.value[0]!.width).toBe(100)
  })

  it('applyColumnState rejects an invalid payload WHOLESALE (no partial application)', () => {
    // <zh/> 顺序/显隐/固定是一致性快照：一条非法（width: -5）即整体拒绝，
    // <zh/> 部分应用会把布局停在半迁移态
    // <en/> order/visibility/pinning form a consistency snapshot: one invalid item (width: -5)
    // <en/> rejects the whole payload — partial application leaves the layout half-migrated
    const { api, localColumns } = setupHarness()
    api.applyColumnState([
      { colId: 'a', width: 200 },
      { colId: 'b', width: -5 },
    ] as any)
    expect(localColumns.value[0]!.width).toBe(100)
    expect(localColumns.value[1]!.hidden).toBe(true)
  })

  it('cross-mode stored width is skipped while hidden/fixed still apply', () => {
    // <zh/> default/virtual 宽度语义不同：mode 失配跳过 width 应用，其余字段照常
    // <en/> default/virtual width semantics differ: on mode mismatch width is skipped, other fields apply
    // <zh/> 守卫依赖 mode getter（currentMode !== undefined 才比对）——生产装配必接，
    // <zh/> 未接时守卫静默关闭（已记录为集成注意事项）
    // <en/> the guard needs the mode getter (only compares when currentMode !== undefined) —
    // <en/> production always wires it; leaving it unwired silently disables the guard (noted)
    const tableId = ref('t-cols')
    const adapter = memoryAdapter()
    const onStorageError = vi.fn()
    const localColumns = makeCols()
    let api!: ReturnType<typeof useColumnState>
    const wrapper = mount(defineComponent({
      setup() {
        api = useColumnState({
          localColumns: localColumns as any,
          sortState: ref([]) as any,
          resetColumns: vi.fn(),
          setColumns: vi.fn(),
          setSorts: vi.fn(),
          persistence: computed(() => ({
            enabled: true,
            storage: adapter,
            debounce: 5,
            errorStrategy: 'warn',
            onStorageError,
          }) as any),
          tableId: () => tableId.value,
          mode: () => 'default',
        })
        return () => h('div')
      },
    }))
    track(wrapper)
    api.applyColumnState([
      { colId: 'a', width: 200, hidden: false, mode: 'virtual' },
      { colId: 'b', hidden: false, mode: 'virtual' },
    ] as any)
    expect(localColumns.value[0]!.width).toBe(100)
    expect(localColumns.value[0]!.hidden).toBe(false)
    expect(localColumns.value[1]!.hidden).toBe(false)
  })

  it('include whitelist persists only the listed props', async () => {
    const { api, adapter } = setupHarness({ persistence: { include: ['colId', 'width'] } })
    api.getColumnState()
    api.applyColumnState([{ colId: 'a', width: 250 }] as any)
    await new Promise(r => setTimeout(r, 20))
    const saved = JSON.parse(adapter.store.get('adv-table-cols-t-cols')!) as any[]
    // <zh/> 白名单外的 hidden/fixed 不落盘 | <en/> non-whitelisted hidden/fixed never persist
    expect(saved[0]!.width).toBe(250)
    expect('hidden' in saved[0]!).toBe(false)
    expect('fixed' in saved[0]!).toBe(false)
  })

  it('debounced save coalesces bursts into ONE write; flush persists immediately', async () => {
    vi.useFakeTimers()
    try {
      const { api, adapter, wrapper } = setupHarness({ persistence: { debounce: 50 } })
      track(wrapper)
      // <zh/> 快速连发三次变更 → 防抖合并为一次落盘
      // <en/> three rapid mutations → coalesced into a single persisted write
      api.applyColumnState([{ colId: 'a', width: 120 }] as any)
      api.applyColumnState([{ colId: 'a', width: 130 }] as any)
      api.applyColumnState([{ colId: 'a', width: 140 }] as any)
      expect(adapter.set).not.toHaveBeenCalled()
      vi.advanceTimersByTime(60)
      expect(adapter.set).toHaveBeenCalledTimes(1)
      const saved = JSON.parse(adapter.store.get('adv-table-cols-t-cols')!) as any[]
      expect(saved[0]!.width).toBe(140)

      // <zh/> KeepAlive 停用前的 flush：cancel 会静默丢失防抖窗口内的最后调整
      // <en/> flush before deactivation: cancel would silently drop in-window adjustments
      api.applyColumnState([{ colId: 'a', width: 150 }] as any)
      wrapper.unmount()
      expect(adapter.set).toHaveBeenCalledTimes(2)
      const saved2 = JSON.parse(adapter.store.get('adv-table-cols-t-cols')!) as any[]
      expect(saved2[0]!.width).toBe(150)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('errorStrategy "throw" on the debounced path downgrades to a warn (no unhandled rejection)', async () => {
    vi.useFakeTimers()
    try {
      const adapter = memoryAdapter()
      adapter.set.mockRejectedValue(new Error('quota exceeded'))
      const onStorageError = vi.fn()
      const localColumns = makeCols()
      let api!: ReturnType<typeof useColumnState>
      const wrapper = mount(defineComponent({
        setup() {
          api = useColumnState({
            localColumns: localColumns as any,
            sortState: ref([]) as any,
            resetColumns: vi.fn(),
            setColumns: vi.fn(),
            setSorts: vi.fn(),
            persistence: computed(() => ({
              enabled: true,
              storage: adapter,
              debounce: 5,
              errorStrategy: 'throw',
              onStorageError,
            }) as any),
            tableId: () => 't-cols',
          })
          return () => h('div')
        },
      }))
      track(wrapper)
      // <zh/> applyColumnState 恢复后触发一次保存；'throw' 策略在 setTimeout 内会逃逸错误处理——
      // <zh/> 必须降级为 warn（onStorageError 仍被调用），进程不得收到 unhandled rejection
      // <en/> apply triggers a save; 'throw' inside setTimeout would escape error handling —
      // <en/> it must downgrade to warn (onStorageError still called), no unhandled rejection
      api.applyColumnState([{ colId: 'a', width: 300 }] as any)
      // <zh/> saveState 的 async 续体（reject→catch→handleError）在微任务里——必须异步推进
      // <en/> saveState's async continuation (reject→catch→handleError) lives in microtasks — advance async
      await vi.advanceTimersByTimeAsync(60)
      expect(onStorageError).toHaveBeenCalled()
      const detail = onStorageError.mock.calls[0]?.[0]
      expect(detail.phase).toBe('save')
      expect(detail.domain).toBe('columnState')
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('autoSave: false mutes mutation-triggered saves (explicit saves still possible via apply)', async () => {
    vi.useFakeTimers()
    try {
      const { api, adapter, wrapper } = setupHarness({ persistence: { autoSave: false } })
      track(wrapper)
      api.applyColumnState([{ colId: 'a', width: 180 }] as any)
      vi.advanceTimersByTime(100)
      // <zh/> applyColumnState 的「恢复完成后触发一次保存」也走 autoSaveEnabled 门控
      // <en/> the post-apply save is gated by autoSaveEnabled too
      expect(adapter.set).not.toHaveBeenCalled()
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('storageKey follows a runtime tableId change (getter semantics, not a snapshot)', async () => {
    // <zh/> tableId 以 getter 传入：运行时变更后 storageKey 随之更新——写成快照会串台
    // <en/> tableId is a getter: storageKey follows runtime changes — a snapshot would cross wires
    const tableId = ref('t-1')
    const adapter = memoryAdapter()
    const onStorageError = vi.fn()
    const localColumns = makeCols()
    let api!: ReturnType<typeof useColumnState>
    const wrapper = mount(defineComponent({
      setup() {
        api = useColumnState({
          localColumns: localColumns as any,
          sortState: ref([]) as any,
          resetColumns: vi.fn(),
          setColumns: vi.fn(),
          setSorts: vi.fn(),
          persistence: computed(() => ({
            enabled: true,
            storage: adapter,
            debounce: 5,
            errorStrategy: 'warn',
            onStorageError,
          }) as any),
          tableId: () => tableId.value,
        })
        return () => h('div')
      },
    }))
    track(wrapper)
    api.applyColumnState([{ colId: 'a', width: 210 }] as any)
    await new Promise(r => setTimeout(r, 20))
    expect(adapter.store.has('adv-table-cols-t-1')).toBe(true)

    tableId.value = 't-2'
    api.applyColumnState([{ colId: 'a', width: 220 }] as any)
    await new Promise(r => setTimeout(r, 20))
    expect(adapter.store.has('adv-table-cols-t-2')).toBe(true)
    const saved = JSON.parse(adapter.store.get('adv-table-cols-t-2')!) as any[]
    expect(saved[0]!.width).toBe(220)
  })

  it('unknown colIds in an applied state are skipped without breaking the rest', () => {
    const { api, localColumns } = setupHarness()
    api.applyColumnState([
      { colId: 'ghost', width: 999 },
      { colId: 'a', width: 240 },
    ] as any)
    expect(localColumns.value[0]!.width).toBe(240)
    // <zh/> ghost 不存在于列集 → 无效果、不抛错 | <en/> ghost is not in the column set → no-op, no throw
    expect(localColumns.value).toHaveLength(2)
  })

  it('applied sort entries normalize to data-field props and reach setSorts in sortIndex order', () => {
    // <zh/> sortIndex 决定多列顺序；prop 必须是数据字段（服务端 sort 参数域），columnKey 保留身份
    // <en/> sortIndex orders the multi-sort; prop must be the data field (server sort domain)
    const setSorts = vi.fn()
    const { api } = setupHarness({ setSorts })
    api.applyColumnState([
      { colId: 'b', sort: 'descending', sortIndex: 1 },
      { colId: 'a', sort: 'ascending', sortIndex: 0 },
    ] as any)
    expect(setSorts).toHaveBeenCalledWith([
      { prop: 'a', order: 'ascending' },
      { prop: 'b', order: 'descending' },
    ])
  })
})
