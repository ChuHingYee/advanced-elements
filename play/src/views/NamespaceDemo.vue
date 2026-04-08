<script setup lang="ts">
/**
 * <zh/> 自定义命名空间演示（本表示例作用域，可独立于顶部全局开关）
 * <en/> Custom namespace demo (scoped to this table, independent of the global toggle)
 *
 * <zh/> 演示 `<ElConfigProvider namespace="...">` 切换类前缀时 AdvTable 的行为：
 * <zh/> - JS 运行时查询自动跟随（无需配置 uiConfig.namespace）
 * <zh/> - 失配时响亮失败（TABLE_NAMESPACE_MISMATCH），而非静默失效
 * <zh/> - 切到 demo 时经 ensureNamespaceStyles 懒加载对应重编样式
 * <zh/>   （`src/styles/namespace-demo.scss`，SASS 模块单例按编译单元隔离），
 * <zh/>   故视觉依然正常；顶部导航另有全局开关，可让 TableDemo 全功能页同样进入自定义前缀
 * <en/> Demonstrates AdvTable behaviour when `<ElConfigProvider namespace="...">` switches the
 * <en/> class prefix:
 * <en/> - JS runtime queries follow automatically (no uiConfig.namespace needed)
 * <en/> - On mismatch it fails loudly (TABLE_NAMESPACE_MISMATCH), never silently
 * <en/> - Switching to demo lazily loads the recompiled styles via ensureNamespaceStyles
 * <en/>   (`src/styles/namespace-demo.scss`, SASS module singleton per compilation unit),
 * <en/>   so visuals stay correct; the top nav has a separate global toggle for the full TableDemo page
 */
import { nextTick, onMounted, ref, watch } from 'vue'
import { ensureNamespaceStyles } from '../utils/ensure-namespace-styles'

const NS_CUSTOM = 'demo'

const ns = ref<'el' | typeof NS_CUSTOM>('el')

interface DemoColumn {
  prop: string
  label: string
  hidden: boolean
}

const columns = ref<DemoColumn[]>([
  { prop: 'id', label: 'ID', hidden: false },
  { prop: 'name', label: '姓名', hidden: false },
])
const rows = ref([
  { id: 'r1', name: 'Alice' },
  { id: 'r2', name: 'Bob' },
  { id: 'r3', name: 'Carol' },
])

const tableWrapRef = ref<HTMLElement | null>(null)
const foundExpected = ref(-1)
const foundLegacy = ref(-1)
const table1Errors: any[] = []
const table2Errors: any[] = []
const mismatchCount = ref(0)
const mismatch2Count = ref(0)

function onTableError(e: unknown) {
  table1Errors.push(e)
  mismatchCount.value = table1Errors.filter(x => x?.code === 'TABLE_NAMESPACE_MISMATCH').length
}

function onTable2Error(e: unknown) {
  table2Errors.push(e)
  mismatch2Count.value = table2Errors.filter(x => x?.code === 'TABLE_NAMESPACE_MISMATCH').length
}

function runChecks() {
  const root = tableWrapRef.value
  if (!root)
    return
  foundExpected.value = root.querySelectorAll(`.${ns.value}-table__row`).length
  foundLegacy.value = ns.value === 'el' ? -1 : root.querySelectorAll('.el-table__row').length
}

watch(ns, () => {
  foundExpected.value = -1
  foundLegacy.value = -1
  if (ns.value === 'demo')
    void ensureNamespaceStyles()
  window.setTimeout(() => void nextTick().then(runChecks), 400)
})

onMounted(() => {
  if (ns.value === 'demo')
    void ensureNamespaceStyles()
  window.setTimeout(() => void nextTick().then(runChecks), 800)
})
</script>

<template>
  <div class="ns-demo">
    <h2>自定义命名空间演示</h2>
    <p class="ns-demo__desc">
      切换类前缀，观察：JS 查询自动跟随（行能定位、交互正常）、失配时响亮报错。
      本页开关仅作用于下表（嵌套 Provider 覆盖全局）；顶部导航另有全局开关，
      切到 <code>demo</code> 后整个 TableDemo 全功能页同样进入自定义前缀。
    </p>

    <div class="ns-demo__switch">
      <span>EP 命名空间：</span>
      <el-radio-group v-model="ns">
        <el-radio value="el">
          el（默认）
        </el-radio>
        <el-radio :value="NS_CUSTOM">
          demo（自定义）
        </el-radio>
      </el-radio-group>
      <el-button @click="runChecks">
        重新检查
      </el-button>
    </div>

    <h3>表一：自动跟随（不传 uiConfig.namespace）</h3>
    <div
      ref="tableWrapRef"
      class="ns-demo__table"
    >
      <el-config-provider :namespace="ns">
        <adv-table
          :columns="columns"
          :data="rows"
          height="260px"
          @error="onTableError"
        />
      </el-config-provider>
    </div>

    <div class="ns-demo__panel">
      <h4>验证面板</h4>
      <ul>
        <li>期望行选择器：<code>.{{ ns }}-table__row</code></li>
        <li>
          该选择器命中行数：<strong>{{ foundExpected < 0 ? '（点击"重新检查"）' : foundExpected }}</strong>
        </li>
        <li v-if="ns !== 'el'">
          旧 <code>.el-table__row</code> 命中行数：<strong>{{ foundLegacy < 0 ? '（点击"重新检查"）' : foundLegacy }}</strong>
          （应为 0，否则说明 EP 没发出新前缀）
        </li>
        <li>
          表一 <code>TABLE_NAMESPACE_MISMATCH</code> 次数：<strong>{{ mismatchCount }}</strong>（应为 0）
        </li>
      </ul>
    </div>

    <h3>表二：失配演示（uiConfig.namespace 与 Provider 打架）</h3>
    <p class="ns-demo__desc">
      下表故意把 <code>uiConfig.namespace</code> 写成与 Provider 不同的值，
      应立即触发 <code>TABLE_NAMESPACE_MISMATCH</code>（warn，生产可见）而不是静默失效。
      当前该错误已触发 <strong>{{ mismatch2Count }}</strong> 次。
    </p>
    <div class="ns-demo__table">
      <el-config-provider :namespace="NS_CUSTOM">
        <adv-table
          :columns="columns"
          :data="rows"
          :ui-config="{ namespace: 'other' }"
          height="200px"
          @error="onTable2Error"
        />
      </el-config-provider>
    </div>

    <h3>为什么切到 demo 后样式依然正常</h3>
    <p class="ns-demo__desc">
      因为切到 <code>demo</code> 时经 <code>ensureNamespaceStyles</code> 懒加载了一套重编样式
      （<code>src/styles/namespace-demo.scss</code>：EP 全量 + 本包全量，前缀
      <code>demo</code>），默认 <code>el</code> 下零成本。
      如果只改 ConfigProvider 而不重编 CSS，两套样式会同时脱钩——
      这是 EP 官方文档明令禁止的不完整配置（"必须同时设置 ElConfigProvider 和 scss $namespace"），不是 bug。
      完整三步见 <code>packages/table/NAMESPACE-CHECKLIST.md</code>：
      配 ConfigProvider → 重编 EP 的 <code>$namespace</code> → 配本包的 <code>$ep-namespace</code>。
    </p>
  </div>
</template>

<style lang="scss" scoped>
.ns-demo {
  padding: 16px 20px;
  overflow: auto;
  height: 100%;

  h3 {
    margin: 16px 0 8px;
  }

  h4 {
    margin: 0 0 8px;
  }

  &__desc {
    color: #606266;
    font-size: 13px;
    line-height: 1.7;
    max-width: 900px;

    code {
      background: #f2f3f5;
      padding: 0 5px;
      border-radius: 3px;
      font-size: 12px;
    }
  }

  &__switch {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 12px 0;
  }

  &__table {
    border: 1px solid #ebeef5;
    border-radius: 4px;
    max-width: 900px;
  }

  &__panel {
    margin-top: 12px;
    padding: 12px 16px;
    background: #f8f9fb;
    border-radius: 4px;
    max-width: 900px;

    ul {
      margin: 0;
      padding-left: 20px;
      font-size: 13px;
      line-height: 2;
    }

    code {
      background: #eef0f3;
      padding: 0 5px;
      border-radius: 3px;
      font-size: 12px;
    }
  }
}
</style>
