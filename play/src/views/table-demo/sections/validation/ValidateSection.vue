<!-- <zh/> 7.1 数据校验(editorRules) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 7.1 数据校验(editorRules) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { ElButton } from 'element-plus'
import { validateColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { validateData, validateFullRowRef, validateRef } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>7.1 数据校验 (editorRules)</h1>
    <p>使用 editorRules 进行数据校验。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <div style="margin-bottom: 10px">
          <ElButton
            type="primary"
            @click="validateRef?.validate?.()"
          >
            校验全部
          </ElButton>
          <ElButton @click="validateRef?.clearValidate?.()">
            清除校验
          </ElButton>
        </div>
        <adv-table
          ref="validateRef"
          mode="default"
          :data="validateData"
          :columns="validateColumns"
          :edit-config="{}"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <div style="margin-bottom: 10px">
          <ElButton
            type="primary"
            @click="validateFullRowRef?.validate?.()"
          >
            校验全部
          </ElButton>
        </div>
        <adv-table
          ref="validateFullRowRef"
          mode="virtual"
          :data="validateData"
          :columns="validateColumns"
          :edit-config="{}"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
