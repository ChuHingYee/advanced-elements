<!-- <zh/> 6.18 编辑开始/结束事件 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 6.18 编辑开始/结束事件 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { editColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { cellEditLifecycleLog, cellEditLifecycleLogV2, cellEditLifecycleRef, cellEditLifecycleV2Ref, editData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>6.18 编辑开始/结束事件</h1>
    <p>监听编辑开始和结束事件。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="cellEditLifecycleRef"
          mode="default"
          :data="editData"
          :columns="editColumns"
          :edit-config="{}"
          height="400px"
          @cell-editing-started="(e: any) => cellEditLifecycleLog.push(`开始编辑: ${e.prop}`)"
          @cell-editing-stopped="(e: any) => cellEditLifecycleLog.push(`结束编辑: ${e.prop}, 值: ${e.newValue}`)"
        />
        <div style="margin-top: 10px; max-height: 100px; overflow-y: auto; font-size: 12px">
          <div
            v-for="(log, i) in cellEditLifecycleLog.slice(-5)"
            :key="i"
          >
            {{ log }}
          </div>
        </div>
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          ref="cellEditLifecycleV2Ref"
          mode="virtual"
          :data="editData"
          :columns="editColumns"
          :edit-config="{}"
          height="400px"
          @cell-editing-started="(e: any) => cellEditLifecycleLogV2.push(`开始编辑: ${e.prop}`)"
          @cell-editing-stopped="(e: any) => cellEditLifecycleLogV2.push(`结束编辑: ${e.prop}, 值: ${e.newValue}`)"
        />
        <div style="margin-top: 10px; max-height: 100px; overflow-y: auto; font-size: 12px">
          <div
            v-for="(log, i) in cellEditLifecycleLogV2.slice(-5)"
            :key="i"
          >
            {{ log }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
