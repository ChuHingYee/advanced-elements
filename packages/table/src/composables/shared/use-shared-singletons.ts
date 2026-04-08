import type { ComputedRef } from 'vue'
import type { EnumFilterOption } from '../../types/column'
import type { ColumnFilterValue } from '../../types/filter'
import type { NotifyFn } from '../../utils/notification'
import { computed, provide } from 'vue'
import { advTableSharedFilterPopoverKey, advTableSharedHeaderTooltipKey } from '../../types/config'
import { createDefaultNotify } from '../../utils/notification'
import { createDefaultFilterValue } from '../data/use-column-filter'
import { advCopyKey, useCopyApi } from '../shared/use-copy-api'
import { advOverflowTooltipKey, useOverflowTooltip } from '../shared/use-overflow-tooltip'
import { useSharedFilterPopover } from '../shared/use-shared-filter-popover'
import { useSharedHeaderTooltip } from '../shared/use-shared-header-tooltip'

/** <zh/> 共享单例编排器输入 | <en/> Shared singletons orchestrator input */
export interface UseSharedSingletonsOptions {
  isContainerVisible: ComputedRef<boolean>
  tooltipEffect: () => string | undefined
  tooltipOptions: () => Record<string, any> | undefined
  tooltipFormatter: () => any
  getFilterValue: (key: string) => ColumnFilterValue | undefined
  getEnumOptions: (key: string) => EnumFilterOption[] | undefined
  isColumnFiltered: (key: string) => boolean
  setFilter: (key: string, val: ColumnFilterValue) => void
  /** <zh/> 通知通道——未传入时使用默认实现 | <en/> Notification channel — defaults to default implementation */
  notify?: NotifyFn
}

/**
 * <zh/> 共享单例工具编排——Tooltip / Copy / FilterPopover / HeaderTooltip。
 *
 * <zh/> 这些单例工具在整个表格实例中只创建一次，通过 provide 注入到子组件树。
 *
 * <en/> Shared singleton tools orchestration — Tooltip / Copy / FilterPopover / HeaderTooltip.
 * <en/> These singleton tools are created only once per table instance, injected via provide.
 */
export function useSharedSingletons(options: UseSharedSingletonsOptions) {
  const {
    isContainerVisible,
    tooltipEffect,
    tooltipOptions,
    tooltipFormatter,
    getFilterValue,
    getEnumOptions,
    isColumnFiltered,
    setFilter,
    notify = createDefaultNotify(),
  } = options

  const sharedTooltip = useOverflowTooltip({
    containerVisible: () => isContainerVisible.value,
    tooltipEffect,
    tooltipOptions,
    tooltipFormatter,
  })
  provide(advOverflowTooltipKey, sharedTooltip.api)

  const sharedCopyApi = useCopyApi(notify)
  provide(advCopyKey, sharedCopyApi.api)

  const sharedFilterPopover = useSharedFilterPopover({
    containerVisible: () => isContainerVisible.value,
  })
  provide(advTableSharedFilterPopoverKey, sharedFilterPopover)

  const sharedFilterFormKey = computed(() => sharedFilterPopover.activeColumnKey.value)
  const sharedFilterFormType = computed(() => sharedFilterPopover.activeFilterType.value ?? 'text')
  const sharedFilterFormValue = computed<ColumnFilterValue>(() => {
    const key = sharedFilterPopover.activeColumnKey.value
    if (!key)
      return createDefaultFilterValue('text')
    return getFilterValue(key) ?? createDefaultFilterValue(sharedFilterFormType.value)
  })
  const sharedFilterFormEnumOptions = computed<(() => EnumFilterOption[]) | undefined>(() => {
    const key = sharedFilterPopover.activeColumnKey.value
    if (!key)
      return undefined
    return () => getEnumOptions(key) ?? []
  })
  const sharedFilterFormActive = computed(() => {
    const key = sharedFilterPopover.activeColumnKey.value
    if (!key)
      return false
    return isColumnFiltered(key)
  })

  function handleSharedFilterUpdate(val: ColumnFilterValue) {
    const key = sharedFilterPopover.activeColumnKey.value
    if (key)
      setFilter(key, val)
  }

  const sharedHeaderTooltip = useSharedHeaderTooltip({
    containerVisible: () => isContainerVisible.value,
  })
  provide(advTableSharedHeaderTooltipKey, {
    onHeaderEnter: sharedHeaderTooltip.onHeaderEnter,
    onHeaderLeave: sharedHeaderTooltip.onHeaderLeave,
  })

  return {
    sharedTooltip,
    sharedCopyApi,
    sharedFilterPopover,
    sharedHeaderTooltip,
    sharedFilterFormKey,
    sharedFilterFormType,
    sharedFilterFormValue,
    sharedFilterFormEnumOptions,
    sharedFilterFormActive,
    handleSharedFilterUpdate,
    overflowTooltipApi: sharedTooltip.api,
    copyApi: sharedCopyApi.api,
    sharedFilterPopoverApi: sharedFilterPopover,
    sharedHeaderTooltipApi: {
      onHeaderEnter: sharedHeaderTooltip.onHeaderEnter,
      onHeaderLeave: sharedHeaderTooltip.onHeaderLeave,
    },
  }
}
