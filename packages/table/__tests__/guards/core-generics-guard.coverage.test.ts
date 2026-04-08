import { describe, expect, it } from 'vitest'
import { assertCoreGenericsFlow } from '../../src/__type-guards__/core-generics.guard'

/**
 * <zh/> assertCoreGenericsFlow 小覆盖：正常返回字符串 + 错误透传分支
 * <en/> assertCoreGenericsFlow small coverage: happy-path string return + error propagation branch
 */
describe('core-generics guard small coverage', () => {
  // <zh/> 最小伪造 core（其余字段运行时未触达，转 any） | <en/> minimal fake core (untouched fields are runtime-irrelevant, cast as any)
  function fakeCore(
    rowKeyImpl: (row: any) => string,
    selectableImpl?: (row: any, index: number) => boolean,
  ) {
    return {
      rowKeyFn: { value: rowKeyImpl },
      selectableFn: { value: selectableImpl },
    } as any
  }

  it('returns the row key string for a GateRow-shaped row', () => {
    // <zh/> 正向：返回 rowKeyFn 计算的字符串 | <en/> happy path: returns the string computed by rowKeyFn
    expect(assertCoreGenericsFlow(fakeCore(row => `row-${row.id}`))).toBe('row-1')
  })

  it('works when selectableFn is defined', () => {
    // <zh/> selectableFn 已定义时同样返回 | <en/> also returns when selectableFn is defined
    expect(assertCoreGenericsFlow(fakeCore(row => `k-${row.name}`, () => true))).toBe('k-gate')
  })

  it('propagates rowKeyFn errors to the caller', () => {
    // <zh/> 错误分支：rowKeyFn 抛错时直接透出 | <en/> error branch: rowKeyFn throws propagate outward
    expect(() => assertCoreGenericsFlow(fakeCore(() => {
      throw new Error('bad key')
    }))).toThrow('bad key')
  })
})
