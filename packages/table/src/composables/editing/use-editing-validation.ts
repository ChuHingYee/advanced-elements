import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { ProcessedColumn } from '../../types'
import type { EditConfig } from '../../types/edit'
import type { TableEmitter } from '../../utils/table-emitter'
import { computed, toValue, watch } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { useCellValidate } from './use-cell-validate'

/**
 * <zh/> 编辑校验桥依赖 | <en/> Editing validation-bridge deps
 */
export interface UseEditingValidationDeps<T> {
  editConfig: MaybeRefOrGetter<EditConfig | undefined>
  effectiveColumns: Ref<ProcessedColumn[]>
  renderData: ComputedRef<T[]>
  rowKeyFn: ComputedRef<(row: T) => string>
  tableEmit: TableEmitter
}

/**
 * <zh/> 编辑校验桥——useCellValidate 装配、crossFieldValidator 在 batch 模式下静默失效的
 * <zh/> dev 告警 watch，以及供编辑内核消费的 validateFn（cell/row 双模式统一出口）。
 *
 * <zh/> 自 use-editing-orchestrator.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 C），主体逐字未改。
 * <en/> Editing validation bridge — the useCellValidate assembly, the dev watch warning about
 * <en/> crossFieldValidator's silent no-op in batch mode, and the validateFn consumed by the
 * <en/> editing kernel (unified cell/row dual-mode outlet).
 *
 * <en/> Migrated verbatim from use-editing-orchestrator.ts (COMPLEXITY-PLAN battle line 3, knife C).
 */
export function useEditingValidation<T>(deps: UseEditingValidationDeps<T>) {
  const { editConfig: editConfigInput, effectiveColumns, renderData, rowKeyFn, tableEmit } = deps

  const validateApi = useCellValidate<T>({
    columns: computed(() => effectiveColumns.value),
    data: renderData,
    crossFieldValidator: () => toValue(editConfigInput)?.crossFieldValidator,
    rowKeyFn: () => rowKeyFn.value,
  })
  // <zh/> provide(advTableValidateErrorsKey, ...) 已移至 createEditingAdapter 统一桥接 |
  // <en/> provide(advTableValidateErrorsKey, ...) moved to createEditingAdapter for unified bridging

  // <zh/> crossFieldValidator 在 batch 模式下静默失效（仅 fullRow 模式生效）——dev 模式 warn
  // <en/> crossFieldValidator silently no-ops in batch mode (only effective in fullRow mode) — dev warn
  /**
   * <zh/> 跨字段校验配置告警回调——editType/crossFieldValidator 变化（含 setup immediate）时检查 batch 下的静默失效
   * <en/> Cross-field validator warning callback — warns about silent no-op in batch mode on config change (incl. setup immediate)
   */
  function onEditConfigChangedWarnCrossField([editType, crossFieldValidator]: readonly [unknown, unknown]): void {
    if (!isDev)
      return
    if (editType === 'batch' && typeof crossFieldValidator === 'function' && typeof console !== 'undefined') {
      devWarn(
        '[AdvTable] editConfig.crossFieldValidator is configured but editType is "batch". '
        + 'crossFieldValidator only takes effect under editType="fullRow" and will be silently ignored in batch mode. '
        + 'If cross-row/cross-field validation is required, switch editType to "fullRow" or validate before commitBatchEdit.',
      )
    }
  }
  watch(
    () => [toValue(editConfigInput)?.editType, toValue(editConfigInput)?.crossFieldValidator] as const,
    onEditConfigChangedWarnCrossField,
    { immediate: true, flush: 'post' },
  )

  async function validateFn(params: {
    mode: 'cell' | 'row'
    rowIndex: number
    columnKey: string
    value: unknown
    values?: Record<string, unknown>
    rowData?: unknown
  }): Promise<boolean> {
    if (params.mode === 'row' && params.values) {
      const row = renderData.value[params.rowIndex]
      validateApi.clearRowErrors(params.rowIndex, row)
      const rowValid = await validateApi.validateRow(params.rowIndex, params.values)
      if (!rowValid)
        return false
      const crossValid = await validateApi.validateCrossField(params.rowIndex, params.values)
      if (!crossValid) {
        const crossErrors = validateApi.errors.value
          .filter(e => e.rowIndex === params.rowIndex && e.prop === '__crossField__')
          .map(e => e.message)
        if (crossErrors.length)
          tableEmit('crossFieldValidateError', { rowIndex: params.rowIndex, errors: crossErrors })
      }
      return crossValid
    }
    // <zh/> 透传 rowData（缺省回退渲染域行）——校验器用 rowKey 作错误键，
    // <zh/> 与 UI 的 rowKey 匹配域一致，保证 Enter 提交的校验错误可见。
    // <en/> Forward rowData (fallback to the render-domain row) — the validator keys errors by
    // <en/> rowKey, matching the UI's rowKey domain so Enter-commit validation errors stay visible.
    return validateApi.validateCell(
      params.rowIndex,
      params.columnKey,
      params.value,
      params.rowData ?? renderData.value[params.rowIndex],
    )
  }
  return { validateApi, validateFn }
}

export type UseEditingValidationReturn<T> = ReturnType<typeof useEditingValidation<T>>
