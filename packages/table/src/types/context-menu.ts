import type { Component } from 'vue'
import type { ProcessedColumn } from './column'

/** <zh/> 右键菜单触发区域 — 'header' 表头 / 'body' 表体 / 'footer' 表尾 | <en/> Context menu trigger area — 'header' / 'body' / 'footer' */
export type ContextMenuArea = 'header' | 'body' | 'footer'

/** <zh/> 内置菜单项 code | <en/> Builtin menu item code */
export type BuiltinMenuCode
  = | 'copyCell'
    | 'copyCellWithHeader'
    | 'copyRow'
    | 'copyRowWithHeaders'
    | 'copySelectedRows'
    | 'copySelectedRowsWithHeaders'
    | 'cutCell'
    | 'pasteCell'
    | 'clearCell'
    | 'editCell'
    | 'deleteRow'
    | 'deleteSelectedRows'
    | 'insertRowAbove'
    | 'insertRowBelow'
    | 'autoSizeThisColumn'
    | 'autoSizeAllColumns'
    | 'resetColumns'
    | 'clearSort'
    | 'clearFilter'
    | 'clearAllFilters'
    | 'exportCsv'
    | 'exportExcel'
    | 'importExcel'
    | 'print'
    | 'hideThisColumn'
    | 'showAllColumns'

/** <zh/> 已声明但尚未实现的内置菜单项 code（配置后无动作，仅 dev 告警） | <en/> Declared but unimplemented built-in menu codes */
export type PendingBuiltinMenuCode = 'deleteRow' | 'deleteSelectedRows' | 'insertRowAbove' | 'insertRowBelow'
/** <zh/> 已实现的内置菜单项 code（注册表与动作分发均有覆盖） | <en/> Implemented built-in menu item codes */
export type ImplementedBuiltinMenuCode = Exclude<BuiltinMenuCode, PendingBuiltinMenuCode>

/** <zh/> 右键菜单项（业务自定义与内置项的统一形态） | <en/> Context menu item (unified shape of custom and built-in items) */
export interface ContextMenuItem<T = any> {
  code: Exclude<string, 'separator'>
  name: string
  prefixIcon?: Component | string
  /** <zh/> 快捷键提示等 | <en/> Keyboard shortcut hint, etc. */
  suffix?: { icon?: Component | string, content?: string }
  visible?: boolean
  disabled?: boolean
  /** <zh/> 用于异步权限校验 | <en/> Used for async permission checking */
  loading?: boolean
  /** <zh/> 与 prefixIcon 互斥，checked 时显示 ✓ 图标 | <en/> Mutually exclusive with prefixIcon; shows a ✓ icon when checked */
  checked?: boolean
  children?: ContextMenuItem<T>[]
  component?: Component
  componentParams?: Record<string, any>
}

/** <zh/> 分隔线菜单项 | <en/> Separator menu item */
export interface ContextMenuSeparator {
  code: 'separator'
}

/** <zh/> 菜单项或分隔线 | <en/> Menu item or separator */
export type ContextMenuItemOrSeparator<T = any> = ContextMenuItem<T> | ContextMenuSeparator

/**
 * 菜单项输入类型（支持字符串简写）
 * Menu option input type (supports string shorthand)
 *
 * 用户可在 menuConfig.options 中直接传入内置编码字符串（如 'copyCell'），
 * 代替完整的 { code: 'copyCell', name: '...' } 对象。
 * 字符串简写在 expandBuiltinCodes 中被自动解析为完整菜单项。
 *
 * Users can pass builtin code strings (e.g. 'copyCell') directly in menuConfig.options,
 * instead of full { code: 'copyCell', name: '...' } objects.
 * String shorthand is automatically resolved to full menu items in expandBuiltinCodes.
 */
export type MenuOptionInput<T = any> = ContextMenuItem<T> | ContextMenuSeparator | string

/** <zh/> 右键菜单触发时的上下文参数 | <en/> Context params at context-menu trigger time */
export interface ContextMenuParams<T = any> {
  area: ContextMenuArea
  /** <zh/> body 区域有效 | <en/> Effective in the body area */
  row?: T
  /** <zh/> body 区域有效 | <en/> Effective in the body area */
  rowIndex?: number
  column?: ProcessedColumn
  columnIndex?: number
  event: MouseEvent
}

/** <zh/> visibleMethod 回调参数（可就地修改 options 的 visible/disabled/loading） | <en/> Params for the visibleMethod callback (options' visible/disabled/loading can be mutated in place) */
export interface ContextMenuVisibleParams<T = any> extends ContextMenuParams<T> {
  options: ContextMenuItemOrSeparator<T>[][]
}

/** <zh/> 单个菜单区域（header/body/footer）的配置 | <en/> Config of a single menu area (header/body/footer) */
export interface ContextMenuAreaConfig<T = any> {
  /** <zh/> 菜单项列表（二维数组，子数组之间显示分隔线）。支持字符串简写（如 'copyCell'） | <en/> Menu item list (2D array; separators are shown between sub-arrays). String shorthand (e.g. 'copyCell') is supported */
  options: MenuOptionInput<T>[][]
  enabled?: boolean
}

/** <zh/> 内置菜单项开关 | <en/> Built-in menu item toggles */
export interface BuiltinMenuConfig {
  disabled?: BuiltinMenuCode[]
}

/** <zh/> 右键菜单总配置 | <en/> Overall context menu config */
export interface ContextMenuConfig<T = any> {
  header?: ContextMenuAreaConfig<T>
  body?: ContextMenuAreaConfig<T>
  footer?: ContextMenuAreaConfig<T>
  /** <zh/> 菜单弹出前调用，可就地修改 options 的 visible/disabled/loading | <en/> Called before the menu pops up; may mutate options' visible/disabled/loading in place */
  visibleMethod?: (params: ContextMenuVisibleParams<T>) => boolean | Promise<boolean>
  builtins?: BuiltinMenuConfig
}

/** <zh/> 菜单项点击事件载荷 | <en/> Menu item click event payload */
export interface ContextMenuClickEvent<T = any> {
  area: ContextMenuArea
  menu: ContextMenuItem<T>
  params: ContextMenuParams<T>
}
