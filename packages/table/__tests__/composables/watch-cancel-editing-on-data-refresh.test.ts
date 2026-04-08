import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { watchCancelEditingOnDataRefresh } from '../../src/composables/core/use-adv-table-shared-editing'

describe('watchCancelEditingOnDataRefresh', () => {
  it('cancels editing with reason api when data refreshes with pending changes', async () => {
    const tableData = ref([{ id: 1 }])
    const hasPendingChanges = ref(true)
    const batchHasPending = ref(false)
    const cancelEditing = vi.fn()
    watchCancelEditingOnDataRefresh({ tableData, hasPendingChanges, batchHasPending, cancelEditing })
    tableData.value = [{ id: 2 }]
    await nextTick()
    await nextTick()
    expect(cancelEditing).toHaveBeenCalledTimes(1)
    expect(cancelEditing).toHaveBeenCalledWith('api')
  })

  it('cancels editing when only batch staging has pending', async () => {
    const tableData = ref([{ id: 1 }])
    const hasPendingChanges = ref(false)
    const batchHasPending = ref(true)
    const cancelEditing = vi.fn()
    watchCancelEditingOnDataRefresh({ tableData, hasPendingChanges, batchHasPending, cancelEditing })
    tableData.value = [{ id: 2 }]
    await nextTick()
    await nextTick()
    expect(cancelEditing).toHaveBeenCalledTimes(1)
  })

  it('does nothing when nothing is pending', async () => {
    const tableData = ref([{ id: 1 }])
    const hasPendingChanges = ref(false)
    const batchHasPending = ref(false)
    const cancelEditing = vi.fn()
    watchCancelEditingOnDataRefresh({ tableData, hasPendingChanges, batchHasPending, cancelEditing })
    tableData.value = [{ id: 2 }]
    await nextTick()
    await nextTick()
    expect(cancelEditing).not.toHaveBeenCalled()
  })
})
