/**
 * <zh/> 演示本地 fixtures——原 TableDemo 壳的本地声明（汇总演示态 + 各 section 家族的数据/处理器）。
 * <zh/> COMPLEXITY-PLAN 1b：与 useTableDemoState 一起经 demo-context 单点下发（键集合不变，sections 零改动）。
 * <zh/> 按家族分片（summary / teleport / scrollSync / surface / …）为后续收尾项；本文件先以原分组注释保形迁移。
 * <en/> Demo-local fixtures — the shell's former local declarations (summary-demo state + per-section-family data/handlers).
 * <en/> COMPLEXITY-PLAN 1b: provided together with useTableDemoState via demo-context (key set unchanged, sections untouched).
 * <en/> Splitting per family (summary / teleport / scrollSync / surface / …) is follow-up; this file migrates verbatim with original group comments.
 */
import { computed, KeepAlive, ref } from 'vue'
import { createTeleportHoverColumns, filterSortColumns, rowGroupColumns } from './columns'
import { genData } from './demo-data'
import { surfaceApiLog } from './surface-state'
import { useTableDemoState } from './use-table-demo-state'

export function useDemoLocal() {
  const { pageData60, teleportHoverZIndex } = useTableDemoState()

  // <zh/> 本地状态 <en/> Local state

  // <zh/> 合计行演示状态（对齐 AG Grid aggregation-total-rows） <en/> Summary-row demo state (aligned with AG Grid aggregation-total-rows)
  /** <zh/> Grand 总计行位置 | <en/> Grand total row position */
  const grandTotalPosition = ref<'top' | 'bottom' | 'pinnedTop' | 'pinnedBottom'>('bottom')
  /** <zh/> 分组小计行位置 | <en/> Group sub-total row position */
  const groupTotalPosition = ref<'top' | 'bottom'>('bottom')
  /** <zh/> 是否仅技术部分组显示小计（选择性回调演示） | <en/> Whether to show sub-totals only for the Tech dept group (selective callback demo) */
  const selectiveGroupTotal = ref(false)
  /** <zh/> 是否保留组头聚合值（groupSuppressBlankHeader） | <en/> Whether to keep the group header aggregation value (groupSuppressBlankHeader) */
  const keepHeaderAgg = ref(false)
  /** <zh/> 粘性抑制（suppressStickyTotalRow） | <en/> Sticky suppression (suppressStickyTotalRow) */
  const totalStickySuppress = ref<boolean | 'grand' | 'group'>(false)

  /** <zh/> 选择性小计回调：仅技术部显示底部小计行 | <en/> Selective sub-total callback: only the Tech dept shows a bottom sub-total row */
  function selectiveGroupTotalFn({ node }: { node: { value: unknown } }) {
    return node.value === '技术部' ? 'bottom' as const : undefined
  }

  /** <zh/> 合计标签：Grand 显示总计，分组显示小计（部门） | <en/> Total label: Grand shows grand total, groups show sub-totals (dept) */
  function totalLabelGetter({ isGrandTotal, value }: { level: number, value: unknown, isGrandTotal: boolean }) {
    return isGrandTotal ? '总计' : `小计（${String(value)}）`
  }

  /** <zh/> 聚合演示列：年龄 avg、薪资 sum、进度 max | <en/> Aggregation demo columns: age avg, salary sum, progress max */
  const totalAggColumns = filterSortColumns.map(c =>
    c.prop === 'age'
      ? { ...c, aggFunc: 'avg' as const }
      : c.prop === 'salary'
        ? { ...c, aggFunc: 'sum' as const }
        : c.prop === 'progress'
          ? { ...c, aggFunc: 'max' as const }
          : c,
  )

  /** <zh/> 分组小计演示列：薪资 sum 聚合 | <en/> Group sub-total demo column: salary sum aggregation */
  const rowGroupTotalColumns = rowGroupColumns.map(c =>
    c.prop === 'salary' ? { ...c, aggFunc: 'sum' as const } : c,
  )

  // <zh/> 共享状态（从 composable 提取） <en/> Shared state (extracted from composable)
  // <zh/> 依赖响应式状态的列配置 <en/> Column configs depending on reactive state
  // <zh/> 必须经 computed 工厂读取 zIndex.value：若把 ref 本身嵌入 hoverActions.zIndex，RowActionBar 的 zIndex prop 会收到 Ref 对象（Vue prop 类型告警 + 样式 z-index 失效）。
  // <en/> Must read zIndex.value via a computed factory: embedding the ref itself into hoverActions.zIndex would hand a Ref object to RowActionBar's zIndex prop (Vue prop type warning + broken z-index style).
  const teleportHoverColumns = computed(() => createTeleportHoverColumns(teleportHoverZIndex.value))

  // <zh/> 虚拟滚动失步自愈演示（scrollSyncDemo） <en/> Virtual-scroll desync self-heal demo (scrollSyncDemo)
  const scrollSyncColumns = [
    { prop: 'id', label: 'ID', width: 90 },
    { prop: 'name', label: '姓名', width: 160 },
    { prop: 'age', label: '年龄', width: 90 },
    { prop: 'status', label: '状态', width: 110 },
    { prop: 'salary', label: '薪资', width: 140 },
    { prop: 'balance', label: '余额', width: 160 },
  ]
  const scrollSyncData = ref(genData(2000))
  const keepAliveShow = ref(true)
  const scrollSyncDrawerOpen = ref(false)
  const scrollSyncPanelHeight = ref(600)
  // <zh/> 别名使 eslint（unused-imports 不识别模板内置组件引用）与运行时均满意：
  // <zh/> 模板经 `<component :is>` 使用，与测试文件中 h(KeepAlive) 同思路
  // <en/> Alias so eslint (unused-imports doesn't recognize built-in component usage in templates) and runtime both pass:
  // <en/> used via <component :is> in template, same idea as h(KeepAlive) in test files
  const keepAliveComponent = KeepAlive

  function refreshScrollSyncData() {
    scrollSyncData.value = genData(2000)
  }

  // <zh/> 模拟失步：弹层/外部布局常会绕过 EP 的滚动事件（如隐藏期间被静默重置 DOM 位置）。
  // <zh/> 此处用捕获期拦截器阻断 EP 的 scroll 监听，直接改写 DOM scrollTop 使内部状态失步——
  // <zh/> 顶部空白带出现，库侧根节点 capture 独立感知滚动、静默约 120ms 后以 DOM 为准回写自愈。
  // <en/> Simulate a desync: overlays/external layouts often mutate the DOM scroll position
  // <en/> without EP's knowledge (e.g. silently reset while hidden). Here we block EP's scroll
  // <en/> listener with a capture-phase interceptor and rewrite the DOM scrollTop so the internal
  // <en/> state desyncs — the blank band appears, and the library's root-capture scroll listener
  // <en/> senses the scroll independently and heals from the DOM after ~120ms of settle.
  function simulateScrollSyncDesync() {
    const windowEl = document.querySelector(
      '.adv-table-virtual-renderer .el-table-v2__main .el-table-v2__body > div:first-child',
    )
    if (!windowEl)
      return
    const blocker = (e: Event) => e.stopImmediatePropagation()
    // <zh/> scroll 事件在下一任务才派发；once 自动清理，不必主动移除
    // <en/> The scroll event dispatches on the next task; `once` cleans up, no manual removal needed
    windowEl.addEventListener('scroll', blocker, { capture: true, once: true })
    windowEl.scrollTop = 0
  }

  // <zh/> § 11.1 API 表面全覆盖 (Props/Events/Slots/Expose) <en/> § 11.1 API surface full coverage (Props/Events/Slots/Expose)

  /** <zh/> 通用列配置 | <en/> Common column config */
  const surfaceCols = [
    { prop: 'id', label: 'ID', width: 80 },
    { prop: 'name', label: '姓名', width: 140, filterable: true },
    { prop: 'age', label: '年龄', width: 90, sortable: true },
    { prop: 'status', label: '状态', width: 110 },
    { prop: 'salary', label: '薪资', width: 120 },
  ]

  /** <zh/> 编辑用列 | <en/> Editable columns */
  const surfaceEditCols = [
    { prop: 'id', label: 'ID', width: 80 },
    { prop: 'name', label: '姓名', width: 140, valueType: 'text' as const },
    { prop: 'age', label: '年龄', width: 90, valueType: 'number' as const },
    { prop: 'salary', label: '薪资', width: 120, valueType: 'number' as const },
  ]

  /** <zh/> 演示数据 | <en/> Demo data */
  const surfaceData = ref(genData(12).map((r, i) => ({
    ...r,
    id: String(i + 1),
    status: i % 3 === 0 ? 'active' : i % 3 === 1 ? 'pending' : 'inactive',
  })))

  /** <zh/> 编辑数据（单独实例，避免被其他表格替换） | <en/> Edit data (separate instance so other tables don't replace it) */
  const surfaceEditData = ref(genData(8).map((r, i) => ({
    ...r,
    id: String(i + 1),
  })))

  /** <zh/> 拖拽用数据 | <en/> Drag demo data */
  const surfaceDragData = ref(genData(8).map((r, i) => ({
    ...r,
    id: String(i + 1),
  })))

  /** <zh/> 行分组用数据 | <en/> Row-group demo data */
  const surfaceGroupData = ref(genData(12).map((r, i) => ({
    ...r,
    id: String(i + 1),
    department: i < 4 ? '工程部' : i < 8 ? '市场部' : '人事部',
  })))

  // ── <zh/> 11.12-11.16 演示交互状态 <en/> 11.12-11.16 interaction state demos ──────────────────────────────────
  const stripeEnabled = ref(true)
  const showHeaderEnabled = ref(true)
  const sizeDemoValue = ref<'large' | 'default' | 'small'>('default')
  const tableLayoutDemoValue = ref<'fixed' | 'auto'>('fixed')
  // <zh/> tooltip 演示：窄列 + 超长文本以确保溢出触发 <en/> Tooltip demo: narrow column + long text to trigger overflow
  const tooltipDemoCols = [
    { prop: 'id', label: 'ID', width: 70 },
    { prop: 'name', label: '姓名', width: 120 },
    { prop: 'description', label: '描述(超长文本)', width: 150 },
  ]
  const tooltipDemoData = ref(genData(12).map((r, i) => ({
    ...r,
    id: String(i + 1),
    name: `用户${i + 1}_${'超长姓名文本'.repeat(3)}`,
    description: `这是一段用于触发溢出的超长描述文本 #${i + 1}，鼠标悬浮时应显示 tooltipFormatter 格式化内容：${'溢出文本'.repeat(10)}`,
  })) as any)

  /** <zh/> 触发 beforeDataChange / afterDataChange / dataChange 的数据变更 | <en/> Data change that triggers beforeDataChange / afterDataChange / dataChange */
  function surfaceMutateData() {
    surfaceData.value = surfaceData.value.map((r, i) =>
      i === 0 ? { ...r, age: (r as any).age + 1 } : r,
    )
  }

  /** <zh/> 抛错数据源——演示 error 事件 | <en/> Throwing data source — demonstrates the error event */
  async function surfaceErrorSource(): Promise<any> {
    throw new Error('演示 error 事件：数据源请求失败')
  }

  /** <zh/> 自定义 spanMethod——首行合并姓名列 | <en/> Custom spanMethod — merges the name column on the first row */
  function surfaceSpanMethod({ row, column, rowIndex }: { row: any, column: any, rowIndex: number }) {
  // <zh/> 使用 row 参数作演示 <en/> Use row parameter for demonstration
    const _rowName = row?.name
    if (column.prop === 'name' && rowIndex === 0)
      return { rowspan: 2, colspan: 1 }
    if (column.prop === 'name' && rowIndex === 1)
      return { rowspan: 0, colspan: 0 }
    return undefined
  }

  /** <zh/> tooltipFormatter——显示行/列/值 | <en/> tooltipFormatter — shows row/column/value */
  function surfaceTooltipFormatter({ row, column, cellValue }: { row: any, column: any, cellValue: unknown }) {
    return `[${column.prop}] ${row?.name ?? ''} = ${cellValue}`
  }

  /** <zh/> surface 实例 refs | <en/> Surface instance refs */
  const surfaceEventRef = ref<any>()
  const surfaceSpanRef = ref<any>()
  const surfaceSpanV2Ref = ref<any>()
  const surfaceApiRef = ref<any>()
  const surfaceApi2Ref = ref<any>()
  const surfaceApi3Ref = ref<any>()
  const surfaceApi4Ref = ref<any>()
  const surfaceApi5Ref = ref<any>()
  const surfaceApi6Ref = ref<any>()
  const surfaceApi7Ref = ref<any>()

  /** <zh/> 3.3 手动分页演示状态——父组件按 page-change 事件追加数据 | <en/> 3.3 manual pagination demo state — parent appends data on the page-change event */
  const manualRows = ref<any[]>([])
  const manualRowsV2 = ref<any[]>([])
  manualRows.value = [...pageData60.value.slice(0, 10)]
  manualRowsV2.value = [...pageData60.value.slice(0, 10)]
  function onManualPageChange(which: 'default' | 'virtual', page: number, size: number) {
    const target = which === 'default' ? manualRows : manualRowsV2
    const next = pageData60.value.slice(0, page * size)
    if (next.length > target.value.length)
      target.value = next
  }

  /** <zh/> 触发指定的 expose 方法（preferred 可指定目标实例，缺省按 1→6 顺序取首个就绪实例） | <en/> Trigger a given expose method (preferred targets a specific instance; default picks the first ready one in 1→6 order) */
  function surfaceApiCall(name: string, preferred?: any) {
    const refs = {
      surfaceApiRef: surfaceApiRef.value,
      surfaceApi2Ref: surfaceApi2Ref.value,
      surfaceApi3Ref: surfaceApi3Ref.value,
      surfaceApi4Ref: surfaceApi4Ref.value,
      surfaceApi5Ref: surfaceApi5Ref.value,
      surfaceApi6Ref: surfaceApi6Ref.value,
      surfaceApi7Ref: surfaceApi7Ref.value,
    }
    const api = preferred || refs.surfaceApiRef || refs.surfaceApi2Ref || refs.surfaceApi3Ref || refs.surfaceApi4Ref || refs.surfaceApi5Ref || refs.surfaceApi6Ref || refs.surfaceApi7Ref
    if (!api) {
      surfaceApiLog.value = [`[${name}] 实例尚未就绪`, ...surfaceApiLog.value]
      return
    }
    try {
      switch (name) {
        case 'refresh':
          api.refresh?.()
          surfaceApiLog.value = ['refresh() 已调用', ...surfaceApiLog.value]
          break
        case 'getFullData':
          surfaceApiLog.value = [`getFullData() → ${api.getFullData?.()?.length} rows`, ...surfaceApiLog.value]
          break
        case 'getCurrentPageData':
          surfaceApiLog.value = [`getCurrentPageData() → ${api.getCurrentPageData?.()?.length} rows`, ...surfaceApiLog.value]
          break
        case 'applyTransaction':
          api.applyTransaction?.({ add: [{ id: String(Date.now()), name: '新增', age: 20, salary: 5000 }], update: [], remove: [] })
          surfaceApiLog.value = ['applyTransaction() 已调用', ...surfaceApiLog.value]
          break
        case 'getRenderData':
          surfaceApiLog.value = [`getRenderData() → ${api.getRenderData?.()?.length} rows`, ...surfaceApiLog.value]
          break
        case 'setCurrentPage':
          api.setCurrentPage?.(1)
          surfaceApiLog.value = ['setCurrentPage(1) 已调用', ...surfaceApiLog.value]
          break
        case 'setPageSize':
          api.setPageSize?.(5)
          surfaceApiLog.value = ['setPageSize(5) 已调用', ...surfaceApiLog.value]
          break
        case 'getPagination':
          surfaceApiLog.value = [`getPagination() → ${JSON.stringify(api.getPagination?.())}`, ...surfaceApiLog.value]
          break
        case 'clearSelection':
          api.clearSelection?.()
          surfaceApiLog.value = ['clearSelection() 已调用', ...surfaceApiLog.value]
          break
        case 'selectAll':
          api.selectAll?.()
          surfaceApiLog.value = ['selectAll() 已调用', ...surfaceApiLog.value]
          break
        case 'invertSelection':
          api.invertSelection?.()
          surfaceApiLog.value = ['invertSelection() 已调用', ...surfaceApiLog.value]
          break
        case 'getSelectedRows':
          surfaceApiLog.value = [`getSelectedRows() → ${api.getSelectedRows?.()?.length} rows`, ...surfaceApiLog.value]
          break
        case 'getSelectedCount':
          surfaceApiLog.value = [`getSelectedCount() → ${api.getSelectedCount?.()}`, ...surfaceApiLog.value]
          break
        case 'getSelectedKeys':
          surfaceApiLog.value = [`getSelectedKeys() → ${JSON.stringify(api.getSelectedKeys?.())}`, ...surfaceApiLog.value]
          break
        case 'selectAllFiltered':
          api.selectAllFiltered?.()
          surfaceApiLog.value = ['selectAllFiltered() 已调用', ...surfaceApiLog.value]
          break
        case 'deselectAllFiltered':
          api.deselectAllFiltered?.()
          surfaceApiLog.value = ['deselectAllFiltered() 已调用', ...surfaceApiLog.value]
          break
        case 'selectAllOnCurrentPage':
          api.selectAllOnCurrentPage?.()
          surfaceApiLog.value = ['selectAllOnCurrentPage() 已调用', ...surfaceApiLog.value]
          break
        case 'deselectAllOnCurrentPage':
          api.deselectAllOnCurrentPage?.()
          surfaceApiLog.value = ['deselectAllOnCurrentPage() 已调用', ...surfaceApiLog.value]
          break
        case 'deselectAll':
          api.deselectAll?.()
          surfaceApiLog.value = ['deselectAll() 已调用', ...surfaceApiLog.value]
          break
        case 'selectRowByKey':
          api.selectRowByKey?.('2')
          surfaceApiLog.value = ['selectRowByKey(2) 已调用', ...surfaceApiLog.value]
          break
        case 'selectRowsByKeys':
          api.selectRowsByKeys?.(['3', '4'])
          surfaceApiLog.value = ['selectRowsByKeys([3,4]) 已调用', ...surfaceApiLog.value]
          break
        case 'isSelectedByKey':
          surfaceApiLog.value = [`isSelectedByKey(1) → ${api.isSelectedByKey?.('1')}`, ...surfaceApiLog.value]
          break
        case 'replaceSelection':
          api.replaceSelection?.([{ ...(api.getFullData?.()[0] ?? {}), id: '1' }])
          surfaceApiLog.value = ['replaceSelection([row1]) 已调用', ...surfaceApiLog.value]
          break
        case 'forEachSelected': {
          const names: string[] = []
          api.forEachSelected?.((r: any) => names.push(r.name))
          surfaceApiLog.value = [`forEachSelected() → [${names.join(',')}]`, ...surfaceApiLog.value]
          break
        }
        case 'getSelectedIndices':
          surfaceApiLog.value = [`getSelectedIndices() → ${JSON.stringify(api.getSelectedIndices?.())}`, ...surfaceApiLog.value]
          break
        case 'setSelection':
          api.setSelection?.([{ ...(api.getFullData?.()[0] ?? {}), id: '1' }, { ...(api.getFullData?.()[1] ?? {}), id: '2' }])
          surfaceApiLog.value = ['setSelection 已调用', ...surfaceApiLog.value]
          break
        case 'toggleRowSelection':
          api.toggleRowSelection?.(api.getFullData?.()[0], undefined)
          surfaceApiLog.value = ['toggleRowSelection 已调用', ...surfaceApiLog.value]
          break
        case 'toggleAllSelection':
          api.toggleAllSelection?.()
          surfaceApiLog.value = ['toggleAllSelection() 已调用', ...surfaceApiLog.value]
          break
        case 'setCurrentRow':
          api.setCurrentRow?.(api.getFullData?.()[1])
          surfaceApiLog.value = ['setCurrentRow 已调用', ...surfaceApiLog.value]
          break
        case 'getCurrentRow':
          surfaceApiLog.value = [`getCurrentRow() → ${JSON.stringify(api.getCurrentRow?.())}`, ...surfaceApiLog.value]
          break
        case 'refreshSelection':
          api.refreshSelection?.()
          surfaceApiLog.value = ['refreshSelection() 已调用', ...surfaceApiLog.value]
          break
        case 'initSelectionByKeys':
          api.initSelectionByKeys?.(['1'])
          surfaceApiLog.value = ['initSelectionByKeys([1]) 已调用', ...surfaceApiLog.value]
          break
        case 'getQueryFormModel':
          surfaceApiLog.value = [`getQueryFormModel() → ${JSON.stringify(api.getQueryFormModel?.())}`, ...surfaceApiLog.value]
          break
        case 'setQueryFormModel':
          api.setQueryFormModel?.({ name: '测试' })
          surfaceApiLog.value = ['setQueryFormModel 已调用', ...surfaceApiLog.value]
          break
        case 'setFilter':
          api.setFilter?.('age', { min: 30, max: 99 })
          surfaceApiLog.value = ['setFilter(age, >30) 已调用', ...surfaceApiLog.value]
          break
        case 'resetColumnFilter':
          api.resetColumnFilter?.('age')
          surfaceApiLog.value = ['resetColumnFilter(age) 已调用', ...surfaceApiLog.value]
          break
        case 'resetAllFilters':
          api.resetAllFilters?.()
          surfaceApiLog.value = ['resetAllFilters() 已调用', ...surfaceApiLog.value]
          break
        case 'getFilterValue':
          surfaceApiLog.value = [`getFilterValue(age) → ${JSON.stringify(api.getFilterValue?.('age'))}`, ...surfaceApiLog.value]
          break
        case 'isColumnFiltered':
          surfaceApiLog.value = [`isColumnFiltered(age) → ${api.isColumnFiltered?.('age')}`, ...surfaceApiLog.value]
          break
        case 'hasActiveFilter':
          surfaceApiLog.value = [`hasActiveFilter → ${api.hasActiveFilter}`, ...surfaceApiLog.value]
          break
        case 'hasActiveQuickFilter':
          surfaceApiLog.value = [`hasActiveQuickFilter → ${api.hasActiveQuickFilter}`, ...surfaceApiLog.value]
          break
        case 'setQuickFilter':
          api.setQuickFilter?.('张三')
          surfaceApiLog.value = ['setQuickFilter(张三) 已调用', ...surfaceApiLog.value]
          break
        case 'getQuickFilter':
          surfaceApiLog.value = [`getQuickFilter() → ${api.getQuickFilter?.()}`, ...surfaceApiLog.value]
          break
        case 'toggleSort':
          api.toggleSort?.('name')
          surfaceApiLog.value = ['toggleSort(name) 已调用', ...surfaceApiLog.value]
          break
        case 'setSort':
          api.setSort?.('name', 'ascending')
          surfaceApiLog.value = ['setSort(name, asc) 已调用', ...surfaceApiLog.value]
          break
        case 'setSorts':
          api.setSorts?.([{ prop: 'age', order: 'descending' }])
          surfaceApiLog.value = ['setSorts([age desc]) 已调用', ...surfaceApiLog.value]
          break
        case 'clearSort':
          api.clearSort?.()
          surfaceApiLog.value = ['clearSort() 已调用', ...surfaceApiLog.value]
          break
        case 'getSortOrder':
          surfaceApiLog.value = [`getSortOrder(name) → ${api.getSortOrder?.('name')}`, ...surfaceApiLog.value]
          break
        case 'getSortIndex':
          surfaceApiLog.value = [`getSortIndex(name) → ${api.getSortIndex?.('name')}`, ...surfaceApiLog.value]
          break
        case 'startEditing':
          api.startEditing?.({ rowIndex: 0, prop: 'name', columnKey: 'name', value: api.getFullData?.()[0]?.name })
          surfaceApiLog.value = ['startEditing({rowIndex:0, prop:name}) 已调用', ...surfaceApiLog.value]
          break
        case 'stopEditing':
          api.stopEditing?.('blur')
          surfaceApiLog.value = ['stopEditing(blur) 已调用', ...surfaceApiLog.value]
          break
        case 'submitEdit':
          api.submitEdit?.()
          surfaceApiLog.value = ['submitEdit 已调用', ...surfaceApiLog.value]
          break
        case 'discardEdit':
          api.discardEdit?.()
          surfaceApiLog.value = ['discardEdit 已调用', ...surfaceApiLog.value]
          break
        case 'commitBatchEdit':
          api.commitBatchEdit?.()
          surfaceApiLog.value = ['commitBatchEdit 已调用', ...surfaceApiLog.value]
          break
        case 'cancelBatchEdit':
          api.cancelBatchEdit?.()
          surfaceApiLog.value = ['cancelBatchEdit 已调用', ...surfaceApiLog.value]
          break
        case 'hasPendingChanges':
          surfaceApiLog.value = [`hasPendingChanges → ${api.hasPendingChanges}`, ...surfaceApiLog.value]
          break
        case 'batchHasPending':
          surfaceApiLog.value = [`batchHasPending → ${api.batchHasPending}`, ...surfaceApiLog.value]
          break
        case 'validate':
          surfaceApiLog.value = [`validate() → ${api.validate?.()}`, ...surfaceApiLog.value]
          break
        case 'validateRow':
          surfaceApiLog.value = [`validateRow(0) → ${api.validateRow?.(0)}`, ...surfaceApiLog.value]
          break
        case 'clearValidate':
          api.clearValidate?.()
          surfaceApiLog.value = ['clearValidate 已调用', ...surfaceApiLog.value]
          break
        case 'undo':
          surfaceApiLog.value = [`undo() → ${api.undo?.()}`, ...surfaceApiLog.value]
          break
        case 'redo':
          surfaceApiLog.value = [`redo() → ${api.redo?.()}`, ...surfaceApiLog.value]
          break
        case 'canUndo':
          surfaceApiLog.value = [`canUndo → ${api.canUndo}`, ...surfaceApiLog.value]
          break
        case 'canRedo':
          surfaceApiLog.value = [`canRedo → ${api.canRedo}`, ...surfaceApiLog.value]
          break
        case 'hasUnsavedChanges':
          surfaceApiLog.value = [`hasUnsavedChanges() → ${api.hasUnsavedChanges?.()}`, ...surfaceApiLog.value]
          break
        case 'getRowKey':
          surfaceApiLog.value = [`getRowKey(row) → ${api.getRowKey?.(api.getFullData?.()[0])}`, ...surfaceApiLog.value]
          break
        case 'exportExcel':
          api.exportExcel?.()
          surfaceApiLog.value = ['exportExcel 已调用', ...surfaceApiLog.value]
          break
        case 'exportCsv':
          api.exportCsv?.()
          surfaceApiLog.value = ['exportCsv 已调用', ...surfaceApiLog.value]
          break
        case 'print':
          api.print?.()
          surfaceApiLog.value = ['print 已调用', ...surfaceApiLog.value]
          break
        case 'triggerImport':
          api.triggerImport?.()
          surfaceApiLog.value = ['triggerImport 已调用', ...surfaceApiLog.value]
          break
        case 'showContextMenu':
          api.showContextMenu?.({ area: 'body', event: { clientX: 200, clientY: 200, preventDefault: () => {} } } as any)
          surfaceApiLog.value = ['showContextMenu({area:body}) 已调用', ...surfaceApiLog.value]
          break
        case 'hideContextMenu':
          api.hideContextMenu?.()
          surfaceApiLog.value = ['hideContextMenu 已调用', ...surfaceApiLog.value]
          break
        case 'getColumnState':
          surfaceApiLog.value = [`getColumnState() → ${JSON.stringify(api.getColumnState?.())}`, ...surfaceApiLog.value]
          break
        case 'applyColumnState':
          api.applyColumnState?.(api.getColumnState?.() ?? null)
          surfaceApiLog.value = ['applyColumnState(getColumnState() 回写) 已调用', ...surfaceApiLog.value]
          break
        case 'resetColumnState':
          api.resetColumnState?.()
          surfaceApiLog.value = ['resetColumnState 已调用', ...surfaceApiLog.value]
          break
        case 'saveView':
          api.saveView?.('surface-view')
          surfaceApiLog.value = ['saveView(surface-view) 已调用', ...surfaceApiLog.value]
          break
        case 'applyView':
          api.applyView?.('surface-view')
          surfaceApiLog.value = ['applyView(surface-view) 已调用', ...surfaceApiLog.value]
          break
        case 'getSavedViews':
          surfaceApiLog.value = [`getSavedViews() → ${JSON.stringify(api.getSavedViews?.())}`, ...surfaceApiLog.value]
          break
        case 'deleteView':
          api.deleteView?.('surface-view')
          surfaceApiLog.value = ['deleteView(surface-view) 已调用', ...surfaceApiLog.value]
          break
        case 'toggleTreeNodeExpand':
          api.toggleTreeNodeExpand?.('1')
          surfaceApiLog.value = ['toggleTreeNodeExpand(1) 已调用', ...surfaceApiLog.value]
          break
        case 'expandTreeNode':
          api.expandTreeNode?.('1')
          surfaceApiLog.value = ['expandTreeNode(1) 已调用', ...surfaceApiLog.value]
          break
        case 'collapseTreeNode':
          api.collapseTreeNode?.('1')
          surfaceApiLog.value = ['collapseTreeNode(1) 已调用', ...surfaceApiLog.value]
          break
        case 'expandAllTreeNodes':
          api.expandAllTreeNodes?.()
          surfaceApiLog.value = ['expandAllTreeNodes 已调用', ...surfaceApiLog.value]
          break
        case 'collapseAllTreeNodes':
          api.collapseAllTreeNodes?.()
          surfaceApiLog.value = ['collapseAllTreeNodes 已调用', ...surfaceApiLog.value]
          break
        case 'getTreeMeta':
          surfaceApiLog.value = [`getTreeMeta(row0) → ${JSON.stringify(api.getTreeMeta?.(api.getFullData?.()[0]))}`, ...surfaceApiLog.value]
          break
        case 'toggleDetailRowExpand':
          api.toggleDetailRowExpand?.('1')
          surfaceApiLog.value = ['toggleDetailRowExpand(1) 已调用', ...surfaceApiLog.value]
          break
        case 'expandDetailRow':
          api.expandDetailRow?.('1')
          surfaceApiLog.value = ['expandDetailRow(1) 已调用', ...surfaceApiLog.value]
          break
        case 'collapseDetailRow':
          api.collapseDetailRow?.('1')
          surfaceApiLog.value = ['collapseDetailRow(1) 已调用', ...surfaceApiLog.value]
          break
        case 'expandAllDetailRows':
          api.expandAllDetailRows?.()
          surfaceApiLog.value = ['expandAllDetailRows 已调用', ...surfaceApiLog.value]
          break
        case 'collapseAllDetailRows':
          api.collapseAllDetailRows?.()
          surfaceApiLog.value = ['collapseAllDetailRows 已调用', ...surfaceApiLog.value]
          break
        case 'toggleGroupExpand':
          api.toggleGroupExpand?.('工程部')
          surfaceApiLog.value = ['toggleGroupExpand(工程部) 已调用', ...surfaceApiLog.value]
          break
        case 'expandAllGroups':
          api.expandAllGroups?.()
          surfaceApiLog.value = ['expandAllGroups 已调用', ...surfaceApiLog.value]
          break
        case 'collapseAllGroups':
          api.collapseAllGroups?.()
          surfaceApiLog.value = ['collapseAllGroups 已调用', ...surfaceApiLog.value]
          break
        case 'pinRow':
          api.pinRow?.('1', 'top')
          surfaceApiLog.value = ['pinRow(1, top) 已调用', ...surfaceApiLog.value]
          break
        case 'unpinRow':
          api.unpinRow?.('1')
          surfaceApiLog.value = ['unpinRow(1) 已调用', ...surfaceApiLog.value]
          break
        case 'isRowPinned':
          surfaceApiLog.value = [`isRowPinned(1) → ${api.isRowPinned?.('1')}`, ...surfaceApiLog.value]
          break
        case 'clearPinnedRows':
          api.clearPinnedRows?.()
          surfaceApiLog.value = ['clearPinnedRows 已调用', ...surfaceApiLog.value]
          break
        case 'scrollToRow':
          api.scrollToRow?.('3')
          surfaceApiLog.value = ['scrollToRow(3) 已调用', ...surfaceApiLog.value]
          break
        case 'scrollToColumn':
          api.scrollToColumn?.('name')
          surfaceApiLog.value = ['scrollToColumn(name) 已调用', ...surfaceApiLog.value]
          break
        case 'setLoading':
          api.setLoading?.(!api.loading)
          surfaceApiLog.value = ['setLoading(toggled) 已调用', ...surfaceApiLog.value]
          break
        case 'loading':
          surfaceApiLog.value = [`loading → ${api.loading}`, ...surfaceApiLog.value]
          break
        case 'updateCellEditingValue':
          api.startEditing?.({ rowIndex: 0, prop: 'name', columnKey: 'name', value: api.getFullData?.()[0]?.name })
          api.updateCellEditingValue?.('name', '编辑中改写')
          surfaceApiLog.value = ['updateCellEditingValue(name, 编辑中改写) 已调用（先 startEditing 第 0 行 name 列）', ...surfaceApiLog.value]
          break
        case 'getCellEditingValue':
          surfaceApiLog.value = [`getCellEditingValue(name) → ${JSON.stringify(api.getCellEditingValue?.('name'))}`, ...surfaceApiLog.value]
          break
        case 'tableRootRef':
          surfaceApiLog.value = [`tableRootRef → ${api.tableRootRef ? 'exists' : 'null'}`, ...surfaceApiLog.value]
          break
        case 'version':
          surfaceApiLog.value = [`version → ${api.version}`, ...surfaceApiLog.value]
          break
        default:
          surfaceApiLog.value = [`[${name}] 未实现`, ...surfaceApiLog.value]
          break
      }
    }
    catch (e: any) {
      surfaceApiLog.value = [`[${name}] 错误: ${e?.message ?? e}`, ...surfaceApiLog.value]
    }
  }

  // <zh/> modeSwitchBehavior 演示（在 surface 内） <en/> modeSwitchBehavior demo (inside surface)
  type SurfMode = 'default' | 'virtual'
  const surfaceMode = ref<SurfMode>('default')
  const surfaceBehavior = ref<'warn' | 'error' | 'silent'>('warn')
  function cycleModeBehavior() {
    surfaceMode.value = surfaceMode.value === 'default' ? 'virtual' : 'default'
  }

  // ── <zh/> 11.1 v-model 演示状态（5 个 v-model 各自概况） <en/> 11.1 v-model demo state (5 v-models overview) ──────────────────
  /** <zh/> v-model:data 专用数据实例 | <en/> Dedicated data instance for v-model:data */
  const surfaceVmData = ref(genData(8).map((r, i) => ({
    ...r,
    id: String(i + 1),
    status: i % 2 === 0 ? 'active' : 'pending',
  })))
  /** <zh/> v-model:columns 专用列实例（可被列面板操作回写） | <en/> Dedicated columns instance for v-model:columns (writable by the column panel) */
  const surfaceVmColumns = ref<any[]>([...surfaceCols])
  /** <zh/> v-model:loading 共享开关 | <en/> Shared toggle for v-model:loading */
  const surfaceVmLoading = ref(false)
  /** <zh/> v-model:quickFilter 共享文本 | <en/> Shared text for v-model:quickFilter */
  const surfaceVmQuickFilter = ref('')
  /** <zh/> v-model:searchValues 共享查询表单模型 | <en/> Shared search form model for v-model:searchValues */
  const surfaceVmSearchValues = ref<Record<string, unknown>>({})
  /** <zh/> v-model:data 演示实例（applyTransaction 回写验证） | <en/> v-model:data demo instance (applyTransaction write-back verification) */
  const surfaceVmRef = ref<any>()
  // <zh/> 全量本地绑定经 provide 下发给迁出的 section（见 demo-context.ts）
  // <en/> Every local binding is provided to migrated sections (see demo-context.ts)

  return {
    cycleModeBehavior,
    grandTotalPosition,
    groupTotalPosition,
    keepAliveComponent,
    keepAliveShow,
    keepHeaderAgg,
    manualRows,
    manualRowsV2,
    onManualPageChange,
    refreshScrollSyncData,
    rowGroupTotalColumns,
    scrollSyncColumns,
    scrollSyncData,
    scrollSyncDrawerOpen,
    scrollSyncPanelHeight,
    selectiveGroupTotal,
    selectiveGroupTotalFn,
    showHeaderEnabled,
    simulateScrollSyncDesync,
    sizeDemoValue,
    stripeEnabled,
    surfaceApi2Ref,
    surfaceApi3Ref,
    surfaceApi4Ref,
    surfaceApi5Ref,
    surfaceApi6Ref,
    surfaceApi7Ref,
    surfaceApiCall,
    surfaceApiRef,
    surfaceBehavior,
    surfaceCols,
    surfaceData,
    surfaceDragData,
    surfaceEditCols,
    surfaceEditData,
    surfaceErrorSource,
    surfaceEventRef,
    surfaceGroupData,
    surfaceMode,
    surfaceMutateData,
    surfaceSpanMethod,
    surfaceSpanRef,
    surfaceSpanV2Ref,
    surfaceTooltipFormatter,
    surfaceVmColumns,
    surfaceVmData,
    surfaceVmLoading,
    surfaceVmQuickFilter,
    surfaceVmRef,
    surfaceVmSearchValues,
    tableLayoutDemoValue,
    teleportHoverColumns,
    tooltipDemoCols,
    tooltipDemoData,
    totalAggColumns,
    totalLabelGetter,
    totalStickySuppress,
  }
}
