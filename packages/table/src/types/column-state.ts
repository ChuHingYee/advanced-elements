/**
 * <zh/> 可序列化的列状态 — 仅包含用户可调整的属性，数组顺序代表列的显示顺序
 * <en/> Serializable column state — only user-adjustable properties, array order represents column display order
 */
import type { RendererModeName } from './renderer-caps'
import type { SortOrder } from './sort'

/**
 * <zh/> 列状态快照项——`getColumnState` / `applyColumnState` 数组的元素形态
 * <en/> Column state snapshot entry — array element shape of `getColumnState` / `applyColumnState`
 */
export interface ColumnState {
  colId: string
  width?: number
  hidden?: boolean
  /**
   * <zh/> 固定方向。`false` = 不固定；`true` = 左固定（Element Plus 等价写法）。
   * <en/> Pinning direction. `false` = not pinned; `true` = pinned left (Element Plus spelling).
   *
   * @remarks
   * <zh/> 类型与运行时校验集合（`VALID_FIXED_VALUES`）已统一——`true` 为合法取值，
   * <zh/> 故 `getColumnState()` → JSON → `applyColumnState()` 往返可无损保留 `fixed: true`。
   * <en/> the type now matches the runtime validator (`VALID_FIXED_VALUES`), so a
   * <en/> `getColumnState()` → JSON → `applyColumnState()` round trip preserves `fixed: true`.
   */
  fixed?: true | 'left' | 'right' | false
  sort?: SortOrder
  /** <zh/> 多列排序时的排序索引 | <en/> Sort index for multi-column sorting */
  sortIndex?: number
  /**
   * <zh/> 序列化 schema 版本。版本不匹配时自动重置，避免静默加载旧布局导致错乱。
   * <zh/> 无此字段的数据按默认策略加载。
   * <en/> Serialization schema version. Auto-resets on version mismatch to prevent silent loading of stale layouts.
   * <en/> Payloads without this field load with default strategy.
   */
  schemaVersion?: number
  /**
   * <zh/> 持久化时的渲染模式。default 模式基于 <table> 模型，virtual 模式基于 Grid 模型，
   * <zh/> 两者 width 单位语义不同。apply 时若 mode 不一致则跳过 width 应用，避免视觉跳变。
   * <zh/> 历史数据（无此字段）按默认策略加载，宽度照常应用。
   * <en/> Render mode at the time of persistence. default mode is based on <table> layout, virtual mode is based on Grid layout,
   * <en/> the width unit semantics differ between the two. On apply, if mode mismatches, width application is skipped to avoid visual jump.
   * <en/> Payloads without this field load with default strategy, width is applied as usual.
   */
  mode?: RendererModeName
}

/** <zh/> applyColumnState 的选项 | <en/> Options for applyColumnState */
export interface ApplyColumnStateOptions {
  /**
   * <zh/> 是否应用列顺序
   * <en/> Whether to apply column order
   * @default true
   */
  applyOrder?: boolean
  /**
   * <zh/> 是否应用列宽
   * <en/> Whether to apply column width
   * @default true
   */
  applyWidth?: boolean
  /**
   * <zh/> 是否应用排序状态
   * <en/> Whether to apply sort state
   * @default true
   */
  applySort?: boolean
  /**
   * <zh/> 是否应用显隐状态。此前 `hidden` 不受任何开关控制、恒被覆写
   * <en/> Whether to apply visibility. Previously `hidden` was unconditionally overwritten with no switch
   * @default true
   */
  applyHidden?: boolean
  /**
   * <zh/> 是否应用固定状态。此前 `fixed` 不受任何开关控制、恒被覆写
   * <en/> Whether to apply pinning. Previously `fixed` was unconditionally overwritten with no switch
   * @default true
   */
  applyFixed?: boolean
}

/**
 * <zh/> 统一存储适配器抽象（列状态自动持久化与命名视图共用）。
 * <zh/> 值域为 string（JSON 由消费方序列化/反序列化），
 * <zh/> 默认实现为带 SSR/隐私模式探测的 localStorage 适配器。
 * <en/> Unified storage adapter abstraction (shared by column-state auto-persistence and named views).
 * <en/> Value domain is string (JSON (de)serialization is the consumer's responsibility);
 * <en/> the default implementation is a localStorage adapter with SSR / privacy-mode probing.
 */
export interface AdvTableStorageAdapter {
  get: (key: string) => Promise<string | null> | string | null
  set: (key: string, value: string) => Promise<void> | void
  remove: (key: string) => Promise<void> | void
}

/**
 * <zh/> 持久化操作中的错误信息。`domain` 区分列状态与命名视图两类持久化场景。
 * <en/> Persistence operation error info. `domain` distinguishes column-state vs named-view persistence scenarios.
 */
export interface AdvTableStorageError {
  phase: 'save' | 'restore' | 'remove'
  error: unknown
  key: string
  /** <zh/> 持久化场景：列状态 or 命名视图 | <en/> Persistence domain: column-state or named-view */
  domain: 'columnState' | 'namedView'
}

/**
 * <zh/> 列状态持久化配置（不含命名视图；命名视图共享本结构但无独立 Prop）。
 * <en/> Column-state persistence config (excludes named views; named views share this struct but have no dedicated Prop).
 */
export interface ColumnStatePersistence {
  /**
   * <zh/> 是否启用列状态持久化
   * <en/> Whether column-state persistence is enabled
   * @default false
   */
  enabled: boolean
  /** <zh/> 默认使用内置 localStorage 适配器 | <en/> Defaults to built-in localStorage adapter */
  storage?: AdvTableStorageAdapter
  /**
   * <zh/> 默认为 adv-table-cols-{tableId}。同页多表复用同一 tableId 会互踩——
   * <zh/> 显式复用时请同步显式隔离 storageKey。
   * <en/> Defaults to adv-table-cols-{tableId}. Tables sharing one tableId collide
   * <en/> isolate storageKey explicitly when sharing is intentional.
   */
  storageKey?: string
  /**
   * <zh/> 是否在状态变化时自动保存
   * <en/> Whether to auto-save when state changes
   * @default true
   */
  autoSave?: boolean
  /**
   * <zh/> 毫秒 | <en/> Milliseconds
   * @default 300
   */
  debounce?: number
  /**
   * <zh/> 是否在初始化时自动恢复持久化状态
   * <en/> Whether to auto-restore persisted state on init
   * @default true
   */
  autoRestore?: boolean
  /**
   * <zh/> 需要持久化的属性白名单。
   * <zh/> 未指定时（undefined）默认持久化 ColumnState 全部属性；
   * <zh/> 指定后仅持久化数组内列出的属性，可用于减少存储体积或排除敏感字段。
   * <en/> Whitelist of properties to persist.
   * <en/> When undefined, all ColumnState properties are persisted by default;
   * <en/> when specified, only listed properties are persisted, useful for reducing storage size or excluding sensitive fields.
   * @example ['colId', 'width', 'hidden']
   */
  include?: (keyof ColumnState)[]
  /**
   * <zh/> 存储读写异常时的错误处理策略（默认 'silent'）。
   * <zh/> - 'silent': 仅 dev 模式下 console.warn，不中断流程
   * <zh/> - 'warn':   console.warn 并触发 onStorageError 回调，但仍不抛出
   * <zh/> - 'throw':  重新抛出错误，调用方可 catch 处理
   * <en/> Error handling strategy for storage read/write exceptions (default 'silent').
   * <en/> - 'silent': only console.warn in dev mode, does not interrupt flow
   * <en/> - 'warn':   console.warn and trigger onStorageError callback, but does not throw
   * <en/> - 'throw':  rethrow error, caller can catch
   */
  errorStrategy?: 'silent' | 'warn' | 'throw'
  onStorageError?: (error: AdvTableStorageError) => void
}
