import type { ProcessedColumn } from '../../../src/types/column'
import { describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'
import {
  useNormalV2Columns,
} from '../../../src/components/table-virtual-renderer/normal-v2-column'

function createCol(overrides: any = {}): any {
  return {
    key: 'col',
    prop: 'col',
    label: 'Col',
    width: 100,
    ...overrides,
    hidden: false,
  }
}

function createGroupCol(label: string, children: any[], overrides: any = {}): any {
  return {
    key: `group-${label}`,
    label,
    children,
    ...overrides,
  }
}

describe('useNormalV2Columns', () => {
  function makeOptions(overrides: any = {}) {
    return {
      // All MaybeRefOrGetter params passed as refs so toValue() doesn't eagerly call them
      displayColumns: ref<ProcessedColumn[]>([]),
      hasHoverOptionColumns: false,
      hoverOptionColumns: [],
      slots: {},
      t: () => undefined,
      rowKeyFn: ref((row: any) => String(row.id)),
      getColumnWidth: () => 100,
      handleResizeStart: vi.fn(),
      hoverRowKey: ref<string | null>(null),
      hoverLayerVisible: ref(false),
      hoverLayerCollapsed: ref(false),
      hoverLayerStyle: ref({}),
      hoverOptionTeleport: ref(false),
      ...overrides,
    }
  }

  describe('basic structure', () => {
    it('returns normalV2Columns and fixedV2Columns computeds', () => {
      const result = useNormalV2Columns(makeOptions())
      expect(result.normalV2Columns).toBeDefined()
      expect(result.fixedV2Columns).toBeDefined()
      expect(typeof result.normalV2Columns.value).toBe('object')
      expect(typeof result.fixedV2Columns.value).toBe('object')
    })

    it('generates a column config for each leaf column', () => {
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([createCol({ key: 'a' })]),
      }))
      expect(result.normalV2Columns.value).toHaveLength(1)
    })

    it('handles empty display columns', () => {
      const result = useNormalV2Columns(makeOptions({ displayColumns: ref([]) }))
      expect(result.normalV2Columns.value).toEqual([])
      expect(result.fixedV2Columns.value).toEqual([])
    })
  })

  describe('column key / dataKey / title', () => {
    it('uses key and prop from column definition', () => {
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([createCol({ key: 'my-col', prop: 'my-prop' })]),
      }))
      const config = result.normalV2Columns.value[0]
      expect(config.key).toBe('my-col')
      expect(config.dataKey).toBe('my-prop')
    })

    it('uses dataKey when available', () => {
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([createCol({ key: 'k', prop: 'p', dataKey: 'dk' })]),
      }))
      expect(result.normalV2Columns.value[0].dataKey).toBe('dk')
    })

    it('falls back to prop for dataKey', () => {
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([createCol({ key: 'k', prop: 'p' })]),
      }))
      expect(result.normalV2Columns.value[0].dataKey).toBe('p')
    })

    it('uses empty string for dataKey when neither prop nor dataKey exists', () => {
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([{ key: 'k', label: 'No prop' } as any]),
      }))
      expect(result.normalV2Columns.value[0].dataKey).toBe('')
    })

    it('sets the column title from label', () => {
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([createCol({ label: 'My Label' })]),
      }))
      expect(result.normalV2Columns.value[0].title).toBe('My Label')
    })
  })

  describe('column width and flex', () => {
    it('uses width from getColumnWidth', () => {
      const result = useNormalV2Columns(makeOptions({
        getColumnWidth: () => 200,
        displayColumns: ref([createCol()]),
      }))
      expect(result.normalV2Columns.value[0].width).toBe(200)
    })

    it('sets flexGrow/flexShrink when autoSizeColumns is on', () => {
      const result = useNormalV2Columns(makeOptions({
        autoSizeColumns: true,
        displayColumns: ref([createCol({ width: 120 })]),
      }))
      const config = result.normalV2Columns.value[0]
      expect(config.flexGrow).toBe(1)
      expect(config.flexShrink).toBe(0)
      expect(config.width).toBe(120)
      expect(config.minWidth).toBe(120)
    })

    it('preserves explicit flexGrow when autoSize is on', () => {
      const result = useNormalV2Columns(makeOptions({
        autoSizeColumns: true,
        displayColumns: ref([createCol({ flexGrow: 2, flexShrink: 1 })]),
      }))
      const config = result.normalV2Columns.value[0]
      expect(config.flexGrow).toBe(2)
      expect(config.flexShrink).toBe(1)
    })

    it('sets explicit minWidth when present', () => {
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([createCol({ minWidth: 150 })]),
      }))
      expect(result.normalV2Columns.value[0].minWidth).toBe(150)
    })

    it('sets maxWidth when present', () => {
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([createCol({ maxWidth: 300 })]),
      }))
      expect(result.normalV2Columns.value[0].maxWidth).toBe(300)
    })
  })

  describe('hover cell class', () => {
    it('applies hover-cell class to last column when hover options exist', () => {
      const result = useNormalV2Columns(makeOptions({
        hasHoverOptionColumns: true,
        hoverOptionColumns: [createCol({ valueType: 'option' })],
        displayColumns: ref([createCol()]),
      }))
      expect(result.normalV2Columns.value[0].class).toBe('adv-table__hover-cell')
    })

    it('does not apply hover-cell class when no hover options', () => {
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([createCol()]),
      }))
      expect(result.normalV2Columns.value[0].class).toBeUndefined()
    })
  })

  describe('render functions', () => {
    it('generates cellRenderer function', () => {
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([createCol()]),
      }))
      expect(typeof result.normalV2Columns.value[0].cellRenderer).toBe('function')
    })

    it('generates headerCellRenderer function', () => {
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([createCol()]),
      }))
      expect(typeof result.normalV2Columns.value[0].headerCellRenderer).toBe('function')
    })

    it('cellRenderer returns a VNode-like object', () => {
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([createCol()]),
      }))
      const renderer = result.normalV2Columns.value[0].cellRenderer
      const vnode = renderer!({ rowData: { col: 'val', id: 1 }, rowIndex: 0, column: { key: 'col' } } as any)
      const node = Array.isArray(vnode) ? vnode[0] : vnode
      expect(node).toBeDefined()
      expect(node.props).toBeDefined()
      expect(node.props.class).toContain('adv-table__cell')
    })

    it('cell renderer includes row key attribute', () => {
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([createCol()]),
      }))
      const renderer = result.normalV2Columns.value[0].cellRenderer
      const vnode = renderer!({ rowData: { col: 'val', id: 1 }, rowIndex: 0, column: { key: 'col' } } as any)
      const node = Array.isArray(vnode) ? vnode[0] : vnode
      expect(node.props).toHaveProperty('data-adv-table-row-key')
    })
  })

  describe('filter and fixed columns', () => {
    it('filters out hover option columns when teleport mode is on', () => {
      const normalCol = createCol({ key: 'normal' })
      const optionCol = createCol({ key: 'opt', valueType: 'option', hoverActions: true })
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([normalCol, optionCol]),
        hoverOptionTeleport: ref(true),
        hasHoverOptionColumns: true,
      }))
      expect(result.normalV2Columns.value).toHaveLength(1)
      expect(result.normalV2Columns.value[0].key).toBe('normal')
    })

    it('fixedV2Columns only includes fixed columns', () => {
      const normalCol = createCol({ key: 'normal' })
      const fixedCol = createCol({ key: 'fixed', fixed: 'right' })
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([normalCol, fixedCol]),
      }))
      expect(result.fixedV2Columns.value).toHaveLength(1)
      expect(result.fixedV2Columns.value[0].key).toBe('fixed')
    })
  })

  describe('flattening group columns', () => {
    it('flattens a group column with children', () => {
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([
          createGroupCol('Group', [
            createCol({ key: 'child1' }),
            createCol({ key: 'child2' }),
          ]),
        ]),
      }))
      const cols = result.normalV2Columns.value
      expect(cols).toHaveLength(2)
      expect(cols[0].key).toBe('child1')
      expect(cols[1].key).toBe('child2')
    })

    it('flattens nested group columns', () => {
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([
          createGroupCol('Outer', [
            createGroupCol('Inner', [
              createCol({ key: 'leaf' }),
            ]),
          ]),
        ]),
      }))
      expect(result.normalV2Columns.value).toHaveLength(1)
      expect(result.normalV2Columns.value[0].key).toBe('leaf')
    })

    it('excludes group nodes themselves from output', () => {
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([
          createGroupCol('Group', [createCol({ key: 'leaf' })], { key: 'group-key' }),
        ]),
      }))
      const keys = result.normalV2Columns.value.map((c: any) => c.key)
      expect(keys).not.toContain('group-key')
      expect(keys).toContain('leaf')
    })
  })

  describe('partitionedLeaves (single traversal)', () => {
    it('separates normal and fixed columns into correct outputs', () => {
      const normalCol = createCol({ key: 'name' })
      const fixedCol = createCol({ key: 'action', fixed: 'right' })
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([normalCol, fixedCol]),
      }))
      expect(result.normalV2Columns.value).toHaveLength(1)
      expect(result.normalV2Columns.value[0].key).toBe('name')
      expect(result.fixedV2Columns.value).toHaveLength(1)
      expect(result.fixedV2Columns.value[0].key).toBe('action')
    })

    it('puts all columns into normalV2Columns when none are fixed', () => {
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([createCol({ key: 'a' }), createCol({ key: 'b' })]),
      }))
      expect(result.normalV2Columns.value).toHaveLength(2)
      expect(result.fixedV2Columns.value).toHaveLength(0)
    })

    it('puts all columns into fixedV2Columns when all are fixed', () => {
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([
          createCol({ key: 'a', fixed: 'left' }),
          createCol({ key: 'b', fixed: 'right' }),
        ]),
      }))
      expect(result.normalV2Columns.value).toHaveLength(0)
      expect(result.fixedV2Columns.value).toHaveLength(2)
    })

    it('handles mixed normal and fixed columns preserving order', () => {
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([
          createCol({ key: 'fixed1', fixed: 'left' }),
          createCol({ key: 'normal1' }),
          createCol({ key: 'fixed2', fixed: 'right' }),
          createCol({ key: 'normal2' }),
        ]),
      }))
      expect(result.fixedV2Columns.value.map((c: any) => c.key)).toEqual(['fixed1', 'fixed2'])
      expect(result.normalV2Columns.value.map((c: any) => c.key)).toEqual(['normal1', 'normal2'])
    })
  })

  describe('preparedColumns', () => {
    it('uses preparedColumns.allLeaves when available', () => {
      const normalCol = createCol({ key: 'a' })
      const fixedCol = createCol({ key: 'b', fixed: 'right' })
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([]),
        preparedColumns: ref({
          mainFiltered: [],
          mainLeafWidths: [],
          mainLeaves: [normalCol],
          allLeaves: [normalCol, fixedCol],
        }),
      }))
      expect(result.normalV2Columns.value).toHaveLength(1)
      expect(result.normalV2Columns.value[0].key).toBe('a')
      expect(result.fixedV2Columns.value).toHaveLength(1)
      expect(result.fixedV2Columns.value[0].key).toBe('b')
    })

    it('falls back to preparedColumns.mainLeaves when allLeaves is absent', () => {
      const normalCol = createCol({ key: 'a' })
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([]),
        preparedColumns: ref({
          mainFiltered: [],
          mainLeafWidths: [],
          mainLeaves: [normalCol],
        }),
      }))
      expect(result.normalV2Columns.value).toHaveLength(1)
      expect(result.normalV2Columns.value[0].key).toBe('a')
    })

    it('ignores preparedColumns when not provided', () => {
      const normalCol = createCol({ key: 'a' })
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([normalCol]),
      }))
      expect(result.normalV2Columns.value).toHaveLength(1)
    })
  })

  describe('cellClassRules', () => {
    it('applies cellClassRules to cell renderer', () => {
      const rules = { 'custom-class': (params: any) => params.cellData === 'active' }
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([createCol({ key: 'status', prop: 'status', cellClassRules: rules })]),
      }))
      const renderer = result.normalV2Columns.value[0].cellRenderer
      const vnode = renderer!({ rowData: { status: 'active', id: 1 }, rowIndex: 0, column: { key: 'status' } } as any)
      const node = Array.isArray(vnode) ? vnode[0] : vnode
      expect(node.props.class).toContain('custom-class')
    })

    it('omits cellClassRules class when rule returns false', () => {
      const rules = { 'custom-class': () => false }
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([createCol({ key: 'status', prop: 'status', cellClassRules: rules })]),
      }))
      const renderer = result.normalV2Columns.value[0].cellRenderer
      const vnode = renderer!({ rowData: { status: 'inactive', id: 1 }, rowIndex: 0, column: { key: 'status' } } as any)
      const node = Array.isArray(vnode) ? vnode[0] : vnode
      expect(node.props.class).not.toContain('custom-class')
    })
  })

  describe('autoSizeColumns', () => {
    it('uses default width when autoSize is off (falls back to getColumnWidth)', () => {
      const result = useNormalV2Columns(makeOptions({
        autoSizeColumns: false,
        getColumnWidth: () => undefined,
        displayColumns: ref([{ key: 'a', prop: 'a', label: 'A' } as any]),
      }))
      const config = result.normalV2Columns.value[0]
      // 非 autoSize 模式：width 使用 effectiveWidth = getColumnWidth(col) ?? DEFAULT_COLUMN_WIDTH
      expect(config.width).toBe(150)
    })

    it('clears width when autoSize is on and no explicit dimensions', () => {
      const result = useNormalV2Columns(makeOptions({
        autoSizeColumns: true,
        getColumnWidth: () => undefined,
        displayColumns: ref([{ key: 'a', prop: 'a', label: 'A' } as any]),
      }))
      const config = result.normalV2Columns.value[0]
      // autoSize 下无任何宽度约束时仍下发数值宽度（150），以保证 header/body/summary 三行逐像素一致；仅清除 minWidth
      // A numeric width (150) is still emitted when autoSize has no constraint at all, keeping the
      // header/body/summary rows pixel-identical; only minWidth is cleared
      expect(config.width).toBe(150)
      expect(config.minWidth).toBeUndefined()
    })

    it('uses col.minWidth over col.width when autoSize is on', () => {
      const result = useNormalV2Columns(makeOptions({
        autoSizeColumns: true,
        displayColumns: ref([createCol({ key: 'a', minWidth: 150, width: 100 })]),
      }))
      const config = result.normalV2Columns.value[0]
      expect(config.minWidth).toBe(150)
    })

    it('sets maxWidth when present with autoSize', () => {
      const result = useNormalV2Columns(makeOptions({
        autoSizeColumns: true,
        displayColumns: ref([createCol({ key: 'a', maxWidth: 300 })]),
      }))
      expect(result.normalV2Columns.value[0].maxWidth).toBe(300)
    })
  })

  describe('column width reactivity', () => {
    it('rebuilds columnConfig.width when getColumnWidth returns new value', () => {
      const widths = reactive<Record<string, number>>({ name: 100, age: 80 })
      const getColumnWidth = (col: any) => widths[col.key] ?? col.width
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([
          createCol({ key: 'name', width: 100 }),
          createCol({ key: 'age', width: 80 }),
        ]),
        getColumnWidth,
      }))

      expect(result.normalV2Columns.value[0].width).toBe(100)
      expect(result.normalV2Columns.value[1].width).toBe(80)

      widths.name = 200
      expect(result.normalV2Columns.value[0].width).toBe(200)
    })

    it('flattens multi-level group columns and tracks leaf widths', () => {
      const widths = reactive<Record<string, number>>({})
      const getColumnWidth = (col: any) => widths[col.key] ?? col.width
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([
          createGroupCol('Group1', [
            createCol({ key: 'name', width: 100 }),
            createCol({ key: 'age', width: 80 }),
          ]),
        ]),
        getColumnWidth,
      }))

      expect(result.normalV2Columns.value).toHaveLength(2)
      expect(result.normalV2Columns.value[0].key).toBe('name')
      expect(result.normalV2Columns.value[0].width).toBe(100)
      expect(result.normalV2Columns.value[1].key).toBe('age')
      expect(result.normalV2Columns.value[1].width).toBe(80)

      widths.name = 150
      expect(result.normalV2Columns.value[0].width).toBe(150)
    })
  })

  describe('autoSize + user resize', () => {
    /**
     * 回归测试：hoverActions.teleport 触发 autoSizeColumns 时，el-table-v2 会用 minWidth
     * 覆写 columnConfig.width 并通过 flexGrow 拉伸。若不区分"用户拖拽过"与"默认拉伸"，
     * columnWidths[key] 写入的拖拽值会被完全忽略 → 列宽不更新。
     */
    it('locks column to dragged width (columnWidths[key] !== undefined) and disables flexGrow', () => {
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([
          createCol({ key: 'name', width: 100, minWidth: 80 }),
          createCol({ key: 'age', width: 80, minWidth: 80 }),
        ]),
        autoSizeColumns: ref(true),
        columnWidths: { name: 250 } as Record<string, number>,
      }))

      expect(result.normalV2Columns.value[0].key).toBe('name')
      expect(result.normalV2Columns.value[0].width).toBe(250)
      expect(result.normalV2Columns.value[0].minWidth).toBe(250)
      expect(result.normalV2Columns.value[0].flexGrow).toBe(0)
      expect(result.normalV2Columns.value[0].flexShrink).toBe(0)

      // age 未被用户拖拽 → 走默认 autoSize 分支（minWidth + flexGrow=1）
      expect(result.normalV2Columns.value[1].key).toBe('age')
      expect(result.normalV2Columns.value[1].width).toBe(80)
      expect(result.normalV2Columns.value[1].minWidth).toBe(80)
      expect(result.normalV2Columns.value[1].flexGrow).toBe(1)
    })

    it('reacts to columnWidths changes (add entry → lock column width)', () => {
      const columnWidths = reactive<Record<string, number>>({})
      const result = useNormalV2Columns(makeOptions({
        displayColumns: ref([
          createCol({ key: 'name', width: 100, minWidth: 80 }),
        ]),
        autoSizeColumns: ref(true),
        columnWidths,
      }))

      // 初始：未拖拽 → flexGrow 拉伸
      expect(result.normalV2Columns.value[0].flexGrow).toBe(1)

      // 拖拽后：columnWidths 有值 → 锁定宽度、关闭 flexGrow
      columnWidths.name = 300
      expect(result.normalV2Columns.value[0].width).toBe(300)
      expect(result.normalV2Columns.value[0].minWidth).toBe(300)
      expect(result.normalV2Columns.value[0].flexGrow).toBe(0)
    })
  })
})
