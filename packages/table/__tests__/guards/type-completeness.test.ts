import type { VueWrapper } from '@vue/test-utils'
import type { TableExpose } from '../../src/composables/api/use-table-api'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h, nextTick, ref } from 'vue'
import { apiContractKeys, internalExposeKeys, tableExposeOnlyKeys } from '../../src/__type-guards__/api-contract.keys'
import { cellRowGenericsGate } from '../../src/__type-guards__/core-generics.guard'
import AdvTable from '../../src/AdvTable.vue'

// Pre-load async renderer modules so defineAsyncComponent resolves immediately
import ('../../src/components/table-renderer/TableRenderer.vue')
import('../../src/components/table-virtual-renderer/TableVirtualRenderer.vue')

interface ExposedInstance { $: { exposed?: Record<string, unknown> } }

function mountTable(): { wrapper: VueWrapper, tableVm: ExposedInstance } {
  const columns = ref([{ prop: 'name', label: 'Name', hidden: false }])
  const data = [{ id: '1', name: 'Alice' }]
  const wrapper = mount(() => h(AdvTable, { columns: columns.value, data }))
  const tableVm = wrapper.findComponent(AdvTable).vm as unknown as ExposedInstance
  return { wrapper, tableVm }
}

function getExposedKeys(tableVm: ExposedInstance): string[] {
  const exposed = tableVm.$.exposed
  expect(exposed, 'defineExpose must expose an object').toBeTruthy()
  return Object.keys(exposed as Record<string, unknown>)
}

describe('guards/type-completeness contract-anchors', () => {
  it('preserves typed cell rows and legacy any defaults through the compile-time gate', () => {
    expect(cellRowGenericsGate).toEqual([true, true, true, true, true])
  })
  it('runtime exposed keys match the contract keys bidirectionally', async () => {
    const { wrapper, tableVm } = mountTable()
    await nextTick()
    const exposedKeys = getExposedKeys(tableVm)
    const expectedKeys: string[] = [
      ...apiContractKeys.filter(key => !(internalExposeKeys as readonly string[]).includes(key)),
      ...tableExposeOnlyKeys,
    ]

    const missingFromRuntime = expectedKeys.filter(key => !exposedKeys.includes(key))
    const missingFromContract = exposedKeys.filter(key => !expectedKeys.includes(key))

    expect(
      missingFromRuntime,
      `Runtime missing contract members (declared but not exposed): ${missingFromRuntime.join(', ')}`,
    ).toEqual([])
    expect(
      missingFromContract,
      `Runtime members absent from the contract (exposed but not declared): ${missingFromContract.join(', ')}`,
    ).toEqual([])

    wrapper.unmount()
  })

  it('exposes version and tableRootRef per TableExpose', async () => {
    const { wrapper, tableVm } = mountTable()
    await nextTick()
    const exposed = tableVm.$.exposed as Record<string, unknown> | undefined
    expect(typeof exposed?.version).toBe('string')
    expect(exposed?.tableRootRef).toBeTruthy()
    wrapper.unmount()
  })

  it('contract key list has no duplicates', () => {
    const all: string[] = [...apiContractKeys, ...tableExposeOnlyKeys]
    const duplicates = all.filter((key, index) => all.indexOf(key) !== index)
    expect(duplicates, `Duplicate keys in the contract list: ${duplicates.join(', ')}`).toEqual([])
  })

  it('keeps internal members out of the public expose', async () => {
    const { wrapper, tableVm } = mountTable()
    await nextTick()
    const exposed = tableVm.$.exposed as Record<string, unknown> | undefined
    for (const key of internalExposeKeys)
      expect(exposed?.[key], `Internal member ${key} must not be exposed`).toBeUndefined()
    wrapper.unmount()
  })

  it('contract keys resolve to TableExpose shape', () => {
    // <zh/> 编译期：TableExpose<T> = UseTableApiReturn<T> − 内部成员 + version + tableRootRef，
    // <zh/> 上述并集必须与其键集合同构（锚点文件已在 typecheck 闸门断言）。
    // <en/> Compile-time: TableExpose<T> = UseTableApiReturn<T> minus internals plus version and tableRootRef.
    expect(apiContractKeys.length + tableExposeOnlyKeys.length).toBeGreaterThan(0)
    const exposeShape: keyof TableExpose<{ id: string }> = 'scrollToRow'
    expect(exposeShape).toBe('scrollToRow')
  })
})
