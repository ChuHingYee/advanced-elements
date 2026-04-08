import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useVirtualSummarySync } from '../../../src/components/table-virtual-renderer/use-virtual-summary-sync'

function makeStrip() {
  return { scrollTo: vi.fn() }
}

function makeV2() {
  return { scrollTo: vi.fn() }
}

describe('useVirtualSummarySync dual strips', () => {
  it('syncs body scroll to both footer and top strip in one frame', () => {
    const rafCallbacks: FrameRequestCallback[] = []
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })
    try {
      const footer = makeStrip()
      const top = makeStrip()
      const summaryFooterRef = ref(footer)
      const topStripRef = ref(top)
      const tableV2Ref = ref(makeV2())
      const { scheduleSummarySync } = useVirtualSummarySync({
        summaryFooterRef,
        topStripRef,
        tableV2Ref,
        getCurrentScrollTop: () => 0,
      })
      scheduleSummarySync(120)
      expect(rafCallbacks).toHaveLength(1)
      rafCallbacks[0]!(0)
      expect(footer.scrollTo).toHaveBeenCalledWith(120)
      expect(top.scrollTo).toHaveBeenCalledWith(120)
    }
    finally {
      rafSpy.mockRestore()
    }
  })

  it('works when only the top strip is present (grandTotalRow top)', () => {
    const rafCallbacks: FrameRequestCallback[] = []
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })
    try {
      const top = makeStrip()
      const summaryFooterRef = ref<any>(null)
      const topStripRef = ref(top)
      const tableV2Ref = ref(makeV2())
      const { scheduleSummarySync } = useVirtualSummarySync({
        summaryFooterRef,
        topStripRef,
        tableV2Ref,
        getCurrentScrollTop: () => 0,
      })
      scheduleSummarySync(55)
      rafCallbacks[0]!(0)
      expect(top.scrollTo).toHaveBeenCalledWith(55)
    }
    finally {
      rafSpy.mockRestore()
    }
  })

  it('forwards strip scroll (from either strip) to the table via scrollTo API', () => {
    const v2 = makeV2()
    const { onSummaryScroll } = useVirtualSummarySync({
      summaryFooterRef: ref(makeStrip()),
      topStripRef: ref(makeStrip()),
      tableV2Ref: ref(v2),
      getCurrentScrollTop: () => 7,
    })
    onSummaryScroll({ scrollLeft: 200, scrollTop: 0 })
    expect(v2.scrollTo).toHaveBeenCalledWith({ scrollLeft: 200, scrollTop: 7 })
  })

  it('batches multiple body scroll frames into one sync', () => {
    let frames = 0
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => ++frames)
    try {
      const footer = makeStrip()
      const { scheduleSummarySync } = useVirtualSummarySync({
        summaryFooterRef: ref(footer),
        tableV2Ref: ref(makeV2()),
        getCurrentScrollTop: () => 0,
      })
      scheduleSummarySync(10)
      scheduleSummarySync(20)
      scheduleSummarySync(30)
      // <zh/> 第二/三次调用因 rAF 待执行被合并 | <en/> 2nd/3rd calls merge into the pending rAF
      expect(frames).toBe(1)
    }
    finally {
      rafSpy.mockRestore()
    }
  })
})
