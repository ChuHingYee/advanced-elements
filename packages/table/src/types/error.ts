/**
 * <zh/> 结构化错误对象，覆盖以下异常类别：
 * 接口请求失败 / 表格模板渲染报错 / 弹窗表单校验异常 / 持久化存储失败 / 导入导出失败 / 拖拽失败 / 模式切换通知。
 *
 * <zh/> 必须以结构化对象派发独立 emits，禁止纯字符串 console.warn/error。
 * 所有错误码、严重级别与默认建议文案在 {@link TABLE_ERROR_CODES} 中集中维护，单一真相源。
 *
 * <en/> Structured error object covering:
 * request failure / render error / form validation / persistence failure / import-export failure / drag failure / mode-switch notice.
 *
 * <en/> Must be dispatched as structured objects via the dedicated emit; raw console.warn/error strings are forbidden.
 * All error codes, severities, and default suggestions are centralized in {@link TABLE_ERROR_CODES} as a single source of truth.
 *
 * @example
 * ```ts
 * // 在 composable 中调用统一 handler
 * handleError('TABLE_REQUEST_FAILED', { cause: err })
 *
 * // 等价于
 * emit('error', {
 *   code: 'TABLE_REQUEST_FAILED',
 *   severity: 'error',
 *   cause: err,
 *   suggestion: '检查 request.source 或网络'
 * })
 * ```
 */

/**
 * <zh/> 表格错误严重级别
 * <zh/> - `info`:  纯通知性（如 mode 切换），不进入 `error` 事件流，仅 dev 日志
 * <zh/> - `warn`:  可恢复的异常（如持久化失败、span 超限），进入 `error` 事件流 + dev console.warn
 * <zh/> - `error`: 不可恢复的异常（如渲染崩溃、请求失败、导入导出失败），进入 `error` 事件流 + dev console.error
 *
 * <en/> Table error severity
 * <en/> - `info`:  informational only (e.g. mode switch); does NOT flow through `error` event, dev-log only
 * <en/> - `warn`:  recoverable (e.g. persistence failure, span limit); flows through `error` event + dev console.warn
 * <en/> - `error`: unrecoverable (e.g. render crash, request failure, import/export failure); flows through `error` event + dev console.error
 */
export type TableErrorSeverity = 'info' | 'warn' | 'error'

/**
 * <zh/> 错误码元数据 — 单一真相源
 * <zh/> 新增/调整错误码时仅需修改此对象，消费方与生产方均自动同步。
 * <zh/> 严禁在源码中硬编码 `code: 'TABLE_XXX'` 字符串字面量。
 *
 * <en/> Error-code metadata — single source of truth.
 * <en/> To add or adjust an error code, modify only this object; both producers and consumers sync automatically.
 * <en/> Hard-coded `code: 'TABLE_XXX'` string literals are forbidden in source.
 */
export const TABLE_ERROR_CODES = {
  /** <zh/> 排序 Worker 不可用，已回退主线程排序 | <en/> Sort worker unavailable, fell back to main thread */
  TABLE_SORT_WORKER_FAILED: {
    severity: 'warn' as const,
    message: '排序 Worker 不可用，已回退主线程排序',
    suggestion: '检查 CSP 配置或 Worker 脚本路径。',
  },
  /** <zh/> 单元格合并计算超限 | <en/> Cell-span computation exceeded limit */
  TABLE_SPAN_LIMIT_EXCEEDED: {
    severity: 'warn' as const,
    message: '单元格合并计算因数据规模超限已跳过',
    suggestion: '减小数据量或改用更轻量的合并配置。',
  },
  /** <zh/> 固定行数量超限，已截断多余行（超出部分回到滚动区） | <en/> Pinned-row count exceeded the limit; extras truncated back to the scroll area */
  TABLE_PIN_LIMIT_EXCEEDED: {
    severity: 'warn' as const,
    message: '固定行数量超限，超出部分已移回滚动区',
    suggestion: '减少 pin 的行数，或通过 rowPinConfig.maxPinnedRows 调整上限（固定行条带不参与虚拟化，过多会显著增加内存与首帧开销）。',
  },
  /** <zh/> 行展开持久化存储失败 | <en/> Row-expand persistence storage failure */
  TABLE_ROW_EXPAND_STORAGE_FAILED: {
    severity: 'warn' as const,
    message: '行展开持久化存储失败',
    suggestion: '可能是 storage 已满、被禁用或 JSON 解析失败。展开状态本次会话内有效，刷新后将丢失。',
  },
  /** <zh/> 列状态持久化存储失败 | <en/> Column-state persistence storage failure */
  TABLE_COLUMN_STATE_STORAGE_FAILED: {
    severity: 'warn' as const,
    message: '列状态持久化存储失败',
    suggestion: '检查 storage 配额或禁用列状态持久化。',
  },
  /** <zh/> 同页重复 tableId（列持久化互踩 + 拖拽容器定位错误） | <en/> Duplicate tableId on the same page (persistence collision + drag-container mislookup) */
  TABLE_DUPLICATE_TABLE_ID: {
    severity: 'warn' as const,
    message: '检测到重复的 tableId',
    suggestion: '同页多表请使用不同的 ui-config.tableId，否则列持久化互踩且拖拽容器可能定位到错误的表。确需共用时请经列状态 storageKey 显式隔离。',
  },
  /** <zh/> 命名空间失配：显式 uiConfig.namespace 与 Element Plus ConfigProvider 命名空间不一致 | <en/> Namespace mismatch: explicit uiConfig.namespace disagrees with the Element Plus ConfigProvider namespace */
  TABLE_NAMESPACE_MISMATCH: {
    severity: 'warn' as const,
    message: '命名空间配置与 Element Plus 命名空间不一致',
    suggestion: 'uiConfig.namespace 显式值与 Element Plus ConfigProvider 的 namespace 不一致：DOM 查询按前者构造，EP 实际渲染按后者，拖拽/滚动/hover 定位将静默失效。请移除 uiConfig.namespace（自动跟随 EP）或将其改为与 EP 一致；自定义前缀还需同步重建 CSS（SASS $namespace 配对，见 README 命名空间章节）。',
  },
  /** <zh/> mode 运行时切换通知（非错误，info 级别） | <en/> Runtime mode-switch notice (not an error, info level) */
  TABLE_MODE_SWITCHED: {
    severity: 'info' as const,
    message: 'Mode 运行时切换',
    suggestion: '编辑状态、滚动位置与 shift-select 上下文已被重置。建议用 v-if 重建组件以获得干净的状态迁移。',
  },
  /** <zh/> mode 运行时切换被 'error' 策略禁止（状态清理已执行，切换仍已完成） | <en/> Runtime mode switch forbidden by the 'error' strategy (cleanup ran, switch still applied) */
  TABLE_MODE_SWITCH_FORBIDDEN: {
    severity: 'error' as const,
    message: 'Mode 运行时切换被禁止',
    suggestion: '状态清理已执行（编辑 / shift-select / 菜单 / 范围选择已复位），但 mode 已完成切换，抛错无法阻止。请用 v-if 重建组件，或改用 modeSwitchBehavior=\'warn\'。',
  },
  /** <zh/> virtual 模式忽略 default slot | <en/> Default slot ignored in virtual mode */
  TABLE_VIRTUAL_SLOT_IGNORED: {
    severity: 'warn' as const,
    message: 'Virtual 模式忽略 default slot',
    suggestion: '声明式 <el-table-column> 仅 default 模式支持；virtual 下请改用 columns prop，或切 mode="default"。',
  },
  /** <zh/> 虚拟模式「合并单元格 × 动态行高」视觉不受支持 | <en/> Virtual mode "cell span × dynamic row height" is visually unsupported */
  TABLE_SPAN_DYNAMIC_HEIGHT_UNSUPPORTED: {
    severity: 'warn' as const,
    message: '虚拟模式下合并单元格与动态行高不可同时使用',
    suggestion: '移除 estimatedRowHeight（或改为固定 rowHeight），或改用 span 配置之外的合并方案；动态网格会裁切跨行合并的 origin 格。',
  },
  /**
   * <zh/> 虚拟行高重测入口不可用（EP 内部结构漂移） | <en/> Virtual row-height remeasure entry unavailable (EP internal-structure drift)
   *
   * <zh/> 本库重测行高需探测 ElTableV2 的 `resetAfterRowIndex`（EP 未公开，属内部结构依赖）。
   * <zh/> EP 一旦改名/改层级，探测失败；此前该失败**仅** dev 期 `console.warn`，生产环境完全静默——
   * <zh/> 使用者只会看到「行高错乱」而无任何线索。此码把该失效升级为生产可观测事件。
   * <zh/> `cause.reason` 区分三种不可用：固定行高网格（正常，非缺陷）/ 实例缺失（正常，时序问题）/
   * <zh/> 无原生入口（**真正的 EP 漂移**，需升级排查）。
   * <en/> This library remeasures virtual row heights by probing ElTableV2's `resetAfterRowIndex`
   * <en/> (unpublished by EP, i.e. an internal-structure dependency). If EP renames it or changes the
   * <en/> hierarchy the probe fails; that failure was previously a **dev-only** `console.warn`, so
   * <en/> production was completely silent — users only saw "row heights are wrong" with no clue. This
   * <en/> code promotes the failure to a production-observable event. `cause.reason` separates the three
   * <en/> cases: fixed-height grid (benign) / missing instance (benign timing) / no native entry
   * <en/> (**genuine EP drift**, needs an upgrade investigation).
   */
  TABLE_ROW_HEIGHT_RESET_UNAVAILABLE: {
    severity: 'warn' as const,
    message: '虚拟行高重测入口不可用，行高可能不更新',
    suggestion: '本库依赖 Element Plus 内部未公开的 resetAfterRowIndex 来重测虚拟行高。若刚升级过 element-plus，请对照 EP-UPGRADE-CHECKLIST.md 核对版本；在修复前可改用固定 rowHeight（放弃动态行高）规避。',
  },
  /** <zh/> virtual 模式树形/展开缺少显式 rowKey | <en/> Virtual-mode tree/expand without an explicit rowKey */
  TABLE_VIRTUAL_HIERARCHY_ROW_KEY_MISSING: {
    severity: 'warn' as const,
    message: 'Virtual 模式下启用树形/行展开但未提供 rowKey',
    suggestion: '请通过 rowConfig.rowKey 指定行唯一标识字段（如 "id"）。缺省时回退到对象身份自动 key：行对象被替换（刷新/深拷贝）后展开状态与父子关系将丢失，冻结行对象上 ElTableV2 无法缓存自动 key，树形渲染可能错乱。',
  },
  /** <zh/> 渲染层异常 | <en/> Renderer-level exception */
  TABLE_RENDER_ERROR: {
    severity: 'error' as const,
    message: '表格渲染异常',
    suggestion: '检查 column cellRenderer / formatter 抛错，或回退至 default 模式。',
  },
  /** <zh/> 单元格/跨字段校验失败 | <en/> Cell / cross-field validation failure */
  TABLE_EDIT_VALIDATION_FAILED: {
    severity: 'warn' as const,
    message: '编辑校验失败',
    suggestion: '检查 editConfig.rules 或 crossFieldValidator 配置。',
  },
  /**
   * <zh/> 编辑落库失败已回滚——saveCells 悲观协议在持久化钩子失败时
   * <zh/> 自动还原快照并派发此事件；数据已回到提交前状态，撤销栈不受影响。
   * <en/> Edit persistence failed and was rolled back — saveCells' pessimistic protocol
   * <en/> auto-restores the snapshot and dispatches this event when the persist hook fails;
   * <en/> data is back to its pre-commit state and the undo stack is untouched.
   */
  TABLE_EDIT_ROLLBACK: {
    severity: 'error' as const,
    message: '编辑保存失败，已回滚变更',
    suggestion: '检查 editConfig.onPersist 实现与网络/后端服务；回滚后数据与提交前一致，可安全重试。',
  },
  /** <zh/> 接口请求失败 | <en/> Request failed */
  TABLE_REQUEST_FAILED: {
    severity: 'error' as const,
    message: '数据请求失败',
    suggestion: '检查 request.source、网络或后端服务。',
  },
  /** <zh/> 导出失败 | <en/> Export failed */
  TABLE_EXPORT_FAILED: {
    severity: 'error' as const,
    message: '数据导出失败',
    suggestion: '检查导出权限、文件写入或磁盘空间。',
  },
  /** <zh/> 导入失败 | <en/> Import failed */
  TABLE_IMPORT_FAILED: {
    severity: 'error' as const,
    message: '数据导入失败',
    suggestion: '检查文件格式、大小或字段映射。',
  },
  /** <zh/> 打印失败 | <en/> Print failed */
  TABLE_PRINT_FAILED: {
    severity: 'error' as const,
    message: '打印失败',
    suggestion: '检查浏览器打印权限或 iframe 生命周期。',
  },
  /** <zh/> 行拖拽失败 | <en/> Row drag failed */
  TABLE_ROW_DRAG_FAILED: {
    severity: 'warn' as const,
    message: '行拖拽操作失败',
    suggestion: '检查 reorderKey 配置或目标行索引合法性。',
  },
  /** <zh/> 列拖拽失败 | <en/> Column drag failed */
  TABLE_COLUMN_DRAG_FAILED: {
    severity: 'warn' as const,
    message: '列拖拽操作失败',
    suggestion: '检查列 draggable 配置或目标列索引合法性。',
  },
  /** <zh/> 树形数据加载失败 | <en/> Tree data load failed */
  TABLE_TREE_LOAD_CHILDREN_FAILED: {
    severity: 'warn' as const,
    message: '树形子节点加载失败',
    suggestion: '检查 treeConfig loadChildren 实现或后端服务。',
  },
  /** <zh/> 范围选择/剪贴板操作失败 | <en/> Range selection / clipboard operation failed */
  TABLE_CLIPBOARD_FAILED: {
    severity: 'warn' as const,
    message: '剪贴板或范围选择操作失败',
    suggestion: '检查浏览器剪贴板权限或跨页选择数据完整性。',
  },
  /** <zh/> 剪贴板写入失败（复制/剪切的复制阶段） | <en/> Clipboard write failed (copy phase of copy/cut) */
  TABLE_CLIPBOARD_COPY_FAILED: {
    severity: 'warn' as const,
    message: '剪贴板写入失败',
    suggestion: '检查浏览器剪贴板权限，或确认当前上下文为安全源（https/localhost）。',
  },
  /** <zh/> 剪切提交失败（复制成功但清空阶段被拒） | <en/> Cut commit failed (copy succeeded, clearing rejected) */
  TABLE_CLIPBOARD_CUT_FAILED: {
    severity: 'warn' as const,
    message: '剪切操作提交失败',
    suggestion: '检查编辑管线的拦截器或校验规则是否拒绝了空值写入。',
  },
  /** <zh/> 剪贴板读取被拒绝（粘贴阶段） | <en/> Clipboard read denied (paste phase) */
  TABLE_CLIPBOARD_READ_FAILED: {
    severity: 'warn' as const,
    message: '剪贴板读取被浏览器拒绝',
    suggestion: '检查 Clipboard API 授权，或确认当前上下文为安全源（https/localhost）。',
  },
  /** <zh/> 粘贴提交失败（编辑管线拒绝） | <en/> Paste commit failed (rejected by the edit pipeline) */
  TABLE_CLIPBOARD_PASTE_FAILED: {
    severity: 'warn' as const,
    message: '粘贴操作提交失败',
    suggestion: '检查编辑管线的拦截器或校验规则，以及目标列是否可编辑。',
  },
  /** <zh/> 右键菜单内置操作失败 | <en/> Context-menu built-in action failed */
  TABLE_CONTEXT_ACTION_FAILED: {
    severity: 'warn' as const,
    message: '右键菜单内置操作执行失败',
    suggestion: '检查右键菜单操作的目标数据或权限。',
  },
  /** <zh/> 配置冲突：同时提供 data 与 request.source | <en/> Config conflict: both data and request.source provided */
  TABLE_CONFIG_DATA_AND_SOURCE_CONFLICT: {
    severity: 'info' as const,
    message: '同时提供 "data" 与 "request.source" prop',
    suggestion: '"request.source" 优先级更高，"data" prop 将被忽略。请移除其一以避免混淆。',
  },
  /** <zh/> 非受控 data 遇编辑写回：编辑结果对父级不可见且会被父级推送覆盖 | <en/> Uncontrolled data meets edit write-back: the edit is invisible to the parent and is overwritten by a later parent push */
  TABLE_UNCONTROLLED_EDIT_SHADOW: {
    severity: 'warn' as const,
    message: '单向 "data" 绑定下启用了单元格编辑',
    suggestion: '编辑写回只更新内部模型，父组件数据源不会同步，父组件后续推送 ":data" 会静默覆盖该次编辑。请改用 "v-model:data" 或监听 "update:data" 回写。',
  },
  /** <zh/> 非受控 columns 遇列交互写回：列拖拽/列设置改动对父级不可见且会被父级推送覆盖 | <en/> Uncontrolled columns meets column-interaction write-back: drag/setting changes are invisible to the parent and are overwritten by a later parent push */
  TABLE_UNCONTROLLED_COLUMNS_SHADOW: {
    severity: 'warn' as const,
    message: '单向 "columns" 绑定下列可交互（列拖拽/列设置）',
    suggestion: '列交互写回只更新内部模型，父组件列配置不会同步，父组件后续推送 ":columns" 会静默覆盖该次改动。请改用 "v-model:columns" 或监听 "update:columns" 回写。',
  },
  /** <zh/> 性能提示：大数据量未启用虚拟滚动 | <en/> Performance hint: large dataset without virtual scroll */
  TABLE_PERF_LARGE_DATASET_NO_VIRTUAL: {
    severity: 'info' as const,
    message: '大数据量未启用虚拟滚动',
    suggestion: '设置 `mode="virtual"` 或 `virtual` prop 为 true 以获得更好的渲染性能。',
  },
  /** <zh/> 原型污染防御：检测到 __proto__ 或 constructor 属性 | <en/> Prototype pollution defense: detected __proto__ or constructor property */
  TABLE_SECURITY_PROTOTYPE_POLLUTION: {
    severity: 'warn' as const,
    message: '检测到潜在的原型污染攻击',
    suggestion: '检查数据源是否包含 __proto__/constructor 属性，已在深层冻结前自动清除。',
  },
  /** <zh/> 敏感列数据泄露防御 | <en/> Sensitive column data leakage defense */
  TABLE_SECURITY_SENSITIVE_COLUMN: {
    severity: 'warn' as const,
    message: '检测到敏感列被导出',
    suggestion: '已标记 sensitive: true 的列在导出时自动排除，检查 column.sensitive 配置。',
  },
  /** <zh/> 配置冲突：树形与分组同开（显式双开即 opt-in，生产可见） | <en/> Config conflict: tree + grouping together (explicit dual-enable is opt-in, production-visible) */
  TABLE_CONFIG_CONFLICT: {
    severity: 'warn' as const,
    message: '同时启用了 treeConfig 与 rowGroupConfig',
    suggestion: '两者互斥：运行时已忽略 rowGroupConfig（按拍平树取分组会破坏层级）。请移除其一。',
  },
  /** <zh/> 响应畸形：后端字段与 formatMaps 对不上（显式错配即上报，生产可见） | <en/> Malformed response: backend fields do not match formatMaps (production-visible) */
  TABLE_RESPONSE_MALFORMED: {
    severity: 'warn' as const,
    message: '后端响应字段与 formatMaps 对不上，已按空表处理',
    suggestion: '检查 request.formatMaps / 后端字段名（data/total），或用 transformResponse 适配。',
  },
  /** <zh/> 配置冲突：树形 + 服务端分页同开——服务端按页切片后展平会使父子分属不同页 | <en/> Config conflict: tree + server-side pagination together — paginating before tree-flattening splits parents from children across pages */
  TABLE_TREE_REMOTE_PAGINATION_UNSUPPORTED: {
    severity: 'warn' as const,
    message: '树形与服务端分页不可同时使用，父子行可能分属不同页',
    suggestion: '树形请改用客户端分页（pagination.mode="client"）或一次性取全量数据（pagination.enabled=false）；服务端分页下树形展平基于当页数据，父子关系会被破坏。',
  },
  /** <zh/> 配置语义：服务端 + 本地筛选页内语义——autoParams 关闭时筛选只过滤当前页 | <en/> Config semantics: server + local-filter page-only semantics — filters apply to the current page only with autoParams off */
  TABLE_SERVER_LOCAL_FILTER_PAGE_ONLY: {
    severity: 'warn' as const,
    message: '服务端数据源下本地筛选仅过滤当前页',
    suggestion: '列筛选/quickFilter/externalFilter 已生效，但 request.source + request.autoParams 关闭：当前仅过滤本页数据，而非全量筛选，服务端收不到筛选参数。如需服务端筛选请开启 request.autoParams；确认页内语义即为预期可忽略。',
  },
} as const

/**
 * <zh/> 全部错误码字面量联合类型 — 由 {@link TABLE_ERROR_CODES} 自动推导，禁止手工维护
 * <en/> Literal union of all error codes — derived from {@link TABLE_ERROR_CODES}, do not maintain by hand
 */
export type TableErrorCode = keyof typeof TABLE_ERROR_CODES

/**
 * <zh/> 结构化错误对象
 * <en/> Structured error object
 */
export interface TableError {
  /**
   * <zh/> 结构化错误码，受 {@link TableErrorCode} 约束，便于消费方按类型做降级处理
   * <en/> Structured error code, constrained by {@link TableErrorCode}, for consumer-side branching
   */
  code: TableErrorCode
  /**
   * <zh/> 错误严重级别 — 由 {@link TABLE_ERROR_CODES} 推导，消费方可据此决定 toast/notification/沉默
   * <en/> Error severity — derived from {@link TABLE_ERROR_CODES}; consumers use this to decide toast/notification/silence
   */
  severity: TableErrorSeverity
  /** <zh/> 关联字段（如校验失败的列 prop、出错的请求阶段） | <en/> Related field (e.g. validated column prop, failed request phase) */
  field?: string
  /** <zh/> 面向开发者的修复建议 — 若未提供，使用 {@link TABLE_ERROR_CODES} 中的默认值 | <en/> Developer-facing fix suggestion; defaults to {@link TABLE_ERROR_CODES} if omitted */
  suggestion?: string
  /** <zh/> 原始错误对象，便于排查 | <en/> Original error object for diagnosis */
  cause?: unknown
}

/**
 * <zh/> 列配置结构化警告对象。
 * <zh/> 与 {@link TableError} 同源设计，用于运行时列配置校验（缺失 key / 重复 key 等），
 * <zh/> 以结构化对象输出，便于消费方按 `code` 做降级或提示，禁止纯字符串 console.warn。
 *
 * <en/> Column-config structured warning object.
 * <en/> Same design lineage as {@link TableError}, used for runtime column-config validation
 * <en/> (missing key / duplicate key, etc.), output as structured objects so consumers can
 * <en/> branch by `code`; raw console.warn strings are forbidden.
 *
 * @example
 * ```ts
 * const warnings = validateColumns(rawColumns)
 * if (warnings.length) console.warn('[AdvTable] 列配置警告', warnings)
 * ```
 */
export interface TableColumnWarning {
  /** <zh/> 结构化警告码，格式 TABLE_COLUMN_XXX | <en/> Structured warning code, format TABLE_COLUMN_XXX */
  code: `TABLE_COLUMN_${string}`
  /** <zh/> 关联列标识（列 key、label 或索引路径），用于定位问题 | <en/> Related column identifier (key/label/index path) */
  field?: string
  /** <zh/> 面向开发者的修复建议 | <en/> Developer-facing fix suggestion */
  suggestion?: string
}
