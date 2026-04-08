import { describe, expect, it } from 'vitest'
import { computed, effectScope } from 'vue'
import { useDefaultGrand } from '../../../src/components/table-renderer/use-default-grand'
import { useV2GrandTotal } from '../../../src/components/table-virtual-renderer/use-v2-grand-total'

/**
 * <zh/> 汇总双模式对拍：同一输入下 default 与 virtual 的 Grand 合成行必须一致。
 * <zh/> 只对拍"算什么"（Grand 合成行对象），不对拍"画在哪"（pinnedDisplayData 交错拼接
 * <zh/> vs dataWithAppend/footer 条带/高度换算属呈现层，已知按模式分化）。
 * <zh/> 排除项（已知口径差，不在本文件覆盖）：getValue 列、大数据首帧异步聚合。
 * <zh/> `property` 别名列**已纳入覆盖**：两侧聚合列归一均走 resolveColumnProp（历史差异见
 * <zh/> use-grand-total-core 头注），该漏洞此前正是靠"排除"掩盖的。
 * <en/> Summary cross-mode parity: default and virtual grand synthetic rows must match
 * <en/> for identical inputs. Only the computed grand row is compared, not presentation
 * <en/> splicing (pinnedDisplayData interleave vs dataWithAppend/footer strips/height math
 * <en/> diverge by design). Excluded known divergences: getValue columns and big-data async
 * <en/> first-frame aggregates. `property`-alias columns **are now covered**: both sides normalize
 * <en/> via resolveColumnProp (see the use-grand-total-core header note); that gap was previously
 * <en/> masked precisely by listing it here as an exclusion.
 */
describe('summary parity: default vs virtual grand row', () => {
  const rows = [
    { name: 'a', qty: 2, price: 10 },
    { name: 'b', qty: 4, price: 20 },
    { name: 'c', qty: 6, price: 30 },
  ]
  const cols = [
    { prop: 'name' },
    { prop: 'qty', aggFunc: 'sum' },
    { prop: 'price', aggFunc: 'avg' },
  ]

  function runBoth(overrides: Record<string, unknown> = {}) {
    const scope = effectScope()
    try {
      const base = {
        data: rows,
        summaryData: rows,
        grandTotalRow: 'bottom',
        suppressStickyTotalRow: true,
        sumText: '合计',
        ...overrides,
      }
      const grand = scope.run(() => useDefaultGrand({
        props: { ...base, leafColumns: cols } as any,
        rowPinApi: undefined,
      }))!
      const total = scope.run(() => useV2GrandTotal({
        props: { ...base, selectionColumns: [], normalColumns: cols } as any,
        topPinnedRows: computed(() => []),
        bottomPinnedRows: computed(() => []),
        hasAppendSlot: computed(() => false),
        appendRowData: null,
        t: () => undefined,
      }))!
      const findGrand = (data: any[]) => data.find(row => row?.__grandPosition === 'bottom')
      return {
        defaultGrand: findGrand(grand.pinnedDisplayData.value),
        virtualGrand: findGrand(total.dataWithAppend.value),
      }
    }
    finally {
      scope.stop()
    }
  }

  it('produces identical grand rows for bottom non-sticky totals', () => {
    const { defaultGrand, virtualGrand } = runBoth()
    expect(defaultGrand).toBeDefined()
    expect(virtualGrand).toBeDefined()
    // <zh/> 口径锁：双侧相等 | <en/> Caliber lock: both sides equal
    expect(virtualGrand).toEqual(defaultGrand)
    // <zh/> 取值锁：防止"错得一致"——qty 求和 12，price 求均 20，首 prop 列被合计标签覆盖
    // <en/> Value lock: guards against "equally wrong" — qty sums to 12, price averages to 20,
    // <en/> first prop column overwritten by the total label
    expect(defaultGrand.qty).toBe(12)
    expect(defaultGrand.price).toBe(20)
    expect(defaultGrand.name).toBe('合计')
  })

  it('produces no grand row on either side when totals are disabled', () => {
    const { defaultGrand, virtualGrand } = runBoth({
      grandTotalRow: undefined,
      showSummary: false,
    } as any)
    expect(defaultGrand).toBeUndefined()
    expect(virtualGrand).toBeUndefined()
  })

  it('aggregates property-aliased columns identically in both modes', () => {
    // <zh/> 回归锁：virtual 侧曾直取 col.prop，property 别名列在 virtual 下漏聚合（同一份 columns
    // <zh/> 两种模式给出不同合计值）。现两侧均走 resolveColumnProp。
    // <en/> Regression lock: virtual read col.prop directly, so a property-aliased column was
    // <en/> skipped in virtual mode (identical columns → different totals per mode). Both sides
    // <en/> now go through resolveColumnProp.
    const aliasCols = [
      { prop: 'name' },
      { prop: 'qty', aggFunc: 'sum' },
      { property: 'price', aggFunc: 'avg' },
    ]
    const { defaultGrand, virtualGrand } = runBoth({
      leafColumns: aliasCols,
      normalColumns: aliasCols,
    } as any)

    expect(defaultGrand).toBeDefined()
    expect(virtualGrand).toBeDefined()
    // <zh/> 口径锁：双侧相等 + 别名列确有聚合值（20 = 60/3）
    // <en/> Caliber lock: both sides equal AND the aliased column really aggregates (20 = 60/3)
    expect(virtualGrand).toEqual(defaultGrand)
    expect(defaultGrand.price).toBe(20)
    expect(virtualGrand.price).toBe(20)
  })

  it('falls back to the default label when sumText is an empty string in both modes', () => {
    // <zh/> 回归锁：virtual 侧曾用 `??`，空串被当作"已配置"从而吞掉默认标签；default 侧 `||` 正常。
    // <en/> Regression lock: virtual used `??`, so an empty string counted as "configured" and
    // <en/> swallowed the default label; default's `||` behaved correctly.
    const { defaultGrand, virtualGrand } = runBoth({ sumText: '' } as any)

    expect(defaultGrand).toBeDefined()
    expect(virtualGrand).toBeDefined()
    expect(virtualGrand).toEqual(defaultGrand)
    expect(defaultGrand.name).toBe('合计')
  })
})
