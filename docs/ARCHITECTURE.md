# AdvTable 架构地图（ARCHITECTURE.md）

> 目标读者：首次进入 `packages/table` 的贡献者。10 分钟建立全局心智模型，再按「阅读顺序」下钻。
> 本文是 `src/composables/use-adv-table.ts` 头部装配图的展开版；架构决策的完整论证见 `docs/adr/`，跨路径规则的唯一实现位置见 `docs/ownership-matrix.md`。

## 1. 一句话架构

AdvTable = **一个薄壳组件**（`AdvTable.vue`，全部委托编排器）+ **12 个域 composables 分层**（洋葱式装配）+ **双渲染引擎**（ElTable / ElTableV2 经统一 DOM 适配器接入）+ **20 个域注入键**（provide/inject 下发子树）。

## 2. 装配图（洋葱顺序即数据依赖，不可重排）

```
AdvTable.vue
  └─ useAdvTable()                     composables/use-adv-table.ts —— 唯一装配点
      1  useAdvTableCore               配置/i18n/错误/tableId/rowKeyFn
      2  useAdvTableDataColumns        列处理 + 数据管线 + 分页/树/分组/固定/展开
      3  useSelectionOrchestrator      选择（跨页/受控回写/树级联）
      4  useInteractionOrchestrator    键盘/拖拽/范围选择/错误边界
      5  useAdvTableSharedEditing      共享单例（tooltip/copy/popover）+ 编辑域
      6  useAdvTableFeatures           搜索/导出/侧边栏/上下文菜单
      7  useRendererIntegration        渲染器集成/事件绑定/上下文 provide
      8  createAndProvideContext       ← 此处统一 provide（20 键，见 §5）
      9  setupAdvTableWatchers         分页校正/modelUpdated/远端 refetch/mode 切换
      10 assembleAdvTableApi           实例 API（UseTableApiReturn，110 成员）
      11 setupAdvTableLifecycle        配置校验/挂载卸载
      12 buildAdvTableProjection       面向模板的窄投影（模板只读投影，不触内部）
```

顺序是**隐式契约**：Interaction 必须先于 SharedEditing（拖拽禁用探测靠后绑定 holder 避免循环依赖）；Features 在 SharedEditing 之后（导出守卫要 `hasUnsavedChanges`）。由 `__tests__/guards/assembly-order.guard.test.ts` 锁定，重排即红。

## 3. 域目录职责（src/composables/）

| 域 | 职责 | 域编排器 |
|---|---|---|
| `core/` | 配置合并、i18n、错误、行键、渲染器适配、各层装配片 | `use-adv-table-core.ts` 等 16 个装配文件 |
| `data/` | 请求/管线/分页/排序/筛选/树/分组/固定/展开/URL 状态 | （由 2 号位统一编排） |
| `columns/` | 列状态、分类、拖拽、列宽、列设置、分组 | `use-columns-orchestrator.ts` |
| `selection/` | 选择状态机、策略、批量、守卫 | `use-selection-orchestrator.ts` |
| `interaction/` | 行拖拽、键盘网格、范围选择、剪贴板、修饰键 | `use-interaction-orchestrator.ts` |
| `editing/` | 单元格编辑全链（kernel/session/buffer/commit×2/…） | `use-editing-orchestrator.ts` |
| `features/` | 搜索、导入导出、打印、上下文菜单、汇总、筛选面板 | 各 feature 独立 |
| `rendering/` | hover 层、行/单元格事件、span 策略、渲染错误边界 | — |
| `scrolling/` | 滚动定位（scrollToRow/Column） | — |
| `shared/` | 跨域单例：tooltip 三态、filter popover、安全注入 | `use-shared-singletons.ts` |
| `api/` / `view-model/` / `locale/` | 实例 API、行视图模型、语言包 | — |

支持层：`src/utils/`（**运行时叶子**，禁上行 import composables/components）、`src/types/`（编译期叶子，同上；`import type` 放行）、`src/components/`（UI 组件，允许消费 composables——39 个合法消费点是架构常态）、`src/constants/`、`src/locale/`。

## 4. 双渲染引擎

```
useAdvTable (编排层，渲染引擎无关)
   │  RendererCaps 能力表 + IRendererDomAdapter（唯一 DOM 出口）
   ├── TableRenderer.vue        → ElTable 路线（default-dom-adapter）
   └── TableVirtualRenderer.vue → ElTableV2 路线（virtual-dom-adapter，use-v2-* 系列）
   └── renderer-core/           共享层：column-vnode-factory / render-helpers / cell-render-content / 事件绑定
```

- hooks 永不持有 EP 类名字符串——一律走 `RendererContext.dom` 的方法；EP 升级只改两个 adapter 文件（`dom-adapter.ts` 头注释）。
- 新代码**查能力表**（`caps.canXxx`），不问「是不是虚拟模式」布尔量（ADR-003；`is-virtual-allowlist.guard.test.ts` 锁定）。

## 5. 上下文与注入（20 键）

- 所有 provide 在第 8 步 `createAndProvideContext` **单点**完成；消费侧一律 `useSafeInject`（缺 provide 静默降级 + devWarn，唯一例外 `polling-btn refresh` 直接抛错）。
- 键清单在 `src/types/injection-keys.ts`：改名/删键编译器不报错，靠 `injection-contract.test.ts` 锁定。
- 上帝上下文已删除（R2）：跨层只允许按域窄键传递；跨编排器参数用 `types/orchestrator-context.ts` 的四个窄接口（Row/Column/Renderer/CrossCutting）。

## 6. 一次数据流（远端分页场景）

```
props.request.source → use-table-request（请求/竞态代际守卫/轮询）
  → format-response 解析 → data pipeline（分类/筛选/排序[Worker 阈值]/span 缓存/汇总缓存）
    → visibleData → renderData（pin 剔除）→ 双渲染器之一
      └─ 事件（行/单元格/滚动）→ renderer-events 适配 → emit（table-emitter 统一带 tableId）
```

## 7. 阅读顺序（新人 30 分钟路线）

1. `composables/use-adv-table.ts`（396 行，看装配与 ISP 切片怎么下发）
2. `composables/core/use-adv-table-core.ts`（core 域样本）
3. 任选一个简单域：`selection/use-selection-state.ts` → `use-selection-orchestrator.ts`
4. `components/renderer-core/dom-adapter.ts`（理解双引擎解耦）
5. `types/injection-keys.ts`（20 键 = 跨层契约清单）
6. 回到本文 §2 对照装配顺序，跑一遍 `__tests__/guards/` 全绿即已入门

## 8. 改动指南速查

| 要改什么 | 动哪里 | 别动什么 |
|---|---|---|
| 新增 prop | `types/table-props.ts` → 消费域 composable → docs/components/table.md + changeset | 不要在组件模板直连 prop |
| 新增事件 | `types/table-emits.ts` + `__type-guards__/event-naming-manifest.ts`（guard 锁命名） | 不在编排器直接 emit，走 `table-emitter` |
| 新增注入 | 先答「是否拥有 state+lifecycle」（`injection-keys.ts` 头注释三问） | 不新增转发型键 |
| 新增单元格编辑器/筛选器/值类型 | `registerCellEditor` / `registerFilterType` / value-type 注册表 | 不改渲染器 |
| 改样式 | `src/style/*.scss`（样式契约：禁 SFC `<style>`，构建期断言）+ `_namespace-aliases.scss` 登记别名 | 不硬编码 `var(--el-*)` |
| 性能敏感路径 | 先看 `utils/raf.ts` / `debounce.ts` 分工（ownership-matrix D4） | 不手写 setTimeout/raf 三件套 |

## 9. 机器护栏索引（约定即测试）

| 护栏 | 锁定内容 |
|---|---|
| `__tests__/guards/assembly-order.guard.test.ts` | 12 步装配顺序 |
| `__tests__/guards/injection-contract.test.ts` | 20 注入键 |
| `__tests__/guards/type-completeness.test.ts` + `__type-guards__/api-contract.keys.ts` | 110 成员实例 API 双向对齐 |
| `__tests__/guards/ep-props/ep-selectors` | EP 升级影响的早期预警 |
| eslint 边界规则（根 `eslint.config.mjs`） | utils/types 运行时叶子；禁 axios/pinia/fetch/useStore |
| `scripts/check-hook-size.mjs` + `hook-size-ratchet.json` | 超 300 行 composables 只减不增（当前 52） |
| `docs/ownership-matrix.md` | 11 条跨路径规则唯一实现位置 |

## 10. 债务与路线

复杂度治理的基线、批次与验收口径见根目录 `COMPLEXITY-PLAN.md`（巨石拆分配方、API 面聚簇、play 拆分设计）。
