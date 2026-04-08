import type { AdvColumn, ProcessedColumn } from '../../src/types/column'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useColumns } from '../../src/composables/columns/use-columns'

describe('useColumns composable', () => {
  describe('basic functionality', () => {
    it('should initialize with empty columns', () => {
      const emitUpdate = vi.fn()
      const result = useColumns({ columns: undefined as any }, emitUpdate)

      expect(result.localColumns.value).toEqual([])
      expect(result.hasColumns.value).toBe(false)
    })

    it('should initialize with provided columns', () => {
      const columns: AdvColumn[] = [
        { key: 'name', prop: 'name', label: 'Name' },
        { key: 'id', prop: 'id', label: 'ID' },
      ]
      const emitUpdate = vi.fn()
      const result = useColumns({ columns }, emitUpdate)

      expect(result.localColumns.value).toHaveLength(2)
      expect(result.hasColumns.value).toBe(true)
    })

    it('should add hidden to columns by default', () => {
      const columns: AdvColumn[] = [
        { key: 'name', prop: 'name', label: 'Name' },
      ]
      const emitUpdate = vi.fn()
      const result = useColumns({ columns }, emitUpdate)

      expect(result.localColumns.value[0].hidden).toBe(false)
    })

    it('should preserve hidden from column config', () => {
      const columns: AdvColumn[] = [
        { key: 'name', prop: 'name', label: 'Name', hidden: true },
      ]
      const emitUpdate = vi.fn()
      const result = useColumns({ columns }, emitUpdate)

      expect(result.localColumns.value[0].hidden).toBe(true)
    })

    it('should map pinFixed to fixed', () => {
      const columns: AdvColumn[] = [
        { key: 'name', prop: 'name', label: 'Name', pinFixed: 'left' },
      ]
      const emitUpdate = vi.fn()
      const result = useColumns({ columns }, emitUpdate)

      expect(result.localColumns.value[0].fixed).toBe('left')
    })

    it('should preserve fixed when no pinFixed', () => {
      const columns: AdvColumn[] = [
        { key: 'name', prop: 'name', label: 'Name', fixed: 'right' },
      ]
      const emitUpdate = vi.fn()
      const result = useColumns({ columns }, emitUpdate)

      expect(result.localColumns.value[0].fixed).toBe('right')
    })

    it('should clamp non-positive width to the minimum column width', () => {
      const columns: AdvColumn[] = [
        { key: 'a', prop: 'a', label: 'A', width: 0 },
        { key: 'b', prop: 'b', label: 'B', width: -20 },
      ]
      const emitUpdate = vi.fn()
      const result = useColumns({ columns }, emitUpdate)

      expect(result.localColumns.value[0].width).toBe(50)
      expect(result.localColumns.value[1].width).toBe(50)
    })

    it('should preserve positive width untouched', () => {
      const columns: AdvColumn[] = [
        { key: 'a', prop: 'a', label: 'A', width: 120 },
      ]
      const emitUpdate = vi.fn()
      const result = useColumns({ columns }, emitUpdate)

      expect(result.localColumns.value[0].width).toBe(120)
    })
  })

  describe('origin columns', () => {
    it('should save origin columns on initialization', () => {
      const columns: AdvColumn[] = [
        { key: 'name', prop: 'name', label: 'Name' },
      ]
      const emitUpdate = vi.fn()
      const result = useColumns({ columns }, emitUpdate)

      expect(result.originColumns.value).toHaveLength(1)
    })

    it('should save format map', () => {
      const formatFn = (val: any) => `formatted: ${val}`
      const columns: AdvColumn[] = [
        { key: 'name', prop: 'name', label: 'Name', format: formatFn },
      ]
      const emitUpdate = vi.fn()
      const result = useColumns({ columns }, emitUpdate)

      expect(result.originColumnsFormatMap.value.name).toBe(formatFn)
    })
  })

  describe('resetColumns', () => {
    it('should reset columns to origin values', () => {
      const columns: AdvColumn[] = [
        { key: 'name', prop: 'name', label: 'Name' },
      ]
      const emitUpdate = vi.fn()
      const result = useColumns({ columns }, emitUpdate)

      result.localColumns.value = [
        { key: 'name', prop: 'name', label: 'Name', hidden: true },
      ] as ProcessedColumn[]
      result.resetColumns()

      expect(result.localColumns.value[0].hidden).toBe(false)
    })

    it('should restore format function after reset', () => {
      const formatFn = (val: any) => `formatted: ${val}`
      const columns: AdvColumn[] = [
        { key: 'name', prop: 'name', label: 'Name', format: formatFn },
      ]
      const emitUpdate = vi.fn()
      const result = useColumns({ columns }, emitUpdate)

      result.localColumns.value = [] as ProcessedColumn[]
      result.resetColumns()

      expect(result.localColumns.value[0].format).toBe(formatFn)
    })
  })

  describe('emit update', () => {
    it('should emit update when setColumns is called', () => {
      const columns: AdvColumn[] = [
        { key: 'name', prop: 'name', label: 'Name' },
      ]
      const emitUpdate = vi.fn()
      const result = useColumns({ columns }, emitUpdate)

      const newCols = [
        { key: 'name', prop: 'name', label: 'Name', hidden: true },
      ] as ProcessedColumn[]
      result.setColumns(newCols)

      expect(emitUpdate).toHaveBeenCalledTimes(1)
      expect(emitUpdate).toHaveBeenCalledWith(newCols)
    })

    it('should emit update when setColumns sets empty columns', () => {
      const columns: AdvColumn[] = [
        { key: 'name', prop: 'name', label: 'Name' },
      ]
      const emitUpdate = vi.fn()
      const result = useColumns({ columns }, emitUpdate)

      result.setColumns([])

      expect(emitUpdate).toHaveBeenCalledWith([])
    })

    it('should emit update when resetColumns is called', () => {
      const columns: AdvColumn[] = [
        { key: 'name', prop: 'name', label: 'Name' },
      ]
      const emitUpdate = vi.fn()
      const result = useColumns({ columns }, emitUpdate)

      result.resetColumns()

      expect(emitUpdate).toHaveBeenCalledTimes(1)
    })

    it('should not emit on external prop changes', async () => {
      const columns = ref<AdvColumn[]>([
        { key: 'name', prop: 'name', label: 'Name' },
      ])
      const emitUpdate = vi.fn()
      useColumns({ columns: () => columns.value }, emitUpdate)

      columns.value = [
        { key: 'name', prop: 'name', label: 'Name', hidden: true },
      ]
      await nextTick()

      expect(emitUpdate).not.toHaveBeenCalled()
    })
  })

  describe('columns cleared', () => {
    it('should clear localColumns when columns is set to empty array', async () => {
      const columns = ref<AdvColumn[]>([
        { key: 'name', prop: 'name', label: 'Name' },
        { key: 'age', prop: 'age', label: 'Age' },
      ])
      const emitUpdate = vi.fn()
      const result = useColumns({ columns: () => columns.value }, emitUpdate)

      expect(result.localColumns.value).toHaveLength(2)
      expect(result.hasColumns.value).toBe(true)

      columns.value = []
      await nextTick()

      expect(result.localColumns.value).toEqual([])
      expect(result.hasColumns.value).toBe(false)
    })

    it('should clear originColumns and formatMap when columns is emptied', async () => {
      const formatFn = (val: any) => `formatted: ${val}`
      const columns = ref<AdvColumn[]>([
        { key: 'name', prop: 'name', label: 'Name', format: formatFn },
      ])
      const emitUpdate = vi.fn()
      const result = useColumns({ columns: () => columns.value }, emitUpdate)

      expect(result.originColumns.value).toHaveLength(1)
      expect(result.originColumnsFormatMap.value.name).toBe(formatFn)

      columns.value = []
      await nextTick()

      expect(result.originColumns.value).toEqual([])
      expect(result.originColumnsFormatMap.value).toEqual({})
    })
  })

  describe('deepCloneColumnTree — object property cloning', () => {
    it('should deep clone hoverActions object', async () => {
      const columns: AdvColumn[] = [
        { key: 'action', prop: 'action', label: 'Action', hoverActions: { teleport: true, keepAlive: false } },
      ]
      const emitUpdate = vi.fn()
      const result = useColumns({ columns: () => columns }, emitUpdate)
      const clonedCol = result.originColumns.value[0] as any
      expect(clonedCol.hoverActions).not.toBe(columns[0].hoverActions)
      expect(clonedCol.hoverActions.teleport).toBe(true)
      expect(clonedCol.hoverActions.keepAlive).toBe(false)
    })

    it('should deep clone valueEnum object', async () => {
      const enumMap = { 1: 'One', 2: 'Two' }
      const columns: AdvColumn[] = [
        { key: 'status', prop: 'status', label: 'Status', valueEnum: enumMap },
      ]
      const emitUpdate = vi.fn()
      const result = useColumns({ columns: () => columns }, emitUpdate)
      const clonedCol = result.originColumns.value[0] as any
      expect(clonedCol.valueEnum).not.toBe(enumMap)
      expect(clonedCol.valueEnum[1]).toBe('One')
    })

    it('should deep clone cellStyle object', async () => {
      const style = { color: 'red', fontWeight: 'bold' }
      const columns: AdvColumn[] = [
        { key: 'name', prop: 'name', label: 'Name', cellStyle: style },
      ]
      const emitUpdate = vi.fn()
      const result = useColumns({ columns: () => columns }, emitUpdate)
      const clonedCol = result.originColumns.value[0] as any
      expect(clonedCol.cellStyle).not.toBe(style)
      expect(clonedCol.cellStyle.color).toBe('red')
    })

    it('should deep clone className array', async () => {
      const classes = ['custom-class', 'highlight']
      const columns: AdvColumn[] = [
        { key: 'name', prop: 'name', label: 'Name', className: classes },
      ]
      const emitUpdate = vi.fn()
      const result = useColumns({ columns: () => columns }, emitUpdate)
      const clonedCol = result.originColumns.value[0] as any
      expect(clonedCol.className).not.toBe(classes)
      expect(clonedCol.className).toEqual(['custom-class', 'highlight'])
    })

    it('should NOT deep clone boolean sortable (not an object)', async () => {
      const columns: AdvColumn[] = [
        { key: 'name', prop: 'name', label: 'Name', sortable: true },
      ]
      const emitUpdate = vi.fn()
      const result = useColumns({ columns: () => columns }, emitUpdate)
      const clonedCol = result.originColumns.value[0] as any
      expect(clonedCol.sortable).toBe(true)
    })

    it('should deep clone group column children recursively', async () => {
      const columns: AdvColumn[] = [
        {
          key: 'group',
          label: 'Group',
          children: [
            { key: 'name', prop: 'name', label: 'Name', hoverActions: { teleport: true } },
          ],
        },
      ]
      const emitUpdate = vi.fn()
      const result = useColumns({ columns: () => columns }, emitUpdate)
      // 测试 deepCloneColumnTree 的递归克隆能力，应检查 originColumns（由 deepCloneColumnTree 生成），
      // 而非 localColumns（由 normalizeColumn 浅拷贝生成）。
      const tree = result.originColumns.value
      const group = tree[0] as any
      const child = group.children[0]
      expect(child.hoverActions).not.toBe((columns[0] as any).children[0].hoverActions)
      expect(child.hoverActions.teleport).toBe(true)
    })
  })

  describe('merge columns', () => {
    it('should merge columns preserving user state', async () => {
      const columns = ref<AdvColumn[]>([
        { key: 'name', prop: 'name', label: 'Name', hidden: false },
        { key: 'age', prop: 'age', label: 'Age', hidden: false },
      ])
      const emitUpdate = vi.fn()
      const result = useColumns({ columns: () => columns.value }, emitUpdate)

      result.localColumns.value = [
        { key: 'name', prop: 'name', label: 'Name', hidden: true },
        { key: 'age', prop: 'age', label: 'Age', hidden: false },
      ] as ProcessedColumn[]

      columns.value = [
        { key: 'name', prop: 'name', label: 'Name' },
        { key: 'age', prop: 'age', label: 'Age' },
        { key: 'new', prop: 'new', label: 'New' },
      ]
      await nextTick()

      expect(result.localColumns.value).toHaveLength(3)
      expect(result.localColumns.value[0].hidden).toBe(true)
    })

    it('should preserve fixed when merging', async () => {
      const columns = ref<AdvColumn[]>([
        { key: 'name', prop: 'name', label: 'Name' },
      ])
      const emitUpdate = vi.fn()
      const result = useColumns({ columns: () => columns.value }, emitUpdate)

      result.localColumns.value = [
        { key: 'name', prop: 'name', label: 'Name', fixed: 'left' },
      ] as unknown as ProcessedColumn[]

      columns.value = [
        { key: 'name', prop: 'name', label: 'Name' },
      ]
      await nextTick()

      expect(result.localColumns.value[0].fixed).toBe('left')
    })

    it('should apply pinFixed when merging', async () => {
      const columns = ref<AdvColumn[]>([
        { key: 'name', prop: 'name', label: 'Name', pinFixed: 'left' },
      ])
      const emitUpdate = vi.fn()
      const result = useColumns({ columns: () => columns.value }, emitUpdate)

      columns.value = [
        { key: 'name', prop: 'name', label: 'Name', pinFixed: 'right' },
      ]
      await nextTick()

      expect(result.localColumns.value[0].fixed).toBe('right')
    })

    it('should detect server-driven in-group child reorders', async () => {
      // <zh/> 回归：检测曾只比顶层顺序，组内子列重排被用户旧顺序静默吞掉
      // <en/> Regression: detection used to compare top-level order only, so in-group child reorders were silently swallowed by the stale user order
      const columns = ref<AdvColumn[]>([
        {
          key: 'g',
          label: 'G',
          children: [
            { key: 'a', prop: 'a', label: 'A' },
            { key: 'b', prop: 'b', label: 'B' },
          ],
        },
      ])
      const emitUpdate = vi.fn()
      const result = useColumns({ columns: () => columns.value }, emitUpdate)

      columns.value = [
        {
          key: 'g',
          label: 'G',
          children: [
            { key: 'b', prop: 'b', label: 'B' },
            { key: 'a', prop: 'a', label: 'A' },
          ],
        },
      ]
      await nextTick()
      await nextTick()

      const kids = ((result.localColumns.value[0] as any).children as any[]).map(c => c.prop)
      expect(kids).toEqual(['b', 'a'])
    })
  })

  describe('lockVisible / lockPosition 用户状态保留', () => {
    it('lockVisible 列不保存 hidden 状态到 userState', async () => {
      const columns = ref<AdvColumn[]>([
        { key: 'name', prop: 'name', label: 'Name', lockVisible: true, hidden: false },
      ])
      const emitUpdate = vi.fn()
      const result = useColumns({ columns: () => columns.value }, emitUpdate)

      // Simulate merge: lockVisible means column definition takes precedence
      columns.value = [
        { key: 'name', prop: 'name', label: 'Name', lockVisible: true, hidden: true },
      ]
      await nextTick()

      expect(result.localColumns.value[0].hidden).toBe(true)
    })

    it('lockPosition 列不会从用户状态恢复 fixed', async () => {
      const columns = ref<AdvColumn[]>([
        { key: 'name', prop: 'name', label: 'Name', lockPosition: true, fixed: 'left' },
      ])
      const emitUpdate = vi.fn()
      const result = useColumns({ columns: () => columns.value }, emitUpdate)

      // merge: lockPosition means userState saved fixed as undefined, column definition used
      columns.value = [
        { key: 'name', prop: 'name', label: 'Name', lockPosition: true, fixed: 'right' },
      ]
      await nextTick()

      // With lockPosition, collectUserState returns fixed: undefined;
      // merge must preserve the column definition ('right') instead of overwriting with undefined
      expect(result.localColumns.value[0].fixed).toBe('right')
    })
  })

  describe('mergeColumns 边界', () => {
    it('mergeColumns 时传入空数组清空列', async () => {
      const columns = ref<AdvColumn[]>([
        { key: 'name', prop: 'name', label: 'Name' },
      ])
      const emitUpdate = vi.fn()
      const result = useColumns({ columns: () => columns.value }, emitUpdate)

      columns.value = []
      await nextTick()

      expect(result.localColumns.value).toEqual([])
      expect(result.originColumns.value).toEqual([])
      expect(result.originColumnsFormatMap.value).toEqual({})
    })

    it('mergeColumns preserves group children depth', async () => {
      const columns = ref<AdvColumn[]>([
        {
          key: 'group',
          label: 'Group',
          children: [
            { key: 'name', prop: 'name', label: 'Name' },
          ],
        },
      ])
      const emitUpdate = vi.fn()
      const result = useColumns({ columns: () => columns.value }, emitUpdate)

      const group = result.localColumns.value[0] as any
      expect(group.children).toHaveLength(1)
      expect(group.children[0].prop).toBe('name')
    })

    it('mergeColumns preserves group children after update', async () => {
      const columns = ref<AdvColumn[]>([
        {
          key: 'group',
          label: 'Group',
          children: [
            { key: 'name', prop: 'name', label: 'Name' },
          ],
        },
      ])
      const emitUpdate = vi.fn()
      const result = useColumns({ columns: () => columns.value }, emitUpdate)

      columns.value = [
        {
          key: 'group',
          label: 'Group Updated',
          children: [
            { key: 'name', prop: 'name', label: 'Name' },
            { key: 'age', prop: 'age', label: 'Age' },
          ],
        },
      ]
      await nextTick()

      const group = result.localColumns.value[0] as any
      expect(group.children).toHaveLength(2)
      expect(group.children[1].prop).toBe('age')
    })
  })

  describe('setColumns 边界', () => {
    it('setColumns with null/undefined -> 清空', () => {
      const columns: AdvColumn[] = [
        { key: 'name', prop: 'name', label: 'Name' },
      ]
      const emitUpdate = vi.fn()
      const result = useColumns({ columns }, emitUpdate)

      result.setColumns(undefined as any)
      expect(result.localColumns.value).toEqual([])
      expect(result.originColumns.value).toEqual([])
    })
  })

  describe('selectable columns with fixed (pinFixed)', () => {
    it('pinFixed 不覆盖已有的 fixed', () => {
      const columns: AdvColumn[] = [
        { key: 'name', prop: 'name', label: 'Name', fixed: 'left', pinFixed: 'right' },
      ]
      const emitUpdate = vi.fn()
      const result = useColumns({ columns }, emitUpdate)

      // pinFixed should not override already-set fixed
      expect(result.localColumns.value[0].fixed).toBe('left')
    })
  })

  describe('受控回显 fixed 等价书写', () => {
    it('父回写 fixed:true 为 left 时不污染 pristine 基线', async () => {
      // <zh/> 回归：签名曾区分 true/'left'（语义等价），等价回写被误判为外部变更，面板态污染基线
      // <en/> Regression: the signature used to distinguish true/'left' (equivalent), so an equivalent
      // <en/> write-back was mistaken for an external change and panel state polluted the baseline
      const columns = ref<AdvColumn[]>([
        { key: 'name', prop: 'name', label: 'Name', fixed: true },
      ])
      const emitUpdate = vi.fn()
      const result = useColumns({ columns: () => columns.value }, emitUpdate)

      // <zh/> 面板操作：隐藏列 | <en/> Panel operation: hide the column
      result.setColumns(result.localColumns.value.map(c => ({ ...c, hidden: true })))
      expect(emitUpdate).toHaveBeenCalledTimes(1)
      const emitted = emitUpdate.mock.calls[0][0]
      expect(emitted[0].fixed).toBe(true)

      // <zh/> 父原样回写，仅 fixed 书写等价变化（true → 'left'）| <en/> Parent echoes back with only the equivalent fixed spelling (true → 'left')
      columns.value = emitted.map((c: any) => ({ ...c, fixed: 'left' as const }))
      await nextTick()
      await nextTick()

      // <zh/> 基线未被面板态污染：重置回到外部初始（可见）| <en/> Baseline unpolluted: reset restores the external initial state (visible)
      result.resetColumns()
      expect(result.localColumns.value[0].hidden).toBe(false)
    })
  })
})
