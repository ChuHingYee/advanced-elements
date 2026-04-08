import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import type { AdvColumn, ProcessedColumn } from '../../types'
import { computed, watch } from 'vue'
import { getColumnKey } from '../../utils/shared'
import { useColumnCollapse } from '../columns/use-column-collapse'
import { useColumns } from '../columns/use-columns'

/** <zh/> 列管理编排器输入 | <en/> Columns orchestrator input */
export interface UseColumnsOrchestratorOptions<T> {
  columns: () => AdvColumn<T>[]
  /** <zh/> 默认列定义（最低优先级，被 columnTypes 与列自身定义覆盖；支持响应式） | <en/> Default column definition (lowest priority, overridden by columnTypes and column definitions; reactive) */
  defaultColDef?: MaybeRefOrGetter<Partial<AdvColumn<T>> | undefined>
  /** <zh/> 列类型预设（覆盖 defaultColDef，被列自身定义覆盖；支持响应式） | <en/> Column type presets (override defaultColDef, overridden by column definitions; reactive) */
  columnTypes?: MaybeRefOrGetter<Record<string, Partial<AdvColumn<T>>> | undefined>
  resizable: ComputedRef<boolean | undefined>
  onColumnsChange: (val: ProcessedColumn[]) => void
  /**
   * <zh/> 顶层列顺序变化回调——列头拖拽、列设置面板拖拽等所有重排路径的唯一事件出口
   * <en/> Top-level column order change callback — the single event exit for all reorder paths
   * <en/> (header drag, column-setting panel drag, etc.)
   */
  onColumnOrderChange?: (cols: ProcessedColumn[]) => void
}

/**
 * <zh/> 列管理编排——统一管理列配置处理、折叠/展开状态。
 *
 * <zh/> 注意：列分类（useColumnCategorization）依赖数据管线输出，
 * <zh/> 因此不在此编排器中，而是在 use-adv-table.ts 中于管线之后调用。
 *
 * <en/> Columns orchestration — unified management of column config processing,
 * <en/> collapse/expand state.
 *
 * <en/> Note: Column categorization (useColumnCategorization) depends on
 * <en/> data pipeline output, so it's not in this orchestrator but called
 * <en/> in use-adv-table.ts after the pipeline.
 */
export function useColumnsOrchestrator<T>(options: UseColumnsOrchestratorOptions<T>) {
  const {
    columns,
    defaultColDef,
    columnTypes,
    resizable,
    onColumnsChange,
    onColumnOrderChange,
  } = options

  const {
    localColumns,
    hasColumns,
    resetColumns,
    setColumns,
    touchColumns,
    originColumns,
    originColumnsFormatMap,
  } = useColumns(
    {
      columns,
      defaultColDef,
      columnTypes,
      resizable: () => resizable.value ?? true,
    },
    onColumnsChange,
  )

  const headerFormatMap = computed(() => originColumnsFormatMap.value as unknown as Record<string, (...args: unknown[]) => unknown>)

  const {
    effectiveColumns,
    canCollapse,
    toggleCollapse,
    isCollapsed,
    collapsedState,
    collapsedVersion,
  } = useColumnCollapse({
    columns: localColumns,
  })

  /**
   * <zh/> 顶层列顺序变化统一出口——列头拖拽与列设置面板拖拽均通过 localColumns 变更到达此处，
   * <zh/> 避免两个入口各自 emit 导致 columnMoved 双发。previousOrder 守卫跳过首次求值与回显
   * <en/> Unified exit for top-level column order changes — both header drag and column-setting
   * <en/> panel drag reach here via localColumns changes, preventing duplicate columnMoved emits.
   * <en/> previousOrder guard skips the initial evaluation and controlled-mode echo
   */
  let previousOrder = ''
  watch(
    // <zh/> \0 分隔：列 key 理论可含逗号，逗号 join 会误触发/漏触发
    // <en/> \0 separator: column keys may contain commas
    () => localColumns.value.map(c => getColumnKey(c)).join('\0'),
    (newOrder) => {
      if (previousOrder && newOrder !== previousOrder) {
        onColumnOrderChange?.(localColumns.value)
      }
      previousOrder = newOrder
    },
    { immediate: true },
  )

  return {
    localColumns,
    hasColumns,
    resetColumns,
    setColumns,
    touchColumns,
    originColumns,
    originColumnsFormatMap,
    headerFormatMap,
    effectiveColumns,
    canCollapse,
    toggleCollapse,
    isCollapsed,
    collapsedState,
    collapsedVersion,
  }
}
