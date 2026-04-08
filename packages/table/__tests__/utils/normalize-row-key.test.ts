import { describe, expect, it } from 'vitest'
import { AUTO_KEY_NAME, normalizeRowKey } from '../../src/utils/normalize-row-key'

describe('normalizeRowKey', () => {
  describe('when rowKey is a function', () => {
    it('should use the function to generate key', () => {
      const rowKeyFn = normalizeRowKey((row: any) => row.id)
      const row = { id: 'row-1', name: 'test' }

      const key = rowKeyFn(row)

      expect(key).toBe('row-1')
    })

    it('should not write explicit keys onto the row (WeakMap only)', () => {
      // <zh/> 显式 key 只进 WeakMap：行内槽是单属性，多表共享行引用且 rowKey 不同时会轮流覆写、
      // <zh/> 触发跨表无限循环（11.1 surface 页因此卡死），故显式命中不再落槽。
      // <en/> Explicit keys live in the WeakMap only: the in-row slot is a single property, so tables
      // <en/> sharing row references with different rowKeys would overwrite it in turn and loop forever
      // <en/> across tables (this froze the 11.1 surface page) — explicit hits no longer land in the slot.
      const rowKeyFn = normalizeRowKey((row: any) => row.id)
      const row = { id: 'row-1' }

      expect(rowKeyFn(row)).toBe('row-1')
      expect(Object.hasOwn(row, AUTO_KEY_NAME)).toBe(false)
    })

    it('should keep the in-row slot untouched on repeated explicit hits', () => {
      const rowKeyFn = normalizeRowKey((row: any) => row.id)
      const row = { id: 'row-1' }

      rowKeyFn(row)
      const prevKey = (row as Record<string, unknown>)[AUTO_KEY_NAME]
      rowKeyFn(row)

      expect((row as Record<string, unknown>)[AUTO_KEY_NAME]).toBe(prevKey)
      expect(rowKeyFn(row)).toBe('row-1')
    })

    it('should cache wrapper function for same input reference', () => {
      const fn = (row: any) => row.id
      const wrapper1 = normalizeRowKey(fn)
      const wrapper2 = normalizeRowKey(fn)

      expect(wrapper1).toBe(wrapper2)
    })

    it('should return key for frozen objects without throwing', () => {
      const rowKeyFn = normalizeRowKey((row: any) => row.id)
      const row = Object.freeze({ id: 'frozen-1' })

      expect(() => rowKeyFn(row)).not.toThrow()
      expect(rowKeyFn(row)).toBe('frozen-1')
    })
  })

  describe('when rowKey is a string', () => {
    it('should use the string as property name to get key', () => {
      const rowKeyFn = normalizeRowKey('id')
      const row = { id: 'row-1', name: 'test' }

      const key = rowKeyFn(row)

      expect(key).toBe('row-1')
    })

    it('should not write explicit keys onto the row (WeakMap only)', () => {
      // <zh/> 同函数分支：显式命中不落槽，跨表共享行引用时不互写（见上）。
      // <en/> Same as the function branch: explicit hits stay out of the slot, so tables sharing
      // <en/> row references never rewrite each other (see above).
      const rowKeyFn = normalizeRowKey('id')
      const row = { id: 'row-1' }

      expect(rowKeyFn(row)).toBe('row-1')
      expect(Object.hasOwn(row, AUTO_KEY_NAME)).toBe(false)
    })

    it('should convert key to string', () => {
      const rowKeyFn = normalizeRowKey('id')
      const row = { id: 123 }

      const key = rowKeyFn(row)

      expect(key).toBe('123')
    })

    it('should return key for frozen objects without throwing', () => {
      const rowKeyFn = normalizeRowKey('id')
      const row = Object.freeze({ id: 'frozen-1' })

      expect(() => rowKeyFn(row)).not.toThrow()
      expect(rowKeyFn(row)).toBe('frozen-1')
    })
  })

  describe('when rowKey is a number', () => {
    it('should use the number as property name', () => {
      const rowKeyFn = normalizeRowKey(0)
      const row = { 0: 'first', 1: 'second' }

      const key = rowKeyFn(row)

      expect(key).toBe('first')
    })
  })

  describe('when rowKey is undefined (auto key)', () => {
    it('should auto-generate key using nanoid', () => {
      const rowKeyFn = normalizeRowKey()
      const row = { id: 'row-1' }

      const key = rowKeyFn(row)

      expect(key).toMatch(/^[\w-]{21}$/)
    })

    it('should write generated key to (row as Record<string, unknown>)[AUTO_KEY_NAME] for extensible objects', () => {
      const rowKeyFn = normalizeRowKey()
      const row = { id: 'row-1' }

      rowKeyFn(row)

      expect((row as Record<string, unknown>)[AUTO_KEY_NAME]).toBeDefined()
      expect(typeof (row as Record<string, unknown>)[AUTO_KEY_NAME]).toBe('string')
    })

    it('should cache the same key for same object', () => {
      const rowKeyFn = normalizeRowKey()
      const row = { id: 'row-1' }

      const key1 = rowKeyFn(row)
      const key2 = rowKeyFn(row)

      expect(key1).toBe(key2)
    })

    it('should generate different keys for different objects', () => {
      const rowKeyFn = normalizeRowKey()
      const row1 = { id: 'row-1' }
      const row2 = { id: 'row-2' }

      const key1 = rowKeyFn(row1)
      const key2 = rowKeyFn(row2)

      expect(key1).not.toBe(key2)
    })

    it('should return string representation for primitive values', () => {
      const rowKeyFn = normalizeRowKey()

      expect(rowKeyFn(null as any)).toBe('null')
      expect(rowKeyFn(undefined as any)).toBe('undefined')
      expect(rowKeyFn(123)).toBe('123')
      expect(rowKeyFn('string')).toBe('string')
    })

    it('should not cache for non-object values', () => {
      const rowKeyFn = normalizeRowKey()

      const key1 = rowKeyFn(123)
      const key2 = rowKeyFn(123)

      expect(key1).toBe(key2)
    })

    it('should return consistent key for frozen objects without throwing', () => {
      const rowKeyFn = normalizeRowKey()
      const row = Object.freeze({ id: 'frozen-1' })

      expect(() => rowKeyFn(row)).not.toThrow()

      const key1 = rowKeyFn(row)
      const key2 = rowKeyFn(row)
      expect(key1).toBe(key2)
      expect(key1).toMatch(/^[\w-]{21}$/)
    })

    it('should not write AUTO_KEY_NAME to frozen objects', () => {
      const rowKeyFn = normalizeRowKey()
      const row = Object.freeze({ id: 'frozen-1' })

      rowKeyFn(row)

      expect(Object.hasOwn(row, AUTO_KEY_NAME)).toBe(false)
    })

    it('should return consistent key for sealed objects without throwing', () => {
      const rowKeyFn = normalizeRowKey()
      const row = Object.seal({ id: 'sealed-1' })

      expect(() => rowKeyFn(row)).not.toThrow()

      const key1 = rowKeyFn(row)
      const key2 = rowKeyFn(row)
      expect(key1).toBe(key2)
    })
  })

  describe('uncovered branches', () => {
    describe('function rowKey returns undefined (fallback to AUTO_KEY_NAME)', () => {
      it('should fallback to "undefined" string when rowKey function returns undefined without AUTO_KEY_NAME', () => {
        const rowKeyFn = normalizeRowKey(((_row: any) => undefined) as any)
        const row = { id: 'row-1' }

        const key = rowKeyFn(row)

        // 当函数返回 undefined 且对象无 AUTO_KEY_NAME 时，source 返回 String(undefined) = 'undefined'；
        // 且不再落槽（显式/回退路径统一只写 WeakMap，见上）。
        expect(key).toBe('undefined')
        expect(Object.hasOwn(row, AUTO_KEY_NAME)).toBe(false)
      })

      it('should generate new auto key when function returns undefined and object has AUTO_KEY_NAME', () => {
        // 如果对象已有 AUTO_KEY_NAME，会返回该值
        const row = { id: 'row-1', [AUTO_KEY_NAME]: 'existing-auto-key' }
        const rowKeyFn = normalizeRowKey(((_row: any) => undefined) as any)

        const key = rowKeyFn(row)

        expect(key).toBe('existing-auto-key')
      })

      it('should keep the in-row slot untouched when function returns undefined', () => {
        const rowKeyFn = normalizeRowKey(((_row: any) => undefined) as any)
        const row = { id: 'row-1' }

        const key1 = rowKeyFn(row)
        const key2 = rowKeyFn(row)

        expect(key1).toBe(key2)
        expect(key1).toBe('undefined')
        expect(Object.hasOwn(row, AUTO_KEY_NAME)).toBe(false)
      })

      it('should not throw for frozen object when function returns undefined', () => {
        const rowKeyFn = normalizeRowKey(((_row: any) => undefined) as any)
        const row = Object.freeze({ id: 'frozen-1' })

        expect(() => rowKeyFn(row)).not.toThrow()
        const key = rowKeyFn(row)
        // frozen 对象无 AUTO_KEY_NAME，函数返回 undefined 时 key 为 'undefined'
        expect(key).toBe('undefined')
      })

      it('should not write AUTO_KEY_NAME to frozen object when function returns undefined', () => {
        const rowKeyFn = normalizeRowKey(((_row: any) => undefined) as any)
        const row = Object.freeze({ id: 'frozen-1' })

        rowKeyFn(row)

        expect(Object.hasOwn(row, AUTO_KEY_NAME)).toBe(false)
      })

      it('should return consistent key for frozen object when function returns undefined', () => {
        const rowKeyFn = normalizeRowKey(((_row: any) => undefined) as any)
        const row = Object.freeze({ id: 'frozen-1' })

        const key1 = rowKeyFn(row)
        const key2 = rowKeyFn(row)

        expect(key1).toBe(key2)
      })

      it('should not throw for sealed object when function returns undefined', () => {
        const rowKeyFn = normalizeRowKey(((_row: any) => undefined) as any)
        const row = Object.seal({ id: 'sealed-1' })

        expect(() => rowKeyFn(row)).not.toThrow()
      })

      it('should return consistent key for sealed object when function returns undefined', () => {
        const rowKeyFn = normalizeRowKey(((_row: any) => undefined) as any)
        const row = Object.seal({ id: 'sealed-1' })

        const key1 = rowKeyFn(row)
        const key2 = rowKeyFn(row)

        expect(key1).toBe(key2)
      })
    })

    describe('null/undefined row input', () => {
      it('should handle null row with function returning undefined', () => {
        const rowKeyFn = normalizeRowKey((row: any) => row?.id)

        const key = rowKeyFn(null as any)

        expect(key).toBe('undefined') // null 进入 typeof row !== 'object' 分支返回 String(null) = 'null'

        // 但是 source 代码中函数 rowKey 分支的 (row as any)[rowKey] 对 null 会返回 undefined
        // 然后 undefined === undefined 为 true，进入 undefined check
        // row 为 null 时 row && typeof row === 'object' 为 false，不会进入 auto key 分支
        // 最终 String(undefined) = 'undefined'
        // 修正：实际行为是返回 'undefined'
      })

      it('should handle undefined row with function returning undefined', () => {
        const rowKeyFn = normalizeRowKey((row: any) => row?.id)

        const key = rowKeyFn(undefined as any)

        expect(key).toBe('undefined')
      })

      it('should handle null row with string rowKey', () => {
        const rowKeyFn = normalizeRowKey('id')

        // string rowKey 分支直接访问 (row as any)[rowKey]，对 null 抛 TypeError
        expect(() => rowKeyFn(null as any)).toThrow()
      })

      it('should handle undefined row with string rowKey', () => {
        const rowKeyFn = normalizeRowKey('id')

        // 同上，对 undefined 抛 TypeError
        expect(() => rowKeyFn(undefined as any)).toThrow()
      })

      it('should handle null row with auto key', () => {
        const rowKeyFn = normalizeRowKey()

        const key = rowKeyFn(null as any)

        expect(key).toBe('null')
      })

      it('should handle undefined row with auto key', () => {
        const rowKeyFn = normalizeRowKey()

        const key = rowKeyFn(undefined as any)

        expect(key).toBe('undefined')
      })
    })
  })

  describe('cross-table scope isolation', () => {
    // <zh/> 冻结行无法写入行上 AUTO_KEY_NAME 戳记，故自动键缓存必须按 table scope 隔离，
    // <zh/> 否则各表互相串扰；API 下发的冻结数据共享引用时即此场景。
    // <en/> Frozen rows cannot carry the AUTO_KEY_NAME stamp, so the auto-key cache must be isolated
    // <en/> per table scope, otherwise tables trample each other; this is the case when an API hands
    // <en/> out shared references to frozen data.
    it('frozen row: auto table must not reuse string table result', () => {
      const row = Object.freeze({ id: 'shared-1' })
      const stringFn = normalizeRowKey('id')
      const autoFn = normalizeRowKey()

      expect(stringFn(row)).toBe('shared-1')
      const autoKey = autoFn(row)
      expect(autoKey).toMatch(/^[\w-]{21}$/)
      expect(autoKey).not.toBe('shared-1')
      expect(stringFn(row)).toBe('shared-1')
      expect(autoFn(row)).toBe(autoKey)
    })

    it('frozen row: string table still reads its own field after auto ran first', () => {
      const row = Object.freeze({ id: 'shared-1' })
      const autoFn = normalizeRowKey()
      const stringFn = normalizeRowKey('id')

      const autoKey = autoFn(row)
      expect(autoKey).toMatch(/^[\w-]{21}$/)
      expect(stringFn(row)).toBe('shared-1')
      expect(autoFn(row)).toBe(autoKey)
    })

    it('frozen row: missing field must not adopt another scope cached key', () => {
      const row = Object.freeze({ a: 'A-1' }) as Record<string, unknown>
      const fnA = normalizeRowKey('a')
      const fnB = normalizeRowKey('b')

      expect(fnA(row)).toBe('A-1')
      // b 字段缺失：不得命中 a scope 的 'A-1'，回退 'undefined'（开发告警路径）
      expect(fnB(row)).toBe('undefined')
      expect(fnA(row)).toBe('A-1')
    })

    it('extensible row: explicit hits stay out of the slot, auto scope mints its own stable key', () => {
      // <zh/> 显式表（'id'）不再向行内槽落戳，auto 表按自身 scope 生成稳定 key 并落槽；
      // <zh/> 两表交替求值时槽值不再振荡（此前 'shared-1' ↔ 随机 key 轮流覆写，跨表即无限循环）。
      // <en/> Explicit tables ('id') no longer stamp the in-row slot; auto tables mint their own stable
      // <en/> key under their own scope. Interleaved evaluation across tables no longer oscillates the
      // <en/> slot (previously 'shared-1' and the random key overwrote each other in turn — an infinite
      // <en/> loop as soon as tables shared rows).
      const row = { id: 'shared-1' }
      const stringFn = normalizeRowKey('id')
      const autoFn = normalizeRowKey()

      expect(stringFn(row)).toBe('shared-1')
      const autoKey = autoFn(row)
      expect(autoKey).toMatch(/^[\w-]{21}$/)
      for (let i = 0; i < 5; i++) {
        expect(stringFn(row)).toBe('shared-1')
        expect(autoFn(row)).toBe(autoKey)
      }
      expect((row as Record<string, unknown>)[AUTO_KEY_NAME]).toBe(autoKey)
    })

    it('shared row across three scopes converges without slot oscillation (11.1 regression)', () => {
      // <zh/> 11.1 surface 页回归：101 表共享 surfaceData，rowKey 混用 'id'/auto/'name'；
      // <zh/> 修复前三方轮流改写行内槽（'r1' → 随机 → 'N1' → …），修复后只有 auto 落槽且值恒定。
      // <en/> 11.1 surface-page regression: 101 tables sharing surfaceData with mixed 'id'/auto/'name'
      // <en/> rowKeys; before the fix the three scopes rewrote the in-row slot in turn
      // <en/> ('r1' → random → 'N1' → …), after the fix only auto lands in the slot with a constant value.
      const row = { id: 'r1', name: 'N1' }
      const byId = normalizeRowKey('id')
      const auto = normalizeRowKey()
      const byName = normalizeRowKey('name')

      const autoKey = auto(row)
      for (let i = 0; i < 10; i++) {
        expect(byId(row)).toBe('r1')
        expect(auto(row)).toBe(autoKey)
        expect(byName(row)).toBe('N1')
      }
      expect((row as Record<string, unknown>)[AUTO_KEY_NAME]).toBe(autoKey)
    })

    it('should isolate two function rowKeys over the same frozen row', () => {
      const row = Object.freeze({ id: 'shared-1' })
      const fnById = normalizeRowKey((r: any) => r.id)
      const fnConst = normalizeRowKey((_r: any) => 'const-key')

      expect(fnById(row)).toBe('shared-1')
      expect(fnConst(row)).toBe('const-key')
      expect(fnById(row)).toBe('shared-1')
    })
  })
})
