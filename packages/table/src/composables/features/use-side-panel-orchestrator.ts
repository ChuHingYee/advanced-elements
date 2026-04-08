import type { ComputedRef } from 'vue'
import type { ColumnConfig, ColumnGroupApi, FilterConfig, FilterPanelApi } from '../../types/config'
import { computed, ref, watch } from 'vue'

/** <zh/> 侧面板编排器输入 | <en/> Side panel orchestrator input */
export interface UseSidePanelOrchestratorOptions<T = any> {
  mergedFilterConfig: ComputedRef<FilterConfig>
  filterPanelApi: FilterPanelApi
  mergedColumnConfig: ComputedRef<ColumnConfig<T>>
  columnGroupApi: ColumnGroupApi
}

export type PanelType = 'filter' | 'column' | 'columnGroup'

/**
 * <zh/> 侧面板状态编排——筛选/列设置/列分组面板的互斥切换。
 *
 * <en/> Side panel state orchestration — mutual exclusion toggling
 * <en/> of filter / column-setting / column-group panels.
 */
export function useSidePanelOrchestrator<T = any>(options: UseSidePanelOrchestratorOptions<T>) {
  const { mergedFilterConfig, filterPanelApi, mergedColumnConfig, columnGroupApi } = options

  const isSidePanelEnabled = computed(() => mergedFilterConfig.value.sidePanel ?? false)
  const isFilterPanelLeft = computed(() => filterPanelApi.panelPosition.value === 'left')
  const hasActiveFilters = computed(() => filterPanelApi.activeFilterKeys.value.size > 0)

  const isColumnSidePanelEnabled = computed(() => mergedColumnConfig.value.sidePanel ?? false)
  const columnSidePanelPosition = computed(() => mergedColumnConfig.value.sidePanelPosition ?? 'right')

  const isColumnGroupEnabled = computed(() => mergedColumnConfig.value.columnGroup?.enabled ?? false)

  /**
   * <zh/> 默认打开的面板——`activePanel` 是**唯一真源**（模板只消费它），
   * <zh/> 故初始化时必须解析各面板的 `sidePanelDefaultOpen`（已启用的面板中取第一个）。
   * <en/> the default-open panel — `activePanel` is the **single source of truth** (the
   * <en/> template only consumes it), so initialization resolves each panel's `sidePanelDefaultOpen`
   * <en/> (first enabled panel wins).
   */
  function resolveDefaultPanel(): PanelType | null {
    if (isSidePanelEnabled.value && mergedFilterConfig.value.sidePanelDefaultOpen)
      return 'filter'
    if (isColumnSidePanelEnabled.value && mergedColumnConfig.value.sidePanelDefaultOpen)
      return 'column'
    if (isColumnGroupEnabled.value && mergedColumnConfig.value.columnGroup?.sidePanelDefaultOpen)
      return 'columnGroup'
    return null
  }

  const activePanel = ref<PanelType | null>(resolveDefaultPanel())

  /**
   * <zh/> 最近一次打开过的面板——`activePanel` 归 null（关闭）时仍需知道该用哪份
   * <zh/> `sidePanelDestroyOnClose` 策略：模板的 `<KeepAlive :include>` 恰好在「关闭」那一刻求值，
   * <zh/> 若此时改用 null 语义就会把 `destroyOnClose=false` 的面板误判成不保留（直接销毁），
   * <zh/> 正是要修的「关闭再打开内部状态回退」。
   * <en/> The most recently opened panel — once `activePanel` drops to null (closed) we still need to
   * <en/> know which `sidePanelDestroyOnClose` policy applies, because the template evaluates
   * <en/> `<KeepAlive :include>` precisely at that moment. Falling back to null semantics there would
   * <en/> misjudge a `destroyOnClose=false` panel as non-retained and destroy it — exactly the
   * <en/> "state rolls back on reopen" behaviour fixes.
   */
  const lastActivePanel = ref<PanelType | null>(activePanel.value)
  // <zh/> `flush: 'sync'`——`activePanel` 既可被 togglePanel 改，也可被模板的关闭按钮
  // <zh/> （`sidePanel.activePanel = null`）改；同步刷新保证 keepPanelAlive 在同一次
  // <zh/> 赋值后立刻反映新策略，关闭那一刻的 `<KeepAlive :include>` 求值不受 flush 时机影响。
  // <en/> `flush: 'sync'` — `activePanel` is mutated both by togglePanel and by the template's close
  // <en/> button (`sidePanel.activePanel = null`); syncing makes keepPanelAlive reflect the new policy
  // <en/> immediately, so the `<KeepAlive :include>` evaluation at close time never races the flush.
  watch(activePanel, (panel) => {
    if (panel !== null)
      lastActivePanel.value = panel
  }, { flush: 'sync' })

  /**
   * <zh/> 关闭是否销毁——`sidePanelDestroyOnClose=false` 时面板实例需保留，
   * <zh/> 模板据此给 `<KeepAlive>` 传入允许缓存的 `include`。
   * <en/> destroy-on-close — with `sidePanelDestroyOnClose=false` the panel instance must be
   * <en/> retained, so the template hands KeepAlive a caching `include`.
   *
   * @param panel - <zh/> 目标面板 | <en/> the target panel
   */
  function destroyOnCloseFor(panel: PanelType | null): boolean {
    if (panel === 'filter')
      return mergedFilterConfig.value.sidePanelDestroyOnClose ?? true
    if (panel === 'column')
      return mergedColumnConfig.value.sidePanelDestroyOnClose ?? true
    if (panel === 'columnGroup')
      return columnGroupApi.options.value.sidePanelDestroyOnClose
    return true
  }

  const destroyOnClose = computed(() => destroyOnCloseFor(activePanel.value))

  /**
   * <zh/> 面板实例是否需要保留（KeepAlive）——取「当前面板，若已关闭则取最近打开过的面板」的策略。
   * <en/> Whether the panel instance must be retained (KeepAlive) — the policy of the current panel,
   * <en/> or of the most recently opened one once it has been closed.
   */
  const keepPanelAlive = computed(() => !destroyOnCloseFor(activePanel.value ?? lastActivePanel.value))

  function togglePanel(panel: PanelType) {
    if (activePanel.value === panel) {
      activePanel.value = null
      return
    }
    // 列分组面板打开时若有脏编辑，先按既有语义重新初始化（切换到其自身状态源）
    if (panel === 'columnGroup' && columnGroupApi.isDirty.value)
      columnGroupApi.resetConfig()
    activePanel.value = panel
  }

  const activePanelPosition = computed<'left' | 'right'>(() => {
    if (activePanel.value === 'filter')
      return isFilterPanelLeft.value ? 'left' : 'right'
    if (activePanel.value === 'column')
      return columnSidePanelPosition.value
    if (activePanel.value === 'columnGroup')
      return columnGroupApi.panelPosition.value
    return 'right'
  })

  const sidePanelPositions = computed(() => {
    const filterSide = isSidePanelEnabled.value
    const columnSide = isColumnSidePanelEnabled.value
    const columnGroupSide = isColumnGroupEnabled.value
    if (!filterSide && !columnSide && !columnGroupSide)
      return { hasLeft: false, hasRight: false, hasBoth: false }
    const positions: string[] = []
    if (filterSide)
      positions.push(isFilterPanelLeft.value ? 'left' : 'right')
    if (columnSide)
      positions.push(columnSidePanelPosition.value)
    if (columnGroupSide)
      positions.push(columnGroupApi.panelPosition.value)
    const hasLeft = positions.includes('left')
    const hasRight = positions.includes('right')
    return {
      hasLeft,
      hasRight,
      hasBoth: hasLeft && hasRight,
    }
  })

  const sideBarPositionClass = computed(() => {
    const { hasLeft, hasRight, hasBoth } = sidePanelPositions.value
    if (!hasLeft && !hasRight)
      return ''
    if (hasBoth)
      return 'adv-table__body-row--filter-both'
    if (hasLeft)
      return 'adv-table__body-row--filter-left'
    return 'adv-table__body-row--filter-right'
  })

  const sideButtonPositionModifier = computed(() => {
    const { hasLeft, hasRight, hasBoth } = sidePanelPositions.value
    if (!hasLeft && !hasRight)
      return ''
    if (hasBoth)
      return ''
    if (hasLeft)
      return 'adv-table-side-button--active-filter-left'
    return 'adv-table-side-button--active-filter-right'
  })

  return {
    isSidePanelEnabled,
    isColumnSidePanelEnabled,
    isColumnGroupEnabled,
    hasActiveFilters,
    activePanel,
    activePanelPosition,
    destroyOnClose,
    keepPanelAlive,
    sideBarPositionClass,
    sideButtonPositionModifier,
    togglePanel,
  }
}
