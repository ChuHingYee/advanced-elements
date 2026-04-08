import type { UserSpanMethod } from '../../src/composables/data/use-cell-span'
import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
import { createMergedSpanMethod } from '../../src/composables/data/use-cell-span'

const params = { row: {}, column: {}, rowIndex: 0, columnIndex: 0 }
const mergedValue = { rowspan: 2, colspan: 1 }

/**
 * <zh/> `createMergedSpanMethod` 不再感知渲染模式——其产物只经
 * <zh/> `defaultRendererProps['span-method']` 下发给 default 渲染器，虚拟渲染器从不读取该 prop
 * <zh/> （合并走 `getSpanInfo` 路径）；与 props 分流重复的内联分支已移除。
 * <en/> `createMergedSpanMethod` is mode-agnostic — its result is handed only to the default
 * <en/> renderer via `defaultRendererProps['span-method']`, and the virtual renderer never reads that prop
 * <en/> (merging goes through `getSpanInfo`), so the former `if (isVirtual) return undefined` duplicated
 * <en/> the props-split decision and was removed.
 */
describe('createMergedSpanMethod', () => {
  it('returns undefined when neither function exists', () => {
    const merged = createMergedSpanMethod({
      userSpanMethod: ref(undefined),
      internalSpanMethod: ref(undefined),
    })
    expect(merged.value).toBeUndefined()
  })

  it('passes through a single side untouched', () => {
    const userSpanMethod: UserSpanMethod = () => mergedValue
    const onlyUser = createMergedSpanMethod({
      userSpanMethod: ref(userSpanMethod),
      internalSpanMethod: ref(undefined),
    })
    expect(onlyUser.value).toBe(userSpanMethod)

    const internalSpanMethod: UserSpanMethod = () => undefined
    const onlyInternal = createMergedSpanMethod({
      userSpanMethod: ref(undefined),
      internalSpanMethod: ref(internalSpanMethod),
    })
    expect(onlyInternal.value).toBe(internalSpanMethod)
  })

  it('prefers the user function and falls back to internal on undefined', () => {
    const internalSpanMethod: UserSpanMethod = () => mergedValue
    const userSpanMethod: UserSpanMethod = p => (p.rowIndex === 0 ? { rowspan: 3, colspan: 3 } : undefined)
    const merged = createMergedSpanMethod({
      userSpanMethod: ref(userSpanMethod),
      internalSpanMethod: ref(internalSpanMethod),
    })
    expect(merged.value?.({ ...params, rowIndex: 0 })).toEqual({ rowspan: 3, colspan: 3 })
    expect(merged.value?.({ ...params, rowIndex: 1 })).toEqual(mergedValue)
  })

  it('stays reactive to input changes', () => {
    const userSpanMethod = ref<UserSpanMethod | undefined>(undefined)
    const internalSpanMethod = ref<UserSpanMethod | undefined>(undefined)
    const merged = createMergedSpanMethod({ userSpanMethod, internalSpanMethod })
    expect(merged.value).toBeUndefined()
    userSpanMethod.value = () => mergedValue
    expect(merged.value?.(params)).toEqual(mergedValue)
  })

  it('accepts computed inputs', () => {
    const merged = createMergedSpanMethod({
      userSpanMethod: computed<UserSpanMethod | undefined>(() => undefined),
      internalSpanMethod: computed<UserSpanMethod | undefined>(() => () => mergedValue),
    })
    expect(merged.value?.(params)).toEqual(mergedValue)
  })
})
