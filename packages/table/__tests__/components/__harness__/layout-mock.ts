import { vi } from 'vitest'
/**
 * @file layout-mock.ts
 * <zh/> 布局 mock——happy-dom 无真实布局，ResizeObserver/AutoResizer 测量恒为 0，
 * <zh/> 导致虚拟模式表头与行被尺寸门控抑制。此模块将 useElementSize 固定为 600×320。
 * <zh/> 用法：在对等 spec 顶部 `import '../__harness__/layout-mock'`（须先于被测模块导入）。
 *
 * <en/> Layout mock — happy-dom has no real layout; ResizeObserver/AutoResizer measure 0,
 * <en/> which size-gates virtual headers & rows. This pins useElementSize to 600×320.
 * <en/> Usage: import '../__harness__/layout-mock' at the top of parity specs.
 */

const mocks = vi.hoisted(() => {
  return {
    width: { value: 600 },
    height: { value: 320 },
  }
})

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return {
    ...actual,
    useElementSize: () => ({
      width: mocks.width,
      height: mocks.height,
      stop: () => {},
    }),
  }
})

export function setViewport(width: number, height: number): void {
  mocks.width.value = width
  mocks.height.value = height
}
