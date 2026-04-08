import type { Ref } from 'vue'
import type { AdvTableEmitFn } from '../../types'
import type { ImportOptions } from '../../types/config'
import type { TableErrorHandler } from '../../utils/error-handler'
import type { ParseResult } from '../../utils/import-helpers'
import type { NotifyFn } from '../../utils/notification'
import { onBeforeUnmount, ref } from 'vue'
import {
  isCsvFile,
  isExcelFile,
  parseCsvText,
  parseExcelBuffer,
  readFileAsArrayBuffer,
  readFileAsText,
} from '../../utils/import-helpers'
import { createDefaultNotify } from '../../utils/notification'
import { sanitizeDataArray } from '../../utils/security'
import { DEFAULT_ACCEPT } from './import-file-picker'

export interface UseTableImportOptions<T> {
  /** <zh/> 导入配置 | <en/> Import options */
  importOptions: () => ImportOptions | undefined
  /** <zh/> 翻译函数 | <en/> Translate function */
  t: (key: string, params?: Record<string, any>) => string
  /** <zh/> 导入行数据回调 | <en/> Imported rows callback */
  onImportedRows: (rows: T[], mode: 'append' | 'replace') => void
  /** <zh/> 列配置，用于将表头映射回 prop | <en/> Column config, used to map headers back to props */
  columns?: () => { prop?: string, label?: string }[]
  /**
   * <zh/> 错误派发函数——解析/读取/转换失败时通过此函数派发结构化错误
   * <en/> Error emit function — used to dispatch structured errors when parse/read/transform fails
   */
  emit?: AdvTableEmitFn
  /**
   * <zh/> 结构化错误处理器——导入失败时派发 TABLE_IMPORT_FAILED
   * <en/> Structured error handler — dispatches TABLE_IMPORT_FAILED on failure
   */
  handleError?: TableErrorHandler
  /** <zh/> 通知通道——未传入时使用默认实现 | <en/> Notification channel — defaults to default implementation */
  notify?: NotifyFn
  /**
   * <zh/> 自动注册卸载清理——延迟初始化（setup 之后创建）时传 false，由壳转发清理
   * <en/> Auto-register unmount cleanup — pass false for deferred post-setup init; the shell forwards cleanup
   * @default true
   */
  autoLifecycle?: boolean
}

export interface UseTableImportReturn {
  /** <zh/> 是否正在导入 | <en/> Whether importing */
  importing: Ref<boolean>
  /** <zh/> 触发导入 | <en/> Trigger import */
  triggerImport: () => void
  /**
   * <zh/> 导入文件——cancelled=true 表示被 beforeImport 前置确认取消（已提示，不再报成功）。
   * <en/> Import a file — cancelled=true means vetoed by the beforeImport pre-confirmation (already notified, no success toast).
   */
  importFile: (file: File) => Promise<{ cancelled: boolean }>
  /**
   * <zh/> 处理已选文件（供延迟加载的壳转调；解析、提示与错误上报与 change 事件同路径）
   * <en/> Handle a picked file (for deferred shell delegation; same parse/notify/error path as change events)
   */
  handleFileSelected: (file: File) => Promise<void>
}

/**
 * <zh/> 默认文件大小上限（20MB）——防止超大 CSV/Excel 全量读入内存造成页面卡死
 * <en/> Default file size cap (20MB) — prevents huge CSV/Excel files from being fully read into memory and freezing the page
 */
const DEFAULT_MAX_FILE_SIZE = 20 * 1024 * 1024

function showMessage(notify: NotifyFn, t: (key: string, params?: Record<string, any>) => string, key: string, fallbackKey: string, type: 'success' | 'error' | 'warning', params?: Record<string, any>): void {
  const message = t(key, params) || t(fallbackKey)
  notify(type, message, 'import')
}

/**
 * <zh/> 表格导入 Composable——编排文件选择→解析→转换→数据注入
 * @param options - <zh/> 导入配置（文件类型、行转换、前置确认等） | <en/> import config (file types, row transform, pre-confirm, etc.)
 * @returns <zh/> importing（导入中）、triggerImport（触发文件选择）、importFile（编程式导入） | <en/> importing (importing state), triggerImport (trigger file selection), importFile (programmatic import)
 */
export function useTableImport<T>(options: UseTableImportOptions<T>): UseTableImportReturn {
  const { importOptions, t, onImportedRows, columns, emit, handleError, notify = createDefaultNotify() } = options

  const importing = ref(false)

  /**
   * <zh/> 派发结构化错误，优先使用 handleError，回退到 emit
   * <en/> Dispatch structured error, prefers handleError, falls back to emit
   */
  function emitError(code: 'TABLE_IMPORT_FAILED', cause: unknown): void {
    if (handleError) {
      handleError(code, { cause })
    }
    else {
      emit?.('error', { code, cause, severity: 'error' as const })
    }
  }

  /** <zh/> 隐藏的 file input 元素，用于唤起浏览器文件选择对话框 | <en/> Hidden file input element for browser file dialog */
  let fileInput: HTMLInputElement | null = null

  /**
   * <zh/> 获取隐藏的 file input 元素（单例，懒创建）
   * <en/> Get hidden file input element (singleton, lazily created)
   */
  function getFileInput(): HTMLInputElement {
    if (!fileInput) {
      fileInput = document.createElement('input')
      fileInput.type = 'file'
      fileInput.style.display = 'none'
      document.body.appendChild(fileInput)

      fileInput.addEventListener('change', handleFileChange)
    }
    return fileInput
  }

  /** <zh/> 组件卸载时移除 fileInput DOM 元素和事件监听器，防止内存泄漏（autoLifecycle=false 时由壳接管） | <en/> Remove the fileInput DOM element and event listener on unmount to prevent memory leaks (owned by the shell when autoLifecycle=false) */
  if (options.autoLifecycle ?? true) {
    onBeforeUnmount(() => {
      if (fileInput) {
        fileInput.removeEventListener('change', handleFileChange)
        fileInput.remove()
        fileInput = null
      }
    })
  }

  /**
   * <zh/> 处理文件选择变化——读取并导入文件
   * <en/> Handle file selection change — read and import the selected file
   */
  async function handleFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''

    if (!file)
      return

    await handleFileSelected(file)
  }

  /**
   * <zh/> 处理已选文件——解析、转换并注入数据（含成功提示与统一错误上报）
   * <en/> Handle a picked file — parse, transform and inject data (with success toast and unified error reporting)
   */
  async function handleFileSelected(file: File): Promise<void> {
    try {
      await importFile(file)
    }
    catch (err: any) {
      const msg = err?.message ?? t('table.import.fail')
      showMessage(notify, t, 'table.import.fail', 'table.import.fail', 'error', { msg })
      emitError('TABLE_IMPORT_FAILED', err)
    }
  }

  function triggerImport(): void {
    const config = importOptions()
    const accept = config?.accept ?? DEFAULT_ACCEPT

    const input = getFileInput()
    input.accept = accept.join(',')
    input.click()
  }

  async function importFile(file: File): Promise<{ cancelled: boolean }> {
    const config = importOptions() ?? {}
    const accept = config.accept ?? DEFAULT_ACCEPT
    const mode = config.mode ?? 'append'

    // <zh/> 扩展名取末段并小写：无扩展名（lastIndexOf<0）即 ''，避免 "README" 误算为 ".readme"；
    // <zh/> accept 统一小写比对，自定义大写 accept 不拒真文件
    // <en/> Take the trailing extension lowercased; normalize accept for case-insensitive match
    const dot = file.name.lastIndexOf('.')
    const ext = dot < 0 ? '' : `.${file.name.slice(dot + 1).toLowerCase()}`
    const normalizedAccept = accept.map(a => a.toLowerCase())
    if (!normalizedAccept.includes(ext)) {
      const err = new Error(`[AdvTable] Import rejected: extension "${ext || '(none)'}" not in accept list.`)
      showMessage(notify, t, 'table.import.invalidFile', 'table.import.fail', 'error')
      emitError('TABLE_IMPORT_FAILED', err)
      return { cancelled: false }
    }

    // <zh/> 文件大小上限（默认 20MB，可经 importOptions.maxFileSize 调整）。
    // <zh/> 在任何读取动作之前拒绝，避免 GB 级文件被整体载入内存。
    // <en/> File size cap (default 20MB, adjustable via importOptions.maxFileSize).
    // <en/> Rejected before any read so gigabyte-scale files are never loaded into memory.
    const maxFileSize = config.maxFileSize ?? DEFAULT_MAX_FILE_SIZE
    if (file.size > maxFileSize) {
      const err = new Error(`[AdvTable] Import file size ${file.size} bytes exceeds limit ${maxFileSize} bytes.`)
      showMessage(notify, t, 'table.import.fail', 'table.import.fail', 'error', { msg: err.message })
      emitError('TABLE_IMPORT_FAILED', err)
      return { cancelled: false }
    }

    if (importing.value)
      return { cancelled: false }
    importing.value = true

    try {
      let result: ParseResult

      if (isExcelFile(file.name)) {
        const buffer = await readFileAsArrayBuffer(file)
        result = await parseExcelBuffer(buffer, {
          headerRow: config.headerRow,
        })
      }
      else if (isCsvFile(file.name)) {
        const text = await readFileAsText(file, config.encoding)
        result = parseCsvText(text, {
          delimiter: config.delimiter,
          headerRow: config.headerRow,
        })
      }
      else {
        const err = new Error(`[AdvTable] Import rejected: no parser for "${file.name}".`)
        showMessage(notify, t, 'table.import.invalidFile', 'table.import.fail', 'error')
        emitError('TABLE_IMPORT_FAILED', err)
        return { cancelled: false }
      }

      if (result.rows.length === 0) {
        showMessage(notify, t, 'table.import.noData', 'table.import.fail', 'warning')
        return { cancelled: false }
      }

      let rows = result.rows

      // 将表头（label）映射回 prop | Map headers (label) back to prop
      const cols = columns?.()
      if (cols && cols.length > 0 && result.columns.length > 0) {
        // 构建 label -> prop 的映射 | Build label -> prop mapping
        const headerToProp = new Map<string, string>()
        for (const col of cols) {
          if (col.prop && col.label)
            headerToProp.set(col.label, col.prop as string)
        }

        // 检查是否需要映射（如果表头已经是 prop，则不需要映射） | Check if mapping is needed (if headers are already props, no mapping needed)
        const needMapping = result.columns.some(header => headerToProp.has(header))
        if (needMapping) {
          rows = rows.map((row) => {
            const newRow: Record<string, unknown> = {}
            for (const [key, value] of Object.entries(row)) {
              const prop = headerToProp.get(key) ?? key
              newRow[prop] = value
            }
            return newRow
          })
        }
      }

      /** <zh/> 应用 maxRows 行数截断 | <en/> Apply maxRows truncation */
      if (config.maxRows && rows.length > config.maxRows) {
        rows = rows.slice(0, config.maxRows)
        showMessage(notify, t, 'table.import.maxRowsExceeded', 'table.import.fail', 'warning', { max: String(config.maxRows) })
      }

      /** <zh/> 应用自定义行转换 transformRow（支持异步，逐行 await） | <en/> Apply custom row transform (async supported, awaited per row) */
      if (config.transformRow) {
        const transformed: Record<string, unknown>[] = []
        for (let i = 0; i < rows.length; i++) {
          const row = await config.transformRow(rows[i]!, i)
          if (row !== null)
            transformed.push(row)
        }
        rows = transformed
      }

      /** <zh/> 导入前确认钩子 beforeImport——返回 false 时中止导入（提示已取消，不再报成功） | <en/> Pre-import confirmation hook — aborts the import when it returns false (notified as cancelled, no success toast) */
      if (config.beforeImport) {
        const confirmed = await config.beforeImport(rows, result.columns)
        if (!confirmed) {
          showMessage(notify, t, 'table.import.cancelled', 'table.import.cancelled', 'warning')
          return { cancelled: true }
        }
      }

      // <zh/> 安全防护：导入文件是不受信输入——在数据进入表格状态前清除
      // <zh/> 原型污染键（__proto__/constructor/prototype），与远程请求路径共用同一消毒器。
      // <zh/> 约束：检测到污染必须派发结构化安全事件，未经消毒不得进入表格状态。
      // <en/> Security: imported files are untrusted input — strip prototype pollution keys
      // <en/> (__proto__/constructor/prototype) before rows enter table state, sharing the same
      // <en/> sanitizer as the remote-request path. Structured security event on detection.
      rows = sanitizeDataArray(
        rows as Record<string, unknown>[],
        (rowIndex, keys) => {
          handleError?.('TABLE_SECURITY_PROTOTYPE_POLLUTION', {
            cause: { rowIndex, keys, source: 'import' },
          })
        },
      ) as typeof rows

      onImportedRows(rows as T[], mode)

      if (config.onImported)
        config.onImported(rows)

      showMessage(notify, t, 'table.import.success', 'table.import.success', 'success', { count: String(rows.length) })
      return { cancelled: false }
    }
    // <zh/> 失败只 rethrow 不上报——唯一调用方 handleFileChange 统一上报一次，
    // <zh/> 此处再发即双重报错（2 次 ElMessage + 2 次 TABLE_IMPORT_FAILED 事件）。
    // <en/> Failures rethrow without reporting — the sole caller handleFileChange reports once;
    // <en/> reporting here doubled the message (2× ElMessage + 2× TABLE_IMPORT_FAILED events).
    finally {
      importing.value = false
    }
  }

  return {
    importing,
    triggerImport,
    importFile,
    handleFileSelected,
  }
}
