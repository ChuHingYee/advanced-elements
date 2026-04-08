# Event Subscription Guide | 事件订阅选型表

> 单次用户行为会连发多个事件——**只订自己需要的**，三者全订付三倍 handler 成本。

## 1. 选择三连发

一次行切换连发 `selectionChange` + `select` + `rowSelected`（另有 `selectAll`）：

| 只关心 | 订阅 | 载荷 |
|---|---|---|
| 结果集 | `selectionChange` | 全量选中行 `T[]` |
| 触发行 | `select` / `rowSelected` | `{ selection, row }` / `{ row, selected }` |
| 全选 | `selectAll` | 全量选中行 `T[]` |

## 2. 事务三连发

一次事务连发 `beforeDataChange` → `dataChange` → `afterDataChange`：

| 只关心 | 订阅 | 说明 |
|---|---|---|
| 拦截中止 | `beforeDataChange` | 返回 `false` 中止；持新旧双全量数组 |
| 结果 | `dataChange` | 仅新数据 |
| 落定后副作用 | `afterDataChange` | nextTick 后，审计/同步用 |

大数据事务降内存峰值：`executeTransaction(reason, oldData, newData, writeFn, { silentMiddle: true })` 跳过 before/after，仅发 `dataChange`——同时放弃拦截能力，按需使用。

## 3. 全行编辑 1+N

一次全行提交发 1 个 `fullRowEdit` + N 个 `cellValueChanged`：行级汇总订前者，单格联动订后者，不要双订全量。

## 4. expose 内外部

`tableSearchRef` / `importing` / `batchPendingChanges` 标"内部"：前两者只读，`batchPendingChanges` 直接改写绕过校验，外部编排走 `commitBatchEdit` / `cancelBatchEdit`。
