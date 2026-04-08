<script setup lang="ts">
import { ElButton, ElCheckbox, ElDrawer, ElEmpty, ElInput, ElInputNumber, ElOption, ElRadio, ElRadioGroup, ElSelect, ElSwitch } from 'element-plus'
import { KeepAlive, ref } from 'vue'
import { demoCategories } from './table-demo/categories'

import {
  activeMethodColumns,
  addressColumns,
  allValueTypeColumns,
  cellKeyboardColumns,
  cellRangeColumns,
  clipboardColumns,
  colMergeColumns,
  columnDragColumns,
  columnStateColumns,
  compColumns,
  createTeleportHoverColumns,
  defaultColDefColumns,
  dragColumns,
  dynamicParamsColumns,
  editColumns,
  empColumns,
  f2BackspaceColumns,
  filterSortColumns,
  groupColumns,
  highlightColumns,
  lifecycleColumns,
  loseFocusColumns,
  mergeColumns,
  multiSelectColumns,
  optionColumns,
  orderColumns,
  presetColumns,
  resizeCols,
  rowClassNameColumns,
  rowExpandColumns,
  rowExpandDetailColumns,
  rowGroupColumns,
  searchValuesColumns,
  showStatusColumns,
  sidePanelComboColumns,
  tabEnterNavColumns,
  teleportAutoColsAlwaysTeleport,
  teleportAutoColsNoFixed,
  teleportAutoColsWithFixed,
  treeColumns,
  treeSelectionColumns,
  validateColumns,
  validateModeColumns,
} from './table-demo/columns'
import { genData } from './table-demo/demo-data'
import {
  customComponents,
  customSearchFields,
  handleGetCurrentPage,
  handleShowSelection,
  rowClassNameFn,
  selectViaApi,
  summaryMethod,
} from './table-demo/helpers'
import { surfaceApiLog, surfaceEventHandlers, surfaceLog } from './table-demo/surface-state'
import SurfaceEventBoard from './table-demo/SurfaceEventBoard.vue'
import { useTableDemoState } from './table-demo/use-table-demo-state'
import '@advanced-elements/table/style/index.scss'

//  本地状态
const selectedDemo = ref('mega')

//  合计行演示状态（AG Grid aggregation-total-rows 对齐）
/** Grand 总计行位置 */
const grandTotalPosition = ref<'top' | 'bottom' | 'pinnedTop' | 'pinnedBottom'>('bottom')
/** 分组小计行位置 */
const groupTotalPosition = ref<'top' | 'bottom'>('bottom')
/** 是否仅技术部分组显示小计（选择性回调演示） */
const selectiveGroupTotal = ref(false)
/** 是否保留组头聚合值（groupSuppressBlankHeader） */
const keepHeaderAgg = ref(false)
/** 粘性抑制（suppressStickyTotalRow） */
const totalStickySuppress = ref<boolean | 'grand' | 'group'>(false)

/** 选择性小计回调：仅技术部显示底部小计行 */
function selectiveGroupTotalFn({ node }: { node: { value: unknown } }) {
  return node.value === '技术部' ? 'bottom' as const : undefined
}

/** 合计标签：Grand 显示总计，分组显示小计（部门） */
function totalLabelGetter({ isGrandTotal, value }: { level: number, value: unknown, isGrandTotal: boolean }) {
  return isGrandTotal ? '总计' : `小计（${String(value)}）`
}

/** 聚合演示列：年龄 avg、薪资 sum、进度 max */
const totalAggColumns = filterSortColumns.map(c =>
  c.prop === 'age'
    ? { ...c, aggFunc: 'avg' as const }
    : c.prop === 'salary'
      ? { ...c, aggFunc: 'sum' as const }
      : c.prop === 'progress'
        ? { ...c, aggFunc: 'max' as const }
        : c,
)

/** 分组小计演示列：薪资 sum 聚合 */
const rowGroupTotalColumns = rowGroupColumns.map(c =>
  c.prop === 'salary' ? { ...c, aggFunc: 'sum' as const } : c,
)

//  共享状态（从 composable 提取）
const {
  // Data refs
  basicData,
  allValueTypeData,
  groupData,
  optionData,
  filterSortData,
  pageData60,
  pageData100,
  editData,
  dragData,
  dragDataV2,
  columnDragData,
  columnDragDataV2,
  batchEditData,
  columnStateData,
  sidePanelComboData,
  cellRangeData,
  dragEventData,
  dragEventV2Data,
  p2EnhancedData,
  selectorData,
  f2BackspaceData,
  clipboardData,
  showStatusData,
  lifecycleData,
  multiSelectData,
  dynamicParamsData,
  activeMethodData,
  loseFocusData,
  popupEditData,
  popupPositionData,
  validateData,
  orderData,
  treeData,
  asyncTreeData,
  rowGroupData,
  rowExpandData,
  rowClassNameData,
  vModelData,
  vModelDataV2,
  megaDataset,
  megaColumns,
  megaQuickFilter,
  megaSearchValues,
  megaSelectedRowKeys,
  // Mega 开关与全量绑定
  megaRequestOn,
  megaTreeOn,
  megaRowGroupOn,
  megaExpandOn,
  megaPinOn,
  megaSpanOn,
  megaRangeSelOn,
  megaMenuOn,
  megaDebugOn,
  megaLowPerfOn,
  megaStripe,
  megaShowHeader,
  megaLoading,
  megaBareOn,
  megaRowDragOn,
  megaExtFilterOn,
  megaSize,
  megaTableLayout,
  megaTooltipEffect,
  megaModeSwitchBehavior,
  megaPropsLeft,
  megaPropsRight,
  megaEventHandlers,
  megaEventLog,
  megaEventTotal,
  megaTriggeredEventCount,
  megaUnfiredEvents,
  megaClearLog,
  compDemoData,
  compDemoRequest,
  onCompImported,

  // Static data
  mergeData,
  colMergeData,
  addressData,
  empData,
  orderDetailsMap,

  // Table refs
  megaRef,
  basicRef,
  pageClientRef,
  pageClientV2Ref,
  pageRemoteRef,
  pageManualRef,
  searchCustomRef,
  toolbarRef,
  importRef,
  selMultiRef,
  selMultiV2Ref,
  filterSortRef,
  filterSortV2Ref,
  mergeRef,
  colMergeRef,
  compRef,
  compV2Ref,
  editRef,
  editV2Ref,
  fullRowEditRef,
  validateRef,
  validateFullRowRef,
  validateModeRef,
  crossValidateRef,
  sidePanelRef,
  columnPresetsRef,
  externalFilterRef,
  contextMenuRef,
  interceptorRef,
  readOnlyEditRef,
  batchEditRef,
  suppressFloatingBtnRef,
  resizeRef,
  resizeV2Ref,
  quickFilterRef,
  columnStateRef,
  pollingRef,
  cellKeyboardRef,
  floatingFilterRef,
  manualSortRef,
  manualSortV2Ref,
  dragRef,
  dragV2Ref,
  defaultColDefRef,
  selShiftDefaultRef,
  selShiftVirtualRef,
  selMultiClickDefaultRef,
  selMultiClickVirtualRef,
  rowSelectedRef,
  modelUpdatedRef,
  rowClickSelectTrueRef,
  rowClickSelectFalseRef,
  loadingDemoRef,
  loadingDemoV2Ref,
  spanMethodRef,
  spanMethodV2Ref,
  gridReadyRef,
  gridReadyV2Ref,
  cellEditLifecycleRef,
  cellEditLifecycleV2Ref,
  columnEventRef,
  columnEventV2Ref,
  dragEventRef,
  dragEventV2Ref,
  cellFocusedRef,
  cellFocusedV2Ref,
  vModelRef,
  vModelV2Ref,
  searchValuesRef,
  treeRef,
  treeSelectionRef,
  rowGroupRef,
  rowExpandRef,
  sidePanelComboRef,
  p2TableRef,
  p2TableV2Ref,
  apiV2Ref,
  selectedRowKeysRef,
  selectedRowKeysV2Ref,
  formatMapsRef,
  formatMapsV2Ref,
  sizeConfigPreset,
  sizeConfigValue,
  validateModeType,
  filterAgeThreshold,
  contextMenuLog,
  interceptorLog,
  readOnlyEditLog,
  importLog,
  quickFilterText,
  cellKeyboardLog,
  modelUpdatedCount,
  manualSortLog,
  borderOn,
  resizableOn,
  gridReadyLog,
  cellEditLifecycleLog,
  columnEventLog,
  dragEventLog,
  cellFocusedLog,
  highlightCurrentRow,
  highlightCurrentRowV2,
  searchValuesModel,
  treeSelectionStrictly,
  treeSelectionSelectedKeys,
  rowGroupField,
  rowGroupDefaultExpandAll,
  rowExpandAccordion,
  rowClassNameTooltipEffect,
  selectedRowKeysValue,
  cellRangeSelectionLog,
  teleportHoverZIndex,
  // Configs
  treeConfig,
  treeConfigExpandAll,
  treeSelectionConfig,
  rowGroupConfig,
  rowExpandConfig,

  // Functions
  p2Undo,
  p2Redo,
  p2CheckUnsaved,

  // Mock functions
  mockPaginatedRequest,
  mockCustomFormatRequest,
  mockTreeRequest,
  loadTreeData,
} = useTableDemoState()

//  依赖响应式状态的列配置
const teleportHoverColumns = createTeleportHoverColumns(teleportHoverZIndex)

//  虚拟滚动失步自愈演示（scrollSyncDemo）
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

//  § 11.1 API 表面全覆盖 (Props/Events/Slots/Expose)

/** 通用列配置 */
const surfaceCols = [
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'name', label: '姓名', width: 140, filterable: true },
  { prop: 'age', label: '年龄', width: 90, sortable: true },
  { prop: 'status', label: '状态', width: 110 },
  { prop: 'salary', label: '薪资', width: 120 },
]

/** 编辑用列 */
const surfaceEditCols = [
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'name', label: '姓名', width: 140, valueType: 'text' as const },
  { prop: 'age', label: '年龄', width: 90, valueType: 'number' as const },
  { prop: 'salary', label: '薪资', width: 120, valueType: 'number' as const },
]

/** 演示数据 */
const surfaceData = ref(genData(12).map((r, i) => ({
  ...r,
  id: String(i + 1),
  status: i % 3 === 0 ? 'active' : i % 3 === 1 ? 'pending' : 'inactive',
})))

/** 编辑数据（单独实例，避免被其他表格替换） */
const surfaceEditData = ref(genData(8).map((r, i) => ({
  ...r,
  id: String(i + 1),
})))

/** 拖拽用数据 */
const surfaceDragData = ref(genData(8).map((r, i) => ({
  ...r,
  id: String(i + 1),
})))

/** 行分组用数据 */
const surfaceGroupData = ref(genData(12).map((r, i) => ({
  ...r,
  id: String(i + 1),
  department: i < 4 ? '工程部' : i < 8 ? '市场部' : '人事部',
})))

// ── 11.12-11.16 演示交互状态 ──────────────────────────────────
const stripeEnabled = ref(true)
const showHeaderEnabled = ref(true)
const sizeDemoValue = ref<'large' | 'default' | 'small'>('default')
const tableLayoutDemoValue = ref<'fixed' | 'auto'>('fixed')
// tooltip 演示：窄列 + 超长文本以确保溢出触发
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

/** 触发 beforeDataChange / afterDataChange / dataChange 的数据变更 */
function surfaceMutateData() {
  surfaceData.value = surfaceData.value.map((r, i) =>
    i === 0 ? { ...r, age: (r as any).age + 1 } : r,
  )
}

/** 抛错数据源 —— 演示 error 事件 */
async function surfaceErrorSource(): Promise<any> {
  throw new Error('演示 error 事件：数据源请求失败')
}

/** 自定义 spanMethod —— 首行合并姓名列 */
function surfaceSpanMethod({ row, column, rowIndex }: { row: any, column: any, rowIndex: number }) {
  // Use row parameter for demonstration
  const _rowName = row?.name
  if (column.prop === 'name' && rowIndex === 0)
    return { rowspan: 2, colspan: 1 }
  if (column.prop === 'name' && rowIndex === 1)
    return { rowspan: 0, colspan: 0 }
  return undefined
}

/** tooltipFormatter —— 显示行/列/值 */
function surfaceTooltipFormatter({ row, column, cellValue }: { row: any, column: any, cellValue: unknown }) {
  return `[${column.prop}] ${row?.name ?? ''} = ${cellValue}`
}

/** surface 实例 refs */
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

/** 3.3 手动分页演示状态——父组件按 page-change 事件追加数据 */
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

/** 触发指定的 expose 方法（preferred 可指定目标实例，缺省按 1→6 顺序取首个就绪实例） */
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

//  modeSwitchBehavior 演示（在 surface 内）
type SurfMode = 'default' | 'virtual'
const surfaceMode = ref<SurfMode>('default')
const surfaceBehavior = ref<'warn' | 'error' | 'silent'>('warn')
function cycleModeBehavior() {
  surfaceMode.value = surfaceMode.value === 'default' ? 'virtual' : 'default'
}

// ── 11.1 v-model 演示状态（5 个 v-model 各自概况）──────────────────
/** v-model:data 专用数据实例 */
const surfaceVmData = ref(genData(8).map((r, i) => ({
  ...r,
  id: String(i + 1),
  status: i % 2 === 0 ? 'active' : 'pending',
})))
/** v-model:columns 专用列实例（可被列面板操作回写） */
const surfaceVmColumns = ref<any[]>([...surfaceCols])
/** v-model:loading 共享开关 */
const surfaceVmLoading = ref(false)
/** v-model:quickFilter 共享文本 */
const surfaceVmQuickFilter = ref('')
/** v-model:searchValues 共享查询表单模型 */
const surfaceVmSearchValues = ref<Record<string, unknown>>({})
/** v-model:data 演示实例（applyTransaction 回写验证） */
const surfaceVmRef = ref<any>()
</script>

<template>
  <div class="table-demo">
    <!-- 侧边栏导航 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <h2>AdvTable 功能演示</h2>
      </div>
      <nav class="sidebar-nav">
        <div
          v-for="category in demoCategories"
          :key="category.label"
          class="category-group"
        >
          <div class="category-label">
            {{ category.label }}
          </div>
          <div
            v-for="option in category.options"
            :key="option.value"
            class="nav-item"
            :class="{ active: selectedDemo === option.value }"
            @click="selectedDemo = option.value"
          >
            {{ option.label }}
          </div>
        </div>
      </nav>
    </aside>

    <!-- 主内容区 -->
    <main class="main-content">
      <!-- 全部展示 -->
      <div
        v-if="selectedDemo === 'all'"
        class="demo-section"
      >
        <h1>全部功能展示</h1>
        <p>此处展示所有功能的缩略版，详细演示请从左侧导航选择具体功能。</p>

        <!-- 基础展示 -->
        <section class="demo-block">
          <h3>1. 基础展示</h3>
          <div class="dual-mode">
            <div class="mode-panel">
              <h4>Default 模式</h4>
              <adv-table
                mode="default"
                :data="basicData"
                :columns="allValueTypeColumns.slice(0, 8)"
                :pagination="{ pageSize: 5 }"
                height="300px"
              />
            </div>
            <div class="mode-panel">
              <h4>Virtual 模式</h4>
              <adv-table
                mode="virtual"
                :data="basicData"
                :columns="allValueTypeColumns.slice(0, 8)"
                :pagination="{ pageSize: 5 }"
                height="300px"
              />
            </div>
          </div>
        </section>

        <!-- 选择功能 -->
        <section class="demo-block">
          <h3>2. 选择功能</h3>
          <div class="dual-mode">
            <div class="mode-panel">
              <h4>多选 + Shift 选择</h4>
              <adv-table
                mode="default"
                :data="filterSortData"
                :columns="filterSortColumns"
                :row-config="{ rowSelection: 'multiple' }"
                height="300px"
              />
            </div>
            <div class="mode-panel">
              <h4>Virtual 模式</h4>
              <adv-table
                mode="virtual"
                :data="filterSortData"
                :columns="filterSortColumns"
                :row-config="{ rowSelection: 'multiple' }"
                height="300px"
              />
            </div>
          </div>
        </section>

        <!-- 编辑功能 -->
        <section class="demo-block">
          <h3>3. 编辑功能</h3>
          <div class="dual-mode">
            <div class="mode-panel">
              <h4>单元格编辑</h4>
              <adv-table
                ref="editRef"
                v-model:data="editData"
                mode="default"
                :columns="editColumns"
                :edit-config="{}"
                height="300px"
              />
            </div>
            <div class="mode-panel">
              <h4>Virtual 模式</h4>
              <adv-table
                ref="editV2Ref"
                :data="editData"
                mode="virtual"
                :columns="editColumns"
                :edit-config="{}"
                height="300px"
              />
            </div>
          </div>
        </section>

        <!-- 树形与分组 -->
        <section class="demo-block">
          <h3>4. 树形与分组</h3>
          <div class="dual-mode">
            <div class="mode-panel">
              <h4>树形数据</h4>
              <adv-table
                mode="default"
                :data="treeData"
                :columns="treeColumns"
                :tree-config="treeConfig"
                :row-config="{ rowKey: 'id' }"
                height="300px"
              />
            </div>
            <div class="mode-panel">
              <h4>Virtual 模式</h4>
              <adv-table
                mode="virtual"
                :data="treeData"
                :columns="treeColumns"
                :tree-config="treeConfig"
                :row-config="{ rowKey: 'id' }"
                height="300px"
              />
            </div>
          </div>
        </section>
      </div>

      <!-- 整合示例 -->
      <div
        v-else-if="selectedDemo === 'mega'"
        class="demo-section"
      >
        <h1>⭐ 总示例（mega）— 全部表格级 API 一次装配</h1>
        <p>
          左面板 default 模式、右面板 virtual 模式。两面板通过 <code>v-bind="megaPropsLeft/Right"</code>
          绑定全部 46 个 props、通过 <code>v-on="megaEventHandlers"</code> 绑定全部 53 个事件；
          左面板使用全部 6 个 v-model（data / columns / loading / quickFilter / searchValues / selectedRowKeys），右面板对同一份状态单向绑定。
        </p>

        <div class="mega-controls">
          <ElInput
            v-model="megaQuickFilter"
            placeholder="全局搜索..."
            clearable
            style="width: 200px"
          />
          <ElButton
            type="primary"
            @click="megaRef?.exportCsv?.()"
          >
            导出 CSV
          </ElButton>
          <ElButton @click="megaRef?.validate?.()">
            校验数据
          </ElButton>
          <ElButton @click="megaRef?.deselectAllFiltered?.()">
            清空选择
          </ElButton>
        </div>

        <!-- 功能开关：配置对象常绑定，enabled/取值由这些开关翻转 -->
        <div
          class="mega-controls"
          style="flex-wrap: wrap"
        >
          <span><ElSwitch v-model="megaRequestOn" /> request 数据源</span>
          <span><ElSwitch v-model="megaTreeOn" /> 树形数据</span>
          <span><ElSwitch v-model="megaRowGroupOn" /> 行分组</span>
          <span><ElSwitch v-model="megaExpandOn" /> 展开行</span>
          <span><ElSwitch v-model="megaPinOn" /> 行固定</span>
          <span><ElSwitch v-model="megaSpanOn" /> 单元格合并</span>
          <span><ElSwitch v-model="megaRangeSelOn" /> 范围选择</span>
          <span><ElSwitch v-model="megaMenuOn" /> 右键菜单</span>
          <span><ElSwitch v-model="megaRowDragOn" /> 行拖拽</span>
          <span><ElSwitch v-model="megaExtFilterOn" /> 外部筛选(仅启用)</span>
          <span><ElSwitch v-model="megaDebugOn" /> debug</span>
          <span><ElSwitch v-model="megaLowPerfOn" /> 性能降档 low</span>
          <span><ElSwitch v-model="megaStripe" /> stripe</span>
          <span><ElSwitch v-model="megaShowHeader" /> showHeader</span>
          <span><ElSwitch v-model="megaLoading" /> loading</span>
          <span><ElSwitch v-model="megaBareOn" /> 容器 bare</span>
        </div>

        <div
          class="mega-controls"
          style="flex-wrap: wrap"
        >
          <ElSelect
            v-model="megaSize"
            style="width: 120px"
          >
            <ElOption
              label="size: large"
              value="large"
            />
            <ElOption
              label="size: default"
              value="default"
            />
            <ElOption
              label="size: small"
              value="small"
            />
          </ElSelect>
          <ElSelect
            v-model="megaTableLayout"
            style="width: 140px"
          >
            <ElOption
              label="layout: fixed"
              value="fixed"
            />
            <ElOption
              label="layout: auto"
              value="auto"
            />
          </ElSelect>
          <ElSelect
            v-model="megaTooltipEffect"
            style="width: 150px"
          >
            <ElOption
              label="tooltip: dark"
              value="dark"
            />
            <ElOption
              label="tooltip: light"
              value="light"
            />
          </ElSelect>
          <ElRadioGroup v-model="megaModeSwitchBehavior">
            <ElRadio value="warn">
              warn
            </ElRadio>
            <ElRadio value="error">
              error
            </ElRadio>
            <ElRadio value="silent">
              silent
            </ElRadio>
          </ElRadioGroup>
          <span style="font-size: 12px; color: #909399">modeSwitchBehavior</span>
        </div>

        <p style="font-size: 12px; color: #909399">
          说明：request 开关打开时 <code>request.source</code> 优先于 <code>data</code>（以分页切片返回当前数据集副本）；
          树形/展开行开关会整体切换面板数据集与列（关闭即恢复扁平数据）；行分组叠加在扁平数据上；
          urlState 已绑定但默认关闭（同页两表共用 URL key 会互踩）。
        </p>
        <p style="font-size: 12px; color: #909399">
          交互触发提示：单击/双击可编辑单元格（姓名/年龄/薪资列）→ cellEditingStarted / cellValueChanged / cellEditingStopped；
          表头拖动边界 → headerDragend；Shift+点击表头 → sortChange（多列上限 2）；
          列设置面板 → columnVisible / columnMoved；勾选行 → select / selectionChange / rowSelected；
          右键 → rowContextmenu / contextMenuClick；范围选择拖拽 → cellRangeSelected；
          工具栏导入确认后 → dataImport；编辑提交后 → modelUpdated；树/展开行点击 → rowExpand / rowCollapse；
          滚动 → scroll / endReached / rowsRendered（高频事件仅计数不进日志）。
          exportExcel / exportCsv / print / triggerImport 为暴露 API（非事件），undo/redo 走 Ctrl+Z / Ctrl+Shift+Z。
        </p>

        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式（6 个 v-model + 全 props + 全事件）</h4>
            <adv-table
              ref="megaRef"
              v-model:data="megaDataset"
              v-model:columns="megaColumns"
              v-model:loading="megaLoading"
              v-model:quick-filter="megaQuickFilter"
              v-model:search-values="megaSearchValues"
              v-model:selected-row-keys="megaSelectedRowKeys"
              mode="default"
              height="600px"
              v-bind="megaPropsLeft"
              v-on="megaEventHandlers"
            >
              <template
                v-if="megaExpandOn"
                #expandRow="{ row }: any"
              >
                <div style="padding: 8px 12px; font-size: 13px">
                  {{ row.orderNo }} · {{ row.customer }} · 状态 {{ row.status }} —— 展开行内容（触发 rowExpand / rowCollapse）
                </div>
              </template>
            </adv-table>
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式（同一份状态，单向绑定）</h4>
            <adv-table
              mode="virtual"
              :data="megaDataset"
              :columns="megaColumns"
              :loading="megaLoading"
              :quick-filter="megaQuickFilter"
              :search-values="megaSearchValues"
              :selected-row-keys="megaSelectedRowKeys"
              height="600px"
              v-bind="megaPropsRight"
              v-on="megaEventHandlers"
            >
              <template
                v-if="megaExpandOn"
                #expandRow="{ row }: any"
              >
                <div style="padding: 8px 12px; font-size: 13px">
                  {{ row.orderNo }} · {{ row.customer }} · 状态 {{ row.status }} —— 展开行内容（触发 rowExpand / rowCollapse）
                </div>
              </template>
            </adv-table>
          </div>
        </div>

        <div class="log-panel">
          <div class="log-header">
            <strong>事件覆盖：已触发 {{ megaTriggeredEventCount }}/{{ megaEventTotal }} · 日志 {{ megaEventLog.length }}/50</strong>
            <ElButton
              size="small"
              @click="megaClearLog()"
            >
              清空日志
            </ElButton>
          </div>
          <p
            v-if="megaUnfiredEvents.length"
            style="font-size: 12px; color: #909399"
          >
            未触发事件：<code>{{ megaUnfiredEvents.join('、') }}</code>
          </p>
          <p
            v-else
            style="font-size: 13px; color: #67c23a"
          >
            🎉 全部 53 个事件均已触发
          </p>
          <div class="log-content">
            <div
              v-for="(entry, i) in megaEventLog"
              :key="i"
              class="log-entry"
            >
              {{ entry }}
            </div>
            <div
              v-if="megaEventLog.length === 0"
              class="log-empty"
            >
              暂无事件日志（高频事件只计数：scroll / rowsRendered / cellMouseEnter / cellMouseLeave / 键盘三事件）
            </div>
          </div>
        </div>
      </div>

      <!-- 1. 基础展示 -->
      <div
        v-else-if="selectedDemo === 'basic'"
        class="demo-section"
      >
        <h1>1.1 基础用法</h1>
        <p>最简单的表格用法，展示基础列配置。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'valueType'"
        class="demo-section"
      >
        <h1>1.2 列类型展示</h1>
        <p>展示所有支持的 valueType 类型。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="allValueTypeData"
              :columns="allValueTypeColumns"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="allValueTypeData"
              :columns="allValueTypeColumns"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'group'"
        class="demo-section"
      >
        <h1>1.3 多级表头</h1>
        <p>支持多级表头分组。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="groupData"
              :columns="groupColumns"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="groupData"
              :columns="groupColumns"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'address'"
        class="demo-section"
      >
        <h1>1.4 三层嵌套+固定列</h1>
        <p>三层多级表头 + 右侧固定列（操作列双模式一致渲染）。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="addressData"
              :columns="addressColumns"
              :pagination="{ pageSize: 20, pageSizes: [10, 20, 50, 100] }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="addressData"
              :columns="addressColumns"
              :pagination="{ pageSize: 20, pageSizes: [10, 20, 50, 100] }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'option'"
        class="demo-section"
      >
        <h1>1.5 操作按钮列</h1>
        <p>Hover 显示操作按钮（Teleport 模式）。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="optionData"
              :columns="optionColumns"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="optionData"
              :columns="optionColumns"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'emptyTextDemo'"
        class="demo-section"
      >
        <h1>1.6 空数据提示</h1>
        <p>表格无数据时的空状态展示。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="[]"
              :columns="allValueTypeColumns.slice(0, 5)"
              height="300px"
            >
              <template #empty>
                <ElEmpty description="暂无数据" />
              </template>
            </adv-table>
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="[]"
              :columns="allValueTypeColumns.slice(0, 5)"
              height="300px"
            >
              <template #empty>
                <ElEmpty description="暂无数据" />
              </template>
            </adv-table>
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'emptyTextPropDemo'"
        class="demo-section"
      >
        <h1>1.6b 空数据提示 (emptyText prop)</h1>
        <p>使用 <code>emptyText</code> prop 设置空数据文本，比 slot 更轻量。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="[]"
              :columns="allValueTypeColumns.slice(0, 5)"
              empty-text="暂无员工数据，请先添加"
              height="300px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="[]"
              :columns="allValueTypeColumns.slice(0, 5)"
              empty-text="暂无员工数据，请先添加"
              height="300px"
            />
          </div>
        </div>
      </div>

      <!-- 1.7 表尾合计 -->
      <div
        v-else-if="selectedDemo === 'summary'"
        class="demo-section"
      >
        <h1>1.7 表尾合计 (summary)</h1>
        <p>通过 <code>ui-config</code> 传入 <code>showSummary: true</code> 与 <code>summaryMethod</code> 渲染表尾合计行。Virtual 模式下的表尾通过原生滚动容器与表体水平同步（见 <code>virtual-summary-footer.vue</code>）。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="filterSortData"
              :columns="filterSortColumns"
              :ui-config="{ showSummary: true, summaryMethod }"
              height="320px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="filterSortData"
              :columns="filterSortColumns"
              :ui-config="{ showSummary: true, summaryMethod }"
              height="320px"
            />
          </div>
        </div>
        <h3>含左/右固定列的合计</h3>
        <p>当列配置中同时存在左侧和右侧固定列时，表尾合计行也应正确对齐。下方演示包含左侧固定选择列 + 右侧固定操作列。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式（含左+右固定列）</h4>
            <adv-table
              mode="default"
              :data="filterSortData"
              :columns="[
                ...filterSortColumns.filter(c => c.selection).map(c => ({ ...c, fixed: 'left' })),
                ...filterSortColumns.filter(c => !c.selection && c.fixed !== 'right'),
                ...filterSortColumns.filter(c => c.fixed === 'right'),
              ]"
              :row-config="{ rowSelection: 'multiple' }"
              :ui-config="{ showSummary: true, summaryMethod }"
              height="320px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式（含左+右固定列）</h4>
            <adv-table
              mode="virtual"
              :data="filterSortData"
              :columns="[
                ...filterSortColumns.filter(c => c.selection).map(c => ({ ...c, fixed: 'left' })),
                ...filterSortColumns.filter(c => !c.selection && c.fixed !== 'right'),
                ...filterSortColumns.filter(c => c.fixed === 'right'),
              ]"
              :row-config="{ rowSelection: 'multiple' }"
              :ui-config="{ showSummary: true, summaryMethod }"
              height="320px"
            />
          </div>
        </div>
        <h3>Grand 总计行位置（AG Grid grandTotalRow）</h3>
        <p>通过 <code>ui-config.grandTotalRow</code> 切换总计行位置：<code>top</code> 首行、<code>bottom</code> 表尾、<code>pinnedTop</code>/<code>pinnedBottom</code> 固定顶/底（滚动始终可见）。<code>totalValueGetter</code> 自定义首列标签，<code>suppressStickyTotalRow</code> 取消粘性（降级为滚动行）。</p>
        <div style="margin-bottom: 10px">
          位置:
          <ElSelect
            v-model="grandTotalPosition"
            size="small"
            style="width: 150px"
          >
            <ElOption
              label="bottom（表尾）"
              value="bottom"
            />
            <ElOption
              label="top（首行）"
              value="top"
            />
            <ElOption
              label="pinnedTop（固定顶部）"
              value="pinnedTop"
            />
            <ElOption
              label="pinnedBottom（固定底部）"
              value="pinnedBottom"
            />
          </ElSelect>
          <span style="margin-left: 16px">粘性抑制:</span>
          <ElSelect
            v-model="totalStickySuppress"
            size="small"
            style="width: 130px; margin-left: 6px"
          >
            <ElOption
              label="默认粘性"
              :value="false"
            />
            <ElOption
              label="全部取消"
              :value="true"
            />
            <ElOption
              label="仅总计"
              value="grand"
            />
            <ElOption
              label="仅小计"
              value="group"
            />
          </ElSelect>
        </div>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="filterSortData"
              :columns="filterSortColumns"
              :ui-config="{ showSummary: true, grandTotalRow: grandTotalPosition, suppressStickyTotalRow: totalStickySuppress, totalValueGetter: totalLabelGetter }"
              height="320px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="filterSortData"
              :columns="filterSortColumns"
              :ui-config="{ showSummary: true, grandTotalRow: grandTotalPosition, suppressStickyTotalRow: totalStickySuppress, totalValueGetter: totalLabelGetter }"
              height="320px"
            />
          </div>
        </div>
        <h3>列聚合函数（aggFunc）</h3>
        <p>列级 <code>aggFunc</code> 声明归约方式：年龄 <code>avg</code>、薪资 <code>sum</code>、进度 <code>max</code>（另支持 <code>min</code>/<code>count</code>/<code>first</code>/<code>last</code>/自定义函数），未声明的数值列回退 <code>sum</code>。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="filterSortData"
              :columns="totalAggColumns"
              :ui-config="{ showSummary: true, sumText: '合计' }"
              height="320px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="filterSortData"
              :columns="totalAggColumns"
              :ui-config="{ showSummary: true, sumText: '合计' }"
              height="320px"
            />
          </div>
        </div>
        <h3>分组小计行（AG Grid groupTotalRow）</h3>
        <p>按部门分组，每组插入小计行（薪资 <code>sum</code> 聚合）。可切换小计位置、仅技术部选择性显示（回调返回 <code>undefined</code> 跳过）、保留组头聚合（<code>groupSuppressBlankHeader</code>，默认组头聚合置空避免与小计重复）。底部表尾同步显示 Grand 总计。</p>
        <div style="margin-bottom: 10px">
          小计位置:
          <ElSelect
            v-model="groupTotalPosition"
            size="small"
            style="width: 110px"
          >
            <ElOption
              label="bottom"
              value="bottom"
            />
            <ElOption
              label="top"
              value="top"
            />
          </ElSelect>
          <ElCheckbox
            v-model="selectiveGroupTotal"
            style="margin-left: 10px"
          >
            仅技术部显示小计（回调）
          </ElCheckbox>
          <ElCheckbox
            v-model="keepHeaderAgg"
            style="margin-left: 10px"
          >
            保留组头聚合
          </ElCheckbox>
        </div>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="rowGroupData"
              :columns="rowGroupTotalColumns"
              :row-group-config="{ field: 'department' }"
              :ui-config="{ grandTotalRow: 'bottom', groupTotalRow: selectiveGroupTotal ? selectiveGroupTotalFn : groupTotalPosition, groupSuppressBlankHeader: keepHeaderAgg, suppressStickyTotalRow: totalStickySuppress, totalValueGetter: totalLabelGetter }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="rowGroupData"
              :columns="rowGroupTotalColumns"
              :row-group-config="{ field: 'department' }"
              :ui-config="{ grandTotalRow: 'bottom', groupTotalRow: selectiveGroupTotal ? selectiveGroupTotalFn : groupTotalPosition, groupSuppressBlankHeader: keepHeaderAgg, suppressStickyTotalRow: totalStickySuppress, totalValueGetter: totalLabelGetter }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <!-- 2. 选择功能 -->
      <div
        v-else-if="selectedDemo === 'selection'"
        class="demo-section"
      >
        <h1>2.1 单选/多选</h1>
        <p>支持单选和多选模式。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式 - 多选</h4>
            <adv-table
              ref="selMultiRef"
              mode="default"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              :row-config="{ rowSelection: 'multiple' }"
              height="400px"
            />
            <ElButton
              style="margin-top: 10px"
              @click="handleShowSelection('多选', selMultiRef)"
            >
              获取选中行
            </ElButton>
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式 - 多选</h4>
            <adv-table
              ref="selMultiV2Ref"
              mode="virtual"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              :row-config="{ rowSelection: 'multiple' }"
              height="400px"
            />
            <ElButton
              style="margin-top: 10px"
              @click="handleShowSelection('多选', selMultiV2Ref)"
            >
              获取选中行
            </ElButton>
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'shiftClick'"
        class="demo-section"
      >
        <h1>2.2 Shift+Click 范围选择</h1>
        <p>按住 Shift 键点击可选择连续行范围。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="selShiftDefaultRef"
              mode="default"
              :data="filterSortData"
              :columns="filterSortColumns"
              :row-config="{ rowSelection: 'multiple' }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              ref="selShiftVirtualRef"
              mode="virtual"
              :data="filterSortData"
              :columns="filterSortColumns"
              :row-config="{ rowSelection: 'multiple' }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'rowMultiClick'"
        class="demo-section"
      >
        <h1>2.3 单击多选 (AG Grid 兼容)</h1>
        <p>单击行即可切换选中状态，无需按住 Ctrl。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="selMultiClickDefaultRef"
              mode="default"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              :row-config="{ rowSelection: 'multiple', rowMultiSelectWithClick: true }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              ref="selMultiClickVirtualRef"
              mode="virtual"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              :row-config="{ rowSelection: 'multiple', rowMultiSelectWithClick: true }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'rowClickSelectDemo'"
        class="demo-section"
      >
        <h1>2.4 行点击选择 (rowClickSelect)</h1>
        <p>点击行即可选中。通过 <code>:row-config="{ rowClickSelect: true }"</code> 启用，默认即为 true。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式 - 单选</h4>
            <adv-table
              ref="rowClickSelectTrueRef"
              mode="default"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              :row-config="{ rowSelection: 'single', rowClickSelect: true }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式 - 单选</h4>
            <adv-table
              ref="rowClickSelectFalseRef"
              mode="virtual"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              :row-config="{ rowSelection: 'single', rowClickSelect: true }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'cellRangeSelection'"
        class="demo-section"
      >
        <h1>2.5 单元格范围选择</h1>
        <p>鼠标拖拽选择单元格范围，支持复制。使用内置 <code>rangeSelection</code> prop 启用。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="cellRangeData"
              :columns="cellRangeColumns"
              range-selection
              height="400px"
              @cell-range-selected="(s: any) => cellRangeSelectionLog = `已选: ${s.startRow}-${s.endRow} 行, ${s.startCol}-${s.endCol} 列`"
            />
            <div
              v-if="cellRangeSelectionLog"
              style="margin-top: 10px"
            >
              {{ cellRangeSelectionLog }}
            </div>
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="cellRangeData"
              :columns="cellRangeColumns"
              range-selection
              height="400px"
            />
            <p style="margin-top: 10px; color: #909399">
              Virtual 模式下单元格范围选择功能受限
            </p>
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'highlightCurrentRowDemo'"
        class="demo-section"
      >
        <h1>2.6 单选高亮</h1>
        <p>点击行高亮显示当前选中行。Default 模式下高亮始终启用（renderer 内置），Virtual 模式暂不支持。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="basicData"
              :columns="highlightColumns"
              height="400px"
              @current-change="(payload: any) => highlightCurrentRow = payload.currentRow"
            />
            <div
              v-if="highlightCurrentRow"
              style="margin-top: 10px"
            >
              当前选中: {{ highlightCurrentRow.name }}
            </div>
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="basicData"
              :columns="highlightColumns"
              height="400px"
              @current-change="(payload: any) => highlightCurrentRowV2 = payload.currentRow"
            />
            <div
              v-if="highlightCurrentRowV2"
              style="margin-top: 10px"
            >
              当前选中: {{ highlightCurrentRowV2.name }}
            </div>
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'selectedRowKeysDemo'"
        class="demo-section"
      >
        <h1>2.7 受控选中 (selectedRowKeys)</h1>
        <p>通过 <code>selectedRowKeys</code> prop 受控管理选中行，适合需要从外部（如 URL、父组件）初始化选中状态的场景。<br>注意：行 id 5、8 已通过 <code>selectableFn</code> 设为不可选（disabled），设置选中时会自动过滤。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <div style="margin-bottom: 10px">
              <ElButton @click="selectedRowKeysValue = ['1', '3', '5']">
                受控选中 1,3,5
              </ElButton>
              <ElButton @click="selectedRowKeysValue = []">
                清空
              </ElButton>
              <ElButton @click="selectedRowKeysValue = ['2', '4', '6', '8']">
                受控选中 2,4,6,8
              </ElButton>
              <ElButton
                type="primary"
                @click="selectViaApi(selectedRowKeysRef, ['1', '3', '5'])"
              >
                API 选中 1,3,5
              </ElButton>
              <ElButton
                type="primary"
                @click="selectViaApi(selectedRowKeysRef, ['2', '4', '6', '8'])"
              >
                API 选中 2,4,6,8
              </ElButton>
            </div>
            <adv-table
              ref="selectedRowKeysRef"
              mode="default"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              :selected-row-keys="selectedRowKeysValue"
              :row-config="{ rowKey: 'id', rowSelection: 'multiple' }"
              height="400px"
            />
            <div style="margin-top: 10px; font-size: 12px; color: #606266">
              当前选中 keys: {{ selectedRowKeysValue.join(', ') || '无' }}<br>
              <span style="color: #909399">提示：行 5、8 为 disabled，受控设置时自动过滤不选中</span>
            </div>
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <div style="margin-bottom: 10px">
              <ElButton
                type="primary"
                @click="selectViaApi(selectedRowKeysV2Ref, ['1', '3', '5'])"
              >
                API 选中 1,3,5
              </ElButton>
              <ElButton
                type="primary"
                @click="selectViaApi(selectedRowKeysV2Ref, ['2', '4', '6', '8'])"
              >
                API 选中 2,4,6,8
              </ElButton>
            </div>
            <adv-table
              ref="selectedRowKeysV2Ref"
              mode="virtual"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              :selected-row-keys="selectedRowKeysValue"
              :row-config="{ rowKey: 'id', rowSelection: 'multiple' }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <!-- 3. 分页与数据 -->
      <div
        v-else-if="selectedDemo === 'pageClient'"
        class="demo-section"
      >
        <h1>3.1 客户端分页</h1>
        <p>数据在客户端进行分页处理。需显式配置 <code>pagination.mode: 'client'</code>（默认 <code>'page'</code> 为服务端分页语义，本地数据不会切片）。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="pageClientRef"
              mode="default"
              :data="pageData60"
              :columns="allValueTypeColumns.slice(0, 6)"
              :pagination="{ mode: 'client', pageSize: 10, pageSizes: [5, 10, 20] }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              ref="pageClientV2Ref"
              mode="virtual"
              :data="pageData60"
              :columns="allValueTypeColumns.slice(0, 6)"
              :pagination="{ mode: 'client', pageSize: 10, pageSizes: [5, 10, 20] }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'pageRemote'"
        class="demo-section"
      >
        <h1>3.2 远程分页</h1>
        <p>分页由后端处理，适合大数据量场景。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="pageRemoteRef"
              mode="default"
              :data="pageData100"
              :columns="allValueTypeColumns.slice(0, 6)"
              :pagination="{ pageSize: 10, total: 100 }"
              :request="{ source: mockPaginatedRequest }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="pageData100"
              :columns="allValueTypeColumns.slice(0, 6)"
              :pagination="{ pageSize: 10, total: 100 }"
              :request="{ source: mockPaginatedRequest }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'pageManual'"
        class="demo-section"
      >
        <h1>3.3 手动分页</h1>
        <p>手动控制分页逻辑：配置 <code>pagination.mode: 'manual'</code> 后底栏变为“加载更多”按钮，点击触发 <code>page-change</code> 事件，由父组件追加数据（表格不再自动切片/请求）。需同时传入 <code>total</code> 以便计算是否还有更多。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="pageManualRef"
              mode="default"
              :data="manualRows"
              :columns="allValueTypeColumns.slice(0, 6)"
              :pagination="{ mode: 'manual', pageSize: 10, total: 60 }"
              height="400px"
              @page-change="(page: number, size: number) => onManualPageChange('default', page, size)"
            />
            <p style="font-size:12px;color:#606266">
              已加载 {{ manualRows.length }} / 60 条
            </p>
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="manualRowsV2"
              :columns="allValueTypeColumns.slice(0, 6)"
              :pagination="{ mode: 'manual', pageSize: 10, total: 60 }"
              height="400px"
              @page-change="(page: number, size: number) => onManualPageChange('virtual', page, size)"
            />
            <p style="font-size:12px;color:#606266">
              已加载 {{ manualRowsV2.length }} / 60 条
            </p>
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'urlState'"
        class="demo-section"
      >
        <h1>3.4 URL State</h1>
        <p>将分页、排序、筛选状态同步到 URL。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="filterSortData"
              :columns="filterSortColumns"
              :pagination="{ pageSize: 10 }"
              :url-state="{ enabled: true }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="filterSortData"
              :columns="filterSortColumns"
              :pagination="{ pageSize: 10 }"
              :url-state="{ enabled: true }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'pollingDemo'"
        class="demo-section"
      >
        <h1>3.5 数据轮询</h1>
        <p>定时轮询更新数据。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="pollingRef"
              mode="default"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              :request="{ source: async () => ({ data: genData(10), total: 10 }) }"
              :toolbar="{ pollingBtn: true, pollingOptions: { time: 5000 } }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              :request="{ source: async () => ({ data: genData(10), total: 10 }) }"
              :toolbar="{ pollingBtn: true, pollingOptions: { time: 5000 } }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'loadingDemo'"
        class="demo-section"
      >
        <h1>3.6 加载状态</h1>
        <p>展示表格加载状态。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="loadingDemoRef"
              mode="default"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              loading
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              ref="loadingDemoV2Ref"
              mode="virtual"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              loading
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'vModelDemo'"
        class="demo-section"
      >
        <h1>3.7 v-model 双向绑定</h1>
        <p>支持 v-model 双向绑定数据：下方按钮经 <code>applyTransaction</code> 写入表格，绑定数组同步更新（见 JSON 回显）。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="vModelRef"
              v-model:data="vModelData"
              mode="default"
              :columns="allValueTypeColumns.slice(0, 6)"
              height="400px"
            />
            <div style="margin-top:8px;display:flex;gap:6px;align-items:center">
              <ElButton
                size="small"
                @click="vModelRef?.applyTransaction?.({ add: [{ id: `v-${Date.now()}`, name: '新增', age: 20 }] })"
              >
                添加一行
              </ElButton>
              <span style="font-size:12px;color:#606266">已绑定 {{ vModelData.length }} 条</span>
            </div>
            <pre style="font-size:11px;max-height:90px;overflow:auto">{{ JSON.stringify(vModelData.slice(0, 2)) }}</pre>
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              ref="vModelV2Ref"
              v-model:data="vModelDataV2"
              mode="virtual"
              :columns="allValueTypeColumns.slice(0, 6)"
              height="400px"
            />
            <div style="margin-top:8px;display:flex;gap:6px;align-items:center">
              <ElButton
                size="small"
                @click="vModelV2Ref?.applyTransaction?.({ add: [{ id: `v2-${Date.now()}`, name: '新增', age: 20 }] })"
              >
                添加一行
              </ElButton>
              <span style="font-size:12px;color:#606266">已绑定 {{ vModelDataV2.length }} 条</span>
            </div>
            <pre style="font-size:11px;max-height:90px;overflow:auto">{{ JSON.stringify(vModelDataV2.slice(0, 2)) }}</pre>
          </div>
        </div>
      </div>

      <!-- 4. 搜索与筛选 -->
      <div
        v-else-if="selectedDemo === 'search'"
        class="demo-section"
      >
        <h1>4.1 自定义搜索</h1>
        <p>自定义搜索字段和布局。搜索栏仅在 <code>search.enabled</code> 为 true（或列配置含 <code>search</code>）时渲染，此处显式开启。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="searchCustomRef"
              mode="default"
              :data="filterSortData"
              :columns="filterSortColumns"
              :search="{ enabled: true, fields: customSearchFields, components: customComponents }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="filterSortData"
              :columns="filterSortColumns"
              :search="{ enabled: true, fields: customSearchFields, components: customComponents }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'floatingFilter'"
        class="demo-section"
      >
        <h1>4.2 浮动筛选</h1>
        <p>列头内置浮动筛选器。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="floatingFilterRef"
              mode="default"
              :data="filterSortData"
              :columns="filterSortColumns"
              :filter-config="{ floatingFilter: true }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="filterSortData"
              :columns="filterSortColumns"
              :filter-config="{ floatingFilter: true }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'quickFilterDemo'"
        class="demo-section"
      >
        <h1>4.3 全局搜索 (quickFilter)</h1>
        <p>全局文本搜索过滤。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <ElInput
              v-model="quickFilterText"
              placeholder="输入搜索关键词..."
              clearable
              style="margin-bottom: 10px"
            />
            <adv-table
              ref="quickFilterRef"
              mode="default"
              :data="filterSortData"
              :columns="filterSortColumns"
              :quick-filter="quickFilterText"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="filterSortData"
              :columns="filterSortColumns"
              :quick-filter="quickFilterText"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'sidePanel'"
        class="demo-section"
      >
        <h1>4.4 侧边筛选面板</h1>
        <p>侧边栏形式的筛选面板。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="sidePanelRef"
              mode="default"
              :data="filterSortData"
              :columns="filterSortColumns"
              :filter-config="{ sidePanel: true }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="filterSortData"
              :columns="filterSortColumns"
              :filter-config="{ sidePanel: true }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'externalFilter'"
        class="demo-section"
      >
        <h1>4.5 外部筛选器</h1>
        <p>使用外部组件控制筛选。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <div style="margin-bottom: 10px">
              年龄筛选: >=
              <ElInputNumber
                v-model="filterAgeThreshold"
                :min="0"
                :max="100"
                size="small"
                style="width: 100px"
              />
            </div>
            <adv-table
              ref="externalFilterRef"
              mode="default"
              :data="filterSortData"
              :columns="filterSortColumns"
              :external-filter="{ isExternalFilterPresent: () => true, doesExternalFilterPass: (row: any) => row.age >= filterAgeThreshold }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="filterSortData"
              :columns="filterSortColumns"
              :external-filter="{ isExternalFilterPresent: () => true, doesExternalFilterPass: (row: any) => row.age >= filterAgeThreshold }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'suppressFloatingBtn'"
        class="demo-section"
      >
        <h1>4.6 隐藏浮动筛选按钮</h1>
        <p>禁用浮动筛选按钮显示。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="suppressFloatingBtnRef"
              mode="default"
              :data="filterSortData"
              :columns="filterSortColumns.map(c => ({ ...c, suppressFloatingFilterButton: true }))"
              :filter-config="{ floatingFilter: true }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="filterSortData"
              :columns="filterSortColumns.map(c => ({ ...c, suppressFloatingFilterButton: true }))"
              :filter-config="{ floatingFilter: true }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'searchValuesDemo'"
        class="demo-section"
      >
        <h1>4.7 搜索值响应式</h1>
        <p>搜索值双向绑定。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="searchValuesRef"
              v-model:search-values="searchValuesModel"
              mode="default"
              :data="filterSortData"
              :columns="searchValuesColumns"
              height="400px"
            />
            <div style="margin-top: 10px">
              当前搜索值: {{ JSON.stringify(searchValuesModel) }}
            </div>
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              v-model:search-values="searchValuesModel"
              mode="virtual"
              :data="filterSortData"
              :columns="searchValuesColumns"
              height="400px"
            />
          </div>
        </div>
      </div>

      <!-- 5. 排序与拖拽 -->
      <div
        v-else-if="selectedDemo === 'filterSort'"
        class="demo-section"
      >
        <h1>5.1 列筛选+排序</h1>
        <p>列头筛选和排序功能。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="filterSortRef"
              mode="default"
              :data="filterSortData"
              :columns="filterSortColumns"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              ref="filterSortV2Ref"
              mode="virtual"
              :data="filterSortData"
              :columns="filterSortColumns"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'manualSort'"
        class="demo-section"
      >
        <h1>5.2 手动触发排序 (API)</h1>
        <p>通过 API 手动控制排序。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <div style="margin-bottom: 10px">
              <ElButton @click="manualSortRef?.setSort?.('age', 'ascending')">
                按年龄升序
              </ElButton>
              <ElButton @click="manualSortRef?.setSort?.('salary', 'descending')">
                按薪资降序
              </ElButton>
              <ElButton @click="manualSortRef?.clearSort?.()">
                清除排序
              </ElButton>
            </div>
            <adv-table
              ref="manualSortRef"
              mode="default"
              :data="filterSortData"
              :columns="filterSortColumns"
              height="400px"
            />
            <div style="margin-top: 10px">
              当前排序: {{ manualSortLog }}
            </div>
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <div style="margin-bottom: 10px">
              <ElButton @click="manualSortV2Ref?.setSort?.('age', 'ascending')">
                按年龄升序
              </ElButton>
              <ElButton @click="manualSortV2Ref?.setSort?.('salary', 'descending')">
                按薪资降序
              </ElButton>
              <ElButton @click="manualSortV2Ref?.clearSort?.()">
                清除排序
              </ElButton>
            </div>
            <adv-table
              ref="manualSortV2Ref"
              mode="virtual"
              :data="filterSortData"
              :columns="filterSortColumns"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'drag'"
        class="demo-section"
      >
        <h1>5.3 行拖拽</h1>
        <p>拖拽行进行排序。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="dragRef"
              v-model:data="dragData"
              mode="default"
              :columns="dragColumns"
              :row-config="{ rowDraggable: true, rowDragHandle: '.drag-handle' }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              ref="dragV2Ref"
              v-model:data="dragDataV2"
              mode="virtual"
              :columns="dragColumns"
              :row-config="{ rowDraggable: true, rowDragHandle: '.drag-handle' }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'columnDrag'"
        class="demo-section"
      >
        <h1>5.4 列拖拽排序</h1>
        <p>拖拽列头调整列顺序。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="columnDragData"
              :columns="columnDragColumns"
              :column-config="{ columnDraggable: true }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="columnDragDataV2"
              :columns="columnDragColumns"
              :column-config="{ columnDraggable: true }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'dragEventDemo'"
        class="demo-section"
      >
        <h1>5.5 拖拽事件</h1>
        <p>监听拖拽相关事件。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="dragEventRef"
              v-model:data="dragEventData"
              mode="default"
              :columns="dragColumns"
              :row-config="{ rowDraggable: true, rowDragHandle: '.drag-handle' }"
              height="400px"
              @row-drag-start="(e: any) => dragEventLog.push(`开始拖拽: ${e.sourceRow.name}`)"
              @row-drag-end="(e: any) => dragEventLog.push(`结束拖拽: ${e.sourceRow.name} → ${e.targetRow?.name ?? '末尾'}`)"
            />
            <div style="margin-top: 10px; max-height: 100px; overflow-y: auto">
              <div
                v-for="(log, i) in dragEventLog"
                :key="i"
                style="font-size: 12px; color: #606266"
              >
                {{ log }}
              </div>
            </div>
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              ref="dragEventV2Ref"
              v-model:data="dragEventV2Data"
              mode="virtual"
              :columns="dragColumns"
              :row-config="{ rowDraggable: true, rowDragHandle: '.drag-handle' }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <!-- 6. 编辑功能 -->
      <div
        v-else-if="selectedDemo === 'editDefault'"
        class="demo-section"
      >
        <h1>6.1 单元格编辑</h1>
        <p>点击单元格进入编辑模式。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="editRef"
              v-model:data="editData"
              mode="default"
              :columns="editColumns"
              :edit-config="{}"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              ref="editV2Ref"
              :data="editData"
              mode="virtual"
              :columns="editColumns"
              :edit-config="{}"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'fullRowEdit'"
        class="demo-section"
      >
        <h1>6.2 全行编辑</h1>
        <p>整行同时进入编辑模式。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="fullRowEditRef"
              v-model:data="editData"
              mode="default"
              :columns="editColumns"
              :edit-config="{ editType: 'fullRow' }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              :data="editData"
              mode="virtual"
              :columns="editColumns"
              :edit-config="{ editType: 'fullRow' }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'batchEdit'"
        class="demo-section"
      >
        <h1>6.3 批量编辑</h1>
        <p>选中多行后批量编辑。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="batchEditRef"
              v-model:data="batchEditData"
              mode="default"
              :columns="editColumns"
              :edit-config="{ editType: 'batch' }"
              :row-config="{ rowSelection: 'multiple' }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              :data="batchEditData"
              mode="virtual"
              :columns="editColumns"
              :edit-config="{ editType: 'batch' }"
              :row-config="{ rowSelection: 'multiple' }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'readOnlyEdit'"
        class="demo-section"
      >
        <h1>6.4 只读编辑</h1>
        <p>编辑请求拦截，可审批编辑操作。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="readOnlyEditRef"
              mode="default"
              :data="editData"
              :columns="editColumns"
              :edit-config="{ editType: 'readOnly' }"
              height="400px"
            />
            <div style="margin-top: 10px; font-size: 12px; color: #606266">
              {{ readOnlyEditLog }}
            </div>
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="editData"
              :columns="editColumns"
              :edit-config="{ editType: 'readOnly' }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'tabEnterNav'"
        class="demo-section"
      >
        <h1>6.5 Tab/Enter 编辑导航</h1>
        <p>使用 Tab 和 Enter 键在单元格间导航。需要配置 <code>tabToNextCell</code> 和 <code>enterMovesDownAfterEdit</code>。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              v-model:data="editData"
              mode="default"
              :columns="tabEnterNavColumns"
              :edit-config="{ tabToNextCell: true, enterMovesDownAfterEdit: true }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              :data="editData"
              mode="virtual"
              :columns="tabEnterNavColumns"
              :edit-config="{ tabToNextCell: true, enterMovesDownAfterEdit: true }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'dynamicEditorParams'"
        class="demo-section"
      >
        <h1>6.6 动态编辑器参数</h1>
        <p>根据行数据动态配置编辑器参数。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              v-model:data="dynamicParamsData"
              mode="default"
              :columns="dynamicParamsColumns"
              :edit-config="{}"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              :data="dynamicParamsData"
              mode="virtual"
              :columns="dynamicParamsColumns"
              :edit-config="{}"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'activeMethodDemo'"
        class="demo-section"
      >
        <h1>6.7 编辑激活条件</h1>
        <p>根据条件控制是否允许编辑。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="activeMethodData"
              :columns="activeMethodColumns"
              :edit-config="{ activeMethod: (params: any) => params.row.status !== 'inactive' }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="activeMethodData"
              :columns="activeMethodColumns"
              :edit-config="{ activeMethod: (params: any) => params.row.status !== 'inactive' }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'stopEditingWhenCellsLoseFocus'"
        class="demo-section"
      >
        <h1>6.8 失焦结束编辑</h1>
        <p>单元格失去焦点时自动结束编辑。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              v-model:data="loseFocusData"
              mode="default"
              :columns="loseFocusColumns"
              :edit-config="{ stopEditingWhenCellsLoseFocus: true }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              :data="loseFocusData"
              mode="virtual"
              :columns="loseFocusColumns"
              :edit-config="{ stopEditingWhenCellsLoseFocus: true }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'cellEditorPopupDemo'"
        class="demo-section"
      >
        <h1>6.9 弹窗编辑器</h1>
        <p>使用弹窗形式编辑单元格。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="popupEditData"
              :columns="editColumns.map(c => ({ ...c, cellEditorPopup: true }))"
              :edit-config="{}"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="popupEditData"
              :columns="editColumns.map(c => ({ ...c, cellEditorPopup: true }))"
              :edit-config="{}"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'popupPositionDemo'"
        class="demo-section"
      >
        <h1>6.10 弹窗位置</h1>
        <p>控制弹窗编辑器的显示位置。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="popupPositionData"
              :columns="editColumns.map(c => ({ ...c, cellEditorPopup: { position: 'bottom' } }))"
              :edit-config="{}"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="popupPositionData"
              :columns="editColumns.map(c => ({ ...c, cellEditorPopup: { position: 'bottom' } }))"
              :edit-config="{}"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'cellEditorSelectorDemo'"
        class="demo-section"
      >
        <h1>6.11 动态编辑器选择</h1>
        <p>根据行数据动态选择编辑器类型。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="selectorData"
              :columns="editColumns"
              :edit-config="{}"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="selectorData"
              :columns="editColumns"
              :edit-config="{}"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'f2BackspaceDemo'"
        class="demo-section"
      >
        <h1>6.12 F2/Backspace 键盘触发</h1>
        <p>使用 F2 进入编辑，Backspace 清空并编辑。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="f2BackspaceData"
              :columns="f2BackspaceColumns"
              :edit-config="{}"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="f2BackspaceData"
              :columns="f2BackspaceColumns"
              :edit-config="{}"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'clipboardDemo'"
        class="demo-section"
      >
        <h1>6.13 剪贴板集成</h1>
        <p>支持从 Excel 粘贴数据。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="clipboardData"
              :columns="clipboardColumns"
              :edit-config="{}"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="clipboardData"
              :columns="clipboardColumns"
              :edit-config="{}"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'showStatusDemo'"
        class="demo-section"
      >
        <h1>6.14 编辑状态视觉标记</h1>
        <p>显示单元格编辑状态标记。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="showStatusData"
              :columns="showStatusColumns"
              :edit-config="{ showStatus: true }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="showStatusData"
              :columns="showStatusColumns"
              :edit-config="{ showStatus: true }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'editorLifecycleDemo'"
        class="demo-section"
      >
        <h1>6.15 编辑器生命周期</h1>
        <p>监听编辑器生命周期事件。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="lifecycleData"
              :columns="lifecycleColumns"
              :edit-config="{}"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="lifecycleData"
              :columns="lifecycleColumns"
              :edit-config="{}"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'multiSelectEditorDemo'"
        class="demo-section"
      >
        <h1>6.16 多选编辑器</h1>
        <p>支持多选下拉编辑器。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="multiSelectData"
              :columns="multiSelectColumns"
              :edit-config="{}"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="multiSelectData"
              :columns="multiSelectColumns"
              :edit-config="{}"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'p2EnhancedDemo'"
        class="demo-section"
      >
        <h1>6.17 P2 功能增强 (undo/guard)</h1>
        <p>撤销/重做、编辑守卫功能。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <div style="margin-bottom: 10px">
              <ElButton @click="p2Undo">
                撤销
              </ElButton>
              <ElButton @click="p2Redo">
                重做
              </ElButton>
              <ElButton @click="p2CheckUnsaved">
                检查未保存
              </ElButton>
            </div>
            <adv-table
              ref="p2TableRef"
              mode="default"
              :data="p2EnhancedData"
              :columns="editColumns"
              :edit-config="{}"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              ref="p2TableV2Ref"
              mode="virtual"
              :data="p2EnhancedData"
              :columns="editColumns"
              :edit-config="{}"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'cellEditLifecycleDemo'"
        class="demo-section"
      >
        <h1>6.18 编辑开始/结束事件</h1>
        <p>监听编辑开始和结束事件。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="cellEditLifecycleRef"
              mode="default"
              :data="editData"
              :columns="editColumns"
              :edit-config="{}"
              height="400px"
              @cell-editing-started="(e: any) => cellEditLifecycleLog.push(`开始编辑: ${e.prop}`)"
              @cell-editing-stopped="(e: any) => cellEditLifecycleLog.push(`结束编辑: ${e.prop}, 值: ${e.newValue}`)"
            />
            <div style="margin-top: 10px; max-height: 100px; overflow-y: auto; font-size: 12px">
              <div
                v-for="(log, i) in cellEditLifecycleLog.slice(-5)"
                :key="i"
              >
                {{ log }}
              </div>
            </div>
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              ref="cellEditLifecycleV2Ref"
              mode="virtual"
              :data="editData"
              :columns="editColumns"
              :edit-config="{}"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'cellKeyboardDemo'"
        class="demo-section"
      >
        <h1>6.19 单元格键盘事件</h1>
        <p>监听单元格键盘事件。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="cellKeyboardRef"
              mode="default"
              :data="editData"
              :columns="cellKeyboardColumns"
              :edit-config="{}"
              height="400px"
              @cell-keydown="(e: any) => cellKeyboardLog.push(`按键: ${e.event.key}`)"
            />
            <div style="margin-top: 10px; font-size: 12px">
              最近按键: {{ cellKeyboardLog.slice(-1)[0] || '无' }}
            </div>
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="editData"
              :columns="cellKeyboardColumns"
              :edit-config="{}"
              height="400px"
            />
          </div>
        </div>
      </div>

      <!-- 7. 数据校验 -->
      <div
        v-else-if="selectedDemo === 'validate'"
        class="demo-section"
      >
        <h1>7.1 数据校验 (editorRules)</h1>
        <p>使用 editorRules 进行数据校验。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <div style="margin-bottom: 10px">
              <ElButton
                type="primary"
                @click="validateRef?.validate?.()"
              >
                校验全部
              </ElButton>
              <ElButton @click="validateRef?.clearValidate?.()">
                清除校验
              </ElButton>
            </div>
            <adv-table
              ref="validateRef"
              mode="default"
              :data="validateData"
              :columns="validateColumns"
              :edit-config="{}"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <div style="margin-bottom: 10px">
              <ElButton
                type="primary"
                @click="validateFullRowRef?.validate?.()"
              >
                校验全部
              </ElButton>
            </div>
            <adv-table
              ref="validateFullRowRef"
              mode="virtual"
              :data="validateData"
              :columns="validateColumns"
              :edit-config="{}"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'validateMode'"
        class="demo-section"
      >
        <h1>7.2 校验模式 (invalidEditValueMode)</h1>
        <p>控制校验失败时的行为。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <div style="margin-bottom: 10px">
              校验模式:
              <ElSelect
                v-model="validateModeType"
                size="small"
                style="width: 120px"
              >
                <ElOption
                  label="还原"
                  value="revert"
                />
                <ElOption
                  label="阻止"
                  value="block"
                />
                <ElOption
                  label="通知"
                  value="notify"
                />
              </ElSelect>
            </div>
            <adv-table
              ref="validateModeRef"
              mode="default"
              :data="validateData"
              :columns="validateModeColumns"
              :edit-config="{ invalidEditValueMode: validateModeType }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="validateData"
              :columns="validateModeColumns"
              :edit-config="{ invalidEditValueMode: validateModeType }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'crossValidate'"
        class="demo-section"
      >
        <h1>7.3 跨字段校验</h1>
        <p>跨字段联动校验。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="crossValidateRef"
              mode="default"
              :data="orderData"
              :columns="orderColumns"
              :edit-config="{}"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="orderData"
              :columns="orderColumns"
              :edit-config="{}"
              height="400px"
            />
          </div>
        </div>
      </div>

      <!-- 8. 列管理 -->
      <div
        v-else-if="selectedDemo === 'columnResize'"
        class="demo-section"
      >
        <h1>8.1 列宽拖拽</h1>
        <p>拖拽列边框调整列宽。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="resizeRef"
              mode="default"
              :data="basicData"
              :columns="resizeCols"
              resizable
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              ref="resizeV2Ref"
              mode="virtual"
              :data="basicData"
              :columns="resizeCols"
              resizable
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'borderResizable'"
        class="demo-section"
      >
        <h1>8.2 外边框与列宽拖拽</h1>
        <p>同时启用外边框和列宽拖拽。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="basicData"
              :columns="resizeCols"
              :border="borderOn"
              :resizable="resizableOn"
              height="400px"
            />
            <div style="margin-top: 10px">
              <ElCheckbox v-model="borderOn">
                显示边框
              </ElCheckbox>
              <ElCheckbox v-model="resizableOn">
                允许拖拽
              </ElCheckbox>
            </div>
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="basicData"
              :columns="resizeCols"
              :border="borderOn"
              :resizable="resizableOn"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'columnStateDemo'"
        class="demo-section"
      >
        <h1>8.3 列状态持久化</h1>
        <p>保存和恢复列状态（宽度、顺序、显示）。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="columnStateRef"
              mode="default"
              :data="columnStateData"
              :columns="columnStateColumns"
              :column-state="{ enabled: true, storageKey: 'demo-column-state' }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="columnStateData"
              :columns="columnStateColumns"
              :column-state="{ enabled: true, storageKey: 'demo-column-state-v2' }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'columnGroupDemo'"
        class="demo-section"
      >
        <h1>8.4 列组管理</h1>
        <p>列分组显示/隐藏管理。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="filterSortData"
              :columns="filterSortColumns"
              :column-config="{ columnGroup: { enabled: true } }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="filterSortData"
              :columns="filterSortColumns"
              :column-config="{ columnGroup: { enabled: true } }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'defaultColDef'"
        class="demo-section"
      >
        <h1>8.5 defaultColDef / columnTypes</h1>
        <p>默认列配置和列类型预设。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="defaultColDefRef"
              mode="default"
              :data="basicData"
              :columns="defaultColDefColumns"
              :column-config="{ defaultColDef: { width: 120 }, columnTypes: { center: { align: 'center' }, money: { valueType: 'money', align: 'right', width: 100 } } }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="basicData"
              :columns="defaultColDefColumns"
              :column-config="{ defaultColDef: { width: 120 }, columnTypes: { center: { align: 'center' }, money: { valueType: 'money', align: 'right', width: 100 } } }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'columnPresets'"
        class="demo-section"
      >
        <h1>8.6 内置列类型预设</h1>
        <p>使用内置列类型快速配置。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="columnPresetsRef"
              mode="default"
              :data="basicData"
              :columns="presetColumns"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="basicData"
              :columns="presetColumns"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'columnEventDemo'"
        class="demo-section"
      >
        <h1>8.7 列事件</h1>
        <p>监听列相关事件。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="columnEventRef"
              mode="default"
              :data="basicData"
              :columns="resizeCols"
              resizable
              height="400px"
              @header-dragend="(e: any) => columnEventLog.push(`列宽调整: ${e.column?.prop ?? '?'} -> ${e.newWidth}px`)"
            />
            <div style="margin-top: 10px; max-height: 100px; overflow-y: auto; font-size: 12px">
              <div
                v-for="(log, i) in columnEventLog.slice(-5)"
                :key="i"
              >
                {{ log }}
              </div>
            </div>
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              ref="columnEventV2Ref"
              mode="virtual"
              :data="basicData"
              :columns="resizeCols"
              resizable
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'sizeConfig'"
        class="demo-section"
      >
        <h1>8.8 尺寸自定义 (sizeConfig)</h1>
        <p>通过 <code>ui-config.size</code> 切换内置尺寸预设（large / default / small），或通过 <code>ui-config.sizeConfig</code> 覆盖个别尺寸值（headerCellHeight、cellPadding、rowHeight 等）。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <div style="margin-bottom: 10px">
              尺寸预设:
              <ElSelect
                v-model="sizeConfigPreset"
                size="small"
                style="width: 120px"
              >
                <ElOption
                  label="Large"
                  value="large"
                />
                <ElOption
                  label="Default"
                  value="default"
                />
                <ElOption
                  label="Small"
                  value="small"
                />
                <ElOption
                  label="Custom"
                  value="custom"
                />
              </ElSelect>
            </div>
            <adv-table
              mode="default"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              :ui-config="{ size: sizeConfigPreset !== 'custom' ? sizeConfigPreset : undefined, sizeConfig: sizeConfigValue }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              :ui-config="{ size: sizeConfigPreset !== 'custom' ? sizeConfigPreset : undefined, sizeConfig: sizeConfigValue }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <!-- 9. 树形与分组 -->
      <div
        v-else-if="selectedDemo === 'treeDemo'"
        class="demo-section"
      >
        <h1>9.1 树形数据 (treeConfig)</h1>
        <p>展示树形层级数据。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="treeRef"
              mode="default"
              :data="treeData"
              :columns="treeColumns"
              :tree-config="treeConfigExpandAll"
              :row-config="{ rowKey: 'id' }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="treeData"
              :columns="treeColumns"
              :tree-config="treeConfigExpandAll"
              :row-config="{ rowKey: 'id' }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'treeSelectionDemo'"
        class="demo-section"
      >
        <h1>9.2 树形选择</h1>
        <p>树形数据的选择联动。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <div style="margin-bottom: 10px">
              <ElCheckbox v-model="treeSelectionStrictly">
                父子不联动
              </ElCheckbox>
            </div>
            <adv-table
              ref="treeSelectionRef"
              mode="default"
              :data="treeData"
              :columns="treeSelectionColumns"
              :tree-config="treeSelectionConfig"
              :row-config="{ rowKey: 'id', rowSelection: 'multiple' }"
              height="400px"
            />
            <div style="margin-top: 10px">
              选中 keys: {{ treeSelectionSelectedKeys.join(', ') || '无' }}
            </div>
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="treeData"
              :columns="treeSelectionColumns"
              :tree-config="treeSelectionConfig"
              :row-config="{ rowKey: 'id', rowSelection: 'multiple' }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'asyncTreeDemo'"
        class="demo-section"
      >
        <h1>9.3 异步树形数据 (loadData)</h1>
        <p>演示异步加载子节点数据。展开节点时动态加载子级数据。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="asyncTreeData"
              :columns="treeColumns"
              :tree-config="{ children: 'children', defaultExpandAll: false, loadData: loadTreeData }"
              :row-config="{ rowKey: 'id' }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="asyncTreeData"
              :columns="treeColumns"
              :tree-config="{ children: 'children', defaultExpandAll: false, loadData: loadTreeData }"
              :row-config="{ rowKey: 'id' }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'rowGroupDemo'"
        class="demo-section"
      >
        <h1>9.4 行分组 (rowGroupConfig)</h1>
        <p>按字段分组显示数据。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <div style="margin-bottom: 10px">
              分组字段:
              <ElSelect
                v-model="rowGroupField"
                size="small"
                style="width: 120px"
              >
                <ElOption
                  label="部门"
                  value="department"
                />
                <ElOption
                  label="角色"
                  value="role"
                />
                <ElOption
                  label="城市"
                  value="city"
                />
              </ElSelect>
              <ElCheckbox
                v-model="rowGroupDefaultExpandAll"
                style="margin-left: 10px"
              >
                默认展开
              </ElCheckbox>
            </div>
            <adv-table
              ref="rowGroupRef"
              mode="default"
              :data="rowGroupData"
              :columns="rowGroupColumns"
              :row-group-config="rowGroupConfig"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="rowGroupData"
              :columns="rowGroupColumns"
              :row-group-config="rowGroupConfig"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'rowExpandDemo'"
        class="demo-section"
      >
        <h1>9.5 主/明细视图 (rowExpandConfig)</h1>
        <p>展开行显示详细信息（双模式均渲染订单明细嵌套表）。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <div style="margin-bottom: 10px">
              <ElCheckbox v-model="rowExpandAccordion">
                手风琴模式
              </ElCheckbox>
            </div>
            <adv-table
              ref="rowExpandRef"
              mode="default"
              :data="rowExpandData"
              :columns="rowExpandColumns"
              :row-config="{ rowKey: 'id' }"
              :row-expand-config="rowExpandConfig"
              height="400px"
            >
              <template #expandRow="{ row }">
                <div style="padding: 10px">
                  <h4>订单明细 - {{ row.orderNo }}</h4>
                  <adv-table
                    mode="default"
                    :data="orderDetailsMap[row.id] || []"
                    :columns="rowExpandDetailColumns"
                    height="150px"
                  />
                </div>
              </template>
            </adv-table>
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="rowExpandData"
              :columns="rowExpandColumns"
              :row-config="{ rowKey: 'id' }"
              :row-expand-config="rowExpandConfig"
              height="400px"
            >
              <template #expandRow="{ row }">
                <div style="padding: 10px">
                  <h4>订单明细 - {{ row.orderNo }}</h4>
                  <adv-table
                    mode="default"
                    :data="orderDetailsMap[row.id] || []"
                    :columns="rowExpandDetailColumns"
                    height="150px"
                  />
                </div>
              </template>
            </adv-table>
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'treeRequestDemo'"
        class="demo-section"
      >
        <h1>9.6 树形数据 (request 数据源)</h1>
        <p>与 9.1 的对照：数据源不使用 <code>:data</code>，而是通过 <code>:request="{ source: mockTreeRequest }"</code> 请求获取。配合 <code>:pagination="{ enabled: false }"</code> 走 simple 请求模式，一次拉取整棵子树。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :request="{ source: mockTreeRequest }"
              :pagination="{ enabled: false }"
              :columns="treeColumns"
              :tree-config="treeConfigExpandAll"
              :row-config="{ rowKey: 'id' }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :request="{ source: mockTreeRequest }"
              :pagination="{ enabled: false }"
              :columns="treeColumns"
              :tree-config="treeConfigExpandAll"
              :row-config="{ rowKey: 'id' }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <!-- 10. 高级功能 -->
      <div
        v-else-if="selectedDemo === 'events'"
        class="demo-section"
      >
        <h1>10.1 事件监听</h1>
        <p>监听表格各种事件。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              height="400px"
              @row-click="(params: any) => console.log('行点击:', params.rowData.name)"
              @selection-change="(rows: any) => console.log('选择变化:', rows.length)"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              height="400px"
              @row-click="(params: any) => console.log('行点击:', params.rowData.name)"
              @selection-change="(rows: any) => console.log('选择变化:', rows.length)"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'contextMenu'"
        class="demo-section"
      >
        <h1>10.2 右键菜单 (menuConfig)</h1>
        <p>右键点击表格区域弹出菜单。支持内置菜单项（复制、排序、导出等）和自定义菜单项。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="contextMenuRef"
              mode="default"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              :menu-config="{
                body: {
                  enabled: true,
                  options: [
                    ['copyCell', 'copyRow', 'copySelectedRows'],
                    ['clearCell', 'editCell'],
                    ['autoSizeThisColumn', 'autoSizeAllColumns'],
                    ['clearSort', 'clearAllFilters'],
                    ['exportCsv', 'print'],
                  ],
                },
              }"
              height="400px"
              @context-menu-click="(e: any) => contextMenuLog = `菜单: ${e.menu?.code ?? 'unknown'}`"
            />
            <div
              v-if="contextMenuLog"
              style="margin-top: 10px"
            >
              {{ contextMenuLog }}
            </div>
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              :menu-config="{
                body: {
                  enabled: true,
                  options: [
                    ['copyCell', 'copyRow', 'copySelectedRows'],
                    ['clearCell', 'editCell'],
                    ['autoSizeThisColumn', 'autoSizeAllColumns'],
                    ['clearSort', 'clearAllFilters'],
                    ['exportCsv', 'print'],
                  ],
                },
              }"
              height="400px"
              @context-menu-click="(e: any) => contextMenuLog = `菜单: ${e.menu?.code ?? 'unknown'}`"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'interceptor'"
        class="demo-section"
      >
        <h1>10.3 事件拦截器</h1>
        <p>拦截和修改表格事件。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="interceptorRef"
              mode="default"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              :interceptor="{ 'event.rowClick': () => { interceptorLog = '行点击被拦截'; return false } }"
              height="400px"
            />
            <div
              v-if="interceptorLog"
              style="margin-top: 10px"
            >
              {{ interceptorLog }}
            </div>
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              :interceptor="{ 'event.rowClick': () => { interceptorLog = '行点击被拦截'; return false } }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'teleportHoverDemo'"
        class="demo-section"
      >
        <h1>10.4 Teleport 悬浮操作</h1>
        <p>操作按钮悬浮在行上方。层级基线：行内悬浮条 3001 ＞ 右键菜单 3000 ＞ Teleport 悬浮（默认 2000，随 El 弹层）＞ 筛选 popover（El 默认）；调低 zIndex 可能沉到固定列/表头之下。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="basicData"
              :columns="teleportHoverColumns"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="basicData"
              :columns="teleportHoverColumns"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'teleportAutoDemo'"
        class="demo-section"
      >
        <h1>10.5 Teleport Auto 模式</h1>
        <p>对比 <code>hoverActions.teleport</code> 三种策略：auto（自动判断）、true（强制 Teleport）。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式 - teleport: auto（无固定列）</h4>
            <adv-table
              mode="default"
              :data="basicData"
              :columns="teleportAutoColsNoFixed"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式 - teleport: auto（有固定列）</h4>
            <adv-table
              mode="virtual"
              :data="basicData"
              :columns="teleportAutoColsWithFixed"
              height="400px"
            />
          </div>
        </div>
        <div
          class="mode-panel"
          style="margin-top: 20px"
        >
          <h4>Virtual 模式 - teleport: true（强制 Teleport，有固定列）</h4>
          <adv-table
            mode="virtual"
            :data="basicData"
            :columns="teleportAutoColsAlwaysTeleport"
            height="400px"
          />
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'merge'"
        class="demo-section"
      >
        <h1>10.6 单元格合并</h1>
        <p>行合并和列合并：左表展示行合并，右表展示列合并（行列合并能力双模式均可使用）。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式 - 行合并</h4>
            <adv-table
              ref="mergeRef"
              mode="default"
              :data="mergeData"
              :columns="mergeColumns"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式 - 列合并</h4>
            <adv-table
              ref="colMergeRef"
              mode="virtual"
              :data="colMergeData"
              :columns="colMergeColumns"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'spanMethodDemo'"
        class="demo-section"
      >
        <h1>10.7 声明式单元格合并 (spanRows / colSpan)</h1>
        <p>通过列级 <code>spanRows</code>（行合并）和 <code>colSpan</code>（列合并）声明式配置合并规则。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式 - spanRows 行合并</h4>
            <adv-table
              ref="spanMethodRef"
              mode="default"
              :data="mergeData"
              :columns="mergeColumns"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式 - colSpan 列合并</h4>
            <adv-table
              ref="spanMethodV2Ref"
              mode="virtual"
              :data="colMergeData"
              :columns="colMergeColumns"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'spanConfigDemo'"
        class="demo-section"
      >
        <h1>10.7b 声明式合并配置 (spanConfig)</h1>
        <p>通过表格级 <code>spanConfig</code> prop 统一配置行/列合并规则，支持扁平简写和完整配置两种形式。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式 — 扁平简写</h4>
            <adv-table
              mode="default"
              :data="mergeData"
              :columns="mergeColumns"
              :span-config="{ department: true, team: true, role: true }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式 — 完整配置</h4>
            <adv-table
              mode="virtual"
              :data="mergeData"
              :columns="mergeColumns"
              :span-config="{ rows: { department: true, team: true }, cols: { id: true } }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'rowClassNameTooltipDemo'"
        class="demo-section"
      >
        <h1>10.8 行样式 + Tooltip 自定义</h1>
        <p>自定义行样式和溢出 Tooltip。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <div style="margin-bottom: 10px">
              Tooltip 效果:
              <ElSelect
                v-model="rowClassNameTooltipEffect"
                size="small"
                style="width: 100px"
              >
                <ElOption
                  label="Dark"
                  value="dark"
                />
                <ElOption
                  label="Light"
                  value="light"
                />
              </ElSelect>
            </div>
            <adv-table
              mode="default"
              :data="rowClassNameData"
              :columns="rowClassNameColumns"
              :row-class-name="rowClassNameFn"
              :tooltip-effect="rowClassNameTooltipEffect"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <div style="margin-bottom: 10px">
              Tooltip 效果:
              <ElSelect
                v-model="rowClassNameTooltipEffect"
                size="small"
                style="width: 100px"
              >
                <ElOption
                  label="Dark"
                  value="dark"
                />
                <ElOption
                  label="Light"
                  value="light"
                />
              </ElSelect>
            </div>
            <adv-table
              mode="virtual"
              :data="rowClassNameData"
              :columns="rowClassNameColumns"
              :row-class-name="rowClassNameFn"
              :tooltip-effect="rowClassNameTooltipEffect"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'tooltipOptionsDemo'"
        class="demo-section"
      >
        <h1>10.8b Tooltip 选项 (tooltipOptions)</h1>
        <p>通过 <code>tooltipOptions</code> 自定义溢出 tooltip 的 placement、popperClass 等选项。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式 — placement: top</h4>
            <adv-table
              mode="default"
              :data="rowClassNameData"
              :columns="rowClassNameColumns"
              :tooltip-options="{ placement: 'top' }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式 — placement: bottom</h4>
            <adv-table
              mode="virtual"
              :data="rowClassNameData"
              :columns="rowClassNameColumns"
              :tooltip-options="{ placement: 'bottom' }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'formatMaps'"
        class="demo-section"
      >
        <h1>10.9 自定义格式映射</h1>
        <p>使用 formatMaps 自定义响应数据的字段映射（如将 <code>items</code> 映射为 <code>data</code>，<code>totalCount</code> 映射为 <code>total</code>）。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="formatMapsRef"
              mode="default"
              :columns="allValueTypeColumns.slice(0, 6)"
              :request="{ source: mockCustomFormatRequest, formatMaps: { data: 'items', total: 'totalCount' } }"
              :pagination="{ pageSize: 10 }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              ref="formatMapsV2Ref"
              mode="virtual"
              :columns="allValueTypeColumns.slice(0, 6)"
              :request="{ source: mockCustomFormatRequest, formatMaps: { data: 'items', total: 'totalCount' } }"
              :pagination="{ pageSize: 10 }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'rowSelected'"
        class="demo-section"
      >
        <h1>10.10 rowSelected 事件</h1>
        <p>监听行选择事件。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="rowSelectedRef"
              mode="default"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              :row-config="{ rowSelection: 'multiple' }"
              height="400px"
              @row-selected="(e: any) => console.log('行选择:', e)"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              :row-config="{ rowSelection: 'multiple' }"
              height="400px"
              @row-selected="(e: any) => console.log('行选择:', e)"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'modelUpdated'"
        class="demo-section"
      >
        <h1>10.11 modelUpdated 事件</h1>
        <p>监听数据模型更新事件。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="modelUpdatedRef"
              mode="default"
              :data="editData"
              :columns="editColumns"
              :edit-config="{}"
              height="400px"
              @model-updated="() => modelUpdatedCount++"
            />
            <div style="margin-top: 10px">
              更新次数: {{ modelUpdatedCount }}
            </div>
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="editData"
              :columns="editColumns"
              :edit-config="{}"
              height="400px"
              @model-updated="() => modelUpdatedCount++"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'cellFocusedDemo'"
        class="demo-section"
      >
        <h1>10.12 单元格聚焦事件</h1>
        <p>监听单元格聚焦事件。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="cellFocusedRef"
              mode="default"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              height="400px"
              @cell-focused="(e: any) => cellFocusedLog = `聚焦: ${e.column?.prop}`"
            />
            <div style="margin-top: 10px">
              当前聚焦: {{ cellFocusedLog || '无' }}
            </div>
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              ref="cellFocusedV2Ref"
              mode="virtual"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              height="400px"
              @cell-focused="(e: any) => cellFocusedLog = `聚焦: ${e.column?.prop}`"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'gridReadyDemo'"
        class="demo-section"
      >
        <h1>10.13 表格就绪 (gridReady)</h1>
        <p>表格初始化完成事件。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="gridReadyRef"
              mode="default"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              height="400px"
              @grid-ready="() => gridReadyLog = 'Default 模式就绪'"
            />
            <div
              v-if="gridReadyLog"
              style="margin-top: 10px"
            >
              {{ gridReadyLog }}
            </div>
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              ref="gridReadyV2Ref"
              mode="virtual"
              :data="basicData"
              :columns="allValueTypeColumns.slice(0, 6)"
              height="400px"
              @grid-ready="() => gridReadyLog = 'Virtual 模式就绪'"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'api'"
        class="demo-section"
      >
        <h1>10.14 API 方法调用</h1>
        <p>通过 ref 调用表格 API。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <div style="margin-bottom: 10px">
              <ElButton @click="basicRef?.deselectAllFiltered?.()">
                清空选择
              </ElButton>
              <ElButton @click="basicRef?.selectAll?.()">
                全选
              </ElButton>
              <ElButton @click="handleGetCurrentPage('Default', basicRef)">
                获取当前页
              </ElButton>
            </div>
            <adv-table
              ref="basicRef"
              mode="default"
              :data="pageData60"
              :columns="allValueTypeColumns.slice(0, 6)"
              :row-config="{ rowSelection: 'multiple' }"
              :pagination="{ pageSize: 10 }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <div style="margin-bottom: 10px">
              <ElButton @click="apiV2Ref?.deselectAllFiltered?.()">
                清空选择
              </ElButton>
              <ElButton @click="apiV2Ref?.selectAll?.()">
                全选
              </ElButton>
              <ElButton @click="handleGetCurrentPage('Virtual', apiV2Ref)">
                获取当前页
              </ElButton>
            </div>
            <adv-table
              ref="apiV2Ref"
              mode="virtual"
              :data="pageData60"
              :columns="allValueTypeColumns.slice(0, 6)"
              :row-config="{ rowSelection: 'multiple' }"
              :pagination="{ pageSize: 10 }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'toolbar'"
        class="demo-section"
      >
        <h1>10.15 导入导出 + 工具栏</h1>
        <p>表格工具栏功能。使用 <code>v-model:data</code> 支持导入数据更新。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="toolbarRef"
              v-model:data="basicData"
              mode="default"
              :columns="allValueTypeColumns.slice(0, 6)"
              :toolbar="{ exportBtn: true, importBtn: true }"
              height="400px"
            />
            <div style="margin-top: 10px">
              <div
                v-for="(log, i) in importLog"
                :key="i"
                style="font-size: 12px"
              >
                {{ log }}
              </div>
            </div>
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              ref="importRef"
              v-model:data="basicData"
              mode="virtual"
              :columns="allValueTypeColumns.slice(0, 6)"
              :toolbar="{ exportBtn: true, importBtn: true }"
              height="400px"
            />
            <div style="margin-top: 10px">
              <div
                v-for="(log, i) in importLog"
                :key="i"
                style="font-size: 12px"
              >
                {{ log }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'sidePanelCombo'"
        class="demo-section"
      >
        <h1>10.16 集合侧边栏</h1>
        <p>组合侧边栏功能。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="sidePanelComboRef"
              mode="default"
              :data="sidePanelComboData"
              :columns="sidePanelComboColumns"
              :filter-config="{ sidePanel: true }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="sidePanelComboData"
              :columns="sidePanelComboColumns"
              :filter-config="{ sidePanel: true }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'emp'"
        class="demo-section"
      >
        <h1>10.17 多级表头 + 筛选</h1>
        <p>多级表头配合筛选功能。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              mode="default"
              :data="empData"
              :columns="empColumns"
              :filter-config="{ floatingFilter: true }"
              height="400px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              mode="virtual"
              :data="empData"
              :columns="empColumns"
              :filter-config="{ floatingFilter: true }"
              height="400px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'compDefault'"
        class="demo-section"
      >
        <h1>10.18 综合示例</h1>
        <p>
          综合展示工具栏全部功能：列设置 / 刷新 / 轮询 / 导出 Excel / 导出 CSV / 导入 / 打印，
          以及 <code>header-left</code>、<code>header-right</code> 表头插槽。两种渲染模式各占满整行、分两行分别展示。
        </p>
        <div class="stack-mode">
          <div class="mode-panel">
            <h4>Default 模式</h4>
            <adv-table
              ref="compRef"
              mode="default"
              :request="{ source: compDemoRequest }"
              :data="compDemoData"
              :columns="compColumns"
              :pagination="{ pageSize: 10, pageSizes: [10, 20, 50, 100] }"
              :toolbar="{
                columnSetting: true,
                refreshBtn: true,
                pollingBtn: true,
                pollingOptions: { time: 5000 },
                exportBtn: true,
                exportCsvBtn: true,
                importBtn: true,
                printBtn: true,
              }"
              border
              resizable
              :edit-config="{}"
              :filter-config="{ floatingFilter: true }"
              height="520px"
              @data-import="onCompImported"
            >
              <template #header-left>
                <span class="comp-header-tag">📊 综合数据</span>
              </template>
              <template #header-right>
                <span class="comp-header-tag comp-header-tag--right">共 {{ compDemoData.length }} 条</span>
              </template>
            </adv-table>
          </div>
          <div class="mode-panel">
            <h4>Virtual 模式</h4>
            <adv-table
              ref="compV2Ref"
              mode="virtual"
              :request="{ source: compDemoRequest }"
              :data="compDemoData"
              :columns="compColumns"
              :pagination="{ pageSize: 10, pageSizes: [10, 20, 50, 100] }"
              :toolbar="{
                columnSetting: true,
                refreshBtn: true,
                pollingBtn: true,
                pollingOptions: { time: 5000 },
                exportBtn: true,
                exportCsvBtn: true,
                importBtn: true,
                printBtn: true,
              }"
              border
              resizable
              :edit-config="{}"
              :filter-config="{ floatingFilter: true }"
              height="520px"
              @data-import="onCompImported"
            >
              <template #header-left>
                <span class="comp-header-tag">📊 综合数据</span>
              </template>
              <template #header-right>
                <span class="comp-header-tag comp-header-tag--right">共 {{ compDemoData.length }} 条</span>
              </template>
            </adv-table>
          </div>
        </div>
      </div>

      <!-- 10.19 容器布局 -->
      <div
        v-else-if="selectedDemo === 'containerLayoutDemo'"
        class="demo-section"
      >
        <h1>11.11 容器布局 (containerLayout)</h1>
        <p>
          <code>container-layout="bordered"</code>（默认）：容器自带边框与内边距；
          <code>container-layout="bare"</code>：移除容器边框与内边距，适合嵌入已有边框的父容器。
          下方将同一表格分别以两种布局放入带边框的父容器中对比。
        </p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>bordered（默认）</h4>
            <div style="border: 1px dashed #dcdfe6; padding: 12px">
              <adv-table
                mode="default"
                :data="basicData"
                :columns="allValueTypeColumns.slice(0, 6)"
                container-layout="bordered"
                height="320px"
              />
            </div>
          </div>
          <div class="mode-panel">
            <h4>bare</h4>
            <div style="border: 1px dashed #dcdfe6; padding: 12px">
              <adv-table
                mode="default"
                :data="basicData"
                :columns="allValueTypeColumns.slice(0, 6)"
                container-layout="bare"
                height="320px"
              />
            </div>
          </div>
        </div>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Virtual - bordered</h4>
            <div style="border: 1px dashed #dcdfe6; padding: 12px">
              <adv-table
                mode="virtual"
                :data="basicData"
                :columns="allValueTypeColumns.slice(0, 6)"
                container-layout="bordered"
                height="320px"
              />
            </div>
          </div>
          <div class="mode-panel">
            <h4>Virtual - bare</h4>
            <div style="border: 1px dashed #dcdfe6; padding: 12px">
              <adv-table
                mode="virtual"
                :data="basicData"
                :columns="allValueTypeColumns.slice(0, 6)"
                container-layout="bare"
                height="320px"
              />
            </div>
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'scrollSyncDemo'"
        class="demo-section"
      >
        <h1>10.20 虚拟滚动失步自愈</h1>
        <p>
          ElTableV2 在弹层开关、KeepAlive 停用/复活、容器尺寸变化或数据更新时，内部滚动状态可能与 DOM
          滚动位置失步，表现为「滚动条未动但顶部出现空白带、渲染行整体下移」，鼠标微微一滚即恢复。
          本库通过 rAF 检测失步并回写内部状态，实现零跳变自愈。
        </p>
        <p>
          操作步骤：先将下方表格滚动到中部（约第 1000 行），点击「模拟失步」——
          DOM 滚动位置被静默重置、而内部状态仍停留在旧位置（顶部出现空白带），
          根节点 capture 监听到滚动、静默约 120ms 后自动以 DOM 为准回写内部状态
          （行未动时直接恢复 DOM 位置以保留阅读进度，零跳变），内容立即对齐，无需任何滚动或后续操作。
          修复生效时观察 Console 出现 <code>[AdvTable] virtual scroll desync healed</code> 日志。
        </p>
        <p>
          说明：KeepAlive 按钮演示组件卸载/重挂载（无失步风险）；容器尺寸变化与数据替换时
          浏览器与 EP 均会派发滚动事件自行同步。真正需要本库兜底的是
          「DOM 滚动位置被外部改写、而 EP 滚动监听没跑」——即「模拟失步」按钮所模拟的场景
          （直写 scrollTop + 拦截 EP 监听；库侧经根节点 capture 独立感知滚动静默后自愈）。
        </p>
        <div class="mode-panel">
          <h4>触发场景</h4>
          <ElButton
            type="primary"
            @click="keepAliveShow = !keepAliveShow"
          >
            {{ keepAliveShow ? '隐藏表格（KeepAlive 停用）' : '重新显示表格（KeepAlive 复活）' }}
          </ElButton>
          <ElButton
            type="primary"
            @click="scrollSyncDrawerOpen = true"
          >
            打开 Drawer（弹层开关）
          </ElButton>
          <ElButton
            type="primary"
            @click="refreshScrollSyncData"
          >
            替换数据（新 2000 行数组）
          </ElButton>
          <ElButton
            type="primary"
            @click="simulateScrollSyncDesync"
          >
            模拟失步（重置 DOM 滚动位置）
          </ElButton>
          <ElButton
            type="primary"
            @click="scrollSyncPanelHeight = scrollSyncPanelHeight === 600 ? 800 : 600"
          >
            切换容器高度（{{ scrollSyncPanelHeight }}px → {{ scrollSyncPanelHeight === 600 ? 800 : 600 }}px）
          </ElButton>
          <component :is="keepAliveComponent">
            <div :style="{ height: `${scrollSyncPanelHeight}px` }">
              <adv-table
                v-if="keepAliveShow"
                mode="virtual"
                :data="scrollSyncData"
                :columns="scrollSyncColumns"
              />
            </div>
          </component>
        </div>
        <ElDrawer
          v-model="scrollSyncDrawerOpen"
          title="虚拟滚动失步演示"
          size="600px"
        >
          <p>
            Drawer 弹层开关会锁 body 滚动并引起布局重排，是 ElTableV2 虚拟滚动失步的常见触发源。
            关闭后观察页面表格内容是否仍保持对齐。
          </p>
        </ElDrawer>
      </div>

      <!-- 11.1 表面全覆盖 -->
      <div
        v-else-if="selectedDemo === 'surface'"
        class="demo-section"
      >
        <h1>11.1 API 表面全覆盖(Props / Events / Slots / Expose)</h1>
        <p>
          本页穷尽式演示 AdvTable 公共 API 表面的<strong>每一项</strong>：46 个 Props、5 个 v-model、53 个 Events、12 个 Slots，
          以及 <code>UseTableApiReturn</code> 的全部 Expose 成员（含 version / tableRootRef / tableSearchRef）。
          每个条目独占一节：标题给出名称，正文一句话说明作用，下方即时提供最小型可运行示例。
        </p>
        <p>
          <strong>覆盖清单：</strong>Props 46/46 · v-model 5/5 · Events 53/53（下方「全量绑定表」一次绑齐并记录到事件日志） ·
          Slots 12/12 · Expose 全量（按钮网格逐项触发）。与前面章节重复的条目在本页仍独立给出最小示例，便于当作速查手册。
        </p>

        <!-- ════════════════════════════════════════════════════════════
             PROPS（46 项全量逐项覆盖）
             ════════════════════════════════════════════════════════════ -->
        <h2>Props（46/46）</h2>

        <!-- performanceProfile -->
        <h3>performanceProfile: 'high' | 'low'</h3>
        <p>低端设备降档。下方低档位关闭滚动看门狗等重路径。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default · low</h4>
            <adv-table
              mode="default"
              :data="surfaceData"
              :columns="surfaceCols"
              performance-profile="low"
              height="200px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual · high</h4>
            <adv-table
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              performance-profile="high"
              height="200px"
            />
          </div>
        </div>

        <!-- modeSwitchBehavior -->
        <h3>modeSwitchBehavior: 'warn' | 'error' | 'silent'</h3>
        <p>运行时切换 mode 的行为策略。点按钮触发切换（'warn' 策略在 dev 模式下给出通知）。</p>
        <div class="mode-panel">
          <ElButton @click="cycleModeBehavior()">
            切换模式 (当前: {{ surfaceMode }})
          </ElButton>
        </div>
        <div class="dual-mode">
          <div class="mode-panel">
            <adv-table
              v-if="surfaceMode === 'default'"
              :key="`surf-${surfaceMode}-${surfaceBehavior}`"
              mode="default"
              :data="surfaceData"
              :columns="surfaceCols"
              :mode-switch-behavior="surfaceBehavior"
              height="250px"
            />
            <adv-table
              v-else
              :key="`surf-${surfaceMode}-${surfaceBehavior}`"
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              :mode-switch-behavior="surfaceBehavior"
              height="250px"
            />
          </div>
        </div>

        <!-- sortConfig -->
        <h3>sortConfig（多列排序上限）</h3>
        <p><code>maxSortColumns: 2</code> → 仅允许两列同时排序，超出时最早的列自动退出。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default</h4>
            <adv-table
              mode="default"
              :data="surfaceData"
              :columns="surfaceCols"
              :sort-config="{ maxSortColumns: 2 }"
              height="250px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual</h4>
            <adv-table
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              :sort-config="{ maxSortColumns: 2 }"
              height="250px"
            />
          </div>
        </div>

        <!-- spanMethod -->
        <h3>spanMethod（自定义合并函数）</h3>
        <p>覆盖内部自动合并逻辑；返回 undefined 则回退内部逻辑。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default</h4>
            <adv-table
              ref="surfaceSpanRef"
              mode="default"
              :data="surfaceData"
              :columns="surfaceCols"
              :span-method="surfaceSpanMethod"
              height="250px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual</h4>
            <adv-table
              ref="surfaceSpanV2Ref"
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              :span-method="surfaceSpanMethod"
              height="250px"
            />
          </div>
        </div>

        <!-- rangeSelection -->
        <h3>rangeSelection（Excel 风格范围选择）</h3>
        <p>支持简写 <code>true</code> 与对象形态 <code>{ enabled, autoCopy }</code>。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default · autoCopy</h4>
            <adv-table
              mode="default"
              :data="surfaceData"
              :columns="surfaceCols"
              :range-selection="{ enabled: true, autoCopy: true }"
              height="250px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual · enabled</h4>
            <adv-table
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              :range-selection="true"
              height="250px"
            />
          </div>
        </div>

        <!-- stripe -->
        <h3>stripe（斑马纹）</h3>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default</h4>
            <adv-table
              mode="default"
              :data="surfaceData"
              :columns="surfaceCols"
              stripe
              height="250px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual</h4>
            <adv-table
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              stripe
              height="250px"
            />
          </div>
        </div>

        <!-- showHeader -->
        <h3>showHeader（表头显隐）</h3>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default · false</h4>
            <adv-table
              mode="default"
              :data="surfaceData"
              :columns="surfaceCols"
              :show-header="false"
              height="200px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual · false</h4>
            <adv-table
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              :show-header="false"
              height="200px"
            />
          </div>
        </div>

        <!-- size -->
        <h3>size（表格尺寸）</h3>
        <p>可选 'default' | 'small' | 'large'（透传给 ElTable，virtual 模式下影响 rowHeight 等）。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default · small</h4>
            <adv-table
              mode="default"
              :data="surfaceData"
              :columns="surfaceCols"
              size="small"
              height="250px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual · small</h4>
            <adv-table
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              size="small"
              height="250px"
            />
          </div>
        </div>

        <!-- highlightCurrentRow -->
        <h3>highlightCurrentRow（高亮当前行）</h3>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default</h4>
            <adv-table
              mode="default"
              :data="surfaceData"
              :columns="surfaceCols"
              highlight-current-row
              height="250px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual</h4>
            <adv-table
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              highlight-current-row
              height="250px"
            />
          </div>
        </div>

        <!-- tableLayout -->
        <h3>tableLayout（布局算法）</h3>
        <p><code>'fixed'</code>（默认）列宽由表格宽度决定；<code>'auto'</code> 列宽由内容决定。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default · auto</h4>
            <adv-table
              mode="default"
              :data="surfaceData"
              :columns="surfaceCols"
              table-layout="auto"
              height="250px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual · auto</h4>
            <adv-table
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              table-layout="auto"
              height="250px"
            />
          </div>
        </div>

        <!-- estimatedRowHeight -->
        <h3>estimatedRowHeight（预估行高）</h3>
        <p>仅 virtual 模式生效，显式设置可覆盖内部回退。</p>
        <div class="mode-panel">
          <h4>Virtual · 48px</h4>
          <adv-table
            mode="virtual"
            :data="surfaceData"
            :columns="surfaceCols"
            :estimated-row-height="48"
            height="250px"
          />
        </div>

        <!-- tooltipFormatter -->
        <h3>tooltipFormatter（溢出 tooltip 格式化）</h3>
        <p>表级别默认格式化函数，可被列级别覆盖。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default</h4>
            <adv-table
              mode="default"
              :data="surfaceData"
              :columns="surfaceCols"
              :tooltip-formatter="surfaceTooltipFormatter"
              height="250px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual</h4>
            <adv-table
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              :tooltip-formatter="surfaceTooltipFormatter"
              height="250px"
            />
          </div>
        </div>

        <!-- containerLayout -->
        <h3>containerLayout（容器布局）</h3>
        <p><code>'bordered'</code>（默认）带边框内边距；<code>'bare'</code> 无边框无内边距。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default · bare</h4>
            <adv-table
              mode="default"
              :data="surfaceData"
              :columns="surfaceCols"
              container-layout="bare"
              height="250px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual · bare</h4>
            <adv-table
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              container-layout="bare"
              height="250px"
            />
          </div>
        </div>

        <!-- debug -->
        <h3>debug（调试模式）</h3>
        <p>支持简写 <code>true</code> 与对象形态 <code>{ enabled, perf, domains }</code>。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default · { enabled, perf }</h4>
            <adv-table
              mode="default"
              :data="surfaceData"
              :columns="surfaceCols"
              :debug="{ enabled: true, perf: true }"
              height="250px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual · true</h4>
            <adv-table
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              :debug="true"
              height="250px"
            />
          </div>
        </div>

        <!-- rowPinConfig -->
        <h3>rowPinConfig（行固定）</h3>
        <p>将指定行固定在顶部或底部，滚动时始终可见。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default · top + bottom</h4>
            <adv-table
              mode="default"
              :data="surfaceData"
              :columns="surfaceCols"
              :row-config="{ rowKey: 'id' }"
              :row-pin-config="{ topRowKeys: ['1'], bottomRowKeys: ['5'] }"
              height="250px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual · top + bottom</h4>
            <adv-table
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              :row-config="{ rowKey: 'id' }"
              :row-pin-config="{ topRowKeys: ['1'], bottomRowKeys: ['5'] }"
              height="250px"
            />
          </div>
        </div>

        <!-- loading -->
        <h3>loading（加载状态）</h3>
        <p>与内部 loading 通过 OR 合并。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default · loading</h4>
            <adv-table
              mode="default"
              :data="surfaceData"
              :columns="surfaceCols"
              :loading="true"
              height="200px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual · loading</h4>
            <adv-table
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              :loading="true"
              height="200px"
            />
          </div>
        </div>

        <!-- mode -->
        <h3>mode（渲染模式）</h3>
        <p><code>'default'</code>（ElTable）/ <code>'virtual'</code>（ElTableV2 虚拟滚动）。下方为 virtual 模式，长列表仅渲染视口内行。</p>
        <adv-table
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          height="200px"
        />

        <!-- border -->
        <h3>border（边框）</h3>
        <p>显示外边框与纵向内边框线。与列宽拖拽无关（那由 <code>resizable</code> 控制），仅视觉。</p>
        <adv-table
          mode="default"
          :data="surfaceData.slice(0, 6)"
          :columns="surfaceCols"
          border
          height="200px"
        />

        <!-- resizable -->
        <h3>resizable（列宽拖拽）</h3>
        <p>允许拖动列边界调整宽度；列级 <code>resizable</code> 优先于表级。拖动下方列边界观察。</p>
        <adv-table
          mode="default"
          :data="surfaceData.slice(0, 6)"
          :columns="surfaceCols"
          resizable
          height="200px"
        />

        <!-- toolbar -->
        <h3>toolbar（工具栏）</h3>
        <p>顶部工具栏：列设置、刷新、导出、导入等按钮。点各按钮体验对应面板。</p>
        <adv-table
          mode="default"
          :data="surfaceData.slice(0, 6)"
          :columns="surfaceCols"
          :toolbar="{ columnSetting: true, refreshBtn: true, exportBtn: true, importBtn: true }"
          height="200px"
        />

        <!-- search -->
        <h3>search（搜索表单）</h3>
        <p>顶部查询表单区。改姓名后点「查询」触发 query / searchChange 事件。</p>
        <adv-table
          mode="default"
          :data="surfaceData.slice(0, 6)"
          :columns="surfaceCols"
          :search="{ enabled: true, fields: [{ prop: 'name', label: '姓名' }] }"
          height="200px"
        />

        <!-- pagination -->
        <h3>pagination（分页）</h3>
        <p>客户端分页配置。下方每页 5 条，翻页触发 pageChange。</p>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          :pagination="{ pageSize: 5, pageSizes: [5, 10] }"
          height="200px"
        />

        <!-- request -->
        <h3>request（远程数据源）</h3>
        <p>声明式请求配置（source / auto / 重试 / 参数映射）。打开控制台可看到自动发起的请求日志。</p>
        <adv-table
          mode="default"
          :columns="surfaceCols"
          :request="{ source: async () => ({ data: genData(6), total: 6 }), auto: true }"
          height="200px"
        />

        <!-- urlState -->
        <h3>urlState（URL 状态同步）</h3>
        <p>把分页/搜索参数同步到地址栏 query。翻页后观察浏览器 URL 变化。</p>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          :url-state="{ enabled: true }"
          :pagination="{ pageSize: 5 }"
          height="200px"
        />

        <!-- externalFilter -->
        <h3>externalFilter（外部筛选器）</h3>
        <p>AG-Grid 风格业务过滤钩子，位于列筛选之后、排序之前。下方过滤掉年龄 &lt; 30 的行。</p>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          :external-filter="{ isExternalFilterPresent: () => true, doesExternalFilterPass: (row: any) => Number(row.age) >= 30 }"
          height="200px"
        />

        <!-- columns -->
        <h3>columns（列定义数组）</h3>
        <p>声明式列配置；不传时 default 模式可改用 <code>&lt;el-table-column&gt;</code> 子组件（见 default 插槽一节）。</p>
        <adv-table
          mode="default"
          :data="surfaceData.slice(0, 6)"
          :columns="surfaceCols"
          height="200px"
        />

        <!-- data -->
        <h3>data（行数据数组）</h3>
        <p>静态数据源（未设置 <code>request.source</code> 时生效）。作为 v-model 的用法见下方「v-model」一节。</p>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          height="200px"
        />

        <!-- height -->
        <h3>height（表格高度）</h3>
        <p>px 数值或 CSS 字符串；未设置时自适应父容器。下方固定 160px，内容超出即出滚动条。</p>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          :height="160"
        />

        <!-- selectedRowKeys -->
        <h3>selectedRowKeys（受控选中）</h3>
        <p>以行 key 数组受控勾选状态，配合 <code>rowConfig.rowKey</code> 使用。下方预置选中第 1、2 行。</p>
        <adv-table
          mode="default"
          :data="surfaceData.slice(0, 6)"
          :columns="surfaceCols"
          :row-config="{ rowKey: 'id', rowSelection: 'multiple' }"
          :selected-row-keys="['1', '2']"
          height="200px"
        />

        <!-- quickFilter -->
        <h3>quickFilter（全局快速搜索）</h3>
        <p>跨列模糊匹配文本。下方预置 <code>"用户1"</code>，仅命中行可见；v-model 用法见「v-model」一节。</p>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          quick-filter="用户1"
          height="200px"
        />

        <!-- editConfig -->
        <h3>editConfig（编辑全局配置）</h3>
        <p>编辑触发方式、单击即编等表级开关。下方开启 <code>singleClickEdit</code>，单击姓名/年龄单元格即可编辑。</p>
        <adv-table
          mode="default"
          :data="surfaceEditData.slice(0, 6)"
          :columns="surfaceEditCols"
          :edit-config="{ singleClickEdit: true }"
          height="200px"
        />

        <!-- columnConfig -->
        <h3>columnConfig（列全局配置）</h3>
        <p>默认列定义（defaultColDef）、列拖拽、列分组开关等。下方开启列拖拽排序。</p>
        <adv-table
          mode="default"
          :data="surfaceData.slice(0, 6)"
          :columns="surfaceCols"
          :column-config="{ columnDraggable: true }"
          height="200px"
        />

        <!-- rowConfig -->
        <h3>rowConfig（行配置）</h3>
        <p>行 key、行选择（single/multiple）、行拖拽等。下方多选 + rowKey='id'。</p>
        <adv-table
          mode="default"
          :data="surfaceData.slice(0, 6)"
          :columns="surfaceCols"
          :row-config="{ rowKey: 'id', rowSelection: 'multiple' }"
          height="200px"
        />

        <!-- filterConfig -->
        <h3>filterConfig（筛选面板配置）</h3>
        <p>筛选交互模式（floatingFilter / sidePanel 等）。下方开启浮动筛选，姓名列头下方出现输入框。</p>
        <adv-table
          mode="default"
          :data="surfaceData.slice(0, 6)"
          :columns="surfaceCols"
          :filter-config="{ floatingFilter: true }"
          height="200px"
        />

        <!-- spanConfig -->
        <h3>spanConfig（声明式合并）</h3>
        <p>按字段的行/列合并配置，支持扁平简写 <code>{ status: true }</code>（≡ <code>{ rows: { status: true } }</code>）。同值相邻单元格自动合并。</p>
        <adv-table
          mode="default"
          :data="surfaceData.slice(0, 6)"
          :columns="surfaceCols"
          :span-config="{ status: true }"
          height="200px"
        />

        <!-- uiConfig -->
        <h3>uiConfig（UI 杂项配置）</h3>
        <p>合计行、空态占位、货币格式等 UI 开关。下方开启合计行（summaryMethod 见 helpers）。</p>
        <adv-table
          mode="default"
          :data="surfaceData.slice(0, 6)"
          :columns="surfaceCols"
          :ui-config="{ showSummary: true, summaryMethod }"
          height="200px"
        />

        <!-- columnState -->
        <h3>columnState（列状态持久化）</h3>
        <p>列宽/顺序/显隐自动存到 localStorage。刷新页面后本表列状态保持不变（先拖动列宽再刷新验证）。</p>
        <adv-table
          mode="default"
          :data="surfaceData.slice(0, 6)"
          :columns="surfaceCols"
          :column-state="{ enabled: true, storageKey: 'surface-props-column-state' }"
          :toolbar="{ columnSetting: true }"
          height="200px"
        />

        <!-- menuConfig -->
        <h3>menuConfig（右键菜单配置）</h3>
        <p>单元格右键菜单的区域与菜单项配置。右键下方单元格弹出复制菜单。</p>
        <adv-table
          mode="default"
          :data="surfaceData.slice(0, 6)"
          :columns="surfaceCols"
          :menu-config="{ body: { enabled: true, options: [['copyCell', 'copyRow']] } }"
          height="200px"
        />

        <!-- interceptor -->
        <h3>interceptor（行为拦截器）</h3>
        <p>拦截键盘/编辑/点击等内置行为，回调返回 false 即中止该次默认处理链。下方拦截 <code>event.rowClick</code>（恒返回 false），行点击后续逻辑被中止。</p>
        <adv-table
          mode="default"
          :data="surfaceData.slice(0, 6)"
          :columns="surfaceCols"
          :row-config="{ rowKey: 'id', rowSelection: 'multiple' }"
          :interceptor="{ 'event.rowClick': () => false }"
          height="200px"
        />

        <!-- treeConfig -->
        <h3>treeConfig（树形数据）</h3>
        <p>把 children 层级数据展平为带缩进的树形行。下方默认全部展开，点箭头折叠/展开。</p>
        <adv-table
          mode="default"
          :data="treeData"
          :columns="treeColumns"
          :tree-config="{ children: 'children', defaultExpandAll: true }"
          :row-config="{ rowKey: 'id' }"
          height="200px"
        />

        <!-- rowGroupConfig -->
        <h3>rowGroupConfig（行分组）</h3>
        <p>按字段值分组生成带分组头的行数组。下方按 department 字段分组。</p>
        <adv-table
          mode="default"
          :data="surfaceGroupData.slice(0, 9)"
          :columns="surfaceCols"
          :row-group-config="{ field: 'department', defaultExpandAll: true }"
          height="200px"
        />

        <!-- rowExpandConfig -->
        <h3>rowExpandConfig（展开行）</h3>
        <p>主/明细展开行能力（accordion、行高等）。点首列箭头展开，内容见 expandRow 插槽一节。</p>
        <adv-table
          mode="default"
          :data="surfaceData.slice(0, 6)"
          :columns="surfaceCols"
          :row-config="{ rowKey: 'id' }"
          :row-expand-config="{ enabled: true, expandRowHeight: 60 }"
          height="200px"
        >
          <template #expandRow="{ row }">
            <div class="surface-expand-content">
              {{ row.name }} 的展开明细（rowExpandConfig 生效中）
            </div>
          </template>
        </adv-table>

        <!-- emptyText -->
        <h3>emptyText（空态文案）</h3>
        <p>无数据时显示的占位文本；default 模式透传 ElTable，virtual 模式经 #empty 插槽实现。</p>
        <adv-table
          mode="default"
          :data="[]"
          :columns="surfaceCols"
          empty-text="暂无数据（emptyText 自定义文案）"
          height="200px"
        />

        <!-- rowClassName -->
        <h3>rowClassName（行类名）</h3>
        <p>函数或字符串行类名，两种模式行为一致。下方按行号奇偶/状态加类名（配合 demo-row 样式）。</p>
        <adv-table
          mode="default"
          :data="surfaceData.slice(0, 6)"
          :columns="surfaceCols"
          :row-class-name="rowClassNameFn"
          height="200px"
        />

        <!-- tooltipEffect -->
        <h3>tooltipEffect（溢出 tooltip 主题）</h3>
        <p>溢出提示的 ElTooltip effect 主题，默认 'dark'。下方改 'light'，悬浮溢出单元格观察。</p>
        <adv-table
          mode="default"
          :data="tooltipDemoData.slice(0, 6)"
          :columns="tooltipDemoCols"
          tooltip-effect="light"
          height="200px"
        />

        <!-- tooltipOptions -->
        <h3>tooltipOptions（溢出 tooltip 选项）</h3>
        <p>溢出提示的自定义选项（placement / popperClass 等）。下方 placement 固定 top。</p>
        <adv-table
          mode="default"
          :data="tooltipDemoData.slice(0, 6)"
          :columns="tooltipDemoCols"
          :tooltip-options="{ placement: 'top' }"
          height="200px"
        />

        <!-- ════════════════════════════════════════════════════════════
             v-model（5 个 defineModel 逐项概况）
             ════════════════════════════════════════════════════════════ -->
        <h2>v-model（5/5）</h2>
        <p>
          组件声明 5 个 <code>defineModel</code>（见 <code>packages/table/src/table.vue</code>）：
          data / columns / loading / quickFilter / searchValues。每个 v-model 均为「prop + update:X 事件」双向通道，
          下方各附一个最小交互示例。
        </p>

        <h3>v-model:data（双向行数据）</h3>
        <p>表格内部事务（applyTransaction / 编辑提交）会回写父组件数组；父组件改数组，表格同步。点按钮由表格侧加行观察计数。</p>
        <div class="mode-panel">
          <ElButton
            size="small"
            @click="surfaceVmRef?.applyTransaction?.({ add: [{ id: String(Date.now()), name: `新增${Date.now() % 1000}`, age: 22 }] })"
          >
            表格侧加一行（applyTransaction）
          </ElButton>
          <span style="margin-left: 8px; font-size: 12px; color: #606266">父组件已绑定 {{ surfaceVmData.length }} 条</span>
          <adv-table
            ref="surfaceVmRef"
            v-model:data="surfaceVmData"
            mode="default"
            :columns="surfaceCols"
            height="200px"
          />
        </div>

        <h3>v-model:columns（双向列状态）</h3>
        <p>列显隐/顺序/宽度变化经该模型回写。点按钮由父组件侧增删列，表格即时响应。</p>
        <div class="mode-panel">
          <ElButton
            size="small"
            @click="surfaceVmColumns.length < 6 ? surfaceVmColumns.push({ prop: 'createdAt', label: '创建时间', width: 160 }) : surfaceVmColumns.pop()"
          >
            {{ surfaceVmColumns.length < 6 ? '加一列（创建时间）' : '移除最后一列' }}
          </ElButton>
          <span style="margin-left: 8px; font-size: 12px; color: #606266">当前 {{ surfaceVmColumns.length }} 列</span>
          <adv-table
            v-model:columns="surfaceVmColumns"
            mode="default"
            :data="surfaceVmData.slice(0, 6)"
            height="200px"
          />
        </div>

        <h3>v-model:loading（双向加载态）</h3>
        <p>外部开关与表格 loading 联动；表格内部请求期间也会写回该模型。切换下方开关观察遮罩。</p>
        <div class="mode-panel">
          <ElSwitch v-model="surfaceVmLoading" />
          <span style="margin-left: 8px; font-size: 12px; color: #606266">surfaceVmLoading = {{ surfaceVmLoading }}</span>
          <adv-table
            v-model:loading="surfaceVmLoading"
            mode="default"
            :data="surfaceVmData.slice(0, 6)"
            :columns="surfaceCols"
            height="200px"
          />
        </div>

        <h3>v-model:quickFilter（双向全局搜索）</h3>
        <p>输入框与表格全局过滤共享同一字符串：输入即过滤，表格内快速搜索框改动也会回写输入框。</p>
        <div class="mode-panel">
          <ElInput
            v-model="surfaceVmQuickFilter"
            placeholder="输入如 用户1"
            style="width: 220px; margin-bottom: 8px"
            clearable
          />
          <adv-table
            v-model:quick-filter="surfaceVmQuickFilter"
            mode="default"
            :data="surfaceVmData"
            :columns="surfaceCols"
            height="200px"
          />
        </div>

        <h3>v-model:searchValues（双向查询表单模型）</h3>
        <p>搜索表单字段值与该对象双向同步：表单输入回写模型，程序改模型也会反映到表单。下方 JSON 实时回显。</p>
        <div class="mode-panel">
          <pre style="font-size: 11px; margin: 0 0 8px">{{ JSON.stringify(surfaceVmSearchValues) }}</pre>
          <adv-table
            v-model:search-values="surfaceVmSearchValues"
            mode="default"
            :data="surfaceVmData"
            :columns="surfaceCols"
            :search="{ enabled: true, fields: [{ prop: 'name', label: '姓名' }, { prop: 'status', label: '状态' }] }"
            height="200px"
          />
        </div>

        <!-- ════════════════════════════════════════════════════════════
             EVENTS（53 项全量：全量绑定表 + 速查表 + 分组交互示例）
             ════════════════════════════════════════════════════════════ -->
        <h2>Events（53/53）</h2>

        <h3>全量绑定表（v-on 一次绑齐 53 个事件）</h3>
        <p>
          下方 Default 面板通过 <code>v-on="surfaceEventHandlers"</code> 绑定全部 53 个事件（与 11.0 Mega 页同构），
          并配置了编辑/搜索/分页/工具栏/右键菜单/行拖拽/范围选择等能力以覆盖所有触发路径；Virtual 面板补齐
          endReached / rowsRendered。触发记录统一进入页面底部「事件日志」（高频事件仅计数：scroll / rowsRendered /
          cellMouseEnter / cellMouseLeave / 键盘三事件）。<SurfaceEventBoard section="coverage" />
        </p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default · 53 事件全绑定</h4>
            <adv-table
              mode="default"
              :data="surfaceData"
              :columns="surfaceCols"
              :row-config="{ rowKey: 'id', rowSelection: 'multiple', rowDraggable: true }"
              :edit-config="{ singleClickEdit: true }"
              :pagination="{ pageSize: 5 }"
              :search="{ enabled: true, fields: [{ prop: 'name', label: '姓名' }] }"
              :toolbar="{ columnSetting: true, refreshBtn: true, exportBtn: true, exportCsvBtn: true, importBtn: true }"
              :menu-config="{ body: { enabled: true, options: [['copyCell', 'copyRow'], ['clearSort']] } }"
              :range-selection="true"
              height="320px"
              v-on="surfaceEventHandlers"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual · 53 事件全绑定</h4>
            <adv-table
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              :row-config="{ rowKey: 'id', rowSelection: 'multiple' }"
              :pagination="{ pageSize: 5, infiniteScroll: true }"
              height="320px"
              v-on="surfaceEventHandlers"
            />
          </div>
        </div>
        <SurfaceEventBoard section="unfired" />

        <h3>事件速查表（53 项 · 各自概况）</h3>
        <SurfaceEventBoard section="checklist" />

        <h3>以下为按域分组的最小交互示例（与全量绑定表互补，日志同样进「事件日志」）</h3>

        <h3>pageChange / query / reset / request / refresh</h3>
        <div class="mode-panel">
          <adv-table
            ref="surfaceEventRef"
            mode="default"
            :data="surfaceData"
            :columns="surfaceCols"
            :pagination="{ pageSize: 5 }"
            :search="{ enabled: true, fields: [{ prop: 'name', label: '姓名' }] }"
            height="300px"
            @page-change="(p: any, s: any, id: any) => surfaceLog.push(`pageChange: ${p}/${s}`)"
            @query="(p: any, id: any) => surfaceLog.push(`query: ${JSON.stringify(p)}`)"
            @reset="(id: any) => surfaceLog.push('reset')"
            @request="(p: any, id: any) => surfaceLog.push('request')"
            @refresh="(id: any) => surfaceLog.push('refresh')"
          />
        </div>

        <h3>selectionChange / select / selectAll</h3>
        <div class="mode-panel">
          <adv-table
            mode="default"
            :data="surfaceData"
            :columns="surfaceCols"
            :row-config="{ rowSelection: 'multiple' }"
            height="250px"
            @selection-change="(rows: any, id: any) => surfaceLog.push(`selectionChange: ${rows.length} rows`)"
            @select="({ selection, row }: any, id: any) => surfaceLog.push(`select: ${row?.name}`)"
            @select-all="(sel: any, id: any) => surfaceLog.push(`selectAll: ${sel.length}`)"
          />
        </div>

        <h3>sortChange</h3>
        <div class="mode-panel">
          <adv-table
            mode="default"
            :data="surfaceData"
            :columns="surfaceCols"
            height="250px"
            @sort-change="({ prop, order }: any, id: any) => surfaceLog.push(`sortChange: ${prop} ${order}`)"
          />
        </div>

        <h3>rowContextmenu / rowDblclick</h3>
        <div class="mode-panel">
          <adv-table
            mode="default"
            :data="surfaceData"
            :columns="surfaceCols"
            height="250px"
            @row-contextmenu="({ rowData }: any, id: any) => surfaceLog.push(`rowContextmenu: ${rowData.name}`)"
            @row-dblclick="({ rowData }: any, id: any) => surfaceLog.push(`rowDblclick: ${rowData.name}`)"
          />
        </div>

        <h3>cellMouseEnter / cellMouseLeave / cellDblclick / cellContextmenu</h3>
        <div class="mode-panel">
          <adv-table
            mode="default"
            :data="surfaceData"
            :columns="surfaceCols"
            height="250px"
            @cell-mouse-enter="({ rowData, column }: any, id: any) => surfaceLog.push(`cellMouseEnter: ${rowData.name}/${column.prop}`)"
            @cell-mouse-leave="(id: any) => surfaceLog.push('cellMouseLeave')"
            @cell-dblclick="({ rowData, column }: any, id: any) => surfaceLog.push(`cellDblclick: ${rowData.name}/${column.prop}`)"
            @cell-contextmenu="({ rowData, column }: any, id: any) => surfaceLog.push(`cellContextmenu: ${rowData.name}/${column.prop}`)"
          />
        </div>

        <h3>headerClick / headerContextmenu</h3>
        <div class="mode-panel">
          <adv-table
            mode="default"
            :data="surfaceData"
            :columns="surfaceCols"
            height="250px"
            @header-click="({ column }: any, id: any) => surfaceLog.push(`headerClick: ${column.prop}`)"
            @header-contextmenu="({ column }: any, id: any) => surfaceLog.push(`headerContextmenu: ${column.prop}`)"
          />
        </div>

        <h3>scroll</h3>
        <div class="mode-panel">
          <adv-table
            mode="default"
            :data="surfaceData"
            :columns="surfaceCols"
            height="200px"
            @scroll="({ scrollTop }: any, id: any) => surfaceLog.push(`scroll: top=${scrollTop}`)"
          />
        </div>

        <h3>dataChange / beforeDataChange / afterDataChange</h3>
        <div class="mode-panel">
          <ElButton @click="surfaceMutateData()">
            变更数据
          </ElButton>
          <adv-table
            mode="default"
            :data="surfaceData"
            :columns="surfaceCols"
            height="250px"
            @data-change="({ reason }: any, id: any) => surfaceLog.push(`dataChange: ${reason}`)"
            @before-data-change="({ reason }: any, id: any) => surfaceLog.push(`beforeDataChange: ${reason}`)"
            @after-data-change="({ reason }: any, id: any) => surfaceLog.push(`afterDataChange: ${reason}`)"
          />
        </div>

        <h3>cellValueChanged / cellEditingStopped / cellEditingRequest</h3>
        <div class="mode-panel">
          <adv-table
            mode="default"
            :data="surfaceEditData"
            :columns="surfaceEditCols"
            :edit-config="{ singleClickEdit: true }"
            height="250px"
            @cell-value-changed="({ row, prop, newValue }: any) => surfaceLog.push(`cellValueChanged: ${row.name}.${prop}=${newValue}`)"
            @cell-editing-stopped="({ row, prop }: any) => surfaceLog.push(`cellEditingStopped: ${row.name}.${prop}`)"
            @cell-editing-request="({ row, prop }: any) => surfaceLog.push(`cellEditingRequest: ${row.name}.${prop}`)"
          />
        </div>

        <h3>fullRowEdit / cellEditingCancelled</h3>
        <div class="mode-panel">
          <adv-table
            mode="default"
            :data="surfaceEditData"
            :columns="surfaceEditCols"
            :edit-config="{ trigger: 'manual' }"
            height="250px"
            @full-row-edit="({ row, changes }: any) => surfaceLog.push(`fullRowEdit: ${row.name} (${changes.length} fields)`)"
            @cell-editing-cancelled="({ reason }: any) => surfaceLog.push(`cellEditingCancelled: ${reason}`)"
          />
        </div>

        <h3>crossFieldValidateError / batchPendingChange</h3>
        <div class="mode-panel">
          <adv-table
            mode="default"
            :data="surfaceEditData"
            :columns="surfaceEditCols"
            :edit-config="{ singleClickEdit: true }"
            height="250px"
            @cross-field-validate-error="({ errors }: any) => surfaceLog.push(`crossFieldValidateError: ${errors.join(',')}`)"
            @batch-pending-change="(has: any) => surfaceLog.push(`batchPendingChange: ${has}`)"
          />
        </div>

        <h3>rowDragEnd</h3>
        <div class="mode-panel">
          <adv-table
            mode="default"
            :data="surfaceDragData"
            :columns="surfaceCols"
            :row-config="{ rowDraggable: true }"
            height="250px"
            @row-drag-end="({ sourceRow, targetRow }: any) => surfaceLog.push(`rowDragEnd: ${sourceRow?.name} → ${targetRow?.name ?? 'none'}`)"
          />
        </div>

        <h3>cellKeyPress / cellKeyUp</h3>
        <div class="mode-panel">
          <adv-table
            mode="default"
            :data="surfaceData"
            :columns="surfaceCols"
            height="250px"
            @cell-key-press="({ rowData, column }: any) => surfaceLog.push(`cellKeyPress: ${rowData.name}/${column.prop}`)"
            @cell-key-up="({ rowData, column }: any) => surfaceLog.push(`cellKeyUp: ${rowData.name}/${column.prop}`)"
          />
        </div>

        <h3>columnVisible / columnMoved</h3>
        <div class="mode-panel">
          <adv-table
            mode="default"
            :data="surfaceData"
            :columns="surfaceCols"
            :toolbar="{ columnSetting: true }"
            height="250px"
            @column-visible="({ columnKey, visible }: any) => surfaceLog.push(`columnVisible: ${columnKey}=${visible}`)"
            @column-moved="({ columns }: any) => surfaceLog.push(`columnMoved: ${columns.length} cols`)"
          />
        </div>

        <h3>rowExpand / rowCollapse</h3>
        <div class="mode-panel">
          <adv-table
            mode="default"
            :data="surfaceData"
            :columns="surfaceCols"
            :row-config="{ rowKey: 'id' }"
            :row-expand-config="{ enabled: true, expandRowHeight: 80 }"
            height="250px"
            @row-expand="({ row, expanded }: any) => surfaceLog.push(`rowExpand: ${row.name}=${expanded}`)"
            @row-collapse="({ row }: any) => surfaceLog.push(`rowCollapse: ${row.name}`)"
          />
        </div>

        <h3>searchChange</h3>
        <div class="mode-panel">
          <adv-table
            mode="default"
            :data="surfaceData"
            :columns="surfaceCols"
            :search="{ enabled: true, fields: [{ prop: 'name', label: '姓名' }] }"
            height="250px"
            @search-change="({ key, val }: any) => surfaceLog.push(`searchChange: ${key}=${val}`)"
          />
        </div>

        <h3>endReached / rowsRendered（仅 virtual 模式）</h3>
        <div class="mode-panel">
          <adv-table
            mode="virtual"
            :data="surfaceData"
            :columns="surfaceCols"
            height="250px"
            @end-reached="(dist: any) => surfaceLog.push(`endReached: ${dist}px`)"
            @rows-rendered="({ rowVisibleStart, rowVisibleEnd }: any) => surfaceLog.push(`rowsRendered: ${rowVisibleStart}-${rowVisibleEnd}`)"
          />
        </div>

        <h3>error</h3>
        <p>结构化错误事件。下方通过 <code>request.source</code> 抛错触发。</p>
        <div class="mode-panel">
          <adv-table
            mode="default"
            :columns="surfaceCols"
            :request="{ source: surfaceErrorSource, auto: true }"
            height="200px"
            @error="(err: any) => surfaceLog.push(`error: ${err.message}`)"
          />
        </div>

        <!-- 事件日志 -->
        <h3>事件日志</h3>
        <SurfaceEventBoard section="log" />

        <!-- ════════════════════════════════════════════════════════════
             SLOTS（12 个全量覆盖）
             ════════════════════════════════════════════════════════════ -->
        <h2>Slots（12/12）</h2>
        <p>12 个插槽逐项概况：default / append / error / empty / footer / footer-extra / header-left / header-right / expandRow / groupHeader / 动态 <code>#[prop]</code> / 动态 <code>#[prop]-header</code>。</p>

        <h3>empty（空数据占位，含 error 绑定）</h3>
        <p>无数据时渲染，插槽作用域带 <code>error</code>（请求失败时非空）。下方数据置空演示。</p>
        <div class="mode-panel">
          <adv-table
            mode="default"
            :data="[]"
            :columns="surfaceCols"
            height="200px"
          >
            <template #empty="{ error }">
              <div class="surface-error-slot">
                {{ error ? `加载失败：${error.message}` : '空数据（#empty 插槽，作用域含 error）' }}
              </div>
            </template>
          </adv-table>
        </div>

        <h3>header-left / header-right（工具栏两侧）</h3>
        <p>工具栏区域左右两侧的自定义内容插槽（无作用域参数），常放标题与统计信息。</p>
        <div class="mode-panel">
          <adv-table
            mode="default"
            :data="surfaceData.slice(0, 6)"
            :columns="surfaceCols"
            :toolbar="{ columnSetting: true }"
            height="200px"
          >
            <template #header-left>
              <span class="surface-header-slot">← header-left 自定义标题</span>
            </template>
            <template #header-right>
              <span class="surface-cell-slot">header-right 共 {{ surfaceData.length }} 条 →</span>
            </template>
          </adv-table>
        </div>

        <h3>default（仅 default 模式）</h3>
        <p>自定义列渲染（virtual 模式下被忽略并显示警告）。</p>
        <div class="mode-panel">
          <adv-table
            mode="default"
            :data="surfaceData"
            :columns="surfaceCols"
            height="250px"
          >
            <template #default>
              <el-table-column
                prop="name"
                label="姓名(default slot)"
              />
              <el-table-column
                prop="age"
                label="年龄(default slot)"
              />
            </template>
          </adv-table>
        </div>

        <h3>footer / footer-extra</h3>
        <p><code>footer</code> 完全替换底栏（接收 currentPage/pageSize/total）；<code>footer-extra</code> 在分页左侧追加内容。</p>
        <div class="mode-panel">
          <adv-table
            mode="default"
            :data="surfaceData"
            :columns="surfaceCols"
            :pagination="{ pageSize: 5 }"
            height="250px"
          >
            <template #footer="{ currentPage, pageSize, total }">
              <span>自定义底栏：第 {{ currentPage }} 页 / 共 {{ total }} 条 (每页 {{ pageSize }} 条)</span>
            </template>
            <template #footer-extra>
              <span style="color: #909399">自定义左侧内容</span>
            </template>
          </adv-table>
        </div>

        <h3>append（仅 virtual 模式）</h3>
        <p>在表格底部追加一行合成行（与 ElTableV2 的 append slot 行为一致）。</p>
        <div class="mode-panel">
          <adv-table
            mode="virtual"
            :data="surfaceData"
            :columns="surfaceCols"
            height="250px"
          >
            <template #append>
              <div class="surface-append-row">
                —— 这是 append 插槽追加的合成行 ——
              </div>
            </template>
          </adv-table>
        </div>

        <h3>expandRow（主/明细视图）</h3>
        <p>展开行内容插槽，接收 row / rowKey。</p>
        <div class="mode-panel">
          <adv-table
            mode="default"
            :data="surfaceData"
            :columns="surfaceCols"
            :row-config="{ rowKey: 'id' }"
            :row-expand-config="{ enabled: true, expandRowHeight: 80 }"
            height="250px"
          >
            <template #expandRow="{ row }">
              <div class="surface-expand-content">
                <strong>{{ row.name }}</strong> 的详情：年龄 {{ row.age }}，状态 {{ row.status }}。
              </div>
            </template>
          </adv-table>
        </div>

        <h3>groupHeader（行分组头）</h3>
        <p>自定义行分组头渲染，接收 field / value / count / expanded / aggregates / toggle。</p>
        <div class="mode-panel">
          <adv-table
            mode="default"
            :data="surfaceGroupData"
            :columns="surfaceCols"
            :row-group-config="{ field: 'department', defaultExpandAll: true }"
            height="250px"
          >
            <template #groupHeader="{ field, value, count, expanded, toggle }">
              <div class="surface-group-header">
                <ElButton
                  size="small"
                  @click="toggle"
                >
                  {{ expanded ? '▼' : '▶' }}
                </ElButton>
                <strong>{{ field }}=</strong><em>{{ value }}</em>
                <span class="surface-group-count">({{ count }} 行)</span>
              </div>
            </template>
          </adv-table>
        </div>

        <h3>error（渲染错误兜底）</h3>
        <p>渲染器异常时的兜底插槽，接收 error。</p>
        <div class="mode-panel">
          <p style="color: #909399">
            （此插槽仅在渲染器异常时触发；正常状态下不显示。下方为占位示例。）
          </p>
          <adv-table
            mode="default"
            :data="surfaceData"
            :columns="surfaceCols"
            height="100px"
          >
            <template #error="{ error }">
              <div class="surface-error-slot">
                渲染异常：{{ error?.message ?? 'unknown' }}
              </div>
            </template>
          </adv-table>
        </div>

        <h3>动态列单元格插槽 + 表头插槽</h3>
        <p>插槽名 = 列 prop（单元格）或 <code>${prop}-header</code>（表头）。</p>
        <div class="mode-panel">
          <adv-table
            mode="default"
            :data="surfaceData"
            :columns="surfaceCols"
            height="250px"
          >
            <template #name="{ row, cellData, index }">
              <span class="surface-cell-slot">👤 {{ cellData }} (#{{ index }}) - {{ row?.status }}</span>
            </template>
            <template #name-header>
              <span class="surface-header-slot">📛 姓名(自定义表头)</span>
            </template>
          </adv-table>
        </div>

        <!-- ════════════════════════════════════════════════════════════
             EXPOSE（全量覆盖）
             ════════════════════════════════════════════════════════════ -->
        <h2>Expose（全量）</h2>
        <p>通过 <code>ref</code> 访问实例 API。下方按钮触发各 expose 方法。</p>

        <h3>数据 / 分页 / 选择</h3>
        <div class="mode-panel">
          <div class="surface-api-buttons">
            <ElButton @click="surfaceApiCall('refresh')">
              refresh
            </ElButton>
            <ElButton @click="surfaceApiCall('getFullData')">
              getFullData
            </ElButton>
            <ElButton @click="surfaceApiCall('getCurrentPageData')">
              getCurrentPageData
            </ElButton>
            <ElButton @click="surfaceApiCall('applyTransaction')">
              applyTransaction
            </ElButton>
            <ElButton @click="surfaceApiCall('getRenderData')">
              getRenderData
            </ElButton>
            <ElButton @click="surfaceApiCall('setCurrentPage')">
              setCurrentPage(1)
            </ElButton>
            <ElButton @click="surfaceApiCall('setPageSize')">
              setPageSize(5)
            </ElButton>
            <ElButton @click="surfaceApiCall('getPagination')">
              getPagination
            </ElButton>
            <ElButton @click="surfaceApiCall('clearSelection')">
              clearSelection
            </ElButton>
            <ElButton @click="surfaceApiCall('selectAll')">
              selectAll
            </ElButton>
            <ElButton @click="surfaceApiCall('invertSelection')">
              invertSelection
            </ElButton>
            <ElButton @click="surfaceApiCall('getSelectedRows')">
              getSelectedRows
            </ElButton>
            <ElButton @click="surfaceApiCall('getSelectedCount')">
              getSelectedCount
            </ElButton>
            <ElButton @click="surfaceApiCall('getSelectedKeys')">
              getSelectedKeys
            </ElButton>
            <ElButton @click="surfaceApiCall('selectAllFiltered')">
              selectAllFiltered
            </ElButton>
            <ElButton @click="surfaceApiCall('deselectAllFiltered')">
              deselectAllFiltered
            </ElButton>
            <ElButton @click="surfaceApiCall('selectAllOnCurrentPage')">
              selectAllOnCurrentPage
            </ElButton>
            <ElButton @click="surfaceApiCall('deselectAllOnCurrentPage')">
              deselectAllOnCurrentPage
            </ElButton>
            <ElButton @click="surfaceApiCall('deselectAll')">
              deselectAll
            </ElButton>
            <ElButton @click="surfaceApiCall('selectRowByKey')">
              selectRowByKey('2')
            </ElButton>
            <ElButton @click="surfaceApiCall('selectRowsByKeys')">
              selectRowsByKeys(['3','4'])
            </ElButton>
            <ElButton @click="surfaceApiCall('isSelectedByKey')">
              isSelectedByKey('1')
            </ElButton>
            <ElButton @click="surfaceApiCall('replaceSelection')">
              replaceSelection(['1'])
            </ElButton>
            <ElButton @click="surfaceApiCall('forEachSelected')">
              forEachSelected
            </ElButton>
            <ElButton @click="surfaceApiCall('getSelectedIndices')">
              getSelectedIndices
            </ElButton>
            <ElButton @click="surfaceApiCall('setSelection')">
              setSelection(['1','2'])
            </ElButton>
            <ElButton @click="surfaceApiCall('toggleRowSelection')">
              toggleRowSelection
            </ElButton>
            <ElButton @click="surfaceApiCall('toggleAllSelection')">
              toggleAllSelection
            </ElButton>
            <ElButton @click="surfaceApiCall('setCurrentRow')">
              setCurrentRow
            </ElButton>
            <ElButton @click="surfaceApiCall('getCurrentRow')">
              getCurrentRow
            </ElButton>
            <ElButton @click="surfaceApiCall('refreshSelection')">
              refreshSelection
            </ElButton>
            <ElButton @click="surfaceApiCall('initSelectionByKeys')">
              initSelectionByKeys(['1'])
            </ElButton>
          </div>
          <adv-table
            ref="surfaceApiRef"
            mode="default"
            :data="surfaceData"
            :columns="surfaceCols"
            :row-config="{ rowKey: 'id', rowSelection: 'multiple' }"
            :pagination="{ pageSize: 5 }"
            height="250px"
          />
        </div>

        <h3>搜索 / 筛选 / 排序</h3>
        <div class="mode-panel">
          <div class="surface-api-buttons">
            <ElButton @click="surfaceApiCall('getQueryFormModel', surfaceApi2Ref)">
              getQueryFormModel
            </ElButton>
            <ElButton @click="surfaceApiCall('setQueryFormModel', surfaceApi2Ref)">
              setQueryFormModel
            </ElButton>
            <ElButton @click="surfaceApiCall('setFilter', surfaceApi2Ref)">
              setFilter(age&gt;30)
            </ElButton>
            <ElButton @click="surfaceApiCall('resetColumnFilter', surfaceApi2Ref)">
              resetColumnFilter(age)
            </ElButton>
            <ElButton @click="surfaceApiCall('resetAllFilters', surfaceApi2Ref)">
              resetAllFilters
            </ElButton>
            <ElButton @click="surfaceApiCall('getFilterValue', surfaceApi2Ref)">
              getFilterValue(age)
            </ElButton>
            <ElButton @click="surfaceApiCall('isColumnFiltered', surfaceApi2Ref)">
              isColumnFiltered(age)
            </ElButton>
            <ElButton @click="surfaceApiCall('hasActiveFilter', surfaceApi2Ref)">
              hasActiveFilter
            </ElButton>
            <ElButton @click="surfaceApiCall('hasActiveQuickFilter', surfaceApi2Ref)">
              hasActiveQuickFilter
            </ElButton>
            <ElButton @click="surfaceApiCall('setQuickFilter', surfaceApi2Ref)">
              setQuickFilter('张三')
            </ElButton>
            <ElButton @click="surfaceApiCall('getQuickFilter', surfaceApi2Ref)">
              getQuickFilter
            </ElButton>
            <ElButton @click="surfaceApiCall('toggleSort', surfaceApi2Ref)">
              toggleSort(name)
            </ElButton>
            <ElButton @click="surfaceApiCall('setSort', surfaceApi2Ref)">
              setSort(name,asc)
            </ElButton>
            <ElButton @click="surfaceApiCall('setSorts', surfaceApi2Ref)">
              setSorts([age desc])
            </ElButton>
            <ElButton @click="surfaceApiCall('clearSort', surfaceApi2Ref)">
              clearSort
            </ElButton>
            <ElButton @click="surfaceApiCall('getSortOrder', surfaceApi2Ref)">
              getSortOrder(name)
            </ElButton>
            <ElButton @click="surfaceApiCall('getSortIndex', surfaceApi2Ref)">
              getSortIndex(name)
            </ElButton>
          </div>
          <adv-table
            ref="surfaceApi2Ref"
            mode="default"
            :data="surfaceData"
            :columns="surfaceCols"
            :search="{ enabled: true, fields: [{ prop: 'name', label: '姓名' }] }"
            height="250px"
          />
        </div>

        <h3>编辑 / 校验 / 历史</h3>
        <div class="mode-panel">
          <div class="surface-api-buttons">
            <ElButton @click="surfaceApiCall('startEditing', surfaceApi3Ref)">
              startEditing
            </ElButton>
            <ElButton @click="surfaceApiCall('stopEditing', surfaceApi3Ref)">
              stopEditing
            </ElButton>
            <ElButton @click="surfaceApiCall('submitEdit', surfaceApi3Ref)">
              submitEdit
            </ElButton>
            <ElButton @click="surfaceApiCall('discardEdit', surfaceApi3Ref)">
              discardEdit
            </ElButton>
            <ElButton @click="surfaceApiCall('commitBatchEdit', surfaceApi3Ref)">
              commitBatchEdit
            </ElButton>
            <ElButton @click="surfaceApiCall('cancelBatchEdit', surfaceApi3Ref)">
              cancelBatchEdit
            </ElButton>
            <ElButton @click="surfaceApiCall('hasPendingChanges', surfaceApi3Ref)">
              hasPendingChanges
            </ElButton>
            <ElButton @click="surfaceApiCall('batchHasPending', surfaceApi3Ref)">
              batchHasPending
            </ElButton>
            <ElButton @click="surfaceApiCall('validate', surfaceApi3Ref)">
              validate
            </ElButton>
            <ElButton @click="surfaceApiCall('validateRow', surfaceApi3Ref)">
              validateRow
            </ElButton>
            <ElButton @click="surfaceApiCall('clearValidate', surfaceApi3Ref)">
              clearValidate
            </ElButton>
            <ElButton @click="surfaceApiCall('undo', surfaceApi3Ref)">
              undo
            </ElButton>
            <ElButton @click="surfaceApiCall('redo', surfaceApi3Ref)">
              redo
            </ElButton>
            <ElButton @click="surfaceApiCall('canUndo', surfaceApi3Ref)">
              canUndo
            </ElButton>
            <ElButton @click="surfaceApiCall('canRedo', surfaceApi3Ref)">
              canRedo
            </ElButton>
            <ElButton @click="surfaceApiCall('hasUnsavedChanges', surfaceApi3Ref)">
              hasUnsavedChanges
            </ElButton>
            <ElButton @click="surfaceApiCall('getRowKey', surfaceApi3Ref)">
              getRowKey
            </ElButton>
          </div>
          <adv-table
            ref="surfaceApi3Ref"
            mode="default"
            :data="surfaceEditData"
            :columns="surfaceEditCols"
            :edit-config="{ singleClickEdit: true }"
            height="250px"
          />
        </div>

        <h3>导入导出 / 打印 / 右键菜单 / 列状态</h3>
        <div class="mode-panel">
          <div class="surface-api-buttons">
            <ElButton @click="surfaceApiCall('exportExcel', surfaceApi4Ref)">
              exportExcel
            </ElButton>
            <ElButton @click="surfaceApiCall('exportCsv', surfaceApi4Ref)">
              exportCsv
            </ElButton>
            <ElButton @click="surfaceApiCall('print', surfaceApi4Ref)">
              print
            </ElButton>
            <ElButton @click="surfaceApiCall('triggerImport', surfaceApi4Ref)">
              triggerImport
            </ElButton>
            <ElButton @click="surfaceApiCall('showContextMenu', surfaceApi4Ref)">
              showContextMenu
            </ElButton>
            <ElButton @click="surfaceApiCall('hideContextMenu', surfaceApi4Ref)">
              hideContextMenu
            </ElButton>
            <ElButton @click="surfaceApiCall('getColumnState', surfaceApi4Ref)">
              getColumnState
            </ElButton>
            <ElButton @click="surfaceApiCall('applyColumnState', surfaceApi4Ref)">
              applyColumnState
            </ElButton>
            <ElButton @click="surfaceApiCall('resetColumnState', surfaceApi4Ref)">
              resetColumnState
            </ElButton>
            <ElButton @click="surfaceApiCall('saveView', surfaceApi4Ref)">
              saveView
            </ElButton>
            <ElButton @click="surfaceApiCall('applyView', surfaceApi4Ref)">
              applyView
            </ElButton>
            <ElButton @click="surfaceApiCall('getSavedViews', surfaceApi4Ref)">
              getSavedViews
            </ElButton>
            <ElButton @click="surfaceApiCall('deleteView', surfaceApi4Ref)">
              deleteView
            </ElButton>
          </div>
          <adv-table
            ref="surfaceApi4Ref"
            mode="default"
            :data="surfaceData"
            :columns="surfaceCols"
            :toolbar="{ exportExcel: true, exportCsv: true, print: true, import: true }"
            :menu-config="{ body: { enabled: true, options: [['copyCell', 'copyRow']] } }"
            height="250px"
          />
        </div>

        <h3>树形 / 行分组 / 展开行 / 行固定 / 滚动</h3>
        <div class="mode-panel">
          <div class="surface-api-buttons">
            <ElButton @click="surfaceApiCall('toggleTreeNodeExpand', surfaceApi5Ref)">
              toggleTreeNodeExpand
            </ElButton>
            <ElButton @click="surfaceApiCall('expandTreeNode', surfaceApi5Ref)">
              expandTreeNode
            </ElButton>
            <ElButton @click="surfaceApiCall('collapseTreeNode', surfaceApi5Ref)">
              collapseTreeNode
            </ElButton>
            <ElButton @click="surfaceApiCall('expandAllTreeNodes', surfaceApi5Ref)">
              expandAllTreeNodes
            </ElButton>
            <ElButton @click="surfaceApiCall('collapseAllTreeNodes', surfaceApi5Ref)">
              collapseAllTreeNodes
            </ElButton>
            <ElButton @click="surfaceApiCall('getTreeMeta', surfaceApi5Ref)">
              getTreeMeta
            </ElButton>
            <ElButton @click="surfaceApiCall('toggleDetailRowExpand', surfaceApi5Ref)">
              toggleDetailRowExpand
            </ElButton>
            <ElButton @click="surfaceApiCall('expandDetailRow', surfaceApi5Ref)">
              expandDetailRow
            </ElButton>
            <ElButton @click="surfaceApiCall('collapseDetailRow', surfaceApi5Ref)">
              collapseDetailRow
            </ElButton>
            <ElButton @click="surfaceApiCall('expandAllDetailRows', surfaceApi5Ref)">
              expandAllDetailRows
            </ElButton>
            <ElButton @click="surfaceApiCall('collapseAllDetailRows', surfaceApi5Ref)">
              collapseAllDetailRows
            </ElButton>
            <ElButton @click="surfaceApiCall('toggleGroupExpand', surfaceApi5Ref)">
              toggleGroupExpand
            </ElButton>
            <ElButton @click="surfaceApiCall('expandAllGroups', surfaceApi5Ref)">
              expandAllGroups
            </ElButton>
            <ElButton @click="surfaceApiCall('collapseAllGroups', surfaceApi5Ref)">
              collapseAllGroups
            </ElButton>
            <ElButton @click="surfaceApiCall('pinRow', surfaceApi5Ref)">
              pinRow('1',top)
            </ElButton>
            <ElButton @click="surfaceApiCall('unpinRow', surfaceApi5Ref)">
              unpinRow('1')
            </ElButton>
            <ElButton @click="surfaceApiCall('isRowPinned', surfaceApi5Ref)">
              isRowPinned('1')
            </ElButton>
            <ElButton @click="surfaceApiCall('clearPinnedRows', surfaceApi5Ref)">
              clearPinnedRows
            </ElButton>
            <ElButton @click="surfaceApiCall('scrollToRow', surfaceApi5Ref)">
              scrollToRow('3')
            </ElButton>
            <ElButton @click="surfaceApiCall('scrollToColumn', surfaceApi5Ref)">
              scrollToColumn(name)
            </ElButton>
          </div>
          <adv-table
            ref="surfaceApi5Ref"
            mode="default"
            :data="surfaceData"
            :columns="surfaceCols"
            :row-config="{ rowKey: 'id' }"
            :tree-config="{ children: 'children' }"
            height="250px"
          />
        </div>

        <h3>loading / tableRootRef / version</h3>
        <div class="mode-panel">
          <div class="surface-api-buttons">
            <ElButton @click="surfaceApiCall('setLoading', surfaceApi6Ref)">
              setLoading（内部 loading 取反）
            </ElButton>
            <ElButton @click="surfaceApiCall('tableRootRef', surfaceApi6Ref)">
              tableRootRef
            </ElButton>
            <ElButton @click="surfaceApiCall('version', surfaceApi6Ref)">
              version
            </ElButton>
          </div>
          <adv-table
            ref="surfaceApi6Ref"
            mode="default"
            :data="surfaceData"
            :columns="surfaceCols"
            :search="{ enabled: true, fields: [{ prop: 'name', label: '姓名' }] }"
            height="250px"
          />
        </div>

        <h3>loading / 编辑值读写（updateCellEditingValue / getCellEditingValue）</h3>
        <p>暴露的响应式 Ref 与编辑值通道：先对第 0 行 name 列 startEditing 并改写值，再读回当前编辑值。</p>
        <div class="mode-panel">
          <div class="surface-api-buttons">
            <ElButton @click="surfaceApiCall('loading', surfaceApi7Ref)">
              loading
            </ElButton>
            <ElButton @click="surfaceApiCall('updateCellEditingValue', surfaceApi7Ref)">
              updateCellEditingValue
            </ElButton>
            <ElButton @click="surfaceApiCall('getCellEditingValue', surfaceApi7Ref)">
              getCellEditingValue
            </ElButton>
          </div>
          <adv-table
            ref="surfaceApi7Ref"
            mode="default"
            :data="surfaceEditData"
            :columns="surfaceEditCols"
            :edit-config="{ singleClickEdit: true }"
            height="250px"
          />
        </div>

        <!-- API 调用日志 -->
        <h3>API 调用日志</h3>
        <SurfaceEventBoard section="apiLog" />
      </div>

      <!-- 11.2 performanceProfile 独立演示 -->
      <div
        v-else-if="selectedDemo === 'performanceProfileDemo'"
        class="demo-section"
      >
        <h1>11.2 性能档位 (performanceProfile)</h1>
        <p>低端设备通过 <code>performance-profile="low"</code> 关闭滚动看门狗/滚动速度追踪/hover 鼠标追踪等重路径；默认 <code>high</code>。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default · low</h4>
            <adv-table
              mode="default"
              :data="surfaceData"
              :columns="surfaceCols"
              performance-profile="low"
              height="300px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual · high</h4>
            <adv-table
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              performance-profile="high"
              height="300px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'modeSwitchBehaviorDemo'"
        class="demo-section"
      >
        <h1>11.3 模式切换策略 (modeSwitchBehavior)</h1>
        <p>运行时切换 <code>mode</code> 的行为策略：<code>warn</code>（默认，清理状态并在 dev 派发 info 通知）、<code>silent</code>（同 warn 但不派发通知）、<code>error</code>（抛 TypeError 阻止切换，强制 v-if 重建）。</p>
        <div class="mode-panel">
          <div style="margin-bottom:10px;display:flex;gap:8px;align-items:center">
            <ElButton @click="cycleModeBehavior()">
              切换模式 (当前: {{ surfaceMode }})
            </ElButton>
            <span style="font-size:12px;color:#909399">behavior: {{ surfaceBehavior }}</span>
            <ElSelect
              v-model="surfaceBehavior"
              size="small"
              style="width:120px"
            >
              <ElOption
                label="warn"
                value="warn"
              />
              <ElOption
                label="silent"
                value="silent"
              />
              <ElOption
                label="error"
                value="error"
              />
            </ElSelect>
          </div>
          <adv-table
            v-if="surfaceMode === 'default'"
            :key="`mode-${surfaceMode}-${surfaceBehavior}`"
            mode="default"
            :data="surfaceData"
            :columns="surfaceCols"
            :mode-switch-behavior="surfaceBehavior"
            height="320px"
          />
          <adv-table
            v-else
            :key="`mode-${surfaceMode}-${surfaceBehavior}`"
            mode="virtual"
            :data="surfaceData"
            :columns="surfaceCols"
            :mode-switch-behavior="surfaceBehavior"
            height="320px"
          />
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'estimatedRowHeightDemo'"
        class="demo-section"
      >
        <h1>11.4 预估行高 (estimatedRowHeight)</h1>
        <p>仅 <code>mode="virtual"</code> 生效，透传给 ElTableV2 的 <code>estimated-row-height</code>。设为数值后切换为 DynamicSizeGrid，逐行测量真实高度，性能下降；内部在检测到 <code>append</code> 插槽或已展开的详情行时自动回退到 <code>rowHeight</code> 以避免裁切。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Virtual · 固定行高 (默认)</h4>
            <adv-table
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              height="300px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual · estimatedRowHeight=48</h4>
            <adv-table
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              :estimated-row-height="48"
              height="300px"
            />
          </div>
        </div>
        <div
          class="mode-panel"
          style="margin-top:16px"
        >
          <h4>Virtual · estimatedRowHeight=80 + append 合成行（自动回退验证）</h4>
          <adv-table
            mode="virtual"
            :data="surfaceData"
            :columns="surfaceCols"
            :estimated-row-height="80"
            height="300px"
          >
            <template #append>
              <div class="surface-append-row">
                —— append 合成行触发动态行高回退 ——
              </div>
            </template>
          </adv-table>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'includeSyntheticDemo'"
        class="demo-section"
      >
        <h1>11.5 合成行分页 (pagination.includeSynthetic)</h1>
        <p><code>includeSynthetic</code> 控制合成行（DetailRow/GroupHeader）是否计入分页容量。<code>true</code>（默认）时计入分页，<code>false</code> 时仅数据行计入，合成行在分页后追加。下方用行分组 + 分页对比。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default · includeSynthetic: true（默认）</h4>
            <adv-table
              mode="default"
              :data="rowGroupData"
              :columns="rowGroupColumns"
              :row-group-config="rowGroupConfig"
              :pagination="{ pageSize: 5, includeSynthetic: true }"
              height="360px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual · includeSynthetic: false</h4>
            <adv-table
              mode="virtual"
              :data="rowGroupData"
              :columns="rowGroupColumns"
              :row-group-config="rowGroupConfig"
              :pagination="{ pageSize: 5, includeSynthetic: false }"
              height="360px"
            />
          </div>
        </div>
        <div
          class="dual-mode"
          style="margin-top:16px"
        >
          <div class="mode-panel">
            <h4>Default · 行展开 + includeSynthetic:true</h4>
            <adv-table
              mode="default"
              :data="rowExpandData"
              :columns="rowExpandColumns"
              :row-expand-config="rowExpandConfig"
              :pagination="{ pageSize: 5, includeSynthetic: true }"
              height="320px"
            >
              <template #expandRow="{ row }">
                <div class="surface-expand-content">
                  {{ row.orderNo }} 详情
                </div>
              </template>
            </adv-table>
          </div>
          <div class="mode-panel">
            <h4>Virtual · 行展开 + includeSynthetic:false</h4>
            <adv-table
              mode="virtual"
              :data="rowExpandData"
              :columns="rowExpandColumns"
              :row-expand-config="rowExpandConfig"
              :pagination="{ pageSize: 5, includeSynthetic: false }"
              height="320px"
            >
              <template #expandRow="{ row }">
                <div class="surface-expand-content">
                  {{ row.orderNo }} 详情
                </div>
              </template>
            </adv-table>
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'filterConfigDemo'"
        class="demo-section"
      >
        <h1>11.6 筛选配置 (filterConfig)</h1>
        <p><code>filterConfig</code> 控制列头筛选行为：<code>floatingFilter</code> 浮动筛选、<code>quickFilterDebounce</code> 全局搜索防抖、<code>quickFilterCacheSize</code> 文本缓存上限、侧边筛选面板等。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default · floatingFilter + quickFilterDebounce=500</h4>
            <ElInput
              v-model="quickFilterText"
              placeholder="全局搜索（500ms 防抖）"
              clearable
              style="margin-bottom:8px"
            />
            <adv-table
              mode="default"
              :data="filterSortData"
              :columns="filterSortColumns"
              :filter-config="{ floatingFilter: true, quickFilterDebounce: 500, quickFilterCacheSize: 3000 }"
              :quick-filter="quickFilterText"
              height="360px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual · floatingFilter + quickFilterDebounce=100</h4>
            <ElInput
              v-model="quickFilterText"
              placeholder="全局搜索（100ms 防抖）"
              clearable
              style="margin-bottom:8px"
            />
            <adv-table
              mode="virtual"
              :data="filterSortData"
              :columns="filterSortColumns"
              :filter-config="{ floatingFilter: true, quickFilterDebounce: 100, quickFilterCacheSize: 5000 }"
              :quick-filter="quickFilterText"
              height="360px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'sortConfigDemo'"
        class="demo-section"
      >
        <h1>11.7 排序配置 (sortConfig)</h1>
        <p><code>sortConfig.maxSortColumns</code> 限制多列排序上限（Shift+点击）。超出时 FIFO 淘汰最早的排序列；设为 1 等价于关闭多列排序。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default · maxSortColumns: 1（单列排序）</h4>
            <adv-table
              mode="default"
              :data="surfaceData"
              :columns="surfaceCols"
              :sort-config="{ maxSortColumns: 1 }"
              height="320px"
              @sort-change="({ sortState }: any) => surfaceLog.push(`sortChange max1: ${sortState.map((s:any) => `${s.prop}:${s.order}`).join(',')}`)"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual · maxSortColumns: 2</h4>
            <adv-table
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              :sort-config="{ maxSortColumns: 2 }"
              height="320px"
              @sort-change="({ sortState }: any) => surfaceLog.push(`sortChange max2: ${sortState.map((s:any) => `${s.prop}:${s.order}`).join(',')}`)"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'rowPinConfigDemo'"
        class="demo-section"
      >
        <h1>11.8 行固定 (rowPinConfig)</h1>
        <p>将指定行固定在顶部或底部，滚动时始终可见。配合 API <code>pinRow/unpinRow/isRowPinned/clearPinnedRows</code> 动态控制。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default · topRowKeys:['1'] bottomRowKeys:['5']</h4>
            <adv-table
              ref="surfaceApiRef"
              mode="default"
              :data="surfaceData"
              :columns="surfaceCols"
              :row-config="{ rowKey: 'id' }"
              :row-pin-config="{ topRowKeys: ['1'], bottomRowKeys: ['5'] }"
              height="320px"
            />
            <div style="margin-top:8px;display:flex;gap:6px">
              <ElButton
                size="small"
                @click="surfaceApiRef?.pinRow?.('2', 'top')"
              >
                pin 2 top
              </ElButton>
              <ElButton
                size="small"
                @click="surfaceApiRef?.unpinRow?.('1')"
              >
                unpin 1
              </ElButton>
              <ElButton
                size="small"
                @click="surfaceApiRef?.clearPinnedRows?.()"
              >
                clear
              </ElButton>
            </div>
          </div>
          <div class="mode-panel">
            <h4>Virtual · topRowKeys:['2'] bottomRowKeys:['6']</h4>
            <adv-table
              ref="surfaceApi2Ref"
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              :row-config="{ rowKey: 'id' }"
              :row-pin-config="{ topRowKeys: ['2'], bottomRowKeys: ['6'] }"
              height="320px"
            />
            <div style="margin-top:8px;display:flex;gap:6px">
              <ElButton
                size="small"
                @click="surfaceApi2Ref?.pinRow?.('3', 'bottom')"
              >
                pin 3 bottom
              </ElButton>
              <ElButton
                size="small"
                @click="surfaceApi2Ref?.isRowPinned?.('2') && surfaceLog.push('isRowPinned 2 true')"
              >
                isPinned 2
              </ElButton>
            </div>
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'debugDemo'"
        class="demo-section"
      >
        <h1>11.9 调试模式 (debug)</h1>
        <p>开启后输出管线/编辑/选择/渲染诊断信息。支持简写 <code>true</code>（等价 <code>{enabled:true, perf:true}</code>）与对象形态 <code>{enabled, perf, domains}</code> 按域过滤。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default · { enabled:true, perf:true }</h4>
            <adv-table
              mode="default"
              :data="surfaceData"
              :columns="surfaceCols"
              :debug="{ enabled: true, perf: true }"
              height="300px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual · { enabled:true, domains:['data','edit'] }</h4>
            <adv-table
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              :debug="{ enabled: true, domains: ['data', 'edit'] }"
              height="300px"
            />
          </div>
        </div>
        <div
          class="mode-panel"
          style="margin-top:16px"
        >
          <h4>简写 true（等价 enabled+perf）</h4>
          <adv-table
            mode="default"
            :data="surfaceData"
            :columns="surfaceCols"
            :debug="true"
            height="200px"
          />
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'virtualConfigDemo'"
        class="demo-section"
      >
        <h1>11.10 虚拟滚动配置 (virtual)</h1>
        <p>Virtual 模式下通过 <code>estimatedRowHeight</code> + <code>height</code> 控制虚拟滚动视口与动态行高。Default 模式忽略 <code>estimatedRowHeight</code>。下方对比固定行高 vs 动态行高 + 合成行触发回退。</p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Virtual · 固定行高（默认，FixedSizeGrid）</h4>
            <adv-table
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              height="320px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual · estimatedRowHeight=48（DynamicSizeGrid）</h4>
            <adv-table
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              :estimated-row-height="48"
              height="320px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'stripeDemo'"
        class="demo-section"
      >
        <h1>11.12 斑马纹 (stripe)</h1>
        <p><code>stripe</code> 控制斑马纹。Default 模式透传给 ElTable，Virtual 模式通过 row-class-name 实现等价效果。下方开关实时切换，观察奇偶行背景差异。</p>
        <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px">
          <span style="font-size: 13px; color: #606266">斑马纹开关：</span>
          <ElSwitch
            v-model="stripeEnabled"
            active-text="开启"
            inactive-text="关闭"
          />
          <span style="font-size: 12px; color: #909399; margin-left: 12px">当前：{{ stripeEnabled ? 'stripe=true' : 'stripe=false' }}</span>
        </div>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default · {{ stripeEnabled ? 'stripe=true' : 'stripe=false' }}</h4>
            <adv-table
              mode="default"
              :data="surfaceData"
              :columns="surfaceCols"
              :stripe="stripeEnabled"
              height="300px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual · {{ stripeEnabled ? 'stripe=true' : 'stripe=false' }}</h4>
            <adv-table
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              :stripe="stripeEnabled"
              height="300px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'showHeaderDemo'"
        class="demo-section"
      >
        <h1>11.13 表头显隐 (showHeader)</h1>
        <p><code>show-header="false"</code> 隐藏表头，两种模式均生效。开关切换时表头应整体消失/出现。</p>
        <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px">
          <span style="font-size: 13px; color: #606266">显示表头：</span>
          <ElSwitch
            v-model="showHeaderEnabled"
            active-text="显示"
            inactive-text="隐藏"
          />
          <span style="font-size: 12px; color: #909399; margin-left: 12px">当前：showHeader={{ String(showHeaderEnabled) }}</span>
        </div>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default · {{ showHeaderEnabled ? 'true' : 'false' }}</h4>
            <adv-table
              mode="default"
              :data="surfaceData"
              :columns="surfaceCols"
              :show-header="showHeaderEnabled"
              height="300px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual · {{ showHeaderEnabled ? 'true' : 'false' }}</h4>
            <adv-table
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              :show-header="showHeaderEnabled"
              height="300px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'sizeDemo'"
        class="demo-section"
      >
        <h1>11.14 表格尺寸 (size)</h1>
        <p><code>size="small"</code> / <code>default</code> / <code>large</code> 透传给 ElTable 的 size prop，Virtual 模式下通过 mergedSizeConfig 影响 rowHeight/header 高度。下方选择器实时切换。</p>
        <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px">
          <span style="font-size: 13px; color: #606266">表格尺寸：</span>
          <ElSelect
            v-model="sizeDemoValue"
            size="small"
            style="width: 140px"
          >
            <ElOption
              label="Large"
              value="large"
            />
            <ElOption
              label="Default"
              value="default"
            />
            <ElOption
              label="Small"
              value="small"
            />
          </ElSelect>
          <span style="font-size: 12px; color: #909399">当前：size="{{ sizeDemoValue }}"（观察行高/表头高度/内边距变化）</span>
        </div>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default · {{ sizeDemoValue }}</h4>
            <adv-table
              mode="default"
              :data="surfaceData"
              :columns="surfaceCols"
              :size="sizeDemoValue"
              height="300px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual · {{ sizeDemoValue }}</h4>
            <adv-table
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              :size="sizeDemoValue"
              height="300px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'tableLayoutDemo'"
        class="demo-section"
      >
        <h1>11.15 布局算法 (tableLayout)</h1>
        <p><code>table-layout="fixed"</code>（默认）列宽由表格宽度决定；<code>auto</code> 列宽由内容决定。Virtual 模式下 ElTableV2 始终为 fixed 布局，此 demo 主要展示 Default 模式差异，Virtual 侧作为对照。</p>
        <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px">
          <span style="font-size: 13px; color: #606266">布局算法：</span>
          <ElRadioGroup
            v-model="tableLayoutDemoValue"
            size="small"
          >
            <ElRadio value="fixed">
              fixed
            </ElRadio>
            <ElRadio value="auto">
              auto
            </ElRadio>
          </ElRadioGroup>
          <span style="font-size: 12px; color: #909399">当前：tableLayout="{{ tableLayoutDemoValue }}"（fixed 列宽固定，auto 按内容自适应；可观察列宽是否随内容拉伸）</span>
        </div>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default · {{ tableLayoutDemoValue }}</h4>
            <adv-table
              mode="default"
              :data="surfaceData"
              :columns="surfaceCols"
              :table-layout="tableLayoutDemoValue"
              height="300px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual · {{ tableLayoutDemoValue }}（对照）</h4>
            <adv-table
              mode="virtual"
              :data="surfaceData"
              :columns="surfaceCols"
              :table-layout="tableLayoutDemoValue"
              height="300px"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="selectedDemo === 'tooltipFormatterDemo'"
        class="demo-section"
      >
        <h1>11.16 提示格式化 (tooltipFormatter)</h1>
        <p>表级别 <code>tooltipFormatter</code> 作为溢出 tooltip 默认格式化，可被列级别 <code>tooltipFormatter</code> 覆盖。演示使用窄列 + 超长文本（宽度 150 内的描述列文本溢出），鼠标悬浮溢出单元格时 tooltip 内容为 <code>[prop] name = value</code> 格式。</p>
        <p style="font-size: 12px; color: #909399; margin-bottom: 10px">
          👉 请将鼠标悬浮在“描述”列被截断的文本上，观察 tooltip 是否显示为格式化后的 <code>[description] 用户X = ...</code>
        </p>
        <div class="dual-mode">
          <div class="mode-panel">
            <h4>Default（悬浮描述列）</h4>
            <adv-table
              mode="default"
              :data="tooltipDemoData"
              :columns="tooltipDemoCols"
              :tooltip-formatter="surfaceTooltipFormatter"
              height="300px"
            />
          </div>
          <div class="mode-panel">
            <h4>Virtual（悬浮描述列）</h4>
            <adv-table
              mode="virtual"
              :data="tooltipDemoData"
              :columns="tooltipDemoCols"
              :tooltip-formatter="surfaceTooltipFormatter"
              height="300px"
            />
          </div>
        </div>
      </div>

      <!-- 默认显示整合示例 -->
      <div
        v-else
        class="demo-section"
      >
        <h1>欢迎使用 AdvTable 功能演示</h1>
        <p>请从左侧导航选择要查看的功能。</p>
        <p>
          或点击 <a
            href="#"
            @click.prevent="selectedDemo = 'mega'"
          >整合示例</a> 查看所有功能的综合演示。
        </p>
      </div>
    </main>
  </div>
</template>

<style lang="scss">
.table-demo {
  display: flex;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.sidebar {
  width: 280px;
  background: #f5f7fa;
  border-right: 1px solid #e4e7ed;
  overflow-y: auto;
  flex-shrink: 0;

  .sidebar-header {
    padding: 20px;
    border-bottom: 1px solid #e4e7ed;

    h2 {
      margin: 0;
      font-size: 18px;
      color: #303133;
    }
  }

  .sidebar-nav {
    padding: 10px 0;
  }

  .category-group {
    margin-bottom: 10px;

    .category-label {
      padding: 8px 20px;
      font-size: 13px;
      font-weight: 600;
      color: #909399;
    }

    .nav-item {
      padding: 8px 20px 8px 30px;
      font-size: 14px;
      color: #606266;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: #ecf5ff;
        color: #409eff;
      }

      &.active {
        background: #409eff;
        color: #fff;
      }
    }
  }
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #fff;
}

.demo-section {
  max-width: 1800px;
  margin: 0 auto;

  h1 {
    margin: 0 0 10px;
    font-size: 24px;
    color: #303133;
  }

  >p {
    margin: 0 0 20px;
    color: #909399;
  }
}

.demo-block {
  margin-bottom: 40px;
  padding: 20px;
  background: #fafafa;
  border-radius: 4px;

  h3 {
    margin: 0 0 15px;
    font-size: 18px;
    color: #303133;
  }
}

.dual-mode {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;

  @media (max-width: 1400px) {
    grid-template-columns: 1fr;
  }
}

.mode-panel {
  // min-height 而非固定 height：面板内为 h4 标题 + 固定高度表格（如 mega 高 600px），
  // 固定 600px 会裁掉底部分页栏；改由表格自身高度决定，virtual 的 AutoResizer 不受影响。
  // max-height 封顶：内容驱动高度下，异常增长会被面板无限放大；封顶后超限内容在面板内滚动，
  // 不再撑大页面。取值需高于最高合法用例（scrollSync 800px 容器 + 标题/按钮约 100px），取整 1000px。
  min-height: 600px;
  max-height: 1000px;
  min-width: 0;
  overflow-y: auto;

  h4 {
    margin: 0 0 10px;
    font-size: 14px;
    color: #606266;
    padding: 8px 12px;
    background: #ecf5ff;
    border-radius: 4px;
  }
}

.stack-mode {
  display: flex;
  flex-direction: column;
  gap: 24px;

  .mode-panel {
    width: 100%;
  }
}

.comp-header-tag {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  font-size: 12px;
  line-height: 1;
  color: #409eff;
  background: #ecf5ff;
  border-radius: 12px;
  white-space: nowrap;

  &--right {
    color: #67c23a;
    background: #f0f9eb;
  }
}

.mega-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 4px;
}

.log-panel {
  margin-top: 15px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 13px;
  color: #606266;
}

.demo-row {
  &--inactive {
    background-color: #fef0f0 !important;
  }

  &--even {
    background-color: #fafafa !important;
  }
}

//  § 11.1 API 表面全覆盖样式
.surface-append-row {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  color: #909399;
  font-size: 13px;
  background: #fafafa;
  border-top: 1px dashed #dcdfe6;
}

.surface-expand-content {
  padding: 12px 16px;
  background: #f5f7fa;
  border-radius: 4px;
  color: #606266;
  font-size: 13px;
}

.surface-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;

  .surface-group-count {
    color: #909399;
    font-size: 12px;
  }
}

.surface-error-slot {
  padding: 16px;
  color: #f56c6c;
  background: #fef0f0;
  border-radius: 4px;
  font-size: 13px;
  text-align: center;
}

.surface-cell-slot {
  color: #409eff;
  font-weight: 500;
}

.surface-header-slot {
  color: #67c23a;
  font-weight: 600;
}

.surface-api-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 4px;
  max-height: 120px;
  overflow-y: auto;
}

.surface-event-checklist {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  color: #606266;

  th,
  td {
    padding: 4px 8px;
    border: 1px solid #ebeef5;
    text-align: left;
  }

  th {
    background: #f5f7fa;
  }
}

.log-panel {
  .log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e4e7ed;
  }

  .log-content {
    max-height: 200px;
    overflow-y: auto;
    font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
    font-size: 12px;
  }

  .log-entry {
    padding: 4px 0;
    border-bottom: 1px dotted #e4e7ed;
    color: #606266;

    &:last-child {
      border-bottom: none;
    }
  }

  .log-empty {
    color: #c0c4cc;
    font-style: italic;
    text-align: center;
    padding: 12px;
  }
}
</style>
