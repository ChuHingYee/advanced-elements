<!-- <zh/> 10.18 综合示例 section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 10.18 综合示例 section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { compColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'

const { compDemoData, compDemoRequest, compRef, compV2Ref, onCompImported } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>10.18 综合示例</h1>
    <p>
      综合展示工具栏全部功能：列设置 / 刷新 / 轮询 / 导出 Excel / 导出 CSV / 导入 / 打印，
      以及 <code>header-left</code>、<code>header-right</code> 表头插槽。两种渲染模式各占满整行、分两行分别展示。
    </p>
    <div class="stack-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          ref="compRef"
          mode="default"
          :request="{ source: compDemoRequest }"
          :data="compDemoData"
          :columns="compColumns"
          :pagination="{ pageSize: 10, pageSizes: [10, 20, 50, 100] }"
          :toolbar="{
            columnSetting: true,
            refreshBtn: true,
            pollingBtn: true,
            pollingOptions: { time: 5000 },
            exportBtn: true,
            exportCsvBtn: true,
            importBtn: true,
            printBtn: true,
          }"
          border
          resizable
          :edit-config="{}"
          :filter-config="{ floatingFilter: true }"
          height="520px"
          @data-import="onCompImported"
        >
          <template #header-left>
            <span class="comp-header-tag">📊 综合数据</span>
          </template>
          <template #header-right>
            <span class="comp-header-tag comp-header-tag--right">共 {{ compDemoData.length }} 条</span>
          </template>
        </adv-table>
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          ref="compV2Ref"
          mode="virtual"
          :request="{ source: compDemoRequest }"
          :data="compDemoData"
          :columns="compColumns"
          :pagination="{ pageSize: 10, pageSizes: [10, 20, 50, 100] }"
          :toolbar="{
            columnSetting: true,
            refreshBtn: true,
            pollingBtn: true,
            pollingOptions: { time: 5000 },
            exportBtn: true,
            exportCsvBtn: true,
            importBtn: true,
            printBtn: true,
          }"
          border
          resizable
          :edit-config="{}"
          :filter-config="{ floatingFilter: true }"
          height="520px"
          @data-import="onCompImported"
        >
          <template #header-left>
            <span class="comp-header-tag">📊 综合数据</span>
          </template>
          <template #header-right>
            <span class="comp-header-tag comp-header-tag--right">共 {{ compDemoData.length }} 条</span>
          </template>
        </adv-table>
      </div>
    </div>
  </div>
</template>
