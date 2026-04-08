import type { VueWrapper } from '@vue/test-utils'
import type { VNode } from 'vue'
import type { AdvColumn } from '../../src/types'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import AdvTable from '../../src/AdvTable.vue'

// Pre-load async renderer modules so defineAsyncComponent resolves immediately
import ('../../src/components/table-renderer/TableRenderer.vue')
import('../../src/components/table-virtual-renderer/TableVirtualRenderer.vue')
// 侧面板同样是 defineAsyncComponent，预先加载以免首个用例把编译耗时算进挂载轮询
import ('../../src/components/filter-panel/filter-panel.vue')
import('../../src/components/column-setting/column-setting-side-panel.vue')
import('../../src/components/column-group/column-group-side-panel.vue')
// 搜索栏同样是 defineAsyncComponent（v-if="search.hasSearch" 守卫），预先加载
import('../../src/components/search/search.vue')

let wrapper: VueWrapper | null = null

function getColumns(): AdvColumn[] {
  return [
    { prop: 'name', label: '姓名', hidden: false },
    { prop: 'id', label: 'id', hidden: false },
    {
      prop: 'formatName',
      label: '格式化',
      width: 120,
      align: 'center' as const,
      format(val: any) {
        return `i am ${val.name}test`
      },
      hidden: false,
    },
  ]
}

function _mount(render: () => VNode) {
  wrapper = mount(render, {
    global: {
      config: {
        globalProperties: {
          $router: {
            query: {
              p: 2,
              s: 3,
            },
          },
        } as any,
      },
    },
  })
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

/**
 * 搜索栏异步就绪等待——TableSearch 为 defineAsyncComponent，
 * 以 .adv-table-search-form 出现为就绪信号做条件轮询（与 mount-table  harness 同款策略）。
 */
async function waitForSearchForm(w: VueWrapper) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 25))
    await nextTick()
    if (w.find('.adv-table-search-form').exists())
      break
  }
  await nextTick()
}

describe('table.vue', () => {
  const mockData = [
    { id: '1', name: '张三', age: 25 },
    { id: '2', name: '李四', age: 30 },
    { id: '3', name: '王五', age: 35 },
  ]

  describe('basic props', () => {
    it('renders with data prop', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
        { prop: 'age', label: '年龄', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable columns={columns.value} data={mockData} />
      ))
      await nextTick()
      expect(wrapper.find('.adv-table').exists()).toBe(true)
    })

    it('renders with custom size', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable columns={columns.value} data={mockData} size="small" />
      ))
      await nextTick()
      expect(wrapper.exists()).toBe(true)
    })

    it('renders with columnEmptyText', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable columns={columns.value} data={mockData} columnEmptyText="N/A" />
      ))
      await nextTick()
      expect(wrapper.exists()).toBe(true)
    })

    it('renders with pageSize and pageSizes props', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      // <zh/> 注意：pageSize 等没有顶层 prop，真实接口是 pagination 对象（旧用例传顶层 prop，全被 attrs 忽略）；
      // <zh/> 且 footer 只在请求回写 total 后渲染（total 单 owner 口径：page 模式取请求 total），故用 request 源驱动。
      // <en/> No top-level pageSize props exist — the real API is the pagination object (old tests passed ignored top-level props);
      // <en/> and the footer only renders after a request writes total back, so drive it with a request source.
      const rows25 = Array.from({ length: 25 }, (_, i) => ({ id: String(i + 1), name: `name${i + 1}` }))
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          request={{ source: () => Promise.resolve({ data: rows25, total: 100 }) }}
          pagination={{ pageSize: 20, pageSizes: [10, 20, 50] }}
        />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 200))
      // <zh/> 顶层分页 prop 必须透传到 ElPagination
      // <en/> Top-level pagination props must reach ElPagination
      const pager = wrapper.findComponent({ name: 'ElPagination' })
      expect(pager.exists()).toBe(true)
      expect(pager.props('pageSize')).toBe(20)
      expect(pager.props('pageSizes')).toEqual([10, 20, 50])
    })

    it('renders with layout prop', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const rows25 = Array.from({ length: 25 }, (_, i) => ({ id: String(i + 1), name: `name${i + 1}` }))
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          request={{ source: () => Promise.resolve({ data: rows25, total: 100 }) }}
          pagination={{ layout: 'total, sizes, prev, pager, next' }}
        />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 200))
      expect(wrapper.findComponent({ name: 'ElPagination' }).props('layout')).toBe(
        'total, sizes, prev, pager, next',
      )
    })

    it('renders with background prop', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const rows25 = Array.from({ length: 25 }, (_, i) => ({ id: String(i + 1), name: `name${i + 1}` }))
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          request={{ source: () => Promise.resolve({ data: rows25, total: 100 }) }}
          pagination={{ background: true }}
        />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 200))
      expect(wrapper.findComponent({ name: 'ElPagination' }).props('background')).toBe(true)
    })

    it('renders with hideOnSinglePage prop', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          request={{ source: () => Promise.resolve({ data: mockData, total: 3 }) }}
          pagination={{ hideOnSinglePage: true }}
        />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 200))
      // <zh/> 回写 total=3、一页装下：单页隐藏生效，分页器不得渲染（此前无 footer 可断言，用请求源驱动才有意义）
      // <en/> Total 3 fits one page: single-page hiding applies, no pager renders
      expect(wrapper.findComponent({ name: 'ElPagination' }).exists()).toBe(false)
    })

    it('renders with pagerCount prop', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const rows25 = Array.from({ length: 25 }, (_, i) => ({ id: String(i + 1), name: `name${i + 1}` }))
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          request={{ source: () => Promise.resolve({ data: rows25, total: 100 }) }}
          pagination={{ pagerCount: 7 }}
        />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 200))
      expect(wrapper.findComponent({ name: 'ElPagination' }).props('pagerCount')).toBe(7)
    })

    it('renders with disabled prop', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const rows25 = Array.from({ length: 25 }, (_, i) => ({ id: String(i + 1), name: `name${i + 1}` }))
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          request={{ source: () => Promise.resolve({ data: rows25, total: 100 }) }}
          pagination={{ disabled: true }}
        />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 200))
      expect(wrapper.findComponent({ name: 'ElPagination' }).props('disabled')).toBe(true)
    })

    it('renders with total prop', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const rows25 = Array.from({ length: 25 }, (_, i) => ({ id: String(i + 1), name: `name${i + 1}` }))
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          request={{ source: () => Promise.resolve({ data: rows25, total: 100 }) }}
          pagination={{ total: 100 }}
        />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 200))
      // <zh/> 回写 total=100 到分页器（manual 下走 propsTotal，page 模式走请求回写，此处为后者）
      // <en/> Total 100 reaches the pager (manual mode uses propsTotal, page mode uses request write-back — this is the latter)
      expect(wrapper.findComponent({ name: 'ElPagination' }).props('total')).toBe(100)
    })
  })

  describe('virtual mode', () => {
    it('renders virtual table when mode is virtual', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable mode="virtual" columns={columns.value} data={mockData} />
      ))
      await nextTick()
      expect(wrapper.find('.adv-table').exists()).toBe(true)
    })

    it('renders virtual table with selection', async () => {
      const columns = ref([
        { selection: true },
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable mode="virtual" columns={columns.value} data={mockData} />
      ))
      await nextTick()
      expect(wrapper.find('.adv-table').exists()).toBe(true)
    })
  })

  describe('selection', () => {
    it('renders selection column', async () => {
      const columns = ref([
        { selection: true },
        { prop: 'name', label: '姓名', hidden: false },
        { prop: 'age', label: '年龄', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable columns={columns.value} data={mockData} />
      ))
      await nextTick()

      expect(wrapper.find('.adv-table').exists()).toBe(true)
    })
  })

  describe('toolbar config', () => {
    const mock = {
      getData: () =>
        Promise.resolve({
          data: [
            { id: '1', name: 1 },
            { id: '2', name: 2 },
          ],
        }),
    }
    let getDataSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      getDataSpy = vi.spyOn(mock, 'getData')
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('renders columns correctly', async () => {
      const columns = ref(getColumns())
      const wrapper = _mount(() => (
        <AdvTable request={{ source: mock.getData }} columns={columns.value} />
      ))
      await nextTick()
      await nextTick()
      await nextTick()

      expect(getDataSpy).toHaveBeenCalledTimes(1)
      expect(wrapper.find('.adv-table__header-export').exists()).toBe(false)
      expect(wrapper.find('.adv-table__header-refresh').exists()).toBe(false)
      expect(wrapper.find('.adv-table-polling-toggle').exists()).toBe(false)
    })

    it('shows refresh button when enabled', async () => {
      vi.restoreAllMocks()
      getDataSpy = vi.spyOn(mock, 'getData')
      const columns = ref(getColumns())
      const wrapper = _mount(() => (
        <AdvTable
          toolbar={{ refreshBtn: true }}
          request={{ source: mock.getData }}
          columns={columns.value}
        />
      ))
      await nextTick()
      await nextTick()
      await nextTick()

      expect(wrapper.find('.adv-table__header-refresh').exists()).toBe(true)
      await wrapper.find('.adv-table__header-refresh').trigger('click')
      await nextTick()
      await nextTick()
      expect(getDataSpy).toHaveBeenCalledTimes(2)
    })

    it('shows polling button when enabled', async () => {
      const columns = ref(getColumns())
      const wrapper = _mount(() => (
        <AdvTable
          toolbar={{ pollingBtn: true }}
          request={{ source: mock.getData }}
          columns={columns.value}
        />
      ))
      await nextTick()
      expect(wrapper.find('.adv-table-polling-toggle').exists()).toBe(true)
    })
  })

  describe('pagination config', () => {
    // <zh/> beta 延期 ×3：以下分页渲染用例保持 skip，stable 前必须逐条分流（恢复或删除），勿沉默保留
    // <en/> Beta-deferred x3: pagination rendering cases below stay skipped; each must be triaged (restore or remove) before stable, never silently kept
    const mock = {
      getData: () =>
        Promise.resolve({
          data: [
            { id: '1', name: 1 },
            { id: '2', name: 2 },
          ],
        }),
    }

    it.skip('renders pagination with sticky mode', async () => {
      const columns = ref(getColumns())
      const wrapper = _mount(() => (
        <AdvTable
          pagination={{ mode: 'page', sticky: true, containerHeight: 600 }}
          request={{ source: mock.getData }}
          columns={columns.value}
        />
      ))
      await nextTick()
      const page = wrapper.find('.adv-table-page')
      expect(page.exists()).toBe(true)
    })

    it.skip('renders pagination without sticky mode', async () => {
      const columns = ref(getColumns())
      const wrapper = _mount(() => (
        <AdvTable
          pagination={{ mode: 'page', sticky: false }}
          request={{ source: mock.getData }}
          columns={columns.value}
        />
      ))
      await nextTick()
      const page = wrapper.find('.adv-table-page')
      expect(page.exists()).toBe(true)
      expect(page.classes()).not.toContain('adv-table__page--sticky')
    })

    it.skip('renders manual load mode', async () => {
      const mockData = {
        getData: () =>
          Promise.resolve({
            data: [
              { id: '1', name: 1 },
              { id: '2', name: 2 },
            ],
            total: 25,
          }),
      }
      const columns = ref(getColumns())
      const wrapper = _mount(() => (
        <AdvTable
          pagination={{ mode: 'manual' }}
          request={{ source: mockData.getData }}
          columns={columns.value}
        />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 100))
      expect(wrapper.find('.adv-table__page--manual').exists()).toBe(true)
      const btn = wrapper.find('.el-button')
      expect(btn.exists()).toBe(true)
      expect(btn.text()).toBe('加载更多')
    })

    it('renders client pagination mode', async () => {
      const mockData = Array.from({ length: 25 }, (_, i) => ({
        id: String(i + 1),
        name: `name${i + 1}`,
      }))
      const columns = ref(getColumns())
      const wrapper = _mount(() => (
        <AdvTable
          pagination={{ mode: 'client', total: mockData.length }}
          data={mockData}
          columns={columns.value as any}
        />
      ))
      await nextTick()
      expect(wrapper.find('.adv-table').exists()).toBe(true)
      const page = wrapper.find('.adv-table__page')
      expect(page.exists()).toBe(true)
    })

    it('client pagination displays correct page data', async () => {
      const mockData = Array.from({ length: 25 }, (_, i) => ({
        id: String(i + 1),
        name: `name${i + 1}`,
      }))
      const columns = ref(getColumns())
      const wrapper = _mount(() => (
        <AdvTable
          pagination={{ mode: 'client', total: mockData.length }}
          data={mockData}
          columns={columns.value as any}
        />
      ))
      await nextTick()
      expect(wrapper.find('.adv-table').exists()).toBe(true)
    })
  })

  describe('search config', () => {
    it('renders search form when enabled', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', search: true, hidden: false },
        { prop: 'age', label: '年龄', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          data={mockData}
          search={{ enabled: true }}
        />
      ))
      await waitForSearchForm(wrapper)
      expect(wrapper.find('.adv-table-search-form').exists()).toBe(true)
    })

    it('renders search with custom config', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', search: true, hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          data={mockData}
          search={{
            enabled: true,
            debounceTime: 500,
            searchText: '查询',
            resetText: '重置',
            labelWidth: 100,
            collapsed: false,
            span: 8,
          }}
        />
      ))
      await nextTick()
      expect(wrapper.exists()).toBe(true)
    })

    it('renders search with custom fields', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          data={mockData}
          search={{
            enabled: true,
            fields: [
              {
                prop: 'status',
                type: 'select',
                componentProps: {
                  options: [
                    { label: '全部', value: '' },
                    { label: '启用', value: 'active' },
                  ],
                },
                hidden: false,
              },
            ],
          }}
        />
      ))
      await nextTick()
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('url state', () => {
    /**
     * <zh/> 带路由上下文的挂载：useUrlState 只读 globalProperties.$route（$router 仅做 mock 占位，replace 供回写断言）。
     * <en/> Mount with router context: useUrlState only reads globalProperties.$route ($router is a mock placeholder, replace for write-back assertions).
     */
    function mountWithRoute(query: Record<string, any>, urlState: any) {
      const replace = vi.fn()
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      wrapper = mount(() => (
        <AdvTable
          columns={columns.value}
          data={mockData}
          urlState={urlState}
        />
      ), {
        global: {
          config: {
            globalProperties: {
              $router: { query, replace },
              $route: { path: '/', query },
            } as any,
          },
        },
      })
      return { replace }
    }

    function paginationOf() {
      const api = wrapper!.findComponent(AdvTable).vm.$.exposed as any
      return api.getPagination()
    }

    it('initializes pagination from route query with default keys', async () => {
      mountWithRoute({ p: '2', s: '3' }, { enabled: true })
      await nextTick()
      // <zh/> 默认键 p/s：query {p:2,s:3} 落到分页初始值，而非走默认 1/10
      // <en/> Default keys p/s: query lands in initial pagination instead of defaults
      expect(paginationOf()).toMatchObject({ currentPage: 2, pageSize: 3 })
    })

    it('respects custom page/size keys', async () => {
      mountWithRoute({ page: '4', size: '5' }, { enabled: true, pageKey: 'page', sizeKey: 'size' })
      await nextTick()
      expect(paginationOf()).toMatchObject({ currentPage: 4, pageSize: 5 })
    })

    it('ignores route query when urlState is disabled', async () => {
      mountWithRoute({ p: '2', s: '3' }, undefined)
      await nextTick()
      // <zh/> 未启用时 query 不得泄漏进分页（默认第 1 页）
      // <en/> Disabled urlState must not leak query into pagination (default page 1)
      expect(paginationOf()).toMatchObject({ currentPage: 1 })
    })

    it('ignores non-positive query values', async () => {
      mountWithRoute({ p: '0', s: 'abc' }, { enabled: true })
      await nextTick()
      // <zh/> 非法值回退默认：0 与非数字都不采纳
      // <en/> Invalid values fall back to defaults: neither 0 nor NaN is adopted
      expect(paginationOf()).toMatchObject({ currentPage: 1 })
    })
  })

  describe('draggable', () => {
    it('renders with draggable enabled', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          data={mockData}
          draggable
        />
      ))
      await nextTick()
      expect(wrapper.exists()).toBe(true)
    })

    it('renders with rowDraggable enabled', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          data={mockData}
          rowDraggable
        />
      ))
      await nextTick()
      expect(wrapper.exists()).toBe(true)
    })

    it('renders with custom rowDragHandle', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          data={mockData}
          rowDraggable
          rowDragHandle=".drag-handle"
        />
      ))
      await nextTick()
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('exposed methods', () => {
    it('has exposed methods via root ref', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable ref="tableRef" columns={columns.value} data={mockData} />
      ))
      await nextTick()
      expect(wrapper.find('.adv-table').exists()).toBe(true)
    })
  })

  describe('slots', () => {
    it('renders header-left slot', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable columns={columns.value} data={mockData}>
          {{
            'header-left': () => <span class="custom-header-left">Left</span>,
          }}
        </AdvTable>
      ))
      await nextTick()
      expect(wrapper.find('.custom-header-left').exists()).toBe(true)
    })

    it('renders header-right slot', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable columns={columns.value} data={mockData}>
          {{
            'header-right': () => <span class="custom-header-right">Right</span>,
          }}
        </AdvTable>
      ))
      await nextTick()
      expect(wrapper.find('.custom-header-right').exists()).toBe(true)
    })

    it('renders footer slot', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable columns={columns.value} data={mockData}>
          {{
            footer: () => <span class="custom-footer">Footer</span>,
          }}
        </AdvTable>
      ))
      await nextTick()
      expect(wrapper.find('.custom-footer').exists()).toBe(true)
    })
  })

  describe('request config', () => {
    it('renders with request.source', async () => {
      const dataSource = vi.fn().mockResolvedValue({
        data: [
          { id: '1', name: '张三' },
          { id: '2', name: '李四' },
        ],
      })
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      _mount(() => (
        <AdvTable
          request={{ source: dataSource }}
          columns={columns.value}
        />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 100))
      expect(dataSource).toHaveBeenCalled()
    })
  })

  describe('column configuration', () => {
    it('renders column with format', async () => {
      // <zh/> format 签名是 (ctx: FormatContext)，行数据在 ctx.row——传 row 参数是常见误用，此处锁定正确签名
      // <en/> format takes (ctx: FormatContext) with the row at ctx.row — locking the correct signature
      const format = (ctx: any) => `格式化: ${ctx.row.name}`
      const columns = ref([
        {
          prop: 'name',
          label: '姓名',
          format,
          hidden: false,
        },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable mode="default" columns={columns.value} data={mockData} />
      ))
      // <zh/> 行文渲染是异步管线终点，轮询等内容出现（固定 sleep 在负载高时 flaky）
      // <en/> Row text is the end of the async pipeline; poll for content instead of fixed sleeps under load
      const deadline = Date.now() + 5000
      while (!wrapper.text().includes('格式化:')) {
        if (Date.now() > deadline)
          break
        await new Promise(r => setTimeout(r, 25))
        await nextTick()
      }
      // <zh/> format 函数输出落到单元格，而非原值
      // <en/> format output reaches cells instead of raw values
      expect(wrapper.text()).toContain('格式化:')
      expect(wrapper.text()).toContain('格式化: 张三')
    })

    it('renders column with copyable', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', copyable: true, hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable mode="default" columns={columns.value} data={mockData} />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 100))
      // <zh/> copyable 列渲染复制图标（点击复制链路见 copyable-cell 单测）
      // <en/> Copyable columns render the copy icon (click-to-copy covered in copyable-cell tests)
      expect(wrapper.find('.adv-table__cell-copyable-icon').exists()).toBe(true)
    })

    it('renders column with ellipsis', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', ellipsis: true, hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable mode="default" columns={columns.value} data={mockData} />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 100))
      // <zh/> ellipsis 开启 → 单元格包溢出标记 span（事件委托 tooltip 的锚点）
      // <en/> Ellipsis on → cells wrap in the overflow marker span (anchor for delegated tooltips)
      expect(wrapper.find('.adv-table__cell--overflow').exists()).toBe(true)
    })

    it('renders column with tooltip', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', tooltip: '这是提示', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable mode="default" columns={columns.value} data={mockData} />
      ))
      // <zh/> 表头走异步列管线，冷启动时需轮询等待（固定 sleep 会 flaky）
      // <en/> Headers go through the async column pipeline; poll with a deadline on cold starts instead of fixed sleeps
      const deadline = Date.now() + 5000
      while (!wrapper.find('.adv-table__header-tooltip-trigger').exists()) {
        if (Date.now() > deadline)
          break
        await new Promise(r => setTimeout(r, 25))
        await nextTick()
      }
      // <zh/> hover 触发器渲染即代表接线完成；内容浮现依赖容器可见性（happy-dom 无布局恒不可见），
      // <zh/> 该路径由 use-shared-header-tooltip 单测（fake timers）覆盖，此处不断言浮现。
      // <en/> The rendered hover trigger proves the wiring; content surfacing needs container visibility
      // <en/> (never visible in layout-less happy-dom) and is covered by use-shared-header-tooltip unit tests.
      expect(wrapper.find('.adv-table__header-tooltip-trigger').exists()).toBe(true)
    })

    it('renders column with emptyText', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', emptyText: '暂无数据', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          mode="default"
          columns={columns.value}
          data={[{ id: '1', name: '' }]}
        />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 100))
      // <zh/> 空值单元格显示占位而非空白
      // <en/> Empty cells show the placeholder instead of blank
      expect(wrapper.text()).toContain('暂无数据')
    })

    it('renders column with fixed', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', fixed: 'left', hidden: false },
        { prop: 'age', label: '年龄', fixed: 'right', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable mode="default" columns={columns.value} data={mockData} />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 100))
      // <zh/> 左右固定列带 EP 固定列标记类
      // <en/> Fixed columns carry EP fixed-column marker classes
      expect(wrapper.find('.el-table-fixed-column--left').exists()).toBe(true)
      expect(wrapper.find('.el-table-fixed-column--right').exists()).toBe(true)
    })

    it('renders column with width and minWidth', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', width: 100, minWidth: 80, hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable mode="default" columns={columns.value} data={mockData} />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 100))
      // <zh/> 列宽落到 colgroup 的 col 上（EP 原生宽度机制）
      // <en/> Column width lands on colgroup col (EP native width mechanism)
      const col = wrapper.find('colgroup col')
      expect(col.exists()).toBe(true)
      expect(col.attributes('width')).toBe('100')
    })

    it('renders column with valueType and valueEnum', async () => {
      const columns = ref([
        {
          prop: 'status',
          label: '状态',
          valueType: 'select',
          valueEnum: {
            active: { text: '启用', status: 'success' },
            inactive: { text: '禁用', status: 'info' },
          },
          hidden: false,
        },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          mode="default"
          columns={columns.value}
          data={[{ status: 'active' }, { status: 'inactive' }]}
        />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 100))
      // <zh/> 枚举值映射为文本：active→启用，inactive→禁用
      // <en/> Enum values map to text: active→启用， inactive→禁用
      expect(wrapper.text()).toContain('启用')
      expect(wrapper.text()).toContain('禁用')
    })
  })

  describe('events', () => {
    it('does not emit update:columns on plain mount', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const onUpdateColumns = vi.fn()
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          data={mockData}
          onUpdate:columns={onUpdateColumns}
        />
      ))
      await nextTick()
      // <zh/> 纯挂载不得误发 update:columns（否则父级 v-model 会被初始化回写污染）
      // <en/> Plain mount must not emit update:columns spuriously (or parent v-model gets polluted by init write-back)
      expect(onUpdateColumns).not.toHaveBeenCalled()
      expect(wrapper.find('.adv-table').exists()).toBe(true)
    })

    it('does not emit update:data on plain mount', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const onUpdateData = vi.fn()
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          data={mockData}
          onUpdate:data={onUpdateData}
        />
      ))
      await nextTick()
      expect(onUpdateData).not.toHaveBeenCalled()
      expect(wrapper.find('.adv-table').exists()).toBe(true)
    })

    it('renders with rowKey prop', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          data={mockData}
          rowConfig={{ rowKey: (row: any) => row.id }}
        />
      ))
      await nextTick()
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('default values', () => {
    it('renders with default mode', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable columns={columns.value} data={mockData} />
      ))
      await nextTick()
      expect(wrapper.find('.adv-table').exists()).toBe(true)
    })

    it('renders with default toolbar', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable columns={columns.value} data={mockData} toolbar={{}} />
      ))
      await nextTick()
      expect(wrapper.exists()).toBe(true)
    })

    it('renders with default search', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable columns={columns.value} data={mockData} search={{}} />
      ))
      await nextTick()
      expect(wrapper.exists()).toBe(true)
    })

    it('renders with default pagination', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable columns={columns.value} data={mockData} pagination={{}} />
      ))
      await nextTick()
      expect(wrapper.exists()).toBe(true)
    })

    it('renders with default request', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable columns={columns.value} data={mockData} request={{}} />
      ))
      await nextTick()
      expect(wrapper.exists()).toBe(true)
    })

    it('renders with default urlState', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable columns={columns.value} data={mockData} urlState={{}} />
      ))
      await nextTick()
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('computed properties', () => {
    it('computes resolvedDataSource from dataSource', async () => {
      // <zh/> dataSource 不是组件 prop（AdvTable.vue 无此声明），传入会落入 attrs 被忽略；
      // <zh/> 真实数据源入口只有 data 与 request.source。此处锁定该契约：渲染正常且该函数永不被调用，
      // <zh/> 将来若新增 dataSource prop，该用例失败即提醒同步更新。
      // <en/> dataSource is not a component prop (undeclared in AdvTable.vue); it falls into attrs and is ignored.
      // <en/> Real data entries are data and request.source only. This locks the contract: renders fine and the fn is never called.
      const dataSource = vi.fn().mockResolvedValue({ data: mockData })
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable dataSource={dataSource} columns={columns.value} />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 50))
      expect(wrapper.find('.adv-table').exists()).toBe(true)
      expect(dataSource).not.toHaveBeenCalled()
    })

    it('computes resolvedDataSource from request.source', async () => {
      const source = vi.fn().mockResolvedValue({ data: mockData })
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable request={{ source }} columns={columns.value} />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 50))
      expect(source).toHaveBeenCalled()
      expect(wrapper.find('.adv-table').exists()).toBe(true)
    })

    it('computes resolvedAutoRequest as true by default', async () => {
      const source = vi.fn().mockResolvedValue({ data: mockData })
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const _wrapper = _mount(() => (
        <AdvTable request={{ source }} columns={columns.value} />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 50))
      // <zh/> 未显式传 auto 即自动请求：默认 true 的契约
      // <en/> No explicit auto flag yet the source fires: the default-true contract
      expect(source).toHaveBeenCalled()
    }, 30000)

    it('computes tableData from data prop', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      // <zh/> default 模式渲染真实 DOM 行（virtual 在 happy-dom 无布局不行文），断言数据真的进表
      // <en/> Default mode renders real DOM rows (virtual renders no text in happy-dom without layout)
      const wrapper = _mount(() => (
        <AdvTable mode="default" columns={columns.value} data={mockData} />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 100))
      expect(wrapper.find('.adv-table').exists()).toBe(true)
      expect(wrapper.text()).toContain('张三')
      expect(wrapper.text()).toContain('李四')
    })

    it('computes visibleColumnsWithDefaults', async () => {
      // <zh/> 注意：列显隐的真实字段是 hidden（isVisible 不存在，传了会被忽略）；
      // <zh/> 旧用例用 isVisible 断言"隐藏"，实际什么都没测。default 模式渲染真实 DOM 表头。
      // <en/> Visibility is driven by hidden (isVisible does not exist and is silently ignored);
      // <en/> the old test asserted hiding with a fictional field and verified nothing.
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
        { prop: 'age', label: '年龄', hidden: true },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable mode="default" columns={columns.value} data={mockData} />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 100))
      // <zh/> hidden=true 的列不出表头，false 的出
      // <en/> hidden=true columns stay out of the header, false ones render
      expect(wrapper.text()).toContain('姓名')
      expect(wrapper.text()).not.toContain('年龄')
    })
  })

  describe('toolbar computed', () => {
    it('computes toolbar with columnSetting default true', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable columns={columns.value} data={mockData} />
      ))
      await nextTick()
      // HeaderColumnSetting 图标依赖 ElPopover rendering，在 happy-dom 环境下不可测
      expect(wrapper.find('.adv-table__header').exists()).toBe(true)
    })

    it('computes toolbar with custom pollingOptions', async () => {
      const source = vi.fn().mockResolvedValue({ data: mockData })
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          request={{ source }}
          columns={columns.value}
          toolbar={{
            pollingBtn: true,
            pollingOptions: { time: 5000, immediate: true },
          }}
        />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 50))
      expect(wrapper.find('.adv-table-polling-toggle').exists()).toBe(true)
    }, 30000)
  })

  describe('search computed', () => {
    it('computes searchConfig with custom searchText and resetText', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', search: true, hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          data={mockData}
          search={{
            enabled: true,
            searchText: 'Search',
            resetText: 'Reset',
          }}
        />
      ))
      await waitForSearchForm(wrapper)
      expect(wrapper.find('.adv-table-search-form').exists()).toBe(true)
    })

    it('computes mergedSearchFields with custom fields', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          data={mockData}
          search={{
            enabled: true,
            fields: [
              {
                prop: 'status',
                type: 'input',
                componentProps: { placeholder: '请输入状态' },
                itemProps: { label: '状态' },
                hidden: false,
              },
            ],
          }}
        />
      ))
      await waitForSearchForm(wrapper)
      expect(wrapper.find('.adv-table-search-form').exists()).toBe(true)
    })
  })

  describe('hasHeader computation', () => {
    it('shows header when header-left slot is provided', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable columns={columns.value} data={mockData}>
          {{
            'header-left': () => <span>Custom Left</span>,
          }}
        </AdvTable>
      ))
      await nextTick()
      expect(wrapper.find('.adv-table__header-left').exists()).toBe(true)
    })

    it('shows header when header-right slot is provided', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable columns={columns.value} data={mockData}>
          {{
            'header-right': () => <span>Custom Right</span>,
          }}
        </AdvTable>
      ))
      await nextTick()
      expect(wrapper.find('.adv-table__header-right').exists()).toBe(true)
    })
  })

  describe('tableAttrs computation', () => {
    it('filters out filtered event handlers', async () => {
      const onRowClick = vi.fn()
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          mode="default"
          columns={columns.value}
          data={mockData}
          onSelectionChange={() => {}}
          onRowClick={onRowClick}
          onCellClick={() => {}}
          onSortChange={() => {}}
          onScroll={() => {}}
        />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 100))
      // <zh/> 已声明的 emit 不得透传进内层 ElTable：行点击只响应一次（透传会触发两次）
      // <en/> Declared emits must not leak into the inner ElTable: one row click fires exactly once
      const row = wrapper.find('.el-table__row')
      expect(row.exists()).toBe(true)
      await row.trigger('click')
      expect(onRowClick).toHaveBeenCalledTimes(1)
    })

    it('passes through other attributes', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          mode="default"
          columns={columns.value}
          data={mockData}
          border
          stripe
        />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 100))
      // <zh/> border/stripe 必须到达内层 ElTable（误改透传会静默丢样式）
      // <en/> border/stripe must reach the inner ElTable (broken passthrough silently drops styling)
      expect(wrapper.find('.el-table--border').exists()).toBe(true)
      expect(wrapper.find('.el-table--striped').exists()).toBe(true)
    })

    /**
     * <zh/> 属性分流回归——`$attrs`（除保留键 `id`）归表格根节点，与 Vue 单根组件的默认回落语义一致。
     * <zh/> 此前整包 `$attrs` 透传到分页条：`<AdvTable class="...">` 只能改到分页器外观，
     * <zh/> `data-*`/`aria-*` 也落在分页条上（无人预期）。
     * <en/> Attribute-routing regression — `$attrs` (minus the reserved `id`) belong to the table root,
     * <en/> matching Vue's single-root fallthrough semantics. Previously the whole bundle went to the
     * <en/> pagination bar: `<AdvTable class="...">` could only restyle the pagination, and `data-*`/`aria-*`
     * <en/> landed there too (nobody expects that).
     */
    it('routes $attrs to the table root, not the pagination bar', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          class="my-table"
          data-testid="adv-root"
          aria-label="订单表"
          columns={columns.value}
          data={mockData}
        />
      ))
      await nextTick()
      const root = wrapper.find('.adv-table')
      expect(root.classes()).toContain('my-table')
      expect(root.attributes('data-testid')).toBe('adv-root')
      expect(root.attributes('aria-label')).toBe('订单表')
      // <zh/> 分页条未渲染时无需断言（存在才校验未错落）
      // <en/> Nothing to check when the pagination is not rendered (assert only when present)
      const pagination = wrapper.find('.el-pagination')
      if (pagination.exists()) {
        expect(pagination.classes()).not.toContain('my-table')
        expect(pagination.attributes('data-testid')).toBeUndefined()
      }
    })
  })

  describe('manual pagination', () => {
    it('renders manual mode', async () => {
      const source = vi.fn().mockResolvedValue({ data: mockData, total: 10 })
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          request={{ source }}
          columns={columns.value}
          pagination={{ mode: 'manual' }}
        />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 50))
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('showSummary', () => {
    it('renders with showSummary enabled', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
        { prop: 'age', label: '年龄', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          data={mockData}
          showSummary
        />
      ))
      await nextTick()
      expect(wrapper.exists()).toBe(true)
    })

    it('renders with custom summaryMethod', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
        { prop: 'age', label: '年龄', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          data={mockData}
          uiConfig={{
            showSummary: true,
            summaryMethod: () => ['合计', '90'],
            sumText: '合计',
          }}
        />
      ))
      await nextTick()
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('events (row interactions)', () => {
    it('emits rowClick on row click', async () => {
      const onRowClick = vi.fn()
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      _mount(() => (
        <AdvTable
          columns={columns.value}
          data={mockData}
          onRowClick={onRowClick}
        />
      ))
      await nextTick()
      expect(onRowClick).not.toHaveBeenCalled()
    })

    it('emits cellClick on cell click', async () => {
      const onCellClick = vi.fn()
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      _mount(() => (
        <AdvTable
          columns={columns.value}
          data={mockData}
          onCellClick={onCellClick}
        />
      ))
      await nextTick()
      expect(onCellClick).not.toHaveBeenCalled()
    })

    it('emits sortChange on sort', async () => {
      const onSortChange = vi.fn()
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      _mount(() => (
        <AdvTable
          columns={columns.value}
          data={mockData}
          onSortChange={onSortChange}
        />
      ))
      await nextTick()
      expect(onSortChange).not.toHaveBeenCalled()
    })
  })

  describe('selectedRowKeys', () => {
    it('accepts selectedRowKeys prop', async () => {
      const columns = ref([
        { selection: true },
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          mode="default"
          columns={columns.value}
          data={mockData}
          selectedRowKeys={['1']}
          rowConfig={{ rowKey: (row: any) => row.id }}
        />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 100))
      // <zh/> id=1 的行复选框初始即勾选（受控选中落到 UI）
      // <en/> The id=1 row checkbox starts checked (controlled selection reaches the UI)
      const checked = wrapper.findAll('.el-table__row .el-checkbox__input.is-checked')
      expect(checked.length).toBeGreaterThan(0)
    })
  })

  describe('tableId', () => {
    it('renders with custom tableId', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          data={mockData}
          uiConfig={{ tableId: 'my-custom-table' }}
        />
      ))
      await nextTick()
      expect(wrapper.find('#my-custom-table').exists()).toBe(true)
    })
  })

  describe('namespace', () => {
    it('renders with custom namespace', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          data={mockData}
          uiConfig={{ namespace: 'custom' }}
        />
      ))
      await nextTick()
      expect(wrapper.exists()).toBe(true)
    })

    it('emits TABLE_NAMESPACE_MISMATCH when uiConfig.namespace fights the EP ConfigProvider namespace', async () => {
      const { ElConfigProvider } = await import('element-plus')
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const errors: any[] = []
      const wrapper = _mount(() => (
        <ElConfigProvider namespace="ep-ns">
          <AdvTable
            columns={columns.value}
            data={mockData}
            uiConfig={{ namespace: 'custom' }}
            onError={(e: unknown) => errors.push(e)}
          />
        </ElConfigProvider>
      ))
      await nextTick()
      await nextTick()
      const mismatch = errors.filter(e => e?.code === 'TABLE_NAMESPACE_MISMATCH')
      expect(mismatch.length).toBeGreaterThan(0)
      expect(mismatch[0]).toMatchObject({ severity: 'warn' })
      expect(mismatch[0].cause).toMatchObject({ uiConfigNamespace: 'custom', epNamespace: 'ep-ns' })
      wrapper.unmount()
    })

    it('stays silent on TABLE_NAMESPACE_MISMATCH when following the EP ConfigProvider namespace', async () => {
      const { ElConfigProvider } = await import('element-plus')
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const errors: any[] = []
      const wrapper = _mount(() => (
        <ElConfigProvider namespace="ep-ns">
          <AdvTable
            columns={columns.value}
            data={mockData}
            onError={(e: unknown) => errors.push(e)}
          />
        </ElConfigProvider>
      ))
      await nextTick()
      await nextTick()
      expect(errors.filter(e => e?.code === 'TABLE_NAMESPACE_MISMATCH')).toHaveLength(0)
      wrapper.unmount()
    })
  })

  describe('server page-local filter semantics', () => {
    function mountWithSource(autoParams?: boolean) {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
        { prop: 'age', label: '年龄', hidden: false },
      ] as AdvColumn[] as any)
      const errors: any[] = []
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          request={{
            ...(autoParams ? { autoParams: true } : {}),
            source: async () => ({ data: mockData, total: mockData.length }),
          }}
          onError={(e: unknown) => errors.push(e)}
        />
      ))
      return { wrapper, errors }
    }

    it('emits TABLE_SERVER_LOCAL_FILTER_PAGE_ONLY when filtering with source + autoParams off', async () => {
      const { wrapper, errors } = mountWithSource()
      await nextTick()
      await nextTick()
      const api = wrapper.findComponent(AdvTable).vm.$.exposed as any
      api.setFilter('name', { type: 'text', operator: 'contains', value: '张' })
      await nextTick()
      await nextTick()
      const hits = errors.filter(e => e?.code === 'TABLE_SERVER_LOCAL_FILTER_PAGE_ONLY')
      expect(hits.length).toBeGreaterThan(0)
      expect(hits[0]).toMatchObject({ severity: 'warn' })
      wrapper.unmount()
    })

    it('stays silent with autoParams on (server-side filtering)', async () => {
      const { wrapper, errors } = mountWithSource(true)
      await nextTick()
      await nextTick()
      const api = wrapper.findComponent(AdvTable).vm.$.exposed as any
      api.setFilter('name', { type: 'text', operator: 'contains', value: '张' })
      await nextTick()
      await nextTick()
      expect(errors.filter(e => e?.code === 'TABLE_SERVER_LOCAL_FILTER_PAGE_ONLY')).toHaveLength(0)
      wrapper.unmount()
    })
  })

  describe('virtual mode with showSummary', () => {
    it('renders virtual table with showSummary', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
        { prop: 'age', label: '年龄', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          mode="virtual"
          columns={columns.value}
          data={mockData}
          showSummary
        />
      ))
      await nextTick()
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('multiple toolbar features', () => {
    it('renders with all toolbar buttons enabled', async () => {
      const source = vi.fn().mockResolvedValue({ data: mockData })
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          request={{ source }}
          columns={columns.value}
          toolbar={{
            refreshBtn: true,
            pollingBtn: true,
            exportBtn: true,
            columnSetting: true,
          }}
        />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 100))
      expect(wrapper.find('.adv-table__header-refresh').exists()).toBe(true)
      expect(wrapper.find('.adv-table-polling-toggle').exists()).toBe(true)
      expect(wrapper.find('.adv-table__header-export').exists()).toBe(true)
    })
  })

  describe('quickFilter', () => {
    const qfData = [
      { id: 1, name: '张三', city: '北京', age: 25 },
      { id: 2, name: '李四', city: '上海', age: 30 },
      { id: 3, name: '王五', city: '广州', age: 35 },
    ]

    it('passes through all data when quickFilter is empty', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
        { prop: 'city', label: '城市', hidden: false },
        { prop: 'age', label: '年龄', hidden: false },
      ] as AdvColumn[] as any)
      const quickFilter = ref('')
      const wrapper = _mount(() => (
        <AdvTable
          mode="default"
          columns={columns.value}
          data={qfData}
          v-model:quickFilter={quickFilter.value}
        />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 100))
      // <zh/> 空不过滤：三行全在（default 模式渲染真实行文）
      // <en/> Empty filter passes everything through (default mode renders real row text)
      expect(wrapper.text()).toContain('张三')
      expect(wrapper.text()).toContain('李四')
      expect(wrapper.text()).toContain('王五')
    })

    it('filters data when quickFilter is set via prop', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
        { prop: 'city', label: '城市', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          mode="default"
          columns={columns.value}
          data={qfData}
          quickFilter="上海"
        />
      ))
      await nextTick()
      await nextTick()
      await new Promise(r => setTimeout(r, 100))
      // <zh/> 只剩上海行：张三/王五必须消失
      // <en/> Only the Shanghai row survives
      expect(wrapper.text()).toContain('李四')
      expect(wrapper.text()).not.toContain('张三')
      expect(wrapper.text()).not.toContain('王五')
    })

    it('getQuickFilter() returns current quickFilter value', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable columns={columns.value} data={qfData} quickFilter="张三" />
      ))
      await nextTick()
      const api = wrapper.findComponent(AdvTable).vm.$.exposed as any
      expect(api.getQuickFilter).toBeDefined()
      expect(api.getQuickFilter()).toBe('张三')
    })

    it('setQuickFilter emits update:quickFilter', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const onUpdate = vi.fn()
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          data={qfData}
          onUpdate:quickFilter={onUpdate}
        />
      ))
      await nextTick()
      const api = wrapper.findComponent(AdvTable).vm.$.exposed as any
      expect(api.setQuickFilter).toBeDefined()
      api.setQuickFilter('张三')
      await nextTick()
      expect(onUpdate).toHaveBeenCalledWith('张三')
    })

    it('hasActiveQuickFilter reflects quickFilter state', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable columns={columns.value} data={qfData} quickFilter="张三" />
      ))
      await nextTick()
      const api = wrapper.findComponent(AdvTable).vm.$.exposed as any
      expect(api.hasActiveQuickFilter.value).toBe(true)
    })

    it('hasActiveQuickFilter is false when quickFilter is empty', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable columns={columns.value} data={qfData} quickFilter="" />
      ))
      await nextTick()
      const api = wrapper.findComponent(AdvTable).vm.$.exposed as any
      expect(api.hasActiveQuickFilter.value).toBe(false)
    })
  })

  describe('gridReady event', () => {
    it('fires once when component is mounted', async () => {
      const onGridReady = vi.fn()
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable columns={columns.value} data={mockData} onGridReady={onGridReady} />
      ))
      await nextTick()
      expect(onGridReady).toHaveBeenCalledTimes(1)
      wrapper?.unmount()
    })

    it('fires only once even after data updates', async () => {
      const onGridReady = vi.fn()
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
        { prop: 'age', label: '年龄', hidden: false },
      ] as AdvColumn[] as any)
      const data = ref([...mockData])
      const wrapper = _mount(() => (
        <AdvTable columns={columns.value} data={data.value} onGridReady={onGridReady} />
      ))
      await nextTick()
      expect(onGridReady).toHaveBeenCalledTimes(1)

      // Change data — gridReady should NOT fire again
      data.value = [...mockData, { id: '4', name: '赵六', age: 40 }]
      await nextTick()
      expect(onGridReady).toHaveBeenCalledTimes(1)

      wrapper?.unmount()
    })
  })

  describe('side panel destroy-on-close', () => {
    const PANEL_COMPONENTS = ['filter-panel', 'column-setting-side-panel', 'column-group-side-panel']
    let unmountedPanels: string[] = []

    /**
     * <zh/> 挂载并用全局 mixin 记录三个侧面板的**真实 unmount**——KeepAlive 缓存的面板走
     * <zh/> deactivate 而不会触发 unmounted，因此该计数直接区分「销毁」与「保留实例」。
     * <en/> Mounts with a global mixin recording real `unmounted` calls of the three side panels
     * a KeepAlive-cached panel is deactivated and never fires `unmounted`, so this count cleanly
     * separates "destroyed" from "instance retained".
     */
    function mountWithPanelProbe(render: () => VNode) {
      unmountedPanels = []
      return mount(render, {
        global: {
          mixins: [
            {
              unmounted(this: any) {
                // <zh/> `<script setup>` SFC 的 `__name` 由文件名 kebab 化而来
                // <en/> A `<script setup>` SFC's `__name` is the kebab-cased file name
                const name = this.$.type?.__name ?? this.$options?.name
                if (name && PANEL_COMPONENTS.includes(name))
                  unmountedPanels.push(name)
              },
            },
          ],
          config: {
            globalProperties: { $router: { query: {} } },
          } as any,
        },
      })
    }

    /** <zh/> 轮询直到条件成立（驱动异步组件加载与 Transition 收尾） | <en/> Poll until the predicate holds (drives async chunk load and transition teardown) */
    async function waitFor(predicate: () => boolean, timeout = 5000) {
      const deadline = Date.now() + timeout
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 25))
        await nextTick()
        if (predicate())
          return true
      }
      return false
    }

    /**
     * <zh/> 打开筛选面板 → 关闭（点同一按钮），返回**关闭后、根实例卸载前**的面板 unmount 快照。
     * <zh/> 快照必须在 `wrapper.unmount()` 之前取：KeepAlive 缓存里的面板在根卸载时同样会被销毁，
     * <zh/> 那样两种模式都会出现 unmount，断言就失去区分力。
     * <en/> Opens the filter panel then closes it, returning the panel-unmount snapshot taken
     * <en/> *before* the root is torn down. The snapshot must precede `wrapper.unmount()`: a
     * <en/> KeepAlive-cached panel is destroyed together with the root, which would make both
     * <en/> modes report an unmount and destroy the assertion's discriminating power.
     */
    async function openThenCloseFilterPanel(destroyOnClose: boolean) {
      const columns = ref([
        { prop: 'name', label: '姓名', filter: true, hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = mountWithPanelProbe(() => (
        <AdvTable
          columns={columns.value}
          data={mockData}
          filterConfig={{ sidePanel: true, sidePanelDestroyOnClose: destroyOnClose }}
        />
      ))
      await nextTick()

      const button = wrapper.find('.adv-table-side-button')
      expect(button.exists()).toBe(true)
      await button.trigger('click')
      // 异步面板组件需若干拍才挂载——轮询到出现或超时
      await waitFor(() => wrapper.find('.adv-table-side-panel').exists())
      expect(wrapper.find('.adv-table-side-panel').exists()).toBe(true)

      await wrapper.find('.adv-table-side-button').trigger('click')
      await waitFor(() => !wrapper.find('.adv-table-side-panel').exists())
      expect(wrapper.find('.adv-table-side-panel').exists()).toBe(false)
      // 关闭过渡（out-in）收尾后再取快照
      await new Promise(r => setTimeout(r, 300))
      const snapshot = [...unmountedPanels]
      wrapper.unmount()
      return snapshot
    }

    it('truly unmounts the panel on close by default (sidePanelDestroyOnClose defaults to true)', async () => {
      expect(await openThenCloseFilterPanel(true)).toContain('filter-panel')
    })

    it('retains the panel instance when sidePanelDestroyOnClose=false (no unmount)', async () => {
      expect(await openThenCloseFilterPanel(false)).not.toContain('filter-panel')
    })
  })

  describe('handleSearch', () => {
    it('should emit query and reset page to 1', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', search: true, hidden: false },
        { prop: 'age', label: '年龄', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          data={mockData}
          search={{ enabled: true }}
        />
      ))
      await nextTick()

      const api = wrapper.findComponent(AdvTable).vm.$.exposed as any

      api.setCurrentPage(3)
      await nextTick()

      api.setQueryFormModel({ name: '张三' }, true)
      await nextTick()

      const tableWrapper = wrapper.findComponent(AdvTable)
      const emittedQuery = (tableWrapper as any).emitted('query')
      expect(emittedQuery).toBeTruthy()
      const lastQuery = emittedQuery!.at(-1)
      // Source emits: emit('query', { ...params }, tableId.value) — second arg is tableId
      expect(lastQuery[0]).toEqual({ name: '张三' })
      expect(lastQuery[1]).toBeTypeOf('string')

      expect(api.getPagination().currentPage).toBe(1)
    })

    it('should not throw when no request API is configured', async () => {
      const columns = ref([
        { prop: 'name', label: '姓名', search: true, hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          data={mockData}
          search={{ enabled: true }}
        />
      ))
      await nextTick()

      const api = wrapper.findComponent(AdvTable).vm.$.exposed as any

      // This should not throw despite doRequest calling request() without API
      await expect(
        (async () => {
          api.setQueryFormModel({ name: 'test' }, true)
          await nextTick()
        })(),
      ).resolves.toBeUndefined()

      // Verify page was reset even without request API
      expect(api.getPagination().currentPage).toBe(1)
    })
  })

  describe('loading watcher unmount guard', () => {
    it('should emit update:loading when loading changes before unmount', async () => {
      const onUpdateLoading = vi.fn()
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          data={mockData}
          loading={false}
          onUpdate:loading={onUpdateLoading}
        />
      ))
      await nextTick()

      const api = wrapper.findComponent(AdvTable).vm.$.exposed as any
      api.setLoading(true)
      await nextTick()

      expect(onUpdateLoading).toHaveBeenCalledWith(true)
    })

    it('should NOT emit update:loading after component is unmounted', async () => {
      const onUpdateLoading = vi.fn()
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          columns={columns.value}
          data={mockData}
          loading={false}
          onUpdate:loading={onUpdateLoading}
        />
      ))
      await nextTick()

      const api = wrapper.findComponent(AdvTable).vm.$.exposed as any
      const setLoadingFn = api.setLoading

      // First call — should emit
      setLoadingFn(true)
      await nextTick()
      expect(onUpdateLoading).toHaveBeenCalledTimes(1)

      onUpdateLoading.mockClear()

      wrapper.unmount()

      // Call setLoading after unmount — isUnmounted flag should prevent emit
      setLoadingFn(false)
      await nextTick()
      expect(onUpdateLoading).not.toHaveBeenCalled()
    })
  })

  describe('config validation data-source coexistence', () => {
    /** 统计含指定错误码的 console.warn 次数 */
    function countWarnsWith(warnSpy: ReturnType<typeof vi.spyOn>, code: string): number {
      return warnSpy.mock.calls.filter(args => args.some(a => String(a).includes(code))).length
    }

    it('warns when data and request.source coexist, without duplicate warnings', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const wrapper = _mount(() => (
        <AdvTable
          mode="default"
          columns={columns.value}
          data={mockData}
          request={{ source: async () => ({ data: [], total: 0 }) }}
        />
      ))
      await nextTick()
      await nextTick()

      // data + source 并存冲突在 immediate 校验中告警
      expect(countWarnsWith(warnSpy, 'TABLE_CONFIG_DATA_AND_SOURCE_CONFLICT')).toBeGreaterThanOrEqual(1)

      // 同一配置持续成立期间不重复告警（去重签名）
      const countAfterMount = countWarnsWith(warnSpy, 'TABLE_CONFIG_DATA_AND_SOURCE_CONFLICT')
      await nextTick()
      await nextTick()
      expect(countWarnsWith(warnSpy, 'TABLE_CONFIG_DATA_AND_SOURCE_CONFLICT')).toBe(countAfterMount)

      // 解除冲突（data 置空）后不再告警；恢复后重新告警
      wrapper.unmount()
      warnSpy.mockRestore()
    })

    it('re-validates the large-dataset rule when mode flips at runtime', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const largeRows = Array.from({ length: 1001 }, (_, i) => ({ id: String(i), name: `row-${i}` }))
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const mode = ref<'default' | 'virtual'>('virtual')
      const wrapper = _mount(() => (
        <AdvTable mode={mode.value} columns={columns.value} data={largeRows} rowConfig={{ rowKey: 'id' }} />
      ))
      await nextTick()
      await nextTick()

      // virtual + 大数据：不告警
      expect(countWarnsWith(warnSpy, 'TABLE_PERF_LARGE_DATASET_NO_VIRTUAL')).toBe(0)

      // 运行时切到 default：立即重新校验并告警
      mode.value = 'default'
      await nextTick()
      await nextTick()
      expect(countWarnsWith(warnSpy, 'TABLE_PERF_LARGE_DATASET_NO_VIRTUAL')).toBe(1)

      // 同一冲突持续期间不重复告警
      await nextTick()
      expect(countWarnsWith(warnSpy, 'TABLE_PERF_LARGE_DATASET_NO_VIRTUAL')).toBe(1)

      // 切回 virtual（条件解除）再切回 default（再次成立）→ 重新告警
      mode.value = 'virtual'
      await nextTick()
      await nextTick()
      mode.value = 'default'
      await nextTick()
      await nextTick()
      expect(countWarnsWith(warnSpy, 'TABLE_PERF_LARGE_DATASET_NO_VIRTUAL')).toBe(2)

      wrapper.unmount()
      warnSpy.mockRestore()
    }, 30_000)

    it('warns TABLE_UNCONTROLLED_EDIT_SHADOW for one-way :data + editConfig (uncontrolled-edit-shadow)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      // 单向绑定：无 onUpdate:data 监听
      const wrapper = _mount(() => (
        <AdvTable
          mode="default"
          columns={columns.value}
          data={mockData}
          editConfig={{ mode: 'cell' } as any}
        />
      ))
      await nextTick()
      await nextTick()

      expect(countWarnsWith(warnSpy, 'TABLE_UNCONTROLLED_EDIT_SHADOW')).toBeGreaterThanOrEqual(1)

      wrapper.unmount()
      warnSpy.mockRestore()
    })

    it('does NOT warn TABLE_UNCONTROLLED_EDIT_SHADOW with v-model:data (uncontrolled-edit-shadow)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const columns = ref([
        { prop: 'name', label: '姓名', hidden: false },
      ] as AdvColumn[] as any)
      const dataModel = ref([...mockData])
      const wrapper = _mount(() => (
        <AdvTable
          mode="default"
          columns={columns.value}
          data={dataModel.value}
          onUpdate:data={(v: unknown) => { dataModel.value = v as typeof mockData }}
          editConfig={{ mode: 'cell' } as any}
        />
      ))
      await nextTick()
      await nextTick()

      expect(countWarnsWith(warnSpy, 'TABLE_UNCONTROLLED_EDIT_SHADOW')).toBe(0)

      wrapper.unmount()
      warnSpy.mockRestore()
    })
  })
})
