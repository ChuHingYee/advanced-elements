import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import {
  useElTableHoverEvents,
  useElTableV2RowEventHandlers,
} from '../../src/composables/rendering/use-row-events'

describe('use-row-events', () => {
  describe('useElTableHoverEvents', () => {
    it('should return empty object when no hover columns', () => {
      const hasHoverOptionColumns = ref(false)
      const handleHoverRowEnter = vi.fn()
      const handleHoverRowLeave = vi.fn()

      const result = useElTableHoverEvents({
        hasHoverOptionColumns,
        hoverOptionColumns: ref([]),
        handleHoverRowEnter,
        handleHoverRowLeave,
      })

      expect(result.value).toEqual({})
    })

    it('should return hover handlers when hover columns exist', () => {
      const hasHoverOptionColumns = ref(true)
      const hoverOptionColumns = ref([{ prop: 'action', label: 'Action', hidden: false }])
      const handleHoverRowEnter = vi.fn()
      const handleHoverRowLeave = vi.fn()

      const result = useElTableHoverEvents({
        hasHoverOptionColumns,
        hoverOptionColumns,
        handleHoverRowEnter,
        handleHoverRowLeave,
      })

      expect(result.value).toHaveProperty('cell-mouse-enter')
      expect(result.value).toHaveProperty('cell-mouse-leave')
    })

    it('should call handleHoverRowEnter on cell mouse enter', () => {
      const hasHoverOptionColumns = ref(true)
      const hoverOptionColumns = ref([{ prop: 'action', hidden: false }])
      const handleHoverRowEnter = vi.fn()
      const handleHoverRowLeave = vi.fn()

      const result = useElTableHoverEvents({
        hasHoverOptionColumns,
        hoverOptionColumns,
        handleHoverRowEnter,
        handleHoverRowLeave,
      })

      result.value['cell-mouse-enter']?.({} as any, null, null, {} as Event)

      expect(handleHoverRowEnter).toHaveBeenCalledWith({}, -1)
    })

    it('should call handleHoverRowLeave on cell mouse leave', () => {
      const hasHoverOptionColumns = ref(true)
      const hoverOptionColumns = ref([{ prop: 'action', hidden: false }])
      const handleHoverRowEnter = vi.fn()
      const handleHoverRowLeave = vi.fn()

      const result = useElTableHoverEvents({
        hasHoverOptionColumns,
        hoverOptionColumns,
        handleHoverRowEnter,
        handleHoverRowLeave,
      })

      result.value['cell-mouse-leave']?.()

      expect(handleHoverRowLeave).toHaveBeenCalled()
    })

    it('should return stable handler references across computed re-evaluations', () => {
      const hasHoverOptionColumns = ref(true)
      const hoverOptionColumns = ref([{ prop: 'action', hidden: false }])
      const handleHoverRowEnter = vi.fn()
      const handleHoverRowLeave = vi.fn()

      const result = useElTableHoverEvents({
        hasHoverOptionColumns,
        hoverOptionColumns,
        handleHoverRowEnter,
        handleHoverRowLeave,
      })

      const firstHandlers = result.value
      hasHoverOptionColumns.value = false
      hasHoverOptionColumns.value = true
      const secondHandlers = result.value

      expect(firstHandlers).toBe(secondHandlers)
      expect(firstHandlers['cell-mouse-enter']).toBe(secondHandlers['cell-mouse-enter'])
      expect(firstHandlers['cell-mouse-leave']).toBe(secondHandlers['cell-mouse-leave'])
    })

    it('should not call hover handlers when hasHoverOptionColumns is false', () => {
      const hasHoverOptionColumns = ref(false)
      const hoverOptionColumns = ref([])
      const handleHoverRowEnter = vi.fn()
      const handleHoverRowLeave = vi.fn()

      const result = useElTableHoverEvents({
        hasHoverOptionColumns,
        hoverOptionColumns,
        handleHoverRowEnter,
        handleHoverRowLeave,
      })

      result.value['cell-mouse-enter']?.({} as any, null, null, {} as Event)
      result.value['cell-mouse-leave']?.()

      expect(handleHoverRowEnter).not.toHaveBeenCalled()
      expect(handleHoverRowLeave).not.toHaveBeenCalled()
    })

    it('should switch between empty and handler objects reactively', () => {
      const hasHoverOptionColumns = ref(false)
      const hoverOptionColumns = ref([{ prop: 'action', hidden: false }])
      const handleHoverRowEnter = vi.fn()
      const handleHoverRowLeave = vi.fn()

      const result = useElTableHoverEvents({
        hasHoverOptionColumns,
        hoverOptionColumns,
        handleHoverRowEnter,
        handleHoverRowLeave,
      })

      expect(result.value).toEqual({})

      hasHoverOptionColumns.value = true
      expect(result.value).toHaveProperty('cell-mouse-enter')
      expect(result.value).toHaveProperty('cell-mouse-leave')

      hasHoverOptionColumns.value = false
      expect(result.value).toEqual({})
    })
  })

  describe('useElTableV2RowEventHandlers', () => {
    const mockRow = { id: 1, name: 'test' }
    const mockEvent = {} as Event

    it('should return event handlers when hover columns exist', () => {
      const hasHoverOptionColumns = ref(true)
      const hoverOptionColumns = ref([{ prop: 'action', label: 'Action', hidden: false }])
      const handleHoverRowEnter = vi.fn()
      const handleHoverRowLeave = vi.fn()

      const result = useElTableV2RowEventHandlers({
        hasHoverOptionColumns,
        hoverOptionColumns,
        handleHoverRowEnter,
        handleHoverRowLeave,
      })

      expect(result.value).toHaveProperty('onMouseenter')
      expect(result.value).toHaveProperty('onMouseleave')
      expect(result.value).toHaveProperty('onClick')
      expect(result.value).toHaveProperty('onContextmenu')
      expect(result.value).toHaveProperty('onDblclick')
    })

    it('should call handleHoverRowEnter on mouse enter', () => {
      const hasHoverOptionColumns = ref(true)
      const hoverOptionColumns = ref([{ prop: 'action', hidden: false }])
      const handleHoverRowEnter = vi.fn()
      const handleHoverRowLeave = vi.fn()

      const result = useElTableV2RowEventHandlers({
        hasHoverOptionColumns,
        hoverOptionColumns,
        handleHoverRowEnter,
        handleHoverRowLeave,
      })

      result.value.onMouseenter?.({
        rowData: mockRow,
        rowIndex: 0,
        event: mockEvent,
      })

      expect(handleHoverRowEnter).toHaveBeenCalledWith(mockRow, 0)
    })

    it('should not call handleHoverRowEnter on mouse enter when no hover columns', () => {
      const hasHoverOptionColumns = ref(false)
      const hoverOptionColumns = ref([])
      const handleHoverRowEnter = vi.fn()
      const handleHoverRowLeave = vi.fn()

      const result = useElTableV2RowEventHandlers({
        hasHoverOptionColumns,
        hoverOptionColumns,
        handleHoverRowEnter,
        handleHoverRowLeave,
      })

      result.value.onMouseenter?.({
        rowData: mockRow,
        rowIndex: 0,
        event: mockEvent,
      })

      expect(handleHoverRowEnter).not.toHaveBeenCalled()
    })

    it('should call handleHoverRowLeave on mouse leave', () => {
      const hasHoverOptionColumns = ref(true)
      const hoverOptionColumns = ref([{ prop: 'action', hidden: false }])
      const handleHoverRowEnter = vi.fn()
      const handleHoverRowLeave = vi.fn()

      const result = useElTableV2RowEventHandlers({
        hasHoverOptionColumns,
        hoverOptionColumns,
        handleHoverRowEnter,
        handleHoverRowLeave,
      })

      result.value.onMouseleave?.()

      expect(handleHoverRowLeave).toHaveBeenCalled()
    })

    it('should not call handleHoverRowLeave on mouse leave when no hover columns', () => {
      const hasHoverOptionColumns = ref(false)
      const hoverOptionColumns = ref([])
      const handleHoverRowEnter = vi.fn()
      const handleHoverRowLeave = vi.fn()

      const result = useElTableV2RowEventHandlers({
        hasHoverOptionColumns,
        hoverOptionColumns,
        handleHoverRowEnter,
        handleHoverRowLeave,
      })

      result.value.onMouseleave?.()

      expect(handleHoverRowLeave).not.toHaveBeenCalled()
    })

    it('should call emit onCellMouseEnter if provided', () => {
      const onCellMouseEnter = vi.fn()
      const hasHoverOptionColumns = ref(true)
      const hoverOptionColumns = ref([{ prop: 'action', hidden: false }])
      const handleHoverRowEnter = vi.fn()
      const handleHoverRowLeave = vi.fn()

      const result = useElTableV2RowEventHandlers({
        hasHoverOptionColumns,
        hoverOptionColumns,
        handleHoverRowEnter,
        handleHoverRowLeave,
        emit: { onCellMouseEnter },
      })

      result.value.onMouseenter?.({
        rowData: mockRow,
        rowIndex: 0,
        event: mockEvent,
      })

      expect(onCellMouseEnter).toHaveBeenCalledWith({
        rowData: mockRow,
        rowIndex: 0,
        event: mockEvent,
      })
    })

    it('should call emit onCellMouseLeave if provided', () => {
      const onCellMouseLeave = vi.fn()
      const hasHoverOptionColumns = ref(true)
      const hoverOptionColumns = ref([{ prop: 'action', hidden: false }])
      const handleHoverRowEnter = vi.fn()
      const handleHoverRowLeave = vi.fn()

      const result = useElTableV2RowEventHandlers({
        hasHoverOptionColumns,
        hoverOptionColumns,
        handleHoverRowEnter,
        handleHoverRowLeave,
        emit: { onCellMouseLeave },
      })

      result.value.onMouseleave?.()

      expect(onCellMouseLeave).toHaveBeenCalled()
    })

    it('should call emit onRowClick on click', () => {
      const onRowClick = vi.fn()
      const hasHoverOptionColumns = ref(true)
      const hoverOptionColumns = ref([{ prop: 'action', hidden: false }])
      const handleHoverRowEnter = vi.fn()
      const handleHoverRowLeave = vi.fn()

      const result = useElTableV2RowEventHandlers({
        hasHoverOptionColumns,
        hoverOptionColumns,
        handleHoverRowEnter,
        handleHoverRowLeave,
        emit: { onRowClick },
      })

      result.value.onClick?.({
        rowData: mockRow,
        rowIndex: 0,
        event: mockEvent,
        rowKey: '1',
      })

      expect(onRowClick).toHaveBeenCalledWith({
        rowData: mockRow,
        rowIndex: 0,
        event: mockEvent,
      })
    })

    it('should call handleHoverRowEnter on click when hover columns exist', () => {
      const hasHoverOptionColumns = ref(true)
      const hoverOptionColumns = ref([{ prop: 'action', hidden: false }])
      const handleHoverRowEnter = vi.fn()
      const handleHoverRowLeave = vi.fn()

      const result = useElTableV2RowEventHandlers({
        hasHoverOptionColumns,
        hoverOptionColumns,
        handleHoverRowEnter,
        handleHoverRowLeave,
      })

      result.value.onClick?.({
        rowData: mockRow,
        rowIndex: 0,
        event: mockEvent,
        rowKey: '1',
      })

      expect(handleHoverRowEnter).toHaveBeenCalledWith(mockRow, 0)
    })

    it('should not call handleHoverRowEnter on click when no hover columns', () => {
      const hasHoverOptionColumns = ref(false)
      const hoverOptionColumns = ref([])
      const handleHoverRowEnter = vi.fn()
      const handleHoverRowLeave = vi.fn()

      const result = useElTableV2RowEventHandlers({
        hasHoverOptionColumns,
        hoverOptionColumns,
        handleHoverRowEnter,
        handleHoverRowLeave,
      })

      result.value.onClick?.({
        rowData: mockRow,
        rowIndex: 0,
        event: mockEvent,
        rowKey: '1',
      })

      expect(handleHoverRowEnter).not.toHaveBeenCalled()
    })

    it('should call emit onRowContextmenu on contextmenu', () => {
      const onRowContextmenu = vi.fn()
      const hasHoverOptionColumns = ref(false)
      const hoverOptionColumns = ref([])
      const handleHoverRowEnter = vi.fn()
      const handleHoverRowLeave = vi.fn()

      const result = useElTableV2RowEventHandlers({
        hasHoverOptionColumns,
        hoverOptionColumns,
        handleHoverRowEnter,
        handleHoverRowLeave,
        emit: { onRowContextmenu },
      })

      result.value.onContextmenu?.({
        rowData: mockRow,
        rowIndex: 0,
        event: mockEvent,
        rowKey: '1',
      })

      expect(onRowContextmenu).toHaveBeenCalledWith({
        rowData: mockRow,
        rowIndex: 0,
        event: mockEvent,
      })
    })

    it('should call emit onRowDblclick on dblclick', () => {
      const onRowDblclick = vi.fn()
      const hasHoverOptionColumns = ref(false)
      const hoverOptionColumns = ref([])
      const handleHoverRowEnter = vi.fn()
      const handleHoverRowLeave = vi.fn()

      const result = useElTableV2RowEventHandlers({
        hasHoverOptionColumns,
        hoverOptionColumns,
        handleHoverRowEnter,
        handleHoverRowLeave,
        emit: { onRowDblclick },
      })

      result.value.onDblclick?.({
        rowData: mockRow,
        rowIndex: 0,
        event: mockEvent,
        rowKey: '1',
      })

      expect(onRowDblclick).toHaveBeenCalledWith({
        rowData: mockRow,
        rowIndex: 0,
        event: mockEvent,
      })
    })

    it('should return stable handler references across computed re-evaluations', () => {
      const hasHoverOptionColumns = ref(true)
      const hoverOptionColumns = ref([{ prop: 'action', hidden: false }])
      const handleHoverRowEnter = vi.fn()
      const handleHoverRowLeave = vi.fn()

      const result = useElTableV2RowEventHandlers({
        hasHoverOptionColumns,
        hoverOptionColumns,
        handleHoverRowEnter,
        handleHoverRowLeave,
      })

      const firstHandlers = result.value
      hoverOptionColumns.value = [{ prop: 'action', hidden: false }, { prop: 'edit', hidden: false }]
      const secondHandlers = result.value

      expect(firstHandlers).toBe(secondHandlers)
      expect(firstHandlers.onMouseenter).toBe(secondHandlers.onMouseenter)
      expect(firstHandlers.onMouseleave).toBe(secondHandlers.onMouseleave)
      expect(firstHandlers.onClick).toBe(secondHandlers.onClick)
      expect(firstHandlers.onContextmenu).toBe(secondHandlers.onContextmenu)
      expect(firstHandlers.onDblclick).toBe(secondHandlers.onDblclick)
    })

    it('should react to hover columns changes inside handler invocations', () => {
      const hoverOptionColumns = ref<any[]>([])
      const handleHoverRowEnter = vi.fn()
      const handleHoverRowLeave = vi.fn()

      const result = useElTableV2RowEventHandlers({
        hasHoverOptionColumns: ref(false),
        hoverOptionColumns,
        handleHoverRowEnter,
        handleHoverRowLeave,
      })

      result.value.onMouseenter?.({
        rowData: mockRow,
        rowIndex: 0,
        event: mockEvent,
      })
      expect(handleHoverRowEnter).not.toHaveBeenCalled()

      hoverOptionColumns.value = [{ prop: 'action', hidden: false }]
      result.value.onMouseenter?.({
        rowData: mockRow,
        rowIndex: 1,
        event: mockEvent,
      })
      expect(handleHoverRowEnter).toHaveBeenCalledWith(mockRow, 1)
    })
  })
})
