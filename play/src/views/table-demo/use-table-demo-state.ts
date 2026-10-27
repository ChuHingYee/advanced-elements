/**
 * <zh/> TableDemo 全局状态管理 composable
 * <en/> TableDemo global state management composable
 *
 * <zh/> 当前为单文件消费形态：TableDemo.vue 在 setup 内调用一次并整包解构使用，
 * <zh/> 并未做 provide/inject 分层（TableDemo.vue 单文件过大是已知债务）。
 * <zh/> 若未来拆出 section 子组件，应把本 composable 的返回值经 provide/inject 注入，
 * <zh/> 避免每个 section 重复构建上百个 ref。
 * <en/> Currently single-consumer: TableDemo.vue calls this once in setup and destructures
 * <en/> the whole return — no provide/inject layering yet (the oversized TableDemo.vue is
 * <en/> known debt). If section components are extracted later, provide/inject this
 * <en/> composable's return value so sections don't rebuild the hundreds of refs.
 */
import type { CityRow, CompRow, ExpandOrderRow, GroupRow, RowData, TreeNode } from './types'
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'
import { compColumns, rowExpandColumns, treeColumns } from './columns'
import {
  addressData,
  asyncTreeData,
  colMergeData,
  DEPARTMENTS,
  dynamicParamsData,
  empData,
  genCompData,
  genData,
  genGroupData,
  genMultiSelectData,
  genTreeData,
  loadTreeData,
  mergeData,
  mockCompRequest,
  mockCustomFormatRequest,
  mockPaginatedRequest,
  mockTreeRequest,
  orderData,
  orderDetailsMap,
  rowExpandData,
  STATUS_LIST,
  validateData,
} from './demo-data'

export function useTableDemoState() {
  // <zh/> 数据 refs <en/> Data refs
  const basicData = ref<RowData[]>(genData(50))
  const allValueTypeData = ref<RowData[]>(genData(10))
  const groupData = ref<RowData[]>(genData(5))
  const optionData = ref<RowData[]>(genData(6))
  const filterSortData = ref<RowData[]>(genData(30))
  const pageData60 = ref<RowData[]>(genData(60))
  const pageData100 = ref<RowData[]>(genData(100))
  const editData = ref<RowData[]>(genData(20))
  const dragData = ref<RowData[]>(genData(15))
  const dragDataV2 = ref<RowData[]>(genData(15))
  const columnDragData = ref<RowData[]>(genData(20))
  const columnDragDataV2 = ref<RowData[]>(genData(20))
  const batchEditData = ref<RowData[]>(genData(10))
  const columnStateData = ref<RowData[]>(genData(10))
  const sidePanelComboData = ref<RowData[]>(genData(50))
  const cellRangeData = ref<RowData[]>(genData(20))
  const dragEventData = ref<RowData[]>(genData(10))
  const dragEventV2Data = ref<RowData[]>(genData(10))
  const p2EnhancedData = ref<RowData[]>(genData(10).map((row, i) => ({ ...row, name: `员工${i + 1}`, status: STATUS_LIST[i % 3]! })))
  const selectorData = ref<RowData[]>(genData(6))
  const f2BackspaceData = ref<RowData[]>(genData(6))
  const clipboardData = ref<RowData[]>(genData(10))
  const showStatusData = ref<RowData[]>(genData(6))
  const lifecycleData = ref<RowData[]>(genData(6))
  const multiSelectData = ref<RowData[]>(genMultiSelectData())
  const dynamicParamsDataRef = ref<CityRow[]>(dynamicParamsData)
  const activeMethodData = ref<RowData[]>(genData(10))
  const loseFocusData = ref<RowData[]>(genData(8))
  const popupEditData = ref<RowData[]>(genData(8).map(r => ({ ...r, description: `这是用户${r.id}的详细描述信息，用于测试弹窗编辑器` })))
  const popupPositionData = ref<RowData[]>(genData(8).map(r => ({ ...r, remark: `备注${r.id}`, description: `描述${r.id}` })))
  const validateDataRef = ref<RowData[]>(validateData)
  const orderDataRef = ref(orderData)
  const treeData = ref<TreeNode[]>(genTreeData())
  const asyncTreeDataRef = ref<TreeNode[]>(asyncTreeData)
  const rowGroupData = ref<GroupRow[]>(genGroupData(20))
  const rowExpandDataRef = ref(rowExpandData)
  const rowClassNameData = ref<RowData[]>(genData(20).map((row, i) => ({
    ...row,
    description: `这是用户${i + 1}的一段超长描述文本，用于测试溢出tooltip功能是否正常工作，当文本超出列宽时会显示省略号，鼠标悬浮时应该显示完整内容。当前状态为${row.status}。`,
  })))
  const teleportHoverData = ref<RowData[]>(genData(8))

  // <zh/> VModel demos <en/> VModel demos
  const vModelData = ref<RowData[]>(genData(10))
  const vModelDataV2 = ref<RowData[]>(genData(10))

  // <zh/> Mega demo（总示例：全部 props / v-model / 事件一次装配） <en/> Mega demo (master example: all props / v-model / events wired at once)
  const megaData = ref<CompRow[]>(genCompData(100))
  const megaQuickFilter = ref('')
  const megaSearchValues = ref<Record<string, any>>({})

  // <zh/> Mega：数据集切换（树形 / 展开行与扁平互斥；行分组叠加在扁平数据上） <en/> Mega: dataset switch (tree / expand rows are mutually exclusive with flat; row grouping layers on flat data)
  const megaDatasetKind = ref<'flat' | 'tree' | 'expand'>('flat')
  const megaTreeData = ref<TreeNode[]>(genTreeData())
  const megaExpandData = ref<ExpandOrderRow[]>([...rowExpandData])
  const megaTreeOn = computed({
    get: () => megaDatasetKind.value === 'tree',
    set: (v: boolean) => { megaDatasetKind.value = v ? 'tree' : 'flat' },
  })
  const megaExpandOn = computed({
    get: () => megaDatasetKind.value === 'expand',
    set: (v: boolean) => { megaDatasetKind.value = v ? 'expand' : 'flat' },
  })
  const megaDataset = computed<any[]>({
    get: () => megaDatasetKind.value === 'tree'
      ? megaTreeData.value
      : megaDatasetKind.value === 'expand'
        ? megaExpandData.value
        : megaData.value,
    set: (rows) => {
      if (megaDatasetKind.value === 'tree')
        megaTreeData.value = rows as TreeNode[]
      else if (megaDatasetKind.value === 'expand')
        megaExpandData.value = rows as ExpandOrderRow[]
      else
        megaData.value = rows as CompRow[]
    },
  })
  // <zh/> 扁平列在 compColumns 基础上给部分叶子列开编辑，便于演示编辑类事件 <en/> Flat columns extend compColumns with editable leaf columns to demo edit events
  function megaDecorateColumns(cols: any[]): any[] {
    return cols.map((c) => {
      if (c.children)
        return { ...c, children: megaDecorateColumns(c.children) }
      if (c.prop === 'name')
        return { ...c, editable: true, cellEditor: 'text' }
      if (c.prop === 'age')
        return { ...c, editable: true, cellEditor: 'number', cellEditorParams: { min: 0, max: 150 } }
      if (c.prop === 'salary')
        return { ...c, editable: true, cellEditor: 'number', cellEditorParams: { min: 0, precision: 2 } }
      return c
    })
  }
  const megaFlatColumns = megaDecorateColumns(compColumns)
  // <zh/> 表格列设置/拖拽会经 v-model:columns 回写，按数据集种类分别暂存，回切时保留用户列态 <en/> Column setting / drag writes back via v-model:columns; staged per dataset so user column state survives switching
  const megaColumnOverrides = ref<Record<'flat' | 'tree' | 'expand', any[] | undefined>>({
    flat: undefined,
    tree: undefined,
    expand: undefined,
  })
  const megaColumns = computed<any[]>({
    get: () => megaColumnOverrides.value[megaDatasetKind.value]
      ?? (megaDatasetKind.value === 'tree'
        ? treeColumns
        : megaDatasetKind.value === 'expand'
          ? rowExpandColumns
          : megaFlatColumns),
    set: (cols) => {
      megaColumnOverrides.value = { ...megaColumnOverrides.value, [megaDatasetKind.value]: cols }
    },
  })

  // <zh/> Mega：交互开关（配置常绑定，enabled 由开关控制） <en/> Mega: interaction toggles (config always bound; enabled gated by the toggle)
  const megaRequestOn = ref(false)
  const megaRowGroupOn = ref(false)
  const megaPinOn = ref(false)
  const megaSpanOn = ref(false)
  const megaRangeSelOn = ref(false)
  const megaMenuOn = ref(true)
  const megaDebugOn = ref(false)
  const megaLowPerfOn = ref(false)
  const megaStripe = ref(false)
  const megaShowHeader = ref(true)
  const megaLoading = ref(false)
  const megaBareOn = ref(false)
  const megaRowDragOn = ref(false)
  const megaExtFilterOn = ref(false)

  // <zh/> Mega：枚举选择器 <en/> Mega: enum selectors
  const megaSize = ref<'large' | 'default' | 'small'>('default')
  const megaTableLayout = ref<'fixed' | 'auto'>('fixed')
  const megaTooltipEffect = ref<'dark' | 'light'>('dark')
  const megaModeSwitchBehavior = ref<'warn' | 'error' | 'silent'>('warn')

  // <zh/> Mega：请求数据源（ON 时 request.source 优先生效，data 仅作为回退展示） <en/> Mega: request data source (when ON, request.source takes effect and data is fallback display only)
  const megaRequestSource = async (params: Record<string, unknown>) => {
    await new Promise(r => setTimeout(r, 200))
    const all = megaDataset.value
    // <zh/> 树形/展开数据集不做切片，避免破坏层级/合成行 <en/> Tree/expand datasets are not sliced to avoid breaking hierarchy / synthetic rows
    if (megaDatasetKind.value !== 'flat')
      return { data: [...all], total: all.length }
    const page = Number(params.page) || 1
    const size = Number(params.size) || 20
    return { data: all.slice((page - 1) * size, page * size), total: all.length }
  }
  const megaRequestConfig = computed(() =>
    megaRequestOn.value ? { source: megaRequestSource, auto: true, timeout: 10000 } : { auto: false },
  )

  // <zh/> Mega：静态子配置（形状合法性以 packages/table/src/types 为准） <en/> Mega: static sub-configs (shape validity per packages/table/src/types)
  const megaPerformanceProfile = computed(() => (megaLowPerfOn.value ? 'low' : 'high'))
  const megaToolbar = {
    columnSetting: true,
    refreshBtn: true,
    exportBtn: true,
    exportOptions: { filename: 'mega-demo', dataMode: 'all' as const },
    exportCsvBtn: true,
    exportCsvOptions: { filename: 'mega-demo.csv', bom: true },
    importBtn: true,
    importOptions: { mode: 'append' as const },
    printBtn: true,
    printOptions: { sheetName: 'Mega 总示例' },
  }
  const megaSearch = {
    enabled: true,
    collapsed: false,
    debounceTime: 300,
    labelWidth: 70,
    fields: [
      { prop: 'name', type: 'input' as const, componentProps: { placeholder: '请输入姓名', clearable: true }, itemProps: { label: '姓名' } },
      { prop: 'status', type: 'select' as const, componentProps: { placeholder: '请选择状态', clearable: true, options: [{ label: '启用', value: 'active' }, { label: '禁用', value: 'inactive' }, { label: '待审', value: 'pending' }] }, itemProps: { label: '状态' } },
      { prop: 'department', type: 'select' as const, componentProps: { placeholder: '请选择部门', clearable: true, options: DEPARTMENTS.map(d => ({ label: d, value: d })) }, itemProps: { label: '部门' } },
    ],
  }
  const megaPagination = { enabled: true, mode: 'client' as const, pageSize: 20, pageSizes: [10, 20, 50, 100], background: true }
  const megaUrlState = { enabled: false, pageKey: 'mega_p', sizeKey: 'mega_s' }
  const megaExternalFilter = {
    isExternalFilterPresent: () => megaExtFilterOn.value,
    doesExternalFilterPass: (row: any) => row?.status === 'active',
  }
  const megaSelectedRowKeys = ref<string[]>(['1', '3'])
  const megaEditConfig = {
    singleClickEdit: true,
    enableClipboard: true,
    enableUndo: true,
    showStatus: true,
    invalidEditValueMode: 'notify' as const,
    stopEditingWhenCellsLoseFocus: true,
  }
  const megaColumnConfig = { columnDraggable: true, defaultColDef: { resizable: true } }
  const megaRowConfig = computed(() => ({
    rowKey: 'id',
    rowSelection: 'multiple' as const,
    keepSelectionAcrossPages: true,
    rowDraggable: megaRowDragOn.value,
  }))
  const megaFilterConfig = { quickFilterDebounce: 200, floatingFilter: false }
  const megaSortConfig = { maxSortColumns: 2 }
  const megaSpanConfig = computed(() =>
    megaSpanOn.value && megaDatasetKind.value === 'flat' ? { rows: { department: true } } : {},
  )
  // <zh/> spanMethod 优先于 spanConfig；返回 undefined 回退内部自动合并逻辑 <en/> spanMethod takes precedence over spanConfig; returning undefined falls back to the built-in auto-merge logic
  const megaSpanMethod = () => undefined
  // <zh/> treeConfig 仅在树形数据集下绑定——`treeEnabled = treeConfig != null`，常驻绑定会让
  // <zh/> 扁平/展开数据集的所有行被当作树叶节点：首列渲染占位图标、行展开图标被 `!treeEnabled`
  // <zh/> 守卫抑制，展开行功能静默失效（占位图标不可点）。与 rowGroupConfig/spanConfig 同口径按数据集门控。
  // <en/> treeConfig is bound only for the tree dataset — `treeEnabled = treeConfig != null`, so an
  // <en/> always-on binding treats every flat/expand row as a tree leaf: the first column renders
  // <en/> placeholder icons and the row-expand icon is suppressed by the `!treeEnabled` guard,
  // <en/> silently disabling expand rows (placeholders are not clickable). Gated by dataset kind,
  // <en/> same caliber as rowGroupConfig/spanConfig.
  const megaTreeConfig = computed(() =>
    megaDatasetKind.value === 'tree' ? { children: 'children', defaultExpandAll: true, indent: 20 } : undefined,
  )
  const megaRowGroupConfig = computed(() =>
    megaRowGroupOn.value && megaDatasetKind.value === 'flat'
      ? { field: 'department', defaultExpandAll: true }
      : undefined,
  )
  const megaRowExpandConfig = computed(() =>
    megaExpandOn.value ? { enabled: true, expandRowHeight: 120, accordion: false } : { enabled: false },
  )
  const megaRowPinConfig = computed(() =>
    megaPinOn.value && megaDatasetKind.value === 'flat'
      ? { topRowKeys: ['1'], bottomRowKeys: ['2'], topRowHeight: 36, bottomRowHeight: 36 }
      : {},
  )
  const megaRangeSelection = computed(() => ({ enabled: megaRangeSelOn.value, autoCopy: false }))
  const megaMenuConfig = computed(() =>
    megaMenuOn.value
      ? {
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
          header: { enabled: true, options: [['clearSort', 'clearAllFilters'], ['exportCsv', 'print']] },
        }
      : { body: { enabled: false, options: [] } },
  )
  // <zh/> 拦截器返回 true 会阻止默认行为；此处只记录不拦截 <en/> An interceptor returning true blocks the default; here we only log and do not block
  const megaInterceptor = {
    'event.rowClick': () => { megaLog('interceptor:event.rowClick') },
    'event.cellClick': () => { megaLog('interceptor:event.cellClick') },
    'event.export': () => { megaLog('interceptor:event.export') },
  }
  const megaEmptyText = '暂无数据（总示例）'
  const megaRowClassName = ({ row }: { row: any }) => (row?.salary >= 60000 ? 'demo-row--inactive' : '')
  const megaTooltipOptions = { placement: 'top' }
  const megaTooltipFormatter = ({ cellValue }: any) => `总示例 tooltip：${String(cellValue)}`
  const megaContainerLayout = computed(() => (megaBareOn.value ? 'bare' : 'bordered'))
  const megaDebug = computed(() =>
    megaDebugOn.value ? { enabled: true, perf: true, domains: ['data', 'edit'] as const } : false,
  )

  // <zh/> Mega：事件日志（50 条封顶 + 每事件计数） <en/> Mega: event log (capped at 50 entries + per-event counts)
  const MEGA_EVENT_NAMES = [
    'pageChange',
    'error',
    'query',
    'reset',
    'request',
    'refresh',
    'selectionChange',
    'select',
    'selectAll',
    'sortChange',
    'rowClick',
    'rowContextmenu',
    'rowDblclick',
    'currentChange',
    'cellMouseEnter',
    'cellMouseLeave',
    'cellClick',
    'cellDblclick',
    'cellContextmenu',
    'headerClick',
    'headerContextmenu',
    'headerDragend',
    'scroll',
    'dataChange',
    'beforeDataChange',
    'afterDataChange',
    'cellValueChanged',
    'cellEditingStarted',
    'cellEditingStopped',
    'cellEditingRequest',
    'fullRowEdit',
    'cellEditingCancelled',
    'crossFieldValidateError',
    'batchPendingChange',
    'rowSelected',
    'modelUpdated',
    'gridReady',
    'columnVisible',
    'columnMoved',
    'rowDragStart',
    'rowDragEnd',
    'cellFocused',
    'cellKeyDown',
    'cellKeyPress',
    'cellKeyUp',
    'contextMenuClick',
    'dataImport',
    'cellRangeSelected',
    'rowExpand',
    'rowCollapse',
    'searchChange',
    'endReached',
    'rowsRendered',
  ] as const
  // <zh/> 高频事件只计数不进可见日志，避免刷屏 <en/> High-frequency events only increment counts and skip the visible log to avoid flooding
  const MEGA_NOISY_EVENTS: readonly string[] = ['scroll', 'rowsRendered', 'cellMouseEnter', 'cellMouseLeave', 'cellKeyDown', 'cellKeyPress', 'cellKeyUp']
  const megaEventLog = ref<string[]>([])
  const megaEventCounts = ref<Record<string, number>>({})
  function megaLog(event: string, payload?: unknown) {
    // <zh/> 高频事件（hover 进出/scroll/rowsRendered/键盘）的精确次数从不展示——模板仅用 <en/> Exact counts of high-frequency events (hover/scroll/rowsRendered/keyboard) are never shown — the template only uses
    // <zh/> 0/非 0 判定已触发/未触发，且不进可见日志。首次出现后跳过响应式写入，避免每次 <en/> 0/non-0 to signal triggered/not, and not into the visible log. After first hit, skip reactive writes to avoid
    // <zh/> hover/scroll 都替换 megaEventCounts 触发父级重渲染（两表 + 日志面板全量 patch）， <en/> hover/scroll replacing megaEventCounts on every event triggering parent re-render (two tables + log panel full patch),
    // <zh/> 与 teleport 悬停层的 rAF 定位抢主线程，这正是总示例 virtual hover 发粘而 1.4 不卡的主因。 <en/> contending with the teleport hover layer's rAF for the main thread — the main reason the master example's virtual hover sticks while 1.4 stays smooth.
    if (MEGA_NOISY_EVENTS.includes(event)) {
      if ((megaEventCounts.value[event] ?? 0) > 0)
        return
      megaEventCounts.value = { ...megaEventCounts.value, [event]: 1 }
      return
    }
    megaEventCounts.value = { ...megaEventCounts.value, [event]: (megaEventCounts.value[event] ?? 0) + 1 }
    const time = new Date().toTimeString().slice(0, 8)
    const brief = payload == null || payload === '' ? '' : ` — ${String(payload).slice(0, 40)}`
    megaEventLog.value = [`[${time}] ${event}${brief}`, ...megaEventLog.value].slice(0, 50)
  }
  function megaClearLog() {
    megaEventLog.value = []
  }
  /** <zh/> 从事件参数中取一小段可辨识信息（不倾倒整行数据） | <en/> Extract a short identifiable hint from event args (without dumping whole rows) */
  function megaEventBrief(args: unknown[]): unknown {
    const first = args[0]
    if (first == null || typeof first !== 'object')
      return first
    if (Array.isArray(first))
      return `${first.length} 行`
    const o = first as Record<string, any>
    const hint = o.prop ?? o.reason ?? o.code ?? o.columnKey ?? o.visible ?? o.order ?? o.expanded ?? o.menu?.code ?? o.total
    return hint ?? ''
  }
  const megaEventHandlers: Record<string, (...args: any[]) => void> = {}
  for (const name of MEGA_EVENT_NAMES) {
    // <zh/> v-on="obj" 会自行补 on 前缀：键必须是裸事件名，写成 onXxx 会生成 onOnXxx 而永不命中 emit <en/> v-on="obj" auto-prefixes on; keys must be bare event names — onXxx becomes onOnXxx and never matches the emit
    megaEventHandlers[name] = (...args: any[]) => {
      // <zh/> 高频事件已标记触发后连 brief 解析都跳过（首参多为大对象，高频属性读取累积可观） <en/> Once a high-frequency event is flagged triggered, even brief parsing is skipped (first args are often large; frequent prop reads add up)
      if (MEGA_NOISY_EVENTS.includes(name) && (megaEventCounts.value[name] ?? 0) > 0)
        return
      megaLog(name, megaEventBrief(args))
    }
  }
  const megaEventTotal = MEGA_EVENT_NAMES.length
  const megaTriggeredEventCount = computed(
    () => MEGA_EVENT_NAMES.filter(n => (megaEventCounts.value[n] ?? 0) > 0).length,
  )
  const megaUnfiredEvents = computed(
    () => MEGA_EVENT_NAMES.filter(n => !megaEventCounts.value[n]),
  )

  // <zh/> Mega：两面板共用 props；selectedRowKeys 改走 v-model 双向，不在此外（避免静态快照不同步） <en/> Mega: shared props for both panels; selectedRowKeys uses v-model two-way binding, not declared here (avoids static snapshot desync)
  const megaCommonProps = computed<Record<string, any>>(() => ({
    performanceProfile: megaPerformanceProfile.value,
    modeSwitchBehavior: megaModeSwitchBehavior.value,
    border: true,
    resizable: true,
    toolbar: megaToolbar,
    search: megaSearch,
    pagination: megaPagination,
    request: megaRequestConfig.value,
    urlState: megaUrlState,
    externalFilter: megaExternalFilter,
    editConfig: megaEditConfig,
    columnConfig: megaColumnConfig,
    rowConfig: megaRowConfig.value,
    filterConfig: megaFilterConfig,
    sortConfig: megaSortConfig,
    spanConfig: megaSpanConfig.value,
    spanMethod: megaSpanMethod,
    menuConfig: megaMenuConfig.value,
    rangeSelection: megaRangeSelection.value,
    interceptor: megaInterceptor,
    treeConfig: megaTreeConfig.value,
    rowGroupConfig: megaRowGroupConfig.value,
    rowExpandConfig: megaRowExpandConfig.value,
    rowPinConfig: megaRowPinConfig.value,
    emptyText: megaEmptyText,
    rowClassName: megaRowClassName,
    stripe: megaStripe.value,
    highlightCurrentRow: true,
    showHeader: megaShowHeader.value,
    size: megaSize.value,
    tableLayout: megaTableLayout.value,
    // <zh/> 扁平数据用固定网格（与 1.4 一致，零行高测量开销）；展开行/append 需要时决议函数自动切动态网格 <en/> Flat data uses a fixed grid (matching 1.4, zero row-height measurement cost); expand-row/append switches to a dynamic grid via a resolver when needed
    estimatedRowHeight: undefined,
    tooltipEffect: megaTooltipEffect.value,
    tooltipOptions: megaTooltipOptions,
    tooltipFormatter: megaTooltipFormatter,
    containerLayout: megaContainerLayout.value,
    debug: megaDebug.value,
  }))
  const megaPropsLeft = computed(() => ({
    ...megaCommonProps.value,
    uiConfig: { columnEmptyText: '-', showSummary: false, sumText: '合计', tableId: 'mega-demo-default' },
    columnState: { enabled: true, storageKey: 'mega-cols-default', autoSave: true, debounce: 300 },
  }))
  const megaPropsRight = computed(() => ({
    ...megaCommonProps.value,
    uiConfig: { columnEmptyText: '-', showSummary: false, sumText: '合计', tableId: 'mega-demo-virtual' },
    columnState: { enabled: true, storageKey: 'mega-cols-virtual', autoSave: true, debounce: 300 },
  }))

  // <zh/> 10.18 综合示例：请求数据源（用于演示轮询 / 刷新 / 导入等工具栏功能） <en/> 10.18 master example: request data source (to demo polling / refresh / import toolbar features)
  const compDemoData = ref<CompRow[]>(genCompData(50))
  const compDemoRequest = async (params: Record<string, unknown>) => {
    await new Promise(r => setTimeout(r, 200))
    const page = Number(params.page) || 1
    const size = Number(params.size) || 10
    const all = compDemoData.value
    return { data: all.slice((page - 1) * size, page * size), total: all.length }
  }

  // <zh/> Table refs <en/> Table refs
  const megaRef = ref<any>()
  const basicRef = ref<any>()
  const pageClientRef = ref<any>()
  const pageClientV2Ref = ref<any>()
  const pageRemoteRef = ref<any>()
  const pageManualRef = ref<any>()
  const searchCustomRef = ref<any>()
  const toolbarRef = ref<any>()
  const importRef = ref<any>()
  const selMultiRef = ref<any>()
  const selMultiV2Ref = ref<any>()
  const filterSortRef = ref<any>()
  const filterSortV2Ref = ref<any>()
  const mergeRef = ref<any>()
  const mergeV2Ref = ref<any>()
  const colMergeRef = ref<any>()
  const colMergeV2Ref = ref<any>()
  const compRef = ref<any>()
  const compV2Ref = ref<any>()
  const editRef = ref<any>()
  const editV2Ref = ref<any>()
  const fullRowEditRef = ref<any>()
  const validateRef = ref<any>()
  const validateFullRowRef = ref<any>()
  const validateModeRef = ref<any>()
  const crossValidateRef = ref<any>()
  const sidePanelRef = ref<any>()
  const columnPresetsRef = ref<any>()
  const externalFilterRef = ref<any>()
  const contextMenuRef = ref<any>()
  const interceptorRef = ref<any>()
  const readOnlyEditRef = ref<any>()
  const batchEditRef = ref<any>()
  const suppressFloatingBtnRef = ref<any>()
  const resizeRef = ref<any>()
  const resizeV2Ref = ref<any>()
  const quickFilterRef = ref<any>()
  const columnStateRef = ref<any>()
  const pollingRef = ref<any>()
  const cellKeyboardRef = ref<any>()
  const floatingFilterRef = ref<any>()
  const manualSortRef = ref<any>()
  const manualSortV2Ref = ref<any>()
  const dragRef = ref<any>()
  const dragV2Ref = ref<any>()
  const defaultColDefRef = ref<any>()
  const selShiftDefaultRef = ref<any>()
  const selShiftVirtualRef = ref<any>()
  const selMultiClickDefaultRef = ref<any>()
  const selMultiClickVirtualRef = ref<any>()
  const rowSelectedRef = ref<any>()
  const modelUpdatedRef = ref<any>()
  const rowClickSelectTrueRef = ref<any>()
  const rowClickSelectFalseRef = ref<any>()
  const loadingDemoRef = ref<any>()
  const loadingDemoV2Ref = ref<any>()
  const spanMethodRef = ref<any>()
  const spanMethodV2Ref = ref<any>()
  const gridReadyRef = ref<any>()
  const gridReadyV2Ref = ref<any>()
  const cellEditLifecycleRef = ref<any>()
  const cellEditLifecycleV2Ref = ref<any>()
  const columnEventRef = ref<any>()
  const columnEventV2Ref = ref<any>()
  const dragEventRef = ref<any>()
  const dragEventV2Ref = ref<any>()
  const cellFocusedRef = ref<any>()
  const cellFocusedV2Ref = ref<any>()
  const vModelRef = ref<any>()
  const vModelV2Ref = ref<any>()
  const searchValuesRef = ref<any>()
  const treeRef = ref<any>()
  const treeSelectionRef = ref<any>()
  const rowGroupRef = ref<any>()
  const rowExpandRef = ref<any>()
  const sidePanelComboRef = ref<any>()
  const p2TableRef = ref<any>()
  const p2TableV2Ref = ref<any>()
  const apiV2Ref = ref<any>()
  const selectedRowKeysRef = ref<any>()
  const selectedRowKeysV2Ref = ref<any>()
  const formatMapsRef = ref<any>()
  const formatMapsV2Ref = ref<any>()

  // <zh/> State variables <en/> State variables
  const sizeConfigPreset = ref<'large' | 'default' | 'small' | 'custom'>('default')
  const customSizeConfig = ref({
    headerCellHeight: 44,
    cellPadding: '6px 10px' as string | [number, number],
    headerCellPadding: '6px 10px' as string | [number, number],
    floatingFilterHeight: 30,
    cellFontSize: '13px',
    rowHeight: 36,
  })
  const sizeConfigValue = computed(() => {
    if (sizeConfigPreset.value === 'custom')
      return customSizeConfig.value
    return undefined
  })

  const validateModeType = ref<'revert' | 'block' | 'notify'>('notify')
  const filterAgeThreshold = ref(25)
  const contextMenuLog = ref('')
  const interceptorLog = ref('')
  const readOnlyEditLog = ref('等待编辑请求...')
  const importLog = ref<string[]>([])
  const quickFilterText = ref('')
  const cellKeyboardLog = ref<string[]>([])
  const cellKeyboardLogV2 = ref<string[]>([])
  const modelUpdatedCount = ref(0)
  const manualSortLog = ref('（暂无排序）')
  const borderOn = ref(true)
  const resizableOn = ref(true)
  const gridReadyLog = ref('')
  const cellEditLifecycleLog = ref<string[]>([])
  const cellEditLifecycleLogV2 = ref<string[]>([])
  const columnEventLog = ref<string[]>([])
  const columnEventLogV2 = ref<string[]>([])
  const dragEventLog = ref<string[]>([])
  const dragEventLogV2 = ref<string[]>([])
  const cellFocusedLog = ref('')
  const highlightCurrentRow = ref<RowData | null>(null)
  const highlightCurrentRowV2 = ref<RowData | null>(null)
  const searchValuesModel = ref<Record<string, any>>({})
  const treeSelectionStrictly = ref(false)
  const treeSelectionSelectedKeys = ref<string[]>([])
  const rowGroupField = ref<string>('department')
  const rowGroupDefaultExpandAll = ref(true)
  const rowExpandAccordion = ref(false)
  const rowClassNameTooltipEffect = ref<'dark' | 'light'>('dark')
  const selectedRowKeysValue = ref<string[]>(['1', '3'])
  const cellRangeSelectionLog = ref('')
  const cellRangeSelectionLogV2 = ref('')
  const teleportHoverZIndex = ref<number | string>(2000)
  const teleportHoverParentTransform = ref(false)

  // <zh/> Configs <en/> Configs
  const treeConfig = { children: 'children', defaultExpandAll: false, defaultExpandedRowKeys: ['1'], indent: 20 }
  const treeConfigExpandAll = { children: 'children', defaultExpandAll: true, indent: 20 }
  const treeSelectionConfig = computed(() => ({
    children: 'children',
    defaultExpandAll: true,
    indent: 20,
    checkStrictly: treeSelectionStrictly.value,
  }))
  const rowGroupConfig = computed(() => ({
    field: rowGroupField.value,
    defaultExpandAll: rowGroupDefaultExpandAll.value,
  }))
  const rowExpandConfig = computed(() => ({
    enabled: true,
    expandRowHeight: 160,
    accordion: rowExpandAccordion.value,
  }))

  // <zh/> P2 functions <en/> P2 functions
  function p2Undo() {
    const api = p2TableRef.value
    if (api?.undo) {
      const result = api.undo()
      ElMessage[result ? 'success' : 'info'](result ? '已撤销' : '无可撤销操作')
    }
    else {
      ElMessage.warning('撤销功能未接入')
    }
  }
  function p2Redo() {
    const api = p2TableRef.value
    if (api?.redo) {
      const result = api.redo()
      ElMessage[result ? 'success' : 'info'](result ? '已重做' : '无可重做操作')
    }
    else {
      ElMessage.warning('重做功能未接入')
    }
  }
  function p2CheckUnsaved() {
    const api = p2TableRef.value
    if (api?.hasUnsavedChanges) {
      const unsaved = api.hasUnsavedChanges()
      ElMessage[unsaved ? 'warning' : 'success'](unsaved ? '存在未保存的编辑变更' : '没有未保存的变更')
    }
    else {
      ElMessage.warning('未保存检查功能未接入')
    }
  }
  /** <zh/> 综合示例导入回调：将数据同步回请求数据源并刷新，使导入结果即时可见 | <en/> Master-example import callback: syncs imported data back to the request source and refreshes so the result is visible immediately */
  function onCompImported(payload: { rows: CompRow[], mode: 'append' | 'replace' }) {
    if (payload.mode === 'replace')
      compDemoData.value = [...payload.rows]
    else
      compDemoData.value = [...compDemoData.value, ...payload.rows]
    compRef.value?.refresh?.()
  }

  return {
    // <zh/> Data refs <en/> Data refs
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
    dynamicParamsData: dynamicParamsDataRef,
    activeMethodData,
    loseFocusData,
    popupEditData,
    popupPositionData,
    validateData: validateDataRef,
    orderData: orderDataRef,
    treeData,
    asyncTreeData: asyncTreeDataRef,
    rowGroupData,
    rowExpandData: rowExpandDataRef,
    rowClassNameData,
    teleportHoverData,
    vModelData,
    vModelDataV2,
    megaData,
    megaDataset,
    megaColumns,
    megaQuickFilter,
    megaSearchValues,
    megaSelectedRowKeys,
    // <zh/> Mega 开关与选择器 <en/> Mega toggles and selectors
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
    // <zh/> Mega props / 事件绑定 <en/> Mega props / event bindings
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

    // <zh/> Static data <en/> Static data
    mergeData,
    colMergeData,
    addressData,
    empData,
    orderDetailsMap,

    // <zh/> Table refs <en/> Table refs
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
    mergeV2Ref,
    colMergeRef,
    colMergeV2Ref,
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

    // <zh/> State <en/> State
    sizeConfigPreset,
    customSizeConfig,
    sizeConfigValue,
    validateModeType,
    filterAgeThreshold,
    contextMenuLog,
    interceptorLog,
    readOnlyEditLog,
    importLog,
    quickFilterText,
    cellKeyboardLog,
    cellKeyboardLogV2,
    modelUpdatedCount,
    manualSortLog,
    borderOn,
    resizableOn,
    gridReadyLog,
    cellEditLifecycleLog,
    cellEditLifecycleLogV2,
    columnEventLog,
    columnEventLogV2,
    dragEventLog,
    dragEventLogV2,
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
    cellRangeSelectionLogV2,
    teleportHoverZIndex,
    teleportHoverParentTransform,

    // <zh/> Configs <en/> Configs
    treeConfig,
    treeConfigExpandAll,
    treeSelectionConfig,
    rowGroupConfig,
    rowExpandConfig,

    // <zh/> Functions <en/> Functions
    p2Undo,
    p2Redo,
    p2CheckUnsaved,

    // <zh/> Mock functions <en/> Mock functions
    mockPaginatedRequest,
    mockCustomFormatRequest,
    mockCompRequest,
    mockTreeRequest,
    loadTreeData,
  }
}

export type TableDemoState = ReturnType<typeof useTableDemoState>
