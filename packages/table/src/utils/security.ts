/**
 * @file security.ts
 * @description
 * <zh/> 安全工具——原型污染防御与敏感列数据保护。
 *
 * <zh/> **防护策略**：
 * <zh/> 1. 原型污染防御：在数据进入管线前扫描每行，清除 `__proto__`/`constructor`/`prototype` 键
 * <zh/> 2. 敏感列保护：导出/复制时排除标记为 `sensitive: true` 的列，防止数据泄露
 * <zh/> 3. 使用 Object.create(null) 创建安全的行副本，避免原型链查找
 *
 * <en/> Security utilities — prototype pollution defense and sensitive column data protection.
 *
 * <en/> **Defense strategy**:
 * <en/> 1. Prototype pollution defense: scan each row before entering pipeline, strip `__proto__`/`constructor`/`prototype` keys
 * <en/> 2. Sensitive column protection: exclude columns marked `sensitive: true` during export/copy, preventing data leakage
 * <en/> 3. Use Object.create(null) for safe row copies, avoiding prototype chain lookups
 */

/**
 * <zh/> 需要清除的危险属性名集合 | <en/> Set of dangerous property names to strip
 */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/**
 * <zh/> 检测行数据是否包含原型污染键 | <en/> Detect whether row data contains prototype pollution keys
 *
 * @param row - <zh/> 行数据对象 | <en/> row data object
 * @returns <zh/> 检测到的危险键数组（空数组表示安全） | <en/> array of dangerous keys found (empty = safe)
 */
export function detectPrototypePollution(row: unknown): string[] {
  if (row == null || typeof row !== 'object')
    return []
  const found: string[] = []
  const obj = row as Record<string, unknown>
  for (const key of DANGEROUS_KEYS) {
    // <zh/> 必须用自有属性检查——`in` 会命中继承链（每个普通对象都有继承的
    // <zh/> __proto__/constructor），导致所有行被误判为污染、零变更快路径永久失效。
    // <zh/> 真实攻击载荷（如 JSON.parse 的 "__proto__"）恰为自有可枚举键，自有检查即可拦截。
    // <en/> Must check own properties — `in` walks the prototype chain (every plain object
    // <en/> inherits __proto__/constructor), flagging ALL rows as polluted and permanently
    // <en/> disabling the zero-change fast path. Real payloads (e.g. JSON.parse "__proto__")
    // <en/> are own enumerable keys, fully caught by the own-property check.
    if (Object.hasOwn(obj, key))
      found.push(key)
  }
  return found
}

/**
 * <zh/> 安全地清除行数据中的原型污染键，返回清理后的新对象 | <en/> Safely strip prototype pollution keys from row data, returning a new clean object
 *
 * <zh/> 使用 `Object.create(null)` 创建无原型链的安全对象副本，
 * <zh/> 仅复制非危险键，并跳过值为 `undefined` 的属性（`null` 为显式空值予以保留，满足 `emptyValue: null` 数值列语义）。
 *
 * @param row - <zh/> 原始行数据 | <en/> original row data
 * @param onDetected - <zh/> 检测到危险键时的回调 | <en/> callback when dangerous keys are detected
 * @returns <zh/> 清理后的安全行数据对象 | <en/> clean safe row data object
 */
export function sanitizeRow<T extends Record<string, unknown>>(
  row: T,
  onDetected?: (keys: string[]) => void,
): T {
  if (row == null || typeof row !== 'object')
    return row

  const dangerousKeys = detectPrototypePollution(row)
  if (dangerousKeys.length === 0)
    return row

  onDetected?.(dangerousKeys)

  // 使用 Object.create(null) 创建安全副本——无原型链
  // Use Object.create(null) for safe copy — no prototype chain
  const safe = Object.create(null) as Record<string, unknown>

  for (const key of Object.keys(row)) {
    if (!DANGEROUS_KEYS.has(key)) {
      const value = row[key]
      if (value !== undefined)
        safe[key] = value
    }
  }

  // 保持与原始 T 类型兼容
  // Maintain compatibility with original T type
  return safe as T
}

/**
 * <zh/> 批量清除数据数组中的原型污染键 | <en/> Batch sanitize an array of rows from prototype pollution keys
 *
 * @param data - <zh/> 行数据数组 | <en/> row data array
 * @param onDetected - <zh/> 检测到危险键时的回调 | <en/> callback when dangerous keys are detected
 * @returns <zh/> 清理后的安全数据数组（引用不变则返回原数组） | <en/> clean safe data array (returns original ref if unchanged)
 */
export function sanitizeDataArray<T extends Record<string, unknown>>(
  data: T[],
  onDetected?: (rowIndex: number, keys: string[]) => void,
): T[] {
  let modified = false
  const result: T[] = Array.from({ length: data.length })

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    const dangerousKeys = detectPrototypePollution(row)
    if (dangerousKeys.length === 0) {
      result[i] = row
    }
    else {
      onDetected?.(i, dangerousKeys)
      result[i] = sanitizeRow(row)
      modified = true
    }
  }

  return modified ? result : data
}

/**
 * <zh/> 列级敏感列剥离结果 | <en/> Column-level sensitive-stripping result
 */

/**
 * <zh/> 链接协议白名单——仅允许安全的 URL 协议进入 `href` | <en/> Safe protocol whitelist — only these protocols may enter an `href`
 *
 * <zh/> 明确排除 `javascript:`/`data:`/`vbscript:` 等可执行协议，
 * <zh/> 防止单元格数据直接成为 `<a href>` 时的脚本注入（XSS）。
 * <en/> Explicitly excludes executable protocols (`javascript:`/`data:`/`vbscript:` etc.)
 * <en/> to prevent script injection (XSS) when cell data is bound directly to `<a href>`.
 */
const SAFE_URL_PROTOCOLS = new Set(['http', 'https', 'mailto', 'tel'])

/**
 * <zh/> 可执行协议黑名单——纵深防御的第二道关。即使白名单被误扩充（如误加入 `data`），
 * <zh/> 本集合仍会拦截 `javascript:`/`data:`/`vbscript:` 等可执行协议，杜绝脚本注入。
 * <en/> Executable protocol denylist — a second line of defense in depth. Even if the whitelist
 * <en/> is mistakenly expanded (e.g. `data` accidentally added), this set still blocks
 * <en/> `javascript:`/`data:`/`vbscript:` etc., preventing script injection.
 */
const DENIED_URL_PROTOCOLS = new Set(['javascript', 'data', 'vbscript'])

/**
 * <zh/> URL 协议前缀正则——提升至模块作用域，避免每次调用重新编译 | <en/> URL scheme regex — hoisted to module scope to avoid per-call recompilation
 */
const URL_SCHEME_RE = /^([a-z][a-z0-9+.-]*):/i

/**
 * <zh/> 净化链接地址：仅放行白名单协议与相对地址，其余一律降级为空串。
 * <en/> Sanitize a link URL: only whitelisted protocols and relative URLs pass; everything else degrades to ''.
 *
 * @param url - <zh/> 待净化的地址（可能来自不可信的单元格数据） | <en/> raw URL (may come from untrusted cell data)
 * @returns <zh/> 安全地址；不安全时返回空串（调用方应据此回退为纯文本） | <en/> safe URL, or '' when unsafe (caller should fall back to plain text)
 */
export function sanitizeUrl(url: unknown): string {
  if (typeof url !== 'string')
    return ''
  const trimmed = url.trim()
  if (trimmed === '')
    return ''

  // <zh/> 相对地址（#/./? 或无 scheme）直接放行 | <en/> relative URLs pass through as-is
  // <zh/> 用正则而非 new URL 解析——后者对 "javascript:alert(1)" 这类输入仍会成功解析出 javascript 协议，
  // <zh/> 且对任意相对串会抛异常；正则一次匹配同时覆盖两种情况且零分配。
  // <en/> Regex instead of new URL — the latter still parses "javascript:alert(1)" successfully,
  // <en/> and throws on arbitrary relative strings; one regex covers both cases with zero allocation.
  const schemeMatch = URL_SCHEME_RE.exec(trimmed)
  if (!schemeMatch)
    return trimmed

  // <zh/> 白名单/黑名单键不含冒号，与捕获组（scheme 名）对齐 | <en/> whitelist/denylist keys are bare scheme names matching capture group
  const scheme = schemeMatch[1]!.toLowerCase()
  // <zh/> 先过黑名单（显式拒绝可执行协议），再过白名单（仅放行已知安全协议） | <en/> denylist first (explicit reject), then whitelist (allow only known-safe)
  if (DENIED_URL_PROTOCOLS.has(scheme))
    return ''
  return SAFE_URL_PROTOCOLS.has(scheme) ? trimmed : ''
}
/**
 * <zh/> 表格公式（CSV/TSV Injection）危险前缀——以这些字符开头的单元格值粘贴进
 * <zh/> Excel / LibreOffice / Google Sheets 时会被当作公式执行（如 `=cmd|'/c calc'!A1`）。
 * <en/> Spreadsheet formula (CSV/TSV injection) dangerous prefixes — cell values starting with
 * <en/> these characters are executed as formulas when pasted into Excel / LibreOffice / Google
 * <en/> Sheets (e.g. `=cmd|'/c calc'!A1`).
 */
const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/

/**
 * <zh/> 纯数字检测正则——整数/小数/正负号/科学计数法（含 `.5`、`-.5`、`1e-3` 等形态）
 * <en/> Pure numeric detection — integers/decimals/signs/scientific notation (incl. `.5`, `-.5`, `1e-3`)
 */
const NUMERIC_VALUE_RE = /^[+-]?(\d+(\.\d+)?|\.\d+)(e[+-]?\d+)?$/i

/**
 * <zh/> 中和表格公式注入——危险前缀开头的值前置单引号，强制表格软件以文本解析。
 *
 * <zh/> **纯数字豁免**：`-123` 这类负数在表格软件中本就解析为数值，不存在注入面；
 * <zh/> 若误加 `'` 前缀会变成字面文本，破坏数据保真。
 *
 * @param value - <zh/> 待中和的字符串 | <en/> string to neutralize
 * @returns <zh/> 中和后的字符串（危险前缀前加 `'`）；非危险值原样返回 | <en/> neutralized string (`'` prepended for dangerous prefixes); non-dangerous values returned as-is
 *
 * @remarks
 * <zh/> 本函数从 `export-csv.ts` 提升至此——剪贴板复制/粘贴与 CSV 导出是同一类
 * <zh/> "数据离开表格、进入电子表格软件"的出口，必须共用同一套判定语义，
 * <zh/> 否则会出现"导出安全但复制不安全"的防护缺口。
 * <en/> Promoted here from `export-csv.ts` — clipboard copy/paste and CSV export are the same
 * <en/> class of exit ("data leaves the table and enters a spreadsheet app") and MUST share one
 * <en/> decision semantics, otherwise a gap opens where export is safe but copy is not.
 *
 * @example
 * neutralizeFormulaInjection('=1+1') // => "'=1+1"
 * neutralizeFormulaInjection('-123') // => "-123"（纯数字豁免 | numeric exemption）
 */
export function neutralizeFormulaInjection(value: string): string {
  if (typeof value !== 'string' || value === '')
    return value
  if (!FORMULA_PREFIX_RE.test(value))
    return value
  if (NUMERIC_VALUE_RE.test(value))
    return value
  return `'${value}`
}

export interface StripSensitiveColumnsResult<C> {
  /** <zh/> 安全列子集（已剔除 sensitive 列） | <en/> safe column subset (sensitive columns removed) */
  safeColumns: C[]
  /** <zh/> 被剔除的敏感列 prop 列表（用于告警与可观测性） | <en/> stripped sensitive column props (for warnings/observability) */
  strippedProps: string[]
}

/**
 * <zh/> 从列配置中剥离敏感列（sensitive: true 且带 prop 的列）。
 * <en/> Strip sensitive columns (marked sensitive: true with a prop) from column configs.
 *
 * <zh/> 导出 / 打印 / 剪贴板复制的统一咽喉：所有"将数据带出表格"的路径都必须
 * <zh/> 经过本函数过滤，防止密码、token、身份证号等敏感字段泄露。
 * <en/> Unified choke point for export/print/clipboard: every path that carries data out of the
 * <en/> table must pass through this filter to prevent leakage of passwords/tokens/IDs etc.
 *
 * @remarks
 * <zh/> 泛型仅约束为 object 并在内部做属性窄化——避免弱类型检测导致调用方
 * <zh/> 的具体列类型（如 ProcessedColumn）被收窄丢失。
 * <en/> Generic constrained to object with internal property narrowing — avoids TypeScript's
 * <en/> weak-type detection erasing callers' concrete column types (e.g. ProcessedColumn).
 *
 * @param columns - <zh/> 全部列配置 | <en/> all column configs
 * @returns <zh/> 安全列子集 + 被剔除的 prop 列表 | <en/> safe column subset + stripped props
 */
export function stripSensitiveColumns<C extends object>(
  columns: readonly C[],
): StripSensitiveColumnsResult<C> {
  const strippedProps: string[] = []

  function stripColumn(col: C): C | null {
    const sensitive = (col as { sensitive?: unknown }).sensitive
    const prop = (col as { prop?: unknown }).prop
    if (sensitive && typeof prop === 'string') {
      strippedProps.push(prop)
      return null
    }

    const children = (col as { children?: unknown }).children
    if (!Array.isArray(children))
      return col

    let changed = false
    const safeChildren: unknown[] = []
    for (const child of children) {
      if (!child || typeof child !== 'object') {
        safeChildren.push(child)
        continue
      }
      const safeChild = stripColumn(child as C)
      if (!safeChild) {
        changed = true
        continue
      }
      if (safeChild !== child)
        changed = true
      safeChildren.push(safeChild)
    }

    return changed
      ? { ...col, children: safeChildren } as C
      : col
  }

  const safeColumns: C[] = []
  for (const col of columns) {
    const safeColumn = stripColumn(col)
    if (safeColumn)
      safeColumns.push(safeColumn)
  }
  return { safeColumns, strippedProps }
}
