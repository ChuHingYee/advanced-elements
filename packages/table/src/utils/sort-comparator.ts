/**
 * <zh/> 排序值比较函数 —— 主线程与 Worker 共享的核心比较逻辑。
 * <en/> Sort-value comparator — the core comparison logic shared by the main thread and the Worker.
 *
 * <zh/> 统一 null/undefined 处理、数字比较和字符串比较规则：
 * <zh/> - null/undefined 始终排末尾（不受排序方向影响）
 * <zh/> - 数字使用算术减法；NaN 按相等处理（返回 NaN 即违反比较器契约，导致排序结果由引擎实现定义）
 * <zh/> - Date 使用时间戳数值比较（落入字符串分支即按英文日期串字典序乱排）
 * <zh/> - 字符串优先使用 Intl.Collator（区域感知，修复重音字符错排与数字串字典序问题），
 *   环境不支持时回退到字典序比较
 * <zh/> 通过 multiplier 控制升序(1)/降序(-1)。
 *
 * <en/> Unifies null/undefined handling, number and string comparison:
 * <en/> - null/undefined always sort last (direction-independent)
 * <en/> - numbers use arithmetic subtraction; NaN compares as equal (returning NaN violates
 *   the comparator contract and leaves order implementation-defined)
 * <en/> - Date instances compare numerically by timestamp (falling into the string branch
 *   sorts by English date-string lexicographic garbage)
 * <en/> - strings prefer Intl.Collator (locale-aware, fixes accented-character misordering and
 *   digit-string lexicographic issue), falling back to plain lexicographic when unavailable
 * <en/> multiplier controls ascending(1)/descending(-1).
 */

/**
 * <zh/> 按 locale 记忆化的 Collator 实例——构造开销大，同一 locale 只建一次；
 * <zh/> 运行期切换 locale 时为新 locale 新建实例，不影响已缓存项（单例会永久锁定首次 locale）。
 * <zh/> `sensitivity: 'variant'` 保留大小写区分（最接近原字典序语义）；
 * <zh/> `numeric: true` 使 "10" > "9" 按数值而非首字符排序。
 * <en/> Per-locale memoized Collator instances — construction is expensive, one per locale;
 * <en/> switching locale at runtime builds a new entry without disturbing cached ones
 * <en/> (a singleton would pin the first-seen locale forever).
 * <en/> `sensitivity: 'variant'` keeps case distinction (closest to the original lexicographic semantics);
 * <en/> `numeric: true` makes "10" > "9" sort numerically instead of by first character.
 */
const collatorCache = new Map<string, Intl.Collator | null>()

function getCollator(locale?: string): Intl.Collator | null {
  const key = locale ?? ''
  const cached = collatorCache.get(key)
  if (cached !== undefined)
    return cached
  let collator: Intl.Collator | null = null
  try {
    collator
      = typeof Intl !== 'undefined' && typeof Intl.Collator === 'function'
        ? new Intl.Collator(locale, { numeric: true, sensitivity: 'variant' })
        : null
  }
  catch {
    // 极端环境下 Collator 构造可能抛出（如受限 ICU），回退到字典序
    // Collator construction can throw in constrained environments (restricted ICU), fall back to lexicographic
    collator = null
  }
  collatorCache.set(key, collator)
  return collator
}

/**
 * <zh/> 排序值比较函数 —— 统一 null/undefined、Date、数字与字符串的比较规则（详见文件头说明）。
 * <en/> Sort-value comparator — unified null/undefined, Date, number and string comparison rules (see the file header for details).
 *
 * @param valueA - <zh/> 第一个比较值 | <en/> first value to compare
 * @param valueB - <zh/> 第二个比较值 | <en/> second value to compare
 * @param multiplier - <zh/> 排序方向乘数：升序为 1，降序为 -1 | <en/> sort-direction multiplier: 1 for ascending, -1 for descending
 * @returns <zh/> 负数表示 A 在前，正数表示 B 在前，0 表示相等 | <en/> negative means A first, positive means B first, 0 means equal
 */
export function compareSortValues(
  valueA: unknown,
  valueB: unknown,
  multiplier: number,
): number {
  // <zh/> multiplier 归一：仅 ±1 有效，非标准输入钳为 1，避免返回 NaN/0 破坏比较器契约（V8 顺序实现定义）
  // <en/> Normalize the multiplier: only ±1 is valid; clamp anything else to 1 so NaN/0 never escapes and violates the comparator contract
  const dir = multiplier === -1 ? -1 : 1
  if (valueA == null && valueB == null)
    return 0
  // null/undefined 始终排末尾，不受排序方向影响
  // null/undefined always sort last, independent of sort direction
  if (valueA == null)
    return 1
  if (valueB == null)
    return -1

  // Date 双端均为 Date 实例时按时间戳数值比较；Date 与字符串混合时落入下方字符串分支（按 locale 感知比较，不做日期解析）
  // Pairs of Date instances compare numerically by timestamp; Date/string mixes fall into the string branch below (locale-aware comparison, no date parsing)
  if (valueA instanceof Date && valueB instanceof Date) {
    const result = (valueA.getTime() - valueB.getTime()) * dir
    if (!Number.isNaN(result) && result !== 0)
      return result
    return 0
  }

  if (typeof valueA === 'number' && typeof valueB === 'number') {
    const result = (valueA - valueB) * dir
    /**
     * <zh/> NaN 守卫：数据含 NaN 时减法结果为 NaN，`NaN !== 0` 恒真导致比较器返回 NaN，
     * <zh/> 违反比较器契约（V8 中排序顺序变为实现定义）。NaN 视为相等交由后续稳定排序。
     * <en/> NaN guard: subtraction with NaN yields NaN, and `NaN !== 0` is always true so the
     * <en/> comparator returned NaN — violating the comparator contract (order becomes
     * <en/> engine-defined in V8). Treat NaN as equal and rely on stable sort afterwards.
     */
    if (Number.isNaN(result))
      return 0
    if (result !== 0)
      return result
  }
  else {
    const collator = getCollator()
    if (collator) {
      const result = collator.compare(String(valueA), String(valueB)) * dir
      if (result !== 0)
        return result
    }
    else {
      const strA = String(valueA)
      const strB = String(valueB)
      const result = strA < strB ? -1 * dir : strA > strB ? 1 * dir : 0
      if (result !== 0)
        return result
    }
  }
  return 0
}
