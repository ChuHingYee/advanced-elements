/**
 * <zh/> 统一回退咽喉：无 t 注入时的必要降级，可检索可审计
 * <en/> Unified fallback throat: necessary downgrade when no t is injected, searchable and auditable
 *
 * @remarks
 * <zh/> 所有 `t?.('table.xxx') ?? '中文'` 散点收敛于此，禁止新增直写回退；
 * <zh/> 回退文案本身保持不变，仅收敛调用形状以便检索与审计。
 * <en/> All `t?.('table.xxx') ?? 'fallback'` sites converge here; no new inline fallbacks;
 * <en/> fallback text itself stays unchanged, only the call shape converges for searchability and audit.
 *
 * @param t - <zh/> 国际化翻译函数，未注入时为 undefined | <en/> i18n translator, undefined when not injected
 * @param key - <zh/> 翻译键路径，如 'table.summary' | <en/> translation key path, e.g. 'table.summary'
 * @param fallback - <zh/> 无翻译时的回退文案（保持原中文不变） | <en/> fallback text when translation is unavailable (original text unchanged)
 * @returns <zh/> 翻译结果或回退文案 | <en/> translated text or fallback text
 */
export function tf(
  t: ((path: string) => string) | undefined,
  key: string,
  fallback: string,
): string {
  if (!t)
    return fallback
  try {
    const result = t(key)
    // Vue i18n: missing key 时返回 key 本身，需视作未翻译而回退
    // Vue i18n: missing keys return the key itself — treat as untranslated
    if (result == null || result === '' || result === key)
      return fallback
    if (typeof result !== 'string')
      return fallback
    return result
  }
  catch {
    return fallback
  }
}
