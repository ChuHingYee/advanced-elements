import type { Component, VNode } from 'vue'
import type { AdvColumn } from '../../types'
import type { TableContext } from '../../types/config'
import { h } from 'vue'
import { resolveEmptyText } from '../../utils/resolve-cell-text'
import { renderSparkline } from '../../utils/sparkline'
import { VALUE_TYPE_TEXT_FORMATTERS } from '../../utils/value-format'
import { getCustomValueType } from '../../utils/value-type-registry'
import AvatarCell from './avatar-cell.vue'
import ImageCell from './image-cell.vue'
import LinkCell from './link-cell.vue'
import { OptionCell } from './option-cell'
import ProgressCell from './progress-cell.vue'
import RateCell from './rate-cell.vue'
import SwitchCell from './switch-cell.vue'
import { renderEnumCell } from './value-enum'

/**
 * <zh/> 单元格渲染选项
 * <en/> Cell rendering options
 */
interface RenderOptions {
  /** <zh/> 单元格原始数据 | <en/> Raw cell data */
  cellData: unknown
  /** <zh/> 当前行数据 | <en/> Current row data */
  rowData: Record<string, unknown>
  /** <zh/> 列配置 | <en/> Column config */
  column: AdvColumn
  /** <zh/> 行索引（从 0 开始） | <en/> Row index (starting from 0) */
  index: number
  /** <zh/> 表格上下文，可选 | <en/> Table context, optional */
  ctx?: TableContext | null
  /** <zh/> hover 操作列列表，用于 OptionCell 行内渲染模式 | <en/> Hover action column list, used for OptionCell inline render mode */
  hoverOptionColumns?: AdvColumn[]
}

const COMPONENT_RENDERERS: Record<string, Component> = {
  progress: ProgressCell,
  switch: SwitchCell,
  avatar: AvatarCell,
  image: ImageCell,
  link: LinkCell,
  rate: RateCell,
  option: OptionCell,
}

const RENDERER_SPECIFIC_TEXT: Record<string, (opts: RenderOptions) => VNode | string> = {
  select: ({ cellData, column }) => {
    if (column.valueEnum) {
      return renderEnumCell(cellData as string, column.valueEnum)
    }
    return String(cellData ?? '')
  },

  sparkline: ({ cellData, column }) => renderSparkline(cellData, column.sparkline),
  index: ({ index, rowData, ctx }) => String((ctx?.getLogicalIndex?.(rowData) ?? index) + 1),
  indexBorder: ({ index, rowData, ctx }) => String((ctx?.getLogicalIndex?.(rowData) ?? index) + 1),
}

/**
 * <zh/> 根据 `valueType` 分发渲染单元格内容。
 * <en/> Dispatch cell content rendering based on `valueType`.
 *
 * <zh/> 按以下优先级依次解析：
 * <en/> Resolved in the following priority order:
 * <zh/> - `valueGetter` 优先于原始 `cellData`；
 * <en/> - `valueGetter` takes precedence over raw `cellData`;
 * <zh/> - 若 `valueType` 为空，降级为纯文本（支持空值占位）；
 * <en/> - If `valueType` is empty, fall back to plain text (with empty-value placeholder);
 * <zh/> - 匹配 `VALUE_TYPE_TEXT_FORMATTERS` 中的文本格式化器；
 * <en/> - Match text formatters in `VALUE_TYPE_TEXT_FORMATTERS`;
 * <zh/> - 匹配 `RENDERER_SPECIFIC_TEXT` 中的特殊文本渲染器（如 select、index）；
 * <en/> - Match special text renderers in `RENDERER_SPECIFIC_TEXT` (e.g. select, index);
 * <zh/> - 匹配 `COMPONENT_RENDERERS` 中的组件渲染器（如 progress、avatar）；
 * <en/> - Match component renderers in `COMPONENT_RENDERERS` (e.g. progress, avatar);
 * <zh/> - 兜底返回 `String(cellData)` 或空值占位。
 * <en/> - Fallback returns `String(cellData)` or empty-value placeholder.
 *
 * @param opts - <zh/> 渲染选项 | <en/> render options
 * @returns <zh/> VNode 节点或纯文本字符串 | <en/> VNode node or plain text string
 */
export function renderValueCell(opts: RenderOptions): VNode | string {
  const { column, ctx, rowData, index } = opts

  // <zh/> cellData 已由 renderCell 统一经 resolveCellValue 解析（valueGetter 单点应用），
  // <zh/> 此处直接消费，避免 valueGetter 被重复调用。
  // <en/> cellData has already been resolved via resolveCellValue in renderCell (single
  // <en/> valueGetter application); consume it directly to avoid double-invoking valueGetter.
  const cellData = opts.cellData

  const valueType = column.valueType
  if (!valueType)
    return cellData == null || cellData === '' ? resolveEmptyText(column, ctx) : String(cellData)

  // <zh/> 自定义 valueType 优先——与 resolve-cell-text.ts 同一注册表（`registerValueType`，内置 31 种），渲染与导出文本单源
  // <en/> Custom valueTypes first — same registry as resolve-cell-text.ts (`registerValueType`), single source for render and export text
  const custom = getCustomValueType(valueType)
  if (custom?.component) {
    return h(custom.component, { cellData, rowData, column, index })
  }
  if (custom?.toText) {
    return custom.toText(cellData, { cellData, row: rowData, column, index, ctx })
  }

  const textFormatter = VALUE_TYPE_TEXT_FORMATTERS[valueType]
  if (textFormatter) {
    return textFormatter(cellData, ctx)
  }

  const specificRenderer = RENDERER_SPECIFIC_TEXT[valueType]
  if (specificRenderer) {
    return specificRenderer({ ...opts, cellData })
  }

  const component = COMPONENT_RENDERERS[valueType]
  if (component) {
    const componentProps: Record<string, unknown> = {
      cellData,
      rowData,
      column,
      index,
    }
    // 为各组件映射 cellData → 组件期望的主数据 prop
    // Map cellData to the primary data prop each component expects
    if (valueType === 'progress' || valueType === 'switch' || valueType === 'link') {
      componentProps.value = cellData
    }
    if (valueType === 'avatar' || valueType === 'image') {
      componentProps.src = cellData != null ? String(cellData) : undefined
    }
    // hoverOptionColumns 传递给 OptionCell，用于行内 hover 模式 | hoverOptionColumns passed to OptionCell for inline hover mode
    if (valueType === 'option' && opts.hoverOptionColumns) {
      componentProps.hoverOptionColumns = opts.hoverOptionColumns
    }
    return h(component, componentProps)
  }

  if (cellData == null || cellData === '') {
    return resolveEmptyText(column, ctx)
  }

  return String(cellData)
}
