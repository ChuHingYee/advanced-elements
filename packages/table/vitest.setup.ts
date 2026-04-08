import { config } from '@vue/test-utils'
import ResizeObserver from 'resize-observer-polyfill'
import { vi } from 'vitest'

vi.stubGlobal('ResizeObserver', ResizeObserver)

// <zh/> 仅静默 Vue 的"递归更新超限"预期噪音，其余告警原样透传——宽泛的 mock 会吞掉全部
// <zh/> console.warn 并掩盖真实回归信号，请勿扩大此处的匹配条件。
// <en/> Silence ONLY Vue's expected "recursive updates exceeded" noise; forward everything else —
// <en/> a broad mock swallows all console.warn and hides real regression signals, so do not widen
// <en/> the match condition here.
const originalWarn = console.warn.bind(console)
vi.spyOn(console, 'warn').mockImplementation((message: unknown, ...args: unknown[]) => {
  if (typeof message === 'string' && message.includes('Maximum recursive updates exceeded')) {
    // <zh/> 有意静默：该告警在既有用例中属预期噪音 | <en/> intentionally silenced: expected noise in existing cases
    return
  }
  originalWarn(message, ...args)
})

config.global.stubs = {}
