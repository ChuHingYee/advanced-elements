import type { UseInteractionOrchestratorOptions } from '../../src/composables/interaction/use-interaction-orchestrator'
import { describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, shallowRef } from 'vue'
import { createDefaultDomAdapter } from '../../src/components/renderer-core/default-dom-adapter'
import { useDefaultGrand } from '../../src/components/table-renderer/use-default-grand'
import { useInteractionOrchestrator } from '../../src/composables/interaction/use-interaction-orchestrator'
import { DEFAULT_RENDERER_CAPS } from '../../src/types/renderer-caps'
import { isSyntheticRow } from '../../src/utils/total-rows'

vi.mock('../../src/composables/interaction/use-drag-orchestrator', () => ({
  useDragOrchestrator: () => ({ dragLocator: null, isRowDragging: false }),
}))

describe('interaction display domain', () => {
  it.each(['top', 'pinnedTop', 'bottom', 'pinnedBottom'])('copies pinned and ordinary rows with %s grand totals in display order', async (grandTotalRow) => {
    const scope = effectScope()
    const top = { id: 'top', name: 'Top' }
    const body = { id: 'body', name: 'Body' }
    const bottom = { id: 'bottom', name: 'Bottom' }
    const columns = [{ key: 'name', prop: 'name' }]
    const container = document.createElement('div')
    document.body.appendChild(container)
    const emit = vi.fn()
    const { interaction, display } = scope.run(() => {
      const grand = useDefaultGrand({
        props: { data: [body], leafColumns: columns, grandTotalRow, suppressStickyTotalRow: true } as any,
        rowPinApi: {
          pinEnabled: computed(() => true),
          topPinnedRows: computed(() => [top]),
          bottomPinnedRows: computed(() => [bottom]),
        } as any,
      })
      const interaction = useInteractionOrchestrator({
        tableId: 'domain',
        caps: computed(() => DEFAULT_RENDERER_CAPS),
        dom: computed(() => createDefaultDomAdapter('el')),
        mergedSizeConfig: computed(() => ({ rowHeight: 48 })),
        mergedRowConfig: computed(() => ({})),
        mergedColumnConfig: computed(() => ({})),
        rangeSelection: true,
        tableData: shallowRef([top, body, bottom]),
        rowKeyFn: computed(() => (row: typeof body) => row.id),
        rowKeyMeta: computed(() => ({})),
        reorderData: vi.fn(),
        localColumns: shallowRef(columns),
        setColumns: vi.fn(),
        activeRenderer: shallowRef({
          getInteractionDomain: () => ({ rows: grand.pinnedDisplayData.value, columns, columnIndexes: [0] }),
        }),
        renderData: computed(() => [body]),
        effectiveColumns: shallowRef(columns),
        emit,
      } as unknown as UseInteractionOrchestratorOptions<typeof body>)
      return { interaction, display: grand.pinnedDisplayData }
    })!
    try {
      interaction.tableRootRef.value = container
      await nextTick()
      const cells = display.value.map((_, index) => {
        const cell = document.createElement('span')
        cell.setAttribute('data-adv-cell-row', String(index))
        cell.setAttribute('data-adv-cell-col', '0')
        container.appendChild(cell)
        return cell
      })
      const start = display.value.indexOf(top)
      const end = display.value.indexOf(bottom)
      cells[start].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
      cells[end].dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      expect(interaction.rangeLastSelection.value?.rows).toEqual([top, body, bottom])
      expect(interaction.rangeLastSelection.value?.tsv).toBe('Top\nBody\nBottom')
      expect(interaction.rangeLastSelection.value?.range).toEqual({ startRow: start, endRow: end, startCol: 0, endCol: 0 })

      interaction.isRangeSelecting.value = false
      cells[0].focus()
      cells[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true, cancelable: true }))
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }))
      expect(emit.mock.calls.some(([name]) => name === 'cellRangeSelected')).toBe(true)
      const expectedRow = display.value.findIndex((row, index) => index > 0 && !isSyntheticRow(row))
      expect(document.activeElement).toBe(cells[expectedRow])
    }
    finally {
      interaction.tableRootRef.value = null
      await nextTick()
      scope.stop()
      container.remove()
    }
  })
})
