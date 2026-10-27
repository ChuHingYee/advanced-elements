import type { ComputedRef, ShallowRef } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { CrossFieldValidator, ValidateError } from '../../types/edit'

/**
 * <zh/> `useCellValidate` 契约——自 use-cell-validate.ts 拆出（COMPLEXITY-PLAN 战线三，
 * <zh/> 刀法 C）；use-cell-validate.ts re-export 本文件，既有导入路径零变化。
 * <en/> Contracts of `useCellValidate` — split out of use-cell-validate.ts (COMPLEXITY-PLAN
 * <en/> battle line 3, knife C); re-exported, keeping import paths unchanged.
 */

/**
 * <zh/> useCellValidate 配置选项 | <en/> useCellValidate configuration options
 *
 * @typeParam T - <zh/> 行数据类型 | <en/> row data type
 */
export interface UseCellValidateOptions<T = any> {
  /** 列定义，用于查找列级 editorRules */
  columns: ComputedRef<ProcessedColumn[]>
  /**
   * 可见数据，用于行级/全表校验时获取行数据进行跨字段传参
   * Visible data, used to fetch row data for cross-field params during row-level/full-table validation
   */
  data: ComputedRef<T[]> | ShallowRef<T[]>
  /** 跨字段校验器 getter，用于行内多字段联合校验（如开始日期 ≤ 结束日期） */
  crossFieldValidator?: () => CrossFieldValidator<T> | undefined
  /**
   * <zh/> 行键函数，用于将 rowIndex 转为 rowKey 作为 errorMap 键，排序/筛选/分页后仍可定位错误
   * <en/> Row key function, converts rowIndex to rowKey for errorMap key, still locates errors after sort/filter/pagination
   */
  rowKeyFn?: () => ((row: T) => string) | undefined
}

/**
 * useCellValidate 返回值
 */
export interface UseCellValidateReturn<T = any> {
  /** 校验错误列表，以 shallowRef 暴露用于模板渲染和 provide/inject */
  errors: ShallowRef<ValidateError[]>
  /** 单字段校验 — 校验一个单元格的编辑值，通过返回 true，失败返回 false 并写入 errors */
  validateCell: (rowIndex: number, columnKey: string, value: unknown, rowData?: unknown) => Promise<boolean>
  /** 行级校验 — 校验行内所有可编辑字段，全部通过返回 true */
  validateRow: (rowIndex: number, values: Record<string, unknown>) => Promise<boolean>
  /** <zh/> 全表校验 — 校验所有行的所有可编辑字段，分批并发执行避免阻塞 UI | <en/> Validate the whole table — validates every editable field of all rows in concurrent batches to avoid blocking the UI */
  validateAll: (dataOverride?: T[]) => Promise<boolean>
  /**
   * 清除校验错误 — 可定向清除（按行/按列）或全量清除
   * Clear validation errors — can clear targeted (by row/column) or clear all
   */
  clearErrors: (target?: { rowIndex?: number, columnKey?: string }) => void
  /** 获取指定单元格的错误消息，O(1) Map 查找 */
  getCellError: (rowIndex: number, columnKey: string, rowData?: unknown) => string | undefined
  /**
   * 行级跨字段校验 — 用于行内多字段联合校验（如依赖字段比较）
   * Row-level cross-field validation — for intra-row multi-field joint validation (e.g. dependent field comparison)
   */
  validateCrossField: (rowIndex: number, values: Record<string, unknown>) => Promise<boolean>
  /** 清除指定行的跨字段校验错误（不递增 epoch），在行级校验流程开始前调用 */
  clearRowCrossFieldErrors: (rowIndex: number, rowData?: unknown) => void
  /** 清除指定行的所有校验错误（不递增 epoch），在行级校验流程开始前调用 */
  clearRowErrors: (rowIndex: number, rowData?: unknown) => void
  /** 清除指定单元格的校验错误（不递增 epoch），全行编辑模式下单元格值变更时调用 */
  clearCellError: (rowIndex: number, columnKey: string, rowData?: unknown) => void
}
