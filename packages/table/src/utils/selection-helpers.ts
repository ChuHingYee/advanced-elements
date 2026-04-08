import type { CheckStatus } from '../composables/selection/use-selection-state'

export interface GetSelectAllCheckboxPropsOptions {
  /** <zh/> 当前全选状态 | <en/> current select-all status */
  checkStatus: CheckStatus
  /** <zh/> 编排层全选切换闭包（必填，与 checkStatus 同源） | <en/> orchestrator-level select-all toggle closure (required, same source as checkStatus) */
  toggleAllSelection: () => void
  /** <zh/> 当前可见数据条数，用于决定 checkbox 是否禁用；未传入时视为 0（禁用） | <en/> current visible data count, decides checkbox disabled; treated as 0 when omitted */
  visibleDataLength?: number
}

/**
 * <zh/> 获取全选 checkbox 的 props，两个 selection 列渲染器共用此逻辑。
 * <en/> Get the props for the select-all checkbox, shared by both selection-column renderers.
 *
 * <zh/> 唯一形态为对象参数：避免 `visibleDataLength` 可选却在必填 `toggleAllSelection` 之前
 * <zh/> 导致的 `TS1016: A required parameter cannot follow an optional parameter`，且符合 Vue 工具函数
 * <zh/> 显式命名优于隐式顺序的最佳实践。
 * <en/> Options object is the only form: avoids `TS1016` when an optional param
 * <en/> precedes a required one, and follows Vue utility best practice of explicit names over implicit order.
 */
export function getSelectAllCheckboxProps(options: GetSelectAllCheckboxPropsOptions): {
  'disabled': boolean
  'modelValue': boolean
  'indeterminate': boolean
  'onUpdate:modelValue': () => void
} {
  const { checkStatus, toggleAllSelection, visibleDataLength } = options
  return {
    'disabled': (visibleDataLength ?? 0) === 0,
    'modelValue': checkStatus.isAllSelected,
    'indeterminate': checkStatus.isIndeterminate,
    'onUpdate:modelValue': () => {
      toggleAllSelection()
    },
  }
}
