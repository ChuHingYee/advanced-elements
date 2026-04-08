<!--
  @component PollingBtn
  @displayName 轮询刷新按钮
  @displayName Polling Button
  @description <zh/> 在工具栏中渲染轮询刷新按钮，点击后按指定时间间隔自动刷新表格数据，支持立即执行、成功/失败回调、自动清理定时器
  @description <en/> Renders polling refresh button in toolbar, auto-refreshes table data at specified interval, supports immediate execution, success/failure callbacks, auto-cleanup
  @category 数据展示 | Data Display
  @since 1.0.0
-->
<script lang="ts" setup>
import type { PollingOptions } from '../../types/config'
import {
  Refresh as IconRefresh,
  RefreshRight as IconRefreshRight,
} from '@element-plus/icons-vue'
import { ElIcon } from 'element-plus'
import { computed, inject, onActivated, onBeforeUnmount, onDeactivated, ref, shallowRef, watch } from 'vue'
import { useAdvLocale } from '../../locale'
import { advTableKey } from '../../types/injection-keys'

const props = withDefaults(defineProps<{
  /** <zh/> 轮询配置，包含时间间隔、立即执行、回调等选项 | <en/> polling config, includes interval, immediate execution, callbacks, etc. */
  options?: PollingOptions
}>(), {
  options: () => ({ time: 3000, immediate: false }),
})
const { t } = useAdvLocale()

const startTip = computed(
  () => props.options.startTip || t('table.polling.start'),
)
const stopTip = computed(() => props.options.stopTip || t('table.polling.stop'))
const advTable = inject(advTableKey, undefined)
/** <zh/> 轮询状态双向绑定 | <en/> two-way binding of polling state */
const isPolling = defineModel<boolean>('isPolling', { default: false })

const timer = shallowRef<ReturnType<typeof setTimeout> | null>(null)
const isPollingActive = ref(false)
let generation = 0
let active = true
let disposed = false

function clearTimer() {
  if (timer.value !== null) {
    clearTimeout(timer.value)
    timer.value = null
  }
}

function invalidatePolling() {
  generation++
  clearTimer()
  isPollingActive.value = false
}

function isCurrent(current: number) {
  return current === generation && active && !disposed && isPollingActive.value
}

function syncPollingState(val: boolean) {
  isPolling.value = val
  props.options.onChange?.(val)
}

function stopPolling() {
  invalidatePolling()
  syncPollingState(false)
}

async function handleFetch(current: number) {
  if (!isCurrent(current))
    return false

  try {
    const refresh = advTable?.refresh
    if (!refresh)
      throw new Error('[AdvTable] refresh is not available via provide/inject')
    await refresh()
    if (!isCurrent(current))
      return false
    props.options.onSuccess?.()
    return isCurrent(current)
  }
  catch (error) {
    if (isCurrent(current)) {
      props.options.onFail?.(error)
      if (isCurrent(current))
        stopPolling()
    }
    return false
  }
}

function resume(current: number) {
  if (!isCurrent(current))
    return
  clearTimer()
  timer.value = setTimeout(async () => {
    if (!isCurrent(current))
      return
    timer.value = null
    if (await handleFetch(current))
      resume(current)
  }, props.options.time)
}

async function startPolling(immediate: boolean, notify = false) {
  if (!active || disposed || isPollingActive.value)
    return
  const current = ++generation
  isPollingActive.value = true
  if (notify)
    syncPollingState(true)
  if (immediate && !await handleFetch(current))
    return
  resume(current)
}

function handlePolling() {
  if (isPolling.value)
    stopPolling()
  else
    void startPolling(!!props.options.immediate, true)
}

onBeforeUnmount(() => {
  disposed = true
  active = false
  invalidatePolling()
})

onDeactivated(() => {
  active = false
  invalidatePolling()
})

onActivated(() => {
  if (active || disposed)
    return
  active = true
  if (isPolling.value)
    void startPolling(false)
})

watch(isPolling, (val) => {
  if (val)
    void startPolling(!!props.options.immediate)
  else
    invalidatePolling()
}, { immediate: true, flush: 'sync' })
</script>

<template>
  <div
    class="adv-table-polling-toggle"
    :class="{ 'adv-table-polling-toggle--active': isPolling }"
    @click="handlePolling"
  >
    <ElIcon
      :size="14"
      class="adv-table-polling-toggle__icon"
      :class="{ 'adv-table-polling-toggle__icon--loading': isPolling }"
    >
      <IconRefreshRight v-if="isPolling" />
      <IconRefresh v-else />
    </ElIcon>
    <span class="adv-table-polling-toggle__text">{{ isPolling ? stopTip : startTip }}</span>
  </div>
</template>
