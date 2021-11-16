import { createLocalVue, shallowMount } from '@vue/test-utils'
import ElementUI from 'element-ui'
import AdvTable from '../src/table'

describe('AdvTable', () => {
  let vm
  afterEach(() => {
    vm.$destroy && vm.$destroy()
    vm.$el && vm.$el.parentNode && vm.$el.parentNode.removeChild(vm.$el)
  })
  const localVue = createLocalVue()
  localVue.use(ElementUI)
  it('table init', () => {
    const wrapper = shallowMount(AdvTable, {
      localVue,
      propsData: {
        source: [
          {
            name: 'test',
          },
        ],
      },
    })
    vm = wrapper.vm
    const tableDiv = wrapper.findComponent({
      name: 'AdvTable',
    })
    expect(tableDiv.exists()).toBe(true)
  })
  it('table init localPage and localSize from query', () => {
    const $route = {
      query: {
        p: 8,
        s: 10,
        a: 1,
        b: 2,
      },
      path: '',
    }
    const loadFn = jest.fn(() =>
      Promise.resolve([
        {
          name: 'test',
        },
      ])
    )
    const wrapper = shallowMount(AdvTable, {
      localVue,
      propsData: {
        source: loadFn,
        isRecord: true,
      },
      mocks: {
        $route,
      },
    })
    vm = wrapper.vm
    expect(vm.localPageIndex).toBe(8)
    expect(vm.localPageSize).toBe(10)
    expect(loadFn).toBeCalled()
  })
  it('table init with not auto', () => {
    const loadFn = jest.fn(() =>
      Promise.resolve([
        {
          name: 'test',
        },
      ])
    )
    const wrapper = shallowMount(AdvTable, {
      localVue,
      propsData: {
        source: loadFn,
        auto: false,
      },
    })
    vm = wrapper.vm
    expect(loadFn).not.toBeCalled()
    vm.refresh()
    expect(loadFn).toBeCalled()
  })
  it('table init with isManual', async () => {
    const loadFn = jest.fn(() =>
      Promise.resolve([
        {
          name: 'test',
        },
      ])
    )
    const wrapper = shallowMount(AdvTable, {
      localVue,
      propsData: {
        source: loadFn,
        isManual: true,
      },
    })
    vm = wrapper.vm
    expect(loadFn).toBeCalled()
    const tableDiv = wrapper.findComponent({
      name: 'AdvTable',
    })
    expect(tableDiv.exists()).toBe(true)
    const button = tableDiv.findComponent({
      name: 'ElButton',
    })
    await button.trigger('click')
    expect(loadFn).toBeCalled()
  })
  it('table setting loading', async () => {
    const wrapper = shallowMount(AdvTable, {
      localVue,
      propsData: {
        source: [
          {
            name: 'test',
          },
        ],
      },
    })
    vm = wrapper.vm
    expect(vm.localLoading).toBe(false)
    vm.setLoading(true)
    expect(vm.localLoading).toBe(true)
  })
})
