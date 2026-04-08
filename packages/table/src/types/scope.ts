/**
 * <zh/> 数据范围模式——导出/打印/拦截的数据范围
 *
 * <zh/> - `all`：全量原始数据（不含筛选/搜索/排序）
 * <zh/> - `filtered`：筛选/搜索后的全量数据（分页前的所有匹配行，按当前显示顺序）
 * <zh/> - `current`：当前页可见数据
 * <zh/> - `selected`：当前选中行
 *
 * <en/> Data scope mode — data scope for export/print/interception
 *
 * <en/> - `all`: full raw data (without filter/search/sort)
 * <en/> - `filtered`: full data after filter/search (all matched rows before pagination, in current display order)
 * <en/> - `current`: currently visible page data
 * <en/> - `selected`: currently selected rows
 */
export type DataMode = 'all' | 'filtered' | 'current' | 'selected'

/**
 * <zh/> 列范围模式——导出/打印/拦截的列范围
 * <en/> Column scope mode — column scope for export/print/interception
 */
export type ColumnMode = 'visible' | 'all'
