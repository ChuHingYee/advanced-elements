import type { ProcessedColumn } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { computed } from 'vue'
import { useEditorResolver } from '../../src/composables/editing/use-editor-resolver'

// 惰性注册（ensureBuiltInEditors）在 getEditorComponent 首次调用时幂等执行，
// 使 'text' 等字符串编辑器开箱即用，无需消费者显式调用 registerAllBuiltInEditors
describe('useEditorResolver', () => {
  it('resolves built-in string editors without explicit registration', () => {
    const columns = computed(() => [
      { prop: 'name', label: '姓名', editable: true, cellEditor: 'text' },
    ] as ProcessedColumn[])
    const { getEditorComponent } = useEditorResolver({ columns })
    expect(getEditorComponent(columns.value[0])).toBeDefined()
  })

  it('resolves inferred editor from valueType', () => {
    const columns = computed(() => [
      { prop: 'age', label: '年龄', editable: true, valueType: 'digit' },
    ] as ProcessedColumn[])
    const { getEditorComponent } = useEditorResolver({ columns })
    expect(getEditorComponent(columns.value[0])).toBeDefined()
  })
})
