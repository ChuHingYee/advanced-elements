import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * <zh/> 锁定根渲染隔离契约：高频交互态只允许在其专属消费点被读取——
 * <zh/> Shift 态/范围选择态只经命令式 DOM 属性进根元素，右键菜单态只在菜单宿主组件
 * <zh/> 自身的渲染效应内消费。AdvTable 根模板一旦读取，每次状态翻转都经组件 vnode 的
 * <zh/> DYNAMIC_SLOTS patchFlag 短路 shouldUpdateComponent，强制重渲染整表体
 * <zh/> （实测 100 行：每次 Shift keydown/keyup ≈57ms，右键打开均摊 ≈42ms）。
 * <en/> Locks the root-render isolation contract: high-frequency interaction state may only be
 * <en/> read at its dedicated consumer — Shift/range-selecting state reaches the root element
 * <en/> exclusively via imperative DOM attributes, context-menu state only inside the menu host
 * <en/> component's own render effect. Once the AdvTable root template reads such state, every
 * <en/> flip short-circuits shouldUpdateComponent through the component vnode's DYNAMIC_SLOTS
 * <en/> patchFlag and force-re-renders the whole tbody (measured at 100 rows: ≈57ms per Shift
 * <en/> keydown/keyup, ≈42ms amortized per context-menu open).
 */

const ROOT = resolve(import.meta.dirname, '../..')

const ADV_TABLE = 'src/AdvTable.vue'
const MENU_HOST = 'src/components/context-menu/context-menu-host.vue'

/** <zh/> 根模板禁读的高频态 | <en/> High-frequency state the root template must never read */
const ROOT_FORBIDDEN_TOKENS = [
  'interaction.shiftKeyPressed',
  'interaction.isRangeSelecting',
  'interaction.isContainerVisible',
  'noSelectClass',
  'menu.menuVisible',
  'menu.menuStyle',
  'menu.currentItems',
  'menu.currentParams',
  'menu.menuToken',
  'menu.closeMenu',
  'menu.onMenuItemClick',
  'setContextMenuRef',
] as const

/** <zh/> 菜单宿主必须消费的菜单态 | <en/> Menu state the host must consume */
const MENU_HOST_TOKENS = [
  'menu.menuVisible',
  'menu.menuStyle',
  'menu.currentItems',
  'menu.currentParams',
  'menu.menuToken',
  'interaction.isContainerVisible',
] as const

function sourceOf(file: string): string {
  return readFileSync(resolve(ROOT, file), 'utf-8')
}

function templateOf(file: string): string {
  const source = sourceOf(file)
  const start = source.indexOf('<template>')
  const end = source.lastIndexOf('</template>')
  expect(start, `${file} has no <template> block`).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  return source.slice(start, end)
}

describe('root render isolation guard', () => {
  it('adv-table root template never reads high-frequency interaction/menu state', () => {
    const template = templateOf(ADV_TABLE)
    const leaked = ROOT_FORBIDDEN_TOKENS.filter(token => template.includes(token))
    expect(leaked).toEqual([])
  })

  it('adv-table root consumes the menu via the host component', () => {
    expect(templateOf(ADV_TABLE)).toContain('<ContextMenuHost')
  })

  it('menu host consumes the menu domain inside its own render effect', () => {
    const template = templateOf(MENU_HOST)
    for (const token of MENU_HOST_TOKENS)
      expect(template).toContain(token)
  })

  it('shift/range-selecting state reaches the root element imperatively (attribute, not class)', () => {
    expect(sourceOf('src/composables/interaction/use-modifier-key-tracker.ts')).toContain('data-adv-table-no-select')
    expect(sourceOf('src/composables/interaction/use-interaction-orchestrator.ts')).toContain('data-adv-table-range-selecting')
    expect(sourceOf('src/style/table.scss')).toContain('[data-adv-table-no-select]')
    expect(sourceOf('src/style/cell-range-selection.scss')).toContain('[data-adv-table-range-selecting]')
  })

  it('root template never binds the legacy state classes', () => {
    const template = templateOf(ADV_TABLE)
    expect(template).not.toContain('adv-table--no-select')
    expect(template).not.toContain('adv-table--range-selecting')
  })
})
