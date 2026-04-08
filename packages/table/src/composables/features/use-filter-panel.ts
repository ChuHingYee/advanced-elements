/**
 * <zh/> 筛选面板 Composable
 * <en/> Filter panel composable
 *
 * @remarks
 * <zh/> 管理侧边筛选面板的展开/收起状态，提供面板与现有筛选系统的桥接。不持有筛选逻辑本身——筛选操作委托给 useColumnFilter 的 filterState
 * <en/> Manages side filter panel expand/collapse state, provides bridge between panel and existing filter system. Does not hold filter logic itself — filter operations are delegated to useColumnFilter's filterState
 */
import type { Ref } from 'vue'
import type { FilterPanelApi } from '../../types/config'
import type { ColumnFilterValue } from '../../types/filter'
import { computed } from 'vue'
import { getFilterStrategy } from '../features/filter-registry'

export interface UseFilterPanelOptions {
  /** <zh/> 筛选配置 | <en/> Filter config */
  filterConfig: () => { sidePanel?: boolean, sidePanelPosition?: 'left' | 'right', sidePanelDefaultOpen?: boolean } | undefined
  /** <zh/> 筛选状态 | <en/> Filter state */
  filterState: Ref<Record<string, ColumnFilterValue>>
  /** <zh/> 重置所有筛选 | <en/> Reset all filters */
  resetAllFilters: () => void
}

/**
 * <zh/> 筛选面板组合式函数
 * <en/> Composable for filter panel
 *
 * @remarks
 * <zh/> 管理侧边筛选面板的展开/收起状态，桥接到 useColumnFilter 的筛选系统
 * <en/> Manages side filter panel expand/collapse state, bridges to useColumnFilter's filter system
 * @param options - <zh/> 筛选面板配置 | <en/> filter panel options
 * @returns <zh/> 筛选面板 API | <en/> filter panel API
 */
export function useFilterPanel(options: UseFilterPanelOptions): FilterPanelApi {
  const {
    filterConfig,
    filterState,
    resetAllFilters,
  } = options

  /** 面板位置（left / right） */
  const panelPosition = computed(() => filterConfig()?.sidePanelPosition ?? 'right')

  /** 当前有激活筛选条件的列 key 集合 */
  const activeFilterKeys = computed(() => {
    const keys = new Set<string>()
    for (const key of Object.keys(filterState.value)) {
      const filterValue = filterState.value[key]
      if (filterValue && isFilterActive(filterValue)) {
        keys.add(key)
      }
    }
    return keys
  })

  return {
    panelPosition,
    activeFilterKeys,
    resetAllFilters,
  }
}

/**
 * 判断筛选条件是否为激活状态
 * 委托给对应筛选类型的 strategy.isActive 方法
 * @param value - 筛选值
 */
function isFilterActive(value: ColumnFilterValue): boolean {
  const strategy = getFilterStrategy(value.type)
  if (strategy)
    return strategy.isActive(value)
  return false
}
