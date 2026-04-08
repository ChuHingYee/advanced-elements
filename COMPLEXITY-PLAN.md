# 复杂度治理方案（Complexity Reduction Plan）

> 日期：2026-10-25 · 基线：develop@34fe660 之后（含 2026-10-25 治理改动）
> 配套文档：`REPO-ANALYSIS.md`（六维分析）、`docs/ownership-matrix.md`、`docs/adr/`
> 本文回答一个问题：**如何把「被认真管理的大」变成「可持续变小的大」，并保证不再反弹。**

---

## 0. 基线数据（全部实测）

| 指标 | 数值 | 来源 |
|---|---|---|
| table src 文件数 / 总行数 | 411 / ~80,600（均 196 行） | `find + wc` |
| `>300` 行的 src 文件 | **86** 个 | 同上 |
| `check-hook-size` BASELINE 豁免 | **42** 个 composables | `packages/table/scripts/check-hook-size.mjs` |
| 最大 composable | `use-table-request.ts` 1,034 行（单函数体 ~800 行） | wc |
| Top 巨石 composables 扇入 | 仅 **2~6** 个消费文件 | grep 统计 |
| `UseTableApiReturn`（= TableExpose 主体） | **110 个平铺成员**，无能力分组 | `composables/api/use-table-api.ts` |
| API 契约护栏 | 编译期 exhaustive 清单 + 运行时双向比对，已就位 | `__type-guards__/api-contract.keys.ts` + `__tests__/guards/type-completeness.test.ts` |
| `types/column.ts` | 990 行 | wc |
| `TableRenderer.vue` / `TableVirtualRenderer.vue` | 847 / 965 行 | wc |
| play `TableDemo.vue` | **7,736 行**（template 6,496 + script 937 + style 301） | wc |
| play demo section 数 | **109**（与 `categories.ts` 109 个选项一一对应），342 个 `<adv-table>` 实例 | grep |
| `use-table-demo-state.ts` | 891 行 / 189 个 ref，单文件整包解构消费 | wc |

---

## 1. 复杂度来源辨析：三个真问题，一个非问题

**非问题（明确保留，不做）：7 层洋葱编排。**
`useAdvTable`（395 行）的 Core → DataColumns → Selection → Interaction → SharedEditing → Features → RendererIntegration 链是**域间数据依赖的诚实表达**（选择需要数据域、交互需要选择域……）。每层 <500 行、入参是窄切片（ISP）、返回是显式域契约、装配顺序已被 `assembly-order.guard.test.ts` 锁定。合并层不会减少复杂度，只会把显式依赖变成隐式跳线；引入 DI 容器/惰性初始化是过度工程。**对它的全部投资应止步于文档化**（见 M3）。

**真问题 A：域内巨石。** 复杂度不在编排层（薄），而在 42 个域内巨石 composables（厚）。`use-table-request.ts` 是典型：231 行接口之后是 ~800 行的单函数体，请求/响应解析/分页联动/竞态守卫/轮询全在一个闭包里。

**真问题 B：play 演示巨石。** 6,496 行模板里 109 个 `v-if="selectedDemo === 'xxx'"` 分支互相咬合，任何演示改动都要在 7.7k 行里定位；`use-table-demo-state.ts` 的 189 个 ref 被单文件整包解构，无法按 section 复用。

**真问题 C：API 面与类型/渲染器巨石。** 110 个平铺 expose 成员意味着每次内部重构都要维护一层转发；`column.ts` 990 行与两个 ~900 行的 Renderer.vue 是导航与模板层的两块巨石。

---

## 2. 战线一：机制止血（Phase 0，先关水龙头）

任何还债方案若无止血机制，都会被新代码冲销。三件事，全部可在一两天内落地：

### M1. hook-size 从「豁免名单」升级为「只减不增棘轮」

现状：`check-hook-size.mjs` 对 BASELINE 内的 42 个文件 **warn-only**——名单内的文件可以无限增长而不报警，棘轮只对新文件生效。

改造：
1. 在脚本内计算两个聚合数：`oversizedFiles`（>300 行的 composables 数）、`oversizedLines`（超限文件超出部分的总行数）；
2. 棘轮值写入 `scripts/hook-size-ratchet.json`（如 `{"files": 42, "excessLines": 9130}`）；
3. CI 判定改为：聚合数**超过**棘轮值 → **error**（不再是 warn）；低于棘轮值 → 提示并要求顺手下调棘轮文件（棘轮只紧不松）；
4. 单文件 BASELINE 名单随之退役（被聚合棘轮取代，少维护一份清单）。

效果：还债进度的每一步都被量化锁定，任何人让巨石变大一行业绩上就是红的。

### M2. 域目录依赖方向 lint（把分层从约定变成机器约束）

目前 12 个域目录的依赖方向（`utils ← components ← composables 域间经 orchestrator-context`）只存在于注释与 review 惯例。用 ESLint `no-restricted-imports` 的 `patterns`（零新依赖，仓库已用同机制禁 axios/pinia）按目录声明：

```js
// eslint.config.mjs 追加（示意）
{ files: ['packages/table/src/utils/**'] },
  禁 import '../composables/**'、'../components/**'   // utils 必须是叶子
{ files: ['packages/table/src/components/**'] },
  禁 import '../composables/**'（白名单：同目录 renderer-core 的类型与 use-table-renderer/use-virtual-renderer 两个装配壳）
{ files: ['packages/table/src/composables/<域A>/**'] },
  禁 import '../<域B>/**'，域间只允许经 '../types/orchestrator-context' 与本域 orchestrator
```

方向表先行登记进 `docs/ownership-matrix.md`（新增一条 R 规则），初始只 error 于明显违规（utils→上层、components→composables 非白名单），域间互引先 warn 收集存量再收紧——沿用 lint 棘轮的既有打法。

### M3. `docs/ARCHITECTURE.md` 认知地图（治「上手成本」这个复杂度的另一半）

复杂度 = 代码结构 × 认知负担。把 `use-adv-table.ts:6-17` 的 ASCII 洋葱图外化为独立文档：12 域职责表、洋葱装配图与顺序约束、一次数据流走读（props → pipeline → renderer → expose）、新人阅读顺序（`use-adv-table.ts` → `core/use-adv-table-core.ts` → 任选一个域 orchestrator → `renderer-core/dom-adapter.ts`）、以及「改 X 应该动哪些文件」速查。约 300 行，一次写好，随 ADR 流程维护。

---

## 3. 战线二：play 拆分完整设计（最大单点收益）

### 3.1 目标结构

```
play/src/views/table-demo/
├── TableDemo.vue                  # ≤300 行壳：侧栏 + 动态挂载 + 全局 provide
├── categories.ts                  # 既有 109 项导航（不动，作为注册表数据源）
├── section-registry.ts            # value → 异步组件 映射（新增，~120 行）
├── demo-context.ts                # provide/inject 入口 + 各 state 域装配（新增）
├── state/                         # use-table-demo-state.ts 按消费面拆片
│   ├── use-demo-data.ts           # 数据与 mock request（原 demo-data 消费面）
│   ├── use-demo-columns.ts        # 列定义（原 columns.ts 消费面）
│   ├── use-demo-surface.ts        # 事件面板/操作反馈（并入现 surface-state.ts）
│   └── index.ts
├── sections/                      # 109 个 section 组件，按类别目录
│   ├── basics/BasicSection.vue    #   每组件：局部 ref + inject 所需 state 片
│   ├── basics/ValueTypeSection.vue
│   ├── selection/ShiftClickSection.vue
│   └── ...（10 个类别目录 = categories.ts 的 10 组）
├── columns.ts / demo-data.ts / helpers.ts / types.ts   # 既有，不动
└── SurfaceEventBoard.vue          # 既有，不动
```

### 3.2 导航机制：动态组件，不改路由

保留单 URL + 侧栏 `el-menu` 交互习惯，模板主体从 110 个 `v-if` 换成一个挂载点：

```vue
<component :is="sectionRegistry[selectedDemo]" />
```

`section-registry.ts` 用 `defineAsyncComponent`（play 本地组件无分包收益，但保持与主包 `AdvTable.vue` 面板组件一致的写法；直接同步 import 亦可，109 个组件对 vite 开发无压力）。不选路由化的理由：router 改造会引入 109 条路由/守卫/URL 兼容问题，而现状用户习惯是「单页切 demo」，动态组件以最小改动达成结构拆分。

### 3.3 状态切片：让 891 行 / 189 ref 的状态按消费面复用

这是原 `use-table-demo-state.ts` 注释**宣称却从未实现**的形态，本次做实：

- `demo-context.ts` 在 TableDemo 壳的 setup 调用各 state 片并 `provide`；
- section 组件经 `useDemoData()` / `useDemoColumns()` / `useDemoSurface()` 按需 `inject`（缺省 devWarn，沿用主包 `useSafeInject` 模式）；
- 拆片原则：**按 109 个 section 的实际消费面聚类**（迁移时逐类统计，常见三类：只读数据/列定义、可写交互状态、事件面板上报），不追求一次性精确切分——错放的 ref 随迁移顺手归位。

### 3.4 迁移策略：逐类别增量，10 个类别 = 10 个独立 PR

每个 PR 的固定动作（以「2. 选择功能」7 个 demo 为例）：

1. 新建 `sections/selection/*.vue`：把模板中 7 个 `v-if` 块**原样搬出**（不改行为，模板内的 ref 引用改为 inject/局部声明）；
2. `section-registry.ts` 注册 7 个 value；
3. 删除 TableDemo.vue 中对应 `v-if` 分支与该类别独占的 script 代码；
4. 验证（见 3.5）；
5. 类别全部迁完后，`categories.ts` 不动，模板净减 ~600-700 行。

「综合 / Props 全量 / Events / Slots / Expose」这类大区（单区模板上千行）单独成 PR，必要时先在区内按 h3 再拆二级 section。`mega`（整合示例）预期是最大单 section，若超 300 行允许例外并在注册表注释声明理由（它本来就是「全部功能塞一张表」的演示）。

### 3.5 每步验收（play 无测试，验收全部自动化）

1. `pnpm -C play exec vue-tsc --noEmit -p tsconfig.app.json`（类型绿）；
2. **浏览器冒烟脚本**：`pnpm play` 起服务后，用脚本（Playwright，仓库已有依赖）遍历 109 个 `selectedDemo` 值：点击侧栏 → 断言挂载点渲染出 ≥1 个 `.adv-table` 根节点 + 无 console error。脚本落为 `play/scripts/smoke-sections.mjs`，迁移期间每次 PR 跑全量 109 项，迁移完成后保留为 play 的常备冒烟；
3. 人工抽查该类别 2-3 个 demo 的交互（拖拽/编辑类看一眼即可）。

### 3.6 终态验收与防复发

- `TableDemo.vue` ≤300 行；sections/ 下单文件 ≤300 行（`mega` 例外）；`use-table-demo-state.ts` 退役，拆为 `state/` 域文件后单文件 ≤300 行；
- eslint 对 `play/src/views/**` 启用 `vue/max-lines`（~300，超限需豁免注释）——play 从此有体积门禁，巨石无法复发。

---

## 4. 战线三：42 个巨石 composables 削减 playbook

### 4.1 为什么低风险

扇入实测 2~6 个消费文件（巨石都是 orchestrator 内部件），拆分是**纯内部重构**：对消费方只改 import 路径或拼装方式，行为面被既有 387 个测试文件（含每个巨石的专属测试）与 parity 套件完整看住。

### 4.2 三种刀法（全部有仓内先例，不发明新模式）

| 刀法 | 做法 | 仓内先例 |
|---|---|---|
| A. 纯函数下沉 | 函数体内不依赖响应式上下文的闭包 → `utils/` 纯函数（可单测） | `collectValidateRowValues` 从 `use-adv-table.ts` 抽至 `use-adv-table-api-assembly.ts` |
| B. core/helpers 二分 | `use-x.ts` → `use-x-core.ts`（状态+编排）+ `use-x-helpers.ts`（逻辑），对外签名不变 | `check-hook-size.mjs` 提示语即此；`use-column-resize.ts` + `-proxy` + `-key-resolver` |
| C. 域内子模块化 | 按生命周期/职责切成 5-9 个子 composable，orchestrator 只做拼装 | **编辑域 9 件套**：kernel / session / buffer / apply / commit-cell / commit-row / events / location / validation |

选刀依据：闭包间共享响应式状态少 → A；单函数体过长 → B；文件内本就有多个内聚子系统 → C。`use-table-request.ts`（1034 行）适用 C：请求发送 / 响应解析（format-response 已在 utils）/ 分页联动 / 竞态与代际守卫 / 轮询，天然五个子系统。

### 4.3 单文件工作流（每个巨石一个 PR）

1. 确认该文件专属测试存在且绿（`__tests__/composables/` 下均有对应 test）；
2. 机械拆分（刀法组合），**不改变对外签名与返回结构**；
3. `pnpm test`（全量）+ `pnpm lint:table` + typecheck 绿；
4. 下调 M1 棘轮值（files -1 或 excessLines -N）。

### 4.4 批次规划（按 行数 × 域热度）

- **第一批（8 个，行数 Top 且全部位于数据主干）**：`use-table-request` 1034、`use-column-state` 904、`use-tree-data` 880、`use-cell-span` 846、`use-column-sort` 751、`use-editing-orchestrator` 749、`use-row-drag` 713、`use-cell-validate` 670。
- **第二批（10 个）**：`use-table-data-pipeline` 768、`use-table-api` 726（伴随战线四 API 聚簇一起动）、`use-row-view-model` 657、`use-column-filter` 650、`use-hover-layer` 646、`use-teleport-row-rect` 637、`use-virtual-renderer` 625 及其余 600+ 档位。
- **第三批（长尾 24 个）**：500-600 行档，按「摸到才拆」（R-8）原则随功能 PR 顺手处理，仅当 M1 棘轮要求整体收敛时集中清尾。

> 注意「非必要不拆」的边界：`check-hook-size` BASELINE 里测试覆盖薄、近期无功能排期的文件（如 `use-teleport-row-rect.ts` 已被 coverage 排除），拆分收益低于回归风险，排最后或接受豁免并注释理由。

---

## 5. 战线四：API 面与类型/渲染器巨石

### 5.1 TableExpose：110 平铺 → 能力簇（随 v4 major）

现状护栏已经齐备（`api-contract.keys.ts` 编译期 exhaustive + `type-completeness.test.ts` 运行时双向比对 + expose 冻结政策），收敛是安全的：

1. **v3.x（不 breaking）**：新增 `caps` 命名空间 expose——`tableRef.value.caps.selection.getCheckedRows()` 形态，把 110 个成员按 ~10 个能力簇重组（selection / sort / filter / edit / export / print / scroll / columns / tree / misc）；新文档只推荐 `caps`。
2. **v4（breaking，与待发的 `table-4-1-beta` changeset 同窗）**：旧平铺成员批量 `@deprecated`（标注 `caps.*` 替代），走既有三步废弃流程（标记 → devWarn → v5 移除）。
3. `use-table-api.ts`（726 行）与 `use-adv-table-api-assembly.ts`（230 行）按能力簇拆为 `api/` 目录下 10 个装配文件，`UseTableApiReturn` 变为 10 个簇接口的组合——`api-contract.keys.ts` 清单同步重构为按簇分组。

### 5.2 `types/column.ts`（990 行）：照抄 `config.ts` 的桶拆法

`config.ts` 已示范（巨石 → 6 个域文件 + barrel），`column.ts` 同样处理：`column-core`（基础列定义）/ `column-render`（渲染相关）/ `column-edit`（编辑相关）/ `column-features`（filter/sort/sort-by 等）/ barrel 保持 `import from './column'` 零破坏。type-exports guard 已锁导出面，拆分不会静默丢导出。

### 5.3 两个 Renderer.vue（847 / 965）

按「列组件」维度继续下沉：selection-column / normal-column / span-row 已有独立文件，把内联在 Renderer 模板里的列装配（表头筛选格、汇总行、append 行）提为子组件 + `use-*-columns` 组装 composable（`use-v2-columns.ts` 已开了头）。目标各 ≤400 行模板 + 组装 composable ≤300。

### 5.4 `AdvTable.vue`（807）

script 已完全委托编排器，不动；模板 293 行把侧面板区（列设置/列分组/筛选/搜索四个异步面板的挂载与 v-if 联动）抽为一个 `SidePanels.vue`，主模板预期 ≤150 行。

---

## 6. 执行排期

| Phase | 内容 | 产出物 | 预期规模 |
|---|---|---|---|
| **0 机制**（先行，1-2 天） | M1 棘轮 / M2 边界 lint / M3 地图 + play 拆分脚手架（registry、demo-context、2 个试点类别迁完） | hook-size v2、eslint 边界规则、`docs/ARCHITECTURE.md`、smoke-sections.mjs | 机制 PR ×3 + play 试点 PR ×1 |
| **1 play 清零**（~1-2 周，可与 Phase 2 并行） | 其余 8 个类别 + 3 个大区，10 个 PR | TableDemo.vue ≤300 行 | 10 PR |
| **2 核心巨石**（~2-3 周） | 第一批 8 composables + `column.ts` + 2 Renderer + SidePanels | BASELINE -11，棘轮下调 | ~12 PR |
| **3 长尾与 API**（随版本节奏） | 第二/三批 composables；v3.x `caps` 聚簇 → v4 废弃旧面 | BASELINE → 0；Expose 110 → ~10 簇 | 按迭代 |

依赖关系：Phase 0 必须最先（棘轮不立，Phase 1/2 的成果无法锁定）；Phase 1 与 2 无依赖可并行；5.1 的 v4 窗口受发版节奏约束独立推进。

---

## 7. 度量记分卡（复杂度的唯一验收口径）

| 指标 | 基线 | Phase 1 后 | Phase 2 后 | 终态 |
|---|---|---|---|---|
| `>300` 行 src 文件 | 86 | 86（play 不计入 src 统计，单列） | **≤55** | ≤30 |
| hook-size BASELINE / 棘轮 files | 42 | 42 | **31** | **0** |
| play 最大文件行数 | 7,736 | **≤300**（mega 例外） | 同左 | 同左 |
| TableExpose 公开面 | 110 平铺 | 110 + `caps` 簇 | 同左 | v4：~10 簇（旧面 deprecated） |
| src 平均行数 | 196 | 196 | ~180 | ~150 |
| 新人上手路径 | 读 7.7k 行 demo + 无地图 | 有 ARCHITECTURE.md + demo 即文档 | 同左 | 同左 |

记分卡由 M1 脚本顺带输出（`pnpm --filter @advanced-elements/table check:hook-size` 扩展为输出 JSON 汇总），每次 Phase 收口在 PR 描述里贴前后对照。

---

## 8. 明确不做（防过度治理）

1. **不动洋葱结构**——不合并层、不引入 DI 容器/服务定位器、不做惰性初始化框架；
2. **不引入 pinia/状态库**——被 lint 禁令与「状态经 props/provide」架构排除，也是复杂度的新来源；
3. **不做大爆炸重写**——一切走增量 PR，每步全量测试绿；「重写一版」是复杂度治理里最常见的自伤；
4. **不为拆而拆**——扇入 0、测试薄、无排期的豁免文件接受长期豁免并注释理由；300 行是工作阈值不是信仰。

---

## 9. 风险与回滚

| 风险 | 缓解 | 回滚 |
|---|---|---|
| play 拆分改坏演示行为 | 模板**原样搬运**不改逻辑；109 项浏览器冒烟每 PR 全量跑 | 单类别 PR 独立 revert |
| 巨石拆分引入回归 | 对外签名不变；387 个测试文件 + parity 套件门禁；每文件一个 PR | 单 PR revert |
| API 聚簇引发消费方断裂 | v3.x 只增不改；v4 走三步废弃（标记/deprecated 至少一个 major/devWarn） | deprecated 转发保留期内随时可恢复 |
| 棘轮误伤正常增长 | 棘轮文件显式可调（只允许下调的规则由 review 把关，与 lint 棘轮同治理模式） | 调回棘轮值 + 说明 |

---

## 10. Phase 0 落地记录（2026-10-25）

> 实施前按「防过度优化」逐项复核，两处方案修正：

| 项 | 复核结论 | 落地与验证 |
|---|---|---|
| M1 棘轮 | 旧 BASELINE 快照已失效（2026-09 记 42，实测 52，越界零告警）——改造必要性被数据证实 | ✅ `check-hook-size.mjs` 重写为聚合棘轮（超限文件数 > 棘轮值即 CI 红；excessLines 仅信息上报，注释行数噪声不误伤），`hook-size-ratchet.json` 初始 52；set/通过/回归三条路径冒烟验证 |
| M2 边界 lint | **方案修正**：原「components 禁 import composables」经查有 39 个合法消费点，是架构常态——该规则属过度设计，**废弃**。实测真实干净面：utils 上行 5 处全为 `import type`、types 上行 0 处 | ✅ ESLint 仅对 utils/types 设「禁运行时上行引用」规则（`allowTypeImports: true` 放行类型引用）；探针文件验证：运行时 import 报 error、`import type` 放行；`lint:table` 保持全绿 |
| M3 架构地图 | 纯文档，零风险 | ✅ `docs/ARCHITECTURE.md`：装配图、12 域职责、数据流走读、阅读顺序、改动速查、护栏索引 |
| play 试点 | 复核补充两个关键事实：109 个 section 与 categories 选项精确对应；TableDemo 样式块是**全局**（非 scoped），嵌套挂载即继承共享类，无需抽样式。另发现主链尾部有兜底 `v-else`，迁移值需显式排除 | ✅ `section-registry.ts` + `sections/basics/` 两个 section 组件（1.6 slot / 1.6b prop 原样迁出）；TableDemo.vue 增动态挂载点、兜底改 `v-else-if="!sectionRegistry[selectedDemo]"`；`vue-tsc` 全绿；浏览器实测：两个迁移 section 正确渲染（空态 ×2）、未迁移 demo（mega/1.1）不受影响、无兜底泄漏 |

Phase 1（其余 107 个 section 迁移）与 Phase 2/3 按本文排期逐 PR 推进；每次迁移的固定套路已写入 `section-registry.ts` 头注释。

## 10.1 Phase 1 全量落地记录（2026-10-25，同日完成）

> 「一步到位」执行：107 个剩余 section 经一次性脚本全量迁出，未走 10-PR 增量路径。

| 项 | 结果 |
|---|---|
| 迁移规模 | v-if 链 107 块（模板 6,432 → 171 行）全部迁出；含试点共 **109/109** section 落位 `sections/` 12 个类别目录 |
| TableDemo.vue | 7,736 → **1,550 行**（script ~1,080 含 provide 块 / template 171 / style ~300）；主内容区只剩动态挂载点 + 欢迎兜底 |
| section 体积 | 109 个文件共 7,106 行；除 SurfaceSection（1,770，API 全覆盖速查页，配置级豁免）外**全部 ≤229 行** |
| 状态下发 | `demo-context.ts`（28 行）：壳 `provideDemoContext` 全量本地绑定，section `useDemoContext()` 按需解构；刻意 any（演示域不复制 ref 类型面），缺绑定由 vue-tsc 模板检查兜底 |
| 防复发门禁 | `@/max-lines` 400 行作用于 sections/**（antfu v9 的 vue 插件别名；`vue/max-lines` 已自插件移除）；SurfaceSection 单文件配置豁免 + 头注释声明 |
| 验证 | ① `vue-tsc --build` 全绿（迁移中暴露并修复：provide 幻影名 8 个内层作用域变量、28 个 section 补解构 7 个漏网绑定、5 个无解构文件的插入位置错误）；② eslint sections/registry/context/TableDemo 全绿；③ **浏览器全量冲烟 109/109 渲染通过、零控制台错误**（11.1 单页渲染 101 个表格实例）；④ `pnpm build` 生产构建通过（2.7s） |
| 实施教训（记录于案） | ① CRLF 行尾使精确行比对全部失效，迁移脚本必须 EOL 感知；② 词法标识符提取会被注释/文案同名词过采、被解构体嵌套花括号截断——最终以 eslint 裁决剪枝 + vue-tsc TS2339 闭环补漏；③ 大 chunk 首次按需编译 >70ms，冲烟断言需给足等待 |

**Phase 1 遗留（Phase 1b）**：TableDemo.vue 收敛到 ≤300 行需状态重组——`use-table-demo-state.ts`（895 行/189 ref）按消费面拆片、provide 块（~270 行）随之消解；属独立 PR。

## 10.2 Phase 1b 落地记录（2026-10-25，同日完成）

| 项 | 结果 |
|---|---|
| TableDemo.vue | 1,550 → **105 行**（远超 ≤300 目标）：壳层只剩导航/挂载/兜底 + 三行上下文装配，223 行解构与 ~270 行 provide 字面量全部消解 |
| 状态装配 | `provideDemoContext({ ...demoState, ...demoLocal, selectedDemo })`——展开式单点下发，上下文键集合与拆分前精确一致（211 state + 57 local + selectedDemo = 269），**sections 零改动** |
| 新文件 | `use-demo-local.ts`（725 行，原壳层本地 fixtures 原样保形迁移，家族分组注释保留）；`demo.scss`（300 行，原 SFC 全局样式块外置） |
| 有趣事实 | eslint 裁决剪枝后，725 行 fixtures 真正依赖的状态名仅 **2 个**——本地演示数据远比想象中自包含，「按消费面拆片」的后续收益因此有限，fixtures 单文件形态可长期接受 |
| 验证 | vue-tsc 全绿（迁移中修复：内嵌解构块重复声明 1 处、过采 209 名剪至 2 名）；eslint 全绿；`pnpm build` 生产构建通过；**浏览器冲烟 109/109 + 零控制台错误**（v3 事件驱动扫 99 项 + 重载后 11.1（101 表格实例）+ 末批 15 项） |
| 冲烟方法论沉淀 | 后台标签页 setTimeout 受钳制（普通 1s / 闲置 2 分钟后 1 次/分钟），定速循环既慢又产生计时伪影；改用 **MutationObserver 事件驱动等待**（微任务通道不受节流）后全速完成。伪影复核以「重载页面后单点直查」为准 |

Phase 2（第一批 8 个巨石 composables）自此具备干净的 play 验证场；按方案 §4 逐文件 PR 推进，每步含全量测试门禁与棘轮收紧（52 → …）。

## 10.3 Phase 2 首样板落地记录（2026-10-25：use-table-request.ts，刀法 A+C）

| 项 | 结果 |
|---|---|
| 主文件 | `use-table-request.ts` 1,035 → **263 行**（纯编排：装配、生命周期、getters、return） |
| 拆出模块（8 个，全部 ≤300） | `use-table-request-types.ts` 156（契约类型，主文件 re-export 保出口面零变化）/ `-duplicate-keys.ts` 72（刀法 A 纯函数）/ `-options.ts` 91（requestOptions 装配）/ `-loading-bridge.ts` 96（KeepAlive loading 桥）/ `use-request-data-cleaning.ts` 209（清洗三连 computed）/ `use-request-engine.ts` 268（manual 守卫+参数装配+fetch/refresh）/ `use-request-url-sync.ts` 83 / `use-request-writeback.ts` 206（守卫回写+重排+源切换） |
| 唯一语义级改动 | `isUnmounted` 由 `let` 布尔改为 `shallowRef`（跨模块共享可变标志）；其余函数体逐字迁移 |
| **棘轮** | **52 → 51（首次收紧）**，excessLines 11,545 → 10,938 |
| 验证 | 专项 6 文件 56/56 → typecheck 0 错 → data 目录 lint 0 错 → **全量 unit 5,072/5,072**（42s）→ hook-size 棘轮收紧落盘 |
| 过程教训 | ① 棘轮按「文件数」计——引擎首版 427 行造成「一出一进」空手而归，被迫再切 writeback 子域才真正收紧（方案 §4 的拆分配方在单函数巨石上需预留二刀空间）；② 模块化装配的 use-before-define/TDZ 靠钩子注册次序无关性解决（桥接移至引擎与 url-sync 之后改直引）；③ 返回对象箭头写法（`() => x`）不吃解构名，迁移时须逐项核对 |

剩余第一批 7 个（use-column-state 905 / use-tree-data 881 / use-cell-span 847 / use-table-data-pipeline 769 / use-column-sort 752 / use-editing-orchestrator 750 / use-row-drag 714）按同配方逐文件推进。

### 10.3.1 第二个：use-column-state.ts（905 → 274，同日）

| 项 | 结果 |
|---|---|
| 拆出模块（5 个，全部 ≤300） | `-types.ts` 92（契约，主文件 re-export）/ `-guards.ts` 101（刀法 A：schema 守卫 + `isValidColumnStateData` re-export 保住 use-named-views 的运行时导入）/ `-storage.ts` 143（持久化胶水：storage/key/错误策略/防抖/skipWatchSave）/ `-apply.ts` ~250（应用+重排）/ `-restore.ts` ~283（异步恢复 + resetColumnState：恢复存档/恢复初始的对称职责） |
| 语义级改动 | 仅两处：`_skipWatchSave` → shallowRef（跨模块共享）；restore 模块的 `_hasRestored` 私有变量改 `hasRestored()/markRestored()` 访问器（生命周期钩子留在宿主） |
| 棘轮 | **51 → 50** |
| 验证 | 专项 3 文件 34/34 → 全量 unit **5,072/5,072** → typecheck 0 错 → columns 目录 + `lint:table` 全绿 |
| 再次踩中的坑（配方注意项固化） | ① 接口留在主文件的预算误判——905 行拆三个子域后主文件仍 359，类型模块化是必要刀而非可选刀；② apply 首版 317——reset 与 restore 的职责对称性（恢复存档/恢复初始）给了天然的第二刀；③ deps 接口的 `ComputedRef<boolean>` 写窄了实际 `boolean | undefined`——拆分时类型注解按原推断写，别"顺手收严" |

### 10.3.3 第四个：use-cell-span.ts（846 → 293，同日）

| 项 | 结果 |
|---|---|
| 拆出模块（6 个，全部 ≤300） | `-types.ts` 72（契约含 UserSpanMethod/SpanLimitInfo）/ `-row.ts` 136（刀法 A：行合并族）/ `-col.ts` 184（刀法 A：列合并族含链式扫描）/ `-build.ts` 156（SPAN_CELL_LIMIT/SPAN_DEFER_BUDGET/estimateSpanOps/applyRanges/buildSpanMap 编排）/ `-merged.ts` 53（createMergedSpanMethod + deps） |
| 迁移方式 | **python 行号切片组装**——450 行纯层不手抄，从原文件按行区间切出拼装（树拆分教训「逐字纪律必须机械执行」的落地） |
| 语义级改动 | **零**（纯层整体平移 + 函数加 export；主文件仅头部与 re-export 变化） |
| 棘轮 | **49 → 48**（excessLines 降至 9,077） |
| 验证 | 专项 7 文件 47/47 → 全量 unit **5,072/5,072** → typecheck 0 错 → data 目录 lint + `lint:table` 全绿 |

**四个样板累计：棘轮 52 → 48**（use-table-request / use-column-state / use-tree-data / use-cell-span），第一批还剩 5 个（769/752/750/714/671）。

### 10.3.4 第五个：use-table-data-pipeline.ts（768 → 272，同日）

| 项 | 结果 |
|---|---|
| 拆出模块（6 个，全部 ≤300） | `-types.ts` 125 / `-order.ts` 38（resolvePipelineOrder + DEFAULT_PIPELINE_ORDER，re-export 保测试导入）/ `use-pipeline-noop-apis.ts` 130（三个 noop 存根工厂）/ `use-pipeline-filter-sort.ts` 299（懒升级引擎：apiRef 升级 + 释放注册表 + predecessor 阶段链）/ `use-pipeline-stable.ts` 41（prev 稳定性纯函数，主文件与引擎共用）/ `use-pipeline-classification.ts` ~90（列分类缓存 + tree/group 互斥） |
| 语义级改动 | **零**（noop 存根改工厂产出、升级引擎改 deps 注入，函数体逐字迁移） |
| 棘轮 | **48 → 47**（excessLines 8,618） |
| 验证 | 专项 6 文件 65/65 → 全量 unit **5,072/5,072** → typecheck 0 错 → data 目录 lint + `lint:table` 全绿 |
| 本例新坑 | ① 切片法的新失效模式——**闭包自由变量清单只能靠 typecheck 全量枚举**（externalFilter/rowKeyFn 等三处悬空引用均由 TS2304 一次性抓出，比逐个跑测试快）；② 「清理未用 import」要连同返回对象 getter 一起核对（quickFilterApiRef 被误删导致 161 例全量测试失败）；③ 引擎 320 超限的第二刀落在 prev 稳定性纯函数（主文件也用，独立成 shared 模块一石二鸟）；主文件 309 的第三刀落在列分类块 |

**五个样板累计：棘轮 52 → 47**，第一批还剩 4 个（use-column-sort 752 / use-editing-orchestrator 750 / use-row-drag 714 / use-cell-validate 671）。

### 10.3.5 第六个：use-column-sort.ts（751 → 170，同日）

| 项 | 结果 |
|---|---|
| 拆出模块（4 个，全部 ≤300） | `-types.ts` 111 / `-plan.ts` 203（刀法 A：resolveSortableConfig / buildSortEntries / computeSortedData / buildColumnsSortKey）/ `-state.ts` 186（状态机：colMap + toggle/set/cap/getters）/ `-runtime.ts` 252（columnsSortKey + 三 watch + KeepAlive 暂停/清理 + sortedData + lastGoodSort 防抖快照） |
| 语义级改动 | 两处：computeSortedData 纯函数化（闭包读 data/sortState/columns 改显式入参，调度器侧零参包装适配）；lastGoodSort 归 runtime 所有，clearSort 经后绑定 holder 调其 release（`ts/no-use-before-define` 驱动的装配次序解法） |
| 棘轮 | **47 → 46** |
| 验证 | 专项 3 文件 72/72 → 全量 unit **5,072/5,072** → typecheck 0 错 → data 目录 lint + `lint:table` 全绿 |
| 本例固化 | ① 切片范围凭 grep 行号有漏（getters 段落在 state 切片区间外，靠 TS18004 暴露）——**切完先 typecheck 再跑测试**；② 主文件与 runtime 的双向引用（dispose/release 钩子）用「主文件声明 holder + 装配后回填」化解，与 use-adv-table 的 dragEditGuard 同一模式 |

**六个样板累计：棘轮 52 → 46**，第一批还剩 3 个（use-editing-orchestrator 750 / use-row-drag 714 / use-cell-validate 671）。

### 10.3.6 第七个：use-editing-orchestrator.ts（749 → 278，同日）

| 项 | 结果 |
|---|---|
| 拆出模块（6 个，全部 ≤300） | `-orchestrator-types.ts` 75 / `-validation.ts` 105（校验桥）/ `-undo-assembly.ts` 182（useEditUndo 装配 + 事件派发/清错）/ `-batch.ts` 194（useBufferedEdit 装配 + cancelBatchEdit 清错 + 广播 watch）/ `-cell-wiring.ts` 266（interceptor/resolver/导航/useCellEdit 大配置/失焦/submit-discard 门面/editApi 组装）/ `-view-model.ts` 88（稀疏快照 + RowViewModel） |
| 语义级改动 | **零**（纯装配拆分：装配次序不变、回调桥接逐字迁移、deps 按原推断定型） |
| 棘轮 | **46 → 45** |
| 验证 | 专项 4 文件 23/23（含 create-editing-stub 委托测试与 compositional-split guard——二者锁死 `import('./use-editing-orchestrator')` 惰性加载契约，拆分未触碰）→ 全量 unit **5,072/5,072** → typecheck 0 错 → editing 目录 lint + `lint:table` 全绿 |
| 本例固化 | ① **拆分前先查 guard 测试**——compositional-split.guard 与 stub 委托测试对文件结构有硬断言（惰性 import 路径），是拆分契约的一部分；② history 首版 326 超限 → 按「undo 装配 / 批量缓冲」对半二分（batch 依赖 undo 的 pushUndo，单向无环）；③ 布线密集型编排器的第五刀落在 interceptor/resolver/导航/editApi——它们本就是 cell-wiring 的输入输出，下沉零风险且主文件直接 -60 |

**七个样板累计：棘轮 52 → 45**，第一批只剩 2 个（use-row-drag 714 / use-cell-validate 671）。

### 10.3.7 第八个：use-row-drag.ts（713 → 228，同日）

| 项 | 结果 |
|---|---|
| 拆出模块（3 个，全部 ≤300） | `-types.ts` 108（RowDropValidator/RowBeforeDrag/UseRowDragOptions，re-export）/ `row-drag-session.ts` 195（SortableJS 装配：指示线/守卫会话/实例清理）/ `row-drag-sortable-callbacks.ts` 288（onMove/onStart/onEnd 三回调 + buildRegimeBase，ctx 显式下发闭包依赖）/ `row-drag-transient-listeners.ts` 213（可见行缓存 + 暂态监听挂/摘 + abort 兜底 + 虚拟 mouseup 提交） |
| 语义级改动 | **零**——一次险情被专项测试当场拦下：session 边界 `toValue(syncFallbackStyle)` 破坏「调用时取值」语义（`use-row-drag-sync.test.ts` 的 getter 延迟求值用例红），改回透传原始引用 |
| 棘轮 | **45 → 44** |
| 验证 | 专项 6 文件 51/51 → 全量 unit **5,072/5,072** → typecheck 0 错 → interaction 目录 lint + `lint:table` 全绿 |
| 本例固化 | ① 有专项行为测试守语义的边界（getter 延迟求值），**任何「顺手 toValue」都是行为漂移**——测试矩阵的价值在拆分类重构中达到峰值；② 主文件重写一度被截断，git checkout 秒回原版后重做——**三模块先独立全绿再动主文件**的顺序救了一次全程；③ lifecycle 与 session 的 TDZ 用「session 块上移到 lifecycle 之前」解决（同 use-request 引擎的位置解法） |

### 10.3.8 第九个：use-cell-validate.ts（670 → 228，同日）

| 项 | 结果 |
|---|---|
| 拆出模块（4 个，全部 ≤300） | `cell-validate-engine.ts` 178（刀法 A：async-validator 懒加载 + 规则转换 + 单值校验）/ `cell-validate-store.ts` 179（errorMap/epoch/isValidatingAll + clear 族）/ `cell-validate-bulk.ts` 167（validateAll 编排 + 批量重建 + 跨字段批量）/ `cell-validate-types.ts` 64 |
| 语义级改动 | 仅标志归属：epoch/isValidatingAll 由 `let` 改 `{ value }` 持有对象（跨模块共享），bulk 经 onBulkStarted/onBulkSettled 回调置位复位 |
| 棘轮 | **44 → 43**（excessLines 收至 7,745 附近） |
| 验证 | 专项 63/63 → 全量 unit **5,072/5,072** → typecheck 0 错 → editing 目录 lint + `lint:table` 全绿 |
| 本例固化 | 跨模块共享的**双标志**（started/settled 成对回调）比单回调更清晰——bulk 不持有任何宿主状态，测试可直接以回调桩验证置位时序 |

**第一批 9 个巨石全部出清：棘轮 52 → 43**（use-table-request / use-column-state / use-tree-data / use-cell-span / use-table-data-pipeline / use-column-sort / use-editing-orchestrator / use-row-drag / use-cell-validate）。剩余 43 个超限文件为 500 行以下长尾，按方案 §4.4「摸到才拆」随功能 PR 处理，或后续批次集中清尾。

**第一批 9 个巨石全部出清：棘轮 52 → 43**（use-table-request / use-column-state / use-tree-data / use-cell-span / use-table-data-pipeline / use-column-sort / use-editing-orchestrator / use-row-drag / use-cell-validate）。剩余 43 个超限文件为 500 行以下长尾，按方案 §4.4「摸到才拆」随功能 PR 处理，或后续批次集中清尾。

### 10.3.10 对抗性测试第二批（同日续）：持久化 + 分页双发语义

新增 2 文件 15 用例（累计 7 文件 55 用例），继续「场景会怎么坏」路线：

| 文件 | 用例 | 发现与钉住 |
|---|---|---|
| `use-column-state-persistence-adversarial` | 10 | 钉住：schema 失配整体清除+移除存档、applyColumnState 整体拒绝（无部分应用）、include 白名单、防抖合并为单次写、卸载 flush 保留最后调整、'throw' 策略在防抖路径降级为 warn（无 unhandled rejection）、autoSave:false 静音、storageKey 跟随 tableId 运行时变更、未知 colId 跳过、sortIndex 排序回写。**记录 1 个集成注意事项**：跨模式宽度守卫依赖 `mode` getter（未接时静默关闭）——生产装配必接，无 dev 提示，值得未来补 warn |
| `use-table-request-pagination-adversarial` | 5 | 钉住 double-fetch 陷阱两侧：`pagination.setCurrentPage` 纯状态零扇出 vs `setCurrentPageAndRefetch` 恰好一次扇出；pageSize 放大后越界页纠偏回 1；快速连续三次换页无同页重复 pageChange；无 source 纯客户端分页扇出不抛错 |

**方法论教训新增**：① fake timers 下 `advanceTimersByTime` 同步跑回调，async 续体（reject→catch→handleError）在微任务——断言前必须 `advanceTimersByTimeAsync`；② 跨模式守卫这类「依赖可选注入」的防线，未接注入时静默关闭——对抗测试应显式接线并对「未接线」行为留档。

### 10.3.12 对抗性测试第四批（同日续）：数据清洗 + 树懒加载 KeepAlive

新增 2 文件 13 用例（累计 10 文件 72 用例），**又抓到并修复 1 个崩溃级缺陷**：

| 类别 | 内容 |
|---|---|
| **已修缺陷（崩溃级）** | `warnOnDuplicateRowKeys` 对嵌套空洞直接 `keyFn(null)` → TypeError 崩掉整个清洗 computed（渲染中断）。脏行清扫**刻意保留**嵌套空洞（既有不支持形态），而重复键检查器递归进 children 时无 null 守卫——两个模块的契约拼缝处漏保护。修复：visit 入口 `if (row == null) return false`，头注释记录拼缝成因 |
| 清洗对抗（10 用例） | 钉住引用稳定性契约全家桶：原地 push/reverse 必须产出新引用（虚拟表 reset 契约）、同引用同长度同元素复用 prev、无空洞保持原引用（惰性 zero-alloc）、顶层空洞计脏+键重映射、树分支顶层计脏/嵌套静默跳过（文档口径）、树深度优先连续编号、childrenKey 开关失效快路径、defaultData 回退。**发现脚手架级事实**：原地变更可见性依赖深响应式 ref——shallowRef 下完全不可见，生产 useRequest 是深 ref，测试脚手架必须同型 |
| 树 KeepAlive（3 用例） | 钉住：deactivate 中飞 abort → 迟到 children 不写入停靠组件 + loading 复位 + 不标 loaded；重激活后行保持可重试（无永久卡死）；卸载路径对称 |
| 方法论教训 | ⑥ 对抗测试第四批的最大收获在**拼缝处**：清洗模块与重复键检查器各自遵守自己的文档，组合起来在「嵌套空洞」输入上崩溃——单模块测试永远发现不了，跨模块组合场景是对抗测试的核心价值；⑦ 脚手架响应式深度必须与生产同型（deep ref vs shallowRef 的原地变更可见性差异直接决定「原地变更产新引用」这类契约能否被测到） |

### 10.3.13 对抗性测试第五批（同日收尾）：事务内核 + 批量撤销聚合接缝

新增 2 文件 11 用例（累计 12 文件 83 用例），无新缺陷——**钉住一批高价值内核语义**：

| 文件 | 用例 | 钉住的语义 |
|---|---|---|
| `use-data-transaction-adversarial` | 6 | ① 竞态契约实证：beforeHook 挂起期间新事务推进 tid → 旧事务放行后在写入前检查点被丢弃（writeA 不执行）——数据不被旧快照覆写；② writeFn 抛错 → 内核用 oldData **重走同一 writeFn**（部分写入防护，路由一致）→ ok=false 不 reject；③ rollbackLast 用 oldData 重走 writeFn（路由一致）→ 单槽消费后第二次 no-op；④ beforeHook 否决不留回滚目标；⑤ silentMiddle 放弃否决能力（emit 返回 false 也放行，文档化取舍）；⑥ emit 返回 false 的旧式否决兼容 + devWarn 提示生产应接 beforeHook |
| `use-editing-batch-undo-seam` | 5 | ① 批量提交跨 2 行 × 2 字段 → 聚合为**每行一条**撤销记录（字段不丢、行不错位）；② 正向路径逐格派发 cellValueChanged（与单格编辑对齐）；③ 同格重复暂存取最新值（map 语义）；④ 批量模式 displayData 合并暂存变更（渲染器即时呈现未提交编辑）、原始数据不污染；⑤ 空提交 no-op。**脚手架教训**：模块 deps 标注 ComputedRef 就传 computed——裸 getter 经 `.value` 读取静默变 undefined（「getKey is not a function」的根因） |

**对抗测试战役收官（5 批 12 文件 83 用例）**：3 个真实缺陷（抛字符串丢消息 / onActivated watch 泄漏 / 嵌套空洞崩溃）+ 1 个集成注意点 + 21 项钉住语义 + 15 条方法论教训。剩余核心域（selection/interceptor/url-state/quick-filter）既有覆盖已密，边际收益转负——战役到此收口，后续按「摸到才测」随功能 PR 补充。

### 10.3.11 对抗性测试第三批（同日续）：loading 桥接 KeepAlive 接缝

新增 1 文件 4 用例（累计 8 文件 59 用例），瞄准拆分新模块 `use-request-loading-bridge.ts` 与 KeepAlive 的交互面——**实测抓到并修复 1 个真实 watch 泄漏缺陷**：

| 类别 | 内容 |
|---|---|
| **已修缺陷** | KeepAlive 子组件**初始挂载**同样触发 onActivated——桥接在 setup 建 watch1，onActivated 再建 watch2 且句柄直接覆盖、watch1 泄漏：停靠（deactivated）期间 loading 变化仍外发给父组件（watch 停靠失效的整个契约被打破）。修复：onActivated 先 `stopLoadingWatch?.()` 再建新 watch，头注释记录 KeepAlive 初始挂载触发这一非显而易见行为 |
| 钉住语义 | ① 切出时 manual 序号推进 + abort——停靠期间完成的迟到响应被守卫丢弃（无写入、无 loading 泄漏）；② 重激活重启 watch 并**补发当前 loading 值**（避免漏 emit）；③ 卸载路径对称：迟到响应丢弃、loading 终值 false 外发一次 |
| 方法论教训 | ③ emits mock 必须传进 `emits` 键内——顶层同名键被 baseOptions 默认值静默遮蔽（本次误报耽圆一轮）；④ flush:'pre' 的 watch 回调经调度队列，setLoading 后断言前必须过 tick；⑤ 对「初始挂载也触发生命周期钩子」这类 Vue 行为，KeepAlive 契约测试（keepalive-include-semantics）是既有先例——新桥接模块上سته就该配同型用例 |

### 10.3.9 对抗性测试补充（2026-10-25，找问题而非凑覆盖率）

5 个新测试文件 / 40 用例（并发校验 8 + 树形对抗 8 + span 消毒 8 + 排序状态机 8 + 请求回写接缝 8），全部从「场景会怎么坏」出发。**实测产出 1 个已修缺陷 + 4 项钉住语义 + 多个测试方法论教训**：

| 类别 | 内容 |
|---|---|
| **已修缺陷** | `crossFieldValidator` 抛非 Error 值（`throw 'boom-string'`）在行级与全表两条路径上丢失自定义消息、统一替换为通用文案——用户自定义文案被吞。修复：`crossFieldThrownMessage` 助手（Error 取 message / 非 Error 字符串原样保留 / 其余兜底），两路径共用（`cell-validate-engine.ts`） |
| 钉住语义 | ① 并发 validateAll：epoch 互斥使先起跑方在首个批次检查点过期丢弃、**永不重建**（曾怀疑的布尔标志并发危害实测不可达；isValidatingAll 仍硬化为在飞计数防御未来重构）；② 负跨度钳为 0（EP 隐藏格）而非 1——静默升 1 会渲染重复单元格；③ 懒加载中折叠是 no-op（key 未入集合），加载成功后展开落地，陈旧快照守卫保证的是不复活其他行折叠；④ `maxSortColumns=0` 因 `max >= 1` 守卫表现为不限——测试注释标注为文档级决策点 |
| 方法论教训 | ① `toValue(getter)` **无参调用**——裸 `rowKeyFn` 当 getter 传入必炸；② 懒初始化的 Map/metaMap 必须先消费入口 computed 再断言（生产中渲染器必然消费）；③ `ref()` 深响应式对千层嵌套在 Vue 自身递归 walk 中溢出——管线数据是 shallowRef，测试脚手架须同型；④ spanMethod/WeakMap 按**行对象引用**换算，断言必须传同一引用；⑤ 裸调用下 onMounted 已死——sourceChange 流程全程由 watch 驱动，且源必须放 shallowRef（裸 let 不触发 watch 重估）；⑥ `requestSource` 返回的是 DataSource **函数**，多一层调用即 TypeError 被 onError 静默吞掉 |

---
### 10.3.2 第三个：use-tree-data.ts（881 → 247，同日）

| 项 | 结果 |
|---|---|
| 拆出模块（5 个，全部 ≤300） | `-types.ts` 48（契约，re-export）/ `-utils.ts` 131（刀法 A：键归一/访问守卫/collectKeys/buildFullKeyToRow + devTreeWarn/isAbortError）/ `-flatten.ts` 151（刀法 A：展平 + findRowByKey/findAncestorPath/initExpandedKeys——原闭包函数均为显式参数，天然纯函数）/ `-kinship.ts` 175（后代/祖先双缓存查询）/ `-load.ts` 294（懒加载引擎：AbortController 竞态守卫 + 展开折叠 API + 卸载/停靠取消） |
| 语义级改动 | **零**——`isUnmounted`/abort 映射完全属于 load 引擎，无跨模块共享可变标志（比前两个更干净） |
| 棘轮 | **50 → 49** |
| 验证 | 专项 4 文件 74/74 → 全量 unit **5,072/5,072** → typecheck 0 错 → data 目录 lint + `lint:table` 全绿 |
| 本例新坑 | 迁移时两次"顺手改写"被自查纠正（flatten 丢 `rowMetaKey` 的 toRaw 语义、collectAllKeys 被手写循环替代）——**逐字迁移纪律必须机械执行，任何"简化冲动"都是行为漂移入口** |

---

| 项 | 结果 |
|---|---|
| 拆出模块（5 个，全部 ≤300） | `-types.ts` 92（契约，主文件 re-export）/ `-guards.ts` 101（刀法 A：schema 守卫 + `isValidColumnStateData` re-export 保住 use-named-views 的运行时导入）/ `-storage.ts` 143（持久化胶水：storage/key/错误策略/防抖/skipWatchSave）/ `-apply.ts` ~250（应用+重排）/ `-restore.ts` ~283（异步恢复 + resetColumnState：恢复存档/恢复初始的对称职责） |
| 语义级改动 | 仅两处：`_skipWatchSave` → shallowRef（跨模块共享）；restore 模块的 `_hasRestored` 私有变量改 `hasRestored()/markRestored()` 访问器（生命周期钩子留在宿主） |
| 棘轮 | **51 → 50** |
| 验证 | 专项 3 文件 34/34 → 全量 unit **5,072/5,072** → typecheck 0 错 → columns 目录 + `lint:table` 全绿 |
| 再次踩中的坑（配方注意项固化） | ① 接口留在主文件的预算误判——905 行拆三个子域后主文件仍 359，类型模块化是必要刀而非可选刀；② apply 首版 317——reset 与 restore 的职责对称性（恢复存档/恢复初始）给了天然的第二刀；③ deps 接口的 `ComputedRef<boolean>` 写窄了实际 `boolean | undefined`——拆分时类型注解按原推断写，别"顺手收严" |

---

## 11. 结语

这套方案的有效性来自三处克制与三处狠手：**克制**在不碰洋葱结构、不引新框架、不做重写；**狠手**在棘轮只减不增（结构上杜绝反弹）、play 拆到 ≤300 行壳（消灭最大黑洞）、API 面在 v4 真正收缩（偿还最大历史债）。每一步都骑在仓库已有的护栏上（guard 测试、parity、契约清单、lint 棘轮），不需要先建一套新治理体系才能开工——Phase 0 的三个机制本身就是全部新基础设施。
