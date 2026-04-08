import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useOverflowTooltip } from '../../src/composables/shared/use-overflow-tooltip'

describe('useOverflowTooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function createMockEl(overflow: boolean): HTMLElement {
    return {
      scrollWidth: overflow ? 200 : 100,
      clientWidth: 100,
      isConnected: true,
      textContent: overflow ? 'very long text that overflows' : 'short',
      closest: () => null,
    } as unknown as HTMLElement
  }

  /** Helper: create tooltip with containerVisible=true for tests that need tooltip to show */
  function createVisible(opts?: Record<string, any>) {
    return useOverflowTooltip({ containerVisible: () => true, ...opts })
  }

  describe('initial state', () => {
    it('should return tooltipProps with disabled=true and visible=false', () => {
      const { tooltipProps } = useOverflowTooltip()
      expect(tooltipProps.value.disabled).toBe(true)
      expect(tooltipProps.value.visible).toBe(false)
    })
  })

  describe('onCellEnter', () => {
    it('should not show tooltip when element does not overflow', () => {
      const { onCellEnter, tooltipProps } = createVisible()
      const el = createMockEl(false)

      onCellEnter(el, false)

      vi.advanceTimersByTime(300)
      expect(tooltipProps.value.disabled).toBe(true)
      expect(tooltipProps.value.visible).toBe(false)
    })

    it('should show tooltip after 300ms when element overflows', () => {
      const { onCellEnter, tooltipProps } = createVisible()
      const el = createMockEl(true)

      onCellEnter(el, false)

      // Before 300ms — not yet visible
      expect(tooltipProps.value.disabled).toBe(true)

      vi.advanceTimersByTime(300)
      expect(tooltipProps.value.disabled).toBe(false)
      expect(tooltipProps.value.visible).toBe(true)
      expect(tooltipProps.value.content).toBe('very long text that overflows')
    })

    it('should not show tooltip when disabled is true', () => {
      const { onCellEnter, tooltipProps } = createVisible()
      const el = createMockEl(true)

      onCellEnter(el, true)

      vi.advanceTimersByTime(300)
      expect(tooltipProps.value.disabled).toBe(true)
    })

    it('should not show tooltip when container is not visible', () => {
      const { onCellEnter, tooltipProps } = useOverflowTooltip({
        containerVisible: () => false,
      })
      const el = createMockEl(true)

      onCellEnter(el, false)

      vi.advanceTimersByTime(300)
      expect(tooltipProps.value.disabled).toBe(true)
    })

    it('should show tooltip when containerVisible is not set (defaults to visible)', () => {
      const { onCellEnter, tooltipProps } = useOverflowTooltip()
      const el = createMockEl(true)

      onCellEnter(el, false)

      vi.advanceTimersByTime(300)
      // containerVisible defaults to true when not set, so tooltip should show
      expect(tooltipProps.value.disabled).toBe(false)
      expect(tooltipProps.value.visible).toBe(true)
    })

    it('should use column-level formatter over table-level formatter', () => {
      const columnFormatter = vi.fn(() => 'column formatted')
      const tableFormatter = vi.fn(() => 'table formatted')
      const { onCellEnter, tooltipProps } = createVisible({
        tooltipFormatter: () => tableFormatter,
      })
      const el = createMockEl(true)

      onCellEnter(el, false, {
        row: { name: 'test' },
        column: { prop: 'name', hidden: false },
        cellValue: 'test',
        tooltipFormatter: columnFormatter,
      })

      vi.advanceTimersByTime(300)
      expect(columnFormatter).toHaveBeenCalledWith({
        row: { name: 'test' },
        column: { prop: 'name', hidden: false },
        cellValue: 'test',
      })
      expect(tableFormatter).not.toHaveBeenCalled()
      expect(tooltipProps.value.content).toBe('column formatted')
    })

    it('should use table-level formatter when column formatter is not set', () => {
      const tableFormatter = vi.fn(() => 'table formatted')
      const { onCellEnter, tooltipProps } = createVisible({
        tooltipFormatter: () => tableFormatter,
      })
      const el = createMockEl(true)

      onCellEnter(el, false, { cellValue: 'test' })

      vi.advanceTimersByTime(300)
      expect(tableFormatter).toHaveBeenCalled()
      expect(tooltipProps.value.content).toBe('table formatted')
    })

    it('should use el.textContent when no formatter is set', () => {
      const { onCellEnter, tooltipProps } = createVisible()
      const el = createMockEl(true)

      onCellEnter(el, false)

      vi.advanceTimersByTime(300)
      expect(tooltipProps.value.content).toBe('very long text that overflows')
    })

    it('should cancel pending show when entering another cell', () => {
      const { onCellEnter, tooltipProps } = createVisible()
      const el1 = createMockEl(true)
      const el2 = createMockEl(true)

      onCellEnter(el1, false)
      vi.advanceTimersByTime(100)
      onCellEnter(el2, false)

      vi.advanceTimersByTime(300)
      expect(tooltipProps.value.virtualRef).toBe(el2)
    })

    it('should clear hide timer when entering a cell', () => {
      const { onCellEnter, onCellLeave, tooltipProps } = createVisible()
      const el = createMockEl(true)

      onCellEnter(el, false)
      vi.advanceTimersByTime(300)

      onCellLeave()
      vi.advanceTimersByTime(100) // within 150ms hide delay

      onCellEnter(el, false)
      vi.advanceTimersByTime(150) // past the original hide delay
      expect(tooltipProps.value.visible).toBe(true)
    })
  })

  describe('onCellLeave', () => {
    it('should hide tooltip after 150ms delay', () => {
      const { onCellEnter, onCellLeave, tooltipProps } = createVisible()
      const el = createMockEl(true)

      onCellEnter(el, false)
      vi.advanceTimersByTime(300)
      expect(tooltipProps.value.visible).toBe(true)

      onCellLeave()
      expect(tooltipProps.value.visible).toBe(true) // not yet hidden

      vi.advanceTimersByTime(150)
      expect(tooltipProps.value.visible).toBe(false)
      expect(tooltipProps.value.disabled).toBe(true)
    })

    it('should cancel hide if cell is re-entered within delay', () => {
      const { onCellEnter, onCellLeave, tooltipProps } = createVisible()
      const el = createMockEl(true)

      onCellEnter(el, false)
      vi.advanceTimersByTime(300)

      onCellLeave()
      vi.advanceTimersByTime(100) // within 150ms hide delay

      onCellEnter(el, false)
      vi.advanceTimersByTime(150) // past the original hide delay
      expect(tooltipProps.value.visible).toBe(true)
    })
  })

  describe('forceHide', () => {
    it('should immediately hide tooltip', () => {
      const { onCellEnter, forceHide, tooltipProps } = createVisible()
      const el = createMockEl(true)

      onCellEnter(el, false)
      vi.advanceTimersByTime(300)
      expect(tooltipProps.value.visible).toBe(true)

      forceHide()
      expect(tooltipProps.value.visible).toBe(false)
      expect(tooltipProps.value.disabled).toBe(true)
    })

    it('should cancel pending show timer', () => {
      const { onCellEnter, forceHide, tooltipProps } = createVisible()
      const el = createMockEl(true)

      onCellEnter(el, false)
      forceHide()

      vi.advanceTimersByTime(300)
      expect(tooltipProps.value.visible).toBe(false)
    })
  })

  describe('tooltipProps', () => {
    it('should apply custom effect', () => {
      const { tooltipProps } = useOverflowTooltip({
        tooltipEffect: () => 'light',
      })
      expect(tooltipProps.value.effect).toBe('light')
    })

    it('should default effect to dark', () => {
      const { tooltipProps } = useOverflowTooltip()
      expect(tooltipProps.value.effect).toBe('dark')
    })

    it('should apply custom placement from tooltipOptions', () => {
      const { tooltipProps } = useOverflowTooltip({
        tooltipOptions: () => ({ placement: 'bottom' }),
      })
      expect(tooltipProps.value.placement).toBe('bottom')
    })

    it('should default placement to top', () => {
      const { tooltipProps } = useOverflowTooltip()
      expect(tooltipProps.value.placement).toBe('top')
    })

    it('should be disabled when container is not visible', () => {
      const { tooltipProps } = useOverflowTooltip({
        containerVisible: () => false,
      })
      expect(tooltipProps.value.disabled).toBe(true)
      expect(tooltipProps.value.visible).toBe(false)
    })

    it('should use virtual triggering', () => {
      const { tooltipProps } = useOverflowTooltip()
      expect(tooltipProps.value.virtualTriggering).toBe(true)
    })

    it('should set virtualRef to trigger element', () => {
      const { onCellEnter, tooltipProps } = createVisible()
      const el = createMockEl(true)

      onCellEnter(el, false)
      vi.advanceTimersByTime(300)

      expect(tooltipProps.value.virtualRef).toBe(el)
    })

    it('should merge custom tooltipOptions', () => {
      const { tooltipProps } = useOverflowTooltip({
        tooltipOptions: () => ({ popperClass: 'custom-class', zIndex: 9999 }),
      })
      expect((tooltipProps.value as any).popperClass).toBe('custom-class')
      expect((tooltipProps.value as any).zIndex).toBe(9999)
    })
  })

  describe('anchor alive polling', () => {
    let observerCallback: MutationCallback
    const originalMO = globalThis.MutationObserver
    const originalDoc = (globalThis as any).document

    beforeEach(() => {
      globalThis.MutationObserver = class {
        constructor(cb: MutationCallback) {
          observerCallback = cb
        }

        observe = vi.fn()
        disconnect = vi.fn()
        takeRecords = vi.fn(() => [])
      } as any
      // Ensure document.body exists for anchorObserver.observe(document.body, ...)
      if (!globalThis.document) {
        ;(globalThis as any).document = { body: {} }
      }
    })

    afterEach(() => {
      globalThis.MutationObserver = originalMO
      if (originalDoc) {
        ;(globalThis as any).document = originalDoc
      }
      else {
        delete (globalThis as any).document
      }
    })

    it('should hide tooltip when trigger element is disconnected', () => {
      const { onCellEnter, tooltipProps } = createVisible()
      const el = createMockEl(true)
      // parentNode must be truthy for startAnchorAlivePolling to proceed
      ;(el as any).parentNode = {}

      onCellEnter(el, false)
      vi.advanceTimersByTime(300)
      expect(tooltipProps.value.visible).toBe(true)

      ;(el as any).isConnected = false

      // Trigger MutationObserver callback (fires on any DOM subtree change)
      observerCallback([], {} as any)

      expect(tooltipProps.value.visible).toBe(false)
    })

    it('should start polling only after tooltip is shown', () => {
      const { onCellEnter, tooltipProps } = createVisible()
      const el = createMockEl(true)
      ;(el as any).parentNode = {}

      onCellEnter(el, false)

      // Before 300ms — tooltip not yet shown, MutationObserver not started
      vi.advanceTimersByTime(200)
      expect(tooltipProps.value.visible).toBe(false)

      // After 300ms — tooltip shown, polling starts
      vi.advanceTimersByTime(100)
      expect(tooltipProps.value.visible).toBe(true)

      // Polling detects disconnection via MutationObserver callback
      ;(el as any).isConnected = false
      observerCallback([], {} as any)
      expect(tooltipProps.value.visible).toBe(false)
    })
  })
})
