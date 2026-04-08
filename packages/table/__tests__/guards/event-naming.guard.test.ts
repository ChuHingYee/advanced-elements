import type { AdvTableEmitsMap } from '../../src/types/table-emits'
import { describe, expect, it } from 'vitest'
import { cellEditingEventNames, changeEventNames, removedEventNames } from '../../src/__type-guards__/event-naming-manifest'

type EvMap = AdvTableEmitsMap<any>

describe('guards/event-naming event-contract', () => {
  it('advTableEmitsMap exposes the new event names', () => {
    // <zh/> 类型级断言：改名后的事件必须存在于映射键上（旧写法对空对象断言恒成立，改前恒绿是假阳性）
    // <en/> Type-level assertion: renamed events must exist as map keys (the old empty-object assertion was trivially green)
    type _AssertHasPageChange = 'pageChange' extends keyof EvMap ? true : ['R4: pageChange missing']
    type _AssertHasCellEditingRequest = 'cellEditingRequest' extends keyof EvMap ? true : ['R4: cellEditingRequest missing']
    type _AssertHasCellEditingCancelled = 'cellEditingCancelled' extends keyof EvMap ? true : ['R4: cellEditingCancelled missing']

    const check: [_AssertHasPageChange, _AssertHasCellEditingRequest, _AssertHasCellEditingCancelled] = [true, true, true]
    expect(check).toEqual([true, true, true])
  })

  it('event-name manifest lists contain the expected renamed members', () => {
    expect(changeEventNames).toContain('pageChange')
    expect(cellEditingEventNames).toContain('cellEditingRequest')
    expect(cellEditingEventNames).toContain('cellEditingCancelled')
  })

  it('removed legacy event names exist in the manifest', () => {
    expect(removedEventNames).toContain('changePage')
    expect(removedEventNames).toContain('cellEditRequest')
    expect(removedEventNames).toContain('editCancelled')
  })

  it('advTableEmitsMap no longer has the removed legacy event names', () => {
    // <zh/> 编译期守卫：legacy 键不应存在于事件映射中
    // <en/> Compile-time guard: legacy keys should not exist in the event map
    type _AssertNoChangePage = 'changePage' extends keyof EvMap ? ['R4: changePage still present'] : true
    type _AssertNoCellEditRequest = 'cellEditRequest' extends keyof EvMap ? ['R4: cellEditRequest still present'] : true
    type _AssertNoEditCancelled = 'editCancelled' extends keyof EvMap ? ['R4: editCancelled still present'] : true

    const check: [_AssertNoChangePage, _AssertNoCellEditRequest, _AssertNoEditCancelled] = [true, true, true]
    expect(check).toEqual([true, true, true])
  })
})
