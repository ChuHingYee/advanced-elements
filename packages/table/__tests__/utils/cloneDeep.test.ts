import { cloneDeep } from 'lodash-es'
/**
 * <zh/> cloneDeep 回归 — 列树深拷贝正确性
 * <en/> cloneDeep regression — column tree deep clone correctness
 *
 * @remarks
 * <zh/> `use-columns.ts:179` `deepCloneColumnTree` 依赖 `lodash-es cloneDeep` 正确处理 `Date/RegExp/Function`
 * <zh/> `structuredClone` 会丢失 `Function` 且需 `HTTPS` 上下文，此测试保障 `lodash` 选型
 * <en/> `use-columns.ts:179` `deepCloneColumnTree` relies on `lodash-es cloneDeep` for `Date/RegExp/Function`
 * <en/> `structuredClone` loses `Function` and requires `HTTPS` context, this test guards `lodash` choice
 */
import { describe, expect, it } from 'vitest'

describe('cloneDeep column tree', () => {
  it('clones Date/RegExp/Function correctly', () => {
    const col = {
      key: 'a',
      prop: 'a',
      label: 'A',
      children: [
        { key: 'b', prop: 'b', label: 'B', date: new Date('2024-01-01'), reg: /abc/, render: () => 'x' },
      ],
    }
    const cloned = cloneDeep(col as any)
    expect(cloned.children[0].date).toBeInstanceOf(Date)
    expect(cloned.children[0].date.getTime()).toBe(new Date('2024-01-01').getTime())
    expect(cloned.children[0].reg).toBeInstanceOf(RegExp)
    expect(typeof cloned.children[0].render).toBe('function')
    expect(cloned).not.toBe(col)
    expect(cloned.children).not.toBe(col.children)
  })

  it('structuredClone would fail for Function', () => {
    const col = { render: () => 'x' }
    // <zh/> structuredClone 抛错或丢失 Function | <en/> structuredClone throws or loses Function
    let threw = false
    try {
      // @ts-expect-error -- test structuredClone behavior
      const c = typeof structuredClone === 'function' ? structuredClone(col) : null
      if (c && typeof (c as any).render !== 'function')
        threw = true
    }
    catch {
      threw = true
    }
    expect(threw).toBe(true)
  })
})
