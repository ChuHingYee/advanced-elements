import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import ColumnGroupSidePanel from '../../../src/components/column-group/column-group-side-panel.vue'
import ColumnSettingSidePanel from '../../../src/components/column-setting/column-setting-side-panel.vue'
import { advTableColumnGroupKey } from '../../../src/types/injection-keys'

/**
 * <zh/> 侧边面板单测——渲染、应用/重置、关闭。
 * <en/> Side-panel tests — render, apply/reset, close.
 */
describe('columnGroupSidePanel', () => {
  function setupPanel(api: any = {}) {
    return mount(ColumnGroupSidePanel as any, {
      props: { position: 'right' },
      global: {
        provide: {
          [advTableColumnGroupKey as symbol]: {
            configTree: ref([]),
            options: ref({ allowRename: true }),
            isDirty: ref(true),
            applyConfig: vi.fn(),
            resetConfig: vi.fn(),
            ...api,
          },
        },
        stubs: { VueDraggable: { template: '<div><slot /></div>' } },
      },
    })
  }

  it('renders with title', async () => {
    const wrapper = setupPanel()
    await nextTick()
    // <zh/> 标题走 i18n 解析为人类文本（英文环境 'Column Group'），断言标题位有文本而非空壳
    // <en/> Title resolves through i18n to human text ('Column Group' in English): assert real title text, not an empty shell
    expect(wrapper.text()).toContain('Column Group')
    wrapper.unmount()
  })

  it('applies and closes', async () => {
    const applyConfig = vi.fn()
    const wrapper = setupPanel({ applyConfig })
    await nextTick()
    const btns = wrapper.findAll('button')
    await btns[btns.length - 1].trigger('click')
    await nextTick()
    expect(applyConfig).toHaveBeenCalled()
    expect(wrapper.emitted('close')).toBeDefined()
    wrapper.unmount()
  })

  it('resets without closing', async () => {
    const resetConfig = vi.fn()
    const wrapper = setupPanel({ resetConfig })
    await nextTick()
    const btns = wrapper.findAll('button')
    await btns[0].trigger('click')
    await nextTick()
    expect(resetConfig).toHaveBeenCalled()
    wrapper.unmount()
  })
})

describe('columnSettingSidePanel', () => {
  it('renders headers and closes', async () => {
    const resetColumns = vi.fn()
    const wrapper = mount(ColumnSettingSidePanel as any, {
      props: {
        'originColumns': [{ key: 'a', prop: 'a', label: 'A' }],
        'originColumnsFormatMap': {},
        resetColumns,
        'position': 'left',
        'headers': [{ key: 'a', prop: 'a', label: 'A' }],
        'onUpdate:headers': () => {},
      },
      global: {
        stubs: { VueDraggable: { template: '<div><slot /></div>' } },
      },
    })
    await nextTick()
    // <zh/> 传入的表头必须渲染出 label 文本
    // <en/> Passed headers must render their label text
    expect(wrapper.text()).toContain('A')
    wrapper.unmount()
  })
})
