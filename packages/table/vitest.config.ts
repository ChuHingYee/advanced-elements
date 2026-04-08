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
          // <zh/> 默认归 unit（happy-dom + 真实 Element Plus）：除 e2e（需真实浏览器）外的全部套件。
          // <zh/> 历史上这里是正向白名单，曾漏登新文件致其静默不跑（virtual-renderer/span-row-renderer，
          // <zh/> 已并入 table-virtual-renderer 并修复）；负向形式让新文件默认被执行，唯一例外 e2e 显式排除。
          // <en/> Everything defaults to unit (happy-dom + real Element Plus) except e2e (needs a real browser).
          // <en/> This was a positive whitelist that silently skipped newly added files
          // <en/> (virtual-renderer/span-row-renderer, since merged into table-virtual-renderer and fixed);
          // <en/> the negative form runs new files by default, with e2e as the only explicit opt-out.
          include: [
            '**/__tests__/**/*.{spec,test}.{ts,tsx}',
            '!**/__tests__/components/e2e/**',
          ],
          setupFiles: [resolve(import.meta.dirname, '__tests__/setup.ts')],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          // <zh/> 仅真·E2E 全链路需要真实浏览器。注意 setup.browser.ts 会整体 stub 掉 Element Plus
          // <zh/>（ElTable/ElTableV2/ElAutoResizer 均为只渲染原生标签的占位组件），因此 parity 等对拍套件
          // <zh/> 必须留在 unit——在浏览器 project 跑只会得到空白截图 + 30s 超时，掩盖真实回归。
          // <en/> Only the true E2E full-pipeline suite needs a real browser. Note setup.browser.ts stubs
          // <en/> element-plus entirely (ElTable/ElTableV2/ElAutoResizer are placeholder components rendering
          // <en/> bare native tags), so parity suites must stay in unit — running them here yields blank
          // <en/> screenshots + 30s timeouts that bury actual regressions.
          include: [
            '**/__tests__/components/e2e/**/*.{spec,test}.{ts,tsx}',
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
