import type { RendererPropsDomains } from '../../src/utils/renderer-props-factory'
import { describe, expect, it } from 'vitest'
import { isDefaultRendererProps, isVirtualRendererProps } from '../../src/types/renderer'
import {
  buildDefaultRendererProps,
  buildRendererProps,
  buildVirtualRendererProps,
  pickRendererSelectionDomain,
} from '../../src/utils/renderer-props-factory'

// <zh/> 最小域桩——纯普通值，无需 Vue 组件即可断言双模式键集合
// <en/> Minimal domain stub — plain values only; asserts both modes' key sets without any Vue component
function stubDomains(): RendererPropsDomains<any> {
  const col = (prop: string) => ({ prop, key: prop })
  return {
    visibleTree: [col('a')],
    selectionColumns: [],
    normalColumns: [col('a')],
    leafColumns: [col('a')],
    localColumns: [col('a')],
    canCollapse: () => false,
    isCollapsed: () => false,
    collapsedState: {},
    collapsedVersion: 0,
    columnKeepAlive: false,
    displayNormalColumns: [col('a')],
    hoverOptionColumns: [],
    hasHoverOptionColumns: false,
    hoverOptionTeleport: false,
    selectionColumnSyncKey: 's',
    dom: null,
    renderRows: [{ a: 1 }],
    rowKeyFn: (row: any) => String(row.a),
    selectableData: [{ a: 1 }],
    selectableFn: undefined,
    prePaginationExpandedData: [{ a: 1 }],
    t: ((key: string) => key) as any,
    showSummary: false,
    summaryMethod: undefined,
    sumText: '',
    grandTotalRow: undefined,
    totalValueGetter: undefined,
    suppressStickyTotalRow: false,
    summaryData: [],
    mergedLoading: false,
    autoSizeColumns: false,
    floatingFilter: undefined,
    mergedBorder: true,
    mergedResizable: true,
    mergedEmptyText: 'No data',
    rowSelection: 'multiple',
    sizeConfig: { headerCellHeight: 40, floatingFilterHeight: 32, rowHeight: 48, summaryRowHeight: 36 },
    filterState: undefined,
    sortState: undefined,
    getSpanInfo: undefined,
    spanEnabled: false,
    mergedSpanMethod: undefined,
    editConfig: undefined,
    rowClassName: undefined,
    tooltipEffect: undefined,
    tooltipOptions: undefined,
    stripe: false,
    highlightCurrentRow: true,
    showHeader: true,
    size: undefined,
    tableLayout: undefined,
    height: undefined,
    estimatedRowHeight: undefined,
    checkStatus: { isAllSelected: false, isIndeterminate: false },
    slots: {},
  }
}

describe('renderer-props-factory — mode key sets', () => {
  it('default carries leafColumns/spanMethod/rowHeight and no virtual-only keys', () => {
    const props = buildDefaultRendererProps(stubDomains())
    expect(props.leafColumns).toHaveLength(1)
    expect(props).toHaveProperty('spanMethod')
    expect(props).toHaveProperty('rowHeight', 48)
    expect(props).not.toHaveProperty('selectionWidth')
    expect(props).not.toHaveProperty('headerCellHeight')
    expect(props).not.toHaveProperty('filterState')
  })

  it('virtual carries scroll/filter/span keys and no leafColumns', () => {
    const props = buildVirtualRendererProps(stubDomains())
    expect(props).toHaveProperty('headerCellHeight', 40)
    expect(props).toHaveProperty('floatingFilterHeight', 32)
    expect(props).toHaveProperty('rowHeight', 48)
    expect(props).toHaveProperty('selectionWidth')
    expect(props).toHaveProperty('filterState')
    expect(props).toHaveProperty('sortState')
    expect(props).toHaveProperty('getSpanInfo')
    expect(props).toHaveProperty('spanEnabled')
    expect(props).not.toHaveProperty('leafColumns')
    expect(props).not.toHaveProperty('spanMethod')
  })

  it('dispatches by mode and normalizes illegal heights at a single point', () => {
    const d = stubDomains()
    expect(buildRendererProps('default', d)).toHaveProperty('leafColumns')
    expect(buildRendererProps('virtual', d)).toHaveProperty('selectionWidth')
    // <zh/> 非法高度回退自适应（normalizeTableHeight），双模式同口径
    // <en/> Illegal heights fall back to auto (normalizeTableHeight), same caliber in both modes
    const bad = { ...d, height: -10 }
    expect(buildRendererProps('default', bad).height).toBe(
      buildRendererProps('virtual', bad).height,
    )
  })

  it('pickRendererSelectionDomain pins the selection field set (add/remove is deliberate)', () => {
    const picked = pickRendererSelectionDomain(stubDomains())
    expect(Object.keys(picked).sort()).toEqual(
      ['checkStatus', 'selectableData', 'selectableFn', 'selectionColumns', 'selectionColumnSyncKey', 'selectionMode'].sort(),
    )
    expect(picked.selectionMode).toBe('multiple')
    expect(picked.selectionColumnSyncKey).toBe('s')
    // 选择域整体进入两种模式的基础属性（中间层可整体透传）
    expect((buildDefaultRendererProps(stubDomains()) as any).selectionMode).toBe('multiple')
    expect((buildVirtualRendererProps(stubDomains()) as any).selectionMode).toBe('multiple')
  })

  it('emits a mode discriminator reviving the type guards', () => {
    const d = stubDomains()
    const def = buildRendererProps('default', d) as any
    const vir = buildRendererProps('virtual', d) as any
    expect(def.mode).toBe('default')
    expect(vir.mode).toBe('virtual')
    expect(isDefaultRendererProps(def)).toBe(true)
    expect(isVirtualRendererProps(def)).toBe(false)
    expect(isVirtualRendererProps(vir)).toBe(true)
    expect(isDefaultRendererProps(vir)).toBe(false)
  })
})
