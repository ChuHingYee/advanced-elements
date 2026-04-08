import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { useModifierKeyTracker } from '../../src/composables/interaction/use-modifier-key-tracker'

describe('useModifierKeyTracker phase2 — Ctrl/Meta keys', () => {
  it('tracks Ctrl key down/up', async () => {
    const { tableRootRef, modifierPressed } = useModifierKeyTracker()
    const el = document.createElement('div')
    tableRootRef.value = el
    await nextTick()

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control' }))
    expect(modifierPressed.value).toBe(true)

    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }))
    expect(modifierPressed.value).toBe(false)
  })

  it('tracks Meta key down/up', async () => {
    const { tableRootRef, modifierPressed } = useModifierKeyTracker()
    const el = document.createElement('div')
    tableRootRef.value = el
    await nextTick()

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Meta' }))
    expect(modifierPressed.value).toBe(true)

    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Meta' }))
    expect(modifierPressed.value).toBe(false)
  })

  it('modifierPressed is true when both Shift and Ctrl are pressed', async () => {
    const { tableRootRef, modifierPressed } = useModifierKeyTracker()
    const el = document.createElement('div')
    tableRootRef.value = el
    await nextTick()

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control' }))
    expect(modifierPressed.value).toBe(true)

    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }))
    expect(modifierPressed.value).toBe(true) // Still true because Ctrl is pressed

    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }))
    expect(modifierPressed.value).toBe(false)
  })

  it('ignores non-modifier keys', async () => {
    const { tableRootRef, shiftKeyPressed, modifierPressed } = useModifierKeyTracker()
    const el = document.createElement('div')
    tableRootRef.value = el
    await nextTick()

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
    expect(shiftKeyPressed.value).toBe(false)
    expect(modifierPressed.value).toBe(false)
  })
})

describe('useModifierKeyTracker phase2 — window blur', () => {
  it('window blur resets modifier key state', async () => {
    const { tableRootRef, shiftKeyPressed, modifierPressed } = useModifierKeyTracker()
    const el = document.createElement('div')
    tableRootRef.value = el
    await nextTick()

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))
    expect(shiftKeyPressed.value).toBe(true)
    expect(modifierPressed.value).toBe(true)

    window.dispatchEvent(new Event('blur'))
    expect(shiftKeyPressed.value).toBe(false)
    expect(modifierPressed.value).toBe(false)
  })
})

describe('useModifierKeyTracker phase2 — enabled=false', () => {
  it('does not bind listeners when enabled is false', async () => {
    const { tableRootRef, shiftKeyPressed } = useModifierKeyTracker({ enabled: false })
    const el = document.createElement('div')
    tableRootRef.value = el
    await nextTick()

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))
    expect(shiftKeyPressed.value).toBe(false)
  })

  it('binds listeners when enabled changes to true', async () => {
    const enabledRef = ref(false)
    const { tableRootRef, shiftKeyPressed } = useModifierKeyTracker({ enabled: () => enabledRef.value })
    const el = document.createElement('div')
    tableRootRef.value = el
    await nextTick()

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))
    expect(shiftKeyPressed.value).toBe(false)

    enabledRef.value = true
    await nextTick()

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))
    expect(shiftKeyPressed.value).toBe(true)
  })
})

describe('useModifierKeyTracker phase2 — noSelectClass', () => {
  it('returns correct noSelectClass value', () => {
    const { noSelectClass } = useModifierKeyTracker()
    expect(noSelectClass).toBe('adv-table--no-select')
  })
})

describe('useModifierKeyTracker phase2 — ref cleanup', () => {
  it('cleans up old listeners when ref changes', async () => {
    const { tableRootRef, shiftKeyPressed } = useModifierKeyTracker()
    const el1 = document.createElement('div')
    const el2 = document.createElement('div')
    tableRootRef.value = el1
    await nextTick()

    tableRootRef.value = el2
    await nextTick()

    // Old element should not respond
    el1.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))
    expect(shiftKeyPressed.value).toBe(false)

    // New element should respond
    el2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))
    expect(shiftKeyPressed.value).toBe(true)
  })

  it('cleans up window blur listener when ref is set to null', async () => {
    const { tableRootRef, shiftKeyPressed } = useModifierKeyTracker()
    const el = document.createElement('div')
    tableRootRef.value = el
    await nextTick()

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))
    expect(shiftKeyPressed.value).toBe(true)

    tableRootRef.value = null
    await nextTick()

    // Reset and test blur
    shiftKeyPressed.value = true
    window.dispatchEvent(new Event('blur'))
    // After cleanup, blur listener should be removed, so shiftKeyPressed stays true
    expect(shiftKeyPressed.value).toBe(true)
  })
})
