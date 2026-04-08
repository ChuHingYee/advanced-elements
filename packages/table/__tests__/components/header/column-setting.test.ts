import type { ProcessedColumn } from '../../../src/types/column'
import { describe, expect, it } from 'vitest'

// ── 复刻 column-setting.vue 中的纯逻辑函数 ──

/** 获取列的固定状态 */
function getFixedStatus(col: ProcessedColumn): 'left' | 'right' | false {
  return col.fixed ?? false
}

/** 判断列是否为永久固定 */
function isPinned(col: ProcessedColumn): col is ProcessedColumn & { pinFixed: 'left' | 'right' } {
  return col.pinFixed === 'left' || col.pinFixed === 'right'
}

/** 模拟列分组逻辑 */
function groupColumns(columns: ProcessedColumn[]) {
  return {
    left: columns.filter(c => getFixedStatus(c) === 'left'),
    normal: columns.filter(c => getFixedStatus(c) === false),
    right: columns.filter(c => getFixedStatus(c) === 'right'),
  }
}

/** 模拟 setFixedTo */
function setFixedTo(col: ProcessedColumn, direction: 'left' | 'right') {
  col.fixed = direction
}

/** 模拟 unfixColumn */
function unfixColumn(col: ProcessedColumn) {
  if (isPinned(col))
    return false
  col.fixed = undefined
  return true
}

/** 模拟 handleHeaderChange */
function handleHeaderChange(columns: ProcessedColumn[], val: boolean, col?: ProcessedColumn | 'all') {
  columns.forEach((c) => {
    if (col === 'all') {
      c.isVisible = val
    }
    else if (col && c.key === col.key) {
      c.isVisible = val
    }
  })
}

/** 模拟 updateCheckboxState */
function updateCheckboxState(columns: ProcessedColumn[]) {
  const count = columns.filter(c => c.isVisible !== false).length
  const isChooseAll = count === columns.length
  const isIndeterminate = count !== columns.length && count > 0
  return { isChooseAll, isIndeterminate }
}

describe('column-setting', () => {
  describe('getFixedStatus', () => {
    it('should return left when fixed is left', () => {
      const col = { fixed: 'left' } as unknown as ProcessedColumn
      expect(getFixedStatus(col)).toBe('left')
    })

    it('should return right when fixed is right', () => {
      const col = { fixed: 'right' } as unknown as ProcessedColumn
      expect(getFixedStatus(col)).toBe('right')
    })

    it('should return false when fixed is undefined', () => {
      const col = {} as unknown as ProcessedColumn
      expect(getFixedStatus(col)).toBe(false)
    })

    it('should return false when fixed is false', () => {
      const col = { fixed: false } as unknown as ProcessedColumn
      expect(getFixedStatus(col)).toBe(false)
    })
  })

  describe('isPinned', () => {
    it('should return true when pinFixed is left', () => {
      const col = { pinFixed: 'left' } as unknown as ProcessedColumn
      expect(isPinned(col)).toBe(true)
    })

    it('should return true when pinFixed is right', () => {
      const col = { pinFixed: 'right' } as unknown as ProcessedColumn
      expect(isPinned(col)).toBe(true)
    })

    it('should return false when pinFixed is undefined', () => {
      const col = {} as unknown as ProcessedColumn
      expect(isPinned(col)).toBe(false)
    })

    it('should narrow type to include pinFixed', () => {
      const col = { pinFixed: 'left' as const } as unknown as ProcessedColumn
      if (isPinned(col)) {
        expect(col.pinFixed).toBe('left')
      }
    })
  })

  describe('groupColumns', () => {
    it('should group columns by fixed status', () => {
      const columns = [
        { key: 'a', fixed: 'left' },
        { key: 'b' },
        { key: 'c', fixed: 'right' },
        { key: 'd' },
        { key: 'e', fixed: 'left' },
      ] as unknown as ProcessedColumn[]

      const groups = groupColumns(columns)
      expect(groups.left).toHaveLength(2)
      expect(groups.normal).toHaveLength(2)
      expect(groups.right).toHaveLength(1)
    })

    it('should return empty arrays when no columns', () => {
      const groups = groupColumns([])
      expect(groups.left).toHaveLength(0)
      expect(groups.normal).toHaveLength(0)
      expect(groups.right).toHaveLength(0)
    })

    it('should put all columns in normal when none fixed', () => {
      const columns = [
        { key: 'a' },
        { key: 'b' },
      ] as unknown as ProcessedColumn[]

      const groups = groupColumns(columns)
      expect(groups.normal).toHaveLength(2)
      expect(groups.left).toHaveLength(0)
      expect(groups.right).toHaveLength(0)
    })
  })

  describe('setFixedTo', () => {
    it('should set column fixed to left', () => {
      const col = {} as unknown as ProcessedColumn
      setFixedTo(col, 'left')
      expect(col.fixed).toBe('left')
    })

    it('should set column fixed to right', () => {
      const col = {} as unknown as ProcessedColumn
      setFixedTo(col, 'right')
      expect(col.fixed).toBe('right')
    })

    it('should allow pinFixed column to switch between left and right', () => {
      const col = { pinFixed: 'left', fixed: 'left' } as unknown as ProcessedColumn
      setFixedTo(col, 'right')
      expect(col.fixed).toBe('right')
    })

    it('should allow switching from right to left for pinFixed column', () => {
      const col = { pinFixed: 'right', fixed: 'right' } as unknown as ProcessedColumn
      setFixedTo(col, 'left')
      expect(col.fixed).toBe('left')
    })

    it('should change from left to right for normal column', () => {
      const col = { fixed: 'left' } as unknown as ProcessedColumn
      setFixedTo(col, 'right')
      expect(col.fixed).toBe('right')
    })
  })

  describe('unfixColumn', () => {
    it('should unfix a normal fixed column', () => {
      const col = { fixed: 'left' } as unknown as ProcessedColumn
      const result = unfixColumn(col)
      expect(result).toBe(true)
      expect(col.fixed).toBeUndefined()
    })

    it('should unfix a right-fixed column', () => {
      const col = { fixed: 'right' } as unknown as ProcessedColumn
      const result = unfixColumn(col)
      expect(result).toBe(true)
      expect(col.fixed).toBeUndefined()
    })

    it('should not unfix a pinFixed left column', () => {
      const col = { pinFixed: 'left', fixed: 'left' } as unknown as ProcessedColumn
      const result = unfixColumn(col)
      expect(result).toBe(false)
      expect(col.fixed).toBe('left')
    })

    it('should not unfix a pinFixed right column', () => {
      const col = { pinFixed: 'right', fixed: 'right' } as unknown as ProcessedColumn
      const result = unfixColumn(col)
      expect(result).toBe(false)
      expect(col.fixed).toBe('right')
    })
  })

  describe('handleHeaderChange', () => {
    const columns = [
      { key: 'a', isVisible: true },
      { key: 'b', isVisible: true },
      { key: 'c', isVisible: true },
    ] as unknown as ProcessedColumn[]

    it('should set all columns invisible when val is false and col is all', () => {
      const cols = columns.map(c => ({ ...c }))
      handleHeaderChange(cols, false, 'all')
      expect(cols.every(c => c.isVisible === false)).toBe(true)
    })

    it('should set all columns visible when val is true and col is all', () => {
      const cols = columns.map(c => ({ ...c, isVisible: false }))
      handleHeaderChange(cols, true, 'all')
      expect(cols.every(c => c.isVisible === true)).toBe(true)
    })

    it('should set specific column invisible', () => {
      const cols = columns.map(c => ({ ...c }))
      handleHeaderChange(cols, false, { key: 'b' } as unknown as ProcessedColumn)
      expect(cols[0].isVisible).toBe(true)
      expect(cols[1].isVisible).toBe(false)
      expect(cols[2].isVisible).toBe(true)
    })

    it('should set specific column visible', () => {
      const cols = columns.map(c => ({ ...c, isVisible: false }))
      handleHeaderChange(cols, true, { key: 'c' } as unknown as ProcessedColumn)
      expect(cols[0].isVisible).toBe(false)
      expect(cols[1].isVisible).toBe(false)
      expect(cols[2].isVisible).toBe(true)
    })
  })

  describe('updateCheckboxState', () => {
    it('should set isChooseAll true when all visible', () => {
      const cols = [{ isVisible: true }, { isVisible: true }] as unknown as ProcessedColumn[]
      const state = updateCheckboxState(cols)
      expect(state.isChooseAll).toBe(true)
      expect(state.isIndeterminate).toBe(false)
    })

    it('should set isChooseAll false and isIndeterminate true when some visible', () => {
      const cols = [{ isVisible: true }, { isVisible: false }] as unknown as ProcessedColumn[]
      const state = updateCheckboxState(cols)
      expect(state.isChooseAll).toBe(false)
      expect(state.isIndeterminate).toBe(true)
    })

    it('should set both false when none visible', () => {
      const cols = [{ isVisible: false }, { isVisible: false }] as unknown as ProcessedColumn[]
      const state = updateCheckboxState(cols)
      expect(state.isChooseAll).toBe(false)
      expect(state.isIndeterminate).toBe(false)
    })

    it('should treat undefined isVisible as true', () => {
      const cols = [{}, { isVisible: true }] as ProcessedColumn[]
      const state = updateCheckboxState(cols)
      expect(state.isChooseAll).toBe(true)
      expect(state.isIndeterminate).toBe(false)
    })
  })

  describe('pinFixed + fixed interaction', () => {
    it('pinFixed column can switch from left to right via setFixedTo', () => {
      const col = { pinFixed: 'left', fixed: 'left' } as unknown as ProcessedColumn
      setFixedTo(col, 'right')
      expect(col.fixed).toBe('right')
      // pinFixed remains left, but column is now visually on right
      expect(isPinned(col)).toBe(true)
    })

    it('pinFixed column cannot be unfixed', () => {
      const col = { pinFixed: 'left', fixed: 'left' } as unknown as ProcessedColumn
      const result = unfixColumn(col)
      expect(result).toBe(false)
      expect(col.fixed).toBe('left')
    })

    it('non-pinFixed column can be freely fixed and unfixed', () => {
      const col = {} as unknown as ProcessedColumn

      setFixedTo(col, 'left')
      expect(col.fixed).toBe('left')
      expect(getFixedStatus(col)).toBe('left')

      setFixedTo(col, 'right')
      expect(col.fixed).toBe('right')
      expect(getFixedStatus(col)).toBe('right')

      const result = unfixColumn(col)
      expect(result).toBe(true)
      expect(col.fixed).toBeUndefined()
      expect(getFixedStatus(col)).toBe(false)
    })

    it('pinFixed left can switch to right and back', () => {
      const col = { pinFixed: 'left', fixed: 'left' } as unknown as ProcessedColumn

      setFixedTo(col, 'right')
      expect(col.fixed).toBe('right')

      setFixedTo(col, 'left')
      expect(col.fixed).toBe('left')

      // Still cannot unfix
      expect(unfixColumn(col)).toBe(false)
    })

    it('column grouping updates after setFixedTo', () => {
      const columns = [
        { key: 'a', fixed: 'left' },
        { key: 'b' },
        { key: 'c', fixed: 'right' },
      ] as unknown as ProcessedColumn[]

      let groups = groupColumns(columns)
      expect(groups.left).toHaveLength(1)
      expect(groups.normal).toHaveLength(1)
      expect(groups.right).toHaveLength(1)

      // Move column b to left
      setFixedTo(columns[1], 'left')
      groups = groupColumns(columns)
      expect(groups.left).toHaveLength(2)
      expect(groups.normal).toHaveLength(0)
      expect(groups.right).toHaveLength(1)

      // Move column a to right
      setFixedTo(columns[0], 'right')
      groups = groupColumns(columns)
      expect(groups.left).toHaveLength(1)
      expect(groups.normal).toHaveLength(0)
      expect(groups.right).toHaveLength(2)
    })

    it('column grouping updates after unfixColumn', () => {
      const columns = [
        { key: 'a', fixed: 'left' },
        { key: 'b' },
        { key: 'c', fixed: 'right' },
      ] as unknown as ProcessedColumn[]

      // Unfix column a
      unfixColumn(columns[0])
      const groups = groupColumns(columns)
      expect(groups.left).toHaveLength(0)
      expect(groups.normal).toHaveLength(2)
      expect(groups.right).toHaveLength(1)
    })
  })
})
