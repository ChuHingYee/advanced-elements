/**
 * editor-inference 测试
 *
 * 根据 valueType 推断内置编辑器类型的纯函数。
 */
import { describe, expect, it } from 'vitest'
import { inferEditorFromValueType } from '../../src/utils/edit-helpers'

describe('inferEditorFromValueType', () => {
  it('text → text', () => {
    expect(inferEditorFromValueType('text')).toBe('text')
  })

  it('textarea → text', () => {
    expect(inferEditorFromValueType('textarea')).toBe('text')
  })

  it('money → number', () => {
    expect(inferEditorFromValueType('money')).toBe('number')
  })

  it('digit → number', () => {
    expect(inferEditorFromValueType('digit')).toBe('number')
  })

  it('percent → number', () => {
    expect(inferEditorFromValueType('percent')).toBe('number')
  })

  it('date → date', () => {
    expect(inferEditorFromValueType('date')).toBe('date')
  })

  it('dateTime → datetime', () => {
    expect(inferEditorFromValueType('dateTime')).toBe('datetime')
  })

  it('select → select', () => {
    expect(inferEditorFromValueType('select')).toBe('select')
  })

  it('radio → select', () => {
    expect(inferEditorFromValueType('radio')).toBe('select')
  })

  it('checkbox → checkbox', () => {
    expect(inferEditorFromValueType('checkbox')).toBe('checkbox')
  })

  it('switch → switch', () => {
    expect(inferEditorFromValueType('switch')).toBe('switch')
  })

  it('未知 valueType 返回 undefined', () => {
    expect(inferEditorFromValueType('unknown')).toBeUndefined()
  })

  it('undefined 返回 undefined', () => {
    expect(inferEditorFromValueType(undefined)).toBeUndefined()
  })

  it('空字符串返回 undefined', () => {
    expect(inferEditorFromValueType('')).toBeUndefined()
  })
})
