# AdvTable v2.1 迁移指南

> 本版本为未上线全新版本，破坏性变更直接生效（无 deprecated 别名过渡期）。本指南涵盖全部破坏性变更及对应迁移路径。

---

## 一、树形/行展开方法重命名（10 个）

### 命名规范

- **树形域**：对象词根统一为 `TreeNode`
- **行展开域**：对象词根统一为 `DetailRow`
- **行分组域**：保留 `Group` 词根（无跨域混淆）
- **全量操作**：`<动词>All<词根复数>`

### 重命名映射表

| # | 组 | 旧名 | 新名 | 语义 |
|---|-----|------|------|------|
| 1 | 树形 | `toggleRowExpand` | `toggleTreeNodeExpand` | 切换树节点展开/折叠 |
| 2 | 树形 | `expandRow` | `expandTreeNode` | 展开指定树节点 |
| 3 | 树形 | `collapseRow` | `collapseTreeNode` | 折叠指定树节点 |
| 4 | 树形 | `expandAll` | `expandAllTreeNodes` | 展开全部树节点 |
| 5 | 树形 | `collapseAll` | `collapseAllTreeNodes` | 折叠全部树节点 |
| 6 | 行展开 | `toggleRowExpandRow` | `toggleDetailRowExpand` | 切换行展开面板 |
| 7 | 行展开 | `expandRowByRow` | `expandDetailRow` | 展开指定行的展开面板 |
| 8 | 行展开 | `collapseRowByRow` | `collapseDetailRow` | 折叠指定行的展开面板 |
| 9 | 行展开 | `expandAllRows` | `expandAllDetailRows` | 展开全部行展开面板 |
| 10 | 行展开 | `collapseAllRows` | `collapseAllDetailRows` | 折叠全部行展开面板 |

### 保留原名

- `getTreeMeta` — Tree 词根明确，符合规范
- `toggleGroupExpand` — Group 词根明确，符合规范
- `expandAllGroups` — Group 词根明确，符合规范
- `collapseAllGroups` — Group 词根明确，符合规范

### 调用示例

```typescript
// 树形域
const api = ref<TableExpose<UserRow>>()

api.value.toggleTreeNodeExpand('row-1')   // 原 toggleRowExpand
api.value.expandTreeNode('row-2')         // 原 expandRow
api.value.collapseTreeNode('row-3')       // 原 collapseRow
api.value.expandAllTreeNodes()            // 原 expandAll
api.value.collapseAllTreeNodes()          // 原 collapseAll

// 行展开域
api.value.toggleDetailRowExpand('row-1')  // 原 toggleRowExpandRow
api.value.expandDetailRow('row-2')        // 原 expandRowByRow
api.value.collapseDetailRow('row-3')      // 原 collapseRowByRow
api.value.expandAllDetailRows()           // 原 expandAllRows
api.value.collapseAllDetailRows()         // 原 collapseAllRows
```

---

## 二、事件命名统一（3 个）

### 改名映射表

| 旧事件名 | 新事件名 | 改名理由 |
|---------|---------|---------|
| `changePage` | `pageChange` | 统一 `<主体>Change` 词序（与 `sortChange`/`dataChange` 一致） |
| `cellEditRequest` | `cellEditingRequest` | 统一 `cellEditing` 词根（与 `cellEditingStarted`/`cellEditingStopped` 一致） |
| `editCancelled` | `cellEditingCancelled` | 统一 `cellEditing` 词根（编辑会话取消） |

### 调用示例

```vue
<!-- 分页事件 -->
<AdvTable @page-change="onPageChange" />   <!-- 原 @change-page -->

<!-- 单元格编辑事件 -->
<AdvTable
  @cell-editing-request="onEditRequest"      <!-- 原 @cell-edit-request -->
  @cell-editing-cancelled="onEditCancelled"  <!-- 原 @edit-cancelled -->
/>
```

### 不改名说明

- **`rowExpand` / `rowCollapse`** — 事件名与 R2 方法重命名解耦。事件是树形/行展开共用的统一通道（载荷 `{ row, rowKey, expanded }`），改名会破坏"事件不随方法改名"的语义边界。

---

## 三、命名视图持久化通道统一

`saveView`/`applyView`/`getSavedViews`/`deleteView` 现复用 `columnStatePersistence.storage` 适配器，不再直接 `localStorage`。

### 关键变更

- **接口更名**：`ColumnStateStorage` → `AdvTableStorageAdapter`（string 值域）
- **错误结构**：`ColumnStateStorageError` → `AdvTableStorageError`（新增 `domain: 'columnState' | 'namedView'` 字段）

### 默认行为

- 未注入自定义适配器：读写经默认适配器（后端仍为 `localStorage`），格式不变，旧数据天然可读（零迁移）
- 注入自定义适配器：读取未命中时回退读默认 `localStorage`（legacy 双读），写入恒走注入适配器

### 错误通道

```vue
<AdvTable
  :column-state-persistence="{
    errorStrategy: 'warn',  // 'silent' | 'warn' | 'throw'
    onStorageError: ({ phase, error, key, domain }) => {
      console.error(`[${domain}] ${phase} failed:`, error)
    },
  }"
/>
```

---

## 四、公共类型出口收敛

以下类型已从包根出口（`@advanced-elements/table`）移除：

### 移除类型清单

| 类型 | 说明 | 替代方案 |
|------|------|----------|
| `RowContext<T>` | 行上下文窄接口（编排器内部通道） | 使用 `useTableApi` 返回的按需 API |
| `ColumnContext` | 列上下文窄接口（编排器内部通道） | 使用 `getColumnState()`/`applyColumnState()` |
| `RendererContext` | 渲染器上下文窄接口（编排器内部通道） | 使用 `TableExpose` 暴露的方法 |
| `CrossCuttingContext` | 跨切面上下文窄接口（编排器内部通道） | 使用 `useTableApi` 返回的按需 API |
| `RendererEmitsMap<T>` | 渲染器内部事件表 | 使用 `AdvTableEmitsMap<T>` 公共事件表 |
| `VirtualRendererEmitsMap<T>` | 虚拟渲染器内部事件表 | 使用 `AdvTableEmitsMap<T>` 公共事件表 |

> 这些类型现为包内实现细节。如有内部集成需求，可通过相对路径直接从源文件导入：
> - `src/types/orchestrator-context.ts`
> - `src/types/renderer-emits.ts`

---

## 五、泛型默认值统一（`<T = any>`）

20 处 `<T = Record<string, unknown>>` 泛型默认值全部统一为 `<T = any>`。

### 决策记录

| 维度 | `<T = any>`（采用） | `<T = Record<string, unknown>>`（弃用） |
|------|---------------------|----------------------------------------|
| 行业先例 | Element Plus `ElTable`（row: any）、AG Grid（RowData = any） | 无主流表格库采用 |
| 消费者 DX | `row.name` 为 any，开箱即用 | `row.name` 为 unknown，读字段处处需收窄 |
| 接口类型兼容 | interface 可直接作 T | **TS 接口无隐式索引签名，所有以 interface 声明行数据的消费者全部编译失败** |
| 改造成本 | 20 处改写 + 甄别 | 152 处改写 + 包内回调/示例/文档链式修正 |

### 影响位置

- `types/table-props.ts`、`types/column.ts`、`types/config-options.ts`、`types/config-tree.ts`
- `composables/columns/use-column-group.ts`、`composables/data/use-table-data-pipeline.ts`
- `composables/features/use-side-panel-orchestrator.ts`
- `utils/column-tree.ts`、`utils/event-handlers.ts`

### 消费者影响

- 未显式指定 `T` 的消费者：行为无变化（默认值形态不影响运行时）
- 显式指定 `T` 的消费者：无任何变化

---

## 六、迁移检查清单

完成迁移后，请按以下清单逐项确认：

- [ ] 全文搜索 `toggleRowExpand|expandRow|collapseRow|expandAll|collapseAll`，确认无旧名残留（注意排除 `expandAllGroups` 等合法保留名）
- [ ] 全文搜索 `toggleRowExpandRow|expandRowByRow|collapseRowByRow|expandAllRows|collapseAllRows`，确认无旧名残留
- [ ] 全文搜索 `'changePage'|'cellEditRequest'|'editCancelled'`，确认无旧事件名残留
- [ ] 确认不再从包根导入 `RowContext`/`ColumnContext`/`RendererContext`/`CrossCuttingContext`/`RendererEmitsMap`/`VirtualRendererEmitsMap`
- [ ] 运行 `pnpm --filter @advanced-elements/table typecheck` 确认无类型错误
- [ ] 运行 `pnpm --filter @advanced-elements/table test` 确认守卫测试全绿
