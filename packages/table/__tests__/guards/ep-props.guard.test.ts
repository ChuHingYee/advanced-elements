import { ElTable, ElTableV2 } from 'element-plus'
import { describe, expect, it } from 'vitest'
import { EXPLICITLY_BOUND as DEFAULT_EXPLICITLY_BOUND } from '../../src/components/table-renderer/use-table-renderer'
import { EXPLICITLY_BOUND as VIRTUAL_EXPLICITLY_BOUND } from '../../src/components/table-virtual-renderer/use-virtual-renderer'

/**
 * <zh/> EP props 守卫——白名单任一条目必须真实存在于对应 EP 组件的 props，否则为幻觉键（行为中性但注释撒谎，修白名单即可）。
 * <zh/> EP 升级后新增的 prop 不会自动进白名单（快照透传），此处不fail；在 EP-UPGRADE-CHECKLIST 登记 triage。
 * <en/> EP props guard — every allowlist entry must really exist in the matching EP component's props;
 * <en/> ghost keys are behavior-neutral but lie in comments, so fix the list. New EP props never auto-enter
 * <en/> the list (snapshot passthrough); triage them via EP-UPGRADE-CHECKLIST, no failure here.
 */

function ghostKeys(bound: Set<string>, epProps: Record<string, unknown>): string[] {
  return [...bound].filter(key => !(key in (epProps ?? {})))
}

describe('ep-props guard', () => {
  it('default EXPLICITLY_BOUND keys all exist in ElTable.props', () => {
    const ghosts = ghostKeys(DEFAULT_EXPLICITLY_BOUND, (ElTable as any).props ?? {})
    expect(ghosts, `ghost keys bound but absent from ElTable.props: ${ghosts.join(', ')}`).toEqual([])
  })

  it('virtual EXPLICITLY_BOUND keys all exist in ElTableV2.props', () => {
    const ghosts = ghostKeys(VIRTUAL_EXPLICITLY_BOUND, (ElTableV2 as any).props ?? {})
    expect(ghosts, `ghost keys bound but absent from ElTableV2.props: ${ghosts.join(', ')}`).toEqual([])
  })

  it('reports EP prop inventory for upgrade triage (info only)', () => {
    const defaultKeys = Object.keys((ElTable as any).props ?? {})
    const virtualKeys = Object.keys((ElTableV2 as any).props ?? {})
    // eslint-disable-next-line no-console
    console.info(`[ep-props] ElTable: ${defaultKeys.length} props, ElTableV2: ${virtualKeys.length} props`)
    expect(defaultKeys.length).toBeGreaterThan(0)
    expect(virtualKeys.length).toBeGreaterThan(0)
  })
})
