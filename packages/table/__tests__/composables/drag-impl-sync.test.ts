import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref, toValue } from 'vue'
import { createDragImpl } from '../../src/composables/interaction/drag-impl'
import { useRowDrag } from '../../src/composables/interaction/use-row-drag'
import { DEFAULT_RENDERER_CAPS, VIRTUAL_RENDERER_CAPS } from '../../src/types/renderer-caps'

vi.mock('../../src/composables/interaction/use-row-drag', () => ({
  useRowDrag: vi.fn(() => ({ isRowDragging: ref(false), destroyRowDrag: vi.fn(), syncDrags: vi.fn() })),
}))

vi.mock('../../src/composables/columns/use-column-drag', () => ({
  useColumnDrag: vi.fn(() => ({ destroy: vi.fn(), suspend: vi.fn(), resume: vi.fn() })),
}))

/**
 * <zh/> 拖拽实现按能力表下发 `syncFallbackStyle`——composed（default）开、
 * <zh/> unpinned（virtual）关；只问 `rowIndexDomain`，不问渲染模式。
 * <en/> The drag implementation derives `syncFallbackStyle` from the capability table —
 * <en/> on for composed (default), off for unpinned (virtual); it asks only `rowIndexDomain`,
 * <en/> never the render mode.
 */

const mockedRowDrag = vi.mocked(useRowDrag)

function buildOptions(caps: any) {
  return {
    caps,
    dom: {},
    tableId: computed(() => 'drag-impl-sync-table'),
    mergedSizeConfig: computed(() => ({ rowHeight: 48 })),
    mergedRowConfig: computed(() => ({ rowDraggable: true })),
    mergedColumnConfig: computed(() => ({})),
    tableData: ref([]),
    rowKeyFn: computed(() => (row: any) => String(row.id)),
    rowKeyMeta: ref({ keyToRow: new Map() }),
    reorderData: vi.fn(),
    localColumns: ref([]),
    setColumns: vi.fn(),
    activeRenderer: computed(() => null),
    emit: vi.fn(),
    dragLocator: computed(() => ({})),
  } as any
}

function lastRowDragOptions(): any {
  const calls = mockedRowDrag.mock.calls
  expect(calls.length).toBeGreaterThan(0)
  return calls[calls.length - 1]![0]
}

describe('drag-impl syncFallbackStyle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('enables fallback style sync for composed (default) caps', () => {
    createDragImpl(buildOptions(ref({ ...DEFAULT_RENDERER_CAPS })))
    expect(toValue(lastRowDragOptions().syncFallbackStyle)).toBe(true)
  })

  it('disables fallback style sync for unpinned (virtual) caps', () => {
    createDragImpl(buildOptions(ref({ ...VIRTUAL_RENDERER_CAPS })))
    expect(toValue(lastRowDragOptions().syncFallbackStyle)).toBe(false)
  })

  it('follows caps switches at call time', () => {
    const caps = ref({ ...DEFAULT_RENDERER_CAPS })
    createDragImpl(buildOptions(caps))
    const opts = lastRowDragOptions()
    expect(toValue(opts.syncFallbackStyle)).toBe(true)
    caps.value = { ...VIRTUAL_RENDERER_CAPS }
    expect(toValue(opts.syncFallbackStyle)).toBe(false)
  })
})
