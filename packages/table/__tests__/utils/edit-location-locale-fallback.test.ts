import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
import { useCellEditLocation } from '../../src/composables/editing/use-cell-edit-location'
import { tf } from '../../src/utils/locale-fallback'

/**
 * <zh/> 编辑行定位与翻译回退单测——纯函数分支。
 * <en/> Edit-row location and locale-fallback tests — pure branches.
 */
describe('useCellEditLocation', () => {
  const rows = [{ id: 'a' }, { id: 'b' }]
  const rk = computed(() => (row: any) => String(row.id))

  function setup(key: string | null, rowRef: any) {
    return useCellEditLocation({
      rowKey: rk,
      editingRowKey: ref(key),
      editingRowRef: ref(rowRef),
    })
  }

  it('keeps the index when the key matches', () => {
    expect(setup('a', rows[0]).resolveStaleIndex(rows, 0)).toBe(0)
  })

  it('relocates by key when the row moved', () => {
    expect(setup('b', rows[1]).resolveStaleIndex(rows, 0)).toBe(1)
  })

  it('returns -1 for unknown keys', () => {
    expect(setup('zzz', null).resolveStaleIndex(rows, 0)).toBe(-1)
  })

  it('looks up missing rows by key map', () => {
    expect(setup('b', rows[1]).resolveStaleIndex(rows, 5)).toBe(1)
  })

  it('falls back to index checks without a row key', () => {
    const api = useCellEditLocation({
      rowKey: computed(() => null),
      editingRowKey: ref(null),
      editingRowRef: ref(rows[0]),
    })
    expect(api.resolveStaleIndex(rows, 0)).toBe(0)
    expect(api.resolveStaleIndex(rows, 5)).toBe(-1)
    expect(api.resolveStaleIndex([{ id: 'x' }], 0)).toBe(-1)
  })

  it('handles primitive rows without a row key', () => {
    const api = useCellEditLocation({
      rowKey: computed(() => null),
      editingRowKey: ref(null),
      editingRowRef: ref('a'),
    })
    expect(api.resolveStaleIndex(['a'] as any, 0)).toBe(0)
    expect(api.resolveStaleIndex(['b'] as any, 0)).toBe(-1)
  })
})

describe('tf', () => {
  it('returns fallback without translator', () => {
    expect(tf(undefined, 'table.x', '回退')).toBe('回退')
  })

  it('returns translations and falls back on missing keys', () => {
    expect(tf(k => `T:${k}`, 'table.x', '回退')).toBe('T:table.x')
    expect(tf(k => k, 'table.x', '回退')).toBe('回退')
    expect(tf(() => '', 'table.x', '回退')).toBe('回退')
  })

  it('falls back on non-string results and throws', () => {
    expect(tf(() => 42 as any, 'table.x', '回退')).toBe('回退')
    expect(tf(() => null as any, 'table.x', '回退')).toBe('回退')
    expect(tf(() => {
      throw new Error('down')
    }, 'table.x', '回退')).toBe('回退')
  })
})
