import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useHoverLayer } from '../../src/composables/rendering/use-hover-layer'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useHoverLayer phase3', () => {
  it('syncHoverLayerState falls back to null when key is in keyToIndex but not keyToRow', () => {
    const data = [{ id: 1 }, { id: 2 }]
    const keyFn = (row: any) => String(row.id)
    const keyToIndex = new Map<string, number>([['1', 0], ['2', 1]])
    const keyToRow = new Map<string, any>([['1', data[0]]])
    const rowKeyMeta = ref({ keyToRow, keyToIndex, keyFn, dataRef: data })

    const result = useHoverLayer({ hasHoverOptionColumns: true, rowKeyMeta })
    result.hoverRowKey.value = '2'
    result.syncHoverLayerState()
    expect(result.hoverRowIndex.value).toBe(1)
    expect(result.hoverRowData.value).toBeNull()
  })

  it('resolveRowIndex returns -1 when providedData is not available', () => {
    const result = useHoverLayer({ hasHoverOptionColumns: true })
    const row = { id: 1, name: 'orphan' }
    result.handleHoverRowEnter(row, -1)
    expect(result.hoverRowIndex.value).toBe(-1)
  })

  it('resolveRowIndex falls through to key lookup when row not found by reference', () => {
    const data = ref([{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }])
    const rowKey = ref((row: any) => String(row.id))
    const result = useHoverLayer({ hasHoverOptionColumns: true, data, rowKey })
    const row = { id: 1, name: 'Alice' }

    result.handleHoverRowEnter(row, -1)
    expect(result.hoverRowIndex.value).toBe(0)
    expect(result.hoverRowKey.value).toBe('1')
  })

  it('handleHoverRowEnter uses providedData when rowKeyMeta has no key mapping', () => {
    const data = ref([{ id: 1, name: 'Alice' }])
    const keyFn = (row: any) => String(row.id)
    const keyToIndex = new Map<string, number>()
    const keyToRow = new Map<string, any>()
    const rowKeyMeta = ref({ keyToRow, keyToIndex, keyFn, dataRef: data })
    const result = useHoverLayer({ hasHoverOptionColumns: true, data, rowKeyMeta })

    result.handleHoverRowEnter(data.value[0], -1)
    expect(result.hoverRowIndex.value).toBe(0)
    expect(result.hoverRowKey.value).toBe('1')
  })
})
