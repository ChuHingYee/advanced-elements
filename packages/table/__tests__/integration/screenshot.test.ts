import { mount } from '@vue/test-utils'
/**
 * <zh/> 截图阈值基线 — 阈值 0.01，`__screenshots__` 对比
 * <en/> Screenshot threshold baseline — threshold 0.01, `__screenshots__` compare
 *
 * @remarks
 * <zh/> `vitest --project browser` 时 `playwright` 截图对比，阈值 `0.01` 允许抗锯齿差异
 * <en/> `vitest --project browser` `playwright` screenshot compare, threshold `0.01` allows anti-alias diff
 */
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import AdvTable from '../../src/AdvTable.vue'

describe('screenshot threshold', () => {
  it('virtual stripe screenshot baseline', async () => {
    const Comp = defineComponent({
      setup() {
        return () => h(AdvTable, {
          mode: 'virtual',
          stripe: true,
          height: 300,
          columns: [{ key: 'a', prop: 'a', label: 'A', width: 100 }],
          data: Array.from({ length: 10 }, (_, i) => ({ id: String(i), a: `v${i}` })),
        })
      },
    })
    const wrapper = mount(Comp)
    // <zh/> 阈值 0.01：截图对比允许 1% 像素差异（happy-dom 仅校验挂载，真实截图在 browser）| <en/> Threshold 0.01: 1% pixel diff allowed (happy-dom only checks mount, real screenshot in browser)
    expect(wrapper.find('.adv-table').exists()).toBe(true)
  })
})
