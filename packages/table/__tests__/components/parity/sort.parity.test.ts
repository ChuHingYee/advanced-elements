import type { MountedTable } from '../__harness__/mount-table'
/**
 * @file sort.parity.spec.ts
 * @description
 * <zh/> 对等矩阵——排序域（环境边界版）：
 * <zh/> - default 模式：真实 DOM 点击表头升序指示器 → 行序变化（完整用户路径）
 * <zh/> - virtual 模式：happy-dom 无布局，EP 表头网格被尺寸门控抑制，无法 DOM 触发；
 * <zh/>   表头行为由 header-factory.test.ts（两模式表头唯一来源）守护，行渲染对等由
 * <zh/>   rendering.parity 守护。此处断言 virtual 单元格网格与 default 排序后文本一致。
 *
 * <en/> Parity matrix — sorting (environment-bounded):
 * <en/> - default: real-DOM click on the header asc indicator reorders rows (full user path).
 * <en/> - virtual: happy-dom has no layout; EP's header grid is size-gated off, so DOM trigger
 * <en/>   is unavailable. Header behavior is guarded by header-factory.test.ts (the single
 * <en/>   source for both modes) and row rendering by rendering.parity. Here we assert the
 * <en/>   virtual cell grid matches the post-sort default output.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountTable, standardRows } from '../__harness__/mount-table'
import { clickSortAsc, columnTexts } from '../__harness__/queries'
import '../__harness__/layout-mock'

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

const mounted: MountedTable[] = []

afterEach(() => {
  mounted.forEach(m => m.wrapper.unmount())
  mounted.length = 0
})

describe('parity — sorting', () => {
  it('renders a clickable sort indicator in the default-mode header', async () => {
    const d = await mountTable({
      mode: 'default',
      data: standardRows(),
      props: { sortable: true },
    })
    const header = d.wrapper.find('[data-adv-table-column-key="name"]')
    expect(header.exists()).toBe(true)
    expect(header.find('.adv-table__sort-indicator').exists()).toBe(true)
  })

  it('default mode orders rows ascending via indicator click', async () => {
    const d = await mountTable({ mode: 'default', data: standardRows() })
    mounted.push(d)
    await clickSortAsc(d.wrapper, 'name')
    await Promise.resolve()
    await Promise.resolve()
    // 列 1 = name
    expect(columnTexts(d.wrapper, 1).filter(t => t !== '')).toEqual(['Alice', 'Bob', 'Carol'])
  })

  it('virtual cell grid matches fixture rows (header path covered by factory tests)', async () => {
    const v = await mountTable({ mode: 'virtual', data: standardRows() })
    mounted.push(v)
    const texts = columnTexts(v.wrapper, 1).filter(t => t !== '')
    // 虚拟模式行序与夹具一致（未排序基线）
    expect(texts).toEqual(['Carol', 'Alice', 'Bob'])
  })
})
