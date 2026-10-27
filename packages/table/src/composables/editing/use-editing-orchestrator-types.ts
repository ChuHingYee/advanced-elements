import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { AdvTableEmitFn, ProcessedColumn } from '../../types'
import type { EditConfig } from '../../types/edit'
import type { InterceptorConfig } from '../../types/interceptor'
import type { NotifyFn } from '../../utils/notification'
import type { UseDataUpdateBridgeReturn } from '../data/use-data-update-bridge'
import type { OverflowTooltipApi } from '../shared/use-overflow-tooltip'
import type { DecorationRangeRect } from '../view-model/use-row-view-model'

/**
 * <zh/> 编辑编排器输入契约——自 use-editing-orchestrator.ts 拆出（COMPLEXITY-PLAN 战线三，
 * <zh/> 刀法 C）；use-editing-orchestrator.ts re-export 本文件，既有导入路径零变化。
 * <en/> Input contract of the editing orchestrator — split out of use-editing-orchestrator.ts
 * <en/> (COMPLEXITY-PLAN battle line 3, knife C); re-exported, import paths unchanged.
 */
export interface UseEditingOrchestratorOptions<T> {
  /**
   * <zh/> 编辑配置——窄切片，替代既往 `props: AdvTableProps` 全量透传（本模块 9 处 props 读取均派生于此，见行内等价注）
   * <en/> Edit config — narrow slice replacing the former `props: AdvTableProps` passthrough (all 9 props reads in this module derive from it, see inline notes)
   */
  editConfig: MaybeRefOrGetter<EditConfig | undefined>
  /**
   * <zh/> 拦截器配置（等价既往 `props.interceptor`，缺省时仍回退全局配置）
   * <en/> Interceptor config (equivalent to the former `props.interceptor`, still falling back to the global config when absent)
   */
  interceptor?: MaybeRefOrGetter<InterceptorConfig | undefined>
  globalTableConfig: ComputedRef<Record<string, any>>
  effectiveColumns: Ref<ProcessedColumn[]>
  /**
   * <zh/> 渲染域数据——必须传入数据管线的 renderData（Row Pinning 启用时已剔除 pinned 行），
   * <zh/> 保证编辑/校验/批量暂存的行索引域与渲染器实际绘制的主体行一致。
   * <en/> Render-domain data — MUST receive the pipeline's renderData (pinned rows already
   * <en/> extracted when Row Pinning is enabled), so the row-index domain of editing/validation/
   * <en/> batch staging stays consistent with the rows the renderer actually draws in the body.
   */
  renderData: ComputedRef<T[]>
  tableData: Ref<T[]>
  rowKeyFn: ComputedRef<(row: T) => string>
  tableId: ComputedRef<string>
  invalidateQuickFilterRowCache: (rowKey: string | number) => void
  /**
   * <zh/> 列筛 cellValue 缓存按**行对象**失效——编辑提交/撤销后调用，防止筛选命中陈旧值。
   * <zh/> 按行对象而非行索引定位：编辑事件的 rowIndex 属渲染域，与列筛缓存的管线域不同源
   * <zh/> （筛选/排序/分页状态下同一索引指向不同行），跨域传索引会失效错误的行。
   * <en/> Invalidate the column-filter cellValue cache **by row object** — call after edit
   * <en/> commit/undo so filtering never matches pre-edit values. Addressed by row object rather
   * <en/> than row index: edit events carry a render-domain rowIndex while the filter cache is in
   * <en/> the pipeline domain (the same index points at different rows under filtering/sorting/
   * <en/> pagination), so a cross-domain index would invalidate the wrong row.
   */
  invalidateColumnFilterRowCache?: (row?: object | null) => void
  sharedTooltipApi: OverflowTooltipApi
  isCellInRangeSelection: (rowIndex: number, colIndex: number) => boolean
  /**
   * <zh/> 范围选择矩形 computed——提供时启用 RowViewModel 稀疏重算（快照依赖对等的选区来源）。
   * <zh/> 缺省时不组装快照，RowViewModel 走稠密路径。
   * <en/> Range-selection rect computed — enables sparse RowViewModel recomputation when provided
   * <en/> (the selection source of the snapshot's dependency parity). When absent, no snapshot is
   * <en/> assembled and the RowViewModel falls back to the dense path (historical behavior).
   */
  rangeSelectionRange?: ComputedRef<DecorationRangeRect | null>
  /**
   * <zh/> 数据更新桥接——由数据层 {@linkcode useDataUpdateBridge} 提供
   * <en/> Data update bridge — provided by the data layer's {@linkcode useDataUpdateBridge}
   */
  dataUpdateBridge: UseDataUpdateBridgeReturn<T>
  /**
   * <zh/> 表格根元素 ref——提供时启用失焦提交（useEditorBlur）
   * <en/> Table root element ref — enables blur commit (useEditorBlur) when provided
   */
  containerRef?: Ref<HTMLElement | null>
  /** <zh/> 通知通道——校验失败时通过此通道通知用户，未传入时使用默认实现 | <en/> Notification channel for validation failures, defaults to default implementation */
  notify?: NotifyFn
  emit: AdvTableEmitFn
}
