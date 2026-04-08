/**
 * Tests for `applyColumnDefaults`
 *
 * Verifies merge order: defaultColDef → columnTypes[type] → per-column
 * and recursive children merging.
 * / 验证合并优先级：defaultColDef → columnTypes[type] → 列自身定义
 * 以及 children 递归合并。
 */
import type { AdvColumn } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { applyColumnDefaults } from '../../src/utils/column-defaults'

interface TestRow {
  id: number
  name: string
  age: number
  salary: number
}

describe('applyColumnDefaults', () => {
  it('returns original columns when no defaults or columnTypes', () => {
    const cols = [
      { prop: 'id' as const, label: 'ID', hidden: false },
      { prop: 'name' as const, label: 'Name', hidden: false },
    ]
    const result = applyColumnDefaults(cols as AdvColumn<TestRow>[])
    expect(result).toBe(cols) // same reference when no defaults
  })

  it('returns original columns when both defaults are undefined', () => {
    const cols = [
      { prop: 'id' as const, label: 'ID', hidden: false },
    ]
    const result = applyColumnDefaults(cols as AdvColumn<TestRow>[], undefined, undefined)
    expect(result).toBe(cols)
  })

  it('applies defaultColDef to all columns', () => {
    const cols: AdvColumn<TestRow>[] = [
      { prop: 'id', label: 'ID', hidden: false },
      { prop: 'name', label: 'Name', hidden: false },
    ]
    const result = applyColumnDefaults(cols, {
      width: 100,
      sortable: true,
      align: 'center',
    })

    expect(result[0].width).toBe(100)
    expect(result[0].sortable).toBe(true)
    expect(result[0].align).toBe('center')
    expect(result[1].width).toBe(100)
    expect(result[1].sortable).toBe(true)
  })

  it('per-column overrides defaultColDef', () => {
    const cols: AdvColumn<TestRow>[] = [
      { prop: 'id', label: 'ID', width: 50, hidden: false },
      { prop: 'name', label: 'Name', hidden: false },
    ]
    const result = applyColumnDefaults(cols, {
      width: 100,
      sortable: true,
    })

    expect(result[0].width).toBe(50) // per-column wins
    expect(result[0].sortable).toBe(true) // default fills in
    expect(result[1].width).toBe(100) // default applies
  })

  it('columnTypes[type] overrides defaultColDef', () => {
    const cols: AdvColumn<TestRow>[] = [
      { prop: 'id', label: 'ID', type: 'numeric', hidden: false },
      { prop: 'name', label: 'Name', hidden: false },
    ]
    const result = applyColumnDefaults(
      cols,
      { width: 100, align: 'left' },
      {
        numeric: { align: 'right', width: 80 },
      },
    )

    // Column with type='numeric'
    expect(result[0].width).toBe(80) // columnTypes wins over defaultColDef
    expect(result[0].align).toBe('right') // columnTypes wins over defaultColDef

    // Column without type — only defaultColDef applies
    expect(result[1].width).toBe(100)
    expect(result[1].align).toBe('left')
  })

  it('per-column overrides columnTypes and defaultColDef', () => {
    const cols: AdvColumn<TestRow>[] = [
      { prop: 'salary', label: 'Salary', type: 'numeric', width: 120, hidden: false },
    ]
    const result = applyColumnDefaults(
      cols,
      { width: 100, editable: false },
      {
        numeric: { width: 80, align: 'right' },
      },
    )

    expect(result[0].width).toBe(120) // per-column wins all
    expect(result[0].align).toBe('right') // columnTypes wins (not overridden by col)
    expect(result[0].editable).toBe(false) // defaultColDef fills in
  })

  it('recursively merges children', () => {
    const cols: AdvColumn<TestRow>[] = [
      {
        label: 'Info',
        children: [
          { prop: 'name', label: 'Name', hidden: false },
          { prop: 'age', label: 'Age', hidden: false },
        ],
        hidden: false,
      },
    ]
    const result = applyColumnDefaults(
      cols as AdvColumn<TestRow>[],
      { width: 150, sortable: true },
      {
        money: { align: 'right' },
      },
    )

    // Group column itself gets defaults
    expect(result[0].width).toBe(150)
    expect(result[0].sortable).toBe(true)

    // Children also get defaults
    const children = result[0].children as AdvColumn<TestRow>[]
    expect(children[0].width).toBe(150)
    expect(children[0].sortable).toBe(true)
    expect(children[1].width).toBe(150)
    expect(children[1].sortable).toBe(true)
  })

  it('children type presets apply recursively', () => {
    const cols: AdvColumn<TestRow>[] = [
      {
        label: 'Details',
        children: [
          { prop: 'salary', label: 'Salary', type: 'money', hidden: false },
          { prop: 'name', label: 'Name', hidden: false },
        ],
        hidden: false,
      },
    ]
    const result = applyColumnDefaults(
      cols as AdvColumn<TestRow>[],
      { width: 100 },
      {
        money: { align: 'right', width: 120 },
      },
    )

    const children = result[0].children as AdvColumn<TestRow>[]
    expect(children[0].align).toBe('right')
    expect(children[0].width).toBe(120) // type preset wins over defaultColDef
    expect(children[1].width).toBe(100) // only defaultColDef applies
  })

  it('does not mutate the original column array', () => {
    const cols: AdvColumn<TestRow>[] = [
      { prop: 'id', label: 'ID', hidden: false },
    ]
    const result = applyColumnDefaults(cols, { width: 200 })
    expect(result).not.toBe(cols)
    expect(cols[0]).not.toHaveProperty('width')
    expect(result[0].width).toBe(200)
  })

  it('handles empty column array', () => {
    const result = applyColumnDefaults([] as AdvColumn<TestRow>[], { width: 100 })
    expect(result).toEqual([])
  })

  it('preserves existing children when merging', () => {
    const cols: AdvColumn<TestRow>[] = [
      {
        label: 'Info',
        align: 'center',
        children: [
          { prop: 'name', label: 'Name', width: 200, hidden: false },
        ],
        hidden: false,
      },
    ]
    const result = applyColumnDefaults(cols as AdvColumn<TestRow>[], {
      width: 100,
      sortable: true,
    })

    const children = result[0].children as AdvColumn<TestRow>[]
    // Group column own props are preserved + merged
    expect(result[0].align).toBe('center')
    expect(result[0].width).toBe(100)

    // Child per-column width preserved
    expect(children[0].width).toBe(200)
    expect(children[0].sortable).toBe(true) // default fills in
  })

  it('merges configs with overlapping prop keys', () => {
    const parent = { prop: 'name', label: 'Parent Name', width: 100, hidden: false }
    const child = { prop: 'name', label: 'Child Name', hidden: true }
    const merged = { ...parent, ...child }
    // Standard merge: child own props override parent
    expect(merged.prop).toBe('name')
    expect(merged.label).toBe('Child Name')
    expect(merged.width).toBe(100)
    expect(merged.hidden).toBe(true)
  })

  it('applyColumnDefaults handles invisible group column with children', () => {
    const cols: AdvColumn<TestRow>[] = [
      {
        label: 'Hidden Group',
        hidden: true,
        children: [
          { prop: 'name', label: 'Name', hidden: false },
        ],
      },
    ]
    const result = applyColumnDefaults(cols, { width: 100 })
    expect(result[0].hidden).toBe(true)
    const children = result[0].children as AdvColumn<TestRow>[]
    expect(children[0].width).toBe(100)
  })

  it('handles column type as string array merging multiple type presets', () => {
    const cols: AdvColumn<TestRow>[] = [
      {
        prop: 'salary',
        label: 'Salary',
        type: ['numeric', 'money'],
        hidden: false,
      },
    ]
    const result = applyColumnDefaults(
      cols,
      { width: 100, align: 'left', sortable: false },
      {
        numeric: { align: 'right', width: 80 },
        money: { sortable: true, formatter: (v: any) => `$${v}` },
      },
    )
    // numeric applied first, then money overrides sortable
    expect(result[0].align).toBe('right') // from numeric preset
    expect(result[0].width).toBe(80) // from numeric preset
    expect(result[0].sortable).toBe(true) // money overrides numeric's (no sortable)
    expect(result[0].formatter).toBeDefined()
  })

  it('handles array type with non-existent type names gracefully', () => {
    const cols: AdvColumn<TestRow>[] = [
      {
        prop: 'name',
        label: 'Name',
        type: ['nonexistent1', 'nonexistent2'],
        hidden: false,
      },
    ]
    const result = applyColumnDefaults(cols, { width: 100 })
    expect(result[0].width).toBe(100) // only defaultColDef applies
    expect(result[0].type).toEqual(['nonexistent1', 'nonexistent2'])
  })

  it('handles array type with partial match', () => {
    const cols: AdvColumn<TestRow>[] = [
      {
        prop: 'name',
        label: 'Name',
        type: ['nonexistent', 'numeric'],
        hidden: false,
      },
    ]
    const result = applyColumnDefaults(
      cols,
      { align: 'left' },
      { numeric: { align: 'right' } },
    )
    expect(result[0].align).toBe('right') // from numeric preset
  })
})
