import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import { useContextMenuOrchestrator } from '../../src/composables/features/use-context-menu-orchestrator'

/**
 * <zh/> 右键菜单编排单测——真实子编排，覆盖单元格/表头入口派发与菜单关闭。
 * <en/> Context-menu orchestrator tests with real subs — cell/header entry dispatch and close.
 */
function setupOrchestrator(opts: {
  menuConfig?: () => any
  startEditing?: any
  selectedRows?: any[]
  interceptor?: any
} = {}) {
  const emit = vi.fn()
  const selectionState = { getSelectedRows: () => opts.selectedRows ?? [] }
  let api!: ReturnType<typeof useContextMenuOrchestrator>
  const wrapper = mount(defineComponent({
    setup() {
      api = useContextMenuOrchestrator({
        menuConfig: opts.menuConfig ?? (() => undefined),
        effectiveColumns: ref([]),
        selectionState: selectionState as any,
        startEditing: opts.startEditing ?? vi.fn(),
        updateCellEditingValue: vi.fn(),
        commitEditing: vi.fn(),
        applyColumnState: vi.fn(),
        resetColumnState: vi.fn(),
        clearSort: vi.fn(),
        resetColumnFilter: vi.fn(),
        resetAllFilters: vi.fn(),
        exportCsv: vi.fn(),
        exportExcel: vi.fn(),
        triggerImport: vi.fn(),
        doPrint: vi.fn(),
        interceptor: opts.interceptor ?? ({ trigger: () => false } as any),
        crossCutting: {
          t: (k: string) => k,
          tableId: computed(() => 't1'),
          handleError: vi.fn(),
          isUnmounted: { value: false },
        },
        emit: emit as any,
      })
      return () => h('div')
    },
  }))
  return { api, wrapper, emit }
}

function cellEvent(): any {
  const target = document.createElement('td')
  document.body.appendChild(target)
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'target', { value: target })
  return { event, target }
}

describe('useContextMenuOrchestrator', () => {
  it('exposes menu state and handlers', () => {
    const { api, wrapper } = setupOrchestrator()
    expect(api.menuVisible.value).toBe(false)
    expect(typeof api.handleCellContextmenu).toBe('function')
    expect(typeof api.handleHeaderContextmenu).toBe('function')
    expect(typeof api.closeMenu).toBe('function')
    wrapper.unmount()
  })

  it('dispatches cell contextmenu with tableId trailing', async () => {
    const { api, emit, wrapper } = setupOrchestrator()
    const { event, target } = cellEvent()
    api.handleCellContextmenu({
      rowData: { id: 1 },
      rowIndex: 0,
      column: { prop: 'a' } as any,
      columnIndex: 0,
      event,
    })
    await new Promise(r => setTimeout(r, 10))
    const call = emit.mock.calls.find(c => c[0] === 'cellContextmenu')
    expect(call).toBeDefined()
    expect(call![call!.length - 1]).toBe('t1')
    target.remove()
    wrapper.unmount()
  })

  it('dispatches header contextmenu with tableId trailing', async () => {
    const { api, emit, wrapper } = setupOrchestrator()
    const { event, target } = cellEvent()
    api.handleHeaderContextmenu({ column: { prop: 'a' } as any, columnIndex: 0, event })
    await new Promise(r => setTimeout(r, 10))
    const call = emit.mock.calls.find(c => c[0] === 'headerContextmenu')
    expect(call).toBeDefined()
    expect(call![call!.length - 1]).toBe('t1')
    target.remove()
    wrapper.unmount()
  })

  it('closeMenu hides the menu', async () => {
    const { api, wrapper } = setupOrchestrator()
    api.closeMenu()
    expect(api.menuVisible.value).toBe(false)
    wrapper.unmount()
  })

  it('clicks builtin menu items through to actions and events', async () => {
    const startEditing = vi.fn()
    const { api, emit, wrapper } = setupOrchestrator({
      menuConfig: () => ({
        body: { enabled: true, options: [[{ code: 'copySelectedRows', label: 'Copy' }]] },
      }),
      startEditing,
    })
    const target = document.createElement('td')
    document.body.appendChild(target)
    await api.handleContextMenu({
      area: 'body',
      row: { id: 1 },
      rowIndex: 0,
      column: { prop: 'a' },
      columnIndex: 0,
      event: { preventDefault: () => {}, target, clientX: 10, clientY: 10 },
    })
    expect(api.menuVisible.value).toBe(true)
    await api.onMenuItemClick({ code: 'copySelectedRows', label: 'Copy' } as any)
    expect(emit.mock.calls.some(c => c[0] === 'contextMenuClick')).toBe(true)
    expect(api.menuVisible.value).toBe(false)
    target.remove()
    wrapper.unmount()
  })

  it('reports builtin action failures as structured errors', async () => {
    const startEditing = vi.fn(() => {
      throw new Error('edit down')
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { api, emit, wrapper } = setupOrchestrator({
      menuConfig: () => ({
        body: { enabled: true, options: [[{ code: 'editCell', label: 'Edit' }]] },
      }),
      startEditing,
    })
    const target = document.createElement('td')
    document.body.appendChild(target)
    await api.handleContextMenu({
      area: 'body',
      row: { id: 1 },
      rowIndex: 0,
      column: { prop: 'a' },
      columnIndex: 0,
      event: { preventDefault: () => {}, target, clientX: 10, clientY: 10 },
    })
    await api.onMenuItemClick({ code: 'editCell', label: 'Edit' } as any)
    await new Promise(r => setTimeout(r, 10))
    const err = emit.mock.calls.find(c => c[0] === 'error')
    expect(err).toBeDefined()
    expect(err![err!.length - 1]).toBe('t1')
    target.remove()
    wrapper.unmount()
  })

  it('reports contextmenu pipeline failures as structured errors', async () => {
    const { api, emit, wrapper } = setupOrchestrator({
      menuConfig: () => ({
        body: { enabled: true, options: [[{ code: 'copySelectedRows', label: 'Copy' }]] },
      }),
      interceptor: { trigger: () => { throw new Error('intercept down') } },
    })
    api.handleCellContextmenu({
      rowData: { id: 1 },
      rowIndex: 0,
      column: { prop: 'a' } as any,
      columnIndex: 0,
      event: {},
    })
    await new Promise(r => setTimeout(r, 10))
    const err = emit.mock.calls.find(c => c[0] === 'error')
    expect(err).toBeDefined()
    expect(err![1]).toMatchObject({ code: 'TABLE_CONTEXT_ACTION_FAILED' })
    wrapper.unmount()
  })

  it('reports copy transport failures through onError', async () => {
    const writeText = navigator.clipboard.writeText as unknown as ReturnType<typeof vi.fn>
    writeText.mockRejectedValueOnce(new Error('denied'))
    Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true, writable: true })
    const { api, emit, wrapper } = setupOrchestrator({
      menuConfig: () => ({
        body: { enabled: true, options: [[{ code: 'copySelectedRows', label: 'Copy' }]] },
      }),
      selectedRows: [{ id: 1, name: 'A' }],
    })
    const target = document.createElement('td')
    document.body.appendChild(target)
    await api.handleContextMenu({
      area: 'body',
      row: { id: 1 },
      rowIndex: 0,
      column: { prop: 'name' },
      columnIndex: 0,
      event: { preventDefault: () => {}, target, clientX: 10, clientY: 10 },
    })
    await api.onMenuItemClick({ code: 'copySelectedRows', label: 'Copy' } as any)
    await new Promise(r => setTimeout(r, 50))
    const err = emit.mock.calls.find(c => c[0] === 'error')
    expect(err).toBeDefined()
    target.remove()
    wrapper.unmount()
  })
})
