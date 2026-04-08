import type { DecorationRangeRect, RowViewModel } from '../../src/composables/view-model/use-row-view-model'
import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { computed, shallowRef } from 'vue'
import { useRowViewModel } from '../../src/composables/view-model/use-row-view-model'

/**
 * Sparse RowViewModel tests:
 * 1. invalidation matrix — every decoration dimension hits exactly its affected rows
 * 2. reference stability — untouched rows keep object/cells references (dense-parity)
 * 3. evaluation bound — predicate call counts scale with affected rows x columns, not n*m
 * 4. dense-vs-sparse equivalence — identical outputs over a randomized trajectory
 */
describe('useRowViewModel sparse mode', () => {
  // keyFn must stay referentially stable across calls (production wires via a computed);
  // instability triggers an inputsReset full rebuild (safe degradation, not a correctness issue)
  const keyFnStable = (row: any) => String(row.id)

  function makeColsValue(n: number): ProcessedColumn[] {
    return Array.from({ length: n }, (_, i) =>
      ({ prop: `c${i}`, key: `c${i}`, label: `C${i}`, hidden: false }) as unknown as ProcessedColumn)
  }

  function makeCols(n: number) {
    return computed<ProcessedColumn[]>(() => makeColsValue(n))
  }

  function makeRows(n: number) {
    return Array.from({ length: n }, (_, i) => ({ id: i + 1, v: i * 2 }))
  }

  /**
   * Predicate semantics mirror the real implementation's addressing:
   * - isCellEditing: index domain (editingCell.rowIndex / fullRow editingRowIndex)
   * - isCellDirty: rowKey-domain membership (mirrors use-edit-dirty Map.has early return)
   * - isCellSelected: rect domain
   * snapshot aggregates all sources — mimics the orchestrator's dependency-parity wiring
   */
  function createHarness(rowCount = 300, colCount = 10) {
    const data = shallowRef(makeRows(rowCount))
    const columns = makeCols(colCount)
    const editingCell = shallowRef<{ rowIndex: number, columnKey: string } | null>(null)
    const editingRowIndex = shallowRef<number | null>(null)
    const isFullRowEdit = shallowRef(false)
    const range = shallowRef<DecorationRangeRect | null>(null)
    const dirtyRowKeys = shallowRef<ReadonlySet<string>>(new Set())
    const dirtyTrackingEnabled = shallowRef(true)

    const counts = { editing: 0, dirty: 0, selected: 0 }

    const { rowViewModels } = useRowViewModel<any>({
      visibleData: data,
      rowKeyFn: () => keyFnStable,
      isCellEditing(rowIndex, colKey) {
        counts.editing++
        if (isFullRowEdit.value)
          return editingRowIndex.value === rowIndex
        return editingCell.value?.rowIndex === rowIndex && editingCell.value.columnKey === colKey
      },
      isCellDirty(rowIndex, _colKey) {
        counts.dirty++
        if (!dirtyTrackingEnabled.value)
          return false
        const row = data.value[rowIndex]
        if (!row)
          return false
        return dirtyRowKeys.value.has(String(row.id))
      },
      isCellSelected(rowIndex, colIndex) {
        counts.selected++
        const r = range.value
        if (!r)
          return false
        return rowIndex >= r.startRow && rowIndex <= r.endRow && colIndex >= r.startCol && colIndex <= r.endCol
      },
      columns,
      snapshot: () => ({
        editingCell: editingCell.value,
        editingRowIndex: editingRowIndex.value,
        isFullRowEdit: isFullRowEdit.value,
        rangeSelection: range.value,
        dirtyRowKeys: dirtyRowKeys.value,
        dirtyTrackingEnabled: dirtyTrackingEnabled.value,
      }),
    })

    return {
      vm: rowViewModels,
      data,
      columns,
      editingCell,
      editingRowIndex,
      isFullRowEdit,
      range,
      dirtyRowKeys,
      dirtyTrackingEnabled,
      counts,
      rowCount,
      colCount,
    }
  }

  type Harness = ReturnType<typeof createHarness>

  /** reset counters and read vm once (drives computed recomputation) */
  function rerun(h: Harness) {
    h.counts.editing = 0
    h.counts.dirty = 0
    h.counts.selected = 0
    return h.vm.value
  }

  it('initial run evaluates every row once (dense-equivalent baseline)', () => {
    const h = createHarness()
    const vms = rerun(h)
    expect(vms).toHaveLength(h.rowCount)
    expect(h.counts.editing).toBe(h.rowCount * h.colCount)
    // clean table shares the EMPTY singleton
    expect(vms[0].cells[0]).toBe(vms[1].cells[0])
  })

  it('single-cell edit start touches only the edited row', () => {
    const h = createHarness()
    rerun(h)

    const before = h.vm.value.slice()
    h.editingCell.value = { rowIndex: 5, columnKey: 'c3' }
    const vms = rerun(h)

    expect(vms[5].cells[3].isEditing).toBe(true)
    expect(vms[5].cells[4].isEditing).toBe(false)
    for (let i = 0; i < h.rowCount; i++) {
      if (i !== 5)
        expect(vms[i]).toBe(before[i])
    }
    // bound: 1 row x m columns (not 300 x m)
    expect(h.counts.editing).toBe(h.colCount)
    expect(h.counts.dirty).toBe(h.colCount)
    expect(h.counts.selected).toBe(h.colCount)
  })

  it('edit move marks both vacated and newly-edited rows', () => {
    const h = createHarness()
    h.editingCell.value = { rowIndex: 5, columnKey: 'c3' }
    rerun(h)

    h.editingCell.value = { rowIndex: 9, columnKey: 'c1' }
    const vms = rerun(h)

    expect(vms[5].cells[3].isEditing).toBe(false)
    expect(vms[9].cells[1].isEditing).toBe(true)
    expect(h.counts.editing).toBe(2 * h.colCount)
  })

  it('dirty key-set transitions hit exactly the record-holding rows', () => {
    const h = createHarness()
    rerun(h)

    const before = h.vm.value.slice()
    h.dirtyRowKeys.value = new Set(['7'])
    let vms = rerun(h)

    expect(vms[6].cells.every(c => c.isDirty)).toBe(true)
    for (let i = 0; i < h.rowCount; i++) {
      if (i !== 6)
        expect(vms[i]).toBe(before[i])
    }
    expect(h.counts.editing).toBe(h.colCount)

    // removing the record restores a clean state sharing EMPTY_CELL_STATE
    h.dirtyRowKeys.value = new Set()
    vms = rerun(h)
    expect(vms[6].cells[0].isDirty).toBe(false)
    expect(vms[6].cells[0]).toBe(vms[0].cells[0])
  })

  it('range move applies union semantics; vacated rows clear their flag', () => {
    const h = createHarness(100, 6)
    h.range.value = { startRow: 0, endRow: 4, startCol: 0, endCol: 5 }
    rerun(h)

    const afterFirst = h.vm.value.slice()
    h.range.value = { startRow: 3, endRow: 8, startCol: 0, endCol: 5 }
    const vms = rerun(h)

    // rows 0-2 leave the rect: cleared flags, rebuilt objects
    for (let i = 0; i < 3; i++) {
      expect(vms[i].cells[0].isRangeSelected).toBe(false)
      expect(vms[i]).not.toBe(afterFirst[i])
    }
    // rows 3-4 stay selected: cells references salvaged
    expect(vms[3].cells).toBe(afterFirst[3].cells)
    expect(vms[4].cells).toBe(afterFirst[4].cells)
    // rows 5-8 enter the rect
    for (let i = 5; i <= 8; i++)
      expect(vms[i].cells[0].isRangeSelected).toBe(true)
    // outside the union: wholesale object reuse
    expect(vms[50]).toBe(afterFirst[50])
    expect(h.counts.selected).toBeLessThanOrEqual(9 * 6)
  })

  it('showStatus flip triggers full rebuild', () => {
    const h = createHarness(50, 4)
    rerun(h)

    h.dirtyTrackingEnabled.value = false
    rerun(h)
    expect(h.counts.editing).toBe(50 * 4)
  })

  it('fullRow mode flip triggers full rebuild and honors editingRowIndex', () => {
    const h = createHarness(50, 4)
    rerun(h)

    h.isFullRowEdit.value = true
    rerun(h)
    expect(h.counts.editing).toBe(50 * 4)

    // fullRow 下先设定编辑行（null -> 3，仅新行受影响），再移动（3 -> 7，新旧两行）
    h.editingRowIndex.value = 3
    let vms = rerun(h)
    expect(h.counts.editing).toBe(4)
    expect(vms[3].cells.every(c => c.isEditing)).toBe(true)

    h.editingRowIndex.value = 7
    vms = rerun(h)
    expect(h.counts.editing).toBe(2 * 4)
    expect(vms[3].cells.every(c => c.isEditing)).toBe(false)
    expect(vms[7].cells.every(c => c.isEditing)).toBe(true)
  })

  it('data swap re-evaluates only marked domains; moved rows skip evaluation', () => {
    const h = createHarness(200, 5)
    h.dirtyRowKeys.value = new Set(['42'])
    rerun(h)

    // simulate sorting — reverse the whole table (new array identity, every index shifts)
    h.data.value = [...h.data.value].reverse()
    const vms = rerun(h)

    // only the dirty-record row (id=42 at its new index) evaluated
    expect(h.counts.editing).toBe(5)
    expect(h.counts.dirty).toBe(5)
    // every row carries correct new position & data
    expect(vms[0].row.id).toBe(200)
    expect(vms[0].rowIndex).toBe(0)
    expect(vms[199].row.id).toBe(1)
    // dirty follows the physical row (rowKey domain)
    const dirtyIdx = vms.findIndex(vm => vm.row.id === 42)
    expect(vms[dirtyIdx].cells.every(c => c.isDirty)).toBe(true)
  })

  it('empty-data interlude keeps states consistent after refill', () => {
    const h = createHarness()
    h.dirtyRowKeys.value = new Set(['3'])
    rerun(h)

    const full = h.data.value
    h.data.value = []
    expect(rerun(h)).toHaveLength(0)

    h.data.value = full
    const vms = rerun(h)
    expect(vms).toHaveLength(h.rowCount)
    const dirtyIdx = vms.findIndex(vm => vm.row.id === 3)
    expect(vms[dirtyIdx].cells[0].isDirty).toBe(true)
  })

  it('column identity change triggers full rebuild', () => {
    const data = shallowRef(makeRows(20))
    const columns = shallowRef<ProcessedColumn[]>(makeColsValue(3))
    const editingCell = shallowRef<{ rowIndex: number, columnKey: string } | null>(null)
    const editingRowIndex = shallowRef<number | null>(null)
    const isFullRowEdit = shallowRef(false)
    const range = shallowRef<DecorationRangeRect | null>(null)
    const dirtyRowKeys = shallowRef<ReadonlySet<string>>(new Set())
    const counts = { editing: 0, dirty: 0, selected: 0 }

    const { rowViewModels } = useRowViewModel<any>({
      visibleData: data,
      rowKeyFn: () => keyFnStable,
      isCellEditing(rowIndex) {
        counts.editing++
        return editingCell.value?.rowIndex === rowIndex
      },
      isCellDirty() {
        counts.dirty++
        return dirtyRowKeys.value.size > 0
      },
      isCellSelected() {
        counts.selected++
        return false
      },
      columns: computed(() => columns.value),
      snapshot: () => ({
        editingCell: editingCell.value,
        editingRowIndex: editingRowIndex.value,
        isFullRowEdit: isFullRowEdit.value,
        rangeSelection: range.value,
        dirtyRowKeys: dirtyRowKeys.value,
        dirtyTrackingEnabled: true,
      }),
    })

    expect(rowViewModels.value).toHaveLength(20)
    expect(counts.editing).toBe(20 * 3)

    counts.editing = 0
    // same data behind a new array identity (columns unchanged) — no full rebuild
    data.value = [...data.value]
    expect(rowViewModels.value).toHaveLength(20)
    expect(counts.editing).toBeLessThanOrEqual(1)

    counts.editing = 0
    // column identity change (different count) — full rebuild realigned to the new width
    columns.value = makeColsValue(5)
    const vms = rowViewModels.value
    expect(counts.editing).toBe(20 * 5)
    expect(vms[0].cells).toHaveLength(5)
  })

  describe('dense-vs-sparse equivalence', () => {
    /** deterministic PRNG so the trajectory is reproducible */
    function mulberry32(seed: number) {
      return () => {
        seed |= 0
        seed = (seed + 0x6D2B79F5) | 0
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    }

    function serialize(vms: RowViewModel<any>[]) {
      return JSON.stringify(vms.map(vm => ({
        k: vm.rowKey,
        i: vm.rowIndex,
        c: vm.cells.map(c => [c.isEditing ? 1 : 0, c.isDirty ? 1 : 0, c.isRangeSelected ? 1 : 0]),
      })))
    }

    it('identical outputs over a randomized trajectory', () => {
      const rand = mulberry32(20260824)
      const N = 40
      const M = 4

      const denseData = shallowRef(makeRows(N))
      const sparseData = shallowRef(denseData.value)
      const denseCols = makeCols(M)
      const sparseCols = makeCols(M)

      // shared decoration sources — both instances consume the same state sequence
      const editingCell = shallowRef<{ rowIndex: number, columnKey: string } | null>(null)
      const editingRowIndex = shallowRef<number | null>(null)
      const isFullRowEdit = shallowRef(false)
      const range = shallowRef<DecorationRangeRect | null>(null)
      const dirtyRowKeys = shallowRef<ReadonlySet<string>>(new Set())
      const showStatus = shallowRef(true)

      function build(snapshot: boolean) {
        const src = snapshot ? sparseData : denseData
        return useRowViewModel<any>({
          visibleData: src,
          rowKeyFn: () => keyFnStable,
          isCellEditing(rowIndex, colKey) {
            if (isFullRowEdit.value)
              return editingRowIndex.value === rowIndex
            return editingCell.value?.rowIndex === rowIndex && editingCell.value.columnKey === colKey
          },
          isCellDirty(rowIndex, _colKey) {
            if (!showStatus.value)
              return false
            const row = src.value[rowIndex]
            if (!row)
              return false
            return dirtyRowKeys.value.has(String(row.id))
          },
          isCellSelected(rowIndex, colIndex) {
            const r = range.value
            if (!r)
              return false
            return rowIndex >= r.startRow && rowIndex <= r.endRow && colIndex >= r.startCol && colIndex <= r.endCol
          },
          columns: snapshot ? sparseCols : denseCols,
          ...(snapshot
            ? {
                snapshot: () => ({
                  editingCell: editingCell.value,
                  editingRowIndex: editingRowIndex.value,
                  isFullRowEdit: isFullRowEdit.value,
                  rangeSelection: range.value,
                  dirtyRowKeys: dirtyRowKeys.value,
                  dirtyTrackingEnabled: showStatus.value,
                }),
              }
            : {}),
        }).rowViewModels
      }

      const denseVm = build(false)
      const sparseVm = build(true)

      for (let step = 0; step < 120; step++) {
        const roll = rand()
        if (roll < 0.25) {
          editingCell.value = rand() < 0.3
            ? null
            : { rowIndex: Math.floor(rand() * N), columnKey: `c${Math.floor(rand() * M)}` }
        }
        else if (roll < 0.45) {
          const next = new Set(dirtyRowKeys.value)
          const id = String(1 + Math.floor(rand() * N))
          if (next.has(id))
            next.delete(id)
          else
            next.add(id)
          dirtyRowKeys.value = next
        }
        else if (roll < 0.65) {
          range.value = rand() < 0.3
            ? null
            : {
                startRow: Math.floor(rand() * N),
                endRow: Math.min(N - 1, Math.floor(rand() * N)),
                startCol: 0,
                endCol: M - 1,
              }
        }
        else if (roll < 0.75) {
          isFullRowEdit.value = !isFullRowEdit.value
        }
        else if (roll < 0.85) {
          showStatus.value = !showStatus.value
        }
        else {
          // data swap — apply the same permutation to two independent arrays
          const mode = Math.floor(rand() * 3)
          const d = [...denseData.value]
          if (mode === 0)
            d.reverse()
          else if (mode === 1)
            d.unshift(d.pop()!)
          else
            d.splice(Math.floor(rand() * d.length), 1)
          denseData.value = d
          sparseData.value = [...d]
        }

        const dOut = serialize(denseVm.value)
        const sOut = serialize(sparseVm.value)
        expect(sOut, `step ${step} divergence`).toBe(dOut)
      }
    })
  })
})
