/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import {
  buildColumnIndexOrder,
  buildColumnKeySignature,
  getColumnDepth,
  getColumnKey,
  getColumnKeySilent,
  isGroupColumn,
  isRowSelectable,
  resolveColumnProp,
} from '../../src/utils/shared'

describe('shared utils', () => {
  describe('isGroupColumn', () => {
    it('returns true for columns with children', () => {
      expect(isGroupColumn({ children: [{ prop: 'a', hidden: false }] })).toBe(true)
    })

    it('returns false for leaf columns', () => {
      expect(isGroupColumn({ prop: 'a', hidden: false })).toBe(false)
      expect(isGroupColumn({})).toBe(false)
    })
  })

  describe('getColumnKey', () => {
    it('uses key prop', () => {
      expect(getColumnKey({ key: 'ck1', prop: 'p1', hidden: false })).toBe('ck1')
    })

    it('falls back to prop', () => {
      expect(getColumnKey({ prop: 'p1', hidden: false })).toBe('p1')
    })

    it('generates key for empty column', () => {
      const key = getColumnKey({})
      expect(key).toBe('')
    })

    it('returns consistent key for same column object', () => {
      const col = {}
      const key1 = getColumnKey(col)
      const key2 = getColumnKey(col)
      expect(key1).toBe(key2)
    })

    // <zh/> 自动键列在 ensureColumnIds 之前的原始阶段无 key 属合法形态，不应触发 dev 警告
    // <en/> Auto-keyed columns legitimately lack keys before ensureColumnIds — no dev warning expected
    describe('auto-keyed columns (selection / option)', () => {
      it('does not warn for selection column', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        try {
          expect(getColumnKey({ selection: true, selectable: () => true })).toBe('')
          expect(warnSpy).not.toHaveBeenCalled()
        }
        finally {
          warnSpy.mockRestore()
        }
      })

      it('does not warn for option column', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        try {
          expect(getColumnKey({ valueType: 'option' })).toBe('')
          expect(warnSpy).not.toHaveBeenCalled()
        }
        finally {
          warnSpy.mockRestore()
        }
      })

      it('still warns for plain keyless column', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        try {
          expect(getColumnKey({})).toBe('')
          expect(warnSpy).toHaveBeenCalled()
        }
        finally {
          warnSpy.mockRestore()
        }
      })
    })
  })

  describe('column key vs prop domains', () => {
    it('getColumnKey prefers key over prop over property', () => {
      expect(getColumnKey({ key: 'k', prop: 'p', property: 'ep' })).toBe('k')
      expect(getColumnKey({ prop: 'p', property: 'ep' })).toBe('p')
      expect(getColumnKey({ property: 'ep' })).toBe('ep')
    })

    it('getColumnKeySilent matches getColumnKey without warning', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      try {
        expect(getColumnKeySilent({ key: 'k', prop: 'p' })).toBe('k')
        expect(getColumnKeySilent({ prop: 'p' })).toBe('p')
        expect(getColumnKeySilent({})).toBe('')
        expect(warnSpy).not.toHaveBeenCalled()
      }
      finally {
        warnSpy.mockRestore()
      }
    })

    it('resolveColumnProp prefers prop over property and ignores key', () => {
      expect(resolveColumnProp({ key: 'k', prop: 'p', property: 'ep' })).toBe('p')
      expect(resolveColumnProp({ key: 'k', property: 'ep' })).toBe('ep')
      expect(resolveColumnProp({ key: 'k' })).toBeUndefined()
      expect(resolveColumnProp({})).toBeUndefined()
    })

    it('buildColumnKeySignature uses silent resolution with index fallback', () => {
      expect(buildColumnKeySignature([{ key: 'a' }, { prop: 'b' }, {}])).toBe('a,b,col-2')
    })
  })

  // <zh/> `flattenLeafColumns` 的用例已迁至 `column-tree.test.ts`：实现收敛到
  // <zh/> `utils/column-tree.ts` 后，`utils/shared` 不再是该函数的所有者，留在此处会误导归属。
  // <en/> `flattenLeafColumns` cases moved to `column-tree.test.ts`: now that the
  // <en/> implementation converged into `utils/column-tree.ts`, `utils/shared` no longer owns the
  // <en/> function, and keeping the cases here would misattribute ownership.

  describe('getColumnDepth', () => {
    it('returns 0 for empty columns', () => {
      expect(getColumnDepth([])).toBe(0)
    })

    it('returns 1 for flat columns', () => {
      expect(getColumnDepth([{ prop: 'a', hidden: false }, { prop: 'b', hidden: false }])).toBe(1)
    })

    it('returns 2 for one level of grouping', () => {
      const cols = [
        {
          children: [
            { prop: 'child', hidden: false },
          ],
        },
      ]
      expect(getColumnDepth(cols)).toBe(2)
    })
  })

  it('isGroupColumn detects group columns correctly', () => {
    // isGroupColumn requires non-empty children to be considered a group
    expect(isGroupColumn({ children: [{ prop: 'a', hidden: false }] })).toBe(true)
    expect(isGroupColumn({ children: [] })).toBe(false)
    expect(isGroupColumn({})).toBe(false)
  })

  it('getColumnKey returns column key correctly', () => {
    expect(getColumnKey({ prop: 'name', hidden: false })).toBe('name')
    expect(getColumnKey({ key: 'myKey' })).toBe('myKey')
    // Always returns a string (generates one if missing)
    const generated = getColumnKey({})
    expect(typeof generated).toBe('string')
    expect(generated).toBe('')
  })

  describe('buildColumnIndexOrder', () => {
    interface TestCol { key: string, fixed?: boolean }

    it('places selection columns first, then non-fixed, then fixed', () => {
      const selection: TestCol[] = [{ key: 'sel' }]
      const normal: TestCol[] = [
        { key: 'a', fixed: false },
        { key: 'b', fixed: true },
        { key: 'c' },
      ]
      const result = buildColumnIndexOrder(selection, normal)
      expect(result.map(c => c.key)).toEqual(['sel', 'a', 'c', 'b'])
    })

    it('handles empty selection array', () => {
      const normal: TestCol[] = [{ key: 'a' }, { key: 'b', fixed: true }]
      const result = buildColumnIndexOrder([], normal)
      expect(result.map(c => c.key)).toEqual(['a', 'b'])
    })

    it('handles empty normal array', () => {
      const selection: TestCol[] = [{ key: 'sel' }]
      const result = buildColumnIndexOrder(selection, [])
      expect(result.map(c => c.key)).toEqual(['sel'])
    })

    it('handles both empty arrays', () => {
      const result = buildColumnIndexOrder([], [])
      expect(result).toEqual([])
    })

    it('preserves relative order of non-fixed columns', () => {
      const normal: TestCol[] = [
        { key: 'c' },
        { key: 'a' },
        { key: 'b' },
      ]
      const result = buildColumnIndexOrder([], normal)
      expect(result.map(c => c.key)).toEqual(['c', 'a', 'b'])
    })

    it('preserves relative order of fixed columns', () => {
      const normal: TestCol[] = [
        { key: 'a', fixed: true },
        { key: 'b', fixed: true },
      ]
      const result = buildColumnIndexOrder([], normal)
      expect(result.map(c => c.key)).toEqual(['a', 'b'])
    })

    it('handles all fixed columns', () => {
      const normal: TestCol[] = [
        { key: 'a', fixed: true },
        { key: 'b', fixed: true },
      ]
      const result = buildColumnIndexOrder([], normal)
      expect(result.map(c => c.key)).toEqual(['a', 'b'])
    })

    it('returns the same type as input (no constraint widening)', () => {
      interface ColWithExtra { key: string, fixed?: boolean, label: string }
      const selection: ColWithExtra[] = [{ key: 'sel', label: 'Selection' }]
      const normal: ColWithExtra[] = [{ key: 'a', label: 'A' }]
      const result = buildColumnIndexOrder(selection, normal)
      // Type should be ColWithExtra[], not { fixed?: unknown }[]
      expect(result[0].label).toBe('Selection')
      expect(result[1].label).toBe('A')
    })
  })

  describe('isRowSelectable', () => {
    it('returns true when no selectableFn', () => {
      expect(isRowSelectable({ id: 1 }, 0)).toBe(true)
    })

    it('returns true when selectableFn returns true', () => {
      const fn = () => true
      expect(isRowSelectable({ id: 1 }, 0, fn)).toBe(true)
    })

    it('returns false when selectableFn returns false', () => {
      const fn = () => false
      expect(isRowSelectable({ id: 1 }, 0, fn)).toBe(false)
    })

    it('passes row and index to selectableFn', () => {
      const fn = vi.fn(() => true)
      const row = { id: 42 }
      isRowSelectable(row, 5, fn)
      expect(fn).toHaveBeenCalledWith(row, 5)
    })
  })
})
