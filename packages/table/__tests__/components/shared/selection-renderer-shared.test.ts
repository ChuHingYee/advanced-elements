import type { CheckStatus, UseSelectionStateReturn } from '../../../src/composables/selection/use-selection-state'
import { describe, expect, it, vi } from 'vitest'
import {
  renderSelectionCellContent,
  renderSelectionHeaderContent,
} from '../../../src/components/shared/selection-renderer'

function createMockSelectionState(overrides: Partial<UseSelectionStateReturn> = {}): UseSelectionStateReturn {
  return {
    isSelected: vi.fn(() => false),
    toggleRowSelection: vi.fn(),
    ...overrides,
  } as unknown as UseSelectionStateReturn
}

/**
 * Extract the first child VNode of a parent VNode's children.
 * JSX compiles to h(tag, props, [children…]), so children is always an array.
 */
function firstChild(vnode: any): any {
  if (Array.isArray(vnode.children)) {
    return vnode.children[0]
  }
  return vnode.children
}

describe('selection-renderer-shared', () => {
  describe('renderSelectionCellContent', () => {
    const baseOptions = {
      row: { id: 1, name: 'Alice' },
      rowIndex: 0,
      selectionState: createMockSelectionState(),
      selectionMode: 'multiple' as const,
      rowKey: (row: any) => String(row.id),
      selectableFn: undefined,
    }

    it('returns a <span> wrapper for multi-select mode', () => {
      const vnode = renderSelectionCellContent(baseOptions)
      expect(vnode).not.toBeNull()
      expect(vnode!.type).toBe('span')
    })

    it('renders ElCheckbox in multi-select mode', () => {
      const vnode = renderSelectionCellContent(baseOptions)
      const el = firstChild(vnode)
      expect(el).toBeDefined()
      // Component VNodes have an object type (not a string like native elements)
      expect(typeof el.type).toBe('object')
    })

    it('renders ElRadio in single-select mode', () => {
      const vnode = renderSelectionCellContent({
        ...baseOptions,
        selectionMode: 'single',
      })
      const el = firstChild(vnode)
      expect(el).toBeDefined()
    })

    it('disables ElCheckbox when selectableFn returns false', () => {
      const vnode = renderSelectionCellContent({
        ...baseOptions,
        selectableFn: () => false,
      })
      const el = firstChild(vnode)
      expect(el.props.disabled).toBe(true)
    })

    it('enables ElCheckbox when selectableFn returns true', () => {
      const vnode = renderSelectionCellContent({
        ...baseOptions,
        selectableFn: () => true,
      })
      const el = firstChild(vnode)
      expect(el.props.disabled).toBe(false)
    })

    it('enables ElCheckbox when selectableFn is undefined', () => {
      const vnode = renderSelectionCellContent(baseOptions)
      const el = firstChild(vnode)
      expect(el.props.disabled).toBe(false)
    })

    it('passes isSelected true to ElCheckbox modelValue', () => {
      const selectionState = createMockSelectionState({
        isSelected: vi.fn(() => true),
      })
      const vnode = renderSelectionCellContent({
        ...baseOptions,
        selectionState,
      })
      const el = firstChild(vnode)
      expect(el.props.modelValue).toBe(true)
    })

    it('passes isSelected false to ElCheckbox modelValue', () => {
      const selectionState = createMockSelectionState({
        isSelected: vi.fn(() => false),
      })
      const vnode = renderSelectionCellContent({
        ...baseOptions,
        selectionState,
      })
      const el = firstChild(vnode)
      expect(el.props.modelValue).toBe(false)
    })

    it('passes rowKey value as ElRadio modelValue/value in single mode', () => {
      const selectionState = createMockSelectionState({
        isSelected: vi.fn(() => true),
      })
      const vnode = renderSelectionCellContent({
        ...baseOptions,
        selectionMode: 'single',
        selectionState,
      })
      const el = firstChild(vnode)
      expect(el.props.modelValue).toBe('1')
      expect(el.props.value).toBe('1')
    })

    it('forwards row and index to selectableFn', () => {
      const selectableFn = vi.fn(() => true)
      renderSelectionCellContent({
        ...baseOptions,
        selectableFn,
      })
      expect(selectableFn).toHaveBeenCalledWith(baseOptions.row, baseOptions.rowIndex)
    })

    it('calls toggleRowSelection when ElCheckbox onChange fires', () => {
      const toggleRowSelection = vi.fn()
      const selectionState = createMockSelectionState({
        toggleRowSelection,
      })
      const vnode = renderSelectionCellContent({
        ...baseOptions,
        selectionState,
      })
      const el = firstChild(vnode)
      const onChange = el.props.onChange
      onChange?.(true)
      expect(toggleRowSelection).toHaveBeenCalledWith(
        baseOptions.row,
        true,
        false,
        expect.objectContaining({ ctrlKey: false, shiftKey: false }),
      )
    })

    it('calls toggleRowSelection when ElRadio onChange fires', () => {
      const toggleRowSelection = vi.fn()
      const selectionState = createMockSelectionState({
        toggleRowSelection,
      })
      const vnode = renderSelectionCellContent({
        ...baseOptions,
        selectionMode: 'single',
        selectionState,
      })
      const el = firstChild(vnode)
      const onChange = el.props.onChange
      onChange?.('1')
      expect(toggleRowSelection).toHaveBeenCalledWith(
        baseOptions.row,
        true,
        false,
        expect.objectContaining({ ctrlKey: false, shiftKey: false }),
      )
    })
  })

  describe('renderSelectionHeaderContent', () => {
    const baseOptions = {
      selectionMode: 'multiple' as const,
      checkStatus: { isAllSelected: false, isIndeterminate: false } as CheckStatus,
      selectableData: [] as any[],
      visibleCount: 0,
      selectionState: undefined,
    }

    it('returns null for single-selection mode', () => {
      const result = renderSelectionHeaderContent({
        ...baseOptions,
        selectionMode: 'single',
      })
      expect(result).toBeNull()
    })

    it('returns a VNode (ElCheckbox) for multi-selection mode', () => {
      const result = renderSelectionHeaderContent(baseOptions)
      expect(result).not.toBeNull()
      // VNode type for a component is the component definition (an object)
      expect(typeof result!.type).toBe('object')
    })

    it('passes select-all props to ElCheckbox when all selected', () => {
      const result = renderSelectionHeaderContent({
        ...baseOptions,
        checkStatus: { isAllSelected: true, isIndeterminate: true },
        selectableData: [{ id: 1 }],
        visibleCount: 1,
      }) as any
      expect(result.props.modelValue).toBe(true)
    })

    it('passes indeterminate to ElCheckbox', () => {
      const result = renderSelectionHeaderContent({
        ...baseOptions,
        checkStatus: { isAllSelected: false, isIndeterminate: true },
        selectableData: [{ id: 1 }, { id: 2 }],
        visibleCount: 1,
      }) as any
      expect(result.props.indeterminate).toBe(true)
    })

    it('passes disabled=false to ElCheckbox when rows are selectable', () => {
      const result = renderSelectionHeaderContent({
        ...baseOptions,
        selectableData: [{ id: 1 }],
        visibleCount: 1,
      }) as any
      expect(result.props.disabled).toBe(false)
    })

    it('passes disabled=true to ElCheckbox when no rows are selectable', () => {
      const result = renderSelectionHeaderContent(baseOptions) as any
      expect(result.props.disabled).toBe(true)
    })
  })
})
