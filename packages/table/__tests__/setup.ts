import { vi } from 'vitest'

// 1. Mock Element Plus global config
const mockElMessage = Object.assign(vi.fn(), {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
})
const mockElMessageBox = vi.fn()

vi.mock('element-plus', async (importOriginal) => {
  const ac = await importOriginal<typeof import('element-plus')>()
  return {
    ...ac,
    ElMessage: mockElMessage,
    ElMessageBox: mockElMessageBox,
  }
})

// 2. Mock dayjs locale imports (avoid loading actual locale data in test env)
vi.mock('dayjs/locale/zh-cn', () => ({}))
vi.mock('dayjs/locale/en', () => ({}))

// 3. Mock navigator.clipboard
defineClipboardMock()

// 4. Mock IntersectionObserver for pagination
mockIntersectionObserver()

// 5. Mock vue-draggable-plus (import-time navigator.userAgent.match fails on happy-dom)
vi.mock('vue-draggable-plus', async (_importOriginal) => {
  const vue = await import('vue')
  return {
    VueDraggable: vue.defineComponent({
      name: 'VueDraggable',
      props: { tag: { type: String, default: 'div' } },
      setup(props, { slots }) {
        return () => {
          const tag = props.tag as keyof HTMLElementTagNameMap
          return vue.h(tag, null, slots.default?.())
        }
      },
    }),
    useDraggable: vi.fn(() => ({ pause: vi.fn(), destroy: vi.fn() })),
    vDraggable: {},
  }
})

// 6. Mock requestAnimationFrame to execute synchronously for tests
// Required because use-column-resize uses rAF for mousemove throttling
// MUST replace regardless of whether happy-dom provides a no-op version
let rafCounter = 0
Object.defineProperty(globalThis, 'requestAnimationFrame', {
  value: ((cb: FrameRequestCallback) => {
    try {
      cb(0)
    }
    catch { /* graceful */ }
    return ++rafCounter
  }) as typeof globalThis.requestAnimationFrame,
  writable: true,
  configurable: true,
})
Object.defineProperty(globalThis, 'cancelAnimationFrame', {
  value: (() => {}) as typeof globalThis.cancelAnimationFrame,
  writable: true,
  configurable: true,
})

// ─── Helpers ──────────────────────────────────────────────────────────────

function mockIntersectionObserver() {
  class MockIntersectionObserver implements IntersectionObserver {
    disconnect = vi.fn()
    observe = vi.fn()
    unobserve = vi.fn()
    takeRecords = vi.fn(() => [])
    root: Element | null = null
    rootMargin = ''
    thresholds: readonly number[] = []
  }
  Object.defineProperty(globalThis, 'IntersectionObserver', {
    value: MockIntersectionObserver,
    writable: true,
    configurable: true,
  })
}

function defineClipboardMock() {
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    } as unknown as Navigator,
    writable: true,
    configurable: true,
  })
}

// Expose for specs to reset manually if needed
export { mockElMessage, mockElMessageBox }
