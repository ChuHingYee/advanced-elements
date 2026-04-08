import { describe, expect, it } from 'vitest'
import { mapsShallowEqual, shallowEqual, shallowEqualByValue } from '../../src/utils/equality'

describe('mapsShallowEqual', () => {
  it('returns true via the a === b fast path', () => {
    const map = new Map<string, number>([['a', 1]])
    expect(mapsShallowEqual(map, map)).toBe(true)
  })

  it('returns false for an undefined prev (first computation, nothing to reuse)', () => {
    // prev 为 undefined（首次计算无 prev）时恒返回 false，交由调用方保留新 Map
    const map = new Map<string, number>()
    expect(mapsShallowEqual(undefined, map)).toBe(false)
  })

  it('returns false when sizes differ', () => {
    const a = new Map<string, number>([['a', 1]])
    const b = new Map<string, number>([['a', 1], ['b', 2]])
    expect(mapsShallowEqual(a, b)).toBe(false)
    expect(mapsShallowEqual(b, a)).toBe(false)
  })

  it('returns false when a key exists only in one map (same size)', () => {
    const a = new Map<string, number>([['a', 1]])
    const b = new Map<string, number>([['b', 1]])
    expect(mapsShallowEqual(a, b)).toBe(false)
  })

  it('returns false when any per-key value differs by reference', () => {
    const arr = [1, 2]
    const a = new Map<string, number[]>([['a', arr], ['b', [3]]])
    const b = new Map<string, number[]>([['a', arr], ['b', [3]]])
    // b 键的 [3] 是新数组引用——缺省 === 引用比较判不等
    expect(mapsShallowEqual(a, b)).toBe(false)
  })

  it('returns true when every key exists and all values are reference-equal', () => {
    const shared = { id: 1 }
    const a = new Map<string, { id: number }>([['a', shared], ['b', undefined as any]])
    const b = new Map<string, { id: number }>([['a', shared], ['b', undefined as any]])
    expect(mapsShallowEqual(a, b)).toBe(true)
  })

  it('treats undefined values as legitimate cache entries (has-based, not value-based)', () => {
    // <zh/> 全库同源判据：undefined 是合法值，逐键用 has 判存在，而非按值是否为 undefined 判断
    // <en/> Shared criterion: undefined is a legitimate value — probe key presence with `has`,
    // <en/> never with a value-based undefined check
    const a = new Map<string, string | undefined>([['a', undefined]])
    const b = new Map<string, string | undefined>([['a', undefined]])
    expect(mapsShallowEqual(a, b)).toBe(true)
  })

  it('supports a custom value comparator (structural equality)', () => {
    const a = new Map<string, number[]>([['a', [1, 2]]])
    const b = new Map<string, number[]>([['a', [1, 2]]])
    const byLengthAndItems = (x: number[], y: number[]) => x.length === y.length && x.every((v, i) => v === y[i])
    expect(mapsShallowEqual(a, b, byLengthAndItems)).toBe(true)
    expect(mapsShallowEqual(a, new Map([['a', [1, 3]]]), byLengthAndItems)).toBe(false)
  })

  it('compares empty maps as equal', () => {
    expect(mapsShallowEqual(new Map(), new Map())).toBe(true)
  })
})

describe('shallowEqual', () => {
  it('distinguishes { a: undefined } from {}', () => {
    expect(shallowEqual({ a: undefined }, {})).toBe(false)
    expect(shallowEqual({ a: 1 }, { a: 1 })).toBe(true)
    expect(shallowEqual([1, 2], [1, 2])).toBe(true)
    expect(shallowEqual([1, 2], [1, 2, 3])).toBe(false)
  })
})

describe('shallowEqualByValue', () => {
  it('compares serialized values rather than references', () => {
    expect(shallowEqualByValue({ a: { x: 1 } }, { a: { x: 1 } })).toBe(true)
    expect(shallowEqualByValue({ a: 1 }, { a: 2 })).toBe(false)
  })

  it('treats equal date-range filter values as unchanged (Q2: no filterChange loop)', () => {
    // <zh/> 日期区间筛选等值重写不得误判变更，否则受控 filterModel 回写即形成回环
    // <en/> Rewriting an equal date-range filter must not count as changed, or controlled filterModel write-back loops
    const a = { d: { type: 'date', operator: 'between', startDate: '2024-01-01', endDate: '2024-01-31' } }
    const b = { d: { type: 'date', operator: 'between', startDate: '2024-01-01', endDate: '2024-01-31' } }
    expect(shallowEqualByValue(a, b)).toBe(true)
  })

  it('detects a changed date-range filter value (Q2: filterChange fires once)', () => {
    const a = { d: { type: 'date', operator: 'between', startDate: '2024-01-01', endDate: '2024-01-31' } }
    const c = { d: { type: 'date', operator: 'between', startDate: '2024-01-01', endDate: '2024-02-01' } }
    expect(shallowEqualByValue(a, c)).toBe(false)
  })

  it('treats reordered group conditions as changed (Q2: order-sensitive, semantic change)', () => {
    // <zh/> 条件树数组重排视为变更（求值短路顺序变化属语义变更），与实现 JSON 逐 key 比对口径一致
    // <en/> Reordered group conditions count as changed (short-circuit order is semantic), matching the per-key JSON caliber
    const a = { g: { type: 'group', logic: 'and', conditions: [{ type: 'text', operator: 'contains', value: 'a' }, { type: 'text', operator: 'contains', value: 'b' }] } }
    const b = { g: { type: 'group', logic: 'and', conditions: [{ type: 'text', operator: 'contains', value: 'b' }, { type: 'text', operator: 'contains', value: 'a' }] } }
    expect(shallowEqualByValue(a, b)).toBe(false)
  })

  it('ignores key insertion order (Q2: per-key value caliber, no spurious change)', () => {
    // <zh/> 实现按 key 逐个比值，与键插入顺序无关，故等值模型的键序差异不会多发 filterChange；锁定此口径
    // <en/> Values compare per key, independent of insertion order, so key-order drift in an equal model never over-fires filterChange; pinned
    expect(shallowEqualByValue({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
  })
})
