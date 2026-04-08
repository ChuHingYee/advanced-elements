# 范围选择与剪贴板

Excel 风格的单元格范围选择，配合剪贴板实现复制 / 剪切 / 粘贴闭环。

## 启用

:::demo 范围选择 table/range-selection.vue
:::

也可以用简写 `true` 等价于 `{ enabled: true }`。

| 配置 | 说明 |
|---|---|
| `enabled` | 是否启用范围选择（启用后绑定鼠标拖拽监听） |
| `autoCopy` | 松开鼠标后自动复制选区为 TSV |

## 交互

- **拖拽**：按住鼠标左键拖出矩形选区，选区内单元格高亮
- **复制**：`Ctrl+C`（或 `autoCopy`）将选区序列化为 TSV 文本写入剪贴板
- **剪切**：`Ctrl+X` 清空选区数据并复制原值（走编辑管线，触发校验/拦截器）
- **粘贴**：`Ctrl+V` 从焦点单元格起铺 TSV 数据，逐格写入并进入编辑校验管线

## 事件与 API

```ts
// 选区完成事件
'@cell-range-selected'="(selection) => {
  selection.range   // { startRow, endRow, startCol, endCol }
  selection.rows    // 选中的行数据数组
  selection.tsv     // TSV 文本
}"

// 上下文暴露的 API
ctx.rangeSelection.isCellSelected(rowIndex, colIndex)  // 装饰态查询（渲染层已内置）
```

## 与编辑联动

- 粘贴写入复用批量提交管线：仅触发一次 `onDataUpdate`，每格派发 `cellValueChanged` 并入撤销栈
- 只读列 / 不可编辑单元格在粘贴时被跳过
- 校验失败的单元格计入失败集合，不影响其余格子落地

## 注意事项

- 范围坐标使用**可见区域索引域**（含 selection 列偏移），与 RowViewModel 装饰态一致
- `autoCopy` 依赖浏览器 Clipboard 权限；被拒绝时派发错误事件且不影响选区
