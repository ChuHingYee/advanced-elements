/**
 * @file column-setting-helpers phase2 — 补充分支覆盖
 * Covers: syncColumnReference, removeOldGroupColumns, applyGroupUpdate, handleDragMove, handleDragEnd, updateAllColumnHidden
 */
import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it } from 'vitest'
import {
  applyGroupUpdate,
  buildKeyMap,
  collectLeafVisibility,
  extractHiddenSignature,
  filterColumnsByGroup,
  handleDragEnd,
  handleDragMove,
  isBuiltInColumn,
  isPinned,
  removeOldGroupColumns,
  syncColumnReference,
  updateAllColumnHidden,
  updateColumnByKey,
} from '../../src/utils/column-setting-helpers'

function makeCol(key: string, overrides?: Partial<ProcessedColumn>): ProcessedColumn {
  return { key, prop: key, label: key, hidden: false, ...overrides } as unknown as ProcessedColumn
}

describe('column-setting-helpers phase2 — isBuiltInColumn', () => {
  it('returns true for selection columns', () => {
    expect(isBuiltInColumn(makeCol('sel', { selection: true } as any))).toBe(true)
  })

  it('returns true for hover option columns', () => {
    expect(isBuiltInColumn(makeCol('act', { valueType: 'option', hoverActions: {} } as any))).toBe(true)
  })

  it('returns false for normal columns', () => {
    expect(isBuiltInColumn(makeCol('name'))).toBe(false)
  })
})

describe('column-setting-helpers phase2 — isPinned', () => {
  it('returns true for pinFixed left', () => {
    expect(isPinned(makeCol('a', { pinFixed: 'left' } as any))).toBe(true)
  })

  it('returns true for pinFixed right', () => {
    expect(isPinned(makeCol('a', { pinFixed: 'right' } as any))).toBe(true)
  })

  it('returns false for non-pinned columns', () => {
    expect(isPinned(makeCol('a'))).toBe(false)
  })
})

describe('column-setting-helpers phase2 — updateColumnByKey', () => {
  it('updates nested children', () => {
    const child = makeCol('child')
    const parent = makeCol('parent', { children: [child] as any })
    const result = updateColumnByKey([parent], 'child', c => ({ ...c, hidden: true }))
    expect((result[0].children as any[])[0].hidden).toBe(true)
  })

  it('returns same reference when no change', () => {
    const cols = [makeCol('a')]
    const result = updateColumnByKey(cols, 'a', c => c)
    expect(result).toBe(cols)
  })
})

describe('column-setting-helpers phase2 — updateAllColumnHidden', () => {
  it('skips built-in columns', () => {
    const cols = [makeCol('sel', { selection: true, hidden: false } as any), makeCol('a')]
    const result = updateAllColumnHidden(cols, true)
    expect(result[0].hidden).toBe(false) // selection column not changed
    expect(result[1].hidden).toBe(true)
  })

  it('recursively updates group column children', () => {
    const child = makeCol('child')
    const parent = makeCol('parent', { children: [child] as any })
    const result = updateAllColumnHidden([parent], true)
    expect(result[0].hidden).toBe(true)
    expect((result[0].children as any[])[0].hidden).toBe(true)
  })
})

describe('column-setting-helpers phase2 — syncColumnReference', () => {
  it('returns col with fixed when not found in keyMap', () => {
    const col = makeCol('x')
    const result = syncColumnReference(col, new Map(), 'left')
    expect(result.fixed).toBe('left')
  })

  it('returns col without fixed when not found and fixedValue is undefined', () => {
    const col = makeCol('x', { fixed: 'left' })
    const result = syncColumnReference(col, new Map(), undefined)
    expect(result.fixed).toBeUndefined()
  })

  it('returns original col when not found, no fixed, and fixedValue is undefined', () => {
    const col = makeCol('x')
    const result = syncColumnReference(col, new Map(), undefined)
    expect(result).toBe(col)
  })

  it('syncs with latest reference and applies fixed', () => {
    const col = makeCol('a', { width: 100 })
    const latestRef = makeCol('a', { width: 200 })
    const keyMap = new Map([['a', latestRef]])
    const result = syncColumnReference(col, keyMap, 'right')
    expect(result.width).toBe(200)
    expect(result.fixed).toBe('right')
  })

  it('syncs with latest reference and removes fixed', () => {
    const col = makeCol('a', { fixed: 'left' })
    const latestRef = makeCol('a', { fixed: 'left' })
    const keyMap = new Map([['a', latestRef]])
    const result = syncColumnReference(col, keyMap, undefined)
    expect(result.fixed).toBeUndefined()
  })

  it('returns latestRef as-is when no fixed and fixedValue is undefined', () => {
    const col = makeCol('a')
    const latestRef = makeCol('a')
    const keyMap = new Map([['a', latestRef]])
    const result = syncColumnReference(col, keyMap, undefined)
    expect(result).toBe(latestRef)
  })
})

describe('column-setting-helpers phase2 — filterColumnsByGroup', () => {
  it('filters left columns', () => {
    const cols = [makeCol('a', { fixed: 'left' }), makeCol('b'), makeCol('c', { fixed: 'right' })]
    expect(filterColumnsByGroup(cols, 'left')).toHaveLength(1)
  })

  it('filters right columns', () => {
    const cols = [makeCol('a', { fixed: 'left' }), makeCol('b'), makeCol('c', { fixed: 'right' })]
    expect(filterColumnsByGroup(cols, 'right')).toHaveLength(1)
  })

  it('filters normal columns', () => {
    const cols = [makeCol('a', { fixed: 'left' }), makeCol('b'), makeCol('c', { fixed: 'right' })]
    expect(filterColumnsByGroup(cols, 'normal')).toHaveLength(1)
  })
})

describe('column-setting-helpers phase2 — removeOldGroupColumns', () => {
  it('removes columns in removedKeys and oldKeySet', () => {
    const cols = [makeCol('a'), makeCol('b'), makeCol('c'), makeCol('d')]
    const oldKeySet = new Set(['a', 'b'])
    const removedKeys = ['a']
    const result = removeOldGroupColumns(cols, oldKeySet, removedKeys)
    // 'a' is in removedKeys, 'b' is in oldKeySet, both removed
    expect(result.map(c => c.key)).toEqual(['c', 'd'])
  })
})

describe('column-setting-helpers phase2 — applyGroupUpdate', () => {
  it('applies group update for normal group', () => {
    const cols = [makeCol('a'), makeCol('b', { fixed: 'left' }), makeCol('c')]
    const newCols = [makeCol('c'), makeCol('a')]
    const result = applyGroupUpdate(cols, 'normal', newCols)
    // 'b' (left) should remain, new normal order: c, a
    const keys = result.map(c => c.key)
    expect(keys).toContain('b')
    expect(keys).toContain('c')
    expect(keys).toContain('a')
    // 'c' should come before 'a' in the normal group
    expect(keys.indexOf('c')).toBeLessThan(keys.indexOf('a'))
  })

  it('applies group update for left group with fixed sync', () => {
    const cols = [makeCol('a', { fixed: 'left' }), makeCol('b')]
    const newCols = [makeCol('a')]
    const result = applyGroupUpdate(cols, 'left', newCols)
    expect(result[0].fixed).toBe('left')
  })

  it('inserts at end when no old columns found', () => {
    const cols = [makeCol('b', { fixed: 'left' })]
    const newCols = [makeCol('c'), makeCol('d')]
    const result = applyGroupUpdate(cols, 'normal', newCols)
    const keys = result.map(c => c.key)
    expect(keys).toContain('c')
    expect(keys).toContain('d')
    expect(keys).toContain('b')
  })
})

describe('column-setting-helpers phase2 — handleDragMove', () => {
  it('returns true when relatedEl is missing and clears last target', () => {
    const lastTarget = { value: null }
    const result = handleDragMove({ dragged: null, related: null }, 'no-drop', 'drop-target', lastTarget)
    expect(result).toBe(true)
  })

  it('returns false and adds no-drop class when dragged === related', () => {
    const el = document.createElement('div')
    const lastTarget = { value: null }
    const result = handleDragMove({ dragged: el, related: el }, 'no-drop', 'drop-target', lastTarget)
    expect(result).toBe(false)
    expect(el.classList.contains('no-drop')).toBe(true)
  })

  it('adds drop-target class to related element', () => {
    const dragged = document.createElement('div')
    const related = document.createElement('div')
    const lastTarget = { value: null }
    handleDragMove({ dragged, related }, 'no-drop', 'drop-target', lastTarget)
    expect(related.classList.contains('drop-target')).toBe(true)
    expect(lastTarget.value).toBe(related)
  })

  it('clears previous drop-target when moving to new target', () => {
    const dragged = document.createElement('div')
    const oldTarget = document.createElement('div')
    const newTarget = document.createElement('div')
    const lastTarget = { value: oldTarget }
    oldTarget.classList.add('drop-target')
    handleDragMove({ dragged, related: newTarget }, 'no-drop', 'drop-target', lastTarget)
    expect(oldTarget.classList.contains('drop-target')).toBe(false)
    expect(newTarget.classList.contains('drop-target')).toBe(true)
  })
})

describe('column-setting-helpers phase2 — handleDragEnd', () => {
  it('removes drop-target and no-drop classes', () => {
    const item = document.createElement('div')
    item.classList.add('no-drop')
    const target = document.createElement('div')
    target.classList.add('drop-target')
    const lastTarget = { value: target }

    handleDragEnd({ item }, 'no-drop', 'drop-target', lastTarget)

    expect(item.classList.contains('no-drop')).toBe(false)
    expect(target.classList.contains('drop-target')).toBe(false)
    expect(lastTarget.value).toBeNull()
  })

  it('handles missing item gracefully', () => {
    const lastTarget = { value: null }
    handleDragEnd({}, 'no-drop', 'drop-target', lastTarget)
    expect(lastTarget.value).toBeNull()
  })
})

describe('column-setting-helpers phase2 — buildKeyMap', () => {
  it('builds key map from columns', () => {
    const cols = [makeCol('a'), makeCol('b')]
    const map = buildKeyMap(cols)
    expect(map.size).toBe(2)
    expect(map.get('a')).toBe(cols[0])
  })
})

describe('column-setting-helpers phase2 — collectLeafVisibility with nested groups', () => {
  it('collects visibility from nested group children', () => {
    const child1 = makeCol('child1', { hidden: false })
    const child2 = makeCol('child2', { hidden: true })
    const parent = makeCol('parent', { children: [child1, child2] as any })
    const result = collectLeafVisibility([parent])
    expect(result).toEqual([true, false])
  })

  it('inherits parent hidden state', () => {
    const child = makeCol('child', { hidden: false })
    const parent = makeCol('parent', { hidden: true, children: [child] as any })
    const result = collectLeafVisibility([parent])
    expect(result).toEqual([false]) // child is hidden because parent is hidden
  })
})

describe('column-setting-helpers phase2 — extractHiddenSignature with groups', () => {
  it('includes group children in signature', () => {
    const child1 = makeCol('child1', { hidden: false })
    const child2 = makeCol('child2', { hidden: true })
    const parent = makeCol('parent', { hidden: false, children: [child1, child2] as any })
    const sig = extractHiddenSignature([parent])
    expect(sig).toContain('0')
    expect(sig).toContain('1')
  })
})
