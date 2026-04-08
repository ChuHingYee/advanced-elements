import { mount } from '@vue/test-utils'
import axe from 'axe-core'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import AdvTable from '../../src/AdvTable.vue'
import { structuralAxeRules, waitForRenderer } from './axe-helpers'
import '../components/__harness__/layout-mock'

import '../../src/components/table-renderer/TableRenderer.vue'
import '../../src/components/table-virtual-renderer/TableVirtualRenderer.vue'

function mountTable(mode: 'default' | 'virtual', data: Record<string, string>[], host: HTMLElement) {
  return mount(defineComponent({
    setup() {
      return () => h(AdvTable, {
        mode,
        height: 400,
        columns: [
          { key: 'a', prop: 'a', label: 'A', width: 100 },
          { key: 'b', prop: 'b', label: 'B', width: 100 },
        ],
        data,
      })
    },
  }), { attachTo: host })
}

const hierarchyRules = ['aria-required-children', 'aria-required-parent']

describe.each(['default', 'virtual'] as const)('axe real: %s', (mode) => {
  it.each([
    { state: 'populated', data: [{ a: '1', b: '2' }] },
    { state: 'empty', data: [] },
  ])('scans $state render output', async ({ data }) => {
    const host = document.createElement('div')
    document.body.append(host)
    const wrapper = mountTable(mode, data, host)
    try {
      await waitForRenderer(wrapper)
      expect(wrapper.find('.adv-table__main').exists()).toBe(true)
      expect(wrapper.findAll('th, [role="columnheader"]').length).toBeGreaterThan(0)
      if (data.length > 0)
        expect(wrapper.findAll('.el-table__row, .el-table-v2__row').length).toBeGreaterThan(0)

      const results = await axe.run(host, {
        rules: { 'color-contrast': { enabled: false } },
      })
      expect(results.violations.map(({ id, nodes }) => ({
        id,
        nodes: nodes.map(({ target, html, failureSummary }) => ({ target, html, failureSummary })),
      }))).toEqual([])
      expect(results.incomplete.filter(result => hierarchyRules.includes(result.id))).toEqual([])
      expect(results.passes.map(result => result.id)).toEqual(expect.arrayContaining(hierarchyRules))
      expect(structuralAxeRules(wrapper.html())).toEqual([])
    }
    finally {
      wrapper.unmount()
      host.remove()
    }
  })
})
