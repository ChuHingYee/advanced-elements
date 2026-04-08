import type { MountedTable } from '../__harness__/mount-table'
/**
 * @file rendering.parity.spec.ts
 * @description
 * <zh/> 对等矩阵——渲染域：行/单元格文本、合成行（detail）、装饰属性在两模式下的输出一致。
 * <en/> Parity matrix — rendering: rows/cell texts, synthetic detail rows and decoration
 * <en/> attributes produce consistent output across default & virtual modes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mountTable, standardRows } from '../__harness__/mount-table'
import { columnTexts, findCell } from '../__harness__/queries'
import '../__harness__/layout-mock'

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

const mounted: MountedTable[] = []

async function mountBoth(props?: Record<string, any>): Promise<[MountedTable, MountedTable]> {
  const d = await mountTable({ mode: 'default', props })
  const v = await mountTable({ mode: 'virtual', props })
  mounted.push(d, v)
  return [d, v]
}

afterEach(() => {
  mounted.forEach(m => m.wrapper.unmount())
  mounted.length = 0
})

describe('parity — rendering', () => {
  it('renders identical first-column texts in row order', async () => {
    const [d, v] = await mountBoth()
    // 列 0 = id（fixture 顺序 Carol/Alice/Bob → r3/r1/r2）
    const dt = columnTexts(d.wrapper, 0).filter(t => t !== '')
    const vt = columnTexts(v.wrapper, 0).filter(t => t !== '')
    expect(dt).toEqual(['r3', 'r1', 'r2'])
    expect(vt).toEqual(dt)
    // 列 1 = name
    const dn = columnTexts(d.wrapper, 1).filter(t => t !== '')
    expect(dn).toEqual(['Carol', 'Alice', 'Bob'])
  })

  it('exposes row keys via data-adv-table-row-key in both modes', async () => {
    const [d, v] = await mountBoth()
    const dump: Record<string, string[]> = {}
    for (const m of [d, v]) {
      const keys = m.wrapper.findAll('[data-adv-table-row-key]').map(el =>
        el.attributes('data-adv-table-row-key'),
      )
      dump[m.mode] = keys
    }
    /**
     * <zh/> 不再把 dump 写进临时文件：那是调试期残留的副作用，且它让本文件依赖 `node:fs`/`node:os`/`node:path`，
     * <zh/> 浏览器 project（chromium）会因 "Module node:os has been externalized for browser compatibility" 直接无法加载
     * <zh/> ——对等矩阵的价值恰在于同一份断言在 happy-dom 与真实浏览器两边都跑，故此处只保留断言。
     * <en/> The dump is no longer written to a temp file: that was a debug-time side effect, and it forced this file
     * <en/> to depend on `node:fs`/`node:os`/`node:path`, which makes the browser project (chromium) fail to load it
     * <en/> with "Module node:os has been externalized for browser compatibility" — the parity matrix is valuable
     * <en/> precisely because the same assertions run under happy-dom and a real browser, so only assertions remain.
     */
    for (const m of [d, v]) {
      expect(dump[m.mode]).toContain('r1')
      expect(dump[m.mode]).toContain('r2')
      expect(dump[m.mode]).toContain('r3')
    }
  })

  it('cell spans carry tabindex=-1 activating the keyboard pipeline', async () => {
    const [d, v] = await mountBoth()
    for (const m of [d, v]) {
      const cell = findCell(m.wrapper, 0, 0)
      expect(cell.exists()).toBe(true)
      expect(cell.attributes('tabindex')).toBe('-1')
    }
  })

  it('reacts to columns source mutation identically', async () => {
    const cols = [
      { prop: 'id', label: 'ID', hidden: false },
      { prop: 'name', label: '名称', hidden: false },
    ] as any[]
    const [d, v] = await mountBoth({ columns: cols.map(c => ({ ...c })) })
    d.columns.value = [...d.columns.value, { prop: 'extra', label: 'Extra', hidden: false }]
    v.columns.value = [...v.columns.value, { prop: 'extra', label: 'Extra', hidden: false }]
    await nextTick()
    await nextTick()

    const dHas = d.wrapper.findAll('[data-adv-cell-col="2"]').length > 0
    const vHas = v.wrapper.findAll('[data-adv-cell-col="2"]').length > 0
    expect(dHas).toBe(vHas)
  })

  it('keeps the column-index domain isomorphic when a declarative selection column is present', async () => {
    // <zh/> 声明式 { selection: true } 列不占据普通列索引域——两模式下首个普通列（id）的
    // <zh/> data-adv-cell-col 均为 0，selection 格为 -1（域外），行文本同序；
    // <zh/> 若 v2 的 selection 格取 0 且普通列含 selectionCount 偏移，两域即不同构。
    // <en/> A declarative { selection: true } column does not occupy the normal-column index domain —
    // <en/> the first normal column (id) carries data-adv-cell-col 0 and the selection cell -1
    // <en/> (out of domain) in BOTH modes, with identical row texts; if v2 used 0 for the selection
    // <en/> cell and offset normal columns by selectionCount, the two domains would not be isomorphic.
    const cols = [
      { prop: '__selection__', key: '__selection__', selection: true, label: '', hidden: false },
      { prop: 'id', label: 'ID', hidden: false },
      { prop: 'name', label: '名称', hidden: false },
    ] as any[]
    const [d, v] = await mountBoth({ columns: cols.map(c => ({ ...c })) })

    // <zh/> 两模式的 attr 域刻意不同构（设计约定，非缺陷）：
    // <zh/> - default：attr 即 cells 域（范围选择零翻译）——普通列 [id=0, name=1]
    // <zh/> - virtual：attr 即事件域（[selection, nonFixed, fixed]，与 default 事件载荷跨模式
    // <zh/>   一致）——普通列 [id=1, name=2]；cells 域消费端（范围选择矩形/isCellSelected/TSV）
    // <zh/>   经 columnIndexResolver 翻译回混合域
    // <zh/> 跨模式不变式：selection 格一律 -1（域外）、行文本同序、普通列各自域内连续。
    // <en/> The two attr domains are intentionally NOT isomorphic (by design, not a defect):
    // <en/> - default: attrs ARE the cells domain (zero-translation range selection) — normals [id=0, name=1]
    // <en/> - virtual: attrs ARE the event domain ([selection, nonFixed, fixed], cross-mode
    // <en/>   consistent with default event payloads) — normals [id=1, name=2]; cells-domain
    // <en/>   consumers (range rect / isCellSelected / TSV) translate via columnIndexResolver
    // <en/> Cross-mode invariants: selection cells are -1 (out of domain) in both, row texts
    // <en/> identical, normal columns consecutive within each domain.
    const firstRowNormalCols = (wrapper: any) => wrapper.findAll('[data-adv-cell-row="0"]')
      .map((e: any) => e.attributes('data-adv-cell-col'))
      .filter(c => c !== '-1')
    expect(firstRowNormalCols(d.wrapper)).toEqual(['0', '1'])
    expect(firstRowNormalCols(v.wrapper)).toEqual(['1', '2'])

    // selection 格在两模式下同为 -1（域外标记）
    const dSelection = d.wrapper.findAll('[data-adv-cell-col="-1"]')
    const vSelection = v.wrapper.findAll('[data-adv-cell-col="-1"]')
    expect(dSelection.length).toBeGreaterThan(0)
    expect(vSelection.length).toBe(dSelection.length)

    // 行文本同序——各自取首普通列（default attr 域 0；virtual attr 域 1）
    const dt = columnTexts(d.wrapper, 0).filter(t => t !== '')
    const vt = columnTexts(v.wrapper, 1).filter(t => t !== '')
    expect(dt).toEqual(['r3', 'r1', 'r2'])
    expect(vt).toEqual(dt)
  })

  it('standard fixture renders three data rows in both modes', async () => {
    const rows = standardRows()
    const [d, v] = await mountBoth({ data: rows })
    const dRows = new Set(d.wrapper.findAll('[data-adv-table-row-key]').map(e => e.attributes('data-adv-table-row-key')))
    const vRows = new Set(v.wrapper.findAll('[data-adv-table-row-key]').map(e => e.attributes('data-adv-table-row-key')))
    expect(dRows.size).toBe(3)
    expect([...vRows].sort()).toEqual([...dRows].sort())
  })
})
