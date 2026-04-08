import type { ProcessedColumn, SpanRange } from '../../src/types'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useCellSpan } from '../../src/composables/data/use-cell-span'

/**
 * <zh/> 单元格合并对抗用例——畸形声明式配置、用户函数返回值消毒、延迟建图边界与代际竞态，
 * <zh/> 目标是找出问题而非凑覆盖率。
 * <en/> Cell-span adversarial cases — malformed declarative configs, user-function output
 * <en/> sanitization, deferred-build boundaries and generation races; aimed at finding problems.
 */

function makeCols(props: string[]): ProcessedColumn[] {
  return props.map(p => ({ prop: p, key: p, label: p })) as unknown as ProcessedColumn[]
}

function makeSpan(props: string[], data: any[], options: Partial<Parameters<typeof useCellSpan>[0]> = {}) {
  return useCellSpan({
    data: ref(data),
    columns: ref(makeCols(props)),
    ...options,
  } as any)
}

describe('useCellSpan adversarial', () => {
  it('malformed ranges: negative origins, zero spans and missing props are skipped without polluting the map', () => {
    const ranges: SpanRange[] = [
      { row: -1, col: 0, rowspan: 2, colspan: 1 },
      { row: 0, col: -2, rowspan: 1, colspan: 2 },
      { row: 0, col: 0, rowspan: 0, colspan: 1 },
      { row: 0, col: 0, rowspan: 1, colspan: 0 },
      { row: 0, col: 9, rowspan: 2, colspan: 2 },
    ]
    const { spanMap, getSpanInfo } = makeSpan(['a', 'b'], [{ a: 1 }, { a: 2 }], { ranges: ref(ranges) as any })
    // <zh/> 非法起点/非法跨度全部跳过；越界列无 prop 可写，同样不产生条目
    // <en/> illegal origins/spans skipped; out-of-range columns have no prop, no entries either
    expect(spanMap.value.size).toBe(0)
    expect(getSpanInfo(0, 'a')).toBeUndefined()
  })

  it('overlapping declarative ranges merge by max (origin wins, no downgrade)', () => {
    const ranges: SpanRange[] = [
      { row: 0, col: 0, rowspan: 2, colspan: 1 },
      { row: 0, col: 0, rowspan: 3, colspan: 2 },
    ]
    const { getSpanInfo } = makeSpan(['a', 'b'], [{ a: 1 }, { a: 2 }, { a: 3 }], { ranges: ref(ranges) as any })
    const origin = getSpanInfo(0, 'a')!
    expect(origin.isOrigin).toBe(true)
    expect(origin.rowspan).toBe(3)
    expect(origin.colspan).toBe(2)
  })

  it('user spanMethod returning negative spans is clamped to a hidden cell (pinned semantics)', () => {
    // <zh/> 钉住消毒口径：负数跨度钳为 0（EP 语义的隐藏格）。-1 大概率是用户笔误，
    // <zh/> 但静默转 1 会渲染出两份相同单元格——钳 0 至少不产生重复渲染。
    // <en/> Pins the sanitization caliber: negative spans clamp to 0 (EP hidden-cell semantics).
    // <en/> -1 is likely a user typo, but silently promoting it to 1 would render duplicate cells.
    const userSpanMethod = () => ({ rowspan: -1, colspan: 2 })
    const row = { a: 1 }
    const { getSpanInfo, spanMethod } = makeSpan(['a', 'b'], [row], { userSpanMethod: ref(userSpanMethod) as any })
    const info = getSpanInfo(0, 'a')!
    expect(info.rowspan).toBe(0)
    expect(info.colspan).toBe(2)
    expect(info.isOrigin).toBe(false)
    // <zh/> spanMethod 按行对象引用换算索引域——必须传数据中的同一行引用
    // <en/> spanMethod resolves the index domain by row-object identity — pass the same row reference
    const fn = spanMethod.value!
    expect(fn({ row, column: { prop: 'a' }, rowIndex: 0, columnIndex: 0 })).toEqual({ rowspan: 0, colspan: 0 })
  })

  it('user spanMethod returning NaN/Infinity falls back to a 1x1 cell instead of poisoning EP rendering', () => {
    const userSpanMethod = () => ({ rowspan: Number.NaN, colspan: Number.POSITIVE_INFINITY })
    const { getSpanInfo } = makeSpan(['a'], [{ a: 1 }], { userSpanMethod: ref(userSpanMethod) as any })
    const info = getSpanInfo(0, 'a')!
    expect(info.rowspan).toBe(1)
    expect(info.colspan).toBe(1)
    expect(info.isOrigin).toBe(true)
  })

  it('estimated ops exactly at deferThreshold take the synchronous path', async () => {
    // <zh/> 边界：ops == threshold 走同步（≤ 判定），isSpanPending 恒 false
    // <en/> boundary: ops == threshold is synchronous (≤), isSpanPending never flips
    // <zh/> 前 25 行同值 → 有连续段可合并；交替值无链不 produce 合并
    // <en/> first 25 rows share a value → a mergeable chain; alternating values never chain
    const rows = Array.from({ length: 50 }, (_, i) => ({ a: i < 25 ? 'x' : 'y' }))
    const onSpanLimitExceeded = vi.fn()
    const { isSpanPending, getSpanInfo } = makeSpan(['a'], rows, {
      rowSpanCells: ref({ a: true }) as any,
      deferThreshold: ref(50) as any,
      onSpanLimitExceeded,
    })
    await nextTick()
    expect(isSpanPending.value).toBe(false)
    expect(getSpanInfo(0, 'a')?.rowspan).toBeGreaterThan(1)
    expect(onSpanLimitExceeded).not.toHaveBeenCalled()
  })

  it('a deferred build superseded by newer data never commits stale results', async () => {
    vi.useFakeTimers()
    try {
      const data = ref<any[]>(Array.from({ length: 300 }, (_, i) => ({ a: i % 2 ? 'x' : 'y' })))
      const api = makeSpan(['a'], data.value, {
        dataRef: data,
        rowSpanCells: ref({ a: true }) as any,
        deferThreshold: ref(100) as any,
      })
      // <zh/> 首帧延迟建图排队后立刻换数据——旧任务必须作废，不落地旧图
      // <en/> queue the deferred build then swap data immediately — the stale task must be voided
      data.value = [{ a: 'single' }]
      await vi.advanceTimersByTimeAsync(200)
      await nextTick()
      // <zh/> 任意查询不抛错且映射与新数据一致（1 行无合并）
      // <en/> queries never throw and the map matches the NEW data (1 row, no merges)
      expect(api.getSpanInfo(0, 'a')).toBeUndefined()
      expect(api.isSpanPending.value).toBe(false)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('spanMethod keeps a stable function identity while the spanMap reference is unchanged', () => {
    const { spanMethod } = makeSpan(['a'], [{ a: 1 }], { rowSpanCells: ref({ a: true }) as any })
    const fn1 = spanMethod.value
    const fn2 = spanMethod.value
    expect(fn1).toBe(fn2)
  })

  it('getSpanInfo with a primitive rowData falls back to raw-index lookup (pinned semantics)', () => {
    // <zh/> 行域换算仅对对象行生效；原始值行回退原始索引直查（钉住口径防漂移）
    // <en/> row-domain translation applies to object rows only; primitives fall back to raw index
    const { getSpanInfo } = makeSpan(['a'], [{ a: 1 }, { a: 1 }], { rowSpanCells: ref({ a: true }) as any })
    expect(getSpanInfo(0, 'a', 'primitive-row' as any)).toBeDefined()
  })
})
