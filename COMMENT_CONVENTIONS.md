# Element Plus 二次封装组件库注释规范

---

## 1. 总览

| 维度 | 规范 |
|------|------|
| 主要注释类型 | `/** */` JSDoc — 组件 Props、Emits、Expose、工具函数、类型定义 |
| 次要注释类型 | `<!-- -->` HTML 注释 — 组件说明、Slots 说明 |
| 特殊指令 | `/* */` — ESLint 指令（`/* eslint-disable */`, `/* global */`） |
| 语言 | **双语**：先 `<zh/>` 中文，后 `<en/>` 英文 |
| 描述风格 | 属性/类型：名词短语；方法/事件：祈使句 |
| 组件内部逻辑 | 仅对非显而易见的逻辑、副作用、hack 添加 `//` 注释 |

---

## 2. 注释决策指南

### 2.1 必须写注释的场景

| 场景 | 说明 | 示例 |
|------|------|------|
| **Props 约束关系** | 多个 Props 之间存在联动、互斥、依赖关系 | 当 `mode='remote'` 时，必须传入 `remoteMethod` |
| **行为变更** | 修改或屏蔽了底层组件（如 Element Plus）的默认行为 | `type` 属性被固定为 `'text'`，不支持原生所有类型 |
| **透传说明** | 哪些 Props/Events/Slots 直接透传给底层组件 | 支持所有 ElInput 原生属性透传 |
| **副作用** | 组件挂载时的自动操作、全局事件绑定、数据请求 | 组件挂载时自动请求初始数据 |
| **事件触发时机** | 事件何时触发、触发条件 | 用户点击或按下回车键时触发 |
| **插槽作用域** | 插槽暴露的变量及其含义 | `{ row: 当前行数据, $index: 行索引 }` |
| **插槽优先级** | 多个插槽控制同一区域时的覆盖规则 | 具名插槽优先于 `columns` 配置中的 `render` 函数 |
| **异常状态处理** | 加载中、空数据、错误状态的展现方式 | 错误状态显示重试按钮 |
| **暴露方法** | 通过 `defineExpose` 暴露的方法用途 | `reset()` 重置表单并清除校验 |
| **弃用标记** | 即将废弃的 Props、方法、组件 | 使用 `@deprecated` 标记并说明替代方案 |

### 2.2 选择性写注释的场景

| 场景 | 说明 | 建议 |
|------|------|------|
| **使用建议** | 业务场景推荐或限制 | 建议不超过 100 条 |
| **非标准交互** | 与常规认知不一致的交互行为 | 双击才触发编辑模式 |
| **版本标记** | 新增功能、实验性功能 | 使用 `@since` `@experimental` |
| **性能说明** | 大数据量场景下的性能建议 | 超过 1000 条建议开启虚拟滚动 |

### 2.3 不写注释的场景

| 场景 | 说明 | 原因 |
|------|------|------|
| **纯透传属性** | 未修改行为的透传 Props | 应引导查看底层组件文档 |
| **简单模板逻辑** | `v-if`, `v-for`, `v-show` 等基础指令 | 代码自明 |
| **标准生命周期** | `onMounted` 等通用钩子中的常规操作 | 除非有特殊理由，否则不写 |
| **工具函数调用** | 调用已在 `@/utils` 中定义并有注释的函数 | 注释应在定义处 |
| **文件入口** | `index.ts` 仅做导出 | 不需要注释 |
| **测试代码** | `describe` `it` 测试用例 | 不需要 JSDoc |
| **私有内部方法** | 组件内部仅被自身调用的辅助方法 | 除非逻辑复杂需要说明 |

---

## 3. 组件注释规范

### 3.1 组件文件注释（.vue 文件顶部）

使用 HTML 注释块，包含组件名称、描述、分类等关键信息：

```vue
<!--
  @component SearchForm
  @displayName 搜索表单
  @displayName Search Form
  @description 基于 ElForm 封装的通用搜索表单组件，支持动态表单项配置和自动查询
  @description General search form component based on ElForm, supports dynamic form item configuration and auto query
  @category 数据录入 | Data Entry
  @extends ElForm
  @since 1.0.0
-->
<template>
  <!-- 模板内容 -->
</template>
```

**可用标签：**

| 标签 | 说明 | 必填 |
|------|------|------|
| `@component` | 组件名称（PascalCase） | 是 |
| `@displayName` | 组件中文名 / 英文名 | 是 |
| `@description` | 组件详细描述 | 是 |
| `@category` | 组件分类 | 推荐 |
| `@extends` | 继承的底层组件 | 选择 |
| `@since` | 引入版本 | 选择 |
| `@deprecated` | 废弃标记及替代组件 | 选择 |

---

## 4. Props 注释规范

### 4.1 基础格式

```typescript
/**
 * 搜索表单的配置项
 * Configuration for search form
 */
interface SearchFormProps {
  /**
   * 表单数据模型（支持 v-model）
   * Form data model (supports v-model)
   * @default {}
   */
  modelValue: Record<string, any>

  /**
   * 表单项配置数组
   * Form item configuration array
   * @default []
   */
  items?: FormItemConfig[]

  /**
   * 搜索模式
   * Search mode
   * - `'local'`: 本地过滤
   * - `'remote'`: 远程搜索
   *
   * - `'local'`: Local filtering
   * - `'remote'`: Remote search
   *
   * @default 'local'
   *
   * @remarks
   * <zh/> 当值为 `'remote'` 时，必须同时传入 `remoteMethod`
   * <en/> When set to `'remote'`, `remoteMethod` is required
   */
  mode?: 'local' | 'remote'

  /**
   * 远程搜索方法
   * Remote search method
   * @param keyword - <zh/> 搜索关键词 | <en/> search keyword
   * @returns <zh/> Promise 形式的搜索结果数组 | <en/> Promise of search result array
   */
  remoteMethod?: (keyword: string) => Promise<SearchResult[]>

  /**
   * 是否显示重置按钮
   * Whether to show the reset button
   * @default true
   */
  showReset?: boolean
}
```

### 4.2 Props 注释要点

- **v-model 属性**：说明支持 `v-model`
- **枚举值**：中英文分别列出，参考 2.4 节
- **关联关系**：使用 `@remarks` 说明 Props 之间的依赖或互斥关系
- **默认值**：使用 `@default` 标记
- **透传说明**：如果该 Props 会透传给底层组件，需要说明

---

## 5. Emits 注释规范

### 5.1 基础格式

```typescript
/**
 * 搜索表单的触发事件
 * Events emitted by search form
 */
interface SearchFormEmits {
  /**
   * 更新 v-model 值
   * Update v-model value
   * @param value - <zh/> 新的表单数据 | <en/> new form data
   */
  (e: 'update:modelValue', value: Record<string, any>): void

  /**
   * 搜索事件
   * Search event
   * @param params - <zh/> 搜索参数 | <en/> search parameters
   * @remarks
   * <zh/> 用户点击搜索按钮或按下回车键时触发
   * <en/> Triggered when the search button is clicked or Enter key is pressed
   */
  (e: 'search', params: Record<string, any>): void

  /**
   * 重置事件
   * Reset event
   * @remarks
   * <zh/> 用户点击重置按钮时触发，所有表单项恢复为默认值
   * <en/> Triggered when reset button is clicked, all form items restore to default values
   */
  (e: 'reset'): void
}
```

### 5.2 Emits 注释要点

- **v-model 事件**：明确标注 `update:xxx` 事件
- **触发时机**：使用 `@remarks` 描述触发条件
- **参数说明**：`@param` 描述回调参数的业务含义
- **不要遗漏**：所有对外暴露的事件都需要注释

---

## 6. Slots 注释规范

### 6.1 模板中的插槽注释

在 `<slot>` 标签上方使用 HTML 注释：

```vue
<template>
  <div class="search-form">
    <!--
      @slot 表单底部操作区
      @slot Form footer actions
      @binding {boolean} loading - <zh/> 搜索按钮加载状态 | <en/> Search button loading state
      @binding {Function} onSearch - <zh/> 手动触发搜索的方法 | <en/> Method to manually trigger search
      @binding {Function} onReset - <zh/> 手动触发重置的方法 | <en/> Method to manually trigger reset
    -->
    <slot
      name="footer"
      :loading="searchLoading"
      :on-search="handleSearch"
      :on-reset="handleReset"
    >
      <!-- 默认底部内容 -->
    </slot>

    <!--
      @slot 自定义表单项
      @slot Custom form item
      @binding {Object} item - <zh/> 当前表单项配置 | <en/> Current form item config
      @binding {Object} formData - <zh/> 完整表单数据 | <en/> Complete form data
      @priority <zh/> 具名插槽 > items 配置中的 slot 属性 > items 配置中的 component 属性
      @priority <en/> Named slot > slot property in items config > component property in items config
    -->
    <slot name="form-item" :item="currentItem" :form-data="formData" />
  </div>
</template>
```

### 6.2 插槽注释要点

- **作用域变量**：使用 `@binding` 标注变量类型和含义
- **默认内容**：如果插槽有默认内容，需要简要说明
- **优先级**：如果多个机制控制同一区域，必须用 `@priority` 说明优先级
- **使用场景**：复杂插槽可添加 `@remarks` 说明典型使用方式

---

## 7. Expose 注释规范

### 7.1 基础格式

```typescript
/**
 * 暴露给父组件的方法和属性
 * Methods and properties exposed to parent component
 */
defineExpose({
  /**
   * 重置表单并清除所有校验结果
   * Reset the form and clear all validation results
   * @returns <zh/> 重置后的表单数据 | <en/> form data after reset
   */
  reset: (): Record<string, any> => { /* ... */ },

  /**
   * 获取当前表单的校验状态
   * Get the validation state of the form
   * @returns <zh/> 是否通过校验 | <en/> whether validation passed
   */
  validate: (): boolean => { /* ... */ },

  /**
   * 表单内部引用的 Ref（慎用）
   * Internal form Ref (use with caution)
   * @internal
   * @remarks
   * <zh/> 仅在必要时暴露，正常业务应使用 expose 的方法操作
   * <en/> Only exposed when necessary, use exposed methods for normal operations
   */
  formRef: ref<FormInstance>()
})
```

### 7.2 Expose 注释要点

- **公共方法**：说明功能、参数、返回值
- **内部引用**：使用 `@internal` 标记，并说明为什么不建议直接使用
- **副作用**：方法是否会触发事件或修改其他状态

---

## 8. 工具函数注释规范

### 8.1 基础格式

```typescript
/**
 * <zh/> 将表单项配置转换为请求参数
 * <en/> Convert form item config to request parameters
 *
 * @param formData - <zh/> 表单数据 | <en/> form data
 * @param config - <zh/> 转换配置 | <en/> transform config
 * @returns <zh/> 转换后的请求参数 | <en/> transformed request parameters
 *
 * @example 基础用法
 * ```ts
 * const params = transformFormToParams(
 *   { name: 'test', status: 'active' },
 *   { stripEmpty: true }
 * )
 * ```
 *
 * @remarks
 * <zh/>
 * - 自动过滤空字符串和 undefined 值
 * - 日期类型转换为时间戳
 *
 * <en/>
 * - Automatically filters empty strings and undefined values
 * - Date types are converted to timestamps
 */
export function transformFormToParams(
  formData: Record<string, any>,
  config?: TransformConfig
): Record<string, any> {
  // 实现
}
```

### 8.2 工具函数注释要点

- **功能描述**：一句话说明函数用途
- **参数说明**：使用 `@param` 描述每个参数的业务含义
- **返回值说明**：使用 `@returns` 描述返回值的内容
- **代码示例**：复杂函数使用 `@example` 提供示例
- **特殊逻辑**：使用 `@remarks` 说明重要的处理规则

---

## 9. 组件内部注释规范

### 9.1 逻辑注释

```typescript
// 当 searchMode 变化时，需要重新初始化搜索条件
// When searchMode changes, re-initialize search conditions
watch(() => props.searchMode, () => {
  initSearchConditions()
})

// 防止在请求完成前重复提交
// Prevent duplicate submission before request completes
const handleSearch = async () => {
  if (searchLoading.value) return
  // ...
}
```

### 9.2 副作用注释

```typescript
onMounted(() => {
  // 组件挂载时自动请求初始数据（如配置了 immediate 属性）
  // Automatically fetch initial data when mounted (if immediate prop is set)
  if (props.immediate) {
    fetchData()
  }

  // 绑定全局键盘事件，ESC 键关闭搜索面板
  // Bind global keyboard event, ESC key closes the search panel
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  // 移除全局事件绑定，防止内存泄漏
  // Remove global event binding to prevent memory leak
  document.removeEventListener('keydown', handleKeydown)
})
```

### 9.3 兼容性处理注释

```typescript
// 兼容 Element Plus 1.x 版本的 API，2.0 版本后可移除此逻辑
// Compatible with Element Plus 1.x API, can be removed after 2.0
const getComponentName = () => {
  // @ts-ignore - 1.x 版本使用旧 API
  return elForm.value?.name ?? elForm.value?.componentName
}
```

### 9.4 临时修复注释

```typescript
// Workaround: Element Plus 的 Scrollbar 组件在 SSR 环境下会报错
// Workaround: Element Plus Scrollbar component throws error in SSR environment
if (typeof window !== 'undefined') {
  useScrollbar.value = true
}
```

---

## 10. 透传与行为变更规范

### 10.1 透传说明

当组件封装了 Element Plus 组件并透传部分属性时，必须注释：

```typescript
/**
 * 自定义输入框组件
 * Custom input component
 *
 * @extends ElInput
 *
 * @remarks
 * <zh/>
 * **透传属性**：支持所有 ElInput 的原生属性（如 placeholder、clearable、maxlength 等），
 * 通过 `v-bind="$attrs"` 自动透传。详细文档请参考
 * [Element Plus Input](https://element-plus.org/zh-CN/component/input.html)
 *
 * <en/>
 * **Passthrough props**: All native ElInput props are supported (e.g., placeholder, clearable, maxlength),
 * automatically passed through via `v-bind="$attrs"`. See
 * [Element Plus Input](https://element-plus.org/en-US/component/input.html) for details
 */
```

### 10.2 行为变更

如果修改了底层组件的默认行为，必须标注：

```typescript
/**
 * <zh/> 输入框类型
 * <en/> Input type
 *
 * @default 'text'
 *
 * @remarks
 * <zh/>
 * **注意**：与 ElInput 不同，此组件不支持 `textarea` 类型。
 * 如需使用多行文本，请使用 MultilineInput 组件
 *
 * <en/>
 * **Note**: Unlike ElInput, this component does not support `textarea` type.
 * Use MultilineInput component for multiline text
 */
type?: 'text' | 'password' | 'number'
```

---

## 11. 弃用标记规范

```typescript
/**
 * <zh/> 是否启用旧版样式
 * <en/> Whether to enable legacy style
 *
 * @default false
 * @deprecated <zh/> 自 v2.0 起弃用，请使用 `theme` 属性代替
 *             | <en/> Deprecated since v2.0, use `theme` prop instead
 */
legacy?: boolean
```

弃用组件：

```vue
<!--
  @component OldTable
  @displayName 旧版表格
  @displayName Legacy Table
  @deprecated <zh/> 自 v3.0 起弃用，请使用 DataGrid 组件
  @deprecated <en/> Deprecated since v3.0, use DataGrid component
-->
```

---

## 12. 类型定义注释规范

### 12.1 接口/类型

```typescript
/**
 * 表单项配置
 * Form item configuration
 */
interface FormItemConfig {
  /**
   * <zh/> 字段名，对应 formData 中的 key
   * <en/> Field name, corresponding to the key in formData
   */
  prop: string

  /**
   * <zh/> 标签文本
   * <en/> Label text
   */
  label: string

  /**
   * <zh/> 表单控件类型
   * <en/> Form control type
   */
  type: 'input' | 'select' | 'date-picker' | 'switch'

  /**
   * <zh/> 占位文本
   * <en/> Placeholder text
   * @default <zh/> 请输入{label}
   * @default <en/> Please enter {label}
   */
  placeholder?: string

  /**
   * <zh/> 校验规则
   * <en/> Validation rules
   * @see https://github.com/yiminghe/async-validator
   */
  rules?: FormItemRule[]
}
```

### 12.2 枚举

```typescript
/**
 * <zh/> 组件尺寸枚举
 * <en/> Component size enum
 */
export enum ComponentSize {
  /**
   * <zh/> 大号
   * <en/> Large
   */
  LARGE = 'large',

  /**
   * <zh/> 默认
   * <en/> Default
   */
  DEFAULT = 'default',

  /**
   * <zh/> 小号
   * <en/> Small
   */
  SMALL = 'small'
}
```

---

## 13. 行内注释规范

### 13.1 双语行内注释

```typescript
// 如果 searchOnChange 为 true，则在输入变化时自动搜索
// If searchOnChange is true, automatically search when input changes
```

### 13.2 特殊说明

```typescript
// HACK: ElSelect v-model 在特定情况下不会触发更新
// HACK: ElSelect v-model does not trigger update in specific cases
// 使用 nextTick 强制等待 DOM 更新后再操作
// Use nextTick to force wait for DOM update before operating
```

### 13.3 TypeScript 忽略

```typescript
// @ts-expect-error - Element Plus 1.x types incompatibility
```

### 13.4 ESLint 指令

```typescript
/* eslint-disable vue/no-mutating-props */
/* global __DEV__ */
```

---

## 14. 快速参考模板

### 14.1 组件文件模板

```vue
<!--
  @component ComponentName
  @displayName 组件中文名
  @displayName Component English Name
  @description <zh/> 组件简要描述
  @description <en/> Brief description
  @category 分类 | Category
  @extends BaseComponent
  @since 1.0.0
-->
<template>
  <!--
    @slot 插槽名称
    @slot Slot name
    @binding {Type} variableName - <zh/> 变量描述 | <en/> Variable description
  -->
  <slot />
</template>

<script setup lang="ts">
/**
 * <zh/> Props 描述
 * <en/> Props description
 */
interface ComponentProps {
  /**
   * <zh/> 属性描述
   * <en/> Property description
   * @default defaultValue
   */
  propName?: Type
}

/**
 * <zh/> Emits 描述
 * <en/> Emits description
 */
interface ComponentEmits {
  /**
   * <zh/> 事件描述
   * <en/> Event description
   * @param param - <zh/> 参数描述 | <en/> parameter description
   */
  (e: 'eventName', param: Type): void
}

defineProps<ComponentProps>()
defineEmits<ComponentEmits>()

defineExpose({
  /**
   * <zh/> 方法描述
   * <en/> Method description
   */
  methodName: () => { /* ... */ }
})
</script>
```

### 14.2 工具函数模板

```typescript
/**
 * <zh/> 函数功能描述
 * <en/> Function description
 *
 * @param paramName - <zh/> 参数说明 | <en/> parameter description
 * @returns <zh/> 返回值说明 | <en/> return description
 *
 * @example
 * ```ts
 * const result = functionName(param)
 * ```
 *
 * @remarks
 * <zh/> 补充说明
 * <en/> Additional notes
 */
export function functionName(param: Type): ReturnType {
  // 实现
}
```

---

## 15. 异常与已知问题

1. **Element Plus 类型不一致**：如遇到 Element Plus 类型导出问题，使用 `@ts-expect-error` 并注明原因和版本
2. **第三方库文档链接**：引用 Element Plus 或其他库的文档时，使用完整的文档链接
3. **SSR 兼容性**：涉及浏览器 API 的代码需要添加 SSR 环境判断注释
4. **Vue 版本兼容**：如果组件同时支持 Vue 2/3，需要在注释中说明差异点

---

## 附录：标签速查表

| 标签 | 用途 | 适用范围 |
|------|------|----------|
| `@component` | 组件名称 | 组件文件头 |
| `@displayName` | 组件显示名（中/英） | 组件文件头 |
| `@description` | 描述 | 组件文件头 |
| `@category` | 分类 | 组件文件头 |
| `@extends` | 继承关系 | 组件文件头 |
| `@since` | 引入版本 | 组件、Props |
| `@default` | 默认值 | Props |
| `@param` | 参数说明 | Emits、Expose、函数 |
| `@returns` | 返回值说明 | Expose、函数 |
| `@remarks` | 补充说明 | Props、Emits、函数 |
| `@example` | 代码示例 | 函数、组件使用 |
| `@deprecated` | 弃用标记 | Props、方法、组件 |
| `@experimental` | 实验性功能 | Props、方法 |
| `@internal` | 内部 API | Expose、方法 |
| `@slot` | 插槽说明 | 模板中的 slot |
| `@binding` | 插槽作用域变量 | 模板中的 slot |
| `@priority` | 插槽/功能优先级 | 模板中的 slot |
| `@see` | 参考链接 | Props、函数 |
| `@css` | 样式相关 | Props |