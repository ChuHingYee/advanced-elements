<!-- <zh/> 10.5 Teleport Auto 模式 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 10.5 Teleport Auto 模式 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { teleportAutoColsAlwaysTeleport, teleportAutoColsNoFixed, teleportAutoColsWithFixed } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { basicData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>10.5 Teleport Auto 模式</h1>
    <p>对比 <code>hoverActions.teleport</code> 三种策略：auto（自动判断）、true（强制 Teleport）。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式 - teleport: auto（无固定列）</h4>
        <adv-table
          mode="default"
          :data="basicData"
          :columns="teleportAutoColsNoFixed"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式 - teleport: auto（有固定列）</h4>
        <adv-table
          mode="virtual"
          :data="basicData"
          :columns="teleportAutoColsWithFixed"
          height="400px"
        />
      </div>
    </div>
    <div
      class="mode-panel"
      style="margin-top: 20px"
    >
      <h4>Virtual 模式 - teleport: true（强制 Teleport，有固定列）</h4>
      <adv-table
        mode="virtual"
        :data="basicData"
        :columns="teleportAutoColsAlwaysTeleport"
        height="400px"
      />
    </div>
  </div>
</template>
