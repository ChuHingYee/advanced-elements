/**
 * @vitest-environment happy-dom
 */
/**
 * <zh/> usePaginationVisibility 覆盖测试——禁用树形/分组/展开下的双管线分页可见性
 * <en/> usePaginationVisibility coverage — dual-pipeline pagination visibility with tree/group/expand disabled
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { usePaginationVisibility } from '../../src/composables/data/use-pagination-visibility'

/** <zh/> 行类型 | <en/> Row type */
interface CoverRow {
  id: string
}

/** <zh/> 5 行固定数据 | <en/> Fixed 5-row dataset */
function createRows(): CoverRow[] {
  return [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }, { id: 'r4' }, { id: 'r5' }]
}

/**
 * <zh/> 挂载最小配置的分页可见性（树形/分组/展开均禁用）
 * <en/> Mount pagination visibility with minimal options (tree/group/expand all disabled)
 */
function mountVisibility(options?: {
  isClientPagination?: boolean
  includeSynthetic?: boolean
  page?: number
}) {
  const rows = createRows()
  const finalDisplayData = ref<CoverRow[]>(rows)
  const isClientPagination = ref(options?.isClientPagination ?? true)
  const currentPage = ref(options?.page ?? 1)
  const pageSize = ref(2)
  // <zh/> 行键函数 | <en/> Row key function
  const rowKeyFn = (row: CoverRow) => row.id
  let api!: ReturnType<typeof usePaginationVisibility<CoverRow>>
  const wrapper = mount(defineComponent({
    setup() {
      api = usePaginationVisibility<CoverRow>({
        finalDisplayData,
        isClientPagination,
        currentPage,
        pageSize,
        rowKeyFn,
        includeSynthetic: options?.includeSynthetic,
      })
      return () => h('div')
    },
  }))
  return { api, wrapper, rows, finalDisplayData, isClientPagination, currentPage, pageSize }
}

describe('usePaginationVisibility coverage', () => {
  /**
   * <zh/> 第一页返回前 2 行且保持行引用 | <en/> Page 1 returns the first 2 rows keeping row references
   */
  it('shows first 2 rows on page 1', () => {
    const t = mountVisibility()
    try {
      expect(t.api.visibleData.value).toHaveLength(2)
      expect(t.api.visibleData.value.map(r => r.id)).toEqual(['r1', 'r2'])
      // <zh/> 引用透传：行对象未被克隆（与响应式源数组元素同一引用）| <en/> Reference passthrough: row objects are not cloned (same refs as the reactive source elements)
      expect(t.api.visibleData.value[0]).toBe(t.finalDisplayData.value[0])
      expect(t.api.visibleData.value[1]).toBe(t.finalDisplayData.value[1])
    }
    finally {
      t.wrapper.unmount()
    }
  })

  /**
   * <zh/> 翻页后重算为下 2 行 | <en/> Toggling currentPage recomputes to the next 2 rows
   */
  it('recomputes next 2 rows after currentPage toggle', async () => {
    const t = mountVisibility()
    try {
      expect(t.api.visibleData.value.map(r => r.id)).toEqual(['r1', 'r2'])
      t.currentPage.value = 2
      await nextTick()
      expect(t.api.visibleData.value).toHaveLength(2)
      expect(t.api.visibleData.value.map(r => r.id)).toEqual(['r3', 'r4'])
      expect(t.api.visibleData.value[0]).toBe(t.finalDisplayData.value[2])
      expect(t.api.visibleData.value[1]).toBe(t.finalDisplayData.value[3])
    }
    finally {
      t.wrapper.unmount()
    }
  })

  /**
   * <zh/> 关闭客户端分页时返回全部行 | <en/> Returns all rows when client pagination is off
   */
  it('returns all rows when isClientPagination is false', () => {
    const t = mountVisibility({ isClientPagination: false })
    try {
      expect(t.api.visibleData.value).toHaveLength(5)
      expect(t.api.visibleData.value.map(r => r.id)).toEqual(['r1', 'r2', 'r3', 'r4', 'r5'])
      // <zh/> 禁用分页时直接透传数据源引用 | <en/> Passes the source reference through when pagination is off
      expect(t.api.visibleData.value).toBe(t.finalDisplayData.value)
    }
    finally {
      t.wrapper.unmount()
    }
  })

  /**
   * <zh/> includeSynthetic:false 走分页后分支（无合成行时等于纯分页结果）| <en/> includeSynthetic:false takes the post-pagination branch (equals pure pagination without synthetics)
   */
  it('resolves includeSynthetic false branch to expandedAfter value', async () => {
    const t = mountVisibility({ includeSynthetic: false })
    try {
      expect(t.api.visibleData.value.map(r => r.id)).toEqual(['r1', 'r2'])
      t.currentPage.value = 2
      await nextTick()
      expect(t.api.visibleData.value.map(r => r.id)).toEqual(['r3', 'r4'])
      expect(t.api.visibleData.value[0]).toBe(t.finalDisplayData.value[2])
      expect(t.api.visibleData.value[1]).toBe(t.finalDisplayData.value[3])
    }
    finally {
      t.wrapper.unmount()
    }
  })

  /**
   * <zh/> 暴露分页前展开快照、禁用子 API 标志与空共享展开集合 | <en/> Exposes pre-pagination snapshot, disabled sub-API flags and empty shared expansion sets
   */
  it('exposes prePaginationExpandedData, disabled flags and empty shared sets', () => {
    const t = mountVisibility()
    try {
      // <zh/> 无树形/分组/展开时分页前快照即数据源引用 | <en/> Pre-pagination snapshot is the source reference without tree/group/expand
      expect(t.api.prePaginationExpandedData.value).toBe(t.finalDisplayData.value)
      expect(t.api.prePaginationExpandedData.value.map(r => r.id)).toEqual(['r1', 'r2', 'r3', 'r4', 'r5'])
      // <zh/> 子域均未启用 | <en/> All sub-domains stay disabled
      expect(t.api.treeApi.treeEnabled.value).toBe(false)
      expect(t.api.rowGroupApi.groupEnabled.value).toBe(false)
      expect(t.api.rowExpandApi.expandEnabled.value).toBe(false)
      // <zh/> 共享展开状态为空集合 | <en/> Shared expansion state holds empty sets
      expect(t.api.sharedExpandedGroupValues.value).toBeInstanceOf(Set)
      expect(t.api.sharedExpandedGroupValues.value.size).toBe(0)
      expect(t.api.sharedExpandedRowKeys.value).toBeInstanceOf(Set)
      expect(t.api.sharedExpandedRowKeys.value.size).toBe(0)
    }
    finally {
      t.wrapper.unmount()
    }
  })
})
