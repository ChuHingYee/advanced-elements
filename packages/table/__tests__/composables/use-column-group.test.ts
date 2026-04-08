import type { ProcessedColumn } from '../../src/types/column'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useColumnGroup } from '../../src/composables/columns/use-column-group'
import { findColumnDepth } from '../../src/utils/column-tree'

vi.mock('vue', async (importOriginal) => {
  const vue = await importOriginal<typeof import('vue')>()
  return {
    ...vue,
    provide: vi.fn(),
  }
})

function makeCol(key: string, overrides?: Partial<ProcessedColumn>): ProcessedColumn {
  return { key, prop: key, label: key, hidden: false, ...overrides } as unknown as ProcessedColumn
}

function makeGroup(key: string, title: string, children: ProcessedColumn[]): ProcessedColumn {
  return { key, label: title, children, __isGroup: true } as unknown as ProcessedColumn
}

describe('useColumnGroup', () => {
  let setColumnsMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setColumnsMock = vi.fn()
    vi.clearAllMocks()
  })

  function createGroup(cols?: ProcessedColumn[], config?: Record<string, any>) {
    const localColumns = ref<ProcessedColumn[]>(cols ?? [
      makeCol('a'),
      makeCol('b'),
      makeGroup('g1', 'Group1', [makeCol('c'), makeCol('d')]),
    ])
    const mergedColumnConfig = ref({ columnGroup: config ?? {} })
    return useColumnGroup({
      mergedColumnConfig: mergedColumnConfig as any,
      localColumns,
      setColumns: setColumnsMock as any,
    })
  }

  describe('initialization', () => {
    it('should initialize configTree as a deep clone of localColumns', () => {
      const cols = [makeCol('a'), makeCol('b')]
      const api = createGroup(cols)

      expect(api.configTree.value).toEqual(cols)
      expect(api.configTree.value).not.toBe(cols)
    })

    it('should not be dirty initially', () => {
      const api = createGroup()
      expect(api.isDirty.value).toBe(false)
    })

    it('should resolve sidePanelDefaultOpen from config (: 由 activePanel 消费)', () => {
      const api = createGroup(undefined, { sidePanelDefaultOpen: true })
      expect(api.options.value.sidePanelDefaultOpen).toBe(true)
    })

    it('should resolve default options', () => {
      const api = createGroup()
      expect(api.options.value.maxDepth).toBe(3)
      expect(api.options.value.allowCreateGroup).toBe(true)
      expect(api.options.value.allowRename).toBe(true)
      expect(api.options.value.allowDeleteGroup).toBe(true)
    })
  })

  describe('createGroup', () => {
    it('should create a group at root level', () => {
      const api = createGroup([makeCol('a'), makeCol('b')])
      const key = api.createGroup(null, 1, 'MyGroup')

      expect(key).toContain('__header_group_')
      expect(api.configTree.value).toHaveLength(3)
      const group = api.configTree.value[1]
      expect(group.label).toBe('MyGroup')
      expect(group.children).toEqual([])
    })

    it('should create a nested group inside a parent group', () => {
      const parent = makeGroup('g1', 'Parent', [makeCol('a')])
      const api = createGroup([parent])
      api.createGroup('g1', 0, 'Child')

      const parentCol = api.configTree.value[0]
      expect(parentCol.children).toHaveLength(2)
      expect((parentCol.children as unknown as ProcessedColumn[])[0].label).toBe('Child')
    })

    it('should auto-generate group name when not provided', () => {
      const api = createGroup([makeCol('a')])
      api.createGroup(null, 1)

      expect(api.configTree.value[1].label).toContain('Group')
    })

    it('should mint unique keys for consecutive named creations (uuid, decoupled from naming)', () => {
      const api = createGroup([makeCol('a')])
      const key1 = api.createGroup(null, 1, 'SameName')
      const key2 = api.createGroup(null, 2, 'SameName')

      expect(key1).toContain('__header_group_')
      expect(key2).toContain('__header_group_')
      expect(key1).not.toBe(key2)
    })
  })

  describe('deleteGroup', () => {
    it('should delete an empty group', () => {
      const group = makeGroup('g1', 'Empty', [])
      const api = createGroup([makeCol('a'), group])

      api.deleteGroup('g1')

      expect(api.configTree.value).toHaveLength(1)
      expect(api.configTree.value[0].key).toBe('a')
    })

    it('should not delete a group with children', () => {
      const group = makeGroup('g1', 'NotEmpty', [makeCol('c')])
      const api = createGroup([makeCol('a'), group])

      api.deleteGroup('g1')

      expect(api.configTree.value).toHaveLength(2)
    })

    it('should not delete a non-existent key', () => {
      const api = createGroup([makeCol('a')])
      api.deleteGroup('nonexistent')
      expect(api.configTree.value).toHaveLength(1)
    })
  })

  describe('renameGroup', () => {
    it('should rename a group', () => {
      const group = makeGroup('g1', 'OldName', [])
      const api = createGroup([group])

      api.renameGroup('g1', 'NewName')

      expect(api.configTree.value[0].label).toBe('NewName')
      expect(api.configTree.value[0].label).toBe('NewName')
    })

    it('should not rename with empty string', () => {
      const group = makeGroup('g1', 'OldName', [])
      const api = createGroup([group])

      api.renameGroup('g1', '   ')

      expect(api.configTree.value[0].label).toBe('OldName')
    })
  })

  describe('updateList', () => {
    it('should update root list when parentKey is null', () => {
      const api = createGroup([makeCol('a')])
      api.updateList(null, [makeCol('x'), makeCol('y')])

      expect(api.configTree.value).toHaveLength(2)
      expect(api.configTree.value[0].key).toBe('x')
    })

    it('should update children of a nested group', () => {
      const group = makeGroup('g1', 'Group', [makeCol('a')])
      const api = createGroup([group])

      api.updateList('g1', [makeCol('b'), makeCol('c')])

      expect(api.configTree.value[0].children).toHaveLength(2)
    })
  })

  describe('applyConfig', () => {
    it('should call setColumns with current configTree', () => {
      const api = createGroup([makeCol('a')])
      api.createGroup(null, 1, 'New')
      api.applyConfig()

      expect(setColumnsMock).toHaveBeenCalledWith(api.configTree.value)
    })
  })

  describe('resetConfig', () => {
    it('should reset configTree to match localColumns', () => {
      const cols = ref<ProcessedColumn[]>([makeCol('a'), makeCol('b')])
      const mergedColumnConfig = ref({ columnGroup: {} })
      const api = useColumnGroup({
        mergedColumnConfig: mergedColumnConfig as any,
        localColumns: cols,
        setColumns: setColumnsMock as any,
      })

      api.createGroup(null, 1, 'Temp')
      expect(api.configTree.value).toHaveLength(3)

      api.resetConfig()
      expect(api.configTree.value).toHaveLength(2)
    })
  })

  describe('isDirty', () => {
    it('should be true after structural change', () => {
      const api = createGroup([makeCol('a')])
      expect(api.isDirty.value).toBe(false)

      api.createGroup(null, 1, 'New')
      expect(api.isDirty.value).toBe(true)
    })

    it('should be false after resetConfig', () => {
      const api = createGroup([makeCol('a')])
      api.createGroup(null, 1, 'New')
      expect(api.isDirty.value).toBe(true)

      api.resetConfig()
      expect(api.isDirty.value).toBe(false)
    })
  })
})

describe('findColumnDepth', () => {
  it('should return 0 for root-level column', () => {
    const cols = [makeCol('a'), makeCol('b')]
    expect(findColumnDepth(cols, 'a')).toBe(0)
  })

  it('should return 1 for first-level nested column', () => {
    const cols = [makeGroup('g1', 'Group', [makeCol('a')])]
    expect(findColumnDepth(cols, 'a')).toBe(1)
  })

  it('should return 2 for second-level nested column', () => {
    const inner = makeGroup('g2', 'Inner', [makeCol('a')])
    const outer = makeGroup('g1', 'Outer', [inner])
    expect(findColumnDepth([outer], 'a')).toBe(2)
  })

  it('should return -1 for non-existent key', () => {
    const cols = [makeCol('a')]
    expect(findColumnDepth(cols, 'missing')).toBe(-1)
  })
})
