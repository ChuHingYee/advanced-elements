/**
 * @file use-table-export-helpers.ts
 * @description
 * <zh/> 导出编排的纯辅助函数——通知文案组装与 toolbar 默认选项合并。
 * <zh/> 从 `use-table-export.ts` 抽出：该文件的职责是"编排"（状态 + 流程），
 * <zh/> 而这些是不依赖任何响应式状态的纯函数，混在一起会持续推高编排文件体积（见 check:hook-size）。
 * <en/> Pure helpers for the export orchestration — notification message assembly and toolbar default
 * <en/> option merging. Extracted from `use-table-export.ts`: that file's job is orchestration
 * <en/> (state + flow), whereas these are pure functions touching no reactive state; keeping them
 * <en/> together kept inflating the orchestration file (see check:hook-size).
 */
import type { AdvColumn } from '../../types'
import type { Translator } from '../../types/translator'
import type { NotifyFn } from '../../utils/notification'

/**
 * <zh/> 通过通知通道汇报导出结果（成功或失败）。
 * <en/> Report an export result (success or failure) through the notification channel.
 *
 * @param notify - <zh/> 通知通道 | <en/> notification channel
 * @param t - <zh/> 翻译函数 | <en/> translation function
 * @param successKey - <zh/> 成功文案 i18n 键 | <en/> i18n key of the success message
 * @param failKey - <zh/> 失败文案 i18n 键 | <en/> i18n key of the failure message
 * @param type - <zh/> 结果类型 | <en/> result type
 * @param msg - <zh/> 覆盖文案（失败时携带错误信息） | <en/> overriding message (carries the error text on failure)
 */
export function showMessage(notify: NotifyFn, t: Translator, successKey: string, failKey: string, type: 'success' | 'error', msg?: string): void {
  const fallbackMsg = type === 'success' ? t(successKey) : t(failKey)
  const message = msg ?? fallbackMsg
  // <zh/> 来源标识固定为 'export'——本文件仅服务导出链路
  // <en/> The source id is fixed to 'export' — this file serves the export chain only
  notify(type, message, 'export')
}

/**
 * <zh/> 将 toolbar 默认配置中的 overrideColumns 合并到导出选项
 * @param merged - <zh/> 已合并的选项对象 | <en/> merged options object
 * @param merged.overrideColumns - <zh/> 覆盖列配置，未设置时将用 toolbarColumns 填充 | <en/> override column config, filled with toolbarColumns when not set
 * @param toolbarColumns - <zh/> toolbar 中配置的列 | <en/> columns configured in toolbar
 */
export function mergeExportOverrideColumns<T>(
  merged: { overrideColumns?: AdvColumn<T>[] },
  toolbarColumns: AdvColumn[] | undefined,
) {
  if (!merged.overrideColumns && toolbarColumns) {
    merged.overrideColumns = toolbarColumns as AdvColumn<T>[]
  }
}

/**
 * <zh/> 导出包装函数工厂——自动合并 toolbar 默认选项。
 * <zh/> 返回 `Promise<boolean>`：true = 导出成功，false = 被并发锁/未提交守卫拦截或执行失败。
 * <zh/> 失败已在编排层上报（notify + error 事件），此处转布尔值而非 rethrow——工具栏按钮按契约
 * <zh/> fire-and-forget、不会 catch，转布尔同时避免 unhandled promise rejection，调用方也可 await 感知。
 * @param doExport - <zh/> 实际的导出函数（成功 true / 拦截 false / 失败抛错） | <en/> actual export function (true on success / false on intercept / throws on failure)
 * @param getToolbarColumns - <zh/> 获取 toolbar 列配置 | <en/> get toolbar column config
 * @param mergeExtra - <zh/> 额外合并逻辑 | <en/> extra merge logic
 */
export function createExportWrapper<T extends (...args: any[]) => any>(
  doExport: T,
  getToolbarColumns: () => AdvColumn[] | undefined,
  mergeExtra?: (merged: Parameters<T>[0], options: Parameters<T>[0] | undefined) => void,
): (...args: Parameters<T>) => Promise<boolean> {
  return async (...args: Parameters<T>) => {
    const options = args[0]
    const merged: Parameters<T>[0] = { ...options } as Parameters<T>[0]
    mergeExportOverrideColumns(merged, getToolbarColumns())
    mergeExtra?.(merged, options)
    try {
      const result = await doExport(merged)
      // <zh/> 被拦截时底层返回 false，透传；同步返回的 doExport 按成功计。
      // <en/> Pass through a `false` intercept; a synchronously returning doExport counts as success.
      return result !== false
    }
    catch {
      // <zh/> 失败已上报，此处仅转布尔值（行为与既往 `.catch(() => undefined)` 一致，但调用方可感知）。
      // <en/> Failures are already reported; only convert to boolean (same behavior as the former
      // <en/> `.catch(() => undefined)`, but now observable to callers).
      return false
    }
  }
}
