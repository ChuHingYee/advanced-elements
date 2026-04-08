import { devWarn } from './dev-warn'
import { isDev } from './env'

/**
 * <zh/> 生成定长随机 ID（兼容 http 非安全上下文）——优先 crypto.getRandomValues，降级 Math.random
 * <en/> Generate fixed-length random ID (compatible with http non-secure context) — prefer crypto.getRandomValues, fallback to Math.random
 */
function generateRandomId(len: number): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-'
  const cryptoObj = (typeof globalThis !== 'undefined' ? globalThis.crypto : undefined) as Crypto | undefined
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const arr = new Uint8Array(len)
    cryptoObj.getRandomValues(arr)
    let result = ''
    for (let i = 0; i < len; i++)
      result += chars[arr[i]! % chars.length]
    return result
  }
  let result = ''
  for (let i = 0; i < len; i++)
    result += chars[Math.floor(Math.random() * chars.length)]
  return result
}

/**
 * <zh/> ElTableV2 :row-key 属性名，用于读取行对象上的自动 key 缓存。
 * <zh/> WeakMap 是行标识的主缓存，row[AUTO_KEY_NAME] 是 ElTableV2 的二级缓存；冻结/密封对象不保证可用。
 * <en/> Property name for ElTableV2's :row-key, used to read the auto-key cache on a row object.
 * <en/> WeakMap is the primary row-identity cache; row[AUTO_KEY_NAME] is ElTableV2's secondary cache. Frozen/sealed objects are not guaranteed to work.
 */
export const AUTO_KEY_NAME = '__adv_table_auto_key'

/**
 * <zh/> rowKey 输入类型：支持字符串 key（属性名）、数字 key、Symbol key，或返回 key 的自定义函数。
 * <en/> rowKey input type: a string key (property name), number key, Symbol key, or a custom function returning the key.
 */
export type RowKeyInput<T = any>
  = ((row: T) => string | number | symbol)
    | string
    | number
    | symbol

/**
 * <zh/> 标准化后的 rowKey 函数类型 —— 接收行对象，返回稳定的字符串 key。
 * <en/> Normalized rowKey function type — takes a row object and returns a stable string key.
 */
export type RowKeyFn<T = any> = (row: T) => string

/**
 * <zh/> 行 key 主缓存 —— 行标识的唯一事实来源。
 * <zh/> 无论对象是否可扩展，WeakMap 都能保证 key 的确定性。
 * <zh/> 第二维按 rowKey 输入分 scope：同一行对象在不同表格使用不同 rowKey（如 A 表 `id`、B 表 auto）
 * <zh/> 时互不串扰。未分 scope 前，后读取的表会命中前表的缓存导致 key 错乱。
 * <en/> Primary row-key cache — the single source of truth for row identity.
 * <en/> WeakMap guarantees a deterministic key regardless of whether the object is extensible.
 * <en/> The second dimension scopes by rowKey input: the same row object used with different
 * <en/> rowKeys across tables (e.g. table A `id`, table B auto) no longer pollutes each other.
 */
const keyCache = new WeakMap<object, Map<unknown, string>>()

/**
 * <zh/> 读取 scope 内缓存 | <en/> Read the scoped cache entry
 */
function readScopedKey(row: object, scope: unknown): string | undefined {
  return keyCache.get(row)?.get(scope)
}

/**
 * <zh/> 写入 scope 内缓存 | <en/> Write the scoped cache entry
 */
function writeScopedKey(row: object, scope: unknown, key: string): void {
  let scoped = keyCache.get(row)
  if (!scoped) {
    scoped = new Map()
    keyCache.set(row, scoped)
  }
  scoped.set(scope, key)
}

/**
 * <zh/> 缓存函数类型 rowKey 的包装函数，以保持引用稳定。
 * <en/> Cache the wrapper for a function-typed rowKey to keep its reference stable.
 */
const fnWrapperCache = new WeakMap<(...args: any[]) => any, RowKeyFn<any>>()

/**
 * <zh/> 已就"不可扩展行无法承载自动 key"告警过的行对象——dev 下按行去重，避免同一行反复刷屏
 * <en/> Row objects already warned about "non-extensible row cannot carry the auto key" — deduped per row in dev
 */
const warnedFrozenRows = new WeakSet<object>()

/**
 * <zh/> 安全写入 AUTO_KEY_NAME 到行对象，作为 ElTableV2 的尽力缓存。
 * <zh/> 对冻结/密封/不可扩展的对象静默跳过 —— WeakMap 已持有 key。
 * <en/> Safely write AUTO_KEY_NAME onto a row object as a best-effort cache for ElTableV2.
 * <en/> Silently skips frozen/sealed/non-extensible objects — WeakMap already holds the key.
 *
 * <zh/> ElTableV2 的 :row-key 只接受 string/number/symbol（属性名），直接读取 row[rowKey]；自动 key 场景需要 row[AUTO_KEY_NAME] 存在。
 * <zh/> 行数据可能来自外部 API 的冻结数据，且此函数可能在 computed 中调用，try-catch + isExtensible 检查使突变在所有上下文中安全。
 * <en/> ElTableV2's :row-key only accepts string/number/symbol (property name) and reads row[rowKey] directly; the auto-key scenario requires row[AUTO_KEY_NAME] to exist.
 * <en/> Row data may come from frozen external-API payloads and this function may be called inside computed; try-catch plus the isExtensible check make the mutation safe in all contexts.
 */
function safeWriteAutoKey(row: object, key: string): void {
  try {
    if (Object.isExtensible(row)) {
      if ((row as Record<string, unknown>)[AUTO_KEY_NAME] !== key)
        (row as Record<string, unknown>)[AUTO_KEY_NAME] = key
      return
    }
    /**
     * <zh/> 不可扩展（冻结/密封）行无法承载 AUTO_KEY_NAME——ElTableV2 的 `:row-key` 直接读取该属性，
     * <zh/> 读不到时行标识退化为 `undefined`（虚拟滚动回收可能出现键冲突）。WeakMap 主缓存仍正确，
     * <zh/> 但此前这一退化完全静默，故 dev 下按行对象去重告警一次。
     * <en/> Non-extensible (frozen/sealed) rows cannot carry AUTO_KEY_NAME — ElTableV2's `:row-key` reads
     * <en/> that property directly, so row identity degrades to `undefined` (window recycling may collide).
     * <en/> The WeakMap primary cache stays correct, but the degradation used to be entirely silent, so warn
     * <en/> once per row object in dev.
     */
    if (isDev && !warnedFrozenRows.has(row)) {
      warnedFrozenRows.add(row)
      devWarn(
        '[AdvTable] Row data is frozen/sealed (non-extensible), so the library cannot store its cached row key '
        + `"${AUTO_KEY_NAME}" on the row object. ElTableV2 reads that property as its :row-key, so row identity `
        + 'may degrade to undefined under virtual scrolling. Provide a non-frozen row array, or configure an '
        + 'explicit rowKey whose field exists on every row.',
      )
    }
  }
  catch {
  }
}

/**
 * <zh/> 标准化 rowKey 为纯函数，从行中提取稳定的字符串 key。
 * <en/> Normalize rowKey into a pure function that extracts a stable string key from a row.
 *
 * <zh/> 设计：WeakMap 是行标识的事实来源（确定性、无副作用）；row[AUTO_KEY_NAME] 是尽力二级缓存（服务于 ElTableV2）；
 * <zh/> 返回的函数可安全在 computed 中调用（WeakMap.set 对非响应式结构是纯操作）。
 * <en/> Design: WeakMap is the source of truth for row identity (deterministic, side-effect free); row[AUTO_KEY_NAME] is a best-effort secondary cache (for ElTableV2);
 * <en/> the returned function is safe to call inside computed (WeakMap.set is a pure operation on non-reactive structures).
 *
 * @example
 * const fn = normalizeRowKey('id')
 * fn({ id: 1 }) // => '1'
 *
 * const fn2 = normalizeRowKey
 * fn2({}) // => auto-generated key
 */
export function normalizeRowKey<T = any>(
  rowKey?: RowKeyInput<T>,
  onWarn?: (message: string, ...args: unknown[]) => void,
): RowKeyFn<T> {
  if (rowKey !== undefined) {
    if (typeof rowKey === 'function') {
      const cached = fnWrapperCache.get(rowKey)
      if (cached)
        return cached
      const wrapper = (row: T) => {
        const rawResult = (rowKey as (row: T) => any)(row)
        // rowKey 函数返回 undefined 时（如 GroupHeaderRow），回退到 AUTO_KEY_NAME
        // When the rowKey function returns undefined (e.g. GroupHeaderRow), fall back to AUTO_KEY_NAME
        if (rawResult === undefined && row && typeof row === 'object') {
          const autoKey = (row as Record<string, unknown>)[AUTO_KEY_NAME]
          if (autoKey !== undefined) {
            const key = String(autoKey)
            writeScopedKey(row, rowKey, key)
            return key
          }
        }
        const key = String(rawResult)
        if (row && typeof row === 'object') {
          // <zh/> 显式 key 命中时只写 WeakMap，不写行内槽：行内槽是单属性，多表共享行引用
          // <zh/> 且 rowKey 不同时会轮流覆写同一属性，触发跨表无限循环（11.1 surface 页 101 表共享
          // <zh/> surfaceData 即因此卡死）。EP 显式模式读字段本身，无需行内槽。
          // <en/> On an explicit-key hit write only the WeakMap, never the in-row slot: the slot is a
          // <en/> single property, so tables sharing row references with different rowKeys overwrite each
          // <en/> other in turn and trigger a cross-table infinite loop (this froze the 11.1 surface page
          // <en/> with 101 tables sharing surfaceData). Explicit mode reads the field itself in EP.
          writeScopedKey(row, rowKey, key)
        }
        return key
      }
      fnWrapperCache.set(rowKey, wrapper)
      return wrapper
    }
    return (row: T) => {
      // rowKey 为 string|number|symbol，按动态属性名访问
      // rowKey is string|number|symbol, accessed as a dynamic property name
      const rawKey = (row as Record<string | number | symbol, unknown>)[rowKey]
      if (rawKey === undefined && row && typeof row === 'object') {
        // 先检查本 scope 的 WeakMap 缓存，避免对已缓存的行重复触发 dev 警告；
        // 注意只读本 scope（rowKey 字段名）——跨 scope（如另一表的 auto 随机 key）不复用，
        // 否则不同 rowKey 的表格共享行引用时会串 key。行内 AUTO_KEY_NAME 回退保留
        // （兼容既有单表行为：预置 AUTO_KEY 的合成行/函数回退行仍可被识别）。
        // Check this scope's WeakMap cache first to avoid repeated dev warnings for already-cached rows.
        const cached = readScopedKey(row, rowKey)
        if (cached !== undefined) {
          safeWriteAutoKey(row, cached)
          return cached
        }

        const autoKey = (row as Record<string, unknown>)[AUTO_KEY_NAME]
        if (autoKey !== undefined) {
          const key = String(autoKey)
          writeScopedKey(row, rowKey, key)
          safeWriteAutoKey(row, key)
          return key
        }

        // 空对象（如 EMPTY_ROW）无任何 own property，生成自动 key 并静默处理
        // Empty objects (e.g. EMPTY_ROW) have no own properties — silently generate an auto key
        if (Object.keys(row).length === 0) {
          const key = generateRandomId(21)
          writeScopedKey(row, rowKey, key)
          safeWriteAutoKey(row, key)
          return key
        }
      }
      const key = String(rawKey)
      // dev 警告：rowKey 字段不存在于行对象上，所有行将共享 "undefined" 键
      // Dev warning: rowKey field does not exist on the row object, all rows will share the "undefined" key
      if (rawKey === undefined && isDev && row && typeof row === 'object') {
        const rowKeys = Object.keys(row).slice(0, 10).join(', ')
        const stack = new Error('[AdvTable] rowKey missing on row (stack capture only)').stack
        const message
          = `[AdvTable] rowKey field "${String(rowKey)}" is missing on row data. `
            + 'All rows will share the same key "undefined", causing selection, dirty tracking, and tree features to malfunction. '
            + 'Please ensure the rowKey field exists on all row objects.'
            + `\n[AdvTable] Row keys: [${rowKeys}]`
            + `\n[AdvTable] Row constructor: ${row?.constructor?.name ?? 'unknown'}`
            + `\n[AdvTable] Stack trace:\n${stack}`
        if (onWarn)
          onWarn(message)
        else if (typeof console !== 'undefined')
          devWarn(message)
      }
      if (row && typeof row === 'object') {
        // <zh/> 同函数分支：显式 key 只进 WeakMap，不争行内槽（见上，跨表同行引用会无限互写）。
        // <en/> Same as the function branch: explicit keys go to the WeakMap only, never contending
        // <en/> for the in-row slot (see above — shared row references across tables would rewrite it forever).
        writeScopedKey(row, rowKey, key)
      }
      return key
    }
  }

  // <zh/> auto scope 以 undefined 为键——与任何显式 rowKey 输入隔离
  // <en/> The auto scope uses undefined as its key — isolated from any explicit rowKey input
  const AUTO_SCOPE: undefined = undefined
  return (row: T) => {
    if (typeof row !== 'object' || row === null) {
      return String(row)
    }

    const cached = readScopedKey(row, AUTO_SCOPE)
    if (cached !== undefined) {
      safeWriteAutoKey(row, cached)
      return cached
    }

    const existingKey = (row as Record<string, unknown>)[AUTO_KEY_NAME]
    if (existingKey !== undefined) {
      const key = String(existingKey)
      writeScopedKey(row, AUTO_SCOPE, key)
      return key
    }

    const key = generateRandomId(21)
    writeScopedKey(row, AUTO_SCOPE, key)
    safeWriteAutoKey(row, key)
    return key
  }
}
