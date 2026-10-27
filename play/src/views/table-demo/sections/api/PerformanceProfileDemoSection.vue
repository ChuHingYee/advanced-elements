<!-- <zh/> 11.2 性能档位(performanceProfile) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 11.2 性能档位(performanceProfile) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { useDemoContext } from '../../demo-context'

const { surfaceCols, surfaceData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>11.2 性能档位 (performanceProfile)</h1>
    <p>低端设备通过 <code>performance-profile="low"</code> 关闭滚动看门狗/滚动速度追踪/hover 鼠标追踪等重路径；默认 <code>high</code>。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default · low</h4>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          performance-profile="low"
          height="300px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual · high</h4>
        <adv-table
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          performance-profile="high"
          height="300px"
        />
      </div>
    </div>
  </div>
</template>
