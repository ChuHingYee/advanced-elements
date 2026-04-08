import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import RowActionBar from '../../../src/components/cell-renderers/row-action-bar.vue'
import { advTableHoverLayerKey } from '../../../src/types/config'
import { advTableKey } from '../../../src/types/injection-keys'

const ACTIONS = [{ label: 'Edit', code: 'edit' }] as any[]

// <zh/> 最小挂载壳（复用 row-action-bar-visibility 的 provide 形态，另收 scrollBody/开关）
// <en/> Minimal mount shell (reuses the visibility suite's provide shape, plus scrollBody/switches)
function mountBar(options: {
  actions?: any[]
  isTeleport?: boolean
  hover?: Record<string, any> | null
} = {}) {
  const { actions = ACTIONS, isTeleport = false, hover = {} } = options
  const shell = defineComponent({
    props: { cols: { type: Array, default: () => [{ actions }] } },
    setup(props) {
      return () => h(RowActionBar as any, {
        visible: true,
        hoverOptionColumns: props.cols as any,
        row: { id: '1' },
        rowIndex: 0,
        isTeleport,
      })
    },
  })
  const hoverRowKey = ref<string | null>(null)
  const wrapper = mount(shell, {
    global: {
      provide: {
        ...(hover === null
          ? {}
          : {
              [advTableHoverLayerKey as symbol]: {
                hoverRowKey,
                hoverLayerVisible: ref(true),
                hoverLayerCollapsed: ref(false),
                hoverLayerStyle: computed(() => ({})),
                hoverOptionColumns: computed(() => []),
                hoverOptionTeleport: computed(() => false),
                shouldUseTeleport: computed(() => false),
                onToggleCollapse: vi.fn(),
                ...hover,
              },
            }),
        [advTableKey as symbol]: {
          rowKeyMeta: ref({ keyFn: (r: any) => String(r.id) }),
          containerVisible: ref(true),
        },
      },
    },
  })
  const bar = wrapper.findComponent(RowActionBar as any)
  return { wrapper, bar }
}

/**
 * <zh/> RowActionBar 事件转发小覆盖：mouseenter/leave、收起切换双分支、teleport 滚轮/中键
 * <en/> RowActionBar event-relay small coverage: mouseenter/leave, collapse-toggle both branches, teleport wheel/middle-click
 */
describe('row-action-bar event relay coverage', () => {
  it('forwards mouseenter and mouseleave as emits', async () => {
    // <zh/> handleMouseEnter/Leave → emit 透传 | <en/> handleMouseEnter/Leave → emit passthrough
    const { bar, wrapper } = mountBar()
    const root = bar.find('.adv-table-row-action-bar')
    await root.trigger('mouseenter')
    await root.trigger('mouseleave')
    expect(bar.emitted('mouseenter')).toHaveLength(1)
    expect(bar.emitted('mouseleave')).toHaveLength(1)
    wrapper.unmount()
  })

  it('routes collapse toggle through hoverApi when present, else emits', async () => {
    // <zh/> 有 hoverApi.onToggleCollapse → 调用之且不 emit | <en/> with hoverApi.onToggleCollapse → calls it, no emit
    const onToggleCollapse = vi.fn()
    const withHover = mountBar({ hover: { onToggleCollapse } })
    await withHover.bar.find('.adv-table-row-action-bar__toggle').trigger('click')
    expect(onToggleCollapse).toHaveBeenCalledTimes(1)
    expect(withHover.bar.emitted('toggleCollapse')).toBeUndefined()
    withHover.wrapper.unmount()
    // <zh/> 无 hoverApi → emit('toggleCollapse') 回退分支 | <en/> without hoverApi → emit('toggleCollapse') fallback branch
    const withoutHover = mountBar({ hover: null })
    await withoutHover.bar.find('.adv-table-row-action-bar__toggle').trigger('click')
    expect(withoutHover.bar.emitted('toggleCollapse')).toHaveLength(1)
    withoutHover.wrapper.unmount()
  })

  it('ignores wheel when not teleported', async () => {
    // <zh/> 非 teleport 直接返回，无 forceHide | <en/> non-teleport returns early, no forceHide
    const { bar, wrapper } = mountBar()
    await bar.find('.adv-table-row-action-bar').trigger('wheel', { deltaX: 5, deltaY: 5 } as any)
    expect(bar.emitted('forceHide')).toBeUndefined()
    wrapper.unmount()
  })

  it('forwards teleport wheel via scrollBody, else forceHides', async () => {
    // <zh/> scrollBody 成功 → preventDefault 且不 forceHide | <en/> scrollBody success → preventDefault, no forceHide
    const ok = mountBar({ isTeleport: true, hover: { scrollBody: vi.fn(() => true) } })
    const el = document.body.querySelector('.adv-table-row-action-bar') as HTMLElement
    expect(el).toBeTruthy()
    const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 5, deltaY: 5 })
    el.dispatchEvent(wheel)
    expect(wheel.defaultPrevented).toBe(true)
    expect(ok.bar.emitted('forceHide')).toBeUndefined()
    ok.wrapper.unmount()
    // <zh/> scrollBody 失败/缺失 → forceHide 回退 | <en/> scrollBody failure/missing → forceHide fallback
    const fail = mountBar({ isTeleport: true, hover: { scrollBody: vi.fn(() => false) } })
    const el2 = document.body.querySelector('.adv-table-row-action-bar') as HTMLElement
    el2.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 5, deltaY: 5 }))
    expect(fail.bar.emitted('forceHide')).toHaveLength(1)
    fail.wrapper.unmount()
  })

  it('forceHides on middle-click only in teleport mode', async () => {
    // <zh/> 中键（button 1）→ forceHide，左键无操作 | <en/> middle button (1) → forceHide, left button is a no-op
    const { bar, wrapper } = mountBar({ isTeleport: true })
    const el = document.body.querySelector('.adv-table-row-action-bar') as HTMLElement
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 1 }))
    expect(bar.emitted('forceHide')).toHaveLength(1)
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }))
    expect(bar.emitted('forceHide')).toHaveLength(1)
    wrapper.unmount()
  })

  it('reuses the previous actions array when items are identical', async () => {
    // <zh/> allActions 比较闭包：同引用条目 → 返回 prev（引用稳定）| <en/> allActions comparator closure: identical items → returns prev (referential stability)
    const { wrapper } = mountBar()
    const before = wrapper.html()
    await wrapper.setProps({ cols: [{ actions: [...ACTIONS] }] })
    expect(wrapper.html()).toBe(before)
    wrapper.unmount()
  })
})
