import type { AdvColumn } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { useColumns } from '../../src/composables/columns/use-columns'

/**
 * <zh/> 回归：defaultColDef/columnTypes 以 getter 传入时必须生效且保持响应式。
 * <zh/> 缺陷背景：useColumns 内部曾对二者直接对象展开，未做 toValue，
 * <zh/> 导致调用方（列编排器转交合并配置）的 getter 被静默丢弃，全局列默认值从未生效。
 * <en/> Regression: defaultColDef/columnTypes passed as getters must apply and stay reactive.
 * <en/> Background: useColumns once spread them without toValue, silently dropping
 * <en/> the getters forwarded by the columns orchestrator — global column defaults never applied.
 */
describe('useColumns defaultColDef/columnTypes wiring', () => {
  it('applies a reactive defaultColDef getter', async () => {
    const def = ref({ sortable: true })
    const result = useColumns(
      {
        columns: [{ prop: 'name', label: 'Name' } as AdvColumn],
        defaultColDef: () => def.value,
      },
      () => {},
    )
    expect(result.localColumns.value[0].sortable).toBe(true)
    def.value = { sortable: false }
    await nextTick()
    expect(result.localColumns.value[0].sortable).toBe(false)
  })

  it('applies columnTypes presets by column type', () => {
    const result = useColumns(
      {
        columns: [{ prop: 'name', label: 'Name', type: 'foo' } as unknown as AdvColumn],
        columnTypes: () => ({ foo: { width: 123 } }),
      },
      () => {},
    )
    expect(result.localColumns.value[0].width).toBe(123)
  })
})
