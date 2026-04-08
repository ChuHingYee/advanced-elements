<!-- <zh/> 11.3 模式切换策略(modeSwitchBehavior) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 11.3 模式切换策略(modeSwitchBehavior) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { ElButton, ElOption, ElSelect } from 'element-plus'
import { useDemoContext } from '../../demo-context'

const { cycleModeBehavior, surfaceBehavior, surfaceCols, surfaceData, surfaceMode } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>11.3 模式切换策略 (modeSwitchBehavior)</h1>
    <p>运行时切换 <code>mode</code> 的行为策略：<code>warn</code>（默认，清理状态并在 dev 派发 info 通知）、<code>silent</code>（同 warn 但不派发通知）、<code>error</code>（抛 TypeError 阻止切换，强制 v-if 重建）。</p>
    <div class="mode-panel">
      <div style="margin-bottom:10px;display:flex;gap:8px;align-items:center">
        <ElButton @click="cycleModeBehavior()">
          切换模式 (当前: {{ surfaceMode }})
        </ElButton>
        <span style="font-size:12px;color:#909399">behavior: {{ surfaceBehavior }}</span>
        <ElSelect
          v-model="surfaceBehavior"
          size="small"
          style="width:120px"
        >
          <ElOption
            label="warn"
            value="warn"
          />
          <ElOption
            label="silent"
            value="silent"
          />
          <ElOption
            label="error"
            value="error"
          />
        </ElSelect>
      </div>
      <adv-table
        v-if="surfaceMode === 'default'"
        :key="`mode-${surfaceMode}-${surfaceBehavior}`"
        mode="default"
        :data="surfaceData"
        :columns="surfaceCols"
        :mode-switch-behavior="surfaceBehavior"
        height="320px"
      />
      <adv-table
        v-else
        :key="`mode-${surfaceMode}-${surfaceBehavior}`"
        mode="virtual"
        :data="surfaceData"
        :columns="surfaceCols"
        :mode-switch-behavior="surfaceBehavior"
        height="320px"
      />
    </div>
  </div>
</template>
