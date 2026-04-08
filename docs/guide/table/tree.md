# 树形数据

通过 `treeConfig` 声明树形结构，支持静态树与懒加载两种形态。

## 静态树

:::demo 树形数据 table/tree.vue
:::

- `children`：子节点字段名（默认 `children`）
- `defaultExpandAll` / `defaultExpandedRowKeys`：默认展开范围
- `indent`：缩进宽度（px）

## 懒加载

子节点字段为空且 `hasChildren` 标记为 true 的行会显示展开箭头；首次展开时调用 `loadData`：

```vue
<AdvTable
  :data="data"
  :tree-config="{
    children: 'children',
    hasChildren: 'hasKids',      // 行上标记是否可懒加载的字段
    loadData: async (row, rowKey, { signal }) => {
      const res = await fetch(`/api/children/${rowKey}`, { signal })
      return res.json()
    },
  }"
/>
```

- `loadData` 返回的数组会被写入该行的 `children` 字段并展开
- `signal` 可用于取消过期请求（切换页码/卸载时库内部会中止竞态加载）

## 相关 API 与事件

| 名称 | 说明 |
|---|---|
| `rowExpand.toggleTreeNodeExpand(key)` | 手动切换树节点展开 |
| `rowExpand.expandedRowKeys` | 当前展开集合（响应式） |
| `rowExpand.expandAllTreeNodes()` | 全部展开树节点（并发池受控） |
| `expandRow` / `rowCollapse` 事件 | 展开状态变化通知 |

## 注意事项

- 树形模式下首列自动渲染缩进与展开图标（default/virtual 两模式 DOM 一致）
- 选择、编辑功能对树形行完全可用；勾选联动遵循 `checkStrictly` 配置
- 互斥（A7已决策）：`treeConfig` 与 `rowGroupConfig` 不可同开，双开时运行时忽略分组并派发 `TABLE_CONFIG_CONFLICT`（生产可见）+ dev 提示
