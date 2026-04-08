/**
 * <zh/> Hook 体积软门禁（R-8）——新增 hook 超 300 行即 warn，不阻断 CI。
 * <en/> Hook size soft gate (R-8) — warns on new hooks over 300 lines, never blocks CI.
 *
 * @remarks
 * <zh/> 存量超限文件已列入 BASELINE 豁免（ grandfathered ），仅对新增文件生效；
 * <zh/> 旧文件“摸到才拆”（R-8 纪律），不另起重构专案。阈值与归属矩阵 P2（先热后冷）配合使用。
 * <en/> Existing oversized files are grandfathered in BASELINE; only new files warn.
 * <en/> Legacy files split opportunistically ("touch-it-split-it", R-8).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

// <zh/> 经 stdout 输出（不用 console.*，避开 no-console 门禁）
// <en/> Output via stdout (not console.*, staying clear of the no-console gate)
const out = msg => process.stdout.write(`${msg}\n`)

const SRC = join(import.meta.dirname, '../src/composables')
const THRESHOLD_LINES = 300

/** <zh/> 存量豁免（相对 src/composables 的正斜杠路径，2026-09-18 快照） | <en/> Grandfathered snapshot */
const BASELINE = new Set([
  'use-adv-table.ts',
  'columns/use-column-state.ts',
  'api/use-table-api.ts',
  'data/use-column-filter.ts',
  'data/use-table-request.ts',
  'data/use-cell-span.ts',
  'data/use-tree-data.ts',
  'data/use-column-sort.ts',
  'view-model/use-row-view-model.ts',
  'data/use-table-data-pipeline.ts',
  'rendering/use-hover-layer.ts',
  'editing/use-editing-orchestrator.ts',
  'editing/use-cell-validate.ts',
  'interaction/use-clipboard-handler.ts',
  'rendering/use-teleport-row-rect.ts',
  'interaction/use-row-drag.ts',
  'interaction/use-cell-range-selection.ts',
  'editing/use-batch-commit.ts',
  'columns/use-column-drag.ts',
  'rendering/use-table-renderer-events.ts',
  'data/use-table-pagination.ts',
  'editing/use-cell-edit-lifecycle.ts',
  'data/use-request.ts',
  'columns/use-column-resize.ts',
  'editing/use-cell-edit-commit-row.ts',
  'data/use-row-expand.ts',
  'columns/use-columns.ts',
  'core/use-renderer-integration.ts',
  'editing/create-editing-stub.ts',
  'data/use-row-group.ts',
  'core/use-data-domain.ts',
  'interaction/use-interaction-orchestrator.ts',
  'core/use-table-config.ts',
  'interaction/use-grid-navigation.ts',
  'interaction/row-drag-regimes.ts',
  'editing/use-cell-edit.ts',
  'data/use-row-pin.ts',
  'features/use-context-menu.ts',
  'data/use-quick-filter.ts',
  'selection/selection-batch.ts',
  'editing/use-edit-undo.ts',
  'rendering/use-cell-events.ts',
])

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    const s = statSync(p)
    if (s.isDirectory())
      walk(p, out)
    else if (e.endsWith('.ts'))
      out.push(p)
  }
  return out
}

function countLines(file) {
  return readFileSync(file, 'utf-8').split('\n').length
}

let warnings = 0
for (const file of walk(SRC)) {
  const rel = file.slice(SRC.length + 1).split('\\').join('/')
  const lines = countLines(file)
  if (lines > THRESHOLD_LINES && !BASELINE.has(rel)) {
    warnings++
    console.warn(`[hook-size] ${rel}: ${lines} lines > ${THRESHOLD_LINES} — split into *-core/*-helpers or extract pure functions (R-8, warn-only)`)
  }
}

if (warnings > 0) {
  console.warn(`Hook size: ${warnings} new oversized hook file(s) (warn only, R-8)`)
}
else {
  out('Hook size passed (warn-only)')
}
