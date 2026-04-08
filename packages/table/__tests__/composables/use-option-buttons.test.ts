/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useOptionButtons } from '../../src/composables/features/use-option-buttons'

describe('useOptionButtons', () => {
  const actions = ref([
    { text: 'Edit', onClick: vi.fn() },
    { text: 'Delete', onClick: vi.fn(), visible: false },
    { text: 'View', onClick: vi.fn(), visible: ({ row }: any) => row.status === 'active' },
    { text: 'Archive', onClick: vi.fn(), disabled: true },
    { text: 'Custom', onClick: vi.fn(), disabled: ({ row }: any) => row.age > 30 },
  ])

  const row = ref({ id: 1, status: 'active', age: 35 })
  const index = ref(0)

  it('filters visible buttons', () => {
    const { visibleActions } = useOptionButtons({ actions: actions as any, row, index })
    // Edit (no visible) = show, Delete (visible: false) = hide, View (fn: true) = show,
    // Archive (no visible) = show, Custom (no visible) = show => 4 visible
    expect(visibleActions.value).toHaveLength(4)
    expect(visibleActions.value.map((b: any) => b.text)).toEqual(['Edit', 'View', 'Archive', 'Custom'])
  })

  it('evaluates visible function reactively', () => {
    const { visibleActions } = useOptionButtons({ actions: actions as any, row, index })
    row.value.status = 'inactive'
    expect(visibleActions.value.map((b: any) => b.text)).toEqual(['Edit', 'Archive', 'Custom'])
  })

  it('evaluates disabled function', () => {
    const { isDisabled } = useOptionButtons({ actions: actions as any, row, index })
    const editAction = actions.value[0]
    const archiveAction = actions.value[3]
    const customAction = actions.value[4]

    expect(isDisabled(editAction as any)).toBe(false)
    expect(isDisabled(archiveAction as any)).toBe(true)
    expect(isDisabled(customAction as any)).toBe(true) // disabled fn returns true (age > 30)
  })

  it('handleClick calls onClick and stops propagation', () => {
    const onClick = vi.fn()
    const testActions = ref([{ text: 'Test', onClick }])
    const { handleClick } = useOptionButtons({ actions: testActions as any, row, index })

    const event = { stopPropagation: vi.fn() } as any
    handleClick(testActions.value[0] as any, event)
    expect(event.stopPropagation).toHaveBeenCalled()
    expect(onClick).toHaveBeenCalledWith({ row: row.value, index: index.value })
  })

  it('handleClick does nothing when onClick is undefined', () => {
    const testActions = ref([{ text: 'NoClick' }])
    const { handleClick } = useOptionButtons({ actions: testActions as any, row, index })
    const event = { stopPropagation: vi.fn() } as any
    expect(() => handleClick(testActions.value[0] as any, event)).not.toThrow()
    expect(event.stopPropagation).toHaveBeenCalled()
  })

  it('handleClick skips disabled actions (API-level guard)', () => {
    const onClick = vi.fn()
    const testActions = ref([{ text: 'Blocked', onClick, disabled: true }])
    const { handleClick } = useOptionButtons({ actions: testActions as any, row, index })
    const event = { stopPropagation: vi.fn() } as any
    handleClick(testActions.value[0] as any, event)
    expect(event.stopPropagation).toHaveBeenCalled()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('hides only the throwing button instead of crashing the column', () => {
    const onClick = vi.fn()
    const testActions = ref([
      { text: 'Ok', onClick },
      { text: 'Broken', onClick, visible: () => { throw new Error('boom') } },
    ])
    const { visibleActions } = useOptionButtons({ actions: testActions as any, row, index })
    expect(visibleActions.value.map((b: any) => b.text)).toEqual(['Ok'])
  })

  it('treats a throwing disabled() as disabled', () => {
    const throwing = () => {
      throw new Error('boom')
    }
    const testActions = ref([{ text: 'X', disabled: throwing }])
    const { isDisabled } = useOptionButtons({ actions: testActions as any, row, index })
    expect(isDisabled(testActions.value[0] as any)).toBe(true)
  })

  describe('visibleActions reference stability', () => {
    it('returns same reference when actions do not change', () => {
      const localRow = ref({ id: 1, status: 'active', age: 25 })
      const { visibleActions } = useOptionButtons({ actions: actions as any, row: localRow, index })
      const first = visibleActions.value
      const second = visibleActions.value
      expect(first).toBe(second)
    })

    it('returns new reference when row data changes visible result', () => {
      const localRow = ref({ id: 1, status: 'active', age: 25 })
      const { visibleActions } = useOptionButtons({ actions: actions as any, row: localRow, index })
      const first = visibleActions.value
      // View action is visible because status is 'active'
      expect(first.map((b: any) => b.text).includes('View')).toBe(true)

      localRow.value.status = 'inactive'
      const second = visibleActions.value
      expect(second.map((b: any) => b.text).includes('View')).toBe(false)
    })
  })

  describe('isDisabled edge cases', () => {
    it('returns false for action without disabled prop', () => {
      const localRow = ref({ id: 1, age: 25 })
      const { isDisabled } = useOptionButtons({ actions: actions as any, row: localRow, index })
      expect(isDisabled({ text: 'NoDisabled' } as any)).toBe(false)
    })

    it('returns false for disabled: false', () => {
      const localRow = ref({ id: 1, age: 25 })
      const { isDisabled } = useOptionButtons({ actions: actions as any, row: localRow, index })
      expect(isDisabled({ text: 'Enabled', disabled: false } as any)).toBe(false)
    })

    it('evaluates disabled function dynamically when row changes', () => {
      const localRow = ref({ id: 1, status: 'active', age: 35 })
      const { isDisabled } = useOptionButtons({ actions: actions as any, row: localRow, index })
      const customAction = actions.value[4]
      expect(isDisabled(customAction as any)).toBe(true) // age > 30

      localRow.value.age = 25
      expect(isDisabled(customAction as any)).toBe(false) // age <= 30
    })
  })
})
