import type { InjectionKey, Ref } from 'vue'
import type { NotifyFn } from '../../utils/notification'
import { onBeforeUnmount, onDeactivated, ref } from 'vue'
import { copyToClipboard } from '../../utils/copy'
import { tf } from '../../utils/locale-fallback'
import { createDefaultNotify } from '../../utils/notification'

export interface CopyApi {
  /** <zh/> 复制成功后的闪烁状态 | <en/> Copied success flash state */
  copied: Ref<boolean>
  /** <zh/> 复制处理函数，支持带表头前缀的复制 | <en/> Copy handler, supports copy with header prefix */
  handleCopyClick: (text: string, copyHeaders: boolean, columnLabel: string, t?: (path: string) => string) => Promise<void>
}

/**
 * <zh/> 复制 API 的 provide/inject key
 * <en/> Copy API provide/inject key
 */
export const advCopyKey: InjectionKey<CopyApi> = Symbol('advCopy')

/**
 * <zh/> 复制 Composable——管理全局唯一的 copied 状态和计时器，避免每个 CopyableCell 实例独立创建 N 个 ref/timer
 * <en/> Copy composable — manages globally unique copied state and timer, avoids creating N refs/timers per CopyableCell instance
 *
 * @returns <zh/> 复制 API 对象——copied（复制成功后的闪烁状态，2 秒后自动重置）、
 *          handleCopyClick（支持表头前缀的复制处理函数）、api（与两者共享同一状态的依赖注入对象）
 *          | <en/> Copy API object — copied (success flash state, auto-resets after 2 seconds),
 *          handleCopyClick (copy handler with header prefix support), api (DI object sharing the same state)
 */
export function useCopyApi(notify: NotifyFn = createDefaultNotify()) {
  const copied = ref(false)
  let copiedTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * <zh/> 清除已存在的复制状态计时器，防止多次复制导致状态错乱
   * <en/> Clear existing copied state timer, prevents state confusion from multiple copies
   * @internal
   */
  function clearCopiedTimer() {
    if (copiedTimer != null) {
      clearTimeout(copiedTimer)
      copiedTimer = null
    }
  }

  /**
   * <zh/> 复制点击处理——将文本写入剪贴板，根据 copyHeaders 决定是否拼接列前缀，
   * <zh/> 成功/失败后通过 ElMessage 显示提示信息，成功时令 copied 闪烁 2 秒。
   *
   * @param text - <zh/> 待复制的单元格文本 | <en/> cell text to copy
   * @param copyHeaders - <zh/> 是否在复制时拼接列名称前缀 | <en/> whether to prepend column name prefix when copying
   * @param columnLabel - <zh/> 列名称标签（copyHeaders 为 true 时使用） | <en/> column label (used when copyHeaders is true)
   * @param [t] - <zh/> 国际化翻译函数，用于自定义提示文案 | <en/> i18n translation function for custom prompt text
   */
  async function handleCopyClick(text: string, copyHeaders: boolean, columnLabel: string, t?: (path: string) => string) {
    const textToCopy = copyHeaders && columnLabel
      ? `${columnLabel}: ${text}`
      : text
    const success = await copyToClipboard(textToCopy)
    if (success) {
      notify('success', tf(t, 'table.copy.success', '复制成功'), 'copy')
      copied.value = true
      clearCopiedTimer()
      copiedTimer = setTimeout(() => {
        copied.value = false
        copiedTimer = null
      }, 2000)
    }
    else {
      notify('error', tf(t, 'table.copy.fail', '复制失败，请手动复制'), 'copy')
    }
  }

  const api: CopyApi = { copied, handleCopyClick }

  onBeforeUnmount(() => {
    clearCopiedTimer()
  })

  onDeactivated(() => {
    clearCopiedTimer()
  })

  return {
    copied,
    handleCopyClick,
    api,
  }
}
