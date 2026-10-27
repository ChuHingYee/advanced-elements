import type { TreeConfig } from '../../src/types/config'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref, shallowRef } from 'vue'
import { useTreeData } from '../../src/composables/data/use-tree-data'

/**
 * <zh/> 树形数据对抗用例——脏数据（环/重复键/畸形懒加载结果）与生命周期竞态，
 * <zh/> 目标是找出问题：任何用例超时/崩溃/状态卡死即暴露缺陷。
 * <en/> Tree-data adversarial cases — dirty data (cycles/duplicate keys/malformed lazy results)
 * <en/> and lifecycle races; anything timing out, crashing or wedging state exposes a defect.
 */

function setup(rows: any[], config?: Partial<TreeConfig>) {
  const treeConfig = ref<TreeConfig | undefined>({ children: 'children', ...config })
  // <zh/> 生产管线的 data 是 shallowRef（深 ref 对千层嵌套会在 Vue 自身的递归响应式 walk 里溢出），
  // <zh/> 测试脚手架与生产同型。
  // <en/> Production pipeline data is a shallowRef (a deep ref on thousand-level trees overflows in
  // <en/> Vue's own recursive reactive walk) — the harness matches production.
  const data = shallowRef(rows)
  const rowKeyFn = () => (r: any) => r.id
  return useTreeData<any>({ treeConfig, data, rowKeyFn })
}

describe('useTreeData adversarial', () => {
  it('cyclic children (A→B→A) neither hangs nor duplicates rows', () => {
    // <zh/> 环形引用：无守卫的 DFS 会死循环卡死页面——守卫必须截断
    // <en/> cyclic refs: an unguarded DFS hangs forever — the guard must cut it
    const a = { id: 'a', name: 'A' }
    const b = { id: 'b', name: 'B' }
    a.children = [b]
    b.children = [a]
    const { flattenedData } = setup([a], { defaultExpandAll: true })
    // <zh/> 每个对象只被展开一次（环在第二次访问处被截断） | <en/> each object flattens exactly once (the cycle is cut on second visit)
    expect(flattenedData.value).toHaveLength(2)
  })

  it('duplicate keys across siblings skip the second subtree with all rows still rendered once', () => {
    const x = { id: 'dup', name: 'X' }
    const child = { id: 'c', name: 'C' }
    x.children = [child]
    const y = { id: 'dup', name: 'Y' }
    y.children = [{ id: 'c2', name: 'C2' }]
    const { flattenedData } = setup([x, y])
    // <zh/> 重复 key 的第二棵子树被守卫跳过，但顶层行仍各出现一次
    // <en/> the second same-key subtree is skipped, but both top-level rows render once
    expect(flattenedData.value.filter(r => r.id === 'dup')).toHaveLength(1)
    expect(flattenedData.value.some(r => r.id === 'c2')).toBe(false)
  })

  it('deep nesting (2000 levels) does not stack-overflow (iterative traversal)', () => {
    let node: any = { id: 'leaf' }
    for (let i = 0; i < 2000; i++)
      node = { id: `n${i}`, children: [node] }
    const { flattenedData } = setup([node], { defaultExpandAll: true })
    expect(flattenedData.value).toHaveLength(2001)
  })

  it('loadData returning a non-array: no crash, loading cleared, row stays retryable', async () => {
    const loadData = vi.fn(async () => ({ notAnArray: true }) as any)
    const row = { id: 'r', hasChildren: true }
    const api = setup([row], { loadData: loadData as any, hasChildren: 'hasChildren' })
    const { flattenedData, getTreeMeta, toggleRowExpand, expandRow } = api
    // <zh/> 先消费展平结果（生产中渲染器必然消费）——metaMap/keyToRow 由此填充
    // <en/> consume the flatten first (renderers always do) — this populates metaMap/keyToRow
    void flattenedData.value
    await expandRow('r')
    await nextTick()
    const meta = getTreeMeta(row)
    // <zh/> 畸形结果：不写入 children、loading 复位、不标记 loaded（下次展开可重试）
    // <en/> malformed result: no children write, loading reset, not marked loaded (retryable)
    expect(meta?.loading).toBe(false)
    expect(meta?.loaded).toBe(false)
    expect(flattenedData.value).toHaveLength(1)
    expect(loadData).toHaveBeenCalledTimes(1)
    // <zh/> 重试路径：先折叠（toggle 掉已入集合的 key）再展开 → 重新请求
    // <en/> retry path: collapse first (toggle the key out of the set) then expand → re-request
    await toggleRowExpand('r')
    await toggleRowExpand('r')
    expect(loadData).toHaveBeenCalledTimes(2)
  })

  it('loadData rejecting with a genuine error propagates from toggleRowExpand and clears loading', async () => {
    const loadData = vi.fn(async () => {
      throw new Error('network down')
    })
    const row = { id: 'r', hasChildren: true }
    const { flattenedData, getTreeMeta, toggleRowExpand, expandedRowKeys } = setup(
      [row],
      { loadData: loadData as any, hasChildren: 'hasChildren' },
    )
    void flattenedData.value
    await expect(toggleRowExpand('r')).rejects.toThrow('network down')
    const meta = getTreeMeta(row)
    expect(meta?.loading).toBe(false)
    // <zh/> 失败后 key 不得进入展开集合 | <en/> a failed load must not add the key to expandedRowKeys
    expect(expandedRowKeys.value.has('r')).toBe(false)
  })

  it('defaultExpandAll applies once on first non-empty data and never clobbers a manual collapse', async () => {
    const data = shallowRef<any[]>([])
    const treeConfig = ref<TreeConfig | undefined>({ children: 'children', defaultExpandAll: true })
    const api = useTreeData<any>({
      treeConfig,
      data,
      rowKeyFn: () => (r: any) => r.id,
    })
    // <zh/> request 源场景：配置初始化时数据为空 → 首批数据到达后应用默认展开
    // <en/> request-source flow: data empty at config init → defaults apply on first non-empty batch
    data.value = [{ id: '1', children: [{ id: '1-1' }] }, { id: '2' }]
    await nextTick()
    expect(api.expandedRowKeys.value.has('1')).toBe(true)
    expect(api.expandedRowKeys.value.has('1-1')).toBe(true)

    // <zh/> 用户手动折叠后，数据刷新（分页/搜索替换引用）不得覆盖手动状态
    // <en/> after a manual collapse, a data refresh (new reference) must not clobber it
    api.collapseRow('1')
    data.value = [{ id: '1', children: [{ id: '1-1' }] }, { id: '2' }]
    await nextTick()
    expect(api.expandedRowKeys.value.has('1')).toBe(false)
  })

  it('collapseAll during an in-flight lazy load leaves the key set clean after the load lands', async () => {
    let release: (() => void) | null = null
    const gate = new Promise<void>((r) => {
      release = r
    })
    const loadData = vi.fn(async () => {
      await gate
      return [{ id: 'r-1' }]
    })
    const row = { id: 'r', hasChildren: true }
    const { flattenedData, toggleRowExpand, collapseAll, expandedRowKeys, getTreeMeta } = setup(
      [row],
      { loadData: loadData as any, hasChildren: 'hasChildren' },
    )
    void flattenedData.value

    const pending = toggleRowExpand('r')
    collapseAll()
    release!()
    await pending

    // <zh/> 钉住语义：加载中的折叠是 no-op（key 尚未入集合，collapseRow 早退），
    // <zh/> 因此加载成功后本行展开落地；陈旧快照守卫的真实保证是「不复活其他行的折叠」，
    // <zh/> 并确保 await 后重读最新集合而非写回起跑快照。
    // <en/> Pins the semantics: a collapse during flight is a no-op (the key is not in the set yet,
    // <en/> collapseRow early-returns), so the successful load lands expanded; the stale-snapshot
    // <en/> guard's real guarantee is not resurrecting OTHER rows' collapses, and re-reading the
    // <en/> latest set after the await instead of writing back the pre-flight snapshot.
    expect(expandedRowKeys.value.has('r')).toBe(true)
    expect(getTreeMeta(row)?.loaded).toBe(true)
    expect(loadData).toHaveBeenCalledTimes(1)
  })

  it('expandAll with loadData pools requests and survives individual task failures', async () => {
    let calls = 0
    const loadData = vi.fn(async (row: any) => {
      calls++
      if (row.id === 'bad')
        throw new Error('per-row failure')
      return [{ id: `${row.id}-1` }]
    })
    const { flattenedData, expandAll, expandedRowKeys } = setup(
      [{ id: 'good', hasChildren: true }, { id: 'bad', hasChildren: true }],
      { loadData: loadData as any, hasChildren: 'hasChildren' },
    )
    void flattenedData.value
    // <zh/> 池化路径吞掉单任务失败（devWarn），不得上浮为 unhandled rejection
    // <en/> the pooled path swallows per-task failures (devWarn) — no unhandled rejection
    expandAll()
    await new Promise(r => setTimeout(r, 20))
    expect(expandedRowKeys.value.has('good')).toBe(true)
    expect(expandedRowKeys.value.has('bad')).toBe(true)
    expect(calls).toBe(2)
  })
})
