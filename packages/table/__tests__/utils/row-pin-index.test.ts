import { describe, expect, it } from 'vitest'
import { toRenderDataIndex, toVisibleDataIndex } from '../../src/utils/row-pin-index'

describe('row-pin-index domain conversion', () => {
  it('toRenderDataIndex strips the top-pin offset', () => {
    // visibleData = [pin0, pin1, r0, r1, r2]
    expect(toRenderDataIndex(2, 2, 3)).toBe(0)
    expect(toRenderDataIndex(4, 2, 3)).toBe(2)
  })

  it('toRenderDataIndex returns undefined for pinned rows', () => {
    expect(toRenderDataIndex(0, 2, 3)).toBeUndefined()
    expect(toRenderDataIndex(1, 2, 3)).toBeUndefined()
    // bottom pin (past the scroll range) is also unconvertible
    expect(toRenderDataIndex(5, 2, 3)).toBeUndefined()
  })

  it('toRenderDataIndex is identity without pins', () => {
    expect(toRenderDataIndex(0, 0, 3)).toBe(0)
    expect(toRenderDataIndex(2, 0, 3)).toBe(2)
    expect(toRenderDataIndex(3, 0, 3)).toBeUndefined()
  })

  it('toRenderDataIndex rejects negative and non-integer input', () => {
    expect(toRenderDataIndex(-1, 0, 3)).toBeUndefined()
    expect(toRenderDataIndex(1.5, 0, 3)).toBeUndefined()
  })

  it('toVisibleDataIndex adds the top-pin offset (round-trip)', () => {
    expect(toVisibleDataIndex(0, 2)).toBe(2)
    expect(toVisibleDataIndex(2, 2)).toBe(4)
    expect(toVisibleDataIndex(1, 0)).toBe(1)
    expect(toVisibleDataIndex(-1, 2)).toBeUndefined()
    // round-trip: visible -> render -> visible
    const render = toRenderDataIndex(4, 2, 3)!
    expect(toVisibleDataIndex(render, 2)).toBe(4)
  })
})
