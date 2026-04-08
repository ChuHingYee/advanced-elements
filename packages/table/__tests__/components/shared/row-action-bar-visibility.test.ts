import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { computed, defineComponent, h, nextTick, ref } from 'vue'
import RowActionBar from '../../../src/components/cell-renderers/row-action-bar.vue'
import { advTableHoverLayerKey } from '../../../src/types/config'
import { advTableKey } from '../../../src/types/injection-keys'

/**
 * <zh/> RowActionBar 单源可见性回归——`isEffectivelyVisible` 是 `--visible` 类与
 * <zh/> `data-hover-visible` 属性的唯一来源（替代 CSS :hover + !important 三方共治）。
 * <en/> RowActionBar single-source visibility regression — `isEffectivelyVisible` is the sole
 * <en/> source of the `--visible` class and the `data-hover-visible` attribute (replacing the
 * <en/> CSS :hover + !important three-way rule).
 */

const ACTIONS = [{ label: 'Edit', code: 'edit' }] as any[]

function mountBar(options: {
  row?: Record<string, unknown>
  visible?: boolean
  isTeleport?: boolean
  hoverKey?: string | null
  provideHover?: boolean
  actions?: any[]
}) {
  const {
    row = { id: '1', name: 'Alice' },
    visible = true,
    isTeleport = false,
    hoverKey = null,
    provideHover = true,
    actions = ACTIONS,
  } = options
  const hoverRowKey = ref<string | null>(hoverKey)
  const shell = defineComponent({
    setup() {
      return () => h(RowActionBar as any, {
        visible,
        hoverOptionColumns: [{ actions }] as any,
        row,
        rowIndex: 0,
        isTeleport,
      })
    },
  })
  const wrapper = mount(shell, {
    global: {
      provide: {
        ...(provideHover
          ? {
              [advTableHoverLayerKey as symbol]: {
                hoverRowKey,
                hoverLayerVisible: computed(() => hoverKey != null),
                hoverLayerCollapsed: ref(false),
                hoverLayerStyle: computed(() => ({})),
                hoverOptionColumns: computed(() => []),
                hoverOptionTeleport: computed(() => false),
                shouldUseTeleport: computed(() => false),
                onToggleCollapse: () => {},
              },
            }
          : {}),
        [advTableKey as symbol]: {
          rowKeyMeta: ref({ keyFn: (r: any) => String(r.id) }),
          containerVisible: ref(true),
        },
      },
    },
  })
  return { wrapper, hoverRowKey }
}

function barClasses(wrapper: ReturnType<typeof mount>): string[] {
  return wrapper.find('.adv-table-row-action-bar').classes()
}

describe('row-action-bar single-source visibility', () => {
  it('inline: shows only when its row key equals hoverRowKey', async () => {
    const { wrapper } = mountBar({ hoverKey: '1' })
    await nextTick()
    const bar = wrapper.find('.adv-table-row-action-bar')
    expect(bar.attributes('data-hover-visible')).toBe('true')
    expect(barClasses(wrapper)).toContain('adv-table-row-action-bar--visible')
    wrapper.unmount()
  })

  it('inline: hides when another row hovers (single row visible at a time)', async () => {
    const { wrapper, hoverRowKey } = mountBar({ hoverKey: '1' })
    await nextTick()
    expect(wrapper.find('.adv-table-row-action-bar').attributes('data-hover-visible')).toBe('true')
    hoverRowKey.value = '2'
    await nextTick()
    const bar = wrapper.find('.adv-table-row-action-bar')
    expect(bar.attributes('data-hover-visible')).toBeUndefined()
    expect(barClasses(wrapper)).not.toContain('adv-table-row-action-bar--visible')
    wrapper.unmount()
  })

  it('teleport: follows the visible prop regardless of hover key (legacy semantics)', async () => {
    const { wrapper } = mountBar({ isTeleport: true, hoverKey: null })
    await nextTick()
    // <zh/> teleport 传送到 body，断言走 document | <en/> teleported to body, assert against document
    const bar = document.body.querySelector('.adv-table-row-action-bar')
    expect(bar).not.toBeNull()
    expect(bar!.getAttribute('data-hover-visible')).toBe('true')
    expect(bar!.classList.contains('adv-table-row-action-bar--visible')).toBe(true)
    wrapper.unmount()
  })

  it('standalone without inject: falls back to legacy visible semantics', async () => {
    const { wrapper } = mountBar({ provideHover: false, hoverKey: null })
    await nextTick()
    const bar = wrapper.find('.adv-table-row-action-bar')
    expect(bar.attributes('data-hover-visible')).toBe('true')
    expect(barClasses(wrapper)).toContain('adv-table-row-action-bar--visible')
    wrapper.unmount()
  })

  it('hidden bar is inert (assistive tech cannot reach invisible buttons)', async () => {
    const { wrapper } = mountBar({ hoverKey: '2' })
    await nextTick()
    const bar = wrapper.find('.adv-table-row-action-bar')
    expect(bar.attributes('data-hover-visible')).toBeUndefined()
    expect(bar.attributes('inert')).toBeDefined()
    wrapper.unmount()
  })
})
