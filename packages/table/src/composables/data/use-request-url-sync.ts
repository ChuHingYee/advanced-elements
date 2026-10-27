import type { Ref } from 'vue'
import type { PaginationEffectsReturn } from './pagination-effects'

/**
 * <zh/> URL↔分页同步所需的最小分页形态（结构性依赖，避免整包类型耦合） | <en/> Minimal pagination shape for URL↔pagination sync (structural dep, no whole-type coupling)
 */
export interface UrlSyncPagination {
  currentPage: Ref<number>
  pageSize: Ref<number>
  isClient: Ref<boolean>
}

/**
 * <zh/> URL 同步依赖 | <en/> URL-sync dependencies
 */
export interface UseRequestUrlSyncDeps {
  /** <zh/> useUrlState 的 URL 读取器 | <en/> URL reader from useUrlState */
  initFromUrl: () => { page?: number, size?: number }
  pagination: UrlSyncPagination
  applyPaginationEffects: PaginationEffectsReturn['applyPaginationEffects']
}

/**
 * <zh/> 请求域的 URL↔分页同步——静默初同步（onBeforeMount 用）与带副作用扇出的重同步（KeepAlive 重激活用）。
 *
 * <zh/> 自 use-table-request.ts 原样迁出（COMPLEXITY-PLAN 战线三，刀法 C 域内子模块化），
 * <zh/> 函数体逐字未改。
 * <en/> Request-domain URL↔pagination sync — silent initial sync (for onBeforeMount) and
 * <en/> effect-fanning resync (for KeepAlive reactivation).
 *
 * <en/> Migrated verbatim from use-table-request.ts (COMPLEXITY-PLAN battle line 3, knife C:
 * <en/> in-domain sub-modules); function bodies unchanged.
 */
export function createRequestUrlSync(deps: UseRequestUrlSyncDeps) {
  const { initFromUrl, pagination, applyPaginationEffects } = deps

  /**
   * <zh/> 从 URL 状态同步分页参数的公共函数——消除 onBeforeMount 与 onActivated 中的重复 | <en/> Common function to sync pagination params from URL state — eliminates duplication between onBeforeMount and onActivated
   *
   * <zh/> 静默写入，仅用于 onBeforeMount 初始同步——首请求在 onMounted 统一发起，
   * <zh/> 此处若走副作用扇出会与初始请求重复（双发 fetch / 双发 pageChange）。
   * <en/> Silent write, only for the onBeforeMount initial sync — the first request fires once in
   * <en/> onMounted; fanning out effects here would duplicate it (double fetch / double pageChange).
   */
  function syncPaginationFromUrl(): void {
    const { page: p, size: s } = initFromUrl()
    if (p)
      pagination.currentPage.value = p
    if (s)
      pagination.pageSize.value = s
  }

  /**
   * <zh/> KeepAlive 重新激活时的 URL 分页同步——带副作用扇出。
   * <zh/> page/size 任一变化时合成一次分页变更结果走 applyPaginationEffects
   * <zh/>（URL 记录 + pageChange 事件 + 服务端重取）；两者同变仅扇出一次，避免双发请求；
   * <zh/> 均无变化时零操作，不产生多余请求与事件。
   * <en/> URL pagination sync on KeepAlive reactivation — with effect fan-out.
   * <en/> When page and/or size changed, synthesizes one pagination-change result through
   * <en/> applyPaginationEffects (URL log + pageChange emit + server refetch); simultaneous
   * <en/> page+size changes fan out exactly once to avoid double requests; no change means no-op.
   */
  function resyncPaginationFromUrl(): void {
    const { page: p, size: s } = initFromUrl()
    const sizeChanged = !!s && s !== pagination.pageSize.value
    const pageChanged = !!p && p !== pagination.currentPage.value
    if (!sizeChanged && !pageChanged)
      return
    if (sizeChanged)
      pagination.pageSize.value = s
    if (pageChanged)
      pagination.currentPage.value = p
    applyPaginationEffects({
      page: pagination.currentPage.value,
      size: pagination.pageSize.value,
      reason: 'pageChange',
      isClient: pagination.isClient.value,
      needsReset: sizeChanged,
    })
  }

  return { syncPaginationFromUrl, resyncPaginationFromUrl }
}
