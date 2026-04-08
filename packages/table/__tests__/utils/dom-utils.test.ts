import { describe, expect, it } from 'vitest'
import { findCellCoord } from '../../src/utils/dom-utils'

describe('dom-utils', () => {
  describe('findCellCoord', () => {
    it('从带有 data-adv-cell-row/col 属性的元素返回正确坐标', () => {
      const cell = document.createElement('div')
      cell.setAttribute('data-adv-cell-row', '3')
      cell.setAttribute('data-adv-cell-col', '5')

      const coord = findCellCoord(cell)
      expect(coord).not.toBeNull()
      expect(coord!.rowIndex).toBe(3)
      expect(coord!.columnIndex).toBe(5)
    })

    it('从子元素向上查找到父单元格', () => {
      const cell = document.createElement('td')
      cell.setAttribute('data-adv-cell-row', '1')
      cell.setAttribute('data-adv-cell-col', '2')

      const innerSpan = document.createElement('span')
      innerSpan.textContent = 'text'
      cell.appendChild(innerSpan)

      const coord = findCellCoord(innerSpan)
      expect(coord).not.toBeNull()
      expect(coord!.rowIndex).toBe(1)
      expect(coord!.columnIndex).toBe(2)
    })

    it('元素没有 data 属性时返回 null', () => {
      const el = document.createElement('div')

      const coord = findCellCoord(el)
      expect(coord).toBeNull()
    })

    it('只有 row 没有 col 属性时返回 null', () => {
      const el = document.createElement('div')
      el.setAttribute('data-adv-cell-row', '1')

      const coord = findCellCoord(el)
      expect(coord).toBeNull()
    })

    it('只有 col 没有 row 属性时返回 null', () => {
      const el = document.createElement('div')
      el.setAttribute('data-adv-cell-col', '1')

      const coord = findCellCoord(el)
      expect(coord).toBeNull()
    })

    it('属性为空字符串时 Number("") 返回 0', () => {
      const el = document.createElement('div')
      el.setAttribute('data-adv-cell-row', '')
      el.setAttribute('data-adv-cell-col', '')

      const coord = findCellCoord(el)
      expect(coord).not.toBeNull()
      expect(coord!.rowIndex).toBe(0)
      expect(coord!.columnIndex).toBe(0)
    })

    it('body 上查找返回 null', () => {
      const coord = findCellCoord(document.body)
      expect(coord).toBeNull()
    })

    it('非整数属性值仍返回 Number() 结果', () => {
      const el = document.createElement('div')
      el.setAttribute('data-adv-cell-row', 'abc')
      el.setAttribute('data-adv-cell-col', 'xyz')

      const coord = findCellCoord(el)
      expect(coord).not.toBeNull()
      expect(Number.isNaN(coord!.rowIndex)).toBe(true)
      expect(Number.isNaN(coord!.columnIndex)).toBe(true)
    })
  })
})
