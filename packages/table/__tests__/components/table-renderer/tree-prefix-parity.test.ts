import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'
import AdvTable from '../../../src/AdvTable.vue'
import '../__harness__/layout-mock'

import '../../../src/components/table-renderer/TableRenderer.vue'
import '../../../src/components/table-virtual-renderer/TableVirtualRenderer.vue'

/**
 * <zh/> 树形/展开前缀落位 parity——default 与 virtual 都只在首个数据列渲染缩进/展开图标。
 * <zh/> 回归：default 的 resolveTreePrefix 曾缺首列门控，tree/expand 开启时每一列都塞占位图标，
 * <zh/> 每格内容被顶右约一个图标宽（11.x mega 页姓名/年龄/性别列与 virtual 左边距失齐）。
 * <en/> Tree/expand prefix placement parity — default and virtual both render indent/expand
 * <en/> icons in the first data column only.
 * <en/> Regression: default's resolveTreePrefix lacked the first-column gate, so every column
 * <en/> received a placeholder icon while tree/expand was on, pushing each cell's content right
 * <en/> by about an icon width (the 11.x mega page name/age/gender columns desynced from virtual).
 */
const TREE_COLS: any[] = [
  { selection: true },
  {
    label: '基本信息',
    children: [
      { prop: 'name', label: '姓名', width: 100 },
      { prop: 'age', label: '年龄', width: 80 },
    ],
  },
]
const TREE_ROWS = [
  { id: '1', name: 'Alice', age: 20 },
  { id: '2', name: 'Bob', age: 21 },
]
const TREE_CONFIG = { children: 'children', defaultExpandAll: true, indent: 20 }

let wrapper: ReturnType<typeof mount> | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

async function mountWithRows(mode: 'default' | 'virtual') {
  wrapper = mount(h(AdvTable as any, {
    mode,
    columns: TREE_COLS,
    data: TREE_ROWS,
    rowConfig: { rowKey: 'id' },
    treeConfig: TREE_CONFIG,
    height: '300px',
  }), {
    attachTo: document.body,
    global: { config: { globalProperties: { $router: { query: {} } } } as any },
  })
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 25))
    await nextTick()
    if (wrapper.find('[data-adv-table-row-key]').exists())
      break
  }
  expect(wrapper.find('[data-adv-table-row-key]').exists()).toBe(true)
  await nextTick()
  await nextTick()
  return wrapper
}

describe('tree prefix first-column parity', () => {
  it('default: placeholder icon lands in the first data column only', async () => {
    const w = await mountWithRows('default')
    const rows = w.findAll('.el-table__body tbody tr.el-table__row')
    expect(rows.length).toBe(TREE_ROWS.length)
    for (const row of rows) {
      const cells = row.findAll('td')
      expect(cells.length).toBeGreaterThan(1)
      expect(cells[0].find('.el-table__expand-icon--placeholder').exists()).toBe(false)
      expect(cells[1].find('.el-table__expand-icon--placeholder').exists()).toBe(true)
      for (const cell of cells.slice(2)) {
        expect(cell.find('.el-table__expand-icon').exists()).toBe(false)
      }
    }
    expect(w.findAll('.el-table__body tbody .el-table__expand-icon--placeholder').length).toBe(TREE_ROWS.length)
  })

  it('virtual: placeholder icon lands in the first data column only', async () => {
    const w = await mountWithRows('virtual')
    const rows = w.findAll('.el-table-v2__row')
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      const cells = row.findAll('.el-table-v2__row-cell')
      expect(cells.length).toBeGreaterThan(1)
      expect(cells[1].find('.el-table__expand-icon--placeholder').exists()).toBe(true)
      for (const cell of cells.slice(2)) {
        expect(cell.find('.el-table__expand-icon').exists()).toBe(false)
      }
    }
  })

  it('both modes place the same number of placeholders', async () => {
    const wDefault = await mountWithRows('default')
    const defaultCount = wDefault.findAll('.el-table__body tbody .el-table__expand-icon--placeholder').length
    wDefault.unmount()
    wrapper = null
    const wVirtual = await mountWithRows('virtual')
    const virtualCount = wVirtual.findAll('.el-table-v2__row .el-table__expand-icon--placeholder').length
    expect(defaultCount).toBeGreaterThan(0)
    expect(virtualCount).toBe(defaultCount)
  })
})
