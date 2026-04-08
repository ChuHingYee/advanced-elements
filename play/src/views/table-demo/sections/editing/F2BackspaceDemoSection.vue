<!-- <zh/> 6.12 F2/Backspace键盘触发 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 6.12 F2/Backspace键盘触发 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { f2BackspaceColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { f2BackspaceData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>6.12 F2/Backspace 键盘触发</h1>
    <p>使用 F2 进入编辑，Backspace 清空并编辑。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="f2BackspaceData"
          :columns="f2BackspaceColumns"
          :edit-config="{}"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="f2BackspaceData"
          :columns="f2BackspaceColumns"
          :edit-config="{}"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
