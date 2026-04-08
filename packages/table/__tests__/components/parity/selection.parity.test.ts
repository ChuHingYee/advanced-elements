import type { MountedTable } from '../__harness__/mount-table'
/**
 * @file selection.parity.spec.ts
 * @description
 * <zh/> 对等矩阵——选择域（环境边界版）：
 * <zh/> - 两模式均断言行复选框存在且初始未选（单元格管线对等）
 * <zh/> - default 模式：全选复选框点击 → 全部行复选框选中（完整用户路径）
 * <zh/> - virtual 模式表头受 happy-dom 尺寸门控抑制，全选行为由 selection-v2-column 既有测试守护；
 * <zh/>   此处仅做行级复选框渲染对等。
 *
 * <en/> Parity matrix — selection (environment-bounded):
 * <en/> - Both modes: row checkboxes exist and start unchecked (cell-pipeline parity).
 * <en/> - default: clicking select-all checks every row checkbox (full user path).
 * <en/> - virtual headers are size-gated under happy-dom; the select-all behavior is covered by
 * <en/>   the existing selection-v2-column tests, so only row-level checkbox parity is asserted here.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountTable } from '../__harness__/mount-table'
import { rowCheckboxChecked } from '../__harness__/queries'
import '../__harness__/layout-mock'

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

const mounted: MountedTable[] = []

const selectionColumns = [
  { selection: true },
  { prop: 'id', label: 'ID', hidden: false },
  { prop: 'name', label: '名称', hidden: false },
] as any[]

async function mountBoth(): Promise<[MountedTable, MountedTable]> {
  const d = await mountTable({ mode: 'default', columns: selectionColumns })
  const v = await mountTable({ mode: 'virtual', columns: selectionColumns })
  mounted.push(d, v)
  return [d, v]
}

afterEach(() => {
  mounted.forEach(m => m.wrapper.unmount())
  mounted.length = 0
})

describe('parity — selection', () => {
  it('row checkboxes start unchecked in both modes', async () => {
    const [d, v] = await mountBoth()
    for (let r = 0; r < 3; r++) {
      expect(rowCheckboxChecked(d.wrapper, r)).toBe(false)
      expect(rowCheckboxChecked(v.wrapper, r)).toBe(false)
    }
  })

  it('default mode: select-all drives every row checkbox', async () => {
    const d = await mountTable({
      mode: 'default',
      columns: selectionColumns,
    })
    mounted.push(d)

    const checkboxes = d.wrapper.findAll('.el-checkbox')
    expect(checkboxes.length).toBeGreaterThan(0)
    const input = checkboxes[0].find('input')
    if (input.exists())
      await input.setValue(true)
    else
      await checkboxes[0].trigger('click')

    for (let r = 0; r < 3; r++)
      expect(rowCheckboxChecked(d.wrapper, r)).toBe(true)
  })
})
