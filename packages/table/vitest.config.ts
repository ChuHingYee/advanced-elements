import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue(), vueJsx()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
      '@advanced-elements/config-provider': resolve(import.meta.dirname, '../config-provider/src/index.ts'),
    },
  },
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        // <zh/> 与 vitest.coverage.config.ts 保持单一阈值来源（85/75/85/85），避免双源漂移
        // <en/> Keep a single threshold source with vitest.coverage.config.ts (85/75/85/85)
        statements: 85,
        branches: 75,
        functions: 85,
        lines: 85,
      },
      include: ['src/**/*.ts'],
      exclude: [

        'node_modules',
        '__tests__',
        'vitest.config.ts',
        '*.d.ts',
        '**/style/**',

        '**/index.ts',
        '**/locale/types.ts',
        '**/use-row-drag.ts',
        '**/use-teleport-row-rect.ts',
        '**/use-table-renderer-events.ts',
      ],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'happy-dom',
          include: [
            '**/__tests__/{composables,utils,entry,locale,features}/**/*.{spec,test}.{ts,tsx}',
            '**/__tests__/guards/**/*.{spec,test}.{ts,tsx}',
            // <zh/> integration 套件为 composable 级测试，happy-dom 可运行。
            // <en/> Integration suites are composable-level tests runnable under happy-dom.
            '**/__tests__/integration/**/*.{spec,test}.{ts,tsx}',
            '**/__tests__/coverage-gaps.test.ts',
            '**/__tests__/coverage-supplementary.test.ts',
            '**/__tests__/coverage-branches.test.ts',
            '**/__tests__/components/table.test.tsx',
            // <zh/> Vue `KeepAlive`/`Transition` 机制契约（无业务依赖，只需 DOM 计时器）——
            // <zh/> 侧面板保留语义的依据，归 unit 用 happy-dom 跑；browser project 无需重复。
            // <en/> Vue KeepAlive/Transition mechanism contract (no product deps, just DOM + timers) — the
            // <en/> basis of the panel-retention semantics; runs in unit under happy-dom.
            '**/__tests__/components/keepalive-include-semantics.test.ts',
            '**/__tests__/components/table-renderer/*.test.ts',
            '**/__tests__/components/table-virtual-renderer/*.test.ts',
            // <zh/> renderer-core 守护测试（DOM 适配器选择器 + ElTable 内建树形隔离）——
            // <zh/> 与 EP 真实渲染产物对拍，happy-dom 下即可运行，纳入 unit 以便 CI 阻断 EP 升级破坏。
            // <en/> renderer-core guard tests (DOM adapter selectors + ElTable built-in tree isolation)
            // <en/> compare against real EP render output, runnable under happy-dom; in the unit project so
            // <en/> CI blocks EP-upgrade breakage.
            '**/__tests__/components/renderer-core/*.test.ts',
            '**/__tests__/components/virtual-renderer/use-virtual-renderer.test.ts',
            '**/__tests__/components/virtual-renderer/selection-v2-column.test.ts',
            '**/__tests__/components/shared/*.test.ts',
            '**/__tests__/components/cell-editors/*.test.ts',
            // <zh/> cell-renderers / footer / 其余 header 套件与 browser project 互斥（无 DOM 依赖差异）。
            // <en/> cell-renderers / footer / remaining header suites are mutually exclusive with the
            // <en/> browser project (no DOM-dependency difference).
            '**/__tests__/components/cell-renderers/*.test.ts',
            '**/__tests__/components/footer/*.test.ts',
            '**/__tests__/components/header/column-filter-panel.test.ts',
            '**/__tests__/components/header/column-setting.test.ts',
            '**/__tests__/components/header/header.test.ts',
            '**/__tests__/components/header/header-polling-btn.test.ts',
            '**/__tests__/components/header/icon-drag.test.ts',
            '**/__tests__/components/header/floating-filter-cell.test.ts',
            '**/__tests__/components/search/*.test.ts',
            '**/__tests__/components/context-menu/*.test.ts',
            '**/__tests__/components/filter-panel/*.test.ts',
            '**/__tests__/components/column-group/*.test.ts',
            '**/__tests__/components/cell/*.test.ts',
            '**/__tests__/components/column-setting/*.test.ts',
            '**/__tests__/components/parity/*.test.{ts,tsx}',
          ],
          setupFiles: [resolve(import.meta.dirname, '__tests__/setup.ts')],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: [
            '**/__tests__/components/**/*.{spec,test}.{ts,tsx}',
            '!**/__tests__/components/table.test.tsx',
            '!**/__tests__/components/keepalive-include-semantics.test.ts',
            '!**/__tests__/components/table-renderer/*.test.ts',
            '!**/__tests__/components/table-virtual-renderer/*.test.ts',
            // <zh/> renderer-core 守护测试归 unit（happy-dom + 对拍真实渲染产物），不在浏览器 project 重复跑
            // <en/> renderer-core guard tests belong to unit (happy-dom + real render output); not re-run in the browser project
            '!**/__tests__/components/renderer-core/*.test.ts',
            '!**/__tests__/components/virtual-renderer/*.test.ts',
            '!**/__tests__/components/shared/*.test.ts',
            '!**/__tests__/components/cell-editors/*.test.ts',
            '!**/__tests__/components/cell-renderers/*.test.ts',
            '!**/__tests__/components/header/*.test.ts',
            '!**/__tests__/components/footer/*.test.ts',
            '!**/__tests__/components/utils/*.test.ts',
            '!**/__tests__/components/search/*.test.ts',
            '!**/__tests__/components/context-menu/*.test.ts',
            '!**/__tests__/components/filter-panel/*.test.ts',
            '!**/__tests__/components/column-group/*.test.ts',
            '!**/__tests__/components/cell/*.test.ts',
            '!**/__tests__/components/column-setting/*.test.ts',
            // parity 矩阵只在 unit（happy-dom + 真实 Element Plus）跑。
            // browser project 的 setup 整体 stub 掉 element-plus（ElTable/ElTableV2/ElAutoResizer
            // 均为只渲染原生标签的占位组件），在那里跑 parity 只会得到空白截图 + 30s 超时，
            // 既不构成真实浏览器覆盖，又让"全量测试失败"掩盖真实回归。
            '!**/__tests__/components/parity/**',
          ],
          setupFiles: [resolve(import.meta.dirname, '__tests__/setup.browser.ts')],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },

          coverage: {
            include: ['src/**/*.vue', 'src/**/*.tsx'],
            exclude: [
              'node_modules',
              '__tests__',
              '*.d.ts',
              '**/style/**',
              '**/types/**',
              '**/index.ts',
            ],
          },
        },
      },
    ],
  },
})
