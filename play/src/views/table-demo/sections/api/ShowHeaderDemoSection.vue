<!-- <zh/> 11.13 表头显隐(showHeader) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 11.13 表头显隐(showHeader) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { ElSwitch } from 'element-plus'
import { useDemoContext } from '../../demo-context'

const { showHeaderEnabled, surfaceCols, surfaceData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>11.13 表头显隐 (showHeader)</h1>
    <p><code>show-header="false"</code> 隐藏表头，两种模式均生效。开关切换时表头应整体消失/出现。</p>
    <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px">
      <span style="font-size: 13px; color: #606266">显示表头：</span>
      <ElSwitch
        v-model="showHeaderEnabled"
        active-text="显示"
        inactive-text="隐藏"
      />
      <span style="font-size: 12px; color: #909399; margin-left: 12px">当前：showHeader={{ String(showHeaderEnabled) }}</span>
    </div>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default · {{ showHeaderEnabled ? 'true' : 'false' }}</h4>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          :show-header="showHeaderEnabled"
          height="300px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual · {{ showHeaderEnabled ? 'true' : 'false' }}</h4>
        <adv-table
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          :show-header="showHeaderEnabled"
          height="300px"
        />
      </div>
    </div>
  </div>
</template>
