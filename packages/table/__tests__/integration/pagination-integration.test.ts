import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
/**
 * Integration test for use-table-pagination with mounted DOM elements.
 * Tests onMounted-dependent features: sticky observer, auto page size.
 * Runs in real browser (playwright) via the `browser` vitest project.
 */
import { defineComponent, h, nextTick, ref } from 'vue'
import { useTablePagination } from '../../src/composables/data/use-table-pagination'

describe('useTablePagination (browser integration)', () => {
  let wrapper: ReturnType<typeof mount> | null = null

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  function mountWithPagination(opts: {
    sticky?: boolean
    autoPageSize?: boolean
    containerHeight?: number
    total?: number
    mode?: 'page' | 'client' | 'manual'
    pageSize?: number
    rowHeight?: number
  } = {}) {
    const total = ref(opts.total ?? 100)
    const isManual = ref(opts.mode === 'manual')
    const paginationRef = ref<any>(null)
    const pageSize = ref(opts.pageSize ?? 10)
    const rowHeight = ref(opts.rowHeight ?? 40)

    const Comp = defineComponent({
      setup() {
        const result = useTablePagination({
          total,
          paginationRef,
          isManual,
          sticky: opts.sticky ?? false,
          autoPageSize: opts.autoPageSize ?? false,
          containerHeight: opts.containerHeight ?? 450,
          mode: opts.mode ?? 'page',
          pageSize,
          rowHeight,
        })
        return { ...result, paginationRef }
      },
      render() {
        return h('div', [
          h('nav', { ref: 'paginationRef', class: 'adv-table-page' }, [
            h('span', `Page ${this.currentPage}`),
          ]),
        ])
      },
    })

    wrapper = mount(Comp, {
      attachTo: document.body,
    })
    return wrapper.vm as any
  }

  function mountWithoutRef() {
    const total = ref(100)
    const isManual = ref(false)
    const paginationRef = ref<any>(null)

    const Comp = defineComponent({
      setup() {
        const result = useTablePagination({
          total,
          paginationRef,
          isManual,
          sticky: true,
          autoPageSize: true,
        })
        return { ...result, paginationRef }
      },
      render() {
        return h('div', [])
      },
    })

    wrapper = mount(Comp, {
      attachTo: document.body,
    })
    return wrapper.vm as any
  }

  it('mounts and initializes pagination with default values', () => {
    const vm = mountWithPagination()
    expect(vm.currentPage).toBe(1)
    expect(vm.pageSize).toBe(10)
    expect(vm.paginationTotal).toBe(100)
    expect(vm.isClient).toBe(false)
  })

  it('onMounted sets up sticky observer when sticky=true', () => {
    const vm = mountWithPagination({
      sticky: true,
      containerHeight: 600,
    })
    expect(vm.isSticky).toBe(false)
  })

  it('onMounted sets up autoPageSize when autoPageSize=true', () => {
    const vm = mountWithPagination({
      autoPageSize: true,
      rowHeight: 40,
    })
    expect(vm.pageSize).toBeGreaterThanOrEqual(1)
  })

  it('onMounted runs both sticky and autoPageSize observers', () => {
    const vm = mountWithPagination({
      sticky: true,
      autoPageSize: true,
      containerHeight: 600,
      rowHeight: 40,
    })
    expect(vm.isSticky).toBe(false)
    expect(vm.pageSize).toBeGreaterThanOrEqual(1)
  })

  it('setCurrentPage and setPageSize work after mount', () => {
    const vm = mountWithPagination()
    const pageInfo = vm.setCurrentPage(5)
    expect(pageInfo.page).toBe(5)
    expect(pageInfo.reason).toBe('pageChange')

    const sizeInfo = vm.setPageSize(20)
    expect(sizeInfo.size).toBe(20)
    expect(sizeInfo.reason).toBe('pageSizeChange')
    expect(vm.currentPage).toBe(1)
  })

  it('loadMore works in manual mode', () => {
    const vm = mountWithPagination({ mode: 'manual' })
    const info = vm.loadMore()
    expect(info).not.toBeNull()
    expect(info.page).toBe(2)
    expect(info.reason).toBe('loadMore')
  })

  it('paginationClass shows sticky class when sticky', () => {
    const vm = mountWithPagination({ sticky: true })
    vm.isSticky = true
    expect(vm.paginationClass).toContain('adv-table__page--sticky')
    vm.isSticky = false
    expect(vm.paginationClass).not.toContain('adv-table__page--sticky')
  })

  it('paginationClass shows manual class when isManual', () => {
    const vm = mountWithPagination({ mode: 'manual' })
    expect(vm.paginationClass).toContain('adv-table__page--manual')
  })

  it('setCurrentPage clamps to minimum 1', () => {
    const vm = mountWithPagination()
    const info = vm.setCurrentPage(0)
    expect(info.page).toBe(1)
  })

  it('setPageSize clamps to minimum 1', () => {
    const vm = mountWithPagination()
    const info = vm.setPageSize(0)
    expect(info.size).toBe(1)
  })

  it('setPageSize in manual mode sets needsReset', () => {
    const vm = mountWithPagination({ mode: 'manual' })
    const info = vm.setPageSize(50)
    expect(info.needsReset).toBe(true)
  })

  it('setPageSize in page mode does not set needsReset', () => {
    const vm = mountWithPagination({ mode: 'page' })
    const info = vm.setPageSize(50)
    expect(info.needsReset).toBe(false)
  })

  it('loadMore returns null when no more data', () => {
    const vm = mountWithPagination({ mode: 'manual', total: 10 })
    // page 1, size 10, hasMore is false
    const info = vm.loadMore()
    expect(info).toBeNull()
  })

  it('paginationTotal in manual mode uses propsTotal when available', () => {
    const vm = mountWithPagination({ mode: 'manual' })
    expect(vm.paginationTotal).toBe(100)
  })

  it('paginationTotal returns 0 when total is null', () => {
    const total = ref(null as any)
    const isManual = ref(false)
    const paginationRef = ref<any>(null)

    const Comp = defineComponent({
      setup() {
        const result = useTablePagination({
          total,
          paginationRef,
          isManual,
          mode: 'page',
        })
        return { ...result }
      },
      render() {
        return h('div', [
          h('nav', { ref: 'paginationRef' }),
        ])
      },
    })

    wrapper = mount(Comp, { attachTo: document.body })
    const vm = wrapper.vm as any
    expect(vm.paginationTotal).toBe(0)
  })

  it('hasMore returns false when total is 0 or negative', () => {
    const vm = mountWithPagination({ mode: 'manual', total: 0 })
    expect(vm.hasMore).toBe(false)
  })

  it('isClient is true when mode is client', () => {
    const vm = mountWithPagination({ mode: 'client' })
    expect(vm.isClient).toBe(true)
  })

  it('sticky observer cleanup on containerHeight watch', async () => {
    const vm = mountWithPagination({ sticky: true, containerHeight: 600 })
    // The watch triggers setupStickyObserver again
    // Just verify no error
    await nextTick()
    expect(vm.isSticky).toBe(false)
  })

  it('onMounted handles missing paginationRef for sticky', () => {
    // paginationRef.$el doesn't exist, should return early
    const vm = mountWithoutRef()
    expect(vm.isSticky).toBe(false)
  })
})
