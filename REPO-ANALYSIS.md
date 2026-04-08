# advanced-elements 仓库质量分析报告

> 分析日期：2026-10-24 · 分支：develop · 快照 commit：34fe660
> 分析范围：`packages/*`、`dev-packages/*`、`scripts/*`、`play/*`、`docs/*`、根级构建/CI 配置
> 维度：性能 / 冗余 / 复杂度 / 耦合度 / 代码可约定性 / 可扩展性

---

## 0. 总览

### 0.1 仓库定位

pnpm 12 + Turborepo 2 管理的 Vue 3.5 + Element Plus 2.14 组件库 monorepo，核心产品是 `@advanced-elements/table`（AdvTable，基于 ElTable / ElTableV2 双渲染引擎的企业级表格），外围三个包：`config-provider`（全局配置）、`elements`（统一安装壳）、`resolvers`（unplugin-vue-components 自动导入）。当前处于 changesets **pre（beta）模式**（`.changeset/pre.json`）。

### 0.2 规模数据

| 指标 | 数值 |
|---|---|
| table 包 src 文件 | 411 个（约 80,618 行，平均 ~196 行/文件） |
| table 包测试文件 | 387 个 `*.test.ts`（测试:源码 ≈ 0.94:1） |
| composables | 158 个，按 12 个域目录分层 |
| 超过 300 行的 src 文件 | 86 个；其中 composables 有 42 个被 `check-hook-size` BASELINE 豁免 |
| 发版/运维脚本 | `scripts/` 10 个文件共 1,495 行 + `packages/table/scripts/` 11 个共 2,101 行 |
| TODO/FIXME/HACK | 全 src 仅 **5 处** |
| 最大源文件 | `use-table-request.ts` 1,034 行；`TableVirtualRenderer.vue` 965 行；`AdvTable.vue` 807 行 |
| play 最大文件 | `TableDemo.vue` **7,736 行**（模板 6,496 行，342 个 `<adv-table>` 实例） |

### 0.3 六维总评

| 维度 | 评级 | 一句话结论 |
|---|---|---|
| 性能 | ★★★★☆ | 运行时优化（虚拟滚动、Worker 排序、事件委托、异步分包）与体积门禁体系完整；CI 构建链路有重复安装/构建浪费，两套体积预算口径不一致 |
| 冗余 | ★★★★☆ | 有 ownership-matrix + guard 测试主动治理重复，utils 层收敛度极高；残留测试目录错位、死测试、双预算等 8 处确认冗余 |
| 复杂度 | ★★★☆☆ | 分层架构是管理复杂度的有效手段，但 158 个 composables + 7 层洋葱编排 + 42 个超限豁免文件的存量债务真实存在；play 巨石文件是最大维护黑洞 |
| 耦合度 | ★★★★☆ | 包间耦合极低（可选 peer + 壳 + 零依赖 resolver）；包内靠 ISP 窄切片、20 个域注入键、DOM 适配器收敛耦合，装配顺序是隐式契约 |
| 可约定性 | ★★★★★ | 全文最突出的优点：约定全部机器化（12 条注释规则、6 个专项检查、10+ guard 测试、ownership-matrix、ADR），罕见的高执行力 |
| 可扩展性 | ★★★★☆ | 编辑器/筛选器/值类型三个注册表 + 双渲染器适配器 + 新包 CI 零改动；TableExpose 100 方法的巨面 API 和类型镜像双维护是演进阻力 |

---

## 1. 性能

### 1.1 构建性能

**正面**

- **Rolldown（oxc 工具链）** 替代 rollup 全家桶：`dev-packages/rolldown-config/src/index.mjs:390-403` 记录了移除 5 个 rollup 插件的迁移收益（esbuild/node-resolve/commonjs/terser/postcss 全部由 rolldown 内置能力替代）。三个业务包的 `rolldown.config.mjs` 均为 10~25 行薄配置。
- **SCSS 增量编译**：共享构建配置内按 mtime 缓存跳过未变更文件（`dev-packages/rolldown-config/src/index.mjs:244,312-323`），watch 模式只重编译变更样式；partial（`_*.scss`）只复制不独立编译，避免产出无用 CSS。
- **双输出去重**：ESM+CJS 双输出下 `writeBundle` 会触发两次，配置按 `output.format === 'es'` 门控只跑一次样式管线（`SCSS_EMIT_FORMAT`，同文件 :248-257 注释记录了实测踩坑）。
- **Turborepo 任务图**：`turbo.json` 声明 `build`/`test`/`typecheck`/`coverage` 的 `dependsOn: ["^build"]`，依赖包只构建一次并缓存。
- **play 零构建启动**：`play/vite.config.ts` 用 alias 直连各包 `src`，开发无需先 `build:all`（CONTRIBUTING.md:12-29）；唯一 dist 依赖由 `predev`（`scripts/ensure-play-deps.mjs`）自动补齐。
- **dts 与 JS 分离**：`vue-tsc -p tsconfig.dts.json` 只在 build 时跑，日常 `typecheck` 走 noEmit。

**负面 / 风险**

- **CI 6 个 job 各自独立 `pnpm install --frozen-lockfile` + 各自重新构建**（`.github/workflows/ci.yml`：lint/test/browser/build/audit/benchmark 六个 job 无产物共享、无 artifact 传递、无 turbo 远程缓存）。test job 的 `turbo run typecheck` 与 `turbo run test` 串行且都依赖 `^build`，同一 job 内构建可命中本地 turbo 缓存，但跨 job 重复。这是 CI 耗时的主要浪费点。
- **`shamefullyHoist: true` 是布局级依赖**（`pnpm-workspace.yaml:12-15`）：注释自认「各包构建脚本直接调用未声明的二进制（如 rolldown）」。这掩盖了包级依赖声明缺失（`rolldown` 本体不在 table 的 devDependencies 里），是脆弱假设——若未来收掉 hoist，构建即刻断。
- lint job 的 `lint:table` 全仓 eslint 单进程跑，对 500+ 文件仓库可接受，但 `lint:check`（全仓 `--max-warnings 0`）未进 CI（历史债务棘轮，见 §5）。

### 1.2 运行时性能

表格库的运行时性能设计是本仓库的强项，机制清单：

| 机制 | 实现 | 证据 |
|---|---|---|
| 虚拟滚动双引擎 | `table-virtual-renderer/` 24 个文件（`use-v2-grid-core/-shell/-instance`、`use-scroll-velocity`、`use-virtual-columns/-span`） | `packages/table/src/components/table-virtual-renderer/` |
| Web Worker 排序 | `sort-worker-scheduler.ts` 三重门槛（`sortWorkerThreshold`/`MinEntries`/`Timeout`）+ Blob Worker（`utils/worker-blob.ts`），错误回退主线程 | `composables/data/sort-worker-scheduler.ts:1-30` |
| 事件委托降维 | 溢出 tooltip：N×M 每格 mouseenter 闭包 → 容器 2 个监听器（`use-adv-table.ts:256-262` 注释）；表头 tooltip：N 个 ElTooltip → 1 个实例（`use-shared-header-tooltip.ts` 头注释） | `composables/shared/use-overflow-tooltip-delegation.ts` |
| 异步分包 | ① `AdvTable.vue:107-146`：7 个面板组件（列设置/列分组/右键菜单/筛选/搜索等）`defineAsyncComponent`；② `createAsyncLoader`（`utils/async-feature.ts`）：同步壳 + 按需加载 + 并发合并 + 失败重试，消费方含导出编排器、拖拽编排器；③ chunk 失败有界重试 + `role="alert"` 兜底 UI（`utils/async-chunk.ts`） | 见左列文件 |
| 重依赖按需 | `xlsx` 为 optional peer，动态 import + 失败回退 `sanitizeDataArray`（`utils/ensure-xlsx.ts`），不用导入导出零体积 | `packages/table/src/utils/ensure-xlsx.ts` |
| 调度收敛 | `rafSchedule`/`rafThrottle`/`idleSchedule` 收敛全库手写 rAF/setTimeout 同构模式（`utils/raf.ts` 头注释）；`createTrailingDebounce` 收敛落盘/refetch 防抖 | `utils/raf.ts`、`utils/debounce.ts` |
| 性能档位 | `performanceProfile: 'high' | 'low'`（prop + 全局配置 + 注入键三源合并），low 档关闭滚动看门狗/速度追踪/hover 鼠标追踪 | `use-adv-table.ts:337-341`、`injection-keys.ts:96` |
| 缓存 | cell-span 缓存、summary 缓存、data-pipeline memo（对应测试 `use-cell-span-cache`/`use-table-summary-cache`/`use-table-data-pipeline-cache`） | `__tests__/composables/` |
| 行高估算 | `utils/estimated-row-height.ts` 虚拟滚动预热 | — |
| 并发池 | `utils/concurrency-pool.ts`（异步汇总等批处理） | `use-async-summary.ts` |
| 基准与防退化 | `benchmark-pipeline.mjs`/`benchmark-full-pipeline.mjs`（CI informational job，`continue-on-error` 并注释论证为何不阻断：共享 runner 抖动误杀成本高于漏报）；`memleak-table.mjs` 内存泄漏演练 | `packages/table/scripts/` |

**评价**：机制覆盖面在同体量开源表格库里属第一梯队，且每个「收敛点」都有 ownership-matrix 登记（见 §2.3），不是零散优化。弱点是 `performanceProfile` 目前只有两档，缺乏自适应降档。（benchmark 基线对比已于 2026-10-25 补齐，见 §7.1。）

### 1.3 产物体积

- **size-limit 预算**（`packages/table/package.json:144-160`）：`index.mjs` 240KB / `index.cjs` 245KB / `index.css` 30KB（均为 gzip）；elements 壳 5KB。
- **双预算口径（2026-10-25 二次复核修正：非漂移，是两种度量）**：`scripts/check-bundle-size.mjs` 的 120KB 与 size-limit 的 240KB 数字不同但**度量不同**——前者测产物文件自身 raw gzip（实测 75.4KB），后者（`@size-limit/esbuild`）测连同 runtime 依赖打包后的 gzip（实测 233.2KB，240KB 是 3% 余量的紧棘轮）。曾按「同度量双源漂移」误诊并尝试统一，CI 门禁实测变红后回滚，改为在两处脚本/配置注释中写明口径差异。
- **外部化双保险**：`analyze-bundle.mjs` 用 sourcemap VLQ 解码做模块归因，并断言重依赖「必须以裸说明符出现在 dist（已外部化）且任何 `.map` 的 sources 不得含其 `node_modules` 路径（未内联）」。
- **EP 样式按需**：构建期扫描源码 EP 组件导入，生成与 ElementPlusResolver 描述符逐字节一致的副作用入口 `dist/style/element-plus.js`（`rolldown-config/src/index.mjs:149-238`），消费方打包器按 resolved id 去重——解决了「组件库内部使用的 EP 组件样式」与「用户侧 resolver 注入样式」的重复问题，设计相当精细。
- `sideEffects` 精确到 scss/css/element-plus.js 三项；`prepack` 剥离 sourcemap 不进 tarball。
- `ANALYZE=1` 才注入 visualizer 插件，默认构建零开销（`packages/table/rolldown.config.mjs`）。

---

## 2. 冗余

### 2.1 确认冗余（建议处理）

| # | 问题 | 证据 | 建议 |
|---|---|---|---|
| R1 | **测试目录名错位 + 死测试**：`__tests__/components/virtual-renderer/` 下 3 个测试实际 import 的全是 `src/components/table-virtual-renderer/`（src 侧已无 `virtual-renderer` 目录）。其中 `span-row-renderer.test.ts`（155 行）**既不在 unit project 的 include 白名单、又被 browser project exclude**——永远不会被执行 | `__tests__/components/virtual-renderer/span-row-renderer.test.ts:5`；`vitest.config.ts` unit include 仅列 `virtual-renderer/use-virtual-renderer.test.ts` 与 `selection-v2-column.test.ts` | 目录改名 `virtual-renderer/` → 并入 `table-virtual-renderer/`；删除或恢复死测试到 include |
| R2 | **互补测试套件错置**（复核修正：初判「断言面重叠」不实）：`use-virtual-renderer.test.ts` 在两个目录各一份（892 行行为套件 vs 112 行无挂载回退套件），`span-row-renderer` 亦然（基础创建语义 vs 分区/overlay/append 语义）——内容互补而非重复，但同模块测试分居两目录、其一永不执行 | `__tests__/components/virtual-renderer/` vs `__tests__/components/table-virtual-renderer/` | 移入同目录并以内容后缀区分（`.behavior` / `.basic`），全部保留 |
| R3 | **双体积预算「漂移」（二次复核修正：误诊）**：120KB（check-bundle-size，raw gzip 口径）与 240KB（size-limit，bundled-with-deps 口径）度量不同、各自校准，并非同一指标的漂移 | `check-bundle-size.mjs` vs `package.json` size-limit + `@size-limit/esbuild` | 保留两套预算，注释写明口径差异 |
| R4 | **根脚本冗余**：`lint` 与 `format` 完全相同（都是 `eslint . --fix`）；脚本运行时 esno(.ts) 与 node(.mjs) 混用无明确边界 | `package.json:16-17` | format 保留 lint 语义别名可接受，但应注释声明；运行时统一为 node + .mjs（ts 脚本仅 5 个且都不大） |
| R5 | **运维脚本重复样板**：`out()`（绕 no-console 的 stdout 输出）、ROOT 解析、Windows pnpm 调用包装在 `ensure-play-deps.mjs` / `fix-deps.mjs` / `release-verify.mjs` 各写一遍；`readPackages` 在 `release-lib.ts` 与 `release-verify.mjs` 双实现 | `scripts/*.mjs` | 抽 `scripts/lib/*.mjs` 共享 |
| R6 | **死代码**：`release-version.ts:54-57` 跑 `changeset status --output plan.json` 导出计划后从未读取即删除；`@changesets/changelog-github` 在 devDependencies 但 config 用的是 `changelog-git` | `scripts/release-version.ts`；`.changeset/config.json` | 删 |
| R7 | **`verify-commit.ts` 长度上限失效**：`.{1,50}` 无 `$` 锚定，50 字符主题上限实际不生效 | `scripts/verify-commit.ts` | 正则补锚定 |
| R8 | **docs 与 play 演示重复 ~70%**：功能主题（row-pin/undo-redo/batch-editing 等同名 demo）在 `docs/examples/table/`（42 个独立小文件）与 `play/src/views/TableDemo.vue` 各实现一遍，零代码共享 | agent 全量比对 | 见 §4.3 建议：play 收缩为「docs 未覆盖的开发实验场」 |

### 2.2 非冗余（看似重复、实则有因 —— 防误删清单）

以下成对/成组文件经核查**不是冗余**，各有 ownership-matrix 或注释背书：

1. **tooltip 四件套**（`use-overflow-tooltip` / `-delegation` / `use-shared-header-tooltip` / `use-virtual-tooltip`）：后者为基类，前三者是「单实例复用 / 容器委托 / 表头特化」三种消费形态，头注释互相 `{@linkcode}` 引用。
2. **防抖/节流多实现**：`createTrailingDebounce`（有 cancel/flush）、VueUse `useDebounceFn`（clipboard 用）、`refDebounced`（值防抖）、`rafThrottle`（帧节流）语义不同，`docs/ownership-matrix.md` 逐项登记分工。
3. **双渲染器目录**（`table-renderer/` vs `table-virtual-renderer/`）：分别对接 ElTable 与 ElTableV2 的 DOM/props 差异，公共逻辑已下沉 `renderer-core/`（`render-helpers` 325 行、`column-vnode-factory` 318 行、`cell-render-content` 175 行共享）。
4. **`equality.ts` 手写 shallowEqual**：带 NaN/Date 值语义修正（头注释记录了误判事故），非重复造 lodash 轮子。
5. **`elements` 壳包**：Element Plus 生态惯例的统一安装入口，聚合 install + 转发 style exports。
6. **`config-provider/src/types.ts`（371 行）与 table 的 props 类型镜像**：因 config-provider 是**可选 peer**（不能在运行时/类型上强依赖 table），采用手动镜像 + `src/__type-guards__/global-config-conformance.guard.ts` 锁定一致性——是「包解耦」换来的受控重复。

### 2.3 反冗余治理机制（本仓库亮点）

- `docs/ownership-matrix.md`：11 条跨路径规则登记唯一实现位置（树级联、行号域、空闲调度、列宽下限……），并规定「新增跨路径规则必须先登记本表，否则 PR 不合入」。
- guard 测试族（`__tests__/guards/`）：`injection-contract`（20 个注入键锁定）、`event-naming`、`composational-split`、`is-virtual-allowlist` 等，把「不得重复/散落」变成测试断言。
- utils 层每个收敛点（`raf.ts`、`debounce.ts`、`ensure-xlsx.ts`）头注释都记录了「收敛了哪些此前的重复实现」。

**结论**：冗余治理意识极强，存量冗余多为**边缘地带**（测试目录、运维脚本、play），核心 src 内未发现未登记的重复实现。

---

## 3. 复杂度

### 3.1 量化画像

- **composables 158 个 / 12 个域目录**（core/data/editing/features/interaction/rendering/selection/shared/scrolling/columns/api/view-model/locale）。目录分层 + `composables/index.ts`（113 行）桶导出是有效的导航手段。
- **86 个文件超 300 行**（CONTRIBUTING 约定单文件 ~300 行优先拆分）。`check-hook-size.mjs` 以 **42 个文件 BASELINE 豁免**承认了 composables 层的存量债务（占比 27%），豁免清单顶部注释明确了「摸到才拆」（R-8 纪律），新文件超限即 warn。
- **复杂度 Top 文件**：`use-table-request.ts` 1,034、`types/column.ts` 990、`TableVirtualRenderer.vue` 965、`use-column-state.ts` 904、`use-tree-data.ts` 880、`TableRenderer.vue` 847、`use-cell-span.ts` 846、`AdvTable.vue` 807、`use-table-data-pipeline.ts` 768。

### 3.2 架构复杂度：洋葱式编排

`AdvTable.vue`（500 行 script + 293 行 template）几乎不含逻辑，全部委托给主编排器 `useAdvTable`（395 行，`composables/use-adv-table.ts:6-17` 的 ASCII 架构图）：

```
Core（配置/i18n/错误/引用）
  → DataColumns（列/数据/管线）
    → Selection → Interaction → SharedEditing → Features
      → RendererIntegration / Watchers / ApiAssembly / Lifecycle
```

- 每层是「域编排器」（如 `use-selection-orchestrator`、`use-interaction-orchestrator`），域内再拆子 composables（selection 域 10 个文件：core/state/strategies/query/batch/guards……）。
- **认知成本**：理解一次完整数据流需要跨 4~5 层编排器；命名与分层高度规律（`use-<domain>-orchestrator`、`use-v2-*`），但新人仍需啃下 core 层 16 个文件才能动手。
- **隐式顺序契约**：装配顺序即依赖（如 Interaction 必须先于 SharedEditing 创建，`use-adv-table.ts:179-183` 用可变 `dragEditGuard` 后绑定避免循环依赖，注释坦诚记录了原因）。这类「顺序敏感」目前只有注释约束，无测试锁定装配顺序。

### 3.3 配置复杂度热点

- **`packages/table/vitest.config.ts` 约 180 行手工白名单**：unit/browser 两个 project 的 include/exclude 逐文件枚举（unit include 约 30 个 glob，browser 逐条 `!` 排除），每条都有双语注释解释归属原因——设计认真但维护成本高，R1 的死测试正是白名单漂移的直接产物。parity 测试的归属注释（browser project 会 stub 掉 element-plus 导致 parity 只能跑 unit）暴露了双 project 的配置复杂度根因。
- **类型桶文件 `types/`**：被 src 内引用 130+ 次（最大耦合点，见 §4.2），`types/config.ts` 头注释记录了从巨石文件拆分为 6 个域文件的历史。

### 3.4 示例/演示复杂度（最大债务）

- **`play/src/views/TableDemo.vue` 7,736 行**：script 937 行（39 个 ref）、template 6,496 行、342 个 `<adv-table>` 实例、110 个 `selectedDemo ===` 条件分支撑起侧栏切页。配套 `table-demo/` 已抽出 2,711 行状态与数据，但**没有任何 section 子组件**——`use-table-demo-state.ts` 头注释声称「主组件 provide、section 组件 inject」，实际 `TableDemo.vue:331` 整包解构单文件消费，**注释与实现漂移**。任何演示改动都要在 7.7k 行里定位。
- `docs/components/table.md` 1,814 行 / 42 个 demo 容器，组织良好（每个 demo 独立小文件），恰是 play 应该效仿的形态。

**结论**：复杂度是「被认真管理的大」，而非「失控的大」——分层、豁免清单、架构图注释都在主动对抗它。真正的失控点集中在 play（和 CI 白名单式 vitest 配置）。

---

## 4. 耦合度

### 4.1 包间耦合（低，设计良好）

| 边 | 形态 | 评价 |
|---|---|---|
| table → config-provider | **可选 peer**，src 仅 3 处引用（`index.ts`、`core/use-table-config.ts`、conformance guard），缺失时静默走默认配置 | 优：核心包零硬依赖 |
| elements → table + config-provider | workspace 运行时依赖，纯 re-export + 聚合 install | 优：壳职责单一 |
| resolvers → 任何包 | **零依赖**（`resolvers/src/index.ts:5-17` 内联 resolver 类型定义以避免 peer dep），组件注册表是纯字符串映射 | 优：可独立发版 |
| 各包 → rolldown-config | devDependencies `workspace:*`，配置收敛为一个工厂函数 | 优：单源 |

类型镜像（§2.2-6）是包间解耦的代价，用 guard 测试补偿。

### 4.2 包内耦合

**收敛手段（正面）**

1. **ISP 窄切片**：`use-adv-table.ts:83-84` 「props 在入口拆为窄切片下发，子编排器不再持有全量 props」；返回值同样收敛为显式域契约（`UseAdvTableFeaturesReturn` 等，「下游禁读内部字段」）。
2. **窄上下文接口**：`types/orchestrator-context.ts` 定义 `RowContext`/`ColumnContext`/`RendererContext`/`CrossCuttingContext` 四个载体，注释明确「这些字段总是一起出现，抽取避免重复声明」。
3. **20 个域注入键、无上帝上下文**：`types/injection-keys.ts` 头注释完整声明隐式契约（提供点唯一、消费走 `useSafeInject` 缺省 devWarn、改名删键靠 `injection-contract.test.ts` 锁定、新增键先答「是否拥有 state+lifecycle」）；并记录「R2：上帝上下文已删除，全新版本一步到位，不保留转发层」。
4. **渲染器 DOM 适配器**：`renderer-core/dom-adapter.ts`（`IRendererDomAdapter` 接口 + default/virtual 双实现）是「EP 内部 DOM 结构的唯一出口」，hooks 不持 EP 类名字符串——EP 大版本升级只改两个适配器文件；配套 `RendererCaps` 能力表（「新代码一律查能力，不再询问渲染模式布尔量」）+ `ep-selectors.guard.test` 锁类名集中度。
5. **依赖禁令机器化**：`eslint.config.mjs:36-73` 对 `packages/table/src` 禁 axios/pinia/vuex/fetch/useStore（含子路径与成员调用的 AST 级拦截），数据经 `request.source` 注入、状态经 props/provide 传递——把架构约束写进 lint。
6. **循环依赖防御**：`injection-keys.ts:25-27` 用 type-only import 保证「types→composables 无运行时环」；装配层的后绑定 holder（§3.2）显式处理顺序环。

**耦合热点（需知悉）**

- import 统计 top：`types` 桶 130 次、`dev-warn` 68、`env` 60、`types/config` 55、`utils/shared` 54、`element-plus` 51、`dom-adapter` 21。类型桶作为枢纽是可接受的（编译期擦除），但 `utils/shared.ts`（358 行、19 个导出）有变成杂货铺的趋势——目前有 ownership 意识，尚可控。
- `element-plus` 51 处直接 import 是与上游的固有耦合，已由「EP 样式扫描 + 双渲染适配器 + ep-props/ep-selectors guard」三面包夹，升级路径清晰。

### 4.3 基础设施耦合

- **shamefullyHoist 布局假设**（§1.1）：构建脚本调用未声明二进制，是依赖声明与实际用例的隐性耦合。
- `play/vite.config.ts` Node 侧 import `@advanced-elements/resolvers`（读 dist），与浏览器侧 alias 直连 src 的策略刻意不同，`ensure-play-deps.mjs` 兜底——注释自洽。
- `docs/.vitepress/config.js` 同样 alias 直连 table/config-provider 的 src，文档站与包源码强同步（改包即改文档预览，无需发版）。

---

## 5. 代码可约定性

这是本仓库**最强的维度**——约定不只是文档，而是几乎全部机器化：

### 5.1 门禁矩阵

| 门禁 | 载体 | 强度 |
|---|---|---|
| 双语注释规范（12 条规则 R1-R12） | `COMMENT_CONVENTIONS.md`（42KB）+ `check-comment-convention.mjs`（447 行） | 阻断级 R1/R2 已全仓通过；报告级 `--strict` 可升级 |
| i18n 完整性 | `check-i18n.mjs`：zh/en 键集 diff + 禁止绕过 `tf()` 直写中文回退 | CI 阻断 |
| Hook 体积 | `check-hook-size.mjs`：新文件 >300 行 warn（42 个存量豁免） | warn（软门禁） |
| 命名空间别名 | `check-namespace-aliases.mjs`：SCSS 禁硬编码 `var(--el-*)`，运行时字符串必须登记别名 | CI 阻断 |
| EP props/选择器守卫 | `ep-props.guard.test.ts` / `ep-selectors.guard.test.ts`（vitest） | CI 阻断 |
| 注入契约 | `injection-contract.test.ts` 锁 20 键 | CI 阻断 |
| 事件命名/API 命名/类型导出 | `event-naming`、`expand-api-naming`、`type-exports` 等 guard + `src/__type-guards__/` 清单文件 | CI 阻断 |
| Conventional Commits | husky `commit-msg` + `verify-commit.ts` | 本地钩子 |
| 格式化 | antfu ESLint 单一入口（无 prettier），`lint:table` 0 warning 棘轮 | CI 阻断（仅 table 范围） |
| 覆盖率 | table 85/75/85/85（branches 75 有校准注释：实测 78.04% 基线留 3 点缓冲） | CI 阻断 |
| 跨路径唯一实现 | `docs/ownership-matrix.md` 11 条 + PR 门禁约定 | 人工 + guard 辅助 |
| 公开 API 演进 | `TableExpose`（~100 成员）只减不增；三步废弃流程（标记→devWarn→major 移除）写入 CONTRIBUTING | 文档约定 + `type-exports` guard |
| 决策留档 | `docs/adr/` 5 篇（行索引域/受控矩阵/caps 演进/错误码门槛/全局注册表），均标注已实施 | 流程约定 |
| 依赖单一版本源 | `pnpm-workspace.yaml` catalog（含 eslint 定制放行 @types/node 双大版本的白名单注释） | 装载期 |

### 5.2 执行力证据

- 抽查的每个核心文件（`debounce.ts`、`raf.ts`、`equality.ts`、`injection-keys.ts`、`dom-adapter.ts`、`use-adv-table.ts`……）双语注释均合规，且注释内容是「约束、时机、陷阱」而非复述代码——`COMMENT_CONVENTIONS.md` 的负面清单（禁翻译函数名、禁复述类型签名）执行到位。
- 注释里的「考古记录」密度高（为什么删上帝上下文、为什么 branches 阈值是 75、为什么 OTP 走 env 不走 flag），对后续维护者价值极高。
- `AGENTS.md` 对 AI 协作产出有专门卫生条款（不提交构建产物/占位文件、最小 diff、验证后再报）。

### 5.3 弱点

1. **lint 棘轮只覆盖 table**：全仓 `lint:check`（`--max-warnings 0`）存在历史 warning 债务未进 CI（ci.yml 注释自认），play/docs 脚本部分游离于棘轮外。
2. `verify-commit.ts` 的 50 字上限失效（§2.1-R7）；husky 钩子在工具链完全缺失时**告警放行**（对无 node 贡献者友好，但也是绕过点，属有意权衡，注释已声明）。
3. `play/src/views/table-demo/use-table-demo-state.ts` 的 provide/inject 注释与实现漂移（§3.4）——约定文档的「真实性」在 play 区域掉队。

---

## 6. 可扩展性

### 6.1 用户侧扩展点

| 扩展点 | API | 实现 | 质量 |
|---|---|---|---|
| 自定义单元格编辑器 | `registerCellEditor`（全局 Map 注册）+ `EditConfig.editors`（单表 Record/Map 覆盖） | `cell-editors/editor-factory.ts`（内置优先级 > 自定义，dev 下重复注册告警） | 高 |
| 自定义筛选类型 | `registerFilterType`（策略模式 `FilterStrategy`：默认值/激活判定/匹配/浮层组件/面板组件五件套） | `composables/features/filter-registry.ts` | 高 |
| 自定义值类型渲染 | valueType 注册表（渲染与导出/复制共用同一注册表，「避免规则漂移」） | `utils/value-type-registry.ts` | 高 |
| 拦截器 | `props.interceptor`（编辑提交等钩子） | `composables/editing/use-interceptor.ts` | 中 |
| 插槽 | 12 个具名插槽（`types/slots.ts`） | — | 中 |
| 全局配置 | `<AdvConfigProvider :config>` 按 prop 名镜像下发 | config-provider 包 | 高 |
| 自动导入 | `AdvancedElementsResolver({ direct, sideEffects })` | resolvers 包 | 高 |

三个注册表共同的工程细节：dev 下重复注册/覆盖均有 `devWarnRepeat`，且 `filter-registry-prod.test.ts` 专门验证生产构建下注册表行为。

### 6.2 渲染器扩展（架构级）

`IRendererDomAdapter` + `RendererCaps` + `renderer-interface.ts` 构成渲染引擎抽象：新增第三引擎（如自研 canvas 网格）需要实现适配器接口 + 一个渲染器组件 + 能力表，hooks/编排器层零改动。代价是 `renderer-core/` 有 13 个文件的间接层。`is-virtual-allowlist.guard.test.ts` 防止「虚拟模式判断」散落回布尔量。

### 6.3 仓库侧扩展

- **新包接入 CI 零改动**：turbo 按同名 script 聚合（ci.yml 注释明示「新包实现同名脚本即自动接入」）；构建走共享 `createRolldownConfig`；版本走 catalog。实测三个外围包接入成本就是「package.json + 10 行 rolldown.config + 继承 tsconfig」。
- **新组件**（如未来加 Form）需要动 4 处：新包、`elements` 聚合导出、`resolvers` 注册表条目、docs 侧栏——registry 是手写字符串映射，无代码生成，但条目结构简单（direct/external/style 三字段）。
- **API 演进护栏**：`TableExpose` 冻结策略（只减不增，新能力优先 props/事件/插槽）+ 三步废弃流程 + `api-coverage.md` 同步要求。

### 6.4 扩展性阻力

1. **`TableExpose` ~100 方法巨面**：即使冻结，存量面使每次内部重构都要维护转发兼容，`use-table-api.ts`（726 行）+ `use-adv-table-api-assembly.ts`（230 行）长期偏大。
2. **类型镜像双维护**（§2.2-6）：config-provider 与 table 的配置类型靠 guard 对齐，新增配置项要改两处 + 测试。
3. **vitest 双 project 手工白名单**：新增测试文件必须人工判断归属 unit/browser 并更新白名单，漏更新即静默不跑（R1 已发生）。

---

## 7. 改进建议（按优先级）

**P0（影响正确性）**

1. 修 R1：`virtual-renderer/` 测试目录改名合并，恢复或删除死测试 `span-row-renderer.test.ts`——「测试永远不跑」会给出虚假的绿色信心。
2. ~~修发布门禁盲区~~（**复核推翻，2026-10-25**）：初判「pre 模式下未消费 changeset 存于 `.changeset/pre/`」有误。git 历史与 upstream 源码（`@changesets/write` 写根目录、`assemble-release-plan:328` 在 pre 模式过滤 `pre/` 前缀）证明：**`pre/` = 本次 pre 周期已消费的归档，待发集合 = 根目录**，`pendingChangesets()` 只读根目录是正确行为。原建议（也读 `pre/`）反而会让 beta 发布门禁恒失败。真实缺口收窄为：`changeset pre exit` 之后（mode: exit）upstream 会把 `pre/` 重新计入待发，此时门禁应能看到它们。

**P1（债务止血）**

3. 拆分 `play/TableDemo.vue`：按 `selectedDemo` 维度拆 section 组件（docs/examples 的组织方式就是范本），或让 play 直接复用 docs/examples + 少量实验页；同时修正 `use-table-demo-state.ts` 与实现漂移的注释。
4. 统一体积预算来源（R3），`check-bundle-size.mjs` 改读 size-limit 配置或删除。
5. CI 效率：6 job 共享 install 产物（artifact 或 turborepo 远程缓存），预计可省 30-40% CI 时长。
6. 消除 shamefullyHoist 依赖：把 `rolldown`、`sass` 等构建期真实使用的二进制补进各包 devDependencies，为将来收掉 hoist 留路。

**P2（锦上添花）**

7. R5/R6/R7 脚本清理（共享 lib、删死代码、正则锚定）；`release-docs.ts` 的 SSH 硬编码换可配置远端或 GitHub Actions 部署。
8. vitest 白名单改负向排除（browser project 只列排除项，其余默认 unit），降低新增测试的归属心智。
9. benchmark 增加历史基线持久化（JSON 入库比对），让 informational job 可读。
10. 为 `useAdvTable` 的装配顺序隐式契约补一个装配快照测试（锁定各编排器创建顺序与注入键集合）。

### 7.1 实施复核与落地记录（2026-10-25）

每项建议实施前逐项复核，结论与落地情况：

| 项 | 复核结论 | 落地 |
|---|---|---|
| P0-1（R1 死测试） | **属实**。`vitest list` 权威确认：390 个测试文件中 unit 388 + browser 1（仅 `e2e/full-pipeline`）+ 死 1（`virtual-renderer/span-row-renderer`）。另确认两对「同名」测试内容互补而非重复 | ✅ 三个测试移入 `table-virtual-renderer/`（`.behavior` / `.basic` 后缀区分），死测试复活；`vitest list` 前后对比验证 390 文件零遗漏 |
| P0-2（pre 模式门禁） | **初判错误，已推翻**（见上文）。真实缺口仅 `pre exit` 过渡态 | ✅ `pendingChangesets()` 补 exit 模式计入 `pre/`（与 upstream `assemble-release-plan` 语义对齐），pre/exit 两态冒烟通过 |
| P1-3（play 巨石拆分） | 拆分 7,736 行 / 110 个 section 属多 PR 级重构，单次自动化实施回归风险不可控——**明确收缩范围** | ✅（收缩）修正 `use-table-demo-state.ts` 头注释与实现的漂移（provide/inject 从未发生）；结构拆分另立任务 |
| P1-4（R3 双预算） | **初判错误（实施中被门禁当场拦下）**：两套预算度量不同（raw gzip 75.4KB vs bundled-with-deps 233.2KB），并非漂移。尝试统一后 `pnpm size` 变红（233KB > 120KB），证实误诊并回滚 | ✅（修正为文档化）恢复各自预算（120/240/245/30），在 `check-bundle-size.mjs` 头注释写明两种口径的差异与改动前须知 |
| P1-5（CI 效率） | 属实（6 job 各自 install/build）。远程缓存需账号，artifact 传递重构面大——采取保守三步 | ✅ test job 合并为单次 `turbo run typecheck test`（依赖包只构建一次）；test/build job 增加 `.turbo/cache` 跨 run 缓存（`turbo config` 确认路径）；audit job 去掉 install（`pnpm audit` 只读 lockfile） |
| P1-6（shamefullyHoist） | 属实但范围收窄：`dev-packages/rolldown-config` 自身依赖声明完备，缺口仅三个业务包的 `rolldown` 二进制 | ✅ 三包 devDependencies 补 `rolldown: catalog:`，包级 `.bin/rolldown` 链接就位并构建验证 |
| P2-7（脚本清理） | R6/R7/release-docs 全部属实。R5（共享 lib）性价比低，**暂缓** | ✅ `release-version.ts` 删 plan.json 死代码；根 devDependencies 删未用的 `@changesets/changelog-github`；`verify-commit.ts` 补 `$` 锚定 + `chore(release):` 发版提交豁免（复核发现：不豁免会挡死机器发版提交，其 subject 天然超 50 字符）；`release-docs.ts` 远端可经 `DOCS_DEPLOY_REMOTE` 覆盖 + 无变更时跳过 commit |
| P2-8（vitest 白名单） | 属实且比初判更严重——browser 巨型排除清单实际只覆盖 1 个文件 | ✅ 重构为互补单源：unit = 全部排除 e2e，browser = 仅 e2e；新文件默认被执行，死测试类 bug 结构性消除；`vitest list` 前后 diff 验证语义等价（仅预期的 3 处搬移） |
| P2-9（benchmark 基线） | 属实（脚本自述免责，基线仅供趋势阅读） | ✅ `--save` 写 `scripts/benchmark-baseline.json`（随仓维护），默认运行打印与基线的漂移百分比 |
| P2-10（装配顺序 guard） | 属实（顺序是隐式契约，仅注释约束） | ✅ 新增 `__tests__/guards/assembly-order.guard.test.ts`：锁定 12 步装配顺序 + `@architecture` 文档块存在 |

---

## 8. 结语

这个仓库呈现出少见的「强治理」特征：几乎每一项架构决策都有 ADR、ownership 登记、guard 测试或 CI 门禁三重落地，注释里保留了完整的决策考古。六个维度中，**可约定性是标杆级的**，性能与耦合控制扎实，冗余治理有制度且存量干净。真正的短板高度集中：**复杂度存量**（42 个超限豁免、7 层编排）与**边缘地带的失控**（play 巨石文件、测试目录漂移、双预算口径、pre 模式门禁盲区）。前者是「企业级表格」领域的固有复杂度被诚实管理的结果，后者是可以在一个 PR 内修完的具体清单——本报告 §2.1 与 §7 即该清单。
