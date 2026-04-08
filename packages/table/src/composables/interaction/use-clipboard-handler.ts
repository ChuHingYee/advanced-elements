import type { AdvTableEmitFn, ProcessedColumn } from '../../types'
import type { ClipboardEditApi, ClipboardPipelineApi, ClipboardSelectionApi } from '../../types/clipboard-api'
import type { TableErrorCode } from '../../types/error'
import { useDebounceFn } from '@vueuse/core'
import { onBeforeUnmount, onDeactivated } from 'vue'
import { flattenLeafColumns } from '../../utils/column-tree'
import { copyCellToClipboard, copyRowsToClipboard, sliceTsvColumns } from '../../utils/context-menu-clipboard'
import { copyToClipboard as writeRawTsvToClipboard } from '../../utils/copy'
import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'
import { createTableErrorHandler } from '../../utils/error-handler'
import { stripSensitiveColumns } from '../../utils/security'
import { isSyntheticRow } from '../../utils/synthetic-row'

/**
 * <zh/> 带有 cancel 方法的防抖函数类型
 * <en/> Debounced function type with cancel method
 */
interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): ReturnType<T>
  cancel?: () => void
}

/**
 * <zh/> 范围选区出站所需的最小结构化视图
 * <en/> Minimal structured view of a range selection required for the copy exit
 *
 * <zh/> 结构上兼容 `CellRangeSelection`——仅需列配置（敏感过滤）与已解析文本（按位置切片）。
 * <en/> Structurally compatible with `CellRangeSelection` — only column configs (sensitive filtering)
 * <en/> and the resolved text (positional slicing) are needed.
 */
export interface ClipboardRangeSelection {
  /** <zh/> 选区内的列配置（按渲染顺序） | <en/> Column configs within the selection (in render order) */
  columns: ProcessedColumn[]
  /** <zh/> 选区已解析的 TSV 文本 | <en/> Resolved TSV text of the selection */
  tsv: string
  /** <zh/> 选区内的行数据（与 TSV 行序一致）——剪切面 = 复制面所需 | <en/> Row data within the selection (aligned with TSV rows) — required for "cut surface = copy surface" */
  rows?: any[]
}

/**
 * <zh/> TSV 行分隔正则——模块级静态编译，避免每次粘贴调用重复创建
 * <en/> TSV line-split regex — hoisted to module scope to avoid per-call recompilation
 */
const TSV_LINE_SPLIT_RE = /\r?\n/

export interface UseClipboardHandlerOptions<T> {
  /** <zh/> 选择域 API | <en/> Selection API */
  selection: ClipboardSelectionApi<T>
  /** <zh/> 编辑域 API | <en/> Edit API */
  edit: ClipboardEditApi
  /** <zh/> 管线域 API | <en/> Pipeline API */
  pipeline: ClipboardPipelineApi<T>
  /**
   * <zh/> 范围选区结构化数据提供者。
   *
   * <zh/> 提供 `columns` 后，复制出口可对 `sensitive` 列执行统一过滤
   * <zh/> （`security.ts` 的 `stripSensitiveColumns`），使范围复制与行复制/单格复制/导出
   * <zh/> 共用同一敏感列咽喉。`tsv` 为该选区已解析的文本，过滤时按列位置切片复用，
   * <zh/> 不重新解析单元格（避免 format 回调二次执行与 `columnIndex` 语义漂移）。
   *
   * <en/> Structured range-selection provider.
   *
   * <en/> Supplying `columns` lets the copy exit apply the unified `sensitive`-column filter
   * <en/> (`stripSensitiveColumns` in `security.ts`), so range copy shares the same choke point as
   * <en/> row copy / single-cell copy / export. `tsv` is the already-resolved text for the range;
   * <en/> filtering slices it by column position instead of re-resolving cells (avoiding a second
   * <en/> format-callback pass and `columnIndex` semantic drift).
   */
  rangeLastSelection?: () => ClipboardRangeSelection | null
  /**
   * <zh/> 错误派发函数——剪贴板读/写、编辑管线提交失败时通过此函数派发结构化错误
   * <en/> Error emit function — used to dispatch structured errors when clipboard read/write or edit pipeline commits fail
   */
  emit?: AdvTableEmitFn
}

export interface UseClipboardHandlerReturn {
  /** <zh/> Ctrl+C — 复制选中行或当前单元格到剪贴板（100ms 防抖） | <en/> Ctrl+C — copy selected rows or current cell to clipboard (100ms debounce) */
  handleClipboardCopy: (params: any) => void
  /** <zh/> Ctrl+X — 剪切（复制 + 通过编辑管线清空选中单元格值） | <en/> Ctrl+X — cut (copy + clear selected cell values via edit pipeline) */
  handleClipboardCut: (params: any) => Promise<void>
  /** <zh/> Ctrl+V — 粘贴 TSV 数据到表格（通过编辑管线） | <en/> Ctrl+V — paste TSV data to table (via edit pipeline) */
  handleClipboardPaste: (params: any) => Promise<void>
  /** <zh/> 取消待执行的复制防抖（供延迟加载的壳在卸载/失活时转发） | <en/> Cancel pending copy debounce (forwarded by deferred shells on unmount/deactivate) */
  cancelPendingCopy: () => void
}

/**
 * <zh/> 剪贴板处理组合式函数
 * <en/> Clipboard handler composable
 *
 * @remarks
 * <zh/> 从 useTableRendererEvents 中提取的剪贴板复制/剪切/粘贴逻辑。
 * 依赖 selection（获取选中行）和 edit（通过编辑管线写入值）两个域，
 * 通过编辑管线操作确保校验、dirty 追踪和拦截器正常触发
 * <en/> Clipboard copy/cut/paste logic extracted from useTableRendererEvents.
 * Depends on selection (get selected rows) and edit (write values via edit pipeline) APIs,
 * uses edit pipeline to ensure validation, dirty tracking and interceptor are properly triggered
 *
 * @param options - <zh/> 剪贴板处理配置 | <en/> clipboard handler options
 * @returns <zh/> 剪贴板操作方法 | <en/> clipboard handler methods
 */
export function useClipboardHandler<T>(options: UseClipboardHandlerOptions<T>): UseClipboardHandlerReturn {
  const { selection, edit, pipeline, emit, rangeLastSelection } = options

  /**
   * <zh/> 派发结构化错误，仅在 emit 函数存在时调用
   *
   * <zh/> 错误码受 {@link TableErrorCode} 约束并必须已在 `TABLE_ERROR_CODES` 注册：
   * <zh/> severity / 默认 suggestion / i18n 文案统一由注册表与 locale 提供，
   * <zh/> 调用方只传 code 与 cause（严禁在此硬编码错误码字符串或中文建议文案）。
   *
   * <en/> Dispatch structured error, only called when emit function is provided
   *
   * <en/> The code is constrained by {@link TableErrorCode} and MUST be registered in
   * <en/> `TABLE_ERROR_CODES`: severity, default suggestion and i18n text all come from the
   * <en/> registry and locale — callers pass only code and cause (never hard-code error-code
   * <en/> strings or localized suggestions here).
   */
  const handleError = emit ? createTableErrorHandler(emit) : null
  function emitError(code: TableErrorCode, cause: unknown): void {
    handleError?.(code, { cause })
  }

  /**
   * <zh/> 底层复制逻辑（非防抖）——供 handleClipboardCopy（防抖）和 handleClipboardCut（直接）复用。
   * <zh/> 剪切操作不能走防抖路径，否则连续 Ctrl+X 时防抖取消会导致复制未执行但清空已执行。
   * <zh/> 返回值契约：透传底层 Promise<boolean>——false 表示剪贴板写入失败
   * <zh/> （copyToClipboard 吞错不抛，调用方必须检查布尔值，catch 分支对传输失败不可达）。
   * <en/> Low-level copy logic (non-debounced) — shared by handleClipboardCopy (debounced) and handleClipboardCut (direct).
   * <en/> Cut operations cannot use the debounce path, otherwise consecutive Ctrl+X would cause debounce cancellation resulting in copy not executed but clear already executed.
   * <en/> Return contract: forwards the underlying Promise<boolean> — false means clipboard write failed
   * <en/> (copyToClipboard swallows errors instead of throwing; callers MUST check the boolean since catch branches are unreachable for transport failures).
   */
  /**
   * <zh/> 范围选区复制——统一过敏感列咽喉后再出站。
   *
   * <zh/> 该分支必须经 `stripSensitiveColumns` 后再 `writeRawTsvToClipboard`，与行复制
   * <zh/> 与单格复制共用同一过滤咽喉——否则 `sensitive: true` 的列可通过 Shift+方向键/拖框
   * <zh/> 选区复制外泄，直接违反 CONTRIBUTING.md 与 `security.ts` 声明的安全硬契约。
   *
   * <zh/> 过滤策略：按列位置切片已解析的 TSV，而非重新解析单元格——
   * <zh/> 既保证 format 回调不二次执行，又保持 `columnIndex` 语义不变。
   *
   * <en/> Range-selection copy — routed through the sensitive-column choke point before exiting.
   *
   * <en/> This branch must pass `stripSensitiveColumns` before `writeRawTsvToClipboard`,
   * <en/> sharing the same filter choke point as row copy and single-cell copy — otherwise
   * <en/> `sensitive: true` columns leak via Shift+Arrow / drag range selection, a direct
   * <en/> violation of the security contract declared in CONTRIBUTING.md and `security.ts`.
   *
   * <en/> Filtering strategy: slice the already-resolved TSV by column position rather than
   * <en/> re-resolving cells — format callbacks do not run twice and `columnIndex` semantics hold.
   *
   * @returns <zh/> true 表示无可复制内容或写入成功 | <en/> true when there is nothing to copy or the write succeeded
   */
  async function copyRangeSelection(): Promise<boolean | null> {
    const rangeSelection = rangeLastSelection?.()
    if (!rangeSelection)
      return null
    /**
     * <zh/> 空选区不短路——返回 null 让控制权交回"选中行复制 / 单格复制"回退链。
     * <zh/> 保持既有语义：选区存在但内容为空时，Ctrl+C 仍复制选中行。
     * <en/> An empty selection does not short-circuit — return null so control falls back to the
     * <en/> "copy selected rows / single cell" chain. Preserves existing semantics: when a range
     * <en/> exists but is empty, Ctrl+C still copies the selected rows.
     */
    if (rangeSelection.columns.length === 0 || rangeSelection.tsv === '')
      return null

    const { safeColumns, strippedProps } = stripSensitiveColumns(rangeSelection.columns)
    if (strippedProps.length > 0) {
      devWarn(`[AdvTable] sensitive column(s) excluded from range copy: ${strippedProps.join(', ')}`)
    }
    /**
     * <zh/> 全部列为敏感列——拒绝复制，与单格复制路径保持同一语义：
     * <zh/> 返回 true（无操作）而非 false（传输失败），避免误导性的 COPY_FAILED 结构化错误。
     * <en/> All columns sensitive — refuse to copy, mirroring the single-cell path semantics:
     * <en/> return true (no-op) rather than false (transport failure) to avoid a misleading
     * <en/> COPY_FAILED structured error.
     */
    if (safeColumns.length === 0) {
      if (isDev) {
        devWarn('[AdvTable] refused to copy a sensitive-only range selection.')
      }
      return true
    }
    if (strippedProps.length === 0) {
      return writeRawTsvToClipboard(rangeSelection.tsv)
    }
    // <zh/> 部分列被剔除——按保留列在原列序中的位置切片 | <en/> Some columns dropped — slice by kept positions in the original column order
    const keepIndices: number[] = []
    for (let i = 0; i < rangeSelection.columns.length; i++) {
      if (safeColumns.includes(rangeSelection.columns[i]))
        keepIndices.push(i)
    }
    return writeRawTsvToClipboard(sliceTsvColumns(rangeSelection.tsv, keepIndices))
  }

  async function copyToClipboard(params: any): Promise<boolean> {
    // <zh/> 范围选区优先——Shift+Arrow/拖框产生的矩形 TSV 出站前先过敏感列咽喉
    // <en/> Range selection takes priority — the rectangle TSV from Shift+Arrow/drag passes the sensitive-column choke point first
    const rangeCopied = await copyRangeSelection()
    if (rangeCopied !== null)
      return rangeCopied

    /**
     * <zh/> 注入链断裂告警——范围选区未注入或返回 null 时静默降级为"选中行复制"，
     * <zh/> 违背项目"出口必经显式通道"的一贯风格。devWarn 一次以提示未来重构/第三方包装方。
     * <en/> Injection-chain break warning — when the range selection is not injected or returns null,
     * <en/> it silently degrades to "copy selected rows", violating the project's "every exit
     * <en/> passes an explicit channel" convention. devWarn once to alert future refactors / third-party wrappers.
     */
    if (isDev && !rangeLastSelection) {
      devWarn('[AdvTable] rangeLastSelection is not provided — range-selection copy falls back to row copy. If range selection is enabled, ensure the interaction orchestrator wires rangeLastSelection.')
    }
    const selectedRows = selection.selectionState?.getSelectedRows?.()
    if (selectedRows && selectedRows.length > 0) {
      /**
       * <zh/> 安全契约：Ctrl+C/X 行复制与导出/打印/右键复制共用同一敏感列咽喉
       * <zh/> （security.ts stripSensitiveColumns）。此路径必须使用过滤后的 safeColumns 而非直接使用 effectiveColumns，
       * <zh/> 否则 sensitive 列的值可被键盘复制外泄，违反"所有数据出口必经统一过滤"契约。
       * <en/> Security contract: Ctrl+C/X row copy shares the same sensitive-column choke point
       * <en/> as export/print/context-menu copy (security.ts stripSensitiveColumns). This path
       * <en/> must use the filtered safeColumns instead of effectiveColumns directly, otherwise
       * <en/> `sensitive` column values leak via keyboard copy in violation of the "every data exit passes the filter" contract.
       */
      // 复制面展平为叶子列——分组列本身无业务值，顶层直传会产生空列；
      // 展平后再走同一敏感列咽喉（顺序：展平 → 剥离 sensitive）。
      const { safeColumns, strippedProps } = stripSensitiveColumns(flattenLeafColumns(pipeline.effectiveColumns()))
      if (strippedProps.length > 0)
        devWarn(`[AdvTable] sensitive column(s) excluded from clipboard copy: ${strippedProps.join(', ')}`)
      return copyRowsToClipboard(selectedRows, safeColumns)
    }
    const row = params?.rowData
    const column = params?.column
    if (row && column) {
      /**
       * <zh/> 单格复制同样受契约约束——目标列本身是敏感列时拒绝复制。
       * <zh/> 返回 true（无操作）而非 false（传输失败），保持"无内容可复制 ≠ 剪贴板故障"
       * <zh/> 的语义，避免误导性的 COPY_FAILED 结构化错误。
       * <en/> Single-cell copy is bound by the same contract — refuse when the target column
       * <en/> itself is sensitive. Returns true (no-op) instead of false (transport failure),
       * <en/> preserving "nothing to copy" ≠ "clipboard failure" semantics and avoiding a
       * <en/> misleading COPY_FAILED structured error.
       */
      const { safeColumns } = stripSensitiveColumns([column])
      if (safeColumns.length === 0) {
        if (isDev)
          devWarn(`[AdvTable] refused to copy a cell in sensitive column: ${String(column.prop ?? column.key ?? '<unknown>')}`)
        return true
      }
      return copyCellToClipboard(row, column, pipeline.effectiveColumns())
    }
    // 无选中行且无单元格上下文——空操作而非失败 | No selection and no cell context — a no-op, not a failure
    return true
  }

  /**
   * <zh/> 防抖版复制——内部捕获错误并 emit，避免 unhandled rejection
   * <zh/> （handleClipboardCopy 在调用方未 await，错误需通过 emit 透出）
   * <en/> Debounced copy — catches errors internally and emits to avoid unhandled rejection
   * <en/> (handleClipboardCopy is not awaited at call sites, so errors must be surfaced via emit)
   */
  const handleClipboardCopy = useDebounceFn(async (params: any) => {
    let copied: boolean
    try {
      copied = await copyToClipboard(params)
    }
    catch (err) {
      emitError('TABLE_CLIPBOARD_COPY_FAILED', err)
      return
    }
    /**
     * <zh/> 关键反馈闸门：底层返回的 false 必须派发结构化错误
     * <zh/> （两个 catch 分支对传输失败不可达），否则权限拒绝时用户得不到任何提示。
     * <en/> Critical feedback gate: an underlying `false` must dispatch the structured error
     * <en/> (both catch branches unreachable for transport failures), otherwise users get zero
     * <en/> feedback when permission is denied.
     */
    if (!copied) {
      emitError(
        'TABLE_CLIPBOARD_COPY_FAILED',
        new Error('[AdvTable] Clipboard write failed (copyToClipboard returned false).'),
      )
    }
  }, 100)

  /**
   * <zh/> KeepAlive deactivated 或组件卸载时取消 pending 的复制防抖，
   * <zh/> 避免隐藏/卸载后仍执行剪贴板写入与 pipeline 访问。
   * <en/> Cancel pending copy debounce on KeepAlive deactivated or component unmount,
   * <en/> avoiding clipboard writes and pipeline access after hidden/unmounted.
   */
  const debouncedCopy = handleClipboardCopy as DebouncedFunction<typeof handleClipboardCopy>
  onBeforeUnmount(() => debouncedCopy.cancel?.())
  onDeactivated(() => debouncedCopy.cancel?.())

  /** <zh/> 取消待执行的复制防抖 | <en/> Cancel pending copy debounce */
  function cancelPendingCopy(): void {
    debouncedCopy.cancel?.()
  }

  /**
   * <zh/> 清空范围选区覆盖的单元格（剪切面 = 复制面）。
   *
   * <zh/> 仅清空选区矩形内、且未被敏感列过滤剔除的列（剪切只移除被复制的内容）。
   * <en/> Clear exactly the cells covered by the range selection (cut surface = copy surface).
   * <en/> Only the selection rectangle minus sensitive-filtered columns is cleared
   * <en/> (cut removes only what was copied).
   */
  async function clearRangeSelectionCells(rangeSelection: ClipboardRangeSelection): Promise<void> {
    const { safeColumns } = stripSensitiveColumns(rangeSelection.columns)
    if (safeColumns.length === 0) {
      if (isDev)
        devWarn('[AdvTable] cut range contained only sensitive columns; nothing cleared.')
      return
    }

    const visData = pipeline.visibleData()
    const rk = pipeline.rowKeyFn()
    const visKeyToIndex = new Map<string, number>()
    for (let i = 0; i < visData.length; i++)
      visKeyToIndex.set(rk(visData[i]), i)

    const safeProps = new Set(safeColumns.map(c => (c.prop ?? c.property) as string).filter(Boolean))
    const batchCells: Array<{ rowIndex: number, prop: string, columnKey: string, value: any }> = []
    let skippedCount = 0
    for (const row of rangeSelection.rows ?? []) {
      const rowIndex = visKeyToIndex.get(rk(row)) ?? -1
      if (rowIndex < 0) {
        skippedCount++
        continue
      }
      for (const col of rangeSelection.columns) {
        const prop = (col.prop ?? col.property) as string | undefined
        if (!prop || !safeProps.has(prop))
          continue
        const colKey = (col.key ?? prop) as string
        batchCells.push({ rowIndex, prop, columnKey: colKey, value: '' })
      }
    }

    if (isDev && skippedCount > 0)
      devWarn(`[AdvTable] cut skipped ${skippedCount} range row(s) not in the current visible data`)

    if (batchCells.length > 0) {
      try {
        await edit.batchCommitCells(batchCells, 'cut')
      }
      catch (err) {
        emitError('TABLE_CLIPBOARD_CUT_FAILED', err)
      }
    }
  }

  async function handleClipboardCut(params: any) {
    let copied: boolean
    try {
      copied = await copyToClipboard(params)
    }
    catch (err) {
      emitError('TABLE_CLIPBOARD_COPY_FAILED', err)
      return
    }
    /**
     * <zh/> 关键安全闸门：剪贴板写入失败（false）必须中止后续破坏性清空。
     * <zh/> 否则权限拒绝时复制未发生但选中单元格仍被清空，造成静默数据丢失；失败即终止，数据保持原样。
     * <en/> Critical safety gate: a failed clipboard write (false) MUST abort the destructive clearing below.
     * <en/> Otherwise on permission denial the copy fails while the selected cells are wiped anyway
     * <en/> (silent data loss); failure aborts and data stays intact.
     */
    if (!copied) {
      emitError(
        'TABLE_CLIPBOARD_COPY_FAILED',
        new Error('[AdvTable] Cut aborted: clipboard write failed before clearing cells.'),
      )
      return
    }

    // <zh/> 剪切面 = 复制面：范围选区激活时只清空选区矩形（复制了什么就清什么），
    // <zh/> 不再走"选中行 × 全部可编辑列"的粗粒度清空。
    // <en/> Cut surface = copy surface: with an active range selection, clear exactly the
    // <en/> rectangle instead of the coarse "selected rows × every editable column".
    const rangeSelection = rangeLastSelection?.()
    if (rangeSelection
      && rangeSelection.columns.length > 0
      && rangeSelection.tsv !== ''
      && rangeSelection.rows
      && rangeSelection.rows.length > 0) {
      await clearRangeSelectionCells(rangeSelection)
      return
    }

    const selectedRows = selection.selectionState?.getSelectedRows?.()
    if (!selectedRows || selectedRows.length === 0)
      return

    /**
     * <zh/> 剪切面 = 复制面：清除面必须与复制面走同一个敏感列咽喉。
     * <zh/> 敏感列的值从未进入剪贴板，若此处仍按其"可编辑"清空，用户未复制到的敏感数据
     * <zh/> 会被静默删除且无法粘贴还原（静默数据丢失）。
     * <en/> Cut surface = copy surface: the clearing side MUST pass the same sensitive-column
     * <en/> choke point as the copy side. Sensitive values never reach the clipboard, so clearing
     * <en/> them just because they are editable silently destroys data the user never copied
     * <en/> (unrecoverable — it cannot be pasted back).
     */
    // 剪切面先展平为叶子列再过滤——分组子列的 editable 此前因顶层过滤被整体跳过。
    const { safeColumns } = stripSensitiveColumns(flattenLeafColumns(pipeline.effectiveColumns()))
    const cols = safeColumns.filter((c: ProcessedColumn) => c.editable && !c.hidden)
    if (cols.length === 0)
      return

    const visData = pipeline.visibleData()
    const rk = pipeline.rowKeyFn()

    /**
     * <zh/> 基于可见数据一次性构建 key → index Map（O(n)），替代循环内 visData.indexOf(row) 的 O(n×m) 扫描。
     * <zh/> 注意：不能用 rowKeyMeta.keyToIndex，那是基于全量 tableData 构建的全量索引，
     * <zh/> 与 edit.batchCommitCells 期望的可见数据索引不匹配（分页模式下偏差 = (currentPage-1) × pageSize）。
     * <en/> Build key → index Map from visible data in one pass (O(n)), replacing O(n×m) scan of visData.indexOf(row) inside loops.
     * <en/> Note: Cannot use rowKeyMeta.keyToIndex, which is a full index built from all tableData,
     * <en/> mismatched with visible data indices expected by edit.batchCommitCells (offset in pagination mode = (currentPage-1) × pageSize).
     */
    const visKeyToIndex = new Map<string, number>()
    for (let i = 0; i < visData.length; i++) {
      visKeyToIndex.set(rk(visData[i]), i)
    }

    const batchCells: Array<{ rowIndex: number, prop: string, columnKey: string, value: any }> = []
    let skippedCount = 0
    for (const row of selectedRows) {
      const rowIndex = visKeyToIndex.get(rk(row)) ?? -1
      if (rowIndex < 0) {
        skippedCount++
        continue
      }
      for (const col of cols) {
        const prop = col.prop ?? col.property
        const colKey = col.key ?? prop
        if (prop && colKey) {
          batchCells.push({ rowIndex, prop, columnKey: colKey, value: '' })
        }
      }
    }
    if (batchCells.length > 0) {
      try {
        await edit.batchCommitCells(batchCells, 'cut')
      }
      catch (err) {
        emitError('TABLE_CLIPBOARD_CUT_FAILED', err)
      }
    }
    if (isDev && skippedCount > 0) {
      devWarn(`[AdvTable] cut skipped ${skippedCount} row(s) not in the current visible data (cross-page cut is not supported) | 剪切操作跳过了 ${skippedCount} 行（不在当前可见数据中，跨页剪切暂不支持）`)
    }
  }

  async function handleClipboardPaste(_params: any) {
    try {
      const text = await navigator.clipboard.readText()
      if (!text)
        return

      /**
       * <zh/> 仅丢弃**尾部**空行，保留中间空行。
       * <zh/> 禁止用 `.filter(line => line.trim)`——其会删除中间空行，导致后续数据整体上移、
       * <zh/> 粘贴到错误的行（静默数据错位）。中间空行是合法数据（整行皆空的记录）。
       * <en/> Drop only **trailing** empty lines, preserving interior ones.
       * <en/> Never use `.filter(line => line.trim)` — it deletes interior empty lines, shifting all
       * <en/> subsequent data up and pasting into the wrong rows (silent data misalignment).
       * <en/> An interior empty line is legitimate data (a record whose cells are all blank).
       */
      const rawLines = text.split(TSV_LINE_SPLIT_RE)
      let endIndex = rawLines.length
      while (endIndex > 0 && rawLines[endIndex - 1].trim() === '') {
        endIndex--
      }
      const rows = endIndex === rawLines.length ? rawLines : rawLines.slice(0, endIndex)
      if (rows.length === 0)
        return

      // 展平分组列树（单一源）：顶层过滤会遗漏子列，子列不参与粘贴
      const flatCols: ProcessedColumn[] = flattenLeafColumns(
        pipeline.effectiveColumns() as Array<ProcessedColumn & { children?: ProcessedColumn[] }>,
      )
      const cols = flatCols.filter(
        (c: ProcessedColumn) => c.editable && !c.hidden && (c.prop ?? (c as unknown as { property?: unknown }).property) && edit.isColumnEditable(c),
      )
      if (cols.length === 0)
        return

      const visData = pipeline.visibleData()
      // 行起点必须换算到编辑域（renderData）：DOM 序号是 pinnedDisplayData 域，
      // 顶部 pinned/Grand 会使其前移。优先按行对象身份定位，合成行直接中止。
      let startRowIndex = 0
      {
        const anchorRow = _params?.rowData
        if (anchorRow != null && typeof anchorRow === 'object') {
          // <zh/> 合成行直接中止（单一源） | <en/> Abort on synthetic rows (single source)
          if (isSyntheticRow(anchorRow)) {
            return
          }
          const byIdentity = (visData as unknown[]).indexOf(anchorRow)
          if (byIdentity < 0)
            return
          startRowIndex = byIdentity
        }
        else if (_params?.rowIndex != null) {
          const idx = _params.rowIndex as number
          if (!Number.isInteger(idx) || idx < 0 || idx >= visData.length)
            return
          startRowIndex = idx
        }
      }

      /**
       * <zh/> 列起点感知（列键优先）——优先用焦点单元格的列配置在可编辑列列表中定位起点。
       * <zh/> 数值 columnIndex 与"editable 过滤后的 cols"不同域：前部存在
       * <zh/> selection/只读/操作列时必须按列键定位，否则错列或静默丢弃。
       * <zh/> 焦点列不可编辑时中止粘贴而非错位写入；无列上下文时回退起点 0。
       * <en/> Column-start awareness (key-first) — resolve the start column from the focused
       * <en/> cell's column config within the editable-filtered list. The numeric
       * <en/> columnIndex lives in a different domain than the editable-filtered `cols`: with leading
       * <en/> selection/read-only/option columns, resolve by column key, otherwise misalignment or silent drops.
       * <en/> Abort when the focused column is not editable instead of
       * <en/> writing into wrong columns; fall back to start-at-0 without column context.
       */
      let startColIndex = 0
      const focusColumn: ProcessedColumn | undefined = _params?.column
      const focusKey = focusColumn
        ? ((focusColumn.key ?? focusColumn.prop ?? focusColumn.property) as string | undefined)
        : undefined
      if (focusKey) {
        const focusIdx = cols.findIndex(
          c => ((c.key ?? c.prop ?? c.property) as string | undefined) === focusKey,
        )
        if (focusIdx < 0) {
          if (isDev)
            devWarn(`[AdvTable] paste aborted: focused column "${focusKey}" is not editable`)
          return
        }
        startColIndex = focusIdx
      }
      else {
        const idx = _params?.columnIndex ?? _params?.colIndex
        if (idx != null)
          startColIndex = Math.max(0, idx)
      }

      const batchCells: Array<{ rowIndex: number, prop: string, columnKey: string, value: any }> = []
      for (let i = 0; i < rows.length && startRowIndex + i < visData.length; i++) {
        const cells = rows[i].split('\t')
        for (let j = 0; j < cells.length && startColIndex + j < cols.length; j++) {
          const targetCol = cols[startColIndex + j]
          const prop = targetCol.prop ?? targetCol.property
          const colKey = targetCol.key ?? prop
          if (prop && colKey) {
            batchCells.push({ rowIndex: startRowIndex + i, prop, columnKey: colKey, value: cells[j] })
          }
        }
      }

      if (batchCells.length > 0) {
        /**
         * <zh/> 静默截断可观测——超出可见行范围的粘贴行会被丢弃，dev 下告警避免用户误以为全部写入。
         * <en/> Silent-truncation observability — pasted rows beyond the visible range are dropped;
         * <en/> warn in dev so users don't assume everything was written.
         */
        if (isDev && startRowIndex + rows.length > visData.length) {
          devWarn(
            `[AdvTable] paste truncated: ${rows.length} row(s) from row ${startRowIndex}, `
            + `only ${visData.length - startRowIndex} fit in the visible data | `
            + `粘贴被截断：从第 ${startRowIndex} 行起共 ${rows.length} 行，可见数据仅能容纳 ${visData.length - startRowIndex} 行`,
          )
        }
        await edit.batchCommitCells(batchCells, 'paste')
      }
    }
    catch (err) {
      /**
       * <zh/> 区分两类错误：navigator.clipboard.readText 抛出（API 不可用 / 权限被拒）vs 编辑管线提交失败
       * <en/> Distinguish between clipboard read failure (API unavailable / permission denied) and edit pipeline commit failure
       */
      const isReadError = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError')
      if (isReadError) {
        emitError('TABLE_CLIPBOARD_READ_FAILED', err)
      }
      else {
        emitError('TABLE_CLIPBOARD_PASTE_FAILED', err)
      }
    }
  }

  return { handleClipboardCopy, handleClipboardCut, handleClipboardPaste, cancelPendingCopy }
}
