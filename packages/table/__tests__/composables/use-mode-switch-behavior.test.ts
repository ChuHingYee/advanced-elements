import type { ModeSwitchCleanup, ModeSwitchNotice } from '../../src/composables/core/use-mode-switch-behavior'
import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { canSwitchMode, useModeSwitchBehavior } from '../../src/composables/core/use-mode-switch-behavior'

/**
 * <zh/> 为 useModeSwitchBehavior 创建受控的测试夹具 | <en/> Create controllable test fixture for useModeSwitchBehavior
 */
function setup(initialMode = 'default', initialBehavior: 'warn' | 'error' | 'silent' | undefined = 'warn') {
  const mode = ref(initialMode)
  const behavior = ref<'warn' | 'error' | 'silent' | undefined>(initialBehavior)
  const cancelEditing = vi.fn()
  const resetShiftSelect = vi.fn()
  const notify = vi.fn()
  const notifyError = vi.fn()

  const cleanup: ModeSwitchCleanup = {
    cancelEditing,
    resetShiftSelect,
  }
  const notice: ModeSwitchNotice = { notify, notifyError }

  const scope = effectScope(true)
  scope.run(() => {
    useModeSwitchBehavior({
      mode: () => mode.value,
      behavior: () => behavior.value,
      cleanup,
      notice,
    })
  })

  return {
    mode,
    behavior,
    cancelEditing,
    resetShiftSelect,
    notify,
    notifyError,
    dispose: () => scope.stop(),
  }
}

describe('useModeSwitchBehavior', () => {
  describe('behavior = warn (default)', () => {
    it('performs state cleanup and dispatches info notice on mode change', async () => {
      const s = setup('default', 'warn')
      s.mode.value = 'virtual'
      await nextTick()

      expect(s.cancelEditing).toHaveBeenCalledTimes(1)
      expect(s.resetShiftSelect).toHaveBeenCalledTimes(1)
      expect(s.notify).toHaveBeenCalledTimes(1)
      expect(s.notify).toHaveBeenCalledWith({ from: 'default', to: 'virtual' })
      s.dispose()
    })

    it('does nothing when mode does not change', async () => {
      const s = setup('default', 'warn')
      s.mode.value = 'default'
      await nextTick()

      expect(s.cancelEditing).not.toHaveBeenCalled()
      expect(s.resetShiftSelect).not.toHaveBeenCalled()
      expect(s.notify).not.toHaveBeenCalled()
      s.dispose()
    })
  })

  describe('behavior = silent', () => {
    it('performs state cleanup but does NOT dispatch notice', async () => {
      const s = setup('default', 'silent')
      s.mode.value = 'virtual'
      await nextTick()

      // 关键约束：silent 与 warn 的状态清理逻辑完全一致
      // Key contract: silent has identical state cleanup as warn
      expect(s.cancelEditing).toHaveBeenCalledTimes(1)
      expect(s.resetShiftSelect).toHaveBeenCalledTimes(1)
      // 唯一差别：silent 不派发通知
      // Only difference: silent does not dispatch notice
      expect(s.notify).not.toHaveBeenCalled()
      s.dispose()
    })

    it('still cleans up when switching back from virtual to default', async () => {
      const s = setup('virtual', 'silent')
      s.mode.value = 'default'
      await nextTick()

      expect(s.cancelEditing).toHaveBeenCalledTimes(1)
      expect(s.resetShiftSelect).toHaveBeenCalledTimes(1)
      expect(s.notify).not.toHaveBeenCalled()
      s.dispose()
    })
  })

  describe('behavior = error', () => {
    it('performs state cleanup and dispatches error notice WITHOUT throwing (Vue watcher best practice)', async () => {
      const s = setup('default', 'error')
      // 严格 Vue 最佳实践：watch 回调永不抛错，可观测性走 notifyError
      // Strict Vue best practice: watcher never throws; observability via notifyError
      expect(() => {
        s.mode.value = 'virtual'
      }).not.toThrow()
      await nextTick()

      // 契约：mode prop 在 watcher 触发前已生效，抛错也阻止不了切换——
      // 必须先收敛状态，否则留下"新 mode + 旧编辑/选择状态"的半迁移
      // Contract: the mode prop is applied before the watcher fires and throwing cannot prevent the
      // switch — state must converge first, otherwise a "new mode + stale state" half-migration remains
      expect(s.cancelEditing).toHaveBeenCalledTimes(1)
      expect(s.resetShiftSelect).toHaveBeenCalledTimes(1)
      // info 通知不派发——error 分支走 notifyError 通道
      // No info notice — the error branch reports through notifyError
      expect(s.notify).not.toHaveBeenCalled()
      expect(s.notifyError).toHaveBeenCalledTimes(1)
      expect(s.notifyError).toHaveBeenCalledWith({ from: 'default', to: 'virtual' })
      s.dispose()
    })

    it('dispatches the error-level notice without throwing', async () => {
      const s = setup('default', 'error')
      s.mode.value = 'virtual'
      await nextTick()

      expect(s.notifyError).toHaveBeenCalledTimes(1)
      expect(s.notifyError).toHaveBeenCalledWith({ from: 'default', to: 'virtual' })
      // Vue 最佳实践：不抛错，业务侧通过 @error 监听而非 try/catch
      // Vue best practice: no throw, observe via @error instead of try/catch
      expect(s.notify).not.toHaveBeenCalled()
      s.dispose()
    })

    it('still dispatches error notice when cleanup is fault-isolated by cancelEditing failure', async () => {
      const mode = ref('default')
      const behavior = ref<'warn' | 'error' | 'silent' | undefined>('error')
      const cancelEditing = vi.fn(() => {
        throw new Error('cancel failed')
      })
      const resetShiftSelect = vi.fn()
      const notify = vi.fn()
      const notifyError = vi.fn()
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const scope = effectScope(true)
      scope.run(() => {
        useModeSwitchBehavior({
          mode: () => mode.value,
          behavior: () => behavior.value,
          cleanup: { cancelEditing, resetShiftSelect },
          notice: { notify, notifyError },
        })
      })

      // 故障隔离中止剩余清理，但 error 策略的报警契约不被清理失败吞掉，且不抛错
      // Fault isolation aborts remaining cleanup, yet the error strategy's alarm contract is not swallowed and does not throw
      mode.value = 'virtual'
      await nextTick()

      expect(cancelEditing).toHaveBeenCalledTimes(1)
      expect(resetShiftSelect).not.toHaveBeenCalled()
      expect(notifyError).toHaveBeenCalledTimes(1)
      expect(notify).not.toHaveBeenCalled()
      warnSpy.mockRestore()
      scope.stop()
    })

    it('error is observable via notifyError + canSwitchMode pre-check', () => {
      // canSwitchMode 为写入点预检的唯一合法阻止手段
      // canSwitchMode is the only legitimate way to prevent a switch at the write site
      expect(canSwitchMode('error')).toBe(false)
      expect(canSwitchMode('warn')).toBe(true)
      expect(canSwitchMode('silent')).toBe(true)
      expect(canSwitchMode(undefined)).toBe(true)

      const s = setup('default', 'error')
      s.mode.value = 'virtual'
      // 同步不抛错，仅通过 notifyError 可观测
      // No sync throw, observable only via notifyError
      expect(s.notifyError).toHaveBeenCalledTimes(1)
      s.dispose()
    })
  })

  describe('behavior = undefined (defaults to warn)', () => {
    it('treats undefined as warn — performs cleanup and dispatches notice', async () => {
      const s = setup('default', undefined)
      s.mode.value = 'virtual'
      await nextTick()

      expect(s.cancelEditing).toHaveBeenCalledTimes(1)
      expect(s.resetShiftSelect).toHaveBeenCalledTimes(1)
      expect(s.notify).toHaveBeenCalledTimes(1)
      s.dispose()
    })
  })

  describe('cancelEditing failure isolation', () => {
    it('aborts remaining cleanup and dispatches notice when cancelEditing throws', async () => {
      const mode = ref('default')
      const behavior = ref<'warn' | 'error' | 'silent' | undefined>('warn')
      const cancelEditing = vi.fn(() => {
        throw new Error('cancel failed')
      })
      const resetShiftSelect = vi.fn()
      const notify = vi.fn()

      const scope = effectScope(true)
      // suppress console.warn during test
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      scope.run(() => {
        useModeSwitchBehavior({
          mode: () => mode.value,
          behavior: () => behavior.value,
          cleanup: { cancelEditing, resetShiftSelect },
          notice: { notify },
        })
      })

      mode.value = 'virtual'
      await nextTick()

      // 故障隔离：cancelEditing 抛错表示编辑状态可能不一致——中止剩余清理，仅派发通知由消费方决定是否重建
      // Fault isolation: cancelEditing throwing means edit state may be inconsistent —
      // abort remaining cleanup and only dispatch the notice so the consumer decides whether to recreate
      expect(cancelEditing).toHaveBeenCalledTimes(1)
      expect(resetShiftSelect).not.toHaveBeenCalled()
      expect(notify).toHaveBeenCalledTimes(1)
      expect(notify).toHaveBeenCalledWith({ from: 'default', to: 'virtual' })
      warnSpy.mockRestore()
      scope.stop()
    })
  })

  describe('multiple consecutive switches', () => {
    it('cleans up on each mode change', async () => {
      const s = setup('default', 'warn')
      s.mode.value = 'virtual'
      await nextTick()
      s.mode.value = 'default'
      await nextTick()

      expect(s.cancelEditing).toHaveBeenCalledTimes(2)
      expect(s.resetShiftSelect).toHaveBeenCalledTimes(2)
      expect(s.notify).toHaveBeenCalledTimes(2)
      expect(s.notify).toHaveBeenNthCalledWith(1, { from: 'default', to: 'virtual' })
      expect(s.notify).toHaveBeenNthCalledWith(2, { from: 'virtual', to: 'default' })
      s.dispose()
    })
  })

  describe('switching behavior at runtime', () => {
    it('respects the latest behavior value', async () => {
      const s = setup('default', 'warn')
      s.mode.value = 'virtual'
      await nextTick()
      expect(s.notify).toHaveBeenCalledTimes(1)

      s.mode.value = 'default'
      await nextTick()
      s.behavior.value = 'silent'

      // Now switch to virtual again — should cleanup but no notice
      s.mode.value = 'virtual'
      await nextTick()

      expect(s.cancelEditing).toHaveBeenCalledTimes(3)
      expect(s.resetShiftSelect).toHaveBeenCalledTimes(3)
      // notify only called for the first two warn-mode switches, not the silent one
      expect(s.notify).toHaveBeenCalledTimes(2)
      s.dispose()
    })

    it('dispatches error notice (no throw) on subsequent switches after switching behavior to error at runtime', async () => {
      const s = setup('default', 'warn')
      s.mode.value = 'virtual'
      await nextTick()

      s.mode.value = 'default'
      await nextTick()

      s.behavior.value = 'error'

      s.mode.value = 'virtual'
      await nextTick()
      expect(s.notifyError).toHaveBeenCalledTimes(1)
      expect(s.notify).toHaveBeenCalledTimes(2) // only the two warn switches
      s.dispose()
    })

    it('canSwitchMode pre-check reflects the latest behavior', () => {
      expect(canSwitchMode('warn')).toBe(true)
      expect(canSwitchMode('error')).toBe(false)
      const s = setup('default', 'warn')
      expect(canSwitchMode(s.behavior.value)).toBe(true)
      s.behavior.value = 'error'
      expect(canSwitchMode(s.behavior.value)).toBe(false)
      s.dispose()
    })
  })
})
