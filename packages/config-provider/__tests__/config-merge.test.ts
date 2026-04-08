import { describe, expect, it } from 'vitest'
import { deepMergeConfig, isEqualConfig, isEqualConfigValue, isPlainObject } from '../src/config-merge'

describe('config-merge', () => {
  it('isPlainObject 区分普通对象与数组/null', () => {
    expect(isPlainObject({})).toBe(true)
    expect(isPlainObject({ a: 1 })).toBe(true)
    expect(isPlainObject([])).toBe(false)
    expect(isPlainObject(null)).toBe(false)
    expect(isPlainObject(1)).toBe(false)
  })

  it('deepMergeConfig 空子配置复用父级引用', () => {
    const parent = { table: { pagination: { pageSize: 10 } } }
    expect(deepMergeConfig(parent, {})).toBe(parent)
  })

  it('deepMergeConfig 子级覆盖同级、未覆盖子树复用引用', () => {
    const parent = { table: { pagination: { pageSize: 10, pageSizes: [10, 20] }, search: { enabled: true } } }
    const current = { table: { pagination: { pageSize: 20 } } }
    const merged = deepMergeConfig(parent, current)
    expect(merged.table.pagination.pageSize).toBe(20)
    expect(merged.table.pagination.pageSizes).toEqual([10, 20])
    expect(merged.table.search).toBe(parent.table.search)
  })

  it('deepMergeConfig 无实际变化时复用父级引用', () => {
    const parent = { table: { pagination: { pageSize: 10 } } }
    const merged = deepMergeConfig(parent, { table: { pagination: { pageSize: 10 } } })
    expect(merged).toBe(parent)
  })

  it('deepMergeConfig 数组为整替语义', () => {
    const merged = deepMergeConfig(
      { table: { pagination: { pageSizes: [10, 20] } } },
      { table: { pagination: { pageSizes: [20, 50] } } },
    )
    expect(merged.table.pagination.pageSizes).toEqual([20, 50])
  })

  it('deepMergeConfig 跳过原型污染键', () => {
    const parent = { table: {} } as Record<string, any>
    const current = JSON.parse('{"__proto__":{"polluted":true},"table":{"pagination":{"pageSize":5}}}')
    const merged = deepMergeConfig(parent, current) as Record<string, any>
    expect(({} as Record<string, any>).polluted).toBeUndefined()
    expect(merged.table.pagination.pageSize).toBe(5)
    expect(Object.hasOwn(merged, '__proto__')).toBe(false)
  })

  it('isEqualConfigValue 函数按引用、其余按值', () => {
    const fn = () => {}
    expect(isEqualConfigValue({ f: fn }, { f: fn })).toBe(true)
    expect(isEqualConfigValue({ f: () => {} }, { f: () => {} })).toBe(false)
    expect(isEqualConfigValue([1, 2], [1, 2])).toBe(true)
    expect(isEqualConfigValue([1, 2], [1, 3])).toBe(false)
    expect(isEqualConfigValue({ a: 1 }, { a: 1, b: 2 })).toBe(false)
  })

  it('isEqualConfig 内容一致即相等', () => {
    expect(isEqualConfig(
      { table: { pagination: { pageSize: 20 } } },
      { table: { pagination: { pageSize: 20 } } },
    )).toBe(true)
    expect(isEqualConfig(
      { table: { pagination: { pageSize: 20 } } },
      { table: { pagination: { pageSize: 30 } } },
    )).toBe(false)
  })
})
