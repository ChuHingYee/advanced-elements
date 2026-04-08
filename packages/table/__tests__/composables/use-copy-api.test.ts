import type { NotifyFn } from '../../src/utils/notification'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCopyApi } from '../../src/composables/shared/use-copy-api'
import { copyToClipboard } from '../../src/utils/copy'

vi.mock('../../src/utils/copy', () => ({
  copyToClipboard: vi.fn(),
}))

const mockCopyToClipboard = vi.mocked(copyToClipboard)

// <zh/> 创建 mock notify 函数，将调用记录到 mockElMessage 以兼容现有断言
// <en/> Create mock notify function, record calls to mockElMessage for existing assertions
function createMockNotify(): { notify: NotifyFn, success: ReturnType<typeof vi.fn>, error: ReturnType<typeof vi.fn>, warning: ReturnType<typeof vi.fn> } {
  const success = vi.fn()
  const error = vi.fn()
  const warning = vi.fn()
  const notify: NotifyFn = (type, message, _source) => {
    if (type === 'success')
      success(message)
    else if (type === 'error')
      error(message)
    else if (type === 'warning')
      warning(message)
  }
  return { notify, success, error, warning }
}

describe('useCopyApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should initialize with copied = false', () => {
    const { notify } = createMockNotify()
    const { copied } = useCopyApi(notify)
    expect(copied.value).toBe(false)
  })

  describe('handleCopyClick', () => {
    it('should copy text without header prefix when copyHeaders is false', async () => {
      mockCopyToClipboard.mockResolvedValue(true)
      const { notify } = createMockNotify()
      const { handleCopyClick } = useCopyApi(notify)

      await handleCopyClick('hello', false, 'Name')

      expect(mockCopyToClipboard).toHaveBeenCalledWith('hello')
    })

    it('should copy text with header prefix when copyHeaders is true', async () => {
      mockCopyToClipboard.mockResolvedValue(true)
      const { notify } = createMockNotify()
      const { handleCopyClick } = useCopyApi(notify)

      await handleCopyClick('hello', true, 'Name')

      expect(mockCopyToClipboard).toHaveBeenCalledWith('Name: hello')
    })

    it('should copy text without prefix when copyHeaders is true but columnLabel is empty', async () => {
      mockCopyToClipboard.mockResolvedValue(true)
      const { notify } = createMockNotify()
      const { handleCopyClick } = useCopyApi(notify)

      await handleCopyClick('hello', true, '')

      expect(mockCopyToClipboard).toHaveBeenCalledWith('hello')
    })

    it('should set copied to true on success', async () => {
      mockCopyToClipboard.mockResolvedValue(true)
      const { notify } = createMockNotify()
      const { copied, handleCopyClick } = useCopyApi(notify)

      await handleCopyClick('hello', false, '')

      expect(copied.value).toBe(true)
    })

    it('should show success message on success', async () => {
      mockCopyToClipboard.mockResolvedValue(true)
      const { notify, success } = createMockNotify()
      const { handleCopyClick } = useCopyApi(notify)

      await handleCopyClick('hello', false, '')

      expect(success).toHaveBeenCalledWith('复制成功')
    })

    it('should use custom translation on success', async () => {
      mockCopyToClipboard.mockResolvedValue(true)
      const { notify, success } = createMockNotify()
      const t = vi.fn((key: string) => `translated:${key}`)
      const { handleCopyClick } = useCopyApi(notify)

      await handleCopyClick('hello', false, '', t)

      expect(t).toHaveBeenCalledWith('table.copy.success')
      expect(success).toHaveBeenCalledWith('translated:table.copy.success')
    })

    it('should reset copied to false after 2 seconds', async () => {
      mockCopyToClipboard.mockResolvedValue(true)
      const { notify } = createMockNotify()
      const { copied, handleCopyClick } = useCopyApi(notify)

      await handleCopyClick('hello', false, '')
      expect(copied.value).toBe(true)

      vi.advanceTimersByTime(2000)
      expect(copied.value).toBe(false)
    })

    it('should not set copied on failure', async () => {
      mockCopyToClipboard.mockResolvedValue(false)
      const { notify } = createMockNotify()
      const { copied, handleCopyClick } = useCopyApi(notify)

      await handleCopyClick('hello', false, '')

      expect(copied.value).toBe(false)
    })

    it('should show error message on failure', async () => {
      mockCopyToClipboard.mockResolvedValue(false)
      const { notify, error } = createMockNotify()
      const { handleCopyClick } = useCopyApi(notify)

      await handleCopyClick('hello', false, '')

      expect(error).toHaveBeenCalledWith('复制失败，请手动复制')
    })

    it('should use custom translation on failure', async () => {
      mockCopyToClipboard.mockResolvedValue(false)
      const { notify, error } = createMockNotify()
      const t = vi.fn((key: string) => `translated:${key}`)
      const { handleCopyClick } = useCopyApi(notify)

      await handleCopyClick('hello', false, '', t)

      expect(t).toHaveBeenCalledWith('table.copy.fail')
      expect(error).toHaveBeenCalledWith('translated:table.copy.fail')
    })

    it('should clear previous timer when copying again', async () => {
      mockCopyToClipboard.mockResolvedValue(true)
      const { notify } = createMockNotify()
      const { copied, handleCopyClick } = useCopyApi(notify)

      await handleCopyClick('first', false, '')
      expect(copied.value).toBe(true)

      // Advance 1 second (not yet 2s)
      vi.advanceTimersByTime(1000)
      expect(copied.value).toBe(true)

      // Copy again — should reset the timer
      await handleCopyClick('second', false, '')
      expect(copied.value).toBe(true)

      // Advance 1s — if old timer wasn't cleared, copied would be false
      vi.advanceTimersByTime(1000)
      expect(copied.value).toBe(true)

      // Advance another 1s (2s total from second copy) — now it should reset
      vi.advanceTimersByTime(1000)
      expect(copied.value).toBe(false)
    })
  })
})
