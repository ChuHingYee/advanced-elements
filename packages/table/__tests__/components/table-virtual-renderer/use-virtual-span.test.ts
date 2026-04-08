import type { SpanInfo } from '../../../src/types'
import { describe, expect, it } from 'vitest'
import { effectScope, h, nextTick, ref } from 'vue'
import { useVirtualSpan } from '../../../src/components/table-virtual-renderer/use-virtual-span'

const SPAN_ORIGIN_CLASS = 'adv-table__cell-span-origin'
const SPAN_HIDDEN_CLASS = 'adv-table__cell-span-hidden'

function createInputs() {
  return {
    spanEnabled: ref<boolean | undefined>(true),
    getSpanInfo: ref<((rowIndex: number, colKey: string) => SpanInfo | undefined) | undefined>(() => undefined),
    selectionColumns: ref<{ prop?: string }[]>([]),
    normalColumns: ref<{ prop?: string, fixed?: string | boolean }[]>([{ prop: 'a' }, { prop: 'b' }]),
    rowHeight: ref<number | undefined>(48),
    hasAppendSlot: ref(false),
    rowExpandEnabled: ref<boolean | undefined>(undefined),
    slots: ref<any>({}),
    v2Columns: ref<any[]>([{ key: 'a', width: 100 }, { key: 'b', width: 200 }]),
  }
}

async function setup() {
  const inputs = createInputs()
  const scope = effectScope()
  let api: ReturnType<typeof useVirtualSpan>
  scope.run(() => {
    api = useVirtualSpan({
      spanEnabled: () => inputs.spanEnabled.value,
      getSpanInfo: () => inputs.getSpanInfo.value,
      selectionColumns: () => inputs.selectionColumns.value,
      normalColumns: () => inputs.normalColumns.value,
      rowHeight: () => inputs.rowHeight.value,
      hasAppendSlot: () => inputs.hasAppendSlot.value,
      rowExpandEnabled: () => inputs.rowExpandEnabled.value,
      slots: () => inputs.slots.value,
      v2Columns: () => inputs.v2Columns.value,
    })
  })
  await nextTick()
  return { ...inputs, api: api!, scope }
}

function cellClass(vnode: any): string {
  const cls = vnode?.props?.class
  return Array.isArray(cls) ? cls.filter(Boolean).join(' ') : (cls as string) ?? ''
}

describe('useVirtualSpan — component identity stabilization', () => {
  it('keeps the SpanRow component reference across column / row-height / width changes', async () => {
    const { api, normalColumns, v2Columns, rowHeight } = await setup()
    const first = api.SpanRow.value
    expect(first).toBeTruthy()

    // <zh/> 列宽拖拽结束/键盘调宽/列设置变更 → v2Columns 新数组 + normalColumns 变化：
    // <zh/> 组件身份必须保持不变（否则 `<component :is>` 重挂载全部渲染行子树）
    // <en/> Column-width drag end / keyboard resize / column setting updates produce new
    // <en/> v2Columns + normalColumns: the component identity MUST stay the same (otherwise
    // <en/> `<component :is>` remounts every rendered row subtree)
    normalColumns.value = [{ prop: 'a' }, { prop: 'b' }, { prop: 'c' }]
    v2Columns.value = [{ key: 'a', width: 110 }, { key: 'b', width: 210 }, { key: 'c', width: 310 }]
    rowHeight.value = 56
    await nextTick()

    expect(api.SpanRow.value).toBe(first)
  })

  it('clears the component when disabled and re-creates on re-enable', async () => {
    const { api, spanEnabled } = await setup()
    expect(api.SpanRow.value).toBeTruthy()

    spanEnabled.value = false
    await nextTick()
    expect(api.SpanRow.value).toBeNull()
    expect(api.spanCellProps.value).toBeUndefined()

    spanEnabled.value = true
    await nextTick()
    expect(api.SpanRow.value).toBeTruthy()
  })

  it('renders with FRESH column indexes after a reorder (context freshness, same identity)', async () => {
    const { api, getSpanInfo, normalColumns } = await setup()
    // <zh/> 'b' 是合并起点（rowspan 2），其余格无合并
    // <en/> 'b' is the merge origin (rowspan 2), other cells have no span
    getSpanInfo.value = (rowIndex: number, colKey: string) =>
      colKey === 'b' ? { rowspan: 2, colspan: 1, isOrigin: true } : undefined
    await nextTick()

    // 初始列序 [a, b]：b 的 cell 下标 = 1 | initial order [a, b]: b's cell index = 1
    const out1 = (api.SpanRow.value as any)({
      cells: [h('div', 'a'), h('div', 'b'), h('div', 'c')],
      rowIndex: 0,
      rowData: {},
    })
    expect(cellClass(out1[1])).toContain(SPAN_ORIGIN_CLASS)

    // <zh/> 重排为 [b, a]：组件不变，但渲染必须读到新 colIndexMap（b 的下标 = 0）
    // <en/> reorder to [b, a]: same component, but rendering must read the NEW colIndexMap (b = 0)
    normalColumns.value = [{ prop: 'b' }, { prop: 'a' }]
    await nextTick()

    const out2 = (api.SpanRow.value as any)({
      cells: [h('div', 'b'), h('div', 'a'), h('div', 'c')],
      rowIndex: 0,
      rowData: {},
    })
    expect(cellClass(out2[0])).toContain(SPAN_ORIGIN_CLASS)
  })

  it('reflects updated rowHeight in the rowspan extension height (context freshness)', async () => {
    const { api, getSpanInfo, rowHeight } = await setup()
    getSpanInfo.value = (rowIndex: number, colKey: string) =>
      colKey === 'a' ? { rowspan: 2, colspan: 1, isOrigin: true } : undefined
    await nextTick()

    const out1 = (api.SpanRow.value as any)({
      cells: [h('div', 'a'), h('div', 'b')],
      rowIndex: 0,
      rowData: {},
    })
    expect((out1[0].props.style as any).height).toBe('96px')

    // <zh/> 行高变化不换组件，但下一次渲染必须用新行高计算 rowspan 延伸高度
    // <en/> row-height change keeps the component; the next render must size the rowspan
    // <en/> extension with the NEW height
    rowHeight.value = 56
    await nextTick()

    const out2 = (api.SpanRow.value as any)({
      cells: [h('div', 'a'), h('div', 'b')],
      rowIndex: 0,
      rowData: {},
    })
    expect((out2[0].props.style as any).height).toBe('112px')
  })

  it('places origin/hidden classes by key with fresh indexes after a swap', async () => {
    const { api, getSpanInfo, normalColumns } = await setup()
    // <zh/> 'a' 为 origin（rowspan 2），'b' 为被合并格
    // <en/> 'a' is the origin (rowspan 2), 'b' is a merged (hidden) cell
    getSpanInfo.value = (_rowIndex: number, colKey: string): SpanInfo | undefined =>
      colKey === 'a'
        ? { rowspan: 2, colspan: 1, isOrigin: true }
        : (colKey === 'b' ? { rowspan: 0, colspan: 1, isOrigin: false } : undefined)
    await nextTick()

    const out1 = (api.SpanRow.value as any)({
      cells: [h('div', 'a'), h('div', 'b')],
      rowIndex: 0,
      rowData: {},
    })
    expect(cellClass(out1[0])).toContain(SPAN_ORIGIN_CLASS)
    expect(cellClass(out1[1])).toContain(SPAN_HIDDEN_CLASS)

    // <zh/> 交换列序 [b, a]：按 key 的 span 语义不变，但落位下标必须随新 colIndexMap 更新
    // <en/> swap to [b, a]: key-based span semantics unchanged, but placement indexes must
    // <en/> follow the fresh colIndexMap
    normalColumns.value = [{ prop: 'b' }, { prop: 'a' }]
    await nextTick()
    const out2 = (api.SpanRow.value as any)({
      cells: [h('div', 'b'), h('div', 'a')],
      rowIndex: 0,
      rowData: {},
    })
    expect(cellClass(out2[0])).toContain(SPAN_HIDDEN_CLASS)
    expect(cellClass(out2[1])).toContain(SPAN_ORIGIN_CLASS)
  })

  it('rebuilds spanCellProps so new column keys are covered (prop-value update, not a remount)', async () => {
    const { api, getSpanInfo, normalColumns } = await setup()
    // <zh/> 所有列都返回隐藏态——cellProps 是否命中取决于 colKeySet 是否包含该列
    // <en/> every key maps to a hidden state — whether cellProps matches depends on colKeySet
    getSpanInfo.value = (_rowIndex: number, _colKey: string): SpanInfo | undefined =>
      ({ rowspan: 0, colspan: 1, isOrigin: false })
    await nextTick()

    const colC = { key: 'c', dataKey: 'c' }
    // <zh/> 新列 c 尚不在 colKeySet → cellProps 直接放行（{}）
    // <en/> new column c not in colKeySet yet → cellProps passes through ({})
    expect(api.spanCellProps.value?.({ rowIndex: 0, rowData: {}, column: colC })).toEqual({})

    normalColumns.value = [{ prop: 'a' }, { prop: 'b' }, { prop: 'c' }]
    await nextTick()
    // <zh/> cellProps 重建后新列 c 被覆盖——这是 :cell-props 的 prop 值更新，
    // <zh/> 不是组件身份变化（与 SpanRow 的身份稳定化互补）。
    // <en/> after rebuild, new column c is covered — a :cell-props prop-value update,
    // <en/> not a component identity change (complementary to SpanRow stabilization).
    expect(api.spanCellProps.value?.({ rowIndex: 0, rowData: {}, column: colC })).toEqual({
      class: SPAN_HIDDEN_CLASS,
    })
  })
})
