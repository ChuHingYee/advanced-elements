import type { MaybeRefOrGetter, Ref } from 'vue'
import type { IRendererDomAdapter } from '../../components/renderer-core/dom-adapter'
import type { DragLocator } from '../../types/drag-locator'
import type { RendererCaps } from '../../types/renderer-caps'

/**
 * <zh/> 行拖拽契约——自 use-row-drag.ts 拆出（COMPLEXITY-PLAN 战线三，刀法 C）；
 * <zh/> use-row-drag.ts re-export 本文件，既有导入路径零变化。
 * <en/> Row-drag contracts — split out of use-row-drag.ts (COMPLEXITY-PLAN battle line 3,
 * <en/> knife C); re-exported, keeping import paths unchanged.
 */
export type RowDropValidator<T> = (context: {
  sourceRow: T
  targetRow: T
  position: 'before' | 'after'
}) => boolean

/** beforeDrag 取消守卫回调类型 | beforeDrag cancel-guard callback type */
export type RowBeforeDrag<T> = (context: {
  sourceRow: T
  sourceIndex: number
  targetRow: T
  targetIndex: number
  fullData: T[]
}) => Promise<boolean> | boolean

export interface UseRowDragOptions<T> {
  rowDraggable: boolean | MaybeRefOrGetter<boolean>
  rowDragHandle?: string | MaybeRefOrGetter<string>
  fullData: Ref<T[]>
  rowKey: Ref<(row: T) => string>
  getRowMap: () => Map<string, T>
  onDataReorder: (rows: T[]) => void
  dragLocator: DragLocator | MaybeRefOrGetter<DragLocator>
  /**
   * <zh/> 渲染器能力表——行拖拽只问行索引域（`rowIndexDomain`），不问渲染模式。
   * <zh/> 该能力决定拖拽提交体制（unpinned 按 rowKey 映射提交、composed 按 evt 索引提交）
   * <zh/> 与暂态监听挂载（unpinned 需额外挂 mouseup/scroll）。
   * <en/> Renderer capability table — row drag only asks the row-index domain
   * <en/> (`rowIndexDomain`), never the render mode. It decides the commit regime
   * <en/> (unpinned commits via rowKey mapping, composed by evt index) and transient listener binding.
   */
  caps: MaybeRefOrGetter<Pick<RendererCaps, 'rowIndexDomain'>>
  tableId?: string
  /**
   * <zh/> 当前模式 DOM 适配器——透传至拖拽容器生命周期做观察目标解析。
   * <en/> Current-mode DOM adapter — forwarded to the drag-container lifecycle.
   */
  dom?: MaybeRefOrGetter<IRendererDomAdapter | null | undefined>
  /**
   * <zh/> 起拖时把源行样式同步到 body 上的 fallback 克隆行——`<tr>` 离开 `<table>` 即失表格布局上下文，
   * <zh/> 单元格宽度全丢故克隆行无样式；div 行自带样式无需同步。调用时取值，模式切换后即生效。
   * <en/> Sync source-row styles onto the body-level fallback clone at drag start — a `<tr>` outside
   * <en/> `<table>` loses its table layout context and every cell width with it, so the clone looks
   * <en/> unstyled; div rows carry their own styles and skip the sync. Read at call time so mode switches apply.
   */
  syncFallbackStyle?: boolean | MaybeRefOrGetter<boolean>
  /**
   * 拖拽时禁止行实时移动，仅显示插入指示线，松开后才执行重排
   * During drag, disable real-time row movement; only show the insertion indicator, reorder after release
   */
  suppressMoveWhenRowDragging?: boolean | MaybeRefOrGetter<boolean>
  /** 判断行是否可放置到目标位置，返回 false 时显示无效放置反馈 */
  isRowValidDropPosition?: MaybeRefOrGetter<RowDropValidator<T> | undefined>
  /** 返回 false 取消拖拽重排 */
  beforeDrag?: MaybeRefOrGetter<RowBeforeDrag<T> | undefined>
  /**
   * 行拖拽开始回调
   * Row drag start callback
   */
  onRowDragStart?: (context: { sourceRow: T, sourceIndex: number, event: DragEvent }) => void
  /** 行拖拽结束回调，@param context.targetRow - 目标行数据，未命中时为 null */
  onRowDragEnd?: (context: { sourceRow: T, sourceIndex: number, targetRow: T | null, targetIndex: number, event: DragEvent }) => void
  /**
   * <zh/> 拖拽流程错误回调——beforeDrag 异常或拒绝后回滚失败时通过此回调透出错误
   * <en/> Drag flow error callback — surfaces errors when beforeDrag throws or rollback fails after rejection
   */
  onDragError?: (err: unknown, phase: 'beforeDrag' | 'commit') => void
  /**
   * <zh/> 编辑会话探测——有未提交编辑/进行中会话时拖拽禁用：
   * <zh/> 返回 true 即拒绝本次拖拽手势并经 `onEditConflict` 提示用户先完成编辑，避免重排覆盖未提交值或行索引错位。
   * <en/> Editing-session probe — row drag is disabled while it returns true:
   * <en/> a true value rejects the gesture and prompts via `onEditConflict` to finish editing first.
   */
  isEditing?: MaybeRefOrGetter<boolean>
  /**
   * <zh/> 编辑冲突提示——拖拽因编辑会话被拒绝时调用（用户可见提示由调用方下发，本模块另附一条 devWarn）。
   * <en/> Edit-conflict hook — called when a drag is rejected due to an active editing session.
   */
  onEditConflict?: () => void
  /**
   * <zh/> 自动注册生命周期（卸载/失活/激活）——延迟初始化（setup 之后创建）时传 false，由壳在 setup 期转发
   * <en/> Auto-register lifecycle (unmount/deactivate/activate) — pass false for deferred post-setup init; the shell forwards from setup
   * @default true
   */
  autoLifecycle?: boolean
}

/**
 * <zh/> 行拖拽 composable——覆盖 default（SortableJS 实时移动）、suppressMove（指示线 + 松手落位）与 virtual（行虚拟化委托重排）三种体制，
 * <zh/> 含 beforeDrag 异步守卫、数据新鲜度检查与 DOM 回滚。
 * <en/> Row drag composable — covers three regimes: default (SortableJS live movement), suppressMove
 * <en/> (indicator line, reorder on release) and virtual (row-virtualization delegated reorder), with the
 * <en/> beforeDrag async guard, data freshness check and DOM rollback.
 *
 * @param options - <zh/> 拖拽开关、数据/行键、拖拽定位器与事件回调 | <en/> Drag switches, data/row key, drag locator and callbacks
 * @returns <zh/> 拖拽初始化/销毁/同步方法与拖拽中状态 | <en/> Init/destroy/sync methods and the is-row-dragging state
 */
