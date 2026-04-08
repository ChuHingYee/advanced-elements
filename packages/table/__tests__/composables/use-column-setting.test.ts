import type { ProcessedColumn } from '../../src/types/column'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useColumnSetting } from '../../src/composables/columns/use-column-setting'

vi.mock('vue', async (importOriginal) => {
  const vue = await importOriginal<typeof import('vue')>()
  return { ...vue, provide: vi.fn() }
})

function makeCol(key: string, overrides?: Partial<ProcessedColumn>): ProcessedColumn {
  return { key, prop: key, label: key, hidden: false, ...overrides } as unknown as ProcessedColumn
}

describe('useColumnSetting', () => {
  let resetColumnsMock: ReturnType<typeof vi.fn>
  let emitColumnVisibleMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    resetColumnsMock = vi.fn()
    emitColumnVisibleMock = vi.fn()
    vi.clearAllMocks()
  })

  function createSetting(cols?: ProcessedColumn[]) {
    const headers = ref<ProcessedColumn[]>(cols ?? [
      makeCol('a'),
      makeCol('b'),
      makeCol('c', { fixed: 'left' }),
      makeCol('d', { fixed: 'right' }),
    ])
    return useColumnSetting({
      headers,
      resetColumns: resetColumnsMock as any,
      emitColumnVisible: emitColumnVisibleMock as any,
    })
  }

  describe('columnGroups', () => {
    it('should partition columns into left/normal/right groups', () => {
      const { columnGroups } = createSetting()
      expect(columnGroups.value.left).toHaveLength(1)
      expect(columnGroups.value.normal).toHaveLength(2)
      expect(columnGroups.value.right).toHaveLength(1)
    })

    it('should exclude built-in columns (selection)', () => {
      const cols = [
        { key: 'sel', selection: true } as unknown as ProcessedColumn,
        makeCol('a'),
      ]
      const { columnGroups } = createSetting(cols)
      expect(columnGroups.value.normal).toHaveLength(1)
    })
  })

  describe('handleHiddenChange', () => {
    it('should toggle column visibility', () => {
      const { handleHiddenChange, headers } = createSetting()

      handleHiddenChange(makeCol('a'), false)

      const colA = headers.value.find(c => c.key === 'a')
      expect(colA?.hidden).toBe(true)
    })

    it('should emit columnVisible event', () => {
      const { handleHiddenChange } = createSetting()

      handleHiddenChange(makeCol('a'), false)

      expect(emitColumnVisibleMock).toHaveBeenCalledWith({
        columnKey: 'a',
        visible: false,
      })
    })

    it('should make column visible when visible=true', () => {
      const cols = [makeCol('a', { hidden: true })]
      const { handleHiddenChange, headers } = createSetting(cols)

      handleHiddenChange(makeCol('a'), true)

      const colA = headers.value.find(c => c.key === 'a')
      expect(colA?.hidden).toBe(false)
    })
  })

  describe('setFixedTo', () => {
    it('should set column fixed to left', () => {
      const { setFixedTo, headers } = createSetting()

      setFixedTo(makeCol('a'), 'left')

      const colA = headers.value.find(c => c.key === 'a')
      expect(colA?.fixed).toBe('left')
    })

    it('should set column fixed to right', () => {
      const { setFixedTo, headers } = createSetting()

      setFixedTo(makeCol('a'), 'right')

      const colA = headers.value.find(c => c.key === 'a')
      expect(colA?.fixed).toBe('right')
    })
  })

  describe('unfixColumn', () => {
    it('should remove fixed from non-pinned column', () => {
      const cols = [makeCol('a', { fixed: 'left', pinFixed: undefined })]
      const { unfixColumn, headers } = createSetting(cols)

      unfixColumn(headers.value[0])

      expect(headers.value[0].fixed).toBeUndefined()
    })

    it('should not unfix pinned column', () => {
      const cols = [makeCol('a', { fixed: 'left', pinFixed: 'left' })]
      const { unfixColumn, headers } = createSetting(cols)

      unfixColumn(headers.value[0])

      expect(headers.value[0].fixed).toBe('left')
    })
  })

  describe('handleHeaderChange', () => {
    it('should hide all columns when val=false and col=all', () => {
      const { handleHeaderChange, headers } = createSetting([makeCol('a'), makeCol('b')])

      handleHeaderChange(false, 'all')

      expect(headers.value.every(c => c.hidden)).toBe(true)
    })

    it('should show all columns when val=true and col=all', () => {
      const cols = [makeCol('a', { hidden: true }), makeCol('b', { hidden: true })]
      const { handleHeaderChange, headers } = createSetting(cols)

      handleHeaderChange(true, 'all')

      expect(headers.value.every(c => !c.hidden)).toBe(true)
    })

    it('should toggle single column', () => {
      const { handleHeaderChange, headers } = createSetting([makeCol('a'), makeCol('b')])

      handleHeaderChange(false, makeCol('a'))

      const colA = headers.value.find(c => c.key === 'a')
      expect(colA?.hidden).toBe(true)
    })

    it('should call resetColumns when val=none', () => {
      const { handleHeaderChange } = createSetting()

      handleHeaderChange('none')

      expect(resetColumnsMock).toHaveBeenCalled()
    })
  })

  describe('isPinned', () => {
    it('should return true for pinFixed=left', () => {
      const { isPinned } = createSetting()
      expect(isPinned(makeCol('a', { pinFixed: 'left' }))).toBe(true)
    })

    it('should return true for pinFixed=right', () => {
      const { isPinned } = createSetting()
      expect(isPinned(makeCol('a', { pinFixed: 'right' }))).toBe(true)
    })

    it('should return false for non-pinned column', () => {
      const { isPinned } = createSetting()
      expect(isPinned(makeCol('a'))).toBe(false)
    })
  })

  describe('isChooseAll / isIndeterminate', () => {
    it('should be all selected when all columns are visible', () => {
      const { isChooseAll, isIndeterminate } = createSetting([makeCol('a'), makeCol('b')])
      expect(isChooseAll.value).toBe(true)
      expect(isIndeterminate.value).toBe(false)
    })

    it('should be indeterminate when some columns are hidden', () => {
      const cols = [makeCol('a'), makeCol('b', { hidden: true })]
      const { isChooseAll, isIndeterminate } = createSetting(cols)
      expect(isChooseAll.value).toBe(false)
      expect(isIndeterminate.value).toBe(true)
    })

    it('should update after handleHiddenChange', () => {
      const { handleHiddenChange, isChooseAll } = createSetting([makeCol('a'), makeCol('b')])

      handleHiddenChange(makeCol('a'), false)

      expect(isChooseAll.value).toBe(false)
    })
  })
})
