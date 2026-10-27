import type { DataPipelineStage } from '../../types/config-options'
import { devWarn } from '../../utils/dev-warn'

/**
 * <zh/> 管线顺序解析——自 use-table-data-pipeline.ts 拆出（COMPLEXITY-PLAN 战线三，刀法 A），
 * <zh/> 主体逐字未改；主文件 re-export 保测试导入路径零变化。
 * <en/> Pipeline-order resolution — split out of use-table-data-pipeline.ts (COMPLEXITY-PLAN battle
 * <en/> line 3, knife A), body unchanged; re-exported from the main file for test imports.
 */

/** <zh/> 默认管线顺序（历史行为，零破坏） | <en/> Default pipeline order (historical behavior) */
export const DEFAULT_PIPELINE_ORDER: readonly DataPipelineStage[] = ['columnFilter', 'quickFilter', 'externalFilter', 'sort']

/**
 * <zh/> 解析管线顺序：必须恰含 4 段且不重复，否则 devWarn 并回退默认
 * <en/> Resolve the pipeline order: must contain exactly the 4 stages; otherwise warn and fall back
 */
export function resolvePipelineOrder(
  raw: DataPipelineStage[] | undefined,
  warn?: (message: string, ...args: unknown[]) => void,
): DataPipelineStage[] {
  if (raw == null)
    return [...DEFAULT_PIPELINE_ORDER]
  const expected = new Set<string>(DEFAULT_PIPELINE_ORDER)
  const seen = new Set<string>()
  const valid = Array.isArray(raw)
    && raw.length === expected.size
    && raw.every(s => typeof s === 'string' && expected.has(s) && !seen.has(s) && (seen.add(s), true))
  if (!valid) {
    const message = `[AdvTable] Invalid pipelineOrder ${JSON.stringify(raw)} — must contain exactly [${[...expected].join(', ')}]; falling back to default.`
    if (warn)
      warn(message)
    else if (typeof console !== 'undefined')
      devWarn(message)
    return [...DEFAULT_PIPELINE_ORDER]
  }
  return [...raw]
}
