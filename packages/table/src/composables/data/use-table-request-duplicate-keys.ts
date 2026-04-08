import { devWarn } from '../../utils/dev-warn'
import { isDev } from '../../utils/env'

/**
 * <zh/> 已做重复 rowKey 检查的数据引用——同一数组仅告警一次，避免翻页/排序触发重复刷屏。
 * <en/> Data references already checked for duplicate rowKeys — each array warns at most once,
 * <en/> avoiding repeated spam on pagination/sort.
 */
const duplicateCheckedData = new WeakSet<object>()

/**
 * <zh/> 重复 rowKey 抽查上限——dev 下避免万级数据全量扫描阻塞 computed。
 * <en/> Duplicate-rowKey sampling cap — avoids blocking the computed with a full scan on huge data in dev.
 */
const DUPLICATE_ROW_KEY_SAMPLE_LIMIT = 2000

/**
 * <zh/> dev 下抽查重复 rowKey——行键重复时选择/编辑/树级联静默错乱，此处一次性指出。
 *
 * <zh/> 仅扫描前 N 个顶层行（含其子树，共享同一预算）；生产零开销（`isDev` 短路 + 同一引用只查一次）。
 * <en/> Dev-only sampled duplicate-rowKey check — duplicated keys silently corrupt selection/editing/
 * <en/> tree cascade, so point it out once here.
 *
 * <en/> Scans only the first N top-level rows (including their subtrees, sharing one budget);
 * <en/> zero production cost (`isDev` short-circuit + once per reference).
 *
 * <zh/> 自 use-table-request.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 A 纯函数下沉）；
 * <zh/> WeakSet 模块级单例随迁，语义不变。
 * <en/> Migrated verbatim from use-table-request.ts (COMPLEXITY-PLAN battle line 3, knife A:
 * <en/> pure-function sinking); the module-level WeakSet singleton moves along, semantics unchanged.
 */
export function warnOnDuplicateRowKeys<T>(data: T[], keyFn: (row: T) => string, childrenKey?: string): void {
  if (!isDev || data.length < 2 || duplicateCheckedData.has(data as unknown as object))
    return
  duplicateCheckedData.add(data as unknown as object)
  const seen = new Set<string>()
  let scanned = 0
  let duplicate: string | null = null
  const visit = (row: T): boolean => {
    // <zh/> 嵌套空洞被脏行清扫刻意保留（既有不支持形态），本检查器递归进 children 时
    // <zh/> 必须跳过 null/undefined 行——否则 keyFn(null) 崩掉整个清洗 computed（渲染中断）。
    // <en/> nested holes are deliberately kept by the dirty-row sweep (unsupported legacy shape);
    // <en/> this checker recurses into children and MUST skip null/undefined rows — keyFn(null)
    // <en/> would crash the whole cleaning computed (render breakage).
    if (row == null)
      return false
    if (scanned >= DUPLICATE_ROW_KEY_SAMPLE_LIMIT)
      return true
    scanned++
    const key = keyFn(row)
    if (seen.has(key)) {
      duplicate = key
      return true
    }
    seen.add(key)
    if (childrenKey) {
      const children = (row as Record<string, unknown>)[childrenKey]
      if (Array.isArray(children)) {
        for (const child of children as T[]) {
          if (visit(child))
            return true
        }
      }
    }
    return false
  }
  for (const row of data) {
    if (visit(row))
      break
  }
  if (duplicate !== null) {
    devWarn(
      `[AdvTable] duplicate rowKey "${duplicate}" detected in table data `
      + `(first ${scanned} row(s) sampled). Duplicate keys silently corrupt selection, tree cascade, `
      + 'dirty tracking and drag targeting — please ensure rowKey uniqueness. | '
      + `检测到重复 rowKey"${duplicate}"（已抽查前 ${scanned} 行），重复行键会导致选择/树级联/脏跟踪/拖拽静默错乱，请保证 rowKey 唯一。`,
    )
  }
}
