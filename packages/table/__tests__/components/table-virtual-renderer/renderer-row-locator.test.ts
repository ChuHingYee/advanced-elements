import type { VueWrapper } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import { ElTableV2 } from 'element-plus'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
import AdvTable from '../../../src/AdvTable.vue'

// Pre-load async renderer modules so defineAsyncComponent resolves immediately
import ('../../../src/components/table-renderer/TableRenderer.vue')
import('../../../src/components/table-virtual-renderer/TableVirtualRenderer.vue')

const COLUMNS = [{ prop: 'name', label: 'Name', hidden: false }]

/** 生成 n 行简单数据 */
function makeRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `r${i}`, name: `row-${i}` }))
}

async function mountVirtualTable(props: Record<string, any> = {}, slots?: Record<string, any>): Promise<VueWrapper> {
  const wrapper = mount(AdvTable, {
    props: { mode: 'virtual', rowConfig: { rowKey: 'id' }, columns: COLUMNS, ...props },
    slots,
    global: {
      config: {
        globalProperties: { $router: { query: {} } },
      } as any,
    },
  })
  // <zh/> 条件轮询：以 ElTableV2 组件出现为就绪信号（defineAsyncComponent 需要宏/微任务交替推进），
  // <zh/> 固定 tick 数在 vite-node 下存在竞态。
  // <en/> Conditional polling: ElTableV2 presence as the ready signal (defineAsyncComponent needs
  // <en/> alternating macro/microtasks); a fixed tick count races under vite-node.
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 25))
    await nextTick()
    if (findV2(wrapper).exists())
      break
  }
  await nextTick()
  await nextTick()
  return wrapper
}

/** 找到已挂载的 ElTableV2 实例 */
function findV2(wrapper: VueWrapper) {
  return wrapper.findComponent(ElTableV2)
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── 超大数据行定位降级告警（dev 可见 + 去重） ─────────────────────

describe('row-locator degradation beyond ROW_KEY_FALLBACK_LIMIT', () => {
  it('warns exactly once when data exceeds 100k rows and stays deduped across rowsRendered', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = await mountVirtualTable({ data: makeRows(100_001), cache: 2 })

    // 超阈值即告警（含 immediate），明确说明受影响的事件与方法
    const rendererWarns = () => warnSpy.mock.calls
      .map(args => String(args[0]))
      .filter(m => m.includes('[AdvTable] Row key index skipped:'))
    expect(rendererWarns()).toHaveLength(1)
    expect(rendererWarns()[0]).toContain('100001 rows exceed limit (100000)')
    expect(rendererWarns()[0]).toContain('scrollToRow(key)')

    // 模拟滚动：rowsRendered 事件驱动窗口局部索引更新 → virtualKeyToIndex 重算；
    // 告警必须去重（computed 内副作用式 warn 会随每次滚动重复输出）
    const v2 = findV2(w)
    expect(v2.exists()).toBe(true)
    v2.vm.$emit('rows-rendered', { rowCacheStart: 0, rowCacheEnd: 30, rowVisibleStart: 0, rowVisibleEnd: 20 })
    v2.vm.$emit('rows-rendered', { rowCacheStart: 10, rowCacheEnd: 40, rowVisibleStart: 15, rowVisibleEnd: 35 })
    await nextTick()
    await nextTick()
    expect(rendererWarns()).toHaveLength(1)

    // 数据降回阈值内：解除降级（后续再次超限会重新告警）
    await w.setProps({ data: makeRows(10) })
    const v2b = findV2(w)
    v2b.vm.$emit('rows-rendered', { rowCacheStart: 0, rowCacheEnd: 10, rowVisibleStart: 0, rowVisibleEnd: 10 })
    await nextTick()
    expect(rendererWarns()).toHaveLength(1)

    w.unmount()
    // <zh/> 10 万行挂载在本机约 1.5s，全量并发（286 文件）下会顶穿默认 5s 预算。
    // <zh/> 这里给足预算：被测行为是「告警恰好一次且去重」，不是「挂载够快」。
    // <en/> Mounting 100k rows takes ~1.5s standalone but blows the default 5s budget under the full
    // <en/> parallel run (286 files). The behaviour under test is "warn exactly once, deduped"
    // <en/> not "mounts fast enough" — so the budget is raised instead of the workload.
  }, 30_000)
})

// ─── 动态行高：能力就绪即常驻（非 span 表），纯展示表仍固定 ───────────────

describe('resident dynamic row height for expand-capable tables', () => {
  const expandSlots = {
    expandRow: ({ row }: { row: any }) => h('div', { class: `detail-${row.id}` }, `${row.id} detail`),
  }

  it('keeps FixedSizeGrid for pure display tables (no expand capability, no append slot)', async () => {
    const w = await mountVirtualTable({ data: makeRows(3) })
    const v2 = findV2(w)
    expect(v2.exists()).toBe(true)
    // 无可变行高来源 → 不进入 DynamicSizeGrid，零测量开销
    expect(v2.props('estimatedRowHeight')).toBeUndefined()
    w.unmount()
  })

  it('enters DynamicSizeGrid from mount when expand is configured (no remount on first expand)', async () => {
    const w = await mountVirtualTable(
      { data: makeRows(3), rowExpandConfig: { enabled: true } },
      expandSlots,
    )
    const v2 = findV2(w)
    expect(v2.exists()).toBe(true)
    // 具备展开能力即常驻动态网格，避免首次展开触发整表重挂载
    expect(v2.props('estimatedRowHeight')).toBe(48)
    w.unmount()
  })

  it('expanding/collapsing rows never remounts the grid', async () => {
    const w = await mountVirtualTable(
      { data: makeRows(3), rowExpandConfig: { enabled: true } },
      expandSlots,
    )
    const before = findV2(w).vm.$.uid

    // 公共 API 扁平暴露 toggleDetailRowExpand（useTableApi 顶层 spread）
    const expandApi = w.findComponent(AdvTable).vm.$.exposed as any
    expandApi.toggleDetailRowExpand('r1')
    await nextTick()
    await nextTick()
    expect(findV2(w).props('estimatedRowHeight')).toBe(48)
    expect(findV2(w).vm.$.uid).toBe(before)

    expandApi.toggleDetailRowExpand('r1')
    await nextTick()
    await nextTick()
    // 折叠后保持动态网格（不再切回固定），实例同一、无重建抖动
    expect(findV2(w).props('estimatedRowHeight')).toBe(48)
    expect(findV2(w).vm.$.uid).toBe(before)
    w.unmount()
  })
})

// ─── 固定行上限强制（截断 + error 事件）───────────────

describe('pinned-rows cap enforcement', () => {
  function pinLimitErrors(wrapper: ReturnType<typeof mountVirtualTable> extends Promise<infer T> ? T : never) {
    const emitted = wrapper.findComponent(AdvTable).emitted('error') ?? []
    return emitted.map(args => args[0]).filter(e => e?.code === 'TABLE_PIN_LIMIT_EXCEEDED')
  }

  it('truncates past the default cap of 50 and emits TABLE_PIN_LIMIT_EXCEEDED once', async () => {
    const rows = makeRows(55)
    const w = await mountVirtualTable({
      data: rows,
      rowPinConfig: { topRowKeys: rows.map(r => r.id) },
    })

    const errs = pinLimitErrors(w)
    expect(errs).toHaveLength(1)
    expect(errs[0]).toMatchObject({ severity: 'warn' })
    expect(errs[0].cause).toMatchObject({ total: 55, limit: 50, truncatedTop: 5, truncatedBottom: 0 })

    // 去重：重复 flush 不再派发
    await nextTick()
    await nextTick()
    expect(pinLimitErrors(w)).toHaveLength(1)
    w.unmount()
  })

  it('does not emit when pinned rows are within the cap', async () => {
    const w = await mountVirtualTable({
      data: makeRows(5),
      rowPinConfig: { topRowKeys: ['r0'], bottomRowKeys: ['r4'] },
    })

    expect(pinLimitErrors(w)).toHaveLength(0)
    w.unmount()
  })
})
