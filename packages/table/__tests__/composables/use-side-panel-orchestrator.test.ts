import type { ComputedRef, Ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
import { useSidePanelOrchestrator } from '../../src/composables/features/use-side-panel-orchestrator'

/**
 * <zh/> 回归：`sidePanelDestroyOnClose` 必须真的决定「关闭即销毁 / 保留实例」。
 * <zh/> `keepPanelAlive` 是模板 `<KeepAlive :include>` 的唯一输入，因此这里的取值直接决定
 * <zh/> Vue KeepAlive 走缓存分支（deactivate）还是非缓存分支（真实 unmount）。
 * <en/> regression: `sidePanelDestroyOnClose` must really decide destroy-vs-retain.
 * <en/> `keepPanelAlive` is the sole input of the template's `<KeepAlive :include>`, so its value
 * <en/> directly decides whether Vue takes the caching branch (deactivate) or the plain branch (unmount).
 */
function makeOptions(overrides: {
  filter?: Record<string, unknown>
  column?: Record<string, unknown>
  columnGroup?: Record<string, unknown>
} = {}) {
  const mergedFilterConfig: ComputedRef<any> = computed(() => overrides.filter ?? {})
  const mergedColumnConfig: ComputedRef<any> = computed(() => overrides.column ?? {})
  const columnGroupApi = {
    options: ref(overrides.columnGroup ?? {}) as Ref<any>,
    isDirty: ref(false),
    resetConfig: () => {},
    panelPosition: ref('right'),
  } as any
  const filterPanelApi = {
    panelPosition: ref('left') as Ref<'left' | 'right'>,
    activeFilterKeys: ref(new Set<string>()) as Ref<Set<string>>,
  } as any
  return { mergedFilterConfig, mergedColumnConfig, columnGroupApi, filterPanelApi }
}

describe('useSidePanelOrchestrator', () => {
  describe('destroy-on-close', () => {
    it('keepPanelAlive=false by default (sidePanelDestroyOnClose defaults to true)', () => {
      const api = useSidePanelOrchestrator(makeOptions({ filter: { sidePanel: true } }))

      api.togglePanel('filter')

      expect(api.activePanel.value).toBe('filter')
      expect(api.destroyOnClose.value).toBe(true)
      // <zh/> 关键：默认必须不保留，否则 KeepAlive 会把「默认销毁」契约彻底废掉
      // <en/> Critical: must not retain by default, otherwise KeepAlive voids the destroy-by-default contract
      expect(api.keepPanelAlive.value).toBe(false)
    })

    it('keepPanelAlive=true when sidePanelDestroyOnClose=false', () => {
      const api = useSidePanelOrchestrator(makeOptions({
        filter: { sidePanel: true, sidePanelDestroyOnClose: false },
      }))

      api.togglePanel('filter')

      expect(api.destroyOnClose.value).toBe(false)
      expect(api.keepPanelAlive.value).toBe(true)
    })

    it('reads the flag per active panel (filter vs column are independent)', () => {
      const api = useSidePanelOrchestrator(makeOptions({
        filter: { sidePanel: true, sidePanelDestroyOnClose: false },
        column: { sidePanel: true, sidePanelDestroyOnClose: true },
      }))

      api.togglePanel('filter')
      expect(api.keepPanelAlive.value).toBe(true)

      api.togglePanel('column')
      expect(api.keepPanelAlive.value).toBe(false)
    })

    it('resolves the flag from the columnGroup panel options', () => {
      const api = useSidePanelOrchestrator(makeOptions({
        column: { sidePanel: true, columnGroup: { enabled: true, sidePanelDestroyOnClose: false } },
      }))

      api.togglePanel('columnGroup')

      expect(api.activePanel.value).toBe('columnGroup')
      expect(api.keepPanelAlive.value).toBe(true)
    })

    it('keepPanelAlive is false before any panel was ever opened', () => {
      const api = useSidePanelOrchestrator(makeOptions({
        filter: { sidePanel: true, sidePanelDestroyOnClose: false },
      }))

      expect(api.activePanel.value).toBeNull()
      expect(api.keepPanelAlive.value).toBe(false)
      expect(api.destroyOnClose.value).toBe(true)
    })

    it('keepPanelAlive stays true AFTER closing a retain panel (the policy must outlive the close)', () => {
      const api = useSidePanelOrchestrator(makeOptions({
        filter: { sidePanel: true, sidePanelDestroyOnClose: false },
      }))

      api.togglePanel('filter')
      expect(api.keepPanelAlive.value).toBe(true)
      api.togglePanel('filter')

      // <zh/> 回归：关闭那一刻 `include` 仍须允许缓存，否则 KeepAlive 会销毁刚要保留的面板
      // <en/> Regression: `include` must still allow caching at the moment of close, otherwise
      // <en/> KeepAlive destroys the very panel it was asked to retain
      expect(api.activePanel.value).toBeNull()
      expect(api.keepPanelAlive.value).toBe(true)
    })

    it('keepPanelAlive returns to false after closing a destroy-on-close panel', () => {
      const api = useSidePanelOrchestrator(makeOptions({ filter: { sidePanel: true } }))

      api.togglePanel('filter')
      api.togglePanel('filter')

      expect(api.activePanel.value).toBeNull()
      expect(api.keepPanelAlive.value).toBe(false)
    })
  })

  describe('activePanel as the single source of truth', () => {
    it('resolves sidePanelDefaultOpen into the initial activePanel', () => {
      const api = useSidePanelOrchestrator(makeOptions({
        filter: { sidePanel: true, sidePanelDefaultOpen: true },
        column: { sidePanel: true, sidePanelDefaultOpen: true },
      }))

      // <zh/> 首个启用面板胜出；模板只读 activePanel，故默认值必须体现在这里
      // <en/> The first enabled panel wins; the template only reads activePanel, so the default must land here
      expect(api.activePanel.value).toBe('filter')
    })

    it('resolves the columnGroup default only when columnGroup is enabled', () => {
      const api = useSidePanelOrchestrator(makeOptions({
        column: { sidePanel: true, columnGroup: { sidePanelDefaultOpen: true } },
      }))

      expect(api.activePanel.value).toBeNull()
    })

    it('togglePanel switches between panels (mutual exclusion)', () => {
      const api = useSidePanelOrchestrator(makeOptions({
        filter: { sidePanel: true },
        column: { sidePanel: true },
      }))

      api.togglePanel('filter')
      expect(api.activePanel.value).toBe('filter')
      api.togglePanel('column')
      expect(api.activePanel.value).toBe('column')
      // <zh/> 再点同一按钮关闭——不存在并行可见的双面板
      // <en/> Clicking the same button again closes it — no two panels visible at once
      api.togglePanel('column')
      expect(api.activePanel.value).toBeNull()
    })

    it('resets dirty columnGroup config when re-entering it', () => {
      let resetCalls = 0
      const opts = makeOptions({ column: { sidePanel: true, columnGroup: { enabled: true } } })
      opts.columnGroupApi.isDirty.value = true
      opts.columnGroupApi.resetConfig = () => {
        resetCalls++
      }
      const api = useSidePanelOrchestrator(opts)

      api.togglePanel('columnGroup')
      expect(resetCalls).toBe(1)
    })
  })
})
