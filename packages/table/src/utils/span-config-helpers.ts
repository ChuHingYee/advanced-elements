/**
 * <zh/> spanConfig 声明式合并配置的解析工具
 *
 * <en/> Parsing utilities for the declarative `spanConfig` merge configuration.
 *
 * @remarks
 * <zh/> `spanConfig` 支持简写形式（直接传 `RowSpanCellsConfig`）与完整形式（`{ rows, cols, ranges }`）。
 * <zh/> 这两个纯函数负责区分形态并按部分提取，避免在编排器中内联重复。
 *
 * <en/> `spanConfig` supports a shorthand form (passing `RowSpanCellsConfig` directly) and a full form
 * <en/> (`{ rows, cols, ranges }`). These pure functions discriminate the shape and extract by part,
 * <en/> avoiding inline duplication in the orchestrator.
 */
import type { ColSpanCellsConfig, RowSpanCellsConfig, SpanRange } from '../types/column'

/**
 * <zh/> 判断 spanConfig 是否为简写形式（直接是 RowSpanCellsConfig，而非 `{ rows, cols, ranges }` 对象）
 *
 * <en/> Whether the spanConfig is in shorthand form (a `RowSpanCellsConfig` directly, not a `{ rows, cols, ranges }` object)
 */
export function isShorthandRowSpanConfig(config: unknown): config is RowSpanCellsConfig {
  if (typeof config !== 'object' || config === null)
    return false
  return !('rows' in config) && !('cols' in config) && !('ranges' in config)
}

/**
 * <zh/> 从 spanConfig 中按部分提取合并规则
 *
 * <en/> Extract the merge rules for a specific part from spanConfig.
 *
 * @param config - <zh/> 原始 spanConfig（简写或完整形式） | <en/> raw spanConfig (shorthand or full form)
 * @param part - <zh/> 要提取的部分 | <en/> which part to extract
 */
export function pickSpanPart(
  config: { rows?: RowSpanCellsConfig, cols?: ColSpanCellsConfig, ranges?: SpanRange[] } | RowSpanCellsConfig | undefined,
  part: 'rows',
): RowSpanCellsConfig | undefined
/** <zh/> 提取 cols 部分（重载签名） | <en/> Extract the cols part (overload signature) */
export function pickSpanPart(
  config: { rows?: RowSpanCellsConfig, cols?: ColSpanCellsConfig, ranges?: SpanRange[] } | RowSpanCellsConfig | undefined,
  part: 'cols',
): ColSpanCellsConfig | undefined
/** <zh/> 提取 ranges 部分（重载签名） | <en/> Extract the ranges part (overload signature) */
export function pickSpanPart(
  config: { rows?: RowSpanCellsConfig, cols?: ColSpanCellsConfig, ranges?: SpanRange[] } | RowSpanCellsConfig | undefined,
  part: 'ranges',
): SpanRange[] | undefined
/** <zh/> 实现签名：按 part 返回对应合并规则，简写形式仅 rows 有值 | <en/> Implementation signature: returns the rules of the given part; shorthand configs only yield rows */
export function pickSpanPart(
  config: { rows?: RowSpanCellsConfig, cols?: ColSpanCellsConfig, ranges?: SpanRange[] } | RowSpanCellsConfig | undefined,
  part: 'rows' | 'cols' | 'ranges',
) {
  if (!config)
    return undefined
  if (isShorthandRowSpanConfig(config))
    return part === 'rows' ? config : undefined
  return config[part]
}
