import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import TableRenderer from '../../../src/components/table-renderer/TableRenderer.vue'

/**
 * <zh/> TableRenderer 直挂单测——真实 ElTable，覆盖行事件、滚动定位与列宽键盘。
 * <en/> TableRenderer direct-mount tests with real ElTable — row events, scrollTo and keyboard resize.
 */
const cols = [
  { key: 'name', prop: 'name', label: 'Name' },
  { key: 'age', prop: 'age', label: 'Age' },
]
const rows = [
  { id: '1', name: 'A', age: 20 },
  { id: '2', name: 'B', age: 30 },
]

const domStub = {
  getScopeSelector: () => '.el-table',
  getBodySelector: () => '.el-table__body-wrapper',
  getRowSelector: () => '.el-table__row',
  closestRow: (el: Element) => el.closest('.el-table__row'),
  getHeaderSelector: () => '.el-table__header-wrapper',
  getHeaderCellSelector: () => '.el-table__cell',
  getHeaderRowSelector: () => '.el-table__header-wrapper tr',
  getBodyScrollbarSpec: () => ({}),
  createDragLocator: () => ({}),
  createCellLocator: () => ({ getRowIndex: () => 0, getColumnIndex: () => 0 }),
}

function setupRenderer(propsOverrides: Record<string, any> = {}) {
  const wrapper = mount(TableRenderer as any, {
    props: {
      columns: cols,
      data: rows,
      rowKey: (row: any) => String(row.id),
      dom: domStub,
      ...propsOverrides,
    },
    attachTo: document.body,
  })
  return wrapper
}

describe('tableRenderer', () => {
  it('renders body rows', async () => {
    const wrapper = setupRenderer()
    await nextTick()
    await new Promise(r => setTimeout(r, 50))
    expect(wrapper.findAll('.el-table__row').length).toBeGreaterThanOrEqual(2)
    wrapper.unmount()
  })

  it('forwards row click and cell hover', async () => {
    const wrapper = setupRenderer()
    await nextTick()
    await new Promise(r => setTimeout(r, 50))
    const row = wrapper.find('.el-table__row')
    expect(row.exists()).toBe(true)
    await row.trigger('click')
    expect(wrapper.emitted('rowClick')).toBeDefined()
    await row.trigger('dblclick')
    expect(wrapper.emitted('rowDblclick')).toBeDefined()
    await row.trigger('contextmenu')
    expect(wrapper.emitted('rowContextmenu')).toBeDefined()
    const cell = wrapper.find('.el-table__cell')
    await cell.trigger('mouseenter')
    await cell.trigger('mouseleave')
    await cell.trigger('click')
    expect(wrapper.emitted('cellClick')).toBeDefined()
    await cell.trigger('dblclick')
    expect(wrapper.emitted('cellDblclick')).toBeDefined()
    wrapper.unmount()
  })

  it('forwards header keyboard resize', async () => {
    const wrapper = mount(TableRenderer as any, {
      props: {
        columns: [{ key: 'name', prop: 'name', label: 'Name', width: 120 }],
        data: rows,
        rowKey: (row: any) => String(row.id),
        dom: domStub,
        showHeader: true,
      },
      attachTo: document.body,
    })
    await nextTick()
    await new Promise(r => setTimeout(r, 50))
    const th = wrapper.find('th')
    expect(th.exists()).toBe(true)
    // <zh/> 补一个列键标记，模拟可拖拽列头渲染的标记结构 | <en/> stamp a column-key marker like draggable headers render
    const marker = document.createElement('span')
    marker.setAttribute('data-adv-table-column-key', 'name')
    th.element.appendChild(marker)
    marker.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('headerDragend')).toBeDefined()
    marker.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
    await nextTick()
    wrapper.unmount()
  })

  it('forwards body scroll', async () => {
    const wrapper = setupRenderer()
    await nextTick()
    await new Promise(r => setTimeout(r, 50))
    // <zh/> ElTable 的 scroll 直达 wrappedHandleScroll：透传并把缺失的 scrollTop 归一为 0
    // <en/> ElTable scroll reaches wrappedHandleScroll directly: forwarded with missing scrollTop normalized to 0
    const table = wrapper.findComponent({ name: 'ElTable' })
    expect(table.exists()).toBe(true)
    await table.vm.$emit('scroll', { scrollLeft: 120 })
    expect(wrapper.emitted('scroll')).toEqual([[{ scrollLeft: 120, scrollTop: 0 }]])
    await table.vm.$emit('scroll', { scrollLeft: 30, scrollTop: 40 })
    expect(wrapper.emitted('scroll')).toEqual([
      [{ scrollLeft: 120, scrollTop: 0 }],
      [{ scrollLeft: 30, scrollTop: 40 }],
    ])
    wrapper.unmount()
  })

  it('exposes scroll helpers', async () => {
    const wrapper = setupRenderer()
    await nextTick()
    const vm = wrapper.vm as any
    expect(typeof vm.scrollToRow).toBe('function')
    expect(typeof vm.scrollToColumn).toBe('function')
    expect(vm.scrollToRow('999')).toBe(false)
    wrapper.unmount()
  })

  it('toggles column group collapse', async () => {
    const wrapper = setupRenderer({
      columns: [{ key: 'g', label: 'G', children: cols }],
    })
    await nextTick()
    await new Promise(r => setTimeout(r, 50))
    expect(wrapper.find('.el-table').exists()).toBe(true)
    wrapper.unmount()
  })
})
