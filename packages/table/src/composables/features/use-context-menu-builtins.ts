import type { BuiltinMenuCode, ContextMenuItem, ContextMenuItemOrSeparator, ContextMenuParams, ImplementedBuiltinMenuCode, PendingBuiltinMenuCode } from '../../types/context-menu'

/**
 * 内置菜单项工厂接口
 * Built-in menu item factory interface
 *
 * 定义如何根据上下文创建内置菜单项，以及对应的菜单编码。
 * 可见性判断由 create 返回的菜单项 visible 字段承担，工厂级不再持有独立的可见性谓词。
 * @typeParam T - 行数据类型
 */
export interface BuiltinMenuItemFactory<T> {
  /** <zh/> 内置菜单项编码（仅已实现项可注册） | <en/> Built-in menu item code (only implemented codes may register) */
  code: ImplementedBuiltinMenuCode
  /** 创建菜单项（Create a context menu item） */
  create: (t: (path: string) => string, params: ContextMenuParams<T>) => ContextMenuItem<T>
}

/**
 * 内置菜单项工厂注册表
 * Built-in menu item factory registry
 * 以菜单编码为键，存储所有已注册的内置菜单项工厂。
 */
const REGISTRY = new Map<BuiltinMenuCode, BuiltinMenuItemFactory<any>>()

/**
 * 注册一个内置菜单项工厂
 * Register a built-in menu item factory
 *
 * 将工厂对象存入注册表，以 factory.code 为唯一标识。
 * @typeParam T - 行数据类型
 * @param factory - 内置菜单项工厂对象
 */
function register<T>(factory: BuiltinMenuItemFactory<T>) {
  REGISTRY.set(factory.code, factory)
}

/**
 * 获取内置菜单项工厂
 * Get a builtin menu item factory by code
 *
 * @param code - 内置菜单项编码
 * @returns 工厂对象
 */
export function getBuiltinFactory(code: BuiltinMenuCode): BuiltinMenuItemFactory<any> | undefined {
  return REGISTRY.get(code)
}

/**
 * 判断字符串是否为内置菜单项编码
 * Check if a string is a valid builtin menu code
 *
 * @param code - 编码字符串
 * @returns 是否为内置编码
 */
export function isBuiltinCode(code: string): code is ImplementedBuiltinMenuCode {
  return REGISTRY.has(code as ImplementedBuiltinMenuCode)
}

/**
 * 尚未实现的内置菜单项 code 运行时清单（与 PendingBuiltinMenuCode 同源）。
 * 展开路径遇到这些 code 时 dev 告警并跳过，不压入空名字菜单项。
 */
export const PENDING_BUILTIN_MENU_CODES: readonly PendingBuiltinMenuCode[] = [
  'deleteRow',
  'deleteSelectedRows',
  'insertRowAbove',
  'insertRowBelow',
]

register({
  code: 'copyCell',
  create: (t, params) => ({
    code: 'copyCell',
    name: t('table.contextMenu.copyCell'),
    suffix: { content: 'Ctrl+C' },
    visible: params.area === 'body',
  }),
})

register({
  code: 'copyCellWithHeader',
  create: (t, params) => ({
    code: 'copyCellWithHeader',
    name: t('table.contextMenu.copyCellWithHeader'),
    visible: params.area === 'body',
  }),
})

register({
  code: 'copyRow',
  create: (t, params) => ({
    code: 'copyRow',
    name: t('table.contextMenu.copyRow'),
    visible: params.area === 'body',
  }),
})

register({
  code: 'copyRowWithHeaders',
  create: (t, params) => ({
    code: 'copyRowWithHeaders',
    name: t('table.contextMenu.copyRowWithHeaders'),
    visible: params.area === 'body',
  }),
})

register({
  code: 'copySelectedRows',
  create: (t, params) => ({
    code: 'copySelectedRows',
    name: t('table.contextMenu.copySelectedRows'),
    visible: params.area === 'body',
  }),
})

register({
  code: 'copySelectedRowsWithHeaders',
  create: (t, params) => ({
    code: 'copySelectedRowsWithHeaders',
    name: t('table.contextMenu.copySelectedRowsWithHeaders'),
    visible: params.area === 'body',
  }),
})

register({
  code: 'cutCell',
  create: (t, params) => ({
    code: 'cutCell',
    name: t('table.contextMenu.cutCell'),
    suffix: { content: 'Ctrl+X' },
    visible: params.area === 'body',
  }),
})

register({
  code: 'pasteCell',
  create: (t, params) => ({
    code: 'pasteCell',
    name: t('table.contextMenu.pasteCell'),
    suffix: { content: 'Ctrl+V' },
    visible: params.area === 'body',
    disabled: true,
  }),
})

register({
  code: 'clearCell',
  create: (t, params) => ({
    code: 'clearCell',
    name: t('table.contextMenu.clearCell'),
    visible: params.area === 'body',
  }),
})

register({
  code: 'editCell',
  create: (t, params) => ({
    code: 'editCell',
    name: t('table.contextMenu.editCell'),
    visible: params.area === 'body',
  }),
})

// deleteRow / deleteSelectedRows / insertRowAbove / insertRowBelow:
// 行变更功能尚未实现，暂不注册（见 PendingBuiltinMenuCode）。
// 这些 code 被保留在 BuiltinMenuCode 类型中供未来实现时使用，
// 当前注册时将暴露 disabled=true 的可覆盖入口，造成「配置可启用但无实现」的陷阱。

register({
  code: 'autoSizeThisColumn',
  create: (t, params) => ({
    code: 'autoSizeThisColumn',
    name: t('table.contextMenu.autoSizeThisColumn'),
    visible: !!params.column,
  }),
})

register({
  code: 'autoSizeAllColumns',
  create: t => ({
    code: 'autoSizeAllColumns',
    name: t('table.contextMenu.autoSizeAllColumns'),
  }),
})

register({
  code: 'resetColumns',
  create: t => ({
    code: 'resetColumns',
    name: t('table.contextMenu.resetColumns'),
  }),
})

register({
  code: 'clearSort',
  create: (t, params) => ({
    code: 'clearSort',
    name: t('table.contextMenu.clearSort'),
    visible: params.area === 'header',
  }),
})

register({
  code: 'clearFilter',
  create: (t, params) => ({
    code: 'clearFilter',
    name: t('table.contextMenu.clearFilter'),
    visible: !!params.column,
  }),
})

register({
  code: 'clearAllFilters',
  create: t => ({
    code: 'clearAllFilters',
    name: t('table.contextMenu.clearAllFilters'),
  }),
})

register({
  code: 'exportCsv',
  create: t => ({
    code: 'exportCsv',
    name: t('table.contextMenu.exportCsv'),
  }),
})

register({
  code: 'exportExcel',
  create: t => ({
    code: 'exportExcel',
    name: t('table.contextMenu.exportExcel'),
  }),
})

register({
  code: 'importExcel',
  create: t => ({
    code: 'importExcel',
    name: t('table.contextMenu.importExcel'),
  }),
})

register({
  code: 'print',
  create: t => ({
    code: 'print',
    name: t('table.contextMenu.print'),
  }),
})

register({
  code: 'hideThisColumn',
  create: (t, params) => ({
    code: 'hideThisColumn',
    name: t('table.contextMenu.hideThisColumn'),
    visible: !!params.column,
  }),
})

register({
  code: 'showAllColumns',
  create: t => ({
    code: 'showAllColumns',
    name: t('table.contextMenu.showAllColumns'),
  }),
})

/**
 * 解析内置菜单项编码为完整菜单项列表
 * Resolve builtin menu codes into complete menu items
 *
 * @param codes - 内置菜单项编码数组
 * @param t - 国际化翻译函数
 * @param params - 右键菜单上下文
 * @param [disabledCodes] - 禁用的编码列表
 * @returns 菜单项列表
 */
export function resolveBuiltinItems<T>(
  codes: BuiltinMenuCode[],
  t: (path: string) => string,
  params: ContextMenuParams<T>,
  disabledCodes?: BuiltinMenuCode[],
): ContextMenuItemOrSeparator<T>[] {
  const disabledSet = new Set(disabledCodes ?? [])
  const items: ContextMenuItemOrSeparator<T>[] = []
  for (const code of codes) {
    if (disabledSet.has(code))
      continue
    const factory = REGISTRY.get(code)
    if (!factory)
      continue
    items.push(factory.create(t, params))
  }
  return items
}
