import type { Ref } from 'vue'
import type { SortState } from '../../src/composables/data/use-column-sort'
import type { ProcessedColumn } from '../../src/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useColumnResize } from '../../src/composables/columns/use-column-resize'
import { useColumnState } from '../../src/composables/columns/use-column-state'
import { resetDevWarnCacheForTests } from '../../src/utils/dev-warn'

/**
 * <zh/> 列宽覆盖层不变量回归：`applyColumnState` / `resetColumnState` 必须先清
 * <zh/> `useColumnResize.columnWidths` 再写 `col.width`，否则陈旧拖拽值经
 * <zh/> `getColumnWidth` 遮蔽恢复值（"设置没保存"）。
 * <en/> Width-overlay invariant regression: `applyColumnState` / `resetColumnState` must
 * <en/> clear `useColumnResize.columnWidths` before writing `col.width`, otherwise stale
 * <en/> drag values shadow the restored value through `getColumnWidth` ("settings not saved").
 */
describe('useColumnState width-overlay invariant', () => {
  let localColumns: Ref<ProcessedColumn[]>
  let sortState: Ref<SortState[]>

  beforeEach(() => {
    localColumns = ref<ProcessedColumn[]>([
      { prop: 'name', label: 'Name', width: 100 },
      { prop: 'age', label: 'Age', width: 80 },
    ])
    sortState = ref<SortState[]>([])
    resetDevWarnCacheForTests()
    localStorage.clear()
  })

  /** <zh/> 覆盖层实例：与生产一致来自 useColumnResize（虚拟渲染器内） | <en/> Overlay instance from useColumnResize, as in production */
  function createResize() {
    return useColumnResize({
      columns: localColumns,
      getColumnKey: (col: any) => col.prop ?? col.key,
      resizeProxyRef: ref(null),
      resizable: true,
    } as any)
  }

  function createState(opts?: { onResetColumnWidths?: () => void }) {
    const setColumns = vi.fn((cols: ProcessedColumn[]) => {
      localColumns.value = cols
    })
    return useColumnState({
      localColumns,
      sortState,
      resetColumns: vi.fn(),
      setColumns,
      setSorts: vi.fn(),
      persistence: computed(() => undefined),
      tableId: () => 'overlay-test',
      onResetColumnWidths: opts?.onResetColumnWidths,
    })
  }

  it('applyColumnState clears the stale drag overlay before writing widths', () => {
    const resize = createResize()
    // <zh/> 复现"拖拽后恢复"：覆盖层残留 300，col.width 同步为 300（与 handleResizeEnd 一致）
    // <en/> Reproduce "restore after drag": stale 300 in the overlay, col.width synced to 300 (as handleResizeEnd does)
    resize.columnWidths.name = 300
    localColumns.value[0].width = 300

    let widthAtResetTime: number | undefined
    const { applyColumnState } = createState({
      onResetColumnWidths: vi.fn(() => {
        widthAtResetTime = localColumns.value[0].width
        resize.resetColumnWidths()
      }),
    })

    applyColumnState([{ colId: 'name', width: 150 }])

    // <zh/> 先清后写：回调执行时恢复值尚未写入 | <en/> Clear-before-write: the restored value is not yet written when the callback runs
    expect(widthAtResetTime).toBe(300)
    // <zh/> 恢复值最终生效，且不再被覆盖层遮蔽 | <en/> The restored value wins and is no longer shadowed by the overlay
    expect(localColumns.value[0].width).toBe(150)
    expect(resize.getColumnWidth(localColumns.value[0])).toBe(150)
  })

  it('restored width stays shadowed when the reset callback is not wired (documents the failure mode)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const resize = createResize()
      // <zh/> 刻意不断开 overlay：stale 覆盖层保留，且 state 侧不接 onResetColumnWidths
      // <en/> Stale overlay kept while the state side omits onResetColumnWidths
      resize.columnWidths.name = 300
      localColumns.value[0].width = 300

      const { applyColumnState } = createState()
      applyColumnState([{ colId: 'name', width: 150 }])

      // <zh/> 行为不变：col.width 照写，但读取仍被遮蔽——这正是 dev 告警要暴露的
      // <en/> Behavior unchanged: col.width is still written, but reads stay shadowed — exactly what the dev warning exposes
      expect(localColumns.value[0].width).toBe(150)
      expect(resize.getColumnWidth(localColumns.value[0])).toBe(300)
      expect(warnSpy).toHaveBeenCalled()
      // <zh/> 构造期 Vue 生命周期告警与本断言无关，按内容检索自家告警
      // <en/> Setup-time Vue lifecycle warnings are irrelevant here; search calls by content
      const overlayMessages = warnSpy.mock.calls.map(call => String(call[0] ?? ''))
      expect(overlayMessages.some(m => m.includes('onResetColumnWidths'))).toBe(true)
    }
    finally {
      warnSpy.mockRestore()
    }
  })

  it('resetColumnState warns in dev when the reset callback is not wired', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const { resetColumnState } = createState()
      expect(() => resetColumnState()).not.toThrow()
      expect(warnSpy).toHaveBeenCalled()
      const messages = warnSpy.mock.calls.map(call => String(call[0] ?? ''))
      expect(messages.some(m => m.includes('onResetColumnWidths'))).toBe(true)
    }
    finally {
      warnSpy.mockRestore()
    }
  })
})
