<!-- eslint-disable @/max-lines -->
<!-- <zh/> 豁免：11.1 API 表面全覆盖（46 Props/5 v-model/53 Events/12 Slots/全量 Expose）是刻意的单页速查手册，逐项最小示例不宜拆分（COMPLEXITY-PLAN 战线二例外） | <en/> Exempt: the 11.1 API full-coverage page (46 props / 5 v-models / 53 events / 12 slots / every expose) is a deliberate single-page cheat sheet whose per-item minimal examples are not worth splitting (COMPLEXITY-PLAN battle line 2 exception) -->
<script setup lang="ts">
import { ElButton, ElInput, ElSwitch } from 'element-plus'
import { treeColumns } from '../../columns'
import { useDemoContext } from '../../demo-context'
import { genData } from '../../demo-data'
import { rowClassNameFn, summaryMethod } from '../../helpers'
import { surfaceEventHandlers, surfaceLog } from '../../surface-state'
import SurfaceEventBoard from '../../SurfaceEventBoard.vue'

const { cycleModeBehavior, surfaceApi2Ref, surfaceApi3Ref, surfaceApi4Ref, surfaceApi5Ref, surfaceApi6Ref, surfaceApi7Ref, surfaceApiCall, surfaceApiRef, surfaceBehavior, surfaceCols, surfaceData, surfaceDragData, surfaceEditCols, surfaceEditData, surfaceErrorSource, surfaceEventRef, surfaceGroupData, surfaceMode, surfaceMutateData, surfaceSpanMethod, surfaceSpanRef, surfaceSpanV2Ref, surfaceTooltipFormatter, surfaceVmColumns, surfaceVmData, surfaceVmLoading, surfaceVmQuickFilter, surfaceVmRef, surfaceVmSearchValues, tooltipDemoCols, tooltipDemoData, treeData } = useDemoContext()
</script>

<template>
  <div class="demo-section">
    <h1>11.1 API 表面全覆盖(Props / Events / Slots / Expose)</h1>
    <p>
      本页穷尽式演示 AdvTable 公共 API 表面的<strong>每一项</strong>：46 个 Props、5 个 v-model、53 个 Events、12 个 Slots，
      以及 <code>UseTableApiReturn</code> 的全部 Expose 成员（含 version / tableRootRef / tableSearchRef）。
      每个条目独占一节：标题给出名称，正文一句话说明作用，下方即时提供最小型可运行示例。
    </p>
    <p>
      <strong>覆盖清单：</strong>Props 46/46 · v-model 5/5 · Events 53/53（下方「全量绑定表」一次绑齐并记录到事件日志） ·
      Slots 12/12 · Expose 全量（按钮网格逐项触发）。与前面章节重复的条目在本页仍独立给出最小示例，便于当作速查手册。
    </p>

    <!-- ════════════════════════════════════════════════════════════
         <zh/> PROPS（46 项全量逐项覆盖） <en/> PROPS (46 items, full per-item coverage)
         ════════════════════════════════════════════════════════════ -->
    <h2>Props（46/46）</h2>

    <!-- <zh/> performanceProfile <en/> performanceProfile -->
    <h3>performanceProfile: 'high' | 'low'</h3>
    <p>低端设备降档。下方低档位关闭滚动看门狗等重路径。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default · low</h4>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          performance-profile="low"
          height="200px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual · high</h4>
        <adv-table
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          performance-profile="high"
          height="200px"
        />
      </div>
    </div>

    <!-- <zh/> modeSwitchBehavior <en/> modeSwitchBehavior -->
    <h3>modeSwitchBehavior: 'warn' | 'error' | 'silent'</h3>
    <p>运行时切换 mode 的行为策略。点按钮触发切换（'warn' 策略在 dev 模式下给出通知）。</p>
    <div class="mode-panel">
      <ElButton @click="cycleModeBehavior()">
        切换模式 (当前: {{ surfaceMode }})
      </ElButton>
    </div>
    <div class="dual-mode">
      <div class="mode-panel">
        <adv-table
          v-if="surfaceMode === 'default'"
          :key="`surf-${surfaceMode}-${surfaceBehavior}`"
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          :mode-switch-behavior="surfaceBehavior"
          height="250px"
        />
        <adv-table
          v-else
          :key="`surf-${surfaceMode}-${surfaceBehavior}`"
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          :mode-switch-behavior="surfaceBehavior"
          height="250px"
        />
      </div>
    </div>

    <!-- <zh/> sortConfig <en/> sortConfig -->
    <h3>sortConfig（多列排序上限）</h3>
    <p><code>maxSortColumns: 2</code> → 仅允许两列同时排序，超出时最早的列自动退出。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default</h4>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          :sort-config="{ maxSortColumns: 2 }"
          height="250px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual</h4>
        <adv-table
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          :sort-config="{ maxSortColumns: 2 }"
          height="250px"
        />
      </div>
    </div>

    <!-- <zh/> spanMethod <en/> spanMethod -->
    <h3>spanMethod（自定义合并函数）</h3>
    <p>覆盖内部自动合并逻辑；返回 undefined 则回退内部逻辑。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default</h4>
        <adv-table
          ref="surfaceSpanRef"
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          :span-method="surfaceSpanMethod"
          height="250px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual</h4>
        <adv-table
          ref="surfaceSpanV2Ref"
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          :span-method="surfaceSpanMethod"
          height="250px"
        />
      </div>
    </div>

    <!-- <zh/> rangeSelection <en/> rangeSelection -->
    <h3>rangeSelection（Excel 风格范围选择）</h3>
    <p>支持简写 <code>true</code> 与对象形态 <code>{ enabled, autoCopy }</code>。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default · autoCopy</h4>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          :range-selection="{ enabled: true, autoCopy: true }"
          height="250px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual · enabled</h4>
        <adv-table
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          :range-selection="true"
          height="250px"
        />
      </div>
    </div>

    <!-- <zh/> stripe <en/> stripe -->
    <h3>stripe（斑马纹）</h3>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default</h4>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          stripe
          height="250px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual</h4>
        <adv-table
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          stripe
          height="250px"
        />
      </div>
    </div>

    <!-- <zh/> showHeader <en/> showHeader -->
    <h3>showHeader（表头显隐）</h3>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default · false</h4>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          :show-header="false"
          height="200px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual · false</h4>
        <adv-table
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          :show-header="false"
          height="200px"
        />
      </div>
    </div>

    <!-- <zh/> size <en/> size -->
    <h3>size（表格尺寸）</h3>
    <p>可选 'default' | 'small' | 'large'（透传给 ElTable，virtual 模式下影响 rowHeight 等）。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default · small</h4>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          size="small"
          height="250px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual · small</h4>
        <adv-table
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          size="small"
          height="250px"
        />
      </div>
    </div>

    <!-- <zh/> highlightCurrentRow <en/> highlightCurrentRow -->
    <h3>highlightCurrentRow（高亮当前行）</h3>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default</h4>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          highlight-current-row
          height="250px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual</h4>
        <adv-table
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          highlight-current-row
          height="250px"
        />
      </div>
    </div>

    <!-- <zh/> tableLayout <en/> tableLayout -->
    <h3>tableLayout（布局算法）</h3>
    <p><code>'fixed'</code>（默认）列宽由表格宽度决定；<code>'auto'</code> 列宽由内容决定。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default · auto</h4>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          table-layout="auto"
          height="250px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual · auto</h4>
        <adv-table
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          table-layout="auto"
          height="250px"
        />
      </div>
    </div>

    <!-- <zh/> estimatedRowHeight <en/> estimatedRowHeight -->
    <h3>estimatedRowHeight（预估行高）</h3>
    <p>仅 virtual 模式生效，显式设置可覆盖内部回退。</p>
    <div class="mode-panel">
      <h4>Virtual · 48px</h4>
      <adv-table
        mode="virtual"
        :data="surfaceData"
        :columns="surfaceCols"
        :estimated-row-height="48"
        height="250px"
      />
    </div>

    <!-- <zh/> tooltipFormatter <en/> tooltipFormatter -->
    <h3>tooltipFormatter（溢出 tooltip 格式化）</h3>
    <p>表级别默认格式化函数，可被列级别覆盖。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default</h4>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          :tooltip-formatter="surfaceTooltipFormatter"
          height="250px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual</h4>
        <adv-table
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          :tooltip-formatter="surfaceTooltipFormatter"
          height="250px"
        />
      </div>
    </div>

    <!-- <zh/> containerLayout <en/> containerLayout -->
    <h3>containerLayout（容器布局）</h3>
    <p><code>'bordered'</code>（默认）带边框内边距；<code>'bare'</code> 无边框无内边距。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default · bare</h4>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          container-layout="bare"
          height="250px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual · bare</h4>
        <adv-table
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          container-layout="bare"
          height="250px"
        />
      </div>
    </div>

    <!-- <zh/> debug <en/> debug -->
    <h3>debug（调试模式）</h3>
    <p>支持简写 <code>true</code> 与对象形态 <code>{ enabled, perf, domains }</code>。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default · { enabled, perf }</h4>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          :debug="{ enabled: true, perf: true }"
          height="250px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual · true</h4>
        <adv-table
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          :debug="true"
          height="250px"
        />
      </div>
    </div>

    <!-- <zh/> rowPinConfig <en/> rowPinConfig -->
    <h3>rowPinConfig（行固定）</h3>
    <p>将指定行固定在顶部或底部，滚动时始终可见。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default · top + bottom</h4>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          :row-config="{ rowKey: 'id' }"
          :row-pin-config="{ topRowKeys: ['1'], bottomRowKeys: ['5'] }"
          height="250px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual · top + bottom</h4>
        <adv-table
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          :row-config="{ rowKey: 'id' }"
          :row-pin-config="{ topRowKeys: ['1'], bottomRowKeys: ['5'] }"
          height="250px"
        />
      </div>
    </div>

    <!-- <zh/> loading <en/> loading -->
    <h3>loading（加载状态）</h3>
    <p>与内部 loading 通过 OR 合并。</p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default · loading</h4>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          :loading="true"
          height="200px"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual · loading</h4>
        <adv-table
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          :loading="true"
          height="200px"
        />
      </div>
    </div>

    <!-- <zh/> mode <en/> mode -->
    <h3>mode（渲染模式）</h3>
    <p><code>'default'</code>（ElTable）/ <code>'virtual'</code>（ElTableV2 虚拟滚动）。下方为 virtual 模式，长列表仅渲染视口内行。</p>
    <adv-table
      mode="virtual"
      :data="surfaceData"
      :columns="surfaceCols"
      height="200px"
    />

    <!-- <zh/> border <en/> border -->
    <h3>border（边框）</h3>
    <p>显示外边框与纵向内边框线。与列宽拖拽无关（那由 <code>resizable</code> 控制），仅视觉。</p>
    <adv-table
      mode="default"
      :data="surfaceData.slice(0, 6)"
      :columns="surfaceCols"
      border
      height="200px"
    />

    <!-- <zh/> resizable <en/> resizable -->
    <h3>resizable（列宽拖拽）</h3>
    <p>允许拖动列边界调整宽度；列级 <code>resizable</code> 优先于表级。拖动下方列边界观察。</p>
    <adv-table
      mode="default"
      :data="surfaceData.slice(0, 6)"
      :columns="surfaceCols"
      resizable
      height="200px"
    />

    <!-- <zh/> toolbar <en/> toolbar -->
    <h3>toolbar（工具栏）</h3>
    <p>顶部工具栏：列设置、刷新、导出、导入等按钮。点各按钮体验对应面板。</p>
    <adv-table
      mode="default"
      :data="surfaceData.slice(0, 6)"
      :columns="surfaceCols"
      :toolbar="{ columnSetting: true, refreshBtn: true, exportBtn: true, importBtn: true }"
      height="200px"
    />

    <!-- <zh/> search <en/> search -->
    <h3>search（搜索表单）</h3>
    <p>顶部查询表单区。改姓名后点「查询」触发 query / searchChange 事件。</p>
    <adv-table
      mode="default"
      :data="surfaceData.slice(0, 6)"
      :columns="surfaceCols"
      :search="{ enabled: true, fields: [{ prop: 'name', label: '姓名' }] }"
      height="200px"
    />

    <!-- <zh/> pagination <en/> pagination -->
    <h3>pagination（分页）</h3>
    <p>客户端分页配置。下方每页 5 条，翻页触发 pageChange。</p>
    <adv-table
      mode="default"
      :data="surfaceData"
      :columns="surfaceCols"
      :pagination="{ pageSize: 5, pageSizes: [5, 10] }"
      height="200px"
    />

    <!-- <zh/> request <en/> request -->
    <h3>request（远程数据源）</h3>
    <p>声明式请求配置（source / auto / 重试 / 参数映射）。打开控制台可看到自动发起的请求日志。</p>
    <adv-table
      mode="default"
      :columns="surfaceCols"
      :request="{ source: async () => ({ data: genData(6), total: 6 }), auto: true }"
      height="200px"
    />

    <!-- <zh/> urlState <en/> urlState -->
    <h3>urlState（URL 状态同步）</h3>
    <p>把分页/搜索参数同步到地址栏 query。翻页后观察浏览器 URL 变化。</p>
    <adv-table
      mode="default"
      :data="surfaceData"
      :columns="surfaceCols"
      :url-state="{ enabled: true }"
      :pagination="{ pageSize: 5 }"
      height="200px"
    />

    <!-- <zh/> externalFilter <en/> externalFilter -->
    <h3>externalFilter（外部筛选器）</h3>
    <p>业务过滤钩子，位于列筛选之后、排序之前。下方过滤掉年龄 &lt; 30 的行。</p>
    <adv-table
      mode="default"
      :data="surfaceData"
      :columns="surfaceCols"
      :external-filter="{ isExternalFilterPresent: () => true, doesExternalFilterPass: (row: any) => Number(row.age) >= 30 }"
      height="200px"
    />

    <!-- <zh/> columns <en/> columns -->
    <h3>columns（列定义数组）</h3>
    <p>声明式列配置；不传时 default 模式可改用 <code>&lt;el-table-column&gt;</code> 子组件（见 default 插槽一节）。</p>
    <adv-table
      mode="default"
      :data="surfaceData.slice(0, 6)"
      :columns="surfaceCols"
      height="200px"
    />

    <!-- <zh/> data <en/> data -->
    <h3>data（行数据数组）</h3>
    <p>静态数据源（未设置 <code>request.source</code> 时生效）。作为 v-model 的用法见下方「v-model」一节。</p>
    <adv-table
      mode="default"
      :data="surfaceData"
      :columns="surfaceCols"
      height="200px"
    />

    <!-- <zh/> height <en/> height -->
    <h3>height（表格高度）</h3>
    <p>px 数值或 CSS 字符串；未设置时自适应父容器。下方固定 160px，内容超出即出滚动条。</p>
    <adv-table
      mode="default"
      :data="surfaceData"
      :columns="surfaceCols"
      :height="160"
    />

    <!-- <zh/> selectedRowKeys <en/> selectedRowKeys -->
    <h3>selectedRowKeys（受控选中）</h3>
    <p>以行 key 数组受控勾选状态，配合 <code>rowConfig.rowKey</code> 使用。下方预置选中第 1、2 行。</p>
    <adv-table
      mode="default"
      :data="surfaceData.slice(0, 6)"
      :columns="surfaceCols"
      :row-config="{ rowKey: 'id', rowSelection: 'multiple' }"
      :selected-row-keys="['1', '2']"
      height="200px"
    />

    <!-- <zh/> quickFilter <en/> quickFilter -->
    <h3>quickFilter（全局快速搜索）</h3>
    <p>跨列模糊匹配文本。下方预置 <code>"用户1"</code>，仅命中行可见；v-model 用法见「v-model」一节。</p>
    <adv-table
      mode="default"
      :data="surfaceData"
      :columns="surfaceCols"
      quick-filter="用户1"
      height="200px"
    />

    <!-- <zh/> editConfig <en/> editConfig -->
    <h3>editConfig（编辑全局配置）</h3>
    <p>编辑触发方式、单击即编等表级开关。下方开启 <code>singleClickEdit</code>，单击姓名/年龄单元格即可编辑。</p>
    <adv-table
      mode="default"
      :data="surfaceEditData.slice(0, 6)"
      :columns="surfaceEditCols"
      :edit-config="{ singleClickEdit: true }"
      height="200px"
    />

    <!-- <zh/> columnConfig <en/> columnConfig -->
    <h3>columnConfig（列全局配置）</h3>
    <p>默认列定义（defaultColDef）、列拖拽、列分组开关等。下方开启列拖拽排序。</p>
    <adv-table
      mode="default"
      :data="surfaceData.slice(0, 6)"
      :columns="surfaceCols"
      :column-config="{ columnDraggable: true }"
      height="200px"
    />

    <!-- <zh/> rowConfig <en/> rowConfig -->
    <h3>rowConfig（行配置）</h3>
    <p>行 key、行选择（single/multiple）、行拖拽等。下方多选 + rowKey='id'。</p>
    <adv-table
      mode="default"
      :data="surfaceData.slice(0, 6)"
      :columns="surfaceCols"
      :row-config="{ rowKey: 'id', rowSelection: 'multiple' }"
      height="200px"
    />

    <!-- <zh/> filterConfig <en/> filterConfig -->
    <h3>filterConfig（筛选面板配置）</h3>
    <p>筛选交互模式（floatingFilter / sidePanel 等）。下方开启浮动筛选，姓名列头下方出现输入框。</p>
    <adv-table
      mode="default"
      :data="surfaceData.slice(0, 6)"
      :columns="surfaceCols"
      :filter-config="{ floatingFilter: true }"
      height="200px"
    />

    <!-- <zh/> spanConfig <en/> spanConfig -->
    <h3>spanConfig（声明式合并）</h3>
    <p>按字段的行/列合并配置，支持扁平简写 <code>{ status: true }</code>（≡ <code>{ rows: { status: true } }</code>）。同值相邻单元格自动合并。</p>
    <adv-table
      mode="default"
      :data="surfaceData.slice(0, 6)"
      :columns="surfaceCols"
      :span-config="{ status: true }"
      height="200px"
    />

    <!-- <zh/> uiConfig <en/> uiConfig -->
    <h3>uiConfig（UI 杂项配置）</h3>
    <p>合计行、空态占位、货币格式等 UI 开关。下方开启合计行（summaryMethod 见 helpers）。</p>
    <adv-table
      mode="default"
      :data="surfaceData.slice(0, 6)"
      :columns="surfaceCols"
      :ui-config="{ showSummary: true, summaryMethod }"
      height="200px"
    />

    <!-- <zh/> columnState <en/> columnState -->
    <h3>columnState（列状态持久化）</h3>
    <p>列宽/顺序/显隐自动存到 localStorage。刷新页面后本表列状态保持不变（先拖动列宽再刷新验证）。</p>
    <adv-table
      mode="default"
      :data="surfaceData.slice(0, 6)"
      :columns="surfaceCols"
      :column-state="{ enabled: true, storageKey: 'surface-props-column-state' }"
      :toolbar="{ columnSetting: true }"
      height="200px"
    />

    <!-- <zh/> menuConfig <en/> menuConfig -->
    <h3>menuConfig（右键菜单配置）</h3>
    <p>单元格右键菜单的区域与菜单项配置。右键下方单元格弹出复制菜单。</p>
    <adv-table
      mode="default"
      :data="surfaceData.slice(0, 6)"
      :columns="surfaceCols"
      :menu-config="{ body: { enabled: true, options: [['copyCell', 'copyRow']] } }"
      height="200px"
    />

    <!-- <zh/> interceptor <en/> interceptor -->
    <h3>interceptor（行为拦截器）</h3>
    <p>拦截键盘/编辑/点击等内置行为，回调返回 false 即中止该次默认处理链。下方拦截 <code>event.rowClick</code>（恒返回 false），行点击后续逻辑被中止。</p>
    <adv-table
      mode="default"
      :data="surfaceData.slice(0, 6)"
      :columns="surfaceCols"
      :row-config="{ rowKey: 'id', rowSelection: 'multiple' }"
      :interceptor="{ 'event.rowClick': () => false }"
      height="200px"
    />

    <!-- <zh/> treeConfig <en/> treeConfig -->
    <h3>treeConfig（树形数据）</h3>
    <p>把 children 层级数据展平为带缩进的树形行。下方默认全部展开，点箭头折叠/展开。</p>
    <adv-table
      mode="default"
      :data="treeData"
      :columns="treeColumns"
      :tree-config="{ children: 'children', defaultExpandAll: true }"
      :row-config="{ rowKey: 'id' }"
      height="200px"
    />

    <!-- <zh/> rowGroupConfig <en/> rowGroupConfig -->
    <h3>rowGroupConfig（行分组）</h3>
    <p>按字段值分组生成带分组头的行数组。下方按 department 字段分组。</p>
    <adv-table
      mode="default"
      :data="surfaceGroupData.slice(0, 9)"
      :columns="surfaceCols"
      :row-group-config="{ field: 'department', defaultExpandAll: true }"
      height="200px"
    />

    <!-- <zh/> rowExpandConfig <en/> rowExpandConfig -->
    <h3>rowExpandConfig（展开行）</h3>
    <p>主/明细展开行能力（accordion、行高等）。点首列箭头展开，内容见 expandRow 插槽一节。</p>
    <adv-table
      mode="default"
      :data="surfaceData.slice(0, 6)"
      :columns="surfaceCols"
      :row-config="{ rowKey: 'id' }"
      :row-expand-config="{ enabled: true, expandRowHeight: 60 }"
      height="200px"
    >
      <template #expandRow="{ row }">
        <div class="surface-expand-content">
          {{ row.name }} 的展开明细（rowExpandConfig 生效中）
        </div>
      </template>
    </adv-table>

    <!-- <zh/> emptyText <en/> emptyText -->
    <h3>emptyText（空态文案）</h3>
    <p>无数据时显示的占位文本；default 模式透传 ElTable，virtual 模式经 #empty 插槽实现。</p>
    <adv-table
      mode="default"
      :data="[]"
      :columns="surfaceCols"
      empty-text="暂无数据（emptyText 自定义文案）"
      height="200px"
    />

    <!-- <zh/> rowClassName <en/> rowClassName -->
    <h3>rowClassName（行类名）</h3>
    <p>函数或字符串行类名，两种模式行为一致。下方按行号奇偶/状态加类名（配合 demo-row 样式）。</p>
    <adv-table
      mode="default"
      :data="surfaceData.slice(0, 6)"
      :columns="surfaceCols"
      :row-class-name="rowClassNameFn"
      height="200px"
    />

    <!-- <zh/> tooltipEffect <en/> tooltipEffect -->
    <h3>tooltipEffect（溢出 tooltip 主题）</h3>
    <p>溢出提示的 ElTooltip effect 主题，默认 'dark'。下方改 'light'，悬浮溢出单元格观察。</p>
    <adv-table
      mode="default"
      :data="tooltipDemoData.slice(0, 6)"
      :columns="tooltipDemoCols"
      tooltip-effect="light"
      height="200px"
    />

    <!-- <zh/> tooltipOptions <en/> tooltipOptions -->
    <h3>tooltipOptions（溢出 tooltip 选项）</h3>
    <p>溢出提示的自定义选项（placement / popperClass 等）。下方 placement 固定 top。</p>
    <adv-table
      mode="default"
      :data="tooltipDemoData.slice(0, 6)"
      :columns="tooltipDemoCols"
      :tooltip-options="{ placement: 'top' }"
      height="200px"
    />

    <!-- ════════════════════════════════════════════════════════════
         v-model（5 个 defineModel 逐项概况）
         ════════════════════════════════════════════════════════════ -->
    <h2>v-model（5/5）</h2>
    <p>
      组件声明 5 个 <code>defineModel</code>（见 <code>packages/table/src/table.vue</code>）：
      data / columns / loading / quickFilter / searchValues。每个 v-model 均为「prop + update:X 事件」双向通道，
      下方各附一个最小交互示例。
    </p>

    <h3>v-model:data（双向行数据）</h3>
    <p>表格内部事务（applyTransaction / 编辑提交）会回写父组件数组；父组件改数组，表格同步。点按钮由表格侧加行观察计数。</p>
    <div class="mode-panel">
      <ElButton
        size="small"
        @click="surfaceVmRef?.applyTransaction?.({ add: [{ id: String(Date.now()), name: `新增${Date.now() % 1000}`, age: 22 }] })"
      >
        表格侧加一行（applyTransaction）
      </ElButton>
      <span style="margin-left: 8px; font-size: 12px; color: #606266">父组件已绑定 {{ surfaceVmData.length }} 条</span>
      <adv-table
        ref="surfaceVmRef"
        v-model:data="surfaceVmData"
        mode="default"
        :columns="surfaceCols"
        height="200px"
      />
    </div>

    <h3>v-model:columns（双向列状态）</h3>
    <p>列显隐/顺序/宽度变化经该模型回写。点按钮由父组件侧增删列，表格即时响应。</p>
    <div class="mode-panel">
      <ElButton
        size="small"
        @click="surfaceVmColumns.length < 6 ? surfaceVmColumns.push({ prop: 'createdAt', label: '创建时间', width: 160 }) : surfaceVmColumns.pop()"
      >
        {{ surfaceVmColumns.length < 6 ? '加一列（创建时间）' : '移除最后一列' }}
      </ElButton>
      <span style="margin-left: 8px; font-size: 12px; color: #606266">当前 {{ surfaceVmColumns.length }} 列</span>
      <adv-table
        v-model:columns="surfaceVmColumns"
        mode="default"
        :data="surfaceVmData.slice(0, 6)"
        height="200px"
      />
    </div>

    <h3>v-model:loading（双向加载态）</h3>
    <p>外部开关与表格 loading 联动；表格内部请求期间也会写回该模型。切换下方开关观察遮罩。</p>
    <div class="mode-panel">
      <ElSwitch v-model="surfaceVmLoading" />
      <span style="margin-left: 8px; font-size: 12px; color: #606266">surfaceVmLoading = {{ surfaceVmLoading }}</span>
      <adv-table
        v-model:loading="surfaceVmLoading"
        mode="default"
        :data="surfaceVmData.slice(0, 6)"
        :columns="surfaceCols"
        height="200px"
      />
    </div>

    <h3>v-model:quickFilter（双向全局搜索）</h3>
    <p>输入框与表格全局过滤共享同一字符串：输入即过滤，表格内快速搜索框改动也会回写输入框。</p>
    <div class="mode-panel">
      <ElInput
        v-model="surfaceVmQuickFilter"
        placeholder="输入如 用户1"
        style="width: 220px; margin-bottom: 8px"
        clearable
      />
      <adv-table
        v-model:quick-filter="surfaceVmQuickFilter"
        mode="default"
        :data="surfaceVmData"
        :columns="surfaceCols"
        height="200px"
      />
    </div>

    <h3>v-model:searchValues（双向查询表单模型）</h3>
    <p>搜索表单字段值与该对象双向同步：表单输入回写模型，程序改模型也会反映到表单。下方 JSON 实时回显。</p>
    <div class="mode-panel">
      <pre style="font-size: 11px; margin: 0 0 8px">{{ JSON.stringify(surfaceVmSearchValues) }}</pre>
      <adv-table
        v-model:search-values="surfaceVmSearchValues"
        mode="default"
        :data="surfaceVmData"
        :columns="surfaceCols"
        :search="{ enabled: true, fields: [{ prop: 'name', label: '姓名' }, { prop: 'status', label: '状态' }] }"
        height="200px"
      />
    </div>

    <!-- ════════════════════════════════════════════════════════════
         EVENTS（53 项全量：全量绑定表 + 速查表 + 分组交互示例）
         ════════════════════════════════════════════════════════════ -->
    <h2>Events（53/53）</h2>

    <h3>全量绑定表（v-on 一次绑齐 53 个事件）</h3>
    <p>
      下方 Default 面板通过 <code>v-on="surfaceEventHandlers"</code> 绑定全部 53 个事件（与 11.0 Mega 页同构），
      并配置了编辑/搜索/分页/工具栏/右键菜单/行拖拽/范围选择等能力以覆盖所有触发路径；Virtual 面板补齐
      endReached / rowsRendered。触发记录统一进入页面底部「事件日志」（高频事件仅计数：scroll / rowsRendered /
      cellMouseEnter / cellMouseLeave / 键盘三事件）。<SurfaceEventBoard section="coverage" />
    </p>
    <div class="dual-mode">
      <div class="mode-panel">
        <h4>Default · 53 事件全绑定</h4>
        <adv-table
          mode="default"
          :data="surfaceData"
          :columns="surfaceCols"
          :row-config="{ rowKey: 'id', rowSelection: 'multiple', rowDraggable: true }"
          :edit-config="{ singleClickEdit: true }"
          :pagination="{ pageSize: 5 }"
          :search="{ enabled: true, fields: [{ prop: 'name', label: '姓名' }] }"
          :toolbar="{ columnSetting: true, refreshBtn: true, exportBtn: true, exportCsvBtn: true, importBtn: true }"
          :menu-config="{ body: { enabled: true, options: [['copyCell', 'copyRow'], ['clearSort']] } }"
          :range-selection="true"
          height="320px"
          v-on="surfaceEventHandlers"
        />
      </div>
      <div class="mode-panel">
        <h4>Virtual · 53 事件全绑定</h4>
        <adv-table
          mode="virtual"
          :data="surfaceData"
          :columns="surfaceCols"
          :row-config="{ rowKey: 'id', rowSelection: 'multiple' }"
          :pagination="{ pageSize: 5, infiniteScroll: true }"
          height="320px"
          v-on="surfaceEventHandlers"
        />
      </div>
    </div>
    <SurfaceEventBoard section="unfired" />

    <h3>事件速查表（53 项 · 各自概况）</h3>
    <SurfaceEventBoard section="checklist" />

    <h3>以下为按域分组的最小交互示例（与全量绑定表互补，日志同样进「事件日志」）</h3>

    <h3>pageChange / query / reset / request / refresh</h3>
    <div class="mode-panel">
      <adv-table
        ref="surfaceEventRef"
        mode="default"
        :data="surfaceData"
        :columns="surfaceCols"
        :pagination="{ pageSize: 5 }"
        :search="{ enabled: true, fields: [{ prop: 'name', label: '姓名' }] }"
        height="300px"
        @page-change="(p: any, s: any, id: any) => surfaceLog.push(`pageChange: ${p}/${s}`)"
        @query="(p: any, id: any) => surfaceLog.push(`query: ${JSON.stringify(p)}`)"
        @reset="(id: any) => surfaceLog.push('reset')"
        @request="(p: any, id: any) => surfaceLog.push('request')"
        @refresh="(id: any) => surfaceLog.push('refresh')"
      />
    </div>

    <h3>selectionChange / select / selectAll</h3>
    <div class="mode-panel">
      <adv-table
        mode="default"
        :data="surfaceData"
        :columns="surfaceCols"
        :row-config="{ rowSelection: 'multiple' }"
        height="250px"
        @selection-change="(rows: any, id: any) => surfaceLog.push(`selectionChange: ${rows.length} rows`)"
        @select="({ selection, row }: any, id: any) => surfaceLog.push(`select: ${row?.name}`)"
        @select-all="(sel: any, id: any) => surfaceLog.push(`selectAll: ${sel.length}`)"
      />
    </div>

    <h3>sortChange</h3>
    <div class="mode-panel">
      <adv-table
        mode="default"
        :data="surfaceData"
        :columns="surfaceCols"
        height="250px"
        @sort-change="({ prop, order }: any, id: any) => surfaceLog.push(`sortChange: ${prop} ${order}`)"
      />
    </div>

    <h3>rowContextmenu / rowDblclick</h3>
    <div class="mode-panel">
      <adv-table
        mode="default"
        :data="surfaceData"
        :columns="surfaceCols"
        height="250px"
        @row-contextmenu="({ rowData }: any, id: any) => surfaceLog.push(`rowContextmenu: ${rowData.name}`)"
        @row-dblclick="({ rowData }: any, id: any) => surfaceLog.push(`rowDblclick: ${rowData.name}`)"
      />
    </div>

    <h3>cellMouseEnter / cellMouseLeave / cellDblclick / cellContextmenu</h3>
    <div class="mode-panel">
      <adv-table
        mode="default"
        :data="surfaceData"
        :columns="surfaceCols"
        height="250px"
        @cell-mouse-enter="({ rowData, column }: any, id: any) => surfaceLog.push(`cellMouseEnter: ${rowData.name}/${column.prop}`)"
        @cell-mouse-leave="(id: any) => surfaceLog.push('cellMouseLeave')"
        @cell-dblclick="({ rowData, column }: any, id: any) => surfaceLog.push(`cellDblclick: ${rowData.name}/${column.prop}`)"
        @cell-contextmenu="({ rowData, column }: any, id: any) => surfaceLog.push(`cellContextmenu: ${rowData.name}/${column.prop}`)"
      />
    </div>

    <h3>headerClick / headerContextmenu</h3>
    <div class="mode-panel">
      <adv-table
        mode="default"
        :data="surfaceData"
        :columns="surfaceCols"
        height="250px"
        @header-click="({ column }: any, id: any) => surfaceLog.push(`headerClick: ${column.prop}`)"
        @header-contextmenu="({ column }: any, id: any) => surfaceLog.push(`headerContextmenu: ${column.prop}`)"
      />
    </div>

    <h3>scroll</h3>
    <div class="mode-panel">
      <adv-table
        mode="default"
        :data="surfaceData"
        :columns="surfaceCols"
        height="200px"
        @scroll="({ scrollTop }: any, id: any) => surfaceLog.push(`scroll: top=${scrollTop}`)"
      />
    </div>

    <h3>dataChange / beforeDataChange / afterDataChange</h3>
    <div class="mode-panel">
      <ElButton @click="surfaceMutateData()">
        变更数据
      </ElButton>
      <adv-table
        mode="default"
        :data="surfaceData"
        :columns="surfaceCols"
        height="250px"
        @data-change="({ reason }: any, id: any) => surfaceLog.push(`dataChange: ${reason}`)"
        @before-data-change="({ reason }: any, id: any) => surfaceLog.push(`beforeDataChange: ${reason}`)"
        @after-data-change="({ reason }: any, id: any) => surfaceLog.push(`afterDataChange: ${reason}`)"
      />
    </div>

    <h3>cellValueChanged / cellEditingStopped / cellEditingRequest</h3>
    <div class="mode-panel">
      <adv-table
        mode="default"
        :data="surfaceEditData"
        :columns="surfaceEditCols"
        :edit-config="{ singleClickEdit: true }"
        height="250px"
        @cell-value-changed="({ row, prop, newValue }: any) => surfaceLog.push(`cellValueChanged: ${row.name}.${prop}=${newValue}`)"
        @cell-editing-stopped="({ row, prop }: any) => surfaceLog.push(`cellEditingStopped: ${row.name}.${prop}`)"
        @cell-editing-request="({ row, prop }: any) => surfaceLog.push(`cellEditingRequest: ${row.name}.${prop}`)"
      />
    </div>

    <h3>fullRowEdit / cellEditingCancelled</h3>
    <div class="mode-panel">
      <adv-table
        mode="default"
        :data="surfaceEditData"
        :columns="surfaceEditCols"
        :edit-config="{ trigger: 'manual' }"
        height="250px"
        @full-row-edit="({ row, changes }: any) => surfaceLog.push(`fullRowEdit: ${row.name} (${changes.length} fields)`)"
        @cell-editing-cancelled="({ reason }: any) => surfaceLog.push(`cellEditingCancelled: ${reason}`)"
      />
    </div>

    <h3>crossFieldValidateError / batchPendingChange</h3>
    <div class="mode-panel">
      <adv-table
        mode="default"
        :data="surfaceEditData"
        :columns="surfaceEditCols"
        :edit-config="{ singleClickEdit: true }"
        height="250px"
        @cross-field-validate-error="({ errors }: any) => surfaceLog.push(`crossFieldValidateError: ${errors.join(',')}`)"
        @batch-pending-change="(has: any) => surfaceLog.push(`batchPendingChange: ${has}`)"
      />
    </div>

    <h3>rowDragEnd</h3>
    <div class="mode-panel">
      <adv-table
        mode="default"
        :data="surfaceDragData"
        :columns="surfaceCols"
        :row-config="{ rowDraggable: true }"
        height="250px"
        @row-drag-end="({ sourceRow, targetRow }: any) => surfaceLog.push(`rowDragEnd: ${sourceRow?.name} → ${targetRow?.name ?? 'none'}`)"
      />
    </div>

    <h3>cellKeyPress / cellKeyUp</h3>
    <div class="mode-panel">
      <adv-table
        mode="default"
        :data="surfaceData"
        :columns="surfaceCols"
        height="250px"
        @cell-key-press="({ rowData, column }: any) => surfaceLog.push(`cellKeyPress: ${rowData.name}/${column.prop}`)"
        @cell-key-up="({ rowData, column }: any) => surfaceLog.push(`cellKeyUp: ${rowData.name}/${column.prop}`)"
      />
    </div>

    <h3>columnVisible / columnMoved</h3>
    <div class="mode-panel">
      <adv-table
        mode="default"
        :data="surfaceData"
        :columns="surfaceCols"
        :toolbar="{ columnSetting: true }"
        height="250px"
        @column-visible="({ columnKey, visible }: any) => surfaceLog.push(`columnVisible: ${columnKey}=${visible}`)"
        @column-moved="({ columns }: any) => surfaceLog.push(`columnMoved: ${columns.length} cols`)"
      />
    </div>

    <h3>rowExpand / rowCollapse</h3>
    <div class="mode-panel">
      <adv-table
        mode="default"
        :data="surfaceData"
        :columns="surfaceCols"
        :row-config="{ rowKey: 'id' }"
        :row-expand-config="{ enabled: true, expandRowHeight: 80 }"
        height="250px"
        @row-expand="({ row, expanded }: any) => surfaceLog.push(`rowExpand: ${row.name}=${expanded}`)"
        @row-collapse="({ row }: any) => surfaceLog.push(`rowCollapse: ${row.name}`)"
      />
    </div>

    <h3>searchChange</h3>
    <div class="mode-panel">
      <adv-table
        mode="default"
        :data="surfaceData"
        :columns="surfaceCols"
        :search="{ enabled: true, fields: [{ prop: 'name', label: '姓名' }] }"
        height="250px"
        @search-change="({ key, val }: any) => surfaceLog.push(`searchChange: ${key}=${val}`)"
      />
    </div>

    <h3>endReached / rowsRendered（仅 virtual 模式）</h3>
    <div class="mode-panel">
      <adv-table
        mode="virtual"
        :data="surfaceData"
        :columns="surfaceCols"
        height="250px"
        @end-reached="(dist: any) => surfaceLog.push(`endReached: ${dist}px`)"
        @rows-rendered="({ rowVisibleStart, rowVisibleEnd }: any) => surfaceLog.push(`rowsRendered: ${rowVisibleStart}-${rowVisibleEnd}`)"
      />
    </div>

    <h3>error</h3>
    <p>结构化错误事件。下方通过 <code>request.source</code> 抛错触发。</p>
    <div class="mode-panel">
      <adv-table
        mode="default"
        :columns="surfaceCols"
        :request="{ source: surfaceErrorSource, auto: true }"
        height="200px"
        @error="(err: any) => surfaceLog.push(`error: ${err.message}`)"
      />
    </div>

    <!-- <zh/> 事件日志 <en/> Event log -->
    <h3>事件日志</h3>
    <SurfaceEventBoard section="log" />

    <!-- ════════════════════════════════════════════════════════════
         SLOTS（12 个全量覆盖）
         ════════════════════════════════════════════════════════════ -->
    <h2>Slots（12/12）</h2>
    <p>12 个插槽逐项概况：default / append / error / empty / footer / footer-extra / header-left / header-right / expandRow / groupHeader / 动态 <code>#[prop]</code> / 动态 <code>#[prop]-header</code>。</p>

    <h3>empty（空数据占位，含 error 绑定）</h3>
    <p>无数据时渲染，插槽作用域带 <code>error</code>（请求失败时非空）。下方数据置空演示。</p>
    <div class="mode-panel">
      <adv-table
        mode="default"
        :data="[]"
        :columns="surfaceCols"
        height="200px"
      >
        <template #empty="{ error }">
          <div class="surface-error-slot">
            {{ error ? `加载失败：${error.message}` : '空数据（#empty 插槽，作用域含 error）' }}
          </div>
        </template>
      </adv-table>
    </div>

    <h3>header-left / header-right（工具栏两侧）</h3>
    <p>工具栏区域左右两侧的自定义内容插槽（无作用域参数），常放标题与统计信息。</p>
    <div class="mode-panel">
      <adv-table
        mode="default"
        :data="surfaceData.slice(0, 6)"
        :columns="surfaceCols"
        :toolbar="{ columnSetting: true }"
        height="200px"
      >
        <template #header-left>
          <span class="surface-header-slot">← header-left 自定义标题</span>
        </template>
        <template #header-right>
          <span class="surface-cell-slot">header-right 共 {{ surfaceData.length }} 条 →</span>
        </template>
      </adv-table>
    </div>

    <h3>default（仅 default 模式）</h3>
    <p>自定义列渲染（virtual 模式下被忽略并显示警告）。</p>
    <div class="mode-panel">
      <adv-table
        mode="default"
        :data="surfaceData"
        :columns="surfaceCols"
        height="250px"
      >
        <template #default>
          <el-table-column
            prop="name"
            label="姓名(default slot)"
          />
          <el-table-column
            prop="age"
            label="年龄(default slot)"
          />
        </template>
      </adv-table>
    </div>

    <h3>footer / footer-extra</h3>
    <p><code>footer</code> 完全替换底栏（接收 currentPage/pageSize/total）；<code>footer-extra</code> 在分页左侧追加内容。</p>
    <div class="mode-panel">
      <adv-table
        mode="default"
        :data="surfaceData"
        :columns="surfaceCols"
        :pagination="{ pageSize: 5 }"
        height="250px"
      >
        <template #footer="{ currentPage, pageSize, total }">
          <span>自定义底栏：第 {{ currentPage }} 页 / 共 {{ total }} 条 (每页 {{ pageSize }} 条)</span>
        </template>
        <template #footer-extra>
          <span style="color: #909399">自定义左侧内容</span>
        </template>
      </adv-table>
    </div>

    <h3>append（仅 virtual 模式）</h3>
    <p>在表格底部追加一行合成行（与 ElTableV2 的 append slot 行为一致）。</p>
    <div class="mode-panel">
      <adv-table
        mode="virtual"
        :data="surfaceData"
        :columns="surfaceCols"
        height="250px"
      >
        <template #append>
          <div class="surface-append-row">
            —— 这是 append 插槽追加的合成行 ——
          </div>
        </template>
      </adv-table>
    </div>

    <h3>expandRow（主/明细视图）</h3>
    <p>展开行内容插槽，接收 row / rowKey。</p>
    <div class="mode-panel">
      <adv-table
        mode="default"
        :data="surfaceData"
        :columns="surfaceCols"
        :row-config="{ rowKey: 'id' }"
        :row-expand-config="{ enabled: true, expandRowHeight: 80 }"
        height="250px"
      >
        <template #expandRow="{ row }">
          <div class="surface-expand-content">
            <strong>{{ row.name }}</strong> 的详情：年龄 {{ row.age }}，状态 {{ row.status }}。
          </div>
        </template>
      </adv-table>
    </div>

    <h3>groupHeader（行分组头）</h3>
    <p>自定义行分组头渲染，接收 field / value / count / expanded / aggregates / toggle。</p>
    <div class="mode-panel">
      <adv-table
        mode="default"
        :data="surfaceGroupData"
        :columns="surfaceCols"
        :row-group-config="{ field: 'department', defaultExpandAll: true }"
        height="250px"
      >
        <template #groupHeader="{ field, value, count, expanded, toggle }">
          <div class="surface-group-header">
            <ElButton
              size="small"
              @click="toggle"
            >
              {{ expanded ? '▼' : '▶' }}
            </ElButton>
            <strong>{{ field }}=</strong><em>{{ value }}</em>
            <span class="surface-group-count">({{ count }} 行)</span>
          </div>
        </template>
      </adv-table>
    </div>

    <h3>error（渲染错误兜底）</h3>
    <p>渲染器异常时的兜底插槽，接收 error。</p>
    <div class="mode-panel">
      <p style="color: #909399">
        （此插槽仅在渲染器异常时触发；正常状态下不显示。下方为占位示例。）
      </p>
      <adv-table
        mode="default"
        :data="surfaceData"
        :columns="surfaceCols"
        height="100px"
      >
        <template #error="{ error }">
          <div class="surface-error-slot">
            渲染异常：{{ error?.message ?? 'unknown' }}
          </div>
        </template>
      </adv-table>
    </div>

    <h3>动态列单元格插槽 + 表头插槽</h3>
    <p>插槽名 = 列 prop（单元格）或 <code>${prop}-header</code>（表头）。</p>
    <div class="mode-panel">
      <adv-table
        mode="default"
        :data="surfaceData"
        :columns="surfaceCols"
        height="250px"
      >
        <template #name="{ row, cellData, index }">
          <span class="surface-cell-slot">👤 {{ cellData }} (#{{ index }}) - {{ row?.status }}</span>
        </template>
        <template #name-header>
          <span class="surface-header-slot">📛 姓名(自定义表头)</span>
        </template>
      </adv-table>
    </div>

    <!-- ════════════════════════════════════════════════════════════
         EXPOSE（全量覆盖）
         ════════════════════════════════════════════════════════════ -->
    <h2>Expose（全量）</h2>
    <p>通过 <code>ref</code> 访问实例 API。下方按钮触发各 expose 方法。</p>

    <h3>数据 / 分页 / 选择</h3>
    <div class="mode-panel">
      <div class="surface-api-buttons">
        <ElButton @click="surfaceApiCall('refresh')">
          refresh
        </ElButton>
        <ElButton @click="surfaceApiCall('getFullData')">
          getFullData
        </ElButton>
        <ElButton @click="surfaceApiCall('getCurrentPageData')">
          getCurrentPageData
        </ElButton>
        <ElButton @click="surfaceApiCall('applyTransaction')">
          applyTransaction
        </ElButton>
        <ElButton @click="surfaceApiCall('getRenderData')">
          getRenderData
        </ElButton>
        <ElButton @click="surfaceApiCall('setCurrentPage')">
          setCurrentPage(1)
        </ElButton>
        <ElButton @click="surfaceApiCall('setPageSize')">
          setPageSize(5)
        </ElButton>
        <ElButton @click="surfaceApiCall('getPagination')">
          getPagination
        </ElButton>
        <ElButton @click="surfaceApiCall('clearSelection')">
          clearSelection
        </ElButton>
        <ElButton @click="surfaceApiCall('selectAll')">
          selectAll
        </ElButton>
        <ElButton @click="surfaceApiCall('invertSelection')">
          invertSelection
        </ElButton>
        <ElButton @click="surfaceApiCall('getSelectedRows')">
          getSelectedRows
        </ElButton>
        <ElButton @click="surfaceApiCall('getSelectedCount')">
          getSelectedCount
        </ElButton>
        <ElButton @click="surfaceApiCall('getSelectedKeys')">
          getSelectedKeys
        </ElButton>
        <ElButton @click="surfaceApiCall('selectAllFiltered')">
          selectAllFiltered
        </ElButton>
        <ElButton @click="surfaceApiCall('deselectAllFiltered')">
          deselectAllFiltered
        </ElButton>
        <ElButton @click="surfaceApiCall('selectAllOnCurrentPage')">
          selectAllOnCurrentPage
        </ElButton>
        <ElButton @click="surfaceApiCall('deselectAllOnCurrentPage')">
          deselectAllOnCurrentPage
        </ElButton>
        <ElButton @click="surfaceApiCall('deselectAll')">
          deselectAll
        </ElButton>
        <ElButton @click="surfaceApiCall('selectRowByKey')">
          selectRowByKey('2')
        </ElButton>
        <ElButton @click="surfaceApiCall('selectRowsByKeys')">
          selectRowsByKeys(['3','4'])
        </ElButton>
        <ElButton @click="surfaceApiCall('isSelectedByKey')">
          isSelectedByKey('1')
        </ElButton>
        <ElButton @click="surfaceApiCall('replaceSelection')">
          replaceSelection(['1'])
        </ElButton>
        <ElButton @click="surfaceApiCall('forEachSelected')">
          forEachSelected
        </ElButton>
        <ElButton @click="surfaceApiCall('getSelectedIndices')">
          getSelectedIndices
        </ElButton>
        <ElButton @click="surfaceApiCall('setSelection')">
          setSelection(['1','2'])
        </ElButton>
        <ElButton @click="surfaceApiCall('toggleRowSelection')">
          toggleRowSelection
        </ElButton>
        <ElButton @click="surfaceApiCall('toggleAllSelection')">
          toggleAllSelection
        </ElButton>
        <ElButton @click="surfaceApiCall('setCurrentRow')">
          setCurrentRow
        </ElButton>
        <ElButton @click="surfaceApiCall('getCurrentRow')">
          getCurrentRow
        </ElButton>
        <ElButton @click="surfaceApiCall('refreshSelection')">
          refreshSelection
        </ElButton>
        <ElButton @click="surfaceApiCall('initSelectionByKeys')">
          initSelectionByKeys(['1'])
        </ElButton>
      </div>
      <adv-table
        ref="surfaceApiRef"
        mode="default"
        :data="surfaceData"
        :columns="surfaceCols"
        :row-config="{ rowKey: 'id', rowSelection: 'multiple' }"
        :pagination="{ pageSize: 5 }"
        height="250px"
      />
    </div>

    <h3>搜索 / 筛选 / 排序</h3>
    <div class="mode-panel">
      <div class="surface-api-buttons">
        <ElButton @click="surfaceApiCall('getQueryFormModel', surfaceApi2Ref)">
          getQueryFormModel
        </ElButton>
        <ElButton @click="surfaceApiCall('setQueryFormModel', surfaceApi2Ref)">
          setQueryFormModel
        </ElButton>
        <ElButton @click="surfaceApiCall('setFilter', surfaceApi2Ref)">
          setFilter(age&gt;30)
        </ElButton>
        <ElButton @click="surfaceApiCall('resetColumnFilter', surfaceApi2Ref)">
          resetColumnFilter(age)
        </ElButton>
        <ElButton @click="surfaceApiCall('resetAllFilters', surfaceApi2Ref)">
          resetAllFilters
        </ElButton>
        <ElButton @click="surfaceApiCall('getFilterValue', surfaceApi2Ref)">
          getFilterValue(age)
        </ElButton>
        <ElButton @click="surfaceApiCall('isColumnFiltered', surfaceApi2Ref)">
          isColumnFiltered(age)
        </ElButton>
        <ElButton @click="surfaceApiCall('hasActiveFilter', surfaceApi2Ref)">
          hasActiveFilter
        </ElButton>
        <ElButton @click="surfaceApiCall('hasActiveQuickFilter', surfaceApi2Ref)">
          hasActiveQuickFilter
        </ElButton>
        <ElButton @click="surfaceApiCall('setQuickFilter', surfaceApi2Ref)">
          setQuickFilter('张三')
        </ElButton>
        <ElButton @click="surfaceApiCall('getQuickFilter', surfaceApi2Ref)">
          getQuickFilter
        </ElButton>
        <ElButton @click="surfaceApiCall('toggleSort', surfaceApi2Ref)">
          toggleSort(name)
        </ElButton>
        <ElButton @click="surfaceApiCall('setSort', surfaceApi2Ref)">
          setSort(name,asc)
        </ElButton>
        <ElButton @click="surfaceApiCall('setSorts', surfaceApi2Ref)">
          setSorts([age desc])
        </ElButton>
        <ElButton @click="surfaceApiCall('clearSort', surfaceApi2Ref)">
          clearSort
        </ElButton>
        <ElButton @click="surfaceApiCall('getSortOrder', surfaceApi2Ref)">
          getSortOrder(name)
        </ElButton>
        <ElButton @click="surfaceApiCall('getSortIndex', surfaceApi2Ref)">
          getSortIndex(name)
        </ElButton>
      </div>
      <adv-table
        ref="surfaceApi2Ref"
        mode="default"
        :data="surfaceData"
        :columns="surfaceCols"
        :search="{ enabled: true, fields: [{ prop: 'name', label: '姓名' }] }"
        height="250px"
      />
    </div>

    <h3>编辑 / 校验 / 历史</h3>
    <div class="mode-panel">
      <div class="surface-api-buttons">
        <ElButton @click="surfaceApiCall('startEditing', surfaceApi3Ref)">
          startEditing
        </ElButton>
        <ElButton @click="surfaceApiCall('stopEditing', surfaceApi3Ref)">
          stopEditing
        </ElButton>
        <ElButton @click="surfaceApiCall('submitEdit', surfaceApi3Ref)">
          submitEdit
        </ElButton>
        <ElButton @click="surfaceApiCall('discardEdit', surfaceApi3Ref)">
          discardEdit
        </ElButton>
        <ElButton @click="surfaceApiCall('commitBatchEdit', surfaceApi3Ref)">
          commitBatchEdit
        </ElButton>
        <ElButton @click="surfaceApiCall('cancelBatchEdit', surfaceApi3Ref)">
          cancelBatchEdit
        </ElButton>
        <ElButton @click="surfaceApiCall('hasPendingChanges', surfaceApi3Ref)">
          hasPendingChanges
        </ElButton>
        <ElButton @click="surfaceApiCall('batchHasPending', surfaceApi3Ref)">
          batchHasPending
        </ElButton>
        <ElButton @click="surfaceApiCall('validate', surfaceApi3Ref)">
          validate
        </ElButton>
        <ElButton @click="surfaceApiCall('validateRow', surfaceApi3Ref)">
          validateRow
        </ElButton>
        <ElButton @click="surfaceApiCall('clearValidate', surfaceApi3Ref)">
          clearValidate
        </ElButton>
        <ElButton @click="surfaceApiCall('undo', surfaceApi3Ref)">
          undo
        </ElButton>
        <ElButton @click="surfaceApiCall('redo', surfaceApi3Ref)">
          redo
        </ElButton>
        <ElButton @click="surfaceApiCall('canUndo', surfaceApi3Ref)">
          canUndo
        </ElButton>
        <ElButton @click="surfaceApiCall('canRedo', surfaceApi3Ref)">
          canRedo
        </ElButton>
        <ElButton @click="surfaceApiCall('hasUnsavedChanges', surfaceApi3Ref)">
          hasUnsavedChanges
        </ElButton>
        <ElButton @click="surfaceApiCall('getRowKey', surfaceApi3Ref)">
          getRowKey
        </ElButton>
      </div>
      <adv-table
        ref="surfaceApi3Ref"
        mode="default"
        :data="surfaceEditData"
        :columns="surfaceEditCols"
        :edit-config="{ singleClickEdit: true }"
        height="250px"
      />
    </div>

    <h3>导入导出 / 打印 / 右键菜单 / 列状态</h3>
    <div class="mode-panel">
      <div class="surface-api-buttons">
        <ElButton @click="surfaceApiCall('exportExcel', surfaceApi4Ref)">
          exportExcel
        </ElButton>
        <ElButton @click="surfaceApiCall('exportCsv', surfaceApi4Ref)">
          exportCsv
        </ElButton>
        <ElButton @click="surfaceApiCall('print', surfaceApi4Ref)">
          print
        </ElButton>
        <ElButton @click="surfaceApiCall('triggerImport', surfaceApi4Ref)">
          triggerImport
        </ElButton>
        <ElButton @click="surfaceApiCall('showContextMenu', surfaceApi4Ref)">
          showContextMenu
        </ElButton>
        <ElButton @click="surfaceApiCall('hideContextMenu', surfaceApi4Ref)">
          hideContextMenu
        </ElButton>
        <ElButton @click="surfaceApiCall('getColumnState', surfaceApi4Ref)">
          getColumnState
        </ElButton>
        <ElButton @click="surfaceApiCall('applyColumnState', surfaceApi4Ref)">
          applyColumnState
        </ElButton>
        <ElButton @click="surfaceApiCall('resetColumnState', surfaceApi4Ref)">
          resetColumnState
        </ElButton>
        <ElButton @click="surfaceApiCall('saveView', surfaceApi4Ref)">
          saveView
        </ElButton>
        <ElButton @click="surfaceApiCall('applyView', surfaceApi4Ref)">
          applyView
        </ElButton>
        <ElButton @click="surfaceApiCall('getSavedViews', surfaceApi4Ref)">
          getSavedViews
        </ElButton>
        <ElButton @click="surfaceApiCall('deleteView', surfaceApi4Ref)">
          deleteView
        </ElButton>
      </div>
      <adv-table
        ref="surfaceApi4Ref"
        mode="default"
        :data="surfaceData"
        :columns="surfaceCols"
        :toolbar="{ exportExcel: true, exportCsv: true, print: true, import: true }"
        :menu-config="{ body: { enabled: true, options: [['copyCell', 'copyRow']] } }"
        height="250px"
      />
    </div>

    <h3>树形 / 行分组 / 展开行 / 行固定 / 滚动</h3>
    <div class="mode-panel">
      <div class="surface-api-buttons">
        <ElButton @click="surfaceApiCall('toggleTreeNodeExpand', surfaceApi5Ref)">
          toggleTreeNodeExpand
        </ElButton>
        <ElButton @click="surfaceApiCall('expandTreeNode', surfaceApi5Ref)">
          expandTreeNode
        </ElButton>
        <ElButton @click="surfaceApiCall('collapseTreeNode', surfaceApi5Ref)">
          collapseTreeNode
        </ElButton>
        <ElButton @click="surfaceApiCall('expandAllTreeNodes', surfaceApi5Ref)">
          expandAllTreeNodes
        </ElButton>
        <ElButton @click="surfaceApiCall('collapseAllTreeNodes', surfaceApi5Ref)">
          collapseAllTreeNodes
        </ElButton>
        <ElButton @click="surfaceApiCall('getTreeMeta', surfaceApi5Ref)">
          getTreeMeta
        </ElButton>
        <ElButton @click="surfaceApiCall('toggleDetailRowExpand', surfaceApi5Ref)">
          toggleDetailRowExpand
        </ElButton>
        <ElButton @click="surfaceApiCall('expandDetailRow', surfaceApi5Ref)">
          expandDetailRow
        </ElButton>
        <ElButton @click="surfaceApiCall('collapseDetailRow', surfaceApi5Ref)">
          collapseDetailRow
        </ElButton>
        <ElButton @click="surfaceApiCall('expandAllDetailRows', surfaceApi5Ref)">
          expandAllDetailRows
        </ElButton>
        <ElButton @click="surfaceApiCall('collapseAllDetailRows', surfaceApi5Ref)">
          collapseAllDetailRows
        </ElButton>
        <ElButton @click="surfaceApiCall('toggleGroupExpand', surfaceApi5Ref)">
          toggleGroupExpand
        </ElButton>
        <ElButton @click="surfaceApiCall('expandAllGroups', surfaceApi5Ref)">
          expandAllGroups
        </ElButton>
        <ElButton @click="surfaceApiCall('collapseAllGroups', surfaceApi5Ref)">
          collapseAllGroups
        </ElButton>
        <ElButton @click="surfaceApiCall('pinRow', surfaceApi5Ref)">
          pinRow('1',top)
        </ElButton>
        <ElButton @click="surfaceApiCall('unpinRow', surfaceApi5Ref)">
          unpinRow('1')
        </ElButton>
        <ElButton @click="surfaceApiCall('isRowPinned', surfaceApi5Ref)">
          isRowPinned('1')
        </ElButton>
        <ElButton @click="surfaceApiCall('clearPinnedRows', surfaceApi5Ref)">
          clearPinnedRows
        </ElButton>
        <ElButton @click="surfaceApiCall('scrollToRow', surfaceApi5Ref)">
          scrollToRow('3')
        </ElButton>
        <ElButton @click="surfaceApiCall('scrollToColumn', surfaceApi5Ref)">
          scrollToColumn(name)
        </ElButton>
      </div>
      <adv-table
        ref="surfaceApi5Ref"
        mode="default"
        :data="surfaceData"
        :columns="surfaceCols"
        :row-config="{ rowKey: 'id' }"
        :tree-config="{ children: 'children' }"
        height="250px"
      />
    </div>

    <h3>loading / tableRootRef / version</h3>
    <div class="mode-panel">
      <div class="surface-api-buttons">
        <ElButton @click="surfaceApiCall('setLoading', surfaceApi6Ref)">
          setLoading（内部 loading 取反）
        </ElButton>
        <ElButton @click="surfaceApiCall('tableRootRef', surfaceApi6Ref)">
          tableRootRef
        </ElButton>
        <ElButton @click="surfaceApiCall('version', surfaceApi6Ref)">
          version
        </ElButton>
      </div>
      <adv-table
        ref="surfaceApi6Ref"
        mode="default"
        :data="surfaceData"
        :columns="surfaceCols"
        :search="{ enabled: true, fields: [{ prop: 'name', label: '姓名' }] }"
        height="250px"
      />
    </div>

    <h3>loading / 编辑值读写（updateCellEditingValue / getCellEditingValue）</h3>
    <p>暴露的响应式 Ref 与编辑值通道：先对第 0 行 name 列 startEditing 并改写值，再读回当前编辑值。</p>
    <div class="mode-panel">
      <div class="surface-api-buttons">
        <ElButton @click="surfaceApiCall('loading', surfaceApi7Ref)">
          loading
        </ElButton>
        <ElButton @click="surfaceApiCall('updateCellEditingValue', surfaceApi7Ref)">
          updateCellEditingValue
        </ElButton>
        <ElButton @click="surfaceApiCall('getCellEditingValue', surfaceApi7Ref)">
          getCellEditingValue
        </ElButton>
      </div>
      <adv-table
        ref="surfaceApi7Ref"
        mode="default"
        :data="surfaceEditData"
        :columns="surfaceEditCols"
        :edit-config="{ singleClickEdit: true }"
        height="250px"
      />
    </div>

    <!-- <zh/> API 调用日志 <en/> API call log -->
    <h3>API 调用日志</h3>
    <SurfaceEventBoard section="apiLog" />
  </div>
</template>
