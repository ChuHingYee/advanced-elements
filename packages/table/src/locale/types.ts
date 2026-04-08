/**
 * <zh/> AdvTableLocale — 增强表格组件的国际化上下文类型定义。
 * <zh/> 包含表格、表单、编辑等场景下所有可配置的文本/标签。
 * <zh/> 使用方可通过 `useAdvLocale` 组合式函数或依赖注入获取当前语言配置。
 * <en/> AdvTableLocale — internationalization context type definitions for the advanced table component.
 * <en/> Contains all configurable texts/labels for table, form, editing and other scenarios.
 * <en/> Consumers can get the current locale config via the `useAdvLocale` composable or dependency injection.
 */
import type { TableErrorCode } from '../types/error'

export interface AdvTableLocale {
  /** <zh/> 语言名称标识，如 'zh-cn'、'en' | <en/> Language name identifier, e.g. 'zh-cn', 'en' */
  name: string
  /** <zh/> 货币格式配置（可选），用于金额显示的符号和区域格式 | <en/> Currency format config (optional), symbol and locale for amount display */
  currency?: {
    /** <zh/> 货币符号，如 ¥、$ | <en/> Currency symbol, e.g. ¥, $ */
    symbol: string
    /** <zh/> 区域标识，如 'zh-CN'、'en-US' | <en/> Locale identifier, e.g. 'zh-CN', 'en-US' */
    locale: string
  }
  /** <zh/> 表格相关文本 | <en/> Table-related texts */
  table: {
    /** <zh/> 查询按钮文本 | <en/> Query button text */
    query: string
    /** <zh/> 重置按钮文本 | <en/> Reset button text */
    reset: string
    /** <zh/> 刷新按钮文本 | <en/> Refresh button text */
    refresh: string
    /** <zh/> 加载更多按钮文本 | <en/> Load more button text */
    loadMore: string
    /** <zh/> 没有更多数据提示 | <en/> No more data hint */
    noMore: string
    /** <zh/> 合计行第一列文本 | <en/> First column text of the summary row */
    summary: string
    /** <zh/> 展开行默认文本（未提供 expandRow 插槽时显示） | <en/> Default expanded row text (shown when no expandRow slot is provided) */
    rowExpand: string
    /** <zh/> 行操作区域 aria-label | <en/> Row action area aria-label */
    rowAction: string
    /** <zh/> 展开操作按钮 aria-label | <en/> Expand actions button aria-label */
    rowActionExpand: string
    /** <zh/> 收起操作按钮 aria-label | <en/> Collapse actions button aria-label */
    rowActionCollapse: string
    /** <zh/> 分组展开按钮 aria-label | <en/> Group expand button aria-label */
    groupExpand: string
    /** <zh/> 分组收起按钮 aria-label | <en/> Group collapse button aria-label */
    groupCollapse: string
    /** <zh/> 行展开按钮 aria-label（树形/行展开） | <en/> Row expand button aria-label (tree/row expand) */
    rowExpandButton: string
    /** <zh/> 行收起按钮 aria-label（树形/行展开） | <en/> Row collapse button aria-label (tree/row expand) */
    rowCollapseButton: string
    /** <zh/> 排序：点击升序 aria-label | <en/> Sort: click to sort ascending aria-label */
    sortAsc: string
    /** <zh/> 排序：升序状态，点击切换降序 aria-label | <en/> Sort: ascending, click to switch to descending aria-label */
    sortAscActive: string
    /** <zh/> 排序：降序状态，点击取消排序 aria-label | <en/> Sort: descending, click to clear sort aria-label */
    sortDescActive: string
    /** <zh/> 筛选：清除筛选 aria-label | <en/> Filter: clear filter aria-label */
    filterClear: string
    /** <zh/> 筛选：打开筛选 aria-label | <en/> Filter: open filter aria-label */
    filterOpen: string
    /** <zh/> 列设置弹窗标题 | <en/> Column setting dialog title */
    columnSetting: string
    /** <zh/> 列展示面板标题 | <en/> Column display panel title */
    columnDisplay: string
    /** <zh/> 重置列配置按钮文本 | <en/> Reset column config button text */
    resetColumns: string
    /** <zh/> 固定到左侧 | <en/> Pin to left */
    fixedLeft: string
    /** <zh/> 固定到右侧 | <en/> Pin to right */
    fixedRight: string
    /** <zh/> 不固定 | <en/> Not pinned */
    unfixed: string
    /** <zh/> 固定到左侧（列操作菜单） | <en/> Pin to left (column operations menu) */
    pinToLeft: string
    /** <zh/> 固定到右侧（列操作菜单） | <en/> Pin to right (column operations menu) */
    pinToRight: string
    /** <zh/> 取消固定（列操作菜单） | <en/> Unpin (column operations menu) */
    unpin: string
    /** <zh/> 永久固定列不可取消固定的提示 | <en/> Hint that permanently pinned columns cannot be unpinned */
    pinnedCannotUnpin: string
    /** <zh/> virtual 模式下 default slot 被忽略时的警告文本 | <en/> Warning text when the default slot is ignored in virtual mode */
    virtualSlotIgnored: string
    /** <zh/> 渲染异常错误边界提示前缀 | <en/> Render-error boundary message prefix */
    renderError: string
    /**
     * <zh/> 表格网格 aria-label（读屏）
     * <en/> Grid aria-label for screen readers
     */
    ariaLabel: string
    /** <zh/> 轮询相关文本 | <en/> Polling-related texts */
    polling: {
      /** <zh/> 开始轮询 | <en/> Start polling */
      start: string
      /** <zh/> 停止轮询 | <en/> Stop polling */
      stop: string
    }
    /** <zh/> 复制相关文本 | <en/> Copy-related texts */
    copy: {
      /** <zh/> 复制成功提示 | <en/> Copy success message */
      success: string
      /** <zh/> 复制失败提示 | <en/> Copy failure message */
      fail: string
    }
    /** <zh/> 导出相关文本 | <en/> Export-related texts */
    export: {
      /** <zh/> 导出弹窗标题 | <en/> Export dialog title */
      title: string
      /** <zh/> 导出成功提示 | <en/> Export success message */
      success: string
      /** <zh/> 导出失败提示 | <en/> Export failure message */
      fail: string
      /** <zh/> CSV 导出弹窗标题 | <en/> CSV export dialog title */
      csvTitle: string
      /** <zh/> CSV 导出成功提示 | <en/> CSV export success message */
      csvSuccess: string
      /** <zh/> CSV 导出失败提示 | <en/> CSV export failure message */
      csvFail: string
      /**
       * <zh/> 存在未提交编辑而中止导出时的提示
       * <en/> Message shown when the export aborts because uncommitted edits exist
       */
      pendingChanges: string
      /**
       * <zh/> 默认导出文件名（不含扩展名）
       * <en/> Default export filename (without extension)
       */
      filename: string
      /**
       * <zh/> 默认工作表名称
       * <en/> Default worksheet name
       */
      sheetName: string
    }
    /** <zh/> 导入相关文本 | <en/> Import-related texts */
    import: {
      /** <zh/> 导入弹窗标题 | <en/> Import dialog title */
      title: string
      /** <zh/> 导入成功提示 | <en/> Import success message */
      success: string
      /** <zh/> 导入失败提示 | <en/> Import failure message */
      fail: string
      /** <zh/> 未选择文件的提示 | <en/> Message when no file is selected */
      noFile: string
      /** <zh/> 无效文件的提示 | <en/> Message for an invalid file */
      invalidFile: string
      /** <zh/> 超过最大行数的提示 | <en/> Message when the maximum row count is exceeded */
      maxRowsExceeded: string
      /** <zh/> 导入无数据的提示 | <en/> Message when the import contains no data */
      noData: string
      /** <zh/> 导入被前置确认取消的提示 | <en/> Message when the import is cancelled by pre-confirmation */
      cancelled: string
    }
    /** <zh/> 打印相关文本 | <en/> Print-related texts */
    print: {
      /** <zh/> 打印按钮提示 | <en/> Print button tooltip */
      title: string
      /** <zh/> 打印成功提示 | <en/> Print success message */
      success: string
      /** <zh/> 打印失败提示 | <en/> Print failure message */
      fail: string
      /** <zh/> 行号列标题 | <en/> Row index column title */
      rowIndex: string
      /**
       * <zh/> 存在未提交编辑而中止打印时的提示
       * <en/> Message shown when printing aborts because uncommitted edits exist
       */
      pendingChanges: string
    }
    /** <zh/> 筛选面板相关文本 | <en/> Filter panel-related texts */
    filter: {
      /** <zh/> 筛选确认按钮文本 | <en/> Filter confirm button text */
      confirm: string
      /** <zh/> 筛选重置按钮文本 | <en/> Filter reset button text */
      reset: string
      /** <zh/> 筛选搜索框占位文本 | <en/> Filter search box placeholder text */
      searchPlaceholder: string
      /** <zh/> 等于运算符 | <en/> Equals operator */
      eq: string
      /** <zh/> 不等于运算符 | <en/> Not-equals operator */
      neq: string
      /** <zh/> 大于运算符 | <en/> Greater-than operator */
      gt: string
      /** <zh/> 大于等于运算符 | <en/> Greater-than-or-equal operator */
      gte: string
      /** <zh/> 小于运算符 | <en/> Less-than operator */
      lt: string
      /** <zh/> 小于等于运算符 | <en/> Less-than-or-equal operator */
      lte: string
      /** <zh/> 介于（范围筛选） | <en/> Between (range filter) */
      between: string
      /** <zh/> 为空 | <en/> Is blank */
      blank: string
      /** <zh/> 不为空 | <en/> Is not blank */
      notBlank: string
      /** <zh/> 最小值标签 | <en/> Minimum value label */
      min: string
      /** <zh/> 最大值标签 | <en/> Maximum value label */
      max: string
      /** <zh/> 添加筛选条件按钮文本 | <en/> Add filter condition button text */
      addCondition: string
      /** <zh/> 移除筛选条件按钮文本 | <en/> Remove filter condition button text */
      removeCondition: string
      /** <zh/> 且（与）逻辑连接词 | <en/> AND logical connector */
      and: string
      /** <zh/> 或逻辑连接词 | <en/> OR logical connector */
      or: string
      /** <zh/> 之前（日期筛选） | <en/> Before (date filter) */
      before: string
      /** <zh/> 之后（日期筛选） | <en/> After (date filter) */
      after: string
      /** <zh/> 开始日期占位文本 | <en/> Start date placeholder text */
      beforePlaceholder: string
      /** <zh/> 结束日期占位文本 | <en/> End date placeholder text */
      afterPlaceholder: string
      /** <zh/> 起始日期标签 | <en/> Start date label */
      startDate: string
      /** <zh/> 截止日期标签 | <en/> End date label */
      endDate: string
      /** <zh/> 全选按钮文本 | <en/> Select all button text */
      selectAll: string
      /** <zh/> 筛选输入框占位文本 | <en/> Filter input placeholder text */
      filterPlaceholder: string
      /** <zh/> 无匹配结果提示 | <en/> No matches message */
      noMatches: string
      /** <zh/> 包含运算符 | <en/> Contains operator */
      contains: string
      /** <zh/> 不包含运算符 | <en/> Does-not-contain operator */
      notContains: string
      /** <zh/> 等于运算符（文本筛选） | <en/> Equals operator (text filter) */
      equals: string
      /** <zh/> 不等于运算符（文本筛选） | <en/> Not-equals operator (text filter) */
      notEquals: string
      /** <zh/> 开头是运算符 | <en/> Begins-with operator */
      beginsWith: string
      /** <zh/> 结尾是运算符 | <en/> Ends-with operator */
      endsWith: string
      /** <zh/> 文本输入框占位文本 | <en/> Text input placeholder text */
      textPlaceholder: string
      /** <zh/> 筛选侧面板标题 | <en/> Filter side panel title */
      panelTitle: string
      /** <zh/> 重置全部筛选按钮文本 | <en/> Reset all filters button text */
      resetAll: string
    }
    /** <zh/> 快速筛选相关文本 | <en/> Quick filter-related texts */
    quickFilter: {
      /** <zh/> 快速筛选搜索框占位文本 | <en/> Quick filter search box placeholder text */
      searchPlaceholder: string
    }
    /** <zh/> 右键菜单相关文本 | <en/> Context menu-related texts */
    contextMenu: {
      /** <zh/> 复制单元格 | <en/> Copy cell */
      copyCell: string
      /** <zh/> 复制单元格（含表头） | <en/> Copy cell (with header) */
      copyCellWithHeader: string
      /** <zh/> 复制行 | <en/> Copy row */
      copyRow: string
      /** <zh/> 复制行（含表头） | <en/> Copy row (with headers) */
      copyRowWithHeaders: string
      /** <zh/> 复制选中行 | <en/> Copy selected rows */
      copySelectedRows: string
      /** <zh/> 复制选中行（含表头） | <en/> Copy selected rows (with headers) */
      copySelectedRowsWithHeaders: string
      /** <zh/> 剪切单元格 | <en/> Cut cell */
      cutCell: string
      /** <zh/> 粘贴到单元格 | <en/> Paste into cell */
      pasteCell: string
      /** <zh/> 清除单元格内容 | <en/> Clear cell content */
      clearCell: string
      /** <zh/> 编辑单元格 | <en/> Edit cell */
      editCell: string
      /** <zh/> 删除行 | <en/> Delete row */
      deleteRow: string
      /** <zh/> 删除选中行 | <en/> Delete selected rows */
      deleteSelectedRows: string
      /** <zh/> 在上方插入行 | <en/> Insert row above */
      insertRowAbove: string
      /** <zh/> 在下方插入行 | <en/> Insert row below */
      insertRowBelow: string
      /** <zh/> 自动调整当前列宽 | <en/> Auto-size this column */
      autoSizeThisColumn: string
      /** <zh/> 自动调整所有列宽 | <en/> Auto-size all columns */
      autoSizeAllColumns: string
      /** <zh/> 重置列配置 | <en/> Reset column config */
      resetColumns: string
      /** <zh/> 清除排序 | <en/> Clear sort */
      clearSort: string
      /** <zh/> 清除当前列筛选 | <en/> Clear this column's filter */
      clearFilter: string
      /** <zh/> 清除所有筛选 | <en/> Clear all filters */
      clearAllFilters: string
      /** <zh/> 导出 CSV | <en/> Export CSV */
      exportCsv: string
      /** <zh/> 导出 Excel | <en/> Export Excel */
      exportExcel: string
      /** <zh/> 导入 Excel | <en/> Import Excel */
      importExcel: string
      /** <zh/> 打印 | <en/> Print */
      print: string
      /** <zh/> 隐藏当前列 | <en/> Hide this column */
      hideThisColumn: string
      /** <zh/> 显示所有列 | <en/> Show all columns */
      showAllColumns: string
      /** <zh/> 复制（通用） | <en/> Copy (generic) */
      copy: string
      /** <zh/> 行操作分组标题 | <en/> Row operations group title */
      rowOperations: string
      /** <zh/> 列操作分组标题 | <en/> Column operations group title */
      columnOperations: string
    }
    /** <zh/> 列组管理面板相关文本 | <en/> Column group management panel-related texts */
    columnGroup: {
      /** <zh/> 面板标题 | <en/> Panel title */
      title: string
      /** <zh/> 创建分组按钮文本 | <en/> Create group button text */
      createGroup: string
      /** <zh/> 删除分组按钮文本 | <en/> Delete group button text */
      deleteGroup: string
      /** <zh/> 重命名分组提示 | <en/> Rename group prompt */
      renameGroup: string
      /** <zh/> 新建分组默认名称 | <en/> Default name for a new group */
      newGroupName: string
      /** <zh/> 分组不能为空提示 | <en/> Message that the group cannot be deleted when not empty */
      groupNotEmpty: string
      /** <zh/> 分组名称不能为空提示 | <en/> Message that the group name cannot be empty */
      groupNameRequired: string
      /** <zh/> 应用按钮文本 | <en/> Apply button text */
      apply: string
      /** <zh/> 重置按钮文本 | <en/> Reset button text */
      reset: string
      /** <zh/> 拖拽提示文本 | <en/> Drag hint text */
      dragHint: string
      /** <zh/> 空分组提示 | <en/> Empty group hint */
      emptyGroup: string
      /** <zh/> 列被锁定不可移动提示 | <en/> Message that the column is locked and cannot be moved */
      columnLocked: string
      /** <zh/> 超过最大深度提示 | <en/> Message that the maximum depth is exceeded */
      maxDepthExceeded: string
    }
  }
  /** <zh/> 表单相关文本 | <en/> Form-related texts */
  form: {
    /** <zh/> 展开按钮文本 | <en/> Expand button text */
    expand: string
    /** <zh/> 收起按钮文本 | <en/> Collapse button text */
    collapse: string
    /** <zh/> 全屏按钮文本 | <en/> Fullscreen button text */
    fullscreen: string
    /** <zh/> 退出全屏按钮文本 | <en/> Exit fullscreen button text */
    exitFullscreen: string
    /** <zh/> 新增按钮文本 | <en/> Add button text */
    add: string
    /** <zh/> 字段重复提示 | <en/> Duplicate fields message */
    duplicateFields: string
    /** <zh/> 输入框占位文本 | <en/> Input placeholder text */
    inputPlaceholder: string
    /** <zh/> 选择框占位文本 | <en/> Select placeholder text */
    selectPlaceholder: string
  }
  /** <zh/> 编辑模式相关文本 | <en/> Edit mode-related texts */
  edit: {
    /** <zh/> 编辑按钮文本 | <en/> Edit button text */
    edit: string
    /** <zh/> 取消编辑按钮文本 | <en/> Cancel editing button text */
    cancel: string
    /** <zh/> 确认编辑按钮文本 | <en/> Confirm editing button text */
    confirm: string
    /** <zh/> 必填字段验证提示 | <en/> Required field validation message */
    required: string
    /** <zh/> 字段验证失败提示 | <en/> Field validation failure message */
    validationError: string
  }
  /** 结构化错误消息——与 TABLE_ERROR_CODES 中的错误码一一对应 | Structured error messages — one-to-one mapping with TABLE_ERROR_CODES */
  error: TableErrorMessages
}

/**
 * <zh/> 错误码到消息/建议的映射类型，由 TableErrorCode 自动推导
 * <en/> Error-code to message/suggestion mapping type, derived from TableErrorCode
 */
export type TableErrorMessages = {
  [K in TableErrorCode]: {
    /** <zh/> 面向开发者的错误描述 | <en/> Developer-facing error description */
    message: string
    /** <zh/> 面向开发者的修复建议 | <en/> Developer-facing fix suggestion */
    suggestion: string
  }
}
