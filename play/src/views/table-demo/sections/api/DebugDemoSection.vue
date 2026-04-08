<!-- <zh/> 11.9 调试模式(debug) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 11.9 调试模式(debug) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { useDemoContext } from '../../demo-context'

const { surfaceCols, surfaceData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>11.9 调试模式 (debug)</h1>
    <p>开启后输出管线/编辑/选择/渲染诊断信息。支持简写 <code>true</code>（等价 <code>{enabled:true, perf:true}</code>）与对象形态 <code>{enabled, perf, domains}</code> 按域过滤。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default · { enabled:true, perf:true }</h4>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          :debug="{ enabled: true, perf: true }"
          height="300px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual · { enabled:true, domains:['data','edit'] }</h4>
        <adv-table
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          :debug="{ enabled: true, domains: ['data', 'edit'] }"
          height="300px"
        />
      </div>
    </div>
    <div
      class="mode-panel"
      style="margin-top:16px"
    >
      <h4>简写 true（等价 enabled+perf）</h4>
      <adv-table
        mode="default"
        :data="surfaceData"
        :columns="surfaceCols"
        :debug="true"
        height="200px"
      />
    </div>
  </div>
</template>
