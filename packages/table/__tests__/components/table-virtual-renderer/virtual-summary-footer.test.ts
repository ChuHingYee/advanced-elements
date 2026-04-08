import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import VirtualSummaryFooter from '../../../src/components/table-virtual-renderer/virtual-summary-footer.vue'

interface SummaryCellItem {
  key: string
  value: string | any
  style: { width: number }
  align: CanvasTextAlign
}

function makeCells(count: number): SummaryCellItem[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `cell-${i}`,
    value: `Value ${i}`,
    style: { width: 100 },
    align: 'left' as CanvasTextAlign,
  }))
}

describe('virtualSummaryFooter', () => {
  const defaultProps = {
    leftCells: [] as SummaryCellItem[],
    mainCells: makeCells(2),
    rightCells: [] as SummaryCellItem[],
    onScroll: vi.fn(),
  }

  it('renders main summary cells', () => {
    const wrapper = mount(VirtualSummaryFooter, { props: defaultProps })
    const cellDivs = wrapper.findAll('.adv-table__v2-summary-cell')
    expect(cellDivs).toHaveLength(2)
    expect(cellDivs[0].text()).toBe('Value 0')
    expect(cellDivs[1].text()).toBe('Value 1')
    wrapper.unmount()
  })

  it('renders left-fixed cells when provided', () => {
    const wrapper = mount(VirtualSummaryFooter, {
      props: { ...defaultProps, leftCells: makeCells(1) },
    })
    const fixedLeft = wrapper.find('.adv-table__v2-summary-fixed--left')
    expect(fixedLeft.exists()).toBe(true)
    expect(fixedLeft.text()).toBe('Value 0')
    wrapper.unmount()
  })

  it('renders right-fixed cells when provided', () => {
    const wrapper = mount(VirtualSummaryFooter, {
      props: { ...defaultProps, rightCells: makeCells(1) },
    })
    const fixedRight = wrapper.find('.adv-table__v2-summary-fixed--right')
    expect(fixedRight.exists()).toBe(true)
    expect(fixedRight.text()).toBe('Value 0')
    wrapper.unmount()
  })

  it('does not render left-fixed section when leftCells is empty', () => {
    const wrapper = mount(VirtualSummaryFooter, { props: defaultProps })
    expect(wrapper.find('.adv-table__v2-summary-fixed--left').exists()).toBe(false)
    wrapper.unmount()
  })

  it('does not render right-fixed section when rightCells is empty', () => {
    const wrapper = mount(VirtualSummaryFooter, { props: defaultProps })
    expect(wrapper.find('.adv-table__v2-summary-fixed--right').exists()).toBe(false)
    wrapper.unmount()
  })

  it('applies custom width and textAlign to cells', () => {
    const cells = [{ key: 'c1', value: 'Custom', style: { width: '200px', textAlign: 'right' as const } }]
    const wrapper = mount(VirtualSummaryFooter, {
      props: { ...defaultProps, mainCells: cells },
    })
    const cell = wrapper.find('.adv-table__v2-summary-cell')
    expect(cell.attributes('style')).toContain('width: 200px')
    expect(cell.attributes('style')).toContain('text-align: right')
    wrapper.unmount()
  })

  it('forwards scroll events from native scrollbar', async () => {
    const onScroll = vi.fn()
    const wrapper = mount(VirtualSummaryFooter, {
      props: { ...defaultProps, onScroll },
    })
    const scrollbar = wrapper.find('.adv-table__v2-summary-scrollbar')
    expect(scrollbar.exists()).toBe(true)
    await scrollbar.trigger('scroll')
    expect(onScroll).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('renders left, main, and right areas in correct order when all are present', () => {
    const wrapper = mount(VirtualSummaryFooter, {
      props: {
        ...defaultProps,
        leftCells: [{ key: 'L', value: 'Left', style: { width: '80px' } }],
        mainCells: [{ key: 'M', value: 'Main', style: { width: '200px' } }],
        rightCells: [{ key: 'R', value: 'Right', style: { width: '120px' } }],
      },
    })
    const wrapperEl = wrapper.find('.adv-table__v2-summary-wrapper').element
    const children = Array.from(wrapperEl.children)
    // Three areas should be siblings in DOM order: left-fixed, scrollbar, right-fixed
    expect(children).toHaveLength(3)
    expect(children[0].classList.contains('adv-table__v2-summary-fixed--left')).toBe(true)
    expect(children[1].classList.contains('adv-table__v2-summary-scrollbar')).toBe(true)
    expect(children[2].classList.contains('adv-table__v2-summary-fixed--right')).toBe(true)
    wrapper.unmount()
  })

  it('exposes scrollTo method', () => {
    const wrapper = mount(VirtualSummaryFooter, {
      props: defaultProps,
    })
    expect(typeof (wrapper.vm as any).scrollTo).toBe('function')
    wrapper.unmount()
  })

  it('scrollTo writes scrollLeft on the inner scrollbar, not the overflow:hidden wrapper', async () => {
    const wrapper = mount(VirtualSummaryFooter, {
      props: defaultProps,
    })
    const scrollbar = wrapper.find('.adv-table__v2-summary-scrollbar').element as HTMLElement
    const wrapperEl = wrapper.find('.adv-table__v2-summary-wrapper').element as HTMLElement
    ;(wrapper.vm as any).scrollTo(120)
    await wrapper.vm.$nextTick()
    expect(scrollbar.scrollLeft).toBe(120)
    expect(wrapperEl.scrollLeft).toBe(0)
    wrapper.unmount()
  })
})
