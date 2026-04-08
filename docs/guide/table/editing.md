# 编辑：四种模式

AdvTable 通过 `editConfig.editType` 提供四种互斥的编辑模式。所有模式共享同一套校验、拦截器、撤销栈与结构化事件。

| editType | 数据写入 | 关键事件 | 提交 API | 取消 API |
|---|---|---|---|---|
| `undefined`（单格） | 直接写入 | `cellValueChanged` | `commitEditing()` | `cancelEditing()` |
| `'fullRow'` | 整行一次写入 | `fullRowEdit` | `commitEditing()` | `cancelEditing()` |
| `'batch'` | 缓冲区，提交时统一落库 | `batchPendingChange` | `commitBatchEdit()` | `cancelBatchEdit()` |
| `'readOnly'` | 不写入，仅通知 | `cellEditingRequest` | — | — |

## 基础配置

:::demo 单元格编辑 table/cell-editing.vue
:::

```ts
const columns = [
  { prop: 'name', label: '名称', editable: true, cellEditor: 'text' },
  // 未指定 cellEditor 时按 valueType 自动推断
  { prop: 'age', label: '年龄', editable: true, valueType: 'digit' },
]
```

`editConfig` 常用项：

| 配置 | 说明 |
|---|---|
| `editType` | `'fullRow'` 整行编辑 / `'batch'` 批量暂存 / `'readOnly'` 只读；不传为单格编辑 |
| `singleClickEdit` | `true` 单击进入编辑（默认双击） |
| `enableCellEditingOnF2` | F2 进入编辑 |
| `invalidEditValueMode` | 校验失败行为：`revert` / `block` / `notify` |
| `undoMaxStackSize` | 撤销栈深度（默认 50） |

> 数据更新必须换引用（A4）：`data.push/splice` 等同引用原地 mutation 不在支持范围内，
> 校验 `await` 窗口内命中即按数据变更取消会话（防御性兜底），请始终传入新数组。

## 校验

- **单元格级**：列配置 `editorRules`，失败行为由 `invalidEditValueMode` 决定
- **跨字段**：`editConfig.crossFieldValidator`（仅 fullRow 模式生效）
- 校验失败派发结构化错误 `TABLE_EDIT_VALIDATION_FAILED`

## 悲观保存 saveCells（v2.2+）

```ts
const result = await api.saveCells(
  [{ rowIndex: 0, prop: 'name', columnKey: 'name', value: 'Alice2' }],
  {
    persist: async ({ changes, newData }) => {
      await fetch('/api/save', { method: 'POST', body: JSON.stringify(changes) })
      // reject 或 resolve(false) → 自动回滚并派发 TABLE_EDIT_ROLLBACK
    },
  },
)
// result: { applied: CellChangeRecord[], rejected: CommitRejectedRecord[] }
// rejected[].reason: 'interceptor' | 'setter-rejected' | 'validation' | 'persist-failed'
```

也可在 `editConfig.onPersist` 配置全局持久化钩子；未提供时退化为乐观直通。

## 结果对象 CommitResult

`commitEditing` / `batchCommitCells` / `saveCells` 均返回 `{ applied, rejected }`。`rejected` 收录三类拒绝：拦截器否决、setter 拒写（valueSetter 返回 false）、校验失败——调用方可据此感知部分成功并自行补偿。

## 撤销栈

- `enableUndo` 开启后，每次成功提交自动入栈
- `undoFailureStrategy`: `'skip'`（默认，跳过失效条目继续）| `'block'`（保留并中止）
