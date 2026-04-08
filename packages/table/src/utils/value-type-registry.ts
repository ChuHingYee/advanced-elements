import type { Component } from 'vue'
import type { AdvColumn } from '../types/column'
import type { TableContext } from '../types/config'
import { BUILTIN_VALUE_TYPES } from '../types/column'
import { devWarnRepeat } from './dev-warn'
import { isDev } from './env'

/**
 * <zh/> 自定义 valueType 文本解析上下文——导出/复制路径复用，与页面渲染走同一注册表，避免规则漂移。
 * <en/> Custom valueType text-resolution context — shared by the export/copy path and on-page rendering via one registry, avoiding rule drift.
 */
export interface CustomValueTypeTextContext {
  /** <zh/> 单元格原始数据 | <en/> raw cell data */
  cellData: unknown
  /** <zh/> 当前行数据对象 | <en/> current row data object */
  row: Record<string, unknown>
  /** <zh/> 当前列配置 | <en/> current column config */
  column: AdvColumn
  /** <zh/> 当前行索引 | <en/> current row index */
  index: number
  /** <zh/> 表格上下文 | <en/> table context */
  ctx?: TableContext | null
}

/**
 * <zh/> 自定义 valueType 定义——`component` 用于页面渲染，`toText` 用于导出/复制/纯文本解析，二者至少提供其一。
 * <en/> Custom valueType definition — `component` for on-page rendering, `toText` for export/copy/plain-text resolution; at least one is required.
 */
export interface CustomValueTypeDefinition {
  /** <zh/> 渲染组件（接收 cellData/rowData/column/index props，约定同内置组件） | <en/> render component (receives cellData/rowData/column/index props, same convention as built-ins) */
  component?: Component
  /** <zh/> 纯文本解析（导出/复制/无障碍文本共用） | <en/> plain-text resolver (shared by export/copy/a11y text) */
  toText?: (cellData: unknown, opts: CustomValueTypeTextContext) => string
}

const customValueTypes = new Map<string, CustomValueTypeDefinition>()

/**
 * <zh/> 注册自定义 valueType——与内置 32 种同等进入渲染与文本双链路。覆盖内置名时 dev 告警并拒绝，避免静默改写内置语义。
 * <en/> Register a custom valueType — enters both render and text pipelines like the 32 built-ins. Overriding a built-in name warns in dev and is rejected to avoid silently rewriting built-in semantics.
 */
export function registerValueType(name: string, def: CustomValueTypeDefinition): void {
  if (!name || (!def.component && !def.toText))
    return
  if (name in BUILTIN_VALUE_TYPES) {
    if (isDev)
      devWarnRepeat(`[AdvTable] registerValueType "${name}" collides with a built-in valueType and was ignored. Pick another name.`)
    return
  }
  if (isDev && customValueTypes.has(name))
    devWarnRepeat(`[AdvTable] valueType "${name}" is already registered. Overwriting.`)
  customValueTypes.set(name, def)
}

/**
 * <zh/> 注销自定义 valueType，幂等 | <en/> Unregister a custom valueType, idempotent
 */
export function unregisterValueType(name: string): void {
  if (!name)
    return
  customValueTypes.delete(name)
}

/**
 * <zh/> 查询自定义 valueType 定义，未注册返回 undefined | <en/> Look up a custom valueType definition, undefined when unregistered
 */
export function getCustomValueType(name: string): CustomValueTypeDefinition | undefined {
  return customValueTypes.get(name)
}
