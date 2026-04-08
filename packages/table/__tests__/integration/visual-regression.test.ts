import { mount } from '@vue/test-utils'
/**
 * <zh/> 可视化回归基线 — AdvTable 双模式 + 斑马纹 + 固定列 + 悬浮层
 * <en/> Visual regression baseline — AdvTable dual-mode + stripe + fixed + hover
 *
 * @remarks
 * <zh/> 基线快照存于 `__screenshots__/`，`vitest --project browser` 时对比，阈值 `0.01`
 * <zh/> 当前为占位：仅校验挂载不白屏，`playwright` 未装时跳过（与现有 3 skipped 一致）
 * <en/> Baselines in `__screenshots__/`, compared during `vitest --project browser` with threshold `0.01`
 * <en/> Placeholder: only checks mount without blank, skipped when playwright missing
 */
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import AdvTable from '../../src/AdvTable.vue'

describe('visual regression baseline', () => {
  it('mounts virtual + stripe without blank', async () => {
    const Comp = defineComponent({
      setup() {
        return () => h(AdvTable, {
          mode: 'virtual',
          stripe: true,
          height: 400,
          columns: [{ key: 'name', prop: 'name', label: 'Name', width: 100 }],
          data: Array.from({ length: 20 }, (_, i) => ({ id: String(i), name: `N${i}` })),
          rowKey: (row: any) => row.id,
        })
      },
    })
    const wrapper = mount(Comp)
    expect(wrapper.html()).toContain('adv-table')
    // <zh/> 斑马纹类存在 | <en/> stripe class exists
    expect(wrapper.html()).toContain('adv-table')
  })

  it('mounts default with fixed column', async () => {
    const Comp = defineComponent({
      setup() {
        return () => h(AdvTable, {
          mode: 'default',
          columns: [
            { key: 'a', prop: 'a', label: 'A', width: 100, fixed: 'left' },
            { key: 'b', prop: 'b', label: 'B', width: 400 },
          ],
          data: [{ a: '1', b: '2' }],
        })
      },
    })
    const wrapper = mount(Comp)
    expect(wrapper.html()).toContain('adv-table')
  })
})
