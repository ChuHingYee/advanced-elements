# Vue 3 组件注释与文档生成规范（`<zh/>` / `<en/>` 双语强制版）

**适用范围**：Vue 3 SFC（`.vue`）、Composable（`use*.ts` / `use*.js`）、公共类型（`types.ts`）、工具函数（`utils.ts`）、样式块（`<style>`）、模板（`<template>`）。
**规范定位**：单一事实来源 + Agent 行为约束 + 工程化可校验 + **`<zh/>` / `<en/>` 全量双语**。


## 0. 全局红线原则

🚫 **单一事实来源**：任何信息只在最适合被工具链（IDE / 文档生成器 / 类型检查器 / API 表格生成器）消费的位置声明一次。禁止为“看起来完整”而在多处重复同一信息。当代码本身已表达语义时（`withDefaults`、`defineSlots`、`defineModel`、文件名、类型签名），注释仅补充代码无法表达的上下文（Why、约束、副作用、异常路径）。

🚫 **全量注释强制 `<zh/>` / `<en/>` 双语**：**所有自然语言注释**必须同时包含 `<zh/>` 中文和 `<en/>` 英文，包括但不限于：

- JSDoc（`/** */`）描述、`@param`、`@returns`、`@throws`、`@remarks`、`@deprecated`、`@example` 说明；
- 内部逻辑 `//` 行内注释；
- 模板 `<!-- -->` 注释；
- 样式 `/* */`、`//` 注释；
- Hack 四要素；
- `@agent-mark` 标记后的内容；
- 文件头摘要、模块头 JSDoc。

**标记格式**：`<zh/>` 后写中文，`<en/>` 后写英文；两者必须成对出现，顺序固定为 **先 `<zh/>` 后 `<en/>`**。

**不翻译**：代码标识符、类型名、组件名、URL、版本号、工单号、JSDoc 标签名、`TODO:CONFIRM_*` 占位符、纯代码片段。

🚫 **双语不等于回声**：中英文都必须提供 Why / 约束 / 副作用 / 异常路径；禁止把同一句代码翻译两遍。双语注释仍受“禁止回声注释”约束。

🚫 **Agent 标记隔离**：任何 `@agent-mark`、`TODO`、`P0/P1`、`TASK-*` 等过程追踪标记，**绝对禁止**写入 JSDoc（`/** */`）或 HTML 文档注释（`<!-- -->`）中。此类标记仅允许以 `// @agent-mark <TYPE> <zh/> ... <en/> ...` 格式出现在**内部逻辑的行内注释**中。违反此规则的生成结果视为不合格输出。

🚫 **禁止回声注释**：注释不得仅是对下一行代码的自然语言翻译。若删除该注释后理解成本不变，则该注释不应存在。优先解释意图（Why）、前置条件、副作用或异常路径。

🚫 **禁止虚构引用**：`@see` 中的 URL 必须来自已知可信源（Vue 官方文档、Element Plus 官网、MDN、TC39、项目内部 Wiki）。`@since` 版本号必须从 `CHANGELOG.md`、组件元数据或发布记录读取；`package.json` 的当前版本不等于 API 首次引入版本，**禁止用它替代 @since**。无法确认时必须使用 `TODO:CONFIRM_SINCE` / `TODO:CONFIRM_REF` 占位符，严禁猜测填充。

🚫 **模板中禁止过程标记**：`<template>` 内无法使用 `//` 行内注释，因此**禁止**在模板中写 `<!-- @agent-mark -->` 或 `<!-- TODO -->`。所有 Agent 过程标记统一放在 `<script setup>` 内部逻辑行内注释中。


## 1. 组件文件头部摘要（可选）

仅在组件逻辑复杂、需要快速定位时使用简短的 HTML 注释摘要。**不要**在此处重复 `<script setup>` 中已有的详细 JSDoc。

```html
<!-- <zh/> SearchForm - 搜索表单 | @extends ElForm | @since 1.0.0
     <en/> SearchForm - Search Form | @extends ElForm | @since 1.0.0 -->
```

- 不超过 2 行（`<zh/>` 一行、`<en/>` 一行）。
- 组件名、中英文描述、关键标签用 `|` 或 `-` 分隔写在同一行。
- 详细的 `@description`、`@param`、`@remarks` 全部放在 `<script setup>` 的 JSDoc 中。
- 简单组件可完全省略此注释块。
- **禁止**在此处出现 `@agent-mark`、`TODO`、`P0/P1`、`TASK-*`。
- 摘要中的自然语言描述必须 `<zh/>` / `<en/>` 双语。


## 2. Props 注释规范

### 2.1 双语标记规则（全量强制）

- **所有注释**必须 `<zh/>` / `<en/>` 双语，包括 JSDoc 和内部行内注释。
- **顺序**：先 `<zh/>`，后 `<en/>`，不得颠倒。
- **短描述**：可写在同一行，格式为 `<zh/> 中文内容 <en/> English content`。
- **长描述**：`<zh/>` 和 `<en/>` 各占一行，便于阅读和对齐。
- **JSDoc 块内**：`<zh/>` / `<en/>` 位于 `*` 之后，不作为 JSDoc 标签（不是 `@zh`），而是描述内容的一部分。
- **不翻译**：代码标识符、类型名、URL、版本号、工单号、JSDoc 标签名。
- **禁止**只写 `<zh/>` 或只写 `<en/>`；缺失任一侧视为不合格输出。

### 2.2 @default 精简规则

使用 `withDefaults()` 时，简单值的默认值已由代码表达，**省略 `@default`**。仅在复杂值或需解释语义时保留。

```ts
const props = withDefaults(defineProps<SearchFormProps>(), {
  mode: 'local',        // <zh/> 简单值，默认值由代码表达 <en/> Simple value; default expressed by code
  showReset: true,      // <zh/> 简单值，默认值由代码表达 <en/> Simple value; default expressed by code
  items: () => [],      // <zh/> 工厂函数，JSDoc 保留 @default 说明结构 <en/> Factory; keep @default in JSDoc
})
```

**@default 判定表**：

| 默认值形式 | 是否保留 @default |
|---|---|
| 字符串 / 数字 / 布尔字面量 | 省略 |
| `null` / `undefined` | 省略 |
| 数组 / 对象工厂函数 | **保留**，说明结构或语义 |
| 函数引用 | **保留**，说明用途 |
| 计算表达式（非字面量） | **保留** |

### 2.3 Props JSDoc 示例

```ts
interface SearchFormProps {
  /**
   * <zh/> 搜索模式
   * <en/> Search mode
   * @remarks <zh/> 未来版本计划支持 fuzzy 模式 <en/> Planned to support fuzzy mode in future versions
   */
  mode?: 'local' | 'remote'

  /**
   * <zh/> 表单项配置数组
   * <en/> Form item configuration array
   * @default [] <zh/> 空数组表示不渲染任何表单项 <en/> Empty array renders no form items
   */
  items?: FormItemConfig[]
}
```

**长描述分行示例**：

```ts
/**
 * <zh/> 表单底部操作区
 * <en/> Form footer actions
 * @remarks
 * <zh/> 当 `items` 为空时仍会渲染该插槽，方便调用方放置自定义操作。
 * <en/> This slot is still rendered when `items` is empty, allowing callers to place custom actions.
 */
```

### 2.4 Props validator 注释

使用自定义 `validator` 时，注释必须说明：**校验语义、边界值、为什么内置类型/枚举不够用**，并保持 `<zh/>` / `<en/>` 双语。

```ts
/**
 * <zh/> 列数
 * <en/> Column count
 * @remarks
 * <zh/> 仅允许 1–6 的整数，超出范围布局会降级为单列。
 * <en/> Only integers 1–6 allowed; out-of-range values fall back to single column.
 */
columns?: number
```


## 3. Emits 注释规范

**全面使用对象字面量风格**，与 Props 保持一致。禁止旧式函数重载签名。

```ts
// ✅ 推荐（Vue 3.3+）
interface SearchFormEmits {
  /**
   * <zh/> 更新表单数据
   * <en/> Update form data
   */
  'update:modelValue': [value: Record<string, any>]

  /**
   * <zh/> 触发搜索
   * <en/> Trigger search
   */
  'search': [params: Record<string, any>]
}

// ❌ 禁止
interface SearchFormEmits {
  (e: 'update:modelValue', value: Record<string, any>): void
}
```

**版本兼容说明**：对象字面量 `defineEmits<{ event: [args] }>()` 依赖 **Vue 3.3+**。若项目最低版本低于 3.3，必须在规范落地时明确替代写法（旧式调用签名）或提高项目版本约束。同一项目内**不允许两种风格混用**。

**validator 注释**：事件参数校验失败时的行为、边界值、为什么需要自定义校验，必须用 `@remarks` 说明，且 `<zh/>` / `<en/>` 双语。


## 4. Slots 注释规范

以 `defineSlots()` 为**唯一事实来源**。仅在插槽有复杂的默认内容渲染逻辑时，才在模板中补充简短行内注释。

```ts
defineSlots<{
  /**
   * <zh/> 表单底部操作区
   * <en/> Form footer actions
   * @binding loading - <zh/> 搜索按钮加载状态 <en/> Search button loading state
   */
  footer: (props: { loading: boolean; onSearch: () => void }) => any
}>()
```

```html
<slot name="footer" :loading="searchLoading">
  <!-- <zh/> 默认显示搜索+重置按钮组合 <en/> Default: search + reset button group -->
  <el-button @click="handleSearch"><zh/>搜索<en/>Search</el-button>
</slot>
```

**边界**：模板 fallback 中的注释仅在“默认内容有非显然的分支/组合逻辑”时保留。若 fallback 只是单个按钮或单个文本节点，**禁止**加注释；一旦加注释，必须 `<zh/>` / `<en/>` 双语。

> 注意：模板内可见文案不属于注释，不强制 `<zh/>` / `<en/>`；若项目使用 i18n，按 i18n 方案处理。注释才受本规范约束。


## 5. Expose 与命令式 API 注释规范

### 5.1 唯一事实来源

`defineExpose()` 是组件**命令式 API 的唯一事实来源**。父组件通过模板 ref 调用处**不重复描述** Expose 方法的语义、参数、返回值；调用处仅可标注“业务上下文”或“为什么调用”，不得复制 JSDoc。

### 5.2 强制 JSDoc 要求

`defineExpose()` 暴露的**每一个方法 / 属性**必须有 JSDoc，包含：

- `<zh/>` / `<en/>` 双语描述；
- `@param`（如有参数，描述双语）；
- `@returns`（如有返回值，描述双语）；
- `@throws`（如有抛出异常，描述双语）；
- `@remarks`：副作用、调用前置条件、是否幂等、是否需要等待 `nextTick`、是否应在组件挂载后调用，双语。

**文档生成器标识**：若项目使用 dumi / vue-styleguidist 等 API 表格生成器，Expose 成员需按工具要求标注 `@exposed` / `@expose` 标识，确保被文档工具采集。

```ts
defineExpose({
  /**
   * <zh/> 打开弹窗
   * <en/> Open dialog
   * @param options <zh/> 打开配置 <en/> Open options
   * @param options.reset <zh/> 是否重置表单 <en/> Whether to reset form
   * @returns <zh/> 无返回值 <en/> No return value
   * @remarks
   * <zh/> 必须在组件挂载后调用；内部会触发 `open` 事件。
   * <en/> Must be called after mount; triggers `open` emit internally.
   */
  open(options?: { reset?: boolean }): void {
    // <zh/> 延迟到下一帧，避免父组件 ref 未就绪 <en/> Defer to next tick to avoid parent ref not ready
  },

  /**
   * <zh/> 当前是否处于加载态
   * <en/> Whether currently loading
   * @remarks <zh/> 只读；不要直接修改 <en/> Read-only; do not mutate directly
   */
  get loading() {
    return internalLoading.value
  },
})
```

### 5.3 边界

- **仅暴露父组件确实需要调用的方法和属性**；内部实现细节不应 Expose。
- 模板 ref 获取子组件实例时，优先使用 `useTemplateRef`（Vue 3.5+）；低版本可用 `ref` + 同名模板 ref。
- Expose 的方法若同时是 Emits 的触发源，JSDoc 中应说明“会触发哪个 emit”，但**不在两处重复参数签名**。


## 6. defineModel / v-model / modifiers 注释规范

### 6.1 唯一事实来源与同步边界

`defineModel()` 是 `v-model` 绑定 Prop 及其 `update:*` 事件的**唯一事实来源**。

- **禁止**在 Props 接口或 Emits 接口中重复声明由 `defineModel()` 自动生成的 prop / event。
- 若同一组件混用 `defineModel()` 与手动 `defineProps` / `defineEmits`，必须用注释明确“哪些由 defineModel 管理，哪些手动管理”，防止重复声明和类型漂移。该说明注释必须 `<zh/>` / `<en/>` 双语。

### 6.2 JSDoc 要求

`defineModel()` 的返回值声明处必须有 JSDoc，至少包含：

- 双向绑定值的语义 / 单位 / 格式；
- `@remarks` 修饰符行为（`trim` / `number` / 自定义）；
- 默认值语义（复杂类型使用工厂函数时，说明结构）；
- 是否 `local` 模式（`defineModel({ local: true })`）及其影响。

```ts
/**
 * <zh/> 搜索关键词
 * <en/> Search keyword
 * @remarks
 * <zh/> 支持 `v-model.trim`；组件内部不自动 trim，修饰符通过 modelModifiers 传入。
 * <en/> Supports `v-model.trim`; modifiers are passed via modelModifiers, not auto-applied.
 */
const keyword = defineModel<string>({ default: '' })
```

### 6.3 modifiers 注释

使用 `[model, modifiers] = defineModel()` 时，注释必须列出**实际支持的修饰符**及**未支持修饰符的处理方式**（忽略 / 警告 / 抛错），双语。

```ts
const [title, titleModifiers] = defineModel<string, 'trim' | 'capitalize'>()
```

```ts
/**
 * @remarks
 * <zh/> 仅支持 `trim` 和 `capitalize`；其他修饰符被忽略。
 * <en/> Only `trim` and `capitalize` supported; others ignored.
 */
```

### 6.4 多 v-model 与命名规则

多个 `v-model` 时，修饰符 prop 名遵循 `xxxModifiers` 规则（如 `v-model:foo.trim` → `fooModifiers`），注释中不得写成笼统的 `modelModifiers`。每个 model 的 JSDoc 独立描述其修饰符支持集，双语。

### 6.5 transformers

使用 `get` / `set` transformers 时，`@remarks` 必须说明转换方向、幂等性和副作用，双语。


## 7. 模板与样式注释规范

### 7.1 模板注释（`<template>`）

**语法**：

- 短注释：`<!-- <zh/> 中文 <en/> English -->`
- 长注释：

```html
<!--
  <zh/> 中文说明
  <en/> English description
-->
```

**仅允许**在以下场景添加注释：

- 复杂条件渲染（多个 `v-if` / `v-else-if` / `v-else` 分支的业务含义）；
- 插槽 fallback 的非显然组合逻辑；
- `Teleport` 的 `to` 目标约束 / SSR 注意事项；
- `Suspense` 的 fallback 策略 / 错误边界行为；
- `KeepAlive` 的 `include` / `exclude` / `max` 设计意图；
- 可访问性（`aria-*`、`role`、键盘导航）的特殊处理；
- Hack / Workaround（必须四要素，见第 14 章）。

**禁止**：

- 对 `v-if`、`v-for`、简单赋值、标准插槽、普通元素添加回声注释；
- 在模板中写 `<!-- TODO -->`、`<!-- FIXME -->`、`<!-- @agent-mark -->`；
- 对显而易见的结构（`<div class="wrapper">`）加注释；
- 只写 `<zh/>` 或只写 `<en/>` 的模板注释。

**SSR / Hydration 特别注意**：Vue SSR 对注释节点的处理在单行与多行注释上可能存在不一致，**模板注释可能引发 hydration mismatch**。SSR 组件中的模板注释必须评估是否会被服务端渲染输出；若不确定，应移除注释或使用 `<ClientOnly>` 包裹。该评估结论若写入注释，必须 `<zh/>` / `<en/>` 双语。

### 7.2 样式注释（`<style>`）

**语法**：

- 纯 CSS / PostCSS：`/* <zh/> 中文 <en/> English */`，CSS 不支持 `//`；
- SCSS / Less / Stylus：`// <zh/> 中文 <en/> English` 和 `/* <zh/> 中文 <en/> English */` 均可，由预处理器编译；
- 长注释使用多行：

```scss
/**
 * <zh/> 中文说明
 * <en/> English description
 */
```

- Stylelint 校验时，`scss` 解析器需正确配置以识别 `//`。

**仅允许**在以下场景添加注释：

- 主题 token / CSS 变量的语义映射（为什么用这个 token）；
- `:deep()` 穿透的原因（覆盖哪个第三方组件、依赖其内部结构）；
- 浏览器兼容 Hack（必须四要素）；
- `scoped` 无法隔离而需要全局样式的理由；
- BEM / CSS Modules 命名中不显然的结构意图。

**禁止**：

- 对 `.class { color: red; }` 这类自解释规则加注释；
- 空注释 `/* */`、`//`（Stylelint `comment-no-empty` 会报错）；
- 在样式块中写过程标记；
- 只写 `<zh/>` 或只写 `<en/>` 的样式注释。

**推荐 Stylelint 规则**（启用注释相关校验）：

- `comment-no-empty`
- `comment-whitespace-inside`
- `scss/double-slash-comment-whitespace-inside`（SCSS 项目）
- `comment-pattern`（可选，用于强制 Hack 注释格式与 `<zh/>` / `<en/>` 标记）


## 8. Composable、公共类型与工具函数注释规范

### 8.1 适用范围

本章覆盖：

- `useXxx.ts` / `useXxx.js`（Composable）；
- `types.ts` / `*.d.ts`（公共类型）；
- `utils.ts` / `helpers.ts`（工具函数）；
- `constants.ts`（公共常量）。

这些文件与 `.vue` 组件同样受“单一事实来源”“禁止回声”“Agent 标记隔离”“**`<zh/>` / `<en/>` 全量双语**”红线约束。

### 8.2 文件头摘要

公共模块文件**必须**有文件头 JSDoc（不是 HTML 注释），说明模块职责、导出范围、使用约束，双语。

```ts
/**
 * <zh/> 搜索表单相关 Composable
 * <en/> Search form composables
 * @module useSearchForm
 * @remarks
 * <zh/> 所有导出均为 public API，修改需同步更新 CHANGELOG。
 * <en/> All exports are public API; update CHANGELOG on change.
 */
```

### 8.3 Composable JSDoc 要求

每个**公开导出**的 Composable 必须有：

- `<zh/>` / `<en/>` 双语描述；
- `@param`（含可选参数 `[name=default]`，描述双语）；
- `@returns`（复杂返回对象使用 `@typedef`，描述双语）；
- `@remarks`：副作用、清理责任、SSR 安全性、是否依赖组件上下文（`getCurrentInstance`），双语。

**纯 JS 项目**：用 `@typedef` 定义返回类型，`@type` 标注响应式变量，`eslint-plugin-jsdoc` 校验覆盖率；所有描述双语。

```ts
/**
 * @typedef {Object} UseToggleReturn
 * @property {import('vue').Ref<boolean>} value - <zh/> 当前状态 <en/> Current state
 * @property {() => void} toggle - <zh/> 切换状态 <en/> Toggle state
 */

/**
 * <zh/> 布尔状态切换
 * <en/> Boolean toggle
 * @param {boolean} [initialValue=false] - <zh/> 初始值 <en/> Initial value
 * @returns {UseToggleReturn}
 * @remarks
 * <zh/> 纯客户端 Composable，无副作用；无需清理。
 * <en/> Client-only; no side effects; no cleanup required.
 */
export function useToggle(initialValue = false) {
  // <zh/> 使用 ref 保持跨组件实例独立 <en/> Use ref to keep state independent across instances
  const value = ref(initialValue)
  // ...
}
```

### 8.4 清理责任注释

含副作用（定时器、事件监听、`ResizeObserver` / `IntersectionObserver`、请求、`watch`、`provide` / `inject`）的 Composable，`@remarks` 必须写明：

- 谁负责清理；
- 是否在 `onScopeDispose` / `onUnmounted` 中自动清理；
- 若在组件外使用，调用方需要做什么。

以上内容必须 `<zh/>` / `<en/>` 双语。

### 8.5 公共类型与工具函数

- 导出的 `interface` / `type`：必须有 JSDoc，说明用途和字段语义；复杂字段逐字段注释；全部 `<zh/>` / `<en/>` 双语。
- 导出的函数：`@param` + `@returns` + `@throws`；纯计算函数可省略 `@remarks`；描述双语。
- `@internal` / `@public` 稳定性标记见第 10 章；标记后的说明双语。
- 工具函数若为泛型，`@typeParam` 说明约束，双语。


## 9. provide / inject 与特殊组件注释规范

### 9.1 provide / inject

`provide()` 和 `inject()` 必须成对注释。**推荐使用 InjectionKey**，并在 key 定义处写唯一 JSDoc，双语。

```ts
/**
 * <zh/> 搜索表单上下文
 * <en/> Search form context
 * @remarks
 * <zh/> 必须由 SearchForm 祖先组件 provide；inject 时可能为 undefined。
 * <en/> Must be provided by a SearchForm ancestor; inject may return undefined.
 */
export const SearchFormContextKey: InjectionKey<SearchFormContext> = Symbol('SearchFormContext')
```

- `provide()` 处注释：提供什么、生命周期、是否响应式、变更是否通知后代，双语。
- `inject()` 处注释：缺失时的降级行为、是否允许在组件外调用、默认值语义，双语。
- **禁止**在 `provide` 和 `inject` 两处重复完整类型定义；类型以 `InjectionKey` 泛型为唯一事实来源。

### 9.2 异步组件 / Suspense / Teleport / KeepAlive

以下场景**必须**在注释中说明“为什么这样配置”，而非“做了什么”，且双语：

| 场景 | 必须注释的内容 |
|---|---|
| `defineAsyncComponent` | loading / error / delay / timeout 策略，重试行为，SSR 下的降级 |
| `<Suspense>` | fallback 选择理由，错误边界归属，是否影响父级 Suspense |
| `<Teleport>` | target 选择理由，SSR 下的目标存在性，样式隔离影响 |
| `<KeepAlive>` | `include` / `exclude` / `max` 的设计意图，缓存失效条件 |

### 9.3 SSR 约束

以下情况**必须**在注释中标注 `@remarks`，且 `<zh/>` / `<en/>` 双语：

- 访问 `window` / `document` / `localStorage` 而未做客户端守卫；
- 使用 `Teleport` 的目标在 SSR 时不存在；
- 模板注释可能被 SSR 输出并引发 hydration mismatch；
- 异步组件 / `Suspense` 在 SSR 下的 fallback 行为。


## 10. 废弃、实验性、内部 API 标记规范

### 10.1 稳定性标记

对外可见的导出（Props / Emits / Expose / Slots / Composable / 公共类型 / 工具函数）必须声明稳定性：

| 标记 | 含义 | 必填附加信息 |
|---|---|---|
| `@public` | 公开稳定 API | 无 |
| `@beta` | 公开但可能变更 | 变更风险说明（双语） |
| `@alpha` / `@experimental` | 实验性，随时可能移除 | 稳定性承诺、反馈渠道（双语） |
| `@internal` | 内部 API，不对外承诺 | 为什么导出、谁在使用（双语） |

**规则**：`public.ts` 中的每个导出都必须有稳定性标记。`@internal` 标记的注释块可配合 `eslint-plugin-jsdoc` 的 `allow-tags: ['private', 'internal']` 放宽部分规则。

### 10.2 @deprecated

`@deprecated` **必须包含**：

1. 废弃原因（双语）；
2. 替代 API（如果存在，标识符不翻译）；
3. **目标移除版本**（不允许只写“以后移除”）；
4. 迁移说明或 `@see` 链接。

```ts
/**
 * <zh/> 旧版搜索方法
 * <en/> Legacy search method
 * @deprecated
 * <zh/> 使用 `submit()` 替代；将在 2.0.0 移除。
 * <en/> Use `submit()` instead; will be removed in 2.0.0.
 * @see submit
 */
legacySearch(): void
```

### 10.3 与过程标记的隔离

`@deprecated`、`@experimental`、`@internal`、`@public` 是**文档标记**，可以出现在 JSDoc 中。
`@agent-mark TODO`、`@agent-mark P0`、`TASK-*` 是**过程标记**，**禁止**出现在 JSDoc 中。两者不得混淆。


## 11. Agent 过程标记规范

### 11.1 统一格式

所有 Agent 过程标记必须使用固定前缀，**标记后的自然语言内容必须 `<zh/>` / `<en/>` 双语**：

```text
// @agent-mark <TYPE> <zh/> 中文内容 <en/> English content
```

| TYPE | 含义 | 示例 |
|---|---|---|
| `TODO` | 待完成的功能或修复 | `// @agent-mark TODO <zh/> 补充远程搜索防抖逻辑 <en/> Add debounce for remote search` |
| `P0` | 阻塞发布的紧急问题 | `// @agent-mark P0 <zh/> SSR 下 window 引用未处理 <en/> Unhandled window reference under SSR` |
| `P1` | 高优先级优化项 | `// @agent-mark P1 <zh/> 大数据量虚拟滚动性能待验证 <en/> Virtual scroll performance with large data pending verification` |
| `TASK` | 关联任务工单编号 | `// @agent-mark TASK FE-2847 <zh/> 对齐设计稿间距 <en/> Align spacing with design spec` |
| `REVIEW` | 需人工重点审查的点 | `// @agent-mark REVIEW <zh/> 此处 hack 依赖 ElSelect 内部结构 <en/> This hack depends on ElSelect internal structure` |
| `DECISION` | Agent 设计决策记录 | `// @agent-mark DECISION <zh/> 改用显式 watch 避免循环 <en/> Switched to explicit watch to avoid loop` |

**长内容**允许分行：

```ts
// @agent-mark REVIEW
// <zh/> 此处 hack 依赖 ElSelect 内部结构，升级前需回归测试。
// <en/> This hack depends on ElSelect internal structure; regression test required before upgrade.
```

### 11.2 位置约束

- ✅ **仅允许**出现在组件内部逻辑 / 私有辅助方法的 `//` 行内注释中。
- ❌ **严禁**出现在 Props / Emits / Slots / Expose / `defineModel` 的 JSDoc 中。
- ❌ **严禁**出现在组件文件顶部 HTML 摘要注释中。
- ❌ **严禁**出现在 `<template>` 的 `<!-- -->` 或 `<style>` 注释中。

### 11.3 生命周期与清理约束

每个 `@agent-mark` 必须可被自动化追踪和清理：

| 约束 | 要求 |
|---|---|
| **正则** | `//\s*@agent-mark\s+(TODO\|P0\|P1\|TASK\|REVIEW\|DECISION)\s+<zh/>\s*.+<en/>\s*.+` |
| **双语** | TYPE 后必须同时出现 `<zh/>` 和 `<en/>`，顺序固定 |
| **TASK 关联** | `TASK` 类型必须包含工单号（如 `FE-2847`）；无工单号的 `TODO` 应至少包含 owner 或截止日期 |
| **清理条件** | 问题修复后，标记必须**在同一 PR 中删除或更新**，不得遗留 |
| **过期检测** | CI 或定期任务扫描超过 N 天（建议 30 天）未变更的 `@agent-mark`，输出报告 |
| **禁止空泛** | `// @agent-mark TODO <zh/> 优化 <en/> Optimize` 不合格；必须写明触发条件、影响范围、预期目标 |

### 11.4 `TODO:CONFIRM_*` 占位符

用于无法确认的 `@since`、`@see`、外部 API 引用：

```text
TODO:CONFIRM_SINCE
TODO:CONFIRM_REF
TODO:CONFIRM_API
```

- 出现在 JSDoc 中是**允许且鼓励**的（因为它是“待确认事实”，不是过程追踪标记）。
- **占位符本身不强制双语**；其前后的说明文字仍需 `<zh/>` / `<en/>` 双语。
- CI 应扫描 `TODO:CONFIRM_*` 并报告数量，但**不阻断**构建；团队按迭代清理。


## 12. 注释密度自适应

| 代码复杂度 | 注释密度 | Agent 行为要求 |
|---|---|---|
| 纯透传 / 简单包装 | 极低 | 仅文件摘要（可选）+ Props 接口级 JSDoc，内部零注释；一旦有注释必须 `<zh/>` / `<en/>` 双语 |
| 常规业务组件 | 中等 | 对外 API 完整 JSDoc，内部仅非显然逻辑有注释；全部 `<zh/>` / `<en/>` 双语 |
| 复杂状态机 / 算法 | 高 | 对外 API + 内部关键决策点 + 状态流转图注释；全部 `<zh/>` / `<en/>` 双语 |
| Hack / Workaround | 极高 | 必须包含四要素：根因、影响范围、移除条件、上游 Issue 链接；每条 `<zh/>` / `<en/>` 双语 |

**禁止**对 `v-if`、`v-for`、简单赋值、标准生命周期钩子添加注释。

**冲突处理**：当“简单透传组件内部零注释”与“Hack 四要素”冲突时，**Hack 四要素优先**。Hack 无论组件多简单，都必须完整注释，且双语。


## 13. 原子性变更约束

Agent 修改任何对外 API（Props / Emits / Slots / Expose / `defineModel`）时，必须在**同一次输出**中同步更新以下所有位置：

1. TypeScript 接口定义 / `defineModel` 类型参数；
2. `withDefaults()` 默认值；
3. `defineSlots()` / `defineExpose()` / `defineModel()` 声明；
4. 对应的 JSDoc 注释（含 `<zh/>` / `<en/>` 双语）；
5. 关联的 `@remarks` 中的联动说明（含 `<zh/>` / `<en/>` 双语）；
6. 若该 API 涉及公共 Composable / 类型，同步更新对应文件。

若某处无法确定如何同步更新，应添加：

```ts
// @agent-mark REVIEW <zh/> 与代码一致性待验证 <en/> Code consistency pending verification
```

而非跳过。**禁止**在 JSDoc 中写 `TODO` 来标记同步待办。


## 14. Hack / Workaround 四要素

任何 Hack 注释必须包含以下四要素，**每条均需 `<zh/>` / `<en/>` 双语**：

1. **根因** / Root cause：为什么不能按标准方式实现；
2. **影响范围** / Impact scope：哪些组件 / 场景 / 版本受影响；
3. **移除条件** / Removal condition：上游修复到什么程度可以移除；
4. **追踪链接** / Tracking link：Issue / PR / 上游链接。

```ts
// @agent-mark REVIEW
// <zh/> ElSelect 2.7 内部结构 hack
// <en/> ElSelect 2.7 internal structure hack
//
// Hack 四要素 / Hack four elements:
// 1. <zh/> 根因：ElSelect 未暴露 dropdownVisible 控制，需直接操作内部 ref。
//    <en/> Root cause: ElSelect does not expose dropdownVisible control; must operate internal ref directly.
// 2. <zh/> 影响：仅影响 SearchForm 的远程搜索场景。
//    <en/> Impact: only affects SearchForm remote search scenario.
// 3. <zh/> 移除条件：ElSelect >= 2.8 暴露 visible 受控 prop。
//    <en/> Removal: ElSelect >= 2.8 exposes controlled visible prop.
// 4. <zh/> 追踪：https://github.com/element-plus/element-plus/issues/XXXX
//    <en/> Tracking: https://github.com/element-plus/element-plus/issues/XXXX
```

> 说明：URL、版本号、组件名、工单号不翻译；自然语言描述必须 `<zh/>` / `<en/>` 双语。


## 15. 工程化校验与 CI 门禁

### 15.1 ESLint 必备规则

| 规则 | 作用 |
|---|---|
| `vue/require-prop-comment`（`type: "JSDoc"`） | 强制每个 prop 有 JSDoc 注释 |
| `jsdoc/require-jsdoc` | 导出的函数 / 类型 / Composable 必须有 JSDoc |
| `jsdoc/require-param` | 有参数的公开函数必须有 `@param` |
| `jsdoc/require-returns` | 有返回值的公开函数必须有 `@returns` |
| `jsdoc/check-tag-names` | 防止拼写错误或非法标签；`<zh/>` / `<en/>` 不是 JSDoc 标签，不受此规则影响 |
| `jsdoc/no-undefined-types` | 防止引用不存在的类型 |
| `jsdoc/require-description` | 防止空泛注释 |
| **自定义双语校验** | 检查注释是否同时包含 `<zh/>` 和 `<en/>`，且顺序正确 |

**推荐配置片段**：

```json
{
  "rules": {
    "vue/require-prop-comment": ["error", { "type": "JSDoc" }],
    "jsdoc/require-jsdoc": ["warn", {
      "publicOnly": true,
      "require": { "FunctionDeclaration": true, "MethodDefinition": true }
    }],
    "jsdoc/require-param": "warn",
    "jsdoc/require-returns": "warn"
  }
}
```

> `<zh/>` / `<en/>` 是描述内容标记，不是 `@` 标签，因此不会被 `jsdoc/check-tag-names` 当作非法标签。双语校验通常需自定义 ESLint 规则或 CI Node 脚本扫描所有注释块。

### 15.2 Stylelint 必备规则

- `comment-no-empty`
- `comment-whitespace-inside`
- `scss/double-slash-comment-whitespace-inside`（SCSS）
- `comment-pattern`（可选，用于强制 Hack 注释格式与 `<zh/>` / `<en/>` 标记）

### 15.3 CI 门禁

| 检查项 | 阻断级别 | 说明 |
|---|---|---|
| JSDoc 中禁止出现 `@agent-mark` / `TODO` / `P0/P1` / `TASK-*` | **Error** | 正则扫描 `/** */` 和 `<!-- -->` |
| 模板 / 样式注释中禁止出现过程标记 | **Error** | 正则扫描 |
| **所有注释缺失 `<zh/>` / `<en/>` 双语** | **Error** | 自定义脚本扫描 JSDoc、行内、模板、样式注释；检查成对出现且顺序正确 |
| **`<zh/>` 或 `<en/>` 单独出现** | **Error** | 自定义脚本检查成对性 |
| `@deprecated` 缺少移除版本 | **Error** | 自定义 ESLint 规则或脚本 |
| `@since` 使用 `package.json` 版本而非发布记录 | **Error** | 人工审查 + 脚本提示 |
| `@agent-mark` 内容缺少 `<zh/>` / `<en/>` | **Error** | 正则检查 TYPE 后是否同时含 `<zh/>` 与 `<en/>` |
| `@agent-mark` 过期未清理（> 30 天） | Warning | 定期任务输出报告 |
| `TODO:CONFIRM_*` 数量 | Info / Warning | 迭代清理指标 |
| 豁免文件未登记 | **Error** | 见第 16 章 |

### 15.4 正则参考

```text
# 过程标记（应仅出现在 // 行内注释，且内容 <zh/>/<en/> 双语）
//\s*@agent-mark\s+(TODO|P0|P1|TASK|REVIEW|DECISION)\s+<zh/>\s*.+<en/>\s*.+

# JSDoc 中的过程标记（禁止）
/\*\*[\s\S]*?@agent-mark[\s\S]*?\*/

# HTML 注释中的过程标记（禁止）
<!--[\s\S]*?@agent-mark[\s\S]*?-->

# 空泛 TODO（禁止）
@agent-mark\s+TODO\s+<zh/>\s*(优化|完善|处理|fix)\s*<en/>\s*(Optimize|Improve|Handle|Fix)$

# @deprecated 缺少移除版本（提示）
@deprecated(?![\s\S]*?\d+\.\d+\.\d+)

# 双语成对检测（CI 脚本用）
<zh/>[\s\S]*?<en/>

# 顺序错误检测：<en/> 出现在 <zh/> 之前
<en/>[\s\S]*?<zh/>

# 单侧缺失启发式检测：存在注释块但只有 <zh/> 或只有 <en/>
(?=.*<zh/>)(?!.*<en/>)
(?=.*<en/>)(?!.*<zh/>)
```

> 双语检测会有边界情况（URL、代码片段、专有名词），建议脚本只对**自然语言注释行**做启发式检查，并允许行级豁免登记。


## 16. 豁免与例外审批机制

以下场景可申请豁免，但**必须显式登记**，不得静默绕过：

| 场景 | 豁免方式 |
|---|---|
| 自动生成文件（`*.gen.ts`、API 类型文件） | 文件头加 `// @generated`，ESLint 忽略整文件 |
| 第三方复制代码 | 文件头加 `// @vendor-copied`，注释块保留原始来源；不强制团队规范 |
| 紧急 hotfix | PR 描述中登记；添加 `// @agent-mark P0 <zh/> ... <en/> ...` 并关联发布版本；**下一个迭代必须补齐** |
| 实验性原型 / Spike 分支 | 分支级别豁免；合入 main 前必须补齐或删除 |
| 按项目约定确实不需要 JSDoc 的内部文件 | 在 ESLint overrides 中显式配置，禁止全局关闭 |
| 双语检测误报（URL / 代码片段 / 专有名词） | 允许行级豁免注释登记，禁止全局关闭双语规则 |
| 文档生成器不支持 `<zh/>` / `<en/>` | 在生成器配置中将其作为纯文本处理，或在 `@remarks` 中使用分行文本；不得因此关闭双语要求 |

**原则**：豁免是“可见的例外”，不是“默认关闭规则”。


## 17. 注释风格与格式统一

### 17.1 `<zh/>` / `<en/>` 标记格式（全局强制）

- **顺序**：先 `<zh/>`，后 `<en/>`，不得颠倒。
- **短描述同行**：`<zh/> 中文内容 <en/> English content`。
- **长描述分行**：`<zh/>` 一行、`<en/>` 一行，必要时英文缩进对齐。
- **JSDoc 中**：`<zh/>` / `<en/>` 是描述内容，不是 `@` 标签；写在 `*` 之后。
- **行内注释中**：`// <zh/> 中文 <en/> English`；长内容可分两行 `// <zh/> ...` + `// <en/> ...`。
- **模板注释中**：`<!-- <zh/> 中文 <en/> English -->`；长内容可多行。
- **样式注释中**：`/* <zh/> 中文 <en/> English */` 或 `// <zh/> 中文 <en/> English`。
- **Agent 标记中**：`// @agent-mark TODO <zh/> 中文 <en/> English`。
- **Hack 四要素中**：每条先 `<zh/>` 后 `<en/>`。
- **英文大小写**：句子式大写；专有名词保留原大小写（Vue、TypeScript、Element Plus）。
- **句末标点**：不强制；同一文件内保持一致。
- **术语表**：项目内维护统一术语（如“插槽 / slot”“事件 / emit”），禁止中英混用不一致。
- **不翻译**：代码标识符、类型名、组件名、URL、版本号、工单号、JSDoc 标签名、`TODO:CONFIRM_*`。
- **所有注释位置均适用**：JSDoc、`//` 行内、`<!-- -->`、`/* */`、Agent 标记内容、Hack 四要素。

### 17.2 文档生成器兼容性

`<zh/>` / `<en/>` 是内容标记，不是标准 JSDoc 标签。不同文档生成器处理方式不同：

| 工具 | 处理建议 |
|---|---|
| VitePress / VuePress | 原生支持类似 Markdown 容器/自定义标签；必要时配置 markdown-it 插件 |
| dumi | 在 `.dumirc` 中配置 `apiParser` 或自定义 remark 插件，将 `<zh/>` / `<en/>` 转为双语表格 |
| vue-styleguidist | 配置 `jsdoc` 解析器的 `tags` 或自定义 `propsParser`，避免 `<zh/>` 被过滤 |
| TypeDoc | 默认将 `<zh/>` 视为 HTML；建议配置 `commentStyle: 'jsdoc'` 并添加自定义标签映射 |
| JSDoc 默认 HTML | 未知 HTML 标签可能被转义或丢弃；建议用 `@remarks` 分行文本作为降级方案 |

**原则**：若工具链不支持 `<zh/>` / `<en/>`，应在生成器配置中将其作为纯文本处理，**不得因此放弃双语要求**。降级时可在 JSDoc 中改用：

```ts
/**
 * @remarks
 * [zh] 中文说明
 * [en] English description
 */
```

但**团队默认标准仍为 `<zh/>` / `<en/>`**，降级写法需在项目配置中显式声明。

### 17.3 JSDoc 标签顺序（建议）

```text
描述（<zh/> 一行、<en/> 一行）
@remarks（<zh/> / <en/>）
@param（描述 <zh/> / <en/>）
@returns（描述 <zh/> / <en/>）
@throws（描述 <zh/> / <en/>）
@example
@see
@since
@deprecated（描述 <zh/> / <en/>）
@public / @internal / @experimental
```

### 17.4 @example

仅对**复杂公开 API**（Composable、Expose 方法、工具函数）提供 `@example`。Props / Emits 的简单用法不强制 `@example`，避免注释膨胀。`@example` 内的说明文字 `<zh/>` / `<en/>` 双语；代码本身不翻译。

### 17.5 @throws

公开函数 / Expose 方法若会抛出异常，**必须**用 `@throws {ErrorType} <zh/> 中文说明 <en/> English description` 标注每个异常类型和触发条件；长说明分行。


## 18. 测试 / Story / 文档关联（按项目需要）

- 组件的测试文件、Storybook Story、文档示例路径**不强制**写入 JSDoc；若项目需要追踪，统一在组件文件头部 HTML 摘要中用 `@see` 关联，禁止在每个 Props 上重复写测试路径。
- `@see` 链接优先指向项目内部 Wiki / 组件文档页，其次是官方文档。禁止指向不可信的外部博客。
- 若在注释中说明测试/Story 关联，说明文字 `<zh/>` / `<en/>` 双语。


## 19. 性能与清理责任（Composable / 组件通用）

以下资源**必须**在注释中说明清理责任，且 `<zh/>` / `<en/>` 双语：

- `setInterval` / `setTimeout`
- `addEventListener` / `removeEventListener`
- `ResizeObserver` / `IntersectionObserver` / `MutationObserver`
- 未取消的异步请求
- `watch` / `watchEffect` 的停止
- `provide` / `inject` 的生命周期约束

注释重点不是“这里创建了 observer”，而是：**谁负责清理、在什么钩子中清理、如果调用方提前销毁会发生什么**。中文和英文都必须表达该信息。


## 20. 组件文件结构建议（与注释分工对应）

```text
<!-- <zh/> 文件头摘要（可选，≤ 2 行）
     <en/> File header summary (optional, ≤ 2 lines) -->

<script setup lang="ts">
  /**
   * <zh/> 模块级 JSDoc（Composable / 类型 / 工具函数）
   * <en/> Module-level JSDoc (Composable / types / utils)
   * 对外 API：Props / Emits / Slots / Expose / defineModel（<zh/> / <en/> 双语）
   */
  // <zh/> 内部逻辑行内注释（仅非显然逻辑） <en/> Internal inline comments (non-obvious logic only)
  // @agent-mark 过程标记仅允许出现在这里，内容必须 <zh/> / <en/> 双语
</script>

<template>
  <!-- <zh/> 仅复杂条件 / fallback / a11y / Hack <en/> Only complex conditions / fallback / a11y / Hack -->
</template>

<style scoped lang="scss">
  // <zh/> 仅主题 token / :deep 原因 / 兼容 Hack <en/> Only theme token / :deep reasons / compat Hack
</style>
```


## 21. Agent 注释自检清单（输出前必查）

每次生成或修改代码后，逐条核对：

- [ ] **所有自然语言注释均为 `<zh/>` / `<en/>` 双语**，顺序为 `<zh/>` 在前、`<en/>` 在后
- [ ] JSDoc 的 `@param` / `@returns` / `@throws` / `@remarks` / `@deprecated` 描述均为 `<zh/>` / `<en/>` 双语
- [ ] 内部 `//` 行内注释均为 `<zh/>` / `<en/>` 双语
- [ ] 模板 `<!-- -->` 注释均为 `<zh/>` / `<en/>` 双语
- [ ] 样式 `/* */` / `//` 注释均为 `<zh/>` / `<en/>` 双语
- [ ] `@agent-mark` 内容同时包含 `<zh/>` 和 `<en/>`，顺序正确
- [ ] Hack 四要素每条均为 `<zh/>` / `<en/>` 双语
- [ ] 不存在只有 `<zh/>` 没有 `<en/>`，或只有 `<en/>` 没有 `<zh/>` 的注释
- [ ] 所有 JSDoc / HTML 文档注释中**不含** `@agent-mark`、`TODO`、`P0/P1`、`TASK-*`
- [ ] 模板 `<!-- -->` 和样式注释中**不含**过程标记
- [ ] 无回声式注释（删除注释后理解成本不变 → 删除该注释）；双语不是逐行翻译
- [ ] `@see` 链接均来自可信源；不确定的使用 `TODO:CONFIRM_REF`
- [ ] `@since` 版本号已从 CHANGELOG / 组件元数据确认，未使用 `package.json` 当前版本替代
- [ ] 修改对外 API 时，接口 / 默认值 / 类型 / JSDoc / `@remarks` 已同步更新，且均 `<zh/>` / `<en/>` 双语
- [ ] 代码标识符、类型名、URL、版本号、工单号未被错误翻译
- [ ] `defineSlots` 是 Slots 的唯一事实来源
- [ ] `defineModel` 是 v-model Prop / 事件的唯一事实来源，未在 Props/Emits 中重复声明
- [ ] `defineExpose` 每个成员有 JSDoc（含 `@param` / `@returns` / `@throws` / `@remarks`，且 `<zh/>` / `<en/>` 双语）
- [ ] `@default` 仅在复杂值或需解释语义时出现，简单值已省略
- [ ] `@deprecated` 包含移除版本和替代方案，描述 `<zh/>` / `<en/>` 双语
- [ ] `@public` / `@internal` / `@experimental` 稳定性标记已用于公共导出，附加说明 `<zh/>` / `<en/>` 双语
- [ ] 模板注释已评估 SSR / hydration 影响
- [ ] 样式注释非空，且仅出现在主题、`:deep`、兼容 Hack、全局样式理由场景
- [ ] Composable 的副作用有清理责任说明，且 `<zh/>` / `<en/>` 双语
- [ ] 每个 `@agent-mark` 可被正则匹配，内容 `<zh/>` / `<en/>` 双语，且包含必要上下文（TASK 有工单号 / TODO 有范围与目标）
- [ ] 文档生成器对 `<zh/>` / `<en/>` 的兼容性已确认；若需降级写法，已在项目配置中显式声明
- [ ] 豁免文件已登记，未静默关闭规则