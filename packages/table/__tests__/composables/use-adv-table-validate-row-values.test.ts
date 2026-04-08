import { describe, expect, it } from 'vitest'
import { collectValidateRowValues } from '../../src/composables/use-adv-table'

/**
 * <zh/> validateRow 取值纯函数回归锁——与渲染/编辑链同域，pin 场景由调用方保证传入 renderData 行。
 * <en/> Regression lock for the validateRow value collector — pure; callers guarantee render-domain rows (pin-safe).
 */
describe('collectValidateRowValues', () => {
  it('only collects editable columns with an editor and a string prop', () => {
    const row = { name: 'a', age: 1, readonly: 'x' }
    const cols = [
      { prop: 'name', editable: true, cellEditor: 'text' },
      { prop: 'age', editable: true, cellEditor: 'number' },
      { prop: 'readonly', editable: false, cellEditor: 'text' },
      { prop: 'noEditor', editable: true },
    ]
    expect(collectValidateRowValues(row, cols)).toEqual({ name: 'a', age: 1 })
  })

  it('ignores non-string prop keys', () => {
    const row = { name: 'a' }
    const cols = [
      { prop: 123, editable: true, cellEditor: 'text' },
      { editable: true, cellEditor: 'text' },
    ]
    expect(collectValidateRowValues(row, cols)).toEqual({})
  })

  it('returns empty object when nothing is editable', () => {
    expect(collectValidateRowValues({ a: 1 }, [])).toEqual({})
  })
})
