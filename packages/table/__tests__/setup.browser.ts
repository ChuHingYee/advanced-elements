import { vi } from 'vitest'
import { ref } from 'vue'
import { stub } from './browser/stubs'

// ── Dayjs locale stubs ──────────────────────────────────────────────
vi.mock('dayjs/locale/zh-cn', () => ({}))
vi.mock('dayjs/locale/en', () => ({}))

// ── VueUse – stub composables that need real DOM elements ───────────
/**
 * <zh/> 用 `importOriginal` 保留真实模块，仅覆盖需要真实 DOM 的那几个组合式函数。
 *
 * <zh/> 原先是不带 `importOriginal` 的**部分 mock**：模块只提供下面 6 个导出，任何其它导入
 * <zh/>（`refDebounced` / `useEventListener` / `onClickOutside` / `onKeyStroke` …）在 browser 项目里
 * <zh/> 都会以 "does not provide an export named X" 失败——而 unit 项目的 setup 不 mock 本模块，
 * <zh/> 于是出现"同一批用例 unit 全绿、browser 全红"的假象。与 `__harness__/layout-mock.ts` 的写法对齐。
 *
 * <en/> Keep the real module via `importOriginal` and override only the DOM-dependent composables.
 *
 * <en/> This used to be a **partial mock** without `importOriginal`: the module exposed just the six exports
 * <en/> below, so every other import (`refDebounced` / `useEventListener` / `onClickOutside` / `onKeyStroke` …)
 * <en/> failed in the browser project with "does not provide an export named X" — while the unit project's
 * <en/> setup never mocks this module, producing the illusion of "same cases green in unit, red in browser".
 * <en/> Aligned with the existing convention in `__harness__/layout-mock.ts`.
 */
vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return {
    ...actual,
    useMouseInElement: vi.fn(() => ({
      isOutside: ref(true),
      elementX: ref(0),
      elementY: ref(0),
      elementPositionX: ref(0),
      elementPositionY: ref(0),
      elementWidth: ref(0),
      elementHeight: ref(0),
      stop: vi.fn(),
    })),
    /**
     * <zh/> `useElementSize` **刻意不 stub**——这是浏览器 project 存在的意义：真实布局可测，
     * <zh/> 而 stub 成 0×0 会让 `ElAutoResizer` 测量恒为 0，虚拟模式表头/行被尺寸门控抑制，
     * <zh/> 组件永远渲染不出行（`mountTable` 的行锚点轮询 15s 超时 → 用例 30s 超时）。
     * <zh/> 需要固定视口的用例由 `__harness__/layout-mock.ts` 的 `setViewport` 负责（600×320）。
     * <en/> `useElementSize` is deliberately **not** stubbed — real layout is measurable, which is the whole
     * <en/> point of the browser project; stubbing it to 0×0 keeps `ElAutoResizer` at zero, size-gates the
     * <en/> virtual headers/rows off, and the component never renders a row (the `mountTable` row-anchor poll
     * <en/> then burns its 15s deadline → a 30s per-case timeout). Cases that need a pinned viewport use
     * <en/> `setViewport` from `__harness__/layout-mock.ts` (600×320).
     */
    useResizeObserver: vi.fn(() => ({ stop: vi.fn() })),
    useDebounceFn: vi.fn((fn: any) => fn),
    useFullscreen: vi.fn(() => ({
      isFullscreen: ref(false),
      toggle: vi.fn(),
      enter: vi.fn(),
      exit: vi.fn(),
    })),
    useWindowSize: vi.fn(() => ({
      width: ref(1024),
      height: ref(768),
    })),
  }
})

// ── Element Plus – stub to avoid "Maximum recursive updates" ────────
/**
 * <zh/> 重要声明：本 browser project **整体 stub 掉 element-plus**（见下），
 * <zh/> `ElTable`/`ElTableV2`/`ElAutoResizer` 均为"只渲染原生标签 + 透传 slots"的占位组件，
 * <zh/> 不会按 data/columns 生成行。因此这里的 chromium 运行**不构成任何真实 EP 覆盖**
 * <zh/> （真实表格 DOM、滚动、排序、选择、固定列、ResizeObserver 均未被触达）。
 * <zh/> 需要真实 EP 的用例（组件级 parity 矩阵）一律在 unit（happy-dom + 真实 element-plus）跑，
 * <zh/> 并已从本 project 的 include 中排除。
 * <zh/> 要把 EP 真实 DOM 纳入浏览器覆盖，需改为：注册 v-loading 指令、不 stub element-plus、
 * <zh/> 保留真实 ResizeObserver/AutoResizer、给宿主一个有尺寸的 `attachTo` 容器。
 *
 * <en/> caveat: this browser project **stubs element-plus wholesale** (below);
 * <en/> `ElTable`/`ElTableV2`/`ElAutoResizer` are placeholder components that only render native
 * <en/> tags and forward slots — they never generate rows from data/columns. Running here therefore
 * <en/> provides **no real-EP coverage at all** (no real table DOM, scrolling, sorting, selection,
 * <en/> fixed columns or ResizeObserver). Cases that need real EP (the component parity matrix) run in
 * <en/> the unit project (happy-dom + real element-plus) and are excluded from this project.
 */
vi.mock('element-plus', async () => {
  const S = stub
  const LoadingDir = { mounted: () => {}, unmounted: () => {} }

  return {
    // ── Directives ───────────────────────────────────────────────
    vLoading: LoadingDir,

    // ── Table (realistic props for composition API introspection) ─
    ElTable: S('ElTable'),
    ElTableColumn: S('ElTableColumn'),
    ElTableV2: S('ElTableV2'),
    ElAutoResizer: S('ElAutoResizer'),

    // ── Pagination ───────────────────────────────────────────────
    ElPagination: S('ElPagination'),

    // ── Form ─────────────────────────────────────────────────────
    ElForm: S('ElForm'),
    ElFormItem: S('ElFormItem'),

    // ── Input / Select ───────────────────────────────────────────
    ElInput: S('ElInput'),
    ElInputNumber: S('ElInputNumber'),
    ElSelect: S('ElSelect'),
    ElOption: S('ElOption'),
    ElDatePicker: S('ElDatePicker'),
    ElSwitch: S('ElSwitch'),

    // ── Buttons ──────────────────────────────────────────────────
    ElButton: S('ElButton'),

    // ── Icon ─────────────────────────────────────────────────────
    ElIcon: S('ElIcon'),

    // ── Selection ────────────────────────────────────────────────
    ElCheckbox: S('ElCheckbox'),
    ElCheckboxGroup: S('ElCheckboxGroup'),
    ElRadio: S('ElRadio'),
    ElRadioGroup: S('ElRadioGroup'),

    // ── Tooltip / Popover ────────────────────────────────────────
    ElTooltip: S('ElTooltip'),
    ElPopover: S('ElPopover'),

    // ── Tag ──────────────────────────────────────────────────────
    ElTag: S('ElTag'),
    ElBadge: S('ElBadge'),

    // ── Dropdown ─────────────────────────────────────────────────
    ElDropdown: S('ElDropdown'),
    ElDropdownMenu: S('ElDropdownMenu'),
    ElDropdownItem: S('ElDropdownItem'),

    // ── Collapse / Layout ────────────────────────────────────────
    ElCollapse: S('ElCollapse'),
    ElCollapseItem: S('ElCollapseItem'),
    ElDivider: S('ElDivider'),
    ElRow: S('ElRow'),
    ElCol: S('ElCol'),
    ElSpace: S('ElSpace'),

    // ── Scrollbar ────────────────────────────────────────────────
    ElScrollbar: S('ElScrollbar'),

    // ── Cell renderers (template-only) ───────────────────────────
    ElLink: S('ElLink'),
    ElProgress: S('ElProgress'),
    ElAvatar: S('ElAvatar'),
    ElImage: S('ElImage'),
    ElRate: S('ElRate'),

    // ── Functions ────────────────────────────────────────────────
    useGlobalConfig: () => ({ locale: {}, lang: 'zh-cn' }),
    ElMessage: Object.assign(vi.fn(), {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    }),
    ElMessageBox: vi.fn(),
  }
})
