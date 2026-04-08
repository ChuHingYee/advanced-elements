<!-- <zh/> 7.2 校验模式(invalidEditValueMode) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 7.2 校验模式(invalidEditValueMode) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { ElOption, ElSelect } from 'element-plus'
import { validateModeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { validateData, validateModeRef, validateModeType } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>7.2 校验模式 (invalidEditValueMode)</h1>
    <p>控制校验失败时的行为。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <div style="margin-bottom: 10px">
          校验模式:
          <ElSelect
            v-model="validateModeType"
            size="small"
            style="width: 120px"
          >
            <ElOption
              label="还原"
              value="revert"
            />
            <ElOption
              label="阻止"
              value="block"
            />
            <ElOption
              label="通知"
              value="notify"
            />
          </ElSelect>
        </div>
        <adv-table
          ref="validateModeRef"
          mode="default"
          :data="validateData"
          :columns="validateModeColumns"
          :edit-config="{ invalidEditValueMode: validateModeType }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="validateData"
          :columns="validateModeColumns"
          :edit-config="{ invalidEditValueMode: validateModeType }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
