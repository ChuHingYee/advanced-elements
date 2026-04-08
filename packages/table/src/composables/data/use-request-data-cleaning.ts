import type { Ref } from 'vue'
import type { RowKeyMeta } from '../../types'
import { computed } from 'vue'
import { devWarn } from '../../utils/dev-warn'
import { warnOnDuplicateRowKeys } from './use-table-request-duplicate-keys'

/**
 * <zh/> 请求域数据清洗依赖 | <en/> Request-domain data-cleaning dependencies
 */
export interface UseRequestDataCleaningDeps<T> {
  /** <zh/> 是否存在 request.source（true 读 responseData，false 读 defaultData） | <en/> whether a request.source exists (true reads responseData, false reads defaultData) */
  hasSource: Ref<boolean>
  /** <zh/> useRequest 的响应数据 | <en/> response data from useRequest */
  responseData: Ref<T[]>
  /** <zh/> 无 source 时的默认数据 getter（如 props.data） | <en/> default-data getter when no source (e.g. props.data) */
  defaultData?: () => T[]
  /** <zh/> 行键函数 getter | <en/> row-key function getter */
  rowKeyFn: () => (row: T) => string
  /** <zh/> 树形子节点字段 getter | <en/> tree children-key getter */
  childrenKey?: () => string | undefined
}

/**
 * <zh/> 请求域数据清洗——脏行剔除与 rowKeyMeta 双 Map 构建单趟完成，产出 tableData/rowKeyMeta。
 *
 * <zh/> 自 use-table-request.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 C 域内子模块化），
 * <zh/> 依赖经 deps 显式下发，函数体逐字未改。
 * <en/> Request-domain data cleaning — dirty-row sweep and rowKeyMeta dual-Map build in one pass,
 * <en/> producing tableData/rowKeyMeta.
 *
 * <en/> Migrated verbatim from use-table-request.ts (COMPLEXITY-PLAN battle line 3, knife C:
 * <en/> in-domain sub-modules); dependencies are passed explicitly via deps, bodies unchanged.
 */
export function useRequestDataCleaning<T>(deps: UseRequestDataCleaningDeps<T>) {
  const { hasSource, responseData, defaultData, rowKeyFn, childrenKey } = deps

  // <zh/> 脏行剔除与 rowKeyMeta 双 Map 构建在同一趟遍历内完成，热路径保持单趟 O(n)；
  // <zh/> 无脏行且结构未变时复用 prev（引用稳定）；同引用原地 push/splice/reverse 会改变
  // <zh/> 长度/索引/行身份，必须重算并产出新引用，否则下游虚拟表（仅监听引用变化 reset）
  // <zh/> 与 rowKeyMeta 会保留旧索引。注意：early-return 必须在追踪数组内容之后，
  // <zh/> 否则 computed 永远订阅不到数组内部变更。
  // <en/> the dirty-row sweep and the rowKeyMeta dual-Map build happen in a single traversal, keeping the
  // <en/> hot path at one O(n) pass; when clean, `cleaned` reuses the original array reference so downstream
  // <en/> computeds stay reference-stable. The tree branch (childrenKey) recurses to build the maps in the
  // <en/> same pass, but `cleaned` collects top-level rows only — flattening is owned by the downstream
  // <en/> useTreeData, so a flattened array here would double-flatten (duplicate rows).
  const cleanedAndMeta = computed<{ cleaned: T[], meta: RowKeyMeta<T> }>((prev) => {
    const raw = hasSource.value
      ? responseData.value
      : (defaultData?.() ?? [])
    const arr = Array.isArray(raw) ? raw : []
    const keyFn = rowKeyFn()
    const cKey = childrenKey?.()
    // <zh/> 先订阅数组结构：长度 + 每一项引用。原地 push/splice/reverse 都会使本 computed 失效重算。
    // <en/> Subscribe to the array structure first so in-place mutations invalidate this computed.
    const arrLength = arr.length
    const prevCache = prev as unknown as { rawRef?: unknown, keyFn?: unknown, cKey?: unknown, arrLength?: number } | undefined
    const canFastPath = !!prev
      && prevCache?.rawRef === arr
      && prevCache?.keyFn === keyFn
      && prevCache?.cKey === cKey
      && prevCache?.arrLength === arrLength
    if (canFastPath) {
      // <zh/> 同引用且长度不变仍需验证行身份/顺序（reverse/sort/同长度替换场景），
      // <zh/> 逐项比对引用：全等才可复用 prev，否则落入下方全量重建。
      // <en/> Same reference + same length still needs identity/order verification:
      // <en/> reuse prev only when every element matches, otherwise fall through to the full rebuild.
      const prevMeta = (prev as unknown as { meta: RowKeyMeta<T> }).meta
      let identical = true
      if (cKey) {
        // <zh/> 树形场景做轻量校验：顶层引用序列一致即复用，深层变更由展平层处理
        // <en/> Tree case verifies only the top-level reference sequence; deeper changes belong to the flattening layer
        const prevRows = prevMeta.dataRef
        if (prevRows.length !== arrLength) {
          identical = false
        }
        else {
          for (let i = 0; i < arrLength; i++) {
            if ((prevRows[i] as unknown) !== (arr[i] as unknown)) {
              identical = false
              break
            }
          }
        }
      }
      else {
        const prevRows = (prev as unknown as { cleaned: T[] }).cleaned
        if (prevRows.length !== arrLength) {
          identical = false
        }
        else {
          for (let i = 0; i < arrLength; i++) {
            if ((prevRows[i] as unknown) !== (arr[i] as unknown)) {
              identical = false
              break
            }
          }
        }
      }
      if (identical)
        return prev
    }
    const keyToRow = new Map<string, T>()
    const keyToIndex = new Map<string, number>()
    let dirtyCount = 0
    // <zh/> 惰性建 cleaned：首个空洞前零分配，全程无洞则保持 `arr` 原引用（下游引用稳定）。
    // <en/> Lazy cleaned: zero allocation before the first hole; stays `arr` when no hole exists (stable ref downstream).
    let cleaned: T[] | null = null
    if (cKey) {
      let rowIndex = 0
      // <zh/> 顶层空洞计入脏行并移出 cleaned；嵌套空洞仅跳过（保留在子数组中，属既有不支持形态，不计入告警）
      // <en/> Top-level holes count as dirty and leave cleaned; nested holes are only skipped (kept in the child
      // <en/> array — a pre-existing unsupported shape — and deliberately not counted in the warning).
      const walk = (items: unknown[], topLevel: boolean) => {
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          if (item === null || item === undefined) {
            if (topLevel) {
              dirtyCount++
              if (cleaned === null)
                cleaned = items.slice(0, i) as T[]
            }
            continue
          }
          const row = item as T
          if (topLevel) {
            const acc = cleaned
            if (acc !== null)
              acc.push(row)
          }
          const key = keyFn(row)
          keyToRow.set(key, row)
          keyToIndex.set(key, rowIndex++)
          const children = (row as Record<string, unknown>)[cKey]
          if (Array.isArray(children))
            walk(children, false)
        }
      }
      walk(arr as unknown[], true)
    }
    else {
      for (let i = 0; i < arr.length; i++) {
        const row = arr[i]
        if (row === null || row === undefined) {
          dirtyCount++
          if (cleaned === null)
            cleaned = arr.slice(0, i) as T[]
          continue
        }
        const acc = cleaned
        if (acc !== null)
          acc.push(row as T)
        const key = keyFn(row as T)
        keyToRow.set(key, row as T)
        // <zh/> 无空洞时索引即原位置，有空洞后即 cleaned 内位置 | <en/> index is the original position until a hole, then the position within cleaned
        keyToIndex.set(key, acc === null ? i : acc.length - 1)
      }
    }
    let cleanedRows: T[] = cleaned ?? (arr as T[])
    // <zh/> 同引用原地变更走到这里说明结构已变：必须产出新数组引用，否则下游
    // <zh/> tableData（prev === next 短路）与 EP V2（仅引用变化 reset）都感知不到。
    // <en/> Reaching here with the same reference means the structure changed: a new array
    // <en/> reference is required, otherwise tableData (prev === next short-circuit) and
    // <en/> EP V2 (reset on reference change only) never observe the change.
    if (cleaned === null && prevCache?.rawRef === arr)
      cleanedRows = (arr as T[]).slice()
    if (dirtyCount > 0) {
      devWarn(
        `[AdvTable] Dropped ${dirtyCount} null/undefined row(s) from table data. `
        + 'Rows must be objects; null entries cannot be keyed, selected, or rendered.',
      )
    }
    warnOnDuplicateRowKeys(cleanedRows, keyFn, cKey)
    const meta: RowKeyMeta<T> = { keyToRow, keyToIndex, keyFn, dataRef: cleanedRows }
    const next = { cleaned: cleanedRows, meta } as unknown as { cleaned: T[], meta: RowKeyMeta<T>, rawRef: unknown, keyFn: unknown, cKey: unknown, arrLength: number }
    next.rawRef = arr
    next.keyFn = keyFn
    next.cKey = cKey
    next.arrLength = arrLength
    return next as unknown as { cleaned: T[], meta: RowKeyMeta<T> }
  })

  const tableData = computed<T[]>((prev) => {
    /**
     * <zh/> manual 模式下也读 responseData——消费者通过 setResponseData/v-model 回流写入，
     * <zh/> 此处读取它使数据写回链路闭合。
     * <en/> Read responseData in manual mode too — consumers write back via setResponseData/v-model;
     * <en/> reading it here closes the data write-back loop.
     */
    const next = cleanedAndMeta.value.cleaned
    if (prev && prev === next)
      return prev
    return next
  })

  // <zh/> 行键元信息——与 tableData 同源，由 cleanedAndMeta 单趟产出；prev 守卫覆盖 rawRef/keyFn/cKey，
  // <zh/> 且 cleaned 复用原数组引用使 tableData 保持稳定，故无需按数组引用的二级缓存。
  // <en/> Row-key meta — produced by the same single pass as tableData via cleanedAndMeta; the prev guard
  // <en/> covers rawRef/keyFn/cKey and cleaned reuses the original array reference, so no array-ref
  // <en/> secondary cache is needed.
  const rowKeyMeta = computed<RowKeyMeta<T>>((prev) => {
    const next = cleanedAndMeta.value.meta
    if (prev && prev === next)
      return prev
    return next
  })

  return { tableData, rowKeyMeta }
}
