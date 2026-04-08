/**
 * <zh/> 浅层相等比较——支持基本类型（含 NaN 值语义）、Date、数组与普通对象 | <en/> Shallow equality — supports primitives (incl. NaN semantics), Dates, arrays and plain objects
 *
 * @remarks
 * <zh/> 全库唯一实现：
 * <zh/> - 基本类型走 `===` 快路径；NaN 与 NaN 按 SameValueZero 视为相等（否则重复提交 NaN
 * <zh/>   每次都被误判"已变更"）；null/类型不一致返回 false
 * <zh/> - Date 按时间戳值语义比较——两个 Date 无自有可枚举属性，走空对象分支即误判
 * <zh/>   "恒相等"，选择不同日期的编辑会被当作"未变更"静默丢弃（变更漏检）
 * <zh/> - 数组按长度 + 逐元素浅比较（元素经同一规则递归，Date/嵌套数组获得值语义；
 * <zh/>   循环引用安全：共享引用被 `===` 快路径拦截）
 * <zh/> - 对象按键数 + `Object.hasOwn` 键存在性 + 值浅比较（比纯取值比较更严格：
 * <zh/>   `{ a: undefined }` 与 `{}` 不再误判相等）
 * <zh/> 用于 computed prev-stability 优化与编辑提交的值变更检测。
 * <en/> The single canonical implementation: primitives short-circuit via `===`; NaN equals
 * <en/> NaN (SameValueZero — otherwise repeated NaN commits were misjudged as "changed"); arrays compare
 * <en/> by length + per-element shallow compare; Dates compare by timestamp (two Dates carry no own
 * <en/> enumerable props and hit the empty-object branch as equal, silently dropping a changed date
 * <en/> edit as "unchanged"); objects compare by key count + `Object.hasOwn` presence +
 * <en/> shallow value compare (`{ a: undefined }` vs `{}` no longer false-positive equal).
 * <en/> Used for computed prev-stability optimization and edit value-change detection.
 *
 * @param a - <zh/> 第一个值 | <en/> first value
 * @param b - <zh/> 第二个值 | <en/> second value
 * @returns <zh/> 相等时返回 true | <en/> true when equal
 */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b)
    return true
  // <zh/> NaN 值语义（SameValueZero） | <en/> NaN value semantics (SameValueZero)
  if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b))
    return true
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object')
    return false
  // <zh/> Date 值语义：混合类型（Date vs 非 Date）不相等 | <en/> Date value semantics; mixed types are unequal
  if (a instanceof Date || b instanceof Date)
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length)
      return false
    return a.every((v, i) => shallowEqual(v, b[i]))
  }
  if (Array.isArray(a) !== Array.isArray(b))
    return false
  const aObj = a as Record<string, unknown>
  const bObj = b as Record<string, unknown>
  const keysA = Object.keys(aObj)
  const keysB = Object.keys(bObj)
  if (keysA.length !== keysB.length)
    return false
  return keysA.every(k => Object.hasOwn(bObj, k) && shallowEqual(aObj[k], bObj[k]))
}

/**
 * <zh/> 一级值相等比较——逐 key 比较，属性值经 JSON 序列化后按值语义比较。
 * <zh/> 适用于属性值为纯数据对象（如筛选状态 ColumnFilterValue）的场景：
 * <zh/> setFilter 每次调用都会展开生成新对象，引用比较无法识别"重复写入等值筛选"，
 * <zh/> 值比较可避免由此触发的多余副作用（如远程模式下的冗余 refetch）。
 * <zh/> 注意：仅适用于可 JSON 序列化且键序稳定的数据；含函数/循环引用的值不适用。
 *
 * <en/> Top-level value-equality check — compares per key with values serialized via JSON (value semantics, not reference).
 * <en/> Suitable for states whose values are plain data objects (e.g. ColumnFilterValue):
 * <en/> setFilter spreads a new object on every call, so reference comparison cannot detect
 * <en/> "re-applying an identical filter value"; value comparison avoids redundant side effects
 * <en/> triggered by such no-op writes (e.g. spurious remote refetches).
 * <en/> Note: only for JSON-serializable values with stable key order; functions/circular refs are unsupported.
 *
 * @param a - <zh/> 第一个对象 | <en/> first object
 * @param b - <zh/> 第二个对象 | <en/> second object
 * @returns <zh/> 属性数量和所有属性值（序列化后）相等时返回 true | <en/> true when key count and all serialized values match
 */
export function shallowEqualByValue<T extends object>(a: T, b: T): boolean {
  const aR = a as Record<string, unknown>
  const bR = b as Record<string, unknown>
  const keysA = Object.keys(aR)
  if (keysA.length !== Object.keys(bR).length)
    return false
  for (const key of keysA) {
    if (JSON.stringify(aR[key]) !== JSON.stringify(bR[key]))
      return false
  }
  return true
}

/**
 * <zh/> Map 逐键浅比较——computed prev 引用稳定性短路的单一共享实现。
 * <zh/> 默认判据：`a === b` 快路径；size 不等返回 false；逐键检查 `b` 是否拥有该键，
 * <zh/> 且值经 `valueEqual`（缺省为 `===` 引用比较）判等，全部相等返回 true。
 * <zh/> 用于替代散落在筛选枚举缓存、渲染域 key→index、列映射、汇总值等处的
 * <zh/> "先比 size、再逐键对比"同构模板，避免漂移。
 *
 * <en/> Map per-key shallow equality — the single shared implementation behind computed
 * <en/> prev reference-stability short-circuits. Default criterion: `a === b` fast path; size
 * <en/> mismatch returns false; per-key it verifies `b` owns the key and the values are equal
 * <en/> via `valueEqual` (default `===` reference compare), returning true when all match.
 * <en/> Replaces the duplicated size-then-per-key template previously scattered across the
 * <en/> filter enum cache, render-domain key→index, column maps and summary values.
 *
 * @param a - <zh/> 旧 Map（可为 undefined，表示首次计算无 prev） | <en/> previous Map (undefined on first computation)
 * @param b - <zh/> 新 Map | <en/> new Map
 * @param valueEqual - <zh/> 可选值比较器；缺省按 `===` 引用比较 | <en/> optional value comparator; defaults to `===` reference equality
 * @returns <zh/> 相等时返回 true | <en/> true when equal
 */
export function mapsShallowEqual<V>(
  a: Map<string, V> | undefined,
  b: Map<string, V>,
  valueEqual?: (av: V, bv: V) => boolean,
): boolean {
  if (a === b)
    return true
  if (!a || a.size !== b.size)
    return false
  for (const [k, v] of a) {
    if (!b.has(k))
      return false
    const bv = b.get(k) as V
    if (valueEqual ? !valueEqual(v, bv) : v !== bv)
      return false
  }
  return true
}
