import type { MaybeRefOrGetter } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { ColumnClassification } from './use-column-classification'
import { computed, toValue, watch } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { classifyColumns, isColumnClassificationEqual } from './use-column-classification'

/**
 * <zh/> 列分类依赖 | <en/> Column-classification deps
 */
export interface PipelineClassificationDeps {
  localColumns: MaybeRefOrGetter<ProcessedColumn[]>
  treeConfig?: MaybeRefOrGetter<unknown>
  rowGroupConfig?: MaybeRefOrGetter<unknown>
  devWarn?: (message: string, ...args: unknown[]) => void
}

/**
 * <zh/> 管线列分类——WeakMap 缓存的 classifyColumns computed + tree/group 互斥校验 watch。
 *
 * <zh/> 自 use-table-data-pipeline.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 C），主体逐字未改。
 * <en/> Pipeline column classification — the WeakMap-cached classifyColumns computed plus the
 * <en/> tree/group mutual-exclusion watch.
 *
 * <en/> Migrated verbatim from use-table-data-pipeline.ts (COMPLEXITY-PLAN battle line 3, knife C).
 */
export function usePipelineClassification(deps: PipelineClassificationDeps) {
  const { localColumns, treeConfig, rowGroupConfig, devWarn: devWarnOption } = deps

  // <zh/> 列分类 WeakMap 缓存——同一数组引用复用结果，O(m) 仅首次 | <en/> Column classification WeakMap cache — same array ref reuses result, O(m) only first time
  const classifyCache = new WeakMap<ProcessedColumn[], ColumnClassification>()
  const columnClassification = computed<ColumnClassification>((prev) => {
    const cols = toValue(localColumns) as ProcessedColumn[]
    let next = classifyCache.get(cols)
    if (!next) {
      next = classifyColumns(cols)
      classifyCache.set(cols, next)
    }
    if (prev && isColumnClassificationEqual(prev, next))
      return prev
    return next
  })
  // <zh/> treeConfig + rowGroupConfig 同时启用互斥校验（dev 警告 + 运行时阻止）
  // <en/> Mutual exclusion check when treeConfig + rowGroupConfig are both enabled (dev warning + runtime prevention)
  /**
   * <zh/> tree/group 互斥校验回调——任一配置引用变化即触发（含 setup immediate），dev 下告警并运行时忽略 rowGroup
   * <en/> Tree/group exclusivity callback — fires on either config reference change (incl. setup immediate); dev-warns and ignores rowGroup at runtime
   */
  function onTreeGroupConfigChanged([tc, rgc]: readonly [unknown, unknown]): void {
    if (!isDev)
      return
    // <zh/> treeConfig/rowGroupConfig 为对象即视为启用（接口未提供 enabled 字段，presence 即启用）
    // <en/> treeConfig/rowGroupConfig objects are treated as enabled (no enabled field provided, presence means enabled)
    if (tc && rgc) {
      const message
        = '[AdvTable] Both treeConfig and rowGroupConfig are enabled. '
          + 'Row grouping operates on flattened tree data, which may break tree hierarchy '
          + 'and produce unexpected visual results. rowGroupConfig will be ignored at runtime.'
      if (devWarnOption)
        devWarnOption(message)
      else if (typeof console !== 'undefined')
        devWarn(message)
    }
  }
  watch(
    () => [toValue(treeConfig), toValue(rowGroupConfig)] as const,
    onTreeGroupConfigChanged,
    { immediate: true, flush: 'post' },
  )

  return { columnClassification }
}
