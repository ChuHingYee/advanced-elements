import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import AdvTable from '../../../src/AdvTable.vue'

// 搜索栏是 defineAsyncComponent，预先加载以免动态 import 的编译耗时超出 settle 轮询
import ('../../../src/components/search/search.vue')

/**
 * Demo 4.7「搜索值响应式」：Default 与 Virtual 两个表格实例双向绑定同一份
 * `v-model:search-values`。分别验证「挂载」与「输入」两个阶段是否收敛。
 */
describe('searchValues 双实例共享（demo 4.7）', () => {
  const columns = [
    { prop: 'name', label: '姓名', width: 120, search: true },
    { prop: 'gender', label: '性别', width: 100, valueType: 'select', valueEnum: { male: { text: '男' }, female: { text: '女' } }, search: { defaultValue: 'male' } },
    { prop: 'status', label: '状态', width: 100, valueType: 'select', valueEnum: { active: { text: '启用' }, inactive: { text: '禁用' } }, search: { defaultValue: 'active' } },
    { prop: 'age', label: '年龄', width: 100, search: true },
  ] as any[]

  const data = [
    { name: 'Alice', gender: 'male', status: 'active', age: 30 },
    { name: 'Bob', gender: 'female', status: 'inactive', age: 20 },
  ]

  function createDual() {
    const searchValuesModel = ref<Record<string, any>>({})
    const queries: any[] = []
    const Host = defineComponent({
      components: { AdvTable },
      setup: () => ({ searchValuesModel, columns, data, onQuery: (q: any) => queries.push(q) }),
      template: `
        <div>
          <AdvTable v-model:search-values="searchValuesModel" mode="default" :columns="columns" :data="data" height="200px" @query="onQuery" />
          <AdvTable v-model:search-values="searchValuesModel" mode="virtual" :columns="columns" :data="data" height="200px" @query="onQuery" />
        </div>
      `,
    })
    return { Host, searchValuesModel, queries }
  }

  async function settle(n = 12) {
    for (let i = 0; i < n; i++)
      await nextTick()
  }

  it('挂载后模型收敛到列默认值，不发生无限回写', async () => {
    const { Host, searchValuesModel } = createDual()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mount(Host)
    await settle()

    const recursive = [...warn.mock.calls, ...err.mock.calls]
      .some(a => String(a[0]).includes('Maximum recursive updates'))

    expect(recursive).toBe(false)
    expect(searchValuesModel.value).toMatchObject({ gender: 'male', status: 'active' })

    wrapper.unmount()
    warn.mockRestore()
    err.mockRestore()
  })

  it('在搜索框输入后两个实例与 model 保持一致，且不陷入循环', async () => {
    const { Host, searchValuesModel, queries } = createDual()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mount(Host)
    await settle()

    // 搜索栏异步挂载：轮询输入框出现（与 mount-table harness 同款策略）
    {
      const deadline = Date.now() + 10_000
      while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 25))
        await nextTick()
        if (wrapper.findAll('input[type="text"]').length > 0)
          break
      }
      await nextTick()
    }

    const input = wrapper.findAll('input[type="text"]')[0]
    expect(input.exists()).toBe(true)
    await input.setValue('Alice')
    await settle()

    const settledQueries = queries.length
    await settle(20)
    const afterQueries = queries.length

    const recursive = [...warn.mock.calls, ...err.mock.calls]
      .some(a => String(a[0]).includes('Maximum recursive updates'))

    expect({ settledQueries, afterQueries, recursive }).toEqual({ settledQueries, afterQueries, recursive: false })
    expect(afterQueries).toBe(settledQueries)
    expect(searchValuesModel.value).toMatchObject({ name: 'Alice' })

    wrapper.unmount()
    warn.mockRestore()
    err.mockRestore()
  })
})
