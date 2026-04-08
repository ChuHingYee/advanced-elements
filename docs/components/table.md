# AdvTable 高级表格组件

基于 Element Plus 的 ElTable（default 模式）和 ElTableV2（virtual 模式）封装，提供高级表格功能。

与 Element Plus 原生表格的区别：
- 统一的管理式配置模型（config-driven）
- 完整的数据管线（sort → filter → externalFilter → pipeline）
- 内置编辑/校验体系
- 虚拟滚动支持（ElTableV2）
- 树形数据、行分组、展开行
- 右键菜单、列状态持久化
- 数据导出（CSV/Excel）、导入、打印

---

## 安装

```shell
pnpm add @advanced-elements/table
```

```vue
<script setup lang="ts">
import { AdvTable } from '@advanced-elements/table'
</script>
```

---

## Props

### 核心 Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `mode` | `'default' \| 'virtual'` | `'virtual'` | 渲染模式：default-ElTable 渲染，virtual-ElTableV2 虚拟滚动 |
| `border` | `boolean` | `true` | 显示表格边框（外边框+纵向内边框），不影响列宽拖拽 |
| `resizable` | `boolean` | `true` | 是否允许拖拽调整列宽。列级 `resizable` 优先级更高 |
| `columns` | `AdvColumn[]` | `[]` | 列配置数组 |
| `data` | `T[]` | - | 表格数据（未设置 `request.source` 时生效） |
| `loading` | `boolean` | - | 加载状态（与内部 loading 通过 OR 合并） |
| `selectedRowKeys` | `string[]` | - | 选中的行 key 数组，配合 `rowKey` 使用 |
| `quickFilter` | `string` | - | 全局搜索文本（v-model:quickFilter 双向绑定） |
| `emptyText` | `string` | - | 空数据时显示的文本 |
| `rowClassName` | `TableProps['rowClassName']` | - | 行 className，支持函数 `({ row, rowIndex }) => string` |
| `tooltipEffect` | `TableProps['tooltipEffect']` | `'dark'` | 溢出 tooltip 的 effect 主题 |
| `tooltipOptions` | `TableProps['tooltipOptions']` | - | 溢出 tooltip 的自定义选项 |
| `tooltipFormatter` | `Function` | - | 溢出 tooltip 内容格式化函数：`({ row, column, cellValue }) => VNode \| string` |
| `spanMethod` | `(params: { row, rowIndex, column, columnIndex, rowSpan?, columnSpan? }) => { rowspan: number, colspan: number } \| undefined` | - | 单元格合并方法，返回 `{ rowspan, colspan }` 表示跨行/跨列合并；返回 `undefined` 表示不合并。与 Element Plus `span-method` 语义一致，由 AdvTable 透传给底层渲染器 |
| `modeSwitchBehavior` | `'warn' \| 'error' \| 'silent'` | `'warn'` | mode 运行时切换策略：三种状态清理完全一致，仅通知不同；`error` 也无法阻止切换（watch 触发前 mode 已生效），阻止请用 `canSwitchMode` 预检或 `v-if` 重建 |
| `spanDynamicMode` | `'warn-only' \| 'rfc-overlay'` | `'warn-only'` | 合并单元格 × 动态行高共存策略（仅 virtual 下 `rfc-overlay` 生效，见下节 C6） |
| `size` | `TableProps['size']` | `'default'` | 仅 `mode="default"` 可传（透传 ElTable）；virtual 下传参即编译报错，密度改走 `uiConfig.sizeConfig` |
| `tableLayout` | `TableProps['tableLayout']` | `'fixed'` | 仅 `mode="default"` 可传（透传 ElTable）；virtual 下传参即编译报错，恒按显式列宽布局 |
| `estimatedRowHeight` | `number` | - | 仅 `mode="virtual"` 可传（透传 ElTableV2）；default 下传参即编译报错。数值切 DynamicSizeGrid，虚拟滚动显著降速（见 v2.1.x 动态网格说明） |
| `containerLayout` | `'bordered' \| 'bare'` | `'bordered'` | 容器布局：`bare` 无边框无内边距，适合嵌入已有边框的父容器 |
| `filterModel` | `Record<string, ColumnFilterValue>` | - | 受控筛选模型（唯一真相源；与 `setFilter` 混用以后写为准；键口径同 `filterChange` 事件） |
| `externalFilter` | `ExternalFilterConfig<T>` | - | 业务过滤钩子（列筛选之后、排序之前；服务端数据源下为页内语义，不触发 refetch） |
| `sortConfig` | `SortConfig` | - | 排序全局配置（见 [排序配置 SortConfig](#排序配置-sortconfig)） |
| `dataPipeline` | `DataPipelineConfig` | - | 数据管线阶段顺序配置（见 [数据管线配置 DataPipelineConfig](#数据管线配置-datapipelineconfig)） |
| `rowPinConfig` | `RowPinConfig` | - | 行固定配置（见 [行固定 RowPinConfig](#行固定-rowpinconfig)） |
| `height` | `number \| string` | - | 表格高度（px 或 CSS 字符串），透传 ElTable / ElTableV2 的 height；不设则自适应父容器 |
| `stripe` | `boolean` | `false` | 斑马纹（default 透传 ElTable，virtual 经行样式实现） |
| `highlightCurrentRow` | `boolean` | `true` | 高亮当前行（default 透传 ElTable，virtual 经行样式实现） |
| `showHeader` | `boolean` | `true` | 是否显示表头（两模式均透传） |
| `performanceProfile` | `'high' \| 'low'` | `'high'` | 性能档位：`low` 关闭滚动看门狗/滚动速度追踪/hover 追踪（低端设备）；未设时跟随全局 ConfigProvider |
| `debug` | `boolean \| DebugConfig` | `false` | 调试诊断开关；`true` ≡ `{ enabled: true, perf: true }`，支持 `{ domains: ['data', 'edit'] }` 按域过滤 |

### 渲染模式能力矩阵（C4 公开承诺）

能力 → 支持模式 → 降级行为（与 `src/types/renderer-caps.ts` 头注释同源，新增模式即扩展该表）：

| 能力 capability | default | virtual | 降级行为 / fallback |
|---|---|---|---|
| declarativeColumns | true（支持声明式列） | false（忽略 default slot，TABLE_VIRTUAL_SLOT_IGNORED） | virtual 下用 columns 配置替代声明式列 |
| spanWithDynamicHeight | true（合并×动态行高共存） | false（TABLE_SPAN_DYNAMIC_HEIGHT_UNSUPPORTED；spanDynamicMode rfc-overlay 为 opt-in 覆盖层） | 默认 warn-only 仅告警视觉不支持；rfc-overlay 时 origin 格走绝对定位覆盖层 |
| smoothScroll | true（scrollTo 支持 smooth/instant） | false（ElTableV2 scrollToRow 无 behavior 支持） | virtual 下 behavior 参数被忽略，按即时滚动 |
| rowIndexDomain | composed（含 pin 交错） | unpinned（网格 + 独立 pin 条带） | 跨 pin 调用方经 adapter toRenderIndex/toRowKey（rowKey 换算，R3） |
| selectionScope | page（当前页） | filtered（全部筛选结果，跨页） | toggleAllSelection/表头全选语义随模式变化；selectAllOnCurrentPage 恒为当前页 |
| scrollFollow | false（目标恒已渲染） | true（目标可能未渲染，需跟随滚动） | virtual 下目标未渲染时先滚动再定位 |
| columnDomain | cells（事件域与 cells 域同构） | event（事件域与 cells 域不同构，需翻译） | virtual 下单元格事件经列域翻译再定位 |

单模式 prop 按 `mode` 判别收窄类型（`AdvTableProps` 判别联合）：`size`/`tableLayout` 仅 default 可传，`estimatedRowHeight` 仅 virtual 可传，传错模式即编译报错（`size?: never` 等）。`spanDynamicMode` 两模式均可传，仅 virtual 下 `rfc-overlay` 生效。

C6 特性开关 `spanDynamicMode`（默认 warn-only 零行为变更；rfc-overlay 时 virtual 侧 origin 格改走 `useSpanOverlay.getOverlayStyle` 绝对定位覆盖层，替代 rowspan 估算）：

| 取值 | 行为 |
|---|---|
| warn-only | 仅告警（TABLE_SPAN_DYNAMIC_HEIGHT_UNSUPPORTED / virtual 渲染器 dev 警告），视觉不支持；getOverlayStyle 恒返回 undefined |
| rfc-overlay | virtual 侧 origin 格用绝对定位覆盖层；dynamic 网格 dev 警告静默；default 模式不受影响 |

### 工具栏配置 ToolbarConfig

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `columnSetting` | `boolean` | `false` | 是否显示列设置按钮 |
| `refreshBtn` | `boolean` | `false` | 是否显示刷新按钮 |
| `pollingBtn` | `boolean` | `false` | 是否显示轮询按钮 |
| `pollingOptions` | `PollingOptions` | - | 轮询配置 |
| `exportBtn` | `boolean` | `false` | 是否显示 Excel 导出按钮 |
| `exportOptions` | `ExportOptions` | - | Excel 导出配置 |
| `exportCsvBtn` | `boolean` | `false` | 是否显示 CSV 导出按钮 |
| `exportCsvOptions` | `ExportCsvOptions` | - | CSV 导出配置 |
| `importBtn` | `boolean` | `false` | 是否显示导入按钮 |
| `importOptions` | `ImportOptions` | - | 导入配置 |
| `printBtn` | `boolean` | `false` | 是否显示打印按钮 |
| `printOptions` | `PrintConfig` | - | 打印配置 |

#### PollingOptions

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用轮询 |
| `interval` | `number` | `3000` | 轮询间隔（毫秒） |

#### ExportOptions

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `filename` | `string` | - | 导出文件名 |
| `sheetName` | `string` | - | 工作表名 |
| `columnMode` | `'visible' \| 'all'` | `'visible'` | 导出列模式 |
| `columns` | `AdvColumn[]` | - | 自定义导出列（优先级最高） |
| `dataMode` | `'all' \| 'current' \| 'selected'` | `'all'` | 导出数据模式 |
| `xlsxOptions` | `Record<string, any>` | - | xlsx writeFile 透传配置 |

#### ExportCsvOptions

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `filename` | `string` | - | 导出文件名 |
| `columnMode` | `'visible' \| 'all'` | `'visible'` | 列模式 |
| `columns` | `AdvColumn[]` | - | 自定义列 |
| `dataMode` | `'all' \| 'current' \| 'selected'` | `'all'` | 数据模式 |
| `bom` | `boolean` | - | 是否添加 BOM 头 |

#### ImportOptions

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `accept` | `string[]` | `['.csv', '.xlsx', '.xls']` | 接受的文件类型 |
| `mode` | `'append' \| 'replace'` | `'append'` | 导入模式 |
| `encoding` | `string` | `'utf-8'` | 编码 |
| `delimiter` | `string` | `','` | CSV 分隔符 |
| `headerRow` | `boolean` | `true` | 是否包含表头行 |
| `maxRows` | `number` | - | 最大行数（超过截断并提示） |
| `transformRow` | `Function` | - | 行转换函数：`(row, rowIndex) => row \| null` |
| `beforeImport` | `Function` | - | 导入前回调，返回 false 取消：`(rows, columns) => boolean` |
| `onImported` | `Function` | - | 导入完成回调：`(rows) => void` |

#### PrintConfig

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `sheetName` | `string` | - | 打印页标题 |
| `columnMode` | `'visible' \| 'all'` | `'visible'` | 列模式 |
| `columns` | `AdvColumn[]` | - | 自定义列 |
| `dataMode` | `'all' \| 'current' \| 'selected'` | `'all'` | 数据模式 |
| `pageOrientation` | `'portrait' \| 'landscape'` | `'portrait'` | 页面方向 |
| `paperSize` | `'A4' \| 'A3' \| 'letter'` | `'A4'` | 纸张大小 |
| `rowsPerPage` | `number` | `0` | 每页行数（0=浏览器自动分页） |
| `style` | `string` | - | 自定义打印样式 |
| `headerHtml` | `string \| Function` | - | 自定义页眉 |
| `footerHtml` | `string \| Function` | - | 自定义页脚 |
| `beforePrint` | `Function` | - | 打印前回调，返回 false 取消 |
| `afterPrint` | `Function` | - | 打印完成回调 |
| `showRowIndex` | `boolean` | `false` | 是否显示行号列 |

### 请求配置 RequestConfig

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `source` | `DataSource` | - | 数据源函数，接收分页参数返回 Promise |
| `auto` | `boolean` | `true` | 是否初始化时自动发起请求 |
| `formatMaps` | `FormatMaps` | - | 响应数据字段映射 |
| `paramKeys` | `{ page?, size? }` | - | 分页参数 key 映射 |
| `transformRequest` | `Function` | - | 请求参数转换函数 |
| `transformResponse` | `Function` | - | 响应数据转换函数 |
| `autoParams` | `boolean \| { sortKey?, filterKey? }` | `false` | 自动携带排序/筛选进请求参数（`sort: [{ prop, order }]` + `filter`）；关闭时排序/筛选为页内语义。复杂序列化用 `transformRequest` 改写 |
| `timeout` | `number` | - | 请求超时（毫秒），`0` = 不超时；仅自动请求生效，manual 模式宿主侧自行超时 |
| `retries` | `number \| UseRequestRetryOptions` | - | 失败重试次数或完整重试配置（指数退避）；仅自动请求生效 |
| `retryDelay` | `number` | - | 重试基础延迟（`retries` 为数字时生效） |
| `retryBackoffFactor` | `number` | - | 指数退避因子 |
| `retryMaxDelay` | `number` | - | 最大重试延迟 |
| `retryOn` | `(error: unknown) => boolean` | - | 是否重试判定（返回 true 重试） |

#### DataSource

```typescript
type DataSource = (
  params: Record<string, unknown>,
  signal?: AbortSignal
) => Promise<unknown>
```

> **请传稳定引用**：`source` 参与响应式监听——运行时切换数据源（含由 `undefined` 变为函数）时，表格会重置到第 1 页并自动重取。若在模板里内联箭头函数（如 `:request="{ source: (p) => api.list(p) }"`），父组件每次重渲染都会生成新的函数引用，被判定为"数据源切换"，从而反复重置页码并发起请求。请把数据源函数定义为 `setup` 中的稳定引用（或 `import` 的模块函数）后再传入。

#### FormatMaps

```typescript
type FormatMaps = Record<string, keyof ResponseData>
```

### 分页配置 AdvPaginationConfig

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `true` | 是否启用分页 |
| `mode` | `'page' \| 'manual' \| 'client'` | `'page'` | 分页模式（见下方"分页模式"） |
| `sticky` | `boolean` | `true` | 是否固定底栏 |
| `containerHeight` | `number` | `450` | 容器高度（virtual 模式） |
| `autoPageSize` | `boolean` | `false` | 自动计算每页条数 |
| `rowHeight` | `number` | `48` | 行高（autoPageSize/virtual 模式） |
| `pageSize` | `number` | `10` | 每页条数 |
| `infiniteScroll` | `boolean` | `false` | 无限滚动自动加载（manual + virtual 模式）：触底自动调用 loadMore，含 loading/hasMore 防重入 |
| `pageSizes` | `number[]` | `[10, 20, 30]` | 每页条数选项 |
| `total` | `number` | - | 数据总条数（覆盖内部计算） |
| `layout` | `string` | `'total, sizes, prev, pager, next, jumper'` | 分页布局 |
| `background` | `boolean` | - | 分页组件背景色 |
| `hideOnSinglePage` | `boolean` | - | 单页时隐藏 |
| `pagerCount` | `number` | `7` | 页码按钮数量 |
| `disabled` | `boolean` | - | 禁用分页 |

#### 分页模式

| 模式 | 说明 |
|------|------|
| `page` | 传统分页（默认），分页状态由内部接管：通过 `pageChange` 事件上报页码/条数变更，外部用 `setCurrentPage` / `setPageSize` 方法编程式控制（**非** `v-model:currentPage` / `v-model:pageSize`） |
| `manual` | 手动分页：表格只派发 `request` 事件通知父组件取数，数据与 loading 由父组件回写（见下方"manual 模式回写契约"） |
| `client` | 客户端分页：不发起请求，对已加载数据本地切片（`requestMode` 自动切换为 `simple`） |

> 追加式加载（触底"加载更多" / 无限滚动）不是独立的 `mode`：在 `manual` + `mode="virtual"` 下开启 `pagination.infiniteScroll`，触底会调用 `loadMore` 追加数据。

#### manual 模式回写契约

`manual` 模式下表格不自动取数，也不会替父组件写数据。父组件收到 `request` 事件后必须完成两件事：

```ts
// payload: { page, size, params, append, reason, signal, requestId }
async function onRequest(payload) {
  const { page, size, params, signal, requestId } = payload
  const res = await api.list({ page, size, ...params }, { signal })

  // 1) 回写数据：回显 requestId，序号过期的写入会被静默丢弃（防止先发后到覆盖新页）
  tableRef.value.setResponseData(res.rows, requestId)

  // 2) loading 随回写自动结束；也可显式 tableRef.value.setLoading(false)
}
```

- **回写通道**：`api.setResponseData(rows, requestId?)`；或 `v-model:data`（后者不带序号守卫）
- **写入路由**：配置了 `request.source` 时写入远程响应数据；未配置时写入 `v-model:data` 模型
- **非推荐组合（A1）**：`manual` + `request.source` 可并存但不推荐——manual 下不会自动拉取 `source`，只派发 `request` 事件由父取数回写；如需自动取数请去掉 `manual`。同配时 dev 下会提示一次，不阻断运行
- **序号守卫**：务必回显 `payload.requestId`，否则先发后到的旧响应可能覆盖新页
- **loading 复位**：`setResponseData` 接受写入后自动复位；走 `v-model:data` 时，父组件回写数据后表格同样会自动复位。两者都不做则 loading 保持开启，且 `infiniteScroll` 的防重入守卫会阻止后续加载
- **取消**：`payload.signal` 可直接用于取消已失效请求

### 搜索配置 SearchConfig

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用搜索 |
| `labelWidth` | `number \| 'auto'` | - | 表单标签宽度 |
| `collapsed` | `boolean` | `false` | 是否默认折叠 |
| `debounceTime` | `number` | `300` | 防抖时间(ms) |
| `searchText` | `string` | - | 搜索按钮文案 |
| `resetText` | `string` | - | 重置按钮文案 |
| `span` | `number` | `6` | 表单项栅格占比 |
| `buttons` | `ButtonConfig` | `['query', 'reset']` | 按钮配置 |
| `fields` | `FormField[]` | - | 自定义搜索字段 |
| `components` | `Record<string, any>` | - | 自定义搜索组件 |
| `defaultValues` | `Record<string, any>` | - | 搜索表单默认值 |

**v-model**: 支持 `v-model:search-values` 双向绑定搜索表单值（纯 `defineModel`，`AdvTableProps` 无同名字段；配套事件 `update:search-values`）

### 列全局配置 ColumnConfig

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `defaultColDef` | `Partial<AdvColumn>` | - | 默认列定义，所有列继承 |
| `columnTypes` | `Record<string, Partial<AdvColumn>>` | - | 列类型预设 |
| `columnDraggable` | `boolean` | `false` | 是否启用列拖拽排序 |
| `autoSizeColumns` | `boolean` | - | 列自适应宽度模式 |
| `sidePanel` | `boolean` | `false` | 是否启用列设置侧边面板 |
| `sidePanelPosition` | `'left' \| 'right'` | `'right'` | 面板位置 |
| `sidePanelDefaultOpen` | `boolean` | `false` | 初始展开面板 |
| `sidePanelDestroyOnClose` | `boolean` | `true` | 关闭销毁内容 |

### 行配置 RowConfig

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `rowKey` | `string \| Function \| number \| symbol` | - | 行唯一标识字段或函数 |
| `rowSelection` | `'single' \| 'multiple'` | `'multiple'` | 行选择模式 |
| `rowMultiSelectWithClick` | `boolean` | `true` | 允许单击多选（无需 Ctrl/Shift） |
| `suppressRowClickSelection` | `boolean` | `false` | 禁止点击行选中 |
| `rowClickSelect` | `boolean` | `true` | 点击行触发选中。false 时仅 checkbox/radio 列生效 |
| `keepSelectionAcrossPages` | `boolean` | `false` | 跨页保留选中。服务端分页下翻页时，数据刷新会从选中集剪除已不在当前数据中的行；设为 `true` 时保留选中集（配合 `selectionChange` 同步的 rowKey 维持跨页选择） |
| `rowDraggable` | `boolean` | `false` | 启用行拖拽排序 |
| `rowDragHandle` | `string` | - | 拖拽手柄 CSS 选择器 |
| `suppressMoveWhenRowDragging` | `boolean` | `false` | 拖拽时禁止行实时移动，仅显示插入指示线 |
| `isRowValidDropPosition` | `Function` | - | 判断行是否可放置到目标位置 |
| `beforeDrag` | `Function` | - | 拖拽前回调，返回 false 取消 |

### 筛选配置 FilterConfig

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `sidePanel` | `boolean` | `false` | 是否启用侧边筛选面板 |
| `sidePanelPosition` | `'left' \| 'right'` | `'right'` | 面板位置 |
| `floatingFilter` | `boolean` | `false` | 启用内联浮动筛选 |
| `sidePanelDestroyOnClose` | `boolean` | `true` | 关闭是否销毁内容 |
| `quickFilterDebounce` | `number` | `300` | 全局搜索防抖（毫秒，创建时读取一次） |
| `quickFilterCacheSize` | `number` | `5000` | 全局搜索行文本缓存上限 |

### 合并配置 SpanConfig

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `rows` | `RowSpanCellsConfig` | - | 行合并规则 |
| `cols` | `ColSpanCellsConfig` | - | 列合并规则 |
| `ranges` | `SpanRange[]` | - | 声明式合并范围 |

支持扁平化简写：`{ department: true }` ≡ `{ rows: { department: true } }`

### UI 配置 UiConfig

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `size` | `string` | - | 尺寸 |
| `namespace` | `string` | - | 命名空间 |
| `columnEmptyText` | `string` | `'-'` | 空单元格占位符 |
| `showSummary` | `boolean` | `false` | 是否显示汇总行（等价 `grandTotalRow: 'bottom'`） |
| `summaryMethod` | `Function` | - | 自定义汇总渲染方法（仅 bottom 表尾生效） |
| `sumText` | `string` | - | 汇总行左侧文本 |
| `grandTotalRow` | `'top' \| 'bottom' \| 'pinnedTop' \| 'pinnedBottom'` | - | Grand 总计行位置（AG Grid 对齐；显式设置优先于 `showSummary`） |
| `groupTotalRow` | `'top' \| 'bottom' \| Function` | - | 分组小计行（AG Grid 对齐；函数可按分组返回位置/`undefined` 跳过，需 `rowGroupConfig` 启用） |
| `groupSuppressBlankHeader` | `boolean` | `false` | 有小计行时保留组头聚合值（AG Grid 对齐；默认置空组头聚合避免重复） |
| `totalValueGetter` | `Function` | - | 合计标签自定义（AG Grid 对齐；`(params) => string`，`params.level === -1` 为 Grand） |
| `suppressStickyTotalRow` | `boolean \| 'grand' \| 'group'` | - | 取消合计行粘性（AG Grid 对齐；`true` 全部/`'grand'` 仅总计/`'group'` 仅小计） |
| `tableId` | `string` | - | 表格唯一 ID |
| `sizeConfig` | `SizeConfig` | - | 尺寸覆盖配置 |

#### SizeConfig

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `rowHeight` | `number` | `48` | 行高 |
| `headerCellHeight` | `number` | `48` | 表头高度 |
| `summaryRowHeight` | `number` | `48` | 汇总行高度 |
| `floatingFilterHeight` | `number` | `36` | 浮动筛选高度 |
| `cellPadding` | `string` | - | 单元格内边距 |
| `headerCellPadding` | `string` | - | 表头单元格内边距 |
| `cellFontSize` | `string` | - | 单元格字号 |

### 列状态持久化 ColumnStatePersistence

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | - | 是否启用 |
| `storage` | `ColumnStateStorage` | - | 自定义存储适配器（默认 localStorage） |
| `storageKey` | `string` | `'adv-table-cols-{tableId}'` | 存储键名 |
| `autoSave` | `boolean` | `true` | 自动保存 |
| `debounce` | `number` | `300` | 保存防抖（毫秒） |
| `autoRestore` | `boolean` | `true` | 自动恢复 |
| `include` | `(keyof ColumnState)[]` | - | 持久化属性白名单 |
| `errorStrategy` | `'silent' \| 'warn' \| 'throw'` | `'silent'` | 存储异常处理策略 |
| `onStorageError` | `Function` | - | 存储异常回调 |

### 外部筛选器 ExternalFilterConfig

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `isExternalFilterPresent` | `() => boolean` | - | 是否有外部筛选激活 |
| `doesExternalFilterPass` | `(row: T) => boolean` | - | 行是否通过外部筛选 |

### 右键菜单配置 ContextMenuConfig

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `header` | `ContextMenuAreaConfig` | - | 表头区域菜单配置 |
| `body` | `ContextMenuAreaConfig` | - | 表体区域菜单配置 |
| `footer` | `ContextMenuAreaConfig` | - | 表尾区域菜单配置 |
| `visibleMethod` | `Function` | - | 菜单弹出前回调，可修改可见/禁用状态 |
| `builtins` | `{ disabled?: BuiltinMenuCode[] }` | - | 禁用内置菜单项 |

#### 内置菜单项 BuiltinMenuCode

| 菜单项 | 说明 |
|--------|------|
| `copyCell` | 复制单元格 |
| `copyCellWithHeader` | 带表头复制单元格 |
| `copyRow` | 复制行 |
| `copyRowWithHeaders` | 带表头复制行 |
| `copySelectedRows` | 复制选中行 |
| `copySelectedRowsWithHeaders` | 带表头复制选中行 |
| `cutCell` | 剪切单元格 |
| `pasteCell` | 粘贴单元格 |
| `clearCell` | 清空单元格 |
| `editCell` | 编辑单元格 |
| `deleteRow` | 删除行 |
| `deleteSelectedRows` | 删除选中行 |
| `insertRowAbove` | 上方插入行 |
| `insertRowBelow` | 下方插入行 |
| `autoSizeThisColumn` | 自适应当前列宽 |
| `autoSizeAllColumns` | 自适应所有列宽 |
| `resetColumns` | 重置列状态 |
| `clearSort` | 清除排序 |
| `clearFilter` | 清除列筛选 |
| `clearAllFilters` | 清除所有筛选 |
| `exportCsv` | 导出 CSV |
| `exportExcel` | 导出 Excel |
| `importExcel` | 导入 Excel |
| `print` | 打印 |
| `hideThisColumn` | 隐藏当前列 |
| `showAllColumns` | 显示所有列 |

### 拦截器配置 InterceptorConfig

| 事件名 | 类型 | 说明 |
|--------|------|------|
| `event.keydown` | `InterceptorHandler` | 键盘按键按下时拦截，返回 false 阻止默认行为 |
| `event.clearEdit` | `InterceptorHandler` | 清空单元格编辑时拦截 |
| `event.showMenu` | `InterceptorHandler` | 右键菜单弹出前拦截 |
| `event.export` | `InterceptorHandler` | 导出操作执行前拦截 |
| `event.cellClick` | `InterceptorHandler` | 单元格单击时拦截 |
| `event.cellDblclick` | `InterceptorHandler` | 单元格双击时拦截 |
| `event.rowClick` | `InterceptorHandler` | 行单击时拦截 |
| `event.headerClick` | `InterceptorHandler` | 表头单击时拦截 |
| `event.sortChange` | `InterceptorHandler` | 排序变更时拦截 |
| `edit.start` | `InterceptorHandler` | 单元格进入编辑时拦截 |
| `edit.stop` | `InterceptorHandler` | 单元格退出编辑时拦截 |
| `edit.commit` | `InterceptorHandler` | 单元格编辑提交时拦截 |

### 编辑配置 EditConfig

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `editType` | `'fullRow' \| 'batch' \| 'readOnly'` | - | 编辑类型。不设为默认单元格编辑 |
| `stopEditingWhenCellsLoseFocus` | `boolean` | `false` | 失焦时自动提交编辑 |
| `singleClickEdit` | `boolean` | `false` | 单击进入编辑（默认双击） |
| `enterMovesDownAfterEdit` | `boolean` | `false` | Enter 提交后焦点移到下一行 |
| `tabToNextCell` | `boolean \| Function` | `false` | Tab 在可编辑单元格间导航 |
| `activeMethod` | `(params) => boolean` | - | 返回 false 阻止单元格进入编辑 |
| `invalidEditValueMode` | `'revert' \| 'block' \| 'notify'` | `'block'` | 校验失败时的处理模式 |
| `enableCellEditingOnF2` | `boolean` | `false` | F2 键触发编辑 |
| `enableCellEditingOnBackspace` | `boolean` | `false` | Backspace 键触发编辑 |
| `enableClipboard` | `boolean` | `false` | Ctrl+C/V/X 剪贴板操作 |
| `showStatus` | `boolean` | `false` | 编辑中的单元格添加 dirty CSS class |
| `crossFieldValidator` | `CrossFieldValidator` | - | 行级跨字段校验函数（仅 fullRow 模式） |

#### 编辑模式说明

| editType | 数据写入 | 事件回调 | 提交 API | 取消 API |
|----------|---------|---------|---------|---------|
| 不设置 | 直接写入 | `cellValueChanged` | `commitEditing` | `cancelEditing` |
| `'fullRow'` | 直接写入 | `fullRowEdit` | `commitEditing` | `cancelEditing` |
| `'batch'` | 缓冲写入 | `batchPendingChange` | `commitBatchEdit` | `cancelBatchEdit` |
| `'readOnly'` | 不写入 | `cellEditingRequest` | `commitEditing` | `cancelEditing` |

### URL 状态同步 UrlStateConfig

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用 |
| `pageKey` | `string` | `'p'` | 页码 URL 参数名 |
| `sizeKey` | `string` | `'s'` | 每页条数 URL 参数名 |

### 范围选择 RangeSelectionConfig

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `true` | 是否启用（默认启用，传 false 禁用） |
| `autoCopy` | `boolean` | `false` | 选择完成时自动复制到剪贴板 |

支持简写：`true` 等价于 `{ enabled: true }`

### 树形数据 TreeConfig

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `children` | `string` | `'children'` | 子节点字段名 |
| `defaultExpandAll` | `boolean` | `false` | 默认展开所有节点 |
| `defaultExpandedRowKeys` | `(string \| number)[]` | - | 默认展开的行 keys |
| `indent` | `number` | `20` | 缩进宽度（px） |
| `loadData` | `Function` | - | 异步加载子节点 |
| `checkStrictly` | `boolean` | `false` | 父子节点选中独立（默认联动） |

### 行分组 RowGroupConfig

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `field` | `string \| string[]` | - | 分组字段（支持多字段） |
| `headerRenderer` | `Function` | - | 分组头渲染函数 |
| `defaultExpandAll` | `boolean` | `false` | 默认展开所有分组 |
| `defaultExpandedGroupValues` | `unknown[]` | - | 默认展开的分组值 |
| `aggregateColumns` | `Array<{ field: string, agg: 'sum' \| 'avg' \| 'min' \| 'max' }>` | `-` | 分组聚合声明：对每组行集计算聚合值，结果挂到组头行 `__groupAggregates`，并透传给 headerRenderer 与 #groupHeader 插槽的 `aggregates` 参数（键为 `` `${field}:${agg}` ``）；数值口径与汇总行一致，无可数值时为 `null` |

### 展开行 RowExpandConfig

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用展开行功能 |
| `defaultExpandedRowKeys` | `(string \| number)[]` | - | 默认展开的行 keys |
| `accordion` | `boolean` | `false` | 手风琴模式：同时只展开一行 |
| `load` | `Function` | - | 展开行异步加载回调 |
| `persistence` | `{ key, storage? }` | - | 展开状态持久化配置 |

### 排序配置 SortConfig

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `maxSortColumns` | `number` | - | 多列排序（Shift+点击）上限，超限按 FIFO 淘汰最早列；`1` 等价于关闭多列排序；默认不限 |

### 数据管线配置 DataPipelineConfig

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `order` | `DataPipelineStage[]` | `['columnFilter', 'quickFilter', 'externalFilter', 'sort']` | 四阶段排列（`columnFilter` / `quickFilter` / `externalFilter` / `sort`）；非法值（缺段/重复/未知）回退默认并 devWarn |

```ts
:data-pipeline="{ order: ['externalFilter', 'columnFilter', 'quickFilter', 'sort'] }"
```

### 行固定 RowPinConfig

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `topRowKeys` | `(string \| number)[]` | - | 固定在顶部的行 keys |
| `bottomRowKeys` | `(string \| number)[]` | - | 固定在底部的行 keys |
| `maxPinnedRows` | `number` | `50` | 固定行总数上限（顶+底）；固定条带不参与虚拟化，超限截断回滚动区并派发 `TABLE_PIN_LIMIT_EXCEEDED` |

```ts
:row-pin-config="{ topRowKeys: ['total'], bottomRowKeys: ['summary'] }"
```

运行时操作经 expose（`pinRow / unpinRow / isRowPinned / clearPinnedRows`），`validateRow` 须传 renderData 域索引（pin 启用时已剔除固定行）。

---

## 列配置 AdvColumn

### 核心属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `prop` | `string` | - | 列字段名 |
| `key` | `string` | - | 列唯一标识（默认与 prop 相同） |
| `label` | `string` | - | 列标题 |
| `width` | `number \| string` | - | 列宽 |
| `minWidth` | `number` | - | 最小列宽（px，仅数值；字符串会被类型检查阻断） |
| `maxWidth` | `number \| string` | - | 最大列宽 |
| `flex` | `number` | - | flex 增长系数 |
| `resizable` | `boolean` | - | 是否允许拖拽调整列宽（覆盖表格级配置） |
| `sortable` | `boolean \| 'custom' \| ColumnSortableConfig` | `false` | 是否可排序 |
| `filter` | `boolean \| ColumnFilterConfig` | `false` | 是否可筛选 |
| `editable` | `boolean` | `false` | 是否可编辑 |
| `cellEditor` | `CellEditorType` | - | 单元格编辑器类型 |
| `cellEditorParams` | `CellEditorParams \| Function` | - | 编辑器参数（支持函数动态返回） |
| `cellEditorPopup` | `boolean` | `false` | 是否在弹窗中展示编辑器 |
| `cellEditorPopupPosition` | `'over' \| 'under'` | `'over'` | 弹窗相对单元格的位置 |
| `popupRenderer` | `Component` | - | 自定义弹窗渲染组件 |
| `cellEditorSelector` | `(params) => CellEditorType \| CellEditorSelectorResult` | - | 动态编辑器选择（优先级高于 cellEditor） |
| `editorRules` | `ColumnEditorRules` | - | 单元格编辑校验规则 |
| `cellRenderer` | `string \| Component` | - | 自定义渲染组件 |
| `valueType` | `ValueType` | - | 值类型，自动选择渲染器 |
| `valueEnum` | `ValueEnum` | - | 值映射枚举 |
| `children` | `AdvColumn[]` | - | 子列（分组表头） |
| `fixed` | `'left' \| 'right' \| boolean` | - | 列固定 |
| `align` | `'left' \| 'center' \| 'right'` | `'left'` | 对齐方式 |
| `headerAlign` | `'left' \| 'center' \| 'right'` | - | 表头对齐方式 |
| `hidden` | `boolean` | `false` | 是否隐藏列 |
| `selection` | `boolean` | - | 是否为选择列（checkbox/radio） |
| `showOverflowTooltip` | `boolean` | `true` | 内容溢出时显示 tooltip |
| `className` | `string \| Function` | - | 单元格 className |
| `headerClassName` | `string \| Function` | - | 表头单元格 className |
| `cellClassRules` | `Record<string, Function>` | - | 条件式单元格样式 |
| `copyable` | `boolean \| { copyHeaders?: boolean }` | `false` | 单元格值可复制 |
| `ellipsis` | `boolean \| { tooltip?: boolean }` | - | 文本溢出省略 |
| `tooltip` | `string` | - | 列头 tooltip 文本 |
| `emptyText` | `string` | - | 空值占位文本 |
| `pinFixed` | `'left' \| 'right'` | - | 永久固定列（用户不可取消） |
| `lockVisible` | `boolean` | `false` | 锁定列可见性（用户不可通过列设置隐藏） |
| `lockPosition` | `boolean \| 'left' \| 'right'` | - | 锁定列位置（不可拖拽移动） |
| `columnDraggable` | `boolean` | - | 列级拖拽开关（覆盖表格级配置） |
| `columnGroupShow` | `'open' \| 'closed' \| null` | - | 分组列子项的显示控制 |
| `collapsible` | `boolean` | `false` | 分组列是否可折叠 |
| `collapsed` | `boolean` | `false` | 分组列默认收起 |
| `floatingFilter` | `boolean` | - | 列级浮动筛选覆盖（false 排除此列） |
| `suppressFloatingFilterButton` | `boolean` | `false` | 浮动筛选时隐藏 popup 筛选按钮 |
| `quickFilterSuppress` | `boolean` | `false` | 在 quickFilter 全局搜索中排除此列 |

### 值处理

| 属性 | 类型 | 说明 |
|------|------|------|
| `valueGetter` | `(params) => any` | 自定义取值函数（筛选/排序/搜索/导出均使用此返回值） |
| `valueSetter` | `(params) => boolean` | 自定义设值函数（编辑时），返回 true 表示设值成功 |
| `valueParser` | `(params) => any` | 值解析函数（编辑提交时：editingValue → valueParser → valueSetter → row） |
| `valueFormatter` | `(params) => string` | 值格式化函数（仅影响显示） |
| `format` | `(ctx: FormatContext) => string` | 自定义格式化函数（与 valueFormatter 类似但上下文更丰富） |
| `cellRenderer` | `(ctx: CellContext) => VNode \| string` | 自定义单元格渲染器（TSX） |
| `cellComponent` | `Component` | 自定义单元格组件（模板友好，自动接收 CellComponentProps 作为 props） |
| `headerCellRenderer` | `(ctx: HeaderCellContext) => VNode \| string` | 自定义表头渲染器 |

### 列级事件回调

| 属性 | 类型 | 说明 |
|------|------|------|
| `onCellClick` | `(params: { row, rowIndex, column, event }) => void` | 单元格点击回调（在表格级 cellClick 之前调用） |
| `onCellDoubleClick` | `(params: { row, rowIndex, column, event }) => void` | 单元格双击回调 |
| `onCellValueChanged` | `(params: { row, rowIndex, column, oldValue, newValue }) => void` | 单元格值变更回调（在表格级 cellValueChanged 之前调用） |
| `contextMenuItems` | `ContextMenuItemOrSeparator[][]` | 列级右键菜单覆盖（设置后此列右键弹出独立菜单） |

### 排序 ColumnSortableConfig

`sortable` 支持 `true`（客户端排序）、`'custom'`（服务端排序）或 `ColumnSortableConfig` 对象：

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | `'client' \| 'server'` | - | 排序模式 |
| `sortBy` | `string \| string[] \| Function` | - | 自定义排序取值（使用不同 prop 或函数） |
| `sortByFormat` | `boolean` | `false` | 是否使用格式化后的值排序 |
| `sortMethod` | `(a, b) => number` | - | 自定义排序比较函数（设置后忽略 sortBy） |

### 筛选 ColumnFilterConfig

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | `'text' \| 'number' \| 'date' \| 'enum'` | `'text'` | 筛选类型 |
| `options` | `EnumFilterOption[]` | - | 枚举筛选选项（type='enum' 时，未提供则自动从数据提取） |
| `filterByFormat` | `boolean` | `true` | 列有 format 时，是否用格式化后的值筛选 |
| `filterValue` | `(row, cellData) => unknown` | - | 自定义筛选取值函数 |
| `floatingFilterComponent` | `Component` | - | 自定义浮动筛选组件 |
| `floatingFilterParams` | `Record<string, any>` | - | 传递给自定义浮动筛选组件的参数 |

#### 筛选类型

| 类型 | 说明 |
|------|------|
| `text` | 文本筛选 |
| `number` | 数字筛选 |
| `date` | 日期筛选 |
| `dateRange` | 日期范围筛选 |
| `enum` | 枚举筛选 |

### 编辑 CellEditorParams

| 属性 | 类型 | 说明 |
|------|------|--------|
| `precision` | `number` | 数字精度（number 编辑器） |
| `step` | `number` | 步进值（number 编辑器） |
| `min` | `number` | 最小值 |
| `max` | `number` | 最大值 |
| `options` | `{ label, value }[]` | 选项列表（select 编辑器） |
| `filterable` | `boolean` | 是否可搜索 |
| `multiple` | `boolean` | 是否多选 |
| `placeholder` | `string` | 占位符 |
| `maxlength` | `number` | 最大字符数（text 编辑器） |
| `textarea` | `boolean` | 是否文本域（text 编辑器） |
| `popup` | `boolean` | 是否弹窗模式 |
| `popupWidth` | `number \| string` | 弹窗宽度 |
| `componentProps` | `Record<string, any>` | 透传组件 props |

#### 内置编辑器类型

| 类型 | 说明 |
|------|------|
| `text` | 文本输入 |
| `number` | 数字输入 |
| `select` | 下拉选择 |
| `date` | 日期选择 |
| `datetime` | 日期时间选择 |
| `switch` | 开关 |
| `checkbox` | 复选框 |

### 列编辑器校验规则 ColumnEditorRules

```typescript
interface ColumnEditorRules {
  /** 必填，true 或自定义消息字符串 */
  required?: boolean | string
  /** 最小值（数字编辑器）或最小长度（文本编辑器） */
  min?: number | { value: number, message: string }
  /** 最大值（数字编辑器）或最大长度（文本编辑器） */
  max?: number | { value: number, message: string }
  /** 最小长度 */
  minLength?: number | { value: number, message: string }
  /** 最大长度 */
  maxLength?: number | { value: number, message: string }
  /** 正则校验 */
  pattern?: RegExp | { regexp: RegExp, message: string }
  /** 自定义校验函数，返回 true 通过，string 为错误消息 */
  validator?: (value: any, rowData: any) => boolean | string | Promise<boolean | string>
  /** 校验触发时机：'blur'(默认) | 'change' | 'input' */
  trigger?: 'blur' | 'change' | 'input'
}
```

### 合并

| 属性 | 类型 | 说明 |
|------|------|--------|
| `rowSpan` | `boolean \| RowSpanCompareFn` | 行合并配置 |
| `colSpan` | `boolean \| ColSpanCompareFn` | 列合并配置 |

### 操作按钮 ActionConfig

| 属性 | 类型 | 说明 |
|------|------|------|
| `label` | `string` | 按钮文本 |
| `type` | `'primary' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'default'` | 按钮类型 |
| `size` | `'large' \| 'default' \| 'small'` | 按钮尺寸 |
| `icon` | `string \| Component` | 图标 |
| `link` | `boolean` | 是否为链接样式按钮 |
| `disabled` | `boolean \| (context) => boolean` | 是否禁用 |
| `visible` | `boolean \| (context) => boolean` | 是否可见 |
| `onClick` | `(context: { row, index }) => void` | 点击回调 |
| `buttonProps` | `Partial<ButtonProps>` | 透传给 ElButton 的其他属性 |

### 分组与搜索 ColumnSearchConfig

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `defaultValue` | `any` | - | 搜索字段默认值 |
| `transform` | `Function` | - | 搜索值转换函数 |
| `order` | `number` | - | 排序权重（越大越靠前） |
| `hidden` | `boolean` | `false` | 在搜索表单中隐藏 |
| `fieldProps` | `Record<string, any>` | - | 搜索组件属性 |
| `formItemProps` | `Partial<FormItemProps>` | - | 表单项属性 |

---

### ValueType 值类型

`valueType` 支持以下值类型自动渲染：

| 值类型 | 说明 | 示例数据 |
|--------|------|----------|
| `text` | 文本 | 任意字符串 |
| `textarea` | 文本域 | 多行文本 |
| `money` | 金额 | `1000` → `¥1,000.00` |
| `digit` | 数字 | 任意数字 |
| `percent` | 百分比 | `0.5` → `50%` |
| `progress` | 进度条 | `0-100` 的数字 |
| `date` | 日期 | 时间戳或日期字符串 |
| `dateTime` | 日期时间 | 时间戳或日期字符串 |
| `dateRange` | 日期范围 | `[start, end]` 数组 |
| `dateTimeRange` | 日期时间范围 | `[start, end]` 数组 |
| `monthRange` | 月份范围 | `[start, end]` 数组 |
| `year` | 年份 | 时间戳或年份字符串 |
| `yearRange` | 年份范围 | `[start, end]` 数组 |
| `time` | 时间 | 时间字符串 |
| `fromNow` | 相对时间 | `2024-01-01` → `'3天前'` |
| `select` | 选择框 | 枚举值 |
| `radio` | 单选框 | 枚举值 |
| `checkbox` | 复选框 | 枚举值数组 |
| `switch` | 开关 | 布尔值 |
| `avatar` | 头像 | 图片 URL |
| `image` | 图片 | 图片 URL |
| `images` | 图片组 | 图片 URL 数组 |
| `link` | 链接 | URL 字符串 |
| `code` | 代码 | 代码字符串 |
| `jsonCode` | JSON 代码 | JSON 对象 |
| `rate` | 评分 | `0-5` 的数字 |
| `color` | 颜色 | 颜色值 |
| `index` | 序号 | 行号 |
| `indexBorder` | 带边框序号 | 行号 |
| `option` | 操作按钮 | 见 BtnConfig |

---

## Events

所有事件统一使用 camelCase 命名（如 `cellMouseEnter`、`headerClick`），与 Element Plus 原生 kebab-case 不同。

### 请求与数据事件

| 事件名 | 参数类型 | 说明 |
|--------|----------|------|
| `pageChange` | `(page: number, size: number)` | 分页变更 |
| `query` | `(params: Record<string, any>)` | 搜索查询，参数可在拦截器中修改 |
| `reset` | - | 搜索重置 |
| `request` | `(payload: TableRequestPayload)` | 数据请求（手动模式） |
| `refresh` | - | 强制刷新 |
| `dataChange` | `(params: { reason: string, data: T[] })` | 数据管线处理完成后触发 |
| `beforeDataChange` | `(params: { reason, oldData, newData }, tableId)` | 数据写入前钩子——**仅通知，不可否决**（模板 `return false` 不生效）；先校验后调用 `applyTransaction`，或事后 `rollbackLast` 补偿 |
| `afterDataChange` | `(params: { reason, data, oldData }, tableId)` | 数据写入并重算管线后触发（审计日志/外部同步/派生更新） |
| `error` | `(err: TableError)` | 结构化错误事件，承载三类异常：`TABLE_REQUEST_FAILED`（接口请求失败）、`TABLE_RENDER_ERROR`（渲染/插槽抛错，含刚补的渲染错误边界）、`TABLE_VALIDATION_ERROR`（弹窗表单校验异常）。结构见 [TableError](#tableerror-结构)。**这是捕获表格内部错误的唯一出口，务必监听** |
| `update:data` | `(val: T[])` | 数据变更 v-model |
| `update:loading` | `(val: boolean)` | 加载状态变更 v-model |
| `update:columns` | `(val: ProcessedColumn[])` | 列配置变更 v-model |
| `update:quickFilter` | `(val: string)` | 全局搜索文本 v-model |
| `update:search-values` | `(val: Record<string, any>)` | 搜索表单值变更 v-model（配合 SearchConfig） |
| `update:selectedRowKeys` | `(val: (string \| number)[])` | 选中行 key 数组 v-model（配合 `selectedRowKeys` + `rowKey`） |
| `batchPendingChange` | `(hasPending: boolean)` | 批量编辑待提交状态变化 |

> **分页说明**：AdvTable **不提供** `v-model:currentPage` / `v-model:pageSize`。分页状态由内部接管，通过 `pageChange` 事件上报变更，外部用 `setCurrentPage` / `setPageSize`（见 [Expose API](#请求与分页)）进行编程式控制。文档此前误载的 `update:currentPage` / `update:pageSize` 两条 v-model 事件已移除。

### 行事件

| 事件名 | 参数类型 | 说明 |
|--------|----------|------|
| `rowClick` | `(params: { rowData, rowIndex, event })` | 行点击 |
| `rowDblclick` | `(params: { rowData, rowIndex, event })` | 行双击 |
| `rowContextmenu` | `(params: { rowData, rowIndex, event })` | 行右键菜单 |
| `currentChange` | `(currentRow: T, oldRow: T \| null)` | 当前行变更 |
| `rowSelected` | `(row: T, selected: boolean)` | 行选中状态变更 |

### 选择事件

| 事件名 | 参数类型 | 说明 |
|--------|----------|------|
| `selectionChange` | `(rows: T[])` | 选择项变更 |
| `select` | `(selection: T[], row: T)` | 行选中 |
| `selectAll` | `(selection: T[])` | 全选 |

### 单元格事件

| 事件名 | 参数类型 | 说明 |
|--------|----------|------|
| `cellClick` | `(params: { rowData, rowIndex, column, columnIndex, event })` | 单元格点击，可通过 interceptor 拦截 |
| `cellDblclick` | `(params: { rowData, rowIndex, column, columnIndex, event })` | 单元格双击 |
| `cellContextmenu` | `(params: { rowData, rowIndex, column, columnIndex, event })` | 单元格右键菜单 |
| `cellMouseEnter` | `(params: { rowData, rowIndex, event? })` | 鼠标进入单元格 |
| `cellMouseLeave` | 无参数 | 鼠标离开单元格 |
| `cellFocused` | `(params: { rowData, rowIndex, column, columnIndex, event })` | 单元格聚焦 |
| `cellKeyDown` | `(params: { rowData, rowIndex, column, columnIndex, event })` | 单元格键盘按下 |
| `cellKeyPress` | `(params: { rowData, rowIndex, column, columnIndex, event })` | 单元格键盘按键 |
| `cellKeyUp` | `(params: { rowData, rowIndex, column, columnIndex, event })` | 单元格键盘释放 |

### 表头事件

| 事件名 | 参数类型 | 说明 |
|--------|----------|------|
| `headerClick` | `(params: { column, columnIndex, event })` | 表头点击，可通过 interceptor 拦截 |
| `headerContextmenu` | `(params: { column, columnIndex, event })` | 表头右键菜单 |
| `headerDragend` | `(params: { column?, columnIndex, newWidth, oldWidth, event })` | 列宽拖拽调整结束 |

### 列事件

| 事件名 | 参数类型 | 说明 |
|--------|----------|------|
| `columnVisible` | `(payload: { columnKey, visible })` | 列显隐变更 |
| `columnMoved` | `(payload: { columns })` | 列拖动排序 |

### 排序事件

| 事件名 | 参数类型 | 说明 |
|--------|----------|------|
| `sortChange` | `(params: { sortState, prop, order, column, columns })` | 排序变更，可通过 interceptor 拦截 |

### 筛选事件

| 事件名 | 参数类型 | 说明 |
|--------|----------|------|
| `filterChange` | `(params: { filterState: Record<string, ColumnFilterValue> }, tableId)` | 内部筛选实质变更后发射（跳过初始化与等值重写）；受控（`filterModel`）下回写等值模型不回环 |

### 行拖拽事件

| 事件名 | 参数类型 | 说明 |
|--------|----------|------|
| `rowDragStart` | `(payload: { sourceRow, sourceIndex, event })` | 行拖拽开始 |
| `rowDragEnd` | `(payload: { sourceRow, sourceIndex, targetRow, targetIndex, event })` | 行拖拽结束 |

### 编辑事件

| 事件名 | 参数类型 | 说明 |
|--------|----------|------|
| `cellValueChanged` | `(params: { row, rowIndex, prop, column, oldValue, newValue, reason })` | 单元格值变更 |
| `cellEditingStarted` | `(params: { row, rowIndex, prop, column, value })` | 单元格编辑开始 |
| `cellEditingStopped` | `(params: { row, rowIndex, prop, column, oldValue, newValue, reason })` | 单元格编辑结束 |
| `cellEditingRequest` | `(params: { row, rowIndex, prop, column, oldValue, newValue, reason })` | 单元格编辑请求（click-to-edit 模式） |
| `cellEditingCancelled` | `(params: { reason: 'row-deleted' \| 'data-changed' }, tableId)` | 编辑会话被取消（排序/筛选/分页/外部替换致编辑行不可定位时派发） |
| `fullRowEdit` | `(params: { row, rowIndex, changes[], reason })` | 整行编辑提交 |
| `crossFieldValidateError` | `(params: { rowIndex, errors: string[] })` | 跨字段校验错误 |
| `modelUpdated` | - | 模型更新完成 |

### 其他事件

| 事件名 | 参数类型 | 说明 |
|--------|----------|------|
| `scroll` | `(params: { scrollLeft, scrollTop })` | 表格滚动 |
| `gridReady` | - | 表格初始化完成（渲染器挂载后触发） |
| `contextMenuClick` | `(params: ContextMenuClickEvent)` | 右键菜单点击 |
| `dataImport` | `(params: { rows, mode })` | 数据导入（追加/替换） |
| `cellRangeSelected` | `(params: CellRangeSelection)` | 单元格范围选择完成 |
| `rowExpand` | `(params: { row, rowKey, expanded })` | 行展开 |
| `rowCollapse` | `(params: { row, rowKey })` | 行折叠 |
| `endReached` | `(remainDistance: number, tableId)` | 虚拟滚动触底（仅 virtual 模式） |
| `rowsRendered` | `(params: { rowCacheStart, rowCacheEnd, rowVisibleStart, rowVisibleEnd }, tableId)` | 虚拟滚动渲染窗口更新（仅 virtual 模式；超 10 万行时行键解析降级为窗口局部索引） |
| `searchChange` | `(key: string, val: any, formModel: Record<string, any>)` | 搜索字段值变更（每次字段变化触发，适合联动） |

#### TableError 结构

`error` 事件派发的结构化对象，禁止纯字符串传递：

```typescript
interface TableError {
  /** 错误码，格式 TABLE_XXX，便于按类型降级 */
  code: `TABLE_${string}`        // 如 TABLE_REQUEST_FAILED / TABLE_RENDER_ERROR / TABLE_VALIDATION_ERROR
  /** 关联字段：出错的列 prop、请求阶段或渲染阶段（onErrorCaptured 的 info 字符串） */
  field?: string
  /** 面向开发者的修复建议 */
  suggestion?: string
  /** 原始错误对象，便于排查 */
  cause?: unknown
}
```

---

## Expose API

通过 `ref` 访问表格实例公开的 API：

### 请求与分页

| 方法 | 签名 | 说明 |
|------|------|------|
| `refresh` | `() => Promise<void>` | 刷新数据（重新请求） |
| `setLoading` | `(val: boolean) => void` | 设置加载状态 |
| `setResponseData` | `(data: T[], requestId?: number) => void` | **manual/远程模式回写数据**：配置 `request.source` 时写入远程响应数据，否则写入 `v-model:data` 模型；回显 `payload.requestId` 时过期写入被丢弃，接受写入后自动复位 loading |
| `getPagination` | `() => { currentPage, pageSize, total }` | 获取分页信息 |
| `setCurrentPage` | `(page: number) => void` | 设置当前页码 |
| `setPageSize` | `(size: number) => void` | 设置每页条数 |
| `getFullData` | `() => T[]` | 获取完整数据 |
| `applyTransaction` | `(op: { add?, update?, remove? }, reason?) => Promise<ApplyTransactionResult \| null>` | AG 风格增量事务：add 追加 / update 按行键整行替换（保位）/ remove 按行键移除；写入后用 `rollbackLast` 补偿回滚；竞态失败返回 `null` |
| `rollbackLast` | `() => boolean` | 回滚最近一次事务写入（`applyTransaction` 的补偿通道；`beforeDataChange` 无否决语义） |
| `version` | `string` | 当前 AdvTable 版本号（源自 `ADV_TABLE_VERSION`），用于运行时能力探测与兼容判断 |

### 选择

| 方法 | 签名 | 说明 |
|------|------|------|
| `clearSelection` | `() => void` | 清空所有选择 |
| `toggleRowSelection` | `(row: T, options?: { selected?, ignoreSelectable?, ctrlKey?, shiftKey? }) => void` | 切换行选中状态（v3 对象式唯一形态） |
| `invertSelection` | `() => void` | 反选 |
| `deselectAll` | `() => void` | 取消全部选中（`clearSelection` 同义） |
| `toggleAllSelection` | `() => void` | 切换全选状态（表头 checkbox 同语义：**行虚拟化下作用域为全部筛选结果**，非虚拟行渲染下为当前页；见下方"全选口径说明"） |
| `selectAll` | `() => void` | 全选 |
| `setSelection` | `(rows: T[]) => void` | 设置选中行为指定行 |
| `getSelectedRows` | `() => T[]` | 获取选中行数据 |
| `initSelectionByKeys` | `(keys: string[]) => void` | 根据行 key 初始化选中 |
| `selectAllFiltered` | `() => void` | 全选当前筛选结果 |
| `deselectAllFiltered` | `() => void` | 取消全选当前筛选结果 |
| `selectAllOnCurrentPage` | `() => void` | 全选当前页（恒以当前页切片为准，与 `toggleAllSelection` 在行虚拟化下的跨页语义不同） |
| `deselectAllOnCurrentPage` | `() => void` | 取消全选当前页 |
| `selectRowByKey` | `(key: string) => void` | 根据行 key 选中行 |
| `selectRowsByKeys` | `(keys: string[]) => void` | 批量根据行 key 数组选中多行 |
| `isSelectedByKey` | `(key: string) => boolean` | 判断行是否被选中 |
| `getSelectedKeys` | `() => string[]` | 获取选中行 key 数组 |
| `getSelectedCount` | `() => number` | 获取选中行数量 |
| `replaceSelection` | `(rows: T[]) => void` | 替换选中行为指定行 |
| `forEachSelected` | `(callback: (row: T) => void) => void` | 遍历选中行 |
| `getSelectedIndices` | `() => number[]` | 获取选中行索引（**renderData 域**：Row Pinning 启用时已剔除 pinned 行） |
| `refreshSelection` | `() => void` | 刷新选中状态 |

> **全选口径说明（A2已决策：有意设计，对齐 AG Grid）**：行虚拟化（`mode="virtual"`）时，表头全选 checkbox 与 `toggleAllSelection` 的作用域是**全部筛选结果**（跨页），这样滚动窗口变化不会导致勾选态闪烁；非虚拟行渲染时作用域为**当前页可见行**。`selectAllOnCurrentPage` / `deselectAllOnCurrentPage` 恒以当前页为准。两者混用时请按业务语义显式选择。

### 当前行

| 方法 | 签名 | 说明 |
|------|------|------|
| `setCurrentRow` | `(row: T) => void` | 设置当前行 |
| `getCurrentRow` | `() => T \| null` | 获取当前行 |

### 搜索

| 方法 | 签名 | 说明 |
|------|------|------|
| `getQueryFormModel` | `() => Record<string, any>` | 获取搜索表单模型 |
| `setQueryFormModel` | `(model: Record<string, any>) => void` | 设置搜索表单模型 |

### 数据

| 方法 | 签名 | 说明 |
|------|------|------|
| `getRowKey` | `(row: T) => string` | 获取行唯一标识 |
| `getCurrentPageData` | `() => T[]` | 获取当前页数据 |
| `getFullData` | `() => T[]` | 获取完整数据 |
| `applyTransaction` | `(op: { add?, update?, remove? }, reason?) => Promise<ApplyTransactionResult \| null>` | AG 风格增量事务：add 追加 / update 按行键整行替换（保位）/ remove 按行键移除；写入后用 `rollbackLast` 补偿回滚；竞态失败返回 `null` |
| `getRenderData` | `() => T[]` | 获取渲染域数据（含 pin 交错口径，见行固定说明） |

### 导出/导入/打印

| 方法 | 签名 | 说明 |
|------|------|------|
| `exportExcel` | `(options?: TableExportOptions & Record<string, unknown>) => Promise<void>` | 导出 Excel（精确已知字段 + 开放透传） |
| `exportCsv` | `(options?: TableExportCsvOptions & Record<string, unknown>) => Promise<void>` | 导出 CSV（精确已知字段 + 开放透传） |
| `print` | `(options?: Partial<PrintConfig>) => void` | 打印表格 |
| `triggerImport` | `() => void` | 触发文件导入 |

### 筛选

| 方法 | 签名 | 说明 |
|------|------|------|
| `setFilter` | `(columnKey: string, value: any) => void` | 设置列筛选值 |
| `resetColumnFilter` | `(columnKey: string) => void` | 重置列筛选 |
| `resetAllFilters` | `() => void` | 重置所有筛选 |
| `getFilterValue` | `(columnKey: string) => any` | 获取列筛选值 |
| `isColumnFiltered` | `(columnKey: string) => boolean` | 判断列是否有筛选 |
| `hasActiveFilter` | `Ref<boolean>` | 是否有激活的筛选 |
| `hasActiveQuickFilter` | `Ref<boolean>` | 是否有激活的全局搜索 |
| `setQuickFilter` | `(text: string) => void` | 设置全局搜索文本 |
| `getQuickFilter` | `() => string` | 获取全局搜索文本 |

### 排序

| 方法 | 签名 | 说明 |
|------|------|------|
| `toggleSort` | `(prop: string, event?) => void` | 切换列排序 |
| `setSort` | `(prop: string, order) => void` | 设置列排序 |
| `setSorts` | `(sorts: Array<{ prop, order }>) => void` | 批量设置多列排序 |
| `clearSort` | `() => void` | 清除所有排序 |
| `getSortOrder` | `(prop: string) => 'ascending' \| 'descending' \| null` | 获取列排序方向 |
| `getSortIndex` | `(prop: string) => number` | 获取列排序索引 |

### 编辑

| 方法 | 签名 | 说明 |
|------|------|------|
| `startEditing` | `(params: { rowIndex, prop, columnKey, value }) => void` | 开始编辑单元格（v3 对象式唯一形态） |
| `stopEditing` | `(reason: CellEditStopReason, commit?: boolean) => void` | 停止编辑 |
| `updateCellEditingValue` | `(columnKey: string, val: any) => void` | 更新编辑中单元格的值 |
| `getCellEditingValue` | `(columnKey: string) => any` | 读取编辑中单元格的值 |
| `submitEdit` | `() => Promise<void>` | 提交当前编辑 |
| `discardEdit` | `() => void` | 丢弃当前编辑 |

### 批量编辑

| 方法 | 签名 | 说明 |
|------|------|------|
| `commitBatchEdit` | `() => Promise<void>` | 提交批量编辑 |
| `cancelBatchEdit` | `() => void` | 取消批量编辑 |
| `hasPendingChanges` | `Ref<boolean>` | 是否有未提交的批量变更 |
| `batchHasPending` | `Ref<boolean>` | plain ref 版本（模板中 .value 响应式） |
| `hasUnsavedChanges` | `() => boolean` | 是否有未保存的变更 |

### 校验

| 方法 | 签名 | 说明 |
|------|------|------|
| `validate` | `() => Promise<boolean>` | 校验所有编辑单元格 |
| `validateRow` | `(rowIndex: number) => Promise<boolean>` | 校验指定行（**renderData 域**：行索引与渲染器一致；批量编辑待提交时取 batch 应用后的数据） |
| `clearValidate` | `(target?: { rowIndex?, columnKey? }) => void` | 清除校验错误 |

### 列状态

| 方法 | 签名 | 说明 |
|------|------|------|
| `getColumnState` | `() => ColumnState[]` | 获取列状态 |
| `applyColumnState` | `(state, options?) => void` | 应用列状态 |
| `resetColumnState` | `() => void` | 重置列状态 |

### 右键菜单

| 方法 | 签名 | 说明 |
|------|------|------|
| `showContextMenu` | `(params: ContextMenuParams) => Promise<void>` | 显示右键菜单 |
| `hideContextMenu` | `() => void` | 隐藏右键菜单 |

### 编辑撤销/重做

| 方法 | 签名 | 说明 |
|------|------|------|
| `undo` | `() => boolean` | 撤销编辑操作 |
| `redo` | `() => boolean` | 重做编辑操作 |
| `canUndo` | `Ref<boolean>` | 是否可撤销 |
| `canRedo` | `Ref<boolean>` | 是否可重做 |

### 树形数据

| 方法 | 签名 | 说明 |
|------|------|------|
| `toggleTreeNodeExpand` | `(rowKey: string \| number) => void` | 切换树节点展开/折叠 |
| `expandTreeNode` | `(rowKey: string \| number) => void` | 展开指定树节点 |
| `collapseTreeNode` | `(rowKey: string \| number) => void` | 折叠指定树节点 |
| `expandAllTreeNodes` | `() => void` | 展开所有树节点 |
| `collapseAllTreeNodes` | `() => void` | 折叠所有树节点 |
| `getTreeMeta` | `(row: any) => TreeRowMeta \| undefined` | 获取行树形元信息 |

### 命名视图

| 方法 | 签名 | 说明 |
|------|------|------|
| `saveView` | `(name: string) => void` | 保存当前列视图（列状态快照） |
| `applyView` | `(name: string) => boolean` | 应用已保存的列视图（不存在返回 `false`） |
| `getSavedViews` | `() => string[]` | 获取已保存的视图名列表 |
| `deleteView` | `(name: string) => boolean` | 删除已保存的视图（不存在返回 `false`） |

### 行固定操作

| 方法 | 签名 | 说明 |
|------|------|------|
| `pinRow` | `(rowKey: TableRowKey, position: 'top' \| 'bottom') => void` | 固定行到顶部/底部 |
| `unpinRow` | `(rowKey: TableRowKey) => void` | 取消行固定 |
| `isRowPinned` | `(rowKey: TableRowKey) => boolean` | 判断行是否已固定 |
| `clearPinnedRows` | `() => void` | 清空全部固定行 |

### 滚动定位

| 方法 | 签名 | 说明 |
|------|------|------|
| `scrollToRow` | `(target: rowKey \| index, options?: { align?: 'auto' \| 'start' \| 'center' \| 'end' }) => boolean` | 滚动到指定行；渲染器未就绪或目标不存在返回 `false` |
| `scrollToColumn` | `(target: columnKey \| index) => boolean` | 滚动到指定列；固定列恒可见直接返回 `true` |
| `resetAfterRowIndex` | `(index?: number, forceUpdate?: boolean) => boolean` | virtual 动态网格从指定行起重测行高；不可达返回 `false` |
| `refreshVirtualRowHeight` | `(index?: number) => boolean` | 便捷重测（`resetAfterRowIndex(index, true)`，默认从 0 行起全量） |

### 展开行

| 方法 | 签名 | 说明 |
|------|------|------|
| `toggleDetailRowExpand` | `(rowKey: string \| number) => void` | 切换行展开面板 |
| `expandDetailRow` | `(rowKey: string \| number) => void` | 展开指定行的展开面板 |
| `collapseDetailRow` | `(rowKey: string \| number) => void` | 折叠指定行的展开面板 |
| `expandAllDetailRows` | `() => void` | 展开全部行展开面板 |
| `collapseAllDetailRows` | `() => void` | 折叠全部行展开面板 |

### 行分组

| 方法 | 签名 | 说明 |
|------|------|------|
| `toggleGroupExpand` | `(groupValue: unknown) => void` | 切换分组展开/折叠 |
| `expandAllGroups` | `() => void` | 展开所有分组 |
| `collapseAllGroups` | `() => void` | 折叠所有分组 |

### 其他

| 方法 | 签名 | 说明 |
|------|------|------|
| `loading` | `Ref<boolean>` | 加载状态 ref |
| `version` | `string` | 当前 AdvTable 版本号（运行时能力探测与兼容判断） |
| `tableRootRef` | `Ref<HTMLElement \| null>` | 表格根元素引用 |

---

## Slots

| 插槽名 | 作用域参数 | 说明 |
|--------|-----------|------|
| `default` | `object` | 默认插槽，转发至表格渲染器 |
| `header-left` | `object` | 表头左侧区域（工具栏左侧） |
| `header-right` | `object` | 表头右侧区域（工具栏右侧） |
| `footer` | `{ currentPage, pageSize, total }` | 完全替换底部内容（含分页） |
| `footer-extra` | - | 分页左侧额外内容 |
| `empty` | `object` | 空数据占位内容（优先级高于 emptyText prop） |
| `append` | `object` | 追加内容（default 模式→ElTable append；virtual 模式→overlay） |
| `expandRow` | `{ row, rowKey }` | 展开行内容（kebab 别名 `expand-row` 同效） |
| `groupHeader` | `{ field, value, count, expanded, aggregates?, toggle }` | 自定义分组头内容（kebab 别名 `group-header` 同效；配置 aggregateColumns 后可读取 aggregates，键为 `` `${field}:${agg}` ``） |
| `error` | `{ error, reset }` | 渲染错误边界 fallback（`error` 事件结构见 TableError，`reset` 重置边界） |
| `{prop}-header` | - | 自定义列表头（插槽名 = `${prop}-header`） |
| `{prop}` | `{ row, cellData, column, index }` | 动态列单元格（插槽名 = 列 prop） |

---

## 包导出 API

### 编辑器注册

```typescript
import {
  registerCellEditor,
  unregisterCellEditor,
  getEditor,
  getRegisteredEditors,
} from '@advanced-elements/table'
```

### 注册自定义编辑器

```typescript
import { registerCellEditor, CellEditorLifecycle } from '@advanced-elements/table'

const MyEditor: CellEditorLifecycle = {
  mounted(props, context) {
    // 编辑器挂载
  },
  // 可选生命周期
  willUnmount() {},
  getValue() {},
  isPopup() {},
  getPopupPosition() {},
}

registerCellEditor('myEditor', MyEditor)
```

### 内置编辑器类型

- `text` — 文本输入
- `number` — 数字输入
- `select` — 下拉选择
- `date` — 日期选择
- `datetime` — 日期时间选择
- `switch` — 开关
- `checkbox` — 复选框

### 导出工具

```typescript
import {
  exportExcel,
  exportCsv,
  importExcel,
  importCsv,
} from '@advanced-elements/table'
```

- `exportExcel(data, columns, options?)` — Excel 导出
- `exportCsv(data, columns, options?)` — CSV 导出
- `importExcel(options?)` — Excel 导入
- `importCsv(options?)` — CSV 导入

### 复制工具

```typescript
import {
  copyCellToClipboard,
  copyRowToClipboard,
  copyRowsToClipboard,
} from '@advanced-elements/table'
```

### 行键工具

```typescript
import { normalizeRowKey } from '@advanced-elements/table'
```

### 国际化 / 多语言

```typescript
import {
  useAdvLocale,
  zhCn,  // 简体中文
  en,    // 英文
} from '@advanced-elements/table'
```

```vue
<template>
  <AdvTable :toolbar="toolbarConfig" />
</template>

<script setup lang="ts">
import { zhCn } from '@advanced-elements/table'

const toolbarConfig = { columnSetting: true, exportBtn: true }
</script>
```

### 筛选注册

```typescript
import {
  registerFilterType,
  getFilterStrategy,
  getRegisteredFilterTypes,
  registerBuiltinFilterTypes,
} from '@advanced-elements/table'
```

### 拦截器工具

```typescript
import {
  useInterceptor,
  addInterceptor,
  removeInterceptor,
  mixinInterceptors,
} from '@advanced-elements/table'
```

### 表格上下文

```typescript
import {
  useTableApi,
  useTableConfig,
  useTableSelection,
  useBatchEdit,
  useCellEdit,
  useCellValidate,
  useColumnState,
  useEditUndo,
} from '@advanced-elements/table'
```

### 类型导出

```typescript
import type {
  AdvColumn,
  AdvTableProps,
  AdvColumnProps,
  ValueType,
  ValueEnum,
  EditConfig,
  CellEditorType,
  CellEditorParams,
  SpanConfig,
  TreeConfig,
  RowGroupConfig,
  RowExpandConfig,
  ColumnState,
  ColumnStatePersistence,
  ContextMenuConfig,
  ContextMenuClickEvent,
  InterceptorConfig,
  ToolbarConfig,
  SearchConfig,
  ExportOptions,
  ExportCsvOptions,
  ImportOptions,
  PrintConfig,
  PollingOptions,
  RowConfig,
  ColumnConfig,
  FilterConfig,
  ExternalFilterConfig,
  UiConfig,
  SizeConfig,
  RangeSelectionConfig,
  PaginationConfig,
  UrlStateConfig,
  RowClickEvent,
  CellClickEvent,
  SortChangeEvent,
  CellValueChangedEvent,
  SelectionChangeEvent,
  RowDragStartEvent,
  RowDragEndEvent,
  ColumnVisibleEvent,
  ColumnMovedEvent,
  DataChangeEvent,
  ScrollEvent,
  CellEditingStartedEvent,
  CellEditingStoppedEvent,
  CellEditRequestEvent,
  FullRowEditEvent,
  ValidateError,
  ColumnEditorRules,
  CrossFieldValidationContext,
  CrossFieldValidator,
  UseRequestReturn,
  AdvTableColumnSlotProps,
} from '@advanced-elements/table'
```

---

## 示例

> 下面每个示例都可以直接在页面上操作——示例区常驻可见，右下角操作栏可「在 StackBlitz 中在线编辑」「在 GitHub 中编辑此示例」「复制代码」「展开/收起源码」；源码与示例同源（就在 `docs/examples/table/*.vue`），改一处即可。
> 页面里的 `:::demo <标题> <文件>` 就是对这些文件的引用（写法见[协作开发指南](/guide/contributing)）。

### 基础示例

:::demo 基础表格 table/basic.vue
:::

### 远程数据

:::demo 远程数据 table/remote-data.vue
:::

`request.source` 拿到分页参数，返回 `{ data, total }`；字段名不一致时用 `formatMaps` 映射。
翻页、排序、筛选都会重新触发 `source`，所以服务端语义请配合 `request.autoParams`。

### 分页

:::demo 客户端分页 table/pagination.vue
:::

本地数据用 `mode: 'client'`（自动切到非分页请求语义）；`mode: 'manual'` 用于「加载更多」，
默认的 `mode: 'page'` 是标准分页。`autoPageSize: true` 时按 `containerHeight / rowHeight` 推算每页条数。

### 搜索表单

:::demo 搜索表单 table/search.vue
:::

列上 `search: true` 自动进搜索表单；`search.fields` 补自定义字段，`type` 取内置组件名
（`input` / `select` / `datePicker` / `switch` / `number`），非内置类型经 `search.components` 注册。

### 工具栏

:::demo 工具栏 table/toolbar.vue
:::

`#header-left` / `#header-right` 插槽在工具栏两侧插入自定义按钮。

### 列设置与固定列

:::demo 列设置与固定列 table/column-setting.vue
:::

`columnConfig.sidePanel` 打开列设置面板；`columnState` 负责把用户的选择持久化。
`pinFixed` 声明永久固定侧（用户改不动），`fixed` 只是当前状态。

### 行选择

:::demo 行选择 table/row-selection.vue
:::

### 列拖拽排序

:::demo 列拖拽排序 table/column-draggable.vue
:::

### 行拖拽排序

:::demo 行拖拽排序 table/row-draggable.vue
:::

`rowConfig.rowDraggable` 开启后，`isRowValidDropPosition` / `beforeDrag` 可拦截非法放置。

### 虚拟列表

:::demo 虚拟列表（5 万行） table/virtual-list.vue
:::

默认渲染模式就是 `virtual`（ElTableV2），只有可视区的行会进 DOM。

### 单元格可编辑

:::demo 单元格可编辑 table/cell-editing.vue
:::

### 全行编辑

:::demo 全行编辑 table/full-row-editing.vue
:::

### 批量编辑

:::demo 批量编辑 table/batch-editing.vue
:::

批量编辑是暂存语义：改动先落在暂存区，`commitBatchEdit()` 统一走校验与提交，`cancelBatchEdit()` 整批丢弃。

### 单元格校验

:::demo 单元格校验 table/cell-validation.vue
:::

### 跨字段校验

:::demo 跨字段校验 table/cross-field-validation.vue
:::

跨字段规则只在整行提交时执行（`editType: 'fullRow'`），错误数组里 `columnKey: '__row__'` 表示挂在行首。

### 树形数据

:::demo 树形数据 table/tree.vue
:::

### 行分组

:::demo 行分组 table/row-group.vue
:::

分组也可以不用插槽：`rowGroupConfig.headerRenderer` 直接返回字符串或 VNode。

### 展开行

:::demo 展开行 table/row-expand.vue
:::

### 单元格合并

:::demo 单元格合并 table/span.vue
:::

复杂的声明式合并（按列语义 + 指定矩形区域）：

```ts
:span-config="{
  // 行方向：按列 prop 合并相邻同值行，值为函数时自定义比较
  rows: { department: true, role: (rowA, rowB) => rowA.role === rowB.role },
  // 列方向：同行相邻列合并
  cols: { name: true },
  // 矩形区域：{ row, col } 是左上角，rowspan / colspan 是尺寸
  ranges: [{ row: 0, col: 0, rowspan: 2, colspan: 2 }],
}"
```

### 自定义合并函数

:::demo 自定义合并函数 table/span-method.vue
:::

`spanMethod` 优先于 `spanConfig`；返回 `undefined` 表示这一格回退到内部自动合并。

### URL 状态同步

:::demo URL 状态同步 table/url-state.vue
:::

同页多表时务必给不同的 `pageKey` / `sizeKey`，否则后写覆盖先写。

### 外部筛选器

:::demo 外部筛选器 table/external-filter.vue
:::

### 右侧筛选面板

:::demo 筛选面板 table/filter-panel.vue
:::

列上的 `filter` 支持 `'text' | 'number' | 'date' | 'enum'` 简写，或 `{ type, options }` 对象形态。

### 右键菜单

:::demo 右键菜单 table/context-menu.vue
:::

内置菜单项见 `BuiltinMenuCode`；`visibleMethod` 在弹出前统一鉴权，返回 `false` 则本次不弹。

### 事件拦截器

:::demo 事件拦截器 table/interceptor.vue
:::

### 事件监听完整示例

事件按职责分组，完整清单见 [Events](#events)：

```vue
<template>
  <AdvTable
    :columns="columns"
    :data="data"
    :edit-config="{}"
    @row-click="onRowClick"
    @row-dblclick="onRowDblclick"
    @cell-click="onCellClick"
    @cell-dblclick="onCellDblclick"
    @cell-mouse-enter="onCellMouseEnter"
    @cell-mouse-leave="onCellMouseLeave"
    @header-click="onHeaderClick"
    @header-dragend="onHeaderDragend"
    @sort-change="onSortChange"
    @selection-change="onSelectionChange"
    @cell-value-changed="onCellValueChanged"
    @cell-editing-started="onCellEditingStarted"
    @cell-editing-stopped="onCellEditingStopped"
    @scroll="onScroll"
    @grid-ready="onGridReady"
    @column-visible="onColumnVisible"
    @column-moved="onColumnMoved"
    @context-menu-click="onContextMenuClick"
    @row-drag-start="onRowDragStart"
    @row-drag-end="onRowDragEnd"
    @data-change="onDataChange"
    @row-expand="onRowExpand"
    @row-collapse="onRowCollapse"
    @cell-range-selected="onCellRangeSelected"
    @data-import="onDataImport"
    @search-change="onSearchChange"
    @model-updated="onModelUpdated"
  />
</template>
```

### 加载更多分页

追加式加载使用 `manual` 分页 + `virtual` 模式 + `infiniteScroll`（`mode: 'loadMore'` 不是合法的分页模式，`loadMore` 是请求原因 `TableRequestReason` 的取值）：

:::demo 加载更多分页 table/load-more.vue
:::

### 虚拟滚动分页

:::demo 虚拟滚动分页 table/virtual-pagination.vue
:::

### 导出与打印

:::demo 导出与打印 table/export-print.vue
:::

### 单元格范围选择

:::demo 单元格范围选择 table/range-selection.vue
:::

### Teleport 悬浮操作按钮

:::demo Teleport 悬浮操作按钮 table/teleport-hover.vue
:::

`hoverActions` 决定按钮的呈现方式：行内、悬停覆盖层，或 Teleport 单实例浮层
（`{ teleport: true }` 强制 Teleport，`{ teleport: 'auto' }` 在存在固定列时自动用 Teleport）。

### 列类型预设

:::demo 列类型预设 table/column-types.vue
:::

### 编辑撤销/重做

:::demo 编辑撤销/重做 table/undo-redo.vue
:::

`canUndo` / `canRedo` 是实例上的 `Ref`，模板里直接解包；栈深由 `editConfig.undoMaxStackSize` 控制（默认 50）。

### 只读编辑模式

:::demo 只读编辑模式 table/readonly-editing.vue
:::

### 列状态持久化

:::demo 列状态持久化 table/column-state.vue
:::

默认存储键是 `adv-table-cols-{tableId}`，而未显式配置时 `tableId` 是随机生成的，
所以**要用持久化就必须显式给 `storageKey`**（或固定 `uiConfig.tableId`）。

### 自定义列状态存储适配器

:::demo 自定义列状态存储 table/column-state-storage.vue
:::

### 列操作按钮高级用法

:::demo 列操作按钮 table/option-actions.vue
:::

### 汇总行（AG Grid aggregation-total-rows 对齐）

:::demo 汇总行 table/summary-rows.vue
:::

列级聚合函数（`columns[].aggFunc`，Grand/小计行共用口径，未设置回退 `'sum'`）：

```ts
const columns = [
  { prop: 'dept', label: '部门' },
  // 内置：sum / avg / min / max / count / first / last
  { prop: 'qty', label: '数量', aggFunc: 'sum' },
  { prop: 'price', label: '均价', aggFunc: 'avg' },
  // 自定义归约：(values, rows) => 结果
  { prop: 'total', label: '总额', aggFunc: values => values.reduce((s, v) => s + (Number(v) || 0), 0) },
]
```

### 自定义列渲染器

:::demo 自定义列渲染器 table/custom-renderer.vue
:::

需要返回 VNode 时用列上的 `cellRenderer`（TSX），只改模板就用插槽。

### 手动请求模式

:::demo 手动请求模式 table/manual-request.vue
:::

### 轮询刷新

:::demo 轮询刷新 table/polling.vue
:::

### 自动列宽

:::demo 自动列宽 table/auto-size.vue
:::

`columnConfig.autoSizeColumns` 打开后由渲染器测量内容宽度并等比分配；
列设 `stretch: false` 即不参与。列结构或容器宽度变化都会触发重新测量。

## v2.1.x 新增能力

### 排序上限 `sortConfig.maxSortColumns`

限制多列排序（Shift+点击）的最大列数，超出时按 FIFO 淘汰最早的排序列；设为 `1` 等价于关闭多列排序。默认不限（向后兼容）。

```html
<AdvTable :sort-config="{ maxSortColumns: 3 }" />
```

### 撤销栈深度 `editConfig.undoMaxStackSize`

撤销/重做栈最大深度，默认 `50`，超出后淘汰最旧条目。

```ts
:editConfig="{ undoMaxStackSize: 200 }"
```

### 远程请求自动携带排序/筛选 `request.autoParams`

开启后每次远程请求自动附加 `sort`（序列化为 `[{ prop, order: 'asc' | 'desc' }]`）与 `filter`（列筛选状态原样透出），键名可自定义；默认关闭。更复杂的序列化请在其基础上用 `transformRequest` 改写。

```ts
:request="{
  source,
  autoParams: true, // 或 { sortKey: 'sorts', filterKey: 'filters' }
}"
```

### 快速筛选防抖生效说明

`filterConfig.quickFilterDebounce`（毫秒，默认 300）现已接线生效；在表格创建时读取一次。

### 公共滚动定位 API

```ts
tableRef.value.scrollToRow('row-key-1', { align: 'center' }) // 行键或渲染域索引
tableRef.value.scrollToColumn('price') // 列键或叶子列索引；固定列恒可见直接返回 true
```

- 返回 `boolean`：渲染器未就绪或目标不存在时为 `false`
- `align`: `'auto'`（默认，仅不可见时滚动）/ `'start'` / `'center'` / `'end'`

#### 超大数据行定位阈值与降级矩阵

virtual 模式对「行键 → 渲染域行索引」的解析设有性能阈值 **100,000 行**。超过阈值时不再一次性构建 O(n) 全量索引（避免首屏卡顿），降级为随 `rowsRendered` 事件增量维护的渲染窗口局部索引：

| 数据规模 | 事件 `rowIndex`（cellClick / cellKeyDown / cellFocused 等） | `scrollToRow(key)` | dev 告警 |
|---------|---------|---------|---------|
| ≤ 100,000 行 | 全量可用（渲染数据域索引） | 全量可用 | 无 |
| > 100,000 行 | 渲染窗口（可见 + 预渲染缓存）内的行正常解析，窗口外为 `null` | 渲染窗口内的目标正常定位并返回 `true`，窗口外返回 `false` | 首次超限输出一条降级告警；数据降回阈值内后再次超限会重新告警 |

规避方式：启用分页压缩渲染数据域；或改用行索引定位 `scrollToRow(index)`（不受阈值影响）；目标行进入渲染窗口后即可正常解析。降级告警仅在 dev 环境输出。

### 动态网格行高重测（B7）

virtual 动态网格（`estimatedRowHeight` 生效，或存在 append 插槽/展开详情行）下，EP 只在行挂载时测量一次行高：自定义 cell 经异步回调（`setTimeout`、请求回填）撑高内容、且 `data` 引用未变时，下方行 `style.top` 会残留旧值。内容高度变化后请主动调用重测：

```ts
tableRef.value.refreshVirtualRowHeight() // 默认从 0 行起全量重测（推荐）
tableRef.value.resetAfterRowIndex(10) // 从第 10 行起重测；第二参 forceUpdate 默认为 false
```

- 返回 `boolean`：重测入口不可达（固定网格 / default 模式 / 实例未就绪）时为 `false`，dev 环境同步输出一次性告警
- 固定行高网格无缓存可清，调用直接返回 `false`；default 模式恒返回 `false`
- 高频内容变化请自行防抖（内容加载完成后调用一次即可）：库内不自动监听每行高度变化，逐行 ResizeObserver 为 O(n) 开销，且 EP 行 DOM 会被虚拟滚动回收

### 行固定（rowPinConfig）端到端渲染

此前 `rowPinConfig` 仅存在于数据层，视觉上不会固定；现已在两种模式下真实渲染（顺序：表头/固定顶/表体/固定底/汇总）：

- **default 模式**：固定行以 sticky 行内联样式堆叠钉在视口顶部/底部（Chromium/Firefox 支持 tr 粘性定位，Safari 优雅降级为普通行）
- **virtual 模式**：顶部固定行经 EP 原生 `fixed-data` 渲染于表头内部（各分区自动对齐并跟随横向滚动）；底部固定行渲染于 footer 插槽内、汇总之上（保留手动横向平移同步）。行点击/双击/右键事件照常派发（`rowIndex` 为 `-1` 表示渲染域外）
- 合并单元格与行固定已支持组合：统一索引域已落地，`spanMap` 建在 `unpinned` 域，`ranges` 按 `unpinned` 数据顺序声明；pin 条带与 grand 合计行永不参与合并
- 性能软上限：固定条带不参与虚拟化，顶部 + 底部固定行合计超过 **50** 行（`PINNED_ROWS_SOFT_LIMIT`）时 dev 环境输出告警（每条固定行 × 每列都会立即构建单元格）；仅告警不改渲染，事件转发语义不变

运行时 API 不变：`pinRow / unpinRow / isRowPinned / clearPinnedRows`。

### 自定义筛选类型的面板 UI

通过 `registerFilterType` 注册的筛选类型现在可在筛选面板中注入完整 UI：

```ts
import { registerFilterType } from '@advanced-elements/table'
import MyCascaderPanel from './MyCascaderPanel.vue'

registerFilterType({
  type: 'cascader',
  createDefaultValue: () => ({ type: 'cascader', selected: [] }),
  isActive: v => v.selected.length > 0,
  matches: (cellValue, filterValue) => filterValue.selected.includes(cellValue),
  filterPanelComponent: MyCascaderPanel, // props: { value, columnKey }，emit 'update:value'
})
```

---

## 兼容性

| 依赖 | 支持范围 | 说明 |
|------|---------|------|
| `vue` | `^3.5.0` | 3.5.x 实测 |
| `element-plus` | `^2.14.0` | 小版本升级需回归（仓库内 `EP-UPGRADE-CHECKLIST.md`） |
| `typescript` | `^5.0.0`（类型用 5.9 构建） | 5.9.x 实测 |
| `node` | 开发/构建需 `>=22` | 发布产物运行时无 node 要求 |
| 浏览器 | Chrome/Edge ≥ 94，Firefox ≥ 93，Safari/iOS ≥ 15.4 | ES2022 基线 |
| SSR | 受控支持 | `typeof window/document` 守卫 + 存储探测；多表格页需传 `tableId` 保持 hydration id 稳定 |

大版本变更与迁移说明见 [CHANGELOG](https://github.com/ChuHingYee/advanced-elements/blob/main/packages/table/CHANGELOG.md)。

---

## FAQ（常见误用）

- **默认渲染模式是 `virtual`**（走 ElTableV2），经典 ElTable 行为用 `mode="default"`。
- **全选口径跟模式走**：`default` = 当前页，`virtual` = 全部过滤行；与模式无关的当页全选用 `selectAllOnCurrentPage`。多选/树/展开务必设 `rowConfig.rowKey`，否则数据刷新后选中与展开会静默失效。服务端分页下 virtual 的"全部过滤行"仍只是当前页；跨页选中需要 `keepSelectionAcrossPages` + 受控 `selectedRowKeys`，`getSelectedRows()` / `selectionChange.rows` 只有当页行，全量行用 `meta.keys` 解析。
- **树形 + 服务端分页不支持**（`TABLE_TREE_REMOTE_PAGINATION_UNSUPPORTED`）：树需要全量数据，用 `pagination.mode="client"` 或 `pagination.enabled=false`。树与行分组互斥（同时开则分组被忽略）。
- **服务端数据源 + `autoParams` 关闭 = 页内排序/筛选**：列排序只排当前页（不重拉、不重置页码）；列筛选 / `quickFilter` / `externalFilter` 只过滤当前页（dev 会告警）。服务端行为需声明 `{ type: 'server' }` / `'custom'` 可排序列并打开 `request.autoParams`。
- **编辑 + 远程数据源**：排序/筛选/翻页会整体替换 `data` 并丢弃未提交的编辑，先调 `saveCells()` / `discard()`。
- **`size` / `tableLayout` 只影响 `default` 模式**，`estimatedRowHeight` 只影响 `virtual` 模式（误用 dev 有提示）；`pagination.infiniteScroll` 只在 `virtual` 模式生效。
- **动态列 slot 名需要显式行类型**（`AdvTable<Row>`）；默认 `Record<string, unknown>` 下 slot 名拼写错误无法被类型检查（"slot 名 = 列 prop"的固有代价）。
- **`mode` 运行时不可切换**：切换会丢编辑/滚动/shift 连选状态，用 `v-if` 重建代替。
- **列宽溢出两模式行为不同（设计如此）**：`virtual` 显式溢出检测强制固定宽度以保证表头/体/汇总像素对齐；`default` 交给 ElTable 原生横向滚动。不要期待两者视觉一致。
- **`#append` 两模式挂载方式不同（设计如此）**：`default` 是 ElTable 原生 slot；`virtual` 无此 slot，内容合成为尾部数据行。
- **单元格格式化用 `format` 不是 `formatter`**：列上的 `formatter` 会被静默忽略（配 `valueGetter` 取值、`valueEnum` / `valueType` 做展示）。
- **运行时改列必须走 `setColumns`**：内部列是 `shallowRef`，原地改对象不触发重渲染；增删改列传新数组（或 `v-model:columns` 换引用）。拖拽/调宽内部已代劳。
- **筛选状态默认非受控**：用 `setFilter` / `resetColumnFilter` / `resetAllFilters` / `getFilterValue` / `isColumnFiltered` 操作并监听 `@filter-change`；受控用 `:filter-model`（key 为规范列 key），与 `setFilter` 混用以后写为准。
- **自定义 EP namespace 必须四方配对**：EP 运行时 `namespace`、本库运行时 `uiConfig.namespace`（缺省自动跟随 EP）、本库 CSS 构建期 `$ep-namespace`、EP 自身 CSS 构建期 `$namespace`——任一错配报 `TABLE_NAMESPACE_MISMATCH`。运行时切换 prefix 不支持（CSS 构建期 baked）。

---

## 安全说明

- **xlsx（可选）已知 CVE**：xlsx 0.18.x 有原型污染 / ReDoS 公告（含 CVE-2023-30533、CVE-2024-22363）。启用 Excel 导入/导出前二选一：
  - 从 SheetJS CDN 安装补丁版（≥ 0.19.3，npm 末版停在 0.18.5）：`pnpm add https://cdn.sheetjs.com/xlsx-latest.tgz`；
  - 或沿用 npm 0.18.5 但只处理可信输入；导入管线内置原型污染 guard（`sanitizeDataArray`），导出路径跑公式注入清洗。
- **优先 npm 安装而非 CDN dist**：CDN 绕过 peer 解析与 lockfile 审计。
- **数据出口统一过滤**：所有数据出口（导出/打印/剪贴板）经过 `utils/security.ts` 过滤；详见[安全指南](/guide/table/security-guide)。

