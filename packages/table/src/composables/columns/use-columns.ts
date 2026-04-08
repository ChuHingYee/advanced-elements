/**
 * <zh/> 表格列管理 Composable
 * <en/> Table column management composable
 *
 * @remarks
 * <zh/> 处理列的配置、显示/隐藏、列设置等功能。支持通过递归列树处理实现多级表头
 * <en/> Handles column configuration, visibility, column settings, etc. Supports multi-level headers via recursive column tree processing
 */
import type { MaybeRefOrGetter, Ref, ShallowRef } from 'vue'
import type { AdvColumn, ProcessedColumn } from '../../types'
import type { FormatContext } from '../../types/column'
import { cloneDeep } from 'lodash-es'
import { computed, shallowRef, toValue, watch } from 'vue'
import { clampMinWidth, DEFAULT_MIN_COLUMN_WIDTH } from '../../constants'
import { applyColumnDefaults } from '../../utils/column-defaults'
import { BUILTIN_COLUMN_TYPES } from '../../utils/column-presets'
import { ensureColumnIds, stableReorderByKey, traverseColumnTree, validateColumns } from '../../utils/column-tree'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { getColumnFixedGroup, getColumnKey, isGroupColumn } from '../../utils/shared'

/**
 * <zh/> 表格列配置选项
 * <en/> Table column configuration options
 */
export interface UseColumnsOptions<T = any> {
  /** <zh/> 表格列配置 | <en/> Table column configuration */
  columns: AdvColumn<T>[] | Ref<AdvColumn<T>[]> | (() => AdvColumn<T>[])
  /**
   * <zh/> 表格级列宽拖拽默认值。
   * <zh/> 为 `true` 时，未显式设置 `resizable` 的列均可拖拽。
   * <zh/> 为 `false` 时，仅 `resizable: true` 的列可拖拽。
   * <zh/> 列级 `resizable` 优先级高于此值。
   * <en/> Table-level column width drag default value.
   * <en/> When `true`, all columns without explicit `resizable` setting are draggable.
   * <en/> When `false`, only columns with `resizable: true` are draggable.
   * <en/> Column-level `resizable` takes precedence over this value.
   */
  resizable?: boolean | Ref<boolean> | (() => boolean)
  /**
   * <zh/> 全局默认列定义，应用于所有列（最低优先级）。
   * <zh/> 被 `columnTypes[type]` 和列自身定义覆盖。支持响应式（调用方常转交合并配置的 getter）。
   * <en/> Global default column definition, applied to all columns (lowest priority).
   * <en/> Overridden by `columnTypes[type]` and column's own definition. Reactive (callers often forward merged-config getters).
   */
  defaultColDef?: MaybeRefOrGetter<Partial<AdvColumn<T>> | undefined>
  /**
   * <zh/> 命名列类型预设（中等优先级）。
   * <zh/> 列通过 `type` 属性引用预设。
   * <zh/> 覆盖 `defaultColDef`，被列自身定义覆盖。支持响应式。
   * <en/> Named column type presets (medium priority).
   * <en/> Columns reference presets via `type` property.
   * <en/> Overrides `defaultColDef`, overridden by column's own definition. Reactive.
   */
  columnTypes?: MaybeRefOrGetter<Record<string, Partial<AdvColumn<T>>> | undefined>
}

/** <zh/> 跨外部列更新保留的用户调整状态 | <en/> User-adjusted state preserved across external column updates */
interface ColumnUserState {
  hidden?: boolean
  fixed?: 'left' | 'right' | boolean
  /** <zh/> 用户自定义列宽，服务端列配置推送时保留 | <en/> User custom column width, preserved during server column config push */
  width?: number
  /**
   * <zh/> 遍历序号（DFS），用于外部列配置更新时保留用户已调整的列顺序
   * <en/> Traversal sequence (DFS), used to preserve the user's column order across external column-config updates
   */
  order?: number
}

/** <zh/> 表格列管理返回值 | <en/> Return value of table column management */
export interface UseColumnsReturn<T = any> {
  /** <zh/> 当前列配置（保留树状结构） | <en/> Current column config (tree structure preserved) */
  localColumns: Ref<ProcessedColumn[]>
  /** <zh/> 是否有列配置 | <en/> Whether any column config exists */
  hasColumns: Ref<boolean>
  /** <zh/> 重置列配置 | <en/> Reset the column config */
  resetColumns: () => void
  /**
   * 直接设置列（来自列设置的内部操作）。
   * 同步更新 originColumns，确保后续外部更新正确合并。
   */
  setColumns: (cols: ProcessedColumn[]) => void
  /**
   * 触发 localColumns 重渲染（属性突变后调用，不同步 originColumns 也不 emit）
   */
  touchColumns: () => void
  /** <zh/> 原始列配置快照，整体替换 | <en/> Snapshot of the original column config, replaced wholesale */
  originColumns: ShallowRef<ProcessedColumn[]>
  /** <zh/> 原始列的格式化函数映射快照，整体替换 | <en/> Snapshot of the original columns' format-function map, replaced wholesale */
  originColumnsFormatMap: ShallowRef<Record<string, (ctx: FormatContext<T>) => string>>
}

/**
 * 管理表格列的状态和操作
 *
 * @param options - 列配置选项
 * @param emitUpdate - 列变化时的回调
 */
export function useColumns<T = any>(
  options: UseColumnsOptions<T>,
  emitUpdate: (val: ProcessedColumn[]) => void,
): UseColumnsReturn<T> {
  /** <zh/> 列初始快照，仅整体替换，无需逐属性追踪 | <en/> Initial column snapshot, replaced wholesale only; no per-property tracking needed */
  const originColumns = shallowRef<ProcessedColumn[]>([])
  /** <zh/> 列格式化函数映射快照，仅整体替换 | <en/> Column format-function map snapshot, replaced wholesale only */
  const originColumnsFormatMap = shallowRef<Record<string, (ctx: FormatContext<T>) => string>>({})
  /**
   * <zh/> 外部配置纯快照——仅由外部列 prop 到达时更新，内部面板操作（setColumns）不污染。
   * <zh/> resetColumns 基于它恢复，保证"重置"真正回到外部初始状态而非最近一次面板改动。
   * <en/> Pristine snapshot from external column props — only updated when external columns arrive,
   * <en/> never polluted by internal panel operations (setColumns). resetColumns restores from it,
   * <en/> so "reset" truly returns to the external baseline instead of the latest panel change.
   */
  const pristineColumns = shallowRef<ProcessedColumn[]>([])
  const pristineColumnsFormatMap = shallowRef<Record<string, (ctx: FormatContext<T>) => string>>({})
  /**
   * <zh/> 最近一次内部 setColumns 发出值的内容签名——受控模式下父组件会将其回写为 prop，
   * <zh/> mergeColumns 时据此签名识别回显（而非引用比较），避免 normalizeColumn 克隆产生的新引用导致回显检测失效。
   * <en/> Content signature of the last value emitted by internal setColumns — in controlled mode the parent
   * <en/> writes it back as a prop; mergeColumns uses this signature (not reference comparison) to detect echo,
   * <en/> avoiding false echo-detection failures caused by normalizeColumn cloning producing new references.
   */
  let lastInternalEmitSignature = ''

  const rawColumns = computed(() => {
    const cols = toValue(options.columns)
    if (cols && cols.length > 0) {
      const mergedColumnTypes = { ...BUILTIN_COLUMN_TYPES, ...toValue(options.columnTypes) } as Record<string, Partial<AdvColumn<T>>>
      // Merge table-level resizable into defaultColDef (lowest priority, column-level resizable overrides)
      const tableResizable = toValue(options.resizable)
      const defaultColDef = toValue(options.defaultColDef)
      const effectiveDefaultColDef = tableResizable !== undefined
        ? { resizable: tableResizable, ...defaultColDef }
        : defaultColDef
      return assignInternalIds(
        applyColumnDefaults<T>(cols, effectiveDefaultColDef, mergedColumnTypes)
          .map(col => normalizeColumn(col)),
      )
    }
    return []
  })

  // 开发模式下对原始列配置做运行时校验，输出结构化警告（不阻断渲染）。
  // 必须在 ensureColumnIds 之前校验，否则合成 id 会掩盖缺失 key 的真实问题。
  if (isDev) {
    watch(() => toValue(options.columns), (cols) => {
      if (!cols || cols.length === 0)
        return
      const warnings = validateColumns(cols as Array<Record<string, any>>)
      if (warnings.length > 0) {
        devWarn('[AdvTable] 列配置校验警告', warnings)
      }
    }, { immediate: true })
  }

  /**
   * 从 rawColumns 同步初始化，避免 watch+immediate 双重渲染。
   *
   * 使用 shallowRef 而非 ref：列对象树通常较大且嵌套深，深响应式 Proxy 会带来
   * 显著的递归拦截开销。所有变更点（setColumns / mergeColumns / resetColumns /
   * applyColumnState）均通过整体替换数组引用触发响应式，不存在依赖深属性劫持的
   * 单点突变路径，因此 shallowRef 在保留功能的同时消除深劫持性能损耗。
   */
  const localColumns = shallowRef<ProcessedColumn[]>(rawColumns.value)

  if (rawColumns.value.length > 0) {
    saveOriginColumns()
    savePristineColumns(rawColumns.value)
  }

  const hasColumns = computed(() => localColumns.value.length > 0)

  /**
   * <zh/> 深拷贝列树
   * <en/> Deep clone column tree
   *
   * @remarks
   * <zh/> 用 lodash-es `cloneDeep`（tree-shaking 友好，无 structuredClone 的 HTTP 安全上下文限制）。
   * <zh/> 快照（origin/pristine）与 `resetColumns` 产物必须与就地修改彻底隔离，故真深拷贝；
   * <zh/> `use-column-group` 的编排副本只需结构隔离，深拷贝会带来新组件身份与额外开销，二者不可统一。
   * <zh/> 安全前置条件（隐性依赖，勿破坏）：列数组均为 `shallowRef` 且不进 `reactive()` 容器，
   * <zh/> `cloneDeep` 复制可枚举自有属性但不复制 `markRaw` 标记（`__v_skip` 不可枚举）——
   * <zh/> 组件字段须保持 `markRaw`，否则进入深响应式容器会触发 Vue 告警并损害性能。
   * <zh/> 成本：每次 `setColumns` 深拷贝一次，列数十级可忽略；若列内嵌大对象，成本随每次操作放大。
   * <en/> Uses lodash-es `cloneDeep` (tree-shakable, no structuredClone HTTP secure-context limitation).
   * <en/> Snapshots (origin/pristine) and `resetColumns` output must be fully isolated from in-place mutation;
   * <en/> `use-column-group` orchestration copies only need structural isolation — deep cloning mints new
   * <en/> component identities and adds cost, so the two must not be unified.
   * <en/> Safety preconditions (implicit dependency, do not break): column arrays are `shallowRef` and never
   * <en/> enter a `reactive()` container; `cloneDeep` copies enumerable own props but not the `markRaw` marker
   * <en/> (`__v_skip` is non-enumerable) — component fields must keep `markRaw`, or proxying a deep-reactive
   * <en/> column array triggers Vue's "Component made a reactive object" warning and degrades performance.
   * <en/> Cost: `setColumns` deep-clones once per call; negligible for dozens of columns, but multiplies with
   * <en/> bulky embedded objects (e.g. `search.fieldProps` / `cellEditorParams`).
   */
  function deepCloneColumnTree(cols: ProcessedColumn[]): ProcessedColumn[] {
    return cloneDeep(cols)
  }

  /**
   * <zh/> 保存列快照（克隆 + formatMap 同步）。origin 和 pristine 两个快照逻辑同构，收敛为单一函数避免双实现漂移。
   * <en/> Save a column snapshot (clone + formatMap sync). The origin and pristine snapshots share identical logic, unified into a single function to prevent implementation drift.
   *
   * @param cols - <zh/> 源列数组 | <en/> source column array
   * @param target - <zh/> 快照目标 ref | <en/> snapshot target ref
   * @param target.value - <zh/> 快照目标列数组 | <en/> snapshot target column array
   * @param formatTarget - <zh/> formatMap 目标 ref | <en/> formatMap target ref
   * @param formatTarget.value - <zh/> formatMap 目标映射 | <en/> formatMap target record
   */
  function saveColumnSnapshot(
    cols: ProcessedColumn[],
    target: { value: ProcessedColumn[] },
    formatTarget: { value: Record<string, (ctx: FormatContext<T>) => string> },
  ): void {
    target.value = deepCloneColumnTree(cols)
    /** <zh/> 先构建完整映射再整体赋值，确保 shallowRef 触发响应式更新 | <en/> Build complete map first then assign, ensuring shallowRef triggers reactive update */
    const formatMap: Record<string, (ctx: FormatContext<T>) => string> = {}
    traverseColumnTree(cols, (col) => {
      if (col.format) {
        formatMap[getColumnKey(col)] = col.format
      }
    })
    formatTarget.value = formatMap
  }

  /** <zh/> 保存内部列快照（origin），用于后续外部 prop 更新时合并用户状态 | <en/> Save internal column snapshot (origin), used for merging user state on subsequent external prop updates */
  function saveOriginColumns(): void {
    saveColumnSnapshot(localColumns.value, originColumns, originColumnsFormatMap)
  }

  /**
   * <zh/> 保存外部配置纯快照（pristine）。仅外部列 prop 首次到达/更新时调用；
   * <zh/> 内部面板操作（setColumns）不得调用，否则重置将恢复最近一次面板改动。
   * <en/> Save the pristine external-column snapshot. Called only when external column props
   * <en/> first arrive or update; internal panel operations (setColumns) must never call it,
   * <en/> otherwise reset would restore the latest panel change instead of the baseline.
   */
  function savePristineColumns(cols: ProcessedColumn[]): void {
    saveColumnSnapshot(cols, pristineColumns, pristineColumnsFormatMap)
  }

  /**
   * <zh/> 构建列树的内容签名——用于回显检测，替代引用比较。
   * <zh/> 全树 DFS 前序遍历：包含每列 key、hidden、fixed、width、format 有无及分组结构/顺序，
   * <zh/> 能精确区分"内容相同的新引用"与"内容不同的新数组"。组内顺序/显隐变化同样改变签名。
   * <zh/> 分隔符用 '\0'（列 key 可能含逗号，逗号分隔会误判）。
   * <en/> Build a content signature for the column tree — used for echo detection instead of reference comparison.
   * <en/> Full-tree DFS pre-order: covers every column's key, hidden, fixed, width, format presence and
   * <en/> group structure/order, precisely distinguishing "same content new reference" from "different content
   * <en/> new array". In-group order/visibility changes alter the signature as well.
   * <en/> Separated by '\0' (column keys may contain commas, which would corrupt comma-joined comparison).
   */
  function buildColumnStateSignature(cols: ProcessedColumn[]): string {
    const parts: string[] = []
    traverseColumnTree(cols, (col) => {
      // <zh/> fixed 先归一再签名——true 与 'left' 语义等价（见 getColumnFixedGroup），不等价书写不应视为外部变更
      // <en/> Normalize fixed before signing — true and 'left' are equivalent (see getColumnFixedGroup); equivalent spellings must not count as external changes
      parts.push(
        `${getColumnKey(col)}:${col.hidden ?? false}:${getColumnFixedGroup(col)}:${col.width ?? ''}:${col.format ? 1 : 0}`,
      )
    })
    return parts.join('\0')
  }

  function resetColumns() {
    localColumns.value = deepCloneColumnTree(pristineColumns.value)
    traverseColumnTree(localColumns.value, (col) => {
      const key = getColumnKey(col)
      if (pristineColumnsFormatMap.value[key]) {
        col.format = pristineColumnsFormatMap.value[key]
      }
    })
    lastInternalEmitSignature = ''
    emitUpdate(localColumns.value)
  }

  function normalizeColumn(col: AdvColumn<T>): ProcessedColumn {
    const normalized: ProcessedColumn = {
      hidden: col.hidden ?? false,
      ...col,
    } as ProcessedColumn

    // <zh/> 非法宽度运行时钳制——width <= 0 的列会渲染为死列并破坏列宽累加/滚动定位，
    // <zh/> 此处经 clampMinWidth 钳制到最小列宽；配置问题本身由 validateColumns 在 dev 告警（同文件 rawColumns 流程）。
    // <en/> Clamp invalid widths at runtime — columns with width <= 0 render as dead columns and
    // <en/> break width accumulation / scroll positioning; clamped via clampMinWidth here.
    // <en/> The config issue itself is reported by validateColumns in dev (same-file rawColumns flow).
    if (typeof normalized.width === 'number' && !(normalized.width > 0)) {
      normalized.width = clampMinWidth(normalized.width, DEFAULT_MIN_COLUMN_WIDTH)
    }

    if (normalized.pinFixed && !normalized.fixed) {
      normalized.fixed = normalized.pinFixed
    }

    if (isGroupColumn(normalized) && normalized.children) {
      normalized.children = (normalized.children as AdvColumn<T>[]).map(child =>
        normalizeColumn(child),
      ) as ProcessedColumn[]
    }

    return normalized
  }

  /** IDs 基于路径，与 virtual renderer 共享确保跨渲染器一致性（Path-based IDs shared with virtual renderer for cross-renderer consistency） */
  function assignInternalIds(cols: ProcessedColumn[]): ProcessedColumn[] {
    return ensureColumnIds(cols)
  }

  function collectUserState(): Map<string, ColumnUserState> {
    const map = new Map<string, ColumnUserState>()
    /**
     * <zh/> `order` 记录**遍历序号**而非各层级内的 index：traverseColumnTree 为 DFS，
     * <zh/> 顶层列与其分组子列共享同一单调序列，故同一张 map 既能稳定重排顶层，
     * <zh/> 也能被 stableReorderByKey 递归复用于分组子列。
     * <en/> `order` records the **traversal sequence**, not a per-level index: traverseColumnTree
     * <en/> is DFS, so top-level columns and their group children share one monotonic sequence —
     * <en/> the same map reorders the top level and is reused recursively for group children.
     */
    let sequence = 0
    traverseColumnTree(localColumns.value, (col) => {
      const key = getColumnKey(col)
      map.set(key, {
        order: sequence++,
        hidden: col.lockVisible ? undefined : col.hidden,
        fixed: col.lockPosition ? undefined : col.fixed,
        width: col.lockResize ? undefined : col.width,
      })
    })
    return map
  }

  function mergeColumnWithUserState(
    col: AdvColumn<T>,
    userState: Map<string, ColumnUserState>,
  ): ProcessedColumn {
    const key = getColumnKey(col)
    const normalized = normalizeColumn(col)
    const saved = userState.get(key)

    if (saved) {
      /** pinFixed 优先于用户状态（normalizeColumn 已将 pinFixed 映射为 fixed） */
      if (!normalized.pinFixed) {
        // <zh/> undefined 表示无用户态（lock 门控已置 undefined），禁止清空既有 fixed
        // <en/> undefined means no user state — never clear the existing fixed value
        normalized.fixed = saved.fixed ?? normalized.fixed
      }
      normalized.hidden = saved.hidden ?? normalized.hidden
      // <zh/> 仅接受有限正数宽度：0/NaN/负数透传会复活死列（normalizeColumn 已钳制，此处同样守卫）
      // <en/> Accept only finite positive widths so persisted NaN/0 cannot revive dead columns
      if (saved.width != null && typeof saved.width === 'number' && Number.isFinite(saved.width) && saved.width > 0) {
        normalized.width = saved.width
      }
    }

    if (isGroupColumn(normalized) && normalized.children) {
      normalized.children = (normalized.children as AdvColumn<T>[]).map(child =>
        mergeColumnWithUserState(child, userState),
      ) as ProcessedColumn[]
    }

    return normalized
  }

  /**
   * Set columns directly (from internal operations like column-setting reorder/hide).
   * Keeps originColumns in sync so subsequent external prop updates merge correctly.
   * Explicitly emits update — this is a UI-initiated change the parent needs to know about.
   * Note: pristine snapshot is intentionally NOT updated here — panel operations must not
   * shadow the external baseline, otherwise resetColumns becomes a no-op.
   * 直接设置列（来自列设置的重排/隐藏等内部操作）。
   * 同步更新 originColumns，确保后续外部 prop 更新能正确合并。
   * 显式 emit 更新 —— UI 发起的变更，父组件需要感知。
   * 注意：此处刻意不同步 pristine 快照——面板操作不得覆盖外部基线，否则 resetColumns 失效。
   */
  function setColumns(cols: ProcessedColumn[]) {
    if (!cols || cols.length === 0) {
      localColumns.value = []
      originColumns.value = []
      originColumnsFormatMap.value = {}
      lastInternalEmitSignature = ''
      emitUpdate(localColumns.value)
      return
    }
    localColumns.value = cols
    saveOriginColumns()
    lastInternalEmitSignature = buildColumnStateSignature(cols)
    emitUpdate(cols)
  }

  /**
   * <zh/> 触发 localColumns 重渲染。
   * <zh/> localColumns 是 shallowRef，调用方直接修改列对象的属性（如 width/hidden/fixed）
   * <zh/> 不会触发响应式；此函数通过重赋值触发一次渲染，但不修改 originColumns 也不 emit。
   * <en/> Trigger a localColumns re-render.
   * <en/> localColumns is a shallowRef, so mutating column properties (e.g. width/hidden/fixed)
   * <en/> directly does not trigger reactivity; this reassign fires one re-render without
   * <en/> syncing originColumns or emitting updates.
   */
  function touchColumns(): void {
    localColumns.value = [...localColumns.value]
  }

  /**
   * <zh/> 判断外部列配置是否**重新排列了已有列**——比较"外部新配置 ∩ 上一份外部基线
   * <zh/> （`pristineColumns`）"这批共有列的相对顺序：相对顺序未变，说明外部只是增删列 /
   * <zh/> 改属性，并未主动重排；出现逆序则视为外部显式重排。
   *
   * <en/> Whether the incoming external column config **reordered existing columns** — compares the
   * <en/> relative order of keys shared by the incoming config and the previous external baseline
   * <en/> (`pristineColumns`): an unchanged relative order means the external side only added/
   * <en/> removed/edited columns rather than deliberately reordering them; any inversion is treated
   * <en/> as an explicit external reorder.
   *
   * @param next - <zh/> 外部传入的新列配置 | <en/> incoming external column config
   * @returns <zh/> 是否检测到外部显式重排 | <en/> whether an explicit external reorder was detected
   */
  function hasExternalReorder(next: ProcessedColumn[]): boolean {
    const baseline = pristineColumns.value
    if (baseline.length === 0)
      return false
    // <zh/> DFS 展平后比较——组内子列重排同样视为外部显式重排，仅比较顶层会静默吞掉服务端组内重排
    // <en/> Compare DFS-flattened key sequences — in-group child reorders count as explicit external reorders; top-level-only comparison silently swallows server-driven in-group reorders
    const baselineKeys: string[] = []
    traverseColumnTree(baseline, (col) => {
      baselineKeys.push(getColumnKey(col))
    })
    const baselineIndex = new Map<string, number>()
    baselineKeys.forEach((key, i) => baselineIndex.set(key, i))
    const nextKeys: string[] = []
    traverseColumnTree(next, (col) => {
      nextKeys.push(getColumnKey(col))
    })
    let lastSeen = -1
    for (const key of nextKeys) {
      const index = baselineIndex.get(key)
      if (index === undefined)
        continue
      if (index < lastSeen)
        return true
      lastSeen = index
    }
    return false
  }

  function mergeColumns(cols: ProcessedColumn[]) {
    if (!cols || cols.length === 0) {
      localColumns.value = []
      originColumns.value = []
      originColumnsFormatMap.value = {}
      lastInternalEmitSignature = ''
      return
    }

    const userState = collectUserState()
    const externalReordered = hasExternalReorder(cols)

    const merged = assignInternalIds(
      cols.map(col => mergeColumnWithUserState(col, userState)),
    )

    /**
     * <zh/> 保留用户列顺序：用户拖拽调整的顺序不会被任何一次外部 `:columns`
     * <zh/> 更新静默覆盖。此处按用户在 `collectUserState` 中记录的 `order` 做稳定归并——
     * <zh/> 外部仅增删列 / 改属性时保留用户顺序，新增列经插值回到其配置位置。
     * <zh/> 外部**显式重排**时以外部顺序为准，避免破坏"服务端驱动列顺序"的场景。
     * <zh/> 用户从未拖拽过时，用户顺序即外部顺序，该步骤退化为恒等变换。
     *
     * <en/> Preserve the user's column order: a drag-reordered layout must not be silently
     * <en/> overwritten by an external `:columns` update. The merged result is stable-merged by
     * <en/> the `order` recorded in `collectUserState` — the user's order survives external
     * <en/> add/remove/property-only updates, while new columns interpolate back to their configured
     * <en/> position. When the external side **explicitly reorders**, the external order wins so
     * <en/> server-driven ordering keeps working. If the user never dragged, the user order equals
     * <en/> the external order and this step is an identity transform.
     */
    const userOrderIndex = new Map<string, number>()
    for (const [key, state] of userState) {
      if (state.order !== undefined)
        userOrderIndex.set(key, state.order)
    }
    localColumns.value = externalReordered
      ? merged
      : stableReorderByKey(merged, userOrderIndex)

    saveOriginColumns()

    /**
     * <zh/> 受控回显检测：内部 setColumns 发出 → 父组件原样回写为 prop 时，
     * <zh/> 通过内容签名比较识别回显（而非引用比较），跳过 pristine 更新，避免面板改动污染外部基线。
     * <zh/> 之前用引用比较，但 normalizeColumn 无条件 map 克隆使引用永不等 → 回显检测失效。
     * <en/> Controlled-echo detection: when the parent writes back exactly what internal
     * <en/> setColumns emitted, detect via content signature comparison (not reference comparison),
     * <en/> skip pristine update so panel changes never shadow the baseline.
     * <en/> Previously used reference comparison, but normalizeColumn's unconditional map cloning
     * <en/> made references never equal → echo detection always failed.
     */
    const incomingSignature = buildColumnStateSignature(cols)
    if (incomingSignature !== lastInternalEmitSignature) {
      savePristineColumns(cols)
    }
    lastInternalEmitSignature = ''
  }

  watch(rawColumns, (cols, oldCols) => {
    if (cols && cols.length > 0) {
      const isUpdate = oldCols && oldCols.length > 0 && originColumns.value.length > 0

      if (isUpdate) {
        mergeColumns(cols)
      }
      else {
        /**
         * First data after empty initial state (e.g., columns loaded async).
         *  Timing dependency: rawColumns may be empty during setup if options.columns
         *  is a getter that returns data after the setup phase (e.g., async-loaded columns).
         *  This branch handles that case by saving originColumns when data first arrives.
         * 空初始状态后的首次数据加载。
         *  时序依赖：若 options.columns 是 getter 且在 setup 阶段后才返回数据（如异步加载列），
         *  rawColumns 初始为空，setup 阶段的 saveOriginColumns 不会执行。
         *  此分支在数据首次到达时保存 originColumns，确保后续 mergeColumns 正确工作。
         */
        localColumns.value = cols
        saveOriginColumns()
        savePristineColumns(cols)
        lastInternalEmitSignature = ''
      }
    }
    else {
      localColumns.value = []
      originColumns.value = []
      originColumnsFormatMap.value = {}
      pristineColumns.value = []
      pristineColumnsFormatMap.value = {}
    }
  })

  return {
    localColumns,
    hasColumns,
    resetColumns,
    setColumns,
    touchColumns,
    originColumns,
    originColumnsFormatMap,
  }
}
