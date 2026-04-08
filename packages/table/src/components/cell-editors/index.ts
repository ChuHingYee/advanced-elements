import { defineAsyncComponent } from 'vue'
import { ASYNC_PANEL_DELAY_MS } from '../../constants'
import { AsyncChunkLoadError, createChunkLoadOnError } from '../../utils/async-chunk'
import { registerBuiltInEditor } from './editor-factory'

export { registerBuiltInEditor } from './editor-factory'
export { createScopedEditorRegistry, registerCellEditor, resolveEditor, unregisterCellEditor } from './editor-factory'
export type { ScopedEditorRegistry, TableEditorOverrides } from './editor-factory'

/**
 * <zh/> 内置编辑器异步加载器——首渲染解析；注册后即后台预热，首次打开已就绪
 * <en/> Built-in editor async loaders — resolved on first render; preloaded in background after registration
 */
const BUILT_IN_EDITOR_LOADERS = {
  text: () => import('./text-editor.vue'),
  number: () => import('./number-editor.vue'),
  select: () => import('./select-editor.vue'),
  date: () => import('./date-editor.vue'),
  datetime: () => import('./datetime-editor.vue'),
  switch: () => import('./switch-editor.vue'),
  checkbox: () => import('./checkbox-editor.vue'),
}

/** <zh/> 已注册标记——重复调用为无操作（多表共存不告警、不冲刷） | <en/> Registered flag — repeat calls are no-ops (no warnings/churn with multiple tables) */
let builtInEditorsRegistered = false

/** <zh/> 显式注册所有内置编辑器 | <en/> Explicitly register all built-in editors */
export function registerAllBuiltInEditors(): void {
  if (builtInEditorsRegistered)
    return
  builtInEditorsRegistered = true
  registerBuiltInEditor('text', defineAsyncComponent({
    loader: BUILT_IN_EDITOR_LOADERS.text,
    errorComponent: AsyncChunkLoadError,
    onError: createChunkLoadOnError('cell-editor-text'),
    delay: ASYNC_PANEL_DELAY_MS,
  }))
  registerBuiltInEditor('number', defineAsyncComponent({
    loader: BUILT_IN_EDITOR_LOADERS.number,
    errorComponent: AsyncChunkLoadError,
    onError: createChunkLoadOnError('cell-editor-number'),
    delay: ASYNC_PANEL_DELAY_MS,
  }))
  registerBuiltInEditor('select', defineAsyncComponent({
    loader: BUILT_IN_EDITOR_LOADERS.select,
    errorComponent: AsyncChunkLoadError,
    onError: createChunkLoadOnError('cell-editor-select'),
    delay: ASYNC_PANEL_DELAY_MS,
  }))
  registerBuiltInEditor('date', defineAsyncComponent({
    loader: BUILT_IN_EDITOR_LOADERS.date,
    errorComponent: AsyncChunkLoadError,
    onError: createChunkLoadOnError('cell-editor-date'),
    delay: ASYNC_PANEL_DELAY_MS,
  }))
  registerBuiltInEditor('datetime', defineAsyncComponent({
    loader: BUILT_IN_EDITOR_LOADERS.datetime,
    errorComponent: AsyncChunkLoadError,
    onError: createChunkLoadOnError('cell-editor-datetime'),
    delay: ASYNC_PANEL_DELAY_MS,
  }))
  registerBuiltInEditor('switch', defineAsyncComponent({
    loader: BUILT_IN_EDITOR_LOADERS.switch,
    errorComponent: AsyncChunkLoadError,
    onError: createChunkLoadOnError('cell-editor-switch'),
    delay: ASYNC_PANEL_DELAY_MS,
  }))
  registerBuiltInEditor('checkbox', defineAsyncComponent({
    loader: BUILT_IN_EDITOR_LOADERS.checkbox,
    errorComponent: AsyncChunkLoadError,
    onError: createChunkLoadOnError('cell-editor-checkbox'),
    delay: ASYNC_PANEL_DELAY_MS,
  }))
  // <zh/> 后台预热：注册后即加载各编辑器 chunk，首次双击打开时已就绪，聚焦时序与同步注册一致
  // <en/> Background preload: editor chunks load right after registration, ready before first dblclick with identical focus timing
  void Promise.all(
    Object.values(BUILT_IN_EDITOR_LOADERS).map(load => load().then(
      () => undefined,
      () => undefined,
    )),
  )
}
