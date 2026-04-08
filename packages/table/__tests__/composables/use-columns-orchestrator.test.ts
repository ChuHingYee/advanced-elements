import type { ComputedRef } from 'vue'
import type { ProcessedColumn } from '../../src/types/column'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { useColumnsOrchestrator } from '../../src/composables/columns/use-columns-orchestrator'

function makeCol(key: string): ProcessedColumn {
  return { key, prop: key, label: key, hidden: false } as unknown as ProcessedColumn
}

describe('useColumnsOrchestrator — onColumnOrderChange (columnMoved single exit)', () => {
  it('does not fire on initial setup', async () => {
    const onColumnOrderChange = vi.fn()
    const cols = ref<ProcessedColumn[]>([makeCol('a'), makeCol('b')])
    useColumnsOrchestrator({
      columns: () => cols.value as any,
      defaultColDef: undefined,
      columnTypes: undefined,
      resizable: ref(false) as unknown as ComputedRef<boolean | undefined>,
      onColumnsChange: vi.fn(),
      onColumnOrderChange,
    })

    await nextTick()
    expect(onColumnOrderChange).not.toHaveBeenCalled()
  })

  it('fires exactly once per order change', async () => {
    const onColumnOrderChange = vi.fn()
    const cols = ref<ProcessedColumn[]>([makeCol('a'), makeCol('b'), makeCol('c')])
    useColumnsOrchestrator({
      columns: () => cols.value as any,
      defaultColDef: undefined,
      columnTypes: undefined,
      resizable: ref(false) as unknown as ComputedRef<boolean | undefined>,
      onColumnsChange: vi.fn(),
      onColumnOrderChange,
    })

    cols.value = [makeCol('b'), makeCol('a'), makeCol('c')]
    await nextTick()
    expect(onColumnOrderChange).toHaveBeenCalledTimes(1)
    expect(onColumnOrderChange.mock.calls[0][0].map((c: ProcessedColumn) => c.key)).toEqual(['b', 'a', 'c'])

    cols.value = [makeCol('b'), makeCol('c'), makeCol('a')]
    await nextTick()
    expect(onColumnOrderChange).toHaveBeenCalledTimes(2)
  })

  it('does not re-fire on echo (same order re-set)', async () => {
    const onColumnOrderChange = vi.fn()
    const cols = ref<ProcessedColumn[]>([makeCol('a'), makeCol('b')])
    useColumnsOrchestrator({
      columns: () => cols.value as any,
      defaultColDef: undefined,
      columnTypes: undefined,
      resizable: ref(false) as unknown as ComputedRef<boolean | undefined>,
      onColumnsChange: vi.fn(),
      onColumnOrderChange,
    })

    cols.value = [makeCol('b'), makeCol('a')]
    await nextTick()
    expect(onColumnOrderChange).toHaveBeenCalledTimes(1)

    cols.value = [makeCol('b'), makeCol('a')]
    await nextTick()
    expect(onColumnOrderChange).toHaveBeenCalledTimes(1)
  })
})
