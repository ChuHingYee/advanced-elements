/**
 * Tests for `buildColumnByKeyMap` — prop primary + key/property alias triple registration.
 */
import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { buildColumnByKeyMap } from '../../src/composables/core/use-column-domain'

function col(overrides: Partial<ProcessedColumn> & Record<string, unknown>): ProcessedColumn {
  return { prop: 'p', label: 'L', hidden: false, ...overrides } as unknown as ProcessedColumn
}

describe('buildColumnByKeyMap', () => {
  it('registers prop as the primary key', () => {
    const c = col({ prop: 'name' })
    const map = buildColumnByKeyMap([c])
    expect(map.get('name')).toBe(c)
  })

  it('registers a differing key as an alias without disturbing prop lookups', () => {
    const c = col({ prop: 'name', key: 'userName' })
    const map = buildColumnByKeyMap([c])
    expect(map.get('name')).toBe(c)
    expect(map.get('userName')).toBe(c)
  })

  it('registers a differing property as an alias (EP event-column lookups)', () => {
    const c = col({ prop: 'name', property: 'displayName' })
    const map = buildColumnByKeyMap([c])
    expect(map.get('name')).toBe(c)
    expect(map.get('displayName')).toBe(c)
  })

  it('keeps first-seen-wins when a property alias collides with another prop', () => {
    const first = col({ prop: 'displayName' })
    const second = col({ prop: 'name', property: 'displayName' })
    const map = buildColumnByKeyMap([first, second])
    expect(map.get('displayName')).toBe(first)
    expect(map.get('name')).toBe(second)
  })

  it('bounds entries at 3 per column', () => {
    const c = col({ prop: 'name', key: 'userName', property: 'displayName' })
    expect(buildColumnByKeyMap([c]).size).toBeLessThanOrEqual(3)
  })
})
