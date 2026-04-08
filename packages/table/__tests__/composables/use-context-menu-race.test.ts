import type { ContextMenuConfig } from '../../src/types/context-menu'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useInterceptor } from '../../src/composables/editing/use-interceptor'
import { useContextMenu } from '../../src/composables/features/use-context-menu'

const t = (k: string) => k

function makeEvent(x = 10, y = 10): MouseEvent {
  return new MouseEvent('contextmenu', { clientX: x, clientY: y })
}

function buildMenu(menuConfig: () => ContextMenuConfig<any> | undefined) {
  return useContextMenu<any>({
    menuConfig,
    effectiveColumns: () => [],
    interceptor: useInterceptor({ interceptorConfig: () => undefined }),
    t,
  })
}

function bodyOptions() {
  return [[{ code: 'copyCell', name: 'Copy' }]]
}

describe('context menu request generation', () => {
  it('drops a slow first visibleMethod resolution when a second menu opens', async () => {
    let releaseFirst!: (v: boolean) => void
    const firstGate = new Promise<boolean>((resolve) => {
      releaseFirst = resolve
    })
    const visibleMethod = vi.fn()
      .mockReturnValueOnce(firstGate)
      .mockResolvedValueOnce(true)
    const gated = buildMenu(() => ({ body: { options: bodyOptions() }, visibleMethod }) as any)

    const first = gated.handleContextMenu({ area: 'body', event: makeEvent() } as any)
    await nextTick()
    // 第二次右键（快决议）应赢并打开菜单
    await gated.handleContextMenu({ area: 'body', event: makeEvent(20, 20) } as any)
    expect(gated.menuVisible.value).toBe(true)
    // 释放第一次的慢决议：不得覆盖第二次的菜单（仍可见且为第二次位置）
    releaseFirst(true)
    await first
    await nextTick()
    expect(gated.menuVisible.value).toBe(true)
    expect(gated.menuX.value).toBe(20)
    expect(visibleMethod).toHaveBeenCalledTimes(2)
  })

  it('closeMenu invalidates in-flight resolutions', async () => {
    let release!: (v: boolean) => void
    const gate = new Promise<boolean>((resolve) => {
      release = resolve
    })
    const gated = buildMenu(() => ({ body: { options: bodyOptions() }, visibleMethod: () => gate }) as any)
    const p = gated.handleContextMenu({ area: 'body', event: makeEvent() } as any)
    gated.closeMenu()
    release(true)
    await p
    expect(gated.menuVisible.value).toBe(false)
  })
})
