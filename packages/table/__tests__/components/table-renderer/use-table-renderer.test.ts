import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { useTableRenderer } from '../../../src/components/table-renderer/use-table-renderer'

/**
 * <zh/> default 渲染器单测——无挂载 ElTable 时的空 root 降级与属性透传。
 * <en/> Table-renderer tests — null-root fallbacks and prop passthrough without a mounted ElTable.
 */
const cols = [{ key: 'a', prop: 'a', label: 'A' }]

function setupRenderer(propsOverrides: Record<string, any> = {}) {
  let api!: ReturnType<typeof useTableRenderer>
  const wrapper = mount(defineComponent({
    setup() {
      api = useTableRenderer({
        props: {
          columns: cols,
          leafColumns: cols,
          data: [{ id: '1', a: 'x' }],
          rowKey: (row: any) => String(row.id),
          selectionColumns: [],
          normalColumns: cols,
          selectableData: [],
          checkStatus: { isAllSelected: false, isIndeterminate: false },
          ...propsOverrides,
        } as any,
        tableRef: ref(null),
      })
      return () => h('div')
    },
  }))
  return { api, wrapper }
}

describe('useTableRenderer without mount', () => {
  it('falls back when the table root is absent', () => {
    const { api, wrapper } = setupRenderer()
    expect(api.rendererExpose.getColumnDragContainer()).toBeNull()
    expect(api.rendererExpose.getRowDragContainer()).toBeNull()
    expect(api.rendererExpose.getRenderedColumnKeys()).toEqual([])
    expect(api.rendererExpose.getRenderedRowKeys()).toEqual([])
    expect(api.rendererExpose.getDefaultColumnDragHandle()).toBe('th')
    expect(api.rendererExpose.getDefaultRowDragHandle()).toBe('td')
    wrapper.unmount()
  })

  it('defaults hover and sync options', () => {
    const { api, wrapper } = setupRenderer()
    expect(api.hoverOptionColumns.value).toEqual([])
    expect(api.hasHoverOptionColumns.value).toBe(false)
    expect(api.hoverOptionTeleport.value).toBe(false)
    expect(api.displayNormalColumns.value).toEqual([])
    expect(api.selectionColumnSyncKey.value).toBe('')
    expect(api.hoverRowKey.value).toBeNull()
    wrapper.unmount()
  })

  it('builds row and column index maps', () => {
    const { api, wrapper } = setupRenderer()
    expect(api.rowIndexMap.value.get('1')).toBe(0)
    expect(api.columnIndexMap.value.get('a')).toBe(0)
    expect(api.columnIndexColumns.value.map(c => c.prop)).toEqual(['a'])
    wrapper.unmount()
  })

  it('filters table props for ElTable passthrough', () => {
    const { api, wrapper } = setupRenderer()
    const first = api.tableProps.value
    expect(first.data).toBeUndefined()
    expect(first.rowKey).toBeUndefined()
    expect(api.tableProps.value).toBe(first)
    wrapper.unmount()
  })
})
