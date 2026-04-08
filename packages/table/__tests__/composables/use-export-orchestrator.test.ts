import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useExportOrchestrator } from '../../src/composables/features/use-export-orchestrator'

/**
 * <zh/> 导出编排壳单测——实现层 mock，覆盖并发守卫、透传、选择框单例与卸载清理。
 * <en/> Export-orchestrator shell tests with mocked impl — concurrency guards, delegation, picker singleton and teardown.
 */
const implState = {
  exportExcel: vi.fn(async (_o?: any) => true),
  exportCsv: vi.fn(async (_o?: any) => true),
  doPrint: vi.fn(async (_o?: any) => {}),
  handleFileSelected: vi.fn(async (_f?: File) => {}),
}

vi.mock('../../src/composables/features/export-impl', () => ({
  createExportImpl: vi.fn(() => implState),
}))

function setupShell() {
  let api!: ReturnType<typeof useExportOrchestrator>
  const wrapper = mount(defineComponent({
    setup() {
      api = useExportOrchestrator({
        columnClassification: { value: { normal: [] } } as any,
        localColumns: { value: [] } as any,
        tableData: { value: [] } as any,
        visibleData: { value: [] } as any,
        filteredData: { value: [] } as any,
        selectionState: { getSelectedRows: () => [] } as any,
        tableContext: {} as any,
        effectiveColumns: { value: [] } as any,
        exportOptions: () => ({}),
        exportCsvOptions: () => ({}),
        printOptions: () => ({}),
        importOptions: () => ({ accept: ['.csv'] }),
        t: (k: string) => k,
        onDataUpdate: vi.fn(),
        onDataImport: vi.fn(),
      } as any)
      return () => h('div')
    },
  }), { attachTo: document.body })
  return { api, wrapper }
}

describe('useExportOrchestrator', () => {
  it('starts idle', () => {
    const { api, wrapper } = setupShell()
    expect(api.exporting.value).toBe(false)
    expect(api.exportingCsv.value).toBe(false)
    expect(api.printing.value).toBe(false)
    expect(api.importing.value).toBe(false)
    wrapper.unmount()
  })

  it('delegates exportExcel and resets the flag', async () => {
    const { api, wrapper } = setupShell()
    implState.exportExcel.mockClear()
    const opts = { fileName: 'a' }
    const p = api.exportExcel(opts as any)
    expect(api.exporting.value).toBe(true)
    await expect(p).resolves.toBe(true)
    expect(implState.exportExcel).toHaveBeenCalledWith(opts)
    expect(api.exporting.value).toBe(false)
    wrapper.unmount()
  })

  it('rejects concurrent exportExcel with false', async () => {
    const { api, wrapper } = setupShell()
    const first = api.exportExcel()
    await expect(api.exportExcel()).resolves.toBe(false)
    await first.catch(() => {})
    wrapper.unmount()
  })

  it('resets the flag and rethrows when the impl fails', async () => {
    const { api, wrapper } = setupShell()
    implState.exportCsv.mockRejectedValueOnce(new Error('xlsx down'))
    await expect(api.exportCsv()).rejects.toThrow('xlsx down')
    expect(api.exportingCsv.value).toBe(false)
    wrapper.unmount()
  })

  it('guards concurrent print', async () => {
    const { api, wrapper } = setupShell()
    const first = api.doPrint()
    await expect(api.doPrint()).resolves.toBeUndefined()
    await first.catch(() => {})
    expect(api.printing.value).toBe(false)
    wrapper.unmount()
  })

  it('opens the picker singleton and destroys it on unmount', () => {
    const { api, wrapper } = setupShell()
    api.triggerImport()
    const input = document.body.querySelector('input[type="file"]')
    expect(input).not.toBeNull()
    expect((input as HTMLInputElement).accept).toBe('.csv')
    wrapper.unmount()
    expect(document.body.querySelector('input[type="file"]')).toBeNull()
  })

  it('routes picked files to the impl and resets importing', async () => {
    const { api, wrapper } = setupShell()
    implState.handleFileSelected.mockClear()
    api.triggerImport()
    const input = document.body.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['a,b'], 'data.csv', { type: 'text/csv' })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    input.dispatchEvent(new Event('change'))
    await new Promise(r => setTimeout(r, 20))
    expect(implState.handleFileSelected).toHaveBeenCalledWith(file)
    expect(api.importing.value).toBe(false)
    wrapper.unmount()
  })
})
