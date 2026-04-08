/**
 * Tests for `use-filter-panel` — side panel state and filter-key tracking.
 */
import type { FilterPanelApi } from '../../src/types/config'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { registerBuiltinFilterTypes } from '../../src/composables/features/builtin-filters'
import { useFilterPanel } from '../../src/composables/features/use-filter-panel'

vi.mock('../../src/composables/use-dayjs-locale', () => ({
  dayjs: ((val?: any) => {
    const valid = val != null && val !== ''
    return {
      isValid: () => valid,
      isBefore: () => true,
      isAfter: () => true,
      isSame: () => true,
      add: () => ({ isBefore: () => true }),
      subtract: () => ({ isAfter: () => true }),
    }
  }) as any,
}))

beforeAll(() => {
  registerBuiltinFilterTypes()
})

describe('useFilterPanel', () => {
  it('default panelPosition is "right" when not configured', () => {
    const r = useFilterPanel({
      filterConfig: () => undefined,
      filterState: ref({}),
      resetAllFilters: vi.fn(),
    })
    expect(r.panelPosition.value).toBe('right')
  })

  it('respects sidePanelPosition from config', () => {
    const r = useFilterPanel({
      filterConfig: () => ({ sidePanel: true, sidePanelPosition: 'left' }),
      filterState: ref({}),
      resetAllFilters: vi.fn(),
    })
    expect(r.panelPosition.value).toBe('left')
  })

  describe('resetAllFilters', () => {
    it('calls resetAllFilters', () => {
      const reset = vi.fn()
      const r = useFilterPanel({
        filterConfig: () => ({ sidePanelDefaultOpen: true }),
        filterState: ref({}),
        resetAllFilters: reset,
      })
      r.resetAllFilters()
      expect(reset).toHaveBeenCalledTimes(1)
    })
  })

  describe('activeFilterKeys', () => {
    it('returns an empty Set when filterState is empty', () => {
      const r = useFilterPanel({
        filterConfig: () => undefined,
        filterState: ref({}),
        resetAllFilters: vi.fn(),
      })
      expect(r.activeFilterKeys.value.size).toBe(0)
    })

    it('returns an empty Set when no filter value is active', () => {
      const r = useFilterPanel({
        filterConfig: () => undefined,
        filterState: ref({ name: { type: 'text', value: '' } as any }),
        resetAllFilters: vi.fn(),
      })
      expect(r.activeFilterKeys.value.size).toBe(0)
    })

    it('reflects active filter keys', () => {
      const r = useFilterPanel({
        filterConfig: () => undefined,
        filterState: ref({
          name: { type: 'text', value: 'Alice' } as any,
          age: { type: 'number', value: [10, 20] } as any,
        }),
        resetAllFilters: vi.fn(),
      })
      const keys = r.activeFilterKeys.value
      expect(keys.has('name')).toBe(true)
      expect(keys.has('age')).toBe(true)
    })
  })

  describe('return shape', () => {
    it('exposes the expected public API', () => {
      const r: FilterPanelApi = useFilterPanel({
        filterConfig: () => undefined,
        filterState: ref({}),
        resetAllFilters: vi.fn(),
      })
      expect(r.panelPosition).toBeDefined()
      expect(r.activeFilterKeys).toBeDefined()
      expect(r.resetAllFilters).toBeTypeOf('function')
    })
  })
})
