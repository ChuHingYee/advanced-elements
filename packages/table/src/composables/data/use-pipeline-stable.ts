/**
 * <zh/> 管线 prev 稳定性纯函数——自 use-table-data-pipeline.ts 拆出（COMPLEXITY-PLAN 战线三，
 * <zh/> 刀法 A），主体逐字未改；主文件与筛选/排序引擎共用。
 * <en/> Pipeline prev-stability pure helpers — split out of use-table-data-pipeline.ts
 * <en/> (COMPLEXITY-PLAN battle line 3, knife A), bodies unchanged; shared by the main file
 * <en/> and the filter/sort engine.
 */

/**
 * <zh/> 引用相同则返回 prev，否则返回 next——用于管线中“透传/条件选择”型 computed 的 prev 稳定性优化 | <en/> Return prev when same reference, otherwise next — for pipeline 'pass-through / conditional-select' computed prev stability optimization
 */
export function refStable<T extends unknown[]>(prev: T | undefined, next: T): T {
  return prev && prev === next ? prev : next
}

/**
 * <zh/> 逐元素引用比较后返回 prev，否则返回 next——用于管线中“filter/flatten”型 computed 的 prev 稳定性优化 | <en/> Return prev when all element references match, otherwise next — pipeline 'filter/flatten' computed prev stability optimization
 */
export function shallowArrayStable<T extends unknown[]>(prev: T | undefined, next: T): T {
  if (prev && prev.length === next.length) {
    let allSame = true
    for (let i = 0; i < next.length; i++) {
      if (prev[i] !== next[i]) {
        allSame = false
        break
      }
    }
    if (allSame)
      return prev
  }
  return next
}

/**
 * <zh/> 穷尽性断言——用于 switch 的 default 分支：新增联合成员未处理时在编译期失败。
 * <en/> Exhaustiveness assertion — used in a switch's default branch: adding an unhandled union
 * member fails at compile time.
 */
export function assertNever(value: never): never {
  throw new Error(`[AdvTable] Unhandled pipeline stage: ${String(value)}`)
}
