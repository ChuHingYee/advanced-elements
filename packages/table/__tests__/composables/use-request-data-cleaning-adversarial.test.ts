import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useRequestDataCleaning } from '../../src/composables/data/use-request-data-cleaning'
import { resetDevWarnCacheForTests } from '../../src/utils/dev-warn'

/**
 * <zh/> 请求域数据清洗对抗用例——引用稳定性契约（原地变更必须产出新引用）、
 * <zh/> 脏行剔除与键重映射、树分支的空洞语义。目标是找出问题而非凑覆盖率。
 * <zh/> 下游契约：tableData 引用不变时虚拟表不 reset、EP V2 仅监听引用变化——
 * <zh/> 清洗层漏发新引用即静默不刷新。
 * <en/> Request-domain data-cleaning adversarial cases — the reference-stability contract
 * <en/> (in-place mutation MUST produce a fresh reference), dirty-row sweep with key remapping,
 * <en/> and the tree branch's hole semantics. Downstream contract: virtual tables reset on
 * <en/> reference change only, so a missed fresh reference means a silent no-refresh.
 */

function makeCleaning(rows: any[], opts: { childrenKey?: string, hasSource?: boolean } = {}) {
  const hasSource = ref(opts.hasSource ?? true)
  // <zh/> 生产中 useRequest 的 data 是深响应式 ref——原地 push/splice 经数组代理可被追踪；
  // <zh/> shallowRef 下原地变更完全不可见，脚手架必须与生产同型
  // <en/> production useRequest data is a deep reactive ref — in-place push/splice is tracked via
  // <en/> the array proxy; a shallowRef makes in-place mutations invisible, so the harness matches
  const responseData = ref<any[]>(rows)
  const rowKeyFn = () => (r: any) => r.id
  const childrenKey = opts.childrenKey ? () => opts.childrenKey : undefined
  const api = useRequestDataCleaning<any>({
    hasSource,
    responseData,
    defaultData: undefined,
    rowKeyFn,
    childrenKey,
  })
  return { api, responseData, hasSource }
}

afterEach(() => {
  resetDevWarnCacheForTests()
  vi.restoreAllMocks()
})

describe('use-request-data-cleaning (adversarial)', () => {
  it('same-ref in-place push produces a FRESH tableData reference (downstream reset contract)', () => {
    // <zh/> 原地 push：长度变化 → 快路径失效 → 必须产出新数组引用，
    // <zh/> 否则虚拟表（仅监听引用变化 reset）感知不到新行
    // <en/> in-place push: length change invalidates the fast path → a fresh array reference is
    // <en/> mandatory, or virtual tables (reference-triggered reset) never see the new rows
    const rows = [{ id: '1' }]
    const { api, responseData } = makeCleaning(rows)
    const before = api.tableData.value
    responseData.value.push({ id: '2' })
    void api.tableData.value
    const after = api.tableData.value
    expect(after).not.toBe(before)
    expect(after).toHaveLength(2)
  })

  it('same-ref in-place reverse (same length, reordered) fails the identity check and rebuilds', () => {
    // <zh/> 同引用同长度的 reverse/sort：逐项身份比对发现顺序变化 → 不得复用 prev
    // <en/> same-ref same-length reverse/sort: per-item identity check catches the reorder → prev not reused
    const rows = [{ id: '1' }, { id: '2' }, { id: '3' }]
    const { api, responseData } = makeCleaning(rows)
    void api.tableData.value
    const before = api.tableData.value
    responseData.value.reverse()
    const after = api.tableData.value
    expect(after).not.toBe(before)
    expect(after[0]!.id).toBe('3')
  })

  it('same ref + same length + identical element refs reuses prev (reference stability preserved)', () => {
    // <zh/> 无变化的重复求值必须复用 prev——否则下游 computed 全链路无谓重算
    // <en/> unchanged re-evaluation must reuse prev — or every downstream computed re-runs needlessly
    const rows = [{ id: '1' }, { id: '2' }]
    const { api } = makeCleaning(rows)
    const first = api.tableData.value
    const second = api.tableData.value
    expect(second).toBe(first)
    expect(api.rowKeyMeta.value).toBe(api.rowKeyMeta.value)
  })

  it('top-level null rows are dropped, warned once, and keyToIndex remaps to cleaned positions', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const rows: any[] = [{ id: '1' }, null, { id: '3' }, undefined, { id: '5' }]
    const { api, responseData } = makeCleaning(rows)
    void api.tableData.value
    // <zh/> 脏行剔除：cleaned 不含空洞，键映射按 cleaned 位置（1→0、3→1、5→2）
    // <en/> dirty sweep: cleaned has no holes; key map addresses cleaned positions
    expect(api.tableData.value.map(r => r.id)).toEqual(['1', '3', '5'])
    const meta = api.rowKeyMeta.value
    expect(meta.keyToIndex.get('1')).toBe(0)
    expect(meta.keyToIndex.get('3')).toBe(1)
    expect(meta.keyToIndex.get('5')).toBe(2)
    // <zh/> dev 告警指出丢弃数量（一次性，同一引用不重复刷屏）
    // <en/> dev warn names the dropped count (once per reference)
    expect(warnSpy.mock.calls.some(c => String(c[0]).includes('Dropped 2 null/undefined row'))).toBe(true)
    void responseData
  })

  it('hole-free data keeps the same (proxied) array reference across evaluations (lazy cleaned, zero allocation)', () => {
    // <zh/> 无空洞时 cleaned 保持 arr（深 ref 下为响应式代理）原引用——下游稳定性依赖这一点
    // <en/> hole-free data keeps arr (the reactive proxy under a deep ref) — downstream stability depends on it
    const rows = [{ id: '1' }, { id: '2' }]
    const { api } = makeCleaning(rows)
    const first = api.tableData.value
    const second = api.tableData.value
    expect(second).toBe(first)
    expect(first).toHaveLength(2)
  })

  it('tree branch: top-level holes count as dirty; nested holes are skipped silently (documented)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const rows = [
      { id: '1', children: [{ id: '1-1' }, null] },
      null,
      { id: '3', children: [{ id: '3-1' }] },
    ]
    const { api } = makeCleaning(rows, { childrenKey: 'children' })
    void api.tableData.value
    // <zh/> 顶层空洞计脏并移出；嵌套空洞仅跳过（既有不支持形态，不计入告警）
    // <en/> top-level holes are dirty and removed; nested holes are skipped silently (documented)
    expect(api.tableData.value.map(r => r.id)).toEqual(['1', '3'])
    expect(warnSpy.mock.calls.some(c => String(c[0]).includes('Dropped 1 null/undefined'))).toBe(true)
    // <zh/> keyToRow 含嵌套行（含被跳过的空洞不产生键）| <en/> keyToRow includes nested rows
    expect(api.rowKeyMeta.value.keyToRow.has('1-1')).toBe(true)
    expect(api.rowKeyMeta.value.keyToRow.has('3-1')).toBe(true)
  })

  it('tree keyToIndex numbers rows sequentially across nesting depth-first', () => {
    const rows = [
      { id: '1', children: [{ id: '1-1', children: [{ id: '1-1-1' }] }, { id: '1-2' }] },
      { id: '2' },
    ]
    const { api } = makeCleaning(rows, { childrenKey: 'children' })
    void api.tableData.value
    const idx = api.rowKeyMeta.value.keyToIndex
    expect(idx.get('1')).toBe(0)
    expect(idx.get('1-1')).toBe(1)
    expect(idx.get('1-1-1')).toBe(2)
    expect(idx.get('1-2')).toBe(3)
    expect(idx.get('2')).toBe(4)
  })

  it('same-ref in-place tree mutation with no holes still emits a fresh reference (EP V2 reset contract)', () => {
    // <zh/> 同引用原地树变更（无空洞）走到重建分支 → slice() 出新引用，
    // <zh/> 否则 tableData（prev===next 短路）与 EP V2 都感知不到
    // <en/> a same-ref in-place tree mutation (hole-free) reaches the rebuild branch → slice() fresh ref
    const rows = [{ id: '1', children: [{ id: '1-1' }] }]
    const { api, responseData } = makeCleaning(rows, { childrenKey: 'children' })
    void api.tableData.value
    const before = api.tableData.value
    responseData.value[0]!.children!.push({ id: '1-2' })
    void api.tableData.value
    const after = api.tableData.value
    expect(after).not.toBe(before)
    expect(after[0]!.children).toHaveLength(2)
  })

  it('no source: cleaned falls back to defaultData', () => {
    const hasSource = ref(false)
    const fallback = [{ id: 'd1' }]
    const api = useRequestDataCleaning<any>({
      hasSource,
      responseData: ref([{ id: 'ignored' }]),
      defaultData: () => fallback,
      rowKeyFn: () => (r: any) => r.id,
    })
    void api.tableData.value
    expect(api.tableData.value).toBe(fallback)
  })

  it('switching childrenKey on/off invalidates the fast path (cKey is part of the cache key)', () => {
    // <zh/> childrenKey 参与快路径键：开/关树形必须重建，不得复用平铺态的 prev
    // <en/> childrenKey is part of the fast-path key: toggling tree mode must rebuild, not reuse
    const childrenKey = ref<string | undefined>(undefined)
    const rows = [{ id: '1', children: [{ id: '1-1' }] }]
    const api = useRequestDataCleaning<any>({
      hasSource: ref(true),
      responseData: ref(rows),
      rowKeyFn: () => (r: any) => r.id,
      childrenKey: () => childrenKey.value,
    })
    void api.tableData.value
    expect(api.rowKeyMeta.value.keyToRow.has('1-1')).toBe(false)
    childrenKey.value = 'children'
    void api.tableData.value
    expect(api.rowKeyMeta.value.keyToRow.has('1-1')).toBe(true)
  })
})
