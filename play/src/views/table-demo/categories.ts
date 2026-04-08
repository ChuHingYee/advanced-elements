/**
 * <zh/> TableDemo 分类导航配置
 * <en/> TableDemo category navigation config
 *
 * <zh/> 从 TableDemo.vue 拆出，供主组件及侧边栏导航复用。
 * <en/> Extracted from TableDemo.vue for the main component and sidebar navigation.
 */

export interface DemoOption {
  value: string
  label: string
}

export interface DemoCategory {
  label: string
  options: DemoOption[]
}

export const demoCategories: DemoCategory[] = [
  {
    label: '🏠 综合',
    options: [
      { value: 'all', label: '全部展示' },
      { value: 'mega', label: '⭐ 整合示例（集所有功能于一体）' },
    ],
  },
  {
    label: '1. 基础展示',
    options: [
      { value: 'basic', label: '1.1 基础用法' },
      { value: 'valueType', label: '1.2 列类型展示' },
      { value: 'group', label: '1.3 多级表头' },
      { value: 'address', label: '1.4 三层嵌套+固定列' },
      { value: 'option', label: '1.5 操作按钮列' },
      { value: 'emptyTextDemo', label: '1.6 空数据提示(slot)' },
      { value: 'emptyTextPropDemo', label: '1.6b 空数据提示(prop)' },
      { value: 'summary', label: '1.7 表尾合计/总计行(summary)' },
    ],
  },
  {
    label: '2. 选择功能',
    options: [
      { value: 'selection', label: '2.1 单选/多选' },
      { value: 'shiftClick', label: '2.2 Shift+Click范围选择' },
      { value: 'rowMultiClick', label: '2.3 单击多选(AG Grid兼容)' },
      { value: 'rowClickSelectDemo', label: '2.4 行点击选择(rowClickSelect)' },
      { value: 'cellRangeSelection', label: '2.5 单元格范围选择' },
      { value: 'highlightCurrentRowDemo', label: '2.6 单选高亮' },
      { value: 'selectedRowKeysDemo', label: '2.7 受控选中(selectedRowKeys)' },
    ],
  },
  {
    label: '3. 分页与数据',
    options: [
      { value: 'pageClient', label: '3.1 客户端分页' },
      { value: 'pageRemote', label: '3.2 远程分页' },
      { value: 'pageManual', label: '3.3 手动分页' },
      { value: 'urlState', label: '3.4 URL State' },
      { value: 'pollingDemo', label: '3.5 数据轮询' },
      { value: 'loadingDemo', label: '3.6 加载状态' },
      { value: 'vModelDemo', label: '3.7 v-model双向绑定' },
    ],
  },
  {
    label: '4. 搜索与筛选',
    options: [
      { value: 'search', label: '4.1 自定义搜索' },
      { value: 'floatingFilter', label: '4.2 浮动筛选' },
      { value: 'quickFilterDemo', label: '4.3 全局搜索(quickFilter)' },
      { value: 'sidePanel', label: '4.4 侧边筛选面板' },
      { value: 'externalFilter', label: '4.5 外部筛选器' },
      { value: 'suppressFloatingBtn', label: '4.6 隐藏浮动筛选按钮' },
      { value: 'searchValuesDemo', label: '4.7 搜索值响应式' },
    ],
  },
  {
    label: '5. 排序与拖拽',
    options: [
      { value: 'filterSort', label: '5.1 列筛选+排序' },
      { value: 'manualSort', label: '5.2 手动触发排序(API)' },
      { value: 'drag', label: '5.3 行拖拽' },
      { value: 'columnDrag', label: '5.4 列拖拽排序' },
      { value: 'dragEventDemo', label: '5.5 拖拽事件' },
    ],
  },
  {
    label: '6. 编辑功能',
    options: [
      { value: 'editDefault', label: '6.1 单元格编辑' },
      { value: 'fullRowEdit', label: '6.2 全行编辑' },
      { value: 'batchEdit', label: '6.3 批量编辑' },
      { value: 'readOnlyEdit', label: '6.4 只读编辑' },
      { value: 'tabEnterNav', label: '6.5 Tab/Enter编辑导航' },
      { value: 'dynamicEditorParams', label: '6.6 动态编辑器参数' },
      { value: 'activeMethodDemo', label: '6.7 编辑激活条件' },
      { value: 'stopEditingWhenCellsLoseFocus', label: '6.8 失焦结束编辑' },
      { value: 'cellEditorPopupDemo', label: '6.9 弹窗编辑器' },
      { value: 'popupPositionDemo', label: '6.10 弹窗位置' },
      { value: 'cellEditorSelectorDemo', label: '6.11 动态编辑器选择' },
      { value: 'f2BackspaceDemo', label: '6.12 F2/Backspace键盘触发' },
      { value: 'clipboardDemo', label: '6.13 剪贴板集成' },
      { value: 'showStatusDemo', label: '6.14 编辑状态视觉标记' },
      { value: 'editorLifecycleDemo', label: '6.15 编辑器生命周期' },
      { value: 'multiSelectEditorDemo', label: '6.16 多选编辑器' },
      { value: 'p2EnhancedDemo', label: '6.17 P2功能增强(undo/guard)' },
      { value: 'cellEditLifecycleDemo', label: '6.18 编辑开始/结束事件' },
      { value: 'cellKeyboardDemo', label: '6.19 单元格键盘事件' },
    ],
  },
  {
    label: '7. 数据校验',
    options: [
      { value: 'validate', label: '7.1 数据校验(editorRules)' },
      { value: 'validateMode', label: '7.2 校验模式(invalidEditValueMode)' },
      { value: 'crossValidate', label: '7.3 跨字段校验' },
    ],
  },
  {
    label: '8. 列管理',
    options: [
      { value: 'columnResize', label: '8.1 列宽拖拽' },
      { value: 'borderResizable', label: '8.2 外边框与列宽拖拽' },
      { value: 'columnStateDemo', label: '8.3 列状态持久化' },
      { value: 'columnGroupDemo', label: '8.4 列组管理' },
      { value: 'defaultColDef', label: '8.5 defaultColDef/columnTypes' },
      { value: 'columnPresets', label: '8.6 内置列类型预设' },
      { value: 'columnEventDemo', label: '8.7 列事件' },
      { value: 'sizeConfig', label: '8.8 尺寸自定义(sizeConfig)' },
    ],
  },
  {
    label: '9. 树形与分组',
    options: [
      { value: 'treeDemo', label: '9.1 树形数据(treeConfig)' },
      { value: 'treeSelectionDemo', label: '9.2 树形选择' },
      { value: 'asyncTreeDemo', label: '9.3 异步树形数据(loadData)' },
      { value: 'rowGroupDemo', label: '9.4 行分组(rowGroupConfig)' },
      { value: 'rowExpandDemo', label: '9.5 主/明细视图(rowExpandConfig)' },
      { value: 'treeRequestDemo', label: '9.6 树形数据(request数据源)' },
    ],
  },
  {
    label: '10. 事件与高级交互',
    options: [
      { value: 'events', label: '10.1 事件监听' },
      { value: 'contextMenu', label: '10.2 右键菜单(menuConfig)' },
      { value: 'interceptor', label: '10.3 事件拦截器' },
      { value: 'teleportHoverDemo', label: '10.4 Teleport 悬浮操作' },
      { value: 'teleportAutoDemo', label: '10.5 Teleport Auto 模式' },
      { value: 'merge', label: '10.6 单元格合并' },
      { value: 'spanMethodDemo', label: '10.7 声明式单元格合并(spanRows/colSpan)' },
      { value: 'spanConfigDemo', label: '10.7b 声明式合并配置(spanConfig)' },
      { value: 'rowClassNameTooltipDemo', label: '10.8 行样式 + Tooltip 自定义' },
      { value: 'tooltipOptionsDemo', label: '10.8b Tooltip 选项(tooltipOptions)' },
      { value: 'formatMaps', label: '10.9 自定义格式映射' },
      { value: 'rowSelected', label: '10.10 rowSelected 事件' },
      { value: 'modelUpdated', label: '10.11 modelUpdated 事件' },
      { value: 'cellFocusedDemo', label: '10.12 单元格聚焦事件' },
      { value: 'gridReadyDemo', label: '10.13 表格就绪(gridReady)' },
      { value: 'api', label: '10.14 API 方法调用' },
      { value: 'toolbar', label: '10.15 导入导出 + 工具栏' },
      { value: 'sidePanelCombo', label: '10.16 集合侧边栏' },
      { value: 'emp', label: '10.17 多级表头 + 筛选' },
      { value: 'compDefault', label: '10.18 综合示例' },
      { value: 'scrollSyncDemo', label: '10.20 虚拟滚动失步自愈' },
    ],
  },
  {
    label: '11. API 全覆盖',
    options: [
      { value: 'surface', label: '11.1 表面全覆盖(Props/Events/Slots/Expose)' },
      { value: 'performanceProfileDemo', label: '11.2 性能档位(performanceProfile)' },
      { value: 'modeSwitchBehaviorDemo', label: '11.3 模式切换策略(modeSwitchBehavior)' },
      { value: 'estimatedRowHeightDemo', label: '11.4 预估行高(estimatedRowHeight)' },
      { value: 'includeSyntheticDemo', label: '11.5 合成行分页(includeSynthetic)' },
      { value: 'filterConfigDemo', label: '11.6 筛选配置(filterConfig)' },
      { value: 'sortConfigDemo', label: '11.7 排序配置(sortConfig)' },
      { value: 'rowPinConfigDemo', label: '11.8 行固定(rowPinConfig)' },
      { value: 'debugDemo', label: '11.9 调试模式(debug)' },
      { value: 'virtualConfigDemo', label: '11.10 虚拟配置(virtual)' },
      { value: 'containerLayoutDemo', label: '11.11 容器布局(containerLayout)' },
      { value: 'stripeDemo', label: '11.12 斑马纹(stripe)' },
      { value: 'showHeaderDemo', label: '11.13 表头显隐(showHeader)' },
      { value: 'sizeDemo', label: '11.14 表格尺寸(size)' },
      { value: 'tableLayoutDemo', label: '11.15 布局算法(tableLayout)' },
      { value: 'tooltipFormatterDemo', label: '11.16 提示格式化(tooltipFormatter)' },
    ],
  },
]

/** <zh/> 扁平化的所有 demo value 列表 | <en/> Flat list of all demo values */
export const allDemoValues = demoCategories.flatMap(c => c.options.map(o => o.value))
