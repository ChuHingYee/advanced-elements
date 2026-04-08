import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { PinStripRow } from '../../../src/components/table-virtual-renderer/pin-strip-row'

// <zh/> PinStripRow 用列配置：key/label 形态 + width + cellRenderer 闭包
// <en/> Column configs for PinStripRow: key/label shaped + width + cellRenderer closure
function makeEntry(key: string, label: string, columnIndex: number, seen: Array<{ columnIndex: number }>) {
  return {
    column: {
      key,
      label,
      width: 100 + columnIndex,
      cellRenderer: (p: { rowData: unknown, columnIndex: number }) => {
        seen.push({ columnIndex: p.columnIndex })
        return `${label}`
      },
    },
    columnIndex,
  }
}

/**
 * <zh/> PinStripRow 小覆盖：三区渲染、全局 columnIndex 透传、forward 事件转发
 * <en/> PinStripRow small coverage: three-region render, global columnIndex passthrough, forward event relay
 */
describe('pin-strip-row small coverage', () => {
  it('renders left/main/right regions and forwards row events to handlers', async () => {
    // <zh/> 记录 cellRenderer 收到的全局列索引 | <en/> record the global column indexes seen by cellRenderer
    const seen: Array<{ columnIndex: number }> = []
    const row = { id: 1, name: 'r1' }
    const handlers = { onClick: vi.fn(), onDblclick: vi.fn(), onContextmenu: vi.fn() }
    const wrapper = mount(PinStripRow as any, {
      props: {
        row,
        rowKeyValue: 'r1',
        handlers,
        leftEntries: [makeEntry('left-a', 'Left A', 0, seen)],
        mainEntries: [makeEntry('main-b', 'Main B', 5, seen)],
        rightEntries: [makeEntry('right-c', 'Right C', 9, seen)],
        mainStyle: { transform: 'translateX(-40px)' },
      },
    })

    // <zh/> 三区容器均存在 | <en/> all three region containers exist
    expect(wrapper.find('.adv-table-v2__pin-strip__region--left').exists()).toBe(true)
    expect(wrapper.find('.adv-table-v2__pin-strip__region--main').exists()).toBe(true)
    expect(wrapper.find('.adv-table-v2__pin-strip__region--right').exists()).toBe(true)
    // <zh/> 三个单元格 + 文本内容 | <en/> three cells with text content
    const cells = wrapper.findAll('.adv-table-v2__pin-strip__cell')
    expect(cells).toHaveLength(3)
    expect(wrapper.text()).toContain('Left A')
    expect(wrapper.text()).toContain('Main B')
    expect(wrapper.text()).toContain('Right C')
    // <zh/> cellRenderer 收到的是全列序全局索引 | <en/> cellRenderer receives full-order global indexes
    expect(seen.map(s => s.columnIndex).sort((a, b) => a - b)).toEqual([0, 5, 9])
    // <zh/> 主区平移样式 + 行 key 属性 | <en/> main translate style + row key attr
    expect(wrapper.find('.adv-table-v2__pin-strip__region--main').attributes('style')).toContain('translateX(-40px)')
    expect(wrapper.find('.adv-table-v2__pin-strip__cells').attributes('data-adv-table-row-key')).toBe('r1')

    // <zh/> forward(name) 闭包：点击/双击/右键均转发 | <en/> forward(name) closure: click/dblclick/contextmenu relay
    const root = wrapper.find('.adv-table-v2__pin-strip__cells')
    await root.trigger('click')
    expect(handlers.onClick).toHaveBeenCalledTimes(1)
    expect(handlers.onClick.mock.calls[0][0]).toMatchObject({ rowData: row, rowIndex: -1, rowKey: 'r1' })
    expect(handlers.onClick.mock.calls[0][0].event).toBeInstanceOf(Event)

    await root.trigger('dblclick')
    expect(handlers.onDblclick).toHaveBeenCalledTimes(1)
    expect(handlers.onDblclick.mock.calls[0][0]).toMatchObject({ rowData: row, rowIndex: -1, rowKey: 'r1' })

    await root.trigger('contextmenu')
    expect(handlers.onContextmenu).toHaveBeenCalledTimes(1)
    expect(handlers.onContextmenu.mock.calls[0][0]).toMatchObject({ rowData: row, rowIndex: -1, rowKey: 'r1' })

    wrapper.unmount()
  })

  it('ignores row events when handlers are absent and renders empty regions', async () => {
    // <zh/> 无 handlers 时触发事件不应抛错 | <en/> triggering events without handlers must not throw
    const wrapper = mount(PinStripRow as any, { props: { row: { id: 2 } } })
    const root = wrapper.find('.adv-table-v2__pin-strip__cells')
    await root.trigger('click')
    await root.trigger('dblclick')
    await root.trigger('contextmenu')
    expect(wrapper.findAll('.adv-table-v2__pin-strip__cell')).toHaveLength(0)
    wrapper.unmount()
  })
})
