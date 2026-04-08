import type { ProcessedColumn } from '../../src/types/column'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useColumnSetting } from '../../src/composables/columns/use-column-setting'

vi.mock('vue', async (importOriginal) => {
  const vue = await importOriginal<typeof import('vue')>()
  return { ...vue, provide: vi.fn() }
})

function makeCol(key: string, overrides?: Partial<ProcessedColumn>): ProcessedColumn {
  return { key, prop: key, label: key, hidden: false, ...overrides } as unknown as ProcessedColumn
}

describe('useColumnSetting phase2', () => {
  let resetColumnsMock: ReturnType<typeof vi.fn>
  let emitColumnVisibleMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    resetColumnsMock = vi.fn()
    emitColumnVisibleMock = vi.fn()
    vi.clearAllMocks()
  })

  function createSetting(cols?: ProcessedColumn[]) {
    const headers = ref<ProcessedColumn[]>(cols ?? [
      makeCol('a'),
      makeCol('b'),
      makeCol('c', { fixed: 'left' }),
      makeCol('d', { fixed: 'right' }),
    ])
    return useColumnSetting({
      headers,
      resetColumns: resetColumnsMock as any,
      emitColumnVisible: emitColumnVisibleMock as any,
    })
  }

  describe('handleGroupUpdate', () => {
    it('queues group update and applies atomically', async () => {
      const headers = ref<ProcessedColumn[]>([makeCol('a'), makeCol('b')])
      const result = useColumnSetting({
        headers,
        resetColumns: resetColumnsMock as any,
        emitColumnVisible: emitColumnVisibleMock as any,
      })

      result.handleGroupUpdate('normal', [makeCol('b'), makeCol('a')])
      await nextTick()

      expect(headers.value[0].key).toBe('b')
      expect(headers.value[1].key).toBe('a')
    })

    it('multiple group updates are applied atomically', async () => {
      const headers = ref<ProcessedColumn[]>([
        makeCol('a'),
        makeCol('b'),
        makeCol('c', { fixed: 'left' }),
      ])
      const result = useColumnSetting({
        headers,
        resetColumns: resetColumnsMock as any,
        emitColumnVisible: emitColumnVisibleMock as any,
      })

      result.handleGroupUpdate('left', [makeCol('c')])
      result.handleGroupUpdate('normal', [makeCol('b'), makeCol('a')])
      await nextTick()

      // Both updates should be applied
      const keys = headers.value.map(c => c.key)
      expect(keys).toContain('c')
      expect(keys).toContain('a')
      expect(keys).toContain('b')
    })
  })

  describe('handleChildUpdate', () => {
    it('queues child update and applies atomically', async () => {
      const childCol = makeCol('child1')
      const parentCol = makeCol('parent', { children: [childCol] as any })
      const headers = ref<ProcessedColumn[]>([parentCol])
      const result = useColumnSetting({
        headers,
        resetColumns: resetColumnsMock as any,
        emitColumnVisible: emitColumnVisibleMock as any,
      })

      const newChild = makeCol('child2')
      // Use headers.value[0] (reactive proxy) instead of raw parentCol,
      // because applyPendingUpdates uses reference equality (c === update.parentCol)
      result.handleChildUpdate(headers.value[0], [newChild])

      await vi.waitFor(() => {
        expect(headers.value[0].children).toHaveLength(1)
        expect((headers.value[0].children as any[])[0].key).toBe('child2')
      })
    })
  })

  describe('resetHeaders', () => {
    it('calls resetColumns and updates checkbox state', () => {
      const { resetHeaders } = createSetting([makeCol('a', { hidden: true })])
      resetHeaders()
      expect(resetColumnsMock).toHaveBeenCalled()
    })
  })

  describe('handleHeaderChange with all columns', () => {
    it('emits columnVisible for changed columns', () => {
      const cols = [makeCol('a', { hidden: false }), makeCol('b', { hidden: false })]
      const { handleHeaderChange } = createSetting(cols)

      handleHeaderChange(false, 'all')

      // Both columns changed from visible to hidden
      expect(emitColumnVisibleMock).toHaveBeenCalledWith({ columnKey: 'a', visible: false })
      expect(emitColumnVisibleMock).toHaveBeenCalledWith({ columnKey: 'b', visible: false })
    })

    it('only emits for columns that actually changed', () => {
      const cols = [makeCol('a', { hidden: true }), makeCol('b', { hidden: false })]
      const { handleHeaderChange } = createSetting(cols)

      handleHeaderChange(false, 'all')

      // Only column 'b' changed (was visible, now hidden)
      expect(emitColumnVisibleMock).toHaveBeenCalledWith({ columnKey: 'b', visible: false })
      expect(emitColumnVisibleMock).not.toHaveBeenCalledWith({ columnKey: 'a', visible: false })
    })

    it('emits columnVisible when showing all columns', () => {
      const cols = [makeCol('a', { hidden: true }), makeCol('b', { hidden: true })]
      const { handleHeaderChange } = createSetting(cols)

      handleHeaderChange(true, 'all')

      expect(emitColumnVisibleMock).toHaveBeenCalledWith({ columnKey: 'a', visible: true })
      expect(emitColumnVisibleMock).toHaveBeenCalledWith({ columnKey: 'b', visible: true })
    })
  })

  describe('handleColumnMove', () => {
    it('tolerates move events without active drag', () => {
      const { handleColumnMove } = createSetting()
      const evt = { to: document.createElement('div'), classList: { contains: () => false } }
      // Should not throw — handleDragMove returns boolean | void
      expect(() => handleColumnMove(evt as any)).not.toThrow()
    })
  })

  describe('handleColumnEnd', () => {
    it('tolerates end without active drag', () => {
      const { handleColumnEnd } = createSetting()
      const evt = { to: document.createElement('div'), classList: { contains: () => false, remove: vi.fn() } }
      // <zh/> 无活动拖拽时的 end 是空操作，不得抛错
      // <en/> End without active dragging is a no-op and must never throw
      expect(() => handleColumnEnd(evt as any)).not.toThrow()
    })
  })

  describe('clearColumnDropTarget', () => {
    it('is a no-op without a drop target', () => {
      const { clearColumnDropTarget } = createSetting()
      // Should not throw when no drop target is set
      expect(() => clearColumnDropTarget()).not.toThrow()
    })
  })

  describe('handleHiddenChange with checkbox update', () => {
    it('updates isChooseAll after hiding a column', () => {
      const cols = [makeCol('a'), makeCol('b')]
      const { handleHiddenChange, isChooseAll } = createSetting(cols)
      expect(isChooseAll.value).toBe(true)

      handleHiddenChange(makeCol('a'), false)
      expect(isChooseAll.value).toBe(false)
    })

    it('updates isIndeterminate after hiding one of two columns', () => {
      const cols = [makeCol('a'), makeCol('b')]
      const { handleHiddenChange, isIndeterminate } = createSetting(cols)

      handleHiddenChange(makeCol('a'), false)
      expect(isIndeterminate.value).toBe(true)
    })
  })
})
