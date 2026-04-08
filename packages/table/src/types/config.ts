/**
 * <zh/> 表格配置类型与 InjectionKey 桶文件。
 *
 * <zh/> 原始内容已拆分为：
 * <zh/> - `config-api.ts` — 运行时上下文与注入 API 类型（TableContext、TableEditApi 等）
 * <zh/> - `config-tree.ts` — 树形 / 行分组 / 展开行 / 表头分组类型
 * <zh/> - `config-column-setting.ts` — 列设置面板通信契约
 * <zh/> - `config-toolbar.ts` — 工具栏 / 导入导出 / 打印 / 分页类型
 * <zh/> - `config-options.ts` — 表格业务配置（Search/Column/Row/Filter/Ui 等）
 * <zh/> - `injection-keys.ts` — 所有 InjectionKey Symbol 声明（运行时值）
 * <zh/> 此文件为配置域正式桶入口：`import ... from './config'` 为规范导入路径。
 *
 * <en/> Table configuration types and InjectionKey barrel file.
 * <en/> Original content has been split into:
 * <en/> - `config-api.ts` — runtime context & injected API types (TableContext, TableEditApi, etc.)
 * <en/> - `config-tree.ts` — tree / row group / expand row / column group types
 * <en/> - `config-column-setting.ts` — column setting panel communication contracts
 * <en/> - `config-toolbar.ts` — toolbar / import-export / print / pagination types
 * <en/> - `config-options.ts` — table business configs (Search/Column/Row/Filter/Ui, etc.)
 * <en/> - `injection-keys.ts` — all InjectionKey Symbol declarations (runtime values)
 * <en/> This file is the canonical barrel entry: `import ... from './config'` is the standard import path.
 */
export * from './config-api'
export * from './config-column-setting'
export * from './config-options'
export * from './config-toolbar'
export * from './config-tree'
export * from './injection-keys'
