import type { CopyApi } from '../../../src/composables/shared/use-copy-api'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { h, provide, ref } from 'vue'
import { CopyableCell } from '../../../src/components/cell-renderers/copyable-cell'
import { advCopyKey } from '../../../src/composables/shared/use-copy-api'

vi.mock('../../../src/utils/copy', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(true),
}))

function createWrapperWithProvider(props: Record<string, any>, slotContent = 'Content') {
  const copied = ref(false)
  const mockApi: CopyApi = {
    copied,
    handleCopyClick: vi.fn(),
  }

  const Parent = {
    setup() {
      provide(advCopyKey, mockApi)
      return () => h(CopyableCell, props, () => slotContent)
    },
  }

  const wrapper = mount(Parent)
  return { wrapper, mockApi, copied }
}

describe('copyable-cell.tsx', () => {
  describe('basic rendering', () => {
    it('renders with slot content', () => {
      const { wrapper } = createWrapperWithProvider({ cellData: 'test' })
      expect(wrapper.find('.adv-table__cell-copyable').exists()).toBe(true)
      wrapper.unmount()
    })

    it('renders with string cellData', () => {
      // <zh/> 复制格显示 slot 内容，cellData 只进复制载荷：断言点击复制带走原值
      // <en/> Copyable cells display slot content while cellData feeds the copy payload: assert the click carries the raw value
      const { wrapper, mockApi } = createWrapperWithProvider({ cellData: 'test string' })
      return wrapper.find('.adv-table__cell-copyable-icon').trigger('click').then(() => {
        expect(mockApi.handleCopyClick).toHaveBeenCalledWith('test string', false, '', undefined)
        wrapper.unmount()
      })
    })

    it('renders with number cellData', () => {
      const { wrapper, mockApi } = createWrapperWithProvider({ cellData: 123 })
      return wrapper.find('.adv-table__cell-copyable-icon').trigger('click').then(() => {
        // <zh/> 复制载荷恒为字符串（剪贴板只要文本），数字 123 进去出来 '123'
        // <en/> Copy payload is always a string (clipboard takes text): 123 in, '123' out
        expect(mockApi.handleCopyClick).toHaveBeenCalledWith('123', false, '', undefined)
        wrapper.unmount()
      })
    })
  })

  describe('icon rendering', () => {
    it('renders copy icon', () => {
      const { wrapper } = createWrapperWithProvider({ cellData: 'test' })
      expect(wrapper.find('.adv-table__cell-copyable-icon').exists()).toBe(true)
      wrapper.unmount()
    })
  })

  describe('shared copy integration', () => {
    it('calls handleCopyClick on icon click', async () => {
      const { wrapper, mockApi } = createWrapperWithProvider({ cellData: 'test' })
      await wrapper.find('.adv-table__cell-copyable-icon').trigger('click')
      expect(mockApi.handleCopyClick).toHaveBeenCalledWith(
        'test',
        false,
        '',
        undefined,
      )
      wrapper.unmount()
    })

    it('passes copyHeaders and columnLabel to handleCopyClick', async () => {
      const { wrapper, mockApi } = createWrapperWithProvider({
        cellData: 'value',
        copyHeaders: true,
        columnLabel: 'Name',
      })
      await wrapper.find('.adv-table__cell-copyable-icon').trigger('click')
      expect(mockApi.handleCopyClick).toHaveBeenCalledWith(
        'value',
        true,
        'Name',
        undefined,
      )
      wrapper.unmount()
    })

    it('shows copied icon class when shared copied is true', async () => {
      const { wrapper, copied } = createWrapperWithProvider({ cellData: 'test' })
      copied.value = true
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.adv-table__cell-copyable-icon--copied').exists()).toBe(true)
      wrapper.unmount()
    })
  })

  describe('slot content', () => {
    it('renders default slot', () => {
      const { wrapper } = createWrapperWithProvider({ cellData: 'test' }, 'Slot Text')
      expect(wrapper.text()).toContain('Slot Text')
      wrapper.unmount()
    })
  })

  describe('without shared copy provider', () => {
    it('renders without errors', () => {
      const wrapper = mount(CopyableCell, {
        props: { cellData: 'test' },
        slots: { default: 'Content' },
      })
      // <zh/> 无 provider 回退路径：图标与内容仍渲染，点击不抛错
      // <en/> No-provider fallback: icon and content still render, clicks never throw
      expect(wrapper.find('.adv-table__cell-copyable-icon').exists()).toBe(true)
      expect(wrapper.text()).toContain('Content')
      wrapper.unmount()
    })
  })

  describe('name', () => {
    it('has correct name', () => {
      expect(CopyableCell.name).toBe('AdvCopyableCell')
    })
  })
})
