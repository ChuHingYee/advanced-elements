<script setup lang="ts">
/**
 * <zh/> 11.1 表面全覆盖页的事件读数面板
 * <en/> Event readout panel for the 11.1 surface-coverage page
 *
 * <zh/> 这些 UI 是 surfaceLogEvent() 的写入结果；若直接在 TableDemo 模板里读取，
 * <zh/> 任何一个表格事件都会重渲染整页 100+ 个表格，内联 :data/:config 身份变化
 * <zh/> 再次触发 dataChange/rowsRendered，形成 Maximum recursive updates 死循环。
 * <zh/> 状态见 ./surface-state.ts，读写分离后事件只重渲染本小组件。
 * <en/> This UI reflects writes from surfaceLogEvent(); reading it directly inside the TableDemo
 * <en/> template would cause any single table event to re-render all 100+ tables on the page,
 * <en/> whose inline :data/:config identity changes re-fire dataChange/rowsRendered and form
 * <en/> a Maximum recursive updates loop. State lives in ./surface-state.ts; after splitting
 * <en/> read/write, an event only re-renders this small component.
 */
import { ElButton } from 'element-plus'
import {
  SURFACE_EVENT_DOCS,
  surfaceApiLog,
  surfaceClearApiLog,
  surfaceClearLog,
  surfaceEventCounts,
  surfaceLog,
  surfaceTriggeredEventCount,
  surfaceUnfiredEvents,
} from './surface-state'

defineProps<{ section: 'coverage' | 'unfired' | 'checklist' | 'log' | 'apiLog' }>()
</script>

<template>
  <span v-if="section === 'coverage'">当前已触发 {{ surfaceTriggeredEventCount }}/53。</span>

  <template v-else-if="section === 'unfired'">
    <p
      v-if="surfaceUnfiredEvents.length"
      style="font-size: 12px; color: #909399"
    >
      本会话未触发：<code>{{ surfaceUnfiredEvents.join('、') }}</code>（对照速查表逐项操作即可全部点亮）
    </p>
    <p
      v-else
      style="font-size: 13px; color: #67c23a"
    >
      🎉 全部 53 个事件均已触发
    </p>
  </template>

  <table
    v-else-if="section === 'checklist'"
    class="surface-event-checklist"
  >
    <thead>
      <tr>
        <th>#</th>
        <th>事件</th>
        <th>触发方式</th>
        <th>已触发</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="(doc, i) in SURFACE_EVENT_DOCS"
        :key="doc.name"
      >
        <td>{{ i + 1 }}</td>
        <td><code>{{ doc.name }}</code></td>
        <td>{{ doc.how }}</td>
        <td>{{ surfaceEventCounts[doc.name] ? `✓ ×${surfaceEventCounts[doc.name]}` : '—' }}</td>
      </tr>
    </tbody>
  </table>

  <div
    v-else-if="section === 'log'"
    class="log-panel"
  >
    <div class="log-header">
      <strong>日志（{{ surfaceLog.length }}）</strong>
      <ElButton
        size="small"
        @click="surfaceClearLog()"
      >
        清空
      </ElButton>
    </div>
    <div class="log-content">
      <div
        v-for="(entry, i) in surfaceLog"
        :key="i"
        class="log-entry"
      >
        {{ entry }}
      </div>
      <div
        v-if="surfaceLog.length === 0"
        class="log-empty"
      >
        暂无事件日志
      </div>
    </div>
  </div>

  <div
    v-else
    class="log-panel"
  >
    <div class="log-header">
      <strong>日志（{{ surfaceApiLog.length }}）</strong>
      <ElButton
        size="small"
        @click="surfaceClearApiLog()"
      >
        清空
      </ElButton>
    </div>
    <div class="log-content">
      <div
        v-for="(entry, i) in surfaceApiLog"
        :key="i"
        class="log-entry"
      >
        {{ entry }}
      </div>
      <div
        v-if="surfaceApiLog.length === 0"
        class="log-empty"
      >
        暂无 API 调用日志
      </div>
    </div>
  </div>
</template>
