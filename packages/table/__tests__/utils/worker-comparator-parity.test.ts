import { describe, expect, it } from 'vitest'
import { compareSortValues } from '../../src/utils/sort-comparator'
import { SORT_WORKER_INLINE_SOURCE } from '../../src/utils/worker-blob'

/**
 * <zh/> Worker 比较器一致性契约测试（冗余收编守卫）。
 *
 * <zh/> 背景：严格 CSP 下排序 Worker 以字符串形式内联一份 compareSortValues 镜像
 * <zh/> （worker-blob.ts），与主线程 sort-comparator.ts 构成两份必须保持行为一致的实现。
 * <zh/> 此前仅靠注释约定同步——任何一侧漂移都会导致主线程与 Worker 排序结果不一致的静默缺陷。
 * <zh/> 本测试对 Worker 源码串求值，提取其 compareSortValues，在多类型语料上与主线程
 * <zh/> 实现做逐对序号等价断言；任一侧未来被单方面修改即红灯。
 *
 * <en/> Worker comparator parity contract test (dedup guard).
 *
 * <en/> Background: under strict CSP the sort worker inlines a string-mirrored copy of
 * <en/> compareSortValues (worker-blob.ts), forming two implementations that MUST stay behaviorally
 * <en/> identical with the main-thread sort-comparator.ts. Sync was previously comment-enforced —
 * <en/> drift would silently make main-thread and worker orderings disagree. This test evaluates the
 * <en/> worker source string, extracts its compareSortValues, and asserts pairwise ordering
 * <en/> equivalence against the main-thread implementation over a multi-type corpus; any one-sided
 * <en/> future change turns this red.
 */

/** <zh/> 在沙箱函数作用域中求值 Worker 源码并提取其 compareSortValues | <en/> Evaluate the worker source in a sandboxed function scope and extract its compareSortValues */
function loadWorkerComparator(): (a: unknown, b: unknown, multiplier: number) => number {
  // <zh/> 有意求值受控源码串（仓库内常量，非用户输入）——这正是本契约测试的目的
  // <en/> Intentionally evaluates a controlled in-repo constant (not user input) — that IS the purpose of this parity test
  // eslint-disable-next-line no-new-func
  const factory = new Function(`${SORT_WORKER_INLINE_SOURCE};\nreturn compareSortValues;`)
  const fn = factory()
  expect(typeof fn).toBe('function')
  return fn as (a: unknown, b: unknown, multiplier: number) => number
}

const corpus: unknown[] = [
  0,
  1,
  -5,
  3.5,
  Number.NaN,
  '',
  'apple',
  'Banana',
  'apple2',
  'apple10',
  null,
  undefined,
  true,
  false,
]

describe('worker/main-thread sort comparator parity', () => {
  const workerCompare = loadWorkerComparator()

  it('exposes the inlined source with a compareSortValues definition', () => {
    expect(SORT_WORKER_INLINE_SOURCE).toContain('function compareSortValues(')
  })

  it('produces identical pairwise orderings to the main-thread comparator', () => {
    for (const multiplier of [1, -1] as const) {
      for (const a of corpus) {
        for (const b of corpus) {
          const mainSign = Math.sign(compareSortValues(a, b, multiplier))
          const workerSign = Math.sign(workerCompare(a, b, multiplier))
          // <zh/> 零值归属必须一致；非零时符号必须一致（同值 tie 的稳定排序兜底不在此列）
          // <en/> zero-ness must agree; for non-zero results the signs must match
          const parity = ((mainSign === 0) === (workerSign === 0))
            && (mainSign === 0 || mainSign === workerSign)
          expect(
            parity,
            `[main=${mainSign} worker=${workerSign}] a=${String(a)} b=${String(b)} m=${multiplier}`,
          ).toBe(true)
        }
      }
    }
  })

  it('sorts an identically-seeded array into the same order on both sides', () => {
    const seed = ['b10', 'b9', 'a2', 'a10', null, 3, 1, 'B1', undefined, new Date('2024-01-02'), new Date('2023-05-01'), Number.NaN]
    const byMain = [...seed].sort((x, y) => compareSortValues(x, y, 1))
    const byWorker = [...seed].sort((x, y) => workerCompare(x, y, 1))

    // <zh/> null 恒排末尾且相互相等——由稳定排序决定次序，故仅断言可区分段的一致性：
    // <zh/> 全序列在"非 null 前缀 + null 后缀"划分下必须完全一致。
    // <en/> nulls always sink last and compare equal among themselves — stable-sort decides their
    // <en/> internal order, so assert full equality under the "non-null prefix + null suffix" split.
    const split = (arr: unknown[]) => ({
      head: arr.slice(0, arr.findIndex(v => v == null)).map(String),
      tailCount: arr.filter(v => v == null).length,
    })
    expect(split(byWorker)).toEqual(split(byMain))
    // NaN 归类为相等（0），同样交给稳定排序——非空段仍需一致
    expect(byMain.filter(v => v != null).map(String)).toEqual(byWorker.filter(v => v != null).map(String))
  })
})
