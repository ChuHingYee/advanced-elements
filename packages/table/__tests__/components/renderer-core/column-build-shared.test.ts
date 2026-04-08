import { describe, expect, it } from 'vitest'
import { isTeleportHoverColumn, resolveStretchLowerBound, shouldShowInlineHover } from '../../../src/components/renderer-core/column-build-shared'

/**
 * 双端列构建共享谓词,parity 锁:与原 7 处内联语义逐项等价.
 * Shared column-build predicates, parity lock against the 7 former inline sites.
 */
describe('column-build-shared', () => {
  it('isTeleportHoverColumn mirrors the inline truthy check', () => {
    expect(isTeleportHoverColumn({ valueType: 'option', hoverActions: [{ label: 'x' }] } as never)).toBe(true)
    expect(isTeleportHoverColumn({ valueType: 'option', hoverActions: true } as never)).toBe(true)
    // 空数组仍为真值。
    // Empty arrays stay truthy, matching the original inline check.
    expect(isTeleportHoverColumn({ valueType: 'option', hoverActions: [] } as never)).toBe(true)
    expect(isTeleportHoverColumn({ valueType: 'option' } as never)).toBe(false)
    expect(isTeleportHoverColumn({ valueType: 'text', hoverActions: [{}] } as never)).toBe(false)
    expect(isTeleportHoverColumn({} as never)).toBe(false)
  })

  it('shouldShowInlineHover matches last-column plus hover rule', () => {
    expect(shouldShowInlineHover(4, 5, true)).toBe(true)
    expect(shouldShowInlineHover(3, 5, true)).toBe(false)
    expect(shouldShowInlineHover(4, 5, false)).toBe(false)
    expect(shouldShowInlineHover(0, 0, true)).toBe(false)
    expect(shouldShowInlineHover(0, 1, true)).toBe(true)
  })
})

/**
 * 拉伸下限宽度（default / virtual 共用口径）的取值矩阵。
 * 取值矩阵覆盖下限宽度（default / virtual 共用口径）。
 */
describe('resolveStretchLowerBound', () => {
  it('takes the larger of width and minWidth when both are present', () => {
    expect(resolveStretchLowerBound({ width: 150, minWidth: 100 } as never)).toBe(150)
    expect(resolveStretchLowerBound({ width: 100, minWidth: 150 } as never)).toBe(150)
  })

  it('falls back to whichever single constraint is present', () => {
    expect(resolveStretchLowerBound({ minWidth: 120 } as never)).toBe(120)
    expect(resolveStretchLowerBound({ width: 120 } as never)).toBe(120)
  })

  it('returns undefined when no width constraint exists (caller applies its own fallback)', () => {
    expect(resolveStretchLowerBound({} as never)).toBeUndefined()
    expect(resolveStretchLowerBound({ label: 'x' } as never)).toBeUndefined()
  })

  it('never yields NaN for non-numeric minWidth or zero width', () => {
    // 类型允许 `minWidth: number | string`（ElTableV2 只接受 number）——字符串按"无约束"处理
    // The type allows `minWidth: number | string` (ElTableV2 only takes number) — strings count as absent
    expect(resolveStretchLowerBound({ width: 150, minWidth: '100px' } as never)).toBe(150)
    // 显式 minWidth: undefined 曾走 `Math.max(width, undefined)` → NaN
    // An explicit minWidth: undefined used to hit `Math.max(width, undefined)` → NaN
    expect(resolveStretchLowerBound({ width: 150, minWidth: undefined } as never)).toBe(150)
    expect(resolveStretchLowerBound({ minWidth: undefined } as never)).toBeUndefined()
    // 0 是合法宽度，必须保留而非按 falsy 丢弃
    // 0 is a legal width and must survive (not dropped as falsy)
    expect(resolveStretchLowerBound({ width: 0, minWidth: 0 } as never)).toBe(0)
    expect(resolveStretchLowerBound({ width: 0 } as never)).toBe(0)
  })
})
