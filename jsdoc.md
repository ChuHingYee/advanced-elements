# TypeScript + Element Plus 二次封装注释规范 v2.0

> **Status / 状态**：本文档为非强制性格式参考（non-binding）。唯一规范以 `COMMENT_CONVENTIONS.md` 为准（CI `check:comment` 执行）。
> Where this document conflicts with the spec — custom-tag ban, single-language examples, omission mandates — the spec wins.

## 全局原则

### 0.1 输出格式约束

- **禁止 Emoji**: 所有注释仅使用标准 ASCII/Unicode 字符与 Markdown 语法。
- **零自定义标签**: 仅使用 JSDoc/TSDoc 标准标签。允许 `@extends`、`@implements`、`@override`、`@deprecated`、`@see`、`@param`、`@returns`、`@throws`、`@example`、`@typeParam`、`@slot`。禁止 `@elementPlusBase`、`@component`、`@prop` 等非标准标签。
- **人本位**: 注释只补充类型系统无法表达的业务语义、设计决策与使用约束。

### 0.2 注释取舍原则

- **类型即契约**: 继承、透传、禁用等结构关系由 TypeScript 保证，不重复描述。
- **省略原则**: 如果信息已从类型签名、命名、代码结构中明确表达，则省略对应注释。
- **差异优先**: 仅在运行时行为与原生 Element Plus 不同时，才在该属性上注释说明差异。
- **可读性优先**: 所有注释的首要读者是人类开发者。如果你不确定某段注释对人是否有用，就不要写。

### 0.3 适用范围

- 所有 `.ts`、`.js`、`.vue` 文件均需遵循此规范。
- Hooks、Utils、Types、Constants 与组件同等重要，必须遵循与组件同等的注释标准。

---

## 第1章: Vue 组件文件

### 1.1 组件级注释

```ts
/**
 * 增强型输入框，支持自动格式化与防抖提交。
 *
 * 基于 ElInput 二次封装，完整继承其原生 API。
 * 适用于后台表单中需要统一输入格式或防止高频触发的场景。
 *
 * 主要增强:
 * - blur 时自动 trim 并应用格式化规则
 * - 内置 300ms 防抖，减少高频更新
 * - 提供 input-raw 事件获取未经处理的原始输入
 *
 * @see {@link https://element-plus.org/zh-CN/component/input.html | ElInput 官方文档}
 */
```

**规则**:
- 首行简洁描述组件职责（一句话）。
- 空行后补充使用场景与关键行为。
- 如果增强点超过 3 个，建议用列表列出主要增强。
- 必须使用 `@see` 链接到原生组件文档。

---

### 1.2 Props 注释规范

**原则**: 仅标注行为变更与新增语义。未修改行为的继承属性不写注释。

```ts
interface ProInputProps extends Omit<ElInputProps, 'type' | 'showWordLimit'> {
  /**
   * 绑定值。
   *
   * 注意: 与原生 ElInput 不同，blur 时会自动 trim，
   * 并延迟 300ms 防抖后才更新此值。
   * 如需获取原始实时输入，请监听 input-raw 事件。
   */
  modelValue?: string;

  /**
   * 格式化规则，在 blur 时应用。
   *
   * - 'phone': 自动添加空格分隔 (138 0000 0000)
   * - 'bank-card': 四位一组 (6222 0000 0000 0000)
   * - 自定义函数: 接收原始值，返回格式化后的字符串
   */
  formatRule?: 'phone' | 'bank-card' | ((val: string) => string);

  /**
   * 防抖延迟时间(毫秒)，默认 300。
   * 设为 0 可关闭防抖，此时行为与原生 v-model 一致。
   */
  debounceDelay?: number;

  // 未修改行为的继承属性不写注释，仅保留类型定义
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;

  /**
   * @deprecated 自 v2.3.0 起，字数限制由 formatRule 属性统一管理。
   * 请使用 `formatRule: 'word-limit'` 替代。
   */
  showWordLimit?: never;
}
```

**规则**:
- 行为变更的属性必须使用 "注意:" 前缀引起人类注意。
- 禁用的原生属性使用 `@deprecated` 标注并给出替代方案，类型设为 `never`。
- 可选属性如有默认值，在注释中明确说明。
- 联合类型或枚举值的每个选项如有特殊行为，用列表说明。

---

### 1.3 Emits 注释规范

```ts
/**
 * ProInput 组件事件定义。
 * 继承 ElInput 所有原生事件，新增以下自定义事件。
 */
interface ProInputEmits {
  /**
   * 原始实时输入事件。
   *
   * 注意: 与原生 update:modelValue 不同，此事件在每次输入时立即触发，
   * 未经 trim 与防抖处理。适用于需要实时响应用户输入的场景(如搜索建议)。
   *
   * @param value - 用户输入的原始字符串
   */
  (e: 'input-raw', value: string): void;

  /**
   * 格式化后的提交事件。
   * 在防抖延迟结束后触发，携带的值已应用 formatRule 规则。
   *
   * @param value - 格式化后的最终值
   */
  (e: 'formatted-change', value: string): void;

  /**
   * 校验失败事件。
   * 当输入值不符合 formatRule 预期格式时触发。
   *
   * @param error - 错误信息对象
   * @param error.rawValue - 用户输入的原始值
   * @param error.message - 错误描述
   */
  (e: 'validation-error', error: { rawValue: string; message: string }): void;

  // 未修改行为的继承事件不写注释
  (e: 'change', value: string): void;
  (e: 'focus', event: FocusEvent): void;
  (e: 'blur', event: FocusEvent): void;
}
```

**规则**:
- 新增事件必须包含 `@param` 描述回调参数。
- 行为变更的事件必须使用 "注意:" 前缀说明差异。
- 未修改行为的继承事件仅保留类型签名，不写注释。
- 复杂事件参数需拆解为 `@param` 子属性说明。

---

### 1.4 Slots 注释规范

在 `.vue` 模板中使用 `@slot` 标签注释插槽:

```vue
<template>
  <div class="pro-input-wrapper">
    <!--
     * @slot prefix - 输入框前缀内容
     *
     * 注意: 此插槽会覆盖 ElInput 默认的 prefix 插槽行为。
     * 如需保留原生 prefix 图标，请在此插槽内自行实现。
     *
     * @example
     * ```vue
     * <ProInput>
     *   <template #prefix>
     *     <el-icon><Search /></el-icon>
     *   </template>
     * </ProInput>
     * ```
    -->
    <slot name="prefix" />

    <el-input v-bind="inputProps" @blur="handleBlur">
      <!--
       * @slot default - 默认插槽，透传至 ElInput 内部
      -->
      <slot />
    </el-input>

    <!--
     * @slot error-message - 自定义错误信息展示
     * @binding {string} error - 当前错误信息文本
     * @binding {Function} clearError - 清除当前错误的回调
    -->
    <slot name="error-message" :error="validationError" :clear-error="clearError">
      <span v-if="validationError" class="error-text">{{ validationError }}</span>
    </slot>
  </div>
</template>
```

**规则**:
- 使用标准 `@slot` 标签描述插槽名称与用途。
- 新增插槽或覆盖原生插槽行为时必须说明差异。
- 作用域插槽必须使用 `@binding` 标签说明暴露的变量名与类型。
- 如有默认内容，需说明默认渲染逻辑。
- `@example` 展示推荐用法。

---

### 1.5 Expose 暴露方法注释规范

```ts
/**
 * 组件暴露的公共方法与属性。
 *
 * 注意: 仅暴露了 ElInput 的 focus/select 方法，
 * blur 方法被禁用，需通过组件内部逻辑统一管理失焦行为。
 */
defineExpose({
  /**
   * 聚焦输入框。
   * 透传至内部 ElInput 实例的 focus 方法。
   */
  focus,

  /**
   * 选中全部文本。
   * 透传至内部 ElInput 实例的 select 方法。
   */
  select,

  /**
   * 清除输入值与校验状态。
   */
  clear,

  /**
   * 触发格式化(不等待 blur)。
   * 适用于需要主动触发表单提交前格式化的场景。
   */
  forceFormat,

  /**
   * 获取当前原始值(未经格式化)。
   */
  getRawValue,

  /**
   * @internal 内部使用，暴露给测试用。
   * 请勿在生产代码中调用，后续版本可能移除。
   */
  __internalReset: reset,
});
```

**规则**:
- 暴露的每个方法/属性必须有注释说明其用途。
- 透传原生方法需注明 "透传至内部 Xxx 实例"。
- 仅供内部或测试使用的方法使用 `@internal` 标签标注。
- 如禁用了原生某些方法，需在整体注释中说明原因。

---

### 1.6 泛型组件注释规范

```ts
/**
 * 增强型选择器，基于 ElSelect 二次封装。
 * 支持选项的远程搜索、虚拟滚动与分组。
 *
 * @typeParam OptionType - 选项数据类型。
 *   至少需要包含 label 和 value 字段。
 *   可通过 optionFieldMap 自定义字段映射。
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * interface UserOption {
 *   id: number;
 *   name: string;
 *   avatar: string;
 * }
 *
 * const options: UserOption[] = [
 *   { id: 1, name: '张三', avatar: '/avatars/1.png' }
 * ];
 * </script>
 *
 * <template>
 *   <ProSelect
 *     :options="options"
 *     :option-field-map="{ label: 'name', value: 'id' }"
 *   />
 * </template>
 * ```
 *
 * @see {@link https://element-plus.org/zh-CN/component/select.html | ElSelect 官方文档}
 */
```

**规则**:
- 使用 `@typeParam` 说明泛型参数的用途与约束。
- `@example` 中应包含泛型的具体使用示例。

---

## 第2章: 纯 TS/JS 逻辑文件

### 2.1 Hooks / Composables

```ts
/**
 * 封装 Element Plus 表格分页逻辑。
 *
 * 自动同步 URL 查询参数，支持刷新保持页码。
 * 返回的响应式对象可直接绑定至 ElPagination。
 *
 * 注意: 此 hook 内部使用 watchEffect 监听路由变化，
 * 组件卸载时会自动清理，无需手动处理。
 *
 * @param options - 分页配置
 * @param options.defaultPageSize - 默认每页条数，默认 20
 * @param options.pageSizes - 可选的每页条数选项，默认 [10, 20, 50, 100]
 * @param options.syncUrl - 是否同步 URL 参数，默认 true。
 *   开启后页码与每页条数会同步到 URL query，支持浏览器前进后退。
 *
 * @returns 分页状态与操作方法
 * @returns pagination - 分页响应式配置，可直接绑定至 ElPagination 的 v-bind
 * @returns handlePageChange - 页码变更回调，直接传给 ElPagination 的 @change 事件
 * @returns handleSizeChange - 每页条数变更回调，直接传给 ElPagination 的 @size-change 事件
 * @returns reset - 重置分页到第一页，同时清除 URL 参数
 * @returns refresh - 保持当前页码重新获取数据(用于表格数据刷新)
 *
 * @example
 * ```ts
 * // 基本用法
 * const { pagination, handlePageChange, reset } = useElPagination({
 *   defaultPageSize: 50,
 * });
 *
 * // 禁用 URL 同步
 * const { pagination, handlePageChange } = useElPagination({
 *   defaultPageSize: 50,
 *   syncUrl: false,
 * });
 * ```
 */
export function useElPagination(options: PaginationOptions): UseElPaginationReturn {
  // 实现略
}

/**
 * useElPagination 的返回值类型。
 */
interface UseElPaginationReturn {
  /** 分页配置对象，直接绑定 ElPagination */
  pagination: Ref<PaginationConfig>;

  /** 页码变更处理函数 */
  handlePageChange: (page: number) => void;

  /** 每页条数变更处理函数 */
  handleSizeChange: (size: number) => void;

  /** 重置到第一页 */
  reset: () => void;

  /** 保持当前页码刷新 */
  refresh: () => void;
}
```

**规则**:
- 首段描述 hook 的核心功能。
- 如有副作用(网络请求、DOM操作、路由变更等)，必须在首段后用 "注意:" 说明。
- 必须包含 `@param`、`@returns` 与 `@example`。
- `@param` 需说明每个参数的默认值。
- `@returns` 如有多个返回值属性，需用 `@returns` 子条目逐一说明。
- `@example` 必须使用围栏代码块并标注语言，示例必须是可运行的真实代码。
- 返回值类型建议单独定义 interface 并添加注释。

---

### 2.2 Utils / 工具函数

```ts
/**
 * 将后端树形数据就地转换为 ElTree 所需的扁平结构。
 *
 * **本函数会直接修改传入数据的 children 引用**，以节省深拷贝开销。
 * 如果需保留原始数据，调用方应自行深拷贝后传入。
 *
 * @param tree - 后端返回的树形数据
 * @param fieldMap - 字段映射配置
 * @param fieldMap.id - 节点 ID 字段名，默认 'id'
 * @param fieldMap.label - 节点标签字段名，默认 'label'
 * @param fieldMap.children - 子节点字段名，默认 'children'
 *
 * @returns ElTree 兼容的扁平节点数组，每个节点包含 parentId 引用
 *
 * @throws {TypeError} 当 tree 参数不是数组时抛出
 *
 * @example
 * ```ts
 * // 基本用法
 * const flatNodes = flattenTreeForElTree(backendTreeData);
 *
 * // 自定义字段映射
 * const flatNodes = flattenTreeForElTree(backendTreeData, {
 *   id: 'nodeId',
 *   label: 'nodeName',
 *   children: 'subNodes',
 * });
 *
 * // 保留原始数据
 * const flatNodes = flattenTreeForElTree(
 *   structuredClone(backendTreeData)
 * );
 * ```
 */
export function flattenTreeForElTree<T>(
  tree: T[],
  fieldMap?: FieldMapConfig
): ElTreeNode[] {
  // 实现略
}
```

**规则**:
- 有副作用的函数必须在首段用加粗声明副作用内容。
- 必须包含 `@param`、`@returns` 与 `@example`。
- 如可能抛出异常，使用 `@throws` 说明异常类型与触发条件。
- `@example` 需覆盖主要使用场景，包括默认配置与自定义配置。
- 如函数名能清晰表达功能，首段注释可直接进入实现细节与注意事项。

---

### 2.3 Types / Interfaces

```ts
/**
 * 搜索表单字段配置。
 *
 * 用于 ProSearchForm 的 fields 属性，
 * 定义了表单项的类型、校验规则与联动逻辑。
 *
 * @typeParam T - 表单数据模型类型
 */
export interface SearchFieldConfig<T extends Record<string, any> = Record<string, any>> {
  /**
   * 字段键名。
   * 对应表单 model 的 key，提交时作为请求参数的字段名。
   */
  field: keyof T;

  /**
   * 表单项标签。
   * 如不提供，将自动从 field 的驼峰命名转换(如 userName -> 用户名)。
   */
  label?: string;

  /**
   * 表单项类型，映射至对应 Element Plus 组件。
   *
   * - 'input': ElInput 文本输入
   * - 'select': ElSelect 下拉选择
   * - 'date-picker': ElDatePicker 日期选择
   * - 'date-range': 日期范围选择(使用两个 ElDatePicker 组合)
   * - 'custom': 自定义渲染，需配合 customRender 属性使用
   */
  type: 'input' | 'select' | 'date-picker' | 'date-range' | 'custom';

  /**
   * 联动显隐条件。
   * 接收当前整个表单 model，返回 true 时显示该字段，
   * 返回 false 时隐藏并清空该字段的值。
   *
   * 注意: 频繁切换显隐可能引起表单校验状态丢失，
   * 建议配合 form.clearValidate(field) 使用。
   */
  visibleWhen?: (model: T) => boolean;

  /**
   * 自定义渲染函数(仅 type='custom' 时生效)。
   *
   * @param model - 当前表单 model 的响应式引用
   * @param updateModel - 更新 model 的回调
   * @returns VNode 或 JSX 元素
   */
  customRender?: (model: Ref<T>, updateModel: (field: keyof T, value: any) => void) => VNode;
}
```

**规则**:
- Interface/Type 顶部注释说明其用途与使用场景。
- 如有泛型参数，使用 `@typeParam` 说明约束。
- 每个属性必须有注释，说明其作用、默认值、使用限制。
- 联合类型或枚举值的每个选项如有不同行为，用列表说明。
- 函数类型属性需使用 `@param` 和 `@returns` 说明参数与返回值。

---

### 2.4 Constants / 枚举

```ts
/**
 * 表格列对齐方式枚举。
 *
 * 映射 ElTableColumn 的 align 属性。
 * 额外增加 'auto' 选项，根据内容类型自动判断对齐方式。
 *
 * @example
 * ```vue
 * <el-table-column :align="TableColumnAlign.Auto" />
 * ```
 */
export enum TableColumnAlign {
  /** 左对齐，适用于文本内容 */
  Left = 'left',

  /** 居中对齐，适用于状态标签等短内容 */
  Center = 'center',

  /** 右对齐，适用于数字、金额 */
  Right = 'right',

  /**
   * 自动判断对齐方式。
   * 数字内容(含金额、百分比)右对齐，其余左对齐。
   */
  Auto = 'auto',
}

/**
 * 表格行选择模式枚举。
 *
 * 用于 ProTable 的 selectionMode 属性，
 * 控制多选时的行为模式。
 */
export enum SelectionMode {
  /**
   * 点击行任意位置即可选中/取消选中。
   * 与 Element Plus 原生行为一致。
   */
  Row = 'row',

  /** 仅点击复选框时选中/取消选中 */
  Checkbox = 'checkbox',
}
```

**规则**:
- 枚举顶部说明其用途与映射关系。
- 每个枚举值必须有注释说明适用场景。
- 如果枚举值对应原生组件的属性值，应说明映射关系。
- 非标准行为(如 `Auto`)需详细说明判断逻辑。

---

## 第3章: 特殊场景注释模板

### 3.1 性能敏感函数

```ts
/**
 * 监听容器尺寸变化。
 *
 * 基于 ResizeObserver API 封装，自动管理观察者生命周期。
 *
 * 性能说明:
 * - 回调已内置 200ms debounce，resize 事件不会高频触发
 * - 返回值使用 shallowRef 包装，避免深层响应式带来的性能开销
 * - 组件卸载时自动断开观察，无需手动清理
 *
 * @param target - 目标元素或选择器，支持 Ref<HTMLElement> 或 CSS 选择器字符串
 * @param options.debounceMs - 防抖延迟(毫秒)，默认 200
 *
 * @returns 尺寸响应式对象 { width: number, height: number }
 *
 * @example
 * ```ts
 * const { width, height } = useResizeObserver(containerRef);
 * watch([width, height], ([w, h]) => {
 *   console.log(`容器尺寸: ${w} x ${h}`);
 * });
 * ```
 */
export function useResizeObserver(
  target: Ref<HTMLElement> | string,
  options?: { debounceMs?: number }
): { width: Readonly<ShallowRef<number>>; height: Readonly<ShallowRef<number>> } {
  // 实现略
}
```

**规则**:
- 如函数使用了性能优化手段(shallowRef、debounce、throttle、虚拟滚动等)，需在注释中说明。
- 使用 "性能说明:" 前缀单独成段。

---

### 3.2 有副作用的初始化函数

```ts
/**
 * 注册全局指令并挂载 Element Plus 图标。
 *
 * **本函数具有以下副作用:**
 * 1. 向 app 实例注册 v-permission、v-loading-more 全局指令
 * 2. 挂载 Element Plus 所有图标组件到全局
 * 3. 设置全局弹窗 z-index 基础值
 *
 * 注意: 此函数应在 createApp 之后、app.mount 之前调用。
 * 多次调用会跳过已注册的指令，不会重复注册。
 *
 * @param app - Vue 应用实例
 *
 * @example
 * ```ts
 * // main.ts
 * const app = createApp(App);
 * setupGlobalPlugins(app);
 * app.mount('#app');
 * ```
 */
export function setupGlobalPlugins(app: App): void {
  // 实现略
}
```

---

### 3.3 异步函数

```ts
/**
 * 批量删除用户并刷新列表。
 *
 * 注意: 此函数会先调用删除接口，成功后自动刷新表格数据。
 * 如果部分删除失败，不会回滚已成功的操作。
 *
 * @param ids - 待删除的用户 ID 列表
 * @param options.confirmMessage - 确认提示信息，默认 "确认删除选中用户?"
 *
 * @returns 删除结果汇总
 * @returns successCount - 成功删除数量
 * @returns failedIds - 删除失败的 ID 列表及原因
 *
 * @throws {HttpError} 网络请求错误(非业务错误)
 *
 * @example
 * ```ts
 * const { successCount, failedIds } = await batchDeleteUsers(selectedIds, {
 *   confirmMessage: '确认删除所选管理员?'
 * });
 *
 * if (failedIds.length > 0) {
 *   ElMessage.warning(`${successCount} 个成功，${failedIds.length} 个失败`);
 * }
 * ```
 */
export async function batchDeleteUsers(
  ids: string[],
  options?: { confirmMessage?: string }
): Promise<{ successCount: number; failedIds: Array<{ id: string; reason: string }> }> {
  // 实现略
}
```

---

## 第4章: 标注速查表

### 4.1 行为差异标注

| 场景 | 标注方式 |
|------|----------|
| 行为与原生不同 | `注意: 与原生 Xxx 不同，...` |
| 禁用原生属性 | `@deprecated 自 vX.X.X 起，...请使用 ... 替代` |
| 性能优化 | `性能说明: 已内置 xxx ms debounce/shallowRef/...` |
| 副作用 | `**本函数会直接修改传入数据的 xxx 引用**` |
| 内部使用 | `@internal 内部使用，暴露给测试用。请勿在生产代码中调用` |

### 4.2 允许的 JSDoc 标签

| 标签 | 用途 | 使用位置 |
|------|------|----------|
| `@param` | 参数说明 | Hooks, Utils, 函数类型属性 |
| `@returns` | 返回值说明 | Hooks, Utils |
| `@throws` | 异常说明 | Utils, 异步函数 |
| `@example` | 使用示例 | Hooks, Utils, 组件 |
| `@see` | 外部文档链接 | 组件, Types |
| `@typeParam` | 泛型参数说明 | 泛型组件, 泛型接口 |
| `@deprecated` | 废弃标记 | Props, 函数 |
| `@internal` | 内部 API 标记 | Expose |
| `@slot` | 插槽说明 | 组件模板 |
| `@binding` | 作用域插槽绑定 | 组件模板插槽 |
| `@extends` | 继承关系 | 类组件基类 |
| `@implements` | 接口实现 | 类组件 |
| `@override` | 方法重写 | 类组件方法 |

---

## 第5章: 反面示例(禁止写法)

```ts
// [错误] 使用自定义标签
// @elementPlusBase ElInput
// @prop {string} modelValue 绑定值

// [错误] 使用 Emoji
// 增强型输入框 [Input]

// [错误] 重复类型系统已有的信息
interface ProInputProps {
  /** 是否禁用 */
  disabled?: boolean;  // 类型 boolean 已足够

  /** 占位文本 */
  placeholder?: string; // 类型 string 已足够
}

// [错误] @example 不使用围栏代码块且无语言标注
// @example
// const result = doSomething(123);

// [错误] 无意义的注释
/** 设置值 */
function setValue(val: string) { }

// [正确] 有意义的值
/** 设置搜索关键词并重置分页到第一页 */
function setValue(val: string) { }

// [错误] 副作用函数未在首段声明副作用
/** 转换树形数据为扁平结构 */
// 函数体内修改了原始数据但注释未提及

// [正确] 首段声明副作用
/** 将树形数据就地转换为扁平结构。[br]**本函数会直接修改传入数据的引用。** */
```
