/**
 * @component CopyableCell
 * @displayName 可复制单元格
 * @displayName Copyable Cell
 * @description <zh/> 单元格内容 + 复制图标渲染 | <en/> Cell content plus copy-icon rendering
 * @category 数据展示 | Data Display
 */
import type { CopyApi } from '../../composables/shared/use-copy-api'
import { CopyDocument } from '@element-plus/icons-vue'
import { defineComponent, h, inject } from 'vue'
import { advCopyKey } from '../../composables/shared/use-copy-api'

/**
 * <zh/> 可复制单元格渲染组件
 * <en/> Copyable cell renderer component
 * @remarks
 * <zh/> 在单元格内渲染内容及一个复制图标，点击图标将单元格内容复制到剪贴板。
 * 支持通过 copyHeaders 和 columnLabel 在复制内容前附加列标题，便于粘贴时识别数据来源
 * <en/> Renders content and a copy icon inside the cell, clicking the icon copies cell content to clipboard.
 * Supports attaching column headers via copyHeaders and columnLabel before copied content for easy data source identification when pasting
 *
 * @prop {string | number | boolean | object | Array} cellData - <zh/> 单元格数据，作为复制源文本 | <en/> cell data, used as source text for copying
 * @prop {string} columnLabel - <zh/> 列标题，用于带表头复制模式 | <en/> column label, used for copy-with-headers mode
 * @prop {boolean} copyHeaders - <zh/> 是否在复制内容前附加列标题 | <en/> whether to prepend column header before copied content
 * @prop {Function} t - <zh/> 国际化翻译函数，用于复制成功提示文案 | <en/> i18n translate function, used for copy success message
 */
export const CopyableCell = defineComponent({
  name: 'AdvCopyableCell',
  props: {
    cellData: {
      type: [String, Number, Boolean, Object, Array],
      default: '',
    },
    /** <zh/> 列标题——用于带表头复制模式。 | <en/> Column label, used for copy-with-headers mode. */
    columnLabel: {
      type: String,
      default: '',
    },
    /** <zh/> 是否在复制内容前附加列标题。 | <en/> Whether to prepend the column header before copied content. */
    copyHeaders: {
      type: Boolean,
      default: false,
    },
    t: {
      type: Function,
      default: undefined,
    },
  },
  setup(props, { slots }) {
    const sharedCopy = inject<CopyApi | undefined>(advCopyKey, undefined)

    return () => h(
      'span',
      { class: 'adv-table__cell-copyable' },
      [
        slots.default?.(),
        h(CopyDocument, {
          class: [
            'adv-table__cell-copyable-icon',
            { 'adv-table__cell-copyable-icon--copied': sharedCopy?.copied.value },
          ],
          onClick: (e: Event) => {
            e.stopPropagation()
            sharedCopy?.handleCopyClick(
              String(props.cellData),
              props.copyHeaders,
              props.columnLabel,
              props.t as ((path: string) => string) | undefined,
            )
          },
        }),
      ],
    )
  },
})
