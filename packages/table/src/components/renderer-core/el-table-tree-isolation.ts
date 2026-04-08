/**
 * @file el-table-tree-isolation.ts
 * @description
 * <zh/> ElTable 内建树形的隔离常量。
 *
 * <zh/> **问题**：本库自己实现树形（`data/use-tree-data` 负责展开状态 + 迭代展平），交给 ElTable 的
 * <zh/> `data` 是**已展平的平铺数组**，但行对象仍是消费者的原对象——其中通常仍带着 `children` 数组。
 * <zh/> 而 ElTable 的内建树形完全由数据驱动（`store/tree.mjs` → `normalize` → `walkTreeNode(data, …,
 * <zh/> childrenColumnName, lazyColumnIdentifier, lazy)`），且**只要 `row-key` 存在就会执行**
 * <zh/> （`normalizedData` 的守卫是 `if (!watcherData.rowKey.value) return {}`）。
 * <zh/> 本库必须传 `row-key`（行身份/选择），因此内建树形会被激活 → 出现 EP 自己的缩进与展开图标、
 * <zh/> 且 `toggleAllSelection` 会额外按 children 级联（与本库自身的树级联重复）。
 *
 * <zh/> **为什么是「伪属性」**：Element Plus **没有**提供关闭内建树形的开关，唯一的关闭方式是让
 * <zh/> `childrenColumnName` / `lazyColumnIdentifier` 指向一个任何行都不存在的键——`walkTreeNode` 取不到
 * <zh/> children 即不会生成 treeData。因此这不是可省略的 trick，而是当前 EP 版本下的**唯一关闭手段**。
 *
 * <zh/> **替代方案与代价**（评估后未采用，见 `EP-UPGRADE-CHECKLIST.md`）：
 * <zh/> 1. 不传 `row-key` 给 ElTable——EP 树形整体惰性化，但会破坏 ElTable 侧的行身份
 * <zh/>    （`reserve-selection` / `getRowIdentity`），风险高于收益。
 * <zh/> 2. 交给 ElTable 前剥离行对象的 `children`——需逐行拷贝（破坏行引用身份）或原地删除（污染消费
 * <zh/>    者数据），在大数据量下不可接受。
 * <zh/> 3. 因此保留本常量，并以**升级守护测试**（`__tests__/components/renderer-core/el-table-tree-isolation.test.ts`）
 * <zh/>    锁定「EP 内建树形保持惰性」这一不变量：EP 若改变激活机制，测试失败而不是静默双渲染。
 *
 * <en/> ElTable built-in tree isolation constant.
 *
 * <en/> **Problem**: this library implements tree data itself (`data/use-tree-data` owns expansion state and
 * <en/> iterative flattening). The `data` handed to ElTable is the **flattened** array, but the row objects are
 * <en/> still the consumer's originals — which usually still carry their `children` array. ElTable's built-in
 * <en/> tree is purely data-driven (`store/tree.mjs` → `normalize` → `walkTreeNode(data, …,
 * <en/> childrenColumnName, lazyColumnIdentifier, lazy)`) and **runs whenever `row-key` is present**
 * <en/> (`normalizedData` is guarded only by `if (!watcherData.rowKey.value) return {}`). Since this library
 * <en/> must pass `row-key` (row identity / selection), the built-in tree activates → EP renders its own indent
 * <en/> and expand icons, and `toggleAllSelection` additionally cascades through children, duplicating this
 * <en/> library's own tree cascade.
 *
 * <en/> **Why a "fake prop"**: Element Plus provides **no** switch to disable its built-in tree. The only way to
 * <en/> turn it off is pointing `childrenColumnName` / `lazyColumnIdentifier` at a key no row has —
 * <en/> `walkTreeNode` then finds no children and builds no treeData. So this is not an optional trick but the
 * <en/> **only** disable mechanism on the current EP version.
 *
 * <en/> **Alternatives and their costs** (evaluated and rejected, see `EP-UPGRADE-CHECKLIST.md`):
 * <en/> 1. Not passing `row-key` to ElTable — makes the EP tree inert wholesale, but breaks ElTable-side row
 * <en/>    identity (`reserve-selection` / `getRowIdentity`); the risk outweighs the benefit.
 * <en/> 2. Stripping `children` off row objects before handing them to ElTable — requires per-row copies
 * <en/>    (destroying row reference identity) or in-place deletion (polluting consumer data); unacceptable at scale.
 * <en/> 3. Hence this constant stays, pinned by an **upgrade guard test**
 * <en/>    (`__tests__/components/renderer-core/el-table-tree-isolation.test.ts`) asserting the invariant
 * <en/>    "EP's built-in tree stays inert": if an EP upgrade changes the activation mechanism the test fails
 * <en/>    instead of silently double-rendering.
 */

/**
 * <zh/> 不存在的属性名——命名空间化以避免与任何消费者字段碰撞。
 * <en/> A property name that cannot exist — namespaced to avoid colliding with any consumer field.
 */
export const EL_TABLE_TREE_DISABLED_KEY = '__adv_table_no_builtin_tree__'

/**
 * <zh/> 传给 ElTable `tree-props` 的隔离值：使内建树形的 children/hasChildren 探测永远落空。
 *
 * <zh/> `Object.freeze` 保证引用稳定，避免每次渲染产生新对象引发 ElTable 侧 props watch 抖动；
 * <zh/> `as const` 保留字面量类型，便于测试与调用方做精确断言。
 *
 * <en/> The isolation value passed to ElTable's `tree-props`: makes the built-in tree's
 * <en/> children/hasChildren probes always miss.
 *
 * <en/> `Object.freeze` keeps the reference stable so no new object is created per render (avoiding ElTable's
 * <en/> prop watchers firing); `as const` preserves literal types for precise assertions in tests and callers.
 */
export const EL_TABLE_DISABLED_TREE_PROPS = Object.freeze({
  hasChildren: EL_TABLE_TREE_DISABLED_KEY,
  children: EL_TABLE_TREE_DISABLED_KEY,
}) as Readonly<{ hasChildren: string, children: string }>
