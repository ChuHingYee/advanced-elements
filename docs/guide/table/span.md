# 合并单元格

AdvTable 提供两种合并方式：声明式 `spanConfig`（推荐）与函数式 `spanMethod`（ElTable 兼容形态）。两种模式均支持行合并、列合并与范围合并。

## 方式一：spanMethod

与 ElTable 的 span-method 签名一致，返回 `{ rowspan, colspan }`：

:::demo 单元格合并 table/span.vue
:::

自定义合并函数返回 `undefined` 时回退到内部自动合并。

## 方式二：spanConfig（声明式）

```ts
:span-config="{
  // 行方向：按列 prop 合并相邻同值行；值为函数时自定义比较
  rows: { dept: true, role: (rowA, rowB) => rowA.role === rowB.role },
  // 列方向：同行相邻列合并
  cols: { name: true },
  // 矩形范围：{ row, col } 是左上角，rowspan / colspan 是尺寸
  ranges: [{ row: 0, col: 0, rowspan: 2, colspan: 2 }],
}"
```

超出表格边界的范围会被裁剪并派发 `TABLE_SPAN_LIMIT_EXCEEDED` 警告。

## 注意事项

- 合并区域内的被覆盖单元格仍存在于数据中，仅渲染层隐藏；编辑、导出取值不受影响
- 与虚拟模式组合时建议优先使用 `spanConfig`（内部有 SpanRow 快速通道）
- 排序/筛选导致数据重排后，基于索引的合并需自行重新计算；基于值的语义合并建议在 computed 中生成配置
- 与 `rowPinConfig` 已支持组合：合并统一索引域已落地，`spanMap` 建在剔除固定行后的 `unpinned` 数据顺序上，`ranges` 按 `unpinned` 顺序声明；pin 条带与 grand 合计行永不参与合并（换算落空即回退默认 `{1,1}`），可放心组合
- **virtual 模式下与动态行高（`estimatedRowHeight` / append 插槽 / 展开详情行）组合时，合并块高度按 `rowspan × rowHeight` 估算**，Element Plus 动态网格会裁切被扩展的起始单元格，视觉上不保证正确；该组合在开发期会触发告警。需要动态行高时请勿使用合并，或改用 default 模式
