import { describe, expect, it, vi } from 'vitest'
import { useTableSearch } from '../../src/composables/features/use-table-search'

describe('useTableSearch', () => {
  const t = (key: string) => key

  function createSearch(opts: {
    columns?: any[]
    rawColumns?: any[]
    searchConfig?: any
    defaultValues?: Record<string, any>
    searchEnabled?: boolean
    hasColumnSearch?: boolean
    onSearch?: any
    onReset?: any
    translation?: (key: string) => string
  } = {}) {
    return useTableSearch({
      columns: () => opts.columns ?? [],
      rawColumns: () => opts.rawColumns ?? [],
      searchConfig: () => opts.searchConfig,
      defaultValues: () => opts.defaultValues,
      searchEnabled: () => opts.searchEnabled ?? false,
      hasColumnSearch: () => opts.hasColumnSearch ?? false,
      translation: opts.translation ?? t,
      onSearch: opts.onSearch ?? vi.fn(),
      onReset: opts.onReset ?? vi.fn(),
    })
  }

  it('initializes with empty searchParams', () => {
    const s = createSearch()
    expect(s.searchParams.value).toEqual({})
  })

  it('hasSearch is false when search is disabled and no column search', () => {
    const s = createSearch({ searchEnabled: false, hasColumnSearch: false })
    expect(s.hasSearch.value).toBe(false)
  })

  it('hasSearch is true when hasColumnSearch', () => {
    const s = createSearch({
      searchEnabled: true,
      columns: [{ prop: 'name', label: 'Name', search: true, hidden: false }] as any,
    })
    expect(s.hasSearch.value).toBe(true)
  })

  it('handleSearch triggers onSearch with transformed params', () => {
    const onSearch = vi.fn()
    const s = createSearch({ searchEnabled: true, onSearch })
    s.handleSearch({ name: 'test' })
    expect(onSearch).toHaveBeenCalledWith({ name: 'test' })
    expect(s.searchParams.value).toEqual({ name: 'test' })
  })

  it('handleSearch applies column transforms', () => {
    const onSearch = vi.fn()
    const rawCol = {
      prop: 'date',
      search: { transform: (v: string) => new Date(v).toISOString() },
      hidden: false,
    }
    const s = createSearch({ searchEnabled: true, onSearch, rawColumns: [rawCol] })
    s.handleSearch({ date: '2024-01-15' })
    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2024-01-15T00:00:00.000Z' }),
    )
  })

  it('getQueryFormModel returns copy of searchParams', () => {
    const s = createSearch({ searchEnabled: true })
    s.handleSearch({ name: 'Alice' })
    const model = s.getQueryFormModel()
    expect(model).toEqual({ name: 'Alice' })
    model.name = 'Bob'
    expect(s.searchParams.value.name).toBe('Alice')
  })

  it('setQueryFormModel updates searchParams', () => {
    const s = createSearch({ searchEnabled: true })
    s.setQueryFormModel({ key: 'val' })
    expect(s.searchParams.value).toEqual({ key: 'val' })
  })

  it('setQueryFormModel with triggerSearch calls handleSearch', () => {
    const onSearch = vi.fn()
    const s = createSearch({ searchEnabled: true, onSearch })
    s.setQueryFormModel({ name: 'test' }, true)
    expect(onSearch).toHaveBeenCalledWith({ name: 'test' })
  })

  it('handleReset restores defaultValues and calls onReset', () => {
    const onReset = vi.fn()
    const s = createSearch({
      searchEnabled: true,
      onReset,
      defaultValues: { name: '', status: 'active' },
    })
    s.handleSearch({ name: 'test' })
    s.handleReset()
    expect(s.searchParams.value).toEqual({ name: '', status: 'active' })
    expect(onReset).toHaveBeenCalled()
  })

  it('handleReset with empty defaults resets to empty', () => {
    const onReset = vi.fn()
    const s = createSearch({ searchEnabled: true, onReset })
    s.handleSearch({ name: 'test' })
    s.handleReset()
    expect(s.searchParams.value).toEqual({})
    expect(onReset).toHaveBeenCalled()
  })

  it('handleReset restores column-level field defaults with lower priority than defaultValues', () => {
    const onReset = vi.fn()
    const s = createSearch({
      searchEnabled: true,
      onReset,
      defaultValues: { status: 'pending' },
      columns: [
        { prop: 'status', label: 'Status', search: { defaultValue: 'active' }, hidden: false },
        { prop: 'type', label: 'Type', search: { defaultValue: 'all' }, hidden: false },
      ] as any,
    })
    s.handleSearch({ status: 'done', type: 'x', extra: 1 })
    s.handleReset()
    // <zh/> defaultValues 优先，列级默认值补缺
    // <en/> defaultValues win; column-level defaults fill the gaps
    expect(s.searchParams.value).toEqual({ status: 'pending', type: 'all' })
    expect(onReset).toHaveBeenCalled()
  })

  it('initializes searchParams from defaultValues', () => {
    const s = createSearch({ defaultValues: { status: 'active' } })
    expect(s.searchParams.value).toEqual({ status: 'active' })
  })

  it('mergedSearchFields returned as computed', () => {
    const s = createSearch({
      searchEnabled: true,
      columns: [{ prop: 'name', label: 'Name', search: true, hidden: false }] as any,
    })
    expect(Array.isArray(s.mergedSearchFields.value)).toBe(true)
  })

  it('mergedSearchFields combines column search configs', () => {
    const s = createSearch({
      searchEnabled: true,
      columns: [
        { prop: 'name', label: 'Name', search: true, hidden: false },
        { prop: 'age', label: 'Age', search: { placeholder: '输入年龄' }, hidden: false },
      ] as any,
    })
    expect(s.mergedSearchFields.value).toHaveLength(2)
    expect(s.mergedSearchFields.value[0].prop).toBe('name')
    expect(s.mergedSearchFields.value[1].prop).toBe('age')
    expect(s.mergedSearchFields.value[1].componentProps?.placeholder).toBeDefined()
  })

  it('hasSearch returns false when searchEnabled is false', () => {
    const s = createSearch({ searchEnabled: false, hasColumnSearch: false })
    expect(s.hasSearch.value).toBe(false)
  })

  it('placeholder is translated via t function', () => {
    const s = createSearch({
      searchEnabled: true,
      translation: (key: string) => key === 'form.inputPlaceholder' ? '请输入' : key,
      columns: [
        { prop: 'age', label: '年龄', search: true, hidden: false },
      ] as any,
    })
    expect(s.mergedSearchFields.value[0].componentProps?.placeholder).toBe('请输入年龄')
  })

  it('setQueryFormModel sets values and optionally triggers search', () => {
    const onSearch = vi.fn()
    const s = createSearch({ searchEnabled: true, onSearch })
    s.setQueryFormModel({ name: 'test' }, true)
    expect(onSearch).toHaveBeenCalled()
  })

  it('setQueryFormModel does not trigger search when triggerSearch is false', () => {
    const onSearch = vi.fn()
    const s = createSearch({ searchEnabled: true, onSearch })
    s.setQueryFormModel({ name: 'test' }, false)
    expect(onSearch).not.toHaveBeenCalled()
  })

  it('mergedSearchFields merges custom field over auto field', () => {
    const s = createSearch({
      searchEnabled: true,
      columns: [{ prop: 'name', label: 'Name', search: true, hidden: false }] as any,
      searchConfig: {
        fields: [{ prop: 'name', label: 'Custom Name', order: 1, hidden: false }],
      },
    })
    const fields = s.mergedSearchFields.value
    expect(fields).toHaveLength(1)
    expect((fields[0] as any).label).toBe('Custom Name') // custom overrides auto
  })

  it('mergedSearchFields includes custom-only fields', () => {
    const s = createSearch({
      searchEnabled: true,
      columns: [{ prop: 'name', label: 'Name', search: true, hidden: false }] as any,
      searchConfig: {
        fields: [{ prop: 'extra', label: 'Extra Field', order: 2, hidden: false }],
      },
    })
    expect(s.mergedSearchFields.value).toHaveLength(2)
  })

  it('handleSearch ignores transform for non-existent prop', () => {
    const onSearch = vi.fn()
    const rawCol = {
      prop: 'date',
      search: { transform: (v: string) => v.toUpperCase() },
      hidden: false,
    }
    const s = createSearch({ searchEnabled: true, onSearch, rawColumns: [rawCol] })
    // prop 'date' is not in submitted params, transform should be skipped
    s.handleSearch({ name: 'test' })
    expect(onSearch).toHaveBeenCalledWith({ name: 'test' })
  })

  it('handleSearch ignores transform when column search is boolean', () => {
    const onSearch = vi.fn()
    const rawCol = { prop: 'name', search: true, hidden: false }
    const s = createSearch({ searchEnabled: true, onSearch, rawColumns: [rawCol] })
    s.handleSearch({ name: 'test' })
    expect(onSearch).toHaveBeenCalledWith({ name: 'test' })
  })

  it('searchFields computed stability returns prev when unchanged', () => {
    const s = createSearch({
      searchEnabled: false,
      hasColumnSearch: false,
    })
    const first = s.mergedSearchFields.value
    const second = s.mergedSearchFields.value
    expect(first).toBe(second)
  })

  it('handleSearch skips transform for empty string value', () => {
    const onSearch = vi.fn()
    const rawCol = {
      prop: 'name',
      search: { transform: (v: string) => v.trim() },
      hidden: false,
    }
    const s = createSearch({ searchEnabled: true, onSearch, rawColumns: [rawCol] })
    s.handleSearch({ name: '' })
    expect(onSearch).toHaveBeenCalledWith({ name: '' })
  })
})
