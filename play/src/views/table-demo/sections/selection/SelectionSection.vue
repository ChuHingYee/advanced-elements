<!-- <zh/> 2.1 单选/多选 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 2.1 单选/多选 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { ElButton } from 'element-plus'
import { allValueTypeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'
import { handleShowSelection } from '../../helpers'

const { basicData, selMultiRef, selMultiV2Ref } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>2.1 单选/多选</h1>
    <p>支持单选和多选模式。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式 - 多选</h4>
        <adv-table
          ref="selMultiRef"
          mode="default"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          :row-config="{ rowSelection: 'multiple' }"
          height="400px"
        />
        <ElButton
          style="margin-top: 10px"
          @click="handleShowSelection('多选', selMultiRef)"
        >
          获取选中行
        </ElButton>
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式 - 多选</h4>
        <adv-table
          ref="selMultiV2Ref"
          mode="virtual"
          :data="basicData"
          :columns="allValueTypeColumns.slice(0, 6)"
          :row-config="{ rowSelection: 'multiple' }"
          height="400px"
        />
        <ElButton
          style="margin-top: 10px"
          @click="handleShowSelection('多选', selMultiV2Ref)"
        >
          获取选中行
        </ElButton>
      </div>
    </div>
  </div>
</template>
