import type { AdvColumn } from '../../src/types/column'
import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
import { useTableRowKey } from '../../src/composables/core/use-table-row-key'

const sizeConfig = computed(() => ({
  headerCellHeight: 40,
  cellPadding: '8px',
  headerCellPadding: '12px',
  floatingFilterHeight: 32,
  cellFontSize: '14px',
  rowHeight: 48,
  summaryRowHeight: 36,
}))
function devWarn() {}

describe('useTableRowKey', () => {
  it('normalizes a string rowKey', () => {
    const { rowKeyFn } = useTableRowKey({ rowKeyInput: 'id', columns: [], devWarn, mergedSizeConfig: sizeConfig })
    expect(rowKeyFn.value({ id: 7 })).toBe('7')
  })

  it('falls back to an auto key without config', () => {
    const { rowKeyFn } = useTableRowKey({ rowKeyInput: undefined, columns: undefined, devWarn, mergedSizeConfig: sizeConfig })
    expect(typeof rowKeyFn.value({})).toBe('string')
  })

  it('resolves selectable from the selection column', () => {
    const selectable = () => true
    const columns = [{ key: 'sel', selection: true, selectable } as unknown as AdvColumn]
    const { selectableFn } = useTableRowKey({ rowKeyInput: undefined, columns, devWarn, mergedSizeConfig: sizeConfig })
    expect(selectableFn.value).toBe(selectable)
  })

  it('returns undefined selectable without a selection column', () => {
    const { selectableFn } = useTableRowKey({ rowKeyInput: undefined, columns: [], devWarn, mergedSizeConfig: sizeConfig })
    expect(selectableFn.value).toBeUndefined()
  })

  it('exposes size css vars', () => {
    const { sizeCssVars } = useTableRowKey({ rowKeyInput: undefined, columns: [], devWarn, mergedSizeConfig: sizeConfig })
    expect(sizeCssVars.value['--adv-table-row-height']).toBe('48px')
    expect(sizeCssVars.value['--adv-table-header-cell-height']).toBe('40px')
  })

  it('accepts ref/getter slices and stays reactive', () => {
    const rowKeyInput = ref<string | undefined>('id')
    const { rowKeyFn } = useTableRowKey({ rowKeyInput, columns: () => undefined, devWarn, mergedSizeConfig: sizeConfig })
    expect(rowKeyFn.value({ id: 1 })).toBe('1')
    rowKeyInput.value = 'code'
    expect(rowKeyFn.value({ code: 'x' })).toBe('x')
  })
})
