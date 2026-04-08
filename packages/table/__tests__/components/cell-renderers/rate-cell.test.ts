import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RateCell from '../../../src/components/cell-renderers/rate-cell.vue'

describe('cell-renderers/rate-cell', () => {
  /**
   * <zh/> 读无障碍标签断言数值归一化（同文件已有 '3 / 5' 先例）
   * <en/> Asserts numeric normalization through the aria-label (same '3 / 5' precedent below)
   */
  function ariaLabelOf(cellData: unknown) {
    const wrapper = mount(RateCell, { props: { cellData } })
    const label = wrapper.attributes('aria-label')
    wrapper.unmount()
    return label
  }

  it('should render rate with numeric value', () => {
    expect(ariaLabelOf(4)).toBe('4 / 5')
  })

  it('should convert string value to number', () => {
    expect(ariaLabelOf('3')).toBe('3 / 5')
  })

  it('should default to 0 for invalid value', () => {
    expect(ariaLabelOf('invalid')).toBe('0 / 5')
  })

  it('should handle null value', () => {
    expect(ariaLabelOf(null)).toBe('0 / 5')
  })

  it('should render static stars without interactive EP components', () => {
    const wrapper = mount(RateCell, {
      props: {
        cellData: 3,
      },
    })
    // 零组件实例：纯元素渲染，无 ElRate/ElIcon
    expect(wrapper.findComponent({ name: 'ElRate' }).exists()).toBe(false)
    expect(wrapper.find('.adv-table__rate-cell').exists()).toBe(true)
    expect(wrapper.findAll('.adv-table__rate-cell-star')).toHaveLength(5)
    // role=img + 数值型 aria-label（与禁用态 slider 语义解耦）
    expect(wrapper.attributes('role')).toBe('img')
    expect(wrapper.attributes('aria-label')).toBe('3 / 5')
  })

  it('should mark filled stars active and render decimal overlay for fractions', () => {
    const wrapper = mount(RateCell, {
      props: {
        cellData: 3.5,
      },
    })
    const stars = wrapper.findAll('.adv-table__rate-cell-star')
    expect(stars).toHaveLength(5)
    expect(stars[0]!.classes()).toContain('is-active')
    expect(stars[2]!.classes()).toContain('is-active')
    expect(stars[3]!.classes()).not.toContain('is-active')
    const decimal = wrapper.find('.adv-table__rate-cell-decimal')
    expect(decimal.exists()).toBe(true)
    expect(decimal.attributes('style')).toContain('50%')
  })

  it('should clamp value into [0, count] and honor count', () => {
    const over = mount(RateCell, { props: { cellData: 99, count: 3 } })
    expect(over.findAll('.adv-table__rate-cell-star')).toHaveLength(3)
    expect(over.findAll('.adv-table__rate-cell-star.is-active')).toHaveLength(3)
    const neg = mount(RateCell, { props: { cellData: -2 } })
    expect(neg.findAll('.adv-table__rate-cell-star.is-active')).toHaveLength(0)
  })

  it('should render score text only when showScore', () => {
    const withScore = mount(RateCell, { props: { cellData: 4, showScore: true } })
    expect(withScore.find('.adv-table__rate-cell-text').exists()).toBe(true)
    expect(withScore.find('.adv-table__rate-cell-text').text()).toBe('4')
    const withoutScore = mount(RateCell, { props: { cellData: 4 } })
    expect(withoutScore.find('.adv-table__rate-cell-text').exists()).toBe(false)
  })

  it('should map size tiers to icon pixels', () => {
    const small = mount(RateCell, { props: { cellData: 2, size: 'small' } })
    expect(small.find('svg').attributes('width')).toBe('14')
    const def = mount(RateCell, { props: { cellData: 2 } })
    expect(def.find('svg').attributes('width')).toBe('18')
    const large = mount(RateCell, { props: { cellData: 2, size: 'large' } })
    expect(large.find('svg').attributes('width')).toBe('18')
  })

  it('should not leak undeclared props to the DOM', () => {
    const wrapper = mount(RateCell, {
      props: {
        cellData: 2,
        rowData: { id: 1 },
        column: { prop: 'x' },
        index: 0,
      } as any,
    })
    const html = wrapper.html()
    expect(html).not.toContain('[object Object]')
    expect(html).not.toContain('rowdata')
  })
})
