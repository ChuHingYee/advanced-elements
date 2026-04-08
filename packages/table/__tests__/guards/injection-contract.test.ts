import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, inject } from 'vue'
import { advTableSelectionKey } from '../../src/types/injection-keys'

describe('injection contract: selection key', () => {
  it('injects undefined without a provider — renderers must handle the fallback', () => {
    let seen: unknown = 'unset'
    const Probe = defineComponent({
      setup() {
        seen = inject(advTableSelectionKey, undefined)
        return () => h('div')
      },
    })
    mount(Probe)
    expect(seen).toBeUndefined()
  })

  it('round-trips a typed selection-state-like object through provide/inject', () => {
    const fake = { selectedKeys: { value: new Set(['a']) }, isSelectedByKey: (k: string) => k === 'a' }
    let seen: unknown
    const Probe = defineComponent({
      setup() {
        seen = inject(advTableSelectionKey, undefined)
        return () => h('div')
      },
    })
    mount(Probe, { global: { provide: { [advTableSelectionKey as symbol]: fake } } })
    expect(seen).toBe(fake)
  })
})
