import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
import { buildAdvTableProjection } from '../../src/composables/core/use-adv-table-projection'

/**
 * <zh/> 主编排器投影契约锁——后续重构不得丢字段、不得拷贝引用。
 * <zh/> 只锁顶层 key 集 + 关键身份透传（keepPanelAlive、api、slots），不 mock 子编排器逻辑。
 * <en/> Projection contract lock for the main orchestrator — pure code-motion splits must not
 * <en/> drop fields or copy references. Locks top-level keys + identity passthrough only.
 */
function makeDeps() {
  const keepPanelAlive = computed(() => true)
  const api = { refresh: () => Promise.resolve() }
  const slots = {}
  const editApi = { startEditing: () => {} }
  return {
    deps: {
      core: {
        tableId: ref('t1'),
        t: (k: string) => k,
        rendererAdapter: { caps: ref({}), dom: { getRowSelector: () => '' } },
      },
      dataColumns: { mergedLoading: ref(false) },
      selection: { selectionState: { getSelectedKeys: () => [] } },
      interaction: { tableRootRef: ref(null) },
      sharedEditing: { editApi, renderRows: ref([]) },
      features: { keepPanelAlive, hasSearch: ref(false) },
      rendererIntegration: { rendererComponent: {}, rendererEvents: {}, menu: {} },
      quickFilter: { setQuickFilter: () => {}, getQuickFilter: () => '' },
      slots,
      api,
    } as unknown as Parameters<typeof buildAdvTableProjection>[0],
    keepPanelAlive,
    api,
    slots,
    editApi,
  }
}

describe('buildAdvTableProjection contract', () => {
  it('exposes the stable top-level domain key set', () => {
    const { deps } = makeDeps()
    const out = buildAdvTableProjection(deps) as Record<string, unknown>
    expect(Object.keys(out).sort()).toEqual(
      [
        'api',
        'columns',
        'config',
        'data',
        'debug',
        'editing',
        'filterSort',
        'hierarchy',
        'i18n',
        'interaction',
        'io',
        'menu',
        'renderer',
        'search',
        'selection',
        'shared',
        'sidePanel',
        'span',
      ].sort(),
    )
  })

  it('passes keepPanelAlive/api/slots/editApi by identity (no copy)', () => {
    const { deps, keepPanelAlive, api, slots, editApi } = makeDeps()
    const out = buildAdvTableProjection(deps)
    // 漏掉 keepPanelAlive 会使模板 KeepAlive 恒走不缓存分支
    expect(out.sidePanel.keepPanelAlive).toBe(keepPanelAlive)
    expect(out.api).toBe(api)
    expect(out.i18n.slots).toBe(slots)
    expect(out.editing.startEditing).toBe(editApi.startEditing)
  })
})
