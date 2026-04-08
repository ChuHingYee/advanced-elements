import type { Component } from 'vue'
import type { BuiltinCellEditorType, CellEditorType, EditorComponent } from '../../types/edit'
import { devWarnRepeat } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'

/**
 * <zh/> 内置编辑器注册表——使用 Map 与 customEditors 保持数据结构一致
 * <en/> Built-in editor registry — uses Map for structural consistency with customEditors
 */
const builtInEditors = new Map<BuiltinCellEditorType, Component>()

/**
 * <zh/> 自定义编辑器注册表，支持动态注册和覆盖 | <en/> Custom editor registry, supports dynamic registration and override
 */
const customEditors = new Map<string, Component>()

/**
 * <zh/> 注册内置编辑器组件
 * <en/> Register a built-in editor component
 * @remarks
 * <zh/> 内置编辑器通过字符串类型名引用，优先于自定义编辑器
 * <en/> Built-in editors are referenced by string type name, taking priority over custom editors
 * @param type - <zh/> 编辑器类型标识（如 'input'、'select'） | <en/> editor type identifier (e.g. 'input', 'select')
 * @param component - <zh/> 编辑器 Vue 组件 | <en/> editor Vue component
 *
 * @remarks
 * <zh/> 重复注册同一 `type` 时覆盖旧组件，并在 dev 下告警，避免多实例/多插件静默互相覆盖。
 * <en/> Re-registering the same `type` overwrites the previous component and warns in dev,
 * <en/> preventing silent clobbering across instances/plugins.
 */
export function registerBuiltInEditor(type: BuiltinCellEditorType, component: Component): void {
  if (isDev && builtInEditors.has(type)) {
    devWarnRepeat(`Built-in editor "${type}" is already registered. Overwriting.`)
  }
  builtInEditors.set(type, component)
}

/**
 * <zh/> 单表编辑器覆盖表类型——与 `EditConfig.editors` 同形，支持 Record 与 Map 两种形态
 * <en/> Per-table editor override table type — same shape as `EditConfig.editors`, supports both Record and Map forms
 */
export type TableEditorOverrides
  = | Record<string, EditorComponent | Component>
    | Map<string, EditorComponent | Component>

/**
 * <zh/> 注册自定义单元格编辑器
 * <en/> Register a custom cell editor
 * @remarks
 * <zh/> 自定义编辑器优先级低于内置编辑器，当类型不为字符串类型或未命中内置编辑器时使用
 * <en/> Custom editors have lower priority than built-in editors, used when type is not a string or doesn't match any built-in editor
 * @param name - <zh/> 自定义编辑器名称 | <en/> custom editor name
 * @param component - <zh/> 编辑器组件（EditorComponent | Component） | <en/> editor component (EditorComponent | Component)
 *
 * @remarks
 * <zh/> 重复注册同一 `name` 时覆盖旧组件，并在 dev 下告警。
 * <en/> Re-registering the same `name` overwrites the previous component and warns in dev.
 */
export function registerCellEditor(name: string, component: EditorComponent | Component): void {
  if (isDev && customEditors.has(name)) {
    devWarnRepeat(`Cell editor "${name}" is already registered. Overwriting.`)
  }
  customEditors.set(name, component)
}

/**
 * <zh/> 注销自定义单元格编辑器——删除全局 Map 中的注册，幂等：名称为空或未注册时直接返回
 * <en/> Unregister a custom cell editor — removes the global Map entry, idempotent: no-op when name is empty or unregistered
 * @remarks
 * <zh/> 仅影响全局自定义注册表，不触及内置编辑器与 `EditConfig.editors` 单表覆盖；
 * <zh/> 微前端/多表共存场景下用于清理，避免模块级全局泄漏。
 * <en/> Only affects the global custom registry, never built-in editors nor per-table `EditConfig.editors` overrides;
 * <en/> used for cleanup in micro-frontend / multi-table scenarios to avoid module-level global leaks.
 * @param name - <zh/> 自定义编辑器名称 | <en/> custom editor name
 */
export function unregisterCellEditor(name: string): void {
  if (!name)
    return
  customEditors.delete(name)
}

/**
 * <zh/> 作用域编辑器注册表——实例级隔离，多表/微前端共存时替代全局 `registerCellEditor`。
 * <zh/> 经 `asOverrides()` 以 `EditConfig.editors`（Map 形态）传入单表，解析优先级高于全局（见 `resolveEditor`），随表卸载丢弃即可，无需手动注销。
 * <en/> Scoped editor registry — instance-level isolation for multi-table/micro-frontend coexistence, replacing global `registerCellEditor`.
 * <en/> Pass `asOverrides()` as the per-table `EditConfig.editors` (Map form); it outranks globals in `resolveEditor` and dies with the table — no manual unregister needed.
 *
 * @example
 * ```ts
 * const editors = createScopedEditorRegistry()
 * editors.register('tree-select', TreeSelectEditor)
 * // <AdvTable :edit-config="{ editors: editors.asOverrides() }" />
 * ```
 */
export interface ScopedEditorRegistry {
  /** <zh/> 注册作用域编辑器（仅本注册表可见） | <en/> Register a scoped editor (visible to this registry only) */
  register: (name: string, component: EditorComponent | Component) => void
  /** <zh/> 注销作用域编辑器，幂等 | <en/> Unregister a scoped editor, idempotent */
  unregister: (name: string) => void
  /** <zh/> 是否已注册 | <en/> Whether the name is registered */
  has: (name: string) => boolean
  /** <zh/> 以 `EditConfig.editors`（Map 形态）导出，供单表传入 | <en/> Export as `EditConfig.editors` (Map form) for per-table use */
  asOverrides: () => Map<string, EditorComponent | Component>
}

export function createScopedEditorRegistry(): ScopedEditorRegistry {
  const scoped = new Map<string, EditorComponent | Component>()
  return {
    register(name: string, component: EditorComponent | Component): void {
      if (!name || !component)
        return
      if (isDev && scoped.has(name))
        devWarnRepeat(`[AdvTable] Scoped editor "${name}" is already registered. Overwriting.`)
      scoped.set(name, component)
    },
    unregister(name: string): void {
      if (!name)
        return
      scoped.delete(name)
    },
    has(name: string): boolean {
      return scoped.has(name)
    },
    asOverrides(): Map<string, EditorComponent | Component> {
      return scoped
    },
  }
}

/**
 * <zh/> 解析编辑器配置，返回对应的编辑器组件
 * <en/> Resolve editor config, return the corresponding editor component
 * @remarks
 * <zh/> 解析优先级（`tableEditors` 缺省时退化为存量语义，存量不受影响）：
 * <zh/>   1. 非字符串类型 → 直接作为组件返回
 * <zh/>   2. 命中单表覆盖 `tableEditors`（`EditConfig.editors`）→ 返回单表组件
 * <zh/>   3. 命中内置编辑器 → 返回内置组件
 * <zh/>   4. 命中全局自定义编辑器 → 返回自定义组件
 * <zh/>   5. 未找到 → 返回 undefined
 * <en/> Resolution priority (falls back to legacy semantics when `tableEditors` is absent, no stock impact):
 * <en/>   1. Non-string type → return directly as component
 * <en/>   2. Hits per-table `tableEditors` (`EditConfig.editors`) → return per-table component
 * <en/>   3. Hits built-in editor → return built-in component
 * <en/>   4. Hits global custom editor → return custom component
 * <en/>   5. Not found → return undefined
 * @param editor - <zh/> 编辑器配置（编辑器类型名、组件实例、或 undefined） | <en/> editor config (editor type name, component instance, or undefined)
 * @param tableEditors - <zh/> 单表覆盖表（`EditConfig.editors`，Record/Map 均可），缺省为 undefined | <en/> per-table overrides (`EditConfig.editors`, Record/Map both accepted), defaults to undefined
 * @returns <zh/> 解析到的编辑器组件，未找到时返回 undefined | <en/> resolved editor component, returns undefined if not found
 */
export function resolveEditor(
  editor: CellEditorType | string | Component | undefined,
  tableEditors?: TableEditorOverrides | Record<string, Component> | undefined,
): EditorComponent | Component | undefined {
  if (!editor)
    return undefined

  if (typeof editor !== 'string')
    return editor

  if (tableEditors) {
    if (tableEditors instanceof Map) {
      const scoped = tableEditors.get(editor)
      if (scoped)
        return scoped
    }
    else {
      const scoped = (tableEditors as Record<string, EditorComponent | Component>)[editor]
      if (scoped)
        return scoped
    }
  }

  const builtIn = builtInEditors.get(editor as BuiltinCellEditorType)
  if (builtIn)
    return builtIn

  const custom = customEditors.get(editor)
  if (custom)
    return custom

  return undefined
}
