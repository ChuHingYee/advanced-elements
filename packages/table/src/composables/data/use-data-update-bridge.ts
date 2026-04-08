import type { ComputedRef, Ref } from 'vue'
import { buildKeyToIndexMap } from '../../utils/shared'

/**
 * <zh/> 数据更新来源
 *
 * <zh/> - `'full'`：newData 为全量数据，直接替换
 * <zh/> - `'view-slice'`（默认）：newData 来自视图切片（如分页后的可见数据），
 * <zh/>   需在全量 tableData 中按 rowKey 定位后逐行合并，避免切片覆盖全量数据
 *
 * <en/> Data update source
 *
 * <en/> - `'full'`: newData is the full dataset, replace directly
 * <en/> - `'view-slice'` (default): newData originates from a view slice (e.g. paginated visible data),
 * <en/>   rows are located by rowKey in the full tableData before merging, preventing the slice from overwriting the full dataset
 */
export type DataUpdateSource = 'full' | 'view-slice'

export interface UseDataUpdateBridgeOptions<T> {
  /**
   * <zh/> 全量数据 ref（pipeline 上游）
   * <en/> Full dataset ref (upstream of the pipeline)
   */
  tableData: Ref<T[]>
  /**
   * <zh/> 是否存在外部 request.source 数据源
   * <zh/> - true：通过 setResponseData 写回（不直接修改 v-model）
   * <zh/> - false：直接赋值 dataModel（v-model）
   *
   * <en/> Whether an external request.source data source exists
   * <en/> - true: write back via setResponseData (without directly mutating v-model)
   * <en/> - false: directly assign to dataModel (v-model)
   */
  hasSource: ComputedRef<boolean> | Ref<boolean>
  /**
   * <zh/> 写回远端数据源的回调（仅 hasSource=true 时使用）
   * <en/> Callback to write back to the remote data source (used only when hasSource=true)
   */
  setResponseData: (data: T[]) => void
  /**
   * <zh/> v-model 数据 ref（仅 hasSource=false 时使用）
   * <en/> v-model data ref (used only when hasSource=false)
   */
  dataModel: Ref<T[] | undefined>
  /**
   * <zh/> 行 key 解析函数
   * <en/> Row key resolver
   */
  rowKeyFn: ComputedRef<(row: T) => string>
}

export interface UseDataUpdateBridgeReturn<T> {
  /**
   * <zh/> 数据更新桥接——根据来源决定替换策略
   *
   * <zh/> 数据来源由调用方显式声明：'full' 全量数据直接替换，'view-slice' 视图切片合并进全量数据。
   *
   * <en/> Data update bridge — replacement strategy determined by source
   *
   * <en/> The caller explicitly declares the data source: 'full' replaces the full dataset,
   * <en/> 'view-slice' merges the view slice into the full dataset.
   *
   * @param newData - <zh/> 来自编辑层的数据快照 | <en/> data snapshot from editing layer
   * @param source - <zh/> 数据来源：'full' 全量数据 | 'view-slice' 视图切片（默认） | <en/> data source: 'full' for full dataset | 'view-slice' for view slice (default)
   */
  handleDataUpdate: (newData: T[], source?: DataUpdateSource) => void
}

/**
 * <zh/> 全量数据写入目标——远程/本地双路径的唯一收敛点
 * <zh/> 数据事务 writeFn 与桥接 'full' 分支共用，消除两处同构 if/else 漂移
 * <en/> Full-data write target — the single convergence point of the remote/local dual paths
 * <en/> Shared by the transaction writeFn and the bridge 'full' branch, preventing the two isomorphic if/else branches from drifting
 */
export interface FullDataWriteTarget<T> {
  /** <zh/> 是否存在外部数据源（为 true 时经 setResponseData 写回） | <en/> Whether an external data source exists (writes back via setResponseData when true) */
  hasSource: () => boolean
  /** <zh/> 写回远端数据源 | <en/> Write back to the remote data source */
  setResponseData: (data: T[]) => void
  /** <zh/> 写入本地数据模型（v-model） | <en/> Write to the local data model (v-model) */
  writeModel: (data: T[]) => void
}

/**
 * <zh/> 全量数据写入——纯函数，有 source 走远端回写，否则写本地模型
 * <en/> Full-data write — pure function; writes back remotely when a source exists, otherwise writes the local model
 */
export function writeFullData<T>(target: FullDataWriteTarget<T>, newData: T[]): void {
  if (target.hasSource())
    target.setResponseData(newData)
  else target.writeModel(newData)
}

/**
 * <zh/> 数据更新桥接 composable——将编辑层/导出层的数据快照写回数据层。
 *
 * <zh/> 写回逻辑位于数据层，使编辑编排器成为纯消费方，同时让导出/导入等非编辑路径也能复用同一写回逻辑。
 *
 * <en/> Data-update bridge composable — writes data snapshots from the editing/exporting layer back to the data layer.
 *
 * <en/> The write-back logic lives in the data layer, making the editing orchestrator a pure consumer,
 * <en/> while non-editing paths (e.g. export/import) can reuse the same write-back logic.
 */
export function useDataUpdateBridge<T>(options: UseDataUpdateBridgeOptions<T>): UseDataUpdateBridgeReturn<T> {
  const { tableData, hasSource, setResponseData, dataModel, rowKeyFn } = options

  function handleDataUpdate(newData: T[], source: DataUpdateSource = 'view-slice'): void {
    const fn = rowKeyFn.value
    const fullData = tableData.value

    // 全量数据或引用相同：直接替换，无需逐行合并
    // Full dataset or same reference: replace directly, no per-row merge needed
    if (source === 'full' || newData === fullData) {
      writeFullData(
        {
          hasSource: () => hasSource.value,
          setResponseData,
          writeModel: (data) => {
            dataModel.value = data
          },
        },
        newData,
      )
      return
    }

    const keyToIndex = buildKeyToIndexMap(fullData, fn)
    const mergedData = [...fullData] as T[]
    for (let i = 0; i < newData.length; i++) {
      const row = newData[i]
      const key = fn(row)
      const fullIndex = keyToIndex.get(String(key)) ?? -1
      if (fullIndex >= 0) {
        mergedData[fullIndex] = row
      }
    }

    if (hasSource.value) {
      setResponseData(mergedData)
    }
    else {
      dataModel.value = mergedData
    }
  }

  return { handleDataUpdate }
}
