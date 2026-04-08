import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// <zh/> 锁定主编排器的装配顺序——顺序是隐式契约：Interaction 必须先于 SharedEditing 创建
// <zh/>（拖拽禁用探测靠后绑定 holder 才能避免循环依赖），Features 在 SharedEditing 之后
// <zh/> （导出守卫需要 hasUnsavedChanges）。重排这些调用即红，防止未来重构悄悄改变装配语义。
// <en/> Locks the main orchestrator's assembly order — the sequence is an implicit contract:
// <en/> Interaction must be created before SharedEditing (the drag-disable probe relies on a
// <en/> late-bound holder to avoid a cycle), and Features comes after SharedEditing (the export
// <en/> guard needs hasUnsavedChanges). Reordering these calls turns red, so refactors cannot
// <en/> silently change assembly semantics.
const ASSEMBLY_STEPS = [
  'useAdvTableCore',
  'useAdvTableDataColumns',
  'useSelectionOrchestrator',
  'useInteractionOrchestrator',
  'useAdvTableSharedEditing',
  'useAdvTableFeatures',
  'useRendererIntegration',
  'createAndProvideContext',
  'setupAdvTableWatchers',
  'assembleAdvTableApi',
  'setupAdvTableLifecycle',
  'buildAdvTableProjection',
] as const

const source = readFileSync(resolve(import.meta.dirname, '../../src/composables/use-adv-table.ts'), 'utf-8')

function firstCallLine(name: string): number {
  // <zh/> 兼容 `useXxx<T>(...)` 泛型调用形式；import 语句无括号不会误匹配 | <en/> generic `useXxx<T>(...)` calls included; bare imports carry no parens and never match
  const callRE = new RegExp(`\\b${name}(?:\\s*<[^>(]*>)?\\s*\\(`)
  const lines = source.split('\n')
  const idx = lines.findIndex(line => callRE.test(line))
  return idx === -1 ? -1 : idx + 1
}

describe('assembly-order guard: useAdvTable orchestrator sequence', () => {
  it('keeps the documented @architecture layered diagram at the file head', () => {
    expect(source).toContain('@architecture')
    expect(source).toContain('RendererIntegration（渲染器集成/事件绑定/上下文 provide）')
  })

  it('assembles every step, in the documented order', () => {
    const positions = ASSEMBLY_STEPS.map((name) => {
      const line = firstCallLine(name)
      expect(line, `${name}(...) call not found in use-adv-table.ts`).toBeGreaterThan(0)
      return line
    })
    const sorted = [...positions].sort((a, b) => a - b)
    expect(positions, 'assembly steps must appear in the documented order').toEqual(sorted)
  })
})
