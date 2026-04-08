<!-- <zh/> 8.7 列事件 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 8.7 列事件 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { resizeCols } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { basicData, columnEventLog, columnEventLogV2, columnEventRef, columnEventV2Ref } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>8.7 列事件</h1>
    <p>监听列相关事件。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="columnEventRef"
          mode="default"
          :data="basicData"
          :columns="resizeCols"
          resizable
          height="400px"
          @header-dragend="(e: any) => columnEventLog.push(`列宽调整: ${e.column?.prop ?? '?'} -> ${e.newWidth}px`)"
        />
        <div style="margin-top: 10px; max-height: 100px; overflow-y: auto; font-size: 12px">
          <div
            v-for="(log, i) in columnEventLog.slice(-5)"
            :key="i"
          >
            {{ log }}
          </div>
        </div>
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          ref="columnEventV2Ref"
          mode="virtual"
          :data="basicData"
          :columns="resizeCols"
          resizable
          height="400px"
          @header-dragend="(e: any) => columnEventLogV2.push(`列宽调整: ${e.column?.prop ?? '?'} -> ${e.newWidth}px`)"
        />
        <div style="margin-top: 10px; max-height: 100px; overflow-y: auto; font-size: 12px">
          <div
            v-for="(log, i) in columnEventLogV2.slice(-5)"
            :key="i"
          >
            {{ log }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
