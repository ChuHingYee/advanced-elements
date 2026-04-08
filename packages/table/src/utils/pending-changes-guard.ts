import type { Translator } from '../types/translator'
import type { NotifyFn } from './notification'

/**
 * <zh/> 未提交编辑守卫——导出 / 打印等「把数据源快照写入产物」的入口在写产物之前调用。
 * <en/> Uncommitted-edit guard — called before artifact-producing entries (export / print) snapshot
 * <en/> the data source.
 *
 * @remarks
 * <zh/> 编辑缓冲 / 批量暂存中的值尚未写回数据源，产出的文件或打印页会承载**旧值**，
 * <zh/> 与屏幕显示矛盾且不会抛错——故中止而非放行：中止只需用户先提交或先放弃即可恢复，
 * <zh/> 放行则得到一个矛盾且难以察觉的产物。`hasUnsavedChanges` 缺省时不校验，行为不变。
 *
 * <en/> Values in the edit buffer / batch staging are not yet written back, so the produced file or
 * <en/> printed page carries **stale** values that contradict the screen without throwing — hence aborting
 * <en/> rather than continuing: aborting is recoverable by committing or discarding first, whereas
 * <en/> continuing yields a contradicting artifact that is easy to miss. Absent `hasUnsavedChanges`,
 * <en/> no check runs.
 *
 * @param options - <zh/> 守卫参数 | <en/> guard parameters
 * @param options.hasUnsavedChanges - <zh/> 未提交编辑探测（缺省 = 不启用守卫） | <en/> uncommitted-edit probe (absent = no guard)
 * @param options.notify - <zh/> 通知通道 | <en/> notification channel
 * @param options.t - <zh/> 翻译函数 | <en/> translation function
 * @param options.messageKey - <zh/> 提示文案的 i18n 键 | <en/> i18n key of the notification message
 * @param options.source - <zh/> 通知来源标识（'export' / 'print'） | <en/> notification source id ('export' / 'print')
 * @returns <zh/> true 表示已中止并已提示（调用方应立刻 return） | <en/> true when aborted and notified (caller should return immediately)
 */
export function abortOnPendingChanges(options: {
  /** <zh/> 未提交编辑探测（缺省 = 不启用守卫） | <en/> uncommitted-edit probe (absent = no guard) */
  hasUnsavedChanges?: () => boolean
  /** <zh/> 通知通道 | <en/> notification channel */
  notify: NotifyFn
  /** <zh/> 翻译函数 | <en/> translation function */
  t: Translator
  /** <zh/> 提示文案的 i18n 键 | <en/> i18n key of the notification message */
  messageKey: string
  /** <zh/> 通知来源标识（'export' / 'print'） | <en/> notification source id ('export' / 'print') */
  source: string
}): boolean {
  if (!options.hasUnsavedChanges?.())
    return false
  options.notify('warning', options.t(options.messageKey), options.source)
  return true
}
