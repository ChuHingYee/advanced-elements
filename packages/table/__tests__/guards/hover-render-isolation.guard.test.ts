import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * <zh/> 锁定 teleport 悬浮操作条的渲染隔离契约：hover 状态只允许 HoverTeleportOverlay 在
 * <zh/> 自身 render effect 内读取。渲染器模板一旦读取这些 ref，每次跨行/滚动帧都会重渲染
 * <zh/> 整个表格（ElTable 插槽重建 → ElTableBody 全量 renderRow；实测单次 100 行约 130ms）。
 * <en/> Locks the render-isolation contract of the teleported hover bar: hover state may only be
 * <en/> read by HoverTeleportOverlay inside its own render effect. Once a renderer template reads
 * <en/> these refs, every row crossing/scroll frame re-renders the whole table (ElTable slot
 * <en/> rebuild → full ElTableBody renderRow; measured ~130ms per pass at 100 rows).
 */

const ROOT = resolve(import.meta.dirname, '../..')

const RENDERERS = [
  'src/components/table-renderer/TableRenderer.vue',
  'src/components/table-virtual-renderer/TableVirtualRenderer.vue',
] as const

const OVERLAY = 'src/components/cell-renderers/hover-teleport-overlay.vue'

/** <zh/> 只允许 overlay 消费的 hover 状态 / 组件名 | <en/> Hover state / component names reserved for the overlay */
const HOVER_ONLY_TOKENS = [
  'hoverLayerVisible',
  'hoverLayerCollapsed',
  'hoverLayerStyle',
  'hoverRowData',
  'hoverRowIndex',
  'teleportRowRect',
  'isScrolling',
  'showTeleportHover',
  'hoverOptionZIndex',
  'RowActionBar',
] as const

function templateOf(file: string): string {
  const source = readFileSync(resolve(ROOT, file), 'utf-8')
  const start = source.indexOf('<template>')
  const end = source.lastIndexOf('</template>')
  expect(start, `${file} has no <template> block`).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  return source.slice(start, end)
}

describe('hover render isolation guard', () => {
  it.each(RENDERERS)('%s assembles HoverTeleportOverlay instead of a hover bar', (file) => {
    expect(templateOf(file)).toContain('<HoverTeleportOverlay')
  })

  it.each(RENDERERS)('%s template never reads teleport hover state', (file) => {
    const template = templateOf(file)
    const leaked = HOVER_ONLY_TOKENS.filter(token => template.includes(token))
    expect(leaked).toEqual([])
  })

  it('lets HoverTeleportOverlay be the only consumer of the teleport overlay domain', () => {
    const overlay = readFileSync(resolve(ROOT, OVERLAY), 'utf-8')
    expect(overlay).toContain('teleportOverlay')
    expect(overlay).toContain('hoverRowData')
  })
})
