/**
 * <zh/> 筛选器策略注册表
 * <en/> Filter strategy registry
 *
 * @remarks
 * <zh/> 实现策略模式以支持可扩展的筛选类型。内置类型（text、number、date、enum）在初始化时注册，自定义类型可通过 `registerFilterType` 注册
 * <en/> Implements the Strategy Pattern for extensible filter types. Built-in types (text, number, date, enum) are registered at initialization, and custom types can be registered via `registerFilterType`
 */
import type { Component, InjectionKey } from 'vue'
import { getCurrentInstance, inject } from 'vue'
import { devWarnRepeat } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'

/**
 * <zh/> 筛选器策略接口
 * <en/> Filter strategy interface
 *
 * @remarks
 * <zh/> 定义一种筛选类型所需实现的方法，包括默认值创建、激活状态判断、单元格值匹配以及可选的浮层筛选组件和筛选面板组件
 * <en/> Defines the methods a filter type needs to implement, including default value creation, active state check, cell value matching, and optional floating filter component and filter panel component
 *
 * @typeParam TFilterValue - <zh/> 筛选值类型，默认为 any | <en/> filter value type, defaults to any
 */
export interface FilterStrategy<TFilterValue = any> {
  /** <zh/> 筛选类型标识，如 'text'、'number'、'date'、'enum' | <en/> Filter type identifier, e.g., 'text', 'number', 'date', 'enum' */
  type: string

  /**
   * <zh/> 创建默认筛选值
   * <en/> Create default filter value
   * @remarks
   * <zh/> 当用户打开筛选面板时，使用此方法初始化筛选值
   * <en/> Used to initialize the filter value when user opens the filter panel
   * @returns <zh/> 默认筛选值 | <en/> default filter value
   */
  createDefaultValue: () => TFilterValue

  /**
   * <zh/> 判断当前筛选值是否处于激活状态
   * <en/> Check if the current filter value is active
   * @remarks
   * <zh/> 用于决定是否在表头显示筛选标记
   * <en/> Used to determine whether to show the filter indicator in the column header
   * @param value - <zh/> 当前筛选值 | <en/> current filter value
   * @returns <zh/> 是否激活 | <en/> whether active
   */
  isActive: (value: TFilterValue) => boolean

  /**
   * <zh/> 判断单元格值是否匹配筛选条件
   * <en/> Check if a cell value matches the filter condition
   * @param cellValue - <zh/> 单元格原始值 | <en/> raw cell value
   * @param filterValue - <zh/> 筛选值 | <en/> filter value
   * @returns <zh/> 是否匹配 | <en/> whether it matches
   */
  matches: (cellValue: unknown, filterValue: TFilterValue) => boolean

  /**
   * <zh/> 浮层筛选组件（可选）
   * <en/> Floating filter component (optional)
   * @remarks
   * <zh/> 在表头浮层中渲染的筛选 UI 组件
   * <en/> Filter UI component rendered in the column header popup
   */
  floatingFilterComponent?: Component

  /**
   * <zh/> 筛选面板组件（可选）
   * <en/> Filter panel component (optional)
   * @remarks
   * <zh/> 在筛选面板中渲染的完整筛选 UI 组件
   * <en/> Full filter UI component rendered in the filter panel
   */
  filterPanelComponent?: Component
}

/**
 * <zh/> 筛选器策略注册表实例
 * <en/> Filter strategy registry instance
 *
 * @remarks
 * <zh/> 闭包 Map 实现，可经 createFilterRegistry 创建隔离实例，
 * <zh/> 由 provide/inject 按表实例隔离，避免全局互相覆盖。
 * <en/> Closure-Map implementation; isolated instances via createFilterRegistry,
 * <en/> scoped per table through provide/inject to avoid global clobbering.
 */
export interface FilterRegistry {
  /** <zh/> 注册策略 | <en/> Register a strategy */
  register: (strategy: FilterStrategy, opts?: RegisterFilterTypeOptions) => void
  /** <zh/> 按类型获取策略 | <en/> Get a strategy by type */
  get: (type: string) => FilterStrategy | undefined
  /** <zh/> 全部已注册类型 | <en/> All registered type names */
  types: () => string[]
  /** <zh/> 注销策略（测试/HMR 清理） | <en/> Unregister (test/HMR cleanup) */
  unregister: (type: string) => boolean
  /** <zh/> 清空注册表（测试/HMR 清理） | <en/> Clear the registry (test/HMR cleanup) */
  clear: () => void
}

/** <zh/> 注册冲突策略 | <en/> Registration conflict policy */
export interface RegisterFilterTypeOptions {
  /**
   * <zh/> 同名已存在时：'warn'（默认）告警后覆盖；'error' dev 抛错并保留旧值；'keep' 静默保留旧值。
   * <en/> On duplicate: 'warn' (default) overwrites with a warning; 'error' throws in dev and keeps the old one; 'keep' silently keeps the old one.
   */
  onConflict?: 'warn' | 'error' | 'keep'
}

/**
 * <zh/> 创建隔离的筛选器注册表——多表实例/微前端/测试需要策略隔离时使用，
 * <zh/> 配合 filterRegistryKey provide/inject 按表实例生效。
 * <en/> Create an isolated filter registry — for multi-table/micro-frontend/test isolation,
 * <en/> activated per table via filterRegistryKey provide/inject.
 */
export function createFilterRegistry(): FilterRegistry {
  const map = new Map<string, FilterStrategy>()
  return {
    register(strategy: FilterStrategy, opts?: RegisterFilterTypeOptions): void {
      const policy = opts?.onConflict ?? 'warn'
      if (map.has(strategy.type)) {
        if (policy === 'keep')
          return
        if (policy === 'error') {
          if (isDev) {
            throw new Error(`[AdvTable] Filter type "${strategy.type}" is already registered.`)
          }
          return
        }
        if (isDev) {
          devWarnRepeat(`Filter type "${strategy.type}" is already registered. Overwriting.`)
        }
      }
      map.set(strategy.type, strategy)
    },
    get(type: string): FilterStrategy | undefined {
      return map.get(type)
    },
    types(): string[] {
      return Array.from(map.keys())
    },
    unregister(type: string): boolean {
      return map.delete(type)
    },
    clear(): void {
      map.clear()
    },
  }
}

/**
 * <zh/> 全局默认注册表（兼容入口）——内置类型与 registerFilterType 默认落在此处。
 * <en/> Global default registry (compat entry) — built-ins and registerFilterType land here by default.
 *
 * @internal
 */
const filterRegistry = createFilterRegistry()

/**
 * <zh/> 按表实例隔离的注册表注入键——provide 自定义 registry 后，
 * <zh/> 表内读取优先命中实例注册表，未命中回退全局默认表（内置类型仍可用）。
 * <en/> Per-table registry injection key — after providing a custom registry,
 * <en/> in-table reads hit the instance registry first and fall back to the global
 * <en/> default (built-ins keep working).
 */
export const filterRegistryKey: InjectionKey<FilterRegistry> = Symbol('adv-table:filter-registry')

/**
 * <zh/> 解析当前表生效的策略读取器——注入优先、全局回退；无实例上下文（如管线动态创建）
 * <zh/> 时直接返回全局读取器，不触发 inject 告警。
 * <en/> Resolve the effective strategy reader — injected first, global fallback; with no
 * <en/> instance context (e.g. pipeline dynamic creation) it returns the global reader
 * <en/> directly without tripping inject warnings.
 */
export function useFilterRegistry(): Pick<FilterRegistry, 'get' | 'types'> {
  const injected = getCurrentInstance() ? inject(filterRegistryKey, null) : null
  if (!injected)
    return filterRegistry
  return {
    get: (type: string) => injected.get(type) ?? filterRegistry.get(type),
    types: () => Array.from(new Set([...injected.types(), ...filterRegistry.types()])),
  }
}

/**
 * <zh/> 注册自定义筛选类型
 * <en/> Register a custom filter type
 *
 * @param strategy - <zh/> 筛选器策略对象 | <en/> filter strategy object
 *
 * @example
 * ```ts
 * import { registerFilterType } from '@advanced-elements/table'
 *
 * registerFilterType({
 *   type: 'cascader',
 *   createDefaultValue:  => ({ type: 'cascader', selected: [] }),
 *   isActive: (v) => v.selected.length > 0,
 *   matches: (cellValue, filterValue) => filterValue.selected.includes(cellValue),
 * })
 * ```
 */
export function registerFilterType(strategy: FilterStrategy, opts?: RegisterFilterTypeOptions): void {
  filterRegistry.register(strategy, opts)
}

/**
 * <zh/> 按类型获取已注册的筛选器策略
 * <en/> Get a registered filter strategy by type
 *
 * @param type - <zh/> 筛选类型标识 | <en/> filter type identifier
 * @returns <zh/> 策略对象，未注册时返回 undefined | <en/> strategy object, returns undefined if not registered
 */
export function getFilterStrategy(type: string): FilterStrategy | undefined {
  return filterRegistry.get(type)
}

/**
 * <zh/> 获取所有已注册的筛选器类型名称
 * <en/> Get all registered filter type names
 *
 * @returns <zh/> 已注册的类型标识数组 | <en/> array of registered type identifiers
 */
export function getRegisteredFilterTypes(): string[] {
  return filterRegistry.types()
}

/**
 * <zh/> 注销自定义筛选类型（测试/HMR 清理） | <en/> Unregister a custom filter type (test/HMR cleanup)
 */
export function unregisterFilterType(type: string): boolean {
  return filterRegistry.unregister(type)
}

/**
 * <zh/> 清空全局注册表（测试/HMR 清理）——内置类型需重新注册
 * <en/> Clear the global registry (test/HMR cleanup) — built-ins need re-registration
 */
export function clearFilterRegistry(): void {
  filterRegistry.clear()
}
