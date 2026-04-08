/**
 * @file column-group-helpers.ts
 * @description
 * <zh/> 列组编排的模块级纯函数——结构签名与列树的不可变操作。
 *
 * <zh/> 从 `composables/columns/use-column-group.ts` 抽出：该文件的职责是"编排"（响应式状态 +
 * <zh/> 分组 CRUD + 与 localColumns 同步），而这些是不依赖任何响应式状态的纯函数，
 * <zh/> 混在一起会持续推高编排文件体积（见 `check:hook-size`）。与本库既有的
 * <zh/> `utils/column-setting-helpers.ts`（自 `use-column-setting.ts` 抽出）保持同一拆分口径。
 *
 * <en/> Module-level pure helpers for column-group orchestration — structural signatures and
 * <en/> immutable column-tree operations.
 *
 * <en/> Extracted from `composables/columns/use-column-group.ts`: that file's job is orchestration
 * <en/> (reactive state + group CRUD + localColumns sync), whereas these are pure functions touching no
 * <en/> reactive state; keeping them together kept inflating the orchestration file (see `check:hook-size`).
 * <en/> Same extraction caliber as the existing `utils/column-setting-helpers.ts`
 * <en/> (extracted from `use-column-setting.ts`).
 */
import type { ProcessedColumn } from '../types/column'
import { getColumnKey, isGroupColumn } from './shared'

/**
 * <zh/> 生成结构签名字符串，用于 isDirty 判断
 * <en/> Generate structure signature string for isDirty check
 * @remarks
 * <zh/> 仅比较 key + children 结构，忽略无关属性变更
 * <en/> Only compares key + children structure, ignores irrelevant property changes
 */
export function buildStructureSignature(cols: ProcessedColumn[]): string {
  return cols.map((col) => {
    const key = getColumnKey(col)
    if (isGroupColumn(col) && col.children?.length) {
      return `${key}[${buildStructureSignature(col.children!)}]`
    }
    return key
  }).join(',')
}

/**
 * <zh/> **结构克隆**列树——逐节点 `{ ...col }` 浅拷字段，仅 `children` 递归克隆。
 * <zh/> **共享边界**：除 `children` 外字段均与新树共享引用，故顶层字段赋值 / 替换节点是隔离的，
 * <zh/> 而**就地修改嵌套字段（如 `col.fieldProps.x`）会穿透回 `localColumns`**。调用方一律应采用不可变
 * <zh/> 更新（见本文件 `removeColumnByKey` / `replaceColumnByKey`）——保证隔离的是这条纪律，而非克隆深度。
 * <zh/> 为何不深拷贝：见 `use-columns.ts` 中 `deepCloneColumnTree` 的 `@remarks`。
 *
 * <en/> **Structural clone** — per-node `{ ...col }` shallow copy; only `children` recurses.
 * <en/> **Sharing boundary**: every field except `children` is shared by reference, so top-level assignment
 * <en/> and node replacement are isolated, whereas **in-place nested mutation (e.g. `col.fieldProps.x`)
 * <en/> writes through to `localColumns`**. Callers must use immutable updates (see `removeColumnByKey` /
 * <en/> `replaceColumnByKey` in this file) — that discipline, not the clone's depth, guarantees isolation.
 * <en/> Why not deep-clone: see the `@remarks` of `deepCloneColumnTree` in `use-columns.ts`.
 */
export function cloneColumnTree(cols: ProcessedColumn[]): ProcessedColumn[] {
  return cols.map((col) => {
    const cloned: ProcessedColumn = { ...col }
    if (isGroupColumn(col) && col.children?.length) {
      cloned.children = cloneColumnTree(col.children!)
    }
    return cloned
  })
}

/**
 * <zh/> 递归删除指定 key 的列节点
 * <en/> Recursively delete a column node by key
 * @returns <zh/> 新树（不可变更新） | <en/> new tree (immutable update)
 */
export function removeColumnByKey(cols: ProcessedColumn[], targetKey: string): ProcessedColumn[] {
  return cols
    .filter((col) => {
      if (getColumnKey(col) === targetKey)
        return false
      return true
    })
    .map((col) => {
      if (isGroupColumn(col) && col.children?.length) {
        const newChildren = removeColumnByKey(col.children!, targetKey)
        return newChildren !== col.children ? { ...col, children: newChildren } : col
      }
      return col
    })
}

/**
 * <zh/> 递归替换指定 key 的列节点
 * @returns <zh/> 新树（不可变更新） | <en/> new tree (immutable update)
 * <en/> Recursively replace column node with specified key
 *
 * @remarks
 * <zh/> 与 `utils/column-setting-helpers.updateColumnByKey` **语义不同、不可互换**：
 * <zh/> 本函数只要 key 命中就返回新数组（不比较 `updater` 的返回值引用），
 * <zh/> 而 `updateColumnByKey` 在 `updater` 返回同一引用时返回入参数组本身。
 * <zh/> 二者不可合并——合并会改变其中一方的引用稳定性与重渲染行为。
 * <en/> Semantically **different from and not interchangeable with** `updateColumnByKey` in
 * <en/> `utils/column-setting-helpers`: this returns a new array as soon as the key matches (it does not
 * <en/> compare the `updater` result reference), whereas `updateColumnByKey` returns the input array
 * <en/> itself when `updater` returns the same reference. They must not be merged — merging would change
 * <en/> one side's reference stability and re-render behaviour.
 */
export function replaceColumnByKey(
  cols: ProcessedColumn[],
  targetKey: string,
  updater: (col: ProcessedColumn) => ProcessedColumn,
): ProcessedColumn[] {
  let changed = false
  const result = cols.map((col) => {
    if (getColumnKey(col) === targetKey) {
      changed = true
      return updater(col)
    }
    if (isGroupColumn(col) && col.children?.length) {
      const newChildren = replaceColumnByKey(col.children!, targetKey, updater)
      if (newChildren !== col.children) {
        changed = true
        return { ...col, children: newChildren }
      }
    }
    return col
  })
  return changed ? result : cols
}
