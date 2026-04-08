/**
 * <zh/> 网格无障碍属性透传——两渲染器均为 `inheritAttrs: false`，table.vue 下发的
 * <zh/> `role="grid"` / `aria-rowcount` / `aria-colcount` / `aria-label` 会滞留 $attrs；
 * <zh/> 本函数挑出这四个键，由渲染器根节点显式 `v-bind`，避免语义静默丢失。
 * <en/> Grid a11y attribute passthrough — both renderers use `inheritAttrs: false`, so the
 * <en/> `role="grid"` / `aria-rowcount` / `aria-colcount` / `aria-label` from table.vue stall in $attrs;
 * <en/> pick these four keys here and `v-bind` them on each renderer root to avoid silent loss.
 */
import type { ObjectDirective } from 'vue'

const GRID_A11Y_KEYS = ['role', 'aria-rowcount', 'aria-colcount', 'aria-label'] as const

/**
 * <zh/> 幂等写入——值相同不写。
 *
 * <zh/> 归一化会在同一帧内被 `MutationObserver` 与指令 `updated` 反复触发（合帧后每帧一次），
 * <zh/> 而目标属性一经写入便不再变化；无差别 `setAttribute` 会让每一帧都把**整表**的属性重写一遍
 * <zh/> （10k×50 即 50 万次写），这既是纯浪费，也会持续惊扰浏览器无障碍树。
 * <zh/> 实测（happy-dom，50 列）：25k 单元格 343ms → 21ms、100k 单元格 1453ms → 80ms，约 16～18×；
 * <zh/> 开销随单元格数线性增长，真实浏览器同样受益（写属性远贵于读属性）。
 *
 * <en/> Idempotent write — skip when the value is already correct.
 *
 * <en/> Normalization is re-triggered within one frame by both the `MutationObserver` and the directive's
 * <en/> `updated` hook (once per frame after coalescing), while the target attributes never change once
 * <en/> written; unconditional `setAttribute` therefore rewrites the **entire table's** attributes every
 * <en/> frame (500k writes at 10k×50) — pure waste that also keeps disturbing the browser's a11y tree.
 * <en/> Measured (happy-dom, 50 columns): 25k cells 343ms → 21ms and 100k cells 1453ms → 80ms, roughly
 * <en/> 16–18×; cost is linear in cell count, and real browsers benefit too (writes cost far more than reads).
 */
function writeAttr(el: Element, name: string, value: string): void {
  if (el.getAttribute(name) !== value)
    el.setAttribute(name, value)
}

/**
 * <zh/> 从 `$attrs` 中挑出网格无障碍键（`role` / `aria-rowcount` / `aria-colcount` / `aria-label`），
 * <zh/> 供渲染器根节点显式 `v-bind`，避免语义静默丢失。
 * <en/> Pick the grid a11y keys (`role` / `aria-rowcount` / `aria-colcount` / `aria-label`) from `$attrs`
 * <en/> for explicit `v-bind` on the renderer root, avoiding silent semantics loss.
 *
 * @param attrs - <zh/> 组件 `$attrs` 对象 | <en/> component `$attrs` object
 * @returns <zh/> 仅含无障碍键的新对象，无匹配时为空对象 | <en/> new object containing only the a11y keys, empty when none match
 */
export function pickGridA11yAttrs(attrs: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of GRID_A11Y_KEYS) {
    const value = attrs[key]
    if (value !== undefined && value !== null)
      out[key] = value
  }
  return out
}

function normalizeGridHierarchy(root: HTMLElement): void {
  const main = root.querySelector<HTMLElement>('.adv-table__main')
  if (!main)
    return

  for (const table of main.querySelectorAll<HTMLTableElement>('table')) {
    if (table.closest('td, th, [role="cell"], [role="gridcell"]'))
      continue
    writeAttr(table, 'role', 'none')
    for (const section of table.querySelectorAll('thead, tbody, tfoot')) {
      if (section.closest('table') === table) {
        writeAttr(section, 'role', 'rowgroup')
        if (section.hasAttribute('tabindex'))
          section.removeAttribute('tabindex')
      }
    }
    for (const row of Array.from(table.rows)) {
      writeAttr(row, 'role', 'row')
      for (const cell of Array.from(row.cells)) {
        const innerCell = cell.querySelector('[role="gridcell"]')
        writeAttr(cell, 'role', cell.tagName === 'TH' ? 'columnheader' : innerCell ? 'none' : 'gridcell')
      }
    }
  }

  for (const table of main.querySelectorAll<HTMLElement>('[role="table"]')) {
    if (!table.closest('[role="cell"], [role="gridcell"]'))
      writeAttr(table, 'role', 'none')
  }
  for (const el of main.querySelectorAll<HTMLElement>('[role="rowgroup"]')) {
    if (!el.querySelector('[role="row"]') && el.hasAttribute('role'))
      el.removeAttribute('role')
  }
  for (const cell of main.querySelectorAll<HTMLElement>('[role="cell"]')) {
    const innerCell = cell.querySelector('[role="gridcell"]')
    writeAttr(cell, 'role', innerCell ? 'none' : 'gridcell')
  }
}

const gridObservers = new WeakMap<HTMLElement, MutationObserver>()

/**
 * <zh/> 待执行的归一化取消句柄——同帧内的多次触发合并为一次全量 `normalizeGridHierarchy`。
 *
 * <zh/> 虚拟滚动期每帧都会挂载/卸载行节点，`MutationObserver` 的 subtree 回调与指令的
 * <zh/> `updated` 会在同一帧内多次触发；未合帧时每次触发都会执行「全表 `querySelectorAll`
 * <zh/> + 遍历全部 rows/cells 重写 role」的 O(行×列) 扫描，构成滚动期的真实 CPU 开销。
 * <zh/> 合帧后同帧只跑一次，卸载时取消未执行的任务。
 *
 * <en/> Pending normalize cancel handles — multiple triggers within one frame collapse into a single
 * <en/> full `normalizeGridHierarchy` pass.
 * <en/> During virtual scrolling every frame mounts/unmounts row nodes, so the observer's subtree
 * <en/> callback and the directive's `updated` hook both fire repeatedly within one frame. Without
 * <en/> coalescing, each trigger runs a full `querySelectorAll` + all-rows/cells role rewrite
 * <en/> an O(rows × cols) scan that is real per-frame CPU cost. With coalescing the work runs once
 * <en/> per frame, and unmount cancels a not-yet-run task.
 */
const pendingNormalizes = new WeakMap<HTMLElement, () => void>()

function scheduleGridNormalize(root: HTMLElement): void {
  if (pendingNormalizes.has(root))
    return
  if (typeof requestAnimationFrame === 'function') {
    const handle = requestAnimationFrame(() => {
      pendingNormalizes.delete(root)
      normalizeGridHierarchy(root)
    })
    pendingNormalizes.set(root, () => cancelAnimationFrame(handle))
    return
  }
  const handle = setTimeout(() => {
    pendingNormalizes.delete(root)
    normalizeGridHierarchy(root)
  }, 0)
  pendingNormalizes.set(root, () => clearTimeout(handle))
}

export const vGridA11y: ObjectDirective<HTMLElement> = {
  mounted(root) {
    // <zh/> 挂载时立即归一一次，不走合帧——首屏不能等 rAF，否则 a11y 属性缺失
    // <en/> Normalize immediately on mount without coalescing — the first paint must not wait for
    // <en/> rAF, otherwise a11y attributes are missing
    normalizeGridHierarchy(root)
    const observer = new MutationObserver(() => scheduleGridNormalize(root))
    observer.observe(root, { childList: true, subtree: true })
    gridObservers.set(root, observer)
  },
  updated: root => scheduleGridNormalize(root),
  beforeUnmount(root) {
    gridObservers.get(root)?.disconnect()
    gridObservers.delete(root)
    pendingNormalizes.get(root)?.()
    pendingNormalizes.delete(root)
  },
}

/**
 * <zh/> 暂停/恢复 a11y 归一观察——KeepAlive 停用时隐藏表不应继续扫描 DOM。
 *
 * <zh/> 刻意不走指令的 `activated`/`deactivated` 钩子：本仓库所用 Vue 运行时的
 * <zh/> `invokeDirectiveHook` 只派发 created/beforeMount/mounted/beforeUpdate/updated/
 * <zh/> beforeUnmount/unmounted，`ObjectDirective` 类型也无这两个键——写了也不会被调用。
 * <zh/> 故由渲染器 composable 在生命周期钩子里显式调用。
 *
 * <en/> pause/resume the a11y normalization observer — a hidden (deactivated) table must
 * <en/> not keep scanning the DOM.
 *
 * <en/> Deliberately not implemented via directive `activated`/`deactivated` hooks: the Vue runtime
 * <en/> used here only dispatches created/beforeMount/mounted/beforeUpdate/updated/beforeUnmount/
 * <en/> unmounted from `invokeDirectiveHook`, and `ObjectDirective` has no such keys — such hooks
 * <en/> would never run. Renderers therefore call these helpers from their lifecycle hooks.
 */
export function pauseGridA11yObserver(root: HTMLElement | null | undefined): void {
  if (!root)
    return
  gridObservers.get(root)?.disconnect()
  gridObservers.delete(root)
  pendingNormalizes.get(root)?.()
  pendingNormalizes.delete(root)
}

export function resumeGridA11yObserver(root: HTMLElement | null | undefined): void {
  if (!root || gridObservers.has(root))
    return
  normalizeGridHierarchy(root)
  const observer = new MutationObserver(() => scheduleGridNormalize(root))
  observer.observe(root, { childList: true, subtree: true })
  gridObservers.set(root, observer)
}
