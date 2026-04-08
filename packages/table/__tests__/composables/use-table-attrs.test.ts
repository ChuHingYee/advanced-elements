import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { useTableAttrs } from '../../src/composables/core/use-table-attrs'

describe('use-table-attrs', () => {
  it('should pass through class, style, id, key', () => {
    const attrs = {
      class: 'my-class',
      style: { color: 'red' },
      id: 'my-id',
      key: 'my-key',
    }
    const result = useTableAttrs(attrs)

    expect(result.value.class).toBe('my-class')
    expect(result.value.style).toEqual({ color: 'red' })
    expect(result.value.id).toBe('my-id')
    expect(result.value.key).toBe('my-key')
  })

  it('should pass through component props like border, stripe', () => {
    const attrs = {
      class: 'my-class',
      border: true,
      stripe: false,
    }
    const result = useTableAttrs(attrs)

    expect(result.value.class).toBe('my-class')
    expect(result.value.border).toBe(true)
    expect(result.value.stripe).toBe(false)
  })

  it('should filter out onUpdate:current-page', () => {
    const attrs = {
      'class': 'my-class',
      'onUpdate:current-page': () => {},
    }
    const result = useTableAttrs(attrs)

    expect(result.value.class).toBe('my-class')
    expect(result.value['onUpdate:current-page']).toBeUndefined()
  })

  it('should filter out onUpdate:page-size', () => {
    const attrs = {
      'class': 'my-class',
      'onUpdate:page-size': () => {},
    }
    const result = useTableAttrs(attrs)

    expect(result.value['onUpdate:page-size']).toBeUndefined()
  })

  it('should filter out all onXxx event handlers', () => {
    const attrs = {
      class: 'my-class',
      onSelectionChange: () => {},
      onSelect: () => {},
      onSelectAll: () => {},
      onQuery: () => {},
      onReset: () => {},
      onRowClick: () => {},
    }
    const result = useTableAttrs(attrs)

    expect(result.value.onSelectionChange).toBeUndefined()
    expect(result.value.onSelect).toBeUndefined()
    expect(result.value.onSelectAll).toBeUndefined()
    expect(result.value.onQuery).toBeUndefined()
    expect(result.value.onReset).toBeUndefined()
    expect(result.value.onRowClick).toBeUndefined()
  })

  it('should filter out rowKey to prevent overriding explicit binding', () => {
    const attrs = {
      class: 'my-class',
      rowKey: 'id',
    }
    const result = useTableAttrs(attrs)

    expect(result.value.class).toBe('my-class')
    expect(result.value.rowKey).toBeUndefined()
  })

  it('should filter out height — height controls AdvTable container, not internal table', () => {
    const attrs = {
      class: 'my-class',
      height: '400px',
    }
    const result = useTableAttrs(attrs)

    expect(result.value.class).toBe('my-class')
    expect(result.value.height).toBeUndefined()
  })

  it('should return empty object when only filtered attrs', () => {
    const attrs = {
      'onUpdate:current-page': () => {},
      'rowKey': 'id',
      'height': '400px',
    }
    const result = useTableAttrs(attrs)

    expect(result.value).toEqual({})
  })

  describe('reference stability', () => {
    it('should return same reference on repeated access (computed cache)', () => {
      const attrs = {
        class: 'my-class',
        border: true,
      }
      const result = useTableAttrs(attrs)
      const first = result.value
      const second = result.value
      expect(first).toBe(second)
    })

    it('should filter events and produce consistent output', () => {
      const attrs = {
        'class': 'my-class',
        'border': true,
        'onUpdate:current-page': () => {},
        'onRowClick': () => {},
      }
      const result = useTableAttrs(attrs)
      expect(Object.keys(result.value)).toEqual(['class', 'border'])
      expect(result.value.class).toBe('my-class')
      expect(result.value.border).toBe(true)
    })

    it('should handle empty attrs', () => {
      const result = useTableAttrs({})
      expect(result.value).toEqual({})
    })
  })

  it('returns previous reference when attrs are unchanged', () => {
    const attrs = { class: 'my-class', border: true }
    const result = useTableAttrs(attrs)
    const firstRef = result.value
    expect(result.value).toBe(firstRef)
  })

  it('returns new reference when attrs change', () => {
    const attrs: Record<string, any> = { class: 'my-class', border: true }
    const result = useTableAttrs(attrs)
    const newResult = useTableAttrs({ class: 'other-class', border: false })
    expect(newResult.value).not.toBe(result.value)
    expect(newResult.value.border).toBe(false)
  })

  it('filters onSelect event handler attribute', () => {
    const attrs = {
      class: 'my-class',
      onSelect: () => {},
    }
    const result = useTableAttrs(attrs)
    expect(result.value.onSelect).toBeUndefined()
    expect(result.value.class).toBe('my-class')
  })

  it('filters onCellClick and onRowDblclick event handlers', () => {
    const attrs = {
      class: 'my-class',
      onCellClick: () => {},
      onRowDblclick: () => {},
    }
    const result = useTableAttrs(attrs)
    expect(result.value.onCellClick).toBeUndefined()
    expect(result.value.onRowDblclick).toBeUndefined()
    expect(Object.keys(result.value)).toEqual(['class'])
  })

  /**
   * Merged from use-table-attrs-phase2.test.ts — computed prev comparison branches
   * Covers: changed detection, prev return when unchanged, key count mismatch
   */
  describe('phase2 — computed prev comparison', () => {
    it('returns same prev reference when attrs unchanged', () => {
      const attrs = reactive({ class: 'my-table', size: 'large' })
      const computed = useTableAttrs(attrs)

      const first = computed.value
      const second = computed.value
      expect(second).toBe(first) // Same reference
    })

    it('returns new result when attrs value changes', () => {
      const attrs = reactive({ class: 'my-table', size: 'large' })
      const computed = useTableAttrs(attrs)

      const first = computed.value
      attrs.size = 'small'
      const second = computed.value
      expect(second).not.toBe(first)
      expect(second.size).toBe('small')
    })

    it('returns new result when key is added', () => {
      const attrs = reactive({ class: 'my-table' })
      const computed = useTableAttrs(attrs)

      const first = computed.value
      attrs.newKey = 'newValue'
      const second = computed.value
      expect(second).not.toBe(first)
      expect(second.newKey).toBe('newValue')
    })

    it('returns new result when key is removed (keyCount mismatch)', () => {
      const attrs = reactive({ class: 'my-table', size: 'large' })
      const computed = useTableAttrs(attrs)

      const first = computed.value
      delete attrs.size
      const second = computed.value
      expect(second).not.toBe(first)
      expect(second.size).toBeUndefined()
    })

    it('filters out event handlers and conflicting props', () => {
      const attrs = reactive({
        'class': 'my-table',
        'onRowClick': () => {},
        'onUpdate:currentPage': () => {},
        'onUpdate:current-page': () => {},
        'rowKey': 'id',
        'height': '200',
        'size': 'large',
      })
      const computed = useTableAttrs(attrs)

      const result = computed.value
      expect(result.class).toBe('my-table')
      expect(result.size).toBe('large')
      expect(result.onRowClick).toBeUndefined()
      expect(result['onUpdate:currentPage']).toBeUndefined()
      expect(result['onUpdate:current-page']).toBeUndefined()
      expect(result.rowKey).toBeUndefined()
      expect(result.height).toBeUndefined()
    })

    it('handles empty attrs object', () => {
      const computed = useTableAttrs({})
      expect(computed.value).toEqual({})
    })

    it('handles case-insensitive filtering', () => {
      const attrs = reactive({
        ONROWCLICK: () => {},
        RowKey: 'id',
        HEIGHT: '200',
        class: 'keep',
      })
      const computed = useTableAttrs(attrs)
      const result = computed.value
      expect(result.class).toBe('keep')
      expect(result.ONROWCLICK).toBeUndefined()
      expect(result.RowKey).toBeUndefined()
      expect(result.HEIGHT).toBeUndefined()
    })
  })
})
