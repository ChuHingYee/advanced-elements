import type { ProcessedColumn } from '../../../src/types/column'
import type { ToolbarConfig } from '../../../src/types/config'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import Header from '../../../src/components/header/header.vue'

const t = (key: string) => key

function createToolbar(overrides = {}): ToolbarConfig {
  return {
    columnSetting: true,
    refreshBtn: true,
    exportBtn: true,
    pollingBtn: true,
    pollingOptions: { interval: 5000 } as any,
    ...overrides,
  }
}

function createColumns(): ProcessedColumn[] {
  return [
    { key: 'name', label: 'Name', prop: 'name', hidden: false },
    { key: 'age', label: 'Age', prop: 'age', hidden: false },
  ]
}

describe('header.vue', () => {
  describe('basic rendering', () => {
    it('renders when hasColumns is true and columnSetting is enabled', () => {
      const wrapper = mount(Header, {
        props: {
          toolbar: createToolbar() as any,
          hasColumns: true,
          hasSource: true,
          isManual: false,
          columns: createColumns(),
          originColumns: createColumns(),
          originColumnsFormatMap: {},
          resetColumns: vi.fn(),
          isPolling: false,
          exporting: false,
          exportingCsv: false,
          importing: false,
          printing: false,
          t,
        } as any,
      })
      expect(wrapper.find('.adv-table__header').exists()).toBe(true)
      wrapper.unmount()
    })

    it('does not render when no header content needed', () => {
      const wrapper = mount(Header, {
        props: {
          toolbar: createToolbar({
            columnSetting: false,
            refreshBtn: false,
            exportBtn: false,
            pollingBtn: false,
          }) as any,
          hasColumns: false,
          hasSource: true,
          isManual: false,
          columns: [],
          originColumns: [],
          originColumnsFormatMap: {},
          resetColumns: vi.fn(),
          isPolling: false,
          exporting: false,
          exportingCsv: false,
          importing: false,
          printing: false,
          t,
        } as any,
      })
      expect(wrapper.find('.adv-table__header').exists()).toBe(false)
      wrapper.unmount()
    })
  })

  describe('toolbar visibility', () => {
    it('shows refresh button when refreshBtn is enabled', () => {
      const wrapper = mount(Header, {
        props: {
          toolbar: createToolbar({ refreshBtn: true }) as any,
          hasColumns: true,
          hasSource: true,
          isManual: false,
          columns: createColumns(),
          originColumns: createColumns(),
          originColumnsFormatMap: {},
          resetColumns: vi.fn(),
          isPolling: false,
          exporting: false,
          exportingCsv: false,
          importing: false,
          printing: false,
          t,
        } as any,
      })
      expect(wrapper.find('.adv-table__header-refresh').exists()).toBe(true)
      wrapper.unmount()
    })

    it('hides refresh button when refreshBtn is disabled', () => {
      const wrapper = mount(Header, {
        props: {
          toolbar: createToolbar({ refreshBtn: false }) as any,
          hasColumns: true,
          hasSource: true,
          isManual: false,
          columns: createColumns(),
          originColumns: createColumns(),
          originColumnsFormatMap: {},
          resetColumns: vi.fn(),
          isPolling: false,
          exporting: false,
          exportingCsv: false,
          importing: false,
          printing: false,
          t,
        } as any,
      })
      expect(wrapper.find('.adv-table__header-refresh').exists()).toBe(false)
      wrapper.unmount()
    })

    it('shows export button when exportBtn is enabled', () => {
      const wrapper = mount(Header, {
        props: {
          toolbar: createToolbar({ exportBtn: true }) as any,
          hasColumns: true,
          hasSource: true,
          isManual: false,
          columns: createColumns(),
          originColumns: createColumns(),
          originColumnsFormatMap: {},
          resetColumns: vi.fn(),
          isPolling: false,
          exporting: false,
          exportingCsv: false,
          importing: false,
          printing: false,
          t,
        } as any,
      })
      expect(wrapper.find('.adv-table__header-export').exists()).toBe(true)
      wrapper.unmount()
    })

    it('shows loading state when exporting', () => {
      const wrapper = mount(Header, {
        props: {
          toolbar: createToolbar({ exportBtn: true }) as any,
          hasColumns: true,
          hasSource: true,
          isManual: false,
          columns: createColumns(),
          originColumns: createColumns(),
          originColumnsFormatMap: {},
          resetColumns: vi.fn(),
          isPolling: false,
          exporting: true,
          exportingCsv: false,
          importing: false,
          printing: false,
          t,
        } as any,
      })
      expect(wrapper.find('.adv-table__header-export').classes()).toContain('adv-table__header-ghost-btn--loading')
      wrapper.unmount()
    })
  })

  describe('slots', () => {
    it('renders header-left slot', () => {
      const wrapper = mount(Header, {
        props: {
          toolbar: createToolbar() as any,
          hasColumns: true,
          hasSource: true,
          isManual: false,
          columns: createColumns(),
          originColumns: createColumns(),
          originColumnsFormatMap: {},
          resetColumns: vi.fn(),
          isPolling: false,
          exporting: false,
          exportingCsv: false,
          importing: false,
          printing: false,
          t,
        } as any,
        slots: {
          'header-left': '<span>Left Content</span>',
        },
      })
      expect(wrapper.find('.adv-table__header-left').exists()).toBe(true)
      wrapper.unmount()
    })

    it('renders header-right slot', () => {
      const wrapper = mount(Header, {
        props: {
          toolbar: createToolbar() as any,
          hasColumns: true,
          hasSource: true,
          isManual: false,
          columns: createColumns(),
          originColumns: createColumns(),
          originColumnsFormatMap: {},
          resetColumns: vi.fn(),
          isPolling: false,
          exporting: false,
          exportingCsv: false,
          importing: false,
          printing: false,
          t,
        } as any,
        slots: {
          'header-right': '<span>Right Content</span>',
        },
      })
      expect(wrapper.find('.adv-table__header-right').exists()).toBe(true)
      wrapper.unmount()
    })
  })

  describe('emits', () => {
    it('emits refresh event when refresh button clicked', async () => {
      const wrapper = mount(Header, {
        props: {
          toolbar: createToolbar({ refreshBtn: true }) as any,
          hasColumns: true,
          hasSource: true,
          isManual: false,
          columns: createColumns(),
          originColumns: createColumns(),
          originColumnsFormatMap: {},
          resetColumns: vi.fn(),
          isPolling: false,
          exporting: false,
          exportingCsv: false,
          importing: false,
          printing: false,
          t,
        } as any,
      })

      const refreshBtn = wrapper.find('.adv-table__header-refresh')
      await refreshBtn.trigger('click')
      // <zh/> 刷新按钮必须发出 refresh，否则工具栏刷新链路静默断裂
      // <en/> The refresh button must emit refresh, otherwise the toolbar refresh chain silently breaks
      expect(wrapper.emitted('refresh')).toHaveLength(1)

      wrapper.unmount()
    })

    it('emits exportExcel event when export button clicked', async () => {
      const wrapper = mount(Header, {
        props: {
          toolbar: createToolbar({ exportBtn: true }) as any,
          hasColumns: true,
          hasSource: true,
          isManual: false,
          columns: createColumns(),
          originColumns: createColumns(),
          originColumnsFormatMap: {},
          resetColumns: vi.fn(),
          isPolling: false,
          exporting: false,
          exportingCsv: false,
          importing: false,
          printing: false,
          t,
        } as any,
      })

      const exportBtn = wrapper.find('.adv-table__header-export')
      await exportBtn.trigger('click')
      // <zh/> 导出按钮必须发出 exportExcel，否则导出链路静默断裂
      // <en/> The export button must emit exportExcel, otherwise the export chain silently breaks
      expect(wrapper.emitted('exportExcel')).toHaveLength(1)

      wrapper.unmount()
    })

    it('emits update:isPolling when polling toggled', async () => {
      const wrapper = mount(Header, {
        props: {
          toolbar: createToolbar({ pollingBtn: true }) as any,
          hasColumns: true,
          hasSource: true,
          isManual: false,
          columns: createColumns(),
          originColumns: createColumns(),
          originColumnsFormatMap: {},
          resetColumns: vi.fn(),
          isPolling: false,
          exporting: false,
          exportingCsv: false,
          importing: false,
          printing: false,
          t,
        } as any,
      })

      // <zh/> 点击轮询开关 → defineModel 写回 update:isPolling(true)；不断言则双向绑定断裂无人知晓
      // <en/> Toggling writes update:isPolling(true) back through defineModel; without the assertion a broken two-way binding goes unnoticed
      const toggle = wrapper.find('.adv-table-polling-toggle')
      expect(toggle.exists()).toBe(true)
      await toggle.trigger('click')
      expect(wrapper.emitted('update:isPolling')).toEqual([[true]])

      wrapper.unmount()
    })
  })

  describe('hasHeader computed', () => {
    it('returns false when no header content', () => {
      const wrapper = mount(Header, {
        props: {
          toolbar: createToolbar({
            columnSetting: false,
            refreshBtn: false,
            exportBtn: false,
            pollingBtn: false,
          }) as any,
          hasColumns: false,
          hasSource: true,
          isManual: false,
          columns: [],
          originColumns: [],
          originColumnsFormatMap: {},
          resetColumns: vi.fn(),
          isPolling: false,
          exporting: false,
          exportingCsv: false,
          importing: false,
          printing: false,
          t,
        } as any,
      })
      expect(wrapper.find('.adv-table__header').exists()).toBe(false)
      wrapper.unmount()
    })
  })
})
