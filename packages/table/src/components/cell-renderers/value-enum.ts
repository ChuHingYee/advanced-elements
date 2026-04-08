import type { ValueEnum } from '../../types'
import { ElTag } from 'element-plus'
import { h } from 'vue'
import { normalizeEnumItem } from '../../utils/enum'

/**
 * <zh/> 渲染枚举值单元格
 * <en/> Render enum value cell
 *
 * @remarks
 * <zh/> 从 valueEnum 映射表中查找 value 对应的枚举项，若找到则渲染为带状态的标签（ElTag），否则直接返回原始值的字符串形式
 * <en/> Looks up the value in the valueEnum map, if found renders as a status tag (ElTag), otherwise returns the raw value as string
 *
 * @param value - <zh/> 单元格原始值 | <en/> raw cell value
 * @param valueEnum - <zh/> 枚举值映射表，键为原始值，值为枚举项或字符串 | <en/> enum value map, keyed by raw value, valued by enum item or string
 * @returns <zh/> 渲染后的 VNode 或字符串 | <en/> rendered VNode or string
 */
export function renderEnumCell(value: unknown, valueEnum: ValueEnum) {
  const key = String(value)
  const item = valueEnum[key]

  if (!item) {
    return String(value ?? '')
  }

  const normalized = normalizeEnumItem(item)

  // `disable-transitions` skips ElTag's mount-time `el-zoom-in-center`
  // <Transition>, which calls `getComputedStyle` once per tag and causes
  // forced reflows (hundreds of them in large tables) — a major first-paint cost.
  if (normalized.status) {
    return h(ElTag, { type: normalized.status, disableTransitions: true }, () => normalized.text)
  }
  return h(ElTag, { disableTransitions: true }, () => normalized.text)
}

/**
 * <zh/> 将枚举值映射表转换为下拉选项列表。
 * <en/> Convert the enum value map into a dropdown option list.
 *
 * <zh/> 遍历 `valueEnum`，将每个条目规范化为 `{ label, value }` 格式，适用于下拉框等选择组件的选项源。
 * <en/> Iterates `valueEnum` and normalizes each entry into `{ label, value }` format, suitable as the option source for select-like components.
 *
 * @param valueEnum - <zh/> 枚举值映射表 | <en/> enum value map
 * @returns <zh/> 选项列表，每项包含 `label`（显示文本）和 `value`（原始值） | <en/> option list, each item contains `label` (display text) and `value` (raw value)
 */
export function getEnumOptions(valueEnum: ValueEnum) {
  return Object.entries(valueEnum).map(([value, item]) => {
    const normalized = normalizeEnumItem(item)
    return { label: normalized.text, value }
  })
}
