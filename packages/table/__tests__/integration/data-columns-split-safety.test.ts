import type { TableExpose } from '../../src/composables/api/use-table-api'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import AdvTable from '../../src/AdvTable.vue'

/**
 * <zh/> 数据+列域端到端——远端分页 / 编辑链真实改值 / 并发变更 / 全旅程快照链
 * <zh/> 仅存在域装配单路径：所有写入必须经由域对象装配，不得绕开
 * <en/> Data+columns domain e2e — remote pagination / editing-chain real mutations /
 * <en/> concurrent mutations / full-journey snapshot chain
 * <en/> The domain-assembly path is the only one: writes must go through the assembled domains
 */

interface Row { id: string, name: string, age: number }

const REMOTE_ROWS: Row[] = [
  { id: '1', name: 'Alice', age: 30 },
  { id: '2', name: 'Bob', age: 25 },
  { id: '3', name: 'Carol', age: 28 },
  { id: '4', name: 'Dave', age: 22 },
  { id: '5', name: 'Eve', age: 35 },
]

const LOCAL_ROWS: Row[] = [
  { id: '1', name: 'Alice', age: 30 },
  { id: '2', name: 'Bob', age: 25 },
  { id: '3', name: 'Carol', age: 28 },
  { id: '4', name: 'Dave', age: 22 },
  { id: '5', name: 'Eve', age: 35 },
]

const COLUMNS = [
  { key: 'name', prop: 'name', label: 'Name', width: 120, sortable: true },
  { key: 'age', prop: 'age', label: 'Age', width: 80, sortable: true },
]

const EDIT_COLUMNS = [
  { key: 'name', prop: 'name', label: 'Name', width: 120, editable: true, cellEditor: 'text' },
  { key: 'age', prop: 'age', label: 'Age', width: 80 },
]

let wrappers: Array<ReturnType<typeof mount>> = []
afterEach(() => {
  for (const w of wrappers) {
    try {
      w.unmount()
    }
    catch {}
  }
  wrappers = []
})

function mountTable(props: Record<string, unknown>): { api: TableExpose<Row>, emitted: (event: string) => unknown[][] } {
  const apiRef = ref<TableExpose<Row> | null>(null)
  // <zh/> 内层 AdvTable 的事件不会冒泡到外层壳组件的 emitted()，经 vnode 监听直接采集
  // <en/> Inner AdvTable events never reach the outer shell's emitted(); collect them via vnode listeners
  const received: Array<{ event: string, args: unknown[] }> = []
  const Comp = defineComponent({
    setup: () => () => h(AdvTable as any, {
      ref: apiRef,
      ...props,
      onCellValueChanged: (...args: unknown[]) => received.push({ event: 'cellValueChanged', args }),
      onDataChange: (...args: unknown[]) => received.push({ event: 'dataChange', args }),
    }),
  })
  wrappers.push(mount(Comp))
  if (!apiRef.value)
    throw new Error('[e2e] AdvTable api ref not exposed')
  return {
    api: apiRef.value,
    emitted: (event: string) => received.filter(r => r.event === event).map(r => r.args),
  }
}

/** <zh/> 可观测快照——覆盖数据/分页/排序/筛选/选择/列状态/渲染域 | <en/> Observable snapshot — data/pagination/sort/filter/selection/column-state/render-domain */
function snapshot(api: TableExpose<Row>): string {
  return JSON.stringify({
    full: api.getFullData(),
    pagination: api.getPagination(),
    sorts: ['name', 'age'].map(prop => [prop, api.getSortOrder(prop)]),
    filters: ['name', 'age'].map(prop => [prop, api.getFilterValue(prop)]),
    selected: api.getSelectedKeys(),
    columns: api.getColumnState(),
    render: api.getRenderData(),
  })
}

async function settle(): Promise<void> {
  await flushPromises()
  await nextTick()
  await nextTick()
}

describe('data-columns domain e2e', () => {
  it('s1 remote pagination carries page/sort/filter in request payloads', async () => {
    const calls: any[][] = []
    const { api } = mountTable({
      columns: COLUMNS,
      rowConfig: { rowKey: 'id' },
      pagination: { pageSize: 2 },
      request: {
        autoParams: true,
        source: async (params: Record<string, unknown>) => {
          calls.push([params])
          const page = (params.page as number) ?? 1
          const size = (params.size as number) ?? 10
          return { data: REMOTE_ROWS.slice((page - 1) * size, page * size), total: REMOTE_ROWS.length }
        },
      },
    })
    await settle()

    // <zh/> 初次加载 page=1 | <en/> Initial load page=1
    expect(calls.length).toBeGreaterThanOrEqual(1)
    expect(calls[0][0]).toMatchObject({ page: 1, size: 2 })
    expect(api.getFullData()).toHaveLength(2)
    expect(api.getPagination()).toMatchObject({ currentPage: 1, total: REMOTE_ROWS.length })

    // <zh/> 翻页携带 page=2 | <en/> Page turn carries page=2
    api.setCurrentPage(2)
    await settle()
    expect(calls.at(-1)[0]).toMatchObject({ page: 2 })
    expect(api.getPagination().currentPage).toBe(2)

    // <zh/> 排序写入 payload 并触发 refetch（防抖等待） | <en/> Sort lands in payload and refetches (debounce wait)
    api.setSort('age', 'descending')
    expect(api.getSortOrder('age')).toBe('descending')
    await new Promise(resolve => setTimeout(resolve, 450))
    await settle()
    const lastPayload = calls.at(-1)[0] as Record<string, unknown>
    expect(lastPayload.sort).toMatchObject([{ prop: 'age', order: 'desc' }])

    // <zh/> 筛选写入 payload | <en/> Filter lands in payload
    api.setFilter('name', { type: 'text', operator: 'contains', value: 'a' })
    await new Promise(resolve => setTimeout(resolve, 450))
    await settle()
    const filterPayload = calls.at(-1)[0] as Record<string, unknown>
    expect(filterPayload.filter).toMatchObject({ name: expect.anything() })

    // <zh/> 选择链路不受影响 | <en/> Selection chain unaffected
    api.selectAll()
    expect(api.getSelectedCount()).toBeGreaterThan(0)
    api.clearSelection()
    expect(api.getSelectedCount()).toBe(0)
  })

  it('s2 editing chain performs real mutations', async () => {
    const { api, emitted } = mountTable({
      columns: EDIT_COLUMNS,
      data: [...LOCAL_ROWS],
      rowConfig: { rowKey: 'id' },
      editConfig: {},
    })
    await settle()
    const changesBefore = emitted('cellValueChanged').length

    // <zh/> 真实改值：开始编辑 → 更新值 → 读回 → 提交 → 数据落盘 + cellValueChanged
    // <en/> Real mutation: start editing → update value → read back → submit → data persisted + cellValueChanged
    await api.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    await settle()
    api.updateCellEditingValue('name', 'Alicia')
    expect(api.getCellEditingValue('name')).toBe('Alicia')
    await api.submitEdit()
    await settle()
    expect(api.getFullData()[0].name).toBe('Alicia')
    expect(emitted('cellValueChanged').length).toBeGreaterThan(changesBefore)
    expect(api.hasUnsavedChanges()).toBe(false)

    await api.startEditing({ rowIndex: 1, prop: 'name', columnKey: 'name', value: 'Bob' })
    await settle()
    api.discardEdit()
    await settle()
    expect(api.getFullData()[1].name).toBe('Bob')

    // <zh/> 校验链路可用 | <en/> Validation chain usable
    await expect(api.validate()).resolves.toBe(true)

    // <zh/> 选择链路在编辑生命周期后正常 | <en/> Selection works after the editing lifecycle
    api.selectRowByKey('1')
    expect(api.isSelectedByKey('1')).toBe(true)
  })

  it('s3 concurrent mutations converge to one coherent state', async () => {
    const { api } = mountTable({
      columns: COLUMNS,
      data: [...LOCAL_ROWS],
      rowConfig: { rowKey: 'id' },
      pagination: { mode: 'client', pageSize: 2 },
    })
    await settle()

    // <zh/> 同 tick 并发：增量事务 + 筛选 + 排序 + 翻页 | <en/> Same-tick concurrency: transaction + filter + sort + page turn
    const tx = api.applyTransaction({ add: [{ id: '6', name: 'Frank', age: 40 }] }, 'e2e')
    api.setFilter('name', { type: 'text', operator: 'contains', value: 'a' })
    api.setSort('age', 'descending')
    api.setCurrentPage(2)
    await tx
    await settle()

    expect(api.getFullData()).toHaveLength(LOCAL_ROWS.length + 1)
    const { currentPage, pageSize, total } = api.getPagination()
    expect(total).toBeGreaterThan(0)
    expect(currentPage).toBeLessThanOrEqual(Math.max(1, Math.ceil(total / pageSize)))

    // <zh/> 列状态往返一致 | <en/> Column state round-trips
    const state = api.getColumnState()
    api.applyColumnState(state)
    expect(api.getColumnState()).toEqual(state)
  })

  it('s4 full journey produces a coherent snapshot chain', async () => {
    const snaps: string[] = []
    const { api } = mountTable({
      columns: COLUMNS,
      data: [...LOCAL_ROWS],
      rowConfig: { rowKey: 'id' },
      editConfig: {},
      pagination: { mode: 'client', pageSize: 2 },
    })
    const snap = () => snaps.push(snapshot(api))
    await settle()
    snap()
    api.setSort('age', 'descending')
    api.setFilter('name', { type: 'text', operator: 'contains', value: 'a' })
    await settle()
    snap()
    api.setCurrentPage(2)
    await settle()
    snap()
    api.selectAll()
    snap()
    api.clearSelection()
    const state = api.getColumnState()
    api.applyColumnState(state)
    await settle()
    snap()
    await api.startEditing({ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice' })
    await settle()
    await api.submitEdit()
    await settle()
    snap()
    await api.applyTransaction({ add: [{ id: '9', name: 'Zoe', age: 29 }] }, 'e2e-journey')
    await settle()
    snap()

    // <zh/> 7 个阶段快照俱全且首尾不同（含新增行） | <en/> All 7 phase snapshots present, first and last differ (new row included)
    expect(snaps).toHaveLength(7)
    for (const s of snaps)
      expect(typeof s).toBe('string')
    expect(snaps[0]).not.toBe(snaps.at(-1))
    expect(snaps.at(-1)).toContain('Zoe')
  })
})
