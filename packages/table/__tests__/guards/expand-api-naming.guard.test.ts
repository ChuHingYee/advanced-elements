import type { VueWrapper } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'
import AdvTable from '../../src/AdvTable.vue'

import ('../../src/components/table-renderer/TableRenderer.vue')
import('../../src/components/table-virtual-renderer/TableVirtualRenderer.vue')

interface ExposedInstance { $: { exposed?: Record<string, unknown> } }

function mountTable(): { wrapper: VueWrapper, tableVm: ExposedInstance } {
  const columns = [{ prop: 'name', label: 'Name', hidden: false }]
  const data = [{ id: '1', name: 'Alice' }]
  const wrapper = mount(() => h(AdvTable, { columns, data }))
  const tableVm = wrapper.findComponent(AdvTable).vm as unknown as ExposedInstance
  return { wrapper, tableVm }
}

describe('guards/expand-api-naming expand-contract', () => {
  it('exposes the new TreeNode/DetailRow-word-rooted method names', async () => {
    const { wrapper, tableVm } = mountTable()
    await nextTick()
    const exposed = tableVm.$.exposed as Record<string, unknown> | undefined
    expect(exposed, 'defineExpose must expose an object').toBeTruthy()

    const expected = [
      'toggleTreeNodeExpand',
      'expandTreeNode',
      'collapseTreeNode',
      'expandAllTreeNodes',
      'collapseAllTreeNodes',
      'getTreeMeta',
      'toggleDetailRowExpand',
      'expandDetailRow',
      'collapseDetailRow',
      'expandAllDetailRows',
      'collapseAllDetailRows',
      'toggleGroupExpand',
      'expandAllGroups',
      'collapseAllGroups',
    ]
    for (const key of expected) {
      expect(typeof exposed![key], `Exposed API must declare "${key}"`).toBe('function')
    }
    wrapper.unmount()
  })

  it('no longer exposes the removed pre-R2 expand method names', async () => {
    const { wrapper, tableVm } = mountTable()
    await nextTick()
    const exposed = tableVm.$.exposed as Record<string, unknown> | undefined
    expect(exposed, 'defineExpose must expose an object').toBeTruthy()

    const removed = [
      'toggleRowExpand',
      'expandRow',
      'collapseRow',
      'expandAll',
      'collapseAll',
      'toggleRowExpandRow',
      'expandRowByRow',
      'collapseRowByRow',
      'expandAllRows',
      'collapseAllRows',
    ]
    for (const key of removed) {
      expect(exposed![key], `Removed "${key}" must no longer be exposed`).toBeUndefined()
    }
    wrapper.unmount()
  })
})
