import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { useModifierKeyTracker } from '../../src/composables/interaction/use-modifier-key-tracker'

describe('useModifierKeyTracker', () => {
  it('initializes with shiftKeyPressed false', () => {
    const { shiftKeyPressed } = useModifierKeyTracker()
    expect(shiftKeyPressed.value).toBe(false)
  })

  it('initializes with tableRootRef null', () => {
    const { tableRootRef } = useModifierKeyTracker()
    expect(tableRootRef.value).toBeNull()
  })

  it('tracks shift key down/up events', async () => {
    const { tableRootRef, shiftKeyPressed } = useModifierKeyTracker()
    const el = document.createElement('div')
    tableRootRef.value = el
    await nextTick()

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))
    expect(shiftKeyPressed.value).toBe(true)

    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }))
    expect(shiftKeyPressed.value).toBe(false)
  })

  it('ignores non-Shift key events', async () => {
    const { tableRootRef, shiftKeyPressed } = useModifierKeyTracker()
    const el = document.createElement('div')
    tableRootRef.value = el
    await nextTick()

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(shiftKeyPressed.value).toBe(false)
  })

  it('re-attaches events when ref changes', async () => {
    const { tableRootRef, shiftKeyPressed } = useModifierKeyTracker()

    const el1 = document.createElement('div')
    tableRootRef.value = el1
    await nextTick()

    const el2 = document.createElement('div')
    tableRootRef.value = el2
    await nextTick()

    el1.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))
    expect(shiftKeyPressed.value).toBe(false)

    el2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))
    expect(shiftKeyPressed.value).toBe(true)
  })

  it('handles setting ref to null (cleanup)', async () => {
    const { tableRootRef, shiftKeyPressed } = useModifierKeyTracker()
    const el = document.createElement('div')
    tableRootRef.value = el
    await nextTick()

    tableRootRef.value = null
    await nextTick()

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))
    expect(shiftKeyPressed.value).toBe(false)
  })

  it('does not crash when event listeners are set on null ref', () => {
    const { tableRootRef } = useModifierKeyTracker()
    expect(() => {
      tableRootRef.value = null
    }).not.toThrow()
  })
})
