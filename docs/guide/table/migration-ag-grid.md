# AG Grid → AdvTable 迁移指南

> 本指南面向从 **AG Grid** 迁移至 **AdvTable**（Element Plus 二次封装）的团队，覆盖核心概念映射、API 差异与最小改动路径。AdvTable 对标 AG Grid 企业级能力，同时保留 Element Plus `el-table` 生态。

---

## 一、核心理念映射

| AG Grid 概念 | AdvTable 对应 | 说明 |
|---|---|---|
| `GridOptions` | `AdvTableProps<T>` | 统一 `props` 配置驱动，`columns` + `data`/`request` 双数据源 |
| `ColDef` | `AdvColumn<T>` | 支持 `valueType` 30+（`text/money/date/select/sparkline`）、`valueGetter/valueSetter/valueParser`、`cellRenderer/cellComponent` |
| `RowData` | `T` 泛型行数据 | `T = any`（与 `ElTable`/`AG Grid` 一致），`rowKey` 经 `normalizeRowKey` 归一化 |
| `GridApi` | `TableExpose<T>`（`ref.value`） | `useTableApi` 聚合 14 域，`defineExpose` 暴露 |
| `columnApi` | `getColumnState/applyColumnState` | 列显隐/宽/序/排序持久化，经 `AdvTableStorageAdapter` |
| `getRowId` | `rowKey` / `rowConfig.rowKey` | `string \| (row:T)=>string`，`AUTO_KEY_NAME` 二级缓存 |

---

## 二、列定义迁移

### AG Grid
```js
const columnDefs = [
  { field: 'name', headerName: '姓名', sortable: true, filter: 'agTextColumnFilter', editable: true, valueGetter: p=>p.data.name },
  { field: 'age', headerName: '年龄', valueFormatter: p=>`${p.value}岁` },
]
```

### AdvTable
```vue
<script setup lang="ts">
const columns: AdvColumn<User>[] = [
  { prop: 'name', label: '姓名', sortable: true, filter: 'text', editable: true, valueGetter: ({row})=>row.name },
  { prop: 'age', label: '年龄', format: ({cellData})=>`${cellData}岁` },
]
</script>
<template><AdvTable :columns="columns" :data="data" /></template>
```

**差异要点**
- `field` → `prop`（`key` 可选，`ensureColumnIds` 自动补 `__advTableColumnId`）
- `headerName` → `label` / `title`
- `valueFormatter` → `format`（`FormatContext`）或 `cellRenderer`
- `filter: 'agTextColumnFilter'` → `filter: 'text'|'number'|'date'|'enum'` 或 `filterValue` 自定义
- `sortable: true` → `sortable: true`（`sortBy/sortMethod/sortByFormat` 同 AG Grid）

---

## 三、数据与管线

| AG Grid | AdvTable |
|---|---|
| `rowData` | `:data="T[]"`（本地） |
| `datasource.getRows`（`serverSide`） | `:request="{ source: (params, signal)=>Promise<{data,total}> }"` + `pagination.mode` |
| `quickFilterText` | `v-model:quickFilter` |
| `isExternalFilterPresent / doesExternalFilterPass` | `:externalFilter="{ isExternalFilterPresent, doesExternalFilterPass }"`（管线 `columnFilter→quickFilter→externalFilter→sort`） |
| `applyTransaction({add,update,remove})` | `api.applyTransaction({add,update,remove})`（`beforeDataChange` 可否决） |

---

## 四、排序/筛选/选择

| 能力 | AG Grid | AdvTable |
|---|---|---|
| 多列排序 | `multiSortKey: 'ctrl'` | `sortConfig.maxSortColumns` + `Shift+Click`，`use-column-sort` Worker 阈值 5000 |
| 列筛选 | `filter: 'agNumberColumnFilter'` | `filter: 'number'` + `floatingFilter` + `FilterPanel` |
| 选择 | `rowSelection: 'multiple'` | `rowConfig.rowSelection: 'multiple'/'single'` + `selectedRowKeys` + `selectable` 谓词；`getSelectedRows()` |
| 范围选择 | `enableRangeSelection` | `rangeSelection: true` + `use-cell-range-selection`（`Ctrl/Cmd` 拖选） |

---

## 五、编辑

| AG Grid | AdvTable |
|---|---|
| `editable: true` + `cellEditor` | `editable: true` + `cellEditor: 'input'|'select'|Component` + `cellEditorParams` |
| `onCellValueChanged` | `onCellValueChanged`（列级+表级）+ `interceptor: { 'edit.commit': ()=>boolean }` |
| `undo/redo` | `api.undo()/redo()` `canUndo/canRedo` |
| 校验 | `editorRules`（`async-validator`）+ `crossFieldValidator` |

---

## 六、虚拟滚动与渲染

| AG Grid | AdvTable |
|---|---|
| `rowModelType: 'infinite'` | `mode="virtual"`（`ElTableV2`）`height`/`rowHeight`/`cache` 透传，`ROW_KEY_FALLBACK_LIMIT 100k` 窗口降级 |
| `getRowHeight` | `estimatedRowHeight`（`append`/`expandRow` 时切 `DynamicSizeGrid`） |

---

## 七、导出/打印

| AG Grid | AdvTable |
|---|---|
| `api.exportDataAsCsv()` | `api.exportCsv()` / `api.exportExcel({ freezePane, merges })`（`xlsx` 可选，`!freeze`/`!merges`） |
| `api.print()` | `api.print()` |

---

## 八、最小迁移清单

- [ ] `field → prop`，`headerName → label`
- [ ] `valueGetter/valueSetter/valueParser` 签名对齐 `ValueGetterParams/ValueSetterParams`
- [ ] `onGridReady` → `@grid-ready` + `ref<TableExpose>` 调用 `api.*`
- [ ] `rowSelection` → `rowConfig.rowSelection` + `selectedRowKeys`
- [ ] `getRowId` → `rowKey`
- [ ] `quickFilterText` → `v-model:quickFilter`
- [ ] 运行 `pnpm --filter @advanced-elements/table typecheck && pnpm --filter @advanced-elements/table test` 守卫全绿

---

## 九、已知差异（非缺陷）

- 合成行（`DetailRow`/`GroupHeader`）计入分页容量（`prePaginationGroupedData`→`visibleData`），`pagination.total` 仍以全量 `tableData.length` 为准，需业务侧 `pagination.total` 覆盖
- `span×dynamic`（`append`/`expandRow`）与合并单元格互斥，仅 `devWarn`（`src/composables/data/use-cell-span.ts:212`）
- RTL 需宿主 `dir="rtl"`，样式经 `src/style/rtl.scss:1` 逻辑属性覆盖
