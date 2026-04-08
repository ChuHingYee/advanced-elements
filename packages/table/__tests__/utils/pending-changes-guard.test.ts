import { describe, expect, it, vi } from 'vitest'
import { abortOnPendingChanges } from '../../src/utils/pending-changes-guard'

/**
 * <zh/> 未提交编辑守卫单测——覆盖放行、中止与缺省不校验。
 * <en/> Pending-changes guard tests — pass, abort and absent probe.
 */
describe('abortOnPendingChanges', () => {
  const t = (k: string) => k

  it('returns false without probe', () => {
    expect(abortOnPendingChanges({ notify: vi.fn(), t, messageKey: 'm', source: 'export' })).toBe(false)
  })

  it('returns false when no unsaved changes', () => {
    const notify = vi.fn()
    expect(abortOnPendingChanges({ hasUnsavedChanges: () => false, notify, t, messageKey: 'm', source: 'export' })).toBe(false)
    expect(notify).not.toHaveBeenCalled()
  })

  it('aborts with notify when unsaved changes exist', () => {
    const notify = vi.fn()
    expect(abortOnPendingChanges({ hasUnsavedChanges: () => true, notify, t, messageKey: 'unsaved.tip', source: 'print' })).toBe(true)
    expect(notify).toHaveBeenCalledWith('warning', 'unsaved.tip', 'print')
  })
})
