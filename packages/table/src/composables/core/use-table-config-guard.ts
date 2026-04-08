/**
 * @file use-table-config-guard.ts
 * @description
 * <zh/> 表格配置校验域（抽离）——原 `use-adv-table.ts` 内联的 `validateTableConfig`，
 * <zh/> 纯搬移零行为变更。主编排器仅负责装配顺序，口径收敛于此。
 * <en/> Table config-guard domain (extraction) — `validateTableConfig` moved verbatim from
 * <en/> `use-adv-table.ts`, zero behavior change. The main orchestrator owns assembly order only.
 */
import type { Slots } from 'vue'
import type { TableError, TableErrorCode } from '../../types/error'
import type { AdvTableProps } from '../../types/table-props'
import type { UseAdvTableCoreReturn } from './use-adv-table-core'
import type { UseAdvTableDataColumnsReturn } from './use-adv-table-data-columns'
import { LARGE_DATASET_THRESHOLD } from '../../constants'
import { devWarn } from '../../utils/dev-warn'

/**
 * <zh/> 配置校验上下文——显式窄接口：仅传入校验所需的域切片，不透传上游返回对象整体。
 * <en/> Config-guard context — explicit narrow interface: only the domain slices validation needs.
 */
export interface ValidateTableConfigCtx<T = any> {
  props: AdvTableProps<T>
  core: UseAdvTableCoreReturn<T>
  dataColumns: UseAdvTableDataColumnsReturn<T>
  slots: Slots
  fired: Set<string>
  hasUpdateDataListener: () => boolean
  hasUpdateColumnsListener: () => boolean
}

//  配置校验 | Config validation

/**
 * <zh/> 配置校验——由响应式 watch 驱动（含 immediate），覆盖运行时动态变化。
 * <zh/> 内置去重：同一错误码持续触发时仅告警一次，解除后再次触发会重新告警。
 * <en/> Config validation — driven by a reactive watch (with immediate), covering runtime changes.
 * <en/> Built-in dedup: a given code warns once while continuously triggered, and re-warns after release.
 */
export function validateTableConfig<T>(ctx: ValidateTableConfigCtx<T>): void {
  const { props, core, dataColumns, slots, fired, hasUpdateDataListener, hasUpdateColumnsListener } = ctx
  const DATA_SOURCE_CODE = 'TABLE_CONFIG_DATA_AND_SOURCE_CONFLICT'
  const UNCONTROLLED_EDIT_CODE = 'TABLE_UNCONTROLLED_EDIT_SHADOW'
  const UNCONTROLLED_COLUMNS_CODE = 'TABLE_UNCONTROLLED_COLUMNS_SHADOW'
  const LARGE_DATASET_CODE = 'TABLE_PERF_LARGE_DATASET_NO_VIRTUAL'
  const VIRTUAL_SLOT_CODE = 'TABLE_VIRTUAL_SLOT_IGNORED'
  const SPAN_DYNAMIC_HEIGHT_CODE = 'TABLE_SPAN_DYNAMIC_HEIGHT_UNSUPPORTED'
  const VIRTUAL_HIERARCHY_ROW_KEY_CODE = 'TABLE_VIRTUAL_HIERARCHY_ROW_KEY_MISSING'
  /**
   * <zh/> 树+分组互斥生产可见码——双开即显式 opt-in（同 SHADOW 先例的门控思想），运行时忽略分组故必须可观测。
   * <en/> tree+grouping production code — dual-enable is explicit opt-in (same gating idea as SHADOW); grouping is ignored at runtime so it must be observable.
   */
  const CONFIG_CONFLICT_CODE = 'TABLE_CONFIG_CONFLICT'
  /**
   * <zh/> 命名空间失配生产可见码——显式 `uiConfig.namespace` 与 EP ConfigProvider 命名空间
   * <zh/> 同时存在且不一致时，DOM 查询按前者构造、EP 实际渲染按后者，全链路查询静默失配。
   * <zh/> 仅显式冲突才上报：未配置 uiConfig.namespace 时自动跟随 EP，无第二真相源。
   * <en/> Namespace-mismatch production code — when an explicit `uiConfig.namespace` disagrees with
   * <en/> the EP ConfigProvider namespace, DOM queries are built from the former while EP renders with
   * <en/> the latter, so the whole lookup chain silently misses. Reported only on explicit conflict:
   * <en/> without uiConfig.namespace the table follows EP automatically (single source of truth).
   */
  const NAMESPACE_MISMATCH_CODE = 'TABLE_NAMESPACE_MISMATCH'
  /**
   * <zh/> 下列三条为 **dev-only** 键：单模式专属 prop 在另一模式下静默失效，属可诊断性缺口而非
   * <zh/> 运行错误，故意不新增结构化错误码（新码会在生产期为既有可运行配置派发事件＝对外行为变更）。
   * <en/> The three keys below are **dev-only**: a single-mode prop silently doing nothing in the other mode
   * <en/> is a diagnosability gap rather than a runtime error, so no structured code is added on purpose
   * <en/> (a new code would dispatch events in production for configurations that work today).
   */
  const SIZE_PROP_VIRTUAL_IGNORED_KEY = 'DEV_SIZE_PROP_VIRTUAL_IGNORED'
  const TABLE_LAYOUT_VIRTUAL_IGNORED_KEY = 'DEV_TABLE_LAYOUT_VIRTUAL_IGNORED'
  const ESTIMATED_ROW_HEIGHT_DEFAULT_IGNORED_KEY = 'DEV_ESTIMATED_ROW_HEIGHT_DEFAULT_IGNORED'
  const MULTI_SELECT_ROW_KEY_MISSING_KEY = 'DEV_MULTI_SELECT_ROW_KEY_MISSING'
  /**
   * <zh/> `manual` + `request.source` 非官方组合提示——两者可并存（双路由回写），但 manual 下 source 的自动请求被旁路、
   * <zh/> 易误以为"配了 source 就会自动取数"。dev-only 提示，不阻断运行。
   * <en/> `manual` + `request.source` is not the recommended combo — both can coexist (dual write-back route),
   * <en/> but auto-fetch is bypassed in manual mode. Dev-only hint, never blocks.
   */
  const MANUAL_SOURCE_WARN_KEY = 'DEV_MANUAL_SOURCE_CONFLICT'
  /**
   * <zh/> 下列三条为 dev-only 可诊断性提示（与上方三单模式 prop 同理）：
   * <zh/> infiniteScroll 在 default 模式静默空转、client+source 双处理、edit+远程 refetch 覆盖，
   * <zh/> 均属"配置生效但语义与直觉不符"，故意不新增结构化错误码（生产行为零变更）。
   * <en/> The three keys below are dev-only diagnosability hints (same rationale as the three
   * <en/> single-mode props above): no new structured codes, zero production behavior change.
   */
  const INFINITE_SCROLL_DEFAULT_IGNORED_KEY = 'DEV_INFINITE_SCROLL_DEFAULT_IGNORED'
  const CLIENT_SOURCE_WARN_KEY = 'DEV_CLIENT_SOURCE_CONFLICT'
  const EDIT_REMOTE_REFETCH_RISK_KEY = 'DEV_EDIT_REMOTE_REFETCH_RISK'

  /**
   * <zh/> 冲突预检的「一次性上报」——条件成立时按 code 去重上报，条件不再成立时清除去重标记
   * <zh/> （使同一冲突在修复后重新出现时仍能再次上报）。六处预检共用此语义，取代逐字重复的控制流。
   * <en/> "Report once" for config pre-checks — while the condition holds report by code at most once;
   * <en/> once it no longer holds, drop the dedupe mark (so a conflict that is fixed and then
   * <en/> reintroduced reports again). All six pre-checks share these semantics, replacing verbatim
   * <en/> duplicated control flow.
   *
   * @param condition - <zh/> 冲突是否成立（按真值判定，保留各预检原有的真值/非空语义） | <en/> whether the conflict holds (truthiness-evaluated, preserving each pre-check's original truthy/non-null semantics)
   * @param code - <zh/> 结构化错误码 | <en/> structured error code
   * @param cause - <zh/> 附带上下文（可选，缺省时与逐一传码的调用形态完全一致） | <en/> optional attached context (absent = exactly the code-only call shape)
   */
  function reportOnce(condition: unknown, code: TableErrorCode, cause?: TableError['cause']): void {
    if (!condition) {
      fired.delete(code)
      return
    }
    if (fired.has(code))
      return
    fired.add(code)
    if (cause)
      core.handleError(code, { cause })
    else
      core.handleError(code)
  }

  /**
   * <zh/> dev 一次性告警——与 reportOnce 同语义（条件解除后清除去重标记），但走 devWarn、
   * <zh/> 不派发结构化错误事件；用于"该配置在当前模式下不生效"这类可诊断性提示。
   * <en/> Dev-only once warning — same semantics as reportOnce (dedupe mark dropped once the condition no
   * <en/> longer holds) but emitted via devWarn without dispatching a structured error event; used for
   * <en/> diagnosability hints such as "this config has no effect in the current mode".
   */
  function warnOnceDev(condition: unknown, key: string, message: string): void {
    if (!condition) {
      fired.delete(key)
      return
    }
    if (fired.has(key))
      return
    fired.add(key)
    devWarn(message)
  }

  // <zh/> 空数组不告警：[] 为真值但无数据源语义（常见初始态 data=[] + 异步 source），仅非空数组 + source 并存才冲突。
  // <en/> An empty array never warns: [] is truthy but carries no data-source semantics (the common
  // <en/> initial data=[] + async source); only a non-empty array coexisting with a source conflicts.
  reportOnce(props.data != null && (Array.isArray(props.data) ? props.data.length > 0 : true) && props.request?.source, DATA_SOURCE_CODE)

  // <zh/> 树+分组同开生产可见（双开即 opt-in，运行时忽略分组）——与管线内 devWarn 同源，此处进 error 事件流
  // <en/> tree+grouping production-visible (dual-enable is opt-in, grouping ignored at runtime)
  reportOnce(
    props.treeConfig != null && props.rowGroupConfig != null,
    CONFIG_CONFLICT_CODE,
    { treeConfig: !!props.treeConfig, rowGroupConfig: !!props.rowGroupConfig },
  )

  // <zh/> 命名空间失配：显式 uiConfig.namespace 与 EP ConfigProvider 命名空间打架即上报；
  // <zh/> 未显式配置时自动跟随 EP（core.namespace 已回退），不构成失配。
  // <en/> Namespace mismatch: report when an explicit uiConfig.namespace fights the EP ConfigProvider
  // <en/> namespace; without an explicit value the table follows EP (core.namespace already falls back).
  reportOnce(
    props.uiConfig?.namespace != null
    && core.epNamespace.value != null
    && props.uiConfig.namespace !== core.epNamespace.value,
    NAMESPACE_MISMATCH_CODE,
    { uiConfigNamespace: props.uiConfig?.namespace, epNamespace: core.epNamespace.value },
  )

  /**
   * <zh/> 非受控 data × 编辑写回：单向 `:data`＋`editConfig` 时，编辑写回只进内部模型
   * <zh/> （`models.data`），父组件数据源不会被同步，父组件随后推送 `:data` 会静默覆盖这次编辑。
   * <zh/> 注意 `defineModel` 内部以同步 watch 跟随 prop，故父级推送的新数组**不会**被 `??` 永久遮蔽
   * <zh/> （实测：prop 变更后内部模型即同步回父级值）；真正的风险是「编辑结果对父级不可见且会被覆盖」。
   * <zh/> `v-model:data`（或监听 `update:data`，defineModel 写即 emit）不受影响；远程模式走
   * <zh/> `setResponseData`，同样不受影响——三者任一成立即不告警。
   * <en/> Uncontrolled data × edit write-back: with one-way `:data` + `editConfig`, an edit write-back
   * <en/> only fills the internal model (`models.data`); the parent's data source is not synced, and a
   * <en/> later parent `:data` push silently overwrites that edit.
   * <en/> Note that `defineModel` follows the prop through an internal sync watcher, so a parent push is
   * <en/> NOT permanently shadowed by `??` (measured: the internal model re-syncs once the prop changes).
   * <en/> The real hazard is "the edit is invisible to the parent and gets overwritten".
   * <en/> `v-model:data` (or an `update:data` listener — defineModel writes emit it) and remote
   * <en/> mode (via `setResponseData`) are unaffected — any of the three silences the warning.
   */
  reportOnce(
    !dataColumns.hasSource.value
    && props.data != null
    && props.editConfig != null
    && !hasUpdateDataListener(),
    UNCONTROLLED_EDIT_CODE,
  )

  /**
   * <zh/> 非受控 columns × 列交互写回：单向 `:columns`＋列拖拽/列设置时，交互写回只进内部模型，
   * <zh/> 父组件随后推送 `:columns` 会静默覆盖。data 版的仿写（`TABLE_UNCONTROLLED_EDIT_SHADOW`），
   * <zh/> `v-model:columns`（或监听 `update:columns`）不受影响。
   * <zh/> 门控说明：`columns` 缺省 `[]` 使 `!= null` 恒真，且合并后 `toolbar.columnSetting`
   * <zh/> 缺省即 `true`，二者都不能直接做门控——仅显式 opt-in 才告警（拖拽任一级别、
   * <zh/> `props.toolbar.columnSetting === true` 显式开启，或**列设置侧面板显式开启**）。
   * <zh/>
   * <zh/> 列设置侧面板一项是补齐的盲区：该面板由 `columnConfig.sidePanel` 独立控制（见
   * <zh/> `use-side-panel-orchestrator` 的 `isColumnSidePanelEnabled`），**与 `toolbar.columnSetting`
   * <zh/> 无关**，且面板的 `@update:headers` 会整组写回列。此前门控只看前两者，于是
   * <zh/> 「单向 :columns + columnConfig.sidePanel: true」这条真实可触发的覆盖路径完全不告警。
   * <zh/> `<en/> Uncontrolled columns × interaction write-back: same lineage as the data version;
   * <zh/> warns only on explicit opt-in (drag at either level, explicit `props.toolbar.columnSetting`,
   * <zh/> or the **column side panel explicitly enabled**).
   * <zh/>
   * <zh/> The side panel closes a real blind spot: it is controlled independently by
   * <zh/> `columnConfig.sidePanel` (see `isColumnSidePanelEnabled` in use-side-panel-orchestrator),
   * <zh/> **unrelated to `toolbar.columnSetting`**, and its `@update:headers` writes the whole column
   * <zh/> set back. The previous gate only looked at the first two, so the genuinely reachable
   * <zh/> "one-way :columns + columnConfig.sidePanel: true" overwrite path never warned.
   */
  reportOnce(
    props.columns != null
    && (
      core.mergedColumnConfig.value.columnDraggable === true
      || dataColumns.effectiveColumns.value.some(c => (c as { columnDraggable?: boolean }).columnDraggable === true)
      || props.toolbar?.columnSetting === true
      || core.mergedColumnConfig.value.sidePanel === true
    )
    && !hasUpdateColumnsListener(),
    UNCONTROLLED_COLUMNS_CODE,
  )

  // <zh/> 大数据量 + composed 域：default 全量渲染万级行会卡顿，提示切 virtual 或服务端分页
  // <en/> Large dataset with composed domain: default renders all rows and stalls; suggest virtual or server paging
  const caps = core.rendererAdapter.caps.value
  reportOnce(
    dataColumns.tableData.value.length > LARGE_DATASET_THRESHOLD && caps.rowIndexDomain === 'composed',
    LARGE_DATASET_CODE,
    { rows: dataColumns.tableData.value.length },
  )

  reportOnce(!caps.declarativeColumns && slots.default, VIRTUAL_SLOT_CODE)

  /**
   * <zh/> virtual 模式「合并单元格 × 动态行高」——视觉不受支持的生产可观测告警。
   * <zh/> EP 动态网格（DynamicSizeGrid）会裁切 rowspan 扩展的 origin 格，且跨度高度按
   * <zh/> `rowspan × rowHeight` 估算，在实测行高下失真（错位/覆盖）。显式设置
   * <zh/> `estimatedRowHeight` 即确定进入动态网格；append 插槽 / 实际展开详情行触发的
   * <zh/> 隐式动态路径同样进入动态网格（渲染器按 rowHeight 回退），此处一并纳入生产可观测。
   * <en/> Virtual-mode "cell span × dynamic row height" — production-observable warning for an
   * <en/> unsupported visual combination. EP's dynamic grid (DynamicSizeGrid) clips rowspan-extended
   * <en/> origin cells, and span heights estimated as `rowspan × rowHeight` are wrong under measured
   * <en/> heights (misalignment/overlap). Both the explicit path (`estimatedRowHeight`) and the
   * <en/> implicit path (append slot / actually expanded detail rows) enter the dynamic grid.
   */
  {
    const hasAppendSlot = slots.append != null
    let hasExpandedDetail = false
    try {
      hasExpandedDetail = (dataColumns.rowExpandApi?.expandedRowKeys?.value?.size ?? 0) > 0
    }
    catch {
      hasExpandedDetail = false
    }
    const explicitDynamic = (props as { estimatedRowHeight?: number }).estimatedRowHeight != null
    const implicitDynamic = hasAppendSlot || hasExpandedDetail
    reportOnce(
      !caps.spanWithDynamicHeight && dataColumns.spanEnabled.value && (explicitDynamic || implicitDynamic),
      SPAN_DYNAMIC_HEIGHT_CODE,
      {
        estimatedRowHeight: (props as { estimatedRowHeight?: number }).estimatedRowHeight,
        hasAppendSlot,
        hasExpandedDetail,
        implicitDynamic,
      },
    )
  }

  /**
   * <zh/> virtual 模式「树形/行展开 × 缺显式 rowKey」——缺省时 rowKeyFn 回退到对象身份自动 key
   * <zh/> （WeakMap + 行内 AUTO_KEY_NAME 二级缓存）：行对象被刷新/深拷贝替换后展开状态与父子
   * <zh/> 关系丢失，冻结行对象上 ElTableV2 读不到 AUTO_KEY_NAME 时树形渲染错乱，故 dev 期指出。
   * <en/> Virtual-mode "tree/row-expand × missing explicit rowKey" — without it the rowKeyFn falls
   * <en/> back to object-identity auto keys (WeakMap + in-row AUTO_KEY_NAME secondary cache): expanded
   * <en/> state and parent-child relations are lost once row objects are replaced by refresh/deep-copy,
   * <en/> and ElTableV2 cannot read AUTO_KEY_NAME on frozen rows — flagged here in dev.
   */
  const hierarchyEnabled = props.treeConfig != null || props.rowExpandConfig?.enabled === true
  reportOnce(
    caps.rowIndexDomain === 'unpinned' && hierarchyEnabled && props.rowConfig?.rowKey == null,
    VIRTUAL_HIERARCHY_ROW_KEY_CODE,
  )

  // <zh/> 单模式专属 prop 在另一模式下静默失效——补 dev 提示，消除"配了没效果"的排查成本
  // <en/> Single-mode props silently doing nothing in the other mode — dev hints to remove that triage cost
  warnOnceDev(
    caps.rowIndexDomain === 'unpinned' && props.size != null,
    SIZE_PROP_VIRTUAL_IGNORED_KEY,
    '[AdvTable] `size` only applies to the default renderer (ElTable) and is ignored in mode="virtual". '
    + 'Tune virtual-mode density via uiConfig.sizeConfig (rowHeight / headerCellHeight) instead.',
  )
  warnOnceDev(
    caps.rowIndexDomain === 'unpinned' && props.tableLayout != null,
    TABLE_LAYOUT_VIRTUAL_IGNORED_KEY,
    '[AdvTable] `tableLayout` only applies to the default renderer (ElTable) and is ignored in mode="virtual". '
    + 'Virtual mode always lays out columns by explicit widths.',
  )
  warnOnceDev(
    caps.rowIndexDomain === 'composed' && props.estimatedRowHeight != null,
    ESTIMATED_ROW_HEIGHT_DEFAULT_IGNORED_KEY,
    '[AdvTable] `estimatedRowHeight` only applies to mode="virtual" and is ignored by the default renderer.',
  )

  /**
   * <zh/> 多选 × 缺显式 rowKey——选中集合以**行键**为标识：rowKey 缺省时回退到对象身份自动键，
   * <zh/> 数据刷新/深拷贝替换行对象后 `selectedRowKeys` 不再匹配，跨页保持与受控回显静默失效
   * <zh/> （用户看到"选中丢了"但无任何提示）。
   *
   * <zh/> 与上方树形/展开检查的区别：那条以行索引域为条件（unpinned 域的冻结行读不到
   * <zh/> 自动键，属虚拟模式特有）；而选中失效**与渲染模式无关**，default 模式同样受影响，故需单独判定。
   * <zh/> 判定用**显式** `rowSelection === 'multiple'`：库内默认值为 'multiple'，若按"生效值"判断
   * <zh/> 会对所有未配置多选的表格告警，噪声过大。
   *
   * <zh/> 采用 dev-only 提示而非新增结构化错误码：新错误码会在生产期为既有可运行配置派发事件，
   * <zh/> 属对外可见的行为变更，需产品决策；此处以零生产影响的方式先补齐可诊断性。
   *
   * <en/> Multi-select × missing explicit rowKey — the selection set is keyed by the **row key**; without
   * <en/> one it falls back to object-identity auto keys, so once rows are replaced by a refresh/deep copy
   * <en/> `selectedRowKeys` no longer matches and cross-page persistence / controlled echo silently fail
   * <en/> (the user sees selection "lost" with no hint at all).
   *
   * <en/> Difference from the tree/expand check above: that one is gated on the row-index domain
   * <en/> (unpinned-domain frozen rows cannot read the auto key — a virtual-specific issue), whereas
   * <en/> selection loss is **mode-independent** and affects default mode too, hence a separate check.
   * <en/> It matches on an **explicit** `rowSelection === 'multiple'`: the internal default is 'multiple',
   * <en/> so testing the effective value would warn on every table that never configured multi-select.
   *
   * <en/> A dev-only notice is used instead of a new structured error code: a new code would dispatch
   * <en/> events in production for configurations that work today — an externally visible behavior change
   * <en/> requiring a product decision; this closes the diagnosability gap at zero production impact.
   */
  warnOnceDev(
    props.rowConfig?.rowSelection === 'multiple' && props.rowConfig.rowKey == null,
    MULTI_SELECT_ROW_KEY_MISSING_KEY,
    'Multi-select without an explicit `rowConfig.rowKey` — the selection set is keyed by row identity, '
    + 'so it cannot survive a data refresh or deep copy and controlled `selectedRowKeys` echo will not match. '
    + 'Please provide `rowConfig.rowKey`.',
  )
  warnOnceDev(
    core.isManual.value && dataColumns.hasSource.value,
    MANUAL_SOURCE_WARN_KEY,
    '[AdvTable] `pagination.mode="manual"` with `request.source` — manual mode only notifies via the `request` event '
    + 'and never auto-fetches from source; parent must write back via `setResponseData(data, requestId)` or `v-model:data`. '
    + 'If auto-fetch is wanted, drop manual mode. | '
    + '`pagination.mode="manual"` 与 `request.source` 同配——manual 只派发 `request` 事件通知父取数，不会自动拉取 source，'
    + '须由父经 `setResponseData(data, requestId)` 或 `v-model:data` 回写。如需自动取数请去掉 manual 模式。',
  )

  /**
   * <zh/> 树形 × 服务端分页：管线按“取数→展平→分页”顺序执行，远程分页下上游仅有当页数据，
   * <zh/> 展平后父子分属不同页且 total 口径错位。生产可见（数据错乱用户直接可见），故进 error 事件流。
   * <zh/> 客户端分页（mode:'client'）与关闭分页（enabled:false）均为全量数据，不受影响。
   * <en/> Tree × server-side pagination: the pipeline fetches, then flattens, then paginates; with remote
   * <en/> paging the upstream only holds the current page, so flattening splits parents from children and
   * <en/> the total caliber mismatches. Production-visible (users directly see broken data), hence an error event.
   * <en/> Client paging (mode:'client') and disabled paging (enabled:false) hold full data and are unaffected.
   */
  reportOnce(
    props.treeConfig != null
    && dataColumns.hasSource.value
    && (props.pagination?.enabled ?? true)
    && props.pagination?.mode !== 'client'
    && !core.isManual.value,
    'TABLE_TREE_REMOTE_PAGINATION_UNSUPPORTED',
    { treeConfig: !!props.treeConfig, paginationMode: props.pagination?.mode ?? 'page' },
  )

  // <zh/> infiniteScroll 仅 virtual 渲染器产生 endReached，default 下开关静默空转——补 dev 提示
  // <en/> infiniteScroll only takes effect in virtual mode (the sole endReached emitter); silent no-op in default
  warnOnceDev(
    caps.rowIndexDomain === 'composed' && props.pagination?.infiniteScroll === true,
    INFINITE_SCROLL_DEFAULT_IGNORED_KEY,
    '[AdvTable] `pagination.infiniteScroll` only applies to mode="virtual" (the sole endReached emitter) '
    + 'and is a silent no-op in mode="default". Default mode keeps using the footer button / `loadMore`.',
  )
  // <zh/> client + source：本地分页/排序/筛选与远程重取双处理——dev 提示二选一
  // <en/> client + source: local paging/sort/filter double-processes with remote refetch — dev hint to pick one
  warnOnceDev(
    props.pagination?.mode === 'client' && dataColumns.hasSource.value,
    CLIENT_SOURCE_WARN_KEY,
    '[AdvTable] `pagination.mode="client"` with `request.source` — local sort/filter paginates full data while '
    + 'the remote-refetch watcher also refetches on sort/filter change (double processing). Pick one: drop '
    + '`source` for pure client-side data, or use standard `page` mode for server-side paging.',
  )
  /**
   * <zh/> edit + 远程：排序/筛选变化经 300ms 防抖 refetch，回包整替 data，会覆盖未提交的编辑。
   * <zh/> 当前为 dev 提示（行为零变更）；提交前请先 saveCells/discard，远程场景建议拦截 refetch 或走手动分页。
   * <en/> edit + remote: sort/filter changes refetch (300ms debounce) and the response replaces data wholesale,
   * <en/> dropping uncommitted edits. Dev hint only; saveCells/discard before remote ops.
   */
  warnOnceDev(
    props.editConfig != null && dataColumns.hasSource.value,
    EDIT_REMOTE_REFETCH_RISK_KEY,
    '[AdvTable] `editConfig` with `request.source` — sort/filter changes trigger a debounced remote refetch whose '
    + 'response replaces `data` wholesale, discarding uncommitted edits. Call saveCells()/discard before sorting, '
    + 'filtering, or paging in remote scenarios.',
  )
  /**
   * <zh/> 列筛选有值 + 服务端 + autoParams 关闭 + 非 manual——本地管线只过滤当前页，
   * <zh/> 服务端收不到筛选参数（buildRequestParams 原样返回），全量筛选静默变页内筛选。
   * <zh/> 生产可见（用户误以为全量筛选，实为当页），故进 error 事件流（warn 级，可观测但不阻断）；
   * <zh/> manual 下宿主经 `request` 事件自行处理，不告警；条件解除（清空筛选/开启 autoParams）后去重标记清除。
   * <en/> active column filter + server source + autoParams off + non-manual — the local pipeline
   * <en/> filters only the current page while the server never receives the filter params, silently
   * <en/> degrading full-dataset filtering to page-local. Production-visible (users mistake it for
   * <en/> full-dataset filtering), hence an error event (warn level: observable, non-blocking).
   * <en/> Manual mode is excluded (the host handles filtering via the `request` event); the dedupe mark
   * <en/> clears once the condition releases.
   */
  reportOnce(
    dataColumns.hasSource.value
    && !core.isManual.value
    && !props.request?.autoParams
    && dataColumns.hasActiveFilter.value === true,
    'TABLE_SERVER_LOCAL_FILTER_PAGE_ONLY',
    { hasSource: true, autoParams: !!props.request?.autoParams },
  )
}
