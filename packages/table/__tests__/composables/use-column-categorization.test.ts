import type { ProcessedColumn } from '../../src/types/column'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useColumnCategorization } from '../../src/composables/columns/use-column-categorization'

function categorizeNormalColumns(columns: ProcessedColumn[]) {
  const hoverOptionColumns: ProcessedColumn[] = []
  const displayNormalColumns: ProcessedColumn[] = []
  let hasTeleport = false
  let allKeepAlive = true
  for (const c of columns) {
    const isHover = c.valueType === 'option' && !!c.hoverActions
    if (isHover) {
      hoverOptionColumns.push(c)
      if (typeof c.hoverActions === 'object' && (c.hoverActions as any).teleport)
        hasTeleport = true
      if ((c.hoverActions as any)?.keepAlive === false)
        allKeepAlive = false
    }
    else {
      displayNormalColumns.push(c)
    }
  }
  return { hoverOptionColumns, displayNormalColumns, hasTeleport, allKeepAlive }
}

describe('use-column-categorization', () => {
  describe('basic categorization passthrough', () => {
    it('should return empty arrays when no columns', () => {
      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: [],
        displayNormalColumns: [],
        hasTeleport: false,
        hasFixed: false,
        allKeepAlive: true,
      })

      expect(result.hoverOptionColumns.value).toEqual([])
      expect(result.displayNormalColumns.value).toEqual([])
      expect(result.hasHoverOptionColumns.value).toBe(false)
    })

    it('should pass through categorized option columns with hoverActions', () => {
      const columns: ProcessedColumn[] = [
        { key: 'name', prop: 'name', label: 'Name', hidden: false },
        { key: 'action', prop: 'action', label: 'Action', valueType: 'option', hoverActions: true, hidden: false },
      ]
      const cat = categorizeNormalColumns(columns)

      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: cat.hoverOptionColumns,
        displayNormalColumns: cat.displayNormalColumns,
        hasTeleport: cat.hasTeleport,
        hasFixed: false,
        allKeepAlive: cat.allKeepAlive,
      })

      expect(result.hoverOptionColumns.value).toHaveLength(1)
      expect(result.hoverOptionColumns.value[0].prop).toBe('action')
      expect(result.displayNormalColumns.value).toHaveLength(1)
      expect(result.displayNormalColumns.value[0].prop).toBe('name')
      expect(result.hasHoverOptionColumns.value).toBe(true)
    })

    it('should return empty hover columns when no hoverActions', () => {
      const columns: ProcessedColumn[] = [
        { key: 'name', prop: 'name', label: 'Name', valueType: 'text', hidden: false },
        { key: 'age', prop: 'age', label: 'Age', valueType: 'digit', hidden: false },
      ]
      const cat = categorizeNormalColumns(columns)

      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: cat.hoverOptionColumns,
        displayNormalColumns: cat.displayNormalColumns,
        hasTeleport: cat.hasTeleport,
        hasFixed: false,
        allKeepAlive: cat.allKeepAlive,
      })

      expect(result.hoverOptionColumns.value).toEqual([])
      expect(result.displayNormalColumns.value).toHaveLength(2)
      expect(result.hasHoverOptionColumns.value).toBe(false)
    })
  })

  describe('hoverOptionTeleport', () => {
    it('should be false when hasTeleport is false', () => {
      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: [{ key: 'action', prop: 'action', valueType: 'option', hoverActions: true, hidden: false } as unknown as ProcessedColumn],
        displayNormalColumns: [],
        hasTeleport: false,
        hasFixed: false,
        allKeepAlive: true,
      })

      expect(result.hoverOptionTeleport.value).toBe(false)
    })

    it('should be true when hasTeleport is true', () => {
      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: [{ key: 'action', prop: 'action', valueType: 'option', hoverActions: { teleport: true }, hidden: false } as unknown as ProcessedColumn],
        displayNormalColumns: [],
        hasTeleport: true,
        hasFixed: false,
        allKeepAlive: true,
      })

      expect(result.hoverOptionTeleport.value).toBe(true)
    })

    it('should be false when hasTeleport is false with object hoverActions', () => {
      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: [{ key: 'action', prop: 'action', valueType: 'option', hoverActions: { teleport: false }, hidden: false } as unknown as ProcessedColumn],
        displayNormalColumns: [],
        hasTeleport: false,
        hasFixed: false,
        allKeepAlive: true,
      })

      expect(result.hoverOptionTeleport.value).toBe(false)
    })
  })

  describe('hoverOptionTeleport with auto mode', () => {
    it('should be false when teleport is auto and no fixed columns', () => {
      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: [{ key: 'action', prop: 'action', valueType: 'option', hoverActions: { teleport: 'auto' }, hidden: false } as unknown as ProcessedColumn],
        displayNormalColumns: [],
        hasTeleport: false,
        hasFixed: false,
        allKeepAlive: true,
      })

      expect(result.hoverOptionTeleport.value).toBe(false)
    })

    it('should be true when teleport is auto and has fixed columns', () => {
      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: [{ key: 'action', prop: 'action', valueType: 'option', hoverActions: { teleport: 'auto' }, hidden: false } as unknown as ProcessedColumn],
        displayNormalColumns: [],
        hasTeleport: false,
        hasFixed: true,
        allKeepAlive: true,
      })

      expect(result.hoverOptionTeleport.value).toBe(true)
    })

    it('should be true when teleport is auto and has fixed columns regardless of hasTeleport', () => {
      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: [{ key: 'action', prop: 'action', valueType: 'option', hoverActions: { teleport: 'auto' }, hidden: false } as unknown as ProcessedColumn],
        displayNormalColumns: [],
        hasTeleport: true,
        hasFixed: true,
        allKeepAlive: true,
      })

      expect(result.hoverOptionTeleport.value).toBe(true)
    })

    it('should be false when teleport is auto and no fixed columns regardless of hasTeleport', () => {
      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: [{ key: 'action', prop: 'action', valueType: 'option', hoverActions: { teleport: 'auto' }, hidden: false } as unknown as ProcessedColumn],
        displayNormalColumns: [],
        hasTeleport: true,
        hasFixed: false,
        allKeepAlive: true,
      })

      expect(result.hoverOptionTeleport.value).toBe(false)
    })

    it('should fall back to hasTeleport when teleport is not auto', () => {
      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: [{ key: 'action', prop: 'action', valueType: 'option', hoverActions: { teleport: true }, hidden: false } as unknown as ProcessedColumn],
        displayNormalColumns: [],
        hasTeleport: true,
        hasFixed: false,
        allKeepAlive: true,
      })

      expect(result.hoverOptionTeleport.value).toBe(true)
    })
  })

  describe('hoverOptionTeleport with false mode', () => {
    it('should be false when teleport is false and no fixed columns', () => {
      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: [{ key: 'action', prop: 'action', valueType: 'option', hoverActions: { teleport: false }, hidden: false } as unknown as ProcessedColumn],
        displayNormalColumns: [],
        hasTeleport: false,
        hasFixed: false,
        allKeepAlive: true,
      })

      expect(result.hoverOptionTeleport.value).toBe(false)
    })

    it('should be false when teleport is false even with fixed columns', () => {
      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: [{ key: 'action', prop: 'action', valueType: 'option', hoverActions: { teleport: false }, hidden: false } as unknown as ProcessedColumn],
        displayNormalColumns: [],
        hasTeleport: true,
        hasFixed: true,
        allKeepAlive: true,
      })

      expect(result.hoverOptionTeleport.value).toBe(false)
    })

    it('should be false when teleport is false regardless of hasTeleport', () => {
      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: [{ key: 'action', prop: 'action', valueType: 'option', hoverActions: { teleport: false }, hidden: false } as unknown as ProcessedColumn],
        displayNormalColumns: [],
        hasTeleport: true,
        hasFixed: false,
        allKeepAlive: true,
      })

      expect(result.hoverOptionTeleport.value).toBe(false)
    })
  })

  describe('hoverOptionTeleport reactivity', () => {
    it('should reactively update when hasFixed changes', () => {
      const hasFixedRef = ref(false)
      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: [{ key: 'action', prop: 'action', valueType: 'option', hoverActions: { teleport: 'auto' }, hidden: false } as unknown as ProcessedColumn],
        displayNormalColumns: [],
        hasTeleport: false,
        hasFixed: hasFixedRef,
        allKeepAlive: true,
      })

      expect(result.hoverOptionTeleport.value).toBe(false)

      hasFixedRef.value = true
      expect(result.hoverOptionTeleport.value).toBe(true)

      hasFixedRef.value = false
      expect(result.hoverOptionTeleport.value).toBe(false)
    })

    it('should hasFixed computed reflect source value', () => {
      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: [],
        displayNormalColumns: [],
        hasTeleport: false,
        hasFixed: true,
        allKeepAlive: true,
      })

      expect(result.hasFixed.value).toBe(true)
    })
  })

  describe('keepAlive', () => {
    it('should be true when allKeepAlive is true', () => {
      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: [{ key: 'action', prop: 'action', valueType: 'option', hoverActions: true, hidden: false } as unknown as ProcessedColumn],
        displayNormalColumns: [],
        hasTeleport: false,
        hasFixed: false,
        allKeepAlive: true,
      })

      expect(result.keepAlive.value).toBe(true)
    })

    it('should be false when allKeepAlive is false', () => {
      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: [{ key: 'action', prop: 'action', valueType: 'option', hoverActions: { keepAlive: false }, hidden: false } as unknown as ProcessedColumn],
        displayNormalColumns: [],
        hasTeleport: false,
        hasFixed: false,
        allKeepAlive: false,
      })

      expect(result.keepAlive.value).toBe(false)
    })

    it('should be true when allKeepAlive is true with multiple hover columns', () => {
      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: [
          { key: 'action1', prop: 'action1', valueType: 'option', hoverActions: true, hidden: false } as unknown as ProcessedColumn,
          { key: 'action2', prop: 'action2', valueType: 'option', hoverActions: true, hidden: false } as unknown as ProcessedColumn,
        ],
        displayNormalColumns: [],
        hasTeleport: false,
        hasFixed: false,
        allKeepAlive: true,
      })

      expect(result.keepAlive.value).toBe(true)
    })

    it('should be false when allKeepAlive is false even with multiple hover columns', () => {
      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: [
          { key: 'action1', prop: 'action1', valueType: 'option', hoverActions: { keepAlive: false }, hidden: false } as unknown as ProcessedColumn,
          { key: 'action2', prop: 'action2', valueType: 'option', hoverActions: true, hidden: false } as unknown as ProcessedColumn,
        ],
        displayNormalColumns: [],
        hasTeleport: false,
        hasFixed: false,
        allKeepAlive: false,
      })

      expect(result.keepAlive.value).toBe(false)
    })
  })

  describe('selectionColumnSyncKey', () => {
    it('should generate sync key from selection columns', () => {
      const result = useColumnCategorization({
        selectionColumns: [
          { key: 'selection', prop: '_selection', label: 'Selection', hidden: false },
        ],
        hoverOptionColumns: [],
        displayNormalColumns: [],
        hasTeleport: false,
        hasFixed: false,
        allKeepAlive: true,
      })

      expect(result.selectionColumnSyncKey.value).toBe('selection')
    })

    it('should use prop when column has no key', () => {
      const result = useColumnCategorization({
        selectionColumns: [
          { prop: '_selection', label: 'Selection', hidden: false },
        ],
        hoverOptionColumns: [],
        displayNormalColumns: [],
        hasTeleport: false,
        hasFixed: false,
        allKeepAlive: true,
      })

      expect(result.selectionColumnSyncKey.value).toBe('_selection')
    })

    it('should join multiple selection columns with pipe', () => {
      const result = useColumnCategorization({
        selectionColumns: [
          { key: 'sel1', prop: '_sel1', hidden: false },
          { key: 'sel2', prop: '_sel2', hidden: false },
        ],
        hoverOptionColumns: [],
        displayNormalColumns: [],
        hasTeleport: false,
        hasFixed: false,
        allKeepAlive: true,
      })

      expect(result.selectionColumnSyncKey.value).toBe('sel1|sel2')
    })
  })

  describe('multiple hoverActions columns', () => {
    it('should pass through multiple hover columns', () => {
      const columns: ProcessedColumn[] = [
        { key: 'name', prop: 'name', label: 'Name', hidden: false },
        { key: 'action1', prop: 'action1', valueType: 'option', hoverActions: true, hidden: false },
        { key: 'action2', prop: 'action2', valueType: 'option', hoverActions: true, hidden: false },
      ]
      const cat = categorizeNormalColumns(columns)

      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: cat.hoverOptionColumns,
        displayNormalColumns: cat.displayNormalColumns,
        hasTeleport: cat.hasTeleport,
        hasFixed: false,
        allKeepAlive: cat.allKeepAlive,
      })

      expect(result.hoverOptionColumns.value).toHaveLength(2)
      expect(result.displayNormalColumns.value).toHaveLength(1)
    })
  })

  describe('independent computed stability', () => {
    it('hoverOptionColumns and displayNormalColumns are mutually exclusive', () => {
      const columns: ProcessedColumn[] = [
        { key: 'name', prop: 'name', label: 'Name', hidden: false },
        { key: 'age', prop: 'age', label: 'Age', hidden: false },
        { key: 'action', prop: 'action', valueType: 'option', hoverActions: true, hidden: false },
      ]
      const cat = categorizeNormalColumns(columns)

      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: cat.hoverOptionColumns,
        displayNormalColumns: cat.displayNormalColumns,
        hasTeleport: cat.hasTeleport,
        hasFixed: false,
        allKeepAlive: cat.allKeepAlive,
      })

      const hoverKeys = result.hoverOptionColumns.value.map(c => c.prop)
      const displayKeys = result.displayNormalColumns.value.map(c => c.prop)

      expect(hoverKeys.every(k => !displayKeys.includes(k))).toBe(true)
      expect([...hoverKeys, ...displayKeys]).toHaveLength(3)
    })

    it('selectionColumnSyncKey is independent of hoverOptionColumns', () => {
      const selCols = ref<ProcessedColumn[]>([
        { key: 'sel', prop: '_sel', hidden: false },
      ])
      const hoverCols = ref<ProcessedColumn[]>([
        { key: 'action', prop: 'action', valueType: 'option', hoverActions: true, hidden: false },
      ])

      const result = useColumnCategorization({
        selectionColumns: selCols,
        hoverOptionColumns: hoverCols,
        displayNormalColumns: [],
        hasTeleport: false,
        hasFixed: false,
        allKeepAlive: true,
      })

      const syncKey1 = result.selectionColumnSyncKey.value
      expect(syncKey1).toBe('sel')

      hoverCols.value = []
      expect(result.selectionColumnSyncKey.value).toBe('sel')

      selCols.value = [
        { key: 'sel1', prop: '_sel1', hidden: false },
        { key: 'sel2', prop: '_sel2', hidden: false },
      ]
      expect(result.selectionColumnSyncKey.value).toBe('sel1|sel2')
    })

    it('keepAlive is true when no hover columns exist', () => {
      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: [],
        displayNormalColumns: [{ key: 'name', prop: 'name', label: 'Name', hidden: false } as unknown as ProcessedColumn],
        hasTeleport: false,
        hasFixed: false,
        allKeepAlive: true,
      })
      expect(result.keepAlive.value).toBe(true)
      expect(result.hasHoverOptionColumns.value).toBe(false)
    })

    it('hoverOptionTeleport is false when no hover columns exist', () => {
      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: [],
        displayNormalColumns: [{ key: 'name', prop: 'name', label: 'Name', hidden: false } as unknown as ProcessedColumn],
        hasTeleport: false,
        hasFixed: false,
        allKeepAlive: true,
      })
      expect(result.hoverOptionTeleport.value).toBe(false)
    })
  })

  describe('reactive source updates', () => {
    it('should reactively update when hoverOptionColumns ref changes', () => {
      const hoverCols = ref<ProcessedColumn[]>([
        { key: 'action1', prop: 'action1', valueType: 'option', hoverActions: true, hidden: false },
      ])
      const displayCols = ref<ProcessedColumn[]>([
        { key: 'name', prop: 'name', label: 'Name', hidden: false },
      ])

      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: hoverCols,
        displayNormalColumns: displayCols,
        hasTeleport: ref(false),
        hasFixed: false,
        allKeepAlive: ref(true),
      })

      expect(result.hoverOptionColumns.value).toHaveLength(1)
      expect(result.displayNormalColumns.value).toHaveLength(1)
      expect(result.hasHoverOptionColumns.value).toBe(true)
      expect(result.hoverOptionTeleport.value).toBe(false)
      expect(result.keepAlive.value).toBe(true)

      hoverCols.value = []
      displayCols.value = [
        { key: 'name', prop: 'name', label: 'Name', hidden: false },
        { key: 'age', prop: 'age', label: 'Age', hidden: false },
      ]

      expect(result.hoverOptionColumns.value).toHaveLength(0)
      expect(result.displayNormalColumns.value).toHaveLength(2)
      expect(result.hasHoverOptionColumns.value).toBe(false)
      expect(result.hoverOptionTeleport.value).toBe(false)
      expect(result.keepAlive.value).toBe(true)
    })

    it('should not recompute hoverOptionColumns when selectionColumns changes', () => {
      const hoverCols = ref<ProcessedColumn[]>([
        { key: 'action', prop: 'action', valueType: 'option', hoverActions: true, hidden: false },
      ])
      const selCols = ref<ProcessedColumn[]>([
        { key: 'sel', prop: '_sel', hidden: false },
      ])

      const result = useColumnCategorization({
        selectionColumns: selCols,
        hoverOptionColumns: hoverCols,
        displayNormalColumns: [],
        hasTeleport: false,
        hasFixed: false,
        allKeepAlive: true,
      })

      const initialHover = result.hoverOptionColumns.value

      selCols.value = [
        { key: 'sel1', prop: '_sel1', hidden: false },
        { key: 'sel2', prop: '_sel2', hidden: false },
      ]

      expect(result.hoverOptionColumns.value).toBe(initialHover)
      expect(result.hasHoverOptionColumns.value).toBe(true)
    })
  })

  describe('computed reference stability', () => {
    it('should return same array reference when source ref is unchanged', () => {
      const hoverCols = ref<ProcessedColumn[]>([
        { key: 'action', prop: 'action', valueType: 'option', hoverActions: true, hidden: false },
      ])

      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: hoverCols,
        displayNormalColumns: [],
        hasTeleport: false,
        hasFixed: false,
        allKeepAlive: true,
      })

      const firstAccess = result.hoverOptionColumns.value
      const secondAccess = result.hoverOptionColumns.value

      expect(secondAccess).toBe(firstAccess)
    })

    it('hoverOptionTeleport and keepAlive return scalar values directly', () => {
      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: [],
        displayNormalColumns: [{ key: 'name', prop: 'name', label: 'Name', hidden: false } as unknown as ProcessedColumn],
        hasTeleport: false,
        hasFixed: false,
        allKeepAlive: true,
      })

      expect(result.hasHoverOptionColumns.value).toBe(false)
      expect(result.hoverOptionTeleport.value).toBe(false)
      expect(result.keepAlive.value).toBe(true)
    })
  })

  describe('full categorization integration', () => {
    it('should compute all values from pre-categorized inputs', () => {
      const columns: ProcessedColumn[] = [
        { key: 'action1', prop: 'action1', valueType: 'option', hoverActions: { teleport: true, keepAlive: false }, hidden: false },
        { key: 'action2', prop: 'action2', valueType: 'option', hoverActions: true, hidden: false },
        { key: 'name', prop: 'name', label: 'Name', hidden: false },
      ]
      const cat = categorizeNormalColumns(columns)

      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: cat.hoverOptionColumns,
        displayNormalColumns: cat.displayNormalColumns,
        hasTeleport: cat.hasTeleport,
        hasFixed: false,
        allKeepAlive: cat.allKeepAlive,
      })

      expect(result.hoverOptionColumns.value).toHaveLength(2)
      expect(result.hoverOptionColumns.value.map(c => c.prop)).toEqual(['action1', 'action2'])
      expect(result.displayNormalColumns.value).toHaveLength(1)
      expect(result.displayNormalColumns.value[0].prop).toBe('name')
      expect(result.hasHoverOptionColumns.value).toBe(true)
      expect(result.hoverOptionTeleport.value).toBe(true)
      expect(result.keepAlive.value).toBe(false)
    })

    it('should reactively update when source refs change', () => {
      const hoverCols = ref<ProcessedColumn[]>([
        { key: 'action1', prop: 'action1', valueType: 'option', hoverActions: true, hidden: false },
      ])
      const displayCols = ref<ProcessedColumn[]>([
        { key: 'name', prop: 'name', label: 'Name', hidden: false },
      ])
      const teleportRef = ref(false)
      const keepAliveRef = ref(true)

      const result = useColumnCategorization({
        selectionColumns: [],
        hoverOptionColumns: hoverCols,
        displayNormalColumns: displayCols,
        hasTeleport: teleportRef,
        hasFixed: false,
        allKeepAlive: keepAliveRef,
      })

      expect(result.hoverOptionColumns.value).toHaveLength(1)
      expect(result.displayNormalColumns.value).toHaveLength(1)
      expect(result.hasHoverOptionColumns.value).toBe(true)
      expect(result.hoverOptionTeleport.value).toBe(false)
      expect(result.keepAlive.value).toBe(true)

      hoverCols.value = []
      displayCols.value = [
        { key: 'name', prop: 'name', label: 'Name', hidden: false },
        { key: 'age', prop: 'age', label: 'Age', hidden: false },
      ]
      teleportRef.value = true
      keepAliveRef.value = false

      expect(result.hoverOptionColumns.value).toHaveLength(0)
      expect(result.displayNormalColumns.value).toHaveLength(2)
      expect(result.hasHoverOptionColumns.value).toBe(false)
      expect(result.hoverOptionTeleport.value).toBe(true)
      expect(result.keepAlive.value).toBe(false)
    })
  })
})
