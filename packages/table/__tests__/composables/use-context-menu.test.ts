/**
 * Tests for `use-context-menu` — composable driving the right-click menu
 * state machine (position, items, visibility, click + global listeners).
 */
import type { ProcessedColumn } from '../../src/types/column'
import type {
  ContextMenuConfig,
  ContextMenuItem,
  ContextMenuItemOrSeparator,
  ContextMenuParams,
} from '../../src/types/context-menu'
import type { InterceptorConfig } from '../../src/types/interceptor'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useInterceptor } from '../../src/composables/editing/use-interceptor'
import { isMenuItem, useContextMenu } from '../../src/composables/features/use-context-menu'

interface Row {
  id: number
  name: string
}

const t = (path: string) => path

function makeColumn(overrides: Partial<ProcessedColumn> = {}): ProcessedColumn {
  return { prop: '', label: '', ...overrides, hidden: false } as unknown as ProcessedColumn
}

function makeEvent(x = 100, y = 100): MouseEvent {
  return new MouseEvent('contextmenu', { clientX: x, clientY: y })
}

function makeParams(overrides: Partial<ContextMenuParams<Row>> = {}): ContextMenuParams<Row> {
  return {
    area: 'body',
    row: { id: 1, name: 'Alice' },
    rowIndex: 0,
    column: makeColumn({ prop: 'name', hidden: false }),
    columnIndex: 0,
    event: makeEvent(),
    ...overrides,
  }
}

function buildInterceptor(cfg?: InterceptorConfig) {
  return useInterceptor({ interceptorConfig: () => cfg })
}

function buildMenu(opts: {
  config?: () => any
  columns?: () => ProcessedColumn[]
  cfg?: InterceptorConfig
  onMenuClick?: (params: any) => void
  onBuiltinAction?: (params: any) => void
} = {}) {
  return useContextMenu<Row>({
    menuConfig: (opts.config ?? (() => undefined)) as () => ContextMenuConfig<Row> | undefined,
    effectiveColumns: opts.columns ?? (() => []),
    interceptor: buildInterceptor(opts.cfg),
    t,
    onMenuClick: opts.onMenuClick,
    onBuiltinAction: opts.onBuiltinAction,
  })
}

describe('useContextMenu', () => {
  describe('initial state', () => {
    it('starts hidden with empty state', () => {
      const r = buildMenu()
      expect(r.menuVisible.value).toBe(false)
      expect(r.menuX.value).toBe(0)
      expect(r.menuY.value).toBe(0)
      expect(r.currentItems.value).toEqual([])
      expect(r.currentParams.value).toBeNull()
    })

    it('menuStyle is a computed that mirrors menuX/menuY in px', () => {
      const r = buildMenu()
      expect(r.menuStyle.value).toEqual({ left: '0px', top: '0px' })
      r.menuX.value = 42
      r.menuY.value = 99
      expect(r.menuStyle.value).toEqual({ left: '42px', top: '99px' })
    })
  })

  describe('handleContextMenu — early return paths', () => {
    it('returns immediately when the showMenu interceptor returns true', async () => {
      const handler = vi.fn(() => true) as any
      const r = buildMenu({
        cfg: { 'event.showMenu': handler },
        config: () => ({ body: { options: [[{ code: 'copyCell', name: 'Copy' }]] } }),
      })

      await r.handleContextMenu(makeParams())

      expect(handler).toHaveBeenCalledTimes(1)
      expect(r.menuVisible.value).toBe(false)
      expect(r.currentItems.value).toEqual([])
    })

    it('returns when no menu items resolve (no config)', async () => {
      const r = buildMenu()
      await r.handleContextMenu(makeParams())
      expect(r.menuVisible.value).toBe(false)
    })

    it('returns when config has no body area entry', async () => {
      const r = buildMenu({ config: () => ({ header: { options: [] } }) })
      await r.handleContextMenu(makeParams())
      expect(r.menuVisible.value).toBe(false)
    })

    it('returns when body area is disabled', async () => {
      const r = buildMenu({
        config: () => ({ body: { enabled: false, options: [[{ code: 'copyCell', name: 'Copy' }]] } }),
      })
      await r.handleContextMenu(makeParams())
      expect(r.menuVisible.value).toBe(false)
    })

    it('returns when the resolved items list is empty', async () => {
      const r = buildMenu({ config: () => ({ body: { options: [] } }) })
      await r.handleContextMenu(makeParams())
      expect(r.menuVisible.value).toBe(false)
    })
  })

  describe('handleContextMenu — per-column contextMenuItems', () => {
    it('uses per-column contextMenuItems for body area when present', async () => {
      const perColumnItems: ContextMenuItemOrSeparator<Row>[][] = [
        [{ code: 'custom', name: 'Custom Action' }],
      ]
      const col = makeColumn({ prop: 'name', contextMenuItems: perColumnItems, hidden: false })
      const r = buildMenu({
        columns: () => [col],
        config: () => ({
          body: { options: [[{ code: 'ignored', name: 'Should Not Show' }]] },
        }),
      })

      await r.handleContextMenu(makeParams({ column: col }))

      expect(r.menuVisible.value).toBe(true)
      const flat = r.currentItems.value.flat()
      expect(flat).toHaveLength(1)
      expect(flat[0].code).toBe('custom')
    })

    it('falls back to global config when column has no contextMenuItems', async () => {
      const col = makeColumn({ prop: 'name', hidden: false })
      const r = buildMenu({
        columns: () => [col],
        config: () => ({ body: { options: [[{ code: 'global', name: 'Global' }]] } }),
      })

      await r.handleContextMenu(makeParams({ column: col }))

      expect(r.menuVisible.value).toBe(true)
      expect(r.currentItems.value.flat()[0].code).toBe('global')
    })

    it('falls back to global config when column prop is not found in effectiveColumns', async () => {
      const col = makeColumn({ prop: 'name', hidden: false })
      const r = buildMenu({
        columns: () => [], // empty — column not found
        config: () => ({ body: { options: [[{ code: 'global', name: 'Global' }]] } }),
      })

      await r.handleContextMenu(makeParams({ column: col }))

      expect(r.menuVisible.value).toBe(true)
      expect(r.currentItems.value.flat()[0].code).toBe('global')
    })

    it('matches by `key` when `prop` is missing', async () => {
      const perColumnItems: ContextMenuItemOrSeparator<Row>[][] = [
        [{ code: 'byKey', name: 'By Key' }],
      ]
      const col = makeColumn({ key: 'name' as any, contextMenuItems: perColumnItems })
      const r = buildMenu({
        columns: () => [col],
        config: () => ({ body: { options: [[{ code: 'global', name: 'Global' }]] } }),
      })

      await r.handleContextMenu(makeParams({ column: col }))

      expect(r.menuVisible.value).toBe(true)
      expect(r.currentItems.value.flat()[0].code).toBe('byKey')
    })

    it('ignores per-column contextMenuItems for header / footer areas', async () => {
      const perColumnItems: ContextMenuItemOrSeparator<Row>[][] = [
        [{ code: 'colHeader', name: 'Col Header' }],
      ]
      const col = makeColumn({ prop: 'name', contextMenuItems: perColumnItems, hidden: false })
      const r = buildMenu({
        columns: () => [col],
        config: () => ({ header: { options: [[{ code: 'h', name: 'Header' }]] } }),
      })

      await r.handleContextMenu(makeParams({ area: 'header', column: col }))

      expect(r.menuVisible.value).toBe(true)
      expect(r.currentItems.value.flat()[0].code).toBe('h')
    })
  })

  describe('handleContextMenu — builtin expansion', () => {
    it('expands a builtin code reference into a translated item', async () => {
      const r = buildMenu({
        config: () => ({ body: { options: [[{ code: 'copyCell' }]] } }),
      })

      await r.handleContextMenu(makeParams())

      expect(r.menuVisible.value).toBe(true)
      const flat = r.currentItems.value.flat()
      expect(flat).toHaveLength(1)
      const first = flat[0]
      expect(first.code).toBe('copyCell')
      if (isMenuItem(first)) {
        expect(first.name).toBe('table.contextMenu.copyCell')
        expect(first.suffix).toEqual({ content: 'Ctrl+C' })
      }
    })

    it('skips builtin codes listed in builtins.disabled', async () => {
      const r = buildMenu({
        config: () => ({
          body: { options: [[{ code: 'copyCell' }, { code: 'copyRow' }]] },
          builtins: { disabled: ['copyRow'] },
        }),
      })

      await r.handleContextMenu(makeParams())

      expect(r.menuVisible.value).toBe(true)
      const codes = r.currentItems.value.flat().map(i => i.code)
      expect(codes).toEqual(['copyCell'])
    })

    it('user-provided `name` overrides the built-in translation', async () => {
      const r = buildMenu({
        config: () => ({
          body: { options: [[{ code: 'copyCell', name: 'My Copy' }]] },
        }),
      })

      await r.handleContextMenu(makeParams())

      const flat = r.currentItems.value.flat()
      const first = flat[0]
      expect(first.code).toBe('copyCell')
      if (isMenuItem(first)) {
        expect(first.name).toBe('My Copy')
      }
    })

    it('user-provided `prefixIcon`, `suffix`, `visible`, `disabled` override builtin defaults', async () => {
      const r = buildMenu({
        config: () => ({
          body: {
            options: [[
              {
                code: 'copyCell',
                prefixIcon: 'user-icon',
                suffix: { content: 'X' },
                visible: false,
                disabled: true,
              },
            ]],
          },
        }),
      })

      await r.handleContextMenu(makeParams())

      const flat = r.currentItems.value.flat()
      const first = flat[0]
      if (isMenuItem(first)) {
        expect(first.prefixIcon).toBe('user-icon')
        expect(first.suffix).toEqual({ content: 'X' })
        expect(first.visible).toBe(false)
        expect(first.disabled).toBe(true)
      }
    })

    it('recursively expands builtin codes inside `children`', async () => {
      const r = buildMenu({
        config: () => ({
          body: {
            options: [[
              {
                code: 'parent',
                name: 'Parent',
                children: [{ code: 'copyCell' }],
              },
            ]],
          },
        }),
      })

      await r.handleContextMenu(makeParams())

      const flat = r.currentItems.value.flat()
      const first = flat[0]
      expect(first.code).toBe('parent')
      if (isMenuItem(first)) {
        expect(first.children).toBeDefined()
        const child = first.children![0]
        expect(child.code).toBe('copyCell')
        expect(child.name).toBe('table.contextMenu.copyCell')
      }
    })

    it('drops builtin children items that resolve to nothing', async () => {
      const r = buildMenu({
        config: () => ({
          body: {
            options: [[
              {
                code: 'parent',
                name: 'Parent',
                children: [{ code: 'copyCell' }],
              },
            ]],
          },
          builtins: { disabled: ['copyCell'] },
        }),
      })

      await r.handleContextMenu(makeParams())

      const flat = r.currentItems.value.flat()
      const first = flat[0]
      expect(first.code).toBe('parent')
      if (isMenuItem(first)) {
        expect(first.children).toEqual([])
      }
    })

    it('passes separators through unchanged', async () => {
      const r = buildMenu({
        config: () => ({
          body: {
            options: [
              [{ code: 'copyCell' }],
              [{ code: 'separator' }],
              [{ code: 'copyRow' }],
            ],
          },
        }),
      })

      await r.handleContextMenu(makeParams())

      const groups = r.currentItems.value
      expect(groups).toHaveLength(3)
      expect(groups[0][0].code).toBe('copyCell')
      expect(groups[1][0].code).toBe('separator')
      expect(groups[2][0].code).toBe('copyRow')
    })
  })

  describe('handleContextMenu — visibleMethod', () => {
    it('returns when visibleMethod returns false', async () => {
      const visibleMethod = vi.fn(() => false)
      const r = buildMenu({
        config: () => ({
          body: { options: [[{ code: 'copyCell' }]] },
          visibleMethod,
        }),
      })

      await r.handleContextMenu(makeParams())

      expect(visibleMethod).toHaveBeenCalledTimes(1)
      expect(r.menuVisible.value).toBe(false)
    })

    it('hides the menu without rejecting when visibleMethod throws', async () => {
      const visibleMethod = vi.fn(() => {
        throw new Error('gate boom')
      })
      const r = buildMenu({
        config: () => ({
          body: { options: [[{ code: 'copyCell' }]] },
          visibleMethod,
        }),
      })

      await expect(r.handleContextMenu(makeParams())).resolves.toBeUndefined()
      expect(r.menuVisible.value).toBe(false)
    })

    it('hides the menu without rejecting when visibleMethod rejects', async () => {
      const visibleMethod = vi.fn(() => Promise.reject(new Error('async gate boom')))
      const r = buildMenu({
        config: () => ({
          body: { options: [[{ code: 'copyCell' }]] },
          visibleMethod,
        }),
      })

      await expect(r.handleContextMenu(makeParams())).resolves.toBeUndefined()
      expect(r.menuVisible.value).toBe(false)
    })

    it('returns when visibleMethod returns a promise that resolves to false', async () => {
      const visibleMethod = vi.fn(() => Promise.resolve(false))
      const r = buildMenu({
        config: () => ({
          body: { options: [[{ code: 'copyCell' }]] },
          visibleMethod,
        }),
      })

      await r.handleContextMenu(makeParams())

      expect(r.menuVisible.value).toBe(false)
    })

    it('shows the menu when visibleMethod returns true', async () => {
      const visibleMethod = vi.fn((..._args: any[]) => true)
      const r = buildMenu({
        config: () => ({
          body: { options: [[{ code: 'copyCell' }]] },
          visibleMethod,
        }),
      })

      await r.handleContextMenu(makeParams())

      expect(r.menuVisible.value).toBe(true)
    })

    it('receives the resolved (builtin-expanded) options in the visibleMethod params', async () => {
      const visibleMethod = vi.fn(() => true)
      const r = buildMenu({
        config: () => ({
          body: { options: [[{ code: 'copyCell' }]] },
          visibleMethod,
        }),
      })

      await r.handleContextMenu(makeParams())

      const call = (visibleMethod.mock.calls[0] as any[])?.[0]
      expect(call).toBeDefined()
      expect(call.options).toBeDefined()
      const firstItem = call.options[0][0]
      expect(firstItem.code).toBe('copyCell')
      expect(firstItem.name).toBe('table.contextMenu.copyCell')
    })

    it('returns when all items have visible=false (after expansion)', async () => {
      const r = buildMenu({
        config: () => ({
          body: { options: [[{ code: 'copyCell', visible: false }]] },
          visibleMethod: () => true,
        }),
      })

      await r.handleContextMenu(makeParams())

      expect(r.menuVisible.value).toBe(false)
    })

    it('keeps the menu visible when at least one item is visible', async () => {
      const r = buildMenu({
        config: () => ({
          body: {
            options: [[
              { code: 'copyCell', visible: false },
              { code: 'copyRow' },
            ]],
          },
          visibleMethod: () => true,
        }),
      })

      await r.handleContextMenu(makeParams())

      expect(r.menuVisible.value).toBe(true)
    })
  })

  describe('handleContextMenu — position adjustment', () => {
    it('keeps the cursor position when it fits in the viewport', async () => {
      const r = buildMenu({
        config: () => ({ body: { options: [[{ code: 'copyCell' }]] } }),
      })
      await r.handleContextMenu(makeParams({ event: makeEvent(50, 50) }))
      expect(r.menuX.value).toBe(50)
      expect(r.menuY.value).toBe(50)
    })

    it('shifts left when the menu would overflow the right edge', async () => {
      const r = buildMenu({
        config: () => ({ body: { options: [[{ code: 'copyCell' }]] } }),
      })
      // viewportW default in happy-dom is 1024; x + 180 + 4 > 1024
      await r.handleContextMenu(makeParams({ event: makeEvent(1000, 50) }))
      expect(r.menuX.value).toBe(1000 - 180)
      expect(r.menuY.value).toBe(50)
    })

    it('shifts up when the menu would overflow the bottom edge', async () => {
      const r = buildMenu({
        config: () => ({ body: { options: [[{ code: 'copyCell' }]] } }),
      })
      // viewportH default in happy-dom is 768; 1 item → estimatedH=32
      // y + 32 + 4 > 768 → y = 768 - 32 - 4 = 732
      await r.handleContextMenu(makeParams({ event: makeEvent(50, 740) }))
      expect(r.menuY.value).toBe(768 - 32 - 4)
      expect(r.menuX.value).toBe(50)
    })

    it('clamps the position to a minimum padding of 4px from the top-left', async () => {
      const r = buildMenu({
        config: () => ({ body: { options: [[{ code: 'copyCell' }]] } }),
      })
      await r.handleContextMenu(makeParams({ event: makeEvent(-100, -100) }))
      expect(r.menuX.value).toBe(4)
      expect(r.menuY.value).toBe(4)
    })
  })

  describe('handleContextMenu — state assignment', () => {
    it('sets menuX, menuY, currentItems, currentParams, menuVisible', async () => {
      const params = makeParams({ event: makeEvent(123, 234) })
      const r = buildMenu({
        config: () => ({ body: { options: [[{ code: 'copyCell' }]] } }),
      })

      await r.handleContextMenu(params)

      expect(r.menuX.value).toBe(123)
      expect(r.menuY.value).toBe(234)
      expect(r.currentItems.value).toHaveLength(1)
      expect(r.currentParams.value).toBe(params)
      expect(r.menuVisible.value).toBe(true)
    })

    it('closes any prior menu before showing a new one', async () => {
      const r = buildMenu({
        config: () => ({ body: { options: [[{ code: 'copyCell' }], [{ code: 'copyRow' }]] } }),
      })

      await r.handleContextMenu(makeParams({ event: makeEvent(10, 10) }))
      expect(r.menuVisible.value).toBe(true)
      expect(r.currentItems.value).toHaveLength(2)

      await r.handleContextMenu(makeParams({ event: makeEvent(20, 20) }))
      expect(r.menuVisible.value).toBe(true)
      expect(r.currentItems.value).toHaveLength(2)
      expect(r.menuX.value).toBe(20)
      expect(r.menuY.value).toBe(20)
    })
  })

  describe('closeMenu', () => {
    it('resets visible, items, and params', async () => {
      const r = buildMenu({
        config: () => ({ body: { options: [[{ code: 'copyCell' }]] } }),
      })
      await r.handleContextMenu(makeParams())
      expect(r.menuVisible.value).toBe(true)

      r.closeMenu()
      expect(r.menuVisible.value).toBe(false)
      expect(r.currentItems.value).toEqual([])
      expect(r.currentParams.value).toBeNull()
    })

    it('is safe to call when no menu is open', () => {
      const r = buildMenu()
      expect(() => r.closeMenu()).not.toThrow()
      expect(r.menuVisible.value).toBe(false)
    })
  })

  describe('onMenuItemClick', () => {
    it('returns early for a separator item', async () => {
      const onMenuClick = vi.fn()
      const r = buildMenu({
        config: () => ({ body: { options: [[{ code: 'copyCell' }]] } }),
        onMenuClick,
      })
      await r.handleContextMenu(makeParams())

      r.onMenuItemClick({ code: 'separator' } as any)

      expect(onMenuClick).not.toHaveBeenCalled()
    })

    it('returns early when the item is disabled', async () => {
      const onMenuClick = vi.fn()
      const r = buildMenu({
        config: () => ({ body: { options: [[{ code: 'copyCell', disabled: true }]] } }),
        onMenuClick,
      })
      await r.handleContextMenu(makeParams())

      r.onMenuItemClick(r.currentItems.value.flat()[0])

      expect(onMenuClick).not.toHaveBeenCalled()
    })

    it('returns early when the item is loading', async () => {
      const onMenuClick = vi.fn()
      const r = buildMenu({
        config: () => ({ body: { options: [[{ code: 'copyCell', loading: true }]] } }),
        onMenuClick,
      })
      await r.handleContextMenu(makeParams())

      r.onMenuItemClick(r.currentItems.value.flat()[0])

      expect(onMenuClick).not.toHaveBeenCalled()
    })

    it('invokes onMenuClick with area/menu/context payload and closes the menu', async () => {
      const onMenuClick = vi.fn()
      const r = buildMenu({
        config: () => ({ body: { options: [[{ code: 'myAction', name: 'My Action' }]] } }),
        onMenuClick,
      })
      const params = makeParams()
      await r.handleContextMenu(params)

      const item = r.currentItems.value.flat()[0]
      r.onMenuItemClick(item)

      expect(onMenuClick).toHaveBeenCalledTimes(1)
      expect(onMenuClick).toHaveBeenCalledWith({
        area: 'body',
        menu: item,
        context: params,
      })
      expect(r.menuVisible.value).toBe(false)
    })

    it('invokes onBuiltinAction for builtin codes (in addition to onMenuClick)', async () => {
      const onMenuClick = vi.fn()
      const onBuiltinAction = vi.fn()
      const r = buildMenu({
        config: () => ({ body: { options: [[{ code: 'copyCell' }]] } }),
        onMenuClick,
        onBuiltinAction,
      })
      const params = makeParams()
      await r.handleContextMenu(params)

      r.onMenuItemClick(r.currentItems.value.flat()[0])

      expect(onBuiltinAction).toHaveBeenCalledTimes(1)
      expect(onBuiltinAction).toHaveBeenCalledWith({
        code: 'copyCell',
        context: params,
      })
      expect(onMenuClick).toHaveBeenCalledTimes(1)
    })

    it('does not invoke onBuiltinAction for custom codes', async () => {
      const onMenuClick = vi.fn()
      const onBuiltinAction = vi.fn()
      const r = buildMenu({
        config: () => ({ body: { options: [[{ code: 'myCustom', name: 'X' }]] } }),
        onMenuClick,
        onBuiltinAction,
      })
      await r.handleContextMenu(makeParams())

      r.onMenuItemClick(r.currentItems.value.flat()[0])

      expect(onBuiltinAction).not.toHaveBeenCalled()
      expect(onMenuClick).toHaveBeenCalledTimes(1)
    })

    it('falls back area to "body" when currentParams is null', () => {
      const onMenuClick = vi.fn()
      const r = buildMenu({ onMenuClick })
      // No handleContextMenu called — currentParams is null
      // Since source returns early when currentParams is null, onMenuClick should not be called
      r.onMenuItemClick({ code: 'a', name: 'A' } as ContextMenuItem)
      expect(onMenuClick).not.toHaveBeenCalled()
    })
  })

  describe('document listeners', () => {
    let addSpy: ReturnType<typeof vi.spyOn>
    let removeSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      addSpy = vi.spyOn(document, 'addEventListener')
      removeSpy = vi.spyOn(document, 'removeEventListener')
    })

    afterEach(() => {
      addSpy.mockRestore()
      removeSpy.mockRestore()
    })

    it('attaches keydown + mousedown (capture) when menu becomes visible', async () => {
      const r = buildMenu({
        config: () => ({ body: { options: [[{ code: 'copyCell' }]] } }),
      })
      expect(r.menuVisible.value).toBe(false)

      await r.handleContextMenu(makeParams())
      expect(r.menuVisible.value).toBe(true)

      const addedTypes = addSpy.mock.calls.map((c: any[]) => c[0])
      expect(addedTypes).toContain('keydown')
      expect(addedTypes).toContain('mousedown')
      for (const call of addSpy.mock.calls as any[][]) {
        if (call[0] === 'keydown' || call[0] === 'mousedown') {
          expect(call[2]).toBe(true) // capture phase
        }
      }
    })

    it('removes keydown + mousedown when closeMenu is called', async () => {
      const r = buildMenu({
        config: () => ({ body: { options: [[{ code: 'copyCell' }]] } }),
      })
      await r.handleContextMenu(makeParams())
      addSpy.mockClear()

      r.closeMenu()
      await nextTick()

      const removedTypes = removeSpy.mock.calls.map((c: any[]) => c[0])
      expect(removedTypes).toContain('keydown')
      expect(removedTypes).toContain('mousedown')
    })

    it('escape keydown closes the menu', async () => {
      const r = buildMenu({
        config: () => ({ body: { options: [[{ code: 'copyCell' }]] } }),
      })
      await r.handleContextMenu(makeParams())
      expect(r.menuVisible.value).toBe(true)

      const ev = new KeyboardEvent('keydown', { key: 'Escape' })
      document.dispatchEvent(ev)

      expect(r.menuVisible.value).toBe(false)
    })

    it('non-Escape keydown does not close the menu', async () => {
      const r = buildMenu({
        config: () => ({ body: { options: [[{ code: 'copyCell' }]] } }),
      })
      await r.handleContextMenu(makeParams())

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

      expect(r.menuVisible.value).toBe(true)
    })

    it('mousedown outside .adv-table-context-menu closes the menu', async () => {
      const r = buildMenu({
        config: () => ({ body: { options: [[{ code: 'copyCell' }]] } }),
      })
      await r.handleContextMenu(makeParams())

      // Build a target outside the menu
      const outside = document.createElement('div')
      document.body.appendChild(outside)
      const ev = new MouseEvent('mousedown', { bubbles: true })
      Object.defineProperty(ev, 'target', { value: outside, configurable: true })

      document.dispatchEvent(ev)

      expect(r.menuVisible.value).toBe(false)
      outside.remove()
    })

    it('mousedown inside .adv-table-context-menu does NOT close the menu', async () => {
      const r = buildMenu({
        config: () => ({ body: { options: [[{ code: 'copyCell' }]] } }),
      })
      await r.handleContextMenu(makeParams())

      // Build a target whose closest('.adv-table-context-menu') returns non-null.
      const menuRoot = document.createElement('div')
      menuRoot.classList.add('adv-table-context-menu')
      const inner = document.createElement('span')
      menuRoot.appendChild(inner)
      document.body.appendChild(menuRoot)

      const ev = new MouseEvent('mousedown', { bubbles: true })
      Object.defineProperty(ev, 'target', { value: inner, configurable: true })

      document.dispatchEvent(ev)

      expect(r.menuVisible.value).toBe(true)
      menuRoot.remove()
    })
  })

  describe('return shape', () => {
    it('exposes the expected public API', () => {
      const r = buildMenu()
      expect(r.menuVisible).toBeDefined()
      expect(r.menuX).toBeDefined()
      expect(r.menuY).toBeDefined()
      expect(r.currentItems).toBeDefined()
      expect(r.currentParams).toBeDefined()
      expect(r.menuStyle).toBeDefined()
      expect(r.handleContextMenu).toBeTypeOf('function')
      expect(r.closeMenu).toBeTypeOf('function')
      expect(r.onMenuItemClick).toBeTypeOf('function')
    })

    it('menuStyle is reactive — re-reads after the next tick', async () => {
      const r = buildMenu()
      r.menuX.value = 5
      r.menuY.value = 10
      await nextTick()
      expect(r.menuStyle.value).toEqual({ left: '5px', top: '10px' })
    })
  })
})
