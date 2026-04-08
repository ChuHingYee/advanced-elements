import { describe, expect, it } from 'vitest'
import {
  EL_TABLE_DISABLED_TREE_PROPS,
  EL_TABLE_TREE_DISABLED_KEY,
} from '../../../src/components/renderer-core/el-table-tree-isolation'
import { mountTable } from '../__harness__/mount-table'

/**
 * <zh/> ElTable 内建树形隔离的升级守护测试。
 *
 * <zh/> 不变量：**本库自行展平树形，ElTable 的内建树形必须保持惰性**。
 * <zh/> EP 内建树形由 `store/tree.mjs` 的 `walkTreeNode(data, …, childrenColumnName, …)` 驱动，
 * <zh/> 只要 `row-key` 存在即执行（`normalizedData` 的守卫仅为 `if (!watcherData.rowKey.value) return {}`）。
 * <zh/> 命中时 EP 会追加 `el-table__row--level-N` 行类并对 children 做选择级联（与本库自身的树级联重复）。
 *
 * <zh/> 因此断言两件事：
 * <zh/> 1. 隔离常量的**契约**（命名空间化的不存在键、冻结的稳定引用）；
 * <zh/> 2. 真实挂载一份带 `children` 的树形数据后，EP **未**产出 `--level-` 行类——即隔离在当前 EP 版本下生效。
 *
 * <en/> EP upgrade guard for ElTable's built-in tree isolation.
 *
 * <en/> Invariant: **this library flattens tree data itself, so ElTable's built-in tree must stay inert**.
 * <en/> EP's built-in tree is driven by `store/tree.mjs`'s `walkTreeNode(data, …, childrenColumnName, …)`
 * <en/> and runs whenever `row-key` is present (`normalizedData` is guarded only by
 * <en/> `if (!watcherData.rowKey.value) return {}`). When it matches, EP appends `el-table__row--level-N`
 * <en/> row classes and cascades selection through children, duplicating this library's own cascade.
 *
 * <en/> Two things are asserted:
 * <en/> 1. The isolation constant's **contract** (namespaced non-existent keys, frozen stable reference).
 * <en/> 2. After really mounting tree data carrying `children`, EP produces **no** `--level-` row class —
 * <en/>    i.e. the isolation is effective on the current EP version.
 */
describe('elTable built-in tree isolation', () => {
  it('exposes a namespaced, non-colliding, frozen key pair', () => {
    expect(EL_TABLE_TREE_DISABLED_KEY).not.toBe('children')
    expect(EL_TABLE_TREE_DISABLED_KEY).not.toBe('hasChildren')
    expect(EL_TABLE_TREE_DISABLED_KEY.startsWith('__adv_table')).toBe(true)

    expect(EL_TABLE_DISABLED_TREE_PROPS.children).toBe(EL_TABLE_TREE_DISABLED_KEY)
    expect(EL_TABLE_DISABLED_TREE_PROPS.hasChildren).toBe(EL_TABLE_TREE_DISABLED_KEY)
    // <zh/> 冻结以保证引用稳定（避免每次渲染新建对象触发 ElTable 侧 props watcher）
    // <en/> Frozen for reference stability (no per-render object churn triggering ElTable's prop watchers)
    expect(Object.isFrozen(EL_TABLE_DISABLED_TREE_PROPS)).toBe(true)
  })

  it('keeps ElTable built-in tree inert under real tree data', async () => {
    const { wrapper } = await mountTable({
      mode: 'default',
      columns: [
        { prop: 'id', label: 'ID', hidden: false },
        { prop: 'name', label: '名称', hidden: false },
      ] as any,
      data: [
        { id: 'p1', name: 'Parent', children: [{ id: 'c1', name: 'Child' }] },
      ] as any,
      props: { treeConfig: { children: 'children' } },
    })

    const html = wrapper.html()
    /**
     * <zh/> EP 内建树形命中时会追加 `${ns}-table__row--level-N`（见 EP `table-body/render-helper.mjs`
     * <zh/> 的 `rowClasses.push(ns.em("row", \`level-${treeRowData.level}\`))`）。
     * <en/> When EP's built-in tree matches it appends `${ns}-table__row--level-N` (see EP's
     * <en/> `table-body/render-helper.mjs`: `rowClasses.push(ns.em("row", \`level-${treeRowData.level}\`))`).
     */
    expect(html).not.toMatch(/--level-\d/)

    // <zh/> 行仍正常渲染（隔离不误伤数据）
    // <en/> Rows still render normally (the isolation must not affect data)
    expect(wrapper.find('[data-adv-table-row-key]').exists()).toBe(true)
  })
})
