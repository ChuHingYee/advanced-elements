/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import { getSelectAllCheckboxProps } from '../../src/utils/selection-helpers'

describe('selection-helpers', () => {
  describe('getSelectAllCheckboxProps', () => {
    it('returns disabled: true when visibleDataLength is 0', () => {
      const toggleAllSelection = vi.fn()
      const props = getSelectAllCheckboxProps({
        checkStatus: { isAllSelected: false, isIndeterminate: false },
        visibleDataLength: 0,
        toggleAllSelection,
      })
      expect(props.disabled).toBe(true)
      expect(props.modelValue).toBe(false)
      expect(props.indeterminate).toBe(false)
    })

    it('returns disabled: true when visibleDataLength is undefined', () => {
      const toggleAllSelection = vi.fn()
      const props = getSelectAllCheckboxProps({
        checkStatus: { isAllSelected: false, isIndeterminate: false },
        visibleDataLength: undefined,
        toggleAllSelection,
      })
      expect(props.disabled).toBe(true)
    })

    it('returns all-selected state', () => {
      const toggleAllSelection = vi.fn()
      const props = getSelectAllCheckboxProps({
        checkStatus: { isAllSelected: true, isIndeterminate: false },
        visibleDataLength: 2,
        toggleAllSelection,
      })
      expect(props.disabled).toBe(false)
      expect(props.modelValue).toBe(true)
      expect(props.indeterminate).toBe(false)
    })

    it('returns indeterminate state', () => {
      const toggleAllSelection = vi.fn()
      const props = getSelectAllCheckboxProps({
        checkStatus: { isAllSelected: false, isIndeterminate: true },
        visibleDataLength: 2,
        toggleAllSelection,
      })
      expect(props.modelValue).toBe(false)
      expect(props.indeterminate).toBe(true)
    })

    it('calls toggleAllSelection closure when clicking checkbox in non-all state', () => {
      const toggleAllSelection = vi.fn()

      const props = getSelectAllCheckboxProps({
        checkStatus: { isAllSelected: false, isIndeterminate: false },
        visibleDataLength: 2,
        toggleAllSelection,
      })

      const handler = props['onUpdate:modelValue'] as () => void
      handler()
      expect(toggleAllSelection).toHaveBeenCalledTimes(1)
    })

    it('calls toggleAllSelection closure when clicking checkbox in all-selected state', () => {
      const toggleAllSelection = vi.fn()

      const props = getSelectAllCheckboxProps({
        checkStatus: { isAllSelected: true, isIndeterminate: false },
        visibleDataLength: 2,
        toggleAllSelection,
      })

      const handler = props['onUpdate:modelValue'] as () => void
      handler()
      expect(toggleAllSelection).toHaveBeenCalledTimes(1)
    })

    it('uses visibleDataLength for disabled check', () => {
      const toggleAllSelection = vi.fn()
      const props = getSelectAllCheckboxProps({
        checkStatus: { isAllSelected: false, isIndeterminate: false },
        visibleDataLength: 0,
        toggleAllSelection,
      })
      expect(props.disabled).toBe(true)
    })

    it('keeps the data caliber in the caller closure — no row data is read here', () => {
      const toggleAllSelection = vi.fn()
      const props = getSelectAllCheckboxProps({
        checkStatus: { isAllSelected: false, isIndeterminate: false },
        visibleDataLength: 3,
        toggleAllSelection,
      })
      const handler = props['onUpdate:modelValue'] as (value?: unknown) => void
      handler(true)

      // <zh/> 闭包无参——口径（虚拟用 finalDisplayData / 非虚拟用 visibleData / 分页用 renderData）
      // <zh/> 完全由调用方的闭包决定，本函数不得引入第二套数据口径
      // <en/> The closure takes no args — the caliber (finalDisplayData for virtual / visibleData otherwise /
      // <en/> renderData for pagination) is owned by the caller; this function must never introduce a second
      // <en/> data caliber
      expect(toggleAllSelection).toHaveBeenCalledTimes(1)
      expect(toggleAllSelection).toHaveBeenCalledWith()
    })
  })
})
