import { describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { resetDevWarnCacheForTests } from '../../src/utils/dev-warn'
import {
  registerTableId,
  resetTableIdRegistryForTests,
  unregisterTableId,
  useTableIdGuard,
} from '../../src/utils/table-id-registry'

describe('table-id-registry', () => {
  it('register/unregister/reset round-trip', () => {
    resetTableIdRegistryForTests()
    expect(registerTableId('t-a')).toBe(true)
    expect(registerTableId('t-a')).toBe(false)
    unregisterTableId('t-a')
    unregisterTableId('t-a')
    expect(registerTableId('t-a')).toBe(true)
    resetTableIdRegistryForTests()
    expect(registerTableId('t-a')).toBe(true)
    resetTableIdRegistryForTests()
  })

  it('注册失败的实例销毁时不会释放他人仍持有的 ID', async () => {
    resetTableIdRegistryForTests()
    resetDevWarnCacheForTests()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const id = ref('shared-id')

    // A 先注册（成功），B 后注册（失败）
    const scopeA = effectScope(true)
    scopeA.run(() => useTableIdGuard(id))
    const scopeB = effectScope(true)
    scopeB.run(() => useTableIdGuard(id))
    await Promise.resolve()
    expect(warnSpy).toHaveBeenCalledTimes(1)

    // B 销毁（它的注册本就失败，绝不能动 A 的占用）
    scopeB.stop()
    warnSpy.mockClear()
    resetDevWarnCacheForTests()

    // C 仍应看到 A 占着该 ID → 继续告警
    const scopeC = effectScope(true)
    scopeC.run(() => useTableIdGuard(id))
    await Promise.resolve()
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('shared-id'))

    // A 销毁后占用才真正释放，D 注册不再告警
    scopeA.stop()
    warnSpy.mockClear()
    resetDevWarnCacheForTests()
    const scopeD = effectScope(true)
    scopeD.run(() => useTableIdGuard(id))
    await Promise.resolve()
    expect(warnSpy).not.toHaveBeenCalled()

    scopeC.stop()
    scopeD.stop()
    warnSpy.mockRestore()
    resetTableIdRegistryForTests()
  })

  it('guard warns once on duplicate live ids and frees on dispose', async () => {
    resetTableIdRegistryForTests()
    resetDevWarnCacheForTests()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const id = ref('dup-table')

    const scopeA = effectScope(true)
    scopeA.run(() => useTableIdGuard(id))
    const scopeB = effectScope(true)
    scopeB.run(() => useTableIdGuard(id))
    await Promise.resolve()

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('dup-table'))

    // <zh/> 两个实例都释放后，同 ID 可重新注册不再告警 | <en/> After both instances are disposed the same ID registers cleanly
    warnSpy.mockClear()
    resetDevWarnCacheForTests()
    scopeA.stop()
    scopeB.stop()
    const scopeC = effectScope(true)
    scopeC.run(() => useTableIdGuard(id))
    await Promise.resolve()
    expect(warnSpy).not.toHaveBeenCalled()

    scopeC.stop()
    warnSpy.mockRestore()
    resetTableIdRegistryForTests()
  })

  it('guard tracks id changes: unregisters the old value', async () => {
    resetTableIdRegistryForTests()
    resetDevWarnCacheForTests()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const id = ref('first')

    const scope = effectScope(true)
    scope.run(() => useTableIdGuard(id))
    await Promise.resolve()
    id.value = 'second'
    await Promise.resolve()

    // <zh/> first 已释放，其它实例可复用不告警 | <en/> first is released and reusable by others without warning
    const other = effectScope(true)
    other.run(() => useTableIdGuard(ref('first')))
    await Promise.resolve()
    expect(warnSpy).not.toHaveBeenCalled()

    scope.stop()
    other.stop()
    warnSpy.mockRestore()
    resetTableIdRegistryForTests()
  })

  it('guard reports duplicates via onDuplicate for error-event routing', async () => {
    resetTableIdRegistryForTests()
    resetDevWarnCacheForTests()
    const onDuplicate = vi.fn()
    const id = ref('dup-callback')

    const scopeA = effectScope(true)
    scopeA.run(() => useTableIdGuard(id, onDuplicate))
    const scopeB = effectScope(true)
    scopeB.run(() => useTableIdGuard(id, onDuplicate))
    await Promise.resolve()

    expect(onDuplicate).toHaveBeenCalledTimes(1)
    expect(onDuplicate).toHaveBeenCalledWith('dup-callback')

    scopeA.stop()
    scopeB.stop()
    resetTableIdRegistryForTests()
  })
})
