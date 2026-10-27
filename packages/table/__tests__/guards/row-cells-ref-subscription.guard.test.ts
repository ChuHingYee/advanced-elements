import type { UseEditingOrchestratorOptions } from '../../src/composables/editing/use-editing-orchestrator'
import type { ProcessedColumn } from '../../src/types'
import type { RowViewModelContext } from '../../src/types/config-tree'
import type { EditConfig } from '../../src/types/edit'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { computed, defineComponent, h, inject, nextTick, shallowRef, watchEffect } from 'vue'
import { createEditingAdapter } from '../../src/composables/editing/create-editing-stub'
import { advTableRowViewModelKey } from '../../src/types/injection-keys'

/**
 * <zh/> 锁定 RowViewModel 的订阅粒度契约：消费点必须经 getCellsRefByRowKey 只订阅本行 ref，
 * <zh/> 未受影响行的订阅回调不得被唤醒。读整表 Map 会把任意一行变化放大为全部可见单元格重渲染
 * <zh/>（100 行范围拖拽实测 10 次 long task / 804ms）。本守卫用行为断言而非字符串匹配锁住该约束。
 *
 * <en/> Locks the RowViewModel subscription-granularity contract: consumers MUST subscribe to a single
 * <en/> row ref via getCellsRefByRowKey, and unaffected rows' callbacks must never run. Reading the
 * <en/> whole-table Map amplifies any row change into a re-render of all visible cells (measured
 * <en/> 10 long tasks / 804ms while range-dragging 100 rows). Behavioural assertions, not string
 * <en/> matching, lock this constraint.
 */

const ROOT = resolve(import.meta.dirname, '../..')

interface Rect {
  startRow: number
  endRow: number
  startCol: number
  endCol: number
}

interface Row {
  id: string
}

/** <zh/> 挂载惰性编辑适配器（无 editConfig → 存根链），暴露注入的 RowViewModelContext | <en/> Mount the lazy editing adapter (no editConfig → stub chain) and expose the injected context */
function mountAdapter(initialRows: Row[]) {
  const editConfig = shallowRef<EditConfig>()
  const rowsRef = shallowRef(initialRows)
  const renderData = computed(() => rowsRef.value)
  const columns = shallowRef<ProcessedColumn[]>([{ prop: 'a' } as ProcessedColumn, { prop: 'b' } as ProcessedColumn])
  const rowKeyFn = computed(() => (row: Row) => row.id)
  const range = shallowRef<Rect | null>(null)
  let ctx!: RowViewModelContext
  const wrapper = mount(defineComponent({
    setup() {
      createEditingAdapter(
        { editConfig } as UseEditingOrchestratorOptions<Row>,
        renderData,
        columns,
        rowKeyFn,
        (rowIndex, colIndex) => {
          const rect = range.value
          return rect != null
            && rowIndex >= rect.startRow && rowIndex <= rect.endRow
            && colIndex >= rect.startCol && colIndex <= rect.endCol
        },
      )
      return () => h(defineComponent({
        setup() {
          ctx = inject(advTableRowViewModelKey)!
          return () => h('div')
        },
      }))
    },
  }))
  return { ctx, rowsRef, range, wrapper }
}

/** <zh/> 推进到下一次 flush（post-flush 桥接 + 渲染 effect） | <en/> Advance one flush (post-flush bridges + render effects) */
async function flush() {
  await nextTick()
  await nextTick()
}

describe('row cells ref subscription guard', () => {
  it('wakes only rows whose cells reference changed', async () => {
    const { ctx, range, wrapper } = mountAdapter([{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }])
    const runs: Record<string, number> = { r0: 0, r1: 0, r2: 0 }
    // 与 renderCell 同款读取：getter + 本行 ref 都在 effect 内，任何整表 Map 读取都会污染该 effect
    // Same read shape as renderCell: getter + own ref inside the effect, so any whole-map read pollutes it
    const stops = (['r0', 'r1', 'r2'] as const).map(key => watchEffect(() => {
      const cells = ctx.getCellsRefByRowKey(key).value
      void cells?.[0]?.isRangeSelected
      runs[key]++
    }))
    try {
      await flush()
      const base = { ...runs }
      expect(base.r0).toBeGreaterThan(0)

      const r0CellsBefore = ctx.getCellsRefByRowKey('r0').value

      range.value = { startRow: 2, endRow: 2, startCol: 0, endCol: 1 }
      await flush()
      expect(runs.r0).toBe(base.r0)
      expect(runs.r1).toBe(base.r1)
      expect(runs.r2).toBeGreaterThan(base.r2)
      expect(ctx.getCellsRefByRowKey('r2').value?.[0]?.isRangeSelected).toBe(true)
      expect(ctx.getCellsRefByRowKey('r0').value).toBe(r0CellsBefore)

      const afterR2 = runs.r2
      range.value = { startRow: 0, endRow: 0, startCol: 0, endCol: 0 }
      await flush()
      expect(runs.r1).toBe(base.r1)
      expect(runs.r0).toBeGreaterThan(base.r0)
      // 离开选区的行同样必须被唤醒以清除高亮 | Rows leaving the selection must wake to clear the highlight
      expect(runs.r2).toBeGreaterThan(afterR2)
    }
    finally {
      stops.forEach(stop => stop())
      wrapper.unmount()
    }
  })

  it('seeds late rows from the current map, reuses refs, and prunes removed rows', async () => {
    const { ctx, rowsRef, wrapper } = mountAdapter([{ id: 'r0' }, { id: 'r1' }])
    const runs: Record<string, number> = { r0: 0, r1: 0 }
    const stops = (['r0', 'r1'] as const).map(key => watchEffect(() => {
      void ctx.getCellsRefByRowKey(key).value
      runs[key]++
    }))
    try {
      await flush()
      const base = { ...runs }

      rowsRef.value = [...rowsRef.value, { id: 'r2' }]
      await flush()
      // 新增行（Map 换引用）不得唤醒既有行的订阅 | A new row (new Map reference) must not wake existing rows
      expect(runs.r0).toBe(base.r0)
      expect(runs.r1).toBe(base.r1)

      const lateRef = ctx.getCellsRefByRowKey('r2')
      expect(lateRef.value).toHaveLength(2)
      expect(ctx.getCellsRefByRowKey('r2')).toBe(lateRef)

      rowsRef.value = rowsRef.value.filter(row => row.id !== 'r2')
      await flush()
      expect(ctx.getCellsRefByRowKey('r2')).not.toBe(lateRef)
      expect(ctx.getCellsRefByRowKey('r2').value).toBeUndefined()
    }
    finally {
      stops.forEach(stop => stop())
      wrapper.unmount()
    }
  })

  it('cell render path reads the per-row ref, not the whole-table map', () => {
    const factory = readFileSync(resolve(ROOT, 'src/components/renderer-core/column-vnode-factory.ts'), 'utf-8')
    expect(factory).toContain('getCellsRefByRowKey')
    expect(factory).not.toMatch(/\.getCellsByRowKey\b/)
  })
})
