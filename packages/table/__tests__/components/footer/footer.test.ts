import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Footer from '../../../src/components/footer/footer.vue'

const t = (key: string) => key

describe('footer.vue', () => {
  describe('basic rendering', () => {
    it('renders when paginationEnabled is true', () => {
      const wrapper = mount(Footer, {
        props: {
          paginationEnabled: true,
          paginationClass: '',
          isManual: false,
          hasMore: false,
          loading: false,
          t,
          tableAttrs: {},
          currentPage: 1,
          pageSize: 10,
          pageSizes: [10, 20, 50, 100],
          layout: 'total, sizes, prev, pager, next',
          total: 100,
          hasFooterSlot: false,
          hasFooterExtraSlot: false,
        },
      })
      expect(wrapper.exists()).toBe(true)
      wrapper.unmount()
    })

    it('renders when hasFooterSlot is true', () => {
      const wrapper = mount(Footer, {
        props: {
          paginationEnabled: false,
          paginationClass: '',
          isManual: false,
          hasMore: false,
          loading: false,
          t,
          tableAttrs: {},
          currentPage: 1,
          pageSize: 10,
          pageSizes: [10, 20, 50, 100],
          layout: 'total, sizes, prev, pager, next',
          total: 100,
          hasFooterSlot: true,
          hasFooterExtraSlot: false,
        },
        slots: {
          footer: () => 'Footer Content',
        },
      })
      expect(wrapper.exists()).toBe(true)
      wrapper.unmount()
    })

    it('does not render when no pagination and no footer slot', () => {
      const wrapper = mount(Footer, {
        props: {
          paginationEnabled: false,
          paginationClass: '',
          isManual: false,
          hasMore: false,
          loading: false,
          t,
          tableAttrs: {},
          currentPage: 1,
          pageSize: 10,
          pageSizes: [10, 20, 50, 100],
          layout: 'total, sizes, prev, pager, next',
          total: 100,
          hasFooterSlot: false,
          hasFooterExtraSlot: false,
        },
      })
      expect(wrapper.find('.adv-table__page').exists()).toBe(false)
      wrapper.unmount()
    })
  })

  describe('manual mode - load more', () => {
    it('renders load more button when isManual and hasMore', () => {
      const wrapper = mount(Footer, {
        props: {
          paginationEnabled: true,
          paginationClass: '',
          isManual: true,
          hasMore: true,
          loading: false,
          t,
          tableAttrs: {},
          currentPage: 1,
          pageSize: 10,
          pageSizes: [10, 20, 50, 100],
          layout: 'total, sizes, prev, pager, next',
          total: 100,
          hasFooterSlot: false,
          hasFooterExtraSlot: false,
        },
      })
      expect(wrapper.find('button').exists()).toBe(true)
      wrapper.unmount()
    })

    it('renders loading state', () => {
      const wrapper = mount(Footer, {
        props: {
          paginationEnabled: true,
          paginationClass: '',
          isManual: true,
          hasMore: true,
          loading: true,
          t,
          tableAttrs: {},
          currentPage: 1,
          pageSize: 10,
          pageSizes: [10, 20, 50, 100],
          layout: 'total, sizes, prev, pager, next',
          total: 100,
          hasFooterSlot: false,
          hasFooterExtraSlot: false,
        },
      })
      expect(wrapper.find('button').exists()).toBe(true)
      wrapper.unmount()
    })

    it('renders no more text when not hasMore and not loading', () => {
      const wrapper = mount(Footer, {
        props: {
          paginationEnabled: true,
          paginationClass: '',
          isManual: true,
          hasMore: false,
          loading: false,
          t,
          tableAttrs: {},
          currentPage: 1,
          pageSize: 10,
          pageSizes: [10, 20, 50, 100],
          layout: 'total, sizes, prev, pager, next',
          total: 100,
          hasFooterSlot: false,
          hasFooterExtraSlot: false,
        },
      })
      expect(wrapper.text()).toContain('table.noMore')
      wrapper.unmount()
    })

    it('emits loadMore event', async () => {
      const wrapper = mount(Footer, {
        props: {
          paginationEnabled: true,
          paginationClass: '',
          isManual: true,
          hasMore: true,
          loading: false,
          t,
          tableAttrs: {},
          currentPage: 1,
          pageSize: 10,
          pageSizes: [10, 20, 50, 100],
          layout: 'total, sizes, prev, pager, next',
          total: 100,
          hasFooterSlot: false,
          hasFooterExtraSlot: false,
        },
      })

      const btn = wrapper.find('button')
      await btn.trigger('click')
      // <zh/> 点击必须恰好触发一次 loadMore，否则 manual 加载更多链路静默断裂
      // <en/> The click must emit loadMore exactly once, otherwise the manual load-more chain silently breaks
      expect(wrapper.emitted('loadMore')).toHaveLength(1)

      wrapper.unmount()
    })
  })

  describe('pagination', () => {
    it('renders pagination with total > 0', () => {
      const wrapper = mount(Footer, {
        props: {
          paginationEnabled: true,
          paginationClass: '',
          isManual: false,
          hasMore: false,
          loading: false,
          t,
          tableAttrs: {},
          currentPage: 1,
          pageSize: 10,
          pageSizes: [10, 20, 50, 100],
          layout: 'total, sizes, prev, pager, next',
          total: 100,
          hasFooterSlot: false,
          hasFooterExtraSlot: false,
        },
      })
      expect(wrapper.find('.el-pagination').exists()).toBe(true)
      wrapper.unmount()
    })

    it('does not render pagination with total = 0', () => {
      const wrapper = mount(Footer, {
        props: {
          paginationEnabled: true,
          paginationClass: '',
          isManual: false,
          hasMore: false,
          loading: false,
          t,
          tableAttrs: {},
          currentPage: 1,
          pageSize: 10,
          pageSizes: [10, 20, 50, 100],
          layout: 'total, sizes, prev, pager, next',
          total: 0,
          hasFooterSlot: false,
          hasFooterExtraSlot: false,
        },
      })
      expect(wrapper.find('.el-pagination').exists()).toBe(false)
      wrapper.unmount()
    })

    it('emits update:currentPage', async () => {
      const wrapper = mount(Footer, {
        props: {
          paginationEnabled: true,
          paginationClass: '',
          isManual: false,
          hasMore: false,
          loading: false,
          t,
          tableAttrs: {},
          currentPage: 1,
          pageSize: 10,
          pageSizes: [10, 20, 50, 100],
          layout: 'total, sizes, prev, pager, next',
          total: 100,
          hasFooterSlot: false,
          hasFooterExtraSlot: false,
        },
      })

      // <zh/> ElPagination 用 kebab 口径，Footer 必须以 camel 口径转发（源码注释约定的归一化契约）
      // <en/> ElPagination speaks kebab; Footer must forward in camel (the normalization contract in source comments)
      const pager = wrapper.findComponent({ name: 'ElPagination' })
      expect(pager.exists()).toBe(true)
      await pager.vm.$emit('update:current-page', 2)
      expect(wrapper.emitted('update:currentPage')).toEqual([[2]])

      wrapper.unmount()
    })

    it('emits update:pageSize', async () => {
      const wrapper = mount(Footer, {
        props: {
          paginationEnabled: true,
          paginationClass: '',
          isManual: false,
          hasMore: false,
          loading: false,
          t,
          tableAttrs: {},
          currentPage: 1,
          pageSize: 10,
          pageSizes: [10, 20, 50, 100],
          layout: 'total, sizes, prev, pager, next',
          total: 100,
          hasFooterSlot: false,
          hasFooterExtraSlot: false,
        },
      })

      const pager = wrapper.findComponent({ name: 'ElPagination' })
      expect(pager.exists()).toBe(true)
      await pager.vm.$emit('update:page-size', 20)
      expect(wrapper.emitted('update:pageSize')).toEqual([[20]])

      wrapper.unmount()
    })
  })

  describe('paginationClass', () => {
    it('applies string class', () => {
      const wrapper = mount(Footer, {
        props: {
          paginationEnabled: true,
          paginationClass: 'custom-class',
          isManual: false,
          hasMore: false,
          loading: false,
          t,
          tableAttrs: {},
          currentPage: 1,
          pageSize: 10,
          pageSizes: [10, 20, 50, 100],
          layout: 'total, sizes, prev, pager, next',
          total: 100,
          hasFooterSlot: false,
          hasFooterExtraSlot: false,
        },
      })
      expect(wrapper.find('.adv-table__page').classes()).toContain('custom-class')
      wrapper.unmount()
    })

    it('applies array class', () => {
      const wrapper = mount(Footer, {
        props: {
          paginationEnabled: true,
          paginationClass: ['class-one', 'class-two'],
          isManual: false,
          hasMore: false,
          loading: false,
          t,
          tableAttrs: {},
          currentPage: 1,
          pageSize: 10,
          pageSizes: [10, 20, 50, 100],
          layout: 'total, sizes, prev, pager, next',
          total: 100,
          hasFooterSlot: false,
          hasFooterExtraSlot: false,
        },
      })
      expect(wrapper.find('.adv-table__page').classes()).toContain('class-one')
      expect(wrapper.find('.adv-table__page').classes()).toContain('class-two')
      wrapper.unmount()
    })

    it('applies object class', () => {
      const wrapper = mount(Footer, {
        props: {
          paginationEnabled: true,
          paginationClass: { 'active-class': true, 'inactive-class': false },
          isManual: false,
          hasMore: false,
          loading: false,
          t,
          tableAttrs: {},
          currentPage: 1,
          pageSize: 10,
          pageSizes: [10, 20, 50, 100],
          layout: 'total, sizes, prev, pager, next',
          total: 100,
          hasFooterSlot: false,
          hasFooterExtraSlot: false,
        },
      })
      expect(wrapper.find('.adv-table__page').classes()).toContain('active-class')
      wrapper.unmount()
    })
  })

  describe('elementSize', () => {
    it('applies small size', () => {
      const wrapper = mount(Footer, {
        props: {
          paginationEnabled: true,
          paginationClass: '',
          isManual: false,
          hasMore: false,
          loading: false,
          t,
          tableAttrs: {},
          elementSize: 'small',
          currentPage: 1,
          pageSize: 10,
          pageSizes: [10, 20, 50, 100],
          layout: 'total, sizes, prev, pager, next',
          total: 100,
          hasFooterSlot: false,
          hasFooterExtraSlot: false,
        },
      })
      expect(wrapper.find('.el-pagination').exists()).toBe(true)
      wrapper.unmount()
    })
  })

  describe('paginationRef', () => {
    it('renders with paginationRef', () => {
      const wrapper = mount(Footer, {
        props: {
          paginationEnabled: true,
          paginationClass: '',
          isManual: false,
          hasMore: false,
          loading: false,
          t,
          tableAttrs: {},
          paginationRef: { value: {} },
          currentPage: 1,
          pageSize: 10,
          pageSizes: [10, 20, 50, 100],
          layout: 'total, sizes, prev, pager, next',
          total: 100,
          hasFooterSlot: false,
          hasFooterExtraSlot: false,
        },
      })
      expect(wrapper.find('.el-pagination').exists()).toBe(true)
      wrapper.unmount()
    })
  })

  describe('shouldRender computed', () => {
    it('renders when hasFooterSlot is true even without pagination', () => {
      const wrapper = mount(Footer, {
        props: {
          paginationEnabled: false,
          paginationClass: '',
          isManual: false,
          hasMore: false,
          loading: false,
          t,
          tableAttrs: {},
          currentPage: 1,
          pageSize: 10,
          pageSizes: [10, 20, 50, 100],
          layout: 'total, sizes, prev, pager, next',
          total: 100,
          hasFooterSlot: true,
          hasFooterExtraSlot: false,
        },
        slots: {
          footer: () => 'Footer Content',
        },
      })
      expect(wrapper.find('.adv-table__page').exists()).toBe(true)
      wrapper.unmount()
    })
  })
})
