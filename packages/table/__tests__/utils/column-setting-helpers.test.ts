/**
 * column-setting-helpers 测试
 *
 * 列设置纯逻辑工具集——所有函数均为纯函数，无 Vue 响应式依赖。
 */
import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it } from 'vitest'
import {
  applyGroupUpdate,
  buildKeyMap,
  collectLeafVisibility,
  extractHiddenSignature,
  filterColumnsByGroup,
  handleDragEnd,
  handleDragMove,
  isBuiltInColumn,
  isPinned,
  removeOldGroupColumns,
  syncColumnReference,
  updateAllColumnHidden,
  updateColumnByKey,
} from '../../src/utils/column-setting-helpers'

/** 创建测试列辅助函数 */
function col(overrides: Partial<ProcessedColumn> = {}): ProcessedColumn {
  return {
    prop: 'test',
    label: 'Test',
    width: 100,
    ...overrides,
  } as unknown as ProcessedColumn
}

describe('isBuiltInColumn', () => {
  it('selection 列返回 true', () => {
    expect(isBuiltInColumn(col({ selection: true }))).toBe(true)
  })

  it('option 类型且有 hoverActions 返回 true', () => {
    expect(isBuiltInColumn(col({ valueType: 'option', hoverActions: [] }))).toBe(true)
  })

  it('普通列返回 false', () => {
    expect(isBuiltInColumn(col())).toBe(false)
  })
})

describe('isPinned', () => {
  it('fixed=left 返回 true', () => {
    expect(isPinned(col({ pinFixed: 'left' } as any))).toBe(true)
  })

  it('fixed=right 返回 true', () => {
    expect(isPinned(col({ pinFixed: 'right' } as any))).toBe(true)
  })

  it('未固定返回 false', () => {
    expect(isPinned(col())).toBe(false)
  })
})

describe('updateColumnByKey', () => {
  it('更新匹配 key 的列配置', () => {
    const cols = [col({ prop: 'name', width: 100 }), col({ prop: 'age', width: 80 })]
    const result = updateColumnByKey(cols, 'name', c => ({ ...c, width: 200 }))
    expect(result[0].width).toBe(200)
    expect(result[1].width).toBe(80)
    expect(result).not.toBe(cols) // 新引用
  })

  it('key 不匹配时返回原引用', () => {
    const cols = [col({ prop: 'name' })]
    const result = updateColumnByKey(cols, 'nonexistent', c => c)
    expect(result).toBe(cols)
  })

  it('递归更新子列', () => {
    const cols = [{
      ...col({ prop: 'group', children: [col({ prop: 'child', width: 50 })] }),
    }]
    const result = updateColumnByKey(cols, 'child', c => ({ ...c, width: 150 }))
    expect((result[0] as any).children[0].width).toBe(150)
  })

  it('无变更时返回原引用', () => {
    const cols = [col({ prop: 'name', width: 100 })]
    const result = updateColumnByKey(cols, 'name', c => c)
    expect(result).toBe(cols)
  })
})

describe('collectLeafVisibility', () => {
  it('普通叶子列返回可见性', () => {
    const cols = [col({ prop: 'name', hidden: false }), col({ prop: 'age', hidden: true })]
    expect(collectLeafVisibility(cols)).toEqual([true, false])
  })

  it('内置列跳过', () => {
    const cols = [
      col({ prop: 'name', selection: true }),
      col({ prop: 'age' }),
    ]
    expect(collectLeafVisibility(cols)).toEqual([true])
  })

  it('递归收集组内叶子列', () => {
    const cols = [{
      ...col({ prop: 'group', hidden: true, children: [
        col({ prop: 'child1', hidden: false }),
        col({ prop: 'child2', hidden: false }),
      ] }),
    }]
    // 父级 hidden=true 导致所有子列 hidden
    expect(collectLeafVisibility(cols)).toEqual([false, false])
  })
})

describe('extractHiddenSignature', () => {
  it('生成正确的签名字符串', () => {
    const cols = [
      col({ prop: 'name', hidden: false }),
      col({ prop: 'age', hidden: true }),
    ]
    expect(extractHiddenSignature(cols)).toBe('0,1')
  })

  it('内置列生成空签名', () => {
    const cols = [
      col({ prop: 'selection', selection: true }),
      col({ prop: 'name', hidden: false }),
    ]
    expect(extractHiddenSignature(cols)).toBe(',0')
  })
})

describe('updateAllColumnHidden', () => {
  it('设置所有列隐藏', () => {
    const cols = [col({ prop: 'name', hidden: false }), col({ prop: 'age', hidden: false })]
    const result = updateAllColumnHidden(cols, true)
    expect(result.every(c => c.hidden === true)).toBe(true)
  })

  it('内置列跳过', () => {
    const cols = [
      col({ prop: 'selection', selection: true, hidden: false }),
      col({ prop: 'name', hidden: false }),
    ]
    const result = updateAllColumnHidden(cols, true)
    expect(result[0].hidden).toBe(false)
    expect(result[1].hidden).toBe(true)
  })
})

describe('buildKeyMap', () => {
  it('构建正确的 key→column Map', () => {
    const cols = [col({ prop: 'name' }), col({ prop: 'age' })]
    const map = buildKeyMap(cols)
    expect(map.get('name')).toBe(cols[0])
    expect(map.get('age')).toBe(cols[1])
    expect(map.size).toBe(2)
  })
})

describe('filterColumnsByGroup', () => {
  it('fixed=left 筛选', () => {
    const cols = [
      col({ prop: 'name', fixed: 'left' }),
      col({ prop: 'age' }),
    ] as ProcessedColumn[]
    expect(filterColumnsByGroup(cols, 'left')).toHaveLength(1)
  })

  it('fixed=right 筛选', () => {
    const cols = [
      col({ prop: 'name', fixed: 'right' }),
      col({ prop: 'age' }),
    ] as ProcessedColumn[]
    expect(filterColumnsByGroup(cols, 'right')).toHaveLength(1)
  })

  it('未固定筛选', () => {
    const cols = [
      col({ prop: 'name', fixed: 'left' }),
      col({ prop: 'age' }),
      col({ prop: 'email', fixed: 'right' }),
    ] as ProcessedColumn[]
    expect(filterColumnsByGroup(cols, 'normal')).toHaveLength(1)
    expect(filterColumnsByGroup(cols, 'normal')[0].prop).toBe('age')
  })
})

describe('removeOldGroupColumns', () => {
  it('移除已不存在的列', () => {
    const cols = [
      col({ prop: 'name' }),
      col({ prop: 'age' }),
      col({ prop: 'email' }),
    ]
    const result = removeOldGroupColumns(cols, new Set(['name', 'email']), [])
    expect(result).toHaveLength(1)
    expect(result[0].prop).toBe('age')
  })

  it('保留旧分组中存在的列', () => {
    const cols = [col({ prop: 'name' })]
    const result = removeOldGroupColumns(cols, new Set(['name']), [])
    expect(result).toHaveLength(0)
  })
})

describe('applyGroupUpdate', () => {
  it('正常分组更新', () => {
    const currentHeaders = [
      col({ prop: 'name', fixed: 'left' }),
      col({ prop: 'age' }),
      col({ prop: 'email', fixed: 'right' }),
    ]
    const newCols = [col({ prop: 'name', fixed: 'left' })]
    const result = applyGroupUpdate(currentHeaders, 'left', newCols)
    expect(result).toContainEqual(expect.objectContaining({ prop: 'name' }))
    expect(result).toContainEqual(expect.objectContaining({ prop: 'age' }))
    expect(result).toContainEqual(expect.objectContaining({ prop: 'email' }))
  })
})

describe('handleDragMove', () => {
  it('related 为 null 时返回 true', () => {
    const lastRef = { value: null as HTMLElement | null }
    const result = handleDragMove(
      { dragged: document.createElement('div'), related: null },
      'no-drop',
      'drop-target',
      lastRef,
    )
    expect(result).toBe(true)
  })

  it('dragged === related 时返回 false', () => {
    const el = document.createElement('div')
    const lastRef = { value: null as HTMLElement | null }
    const result = handleDragMove(
      { dragged: el, related: el },
      'no-drop',
      'drop-target',
      lastRef,
    )
    expect(result).toBe(false)
  })

  it('dragged !== related 时返回 true 并添加样式', () => {
    const dragged = document.createElement('div')
    const related = document.createElement('div')
    const lastRef = { value: null as HTMLElement | null }
    const result = handleDragMove(
      { dragged, related },
      'no-drop',
      'drop-target',
      lastRef,
    )
    expect(result).toBe(true)
    expect(related.classList.contains('drop-target')).toBe(true)
    expect(lastRef.value).toBe(related)
  })
})

describe('handleDragEnd', () => {
  it('清理样式', () => {
    const targetEl = document.createElement('div')
    targetEl.classList.add('drop-target')
    const lastRef = { value: targetEl }
    const item = document.createElement('div')
    item.classList.add('no-drop')

    handleDragEnd(
      { item },
      'no-drop',
      'drop-target',
      lastRef,
    )
    expect(targetEl.classList.contains('drop-target')).toBe(false)
    expect(item.classList.contains('no-drop')).toBe(false)
    expect(lastRef.value).toBeNull()
  })
})

describe('syncColumnReference', () => {
  it('headersKeyMap 中存在时同步引用', () => {
    const existing = col({ prop: 'name', width: 200 })
    const map = new Map([['name', existing]])
    const result = syncColumnReference(col({ prop: 'name' }), map, 'left')
    expect(result.width).toBe(200)
    expect(result.fixed).toBe('left')
  })

  it('headersKeyMap 中不存在时返回新对象', () => {
    const map = new Map()
    const result = syncColumnReference(col({ prop: 'name' }), map, 'left')
    expect(result.fixed).toBe('left')
    expect(result).not.toBe(col({ prop: 'name' }))
  })
})
