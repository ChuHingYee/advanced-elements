/**
 * <zh/> 导入文件选择器——隐藏 file input 单例，壳与实现共用，运行时零依赖。
 * <en/> Import file picker — hidden file-input singleton shared by shell and implementation, zero runtime deps.
 *
 * @remarks
 * <zh/> 打开（同步唤起选择框，保用户手势链）与解析（异步）分离：选择框在此创建，
 * <zh/> 文件解析仍在 use-table-import 内；壳自持 picker 生命周期，实现侧按 autoLifecycle 决定是否自注册清理。
 * <en/> Opening (sync dialog for the user-gesture chain) is split from parsing (async): the dialog lives here,
 * <en/> parsing stays in use-table-import; the shell owns picker lifetime while the implementation
 * <en/> self-registers cleanup per autoLifecycle.
 */

/** <zh/> 文件选择对话框默认接受的扩展名 | <en/> File extensions accepted by the file dialog by default */
export const DEFAULT_ACCEPT = ['.csv', '.xlsx', '.xls']

/**
 * <zh/> 文件选择器配置 | <en/> File picker config
 */
export interface FilePickerOptions {
  /** <zh/> 接受的扩展名 | <en/> Accepted extensions */
  accept: () => string[]
  /** <zh/> 文件选定回调（异步上下文，可等待实现加载） | <en/> File-picked callback (async context, may await implementation load) */
  onFile: (file: File) => void
}

/**
 * <zh/> 文件选择器 | <en/> File picker
 */
export interface FilePicker {
  /** <zh/> 同步打开选择框（须在用户手势内调用） | <en/> Open the dialog synchronously (must run within a user gesture) */
  open: () => void
  /** <zh/> 销毁隐藏 input | <en/> Destroy the hidden input */
  destroy: () => void
}

/**
 * <zh/> 创建文件选择器 | <en/> Create a file picker
 *
 * @param options - <zh/> 扩展名与选定回调 | <en/> accepted extensions and picked callback
 * @returns <zh/> 选择器 | <en/> picker
 */
export function createFilePicker(options: FilePickerOptions): FilePicker {
  let input: HTMLInputElement | null = null
  function ensure(): HTMLInputElement {
    if (!input) {
      input = document.createElement('input')
      input.type = 'file'
      input.style.display = 'none'
      document.body.appendChild(input)
      input.addEventListener('change', () => {
        const file = input?.files?.[0]
        if (input)
          input.value = ''
        if (file)
          options.onFile(file)
      })
    }
    return input
  }
  return {
    open() {
      const el = ensure()
      el.accept = options.accept().join(',')
      el.value = ''
      el.click()
    },
    destroy() {
      if (input) {
        input.remove()
        input = null
      }
    },
  }
}
