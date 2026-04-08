import type { V2RendererProps } from '../../../src/components/table-virtual-renderer/v2-renderer-props'
import { describe, expect, it } from 'vitest'
import { computed, effectScope, shallowReactive } from 'vue'
import { useV2GrandTotal } from '../../../src/components/table-virtual-renderer/use-v2-grand-total'

describe('useV2GrandTotal dataWithAppend', () => {
  it.each(['replace', 'reorder'] as const)('updates middle rows on %s with unchanged endpoints', (change) => {
    const scope = effectScope()
    const first = { id: 'first' }
    const middleA = { id: 'a' }
    const middleB = { id: 'b' }
    const last = { id: 'last' }
    const append = { id: 'append' }
    const props = shallowReactive({
      data: [first, middleA, middleB, last],
      selectionColumns: [],
      normalColumns: [],
    })
    const total = scope.run(() => useV2GrandTotal({
      props: props as V2RendererProps,
      topPinnedRows: computed(() => []),
      bottomPinnedRows: computed(() => []),
      hasAppendSlot: computed(() => true),
      appendRowData: append,
      t: () => undefined,
    }))!
    try {
      const previous = total.dataWithAppend.value
      const replacement = { id: 'replacement' }
      props.data = change === 'replace'
        ? [first, replacement, middleB, last]
        : [first, middleB, middleA, last]
      expect(total.dataWithAppend.value).toEqual([...props.data, append])
      expect(total.dataWithAppend.value).not.toBe(previous)
      expect(total.dataWithAppend.value.at(-1)).toBe(append)
      const current = total.dataWithAppend.value
      props.data = [...props.data]
      expect(total.dataWithAppend.value).toBe(current)
    }
    finally {
      scope.stop()
    }
  })
})
