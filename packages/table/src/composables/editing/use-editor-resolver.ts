import type { Component, ComputedRef, MaybeRefOrGetter } from 'vue'
import type { TableEditorOverrides } from '../../components/cell-editors/editor-factory'
import type { ProcessedColumn } from '../../types'
import type { CellEditorParams, CellEditorType, EditorComponent } from '../../types/edit'
import { computed, toValue } from 'vue'
import { registerAllBuiltInEditors } from '../../components/cell-editors'
import { resolveEditor } from '../../components/cell-editors/editor-factory'
import { flattenLeafColumns } from '../../utils/column-tree'
import { devWarn } from '../../utils/dev-warn'
import { inferEditorFromValueType } from '../../utils/edit-helpers'
import { isDev } from '../../utils/env'

/**
 * <zh/> 内置编辑器惰性注册（模块级幂等）。
 * <en/> Lazy built-in editor registration (module-level idempotent).
 * @remarks
 * <zh/> 消费者常直接以字符串（'text'/'number' 等）配置 cellEditor 而未显式调用 registerAllBuiltInEditors，
 * <zh/> 导致 resolveEditor 返回 undefined、双击编辑无反应。此处首次解析编辑器前自动注册一次，保证开箱即用；
 * <zh/> 已注册（含用户自定义）时保持幂等，不影响 registerCellEditor 的覆盖语义。
 * <en/> Consumers often configure cellEditor with plain strings ('text'/'number' etc.) without calling
 * <en/> registerAllBuiltInEditors, leaving resolveEditor undefined and dblclick editing silent. This
 * <en/> registers once before the first editor resolution so string editors work out of the box; it stays
 * <en/> idempotent and does not change registerCellEditor override semantics.
 */
let builtInEditorsEnsured = false

function ensureBuiltInEditors(): void {
  if (builtInEditorsEnsured)
    return
  builtInEditorsEnsured = true
  registerAllBuiltInEditors()
}

export interface UseEditorResolverOptions {
  /** <zh/> 列配置计算属性 | <en/> Column config computed ref */
  columns: ComputedRef<ProcessedColumn[]>
  /**
   * <zh/> 单表编辑器覆盖（`EditConfig.editors` 透传），缺省时走全局/内置解析链
   * <en/> Per-table editor overrides (forwarded from `EditConfig.editors`), falls back to global/built-in chain when absent
   */
  editors?: MaybeRefOrGetter<TableEditorOverrides | Record<string, Component> | undefined>
}

export interface UseEditorResolverReturn {
  /** <zh/> 获取编辑器组件 | <en/> Get editor component */
  getEditorComponent: (col: ProcessedColumn, row?: any, rowIndex?: number) => EditorComponent | Component | undefined
  /** <zh/> 获取编辑器选择器参数 | <en/> Get editor selector params */
  getEditorSelectorParams: (col: ProcessedColumn, row?: any, rowIndex?: number) => CellEditorParams | ((params: { row: any, rowIndex: number, column: any }) => CellEditorParams) | undefined
  /** <zh/> 判断列是否可编辑 | <en/> Check if column is editable */
  isColumnEditable: (col: ProcessedColumn) => boolean
  /** <zh/> 可编辑列列表 | <en/> Editable columns list */
  editableColumns: ComputedRef<ProcessedColumn[]>
}

/**
 * <zh/> 编辑器解析与可编辑列计算组合式函数
 * <en/> Editor resolver and editable columns computation composable
 * @remarks
 * <zh/> 从 use-cell-edit 拆分，聚焦编辑器组件解析与可编辑列过滤，无副作用
 * <en/> Extracted from use-cell-edit, focuses on editor component resolution and editable column filtering, no side effects
 */
export function useEditorResolver(options: UseEditorResolverOptions): UseEditorResolverReturn {
  const { columns } = options

  /**
   * <zh/> 解析字符串编辑器名——未命中时 dev 告警（拼写错误会导致双击无反应且难以排查）。
   * <zh/> 仅字符串配置走此通道；Component 直传与 undefined 保持原语义。dev-only，生产零开销。
   * <zh/> 单表覆盖优先：先查 `EditConfig.editors`，未命中再走内置/全局链（存量语义不变）。
   * <en/> Resolve a string editor name — dev-warns on miss (a typo silently disables dblclick editing).
   * <en/> String configs only; direct Components and undefined keep their semantics. Dev-only, zero production cost.
   * <en/> Per-table first: `EditConfig.editors` wins, then the legacy built-in/global chain (stock semantics unchanged).
   */
  function resolveNamedEditor(
    editor: CellEditorType | string | Component | undefined,
    col: ProcessedColumn,
  ): EditorComponent | Component | undefined {
    const tableEditors = options.editors ? toValue(options.editors) : undefined
    const resolved = resolveEditor(editor, tableEditors)
    if (resolved === undefined && typeof editor === 'string' && isDev) {
      devWarn(
        `[AdvTable] Column "${col.prop ?? col.label ?? col.key}" configures unknown editor "${editor}". `
        + 'Check the spelling or register it via registerCellEditor; the column will not be editable.',
      )
    }
    return resolved
  }

  function getEditorComponent(col: ProcessedColumn, row?: any, rowIndex?: number): EditorComponent | Component | undefined {
    ensureBuiltInEditors()
    if (col.cellEditorSelector && row != null && rowIndex != null) {
      const selected = col.cellEditorSelector({ row, rowIndex, column: col })
      if (selected) {
        if (typeof selected === 'object' && 'component' in selected) {
          return resolveNamedEditor(selected.component, col)
        }
        return resolveNamedEditor(selected, col)
      }
    }

    if (col.cellEditor)
      return resolveNamedEditor(col.cellEditor, col)

    if (col.editable) {
      const inferred = inferEditorFromValueType(col.valueType)
      if (inferred)
        return resolveEditor(inferred, options.editors ? toValue(options.editors) : undefined)
    }

    return undefined
  }

  function getEditorSelectorParams(col: ProcessedColumn, row?: any, rowIndex?: number): CellEditorParams | ((params: { row: any, rowIndex: number, column: any }) => CellEditorParams) | undefined {
    if (col.cellEditorSelector && row != null && rowIndex != null) {
      const selected = col.cellEditorSelector({ row, rowIndex, column: col })
      if (typeof selected === 'object' && 'component' in selected) {
        return selected.params
      }
    }
    return undefined
  }

  function isColumnEditable(col: ProcessedColumn): boolean {
    if (!col.editable)
      return false
    return !!(col.cellEditor || col.cellEditorSelector || inferEditorFromValueType(col.valueType))
  }

  const editableColumns = computed(() => {
    // 先展平为叶子列——分组子列的 editable 此前因顶层过滤被整体丢弃（Tab 导航跳过子列）
    const cols = flattenLeafColumns(columns.value).filter((col: ProcessedColumn) => isColumnEditable(col))
    if (isDev) {
      flattenLeafColumns(columns.value).forEach((col: ProcessedColumn) => {
        if (col.editable && !col.cellEditor && !col.cellEditorSelector && !inferEditorFromValueType(col.valueType)) {
          devWarn(
            `[AdvTable] Column "${col.prop ?? col.label ?? col.key}" has editable=true but no cellEditor or inferable valueType. `
            + 'The column will not be editable. Set cellEditor or use a supported valueType to enable editing.',
          )
        }
      })
    }
    return cols
  })

  return {
    getEditorComponent,
    getEditorSelectorParams,
    isColumnEditable,
    editableColumns,
  }
}
