import type { ProcessedColumn } from '../../src/types/column'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref, shallowRef, watch } from 'vue'
import { useQuickFilter } from '../../src/composables/data/use-quick-filter'

function createCol(overrides: Partial<ProcessedColumn> = {}): ProcessedColumn {
  return {
    prop: 'col',
    label: 'Column',
    ...overrides,
    hidden: false,
  } as unknown as ProcessedColumn
}

const mockData = [
  { id: 1, name: '张三', city: '北京', age: 25 },
  { id: 2, name: '李四', city: '上海', age: 30 },
  { id: 3, name: '王五', city: '广州', age: 35 },
  { id: 4, name: '赵六', city: '北京', age: 40 },
]

interface CreateQuickFilterOptions {
  text?: string
  data?: any[]
  columns?: ProcessedColumn[]
}

function createQuickFilter(options: CreateQuickFilterOptions = {}) {
  const columns = options.columns ?? [
    createCol({ prop: 'name', label: '姓名', hidden: false }),
    createCol({ prop: 'city', label: '城市', hidden: false }),
    createCol({ prop: 'age', label: '年龄', hidden: false }),
  ]
  return useQuickFilter({
    quickFilterText: ref(options.text),
    data: ref(options.data ?? mockData),
    columns: ref(columns),
  })
}

describe('useQuickFilter cache regressions', () => {
  it.each(['replace', 'splice'] as const)('refreshes same-key row text after %s', async (mode) => {
    const data = ref([{ id: '1', name: 'Alice' }])
    const filter = useQuickFilter({
      data,
      columns: [createCol({ prop: 'name' })],
      quickFilterText: 'alice',
      rowKey: row => row.id,
    })
    expect(filter.filteredData.value.data).toHaveLength(1)
    if (mode === 'replace')
      data.value = [{ id: '1', name: 'Bob' }]
    else
      data.value.splice(0, 1, { id: '1', name: 'Bob' })
    expect(filter.filteredData.value.data).toEqual([])
    await nextTick()
    expect(filter.filteredData.value.data).toEqual([])
    filter.dispose?.()
  })

  it.each(['format', 'valueGetter', 'valueEnum'] as const)('refreshes same-key %s replacements repeatedly', async (kind) => {
    const columns = ref([createCol({ prop: 'name' })])
    const filter = useQuickFilter({
      data: [{ name: 'Alice' }],
      columns,
      quickFilterText: 'alice',
    })
    expect(filter.filteredData.value.data).toHaveLength(1)
    for (const text of ['Bob', 'Alice', 'Carol']) {
      const override = kind === 'valueEnum' ? { valueEnum: { Alice: text } } : { [kind]: () => text }
      columns.value = [createCol({ prop: 'name', ...override })]
      expect(filter.filteredData.value.data).toHaveLength(text === 'Alice' ? 1 : 0)
      await nextTick()
      expect(filter.filteredData.value.data).toHaveLength(text === 'Alice' ? 1 : 0)
    }
    filter.dispose?.()
  })

  it('refreshes in-place column formatting and enum labels', () => {
    const columns = ref([createCol({ prop: 'name' })])
    const filter = useQuickFilter({ data: [{ name: 'Alice' }], columns, quickFilterText: 'alice' })
    expect(filter.filteredData.value.data).toHaveLength(1)
    columns.value[0].format = () => 'Bob'
    expect(filter.filteredData.value.data).toEqual([])
    columns.value[0].format = undefined
    columns.value[0].valueEnum = { Alice: 'Alice' }
    expect(filter.filteredData.value.data).toHaveLength(1)
    columns.value[0].valueEnum.Alice = 'Carol'
    expect(filter.filteredData.value.data).toEqual([])
    filter.dispose?.()
  })

  it.each([true, false])('notifies once per invalidation with rowKey=%s', (keyed) => {
    const data = shallowRef([{ id: '1', name: 'Alice' }, { id: '2', name: 'Alice' }])
    const getter = vi.fn(({ row }: any) => row.name)
    const filter = useQuickFilter({
      data,
      columns: [createCol({ prop: 'name', valueGetter: getter })],
      quickFilterText: 'alice',
      rowKey: keyed ? row => row.id : undefined,
    })
    const observed = vi.fn()
    const stop = watch(filter.filteredData, observed, { flush: 'sync' })
    expect(filter.filteredData.value.data).toHaveLength(2)
    data.value[0].name = 'Bob'
    filter.invalidateRowCache('1')
    expect(filter.filteredData.value.data).toEqual([data.value[1]])
    expect(observed).toHaveBeenCalledTimes(1)
    data.value[0].name = 'Alice'
    data.value[1].name = 'Carol'
    filter.invalidateRowCacheBatch(['1', '2'])
    expect(filter.filteredData.value.data).toEqual([data.value[0]])
    expect(observed).toHaveBeenCalledTimes(2)
    filter.invalidateRowCacheBatch([])
    expect(observed).toHaveBeenCalledTimes(2)
    stop()
    filter.dispose?.()
  })

  it('reuses cached text across query changes and preserves uninvalidated rows', () => {
    const data = [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }]
    const getter = vi.fn(({ row }: any) => row.name)
    const query = ref('alice')
    const filter = useQuickFilter({
      data,
      columns: [createCol({ prop: 'name', valueGetter: getter })],
      quickFilterText: query,
      rowKey: row => row.id,
    })
    expect(filter.filteredData.value.data).toEqual([data[0]])
    query.value = 'bob'
    expect(filter.filteredData.value.data).toEqual([data[1]])
    expect(getter).toHaveBeenCalledTimes(2)
    data[0].name = 'Bob'
    filter.invalidateRowCache('1')
    expect(filter.filteredData.value.data).toEqual(data)
    expect(getter).toHaveBeenCalledTimes(3)
    filter.dispose?.()
  })
})

describe('useQuickFilter', () => {
  describe('basic behavior', () => {
    it('passes through data when quickFilterText is undefined', () => {
      const { filteredData, hasActiveQuickFilter } = createQuickFilter({ text: undefined })
      expect(filteredData.value.isFiltered).toBe(false)
      expect(filteredData.value.data).toHaveLength(4)
      expect(hasActiveQuickFilter.value).toBe(false)
    })

    it('passes through data when quickFilterText is empty string', () => {
      const { filteredData, hasActiveQuickFilter } = createQuickFilter({ text: '' })
      expect(filteredData.value.isFiltered).toBe(false)
      expect(filteredData.value.data).toHaveLength(4)
      expect(hasActiveQuickFilter.value).toBe(false)
    })

    it('filters data matching the search text (basic)', () => {
      const { filteredData, hasActiveQuickFilter } = createQuickFilter({ text: '张三' })
      expect(hasActiveQuickFilter.value).toBe(true)
      expect(filteredData.value.isFiltered).toBe(true)
      expect(filteredData.value.data).toHaveLength(1)
      expect(filteredData.value.data[0].name).toBe('张三')
    })

    it('returns empty array when no rows match', () => {
      const { filteredData } = createQuickFilter({ text: '不存在的' })
      expect(filteredData.value.data).toHaveLength(0)
      expect(filteredData.value.isFiltered).toBe(true)
    })
  })

  describe('case-insensitive matching', () => {
    it('matches case-insensitively', () => {
      const data = [
        { id: 1, name: 'Alice', city: 'New York' },
        { id: 2, name: 'Bob', city: 'Paris' },
      ]
      const { filteredData } = createQuickFilter({ text: 'alice', data })
      expect(filteredData.value.data).toHaveLength(1)
      expect(filteredData.value.data[0].name).toBe('Alice')
    })

    it('matches partial text', () => {
      const { filteredData } = createQuickFilter({ text: '北' })
      expect(filteredData.value.data).toHaveLength(2) // 北京 × 2
    })
  })

  describe('cross-column search', () => {
    it('finds rows where ANY column matches', () => {
      const { filteredData } = createQuickFilter({ text: '上海' })
      expect(filteredData.value.data).toHaveLength(1)
      expect(filteredData.value.data[0].name).toBe('李四')
    })

    it('finds rows by numeric column value', () => {
      const { filteredData } = createQuickFilter({ text: '30' })
      expect(filteredData.value.data).toHaveLength(1)
      expect(filteredData.value.data[0].name).toBe('李四')
    })
  })

  describe('format function', () => {
    it('searches through formatted display values', () => {
      const columns = [
        createCol({
          prop: 'name',
          label: '姓名',
          format: ({ row }: any) => `【${row.name}】`,
          hidden: false,
        }),
        createCol({ prop: 'city', label: '城市', hidden: false }),
      ]
      // Search the formatted text (not raw data)
      const { filteredData } = createQuickFilter({ text: '【', columns })
      expect(filteredData.value.data).toHaveLength(4) // All names get formatted with 【】

      const { filteredData: fd2 } = createQuickFilter({ text: '【张三】', columns })
      expect(fd2.value.data).toHaveLength(1)
      expect(fd2.value.data[0].name).toBe('张三')

      // Raw name still matches too
      const { filteredData: fd3 } = createQuickFilter({ text: '张三', columns })
      expect(fd3.value.data).toHaveLength(1)
    })
  })

  describe('valueEnum', () => {
    it('searches through valueEnum display labels', () => {
      const columns = [
        createCol({ prop: 'name', label: '姓名', hidden: false }),
        createCol({
          prop: 'city',
          label: '城市',
          valueEnum: {
            北京: 'BeiJing',
            上海: 'ShangHai',
            广州: 'GuangZhou',
          },
          hidden: false,
        }),
      ]
      // Search by display label (enum text)
      const { filteredData } = createQuickFilter({ text: 'BeiJing', columns })
      expect(filteredData.value.data).toHaveLength(2) // 北京 × 2

      // Raw value should NOT match (valueEnum replaces the display)
      // Actually the composable uses valueEnum text as display, so raw value won't match
      const { filteredData: fd2 } = createQuickFilter({ text: '北京', columns })
      expect(fd2.value.data).toHaveLength(0)
    })
  })

  describe('quickFilterSuppress', () => {
    it('skips columns with quickFilterSuppress', () => {
      const columns = [
        createCol({ prop: 'name', label: '姓名' }),
        createCol({ prop: 'city', label: '城市', quickFilterSuppress: true } as any),
      ]
      // Searching for city text should not match because city is suppressed
      const { filteredData } = createQuickFilter({ text: '上海', columns })
      expect(filteredData.value.data).toHaveLength(0) // city suppressed, name doesn't match '上海'
    })

    it('still searches non-suppressed columns', () => {
      const columns = [
        createCol({ prop: 'name', label: '姓名', quickFilterSuppress: true, hidden: false } as any),
        createCol({ prop: 'city', label: '城市', hidden: false }),
      ]
      const { filteredData } = createQuickFilter({ text: '上海', columns })
      expect(filteredData.value.data).toHaveLength(1) // city is not suppressed
    })
  })

  describe('edge cases', () => {
    it('handles null/undefined cell values gracefully', () => {
      const data = [
        { id: 1, name: null, city: '北京' },
        { id: 2, name: undefined, city: '上海' },
      ]
      const columns = [
        createCol({ prop: 'name', label: '姓名', hidden: false }),
        createCol({ prop: 'city', label: '城市', hidden: false }),
      ]
      const { filteredData } = createQuickFilter({ text: '北京', data, columns })
      expect(filteredData.value.data).toHaveLength(1)
      expect(filteredData.value.data[0].id).toBe(1)
    })

    it('returns empty when no columns participate', () => {
      const columns: ProcessedColumn[] = [
        { selection: true } as unknown as ProcessedColumn,
        createCol({ prop: 'name', label: '姓名', valueType: 'option', hidden: false }),
      ]
      const { filteredData } = createQuickFilter({ text: '张三', columns })
      expect(filteredData.value.data).toHaveLength(0)
      expect(filteredData.value.isFiltered).toBe(true)
    })

    it('ignores selection columns', () => {
      const columns = [
        { selection: true } as unknown as ProcessedColumn,
        createCol({ prop: 'name', label: '姓名', hidden: false }),
      ]
      const { filteredData } = createQuickFilter({ text: '张三', columns })
      expect(filteredData.value.data).toHaveLength(1)
    })

    it('ignores option columns', () => {
      const columns = [
        createCol({ prop: 'name', label: '姓名', valueType: 'option', hidden: false }),
        createCol({ prop: 'city', label: '城市', hidden: false }),
      ]
      const { filteredData } = createQuickFilter({ text: '上海', columns })
      expect(filteredData.value.data).toHaveLength(1)
    })
  })

  describe('reactivity', () => {
    it('re-filters when quickFilterText changes', () => {
      const textRef = ref('')
      const { filteredData, hasActiveQuickFilter } = useQuickFilter({
        quickFilterText: textRef,
        data: ref(mockData),
        columns: ref([
          createCol({ prop: 'name', label: '姓名', hidden: false }),
        ]),
      })

      expect(filteredData.value.isFiltered).toBe(false)
      expect(filteredData.value.data).toHaveLength(4)

      textRef.value = '张三'
      expect(filteredData.value.isFiltered).toBe(true)
      expect(filteredData.value.data).toHaveLength(1)
      expect(hasActiveQuickFilter.value).toBe(true)

      textRef.value = ''
      expect(filteredData.value.isFiltered).toBe(false)
      expect(filteredData.value.data).toHaveLength(4)
      expect(hasActiveQuickFilter.value).toBe(false)
    })

    it('re-filters when data changes', () => {
      const dataRef = ref([...mockData])
      const textRef = ref('张三')
      const { filteredData } = useQuickFilter({
        quickFilterText: textRef,
        data: dataRef,
        columns: ref([createCol({ prop: 'name', label: '姓名', hidden: false })]),
      })

      expect(filteredData.value.data).toHaveLength(1)

      dataRef.value = [...mockData, { id: 5, name: '张三', city: '深圳', age: 45 }]
      expect(filteredData.value.data).toHaveLength(2)
    })
  })

  describe('stability', () => {
    it('returns stable computed references', () => {
      const { filteredData, hasActiveQuickFilter } = createQuickFilter({ text: '' })
      const fd1 = filteredData.value
      const fd2 = filteredData.value
      expect(Object.is(fd1, fd2)).toBe(true)

      const ha1 = hasActiveQuickFilter.value
      const ha2 = hasActiveQuickFilter.value
      expect(ha1).toBe(ha2)
    })

    it('hasActiveQuickFilter returns false when text is empty or undefined', () => {
      const { hasActiveQuickFilter: h1 } = createQuickFilter({ text: '' })
      expect(h1.value).toBe(false)

      const { hasActiveQuickFilter: h2 } = createQuickFilter({ text: undefined })
      expect(h2.value).toBe(false)
    })

    it('hasActiveQuickFilter returns true when text is non-empty', () => {
      const { hasActiveQuickFilter } = createQuickFilter({ text: 'a' })
      expect(hasActiveQuickFilter.value).toBe(true)
    })
  })

  describe('group columns (children)', () => {
    it('flattens group columns and searches leaf columns', () => {
      const columns = [
        {
          prop: 'group1',
          label: 'Group 1',
          children: [
            createCol({ prop: 'name', label: '姓名', hidden: false }),
            createCol({ prop: 'city', label: '城市', hidden: false }),
          ],
          hidden: false,
        } as unknown as ProcessedColumn,
        createCol({ prop: 'age', label: '年龄', hidden: false }),
      ]
      const { filteredData } = createQuickFilter({ text: '上海', columns })
      expect(filteredData.value.data).toHaveLength(1)
    })
  })
})
