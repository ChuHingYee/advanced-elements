<!-- <zh/> 10.4 Teleport 悬浮操作 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 10.4 Teleport 悬浮操作 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { useDemoContext } from '../../demo-context'

const { basicData, teleportHoverColumns } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>10.4 Teleport 悬浮操作</h1>
    <p>操作按钮悬浮在行上方。层级基线：行内悬浮条 3001 ＞ 右键菜单 3000 ＞ Teleport 悬浮（默认 2000，随 El 弹层）＞ 筛选 popover（El 默认）；调低 zIndex 可能沉到固定列/表头之下。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="basicData"
          :columns="teleportHoverColumns"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="basicData"
          :columns="teleportHoverColumns"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
