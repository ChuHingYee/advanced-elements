<!-- <zh/> 1.7 表尾合计/总计行(summary) section——自 TableDemo.vue 原样迁出（COMPLEXITY-PLAN 战线二） | <en/> 1.7 表尾合计/总计行(summary) section — migrated verbatim from TableDemo.vue (COMPLEXITY-Plan battle line 2) -->
<script setup lang="ts">
import { ElCheckbox, ElOption, ElSelect } from 'element-plus'
import { filterSortColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'
import { summaryMethod } from '../../helpers'

const { filterSortData, grandTotalPosition, groupTotalPosition, keepHeaderAgg, rowGroupData, rowGroupTotalColumns, selectiveGroupTotal, selectiveGroupTotalFn, totalAggColumns, totalLabelGetter, totalStickySuppress } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>1.7 表尾合计 (summary)</h1>
    <p>通过 <code>ui-config</code> 传入 <code>showSummary: true</code> 与 <code>summaryMethod</code> 渲染表尾合计行。Virtual 模式下的表尾通过原生滚动容器与表体水平同步（见 <code>virtual-summary-footer.vue</code>）。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="filterSortData"
          :columns="filterSortColumns"
          :ui-config="{ showSummary: true, summaryMethod }"
          height="320px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="filterSortData"
          :columns="filterSortColumns"
          :ui-config="{ showSummary: true, summaryMethod }"
          height="320px"
        />
      </div>
    </div>
    <h3>含左/右固定列的合计</h3>
    <p>当列配置中同时存在左侧和右侧固定列时，表尾合计行也应正确对齐。下方演示包含左侧固定选择列 + 右侧固定操作列。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式（含左+右固定列）</h4>
        <adv-table
          mode="default"
          :data="filterSortData"
          :columns="[
            ...filterSortColumns.filter(c => c.selection).map(c => ({ ...c, fixed: 'left' })),
            ...filterSortColumns.filter(c => !c.selection && c.fixed !== 'right'),
            ...filterSortColumns.filter(c => c.fixed === 'right'),
          ]"
          :row-config="{ rowSelection: 'multiple' }"
          :ui-config="{ showSummary: true, summaryMethod }"
          height="320px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式（含左+右固定列）</h4>
        <adv-table
          mode="virtual"
          :data="filterSortData"
          :columns="[
            ...filterSortColumns.filter(c => c.selection).map(c => ({ ...c, fixed: 'left' })),
            ...filterSortColumns.filter(c => !c.selection && c.fixed !== 'right'),
            ...filterSortColumns.filter(c => c.fixed === 'right'),
          ]"
          :row-config="{ rowSelection: 'multiple' }"
          :ui-config="{ showSummary: true, summaryMethod }"
          height="320px"
        />
      </div>
    </div>
    <h3>Grand 总计行位置（AG Grid grandTotalRow）</h3>
    <p>通过 <code>ui-config.grandTotalRow</code> 切换总计行位置：<code>top</code> 首行、<code>bottom</code> 表尾、<code>pinnedTop</code>/<code>pinnedBottom</code> 固定顶/底（滚动始终可见）。<code>totalValueGetter</code> 自定义首列标签，<code>suppressStickyTotalRow</code> 取消粘性（降级为滚动行）。</p>
    <div style="margin-bottom: 10px">
      位置:
      <ElSelect
        v-model="grandTotalPosition"
        size="small"
        style="width: 150px"
      >
        <ElOption
          label="bottom（表尾）"
          value="bottom"
        />
        <ElOption
          label="top（首行）"
          value="top"
        />
        <ElOption
          label="pinnedTop（固定顶部）"
          value="pinnedTop"
        />
        <ElOption
          label="pinnedBottom（固定底部）"
          value="pinnedBottom"
        />
      </ElSelect>
      <span style="margin-left: 16px">粘性抑制:</span>
      <ElSelect
        v-model="totalStickySuppress"
        size="small"
        style="width: 130px; margin-left: 6px"
      >
        <ElOption
          label="默认粘性"
          :value="false"
        />
        <ElOption
          label="全部取消"
          :value="true"
        />
        <ElOption
          label="仅总计"
          value="grand"
        />
        <ElOption
          label="仅小计"
          value="group"
        />
      </ElSelect>
    </div>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="filterSortData"
          :columns="filterSortColumns"
          :ui-config="{ showSummary: true, grandTotalRow: grandTotalPosition, suppressStickyTotalRow: totalStickySuppress, totalValueGetter: totalLabelGetter }"
          height="320px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="filterSortData"
          :columns="filterSortColumns"
          :ui-config="{ showSummary: true, grandTotalRow: grandTotalPosition, suppressStickyTotalRow: totalStickySuppress, totalValueGetter: totalLabelGetter }"
          height="320px"
        />
      </div>
    </div>
    <h3>列聚合函数（aggFunc）</h3>
    <p>列级 <code>aggFunc</code> 声明归约方式：年龄 <code>avg</code>、薪资 <code>sum</code>、进度 <code>max</code>（另支持 <code>min</code>/<code>count</code>/<code>first</code>/<code>last</code>/自定义函数），未声明的数值列回退 <code>sum</code>。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="filterSortData"
          :columns="totalAggColumns"
          :ui-config="{ showSummary: true, sumText: '合计' }"
          height="320px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="filterSortData"
          :columns="totalAggColumns"
          :ui-config="{ showSummary: true, sumText: '合计' }"
          height="320px"
        />
      </div>
    </div>
    <h3>分组小计行（AG Grid groupTotalRow）</h3>
    <p>按部门分组，每组插入小计行（薪资 <code>sum</code> 聚合）。可切换小计位置、仅技术部选择性显示（回调返回 <code>undefined</code> 跳过）、保留组头聚合（<code>groupSuppressBlankHeader</code>，默认组头聚合置空避免与小计重复）。底部表尾同步显示 Grand 总计。</p>
    <div style="margin-bottom: 10px">
      小计位置:
      <ElSelect
        v-model="groupTotalPosition"
        size="small"
        style="width: 110px"
      >
        <ElOption
          label="bottom"
          value="bottom"
        />
        <ElOption
          label="top"
          value="top"
        />
      </ElSelect>
      <ElCheckbox
        v-model="selectiveGroupTotal"
        style="margin-left: 10px"
      >
        仅技术部显示小计（回调）
      </ElCheckbox>
      <ElCheckbox
        v-model="keepHeaderAgg"
        style="margin-left: 10px"
      >
        保留组头聚合
      </ElCheckbox>
    </div>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default 模式</h4>
        <adv-table
          mode="default"
          :data="rowGroupData"
          :columns="rowGroupTotalColumns"
          :row-group-config="{ field: 'department' }"
          :ui-config="{ grandTotalRow: 'bottom', groupTotalRow: selectiveGroupTotal ? selectiveGroupTotalFn : groupTotalPosition, groupSuppressBlankHeader: keepHeaderAgg, suppressStickyTotalRow: totalStickySuppress, totalValueGetter: totalLabelGetter }"
          height="400px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual 模式</h4>
        <adv-table
          mode="virtual"
          :data="rowGroupData"
          :columns="rowGroupTotalColumns"
          :row-group-config="{ field: 'department' }"
          :ui-config="{ grandTotalRow: 'bottom', groupTotalRow: selectiveGroupTotal ? selectiveGroupTotalFn : groupTotalPosition, groupSuppressBlankHeader: keepHeaderAgg, suppressStickyTotalRow: totalStickySuppress, totalValueGetter: totalLabelGetter }"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>
