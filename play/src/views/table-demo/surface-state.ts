import { computed, ref } from 'vue'

/** <zh/> 事件日志 | <en/> Event log */
export const surfaceLog = ref<string[]>([])

/** <zh/> API 调用日志 | <en/> API call log */
export const surfaceApiLog = ref<string[]>([])

// ── <zh/> 11.1 事件（53/53）全量绑定 <en/> 11.1 events (53/53) full binding ─────────────────────────────────────
/** <zh/> 全部 53 个事件名（与 packages/table/src/types/table-emits.ts 对齐） | <en/> All 53 event names (aligned with packages/table/src/types/table-emits.ts) */
export const SURFACE_EVENT_NAMES = [
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

/** <zh/> 高频事件只计数，避免日志刷屏 | <en/> High-frequency events are counted only to avoid log flooding */
export const SURFACE_NOISY_EVENTS: readonly string[] = ['scroll', 'rowsRendered', 'cellMouseEnter', 'cellMouseLeave', 'cellKeyDown', 'cellKeyPress', 'cellKeyUp']
export const surfaceEventCounts = ref<Record<string, number>>({})

export function surfaceLogEvent(name: string) {
  surfaceEventCounts.value = { ...surfaceEventCounts.value, [name]: (surfaceEventCounts.value[name] ?? 0) + 1 }
  if (SURFACE_NOISY_EVENTS.includes(name))
    return
  const time = new Date().toTimeString().slice(0, 8)
  surfaceLog.value = [`[${time}] ${name}`, ...surfaceLog.value].slice(0, 80)
}

/** <zh/> v-on 对象：一次性绑定全部 53 个事件（键须为裸事件名，与 mega 实现同构） | <en/> v-on object: binds all 53 events at once (keys must be bare event names, isomorphic with the mega impl) */
export const surfaceEventHandlers: Record<string, (...args: any[]) => void> = {}
for (const name of SURFACE_EVENT_NAMES) {
  // <zh/> v-on="obj" 的键是裸事件名（Vue 内部再补 onXxx 前缀）；写成 onXxx 会变成 onOnXxx 而永不命中 emit <en/> v-on="obj" keys are bare event names (Vue auto-prefixes onXxx); writing onXxx becomes onOnXxx and never matches the emit
  surfaceEventHandlers[name] = () => surfaceLogEvent(name)
}

export const surfaceTriggeredEventCount = computed(
  () => SURFACE_EVENT_NAMES.filter(n => (surfaceEventCounts.value[n] ?? 0) > 0).length,
)
export const surfaceUnfiredEvents = computed(
  () => SURFACE_EVENT_NAMES.filter(n => !surfaceEventCounts.value[n]),
)

/** <zh/> 53 个事件的触发方式速查表 | <en/> Quick-reference for triggering all 53 events */
export const SURFACE_EVENT_DOCS: Array<{ name: string, how: string }> = [
  { name: 'pageChange', how: '切换分页页码 / 每页条数' },
  { name: 'error', how: 'request 数据源抛错（见下方 error 分组示例）' },
  { name: 'query', how: '搜索表单点击「查询」' },
  { name: 'reset', how: '搜索表单点击「重置」' },
  { name: 'request', how: '每次发起远程请求时' },
  { name: 'refresh', how: '工具栏刷新按钮或 api.refresh()' },
  { name: 'selectionChange', how: '勾选集合发生任何变化' },
  { name: 'select', how: '勾选/取消单行复选框' },
  { name: 'selectAll', how: '点击表头全选框' },
  { name: 'sortChange', how: '点击可排序列头' },
  { name: 'rowClick', how: '单击任意数据行' },
  { name: 'rowContextmenu', how: '右键单击数据行' },
  { name: 'rowDblclick', how: '双击数据行' },
  { name: 'currentChange', how: 'highlight-current-row 下单击切换当前行' },
  { name: 'cellMouseEnter', how: '鼠标移入单元格（仅计数）' },
  { name: 'cellMouseLeave', how: '鼠标移出单元格（仅计数）' },
  { name: 'cellClick', how: '单击单元格' },
  { name: 'cellDblclick', how: '双击单元格' },
  { name: 'cellContextmenu', how: '右键单击单元格' },
  { name: 'headerClick', how: '单击列头' },
  { name: 'headerContextmenu', how: '右键单击列头' },
  { name: 'headerDragend', how: '拖动列边界完成列宽调整' },
  { name: 'scroll', how: '滚动表体（仅计数）' },
  { name: 'dataChange', how: 'data 变化后（点「变更数据」按钮）' },
  { name: 'beforeDataChange', how: '数据变化前，可否决本次变更' },
  { name: 'afterDataChange', how: '数据变化完成后' },
  { name: 'cellValueChanged', how: '编辑提交新值' },
  { name: 'cellEditingStarted', how: '单元格进入编辑态' },
  { name: 'cellEditingStopped', how: '单元格退出编辑态' },
  { name: 'cellEditingRequest', how: '触发编辑前（单击/双击/F2）' },
  { name: 'fullRowEdit', how: '整行编辑模式保存变更' },
  { name: 'cellEditingCancelled', how: 'Esc 等取消编辑' },
  { name: 'crossFieldValidateError', how: '跨字段校验失败' },
  { name: 'batchPendingChange', how: '批量编辑待提交集合变化' },
  { name: 'rowSelected', how: '单行选中/取消选中状态变化' },
  { name: 'modelUpdated', how: '内部查询模型更新' },
  { name: 'gridReady', how: '表格挂载完成（本表挂载即触发）' },
  { name: 'columnVisible', how: '列设置面板切换列显隐' },
  { name: 'columnMoved', how: '列设置面板/拖拽调整列顺序' },
  { name: 'rowDragStart', how: '按住行拖拽手柄开始拖动' },
  { name: 'rowDragEnd', how: '行拖动落点释放' },
  { name: 'cellFocused', how: 'Tab/方向键移动单元格焦点' },
  { name: 'cellKeyDown', how: '焦点单元格按下按键（仅计数）' },
  { name: 'cellKeyPress', how: '焦点单元格按键字符产生（仅计数）' },
  { name: 'cellKeyUp', how: '焦点单元格松开按键（仅计数）' },
  { name: 'contextMenuClick', how: '点击右键菜单项（需开启 menuConfig）' },
  { name: 'dataImport', how: '工具栏导入完成（需开启 toolbar.import）' },
  { name: 'cellRangeSelected', how: 'rangeSelection 开启后拖选单元格区域' },
  { name: 'rowExpand', how: '展开行按钮/点击展开' },
  { name: 'rowCollapse', how: '收起已展开行' },
  { name: 'searchChange', how: '搜索表单字段值改变' },
  { name: 'endReached', how: 'virtual 无限滚动触底' },
  { name: 'rowsRendered', how: 'virtual 渲染行区间变化（仅计数）' },
]

export function surfaceClearLog() {
  surfaceLog.value = []
}

export function surfaceClearApiLog() {
  surfaceApiLog.value = []
}
