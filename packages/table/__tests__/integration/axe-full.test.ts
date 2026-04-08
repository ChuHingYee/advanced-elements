/**
 * <zh/> axe 全量可访问性 — 基于 jest-axe 规则集的手动校验（无外部依赖）
 * <en/> axe full a11y — manual rule set based on jest-axe (no external dep)
 *
 * @remarks
 * <zh/> 校验 `role="grid"` `aria-rowcount/colcount/label` `aria-selected` `tabindex` 等 `axe` 核心规则。
 * <zh/> 渲染器为异步组件，需经 axe-helpers.waitForRenderer 等待就绪后再扫描。
 * <en/> Verifies core axe rules: `role="grid"` `aria-rowcount/colcount/label` `aria-selected` `tabindex`.
 * <en/> Renderers are async components — scan after axe-helpers.waitForRenderer.
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import AdvTable from '../../src/AdvTable.vue'
import { structuralAxeRules, waitForRenderer } from './axe-helpers'
import '../components/__harness__/layout-mock'

// <zh/> 预加载异步渲染器模块 | <en/> Pre-load async renderer modules
import '../../src/components/table-renderer/TableRenderer.vue'
import '../../src/components/table-virtual-renderer/TableVirtualRenderer.vue'

describe('axe full', () => {
  it('virtual stripe passes axe core', async () => {
    const Comp = defineComponent({
      setup() {
        return () => h(AdvTable, {
          mode: 'virtual',
          stripe: true,
          height: 400,
          columns: [
            { key: 'a', prop: 'a', label: 'A', width: 100 },
            { key: 'b', prop: 'b', label: 'B', width: 100 },
          ],
          data: [{ a: '1', b: '2' }],
        })
      },
    })
    const wrapper = mount(Comp)
    expect(wrapper.find('.adv-table').exists()).toBe(true)
    // <zh/> 1y 基线：mounted 即通过（role 需内层渲染完成后）| <en/> a11y baseline: mounted passes (role needs inner render)
    expect(wrapper.html()).toContain('adv-table')
    // <zh/> 真实规则扫描：渲染器就绪后复核核心 axe 规则 | <en/> Real rule scan: re-check core axe rules once the renderer is ready
    await waitForRenderer(wrapper)
    expect(structuralAxeRules(wrapper.html())).toEqual([])
  })

  it('default fixed passes axe core', async () => {
    const Comp = defineComponent({
      setup() {
        return () => h(AdvTable, {
          mode: 'default',
          columns: [
            { key: 'a', prop: 'a', label: 'A', width: 100, fixed: 'left' },
            { key: 'b', prop: 'b', label: 'B', width: 100 },
          ],
          data: [{ a: '1', b: '2' }],
        })
      },
    })
    const wrapper = mount(Comp)
    expect(wrapper.find('.adv-table').exists()).toBe(true)
    expect(wrapper.html()).toContain('adv-table')
    await waitForRenderer(wrapper)
    expect(structuralAxeRules(wrapper.html())).toEqual([])
  })

  it('empty passes axe core', async () => {
    const Comp = defineComponent({
      setup() {
        return () => h(AdvTable, {
          mode: 'virtual',
          height: 300,
          columns: [{ key: 'a', prop: 'a', label: 'A', width: 100 }],
          data: [],
        })
      },
    })
    const wrapper = mount(Comp)
    expect(wrapper.find('.adv-table').exists()).toBe(true)
    await waitForRenderer(wrapper)
    expect(structuralAxeRules(wrapper.html())).toEqual([])
  })
})
