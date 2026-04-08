/**
 * <zh/> 国际化翻译函数
 * @param path - <zh/> 翻译键路径，如 'table.query'、'table.reset' | <en/> translation key path, e.g. 'table.query', 'table.reset'
 * @param params - <zh/> 插值参数，如 `{ count: 3 }` ↦ `'已导入 {count} 条'`（缺省不插值） | <en/> interpolation params, e.g. `{ count: 3 }` ↦ `'imported {count} rows'` (no interpolation when omitted)
 * @returns <zh/> 翻译后的文本 | <en/> translated text
 */
export type Translator = (path: string, params?: Record<string, any>) => string
