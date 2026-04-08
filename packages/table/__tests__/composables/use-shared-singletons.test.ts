import type { ColumnFilterValue } from '../../src/composables/data/use-column-filter'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { computed, nextTick } from 'vue'
import { registerBuiltinFilterTypes } from '../../src/composables/features/builtin-filters'
import { useSharedSingletons } from '../../src/composables/shared/use-shared-singletons'

beforeAll(() => {
  registerBuiltinFilterTypes()
})

describe('useSharedSingletons', () => {
  function createSingletons(overrides: {
    getFilterValue?: (key: string) => ColumnFilterValue | undefined
    getEnumOptions?: (key: string) => any[] | undefined
    isColumnFiltered?: (key: string) => boolean
    setFilter?: (key: string, val: ColumnFilterValue) => void
  } = {}) {
    const isContainerVisible = computed(() => true)
    const getFilterValue = vi.fn(overrides.getFilterValue ?? (() => undefined))
    const getEnumOptions = vi.fn(overrides.getEnumOptions ?? (() => undefined))
    const isColumnFiltered = vi.fn(overrides.isColumnFiltered ?? (() => false))
    const setFilter = vi.fn(overrides.setFilter ?? (() => {}))

    const result = useSharedSingletons({
      isContainerVisible,
      tooltipEffect: () => 'dark',
      tooltipOptions: () => undefined,
      tooltipFormatter: () => undefined,
      getFilterValue,
      getEnumOptions,
      isColumnFiltered,
      setFilter,
    })

    return { ...result, getFilterValue, getEnumOptions, isColumnFiltered, setFilter }
  }

  describe('initial state (no active column key)', () => {
    it('sharedFilterFormKey is null when no column is active', () => {
      const { sharedFilterFormKey } = createSingletons()
      expect(sharedFilterFormKey.value).toBeNull()
    })

    it('sharedFilterFormType defaults to "text" when no column is active', () => {
      const { sharedFilterFormType } = createSingletons()
      expect(sharedFilterFormType.value).toBe('text')
    })

    it('sharedFilterFormValue returns default text filter value when no column is active', () => {
      const { sharedFilterFormValue } = createSingletons()
      const value = sharedFilterFormValue.value
      expect(value).toBeDefined()
      expect(value.type).toBe('text')
    })

    it('sharedFilterFormEnumOptions returns undefined when no column is active', () => {
      const { sharedFilterFormEnumOptions } = createSingletons()
      expect(sharedFilterFormEnumOptions.value).toBeUndefined()
    })

    it('sharedFilterFormActive returns false when no column is active', () => {
      const { sharedFilterFormActive } = createSingletons()
      expect(sharedFilterFormActive.value).toBe(false)
    })

    it('handleSharedFilterUpdate is a no-op when no column is active', () => {
      const { handleSharedFilterUpdate, setFilter } = createSingletons()
      handleSharedFilterUpdate({ type: 'text', value: 'foo' } as any)
      expect(setFilter).not.toHaveBeenCalled()
    })
  })

  describe('with active column key', () => {
    it('sharedFilterFormValue reads from getFilterValue when column is active', async () => {
      const { sharedFilterPopover, sharedFilterFormValue, getFilterValue } = createSingletons({
        getFilterValue: () => ({ type: 'text', value: 'hello' } as ColumnFilterValue),
      })

      const triggerEl = document.createElement('div')
      sharedFilterPopover.open('col1', triggerEl, 'text')
      await nextTick()

      // Access .value to trigger computed evaluation (computed is lazy)
      const value = sharedFilterFormValue.value
      expect(getFilterValue).toHaveBeenCalledWith('col1')
      expect(value).toEqual({ type: 'text', value: 'hello' })
    })

    it('sharedFilterFormValue falls back to default when getFilterValue returns undefined', async () => {
      const { sharedFilterPopover, sharedFilterFormValue } = createSingletons({
        getFilterValue: () => undefined,
      })

      const triggerEl = document.createElement('div')
      sharedFilterPopover.open('col1', triggerEl, 'number')
      await nextTick()

      const value = sharedFilterFormValue.value
      expect(value).toBeDefined()
      expect(value.type).toBe('number')
    })

    it('sharedFilterFormEnumOptions returns a getter when column is active', async () => {
      const enumOptions = [{ label: 'A', value: 'a' }]
      const { sharedFilterPopover, sharedFilterFormEnumOptions } = createSingletons({
        getEnumOptions: () => enumOptions,
      })

      const triggerEl = document.createElement('div')
      sharedFilterPopover.open('col1', triggerEl, 'enum')
      await nextTick()

      expect(typeof sharedFilterFormEnumOptions.value).toBe('function')
      expect(sharedFilterFormEnumOptions.value!()).toEqual(enumOptions)
    })

    it('sharedFilterFormEnumOptions getter returns empty array when getEnumOptions returns undefined', async () => {
      const { sharedFilterPopover, sharedFilterFormEnumOptions } = createSingletons({
        getEnumOptions: () => undefined,
      })

      const triggerEl = document.createElement('div')
      sharedFilterPopover.open('col1', triggerEl, 'enum')
      await nextTick()

      expect(sharedFilterFormEnumOptions.value!()).toEqual([])
    })

    it('sharedFilterFormActive reads from isColumnFiltered when column is active', async () => {
      const { sharedFilterPopover, sharedFilterFormActive, isColumnFiltered } = createSingletons({
        isColumnFiltered: () => true,
      })

      const triggerEl = document.createElement('div')
      sharedFilterPopover.open('col1', triggerEl, 'text')
      await nextTick()

      // Access to trigger computed evaluation
      const active = sharedFilterFormActive.value
      expect(isColumnFiltered).toHaveBeenCalledWith('col1')
      expect(active).toBe(true)
    })

    it('handleSharedFilterUpdate calls setFilter with active column key', async () => {
      const { sharedFilterPopover, handleSharedFilterUpdate, setFilter } = createSingletons()

      const triggerEl = document.createElement('div')
      sharedFilterPopover.open('col1', triggerEl, 'text')
      await nextTick()

      const filterValue = { type: 'text', value: 'updated' } as ColumnFilterValue
      handleSharedFilterUpdate(filterValue)

      expect(setFilter).toHaveBeenCalledWith('col1', filterValue)
    })
  })

  describe('returned API objects', () => {
    it('returns overflowTooltipApi from sharedTooltip', () => {
      const { overflowTooltipApi, sharedTooltip } = createSingletons()
      expect(overflowTooltipApi).toBe(sharedTooltip.api)
    })

    it('returns copyApi from sharedCopyApi', () => {
      const { copyApi, sharedCopyApi } = createSingletons()
      expect(copyApi).toBe(sharedCopyApi.api)
    })

    it('returns sharedFilterPopoverApi', () => {
      const { sharedFilterPopoverApi, sharedFilterPopover } = createSingletons()
      expect(sharedFilterPopoverApi).toBe(sharedFilterPopover)
    })

    it('returns sharedHeaderTooltipApi with enter/leave handlers', () => {
      const { sharedHeaderTooltipApi, sharedHeaderTooltip } = createSingletons()
      expect(sharedHeaderTooltipApi.onHeaderEnter).toBe(sharedHeaderTooltip.onHeaderEnter)
      expect(sharedHeaderTooltipApi.onHeaderLeave).toBe(sharedHeaderTooltip.onHeaderLeave)
    })
  })
})
