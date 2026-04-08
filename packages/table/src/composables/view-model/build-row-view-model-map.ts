/**
 * @file build-row-view-model-map.ts
 * @description
 * <zh/> 从 RowViewModel 数组构建 rowKey → cells 的 Map，带内容比较缓存以避免不必要的 Map 重建。
 * <zh/> 提取为共享工具函数，消除 editing-orchestrator 与 editing-stub 中的重复逻辑。
 *
 * <en/> Builds a rowKey → cells Map from a RowViewModel array, with content-comparison cache
 * <en/> to avoid unnecessary Map rebuilds. Extracted as a shared utility to eliminate
 * <en/> duplicate logic between editing-orchestrator and editing-stub.
 */
import type { ComputedRef } from 'vue'
import type { CellState, RowViewModel } from './use-row-view-model'

/**
 * <zh/> 构建 rowViewModelMap 的 computed 回调——内容比较返回旧引用，避免不必要的 Map 重建。
 *
 * <zh/> 当行数与上次相同且每行的 cells 引用均未变时，直接返回旧 Map，避免触发下游 computed 级联重算。
 *
 * <en/> Computed callback for building rowViewModelMap — content comparison returns the old reference,
 * <en/> avoiding unnecessary Map rebuilds. When the row count is the same as last time and every row's
 * <en/> cells reference is unchanged, the old Map is returned directly to avoid triggering downstream
 * <en/> computed cascade recomputation.
 *
 * @param rowViewModels - <zh/> RowViewModel 数组的 ComputedRef | <en/> ComputedRef of RowViewModel array
 * @returns <zh/> computed 回调函数，接收 prev Map，返回新 Map 或复用 prev | <en/> computed callback that receives prev Map and returns new Map or reuses prev
 */
export function buildRowViewModelMap<T>(
  rowViewModels: ComputedRef<RowViewModel<T>[]>,
): (prev: Map<string, readonly CellState[]> | undefined) => Map<string, readonly CellState[]> {
  return (prev) => {
    const vms = rowViewModels.value
    if (prev && vms.length === prev.size) {
      let allMatch = true
      for (const vm of vms) {
        if (prev.get(vm.rowKey) !== vm.cells) {
          allMatch = false
          break
        }
      }
      if (allMatch)
        return prev
    }
    const map = new Map<string, readonly CellState[]>()
    for (const vm of vms) {
      map.set(vm.rowKey, vm.cells)
    }
    return map
  }
}
