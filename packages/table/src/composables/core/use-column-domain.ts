/**
 * <zh/> 列域装配器——列编排（第 1 节）与列特性（第 4-5 节 + 列 key 映射）
 * <en/> Column-domain assemblers — column orchestration (section 1) and column features (sections 4-5 + column key map)
 *
 * @remarks
 * <zh/> 上帝对象物理拆分产物：与 use-data-domain.ts 的数据装配器配对，
 * <zh/> 由 use-adv-table-data-columns 直接调用。
 * <en/> Product of the god-object physical split: pairs with the data assembler in use-data-domain.ts,
 * <en/> called directly by use-adv-table-data-columns.
 */
import type { Ref } from 'vue'
import type { AdvColumn, ProcessedColumn } from '../../types'
import type { UseColumnFeaturesOptions } from '../columns/use-column-features'
import type { UseAdvTableDataColumnsOptions } from './use-adv-table-data-columns'
import { computed, toValue } from 'vue'
import { createTableEmitter } from '../../utils/table-emitter'
import { useColumnFeatures } from '../columns/use-column-features'
import { useColumnsOrchestrator } from '../columns/use-columns-orchestrator'

/**
 * <zh/> 列基础装配依赖——第 1 节所需的窄切片（无数据依赖）
 * <en/> Column-base assembly deps — narrow slices needed by section 1 (no data dependencies)
 */
export interface ColumnBaseDeps<T> extends Pick<
  UseAdvTableDataColumnsOptions<T>,
  'columns' | 'emit' | 'models' | 'core'
> {}

/**
 * <zh/> 列基础装配——列编排（无数据依赖）
 * <en/> Column-base assembly — column orchestration (no data dependencies)
 */
export function buildColumnBase<T>(deps: ColumnBaseDeps<T>) {
  const { columns: columnsInput, emit: emitFn, models, core } = deps
  const tableEmit = createTableEmitter(emitFn, core.tableId)

  return useColumnsOrchestrator<T>({
    columns: () => toValue(columnsInput) as AdvColumn<T>[],
    // <zh/> 读取合并配置，使 defaultColDef/columnTypes 支持全局配置回退
    // <en/> Read merged config so defaultColDef/columnTypes fall back to the global config
    defaultColDef: () => core.mergedColumnConfig.value.defaultColDef,
    columnTypes: () => core.mergedColumnConfig.value.columnTypes,
    resizable: core.mergedResizable,
    onColumnsChange: (val) => { models.columns.value = val },
    // <zh/> 列顺序变化的唯一事件出口——列头拖拽/列设置面板拖拽均汇聚于此，
    // <zh/> 取代 use-drag-orchestrator 与 use-column-setting 各自的独立 emit，避免 columnMoved 双发
    // <en/> Single event exit for column order changes — header drag and column-setting panel drag
    // <en/> both converge here, replacing the independent emits in use-drag-orchestrator and use-column-setting
    onColumnOrderChange: cols => tableEmit('columnMoved', { columns: cols }),
  })
}

/** <zh/> 列基础装配结果 | <en/> Column-base assembly result */
export type ColumnBaseResult<T = any> = ReturnType<typeof buildColumnBase<T>>

/**
 * <zh/> 列特性装配依赖——与 useColumnFeatures 输入同形（Pick 复用，防漂移）
 * <zh/> 数据侧字段（columnClassification/sortState/filterState/setSorts/resetAllFilters）
 * <zh/> 由数据装配器提供；与闭包隐式共享不同，装配点全部显式构造
 * <en/> Column-features assembly deps — same shape as useColumnFeatures input (Pick reuse, no drift)
 * <en/> Data-side fields (columnClassification/sortState/filterState/setSorts/resetAllFilters)
 * <en/> are provided by the data assembler; unlike implicit closure sharing, the assembly site constructs everything explicitly
 */
export interface ColumnFeaturesDeps extends Pick<
  UseColumnFeaturesOptions,
  | 'localColumns'
  | 'resetColumns'
  | 'setColumns'
  | 'touchColumns'
  | 'columnClassification'
  | 'sortState'
  | 'filterState'
  | 'setSorts'
  | 'resetAllFilters'
  | 'filterConfig'
  | 'columnState'
  | 'mode'
  | 'mergedColumnConfig'
  | 'tableId'
  | 'onResetColumnWidths'
> {
  /**
   * <zh/> 有效列树（列 key 映射用；不再透传给 useColumnFeatures） | <en/> Effective column tree (for the column key map; no longer forwarded to useColumnFeatures)
   */
  effectiveColumns: Ref<ProcessedColumn[]>
}

/**
 * <zh/> 构建列 key 映射——`prop` 主键 + `key`/`property` 别名三注册（纯函数，可单测）。
 * <zh/> 首见优先：别名仅在与已登记键不同且未被占用时写入，保证既有 prop 查询逐键不变；条目上界 3 × 列数。
 * <en/> Build the column key map — `prop` primary + `key`/`property` alias triple registration (pure, unit-testable).
 * <en/> First-seen-wins: aliases are written only when distinct from registered keys and still free, keeping existing prop lookups identical; entries bounded at 3 × column count.
 */
export function buildColumnByKeyMap(cols: readonly ProcessedColumn[]): Map<string, ProcessedColumn> {
  const map = new Map<string, ProcessedColumn>()
  function register(col: ProcessedColumn): void {
    const prop = col.prop
    const key = col.key
    if (prop != null && !map.has(prop))
      map.set(prop, col)
    // <zh/> 别名仅在 `key` 与 `prop` 不同且未被占用时写入——保证既有 prop 查询逐键不变
    // <en/> Alias written only when `key` differs from `prop` and is still free — keeps prop lookups identical
    if (key != null && key !== prop && !map.has(key))
      map.set(key, col)
    // <zh/> `property` 别名：ElTable 事件列对象只携带 `property`（见 resolveColumnFromParams），此处补登记使 property-first 查询命中
    // <zh/>（`property` 非 AdvColumn 公开字段，经 Record 安全读取）
    // <en/> `property` alias: ElTable event column objects carry only `property` (see resolveColumnFromParams); registered here so property-first lookups hit
    // <en/> (`property` is not an AdvColumn public field, read safely via Record)
    const property = (col as unknown as Record<string, unknown>).property
    if (typeof property === 'string' && property !== '' && property !== prop && property !== key && !map.has(property))
      map.set(property, col)
    // <zh/> 递归注册分组子列——effectiveColumns 为列树，子列必须可解析，否则分组编辑/校验/事件静默失败
    // <en/> Recursively register group children — effectiveColumns is a tree; children must resolve or grouped edit/validate/events silently fail
    const children = (col as unknown as { children?: unknown }).children
    if (Array.isArray(children)) {
      for (const child of children) {
        if (child && typeof child === 'object')
          register(child as ProcessedColumn)
      }
    }
  }
  for (const col of cols)
    register(col)
  return map
}

/**
 * <zh/> 列特性装配——分类 + 状态 + 分组 + 筛选面板 + 列 key 映射
 * <en/> Column-features assembly — categorization + state + group + filter panel + column key map
 */
export function buildColumnFeatures(deps: ColumnFeaturesDeps) {
  const {
    localColumns,
    effectiveColumns,
    resetColumns,
    setColumns,
    touchColumns,
    columnClassification,
    sortState,
    filterState,
    setSorts,
    resetAllFilters,
    filterConfig,
    columnState,
    mode,
    mergedColumnConfig,
    tableId,
    onResetColumnWidths,
  } = deps

  const features = useColumnFeatures({
    localColumns,
    resetColumns,
    setColumns,
    touchColumns,
    columnClassification,
    sortState,
    filterState,
    setSorts,
    resetAllFilters,
    filterConfig,
    columnState,
    mode,
    mergedColumnConfig,
    tableId,
    // <zh/> 接线 resetColumnWidths——通过虚拟渲染器 ref 调用，
    // <zh/> applyColumnState 恢复列宽前清空 useColumnResize.columnWidths 缓存。
    // <zh/> default 模式下 ref 不存在 resetColumnWidths，回调为空操作。
    // <en/> Wire resetColumnWidths — calls virtual renderer's resetColumnWidths via ref,
    // <en> clearing useColumnResize.columnWidths cache before applyColumnState restores widths.
    // <en> In default mode, the ref doesn't have resetColumnWidths, the callback is a no-op.
    onResetColumnWidths,
  })

  /**
   * <zh/> 列 key 映射——同时登记 `prop` 与 `key` 两种列标识。
   *
   * <zh/> **为何需要双标识**：库内对同一列存在两个标识域，且不同消费点各用一个——
   * <zh/> • `prop`（ElTable 内部经 `column.property` 回传）：`resolveColumnFromParams` 与
   * <zh/>   `edit.start` 的列解析均以 property/prop 查询；
   * <zh/> • `key`（`getColumnKey` = `key ?? prop ?? …`）：`watchSortChangeAndRefetch` 以
   * <zh/>   `sortEntry.columnKey ?? prop` 查询。
   * <zh/> 当列显式配置 `key` 且与 `prop` 不同（如 `key: 'userName', prop: 'name'`）时，两者都须登记。
   *
   * <zh/> **为何是双登记而非改查询口径**：ElTable 内部列对象只携带 `property`（无法表达 `key`），
   * <zh/> 故 key-first 口径在 default 模式不可达。双登记对既有 prop 查询**逐键等价**
   * <zh/> （prop 作为主键先写入）不改变任何既有解析结果
   * <zh/> 别名仅在两者不同且未被占用时写入，条目数上界为 2 × 列数。
   *
   * <en/> Column key map — registers **both** `prop` and `key` identifiers.
   *
   * <en/> **Why both**: the library has two identifier domains for a column, each used by different
   * <en/> consumers
   * <en/> • `prop` (returned by ElTable as `column.property`): `resolveColumnFromParams` and the
   * <en/>   `edit.start` column resolution query by property/prop;
   * <en/> • `key` (`getColumnKey` = `key ?? prop ?? …`): `watchSortChangeAndRefetch` queries by
   * <en/>   `sortEntry.columnKey ?? prop`.
   * <en/> When a column explicitly sets a `key` different from `prop` (e.g. `key: 'userName'`,
   * <en/> `prop: 'name'`), keying on prop alone makes the sort event's `column` / `columns` silently
   * <en/> `undefined`.
   *
   * <en/> **Why dual registration instead of changing the lookup caliber**: ElTable's internal column
   * <en/> object carries only `property` (it cannot express `key`), so a key-first caliber is
   * <en/> unreachable in default mode. Dual registration is **key-for-key equivalent** for existing prop
   * <en/> lookups (prop is written first as the primary key) and only fills previously-missing hits,
   * <en/> changing no existing resolution result. Aliases are written only when the two differ and the
   * <en/> key is still free, bounding entries at 2 × column count.
   */
  const columnByKeyMap = computed(() => buildColumnByKeyMap(effectiveColumns.value))

  return { ...features, columnByKeyMap }
}

/** <zh/> 列特性装配结果 | <en/> Column-features assembly result */
export type ColumnFeaturesResult = ReturnType<typeof buildColumnFeatures>
